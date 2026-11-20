// File: study/text.ts
//
// Participant-facing texts of study mode, in English and Norwegian bokmål.
// The experimenter's setup screen is English only. Task and tutorial
// instructions live in the dataset files; the explorer's own labels in
// components/explorer/text.ts.

import type { Lang } from "../data/tasks";
import type { MainOs } from "./config";

export interface StudyText {
  languageName: string;
  consent: {
    title: string;
    /** intro and points may mark **bold** spans. */
    intro: string;
    points: (retention: string, contact: string) => string[];
    agree: string;
    osQuestion: string;
    os: Record<MainOs, string>;
    knowsQuestion: string;
    yes: string;
    no: string;
    continue: string;
  };
  system: (label: string) => string;
  blockIntro: { first: string[]; second: string[]; start: string };
  practice: (i: number, n: number) => string;
  correct: string;
  next: string;
  skipPractice: string;
  /** Practice steps that start with a selection: back to the starting state. */
  restartStep: string;
  task: (i: number, n: number) => string;
  taskIntro: string;
  /** Task intro: what this system offers (the practised features; same wording in every task). */
  tools: (features: { predicate: boolean; aids: boolean }) => string;
  start: string;
  done: string;
  skipTask: string;
  seq: { question: string; low: string; high: string };
  blockQuestions: {
    title: (label: string) => string;
    sufficient: string;
    frustrating: string;
    low: string;
    high: string;
    continue: string;
  };
  final: {
    title: string;
    preference: string;
    noPreference: string;
    lost: string;
    lostNo: string;
    lostIn: (label: string) => string;
    lostBoth: string;
    why: string;
    finish: string;
  };
  debrief: {
    title: string;
    reveal: (newLabel: string, oldLabel: string, baseline: "windows" | "mac") => string[];
    tellExperimenter: string;
  };
  stop: { link: string; question: string; yes: string; no: string; title: string; body: string };
}

const EN: StudyText = {
  languageName: "English",
  consent: {
    title: "Selecting files",
    intro:
      "This study is part of a master's thesis at UiB and HVL. You will try two ways of " +
      "selecting files in a file manager, System A and System B, and answer a few short questions. " +
      "It takes **about 15 minutes**.", // pilot 1: 15–16 min from consent to the end; one more task since study-3
    points: (retention, contact) => [
      "You must be **16 or older**.",
      "Taking part is **voluntary**. You can **stop at any time** without giving a reason (“Stop the study” at the bottom of the screen).",
      "The study is **anonymous**: your name and anything else that identifies you are not recorded. There are no audio or video recordings and no screenshots.",
      `What is recorded: what you do with the mouse and keyboard in the file manager (clicks, drags, keys, searches) with timestamps, and your answers. The data are stored only on this computer and kept ${retention}.`,
      "Because the data are anonymous, **they cannot be deleted after the session**: nobody can tell which data are yours.",
      `Contact: ${contact}.`,
    ],
    agree: "I have read this and agree to take part.",
    osQuestion: "Which kind of computer do you use most?",
    os: { windows: "Windows", macos: "Mac (macOS)", linux: "Linux", other: "Other / don't know" },
    knowsQuestion: "Do you know the person running this study?",
    yes: "Yes",
    no: "No",
    continue: "Continue",
  },
  system: (label) => `System ${label}`,
  blockIntro: {
    first: [
      "First, a short practice with System A. Each practice step checks itself: once you have done it correctly, you can go on.",
      "Then come four tasks. Work as quickly and accurately as you can, and press Done when you have finished a task. Tasks are not checked.",
    ],
    second: [
      "Now you will use System B. It works a little differently.",
      "First a short practice, then the same kind of tasks with other files.",
    ],
    start: "Start",
  },
  practice: (i, n) => `Practice ${i} of ${n}`,
  correct: "✓ Correct!",
  next: "Next",
  skipPractice: "Skip this step",
  restartStep: "Start this step again",
  task: (i, n) => `Task ${i} of ${n}`,
  taskIntro: "The files appear when you press Start.",
  tools: ({ predicate, aids }) =>
    "Tools in this system: Ctrl-click, Shift-click, dragging · search · “List” / “Icons”" +
    (predicate ? " · “Select matching” · “Deselect matching”" : "") +
    (aids ? " · “Show selected only”" : ""),
  start: "Start",
  done: "Done",
  skipTask: "Skip this task",
  // The Single Ease Question (Sauro & Dumas 2009): 1 = very difficult, 7 = very easy.
  seq: { question: "Overall, how difficult or easy was this task?", low: "Very difficult", high: "Very easy" },
  blockQuestions: {
    title: (label) => `About System ${label}`,
    sufficient: "The selection method was sufficient for the tasks.",
    frustrating: "The selection method was frustrating to use.",
    low: "Strongly disagree",
    high: "Strongly agree",
    continue: "Continue",
  },
  final: {
    title: "Last questions",
    preference: "Which system did you prefer?",
    noPreference: "No preference",
    lost: "Did you lose a selection by accident?",
    lostNo: "No",
    lostIn: (label) => `Yes, in System ${label}`,
    lostBoth: "Yes, in both",
    why: "Why? (optional; please do not write your name or other personal information)",
    finish: "Finish",
  },
  debrief: {
    title: "Thank you for taking part!",
    reveal: (newLabel, oldLabel, baseline) => [
      `System ${newLabel} was the new selection method developed in this thesis. It keeps your selection when you search or open other folders, and it can select or deselect all files that match a word.`,
      `System ${oldLabel} worked like ${baseline === "mac" ? "the Finder on a Mac" : "File Explorer in Windows"}.`,
    ],
    tellExperimenter: "Please let the experimenter know that you are finished.",
  },
  stop: {
    link: "Stop the study",
    question: "Do you want to stop the study? What you have done so far is kept anonymously.",
    yes: "Yes, stop",
    no: "No, continue",
    title: "Thank you",
    body: "The study has been stopped. Please let the experimenter know.",
  },
};

const NB: StudyText = {
  languageName: "Norsk",
  consent: {
    title: "Merking av filer",
    intro:
      "Denne studien er en del av en masteroppgave ved UiB og HVL. Du skal prøve to måter å " +
      "merke filer på i en filbehandler, System A og System B, og svare på noen korte spørsmål. " +
      "Det tar **omtrent 15 minutter**.",
    points: (retention, contact) => [
      "Du må være **16 år eller eldre**.",
      "Det er **frivillig** å delta. Du kan **avbryte når som helst** uten å oppgi grunn («Avbryt studien» nederst på skjermen).",
      "Studien er **anonym**: navnet ditt og annet som kan identifisere deg, blir ikke registrert. Det blir ikke gjort lyd- eller videoopptak, og det tas ikke skjermbilder.",
      `Dette registreres: det du gjør med mus og tastatur i filbehandleren (klikk, dra, taster, søk) med tidspunkt, og svarene dine. Dataene lagres bare på denne datamaskinen og oppbevares ${retention}.`,
      "Fordi dataene er anonyme, **kan de ikke slettes etter økten**: ingen kan vite hvilke data som er dine.",
      `Kontakt: ${contact}.`,
    ],
    agree: "Jeg har lest dette og samtykker i å delta.",
    osQuestion: "Hva slags datamaskin bruker du mest?",
    os: { windows: "Windows", macos: "Mac (macOS)", linux: "Linux", other: "Annet / vet ikke" },
    knowsQuestion: "Kjenner du personen som gjennomfører studien?",
    yes: "Ja",
    no: "Nei",
    continue: "Fortsett",
  },
  system: (label) => `System ${label}`,
  blockIntro: {
    first: [
      "Først en kort øvelse med System A. Hvert øvingssteg sjekkes automatisk: når du har gjort det riktig, kan du gå videre.",
      "Deretter kommer fire oppgaver. Jobb så raskt og nøyaktig du kan, og trykk Ferdig når du er ferdig med en oppgave. Oppgavene blir ikke sjekket.",
    ],
    second: [
      "Nå skal du bruke System B. Det fungerer litt annerledes.",
      "Først en kort øvelse, deretter samme type oppgaver med andre filer.",
    ],
    start: "Start",
  },
  practice: (i, n) => `Øving ${i} av ${n}`,
  correct: "✓ Riktig!",
  next: "Neste",
  skipPractice: "Hopp over dette steget",
  restartStep: "Start steget på nytt",
  task: (i, n) => `Oppgave ${i} av ${n}`,
  taskIntro: "Filene vises når du trykker Start.",
  tools: ({ predicate, aids }) =>
    "Verktøy i dette systemet: Ctrl-klikk, Shift-klikk, dra · søk · «Liste» / «Ikoner»" +
    (predicate ? " · «Merk alle treff» · «Fjern merking av treff»" : "") +
    (aids ? " · «Vis bare merkede»" : ""),
  start: "Start",
  done: "Ferdig",
  skipTask: "Hopp over oppgaven",
  seq: { question: "Alt i alt, hvor vanskelig eller lett var denne oppgaven?", low: "Svært vanskelig", high: "Svært lett" },
  blockQuestions: {
    title: (label) => `Om System ${label}`,
    sufficient: "Merkemetoden var god nok for oppgavene.",
    frustrating: "Merkemetoden var frustrerende å bruke.",
    low: "Helt uenig",
    high: "Helt enig",
    continue: "Fortsett",
  },
  final: {
    title: "Siste spørsmål",
    preference: "Hvilket system likte du best?",
    noPreference: "Ingen forskjell",
    lost: "Mistet du en merking ved et uhell?",
    lostNo: "Nei",
    lostIn: (label) => `Ja, i System ${label}`,
    lostBoth: "Ja, i begge",
    why: "Hvorfor? (valgfritt; ikke skriv navnet ditt eller andre personopplysninger)",
    finish: "Fullfør",
  },
  debrief: {
    title: "Takk for at du deltok!",
    reveal: (newLabel, oldLabel, baseline) => [
      `System ${newLabel} var den nye merkemetoden som er utviklet i denne masteroppgaven. Den beholder merkingen når du søker eller åpner andre mapper, og den kan merke eller fjerne merkingen av alle filer som inneholder et ord.`,
      `System ${oldLabel} fungerte som ${baseline === "mac" ? "Finder på Mac" : "Filutforsker i Windows"}.`,
    ],
    tellExperimenter: "Si gjerne fra til den som gjennomfører studien at du er ferdig.",
  },
  stop: {
    link: "Avbryt studien",
    question: "Vil du avbryte studien? Det du har gjort så langt, lagres anonymt.",
    yes: "Ja, avbryt",
    no: "Nei, fortsett",
    title: "Takk",
    body: "Studien er avbrutt. Si gjerne fra til den som gjennomfører studien.",
  },
};

export const STUDY_TEXT: Record<Lang, StudyText> = { en: EN, nb: NB };
