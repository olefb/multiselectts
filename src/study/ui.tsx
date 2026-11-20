// File: study/ui.tsx
// Small presentational building blocks of the study screens.

import { Fragment, type ReactNode } from "react";
import { useArmed } from "./uiHelpers";

/** **bold** spans (the only markup the study texts use). */
const boldSpans = (text: string) =>
  text.split("**").map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>));

/**
 * A participant text with **bold** spans. The number of a numbered step at the
 * start of a line ("2. …") is also bold (revision 20), so a second step stands
 * out: participants missed it. Line breaks stay in the text (shown with
 * white-space: pre-line by the caller).
 */
export function Emphasis({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const step = /^\d+\.(?=\s)/.exec(line)?.[0];
        return (
          <Fragment key={i}>
            {i > 0 && "\n"}
            {step && <b data-step-number>{step}</b>}
            {boldSpans(step ? line.slice(step.length) : line)}
          </Fragment>
        );
      })}
    </>
  );
}

export function Card({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      style={{
        maxWidth: "720px",
        margin: "40px auto",
        background: "#fff",
        padding: "28px 40px 32px",
        borderRadius: "10px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        fontSize: "17px",
        lineHeight: 1.5,
        textAlign: "left",
      }}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  const armed = useArmed();
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || !armed}
      style={{
        fontSize: "17px",
        padding: "10px 28px",
        borderRadius: "6px",
        border: "none",
        background: disabled ? "#b8c4d6" : "#1f6feb",
        color: "#fff",
        cursor: disabled || !armed ? "default" : "pointer",
        // While guarded: faded, not grey (it is not "unavailable", just not yet).
        opacity: !disabled && !armed ? 0.55 : 1,
        transition: "opacity 0.3s",
      }}
    >
      {children}
    </button>
  );
}

/** 7-point scale; the buttons are labelled 1-7, the ends with `low` / `high`. */
export function Likert({
  id,
  question,
  low,
  high,
  value,
  onChange,
}: {
  id: string;
  question: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const armed = useArmed();
  // The end labels sit right beside 1 and 7 (pilot 1: one participant read the
  // scale the wrong way round when they were small text under the ends).
  const endLabel = (text: string, align: "right" | "left") => (
    <span style={{ width: "96px", flex: "0 0 96px", textAlign: align, fontSize: "14px", fontWeight: 600, lineHeight: 1.25, color: "#333" }}>
      {text}
    </span>
  );
  return (
    <fieldset data-testid={`likert-${id}`} style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
      <legend style={{ fontWeight: 600, marginBottom: "10px" }}>{question}</legend>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {endLabel(low, "right")}
        <div style={{ display: "flex", gap: "8px" }}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              aria-pressed={value === n}
              disabled={!armed}
              onClick={() => onChange(n)}
              style={{
                width: "52px",
                height: "44px",
                fontSize: "17px",
                borderRadius: "6px",
                border: value === n ? "2px solid #1f6feb" : "1px solid #b0b7c3",
                background: value === n ? "#dbe9ff" : "#fff",
                color: "#1d1d1f",
                cursor: armed ? "pointer" : "default",
                opacity: armed ? 1 : 0.55,
                transition: "opacity 0.3s",
              }}
            >
              {n}
            </button>
          ))}
        </div>
        {endLabel(high, "left")}
      </div>
    </fieldset>
  );
}

/** Single choice as radio buttons. */
export function Choice<T extends string>({
  id,
  question,
  options,
  value,
  onChange,
}: {
  id: string;
  question: string;
  options: ReadonlyArray<readonly [T, string]>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset data-testid={`choice-${id}`} style={{ border: "none", padding: 0, margin: "0 0 20px" }}>
      <legend style={{ fontWeight: 600, marginBottom: "6px" }}>{question}</legend>
      {options.map(([v, label]) => (
        <label key={v} style={{ display: "block", padding: "3px 0", cursor: "pointer" }}>
          <input type="radio" name={id} checked={value === v} onChange={() => onChange(v)} style={{ marginRight: "8px" }} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

