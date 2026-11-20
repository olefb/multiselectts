#!/usr/bin/env node
// Generates the demo study datasets: self-drawn cat and dog pictures (SVG, no
// licensing concerns) under camera-style names, document folders shaped like
// the study tasks, and a Practice folder for the tutorial.
//
// Two datasets with the same structure and counts but different names and
// pictures: D1 = "pets-demo", D2 = "pets-demo-2" (counterbalancing, see
// docs/study-methodology.md §3.1). Placeholders until real photos are imported.
// Deterministic: same output on every run.
//
//   node scripts/make-demo-dataset.mjs
//
// Writes public/datasets/<id>/*.svg and src/data/datasets/<id>.json.
// Task and tutorial instructions are written in English (en) and Norwegian
// bokmål (nb); UI labels in them are quoted “like this” / «slik» and must match
// the study labels in src/study/text.ts (checked by a unit test). Words the
// participant types into the search box are **bold** (practice steps only).

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Random source of the dataset being generated. */
let rand = mulberry32(1);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
/** Runs f with another random source, leaving the dataset's own stream where it was. */
const withRand = (source, f) => {
  const saved = rand;
  rand = source;
  try {
    return f();
  } finally {
    rand = saved;
  }
};
const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// --- Drawings --------------------------------------------------------------

const BACKGROUNDS = ["#dcecf7", "#e8f3dc", "#f7ecdc", "#efe3f5", "#f5f0d6", "#dff3ef", "#f7dfe3"];
const CAT_COATS = [
  { fur: "#f0a04b", dark: false },
  { fur: "#9aa0a6", dark: false },
  { fur: "#3a3a3a", dark: true },
  { fur: "#ece6da", dark: false },
  { fur: "#c98f5a", dark: false },
];
const DOG_COATS = [
  { fur: "#b07845", ear: "#7a4f2a", snout: "#d9b48c" },
  { fur: "#e1b866", ear: "#b88a3a", snout: "#f3dfb0" },
  { fur: "#2e2e2e", ear: "#1c1c1c", snout: "#6b6b6b" },
  { fur: "#f2efe9", ear: "#c9b8a2", snout: "#ffffff" },
  { fur: "#8a6a4f", ear: "#5c4431", snout: "#c4a88c" },
];

/** Random framing, so the pictures are not identical copies. */
const pose = () => {
  const s = 0.85 + rand() * 0.25;
  const dx = (rand() - 0.5) * 30;
  const dy = (rand() - 0.5) * 12;
  const r = (rand() - 0.5) * 16;
  return `translate(${80 + dx} ${62 + dy}) rotate(${r.toFixed(1)}) scale(${s.toFixed(2)}) translate(-80 -62)`;
};

const svg = (bg, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">` +
  `<rect width="160" height="120" fill="${bg}"/>${body}</svg>\n`;

function cat() {
  const { fur, dark } = pick(CAT_COATS);
  const line = dark ? "#dddddd" : "#333333";
  const eye = pick(["#c8e06a", "#e8c547", "#7fc4e8"]);
  return svg(
    pick(BACKGROUNDS),
    `<g transform="${pose()}">` +
      `<polygon points="46,54 54,12 78,40" fill="${fur}"/><polygon points="114,54 106,12 82,40" fill="${fur}"/>` +
      `<polygon points="53,45 57,23 70,38" fill="#f4a6b8"/><polygon points="107,45 103,23 90,38" fill="#f4a6b8"/>` +
      `<ellipse cx="80" cy="68" rx="38" ry="34" fill="${fur}"/>` +
      `<ellipse cx="66" cy="62" rx="7" ry="8" fill="${eye}"/><ellipse cx="66" cy="62" rx="2" ry="7" fill="#222"/>` +
      `<ellipse cx="94" cy="62" rx="7" ry="8" fill="${eye}"/><ellipse cx="94" cy="62" rx="2" ry="7" fill="#222"/>` +
      `<polygon points="75,76 85,76 80,82" fill="#f08aa0"/>` +
      `<path d="M80 82 q-6 8 -12 3 M80 82 q6 8 12 3" stroke="${line}" stroke-width="1.5" fill="none"/>` +
      `<g stroke="${line}" stroke-width="1.2"><line x1="58" y1="78" x2="26" y2="71"/><line x1="58" y1="82" x2="26" y2="85"/>` +
      `<line x1="102" y1="78" x2="134" y2="71"/><line x1="102" y1="82" x2="134" y2="85"/></g>` +
      `</g>`,
  );
}

function dog() {
  const { fur, ear, snout } = pick(DOG_COATS);
  const spot = rand() < 0.4 ? `<ellipse cx="94" cy="50" rx="11" ry="9" fill="${ear}" opacity="0.8"/>` : "";
  return svg(
    pick(BACKGROUNDS),
    `<g transform="${pose()}">` +
      `<ellipse cx="44" cy="64" rx="14" ry="30" fill="${ear}" transform="rotate(18 44 64)"/>` +
      `<ellipse cx="116" cy="64" rx="14" ry="30" fill="${ear}" transform="rotate(-18 116 64)"/>` +
      `<ellipse cx="80" cy="60" rx="34" ry="36" fill="${fur}"/>${spot}` +
      `<ellipse cx="80" cy="82" rx="20" ry="15" fill="${snout}"/>` +
      `<circle cx="66" cy="54" r="5" fill="#222"/><circle cx="94" cy="54" r="5" fill="#222"/>` +
      `<circle cx="67.5" cy="52.5" r="1.5" fill="#fff"/><circle cx="95.5" cy="52.5" r="1.5" fill="#fff"/>` +
      `<ellipse cx="80" cy="76" rx="8" ry="6" fill="#222"/>` +
      `<path d="M73 88 q7 14 14 0 z" fill="#e8657a"/>` +
      `</g>`,
  );
}

// --- Dataset specifications ------------------------------------------------------

/**
 * Everything that differs between D1 and D2. Counts, folder structure and
 * task shapes are shared (generate() below), so the two are matched.
 */
const SPECS = [
  {
    id: "pets-demo",
    seed: 4801,
    firstImage: 4801,
    year: 2025,
    photos: "Photos",
    subfolder: "Summer 2025",
    documents: {
      folder: "Documents",
      /**
       * [name, size, month]; the first is the Task B target. Its distinctive word
       * ("budget") must not occur elsewhere, or "Select matching" would also
       * select an unrelated file (checked in src/study/__tests__/datasets.test.ts).
       */
      files: [
        ["budget_2025.xlsx", () => kb(20, 90), 1],
        ["meeting_notes.docx", () => kb(12, 60), 5],
        ["packing_list.txt", () => kb(1, 4), 6],
        ["travel_insurance.docx", () => mb(0.2, 1.2), 4], // not .pdf: predicate search is global (Task C)
      ],
    },
    research: {
      folder: "Research",
      topics: ["results", "method", "survey", "interviews", "analysis", "figures", "appendix", "literature"],
      readmes: ["readme.txt", "README_data.md"],
      others: ["responses.csv", "codebook.xlsx", "notes.txt", "plan.docx", "timeline.xlsx", "raw_data.csv",
        "transcript_01.docx", "transcript_02.docx", "consent_form.docx", "costs.xlsx", "ideas.txt", "outline.docx",
        "summary.txt", "references.bib"],
    },
    // Task D: a folder of lecture slides, named so the order is obvious (revision 18).
    // Its stem must not contain a word other tasks search for (checked by a unit test).
    lectures: { folder: "Lectures", stem: "lecture" },
    practice: {
      word: "report",
      others: ["agenda.docx", "contacts.xlsx", "letter.docx", "logo.png", "newsletter.docx", "notes_week1.txt",
        "poster.png", "price_list.xlsx", "schedule.xlsx", "slides.pptx", "todo.txt", "welcome.txt"],
      archive: ["invoice_0412.txt", "invoice_0415.txt", "old_logo.png", "old_report.docx", "scan_001.png", "signature.png"],
      searchTarget: "signature.png",
      listTarget: "scan_001.png",
    },
  },
  {
    id: "pets-demo-2",
    seed: 2307,
    firstImage: 2301,
    year: 2024,
    photos: "Pictures",
    subfolder: "Holiday 2024",
    documents: {
      folder: "Paperwork",
      files: [
        ["household_budget.xlsx", () => kb(20, 90), 1],
        ["lease_agreement.docx", () => kb(12, 60), 5],
        ["shopping_list.txt", () => kb(1, 4), 6],
        ["car_service.docx", () => mb(0.2, 1.2), 4],
      ],
    },
    research: {
      folder: "Coursework",
      topics: ["findings", "design", "questionnaire", "fieldwork", "statistics", "charts", "attachments", "sources"],
      readmes: ["readme_analysis.txt", "README.md"],
      others: ["answers.csv", "coding_scheme.xlsx", "memo.txt", "proposal.docx", "gantt.xlsx", "dataset.csv",
        "interview_01.docx", "interview_02.docx", "permission_form.docx", "expenses.xlsx", "thoughts.txt",
        "structure.docx", "abstract.txt", "bibliography.bib"],
    },
    lectures: { folder: "Seminars", stem: "seminar" },
    practice: {
      word: "minutes",
      others: ["banner.png", "bulletin.docx", "checklist.docx", "flyer.png", "hello.txt", "invitation.docx",
        "memo_board.txt", "phone_list.xlsx", "presentation.pptx", "rates.xlsx", "tasks.txt", "timetable.xlsx"],
      archive: ["old_banner.png", "old_minutes.docx", "receipt_0311.txt", "receipt_0318.txt", "scan_002.png", "stamp.png"],
      searchTarget: "stamp.png",
      listTarget: "scan_002.png",
    },
  },
];

// Study UI labels quoted in instructions (src/components/explorer/text.ts; a unit test checks them).
const LABEL = {
  list: { en: "List", nb: "Liste" },
  grid: { en: "Icons", nb: "Ikoner" },
  showSelectedOnly: { en: "Show selected only", nb: "Vis bare merkede" },
};

// --- Tree --------------------------------------------------------------------

const mb = (lo, hi) => `${(lo + rand() * (hi - lo)).toFixed(1)} MB`;
const kb = (lo, hi) => `${Math.floor(lo + rand() * (hi - lo))} KB`;
const date = (y, m) => `${y}-${String(m).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`;
const file = (name, size, modified, tags) => ({ name, size, modified, ...(tags ? { tags } : {}) });
const byName = (a, b) => a.name.localeCompare(b.name, "en", { numeric: true });
const path = (...parts) => parts.join("/");

function generate(spec) {
  const { id, year } = spec;
  const imgDir = join(ROOT, "public", "datasets", id);
  const jsonPath = join(ROOT, "src", "data", "datasets", `${id}.json`);
  rmSync(imgDir, { recursive: true, force: true });
  mkdirSync(imgDir, { recursive: true });
  mkdirSync(dirname(jsonPath), { recursive: true });
  rand = mulberry32(spec.seed);
  let imgNo = spec.firstImage;

  /**
   * `cats` cats and `dogs` dogs, in random order, as consecutive camera images.
   * `catsAsDogs`: each cat is replaced by a dog drawn from its own random source.
   * The cat is still drawn (and discarded), so the dataset's stream advances as
   * before and every later name, size, date and picture stays the same.
   */
  const photos = (cats, dogs, month, { catsAsDogs = false } = {}) => {
    const kinds = shuffle([...Array(cats).fill("cat"), ...Array(dogs).fill("dog")]);
    return kinds.map((kind) => {
      const n = imgNo++;
      const base = `IMG_${n}`;
      let picture = kind === "cat" ? cat() : dog();
      let tag = kind;
      if (catsAsDogs && kind === "cat") {
        picture = withRand(mulberry32(spec.seed * 100000 + n), dog);
        tag = "dog";
      }
      writeFileSync(join(imgDir, `${base}.svg`), picture);
      return {
        name: `${base}.jpg`,
        size: mb(1.6, 4.8),
        modified: date(year, month),
        thumbnail: `datasets/${id}/${base}.svg`,
        tags: [tag],
      };
    });
  };

  // Research: 14 PDFs (4 drafts), 2 readmes, 14 other files (Task C shape).
  const { topics, readmes, others } = spec.research;
  const research = [];
  for (let i = 0; i < 10; i++) research.push(file(`${topics[i % topics.length]}_${year - 1 + (i % 2)}_v${1 + (i % 3)}.pdf`, mb(0.3, 6), date(year, 1 + i), ["pdf"]));
  for (let i = 0; i < 4; i++) research.push(file(`${topics[i]}_draft_${i + 1}.pdf`, mb(0.2, 3), date(year, 3 + i), ["pdf", "draft"]));
  research.push(file(readmes[0], kb(1, 9), date(year, 2), ["readme"]));
  research.push(file(readmes[1], kb(2, 12), date(year, 2), ["readme"]));
  for (const name of others) research.push(file(name, kb(8, 900), date(year, 1 + Math.floor(rand() * 9))));

  // The subfolder holds only dogs (revision 17): Task B asks for "all the cats in
  // this folder", and a participant also selected the subfolder's cats. Drawn as
  // 4 cats + 8 dogs with the cats replaced, so nothing else in the dataset changes.
  const summer = photos(4, 8, 7, { catsAsDogs: true }).sort(byName);
  const main = photos(8, 16, 6).sort(byName);
  const documents = spec.documents.files.map(([name, size, month]) => file(name, size(), date(year, month))).sort(byName);
  research.sort(byName);

  // Practice folder for the tutorial (generated last, so it does not change the items above).
  const P = spec.practice;
  const reportNames = [
    ...["january", "february", "march", "april"].map((m) => `${P.word}_${m}.docx`),
    `${P.word}_march (copy).docx`,
    `${P.word}_april (copy).docx`,
  ];
  const practiceFiles = [...P.others, ...reportNames]
    .map((name) => file(name, kb(5, 400), date(year, 1 + Math.floor(rand() * 9))))
    .sort(byName);
  const archive = P.archive.map((name) => file(name, kb(20, 800), date(year - 1, 1 + Math.floor(rand() * 12)))).sort(byName);

  // Task D folder (added in revision 18; generated after everything else, so the items above are unchanged).
  const L = spec.lectures;
  const lectures = Array.from({ length: 16 }, (_, i) =>
    file(`${L.stem}_${String(i + 1).padStart(2, "0")}.pptx`, mb(0.8, 9), date(year, 1 + Math.floor(i / 2))),
  );

  const photosFolder = spec.photos;
  const sub = path(photosFolder, spec.subfolder);
  const docs = spec.documents.folder;
  const researchFolder = spec.research.folder;
  const practice = "Practice";
  const inPhotos = (p) => path(photosFolder, p.name);
  const inSub = (p) => path(sub, p.name);
  const inPractice = (f) => path(practice, f.name);
  const inLectures = (f) => path(spec.lectures.folder, f.name);
  const budget = spec.documents.files[0][0];
  // In list order, as the task names them.
  const readmeNames = research.filter((f) => f.tags?.includes("readme")).map((f) => f.name);

  // Tutorial steps (src/study/config.ts decides which steps run in which block).
  // Positions chosen so that every step fits the study viewport without scrolling.
  // Range, then deselect (one step since revision 8): a Shift-click range over eight
  // files, two of which (unflagged) are then deselected with Ctrl-click.
  const span = practiceFiles.slice(0, 8);
  const spanOut = [span[2], span[5]];
  const reports = practiceFiles.filter((f) => f.name.startsWith(`${P.word}_`));
  // Selected before "Select matching" / "Deselect matching" and kept through both (top of the list).
  const kept = practiceFiles.slice(0, 2);
  // "Show selected only": two selected files in view, two inside the closed Archive folder.
  const shownSelected = [practiceFiles[2], practiceFiles[9]];
  const [hiddenKeep, hiddenOut] = [archive[0], archive[2]];
  const inArchive = (f) => path(practice, "Archive", f.name);
  const tutorial = {
    "tutorial-warmup": {
      title: "Tutorial: select marked files",
      instructions: {
        en: "Select the three files with a flag:\n1. Click one of them.\n2. Hold Ctrl and click the other two.",
        nb: "Merk de tre filene med flagg:\n1. Klikk på én av dem.\n2. Hold nede Ctrl og klikk på de to andre.",
      },
      view: "tree",
      expanded: [practice],
      targets: [1, 6, 11].map((i) => inPractice(practiceFiles[i])),
    },
    "tutorial-range": {
      title: "Tutorial: select a range, then deselect",
      instructions: {
        // The flagged files, not their names (revision 26: the names confused participants).
        en:
          "Select the six files with a flag:\n" +
          "1. Click the first of them, then hold Shift and click the last.\n" +
          "2. Hold Ctrl and click each of the two files without a flag between them.",
        nb:
          "Merk de seks filene med flagg:\n" +
          "1. Klikk på den første av dem, hold så nede Shift og klikk på den siste.\n" +
          "2. Hold nede Ctrl og klikk på hver av de to filene uten flagg mellom dem.",
      },
      view: "tree",
      expanded: [practice],
      targets: span.filter((f) => !spanOut.includes(f)).map(inPractice),
    },
    "tutorial-search": {
      title: "Tutorial: search",
      instructions: {
        en:
          `Find ${P.searchTarget}, which is in a subfolder, and select it:\n` +
          `1. Type **${P.searchTarget.replace(/\..*$/, "")}** in the search box.\n2. Click ${P.searchTarget}.`,
        nb:
          `Finn ${P.searchTarget}, som ligger i en undermappe, og merk den:\n` +
          `1. Skriv **${P.searchTarget.replace(/\..*$/, "")}** i søkefeltet.\n2. Klikk på ${P.searchTarget}.`,
      },
      view: "tree",
      expanded: [practice],
      targets: [path(practice, "Archive", P.searchTarget)],
      markTargets: false,
      highlight: "searchBox",
    },
    "tutorial-list-view": {
      title: "Tutorial: list view",
      instructions: {
        en:
          `Select ${P.listTarget} in the Archive folder, using the list, which shows several folders at once:\n` +
          `1. Switch to the “${LABEL.list.en}” view.\n` +
          `2. Open the Archive folder with its arrow (▶) and click ${P.listTarget}.`,
        nb:
          `Merk ${P.listTarget} i mappen Archive ved hjelp av listen, som viser flere mapper samtidig:\n` +
          `1. Bytt til visningen «${LABEL.list.nb}».\n` +
          `2. Åpne mappen Archive med pilen (▶) og klikk på ${P.listTarget}.`,
      },
      view: "grid",
      folder: practice,
      expanded: [practice],
      targets: [path(practice, "Archive", P.listTarget)],
      requires: { view: "tree" },
      highlight: "listView",
    },
    "tutorial-select-matching": {
      title: "Tutorial: select and deselect matching",
      instructions: {
        en:
          `Two files are already selected. Also select all '${P.word}' files except the copies:\n` +
          `1. Choose “Select matching”, type **${P.word}** and press Enter.\n` +
          `2. Then choose “Deselect matching”, type **copy** and press Enter.`,
        nb:
          `To filer er allerede merket. Merk også alle '${P.word}'-filer unntatt kopiene:\n` +
          `1. Velg «Merk alle treff», skriv **${P.word}** og trykk Enter.\n` +
          `2. Velg så «Fjern merking av treff», skriv **copy** og trykk Enter.`,
      },
      // Pilot 1: a participant believed searching would clear his selection, so
      // this step starts with a selection and points out afterwards that it stayed.
      // One match is in the closed Archive folder: the hidden-matches note names it.
      doneNote: {
        en:
          "Note that the two files you had selected before are still selected: “Select matching” and " +
          "“Deselect matching” only add or remove the matching files. One match is in the closed Archive folder; " +
          "the note next to the search box named it.",
        nb:
          "Legg merke til at de to filene du hadde merket fra før, fortsatt er merket: «Merk alle treff» og " +
          "«Fjern merking av treff» legger bare til eller fjerner treffene. Ett treff ligger i den lukkede mappen " +
          "Archive; merknaden ved søkefeltet viste navnet.",
      },
      view: "tree",
      expanded: [practice],
      preselected: kept.map(inPractice),
      keep: kept.map(inPractice),
      targets: [
        ...reports.filter((f) => !f.name.includes("copy")).map(inPractice),
        ...archive.filter((f) => f.name.includes(P.word)).map(inArchive),
      ],
      markTargets: false,
      highlight: ["selectMatching", "deselectMatching"],
    },
    "tutorial-show-selected": {
      title: "Tutorial: show selected only",
      instructions: {
        en:
          `Deselect ${hiddenOut.name} in the closed Archive folder:\n` +
          `1. Turn on “${LABEL.showSelectedOnly.en}” to see all selected files.\n` +
          `2. Hold Ctrl and click ${hiddenOut.name}.`,
        nb:
          `Fjern merkingen fra ${hiddenOut.name} i den lukkede mappen Archive:\n` +
          `1. Slå på «${LABEL.showSelectedOnly.nb}» for å se alle merkede filer.\n` +
          `2. Hold nede Ctrl og klikk på ${hiddenOut.name}.`,
      },
      view: "tree",
      expanded: [practice],
      preselected: [...shownSelected.map(inPractice), inArchive(hiddenKeep), inArchive(hiddenOut)],
      targets: [...shownSelected.map(inPractice), inArchive(hiddenKeep)],
      markTargets: false,
      requires: { showSelectedOnly: true },
      highlight: "showSelectedOnly",
    },
  };

  // Study tasks on this tree (see src/data/tasks.ts and docs/study-methodology.md).
  const tasks = {
    ...tutorial,
    "keep-what-you-have": {
      title: "A: Keep what you have",
      // Numbered steps, one per line (pilot 1: participants missed parts of one-sentence tasks).
      instructions: {
        en: "1. Three of the flagged photos are already selected for the album: keep them selected.\n" +
          "2. Also select the other six flagged photos.",
        nb: "1. Tre av bildene med flagg er allerede merket for albumet: behold dem merket.\n" +
          "2. Merk i tillegg de seks andre bildene med flagg.",
      },
      view: "tree",
      expanded: [photosFolder, sub],
      // The last three subfolder photos, directly followed by the six targets:
      // a range or lasso over the targets easily overshoots into the pre-selected ones.
      preselected: summer.slice(-3).map(inSub),
      keep: summer.slice(-3).map(inSub),
      // As if the participant had selected the three photos with a click on the
      // first and a Shift-click on the last (or a drag down): anchor on the first,
      // active end on the last (revision 11). A Shift-click on a target then
      // extends the range in every system, as in Explorer and Finder.
      anchor: inSub(summer[summer.length - 3]),
      focus: inSub(summer[summer.length - 1]),
      // The list starts scrolled so the kept photos and all six targets are in view
      // (a participant missed the last three below the fold): the 6th subfolder
      // photo is the first row, leaving a few photos visible above and below.
      scrollTo: inSub(summer[summer.length - 7]),
      targets: main.slice(0, 6).map(inPhotos),
    },
    "context-switch": {
      title: "B: Context switch",
      // No hint about the views (revision 7): participants find their own way (search,
      // navigation or the list), as in a real file manager, in both systems.
      instructions: {
        en: `1. Select all the cats in this folder.\n2. Then also select ${budget} in the ${docs} folder.`,
        nb: `1. Merk alle kattene i denne mappen.\n2. Merk deretter også ${budget} i mappen ${docs}.`,
      },
      view: "grid",
      folder: photosFolder,
      targets: [...main.filter((p) => p.tags.includes("cat")).map(inPhotos), path(docs, budget)],
      markTargets: false,
    },
    "rule-with-exceptions": {
      title: "C: Rule with exceptions",
      // The rule names the word, and the readme files are named (pilot 1: "draft" and "readme" were unclear).
      instructions: {
        en:
          `1. In the ${researchFolder} folder, select all PDF files that do not have 'draft' in the name.\n` +
          `2. Also select the two readme files: ${readmeNames[0]} and ${readmeNames[1]}.`,
        nb:
          `1. I mappen ${researchFolder}: merk alle PDF-filene som ikke har 'draft' i navnet.\n` +
          `2. Merk også de to readme-filene: ${readmeNames[0]} og ${readmeNames[1]}.`,
      },
      view: "tree",
      expanded: [researchFolder],
      targets: research
        .filter((f) => (f.tags?.includes("pdf") && !f.tags.includes("draft")) || f.tags?.includes("readme"))
        .map((f) => path(researchFolder, f.name)),
      markTargets: false,
    },
    "keep-and-extend": {
      title: "D: Keep and extend",
      // Fragile selection (thesis defect #1), added in revision 18 as a separate task
      // after C, so Tasks A-C and earlier sessions stay unchanged. Two kept files with an
      // unflagged file between them (a non-contiguous selection), directly followed by
      // six flagged files. A Shift-click on the last of the six extends from the anchor
      // (the second kept file): the predicate and Finder-like systems add the range,
      // Explorer and the Windows-like preset replace the selection with it (the first
      // kept file is lost). Ctrl-clicks, Ctrl-drag and Ctrl+Shift-click keep it
      // everywhere (in Finder, ⌘+Shift-click toggles one file only; revision 24). The unflagged file rules out one range over everything (a click on
      // the first kept file and a Shift-click on the last target), which works the same
      // in every system (the Task A problem).
      instructions: {
        en: "1. Two of the flagged files are already selected for printing: keep them selected.\n" +
          "2. Also select the other six flagged files.",
        nb: "1. To av filene med flagg er allerede merket for utskrift: behold dem merket.\n" +
          "2. Merk i tillegg de seks andre filene med flagg.",
      },
      view: "tree",
      expanded: [L.folder],
      preselected: [lectures[2], lectures[4]].map(inLectures),
      keep: [lectures[2], lectures[4]].map(inLectures),
      // As after a click on the first kept file and a Ctrl-click on the second:
      // anchor and active end on the second (Explorer keeps the anchor at the last Ctrl-click).
      anchor: inLectures(lectures[4]),
      focus: inLectures(lectures[4]),
      // The folder row is the first row, so all its files are in view.
      scrollTo: L.folder,
      targets: lectures.slice(5, 11).map(inLectures),
    },
  };

  const dataset = {
    id,
    description:
      "Demo task folders: self-drawn cat/dog photos with camera-style names (tags: cat/dog), documents, " +
      "and a Practice folder for the tutorial. Generated by scripts/make-demo-dataset.mjs — edit the script, not this file.",
    tree: [
      { name: photosFolder, children: [{ name: spec.subfolder, children: summer }, ...main] },
      { name: docs, children: documents },
      { name: researchFolder, children: research },
      { name: practice, children: [{ name: "Archive", children: archive }, ...practiceFiles] },
      // Last, so the rows of Tasks A-C and the practice do not move (revision 18).
      { name: spec.lectures.folder, children: lectures },
    ],
    tasks,
  };

  writeFileSync(jsonPath, JSON.stringify(dataset, null, 2) + "\n");
  console.log(`${id}: ${imgNo - spec.firstImage} pictures in ${imgDir}, dataset ${jsonPath}`);
}

for (const spec of SPECS) generate(spec);
