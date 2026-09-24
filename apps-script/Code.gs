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
 *      Then + (next to Files) ▸ HTML ▸ name it exactly  ClassroomImport
 *      and paste apps-script/ClassroomImport.html into it. Save.
 *      (For the teacher page, add a second HTML file named exactly  TeacherPage
 *       with apps-script/TeacherPage.html — only needed if you use the teacher page.)
 *   4. Services (+) ▸ Classroom ▸ Add.        (needed for the roster import)
 *   5. Run ▸ setup. Authorise when asked. It builds and styles every tab.
 *   6. Deploy ▸ New deployment ▸ Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Deploy, copy the /exec URL, and paste it into each lab's js/config.js
 *      as submitUrl. One URL, all labs.
 *
 * AFTER ANY EDIT to this file: Deploy ▸ Manage deployments ▸ pencil ▸
 * Version: New version ▸ Deploy. Editing alone changes nothing.
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
   teacher-page deployment. You do not have to edit these by hand: 🧪 Biology Labs ▸ 🔗 Teacher page
   manages both from a window. See "The teacher page" below. */
var TEACHERS          = '';
var TEACHER_PAGE_URL  = '';

/* Open-a-student's-tracker — optional. TRACKER_APP_URL is the /exec address of ANY one of the
   reflection deployments (they all show the same collated tracker). With it set, the teacher page
   grows a "Students" tab: pick a pupil, click, and their own reflection tracker opens — the same
   page they see, which only their teachers may open for them. You do not have to edit this by hand:
   🧪 Biology Labs ▸ 🔗 Teacher page manages it too. Empty = no Students tab. */
var TRACKER_APP_URL   = '';

/* Set homework — optional. HUB_URL is the address of your hub site — the address that serves its
   index.html. Mind the path: a GitHub Pages project site usually sits in a SUB-FOLDER, so it is
   https://nlcsbiology.com/biology-hub (not https://nlcsbiology.com). If in doubt, open
   <that address>/js/data/labs.json in a browser: if it does not load, the address is wrong.
   It is read ONLY to fetch the public station list
   (js/data/stations.json: station names and question counts, nothing personal), which is what lets
   a teacher pick parts of a lab to set. Empty = the Set homework page explains it needs this. */
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
   A page for teachers only, holding the address of every spreadsheet in the Assessment
   Reflection System — each assessment's own, the test copies, the tracker. On the Biology Hub a
   teacher in teacher mode reaches it through the door where a student finds "My assessments".

   It is guarded twice, and neither guard is anything in the public website:
     1. Google. The page is served by a SECOND deployment of this script, whose access is
        "Anyone within" your school, so Google signs the visitor in with their school account
        before a line of this script runs. A sign-in copied out of a web page is no use there:
        what opens it is Google's own sign-in, which no page can read.
     2. This script. It asks Google who is visiting and shows the links only to an address on
        TEACHERS below — and to you, the owner, always. Everybody else, pupils and other staff
        alike, is told who the page is for and sees nothing more.
   The links live in a tab of THIS spreadsheet, "🔗 Teacher links", so only the people you have
   shared this spreadsheet with can see or change them.

     TEACHERS          other teachers' school addresses, separated by commas. Type  none  to take
                       everybody but you off (an empty line keeps the list you saved before).
     TEACHER_PAGE_URL  the /exec address of that second deployment. The hub is handed it only when
                       a signed-in teacher on the list asks; it is never written into the website.

   🧪 Biology Labs ▸ 🔗 Teacher page makes the tab and walks through the rest. Like
   TRACKER_ID, a value typed in SETTINGS at the top is kept in Script Properties, and neither belongs in the
   public GitHub copy.
   -------------------------------------------------------------------------- */

/* Every lab that saves here. `id` is what the site sends as `app`; `tab` is the
   tab it is written to. Add a row here (or in the Labs tab) as each lab is built.
   `questions` MUST match what the lab actually asks — it flags a save as NOT ALL
   QUESTIONS, so a number that is too low flags every save. The counts are
   kept in labs-shared/labs.json, written by each lab's own build. */
var LABS = [
  { id:'classification-lab',  name:'Classification',   topic:'1 · Characteristics and classification', questions:64 },
  { id:'cells-lab',           name:'Cells',            topic:'2 · Organisation of the organism',   questions:0 },
  { id:'cell-transport-lab',  name:'In and out of cells', topic:'3 · Movement into and out of cells', questions:0 },
  { id:'molecules-lab',       name:'Molecules',        topic:'4 · Biological molecules',           questions:0 },
  { id:'enzymes-lab',         name:'Enzymes',          topic:'5 · Enzymes',                        questions:0 },
  { id:'digestion-lab',       name:'Digestion',        topic:'7 · Human nutrition',                questions:123 },
  { id:'circulation-lab',     name:'Circulation',      topic:'9 · Transport in animals',           questions:0 },
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
  { h:'Class', w:80, align:'center', note:'From the Students tab. Move somebody between classes there and it follows them into every lab.' },
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
    note:'Which questions they had right, so signing in on another computer brings their work back. About 370 characters, written by the lab. Not marks — the marks are in the columns you can see. Do not edit.' }
];
var LAB_EMAIL = 15;
var LAB_GNAME = 16;        /* the column that ties a row to a person */
var LAB_SNAP  = 17;        /* appended, so the two above keep their positions */

/* ---- Signing in ----------------------------------------------------------
   The labs are public web pages: anyone in the world can open one, work through it and
   work through it. That is the point — but their work must not land in your spreadsheet.
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
     The full version of this is in the README, under "Sign-in: what the Client ID is".

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
    .addItem('🔗  Teacher page — teachers, links, address', 'showTeacherPanel')
    .addItem('📬  Email me when homework falls due (every morning)', 'installDailySummary')
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

    /* And whether they have a reflection record waiting for them. Also read-only, also
       only ever their own. */
    if (String(d.action || '') === 'record') return _ownRecord_(d);

    /* And when their own test opens, and the way in. Read-only, their own only. */
    if (String(d.action || '') === 'test') return _ownTest_(d);

    /* Bio English Lab saves a pupil's work as they go, and asks for it back on another computer.
       Neither is lab work, so both are answered here, before anything treats this as a lab. */
    if (String(d.action || '') === 'english.save') return _englishSave_(d);
    if (String(d.action || '') === 'english.mine') return _englishMine_(d);

    var lab = _labById_(String(d.app || ''));
    if (!lab) return _text_('unknown lab');

    /* Only this teacher's students are recorded. Anyone else in the world who works through
       a lab leaves no trace here at all — no row, no name, no email, nowhere. */
    if (!_clientId_()) return _text_('not recorded: sign-in is not set up');
    var who = _whoIs_(d.token);
    if (!who) return _text_('not recorded: not signed in');
    var student = _studentOf_(who.email);
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
                    wrong.join('; '), _plain_(JSON.stringify(d).slice(0, 2000))]);
      return _text_('rejected: ' + wrong.join('; '));
    }

    var flags = [];
    if (lab.questions && total !== lab.questions) flags.push('NOT ALL QUESTIONS');
    if (d.complete === false) flags.push('PROGRESS — not finished');

    /* Their row is already waiting, put there when the class was imported. The first save
       fills it in; every later one updates it rather than adding another. The count and the
       date always move, and the marks are replaced only when this save beat the last one, so
       a worse run can never wipe out a better score. The carried snapshot is MERGED, never
       replaced: a save from a second device that knows less cannot take a right answer away.
       Forty students save within the same minute, so the read-then-write takes turns — and it
       is one read and one write of the row, so a turn is short. */
    var lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (e) { return _text_('busy — it will try again'); }
    try {
      var sh = _labSheet_(lab);
      var lastBefore = sh.getLastRow();
      var r = _rowFor_(sh, who.email, student);
      var row = sh.getRange(r, 1, 1, LAB_COLS.length).getValues()[0];
      var best = Number(row[2]);
      var beaten = !(best > 0) || score > best;
      var seen = Number(row[9]) || 0;

      row[0] = student.name; row[1] = student.cls;
      row[LAB_GNAME - 1] = _plain_(who.name);
      if (d.snap) row[LAB_SNAP - 1] = _plain_(_mergeSnap_(String(row[LAB_SNAP - 1] || ''), String(d.snap).slice(0, 45000)));
      row[9] = seen + 1; row[10] = new Date();
      if (beaten) {
        row[2] = score; row[3] = total; row[4] = total ? score / total : 0;
        row[5] = d.complete === false ? 'progress' : 'complete';
        row[6] = Number(d.checks) || ''; row[7] = Number(d.firstTime) || ''; row[8] = _since_(d.from);
        row[12] = flags.join('; '); row[13] = _plain_(_stations_(d.stations));
      }
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

/* Two snapshots of the same lab, folded into one: station~sig:cccc|… (see labs-shared/engine/
   sync.js). Per question the higher state wins — 0 untouched < t tried < 1 right < f right first
   time — so a save from a device that knows less can never take a right answer away. A station
   whose fingerprint changed is taken from the newer snapshot, which is the one the live lab made. */
function _mergeSnap_(oldSnap, newSnap) {
  if (!oldSnap) return newSnap;
  if (!newSnap) return oldSnap;
  var RANK = { '0': 0, 't': 1, '1': 2, 'f': 3 };
  var parts = {}, order = [];
  function add(snap, fresh) {
    String(snap).split('|').forEach(function (part) {
      var m = part.match(/^([^~:]+)~([^:]*):([01tf]*)$/); if (!m) return;
      var id = m[1], sig = m[2], q = m[3], have = parts[id];
      if (!have) { parts[id] = { sig: sig, q: q }; order.push(id); return; }
      if (have.sig !== sig) { if (fresh) parts[id] = { sig: sig, q: q }; return; }
      var out = '', len = Math.max(have.q.length, q.length);
      for (var i = 0; i < len; i++) {
        var a = have.q.charAt(i) || '0', b = q.charAt(i) || '0';
        out += (RANK[b] || 0) > (RANK[a] || 0) ? b : a;
      }
      have.q = out;
    });
  }
  add(oldSnap, false);
  if (!order.length) return newSnap;                    /* nothing readable to merge into: the new one stands */
  var known = order.length;
  add(newSnap, true);
  if (order.length === known && !/~/.test(newSnap)) return oldSnap;   /* the new one carries no stations: keep what is there */
  return order.map(function (id) { return id + '~' + parts[id].sig + ':' + parts[id].q; }).join('|');
}

/* A cell given text that starts with = + - or @ reads it as a formula, and a formula can reach
   out of the sheet — IMAGE, IMPORTXML — the moment the teacher opens it. Everything a page sends
   is written through this, so it always lands as the text it is. */
function _plain_(v) {
  var s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

/* Junk, and anything that does not verify, lands here instead of in a lab's tab. */
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
function _studentOf_(email) {
  if (!email) return null;
  var sh = _sheet_(T_STUDENTS), last = sh.getLastRow();
  if (last < 2) return null;
  var EMAIL_COL = _emailCol_(sh);
  var vals = sh.getRange(2, 1, last - 1, EMAIL_COL).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (_cleanEmail_(vals[i][EMAIL_COL - 1]) === email) {
      return { name: String(vals[i][0] || ''), cls: String(vals[i][1] || '').toUpperCase() };
    }
  }
  return null;
}

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
  /* All four teacher views are ONE page now: the tabs swap in the browser instead of loading a
     new document, so nothing flickers, the header never moves, and no link ever tries to open
     script.google.com inside the sandbox frame. The old ?page= values still work — each simply
     decides which tab opens first, so every bookmark and the hub's own door keep working. */
  if (page === 'teachers' || page === 'progress' || page === 'students' || page === 'homework' ||
      page === 'english') {
    return _teacherAppPage_(page);
  }
  return _text_('Biology Labs endpoint is running.');
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
  if (!_isAdminCaller_()) return { courses: [], have: {} };   /* google.script.run reaches ANY function without a trailing underscore */
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

  /* how many students each class already has here, so the dialog can say so */
  var have = {}, rows = _sheet_(T_STUDENTS).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var cls = String(rows[i][1] || '').toUpperCase();
    if (cls) have[cls] = (have[cls] || 0) + 1;
  }
  return { courses: courses, have: have };
}

function executeBatchImportAll(sels, jobId) {
  if (!_isAdminCaller_()) return [{ status: 'refused' }];   /* google.script.run reaches ANY function without a trailing underscore */
  _needClassroom_();
  var results = [];
  sels.forEach(function (s) { results.push({ status: 'pending' }); });
  _publish_(jobId, results, false);

  sels.forEach(function (s, i) {
    try {
      var students = [], page = null;
      do {
        var r = Classroom.Courses.Students.list(s.courseId, { pageSize: 100, pageToken: page });
        (r.students || []).forEach(function (st) {
          students.push({
            name: st.profile.name.fullName,
            email: _cleanEmail_(st.profile.emailAddress),
            userId: st.userId
          });
        });
        page = r.nextPageToken;
      } while (page);

      if (!students.length) results[i] = { status: 'empty', added: 0, skipped: 0 };
      else results[i] = _upsertStudents_(students, s.classCode, s.courseName, s.courseId);
    } catch (err) {
      results[i] = { status: 'error', error: String(err).slice(0, 120) };
    }
    _publish_(jobId, results, false);
  });

  /* An import is the first thing anyone does, so it leaves the spreadsheet finished: every
     tab that should exist exists and the whole thing is dressed. That part takes far longer
     than fetching the names, and it used to run AFTER the dialog had been told the job was
     done — so the window sat there looking finished while the script worked on in silence,
     and nothing could be seen happening for a minute or more. The dialog is now told the
     truth: still working, and what it is working on. */
  _publish_(jobId, results, false, 'Names imported. Building and formatting every tab\u2026');
  _PROGRESS_JOB = { id: jobId, results: results };
  try { _buildAndStyle_(); } finally { _PROGRESS_JOB = null; }
  _publish_(jobId, results, true, 'Finished.');
  return results;
}

function getBatchImportProgress(jobId) {
  if (!_isAdminCaller_()) return null;   /* google.script.run reaches ANY function without a trailing underscore */
  var raw = CacheService.getScriptCache().get('BATCH_IMPORT_' + jobId);
  return raw ? JSON.parse(raw) : null;
}
function _publish_(jobId, results, done, phase) {
  try {
    CacheService.getScriptCache().put('BATCH_IMPORT_' + jobId,
      JSON.stringify({ results: results, done: done, phase: phase || '' }), 600);
  } catch (e) {}
}

/* Add the ones we do not have; update the class of the ones we do. Never duplicates:
   the key is the school email. */
function _upsertStudents_(students, classCode, courseName, courseId) {
  var sh = _sheet_(T_STUDENTS);
  var EMAIL_COL = _emailCol_(sh);
  var rows = sh.getDataRange().getValues();
  var seen = {}, rowOf = {};
  for (var i = 1; i < rows.length; i++) {
    var em = _cleanEmail_(rows[i][EMAIL_COL - 1]);
    if (em) { seen[em] = true; rowOf[em] = i + 1; }
  }
  var add = [], skipped = 0, moved = 0, now = new Date();
  students.forEach(function (st) {
    if (st.email && seen[st.email]) {
      var r = rowOf[st.email];
      if (String(sh.getRange(r, 2).getValue()).toUpperCase() !== classCode) {
        sh.getRange(r, 2).setValue(classCode); moved++;
      }
      skipped++;
      return;
    }
    add.push([st.name, classCode, st.email, courseName, now, st.userId, courseId]);
  });
  if (add.length) {
    var at = sh.getLastRow() + 1;
    _room_(sh, at + add.length - 1);
    sh.getRange(at, 1, add.length, 2).setValues(add.map(function (a) { return [a[0], a[1]]; }));
    sh.getRange(at, EMAIL_COL, add.length, 5).setValues(add.map(function (a) { return a.slice(2); }));
  }
  /* Their names go into every lab straight away, so each tab reads as a class list with the
     marks still to come, rather than filling up only as work arrives. */
  if (add.length || moved) LABS.forEach(function (l) { _seedLab_(l); });
  return { status: 'success', added: add.length, skipped: skipped, moved: moved };
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

/* ============================================================
   4. Marks into Google Classroom
   Classroom only lets a script grade work that the same script created, so the
   assignment has to be made from here. One per lab; the id is kept in Labs.
   ============================================================ */
function createAssignmentFor_(labId, courseId) {
  _needClassroom_();
  var lab = _labById_(labId);
  if (!lab) throw new Error('Unknown lab: ' + labId);
  var work = Classroom.Courses.CourseWork.create({
    title: lab.name + ' Lab — Topic ' + lab.topic.split(' ')[0],
    description: 'Work through every station in the lab. Signed in, your work is saved as you go.',
    materials: [{ link: { url: 'https://nlcsbiology.com/' + lab.id + '/' } }],
    workType: 'ASSIGNMENT', state: 'PUBLISHED',
    maxPoints: lab.questions || 100
  }, courseId);
  Logger.log('Created "' + work.title + '" in course ' + courseId + ' — id ' + work.id);
  return work.id;
}

function pushGradesFor_(labId, courseId, courseWorkId) {
  _needClassroom_();
  var lab = _labById_(labId);
  if (!lab) throw new Error('Unknown lab: ' + labId);
  var sh = _ss_().getSheetByName(lab.name);
  if (!sh || sh.getLastRow() < 2) throw new Error('Nothing in the ' + lab.name + ' tab yet.');

  /* Match on school email — the same thing the work was recorded against — and fall
     back to the name only for anyone Classroom gives no email for. */
  var byEmail = {}, byName = {}, page = null;
  do {
    var r = Classroom.Courses.Students.list(courseId, { pageSize: 100, pageToken: page });
    (r.students || []).forEach(function (s) {
      var em = _cleanEmail_((s.profile || {}).emailAddress);
      if (em) byEmail[em] = s.userId;
      byName[_tidy_(s.profile.name.fullName)] = s.userId;
    });
    page = r.nextPageToken;
  } while (page);

  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, LAB_COLS.length).getValues();
  var done = 0, missing = [], waiting = 0;
  rows.forEach(function (row) {
    var score = row[2];
    if (score === '' || score === null) { waiting++; return; }   /* nothing saved yet */
    var name = String(row[0] || ''), email = _cleanEmail_(row[LAB_EMAIL - 1]);
    var uid = byEmail[email] || byName[_tidy_(name)];
    if (!uid) { missing.push(name); return; }
    var subs = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, courseWorkId, { userId: uid });
    var sub = (subs.studentSubmissions || [])[0];
    if (!sub) { missing.push(name + ' (no submission)'); return; }
    Classroom.Courses.CourseWork.StudentSubmissions.patch(
      { assignedGrade: Number(score), draftGrade: Number(score) },
      courseId, courseWorkId, sub.id, { updateMask: 'assignedGrade,draftGrade' });
    done++;
  });
  var said = 'Graded ' + done + '. Nothing saved yet: ' + waiting +
             '. Not matched: ' + (missing.join(', ') || 'none');
  Logger.log(said);
  return said;
}

/* Tells you, in one box, which of the five set-up steps are done. */
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
               'on pasting a fresh copy of the script cannot lose it. See “Sign-in: what the ' +
               'Client ID is” in the README.');
  } else if (!/\.apps\.googleusercontent\.com$/.test(cid)) {
    lines.push('❌  CLIENT_ID does not look like a Client ID — it should end ' +
               '.apps.googleusercontent.com. This looks like something else was pasted in.');
  } else {
    lines.push('✅  sign-in is set up (…' + cid.slice(-32) + ')' +
               (CLIENT_ID ? '' : ' — remembered from an earlier paste, the line above is empty'));
    lines.push('•  the SAME id must also be googleClientId in every lab\'s js/config.js, or ' +
               'that lab can never record anything.');
  }

  if (openOk) {
    lines.push('•  students imported: ' + Math.max(0, _sheet_(T_STUDENTS).getLastRow() - 1));
    var built = LABS.filter(function (l) { return _ss_().getSheetByName(l.name); }).length;
    lines.push('•  lab tabs so far: ' + built + ' of ' + LABS.length);
  }

  /* The record card on the hub. Optional, so silence here is not a fault — but if it IS
     filled in, it is worth proving the workbook opens and the cohort tabs are there,
     because the card's own way of failing is a quiet "could not check just now" that says
     nothing about which of the two is wrong. */
  /* The two newer addresses. Both are typed by hand, both are easy to confuse with a spreadsheet
     link, and both fail SILENTLY when wrong — the page simply does not appear — so say so here. */
  var rawTracker = String(_keptSetting_(TRACKER_APP_URL, 'TRACKER_APP_URL') || '').trim();
  if (!rawTracker) {
    lines.push('•  the Students tab is off. TRACKER_APP_URL is empty. It wants the /exec address of ' +
               'one of your REFLECTION deployments — not a spreadsheet link.');
  } else if (!_trackerAppUrl_()) {
    lines.push('❌  TRACKER_APP_URL is not a web-app address, so the Students tab will not appear. ' +
               'It must be the reflection system\u2019s /exec address (https://script.google.com/…/exec). ' +
               'What is there now starts "' + rawTracker.slice(0, 44) + '…" — that looks like a ' +
               'spreadsheet, which is TRACKER_ID\u2019s job, not this one.');
  } else {
    lines.push('✅  the Students tab is on.');
  }
  var rawHub = String(_keptSetting_(HUB_URL, 'HUB_URL') || '').trim();
  if (!rawHub) {
    lines.push('•  Set homework is off. HUB_URL is empty; it wants your hub\u2019s address, usually a ' +
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
    lines.push('•  the teacher page is off. 🧪 Biology Labs ▸ 🔗 Teacher page sets it up.');
  } else {
    lines.push(tpUrl ? '✅  teacher page address is set'
                     : '❌  TEACHER_PAGE_URL is empty or is not a web-app /exec address — see 🔗 Teacher page');
    lines.push('•  teachers who can open it: you (' + (_owner_() || 'the owner') + ')' +
               (_teacherEmails_().length ? ' and ' + _teacherEmails_().length + ' more' : ' only'));
    var tpLinks = 0;
    try { tpLinks = _teacherLinksRaw_().length; } catch (e) {}
    lines.push(tpTab ? '•  links on it: ' + tpLinks : '❌  no “' + T_LINKS + '” tab — 🔗 Teacher page makes it');
  }
  /* Bio English Lab: its set list comes from the public site, so an unreachable site means
     English homework cannot be scored — worth saying, never a fault in the labs. */
  var enMan = null;
  try { enMan = _englishManifest_(); } catch (e) {}
  lines.push(enMan ? '✅  Bio English Lab: its ' + (enMan.sets || []).length + ' sets can be read'
                   : '❌  Bio English Lab: ' + ENGLISH_URL + '/data/sets.json could not be read, so English homework cannot be scored just now');
  var dailyOn = false;
  try { dailyOn = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sendDueSummaries'; }); } catch (e) {}
  lines.push(dailyOn ? '✅  the due-date email goes out every morning'
                     : '•  the due-date email is off. 📬 in this menu switches it on.');
  lines.push('');
  lines.push('Remember: editing this script changes nothing until Deploy ▸ Manage deployments ▸ pencil ▸ New version ▸ Deploy.');

  SpreadsheetApp.getUi().alert('Biology Labs — set-up', lines.join('\n\n'), SpreadsheetApp.getUi().ButtonSet.OK);
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
  _sheet_(T_SETUP); _sheet_(T_LABS); _sheet_(T_STUDENTS);
  _step_('Repairing the Students tab: repeated, unused and untidy columns…');
  notes = notes.concat(_repairStudentSheet_());     /* repeated, stray and dirty columns first */
  var added = _repairStudentColumns_();             /* a lab added since this sheet was built gets its column */
  if (added) notes.push(added + ' new lab column' + (added === 1 ? '' : 's') +
                        ' added to the Students tab.');
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
  _step_('Making the homework and teacher tabs…');
  try { _ensureHomeworkTab_(); } catch (e) {}
  try { _englishSheet_(); } catch (e) {}
  try { _ensureTeacherTabs_(); } catch (e) {}
  _step_('Putting the buttons back on the Setup tab…');
  _installButtons_();
  restyleAll_();
  _step_('Working out everyone\u2019s progress…');
  refreshDashboard();
  _step_('Putting the tabs in syllabus order…');
  _orderTabs_();                     /* left to right, topic 1 to topic 21 */
  return notes;
}

function setup() {
  if (!_isAdminCaller_()) return;   /* reachable by anyone via google.script.run: these are expensive owner-privileged writes */
  var notes = _buildAndStyle_();
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
  _step_('Formatting the homework and teacher tabs…');
  [[T_HOMEWORK, _hwColDefs_(), '#F59E0B'],
   [T_TEACHERS, null, null],
   [T_LINKS, null, null]].forEach(function (t) {
    var sh = _ss_().getSheetByName(t[0]);
    if (!sh || !t[1]) return;
    _dress2_(sh, t[1], { tab: t[2] });
  });
  var en = _ss_().getSheetByName(T_ENGLISH);
  if (en) _dress2_(en, ENGLISH_COLS, { tab: EN_TAB, freezeCols: 2 });
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
var HDR_SOON = '#5C8A72';     /* a lab that does not exist yet */
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
      if (v && !out[v]) { out[v] = 1; list.push(v); }
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
    ['Labs', 'one row per lab: how many questions it has, and how many saves it has had.'],
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
    ['After editing the script', 'Deploy ▸ Manage deployments ▸ pencil ▸ Version: New version ▸ Deploy']
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
    _btnSays_(row, '✅  ' + did + ' at ' + _hhmm_(new Date()) + ' (took ' + secs + 's)');
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
    .setFontColor(text.indexOf('❌') === 0 ? '#A3342A' : (text.indexOf('⏳') === 0 ? '#7A5B00' : '#265C33'))
    .setFontWeight('bold').setVerticalAlignment('middle').setWrap(false);
}

function _styleStudents_() {
  var sh = _sheet_(T_STUDENTS);
  var built = {};
  LABS.forEach(function (l) { built[l.id] = !!_ss_().getSheetByName(l.name); });

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
  _labOrderOnSheet_(sh).forEach(function (l, i) {
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
  cols.push({ h:'Classroom user id', w:160, hide:true, note:'Needed to push marks back into Classroom.' });
  cols.push({ h:'Course id', w:140, hide:true, note:'Needed to push marks back into Classroom.' });

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
  LABS.forEach(function (l, i) {
    if (built[l.id]) return;
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenCellEmpty()
      .setBackground('#F2F2EF').setRanges([sh.getRange(2, first + i, rows, 1)]).build());
  });
  sh.setConditionalFormatRules(rules);
}

/* The dashboard: every student, every lab, best score so far. Written as values rather than
   formulas, so nothing shows #REF for a lab that has no tab yet — the column is simply empty
   until that lab is used. */
/* The dashboard: every student, every lab, best score so far. Read straight out of each
   lab's tab, which now holds one row per student — so a name is matched by email, not by
   how it was typed. */
function refreshDashboard() {
  if (!_isAdminCaller_()) return;   /* reachable by anyone via google.script.run: these are expensive owner-privileged writes */
  var sh = _sheet_(T_STUDENTS);
  var rows = Math.max(0, sh.getLastRow() - 1);
  if (!rows) { _styleStudents_(); return; }

  var EMAIL_COL = _emailCol_(sh);
  var emails = sh.getRange(2, EMAIL_COL, rows, 1).getValues();
  var rowOf = {};
  emails.forEach(function (r, i) { var e = _cleanEmail_(r[0]); if (e) rowOf[e] = i; });

  var L = LABS.length, first = 3;
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

  sh.getRange(2, first, rows, L + 2).setValues(grid);
  _styleStudents_();
  SpreadsheetApp.getActive().toast('Progress updated for ' + rows + ' students.', 'Biology Labs', 5);
}


function _styleLabs_() {
  var sh = _sheet_(T_LABS);
  _dress2_(sh, [
    { h:'Lab id', w:170, note:'What the lab\'s own page sends. Do not change it — it has to match js/config.js in that lab.' },
    { h:'Lab', w:130, note:'The name of this lab\'s tab in this spreadsheet.' },
    { h:'Topic', w:200, note:'Which IGCSE topic it covers.' },
    { h:'Questions', w:100, align:'center', fmt:'0', edit:true,
      note:'How many questions that lab has. Used to flag a save that does not cover them all. Fill it in when a lab is built.' },
    { h:'Saves', w:100, align:'center', fmt:'0', note:'How many saves that lab has had. Counted for you.' }
  ], { freezeCols: 2, tab:'#6E8F7C' });
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
    sh.getRange(1, 1, 1, 5).setValues([['Lab id', 'Lab', 'Topic', 'Questions', 'Saves']]);
    var rows = LABS.map(function (l, i) {
      return [l.id, l.name, l.topic, l.questions || '',
              '=IFERROR(COUNTA(INDIRECT("\'"&B' + (i + 2) + '&"\'!B2:B")),0)'];
    });
    sh.getRange(2, 1, rows.length, 5).setValues(rows);
  } else if (name === T_STUDENTS) {
    var head = ['Name', 'Class'].concat(LABS.map(function (l) { return l.name; }))
               .concat(['Labs started', 'Average', 'School email', 'Classroom course',
                        'Imported', 'Classroom user id', 'Course id']);
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
         .concat(['Labs started', 'Average', 'School email', 'Classroom course',
                  'Imported', 'Classroom user id', 'Course id']);
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

  /* 1. the same heading twice. The leftmost is the real one — it is where the script writes. */
  var head = heads(), firstAt = {}, dupes = [];
  head.forEach(function (h, i) {
    if (!h) return;
    if (firstAt[h] === undefined) firstAt[h] = i; else dupes.push(i + 1);
  });
  if (dupes.length) dropEmpty(dupes, 'repeated');

  /* 2. a heading this script no longer knows: a lab taken out of LABS, a renamed lab under its
        old name, or something typed in by hand. */
  head = heads();
  var known = _studentHeadings_(), strays = [];
  head.forEach(function (h, i) { if (h && known.indexOf(h) < 0) strays.push(i + 1); });
  if (strays.length) dropEmpty(strays, 'unrecognised');

  /* 3. an address carries whatever was pasted with it, and a save is matched on the address.
        A trailing space is invisible and loses every mark that student ever hands in. */
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

/* Where the school email actually is on the Students tab.
   It used to be worked out as 3 + LABS.length + 2 — Name, Class, one column per lab, then
   Labs started and Average. That is right for a sheet built by THIS version of the script,
   and wrong for one built before a lab was added: the sheet still has the old number of lab
   columns, so the count points a column too far and nobody is found on the roster. Every
   save then comes back "not on this class list", with nothing to say why.
   So: read the heading row and find it. Falls back to the old arithmetic only if the sheet
   has no heading yet. */
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

/* A lab added since the Students tab was built has no column there. Insert one in its proper
   place so the existing data moves with it, instead of relabelling columns over the top of
   values that belong to something else. */
function _repairStudentColumns_() {
  var sh = _sheet_(T_STUDENTS);
  var n = sh.getLastColumn();
  if (n < 3) return 0;
  var head = sh.getRange(1, 1, 1, n).getValues()[0]
               .map(function (h) { return String(h || '').replace(/^✎\s*/, '').trim(); });
  if (head.indexOf('Labs started') < 0 && head.indexOf('School email') < 0) return 0;
  var added = 0;
  /* In LABS order, so the columns end up in the order the styling expects. Anything else and
     Tidy up would relabel a lab's column with a different lab's name, over its figures. */
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

/* Put the tabs in the order of the syllabus: Setup, Labs, Students, then topic 1 to topic 21,
   then Rejected. A tab is only ever created when a lab is added, so it lands on the end and the
   order becomes the order labs happened to be built in. This moves them instead of rebuilding
   anything, so no data is touched. Any tab of your own that is not in this list is left where
   it is, after the ones that are. */
function _orderTabs_() {
  var ss = _ss_();
  /* the tabs a teacher actually opens sit at the front; the twenty lab tabs are data behind them */
  /* Bio English sits with the people, after Students and before the homework, not among the labs */
  var want = [T_SETUP, T_LABS, T_STUDENTS, T_ENGLISH, T_HOMEWORK, T_TEACHERS, T_LINKS]
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
  return sh;
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
/** "mouth 9/9 in 14 · stomach 8/9 in 21" — readable in one cell. */
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
/** Must stay identical to completionCode() in each lab's js/app.js. The lab's own id
    is part of the recipe, so a code from one lab cannot be pasted into another. */
/* ============================================================
   5b. Completion codes — retired, September 2026
   ------------------------------------------------------------
   Every hand-in used to show the student a code (DL-3CL9-Q3MP), a checksum of name, class,
   score and lab that the Setup tab could read back. The page computed it with the same
   function as the server, so it proved nothing a student could not simply say — and now
   that a lab saves on its own, the "hand-in that never arrived" it existed for no longer
   happens. The Code column stays, hidden, for the rows that carry old ones.
   ============================================================ */
function _tidy_(s) { return String(s || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim(); }
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
  var who = _whoIs_(d.token);
  if (!who) return _json_({ ok: false, why: 'not signed in' });

  var out = {}, ss;
  try { ss = _ss_(); } catch (err) { return _json_({ ok: false, why: 'no spreadsheet' }); }
  /* answer nothing to anyone who is not on the roster, BEFORE reading a single lab tab */
  if (!_studentOf_(who.email)) return _json_({ ok: true, labs: {} });

  for (var i = 0; i < LABS.length; i++) {
    var lab = LABS[i];
    var sh = ss.getSheetByName(lab.name);          /* a lab with no tab yet is simply skipped */
    if (!sh) continue;
    var last = sh.getLastRow();
    if (last < 2) continue;

    var vals = sh.getRange(2, 1, last - 1, LAB_COLS.length).getValues();
    for (var r = 0; r < vals.length; r++) {
      if (_cleanEmail_(vals[r][LAB_EMAIL - 1]) !== who.email) continue;
      var score = Number(vals[r][2]);              /* Score */
      if (!(score > 0)) break;                     /* a row exists but nothing saved yet */
      out[lab.id] = {
        done:      score,
        total:     Number(vals[r][3]) || lab.questions || 0,
        complete:  String(vals[r][5] || '') === 'complete',
        checks:    Number(vals[r][6]) || 0,
        firstTime: Number(vals[r][7]) || 0,
        handIns:   Number(vals[r][9]) || 0,
        handedIn:  true,
        at:        vals[r][10] ? new Date(vals[r][10]).toISOString() : null,
        snap:      String(vals[r][LAB_SNAP - 1] || '')
      };
      break;
    }
  }
  return _json_({ ok: true, name: who.name || '', labs: out });
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
                 /* absent — not false — for everybody who is not a teacher on the list */
                 teacher: isTeacher || undefined,
                 teacherPage: isTeacher ? _teacherPageUrl_() : undefined });
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

   Which spreadsheets: every "Test" row of 🔗 Teacher links whose Link is a Google Sheet, for a
   cohort still in school (or no cohort). A sheet without the tab is simply not a test system.
   A teacher is seated exactly as a pupil is — on "Marks · Test" — so test mode shows them what a
   pupil sees, by the same path.

   Returned: ONLY this person's own — the state, the test's name, their own open and close
   instants, the way in. Never the class map, anyone else's time, anyone's status, a question.
   The email comes from the verified token, never from the request. Read only.
   ============================================================ */
var T_HUB_SCHEDULE   = '⏰ Hub schedule';
var HUB_SCHEDULE_KEY = 'HUB_SCHEDULE_JSON';
var TEST_SNAP_SECONDS = 60;   /* one read of a test spreadsheet serves every student for this long */

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
                                 ? ', and its address could not be read' + (trouble ? ' (' + trouble + ')' : '') + ' \u2014 run checkChips in the script editor, or use the spreadsheet\u2019s plain address'
                                 : ', which the hub reads only once the Google Sheets API is switched on in its script (Services \u25b8 + \u25b8 Google Sheets API) \u2014 or use the spreadsheet\u2019s plain address'));
    else why.push('no "Test" row in \ud83d\udd17 Teacher links has a Google Sheet as its Link (for a cohort still in school, or with no year)');
  }
  ids.forEach(function (id) {
    var snap = _testSnapshot_(id, teacher);          /* a teacher testing sees it as it is NOW */
    if (!snap || snap.fail) { why.push((snap && snap.fail) || 'a Test spreadsheet could not be read'); return; }
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
    var m = String(l.url).match(/^https:\/\/docs\.google\.com\/(?:a\/[^\/]+\/)?spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})/);
    if (m && !seen[m[1]]) { seen[m[1]] = 1; ids.push(m[1]); }
  });
  try { if (cache) cache.put(key, JSON.stringify(ids), 60); } catch (e) {}
  return ids;
}

/* One test spreadsheet, read once and shared by every student for TEST_SNAP_SECONDS: at the start
   of a test a whole year group opens the hub within a minute, and this script's executions are a
   shared, limited pool. So a submission or an override reaches the banner within a minute, not at
   once — the test's own page is always exact. null = not a test system (or unreadable). */
function _testSnapshot_(id, fresh) {
  var key = 'tsnap3:' + id, cache = null, hit = null;   /* bump when the snapshot's shape changes */
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

  /* seats — copies getStudentContext: every Marks tab, the ACTIVE test's column positions for all
     of them; the first class tab that has you wins, and beats "Marks · Test" (where the last hit
     stands). Class is the cell, or the tab's class when the cell is blank. */
  var seats = {}, width = Math.max(M.email, M.cls, M.extraTime > 0 ? M.extraTime : 0);
  wb.getSheets().forEach(function (sh) {
    var info = _marksTabInfo_(sh.getName(), String(M.prefix || 'Marks · '));
    if (!info) return;
    var last = sh.getLastRow();
    if (last < M.dataStart) return;
    sh.getRange(M.dataStart, 1, last - M.dataStart + 1, width).getValues().forEach(function (r) {
      var em = String(r[M.email - 1] || '').toLowerCase();
      if (!em) return;
      var prev = seats[em];
      if (prev && !prev.t) return;                                /* a class tab already has them */
      seats[em] = { c: String(r[M.cls - 1] || '') || info.className, v: info.version,
                    x: M.extraTime > 0 ? _extraTimePct_(r[M.extraTime - 1]) : 0, t: info.isTest ? 1 : 0 };
    });
  });

  /* per-student overrides (LiveProgress) and submissions (TestResponses), for this test's versions only */
  var live = {}, done = {};
  _eachRow_(wb.getSheetByName('LiveProgress'), ['Email', 'Test ID', 'Release Override', 'Lockout Override'], function (v) {
    if (!ids[String(v[1])]) return;
    var rel = _ms_(v[2]), lock = _ms_(v[3]);
    if (rel || lock) live[String(v[0]).toLowerCase() + '|' + String(v[1])] = [rel, lock];
  });
  _eachRow_(wb.getSheetByName('TestResponses'), ['Email', 'Test ID', 'Status'], function (v) {
    if (!ids[String(v[1])]) return;
    if (/^(submitted|marking|marked|failed)$/.test(String(v[2]).trim().toLowerCase()))
      done[String(v[0]).toLowerCase() + '|' + String(v[1])] = 1;
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
           versions: versions, seats: seats, live: live, done: done };
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
   The teacher page
   ------------------------------------------------------------
   What it is and why it is safe is at the top, under "The teacher page". In short: it is served
   by a deployment Google itself restricts to the school, it shows its links only to a teacher on
   the list, and all it holds is the rows of the "🔗 Teacher links" tab. A link on it opens only
   for people that file is shared with: the page lists the spreadsheets, it does not share them.
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

/* The two tabs the dialog manages. Made on demand, so the dialog works the first time it opens. */
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
    { h:'Graduation year', w:130, edit:true, note:'The cohort, by the year it graduates — this year’s Y10 is 2028, next year’s Y10 is 2029. The same test for another cohort is another row. Leave blank for something that is not tied to one cohort (a tracker, say).' },
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

/* Run this from the Apps Script editor (Run ▸ checkChips) if a chip in 🔗 Teacher links will not read.
   The log shows what Google returns for that tab, both ways the hub asks, so the cause is seen, not
   guessed. Read only. */
function checkChips() {
  var sh = _ss_().getSheetByName(T_LINKS);
  if (!sh || sh.getLastRow() < 2) { Logger.log('No rows in ' + T_LINKS + '.'); return; }
  var n = sh.getLastRow() - 1, w = sh.getLastColumn();
  Logger.log('Google Sheets API service switched on in this code: ' + _chipsOn_());
  var g = _chipGrid_(sh, 2, n, w);
  Logger.log(g ? 'Chip addresses read: ' + JSON.stringify(g.map(function (r) { return r.filter(String); })) : 'No chip addresses read.');
  if (_CHIP_TROUBLE_) Logger.log('Why: ' + _CHIP_TROUBLE_);
  try {
    var range = "'" + sh.getName().replace(/'/g, "''") + "'!A2:" + _colA1_(w) + (n + 1);
    var res = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sh.getParent().getId() + '?ranges=' +
                                encodeURIComponent(range) + '&fields=' + encodeURIComponent('sheets.data.rowData.values(chipRuns,formattedValue)'),
                                { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    Logger.log('Google, asked directly (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 3000));
  } catch (e) { Logger.log('Asking Google directly failed: ' + e); }
}

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
   the teacher (the page, the dialog, test mode) instead of disappearing or being misread. */
function _teacherLinksScan_() {
  var sh = _ss_().getSheetByName(T_LINKS);
  if (!sh || sh.getLastRow() < 2) return { rows: [], unreadable: [], chipsOn: _chipsOn_() };
  var last = sh.getLastRow(), wide = sh.getLastColumn();
  var kHead = _headerCol_(sh, 'Link', 0) - 1;            /* 0-based, or -1 */
  var dHead = _headerCol_(sh, 'Dashboard', 0) - 1;      /* 0-based, or -1 when the tab predates it */
  var grid = _linkGrid_(sh, 2, last - 1, wide, [kHead, dHead]);
  var rows = [], unreadable = [];
  grid.values.forEach(function (r, i) {
    var o = _readLinkRow_(r, kHead, i + 2, dHead, grid.urls[i]);
    if (o) { rows.push(o); return; }
    if (!r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; })) return;   /* a blank row */
    unreadable.push({ row: i + 2, type: String(r[0] || '').trim(),
                      name: String(r[3] || r[1] || '').trim() || 'a row',
                      shown: kHead >= 0 ? String(r[kHead] == null ? '' : r[kHead]).trim() : '' });
  });
  return { rows: rows, unreadable: unreadable, chipsOn: _chipsOn_(), chipTrouble: unreadable.length ? _CHIP_TROUBLE_ : '' };
}

/* The cohort a spreadsheet belongs to, named by the year it graduates — the stable handle, because
   a year group rolls forward every September (this year's Y10 is next year's Y11). From the
   graduation year and today's date the CURRENT year group is worked out and shown alongside, so a
   teacher sees both "Class of 2028" and "Y10 this year", and it stays right on its own next year.
   The rule matches the school's: this year (Sept 2026) Y10 graduates 2028, Y11 2027, Y9 2029 — so
   year group = 12 − graduation + the September the current year began. `now` is passed for testing. */
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
  var out = { unreadable: scan.unreadable, chipsOn: scan.chipsOn, chipTrouble: scan.chipTrouble, records: records, cohorts: order.map(function (g) {
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
   A second teacher-only page (?page=progress) that reads the marks in THIS spreadsheet — every
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
/* The cohort a class belongs to, from the year group in its name (10A → Y10 → Class of 2028 this
   year). Same rule as the teacher page, so a class and its assessment spreadsheets line up. */
/* Classes in YEAR order, not alphabetical order. Sorted as plain text, "10A" and "11A" both come
   before "9A" because "1" precedes "9" — so every dropdown in the estate listed Y10 and Y11 ahead
   of Y9. Compare the year group as a NUMBER first, then the letter after it. */
function _byClass_(a, b) {
  var ma = String(a == null ? '' : a).match(/\d+/), mb = String(b == null ? '' : b).match(/\d+/);
  var na = ma ? +ma[0] : 999, nb = mb ? +mb[0] : 999;
  return na - nb || String(a == null ? '' : a).localeCompare(String(b == null ? '' : b));
}
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
      var s = { name: String(r[0] || '').trim(), cls: cls, cohort: _classCohort_(cls, now), byLab: {} };
      byEmail[email] = s; students.push(s);
    });
  }
  labs.forEach(function (l) {
    var sh = ss.getSheetByName(l.name); if (!sh || sh.getLastRow() < 2) return;
    var n = sh.getLastRow() - 1;
    var v = sh.getRange(2, 1, n, LAB_EMAIL).getValues();
    for (var i = 0; i < n; i++) {
      var r = v[i], email = _cleanEmail_(r[LAB_EMAIL - 1]);
      if (!email || !byEmail[email]) continue;
      if (r[2] === '' || r[2] == null) continue;                 /* Score blank = nothing saved */
      var done = Number(r[2]) || 0, total = Number(r[3]) || l.questions || 0;
      byEmail[email].byLab[l.id] = {
        done: done, total: total, pct: total ? Math.round(1000 * done / total) / 10 : 0,
        complete: String(r[5] || '') === 'complete',
        checks: Number(r[6]) || 0, firstTime: Number(r[7]) || 0, handIns: Number(r[9]) || 0,
        at: r[10] ? new Date(r[10]).toISOString() : null,
        stations: _parseStations_(r[13])
      };
    }
  });
  var cset = {}; students.forEach(function (s) { if (s.cls) cset[s.cls] = 1; });
  /* The lab tabs record station IDS, so without this a teacher reads "ileum-villi" and
     "molecules-lab" instead of "Small intestine" and "Molecules and enzymes". Names come from the
     published manifest; with no manifest the page falls back to the ids rather than breaking. */
  var man = _manifest_(), names = {};
  if (man && man.labs) Object.keys(man.labs).forEach(function (k) {
    names[k] = {};
    (man.labs[k].stations || []).forEach(function (st) { names[k][st.id] = st.name; });
  });
  return { generatedAt: new Date().toISOString(), labs: labs, students: students,
           classes: Object.keys(cset).sort(_byClass_), stationNames: names };
}

/* The page itself. Gated exactly like the teacher page: Google has signed the visitor in (school-
   only deployment), and only a teacher on the list sees anything. The data is read once, on the
   server, and dropped into the page; the Refresh button just reloads, which reads it again. */
function _htmlOut_(html, title) {
  return HtmlService.createHtmlOutput(html).setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function _studentDirectory_(now) {
  var ss = _ss_(), out = [];
  var stu = ss.getSheetByName(T_STUDENTS);
  if (stu && stu.getLastRow() >= 2) {
    var ec = _emailCol_(stu), last = stu.getLastRow();
    stu.getRange(2, 1, last - 1, ec).getValues().forEach(function (r) {
      var email = _cleanEmail_(r[ec - 1]); if (!email) return;
      var cls = String(r[1] || '').trim().toUpperCase();
      out.push({ name: String(r[0] || '').trim(), cls: cls, email: email, cohort: _classCohort_(cls, now) });
    });
  }
  out.sort(function (a, b) { return _byClass_(a.cls, b.cls) || (a.name || '').localeCompare(b.name || ''); });
  var cset = {}; out.forEach(function (s) { if (s.cls) cset[s.cls] = 1; });
  return { generatedAt: new Date().toISOString(), students: out, classes: Object.keys(cset).sort(_byClass_) };
}
/* ── Set homework, for teachers ─────────────────────────────────────────────
   A fourth teacher-only page (?page=homework). A teacher picks parts of labs — not whole labs —
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
var _HW_HEADERS_ = ['ID', 'Created', 'Teacher', 'Title', 'Who', 'What', 'Due', 'Spec', 'Course', 'CourseWork', 'Status', 'Reported', 'Group', 'Cohort'];

function _hwColDefs_() {
  return [
    { h:'ID',         w:104, note:'The code for this homework. It appears in the summary email.' },
    { h:'Created',    w:132, fmt:'dd MMM, HH:mm', note:'When it was set.' },
    { h:'Teacher',    w:210, note:'Who set it. The summary goes to them.' },
    { h:'Title',      w:230, edit:true, note:'What the students see.' },
    { h:'Who',        w:150, note:'The class it was set for, or how many students.' },
    { h:'What',       w:330, note:'The parts of the labs that were set. Written out so you can read this tab on its own.' },
    { h:'Due',        w:132, fmt:'dd MMM, HH:mm', edit:true, note:'When it is due. Change it here and the summary waits for the new date.' },
    { h:'Spec',       w:300, hide:true, note:'What the page reads: which labs and stations, and who for. Do not edit.' },
    { h:'Course',     w:150, hide:true, note:'The Google Classroom course, once it has been posted there.' },
    { h:'CourseWork', w:150, hide:true, note:'The Google Classroom assignment, once it has been posted there.' },
    { h:'Status',     w:100, align:'center', list:['set', 'reported'], note:'set — still waiting.\nreported — the summary has been emailed.' },
    { h:'Reported',   w:132, fmt:'dd MMM, HH:mm', note:'When the summary was emailed.' },
    { h:'Group',      w:110, hide:true, note:'The same code on several rows means they were set in one go — the same practice for more than one class, each with its own date.' },
    { h:'Cohort',     w:90, align:'center', fmt:'0', note:'The graduation year this was set for. Written once, so it still says who it belonged to long after they have left — which is what lets old homework be tidied away safely.' }
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

/* Who is asking. The homework page is on the school-only deployment, so Google has already proved
   the visitor's identity; google.script.run calls from it arrive with the same active user. */
function _hwCaller_() {
  var email = '';
  try { email = _cleanEmail_(Session.getActiveUser().getEmail()); } catch (e) {}
  return email && _isTeacher_(email) ? email : '';
}

/* The cohort a piece of homework belongs to, decided when it is set and never recomputed: by the
   time it is old enough to tidy away, the pupils have left and the roster can no longer say. */
/* The school's clock. "Due the 25th" must mean the end of the 25th HERE — not in whatever zone the
   script project sits in, nor the teacher's browser. Before this, the page sent a naive
   "…T23:59:00", the server parsed it in the PROJECT's zone, and the browser rendered it back in its
   OWN: a date could show a day early or late and be called overdue on the wrong day. Now every
   decision about a due date is made in this one zone, and the page is sent the words and the
   verdict rather than a timestamp to re-interpret. */
function _tz_() {
  try { return _ss_().getSpreadsheetTimeZone() || Session.getScriptTimeZone(); }
  catch (e) { try { return Session.getScriptTimeZone(); } catch (e2) { return 'Etc/UTC'; } }
}
function _dueFrom_(v) {
  var d = String(v == null ? '' : v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  try { return Utilities.parseDate(d + ' 23:59:59', _tz_(), 'yyyy-MM-dd HH:mm:ss'); } catch (e) { return null; }
}
function _hwCohortOf_(cls, emails, roster, now) {
  if (cls) { var c = _classCohort_(cls, now); return c ? c.grad : ''; }
  var grads = {}, byEmail = {};
  roster.forEach(function (p) { byEmail[p.email] = p; });
  (emails || []).forEach(function (e) {
    var p = byEmail[e];
    if (p && p.cohort) grads[p.cohort.grad] = 1;
  });
  var ks = Object.keys(grads);
  return ks.length === 1 ? Number(ks[0]) : '';    /* mixed or unknown: left blank, aged out instead */
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
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues(), out = [];
  for (var i = 0; i < v.length; i++) {
    var r = v[i], id = String(r[c.ID - 1] || '').trim();
    if (!id) continue;
    var spec = {};
    try { spec = JSON.parse(String(r[c.Spec - 1] || '{}')) || {}; } catch (e) { spec = {}; }
    var due = r[c.Due - 1], dms = 0;
    try { if (due) dms = new Date(due).getTime() || 0; } catch (e) {}
    out.push({
      row: i + 2, id: id,
      group: String(r[c.Group - 1] || '').trim(),
      cohort: Number(r[c.Cohort - 1]) || '',
      setFor: spec.setFor || null,
      created: r[c.Created - 1] ? new Date(r[c.Created - 1]).toISOString() : null,
      teacher: _cleanEmail_(r[c.Teacher - 1]),
      title: String(r[c.Title - 1] || '').trim(),
      who: String(r[c.Who - 1] || '').trim(),
      what: String(r[c.What - 1] || '').trim(),
      due: due ? new Date(due).toISOString() : null,
      /* worded and judged here, in the school's zone, so the browser never re-reads a timestamp */
      dueText: dms ? Utilities.formatDate(new Date(dms), _tz_(), 'd MMM') : '',
      overdue: !!dms && dms < _nowMs_,
      soon: !!dms && dms >= _nowMs_ && (dms - _nowMs_) < 3 * 24 * 3600 * 1000,
      targets: spec.targets || {}, tasks: spec.tasks || [],
      course: String(r[c.Course - 1] || '').trim(),
      courseWork: String(r[c.CourseWork - 1] || '').trim(),
      status: String(r[c.Status - 1] || 'set').trim(),
      reported: r[c.Reported - 1] ? new Date(r[c.Reported - 1]).toISOString() : null
    });
  }
  return out;
}

/* Which pupils an assignment is for.
   If the row remembers who it was SET for, that list wins — homework belongs to the pupils who were
   in the room that day. Re-deriving it from the class every time looks tidier and is wrong: a pupil
   who moves 10A -> 10B would silently inherit every 10B assignment ever set, including ones already
   overdue, and be marked "not started" for work nobody ever gave them. Older rows, written before
   this was recorded, fall back to the live class. */
function _hwPupils_(hw, roster) {
  var want = {}, byEmail = {};
  roster.forEach(function (p) { byEmail[p.email] = p; });
  if (hw.setFor) {                      /* empty means nobody, not "work it out again" */
    var kept = [];
    hw.setFor.forEach(function (e) { if (byEmail[e]) kept.push(byEmail[e]); });
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
function _homeworkData_(now) {
  var man = _hwManifest_();
  var dir = _studentDirectory_(now);
  var roster = dir.students;
  var list = _homeworkRows_();

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
    /* what has changed under this assignment since it was set */
    var setCount = (hw.setFor && hw.setFor.length) || pupils.length;
    var gone = Math.max(0, setCount - pupils.length);
    var joined = 0;
    if (hw.targets && hw.targets.cls && hw.setFor) {
      var had = {}; hw.setFor.forEach(function (e) { had[e] = 1; });
      roster.forEach(function (p) { if (p.cls === hw.targets.cls && !had[p.email]) joined++; });
    }
    return {
      id: hw.id, group: hw.group, title: hw.title, who: hw.who, what: hw.what, teacher: hw.teacher,
      setCount: setCount, gone: gone, joined: joined, cohort: hw.cohort || '',
      created: hw.created, due: hw.due, status: hw.status, reported: hw.reported,
      tasks: hw.tasks, targets: hw.targets,
      pupils: rows, tally: tally, missing: Object.keys(miss)
    };
  });

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
    labs: labs, students: roster, classes: dir.classes,
    homework: out,
    manifestOk: !!man.labsOk, hubSet: !!_hubUrl_(),
    english: man.en ? { years: man.en.years || [], units: man.en.units || {}, sets: man.en.sets || [] } : null,
    classroomOk: typeof Classroom !== 'undefined' && !!Classroom && !!Classroom.Courses
  };
}

/* ---- the two writes, both gated ---- */
/* Set the same practice for several classes at once, each with ITS OWN due date — the common
   case when the same lesson lands on different days. It writes ONE ROW PER CLASS rather than one
   clever row, because that is also the shape Google Classroom needs: a piece of coursework belongs
   to exactly one course, so three classes is three posts however it is stored. The rows share a
   Group code so the page can show them as the one thing the teacher set. */
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
    var due = null;
    if (w.due) due = _dueFrom_(w.due);          /* a plain yyyy-mm-dd, read in the school's zone */
    if (!due) return { ok:false, why: cls ? ('Give ' + cls + ' a due date.') : 'Give it a due date.' };
    jobs.push({ cls: cls, emails: emails, due: due });
  }

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
    var ps = _hwPupils_({ targets: { cls: job.cls, emails: job.emails }, setFor: null }, roster);
    job.setFor = ps.map(function (p) { return p.email; });
    job.cohort = _hwCohortOf_(job.cls, job.setFor, roster);
  });

  var made = [];
  var lock = null;
  /* bail rather than carry on unlocked: catching the timeout and continuing would leave two
     teachers appending at once while each believed it held the sheet */
  try { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  catch (e) { return { ok:false, why:'Somebody else is setting homework just now — try again in a moment.' }; }
  try {
    var sh = _ensureHomeworkTab_();
    var taken = {}; _homeworkRows_().forEach(function (r) { taken[r.id] = 1; });
    for (var j = 0; j < jobs.length; j++) {
      var job = jobs[j], id = _hwId_(taken); taken[id] = 1;
      var whoTxt = job.cls ? job.cls : (job.emails.length + ' student' + (job.emails.length === 1 ? '' : 's'));
      sh.appendRow([
        id, new Date(), who, _plain_(title), _plain_(whoTxt), _plain_(what), job.due,
        JSON.stringify({ targets: { cls: job.cls || undefined, emails: job.emails.length ? job.emails : undefined },
                         setFor: job.setFor, tasks: tasks }),
        '', '', 'set', '', group, job.cohort || ''
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
  var posted = [], notPosted = [];
  if (d.post && made.length) {
    var cids = _classroomIds_(), res = [];
    jobs.forEach(function (job, j) {
      var p = _hwPost_(made[j], title, what, tasks, job, cids);
      res.push(p);
      if (p.ok) posted.push(job.cls || (job.setFor.length + ' student' + (job.setFor.length === 1 ? '' : 's')));
      else notPosted.push((job.cls || 'the students') + ': ' + p.why);
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
      } catch (e) {
      } finally { if (lk) { try { lk.releaseLock(); } catch (e) {} } }
    }
  }
  return { ok:true, made: made, group: group, posted: posted, notPosted: notPosted, data:_homeworkData_() };
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
  return { ok:true, data:_homeworkData_() };
}
/* the page asks for a refresh without writing anything */
function homeworkRefresh() {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  return { ok:true, data:_homeworkData_() };
}

/* The one page, and the one endpoint behind it. Each view's data is fetched only when its tab is
   first opened: Lab progress alone is half a megabyte, so loading all four up front would make the
   page slow to open — which is exactly the sluggishness the single page is meant to remove. */
function _teacherAppPage_(startTab) {
  var email = '';
  try { email = _cleanEmail_(Session.getActiveUser().getEmail()); } catch (e) {}
  var dom = _schoolDomain_();
  if (!email) return _htmlOut_(_teacherHtml_({ state:'nobody', dom:dom }), 'Teachers');
  if (!_isTeacher_(email)) return _htmlOut_(_teacherHtml_({ state:'refused', email:email, dom:dom }), 'Teachers');
  var boot = {
    email: email,
    tab: startTab || 'teachers',
    trackerBase: _trackerAppUrl_(),
    hubSet: !!_hubUrl_()
  };
  var json = JSON.stringify(boot).replace(/</g, '\\u003c');
  var html = HtmlService.createHtmlOutputFromFile('Teacher').getContent()
    .replace('__BOOT__', function () { return json; });
  return _htmlOut_(html, 'Biology teachers');
}

/* Everything the page asks for, in one gated door. */
function uiData(which) {
  var who = _hwCaller_();
  if (!who) return { ok:false, why:'Not allowed.' };
  try {
    if (which === 'teachers')  return { ok:true, data:_teacherPageGroups_() };
    if (which === 'progress')  return { ok:true, data:_labProgressData_() };
    if (which === 'students')  return { ok:true, data:_studentDirectory_(), trackerBase:_trackerAppUrl_() };
    if (which === 'homework')  return { ok:true, data:_homeworkData_() };
    if (which === 'english')   return { ok:true, data:_englishProgressData_() };
  } catch (err) { return { ok:false, why:String(err) }; }
  return { ok:false, why:'Unknown view.' };
}

function showTeacherPanel() {
  if (!_isAdminCaller_()) return;   /* reachable by anyone via google.script.run: these are expensive owner-privileged writes */
  _ensureTeacherTabs_();
  var html = HtmlService.createHtmlOutputFromFile('TeacherPage')
    .setWidth(680).setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Teacher page');
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
    unreadable: (_scan0_ = _teacherLinksScan_()).unreadable, chipsOn: _scan0_.chipsOn, chipTrouble: _scan0_.chipTrouble,
    links: _scan0_.rows.map(function (l) {         /* the same reading: one call to Google, not two */
      var co = _cohortLabel_(l.grad);
      l.cohort = co ? { title: co.title, yearGroup: co.yearGroup } : null;
      l.typeClass = _typeClass_(l.type);
      return l;
    }),
    types: ['Reflection', 'Test', 'Survey', 'Records']
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
  if (sh && row >= 2 && row <= sh.getLastRow()) sh.deleteRow(row);
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

/* The page. Google has already signed the visitor in — this deployment is restricted to the
   school — so Session.getActiveUser() is who they really are. Nobody, or somebody not on the
   list, gets the page's name and who it is for, and not a single link. */
function _pageUrl_(which) {
  var u = _teacherPageUrl_();
  if (!u) return '';
  return u.replace(/([?&])page=teachers\b/, '$1page=' + which);
}
/* Any reflection deployment's /exec, kept the way TEACHER_PAGE_URL is. Empty ⇒ no Students tab. */
function _trackerAppUrl_() {
  var u = String(_keptSetting_(TRACKER_APP_URL, 'TRACKER_APP_URL') || '').trim();
  return _isExecUrl_(u) ? u.replace(/\?.*$/, '') : '';
}
/* The link that opens ONE pupil's tracker. serveDashboard in the reflection app reads ?email and,
   for a teacher, shows that pupil's own page; for anyone else it shows only their own. */
function _studentTrackerUrl_(email) {
  var b = _trackerAppUrl_();
  return b ? b + '?page=student&email=' + encodeURIComponent(String(email || '').toLowerCase().trim()) : '';
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

function _teacherHtml_(o) {
  var e = _esc_, main = '';
  function card(l, cohortStr, kind) {
    var s = ((l.name || '') + ' ' + (l.detail || '') + ' ' + (l.type || '') + ' ' + (l.assessment || '') + ' ' + (cohortStr || '')).toLowerCase();
    return '<div class="card" data-type="' + e(kind) + '" data-s="' + e(s) + '">' +
      '<div class="card__main"><a class="card__name" href="' + e(l.url) + '" target="_blank" rel="noopener noreferrer">' + e(l.name) + '</a>' +
      (l.detail ? '<div class="card__detail">' + e(l.detail) + '</div>' : '') + '</div>' +
      '<div class="card__act">' +
        '<button type="button" class="card__copy" data-url="' + e(l.url) + '">Copy link</button>' +
        /* A row that names a dashboard offers both ways in, and the spreadsheet button then says
           which one it is: "Open" beside "Dashboard" would leave a teacher guessing which opens
           what. A row without one is left exactly as it was. */
        (l.dash ? '<a class="card__dash" href="' + e(l.dash) + '" target="_blank" rel="noopener noreferrer">Dashboard <span class="arw" aria-hidden="true">→</span></a>' : '') +
        '<a class="card__open" href="' + e(l.url) + '" target="_blank" rel="noopener noreferrer">' +
          (l.dash ? 'Spreadsheet' : 'Open') + ' <span class="arw" aria-hidden="true">→</span></a>' +
      '</div></div>';
  }
  if (o.state === 'nobody') {
    main = '<p class="say">Open this page signed in with your school Google account' +
           (o.dom ? ' (…@' + e(o.dom) + ')' : '') + '.</p>';
  } else if (o.state === 'refused') {
    main = '<p class="say">This page is for Biology teachers. You are signed in as <b>' + e(o.email) +
           '</b>, which is not on its list.</p>' +
           '<p class="fine">If you teach Biology here, ask the teacher who runs this page to add your address.</p>';
  } else if (o.trouble || !o.g) {
    main = '<p class="say">The list could not be read just now. Reload the page in a minute.</p>';
  } else if (!o.g.records.length && !o.g.cohorts.length && !o.g.loose.length) {
    main = '<p class="say">No links yet.</p><p class="fine">Add them from the labs spreadsheet: ' +
           '🧪 Biology Labs ▸ 🔗 Teacher page.</p>';
  } else {
    var total = 0, body = '', present = {};
    if (o.g.records.length) {
      total += o.g.records.length;
      body += '<section class="grp" data-current="1"><h2 class="grp__h"><span class="co">Records</span>' +
        '<span class="n">' + o.g.records.length + '</span></h2>' +
        '<div class="cards">' + o.g.records.map(function (l) { return card(l, 'records', 'records'); }).join('') + '</div></section>';
    }
    o.g.cohorts.forEach(function (c) {
      var n = 0; c.types.forEach(function (t) { n += t.links.length; });
      total += n;
      var cohortStr = c.title + ' ' + c.yearGroup;
      body += '<section class="grp cohort" data-current="' + (c.current ? '1' : '0') + '"><h2 class="coh">' +
        '<span class="coh__t">' + e(c.title) + '</span>' +
        (c.yearGroup ? '<span class="chip chip--yg">' + e(c.yearGroup) + ' this year</span>'
                     : '<span class="chip chip--past">not in school</span>') +
        (c.academic && c.yearGroup ? '<span class="coh__ay">' + e(c.academic) + '</span>' : '') +
        '<span class="n">' + n + '</span></h2>' +
        c.types.map(function (t) {
          var cls = _typeClass_(t.type); present[cls] = 1;
          return '<div class="tb tb--' + cls + '">' +
            '<h3 class="tl">' + e(t.type) + '<span class="tn">' + t.links.length + '</span></h3>' +
            '<div class="cards">' + t.links.map(function (l) { return card(l, cohortStr, cls); }).join('') + '</div></div>';
        }).join('') + '</section>';
    });
    if (o.g.loose.length) {
      total += o.g.loose.length;
      body += '<section class="grp" data-current="1"><h2 class="grp__h"><span class="co">No graduation year set</span>' +
        '<span class="n">' + o.g.loose.length + '</span></h2>' +
        '<div class="cards">' + o.g.loose.map(function (l) { var cls = _typeClass_(l.type); present[cls] = 1; return card(l, '', cls); }).join('') + '</div></section>';
    }
    /* the toolbar: search, filter by type, and hide cohorts who are not in school this year */
    var chips = '<button type="button" class="fchip is-on" data-f="all">All</button>';
    [['reflection', 'Reflection'], ['test', 'Test'], ['survey', 'Survey'], ['other', 'Other']].forEach(function (p) {
      if (present[p[0]]) chips += '<button type="button" class="fchip" data-f="' + p[0] + '">' + p[1] + '</button>';
    });
    var ty = o.g.thisYear;
    var legend = ty ? '<p class="legend"><span class="legend__k">This year · ' + e(ty.academic) + '</span>' +
      ty.list.map(function (x) { return '<span class="legend__y"><b>' + e(x.yg) + '</b> Class of ' + x.grad + '</span>'; }).join('') + '</p>' : '';
    var bar = '<div class="bar">' +
      '<div class="search"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.2-3.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '<input id="q" type="search" placeholder="Find a spreadsheet…" aria-label="Find a spreadsheet" autocomplete="off"></div>' +
      '<div class="fchips">' + chips + '</div>' +
      '<label class="curtog"><input id="cur" type="checkbox" checked><span>Only current cohorts</span></label>' +
      '</div>';
    main = legend + bar + '<div id="list">' + body + '</div>' +
      '<p class="none" id="none" hidden>Nothing matches that. <button type="button" id="clear" class="linkbtn">Clear</button></p>' +
      '<p class="foot">Each link opens only for the people its spreadsheet is shared with — this page lists them, ' +
      'it does not share them. To add, remove or change anything: in the labs spreadsheet, ' +
      '🧪&nbsp;Biology&nbsp;Labs ▸ 🔗&nbsp;Teacher&nbsp;page.</p>';
    o.total = total;
  }
  var who = o.email
    ? '<span class="who"><svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="8.2" r="4" fill="currentColor"/><path d="M4.2 21c.8-4.2 4-6.6 7.8-6.6s7 2.4 7.8 6.6z" fill="currentColor"/></svg>' +
      'Signed in as <b>' + e(o.email) + '</b>' +
      (o.state === 'ok' && o.total ? '<span class="who__dot">·</span>' + o.total + ' spreadsheet' + (o.total === 1 ? '' : 's') : '') +
      '</span>'
    : '';
  var nav = (o.state === 'ok' && o.progressUrl)
    ? '<nav class="tabs" aria-label="Teacher pages"><span class="tab is-on" aria-current="page">Spreadsheets</span>' +
      '<a class="tab" href="' + e(o.progressUrl) + '">Lab progress</a>' +
      (o.studentsUrl ? '<a class="tab" href="' + e(o.studentsUrl) + '">Students</a>' : '') +
      (o.homeworkUrl ? '<a class="tab" href="' + e(o.homeworkUrl) + '">Set homework</a>' : '') + '</nav>'
    : '';
  var js = o.state === 'ok' ? '<script>(function(){' +
    'var q=document.getElementById("q"),cur=document.getElementById("cur"),none=document.getElementById("none"),' +
    'chips=[].slice.call(document.querySelectorAll(".fchip")),cards=[].slice.call(document.querySelectorAll(".card")),f="all";' +
    'function apply(){var term=(q.value||"").trim().toLowerCase(),only=cur.checked,shown=0;' +
    'cards.forEach(function(c){var ok=(f==="all"||c.getAttribute("data-type")===f)&&(!term||c.getAttribute("data-s").indexOf(term)>=0);c.hidden=!ok;if(ok)shown++;});' +
    'document.querySelectorAll(".tb").forEach(function(b){b.hidden=!b.querySelector(".card:not([hidden])");});' +
    'document.querySelectorAll(".grp").forEach(function(g){var vis=g.querySelector(".card:not([hidden])");var hideCur=only&&g.getAttribute("data-current")==="0";g.hidden=!vis||hideCur;});' +
    'none.hidden=shown>0;}' +
    'q.addEventListener("input",apply);cur.addEventListener("change",apply);' +
    'chips.forEach(function(b){b.addEventListener("click",function(){chips.forEach(function(x){x.classList.remove("is-on");x.setAttribute("aria-pressed","false");});b.classList.add("is-on");b.setAttribute("aria-pressed","true");f=b.getAttribute("data-f");apply();});});' +
    'var cl=document.getElementById("clear");if(cl)cl.addEventListener("click",function(){q.value="";cur.checked=false;chips.forEach(function(x){x.classList.toggle("is-on",x.getAttribute("data-f")==="all");});f="all";apply();q.focus();});' +
    'q.addEventListener("keydown",function(ev){if(ev.key==="Escape"){q.value="";apply();}});' +
    'document.addEventListener("click",function(ev){var b=ev.target.closest&&ev.target.closest(".card__copy");if(!b)return;ev.preventDefault();var u=b.getAttribute("data-url"),done=function(){var t=b.textContent;b.textContent="Copied \\u2713";b.classList.add("ok");setTimeout(function(){b.textContent=t;b.classList.remove("ok");},1400);};' +
    'if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(done,function(){fallback(u,done);});}else{fallback(u,done);}});' +
    'function fallback(u,done){try{var ta=document.createElement("textarea");ta.value=u;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);done();}catch(e){}}' +
    'apply();' +
    '})();</script>' : '';
  return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8">' +
    /* Apps Script serves this inside a sandbox iframe. Without this every tab link tries to load
       script.google.com INSIDE that frame, and Google refuses to be framed — the browser then says
       "refused to connect". An explicit target= on a link still wins over this. */
    '<base target="_top">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500&display=swap">' +
    '<style>' +
    ':root{--ink:#0A141C;--card:#101D27;--cardhi:#16242F;--line:rgba(150,190,215,.17);--line2:rgba(150,190,215,.32);' +
    '--chalk:#EDF4F8;--dim:#AFC2CE;--mute:#7E93A1;--cyan:#4FC3F7;--accent:#E879F9;' +
    '--reflection:#E879F9;--test:#F5A623;--survey:#2DD4BF;--other:#9AB0BE;' +
    '--serif:Fraunces,Georgia,serif;--sans:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}' +
    '*{box-sizing:border-box}[hidden]{display:none!important}' +
    'html,body{margin:0;background:radial-gradient(1100px 460px at 82% -12%,rgba(232,121,249,.07),transparent 62%),var(--ink);' +
    'color:var(--chalk);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}' +
    '.wrap{max-width:860px;margin:0 auto;padding:clamp(24px,5vw,52px) clamp(16px,4vw,32px) 56px}' +
    '.eye{font:600 10.5px/1.3 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}.eye b{color:var(--accent)}' +
    'h1{font:400 clamp(36px,5.4vw,56px)/1.02 var(--serif);letter-spacing:-.02em;margin:10px 0 12px}h1 em{font-style:italic;color:var(--accent)}' +
    '.lede{color:#C5D4DD;max-width:58ch;margin:0 0 18px;font-size:15.5px}' +
    '.who{display:inline-flex;align-items:center;gap:9px;padding:7px 15px 7px 11px;border:1px solid var(--line2);border-radius:999px;' +
    'background:rgba(120,200,230,.06);font-size:13px;color:var(--dim)}.who svg{color:var(--cyan);opacity:.85;flex:none}' +
    '.who b{color:var(--chalk);font-weight:500}.who__dot{margin:0 7px;color:var(--mute)}' +
    /* the two-page switch (Spreadsheets · Lab progress) */
    '.topbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin-top:4px}' +
    '.tabs{display:inline-flex;gap:4px;padding:4px;border:1px solid var(--line2);border-radius:999px;background:var(--card);vertical-align:middle}' +
    '.tab{font:600 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);text-decoration:none;padding:9px 15px;border-radius:999px;transition:color .15s,background .15s}' +
    '.tab.is-on{color:var(--ink);background:var(--chalk)}.tab:not(.is-on):hover{color:var(--chalk)}.tab__a{opacity:.7}' +
    /* the "this year" key */
    '.legend{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;margin:20px 0 0;padding:11px 15px;border:1px solid var(--line);' +
    'border-radius:10px;background:rgba(120,200,230,.03);font-size:12.5px;color:var(--dim)}' +
    '.legend__k{font:600 9.5px/1.3 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}' +
    '.legend__y b{color:var(--accent);font-weight:600;font-family:var(--mono);font-size:11px;margin-right:5px}' +
    /* the toolbar */
    '.bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:16px 0 6px}' +
    '.search{display:flex;align-items:center;gap:8px;flex:1 1 220px;min-width:0;padding:9px 14px;border:1px solid var(--line2);' +
    'border-radius:999px;background:var(--card)}.search svg{color:var(--mute);flex:none}' +
    '.search input{flex:1;min-width:0;border:0;background:none;color:var(--chalk);font:15px/1 var(--sans);outline:none}' +
    '.search input::placeholder{color:var(--mute)}' +
    '.fchips{display:flex;flex-wrap:wrap;gap:6px}' +
    '.fchip{font:600 10.5px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);padding:8px 13px;' +
    'border:1px solid var(--line2);border-radius:999px;background:transparent;cursor:pointer;transition:color .15s,background .15s,border-color .15s}' +
    '.fchip:hover{color:var(--chalk)}.fchip.is-on{color:var(--ink);background:var(--chalk);border-color:var(--chalk)}' +
    '.curtog{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--dim);cursor:pointer;user-select:none}' +
    '.curtog input{accent-color:var(--accent);width:15px;height:15px}' +
    '.grp{margin:30px 0 0}' +
    '.grp__h{display:flex;align-items:center;gap:11px;font:600 10.5px/1.3 var(--mono);letter-spacing:.17em;text-transform:uppercase;' +
    'color:var(--dim);margin:0 0 12px}.grp__h .co{color:var(--chalk)}.grp__h .n{color:var(--mute);font-weight:500}' +
    '.grp__h::after{content:"";flex:1;height:1px;background:var(--line)}' +
    '.coh{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 12px;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid var(--line2)}' +
    '.coh__t{font:400 22px/1 var(--serif);letter-spacing:-.01em;color:var(--chalk)}' +
    '.chip--yg{font:600 10px/1 var(--mono);letter-spacing:.06em;color:#F1CFFB;background:rgba(232,121,249,.13);' +
    'border:1px solid rgba(232,121,249,.32);padding:5px 9px;border-radius:999px;text-transform:none}' +
    '.chip--past{font:600 10px/1 var(--mono);letter-spacing:.06em;color:var(--mute);background:rgba(150,190,215,.08);' +
    'border:1px solid var(--line2);padding:5px 9px;border-radius:999px;text-transform:none}' +
    '.coh__ay{font:500 11px/1 var(--mono);letter-spacing:.08em;color:var(--mute)}' +
    '.coh .n{margin-left:auto;font:600 10.5px/1 var(--mono);letter-spacing:.14em;color:var(--mute)}' +
    '.tb{margin:16px 0 0}.tb .tl{display:flex;align-items:center;gap:8px;font:600 10px/1.3 var(--mono);letter-spacing:.15em;' +
    'text-transform:uppercase;color:var(--tc);margin:0 0 8px}.tb .tn{color:var(--mute);font-weight:500}' +
    '.tb--reflection{--tc:var(--reflection)}.tb--test{--tc:var(--test)}.tb--survey{--tc:var(--survey)}.tb--other{--tc:var(--other)}' +
    '.cards{display:grid;gap:8px}' +
    '.card{position:relative;display:flex;align-items:center;gap:14px;padding:13px 16px 13px 18px;border-radius:11px;' +
    'background:var(--card);border:1px solid var(--line);transition:border-color .18s,background .18s}' +
    '.card::before{content:"";position:absolute;left:0;top:11px;bottom:11px;width:3px;border-radius:0 3px 3px 0;background:var(--tc,var(--accent));opacity:0;transition:opacity .18s}' +
    '.card:hover,.card:focus-within{border-color:var(--line2);background:var(--cardhi)}' +
    '.card:hover::before,.card:focus-within::before{opacity:.9}' +
    '.card__main{flex:1 1 auto;min-width:0}' +
    '.card__name{font-weight:600;font-size:15px;color:var(--chalk);text-decoration:none;overflow-wrap:anywhere}' +
    '.card__name:hover,.card__name:focus-visible{color:var(--tc,var(--accent))}' +
    '.card__detail{color:var(--dim);font-size:13px;margin-top:2px;overflow-wrap:anywhere}' +
    '.card__act{flex:none;display:flex;align-items:center;gap:6px}' +
    '.card__copy{font:600 10px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);background:transparent;' +
    'border:1px solid var(--line2);border-radius:999px;padding:7px 11px;cursor:pointer;transition:color .15s,border-color .15s,background .15s}' +
    '.card__copy:hover{color:var(--chalk);border-color:var(--chalk)}.card__copy.ok{color:#0A141C;background:var(--survey);border-color:var(--survey)}' +
    '.card__open{display:inline-flex;align-items:center;gap:6px;font:600 10px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;' +
    'color:var(--tc,var(--accent));text-decoration:none;padding:7px 11px;border:1px solid transparent;border-radius:999px}' +
    '.card__open:hover{background:color-mix(in srgb,var(--tc,var(--accent)) 12%,transparent)}' +
    '.card__open .arw{transition:transform .18s}.card:hover .card__open .arw{transform:translateX(3px)}' +
    /* The dashboard is the live thing behind the spreadsheet, so it carries the type colour as a
       filled pill rather than the plain text button beside it. */
    '.card__dash{display:inline-flex;align-items:center;gap:6px;font:600 10px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;' +
    'color:var(--tc,var(--accent));text-decoration:none;padding:7px 11px;border-radius:999px;white-space:nowrap;' +
    'border:1px solid color-mix(in srgb,var(--tc,var(--accent)) 45%,transparent);' +
    'background:color-mix(in srgb,var(--tc,var(--accent)) 10%,transparent);transition:background .15s,border-color .15s}' +
    '.card__dash:hover{background:color-mix(in srgb,var(--tc,var(--accent)) 22%,transparent);border-color:var(--tc,var(--accent))}' +
    '.card__dash .arw{transition:transform .18s}.card:hover .card__dash .arw{transform:translateX(3px)}' +
    '.card__name:focus-visible,.card__copy:focus-visible,.card__open:focus-visible,.card__dash:focus-visible,.fchip:focus-visible{outline:2px solid var(--tc,var(--accent));outline-offset:2px}' +
    '.none{color:var(--dim);font-size:14px;margin:24px 0}.linkbtn{color:var(--accent);background:none;border:0;font:inherit;cursor:pointer;text-decoration:underline;padding:0}' +
    '.foot{margin-top:34px;color:var(--mute);font-size:12.5px;max-width:66ch;border-top:1px solid var(--line);padding-top:15px}' +
    '.say{font:400 20px/1.45 var(--serif);max-width:52ch;margin:22px 0 10px}.say b{font-family:var(--sans);font-size:16px;font-weight:500;color:var(--chalk)}' +
    '.fine{color:var(--mute);font-size:13.5px;max-width:62ch}' +
    '@media (max-width:560px){.card{flex-wrap:wrap}.card__act{width:100%;margin-top:4px}.coh .n{margin-left:0}}' +
    '@media (prefers-reduced-motion:reduce){.card,.card__open .arw,.fchip{transition:none}}' +
    '</style></head><body><div class="wrap">' +
    '<p class="eye">Biology Hub · <b>Teachers only</b></p>' +
    '<h1>Assessment <em>system</em></h1>' +
    '<p class="lede">Every spreadsheet in the Assessment Reflection System, in one place — grouped by the cohort it belongs to, by the year they graduate.</p>' +
    '<div class="topbar">' + who + nav + '</div>' + main + '</div>' + js + '</body></html>';
}

/* 🧪 Biology Labs ▸ 🔗 Teacher page: makes the tab (with the two records it can fill
   in itself) and says, in order, what is still to do. Safe to run again: it never touches a row
   that is already there. */
function setUpTeacherPage_() { showTeacherPanel(); }  /* kept: the panel superseded the old setup */

/* The tracker workbook and the school's domain, remembered the same way SHEET_ID is so
   that pasting a fresh copy of this file over the top never wipes what was typed in. */
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
  { h:'Sets finished', w:106, align:'center', fmt:'0', group:true, note:'Sets with every question answered.' },
  { h:'Last saved', w:132, fmt:'dd MMM, HH:mm', note:'When the site last saved their work.' },
  { h:'Per set', w:460, note:'Every set they have opened: questions answered / questions in the set, and in brackets how many were right first time.' },
  { h:'School email', w:230, hide:true, note:'What ties this row to the student. Do not edit.' },
  { h:'Carried between devices', w:200, hide:true, note:'Which questions they have answered, set by set, so signing in on another computer brings their work back. Written by the site. Do not edit.' }
];
var EN_LAST = 8, EN_EMAIL = 10, EN_SNAP = 11;
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
  return sh;
}

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

/* What homework is scored against: the labs' stations, and Bio English Lab's sets as one lab
   more. Either half can be missing without the other failing, and each says so for itself. */
function _hwManifest_() {
  var labs = _manifest_(), en = _englishManifest_(), out = { labs: {}, labsOk: !!labs, en: en };
  if (labs && labs.labs) Object.keys(labs.labs).forEach(function (k) { out.labs[k] = labs.labs[k]; });
  if (en) out.labs[ENGLISH_ID] = _englishAsLab_(en);
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
               s: String(x.s || '').replace(/[^01tfs]/g, ''), v: String(x.v || ''), k: String(x.k || '') };
  });
  return out;
}
/* A cell holds 50,000 characters. If a pupil ever reached that, the detail of FINISHED sets goes
   first: their counts stay, and a finished set has nothing left to carry on with. */
function _enPack_(kept) {
  var txt = JSON.stringify(kept);
  if (txt.length > 45000) {
    Object.keys(kept).forEach(function (k) { if (kept[k].t && kept[k].d >= kept[k].t) kept[k].s = ''; });
    txt = JSON.stringify(kept);
  }
  if (txt.length > 45000) { Object.keys(kept).forEach(function (k) { kept[k].s = ''; }); txt = JSON.stringify(kept); }
  return txt;
}
/* Two computers, one pupil: keep the better answer to each question and never go backwards. A
   set rebuilt since (a new version) starts again, because its questions are not the same ones. */
function _enMerge_(old, inc) {
  if (!old || old.v !== inc.v) return inc;
  if (!old.s || !inc.s || old.s.length !== inc.s.length) {     /* no detail to compare: counts, never down */
    inc.d = Math.max(inc.d, old.d); inc.f = Math.max(inc.f, old.f);
    if (!inc.s) inc.s = old.s;
    return inc;
  }
  var s = '', d = 0, f = 0;
  for (var i = 0; i < inc.s.length; i++) {
    var a = old.s.charAt(i), b = inc.s.charAt(i), c = (EN_RANK[a] || 0) >= (EN_RANK[b] || 0) ? a : b;
    s += c;
    if (c === 'f' || c === '1' || c === 's') d++;
    if (c === 'f') f++;
  }
  if (inc.t) d = Math.min(d, inc.t);
  return { d: d, f: Math.min(f, d), t: inc.t, s: s, v: inc.v, k: inc.k || old.k };
}
/* The columns a teacher reads, worked out from the stored sets. */
function _enSummary_(kept, en) {
  var bySet = {}, order = {}, vd = 0, vf = 0, wd = 0, wf = 0, fin = 0;
  if (en) (en.sets || []).forEach(function (s, i) { bySet[s.id] = s; order[s.id] = i; });
  function at(k) { return order[k] == null ? 1e6 : order[k]; }
  var bits = Object.keys(kept).sort(function (a, b) { return at(a) - at(b) || (a < b ? -1 : 1); }).map(function (sid) {
    var x = kept[sid], m = bySet[sid], kind = (m && m.kind) || x.k;
    if (kind === 'kw') { vd += x.d; vf += x.f; } else { wd += x.d; wf += x.f; }
    if (x.t && x.d >= x.t) fin++;
    var u = m && m.unit && en.units[m.unit] ? en.units[m.unit] : null;
    return (u ? 'T' + u.n + ' ' : '') + (m ? m.title : sid) + ' ' + x.d + '/' + x.t + ' (' + x.f + ')';
  });
  return { vocab: vd, vocabFirst: vd ? vf / vd : '', writing: wd, writingFirst: wd ? wf / wd : '',
           finished: fin, perSet: bits.join(' · ').slice(0, 45000) };
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

/* english.save — { token, sets: { <setId>: { done, first, total, snap, v } } }, sent a few
   seconds after a pupil answers, and again as they leave the page. */
function _englishSave_(d) {
  if (!_clientId_()) return _json_({ ok:false, why:'sign-in is not set up' });
  var who = _whoIs_(d.token);
  if (!who) return _json_({ ok:false, why:'not signed in' });
  var student = _studentOf_(who.email);
  /* the rule every save follows: somebody not on the roster leaves no trace here at all */
  if (!student) return _json_({ ok:false, why:'not on your teacher’s class list (' + who.email + ')' });
  var sets = d.sets && typeof d.sets === 'object' && !Array.isArray(d.sets) ? d.sets : {};
  var ids = Object.keys(sets).filter(function (k) { return EN_SID.test(k); });
  if (!ids.length) return _json_({ ok:true, saved:0 });
  if (ids.length > 300) return _json_({ ok:false, why:'too much at once' });
  var en = _englishManifest_(), bySet = {};
  if (en) (en.sets || []).forEach(function (s) { bySet[s.id] = s; });

  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { return _json_({ ok:false, why:'busy — it will try again' }); }
  try {
    var sh = _englishSheet_(), r = _enRowFor_(sh, who.email, student);
    var kept = _enParse_(sh.getRange(r, EN_SNAP).getValue()), saved = 0;
    ids.forEach(function (sid) {
      var s = sets[sid] || {}, m = bySet[sid] || null;
      if (en && !m) return;                                /* a set the site does not have */
      var total = m ? (Number(m.total) || 0) : Math.max(0, Math.min(500, Number(s.total) || 0));
      var inc = { d: Math.max(0, Math.min(total, Number(s.done) || 0)), f: 0, t: total,
                  s: String(s.snap || '').replace(/[^01tfs]/g, '').slice(0, total || 500),
                  v: String(s.v || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20), k: m ? String(m.kind || '') : '' };
      inc.f = Math.max(0, Math.min(inc.d, Number(s.first) || 0));
      /* a page left open from before the set was rebuilt must not overwrite work on the new one */
      if (m && kept[sid] && kept[sid].v === String(m.v) && inc.v !== String(m.v)) return;
      kept[sid] = _enMerge_(kept[sid], inc);
      saved++;
    });
    var sum = _enSummary_(kept, en);
    sh.getRange(r, 1, 1, EN_SNAP).setValues([[
      student.name, student.cls, sum.vocab, sum.vocabFirst, sum.writing, sum.writingFirst, sum.finished,
      new Date(), _plain_(sum.perSet), who.email, _enPack_(kept)
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
  var who = _whoIs_(d.token);
  if (!who) return _json_({ ok:false, why:'not signed in' });
  var out = { ok:true, name: who.name || '', onList:false, cls:'', sets:{}, homework:[] };
  if (_isTeacher_(who.email)) { out.teacher = true; out.teacherPage = _englishTeacherUrl_(); }
  var student = _studentOf_(who.email);
  if (!student) return _json_(out);                    /* nothing, to anyone not on the roster */
  out.onList = true; out.cls = student.cls;
  var sh = _ss_().getSheetByName(T_ENGLISH);
  if (sh && sh.getLastRow() >= 2) {
    var n = sh.getLastRow() - 1, v = sh.getRange(2, EN_EMAIL, n, 2).getValues();
    for (var i = 0; i < n; i++) {
      if (_cleanEmail_(v[i][0]) !== who.email) continue;
      var kept = _enParse_(v[i][1]);
      Object.keys(kept).forEach(function (sid) {
        var x = kept[sid];
        out.sets[sid] = { done: x.d, first: x.f, total: x.t, snap: x.s, v: x.v };
      });
      break;
    }
  }
  var now = Date.now(), MONTH = 28 * 24 * 3600 * 1000;
  _homeworkRows_().forEach(function (hw) {
    var sets = [];
    hw.tasks.forEach(function (t) { if (t.labId === ENGLISH_ID) sets = sets.concat(t.stationIds || []); });
    if (!sets.length || !_hwIsFor_(hw, who.email, student.cls)) return;
    var dms = hw.due ? new Date(hw.due).getTime() : 0;
    if (dms && now - dms > MONTH) return;              /* a month past its date: off their list */
    out.homework.push({ id: hw.id, title: hw.title, due: hw.dueText, overdue: hw.overdue, dueAt: hw.due || '', sets: sets });
  });
  out.homework.sort(function (a, b) { return String(a.dueAt).localeCompare(String(b.dueAt)); });
  return _json_(out);
}
/* The same answer _hwPupils_ gives, asked the other way round: is this homework theirs? */
function _hwIsFor_(hw, email, cls) {
  if (hw.setFor) return hw.setFor.indexOf(email) >= 0;          /* who was in the room that day */
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
    Object.keys(kept).forEach(function (sid) { byId[sid] = { done: kept[sid].d }; });
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
      Object.keys(kept).forEach(function (sid) { slim[sid] = [kept[sid].d, kept[sid].f]; });
      prog[em] = { sets: slim, at: v[i][EN_LAST - 1] ? new Date(v[i][EN_LAST - 1]).toISOString() : null };
    }
  }
  return {
    generatedAt: new Date().toISOString(), manifestOk: !!en,
    english: en ? { years: en.years || [], units: en.units || {}, sets: en.sets || [] } : null,
    students: dir.students.map(function (s) { return { name: s.name, cls: s.cls, email: s.email }; }),
    classes: dir.classes, progress: prog
  };
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
function _hwPost_(id, title, what, tasks, job, ids) {
  try { _needClassroom_(); } catch (e) { return { ok:false, why:'Google Classroom is not switched on in the script' }; }
  var courses = {};
  (job.setFor || []).forEach(function (e) { var c = ids[e] && ids[e].courseId; if (c) courses[c] = (courses[c] || 0) + 1; });
  var cids = Object.keys(courses);
  if (!cids.length) return { ok:false, why:'nobody in it was imported from Classroom, so there is no course to post to' };
  if (cids.length > 1 && !job.cls) return { ok:false, why:'those students are in different Classroom courses — set it for each class instead' };
  var courseId = cids.sort(function (a, b) { return courses[b] - courses[a]; })[0];
  var links = [];
  tasks.forEach(function (t) {
    if (t.labId === ENGLISH_ID) links.push({ link: { url: ENGLISH_URL + '/#/hw/' + encodeURIComponent(id) } });
    else if (/^[a-z0-9-]+$/.test(t.labId)) links.push({ link: { url: 'https://nlcsbiology.com/' + t.labId + '/' } });
  });
  var due = job.due, body = {
    title: title,
    description: what + '\n\nSign in with your school Google account, so that your work is recorded.',
    materials: links.slice(0, 20), workType: 'ASSIGNMENT', state: 'PUBLISHED',
    dueDate: { year: due.getUTCFullYear(), month: due.getUTCMonth() + 1, day: due.getUTCDate() },
    dueTime: { hours: due.getUTCHours(), minutes: due.getUTCMinutes() }
  };
  if (!job.cls) {
    var uids = (job.setFor || []).map(function (e) { return ids[e] && ids[e].userId; }).filter(function (x) { return !!x; });
    if (!uids.length) return { ok:false, why:'those students have no Classroom id — import them from Classroom first' };
    body.assigneeMode = 'INDIVIDUAL_STUDENTS';
    body.individualStudentsOptions = { studentIds: uids };
  }
  try {
    var w = Classroom.Courses.CourseWork.create(body, courseId);
    return { ok:true, courseId: courseId, courseWorkId: String(w.id) };
  } catch (e) {
    return { ok:false, why: String((e && e.message) || e).replace(/[A-Za-z0-9_-]{25,}/g, '…').slice(0, 160) };
  }
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
