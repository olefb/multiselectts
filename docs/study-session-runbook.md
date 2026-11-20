# Study session runbook (campus data collection)

Written 2026-10-07 for the first campus day (2026-10-08); updated 2026-10-08
after pilot 1. The protocol is in `docs/study-methodology.md` (revision 6;
decisions in §16, pilot 1 and its changes at the top).

## After pilot 1 (build `study-3`)

Pilot 1 (two sessions, version `study-1`) showed that participants did not use
the predicate features in the tasks. Revision 6 changes the practice, the task
screen and the task wording; revision 7 the ease question (standard wording,
labels beside 1 and 7), the Task B hint (removed), "i mappen Research", and a
1.5 s guard against double-clicks (off again from 2.8); revision 8 merges practice steps (6 instead
of 8); revision 9 puts the Shift-click anchor on the last pre-selected photo in
Task A; revision 10 fixes held clicks on the last rows scrolling the list; revision 11
moves the Task A anchor to the first pre-selected photo; revision 12 fixes Enter right
after typing in «Merk alle treff» (it selected nothing), Select All (now the visible
items, not the whole dataset) and two keyboard bugs; revision 13 makes the Windows-like
preset follow Explorer (Ctrl+Shift-click, Shift-drag from empty space, the first arrow
key); revision 14 writes the practice steps as a goal plus numbered steps; revision 15 adds a
note when a search hides selected files; revision 16 fixes Shift-click after a click in
blank space in the predicate system (it selected nothing); revision 17 makes the photo
subfolders all dogs (Task B: "all the cats in this folder") and keeps the selection on a
slow double-click (click, pause, double-click) on a folder in the predicate system;
revision 18 (`study-3`) adds Task D ("Keep and extend") after Task C and makes Task A the
baseline task in the analysis. The
six `study-1` logs are in
`study-data/pilot-1/` (not counted for group rotation, not analysed).

- [ ] **Try the build yourself:** one G1 and one G3 session with the pilot box
      ticked. Check practice 5 (two files stay selected through «Merk alle
      treff» and «Fjern merking av treff», then the note), the
      outlined controls, the tools line on the task screen, and the numbered
      task steps.
- [ ] **Norwegian read-through** of the new texts: the numbered Task A–C steps,
      all six practice steps (rewritten as numbered steps in revision 14), practice 5's note («Legg
      merke til at …»), and the tools line
      («Verktøy i dette systemet: …»), and the renamed search modes
      «Merk alle treff» / «Fjern merking av treff» (were «Merk treff» /
      «Avmerk treff»), and the note «N merkede filer er skjult av søket, men fortsatt
      merket.» (revision 15).
- [ ] **Norwegian read of Task D**: «1. To av filene med flagg er allerede merket for
      utskrift: behold dem merket. 2. Merk i tillegg de seks andre filene med flagg.» and
      «Deretter kommer fire oppgaver.»
- [ ] **Email Jaakko and Mikhail** about revision 18 before the next counted session.
- [ ] **No verbal reminders during tasks** (from revision 20). Write down the P-IDs and tasks
      of earlier participants you reminded to read the whole task.
- [ ] **Norwegian read of revision 23:** «14 merket – trykk Enter for å beholde» and
      «4 fjernet fra merkingen – trykk Enter for å beholde».
- [ ] **Freeze:** commit, `git tag study-3.8`, `npm run build`. Check in Helium that clicking
      or dragging the scrollbar scrolls without changing the selection, and that a drag from below
      a short (searched) list selects the files it crosses.
- [ ] **Between participants:** from `study-3.4` the browser asks "Leave site?" if the page is
      reloaded during a session. After the debrief (or "Stop the study") it no longer asks. Logs from `study-3` on have
      Task D; earlier logs keep counting for the tutorial and Tasks A–C. From `study-3.1` the
      file list always shows its scrollbar, and from `study-3.2` step numbers are bold:
      check both in Helium before the next session.
- [ ] **Pilot 2:** 1–2 sessions, pilot box ticked. The question is whether
      people now use «Merk alle treff» in Task C. If they do, untick the box and
      start counting.
- [ ] **F11 before every session.** One pilot session ran at 1360×785 (no full
      screen), below the 1280×800 the screens are made for.

## Before pilot 1 (2026-10-07, done)

- [ ] **Try the new build yourself.** `npm run dev`, open
      `http://localhost:5173/?study=1&pilot=1` (pilot box ticked). Do one
      predicate-first session (group G1) and one traditional-first session (G3).
      Check the new practice steps 5 ("List view") and 8 ("Show selected only")
      and the Task B hint.
- [ ] **Email Jaakko and Mikhail** about the decisions (draft in the chat). The
      supervisor is formally responsible for student projects at UiB, so the
      go-ahead should be on record.
- [ ] **RETTE check** (rette.app.uib.no). UiB requires registration only when a
      student project processes personal data; this design doesn't. Save the
      result as a PDF or screenshot for the thesis appendix.
- [ ] **Norwegian read-through** of the new texts: practice 5 and 8, the Task B
      hint, "Hopp over dette steget". Older candidates: «Fjern merking av treff», «Merk
      ingen», «Merkemetoden var god nok for oppgavene».
- [ ] **Decide the retention wording** before anyone consents (see "Open
      questions" below).
- [ ] **Clear `study-data/`.** The 12 small logs there are setup-only (no
      group, so the analysis skips them). Move them aside anyway so the real
      data start clean: `mkdir -p study-data-old && mv study-data/P-*.json study-data-old/`.
- [ ] **Freeze.** Set `version: "study-1"` in `src/study/config.ts`, commit
      everything, `git tag study-1`, then `npm run build`. The setup screen must
      show no "uncommitted changes" warning.
- [ ] **Prepare the laptop:**
  - Power: no sleep, no screen lock, no notifications. Charge it and pack the
    charger.
  - Mouse: external mouse, plus a spare battery if it's wireless.
  - Linux desktop: make sure Alt+drag (moves windows in GNOME) and the
    Super/Windows key (opens Activities) can't disrupt a session. Mac users will
    press the key next to the space bar, which is Alt on a PC keyboard.
    - GNOME: `gsettings set org.gnome.mutter overlay-key ''` and
      `gsettings set org.gnome.desktop.wm.preferences mouse-button-modifier '<Super>'`.
    - Undo afterwards with `gsettings reset` on the same keys.
  - Ctrl key: stick a small label on it saying "⌘ = Ctrl".
  - Offline test: turn Wi-Fi off and run one full pilot session from
    `npm run build && npm run preview`.
  - **`npm run preview` does not build.** It serves whatever is in `dist/`, so a
    stale build silently ignores `?study=1` (the September build predates study
    mode). Rebuild after every change.
  - Viewport: browser zoom 150 % and F11 give 1365×853, which is what the
    setup screen expects. Any warning about the viewport means the zoom or full
    screen changed: fix it before handing over.
    - Use F11, not the setup screen's "Full screen" button. F11 survives the
      reload that "Next participant" does.

## Tomorrow, before the first real participant

1. Start the frozen build with `npm run preview` (built after the last commit), open
   `http://localhost:4173/?study=1` and press F11.
2. **Pilot: 2–3 sessions** with the pilot box ticked (the first passers-by
   count). Watch for these and note them:
   - which practice step makes people hesitate;
   - whether anyone switches to the list *before* selecting the cats in Task B
     (thumbnails in the list are tiny);
   - total time (pilot 1: 15–16 min from consent to the end).
3. `npm run analysis` and look at `analysis-out/tables/` (pilot sessions are
   included in the tables but left out of the statistics). Check that the logs
   are complete and replay without errors.
4. **No changes needed:** carry on with the same build. **A change is
   needed:** fix it, bump `version` (e.g. `"study-2.11"`), commit, tag, rebuild,
   move the earlier logs aside, and note why in the methodology.

## The station

- A table and two chairs in a café or atrium area with foot traffic, not a
  silent reading room. Mix locations so the sample isn't all informatics
  students.
- Angle the screen so the next person in line can't watch. Someone who watched
  a session already knows the tasks.
- Signs: the A4 sign for the table top and the A3 landscape sign for the front
  of the table (Design artifact "Recruitment sign A4"; both say about 15
  minutes, voluntary and anonymous).
- Drinks or snacks for everyone who sits down, finished or not. Have a
  sugar-free option and water. Bring wet wipes for the mouse.

## Per participant (about 17 minutes including the reset)

1. **Approach.** Keep it neutral: don't say that one of the systems is new or
   better (that biases the ratings). *"Du vet når du har markert en haug filer,
   klikker feil én gang, og alt er borte? Jeg sammenligner to måter å markere
   filer på, for å se hva som fungerer best. Det tar et kvarter, det er
   anonymt, og du får noe å drikke."* / *"You know when you've selected a
   bunch of files, click wrong once, and it's all gone? I'm comparing two ways
   of selecting files to see which works better. It takes about 15 minutes,
   it's anonymous, and you get a drink."*
2. **Check verbally:** 18 or older, uses a computer regularly, has used
   Explorer or Finder, is fine with a mouse. Write nothing down.
3. **Setup screen** (before turning the laptop around): no red warnings (a
   viewport warning means F11 or the zoom is off), group shown, pilot box
   **unticked** after the pilots. Click "Hand over".
4. **Say only:** *"Everything is explained on screen: a short practice, then
   a few tasks, twice. Work as you normally would. During the practice you can
   ask me; during the tasks I can't help. You can stop at any time (bottom
   right)."*
   - Mac users: *"This keyboard has no ⌘ key, so use Ctrl."*
5. **During the session:** sit to the side, don't watch over their shoulder,
   don't react.
   - In the practice it's fine to point at the instruction or read it aloud.
   - In a task, the only answer is: *"Do what you would normally do. If you
     get stuck, a Skip button appears after a while."*
6. **At the debrief:** cookie and thanks.
   - Ask: *"Please don't tell friends what the tasks are; they might take part
     too."*
   - Press "Next participant". The log saves and the page reloads with a new
     ID.
   - Glance at the group counts.

## Data rules

- Logs go to `study-data/` automatically, and the status line shows when they
  were saved. If the server is unreachable, use "Save JSON".
- **No names, no photos of people, no time + name notes.** For friends and
  family later, don't keep "Kari at 14:00" anywhere: a time plus a name can
  identify a log.
- Observation notes: the participant ID (P-XXXXXX) and what happened, nothing
  about the person.
- The consent screen says the data are stored only on this laptop. Don't copy
  `study-data/` anywhere unless you change that sentence first (see "Open
  questions").

## Throughput

Pilot 1 took 15–16 minutes from consent to the end (the predicate practice
alone about 5 minutes). With the reset and recruiting gaps, expect 2–3 sessions
an hour, so 32 sessions take about 11–12 hours of running, spread over several
days. Busy times are the quarter hour after lectures end, and lunch.

Recruiting (pilot 1: waiting at a stand brought few people):

- Ask people directly instead of waiting for them to come over.
- Go to people who are already sitting (cafeteria tables after they have
  eaten) and bring the laptop and mouse to them.
- Ask lecturers for a one-minute pitch at the start of a lecture, or post in
  the programme's channels (Discord, Canvas) when and where you will be.
- Ask each participant to send a friend.

If you don't reach 32, family and friends in Odda can fill the rest with the
same laptop and build. The "knows the experimenter" answer covers them, and §14
has a sensitivity analysis for it. Group rotation keeps G1–G4 balanced on its
own.

## If something goes wrong

- **A participant stops:** fine. The session is logged as incomplete and its
  group stays free for the next person.
- **Crash or reload mid-session:** what was saved so far stays in
  `study-data/` as an incomplete session (its finished tasks still count in the
  analysis, and its group stays free). Start a new participant.
- **A real bug:** don't patch the running build between participants. Note
  it. If it invalidates a task, fix it at a break, bump `version`, rebuild, and
  write down from which participant the new version applies.

## Open questions (decide before the first consent)

- **Retention.** The consent says the data are kept "until the thesis has been
  graded, at the latest 1 January 2027". If you and Jaakko might want a paper
  later, change this now. Anonymous data are not personal data, so they can be
  kept, but only if the consent says so. Suggested text: *"…kept for research
  on this topic and may be published in anonymous form."*
- **Backup.** If you want a backup of `study-data/`, say so in the consent
  ("stored on the researcher's computer and an encrypted backup").
