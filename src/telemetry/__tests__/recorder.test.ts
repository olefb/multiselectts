/**
 * TelemetryRecorder: timestamps, context/task lifecycle and scoring, saving
 * (server, backup, failure and retry), and crash-backup recovery.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { TELEMETRY_SCHEMA, type TelemetryLog } from "../schema";
import { TelemetryRecorder, newSessionId, throttle } from "../recorder";
import type { TaskSpec } from "../../data/tasks";

/** In-memory Storage. */
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const TASK: TaskSpec = { id: "A", keep: ["k"], preselected: ["k"], targets: ["t1", "t2"] };
const CONFIG = { model: "algebraic", dataset: "d", undo: true, aids: true };

function make(opts: { fetch?: typeof fetch; storage?: Storage | null } = {}) {
  let clock = 1000;
  if (opts.fetch) vi.stubGlobal("fetch", opts.fetch);
  const rec = new TelemetryRecorder({
    sessionId: "S-TEST",
    endpoint: opts.fetch ? "/__telemetry/" : null,
    storage: opts.storage ?? null,
    now: () => clock,
  });
  return { rec, tick: (ms: number) => (clock += ms) };
}

const okFetch = () => vi.fn(async () => new Response(null, { status: 204 }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recording", () => {
  it("timestamps events relative to the session start", () => {
    const { rec, tick } = make();
    tick(12.34);
    rec.record({ type: "view", mode: "grid" });
    tick(5);
    rec.record({ type: "view", mode: "tree" });
    const log = rec.toJSON();
    expect(log.schema).toBe(TELEMETRY_SCHEMA);
    expect(log.sessionId).toBe("S-TEST");
    expect(log.events.map((e) => e.t)).toEqual([12.3, 17.3]);
  });

  it("logs context and task start once per context, and abandons an open task on switch", () => {
    const { rec } = make();
    rec.enterContext(CONFIG, TASK);
    rec.enterContext(CONFIG, TASK); // React may run the effect twice
    expect(rec.toJSON().events.map((e) => e.type)).toEqual(["context", "taskStart"]);
    rec.enterContext({ ...CONFIG, model: "windows" });
    const types = rec.toJSON().events.map((e) => e.type);
    expect(types).toEqual(["context", "taskStart", "taskEnd", "context"]);
    const end = rec.toJSON().events[2];
    expect(end.type === "taskEnd" && end.reason).toBe("abandoned");
  });

  it("tracks the selection from diffs and scores it at taskEnd", () => {
    const { rec, tick } = make();
    rec.enterContext(CONFIG, TASK);
    tick(1500);
    rec.record({ type: "selection", added: ["t1", "t2", "x"], removed: [], size: 4, undo: 1, redo: 0 });
    rec.record({ type: "selection", added: [], removed: ["x"], size: 3, undo: 2, redo: 0 });
    const score = rec.endTask("done");
    expect(score?.exact).toBe(true);
    const end = rec.toJSON().events.at(-1)!;
    expect(end).toMatchObject({ type: "taskEnd", task: "A", reason: "done", duration: 1500, selected: ["k", "t1", "t2"] });
    expect(rec.openTask).toBeNull();
  });

  it("reports lost keep items", () => {
    const { rec } = make();
    rec.enterContext(CONFIG, TASK);
    rec.record({ type: "selection", added: ["t1", "t2"], removed: ["k"], size: 2, undo: 1, redo: 0 });
    expect(rec.endTask("done")?.keepLost).toEqual(["k"]);
  });

  it("the same task can be started again after Done", () => {
    const { rec } = make();
    rec.enterContext(CONFIG, TASK);
    rec.endTask("done");
    rec.enterContext(CONFIG, TASK);
    expect(rec.openTask).toBe("A");
  });
});

describe("saving", () => {
  it("posts the log to the endpoint and backs it up", async () => {
    const fetchMock = okFetch();
    const storage = new MemoryStorage();
    const { rec } = make({ fetch: fetchMock, storage });
    rec.record({ type: "view", mode: "grid" });
    await rec.save();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/__telemetry/S-TEST");
    const body = JSON.parse(init.body as string) as TelemetryLog;
    expect(body.events).toHaveLength(1);
    expect(rec.getStatus()).toMatchObject({ events: 1, error: null });
    expect(rec.getStatus().savedAt).toBeInstanceOf(Date);
    const backup = JSON.parse(storage.getItem("telemetry:current")!);
    expect(backup).toMatchObject({ sessionId: "S-TEST", savedToServer: true });
  });

  it("reports a failed save and keeps the backup marked as unsaved", async () => {
    const storage = new MemoryStorage();
    const { rec } = make({ fetch: vi.fn(async () => new Response("no", { status: 500 })), storage });
    rec.record({ type: "view", mode: "grid" });
    await rec.save();
    expect(rec.getStatus().error).toMatch(/500/);
    expect(JSON.parse(storage.getItem("telemetry:current")!).savedToServer).toBe(false);
  });

  it("endTask saves immediately", async () => {
    const fetchMock = okFetch();
    const { rec } = make({ fetch: fetchMock });
    rec.enterContext(CONFIG, TASK);
    rec.endTask("done");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("uploads a previous session's unsaved backup on attach", async () => {
    const storage = new MemoryStorage();
    const old: TelemetryLog = { ...new TelemetryRecorder({ sessionId: "S-OLD", endpoint: null, storage: null }).toJSON() };
    storage.setItem("telemetry:current", JSON.stringify({ sessionId: "S-OLD", savedToServer: false, log: old }));
    const fetchMock = okFetch();
    const { rec } = make({ fetch: fetchMock, storage });
    const detach = rec.attach();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/__telemetry/S-OLD");
    await vi.waitFor(() => expect(JSON.parse(storage.getItem("telemetry:current")!).savedToServer).toBe(true));
    detach();
  });

  it("uploads a backup to the endpoint it came from (developer vs study folder)", async () => {
    const storage = new MemoryStorage();
    const old = new TelemetryRecorder({ sessionId: "S-DEV", endpoint: null, storage: null }).toJSON();
    storage.setItem(
      "telemetry:current",
      JSON.stringify({ sessionId: "S-DEV", endpoint: "/__telemetry/dev/", savedToServer: false, log: old }),
    );
    const fetchMock = okFetch();
    const { rec } = make({ fetch: fetchMock, storage });
    const detach = rec.attach();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/__telemetry/dev/S-DEV");
    detach();
  });

  it("records the study block and kind in taskStart", () => {
    const { rec } = make();
    rec.enterContext(CONFIG, TASK, { kind: "tutorial", block: 1 });
    expect(rec.toJSON().events[1]).toMatchObject({ type: "taskStart", task: "A", kind: "tutorial", block: 1 });
    expect([...rec.selected]).toEqual(["k"]);
  });
});

describe("helpers", () => {
  it("newSessionId has a readable, unambiguous format", () => {
    const id = newSessionId();
    expect(id).toMatch(/^S-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(newSessionId("P")).toMatch(/^P-/);
  });

  it("throttle drops calls within the interval", () => {
    let t = 0;
    const calls: number[] = [];
    const f = throttle((n: number) => calls.push(n), 50, () => t);
    f(1);
    t = 20;
    f(2);
    t = 60;
    f(3);
    expect(calls).toEqual([1, 3]);
  });
});
