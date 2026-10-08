/**
 * Biology Labs — one spreadsheet for every lab
 * ============================================
 * Copyright (c) 2025-2026 Dr Daniel Mompel Riera
 * Licensed under the GNU Affero General Public License v3.0 (see LICENSE).
 * The teaching material it carries is CC BY-NC-SA 4.0 (see LICENSE-CONTENT).
 * Commercial use needs my permission: dmompelriera@nlcsjeju.kr
 *
 * What this does
 *   • Collects every student's work from every Biology Lab into one Sheet, a tab per lab.
 *     Each lab sends it on its own while they work — there is nothing to hand in.
 *   • Imports your Google Classroom rosters, so the marks sit next to real names
 *     and classes. Re-run it whenever someone joins: it adds, never duplicates.
 *   • Keeps only your own students: work is recorded when the Google account that
 *     signed in is on your roster, and ignored when it is not. The labs are public, so
 *     anyone may use them — their work simply does not land here.
 *   • Formats every tab so it is readable: nothing truncated, nothing too narrow,
 *     frozen headers, filters, banding. Re-apply it any time from the menu.
 *   • Records Bio English Lab too (nlcsbiology.com/bio-english-lab — keywords and answer
 *     writing) in its own tab, "✍️ Bio English", so one teacher page, one roster and one
 *     homework list serve both. See "BIO ENGLISH LAB" at the end of this file.
 *
 * SET UP  (five minutes, once, for every lab)
 *   1. Make one new Google Sheet. The name does not matter.
 *   2. From that Sheet: Extensions ▸ Apps Script. Delete what is there, paste this file in.
 *      You do NOT need to paste any id: the script is inside the Sheet, so it works out
 *      which one it is the first time you run it, and remembers.
 *   3. Three HTML files: + (next to Files) ▸ HTML, three times, each named exactly as below,
 *      and paste in the file of the same name from apps-script/. Save.
 *        ClassroomImport   the window that imports your classes (🎓 in the menu)
 *        Teacher           the teacher page: Spreadsheets, Lab progress, Bio English, Write-Up,
 *                          Students, Set homework, ⏱️ Homework habits
 *        TeacherPage       the window behind 🔗 Add or remove links on the teacher page
 *                          and 👥 Teacher page: teachers and addresses
 *   4. Services (+) ▸ Classroom ▸ Add.        (needed for the roster import)
 *   5. Run ▸ setup. Authorise when asked. It builds and styles every tab.
 *   6. Deploy ▸ New deployment ▸ Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Deploy, copy the /exec URL, and paste it into each lab's js/config.js
 *      as submitUrl. One URL, all labs.
 *      The teacher page is a SECOND deployment of the same code, with
 *        Who has access:  Anyone within your school
 *      — give its /exec address to 👥 Teacher page: teachers and addresses.
 *
 * AFTER ANY EDIT to this file: Deploy ▸ Manage deployments ▸ pencil ▸
 * Version: New version ▸ Deploy, on each of the two deployments. Editing alone changes nothing.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS — the only lines you ever fill in. They are all here, so you never have to
   look for them; the fuller explanation of each is further down, beside the code that uses it.

   A value typed here is copied into Project Settings ▸ Script Properties the first time it is
   read, so pasting a fresh copy of this file over the top later never wipes what you set.
   NEVER type any of these into the copy in the public GitHub repository.
   ═══════════════════════════════════════════════════════════════════════════ */

/* The labs Sheet ("Student data"). You do NOT normally fill this in — the script lives inside the
   Sheet and works out its own id the first time you run it. Paste an id here only to point it at a
   different Sheet. */
var SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';

/* What edition of this script is deployed: shown by the health check (open the /exec address in
   a browser). Change the date when the script changes in a way a teacher should be able to
   confirm has reached the deployment. */
var SCRIPT_EDITION = '8 Oct 2026 (night) — the one-off portRoundsOnce removed';

/* Sign-in — needed for ANY work to be recorded. The OAuth Client ID from Google Cloud: the SAME
   string as `googleClientId` in every lab's js/config.js. It ends .apps.googleusercontent.com. To
   create one, see "Signing in" further down, or the README. Empty = nothing is recorded (the labs
   still work; a student's work simply stays in their own browser). */
var CLIENT_ID = '';

/* The record card on the hub — optional. TRACKER_ID is the id of the "Student Progress Tracker"
   workbook: the long string in its address between /d/ and /edit (NOT an assessment's own
   spreadsheet). SCHOOL_DOMAIN is your school's email domain. Leave both empty and the hub never
   offers the card. See "The reflection record" below. */
var TRACKER_ID     = '';
var SCHOOL_DOMAIN  = '';

/* The teacher page — optional. TEACHERS is other teachers' school addresses, comma-separated (you
   are always in; type "none" to clear the rest). TEACHER_PAGE_URL is the /exec address of the
   teacher-page deployment. You do not have to edit these by hand: 🧪 Biology Labs ▸ 👥 Teacher page: teachers and addresses
   manages both from a window. See "The teacher page" below. */
var TEACHERS          = '';
var TEACHER_PAGE_URL  = '';

/* Open-a-student's-tracker — optional. TRACKER_APP_URL is the /exec address of ANY one of the
   reflection deployments (they all show the same collated tracker). The teacher page's "Students"
   tab uses it: pick a pupil, click, and their own reflection tracker opens — the same page they
   see, which only their teachers may open for them. You do not have to edit this by hand:
   🧪 Biology Labs ▸ 👥 Teacher page: teachers and addresses manages it too. Empty = the Students tab
   still lists every pupil, but says the address is missing and has no Copy or Open tracker buttons. */
var TRACKER_APP_URL   = '';

/* Set homework — optional. HUB_URL is the address of your hub site — the address that serves its
   index.html. Mind the path: a GitHub Pages project site usually sits in a SUB-FOLDER, so it is
   https://nlcsbiology.com/biology-hub (not https://nlcsbiology.com). If in doubt, open
   <that address>/js/data/labs.json in a browser: if it does not load, the address is wrong.
   It is read ONLY to fetch the public station list
   (js/data/stations.json: station names and question counts, nothing personal), which is what lets
   a teacher pick parts of a lab to set. Empty = the Set homework tab says it needs this (Bio English sets can
   still be set). */
var HUB_URL           = '';

/* ---- The reflection record (optional) -------------------------------------
   Separate from the labs, and separate from this Sheet: the Assessment Reflection System
   builds every student a page of their own after each test — scores, weak topics, what to
   revise next.

   Two things about it decide the shape of everything below, and both are easy to get wrong.

   ONE. There is no per-student link. The page is at one address per deployment, and which
   student it shows is decided by the Google account that opens it, checked at the far end.

   TWO. There is no single assessment spreadsheet either. Each assessment gets its OWN
   spreadsheet — its own tabs, its own copy of the reflection script, its own deployment,
   its own address — and a new one is made for the next test. But every one of them writes
   into the SAME workbook: "Student Progress Tracker", in the "Master Tracker" folder. That
   workbook has a tab per cohort and ONE ROW PER STUDENT PER ASSESSMENT, and it is what the
   student's page actually renders from. Which is why every deployment's address shows the
   same page: they are all windows onto that one workbook.

   So this asks the TRACKER, never an individual assessment's spreadsheet. Point it at one
   assessment and the card would know about that test and no other, and would go stale the
   day the next spreadsheet is made. Pointed at the tracker there is nothing to re-point,
   ever.

     TRACKER_ID      the id of the "Student Progress Tracker" workbook — the long string in
                     its address between /d/ and /edit. NOT an assessment's spreadsheet.
     SCHOOL_DOMAIN   your school's email domain, so somebody signing in with a personal
                     account is told that plainly rather than being shown an empty record.

   Type them into SETTINGS at the top of this file, in YOUR Apps Script — that copy is private to your
   Google account. (Or add them in Project Settings ▸ Script Properties; either works.) A value
   typed below is copied into Script Properties the first time it is read — 🩺 Check the
   set-up reads both — so pasting a fresh copy of this file over the top later, with these
   lines blank again, never wipes them. The one place never to type them is the copy in the
   public GitHub repository. Leave both unset and the hub never offers the card; every lab
   goes on working exactly as before.
   -------------------------------------------------------------------------- */

/* ---- The teacher page (optional) ------------------------------------------
   A page for teachers only (Teacher.html), with six tabs:
     Spreadsheets   the address of every assessment spreadsheet — reflections, tests, surveys, the
                    tracker — from the "🔗 Teacher links" tab of this spreadsheet
     Lab progress   every pupil's marks in every built lab
     Bio English    every pupil's progress through the Bio English Lab sets
     Students       the roster (names, classes, school addresses), with a way into each pupil's
                    own reflection tracker
     Set homework   the homework set, and how far each pupil has got with it
     ⏱️ Homework habits  when each pupil finished each homework (against the time it was set and its due time), a
                    habit line for each, and neutral "worth a look" flags; read only (end of this file)
   So it shows the roster and the marks, not only links. On the Biology Hub a teacher in teacher
   mode reaches it through the door where a student finds "My assessments".

   It is guarded twice, and neither guard is anything in the public website:
     1. Google. The page is meant to be opened through a SECOND deployment of this script, whose
        access is "Anyone within" your school, so Google signs the visitor in with their school
        account before a line of this script runs. A sign-in copied out of a web page is no use
        there: what opens it is Google's own sign-in, which no page can read. (doGet serves the page
        on the public labs deployment too, and there this first guard does not apply.)
     2. This script, on either deployment. It asks Google who is visiting and shows the page only to
        a teacher on the list (👩‍🏫 Teachers, or TEACHERS below) — and to you, the owner, always.
        Everybody else, pupils and other staff alike, is told who the page is for and sees nothing
        more, and every read and write the page makes checks again (_hwCaller_).
   The links live in a tab of THIS spreadsheet, "🔗 Teacher links", so only the people you have
   shared this spreadsheet with can see or change them.

     TEACHERS          other teachers' school addresses, separated by commas. Type  none  to take
                       everybody but you off (an empty line keeps the list you saved before).
     TEACHER_PAGE_URL  the /exec address of that second deployment. The hub is handed it only when
                       a signed-in teacher on the list asks; it is never written into the website.

   🧪 Biology Labs ▸ 🔗 Add or remove links on the teacher page makes the tabs, and 👥 Teacher page: teachers and
   addresses sets the rest. Like TRACKER_ID, a value typed in SETTINGS at the top is kept in Script Properties,
   and neither belongs in the public GitHub copy.
   -------------------------------------------------------------------------- */

/* Every lab that saves here, one per topic. `id` is what the site sends as `app`; `name` is the
   tab it is written to. The Labs tab shows exactly these rows: every Tidy up writes it afresh from this list.
   `questions` MUST match what the lab actually asks — it flags a save as NOT ALL
   QUESTIONS, so a number that is too low flags every save. 0 means the lab is not built yet: its
   Students column is styled "not built yet", and 🩺 Check the set-up does not count it as built.
   The counts are kept in labs-shared/labs.json, written by each lab's own build. */
var LABS = [
  { id:'classification-lab',  name:'Classification',   topic:'1 · Characteristics and classification', questions:64 },
  { id:'cells-lab',           name:'Cells',            topic:'2 · Organisation of the organism',   questions:103 },
  { id:'cell-transport-lab',  name:'In and out of cells', topic:'3 · Movement into and out of cells', questions:0 },
  { id:'molecules-lab',       name:'Molecules',        topic:'4 · Biological molecules',           questions:0 },
  { id:'enzymes-lab',         name:'Enzymes',          topic:'5 · Enzymes',                        questions:0 },
  { id:'digestion-lab',       name:'Digestion',        topic:'7 · Human nutrition',                questions:123 },
  { id:'circulation-lab',     name:'Circulation',      topic:'9 · Transport in animals',           questions:115 },
  { id:'immunity-lab',        name:'Immunity',         topic:'10 · Diseases and immunity',         questions:0 },
  { id:'gas-exchange-lab',    name:'Gas exchange',     topic:'11 · Gas exchange in humans',        questions:0 },
  { id:'respiration-lab',     name:'Respiration',      topic:'12 · Respiration',                   questions:0 },
  { id:'excretion-lab',       name:'Excretion',        topic:'13 · Excretion in humans',           questions:0 },
  { id:'coordination-lab',    name:'Coordination',     topic:'14 · Coordination and response',     questions:0 },
  { id:'drugs-lab',           name:'Drugs & AMR',      topic:'15 · Drugs',                         questions:0 },
  { id:'reproduction-lab',    name:'Reproduction',     topic:'16 · Reproduction',                  questions:0 },
  { id:'plants-lab',          name:'Plants',           topic:'6 · Plants: 6, 8, 14.5, 16.3, 18.2', questions:116 },
  { id:'inheritance-lab',     name:'Inheritance',      topic:'17 · Inheritance',                   questions:0 },
  { id:'variation-lab',       name:'Variation',        topic:'18 · Variation and selection',       questions:0 },
  { id:'ecology-lab',         name:'Ecology',          topic:'19 · Organisms and their environment', questions:0 },
  { id:'human-influences-lab', name:'Human influences', topic:'20 · Human influences on ecosystems', questions:0 },
  { id:'biotechnology-lab',   name:'Biotechnology',    topic:'21 · Biotechnology and genetic modification', questions:0 }
];

var T_SETUP = 'Setup', T_LABS = 'Labs', T_STUDENTS = 'Students', T_REJECTED = 'Rejected';

/* A lab's tab, described once. Every student gets a row when they are imported; the
   columns after Class stay empty until their first save arrives. */
var LAB_COLS = [
  { h:'Name', w:200, note:'From the Students tab. Everyone gets a row here when they are imported, whether anything has been saved or not. To correct a name, correct it there.' },
  { h:'Class', w:80, align:'center', note:'From the Students tab. Move somebody between classes there and it follows them into every lab. "LEFT 2027": in none of your classes (marked in the import window, or with Move on the teacher page); their work stays here.' },
  { h:'Score', w:76, align:'center', fmt:'0', group:true, note:'Their best score in this lab. Blank means nothing has been saved yet.' },
  { h:'Out of', w:76, align:'center', fmt:'0', note:'How many questions the lab asked.' },
  { h:'%', w:78, align:'center', fmt:'0.0%', note:'Their best score as a percentage.' },
  { h:'Finished?', w:104, align:'center', list:['complete', 'progress'],
    note:'complete — every question right.\nprogress — saved part way through; the work so far.' },
  { h:'Checks', w:86, align:'center', fmt:'0', group:true, note:'How many times they pressed Check answer, in all. This is the evidence of the work.' },
  { h:'Right first time', w:124, align:'center', fmt:'0', note:'How many questions they got right at the first attempt. Separates knowing it from working it out.' },
  { h:'Working since', w:116, align:'center', note:'How long before their best save they first checked anything.' },
  { h:'Saves', w:90, align:'center', fmt:'0', group:true, note:'How many saves have landed here. The lab sends one on its own every couple of minutes while they work, and when they finish or leave — nothing is handed in. Every save updates this row rather than adding one.' },
  { h:'Last saved', w:132, fmt:'dd MMM, HH:mm', note:'When their work last arrived — even if an earlier save scored higher.' },
  { h:'Code', w:126, align:'center', group:true, hide:true, note:'No longer used. Completion codes were retired in September 2026: the lab saves on its own, so there is nothing to hand in and nothing to check. Old codes stay here for the record.' },
  { h:'Flags', w:230, note:'Anything worth a second look.' },
  { h:'Per station', w:460, note:'Their score at each station, and how many checks it took there.' },
  { h:'School email', w:230, hide:true, note:'What ties this row to the student. Do not edit.' },
  { h:'Signed in as', w:200, hide:true, note:'The name on the Google account they signed in with. Kept so a row can be told apart from a namesake on the Students tab.' },
  { h:'Carried between devices', w:200, hide:true,
    note:'The questions on the page now (this round), so signing in on another computer brings their work back. About 370 characters, written by the lab. Not marks — the marks are in the columns you can see. Do not edit.' },
  /* Goes (September 2026; "rounds" to the people who read them): a student can start a station again
     (Start this station again, or Reset). The page empties; the record does not. Appended, so every column
     above keeps its position. */
  { h:'Practised again', w:300,
    note:'Stations they started again (Start this station again, or Reset), so they could try the questions again. Nothing is lost: Score, %, Per station and homework keep their best, and Right first time stays from their FIRST round.\n\n"Round 2 in 3 stations: 15 tried, 13 right, 30 checks · reset the whole lab 2× · failed again: The mouth Q3" — three stations reached a 2nd round; in it they answered 15 questions, 13 of them right, with 30 presses of Check; they pressed Reset twice; question 3 of the mouth was not right at the first check in round 1, nor in a later round. (A row whose last save came before 7 Oct 2026 still reads the old way: "mouth: round 2, 5/8".)' },
  { h:'First round', w:200, hide:true,
    note:'Every question as they answered it in their FIRST round: 0 not touched, t tried, 1 right after more tries, f right first time. Right first time and My assessments read this. Written by the lab. Do not edit.' },
  { h:'Best ever', w:200, hide:true,
    note:'The best each question has ever been, in any round, in the same letters. Written by the lab. Do not edit.' },
  /* ⏱️ Homework habits (1 Oct 2026): written by each save, inside the same write. Appended, so every column above keeps
     its position (the reflection's My assessments reads columns 15, 17, 19 and 20 by position). */
  { h:'Station times', w:200, hide:true,
    note:'When each station was first tried, and when it was first finished, as their saves arrived. Kept from the first save after this column appeared; a first time is never changed. The teacher page’s ⏱️ Homework habits reads it. Not marks. Do not edit.' },
  /* Rounds and checks (7 Oct 2026): every round of every station, small, with the checks at each question in each round,
     and how often the whole lab was reset. Appended, so every column above keeps its position. */
  { h:'Rounds', w:200, hide:true,
    note:'Every round of every station they practised, kept small. Each round: each question as 0 not touched, t tried, 1 right after more tries, f right first time; then, after the dot, how many times they pressed Check at each question in that round (0–9, then a = 10, b = 11 … z = 35 or more). "#2" at the start: they reset the whole lab twice. The teacher page’s Lab progress reads it. Written by the lab. Not marks. Do not edit.' }
];
var LAB_EMAIL = 15;
var LAB_GNAME = 16;        /* the column that ties a row to a person */
var LAB_SNAP  = 17;        /* appended, so the two above keep their positions */
var LAB_AGAIN = 18;        /* goes, Sept 2026 — appended again, for the same reason */
var LAB_FIRST = 19;
var LAB_BEST  = 20;
var LAB_TIMES = 21;        /* ⏱️ Homework habits (1 Oct 2026): appended again, for the same reason */
var LAB_ROUNDS = 22;       /* rounds and checks (7 Oct 2026): appended again, for the same reason */

/* ---- Signing in ----------------------------------------------------------
   The labs are public web pages: anyone in the world can open one and work through it.
   That is the point — but their work must not land in your spreadsheet.
   So work is kept only when the Google account that signed in is on your Students tab.
   Everyone else's stays in their own browser and nothing is written down.

   A Client ID is a name-tag for your app, issued by Google. It is not a secret — it sits
   in plain sight in the page source. The lab page uses it to ask Google for a sign-in; this
   script uses it to check the token it gets back was made for YOUR app and not somebody
   else's. Same string in both places, or nothing is recorded.

   To get one (about five minutes, free):
     console.cloud.google.com ▸ pick or make a project
     ▸ Google Auth Platform ▸ Branding — fill this in FIRST, Google will not issue an id
       without it. User type External, then Audience ▸ Publish app. Left on "Testing",
       your students are told the app is blocked.
     ▸ Credentials ▸ Create credentials ▸ OAuth client ID ▸ Web application
       Authorised JavaScript origins:  https://nlcsbiology.com
       (no path, no trailing slash. Leave redirect URIs empty.)
     Create, then copy the Client ID (it ends .apps.googleusercontent.com) into BOTH
     places: SETTINGS at the top, and googleClientId in every lab's js/config.js.
     The full version of this is in the hub's README, under "Step 3 · Switch on sign-in".

   Leave it empty and nothing is recorded at all — the labs still work, and every
   student's work stays in their own browser.
   -------------------------------------------------------------------------- */

/* Pasting a fresh copy of this file used to wipe the Client ID you had typed, and every
   save then came back "not recorded: sign-in is not set up" — silently, until a mark went
   missing. So it is remembered the same way SHEET_ID is: fill it in SETTINGS at the top once, and from
   then on an empty line means "use the one you remembered", not "forget it". */
function _clientId_() {
  var props;
  try { props = PropertiesService.getScriptProperties(); } catch (e) { return CLIENT_ID; }
  if (CLIENT_ID) {
    try { if (props.getProperty('CLIENT_ID') !== CLIENT_ID) props.setProperty('CLIENT_ID', CLIENT_ID); }
    catch (e) {}
    return CLIENT_ID;
  }
  return props.getProperty('CLIENT_ID') || '';
}

/* House colours, so the Sheet looks like the labs it collects. */
var INK = '#14572B', INK_SOFT = '#E4EFE7', LINE = '#C9D8CD', WARN = '#B8860B', BAD = '#B03A2E';

/* ============================================================
   The menu
   ============================================================ */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🧪 Biology Labs')
    .addItem('🎓  Import students from Classroom…', 'showClassroomImport')
    .addItem('🩺  Check the set-up', 'checkSetup')
    .addSeparator()
    .addItem('📊  Refresh everyone\'s progress', 'refreshDashboard')
    .addItem('🎨  Tidy up  (rebuild anything missing, re-apply the formatting)', 'setup')
    .addSeparator()
    .addItem('🔗  Add or remove links on the teacher page (tests, reflections, surveys)…', 'showTeacherPanel')
    .addItem('🔎  Find new reflection and test spreadsheets', 'findSpreadsheetsMENU_')
    .addItem('👥  Teacher page: teachers and addresses…', 'showTeacherSetup_')
    .addItem('🤝  Let the teachers on the list edit this spreadsheet…', 'shareWithTeachersMENU_')
    .addItem('📬  Email me when homework falls due (every morning)', 'installDailySummary')
    .addSeparator()
    .addItem('🔑  Make every pupil sign in again (cancel their saving passes)…', 'newPassSecretMENU_')
    .addToUi();
}

/* ============================================================
   1. Receiving a student's work — the lab sends it on its own
   ============================================================ */
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);

    /* The hubs ask for a student's own scores back, so a cleared browser or a new device does
       not start from nothing. Handled before anything else, and it only ever reads. */
    if (String(d.action || '') === 'progress') return _ownProgress_(d);

    /* A page with a fresh Google sign-in asks for this script's own pass, so its saves still go after Google's hour
       (6 Oct 2026; _ownPass_). It only ever gives the caller their own. */
    if (String(d.action || '') === 'pass') return _ownPass_(d);

    /* And whether they have a reflection record waiting for them. Also read-only, also
       only ever their own. */
    if (String(d.action || '') === 'record') return _ownRecord_(d);

    /* And when their own test opens, and the way in. Read-only, their own only. */
    if (String(d.action || '') === 'test') return _ownTest_(d);

    /* Bio English Lab saves a pupil's work as they go, and asks for it back on another computer.
       Neither is lab work, so both are answered here, before anything treats this as a lab. */
    if (String(d.action || '') === 'english.save') return _englishSave_(d);
    if (String(d.action || '') === 'english.mine') return _englishMine_(d);

    /* The Write-Up Lab the same way (3 Oct 2026): its parts saved as a pupil works, and asked for back. */
    if (String(d.action || '') === 'writeup.save') return _writeupSave_(d);
    if (String(d.action || '') === 'writeup.mine') return _writeupMine_(d);

    var lab = _labById_(String(d.app || ''));
    if (!lab) return _text_('unknown lab');

    /* Only this teacher's students are recorded. Anyone else in the world who works through
       a lab leaves no trace here at all — no row, no name, no email, nowhere. */
    if (!_clientId_()) return _text_('not recorded: sign-in is not set up');
    var who = _whoSaving_(d);                     /* Google's sign-in, or this script's pass once Google's hour is up */
    if (!who) return _text_('not recorded: not signed in');
    var student = _studentOf_(who.email), readAt = Date.now();
    /* The list is matched on the EMAIL column, never on the name. Adding a name and no
       address looks like being on the list and is not, so the address is named back. */
    if (!student) {
      var onList = Math.max(0, _sheet_(T_STUDENTS).getLastRow() - 1);
      return _text_('not recorded: not on this class list (' + who.email +
                   '; ' + onList + ' on the list)');
    }

    var score = Number(d.score) || 0, total = Number(d.total) || 0;

    /* Completion codes were retired in September 2026 (a keyless checksum the page itself
       computed proved nothing). What is checked is that the numbers add up. */
    var wrong = [];
    if (score > total) wrong.push('score above the total');
    if (total < 0 || total > 1000) wrong.push('impossible total');
    if (wrong.length) {
      _reject_(lab, [new Date(), lab.id, student.name, student.cls, score, total, _plain_(String(d.code || '').slice(0, 60)),
                    wrong.join('; '), _plain_(JSON.stringify(d, _noCredentials_).slice(0, 2000))]);
      return _text_('rejected: ' + wrong.join('; '));
    }

    /* Their row is already waiting, put there when the class was imported. The first save
       fills it in; every later one updates it rather than adding another. The count and the
       date always move. Nothing a teacher reads ever goes DOWN:
         · the three records — this go, first go, best ever — are MERGED, never replaced
           (_snapMerge_), so a save from a device that knows less cannot take a right answer
           away, and a student who practises a station again (a new go) loses nothing;
         · Per station keeps each station at its best, and Score is their sum — replaced only
           when it goes up, so a worse run can never wipe out a better score;
         · Checks keeps the most any save has counted; Right first time comes from the FIRST
           go, so practising again can never make it look better.
       Forty students save within the same minute, so the read-then-write takes turns — and it
       is one read and one write of the row, so a turn is short. */
    /* ⏱️ Homework habits: the station list the homework scorer reads, fetched BEFORE the queue (cached; no sheet is
       read), so a save's turn is no longer than it was. Never a reason for a save to fail. */
    var stMan = null;
    try { var stM0 = _manifest_(); stMan = { labs: (stM0 && stM0.labs) || {} }; } catch (eM) { stMan = null; }
    var lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (e) { return _text_('busy — it will try again'); }
    try {
      var sh = _labSheet_(lab);                              /* adds any column a newer script needs */
      var lastBefore = sh.getLastRow();
      var r = _rowFor_(sh, who.email, student);
      var row = sh.getRange(r, 1, 1, LAB_COLS.length).getValues()[0];
      var was = Number(row[2]);
      var seen = Number(row[9]) || 0;
      var perBefore = row[13];                              /* Per station before this save (⏱️ Homework habits) */

      student = _freshStudent_(who.email, student, readAt);   /* a Move or Left done while this save waited for the lock */
      row[0] = student.name; row[1] = student.cls;
      row[LAB_GNAME - 1] = _plain_(who.name);
      row[9] = seen + 1; row[10] = new Date();

      /* a page from before goes: it sends no `first` or `best`, and never a later go ("@2") */
      var oldPage = !('first' in d) && !('best' in d) && !/@\d/.test(String(d.snap || ''));
      var hereBefore = String(row[LAB_SNAP - 1] || '');
      var got = _snapMerge_(hereBefore, String(row[LAB_FIRST - 1] || ''), String(row[LAB_BEST - 1] || ''),
                            String(d.snap || '').slice(0, 45000), String(d.first || '').slice(0, 45000), String(d.best || '').slice(0, 45000), oldPage);
      row[LAB_SNAP - 1] = _plain_(got.here);
      row[LAB_FIRST - 1] = _plain_(got.first);
      row[LAB_BEST - 1] = _plain_(got.best);
      /* every round and the checks in it (7 Oct 2026): merged like the letters, never replaced. A page from before sends
         no rounds: its Per station counts are then kept as each station's least; and until some station's rounds are here,
         Practised again is said from the letters, as before. */
      var rounds = _roundsMerge_(row[LAB_ROUNDS - 1], d.rounds, d.resets, d.stations, String(d.snap || ''));
      row[LAB_ROUNDS - 1] = _plain_(rounds.cell);
      row[LAB_AGAIN - 1] = _plain_(rounds.kept ? _roundsSay_(rounds.P, _stationNamesOf_(stMan, lab.id), got.here, rounds.current) : _practisedAgain_(got.here));

      var per = _stationsBest_(row[13], d.stations, got.best, rounds.by);
      var now = per.named ? Math.max(score, per.done) : score;
      if (total) now = Math.min(now, total);
      var beaten = !(was > 0) || now > was;
      if (per.named) row[13] = _plain_(per.text);
      if (beaten) {
        var flags = [];
        if (lab.questions && total !== lab.questions) flags.push('NOT ALL QUESTIONS');
        if (!(total && now >= total)) flags.push('PROGRESS — not finished');
        row[2] = now; row[3] = total; row[4] = total ? now / total : 0;
        row[5] = total && now >= total ? 'complete' : 'progress';
        row[8] = _since_(d.from);
        row[12] = flags.join('; ');
        if (!per.named) row[13] = _plain_(_stations_(d.stations));
      }
      row[6] = Math.max(Number(row[6]) || 0, Number(d.checks) || 0, rounds.total) || '';   /* every round's checks */
      /* an old page's own count is its first go only while no station here has gone past go 1 */
      var sentFirst = oldPage && /@\d/.test(hereBefore) ? 0 : Number(d.firstTime) || 0;
      row[7] = Math.max(Number(row[7]) || 0, _snapCount_(got.first, 'f'), sentFirst) || '';
      /* ⏱️ Homework habits: when each station was first tried and first finished, by the homework scorer's own rule,
         written in this same write. Never a reason for a save to fail: if anything goes wrong the cell stays as it was. */
      try {
        row[LAB_TIMES - 1] = _stNext_(row[LAB_TIMES - 1], _stLabState_(lab.id, who.email, perBefore, stMan),
                                      _stLabState_(lab.id, who.email, row[13], stMan), +row[10]);
      } catch (eT) {}
      sh.getRange(r, 1, 1, LAB_COLS.length).setValues([row]);
      if (r > lastBefore) _dressRows_(sh, LAB_COLS, r, 1);   /* a row made just now is dressed once, as Tidy up would */
      SpreadsheetApp.flush();                                 /* committed before the next save reads this row */
      return _text_(beaten ? 'recorded' : 'recorded (an earlier save still scores higher)');
    } finally { lock.releaseLock(); }
  } catch (err) {
    /* The message is kept, because it is what a student can show their teacher — but not any
       file id inside it ("…while accessing document with id 1AbC…"): those stay private. */
    return _text_('error: ' + String(err).replace(/[A-Za-z0-9_-]{25,}/g, '…'));
  }
}

/* ── Goes (September 2026) ────────────────────────────────────────────────────────────────────────
   Daniel: "they have to be able to reset … but the teacher needs to be able to see the students have done
   the work", and "progress … adds; that should never happen" (a save erasing what was recorded).
   A station's record, as the labs write it (labs-shared/engine/sync.js):
       station~<count>:<hash>:<letters>[@<go>]      one letter per question: 0 untouched, t tried,
                                                     1 right after more tries, f right first time
   The fingerprint ("<count>:<hash>") holds a colon of its own, so a part is split on its LAST colon.
   Until 27 Sep 2026 this script split on the first, matched nothing, and every save REPLACED the stored
   answers — the tests missed it because their fingerprints had no colon.
   Each lab row keeps three records, merged by the same rules as the lab itself:
       this go   (LAB_SNAP)   the higher go wins; within a go, each question keeps its better state
       first go  (LAB_FIRST)  every go-1 record ever seen, each question its better state
       best ever (LAB_BEST)   everything, each question its better state
   A station whose fingerprint changed takes the newer record (the one the live lab made). An old page
   (no goes) sends go 1 only: it adds to the best, and never undoes a newer go. It adds to the first go only
   while that station is still on go 1: past it, its letters may be a later go's, pulled and sent back. */
var SNAP_RANK = { '0': 0, 't': 1, '1': 2, 'f': 3 };
function _snapParse_(snap) {
  var out = { order: [], by: {} };
  String(snap || '').split('|').forEach(function (part) {
    var colon = part.lastIndexOf(':'), tilde = part.indexOf('~');
    if (colon < 0 || tilde < 1 || tilde > colon) return;
    var id = part.slice(0, tilde), m = part.slice(colon + 1).match(/^([01tf]{0,500})(?:@(\d{1,4}))?$/);
    if (!m || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(id) || out.by[id]) return;
    out.by[id] = { sig: part.slice(tilde + 1, colon).slice(0, 60), q: m[1], go: m[2] ? Math.max(1, parseInt(m[2], 10)) : 1 };
    out.order.push(id);
  });
  return out;
}
function _snapMax_(a, b) {
  var out = '', len = Math.max(a.length, b.length);
  for (var i = 0; i < len; i++) {
    var x = a.charAt(i) || '0', y = b.charAt(i) || '0';
    out += (SNAP_RANK[y] || 0) > (SNAP_RANK[x] || 0) ? y : x;
  }
  return out;
}
/* Fold parsed records into `into`. mode 'this': go-aware; 'max': each question its better state;
   'go1': like 'max', for go-1 records only. `fresh`: on a changed fingerprint, these replace. */
function _snapFold_(into, from, mode, fresh, skip) {
  from.order.forEach(function (id) {
    var x = from.by[id];
    if (mode === 'go1' && x.go !== 1) return;
    if (skip && skip[id]) return;
    var go = mode === 'this' ? x.go : 1, have = into.by[id];
    if (!have) { into.by[id] = { sig: x.sig, q: x.q, go: go }; into.order.push(id); return; }
    if (have.sig !== x.sig) { if (fresh) into.by[id] = { sig: x.sig, q: x.q, go: go }; return; }
    if (mode === 'this' && go !== have.go) { if (go > have.go) { have.go = go; have.q = x.q; } return; }
    have.q = _snapMax_(have.q, x.q);
  });
  return into;
}
function _snapJoin_(p) {
  return p.order.map(function (id) { var x = p.by[id]; return id + '~' + x.sig + ':' + x.q + (x.go > 1 ? '@' + x.go : ''); }).join('|');
}
/* The three stored records and the three a save sends, folded: { here, first, best }. `oldPage`: the save came
   from a page from before goes (it sends no `first` or `best`). Its letters are all go 1 to it, but they may be
   another computer's later go, pulled and sent back; so for a station already past go 1 they count for the
   best only, never for the first go. */
function _snapMerge_(hereOld, firstOld, bestOld, hereNew, firstNew, bestNew, oldPage) {
  var H0 = _snapParse_(hereOld), F0 = _snapParse_(firstOld), B0 = _snapParse_(bestOld);
  var H1 = _snapParse_(hereNew), F1 = _snapParse_(firstNew), B1 = _snapParse_(bestNew);
  var E = function () { return { order: [], by: {} }; };
  var past = {};
  if (oldPage) H0.order.forEach(function (id) { if (H0.by[id].go > 1) past[id] = true; });
  var here = _snapFold_(_snapFold_(E(), H0, 'this', false), H1, 'this', true);
  var first = E();
  [[F0, 'max', false], [H0, 'go1', true], [F1, 'max', true]].forEach(function (f) { _snapFold_(first, f[0], f[1], f[2]); });
  _snapFold_(first, H1, 'go1', true, past);
  var best = E();
  [[B0, false], [F0, true], [H0, true], [F1, true], [H1, true], [B1, true]].forEach(function (f) { _snapFold_(best, f[0], 'max', f[1]); });
  return { here: _snapJoin_(here), first: _snapJoin_(first), best: _snapJoin_(best) };
}
/* What a page from before goes is given as its record: each station's go-1 letters, and for a station on go 2
   or later its FIRST go (left out when there is none to give). Never a later go's letters: such a page cannot
   read "@2", takes them for its own go 1 and sends them back. */
function _snapForOldPages_(here, first) {
  var H = _snapParse_(here), F = _snapParse_(first), out = [];
  H.order.forEach(function (id) {
    var x = H.by[id];
    if (x.go === 1) { out.push(id + '~' + x.sig + ':' + x.q); return; }
    var f = F.by[id];
    if (f && f.sig === x.sig) out.push(id + '~' + f.sig + ':' + f.q);
  });
  return out.join('|');
}
/* Kept for the tests of the one-record days: this go, merged. */
function _mergeSnap_(oldSnap, newSnap) { return _snapMerge_(oldSnap, '', '', newSnap, '', '').here; }
/* How many questions, over every station, carry this letter (or, for 'right', 1 or f). */
function _snapCount_(snap, what) {
  var p = _snapParse_(snap), n = 0;
  p.order.forEach(function (id) {
    var q = p.by[id].q;
    for (var i = 0; i < q.length; i++) if (what === 'right' ? (q.charAt(i) === '1' || q.charAt(i) === 'f') : q.charAt(i) === what) n++;
  });
  return n;
}
/* "mouth: round 2, 5/8 · stomach: round 3, 9/9" — each station on a second round or later, and how it stands. */
function _practisedAgain_(here) {
  var p = _snapParse_(here), out = [];
  p.order.forEach(function (id) {
    var x = p.by[id]; if (x.go < 2) return;
    var n = 0; for (var i = 0; i < x.q.length; i++) if (x.q.charAt(i) === '1' || x.q.charAt(i) === 'f') n++;
    out.push(id + ': round ' + x.go + ', ' + n + '/' + x.q.length);
  });
  return out.join(' · ').slice(0, 900);
}
/* Each station at its best: the higher of what the row's Per station said, what this save says and what
   the best-ever record holds, so a station practised again never shows less than was done before. The
   stations this save names come first, in the lab's own order (every lab sends its whole list), and Score is
   THEIR sum; a station only the row still names is kept after them, never dropped. `named` is false for a
   save that names no station, and then nothing here is used. Returns { text (Per station), done, named }. */
function _stationsBest_(stored, sent, bestSnap, roundsBy) {
  var by = {}, named = [], rest = [];
  var okId = function (id) { return /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(id); };
  if (sent && typeof sent === 'object' && !Array.isArray(sent)) Object.keys(sent).forEach(function (id) {
    var m = String(sent[id]).match(/^\s*(\d+)\/(\d+)(?:\s+in\s+(\d+))?\s*$/);
    if (!m || !okId(id) || by[id] || named.length >= 40) return;
    by[id] = { done: +m[1], total: +m[2], checks: m[3] ? +m[3] : 0 };
    named.push(id);
  });
  if (!named.length) return { text: '', done: 0, named: false };
  _parseStations_(stored).forEach(function (s) {
    var x = by[s.name];
    if (!x) { if (!okId(s.name)) return; by[s.name] = { done: s.done, total: s.total, checks: s.checks }; rest.push(s.name); return; }
    x.done = Math.max(x.done, s.done); x.checks = Math.max(x.checks, s.checks);
  });
  var b = _snapParse_(bestSnap);
  b.order.forEach(function (id) {
    var x = by[id]; if (!x) return;
    var q = b.by[id].q, n = 0;
    for (var i = 0; i < q.length; i++) if (q.charAt(i) === '1' || q.charAt(i) === 'f') n++;
    x.done = Math.max(x.done, n);
  });
  var o = {}, done = 0;
  named.concat(rest).forEach(function (id, k) {
    var x = by[id];
    if (roundsBy && roundsBy[id] > x.checks) x.checks = roundsBy[id];   /* every round's checks (7 Oct 2026) */
    if (x.total) x.done = Math.min(x.done, x.total);
    if (k < named.length) done += x.done;
    o[id] = x.done + '/' + x.total + (x.checks ? ' in ' + x.checks : '');
  });
  return { text: _stations_(o), done: done, named: true };
}

/* ── Rounds and checks (7 Oct 2026) ────────────────────────────────────────────────────────────────
   Daniel: "round one should show how they did in round one, how they did in round two, in a summarised way"; "a total
   checks per question, no matter the number of rounds, and per round"; how often they reset the whole lab; and keep it
   small ("over time we're going to be storing a lot of information"). One hidden cell per lab row (LAB_ROUNDS), sent by
   the labs (labs-shared/engine/sync.js, roundsSnapshot) and merged here by the same rules:
       #<resets>|<station>~<count>:<hash>:[^F;][+U;]<round 1>;<round 2>;…;<the round on the page>|…
   A round is <letters>.<checks>[*k]: the letters of the other records, one per question; then the Checks pressed at each
   question in it, one character each, base 36 (0–9, a = 10 … z = 35 or more); "*k" when k rounds are folded into one.
   Round 1 and the newest seven rounds are kept one by one and the ones between folded together (RND_KEPT), so a row never
   grows without end. A round may be '' (it happened; its answers were never sent: a page from before 7 Oct 2026), its
   letters '' (".*6": six such rounds, folded) or its checks '' (not counted by question). A round is found by counting k
   from round 1, never by its place in the list, which folding changes.
       +U   checks no question can be given: made before rounds were kept, or past the 35 one character holds
       ^F   at least this many: the station's checks in Per station when this cell began (the one-off port of 7 Oct 2026,
            or a page from before rounds), so a total here is never lower than the sheet said before
   A station's checks: the larger of F and U + every round's checks. Merged question by question — each round its further
   letter and its larger count — never added, so a save that arrives twice counts once; resets by the larger count. A
   station rewritten since keeps its old part under its old fingerprint, whole (it was shrunk to its total until the
   second audit, 7 Oct 2026: a stale page and the live one then undid each other's rounds); its checks count beside the
   new part's. */
var RND_KEPT = 10, RND_B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
function _rTok_(t) {
  var m = String(t == null ? '' : t).match(/^([01tf]{0,500})\.([0-9a-z]{0,500})(?:\*(\d{1,4}))?$/);
  return m ? { l: m[1], c: m[2], k: m[3] ? Math.max(1, +m[3]) : 1, known: true } : { l: '', c: '', k: 1, known: false };
}
function _rStr_(x) { return x.known ? x.l + '.' + x.c + (x.k > 1 ? '*' + x.k : '') : ''; }
function _rN_(ch) { var i = RND_B36.indexOf(String(ch || '')); return i < 0 ? 0 : i; }
function _rC_(v) { v = Math.floor(Number(v) || 0); return RND_B36.charAt(v < 0 ? 0 : v > 35 ? 35 : v); }
function _rSum_(c) { var t = 0; c = String(c || ''); for (var i = 0; i < c.length; i++) t += _rN_(c.charAt(i)); return t; }
function _rMaxC_(a, b) { var o = '', n = Math.max(a.length, b.length); for (var i = 0; i < n; i++) o += _rC_(Math.max(_rN_(a.charAt(i)), _rN_(b.charAt(i)))); return o; }
/* two copies of the same round(s): the further letter, the larger count, question by question */
function _rMergeTok_(a, b) {
  var A = _rTok_(a), B = _rTok_(b);
  if (!A.known) return _rStr_(B);
  if (!B.known) return _rStr_(A);
  return _rStr_({ known: true, l: (A.l || B.l) ? _snapMax_(A.l, B.l) : '', c: (A.c || B.c) ? _rMaxC_(A.c, B.c) : '', k: Math.max(A.k, B.k) });
}
/* several rounds as one: letters at their best, checks added (past 35 → `over`, so the total loses nothing) */
function _rFold_(list, over) {
  var f = null;
  list.forEach(function (t) {
    var x = _rTok_(t);
    if (!f) { f = { known: true, l: x.l, c: x.c, k: x.k }; return; }
    var c = '', n = Math.max(f.c.length, x.c.length);
    for (var i = 0; i < n; i++) { var s = _rN_(f.c.charAt(i)) + _rN_(x.c.charAt(i)); if (s > 35 && over) over.n += s - 35; c += _rC_(s); }
    f.l = (f.l || x.l) ? _snapMax_(f.l, x.l) : ''; f.c = (f.c || x.c) ? c : ''; f.k += x.k;
  });
  return f ? _rStr_(f) : '';
}
function _rSpan_(list) { var t = 0; list.forEach(function (x) { t += _rTok_(x).k; }); return t; }
function _rTotal_(v) { var t = v.U; v.list.forEach(function (x) { t += _rSum_(_rTok_(x).c); }); return Math.max(v.F, t); }
function _rParse_(cell) {
  var P = { resets: 0, order: [], by: {} };
  String(cell == null ? '' : cell).split('|').forEach(function (part) {
    var h = part.match(/^#(\d+)$/);
    if (h) { P.resets = Math.max(P.resets, Math.min(+h[1], 999)); return; }
    var colon = part.lastIndexOf(':'), tilde = part.indexOf('~');
    if (colon < 0 || tilde < 1 || tilde > colon) return;
    var id = part.slice(0, tilde), sig = part.slice(tilde + 1, colon).slice(0, 60), tail = part.slice(colon + 1);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(id)) return;
    var v = { id: id, sig: sig, F: 0, U: 0, list: [] };
    if (tail) tail.split(';').slice(0, 60).forEach(function (t) {
      if (/^\^\d+$/.test(t)) { v.F = Math.max(v.F, Math.min(+t.slice(1), 9999999)); return; }   /* a number, never a round */
      if (/^\+\d+$/.test(t)) { v.U = Math.max(v.U, Math.min(+t.slice(1), 9999999)); return; }
      v.list.push(_rTok_(t).known ? t : '');
    });
    var key = id + '~' + sig;
    if (P.by[key]) { _rMergeV_(P.by[key], v); return; }
    if (P.order.length >= 120) return;
    P.by[key] = v; P.order.push(key);
  });
  return P;
}
/* A cell holds 50,000 characters, and a write past that fails the whole save. A lab writes about 3,000 at most (every
   station, ten rounds each); should a row ever pass 40,000, the stations with the most rounds keep only their totals (^F),
   one at a time, so nothing is ever counted less. */
function _rJoin_(P) {
  var one = function (v) {
    var t = [], u = v.U;
    v.list.forEach(function (x) { u += _rSum_(_rTok_(x).c); });
    if (v.F > u) t.push('^' + v.F);                      /* a floor the rounds have reached says nothing more */
    if (v.U > 0) t.push('+' + v.U);
    return t.length || v.list.length ? v.id + '~' + v.sig + ':' + t.concat(v.list).join(';') : '';
  };
  for (var guard = 0; guard < 200; guard++) {
    var parts = P.resets > 0 ? ['#' + P.resets] : [], longest = null;
    P.order.forEach(function (key) {
      var v = P.by[key], p = one(v);
      if (p) parts.push(p);
      if (v.list.length && (!longest || v.list.length > longest.list.length)) longest = v;
    });
    var out = parts.join('|');
    if (out.length <= 40000 || !longest) return out;
    longest.F = _rTotal_(longest); longest.U = 0; longest.list = [];
  }
  return out;
}
/* Keep round 1 and the newest seven finished rounds one by one; the ones between become one. The round on the page (the
   last) is never folded. */
function _rCap_(v) {
  var fin = v.list.length - 1;
  if (fin <= RND_KEPT - 1) return v;
  var keepNew = RND_KEPT - 3, over = { n: 0 };
  var mid = v.list.slice(1, fin - keepNew);
  v.list = [v.list[0], _rFold_(mid, over)].concat(v.list.slice(fin - keepNew));
  v.U += over.n;
  return v;
}
/* The same station, two copies (same fingerprint): `I` folded into `S`. The copy that has reached the later round gives
   the shape; the other's rounds are found in it by round number (inside a fold they are folded first), and each round
   takes the further letter and the larger count. */
function _rMergeV_(S, I) {
  /* folded as S is first (a page may send its rounds unfolded): every round of the shorter copy then lies inside one of the
     longer's (an unfolded one could straddle a fold, and was dropped; the second audit, 7 Oct 2026) */
  if (I.list.length) _rCap_(I);
  S.F = Math.max(S.F, I.F); S.U = Math.max(S.U, I.U);
  if (!I.list.length) return S;
  if (!S.list.length) { S.list = I.list.slice(); return _rCap_(S); }
  var a = _rSpan_(S.list) >= _rSpan_(I.list) ? S.list : I.list, b = a === S.list ? I.list : S.list;
  var out = a.slice(), at = [], k = 1;
  a.forEach(function (t) { var n = _rTok_(t).k; at.push([k, k + n - 1]); k += n; });
  var into = {}, p = 1;
  b.forEach(function (t) {
    var n = _rTok_(t).k, lo = p, hi = p + n - 1; p += n;
    for (var j = 0; j < at.length; j++) if (at[j][0] <= lo && hi <= at[j][1]) { (into[j] = into[j] || []).push(t); return; }
  });
  Object.keys(into).forEach(function (j) {
    var g = into[j], one = g.length === 1 && _rTok_(g[0]).k === _rTok_(out[j]).k ? g[0] : _rFold_(g, null);
    out[j] = _rMergeTok_(out[j], one);
  });
  S.list = out;
  return _rCap_(S);
}
/* A save's rounds folded into the stored cell. `sent` is what a page sends (no "#", no "^"); `resets` its count of whole-lab
   resets; `stations` its Per station ({ id: "done/total in checks" }), the least each station's checks can be; `snap` its
   letters, for the fingerprint of a station a page from before rounds names. Returns { cell, P, total, by } — by: each
   station's checks, every fingerprint it has had. */
function _roundsMerge_(cell, sent, resets, stations, snap) {
  var P = _rParse_(cell), I = _rParse_(String(sent == null ? '' : sent).slice(0, 45000)), named = Object.create(null);
  P.resets = Math.max(P.resets, Math.min(999, Math.floor(Number(resets) || 0)));
  I.order.forEach(function (key) {
    var v = I.by[key]; v.F = 0;                            /* a floor is this sheet's own, never a page's */
    named[v.id] = v.sig;
    if (P.by[key]) _rMergeV_(P.by[key], v);
    else if (P.order.length < 120) { P.by[key] = _rCap_(v); P.order.push(key); }
  });
  /* the least each station can have: what the page counted there (its Per station), under the fingerprint it used */
  var sigOf = Object.create(null), H = _snapParse_(snap);
  H.order.forEach(function (id) { sigOf[id] = H.by[id].sig; });
  Object.keys(named).forEach(function (id) { sigOf[id] = named[id]; });
  if (stations && typeof stations === 'object' && !Array.isArray(stations)) Object.keys(stations).slice(0, 40).forEach(function (id) {
    var m = String(stations[id]).match(/^\s*\d+\/\d+\s+in\s+(\d+)\s*$/), sig = sigOf[id];
    if (!m || sig == null || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(id)) return;
    var key = id + '~' + sig, v = P.by[key];
    if (!v) { if (P.order.length >= 120) return; v = P.by[key] = { id: id, sig: sig, F: 0, U: 0, list: [] }; P.order.push(key); }
    v.F = Math.max(v.F, Math.min(+m[1], 9999999));
  });
  /* a station this save names under a new fingerprint keeps its old part whole: see the note above */
  var out = _roundsSums_(P);
  out.current = named;                                   /* the fingerprint of each station this save named */
  return out;
}
/* `kept`: some station here has its rounds (a page from 7 Oct 2026 has saved), so Practised again can be said from them */
function _roundsSums_(P) {
  var by = Object.create(null), total = 0, kept = false;   /* no prototype: a station named "constructor" is a station */
  P.order.forEach(function (key) { var v = P.by[key], t = _rTotal_(v); by[v.id] = (by[v.id] || 0) + t; total += t; if (v.list.length) kept = true; });
  return { cell: _rJoin_(P), P: P, total: total, by: by, kept: kept };
}
/* the Rounds column is ours on this tab: until a save (or Tidy up) adds it, column 22 may be a teacher's own column, and
   none of that may reach a pupil (the second audit, 7 Oct 2026) */
function _roundsColOk_(sh) {
  try { return sh.getMaxColumns() >= LAB_ROUNDS && String(sh.getRange(1, LAB_ROUNDS).getValue()).replace(/[^a-z]/gi, '').toLowerCase() === 'rounds'; }
  catch (e) { return false; }
}
function _stationNamesOf_(man, labId) {
  var out = {};
  try { ((man && man.labs && man.labs[labId] && man.labs[labId].stations) || []).forEach(function (x) { out[x.id] = String(x.name || x.id); }); } catch (e) {}
  return out;
}
/* "Practised again", for the sheet: each round after the first, over the stations that reached it; whole-lab resets; and
   the questions not right at the first check in round 1 that were again not right at the first check in a later round.
   "Round 2 in 3 stations: 15 tried, 13 right, 30 checks · reset the whole lab 2× · failed again: Mouth Q3, Stomach Q2" */
function _roundsSay_(P, names, here, current) {
  var rows = {}, keys = [], again = [], pick = Object.create(null);
  current = current || {};
  /* one part per station: the one this save named, else the one furthest on (a station rewritten since has two) */
  P.order.forEach(function (key) {
    var v = P.by[key], p = pick[v.id];
    if (!v.list.length) return;
    if (!p) { pick[v.id] = v; return; }
    if (current[p.id] === p.sig) return;
    if (current[v.id] === v.sig || _rSpan_(v.list) > _rSpan_(p.list)) pick[v.id] = v;
  });
  Object.keys(pick).forEach(function (id) {
    var v = pick[id]; if (v.list.length < 2) return;
    var r1 = _rTok_(v.list[0]).l, nm = names[v.id] || v.id, k = 1, bad = {};
    v.list.forEach(function (t, j) {
      var x = _rTok_(t), a = k; k += x.k;
      if (!j) return;
      var label = x.k > 1 ? 'Rounds ' + a + '–' + (a + x.k - 1) : 'Round ' + a;
      var R = rows[label]; if (!R) { R = rows[label] = { a: a, st: 0, tried: 0, right: 0, checks: 0, seen: 0 }; keys.push(label); }
      R.st++;
      if (!x.l) return;
      R.seen++;
      for (var i = 0; i < x.l.length; i++) {
        var c = x.l.charAt(i);
        if (c !== '0') R.tried++;
        if (c === '1' || c === 'f') R.right++;
        if ((c === 't' || c === '1') && (r1.charAt(i) === 't' || r1.charAt(i) === '1')) bad[i] = 1;
      }
      R.checks += _rSum_(x.c);
    });
    Object.keys(bad).sort(function (p, q) { return p - q; }).forEach(function (i) { again.push(nm + ' Q' + (+i + 1)); });
  });
  /* a station a page from before moved on to round 2 or later, whose rounds are not here: said from its letters (it went
     blank once any other station had rounds; the second audit, 7 Oct 2026) */
  var H = _snapParse_(here || '');
  H.order.forEach(function (id) {
    var x = H.by[id], v = pick[id];
    if (x.go < 2 || (v && v.sig === x.sig && _rSpan_(v.list) >= x.go)) return;
    var label = 'Round ' + x.go, R = rows[label];
    if (!R) { R = rows[label] = { a: x.go, st: 0, tried: 0, right: 0, checks: 0, seen: 0, blind: 0 }; keys.push(label); }
    R.st++; R.seen++; R.blind = (R.blind || 0) + 1;
    for (var i = 0; i < x.q.length; i++) { var c = x.q.charAt(i); if (c !== '0') R.tried++; if (c === '1' || c === 'f') R.right++; }
  });
  keys.sort(function (p, q) { return rows[p].a - rows[q].a; });
  var out = keys.map(function (label) {
    var R = rows[label], all = R.blind && R.blind === R.st;
    return label + ' in ' + R.st + ' station' + (R.st === 1 ? '' : 's') + ': ' +
      (R.seen ? R.tried + ' tried, ' + R.right + ' right' + (all ? '' : ', ' + R.checks + ' check' + (R.checks === 1 ? '' : 's')) : 'answers not kept');
  });
  if (P.resets > 0) out.push('reset the whole lab ' + P.resets + '\u00d7');
  if (again.length) out.push('failed again: ' + again.slice(0, 12).join(', ') + (again.length > 12 ? ' and ' + (again.length - 12) + ' more' : ''));
  return out.join(' · ').slice(0, 900);
}
/* Two cells as one, floors and all (the tests). */
function _rMergeCells_(a, b) {
  var P = _rParse_(a), Q = _rParse_(b);
  P.resets = Math.max(P.resets, Q.resets);
  Q.order.forEach(function (key) {
    if (P.by[key]) _rMergeV_(P.by[key], Q.by[key]);
    else if (P.order.length < 120) { P.by[key] = _rCap_(Q.by[key]); P.order.push(key); }
  });
  return _rJoin_(P);
}

/* A cell given text that starts with = + - or @ reads it as a formula, and a formula can reach
   out of the sheet — IMAGE, IMPORTXML — the moment the teacher opens it. Everything a page sends
   is written through this, so it always lands as the text it is. */
function _plain_(v) {
  var s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

/* Who is this? Google signed the token; we ask Google to check its own signature. The
   answer is cached briefly so two saves in a row do not ask twice. Anything we cannot
   stand behind comes back null. */
function _whoIs_(idToken) {
  if (!_clientId_() || !idToken) return null;
  var cache = CacheService.getScriptCache();
  var key = 'ID_' + Utilities.base64EncodeWebSafe(
              Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  var hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  /* Junk never costs a call to Google, whose daily allowance every save shares: something not
     even shaped like a sign-in for THIS app, still in date, is turned away here, and a token Google
     has already refused is remembered as refused for five minutes. */
  var claims = null;
  try {
    var mid = String(idToken).split('.')[1] || '';
    while (mid.length % 4) mid += '=';
    claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(mid)).getDataAsString());
  } catch (e) { return null; }
  if (!claims || String(claims.aud) !== _clientId_() || !(Number(claims.exp) * 1000 > Date.now())) return null;
  if (cache.get('NO' + key)) return null;
  function refused() { try { cache.put('NO' + key, '1', 300); } catch (e) {} return null; }

  var res;
  try {
    res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' +
                            encodeURIComponent(idToken), { muteHttpExceptions: true });
  } catch (e) { return null; }
  /* 400 is Google saying the token is not good; anything else is Google having a bad moment, which
     must not lock a real student out for five minutes */
  if (res.getResponseCode() !== 200) return res.getResponseCode() === 400 ? refused() : null;

  var t;
  try { t = JSON.parse(res.getContentText()); } catch (e) { return null; }
  if (String(t.aud) !== _clientId_()) return refused();        /* a token for somebody else's app */
  if (!/^(https:\/\/)?accounts\.google\.com$/.test(String(t.iss))) return refused();   /* not Google's */
  if (Number(t.exp) * 1000 < Date.now()) return null;         /* expired */
  if (String(t.email_verified) !== 'true') return refused();

  var who = { email: _cleanEmail_(t.email), name: String(t.name || '') };
  cache.put(key, JSON.stringify(who), 240);
  return who;
}

/* ── This script's own pass (6 Oct 2026, Daniel: a pupil shown as signed in must be synced "no matter what") ──────────────
   Google's sign-in lasts an hour, and Google renews it without a click only sometimes. So a page whose Google sign-in is
   fresh asks for a pass of this script's own (action `pass`, _ownPass_): the pupil's email and name and a time 30 days ahead,
   stamped with HMAC-SHA256 under a secret kept ONLY in Script Properties (PASS_SECRET, made on first use; never in this file,
   never in any reply). A page sends it beside Google's sign-in, and _whoSaving_ takes Google's while it is good and the pass
   when it is not. A pass opens ONLY a pupil's own saving and own practice: lab saves, `progress`, `english.save`/`english.mine`
   and `writeup.save`/`writeup.mine` (with no way to the teacher page). Never `record`, `test`, the teacher page, or a new pass:
   a pass cannot make a pass, so a stolen one dies within 30 days. Every use still checks the class list, so a pupil taken off
   it is refused. 🔑 in the menu deletes the secret: every pass stops at once, and each pupil signs in once more.
   The pages keep it in labs-shared/signin.js (`biology.pass`); signing out removes it. Proof: gastest "— this script's own
   pass —" and tools/signin-runs-out.mjs. */
var PASS_DAYS = 30;
var PASS_SECRET_KEY = 'PASS_SECRET';
function _passSecret_() {
  var props = PropertiesService.getScriptProperties(), s = props.getProperty(PASS_SECRET_KEY);
  if (s) return s;
  /* made once, under the lock, so two first passes at the same moment cannot each make a secret of their own */
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { return ''; }
  try {
    s = props.getProperty(PASS_SECRET_KEY);
    if (!s) {
      s = [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join('').replace(/-/g, '');
      props.setProperty(PASS_SECRET_KEY, s);
    }
    return s;
  } finally { lock.releaseLock(); }
}
/* the stamp on a pass: '' when there is no secret, and then no pass is made and none is taken */
function _passSig_(body) {
  var key = _passSecret_();
  if (!key || key.length < 64) return '';
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(body), key)).replace(/=+$/, '');
}
/* a request body as the Rejected tab keeps it: never a Google sign-in or a pass in a cell (audit, 6 Oct 2026) */
function _noCredentials_(k, v) { return k === 'token' || k === 'pass' ? undefined : v; }
/* the same text, compared in the same time whatever it holds */
function _sameText_(a, b) {
  a = String(a); b = String(b);
  if (!a || a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
/* p1.<the claims, base64url>.<the stamp>; the name travels %-encoded, so the claims are plain ASCII on any charset */
function _issuePass_(who) {
  var exp = Date.now() + PASS_DAYS * 864e5, n = '';
  /* at most 60 letters, cut between letters (never inside an emoji); a name that will not encode travels as none */
  try { n = encodeURIComponent(Array.from(String(who.name || '')).slice(0, 60).join('')); } catch (e) { n = ''; }
  if (n.length > 600) n = '';
  var body = 'p1.' + Utilities.base64EncodeWebSafe(JSON.stringify({ e: String(who.email || ''), n: n, x: exp })).replace(/=+$/, '');
  var sig = _passSig_(body);
  return sig ? { pass: body + '.' + sig, exp: exp } : null;
}
/* who a pass belongs to, or null: a stamp that is not this script's, a pass out of date (or dated further ahead than one is
   ever made), an unreadable one */
function _whoByPass_(pass) {
  if (!_clientId_()) return null;
  var m = /^p1\.([A-Za-z0-9_-]{8,1600})\.([A-Za-z0-9_-]{40,60})$/.exec(String(pass || ''));
  if (!m) return null;
  var want = _passSig_('p1.' + m[1]);
  if (!want || !_sameText_(m[2], want)) return null;
  var j = null, mid = m[1];
  while (mid.length % 4) mid += '=';
  try { j = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(mid)).getDataAsString()); } catch (e) { return null; }
  var x = Number(j && j.x), now = Date.now();
  if (!j || typeof j.e !== 'string' || !j.e || !(x > now) || x > now + (PASS_DAYS + 1) * 864e5) return null;
  var name = '';
  try { name = decodeURIComponent(String(j.n || '')); } catch (e) { name = ''; }
  return { email: _cleanEmail_(j.e), name: name, viaPass: true };
}
/* Who is saving, or asking for their own practice: Google's sign-in while it is good, else this script's pass. */
function _whoSaving_(d) {
  return _whoIs_(d && d.token) || _whoByPass_(d && d.pass);
}
/* action `pass`: the caller's own pass, for Google's own sign-in only (a pass never makes a pass), and only for somebody
   on the class list or a teacher on the list. The answer holds the pass and its date, nothing else. */
function _ownPass_(d) {
  if (!_clientId_()) return _json_({ ok: false, why: 'sign-in is not set up' });
  var who = _whoIs_(d.token);
  if (!who) return _json_({ ok: false, why: 'not signed in' });
  if (!_studentOf_(who.email) && !_isTeacher_(who.email)) return _json_({ ok: false, why: 'not on this class list' });
  var p = _issuePass_(who);
  if (!p) return _json_({ ok: false, why: 'busy — it will try again' });
  return _json_({ ok: true, pass: p.pass, exp: p.exp });
}
/* 🔑 Every pupil's pass stops at once (a lost laptop, a pass seen where it should not be): the secret is deleted, and the
   next pass made has a new one. Each pupil is asked to sign in once more; nothing they did is lost. */
function newPassSecretMENU_() {
  var ui = SpreadsheetApp.getUi();
  var go = ui.alert('🔑 Make every pupil sign in again',
    'Each pupil’s browser keeps a pass from this script, so their work is still saved after Google’s one-hour sign-in ' +
    'ends. Cancel every pass if a laptop was lost, or if a pass was seen where it should not be.\n\n' +
    'Each pupil then sees “sign in again” once, and one press of Google’s button sends their work. Nothing they did is lost.\n\n' +
    'Cancel every pass now?', ui.ButtonSet.YES_NO);
  if (go !== ui.Button.YES) return;
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); }
  catch (e) { ui.alert('🔑 Busy', 'Pupils’ work is being saved just now. Nothing was cancelled: try again in a minute.', ui.ButtonSet.OK); return; }
  try { PropertiesService.getScriptProperties().deleteProperty(PASS_SECRET_KEY); }
  finally { lock.releaseLock(); }
  ui.alert('🔑 Done', 'Every pass is cancelled. Each pupil signs in once more, the next time a lab asks.', ui.ButtonSet.OK);
}

/* An address typed or pasted into the Sheet carries what came with it: a trailing space from
   a copy, a non-breaking space from a web page, a zero-width character from a document, or a
   "mailto:" from a pasted link. Every comparison below lowercased but did not trim, so an
   address that LOOKS right sat on the roster and matched nothing, and the save was refused
   as "not on this class list". Both sides go through here now. */
function _cleanEmail_(v) {
  return String(v == null ? '' : v)
    .replace(/^\s*mailto:/i, '')
    .replace(/[\u00A0\u1680\u2000-\u200D\u202F\u205F\u3000\uFEFF]/g, '')
    .trim().toLowerCase();
}

/* What the roster knows about them — and whether they are on it at all. */
/* A pupil's class can change while one of their saves waits for the lock (Students ▸ Move, Left, an import moving them),
   and the save then wrote the class it had read before back onto their lab, Bio English or Write-Up row (the audit, 7 Oct
   2026). Whoever changes a class says when (CLASS_CHANGED, in the script cache); a save that read the pupil before that
   reads them again, under the lock. Most saves cost nothing more: one cache read. */
var CLASS_CHANGED_KEY = 'CLASS_CHANGED';
function _classesChanged_() { try { CacheService.getScriptCache().put(CLASS_CHANGED_KEY, String(Date.now()), 21600); } catch (e) {} }
function _freshStudent_(email, was, readAt) {
  var at = 0;
  try { at = Number(CacheService.getScriptCache().get(CLASS_CHANGED_KEY) || 0); } catch (e) { at = 0; }
  if (!(at >= readAt - 2000)) return was;
  return _studentOf_(email) || was;
}
function _studentOf_(email) {
  if (!email) return null;
  var sh = _sheet_(T_STUDENTS), last = sh.getLastRow();
  if (last < 2) return null;
  var C = _studentCols_(sh), EMAIL_COL = C.email, width = Math.max(EMAIL_COL, C.acc || 0);
  var vals = sh.getRange(2, 1, last - 1, width).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (_cleanEmail_(vals[i][EMAIL_COL - 1]) === email) {
      var who = { name: String(vals[i][0] || ''), cls: String(vals[i][1] || '').toUpperCase() };
      if (C.acc && _accOn_(vals[i][C.acc - 1])) who.acc = true;
      return who;
    }
  }
  return null;
}
/* The Students tab's email and Accommodation columns, from ONE read of the heading row (as _emailCol_ alone did, so a
   save costs no more calls). acc is 0 on a tab Tidy up has not given the column yet. */
function _studentCols_(sh) {
  var n = sh.getLastColumn(), out = { email: 3 + LABS.length + 2, acc: 0 }, seenEmail = false;
  if (n > 0) {
    var head = sh.getRange(1, 1, 1, n).getValues()[0];
    for (var i = 0; i < head.length; i++) {
      var h = String(head[i] || '').replace(/^✎\s*/, '').trim();
      if (h === 'School email' && !seenEmail) { out.email = i + 1; seenEmail = true; }
      else if (h === 'Accommodation' && !out.acc) out.acc = i + 1;
    }
  }
  return out;
}
/* A pupil has the accommodation when the teacher put Yes (or ticked a box, or typed y / true / ✓) in their row. Never "x":
   in Korea X means no (the audit, 8 Oct 2026), and O is not read as yes either. */
function _accOn_(v) { return v === true || /^\s*(yes|y|true|[✓✔✅☑]\uFE0F?)\s*$/i.test(String(v == null ? '' : v)); }

/* A save from a pupil on the roster whose numbers do not add up (a score above the total, an impossible
   total) lands here, with the reason, instead of in a lab's tab. A save that is not signed in, or from
   somebody not on the roster, is not written anywhere. */
function _reject_(lab, row) {
  var ss = _ss_(), sh = ss.getSheetByName(T_REJECTED);
  if (!sh) {
    sh = ss.insertSheet(T_REJECTED);
    sh.getRange(1, 1, 1, 9).setValues([['When', 'Lab', 'Name', 'Class', 'Score',
                                        'Out of', 'Code', 'Why it was refused', 'What was sent']]);
    _dress2_(sh, [
      { h:'When', w:150, fmt:'dd MMM, HH:mm', note:'When it arrived.' },
      { h:'Lab', w:140, note:'Which lab it claimed to come from.' },
      { h:'Name', w:190, note:'The name it carried.' },
      { h:'Class', w:80, align:'center' },
      { h:'Score', w:76, align:'center', fmt:'0' },
      { h:'Out of', w:76, align:'center', fmt:'0' },
      { h:'Code', w:120, align:'center' },
      { h:'Why it was refused', w:240, wrap:true, note:'What did not add up. These never reach a lab\'s tab.' },
      { h:'What was sent', w:460, wrap:true, note:'The whole message, in case you want to look.' }
    ], { tab:'#A3342A' });
  }
  sh.appendRow(row);
}

/* ============================================================
   2. The endpoint — a lab checks it is alive; a student's work arrives by POST
   ============================================================ */
function doGet(e) {
  /* the teachers' page — see "The teacher page" at the top. Anything else is the health check. */
  var page = e && e.parameter ? String(e.parameter.page || '') : '';
  /* All the teacher views (seven since Write-Up, 8 Oct 2026; six since ⏱️ Homework habits, 1 Oct) are ONE page now: the tabs swap in the browser instead of loading a
     new document, so nothing flickers, the header never moves, and no link ever tries to open
     script.google.com inside the sandbox frame. The old ?page= values still work — each simply
     decides which tab opens first, so every bookmark and the hub's own door keep working. */
  if (page === 'teachers' || page === 'progress' || page === 'students' || page === 'homework' ||
      page === 'english' || page === 'writeup' || page === 'habits') {
    return _teacherAppPage_(page);
  }
  /* The health check names the script's edition, so a paste can be confirmed from outside
     without signing in: open the /exec address and read the line. It also names the reflection code students'
     My assessments runs (§front-door), for the same reason. */
  return _text_('Biology Labs endpoint is running · ' + SCRIPT_EDITION + _frontDoorHealth_());
}



/* "Classroom is not defined" is the advanced service not being switched on. Say so in
   words a teacher can act on, rather than letting a ReferenceError reach the dialog. */
function _needClassroom_() {
  if (typeof Classroom !== 'undefined' && Classroom && Classroom.Courses) return;
  throw new Error(
    'Google Classroom is not switched on in this script yet. In the Apps Script editor, ' +
    'in the left sidebar: Services  ▸  + (Add a service)  ▸  Google Classroom API  ▸  Add. ' +
    'Leave the identifier as "Classroom". Then Run ▸ setup once to authorise the new ' +
    'permission, and open this window again.');
}

/* Opens the import window. The menu names this function as a string, so if it is ever
   renamed the menu says "Script function not found" and nothing explains why — which is
   what tools/gastest.js now checks for. */
function showClassroomImport() {
  _needClassroom_();
  var html = HtmlService.createHtmlOutputFromFile('ClassroomImport')
    .setWidth(880).setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import students from Google Classroom');
}

function getBatchImportData() {
  if (!_isAdminCaller_()) return { courses: [], have: {}, refused: true };   /* google.script.run reaches ANY function without a trailing underscore; the window says who may import */
  _needClassroom_();
  var courses = [], page = null;
  do {
    var r = Classroom.Courses.list({ courseStates: ['ACTIVE'], pageSize: 100, pageToken: page });
    (r.courses || []).forEach(function (c) {
      courses.push({
        id: c.id,
        name: c.name || '',
        section: c.section || '',
        display: (c.name || '') + (c.section ? ' · ' + c.section : ''),
        autoClassCode: _guessClass_(c.name + ' ' + (c.section || ''))
      });
    });
    page = r.nextPageToken;
  } while (page);

  courses.sort(function (a, b) { return a.display.localeCompare(b.display); });

  /* how many students each class already has here, so the dialog can say so; and, once a course has been imported this
     school year, the pupils in none of this year's courses (a new school year, 7 Oct 2026) */
  var left = null;
  /* the courses active in Classroom now: the first year's record counts only these as imported (an archived course, last
     year's, cannot be imported again, so its pupils would never have been found: the audit, 7 Oct 2026) */
  try { left = _notThisYearView_(null, courses.map(function (c) { return String(c.id); })); } catch (e) { left = null; }
  return { courses: courses, have: _classCounts_(), left: left };
}

/* How many pupils each class has on the Students tab: the rows with a class AND a school address (a row with no address
   matches nobody, and the next import adds that pupil again). The import window shows it before ("already") and after. */
function _classCounts_() {
  var sh = _sheet_(T_STUDENTS), n = sh.getLastRow() - 1, have = {};
  if (n < 1) return have;
  var EMAIL_COL = _emailCol_(sh), rows = sh.getRange(2, 1, n, EMAIL_COL).getValues();
  rows.forEach(function (r) {
    var cls = String(r[1] || '').toUpperCase().trim();
    if (cls && _cleanEmail_(r[EMAIL_COL - 1])) have[cls] = (have[cls] || 0) + 1;
  });
  return have;
}

/* ── The Classroom import: ONE call from the window, run as a job that Google's six-minute limit cannot stop part way
   (7 Oct 2026) ──
   Daniel, 6 Oct 2026: an import of several classes "got stuck" and his 11C came in as 8 of 16; "can you make sure that
   those spreadsheets can handle the six minutes limit well?". And the window may be closed while the import goes on (the
   reflection's import has promised that since September, at his wish). Google stops any call after six minutes, and the
   import used to do every class and then all of Tidy up's formatting in one. Now the window still makes ONE call, but the
   work is a JOB (Script Property IMPORT_JOB), saved after each class: a piece of work starts a class only in its first
   three minutes and the formatting only in its first two, and otherwise hands the rest to a one-off trigger a minute
   later (continueBatchImport_), as often as it needs. A safety trigger, set as each piece starts (8 minutes out), picks
   the job up if a piece is stopped all the same; the class it was on is done again, and nobody is added twice. The window
   reads each class's result as it is done from the cache key BATCH_IMPORT_<job> (6 h): `continuing` while it waits a
   minute, `done` with each class's count at the end. Closed, the job finishes anyway. */
var IMPORT_JOB_KEY = 'IMPORT_JOB', IMPORT_TRIGGER_FN = 'continueBatchImport_';
var IMPORT_CLASS_BY_MS = 3 * 60 * 1000;     /* a piece starts another class only in its first 3 minutes */
var IMPORT_FINISH_BY_MS = 2 * 60 * 1000;    /* …and the formatting (Tidy up's work, minutes) only in its first 2 */
var IMPORT_NEXT_MS = 60 * 1000;             /* a handed-over job carries on a minute later */
var IMPORT_SAFETY_MS = 8 * 60 * 1000;       /* the safety trigger: after any piece's six minutes */
var IMPORT_STALE_MS = 10 * 60 * 1000;       /* a job not heard from for 10 minutes is dead: a new import may start */
var IMPORT_BUILD_KEY = 'IMPORT_NEEDS_BUILD'; /* an import stopped before building the tabs: the next import, or Tidy up, builds them */

function executeBatchImportAll(sels, jobId) {
  if (!_isAdminCaller_()) return [{ status: 'refused' }];   /* google.script.run reaches ANY function without a trailing underscore */
  _needClassroom_();
  var id = String(jobId || '').replace(/[^\w-]/g, '').slice(0, 80) || ('batch_' + Date.now());
  var list = (Array.isArray(sels) ? sels : []).slice(0, 40).map(function (s) {
    s = s || {};
    /* a code is checked whole, never cut (two codes that shared their first 16 characters merged in silence) */
    return { courseId: String(s.courseId || '').slice(0, 40), classCode: String(s.classCode || '').trim().toUpperCase().slice(0, 40),
             courseName: String(s.courseName || '').slice(0, 60) };
  });
  if (!list.length) return [];
  var cur = _importJob_();
  if (cur && cur.id !== id && Date.now() - (cur.tickAt || 0) < IMPORT_STALE_MS) {
    var busy = list.map(function () {
      return { status: 'busy', error: 'Another import is still running (it carries on by itself). Try again once it says Finished.' };
    });
    /* the refusal is the end of THIS job: the window says so at once (it said "Importing…" for twelve minutes) */
    _publish_(id, busy, true, 'Another import is still running. Try again once it says Finished.', { stopped: true });
    return busy;
  }
  /* an import that stopped before its tabs were built leaves word for the next one to build them (IMPORT_BUILD_KEY) */
  var owed = false;
  try { owed = !!PropertiesService.getScriptProperties().getProperty(IMPORT_BUILD_KEY); } catch (e) { owed = false; }
  if (!_saveImportJob_({ id: id, sels: list, i: 0, phase: 'classes', tickAt: Date.now(), finishTries: 0, tries: {}, needBuild: owed })) {
    /* a job Google will not keep (Script Properties full, or more than 9 KB) never starts in silence */
    var none = list.map(function () {
      return { status: 'error', error: 'The import could not start: Google would not keep where it is (Script Properties). Tick fewer classes, or try again in a minute.' };
    });
    _publish_(id, none, true, 'Stopped.', { stopped: true, counts: _classCounts_() });
    return none;
  }
  _publish_(id, list.map(function () { return { status: 'pending' }; }), false, '');
  return _importPiece_(Date.now());
}

/* The trigger that carries an import on: after a piece handed over, or the safety one after a piece was stopped. Private
   (a trigger runs it; google.script.run cannot), and as the teacher who pressed Import. */
function continueBatchImport_() {
  if (!_importJob_()) { _deleteImportTriggers_(); return; }
  _importPiece_(Date.now());
}

/* One piece of the job, started at t0: classes while there is time, then the formatting, then done. */
function _importPiece_(t0) {
  var job = _importJob_();
  if (!job) { _deleteImportTriggers_(); return []; }
  _scheduleImport_(IMPORT_SAFETY_MS);
  var env = _importEnv_(job.id), n = job.sels.length;
  var results = env && Array.isArray(env.results) && env.results.length === n ? env.results
              : job.sels.map(function () { return { status: 'pending' }; });
  while (job.phase === 'classes') {
    if (job.i >= n) { job.phase = 'finish'; break; }
    if (Date.now() - t0 > IMPORT_CLASS_BY_MS) return _importLater_(job, results);
    /* a class Google has stopped twice before it was done is said and passed over (it was tried again every 8 minutes for
       ever, and the job never went stale, so every later import was refused: the audit, 7 Oct 2026) */
    var tk = String(job.i); job.tries = job.tries || {};
    if ((job.tries[tk] || 0) >= 2) {
      results[job.i] = { status: 'error', error: 'Google stopped this class twice before it was done. Import it again on its own: nobody is added twice.' };
      job.needBuild = true; job.i++; job.tickAt = Date.now(); _saveImportJob_(job);
      _publish_(job.id, results, false, '');
      continue;
    }
    if (job.tries[tk]) job.needBuild = true;                    /* done again after a stop: what it wrote before must be built */
    job.tries[tk] = (job.tries[tk] || 0) + 1;
    job.tickAt = Date.now(); _saveImportJob_(job);              /* alive (and its try counted), before a class that may take a while */
    var r;
    try { r = _importOneClass_(job.sels[job.i], job.id); }
    catch (err) { r = { status: 'error', error: String((err && err.message) || err).slice(0, 160) }; }
    if (r && r.status === 'success' && (r.added || r.moved)) job.needBuild = true;
    results[job.i] = r; job.i++; job.tickAt = Date.now(); _saveImportJob_(job);
    _publish_(job.id, results, false, '');
  }
  var extra = {};
  /* An import leaves the spreadsheet finished: every lab tab gets its rows and every tab is built and dressed (Tidy up's
     work), unless no class added or moved anybody. It is the long part, so it starts only early in a piece. */
  if (job.phase === 'finish' && (job.needBuild || results.some(function (r) { return r && r.status === 'success' && (r.added || r.moved); }))) {
    if (Date.now() - t0 > IMPORT_FINISH_BY_MS) return _importLater_(job, results);
    job.finishTries = (job.finishTries || 0) + 1; job.tickAt = Date.now(); _saveImportJob_(job);
    if (job.finishTries > 2) {
      extra.formatStopped = true;      /* stopped by Google twice: every name is in; Tidy up finishes it */
      try { PropertiesService.getScriptProperties().setProperty(IMPORT_BUILD_KEY, '1'); } catch (e) {}
    } else {
      _publish_(job.id, results, false, 'Names imported. Building and formatting every tab…');
      _PROGRESS_JOB = { id: job.id, results: results };
      try { _buildAndStyle_(); } finally { _PROGRESS_JOB = null; }
      extra.built = true;
      if (_STUDENTS_NOT_STYLED_) extra.studentsNote = _STUDENTS_NOT_STYLED_;   /* the import window prints it (ClassroomImport.html summary) */
      try { PropertiesService.getScriptProperties().deleteProperty(IMPORT_BUILD_KEY); } catch (e) {}
    }
  }
  _clearImportJob_(); _deleteImportTriggers_();
  extra.counts = _classCounts_();
  _publish_(job.id, results, true, 'Finished.', extra);
  return results;
}
/* out of time: save where the job is, and carry on a minute later */
function _importLater_(job, results) {
  job.tickAt = Date.now();
  if (!_saveImportJob_(job) || !_scheduleImport_(IMPORT_NEXT_MS)) {
    /* names written and tabs not yet built: the next import (or Tidy up) builds them */
    if (job.needBuild) { try { PropertiesService.getScriptProperties().setProperty(IMPORT_BUILD_KEY, '1'); } catch (e) {} }
    /* Google would not set the trigger that carries it on (7 Oct 2026): stop now and say so, rather than leave the window
       waiting twelve minutes for a job nothing will pick up. Every class done is in; Try again imports the rest, or Tidy up
       does the formatting when only that was left. */
    _clearImportJob_(); _deleteImportTriggers_();
    _publish_(job.id, results, true, 'Stopped.', { noTrigger: true, namesIn: job.phase === 'finish', counts: _classCounts_() });
    return results;
  }
  _publish_(job.id, results, false, 'Paused for a minute, to stay inside Google’s time limit. It carries on by itself: you can close this window.',
            { continuing: true });
  return results;
}

/* One class from Classroom into the Students tab. Every lab tab gets its rows at the end of the job, once. Who the course
   listed is kept for the school year (_noteImported_): it is how the window finds the pupils in none of this year's
   courses. */
function _importOneClass_(s, jobId) {
  /* a class needs a code of its own; LEFT is kept for pupils in none of the classes (7 Oct 2026) */
  if (!s.classCode) return { status: 'error', error: 'No class code. Type one, such as 9A, and try again.' };
  if (s.classCode.length > 16) return { status: 'error', error: 'A class code has at most 16 characters. Type a shorter one, such as 10C.' };
  if (_isLeftClass_(s.classCode)) return { status: 'error', error: 'LEFT is kept for pupils who are in none of your classes. Give this class a code of its own.' };
  var students = [], noEmail = [], kept = [], page = null;
  do {
    var r = Classroom.Courses.Students.list(s.courseId, { pageSize: 100, pageToken: page });
    (r.students || []).forEach(function (st) {
      var pr = st.profile || {}, name = String((pr.name && pr.name.fullName) || '').trim();
      var email = _cleanEmail_(pr.emailAddress);
      /* No address from Classroom: a row for them could never be matched to a sign-in, and the next import added them
         again. They are named in the window instead (6 Oct 2026). */
      if (email.indexOf('@') < 1) { noEmail.push(name || ('Classroom user ' + st.userId)); if (st.userId) kept.push('uid:' + st.userId); return; }
      students.push({ name: name, email: email, userId: st.userId }); kept.push(email);
    });
    page = r.nextPageToken;
  } while (page);
  if (!students.length) { _noteImported_(s.courseId, kept); return { status: 'empty', added: 0, skipped: 0, listed: 0, noEmail: noEmail }; }
  var out = _upsertStudents_(students, s.classCode, s.courseName, s.courseId, { noSeed: true, jobId: jobId });
  if (out.status === 'success') _noteImported_(s.courseId, kept);
  out.listed = students.length;
  out.noEmail = noEmail;
  return out;
}

function _importJob_() {
  try { var raw = PropertiesService.getScriptProperties().getProperty(IMPORT_JOB_KEY); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
/* says whether Google kept it (the audit, 7 Oct 2026: a refusal used to be silent) */
function _saveImportJob_(job) { try { PropertiesService.getScriptProperties().setProperty(IMPORT_JOB_KEY, JSON.stringify(job)); return true; } catch (e) { return false; } }
function _clearImportJob_() { try { PropertiesService.getScriptProperties().deleteProperty(IMPORT_JOB_KEY); } catch (e) {} }
function _importEnv_(id) {
  try { var raw = CacheService.getScriptCache().get('BATCH_IMPORT_' + id); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
/* at most one carry-on trigger at a time */
function _deleteImportTriggers_() {
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === IMPORT_TRIGGER_FN) { try { ScriptApp.deleteTrigger(t); } catch (e) {} }
    });
  } catch (e) {}
}
/* the new trigger is made FIRST, and only then are the others taken away (a refusal used to leave none at all, in
   silence: the audit, 7 Oct 2026). Says whether Google set it. */
function _scheduleImport_(ms) {
  var made = null;
  try { made = ScriptApp.newTrigger(IMPORT_TRIGGER_FN).timeBased().after(ms).create(); } catch (e) { return false; }
  var keep = null;
  try { keep = made.getUniqueId(); } catch (e) { keep = null; }
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() !== IMPORT_TRIGGER_FN) return;
      var same = false;
      try { same = keep ? t.getUniqueId() === keep : t === made; } catch (e) { same = false; }
      if (!same) { try { ScriptApp.deleteTrigger(t); } catch (e) {} }
    });
  } catch (e) {}
  return true;
}

function getBatchImportProgress(jobId) {
  if (!_isAdminCaller_()) return null;   /* google.script.run reaches ANY function without a trailing underscore */
  var raw = CacheService.getScriptCache().get('BATCH_IMPORT_' + jobId);
  return raw ? JSON.parse(raw) : null;
}
/* the window's view of a job: each class's result, `done`, what it is on (`phase`), and when it last moved (`ts`) */
function _publish_(jobId, results, done, phase, extra) {
  try {
    var o = { results: results, done: done, phase: phase || '', ts: Date.now() };
    if (extra) for (var k in extra) o[k] = extra[k];
    CacheService.getScriptCache().put('BATCH_IMPORT_' + jobId, JSON.stringify(o), 21600);
  } catch (e) {}
}

/* ── A new school year: the pupils in none of this year's classes (7 Oct 2026) ──
   Daniel asked for it on 7 Oct 2026. A pupil who leaves, or whose class is not imported again, keeps last year's class
   code ("10C"); next year another group is 10C, and the new 10C's first whole-class homework would take those pupils in.
   So each import keeps, for the school year (from 1 August), which pupils each course listed: Script Properties
   IMPORTED_COURSES_<year> ({ at: { courseId: when }, seeded }) and IMPORTED_LIST_<year>_<courseId> (the addresses, and
   'uid:<id>' for a pupil Classroom gives no address for), the course's latest import. A pupil is in none of this year's
   classes when no list of this year names them and their course was not imported this year, or was and no longer lists
   them. A pupil with no course id (added by hand, the TEST row) never is. The import window lists them, by class, once
   any course has been imported this year; one press (markPupilsLeft) puts the ticked ones in the class "LEFT <year>".
   Every record stays theirs; they drop out of every class list, every class's new homework and the teacher page's
   views but Students, where Move brings one back. Importing their class again puts them back too. The imports before
   this code kept no lists, so in the school year it is first used every course on the Students tab counts as imported
   (nobody is listed until a course is imported again). */
var IMPORTED_INDEX_KEY = 'IMPORTED_COURSES_', IMPORTED_LIST_KEY = 'IMPORTED_LIST_', IMPORTED_FROM_KEY = 'IMPORTED_COURSES_FROM';

function _isLeftClass_(cls) { return /^LEFT(\s|$)/.test(String(cls == null ? '' : cls).trim().toUpperCase()); }
/* 2026 for the school year that starts on 1 August 2026, as _classCohort_ counts it */
function _schoolStartYear_(now) { var d = now || new Date(); return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; }
/* the class of a pupil who is in none of the classes: LEFT and the year they were marked */
function _leftLabel_(now) { return 'LEFT ' + (now || new Date()).getFullYear(); }
function _importRunning_() { var cur = _importJob_(); return !!(cur && Date.now() - (cur.tickAt || 0) < IMPORT_STALE_MS); }

/* This school year's record of the courses imported, made the first time it is asked for. In the first school year it is
   used, the courses on the Students tab count as imported, so nobody is listed before their course is imported again; but
   only those still ACTIVE in Classroom (`active`, when the window gives them): an archived course is last year's, cannot be
   imported again, and its pupils are the ones this is for (the audit, 7 Oct 2026). */
function _importedIndex_(sy, active) {
  var p = PropertiesService.getScriptProperties(), o = null;
  try { o = JSON.parse(p.getProperty(IMPORTED_INDEX_KEY + sy) || 'null'); } catch (e) { o = null; }
  if (o && o.at) return o;
  o = { at: {}, seeded: false };
  var first = !p.getProperty(IMPORTED_FROM_KEY), live = null;
  if (Array.isArray(active)) { live = {}; active.forEach(function (c) { live[String(c)] = 1; }); }
  if (first) { _studentCourseIds_().forEach(function (c) { if (!live || live[c]) o.at[c] = 0; }); o.seeded = true; }
  try {
    p.setProperty(IMPORTED_INDEX_KEY + sy, JSON.stringify(o));
    if (first) p.setProperty(IMPORTED_FROM_KEY, String(sy));      /* only once the year's record is kept */
  } catch (e) {}
  /* a new year's record: earlier years' are never read, and hold pupils' addresses, so they go (the audit, 7 Oct 2026) */
  try {
    p.getKeys().forEach(function (k) {
      var m = k.match(/^IMPORTED_(?:COURSES|LIST)_(\d{4})(?:_|$)/);
      if (m && +m[1] < sy) p.deleteProperty(k);
    });
  } catch (e) {}
  return o;
}
/* every course id on the Students tab, for the first year's record */
function _studentCourseIds_() {
  var sh = _ss_().getSheetByName(T_STUDENTS), out = {};
  if (!sh || sh.getLastRow() < 2) return [];
  var cc = _headerCol_(sh, 'Course id', _emailCol_(sh) + 4);
  if (sh.getLastColumn() < cc) return [];
  sh.getRange(2, cc, sh.getLastRow() - 1, 1).getDisplayValues().forEach(function (r) { var c = String(r[0] || '').trim(); if (c) out[c] = 1; });
  return Object.keys(out);
}
/* A course has just been imported: it was imported this year, and `keys` are the pupils it listed. */
function _noteImported_(courseId, keys) {
  var cid = String(courseId == null ? '' : courseId).trim();
  if (!cid) return;
  var sy = _schoolStartYear_(), p = PropertiesService.getScriptProperties(), idx = _importedIndex_(sy);
  idx.at[cid] = Date.now();
  try { p.setProperty(IMPORTED_INDEX_KEY + sy, JSON.stringify(idx)); } catch (e) {}
  try { p.setProperty(IMPORTED_LIST_KEY + sy + '_' + cid, JSON.stringify(keys || [])); }
  catch (e) { try { p.deleteProperty(IMPORTED_LIST_KEY + sy + '_' + cid); } catch (e2) {} }   /* too long to keep: then nobody of that course is listed */
}
/* A pupil Move put in a class: the course of that class, if imported this year, counts them in until it is imported again. */
function _noteListed_(courseId, email) {
  var sy = _schoolStartYear_(), p = PropertiesService.getScriptProperties(), k = IMPORTED_LIST_KEY + sy + '_' + courseId, L = null;
  try { L = JSON.parse(p.getProperty(k) || 'null'); } catch (e) { L = null; }
  if (!Array.isArray(L) || L.indexOf(email) >= 0) return;
  L.push(email);
  try { p.setProperty(k, JSON.stringify(L)); } catch (e) {}
}
/* The pupils in none of this year's classes: { sy, imported (courses imported this year), rows [{ i (their Students row
   less 2), name, email, cls, why }], totals { class: pupils } }. why: 'course' (their course was not imported this year)
   or 'gone' (it was, and no longer lists them). */
function _notThisYear_(active) {
  var sy = _schoolStartYear_(), idx = _importedIndex_(sy, active);
  var out = { sy: sy, imported: Object.keys(idx.at).length, rows: [], totals: {} };
  var sh = _ss_().getSheetByName(T_STUDENTS);
  if (!sh || sh.getLastRow() < 2) return out;
  var all = {}, inList = {}, hasList = {}, pre = IMPORTED_LIST_KEY + sy + '_';
  try { all = PropertiesService.getScriptProperties().getProperties() || {}; } catch (e) { all = {}; }
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(pre) !== 0) return;
    var L = null;
    try { L = JSON.parse(all[k]); } catch (e) { L = null; }
    if (!Array.isArray(L)) return;
    hasList[k.slice(pre.length)] = 1;
    L.forEach(function (x) { inList[String(x)] = 1; });
  });
  var n = sh.getLastRow() - 1, ec = _emailCol_(sh), last = sh.getLastColumn();
  var uc = _headerCol_(sh, 'Classroom user id', ec + 3), cc = _headerCol_(sh, 'Course id', ec + 4);
  var v = sh.getRange(2, 1, n, ec).getValues();
  var cids = cc <= last ? sh.getRange(2, cc, n, 1).getDisplayValues() : null;
  var uids = uc <= last ? sh.getRange(2, uc, n, 1).getDisplayValues() : null;
  var seen = {};
  for (var i = 0; i < n; i++) {
    var em = _cleanEmail_(v[i][ec - 1]);
    if (!em || seen[em]) continue;                               /* the first row wins, as for a save */
    seen[em] = 1;
    var cls = String(v[i][1] || '').trim().toUpperCase();
    if (!cls || cls === 'TEST' || _isLeftClass_(cls)) continue;
    out.totals[cls] = (out.totals[cls] || 0) + 1;
    var cid = cids ? String(cids[i][0] || '').trim() : '';
    if (!cid) continue;                                          /* added by hand: never listed */
    var uid = uids ? String(uids[i][0] || '').trim() : '';
    if (inList[em] || (uid && inList['uid:' + uid])) continue;   /* a course imported this year lists them */
    var known = Object.prototype.hasOwnProperty.call(idx.at, cid);
    if (known && !hasList[cid]) continue;                        /* imported before lists were kept: counted in */
    out.rows.push({ i: i, name: String(v[i][0] || '').trim(), email: em, cls: cls, why: known ? 'gone' : 'course' });
  }
  return out;
}
/* …as the import window shows them: by class, in year order, each class with its size */
function _notThisYearView_(L, active) {
  L = L || _notThisYear_(active);
  var by = {}, order = [];
  L.rows.forEach(function (r) {
    if (!by[r.cls]) { by[r.cls] = { cls: r.cls, total: L.totals[r.cls] || 0, pupils: [] }; order.push(r.cls); }
    by[r.cls].pupils.push({ name: r.name, email: r.email, why: r.why });
  });
  order.sort(_byClass_);
  return {
    n: L.rows.length, imported: L.imported, since: '1 August ' + L.sy, label: _leftLabel_(), busy: _importRunning_(),
    groups: order.map(function (k) { by[k].pupils.sort(function (a, b) { return a.name.localeCompare(b.name); }); return by[k]; })
  };
}
/* The window asks again: after an import, or after marking. */
function getNotThisYear() {
  if (!_isAdminCaller_()) return null;   /* google.script.run reaches ANY function without a trailing underscore */
  return _notThisYearView_();
}
/* One press: the ticked pupils go to the class "LEFT <year>", on the Students tab and on their row of every lab, Bio
   English and Write-Up tab. Only pupils who are STILL in none of this year's classes (worked out again, under the lock),
   and never while an import runs. Their records stay; importing their class again, or Move on the teacher page, puts
   one back. { ok, note, left (the list now) } or { ok:false, why }. */
function markPupilsLeft(emails) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Only the owner of this spreadsheet, or a teacher on its 👩‍🏫 Teachers list, can do this.' };
  var want = {};
  (Array.isArray(emails) ? emails : []).slice(0, 3000).forEach(function (e) { e = _cleanEmail_(e); if (e) want[e] = 1; });
  if (!Object.keys(want).length) return { ok: false, why: 'Tick the pupils first.' };
  if (_importRunning_()) return { ok: false, why: 'An import is still running. Wait until it says Finished, then try again.' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (e) { return { ok: false, why: 'The spreadsheet is busy just now (pupils saving). Try again in a moment.' }; }
  var label = _leftLabel_(), n = 0;
  try {
    var L = _notThisYear_(), w = [], to = {};
    /* as the window: only once a course has been imported this school year (a window opened on 31 July and pressed after
       midnight would have marked everybody it ticked: the audit, 7 Oct 2026) */
    if (!L.imported) return { ok: false, why: 'Nothing has been imported since 1 August ' + L.sy + ' yet. Import this year’s classes first.', left: _notThisYearView_(L) };
    L.rows.forEach(function (r) { if (want[r.email]) to[r.email] = label; });
    if (!Object.keys(to).length) return { ok: false, why: 'Nobody to mark: each ticked pupil is in a class imported this year now, or is marked already.', left: _notThisYearView_(L) };
    /* every row of that address (one address on two rows kept its class on the second) */
    var stu = _sheet_(T_STUDENTS), ec = _emailCol_(stu);
    stu.getRange(2, ec, stu.getLastRow() - 1, 1).getValues().forEach(function (x, k) { if (to[_cleanEmail_(x[0])]) w.push([k, label]); });
    _writeRuns_(stu, 2, w, false);
    _classEverywhere_(to);
    _classesChanged_();
    n = Object.keys(to).length;
  } catch (e) {
    return { ok: false, why: 'Could not mark them: ' + String((e && e.message) || e).slice(0, 120) };
  } finally { try { lock.releaseLock(); } catch (e) {} }
  return { ok: true, left: _notThisYearView_(),
           note: n + ' pupil' + (n === 1 ? ' is' : 's are') + ' in ' + label + ' now. Their records stay. Importing their class again, or Move on the teacher page, puts one back.' };
}
/* A pupil's class, written on their row of every tab that copies it (every lab, Bio English and Write-Up): one read of the
   address column per tab, one write per run of rows. `to`: { email: class }. The first row of an address wins, as for a
   save. Tidy up would put the lab rows right later; this does it at once. */
function _classEverywhere_(to) {
  var tabs = [];
  LABS.forEach(function (l) { tabs.push([l.name, LAB_EMAIL]); });
  tabs.push([T_ENGLISH, EN_EMAIL], [T_WRITEUP, WU_EMAIL]);
  tabs.forEach(function (t) {
    var sh = _ss_().getSheetByName(t[0]);
    if (!sh || sh.getLastRow() < 2 || sh.getMaxColumns() < t[1]) return;
    var col = sh.getRange(2, t[1], sh.getLastRow() - 1, 1).getValues(), w = [], seen = {};
    for (var k = 0; k < col.length; k++) {
      var e = _cleanEmail_(col[k][0]);
      if (!e || seen[e]) continue;
      seen[e] = 1;
      if (Object.prototype.hasOwnProperty.call(to, e)) w.push([k, to[e]]);
    }
    _writeRuns_(sh, 2, w, false);
  });
}

/* Add the ones we do not have; move the ones we do into this class, and keep their Classroom ids true. Never
   duplicates: the key is the school email.
   Under the script lock, every read comes before every write, and each write covers a run of rows (6 Oct 2026). It
   used to read and write one pupil at a time, four to eight calls each, every read waiting for the write before it,
   so with several classes in one go Google's six minutes ran out part way through a class. New pupils go in with ONE
   write, name and address together: two writes could leave a name with no address, which matches nobody.
   opt.noSeed: the lab tabs are left to the end of the import. opt.jobId: a pupil an earlier class of the same import
   put in another class is named in `clashes` (each ends in the class imported last, as before). */
function _upsertStudents_(students, classCode, courseName, courseId, opt) {
  opt = opt || {};
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (e) { return { status: 'busy', error: 'The spreadsheet was busy (pupils saving, or another import), so nothing was changed. Try this class again.' }; }
  var out;
  try { out = _upsertLocked_(students, classCode, courseName, courseId, opt); }
  finally { try { lock.releaseLock(); } catch (e) {} }
  /* Their names go into every lab straight away, so each tab reads as a class list with the
     marks still to come, rather than filling up only as work arrives. */
  if (!opt.noSeed && (out.added || out.moved)) LABS.forEach(function (l) { _seedLab_(l); });
  return out;
}
function _upsertLocked_(students, classCode, courseName, courseId, opt) {
  var sh = _sheet_(T_STUDENTS);
  var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
               .map(function (h) { return String(h || '').replace(/^\s*✎\s*/, '').trim().toLowerCase(); });
  function col(name, dflt) { var i = head.indexOf(name.toLowerCase()); return i >= 0 ? i + 1 : dflt; }
  var EMAIL_COL = col('School email', 3 + LABS.length + 2);
  var COURSE_COL = col('Classroom course', EMAIL_COL + 1), IMP_COL = col('Imported', EMAIL_COL + 2);
  /* the Classroom user id and course id are TEXT (5 Oct 2026): a user id has about 21 digits, and as a number Sheets
     keeps only 15 of them. A pupil already listed gets them rewritten too, so importing again repairs a rounded id. */
  var UID_COL = col('Classroom user id', EMAIL_COL + 3), CID_COL = col('Course id', EMAIL_COL + 4);
  var W = Math.max(EMAIL_COL, COURSE_COL, IMP_COL, UID_COL, CID_COL);
  if (W > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), W - sh.getMaxColumns());

  var n = Math.max(0, sh.getLastRow() - 1);
  var vals = n ? sh.getRange(2, 1, n, W).getValues() : [];
  var uidShown = n ? sh.getRange(2, UID_COL, n, 1).getDisplayValues() : [];
  var cidShown = n ? sh.getRange(2, CID_COL, n, 1).getDisplayValues() : [];
  var rowOf = {};
  vals.forEach(function (v, i) {
    var em = _cleanEmail_(v[EMAIL_COL - 1]);
    if (em && rowOf[em] === undefined) rowOf[em] = i;      /* the first row wins, as for a save */
  });

  var cache = null, key = '', placed = {};
  if (opt.jobId) {
    try { cache = CacheService.getScriptCache(); key = 'BATCH_PLACED_' + opt.jobId; placed = JSON.parse(cache.get(key) || '{}') || {}; }
    catch (e) { cache = null; placed = {}; }
  }
  var add = [], skipped = 0, moved = 0, clashes = [], once = {}, now = new Date();
  var clsW = [], uidW = [], cidW = [];
  students.forEach(function (st) {
    var em = st.email;
    if (!em || once[em]) return;                       /* listed twice by Classroom: added once */
    once[em] = true;
    if (placed[em] && placed[em] !== classCode) clashes.push({ name: st.name, was: placed[em] });
    placed[em] = classCode;
    var i = rowOf[em];
    if (i === undefined) { add.push(st); return; }
    if (String(vals[i][1]).toUpperCase() !== classCode) { clsW.push([i, classCode]); moved++; }
    if (st.userId && String(uidShown[i][0]) !== String(st.userId)) uidW.push([i, String(st.userId)]);
    if (courseId && String(cidShown[i][0]) !== String(courseId)) cidW.push([i, String(courseId)]);
    skipped++;
  });

  _writeRuns_(sh, 2, clsW, false);
  _writeRuns_(sh, UID_COL, uidW, true);
  _writeRuns_(sh, CID_COL, cidW, true);
  if (add.length) {
    var at = sh.getLastRow() + 1;
    _room_(sh, at + add.length - 1);
    sh.getRange(at, UID_COL, add.length, 1).setNumberFormat('@');
    sh.getRange(at, CID_COL, add.length, 1).setNumberFormat('@');
    sh.getRange(at, 1, add.length, W).setValues(add.map(function (st) {
      var r = new Array(W).fill('');
      r[0] = st.name; r[1] = classCode; r[EMAIL_COL - 1] = st.email; r[COURSE_COL - 1] = courseName;
      r[IMP_COL - 1] = now; r[UID_COL - 1] = String(st.userId || ''); r[CID_COL - 1] = String(courseId || '');
      return r;
    }));
  }
  if (cache) { try { cache.put(key, JSON.stringify(placed), 21600); } catch (e) {} }
  if (moved) _classesChanged_();
  return { status: 'success', added: add.length, skipped: skipped, moved: moved, clashes: clashes };
}
/* Writes [index, value] pairs into one column, one call per run of rows next to each other (row = index + 2). text:
   the cells are plain text first, so a long id is never turned into a rounded number. */
function _writeRuns_(sh, col, list, text) {
  list.sort(function (a, b) { return a[0] - b[0]; });
  for (var k = 0; k < list.length; ) {
    var j = k;
    while (j + 1 < list.length && list[j + 1][0] === list[j][0] + 1) j++;
    var rg = sh.getRange(list[k][0] + 2, col, j - k + 1, 1);
    if (text) rg.setNumberFormat('@');
    rg.setValues(list.slice(k, j + 1).map(function (p) { return [p[1]]; }));
    k = j + 1;
  }
}

/* "Y9 Biology · 9A" → "9A";  "10 Set 2" → "10"; falls back to '' so the dialog asks. */
function _guessClass_(s) {
  var t = String(s || '').toUpperCase();
  var m = t.match(/\b(1[0-3]|[7-9])\s*([A-Z])\b/);        /* 9A, 10 B */
  if (m) return m[1] + m[2];
  m = t.match(/\bY(?:EAR)?\s*(1[0-3]|[7-9])\b/);          /* Y9, Year 10 */
  if (m) return m[1];
  return '';
}

/* Tells you, in one box, which parts of the set-up are done, and what each optional part still needs. */
function checkSetup() {
  if (!_isAdminCaller_()) return;   /* reachable by anyone via google.script.run: these are expensive owner-privileged writes */
  var lines = [], id = '', src = '';
  try {
    id = _sheetId_();
    src = (SHEET_ID && SHEET_ID !== 'PASTE_YOUR_SHEET_ID_HERE') ? 'from SHEET_ID at the top of Code.gs'
        : 'worked out from this Sheet and remembered — you do not need to paste it';
    lines.push('✅  spreadsheet: ' + src);
  } catch (e) {
    lines.push('❌  ' + e.message);
  }

  var openOk = false, name = '';
  if (id) {
    try { name = SpreadsheetApp.openById(id).getName(); openOk = true; } catch (e) {}
    lines.push((openOk ? '✅' : '❌') + '  ' + (openOk ? 'it opens: “' + name + '”' : 'that id will not open'));
  }

  var clsOk = (typeof Classroom !== 'undefined' && Classroom && Classroom.Courses);
  lines.push((clsOk ? '✅' : '❌') + '  Google Classroom ' + (clsOk ? 'is switched on' :
    'is NOT switched on — left sidebar: Services ▸ + ▸ Google Classroom API ▸ Add (identifier "Classroom")'));
  if (clsOk) {
    try { var n = (Classroom.Courses.list({ courseStates: ['ACTIVE'], pageSize: 5 }).courses || []).length;
          lines.push('✅  it can see your courses (' + n + '+ active)'); }
    catch (e) { lines.push('❌  Classroom is on but not authorised — Run ▸ setup once and accept. (' + e + ')'); }
  }

  /* The one that decides whether anything is recorded at all, so it says so plainly. */
  var cid = _clientId_();
  if (!cid) {
    lines.push('❌  sign-in is NOT set up — CLIENT_ID at the top of this script is empty and ' +
               'none has been remembered, so NOTHING is being recorded, however green ' +
               'everything above is. Every save comes back “not recorded: sign-in is not ' +
               'set up”. Type it into the CLIENT_ID line once and run this again; from then ' +
               'on pasting a fresh copy of the script cannot lose it. See “Step 3 · Switch on ' +
               'sign-in” in the hub’s README.');
  } else if (!/\.apps\.googleusercontent\.com$/.test(cid)) {
    lines.push('❌  CLIENT_ID does not look like a Client ID — it should end ' +
               '.apps.googleusercontent.com. This looks like something else was pasted in.');
  } else {
    lines.push('✅  sign-in is set up (…' + cid.slice(-32) + ')' +
               (CLIENT_ID ? '' : ' — remembered from an earlier paste, the line above is empty'));
    lines.push('•  the SAME id must also be googleClientId in every lab\'s js/config.js (Bio English Lab\'s too) ' +
               'and in the hub\'s js/local.js, or that page can never record or read anything.');
  }

  if (openOk) {
    lines.push('•  students imported: ' + Math.max(0, _sheet_(T_STUDENTS).getLastRow() - 1));
    /* built = live: its questions are counted in LABS. Every lab has a tab from the first Tidy up, so counting tabs
       always said 20 of 20 (labs-script-025, 1 Oct 2026). */
    var built = LABS.filter(function (l) { return (l.questions || 0) > 0; }).length;
    lines.push('•  labs built so far: ' + built + ' of ' + LABS.length +
               (built < LABS.length ? ' (the others already have a tab and a Students column, empty until the lab is built)' : ''));
  }

  /* The two newer addresses. Both are typed by hand, both are easy to confuse with a spreadsheet
     link, and both fail quietly when wrong — the tab that needs one only says it is missing — so say so here. */
  var rawTracker = String(_keptSetting_(TRACKER_APP_URL, 'TRACKER_APP_URL') || '').trim();
  if (!rawTracker) {
    lines.push('•  the Students tab cannot open trackers yet: TRACKER_APP_URL is empty. It wants the /exec address of ' +
               'one of your REFLECTION deployments — not a spreadsheet link.');
  } else if (!_trackerAppUrl_()) {
    lines.push('❌  TRACKER_APP_URL is not a web-app address, so the Students tab cannot open trackers. ' +
               'It must be the reflection system\u2019s /exec address (https://script.google.com/…/exec). ' +
               'What is there now starts "' + rawTracker.slice(0, 44) + '…" — that looks like a ' +
               'spreadsheet, which is TRACKER_ID\u2019s job, not this one.');
  } else {
    lines.push('✅  the Students tab can open each pupil’s tracker.');
  }
  var rawHub = String(_keptSetting_(HUB_URL, 'HUB_URL') || '').trim();
  if (!rawHub) {
    lines.push('•  Set homework cannot list the labs’ stations yet (Bio English sets still work): HUB_URL is empty; it wants your hub\u2019s address, usually a ' +
               'sub-folder such as https://…/biology-hub');
  } else {
    var manOk = false;
    try { manOk = !!_manifest_(); } catch (e) {}
    lines.push(manOk
      ? '✅  Set homework can read the station list from ' + rawHub
      : '❌  the station list could not be read from ' + rawHub + '/js/data/stations.json — open ' +
        'that address in a browser. If it does not load, HUB_URL is wrong (a GitHub Pages project ' +
        'site usually sits in a sub-folder), or the site has not been published since the list was built.');
  }

  /* The record card on the hub. Optional, so silence here is not a fault — but if it IS
     filled in, it is worth proving the workbook opens and the cohort tabs are there,
     because the card's own way of failing is a quiet "could not check just now" that says
     nothing about which of the two is wrong. */
  var tid = _trackerId_();
  if (!tid) {
    lines.push('•  the record card on the hub is off. To switch it on, type TRACKER_ID and ' +
               'SCHOOL_DOMAIN into the two lines near the top of this script (or add them in ' +
               'Project Settings ▸ Script Properties), then run this check again.');
  } else {
    var tOk = false, tName = '', cohorts = [], tRows = 0, unfRows = -1;
    try {
      var twb = SpreadsheetApp.openById(tid);
      tName = twb.getName(); tOk = true;
      twb.getSheets().forEach(function (sh) {
        if (sh.getName() === 'Unfinished reflections') { unfRows = Math.max(0, sh.getLastRow() - 1); return; }
        if (!/^Class of \d{4}$/.test(sh.getName())) return;
        cohorts.push(sh.getName());
        tRows += Math.max(0, sh.getLastRow() - 1);
      });
    } catch (e) {}
    if (!tOk) {
      lines.push('❌  the record card is on, but TRACKER_ID will not open. It should be the ' +
                 'long string from the "Student Progress Tracker" address, between /d/ and ' +
                 '/edit, and this account must be able to open it.');
    } else if (!cohorts.length) {
      lines.push('❌  “' + tName + '” opens, but it has no "Class of ____" tabs. That is the ' +
                 'shape of the Student Progress Tracker — so this is almost certainly an ' +
                 'assessment\'s own spreadsheet pasted in by mistake. The card must point at ' +
                 'the tracker: one assessment\'s spreadsheet knows about that test and no ' +
                 'other, and goes stale the day you make the next one.');
    } else {
      lines.push('✅  the record card can read “' + tName + '” — ' + cohorts.join(', ') +
                 ' (' + tRows + ' finished student-assessment row' + (tRows === 1 ? '' : 's') + ')');
      lines.push(unfRows < 0
        ? '•  no "Unfinished reflections" tab yet — it appears the first time a student submits a ' +
          'reflection incomplete in a spreadsheet running the updated reflection code.'
        : '•  "Unfinished reflections": ' + unfRows + ' row' + (unfRows === 1 ? '' : 's') +
          ' — counted on the card as unfinished, never as assessments done.');
      var dom = _schoolDomain_();
      lines.push(dom ? '•  school accounts: any address at ' + dom + ' or under it — staff at …@' + dom +
                       ', pupils at …@<something>.' + dom
                     : '•  SCHOOL_DOMAIN is empty, so somebody signing in with a personal ' +
                       'account is told "nothing recorded yet" rather than which account to use.');
    }
  }

  /* The teacher page. Off until it is set up, and then its three parts are checked apart. */
  var tpUrl = _teacherPageUrl_(), tpTab = openOk ? _ss_().getSheetByName(T_LINKS) : null;
  if (!tpUrl && !tpTab && !String(_keptSetting_(TEACHER_PAGE_URL, 'TEACHER_PAGE_URL') || '')) {
    lines.push('•  the teacher page is off. 🧪 Biology Labs ▸ 👥 Teacher page: teachers and addresses sets it up.');
  } else {
    lines.push(tpUrl ? '✅  teacher page address is set'
                     : '❌  TEACHER_PAGE_URL is empty or is not a web-app /exec address — see 👥 Teacher page: teachers and addresses');
    lines.push('•  teachers who can open it: you (' + (_owner_() || 'the owner') + ')' +
               (_teacherEmails_().length ? ' and ' + _teacherEmails_().length + ' more' : ' only'));
    /* which of them can also open THIS spreadsheet to edit it (2 Oct 2026): the page needs no such access, the menu does */
    if (openOk && _teacherEmails_().length) {
      try {
        var ta = _teacherAccess_(), tn = ta.can.length + ta.cannot.length;
        if (ta.known && tn) lines.push(ta.cannot.length
          ? '•  ' + ta.can.length + ' of the ' + tn + ' teachers on the list can edit this spreadsheet. 🧪 Biology Labs ▸ 🤝 Let the teachers on the list edit this spreadsheet… gives it to the other ' + ta.cannot.length + '.'
          : '✅  ' + (tn === 1 ? 'the teacher on the list can' : 'all ' + tn + ' teachers on the list can') + ' edit this spreadsheet');
      } catch (e) {}
    }
    var tpLinks = 0;
    try { tpLinks = _teacherLinksRaw_().length; } catch (e) {}
    lines.push(tpTab ? '•  links on it: ' + tpLinks : '❌  no “' + T_LINKS + '” tab — 🔗 Add or remove links on the teacher page makes it');
  }
  /* Bio English Lab: its set list comes from the public site, so an unreachable site means
     English homework cannot be scored — worth saying, never a fault in the labs. */
  var enMan = null;
  try { enMan = _englishManifest_(); } catch (e) {}
  lines.push(enMan ? '✅  Bio English Lab: its ' + (enMan.sets || []).length + ' sets can be read'
                   : '❌  Bio English Lab: ' + ENGLISH_URL + '/data/sets.json could not be read, so English homework cannot be scored just now');
  /* the Write-Up Lab the same way (3 Oct 2026) */
  var wuMan = null;
  try { wuMan = _writeupManifest_(); } catch (e) {}
  lines.push(wuMan ? '✅  Write-Up Lab: its ' + (wuMan.parts || []).length + ' parts can be read'
                   : '❌  Write-Up Lab: ' + WRITEUP_URL + '/data/parts.json could not be read, so Write-Up homework cannot be scored just now');
  var dailyOn = false;
  try { dailyOn = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sendDueSummaries'; }); } catch (e) {}
  lines.push(dailyOn ? '✅  the due-date email goes out every morning'
                     : '•  the due-date email is off. 📬 in this menu switches it on.');
  /* Homework reminders (1 Oct 2026): the 15-minute check, started here if some homework wants it and it is missing,
     and the Classroom permission the reminders need. Said plainly, because a missing permission fails quietly. */
  var remWant = false, remOn = false, remNew = false;
  try {
    var hwTab = openOk ? _ss_().getSheetByName(T_HOMEWORK) : null;
    if (hwTab && hwTab.getLastRow() > 1) remWant = _homeworkRows_().some(function (h) { return h.remindOn && h.course && h.courseWork; });
  } catch (e) {}
  try { remOn = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sendHomeworkReminders'; }); } catch (e) {}
  if (remWant && !remOn) remOn = remNew = _hwReminderTrigger_();
  lines.push(remOn ? '✅  homework reminders: checked every 15 minutes' + (remNew ? ' (started just now)' : '')
           : remWant ? '❌  some homework has reminders switched on, but the 15-minute check could not be started. Run this check again; if it says the same, open Triggers (the clock in the left sidebar of the Apps Script editor) and see whether sendHomeworkReminders is there.'
           : '•  homework reminders: none yet. They start by themselves when homework is posted in Google Classroom with “Remind pupils who have not finished” ticked.');
  if (clsOk) {
    var annOk = _hwAnnounceAllowed_();
    lines.push(annOk === true ? '✅  the reminders can be posted: Google Classroom announcements are allowed'
      : annOk === false ? '❌  the reminders CANNOT be posted: Google has not been allowed to post Classroom announcements for this script. ' +
                          'In the Apps Script editor, choose checkSetup in the list at the top and press ▶ Run. On Google’s screen, tick ' +
                          'Select all (or the line about announcements in Google Classroom) and press Allow. Then run this check again: this line turns ✅.'
      : '•  whether Google Classroom announcements are allowed (for the reminders) could not be checked here.');
  }
  if (openOk) lines.push(_tzLine_());
  lines.push('');
  lines.push('Remember: editing this script changes nothing until Deploy ▸ Manage deployments ▸ pencil ▸ New version ▸ Deploy, on each of your deployments.');

  SpreadsheetApp.getUi().alert('Biology Labs — set-up', lines.join('\n\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}
/* 🩺 The zone every due time and the reminders' night hours are read in (_tz_: the spreadsheet's own, File ▸ Settings,
   before the script's). 2 Oct 2026: the paste list asked the teacher to look this up by hand, and the script's zone
   (appsscript.json) is the one that is easy to look at by mistake. The line says which zone is used; it is ❌ when the
   spreadsheet has none, or when the two differ (then one of them is not the school's). Read straight from the
   spreadsheet, not from _tz_'s kept answer. Never throws. */
function _tzLine_() {
  var sheet = '', script = '';
  try { sheet = String(_ss_().getSpreadsheetTimeZone() || ''); } catch (e) {}
  try { script = String(Session.getScriptTimeZone() || ''); } catch (e) {}
  if (!sheet) return '❌  the spreadsheet has no time zone, so due times and the reminders’ night hours (22:00–07:00) are read in ' +
    (script ? 'the script’s, ' + script : 'UTC') + '. In the spreadsheet, open File ▸ Settings ▸ Time zone and choose your school’s. Then run this check again.';
  if (script && script !== sheet) return '❌  the spreadsheet’s time zone is ' + sheet + ', but the script’s is ' + script +
    '. Due times and the reminders’ night hours (22:00–07:00) are read in the spreadsheet’s. If ' + sheet + ' is not your school’s time zone, ' +
    'change it in the spreadsheet: File ▸ Settings ▸ Time zone. If it is, change the script’s instead: Apps Script editor ▸ Project Settings ▸ Time zone. Then run this check again.';
  return '✅  times are read in ' + sheet + ' (the spreadsheet’s time zone)';
}

/* ============================================================
   5. The tabs, and making them readable
   ============================================================ */
/* Everything the spreadsheet needs, in the right order. Safe to run at any time: it
   creates only what is missing and never touches what is in the cells. Both the menu's
   Tidy up and the end of an import call this, so importing a class leaves the whole
   spreadsheet built, dressed and up to date — there is nothing else to press. */
function _buildAndStyle_() {
  var notes = [];
  _step_('Checking the Setup, Labs and Students tabs…');
  _sheet_(T_SETUP);
  var labsSaid = _labsRows_(_sheet_(T_LABS));        /* written afresh from LABS every time (labs-script-019) */
  if (labsSaid) notes.push(labsSaid);
  _sheet_(T_STUDENTS);
  _step_('Repairing the Students tab: repeated, unused and untidy columns…');
  notes = notes.concat(_repairStudentSheet_());     /* repeated, stray and dirty columns first */
  var added = _repairStudentColumns_();             /* a lab added since this sheet was built gets its column */
  if (added) notes.push(added + ' new lab column' + (added === 1 ? '' : 's') +
                        ' added to the Students tab.');
  var trail = _studentTrailColumns_(_sheet_(T_STUDENTS));   /* and a column added to the script since (Accommodation, 8 Oct 2026) */
  if (trail.length) notes.push('Added to the Students tab: ' + trail.join(', ') + '.');
  LABS.forEach(function (l, i) {                   /* every lab: a tab, and a row per student */
    _step_('Giving everyone a row: ' + l.name + '  (' + (i + 1) + ' of ' + LABS.length + ')');
    _seedLab_(l, notes);
  });
  _step_('Checking the addresses on every lab tab…');
  notes = notes.concat(_repairLabEmails_());
  var gone = _ss_().getSheetByName('Summary');
  if (gone && gone.getLastRow() < 2) _ss_().deleteSheet(gone);      /* the Students tab is the summary now */
  /* Make the teacher-facing tabs exist, rather than waiting for somebody to open the window that
     happens to create them. Tidy up is where a teacher expects the workbook to be put right, and a
     tab that only appears the first time a page is opened looks like it is missing. */
  _step_('Making the homework, Bio English and teacher tabs…');
  try { _ensureHomeworkTab_(); } catch (e) {}
  try { _englishSheet_(); } catch (e) {}
  try { _ensureTeacherTabs_(); } catch (e) {}
  _step_('Putting the buttons back on the Setup tab…');
  _installButtons_();
  restyleAll_();
  _step_('Working out everyone\u2019s progress…');
  refreshDashboard();
  if (_STUDENTS_NOT_STYLED_) notes.push(_STUDENTS_NOT_STYLED_);
  _step_('Putting the tabs in syllabus order…');
  _orderTabs_();                     /* the teacher tabs first, then the labs in LABS order */
  return notes;
}

function setup() {
  if (!_isAdminCaller_()) return;   /* reachable by anyone via google.script.run: these are expensive owner-privileged writes */
  var notes = _buildAndStyle_();
  try { PropertiesService.getScriptProperties().deleteProperty(IMPORT_BUILD_KEY); } catch (e) {}   /* what a stopped import owed */
  var said = notes.length ? notes.join('  ')
           : 'Every tab is built and styled. Nothing needed repairing.';
  SpreadsheetApp.getActive().toast(said, 'Biology Labs', 20);
  return said;
}

function restyleAll_() {
  _step_('Formatting the Setup, Labs and Students tabs…');
  _styleSetup_(); _styleLabs_(); _styleStudents_();
  LABS.forEach(function (l, i) {
    var sh = _ss_().getSheetByName(l.name);
    if (!sh) return;
    _step_('Formatting ' + l.name + '  (' + (i + 1) + ' of ' + LABS.length + ')');
    _styleLab_(sh);
  });
  /* The tabs added later were never in here, so they never got their date formats, their
     dropdown or their banding: _dress2_ only runs when a tab is FIRST made, and at that moment
     it has no rows to dress. */
  _step_('Formatting the homework, Bio English and Write-Up Lab tabs…');
  /* 👩‍🏫 Teachers and 🔗 Teacher links are dressed when they are made (_ensureTeacherTabs_), not here */
  [[T_HOMEWORK, _hwColDefs_(), '#F59E0B']].forEach(function (t) {
    var sh = _ss_().getSheetByName(t[0]);
    if (!sh || !t[1]) return;
    _dress2_(sh, t[1], { tab: t[2] });
  });
  var en = _ss_().getSheetByName(T_ENGLISH);
  if (en) _dress2_(en, ENGLISH_COLS, { tab: EN_TAB, freezeCols: 2 });
  var wu = _ss_().getSheetByName(T_WRITEUP);
  if (wu) _dress2_(wu, WRITEUP_COLS, { tab: WU_TAB, freezeCols: 2 });
}

/* ------------------------------------------------------------
   One place decides what a tab looks like.

   Each column is described once — its heading, what it is for, whether it is filled
   in for you or yours to edit — and everything else follows from that: a width that
   never makes a heading wrap, a hover note so nobody has to guess what a column is,
   a dropdown wherever the answer is one of a few, and formatting that stops at the
   last row with something in it rather than painting a thousand empty ones.

   COL = { h:heading, w:width, note:hover, fmt:number format, align:, wrap:true,
           edit:true (yours to change), list:[dropdown options], hide:true }
   ------------------------------------------------------------ */
/* The palette. Ordinary numbers stay quiet; strong colour is kept for the few things that
   actually need looking at — a low score, a refused save.
   (Dashboard convention: a muted base, high contrast reserved for the exception.) */
var HDR_AUTO = '#14572B';     /* filled in for you */
var HDR_EDIT = '#8A6A12';     /* yours to change  */
var HDR_SOON = '#5C8A72';     /* a lab not built yet (questions: 0 in LABS): its Students column waits, empty */
var BAND_A   = '#FFFFFF';
var BAND_B   = '#F4F8F5';     /* the faintest green, so banding guides the eye without shouting */
var RULE     = '#D6E2DA';     /* the line between one group of columns and the next */
var LOW      = '#F7D9D5';
var MID      = '#FBEED2';
var HIGH     = '#DDEBDD';
var FONT     = 'Inter';

/* Wide enough that the heading never breaks across two lines. */
function _wide_(text, min) {
  var px = Math.ceil(String(text).length * 7.4) + 26;
  return Math.max(min || 64, px);
}

function _dress2_(sh, cols, opts) {
  opts = opts || {};
  var n = cols.length;
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
  if (sh.getMaxColumns() > n) {
    var spare = sh.getRange(1, n + 1, sh.getMaxRows(), sh.getMaxColumns() - n);
    try { if (spare.isBlank()) sh.deleteColumns(n + 1, sh.getMaxColumns() - n); } catch (e) {}
  }

  /* one typeface, one size, everywhere */
  sh.getRange(1, 1, sh.getMaxRows(), n).setFontFamily(FONT).setFontSize(10);

  /* headings */
  var head = sh.getRange(1, 1, 1, n);
  head.setValues([cols.map(function (c) { return (c.edit ? '✎ ' : '') + c.h; })])
      .setFontWeight('bold').setFontColor('#FFFFFF').setFontSize(10)
      .setVerticalAlignment('middle').setHorizontalAlignment('left')
      .setWrap(false);
  /* One write for the whole heading row rather than three per column. */
  head.setBackgrounds([cols.map(function (c) { return c.head || (c.edit ? HDR_EDIT : HDR_AUTO); })]);
  head.setNotes([cols.map(function (c) {
    return (c.note || '') + (c.edit ? '\n\nYou can change this.' : '\n\nFilled in for you.');
  })]);
  cols.forEach(function (c, i) {
    sh.setColumnWidth(i + 1, c.w || _wide_((c.edit ? '  ' : '') + c.h));
  });
  sh.setRowHeight(1, 30);
  sh.setFrozenRows(1);
  if (opts.freezeCols) sh.setFrozenColumns(opts.freezeCols);

  /* only the rows that have something in them get dressed */
  var last = Math.max(1, sh.getLastRow());
  var rows = last - 1;
  if (sh.getMaxRows() > last + 6) {
    try { sh.deleteRows(last + 7, sh.getMaxRows() - last - 6); } catch (e) {}
  }

  sh.getBandings().forEach(function (b) { b.remove(); });
  var f = sh.getFilter(); if (f) f.remove();
  sh.setHiddenGridlines(true);          /* banding and spacing do this job better than a grid */

  if (rows > 0) {
    var body = sh.getRange(2, 1, rows, n);
    body.setVerticalAlignment('middle').setFontColor('#26332A');
    var band = sh.getRange(1, 1, last, n)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
    try { band.setHeaderRowColor(HDR_AUTO).setFirstRowColor(BAND_A).setSecondRowColor(BAND_B); } catch (e) {}
    sh.getRange(1, 1, last, n).createFilter();
    /* setRowHeight is one round trip per row: 130 students across 20 tabs was 2,600 of them,
       and it is the single reason Tidy up took minutes. setRowHeights does the lot in one. */
    sh.setRowHeights(2, last - 1, 24);

    /* a hairline where one group of columns ends and the next begins */
    cols.forEach(function (c, i) {
      if (!c.group) return;
      sh.getRange(1, i + 1, last, 1)
        .setBorder(null, true, null, null, null, null, RULE, SpreadsheetApp.BorderStyle.SOLID);
    });
  }

  cols.forEach(function (c, i) { if (c.hide) sh.hideColumns(i + 1); });
  _dressRows_(sh, cols, 2, rows);
  if (opts.tab) { try { sh.setTabColor(opts.tab); } catch (e) {} }
  return rows;
}

/* The per-column look — number format, alignment, dropdowns — applied to a block of rows.
   _dress2_ uses it for the whole sheet; doPost uses it for the single row it has just
   filled in. Without that, a row added after the last tidy-up carries no format at all,
   and a percentage arrives as 0.008849557522 instead of 0.9%. */
function _dressRows_(sh, cols, from, rows) {
  if (!rows || rows < 1) return;
  sh.getRange(from, 1, rows, cols.length).setVerticalAlignment('middle').setFontColor('#26332A');
  sh.setRowHeights(from, rows, 24);
  /* Wrapping and dropdowns were set one column at a time — every column, every tab, every
     Tidy up. Both take a grid, so both are one call now. A number format or an alignment is
     still per column, because only a few columns ask for one and skipping the rest leaves
     what is already there alone. */
  var rule = {};
  cols.forEach(function (c, i) {
    if (c.list && c.list.length) {
      rule[i] = SpreadsheetApp.newDataValidation()
        .requireValueInList(c.list, true).setAllowInvalid(true)
        .setHelpText('One of: ' + c.list.join(', ')).build();
    }
  });
  var wrapGrid = [], ruleGrid = [];
  for (var r = 0; r < rows; r++) {
    var wr = [], rr = [];
    for (var i = 0; i < cols.length; i++) { wr.push(!!cols[i].wrap); rr.push(rule[i] || null); }
    wrapGrid.push(wr); ruleGrid.push(rr);
  }
  var body2 = sh.getRange(from, 1, rows, cols.length);
  body2.setWraps(wrapGrid);
  body2.setDataValidations(ruleGrid);
  /* Number formats and alignments were set one column at a time — about ten columns, two calls
     each, on every tab on every Tidy up, which was two thirds of the whole job. Both take a grid
     like the two above, so read what is there once, overlay only the columns that ask for
     something (leaving the rest exactly as they were), and write once. */
  var wantsFmt = false, wantsAlign = false;
  cols.forEach(function (c) { if (c.fmt) wantsFmt = true; if (c.align) wantsAlign = true; });
  if (wantsFmt) {
    var fg = body2.getNumberFormats();
    for (var r1 = 0; r1 < fg.length; r1++)
      for (var i1 = 0; i1 < cols.length; i1++) if (cols[i1].fmt) fg[r1][i1] = cols[i1].fmt;
    body2.setNumberFormats(fg);
  }
  if (wantsAlign) {
    var ag = body2.getHorizontalAlignments();
    for (var r2 = 0; r2 < ag.length; r2++)
      for (var i2 = 0; i2 < cols.length; i2++) if (cols[i2].align) ag[r2][i2] = cols[i2].align;
    body2.setHorizontalAlignments(ag);
  }
  cols.forEach(function (c, i) {                       /* rare enough to leave alone */
    if (c.bold) sh.getRange(from, i + 1, rows, 1).setFontWeight('bold');
  });
}

/* The classes actually in use, for the dropdowns. TEST is always offered: trying a lab as
   yourself, on a row of your own, is the ordinary way to check the whole chain works, and it
   should not be marked wrong for it. Anything else typed here is accepted too — the dropdown
   only warns, it never blocks — and it joins this list the next time Tidy up runs. */
function _classList_() {
  var sh = _ss_().getSheetByName(T_STUDENTS);
  var out = { TEST: 1 }, list = ['TEST'];
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var v = String(r[0] || '').trim().toUpperCase();
      if (v && !out[v] && !_isLeftClass_(v)) { out[v] = 1; list.push(v); }   /* LEFT … is no class to choose (7 Oct 2026) */
    });
  }
  list.sort();
  return list;
}

/* The Setup tab is where you press things: the checkboxes are buttons — tick one and it
   runs, then unticks itself. These two constants are the rows those things are written
   on, and must match the `lines` array inside _styleSetup_. */
var URL_ROW = 12;
var BTN_ROW = { refresh: 18, restyle: 19 };

function _styleSetup_() {
  var sh = _sheet_(T_SETUP);
  var url = '';
  try { url = String(sh.getRange(URL_ROW, 2).getValue() || '').trim(); } catch (e) {}
  if (!/^https?:/i.test(url)) url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') || '';
  if (!url) url = '(paste your /exec URL here, so you can find it again)';
  sh.clear();
  sh.getBandings().forEach(function (b) { b.remove(); });

  var lines = [
    ['Biology Labs', 'one spreadsheet for every lab'],
    ['', ''],
    ['Students', 'every student, every lab, best score so far. Filter the Class column to see one class.'],
    ['Labs', 'one row for each lab in the script, written afresh by every Tidy up, with how many saves it has had.'],
    ['Digestion, Circulation, …', 'your class list again, one tab per lab. Every student has a row from the moment you import them; their first save fills it in. Every later save updates the same row and keeps the better score.'],
    ['Rejected', 'a save from one of your students whose numbers did not add up.'],
    ['', ''],
    ['Only your students land here', 'work is kept when the Google account that signed in is on the Students tab. The lab sends it on its own while they work — nothing is handed in. The labs are public, so anyone in the world may use them — their work is not recorded anywhere.'],
    ['', ''],
    ['Reading a heading', 'dark green = filled in for you.   ✎ amber = yours to change.   Hover any heading to see what it is for.'],
    ['', ''],
    ['Web app URL', url],
    ['', ''],
    ['Buttons', 'tick one. It unticks itself straight away and gets on with the job — watch the line that appears to the right of it, which stays until you use that button again.'],
    ['', ''],
    ['Import students from Classroom', 'on the 🧪 Biology Labs menu (it opens a window, so it cannot be a checkbox)'],
    ['', ''],
    ["Refresh everyone's progress", ''],
    ['Tidy up — rebuild anything missing, re-apply the formatting', ''],
    ['', ''],
    ['If something looks wrong', '🧪 Biology Labs ▸ Check the set-up'],
    ['After editing the script', 'Deploy ▸ Manage deployments ▸ pencil ▸ Version: New version ▸ Deploy, on each of your deployments']
  ];
  sh.getRange(1, 1, lines.length, 2).setValues(lines);
  sh.getRange('A1').setFontSize(17).setFontWeight('bold').setFontColor(INK);
  sh.getRange('B1').setFontColor('#6B7B6F');
  sh.getRange(3, 1, lines.length - 2, 1).setFontWeight('bold').setFontColor(INK);
  sh.getRange(14, 1).setFontSize(13);
  sh.getRange(1, 1, lines.length, 2).setVerticalAlignment('middle').setWrap(true);
  sh.setColumnWidth(1, 260); sh.setColumnWidth(2, 720); sh.setColumnWidth(3, 60);
  sh.setColumnWidth(4, 430);
  for (var r = 1; r <= lines.length; r++) sh.setRowHeight(r, r === 1 ? 34 : 24);

  /* the buttons */
  Object.keys(BTN_ROW).forEach(function (k) {
    var r = BTN_ROW[k];
    sh.getRange(r, 3).insertCheckboxes().setValue(false).setHorizontalAlignment('center');
    sh.getRange(r, 1, 1, 3).setBackground('#EFF5F0');
  });
  sh.getRange(BTN_ROW.refresh, 1, 2, 1).setFontColor(INK);
  sh.setHiddenGridlines(true);
}

/* Ticking a button runs it. Installed by setup(); a simple onEdit could not do this. */
function _installButtons_() {
  var have = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'onButtonTicked';
  });
  if (have) return;
  ScriptApp.newTrigger('onButtonTicked')
    .forSpreadsheet(_ss_()).onEdit().create();
}

function onButtonTicked(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== T_SETUP) return;

  if (e.range.getColumn() !== 3) return;
  if (e.range.getValue() !== true) return;
  var row = e.range.getRow();

  /* The box unticks itself the moment you tick it, and some of these take a while. Without
     something that STAYS on the screen you cannot tell the difference between "it is working"
     and "nothing happened" — a toast is gone in a few seconds, and you may not be looking. So
     the message is written into the sheet beside the button and left there. */
  var started = new Date();
  _btnSays_(row, '⏳  Working… started ' + _hhmm_(started) + '. Please wait — do not tick again.');
  e.range.setValue(false);
  SpreadsheetApp.flush();

  try {
    var did = '';
    _PROGRESS_ROW = row;
    if (row === BTN_ROW.refresh) { refreshDashboard(); did = 'Progress refreshed'; }
    else if (row === BTN_ROW.restyle) { did = 'Tidied up. ' + setup(); }
    else { _btnSays_(row, ''); return; }
    _PROGRESS_ROW = null;
    var secs = Math.round((new Date() - started) / 1000);
    /* the Students tab not restyled (its guard) is a warning: amber, the time first, then what to do (Tidy up's own text
       already carries the note; Refresh's gets it here) */
    _btnSays_(row, (_STUDENTS_NOT_STYLED_ ? '⚠️  ' : '✅  ') + did + ' at ' + _hhmm_(new Date()) + ' (took ' + secs + 's)' +
                   (_STUDENTS_NOT_STYLED_ && row === BTN_ROW.refresh ? '. ' + _STUDENTS_NOT_STYLED_ : ''));
  } catch (err) {
    _PROGRESS_ROW = null;
    _btnSays_(row, '❌  That did not work: ' + err);
    SpreadsheetApp.getActive().toast('That button failed: ' + err, 'Biology Labs', 30);
  }
}

function _hhmm_(d) {
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

/* A long job talks while it works. "Working…" for two minutes is indistinguishable from a
   script that has died, so each step says what it is on and how far along it is, written into
   the sheet beside the button and flushed so it appears at once rather than at the end. */
var _PROGRESS_ROW = null;
var _PROGRESS_JOB = null;      /* an import in progress, so the dialog can be told as well */
var _PROGRESS_SEEN = null;
function _step_(msg) {
  /* A toast shows wherever this was started from. _PROGRESS_ROW is only set when a button on the
     Setup tab was ticked, so running Tidy up from the MENU used to report nothing whatsoever until
     the alert at the very end. */
  try { _ss_().toast(msg, 'Working…', -1); } catch (e) {}
  if (_PROGRESS_ROW) {
    try { _btnSays_(_PROGRESS_ROW, '\u23F3  ' + msg); SpreadsheetApp.flush(); } catch (e) {}
  }
  if (_PROGRESS_JOB) {
    try { _publish_(_PROGRESS_JOB.id, _PROGRESS_JOB.results, false, msg); } catch (e) {}
  }
}

/* The line beside a button. It stays until that button is used again. */
function _btnSays_(row, text) {
  var sh = _sheet_(T_SETUP);
  sh.getRange(row, 4).setValue(text)
    .setFontColor(text.indexOf('❌') === 0 ? '#A3342A' : (text.indexOf('⏳') === 0 || text.indexOf('⚠') === 0 ? '#7A5B00' : '#265C33'))
    .setFontWeight('bold').setVerticalAlignment('middle').setWrap(false);
}

var _STUDENTS_NOT_STYLED_ = '';   /* set by _styleStudents_ when its guard refused; Tidy up and Refresh say it */
function _styleStudents_() {
  var sh = _sheet_(T_STUDENTS);
  /* _dress2_ below writes the heading row BY POSITION: a trailing heading the tab lacks is inserted first (Tidy up, 📊 Refresh
     everyone's progress, the restyle: every path comes here; the audit, 8 Oct 2026, found Refresh writing "Accommodation"
     over a teacher's own column), and the guard below refuses to write over any heading that is not the one planned */
  _studentTrailColumns_(sh);
  var built = {};
  /* built = live: its questions are counted in LABS, as Lab progress on the teacher page reads it. Every lab has a tab
     from the first Tidy up, so a tab is no sign of a built lab (labs-script-025, 1 Oct 2026). */
  LABS.forEach(function (l) { built[l.id] = (l.questions || 0) > 0; });

  var cols = [
    { h:'Name', w:210, edit:true,
      note:'The student, as Google Classroom spells it. Correct a spelling here and it follows them into every lab tab the next time you import or Tidy up. Work is matched by school email, not by this, so a correction cannot lose anybody\'s work.' },
    { h:'Class', w:88, align:'center', bold:true, edit:true, list:_classList_(),
      note:'Which class they are in. Used by the filter, and shown on every lab tab.\n\n' +
           'TEST is always here, for a row of your own used to check a lab end to end.\n\n' +
           'A class not on this list still works — the box only warns. Press Tidy up and it ' +
           'joins the list.' }
  ];
  /* In the order the sheet already has them, not the order LABS happens to be in. A sheet
     built before a lab existed has its own order, and relabelling a column would write one
     lab's heading over another lab's marks. Labs the sheet has never seen go on the end. */
  var order = _labOrderOnSheet_(sh);
  order.forEach(function (l, i) {
    cols.push({ h:l.name, w:_wide_(l.name, 108), align:'center', fmt:'0%', group: i === 0,
                head: built[l.id] ? HDR_AUTO : HDR_SOON,
                note:'Topic ' + l.topic + '.\n\nTheir best score in this lab so far.' +
                     (built[l.id] ? '' : '\n\nThis lab is not built yet, so the column stays empty.') });
  });
  cols.push({ h:'Labs started', w:112, align:'center', fmt:'0', group:true,
              note:'How many labs they have saved something in.' });
  cols.push({ h:'Average', w:94, align:'center', fmt:'0%', bold:true,
              note:'The average of the labs they have started. Labs they have not touched are not counted against them.' });
  cols.push({ h:'School email', w:240, hide:true, note:'From Classroom. This is what stops a student being imported twice.' });
  cols.push({ h:'Classroom course', w:230, hide:true, note:'The course they were imported from.' });
  cols.push({ h:'Imported', w:110, fmt:'dd MMM yyyy', hide:true, note:'When they were first imported.' });
  cols.push({ h:'Classroom user id', w:160, hide:true, note:'Needed to post homework to Google Classroom (Set homework, on the teacher page).' });
  cols.push({ h:'Course id', w:140, hide:true, note:'Needed to post homework to Google Classroom (Set homework, on the teacher page).' });
  /* 8 Oct 2026 (Daniel): help for the pupils who need it, by the teacher's choice. At the END: Tidy up writes these
     headings by position, so a new column only ever goes last. */
  cols.push({ h:'Accommodation', w:132, align:'center', edit:true, list:['Yes'], group:true,
              note:'Yes = this pupil gets help the others do not, after a SECOND, different wrong try: an explanation of what they ' +
                   'got wrong, where one is written (the labs\' multiple-choice questions; Bio English\'s fix, trim, mark, keyword and ' +
                   'exam cards; the Write-Up tests). Bio English also shows keyword meanings in Korean or Chinese (the pupil chooses). Empty = no help, ' +
                   'as for everyone else.\n\nType Yes here, or use ' +
                   'the teacher page (Students, a pupil\'s card). Not X: in Korea X means no. The pupil sees it the next time a page ' +
                   'loads. Keep it right after Course id: while a column is out of its place, Tidy up does not restyle this tab, and says so.' });

  /* THE GUARD (the verification audit, 8 Oct 2026): _dress2_ writes the heading row BY POSITION, so it may only run where
     every column already carries its own heading, or none. A column out of its place (Accommodation or Labs started
     dragged next to the names, a lab among the trailing columns, a lab added to LABS before Tidy up gave it a column, a
     teacher's own column among them) would otherwise take its neighbour's heading, and School email with it: every save
     refused, and the next 📊 Refresh wrote over the addresses. Then the tab is NOT restyled, and Tidy up and Refresh say
     which column is where. Saving, the import and Refresh find every column by its heading, so they go on working. */
  _STUDENTS_NOT_STYLED_ = '';
  var have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
               .map(function (h) { return String(h || '').replace(/^✎\s*/, '').trim(); }) : [];
  var ORDER = ' Put the columns back in their order (Name, Class, the labs, Labs started, Average, School email, Classroom course, ' +
              'Imported, Classroom user id, Course id, Accommodation; columns of your own after those), then press Tidy up again ' +
              '(it also gives a newly added lab its column).';
  for (var gi = 0; gi < cols.length; gi++) {
    /* a heading twice (the script reads the first, which may be the empty one); the planned heading standing somewhere else
       (an empty column inserted before it: written over, the empty one became the column every save reads); a different
       heading in a planned column (the final verification audit, 8 Oct 2026) */
    var want = cols[gi].h, seenAt = have.indexOf(want), twice = seenAt >= 0 ? have.indexOf(want, seenAt + 1) : -1, why = '';
    if (twice >= 0) why = 'two columns are headed "' + want + '" (' + _colA1_(seenAt + 1) + ' and ' + _colA1_(twice + 1) + '), and ' +
      'the script reads only the first. Keep the one that holds your entries and delete the other (Tidy up removes it by itself ' +
      'when it is empty), then press Tidy up again.';
    else if (seenAt >= 0 && seenAt !== gi) why = '"' + want + '" stands in column ' + _colA1_(seenAt + 1) + ', but belongs in column ' +
      _colA1_(gi + 1) + (have[gi] ? ', where "' + have[gi] + '" is.' + ORDER
        : ', which has no heading. Tidy up removes that column when it is empty; if it holds something of yours, move it after ' +
          'the last column (Accommodation), then press Tidy up again.');
    else if (have[gi] && have[gi] !== want) {
      var k1 = have[gi].toLowerCase().replace(/[^a-z]/g, ''), k2 = want.toLowerCase().replace(/[^a-z]/g, '');
      why = 'column ' + _colA1_(gi + 1) + ' holds "' + have[gi] + '", where "' + want + '" belongs.' + (k1.indexOf(k2) === 0 || k2.indexOf(k1) === 0
        ? ' If it is that column, type "' + want + '" as its heading, exactly so, then press Tidy up again.'   /* retyped: "accommodation", "Accommodations" */
        : ORDER);
    }
    if (why) {
      _STUDENTS_NOT_STYLED_ = 'The Students tab was NOT restyled, so that no heading is written over another column: ' + why +
                              ' Saving and the progress figures still work.';
      return;
    }
  }

  var rows = _dress2_(sh, cols, { freezeCols: 2, tab:'#14572B' });
  if (!rows) return;

  var first = 3, L = LABS.length;
  var rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue(LOW, SpreadsheetApp.InterpolationType.NUMBER, '0')
      .setGradientMidpointWithValue(MID, SpreadsheetApp.InterpolationType.NUMBER, '0.6')
      .setGradientMaxpointWithValue(HIGH, SpreadsheetApp.InterpolationType.NUMBER, '1')
      .setRanges([sh.getRange(2, first, rows, L), sh.getRange(2, first + L + 1, rows, 1)]).build()
  ];
  /* the grey of a lab not built yet goes on THAT lab's column: the headings above are in the sheet's order, which can
     differ from LABS' (labs-script-006) */
  order.forEach(function (l, i) {
    if (built[l.id]) return;
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenCellEmpty()
      .setBackground('#F2F2EF').setRanges([sh.getRange(2, first + i, rows, 1)]).build());
  });
  sh.setConditionalFormatRules(rules);
}

/* The dashboard: every student, every lab, best score so far. Read straight out of each lab's tab, which
   holds one row per student — so a name is matched by email, not by how it was typed — and written as
   values rather than formulas, so a lab nobody has used simply leaves its column empty. */
function refreshDashboard() {
  if (!_isAdminCaller_()) return;   /* reachable by anyone via google.script.run: these are expensive owner-privileged writes */
  var sh = _sheet_(T_STUDENTS);
  var rows = Math.max(0, sh.getLastRow() - 1);
  if (!rows) {
    _styleStudents_();
    if (_STUDENTS_NOT_STYLED_) { try { SpreadsheetApp.getActive().toast(_STUDENTS_NOT_STYLED_, 'Biology Labs', 30); } catch (e) {} }
    return;
  }

  var EMAIL_COL = _emailCol_(sh);
  var emails = sh.getRange(2, EMAIL_COL, rows, 1).getValues();
  var rowOf = {};
  emails.forEach(function (r, i) { var e = _cleanEmail_(r[0]); if (e) rowOf[e] = i; });

  var L = LABS.length;
  var grid = emails.map(function () { var a = []; for (var i = 0; i < L + 2; i++) a.push(''); return a; });

  LABS.forEach(function (lab, c) {
    var tab = _ss_().getSheetByName(lab.name);
    if (!tab || tab.getLastRow() < 2) return;
    var n = tab.getLastRow() - 1;
    var pct = tab.getRange(2, 5, n, 1).getValues();
    var mail = tab.getRange(2, LAB_EMAIL, n, 1).getValues();
    for (var i = 0; i < n; i++) {
      var e = _cleanEmail_(mail[i][0]);
      if (!e || !(e in rowOf) || pct[i][0] === '') continue;
      grid[rowOf[e]][c] = Number(pct[i][0]) || 0;
    }
  });

  grid.forEach(function (row) {
    var done = 0, sum = 0;
    for (var c = 0; c < L; c++) if (row[c] !== '') { done++; sum += row[c]; }
    row[L] = done || '';
    row[L + 1] = done ? sum / done : '';
  });

  /* labs-script-006 (30 Sep 2026) — each figure goes under ITS OWN heading, found by name, never by where the lab sits
     in LABS. The sheet keeps its lab columns in the order they were made (_labOrderOnSheet_), and a lab added to LABS
     later gets a column at the END of the labs (_repairStudentColumns_), so the two orders can part: written by LABS
     position, Plants (put in the middle of LABS on 8 Sep) showed under Inheritance, and every lab after it one heading
     to the right. A lab with no column yet (Tidy up adds one) is left out, never written over its neighbour; its work
     still counts in Labs started and Average. */
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
               .map(function (h) { return String(h || '').replace(/^✎\s*/, '').trim(); });
  var put = [];                                     /* [sheet column, place in a grid row] */
  LABS.map(function (l) { return l.name; }).concat(['Labs started', 'Average']).forEach(function (name, k) {
    var at = head.indexOf(name);
    if (at >= 0) put.push([at + 1, k]);
  });
  put.sort(function (a, b) { return a[0] - b[0]; });
  /* one write per run of neighbouring columns: a single write on a sheet laid out as Tidy up lays it out */
  for (var lo = 0; lo < put.length; ) {
    var hi = lo;
    while (hi + 1 < put.length && put[hi + 1][0] === put[hi][0] + 1) hi++;
    var a0 = lo, a1 = hi;
    sh.getRange(2, put[lo][0], rows, hi - lo + 1).setValues(grid.map(function (row) {
      var out = []; for (var j = a0; j <= a1; j++) out.push(row[put[j][1]]); return out;
    }));
    lo = hi + 1;
  }
  _styleStudents_();
  SpreadsheetApp.getActive().toast('Progress updated for ' + rows + ' students.' + (_STUDENTS_NOT_STYLED_ ? ' ' + _STUDENTS_NOT_STYLED_ : ''),
                                   'Biology Labs', _STUDENTS_NOT_STYLED_ ? 30 : 5);
}


function _styleLabs_() {
  _dress2_(_sheet_(T_LABS), [
    { h:'Lab id', w:170, note:'What the lab\'s own page sends, from the script\'s own list of labs. Tidy up writes this tab afresh, so a change typed here does not last.' },
    { h:'Lab', w:130, note:'The name of this lab\'s tab in this spreadsheet.' },
    { h:'Topic', w:200, note:'Which IGCSE topic it covers.' },
    { h:'Saves', w:100, align:'center', fmt:'0', note:'How many saves that lab has had. Counted for you.' }
  ], { freezeCols: 2, tab:'#6E8F7C' });
}

/* "Saves" on the Labs tab (labs-script-007, 30 Sep 2026): each lab tab's own Saves column (J), added up. It used to
   count the Class column, which every pupil has from the moment they are imported, so it showed the size of the
   roster. The formula is the script's ("Counted for you"): _labsRows_ writes it into every lab's row. */
function _labsSaves_(row) {
  return '=IFERROR(SUM(INDIRECT("\'"&B' + row + '&"\'!J2:J")),0)';
}
/* The Labs tab, written afresh from LABS by every Tidy up (labs-script-019; Daniel's choice, 1 Oct 2026): one row
   per lab, in LABS order, so a lab the script no longer has (Plant nutrition and Plant transport, before plants-lab)
   goes, and a new lab gets its row. The old Questions column goes too: nothing read it (a save is checked against
   LABS). A column of the teacher's own (any other heading, or notes typed under none) is kept, as _labColsReady_ keeps
   one on a lab tab: it stays to the right of ours, and each of its cells stays with its lab (found by Lab id, else by
   Lab). A row of a lab the script no longer has is kept only while the teacher's own columns hold something on it.
   Returns a line for Tidy up's message, or ''. */
var LABS_TAB_COLS = ['Lab id', 'Lab', 'Topic', 'Saves'];
function _labsRows_(sh) {
  /* a heading read as its letters only, so "✎ Questions" is still the old Questions column */
  var norm = function (v) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z]/g, ''); };
  var typed = function (v) { return String(v == null ? '' : v).trim() !== ''; };
  var ours = LABS_TAB_COLS.map(norm), said = [];
  /* The Questions column goes as a whole column, so a column of the teacher's to its right moves left with its own
     width, colours and notes. */
  var lastC = sh.getLastColumn();
  if (lastC > 0) {
    var h0 = sh.getRange(1, 1, 1, lastC).getValues()[0];
    for (var q = h0.length - 1; q >= 0; q--) {
      if (norm(h0[q]) !== 'questions') continue;
      sh.deleteColumn(q + 1);
      if (!said.length) said.push('the Questions column went (nothing read it)');
    }
  }
  var lastR = sh.getLastRow(), vals = [], forms = [];
  lastC = sh.getLastColumn();
  if (lastR > 0 && lastC > 0) {
    var all = sh.getRange(1, 1, lastR, lastC);
    vals = all.getValues();
    forms = all.getFormulas();
  }
  /* a cell as the teacher left it: its formula if it has one, else its value (text that looks like a formula is
     written back as text, through _plain_) */
  var cell = function (r, c) {
    if (forms[r] && forms[r][c]) return forms[r][c];
    return typeof vals[r][c] === 'string' ? _plain_(vals[r][c]) : vals[r][c];
  };
  /* ours by heading (the first of each); any other column with something in it is the teacher's */
  var at = {}, own = [];
  (vals[0] || []).forEach(function (h, c) {
    var k = norm(h);
    if (ours.indexOf(k) >= 0 && at[k] === undefined) { at[k] = c; return; }
    for (var r = 0; r < vals.length; r++) if (typed(cell(r, c))) { own.push(c); return; }
  });
  var text = function (r, k) { return at[k] === undefined ? '' : String(vals[r][at[k]] == null ? '' : vals[r][at[k]]).trim(); };
  var theirs = function (r) { return own.map(function (c) { return r > 0 ? cell(r, c) : ''; }); };
  var used = {};
  var rows = LABS.map(function (l, i) {
    var from = -1;
    for (var r = 1; r < vals.length && from < 0; r++) {
      if (used[r]) continue;
      if (text(r, 'labid') === l.id || (text(r, 'lab') !== '' && text(r, 'lab') === l.name)) { used[r] = 1; from = r; }
    }
    return [l.id, l.name, l.topic, _labsSaves_(i + 2)].concat(theirs(from));
  });
  var gone = [], kept = [];
  for (var r = 1; r < vals.length; r++) {
    if (used[r]) continue;
    var label = text(r, 'lab') || text(r, 'labid');
    if (!own.some(function (c) { return typed(cell(r, c)); })) { if (label) gone.push(label); continue; }
    kept.push(label || 'a row with no lab');
    rows.push([text(r, 'labid'), text(r, 'lab'), text(r, 'topic'), ''].concat(theirs(r)));
  }
  if (gone.length) said.push('removed ' + gone.join(', ') + ', which the script no longer has');
  if (kept.length) said.push('kept ' + kept.join(', ') + ', which the script no longer has, because you typed on ' +
                             (kept.length === 1 ? 'its row: delete it' : 'their rows: delete them') + ' when you are done');
  var out = [LABS_TAB_COLS.concat(own.map(function (c) { return cell(0, c); }))].concat(rows);
  var width = out[0].length;
  if (sh.getMaxColumns() < width) sh.insertColumnsAfter(sh.getMaxColumns(), width - sh.getMaxColumns());
  _room_(sh, out.length);
  if (lastR > 0 && lastC > 0) sh.getRange(1, 1, lastR, lastC).clearContent();
  sh.getRange(1, 1, out.length, width).setValues(out);
  if (lastR > out.length) sh.deleteRows(out.length + 1, lastR - out.length);
  return said.length ? 'Labs tab: ' + said.join('; ') + '.' : '';
}

function _styleLab_(sh) {
  var rows = _dress2_(sh, LAB_COLS, { freezeCols: 2, tab:'#3D7A54' });
  if (!rows) return;
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue(LOW, SpreadsheetApp.InterpolationType.NUMBER, '0')
      .setGradientMidpointWithValue(MID, SpreadsheetApp.InterpolationType.NUMBER, '0.6')
      .setGradientMaxpointWithValue(HIGH, SpreadsheetApp.InterpolationType.NUMBER, '1')
      .setRanges([sh.getRange(2, 5, rows, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('progress')
      .setBackground(MID).setFontColor('#7A5B00')
      .setRanges([sh.getRange(2, 6, rows, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('complete')
      .setBackground(HIGH).setFontColor('#265C33')
      .setRanges([sh.getRange(2, 6, rows, 1)]).build(),
    /* nothing saved yet: the row is a name waiting, not a bad mark */
    SpreadsheetApp.newConditionalFormatRule().whenCellEmpty()
      .setBackground('#FAFAF7')
      .setRanges([sh.getRange(2, 3, rows, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0.4)
      .setFontColor('#A3342A').setBold(true)
      .setRanges([sh.getRange(2, 5, rows, 1)]).build()
  ]);
}



/* ============================================================
   6. Plumbing
   ============================================================ */
/* Which spreadsheet this is.
   If the script lives inside the Sheet (Extensions ▸ Apps Script), it works this out on
   its own the first time you run anything from the Sheet, and remembers it — so pasting a
   fresh copy of this file never breaks the deployment. SHEET_ID is only needed for a
   stand-alone script, or to point it at a different Sheet. */
var _SHEET_ID_CACHE = null;
function _sheetId_() {
  if (SHEET_ID && SHEET_ID !== 'PASTE_YOUR_SHEET_ID_HERE') return SHEET_ID;
  if (_SHEET_ID_CACHE) return _SHEET_ID_CACHE;
  var props = PropertiesService.getScriptProperties();
  var kept = props.getProperty('SHEET_ID');
  if (kept) { _SHEET_ID_CACHE = kept; return kept; }
  var active = SpreadsheetApp.getActiveSpreadsheet();      /* null in a web app; set from the Sheet */
  if (active) { props.setProperty('SHEET_ID', active.getId()); _SHEET_ID_CACHE = active.getId(); return active.getId(); }
  throw new Error('This script does not know which spreadsheet to use. Open the Sheet and run ' +
                  '🧪 Biology Labs ▸ Check the set-up once — that remembers it — then Deploy ▸ ' +
                  'Manage deployments ▸ pencil ▸ New version ▸ Deploy.');
}
/* openById is a round trip to the Sheets service, and this is called from inside loops over
   every lab, so Tidy up was paying for it hundreds of times. One call per execution is enough:
   a script run is short-lived, and the handle stays good for all of it. */
var _SS_CACHE = null;
function _ss_() {
  if (!_SS_CACHE) _SS_CACHE = SpreadsheetApp.openById(_sheetId_());
  return _SS_CACHE;
}
function _sheet_(name) {
  var ss = _ss_(), sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  if (name === T_LABS) {
    _labsRows_(sh);                                  /* one row per lab in LABS: _labsRows_ is this tab's one writer */
  } else if (name === T_STUDENTS) {
    var head = ['Name', 'Class'].concat(LABS.map(function (l) { return l.name; })).concat(STUDENT_TRAIL);
    /* A new sheet has 26 columns and there are more headings than that once every topic has
       a lab, so make room before writing or the write is outside the grid. */
    if (sh.getMaxColumns() < head.length) {
      sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
    }
    sh.getRange(1, 1, 1, head.length).setValues([head]);
  }
  return sh;
}

/* ------------------------------------------------------------
   Tidy up has to be safe to press in November, on a sheet holding a term of marks. Everything
   below works to one rule:

       NOTHING THAT HOLDS DATA IS MOVED, RELABELLED OR DELETED.

   A column is removed only when every cell under its heading is empty. A column with figures
   in it is kept and named in the report instead. So anything unexpected is something you read
   straight away, not something you find in a mark book months later. The report is written
   beside the button and stays there.
   ------------------------------------------------------------ */
function _studentHeadings_() {
  return ['Name', 'Class']
         .concat(LABS.map(function (l) { return l.name; }))
         .concat(STUDENT_TRAIL);
}

function _repairStudentSheet_() {
  var sh = _sheet_(T_STUDENTS), notes = [];
  if (sh.getLastColumn() < 3) return notes;

  function heads() {
    return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
             .map(function (h) { return String(h || '').replace(/^\u270E\s*/, '').trim(); });
  }
  function rowCount() { return Math.max(0, sh.getLastRow() - 1); }
  function isEmpty(c) {
    var rows = rowCount();
    if (!rows) return true;
    var v = sh.getRange(2, c, rows, 1).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][0] === null || v[i][0] === undefined ? '' : v[i][0]).trim() !== '') return false;
    }
    return true;
  }
  /* Right to left, so deleting one column cannot shift the next one still to be looked at. */
  function dropEmpty(cols, what) {
    var head = heads(), gone = 0, kept = [];
    cols.sort(function (a, b) { return b - a; }).forEach(function (c) {
      if (isEmpty(c)) { sh.deleteColumn(c); gone++; }
      else kept.push(head[c - 1]);
    });
    if (gone) notes.push(gone + ' empty ' + what + ' column' + (gone === 1 ? '' : 's') + ' removed.');
    if (kept.length) {
      notes.push('Kept, because there is still something in ' +
                 (kept.length === 1 ? 'it' : 'them') + ': ' + kept.join(', ') +
                 '. Move what you want out of the way, then press Tidy up again.');
    }
  }

  /* 1. the same heading twice. The leftmost is the real one — it is where the script reads and writes. So an EMPTY leftmost
        copy before a copy that holds entries goes first (an empty column given the heading by hand, as a note once said:
        every save then read the empty one; the final verification audit, 8 Oct 2026), then every other empty copy. */
  var head = heads(), copies = Object.create(null), lead = [];
  head.forEach(function (h, i) { if (h) (copies[h] = copies[h] || []).push(i + 1); });
  Object.keys(copies).forEach(function (h) {
    var c = copies[h];
    if (c.length > 1 && isEmpty(c[0]) && c.slice(1).some(function (x) { return !isEmpty(x); })) lead.push(c[0]);
  });
  if (lead.length) {
    var leadNames = lead.map(function (c) { return '"' + head[c - 1] + '"'; }).join(', ');
    lead.sort(function (a, b) { return b - a; }).forEach(function (c) { sh.deleteColumn(c); });
    notes.push('An empty column headed ' + leadNames + ' stood before the column of that name that holds your entries, so the ' +
               'script read the empty one. Removed.');
  }
  head = heads();
  var firstAt = {}, dupes = [];
  head.forEach(function (h, i) {
    if (!h) return;
    if (firstAt[h] === undefined) firstAt[h] = i; else dupes.push(i + 1);
  });
  if (dupes.length) dropEmpty(dupes, 'repeated');

  /* 1b. an EMPTY column with no heading among the script's own columns (put in by hand): the headings are written by
         position, so it would take the next column's heading and place (the final verification audit, 8 Oct 2026). Removed
         only when every cell in it is empty; one that holds something is left where it is, and the guard in
         _styleStudents_ names it. */
  head = heads();
  var planned = _studentHeadings_(), lastPlanned = -1, blanks = [];
  head.forEach(function (h, i) { if (h && planned.indexOf(h) >= 0) lastPlanned = i; });
  for (var bi = 2; bi < lastPlanned; bi++) { if (!head[bi] && isEmpty(bi + 1)) blanks.push(bi + 1); }
  if (blanks.length) {
    blanks.sort(function (a, b) { return b - a; }).forEach(function (c) { sh.deleteColumn(c); });
    notes.push(blanks.length + ' empty column' + (blanks.length === 1 ? '' : 's') + ' with no heading removed from among the ' +
               'Students tab’s columns.');
  }

  /* 2. a heading this script no longer knows: a lab taken out of LABS, a renamed lab under its
        old name, or something typed in by hand. */
  head = heads();
  var known = _studentHeadings_(), strays = [];
  head.forEach(function (h, i) { if (h && known.indexOf(h) < 0) strays.push(i + 1); });
  if (strays.length) dropEmpty(strays, 'unrecognised');

  /* 3. an address carries whatever was pasted with it, and a save is matched on the address.
        A trailing space is invisible and loses every mark that student ever saves. */
  head = heads();
  var ec = head.indexOf('School email') + 1, rows = rowCount(), fixed = 0;
  if (ec > 0 && rows > 0) {
    var v = sh.getRange(2, ec, rows, 1).getValues(), out = [];
    for (var i = 0; i < v.length; i++) {
      var was = String(v[i][0] === null || v[i][0] === undefined ? '' : v[i][0]);
      var now = _cleanEmail_(was);
      if (now && now.indexOf('@') > 0 && now !== was) { out.push([now]); fixed++; }
      else out.push([was]);
    }
    if (fixed) {
      sh.getRange(2, ec, rows, 1).setValues(out);
      notes.push(fixed + ' school address' + (fixed === 1 ? '' : 'es') +
                 ' had spaces or hidden characters around ' + (fixed === 1 ? 'it' : 'them') +
                 ', which stops their work being matched. Cleaned.');
    }
  }
  /* 4. two rows sharing one address. Nothing is deleted, because either row might be the right
        one, but it has to be said: a save is matched on the address and the first row wins,
        so the other student's name is written over theirs on every lab tab the next time this
        runs. On the sheet it looks like marks moving between people. */
  head = heads();
  ec = head.indexOf('School email') + 1;
  rows = rowCount();
  if (ec > 0 && rows > 0) {
    var addr = sh.getRange(2, ec, rows, 1).getValues();
    var who = sh.getRange(2, 1, rows, 1).getValues();
    var at = {}, clashes = [];
    for (var j = 0; j < addr.length; j++) {
      var a = _cleanEmail_(addr[j][0]);
      if (!a) continue;
      if (at[a] === undefined) { at[a] = j; continue; }
      clashes.push(a + ' (rows ' + (at[a] + 2) + ' and ' + (j + 2) + ': ' +
                   String(who[at[a]][0]) + ', ' + String(who[j][0]) + ')');
    }
    if (clashes.length) {
      notes.push('TWO ROWS SHARE ONE ADDRESS, so one student\u2019s marks will be filed under ' +
                 'the other: ' + clashes.join('; ') + '. Nothing was changed \u2014 correct the ' +
                 'address and press Tidy up again.');
    }
  }

  return notes;
}

/* The same on every lab tab: a student's row is found by the address in it, so a stray space
   there loses their marks just as surely. */
function _repairLabEmails_() {
  var fixed = 0, tabs = 0;
  LABS.forEach(function (l) {
    var sh = _ss_().getSheetByName(l.name);
    if (!sh || sh.getLastRow() < 2) return;
    var rows = sh.getLastRow() - 1;
    var v = sh.getRange(2, LAB_EMAIL, rows, 1).getValues(), out = [], n = 0;
    for (var i = 0; i < v.length; i++) {
      var was = String(v[i][0] === null || v[i][0] === undefined ? '' : v[i][0]);
      var now = _cleanEmail_(was);
      if (now && now.indexOf('@') > 0 && now !== was) { out.push([now]); n++; }
      else out.push([was]);
    }
    if (n) { sh.getRange(2, LAB_EMAIL, rows, 1).setValues(out); fixed += n; tabs++; }
  });
  if (!fixed) return [];
  return [fixed + ' address' + (fixed === 1 ? '' : 'es') + ' on ' + tabs + ' lab tab' +
          (tabs === 1 ? '' : 's') + ' had spaces or hidden characters around them. Cleaned.'];
}

/* The labs in the order this sheet already lists them, then any it has not seen. */
function _labOrderOnSheet_(sh) {
  var out = [], seen = {}, n = sh.getLastColumn();
  if (n > 0) {
    sh.getRange(1, 1, 1, n).getValues()[0].forEach(function (h) {
      var name = String(h || '').replace(/^✎\s*/, '').trim();
      for (var i = 0; i < LABS.length; i++) {
        if (LABS[i].name === name && !seen[LABS[i].id]) { seen[LABS[i].id] = 1; out.push(LABS[i]); }
      }
    });
  }
  LABS.forEach(function (l) { if (!seen[l.id]) { seen[l.id] = 1; out.push(l); } });
  return out;
}

/* Formatting trims a tab down to six spare rows, so a fresh sheet's thousand are long gone by
   the time a second class is imported. Writing past the last row throws, and the import dies
   part way with some tabs done and some not. Every append asks for room first. */
function _room_(sh, needRow) {
  var have = sh.getMaxRows();
  if (needRow > have) sh.insertRowsAfter(have, needRow - have + 10);
  return sh;
}

/* Where the school email actually is on the Students tab.
   It used to be worked out as 3 + LABS.length + 2 — Name, Class, one column per lab, then
   Labs started and Average. That is right for a sheet built by THIS version of the script,
   and wrong for one built before a lab was added: the sheet still has the old number of lab
   columns, so the count points a column too far and nobody is found on the roster. Every
   save then comes back "not on this class list", with nothing to say why.
   So: read the heading row and find it. Falls back to the old arithmetic only if the sheet
   has no heading yet. */
function _emailCol_(sh) {
  var n = sh.getLastColumn();
  if (n > 0) {
    var head = sh.getRange(1, 1, 1, n).getValues()[0];
    for (var i = 0; i < head.length; i++) {
      if (String(head[i] || '').replace(/^✎\s*/, '').trim() === 'School email') return i + 1;
    }
  }
  return 3 + LABS.length + 2;
}

/* A lab added since the Students tab was built has no column there. Insert one at the end of the
   labs already there, so no existing column moves and no heading is written over values that
   belong to something else. */
function _repairStudentColumns_() {
  var sh = _sheet_(T_STUDENTS);
  var n = sh.getLastColumn();
  if (n < 3) return 0;
  var head = sh.getRange(1, 1, 1, n).getValues()[0]
               .map(function (h) { return String(h || '').replace(/^✎\s*/, '').trim(); });
  if (head.indexOf('Labs started') < 0 && head.indexOf('School email') < 0) return 0;
  var added = 0;
  /* In LABS order among themselves. The sheet's lab columns can then stand in another order than
     LABS', and that is fine: _styleStudents_ follows the sheet (_labOrderOnSheet_) and refreshDashboard
     finds each lab by its heading (labs-script-006). */
  for (var i = 0; i < LABS.length; i++) {
    if (head.indexOf(LABS[i].name) >= 0) continue;
    var at = head.indexOf('Labs started');      /* on the end of the labs already there, so no
                                                   existing column is ever moved or relabelled */
    if (at < 0) at = head.indexOf('School email');
    sh.insertColumnBefore(at + 1);
    sh.getRange(1, at + 1).setValue(LABS[i].name);
    head.splice(at, 0, LABS[i].name);
    added++;
  }
  return added;
}

/* The columns after the labs, in their order (_studentHeadings_). A heading the sheet lacks is decided by the column right
   after its neighbour, where it belongs:
   - nothing there, or the NEXT heading of this list (its column was deleted): it is INSERTED there;
   - for Accommodation, the one heading added after tabs were in use (STUDENT_TRAIL_NEW; every tab has had the others since
     7 Sep 2026), a column of the teacher's own (another heading, or notes under none): it is INSERTED before it, never
     written over it (found 8 Oct 2026, adding Accommodation);
   - a column with NO heading that is empty or holds only this column's own kind of value (its heading cleared by mistake),
     or one headed like it ("Accommodations"): nothing is inserted. The first gets its heading back from _dress2_; the
     second is named by _styleStudents_' guard. An inserted empty column would have become the one every save reads, the
     real one pushed aside (the final verification audit, 8 Oct 2026: School email, Accommodation).
   Nothing is ever MOVED: a first version moved a misplaced column back next to its neighbour, and with Labs started dragged
   next to the names it pulled the hidden addresses along and every save was refused (the verification audit, 8 Oct 2026).
   A column out of its place is left where it is; the guard then refuses to restyle the tab and says which one. A heading
   whose neighbour is missing too is left to _repairStudentSheet_ and the teacher. Returns the headings added. */
var STUDENT_TRAIL = ['Labs started', 'Average', 'School email', 'Classroom course', 'Imported', 'Classroom user id', 'Course id', 'Accommodation'];
var STUDENT_TRAIL_NEW = {                     /* the heading added after tabs were in use, and the values its own column holds */
  'Accommodation': /^(yes|y|true|no|n|x|o|false|[✓✔✅☑✗✘]️?)$/i };
function _studentTrailColumns_(sh) {
  var n = sh.getLastColumn(), done = [];
  if (n < 3) return done;
  var heads = function () { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').replace(/^✎\s*/, '').trim(); }); };
  var key = function (h) { return String(h || '').toLowerCase().replace(/[^a-z]/g, ''); };
  var ownKind = function (c, like) {          /* every cell under column c is empty, or a value of that column's own kind */
    var rows = sh.getLastRow() - 1;
    if (rows < 1) return true;
    return sh.getRange(2, c, rows, 1).getValues().every(function (r) { var v = String(r[0] == null ? '' : r[0]).trim(); return !v || like.test(v); });
  };
  var head = heads();
  for (var t = 1; t < STUDENT_TRAIL.length; t++) {
    var want = STUDENT_TRAIL[t], prev = head.indexOf(STUDENT_TRAIL[t - 1]);
    if (prev < 0 || head.indexOf(want) >= 0) continue;
    var next = prev + 1 < head.length ? head[prev + 1] : null, insert;
    if (next === null || STUDENT_TRAIL.indexOf(next) > t) insert = true;
    else if (!STUDENT_TRAIL_NEW[want]) insert = false;
    else if (next) insert = key(next).indexOf(key(want)) !== 0;
    else insert = !ownKind(prev + 2, STUDENT_TRAIL_NEW[want]);
    if (!insert) continue;
    sh.insertColumnAfter(prev + 1);
    sh.getRange(1, prev + 2).setValue(want);
    try { sh.showColumns(prev + 2); } catch (e) {}   /* inserted beside a hidden column (Course id), it must not be hidden too */
    done.push(want);
    head = heads();
  }
  return done;
}

/* Put the tabs in order: Setup, Labs, Students, ✍️ Bio English, 📚 Homework, 👩‍🏫 Teachers,
   🔗 Teacher links, then one tab per lab in LABS order (the syllabus order, except that Plants,
   topic 6, comes after Reproduction), then Rejected. A new tab lands on the end, so without this
   the order would be the order the tabs happened to be made in. This moves them instead of
   rebuilding anything, so no data is touched. Any tab of your own that is not in this list is
   left where it is, after the ones that are. */
function _orderTabs_() {
  var ss = _ss_();
  /* the tabs a teacher actually opens sit at the front; the twenty lab tabs are data behind them */
  /* Bio English and the Write-Up Lab sit with the people, after Students and before the homework, not among the labs */
  var want = [T_SETUP, T_LABS, T_STUDENTS, T_ENGLISH, T_WRITEUP, T_HOMEWORK, T_TEACHERS, T_LINKS]
             .concat(LABS.map(function (l) { return l.name; }))
             .concat([T_REJECTED]);
  var looking = null;
  try { looking = ss.getActiveSheet(); } catch (e) {}     /* put the teacher back where they were */
  var pos = 0, moved = 0;
  for (var i = 0; i < want.length; i++) {
    var sh = ss.getSheetByName(want[i]);
    if (!sh) continue;                                    /* a lab with no tab yet */
    pos++;
    if (sh.getIndex() === pos) continue;                  /* already in the right place */
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(pos);
    moved++;
  }
  if (looking) { try { ss.setActiveSheet(looking); } catch (e) {} }
  return moved;
}

function _labById_(id) {
  for (var i = 0; i < LABS.length; i++) if (LABS[i].id === id) return LABS[i];
  return null;
}
/* A lab's tab is the class list for that lab: every student has a row from the moment
   they are imported, empty until their first save. So you can see at a glance who has done it
   and who has not, rather than waiting for rows to appear. */
function _labSheet_(lab) {
  var ss = _ss_(), sh = ss.getSheetByName(lab.name);
  if (!sh) {
    sh = ss.insertSheet(lab.name);
    sh.getRange(1, 1, 1, LAB_COLS.length).setValues([LAB_COLS.map(function (c) { return c.h; })]);
  }
  return _labColsReady_(sh);
}
/* A tab made before columns were added to LAB_COLS is narrower than LAB_COLS, and reading or writing past a
   sheet's last column THROWS — every save to it would fail until somebody pressed Tidy up. So the columns
   are added the moment a tab is used, with their headings. A heading cell that already holds something else
   (a column of the teacher's own) is never written over: a fresh column goes in front of it. Checked once
   per tab per six hours. */
function _labColsReady_(sh) { return _colsReady_(sh, LAB_COLS, LAB_SNAP, 'LABCOLS'); }
/* `cols` is a tab's column list, `from` how many of its columns every copy of the tab already has. */
function _colsReady_(sh, cols, from, tag) {
  var need = cols.length, cache = null, key = tag + need + '_' + sh.getName();
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  var have = sh.getMaxColumns();
  if (have >= need && cache && cache.get(key)) return sh;
  if (have < need) sh.insertColumnsAfter(have, need - have);
  /* a heading read as its letters only, so "✎ Practised again" or "Practised again ✓" is still ours */
  var norm = function (v) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z]/g, ''); };
  var last = sh.getLastRow();
  for (var i = from; i < need; i++) {                    /* only the columns added later */
    var v = sh.getRange(1, i + 1).getValue();
    if (norm(v) === norm(cols[i].h)) continue;
    /* free only when its heading AND everything under it are blank; anything else is somebody's own column
       (notes typed under no heading too), moved one to the right and kept */
    if (String(v == null ? '' : v).trim() !== '' || (last >= 2 && !sh.getRange(2, i + 1, last - 1, 1).isBlank()))
      sh.insertColumnBefore(i + 1);
    sh.getRange(1, i + 1).setValue(cols[i].h);
    /* a column inserted beside a hidden one can come out hidden too: say which it is */
    if (cols[i].hide) sh.hideColumns(i + 1); else sh.showColumns(i + 1);
  }
  try { if (cache) cache.put(key, '1', 21600); } catch (e) {}
  return sh;
}
/* The rows of a lab tab, LAB_COLS wide, whatever the tab's own width: a read past the last column throws,
   and a column the tab does not have yet reads as blank. For the readers that must never write (the pull a
   student's page makes). */
function _labRows_(sh, from, n) {
  var w = Math.min(LAB_COLS.length, sh.getMaxColumns());
  return sh.getRange(from, 1, n, w).getValues().map(function (r) {
    while (r.length < LAB_COLS.length) r.push('');
    return r;
  });
}

/* Give every student on the roster a row here, and leave the ones already present alone.
   Safe to run as often as you like — it is keyed on the school email. */
function _seedLab_(lab, notes) {
  var sh = _labSheet_(lab);
  var roster = _sheet_(T_STUDENTS);
  if (roster.getLastRow() < 2) return sh;
  var EMAIL_COL = _emailCol_(roster);      /* the ROSTER's email column, not this lab tab's */
  var people = roster.getRange(2, 1, roster.getLastRow() - 1, EMAIL_COL).getValues();

  var have = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, LAB_EMAIL, sh.getLastRow() - 1, 1).getValues()
      .forEach(function (r, i) { var e = _cleanEmail_(r[0]); if (e) have[e] = i + 2; });
  }
  /* Somebody taken off the Students tab should not linger on a lab tab. Their row goes only
     if nothing was ever saved in it. A row with marks on it is kept and named instead:
     deleting it would destroy the only record that the work was ever done, and a name can be
     removed from a roster by accident far more easily than a term of marks can be got back. */
  var onRoster = {};
  people.forEach(function (p) {
    var e = _cleanEmail_(p[EMAIL_COL - 1]);
    if (e) onRoster[e] = true;
  });
  if (sh.getLastRow() > 1) {
    var all = sh.getRange(2, 1, sh.getLastRow() - 1, LAB_COLS.length).getValues();
    var gone = 0, held = [];
    for (var k = all.length - 1; k >= 0; k--) {          /* bottom up, so a delete cannot shift the rest */
      var em = _cleanEmail_(all[k][LAB_EMAIL - 1]);
      if (!em || onRoster[em]) continue;
      var saved = String(all[k][2]).trim() !== '' || Number(all[k][9]) > 0;
      if (saved) { held.push(String(all[k][0] || em)); continue; }
      sh.deleteRows(k + 2, 1);
      gone++;
      delete have[em];
    }
    if (notes && gone) {
      notes.push(gone + ' row' + (gone === 1 ? '' : 's') + ' removed from ' + lab.name +
                 ' for people no longer on the Students tab.');
    }
    if (notes && held.length) {
      notes.push('Still on ' + lab.name + ' though no longer on the Students tab, because ' +
                 (held.length === 1 ? 'there are marks' : 'there are marks') + ' against ' +
                 (held.length === 1 ? 'them' : 'them') + ': ' + held.join(', ') + '.');
    }
  }

  /* Keeping every name and class true to the roster used to ask the sheet for one row, then write
     one row, PER PUPIL PER LAB — three hundred pupils across twenty labs is twelve thousand calls,
     and that is what made Tidy up run for minutes. Now: read the tab once, fix the names in memory,
     and write the two columns back in a single call only if something actually changed. */
  var add = [];
  var nLeft = sh.getLastRow() - 1;                 /* re-read AFTER the deletions above */
  var cur = nLeft > 0 ? sh.getRange(2, 1, nLeft, LAB_EMAIL).getValues() : [];
  var rowOf = {}, nameClass = [];
  cur.forEach(function (r, i) {
    nameClass.push([r[0], r[1]]);
    var e = _cleanEmail_(r[LAB_EMAIL - 1]);
    if (e) rowOf[e] = i;
  });
  var changed = false;
  people.forEach(function (p) {
    var email = _cleanEmail_(p[EMAIL_COL - 1]);
    if (!email) return;
    if (rowOf[email] !== undefined) {              /* already here: keep the name and class true to the roster */
      var i = rowOf[email];
      if (nameClass[i][0] !== p[0] || nameClass[i][1] !== p[1]) { nameClass[i] = [p[0], p[1]]; changed = true; }
      return;
    }
    var row = new Array(LAB_COLS.length).fill('');
    row[0] = p[0];                 /* name  */
    row[1] = p[1];                 /* class */
    row[LAB_EMAIL - 1] = email;
    add.push(row);
  });
  if (changed && nameClass.length) sh.getRange(2, 1, nameClass.length, 2).setValues(nameClass);
  if (add.length) {
    var at2 = sh.getLastRow() + 1;
    _room_(sh, at2 + add.length - 1);
    sh.getRange(at2, 1, add.length, LAB_COLS.length).setValues(add);
  }
  return sh;
}
/* Where this student's row is, adding one if they arrived after the last import. */
function _rowFor_(sh, email, student) {
  var last = sh.getLastRow();
  if (last > 1) {
    var col = sh.getRange(2, LAB_EMAIL, last - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) {
      if (_cleanEmail_(col[i][0]) === email) return i + 2;
    }
  }
  var row = new Array(LAB_COLS.length).fill('');
  row[0] = student.name; row[1] = student.cls; row[LAB_EMAIL - 1] = email;
  _room_(sh, last + 1);
  sh.getRange(last + 1, 1, 1, LAB_COLS.length).setValues([row]);
  return last + 1;
}

/** "mouth 9/9 in 14 · stomach 8/9 in 21" — readable in one cell. */
function _stations_(o) {
  if (!o || typeof o !== 'object') return '';
  var out = [], n = 0;
  Object.keys(o).forEach(function (k) {
    if (n >= 40) return;                                     /* no lab has anything like 40 stations */
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(k)) return;  /* ids only: also refuses __proto__ */
    out.push(k + ' ' + String(o[k]).slice(0, 40));
    n++;
  });
  /* uncapped, an oversized cell threw AFTER the score had been written, leaving a row with a new
     mark beside a stale code and stale per-station text */
  return out.join(' \u00b7 ').slice(0, 900);
}
/** "40 min" / "6 h" / "3 days" since the first question was checked. */
function _since_(iso) {
  if (!iso) return '';
  var then = new Date(iso);
  if (isNaN(then)) return '';
  var mins = Math.round((new Date() - then) / 60000);
  if (mins < 90) return mins + ' min';
  if (mins < 60 * 36) return Math.round(mins / 60) + ' h';
  return Math.round(mins / 1440) + ' days';
}
/* ============================================================
   5b. Completion codes — retired, September 2026
   ------------------------------------------------------------
   Every hand-in used to show the student a code (DL-3CL9-Q3MP), a checksum of name, class,
   score and lab that the Setup tab could read back. The page computed it with the same
   function as the server, so it proved nothing a student could not simply say — and now
   that a lab saves on its own, the "hand-in that never arrived" it existed for no longer
   happens. The Code column stays, hidden, for the rows that carry old ones.
   ============================================================ */
/* ============================================================
   Giving a student their own scores back
   ------------------------------------------------------------
   A student's progress lives in their browser. Clear the history, or open a lab on another
   device, and it is gone. What was SAVED is here, so the hubs ask for it back.

   Read only, and only ever the row belonging to the person holding the token. The email comes
   from the verified token, never from the request, so nobody can ask for anybody else's — and
   nothing about the class, the roster or another student is returned.
   ============================================================ */
function _ownProgress_(d) {
  /* answered for anyone with a Google account before now, and each answer read every lab tab in
     full — twenty full-sheet reads, as the owner, to discover the caller has no row */
  if (!_clientId_()) return _json_({ ok: false, why: 'sign-in is not set up' });
  var who = _whoSaving_(d);                       /* their own practice: this script's pass is enough */
  if (!who) return _json_({ ok: false, why: 'not signed in' });

  var out = {}, ss;
  try { ss = _ss_(); } catch (err) { return _json_({ ok: false, why: 'no spreadsheet' }); }
  /* answer nothing to anyone who is not on the roster, BEFORE reading a single lab tab */
  var me = _studentOf_(who.email);
  if (!me) return _json_({ ok: true, labs: {} });

  for (var i = 0; i < LABS.length; i++) {
    var lab = LABS[i];
    var sh = ss.getSheetByName(lab.name);          /* a lab with no tab yet is simply skipped */
    if (!sh) continue;
    var last = sh.getLastRow();
    if (last < 2) continue;

    var vals = _labRows_(sh, 2, last - 1);
    for (var r = 0; r < vals.length; r++) {
      if (_cleanEmail_(vals[r][LAB_EMAIL - 1]) !== who.email) continue;
      var score = Number(vals[r][2]);              /* Score */
      var here = String(vals[r][LAB_SNAP - 1] || ''), first = String(vals[r][LAB_FIRST - 1] || ''), best = String(vals[r][LAB_BEST - 1] || '');
      /* nothing saved yet. A row whose answers are all still wrong (Score 0) does come back: its "tried" letters
         stop another computer calling the next right answer "right first time". */
      if (!(score > 0) && !here && !first && !best) break;
      var rok = _roundsColOk_(sh);
      out[lab.id] = {
        done:      score > 0 ? score : 0,
        total:     Number(vals[r][3]) || lab.questions || 0,
        complete:  String(vals[r][5] || '') === 'complete',
        checks:    Number(vals[r][6]) || 0,
        firstTime: Number(vals[r][7]) || 0,
        handIns:   Number(vals[r][9]) || 0,
        handedIn:  true,
        at:        vals[r][10] ? new Date(vals[r][10]).toISOString() : null,
        /* `snap` is all a page from before goes reads, and it sends it straight back as its go 1. So a station on
           a later go gives its FIRST go there, never this go's letters: a redo must not become first-go answers.
           A page that knows goes reads `here`. */
        snap:      _snapForOldPages_(here, first),
        here:      here,                                     /* this go (goes, Sept 2026) */
        first:     first,                                    /* first go */
        best:      best,                                     /* best ever */
        /* every round and its checks, and the whole-lab resets (7 Oct 2026): the page keeps each count at the larger */
        rounds:    rok ? String(vals[r][LAB_ROUNDS - 1] || '') : '',
        resets:    rok ? _rParse_(vals[r][LAB_ROUNDS - 1]).resets : 0
      };
      break;
    }
  }
  /* their own homework in the labs, scored as the teacher's page scores it (29 Sep 2026); a page from before ignores it.
     acc: the teacher's accommodation for THIS pupil (8 Oct 2026), only when it is on */
  var ans = { ok: true, name: who.name || '', labs: out, homework: _ownHomework_(who.email, me.cls) };
  if (me.acc) ans.acc = 1;
  return _json_(ans);
}

/* A pupil's own open homework in the labs, for the lab pages to colour each homework station and say what is left.
   Each station is scored ON ITS OWN by the teacher's rule, _hwScoreOne_ on the same tabs and manifest the Set homework
   page reads (so the pupil and the teacher never disagree): done when every question has been answered right, part
   done when some have, not started when none have. Lab stations only (Bio English Lab lists its own homework, through
   english.mine); a station the lab no longer has is left out; homework stays until a month past its due date, as on
   the English site. Read only. Never throws: [] when anything is missing, so homework can never cost a pupil their
   progress. */
function _ownHomework_(email, cls) {
  var out = [];
  try {
    if (!email || !_ss_().getSheetByName(T_HOMEWORK)) return out;   /* no tab: nothing set (and none is made here) */
    var now = Date.now(), MONTH = 28 * 24 * 3600 * 1000, mine = [];
    _homeworkRows_().forEach(function (hw) {
      if (hw.waiting || !_hwIsFor_(hw, email, cls)) return;  /* set for a later date: not theirs yet */
      var dms = hw.due ? new Date(hw.due).getTime() : 0;
      if (dms && now - dms > MONTH) return;                         /* a month past its date: off their list */
      var tasks = hw.tasks.filter(function (t) { return t.labId !== ENGLISH_ID && t.labId !== WRITEUP_ID && (t.stationIds || []).length; });
      if (tasks.length) mine.push({ hw: hw, tasks: tasks });
    });
    if (!mine.length) return out;
    /* the labs' station list only: these are lab stations, so the English list is not needed (its entries are not read) */
    var m0 = _manifest_(), man = { labs: (m0 && m0.labs) || {} }, ids = [], need = {};
    need[email] = 1;
    mine.forEach(function (m) { m.tasks.forEach(function (t) { if (ids.indexOf(t.labId) < 0) ids.push(t.labId); }); });
    var index = _hwLabIndex_(ids, need);
    mine.forEach(function (m) {
      var stations = [];
      m.tasks.forEach(function (t) {
        var lm = man && man.labs ? man.labs[t.labId] : null, nameOf = {};
        if (lm) (lm.stations || []).forEach(function (x) { nameOf[x.id] = x.name; });
        t.stationIds.forEach(function (sid) {
          var s = _hwScoreOne_({ tasks: [{ labId: t.labId, stationIds: [sid] }] }, email, index, man);
          if (s.missing.length || !s.total) return;
          stations.push({ lab: t.labId, id: sid, name: String(nameOf[sid] || sid), done: s.done, total: s.total, state: s.state });
        });
      });
      if (!stations.length) return;
      var all = _hwScoreOne_({ tasks: m.tasks }, email, index, man);
      out.push({ id: m.hw.id, title: m.hw.title, due: m.hw.dueText, dueAt: m.hw.due || '', overdue: m.hw.overdue, soon: m.hw.soon,
                 state: all.state, done: all.done, total: all.total, stations: stations });
    });
    out.sort(function (a, b) { return String(a.dueAt || '9').localeCompare(String(b.dueAt || '9')); });
  } catch (e) { out = []; }
  return out;
}

/* ============================================================
   Has this student got a reflection record?
   ------------------------------------------------------------
   The Assessment Reflection System builds each student a page of their own after every
   test. That page lives at ONE address for the whole school: which student it shows is
   decided by the Google account that opens it, verified at the far end, not by anything
   in the address. So this does NOT go looking for a personal link — there isn't one.

   It answers three things the hub cannot know on its own: what the school calls this
   person, whether they have a record yet, and the address to send them to. Nothing about
   another student, no scores, no class, no roster — a student is told what they already
   know about themselves, and the page itself does the rest behind the school's own gate.

   The email comes from the verified token, never from the request. Read only.
   ============================================================ */
/* Whether a pupil has any practice recorded in this spreadsheet: an answer in a lab row, or in a Bio English
   set. A yes is remembered for six hours (a record never empties); a no is asked again next time, so a first
   answer opens the door at once. Read only. Never throws. */
function _hasPractice_(email) {
  var cache = null, key = 'PRAC_' + email, yes = false;
  try { cache = CacheService.getScriptCache(); if (cache.get(key)) return true; } catch (e) {}
  try {
    var ss = _ss_();
    for (var i = 0; i < LABS.length && !yes; i++) {
      var sh = ss.getSheetByName(LABS[i].name);
      if (!sh || sh.getLastRow() < 2) continue;
      /* School email … Best ever, as far as the tab goes (a read past its last column throws) */
      var v = sh.getRange(2, LAB_EMAIL, sh.getLastRow() - 1, Math.min(LAB_BEST, sh.getMaxColumns()) - LAB_EMAIL + 1).getValues();
      for (var r = 0; r < v.length; r++) {
        if (_cleanEmail_(v[r][0]) !== email) continue;
        for (var c = 0; c < 3 && !yes; c++) {
          var snap = v[r][[LAB_SNAP, LAB_FIRST, LAB_BEST][c] - LAB_EMAIL];
          yes = _snapCount_(snap, 'right') + _snapCount_(snap, 't') > 0;
        }
        break;
      }
    }
    var en = yes ? null : ss.getSheetByName(T_ENGLISH);
    if (en && en.getLastRow() >= 2) {
      var e = en.getRange(2, EN_EMAIL, en.getLastRow() - 1, 2).getValues();         /* School email, the sets */
      for (var k = 0; k < e.length; k++) {
        if (_cleanEmail_(e[k][0]) !== email) continue;
        var kept = _enParse_(e[k][1]);
        yes = Object.keys(kept).some(function (sid) { var x = kept[sid]; return x.d > 0 || /[1tfs]/.test(x.s + x.s1 + x.b); });
        break;
      }
    }
  } catch (err) { return false; }
  try { if (yes && cache) cache.put(key, '1', 21600); } catch (e) {}
  return yes;
}
function _ownRecord_(d) {
  if (!_trackerId_()) return _json_({ ok: false, why: 'no record system' });
  if (!_clientId_())  return _json_({ ok: false, why: 'sign-in is not set up' });
  var who = _whoIs_(d.token);
  if (!who) return _json_({ ok: false, why: 'not signed in' });

  /* A personal account is told so plainly. Without this they would sign in, be found
     nowhere, and be shown "nothing recorded yet" — which is true of the workbook and quite
     untrue of them. */
  var dom = _schoolDomain_();
  if (dom && !_inDomain_(who.email, dom))
    return _json_({ ok: false, why: 'not a school account', email: who.email, domain: dom });
  /* a teacher on the list is told so, with the teacher page's address; nobody else hears of either */
  var isTeacher = _isTeacher_(who.email);

  var wb;
  try { wb = SpreadsheetApp.openById(_trackerId_()); }
  catch (err) { return _json_({ ok: false, why: 'cannot reach the record' }); }

  var sheets = wb.getSheets(), name = '', at = 0, latest = '';
  var finished = {}, unfinished = {}, unfinishedNames = [], fromTest = 0, fromCohort = 0;

  /* TWO numbers a student is told, never mixed up:
       reflected    digital reflections they finished (below, the cohort tabs and TEST)
       assessments  everything with a real score — tests and lab reports the teacher marked,
                    INCLUDING those reflected on. Teachers record scores for assessments a
                    student never reflected on (earlier years, lab reports), so this is the
                    bigger number, and "3 of 7 reflected" is what the student sees.
     A test that has BOTH a reflection and a teacher score is one assessment, not two: the
     tracker's "📦 Registry" tab (written by the reflection script's "Sync registry to
     tracker") says which prior-assessment column a reflection stands for, in its PAID column
     — the same link the student's own record page uses to show that test once. Without the
     tab nothing breaks; such a test is simply counted twice in `assessments`. */
  var paIdOf = {}, scoredPa = {};
  try {
    var reg = wb.getSheetByName('📦 Registry');
    if (reg && reg.getLastRow() >= 2) {
      var rh = reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0];
      var rId = rh.indexOf('AssessmentID'), rPa = rh.indexOf('PAID');
      if (rId >= 0 && rPa >= 0) {
        reg.getRange(2, 1, reg.getLastRow() - 1, reg.getLastColumn()).getValues().forEach(function (row) {
          var id = String(row[rId] || '').trim(), pa = String(row[rPa] || '').trim();
          if (id && pa) paIdOf[id] = pa;
        });
      }
    }
  } catch (e) { /* no mirror: counted without the link, as above */ }
  /* A prior-assessment cell counts as a score only if it holds a number — "absent", "-" or
     "exempt" is a teacher's note that the student did NOT do it. */
  function isScore(v) { return /\d/.test(String(v == null ? '' : v)); }
  var UNFINISHED_TAB = 'Unfinished reflections', UNFINISHED_EMAIL = 'Student Email';

  /* Two passes. FINISHED reflections live in the cohort tabs ("Class of 2028") and in
     "TEST", where a teacher's own trial submissions go — included because students never
     have rows there, so it changes nothing for them, and it lets a teacher testing the
     form see the card behave exactly as a student's would. UNFINISHED reflections live in
     their own tab, "Unfinished reflections", whose email column is "Student Email". */
  for (var si = 0; si < sheets.length; si++) {
    var tabName = sheets[si].getName();
    var isTest = tabName === 'TEST';
    if (!isTest && !/^Class of \d{4}$/.test(tabName)) continue;
    var sh = sheets[si], last = sh.getLastRow();
    if (last < 2) continue;
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var cEmail = head.indexOf('Email');
    if (cEmail < 0) continue;
    var paCols = [];
    head.forEach(function (h, i) { if (/^PA_/.test(String(h))) paCols.push(i); });
    var cName = head.indexOf('StudentName'), cAss = head.indexOf('AssessmentName'),
        cId = head.indexOf('AssessmentID'), cWhen = head.indexOf('LastUpdated'), cDate = head.indexOf('AssessmentDate');
    var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    for (var r = 0; r < vals.length; r++) {
      if (_cleanEmail_(vals[r][cEmail]) !== who.email) continue;
      /* A row with no AssessmentID is not an assessment. Older copies of the reflection
         script appended such rows from "Update deployment URL". */
      var aid = cId >= 0 ? String(vals[r][cId] || '').trim() : '';
      if (!aid) continue;
      /* each row carries the prior-assessment scores synced for ITS assessment, so the full set
         is the union across every row of theirs — exactly as the record page merges them */
      for (var pc = 0; pc < paCols.length; pc++) {
        if (isScore(vals[r][paCols[pc]])) scoredPa[String(head[paCols[pc]])] = true;
      }
      if (cName >= 0 && !name) name = String(vals[r][cName] || '').trim();
      /* One row per student PER ASSESSMENT; counted once per paper all the same. */
      if (finished[aid]) continue;
      finished[aid] = true;
      if (isTest) fromTest++; else fromCohort++;
      var t = 0;
      if (cWhen >= 0) { try { t = new Date(vals[r][cWhen]).getTime() || 0; } catch (e) {} }
      if (!t && cDate >= 0) { try { t = new Date(vals[r][cDate]).getTime() || 0; } catch (e) {} }
      if (t >= at) {
        at = t;
        var nm = cAss >= 0 ? String(vals[r][cAss] || '').trim() : '';
        latest = nm || aid;
      }
    }
  }

  var unf = wb.getSheetByName(UNFINISHED_TAB);
  if (unf && unf.getLastRow() >= 2) {
    var uh = unf.getRange(1, 1, 1, unf.getLastColumn()).getValues()[0];
    var uE = uh.indexOf(UNFINISHED_EMAIL), uId = uh.indexOf('AssessmentID'),
        uNm = uh.indexOf('AssessmentName'), uCls = uh.indexOf('Class'), uStu = uh.indexOf('StudentName');
    if (uE >= 0 && uId >= 0) {
      var uv = unf.getRange(2, 1, unf.getLastRow() - 1, unf.getLastColumn()).getValues();
      for (var q = 0; q < uv.length; q++) {
        if (_cleanEmail_(uv[q][uE]) !== who.email) continue;
        var uid = String(uv[q][uId] || '').trim();
        /* Unfinished is not an assessment done — the reflection IS the work — so it is
           counted apart. A paper that also has a finished row was finished after all
           (the unfinished record can outlive the finish), so it does not count here. */
        if (!uid || finished[uid] || unfinished[uid]) continue;
        unfinished[uid] = true;
        unfinishedNames.push((uNm >= 0 && String(uv[q][uNm] || '').trim()) || uid);
        if (!name && uStu >= 0) name = String(uv[q][uStu] || '').trim();
        if (uCls >= 0 && String(uv[q][uCls] || '').trim().toUpperCase() === 'TEST') fromTest++; else fromCohort++;
      }
    }
  }
  var count = Object.keys(finished).length, incomplete = unfinishedNames.length;

  /* Every assessment, once: a teacher-scored prior assessment by its PA id, and a reflection
     (finished or not) by the PA id it stands for, or by its own id when it stands for none. */
  var events = {};
  Object.keys(scoredPa).forEach(function (pa) { events[pa] = true; });
  Object.keys(finished).concat(Object.keys(unfinished)).forEach(function (aid) {
    events[paIdOf[aid] || aid] = true;
  });
  var assessments = Object.keys(events).length;

  return _json_({ ok: true, name: name || who.name || '',
                 /* `count` is the number of finished reflections, kept under its old name for any
                    copy of the hub that has not yet learned the two numbers below */
                 count: count, reflected: count, assessments: assessments, incomplete: incomplete,
                 unfinishedNames: unfinishedNames,
                 latest: latest, at: at ? new Date(at).toISOString() : null,
                 /* true when every row found is a teacher's TEST submission */
                 testOnly: fromTest > 0 && fromCohort === 0,
                 /* true when they have practice recorded here, in a lab or Bio English: My assessments shows
                    it before any reflection (§40.72 in the reflection spec). Absent otherwise. */
                 practice: _hasPractice_(who.email) || undefined,
                 /* absent — not false — for everybody who is not a teacher on the list */
                 teacher: isTeacher || undefined,
                 teacherPage: isTeacher ? _teacherPageUrl_() : undefined,
                 /* where My assessments lives now: the reflection copy running the newest code (§front-door).
                    Absent until a copy has registered; the hub then keeps the address in its local.js. */
                 myAssessments: _frontDoorUrl_(wb) || undefined });
}

/* ============================================================
   §front-door (reflection spec §40.78, 28 Sep 2026) — MY ASSESSMENTS FOLLOWS THE NEWEST COPY.
   Daniel makes a new reflection spreadsheet, with its own web-app address, for every assessment, and the newest
   one carries the newest code. The reflection copy running the newest code writes its address into the Student
   Progress Tracker's "🚪 My assessments address" tab (the reflection Code.gs's _frontDoorClaim_); this script reads
   it, gives it to a signed-in student with the `record` answer, and the hub's door opens it instead of the one
   address in its local.js. Daniel's "Keep students here" tick in that tab is the reflection side's business. The
   labels are a contract with the reflection Code.gs: IGCSE/AppScript/Test System harness/check_front_door.mjs runs
   the writer there and this reader on one stand-in tracker.
   ============================================================ */
var FRONT_DOOR_TAB = '🚪 My assessments address';
/* the tab's Address, Code edition and Build, or null — never a guess, never an address that is not a web app */
function _frontDoor_(wb) {
  var sh = wb ? wb.getSheetByName(FRONT_DOOR_TAB) : null;
  if (!sh) return null;
  var n = Math.min(Math.max(sh.getLastRow(), 1), 40), v = sh.getRange(1, 1, n, 2).getValues(), m = {};
  for (var i = 0; i < v.length; i++) { var k = String(v[i][0] || '').trim(); if (k && !(k in m)) m[k] = v[i][1]; }
  var url = String(m['Address'] || '').trim();
  if (!/^https:\/\/script\.google\.com\/(?:a\/macros\/[a-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]{20,}\/exec\?page=student$/.test(url)) return null;
  return { url: url, edition: String(m['Code edition'] || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120), build: Number(m['Build']) || 0 };
}
function _frontDoorUrl_(wb) { try { var d = _frontDoor_(wb); return d ? d.url : ''; } catch (e) { return ''; } }
/* For the health line: which code students' My assessments runs, so `node tools/status.mjs` can compare it with
   the reflection code on Daniel's Mac without signing in. Read at most every ten minutes; says nothing when the
   record card is off. */
function _frontDoorHealth_() {
  try {
    if (!_trackerId_()) return '';
    var cache = CacheService.getScriptCache(), hit = cache.get('frontdoor-health');
    if (hit !== null && hit !== undefined) return hit;
    var d = _frontDoor_(SpreadsheetApp.openById(_trackerId_()));
    var line = d ? ' · My assessments: ' + (d.edition || 'no edition') + ' (build ' + d.build + ')' : ' · My assessments: no reflection copy has registered yet';
    cache.put('frontdoor-health', line, 600);
    return line;
  } catch (e) { return ''; }
}

/* ============================================================
   "SIT A TEST" — when the signed-in person's own test opens, and the way in.

   The test system (its own spreadsheet, its own web app) publishes its schedule into a tab of
   its spreadsheet, "⏰ Hub schedule", written by its OWN functions (§hub-mirror, in its
   2_TestPlatform.gs). The hub cannot ask that web app — it is restricted to the school, so a
   cross-site request meets Google's sign-in page — but this script can open the spreadsheet
   by id, the same way it opens the tracker.

   From that tab, the Marks tabs (the roster), LiveProgress and TestResponses, this works out
   what the test's own form will do for this one person, by the same rules in the same order:
       which version    the letter on their Marks tab; a class tab wins over "Marks · Test"
       when it opens    their own override  →  their class's window  →  the whole test's time
                        (the test's §family-schedule, 18 Sep 2026: one set of times for every
                        version; an override left under the active test still counts)
       when it closes   the same, plus extra time as the test adds it in "window" timer mode
       done?            TestResponses says submitted, marking, marked or failed
   Each rule below is a copy of the test system's, named after the one it copies. They are
   copies because the hub cannot call across; if the test system changes a rule, change it here.
   One rule is left out on purpose: the test's §tick-list (its v4.07) keeps a pupil the teacher
   has not ticked waiting, while this banner still shows them their class's times. Copying it
   would publish pupils' emails in the ⏰ Hub schedule tab (Daniel's decision, 29 Sep 2026).

   Which spreadsheets: every "Test" row of 🔗 Teacher links whose Link is a Google Sheet, for a
   cohort still in school (or no cohort). A sheet without the tab is simply not a test system.
   A teacher is seated exactly as a pupil is — on "Marks · Test" — so test mode shows them what a
   pupil sees, by the same path.

   Returned: ONLY this person's own — the state, the test's name, their own open and close
   instants, the way in; and, once their teacher has released it, the way to their own feedback
   (below). Never the class map, anyone else's time, anyone's status, a question.

   FEEDBACK (§feedback-release, 25 Sep 2026) — the test system's Marker Review can release a
   pupil's approved, marked test to them. It writes the time into TestResponses' "Feedback
   Released" column, and empties it again whenever the work is re-opened, re-marked or re-sat.
   A released row names the test (from the ⏰ Hub schedule tab's `names`, for every registered
   test: feedback outlives its test being the active one) and the test system's own read-only
   page for it, the form's address + ?page=feedback. That page shows each visitor only their own
   feedback, and re-checks the release itself; this banner is only the way to it. The link is the
   form's own address: it tells this pupil nothing new, because feedback exists only for someone
   who has already sat a test at that address.
   The email comes from the verified token, never from the request. Read only.
   ============================================================ */
var T_HUB_SCHEDULE   = '⏰ Hub schedule';
var HUB_SCHEDULE_KEY = 'HUB_SCHEDULE_JSON';
var TEST_SNAP_SECONDS = 60;   /* one read of a test spreadsheet serves every student for this long */
var FEEDBACK_CARD_DAYS = 5;   /* the "New feedback" card: this many days after a release, then it goes (26 Sep 2026,
                                 Daniel) — the feedback itself stays reachable from My assessments */

function _ownTest_(d) {
  if (!_clientId_()) return _json_({ ok: false, why: 'sign-in is not set up' });
  var who = _whoIs_(d.token);
  if (!who) return _json_({ ok: false, why: 'not signed in' });
  var dom = _schoolDomain_();
  if (dom && !_inDomain_(who.email, dom))
    return _json_({ ok: false, why: 'not a school account', email: who.email, domain: dom });
  var email = _cleanEmail_(who.email), teacher = _isTeacher_(email);
  var now = Date.now(), best = null, why = [];
  var ids = _testSheetIds_(teacher);
  if (!ids.length) {
    var chips = [];
    var trouble = '';
    try { var sc = _teacherLinksScan_(); trouble = sc.chipTrouble || ''; chips = sc.unreadable.filter(function (u) { return _typeClass_(u.type) === 'test'; }); } catch (e) {}
    if (chips.length) why.push('the Link of \u201c' + chips[0].name + '\u201d in \ud83d\udd17 Teacher links is a smart chip' +
                               (chips[0].shown ? ' (\u201c' + chips[0].shown + '\u201d)' : '') +
                               (_chipsOn_()
                                 ? ', and its address could not be read' + (trouble ? ' (' + trouble + ')' : '') + ' \u2014 use the spreadsheet\u2019s plain address instead'
                                 : ', which the hub reads only once the Google Sheets API is switched on in its script (Services \u25b8 + \u25b8 Google Sheets API) \u2014 or use the spreadsheet\u2019s plain address'));
    else why.push('no "Test" row in \ud83d\udd17 Teacher links has a Google Sheet as its Link (for a cohort still in school, or with no year)');
  }
  var fb = [];
  ids.forEach(function (id) {
    var snap = _testSnapshot_(id, teacher);          /* a teacher testing sees it as it is NOW */
    if (!snap || snap.fail) { why.push((snap && snap.fail) || 'a Test spreadsheet could not be read'); return; }
    /* §feedback-release — released feedback needs no seat: last term's test is still theirs */
    var f = snap.fb && snap.fb[email];                /* [newest test id, its time, how many released] */
    if (snap.url && f) fb.push({ name: String((snap.names && snap.names[f[0]]) || ''), at: Number(f[1]) || 0,
                                 count: Number(f[2]) || 1,
                                 url: snap.url + '?page=feedback&test=' + encodeURIComponent(String(f[0])) });   /* opens on that test */
    var mine = _testFor_(snap, email, now);
    if (!mine) { why.push('\u201c' + snap.title + '\u201d does not list ' + email + ' on any of its Marks tabs'); return; }
    if (!best || _testBefore_(mine, best)) best = mine;
  });
  var out = { ok: true, teacher: teacher, state: best ? best.state : 'none' };
  /* A teacher testing the banner is told WHY nothing shows — a guess sends them to fix the wrong
     thing. A pupil is never told: the reasons name spreadsheets and the roster. */
  if (teacher && !best && why.length) out.why = why.slice(0, 3);
  if (best) {
    out.name = best.name; out.opensAt = best.opensAt; out.closesAt = best.closesAt;
    /* The way in only once it is OPEN. The page shows no link before then, but hiding it there is
       not enough: a link sitting in this answer is one look at the browser's network tab away from
       opening the test early. */
    if (best.url && best.state === 'open') out.url = best.url;
  }
  /* §hub-card — "Your reflection" (reflection spec §40.80): this person's own card, when a reflection is switched on.
     A teacher testing it is told why none shows, but only once something is switched on. */
  try {
    var rc = _ownReflectCard_(email, teacher, now);
    if (rc.card) out.reflect = rc.card;
    else if (teacher && rc.on && rc.why.length) out.reflectWhy = rc.why.slice(0, 3);
  } catch (e) {}
  if (fb.length) {                                   /* the newest; "and N more" on the same page */
    fb.sort(function (a, b) { return b.at - a.at; });
    var f0 = fb[0];
    /* The link is the form's own address. It is no secret from this person: feedback exists only for someone
       who sat a test there, so they have opened that address already. */
    out.feedback = { name: f0.name, at: f0.at, url: f0.url, more: f0.count - 1 };
  }
  return _json_(out);
}

/* the one to show when someone sits more than one: open now, then the soonest to open, then the rest */
function _testBefore_(a, b) {
  var rank = { open: 0, upcoming: 1, waiting: 2, done: 3, closed: 4 };
  if (rank[a.state] !== rank[b.state]) return rank[a.state] < rank[b.state];
  return (a.opensAt || 0) < (b.opensAt || 0);
}

function _testSheetIds_(fresh) {
  /* read on every student's visit, and a chip costs a call to the Sheets API: the list is kept a
     minute for students; a teacher (`fresh`) always reads it now */
  var cache = null, key = 'testids1';
  try { cache = CacheService.getScriptCache(); if (!fresh) { var hit = cache.get(key); if (hit) return JSON.parse(hit); } } catch (e) {}
  var seen = {}, ids = [];
  _teacherLinksRaw_().forEach(function (l) {
    if (_typeClass_(l.type) !== 'test') return;
    var co = _cohortLabel_(l.grad);
    if (co && !co.yearGroup) return;                              /* a cohort no longer in school */
    /* every shape Google writes a Sheet's address in: signed in to two accounts it is
       …/spreadsheets/u/1/d/<id>/…, and a Workspace link can read …/a/<school>/spreadsheets/d/<id>/… */
    var id = _sheetIdOf_(l.url);
    if (id && !seen[id]) { seen[id] = 1; ids.push(id); }
  });
  try { if (cache) cache.put(key, JSON.stringify(ids), 60); } catch (e) {}
  return ids;
}

/* One test spreadsheet, read once and shared by every student for TEST_SNAP_SECONDS: at the start
   of a test a whole year group opens the hub within a minute, and this script's executions are a
   shared, limited pool. So a submission or an override reaches the banner within a minute, not at
   once — the test's own page is always exact. null = not a test system (or unreadable). */
function _testSnapshot_(id, fresh) {
  var key = 'tsnap4:' + id, cache = null, hit = null;   /* bump when the snapshot's shape changes (4: fb, names) */
  /* `fresh`: a teacher checking their own change reads the sheet now — one person, not a class of
     thirty — and that reading still refreshes the shared copy the students are served */
  try { cache = CacheService.getScriptCache(); if (!fresh) hit = cache.get(key); } catch (e) {}
  if (hit) { try { return hit === '-' ? null : JSON.parse(hit); } catch (e) {} }
  var snap = null;
  try { snap = _readTestSnapshot_(id); } catch (e) { snap = null; }
  if (cache) {   /* a failure is kept 10 s, not a minute, so fixing it shows almost at once */
    try { var s = snap ? JSON.stringify(snap) : '-'; if (s.length < 95000) cache.put(key, s, snap && !snap.fail ? TEST_SNAP_SECONDS : 10); } catch (e) {}
  }
  return snap;
}

function _readTestSnapshot_(id) {
  var wb;
  try { wb = SpreadsheetApp.openById(id); }
  catch (e) { return { fail: 'the hub cannot open one of the Test spreadsheets \u2014 share it with the account this script runs as (Viewer is enough)' }; }
  var title = ''; try { title = String(wb.getName() || ''); } catch (e) {}
  var tab = wb.getSheetByName(T_HUB_SCHEDULE);
  if (!tab) return { fail: '\u201c' + title + '\u201d has no \u23f0 Hub schedule tab \u2014 paste the new test-system code, then open that spreadsheet once' };
  var mirror = null;
  var head = tab.getRange(1, 1, Math.min(Math.max(tab.getLastRow(), 1), 12), 2).getValues();
  for (var i = 0; i < head.length; i++)
    if (String(head[i][0]).trim() === HUB_SCHEDULE_KEY) { try { mirror = JSON.parse(String(head[i][1])); } catch (e) {} }
  if (!mirror || mirror.v !== 1 || !mirror.versions || !mirror.marks ||
      !(mirror.marks.email > 0) || !(mirror.marks.cls > 0) || !(mirror.marks.dataStart > 0))
    return { fail: '\u201c' + title + '\u201d: its \u23f0 Hub schedule tab cannot be read \u2014 open that spreadsheet once to rewrite it' };
  var M = mirror.marks;

  /* The way in comes out of a cell, so it is only ever accepted as a Google Apps Script web app. */
  var url = String(mirror.formUrl || '').replace(/[?#].*$/, '');
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[^\/?#]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) url = '';

  var ids = {};
  Object.keys(mirror.versions).forEach(function (k) { if (mirror.versions[k] && mirror.versions[k].id) ids[String(mirror.versions[k].id)] = 1; });

  /* seats — copies getStudentContext: every Marks tab, each read with ITS OWN version's columns (the test's
     §version-tabs: a "Marks · 9A · B" tab is laid out for Version B, and T3T4's versions differ in Section B, so
     Extra time sits in another column on a B or C tab); the first class tab that has you wins, and beats
     "Marks · Test" (where the last hit stands). Class is the cell, or the tab's class when the cell is blank.
     The columns come from the ⏰ Hub schedule: `marks.byVersion` gives each version's own (test-169: the Test System
     publishes it since 30 Sep 2026); a Test System from before then gives only the active test's, and those are
     used for every tab, exactly as before.
     §narrow-tab — each tab is read no wider than it is. A class tab left by ANOTHER test can be narrower than this
     test's Extra time column; reading past it threw, and no pupil of that spreadsheet got the banner or the
     feedback card (labs-script-004). A column the tab does not have counts as blank: no extra time. */
  var seats = {}, BV = (M.byVersion && typeof M.byVersion === 'object') ? M.byVersion : {};
  wb.getSheets().forEach(function (sh) {
    var info = _marksTabInfo_(sh.getName(), String(M.prefix || 'Marks · '));
    if (!info) return;
    var last = sh.getLastRow();
    if (last < M.dataStart) return;
    var own = info.version ? BV[info.version] : null;
    var C = (own && own.email > 0 && own.cls > 0) ? own : M;
    var xt = C.extraTime > 0 ? C.extraTime : 0;
    var width = Math.min(Math.max(C.email, C.cls, xt), sh.getMaxColumns());
    sh.getRange(M.dataStart, 1, last - M.dataStart + 1, width).getValues().forEach(function (r) {
      var em = String(r[C.email - 1] || '').toLowerCase();
      if (!em) return;
      var prev = seats[em];
      if (prev && !prev.t) return;                                /* a class tab already has them */
      seats[em] = { c: String(r[C.cls - 1] || '') || info.className, v: info.version,
                    x: (xt && r.length >= xt) ? _extraTimePct_(r[xt - 1]) : 0, t: info.isTest ? 1 : 0 };
    });
  });

  /* per-student overrides (LiveProgress) and submissions (TestResponses), for this test's versions only */
  var live = {}, done = {};
  _eachRow_(wb.getSheetByName('LiveProgress'), ['Email', 'Test ID', 'Release Override', 'Lockout Override'], function (v) {
    if (!ids[String(v[1])]) return;
    var rel = _ms_(v[2]), lock = _ms_(v[3]);
    if (rel || lock) live[String(v[0]).toLowerCase() + '|' + String(v[1])] = [rel, lock];
  });
  /* §feedback-release — and released feedback, for ANY test: a marked row with a time in "Feedback Released" */
  var fb = {}, fbIds = {};
  _eachRow_(wb.getSheetByName('TestResponses'), ['Email', 'Test ID', 'Status', 'Feedback Released'], function (v) {
    var st = String(v[2]).trim().toLowerCase();
    if (ids[String(v[1])] && /^(submitted|marking|marked|failed)$/.test(st))
      done[String(v[0]).toLowerCase() + '|' + String(v[1])] = 1;
    var at = st === 'marked' ? _releasedAt_(v[3]) : 0;
    /* a test since taken off the test system's list cannot be drawn by its feedback page any more: no card for it
       (`names` lists every registered test; an older tab without it hides nothing) */
    if (at && mirror.names && !mirror.names[String(v[1])]) at = 0;
    if (at && Date.now() - at > FEEDBACK_CARD_DAYS * 864e5) at = 0;   /* only NEW feedback gets the card */
    if (at) {                                         /* per pupil only the newest and a count: _ownTest_ needs no more,
                                                         and the cached snapshot must stay under the cache's size limit */
      var em = String(v[0]).trim().toLowerCase(), p = fb[em];
      if (!p) fb[em] = [String(v[1]), at, 1];
      else { p[2]++; if (at > p[1]) { p[0] = String(v[1]); p[1] = at; } }
    }
  });
  Object.keys(fb).forEach(function (em) { fbIds[fb[em][0]] = 1; });
  var names = {};
  Object.keys(fbIds).forEach(function (tid) {
    var n = mirror.names && mirror.names[tid];
    if (!n) Object.keys(mirror.versions).forEach(function (k) { var e = mirror.versions[k] || {}; if (String(e.id) === tid) n = e.name; });
    names[tid] = String(n || '').slice(0, 120);
  });

  var versions = {};
  Object.keys(mirror.versions).forEach(function (k) {
    var e = mirror.versions[k] || {};
    versions[k] = { id: String(e.id || ''), name: String(e.name || e.id || 'Test').slice(0, 120),
                    releaseAt: String(e.releaseAt || ''), lockoutAt: String(e.lockoutAt || ''),
                    classes: (e.classes && typeof e.classes === 'object') ? e.classes : {} };
  });
  return { title: title, url: url, activeId: String(mirror.activeId || ''), timerMode: String(mirror.timerMode || ''),
           timeLimitMinutes: Number(mirror.timeLimitMinutes) || 90,
           versions: versions, seats: seats, live: live, done: done, fb: fb, names: names };
}

/* copies _releasedMs_: only a real date counts, so a note typed into the column shows nobody anything */
function _releasedAt_(v) {
  if (v && typeof v.getTime === 'function') { var t = v.getTime(); return (isFinite(t) && t > 0) ? t : 0; }
  var s = String(v == null ? '' : v).trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return 0;
  var ms = Date.parse(s);
  return (isFinite(ms) && ms > 0) ? ms : 0;
}

/* Read only the named columns of a tab — found by their headings, one column at a time — and hand
   each row's values to fn in that order. LiveProgress carries a long event log in one column;
   reading whole rows would drag all of it across for four small cells.
   The heading row is FOUND, not assumed: LiveProgress and TestResponses both put a title in row 1
   and their column names in row 2 (the test system's LIVE_HEADER_ROWS / RESPONSES_HEADER_ROWS = 2).
   Assuming row 1 found no columns at all, so every override and every submission went unseen and
   a student who had already handed in was told their test was open — caught by the side-by-side
   test against the test system's own code, 18 Sep 2026. */
function _eachRow_(sh, names, fn) {
  if (!sh) return;
  var last = sh.getLastRow(), wide = sh.getLastColumn();
  if (last < 2 || wide < 1) return;
  var top = sh.getRange(1, 1, Math.min(last, 5), wide).getValues(), hr = -1, at = null;
  for (var r = 0; r < top.length && hr < 0; r++) {
    var hdr = top[r].map(function (h) { return String(h).trim(); });
    var a = names.map(function (n) { return hdr.indexOf(n); });
    if (a[0] >= 0 && a[1] >= 0) { hr = r + 1; at = a; }            /* 1-based heading row */
  }
  if (hr < 0 || last <= hr) return;
  var n = last - hr;
  var cols = at.map(function (c) { return c < 0 ? null : sh.getRange(hr + 1, c + 1, n, 1).getValues(); });
  for (var i = 0; i < n; i++) fn(cols.map(function (c) { return c ? c[i][0] : ''; }));
}

/* This person's test in one snapshot, or null if they have no seat there. */
function _testFor_(snap, email, now) {
  if (!snap || snap.fail || !snap.seats) return null;
  var seat = snap.seats[email];
  if (!seat) return null;
  var e = snap.versions[seat.v] || snap.versions[''];                /* copies _resolveAssessmentForStudent_'s fallback */
  if (!e || !e.id) return null;
  var k = email + '|' + e.id;
  /* copies _readReleaseLockoutOverride_: their own row; else a row left under the active test */
  var ov = snap.live[k] || (snap.activeId && e.id !== snap.activeId ? snap.live[email + '|' + snap.activeId] : null) || [0, 0];
  var cw = _classWindow_(e.classes, seat.c);
  var rel  = ov[0] || cw[0] || _ms_(e.releaseAt);
  var lock = ov[1] || cw[1] || _ms_(e.lockoutAt);
  lock = _extraClose_(lock, rel, seat.x, snap.timerMode, snap.timeLimitMinutes);
  /* copies the form's own gate: Begin is enabled only once a start time EXISTS and has passed
     (getTestBootstrap's `released`). No start time at all is not "open" — the form says "Waiting for
     your teacher to start the test" until one is set or ⏰ Start now is pressed. */
  var state = snap.done[k] ? 'done' : (lock && now > lock) ? 'closed' : !rel ? 'waiting' : (now < rel) ? 'upcoming' : 'open';
  return { state: state, name: e.name, opensAt: rel || 0, closesAt: lock || 0, url: snap.url };
}

/* copies parseMarksTabName_: "Marks · 10A · B" → 10A, version B; "Marks · Test" is the teachers' seat */
function _marksTabInfo_(name, prefix) {
  if (!name || name.indexOf(prefix) !== 0) return null;
  var rest = name.substring(prefix.length).trim();
  if (!rest) return null;
  var version = '', className = rest;
  var m = rest.match(/^(.+?)\s*[·]\s*([A-Za-z])$/);
  if (m) { className = m[1].trim(); version = m[2].toUpperCase(); }
  return { className: className, version: version, isTest: className.toUpperCase() === 'TEST' };
}

/* copies _readClassSchedule_: the class's own key first, then the same label ignoring case and spaces */
function _classWindow_(map, cls) {
  cls = String(cls == null ? '' : cls).trim();
  if (!cls || !map) return [0, 0];
  var e = map[cls];
  if (!e) {
    var norm = function (x) { return String(x == null ? '' : x).trim().toLowerCase().replace(/\s+/g, ''); };
    for (var key in map) if (map.hasOwnProperty(key) && norm(key) === norm(cls)) { e = map[key]; break; }
  }
  return e ? [_ms_(e.releaseAt), _ms_(e.lockoutAt)] : [0, 0];
}

/* copies _windowExtraClose_: only in "window" timer mode is extra time added to the close */
function _extraClose_(lockoutMs, releaseMs, pct, mode, limitMin) {
  if (!lockoutMs) return lockoutMs;
  if (String(mode) !== 'window') return lockoutMs;
  if (pct < 0) return 0;                                            /* unlimited: no close at all */
  if (!pct) return lockoutMs;
  var winLen = (releaseMs && lockoutMs > releaseMs) ? (lockoutMs - releaseMs) : ((Number(limitMin) || 90) * 60000);
  return lockoutMs + Math.round(pct / 100 * winLen);
}

/* copies _parseExtraTimePercent_ */
function _extraTimePct_(v) {
  if (v == null) return 0;
  if (/unlim/i.test(String(v))) return -1;
  if (typeof v === 'number' && isFinite(v)) {
    var num = v;
    if (num > 0 && num <= 2) num = num * 100;
    return Math.max(0, Math.min(200, Math.round(num)));
  }
  var s = String(v).trim();
  if (!s) return 0;
  var m = s.match(/(\d+)/);
  if (!m) return 0;
  var n = parseInt(m[1], 10);
  return Math.max(0, Math.min(200, isFinite(n) ? n : 0));
}

/* copies _parseIsoMs_ */
function _ms_(s) {
  if (!s) return 0;
  if (s instanceof Date) return s.getTime();
  var n = Date.parse(String(s));
  return isNaN(n) ? 0 : n;
}

/* ============================================================
   "YOUR REFLECTION" — a card for a reflection the teacher has switched on for the hub (§hub-card, the reflection
   spec's §40.80, 28 Sep 2026).

   Daniel: the reflection's link on the hub, "only for the students that are in the different tabs", and a card that
   "should not disappear until they have made a complete submission". A reflection spreadsheet switches itself on in
   ONE tab of the Student Progress Tracker, "📣 Reflections on the hub" (its 🧰 ToolBox ▸ 👥 Classes & rostering ▸
   📣 Share the form link… → 2, the Biology Hub; until 1 Oct 2026: Show form link on the Biology Hub…): one row per spreadsheet — its id, the assessment's name, the form's address,
   the time zone its script writes times in, and "Showing". For each one showing, this reads that spreadsheet (by
   id, as it reads the tracker) and works out what its FORM would do for this one person, by the form's own rules,
   copied:
       on its list?     getStudentClassFromRoster: every Marks tab, the Email in column A from row 6; a class tab
                        beats "Marks · Test" (the teachers' seat), whose work goes to "Reflections (Test)"
       handed in?       checkReflectionsForSubmission_: the FIRST row of their email in Reflections (or Reflections
                        (Test)) with a Timestamp and a Submission Count of 1 or more; "INCOMPLETE-SUBMISSION" in its
                        Validation flags = only part of it
       let back in?     isRetryAllowed_: "Retry Allowed" is YES, or RETRY_UNTIL a time still to come (ms, or
                        dd/MM/yyyy HH:mm:ss in the reflection script's time zone); the next hand-in clears it
       started? out     _isStudentLockedOut_: the first LiveProgress row — Screen #, "Started Screen 1 At" (for a row
       of time?         stuck without it, "Started" once that is two lockouts old), and 80 minutes from then
   giving ONE of
       start   not started yet                                     "Start your reflection"; the form then waits
                                                                   until the teacher lets them in
       going   started, still inside the 80 minutes               "Continue your reflection"
       again   handed in, and the teacher has let them back in     "Continue your reflection"
       part    handed in only part of it, not let back in yet      a reminder to ask, no link: the form would only
       time    started and ran out of time before handing in       say "submitted" or "locked out"
   asked in the form's own order (checkExistingSession): out of time first, then a session under way, then what was
   handed in. Nothing once a complete reflection is in, or for anyone not on its Marks tabs. Two showing for one
   person: a card with a way in before a reminder, then the one switched on last.
   IGCSE/AppScript/Test System harness/check_reflect_card.mjs runs these copies beside the reflection's own
   functions on one stand-in spreadsheet: if the form's rules change, change them here. Returned: only this
   person's own card — its state, the assessment's name and, for a card with a way in, the form's address (the one
   posted to Classroom). Never a classmate, never the list. Read only.
   ============================================================ */
var REFL_CARD_TAB = '📣 Reflections on the hub';
var REFL_LOCKOUT_MS = 80 * 60 * 1000;   /* copies FORM_LOCKOUT_MIN */
var REFL_SNAP_SECONDS = 60;             /* one read of a reflection spreadsheet serves every student for this long */
var REFL_RANK = { again: 0, going: 1, start: 2, part: 3, time: 3 };

/* The reflections switched on for the hub, from the tracker: [{ id, name, url, tz, at }], kept a minute
   (a teacher, `fresh`, reads it now). */
function _reflCardList_(fresh) {
  var key = 'rflon1', cache = null;
  try { cache = CacheService.getScriptCache(); if (!fresh) { var hit = cache.get(key); if (hit) return JSON.parse(hit); } } catch (e) {}
  var list = [], failed = false;
  try {
    var tid = _trackerId_();
    if (tid) _eachRow_(SpreadsheetApp.openById(tid).getSheetByName(REFL_CARD_TAB),
      ['Spreadsheet id', 'Showing', 'Assessment', 'Form address', 'Time zone', 'Switched on'], function (v) {
        var on = v[1] === true || /^(true|yes)$/i.test(String(v[1]).trim());
        var id = String(v[0]).trim(), url = String(v[3]).trim();
        if (!on || !/^[A-Za-z0-9_-]{20,}$/.test(id)) return;
        /* the way in comes out of a cell, so it is only ever accepted as a Google Apps Script web app */
        if (!/^https:\/\/script\.google\.com\/(a\/macros\/[a-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]{20,}\/exec$/.test(url)) return;
        list.push({ id: id, name: String(v[2] || '').replace(/\s+/g, ' ').trim().slice(0, 120), url: url,
                    tz: String(v[4] || '').trim(), at: _ms_(v[5]) });
      });
  } catch (e) { failed = true; list = []; }
  try { if (cache) cache.put(key, JSON.stringify(list), failed ? 10 : REFL_SNAP_SECONDS); } catch (e) {}
  return list;
}

/* One reflection spreadsheet, read once and shared by every student for REFL_SNAP_SECONDS (a class opens the hub
   within the same minute). Raw facts only — the card is worked out per request, against the clock. */
function _reflSnapshot_(id, tz, fresh) {
  var key = 'rsnap1:' + id, cache = null, hit = null;   /* bump when the snapshot's shape changes */
  try { cache = CacheService.getScriptCache(); if (!fresh) hit = cache.get(key); } catch (e) {}
  if (hit) { try { return hit === '-' ? null : JSON.parse(hit); } catch (e) {} }
  var snap = null;
  try { snap = _readReflSnapshot_(id, tz); } catch (e) { snap = null; }
  if (cache) {   /* a failure is kept 10 s, so fixing it shows almost at once */
    try { var s = snap ? JSON.stringify(snap) : '-'; if (s.length < 95000) cache.put(key, s, snap && !snap.fail ? REFL_SNAP_SECONDS : 10); } catch (e) {}
  }
  return snap;
}

function _readReflSnapshot_(id, tz) {
  var wb;
  try { wb = SpreadsheetApp.openById(id); }
  catch (e) { return { fail: 'the hub cannot open a reflection spreadsheet that is switched on for it — share it with the account this script runs as (Viewer is enough)' }; }
  var title = ''; try { title = String(wb.getName() || ''); } catch (e) {}
  if (!tz) { try { tz = String(wb.getSpreadsheetTimeZone() || ''); } catch (e) {} }
  /* who is on its list, and where: 0 = a class tab, 1 = only "Marks · Test" */
  var seat = {};
  wb.getSheets().forEach(function (sh) {
    var info = _reflMarksTab_(sh.getName());
    if (!info) return;
    var last = sh.getLastRow();
    if (last < 6) return;
    sh.getRange(6, 1, last - 5, 1).getValues().forEach(function (r) {
      var em = String(r[0] == null ? '' : r[0]).toLowerCase().trim();
      if (!em || seat[em] === 0) return;           /* a class tab already has them */
      seat[em] = info.isTest ? 1 : 0;
    });
  });
  /* LiveProgress: [Screen #, Started Screen 1 At, Started] of the first row of each email */
  var live = {};
  _eachRow_(wb.getSheetByName('LiveProgress'), ['Email', 'Screen #', 'Started Screen 1 At', 'Started'], function (v) {
    var em = String(v[0]).trim().toLowerCase();
    if (!em || live.hasOwnProperty(em)) return;
    live[em] = [parseInt(v[1], 10) || 0, Number(v[2]) || 0, _reflLooseMs_(v[3], tz)];
  });
  /* Reflections (0) and Reflections (Test) (1): [handed in, only part of it, let back in until (-1 = for good)] */
  var subs = {};
  ['Reflections', 'Reflections (Test)'].forEach(function (nm, k) {
    _eachRow_(wb.getSheetByName(nm), ['Email', 'Timestamp', 'Submission Count', 'Retry Allowed', 'Validation flags'], function (v) {
      var em = String(v[0]).trim().toLowerCase(), key = em + '|' + k;
      if (!em || subs.hasOwnProperty(key)) return;  /* the first row of an email decides */
      var ts = String(v[1] == null ? '' : v[1]).trim(), cnt = parseInt(v[2], 10) || 0;
      subs[key] = [ts && cnt >= 1 ? 1 : 0, /INCOMPLETE-SUBMISSION/i.test(String(v[4] == null ? '' : v[4])) ? 1 : 0, _reflRetryUntil_(v[3], tz)];
    });
  });
  return { title: title.slice(0, 120), seat: seat, live: live, subs: subs };
}

/* copies parseMarksTabName_: "Marks · 10A", "Marks·10A · B", "Marks · Test" (the teachers' seat) */
function _reflMarksTab_(name) {
  var sn = String(name);
  if (sn.indexOf('Marks · ') !== 0 && sn.indexOf('Marks·') !== 0 && sn.indexOf('Marks ·') !== 0) return null;
  var parts = sn.split('·').map(function (p) { return p.trim(); });
  if (parts.length < 2 || !parts[1]) return null;
  return { isTest: parts[1].toUpperCase() === 'TEST' };
}

/* copies isRetryAllowed_, as a time: -1 = YES (for good), a later ms = until then, 0 = not let back in */
function _reflRetryUntil_(val, tz) {
  if (!val) return 0;
  var raw = String(val).trim(), upper = raw.toUpperCase();
  if (upper === 'YES') return -1;
  if (upper.indexOf('RETRY_UNTIL:') !== 0) return 0;
  var p = raw.substring('RETRY_UNTIL:'.length).trim();
  if (!p) return 0;
  if (/^\d+$/.test(p)) { var n = parseInt(p, 10); return isNaN(n) ? 0 : n; }
  var m = p.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  return m ? _reflWallMs_(+m[3], +m[2], +m[1], +m[4], +m[5], +m[6], tz) : 0;
}

/* copies _parseSheetTimestampMs_ for LiveProgress "Started", read in the reflection script's time zone: a date or a
   number as it is; "dd/mm/yyyy, hh:mm:ss" text DAY first, as the reflection reads it since its §40.90 (29 Sep 2026 —
   it used to take V8's month-first reading, "5/3/2026, 14:23:45" as 3 May, which timed a stuck row wrongly on many
   days); other text as Date.parse reads it */
function _reflLooseMs_(v, tz) {
  if (v === null || v === undefined || v === '') return 0;
  if (v instanceof Date) { var t = v.getTime(); return (t && !isNaN(t)) ? t : 0; }
  if (typeof v === 'number') return v > 0 ? v : 0;
  var s = String(v).trim();
  if (!s) return 0;
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    var w = _reflWallMs_(+m[3], +m[2], +m[1], +m[4], +m[5], +(m[6] || 0), tz);
    if (w) return w;
  }
  var n = Date.parse(s);
  return isNaN(n) ? 0 : n;
}

/* A wall-clock time in time zone `tz` as ms: what new Date(y, mo - 1, d, h, mi, s) gives in a script running there */
function _reflWallMs_(y, mo, d, h, mi, s, tz) {
  var guess = Date.UTC(y, mo - 1, d, h, mi, s);
  if (isNaN(guess)) return 0;
  if (!tz) return new Date(y, mo - 1, d, h, mi, s).getTime();
  var off = function (t) {
    var w = String(Utilities.formatDate(new Date(t), tz, "yyyy-MM-dd'T'HH:mm:ss"));
    var x = w.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
    return x ? Date.UTC(+x[1], +x[2] - 1, +x[3], +x[4], +x[5], +x[6]) - t : 0;
  };
  return guess - off(guess - off(guess));
}

/* copies _computeEffectiveStamp1Ms_ */
function _reflStamp1_(raw, screen, startedMs, now) {
  if (raw > 0) return raw;
  if (screen < 1 || screen >= 8) return 0;
  return (startedMs > 0 && (now - startedMs) >= 2 * REFL_LOCKOUT_MS) ? startedMs : 0;
}

/* This person's card in one reflection: { state } — 'start' | 'going' | 'again' | 'part' | 'time' — or
   { state: '', why: 'not-listed' | 'complete' } */
function _reflCardFor_(snap, email, now) {
  var seat = snap.seat[email];
  if (seat !== 0 && seat !== 1) return { state: '', why: 'not-listed' };
  var sub = snap.subs[email + '|' + seat], L = snap.live[email] || [0, 0, 0];
  /* in the form's own order (checkExistingSession): out of time first — a pupil let back in who then runs out of
     time again meets the lockout screen, so a "Continue" there would lead nowhere; then a session under way (screens
     1–7, or a start stamp on a row cleared back to 0), which the form resumes whatever Reflections says; only then
     what was handed in */
  var s1 = _reflStamp1_(L[1], L[0], L[2], now);
  if (s1 > 0 && L[0] < 8 && now >= s1 + REFL_LOCKOUT_MS) return { state: 'time' };
  if ((L[0] >= 1 && L[0] < 8) || (L[0] === 0 && s1 > 0)) return { state: 'going' };
  if (sub && sub[0]) {
    if (sub[2] === -1 || sub[2] > now) return { state: 'again' };
    return sub[1] ? { state: 'part' } : { state: '', why: 'complete' };
  }
  if (L[0] >= 8) return { state: '', why: 'complete' };        /* the form's own wall: handed in */
  return { state: 'start' };
}

/* The card for this person across every reflection switched on: { card: {state, name, url?} | null, why: [], on } */
function _ownReflectCard_(email, teacher, now) {
  var list = _reflCardList_(teacher), best = null, why = [];
  list.forEach(function (r) {
    var snap = _reflSnapshot_(r.id, r.tz, teacher);    /* a teacher testing sees it as it is NOW */
    if (!snap || snap.fail) { why.push((snap && snap.fail) || 'a reflection spreadsheet could not be read'); return; }
    var c = _reflCardFor_(snap, email, now), nm = r.name || snap.title || 'Your reflection';
    if (!c.state) {
      why.push(c.why === 'complete' ? 'you have handed in a complete reflection for “' + nm + '”'
                                    : '“' + nm + '” does not list ' + email + ' on any of its Marks tabs');
      return;
    }
    var card = { state: c.state, name: nm, rank: REFL_RANK[c.state], at: r.at || 0 };
    if (c.state === 'start' || c.state === 'going' || c.state === 'again') card.url = r.url;
    if (!best || card.rank < best.rank || (card.rank === best.rank && card.at > best.at)) best = card;
  });
  var out = { card: null, why: why, on: list.length };
  if (best) { out.card = { state: best.state, name: best.name }; if (best.url) out.card.url = best.url; }
  return out;
}
/* §hub-card end */

/* ============================================================
   The teacher page
   ------------------------------------------------------------
   What it is and why it is safe is at the top, under "The teacher page". In short: it is meant for
   a deployment Google itself restricts to the school, and on any deployment it opens only for a
   teacher on the list. Besides the rows of the "🔗 Teacher links" tab, its tabs hold the roster
   (names, classes, school addresses), the lab and Bio English marks, and the homework. A link on
   it opens only for people that file is shared with: the page lists the spreadsheets, it does not
   share them.
   ============================================================ */
var T_LINKS = '🔗 Teacher links';
var T_TEACHERS = '👩‍🏫 Teachers';

/* Pupils have addresses at …@pupils.<school> and staff at …@<school>: both are the school's. */
function _inDomain_(email, dom) {
  var host = String(email || '').split('@').pop().toLowerCase();
  return !!dom && (host === dom || host.slice(-(dom.length + 1)) === '.' + dom);
}

function _owner_() {
  try { return _cleanEmail_(Session.getEffectiveUser().getEmail()); } catch (e) { return ''; }
}

/* ── Who counts as a teacher ────────────────────────────────────────────────
   Two sources, unioned: the "👩‍🏫 Teachers" tab (managed from the dialog), and the older
   TEACHERS line/property, for anyone who set it that way. Both are read live, so adding a
   teacher from the dialog takes effect at once — no code change, no redeploy. */
function _headerCol_(sh, name, dflt) {
  try {
    var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    /* headers dressed by _dress2_ carry a leading "✎ " on the editable ones; strip it before matching */
    for (var i = 0; i < hdr.length; i++)
      if (String(hdr[i]).replace(/^\s*✎\s*/, '').trim().toLowerCase() === name.toLowerCase()) return i + 1;
  } catch (e) {}
  return dflt;
}
function _teacherEmails_() {
  var seen = {}, list = [];
  function add(e) {
    e = _cleanEmail_(e);
    if (e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !seen[e]) { seen[e] = 1; list.push(e); }
  }
  try {
    var sh = _ss_().getSheetByName(T_TEACHERS);
    if (sh && sh.getLastRow() >= 2) {
      var ec = _headerCol_(sh, 'Email', 2);
      sh.getRange(2, ec, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { add(r[0]); });
    }
  } catch (e) {}
  var raw = String(_keptSetting_(TEACHERS, 'TEACHERS') || '');
  if (!/^\s*none\s*$/i.test(raw)) raw.split(/[\s,;]+/).forEach(add);
  return list;
}

/* You, always. Anybody else must be on the list AND have an address at the school's own domain —
   never under it — so a pupil's address added by mistake still opens nothing. */
function _isTeacher_(email) {
  email = _cleanEmail_(email);
  if (!email) return false;
  if (email === _owner_()) return true;
  var dom = _schoolDomain_();
  if (dom && email.split('@').pop() !== dom) return false;
  return _teacherEmails_().indexOf(email) >= 0;
}

/* Only the owner or a listed teacher, working inside the spreadsheet, may run the dialog's
   actions — so nothing here can be reached from the public web app. Mirrors the reflection
   system's own guard: in a bound menu/dialog the effective user is the owner; a call with no
   identity can only be the bound spreadsheet itself (the web app has no UI). */
function _isAdminCaller_() {
  var act = '';
  try { act = _cleanEmail_(Session.getActiveUser().getEmail()); } catch (e) {}
  if (act && (act === _owner_() || _isTeacher_(act))) return true;
  if (!act) { try { SpreadsheetApp.getUi(); return true; } catch (e) {} }
  return false;
}

/* The teacher page's own address, from TEACHER_PAGE_URL, pointed at the page. Anything that is not
   an Apps Script /exec address is ignored rather than handed to the hub. */
function _teacherPageUrl_() {
  var u = String(_keptSetting_(TEACHER_PAGE_URL, 'TEACHER_PAGE_URL') || '').trim();
  return _isExecUrl_(u) ? u.replace(/\?.*$/, '') + '?page=teachers' : '';
}
function _isExecUrl_(u) {
  return /^https:\/\/script\.google\.com\/[^\s?#]+\/exec$/.test(String(u || '').replace(/\?.*$/, ''));
}

/* Write a kept setting (the dialog's Save). Kept in Script Properties exactly where _keptSetting_
   reads it, so a value set here survives pasting a fresh copy of this file. */
function _setKept_(key, value) {
  try { PropertiesService.getScriptProperties().setProperty(key, String(value == null ? '' : value)); }
  catch (e) {}
}

/* The two tabs the dialog manages. Made on demand, so the dialog works the first time it opens (Tidy up makes them too). */
function _ensureTeacherTabs_() {
  var ss = _ss_();
  if (!ss.getSheetByName(T_TEACHERS)) {
    var t = ss.insertSheet(T_TEACHERS);
    t.getRange(1, 1, 1, 3).setValues([['Name', 'Email', 'Added']]);
    _dress2_(t, [
      { h:'Name',  w:220, edit:true, note:'The teacher’s name, for your own reference. The address is what actually decides access.' },
      { h:'Email', w:260, edit:true, note:'Their school address. Staff addresses only — a pupil address here still opens nothing.' },
      { h:'Added', w:150, fmt:'dd MMM, HH:mm', note:'When they were added.' }
    ], { tab:'#9D3FB0' });
  }
  var lk = ss.getSheetByName(T_LINKS);
  if (!lk) {
    lk = ss.insertSheet(T_LINKS);
    lk.getRange(1, 1, 1, _LINK_HEADERS_.length).setValues([_LINK_HEADERS_]);
    var tid = _trackerId_(), seed = [], selfUrl = '';
    if (tid) seed.push(['Records', 'Student Progress Tracker', '', 'Student Progress Tracker',
                        'https://docs.google.com/spreadsheets/d/' + tid + '/edit', 'Every cohort, every reflection', '']);
    try { selfUrl = ss.getUrl(); } catch (e) {}
    if (selfUrl) seed.push(['Records', 'Student data (the labs)', '', 'Student data',
               selfUrl, 'Lab work and the class lists', '']);
    if (seed.length) lk.getRange(2, 1, seed.length, _LINK_HEADERS_.length).setValues(seed);
    _dress2_(lk, _linkColDefs_(), { tab:'#0ea5e9' });
  } else {
    _migrateLinksTab_(lk);
  }
  return { teachers: T_TEACHERS, links: T_LINKS };
}

var _LINK_HEADERS_ = ['Type', 'Assessment', 'Graduation year', 'Name', 'Link', 'Note', 'Dashboard'];
function _linkColDefs_() {
  return [
    { h:'Type',            w:130, edit:true, note:'What kind of thing this is — Reflection, Test, Survey, Records … Anything you like; the page groups by it.' },
    { h:'Assessment',      w:230, edit:true, note:'What the test, topic or survey is — for example “Topic 7 · Human Nutrition”.' },
    { h:'Graduation year', w:130, edit:true, note:'The cohort, by the year it graduates — in 2026–27, Y11 is 2027, Y10 is 2028 and Y9 is 2029. The same test for another cohort is another row. Leave blank for something that is not tied to one cohort (a tracker, say).' },
    { h:'Name',            w:210, edit:true, note:'What the link is called on the page. Left blank, the Assessment is used.' },
    { h:'Link',            w:420, edit:true, note:'The full address, starting https:// — from the spreadsheet or form’s address bar, or Share ▸ Copy link.' },
    { h:'Note',            w:280, edit:true, note:'One line under the name. Optional.' },
    { h:'Dashboard',       w:420, edit:true, note:'Optional — a second way in, beside the spreadsheet. Both the test system and the reflection system serve a live teacher dashboard at their own web-app address ending /exec?page=dashboard; paste that here and the card offers it. Left blank, the card just opens the spreadsheet as before.' }
  ];
}

/* The address a cell holds, however Sheets is keeping it. Four ways, all met in practice:
     typed or pasted as text         the value IS the address
     a link put on some text         Insert ▸ Link: the value is the words, the address is the link
     a smart chip                    NOT here. Paste a Drive link and Sheets offers to turn it into a
                                     chip; the value is then only the file's name, and neither getValues
                                     nor getRichTextValues ever returns the address. The Sheets API's
                                     chipRuns does — see _chipGrid_ (no Drive permission: that is only
                                     for WRITING chips). A chip still unread is reported, not dropped.
     =HYPERLINK("address", "label")  the value is the label, the address is in the formula
   `rich` is the cell's RichTextValue (null for a number or a date); `formula` its formula, or ''. */
function _cellUrl_(value, rich, formula) {
  var isUrl = function (x) { return /^https:\/\//i.test(String(x || '').trim()); };
  var v = String(value == null ? '' : value).trim();
  if (isUrl(v)) return v;
  if (rich) {
    var u = '';
    try { u = rich.getLinkUrl() || ''; } catch (e) {}
    if (!u) {
      try {                                  /* a link on only part of the text: look run by run */
        var runs = rich.getRuns();
        for (var i = 0; i < runs.length && !u; i++) u = runs[i].getLinkUrl() || '';
      } catch (e) {}
    }
    if (isUrl(u)) return String(u).trim();
  }
  var m = String(formula || '').match(/^=\s*HYPERLINK\(\s*"([^"]+)"/i);
  if (m && isUrl(m[1])) return m[1].trim();
  return '';
}

/* SMART CHIPS. Apps Script's own reading gives only a chip's name (see _cellUrl_); the address comes
   from the Sheets API, which needs the "Google Sheets API" service switched on in this script:
   Services  ▸  + (Add a service)  ▸  Google Sheets API  ▸  Add, identifier "Sheets". No new
   permission: it uses the spreadsheet access this script already has (Google asks for Drive access
   only to WRITE a chip, which this never does). One call for a whole block. Returns a grid of
   addresses ('' where a cell holds no chip), or null when the service is off or the read fails —
   the chips are then reported (_teacherLinksScan_), never guessed at. */
function _chipsOn_() { return typeof Sheets !== 'undefined' && !!Sheets && !!Sheets.Spreadsheets; }
function _colA1_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
var _CHIP_TROUBLE_ = '';   /* why the last chip read gave no address — told to teachers, never pupils */
function _chipGrid_(sh, row, nRows, nCols) {
  if (nRows < 1 || nCols < 1) return null;
  _CHIP_TROUBLE_ = '';
  var id, range, trouble = [];
  try {                                   /* never throws: the teacher page and the banner both rest on this */
    id = sh.getParent().getId();
    range = "'" + sh.getName().replace(/'/g, "''") + "'!A" + row + ':' + _colA1_(nCols) + (row + nRows - 1);
  } catch (e) { _CHIP_TROUBLE_ = 'the tab could not be located: ' + String(e && e.message || e).slice(0, 160); return null; }
  var fields = 'sheets.data.rowData.values(chipRuns)';
  /* 1 · through the Sheets service, when it is switched on */
  if (_chipsOn_()) {
    try {
      var g1 = _chipParse_(Sheets.Spreadsheets.get(id, { ranges: [range], fields: fields }), nRows, nCols);
      if (_chipAny_(g1)) return g1;
      trouble.push('the Sheets service answered without any chip address');
    } catch (e) { trouble.push('the Sheets service said: ' + String(e && e.message || e).slice(0, 160)); }
  }
  /* 2 · the same API asked directly. The service is a ready-made copy of Google's API and can lag
     behind it, leaving newer fields such as chipRuns out; the raw answer has everything Google sent. */
  try {
    var res = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + id +
                                '?ranges=' + encodeURIComponent(range) + '&fields=' + encodeURIComponent(fields),
                                { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    var code = res.getResponseCode(), text = res.getContentText();
    if (code === 200) {
      var g2 = _chipParse_(JSON.parse(text), nRows, nCols);
      if (_chipAny_(g2)) return g2;
      trouble.push('Google answered without any chip address');
    } else {
      var msg = ''; try { msg = JSON.parse(text).error.message; } catch (e) { msg = text; }
      trouble.push('asked directly, Google said ' + code + ': ' + String(msg).replace(/\s+/g, ' ').slice(0, 160));
    }
  } catch (e) { trouble.push('asking Google directly failed: ' + String(e && e.message || e).slice(0, 160)); }
  _CHIP_TROUBLE_ = trouble.join('; ');
  return null;
}
/* Google's answer as a grid of addresses, '' where a cell holds no chip */
function _chipParse_(res, nRows, nCols) {
  var data = (((res && res.sheets) || [])[0] || {}).data || [];
  var rows = (data[0] && data[0].rowData) || [], out = [];
  for (var i = 0; i < nRows; i++) {
    var vals = (rows[i] && rows[i].values) || [], line = [];
    for (var j = 0; j < nCols; j++) {
      var runs = (vals[j] && vals[j].chipRuns) || [], u = '';
      for (var k = 0; k < runs.length && !u; k++) {
        var p = runs[k] && runs[k].chip && runs[k].chip.richLinkProperties;
        if (p && /^https:\/\//i.test(String(p.uri || ''))) u = String(p.uri).trim();
      }
      line.push(u);
    }
    out.push(line);
  }
  return out;
}
function _chipAny_(g) { return !!g && g.some(function (r) { return r.some(function (u) { return !!u; }); }); }

/* A block of the links tab as its values AND as the address each cell holds. Three reads for the
   whole block, never three per cell — and a fourth, to the Sheets API, only when one of `chipCols`
   (0-based: the Link and Dashboard columns) has words in it but no address: a smart chip. */
function _linkGrid_(sh, row, nRows, nCols, chipCols) {
  if (nRows < 1 || nCols < 1) return { values: [], urls: [] };
  var rg = sh.getRange(row, 1, nRows, nCols);
  var values = rg.getValues(), rich = [], forms = [];
  try { rich = rg.getRichTextValues(); } catch (e) {}
  try { forms = rg.getFormulas(); } catch (e) {}
  var urls = values.map(function (r, i) {
    return r.map(function (v, j) { return _cellUrl_(v, rich[i] ? rich[i][j] : null, forms[i] ? forms[i][j] : ''); });
  });
  var cols = (chipCols || []).filter(function (c) { return c >= 0 && c < nCols; });
  var gap = cols.length > 0 && values.some(function (r, i) {
    return cols.some(function (c) { return String(r[c] == null ? '' : r[c]).trim() !== '' && !urls[i][c]; });
  });
  if (gap) {
    var chips = _chipGrid_(sh, row, nRows, nCols);
    if (chips) urls = urls.map(function (r, i) { return r.map(function (u, j) { return u || (chips[i] && chips[i][j]) || ''; }); });
  }
  return { values: values, urls: urls };
}

/* Read one row of the links tab into a clean object, whatever shape the tab is in. The address is
   found by the Link column when its header is present and that cell really holds a link, and
   otherwise by looking for the one cell in the row that holds an https address — which is what lets
   a tab left half-migrated, or one an old version wrote, still be read correctly. The other fields
   are then taken by their position relative to the address:
     address at column 5 (0-based 4)  →  Type · Assessment · Graduation year · Name · [Link] · Note · Dashboard
     address at column 3 (0-based 2)  →  old  Section · Name · [Link] · Note
   `r` is the row's values and `urls` the address each of its cells holds (see _linkGrid_); with no
   `urls`, only a typed address is seen. `kHead` / `dHead` are the 0-based Link and Dashboard
   columns from the header, or -1. */
function _readLinkRow_(r, kHead, rowNum, dHead, urls) {
  urls = urls || r;
  var isUrl = function (x) { return /^https:\/\//i.test(String(x || '').trim()); };
  var k = (kHead >= 0 && isUrl(urls[kHead])) ? kHead : -1;
  /* Never the Dashboard column. When the Link is a smart chip (see _cellUrl_: a chip's address
     cannot be read), the first address left in the row IS the dashboard — taking it made "Open"
     go to the students' form and, being the wrong column, lost the row's graduation year. */
  if (k < 0) for (var i = 0; i < urls.length; i++) if (i !== dHead && isUrl(urls[i])) { k = i; break; }
  if (k < 0) return null;
  var url = String(urls[k]).trim();
  if (!/^https:\/\/[^\s"'<>]+$/i.test(url)) return null;
  var type, assessment, grad = '', name = '', note = '';
  if (k === 4) {                                       /* the six- and seven-column shapes */
    type = String(r[0] || '').trim(); assessment = String(r[1] || '').trim();
    grad = String(r[2] || '').trim(); name = String(r[3] || '').trim(); note = String(r[5] || '').trim();
  } else if (k === 2) {                                /* the old four-column shape (Section · Name · Link · Note) */
    type = String(r[0] || '').trim(); assessment = String(r[1] || '').trim(); note = String(r[3] || '').trim();
  } else {                                             /* anything else: best effort */
    type = String(r[0] || '').trim(); assessment = String(r[k - 1] || r[1] || '').trim(); note = String(r[k + 1] || '').trim();
  }
  /* a chip shows the file's own name: the best label there is when the row gives none */
  var shown = String(r[k] == null ? '' : r[k]).trim();
  if (isUrl(shown)) shown = '';
  /* The dashboard address is optional, and is read by its own header wherever the tab has one,
     falling back to the seventh column of the current shape. It is deliberately NOT found by
     scanning the row for an https cell the way the address above is: on a tab still six columns
     wide the only other address in the row IS the spreadsheet, and a scan would hand it back as
     a dashboard, giving every card two buttons that go to the same place. */
  var dash = '';
  var dRaw = String(((dHead != null && dHead >= 0) ? urls[dHead] : (k === 4 ? urls[6] : '')) || '').trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(dRaw) && dRaw !== url) dash = dRaw;

  return { row: rowNum, type: type || 'Other', assessment: assessment, grad: grad,
           name: name || assessment || shown || 'Spreadsheet', url: url, note: note, dash: dash };
}

/* The links tab has had three shapes: the old four columns (Section · Name · Link · Note), then six
   (Type · Assessment · Graduation year · Name · Link · Note), now seven, with Dashboard last.
   Upgrading only ever ADDS. It never rewrites a row it cannot read, because a row lost here cannot
   be got back, while a tab left in an older shape still reads perfectly well (_readLinkRow_ takes
   any of them):
     six columns → seven   the Dashboard heading is written into column G and nothing else is
                           touched, so a smart chip, a link on some words or a =HYPERLINK() in the
                           Link column stays exactly as it was. (The first version of this rebuilt
                           every row from its values — and a row whose link was a chip has no
                           address among its values, so it was dropped. Caught on 18 Sep 2026,
                           before it ran on a live tab.)
     column G already used by something of yours   left alone.
     the old four columns  rebuilt, reading each address as _linkGrid_ does; if even one row
                           cannot be read, the tab is left exactly as it is.
   Safe to run every time. */
function _migrateLinksTab_(sh) {
  var need = _LINK_HEADERS_.length;
  var wide = Math.max(sh.getLastColumn(), 1);
  var hdr = sh.getRange(1, 1, 1, wide).getValues()[0].map(function (h) {
    return String(h).replace(/^\s*✎\s*/, '').trim().toLowerCase();
  });
  var same = function (n) {
    for (var i = 0; i < n; i++) if (hdr[i] !== _LINK_HEADERS_[i].toLowerCase()) return false;
    return true;
  };
  if (wide === need && same(need)) return;                        /* already current */

  if (same(need - 1)) {                                           /* the six-column shape */
    if (wide >= need) {                                           /* is column G free — heading and every cell? */
      var colG = sh.getRange(1, need, Math.max(sh.getLastRow(), 1), 1).getValues();
      for (var g = 0; g < colG.length; g++) if (String(colG[g][0]).trim() !== '') return;
    }
    if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
    sh.getRange(1, need).setValue(_LINK_HEADERS_[need - 1]);
    _dress2_(sh, _linkColDefs_(), { tab:'#0ea5e9' });
    return;
  }

  /* an older shape: rebuild, but only if every row can be read */
  var last = sh.getLastRow();
  var kHead = _headerCol_(sh, 'Link', 0) - 1;            /* 0-based, or -1 */
  var dHead = _headerCol_(sh, 'Dashboard', 0) - 1;      /* 0-based, or -1 when the tab predates it */
  var grid = _linkGrid_(sh, 2, last - 1, wide, [kHead, dHead]);
  var out = [];
  for (var i = 0; i < grid.values.length; i++) {
    var r = grid.values[i];
    if (r.every(function (c) { return String(c == null ? '' : c).trim() === ''; })) continue;   /* a blank row */
    var o = _readLinkRow_(r, kHead, 0, dHead, grid.urls[i]);
    if (!o) return;                                               /* one we cannot read: touch nothing */
    out.push([o.type, o.assessment, o.grad, o.name, o.url, o.note, o.dash]);
  }

  if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
  var data = [_LINK_HEADERS_].concat(out);
  sh.getRange(1, 1, data.length, need).setValues(data);
  if (sh.getMaxRows() > data.length)
    sh.getRange(data.length + 1, 1, sh.getMaxRows() - data.length, sh.getMaxColumns()).clearContent();
  if (sh.getLastColumn() > need)
    sh.getRange(1, need + 1, sh.getMaxRows(), sh.getLastColumn() - need).clearContent();
  _dress2_(sh, _linkColDefs_(), { tab:'#0ea5e9' });
}

/* Every link row, in full, for the dialog and for the page. Format-robust: it reads a tab in the
   current shape, one an earlier version wrote, or one left half-migrated (see _readLinkRow_), and it
   reads an address however the cell holds it (see _cellUrl_) — a smart chip included. */
function _teacherLinksRaw_() { return _teacherLinksScan_().rows; }

/* The rows it can read, and the rows it cannot — a row with something in it but no address this
   script can see, which in practice is a smart chip in the Link column. Those are named back to
   the teacher (the page, the dialog, test mode) instead of disappearing or being misread.
   A Link TYPED as an address that is not https (http://…, docs.google.com/… with no https://, a
   javascript:) is not a chip. That row never becomes a card and its address never reaches a page;
   it is only NAMED, in `typed`, so the typo can be found (Daniel, 25 Sep 2026). From 18 to 25 Sep
   2026 such a row was reported as a "smart chip", javascript: text and all, which is what gastest's
   teacher-page test caught. */
function _teacherLinksScan_() {
  var sh = _ss_().getSheetByName(T_LINKS);
  if (!sh || sh.getLastRow() < 2) return { rows: [], unreadable: [], typed: [], chipsOn: _chipsOn_() };
  var last = sh.getLastRow(), wide = sh.getLastColumn();
  var kHead = _headerCol_(sh, 'Link', 0) - 1;            /* 0-based, or -1 */
  var dHead = _headerCol_(sh, 'Dashboard', 0) - 1;      /* 0-based, or -1 when the tab predates it */
  var grid = _linkGrid_(sh, 2, last - 1, wide, [kHead, dHead]);
  var rows = [], unreadable = [], typed = [];
  /* a typed row's name and type, unless the address was pasted into them as well */
  var label = function (x) { x = String(x || '').trim(); return _typedAddress_(x) ? '' : x; };
  grid.values.forEach(function (r, i) {
    var o = _readLinkRow_(r, kHead, i + 2, dHead, grid.urls[i]);
    if (o) { rows.push(o); return; }
    if (!r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; })) return;   /* a blank row */
    var shown = kHead >= 0 ? String(r[kHead] == null ? '' : r[kHead]).trim() : '';
    if (_typedAddress_(shown)) {                        /* not https, and not a chip: named, never shown */
      typed.push({ row: i + 2, type: label(r[0]), name: label(r[3]) || label(r[1]) || 'row ' + (i + 2) });
      return;
    }
    unreadable.push({ row: i + 2, type: String(r[0] || '').trim(),
                      name: String(r[3] || r[1] || '').trim() || 'a row', shown: shown });
  });
  return { rows: rows, unreadable: unreadable, typed: typed, chipsOn: _chipsOn_(), chipTrouble: unreadable.length ? _CHIP_TROUBLE_ : '' };
}

/* A Google Sheet's id from its address, in every shape Google writes one (see _testSheetIds_), or ''. */
function _sheetIdOf_(url) {
  var m = String(url || '').match(/^https:\/\/docs\.google\.com\/(?:a\/[^\/]+\/)?spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : '';
}

/* ============================================================
   🔎 Find new reflection and test spreadsheets (26 Sep 2026)
   ============================================================
   A reflection spreadsheet (the reflection system's _labelForHub_) and a test spreadsheet (the Test System's
   §hub-label) each write ONE line into their own Drive description:
     🪞 Biology reflection spreadsheet | name: Topic 7 · Human Nutrition | class of: 2028 | dashboard: https://…/exec?page=dashboard | …
     🧪 Biology Test System spreadsheet | name: … | class of: … | dashboard: … | …
   A teacher presses 🔎 Find new… (in the Teacher page window, or the menu), and every labelled spreadsheet not yet in
   🔗 Teacher links becomes an ordinary row there — type, name, class, link, dashboard — so teachers reach it from the
   teacher page like any other, and a test gets its "Sit a test" banner. Daniel (26 Sep 2026): "click a button, runs
   the check, it's added, and that's it, but not constantly" — nothing searches Drive on its own, and a row, once added,
   is never checked again: it is yours to edit or remove. A spreadsheet removed in the window is left out of the next
   Finds (Script Property FIND_SKIP_SHEETS) until "Add back". Records and surveys (Forms run none of this code) are
   still added by hand. A labelled spreadsheet counts when it belongs to the account this script runs as or to a
   teacher on the list AND sits in a folder that belongs to that account, a listed teacher or someone at the school's
   own domain (_findTrusts_: never a pupil, whose address sits UNDER the domain), or when it sits in a shared-drive
   folder a teacher chose to watch (FIND_FOLDERS, below). A look-alike a pupil made and handed over stays in THEIR
   folder, so a pupil cannot plant a card whose dashboard is their own page (and a dashboard must be an Apps Script
   address). A copy carries its original's label until it writes its own, so the same card twice is one spreadsheet —
   the older file. */
var FOUND_KINDS = [{ phrase: 'Biology reflection spreadsheet', type: 'Reflection' },
                   { phrase: 'Biology Test System spreadsheet', type: 'Test' }];
var FIND_SKIP = 'FIND_SKIP_SHEETS';   /* Script Property: [{id, name}] removed in the window; Find leaves them out */
/* Shared drives (26 Sep 2026: Daniel's department keeps its tests in a SHARED DRIVE). A file there belongs to the
   drive, not to a person, so neither the owner rule nor Drive's owner search can vouch for it. A teacher vouches for a
   FOLDER instead: "Add it" on a spreadsheet in a shared drive also adds that folder here, and from then on every Find
   also lists the spreadsheets IN it (DriveApp, no search: a folder listing sees shared drives and needs no index) and
   adds the labelled ones. ✕ in the window stops it. */
var FIND_FOLDERS = 'FIND_FOLDERS';   /* Script Property: [{id, name}] folders Find also looks in */
function _findFolders_() {
  try {
    var v = JSON.parse(PropertiesService.getScriptProperties().getProperty(FIND_FOLDERS) || '[]');
    return (Array.isArray(v) ? v : []).filter(function (x) { return x && /^[A-Za-z0-9_-]{10,}$/.test(String(x.id)); })
      .map(function (x) { return { id: String(x.id), name: String(x.name || '').slice(0, 120) }; });
  } catch (e) { return []; }
}
function _setFindFolders_(list) {
  PropertiesService.getScriptProperties().setProperty(FIND_FOLDERS, JSON.stringify(list.slice(-40)));
}

/* Whose folders Find trusts (26 Sep 2026: Daniel's tests live in a department folder shared with him, which he does
   not own): yours; a teacher on the 👩‍🏫 Teachers list; anyone at the school's own domain (SCHOOL_DOMAIN) — a shared
   department folder belongs to a member of staff. Never a pupil: pupils' addresses sit UNDER the domain
   (…@pupils.<domain>), which is not the domain itself. */
function _findTrusts_(email) {
  email = _cleanEmail_(email);
  if (!email) return false;
  if (email === _owner_() || _isTeacher_(email)) return true;
  var dom = _schoolDomain_();
  return !!dom && email.split('@').pop() === dom;
}

/* One search of Drive → { cards: [{ id, url, type, name, grad, dash }], trouble: '' or why it could not look }.
   Spreadsheets that belong to you or to a teacher on the list, in a folder Find trusts (_findTrusts_). */
function _findLabelledSheets_() {
  var cards = {}, order = [], looked = [], folderTrouble = [];
  /* one card per spreadsheet; a copy carries its original's line (dashboard included) until it has a web app of its
     own and writes its own — and it may still carry an OLD line after the original's changed. One dashboard is one
     web app, so one spreadsheet: the same dashboard twice keeps the older file; with no dashboard, the same card. */
  function take(f, card) {
    card.id = f.getId();
    card.url = 'https://docs.google.com/spreadsheets/d/' + card.id + '/edit';
    var made = f.getDateCreated();
    card.made = made && made.getTime ? made.getTime() : 0;
    var k = card.dash ? 'd|' + card.dash : ['n', card.type, card.name, card.grad].join('|');
    if (cards[k] && cards[k].made <= card.made) return;
    if (!cards[k]) order.push(k);
    cards[k] = card;
  }
  try {
    if (typeof DriveApp === 'undefined' || !DriveApp || typeof DriveApp.searchFiles !== 'function') return { cards: [], trouble: 'this script cannot use Drive' };
    var me = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
    if (!me || me.indexOf("'") >= 0) return { cards: [], trouble: 'the account this script runs as is unknown' };
    var owners = [me].concat(_teacherEmails_().filter(function (e) { return e !== me && _isTeacher_(e) && e.indexOf("'") < 0; })).slice(0, 30);
    var q = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and (" +
            owners.map(function (e) { return "'" + e + "' in owners"; }).join(' or ') + ") and (" +
            FOUND_KINDS.map(function (k) { return "fullText contains '\"" + k.phrase + "\"'"; }).join(' or ') + ')';
    var it = DriveApp.searchFiles(q);
    for (var seen = 0; it.hasNext() && seen < 300 && order.length < 150; seen++) {
      var f = it.next();
      var card = _readHubLabel_(f.getDescription());
      if (!card) continue;                                   /* the words were in a cell, not in its label */
      var trusted = false, ps = f.getParents();
      while (!trusted && ps.hasNext()) { var o = ps.next().getOwner(); trusted = !!o && _findTrusts_(o.getEmail()); }
      if (!trusted) continue;
      take(f, card);
    }
  } catch (e) { Logger.log('_findLabelledSheets_: ' + e); return { cards: [], trouble: String(e && e.message || e).slice(0, 200) }; }
  /* the folders a teacher vouched for (shared drives): list them, no search */
  _findFolders_().forEach(function (fd) {
    try {
      var folder = DriveApp.getFolderById(fd.id), files = folder.getFiles();
      looked.push(folder.getName() || fd.name);
      for (var n = 0; files.hasNext() && n < 400; n++) {
        var g = files.next();
        if (g.getMimeType() !== 'application/vnd.google-apps.spreadsheet' || (g.isTrashed && g.isTrashed())) continue;
        var c2 = _readHubLabel_(g.getDescription());
        if (c2) take(g, c2);
      }
    } catch (e) { folderTrouble.push((fd.name || fd.id) + ': ' + String(e && e.message || e).slice(0, 120)); }
  });
  var out = order.map(function (k) { var c = cards[k]; return { id: c.id, url: c.url, type: c.type, name: c.name, grad: c.grad, dash: c.dash }; });
  return { cards: out, trouble: '', looked: looked, folderTrouble: folderTrouble };
}

/* The labelled line of a Drive description → { type, name, grad, dash }, or null when there is none. */
function _readHubLabel_(desc) {
  var lines = String(desc == null ? '' : desc).split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    for (var j = 0; j < FOUND_KINDS.length; j++) {
      if (lines[i].indexOf(FOUND_KINDS[j].phrase) < 0) continue;
      var card = { type: FOUND_KINDS[j].type, name: '', grad: '', dash: '' };
      lines[i].split(' | ').slice(1).forEach(function (part) {
        var m = part.match(/^\s*(name|class of|dashboard):\s*(.*?)\s*$/i);
        if (!m) return;
        var key = m[1].toLowerCase(), v = m[2];
        if (key === 'name') card.name = v.slice(0, 120);
        else if (key === 'class of' && /^\d{4}$/.test(v)) card.grad = v;
        else if (key === 'dashboard' && /^https:\/\/script\.google\.com\/[^\s"'<>|]+\/exec\?page=dashboard$/i.test(v)) card.dash = v;
      });
      if (!card.name) card.name = card.type === 'Test' ? 'A test spreadsheet' : 'A reflection spreadsheet';
      return card;
    }
  }
  return null;
}

/* The spreadsheets removed in the window, which Find leaves out: [{ id, name }]. */
function _findSkip_() {
  try {
    var v = JSON.parse(PropertiesService.getScriptProperties().getProperty(FIND_SKIP) || '[]');
    return (Array.isArray(v) ? v : []).filter(function (x) { return x && /^[A-Za-z0-9_-]{20,}$/.test(String(x.id)); })
      .map(function (x) { return { id: String(x.id), name: String(x.name || '').slice(0, 120) }; });
  } catch (e) { return []; }
}
function _setFindSkip_(list) {
  PropertiesService.getScriptProperties().setProperty(FIND_SKIP, JSON.stringify(list.slice(-300)));
}

/* One press: every labelled spreadsheet that is neither in the tab nor removed before is added as a row. */
function _findAndAdd_() {
  var res = _findLabelledSheets_(), added = [], leftOut = [];
  if (res.trouble) return { added: added, leftOut: leftOut, trouble: res.trouble, looked: 0, folders: [], folderTrouble: [] };
  var sh = _ensureTeacherTabs_() && _ss_().getSheetByName(T_LINKS);
  var have = {}, haveDash = {}, skip = {};
  _teacherLinksScan_().rows.forEach(function (r) {
    var id = _sheetIdOf_(r.url); if (id) have[id] = true;
    if (r.dash) haveDash[r.dash] = true;                 /* a card with the same dashboard is a copy of that row */
  });
  _findSkip_().forEach(function (x) { skip[x.id] = true; });
  var when = '';
  try { when = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Seoul', 'd MMM yyyy'); } catch (e) {}
  res.cards.forEach(function (c) {
    if (have[c.id] || (c.dash && haveDash[c.dash])) return;
    if (skip[c.id]) { leftOut.push({ id: c.id, type: c.type, name: c.name }); return; }
    sh.appendRow([c.type, c.name, c.grad, c.name, c.url, 'Added by 🔎 Find new spreadsheets' + (when ? ', ' + when : ''), c.dash]);
    have[c.id] = true;
    added.push({ type: c.type, name: c.name });
  });
  if (added.length) { try { CacheService.getScriptCache().put('testids1', '', 1); } catch (e) {} }   /* the banner follows at once */
  return { added: added, leftOut: leftOut, trouble: '', looked: res.cards.length, folders: res.looked || [], folderTrouble: res.folderTrouble || [] };
}
function _findSummary_(r) {
  if (r.trouble) return 'Could not look in Drive: ' + r.trouble + '.\n\nOpen Extensions ▸ Apps Script, run any function once and allow it to see your Drive, then press Find again.';
  var s = r.added.length ? 'Added to 🔗 Teacher links:\n' + r.added.map(function (a) { return '•  ' + a.type + ': ' + a.name; }).join('\n')
                         : 'Nothing new: every labelled reflection and test spreadsheet is already in 🔗 Teacher links.\n\nOne missing? In the Teacher page window, paste its address under \u201cMissing one?\u201d to see why.';
  if (r.leftOut.length) s += '\n\nLeft out, because you removed ' + (r.leftOut.length === 1 ? 'it' : 'them') + ' before: ' +
                             r.leftOut.map(function (a) { return a.name; }).join(', ') + ' (Add back in the Teacher page window).';
  if ((r.folders || []).length) s += '\n\nAlso looked in the shared-drive folder' + (r.folders.length === 1 ? '' : 's') + ': ' + r.folders.join(', ') + '.';
  if ((r.folderTrouble || []).length) s += '\n\nCould not look in: ' + r.folderTrouble.join('; ');
  return s;
}
function teacherFindSpreadsheets() {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  var r = _findAndAdd_(), d = teacherPanelData();
  d.find = r;
  return d;
}
/* "Add back": forget that it was removed, and find again. */
function teacherFindAgain(id) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  _setFindSkip_(_findSkip_().filter(function (x) { return x.id !== String(id); }));
  return teacherFindSpreadsheets();
}
/* What gives a copied spreadsheet a web app of its own, said for the system it belongs to (labs-script-008, 30 Sep
   2026: a copied reflection was sent to the Test System's menu). A reflection writes its label from the address that
   ⚙️ 🔗 Rebuild 🔗 Links tab… → Yes (until 1 Oct 2026: Update deployment URL) stores, each time its form opens, at most every six hours. */
function _ownWebAppFix_(type) {
  if (type === 'Reflection')
    return 'Give it a web app of its own: in that spreadsheet, Deploy ▸ New deployment, then 🧰 ToolBox ▸ ⚙️ Setup & config ▸ 🔗 Rebuild 🔗 Links tab… (answer Yes) with the new address. Its label is rewritten the next time its form opens (at most once every six hours); then check again.';
  return 'Give it a web app of its own (Deploy ▸ New deployment, both deployments), paste the new addresses in 🧪 Test System ▸ 🔗 Rebuild Links / readiness tab, then check again.';
}
/* "Missing one? Check its address" (26 Sep 2026: Daniel's new test was not found and nothing said why). ONE address,
   opened directly — so it does not wait for Google's search to catch up with a new label — and every reason Find
   would or would not add it, in plain words. "Add it" then adds it from its label even when Find would not (it is a
   colleague's, or sits in someone else's folder): the teacher's explicit choice. Never a copy that still names
   another spreadsheet's dashboard (the page would open the wrong test), and never twice. */
function _checkSpreadsheet_(url) {
  var raw = String(url || '').trim();
  var id = _sheetIdOf_(raw) || (/^[A-Za-z0-9_-]{25,}$/.test(raw) ? raw : '');
  if (!id) return { verdict: 'bad', say: ['That is not a Google Sheets address. Open the spreadsheet and copy the address from the browser’s address bar.'] };
  var me = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  var rows = _teacherLinksScan_().rows;
  var listed = rows.filter(function (r) { return _sheetIdOf_(r.url) === id; })[0];
  if (listed) {
    var lo = { id: id, verdict: 'listed', say: ['It is already in the list: “' + listed.name + '” (row ' + listed.row + ' of 🔗 Teacher links).'] };
    /* added before its folder was watched (or with an older "Add it"): offer to let Find look in its shared-drive folder */
    try {
      var lf = DriveApp.getFileById(id);
      if (!lf.getOwner()) {
        var lps = lf.getParents();
        if (lps.hasNext()) {
          var lp = lps.next(), lpid = lp.getId();
          if (!_findFolders_().some(function (x) { return x.id === lpid; })) {
            lo.watchable = { id: lpid, name: lp.getName() };
            lo.say.push('It is in a shared drive (folder “' + lp.getName() + '”), where 🔎 Find does not look yet. Press “Let Find look in this folder”, and the next test or reflection there is added by Find.');
          }
        }
      }
    } catch (e) {}
    return lo;
  }
  var f;
  try { f = DriveApp.getFileById(id); }
  catch (e) {
    var em = String(e && e.message || e);
    if (/permission|authori[sz]/i.test(em) && /DriveApp/.test(em))
      return { id: id, verdict: 'nodrive', say: ['This script is not allowed to look in Drive yet. Open Extensions ▸ Apps Script, run any function once and allow it to see your Drive, then check again.'] };
    return { id: id, verdict: 'unreadable', say: ['This script cannot open it (' + em.slice(0, 120) + ').',
             'If it is a colleague’s, ask them to share it with ' + (me || 'this account') + ' (Viewer is enough); then check again or add it with ➕ Add a link.'] };
  }
  var card = _readHubLabel_(f.getDescription());
  if (!card) return { id: id, verdict: 'nolabel', url: 'https://docs.google.com/spreadsheets/d/' + id + '/edit', say: [
    'It has no label yet, so Find cannot recognise it (its Drive description has no “Biology Test System spreadsheet” or “Biology reflection spreadsheet” line).',
    'A test spreadsheet writes its label when you run 🧪 Test System ▸ 🔗 Rebuild Links / readiness tab in it — with the current Test System code pasted. A reflection spreadsheet writes it when its page or dashboard is opened after its current code is deployed (✏️ New version).',
    'Or add it now with ➕ Add a link below (its address is filled in for you).'] };
  var o = f.getOwner(), owner = o ? String(o.getEmail() || '').toLowerCase() : '';
  var fo = '', pid = '', pname = '', ps = f.getParents();
  if (ps.hasNext()) { var pf = ps.next(), po = pf.getOwner(); fo = po ? String(po.getEmail() || '').toLowerCase() : ''; pid = pf.getId(); pname = pf.getName(); }
  var watched = !!pid && _findFolders_().some(function (x) { return x.id === pid; });
  var out = { id: id, card: { type: card.type, name: card.name, grad: card.grad, dash: card.dash }, say: [], canAdd: true };
  out.say.push('Its label: ' + card.type + ' · “' + card.name + '”' + (card.grad ? ' · Class of ' + card.grad : ' · no class') +
               (card.dash ? ' · with its dashboard' : ' · no dashboard address') + '.');
  var rowTwin = card.dash ? rows.filter(function (r) { return r.dash === card.dash; })[0] : null;
  var skipped = _findSkip_().some(function (x) { return x.id === id; });
  if (rowTwin) {
    out.verdict = 'copy'; out.canAdd = false;
    out.say.push('Its label names the same dashboard as “' + rowTwin.name + '”, which is already in the list — so it looks like a copy of that spreadsheet, and the page would open the wrong dashboard.',
                 _ownWebAppFix_(card.type));
    return out;
  }
  if (skipped) { out.verdict = 'removed'; out.say.push('You removed it from the list before, so Find leaves it out. “Add it” puts it back.'); return out; }
  if (!owner && !watched) {
    out.verdict = 'shareddrive'; out.folder = { id: pid, name: pname };
    out.say.push('It is in a shared drive' + (pname ? ' (folder “' + pname + '”)' : '') + '. Files there belong to the drive, not to a person, so Find cannot vouch for them on its own.',
                 'Press Add it: it adds this one, and from then on 🔎 Find also looks in that folder and adds new tests and reflections there by itself.');
    return out;
  }
  if (owner && !(owner === me || _isTeacher_(owner))) {
    out.verdict = 'notmine';
    out.say.push('It belongs to ' + (owner || 'a shared drive') + ': Find looks only at spreadsheets that belong to you or to a teacher on your \ud83d\udc69\u200d\ud83c\udfeb Teachers list (below). Add them there to have Find pick up their spreadsheets \u2014 or add this one here.');
    return out;
  }
  if (owner && !_findTrusts_(fo)) {
    out.verdict = 'folder';
    out.say.push('It sits in a folder that belongs to ' + (fo || 'a shared drive') + ', which is not yours, a listed teacher\u2019s or the school\u2019s own (' + (_schoolDomain_() ? '@' + _schoolDomain_() : 'set SCHOOL_DOMAIN') + '): Find leaves those out, so nobody can slip a spreadsheet in. If you trust it, add it here.');
    return out;
  }
  var res = _findLabelledSheets_();
  if (res.cards.some(function (x) { return x.id === id; })) { out.verdict = 'find'; out.say.push('Find sees it and will add it: press 🔎 Find, or “Add it” here.'); return out; }
  var twin = res.cards.filter(function (x) { return card.dash ? x.dash === card.dash : (x.type === card.type && x.name === card.name && x.grad === card.grad); })[0];
  if (twin) {
    out.verdict = 'copy'; out.canAdd = false;
    out.say.push('An older spreadsheet carries the same label' + (card.dash ? ' (the same dashboard)' : '') + ' — so Find takes this one for a copy of it: ' + twin.url,
                 _ownWebAppFix_(card.type));
    return out;
  }
  out.verdict = 'unindexed';
  out.say.push('Everything is right, but Google’s search has not caught up with its label yet (that can take a few minutes after the label is written). “Add it” adds it now.');
  return out;
}
function teacherCheckSpreadsheet(url) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  var d = teacherPanelData();
  try { d.check = _checkSpreadsheet_(url); } catch (e) { d.check = { verdict: 'bad', say: ['Could not check it: ' + String(e && e.message || e).slice(0, 160)] }; }
  return d;
}
function teacherAddChecked(id) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  var c = _checkSpreadsheet_('https://docs.google.com/spreadsheets/d/' + String(id || '') + '/edit');
  if (!c.card || !c.canAdd) { var d0 = teacherPanelData(); d0.check = c; return d0; }
  _setFindSkip_(_findSkip_().filter(function (x) { return x.id !== c.id; }));
  var when = '';
  try { when = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Seoul', 'd MMM yyyy'); } catch (e) {}
  var sh = _ensureTeacherTabs_() && _ss_().getSheetByName(T_LINKS);
  sh.appendRow([c.card.type, c.card.name, c.card.grad, c.card.name, 'https://docs.google.com/spreadsheets/d/' + c.id + '/edit',
                'Added from 🔎 Check' + (when ? ', ' + when : ''), c.card.dash]);
  try { CacheService.getScriptCache().put('testids1', '', 1); } catch (e) {}
  var watch = '';
  if (c.verdict === 'shareddrive' && c.folder && c.folder.id) {        /* the teacher vouched for it: watch its folder */
    _setFindFolders_(_findFolders_().filter(function (x) { return x.id !== c.folder.id; }).concat([{ id: c.folder.id, name: c.folder.name }]));
    watch = ' From now on 🔎 Find also looks in “' + (c.folder.name || 'its folder') + '”.';
  }
  var d = teacherPanelData();
  d.check = { id: c.id, verdict: 'added', say: ['Added: “' + c.card.name + '”.' + watch] };
  return d;
}

/* "Let Find look in this folder": for a listed spreadsheet in a shared drive whose folder is not watched yet. */
function teacherWatchFolder(id) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  var c = _checkSpreadsheet_('https://docs.google.com/spreadsheets/d/' + String(id || '') + '/edit');
  if (c.watchable && c.watchable.id) {
    _setFindFolders_(_findFolders_().filter(function (x) { return x.id !== c.watchable.id; }).concat([c.watchable]));
    c = { id: c.id, verdict: 'watching', say: ['From now on 🔎 Find also looks in “' + (c.watchable.name || 'its folder') + '”.'] };
  }
  var d = teacherPanelData();
  d.check = c;
  return d;
}

/* ✕ beside a folder in the window: Find stops looking in it (links already added stay). */
function teacherUnwatchFolder(id) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  _setFindFolders_(_findFolders_().filter(function (x) { return x.id !== String(id); }));
  return teacherPanelData();
}

/* Menu: 🔎 Find new reflection and test spreadsheets — the same press, answered in a box. */
/* 🤝 Let the teachers on the list edit this spreadsheet (Daniel, 2 Oct 2026: "the Student data spreadsheet has no editor
   access for the teachers… every teacher that is already in the list, give them access").
   Who: the teachers of the "👩‍🏫 Teachers" tab (and the older TEACHERS line), by the rule _isTeacher_ uses: an address at
   the school's own domain, never under it, so a pupil's address typed there by mistake is never given the roster.
   What: each one who cannot edit yet is added as an editor, after ONE question that names them and says what an editor
   can do. Nobody is ever removed here. One address failing does not stop the others. From the menu only (the name ends
   in _, so no page can call it), and gated like the other menu items. */
function _teacherAccess_() {
  var ss = _ss_(), dom = _schoolDomain_(), have = {}, out = { can: [], cannot: [], skipped: [], known: true };
  try {
    ss.getEditors().forEach(function (u) { have[_cleanEmail_(u.getEmail())] = 1; });
    try { var ow = ss.getOwner(); if (ow) have[_cleanEmail_(ow.getEmail())] = 1; } catch (e) {}
  } catch (e) { out.known = false; }
  _teacherEmails_().forEach(function (e) {
    if (dom && e.split('@').pop() !== dom) out.skipped.push(e);
    else if (have[e]) out.can.push(e);
    else out.cannot.push(e);
  });
  return out;
}
function shareWithTeachersMENU_() {
  if (!_isAdminCaller_()) return;
  var ui = SpreadsheetApp.getUi(), ss = _ss_(), name = '', T = '🤝 Let the teachers edit this spreadsheet';
  try { name = ss.getName(); } catch (e) {}
  var a = _teacherAccess_();
  var skip = a.skipped.length ? '\n\nLeft out, because the address is not at the school’s own domain: ' + a.skipped.join(', ') + '.' : '';
  if (!a.known) { ui.alert(T, 'The list of people who can edit this spreadsheet could not be read, so nothing was changed. Only its owner, or an editor who may share it, can run this.', ui.ButtonSet.OK); return; }
  if (!a.can.length && !a.cannot.length) { ui.alert(T, 'There are no teachers on the list yet. Add them first: 🧪 Biology Labs ▸ 👥 Teacher page: teachers and addresses…' + skip, ui.ButtonSet.OK); return; }
  if (!a.cannot.length) { ui.alert(T, 'Nothing to do: ' + (a.can.length === 1 ? 'the 1 teacher on the list can' : 'all ' + a.can.length + ' teachers on the list can') + ' already edit this spreadsheet.' + skip, ui.ButtonSet.OK); return; }
  var ask = ui.alert(T, 'Give ' + (a.cannot.length === 1 ? 'this teacher' : 'these ' + a.cannot.length + ' teachers') + ' edit access to “' + (name || 'this spreadsheet') + '”?\n\n' + a.cannot.join('\n') +
    '\n\nAn editor can change any cell in it (the roster and the pupils’ lab results included), use the 🧪 Biology Labs menu, and open its script. Google may send each of them its usual “shared with you” email.' +
    (a.can.length ? '\n\nAlready able to edit: ' + a.can.length + '.' : '') + skip, ui.ButtonSet.YES_NO);
  if (ask !== ui.Button.YES) return;
  var done = [], failed = [];
  a.cannot.forEach(function (e) {
    try { ss.addEditor(e); done.push(e); }
    catch (err) { failed.push(e + ' (' + String((err && err.message) || err).slice(0, 80) + ')'); }
  });
  ui.alert(T, (done.length ? 'Done. ' + (done.length === 1 ? '1 teacher can' : done.length + ' teachers can') + ' now edit this spreadsheet:\n' + done.join('\n') : 'Nobody was added.') +
    (failed.length ? '\n\nCould not be added:\n' + failed.join('\n') + '\n\nShare the spreadsheet with them by hand: the Share button, top right.' : '') +
    '\n\nA teacher you add to the list later is not given access by itself: run this again.', ui.ButtonSet.OK);
}

function findSpreadsheetsMENU_() {
  if (!_isAdminCaller_()) return;
  var ui = SpreadsheetApp.getUi();
  ui.alert('🔎 Find new reflection and test spreadsheets', _findSummary_(_findAndAdd_()), ui.ButtonSet.OK);
}

/* Is this cell's text an address somebody typed, rather than a smart chip? A chip shows its file's
   own name ("T3T4: Test A", "Data: class results"), never anything shaped like an address. Tabs and
   line breaks inside it, and anything blank in front, are dropped first, because a browser drops
   them too: "java<tab>script:" is still javascript:. */
function _typedAddress_(v) {
  var s = String(v == null ? '' : v).replace(/[\t\n\r]+/g, '').replace(/^[\s\u0000-\u001f]+/, '').toLowerCase();
  return /^(javascript|vbscript|https?|ftp|file|mailto):/.test(s)
      || /^data:([a-z]+\/[\w.+-]+)?(;[^,]*)?,/.test(s)              /* data:text/html,… (it needs the comma) */
      || /^[a-z][a-z0-9+.-]*:\/\//.test(s)                          /* any other scheme:// */
      || /^(\/\/|www\.)/.test(s)                                    /* //host/… or www.… */
      || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?\//.test(s);  /* docs.google.com/… with no https:// */
}

/* The cohort a spreadsheet belongs to, named by the year it graduates — the stable handle, because
   a year group rolls forward every 1 August (this year's Y10 is next year's Y11). From the
   graduation year and today's date the CURRENT year group is worked out and shown alongside, so a
   teacher sees both "Class of 2028" and "Y10 this year", and it stays right on its own next year.
   The rule matches the school's: in 2026–27 Y10 graduates 2028, Y11 2027, Y9 2029 — so year group =
   12 − graduation + the year the current school year began (on 1 August). `now` is passed for testing. */
function _cohortLabel_(grad, now) {
  var m = String(grad == null ? '' : grad).match(/\d{4}/);
  if (!m) return null;
  var g = Number(m[0]);
  now = now || new Date();
  var startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;   /* Aug onward = new school year */
  var yg = 12 - g + startYear;
  return {
    grad: g,
    title: 'Class of ' + g,
    yearGroup: (yg >= 7 && yg <= 13) ? 'Y' + yg : '',
    academic: startYear + '–' + String(startYear + 1).slice(-2)
  };
}

/* Everything the page shows, organised. `records` (no graduation year, or Type "Records") are
   pinned at the top because they span every cohort. The rest are grouped by cohort — nearest to
   graduating first — and within a cohort by Type, so many spreadsheets stay easy to scan. Anything
   with no graduation year that is not a record falls into a plain "No graduation year" group at the
   end, so nothing is ever lost. */
function _teacherPageGroups_(now) {
  var scan = _teacherLinksScan_(), raw = scan.rows;
  var records = [], cohorts = {}, order = [], loose = [];
  raw.forEach(function (l) {
    var isRecord = /^records?$/i.test(l.type) || (!l.grad && /tracker|student data|record/i.test(l.assessment + ' ' + l.name));
    var co = _cohortLabel_(l.grad, now);
    var entry = { name: l.name, url: l.url, dash: l.dash, type: l.type, assessment: l.assessment,
                  detail: (l.assessment && l.assessment !== l.name ? l.assessment : '') + (l.note ? (l.assessment && l.assessment !== l.name ? ' · ' : '') + l.note : '') };
    if (isRecord) { records.push(entry); return; }
    if (!co) { loose.push(entry); return; }
    if (!cohorts[co.grad]) { cohorts[co.grad] = { grad: co.grad, title: co.title, yearGroup: co.yearGroup, academic: co.academic, byType: {}, typeOrder: [] }; order.push(co.grad); }
    var c = cohorts[co.grad];
    if (!c.byType[l.type]) { c.byType[l.type] = []; c.typeOrder.push(l.type); }
    c.byType[l.type].push(entry);
  });
  /* Y9 first, then Y10, then Y11 — which is the FURTHEST graduation year first, because a younger
     cohort graduates later. Daniel reads his lists bottom-up through the school. */
  order.sort(function (a, b) { return b - a; });
  /* the cohorts that are in school this year, so a teacher can read off "Y10 is Class of 2028" and,
     if they like, hide everyone who has left or is not here yet */
  var d = now || new Date();
  var startYear = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  var out = { unreadable: scan.unreadable, typed: scan.typed, chipsOn: scan.chipsOn, chipTrouble: scan.chipTrouble, records: records, cohorts: order.map(function (g) {
    var c = cohorts[g];
    c.current = !!c.yearGroup;                            /* a year group only comes out for Y7–Y13 */
    c.typeOrder.sort(function (a, b) { return _typeRank_(a) - _typeRank_(b) || (a < b ? -1 : 1); });
    c.types = c.typeOrder.map(function (t) { return { type: t, links: c.byType[t] }; });
    return c;
  }), loose: loose,
  thisYear: { academic: startYear + '–' + String(startYear + 1).slice(-2),
              list: [{ yg: 'Y9', grad: startYear + 3 }, { yg: 'Y10', grad: startYear + 2 }, { yg: 'Y11', grad: startYear + 1 }] } };
  return out;
}
/* the order types read in: reflections, then the test itself, then surveys, then anything else */
function _typeRank_(t) {
  t = String(t).toLowerCase();
  if (/reflect/.test(t)) return 0;
  if (/test|exam|paper/.test(t)) return 1;
  if (/survey|encuesta|form|quiz|poll/.test(t)) return 2;
  return 3;
}


/* ── Lab progress, for teachers ─────────────────────────────────────────────
   The Lab progress tab of the one teacher page (?page=progress opens on it). It reads the marks in THIS spreadsheet — every
   built lab's tab — and shows a class how it is doing: who has done what, where they are
   struggling, and how hard they are working at it. It reads only; it changes nothing.

   What each lab tab holds per student (LAB_COLS): a best Score / Out of, complete-or-progress,
   Checks (how many times they pressed Check — the effort), Right first time (knew it vs worked it
   out), Saves (how many times their work arrived), and Per station ("mouth 8/8 in 11 · …" — the
   score and checks at each part of the lab). That last one is what tells you WHICH topics a class
   finds hard, so it is parsed out here. */
function _parseStations_(str) {
  var out = [];
  String(str == null ? '' : str).split(' · ').forEach(function (p) {
    var m = String(p).match(/^(.*?)\s+(\d+)\/(\d+)(?:\s+in\s+(\d+))?$/);
    if (m) out.push({ name: m[1].trim(), done: +m[2], total: +m[3], checks: m[4] ? +m[4] : 0 });
  });
  return out;
}
/* Classes in YEAR order, not alphabetical order. Sorted as plain text, "10A" and "11A" both come
   before "9A" because "1" precedes "9" — so every dropdown in the estate listed Y10 and Y11 ahead
   of Y9. Compare the year group as a NUMBER first, then the letter after it. */
function _byClass_(a, b) {
  var ma = String(a == null ? '' : a).match(/\d+/), mb = String(b == null ? '' : b).match(/\d+/);
  var na = ma ? +ma[0] : 999, nb = mb ? +mb[0] : 999;
  return na - nb || String(a == null ? '' : a).localeCompare(String(b == null ? '' : b));
}
/* The cohort a class belongs to, from the year group in its name (10A → Y10 → Class of 2028 in
   2026–27). Same rule as the teacher page, so a class and its assessment spreadsheets line up. */
function _classCohort_(cls, now) {
  var m = String(cls || '').match(/\d+/);
  if (!m) return null;
  var yg = +m[0];
  if (yg < 7 || yg > 13) return null;
  var d = now || new Date();
  var startYear = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  var co = _cohortLabel_(startYear + (12 - yg), now);
  return co ? { grad: co.grad, title: co.title, yearGroup: co.yearGroup } : null;
}
function _labProgressData_(now) {
  var ss = _ss_();
  var labs = [];
  LABS.forEach(function (l) { if ((l.questions || 0) > 0 && ss.getSheetByName(l.name)) labs.push({ id: l.id, name: l.name, topic: l.topic, questions: l.questions }); });
  var byEmail = {}, students = [];
  var stu = ss.getSheetByName(T_STUDENTS);
  if (stu && stu.getLastRow() >= 2) {
    var ec = _emailCol_(stu), last = stu.getLastRow();
    stu.getRange(2, 1, last - 1, ec).getValues().forEach(function (r) {
      var email = _cleanEmail_(r[ec - 1]); if (!email) return;
      var cls = String(r[1] || '').trim().toUpperCase();
      if (_isLeftClass_(cls)) return;                 /* in none of the classes (7 Oct 2026): their marks stay on the lab tabs */
      var s = { name: String(r[0] || '').trim(), cls: cls, cohort: _classCohort_(cls, now), byLab: {} };
      byEmail[email] = s; students.push(s);
    });
  }
  /* The lab tabs record station IDS, so without this a teacher reads "ileum-villi" and
     "molecules-lab" instead of "Small intestine" and "Molecules and enzymes". Names come from the
     published manifest; with no manifest the page falls back to the ids rather than breaking.
     Its fingerprints (sigs) decide which stations' question letters are given (6 Oct 2026, below). */
  var man = _manifest_(), names = {}, sigs = {};
  if (man && man.labs) Object.keys(man.labs).forEach(function (k) {
    names[k] = {}; sigs[k] = {};
    (man.labs[k].stations || []).forEach(function (st) { names[k][st.id] = st.name; if (st.sig) sigs[k][st.id] = String(st.sig); });
  });
  labs.forEach(function (l) {
    var sh = ss.getSheetByName(l.name); if (!sh || sh.getLastRow() < 2) return;
    var n = sh.getLastRow() - 1;
    var v = sh.getRange(2, 1, n, Math.min(LAB_ROUNDS, sh.getMaxColumns())).getValues(), rok = _roundsColOk_(sh);
    for (var i = 0; i < n; i++) {
      var r = v[i], email = _cleanEmail_(r[LAB_EMAIL - 1]);
      if (!email || !byEmail[email]) continue;
      if (r[2] === '' || r[2] == null) continue;                 /* Score blank = nothing saved */
      var done = Number(r[2]) || 0, total = Number(r[3]) || l.questions || 0;
      var e = byEmail[email].byLab[l.id] = {
        done: done, total: total, pct: total ? Math.round(1000 * done / total) / 10 : 0,
        complete: String(r[5] || '') === 'complete',
        checks: Number(r[6]) || 0, firstTime: Number(r[7]) || 0, handIns: Number(r[9]) || 0,
        at: r[10] ? new Date(r[10]).toISOString() : null,
        stations: _parseStations_(r[13])
      };
      _questionLetters_(e, sigs[l.id], r[LAB_SNAP - 1], r[LAB_FIRST - 1], r[LAB_BEST - 1]);
      if (rok) _roundsForTeacher_(e, sigs[l.id], r[LAB_ROUNDS - 1]);
    }
  });
  var cset = {}; students.forEach(function (s) { if (s.cls) cset[s.cls] = 1; });
  return { generatedAt: new Date().toISOString(), labs: labs, students: students,
           classes: Object.keys(cset).sort(_byClass_), stationNames: names };
}

/* ── each question, as a square on the teacher page (6 Oct 2026, Daniel: "so that I know exactly where the students had
   to check multiple times") ──
   e.q[station] = the letters of their FIRST round (0 not tried · t tried, not right · 1 right after more checks · f right
   first time), the round "Right first time" counts; e.b[station] = the best ever, given only where it differs (right in
   a later round). Only for a station whose fingerprint in the sheet is the hub list's: a station rewritten since those
   letters were saved has other questions, so it gets no squares. A save from before rounds (Sept 2026) has no first
   round of its own: its letters are round 1 when they say so. */
function _questionLetters_(e, want, hereStr, firstStr, bestStr) {
  if (!want) return;
  var F = _snapParse_(firstStr), H = _snapParse_(hereStr), B = _snapParse_(bestStr), q = {}, b = {}, any = false, anyB = false;
  Object.keys(want).forEach(function (sid) {
    var sig = want[sid], n = parseInt(sig, 10) || 0;
    var f = F.by[sid], h = H.by[sid], bb = B.by[sid];
    var hq = h && h.sig === sig ? h.q : '';
    var first = f && f.sig === sig ? f.q : (h && h.sig === sig && h.go === 1 ? h.q : '');
    var best = _snapMax_(_snapMax_(bb && bb.sig === sig ? bb.q : '', hq), first);
    if (!first && !best) return;
    var fit = function (x) { x = String(x || ''); while (x.length < n) x += '0'; return x.slice(0, n); };
    q[sid] = fit(first); any = true;
    if (fit(best) !== q[sid]) { b[sid] = fit(best); anyB = true; }
  });
  if (any) e.q = q;
  if (anyB) e.b = b;
}

/* ── each round, for Lab progress (7 Oct 2026, Daniel: "a total checks per question, no matter the number of rounds,
   and per round … if they're failing the same questions despite the rounds") ──
   e.rd[station] = its rounds, oldest first and the round on the page last, as the Rounds column keeps them — only for a
   station whose fingerprint is the hub list's, as for e.q; e.rx[station] = its checks no question can be given (made
   before 7 Oct 2026, past 35, or on a version of the station rewritten since); e.rs = whole-lab resets; e.ag = how many
   stations they started again; e.c1 = their checks in ROUND 1 only — Stuck reads it, as practising again is not being
   stuck: every check of theirs (Checks) less the ones known to be in a later round, so a check the cell does not hold (a
   station with no letters, from before 27 Sep 2026) still counts, and never more than Checks (the second audit, 7 Oct
   2026: it was summed from the cell alone). */
function _roundsForTeacher_(e, want, cell) {
  var P = _rParse_(cell);
  if (!P.order.length && !P.resets) return;
  var S = _roundsSums_(P), rd = {}, rx = {}, inQ = Object.create(null), anyD = false, anyX = false, ag = Object.create(null), later = 0;
  P.order.forEach(function (key) {
    var v = P.by[key], mine = 0;
    if (v.list.length > 1) ag[v.id] = 1;
    v.list.forEach(function (x, j) { var c = _rSum_(_rTok_(x).c); mine += c; if (j) later += c; });
    if (!v.list.length || !want || want[v.id] !== v.sig) return;
    rd[v.id] = v.list.slice(); anyD = true;
    inQ[v.id] = mine;
  });
  Object.keys(S.by).forEach(function (id) { var x = S.by[id] - (inQ[id] || 0); if (x > 0) { rx[id] = x; anyX = true; } });
  if (anyD) e.rd = rd;
  if (anyX) e.rx = rx;
  if (P.resets) e.rs = P.resets;
  e.ag = Object.keys(ag).length;
  e.c1 = Math.max(0, (Number(e.checks) || 0) - later);
}

/* The words of each question in one lab, for those squares: from the lab's own published js/data/stations.js (the file
   pupils load; it holds no answers, only salted fingerprints), asked for only when a teacher opens a pupil's station
   or a lab's questions, and kept in the script cache under the lab's version.txt. A station's words are given only when
   its fingerprint, worked out here exactly as the lab's app.js does (_labSig_), is the hub list's: the same one the
   letters were checked against. */
function _labSig_(st) {
  var acts = (st && st.activities) || [];
  var body = acts.map(function (a) {
    var c = {};
    Object.keys(a).sort().forEach(function (k) { if (k !== 'k' && k !== 'anyOrder') c[k] = a[k]; });
    return JSON.stringify(c);
  }).join('|');
  var h = 0x811c9dc5;
  for (var i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  var sig = acts.length + ':' + h.toString(36);
  /* `keep` (7 Oct 2026), as in each lab's stationSig: a station reworded without changing what it asks keeps the
     fingerprint its records were saved under, while it reads exactly as declared */
  var kp = st && st.keep;
  return kp && kp.now === sig && typeof kp.sig === 'string' ? kp.sig : sig;
}
function _cutWords_(s, n) {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  var cut = s.slice(0, n), sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, '') + '\u2026';
}
function _labQuestions_(labId) {
  var lab = null;
  LABS.forEach(function (l) { if (l.id === labId) lab = l; });
  var site = String(_hubUrl_() || '').match(/^https:\/\/[^\/]+/);
  if (!lab || !site) return null;
  var base = site[0] + '/' + lab.id, cache = null, ver = '';
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  ver = cache ? (cache.get('LABV_' + lab.id) || '') : '';
  if (!ver) {
    try {
      var vr = UrlFetchApp.fetch(base + '/version.txt', { muteHttpExceptions: true, followRedirects: true });
      if (vr.getResponseCode() === 200) ver = String(vr.getContentText()).trim().slice(0, 20);
    } catch (e) {}
    if (cache && ver) { try { cache.put('LABV_' + lab.id, ver, 600); } catch (e) {} }
  }
  /* which stations get words depends on the hub's station list too (its stamp): a station opened between the labs' push
     and the hub's was cached without words for six hours (the audit, 7 Oct 2026) */
  var hubStamp = '';
  try { _manifest_(); hubStamp = cache ? (cache.get('HUB_STAMP') || '') : ''; } catch (e) { hubStamp = ''; }
  var KEY = 'LABQ_' + lab.id + '_' + (ver || 'none') + '_' + (hubStamp || 'h');
  if (cache && ver) { var hit = cache.get(KEY); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  var txt = '';
  try {
    var res = UrlFetchApp.fetch(base + '/js/data/stations.js' + (ver ? '?v=' + encodeURIComponent(ver) : ''), { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return null;
    txt = String(res.getContentText());
  } catch (e) { return null; }
  var a = txt.indexOf('window.STATIONS = '), z = a < 0 ? -1 : txt.indexOf('\n];', a);
  if (a < 0 || z < 0) return null;
  var S = null;
  try { S = JSON.parse(txt.slice(a + 'window.STATIONS = '.length, z + 2)); } catch (e) { return null; }
  var man = _manifest_(), want = {}, out = {};
  if (man && man.labs && man.labs[lab.id]) (man.labs[lab.id].stations || []).forEach(function (x) { want[x.id] = String(x.sig || ''); });
  (S || []).forEach(function (st) {
    if (!st || !st.id || !want[st.id] || want[st.id] !== _labSig_(st)) return;
    out[st.id] = (st.activities || []).map(function (q) { return _cutWords_(q.prompt || q.text || q.type, 170); });
  });
  if (cache && ver) { try { cache.put(KEY, JSON.stringify(out), 21600); } catch (e) {} }
  return out;
}

/* Every HTML page doGet serves goes out through here — the teacher page, and the page that says who it is
   for: its title, and the viewport tag (Apps Script ignores a page's own meta viewport, so without
   addMetaTag a phone shows the page zoomed out). */
function _htmlOut_(html, title) {
  return HtmlService.createHtmlOutput(html).setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function _studentDirectory_(now) {
  var ss = _ss_(), out = [];
  var stu = ss.getSheetByName(T_STUDENTS);
  if (stu && stu.getLastRow() >= 2) {
    var SC = _studentCols_(stu), ec = SC.email, last = stu.getLastRow();
    /* …and when each pupil was first imported (the import writes it two columns after the email), when the tab has it: the
       teacher's list says which pupils outside a homework came onto the tab after it was set (6 Oct 2026; _homeworkData_);
       and the teacher's accommodation (8 Oct 2026), for the Students view's switch */
    var width = Math.max(ec, Math.min(ec + 2, stu.getLastColumn()), SC.acc || 0);
    stu.getRange(2, 1, last - 1, width).getValues().forEach(function (r) {
      var email = _cleanEmail_(r[ec - 1]); if (!email) return;
      var cls = String(r[1] || '').trim().toUpperCase();
      var imp = width >= ec + 2 ? r[ec + 1] : '', since = (imp instanceof Date && !isNaN(imp.getTime())) ? imp.getTime() : 0;
      var row = { name: String(r[0] || '').trim(), cls: cls, email: email, cohort: _classCohort_(cls, now), since: since };
      if (SC.acc && _accOn_(r[SC.acc - 1])) row.acc = true;
      out.push(row);
    });
  }
  out.sort(function (a, b) { return _byClass_(a.cls, b.cls) || (a.name || '').localeCompare(b.name || ''); });
  /* pupils in none of the classes (LEFT …) stay on the list, for the Students view; never as a class (7 Oct 2026) */
  var cset = {}; out.forEach(function (s) { if (s.cls && !_isLeftClass_(s.cls)) cset[s.cls] = 1; });
  return { generatedAt: new Date().toISOString(), students: out, classes: Object.keys(cset).sort(_byClass_) };
}
/* ── Set homework, for teachers ─────────────────────────────────────────────
   The Set homework tab of the one teacher page (?page=homework opens on it). A teacher picks parts of labs — not whole labs —
   says who they are for and when they are due, and afterwards sees who has done them.

   WHY STATIONS RATHER THAN WHOLE LABS. The evidence on homework at secondary level is that SHORT,
   focused practice of something already taught is what works; quantity is not. A lab is 60–120
   questions, which is a fortnight's work, so setting one whole is the wrong unit. A station is 5–16
   questions, which is one evening. The picker therefore works in stations and shows the running
   question count, so the size of what is being set is visible before it is set.

   WHERE THE INFORMATION LIVES. One row per assignment in the "📚 Homework" tab — never one row per
   pupil, or a class of 25 across ten assignments would be 250 rows that immediately go stale.
   Completion is NEVER stored: it is recomputed from the lab tabs, which already hold every
   per-station score, each time the page or the summary asks. So the tab stays a summary a teacher
   can read by eye, and it can never disagree with the marks.

   THE ONE THING THIS CANNOT DO ALONE. The lab tabs record station IDS ("ileum-villi"), never names,
   and they only record a station a pupil actually reached. So the server cannot name a station, and
   cannot know how many questions a station a pupil skipped would have asked. Both come from the
   published station manifest (js/data/stations.json, built by tools/stations-manifest.mjs), fetched
   once and cached. Without it the page says so plainly rather than guessing. */

var T_HOMEWORK = '📚 Homework';
/* The reminder columns (1 Oct 2026) are at the END: Tidy up writes these headings by position and homeworkCreate appends
   a row by position, so a new column anywhere else would shift every column after it. */
var _HW_HEADERS_ = ['ID', 'Created', 'Teacher', 'Title', 'Who', 'What', 'Due', 'Spec', 'Course', 'CourseWork', 'Status', 'Reported', 'Group', 'Cohort',
                    'Remind', 'Reminder 1', 'Reminder 1 students', 'Reminder 2', 'Reminder 2 students',
                    'Starts',                  /* 2 Oct 2026: homework set for a later date; at the END, as the reminder columns are */
                    'Hidden'];                 /* 7 Oct 2026: hidden from the Set homework list (homeworkHide); at the END too */

function _hwColDefs_() {
  return [
    { h:'ID',         w:104, note:'The code for this homework. The page finds it by this, and a Bio English link in a Classroom post carries it. Do not change it.' },
    { h:'Created',    w:132, fmt:'dd MMM, HH:mm', note:'When it was set.' },
    { h:'Teacher',    w:210, note:'Who set it. The summary goes to them.' },
    { h:'Title',      w:230, edit:true, note:'What the students see.' },
    { h:'Who',        w:150, note:'The class it was set for, or how many students.' },
    { h:'What',       w:330, note:'The parts of the labs that were set. Written out so you can read this tab on its own.' },
    { h:'Due',        w:132, fmt:'dd MMM, HH:mm', edit:true, note:'When it is due. Change it here and the summary waits for the new date. Type a date: anything else counts as no date, and the page says so.' },
    { h:'Spec',       w:300, hide:true, note:'What the page reads: which labs and stations, and who for. Do not edit.' },
    { h:'Course',     w:150, hide:true, note:'The Google Classroom course, once it has been posted there.' },
    { h:'CourseWork', w:150, hide:true, note:'The Google Classroom assignment, once it has been posted there.' },
    { h:'Status',     w:100, align:'center', list:['set', 'reported'], note:'set — still waiting.\nreported — the summary has been emailed.' },
    { h:'Reported',   w:132, fmt:'dd MMM, HH:mm', note:'When the summary was emailed.' },
    { h:'Group',      w:110, hide:true, note:'The same code on several rows means they were set in one go — the same practice for more than one class, each with its own date.' },
    { h:'Cohort',     w:90, align:'center', fmt:'0', note:'The graduation year this was set for. Written once, so it still says who it belonged to long after they have left — so old homework can be tidied away safely later. Nothing removes a row on its own.' },
    { h:'Remind',     w:90, align:'center', edit:true, list:['on', 'off'], note:'on — the students who have not finished get two reminders in Google Classroom, which only they can see: when 70% and when 85% of the time from setting to due has passed (about 2 days and 1 day before a week’s homework). None between 22:00 and 07:00, none after the due time, and only for homework posted in Classroom.\noff (or empty) — no reminders.' },
    { h:'Reminder 1', w:132, fmt:'dd MMM, HH:mm', note:'When the first reminder went, or was tried or skipped. A reminder is never posted twice.' },
    { h:'Reminder 1 students', w:150, note:'How many students the first reminder went to (no names are kept), or why it was not posted.' },
    { h:'Reminder 2', w:132, fmt:'dd MMM, HH:mm', note:'When the second reminder went, or was tried or skipped.' },
    { h:'Reminder 2 students', w:150, note:'How many students the second reminder went to (no names are kept), or why it was not posted.' },
    { h:'Starts',     w:132, fmt:'dd MMM, HH:mm', note:'When the students get it, for homework set for a later date. Empty — they got it when it was set.\nBefore this time they see nothing: Google Classroom holds its post until then, and the labs do not show it. Do not change it here: the post in Google Classroom keeps the time it was given.' },
    { h:'Hidden',     w:132, fmt:'dd MMM, HH:mm', note:'When it was hidden from the Set homework list (its Archive, after the due date). Hidden homework still counts: it stays in ⏱️ Homework habits and in every student’s record, and students see it as before. Only a date here hides it. Empty — it is listed. Press “Show it again” on the list, or clear this cell, to list it again.' }
  ];
}
function _ensureHomeworkTab_() {
  var ss = _ss_(), sh = ss.getSheetByName(T_HOMEWORK);
  if (!sh) {
    sh = ss.insertSheet(T_HOMEWORK);
    sh.getRange(1, 1, 1, _HW_HEADERS_.length).setValues([_HW_HEADERS_]);
    _dress2_(sh, _hwColDefs_(), { tab:'#F59E0B' });
  }
  return sh;
}
/* A tab made before the reminder columns (1 Oct 2026) stops at Cohort, and Tidy up had cut its spare columns away, so a
   row of 19 values, or a reminder written in column 19, would fall outside the sheet. Widen it, and write each missing
   heading into its own EMPTY heading cell only (never over something typed there); the next Tidy up dresses them.
   One heading read; nothing moves. Called before every write that reaches the new columns. */
function _hwWiden_(sh) {
  var n = _HW_HEADERS_.length, defs = _hwColDefs_();
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
  var have = sh.getRange(1, 1, 1, n).getValues()[0]
               .map(function (x) { return String(x == null ? '' : x).replace(/^\u270e\s*/, '').trim(); });
  for (var i = 0; i < n; i++) {
    if (have.indexOf(_HW_HEADERS_[i]) >= 0 || have[i] !== '') continue;
    sh.getRange(1, i + 1).setValue((defs[i] && defs[i].edit ? '\u270e ' : '') + _HW_HEADERS_[i]);
  }
}

/* The hub's own address, kept the way the other addresses are. Only used to read the public
   station manifest — names and counts, nothing personal. */
function _hubUrl_() {
  var u = String(_keptSetting_(HUB_URL, 'HUB_URL') || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '';
}
function _manifest_() {
  var hub = _hubUrl_(); if (!hub) return null;
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  /* Key the cache on the site's own publish stamp. Publishing a rebuilt manifest changes the
     stamp, the key misses, and the new stations appear at once instead of up to six hours later —
     during which the page would have called a brand-new station "no longer in the lab". */
  var stamp = cache ? (cache.get('HUB_STAMP') || '') : '';
  if (!stamp) {
    try {
      var vr = UrlFetchApp.fetch(hub + '/version.txt', { muteHttpExceptions:true, followRedirects:true });
      if (vr.getResponseCode() === 200) stamp = String(vr.getContentText()).trim().slice(0, 20);
    } catch (e) {}
    if (cache && stamp) { try { cache.put('HUB_STAMP', stamp, 600); } catch (e) {} }
  }
  var KEY = 'STATIONS_MANIFEST_' + (stamp || 'none');
  if (cache) { var hit = cache.get(KEY); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  var txt = '';
  try {
    var res = UrlFetchApp.fetch(hub + '/js/data/stations.json', { muteHttpExceptions:true, followRedirects:true });
    if (res.getResponseCode() !== 200) return null;
    txt = res.getContentText();
  } catch (e) { return null; }
  var m = null; try { m = JSON.parse(txt); } catch (e) { return null; }
  if (!m || !m.labs) return null;
  if (cache) { try { cache.put(KEY, txt, 21600); } catch (e) {} }   /* six hours, the cache's maximum */
  return m;
}

/* Who is asking: the active user, if they are a teacher on the list, else ''. On the school-only deployment
   Google has already proved who they are, and google.script.run calls from the page arrive with the same
   active user. Every read and write the teacher page makes checks this (uiData, homeworkCreate, homeworkDelete,
   homeworkTopics, homeworkRemind, homeworkChangeDue, homeworkAddPupils, homeworkHide, studentMove, studentAccommodation). */
function _hwCaller_() {
  var email = '';
  try { email = _cleanEmail_(Session.getActiveUser().getEmail()); } catch (e) {}
  return email && _isTeacher_(email) ? email : '';
}

/* The school's clock. "Due the 25th" must mean the end of the 25th HERE — not in whatever zone the
   script project sits in, nor the teacher's browser. Before this, the page sent a naive
   "…T23:59:00", the server parsed it in the PROJECT's zone, and the browser rendered it back in its
   OWN: a date could show a day early or late and be called overdue on the wrong day. Now every
   decision about a due date is made in this one zone, and the page is sent the words and the
   verdict rather than a timestamp to re-interpret.
   Read ONCE per execution, like the handle it comes from (_ss_): ⏱️ Homework habits asked it about twice per
   pupil per homework, each a call to the spreadsheet (2 Oct 2026, Daniel: the teacher pages are slow to open).
   It is kept with the handle it was read from, so a new handle reads it again. */
var _TZ_MEMO = null;
function _tz_() {
  try {
    var ss = _ss_();
    if (_TZ_MEMO && _TZ_MEMO.ss === ss) return _TZ_MEMO.tz;
    var tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
    _TZ_MEMO = { ss: ss, tz: tz };
    return tz;
  }
  catch (e) { try { return Session.getScriptTimeZone(); } catch (e2) { return 'Etc/UTC'; } }
}
function _dueFrom_(v, t) {
  var d = String(v == null ? '' : v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  /* A time, when the teacher gave one (29 Sep 2026: "you cannot set the due time"), is that time on that day HERE.
     No time keeps the meaning it always had: the end of the day. */
  var hms = _hwTime_(t) || '23:59:59';
  try { return Utilities.parseDate(d + ' ' + hms, _tz_(), 'yyyy-MM-dd HH:mm:ss'); } catch (e) { return null; }
}
/* Homework set for a later date (Daniel, 2 Oct 2026: "when you set homework, you can schedule it for a specific date"):
   the start, a plain yyyy-mm-dd and a time when one was typed, read HERE as the due date is. No time = 08:00, the
   start of the school day (never the night: the reminders keep quiet from 22:00 to 07:00 for the same reason). */
var HW_START_TIME = '08:00:00';
function _startFrom_(v, t) {
  var d = String(v == null ? '' : v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  try { return Utilities.parseDate(d + ' ' + (_hwTime_(t) || HW_START_TIME), _tz_(), 'yyyy-MM-dd HH:mm:ss'); } catch (e) { return null; }
}
/* "8:05" or "08:05" (what a time box sends) as "08:05:00"; '' for anything else, blank included. */
function _hwTime_(t) {
  var m = String(t == null ? '' : t).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return '';
  return ('0' + m[1]).slice(-2) + ':' + m[2] + ':00';
}
/* A due date in words, in the school's zone: "3 Oct", or "3 Oct, 08:00" when a time was set. The end of the day
   (23:59, the meaning of a date with no time) is written as the day alone, as it always was. */
function _hwDueText_(ms) {
  var d = new Date(ms), tz = _tz_(), day = Utilities.formatDate(d, tz, 'd MMM'), hm = '';
  try { hm = String(Utilities.formatDate(d, tz, 'HH:mm')); } catch (e) { hm = ''; }
  return /^\d\d:\d\d$/.test(hm) && hm !== '23:59' ? day + ', ' + hm : day;
}
/* A cell's instant in ms, or 0 when it holds nothing that reads as a date. Due is the teacher's to edit in the tab,
   and text such as "next Friday" made new Date(…).toISOString() throw: one such cell broke the homework page, every
   rostered pupil's Bio English list and the morning email (labs-script-003, 30 Sep 2026). */
function _hwMs_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var t = 0;
  try { t = new Date(v).getTime(); } catch (e) { t = 0; }
  return (t && !isNaN(t)) ? t : 0;
}
function _hwIso_(v) { var t = _hwMs_(v); return t ? new Date(t).toISOString() : null; }
/* A real date in a cell (the sheet hands one back as a Date), never words or a number that new Date() would also read. */
function _hwIsDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
/* The cohort a piece of homework belongs to, decided when it is set and never recomputed: by the
   time it is old enough to tidy away, the pupils have left and the roster can no longer say. */
function _hwCohortOf_(cls, emails, roster, now) {
  if (cls) { var c = _classCohort_(cls, now); return c ? c.grad : ''; }
  var grads = {}, byEmail = {};
  roster.forEach(function (p) { byEmail[p.email] = p; });
  (emails || []).forEach(function (e) {
    var p = byEmail[e];
    if (p && p.cohort) grads[p.cohort.grad] = 1;
  });
  var ks = Object.keys(grads);
  return ks.length === 1 ? Number(ks[0]) : '';    /* mixed or unknown: left blank (nothing tidies old homework away yet) */
}
function _hwId_(taken) {
  var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';                  /* no I/O/0/1 — these get read aloud */
  var out = '';
  for (var t = 0; t < 40; t++) {
    out = 'HW-';
    for (var i = 0; i < 5; i++) out += s.charAt(Math.floor(Math.random() * s.length));
    if (!taken || !taken[out]) return out;                     /* five random letters collide eventually */
  }
  return out;
}

/* Every assignment, as objects. Read by header so a dressed "✎ Title" still matches. */
function _homeworkRows_() {
  var _nowMs_ = Date.now();
  var sh = _ensureHomeworkTab_();
  if (sh.getLastRow() < 2) return [];
  /* one header read, not one per column: _headerCol_ re-reads the whole row each time it is asked */
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
               .map(function (x) { return String(x == null ? '' : x).replace(/^\u270e\s*/, '').trim(); });
  var c = {}; _HW_HEADERS_.forEach(function (h, i) { var k = head.indexOf(h); c[h] = k >= 0 ? k + 1 : i + 1; });
  /* Hidden (7 Oct 2026) is read under its own heading only, never by position: on a tab from before it, that column may
     hold something a teacher typed, which must not hide homework */
  var hid = head.indexOf('Hidden');
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues(), out = [];
  for (var i = 0; i < v.length; i++) {
    var r = v[i], id = String(r[c.ID - 1] || '').trim();
    if (!id) continue;
    var hv = hid >= 0 && hid < r.length ? r[hid] : '';
    var spec = {};
    try { spec = JSON.parse(String(r[c.Spec - 1] || '{}')) || {}; } catch (e) { spec = {}; }
    var due = r[c.Due - 1], dms = _hwMs_(due);
    /* set for a later date (2 Oct 2026): `from` is when the students got or get it (the start, else when it was set),
       which the reminders and Homework habits count from; `waiting` while that moment has not come: no student sees it */
    var cms = _hwMs_(r[c.Created - 1]), sms = c.Starts <= r.length ? _hwMs_(r[c.Starts - 1]) : 0;
    out.push({
      start: sms ? new Date(sms).toISOString() : null,
      startText: sms ? _hwWhen_(sms) : '',
      waiting: !!sms && sms > _nowMs_,
      from: (sms || cms) ? new Date(sms || cms).toISOString() : null,
      row: i + 2, id: id,
      group: String(r[c.Group - 1] || '').trim(),
      cohort: Number(r[c.Cohort - 1]) || '',
      setFor: spec.setFor || null,
      inCourse: Array.isArray(spec.inCourse) ? spec.inCourse : null,   /* who was in its Classroom course that day (6 Oct 2026) */
      created: _hwIso_(r[c.Created - 1]),
      teacher: _cleanEmail_(r[c.Teacher - 1]),
      title: String(r[c.Title - 1] || '').trim(),
      who: String(r[c.Who - 1] || '').trim(),
      what: String(r[c.What - 1] || '').trim(),
      due: dms ? new Date(dms).toISOString() : null,
      /* something typed in Due that is not a date: no date at all (never overdue, never emailed), and the page says so */
      dueBad: !dms && String(due == null ? '' : due).trim() !== '',
      /* worded and judged here, in the school's zone, so the browser never re-reads a timestamp */
      dueText: dms ? _hwDueText_(dms) : '',
      overdue: !!dms && dms < _nowMs_,
      soon: !!dms && dms >= _nowMs_ && (dms - _nowMs_) < 3 * 24 * 3600 * 1000,
      targets: spec.targets || {}, tasks: spec.tasks || [],
      course: String(r[c.Course - 1] || '').trim(),
      courseWork: String(r[c.CourseWork - 1] || '').trim(),
      status: String(r[c.Status - 1] || 'set').trim(),
      reported: _hwIso_(r[c.Reported - 1]),
      /* the reminders (1 Oct 2026): the switch, and what became of each one. Empty is off, so homework set before the
         reminders existed never starts posting on its own. */
      remindOn: String(r[c.Remind - 1] == null ? '' : r[c.Remind - 1]).trim().toLowerCase() === 'on',
      rem: [1, 2].map(function (k) {
        var said = r[c['Reminder ' + k + ' students'] - 1];
        return { at: _hwIso_(r[c['Reminder ' + k] - 1]), said: (said === '' || said == null) ? '' : String(said).trim() };
      }),
      /* hidden from the Set homework list (7 Oct 2026). Only that list reads it: everything else (the students' own list,
         ⏱️ Homework habits, the summary, the reminders) counts hidden homework as before. Only a date hides it, as
         homeworkHide writes one: words typed into that column (a tab from before it, tidied) never hide anything, so
         "Show it again", which empties the cell, is never offered for them. */
      hidden: _hwIsDate_(hv),
      hiddenAt: _hwIsDate_(hv) ? new Date(hv.getTime()).toISOString() : null
    });
  }
  return out;
}

/* Which pupils an assignment is for.
   Homework belongs to the pupils who were in the room the day it was set, wherever they go after (Daniel, 6 Oct 2026: a
   pupil who did it badly in class A and moves to class B keeps that result; "everything is ported"). They are `setFor`,
   the class on the Students tab that day, and, since 6 Oct 2026, `inCourse`: who was in its Google Classroom course that
   day, so a pupil the Students tab did not have yet (an import that stopped part way: Daniel's 11C) is in it once
   imported. A pupil who joins the class later, or moves into it, is NOT in it: "any previous homework should not be
   accounted for" (Daniel, 6 Oct 2026); only homework set after they came. The teacher can still count a pupil in
   (homeworkAddPupils) when they were in the class that day all along. Homework set for chosen pupils never gains anybody.
   Older rows, written before `setFor` was recorded, fall back to the live class. */
function _hwPupils_(hw, roster) {
  var want = {}, byEmail = {};
  roster.forEach(function (p) { byEmail[p.email] = p; });
  if (hw.setFor) {                      /* empty means nobody, not "work it out again" */
    var kept = [], seen = {};
    hw.setFor.forEach(function (e) { if (byEmail[e] && !seen[e]) { seen[e] = 1; kept.push(byEmail[e]); } });
    /* in its Classroom course that day AND in its class now: a pupil the Students tab puts in another class (moved, a course
       split into two classes, a TEST account in the course) is not taken in by the course (the audit, 7 Oct 2026) */
    var hcls = String((hw.targets && hw.targets.cls) || '').trim().toUpperCase();
    (hw.inCourse || []).forEach(function (e) { if (byEmail[e] && !seen[e] && hcls && byEmail[e].cls === hcls) { seen[e] = 1; kept.push(byEmail[e]); } });
    return kept.sort(function (a, b) {
      return _byClass_(a.cls, b.cls) || (a.name || '').localeCompare(b.name || '');
    });
  }
  (hw.targets.emails || []).forEach(function (e) { e = _cleanEmail_(e); if (byEmail[e]) want[e] = 1; });
  var cls = String(hw.targets.cls || '').trim().toUpperCase();
  if (cls) roster.forEach(function (p) { if (p.cls === cls) want[p.email] = 1; });
  return Object.keys(want).map(function (e) { return byEmail[e]; })
    .sort(function (a, b) { return _byClass_(a.cls, b.cls) || (a.name || '').localeCompare(b.name || ''); });
}

/* Read each lab tab ONCE, however many assignments reference it. Keyed by pupil email. */
function _hwLabIndex_(labIds, need) {
  var ss = _ss_(), out = {};
  labIds.forEach(function (id) {
    if (id in out) return;
    if (id === ENGLISH_ID) { out[id] = _englishIndex_(need); return; }
    if (id === WRITEUP_ID) { out[id] = _writeupIndex_(need); return; }
    var lab = null;
    LABS.forEach(function (l) { if (l.id === id) lab = l; });
    var sh = lab ? ss.getSheetByName(lab.name) : null;
    /* null = the lab or its tab has gone; {} = it is there and nobody has saved anything. The two must
       not look the same, or a vanished lab would score every pupil nought as though they idled. */
    if (!sh) { out[id] = null; return; }
    if (sh.getLastRow() < 2) { out[id] = {}; return; }
    var n = sh.getLastRow() - 1, map = {};
    var v = sh.getRange(2, 1, n, LAB_EMAIL).getValues();
    for (var i = 0; i < n; i++) {
      var r = v[i], em = _cleanEmail_(r[LAB_EMAIL - 1]);
      if (!em) continue;
      /* Only the pupils some homework actually names. Parsing every station string on a tab that
         has years of leavers on it is what would reach the six-minute limit first. */
      if (need && !need[em]) continue;
      /* _parseStations_ calls the first field "name", but the lab writes station IDS there. */
      var byId = {};
      _parseStations_(r[13]).forEach(function (s) { byId[s.name] = s; });
      map[em] = { byId: byId, at: r[10] ? new Date(r[10]).getTime() : 0 };
    }
    out[id] = map;
  });
  return out;
}

/* One pupil, one assignment. The denominator comes from the MANIFEST, never from the pupil's own
   row: a station they never opened does not appear there at all, and would otherwise silently
   vanish instead of counting as nothing done. A station the lab no longer has is named, not
   scored — quietly counting it zero would accuse a pupil who did the work. */
function _hwScoreOne_(hw, email, index, man) {
  var done = 0, total = 0, missing = [], last = 0;
  hw.tasks.forEach(function (t) {
    var lm = man && man.labs ? man.labs[t.labId] : null;
    var known = {};
    if (lm) (lm.stations || []).forEach(function (s) { known[s.id] = s; });
    var idx = index[t.labId];
    if (idx === null || idx === undefined) {
      /* the lab's tab is gone: name what cannot be marked instead of scoring it nought */
      (t.stationIds || []).forEach(function (sid) { if (missing.indexOf(sid) < 0) missing.push(sid); });
      return;
    }
    var rec = idx[email] || null;
    if (rec && rec.at > last) last = rec.at;
    (t.stationIds || []).forEach(function (sid) {
      var k = known[sid];
      if (!k) { if (missing.indexOf(sid) < 0) missing.push(sid); return; }
      total += k.questions;
      var got = rec ? rec.byId[sid] : null;
      if (got) done += Math.min(got.done, k.questions);
    });
  });
  return {
    done: done, total: total,
    pct: total ? Math.round(1000 * done / total) / 10 : 0,
    state: (total && done >= total) ? 'done' : (done > 0 ? 'partly' : 'none'),
    missing: missing,
    last: last ? new Date(last).toISOString() : null
  };
}

/* The page's whole payload: what can be set, what has been set, and how it is going. */
/* `who` (2 Oct 2026, Daniel: a colleague signed in saw the homework of every teacher, "that makes no sense"): the
   teacher the list is for. They get the homework THEY set, and nobody else's is read or scored for them. The owner
   gets every row, each marked `mine`, because only the owner can remove a colleague's homework: the page shows the
   owner their own and offers "All teachers". No `who` (the morning email, which writes to each homework's own
   teacher): every row, as before. */
function _homeworkData_(now, who) {
  var man = _hwManifest_();
  var dir = _studentDirectory_(now);
  var roster = dir.students;
  var list = _homeworkRows_(), nowMs = Date.now(), anyRemind = false;
  var seesAll = !who || who === _owner_();
  if (!seesAll) list = list.filter(function (hw) { return hw.teacher === who; });

  var ids = [];
  list.forEach(function (hw) { hw.tasks.forEach(function (t) { if (ids.indexOf(t.labId) < 0) ids.push(t.labId); }); });
  /* work out who is involved first: it lets the lab read skip everyone else */
  var pupilsFor = {}, need = {};
  list.forEach(function (hw) {
    var ps = _hwPupils_(hw, roster);
    pupilsFor[hw.id] = ps;
    ps.forEach(function (p) { need[p.email] = 1; });
  });
  var index = _hwLabIndex_(ids, need);

  var out = list.map(function (hw) {
    var pupils = pupilsFor[hw.id] || [];
    /* one pass: scoring twice per pupil per assignment was the whole cost of this page */
    var tally = { done:0, partly:0, none:0 }, miss = {};
    var rows = pupils.map(function (p) {
      var s = _hwScoreOne_(hw, p.email, index, man);
      tally[s.state]++;
      s.missing.forEach(function (m) { miss[m] = 1; });
      return { name: p.name, cls: p.cls, done: s.done, total: s.total, pct: s.pct, state: s.state, last: s.last };
    });
    /* what has changed under this assignment since it was set: who it was set for and is no longer on the Students tab, and
       who is in its class now but not in it (they joined or moved in after it was set, so it never counts against them;
       `late`: they came onto the Students tab after it was set, as the 11C pupils of an import that stopped part way did,
       whom the teacher can count in: homeworkAddPupils) */
    var setCount = (hw.setFor && hw.setFor.length) || pupils.length;
    var onRoster = {}; roster.forEach(function (p) { onRoster[p.email] = 1; });
    var gone = hw.setFor ? hw.setFor.filter(function (e) { return !onRoster[e]; }).length : 0;
    var outside = [], tcls = String((hw.targets || {}).cls || '').trim().toUpperCase();
    if (hw.setFor && tcls) {
      var inIt = {}, setMs = _hwMs_(hw.created);
      pupils.forEach(function (p) { inIt[p.email] = 1; });
      roster.forEach(function (p) {
        if (p.cls === tcls && !inIt[p.email]) outside.push({ name: p.name, email: p.email, late: !!(p.since && setMs && p.since >= setMs) });
      });
    }
    return {
      id: hw.id, group: hw.group, title: hw.title, who: hw.who, what: hw.what, teacher: hw.teacher,
      mine: !!who && hw.teacher === who,
      setCount: setCount, gone: gone, cohort: hw.cohort || '', outside: outside,
      created: hw.created, due: hw.due, status: hw.status, reported: hw.reported,
      /* worded and judged by _homeworkRows_ in the school's zone; without them the list showed "— due" (labs-script-001) */
      dueText: hw.dueText, overdue: hw.overdue, soon: hw.soon, dueBad: hw.dueBad,
      /* the due as the page's date and time boxes want it, in the school's zone: Change the due date starts from it */
      dueDay: hw.due ? Utilities.formatDate(new Date(hw.due), _tz_(), 'yyyy-MM-dd') : '',
      dueHm: hw.due ? Utilities.formatDate(new Date(hw.due), _tz_(), 'HH:mm') : '',
      inClassroom: !!(hw.course && hw.courseWork),
      /* set for a later date (2 Oct 2026): when it starts, in words, and whether the students are still waiting for it */
      start: hw.start, startText: hw.startText, waiting: hw.waiting,
      tasks: hw.tasks, targets: hw.targets,
      pupils: rows, tally: tally, missing: Object.keys(miss),
      /* the reminders, worded here in the school's zone (1 Oct 2026) */
      remind: _hwRemindSays_(hw, nowMs),
      /* hidden from this list (7 Oct 2026): the page keeps it at the end of the Archive, where it can be shown again */
      hidden: !!hw.hidden, hiddenText: hw.hiddenAt ? _hwWhen_(_hwMs_(hw.hiddenAt)) : ''
    };
  });
  list.forEach(function (hw) { if (hw.remindOn && hw.course && hw.courseWork && _hwMs_(hw.due) > nowMs) anyRemind = true; });

  /* only labs that are live AND in the manifest can be set */
  var labs = [];
  if (man && man.labs) {
    LABS.forEach(function (l) {
      var m = man.labs[l.id];
      if (!m || !(l.questions > 0)) return;
      labs.push({ id: l.id, name: l.name, topic: l.topic, questions: m.questions, stations: m.stations });
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    /* who can be picked: a pupil in none of the classes (LEFT …) cannot; homework set while they were here keeps them */
    labs: labs, students: roster.filter(function (p) { return !_isLeftClass_(p.cls); }), classes: dir.classes,
    homework: out,
    /* 'mine': only this teacher's homework is in the list; 'all': every teacher's (the owner), each marked `mine` */
    whose: !who ? '' : (seesAll ? 'all' : 'mine'),
    manifestOk: !!man.labsOk, hubSet: !!_hubUrl_(),
    english: man.en ? { years: man.en.years || [], units: man.en.units || {}, sets: man.en.sets || [] } : null,
    /* the Write-Up Lab's parts, in the order of a report (3 Oct 2026): what a teacher ticks in Set homework */
    writeup: man.wu ? { stages: man.wu.stages || [], parts: (man.wu.parts || []).map(function (p) {
      return { id: p.id, title: p.title, stage: p.stage, levels: p.levels, units: p.units, questions: p.questions,
               marks: (p.redpens || []).reduce(function (a, y) { return a + (Number(y.n) || 0); }, 0) }; }) } : null,
    classroomOk: typeof Classroom !== 'undefined' && !!Classroom && !!Classroom.Courses,
    /* false: some homework wants reminders and Google has not been allowed to post Classroom announcements */
    remindAllowed: anyRemind ? _hwAnnounceAllowed_() : null
  };
}

/* ---- the two writes, both gated ---- */
/* Set the same practice for several classes at once, each with ITS OWN due date — the common
   case when the same lesson lands on different days. It writes ONE ROW PER CLASS rather than one
   clever row, because that is also the shape Google Classroom needs: a piece of coursework belongs
   to exactly one course, so three classes is three posts however it is stored. The rows share a
   Group code, so the 📚 Homework tab shows they were set in one go (the page lists each class on its own). */
function homeworkCreate(d) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  d = d || {};
  var title = String(d.title || '').trim();
  if (!title) return { ok:false, why:'Give it a title.' };
  if (title.length > 120) title = title.slice(0, 120);

  var tasks = [];
  (d.tasks || []).forEach(function (t) {
    var labId = String(t.labId || '').trim();
    var sids = (t.stationIds || []).map(function (x) { return String(x || '').trim(); }).filter(function (x) { return !!x; });
    if (labId && sids.length) tasks.push({ labId: labId, stationIds: sids });
  });
  if (!tasks.length) return { ok:false, why:'Pick at least one part of a lab.' };

  /* one entry per class. The older single-class shape still works. */
  var want = d.classes && d.classes.length ? d.classes
           : [{ cls: (d.targets && d.targets.cls) || '', due: d.due, emails: (d.targets && d.targets.emails) || [] }];
  var jobs = [];
  for (var i = 0; i < want.length; i++) {
    var w = want[i] || {};
    var cls = String(w.cls || '').trim().toUpperCase();
    var emails = (w.emails || []).map(_cleanEmail_).filter(function (e) { return !!e; });
    if (!cls && !emails.length) return { ok:false, why:'Choose a class, or some students.' };
    if (_isLeftClass_(cls)) return { ok:false, why:cls + ' is not a class: its pupils are in none of your classes.' };
    /* the time is optional and comes on its own (a page from before sends none): no time = the end of that day */
    var time = String(w.time == null ? '' : w.time).trim();
    if (time && !_hwTime_(time)) return { ok:false, why: (cls ? cls + ': the' : 'The') + ' due time is not a time. Type it as hh:mm, or leave it empty.' };
    var due = null;
    if (w.due) due = _dueFrom_(w.due, time);    /* a plain yyyy-mm-dd, read in the school's zone */
    if (!due) return { ok:false, why: cls ? ('Give ' + cls + ' a due date.') : 'Give it a due date.' };
    /* a later start (2 Oct 2026): optional, per class. A start time needs its date; the start must still be to come, and
       before the due time. Refused in words rather than quietly set at once: a homework that pupils get NOW by mistake
       cannot be taken back. */
    var st = String(w.start == null ? '' : w.start).trim(), stt = String(w.startTime == null ? '' : w.startTime).trim(), start = null;
    var whoSays = cls ? cls + ': ' : '';
    if (stt && !_hwTime_(stt)) return { ok:false, why: whoSays + 'the start time is not a time. Type it as hh:mm, or leave it empty.' };
    if (stt && !st) return { ok:false, why: whoSays + 'a start time needs a start date. Give the date, or clear the start time.' };
    if (st) {
      start = _startFrom_(st, stt);
      if (!start) return { ok:false, why: whoSays + 'the start date cannot be read.' };
      if (start.getTime() <= Date.now()) return { ok:false, why: whoSays + 'the start (' + _hwWhen_(start.getTime()) + ') has passed. Choose a later time, or leave the start empty to set it now.' };
      if (start.getTime() >= due.getTime()) return { ok:false, why: whoSays + 'it must start before it is due (' + _hwWhen_(due.getTime()) + ').' };
    }
    jobs.push({ cls: cls, emails: emails, due: due, topic: w.topic, start: start });
  }
  /* the Classroom topic the post goes under: an existing one of the course's, or a new name, made there (_hwTopicId_).
     Since 2 Oct 2026 each class may bring its own (Daniel: "what happens if different classes have different section
     names?" — one name for all made a NEW topic of that name in every class that did not have it). A class that brings
     none (a page from before, or one class) takes the homework's one topic. */
  var cleanTopic = function (x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, 100); };
  var topic = cleanTopic(d.topic);
  jobs.forEach(function (job) { job.topic = job.topic === undefined || job.topic === null ? topic : cleanTopic(job.topic); });
  /* reminders to the pupils who have not finished (1 Oct 2026): only with the Classroom post, and only when the page asks
     (a page from before sends nothing, so nothing is posted to pupils that the teacher did not choose) */
  var remind = d.remind === true && !!d.post;

  /* readable columns, so the tab means something opened on its own */
  var man = _hwManifest_();
  var whatBits = tasks.map(function (t) {
    var lm = man && man.labs ? man.labs[t.labId] : null;
    var nameOf = {};
    if (lm) (lm.stations || []).forEach(function (x) { nameOf[x.id] = x.name; });
    return (lm ? lm.name : t.labId) + ': ' + t.stationIds.map(function (x) { return nameOf[x] || x; }).join(', ');
  });
  var what = whatBits.join(' · ');
  var group = jobs.length > 1 ? _hwId_().replace('HW-', 'G-') : '';
  /* Resolve the pupils NOW and remember them. Homework belongs to the pupils who were in the room
     that day: re-deriving it from the class later would drag a pupil who has since moved 9A -> 10C
     into every 10C assignment ever set, and mark them "not started" for work nobody gave them.
     The cohort (graduation year) is stable across that move, which is what makes it safe to keep. */
  var roster = _studentDirectory_().students;
  jobs.forEach(function (job) {
    var all = _hwPupils_({ targets: { cls: job.cls, emails: job.emails }, setFor: null }, roster);
    var ps = all.filter(function (p) { return !_isLeftClass_(p.cls); });     /* in none of the classes (7 Oct 2026) */
    job.leftOnly = all.length > 0 && !ps.length;
    job.setFor = ps.map(function (p) { return p.email; });
    job.cohort = _hwCohortOf_(job.cls, job.setFor, roster);
  });
  /* homework for nobody because every pupil chosen is in none of the classes now (a page from before still showed them) is
     refused (the audit, 7 Oct 2026); a class with nobody on the Students tab yet may still be set, as before */
  var nobody = jobs.filter(function (job) { return job.leftOnly; })[0];
  if (nobody) return { ok:false, why:(nobody.cls ? nobody.cls + ': nobody' : 'Nobody') + ' to set it for: the pupils chosen are in none of your classes now. Reload the page and choose again.' };
  /* …and who is in each class's Google Classroom course at this moment (6 Oct 2026, Daniel's 11C: an import that stopped
     part way left 8 of 16 off the Students tab; they were in the class, and in Classroom, the day the homework was set).
     The course is the one most of the class were imported from. Read outside the lock; any failure only leaves it out. */
  var classroomOn = typeof Classroom !== 'undefined' && !!Classroom && !!Classroom.Courses, idsNow = null, rosMemo = {}, leftNow = {};
  roster.forEach(function (p) { if (_isLeftClass_(p.cls)) leftNow[p.email] = 1; });
  jobs.forEach(function (job) {
    job.inCourse = null;
    if (!job.cls || !classroomOn) return;
    try {
      idsNow = idsNow || _classroomIds_();
      var tally = {};
      job.setFor.forEach(function (e) { var c = idsNow[e] && idsNow[e].courseId; if (c) tally[c] = (tally[c] || 0) + 1; });
      var cids = Object.keys(tally);
      if (!cids.length) return;
      var ros = _courseRoster_(cids.sort(function (a, b) { return tally[b] - tally[a]; })[0], rosMemo);
      if (ros) job.inCourse = Object.keys(ros).filter(function (e) { return !leftNow[e]; }).sort();   /* never a pupil marked LEFT */
    } catch (e) { job.inCourse = null; }
  });

  var made = [];
  var lock = null;
  /* bail rather than carry on unlocked: catching the timeout and continuing would leave two
     teachers appending at once while each believed it held the sheet */
  try { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  catch (e) { return { ok:false, why:'Somebody else is setting homework just now — try again in a moment.' }; }
  try {
    var sh = _ensureHomeworkTab_();
    _hwWiden_(sh);                                            /* a tab from before the reminder columns */
    var taken = {}; _homeworkRows_().forEach(function (r) { taken[r.id] = 1; });
    for (var j = 0; j < jobs.length; j++) {
      var job = jobs[j], id = _hwId_(taken); taken[id] = 1;
      var whoTxt = job.cls ? job.cls : (job.emails.length + ' student' + (job.emails.length === 1 ? '' : 's'));
      sh.appendRow([
        id, new Date(), who, _plain_(title), _plain_(whoTxt), _plain_(what), job.due,
        JSON.stringify({ targets: { cls: job.cls || undefined, emails: job.emails.length ? job.emails : undefined },
                         setFor: job.setFor, tasks: tasks, inCourse: job.inCourse || undefined }),
        '', '', 'set', '', group, job.cohort || '',
        remind ? 'on' : 'off', '', '', '', '',
        job.start || ''
      ]);
      made.push(id);
      _dressRows_(sh, _hwColDefs_(), sh.getLastRow(), 1);   /* so a row set between tidy-ups still reads properly */
    }
  } catch (err) {
    return { ok:false, why:'Could not save it: ' + err };
  } finally { if (lock) { try { lock.releaseLock(); } catch (e) {} } }
  /* Posted only once the rows are safely written and the lock is let go: Classroom can take
     seconds per class, and pupils saving their work must not queue behind it. The ids come back
     under the lock again, each row found by its homework id — never by a row number read earlier. */
  var posted = [], notPosted = [], topicMissed = [], topicsUsed = [], remindOk = false, inClassroom = {};
  if (d.post && made.length) {
    var cids = _classroomIds_(), res = [];
    jobs.forEach(function (job, j) {
      var p = _hwPost_(made[j], title, what, tasks, job, cids, { man: man, topic: job.topic });
      res.push(p);
      var whoP = job.cls || (job.setFor.length + ' student' + (job.setFor.length === 1 ? '' : 's'));
      if (p.ok && !job.start) posted.push(whoP);
      if (p.ok) inClassroom[j] = true;
      if (!p.ok) notPosted.push((job.cls || 'the students') + ': ' + p.why);
      /* posted, but not under the topic: said, never a failure (29 Sep 2026) */
      if (p.ok && job.topic && !p.topic) topicMissed.push((job.cls || 'the students') + ': ' + (p.topicWhy || 'the topic could not be used'));
      if (p.ok && p.topic) topicsUsed.push({ cls: job.cls || '', name: p.topic, made: !!p.topicMade });
    });
    if (res.some(function (p) { return p.ok; })) {
      var lk = null;
      try {
        lk = LockService.getScriptLock(); lk.waitLock(20000);
        var hs = _ensureHomeworkTab_(), hc = _hwHeadCols_(hs), rowOf = {};
        _homeworkRows_().forEach(function (r) { rowOf[r.id] = r.row; });
        res.forEach(function (p, j) {
          if (!p.ok || !rowOf[made[j]]) return;
          hs.getRange(rowOf[made[j]], hc.Course).setValue(p.courseId);
          hs.getRange(rowOf[made[j]], hc.CourseWork).setValue(p.courseWorkId);
        });
        /* the 15-minute check starts by itself, once, under the same lock (two teachers at once make one trigger) */
        if (remind) remindOk = _hwReminderTrigger_();
      } catch (e) {
      } finally { if (lk) { try { lk.releaseLock(); } catch (e) {} } }
    }
  }
  /* `topic`: the one name when every post went under the same one (as before); `topics`: each class's own, and whether
     it was made new there, for the page to say */
  var oneTopic = topicsUsed.length && topicsUsed.every(function (t) { return t.name.toLowerCase() === topicsUsed[0].name.toLowerCase(); }) ? topicsUsed[0].name : '';
  /* `later`: the classes that get it on a later date, in words, and whether Google Classroom holds a post for them
     (`posted` names only the classes whose post is out now) */
  var later = [];
  jobs.forEach(function (job, j) {
    if (job.start) later.push({ who: job.cls || (job.setFor.length + ' student' + (job.setFor.length === 1 ? '' : 's')), when: _hwWhen_(job.start.getTime()), classroom: !!inClassroom[j] });
  });
  var anyPost = posted.length || later.some(function (x) { return x.classroom; });
  return { ok:true, made: made, group: group, posted: posted, later: later, notPosted: notPosted, topic: oneTopic || (topicsUsed.length ? '' : topic), topics: topicsUsed, topicMissed: topicMissed,
           remind: !remind ? 'off' : (anyPost ? 'on' : 'no post'),
           remindWhy: remind && anyPost && !remindOk ? 'The reminders could not be started: 🧪 Biology Labs ▸ 🩺 Check the set-up says why.' : '',
           data:_homeworkData_(undefined, who) };
}

function homeworkDelete(id) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  id = String(id || '').trim();
  var lock = null;
  try { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  catch (e) { return { ok:false, why:'Somebody else is changing the homework just now — try again in a moment.' }; }
  try {
    /* Find the row INSIDE the lock. A row number read before it can already have shifted up
       because somebody else deleted above it — and then deleteRow takes a stranger's row while
       the ownership check below, testing the stale read, happily says yes. */
    var sh = _ensureHomeworkTab_(), rows = _homeworkRows_(), hit = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i].id === id) { hit = rows[i]; break; } }
    if (!hit) return { ok:false, why:'That homework is not there any more.' };
    /* a teacher may remove their own; the owner may remove anybody's */
    if (hit.teacher && hit.teacher !== who && who !== _owner_()) {
      return { ok:false, why:'That was set by ' + hit.teacher + '. Only they (or the owner) can remove it.' };
    }
    sh.deleteRow(hit.row);
  } catch (e) {
    return { ok:false, why:'Could not remove it.' };
  } finally { if (lock) { try { lock.releaseLock(); } catch (e) {} } }
  /* Removed before its start (2 Oct 2026): the post Google Classroom is holding must not come out later for homework that
     is no longer set. Outside the lock (Classroom can take seconds). A post already out is left, as before: students
     have seen it. If the held post cannot be removed, the page says so, and the teacher removes it in Classroom. */
  var note = '';
  if (hit.waiting && hit.course && hit.courseWork) {
    try { _needClassroom_(); Classroom.Courses.CourseWork.remove(hit.course, hit.courseWork); }
    catch (e) { note = 'Removed here. Its post in Google Classroom, set for ' + hit.startText + ', could not be removed: open Classroom ▸ Classwork and delete the scheduled post “' + hit.title + '” by hand.'; }
  }
  return { ok:true, note: note, data:_homeworkData_(undefined, who) };
}

/* Hide homework from the Set homework list, or list it again (Daniel, 7 Oct 2026: "deleting a homework should just hide
   it, not remove it from everywhere else … it's worth having the homework set for all of the students throughout their
   whole progress"; "remove before the due date and hide after the due date"). Only homework whose due date has passed can
   be hidden: before then students are still doing it, and Remove is there for homework set by mistake. Hidden homework
   still counts everywhere else (the students' own list, ⏱️ Homework habits, the summary): only the teacher's list leaves
   it out, at the end of its Archive. The time it was hidden goes into the Hidden column, found by its heading and never by
   position (a tab from before it may hold a teacher's own column there). Gated like Remove: a teacher their own, the owner
   anybody's. { ok, data } or { ok:false, why }. */
function homeworkHide(d) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  d = d || {};
  var id = String(d.id || '').trim(), hide = d.hide !== false;
  var lock = null;
  try { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  catch (e) { return { ok:false, why:'Somebody else is changing the homework just now — try again in a moment.' }; }
  try {
    /* the row is found INSIDE the lock, by its id, as Remove finds it */
    var sh = _ensureHomeworkTab_(), rows = _homeworkRows_(), hit = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i].id === id) { hit = rows[i]; break; } }
    if (!hit) return { ok:false, why:'That homework is not there any more.' };
    if (hit.teacher && hit.teacher !== who && who !== _owner_()) {
      return { ok:false, why:'That was set by ' + hit.teacher + '. Only they (or the owner) can change it.' };
    }
    if (hide && !hit.overdue) {
      return { ok:false, why:'Only homework whose due date has passed can be hidden: students are still doing this one. If it was set by mistake, press Remove. If only the date is wrong, change the due date.' };
    }
    if (hide !== hit.hidden) {                         /* already so: nothing to write */
      _hwWiden_(sh);
      var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                   .map(function (x) { return String(x == null ? '' : x).replace(/^✎\s*/, '').trim(); });
      var col = head.indexOf('Hidden') + 1;
      if (!col) {
        return { ok:false, why:'The 📚 Homework tab has no Hidden column: its column ' + String.fromCharCode(64 + _HW_HEADERS_.length) +
                               ' holds something else. Move that to another column, then try again.' };
      }
      sh.getRange(hit.row, col).setValue(hide ? new Date() : '');
    }
  } catch (e) {
    return { ok:false, why:'Could not change it.' };
  } finally { if (lock) { try { lock.releaseLock(); } catch (e) {} } }
  return { ok:true, data:_homeworkData_(undefined, who) };
}

/* The 🔔 switch on the list (1 Oct 2026): reminders off, or on again, for homework already set. Gated like every teacher
   call; a teacher may change their own homework, the owner anybody's (as Remove). Switching on also starts the 15-minute
   check. A reminder already posted is never posted again. { ok, data } or { ok:false, why }. */
function homeworkRemind(d) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  d = d || {};
  var id = String(d.id || '').trim(), on = d.on === true;
  var lock = null;
  try { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  catch (e) { return { ok:false, why:'Somebody else is changing the homework just now — try again in a moment.' }; }
  try {
    /* the row is found INSIDE the lock, by its id, as Remove finds it */
    var sh = _ensureHomeworkTab_(), rows = _homeworkRows_(), hit = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i].id === id) { hit = rows[i]; break; } }
    if (!hit) return { ok:false, why:'That homework is not there any more.' };
    if (hit.teacher && hit.teacher !== who && who !== _owner_()) {
      return { ok:false, why:'That was set by ' + hit.teacher + '. Only they (or the owner) can change it.' };
    }
    _hwWiden_(sh);
    sh.getRange(hit.row, _hwHeadCols_(sh).Remind).setValue(on ? 'on' : 'off');
  } catch (e) {
    return { ok:false, why:'Could not change it.' };
  } finally { if (lock) { try { lock.releaseLock(); } catch (e) {} } }
  if (on && !_hwReminderTrigger_()) {
    return { ok:false, why:'The reminders are on, but the 15-minute check could not be started. 🧪 Biology Labs ▸ 🩺 Check the set-up says why.' };
  }
  return { ok:true, data:_homeworkData_(undefined, who) };
}

/* Change the due date of homework already set (Daniel, 6 Oct 2026: "can the system change the due date … from the website
   and then automatically change it in Google Classroom?"). Gated like Remove and 🔔: a teacher changes their own, the
   owner anybody's. The date and time are read in the school's zone, as Set homework reads them (no time = the end of the
   day); the new due must be still to come, and after a later start. The 📚 Homework row is changed first, under the lock;
   then its Google Classroom assignment, outside it (Classroom can take seconds): CourseWork.patch of dueDate and dueTime
   only, which Classroom allows for an assignment this script posted. If Classroom refuses, the date is still changed here
   and the note says to change it in Classroom by hand. A summary already emailed for the old date goes again after the new
   one. Reminders already posted are not posted again; those still to come follow the new date. { ok, note, data } or
   { ok:false, why }. */
function homeworkChangeDue(d) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  d = d || {};
  var id = String(d.id || '').trim(), time = String(d.time == null ? '' : d.time).trim();
  if (time && !_hwTime_(time)) return { ok:false, why:'The due time is not a time. Type it as hh:mm, or leave it empty for the end of the day.' };
  var due = _dueFrom_(d.due, time);
  if (!due) return { ok:false, why:'Give it a due date.' };
  if (due.getTime() <= Date.now()) return { ok:false, why:'The new due time (' + _hwWhen_(due.getTime()) + ') has passed. Choose a later one.' };
  var lock = null, hit = null, again = [];
  try { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  catch (e) { return { ok:false, why:'Somebody else is changing the homework just now — try again in a moment.' }; }
  try {
    /* the row is found INSIDE the lock, by its id, as Remove finds it */
    var sh = _ensureHomeworkTab_(), rows = _homeworkRows_();
    for (var i = 0; i < rows.length; i++) { if (rows[i].id === id) { hit = rows[i]; break; } }
    if (!hit) return { ok:false, why:'That homework is not there any more.' };
    if (hit.teacher && hit.teacher !== who && who !== _owner_()) {
      return { ok:false, why:'That was set by ' + hit.teacher + '. Only they (or the owner) can change it.' };
    }
    var startMs = _hwMs_(hit.start);
    if (startMs && due.getTime() <= startMs) return { ok:false, why:'It must be due after it starts (' + hit.startText + '). Choose a later due time.' };
    if (_hwMs_(hit.due) === due.getTime()) return { ok:false, why:'That is already its due time.' };
    var hc = _hwHeadCols_(sh);
    sh.getRange(hit.row, hc.Due).setValue(due);
    if (hit.status === 'reported') { sh.getRange(hit.row, hc.Status).setValue('set'); sh.getRange(hit.row, hc.Reported).setValue(''); }
    /* due again later, so students are doing it again: back on the list (7 Oct 2026). Hidden is only ever read under its
       heading, so a row that reads as hidden has that heading, and hc.Hidden is its column. */
    if (hit.hidden) sh.getRange(hit.row, hc.Hidden).setValue('');
    /* a reminder skipped for the old due time (it had passed, or fell too near the night) can go at the new one (7 Oct
       2026). One that went is never posted again, nor one skipped because the reminder after it went. */
    var skipped = function (r) { return !!(r && r.at) && /^skipped:/.test(String(r.said || '')); }, rem = hit.rem || [];
    if (skipped(rem[1])) again.push(2);
    if (skipped(rem[0]) && (!(rem[1] && rem[1].at) || skipped(rem[1]))) again.push(1);
    again = again.filter(function (k) { return hc['Reminder ' + k] && hc['Reminder ' + k + ' students']; });
    again.forEach(function (k) { sh.getRange(hit.row, hc['Reminder ' + k]).setValue(''); sh.getRange(hit.row, hc['Reminder ' + k + ' students']).setValue(''); });
  } catch (e) {
    return { ok:false, why:'Could not change it.' };
  } finally { if (lock) { try { lock.releaseLock(); } catch (e) {} } }
  var when = _hwWhen_(due.getTime()), note;
  if (hit.course && hit.courseWork) {
    try {
      _needClassroom_();
      Classroom.Courses.CourseWork.patch({
        dueDate: { year: due.getUTCFullYear(), month: due.getUTCMonth() + 1, day: due.getUTCDate() },
        dueTime: { hours: due.getUTCHours(), minutes: due.getUTCMinutes() }
      }, hit.course, hit.courseWork, { updateMask: 'dueDate,dueTime' });
      note = 'It is now due ' + when + ', here and in Google Classroom.';
    } catch (e) {
      note = 'It is now due ' + when + ' here, but Google Classroom did not take it (' +
             String((e && e.message) || e).replace(/[A-Za-z0-9_-]{25,}/g, '…').slice(0, 140) +
             '). Change the due date in Classroom ▸ Classwork by hand.';
    }
  } else {
    note = 'It is now due ' + when + '. It was not posted to Google Classroom, so there is nothing to change there.';
  }
  if (hit.status === 'reported') note += ' The summary email goes again after the new due time.';
  if (again.length && hit.remindOn) note += ' A reminder skipped for the old due time can go before the new one.';
  if (hit.hidden) note += ' It was hidden: it is listed again, with the homework still to come.';
  return { ok:true, note: note, data:_homeworkData_(undefined, who) };
}

/* Count pupils in a whole-class homework they are not in (Daniel, 6 Oct 2026: "the special case of these six students"):
   pupils who were in the class the day it was set, but came onto the Students tab later because the import had stopped part
   way. The teacher ticks them on the list (_homeworkData_ `outside`); only pupils in its class now and not in it already are
   added, to its Spec `setFor`, as if they had been on the tab that day. A pupil who joined or moved in later is left out
   unless ticked: homework set before they came never counts against them. Gated like Remove: a teacher their own homework,
   the owner anybody's. { ok, note, data } or { ok:false, why }. */
function homeworkAddPupils(d) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  d = d || {};
  var id = String(d.id || '').trim(), want = [];
  (Array.isArray(d.emails) ? d.emails : []).slice(0, 200).forEach(function (e) { e = _cleanEmail_(e); if (e && want.indexOf(e) < 0) want.push(e); });
  if (!want.length) return { ok:false, why:'Tick the pupils to count in it.' };
  var lock = null, added = [], cls = '';
  try { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  catch (e) { return { ok:false, why:'Somebody else is changing the homework just now — try again in a moment.' }; }
  try {
    /* the row is found INSIDE the lock, by its id, as Remove finds it */
    var sh = _ensureHomeworkTab_(), rows = _homeworkRows_(), hit = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i].id === id) { hit = rows[i]; break; } }
    if (!hit) return { ok:false, why:'That homework is not there any more.' };
    if (hit.teacher && hit.teacher !== who && who !== _owner_()) {
      return { ok:false, why:'That was set by ' + hit.teacher + '. Only they (or the owner) can change it.' };
    }
    cls = String((hit.targets || {}).cls || '').trim().toUpperCase();
    if (!cls || !hit.setFor) return { ok:false, why:'Only homework set for a whole class can take pupils in.' };
    var roster = _studentDirectory_().students, have = {}, inClass = {};
    _hwPupils_(hit, roster).forEach(function (p) { have[p.email] = 1; });
    roster.forEach(function (p) { if (p.cls === cls) inClass[p.email] = 1; });
    want.forEach(function (e) { if (inClass[e] && !have[e]) added.push(e); });
    if (!added.length) return { ok:false, why:'Nobody to add: each ticked pupil is in it already, or no longer in ' + cls + '.' };
    var hc = _hwHeadCols_(sh), cell = sh.getRange(hit.row, hc.Spec), spec = {};
    try { spec = JSON.parse(String(cell.getValue() || '{}')) || {}; } catch (e) { spec = {}; }
    if (!Array.isArray(spec.setFor)) return { ok:false, why:'This homework’s list of pupils cannot be read.' };
    spec.setFor = spec.setFor.concat(added);
    cell.setValue(JSON.stringify(spec));
  } catch (e) {
    return { ok:false, why:'Could not change it.' };
  } finally { if (lock) { try { lock.releaseLock(); } catch (e) {} } }
  return { ok:true, note: added.length + ' pupil' + (added.length === 1 ? '' : 's') + ' of ' + cls + ' now count' + (added.length === 1 ? 's' : '') +
           ' in this homework.', data:_homeworkData_(undefined, who) };
}

/* Move a pupil to another class (Daniel, 6 Oct 2026: "there should be an option to move a student between classes … and then
   everything is ported"). A pupil's record is theirs, never the class's: homework set while they were in the old class
   still names them (its result stays theirs, and shows under their new class in ⏱️ Homework habits), their lab, Bio
   English and Write-Up work is theirs by their email, homework set for the new class from now on includes them, and the
   new class's earlier homework never counts against them. This writes the new class on the Students tab and on their row
   of every lab, Bio English and Write-Up tab, at once (Tidy up would also have put the lab rows right). Google Classroom
   is NOT changed: the teacher moves them there too (a script cannot put a pupil into a course without the pupil). Gated:
   a teacher on the list or the owner. { ok, note, data (the Students directory) } or { ok:false, why }.
   d.left (7 Oct 2026): into none of the classes, the class "LEFT <year>", for a pupil who leaves part way through the year
   (the import window finds the rest at the start of a new one). Moving them to a class brings them back. */
function studentMove(d) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  d = d || {};
  var email = _cleanEmail_(d.email), to = String(d.cls == null ? '' : d.cls).replace(/\s+/g, ' ').trim().toUpperCase();
  if (!email) return { ok:false, why:'Which pupil?' };
  var left = d.left === true;
  if (left) to = _leftLabel_();
  else if (_isLeftClass_(to)) return { ok:false, why:'Choose a class. To take them out of every class, choose “Left: in no class”.' };
  if (!/^[A-Z0-9][A-Z0-9 .\-]{0,15}$/.test(to)) return { ok:false, why:'Choose the class to move them to.' };
  var lock = null, name = '', from = '';
  try { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  catch (e) { return { ok:false, why:'The spreadsheet is busy just now (pupils saving). Try again in a moment.' }; }
  try {
    var stu = _sheet_(T_STUDENTS), n = stu.getLastRow() - 1;
    if (n < 1) return { ok:false, why:'There is nobody on the Students tab.' };
    var ec = _emailCol_(stu), v = stu.getRange(2, 1, n, ec).getValues(), at = -1;
    for (var i = 0; i < v.length; i++) { if (_cleanEmail_(v[i][ec - 1]) === email) { at = i; break; } }   /* the first row wins, as for a save */
    if (at < 0) return { ok:false, why:'That pupil is not on the Students tab.' };
    name = String(v[at][0] || '').trim(); from = String(v[at][1] || '').trim().toUpperCase();
    if (left && _isLeftClass_(from)) return { ok:false, why:(name || 'They') + ' is in none of the classes already.' };
    if (from === to) return { ok:false, why:(name || 'They') + ' is in ' + to + ' already.' };
    stu.getRange(at + 2, 2).setValue(to);
    /* their Course id follows them: the course most of their new class came from, or none (a class made by hand). Left with
       the old one, the next import of the old course listed them as "not in its Classroom course now" (the audit, 7 Oct 2026). */
    if (!left) {
      var cc = _headerCol_(stu, 'Course id', ec + 4);
      if (cc <= stu.getLastColumn()) {
        var cids = stu.getRange(2, cc, v.length, 1).getDisplayValues(), tally = {}, best = '';
        v.forEach(function (row, k) { var c = String(cids[k][0] || '').trim(); if (k !== at && c && String(row[1] || '').trim().toUpperCase() === to) tally[c] = (tally[c] || 0) + 1; });
        Object.keys(tally).forEach(function (c) { if (!best || tally[c] > tally[best]) best = c; });
        stu.getRange(at + 2, cc).setNumberFormat('@').setValue(best);
        /* and that course counts them in until its next import says otherwise (move them in Classroom too) */
        if (best) _noteListed_(best, email);
      }
    }
    /* their row on every tab that copies the class */
    var one = {}; one[email] = to;
    _classEverywhere_(one);
    _classesChanged_();
  } catch (e) {
    return { ok:false, why:'Could not move them.' };
  } finally { if (lock) { try { lock.releaseLock(); } catch (e) {} } }
  var note = left
    ? (name || 'They') + ' is in none of the classes now (' + to + '). Their records stay. If they are still in the class in Google Classroom, ' +
      'remove them there too: the next import puts them back.'
    : (name || 'They') + ' moved from ' + (from || 'no class') + ' to ' + to + '. Their homework and work go with them. Move them in Google Classroom too.';
  return { ok:true, note:note, data:_studentDirectory_(), trackerBase:_trackerAppUrl_() };
}

/* Students ▸ a pupil's card ▸ Accommodation (Daniel, 8 Oct 2026): help for the pupils who need it, by the teacher's choice.
   On: after a SECOND, different wrong try at a question the page explains what the pupil got wrong, where an explanation is
   written: the labs' multiple-choice questions (their other types have none); Bio English's fix, trim, mark, keyword and exam
   cards (pick and choose explain every choice to everyone already, and so do the etymology cards' notes; order, build,
   gap and sort cards have no written explanation); every Write-Up test question. A keyword card's help never shows the
   answer in any form (labs/bio-english-lab/js/engine.js kwMeaning). Bio English also offers keyword meanings in Korean or Chinese (the pupil chooses). Off: as everyone else. It writes Yes or nothing into the pupil's
   Accommodation cell (the same cell a teacher can type in); a tab Tidy up has not given that column yet gets it inserted
   right after Course id.
   Each lab page reads it when it loads (the pupil's own answer: progress, english.mine, writeup.mine). Nothing else changes:
   no record, no mark. */
function studentAccommodation(d) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  d = d || {};
  var email = _cleanEmail_(d.email), on = d.on === true;
  if (!email) return { ok:false, why:'Which pupil?' };
  var lock = null, name = '';
  try { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  catch (e) { return { ok:false, why:'The spreadsheet is busy just now (pupils saving). Try again in a moment.' }; }
  try {
    var stu = _sheet_(T_STUDENTS), n = stu.getLastRow() - 1;
    if (n < 1) return { ok:false, why:'There is nobody on the Students tab.' };
    /* the column first: a tab without one gets it inserted right after Course id (never written over a column), then the rows */
    _studentTrailColumns_(stu);
    var C = _studentCols_(stu), ec = C.email, ac = C.acc, v = stu.getRange(2, 1, n, ec).getValues(), rows = [];
    if (!ac) return { ok:false, why:'The Students tab has no Accommodation column, and one could not be added. Press Tidy up, then try again.' };
    /* every row with that address: a save reads the first, and a second row (Tidy up names it) must not disagree */
    for (var i = 0; i < v.length; i++) { if (_cleanEmail_(v[i][ec - 1]) === email) rows.push(i); }
    if (!rows.length) return { ok:false, why:'That pupil is not on the Students tab.' };
    name = String(v[rows[0]][0] || '').trim();
    rows.forEach(function (r) { stu.getRange(r + 2, ac).setValue(on ? 'Yes' : ''); });
  } catch (e) {
    return { ok:false, why:'Could not change it.' };
  } finally { if (lock) { try { lock.releaseLock(); } catch (e) {} } }
  var note = on
    ? (name || 'This pupil') + ' has the accommodation now: after a second, different wrong try, their pages explain what they got ' +
      'wrong, where an explanation is written (the labs\' multiple-choice questions, most Bio English cards, the Write-Up tests); ' +
      'Bio English also offers keyword meanings in Korean or Chinese (they choose 한국어 or 中文). They see it the next time a page loads.'
    : (name || 'This pupil') + ' has no accommodation now: the pages work for them as for everyone else.';
  /* the cell is written: a directory that cannot be read now must not turn that into "could not be reached" */
  var dir = null, base = '';
  try { dir = _studentDirectory_(); base = _trackerAppUrl_(); } catch (e) { dir = null; }
  return { ok:true, note: note + (dir ? '' : ' Press ↻ Refresh, at the top of the page, to see it on the card.'), data:dir, trackerBase:base };
}

/* 📊 Analysis ↗ (Daniel, 1 Oct 2026): the teacher page links to the analysis website, for the people on that website's
   👥 list only. The list is kept by the tracker's own script (AppScript Tracker Analysis, _publishViewers_) as
   SPREADSHEET-level developer metadata on the Student Progress Tracker: key ANALYSIS_VIEWERS, visibility DOCUMENT, value
   {"v":1,"emails":[…]} (lowercase, cleaned, sorted). This reads it (about a second: the tracker opened, the key found),
   keeps the list in the script cache for five minutes, and gives the page the website's address or '' — never the
   list. A changed key or shape hides the link; the website keeps its own gate whatever this says. */
var ANALYSIS_KEY = 'ANALYSIS_VIEWERS', ANALYSIS_CACHE = 'analysis-viewers', ANALYSIS_CACHE_S = 300;
function _analysisLink_(email) {
  try {
    var hub = _hubUrl_(), id = _trackerId_(), me = _cleanEmail_(email);
    if (!hub || !id || !me) return '';
    var cache = null, list = null;
    try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
    var hit = cache ? cache.get(ANALYSIS_CACHE) : null;
    if (hit) { try { list = JSON.parse(hit); } catch (e) { list = null; } }
    if (!Array.isArray(list)) {
      list = [];
      var found = SpreadsheetApp.openById(id).createDeveloperMetadataFinder().withKey(ANALYSIS_KEY).find();
      if (found && found.length) {
        var o = JSON.parse(found[0].getValue());
        if (o && Array.isArray(o.emails)) list = o.emails.map(_cleanEmail_).filter(function (e) { return !!e; });
      }
      if (cache) { try { cache.put(ANALYSIS_CACHE, JSON.stringify(list), ANALYSIS_CACHE_S); } catch (e) {} }
    }
    return list.indexOf(me) >= 0 ? hub + '/analysis.html' : '';
  } catch (e) { return ''; }
}

/* The one page, and the one endpoint behind it (uiData). The page is served with no data in it: the tab it opens
   on is fetched at once, then the others in the background, one at a time, each kept in the browser's
   sessionStorage for ten minutes (Teacher.html). Lab progress alone is half a megabyte, so baking them all into
   the page would make it slow to open. Nobody signed in, or somebody not on the list, gets only the page's name
   and who it is for (_teacherHtml_) — not a single link, name or mark. */
function _teacherAppPage_(startTab) {
  var email = '';
  try { email = _cleanEmail_(Session.getActiveUser().getEmail()); } catch (e) {}
  var dom = _schoolDomain_();
  if (!email) return _htmlOut_(_teacherHtml_({ state:'nobody', dom:dom }), 'Teachers');
  if (!_isTeacher_(email)) return _htmlOut_(_teacherHtml_({ state:'refused', email:email, dom:dom }), 'Teachers');
  var boot = {                           /* all the page reads from it (the views get theirs from uiData) */
    email: email,
    tab: startTab || 'teachers',
    analysis: _analysisLink_(email),     /* 📊 Analysis: the website's address for a viewer on its 👥 list, else '' */
    hub: _hubUrl_()                      /* ← Biology Hub (2 Oct 2026): the hub opens this page in the same tab; HUB_URL, or '' */
  };
  var json = JSON.stringify(boot).replace(/</g, '\\u003c');
  var html = HtmlService.createHtmlOutputFromFile('Teacher').getContent()
    .replace('__BOOT__', function () { return json; });
  return _htmlOut_(html, 'Biology teachers');
}

/* Everything the page asks for, in one gated door. */
function uiData(which, arg) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  try {
    if (which === 'questions') return { ok:true, data:_labQuestions_(String(arg || '').slice(0, 40)) };   /* one lab's question words (6 Oct 2026) */
    if (which === 'teachers')  return { ok:true, data:_teacherPageGroups_() };
    if (which === 'progress')  return { ok:true, data:_labProgressData_() };
    if (which === 'students')  return { ok:true, data:_studentDirectory_(), trackerBase:_trackerAppUrl_() };
    if (which === 'homework')  return { ok:true, data:_homeworkData_(undefined, who) };   /* their own homework (the owner: everyone's) */
    if (which === 'english')   return { ok:true, data:_englishProgressData_() };
    if (which === 'writeup')   return { ok:true, data:_writeupProgressData_() };   /* the Write-Up view (8 Oct 2026): read only */
    if (which === 'habits')    return { ok:true, data:_habitsData_() };      /* ⏱️ Homework habits (1 Oct 2026): read only */
  } catch (err) { return { ok:false, why:String(err) }; }
  return { ok:false, why:'Unknown view.' };
}

function showTeacherPanel() {
  if (!_isAdminCaller_()) return;   /* reachable by anyone via google.script.run: these are expensive owner-privileged writes */
  _ensureTeacherTabs_();
  var html = HtmlService.createHtmlOutputFromFile('TeacherPage')
    .setWidth(680).setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Links on the teacher page');
}
/* The same window, opened at its teachers and the page's addresses (26 Sep 2026: the links used to sit last,
   under three address boxes, behind a menu item that did not say it was where links are added). */
function showTeacherSetup_() {
  if (!_isAdminCaller_()) return;
  _ensureTeacherTabs_();
  var html = HtmlService.createHtmlOutputFromFile('TeacherPage')
    .append('<script>window.TP_START = "setup";</script>')
    .setWidth(680).setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Teacher page: teachers and addresses');
}

function teacherPanelData() {
  if (!_isAdminCaller_()) return { ok: false };
  var _scan0_;
  _ensureTeacherTabs_();
  var teachers = [];
  try {
    var sh = _ss_().getSheetByName(T_TEACHERS);
    if (sh && sh.getLastRow() >= 2) {
      var nc = _headerCol_(sh, 'Name', 1), ec = _headerCol_(sh, 'Email', 2);
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().forEach(function (r) {
        var em = _cleanEmail_(r[ec - 1]);
        if (em) teachers.push({ name: String(r[nc - 1] || '').trim(), email: em });
      });
    }
  } catch (e) {}
  return {
    ok: true,
    owner: _owner_(),
    domain: _schoolDomain_(),
    pageUrl: String(_keptSetting_(TEACHER_PAGE_URL, 'TEACHER_PAGE_URL') || '').replace(/\?.*$/, ''),
    pageLive: !!_teacherPageUrl_(),
    trackerUrl: String(_keptSetting_(TRACKER_APP_URL, 'TRACKER_APP_URL') || '').replace(/\?.*$/, ''),
    trackerLive: !!_trackerAppUrl_(),
    hubUrl: String(_keptSetting_(HUB_URL, 'HUB_URL') || '').trim(),
    hubLive: !!_hubUrl_(),
    teachers: teachers,
    unreadable: (_scan0_ = _teacherLinksScan_()).unreadable, typed: _scan0_.typed, chipsOn: _scan0_.chipsOn, chipTrouble: _scan0_.chipTrouble,
    links: _scan0_.rows.map(function (l) {         /* the same reading: one call to Google, not two */
      var co = _cohortLabel_(l.grad);
      l.cohort = co ? { title: co.title, yearGroup: co.yearGroup } : null;
      l.typeClass = _typeClass_(l.type);
      return l;
    }),
    types: ['Reflection', 'Test', 'Survey', 'Records'],
    findFolders: _findFolders_(),
    /* the graduation year of this school year's Y10 (a school year starts on 1 August), for the window's example */
    y10: (function (d) { return (d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1) + 2; })(new Date())
  };
}

function teacherAddTeacher(name, email) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  email = _cleanEmail_(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, why: 'That is not an email address.' };
  var dom = _schoolDomain_();
  if (dom && email.split('@').pop() !== dom)
    return { ok: false, why: 'A teacher needs a staff address at ' + dom + ' (not a pupil address).' };
  var sh = _ensureTeacherTabs_() && _ss_().getSheetByName(T_TEACHERS);
  var ec = _headerCol_(sh, 'Email', 2);
  if (sh.getLastRow() >= 2) {
    var have = sh.getRange(2, ec, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < have.length; i++) if (_cleanEmail_(have[i][0]) === email)
      return { ok: false, why: 'That teacher is already on the list.' };
  }
  sh.appendRow([String(name || '').trim(), email, new Date()]);
  _dressRows_(sh, [{}, {}, { fmt:'dd MMM, HH:mm' }], sh.getLastRow(), 1);
  return teacherPanelData();
}

function teacherRemoveTeacher(email) {
  if (!_isAdminCaller_()) return { ok: false };
  email = _cleanEmail_(email);
  var sh = _ss_().getSheetByName(T_TEACHERS);
  if (sh && sh.getLastRow() >= 2) {
    var ec = _headerCol_(sh, 'Email', 2);
    var have = sh.getRange(2, ec, sh.getLastRow() - 1, 1).getValues();
    for (var i = have.length - 1; i >= 0; i--) if (_cleanEmail_(have[i][0]) === email) sh.deleteRow(i + 2);
  }
  return teacherPanelData();
}

function teacherAddLink(d) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  d = d || {};
  var url = String(d.url || '').trim();
  if (!/^https:\/\/[^\s"'<>]+$/i.test(url)) return { ok: false, why: 'The link must be a full https:// address.' };
  var dash = String(d.dash || '').trim();
  if (dash && !/^https:\/\/[^\s"'<>]+$/i.test(dash))
    return { ok: false, why: 'The dashboard address must be a full https:// address, or left empty.' };
  if (dash && dash === url)
    return { ok: false, why: 'The dashboard address is the same as the link. Leave it empty unless it is the separate /exec?page=dashboard address.' };
  var assessment = String(d.assessment || '').trim();
  var name = String(d.name || '').trim() || assessment;
  if (!name) return { ok: false, why: 'Give it an assessment name (or a name).' };
  var sh = _ensureTeacherTabs_() && _ss_().getSheetByName(T_LINKS);
  sh.appendRow([String(d.type || 'Reflection').trim() || 'Reflection', assessment,
                String(d.grad || '').trim(), name, url, String(d.note || '').trim(), dash]);
  return teacherPanelData();
}

function teacherRemoveLink(row) {
  if (!_isAdminCaller_()) return { ok: false };
  row = Number(row) || 0;
  var sh = _ss_().getSheetByName(T_LINKS);
  if (sh && row >= 2 && row <= sh.getLastRow()) {
    /* a spreadsheet you took off stays off: 🔎 Find leaves it out until "Add back" */
    try {
      var gone = _teacherLinksScan_().rows.filter(function (r) { return r.row === row; })[0], id = gone ? _sheetIdOf_(gone.url) : '';
      if (id) _setFindSkip_(_findSkip_().filter(function (x) { return x.id !== id; }).concat([{ id: id, name: gone.name }]));
    } catch (e) {}
    sh.deleteRow(row);
  }
  return teacherPanelData();
}

function teacherSetPageUrl(url) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  url = String(url || '').trim().replace(/\?.*$/, '');
  if (url && !_isExecUrl_(url)) return { ok: false, why: 'That is not a web-app address. It should end /exec.' };
  _setKept_('TEACHER_PAGE_URL', url);
  return teacherPanelData();
}
function teacherSetHubUrl(url) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  url = String(url || '').trim().replace(/\/+$/, '');
  if (url && !/^https:\/\/[^\s"'<>]+$/i.test(url)) return { ok: false, why: 'That should be your hub\u2019s https:// address.' };
  _setKept_('HUB_URL', url);
  return teacherPanelData();
}
function teacherSetTrackerUrl(url) {
  if (!_isAdminCaller_()) return { ok: false, why: 'Not allowed.' };
  url = String(url || '').trim().replace(/\?.*$/, '');
  if (url && !_isExecUrl_(url)) return { ok: false, why: 'That is not a web-app address. It should end /exec.' };
  _setKept_('TRACKER_APP_URL', url);
  return teacherPanelData();
}

/* Any reflection deployment's /exec, kept the way TEACHER_PAGE_URL is. The Students tab builds each pupil's link
   from it (Teacher.html link(): ?page=student&email=…; the reflection's serveDashboard shows a teacher that pupil's
   own page, and anybody else only their own). Empty: the Students tab still lists every pupil, but cannot open
   their trackers. */
function _trackerAppUrl_() {
  var u = String(_keptSetting_(TRACKER_APP_URL, 'TRACKER_APP_URL') || '').trim();
  return _isExecUrl_(u) ? u.replace(/\?.*$/, '') : '';
}

function _esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
/* which of the four colours a type reads in — matched loosely so "Reflections", "End-of-topic
   test", "Encuesta"/"Survey" all land in the right family; everything else is neutral */
function _typeClass_(t) {
  t = String(t).toLowerCase();
  if (/reflect/.test(t)) return 'reflection';
  if (/test|exam|paper/.test(t)) return 'test';
  if (/survey|encuesta|form|quiz|poll/.test(t)) return 'survey';
  return 'other';
}

/* The page a visitor gets when the teacher page will not open for them: signed out ('nobody'), or signed in with an
   address that is not on the list ('refused'). It says who the page is for, and holds no link, name or mark. The
   teacher page itself is Teacher.html (_teacherAppPage_). Until 30 Sep 2026 this also held the old one-list page,
   which nothing had reached since Teacher.html replaced it on 17 Sep. */
function _teacherHtml_(o) {
  var e = _esc_, main;
  if (o.state === 'refused') {
    main = '<p class="say">This page is for Biology teachers. You are signed in as <b>' + e(o.email) +
           '</b>, which is not on its list.</p>' +
           '<p class="fine">If you teach Biology here, ask the teacher who runs this page to add your address.</p>';
  } else {
    main = '<p class="say">Open this page signed in with your school Google account' +
           (o.dom ? ' (…@' + e(o.dom) + ')' : '') + '.</p>';
  }
  var who = o.email
    ? '<span class="who"><svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="8.2" r="4" fill="currentColor"/><path d="M4.2 21c.8-4.2 4-6.6 7.8-6.6s7 2.4 7.8 6.6z" fill="currentColor"/></svg>' +
      'Signed in as <b>' + e(o.email) + '</b></span>'
    : '';
  return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8">' +
    /* Apps Script serves this inside a sandbox iframe. Without this every link tries to load
       script.google.com INSIDE that frame, and Google refuses to be framed — the browser then says
       "refused to connect". An explicit target= on a link still wins over this. */
    '<base target="_top">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500&display=swap">' +
    '<style>' +
    ':root{--ink:#0A141C;--line2:rgba(150,190,215,.32);--chalk:#EDF4F8;--dim:#AFC2CE;--mute:#7E93A1;--cyan:#4FC3F7;--accent:#E879F9;' +
    '--serif:Fraunces,Georgia,serif;--sans:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}' +
    '*{box-sizing:border-box}' +
    'html,body{margin:0;background:radial-gradient(1100px 460px at 82% -12%,rgba(232,121,249,.07),transparent 62%),var(--ink);' +
    'color:var(--chalk);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}' +
    '.wrap{max-width:860px;margin:0 auto;padding:clamp(24px,5vw,52px) clamp(16px,4vw,32px) 56px}' +
    '.eye{font:600 10.5px/1.3 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}.eye b{color:var(--accent)}' +
    'h1{font:400 clamp(36px,5.4vw,56px)/1.02 var(--serif);letter-spacing:-.02em;margin:10px 0 12px}h1 em{font-style:italic;color:var(--accent)}' +
    '.lede{color:#C5D4DD;max-width:58ch;margin:0 0 18px;font-size:15.5px}' +
    '.topbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin-top:4px}' +
    '.who{display:inline-flex;align-items:center;gap:9px;padding:7px 15px 7px 11px;border:1px solid var(--line2);border-radius:999px;' +
    'background:rgba(120,200,230,.06);font-size:13px;color:var(--dim)}.who svg{color:var(--cyan);opacity:.85;flex:none}' +
    '.who b{color:var(--chalk);font-weight:500}' +
    '.say{font:400 20px/1.45 var(--serif);max-width:52ch;margin:22px 0 10px}.say b{font-family:var(--sans);font-size:16px;font-weight:500;color:var(--chalk)}' +
    '.fine{color:var(--mute);font-size:13.5px;max-width:62ch}' +
    '</style></head><body><div class="wrap">' +
    '<p class="eye">Biology Hub · <b>Teachers only</b></p>' +
    '<h1>Assessment <em>system</em></h1>' +
    '<p class="lede">The teachers’ side of the Biology Hub: assessment spreadsheets, lab progress, Bio English, students and homework.</p>' +
    '<div class="topbar">' + who + '</div>' + main + '</div></body></html>';
}

/* Every setting typed at the top (TRACKER_ID, SCHOOL_DOMAIN, TEACHERS, TEACHER_PAGE_URL, TRACKER_APP_URL,
   HUB_URL), remembered the same way SHEET_ID is, so that pasting a fresh copy of this file over the top never
   wipes what was typed in. */
function _keptSetting_(literal, key) {
  var props;
  try { props = PropertiesService.getScriptProperties(); } catch (e) { return literal; }
  if (literal) {
    try { if (props.getProperty(key) !== literal) props.setProperty(key, literal); } catch (e) {}
    return literal;
  }
  return props.getProperty(key) || '';
}
function _trackerId_()     { return _keptSetting_(TRACKER_ID, 'TRACKER_ID'); }
function _schoolDomain_()  { return String(_keptSetting_(SCHOOL_DOMAIN, 'SCHOOL_DOMAIN')).toLowerCase().replace(/^@/, ''); }

function _json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
                       .setMimeType(ContentService.MimeType.JSON);
}

function _text_(m) { return ContentService.createTextOutput(m).setMimeType(ContentService.MimeType.TEXT); }

/* ═══════════════════════════════════════════════════════════════════════════
   BIO ENGLISH LAB — the writing site, recorded in THIS spreadsheet
   ═══════════════════════════════════════════════════════════════════════════
   nlcsbiology.com/bio-english-lab trains pupils to write short, exact exam answers — describe,
   explain, plan an investigation — and tests their keywords. Like the labs it saves quietly as a
   pupil works, set by set — nothing is handed in.

   It is recorded here rather than in a spreadsheet of its own so that a teacher has ONE roster,
   ONE teacher page and ONE homework list: a single piece of homework can hold lab stations and
   English sets together, with one due date and one Classroom post. (Daniel's decision, 19 Sep 2026.)

   What it adds — and nothing the labs already do changes:
     • the tab "✍️ Bio English": one row per pupil, like a lab's tab, made at their first save;
     • two POST actions, english.save and english.mine — the signed-in pupil's own row, no one else's;
     • homework: Bio English Lab is scored as one lab more, id 'bio-english-lab', whose "stations"
       are its sets, named and counted by the site's public data/sets.json;
     • the teacher page's "Bio English" view (?page=english);
   and, for every homework, labs included: posting to Google Classroom, and the due-date email.
   ═══════════════════════════════════════════════════════════════════════════ */

var T_ENGLISH   = '✍️ Bio English';
var ENGLISH_ID  = 'bio-english-lab';
var ENGLISH_URL = 'https://nlcsbiology.com/bio-english-lab';   /* read for set names and counts only */
var EN_TAB      = '#1E7A3E';
var ENGLISH_COLS = [
  { h:'Name', w:200, note:'From the Students tab. A student appears here the first time the site saves their work.' },
  { h:'Class', w:80, align:'center', note:'From the Students tab, as it was at their last save.' },
  { h:'Vocabulary', w:100, align:'center', fmt:'0', group:true, note:'Keyword questions answered, in every keyword set they have opened.' },
  { h:'Vocabulary right first time', w:184, align:'center', fmt:'0%', note:'Of those keyword questions, the share they got right at the first attempt.' },
  { h:'Answer writing', w:120, align:'center', fmt:'0', group:true, note:'Describe, explain, plan and "how to answer" questions answered.' },
  { h:'Writing right first time', w:166, align:'center', fmt:'0%', note:'Of those writing questions, the share they got right at the first attempt.' },
  { h:'Sets finished', w:106, align:'center', fmt:'0', group:true, note:'Sets with every question answered. A set rebuilt since counts what they did on its earlier version (marked [best from an earlier version] in Per set).' },
  { h:'Last saved', w:132, fmt:'dd MMM, HH:mm', note:'When the site last saved their work.' },
  { h:'Per set', w:460, note:'Every set they have opened: questions answered / questions in the set, and in brackets how many were right first time.' },
  { h:'School email', w:230, hide:true, note:'What ties this row to the student. Do not edit.' },
  { h:'Carried between devices', w:200, hide:true, note:'Which questions they have answered, set by set — the round they are on, their first round and their best — so signing in on another computer brings their work back. Written by the site. Do not edit.' },
  /* goes (September 2026): appended, so every column above keeps its position */
  { h:'Practised again', w:300, note:'Sets they started again (Start again), so they could try the questions again. Nothing is lost: the counts, Sets finished, Per set and homework keep their best, and right first time stays from their FIRST round.\n\n"T3 Keywords: meanings (round 2, 5/18)" — that set is on its 2nd round, with 5 of its 18 questions done so far in this round.' },
  /* ⏱️ Homework habits (1 Oct 2026): appended, so every column above keeps its position */
  { h:'Set times', w:200, hide:true,
    note:'When each set was first tried, and when it was first finished, as the site’s saves arrived. Kept from the first save after this column appeared; a first time is never changed. The teacher page’s ⏱️ Homework habits reads it. Not marks. Do not edit.' }
];
var EN_LAST = 8, EN_EMAIL = 10, EN_SNAP = 11, EN_AGAIN = 12, EN_TIMES = 13;
/* One letter per question, as the site writes it. Two computers disagreeing keep the better. */
var EN_RANK = { '0':0, 't':1, 's':2, '1':3, 'f':4 };   /* untouched < tried < answer shown < right < right first time */
var EN_SID  = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

function _englishSheet_() {
  var ss = _ss_(), sh = ss.getSheetByName(T_ENGLISH);
  if (!sh) {
    sh = ss.insertSheet(T_ENGLISH);
    sh.getRange(1, 1, 1, ENGLISH_COLS.length).setValues([ENGLISH_COLS.map(function (c) { return c.h; })]);
    _dress2_(sh, ENGLISH_COLS, { tab: EN_TAB, freezeCols: 2 });
  }
  return _enColsReady_(sh);
}
/* The same guard as _labColsReady_, for the Bio English tab: widened the moment it is used. */
function _enColsReady_(sh) { return _colsReady_(sh, ENGLISH_COLS, EN_SNAP, 'ENCOLS'); }

/* The site's own list of sets: ids, titles, question counts, topic and year. Public, nothing
   personal. Cached on the site's publish stamp, exactly as the labs' station list is. */
function _englishManifest_() {
  var base = ENGLISH_URL.replace(/\/+$/, ''), cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  var stamp = cache ? (cache.get('EN_STAMP') || '') : '';
  if (!stamp) {
    try {
      var vr = UrlFetchApp.fetch(base + '/version.txt', { muteHttpExceptions:true, followRedirects:true });
      if (vr.getResponseCode() === 200) stamp = String(vr.getContentText()).trim().slice(0, 20);
    } catch (e) {}
    if (cache && stamp) { try { cache.put('EN_STAMP', stamp, 600); } catch (e) {} }
  }
  var KEY = 'EN_SETS_' + (stamp || 'none');
  if (cache) { var hit = cache.get(KEY); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  var txt = '';
  try {
    var res = UrlFetchApp.fetch(base + '/data/sets.json', { muteHttpExceptions:true, followRedirects:true });
    if (res.getResponseCode() !== 200) return null;
    txt = res.getContentText();
  } catch (e) { return null; }
  var m = null; try { m = JSON.parse(txt); } catch (e) { return null; }
  if (!m || !m.sets || !m.units) return null;
  if (cache && txt.length < 95000) { try { cache.put(KEY, txt, 21600); } catch (e) {} }
  return m;
}

/* What homework is scored against: the labs' stations, Bio English Lab's sets as one lab more, and the Write-Up
   Lab's parts as one more again (3 Oct 2026). Any of them can be missing without the others failing, and each says
   so for itself. */
function _hwManifest_() {
  var labs = _manifest_(), en = _englishManifest_(), wu = null;
  try { wu = _writeupManifest_(); } catch (e) { wu = null; }
  var out = { labs: {}, labsOk: !!labs, en: en, wu: wu };
  if (labs && labs.labs) Object.keys(labs.labs).forEach(function (k) { out.labs[k] = labs.labs[k]; });
  if (en) out.labs[ENGLISH_ID] = _englishAsLab_(en);
  if (wu) out.labs[WRITEUP_ID] = _writeupAsLab_(wu);
  return out;
}
function _englishAsLab_(en) {
  var q = 0;
  var st = (en.sets || []).map(function (s) {
    var u = s.unit && en.units[s.unit] ? en.units[s.unit] : null;
    q += Number(s.total) || 0;
    return { id: s.id, name: (u ? 'T' + u.n + ' ' : '') + s.title, questions: Number(s.total) || 0 };
  });
  return { name: 'Bio English Lab', questions: q, stations: st };
}

/* "{…}" in, an object out, and never a throw: a cell somebody typed in is not the site's JSON. */
function _enParse_(v) {
  var o = null, out = {};
  try { o = JSON.parse(String(v || '') || '{}'); } catch (e) { o = null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  Object.keys(o).forEach(function (k) {
    var x = o[k];
    if (!EN_SID.test(k) || !x || typeof x !== 'object') return;
    out[k] = { d: Math.max(0, Number(x.d) || 0), f: Math.max(0, Number(x.f) || 0), t: Math.max(0, Number(x.t) || 0),
               s: String(x.s || '').replace(/[^01tfs]/g, ''), v: String(x.v || ''), k: String(x.k || ''),
               g: Math.max(1, Math.floor(Number(x.g) || 1)),                   /* goes, Sept 2026 */
               s1: String(x.s1 || '').replace(/[^01tfs]/g, ''), b: String(x.b || '').replace(/[^01tfs]/g, ''),
               x: Math.max(0, Math.floor(Number(x.x) || 0)),                   /* best of earlier versions (8 Oct 2026): */
               xt: Math.max(0, Math.floor(Number(x.xt) || 0)),                 /*   out of this many, */
               xf: Math.max(0, Math.floor(Number(x.xf) || 0)) };               /*   so many right first time */
    if (!out[k].x) { delete out[k].x; delete out[k].xt; delete out[k].xf; }  /* kept only when it holds something */
  });
  return out;
}
/* A cell holds 50,000 characters. If a pupil ever reached that, the detail of FINISHED sets goes
   first: their counts stay, and a finished set has nothing left to carry on with. */
function _enPack_(kept) {
  var txt = JSON.stringify(kept);
  if (txt.length > 45000) {
    Object.keys(kept).forEach(function (k) { if (kept[k].t && kept[k].d >= kept[k].t) { kept[k].s = ''; kept[k].s1 = ''; kept[k].b = ''; } });
    txt = JSON.stringify(kept);
  }
  if (txt.length > 45000) { Object.keys(kept).forEach(function (k) { kept[k].s = ''; kept[k].s1 = ''; kept[k].b = ''; }); txt = JSON.stringify(kept); }
  return txt;
}
/* Two computers, one pupil: keep the better answer to each question and never go backwards. A set
   rebuilt since (a new version) starts again, because its questions are not the same ones.
   Goes (September 2026) — Start again clears the page, never the record, by the labs' rules:
     s  this go (g)  the higher go wins; within a go, each question keeps its better state
     s1 first go     every go-1 record, each question its better state
     b  best ever    everything, each question its better state
   d (answered) comes from the best and f (right first time) from the FIRST go, never lower than before;
   a page from before goes sends go 1 only, so it adds to the best and never undoes a newer go; it adds to
   the first go only while the set is still on go 1. */
function _enMax_(a, b) {
  a = String(a || ''); b = String(b || '');
  var out = '', len = Math.max(a.length, b.length);
  for (var i = 0; i < len; i++) { var x = a.charAt(i) || '0', y = b.charAt(i) || '0'; out += (EN_RANK[y] || 0) > (EN_RANK[x] || 0) ? y : x; }
  return out;
}
/* The most of a set ever answered, in ANY version of it (8 Oct 2026; Daniel: "if students have answered questions before
   … and they had a score, then it'd be nice to have that score because that means that we can track their progress").
   A rebuilt set starts its letters again (they are other questions), but `x` keeps the best answered count of every
   earlier version, so homework, the Bio English tab, the teacher page and ⏱️ Homework habits never go backwards. Capped
   at the set's size now. The labs keep their Per station the same way. */
function _enBest_(x) { return _enBestOf_(x).d; }
/* { d, f, old }: the answered count homework reads, the right-first-time count that goes WITH it (never this version's f
   beside an earlier version's d: the audit of 8 Oct 2026), and 1 when both come from an earlier version. A carried best
   is a SHARE of the size it was made on (`xt`), scaled to the size now: a finished version stays finished, an
   unfinished one never becomes finished because the set shrank (12 of 18 is 6 of 10, never 10 of 10). */
function _enBestOf_(x) {
  var t = x.t || 0, d = t ? Math.min(x.d || 0, t) : (x.d || 0);
  if (x.x) {
    var sx = _bestScale_(x.x, x.xt, t), sf = Math.min(sx, _bestScale_(x.xf || 0, x.xt, t, true));
    if (sx > d) return { d: sx, f: sf, old: 1 };
  }
  return { d: d, f: Math.min(x.f || 0, d), old: 0 };
}
/* n done out of `from`, as a count out of `to`: all of it stays all of it; part of it is scaled down, never up to all. */
function _bestScale_(n, from, to, partOnly) {
  n = n || 0;
  if (!to) return n;
  if (!from) return Math.min(n, to);
  if (n >= from && !partOnly) return to;
  return Math.min(n >= from ? to : to - 1, Math.floor(n * to / from));
}
function _enMerge_(old, inc) {
  inc.g = inc.g > 1 ? inc.g : 1;
  /* a page from before goes, on a set already past round 1: its letters (perhaps a later round's, pulled and
     sent back) count for the best only, and its own first-time count is not the first round's */
  var stale = !!(inc.oldPage && old && old.v === inc.v && old.g > 1);
  if (stale) inc.f = 0;
  var iFirst = stale ? '' : _enMax_(inc.s1, inc.g === 1 ? inc.s : ''), iBest = _enMax_(_enMax_(inc.b, inc.s), iFirst);
  var out;
  if (!old || old.v !== inc.v) {
    out = { s: inc.s, g: inc.g, s1: iFirst, b: iBest, t: inc.t, v: inc.v, k: inc.k, d: inc.d, f: inc.f };
  } else {
    var og = old.g > 1 ? old.g : 1;
    var oFirst = _enMax_(old.s1, og === 1 ? old.s : ''), oBest = _enMax_(_enMax_(old.b, old.s), oFirst);
    var s = inc.g > og ? inc.s : inc.g < og ? old.s : _enMax_(old.s, inc.s), g = Math.max(inc.g, og);
    out = { s: s, g: g, s1: _enMax_(oFirst, iFirst), b: _enMax_(oBest, iBest), t: inc.t, v: inc.v, k: inc.k || old.k,
            d: Math.max(old.d, inc.d), f: Math.max(old.f, inc.f) };
  }
  if (out.b) {                                     /* letters: the counts come from them, never lower than before */
    var d = 0, f = 0;
    for (var i = 0; i < out.b.length; i++) { var c = out.b.charAt(i); if (c === 'f' || c === '1' || c === 's') d++; }
    for (var j = 0; j < out.s1.length; j++) if (out.s1.charAt(j) === 'f') f++;
    out.d = Math.max(old && old.v === inc.v ? old.d : 0, d);
    out.f = Math.max(old && old.v === inc.v ? old.f : 0, f);
  }
  if (out.t) { out.d = Math.min(out.d, out.t); out.f = Math.min(out.f, out.d); }
  /* the best of every version before this one, as { x, t, f } on the size it was made on (8 Oct 2026) */
  var c = old && old.x ? { x: old.x, t: old.xt || old.t || 0, f: old.xf || 0 } : null;
  if (old && old.v !== inc.v && old.d > 0) {
    var cand = { x: old.d, t: old.t || 0, f: old.f || 0 };
    if (!c || (cand.t ? cand.x / cand.t : 0) > (c.t ? c.x / c.t : 0)) c = cand;
  }
  if (c) {
    var T = out.t || c.t, sx = _bestScale_(c.x, c.t, T);
    if (sx > out.d) { out.x = sx; out.xt = T; out.xf = Math.min(sx, _bestScale_(c.f, c.t, T, true)); }
  }
  return out;
}
/* The columns a teacher reads, worked out from the stored sets. */
function _enSummary_(kept, en) {
  var bySet = {}, order = {}, vd = 0, vf = 0, wd = 0, wf = 0, fin = 0, again = [];
  if (en) (en.sets || []).forEach(function (s, i) { bySet[s.id] = s; order[s.id] = i; });
  function at(k) { return order[k] == null ? 1e6 : order[k]; }
  var bits = Object.keys(kept).sort(function (a, b) { return at(a) - at(b) || (a < b ? -1 : 1); }).map(function (sid) {
    var x = kept[sid], m = bySet[sid], kind = (m && m.kind) || x.k, bo = _enBestOf_(x), bd = bo.d;
    if (kind === 'kw') { vd += bd; vf += bo.f; } else { wd += bd; wf += bo.f; }
    if (x.t && bd >= x.t) fin++;
    var u = m && m.unit && en.units[m.unit] ? en.units[m.unit] : null;
    var name = (u ? 'T' + u.n + ' ' : '') + (m ? m.title : sid);
    if (x.g > 1) {
      var now = 0; for (var i = 0; i < x.s.length; i++) { var c = x.s.charAt(i); if (c === 'f' || c === '1' || c === 's') now++; }
      again.push(name + ' (round ' + x.g + ', ' + now + '/' + x.t + ')');
    }
    return name + ' ' + bd + '/' + x.t + ' (' + bo.f + ')' + (bo.old ? ' [best from an earlier version]' : '');
  });
  return { vocab: vd, vocabFirst: vd ? vf / vd : '', writing: wd, writingFirst: wd ? wf / wd : '',
           finished: fin, perSet: bits.join(' · ').slice(0, 45000), again: again.join(' · ').slice(0, 45000) };
}
function _enRowFor_(sh, email, student) {
  var last = sh.getLastRow();
  if (last > 1) {
    var col = sh.getRange(2, EN_EMAIL, last - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) if (_cleanEmail_(col[i][0]) === email) return i + 2;
  }
  var row = new Array(ENGLISH_COLS.length).fill('');
  row[0] = student.name; row[1] = student.cls; row[EN_EMAIL - 1] = email; row[EN_SNAP - 1] = '{}';
  _room_(sh, last + 1);
  sh.getRange(last + 1, 1, 1, ENGLISH_COLS.length).setValues([row]);
  return last + 1;
}

/* english.save — { token, sets: { <setId>: { done, first, total, snap, v, go, snap1, best } }, at }, sent a few
   seconds after a pupil answers, and again as they leave the page. go, snap1 and best are the round, the first
   round and the best ever (goes, Sept 2026); a set that sends none of the three comes from a page from before
   them (oldPage). `at` is sent but not read. */
function _englishSave_(d) {
  if (!_clientId_()) return _json_({ ok:false, why:'sign-in is not set up' });
  var who = _whoSaving_(d);
  if (!who) return _json_({ ok:false, why:'not signed in' });
  var student = _studentOf_(who.email), readAt = Date.now();
  /* the rule every save follows: somebody not on the roster leaves no trace here at all */
  if (!student) return _json_({ ok:false, why:'not on your teacher’s class list (' + who.email + ')' });
  var sets = d.sets && typeof d.sets === 'object' && !Array.isArray(d.sets) ? d.sets : {};
  var ids = Object.keys(sets).filter(function (k) { return EN_SID.test(k); });
  if (!ids.length) return _json_({ ok:true, saved:0 });
  if (ids.length > 300) return _json_({ ok:false, why:'too much at once' });
  var en = _englishManifest_(), bySet = {};
  if (en) (en.sets || []).forEach(function (s) { bySet[s.id] = s; });
  /* ⏱️ Homework habits: the sets as the homework scorer counts them (_hwManifest_'s shape; no sheet is read) */
  var stMan = { labs: {} };
  try { if (en) stMan.labs[ENGLISH_ID] = _englishAsLab_(en); } catch (eM) {}

  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { return _json_({ ok:false, why:'busy — it will try again' }); }
  try {
    student = _freshStudent_(who.email, student, readAt);   /* a Move or Left done while this save waited for the lock */
    var sh = _englishSheet_(), r = _enRowFor_(sh, who.email, student);
    /* the sets, Practised again and Set times in ONE read (the sets alone were one read before) */
    var cells = sh.getRange(r, EN_SNAP, 1, EN_TIMES - EN_SNAP + 1).getValues()[0];
    var kept = _enParse_(cells[0]), saved = 0, stBefore = null;
    try { stBefore = _stEnState_(kept, ids, who.email, stMan); } catch (eT) { stBefore = null; }
    ids.forEach(function (sid) {
      var s = sets[sid] || {}, m = bySet[sid] || null;
      if (en && !m) return;                                /* a set the site does not have */
      var total = m ? (Number(m.total) || 0) : Math.max(0, Math.min(500, Number(s.total) || 0));
      var inc = { d: Math.max(0, Math.min(total, Number(s.done) || 0)), f: 0, t: total,
                  s: String(s.snap || '').replace(/[^01tfs]/g, '').slice(0, total || 500),
                  v: String(s.v || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20), k: m ? String(m.kind || '') : '',
                  g: Math.max(1, Math.min(9999, Math.floor(Number(s.go) || 1))),
                  s1: String(s.snap1 || '').replace(/[^01tfs]/g, '').slice(0, total || 500),
                  b: String(s.best || '').replace(/[^01tfs]/g, '').slice(0, total || 500),
                  oldPage: !('go' in s) && !('snap1' in s) && !('best' in s) };
      inc.f = Math.max(0, Math.min(inc.d, Number(s.first) || 0));
      /* a page left open from before the set was rebuilt must not overwrite work on the new one */
      if (m && kept[sid] && kept[sid].v === String(m.v) && inc.v !== String(m.v)) return;
      kept[sid] = _enMerge_(kept[sid], inc);
      saved++;
    });
    var sum = _enSummary_(kept, en), at = new Date(), times = cells[EN_TIMES - EN_SNAP];
    /* ⏱️ Homework habits: when each set was first tried and first finished, in this same write; never a reason to fail */
    try { if (stBefore) times = _stNext_(times, stBefore, _stEnState_(kept, ids, who.email, stMan), +at); } catch (eT) {}
    sh.getRange(r, 1, 1, EN_TIMES).setValues([[
      student.name, student.cls, sum.vocab, sum.vocabFirst, sum.writing, sum.writingFirst, sum.finished,
      at, _plain_(sum.perSet), who.email, _enPack_(kept), _plain_(sum.again), times
    ]]);
    _dressRows_(sh, ENGLISH_COLS, r, 1);      /* so a row written between tidy-ups still reads properly */
    SpreadsheetApp.flush();
    return _json_({ ok:true, saved:saved });
  } finally { lock.releaseLock(); }
}

/* english.mine — their own work back (another computer, a cleared browser), the homework set for
   them that has English in it, and, for a teacher, the way to the teacher page. Read only. */
function _englishMine_(d) {
  if (!_clientId_()) return _json_({ ok:false, why:'sign-in is not set up' });
  var who = _whoSaving_(d);
  if (!who) return _json_({ ok:false, why:'not signed in' });
  var out = { ok:true, name: who.name || '', onList:false, cls:'', sets:{}, homework:[] };
  /* the way to the teacher page only for Google's own sign-in, never for a pass */
  if (!who.viaPass && _isTeacher_(who.email)) { out.teacher = true; out.teacherPage = _englishTeacherUrl_(); }
  var student = _studentOf_(who.email);
  if (!student) return _json_(out);                    /* nothing, to anyone not on the roster */
  out.onList = true; out.cls = student.cls;
  if (student.acc) out.acc = 1;                       /* the teacher's accommodation: this pupil's own, never anyone else's */
  var sh = _ss_().getSheetByName(T_ENGLISH);
  if (sh && sh.getLastRow() >= 2) {
    var n = sh.getLastRow() - 1, v = sh.getRange(2, EN_EMAIL, n, 2).getValues();
    for (var i = 0; i < n; i++) {
      if (_cleanEmail_(v[i][0]) !== who.email) continue;
      var kept = _enParse_(v[i][1]);
      Object.keys(kept).forEach(function (sid) {
        var x = kept[sid];
        /* `snap` is all a page from before goes reads, and it sends it back as its round 1: on a later round it
           is the FIRST round's letters, never this round's. A page that knows goes reads `here`. */
        out.sets[sid] = { done: x.d, first: x.f, total: x.t, snap: x.g > 1 ? (x.s1 || '') : x.s, here: x.s, v: x.v, go: x.g, snap1: x.s1, best: x.b,
                          most: _enBest_(x) };   /* the answered count homework reads, of any version (8 Oct 2026): the page's homework colour */
      });
      break;
    }
  }
  var now = Date.now(), MONTH = 28 * 24 * 3600 * 1000;
  _homeworkRows_().forEach(function (hw) {
    var sets = [];
    hw.tasks.forEach(function (t) { if (t.labId === ENGLISH_ID) sets = sets.concat(t.stationIds || []); });
    if (!sets.length || hw.waiting || !_hwIsFor_(hw, who.email, student.cls)) return;   /* waiting: set for a later date */
    var dms = hw.due ? new Date(hw.due).getTime() : 0;
    if (dms && now - dms > MONTH) return;              /* a month past its date: off their list */
    out.homework.push({ id: hw.id, title: hw.title, due: hw.dueText, overdue: hw.overdue, dueAt: hw.due || '', sets: sets });
  });
  out.homework.sort(function (a, b) { return String(a.dueAt).localeCompare(String(b.dueAt)); });
  return _json_(out);
}
/* The same answer _hwPupils_ gives, asked the other way round: is this homework theirs? */
function _hwIsFor_(hw, email, cls) {
  if (hw.setFor) {
    if (hw.setFor.indexOf(email) >= 0) return true;              /* who was in the room that day */
    /* in its Classroom course that day, imported later, and in its class now (as _hwPupils_) */
    return !!hw.inCourse && hw.inCourse.indexOf(email) >= 0 && !!hw.targets.cls && String(hw.targets.cls).trim().toUpperCase() === String(cls || '').toUpperCase();
  }
  if ((hw.targets.emails || []).map(_cleanEmail_).indexOf(email) >= 0) return true;
  return !!hw.targets.cls && String(hw.targets.cls).toUpperCase() === cls;
}
function _englishTeacherUrl_() {
  var u = _teacherPageUrl_();
  return u ? u.replace(/\?page=teachers$/, '?page=english') : '';
}

/* The English tab read once, in the shape _hwScoreOne_ reads a lab's tab. No tab yet is NOT a
   vanished lab — nobody has saved anything — so it is {} (nothing done), never null (unmarkable). */
function _englishIndex_(need) {
  var sh = _ss_().getSheetByName(T_ENGLISH), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var n = sh.getLastRow() - 1, v = sh.getRange(2, 1, n, EN_SNAP).getValues();
  for (var i = 0; i < n; i++) {
    var em = _cleanEmail_(v[i][EN_EMAIL - 1]);
    if (!em || (need && !need[em])) continue;
    var kept = _enParse_(v[i][EN_SNAP - 1]), byId = {};
    Object.keys(kept).forEach(function (sid) { byId[sid] = { done: _enBest_(kept[sid]) }; });   /* best of any version */
    out[em] = { byId: byId, at: v[i][EN_LAST - 1] ? new Date(v[i][EN_LAST - 1]).getTime() : 0 };
  }
  return out;
}

/* The teacher page's "Bio English" view: every pupil on the roster and, per set they have opened,
   two numbers — answered, right first time. The page does the arithmetic. */
function _englishProgressData_(now) {
  var en = _englishManifest_(), dir = _studentDirectory_(now), prog = {};
  var sh = _ss_().getSheetByName(T_ENGLISH);
  if (sh && sh.getLastRow() >= 2) {
    var n = sh.getLastRow() - 1, v = sh.getRange(2, 1, n, EN_SNAP).getValues();
    for (var i = 0; i < n; i++) {
      var em = _cleanEmail_(v[i][EN_EMAIL - 1]);
      if (!em) continue;
      var kept = _enParse_(v[i][EN_SNAP - 1]), slim = {};
      /* [answered (best of any version), right first time, 1 when the answered count comes from an earlier version] */
      Object.keys(kept).forEach(function (sid) { var b = _enBestOf_(kept[sid]); slim[sid] = b.old ? [b.d, b.f, 1] : [b.d, b.f]; });
      prog[em] = { sets: slim, at: v[i][EN_LAST - 1] ? new Date(v[i][EN_LAST - 1]).toISOString() : null };
    }
  }
  return {
    generatedAt: new Date().toISOString(), manifestOk: !!en,
    english: en ? { years: en.years || [], units: en.units || {}, sets: en.sets || [] } : null,
    students: dir.students.filter(function (s) { return !_isLeftClass_(s.cls); })      /* in none of the classes: off this view */
                .map(function (s) { return { name: s.name, cls: s.cls, email: s.email }; }),
    classes: dir.classes, progress: prog
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   WRITE-UP LAB (3 Oct 2026, Daniel: "when I set homework, this is also something I can set and that is
   tracked in the spreadsheet")
   ═══════════════════════════════════════════════════════════════════════════
   nlcsbiology.com/write-up-lab teaches a lab report one part at a time (Variables, Hypothesis, Apparatus…). Each
   part has Learn steps, a Red pen (one per level that has its own: IGCSE, IB IA, IB EE), Mistakes to avoid, Test
   yourself, Keywords and Go further. It is recorded here, beside Bio English, for the same reason: one roster, one
   teacher page, one homework list.

   Daniel's rules for it: homework is WHOLE parts; one standard for everyone, with no level to choose ("they have to
   do all of the questions, even the IB"). A part is finished when every red-pen mistake of every version is found
   and every question is answered: the "questions" the homework scorer counts for a part are its red-pen marks
   plus its questions (`units` in the site's data/parts.json). Learn steps, Mistakes to avoid and Go further are
   kept and shown, never needed. Keyword cards are not kept at all ("swapping the cards might be very misguiding").
   No time is measured.

   What it adds — and nothing the labs or Bio English do changes:
     • the tab "📝 Write-Up Lab": one row per pupil, made at their first save;
     • two POST actions, writeup.save and writeup.mine — the signed-in pupil's own row, no one else's;
     • homework: the Write-Up Lab is scored as one lab more, id 'write-up-lab', whose "stations" are its parts,
       named and counted by the site's public data/parts.json (written by its tools/check.mjs --stamp);
     • the teacher page's "Write-Up" view (?page=writeup, 8 Oct 2026).
   A part rewritten since (a new v) restarts its letters, never the most a pupil finished of it (`x`, _wuBestOf_).
   ═══════════════════════════════════════════════════════════════════════════ */

var T_WRITEUP   = '📝 Write-Up Lab';
var WRITEUP_ID  = 'write-up-lab';
var WRITEUP_URL = 'https://nlcsbiology.com/write-up-lab';   /* read for part names and counts only */
var WU_TAB      = '#1E4FA8';
var WRITEUP_COLS = [
  { h:'Name', w:200, note:'From the Students tab. A student appears here the first time the site saves their work.' },
  { h:'Class', w:80, align:'center', note:'From the Students tab, as it was at their last save.' },
  { h:'Parts finished', w:116, align:'center', fmt:'0', group:true, note:'Parts with every red-pen mistake found (in every version the part has: IGCSE, IB IA, IB EE) and every Test yourself question answered, IB ones too. That is what homework counts. A part rewritten since counts what they did on its earlier version (marked [best … from an earlier version] in Per part).' },
  { h:'Red-pen mistakes found', w:170, align:'center', fmt:'0', group:true, note:'Mistakes found in the red pens, in every part they have opened.' },
  { h:'Questions answered', w:150, align:'center', fmt:'0', group:true, note:'Test yourself questions answered, in every part they have opened. An answer shown after three tries counts as answered.' },
  { h:'Right first time', w:130, align:'center', fmt:'0%', note:'Of those questions, the share they got right at their first attempt.' },
  { h:'Learn steps opened', w:150, align:'center', fmt:'0', group:true, note:'Learn steps they opened, in every part. Opening a step does not show that it was read. Not needed to finish a part.' },
  { h:'Last saved', w:132, fmt:'dd MMM, HH:mm', note:'When the site last saved their work.' },
  { h:'Per part', w:560, note:'Every part they have opened, in the order of a report: red-pen mistakes found / mistakes in all its red pens; questions answered / questions, and how many were right first time; Learn steps opened; whether Mistakes to avoid and Go further were opened. ✓ = the part is finished.' },
  { h:'School email', w:230, hide:true, note:'What ties this row to the student. Do not edit.' },
  { h:'Carried between devices', w:200, hide:true, note:'What they have done, part by part, so signing in on another computer brings their work back. Written by the site. Do not edit.' },
  { h:'Part times', w:200, hide:true,
    note:'When each part was first tried, and when it was first finished, as the site’s saves arrived. A first time is never changed. The teacher page’s ⏱️ Homework habits reads it. Not marks. Do not edit.' }
];
var WU_LAST = 8, WU_EMAIL = 10, WU_SNAP = 11, WU_TIMES = 12;
var WU_SID = /^[a-z0-9-]{1,40}$/;

function _writeupSheet_() {
  var ss = _ss_(), sh = ss.getSheetByName(T_WRITEUP);
  if (!sh) {
    sh = ss.insertSheet(T_WRITEUP);
    sh.getRange(1, 1, 1, WRITEUP_COLS.length).setValues([WRITEUP_COLS.map(function (c) { return c.h; })]);
    _dress2_(sh, WRITEUP_COLS, { tab: WU_TAB, freezeCols: 2 });
  }
  return _colsReady_(sh, WRITEUP_COLS, WU_TIMES, 'WUCOLS');
}

/* The site's own list of parts: ids, titles, and what finishing each takes. Public, nothing personal. Cached on the
   site's publish stamp, as the labs' station list and Bio English's sets are. */
function _writeupManifest_() {
  var base = WRITEUP_URL.replace(/\/+$/, ''), cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  var stamp = cache ? (cache.get('WU_STAMP') || '') : '';
  if (!stamp) {
    try {
      var vr = UrlFetchApp.fetch(base + '/version.txt', { muteHttpExceptions:true, followRedirects:true });
      if (vr.getResponseCode() === 200) stamp = String(vr.getContentText()).trim().slice(0, 20);
    } catch (e) {}
    if (cache && stamp) { try { cache.put('WU_STAMP', stamp, 600); } catch (e) {} }
  }
  var KEY = 'WU_PARTS_' + (stamp || 'none');
  if (cache) { var hit = cache.get(KEY); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  var txt = '';
  try {
    var res = UrlFetchApp.fetch(base + '/data/parts.json', { muteHttpExceptions:true, followRedirects:true });
    if (res.getResponseCode() !== 200) return null;
    txt = res.getContentText();
  } catch (e) { return null; }
  var m = null; try { m = JSON.parse(txt); } catch (e) { return null; }
  if (!m || !m.parts || !m.parts.length) return null;
  if (cache && txt.length < 95000) { try { cache.put(KEY, txt, 21600); } catch (e) {} }
  return m;
}
/* The parts as the homework scorer counts them: a part's "questions" are its red-pen marks and its questions. */
function _writeupAsLab_(wm) {
  var q = 0;
  var st = (wm.parts || []).map(function (p) { q += Number(p.units) || 0; return { id: p.id, name: p.title, questions: Number(p.units) || 0 }; });
  return { name: 'Write-Up Lab', questions: q, stations: st };
}
function _wuPartsById_(wm) { var by = {}; if (wm) (wm.parts || []).forEach(function (p) { by[p.id] = p; }); return by; }

/* "{…}" in, an object out, and never a throw. One record per part: { v, l, r: { g, i, e }, m, q, f } — the site's
   track.js says what each letter means (l Learn steps, r red-pen marks found per version, m Mistakes to avoid
   opened, q one letter per question 0 t s 1 f, f Go further panels). */
function _wuClean_(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  var r = {}, out;
  if (x.r && typeof x.r === 'object' && !Array.isArray(x.r)) ['g', 'i', 'e'].forEach(function (l) { if (l in x.r) r[l] = String(x.r[l] || '').replace(/[^01]/g, '').slice(0, 100); });
  out = { v: String(x.v || '').replace(/[^a-z0-9]/g, '').slice(0, 20),
           l: String(x.l || '').replace(/[^01]/g, '').slice(0, 200), r: r, m: x.m ? 1 : 0,
           q: String(x.q || '').replace(/[^0tsf1]/g, '').slice(0, 200),
           f: String(x.f || '').replace(/[^01]/g, '').slice(0, 50),
           x: Math.max(0, Math.min(2000, Math.floor(Number(x.x) || 0))),     /* best of earlier versions (8 Oct 2026): */
           xt: Math.max(0, Math.min(2000, Math.floor(Number(x.xt) || 0))),   /*   out of this many units, */
           xf: Math.max(0, Math.min(2000, Math.floor(Number(x.xf) || 0))) }; /*   so many right first time */
  if (!out.x) { delete out.x; delete out.xt; delete out.xf; }               /* kept only when it holds something */
  return out;
}
function _wuParse_(v) {
  var o = null, out = {};
  try { o = JSON.parse(String(v || '') || '{}'); } catch (e) { o = null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  Object.keys(o).forEach(function (k) { var c = WU_SID.test(k) ? _wuClean_(o[k]) : null; if (c) out[k] = c; });
  return out;
}
/* A record cut or padded to the part's shape in the site's list (p), or null when it belongs to an older version of
   the part (a page left open from before the part was rewritten). No list: kept as it came. */
function _wuFit_(x, p) {
  if (!x) return null;
  if (!p) return x;
  if (x.v !== String(p.v)) return null;
  function pad(s, n) { s = String(s || '').slice(0, n); while (s.length < n) s += '0'; return s; }
  var r = {};
  (p.redpens || []).forEach(function (y) { r[y.l] = pad((x.r || {})[y.l], Number(y.n) || 0); });
  return { v: x.v, l: pad(x.l, Number(p.steps) || 0), r: r, m: x.m ? 1 : 0, q: pad(x.q, Number(p.questions) || 0), f: pad(x.f, Number(p.further) || 0), x: x.x || 0, xt: x.xt || 0, xf: x.xf || 0 };
}
/* Two computers, one pupil: letter by letter, the better (EN_RANK: 0 < t < s < 1 < f, and 0 < 1 for the rest). A part
   rewritten since (a new v) starts again: the newer version's record wins outright. */
function _wuMerge_(old, inc) {
  if (!old || old.v !== inc.v) return inc;
  var r = {};
  Object.keys(inc.r).forEach(function (l) { r[l] = _enMax_(old.r[l], inc.r[l]); });
  Object.keys(old.r).forEach(function (l) { if (!(l in r)) r[l] = old.r[l]; });
  return { v: inc.v, l: _enMax_(old.l, inc.l), r: r, m: old.m || inc.m ? 1 : 0, q: _enMax_(old.q, inc.q), f: _enMax_(old.f, inc.f) };
}
/* What one part's record adds up to, against the site's list when it can be read (else the record's own lengths). */
function _wuCount_(x, p) {
  function n(s, re) { return (String(s || '').match(re) || []).length; }
  var marks = 0, found = 0;
  if (p) (p.redpens || []).forEach(function (y) { marks += Number(y.n) || 0; found += Math.min(n(String((x.r || {})[y.l] || '').slice(0, Number(y.n) || 0), /1/g), Number(y.n) || 0); });
  else Object.keys(x.r || {}).forEach(function (l) { marks += x.r[l].length; found += n(x.r[l], /1/g); });
  var total = p ? Number(p.questions) || 0 : x.q.length, q = String(x.q || '').slice(0, total);
  var answered = n(q, /[s1f]/g), first = n(q, /f/g);
  var units = p ? Number(p.units) || (marks + total) : marks + total;
  return { marks: marks, found: found, total: total, answered: answered, first: first, units: units, done: Math.min(units, found + answered),
           learn: n(x.l, /1/g), steps: p ? Number(p.steps) || 0 : String(x.l || '').length, traps: !!x.m,
           further: n(x.f, /1/g), panels: p ? Number(p.further) || 0 : String(x.f || '').length };
}
/* The most of a part ever finished (red-pen marks found + questions answered), in ANY version of it (8 Oct 2026, as Bio
   English's _enBest_): a rewritten part starts its letters again, but the count never drops. A record of an older version
   still counts by its own lengths; `x` keeps that count once a save replaces it. Capped at what the part takes now. */
function _wuBest_(rec, p) { return _wuBestOf_(rec, p).done; }
/* { done, first, old }, as _enBestOf_: the carried best is a share of the units it was made on, scaled to the part now,
   and its right-first-time count goes with it. */
function _wuBestOf_(rec, p) {
  if (!rec) return { done: 0, first: 0, old: 0 };
  var fit = p ? _wuFit_(rec, p) : rec, c = fit ? _wuCount_(fit, p) : null;
  var units = p ? (Number(p.units) || 0) : (c ? c.units : 0), now = c ? c.done : 0, first = c ? c.first : 0;
  var cx = rec.x ? { x: rec.x, t: rec.xt || 0, f: rec.xf || 0 } : null;
  if (!fit) {                                          /* a record of an older version: its own count, on its own size */
    var raw = _wuCount_(rec, null);
    if (raw.done && (!cx || (raw.units ? raw.done / raw.units : 0) > (cx.t ? cx.x / cx.t : 0))) cx = { x: raw.done, t: raw.units, f: raw.first };
  }
  if (cx) {
    var sx = _bestScale_(cx.x, cx.t, units), sf = Math.min(sx, _bestScale_(cx.f, cx.t, units, true));
    if (sx > now) return { done: sx, first: sf, old: 1 };
  }
  return { done: now, first: first, old: 0 };
}
/* The columns a teacher reads, worked out from the stored parts. */
function _wuSummary_(kept, wm) {
  var by = _wuPartsById_(wm), order = {}, fin = 0, found = 0, answered = 0, first = 0, learn = 0;
  if (wm) (wm.parts || []).forEach(function (p, i) { order[p.id] = i; });
  function at(k) { return order[k] == null ? 1e6 : order[k]; }
  var bits = Object.keys(kept).sort(function (a, b) { return at(a) - at(b) || (a < b ? -1 : 1); }).map(function (id) {
    var p = by[id] || null, fit = p ? _wuFit_(kept[id], p) : kept[id];
    var c = _wuCount_(fit || { v: '', l: '', r: {}, m: 0, q: '', f: '' }, p), best = _wuBest_(kept[id], p), done = c.units && best >= c.units;
    if (done) fin++;
    found += c.found; answered += c.answered; first += c.first; learn += c.learn;
    return (p ? p.title : id) + (done ? ' ✓' : '') + (best > c.done ? ' [best ' + best + '/' + c.units + ' from an earlier version]' : '') + ' (red pen ' + c.found + '/' + c.marks + ', questions ' + c.answered + '/' + c.total +
      ', ' + c.first + ' first time, Learn ' + c.learn + '/' + c.steps + ', Mistakes to avoid ' + (c.traps ? 'opened' : 'not opened') +
      (c.panels ? ', Go further ' + c.further + '/' + c.panels : '') + ')';
  });
  return { finished: fin, found: found, answered: answered, firstShare: answered ? first / answered : '', learn: learn,
           perPart: bits.join(' · ').slice(0, 45000) };
}
function _wuRowFor_(sh, email, student) {
  var last = sh.getLastRow();
  if (last > 1) {
    var col = sh.getRange(2, WU_EMAIL, last - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) if (_cleanEmail_(col[i][0]) === email) return i + 2;
  }
  var row = new Array(WRITEUP_COLS.length).fill('');
  row[0] = student.name; row[1] = student.cls; row[WU_EMAIL - 1] = email; row[WU_SNAP - 1] = '{}';
  _room_(sh, last + 1);
  sh.getRange(last + 1, 1, 1, WRITEUP_COLS.length).setValues([row]);
  return last + 1;
}

/* writeup.save — { token, parts: { <partId>: { v, l, r, m, q, f } } }, sent two minutes after a change, at once when a
   homework part is finished, at sign-in, and as the pupil leaves the page. */
function _writeupSave_(d) {
  if (!_clientId_()) return _json_({ ok:false, why:'sign-in is not set up' });
  var who = _whoSaving_(d);
  if (!who) return _json_({ ok:false, why:'not signed in' });
  var student = _studentOf_(who.email), readAt = Date.now();
  /* the rule every save follows: somebody not on the roster leaves no trace here at all */
  if (!student) return _json_({ ok:false, why:'not on your teacher’s class list (' + who.email + ')' });
  var parts = d.parts && typeof d.parts === 'object' && !Array.isArray(d.parts) ? d.parts : {};
  var ids = Object.keys(parts).filter(function (k) { return WU_SID.test(k); });
  if (!ids.length) return _json_({ ok:true, saved:0 });
  if (ids.length > 60) return _json_({ ok:false, why:'too much at once' });
  var wm = _writeupManifest_(), by = _wuPartsById_(wm);
  /* ⏱️ Homework habits: the parts as the homework scorer counts them (_hwManifest_'s shape; no sheet is read) */
  var stMan = { labs: {} };
  try { if (wm) stMan.labs[WRITEUP_ID] = _writeupAsLab_(wm); } catch (eM) {}

  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { return _json_({ ok:false, why:'busy — it will try again' }); }
  try {
    student = _freshStudent_(who.email, student, readAt);   /* a Move or Left done while this save waited for the lock */
    var sh = _writeupSheet_(), r = _wuRowFor_(sh, who.email, student);
    /* the parts and Part times in ONE read */
    var cells = sh.getRange(r, WU_SNAP, 1, WU_TIMES - WU_SNAP + 1).getValues()[0];
    var kept = _wuParse_(cells[0]), saved = 0, stBefore = null;
    try { stBefore = _stWuState_(kept, ids, who.email, stMan, wm); } catch (eT) { stBefore = null; }
    ids.forEach(function (id) {
      var p = by[id] || null;
      if (wm && !p) return;                                /* a part the site does not have */
      var inc = _wuFit_(_wuClean_(parts[id]), p);
      if (!inc) return;                                    /* a page from before the part was rewritten */
      delete inc.x; delete inc.xt; delete inc.xf;          /* the best is the script's own: never taken from a page */
      var was = _wuBestOf_(kept[id], p);                   /* the best so far, in any version, on this part's size (8 Oct 2026) */
      kept[id] = _wuMerge_(p ? _wuFit_(kept[id], p) : kept[id], inc);
      delete kept[id].x; delete kept[id].xt; delete kept[id].xf;
      if (was.done > _wuCount_(kept[id], p).done) { kept[id].x = was.done; kept[id].xt = p ? (Number(p.units) || 0) : 0; kept[id].xf = was.first; }
      saved++;
    });
    var sum = _wuSummary_(kept, wm), at = new Date(), times = cells[WU_TIMES - WU_SNAP];
    /* ⏱️ Homework habits: when each part was first tried and first finished, in this same write; never a reason to fail */
    try { if (stBefore) times = _stNext_(times, stBefore, _stWuState_(kept, ids, who.email, stMan, wm), +at); } catch (eT) {}
    var txt = JSON.stringify(kept);
    if (txt.length > 45000) return _json_({ ok:false, why:'too much at once' });
    sh.getRange(r, 1, 1, WU_TIMES).setValues([[
      student.name, student.cls, sum.finished, sum.found, sum.answered, sum.firstShare, sum.learn,
      at, _plain_(sum.perPart), who.email, txt, times
    ]]);
    _dressRows_(sh, WRITEUP_COLS, r, 1);      /* so a row written between tidy-ups still reads properly */
    SpreadsheetApp.flush();
    return _json_({ ok:true, saved:saved });
  } finally { lock.releaseLock(); }
}

/* writeup.mine — their own work back (another computer, a cleared browser), the homework set for them that has
   Write-Up parts in it, and, for a teacher, the way to the teacher page. Read only. */
function _writeupMine_(d) {
  if (!_clientId_()) return _json_({ ok:false, why:'sign-in is not set up' });
  var who = _whoSaving_(d);
  if (!who) return _json_({ ok:false, why:'not signed in' });
  var out = { ok:true, name: who.name || '', onList:false, cls:'', parts:{}, homework:[] };
  /* the way to the teacher page only for Google's own sign-in, never for a pass */
  if (!who.viaPass && _isTeacher_(who.email)) { out.teacher = true; out.teacherPage = _writeupTeacherUrl_(); }
  var student = _studentOf_(who.email);
  if (!student) return _json_(out);                    /* nothing, to anyone not on the roster */
  out.onList = true; out.cls = student.cls;
  if (student.acc) out.acc = 1;                       /* the teacher's accommodation: this pupil's own, never anyone else's */
  var sh = _ss_().getSheetByName(T_WRITEUP);
  if (sh && sh.getLastRow() >= 2) {
    var n = sh.getLastRow() - 1, v = sh.getRange(2, WU_EMAIL, n, 2).getValues();
    for (var i = 0; i < n; i++) {
      if (_cleanEmail_(v[i][0]) !== who.email) continue;
      out.parts = _wuParse_(v[i][1]);
      /* what homework counts for each part, of any version (8 Oct 2026): the page's homework colour */
      var byM = _wuPartsById_(_writeupManifest_()); out.most = {};
      Object.keys(out.parts).forEach(function (id) { out.most[id] = _wuBest_(out.parts[id], byM[id] || null); });
      break;
    }
  }
  var now = Date.now(), MONTH = 28 * 24 * 3600 * 1000;
  if (_ss_().getSheetByName(T_HOMEWORK)) _homeworkRows_().forEach(function (hw) {
    var ps = [];
    hw.tasks.forEach(function (t) { if (t.labId === WRITEUP_ID) ps = ps.concat(t.stationIds || []); });
    if (!ps.length || hw.waiting || !_hwIsFor_(hw, who.email, student.cls)) return;   /* waiting: set for a later date */
    var dms = hw.due ? new Date(hw.due).getTime() : 0;
    if (dms && now - dms > MONTH) return;              /* a month past its date: off their list */
    out.homework.push({ id: hw.id, title: hw.title, due: hw.dueText, overdue: hw.overdue, dueAt: hw.due || '', parts: ps });
  });
  out.homework.sort(function (a, b) { return String(a.dueAt).localeCompare(String(b.dueAt)); });
  return _json_(out);
}
function _writeupTeacherUrl_() {
  var u = _teacherPageUrl_();
  return u ? u.replace(/\?page=teachers$/, '?page=writeup') : '';   /* its own view since 8 Oct 2026 (was Set homework) */
}

/* The teacher page's "Write-Up" view (8 Oct 2026, Daniel: Bio English has a view and the Write-Up Lab had none): every
   pupil on the roster and, per part they have opened, [finished units at their best in any version, red-pen mistakes
   found, questions answered, right first time, 1 when the best comes from an earlier version]. The page does the sums. */
function _writeupProgressData_(now) {
  var wm = null; try { wm = _writeupManifest_(); } catch (e) { wm = null; }
  var by = _wuPartsById_(wm), dir = _studentDirectory_(now), prog = {};
  var sh = _ss_().getSheetByName(T_WRITEUP);
  if (sh && sh.getLastRow() >= 2) {
    var n = sh.getLastRow() - 1, v = sh.getRange(2, 1, n, WU_SNAP).getValues();
    for (var i = 0; i < n; i++) {
      var em = _cleanEmail_(v[i][WU_EMAIL - 1]);
      if (!em) continue;
      var kept = _wuParse_(v[i][WU_SNAP - 1]), slim = {};
      Object.keys(kept).forEach(function (id) {
        var p = by[id] || null, fit = p ? _wuFit_(kept[id], p) : kept[id], c = fit ? _wuCount_(fit, p) : null, b = _wuBestOf_(kept[id], p);
        /* found and answered are this version's; first goes with the best (an earlier version's when the best is) */
        slim[id] = [b.done, c ? c.found : 0, c ? c.answered : 0, b.old ? b.first : (c ? c.first : 0), b.old];
      });
      prog[em] = { parts: slim, at: v[i][WU_LAST - 1] ? new Date(v[i][WU_LAST - 1]).toISOString() : null };
    }
  }
  return {
    generatedAt: new Date().toISOString(), manifestOk: !!wm,
    writeup: wm ? { stages: wm.stages || [], parts: (wm.parts || []).map(function (p) {
      var marks = 0; (p.redpens || []).forEach(function (y) { marks += Number(y.n) || 0; });
      return { id: p.id, title: p.title, stage: p.stage, units: Number(p.units) || 0, marks: marks, questions: Number(p.questions) || 0 };
    }) } : null,
    students: dir.students.filter(function (s) { return !_isLeftClass_(s.cls); })
                .map(function (s) { return { name: s.name, cls: s.cls, email: s.email }; }),
    classes: dir.classes, progress: prog
  };
}

/* The Write-Up tab read once, in the shape _hwScoreOne_ reads a lab's tab: per part, the units done (red-pen marks
   found + questions answered) against the site's list. No tab yet is NOT a vanished lab — nobody has saved
   anything — so it is {} (nothing done), never null (unmarkable). */
function _writeupIndex_(need) {
  var sh = _ss_().getSheetByName(T_WRITEUP), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var by = _wuPartsById_(_writeupManifest_());
  var n = sh.getLastRow() - 1, v = sh.getRange(2, 1, n, WU_SNAP).getValues();
  for (var i = 0; i < n; i++) {
    var em = _cleanEmail_(v[i][WU_EMAIL - 1]);
    if (!em || (need && !need[em])) continue;
    var kept = _wuParse_(v[i][WU_SNAP - 1]), byId = {};
    Object.keys(kept).forEach(function (id) {
      byId[id] = { done: _wuBest_(kept[id], by[id] || null) };   /* the best of any version of the part (8 Oct 2026) */
    });
    out[em] = { byId: byId, at: v[i][WU_LAST - 1] ? new Date(v[i][WU_LAST - 1]).getTime() : 0 };
  }
  return out;
}
/* ⏱️ Homework habits, for the parts a save names (`ids`): tried = a red-pen mistake found or any answer at all
   (Learn steps opened are not a try); done = _hwScoreOne_ on the part, as the homework scorer counts it. */
function _stWuState_(kept, ids, email, man, wm) {
  var by = _wuPartsById_(wm), byId = {}, idx = {}, out = {};
  Object.keys(kept).forEach(function (id) { byId[id] = { done: _wuBest_(kept[id], by[id] || null) }; });   /* as _writeupIndex_ */
  idx[WRITEUP_ID] = {}; idx[WRITEUP_ID][email] = { byId: byId, at: 0 };
  (ids || []).forEach(function (id) {
    var x = kept[id]; if (!x) return;
    var rs = Object.keys(x.r || {}).map(function (l) { return x.r[l]; }).join('');
    out[id] = { tried: /1/.test(rs) || /[tsf1]/.test(x.q || ''),
                done: _hwScoreOne_({ tasks: [{ labId: WRITEUP_ID, stationIds: [id] }] }, email, idx, man).state === 'done' };
  });
  return out;
}

/* ── Posting homework to Google Classroom ───────────────────────────────────
   One post per class, to the course the class was imported from (the course most of its pupils
   came from). Homework for chosen pupils goes to them alone, when they share one course. The due
   date is the same instant the page shows — the end of that day in the school's zone — written in
   UTC, as Classroom wants it. */
function _classroomIds_() {
  var sh = _ss_().getSheetByName(T_STUDENTS), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var ec = _emailCol_(sh);
  var uc = _headerCol_(sh, 'Classroom user id', ec + 3), cc = _headerCol_(sh, 'Course id', ec + 4);
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(ec, uc, cc)).getValues();
  v.forEach(function (r) {
    var e = _cleanEmail_(r[ec - 1]);
    if (e) out[e] = { userId: String(r[uc - 1] || '').trim(), courseId: String(r[cc - 1] || '').trim() };
  });
  return out;
}
/* A course's pupils as Classroom itself knows them: { email: userId }, or null when it cannot be read. 5 Oct 2026: every
   reminder failed ("Precondition check failed") because the Students tab's ids were wrong. A Classroom user id has about
   21 digits; the import wrote it as a value, Sheets kept it as a number, and a number keeps only 15 digits, so the rest
   came back as zeros and named nobody in the course. Anything that names pupils to Classroom (the reminders, homework for
   chosen pupils) now takes their ids from the course's own list at that moment; `memo` keeps one read per course per run. */
function _courseRoster_(courseId, memo) {
  if (memo && (courseId in memo)) return memo[courseId];
  var out = {}, uids = {}, page = null, ok = true;   /* uids: every pupil it lists, an address or not (_freshIds_) */
  try {
    do {
      var r = Classroom.Courses.Students.list(courseId, { pageSize: 100, pageToken: page }) || {};
      (r.students || []).forEach(function (st) {
        var e = _cleanEmail_(st.profile && st.profile.emailAddress);
        if (e && st.userId) out[e] = String(st.userId);
        if (st.userId) uids[String(st.userId)] = 1;
      });
      page = r.nextPageToken;
    } while (page);
  } catch (e) { ok = false; }
  if (memo) { memo[courseId] = ok ? out : null; memo['uids ' + courseId] = ok ? uids : null; }
  return ok ? out : null;
}
/* The Students tab's ids (_classroomIds_), with every pupil of this course given the id Classroom has for them. */
function _freshIds_(ids, courseId, memo) {
  memo = memo || {};
  var ros = courseId ? _courseRoster_(courseId, memo) : null, uids = memo['uids ' + courseId] || {};
  if (ros) {
    /* a pupil the Students tab still puts in this course, whom Classroom no longer lists there (they left it, or moved and
       are not imported again yet), is not named to it: one id the course does not have fails the whole post (7 Oct 2026) */
    Object.keys(ids).forEach(function (e) { if (ids[e] && ids[e].courseId === String(courseId) && !ros[e] && !uids[String(ids[e].userId)]) ids[e] = { userId: '', courseId: '' }; });
    Object.keys(ros).forEach(function (e) { ids[e] = { userId: ros[e], courseId: String(courseId) }; });
  }
  return ids;
}
function _hwPost_(id, title, what, tasks, job, ids, opt) {
  opt = opt || {};
  try { _needClassroom_(); } catch (e) { return { ok:false, why:'Google Classroom is not switched on in the script' }; }
  var courses = {};
  (job.setFor || []).forEach(function (e) { var c = ids[e] && ids[e].courseId; if (c) courses[c] = (courses[c] || 0) + 1; });
  var cids = Object.keys(courses);
  if (!cids.length) return { ok:false, why:'nobody in it was imported from Classroom, so there is no course to post to' };
  if (cids.length > 1 && !job.cls) return { ok:false, why:'those students are in different Classroom courses — set it for each class instead' };
  var courseId = cids.sort(function (a, b) { return courses[b] - courses[a]; })[0];
  /* ONE link per lab (Daniel, 1 Oct 2026: "just one link … that's more than enough"): the lab opened at the first of its
     homework stations, and the words name every station. On 29 Sep each station had its own link, because the lab's
     front page did not show which parts were homework; the labs now colour the homework stations. Bio English Lab keeps
     its one homework link, which lists its sets. Classroom takes 20 links at most. */
  var links = _hwLinks_(id, tasks, opt.man).map(function (x) { return { link: { url: x.url } }; });
  var due = job.due, body = {
    title: title,
    description: opt.man ? _hwPostText_(id, tasks, opt.man) : what + '\n\n' + HW_SIGNIN_LINE,
    materials: links.slice(0, 20), workType: 'ASSIGNMENT', state: 'PUBLISHED',
    dueDate: { year: due.getUTCFullYear(), month: due.getUTCMonth() + 1, day: due.getUTCDate() },
    dueTime: { hours: due.getUTCHours(), minutes: due.getUTCMinutes() }
  };
  /* set for a later date: Classroom keeps the post as a draft and publishes it itself at that time (scheduledTime).
     Until then only the course's teachers see it, under Classwork, as "Scheduled". */
  if (job.start && job.start.getTime() > Date.now()) { body.state = 'DRAFT'; body.scheduledTime = job.start.toISOString(); }
  if (!job.cls) {
    var ros = _courseRoster_(courseId) || {};          /* the course's own ids: the Students tab's can be rounded */
    var uids = (job.setFor || []).map(function (e) { return ros[e] || (ids[e] && ids[e].userId); }).filter(function (x) { return !!x; });
    if (!uids.length) return { ok:false, why:'those students have no Classroom id — import them from Classroom first' };
    body.assigneeMode = 'INDIVIDUAL_STUDENTS';
    body.individualStudentsOptions = { studentIds: uids };
  }
  /* the topic, when one was asked for: found or made in this course. If that fails the post still goes, without it. */
  var topicName = '', topicWhy = '', topicMade = false;
  if (opt.topic) {
    var tp = _hwTopicId_(courseId, opt.topic);
    if (tp.id) { body.topicId = tp.id; topicName = tp.name; topicMade = !!tp.made; } else topicWhy = tp.why;
  }
  try {
    var w = Classroom.Courses.CourseWork.create(body, courseId);
    return { ok:true, courseId: courseId, courseWorkId: String(w.id), topic: topicName, topicMade: topicMade, topicWhy: topicWhy };
  } catch (e) {
    return { ok:false, why: String((e && e.message) || e).replace(/[A-Za-z0-9_-]{25,}/g, '…').slice(0, 160) };
  }
}
/* A station's own address: the lab opens the station named after its # (each lab's fromHash). */
function _hwStationUrl_(labId, sid) { return 'https://nlcsbiology.com/' + labId + '/#' + encodeURIComponent(sid); }
/* The homework's links, ONE per lab (Daniel, 1 Oct 2026): a lab opened at the FIRST of its homework stations, and Bio
   English Lab's one homework link, which lists its sets. [{ labId, name, url }], in the order the homework names the
   labs. The Classroom post and both reminders use these, so a pupil always meets the same links. */
function _hwLinks_(id, tasks, man) {
  var out = [];
  (tasks || []).forEach(function (t) {
    var lm = man && man.labs ? man.labs[t.labId] : null, sids = t.stationIds || [];
    if (t.labId === ENGLISH_ID) out.push({ labId: t.labId, name: 'Bio English Lab', url: ENGLISH_URL + '/#/hw/' + encodeURIComponent(id) });
    else if (t.labId === WRITEUP_ID) out.push({ labId: t.labId, name: 'Write-Up Lab', url: WRITEUP_URL + '/#/hw/' + encodeURIComponent(id) });
    else if (/^[a-z0-9-]+$/.test(t.labId) && sids.length) {
      out.push({ labId: t.labId, name: lm && lm.name ? String(lm.name) : t.labId, url: _hwStationUrl_(t.labId, sids[0]) });
    }
  });
  return out;
}
/* The line every homework message carries (Daniel, 2 Oct 2026: "bold sign in, Google account"). A post the script sends
   is plain text: Classroom's bold exists only for words typed in Classroom itself. So the things a pupil must not miss
   are in CAPITALS, and the post is a short heading, a numbered list of stations and numbered steps. No letters made to
   look bold (they break translation and screen readers, and many of these pupils read with a translator). */
var HW_SIGNIN_LINE = 'SIGN IN with your school GOOGLE ACCOUNT. If you do not sign in, your work is not recorded.';
/* What "finished" means, in the pupils' own words for the lab (its tabs are Learn and Practise; _hwScoreOne_ counts a
   station done when every question in it is answered). Daniel, 2 Oct 2026: the post did not say the practice questions
   must be completed, "otherwise they're not going to complete them". { labs, eng }: how many of each the homework has. */
function _hwKinds_(tasks) {
  var k = { labs: 0, eng: 0, wu: 0 };
  (tasks || []).forEach(function (t) { if (t.labId === ENGLISH_ID) k.eng++; else if (t.labId === WRITEUP_ID) k.wu++; else k.labs++; });
  return k;
}
/* What "finished" means in the Write-Up Lab (Daniel, 3 Oct 2026: every red pen and every question, IB ones too) */
var HW_WU_LINE = 'In each Write-Up Lab part, find EVERY mistake in the Red pen (each version: IGCSE, IB IA, IB EE) and answer EVERY question in Test yourself, the IB ones too. A part is done only then.';
/* The words of the Classroom post (Daniel, 1 Oct 2026): every station by the name the pupils see in the lab, and NO web
   address in the text (the post's one link per lab carries it). Since 2 Oct 2026 (Daniel: "make that message a bit more
   easy to read"): the heading, each lab's stations as a numbered list, then WHAT TO DO as numbered steps: open the link,
   sign in, answer every question in the Practise tab, and what the colours mean. A lab or station the manifest cannot
   name is written by its id, as "What" is. */
function _hwPostText_(id, tasks, man) {
  var blocks = [], k = _hwKinds_(tasks), links = _hwLinks_(id, tasks, man).length;
  tasks.forEach(function (t) {
    var lm = man && man.labs ? man.labs[t.labId] : null, nameOf = {}, en = t.labId === ENGLISH_ID, wu = t.labId === WRITEUP_ID;
    if (lm) (lm.stations || []).forEach(function (x) { nameOf[x.id] = x.name; });
    blocks.push({ name: en ? 'Bio English Lab' : wu ? 'Write-Up Lab' : (lm && lm.name ? String(lm.name) : t.labId),
                  list: ['Complete these ' + (en ? 'sets' : wu ? 'parts' : 'stations') + ':']
                    .concat((t.stationIds || []).map(function (sid, i) { return (i + 1) + '. ' + (nameOf[sid] || sid); })).join('\n') });
  });
  var out = blocks.length === 1 ? ['YOUR HOMEWORK: ' + blocks[0].name, blocks[0].list]
          : ['YOUR HOMEWORK'].concat(blocks.map(function (b) { return b.name + '\n' + b.list; }));
  var steps = [];
  if (links) steps.push(links > 1 ? 'Open the links below. There is one link for each lab. Each link opens your homework in that lab.'
                      : k.labs ? 'Open the link below. It opens the lab at your first homework station.'
                      : k.wu ? 'Open the link below. It opens your homework parts in the Write-Up Lab.'
                      : 'Open the link below. It opens your homework sets in Bio English Lab.');
  steps.push(HW_SIGNIN_LINE);
  if (k.labs) steps.push('In each homework station, open the Practise tab and answer EVERY question. A station is done only when every question is answered.');
  if (k.eng) steps.push(k.labs || k.wu ? 'In Bio English Lab, answer EVERY question in each set.'
                               : 'Answer EVERY question in each set. A set is done only when every question is answered.');
  if (k.wu) steps.push(HW_WU_LINE);
  if (k.labs) steps.push('Your homework stations are coloured: red = not started, orange = part done, green = done. You have finished when every homework station is green.');
  else if (k.wu) steps.push('Your homework parts are coloured: red = not started, orange = part done, green = done. You have finished when every homework part is green.');
  out.push('WHAT TO DO\n' + steps.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n'));
  return out.join('\n\n');
}
/* The Classroom topic called `name` in this course, made there if it is not there yet: { id, name } or { why }. Never
   throws. A topic that cannot be listed or made (the classroom.topics permission not yet allowed after a paste, or
   Classroom not answering) never stops the homework: it is posted without the topic, and the page says so. */
function _hwTopicId_(courseId, name) {
  var clean = String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, 100), want = clean.toLowerCase();
  if (!want) return { why: 'no topic was given' };
  try {
    var tok = '';
    for (var page = 0; page < 5; page++) {
      var r = Classroom.Courses.Topics.list(courseId, tok ? { pageSize: 100, pageToken: tok } : { pageSize: 100 }) || {}, hit = null;
      (r.topic || []).forEach(function (t) { if (!hit && String(t.name || '').replace(/\s+/g, ' ').trim().toLowerCase() === want) hit = t; });
      if (hit) return { id: String(hit.topicId), name: String(hit.name) };
      tok = r.nextPageToken || '';
      if (!tok) break;
    }
    var made = Classroom.Courses.Topics.create({ name: clean }, courseId);
    return { id: String(made.topicId), name: String(made.name || clean), made: true };
  } catch (e) {
    return { why: 'the topic could not be used (' + String((e && e.message) || e).replace(/[A-Za-z0-9_-]{25,}/g, '…').slice(0, 120) + ')' };
  }
}
/* The Set homework page's topic box: the topics already in the Classroom course(s) the homework would go to, newest
   first, so a teacher can pick one or type a new one (homeworkCreate makes it). Gated like every teacher call; read only;
   asked only when the box is used. { ok, topics, courses, byClass } or { ok:false, why }. `byClass` (2 Oct 2026) has one
   entry per class asked, in the same order: that class's own course's topics, so the page can give each class its own
   box and say when a typed name is new there. */
function homeworkTopics(d) {
  if (!_hwCaller_()) return { ok:false, why:'Not allowed.' };
  try { _needClassroom_(); } catch (e) { return { ok:false, why:'Google Classroom is not switched on in the script.' }; }
  d = d || {};
  var roster = _studentDirectory_().students, ids = _classroomIds_(), courses = {}, names = [], seen = {}, byClass = [];
  (d.classes && d.classes.length ? d.classes : []).forEach(function (w) {
    w = w || {};
    var cls = String(w.cls || '').trim().toUpperCase(), emails = (w.emails || []).map(_cleanEmail_).filter(function (e) { return !!e; });
    var mine = { cls: cls, course: '', topics: [] };
    byClass.push(mine);
    if (!cls && !emails.length) return;
    var count = {};
    _hwPupils_({ targets: { cls: cls, emails: emails }, setFor: null }, roster).forEach(function (p) {
      var c = ids[p.email] && ids[p.email].courseId; if (c) count[c] = (count[c] || 0) + 1;
    });
    var top = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];   /* the course _hwPost_ picks */
    if (top) { courses[top] = 1; mine.course = top; }
  });
  var cids = Object.keys(courses);
  if (!cids.length) return { ok:false, why:'Nobody in it was imported from Google Classroom, so there is no course to ask.' };
  try {
    var ofCourse = {};
    cids.forEach(function (cid) {
      var r = Classroom.Courses.Topics.list(cid, { pageSize: 100 }) || {};
      ofCourse[cid] = [];
      (r.topic || []).forEach(function (t) {
        var n = String(t.name || '').replace(/\s+/g, ' ').trim(), k = n.toLowerCase();
        if (n) ofCourse[cid].push(n);
        if (n && !seen[k]) { seen[k] = 1; names.push(n); }
      });
    });
    byClass.forEach(function (c) { c.topics = c.course ? (ofCourse[c.course] || []) : []; });
  } catch (e) {
    return { ok:false, why:'The Classroom topics could not be read (' + String((e && e.message) || e).replace(/[A-Za-z0-9_-]{25,}/g, '…').slice(0, 120) + '). You can still type a topic: if it cannot be used, the homework is posted without it.' };
  }
  return { ok:true, topics: names, courses: cids.length,
           byClass: byClass.map(function (c) { return { cls: c.cls, known: !!c.course, topics: c.topics }; }) };
}
/* The homework tab's columns by heading, as _homeworkRows_ finds them. */
function _hwHeadCols_(sh) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
               .map(function (x) { return String(x == null ? '' : x).replace(/^✎\s*/, '').trim(); });
  var c = {};
  _HW_HEADERS_.forEach(function (h, i) { var k = head.indexOf(h); c[h] = k >= 0 ? k + 1 : i + 1; });
  return c;
}

/* ── The due-date email ─────────────────────────────────────────────────────
   Every morning (📬 in the menu switches it on), each teacher is emailed a summary of their
   homework that has just fallen due: who finished, who started, who did not. Once per homework —
   the row is marked "reported" — and never for homework more than a week past its date, so
   switching it on late does not fill anybody's inbox with the whole year.
   It stays callable, as a trigger must be: it can only ever write to the teacher who set each
   homework, once, and it hands back a count. */
function sendDueSummaries() {
  var data = _homeworkData_(), sh = _ensureHomeworkTab_(), hc = _hwHeadCols_(sh), rows = {}, sent = 0;
  _homeworkRows_().forEach(function (r) { rows[r.id] = r; });
  var WEEK = 7 * 24 * 3600 * 1000, now = Date.now(), page = _teacherPageUrl_();
  data.homework.forEach(function (h) {
    var r = rows[h.id];
    if (!r || !r.overdue || r.status === 'reported' || !r.teacher) return;
    if (r.due && now - new Date(r.due).getTime() > WEEK) return;
    var lines = h.pupils.map(function (p) {
      return (p.state === 'done' ? '✓ ' : p.state === 'partly' ? '~ ' : '✗ ') +
             (p.name || '') + ' (' + (p.cls || '') + ')   ' + p.done + '/' + p.total;
    });
    var body = h.title + ' — ' + h.who + ', due ' + r.dueText + '\n' + h.what + '\n\n' +
      'Finished: ' + h.tally.done + '    Part way: ' + h.tally.partly + '    Not started: ' + h.tally.none + '\n\n' +
      (lines.join('\n') || 'Nobody on the roster matches this any more.') +
      (page ? '\n\nThe teacher page has the detail: ' + page.replace(/\?page=teachers$/, '?page=homework') : '');
    try {
      MailApp.sendEmail(r.teacher, 'Homework due: ' + h.title + ' (' + h.who + ')', body);
      sh.getRange(r.row, hc.Status).setValue('reported');
      sh.getRange(r.row, hc.Reported).setValue(new Date());
      sent++;
    } catch (e) {}
  });
  return sent;
}
function installDailySummary() {
  if (!_isAdminCaller_()) return;   /* reachable by anyone via google.script.run: it changes the project's triggers */
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDueSummaries') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDueSummaries').timeBased().everyDays(1).atHour(7).create();
  try {
    SpreadsheetApp.getUi().alert('Every morning at about 7:00, each teacher is emailed a summary of their homework that has just fallen due.');
  } catch (e) {}
}

/* ── Reminders to the pupils who have not finished (Daniel, 1 Oct 2026) ─────────────────────────────────────
   "the system should be able to calculate when the deadline is approaching and [post] an individual stream
   announcement to the specific students … to the students that have not completed it."
   Two reminders, by ONE rule for any length of homework, measured from the time it was set to its due time:
     reminder 1 when 70% of that time has passed, reminder 2 at 85%. A week's homework: about 2 days and 1 day before
     the due time; a six-hour one: about 1 h 50 and 55 minutes before.
   None is posted between 22:00 and 07:00 in the school's zone (_tz_): one that falls there goes at 07:00, if the due
   time is still more than 30 minutes away, and is skipped otherwise. None after the due time, none twice, and when both
   are due at once (the check was off, or both fell in one night) only reminder 2 goes.
   Each reminder is ONE Google Classroom announcement in the homework's own course, addressed (INDIVIDUAL_STUDENTS) to
   every student it was set for who is not "done" at that moment — worked out again by _hwScoreOne_, the rule of the
   teacher's list and of the labs' colours — and who has a Classroom user id in that course. Only they see it (and the
   course's teachers, who see every post); it names nobody. One per reminder, never one per student, so a teacher's
   stream is not flooded. What became of each reminder is written in the homework's own row: when, and to how many
   students — never a name. A failure breaks nothing: it is logged, written in the row, and the list shows it.
   The project's manifest names no scopes, so Google adds classroom.announcements because of the create call below;
   the owner allows it once (🩺 Check the set-up says when it is missing, and how). */
var HW_REMIND_AT = [0.70, 0.85];                 /* the share of the time from setting to due, for reminders 1 and 2 */
var HW_QUIET_FROM = 22, HW_QUIET_TO = 7;         /* no reminder from 22:00 until 07:00, school time */
var HW_QUIET_GAP_MS = 30 * 60 * 1000;            /* a reminder moved to 07:00 goes only if the due time is further away than this */
var HW_ANNOUNCE_SCOPE = 'https://www.googleapis.com/auth/classroom.announcements';
var HW_SENDING = 'sending…';                     /* the claim written just before the post, so two runs never post one reminder twice */
var HW_NO_PERMISSION = 'Google has not been allowed to post Classroom announcements for this script yet (🩺 Check the set-up says what to do)';
var HW_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var HW_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* 0 when `ms` is outside the quiet hours, else the 07:00 (school time) that ends them. */
function _hwQuietEnd_(ms) {
  var tz = _tz_(), h = +Utilities.formatDate(new Date(ms), tz, 'HH');
  if (h >= HW_QUIET_TO && h < HW_QUIET_FROM) return 0;
  var day = Utilities.formatDate(new Date(h >= HW_QUIET_FROM ? ms + 12 * 3600 * 1000 : ms), tz, 'yyyy-MM-dd');
  return Utilities.parseDate(day + ' ' + ('0' + HW_QUIET_TO).slice(-2) + ':00:00', tz, 'yyyy-MM-dd HH:mm:ss').getTime();
}
/* When reminder k (1 or 2) of a homework set at setMs and due at dueMs goes: { at } in ms, never in the quiet hours, or
   { skip: why }. The clock is the caller's. */
function _hwRemindTime_(setMs, dueMs, k) {
  if (!setMs || !dueMs || dueMs <= setMs) return { skip: 'the time it was set, or its due time, cannot be read' };
  var at = setMs + Math.round(HW_REMIND_AT[k - 1] * (dueMs - setMs)), moved = _hwQuietEnd_(at);
  if (!moved) return { at: at };
  if (dueMs - moved <= HW_QUIET_GAP_MS) return { skip: 'its time fell between 22:00 and 07:00, and 07:00 was too close to the due time' };
  return { at: moved, moved: true };
}
/* What to do for this homework at `now`: { k: the reminder to post now (0: none), skip: [{ k, why }] to write down }, or
   null. A skip is written only once its moment has come, so a Due changed in the tab before then still counts. */
function _hwRemindDue_(hw, now) {
  /* from when the students got it: its start, for homework set for a later date (so nothing goes before the start) */
  var setMs = _hwMs_(hw.from || hw.created), dueMs = _hwMs_(hw.due), go = 0, skip = [];
  if (!setMs || !dueMs || dueMs <= setMs) return null;
  for (var k = 1; k <= 2; k++) {
    if (hw.rem[k - 1].at) continue;                                            /* written already: never twice */
    if (now < setMs + Math.round(HW_REMIND_AT[k - 1] * (dueMs - setMs))) continue;   /* its moment has not come */
    if (now >= dueMs) { skip.push({ k: k, why: 'skipped: the due time had passed' }); continue; }
    var p = _hwRemindTime_(setMs, dueMs, k);
    if (p.skip) { skip.push({ k: k, why: 'skipped: ' + p.skip }); continue; }
    if (now < p.at) continue;                                                  /* moved to 07:00, and it is not 07:00 yet */
    var q = _hwQuietEnd_(now);                                                 /* a late run that has reached the night */
    if (q) { if (dueMs - q <= HW_QUIET_GAP_MS) skip.push({ k: k, why: 'skipped: it was night, and 07:00 was too close to the due time' }); continue; }
    go = k;
  }
  if (go === 2 && !hw.rem[0].at && !skip.some(function (s) { return s.k === 1; })) {
    skip.push({ k: 1, why: 'skipped: reminder 2 was due at the same time' });   /* two at once would only repeat each other */
  }
  return (go || skip.length) ? { k: go, skip: skip } : null;
}
/* Who reminder k goes to: { wait } when who has finished cannot be told just now (the station list could not be read:
   the next run tries again), else { ids } (Classroom user ids, none: nothing to post) and { said } for the row. */
function _hwRemindWho_(hw, pupils, ids, man, index) {
  for (var i = 0; i < hw.tasks.length; i++) {
    if (!man || !man.labs || !man.labs[hw.tasks[i].labId]) return { wait: true };
  }
  var late = 0, out = [];
  (pupils || []).forEach(function (p) {
    var s = _hwScoreOne_(hw, p.email, index, man);
    if (!s.total || s.state === 'done') return;                  /* finished, or nothing left that can be scored */
    late++;
    var c = ids[p.email];
    if (c && c.userId && c.courseId === hw.course && out.indexOf(c.userId) < 0) out.push(c.userId);   /* in the course it was posted to; each id once */
  });
  if (!late) return { ids: [], said: 'not needed: everyone had finished' };
  if (!out.length) return { ids: [], said: 'not sent: the students who have not finished are not in this Google Classroom course' };
  return { ids: out };
}
/* "Friday 3 October at 17:00": the due time in the school's zone, in English whatever the account's language. */
function _hwDueWords_(ms) {
  var d = new Date(ms), tz = _tz_(), ymd = String(Utilities.formatDate(d, tz, 'yyyy-MM-dd')).split('-');
  var wd = new Date(Date.UTC(+ymd[0], +ymd[1] - 1, +ymd[2])).getUTCDay();
  return HW_DAYS[wd] + ' ' + (+ymd[2]) + ' ' + HW_MONTHS[+ymd[1] - 1] + ' at ' + Utilities.formatDate(d, tz, 'HH:mm');
}
/* The announcement. Plain words for EAL readers, the same for both reminders; every link on its own line with nothing
   after it (a full stop glued to an address can break the station it opens), and the same links as materials. */
function _hwRemindBody_(hw, studentIds, man) {
  var links = _hwLinks_(hw.id, hw.tasks, man);
  var text = ['Reminder: your homework "' + hw.title + '" is due on ' + _hwDueWords_(_hwMs_(hw.due)) + '. You have not finished it yet.'];
  if (links.length === 1) text.push('Open it here: ' + links[0].url);
  else if (links.length) text = text.concat(['Open it here:'], links.map(function (x) { return '• ' + x.name + ': ' + x.url; }));
  /* what "finished" means, as the post says it (2 Oct 2026) */
  var k = _hwKinds_(hw.tasks);
  if (k.labs) text.push('Answer EVERY question in the Practise tab of each homework station. You have finished when every homework station is green.');
  if (k.eng) text.push((k.labs || k.wu ? 'In Bio English Lab, answer' : 'Answer') + ' EVERY question in each homework set.');
  if (k.wu) text.push(HW_WU_LINE);
  text.push(HW_SIGNIN_LINE);
  return {
    text: text.join('\n'),
    materials: links.slice(0, 20).map(function (x) { return { link: { url: x.url } }; }),
    state: 'PUBLISHED',
    assigneeMode: 'INDIVIDUAL_STUDENTS',
    individualStudentsOptions: { studentIds: studentIds }
  };
}
/* Has the script's owner allowed it to post Classroom announcements? true, false, or null when it cannot be told. */
function _hwAnnounceAllowed_() {
  try {
    var got = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL, [HW_ANNOUNCE_SCOPE]).getAuthorizedScopes();
    return got ? got.indexOf(HW_ANNOUNCE_SCOPE) >= 0 : null;
  } catch (e) { return null; }
}
/* A failed post in words for the row and the list: plain for a missing permission, and never a long id. */
function _hwWhyNot_(e) {
  var m = String((e && e.message) || e);
  if (/insufficient authentication scopes/i.test(m)) return HW_NO_PERMISSION;
  return m.replace(/[A-Za-z0-9_-]{25,}/g, '…').replace(/\d{12,}/g, '…').slice(0, 160);
}
/* Write what became of reminder k of homework `id`: the time, and the count or the reason. Under the script lock for a
   moment only (never across a Classroom call, so pupils' saves never queue behind one); the row found by its id. With
   `fresh`, nothing is written over a reminder already written — the guard that makes a reminder go once. The result of
   a post waits longer for the lock than a claim does: a reminder that went must not be left reading "sending…". */
function _hwRemindMark_(id, k, now, said, fresh) {
  var lock = null;
  try { lock = LockService.getScriptLock(); lock.waitLock(fresh ? 10000 : 30000); } catch (e) { return false; }
  try {
    var sh = _ss_().getSheetByName(T_HOMEWORK);
    if (!sh || sh.getLastRow() < 2) return false;
    _hwWiden_(sh);
    var hc = _hwHeadCols_(sh), row = 0, v = sh.getRange(2, hc.ID, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < v.length; i++) { if (String(v[i][0] || '').trim() === id) { row = i + 2; break; } }
    if (!row) return false;                                                    /* removed meanwhile */
    var atCol = hc['Reminder ' + k], toCol = hc['Reminder ' + k + ' students'];
    if (fresh && _hwMs_(sh.getRange(row, atCol).getValue())) return false;     /* another run has it */
    sh.getRange(row, atCol).setValue(new Date(now));
    sh.getRange(row, toCol).setValue(said);
    return true;
  } catch (e) {
    return false;
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
/* The trigger's work at `now` (ms). Cheap when nothing is due: one read of the Homework tab and nothing else. Only when a
   reminder is due are the roster, the station list and the lab tabs read, once for all of them. Returns how many
   announcements it posted. */
function _hwRemindRun_(now) {
  var sh = _ss_().getSheetByName(T_HOMEWORK);
  if (!sh || sh.getLastRow() < 2) return 0;                    /* nothing set (and the tab is never made here) */
  var jobs = [];
  _homeworkRows_().forEach(function (hw) {
    if (!hw.remindOn || !hw.course || !hw.courseWork) return;  /* switched off, or never posted in Classroom */
    var d = _hwRemindDue_(hw, now);
    if (d) jobs.push({ hw: hw, k: d.k, skip: d.skip });
  });
  if (!jobs.length) return 0;
  var sends = jobs.filter(function (j) { return j.k; }), posted = 0, ids = {}, man = null, index = {}, allowed = null;
  if (sends.length) {
    var roster = _studentDirectory_().students, need = {}, labIds = [];
    sends.forEach(function (j) {
      j.pupils = _hwPupils_(j.hw, roster);                     /* who it was SET for, as the list counts them */
      j.pupils.forEach(function (p) { need[p.email] = 1; });
      j.hw.tasks.forEach(function (t) { if (labIds.indexOf(t.labId) < 0) labIds.push(t.labId); });
    });
    ids = _classroomIds_(); man = _hwManifest_(); index = _hwLabIndex_(labIds, need); allowed = _hwAnnounceAllowed_();
    var memo = {};
    sends.forEach(function (j) { _freshIds_(ids, j.hw.course, memo); });   /* Classroom's own ids (5 Oct 2026) */
  }
  jobs.forEach(function (j) {
    j.skip.forEach(function (s) { _hwRemindMark_(j.hw.id, s.k, now, s.why, true); });
    if (!j.k) return;
    var who = _hwRemindWho_(j.hw, j.pupils, ids, man, index);
    if (who.wait) return;
    if (!who.ids.length) { _hwRemindMark_(j.hw.id, j.k, now, who.said, true); return; }
    var why = '';
    try { _needClassroom_(); } catch (e) { why = 'Google Classroom is not switched on in the script'; }
    if (!why && allowed === false) why = HW_NO_PERMISSION;
    if (why) {
      if (_hwRemindMark_(j.hw.id, j.k, now, 'not sent: ' + why, true)) {
        try { Logger.log('Homework reminder ' + j.k + ' for ' + j.hw.id + ' not sent: ' + why); } catch (e) {}
      }
      return;
    }
    if (!_hwRemindMark_(j.hw.id, j.k, now, HW_SENDING, true)) return;         /* another run has it: never twice */
    var said;
    try {
      Classroom.Courses.Announcements.create(_hwRemindBody_(j.hw, who.ids, man), j.hw.course);
      said = who.ids.length; posted++;
    } catch (e) {
      said = 'not sent: ' + _hwWhyNot_(e);
      try { Logger.log('Homework reminder ' + j.k + ' for ' + j.hw.id + ' ' + said); } catch (e2) {}
    }
    _hwRemindMark_(j.hw.id, j.k, now, said, false);
  });
  return posted;
}
/* The trigger, every 15 minutes (_hwReminderTrigger_ makes it). It stays callable, as a trigger must: it takes NOTHING
   from its caller (a trigger's event, or anything a page sends, is ignored), posts only the reminders due at this
   moment, each once, to the students who have not finished, and hands back how many it posted. */
function sendHomeworkReminders() {
  return _hwRemindRun_(Date.now());
}
/* The 15-minute check, made once: when homework with reminders is set or switched on, and by 🩺 when some homework wants
   it. One is kept and any extra is removed, so calling this again never makes two. true when it runs. */
function _hwReminderTrigger_() {
  try {
    var have = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'sendHomeworkReminders'; });
    for (var i = 1; i < have.length; i++) ScriptApp.deleteTrigger(have[i]);
    if (!have.length) ScriptApp.newTrigger('sendHomeworkReminders').timeBased().everyMinutes(15).create();
    return true;
  } catch (e) { return false; }
}
/* "d MMM, HH:mm" in the school's zone, for the teacher's list. */
function _hwWhen_(ms) {
  var d = new Date(ms), tz = _tz_();
  return Utilities.formatDate(d, tz, 'd MMM') + ', ' + Utilities.formatDate(d, tz, 'HH:mm');
}
/* The 🔔 of the teacher's list, worded here so the page does no clock arithmetic: { on, can (the switch may be offered:
   posted in Classroom and not yet due), says (the short line), bad (something went wrong), plan (the longer words shown
   when the homework is opened) }. "says" is '' for homework never posted and never switched on: nothing to show. */
function _hwRemindSays_(hw, now) {
  var posted = !!(hw.course && hw.courseWork), setMs = _hwMs_(hw.from || hw.created), dueMs = _hwMs_(hw.due);
  var out = { on: !!hw.remindOn, can: posted && dueMs > now, says: '', bad: false, plan: '' };
  var word = function (k) {
    var r = hw.rem[k - 1], at = _hwMs_(r.at), said = r.said;
    if (at) {
      if (/^\d+$/.test(said)) return 'sent to ' + said;
      if (said === HW_SENDING) { if (now - at > 10 * 60 * 1000) { out.bad = true; return '⚠ not sure it was sent'; } return 'sending'; }
      if (/^not sent/.test(said)) { out.bad = true; return '⚠ ' + said; }
      return said || 'done';
    }
    return dueMs && now >= dueMs ? 'not sent' : 'waiting';
  };
  var long = function (k) {
    var r = hw.rem[k - 1], at = _hwMs_(r.at);
    if (at) return 'Reminder ' + k + ': ' + (/^\d+$/.test(r.said) ? 'sent on ' + _hwWhen_(at) + ' to ' + r.said + ' pupil' + (r.said === '1' ? '' : 's')
                                                           : word(k).replace(/^⚠ /, '') + ' (' + _hwWhen_(at) + ')') + '.';
    if (dueMs && now >= dueMs) return 'Reminder ' + k + ': not sent, because the due time passed first.';
    var p = _hwRemindTime_(setMs, dueMs, k);
    return 'Reminder ' + k + ': ' + (p.skip ? 'it will be skipped: ' + p.skip
                                            : 'about ' + _hwWhen_(p.at) + ', to the pupils who have not finished then') + '.';
  };
  var done = [1, 2].filter(function (k) { return !!_hwMs_(hw.rem[k - 1].at); });
  if (!posted) {
    if (out.on) { out.says = 'no reminders: not posted in Google Classroom'; out.plan = 'No reminders: this homework was not posted in Google Classroom, and the reminders go there.'; }
    return out;
  }
  if (!out.on) {
    out.says = 'off' + (done.length ? ' (' + done.map(function (k) { return k + ': ' + word(k); }).join(' · ') + ')' : '');
    out.plan = 'Reminders are off for this homework.' + (done.length ? ' ' + done.map(long).join(' ') : '');
    return out;
  }
  out.says = '1: ' + word(1) + ' · 2: ' + word(2);
  out.plan = long(1) + ' ' + long(2);
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   ⏱️ HOMEWORK HABITS (Daniel, 1 Oct 2026, night)
   "to see when the students are completing the homework and their completion pattern … track the pattern of individual
   students over time as I set the homework … identify those students that are really not completing the homework, that
   are waiting until the last minute … if a student that usually gets very bad scores does it very fast, that raises the
   alarm." He chose part 1 only ("let's just not build the measure of the time"): NO lab is changed, and nothing here
   measures time spent working.
   1. RECORDING. Every save notes, per station (each lab tab's hidden "Station times") and per set (✍️ Bio English's
      hidden "Set times"), the FIRST time it was tried and the FIRST time it was done, inside the row's own read and
      write: not one sheet call more. "Done" is the homework scorer's own verdict (_hwScoreOne_, one station at a time,
      as the pupils' coloured stations are scored), never worked out again here. A time is when the save arrived: a lab
      saves about two minutes after the last answer, and at once when a lab or a set is finished or left. A first time
      is never changed. Something already tried or done before the times began to be kept is written as a NEGATIVE
      time: "at or before this save", the moment itself not known.
   2. THE VIEW, ⏱️ Homework habits on the teacher page (uiData('habits'), behind the same gate as every view): per
      homework and per pupil it was set for, when they finished against the time it was set and its due time; ⏰ when
      they finished after a reminder had gone to them; checks and right first time on its stations; the span "from
      first try to finish" (between two saves, never time spent working); a habit line from their last 6 homework; and
      neutral "worth a look" flags. Read only: it writes nothing, anywhere, and the page is sent no address.
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var ST_CAP = 45000;                            /* a cell holds 50,000 characters: a times cell never grows past this */

/* A Station times (or Set times) cell as { id: [tried, done] }, never a throw: a cell somebody typed in reads as empty.
   Each time is ms: positive = when the save that showed it arrived; negative = it was already so at that save, so it
   happened at or before then; 0 = not yet. */
function _stParse_(v) {
  var o = null, out = {};
  try { o = JSON.parse(String(v == null ? '' : v) || '{}'); } catch (e) { o = null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  Object.keys(o).forEach(function (k) {
    var x = o[k];
    if (!EN_SID.test(k) || !Array.isArray(x)) return;
    var t = Number(x[0]) || 0, d = Number(x[1]) || 0;
    if (isFinite(t) && isFinite(d)) out[k] = [t, d];
  });
  return out;
}
/* The next times cell: from the cell as it was, each station's state BEFORE this save and AFTER it ({ id: { tried,
   done } }) and the moment the save arrived. A first time is never changed. Something tried (or done) before this save
   that the cell does not have yet is given the save's time as a NEGATIVE number ("at or before this save"). The cell
   comes back as it was when nothing changed, or when the new one would not fit (ST_CAP): then nothing new is kept, and
   nothing kept is lost. */
function _stNext_(cell, before, after, now) {
  var map = _stParse_(cell), changed = false;
  Object.keys(after || {}).forEach(function (id) {
    if (!EN_SID.test(id)) return;
    var a = after[id] || {}, b = (before && before[id]) || {}, had = map[id] || [0, 0], x = [had[0], had[1]];
    if (!x[0] && (a.tried || a.done)) x[0] = (b.tried || b.done) ? -now : now;
    if (!x[1] && a.done) x[1] = b.done ? -now : now;
    if (x[0] !== had[0] || x[1] !== had[1]) { map[id] = x; changed = true; }
  });
  var was = String(cell == null ? '' : cell);
  if (!changed) return was;
  var txt = JSON.stringify(map);
  return txt.length <= ST_CAP ? txt : was;
}
/* Each station of a lab row as the homework scorer sees it. tried: a check or a right answer there (its Per station
   entry, "mouth 5/8 in 6"); done: _hwScoreOne_ says "done" for that station alone, on the station list `man` — the rule
   of the teacher's list, the reminders and the labs' colours. */
function _stLabState_(labId, email, perStation, man) {
  var byId = {}, idx = {}, out = {};
  _parseStations_(perStation).forEach(function (s) { byId[s.name] = s; });   /* as _hwLabIndex_ reads the tab */
  idx[labId] = {}; idx[labId][email] = { byId: byId, at: 0 };
  Object.keys(byId).forEach(function (sid) {
    var s = byId[sid];
    out[sid] = { tried: s.done > 0 || s.checks > 0,
                 done: _hwScoreOne_({ tasks: [{ labId: labId, stationIds: [sid] }] }, email, idx, man).state === 'done' };
  });
  return out;
}
/* The same for the Bio English sets a save names (`sids`), from the row's sets ({ id: { d, s, s1, b, … } }). tried: any
   answer at all (as _hasPractice_ asks); done: _hwScoreOne_ on the sets as the homework scorer counts them. */
function _stEnState_(kept, sids, email, man) {
  var byId = {}, idx = {}, out = {};
  Object.keys(kept).forEach(function (sid) { byId[sid] = { done: _enBest_(kept[sid]) }; });   /* as _englishIndex_ reads the tab */
  idx[ENGLISH_ID] = {}; idx[ENGLISH_ID][email] = { byId: byId, at: 0 };
  (sids || []).forEach(function (sid) {
    var x = kept[sid]; if (!x) return;
    out[sid] = { tried: x.d > 0 || /[1tfs]/.test(x.s + x.s1 + x.b),
                 done: _hwScoreOne_({ tasks: [{ labId: ENGLISH_ID, stationIds: [sid] }] }, email, idx, man).state === 'done' };
  });
  return out;
}

/* ── the view ─────────────────────────────────────────────────────────────────────────────────────────────────────
   The bands, measured from the time a homework was set (S) to its due time (D), in ONE place. 85% is the moment
   reminder 2 is due (HW_REMIND_AT), so "in good time" means "before the last reminder"; reminder 1 (70%) falls inside
   "in good time". */
var HW_BAND_EARLY = 0.50;                      /* early: finished by half the time */
var HW_BAND_GOOD = HW_REMIND_AT[1];            /* in good time: by 85% */
var HW_CAT_WORDS = { before: 'done before it was set', early: 'early', good: 'in good time', last: 'last minute', late: 'late',
                     none: 'not done', open: 'still open', unknown: 'finished, but when is not known' };
var HW_CAT_PLACE = { before: 0, early: 1, good: 2, last: 3, late: 4, none: 5 };   /* the key's order */
var HW_HABIT_LAST = 6, HW_HABIT_MIN = 3;       /* the habit line reads the last 6 homework with a band; fewer than 3: none */
var HW_HABIT_DAYS = 365;                        /* the view: homework due in the last year, and all that is still to come */
/* "Worth a look": under a third of the median span (at least 3 pupils with times), 90% or more right first time, and a
   low baseline: tests under 50%, or (no paper) the median right first time of at least 2 earlier finished homework. */
var HW_FLAG_SPAN = 3, HW_FLAG_PEERS = 3, HW_FLAG_RFT = 90, HW_FLAG_BASE = 50, HW_FLAG_EARLIER = 2;   /* span × 3 < median */

/* When a share of the time from S to D has passed, in ms: the same sum as the reminder times. */
function _hwBandAt_(S, D, share) { return S + Math.round(share * (D - S)); }
/* One pupil's homework in one word, at `now` (ms). S set, D due (S < D); `fin` is { at } finished then, { hi } finished
   at or before hi (the times began after it), or null (not finished). Finished before S: "done before it was set"; up
   to and including 50% of the time: "early"; up to and including 85%: "in good time"; up to and including D: "last
   minute"; after D: "late". Not finished: "not done" once D has passed, else "still open". */
function _hwHabitCat_(S, D, fin, now) {
  if (!fin) return now > D ? 'none' : 'open';
  if (fin.at === undefined) return fin.hi < S ? 'before' : 'unknown';
  var F = fin.at;
  if (F < S) return 'before';
  if (F > D) return 'late';
  if (F <= _hwBandAt_(S, D, HW_BAND_EARLY)) return 'early';
  if (F <= _hwBandAt_(S, D, HW_BAND_GOOD)) return 'good';
  return 'last';
}
/* "2 days 3 h", "5 h 10 min", "9 min", "under a minute": the span from a first try to a finish (never time spent). */
function _hwSpanWords_(ms) {
  var m = Math.round(Math.max(0, ms) / 60000);
  if (m < 1) return 'under a minute';
  if (m < 60) return m + ' min';
  var h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return h + ' h' + (mm ? ' ' + mm + ' min' : '');
  var d = Math.floor(h / 24), hh = h % 24;
  return d + ' day' + (d === 1 ? '' : 's') + (hh ? ' ' + hh + ' h' : '');
}
/* A recorded moment in words, in the school's zone: "3 Oct, 16:20"; "by 3 Oct, 16:20" when only a bound is known. */
function _hwMomentWords_(ms) {
  if (!ms) return '';
  return (ms < 0 ? 'by ' : '') + _hwWhen_(Math.abs(ms));
}
function _hwMedian_(a) {
  var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null;
}

/* The habit line: ONE phrase from a pupil's last HW_HABIT_LAST homework that have a band (still open ones, and ones
   finished before the times were kept, are left out), oldest first. The first rule that holds wins; `o` is its place
   when the view is sorted by habit (most worth a look first). "Usually the last minute" is asked before "Only after a
   reminder": a finish after 85% always comes after reminder 2 when reminders are on, so the other order would hide every
   last-minute habit. h.n: how many; h.k: how many in each band; h.r: how many
   finished after a reminder (⏰); h.older / h.newer: the mean place on the key (0 done before it was set … 5 not done)
   of the older half and the newer half. */
var HW_HABIT_RULES = [
  { say: 'Getting better', o: 5, when: 'the newer half is at least 1.5 places earlier on the key than the older half (4 or more homework)',
    test: function (h) { return h.n >= 4 && h.newer - h.older <= -1.5; } },
  { say: 'Getting worse', o: 1, when: 'the newer half is at least 1.5 places later on the key than the older half (4 or more homework)',
    test: function (h) { return h.n >= 4 && h.newer - h.older >= 1.5; } },
  { say: 'Often late or not done', o: 0, when: 'late or not done in at least half of them',
    test: function (h) { return (h.k.late + h.k.none) * 2 >= h.n; } },
  { say: 'Usually the last minute', o: 3, when: 'at the last minute in at least half of them',
    test: function (h) { return h.k.last * 2 >= h.n; } },
  { say: 'Only after a reminder', o: 2, when: 'finished after a reminder (⏰) in at least half of them, and at least twice',
    test: function (h) { return h.r >= 2 && h.r * 2 >= h.n; } },
  { say: 'Usually early', o: 7, when: 'early, or done before it was set, in at least two thirds of them',
    test: function (h) { return (h.k.before + h.k.early) * 3 >= h.n * 2; } },
  { say: 'Usually in good time', o: 6, when: 'in good time or earlier in at least two thirds of them',
    test: function (h) { return (h.k.before + h.k.early + h.k.good) * 3 >= h.n * 2; } },
  { say: 'Mixed', o: 4, when: 'none of the other patterns holds', test: function () { return true; } }
];
/* `cats`: [{ c (band), r (⏰ reminder, 0 none) }] oldest first. null with fewer than HW_HABIT_MIN. */
function _hwHabitOf_(cats) {
  var use = (cats || []).filter(function (x) { return HW_CAT_PLACE[x.c] !== undefined; }).slice(-HW_HABIT_LAST);
  if (use.length < HW_HABIT_MIN) return null;
  var h = { n: use.length, k: { before: 0, early: 0, good: 0, last: 0, late: 0, none: 0 }, r: 0, older: 0, newer: 0 };
  use.forEach(function (x) { h.k[x.c]++; if (x.r) h.r++; });
  var half = Math.floor(use.length / 2);
  var mean = function (a) { return a.reduce(function (s, x) { return s + HW_CAT_PLACE[x.c]; }, 0) / a.length; };
  h.older = mean(use.slice(0, half)); h.newer = mean(use.slice(use.length - half));
  for (var i = 0; i < HW_HABIT_RULES.length; i++) {
    var R = HW_HABIT_RULES[i];
    if (R.test(h)) {
      var said = ['before', 'early', 'good', 'last', 'late', 'none'].filter(function (c) { return h.k[c]; })
        .map(function (c) { return h.k[c] + ' ' + HW_CAT_WORDS[c]; });
      if (h.r) said.push(h.r + ' after a reminder');
      return { say: R.say, o: R.o, why: R.when + '. Their last ' + h.n + ' homework: ' + said.join(', ') + '.' };
    }
  }
  return null;
}

/* A tracker row's kind of score, from its ScoreSource: a COPY of the reflection's _scoreKind_ (its Code.gs §score-kinds,
   §40.101; Daniel's rule, three kinds of score, 1 Oct 2026). "teacher" (teacher marked) and "partly" (the teacher's
   totals, the pupil's own per-question marks) count; "self" (only the pupil's own marks) never does. Keep the two the same. */
function _scoreKind_(src) {
  var o = src;
  if (typeof o === 'string') {
    var t = o.trim();
    if (!t) return 'teacher';
    if (t.charAt(0) !== '{') return (t === 'self' || t === 'none') ? 'self' : 'teacher';
    try { o = JSON.parse(t); } catch (e) { return 'teacher'; }
  }
  if (!o || typeof o !== 'object' || !o.overall) return 'teacher';
  if (o.overall !== 'teacher') return 'self';
  return o.questions === 'self' ? 'partly' : 'teacher';
}
/* Each pupil's teacher-marked test average in the Student Progress Tracker, for the pupils in `need`: { email: { pct, n } }.
   Read by heading from the cohort tabs ("Class of NNNN"; never TEST, never Unfinished reflections), each paper once per
   pupil (the first row, as the analysis website reads it); a row with no AssessmentID is a stub and is skipped; a paper
   with no score, or whose score is the pupil's own (_scoreKind_ "self"), is left out. Three narrow reads per tab: the
   headings, Email … MaxScore, and ScoreSource. {} when there is no tracker or it cannot be read. Read only. */
function _hwBaselines_(need) {
  var out = {}, id = '', got = {}, seen = {};
  try { id = _trackerId_(); } catch (e) { id = ''; }
  if (!id || !Object.keys(need || {}).length) return out;
  try {
    var wb = SpreadsheetApp.openById(id);
    wb.getSheets().forEach(function (sh) {
      if (!/^Class of \d{4}$/.test(sh.getName())) return;
      var last = sh.getLastRow(), lc = sh.getLastColumn();
      if (last < 2 || lc < 1) return;
      var head = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h == null ? '' : h).trim(); });
      var cE = head.indexOf('Email'), cA = head.indexOf('AssessmentID'), cT = head.indexOf('TotalScore'),
          cM = head.indexOf('MaxScore'), cS = head.indexOf('ScoreSource');
      if (cE < 0 || cA < 0 || cT < 0 || cM < 0) return;
      var v = sh.getRange(2, 1, last - 1, Math.max(cE, cA, cT, cM) + 1).getValues();
      var src = cS >= 0 ? sh.getRange(2, cS + 1, last - 1, 1).getValues() : null;
      for (var i = 0; i < v.length; i++) {
        var em = _cleanEmail_(v[i][cE]);
        if (!em || !need[em]) continue;
        var aid = String(v[i][cA] == null ? '' : v[i][cA]).trim();
        if (!aid || seen[em + '|' + aid]) continue;
        seen[em + '|' + aid] = 1;
        if (_scoreKind_(src ? src[i][0] : '') === 'self') continue;
        var sc = v[i][cT], mx = parseFloat(v[i][cM]);
        if (sc === '' || sc === null || isNaN(parseFloat(sc)) || !(mx > 0)) continue;
        (got[em] = got[em] || []).push(100 * parseFloat(sc) / mx);
      }
    });
  } catch (e) { /* no tracker reading: every pupil falls back to their homework */ }
  Object.keys(got).forEach(function (em) {
    var a = got[em];
    out[em] = { pct: Math.round(a.reduce(function (s, x) { return s + x; }, 0) / a.length), n: a.length };
  });
  return out;
}
/* The times cells and the first round's letters, read once per tab, for the pupils some homework names:
   { labId: { email: { t: { id: [tried, done] }, f: { id: right first time } } } }. A lab tab is read from School email to
   Station times (its first round in between), ✍️ Bio English from School email to Set times; a tab no save has widened
   yet reads as no times. */
function _hwTimesIndex_(labIds, need) {
  var ss = _ss_(), out = {};
  labIds.forEach(function (id) {
    if (id in out) return;
    out[id] = {};
    if (id === ENGLISH_ID) {
      var en = ss.getSheetByName(T_ENGLISH);
      if (!en || en.getLastRow() < 2) return;
      en.getRange(2, EN_EMAIL, en.getLastRow() - 1, Math.min(EN_TIMES, en.getMaxColumns()) - EN_EMAIL + 1).getValues().forEach(function (r) {
        var em = _cleanEmail_(r[0]); if (!em || !need[em]) return;
        var kept = _enParse_(r[EN_SNAP - EN_EMAIL]), f = {};
        Object.keys(kept).forEach(function (sid) { f[sid] = _enBestOf_(kept[sid]).f; });   /* with the count homework reads */
        out[id][em] = { t: _stParse_(r[EN_TIMES - EN_EMAIL]), f: f };
      });
      return;
    }
    if (id === WRITEUP_ID) {                                /* 3 Oct 2026: School email to Part times */
      var wt = ss.getSheetByName(T_WRITEUP);
      if (!wt || wt.getLastRow() < 2) return;
      var byW = {}; try { byW = _wuPartsById_(_writeupManifest_()); } catch (eW) { byW = {}; }
      wt.getRange(2, WU_EMAIL, wt.getLastRow() - 1, Math.min(WU_TIMES, wt.getMaxColumns()) - WU_EMAIL + 1).getValues().forEach(function (r) {
        var em = _cleanEmail_(r[0]); if (!em || !need[em]) return;
        var kept = _wuParse_(r[WU_SNAP - WU_EMAIL]), f = {};
        Object.keys(kept).forEach(function (pid) { f[pid] = _wuBestOf_(kept[pid], byW[pid] || null).first; });   /* with the count homework reads */
        out[id][em] = { t: _stParse_(r[WU_TIMES - WU_EMAIL]), f: f };
      });
      return;
    }
    var lab = null;
    LABS.forEach(function (l) { if (l.id === id) lab = l; });
    var sh = lab ? ss.getSheetByName(lab.name) : null;
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, LAB_EMAIL, sh.getLastRow() - 1, Math.min(LAB_TIMES, sh.getMaxColumns()) - LAB_EMAIL + 1).getValues().forEach(function (r) {
      var em = _cleanEmail_(r[0]); if (!em || !need[em]) return;
      var first = _snapParse_(r[LAB_FIRST - LAB_EMAIL]), f = {};
      first.order.forEach(function (sid) { f[sid] = (first.by[sid].q.match(/f/g) || []).length; });
      out[id][em] = { t: _stParse_(r[LAB_TIMES - LAB_EMAIL]), f: f };
    });
  });
  return out;
}
/* One pupil and one homework, or null when nothing in it can be scored. The stations counted, the "done" verdict and the
   question count are the scorer's (_hwScoreOne_, each station on its own as _ownHomework_ does); the moments come from
   the times cells. { c band, r (⏰: the latest reminder that went before they finished, 0 none), k checks (null for Bio
   English only), f right first time, q questions, n lab stations, m Bio English sets, sm span ms or null, t first try,
   e finish (ms; negative = at or before; 0 = none) }. */
function _hwHabitCell_(hw, email, index, extra, man, ids, now) {
  var live = _hwScoreOne_(hw, email, index, man);
  if (!live.total) return null;
  var parts = [], k = null, f = 0, q = 0, nLab = 0, nEn = 0, nWu = 0;
  /* a Write-Up part counts red-pen marks AND questions towards done; right first time is of its questions alone */
  var wuQ = {};
  if (man && man.wu) (man.wu.parts || []).forEach(function (p) { wuQ[p.id] = Number(p.questions) || 0; });
  hw.tasks.forEach(function (t) {
    var x = (extra[t.labId] || {})[email] || { t: {}, f: {} }, idx = index[t.labId], rec = idx ? idx[email] : null;
    (t.stationIds || []).forEach(function (sid) {
      var one = _hwScoreOne_({ tasks: [{ labId: t.labId, stationIds: [sid] }] }, email, index, man);
      if (one.missing.length || !one.total) return;                       /* not scored by the list either */
      parts.push(x.t[sid] || [0, 0]);
      var qn = t.labId === WRITEUP_ID ? (wuQ[sid] || 0) : one.total;
      q += qn;
      f += Math.min(Number(x.f[sid]) || 0, qn);
      if (t.labId === ENGLISH_ID) { nEn++; return; }
      if (t.labId === WRITEUP_ID) { nWu++; return; }
      nLab++;
      var g = rec && rec.byId ? rec.byId[sid] : null;
      k = (k || 0) + (g ? Number(g.checks) || 0 : 0);
    });
  });
  if (!parts.length) return null;
  /* the first try: the earliest; only "at or before" when any station's own first try is */
  var tt = 0, tBound = 0, tExact = true;
  parts.forEach(function (p) {
    if (!p[0]) return;
    if (p[0] < 0) tExact = false;
    var a = Math.abs(p[0]);
    if (p[0] > 0 && (!tt || p[0] < tt)) tt = p[0];
    if (!tBound || a < tBound) tBound = a;
  });
  var first = tExact ? tt : (tBound ? -tBound : 0);
  /* the finish: only when the scorer says done; exact when the latest station's moment is */
  var fin = null, e = 0;
  if (live.state === 'done') {
    var lo = 0, hi = 0, all = true;
    parts.forEach(function (p) {
      if (!p[1]) { all = false; return; }
      if (p[1] > 0) lo = Math.max(lo, p[1]);
      hi = Math.max(hi, Math.abs(p[1]));
    });
    if (!all) { fin = { hi: now }; e = -now; }                             /* done, but not every moment was kept */
    else if (hi === lo) { fin = { at: lo }; e = lo; }
    else { fin = { hi: hi }; e = -hi; }
  }
  var c = _hwHabitCat_(hw.S, hw.D, fin, now);
  /* ⏰: they finished after a reminder had gone to them — it went (its row says how many it went to), they were not done
     then, and they have a Classroom user id in the course it was posted to (the reminders' own rule). Never a name. */
  var r = 0, cid = ids[email];
  if (fin && fin.at !== undefined && cid && cid.userId && hw.course && cid.courseId === hw.course) {
    for (var j = 2; j >= 1 && !r; j--) {
      var R = _hwMs_(hw.rem[j - 1].at);
      if (R && /^\d+$/.test(String(hw.rem[j - 1].said)) && R < fin.at) r = j;
    }
  }
  return { c: c, r: r, k: k, f: f, q: q, n: nLab, m: nEn, w: nWu,
           sm: (tExact && tt && fin && fin.at !== undefined) ? Math.max(0, fin.at - tt) : null, t: first, e: e };
}
/* "12 stations", "3 Bio English sets", "12 stations and 3 Bio English sets", "2 Write-Up parts" */
function _hwPartsWords_(n, m, w) {
  var a = [];
  if (n) a.push(n + ' station' + (n === 1 ? '' : 's'));
  if (m) a.push(m + ' Bio English set' + (m === 1 ? '' : 's'));
  if (w) a.push(w + ' Write-Up part' + (w === 1 ? '' : 's'));
  return a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join('');
}

/* "Worth a look", in neutral words, or '' (Daniel: "if a student that usually gets very bad scores does it very fast,
   that raises the alarm"). A reason to talk with the pupil, never a finding. All three must hold:
     · from first try to finish under a third of the median for the same homework (`med`, from at least 3 pupils with
       times; null: no flag);
     · right first time 90% or more on its stations and sets;
     · a low baseline: `base`, their teacher-marked tests average in the Student Progress Tracker (_hwBaselines_), under
       50%; with no marked paper at all, the median right first time of their EARLIER homework that they finished
       (`earlier`, at least 2), under 50%. The words say which baseline was used. */
function _hwHabitFlag_(cell, med, base, earlier) {
  if (med === null || med === undefined || cell.sm === null || cell.sm === undefined || !(cell.sm * HW_FLAG_SPAN < med)) return '';
  var rft = cell.q ? 100 * cell.f / cell.q : 0;
  if (rft < HW_FLAG_RFT) return '';
  var why = '';
  if (base) {
    if (!(base.pct < HW_FLAG_BASE)) return '';
    why = 'teacher-marked tests average ' + base.pct + '% (' + base.n + ' paper' + (base.n === 1 ? '' : 's') + ')';
  } else {
    var e = (earlier || []).filter(function (x) { return x.q && x.e; }).map(function (x) { return 100 * x.f / x.q; });
    if (e.length < HW_FLAG_EARLIER) return '';
    var m = Math.round(_hwMedian_(e));
    if (!(m < HW_FLAG_BASE)) return '';
    why = 'right first time on their earlier homework: median ' + m + '% (' + e.length + ' homework)';
  }
  return 'Finished ' + _hwPartsWords_(cell.n, cell.m, cell.w) + ' within ' + _hwSpanWords_(cell.sm) + ' of the first try (median for this homework: ' +
    _hwSpanWords_(med) + '), ' + (cell.f >= cell.q ? 'all right first time' : Math.round(rft) + '% right first time') + '; ' + why + '.';
}

/* The view's whole payload (uiData('habits')), at `now` (ms; the tests pass a fake clock). Read only. Pupils come as
   name and class: no address, no id. */
function _habitsData_(now) {
  now = now || Date.now();
  var man = _hwManifest_(), roster = _studentDirectory_().students, since = now - HW_HABIT_DAYS * 864e5, left = 0, list = [];
  /* no Homework tab: nothing set yet (and none is made here: this view only reads) */
  (_ss_().getSheetByName(T_HOMEWORK) ? _homeworkRows_() : []).forEach(function (hw) {
    if (hw.start && _hwMs_(hw.start) > now) return;                        /* set for a later date: no student has it yet */
    var S = _hwMs_(hw.from || hw.created), D = _hwMs_(hw.due);
    if (!S || !D || D <= S) { left++; return; }                            /* no due time to measure against */
    if (D < since) return;
    hw.S = S; hw.D = D; list.push(hw);
  });
  list.sort(function (a, b) { return a.D - b.D || a.S - b.S; });
  var pupilsFor = {}, need = {}, labIds = [];
  list.forEach(function (hw) {
    var ps = _hwPupils_(hw, roster);
    pupilsFor[hw.id] = ps;
    ps.forEach(function (p) { need[p.email] = 1; });
    hw.tasks.forEach(function (t) { if (labIds.indexOf(t.labId) < 0) labIds.push(t.labId); });
  });
  var index = _hwLabIndex_(labIds, need), extra = _hwTimesIndex_(labIds, need);
  var recorded = Object.keys(extra).some(function (l) {
    return Object.keys(extra[l]).some(function (em) { return Object.keys(extra[l][em].t).length > 0; });
  });
  var ids = _classroomIds_(), base = _hwBaselines_(need), who = {}, order = [];
  var hwOut = list.map(function (hw, i) {
    var spans = [];
    (pupilsFor[hw.id] || []).forEach(function (p) {
      var cell = _hwHabitCell_(hw, p.email, index, extra, man, ids, now);
      if (!cell) return;
      cell.h = i;
      if (!who[p.email]) { who[p.email] = { p: p, cells: [] }; order.push(p.email); }
      who[p.email].cells.push(cell);
      if (cell.sm !== null) spans.push(cell.sm);
    });
    hw.med = spans.length >= HW_FLAG_PEERS ? _hwMedian_(spans) : null;
    return { id: hw.id, title: hw.title, who: hw.who, set: _hwWhen_(hw.S), due: _hwWhen_(hw.D), day: _hwDueText_(hw.D),
             med: hw.med === null ? '' : _hwSpanWords_(hw.med), withTimes: spans.length };
  });
  var pupils = order.filter(function (em) { return !_isLeftClass_(who[em].p.cls); }).map(function (em) {   /* LEFT: in no class now */
    var P = who[em], cells = P.cells, b = base[em] || null, flags = [];
    cells.forEach(function (cell, j) {
      var says = _hwHabitFlag_(cell, list[cell.h].med, b, cells.slice(0, j));
      if (says) flags.push({ h: cell.h, says: says });
    });
    return {
      name: P.p.name, cls: P.p.cls,
      base: b ? 'Teacher-marked tests average ' + b.pct + '% (' + b.n + ' paper' + (b.n === 1 ? '' : 's') + ')' : '',
      habit: _hwHabitOf_(cells.filter(function (x) { return x.c !== 'open'; })),
      /* [homework, band, ⏰, checks, right first time, questions, stations, sets, span words, first try, finish] */
      cells: cells.map(function (x) {
        return [x.h, x.c, x.r, x.k, x.f, x.q, x.n, x.m, x.sm === null ? '' : _hwSpanWords_(x.sm), _hwMomentWords_(x.t), _hwMomentWords_(x.e)];
      }),
      flags: flags
    };
  });
  return {
    generatedAt: new Date(now).toISOString(), recorded: recorded, left: left, manifestOk: !!man.labsOk,
    bands: { early: Math.round(HW_BAND_EARLY * 100), good: Math.round(HW_BAND_GOOD * 100) },
    words: HW_CAT_WORDS,
    habits: HW_HABIT_RULES.map(function (R) { return { say: R.say, when: R.when }; }),
    flagWords: 'Worth a look: a homework finished in under a third of the median time from first try to finish for it, with ' +
      HW_FLAG_RFT + '% or more right first time, by a pupil whose teacher-marked tests average under ' + HW_FLAG_BASE + '% (with no ' +
      'marked test: the median right first time of their earlier homework). A reason to talk with them, never proof of anything.',
    homework: hwOut, pupils: pupils
  };
}
