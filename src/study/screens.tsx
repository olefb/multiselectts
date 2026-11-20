// File: study/screens.tsx
// Study screens without the explorer: setup (experimenter), language,
// consent, block intro, questionnaires, debrief.

import { useEffect, useState } from "react";
import { RecordingStatus } from "../components/RecordingStatus";
import { LANGS, type Lang } from "../data/tasks";
import type { TelemetryRecorder } from "../telemetry/recorder";
import { STUDY, configPlaceholders, type GroupId, type MainOs } from "./config";
import { GROUP_IDS, nextGroup, type SessionPlan } from "./protocol";
import { STUDY_TEXT, type StudyText } from "./text";
import { Card, Choice, Emphasis, Likert, PrimaryButton } from "./ui";

// ---------------------------------------------------------------------------
// Experimenter
// ---------------------------------------------------------------------------

type GroupCounts = { completed: Record<string, number>; sessions: number };

/** Experimenter screen: group assignment, checks, hand-over. English only. */
export function SetupScreen({
  recorder,
  initialGroup,
  initialPilot,
  datasetsReady,
  problems,
  onStart,
}: {
  recorder: TelemetryRecorder;
  initialGroup: GroupId | null;
  initialPilot: boolean;
  datasetsReady: boolean;
  /** Blocking problems (e.g. a missing dataset). */
  problems: string[];
  onStart: (group: GroupId, pilot: boolean) => void;
}) {
  const [counts, setCounts] = useState<GroupCounts | "error" | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}__study/groups`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<GroupCounts>) : Promise.reject(new Error(String(r.status)))))
      .then(
        (c) => !cancelled && setCounts(c),
        () => !cancelled && setCounts("error"),
      );
    return () => {
      cancelled = true;
    };
  }, []);
  const [override, setOverride] = useState<GroupId | null>(initialGroup);
  const [pilot, setPilot] = useState(initialPilot);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const suggested = counts && counts !== "error" ? nextGroup(counts.completed) : null;
  const group = override ?? suggested;
  const warnings = [
    ...configPlaceholders(STUDY).map((t) => `Placeholder in the study configuration (src/study/config.ts): ${t}`),
    ...(counts === "error"
      ? ["Study server not reachable: logs are not saved automatically and the group must be chosen by hand. Run npm run dev or npm run preview, or use Save JSON at the end."]
      : []),
    ...(viewport.width < STUDY.minViewport.width || viewport.height < STUDY.minViewport.height
      ? [`Browser viewport ${viewport.width}×${viewport.height} is smaller than ${STUDY.minViewport.width}×${STUDY.minViewport.height}: screens will scroll. Zoom out (Ctrl −).`]
      : Math.abs(viewport.width - STUDY.viewport.width) > STUDY.viewportSlack ||
          Math.abs(viewport.height - STUDY.viewport.height) > STUDY.viewportSlack
        ? [`Browser viewport is ${viewport.width}×${viewport.height}; the study setup is ${STUDY.viewport.width}×${STUDY.viewport.height}. Check full screen (F11) and the browser zoom (150 %), and keep them the same for every participant.`]
        : []),
    ...(recorder.toJSON().app.commit.endsWith("-dirty") || recorder.toJSON().app.commit === "unknown"
      ? [`Build ${recorder.toJSON().app.commit} has uncommitted changes: commit and tag the study build before real sessions.`]
      : []),
  ];

  return (
    <Card testId="study-setup">
      <h2 style={{ marginTop: 0 }}>Study setup</h2>
      <p style={{ margin: "4px 0 16px", color: "#555" }}>
        Protocol {STUDY.version} · participant <b data-testid="participant-id">{recorder.sessionId}</b>
      </p>

      <label style={{ display: "block", marginBottom: "8px" }}>
        Group:{" "}
        <select
          data-testid="group-select"
          value={group ?? ""}
          onChange={(e) => setOverride(e.target.value === "" ? null : (e.target.value as GroupId))}
        >
          {group === null && <option value="">choose…</option>}
          {GROUP_IDS.map((g) => (
            <option key={g} value={g}>
              {g}: {STUDY.groups[g].map((b) => `${b.system} + ${b.dataset}`).join(" → ")}
              {g === suggested ? " (next in rotation)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div data-testid="group-counts" style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>
        {counts === null
          ? "Loading completed sessions…"
          : counts === "error"
            ? "Completed sessions: unknown"
            : `Completed sessions: ${GROUP_IDS.map((g) => `${g} ${counts.completed[g] ?? 0}`).join(", ")} (${counts.sessions} logs in total)`}
      </div>
      <label style={{ display: "block", marginBottom: "16px" }}>
        <input type="checkbox" checked={pilot} onChange={(e) => setPilot(e.target.checked)} /> Pilot / test session
        (not counted for group rotation, excluded from analysis)
      </label>

      {[...problems, ...warnings].length > 0 && (
        <ul data-testid="setup-warnings" style={{ color: "#a15c00", fontSize: "14px", paddingLeft: "20px" }}>
          {problems.map((p) => (
            <li key={p} style={{ color: "#c62828" }}>
              {p}
            </li>
          ))}
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "16px" }}>
        <button onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}>Full screen</button>
        <PrimaryButton
          testId="hand-over"
          disabled={group === null || !datasetsReady || problems.length > 0}
          onClick={() => group && onStart(group, pilot)}
        >
          {datasetsReady ? "Hand over to participant →" : "Loading images…"}
        </PrimaryButton>
      </div>
      <p style={{ fontSize: "13px", marginTop: "20px" }}>
        <RecordingStatus recorder={recorder} />
      </p>
    </Card>
  );
}

/** After the session: status and a fresh start for the next participant (experimenter). */
function ExperimenterFooter({ recorder }: { recorder: TelemetryRecorder }) {
  const nextParticipant = () => {
    void recorder.save().finally(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("group"); // a group override is for one session only
      url.searchParams.delete("pilot");
      window.location.assign(url);
    });
  };
  return (
    <div style={{ marginTop: "40px", paddingTop: "12px", borderTop: "1px solid #ddd", fontSize: "13px", color: "#666" }}>
      <RecordingStatus recorder={recorder} />{" "}
      <button data-testid="next-participant" onClick={nextParticipant} style={{ marginLeft: "8px" }}>
        Next participant
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

export function LanguageScreen({ onChoose }: { onChoose: (lang: Lang) => void }) {
  return (
    <Card testId="language">
      <h2 style={{ marginTop: 0 }}>Choose language · Velg språk</h2>
      <div style={{ display: "flex", gap: "16px" }}>
        {LANGS.filter((l) => STUDY.languages.includes(l)).map((l) => (
          <PrimaryButton key={l} testId={`lang-${l}`} onClick={() => onChoose(l)}>
            {STUDY_TEXT[l].languageName}
          </PrimaryButton>
        ))}
      </div>
    </Card>
  );
}

export function ConsentScreen({
  text,
  lang,
  onContinue,
}: {
  text: StudyText;
  lang: Lang;
  onContinue: (os: MainOs, knowsExperimenter: boolean) => void;
}) {
  const t = text.consent;
  const [agreed, setAgreed] = useState(false);
  const [os, setOs] = useState<MainOs | null>(null);
  const [knows, setKnows] = useState<"yes" | "no" | null>(null);
  return (
    <Card testId="consent">
      <h2 style={{ marginTop: 0 }}>{t.title}</h2>
      <p>
        <Emphasis text={t.intro} />
      </p>
      <ul style={{ paddingLeft: "22px" }}>
        {t.points(STUDY.retention[lang], STUDY.contact).map((p) => (
          <li key={p} style={{ marginBottom: "6px" }}>
            <Emphasis text={p} />
          </li>
        ))}
      </ul>
      <label style={{ display: "block", margin: "16px 0 20px", fontWeight: 600, cursor: "pointer" }}>
        <input
          data-testid="consent-agree"
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginRight: "8px" }}
        />
        {t.agree}
      </label>
      <Choice
        id="os"
        question={t.osQuestion}
        options={(["windows", "macos", "linux", "other"] as const).map((o) => [o, t.os[o]] as const)}
        value={os}
        onChange={setOs}
      />
      <Choice
        id="knows"
        question={t.knowsQuestion}
        options={[
          ["yes", t.yes],
          ["no", t.no],
        ]}
        value={knows}
        onChange={setKnows}
      />
      <PrimaryButton
        testId="consent-continue"
        disabled={!agreed || os === null || knows === null}
        onClick={() => os && knows && onContinue(os, knows === "yes")}
      >
        {t.continue}
      </PrimaryButton>
    </Card>
  );
}

export function BlockIntroScreen({ text, label, first, onStart }: { text: StudyText; label: string; first: boolean; onStart: () => void }) {
  return (
    <Card testId="block-intro">
      <h2 style={{ marginTop: 0 }}>{text.system(label)}</h2>
      {(first ? text.blockIntro.first : text.blockIntro.second).map((p) => (
        <p key={p}>{p}</p>
      ))}
      <PrimaryButton testId="block-start" onClick={onStart}>
        {text.blockIntro.start}
      </PrimaryButton>
    </Card>
  );
}

export function BlockQuestionsScreen({
  text,
  label,
  onDone,
}: {
  text: StudyText;
  label: string;
  onDone: (answers: { sufficient: number; frustrating: number }) => void;
}) {
  const t = text.blockQuestions;
  const [sufficient, setSufficient] = useState<number | null>(null);
  const [frustrating, setFrustrating] = useState<number | null>(null);
  return (
    <Card testId="block-questions">
      <h2 style={{ marginTop: 0 }}>{t.title(label)}</h2>
      <Likert id="sufficient" question={t.sufficient} low={t.low} high={t.high} value={sufficient} onChange={setSufficient} />
      <Likert id="frustrating" question={t.frustrating} low={t.low} high={t.high} value={frustrating} onChange={setFrustrating} />
      <PrimaryButton
        testId="block-questions-continue"
        disabled={sufficient === null || frustrating === null}
        onClick={() => sufficient !== null && frustrating !== null && onDone({ sufficient, frustrating })}
      >
        {t.continue}
      </PrimaryButton>
    </Card>
  );
}

export type Preference = "A" | "B" | "none";
export type LostSelection = "no" | "A" | "B" | "both";

export function FinalScreen({
  text,
  onDone,
}: {
  text: StudyText;
  onDone: (answers: { preference: Preference; lostSelection: LostSelection; comment: string | null }) => void;
}) {
  const t = text.final;
  const [preference, setPreference] = useState<Preference | null>(null);
  const [lost, setLost] = useState<LostSelection | null>(null);
  const [comment, setComment] = useState("");
  return (
    <Card testId="final">
      <h2 style={{ marginTop: 0 }}>{t.title}</h2>
      <Choice
        id="preference"
        question={t.preference}
        options={[
          ["A", text.system("A")],
          ["B", text.system("B")],
          ["none", t.noPreference],
        ]}
        value={preference}
        onChange={setPreference}
      />
      <Choice
        id="lost"
        question={t.lost}
        options={[
          ["no", t.lostNo],
          ["A", t.lostIn("A")],
          ["B", t.lostIn("B")],
          ["both", t.lostBoth],
        ]}
        value={lost}
        onChange={setLost}
      />
      <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }} htmlFor="comment">
        {t.why}
      </label>
      <textarea
        id="comment"
        data-testid="comment"
        value={comment}
        maxLength={300}
        rows={2}
        onChange={(e) => setComment(e.target.value)}
        style={{ width: "100%", fontSize: "16px", padding: "6px", boxSizing: "border-box", marginBottom: "20px" }}
      />
      <PrimaryButton
        testId="final-finish"
        disabled={preference === null || lost === null}
        onClick={() =>
          preference && lost && onDone({ preference, lostSelection: lost, comment: comment.trim() === "" ? null : comment.trim() })
        }
      >
        {t.finish}
      </PrimaryButton>
    </Card>
  );
}

export function DebriefScreen({ text, plan, recorder }: { text: StudyText; plan: SessionPlan; recorder: TelemetryRecorder }) {
  const predicate = plan.blocks.find((b) => b.system === "predicate")!;
  const traditional = plan.blocks.find((b) => b.system === "traditional")!;
  return (
    <Card testId="debrief">
      <h2 style={{ marginTop: 0 }}>{text.debrief.title}</h2>
      {text.debrief
        .reveal(predicate.label, traditional.label, traditional.model === "mac" ? "mac" : "windows")
        .map((p) => (
          <p key={p}>{p}</p>
        ))}
      <p>
        <b>{text.debrief.tellExperimenter}</b>
      </p>
      <ExperimenterFooter recorder={recorder} />
    </Card>
  );
}

export function StoppedScreen({ text, recorder }: { text: StudyText; recorder: TelemetryRecorder }) {
  return (
    <Card testId="stopped">
      <h2 style={{ marginTop: 0 }}>{text.stop.title}</h2>
      <p>{text.stop.body}</p>
      <ExperimenterFooter recorder={recorder} />
    </Card>
  );
}

/** "Stop the study" link with an in-page confirmation (no browser dialogs). */
export function StopControl({ text, onStop }: { text: StudyText; onStop: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <div style={{ position: "fixed", right: "16px", bottom: "12px", fontSize: "14px", zIndex: 10 }}>
      {asking ? (
        <div
          data-testid="stop-confirm"
          style={{ background: "#fff", border: "1px solid #ccc", borderRadius: "8px", padding: "12px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.15)", maxWidth: "320px" }}
        >
          <p style={{ margin: "0 0 10px" }}>{text.stop.question}</p>
          <button data-testid="stop-yes" onClick={onStop} style={{ marginRight: "8px" }}>
            {text.stop.yes}
          </button>
          <button onClick={() => setAsking(false)}>{text.stop.no}</button>
        </div>
      ) : (
        <button
          data-testid="stop-study"
          onClick={() => setAsking(true)}
          style={{ background: "none", border: "none", color: "#888", textDecoration: "underline", cursor: "pointer" }}
        >
          {text.stop.link}
        </button>
      )}
    </div>
  );
}
