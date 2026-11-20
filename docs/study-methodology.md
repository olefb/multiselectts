# User Study Methodology — Predicate-Based Multi-Selection

Revision 27, 2026-11-19 (revision 26: 2026-10-18; revision 25: 2026-10-16; revision 24: same day; revision 23: same day; revision 22: 2026-10-15; revision 21: same day; revision 20: 2026-10-14; revision 19: same day; revision 18: same day; revision 17: 2026-10-13; revision 16: same day; revision 15: 2026-10-12; revision 14: same day; revision 13: 2026-10-11; revision 12: 2026-10-09; revision 11: same day; revision 10: same day; revision 9: same day; revision 8: same day; revision 7: 2026-10-08; revision 6: same day; revision 5: 2026-10-07; revision 4: 2026-09-24). Based on the methodology slides discussed with
Jaakko Järvi, with Task 3 (undo/redo) removed as agreed. Revision 2 adapts the
plan to Jaakko's constraints: **at least 30 participants** and **about 10
minutes per session**, with participants recruited among family, friends and
passers-by (coffee/cookies as thanks). Items marked **[DECIDE]** were open;
all were settled in revision 5 (section 16).

---

## 0. What changed in revision 2 (summary)

| Topic | Revision 1 | Revision 2 |
|---|---|---|
| Session length | 40–45 min | **≈ 8–9 min typical, ≤ 12 min worst case** |
| Participants | N = 20 | **N = 32 (minimum 30)**, family/friends + passers-by |
| Practice | unlimited free play | **90-second guided mini-tutorial per system** (also yields the "simple selection" measurement) |
| Tasks per system | 6 (T1–T6) | **3 core tasks** (A–C); subtraction task optional |
| Time limits | 3–4 min per task | **75 s per task** |
| Questionnaires | SEQ + 4 items per system + 5 final questions | **SEQ + 2 items per system + preference (+ optional comment)** |
| Running the session | experimenter-led script | **self-guided on screen**; the experimenter only welcomes and hands over |
| New variable | — | recruitment source (knows the experimenter: yes/no) |

**Revision 3** (same day):

| Topic | Revision 2 | Revision 3 |
|---|---|---|
| Time limits | hard 75 s per task | **no visible timer; a "Skip task" button appears after 2 min** **[DECIDE]** |
| Stimuli | mock file names; blue flag markers | **realistic task folders**; photo tasks use pictures as their own targets ("select the cats, not the dogs"), camera-style names (`IMG_4821.jpg`) |

**Revision 4**: study mode implemented (`?study=1`, README "Study mode"),
with the recommended options as defaults in `src/study/config.ts`: OS-matched
baseline, aids in the predicate system only, soft skip after 2 min, English and
Norwegian texts. Tutorial step 3 uses Ctrl/⌘-click instead of Ctrl-drag
(section 8.2).

**Revision 5** (2026-10-07): Jaakko's comments on the study app, and the open
decisions of section 16 settled by Ole so the study can start (supervisors
informed by email; see section 16).

| Topic | Revision 4 | Revision 5 |
|---|---|---|
| Consent screen | plain list | key points in **bold** (18+, voluntary, stop any time, anonymous, cannot be deleted afterwards, about 10 minutes) |
| Task B instruction | no hint | hint, identical in both systems: switching from "Icons" to "List" may be needed to reach the other folder |
| Tutorial | 6 steps (predicate first) | **8 steps**: + "List view and folder arrows" (both systems), + "Show selected only" (blocks with the selection aids, i.e. the predicate system); a step passes only when the required control is used |
| Tutorial skip | "Skip the practice" after 60 s skips all remaining steps | **"Skip this step"** after 60 s on each step, so no participant skips the predicate steps |
| H0 bound | 90 s | **150 s** (longer tutorial) |
| Practice reset | none | **"Start this step again"** on practice steps that start with a selection (not the timed warm-up); logged as a `restarted` attempt plus a new one |
| Task intro | instruction only | adds the same reminder line per system: "In this system you can use: …" (the practised features), instead of task-specific hints |
| Ctrl/⌘ | "Ctrl or ⌘" in instructions | **"Ctrl"** only (the study laptop has no ⌘ key; Ctrl works in every model; Mac users are told at hand-over) |
| Mouse | all buttons active | **left button only** in study mode |
| Viewport | 1280×800 expected | **1365×853** (study laptop at 150 % zoom), 1280×800 minimum |
| Hidden matches | "Select/Deselect matching" changes files out of view silently (only the "(N not visible)" count) | **note next to the search box** naming the changed files that are not visible ("Selected, not visible: budget_2025.xlsx (Documents)"; one name; with more, the count first: "4 selected, not visible: …" since revision 10. Live while typing, kept after Enter until the next typing, mode change or press in the list. A selection aid: predicate system only. Practised in step 6 (one "report" file now sits in the closed Archive folder) |
| File icons | generic 📄 for every file | **file-type icons** (coloured label by extension: red PDF, blue DOC, green XLS, …; `src/components/explorer/fileTypes.ts`), as in real file managers; same in both systems. Without them, finding PDFs by eye (Task C, traditional) would be slower than in Explorer/Finder |
| Task B stimulus | `Research/budget.xlsx` (D1) and `Coursework/budget.xlsx` (D2) also matched "budget" | renamed to `costs.xlsx` / `expenses.xlsx`, so "Select matching budget" selects only the target (unit test). Task C's folder order changes slightly as a result |
| Stimuli | real photos planned | **keep the self-drawn cats and dogs** (section 16, decision 8) |
| Sorting, Task D | open | **not in this study** (limitation / future work) |

**Revision 6** (2026-10-08, after pilot 1; build version `study-2`).

Pilot 1: two passers-by on campus, both predicate first (G1, G2), both in
Norwegian, version `study-1`. What the logs and the observations showed:

- **No predicate features in the tasks.** Both participants used every
  practised feature during the tutorial (the steps require it) and then did
  all three predicate tasks with Ctrl-click only: no search, no "Select
  matching", no "Show selected only". One said afterwards he believed
  searching would clear his selection in that system too. One of them spent
  195 s on predicate Task C clicking file by file (86 s in traditional Task C,
  where he searched and lost the selection twice). In this state the study
  would compare Ctrl-click with Ctrl-click.
- **The practice never showed a selection surviving a search:** "Select
  matching" started from an empty selection.
- **Wording:** missed parts of one-sentence tasks (both readme files in
  Task C; three non-draft PDFs); "draft" and "readme" were unclear to a
  participant with Norwegian as the main language; the orange flag read as
  "remove this".
- **Length:** 15.5 and 16.5 min from consent to the end; the predicate
  tutorial alone 4.7 min (H0 bound: 150 s).
- **Setup:** one session ran without full screen (1360×785).

| Topic | Revision 5 | Revision 6 |
|---|---|---|
| Practice step 6 (Select matching; step 5 since revision 8) | starts with nothing selected | starts with **two selected files that must stay selected**; once solved, the instruction is replaced by a note that they are still selected ("“Select matching” adds to the selection") |
| Practice step 7 (Deselect matching; merged into step 5 since revision 8) | the matching files only | the same two files stay selected |
| Practice controls | instruction only | the control a step is about is **outlined** (pulsing yellow): search box, "List", "Select matching", "Deselect matching", "Show selected only" |
| Tools reminder | on the task intro screen | also **on the task screen, under the instructions, for the whole task**; shorter: "Tools in this system: Ctrl-click, Shift-click, dragging · search · “Select matching” · “Deselect matching” · “Show selected only”" (the views are no longer listed). Still one line per system, identical for all its tasks, no task-specific hints |
| Task instructions | one or two sentences | **numbered steps, one per line** |
| Task A | orange flags (keep) and blue flags (select) | **one flag colour**: "1. Three of the flagged photos are already selected for the album: keep them selected. 2. Also select the other six flagged photos." Same items and scoring (`keep` and `targets` in the data) |
| Task B | "… which is in another folder" with the hint in the same paragraph | "1. Select all the cats in this folder. 2. Then also select budget_2025.xlsx in the Documents folder." The hint follows on its own line, after step 2, so it does not suggest picking the cats in the list |
| Task C | "select all PDF files except the drafts, and also the two readme files" | "1. In Research, select all PDF files that do not have 'draft' in the name. 2. Also select the two readme files: README_data.md and readme.txt." File names unchanged |
| Session length on the consent screen | "about 10 minutes" | **"about 15 minutes"** (measured) |
| List height | 570 px | 570 px in the practice, **540 px in tasks** (room for the tools line and three instruction lines at 1280×800) |
| Version | `study-1` | **`study-2`**; the six `study-1` logs moved to `study-data/pilot-1/` (not counted for group rotation, not analysed) |

**Revision 7** (2026-10-08 evening, build version `study-2.1`), also from pilot 1:

| Topic | Revision 6 | Revision 7 |
|---|---|---|
| Ease question (SEQ) | "How easy or difficult was this task?", end labels small under 1 and 7 | the standard wording **"Overall, how difficult or easy was this task?"** («Alt i alt, hvor vanskelig eller lett var denne oppgaven?»), so the words run in the same direction as the scale; the end labels ("Very difficult", "Very easy"; "Strongly disagree", "Strongly agree") **beside 1 and 7**. A pilot participant answered the scale reversed (7 = very hard). Direction unchanged (1 = very difficult), as in the SEQ literature |
| Task B hint | "(Hint: … switch the view from “Icons” to “List”.)" in both systems | **removed** (Jaakko's revision 5 request, reversed after the pilot): participants reach the other folder their own way (search, navigation or the list) in both systems. More realistic, and it no longer steers traditional-system users to the one route that keeps their selection (see Task B) |
| Task C wording | "In Research, …" / «I Research: …» | **"In the Research folder, …" / «I mappen Research: …»** |
| Screen guard | — | the answer buttons (Start, Next, Done, the rating scales) are **inactive for 1.5 s** after they appear (faded, no countdown), so a quick double-click cannot skip a screen. `STUDY.screenGuardMs`; `&guard=0` turns it off for tests (logged as an override). Forced reading (countdowns, "I have read this" boxes) was rejected: impatient participants wait them out without reading, and the instructions stay visible during the task anyway |

`study-2.2` (wording only): practice step 5 says "Open the Archive folder" / «Åpne mappen Archive» instead of "Open Archive", like the tasks.

**Revision 8** (2026-10-09, build version `study-2.3`): a shorter practice,
because passers-by found 15 minutes long. One system per participant was
considered and rejected: it would save only the second block (about 4 of
15 minutes), lose the within-subject comparison and the preference question,
and need several times as many participants for the same power.

| Topic | Revision 7 | Revision 8 |
|---|---|---|
| Practice | 8 steps (predicate first) | **6 steps**: "Select a range" and "Deselect some files" merged (Shift-click a range of eight, then Ctrl-click the two without a flag); "Select matching" and "Deselect matching" merged ("all 'report' files except the copies", starting with two kept selected files) |
| Done note after the matching step | "Select matching" adds to the selection | both modes only add or remove the matching files; names the Archive match |
| Norwegian labels | «Merk treff» / «Avmerk treff» | «Merk alle treff» / «Fjern merking av treff» (and the matching placeholder and hidden-matches note) |

The merged matching step has the shape of Task C (select by one word,
remove by another) on different files and words. This strengthens the link
to Task C, which pilot 1 showed was missing, but H4 must then be read as
"after brief practice, participants apply predicate selection to a new
rule", not as discovery.

**Revision 9** (2026-10-09, build version `study-2.4`): **Task A starts with
the Shift-click anchor (and keyboard focus) on the last pre-selected photo**,
as if the participant had selected the three photos themselves. Before, there
was no anchor, so a first Shift-click selected only the clicked photo in every
system (and in the Windows-like one also dropped the pre-selection), which no
real file manager does after a user's own selection. Now a Shift-click on the
last target does what each system really does: Windows-like replaces the
selection with the range (two of the three pre-selected photos are lost, the
fragile-selection defect), Finder-like and the predicate system add the range.
The same start state applies to all systems. Expected effect: more pre-selection
losses in the Windows-like baseline, i.e. a possibly larger H2 difference;
report the anchor with the task.

**Revision 10** (2026-10-09, build version `study-2.5`): **bug fix in both
systems.** Edge auto-scroll started on the press itself, so a click held on
one of the last rows (the bottom 40 px of the list) scrolled the list and
stretched the selection over the rows below; seen in pilot 1. Auto-scroll now
starts only after the pointer has moved more than 4 px from the press, i.e.
in a real drag. Shared code, so it affected both systems equally; no task or
flag positions changed (Tasks B and C have no flags, so moving flags would not
have helped). Covered by an e2e test that reproduces the bug.
Also in `study-2.5`: the hidden-matches note puts the count first when it
names more than one file ("4 deselected, not visible: design_draft_2.pdf
(Coursework) …" / «4 fjernet fra merkingen, ikke synlig: …»); the trailing
"and 3 more" was cut off by the two-line note in Norwegian. And the words to
type in the practice (signature, report, copy) are in **bold**; the tasks have
no bold (Task C's 'draft' is part of the rule, not an instruction to search).

**Revision 11** (2026-10-09, build version `study-2.6`): **Task A's anchor
moves to the first pre-selected photo; the active end (keyboard focus) stays
on the last.** Revision 9 put both on the last photo, as after Ctrl-clicks on
each of the three; then a first Shift-click on the last target dropped the
other two in the Windows-like baseline. For three adjacent photos the more
natural way to have selected them is a click on the first and a Shift-click
on the last (or a drag down), which leaves exactly this state in Explorer.
A single Shift-click on the last target now keeps all nine photos selected
in every system. Task A still separates the systems where real Explorer
fails too: Ctrl-click a target then Shift-click (the anchor moves to the
target and Windows-like drops the three), a plain click, and drags that
overshoot into the kept photos. This is the conservative choice: a possible
H2 difference does not depend on the start state favouring one system.

**Revision 12** (2026-10-09, build version `study-2.7`): **bug fixes from a
code review, in both systems** (shared code; each is covered by a test that
reproduces the bug).

- *Select / Deselect matching*: Enter pressed within 150 ms of the last
  letter, i.e. before the live preview appeared, emptied the search box and
  selected nothing, although a `searchCommit` was logged. Fast typists hit
  this in practice step 5 ("type **report** and press Enter") and in Task C.
  Enter now applies the search at once. In `study-1` to `study-2.6` logs, a
  `searchCommit` without a selection change after it is a failed attempt,
  not a use of the feature.
- *Select All* (button and Ctrl+A) selected the whole dataset unless a filter
  was on: 100 items instead of the 25 in Task B's Photos folder. The
  traditional system has no "(N not visible)" indicator, so the extra items
  showed only in the total count. Select All now selects the visible items,
  as in Explorer (the open folder) and Finder (the shown rows), the same
  items as Ctrl+I.
- *Keyboard*: the first navigation key with no keyboard cursor selected the
  second item; it now selects the first (↑ and End: the last), as in Järvi &
  Parent (2016, §4.4.2); revision 13 changes this to what Explorer does. An arrow key in an empty grid (a
  filter with no matches) cleared the whole selection, hidden items
  included; it now does nothing, and Space only acts on an item. This
  mattered only in the predicate system, where a filter keeps the selection.

**Revision 13** (2026-10-11, build version `study-2.8`): **the Windows-like
preset checked against Explorer** on Windows 11, with the 23 tests of the
preset verification guide (screen recordings kept). 18 tests matched.
Changes:

- *Ctrl+Shift-click* (test S7): Explorer adds the range from the anchor, or
  removes it if the last Ctrl-click deselected (S7b). The preset treated it
  as a Shift-click, which replaces the selection. This mattered for H2: in
  Task A, a Ctrl-click on a target and a Ctrl+Shift-click on the last one
  kept the three photos in Explorer but lost them in the preset. New preset
  option `ctrlShiftClick`. The press is logged with modifier `ctrlShift`
  (earlier builds logged it as `shift`).
- *Shift + drag from empty space* (R5): Explorer adds a rectangle, and
  pulling it back restores the selection (R5b); the preset made a
  Shift-click range from the anchor. New option `shiftDragInSpace`. Only
  possible in the grid.
- *First navigation key with no cursor* (K1, both systems): Explorer steps
  from the first item (↓ selects the item below it, → the next one; ↑ and ←
  do nothing). Revision 12 had made the first key select the first item.
- *Screen guard off* (both systems): the 1.5 s delay on answer buttons
  (revision 7) turned out to be mostly annoying in sessions;
  `STUDY.screenGuardMs` is now 0 (`&guard=<s>` still turns it on).
- *Task A starts scrolled* (both systems): a participant (P-BEC0ZB, `study-2.7`)
  selected only the three targets in view and pressed Done; the last three
  were below the list's edge at the start. The list now opens with the sixth
  subfolder photo as the first row (`scrollTo` in the task), so the kept photos
  and all six targets are in view with a few photos above and below. A taller
  list was not possible within the 1280×800 minimum. Earlier sessions'
  "missing" errors in Task A partly reflect not scrolling; report by version.
- *Viewport in the log* (both systems): the log header stored the viewport
  at page load, which can predate full screen (F11); P-BEC0ZB's log says
  1360×785 although the laptop was in full screen and the setup screen (which
  checks live) showed no warning. The header now holds the viewport at
  hand-over, and changes during a session are logged (`viewport` events; the
  analysis lists them as issues). Pre-2.8 logs: treat `viewportWidth/Height` as
  unreliable.
- *Dragging mentioned again in practice step 2* (both systems, first
  block): "(you can also drag across them)" / «(du kan også dra over dem)»,
  dropped when the range and deselect steps were merged in revision 8.
  Participants then used clicks only in Task A, so the study says little about
  drags (defect #4). The remark names no modifier: practising Ctrl-drag would
  steer participants to the gesture where the predicate system differs.
- *Match note more visible and always shown* (predicate system): a tinted
  box with a border and bold text, 320 px wide, with a short amber flash when
  it appears and again on Enter (not on every keystroke). It now appears for
  every "Select / Deselect matching" and gives the number of files changed
  ("4 deselected", «4 fjernet fra merkingen»); it names the first changed file
  that is not on screen, which now also includes files scrolled out of view
  ("4 deselected, 2 not visible: findings_draft_1.pdf (Coursework) …").
  Before, it appeared only for files outside the list (closed folder, "Show
  selected only"), so deselecting drafts in the open Research folder showed
  nothing. The search row has a fixed height, so the note never moves the list.

Confirmed without change: pulling a Ctrl-drag back restores the earlier
selection in Explorer too (R4), so the retraction half of defect #4 does not
occur in current Explorer, unlike the description in Järvi & Parent (2016,
§2.5); a Ctrl-drag over selected files toggles them off while covered (R3);
search and folder navigation clear a multi-file selection (C1, C2). Going
Back (Alt+←) restores a single selected file but not several (C2; a note for
the thesis). Two shared behaviours stay as they are (section 15): a drag that
starts on a file selects a range (Explorer starts moving the file, R6), and a
press on a selected file collapses the selection on the press, not on release
(E1). The Finder-like preset is not yet checked; its new options keep the
earlier behaviour.

**Revision 14** (2026-10-12, build version `study-2.9`): **practice steps as
a goal plus numbered steps**, like the tasks since revision 6. Each practice
instruction is now one line saying what the selection should be, then "1. …"
and "2. …" with the actions, e.g. «To filer er allerede merket. Merk i
tillegg alle 'minutes'-filer unntatt kopiene: 1. Velg «Merk alle treff»,
skriv **minutes** og trykk Enter. 2. Velg så «Fjern merking av treff», skriv
**copy** og trykk Enter.» Same content and targets; the warm-up now says
"click one of them, then hold Ctrl and click the other two". Every practice
bar is three lines at 1280×800 and 1365×853 in both languages and datasets
(measured); a unit test checks the format. The new Norwegian texts need the
native-speaker read.

**Revision 15** (2026-10-12, build version `study-2.10`): **a note when a
search hides selected files** (predicate system only, a selection aid like
"Show selected only"). While a search hides selected files, the note next to
the search box says so: «8 merkede filer er skjult av søket, men fortsatt
merket.» / "8 selected files are hidden by the search but still selected."
Before, only the small grey "(8 not visible)" after the selection count said
this, and in pilot 1 a participant assumed searching had cleared his
selection. The note says that the files are still selected, not how to keep
them (no hint to use Ctrl-click). It makes H3 partly a test of this feedback,
which belongs to the system as a whole (section 1). Also: three practice
lines shortened (range: the "(or drag across them)" alternative dropped;
matching: «Merk også» for «Merk i tillegg»; show selected: shorter goal
line), because at 1280×800 in Norwegian they wrapped to a fourth line once
"Skip this step" appeared after 60 s. Every practice step now fits 1280×800
and 1365×853 with that button showing (measured, both languages and datasets).

**Revision 16** (2026-10-13, build version `study-2.11`): **Shift-click after
a click in blank space** (predicate system, list view). A click in the blank
space below the rows made that point the range anchor, and the list cannot
form a range from a point that is no row, so every Shift-click or Shift-drag
after it selected nothing until the next click on an item. In one counted
session this happened 9 times in Task C. Now a Shift-press from such
a dead anchor extends from the last item clicked, as in Explorer and the
Windows-like baseline, which keep the range anchor when blank space is
clicked (the clicked item alone if that item is hidden). Drags, the grid
(where a blank anchor spans a rectangle) and the baselines are unchanged.
Also in the analysis (no protocol change): lost items and accidental clears
now count a predicate search by its net effect. Before, every keystroke of
the live preview counted, so typing "draft" in «Fjern merking av treff»
counted the targets deselected at "d" and selected again at "dr" as losses
and accidental clears (12 per Task C attempt in two of the counted sessions).

**Revision 17** (2026-10-13, build version `study-2.12`): two changes after a
counted session in which a participant lost his Task B selection twice in the
predicate system and selected the subfolder's cats in the traditional one.
- **The photo subfolders hold only dogs** (`Summer 2025` in D1, `Holiday 2024`
  in D2; both datasets, to keep them matched). Task B asks for "all the cats
  in this folder", and the participant also selected the four cats in the
  subfolder, in both systems. The subfolder stays: Task A is built on it (its
  last three photos are the kept ones). The four cats in each subfolder are
  replaced by dogs drawn from a separate random source, so every other name,
  size, date, picture and every task target is unchanged (checked against the
  previous build). The correct answer of every task is the same as before, so
  earlier sessions keep their scores.
- **A slow double-click keeps the selection** (predicate system). Opening a
  folder by clicking it once, pausing, then double-clicking it left the
  selection cleared: the single click selected the folder and cleared
  everything else, and only the double-click's own click was retracted. Now a
  double-click on a folder also retracts the plain clicks on that folder just
  before it, as long as no other gesture came in between (the engine never
  retracts more than its current run of plain clicks). This is a safety net,
  not part of the algebra; it matters because undo is off in the study. The
  Windows-like baseline clears the selection on navigation anyway, so it
  looks the same there. Navigation keys no longer belong to a run of clicks
  in the algebraic engine either, as in the baselines.
- **Analysis** (no protocol change): the clicks a double-click retracts are no
  longer counted as a loss and a re-selection. Each double-click on a folder
  first cleared the selection with its first click and then restored it, and
  the extraction counted both. Plain clicks on one item followed by a
  double-click on it now count once, by their net effect (like a predicate
  search, revision 16). In the four counted sessions this lowers the loss
  count of three Task B attempts; accidental clears are unchanged there,
  because those participants also re-selected after real losses.

**Revision 18** (2026-10-14, build version `study-3`): **Task A is the
baseline task, and a new Task D tests fragile selection.** Made after five
counted sessions (`study-2.7` to `study-2.12`).

- *Hypotheses*. H2 was pre-registered as directional ("fewer lost
  pre-selections and lower time"), but Ole and Jaakko had agreed earlier that
  the first task is a baseline task that should show no difference between
  the systems. In the sessions so far, participants solved Task A with
  Ctrl-clicks or with one Shift-click from the start anchor, which behave the
  same in every system, and nobody Ctrl-dragged, so defect #4 was not
  exercised (and current Explorer restores a pulled-back Ctrl-drag, revision
  13). H2 now expects **no difference** and is tested two-sided, like H1;
  RQ2 and H6 move to the new Task D. This change was made after data
  collection began and is reported as such; the old H2 is kept in this note.
  None of the earlier sessions' Task A data change.
- *Task D, "Keep and extend"* (section 9), **after Task C** in both blocks,
  so the practice and Tasks A–C run exactly as before and the earlier
  sessions count in full for them. Two kept files with an unflagged file
  between them (a non-contiguous selection), directly followed by six flagged
  files. The natural move is a Shift-click on the last of the six, extending
  from the second kept file: the predicate and Finder-like systems add the
  range, while Explorer and the Windows-like preset replace the selection
  with it and drop the first kept file (thesis defect #1, fragile selection;
  checked in Explorer, revision 13). Ctrl-clicks, Ctrl-drag and
  Ctrl+Shift-click keep the selection everywhere, and the start state is the
  one Explorer leaves after a click and a Ctrl-click (anchor on the second
  kept file), so the task is fair to the baseline. The contrast with Task A
  is the shape of the existing selection: contiguous there (a range from it
  is harmless), non-contiguous here. New hypothesis **H6**.
  A first version of the same day had the middle file flagged and two
  unflagged files between the second kept file and the six; it was changed
  before any session because its shortest route (Ctrl-clicks only) is safe in
  every system. The middle file is unflagged so that no single range solves
  the task (a click on the first kept file and a Shift-click on the last
  target would then work everywhere, as in Task A).
- *The Task D folder* (`Lectures` in D1, `Seminars` in D2; 16 slide files)
  is the last root folder, generated after everything else: every earlier
  item, picture, task and target is unchanged (checked against the previous
  build). The only visible difference in Tasks A–C is one more collapsed
  folder row at the bottom of the root (Select All in the list view also
  selects that row, as it selects the other root folders). Its names contain
  no word another task searches for (unit test).
- *Session texts*: "four tasks" / «fire oppgaver»; the consent screen says
  "about 15 minutes" again (was 12–15).
- *Analysis*: Holm correction runs across Tasks B, C and D (the directional
  tasks); Task A is two-sided and uncorrected. Lost pre-selections are
  reported for Tasks A and D, with Task D also per traditional preset. Task D
  is analysed on `study-3` sessions only; the block questions, the
  preference and the "lost a selection" question come after one more task
  from `study-3` on, so report them per version as well (section 14).

**Revision 19** (2026-10-14, build version `study-3.1`, after ten counted
sessions): **the file list has a permanent scrollbar** (both systems).
Participants missed files below the list's edge because they did not see that
it scrolled: on the study laptop the browser (Helium, Chromium-based) shows
thin overlay scrollbars only while scrolling. In the logs, two Task C
attempts (both in the predicate system, both in the first block, neither
using the matching features) missed files below the edge without scrolling
once, and one Task A attempt on `study-2.7` (the case fixed with `scrollTo` in
revision 13). The list now always shows a 14 px track and thumb
(`.explorer-viewport` in `src/index.css`; a styled scrollbar is never an
overlay), the same in every system, task and view. The grid keeps its seven
columns (the list is at most 960 px wide, and 7 × 120 px still fits). No
instruction mentions scrolling. Report Task C errors with and without the
attempts that missed only files below the edge without scrolling, and the
version as a sensitivity check.

**Revision 20** (2026-10-14, build version `study-3.2`): **step numbers in
bold** (both systems). Some participants missed the second step of a task
(e.g. the readme files in Task C). Ole had reminded some of them verbally to
read the whole task, but not all, and not consistently; that is an
experimenter intervention during the tasks, which section 8.3 and the runbook
rule out, and it reached participants unevenly. From now on there are no
verbal reminders. The participants and tasks that got one (as far as Ole
remembers them; P-IDs only) are listed in the observation notes, and their
attempts are left out in a sensitivity analysis. In the app, the number at
the start of each numbered line ("1.", "2.") is now bold, in tasks and
practice steps alike (`Emphasis` in `src/study/ui.tsx`; the dataset texts are
unchanged, and tasks still have no other bold). A confirmation on Done that
repeats the steps was considered and rejected as too intrusive. Measured at
1280×800 with "Skip this step" showing: no instruction gets an extra line in
either language or dataset. Report error rates per version (`study-3.2` on vs
earlier).

**Revision 21** (2026-10-15, build version `study-3.3`): **a press on the
scrollbar no longer changes the selection** (both systems). The permanent
scrollbar of revision 19 belongs to the list element itself, so a press on it
reached the list's press handler and acted as a plain click in blank space or
on the row level with it: the selection was cleared and replaced. Presses
outside the list's client area are now ignored by the selection (the browser
still scrolls). No counted session was affected: the only logs on
`study-3.1`/`study-3.2` contain no presses. e2e test: clicks and a drag on the
scrollbar keep a two-file selection (it fails without the fix).

**Revision 22** (2026-10-15, build version `study-3.4`, after 17 counted
sessions; both systems):

- **A drag from the blank space below the rows selects** the rows it crosses
  (list view). Two Mac participants (P-PQSDBW, P-T59Y91; two attempts each,
  all in Task C after searching "pdf") pressed below the short filtered list
  and dragged up over the files; nothing was selected, in either system,
  because the drag's anchor was no row. Explorer and Finder select the rows a
  rubber band from empty space crosses. Now such a drag starts at the last
  row (`HierarchicalTreeGeometry.extendPath`). A click there still clears the
  selection, and a Shift-click after it still extends from the last item
  clicked (revision 16). The grid was not affected.
- **Leaving the page asks first** while a session runs (hand-over to
  debrief): reload, Back, closing the tab. P-PQSDBW's page went away in the
  second block's Task C; the log cannot show how (it records no browser
  navigation), and a two-finger touchpad swipe, which Chromium treats as Back,
  is the likeliest cause for a Mac user. Touchpad swipe navigation is now off
  in the page (`overscroll-behavior-x: none`), and the browser's own "Leave
  site?" prompt appears on any other attempt; each attempt is logged as a
  `note` event ("leave-page prompt"). P-PQSDBW's session counts with the
  pairs it finished (Tasks A and B in both systems), as planned for
  incomplete sessions.

**Revision 23** (2026-10-16, build version `study-3.5`, after 19 counted
sessions; **predicate system only**): **the match note says to press Enter
while a "Select / Deselect matching" preview is live**: "14 selected – press
Enter to keep" / «14 merket – trykk Enter for å beholde». After Enter (or
Apply) the note shows what it showed before, including the first changed file
that is not on screen; the file names are left out while the preview is live
because the note is two lines high (measured: every live note fits, in both
languages, with the longest file names of both datasets).

*Evidence.* In the counted predicate-system task attempts so far, a typed
"Select / Deselect matching" query was applied with Enter or Apply 25 times
and left unapplied 23 times. Most unapplied ones did no harm (a click or Done
keeps the preview, and emptied queries were mostly retyping). The harmful
pattern, in four participants' Task C (P-C3K625, P-V8RZYF, P-ZY5N83,
P-53ZZEE): "pdf" typed in plain search, then "Select matching" chosen, which
previews the 14 PDFs; then, without Enter, either "draft" typed in the same
box (replacing the "pdf" preview) or "Deselect matching" chosen (turning the
"pdf" preview into a deselection). Participants treated the first search as
done and expected the next to build on it; the live preview did not show
that it was provisional. Switching modes was *not* made to apply the
preview: in two of the same attempts, switching corrected a query typed in
the wrong mode.

*Fairness.* This changes the predicate system only, after data collection
began, and it may improve Task C, whose hypothesis (H4) is not supported so
far. Like revision 15 (the hidden-by-search note), it is feedback that
belongs to the system as a whole and says what the system needs, not how to
solve a task. Task C is reported pooled and split at `study-3.5`, and H4 is
not judged on the later sessions alone.

**Revision 24** (2026-10-16, build version `study-3.6`; **Finder-like
baseline only**): **the Finder-like preset checked against Finder** (macOS,
icon and list view, screen recordings kept), with the twelve tests that
followed the Explorer check. Changes:

- *Shift-click in the grid* (tests 1, 10): Finder's icon view toggles the
  clicked item, like a ⌘-click; the preset made a range. In list view Finder
  adds the range, as before (test 2). New preset option `shiftClickInGrid`
  ("toggle"); a toggle moves the anchor as a ⌘-click does (assumed, not yet
  checked). Shift+arrow keys still extend a range in both views (shared
  keyboard).
- *⌘-drag* (test 4): toggles, as in Explorer, and pulling the rectangle back
  restores the selection; the preset only added (`modifierDrag: "toggle"`).
- *⌘+Shift-click* (test 5, list view): the same as a ⌘-click; the preset
  treated it as a Shift-click (new value `ctrlShiftClick: "toggle"`).
  Icon view not yet checked; assumed the same.
- *Shift + drag from empty space* (test 6): adds a rectangle, as in Explorer;
  the preset made a range (`shiftDragInSpace: "add"`).

Confirmed without change: ⌘-click then Shift-click keeps the selection and
moves the anchor (test 3); folder navigation clears the selection, also on
going Back (test 7); a list ↔ grid switch keeps it (test 8); opening a
subfolder's disclosure triangle in list view keeps it and ⌘-click adds to it
(test 9). Not adopted: the first arrow key with nothing selected behaves
inconsistently in Finder (test 11), so the shared keyboard behaviour stays;
dragging from a file moves it in icon view, and in list view an unselected
file must be selected first (test 12), which joins the Explorer note on
drags from a file in section 15.

*Effect on the tasks.* Task A (list view): a ⌘-drag that overshoots now
deselects kept photos in the Finder-like system too, and a ⌘-click plus
⌘+Shift-click selects only the two clicked photos. Task B (grid): a
Shift-click on a cat toggles it, which Mac users expect. Task D (list
view): the Shift-click routes are unchanged (the range is added), and a
⌘-click on T1 plus ⌘+Shift-click on T6 loses nothing but leaves T2–T5
unselected. Practice step 2 runs in the list, where Shift-click still adds a
range. The predicate and Windows-like systems are unchanged.

*Versions.* Sessions of Mac participants before `study-3.6` used the
unchecked preset. Report the Finder-like results split at `study-3.6`, or
leave the earlier Mac sessions out of the per-preset analysis (section 14).

**Revision 25** (2026-10-16, build version `study-3.7`; **all systems**):
**Ctrl+Space works in Helium.** Chromium on Linux reports Ctrl+Space as key
"Unidentified" (code "Space"), so in Helium, the session browser, Ctrl+Space
(toggle the item at the keyboard cursor) did nothing in any system; Firefox
was not affected. The key is now taken from the physical key when the
browser reports none (`eventKey` in `useKeyboardSelection.ts`). Before
`study-3.7`, such presses were neither acted on nor logged. The effect was the
same in every condition, so no task comparison is affected.

**Revision 27** (2026-11-19, after data collection; **no code change**):
**the last Finder checks, and pulled-back ranges in both baselines.**

- The two icon-view details left open in revision 24 behave as assumed: a
  Shift-click toggle moves the anchor as a ⌘-click does, and ⌘+Shift-click in
  icon view is a ⌘-click.
- *Finder test 13* (list view): click file_08, ⌘-click file_03, Shift-click
  file_10, then Shift-click file_06. Finder deselects file_08, which was
  selected before the range (13a); Shift+arrow keys do the same (13b). The
  Shift-click half of overreaching ranges (Järvi & Parent 2016, p. 14:4)
  therefore still occurs in Finder; the drag half does not (revision 24, test 4).
- *Finder test 14*: with file_08 selected first, a ⌘-drag in icon view (14a),
  a Shift-drag from empty space (14b) and a ⌘-drag in list view (14c) were
  extended over file_08 and pulled back; Finder kept file_08 selected each
  time. The presets behave the same (the drag combines with the selection at
  the press), so no difference here.
- *Explorer*: a Shift-click range can be shrunk with another Shift-click,
  but a Shift-click replaces the whole selection, so files selected before it
  are lost anyway. A Ctrl+Shift-click range keeps the earlier selection but
  only adds: pulling it back deselects nothing, so an overshoot stays selected.
- *The presets differ here*: both combine a range with the selection from
  before the run of Shift- or Ctrl+Shift-clicks, so pulling a range back
  returns files to their earlier state (file_08 stays selected; Explorer's
  overshoot is removed). This makes both baselines more forgiving than the
  real systems when a participant overshoots and pulls back within one run.
  Not changed, since the data are collected; reported as a threat to validity
  (section 15, baseline realism), in the conservative direction.

**Revision 26** (2026-10-18, build version `study-3.8`; **practice only**):
**Practice step 2 asks for "the six files with a flag".** It named the first
and last file of the range (e.g. `agenda.docx` to `price_list.xlsx`), and
participants found the names confusing. The instructions now point to the
flagged files only; the targets, the files and the step check are unchanged,
and practice steps are not scored.
The same build lowered the minimum age on the consent screen from 18 to 16
(English and Norwegian), so that upper-secondary pupils could take part
(recorded 2026-11-20; see the thesis, section 6.2).

The within-subjects design is kept. With 30–32 participants it detects medium
effects (d_z ≥ 0.52 at 80 % power), whereas a between-subjects design with 15
per group would only detect very large ones (d ≥ 1.06) and give no preference
data (section 3.3).

---

## 1. Purpose and research questions

The study compares the proposed file-explorer multi-selection (the *predicate
system*: algebraic selection model + predicate search + exclusion search +
selection focus) with conventional file-manager multi-selection (the
*traditional system*), on identical UI, data and hit-testing.

- **RQ1** Is the predicate system as efficient as the traditional system for
  simple selections (no overhead)? Measured in the warm-up and in Task A, the
  baseline task (revision 18).
- **RQ2** Does the predicate system protect an existing selection when a
  range is added to it (Shift-click after a Ctrl-click; thesis defect #1,
  fragile selection)? Task D (revision 18; before, RQ2 was about drags,
  defect #4, in Task A).
- **RQ3** Does the predicate system keep selections through searches and
  folder navigation (thesis defects #2 and #3)?
- **RQ4** Does predicate search make rule-based selections ("all X except Y")
  faster and more accurate?
- **RQ5** Which system do users prefer, and do they find it adequate and
  non-frustrating?

The study evaluates the whole system (a bundle of features); each task is
designed so that one feature is the natural tool.

*Thesis numbering (2026-11-15).* The thesis reframes the research questions
around one main question (does a model that unifies visual and property-based
selection serve users better?) with four sub-questions. The hypotheses H0–H6
are unchanged; only their grouping differs:

| Thesis | Study plan (above) | Hypotheses | Tasks |
|---|---|---|---|
| RQ1 engineering | (none) | (none) | design and validation |
| RQ2 combining the two modes | RQ3, RQ4 | H3, H4 | B, C |
| RQ3 cost of unification | RQ1 | H0, H1, H2 | tutorial, warm-up, A |
| RQ4 preference and effort | RQ5 | H5 | questionnaires |
| secondary result | RQ2 | H6 | D |

Out of scope: undo/redo (the undo half of thesis defect #1 is not evaluated
empirically; state this in the thesis), state-erasing drags (defect #4: no
task makes a drag the natural tool, and participants did not use Ctrl-drag;
revision 18), and deselection strategies (the subtraction task was dropped,
section 9).

---

## 2. Hypotheses

Overall: *The predicate system differs from the traditional system in task
completion time, gesture count, selection errors and user satisfaction.*

Tested as directional, pre-registered hypotheses per task (analogous to
Ramanathan & Järvi, NIK 2016):

| ID | Measured in | Hypothesis |
|---|---|---|
| H0 | Tutorial | The predicate system's tutorial takes longer, but under 150 s on average (90 s before revision 5 added two steps). |
| H1 | Tutorial warm-up (select 3 marked files) | No meaningful difference in time or gestures. |
| H2 | Task A — Keep what you have (baseline) | No meaningful difference in lost pre-selected items or time (two-sided; revision 18, see below). |
| H3 | Task B — Context switch | Predicate system: lower time and gestures, higher completion rate. |
| H4 | Task C — Rule with exceptions | Predicate system: higher exact-match rate and lower time. |
| H5 | Questionnaires | Predicate system rated less frustrating and at least as adequate; preferred by the majority. |
| H6 | Task D — Keep and extend | Predicate system: fewer attempts that lose a pre-selected file, and a higher exact-match rate (revision 18). |

A non-significant result for H1 or H2 is reported as "no difference
detected", not as proof of equivalence.

*Changed after data collection began (revision 18).* H2 was pre-registered as
"Predicate system: fewer lost pre-selected items and lower time". It
contradicted the earlier agreement with Jaakko that Task A is the baseline
task, and the task as built gives no route on which the systems differ unless
participants Ctrl-click and then Shift-click, which none of the first five
did. H6 and Task D were added at the same time. Both changes are reported in
the thesis with the date and the number of sessions run before them (five).
H6 is expected to hold for the Windows-like baseline only: in the Finder-like
one a Shift-click adds the range, as in the predicate system, so the pooled
H6 test is diluted by Mac participants (reported per preset, section 14).

---

## 3. Design

### 3.1 Within-subjects, counterbalanced

- Every participant uses both systems, four core tasks each (three before
  revision 18).
- **Counterbalancing (2×2)**: system order × dataset (D1/D2). The two task
  datasets have the same structure and layouts but different file names, so
  participants cannot reuse remembered targets in the second block.

  | Group | Block 1 | Block 2 |
  |---|---|---|
  | G1 | Predicate + D1 | Traditional + D2 |
  | G2 | Predicate + D2 | Traditional + D1 |
  | G3 | Traditional + D1 | Predicate + D2 |
  | G4 | Traditional + D2 | Predicate + D1 |

  The app assigns groups in rotation (G1, G2, G3, G4, G1, …) so the groups
  stay balanced as participants arrive.
- **Neutral naming**: "System A" (first block) and "System B" (second block).
  Participants are not told which system is new until the debrief.
- **Task order**: fixed within a block (tutorial, A, B, C, D), identical in
  both blocks. Task D is last so that adding it (revision 18) left the rest of
  the block unchanged.

### 3.2 Baseline choice (decided: OS-matched)

- *Option 1 (recommended; the current default)*: **OS-matched baseline** — Windows users get the
  Windows-like traditional system, macOS users the Finder-like one ("the
  system you use every day"). One click to record the main OS.
- *Option 2*: one fixed preset for everybody; report its consequences
  (section 7).

### 3.3 Alternatives considered

- **Between-subjects** (each participant uses one system for the full 10
  minutes, 5 tasks): no carry-over and no second dataset, but with N = 30
  (15 per group) only very large effects (d ≥ 1.06) are detectable, and there
  is no preference comparison. Rejected.
- **Within-subjects with all six tasks**: about 40 minutes. Rejected because of
  fatigue and recruitment.

---

## 4. Participants

- **Target N = 32** (8 per counterbalancing group), minimum 30. Paired design:
  80 % power for d_z ≥ 0.52 at α = .05 (two-sided). The core tasks are
  expected to show large effects (the NIK 2016 study found them with 12
  participants per group, between-subjects).
- **Recruitment**:
  - family and friends (patient; may know that the experimenter built one of
    the systems);
  - passers-by approached on campus (e.g. study areas, café), thanked with
    coffee or a cookie. The thanks is given to everyone, regardless of
    performance or completion.
- **Inclusion criteria** (verified verbally, not recorded individually): 18 or
  older; uses a computer regularly; comfortable with a physical mouse and
  keyboard; has used a desktop file manager (Explorer or Finder).
- **Recorded per participant** (non-identifying, categorical, one click each):
  - main desktop OS (Windows / macOS / Linux / other);
  - recruitment source: "knows the experimenter" (yes / no);
  - the language chosen for the session (English / Norwegian).
- No age, gender or education forms. The cohort is described in aggregate in
  the thesis.

---

## 5. Ethics and data protection

- Check the study with the UiB data-protection wizard (rette.app.uib.no) and,
  if required, notify Sikt before recruiting. UiB requires RETTE registration
  for student projects that *process personal data*; the supervisor is always
  the project manager. This design is anonymous, so registration is not
  expected, but the check and the supervisors' go-ahead come first (section
  16, decision 6).
- **Consent**: one screen with a click-through checkbox before the tutorial:
  18+, voluntary, can stop at any time without giving a reason, anonymous,
  what is logged (interaction events, questionnaire answers), where it is
  stored and for how long, contact details. Because the data are anonymous,
  data cannot be withdrawn after the session; say so.
- **Anonymity**: random participant labels generated by the app; **no list
  linking labels to names** (including for family and friends). No audio,
  video or screenshots of participants. Nothing is collected from passers-by
  besides the anonymous session data.
- **Local only**: the app runs on the experimenter's laptop; logs are local
  JSON files, one per participant.
- The optional free-text comment asks participants not to include identifying
  information.

---

## 6. Apparatus

- Experimenter's laptop with an external two-button mouse, fixed browser, full
  screen, fixed zoom. Study laptop: Lenovo Legion 5 Pro (2560×1600, Linux/KDE
  Plasma at 125 % scale), browser zoom 150 % in full screen, giving a
  1365×853 CSS-pixel viewport. The setup screen warns when the viewport differs
  by more than 2 px (forgotten F11, changed zoom). The list has a fixed height
  (570 px in the practice, 540 px in tasks), so every participant sees the
  same rows; all screens also fit the minimum of 1280×800.
- Study mode ignores the right and middle mouse buttons (no context menu, no
  accidental right-click selection, no middle-click paste on Linux), blocks
  Ctrl+wheel and touchpad-pinch zoom (the browser zoom set before hand-over is
  kept; keyboard zoom still works for the experimenter), and the page is
  always light, whatever the OS theme.
- The explorer web app, served locally, in **study mode**: the app itself
  shows consent, the tutorial, task instructions, Start/Done buttons and the
  questions, and moves on automatically. This keeps sessions short and
  identical in noisy public settings.
- Study mode via URL: `?study=1`. The app assigns the group (fewest completed
  sessions), derives model and dataset per block, and hides all developer
  controls. `&pilot=1` marks pilot sessions, which are not counted.
- The build's git commit hash is recorded in every log.

---

## 7. Conditions

Both systems share: list (tree) and grid views, folder drill-down,
breadcrumbs, filter search, drag strategies, keyboard navigation and
shortcuts (including Ctrl+A, Esc, Ctrl+I), Select All (the visible items) /
Deselect All (everything).

| Behaviour | Predicate system | Traditional (Windows-like) | Traditional (Finder-like) |
|---|---|---|---|
| Click / Ctrl-click / plain drag | same | same | same |
| Shift-click | adjusts the last step's range | replaces selection with range | list: adds range; grid: toggles the item |
| Ctrl/Cmd-drag | selects or deselects (mode set by first item) | toggles | toggles |
| Ctrl/Cmd+Shift-click | as Shift-click (continues the last Ctrl-click's mode) | adds or removes the range by the last Ctrl-click's mode | as Ctrl/Cmd-click |
| Shift + drag from empty space | extends the last step to the pointer | adds a rectangle | adds a rectangle |
| Filter / search change | selection kept | selection cleared | selection cleared |
| Folder navigation | selection kept | selection cleared | selection cleared |
| List ↔ grid switch | kept | kept | kept |
| Predicate "Select / Deselect matching" | yes | no | no |
| Undo / redo | **disabled for the study** | none | none |
| "Show Selected Only", "(N not visible)" indicator, hidden-by-search note | yes (decided; note since revision 15) | — | — |
| Click scope | global, as in desktop systems (decided) | global | global |

Notes:

- Undo is disabled so that neither condition has an unmeasured safety net.
- Global click scope isolates the effect of keeping selection (S) separate
  from visibility (V).
- **Baseline realism (decided: no sorting in this study)**: real Explorer/Finder
  users often sort by type, then Shift-click. Column sorting is not implemented
  in either system; its absence is stated as a limitation. Task C is the task
  most affected (the traditional system needs more Ctrl-clicks than with
  sorting).
- The Windows-like preset was checked against Explorer on Windows 11
  (revision 13), the Finder-like preset against Finder (revision 24).

---

## 8. Procedure

### 8.1 Session outline and time budget

| Step | Content | Typical |
|---|---|---|
| 1 | Welcome (experimenter), verbal inclusion check | 0:30 |
| 2 | Consent screen, main OS, "knows the experimenter" | 0:30 |
| 3 | **Block 1** (System A): tutorial → Tasks A, B, C, D (each followed by a one-click SEQ) → 2 questions | 4:30 |
| 4 | **Block 2** (System B): same structure, other dataset (shorter tutorial) | 4:00 |
| 5 | Final question: preference (+ optional comment) | 0:30 |
| 6 | Debrief (which system was new), coffee/cookie | 0:30 |
| | **Total** | **≈ 10 min** |

There is no hard time limit. A participant who is stuck can skip a task after
2 minutes (section 8.3); in practice this bounds a session at roughly 12–13
minutes even if one or two tasks are skipped.

The pilot (section 13) checks that the median session is ≤ 10 minutes. If it
is not, reduce the sizes in the tasks (fewer targets) before cutting a task.
Pilot 1 (revision 6) measured 15–16 minutes, mostly from the longer tutorial;
the consent screen now says "about 15 minutes", and nothing was cut. Task D
(revision 18) adds roughly half a minute per block.

### 8.2 Guided mini-tutorial (replaces the free-play Task 0)

- On-screen steps (`STUDY.tutorial` in `src/study/config.ts`), each with a
  one- or two-line explanation and an automatic check before moving on:
  1. **Warm-up**: "Select the 3 marked files" (click, Ctrl-click). Timed:
     this is the simple-selection measurement for H1.
  2. "Select a range, then deselect": Shift-click a range of eight files,
     then Ctrl-click the two without a flag (one step since revision 8;
     Ctrl-click rather than Ctrl-drag; until revision 24 the reason given was
     that ⌘-drag only adds in the Finder-like baseline, which Finder does not
     do. Ctrl-click is kept: practising Ctrl-drag would steer participants to
     the gesture where the predicate system differs, see revision 13).
  3. "Find a file with the search box."
  4. **List view** (revision 5): starts in the grid; switch to "List", open a
     folder with its arrow (▶) and select a file in it. Teaches that the list
     shows several folders at once (one way to reach Task B's other folder;
     the hint that pointed to it was removed in revision 7).
  5. *Predicate system only*: "Select all 'report' files except the copies"
     with Select matching and then Deselect matching (one step since revision
     8). Starts with two selected files that must stay selected (revision 6),
     and when solved the instruction is replaced by a note that they are still
     selected: pilot 1 showed that participants otherwise assume a search
     clears the selection. One match is in the closed Archive folder, so
     participants see the hidden-matches note next to the search box. The step
     has the same shape as Task C (a rule with exceptions) on other files and
     words; report this with H4 (section 15).
  6. **Show selected only** (revision 5; only in blocks with the selection
     aids, i.e. the predicate system): two of four selected files are in a
     closed folder; turn on "Show selected only" and deselect one of them.
     Makes participants remember the aid during the tasks (Jaakko).
- Steps 4 and 6 pass only when the control is actually used (list view /
  "Show selected only" on), not just when the selection is right
  (`requires` in the dataset task).
- Steps 3–6 outline the control(s) they are about with a pulsing yellow frame
  (`highlight` in the dataset task; revision 6, pilot 1).
- First block: 6 steps (predicate) or 4 (traditional); pilot 1 (8 steps)
  took about 4.7 min. The second block's tutorial repeats only the steps
  that differ, plus the warm-up (predicate second: 3 steps; traditional
  second: 1).
- **"Skip this step"** appears after 60 s on a step and skips only that step
  (revision 5; before, "Skip the practice" skipped all remaining steps, which
  with several steps would have let participants skip the predicate steps).
- Implemented in a `Practice` folder of each dataset, so the tutorial uses the
  same kind of files as the tasks; each step ends automatically when the
  selection is exactly right (checked only when no drag or search preview is
  in progress) and any required control is in use, and the participant
  presses Next.
- **"Start this step again"** on practice steps that start with a selection
  (select/deselect matching, show selected only): restores the starting
  state if the participant loses the selection. Not on the timed warm-up.
- Explaining every feature ensures the tasks measure efficiency, not
  discovery. Every task intro and, since revision 6, the task screen itself
  (under the instructions, for the whole task) list per system which features
  exist ("Tools in this system: …"). Task-specific hints in one system only
  were rejected: they would make the instructions differ between conditions
  and point the predicate group at the tested strategy. The reminder line is
  the same for every task of a system; it tells participants what exists, not
  what to do.

### 8.3 Task mechanics

- Each task shows its instruction as numbered steps, one per line (revision
  6), and a **Start** button; the task ends when the participant presses
  **Done**.
- **Targets**:
  - *Photo tasks* use the pictures themselves ("the cats, not the dogs"), in a
    folder with camera-style names (`IMG_4821.jpg`), so the name never gives
    the content away and search cannot shortcut the task. This is realistic
    and needs no artificial markers.
  - *Document tasks* either mark targets with a visible marker (e.g. a blue
    flag, independent of the selection style) or describe them by a rule
    only (Task C).
  - **Pre-selected files that must stay selected carry the same flag as the
    targets** (revision 6; orange before, which a pilot participant read as
    "remove this"). The task text says which flagged files are already
    selected.
- **No correctness feedback before Done** (otherwise errors turn into time).
- **No visible timer.** After 2 minutes on a task, a "Skip task" button
  appears; a skipped task is recorded as not completed. This keeps
  participants from rushing (which a visible countdown causes) while giving
  stuck participants a graceful way out without experimenter hints.
  (Decided: soft skip. The rejected alternative, a hard limit such as 75 s,
  bounds the session exactly but truncates the time data.)
- All tasks are **possible in both systems**; some are only more laborious in
  one.

---

## 9. Tasks

Short, realistic scenarios. Folder names refer to dataset D1; D2 has the same
structure with different names.

### Task A — Keep what you have (baseline task; RQ1, H2)

*Since revision 18 the baseline task* (as agreed with Jaakko): the routes
participants use (Ctrl-clicks, or one Shift-click from the start anchor) work
the same in every system, so no difference is expected. The design notes
below are from revision 1, when the task was meant to test drags; they are
kept because they describe the task as built.

- *Scenario*: "Three contracts are already selected for the archive. Also add
  this month's invoices."
- *Setup*: list view. Folder `Contracts` expanded, 3 orange pre-selected files
  at its bottom. Directly below: `Invoices` with 6 marked contiguous files,
  the first adjacent to the last orange file, so the fastest range/lasso
  strategy passes next to or over the orange items. Same view in both
  systems.
- *Success*: 3 orange + 6 marked files selected, nothing else.
- *Expected*: a plain click or plain drag clears the orange items in both
  systems. Ctrl-click then Shift-click: Windows-like replaces (orange lost);
  predicate and Finder-like keep them. Ctrl-drag overshooting into
  `Contracts`: Windows-like and Finder-like (revision 24) toggle orange items
  off while covered; predicate keeps them.
- *Key measures*: lost orange items, time. (H2, two-sided since revision 18)
- *Anchor* (revision 11): the Shift-click anchor starts on the first
  pre-selected photo and the active end (keyboard focus) on the last
  (`anchor`, `focus` in the task), in every system, as after a click and a
  Shift-click.
- *Implemented* (photo variant; revision 6): one flag colour; "orange" above
  means the three pre-selected, flagged photos. Wording: "1. Three of the
  flagged photos are already selected for the album: keep them selected.
  2. Also select the other six flagged photos."
- *Photo variant* (optional): orange = three photos already chosen for an
  album; targets = the contiguous block of photos directly below. Only use it
  if the targets can be made contiguous without relying on file names.

### Task B — Context switch (search or navigate; RQ3)
- *Scenario*: "You are picking photos for a presentation, then remember a
  spreadsheet you also need."
- *Setup*: grid view in folder `Photos` (24 pictures with camera-style names:
  8 cats, 16 dogs, mixed). Instruction (revision 6): "1. Select all the cats
  in this folder. 2. Then also select `budget_2025.xlsx` in the Documents
  folder." Participants may search or navigate. (The bundled `pets-demo`
  dataset has exactly this shape.) The subfolder `Summer 2025` (Task A) holds
  only dogs (revision 17), so "this folder" cannot be read as including its cats.
- *No hint* (revision 7). Revisions 5–6 had a hint in both systems ("to get
  there, you may need to switch the view from “Icons” to “List”"; Jaakko).
  It pointed traditional-system users to the one workaround that keeps their
  selection (select the cats in the grid, then switch to the list and
  Ctrl-click the spreadsheet), which was expected to shrink the H3
  difference. Without it, participants search, navigate or use the list as
  they would in a real file manager; a participant who gets stuck can skip
  after 2 minutes. The log shows which route each participant took.
- *Success*: the 8 cat photos + the spreadsheet selected.
- *Expected*: in the traditional system, both searching and leaving the folder
  clear the selection; participants must reselect the photos (or find the
  file first and then use the list view to reach both). In the predicate
  system the photos stay selected. The event log shows whether search or
  navigation was used, so defects #2 and #3 can be reported separately.
- *Key measures*: time, gestures, completion rate. (H3)

### Task C — Rule with exceptions (predicate search; RQ4)
- *Scenario*: "Hand in all your research PDFs, but not the drafts, and include
  the two readme files."
- *Setup*: list view, folder `Research` with 30 files: 14 PDFs, 4 of them with
  `draft` in the name; 2 `readme` files; the rest mixed types. No markers:
  targets are defined by the rule only.
- *Instruction* (revision 7): "1. In the Research folder, select all PDF files that do
  not have 'draft' in the name. 2. Also select the two readme files:
  README_data.md and readme.txt."
- *Success*: exactly the 10 non-draft PDFs + 2 readmes selected.
- *Expected*: predicate system: Select Items `pdf` → Deselect matching `draft`
  → add the readmes. Traditional: filter + Ctrl+A + Ctrl-clicks, but changing
  the filter clears the selection; in practice many Ctrl-clicks (or sorting,
  if implemented).
- *Requires*: "Deselect matching" in the UI.
- *Key measures*: exact-match rate, missing/extra items, time. (H4)

### Task D — Keep and extend (fragile selection; RQ2, H6; revision 18)
- *Scenario*: "Two lecture files are already selected for printing; select
  the other flagged ones too."
- *Setup*: list view, folder `Lectures` (D1) / `Seminars` (D2) expanded, the
  last root folder, scrolled so its 16 files are in view. Rows, in order:
  two unflagged files, **K1** (kept), **U** (unflagged), **K2** (kept),
  **T1–T6** (flagged) directly below K2, five unflagged files. K1 and K2 are
  pre-selected and flagged like the targets.
- *Start state*: as after a click on K1 and a Ctrl-click on K2: range anchor
  and keyboard focus on K2 (`anchor`, `focus`), which is what Explorer leaves
  (the anchor stays at the last Ctrl-click).
- *Instruction*: "1. Two of the flagged files are already selected for
  printing: keep them selected. 2. Also select the other six flagged files."
  / «1. To av filene med flagg er allerede merket for utskrift: behold dem
  merket. 2. Merk i tillegg de seks andre filene med flagg.»
- *Success*: K1, K2 and T1–T6 selected, nothing else.
- *Expected*:

  | Route | Windows-like (= Explorer) | Finder-like | Predicate |
  |---|---|---|---|
  | Shift-click T6 (extend from K2) | K2–T6 replaces: **K1 lost** | adds: correct | adds: correct |
  | Ctrl-click T1, Shift-click T6 | T1–T6 replaces: **K1, K2 lost** | adds: correct | adjusts the Ctrl-click: correct |
  | Ctrl-click each of T1–T6, or Ctrl-drag over T1–T6 | correct | correct | correct |
  | Ctrl-click T1, Ctrl+Shift-click T6 | correct | T1 and T6 only: T2–T5 missing, nothing lost (revision 24) | correct |
  | Click K1, Shift-click T6 | U selected too | same | same |
  | Plain click or plain drag on the targets | K1, K2 lost | same | same |

  The systems differ on the two Shift-click routes, the first of which is
  the shortest. U rules out one range over everything. Covered by unit tests
  for all three models (`traditional.test.ts`, "Task D") and e2e tests
  (`tasks.e2e.ts`).
- *Key measures*: attempts that lose a kept file (any-loss, McNemar), exact
  match; time and gestures secondary. (H6)
- *Fairness*: the behaviour is Explorer's own (revision 13). Participants who
  use the gestures that keep a selection in Explorer (Ctrl-clicks, Ctrl-drag,
  Ctrl+Shift-click) lose nothing. Neither system gives feedback before Done,
  so a Windows-like participant may not notice that K1 (two rows up, still
  flagged) was dropped. The task measures how often the fragile route is
  taken and what it costs, not how often users meet this situation outside
  the study.

### Dropped: Subtraction task
- Not in this study (the longer tutorial uses the time); mention as future
  work. The design was: 30 pre-selected files, deselect 6 marked in the
  middle, testing range-deselection (differs mainly from the Finder-like
  baseline). It was called "Task D" before revision 18.

---

## 10. Measures

### 10.1 Logged raw data (JSON, one file per participant)

- Header: participant label, group, system and dataset per block (incl.
  baseline preset), main OS, recruitment source, app commit hash, viewport
  size, timestamps.
- Per task: task ID, start/Done timestamps, skipped flag, target set,
  pre-selected set.
- Event stream: pointer down/up with modifiers and the item hit, drags, keys,
  search input and mode changes, view switches, folder navigation, buttons.
- **Selection snapshots** after every change (or diffs), so errors and
  accidental clears can be reconstructed.
- Mouse movement throttled to ~20 Hz (path length, idle time).
- Questionnaire answers.

Implemented (schema `multiselect-telemetry/1`, `src/telemetry/schema.ts`):
selection changes are logged as diffs, and replaying them from the task's
pre-selection gives the selection at any moment. Each `taskEnd` carries the
final selection and its score (missing, extra, orange lost). `taskEnd.duration`
runs from task start; completion time (first input → Done) is derived from the
event stream. Gesture count = presses + selection-changing key commands +
committed searches.

### 10.2 Derived measures

| Measure | Definition | Role |
|---|---|---|
| Completion time | First input after Start → Done; skipped tasks flagged | Primary |
| Completion rate | Done without skipping | Primary (Task B) |
| Gesture count | Clicks, Ctrl/Shift-clicks, drags (one each), keyboard selection commands, committed searches | Primary |
| Exact match | Final selection equals the target set | Primary (Task C) |
| Selection error | Missing + extra items at Done | Secondary |
| Lost pre-selections | Kept (pre-selected) items unselected at Done | Primary (Tasks A and D) |
| Accidental clears | Selected target/orange items that became unselected and were re-selected (a predicate search, and clicks retracted by a double-click, count once, by their net effect) | Secondary |
| Strategy | Features used per task | Descriptive |
| Tutorial time, warm-up time | Tutorial duration; warm-up step duration | H0, H1 |

**Exclusion rule (pre-registered)**: attempts with more than 10 % incorrect
items are excluded from the time and gesture analysis (as in NIK 2016) and
reported as errors.

---

## 11. Questionnaires (all one-click, 7-point)

- **After each task**, the Single Ease Question (Sauro & Dumas 2009):
  "Overall, how difficult or easy was this task?" (1 = very difficult …
  7 = very easy; end labels beside 1 and 7, revision 7).
- **After each system**, the NIK 2016 items: "The selection method was
  sufficient for the tasks." / "The selection method was frustrating to use."
  (1 = strongly disagree … 7 = strongly agree).
- **At the end**:
  - "Which system did you prefer?" (A / B / no preference);
  - "Did you lose a selection by accident?" (no / in A / in B / in both);
  - optional one-line "Why?" (skippable; no identifying information).

---

## 12. Implementation checklist (before the pilot)

- [x] **Study mode** (self-guided, `?study=1`): setup screen, language,
      consent, OS and recruitment-source questions, group rotation,
      per-block model/dataset, guided tutorial with step checks, task
      instructions, Start/Done, SEQ and questionnaires, "Skip task" after
      2 min, debrief screen, "Stop the study".
- [x] Fill in the contact details and the retention period
      (`src/study/config.ts`; the setup screen warns while placeholders remain).
- [x] Revision 5 (Jaakko's comments): bold key points on the consent screen;
      Task B hint; practice steps "List view" and "Show selected only" (with
      `requires` checks); "Skip this step" per practice step; H0 bound 150 s.
      All screens checked to fit 1280×800 and 1365×853 in both languages.
      Then (same evening): restart button for practice steps, "you can use"
      line on task intros, left mouse button only, always-light page, Ctrl
      without ⌘, viewport check for the study laptop.
- [ ] Native-speaker check of the Norwegian texts (`src/study/text.ts`,
      `src/components/explorer/text.ts`, instructions in the datasets).
- [x] Dataset loader (JSON task folders, `?dataset=`, picker), thumbnails in
      grid and list, preloading before a dataset is shown.
- [x] Photo import script (`scripts/import-photos.mjs`: category folders →
      WebP thumbnails without metadata + dataset JSON); demo dataset
      `pets-demo` (self-drawn cats/dogs + Task C-shaped `Research` folder).
- [x] Task fixtures for Tasks A–C and the tutorial in two matched datasets:
      `pets-demo` (D1) and `pets-demo-2` (D2), self-drawn placeholders.
- [x] ~~Replace D1/D2 with real photos~~ Decided (revision 5): keep the
      self-drawn pictures (section 16, decision 8).
- [x] Task specifications in the dataset JSON (start view/folder, expanded
      folders, pre-selection, keep/target markers, instructions) with
      validation and scoring (`evaluateTask`); `?task=` and a Task picker.
      `pets-demo` defines Tasks A–C.
- [x] Pre-selected items outside the history, flagged ("keep"; orange until
      revision 6, now the same flag as targets).
- [x] Target markers (blue flag), switchable per task (`markTargets`).
- [x] `undo=0`: disable undo/redo in the predicate system.
- [x] "Deselect Items (Predicate)" search mode.
- [x] `aids=0`: hide "Show Selected Only", "(N not visible)" and folder
      badges (for the traditional system, if decided).
- [x] ~~Column sorting in both systems~~ Decided: not in this study
      (limitation).
- [x] Telemetry: event stream + selection diffs → JSON file per session
      (`study-data/<id>.json` via the dev/preview server), commit hash,
      autosave, crash backup, scoring at Done (README "Telemetry").
- [x] Participant label, group, language, OS and recruitment source in the
      log header (`meta.study`); questionnaire answers as `answer` events.
- [x] Verify the Windows-like preset against Explorer (Windows 11,
      2026-10-11; revision 13).
- [x] Verify the Finder-like preset against Finder (2026-10-16; revision 24).
- [ ] Finder, still to check: does a Shift-click toggle in icon view move the
      anchor, and is ⌘+Shift-click in icon view a ⌘-click too?
- [ ] UiB data-protection check (RETTE) done and supervisors' go-ahead by
      email (section 16, decision 6).
- [x] Pilot 1 (two sessions, `study-1`): predicate features unused in the
      tasks → revision 6 (practice step 6 with a kept selection, outlined
      controls, tools line on the task screen, numbered task steps, one flag
      colour, "about 15 minutes"); version `study-2`.
- [x] Revision 7 (`study-2.1`): standard SEQ wording with end labels beside
      1 and 7, Task B hint removed, "In the Research folder", 1.5 s screen
      guard.
- [x] Revision 8 (`study-2.3`): practice merged to 6 steps (range +
      deselect; select + deselect matching).
- [x] Revision 9 (`study-2.4`): Task A anchor on the last pre-selected photo
      (engine `load(selected, focus)`, tested for all three models).
- [x] Revision 10 (`study-2.5`): edge auto-scroll only after a real drag
      (held clicks on the last rows no longer scroll and extend the selection).
- [x] Revision 11 (`study-2.6`): Task A anchor on the first, active end on
      the last pre-selected photo.
- [x] Revision 12 (`study-2.7`): review fixes in both systems: Enter applies
      a matching search typed just before it, Select All selects the visible
      items, the first navigation key selects the first item, and keys do
      nothing in an empty grid.
- [x] Revision 13 (`study-2.8`): Windows-like preset checked against
      Explorer; Ctrl+Shift-click and Shift-drag from empty space follow
      Explorer; the first navigation key steps from the first item; screen
      guard off; Task A starts scrolled; viewport logged at hand-over; more
      visible hidden-matches note.
- [x] Revision 14 (`study-2.9`): practice steps as a goal plus numbered
      steps (three lines each, measured at both screen sizes).
- [x] Revision 15 (`study-2.10`): note when a search hides selected files
      (predicate system); three practice lines shortened to fit 1280×800.
- [x] Revision 16 (`study-2.11`): Shift-click after a click in blank space
      extends from the last item clicked (predicate system); accidental clears
      count a predicate search by its net effect (analysis).
- [x] Revision 17 (`study-2.12`): photo subfolders hold only dogs (both
      datasets, nothing else changed); a slow double-click on a folder keeps
      the selection (predicate system).
- [x] Revision 18 (`study-3`): Task A is the baseline task (H2 two-sided);
      Task D "Keep and extend" after Task C, with its own root folder in both
      datasets (nothing else changed): K1, an unflagged file, K2, then six
      targets; H6; analysis, unit and e2e tests.
- [x] Revision 19 (`study-3.1`): permanent scrollbar on the file list (both
      systems); e2e check of its width.
- [x] Revision 20 (`study-3.2`): bold step numbers; verbal reminders
      stopped, reminded attempts to be listed for a sensitivity analysis.
- [x] Revision 21 (`study-3.3`): presses on the scrollbar ignored by the
      selection.
- [x] Revision 22 (`study-3.4`): drag from below the rows; leave-page guard
      and no swipe navigation.
- [x] Revision 23 (`study-3.5`): "press Enter to keep" in the match note
      while a predicate preview is live (predicate system).
- [x] Revision 24 (`study-3.6`): Finder-like preset checked against Finder
      (Shift-click in the grid toggles; ⌘-drag toggles; ⌘+Shift-click is a
      ⌘-click; Shift-drag from empty space adds a rectangle).
- [x] Revision 25 (`study-3.7`): Ctrl+Space works in Helium (all systems).
- [x] Revision 26 (`study-3.8`): practice step 2 asks for the flagged files, not named files.
- [ ] Norwegian check of the revision 6–8, 14, 15, 18 and 23 texts (Task D,
      «fire oppgaver», 26); then commit, `git tag study-3.8`, `npm run build`.
- [ ] Supervisors informed by email of revision 18 (the H2 change and Task D)
      before the next counted session.
- [ ] Pilot 2 (1–2 sessions, `pilot` box ticked): do participants use the
      predicate features in Task C now?
- [x] Analysis scripts (README "Analysis"): extraction of the derived
      measures (`scripts/analysis/extract.ts`), statistics, report and
      figures (`analysis/`), tested on robot participants with and without
      effects.
- [x] Run the analysis on the pilot data and check the report (pilot 1:
      extraction and replay without errors).
- [x] Thesis versions of the figures (`analysis-out/figures/thesis/`, thesis
      font and text width; 2026-11-18). Copying them into `thesis/figures/`
      is Ole's decision.

---

## 13. Pilot

Run 3 pilot sessions with people outside the sample, ideally including one
passer-by. Check: session length (median ≤ 10 min), tutorial clarity, how
often "Skip task" is used (a problem in the predicate system; expected
occasionally in Task B for the traditional one), whether any picture is
ambiguous at thumbnail size, logging completeness, and that every task is
solvable in both systems. Freeze the app version and this plan after
the pilot.

Pilot 1 (2026-10-08, two passers-by, `study-1`) led to revision 6 (top of
this document): participants did not use the predicate features in the tasks.
Its logs are kept in `study-data/pilot-1/` and are not analysed. Pilot 2
(1–2 sessions with `study-2.12`, revision 17) checks whether the changes work.
Task D (revision 18) should get one pilot session of its own (`study-3`,
pilot box ticked): is the instruction clear, and do participants extend
with a Shift-click?

Three counted sessions (pilot box not ticked) were run before pilot 2, on
builds `study-2.7` to `study-2.10` (2026-10-09 and 2026-10-12). Ole decided on
2026-10-13 to keep them: the changes from 2.7 to 2.10 are small. Two of the
logs (P-BEC0ZB, P-064026) were relabelled `study-2.10` by hand; their
`app.commit` and the `.bak` copies record the build they ran on.

---

## 14. Analysis plan

- **Per task, per measure**: paired comparison of predicate vs traditional.
  - Time: Wilcoxon signed-rank test. Skipped tasks are ranked as the
    slowest, which handles them conservatively.
  - Gestures, errors, SEQ, questionnaire items: Wilcoxon signed-rank.
  - Completion and exact match (yes/no): McNemar's test.
  - Preference: binomial test against 50 % (excluding "no preference").
- **Effect sizes**: r (Wilcoxon) or d_z with 95 % confidence intervals; report
  medians and IQRs.
- **Multiple comparisons**: Holm correction within each measure across the
  directional tasks B, C and D (revision 18; before: A, B and C). Task A, the
  baseline task, is tested two-sided and not corrected, like the warm-up.
- **Versions** (revision 18): Task D exists from `study-3` on and is analysed
  on those sessions only. Tutorial, warm-up and Tasks A–C pool all versions
  (unchanged). The block questions (sufficient, frustrating), the preference
  and the "lost a selection" question follow one more task from `study-3` on:
  report them pooled and per version.
- **Order and dataset**: mixed-effects check
  (measure ~ system × order + dataset + (1 | participant)).
- **Recruitment source**: repeat the main comparisons with and without
  participants who know the experimenter (sensitivity analysis).
- **OS-matched baseline** (if chosen): report results per preset
  descriptively, in addition to the pooled analysis. For Task D the expected
  difference exists only with the Windows-like preset (the Finder-like one
  adds a Shift-click range, like the predicate system), so the lost
  pre-selections are also tabulated per preset. Finder-like results are split
  at `study-3.6` (revision 24: the preset before it was not checked against
  Finder).
- **Qualitative**: strategy frequencies per system and task; summary of
  optional comments.
- α = .05; state the direction for directional hypotheses.
- Implemented in `analysis/` (README "Analysis"). Details fixed there:
  one-sided tests for H3-H6 (two-sided for H1, H2 and "sufficient"); effect
  size = matched-pairs rank-biserial r with bootstrap 95 % CI, plus d_z;
  skipped attempts are ranked as the slowest for time and left out of the
  gesture and error comparisons; H0 compares the first block's full tutorials
  between groups (the second block's tutorial is shorter by design); the mixed
  model uses sum-coded position and dataset, so the system effect is averaged
  over both positions. Accidental clears are also compared per task
  (secondary).

---

## 15. Threats to validity

- **Familiarity**: years with traditional selection vs. minutes with the
  predicate system favours the baseline, so a positive result is
  conservative. The short tutorial makes this stronger.
- **Short sessions**: few measurements per person make individual results
  noisy; compensated by N ≥ 30 and paired comparisons.
- **Friends and family**: may want to please the experimenter (demand
  effect), and may guess which system is new. Mitigated by neutral naming,
  self-guided sessions, and the sensitivity analysis on recruitment source.
- **Public settings**: noise and distractions; mitigated by the self-guided
  flow, identical equipment and time limits.
- **Visual judgement**: in photo tasks, some errors may come from
  misjudging a picture rather than from the selection method. Mitigated by
  unambiguous images (checked in the pilot). Because D1 and D2 contain
  different pictures, their difficulty must also be matched.
- **Bundled treatment**: several features differ; task-level attribution
  depends on the task design.
- **Baseline realism**: imitates Explorer/Finder in a shared UI (with file-type
  icons, so files of one type can be found by eye); lacks sorting
  (if not implemented) and platform details. There is no drag-and-drop: a drag
  that starts on a file selects a range in both systems (Explorer starts
  moving the file; Finder moves it in icon view, and in list view moves it
  only if it is already selected), and a press on a selected file collapses
  the selection on the press rather than on release (revision 13). Mitigated
  by preset verification (Explorer, revision 13; Finder, revision 24) and OS
  matching.
- **Sample**: convenience sample; limits generalisation.
- **Experimenter**: built the system; mitigated by the self-guided flow and no
  hints during tasks.
- **Predicate-system feedback improved during data collection** (revisions
  15 and 23): two notes next to the search box were added after sessions had
  run, the second ("press Enter to keep") after 19 counted sessions and with
  Task C's result known. Both change only the predicate system. Report Task C
  per version and state the change and its evidence in the thesis.
- **Verbal reminders** (before revision 20): Ole reminded some participants,
  but not all, to read the whole task. This is an uneven intervention; the
  reminded attempts are listed and left out in a sensitivity analysis.
- **Practice close to Task C** (revision 8): the merged matching practice
  step (select by one word, remove by another) has the same structure as
  Task C. Participants practise the mechanics on other files and words; the
  readme part of Task C is not practised. H4 is about applying a practised
  feature to a new rule, not about discovering it.
- **Changes after data collection began** (revision 18): H2 was turned from
  directional into a no-difference hypothesis and Task D (H6) was added after
  five counted sessions. The H2 change follows an agreement made before the
  study (Task A as the baseline task), and Task D was added after the earlier
  tasks without changing them, so earlier sessions stay valid for Tasks A–C.
  Still, both are researcher decisions informed by early data; report them
  with dates, and treat H6 as confirmatory only for the sessions from
  `study-3` on.
- **Task D is last** in each block: fatigue and the end-of-block ratings
  may be affected, and Task D always follows Task C. Order is the same in
  both systems, so it does not favour either.
- **Task D tests a behaviour of one baseline**: only the Windows-like preset
  (Explorer) drops the selection; Finder adds the Shift-click range
  (checked in revision 24). With OS matching, Mac participants dilute the
  pooled H6 test; report per preset. Mac sessions before `study-3.6` used an
  unchecked Finder-like preset (⌘-drag added instead of toggling, among
  others; revision 24).
- **Feature reminder** (revision 6): the tools line on the task screen lists
  more tools for the predicate system, which may make it look like "the new
  one" and invites demand effects. It is needed because pilot 1 participants
  forgot the features altogether. Mitigated by listing the tools of both
  systems in the same form, naming no strategy for a task, and neutral system
  names; report it with the tasks. The study then measures the benefit of the
  model for users who know its features, not their discoverability.

---

## 16. Decisions (settled 2026-10-07)

Jaakko could not meet before the study, so Ole settled these to start data
collection, and informed both supervisors by email before the first
participant. Change any of them only before the build is frozen.

1. **Baseline: OS-matched** (macOS users get the Finder-like preset, everyone
   else the Windows-like one). Report results per preset descriptively.
2. **"Show Selected Only" and "(N not visible)": predicate system only.** In the
   traditional system the selection never extends beyond the visible context
   (it is cleared on search and navigation), so the aids have nothing to show.
   The tutorial practises "Show selected only" in every block that has it.
3. **Click scope: global**, as in desktop systems.
4. **No column sorting** in this study; stated as a limitation (Task C).
5. **Subtraction task dropped**; future work. (It was called Task D; since
   revision 18 Task D is "Keep and extend", decision 13.)
6. **Data protection**: the design processes no personal data (no names,
   signatures, contact details, IP addresses, audio, video or screenshots; random
   labels with no key; only OS, language and "knows the experimenter"). UiB
   requires RETTE registration for student projects that process personal
   data, with the supervisor as project manager. Action: run the RETTE check,
   keep its result, and get the supervisors' go-ahead by email before
   recruiting. Keep the free-text comment warning; do not record names or
   appointment times of friends and family (a time plus a name could identify a
   log).
7. **Time handling: soft "Skip task" after 2 min**; practice steps: "Skip this
   step" after 60 s per step.
8. **Stimuli: keep the self-drawn cats and dogs** (both datasets, same
   categories). Reasons: no licence or privacy issues (publishable in the
   thesis, no people), unambiguous at thumbnail size, and D1 and D2 are matched
   in difficulty by construction (same generator), which removes the
   visual-judgement threat in section 15. Cost: less realistic than real
   photos; the study measures selection, not visual search, so this is
   acceptable. Jaakko liked the drawings.
9. **Predicate search stays global**; task folders are designed for it
   (checked by `src/study/__tests__/datasets.test.ts`).
10. **"Exclude" stays hidden** in study mode.
11. **Participants choose English or Norwegian.** The language is logged and
    can be checked as a covariate.
12. **Keep the 10 % exclusion rule for time** as pre-registered and report time
    without it as a sensitivity analysis (current implementation). Task A's
    primary measure is lost pre-selections, which the rule does not affect.
13. **Task A is the baseline task; Task D added** (2026-10-14, revision 18,
    after five counted sessions). H2 becomes a two-sided no-difference
    hypothesis, as agreed earlier with Jaakko; Task D ("Keep and extend")
    tests fragile selection on Shift-click (H6) and runs after Task C. To be
    confirmed with the supervisors by email before the next counted session.
