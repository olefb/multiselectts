// File: telemetry/recorder.ts
//
// Records one session (participant) as a header plus an event stream, and
// saves it: to the local study server (vite telemetry plugin), to a
// localStorage crash backup, and on demand as a downloaded JSON file.

import { evaluateTask, type TaskSpec } from "../data/tasks";
import {
  TELEMETRY_SCHEMA,
  type SessionHeader,
  type TelemetryEvent,
  type TelemetryEventBody,
  type TelemetryLog,
} from "./schema";

/** Configuration of the explorer the events belong to (logged as a "context" event). */
export interface TelemetryContextConfig {
  model: string;
  dataset: string;
  undo: boolean;
  aids: boolean;
}

export interface SaveStatus {
  events: number;
  /** Last successful save to the study server. */
  savedAt: Date | null;
  /** Last save error (null when the last save succeeded or none was attempted). */
  error: string | null;
}

export interface RecorderOptions {
  sessionId?: string;
  /** Save endpoint; null disables server saving (default: `${BASE_URL}__telemetry/`). */
  endpoint?: string | null;
  /** Crash backup storage; null disables it (default: localStorage when available). */
  storage?: Storage | null;
  /** Clock in ms (default: performance.now). */
  now?: () => number;
  /** Autosave interval while there are unsaved events (default 10 s). */
  autosaveMs?: number;
  meta?: Record<string, unknown>;
}

const BACKUP_KEY = "telemetry:current";

interface Backup {
  sessionId: string;
  /** Where the log belongs (dev and study sessions are saved to different folders). */
  endpoint?: string;
  savedToServer: boolean;
  log: TelemetryLog;
}

/** Random session ID such as "S-7Q3KX9" (Crockford base32, no ambiguous letters). */
export function newSessionId(prefix = "S"): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (b) => alphabet[b % 32]).join("")}`;
}

const defaultStorage = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export class TelemetryRecorder {
  readonly sessionId: string;
  private header: SessionHeader;
  private events: TelemetryEvent[] = [];
  private readonly t0: number;
  private readonly clock: () => number;
  private readonly endpoint: string | null;
  private readonly storage: Storage | null;
  private readonly autosaveMs: number;

  private contextKey: string | null = null;
  private task: { spec: TaskSpec; startedAt: number } | null = null;
  /** Current selection, maintained from task pre-selections and selection diffs. */
  private selection = new Set<string>();

  private dirty = false;
  private saving: Promise<void> | null = null;
  private status: SaveStatus = { events: 0, savedAt: null, error: null };
  private listeners = new Set<() => void>();

  constructor(options: RecorderOptions = {}) {
    this.sessionId = options.sessionId ?? newSessionId();
    this.clock = options.now ?? (() => performance.now());
    this.t0 = this.clock();
    this.endpoint =
      options.endpoint === undefined ? `${import.meta.env.BASE_URL}__telemetry/` : options.endpoint;
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.autosaveMs = options.autosaveMs ?? 10_000;
    this.header = {
      schema: TELEMETRY_SCHEMA,
      sessionId: this.sessionId,
      startedAt: new Date().toISOString(),
      app: { commit: typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "unknown" },
      screen: {
        viewportWidth: typeof window === "undefined" ? 0 : window.innerWidth,
        viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
        devicePixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
      },
      meta: { ...options.meta },
    };
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  /** Milliseconds since the session started, at 0.1 ms resolution. */
  now(): number {
    return Math.round((this.clock() - this.t0) * 10) / 10;
  }

  record(event: TelemetryEventBody): void {
    this.events.push({ t: this.now(), ...event } as TelemetryEvent);
    if (event.type === "selection") {
      event.removed.forEach((id) => this.selection.delete(id));
      event.added.forEach((id) => this.selection.add(id));
    }
    this.dirty = true;
    this.status = { ...this.status, events: this.events.length };
    this.notify();
  }

  /**
   * Re-reads the viewport into the header. The study calls it at hand-over:
   * the page may have loaded before the browser went full screen (F11).
   */
  refreshScreen(): void {
    if (typeof window === "undefined") return;
    this.header = {
      ...this.header,
      screen: { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
    };
    this.dirty = true;
  }

  setMeta(patch: Record<string, unknown>): void {
    this.header = { ...this.header, meta: { ...this.header.meta, ...patch } };
    this.dirty = true;
  }

  /**
   * Called when the explorer (re)starts with a configuration and optional
   * task. Logs a "context" event and, for a task, a "taskStart". A task that
   * is still open is ended as "abandoned". Entering the same context again is
   * a no-op (React may run effects twice).
   */
  enterContext(
    config: TelemetryContextConfig,
    task?: TaskSpec,
    study?: { kind: "tutorial" | "task"; block: number },
  ): void {
    const key = JSON.stringify([config, task?.id ?? null]);
    if (key === this.contextKey) return;
    if (this.task) this.endTask("abandoned");
    this.contextKey = key;
    this.selection = new Set(task?.preselected ?? []);
    this.record({ type: "context", ...config, task: task?.id ?? null });
    if (task) {
      this.task = { spec: task, startedAt: this.now() };
      this.record({
        type: "taskStart",
        task: task.id,
        view: task.view ?? "tree",
        targets: [...(task.targets ?? [])],
        keep: [...(task.keep ?? [])],
        preselected: [...(task.preselected ?? [])],
        ...study,
      });
    }
  }

  /** Ends the open task (if any), scores the current selection, and saves. */
  endTask(reason: "done" | "skipped" | "abandoned" | "restarted") {
    const open = this.task;
    if (!open) return null;
    this.task = null;
    const score = evaluateTask(open.spec, this.selection);
    this.record({
      type: "taskEnd",
      task: open.spec.id,
      reason,
      duration: Math.round((this.now() - open.startedAt) * 10) / 10,
      selected: [...this.selection].sort(),
      score,
    });
    // A task that ends is a natural checkpoint: save immediately. After an
    // "abandoned" end the next context starts afresh, so it can be re-entered.
    if (reason !== "abandoned") this.contextKey = null;
    void this.save();
    return score;
  }

  get openTask(): string | null {
    return this.task?.spec.id ?? null;
  }

  /** The current selection as replayed from the events. */
  get selected(): ReadonlySet<string> {
    return this.selection;
  }

  get meta(): Readonly<Record<string, unknown>> {
    return this.header.meta;
  }

  toJSON(): TelemetryLog {
    return { ...this.header, events: [...this.events] };
  }

  // ---------------------------------------------------------------------------
  // Saving
  // ---------------------------------------------------------------------------

  getStatus(): SaveStatus {
    return this.status;
  }

  /** Subscribe to status changes (for a UI indicator). Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private writeBackup(savedToServer: boolean) {
    if (!this.storage) return;
    try {
      const backup: Backup = {
        sessionId: this.sessionId,
        endpoint: this.endpoint ?? undefined,
        savedToServer,
        log: this.toJSON(),
      };
      this.storage.setItem(BACKUP_KEY, JSON.stringify(backup));
    } catch {
      // Storage full or unavailable: the server copy and the download remain.
    }
  }

  /** Saves to the study server (if configured) and refreshes the crash backup. */
  save(): Promise<void> {
    if (this.saving) return this.saving.then(() => (this.dirty ? this.save() : undefined));
    this.dirty = false;
    const body = JSON.stringify(this.toJSON());
    this.saving = (async () => {
      let ok = false;
      if (this.endpoint) {
        try {
          const res = await fetch(`${this.endpoint}${this.sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: body.length < 60_000, // keepalive requests are size-limited
          });
          ok = res.ok;
          this.status = ok
            ? { ...this.status, savedAt: new Date(), error: null }
            : { ...this.status, error: `server answered ${res.status}` };
        } catch (e) {
          this.status = { ...this.status, error: e instanceof Error ? e.message : String(e) };
        }
      }
      if (!ok) this.dirty = true; // retry at the next autosave
      this.writeBackup(ok);
      this.notify();
    })().finally(() => {
      this.saving = null;
    });
    return this.saving;
  }

  /**
   * Starts autosaving (every autosaveMs while there are unsaved events, and
   * when the page is hidden or closed) and uploads a backup left over from a
   * previous session that never reached the server. Returns a detach function.
   */
  attach(): () => void {
    void this.recoverPreviousBackup();
    const timer = setInterval(() => {
      if (this.dirty) void this.save();
    }, this.autosaveMs);
    if (typeof document === "undefined" || typeof window === "undefined") {
      return () => clearInterval(timer); // not in a browser (tests)
    }
    const onHide = () => {
      if (document.visibilityState === "hidden" && this.dirty) this.beacon();
    };
    const onPageHide = () => this.beacon();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }

  /** Last-chance save while the page is being hidden or closed. */
  private beacon() {
    const body = JSON.stringify(this.toJSON());
    this.writeBackup(false);
    if (this.endpoint && typeof navigator !== "undefined" && navigator.sendBeacon) {
      if (navigator.sendBeacon(`${this.endpoint}${this.sessionId}`, body)) this.dirty = false;
    }
  }

  private async recoverPreviousBackup() {
    if (!this.storage || !this.endpoint) return;
    let backup: Backup | null = null;
    try {
      const raw = this.storage.getItem(BACKUP_KEY);
      backup = raw ? (JSON.parse(raw) as Backup) : null;
    } catch {
      return;
    }
    if (!backup || backup.savedToServer || backup.sessionId === this.sessionId) return;
    try {
      const res = await fetch(`${backup.endpoint ?? this.endpoint}${backup.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backup.log),
      });
      if (res.ok) this.storage.setItem(BACKUP_KEY, JSON.stringify({ ...backup, savedToServer: true }));
    } catch {
      // Keep the backup for the next attempt.
    }
  }

  /** Offers the log as a JSON file download (fallback when there is no study server). */
  download(): void {
    const blob = new Blob([JSON.stringify(this.toJSON(), null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** A recorder that records nothing (explorer used outside a session, tests). */
export const NO_TELEMETRY = new TelemetryRecorder({ endpoint: null, storage: null, sessionId: "none" });
NO_TELEMETRY.record = () => {};

/** Returns a function that calls `fn` at most once per `ms` (trailing calls dropped). */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number, now = () => performance.now()) {
  let last = -Infinity;
  return (...args: A) => {
    const t = now();
    if (t - last < ms) return;
    last = t;
    fn(...args);
  };
}
