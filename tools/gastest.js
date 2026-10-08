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
    /* The real thing refuses a range that runs past the sheet's last row or column, for a READ as much as
       a write ("The coordinates of the range are outside the dimensions of the sheet"). Checking writes
       only let a read past a narrow tab's last column pass here and throw in Google. */
    if (r + this.nr - 1 > sheet.maxR || c + this.nc - 1 > sheet.maxC)
      throw new Error(`getRange outside the sheet "${sheet.name}": rows ${r}..${r + this.nr - 1}, cols ${c}..${c + this.nc - 1} (max ${sheet.maxR}x${sheet.maxC})`);
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
  getNumberFormats() {     /* what setNumberFormat(s) kept, '' for a cell never given one */
    const f = this.sheet.fmt || new Map();
    return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => f.get((this.r + i) + ':' + (this.c + j)) || ''));
  }
  getHorizontalAlignments() {
    return Array.from({ length: this.nr }, () => Array.from({ length: this.nc }, () => 'general'));
  }
  setNumberFormats(v) {    /* kept per cell, like setNumberFormat below (6 Oct 2026: the import writes ids as text, a run at a time) */
    this._grid('setNumberFormats', v);
    const f = (this.sheet.fmt = this.sheet.fmt || new Map());
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) f.set((this.r + i) + ':' + (this.c + j), v[i][j]);
    return this;
  }
  /* one format for the whole range (5 Oct 2026: the import marks the id columns as text, '@'); the stand-in keeps it */
  setNumberFormat(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) (this.sheet.fmt = this.sheet.fmt || new Map()).set((this.r + i) + ':' + (this.c + j), f); return this; }
  getDisplayValue() { const v = this.sheet.get(this.r, this.c); return v == null ? '' : String(v); }
  getDisplayValues() { return this.getValues().map(r => r.map(v => (v == null ? '' : String(v)))); }
  setHorizontalAlignments(v) { return this._grid('setHorizontalAlignments', v); }
  setDataValidations(v) { return this._grid('setDataValidations', v); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sheet.get(this.r + i, this.c + j)); out.push(row); }
    return out;
  }
  /* This stand-in keeps a formula as its own text, so a cell holding one gives it back here, as the real
     getFormulas does (and '' for every other cell). */
  getFormulas() { return this.getValues().map(r => r.map(v => (typeof v === 'string' && v[0] === '=') ? v : '')); }
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
                 'setWrap','setFontSize',   /* setNumberFormat is the class's own (5 Oct 2026): it keeps the format */'setFontStyle','setBorder','clearFormat',
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
  /* the real one works on the LAST column too, which insertColumnBefore cannot reach once Tidy up has trimmed the spare ones */
  insertColumnAfter(c) { if (c < 1 || c > this.maxC) throw new Error(`insertColumnAfter out of bounds on "${this.name}": ${c} of ${this.maxC}`); return this.insertColumnBefore(c + 1); }
  /* as the real one: the range's columns go to just before the column that stood at destIndex BEFORE the move ("A:B to 5
     makes them C:D"); every cell goes with its column */
  moveColumns(range, destIndex) {
    const from = range.c, w = range.nc;
    if (destIndex < 1 || destIndex > this.maxC + 1 || from + w - 1 > this.maxC) throw new Error(`moveColumns out of bounds on "${this.name}"`);
    const order = []; for (let c = 1; c <= this.maxC; c++) order.push(c);
    const moving = order.splice(from - 1, w);
    order.splice(destIndex - 1 - (destIndex > from ? w : 0), 0, ...moving);
    const to = new Map(); order.forEach((oldC, i) => to.set(oldC, i + 1));
    const next = new Map();
    for (const [k, v] of this.cells) { const [r, c] = k.split(':').map(Number); next.set(this.key(r, to.get(c) || c), v); }
    this.cells = next;
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
  showColumns(c, n) { if (c > this.maxC) throw new Error(`showColumns past the end on "${this.name}"`); return this; }
  clear() { this.cells.clear(); return this; }
}
for (const m of ['setColumnWidth','setRowHeight','setFrozenRows','setFrozenColumns','setHiddenGridlines','activate','setTabColor'])
  Sheet.prototype[m] = function () { return this; };

class SS {
  constructor() { this.sheets = []; }
  getName() { return 'Test sheet'; }
  getId() { return 'FAKE_SHEET_ID'; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  getSpreadsheetTimeZone() { return 'Asia/Seoul'; }
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
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props.get(k) || null, setProperty: (k, v) => props.set(k, v),
                                                         deleteProperty: k => props.delete(k),
                                                         getKeys: () => Array.from(props.keys()), getProperties: () => Object.fromEntries(props) }) };
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
/* Time-driven triggers are remembered, so a test can count them; the Setup tab's onEdit one is
   not, exactly as before. */
global.TRIGGERS = [];
global.ScriptApp = {
  getProjectTriggers: () => TRIGGERS.slice(),
  deleteTrigger: t => { const i = TRIGGERS.indexOf(t); if (i >= 0) TRIGGERS.splice(i, 1); },
  newTrigger: (fn) => ({
    forSpreadsheet: () => ({ onEdit: () => ({ create: () => {} }) }),
    timeBased: () => { const b = { everyDays: () => b, atHour: () => b, everyMinutes: n => { b.minutes = n; return b; },
      after: ms => { b.after = ms; return b; },    /* a one-off trigger (7 Oct 2026: the Classroom import carries on by itself) */
      create: () => { const t = { getHandlerFunction: () => fn, minutes: b.minutes, after: b.after }; TRIGGERS.push(t); return t; } }; return b; }
  }),
  /* which of the scopes asked about the owner has allowed (the reminders' Classroom announcements, 1 Oct 2026):
     all of them, unless a test sets SCOPES_GRANTED = false */
  AuthMode: { FULL: 'FULL' },
  getAuthorizationInfo: (mode, scopes) => ({ getAuthorizedScopes: () => (SCOPES_GRANTED ? (scopes || []).slice() : []),
                                             getAuthorizationStatus: () => (SCOPES_GRANTED ? 'NOT_REQUIRED' : 'REQUIRED') })
};
global.SCOPES_GRANTED = true;
global.MAILS = [];
global.MailApp = { sendEmail: (to, subj, body) => { MAILS.push({ to, subj, body }); } };
global.LockService = { getScriptLock: () => ({ waitLock: () => true, releaseLock: () => {} }) };
global.Logger = { log: m => log('log: ' + m) };
global.Classroom = undefined;                    /* as it is before the service is added */
global.TOKEN_EMAIL = 'ana@x.kr';
/* Every call to Google's token check is counted, so a test can prove junk never reaches it. */
global.FETCHES = 0;
global.TOKEN_ISS = 'https://accounts.google.com';
/* the published station manifest, when a test asks for one */
global.MANIFEST_JSON = '';
/* Bio English Lab's public set list, when a test asks for one. Its addresses never reach the
   token check, so they cannot disturb a test that counts those calls. */
global.ENGLISH_JSON = '';
global.WRITEUP_JSON = '';
global.UrlFetchApp = { fetch: (url) => {
  if (MANIFEST_JSON && /stations\.json$/.test(String(url || ''))) {
    return { getResponseCode: () => 200, getContentText: () => MANIFEST_JSON };
  }
  if (/\/bio-english-lab\//.test(String(url || ''))) {
    return ENGLISH_JSON && /sets\.json$/.test(String(url))
      ? { getResponseCode: () => 200, getContentText: () => ENGLISH_JSON }
      : { getResponseCode: () => 404, getContentText: () => '' };
  }
  /* the Write-Up Lab's public parts list (3 Oct 2026), the same way */
  if (/\/write-up-lab\//.test(String(url || ''))) {
    return WRITEUP_JSON && /parts\.json$/.test(String(url))
      ? { getResponseCode: () => 200, getContentText: () => WRITEUP_JSON }
      : { getResponseCode: () => 404, getContentText: () => '' };
  }
  return _tokenFetch(); } };
const _tokenFetch = () => { FETCHES++; return { getResponseCode: () => 200,
  getContentText: () => JSON.stringify({ aud: 'CID', iss: TOKEN_ISS, exp: Math.floor(Date.now()/1000)+3600,
                                         email_verified: 'true', email: TOKEN_EMAIL, name: 'A Person' }) }; };
global.Utilities = {
  /* enough of the real thing to exercise the due-date path: a fixed offset stands in for the
     zone database, which is all these tests need to prove the code never re-reads a timestamp */
  parseDate: (str, tz, fmt) => {
    const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (!m) throw new Error('parseDate: ' + str);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - 9 * 3600 * 1000);
  },
  formatDate: (d, tz, fmt) => {
    const x = new Date(d.getTime() + 9 * 3600 * 1000);
    if (fmt === 'HH:mm') return ('0' + x.getUTCHours()).slice(-2) + ':' + ('0' + x.getUTCMinutes()).slice(-2);
    /* the reminders (1 Oct 2026) ask for the hour alone, and the day as yyyy-MM-dd */
    if (fmt === 'HH') return ('0' + x.getUTCHours()).slice(-2);
    if (fmt === 'yyyy-MM-dd') return x.getUTCFullYear() + '-' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + x.getUTCDate()).slice(-2);
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return x.getUTCDate() + ' ' + M[x.getUTCMonth()];
  },
  /* the real encoding (padding kept, as Apps Script keeps it), of bytes (an array of signed bytes, as Java gives them) or
     of text: the script's own pass (6 Oct 2026) round-trips through it */
  base64EncodeWebSafe: b => Buffer.from(Array.isArray(b) ? b.map(x => x & 255) : String(b), Array.isArray(b) ? undefined : 'utf8')
                              .toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
  computeHmacSha256Signature: (value, key) => Array.from(require('crypto').createHmac('sha256', String(key)).update(String(value)).digest())
                                                .map(x => (x > 127 ? x - 256 : x)),
  getUuid: () => require('crypto').randomUUID(),
                     /* the real digest, as signed bytes: the script keys its sign-in cache on the start of it, and the text itself would
                        give every sign-in the same key (they all begin alike) */
                     computeDigest: (a, t) => Array.from(require('crypto').createHash('sha256').update(String(t)).digest()).map(x => (x > 127 ? x - 256 : x)),
                     DigestAlgorithm: { SHA_256: 1 },
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
   and every google.script.run call in every window. Apps Script only finds out these are
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
/* The server calls a window makes (labs-script-013, 30 Sep 2026: this read only ClassroomImport.html, so a renamed
   teacher* or homework* function would have shown only when a teacher clicked). Each google.script.run chain is walked
   with its brackets balanced, so a handler's own calls are never taken for the server's: its last link is the call.
   A chain kept in a variable is followed to where it is called (TeacherPage's Find: run.teacherFindAgain), and a chain
   ending in [fn] to the names its helper is handed (Teacher.html: send('homeworkDelete', …)). */
function serverCalls(html) {
  const WITH = /^with(SuccessHandler|FailureHandler|UserObject)$/;
  const skip = (s, i) => {                  /* s[i] opens a string, a comment or a bracket: the index where it ends */
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { for (i++; i < s.length && s[i] !== c; i++) if (s[i] === '\\') i++; return i; }
    if (c === '/' && s[i + 1] === '*') return s.indexOf('*/', i + 2) + 1;
    if (c === '/' && s[i + 1] === '/') return s.indexOf('\n', i);
    for (let d = 0; i < s.length; i++) {
      const x = s[i];
      if (x === '"' || x === "'" || x === '`' || (x === '/' && (s[i + 1] === '*' || s[i + 1] === '/'))) { i = skip(s, i); continue; }
      if (x === '(' || x === '[' || x === '{') d++;
      else if ((x === ')' || x === ']' || x === '}') && --d === 0) return i;
    }
    return s.length;
  };
  const out = new Set(), unknown = [];
  for (const m of html.matchAll(/google\.script\.run\b/g)) {
    let i = m.index + m[0].length, last = '', computed = false, k;
    for (;;) {
      if ((k = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(html.slice(i, i + 200)))) { last = k[1]; i = skip(html, i + k[0].length - 1) + 1; continue; }
      if ((k = /^\s*\[/.exec(html.slice(i, i + 40)))) {
        computed = true; i = skip(html, i + k[0].length - 1) + 1;
        if ((k = /^\s*\(/.exec(html.slice(i, i + 40)))) i = skip(html, i + k[0].length - 1) + 1;
        continue;
      }
      break;
    }
    if (last && !WITH.test(last) && !computed) { out.add(last); continue; }
    let names = [], via = '';
    if (computed) {                           /* function send(fn, arg){ … google.script.run…[fn](arg) } */
      const f = [...html.slice(0, m.index).matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].pop();
      via = f ? f[1] + '(…)' : '[fn]';
      if (f) names = [...html.matchAll(new RegExp('\\b' + f[1] + "\\(\\s*'([A-Za-z_$][\\w$]*)'", 'g'))].map(x => x[1]);
    } else {                                  /* var run = google.script.run.with…(…); … run.name(…) */
      const held = /([A-Za-z_$][\w$]*)\s*=\s*$/.exec(html.slice(Math.max(0, m.index - 60), m.index));
      via = held ? held[1] : html.slice(m.index, m.index + 60).replace(/\s+/g, ' ');
      if (held) names = [...html.matchAll(new RegExp('\\b' + held[1] + '\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(', 'g'))]
        .map(x => x[1]).filter(n => !WITH.test(n));
    }
    if (!names.length) unknown.push(via);
    names.forEach(n => out.add(n));
  }
  return { names: [...out], unknown };
}
ok &= run('every google.script.run call in every window exists — the import dialog, the teacher page and its dialog', () => {
  const seen = {};
  for (const f of ['ClassroomImport', 'Teacher', 'TeacherPage']) {
    const html = fs.readFileSync('apps-script/' + f + '.html', 'utf8');
    if (!/google\.script\.run/.test(html)) throw new Error(f + '.html calls nothing at all — has it been gutted?');
    const r = serverCalls(html);
    if (r.unknown.length) throw new Error(f + '.html: cannot tell what this call reaches: ' + r.unknown.join('; '));
    const missing = r.names.filter(n => !defined(n));
    if (missing.length) throw new Error(f + '.html calls nothing named: ' + missing.join(', '));
    /* Apps Script keeps a name ending in _ private: google.script.run refuses it */
    const priv = r.names.filter(n => /_$/.test(n));
    if (priv.length) throw new Error(f + '.html calls a private function, which google.script.run refuses: ' + priv.join(', '));
    seen[f] = r.names;
  }
  /* and the scan itself still sees the calls it must, or it could pass by finding nothing (renamed one? change it here too) */
  const want = { ClassroomImport: ['getBatchImportData', 'executeBatchImportAll', 'getBatchImportProgress', 'getNotThisYear', 'markPupilsLeft'],
                 Teacher: ['uiData', 'homeworkCreate', 'homeworkDelete', 'homeworkTopics', 'homeworkRemind', 'homeworkChangeDue', 'homeworkAddPupils', 'homeworkHide', 'studentMove', 'studentAccommodation'],
                 TeacherPage: ['teacherPanelData', 'teacherFindSpreadsheets', 'teacherFindAgain', 'teacherAddLink', 'teacherSetHubUrl'] };
  Object.keys(want).forEach(f => { const lost = want[f].filter(n => seen[f].indexOf(n) < 0);
    if (lost.length) throw new Error('the scan no longer finds ' + f + '.html calling ' + lost.join(', ')); });
});
ok &= run('the teacher page is reachable by keyboard and screen reader', () => {
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  if (!/role="tablist"/.test(h)) throw new Error('the tab bar is not a tablist');
  if (!/role="tab"/.test(h) || !/aria-selected/.test(h)) throw new Error('the tabs do not say which is selected');
  if (!/role="tabpanel"/.test(h)) throw new Error('the view is not a tabpanel');
  /* closed, the drawer must be inert: otherwise its Close button stays in the tab order inside an
     aria-hidden container and a keyboard user tabs into something invisible */
  if (!/id="draw"[^>]*\binert\b/.test(h)) throw new Error('the drawer is not inert while closed');
  if (!/ArrowRight/.test(h)) throw new Error('the tabs cannot be walked with the arrow keys');
  /* every control the teacher types into needs a name */
  if (/<label>Class<\/label>/.test(h) || /<label>Due<\/label>/.test(h)) {
    throw new Error('a homework class/due control still has an unlabelled <label>');
  }
});
ok &= run('a view already read is never read again — memory, then sessionStorage', () => {
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  /* Each tab costs a full spreadsheet read. Three things keep that to once per view:
     go() checks the caches BEFORE asking the server, prefetch() warms the rest in the
     background, and fetchTab() folds a second asker into the request already in flight. */
  const go = h.slice(h.indexOf('function go(tab, force)'), h.indexOf('function draw('));
  if (!go) throw new Error('go() has moved — this test can no longer see it');
  const mem = go.indexOf('cache[tab]'), sess = go.indexOf('ssGet(tab)'), net = go.indexOf('fetchTab(');
  if (mem < 0 || sess < 0 || net < 0) throw new Error('go() no longer checks memory, session and server');
  if (!(mem < sess && sess < net)) throw new Error('go() asks the server before trying the caches');
  if (!/function prefetch\(/.test(h)) throw new Error('the other views are no longer warmed in the background');
  /* the bug this pins: prefetch once looked only at memory, so every reload re-read all
     four views from the sheet even though sessionStorage still held them */
  const pf = h.slice(h.indexOf('function prefetch()'), h.indexOf('function go(tab, force)'));
  if (!/ssGet\(/.test(pf)) throw new Error('prefetch ignores sessionStorage and would re-read the sheet after a reload');
  const ft = h.slice(h.indexOf('function fetchTab('), h.indexOf('function prefetch()'));
  if (!/inflight\[tab\]\.push\(/.test(ft)) throw new Error('two askers for one view would start two spreadsheet reads');
  /* nothing may sit in memory without also being written to the session, or a reload loses it */
  const stray = [...h.matchAll(/cache\[(\w+)\]\s*=\s*r\b/g)].map(m => m[1]);
  stray.forEach(v => { if (!/ssPut\(/.test(h.slice(h.indexOf('cache[' + v + '] = r'), h.indexOf('cache[' + v + '] = r') + 120)))
    throw new Error('a payload is cached in memory but never persisted'); });
});
ok &= run('the other views are read at the same time once the first is drawn, not one after another (2 Oct 2026)', () => {
  /* Daniel: the teacher page is slow to open. prefetch() read the other five views one at a time, so the last was
     ready only after every wait added up (Homework habits last, most of a minute). Run prefetch() itself with a
     server that never answers: every view still missing must be asked for at once, and none twice. */
  const vm = require('vm');
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  const a = h.indexOf('function prefetch()'), b = h.indexOf('\n  }\n', a) + 4;
  if (a < 0 || b < a) throw new Error('prefetch() has moved — this test can no longer see it');
  const asked = [];
  const w = { ORDER: ['teachers', 'progress', 'english', 'students', 'homework', 'habits'], cur: 'teachers',
              cache: { teachers: { ok: true }, english: { ok: true } }, prefetched: false,
              ssGet: k => (k === 'students' ? { ok: true, from: 'session' } : null),
              fetchTab: (k, cb) => { asked.push(k); } };
  vm.createContext(w);
  vm.runInContext(h.slice(a, b) + '\nprefetch(); prefetch();', w);
  if (asked.join() !== 'progress,homework,habits')
    throw new Error('asked before any answer came: ' + (asked.join() || 'nothing') + ' (want progress, homework and habits together)');
  if (!w.cache.students || w.cache.students.from !== 'session') throw new Error('a view kept in sessionStorage was not taken from it');
});
ok &= run('help text never waits on the browser\u2019s own tooltip', () => {
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  /* title= is the browser's tooltip: it waits about a second before it appears, never appears at
     all on a touch screen, and cannot be reached by keyboard. Daniel reported exactly that delay.
     Every explanation goes through data-tip and our own bubble instead. */
  const natives = [...h.matchAll(/\stitle="/g)].length;
  if (natives) throw new Error(natives + ' explanation(s) still rely on the native title tooltip');
  if (!/\.className = 'tip'/.test(h) || !/setAttribute\('role','tooltip'\)/.test(h))
    throw new Error('there is no tooltip of our own');
  if (!/\.tip\{position:fixed/.test(h)) throw new Error('the tooltip bubble has no styling of its own');
  ['mouseover', 'focusin', 'keydown', 'click'].forEach(ev => {
    if (!new RegExp("addEventListener\\('" + ev + "'").test(h))
      throw new Error('the tooltip cannot be reached by ' + ev);
  });
  if (!/Escape/.test(h)) throw new Error('a tooltip that cannot be dismissed');
  /* a tap must work: the ? exists to be asked, and an iPad has no hover at all */
  if (!/closest\('button\.q'\)/.test(h)) throw new Error('tapping the ? does nothing on a touch screen');
});
ok &= run('the two sheet windows explain nothing in a title= tooltip either', () => {
  /* labs-script-050 (30 Sep 2026): the import window's two badges explained themselves only in title= */
  ['ClassroomImport', 'TeacherPage'].forEach(n => {
    const k = [...fs.readFileSync('apps-script/' + n + '.html', 'utf8').matchAll(/\stitle="/g)].length;
    if (k) throw new Error(n + '.html: ' + k + ' explanation(s) still rely on the native title tooltip');
  });
});
ok &= run('the ? is a real button, not a span pretending to be one', () => {
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  if (/<span class="q">/.test(h)) throw new Error('the ? is a span: unfocusable, untappable, unannounced');
  if (!/<button type="button" class="q"[\s\S]{0,40}?aria-label=/.test(h))
    throw new Error('the ? is not a labelled button');
  /* it must carry the tip itself, or focusing and tapping it reach nothing */
  const tile = h.slice(h.indexOf('function tile(c,k,v,s,tip)'), h.indexOf('function sec(t,d,b,n)'));
  /* the tip is built once into `t` and must land on BOTH the tile and the button — on the button
     because focus and a tap land there, on the tile so hovering anywhere over it still answers */
  if (!/<div class="tile"[^\n]*'\+t\+'/.test(tile)) throw new Error('hovering the tile itself answers nothing');
  if (!/<button type="button" class="q"'\+t\+'/.test(tile))
    throw new Error('the ? has no tip of its own, so keyboard and touch get nothing');
});
ok &= run('nothing offers a click it cannot honour', () => {
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  /* A hand cursor is a promise. The heatmap cell had one for months and was never clickable —
     the same bug as the ? that never answered: an affordance with nothing behind it. */
  const cbox = h.slice(h.indexOf('.cbox{'), h.indexOf('.cbox.done'));
  if (/cursor:pointer/.test(cbox)) throw new Error('the heatmap cell still claims to be clickable');
  if (!/cursor:help/.test(cbox)) throw new Error('the heatmap cell no longer shows it can be asked');
  /* an empty cell used to say nothing at all when hovered */
  if (!/class="cbox none" data-tip=/.test(h)) throw new Error('a not-started cell answers nothing');
});
ok &= run('anything that opens or sorts answers the keyboard too', () => {
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  if (!/closest\('\.lab__h, \.hw__h, \.hm th\.lab'\)/.test(h))
    throw new Error('Enter and Space reach none of the toggles');
  ['lab__h', 'hw__h'].forEach(c => {
    const tag = h.match(new RegExp('class="' + c + '"[^>]*'));
    if (!tag) throw new Error(c + ' has moved');
    if (!/tabindex="0"/.test(tag[0])) throw new Error(c + ' cannot be reached by keyboard');
    if (!/aria-expanded=/.test(tag[0])) throw new Error(c + ' never says whether it is open');
  });
  if (!/<th class="lab" tabindex="0"/.test(h)) throw new Error('the sortable column head is mouse-only');
});
ok &= run('a cached view says how old it is', () => {
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  /* Caching without an age is how a teacher reads last lesson's numbers as if they were live. */
  if (!/id="age"/.test(h)) throw new Error('nothing shows when the view was read');
  if (!/setInterval\(showAge/.test(h)) throw new Error('the age is written once and then silently goes stale');
  if (!/aria-live="polite"/.test(h)) throw new Error('the age changes without telling a screen reader');
  /* the age must be the SHEET read, not this page load, or a restored view claims to be new */
  const g = h.slice(h.indexOf('function ssGet('), h.indexOf('function ssPut('));
  if (!/stamp\[tab\]\s*=\s*o\.at/.test(g)) throw new Error('a restored view is stamped with the page load, not the read');
});
ok &= run('a reload draws Lab progress, Bio English and Set homework from the session copy: the page starts once both scripts have run', () => {
  /* found 1 Oct 2026: a view kept in sessionStorage is drawn at once, and those three views are defined by the SECOND
     script, so starting at the end of the first left them on "Loading" after any reload within ten minutes */
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  const end1 = h.indexOf('</script>', h.indexOf('<script>'));   /* the first plain <script>: the theme's <script data-theme-boot> in <head> is not it */
  const s1 = h.slice(h.indexOf('<script>'), end1);
  if (!/window\.vHomework = function/.test(h.slice(end1))) throw new Error('Set homework has left the second script: look at this test again');
  if (/\n  go\(BOOT\.tab \|\| 'teachers'\);\n\}\)\(\);/.test(s1)) throw new Error('the page starts before the second script has run');
  if (!/addEventListener\('DOMContentLoaded', function\(\)\{ go\(BOOT\.tab \|\| 'teachers'\); \}\)/.test(s1)) throw new Error('the page does not wait for both scripts');
});
ok &= run('the tab bar wraps rather than run past a phone screen, and a computer keeps its one row of pills', () => {
  /* found 1 Oct 2026: the five tabs are 571 px in a row, so on a 375 px phone the whole page scrolled sideways and
     Students and Set homework sat past the edge. The bar now wraps whenever one row will not fit (so a tab added later
     cannot bring the fault back), a phone shares each row out evenly, and a computer draws the page exactly as before
     (proved in headless Chrome that day: the page 375 px wide at 375, and every picture at 641 to 1280 px unchanged). */
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  const css = h.slice(h.indexOf('<style>'), h.indexOf('</style>'));
  const rule = sel => { const m = css.match(new RegExp('(?:^|\\n)\\s*' + sel.replace('.', '\\.') + '\\{([^}]*)\\}')); return m ? m[1] : null; };
  const bar = rule('.tabs'), tab = rule('.tab');
  if (!bar || !tab) throw new Error('the tab bar or its tabs have no rule of their own: look at this test again');
  if (!/flex-wrap:wrap/.test(bar) || !/max-width:100%/.test(bar))
    throw new Error('the tab bar cannot wrap: on a phone it runs past the screen edge and the whole page scrolls sideways');
  if (!/display:inline-flex/.test(bar)) throw new Error('on a computer the tab bar stretches across the page: it should be only as wide as its tabs');
  if (!/border-radius:20px/.test(bar)) throw new Error('the bar corners changed: a 999 px corner on two rows makes a stadium that the end tabs poke out of');
  if (/\bflex:/.test(tab)) throw new Error('on a computer the tabs stretch: each should keep its own width');
  /* the phone rule: every @media (max-width:N px) block, read brace by brace */
  const blocks = [];
  for (const m of css.matchAll(/@media \(max-width:(\d+)px\)\{/g)) {
    let i = m.index + m[0].length, depth = 1;
    while (i < css.length && depth) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
    blocks.push({ w: +m[1], body: css.slice(m.index + m[0].length, i - 1) });
  }
  const even = blocks.filter(b => /\.tab\{[^}]*flex:1 1 0/.test(b.body) && /\.tabs\{[^}]*width:100%/.test(b.body));
  if (!even.length) throw new Error('on a phone the rows of tabs are not shared out evenly');
  if (even.some(b => b.w < 400 || b.w > 700)) throw new Error('the even rows start at ' + even.map(b => b.w).join(', ') + ' px: not a phone width');
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
    'getNotThisYear', 'markPupilsLeft',                                      /* gated: _isAdminCaller_ (a new school year, 7 Oct 2026) */
    'teacherPanelData', 'teacherAddTeacher', 'teacherRemoveTeacher',          /* gated: _isAdminCaller_ */
    'teacherAddLink', 'teacherRemoveLink', 'teacherFindSpreadsheets', 'teacherFindAgain', 'teacherCheckSpreadsheet', 'teacherAddChecked', 'teacherUnwatchFolder', 'teacherWatchFolder',
    'teacherSetPageUrl', 'teacherSetTrackerUrl', 'teacherSetHubUrl',
    'homeworkCreate', 'homeworkDelete', 'homeworkTopics', 'homeworkRemind', 'homeworkChangeDue', 'homeworkAddPupils', 'studentMove', 'studentAccommodation',   /* gated: _hwCaller_ */
    'homeworkHide',                                                          /* gated: _hwCaller_ (the Archive, 7 Oct 2026) */
    'uiData',                                                                /* gated: _hwCaller_ */
    'installDailySummary',                                                   /* gated: _isAdminCaller_ */
    'sendDueSummaries',      /* a trigger must be callable: it only ever emails the teacher who set each
                                overdue homework, once, and hands back a count */
    'sendHomeworkReminders'  /* a trigger must be callable (1 Oct 2026): it takes nothing from its caller, posts only the
                                reminders due at that moment, each once, to the pupils who have not finished, and hands
                                back a count */
  ];
  global.ALLOWED_NAMES = ALLOWED;
  const callable = [...new Set([...SRC.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]))]
    .filter(n => !n.endsWith('_'));
  const extra = callable.filter(n => !ALLOWED.includes(n));
  if (extra.length) {
    throw new Error('reachable by anyone via google.script.run: ' + extra.join(', ') +
      '\n   Give each a trailing underscore, or gate it and add it to ALLOWED with the reason.');
  }
  /* and the ones that must stay callable really do check the caller */
  ['getBatchImportData', 'executeBatchImportAll', 'getBatchImportProgress', 'getNotThisYear', 'markPupilsLeft',
   'homeworkCreate', 'homeworkDelete', 'homeworkTopics', 'homeworkRemind', 'homeworkChangeDue', 'homeworkAddPupils', 'studentMove', 'studentAccommodation', 'uiData', 'installDailySummary', 'homeworkHide'].forEach(n => {
    const body = SRC.slice(SRC.indexOf('function ' + n + '('));
    if (!/_isAdminCaller_\(\)|_hwCaller_\(\)/.test(body.slice(0, 400))) {
      throw new Error(n + ' is callable but does not check the caller');
    }
  });
});

ok &= run('the reminders add two public names, both on the list: the 🔔 switch checks the caller, the trigger takes nothing from its caller', () => {
  ['homeworkRemind', 'sendHomeworkReminders'].forEach(n => {
    if (!defined(n)) throw new Error(n + ' is not in Code.gs');
    if (!(global.ALLOWED_NAMES || []).includes(n)) throw new Error(n + ' is not on the ALLOWED list');
  });
  if (!/_hwCaller_\(\)/.test(SRC.slice(SRC.indexOf('function homeworkRemind(')).slice(0, 400))) throw new Error('homeworkRemind does not check the caller first');
  if (!/^function sendHomeworkReminders\(\)\s*\{\s*return _hwRemindRun_\(Date\.now\(\)\);\s*\}/m.test(SRC))
    throw new Error('the trigger takes something from its caller (it must be: function sendHomeworkReminders() { return _hwRemindRun_(Date.now()); })');
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
    if (v[0][2] !== '' || v[0][4] !== '') throw new Error(l.name + ': a mark appeared before anyone saved');
  });
});
ok &= run('importing twice does not double anybody up', () => {
  _upsertStudents_([{ name: 'Ana Lee', email: 'ana@x.kr', userId: 'u1' }], '9A', 'Y9 Biology', 'c1');
  const sh = ss.getSheetByName('Digestion');
  if (sh.getLastRow() !== 3) throw new Error('now ' + (sh.getLastRow() - 1) + ' rows');
});

console.log('— saving —');
CLIENT_ID = 'CID';
const hand = (o) => String(doPost({ postData: { contents: JSON.stringify(Object.assign({
  app: 'digestion-lab', name: 'Ana Lee', form: '9A', token: TOK, complete: true,
  from: new Date(Date.now() - 3 * 864e5).toISOString(), stations: { mouth: '8/8 in 11' } }, o)) } }));
/* However many questions the Digestion Lab actually asks. Hard-coding it meant every code
   test broke the day the real count was corrected, which looked like a bug in the script. */
const QN = LABS.filter(l => l.id === 'digestion-lab')[0].questions;

const anaRow = () => ss.getSheetByName('Digestion').getRange(2, 1, 1, LAB_COLS.length).getValues()[0];

ok &= run('a save fills the row that was waiting', () => {
  const out = hand({ score: 90, total: QN, checks: 214, firstTime: 71 });
  if (!/^recorded/.test(out)) throw new Error(out);
  const sh = ss.getSheetByName('Digestion');
  if (sh.getLastRow() !== 3) throw new Error('a row was added instead of filled');
  const r = anaRow();
  if (r[2] !== 90 || r[3] !== QN) throw new Error('score not written: ' + r.slice(2, 5));
  if (Math.abs(r[4] - 90 / QN) > 1e-9) throw new Error('percentage wrong: ' + r[4]);
  /* "complete — every question right": the flag follows the score, not what the page claims (goes, Sept
     2026 — a page on a second go says complete about its own go, the record knows better) */
  if (r[5] !== 'progress') throw new Error('finished flag wrong: 90 of ' + QN + ' is part way, reads ' + r[5]);
  if (r[9] !== 1) throw new Error('saves should read 1, reads ' + r[9]);
  if (!(r[10] instanceof Date)) throw new Error('no date on the save');
});
ok &= run('nobody else was touched', () => {
  const bo = ss.getSheetByName('Digestion').getRange(3, 1, 1, LAB_COLS.length).getValues()[0];
  if (bo[0] !== 'Bo Kim' || bo[2] !== '') throw new Error('Bo Kim was written over');
});
ok &= run('a worse second go keeps the better score but still counts', () => {
  const was = anaRow()[10];
  const out = hand({ score: 40, total: QN, checks: 300, firstTime: 20 });
  const r = anaRow();
  if (r[2] !== 90) throw new Error('a worse run overwrote the best score: ' + r[2]);
  /* Checks is the evidence of the work: it keeps the MOST any save has counted (a lab sends its checks over
     every go), and Right first time never falls */
  if (r[6] !== 300) throw new Error('checks should keep the most counted, 300: ' + r[6]);
  if (r[7] !== 71) throw new Error('right first time moved on a worse run: ' + r[7]);
  if (r[9] !== 2) throw new Error('saves should read 2, reads ' + r[9]);
  if (!(r[10] >= was)) throw new Error('the date did not move');
  if (!/higher/.test(out)) throw new Error('should say an earlier one still scores higher: ' + out);
});
ok &= run('a better go replaces it', () => {
  hand({ score: QN, total: QN, checks: 118, firstTime: 99 });
  const r = anaRow();
  if (r[2] !== QN || r[5] !== 'complete' || r[6] !== 300 || r[7] !== 99) throw new Error('the better run was not kept: ' + r.slice(2, 8));
  if (r[9] !== 3) throw new Error('saves should read 3, reads ' + r[9]);
});
ok &= run('a save part-way through says so', () => {
  TOKEN_EMAIL = 'bo@x.kr';
  hand({ name: 'Bo Kim', score: 20, total: 40, complete: false });
  TOKEN_EMAIL = 'ana@x.kr';
  const bo = ss.getSheetByName('Digestion').getRange(3, 1, 1, LAB_COLS.length).getValues()[0];
  if (bo[5] !== 'progress') throw new Error('not marked as in progress: ' + bo[5]);
  if (!/NOT ALL QUESTIONS|PROGRESS/.test(bo[12])) throw new Error('no flag raised: ' + bo[12]);
});
ok &= run('a student who joined after the import gets a row', () => {
  _upsertStudents_([{ name: 'Chae Won', email: 'chae@x.kr', userId: 'u3' }], '9A', 'Y9 Biology', 'c1');
  TOKEN_EMAIL = 'chae@x.kr';
  hand({ name: 'Chae Won', score: 50, total: QN });
  TOKEN_EMAIL = 'ana@x.kr';
  const sh = ss.getSheetByName('Digestion');
  if (sh.getLastRow() !== 4) throw new Error('rows: ' + (sh.getLastRow() - 1));
  if (sh.getRange(4, 1).getValue() !== 'Chae Won') throw new Error('not the new student');
});

ok &= run('a save from a device that knows less cannot take a right answer away', () => {
  TOKEN_EMAIL = 'bo@x.kr';
  hand({ name: 'Bo Kim', score: 6, total: QN, complete: false, snap: 'mouth~a1:ff11|villus~b2:1t00' });
  hand({ name: 'Bo Kim', score: 3, total: QN, complete: false, snap: 'mouth~a1:0f10|villus~b2:0000|liver~c3:f' });
  TOKEN_EMAIL = 'ana@x.kr';
  const bo = ss.getSheetByName('Digestion').getRange(3, 1, 1, LAB_COLS.length).getValues()[0];
  if (bo[LAB_SNAP - 1] !== 'mouth~a1:ff11|villus~b2:1t00|liver~c3:f') throw new Error('snapshot not merged: ' + bo[LAB_SNAP - 1]);
  if (bo[2] !== 20) throw new Error('the best score did not stand: ' + bo[2]);
  if (_mergeSnap_('mouth~a1:ff11', 'mouth~ZZ:0000') !== 'mouth~ZZ:0000') throw new Error('a rewritten station should come from the newer snapshot');
});
/* ── Goes (Sept 2026): Practise again empties the page, never the record ──────────────────────────────
   Real fingerprints are "<count>:<hash>" — they hold a colon. The merge that split on the first colon
   passed every test above (whose fingerprints have none) and replaced the stored answers on every save. */
const S8 = '8:pppew9', S9 = '9:y3uwhy', S9b = '9:1xijdq4';
const digRow = email => { const sh = ss.getSheetByName('Digestion');
  return sh.getRange(2, 1, sh.getLastRow() - 1, LAB_COLS.length).getValues().filter(r => String(r[LAB_EMAIL - 1]).toLowerCase() === email)[0]; };
const dee = o => { TOKEN_EMAIL = 'dee@x.kr'; const out = hand(Object.assign({ name: 'Dee Park', total: QN, complete: false }, o)); TOKEN_EMAIL = 'ana@x.kr'; return out; };
const pullFor = email => { TOKEN_EMAIL = email;
  const j = JSON.parse(doPost({ postData: { contents: JSON.stringify({ action: 'progress', token: TOK }) } })); TOKEN_EMAIL = 'ana@x.kr'; return j; };
const deeSaves = body => { TOKEN_EMAIL = 'dee@x.kr';
  const out = String(doPost({ postData: { contents: JSON.stringify(Object.assign({ token: TOK, name: 'Dee Park', complete: false }, body)) } })); TOKEN_EMAIL = 'ana@x.kr'; return out; };
ok &= run('real fingerprints (they hold a colon) are merged, never replaced', () => {
  _upsertStudents_([{ name: 'Dee Park', email: 'dee@x.kr', userId: 'u9' }], '9A', 'Y9 Biology', 'c1');
  dee({ score: 17, snap: 'mouth~' + S8 + ':ffffffff|stomach~' + S9 + ':fffffffff', stations: { mouth: '8/8 in 8', stomach: '9/9 in 9', diet: '0/9' } });
  dee({ score: 0, snap: 'diet~' + S9b + ':t00000000', stations: { mouth: '0/8', stomach: '0/9', diet: '0/9 in 1' } });
  const r = digRow('dee@x.kr');
  const want = 'mouth~' + S8 + ':ffffffff|stomach~' + S9 + ':fffffffff|diet~' + S9b + ':t00000000';
  if (r[LAB_SNAP - 1] !== want) throw new Error('this go: ' + r[LAB_SNAP - 1]);
  if (r[LAB_BEST - 1] !== want) throw new Error('best: ' + r[LAB_BEST - 1]);
  if (r[2] !== 17) throw new Error('the score went down: ' + r[2]);
  if (!/mouth 8\/8 in 8/.test(r[13]) || !/stomach 9\/9 in 9/.test(r[13]) || !/diet 0\/9 in 1/.test(r[13])) throw new Error('per station: ' + r[13]);
});
ok &= run('Practise again: the page gets the new go; the first go and the best keep what was done', () => {
  const was = 'mouth~' + S8 + ':ffffffff|stomach~' + S9 + ':fffffffff';
  dee({ score: 17, snap: 'mouth~' + S8 + ':00000000@2|stomach~' + S9 + ':fffffffff', first: was, best: was,
        stations: { mouth: '8/8 in 12', stomach: '9/9 in 9', diet: '0/9 in 1' } });
  const r = digRow('dee@x.kr');
  if (!r[LAB_SNAP - 1].startsWith('mouth~' + S8 + ':00000000@2|')) throw new Error('this go: ' + r[LAB_SNAP - 1]);
  if (!r[LAB_FIRST - 1].startsWith('mouth~' + S8 + ':ffffffff|stomach~' + S9 + ':fffffffff')) throw new Error('first go: ' + r[LAB_FIRST - 1]);
  if (!r[LAB_BEST - 1].startsWith('mouth~' + S8 + ':ffffffff')) throw new Error('best: ' + r[LAB_BEST - 1]);
  if (r[LAB_AGAIN - 1] !== 'mouth: round 2, 0/8') throw new Error('practised again: ' + r[LAB_AGAIN - 1]);
  if (!/mouth 8\/8 in 12/.test(r[13])) throw new Error('per station went down: ' + r[13]);
  if (r[2] !== 17) throw new Error('score: ' + r[2]);
  if (r[7] !== 17) throw new Error('right first time should be the first go\'s 17 f: ' + r[7]);
});
ok &= run('an old page (no goes) never undoes a newer go, and its answers still count', () => {
  dee({ score: 3, snap: 'mouth~' + S8 + ':tt1f0000', stations: { mouth: '2/8 in 3' } });
  const r = digRow('dee@x.kr');
  if (!r[LAB_SNAP - 1].startsWith('mouth~' + S8 + ':00000000@2|')) throw new Error('an older go reached the page: ' + r[LAB_SNAP - 1]);
  if (!r[LAB_FIRST - 1].startsWith('mouth~' + S8 + ':ffffffff')) throw new Error('first go lost ground: ' + r[LAB_FIRST - 1]);
  if (!/mouth 8\/8 in 12/.test(r[13]) || r[2] !== 17) throw new Error('the record went down: ' + r[13] + ' / ' + r[2]);
});
ok &= run('two computers on the same go: each question keeps its better state', () => {
  dee({ score: 17, snap: 'mouth~' + S8 + ':f0000000@2', stations: { mouth: '8/8', stomach: '9/9', diet: '0/9' } });
  dee({ score: 17, snap: 'mouth~' + S8 + ':0t100000@2', stations: { mouth: '8/8', stomach: '9/9', diet: '0/9' } });
  const r = digRow('dee@x.kr');
  if (!r[LAB_SNAP - 1].startsWith('mouth~' + S8 + ':ft100000@2|')) throw new Error('this go: ' + r[LAB_SNAP - 1]);
  if (r[LAB_AGAIN - 1] !== 'mouth: round 2, 2/8') throw new Error('practised again: ' + r[LAB_AGAIN - 1]);
});
ok &= run('right first time comes from the first go: a better later go cannot raise it', () => {
  dee({ score: 17, firstTime: 0, snap: 'mouth~' + S8 + ':ffffffff@3|stomach~' + S9 + ':fffffffff@2', stations: { mouth: '8/8', stomach: '9/9', diet: '0/9' } });
  const r = digRow('dee@x.kr');
  if (r[7] !== 17) throw new Error('right first time: ' + r[7]);
  if (r[LAB_AGAIN - 1] !== 'mouth: round 3, 8/8 · stomach: round 2, 9/9') throw new Error('practised again: ' + r[LAB_AGAIN - 1]);
});
ok &= run('the pull gives this go, the first go and the best back — to that pupil only', () => {
  const me = pullFor('dee@x.kr').labs['digestion-lab'];
  if (!me || !/@3/.test(me.here) || !me.first.startsWith('mouth~' + S8 + ':ffffffff') || !me.best.startsWith('mouth~' + S8 + ':ffffffff'))
    throw new Error(JSON.stringify(me).slice(0, 300));
  /* `snap` is for a page from before goes: the first round of a station on a later round, never its letters */
  if (/@/.test(me.snap) || me.snap.indexOf('mouth~' + S8 + ':ffffffff') < 0 || me.snap.indexOf('diet~' + S9b + ':t00000000') < 0)
    throw new Error('snap: ' + me.snap);
  const ana = pullFor('ana@x.kr').labs['digestion-lab'];
  if (ana && /pppew9/.test(JSON.stringify(ana))) throw new Error('somebody else\'s record came back');
});
ok &= run('a tab made before the new columns: a save widens it, and nothing already there moves', () => {
  const sh = ss.getSheetByName('Classification');
  if (!/^recorded/.test(deeSaves({ app: 'classification-lab', score: 1, total: 64, snap: 'alive~9:abc:f00000000', stations: { alive: '1/9 in 1' } })))
    throw new Error('first save');
  for (const k of Array.from(sh.cells.keys())) if (+k.split(':')[1] > 17) sh.cells.delete(k);
  sh.maxC = 17;                                   /* as the 25 Sep script left every lab tab */
  const r = sh.getRange(2, 1, sh.getLastRow() - 1, 17).getValues().findIndex(x => String(x[LAB_EMAIL - 1]).toLowerCase() === 'dee@x.kr') + 2;
  if (r < 2) throw new Error('no row for Dee');
  sh.getRange(r, 14).setValue('alive 3/9 in 4');
  const before = sh.getRange(1, 1, sh.getLastRow(), 17).getValues();
  const pull = pullFor('dee@x.kr');                /* the pull reads it narrow, and writes nothing */
  if (!pull.ok || sh.maxC !== 17 || pull.labs['classification-lab'].first !== '') throw new Error('the pull failed or widened the tab: ' + JSON.stringify(pull).slice(0, 160) + ' / ' + sh.maxC);
  const out = deeSaves({ app: 'classification-lab', score: 5, total: 64, snap: 'alive~9:abc:fffff0000', stations: { alive: '5/9 in 6' } });
  if (!/^recorded/.test(out)) throw new Error(out);
  if (sh.maxC < 20) throw new Error('not widened: ' + sh.maxC);
  const head = sh.getRange(1, 18, 1, 3).getValues()[0].join('|');
  if (head !== 'Practised again|First round|Best ever') throw new Error('headings: ' + head);
  const after = sh.getRange(1, 1, sh.getLastRow(), 17).getValues();
  for (let i = 0; i < before.length; i++) for (let j = 0; j < 17; j++) {
    if (i + 1 === r && [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16].indexOf(j) >= 0) continue;   /* the cells a save writes */
    if (String(before[i][j]) !== String(after[i][j])) throw new Error('moved: r' + (i + 1) + 'c' + (j + 1) + ' ' + before[i][j] + ' → ' + after[i][j]);
  }
  if (sh.getRange(r, LAB_BEST).getValue() !== 'alive~9:abc:fffff0000') throw new Error('best not written');
  if (sh.getRange(r, 14).getValue() !== 'alive 5/9 in 6') throw new Error('per station: ' + sh.getRange(r, 14).getValue());
});
ok &= run('a column of the teacher\'s own after the snapshot is kept, moved to the right', () => {
  const sh = ss.getSheetByName('Circulation');
  for (const k of Array.from(sh.cells.keys())) if (+k.split(':')[1] > 17) sh.cells.delete(k);
  sh.maxC = 18;
  sh.getRange(1, 18).setValue('My notes'); sh.getRange(2, 18).setValue('keep me');
  const out = deeSaves({ app: 'circulation-lab', score: 1, total: 115, snap: 'system~7:abc:f000000', stations: { system: '1/7 in 1' } });
  if (!/^recorded/.test(out)) throw new Error(out);
  /* every column of ours after the snapshot (Station times since 1 Oct 2026, ⏱️ Homework habits), then the teacher's own */
  const ours = LAB_COLS.slice(17).map(c => c.h), head = sh.getRange(1, 18, 1, ours.length + 1).getValues()[0].join('|');
  if (head !== ours.join('|') + '|My notes') throw new Error('headings: ' + head);
  if (sh.getRange(2, LAB_COLS.length + 1).getValue() !== 'keep me') throw new Error('the teacher\'s own column lost its note');
});
/* ── Review fixes (27 Sep 2026) ── */
const partOf = (snap, id) => String(snap).split('|').filter(x => x.startsWith(id + '~'))[0] || '';
ok &= run('an old page never adds to the first round of a station past round 1, only to its best', () => {
  dee({ score: 17, snap: 'diet~' + S9b + ':000000000@2', first: 'diet~' + S9b + ':t00000000', best: 'diet~' + S9b + ':t00000000',
        stations: { mouth: '8/8', stomach: '9/9', diet: '0/9' } });
  const rft = digRow('dee@x.kr')[7];
  /* a page from before goes: no first, no best, no "@"; its own first-time count too */
  dee({ score: 17, firstTime: 40, snap: 'diet~' + S9b + ':ff0000000', stations: { mouth: '8/8', stomach: '9/9', diet: '2/9 in 2' } });
  const r = digRow('dee@x.kr');
  if (partOf(r[LAB_FIRST - 1], 'diet') !== 'diet~' + S9b + ':t00000000') throw new Error('first round: ' + partOf(r[LAB_FIRST - 1], 'diet'));
  if (partOf(r[LAB_BEST - 1], 'diet') !== 'diet~' + S9b + ':ff0000000') throw new Error('best: ' + partOf(r[LAB_BEST - 1], 'diet'));
  if (partOf(r[LAB_SNAP - 1], 'diet') !== 'diet~' + S9b + ':000000000@2') throw new Error('this round: ' + partOf(r[LAB_SNAP - 1], 'diet'));
  if (r[7] !== rft) throw new Error('right first time moved: ' + rft + ' -> ' + r[7]);
});
ok &= run('an old page still adds to the first round of a station on round 1', () => {
  const m = _snapMerge_('a~1:x:t0', 'a~1:x:t0', 'a~1:x:t0', 'a~1:x:tf', '', '', true);
  if (m.first !== 'a~1:x:tf' || m.best !== 'a~1:x:tf' || m.here !== 'a~1:x:tf') throw new Error(JSON.stringify(m));
});
ok &= run('a page from before goes is given the first round, never a later round', () => {
  if (_snapForOldPages_('a~1:x:tt@2', '') !== '') throw new Error('a later round with no first round was given');
  if (_snapForOldPages_('a~1:x:tt@2', 'a~1:y:ff') !== '') throw new Error('a first round of other questions was given');
  const got = _snapForOldPages_('a~1:x:t0|b~2:z:f1@2', 'b~2:z:ft');
  if (got !== 'a~1:x:t0|b~2:z:ft') throw new Error('mixed: ' + got);
});
/* ── Rounds and checks (7 Oct 2026): every round kept, small; the checks at each question in each round ── */
const fay = o => { TOKEN_EMAIL = 'fay@x.kr'; const out = hand(Object.assign({ name: 'Fay Lee', total: QN, complete: false }, o)); TOKEN_EMAIL = 'ana@x.kr'; return out; };
const M1 = 'mouth~' + S8 + ':';
ok &= run('rounds: a station’s round is kept with the checks at each question, and Checks counts them', () => {
  _upsertStudents_([{ name: 'Fay Lee', email: 'fay@x.kr', userId: 'u11' }], '9A', 'Y9 Biology', 'c1');
  const out = fay({ score: 2, checks: 4, snap: M1 + 'f0100000', first: M1 + 'f0100000', best: M1 + 'f0100000',
                    stations: { mouth: '2/8 in 4' }, rounds: M1 + 'f0100000.10300000', resets: 0 });
  if (!/^recorded/.test(out)) throw new Error(out);
  const r = digRow('fay@x.kr');
  if (r[LAB_ROUNDS - 1] !== M1 + 'f0100000.10300000') throw new Error('rounds: ' + r[LAB_ROUNDS - 1]);
  if (r[6] !== 4 || r[LAB_AGAIN - 1] !== '') throw new Error('checks / practised again: ' + r[6] + ' / ' + r[LAB_AGAIN - 1]);
});
ok &= run('rounds: round 2 keeps round 1; Practised again says each round and what failed again; resets are counted', () => {
  const S = { score: 3, checks: 6, snap: M1 + '00t00000@2', first: M1 + 'f0100000', best: M1 + 'f0100000',
              stations: { mouth: '2/8 in 6' }, rounds: M1 + 'f0100000.10300000;00t00000.00200000', resets: 1 };
  fay(S);
  let r = digRow('fay@x.kr');
  const want = '#1|' + M1 + 'f0100000.10300000;00t00000.00200000';
  if (r[LAB_ROUNDS - 1] !== want) throw new Error('rounds: ' + r[LAB_ROUNDS - 1]);
  if (r[6] !== 6) throw new Error('checks: ' + r[6]);
  if (r[LAB_AGAIN - 1] !== 'Round 2 in 1 station: 1 tried, 0 right, 2 checks · reset the whole lab 1× · failed again: mouth Q3')
    throw new Error('practised again: ' + r[LAB_AGAIN - 1]);
  fay(S);                                                      /* the same save again: counted once */
  fay(Object.assign({}, S, { rounds: M1 + 'f0100000.10000000', resets: 0 }));   /* an older, smaller copy: takes nothing away */
  r = digRow('fay@x.kr');
  if (r[LAB_ROUNDS - 1] !== want || r[6] !== 6) throw new Error('a save seen twice, or an older one, changed it: ' + r[LAB_ROUNDS - 1] + ' / ' + r[6]);
});
ok &= run('rounds: a page from before rounds takes nothing away; its counts stay as each station’s least', () => {
  fay({ score: 3, checks: 9, snap: M1 + '0tt00000', stations: { mouth: '2/8 in 9', stomach: '1/9 in 2' } });
  const r = digRow('fay@x.kr');
  if (r[LAB_ROUNDS - 1] !== '#1|' + M1 + '^9;f0100000.10300000;00t00000.00200000') throw new Error('rounds: ' + r[LAB_ROUNDS - 1]);
  if (r[6] !== 9 || !/mouth 2\/8 in 9/.test(r[13])) throw new Error('checks / per station: ' + r[6] + ' / ' + r[13]);
  if (!/^Round 2 in 1 station/.test(r[LAB_AGAIN - 1])) throw new Error('practised again went back to the old words: ' + r[LAB_AGAIN - 1]);
});
ok &= run('rounds: a station rewritten since keeps its old rounds whole beside the new one; each check counted once', () => {
  fay({ score: 3, checks: 1, snap: 'mouth~8:new:t0000000', rounds: 'mouth~8:new:t0000000.10000000', stations: { mouth: '0/8 in 1' } });
  const r = digRow('fay@x.kr');
  if (r[LAB_ROUNDS - 1] !== '#1|' + M1 + '^9;f0100000.10300000;00t00000.00200000|mouth~8:new:t0000000.10000000') throw new Error('rounds: ' + r[LAB_ROUNDS - 1]);
  if (r[6] !== 10 || !/mouth \d+\/8 in 10/.test(r[13])) throw new Error('checks / per station: ' + r[6] + ' / ' + r[13]);
});
ok &= run('rounds: the pull gives them back, with the resets', () => {
  const me = pullFor('fay@x.kr').labs['digestion-lab'];
  if (!me || me.rounds !== digRow('fay@x.kr')[LAB_ROUNDS - 1] || me.resets !== 1) throw new Error(JSON.stringify(me).slice(0, 300));
});
ok &= run('rounds: a row never grows without end, and folding loses no check (past 35 too)', () => {
  const list = [];
  for (let k = 1; k <= 15; k++) list.push('10000000.' + (k === 3 ? 'z' : '2') + '0000000');
  const m = _roundsMerge_('', M1 + list.join(';'), 0, null, ''), v = m.P.by['mouth~' + S8];
  if (m.total !== 63) throw new Error('total: ' + m.total);
  if (v.list.length !== RND_KEPT || v.list[1] !== '10000000.z0000000*6' || v.U !== 10) throw new Error(JSON.stringify(v));
  /* two copies folded differently (one a round further on): rounds are matched by number, never added twice */
  const ones = n => Array.from({ length: n }, () => '1.1').join(';');
  const a = _rMergeCells_('', 'x~1:q:' + ones(11)), b = _rMergeCells_('', 'x~1:q:' + ones(12));
  const both = _roundsSums_(_rParse_(_rMergeCells_(a, b)));
  if (both.total !== 12 || both.P.by['x~1:q'].list.length !== RND_KEPT) throw new Error('merged: ' + both.cell);
  if (_roundsMerge_('#3|' + M1 + '1.1', '', 2, null, '').P.resets !== 3 || _roundsMerge_('#3', '', 5, null, '').P.resets !== 5) throw new Error('resets');
  /* never more than a cell holds: past 40,000 characters the longest records shrink to their totals, and the total stands */
  const huge = Array.from({ length: 110 }, (_, k) => 's' + k + '~9:x:' + Array.from({ length: 10 }, () => 'f'.repeat(200) + '.' + '1'.repeat(200)).join(';')).join('|');
  const big = _roundsMerge_(huge, '', 0, null, '');                /* a page sends at most 45,000; a row can gather more */
  if (big.cell.length > 40000 || big.total !== 110 * 10 * 200) throw new Error('a huge row: ' + big.cell.length + ' characters, ' + big.total + ' checks');
});
ok &= run('rounds: the labs’ own sync.js and this script agree, both ways', () => {
  const p = '../../labs-shared/engine/sync.js';
  if (!fs.existsSync(p)) return;                              /* the open edition alone, away from the labs */
  const ctx = {}; require('vm').runInNewContext(fs.readFileSync(p, 'utf8'), ctx); const L = ctx.LabSync;
  const st = { mouth: { activities: new Array(8).fill({}) } }, sigOf = () => S8;
  const prog = { mouth: { go: 3, r: ['f0100000.10300000', '0t000000.02000000'], done: {}, tried: { 2: true }, per: { 2: 4 }, sig: S8, legacy: 2 } };
  const sent = L.roundsSnapshot(prog, st, ['mouth'], sigOf), all = L.counts(prog.mouth, 8).checks;
  const m = _roundsMerge_('', sent, 0, { mouth: '2/8 in ' + all }, '');
  if (all !== 12 || m.total !== all) throw new Error('the page counts ' + all + ', the script ' + m.total + ' (' + m.cell + ')');
  const fresh = {};
  L.merge(fresh, 'mouth~' + S8 + ':00t00000@3', st, sigOf);
  L.mergeRounds(fresh, m.cell, st, sigOf);
  if (L.counts(fresh.mouth, 8).checks !== all || JSON.stringify(fresh.mouth.r) !== JSON.stringify(prog.mouth.r)) throw new Error('another computer: ' + JSON.stringify(fresh.mouth));
});
/* ── the second audit of rounds (7 Oct 2026) ── */
ok &= run('rounds (audit): a page’s unfolded rounds meet the sheet’s folded ones round by round; nothing is dropped', () => {
  const twos = (k) => Array.from({ length: k }, () => '1.2').join(';'), ones = (k) => Array.from({ length: k }, () => '1.1').join(';');
  const stored = _rMergeCells_('', 'x~1:q:' + twos(11));               /* the sheet: round 11 on the page, rounds 2–3 folded */
  const m = _roundsMerge_(stored, 'x~1:q:' + ones(12), 0, null, '');    /* a page one round on, its 11 finished rounds unfolded */
  if (m.total !== 23) throw new Error('total ' + m.total + ' (23 wanted): ' + m.cell);
});
ok &= run('rounds (audit): a number past 7 digits is a number, never a round; resets at most 999; a station called "constructor" is a station', () => {
  const v = _rParse_('x~1:q:+99999999;^123456789;1.1').by['x~1:q'];
  if (v.list.length !== 1 || v.U !== 9999999 || v.F !== 9999999) throw new Error(JSON.stringify(v));
  if (_roundsMerge_('', '', 1e12, null, '').P.resets !== 999) throw new Error('resets not capped');
  const c = _roundsMerge_('', 'constructor~1:q:1.3', 0, { constructor: '1/1 in 3' }, '');
  if (c.total !== 3 || c.by.constructor !== 3) throw new Error('constructor: ' + c.total + ' / ' + c.by.constructor);
});
ok &= run('rounds (audit): Practised again also says a station a page from before moved on, when other stations have rounds', () => {
  const P = _rParse_('mouth~8:a:f1000000.12000000;0t000000.03000000');
  const say = _roundsSay_(P, { mouth: 'The mouth' }, 'mouth~8:a:0t000000@2|liver~5:b:ft000@2', {});
  if (!/^Round 2 in 2 stations: 3 tried, 1 right, 3 checks/.test(say)) throw new Error(say);
  const only = _roundsSay_(_rParse_('mouth~8:a:f1000000.12000000'), {}, 'liver~5:b:ft000@2', {});
  if (only !== 'Round 2 in 1 station: 2 tried, 1 right') throw new Error('letters only: ' + only);
});
ok &= run('rounds (audit): round 1’s checks for Stuck are every check less the later rounds’: never only what the cell holds, never more than Checks', () => {
  const e1 = { checks: 50 }; _roundsForTeacher_(e1, null, 'mouth~8:a:f1000000.12000000');                 /* 3 in the cell, 50 in all */
  const e2 = { checks: 30 }; _roundsForTeacher_(e2, null, '#2');
  const e3 = { checks: 9 };  _roundsForTeacher_(e3, null, 'mouth~8:a:f1000000.12000000;0t000000.03000000|mouth~8:old:^7');
  if (e1.c1 !== 50 || e2.c1 !== 30 || e3.c1 !== 6) throw new Error([e1.c1, e2.c1, e3.c1].join(' / '));
});
ok &= run('rounds (audit): the pull gives the Rounds column only when it is ours, never a teacher’s own column there', () => {
  const sh = ss.getSheetByName('Plants');
  const keep = sh.getRange(1, LAB_ROUNDS).getValue();
  sh.getRange(1, LAB_ROUNDS).setValue('My notes');
  const no = _roundsColOk_(sh);
  sh.getRange(1, LAB_ROUNDS).setValue(keep);
  if (no !== false || _roundsColOk_(ss.getSheetByName('Digestion')) !== true) throw new Error('column check: ' + no);
});
ok &= run('a pupil whose answers are all still wrong gets them back too (Score 0)', () => {
  _upsertStudents_([{ name: 'Eli Kim', email: 'eli@x.kr', userId: 'u10' }], '9A', 'Y9 Biology', 'c1');
  if (_hasPractice_('eli@x.kr')) throw new Error('practice before any answer');
  if (pullFor('eli@x.kr').labs['digestion-lab']) throw new Error('a row with nothing saved came back');
  TOKEN_EMAIL = 'eli@x.kr';
  const t = 'mouth~' + S8 + ':tt000000';
  const out = hand({ name: 'Eli Kim', score: 0, total: QN, complete: false, snap: t, first: t, best: t, stations: { mouth: '0/8 in 2' } });
  TOKEN_EMAIL = 'ana@x.kr';
  if (!/^recorded/.test(out)) throw new Error(out);
  const me = pullFor('eli@x.kr').labs['digestion-lab'];
  if (!me || me.done !== 0 || me.here !== t || me.snap !== t || me.first !== t) throw new Error(JSON.stringify(me));
  if (!_hasPractice_('eli@x.kr')) throw new Error('practice not seen');
  if (_hasPractice_('nobody@x.kr')) throw new Error('practice for somebody with no row');
});
ok &= run('notes typed under no heading are moved right, never written over', () => {
  const sh = ss.getSheetByName('Plants');
  if (!sh) throw new Error('no Plants tab');
  for (const k of Array.from(sh.cells.keys())) if (+k.split(':')[1] > 17) sh.cells.delete(k);
  sh.maxC = 18;
  sh.getRange(3, 18).setValue('my note');                 /* no heading above it */
  const out = deeSaves({ app: 'plants-lab', score: 1, total: 116, snap: 'x~3:abc:f00', stations: { x: '1/3 in 1' } });
  if (!/^recorded/.test(out)) throw new Error(out);
  const ours = LAB_COLS.slice(17).map(c => c.h), head = sh.getRange(1, 18, 1, ours.length).getValues()[0].join('|');
  if (head !== ours.join('|')) throw new Error('headings: ' + head);
  if (sh.getRange(3, LAB_COLS.length + 1).getValue() !== 'my note') throw new Error('the note was not kept: ' + sh.getRange(3, LAB_COLS.length + 1).getValue());
});
ok &= run('a heading of ours is known however it is dressed', () => {
  const sh = ss.getSheetByName('Classification');
  sh.getRange(1, 18).setValue('\u270e practised again ');
  cacheStore.delete('LABCOLS' + LAB_COLS.length + '_Classification');
  const w = sh.maxC;
  const out = deeSaves({ app: 'classification-lab', score: 5, total: 64, snap: 'alive~9:abc:fffff0000', stations: { alive: '5/9 in 6' } });
  if (!/^recorded/.test(out)) throw new Error(out);
  if (sh.maxC !== w || sh.getRange(1, 19).getValue() !== 'First round') throw new Error('a column was added: ' + w + ' -> ' + sh.maxC);
});
ok &= run('nothing about completion codes is left', () => {
  if (typeof _code_ !== 'undefined' || typeof checkCode_ !== 'undefined') throw new Error('the code functions are still there');
  if (LAB_COLS[9].h !== 'Saves' || LAB_COLS[10].h !== 'Last saved') throw new Error('columns still say hand-in: ' + LAB_COLS[9].h + ', ' + LAB_COLS[10].h);
  if (!LAB_COLS[11].hide) throw new Error('the old Code column should be hidden');
  const cells = ss.getSheetByName('Setup').getRange(1, 1, 30, 2).getValues().flat().map(String);
  if (cells.some(v => /completion code/i.test(v))) throw new Error('the Setup tab still offers to check a code');
});

console.log('— who is turned away —');
ok &= run('somebody not on the roster leaves no trace', () => {
  TOKEN_EMAIL = 'stranger@elsewhere.com';
  const before = ss.getSheetByName('Digestion').getLastRow();
  const rejBefore = ss.getSheetByName('Rejected') ? ss.getSheetByName('Rejected').getLastRow() : 0;
  const out = hand({ name: 'A Stranger', score: QN, total: QN });
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
  hand({ score: 999, total: QN });
  if (ss.getSheetByName('Rejected').getLastRow() <= rej) throw new Error('not quarantined');
  if (anaRow()[2] !== best) throw new Error('a rejected hand-in still changed the mark');
});
ok &= run('a hand-in for a lab that does not exist is ignored', () => {
  const out = String(doPost({ postData: { contents: JSON.stringify({ app: 'not-a-lab', score: 1, total: 1, token: TOK }) } }));
  if (!/unknown lab/.test(out)) throw new Error(out);
});

console.log('— the Setup tab buttons —');
const setupSheet = () => ss.getSheetByName('Setup');
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
  const want = ['Setup', 'Labs', 'Students', T_ENGLISH, T_HOMEWORK, T_TEACHERS, T_LINKS]
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
   THE AUDIT — every lab in the register, built or not, and a
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

ok &= run('every lab in the register records a save', () => {
  const failed = [];
  LABS.forEach(lab => {
    const total = lab.questions || 50;
    const score = Math.max(1, Math.floor(total / 3));
    const out = hand({ app: lab.id, name: 'Zed Audit', score, total, complete: false });
    if (!/^recorded/.test(out)) { failed.push(lab.name + ': ' + out); return; }
    const row = rowOf(lab.name, 'zed@x.kr');
    if (!row) { failed.push(lab.name + ': recorded, but no row carries the address'); return; }
    if (Number(row[2]) !== score || Number(row[3]) !== total) {
      failed.push(lab.name + ': tab says ' + row[2] + '/' + row[3] + ', wanted ' + score + '/' + total);
    }
  });
  if (failed.length) throw new Error(failed.length + ' of ' + LABS.length + ' labs failed:\n   ' + failed.join('\n   '));
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
  const out = hand({ app: 'digestion-lab', name: 'Zed Audit', score: QN, total: QN, complete: true });
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
                     complete: false });
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

console.log('— importing several classes: a job that carries on by itself —');
/* Daniel, 6 Oct 2026: importing several classes at once "got stuck", and 11C came in as 8 of 16. The import was ONE call
   (every class, then all the formatting); Google stops a call after six minutes; and a pupil already on the Students tab
   cost four to eight sheet calls of their own, so the stop could land part way through a class. Now every read comes
   before every write, a new pupil's row is ONE write, and the import is a JOB: saved after each class, handing the rest to
   a one-off trigger a minute later when its time is nearly up, and picked up by a safety trigger if a piece is stopped.
   The window still makes ONE call (it may be closed: the reflection's import has promised that since September). */
{
  const STU = () => ss.getSheetByName('Students');
  const head = () => STU().getRange(1, 1, 1, STU().getLastColumn()).getValues()[0].map(h => String(h || '').replace(/^✎\s*/, '').trim());
  const col = name => head().indexOf(name) + 1;
  const stuRows = () => { const sh = STU(), n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, sh.getLastColumn()).getValues() : []; };
  const stuRow = email => { const ec = col('School email'); return stuRows().find(r => String(r[ec - 1]).toLowerCase() === email) || null; };
  const people = (pre, n) => Array.from({ length: n }, (_, i) => ({ userId: '117346278912345' + String(670000 + i),
    profile: { name: { fullName: pre + ' ' + i }, emailAddress: pre.toLowerCase() + i + '@x.kr' } }));
  const courses = {};
  const classroom = (onList) => ({ Courses: { list: () => ({ courses: [] }), Students: { list: c => { if (onList) onList(c); return { students: courses[c] || [] }; } } } });
  const importOne = (list, code, cid, job) => {      /* ONE class, as a piece of the job does it */
    courses[cid] = list; global.Classroom = classroom();
    try { return _importOneClass_({ courseId: cid, classCode: code, courseName: 'Course ' + code }, job); }
    finally { global.Classroom = undefined; }
  };
  const said = (job) => cacheWrites.filter(([k]) => k === 'BATCH_IMPORT_' + job).map(([, v]) => JSON.parse(v));
  const ours = () => TRIGGERS.filter(t => t.getHandlerFunction() === 'continueBatchImport_');
  const OURS = /^(few|many|fresh|noad|twice|busy|late|slow|dead|run)\d+@x\.kr$/;
  const tidyUp = () => {          /* take this section's pupils off the Students tab again, so later tests see what they expect */
    const sh = STU(), ec = col('School email'), v = sh.getRange(2, 1, sh.getLastRow() - 1, ec).getValues();
    for (let i = v.length - 1; i >= 0; i--) {
      if (OURS.test(String(v[i][ec - 1]).toLowerCase()) || /^(Noad|Few|Many|Fresh|Twice|Busy|Late|Slow|Dead|Run) \d+$/.test(String(v[i][0]))) sh.deleteRows(i + 2, 1);
    }
  };
  const realNow = Date.now;

  try {
    ok &= run('re-importing a class already on the Students tab costs the same few sheet calls, whatever its size', () => {
      /* the 5 Oct case: every pupil already here, their Classroom ids stored as rounded numbers, and a new class code */
      const few = people('Few', 8), many = people('Many', 24);
      importOne(few, '7P', 'cP', 'jobP0'); importOne(many, '7P', 'cP2', 'jobP0');
      const uc = col('Classroom user id'), ec = col('School email'), sh = STU();
      sh.getRange(2, 1, sh.getLastRow() - 1, ec).getValues().forEach((r, i) => {
        if (/^(few|many)\d+@x\.kr$/.test(String(r[ec - 1]))) sh.getRange(i + 2, uc).setValue(1.17346278912346e20);
      });
      __CALLS = 0; const a = importOne(few, '7Q', 'cP', 'jobP1'); const cFew = __CALLS;
      __CALLS = 0; const b = importOne(many, '7Q', 'cP2', 'jobP1'); const cMany = __CALLS;
      if (a.status !== 'success' || b.status !== 'success') throw new Error('an import failed: ' + JSON.stringify([a, b]));
      if (a.moved !== 8 || b.moved !== 24) throw new Error('moved ' + a.moved + ' and ' + b.moved + ', wanted 8 and 24');
      if (cMany > 20) throw new Error('24 pupils cost ' + cMany + ' sheet calls (8 cost ' + cFew + '): it still reads and writes a pupil at a time');
      if (cMany - cFew > 2) throw new Error('the calls grow with the class: 8 pupils ' + cFew + ', 24 pupils ' + cMany);
      const r = stuRow('many23@x.kr');
      if (!r || r[1] !== '7Q') throw new Error('the last pupil is not in 7Q: ' + (r && r[1]));
      if (r[uc - 1] !== '117346278912345670023') throw new Error('the rounded id was not repaired: ' + r[uc - 1]);
      const row = stuRows().findIndex(x => x[ec - 1] === 'many23@x.kr') + 2;
      if (!sh.fmt || sh.fmt.get(row + ':' + uc) !== '@') throw new Error('the repaired id is not stored as text');
      if (typeof b.listed !== 'number' || b.listed !== 24) throw new Error('the class line does not say how many Classroom listed: ' + b.listed);
    });

    ok &= run('a new pupil’s row is ONE write: a stop between two writes can never leave a name without its address', () => {
      const keep = Range.prototype.setValues, writes = [];
      Range.prototype.setValues = function (v) { if (this.sheet.name === 'Students') writes.push({ r: this.r, c: this.c, nr: this.nr, nc: this.nc }); return keep.call(this, v); };
      let out;
      try { out = importOne(people('Fresh', 3), '7F', 'cF', 'jobF'); } finally { Range.prototype.setValues = keep; }
      if (out.status !== 'success' || out.added !== 3) throw new Error('did not add three: ' + JSON.stringify(out));
      const ec = col('School email');
      const nameOnly = writes.filter(w => w.c <= 2 && w.c + w.nc - 1 < ec);
      if (nameOnly.length) throw new Error('names went in without their addresses, in a write of their own: ' + JSON.stringify(nameOnly));
      if (writes.filter(w => w.c === 1 && w.c + w.nc - 1 >= ec && w.nr === 3).length !== 1) throw new Error('the three rows were not one write: ' + JSON.stringify(writes));
      const r = stuRow('fresh2@x.kr');
      if (!r || r[0] !== 'Fresh 2' || r[1] !== '7F' || !(r[col('Imported') - 1] instanceof Date)) throw new Error('the row is not whole: ' + JSON.stringify(r));
    });

    ok &= run('the import is ONE call: the classes, then the formatting, then Finished with each class’s count; the job and its trigger are gone', () => {
      cacheWrites.length = 0; courses.cG = people('Late', 3);
      global.Classroom = classroom();
      let out;
      try { out = executeBatchImportAll([{ courseId: 'cG', classCode: '7G', courseName: 'Y7 G' }], 'jobG'); } finally { global.Classroom = undefined; }
      if (!out || !out[0] || out[0].status !== 'success' || out[0].added !== 3) throw new Error('the class did not import: ' + JSON.stringify(out));
      const seen = said('jobG');
      if (!seen.some(o => !o.done && /formatting/i.test(o.phase || ''))) throw new Error('it never said it was formatting');
      const last = seen[seen.length - 1];
      if (!last || !last.done || !last.counts || last.counts['7G'] !== 3) throw new Error('the end does not say Finished with each class’s count: ' + JSON.stringify(last).slice(0, 200));
      if (seen.slice(0, -1).some(o => o.done)) throw new Error('it said done before it was');
      if (!rowOf('Digestion', 'late0@x.kr')) throw new Error('the formatting did not give the new pupils their lab rows');
      if (props.get(IMPORT_JOB_KEY)) throw new Error('the finished job was left in Script Properties');
      if (ours().length) throw new Error('a carry-on trigger was left behind: ' + ours().length);
    });

    ok &= run('out of time: the job saves where it is and hands the rest to a trigger a minute later, which finishes it (the window may be closed)', () => {
      let clock = realNow.call(Date);
      Date.now = () => clock;
      ['cS1', 'cS2', 'cS3'].forEach((c, i) => { courses[c] = people('Slow', 3).map((p, k) => ({ userId: p.userId + i, profile: { name: { fullName: 'Slow ' + (i * 3 + k) }, emailAddress: 'slow' + (i * 3 + k) + '@x.kr' } })); });
      cacheWrites.length = 0;
      global.Classroom = classroom(() => { clock += 96 * 1000; });   /* each class "takes" 1.6 minutes */
      let out;
      try {
        out = executeBatchImportAll([{ courseId: 'cS1', classCode: '7S' }, { courseId: 'cS2', classCode: '7S' }, { courseId: 'cS3', classCode: '7T' }], 'jobS');
        const mid = said('jobS').pop();
        if (out.filter(r => r.status === 'success').length !== 2 || out[2].status !== 'pending') throw new Error('the first piece did not stop after two classes: ' + JSON.stringify(out).slice(0, 200));
        if (!mid || mid.done || !mid.continuing || !/carries on by itself/.test(mid.phase)) throw new Error('the window was not told it carries on by itself: ' + JSON.stringify(mid).slice(0, 200));
        const job = JSON.parse(props.get(IMPORT_JOB_KEY) || 'null');
        if (!job || job.i !== 2 || job.phase !== 'classes') throw new Error('where the job is was not saved: ' + JSON.stringify(job));
        if (ours().length !== 1 || ours()[0].after !== 60 * 1000) throw new Error('not ONE trigger a minute later: ' + JSON.stringify(ours().map(t => t.after)));
        clock += 60 * 1000;
        continueBatchImport_();
      } finally { global.Classroom = undefined; Date.now = realNow; }
      const end = said('jobS').pop();
      if (!end || !end.done || end.results.filter(r => r.status === 'success').length !== 3) throw new Error('the trigger did not finish the job: ' + JSON.stringify(end).slice(0, 240));
      if (!stuRow('slow8@x.kr') || stuRow('slow8@x.kr')[1] !== '7T') throw new Error('the last class is not in');
      if (!rowOf('Digestion', 'slow8@x.kr')) throw new Error('the formatting did not run at the end');
      if (props.get(IMPORT_JOB_KEY) || ours().length) throw new Error('the job or its trigger was left behind');
    });

    ok &= run('Google will not set the trigger that carries it on: the window is told at once, with the class not done, and no job is left waiting', () => {
      let clock = realNow.call(Date);
      Date.now = () => clock;
      ['cW1', 'cW2'].forEach((c, i) => { courses[c] = [{ userId: 'w' + i, profile: { name: { fullName: 'Slow ' + (20 + i) }, emailAddress: 'slow' + (20 + i) + '@x.kr' } }]; });
      cacheWrites.length = 0;
      global.Classroom = classroom(() => { clock += 4 * 60 * 1000; });   /* the first class "takes" four minutes */
      const keepNew = ScriptApp.newTrigger;
      ScriptApp.newTrigger = (fn) => { if (fn === 'continueBatchImport_') throw new Error('This script has too many triggers. Triggers must be deleted from the script before more can be added.'); return keepNew(fn); };
      let out;
      try { out = executeBatchImportAll([{ courseId: 'cW1', classCode: '7W' }, { courseId: 'cW2', classCode: '7W' }], 'jobW'); }
      finally { global.Classroom = undefined; Date.now = realNow; ScriptApp.newTrigger = keepNew; }
      const end = said('jobW').pop();
      if (!end || !end.done || !end.noTrigger) throw new Error('the window was not told the import stopped: ' + JSON.stringify(end).slice(0, 200));
      if (end.results[0].status !== 'success' || end.results[1].status !== 'pending' || end.namesIn) throw new Error('what it says of each class: ' + JSON.stringify(end.results));
      if (!end.counts || end.counts['7W'] !== 1) throw new Error('no count for the class that went in: ' + JSON.stringify(end.counts));
      if (props.get(IMPORT_JOB_KEY)) throw new Error('the job was left waiting for a trigger that never comes (and blocks the next import for ten minutes)');
      if (!out || out[1].status !== 'pending') throw new Error('the first answer: ' + JSON.stringify(out));
    });

    ok &= run('a piece stopped part way is picked up by the safety trigger: the class it was on is done again, nobody twice', () => {
      courses.cD1 = people('Dead', 2); courses.cD2 = people('Dead', 4).slice(2);
      global.Classroom = classroom();
      try {
        importOne(courses.cD1, '7D', 'cD1', 'jobD');          /* class 1 went in before the piece was stopped… */
        const full = courses.cD2;
        importOne(full.slice(0, 1), '7D', 'cD2', 'jobD');       /* …and class 2 half way */
        courses.cD2 = full;
        _saveImportJob_({ id: 'jobD', sels: [{ courseId: 'cD1', classCode: '7D' }, { courseId: 'cD2', classCode: '7D' }], i: 1, phase: 'classes',
                          tickAt: Date.now() - 9 * 60 * 1000, finishTries: 0 });
        _publish_('jobD', [{ status: 'success', added: 2, skipped: 0, moved: 0 }, { status: 'pending' }], false, '');
        global.Classroom = classroom();                       /* importOne put the stand-in away */
        continueBatchImport_();
      } finally { global.Classroom = undefined; }
      const end = said('jobD').pop();
      if (!end || !end.done || end.results[1].status !== 'success' || end.results[1].added !== 1 || end.results[1].skipped !== 1)
        throw new Error('the class it was on was not done again: ' + JSON.stringify(end).slice(0, 240));
      const ec = col('School email'), dead = stuRows().filter(r => /^dead\d+@x\.kr$/.test(String(r[ec - 1])));
      if (dead.length !== 4) throw new Error('a pupil was added twice, or lost: ' + dead.length);
    });

    ok &= run('a second import while one runs is refused in words; one silent for ten minutes is dead and is replaced', () => {
      _saveImportJob_({ id: 'jobRun', sels: [{ courseId: 'cX', classCode: '7X' }], i: 0, phase: 'classes', tickAt: Date.now(), finishTries: 0 });
      courses.cB2 = people('Run', 1);
      global.Classroom = classroom();
      try {
        const r = executeBatchImportAll([{ courseId: 'cB2', classCode: '7B' }], 'jobOther');
        if (!r[0] || r[0].status !== 'busy' || !/Another import is still running/.test(r[0].error)) throw new Error('not refused: ' + JSON.stringify(r));
        if (stuRow('run0@x.kr')) throw new Error('it imported anyway');
        _saveImportJob_({ id: 'jobRun', sels: [{ courseId: 'cX', classCode: '7X' }], i: 0, phase: 'classes', tickAt: Date.now() - 11 * 60 * 1000, finishTries: 0 });
        const r2 = executeBatchImportAll([{ courseId: 'cB2', classCode: '7B' }], 'jobOther');
        if (!r2[0] || r2[0].status !== 'success') throw new Error('a dead job still blocked the import: ' + JSON.stringify(r2));
      } finally { global.Classroom = undefined; _clearImportJob_(); _deleteImportTriggers_(); }
    });

    ok &= run('a pupil Classroom gives no address for is not added, and is named', () => {
      const list = people('Noad', 2); delete list[1].profile.emailAddress;
      const out = importOne(list, '7N', 'cN', 'jobN');
      if (out.status !== 'success' || out.added !== 1) throw new Error('wanted one added: ' + JSON.stringify(out));
      if (JSON.stringify(out.noEmail) !== JSON.stringify(['Noad 1'])) throw new Error('the pupil with no address is not named: ' + JSON.stringify(out.noEmail));
      if (stuRows().some(r => r[0] === 'Noad 1')) throw new Error('a row with no address was added: nothing can ever match it, and the next import adds them again');
      if (out.listed !== 1) throw new Error('listed should count the pupils who can be added: ' + out.listed);
    });

    ok &= run('a pupil in two of the courses ticked in one import: the second class says so', () => {
      const three = people('Twice', 3);
      importOne(three, '7R', 'cR', 'jobT');
      const out = importOne(three.slice(0, 2), '7S', 'cS', 'jobT');
      const c = (out.clashes || []).map(x => x.name + '>' + x.was).sort();
      if (JSON.stringify(c) !== JSON.stringify(['Twice 0>7R', 'Twice 1>7R'])) throw new Error('the clash is not named: ' + JSON.stringify(out.clashes));
      if (stuRow('twice0@x.kr')[1] !== '7S') throw new Error('the pupil is not in the class imported last');
      /* a later import on its own is a pupil changing class, not a clash */
      const later = importOne(three.slice(0, 1), '7R', 'cR', 'jobLater');
      if (later.moved !== 1 || (later.clashes || []).length) throw new Error('a later import named a clash: ' + JSON.stringify(later));
    });

    /* ── the audit (7 Oct 2026): what the Test System and the reflection got the same day ── */
    ok &= run('audit: a second import, refused, is over at once: its record says done and why (it spun twelve minutes)', () => {
      _saveImportJob_({ id: 'jobRun2', sels: [{ courseId: 'cX', classCode: '7X' }], i: 0, phase: 'classes', tickAt: Date.now(), finishTries: 0 });
      cacheWrites.length = 0; global.Classroom = classroom();
      try { executeBatchImportAll([{ courseId: 'cB2', classCode: '7B' }], 'jobRefused'); } finally { _clearImportJob_(); global.Classroom = undefined; }
      const end = said('jobRefused').pop();
      if (!end || !end.done || !end.stopped || !/Another import is still running/.test(end.phase || '')) throw new Error(JSON.stringify(end));
    });
    ok &= run('audit: a class Google stopped twice is passed over in words, and the next class is imported (it was tried every 8 minutes for ever)', () => {
      courses.cK1 = people('Busy', 1); courses.cK2 = people('Twice', 2).map((p, k) => ({ userId: 'k' + k, profile: { name: { fullName: 'Twice ' + (20 + k) }, emailAddress: 'twice' + (20 + k) + '@x.kr' } }));
      _saveImportJob_({ id: 'jobK', sels: [{ courseId: 'cK1', classCode: '7K' }, { courseId: 'cK2', classCode: '7K' }], i: 0, phase: 'classes',
                        tickAt: Date.now() - 9 * 60 * 1000, finishTries: 0, tries: { 0: 2 } });
      cacheWrites.length = 0; global.Classroom = classroom();
      try { continueBatchImport_(); } finally { global.Classroom = undefined; }
      const end = said('jobK').pop();
      if (!end || !end.done || end.results[0].status !== 'error' || !/stopped this class twice/.test(end.results[0].error || '') || end.results[1].status !== 'success')
        throw new Error(JSON.stringify(end).slice(0, 300));
      if (props.get(IMPORT_JOB_KEY)) throw new Error('the job stayed');
    });
    ok &= run('audit: a class done again after a stop builds the tabs, even when it adds nobody new (its pupils had no lab rows)', () => {
      courses.cQ = [{ userId: 'q1', profile: { name: { fullName: 'Twice 30' }, emailAddress: 'twice30@x.kr' } }];
      importOne(courses.cQ, '7Q2', 'cQ', 'jobQ');                     /* written before the stop: on the Students tab, no lab rows */
      _saveImportJob_({ id: 'jobQ', sels: [{ courseId: 'cQ', classCode: '7Q2' }], i: 0, phase: 'classes', tickAt: Date.now() - 9 * 60 * 1000, finishTries: 0, tries: { 0: 1 } });
      cacheWrites.length = 0; global.Classroom = classroom();
      try { continueBatchImport_(); } finally { global.Classroom = undefined; }
      const end = said('jobQ').pop();
      if (!end || !end.done || !end.built || end.results[0].added !== 0) throw new Error(JSON.stringify(end).slice(0, 300));
      if (!rowOf('Digestion', 'twice30@x.kr')) throw new Error('no lab row for the pupil written before the stop');
    });
    ok &= run('the final verification audit (8 Oct 2026): an import whose Tidy up does not restyle the Students tab says so in its last words, and the import window prints it', () => {
      const sh = ss.getSheetByName(T_STUDENTS), keep = { cells: new Map(sh.cells), maxC: sh.maxC };
      const at = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).replace(/^✎\s*/, '').trim()).indexOf('Labs started') + 1;
      try {
        if (!at) throw new Error('set-up: no Labs started column');
        sh.moveColumns(sh.getRange(1, at), 3);                       /* Labs started dragged next to the names */
        _saveImportJob_({ id: 'jobG', sels: [{ courseId: 'cQ', classCode: '7Q2' }], i: 0, phase: 'classes', tickAt: Date.now() - 9 * 60 * 1000, finishTries: 0, tries: { 0: 1 } });
        cacheWrites.length = 0; global.Classroom = classroom();
        try { continueBatchImport_(); } finally { global.Classroom = undefined; }
        const end = said('jobG').pop();
        if (!end || !end.done || !end.built || end.phase !== 'Finished.' || !/^The Students tab was NOT restyled/.test(end.studentsNote || '')) throw new Error(JSON.stringify(end).slice(0, 300));
        /* the import window's own script, on a stand-in page: it prints the note, never "Every tab is built and formatted"
           (the final verification audit: a note inside the phase was dropped by the window) */
        const vm = require('vm'), page = fs.readFileSync('apps-script/ClassroomImport.html', 'utf8');
        const els = new Map(), el = (id) => { if (!els.has(id)) els.set(id, { id, innerHTML: '', textContent: '', style: {}, classList: { add() {}, remove() {}, toggle() {} },
          insertAdjacentHTML(w, x) { this.innerHTML += x; }, remove() { els.delete(id); }, querySelectorAll: () => [], addEventListener() {} }); return els.get(id); };
        const span = () => { const o = { t: '' }; Object.defineProperty(o, 'textContent', { set(v) { this.t = String(v); }, get() { return this.t; } });
          Object.defineProperty(o, 'innerHTML', { get() { return this.t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }); return o; };
        const quiet = () => { const p = new Proxy({}, { get: (t, k) => (/^with/.test(String(k)) ? () => p : () => {}) }); return p; };
        const win = { document: { getElementById: el, createElement: span, querySelectorAll: () => [] }, google: { script: { get run() { return quiet(); }, host: { close() {} } } },
          setInterval: () => 1, clearInterval() {}, setTimeout: () => 0, console, Date, JSON, Math, String, Object, Array, __f: end };
        vm.createContext(win);
        vm.runInContext(page.slice(page.indexOf('<script>') + 8, page.lastIndexOf('</script>')), win);
        vm.runInContext('SELS = [{ courseId: "cQ", classCode: "7Q2", courseName: "Q", idx: 0, _result: __f.results[0] }]; RUN = SELS; summary(__f);', win);
        const shown = el('bar').innerHTML;
        if (!/NOT restyled/.test(shown) || /Every tab is built and formatted/.test(shown)) throw new Error('the import window shows: ' + shown.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));
      } finally { sh.cells = keep.cells; sh.maxC = keep.maxC; }
    });
    ok &= run('audit: a job Google will not keep is said in words and is over (it imported nothing, in silence)', () => {
      const keepSet = PropertiesService.getScriptProperties;
      PropertiesService.getScriptProperties = () => { const p = keepSet(); return Object.assign({}, p, { setProperty: (k, v) => { if (k === IMPORT_JOB_KEY) throw new Error('You have exceeded the property storage quota.'); return p.setProperty(k, v); } }); };
      cacheWrites.length = 0; global.Classroom = classroom(); let r;
      try { r = executeBatchImportAll([{ courseId: 'cB2', classCode: '7B' }], 'jobFull'); } finally { PropertiesService.getScriptProperties = keepSet; global.Classroom = undefined; }
      const end = said('jobFull').pop();
      if (!r || !r[0] || r[0].status !== 'error' || !/would not keep where it is/.test(r[0].error || '') || !end || !end.done || !end.stopped) throw new Error(JSON.stringify([r, end]).slice(0, 300));
    });
    ok &= run('audit: the carry-on trigger is made BEFORE the old one goes (a refusal left none at all)', () => {
      TRIGGERS.push({ getHandlerFunction: () => 'continueBatchImport_', after: 480000, getUniqueId: () => 'OLD' });
      const keepNew = ScriptApp.newTrigger;
      ScriptApp.newTrigger = (fn) => { if (fn === 'continueBatchImport_') throw new Error('too many triggers'); return keepNew(fn); };
      let made;
      try { made = _scheduleImport_(60000); } finally { ScriptApp.newTrigger = keepNew; }
      const left = ours().map(t => (t.getUniqueId ? t.getUniqueId() : '?'));
      _deleteImportTriggers_();
      if (made !== false || left.join() !== 'OLD') throw new Error('made ' + made + ', left ' + JSON.stringify(left));
    });
    ok &= run('audit: a class code over 16 characters is refused in words, never cut (two such codes merged in silence)', () => {
      courses.cL = people('Busy', 1);
      global.Classroom = classroom(); let r;
      try { r = executeBatchImportAll([{ courseId: 'cL', classCode: 'IGCSE-BIO-10C-SET2' }], 'jobLong'); } finally { global.Classroom = undefined; }
      if (!r || !r[0] || r[0].status !== 'error' || !/at most 16 characters/.test(r[0].error || '')) throw new Error(JSON.stringify(r));
    });

    ok &= run('a busy spreadsheet: the class says so and nothing is written', () => {
      const keepLock = LockService.getScriptLock; let out;
      LockService.getScriptLock = () => ({ waitLock: () => { throw new Error('Lock timeout: another process was holding the lock for too long.'); }, releaseLock: () => {} });
      try { out = importOne(people('Busy', 2), '7B', 'cB', 'jobB'); } finally { LockService.getScriptLock = keepLock; }
      if (!out || out.status !== 'busy') throw new Error('not reported as busy: ' + JSON.stringify(out));
      if (stuRow('busy0@x.kr')) throw new Error('it wrote without the lock');
    });
  } finally {
    Date.now = realNow;
    global.Classroom = undefined;
    try { _clearImportJob_(); _deleteImportTriggers_(); } catch (e) {}
    tidyUp();
    setup();
  }
}

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

ok &= run('a lab put in the MIDDLE of LABS: every percentage stays under its own heading (labs-script-006)', () => {
  /* LABS order and the sheet's part as soon as a lab goes in mid-list (Plants, 8 Sep): the sheet keeps its columns and
     the new lab's goes on the end of the labs. The figures must follow the headings, not places in LABS. */
  const stu = ss.getSheetByName('Students');
  const head = () => stu.getRange(1, 1, 1, stu.getLastColumn()).getValues()[0].map(h => String(h || '').replace(/^✎\s*/, '').trim());
  const rowOn = (sh, email) => { const n = sh.getLastRow() - 1, ec = sh === stu ? _emailCol_(stu) : LAB_EMAIL;
    const v = sh.getRange(2, ec, n, 1).getValues(); for (let i = 0; i < n; i++) if (_cleanEmail_(v[i][0]) === email) return i + 2; return -1; };
  const dg = ss.getSheetByName('Digestion');
  const marked = dg.getRange(2, 1, dg.getLastRow() - 1, LAB_EMAIL).getValues().filter(r => r[4] !== '' && _cleanEmail_(r[LAB_EMAIL - 1]));
  if (!marked.length) throw new Error('nobody has a Digestion score to watch');
  const who = _cleanEmail_(marked[0][LAB_EMAIL - 1]);
  const at = LABS.findIndex(l => l.name === 'Digestion');
  LABS.splice(at, 0, { id: 'middle-lab', name: 'Middle Lab', topic: '7 · Somewhere in the middle', questions: 0 });
  try {
    setup();                                        /* Tidy up: the new lab's column goes on the end of the labs */
    const mid = ss.getSheetByName('Middle Lab');
    mid.getRange(rowOn(mid, who), 5).setValue(0.5);
    refreshDashboard();
    const h = head(), row = stu.getRange(rowOn(stu, who), 1, 1, stu.getLastColumn()).getValues()[0];
    if (h.indexOf('Middle Lab') !== h.indexOf('Labs started') - 1) throw new Error('the new lab did not go on the end of the labs: ' + h.join(' | '));
    LABS.forEach(l => {
      const t = ss.getSheetByName(l.name); if (!t || t.getLastRow() < 2) return;
      const rr = rowOn(t, who), want = rr > 0 && t.getRange(rr, 5).getValue() !== '' ? Number(t.getRange(rr, 5).getValue()) : '';
      if (row[h.indexOf(l.name)] !== want) throw new Error('under "' + l.name + '": ' + row[h.indexOf(l.name)] + ', but its own tab says ' + want);
    });
  } finally {
    const mid = ss.getSheetByName('Middle Lab');
    if (mid) { const r = rowOn(mid, who); if (r > 0) mid.getRange(r, 5).setValue(''); }
    refreshDashboard();                             /* its column empties… */
    LABS.splice(at, 1);
    if (mid) ss.deleteSheet(mid);
    const lt = ss.getSheetByName(T_LABS), lr = lt.getRange(1, 2, lt.getLastRow(), 1).getValues().findIndex(r => r[0] === 'Middle Lab');
    if (lr >= 0) lt.deleteRow(lr + 1);
    setup();                                        /* …so Tidy up clears it away quietly */
  }
  if (head().indexOf('Middle Lab') >= 0) throw new Error('the test could not take its lab back out');
});
ok &= run('the Labs tab counts each lab\'s saves, not its pupils — an old sheet is put right by Tidy up (labs-script-007)', () => {
  /* "Saves" counted the Class column, which every imported pupil has: it showed the size of the roster */
  const lt = ss.getSheetByName(T_LABS);
  const saves = LAB_COLS.findIndex(c => c.h === 'Saves') + 1;
  if (saves !== 10) throw new Error('Saves has moved on the lab tabs (to column ' + saves + '), but the Labs tab adds up column J');
  /* Lab id, Lab, Topic, Saves since 1 Oct 2026 (labs-script-019: the Questions column went) */
  const rows = () => lt.getRange(2, 1, lt.getLastRow() - 1, 4).getValues();
  /* an old sheet: the old formula, and no row for a lab added since */
  const dig = rows().findIndex(r => r[1] === 'Digestion') + 2;
  lt.getRange(dig, 4).setValue('=IFERROR(COUNTA(INDIRECT("\'"&B' + dig + '&"\'!B2:B")),0)');
  const pl = rows().findIndex(r => r[0] === 'plants-lab') + 2;
  if (pl > 1) lt.deleteRow(pl);
  setup();
  const after = rows();
  LABS.forEach(l => {
    const i = after.findIndex(r => r[0] === l.id || r[1] === l.name);
    if (i < 0) throw new Error(l.name + ' has no row on the Labs tab');
    if (String(after[i][3]) !== '=IFERROR(SUM(INDIRECT("\'"&B' + (i + 2) + '&"\'!J2:J")),0)') throw new Error(l.name + ' counts ' + after[i][3]);
  });
});
ok &= run('Tidy up writes the Labs tab afresh from LABS: old labs and the Questions column go, the teacher\'s own columns stay with their labs (labs-script-019)', () => {
  /* the tab as a sheet made in early September has it: the ✎ Questions column, a row for each of the two plant labs
     that plants-lab replaced, and two columns of the teacher's own — one headed, one typed under no heading */
  ss.deleteSheet(ss.getSheetByName(T_LABS));
  const lt = ss.insertSheet(T_LABS);
  const OLD = '=IFERROR(COUNTA(INDIRECT("\'"&B2&"\'!B2:B")),0)';
  lt.getRange(1, 1, 5, 7).setValues([
    ['Lab id', 'Lab', 'Topic', '✎ Questions', 'Saves', 'My notes', ''],
    ['digestion-lab', 'Digestion', '7 · Human nutrition', 97, OLD, 'check the villus station first', ''],
    ['plant-nutrition-lab', 'Plant nutrition', '6 · Plant nutrition', 0, OLD, '', ''],
    ['plant-transport-lab', 'Plant transport', '8 · Transport in plants', 0, OLD, 'ask about xylem', ''],
    ['classification-lab', 'Classification', '1 · Characteristics and classification', 61, OLD, '=A5&" notes"', 'under no heading']]);
  const grid = () => lt.getRange(1, 1, lt.getLastRow(), lt.getLastColumn()).getValues();
  const said = setup();
  const g = grid(), head = g[0], body = g.slice(1);
  if (head.join('|') !== 'Lab id|Lab|Topic|Saves|My notes|') throw new Error('headings: ' + head.join(' | '));
  if (body.length !== LABS.length + 1) throw new Error(body.length + ' rows for ' + LABS.length + ' labs and one kept row');
  LABS.forEach((l, i) => {
    const r = body[i];
    if (r[0] !== l.id || r[1] !== l.name || r[2] !== l.topic) throw new Error('row ' + (i + 2) + ' is ' + r.slice(0, 3).join(' | ') + ', not ' + l.name);
    if (r[3] !== _labsSaves_(i + 2)) throw new Error(l.name + ' counts ' + r[3]);
  });
  const of = id => body[LABS.findIndex(l => l.id === id)];
  if (of('digestion-lab')[4] !== 'check the villus station first') throw new Error('the teacher\'s note left Digestion: ' + of('digestion-lab')[4]);
  if (of('classification-lab')[4] !== '=A5&" notes"') throw new Error('the teacher\'s formula was lost: ' + of('classification-lab')[4]);
  if (of('classification-lab')[5] !== 'under no heading') throw new Error('notes typed under no heading were lost');
  if (body.some(r => r[1] === 'Plant nutrition')) throw new Error('Plant nutrition, which the script no longer has, is still listed');
  const kept = body[LABS.length];
  if (kept[1] !== 'Plant transport' || kept[3] !== '' || kept[4] !== 'ask about xylem') throw new Error('the row the teacher typed on went, or kept a count: ' + kept.join(' | '));
  if (!/Labs tab: the Questions column went/.test(said) || !/removed Plant nutrition/.test(said) || !/kept Plant transport/.test(said))
    throw new Error('Tidy up did not say what it did: ' + said);
  /* a second Tidy up changes nothing; it only reminds the teacher of the row they typed on, as the Students tab's
     "Kept, because…" line does */
  const before = JSON.stringify(grid());
  const again = (setup().match(/Labs tab: [^.]*\./) || [''])[0];
  if (again !== 'Labs tab: kept Plant transport, which the script no longer has, because you typed on its row: delete it when you are done.')
    throw new Error('a second Tidy up says: ' + again);
  if (JSON.stringify(grid()) !== before) throw new Error('a second Tidy up changed the Labs tab');
  /* the note gone, the old lab's row goes with the next Tidy up */
  lt.getRange(LABS.length + 2, 5).setValue('');
  const third = setup();
  if (!/removed Plant transport/.test(third) || grid().some(r => r[1] === 'Plant transport')) throw new Error('the row stayed once its note was gone: ' + third);
  /* back as the other tests expect it: no columns of the teacher's own */
  lt.deleteColumns(5, 2);
  setup();
  if (grid()[0].join('|') !== 'Lab id|Lab|Topic|Saves' || grid().length !== LABS.length + 1) throw new Error('the tab did not settle back: ' + grid()[0].join(' | '));
});
ok &= run('a lab with questions: 0 is "not built yet" on the Students tab, and 🩺 counts built labs only (labs-script-025)', () => {
  /* every lab has had a tab since the first Tidy up, so a tab is no sign of a built lab: the old rule called all 20 built */
  const built = LABS.filter(l => l.questions > 0), unbuilt = LABS.filter(l => !(l.questions > 0));
  if (!built.length || !unbuilt.length) throw new Error('the register needs built and unbuilt labs for this test');
  if (unbuilt.some(l => !ss.getSheetByName(l.name))) throw new Error('an unbuilt lab has no tab, so the old rule would pass here by luck');
  let heads = null;
  const was = _dress2_;
  _dress2_ = function (sh, cols) { if (sh.getName() === 'Students') heads = cols; return was.apply(this, arguments); };
  try { _styleStudents_(); } finally { _dress2_ = was; }
  if (!heads) throw new Error('_styleStudents_ did not dress the Students tab');
  LABS.forEach(l => {
    const c = heads.find(h => h.h === l.name);
    if (!c) throw new Error('no Students column for ' + l.name);
    const soon = c.head === HDR_SOON, says = /not built yet/.test(c.note || '');
    if ((l.questions > 0) === soon || soon !== says) throw new Error(l.name + ' (questions: ' + l.questions + ') is styled ' + (soon ? '"not built yet"' : 'as built') + (soon !== says ? ', and its note disagrees' : ''));
  });
  let said = '';
  const ui = SpreadsheetApp.getUi;
  SpreadsheetApp.getUi = () => Object.assign(ui(), { alert: (a, b) => { said = String(b); } });
  try { checkSetup(); } finally { SpreadsheetApp.getUi = ui; }
  const m = said.match(/labs built so far: (\d+) of (\d+)/);
  if (!m) throw new Error('🩺 no longer says how many labs are built: ' + said.slice(0, 160));
  if (+m[1] !== built.length || +m[2] !== LABS.length) throw new Error('🩺 says "' + m[0] + '", but ' + built.length + ' of ' + LABS.length + ' are built');
});
ok &= run('the unused Classroom-marks helpers are gone, and neither README tells anyone to run them (labs-script-022/054/015)', () => {
  const left = ['createAssignmentFor', 'pushGradesFor', '_tidy_'].filter(n => SRC.includes(n));
  if (left.length) throw new Error('Code.gs still names ' + left.join(', '));
  ['README.md', '../igcse-biology-hub/README.md'].forEach(f => {
    if (!fs.existsSync(f)) return;                /* an edition on its own has only its own README */
    if (/createAssignmentFor|pushGradesFor|Pushing marks into Google Classroom/.test(fs.readFileSync(f, 'utf8')))
      throw new Error(f + ' still describes the Classroom marks helpers');
  });
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
  ss.getSheetByName('Digestion').getRange(2, 3).setValue('');   /* so this hand-in beats her best, and every column is written */
  hand({ score: QN, total: QN, snap: '=IMAGE("https://example.invalid/?"&A1)',
         stations: { '=HYPERLINK("x")': '1/1' } });
  const row = anaRow();
  /* a snapshot is merged into what the row holds; whatever lands there, it is never a formula */
  if (/^=/.test(String(row[LAB_SNAP - 1]))) throw new Error('snap stored as a formula: ' + row[LAB_SNAP - 1]);
  if (_plain_('=IMAGE("https://example.invalid/?"&A1)') !== '\'=IMAGE("https://example.invalid/?"&A1)') throw new Error('a formula-shaped snapshot is not escaped');
  /* a station id that is not an id is now DROPPED rather than merely escaped — the formula never
     reaches the cell at all, which is stronger than the apostrophe. It also stops a station called
     __proto__ reaching the teacher page's roll-up object. */
  if (/HYPERLINK|^'?=/.test(String(row[13]))) throw new Error('a formula-shaped station id reached the cell: ' + row[13]);
  if (String(row[13]) !== '') throw new Error('expected the bad station to be dropped, got ' + row[13]);
  if (_stations_({ '__proto__': '1/1', 'mouth': '8/8 in 3' }) !== 'mouth 8/8 in 3') {
    throw new Error('__proto__ was not refused: ' + _stations_({ '__proto__': '1/1', 'mouth': '8/8 in 3' }));
  }
  if (_stations_({ ok: 'x'.repeat(500) }).length > 900) throw new Error('an oversized station string was not capped');
  hand({ score: 5, total: 1, code: '=IMPORTXML("https://example.invalid","//a")' });   /* refused by its numbers; the code it carries still lands as text */
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
ok &= run('🤝 Let the teachers on the list edit this spreadsheet: one question that names them; only those at the school’s own domain who cannot edit yet are added; one failure does not stop the rest; 🩺 says how many can', () => {
  /* Daniel, 2 Oct 2026: "the Student data spreadsheet has no editor access for the teachers" */
  const handle = _ss_(), keepUi = SpreadsheetApp.getUi, ED = [OWNER, 'has@x.kr'], ADDED = [], said = [];
  let answer = 'NO', failFor = '';
  handle.getEditors = () => ED.map(e => ({ getEmail: () => e }));
  handle.getOwner = () => ({ getEmail: () => OWNER });
  handle.addEditor = e => { if (e === failFor) throw new Error('Invalid argument: ' + e); ADDED.push(e); ED.push(e); };
  SpreadsheetApp.getUi = () => Object.assign(keepUi(), { ButtonSet: { OK: 1, YES_NO: 2 }, Button: { YES: 'YES', NO: 'NO' },
    alert: (a, b, c) => { said.push(String(b)); return c === 2 ? answer : 'OK'; } });
  try {
    SCHOOL_DOMAIN = 'x.kr'; TEACHERS = 'none';
    if (_teacherEmails_().length) throw new Error('the Teachers tab is not empty here: this case counts the list');
    shareWithTeachersMENU_();
    if (ADDED.length || !/There are no teachers on the list yet/.test(said.pop())) throw new Error('with no teachers on the list');
    TEACHERS = 'has@x.kr, new1@x.kr, new2@x.kr, pupil@pupils.x.kr, outsider@gmail.com';
    /* the question names who will be added and what an editor can do; "No" changes nothing */
    shareWithTeachersMENU_();
    const q = said.pop();
    if (ADDED.length) throw new Error('"No" still added ' + ADDED);
    if (!q.includes('Give these 2 teachers edit access to “Test sheet”?\n\nnew1@x.kr\nnew2@x.kr\n') || !/change any cell/.test(q) || !/open its script/.test(q) || !q.includes('Already able to edit: 1.') ||
        !q.includes('Left out, because the address is not at the school’s own domain: pupil@pupils.x.kr, outsider@gmail.com.')) throw new Error('the question: ' + q);
    /* "Yes": each is added; one that Google refuses is named, and the other still goes */
    answer = 'YES'; failFor = 'new2@x.kr'; said.length = 0;
    shareWithTeachersMENU_();
    if (ADDED.join() !== 'new1@x.kr' || !said[1].includes('Done. 1 teacher can now edit this spreadsheet:\nnew1@x.kr') || !said[1].includes('Could not be added:\nnew2@x.kr (Invalid argument: new2@x.kr)') || !/run this again/.test(said[1]))
      throw new Error('one refused: ' + JSON.stringify([ADDED, said[1]]));
    /* 🩺 counts them (the pupil and the outsider are not teachers, so they are not counted) */
    TEACHER_PAGE_URL = 'https://script.google.com/a/macros/x.kr/s/AKfyTEST/exec';
    said.length = 0; checkSetup();
    if (!said[0].includes('•  2 of the 3 teachers on the list can edit this spreadsheet. 🧪 Biology Labs ▸ 🤝 Let the teachers on the list edit this spreadsheet… gives it to the other 1.')) throw new Error('🩺 with one left: ' + said[0].slice(-900));
    failFor = ''; said.length = 0; shareWithTeachersMENU_();
    if (ADDED.join() !== 'new1@x.kr,new2@x.kr' || !said[0].includes('Give this teacher edit access')) throw new Error('the second run: ' + JSON.stringify([ADDED, said[0]]));
    said.length = 0; shareWithTeachersMENU_();
    if (ADDED.length !== 2 || !said[0].includes('Nothing to do: all 3 teachers on the list can already edit this spreadsheet.')) throw new Error('a third run: ' + said[0]);
    said.length = 0; checkSetup();
    if (!said[0].includes('✅  all 3 teachers on the list can edit this spreadsheet')) throw new Error('🩺 with all in: ' + said[0].slice(-900));
    /* nobody is ever removed, and a pupil or a pupil's address is never given the roster */
    if (ED.indexOf('has@x.kr') < 0 || ED.some(e => /pupils|gmail/.test(e))) throw new Error('the editors: ' + ED);
    /* somebody who is not a teacher cannot run it (and no page can call it: its name ends in _) */
    const n = ADDED.length; TEACHERS = 'has@x.kr, late@x.kr'; VISITOR = 'pupil@pupils.x.kr'; said.length = 0;
    shareWithTeachersMENU_();
    if (ADDED.length !== n || said.length) throw new Error('a pupil ran it');
    if (!/_$/.test(shareWithTeachersMENU_.name)) throw new Error('its name no longer ends in _: a page could call it');
  } finally {
    SpreadsheetApp.getUi = keepUi; VISITOR = OWNER; delete handle.getEditors; delete handle.getOwner; delete handle.addEditor;
    TEACHERS = ''; SCHOOL_DOMAIN = ''; TEACHER_PAGE_URL = ''; props.delete('TEACHERS'); props.delete('SCHOOL_DOMAIN'); props.delete('TEACHER_PAGE_URL');
  }
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
    if (/SECRET-ID|docs\.google\.com|Test &lt;b&gt;7|Bad link|Not a link/.test(h)) throw new Error(label + ' was shown a link or a row');
  });
  /* The links now reach the page through uiData rather than being baked into the served HTML,
     so prove it there — and prove the same door is shut to a pupil. */
  VISITOR = OWNER;
  const d0 = uiData('teachers');
  if (!d0.ok) throw new Error('the owner was refused the links: ' + d0.why);
  const flat = JSON.stringify(d0.data);
  if (!/SECRET-ID/.test(flat)) throw new Error('the owner was not given the link');
  /* A Link typed without https:// is NAMED to a teacher, so the typo can be found (Daniel, 25 Sep
     2026). Its address never reaches the page, and the row never becomes a card. */
  if (/javascript:|docs\.google\.com\/x(?!\w)/.test(flat)) throw new Error('a non-https address was handed over');
  const typed0 = (d0.data.typed || []).map(u => u.name).join(', ');
  if (typed0 !== 'Bad link, Not a link') throw new Error('the rows typed without https:// are not named: ' + (typed0 || 'none'));
  const cards0 = [].concat(d0.data.records, d0.data.loose, ...d0.data.cohorts.map(c => [].concat(...c.types.map(t => t.links))));
  if (cards0.some(l => /Bad link|Not a link/.test(l.name) || !/^https:\/\//.test(l.url))) throw new Error('a non-https row became a card');
  VISITOR = 'pupil@pupils.x.kr';
  if (uiData('teachers').ok !== false) throw new Error('a pupil was handed the links through uiData');
  VISITOR = OWNER;
  /* since 24 Sep it names the script's edition, so a paste can be confirmed from outside */
  if (String(doGet({ parameter: {} })) !== 'Biology Labs endpoint is running · ' + SCRIPT_EDITION) throw new Error('the health check changed');
  VISITOR = ''; SCHOOL_DOMAIN = ''; props.delete('SCHOOL_DOMAIN');
  ss.deleteSheet(tab);
});
ok &= run('smart chips and Links typed without https:// are named to a teacher; a typed address never is', () => {
  /* The two kinds of row the page cannot open. A chip shows its file's own name, which may carry a
     colon; it is named back to the teacher with that name (18 Sep), and its Dashboard is never taken
     for its spreadsheet. A Link TYPED as an address that is not https is named too, so the typo can
     be found (Daniel, 25 Sep 2026), but by its row's name only: never its address, never a card. */
  SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
  const tab = ss.insertSheet(T_LINKS);
  const rows = [_LINK_HEADERS_,
    ['Test',       'Topic 9 test',  '2028', '', 'T3T4: Test A',        '', 'https://script.google.com/a/macros/x.kr/s/AKdash/exec?page=dashboard'],
    ['Reflection', 'Data chip',     '2028', '', 'Data: class results', '', ''],
    ['Reflection', 'Good one',      '2028', '', 'https://docs.google.com/spreadsheets/d/GOOD/edit', '', ''],
    ['Records',    'Typed http',    '',     '', 'http://docs.google.com/spreadsheets/d/HTTPID/edit', '', ''],
    ['Records',    'Tabbed js',     '',     '', ' java\tscript:alert(2)', '', ''],
    ['Survey',     'Bare www',      '2028', '', 'www.example.com/form', '', ''],
    ['Survey',     'Data address',  '2028', '', 'data:text/html,<b>x</b>', '', ''],
    /* the address pasted into the Assessment as well: the row is named by its number instead */
    ['Survey',     'http://forms.example/abc', '2028', '', 'http://forms.example/abc', '', '']];
  tab.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  const addresses = /HTTPID|script:alert|example\.com|text\/html|forms\.example/;
  const TYPED = 'Typed http, Tabbed js, Bare www, Data address, row 9';
  const g = uiData('teachers');
  if (!g.ok) throw new Error('the owner was refused the page: ' + g.why);
  const flat = JSON.stringify(g.data);
  if (!/GOOD/.test(flat)) throw new Error('the https row is missing');
  const named = (g.data.unreadable || []).map(u => u.name + ' / ' + u.shown).join(' · ');
  if (named !== 'Topic 9 test / T3T4: Test A · Data chip / Data: class results')
    throw new Error('the chips are not named as they should be: ' + (named || 'none named'));
  const typed = (g.data.typed || []).map(u => u.name).join(', ');
  if (typed !== TYPED) throw new Error('the Links typed without https:// are not named as they should be: ' + (typed || 'none named'));
  if ((g.data.typed || []).some(u => Object.keys(u).join() !== 'row,type,name')) throw new Error('a typed row carries more than its row, type and name');
  if (addresses.test(flat)) throw new Error('a Link typed without https:// reached the page: ' + flat.match(addresses)[0]);
  const cards = [].concat(g.data.records, g.data.loose, ...g.data.cohorts.map(c => [].concat(...c.types.map(t => t.links))));
  if (cards.some(l => !/^https:\/\//.test(l.url))) throw new Error('a card opens something that is not https');
  if (cards.some(l => /AKdash/.test(l.url))) throw new Error('a chip row was opened at its dashboard');
  if (cards.some(l => /Typed http|Tabbed js|Bare www|Data address/.test(l.name))) throw new Error('a typed row became a card');
  const p = teacherPanelData();                              /* the dialog reads the same scan */
  if (addresses.test(JSON.stringify(p))) throw new Error('a Link typed without https:// reached the dialog');
  if ((p.unreadable || []).length !== 2) throw new Error('the dialog names ' + (p.unreadable || []).length + ' chips, not 2');
  if ((p.typed || []).map(u => u.name).join(', ') !== TYPED) throw new Error('the dialog does not name the typed rows');
  /* and both pages read the list by that name, or the rows would vanish from them without a word */
  if (!/\(g && g\.typed\)/.test(fs.readFileSync('apps-script/Teacher.html', 'utf8'))) throw new Error('the teacher page does not read typed');
  if (!/d\.typed/.test(fs.readFileSync('apps-script/TeacherPage.html', 'utf8'))) throw new Error('the dialog does not read typed');
  [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });   /* the dialog made the first */
  VISITOR = ''; SCHOOL_DOMAIN = ''; props.delete('SCHOOL_DOMAIN');
});
ok &= run('the one-off editor checks are gone (5 Oct 2026), and no page tells a teacher to run them', () => {
  ['checkChips', 'checkReminders'].forEach(n => {
    if (typeof global[n] === 'function' || new RegExp('function ' + n + '\\(').test(SRC)) throw new Error(n + ' is still in the script');
    ['apps-script/Teacher.html', 'apps-script/TeacherPage.html'].forEach(p => {
      if (fs.readFileSync(p, 'utf8').indexOf(n) >= 0) throw new Error(p + ' still names ' + n); });
  });
  if (SCRIPT_EDITION.length > 60) throw new Error('SCRIPT_EDITION is long again (' + SCRIPT_EDITION.length + ' characters): keep it one short line');
});

ok &= run('the import window tells an editor who may not import so, instead of "no courses"', () => {
  /* labs-script-010 (30 Sep 2026): anyone else was answered with an empty list, and the window said "No active courses found" */
  const was = VISITOR;
  VISITOR = 'kid@pupils.x.kr';
  let d;
  try { d = getBatchImportData(); } finally { VISITOR = was; }
  if (!d || !d.refused || d.courses.length) throw new Error('a pupil was answered as if they simply had no courses: ' + JSON.stringify(d));
  if (!/DATA && DATA\.refused/.test(fs.readFileSync('apps-script/ClassroomImport.html', 'utf8'))) throw new Error('the window does not say who may import');
});

console.log('— the teacher-page control panel —');
ok &= run('add teachers and links from the dialog, read live, no code edit', () => {
  SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
  let d = teacherPanelData();
  if (!d.ok || d.owner !== OWNER) throw new Error('panel refused the owner: ' + JSON.stringify(d).slice(0,120));
  if (!(d.y10 >= 2028)) throw new Error('the window is not told this school year’s Y10: ' + d.y10);
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

console.log('— 🔎 find new reflection and test spreadsheets —');
{
  /* A Drive that holds labelled files (26 Sep 2026): a reflection and a test that labelled themselves, a later copy
     of the reflection, a look-alike a pupil made and handed over, one with the words only in a cell, a colleague's,
     and one whose "dashboard" is not an Apps Script page. The fake answers exactly the query the script sends.
     Daniel: a button — "runs the check, it's added, and that's it, but not constantly". */
  const now = new Date(), sy = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1, G = String(sy + 2);   // this year's Y10
  const FILES = [];
  const person = e => (e ? { getEmail: () => e } : null);
  const file = o => ({ getId: () => o.id, getDescription: () => o.desc, getDateCreated: () => new Date(o.made || 0), getOwner: () => person(o.owner),
    getMimeType: () => o.mime || 'application/vnd.google-apps.spreadsheet', isTrashed: () => !!o.trashed,
    getParents: () => { let done = false; return { hasNext: () => !done, next: () => { done = true;
      return { getOwner: () => person(o.folderOwner), getId: () => o.folderId || ('folder-of-' + o.id), getName: () => o.folderName || 'Folder' }; } }; } });
  let SEARCHES = 0, LASTQ = '';
  const drive = { searchFiles: q => {
    SEARCHES++; LASTQ = q;
    const owns = [...q.matchAll(/'([^']+)' in owners/g)].map(m => m[1]);
    const phrases = [...q.matchAll(/fullText contains '"([^"]+)"'/g)].map(m => m[1].toLowerCase());
    if (!/mimeType = 'application\/vnd\.google-apps\.spreadsheet'/.test(q) || !/trashed = false/.test(q) || !owns.length || !phrases.length)
      throw new Error('a query the fake does not model: ' + q);
    const hits = FILES.filter(o => !o.unindexed && owns.includes(o.owner) && phrases.some(ph => (o.desc + ' ' + (o.cells || '')).toLowerCase().includes(ph)));
    let i = 0; return { hasNext: () => i < hits.length, next: () => file(hits[i++]) };
  }, getFolderById: fid => {
    const inIt = FILES.filter(o => o.folderId === fid);
    if (!inIt.length && !FOLDERS[fid]) throw new Error('No item with the given ID could be found.');
    return { getName: () => FOLDERS[fid] || (inIt[0] && inIt[0].folderName) || 'Folder',
             getFiles: () => { const l = inIt.filter(o => !o.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => file(l[i++]) }; } };
  }, getFileById: id => {
    if (DRIVE_DENY) throw new Error('You do not have permission to call DriveApp.getFileById. Required permissions: https://www.googleapis.com/auth/drive');
    const o = FILES.find(x => x.id === id);
    if (!o) throw new Error('No item with the given ID could be found. Possibly because you have not edited this item or you do not have permission to access it.');
    return file(o);
  } };
  let DRIVE_DENY = false;
  const FOLDERS = {};
  const ID = n => ('found-' + n + '-xxxxxxxxxxxxxxxxxxxxxxxx').slice(0, 30);
  const DASH = n => 'https://script.google.com/a/macros/x.kr/s/AKfy' + n + '/exec?page=dashboard';
  const R7 = { id: ID('r7'), owner: OWNER, folderOwner: OWNER, made: 1000,
    desc: 'My own note.\n\n🪞 Biology reflection spreadsheet | name: Topic 7 · Human Nutrition | class of: ' + G + ' | dashboard: ' + DASH('R7') +
          ' | written by the reflection system for the Biology Hub; leave this line in' };
  const T16 = { id: ID('t16'), owner: OWNER, folderOwner: OWNER, made: 2000,
    desc: '🧪 Biology Test System spreadsheet | name: Reflecting on the impact of Science | class of: ' + G + ' | dashboard: ' + DASH('T16') + ' | written by the Test System' };
  const COPY = Object.assign({}, R7, { id: ID('r7copy'), made: 5000 });
  const PLANT = { id: ID('plant'), owner: OWNER, folderOwner: 'kid@pupils.x.kr', made: 3000,
    desc: '🪞 Biology reflection spreadsheet | name: Free marks | class of: ' + G + ' | dashboard: ' + DASH('EVIL') };
  const CELLS = { id: ID('cells'), owner: OWNER, folderOwner: OWNER, made: 3000, desc: '', cells: 'Biology reflection spreadsheet' };
  const THEIRS = { id: ID('theirs'), owner: 'kim@x.kr', folderOwner: 'kim@x.kr', made: 3000, desc: R7.desc.replace('Topic 7', 'Topic 8') };
  const BADDASH = { id: ID('baddash'), owner: OWNER, folderOwner: OWNER, made: 3000,
    desc: '🪞 Biology reflection spreadsheet | name: Topic 9 · Gas exchange | class of: ' + G + ' | dashboard: https://evil.example/exec?page=dashboard' };
  FILES.push(COPY, R7, T16, PLANT, CELLS, THEIRS, BADDASH);   // the copy comes first: the older file must still win
  const rowsFor = id => ss.getSheetByName(T_LINKS) ? teacherPanelData().links.filter(l => _sheetIdOf_(l.url) === id) : [];
  const tabRows = () => { const t = ss.getSheetByName(T_LINKS); return t ? t.getLastRow() - 1 : 0; };

  ok &= run('with no Drive (not allowed to look yet) Find adds nothing, and says why', () => {
    SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
    [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
    props.delete(FIND_SKIP); delete global.DriveApp;
    const d = teacherFindSpreadsheets();
    if (!d.ok || d.find.added.length || !d.find.trouble) throw new Error('with no Drive: ' + JSON.stringify(d.find));
  });
  global.DriveApp = drive;
  ok &= run('nothing looks in Drive on its own: the page, the window and the Sit-a-test banner read the tab only', () => {
    const n = SEARCHES;
    teacherPanelData(); uiData('teachers'); _testSheetIds_(true); _teacherLinksScan_();
    if (SEARCHES !== n) throw new Error('Drive was searched without the button being pressed');
    if (rowsFor(R7.id).length || rowsFor(T16.id).length) throw new Error('a spreadsheet appeared before Find was pressed');
  });
  ok &= run('Find adds each labelled reflection and test as an ordinary row: type, name, class, link, dashboard, a dated note', () => {
    const before = tabRows(), d = teacherFindSpreadsheets();
    if (d.find.added.length !== 3 || tabRows() !== before + 3) throw new Error('added ' + JSON.stringify(d.find.added) + ', rows ' + before + '→' + tabRows());
    const r7 = rowsFor(R7.id)[0], t16 = rowsFor(T16.id)[0];
    if (!r7 || r7.type !== 'Reflection' || r7.assessment !== 'Topic 7 · Human Nutrition' || r7.grad !== G || r7.dash !== DASH('R7') ||
        r7.url !== 'https://docs.google.com/spreadsheets/d/' + R7.id + '/edit' || !/^Added by 🔎 Find new spreadsheets/.test(r7.note) || !(r7.row >= 2))
      throw new Error('the reflection row is wrong: ' + JSON.stringify(r7));
    if (!t16 || t16.type !== 'Test' || !t16.cohort || t16.cohort.title !== 'Class of ' + G) throw new Error('the test row is wrong: ' + JSON.stringify(t16));
    const page = JSON.stringify(uiData('teachers').data);
    if (!page.includes('Topic 7 · Human Nutrition') || !page.includes(DASH('R7'))) throw new Error('the added reflection is not on the teacher page');
    if (!_testSheetIds_(true).includes(T16.id)) throw new Error('the added test does not feed the banner');
  });
  ok &= run('only yours, in your folders, labelled in the description: a planted look-alike, words in a cell and a colleague\'s are not added', () => {
    [PLANT, CELLS, THEIRS].forEach(o => { if (rowsFor(o.id).length) throw new Error('added: ' + o.id); });
    if (!LASTQ.includes("'" + OWNER + "' in owners")) throw new Error('the search is not limited to the owner: ' + LASTQ);
  });
  ok &= run('a copy carrying its original\'s label is one row, the older file; a dashboard that is not an Apps Script page is left empty', () => {
    if (rowsFor(COPY.id).length || rowsFor(R7.id).length !== 1) throw new Error('the copy made a row of its own');
    const b = rowsFor(BADDASH.id)[0];
    if (!b || b.dash !== '') throw new Error('a foreign dashboard address got through: ' + JSON.stringify(b));
  });
  ok &= run('a department folder shared with you works (Daniel\'s case): yours in a staff folder is added; a listed teacher\'s own too; an unlisted colleague\'s own, or no school domain, not', () => {
    const DEPT = { id: ID('dept-t8'), owner: OWNER, folderOwner: 'hod@x.kr', made: 7000,
      desc: '🧪 Biology Test System spreadsheet | name: Topic 8 evaluation | class of: ' + G + ' | dashboard: ' + DASH('T8') };
    const HODS = { id: ID('hods-r8'), owner: 'hod@x.kr', folderOwner: 'hod@x.kr', made: 7100,
      desc: '🪞 Biology reflection spreadsheet | name: Topic 8 reflection | class of: ' + G + ' | dashboard: ' + DASH('R8X') };
    const ELSE = { id: ID('else-t9'), owner: OWNER, folderOwner: 'other@x.kr', made: 7200,
      desc: '🧪 Biology Test System spreadsheet | name: Topic 9 test | class of: ' + G + ' | dashboard: ' + DASH('T9') };
    FILES.push(DEPT, HODS);
    teacherFindSpreadsheets();
    if (!rowsFor(DEPT.id).length) throw new Error('a spreadsheet of yours in the department\'s folder was not added');
    if (rowsFor(HODS.id).length) throw new Error('an unlisted colleague\'s own spreadsheet was added without asking');
    teacherAddTeacher('Head of Department', 'hod@x.kr');
    teacherFindSpreadsheets();
    if (!LASTQ.includes("'hod@x.kr' in owners")) throw new Error('a listed teacher\'s spreadsheets are not searched: ' + LASTQ);
    if (!rowsFor(HODS.id).length) throw new Error('a listed teacher\'s own spreadsheet was not added');
    teacherRemoveTeacher('hod@x.kr');
    const keepDom = SCHOOL_DOMAIN, keptProp = props.get('SCHOOL_DOMAIN');   // a typed setting is kept in Script Properties
    SCHOOL_DOMAIN = ''; props.delete('SCHOOL_DOMAIN'); FILES.push(ELSE);
    teacherFindSpreadsheets();
    SCHOOL_DOMAIN = keepDom; if (keptProp) props.set('SCHOOL_DOMAIN', keptProp);
    if (rowsFor(ELSE.id).length) throw new Error('with no school domain set, a folder of someone unlisted counted');
    teacherFindSpreadsheets();
    if (!rowsFor(ELSE.id).length) throw new Error('(mutation) with the school domain set, the staff folder did not count');
  });
  ok &= run('pressed again: nothing added twice — a row, once there, is left as it is, and a stale copy is not added when the original\'s label changes', () => {
    R7.desc = R7.desc.replace('Topic 7 · Human Nutrition', 'Topic 7 · renamed');
    const before = tabRows(), d = teacherFindSpreadsheets();
    R7.desc = R7.desc.replace('Topic 7 · renamed', 'Topic 7 · Human Nutrition');
    if (d.find.added.length || tabRows() !== before) throw new Error('added again: ' + JSON.stringify(d.find.added));
    if (rowsFor(R7.id)[0].assessment !== 'Topic 7 · Human Nutrition') throw new Error('an existing row was rewritten');
  });
  ok &= run('a row you remove stays off: Find leaves it out, until Add back', () => {
    let d = teacherRemoveLink(rowsFor(T16.id)[0].row);
    if (rowsFor(T16.id).length) throw new Error('not removed');
    d = teacherFindSpreadsheets();
    if (rowsFor(T16.id).length || !d.find.leftOut.some(x => x.id === T16.id)) throw new Error('Find brought a removed row back: ' + JSON.stringify(d.find));
    if (_testSheetIds_(true).includes(T16.id)) throw new Error('a removed test still feeds the banner');
    d = teacherFindAgain(T16.id);
    if (rowsFor(T16.id).length !== 1 || d.find.leftOut.length) throw new Error('Add back did not add it: ' + JSON.stringify(d.find));
  });
  ok &= run('a row you typed yourself for the same spreadsheet is never doubled', () => {
    const t = ss.getSheetByName(T_LINKS);
    t.deleteRow(rowsFor(R7.id)[0].row);
    props.delete(FIND_SKIP);
    teacherAddLink({ type: 'Reflection', assessment: 'My own name for it', grad: G, url: 'https://docs.google.com/spreadsheets/u/1/d/' + R7.id + '/edit#gid=0' });
    teacherFindSpreadsheets();
    const same = rowsFor(R7.id);
    if (same.length !== 1 || same[0].assessment !== 'My own name for it') throw new Error('doubled or replaced: ' + JSON.stringify(same));
  });
  ok &= run('a student can neither find nor add back', () => {
    VISITOR = 'kid@pupils.x.kr';
    const a = teacherFindSpreadsheets(), b = teacherFindAgain(T16.id);
    VISITOR = OWNER;
    if (a.ok !== false || b.ok !== false) throw new Error('a student ran Find');
  });
  ok &= run('the menu item runs the same press and answers in a box', () => {
    const logs = [], keep = global.log;
    FILES.push({ id: ID('r8'), owner: OWNER, folderOwner: OWNER, made: 6000,
                 desc: '🪞 Biology reflection spreadsheet | name: Topic 8 · Plants | class of: ' + G });
    const before = tabRows();
    findSpreadsheetsMENU_();
    if (tabRows() !== before + 1 || !rowsFor(ID('r8')).length) throw new Error('the menu did not add the new reflection');
  });
  ok &= run('"Missing one?" says why in plain words, for every case, and "Add it" adds only what is safe', () => {
    const chk = u => teacherCheckSpreadsheet(u).check;
    const url = o => 'https://docs.google.com/spreadsheets/d/' + o.id + '/edit#gid=253688524';
    let c = chk('not a link');
    if (c.verdict !== 'bad') throw new Error('bad address: ' + JSON.stringify(c));
    c = chk(url({ id: ID('r8') }));
    if (c.verdict !== 'listed') throw new Error('listed: ' + JSON.stringify(c));
    c = chk(url({ id: ID('nothere') }));
    if (c.verdict !== 'unreadable' || !/share it with/.test(c.say.join(' '))) throw new Error('unreadable: ' + JSON.stringify(c));
    DRIVE_DENY = true; c = chk(url(CELLS)); DRIVE_DENY = false;   // (a listed one is answered before the file is opened)
    if (c.verdict !== 'nodrive' || !/allow it to see your Drive/.test(c.say.join(' '))) throw new Error('no Drive permission: ' + JSON.stringify(c));
    c = chk(url(CELLS));
    if (c.verdict !== 'nolabel' || !/Rebuild Links/.test(c.say.join(' ')) || c.canAdd) throw new Error('no label: ' + JSON.stringify(c));
    c = chk(url(THEIRS));
    if (c.verdict !== 'notmine' || !c.canAdd || !/kim@x\.kr/.test(c.say.join(' '))) throw new Error('a colleague\'s: ' + JSON.stringify(c));
    let d = teacherAddChecked(THEIRS.id);
    const th = d.links.filter(l => _sheetIdOf_(l.url) === THEIRS.id)[0];
    if (!th || th.assessment !== 'Topic 8 · Human Nutrition' || th.grad !== G || !/Added from 🔎 Check/.test(th.note)) throw new Error('Add it (colleague) did not add it from its label: ' + JSON.stringify(th));
    c = chk(url(PLANT));
    if (c.verdict !== 'folder' || !c.canAdd || !/kid@pupils/.test(c.say.join(' '))) throw new Error('someone else\'s folder: ' + JSON.stringify(c));
    c = chk(url(COPY));
    if (c.verdict !== 'copy' || c.canAdd) throw new Error('a copy naming a listed dashboard: ' + JSON.stringify(c));
    /* labs-script-008 (30 Sep 2026): this copy is a reflection's, and it was sent to the Test System's menu */
    if (!/Rebuild 🔗 Links tab/.test(c.say.join(' ')) || /Rebuild Links/.test(c.say.join(' '))) throw new Error('a copied reflection was told another system’s fix: ' + c.say.join(' | '));
    if (!/Rebuild Links/.test(_ownWebAppFix_('Test'))) throw new Error('a copied test is no longer sent to 🔗 Rebuild Links');
    d = teacherAddChecked(COPY.id);
    if (d.links.some(l => _sheetIdOf_(l.url) === COPY.id)) throw new Error('Add it added a copy that opens the wrong dashboard');
    const NEWT = { id: ID('t17new'), owner: OWNER, folderOwner: OWNER, made: 9000, unindexed: true,
      desc: '🧪 Biology Test System spreadsheet | name: Test T17 | class of: ' + G + ' | dashboard: ' + DASH('T17') };
    FILES.push(NEWT);
    c = chk(url(NEWT));
    if (c.verdict !== 'unindexed' || !c.canAdd) throw new Error('not yet searchable: ' + JSON.stringify(c));
    d = teacherAddChecked(NEWT.id);
    if (!d.links.some(l => _sheetIdOf_(l.url) === NEWT.id && l.type === 'Test' && l.dash === DASH('T17'))) throw new Error('Add it did not add the new test');
    teacherRemoveLink(rowsFor(NEWT.id)[0].row);
    c = chk(url(NEWT));
    if (c.verdict !== 'removed' || !c.canAdd) throw new Error('removed before: ' + JSON.stringify(c));
    d = teacherAddChecked(NEWT.id);
    if (!d.links.some(l => _sheetIdOf_(l.url) === NEWT.id) || _findSkip_().some(x => x.id === NEWT.id)) throw new Error('Add it did not put a removed one back');
    VISITOR = 'kid@pupils.x.kr';
    const s1 = teacherCheckSpreadsheet(url(R7)), s2 = teacherAddChecked(PLANT.id);
    VISITOR = OWNER;
    if (s1.ok !== false || s2.ok !== false || rowsFor(PLANT.id).length) throw new Error('a student checked or added');
  });
  ok &= run('a shared drive (Daniel\'s case): Find cannot vouch for it; Add it adds it AND watches its folder, so the next test there is found by Find', () => {
    const FLD = 'fld-biology-tests-2026', FNAME = 'Biology tests 2026–27';
    FOLDERS[FLD] = FNAME;
    const SD1 = { id: ID('sd-eval'), owner: null, folderOwner: null, folderId: FLD, folderName: FNAME, made: 8000,
      desc: '🧪 Biology Test System spreadsheet | name: Evaluating transpiration simulations | class of: ' + G + ' | dashboard: ' + DASH('EVAL') };
    FILES.push(SD1);
    let d = teacherFindSpreadsheets();
    if (rowsFor(SD1.id).length) throw new Error('a shared-drive file was added with no one vouching for it');
    const c = teacherCheckSpreadsheet('https://docs.google.com/spreadsheets/d/' + SD1.id + '/edit').check;
    if (c.verdict !== 'shareddrive' || !c.canAdd || !/shared drive/.test(c.say.join(' ')) || /Teachers list/.test(c.say.join(' ')))
      throw new Error('the check did not say "shared drive" plainly: ' + JSON.stringify(c));
    d = teacherAddChecked(SD1.id);
    if (!rowsFor(SD1.id).length || !d.findFolders.some(f => f.id === FLD) || !/Find also looks in “Biology tests 2026–27”/.test(d.check.say.join(' ')))
      throw new Error('Add it did not add it and watch its folder: ' + JSON.stringify(d.check) + ' ' + JSON.stringify(d.findFolders));
    const SD2 = { id: ID('sd-refl'), owner: null, folderOwner: null, folderId: FLD, folderName: FNAME, made: 8100, unindexed: true,
      desc: '🪞 Biology reflection spreadsheet | name: Topic 8 reflection | class of: ' + G + ' | dashboard: ' + DASH('R8SD') };
    const SD3 = { id: ID('sd-plain'), owner: null, folderOwner: null, folderId: FLD, folderName: FNAME, made: 8200, desc: 'just a spreadsheet' };
    const SD4 = Object.assign({}, SD1, { id: ID('sd-evalcopy'), made: 9000 });
    const DOC = { id: ID('sd-doc'), owner: null, folderOwner: null, folderId: FLD, made: 8300, mime: 'application/vnd.google-apps.document', desc: SD2.desc.replace('Topic 8', 'Doc') };
    FILES.push(SD2, SD3, SD4, DOC);
    d = teacherFindSpreadsheets();
    if (!rowsFor(SD2.id).length) throw new Error('the new reflection in the watched folder was not added by Find');
    if (rowsFor(SD3.id).length || rowsFor(SD4.id).length || rowsFor(DOC.id).length) throw new Error('an unlabelled one, a copy or a document was added');
    if (!(d.find.folders || []).includes(FNAME)) throw new Error('Find did not say where it looked: ' + JSON.stringify(d.find));
    const again = teacherCheckSpreadsheet('https://docs.google.com/spreadsheets/d/' + SD2.id + '/edit').check;
    if (again.verdict !== 'listed') throw new Error('a found one is not "listed": ' + JSON.stringify(again));
    VISITOR = 'kid@pupils.x.kr';
    const st = teacherUnwatchFolder(FLD);
    VISITOR = OWNER;
    if (st.ok !== false || !_findFolders_().length) throw new Error('a student stopped the watch');
    d = teacherUnwatchFolder(FLD);
    if (d.findFolders.length) throw new Error('✕ did not stop the watch');
    /* added with an older "Add it" (or unwatched since): the check of the LISTED spreadsheet offers to watch its folder */
    const lc = teacherCheckSpreadsheet('https://docs.google.com/spreadsheets/d/' + SD1.id + '/edit').check;
    if (lc.verdict !== 'listed' || !lc.watchable || lc.watchable.id !== FLD) throw new Error('a listed shared-drive one did not offer its folder: ' + JSON.stringify(lc));
    VISITOR = 'kid@pupils.x.kr';
    const sw = teacherWatchFolder(SD1.id);
    VISITOR = OWNER;
    if (sw.ok !== false || _findFolders_().length) throw new Error('a student set a watch');
    d = teacherWatchFolder(SD1.id);
    if (!d.findFolders.some(f => f.id === FLD) || d.check.verdict !== 'watching') throw new Error('Let Find look in this folder did not: ' + JSON.stringify(d.check));
    const lc2 = teacherCheckSpreadsheet('https://docs.google.com/spreadsheets/d/' + SD1.id + '/edit').check;
    if (lc2.watchable) throw new Error('offered to watch a folder already watched');
    d = teacherUnwatchFolder(FLD);
    const SD5 = { id: ID('sd-late'), owner: null, folderOwner: null, folderId: FLD, folderName: FNAME, made: 9100,
      desc: '🧪 Biology Test System spreadsheet | name: Topic 9 test | class of: ' + G + ' | dashboard: ' + DASH('T9SD') };
    FILES.push(SD5);
    teacherFindSpreadsheets();
    if (rowsFor(SD5.id).length) throw new Error('Find still looked in a folder after ✕');
  });
  delete global.DriveApp;
  [T_TEACHERS, T_LINKS].forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
  VISITOR = ''; SCHOOL_DOMAIN = ''; props.delete('SCHOOL_DOMAIN'); props.delete(FIND_SKIP); props.delete(FIND_FOLDERS);
}

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
  if (!withDig.length) throw new Error('nobody has a Digestion entry, though saves were recorded');
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
  /* the per-pupil link is built in the page — Teacher.html's link(), from uiData('students').trackerBase — so that is
     what is tested (labs-script-032, 30 Sep 2026: this tested _studentTrackerUrl_, a copy nothing called) */
  const rule = (fs.readFileSync('apps-script/Teacher.html', 'utf8').match(/function link\(e\)\{[^\n]*\}/) || [])[0];
  if (!rule) throw new Error('Teacher.html link() has moved — this test can no longer see it');
  const linkFor = base => new Function('base', rule + '\nreturn link;')(base);
  if (linkFor('')('a@x.kr') !== '') throw new Error('a link was built with no base');
  SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  if (teacherSetTrackerUrl('https://evil.example/exec').ok !== false) throw new Error('a non-Google url was accepted');
  const set = teacherSetTrackerUrl('https://script.google.com/a/macros/x.kr/s/AKtrack/exec');
  if (!set.ok || !set.trackerLive) throw new Error('a good tracker url was refused: ' + JSON.stringify(set).slice(0, 120));
  const st = uiData('students');
  if (!st.ok || st.trackerBase !== 'https://script.google.com/a/macros/x.kr/s/AKtrack/exec')
    throw new Error('the page is not handed the tracker address: ' + JSON.stringify(st).slice(0, 120));
  if (linkFor(st.trackerBase)('A@X.kr ') !== 'https://script.google.com/a/macros/x.kr/s/AKtrack/exec?page=student&email=a%40x.kr')
    throw new Error('per-pupil link wrong: ' + linkFor(st.trackerBase)('A@X.kr '));
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

/* The teacher page, run for real: Teacher.html's second script (Lab progress, Bio English, Set homework) in a small
   stand-in window — enough of a page to draw a view, find its buttons by what they carry, and press them. Nothing ran
   the page before, which is how "Set again" threw unseen for twelve days (labs-script-002, 30 Sep 2026). */
function teacherPage() {
  const vm = require('vm');
  const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  const end1 = h.indexOf('</script>', h.indexOf('<script>'));   /* the theme's <script data-theme-boot> in <head> is not the first script */
  const s1 = h.slice(h.indexOf('<script>') + 8, end1);
  const at2 = h.indexOf('<script>', end1);
  const s2 = h.slice(at2 + 8, h.indexOf('</script>', at2));
  const helpers = s1.slice(s1.indexOf('var $ = function(id)'), s1.indexOf('var VIEWS = {'));
  if (!helpers || at2 < 0 || !/window\.vHomework = function/.test(s2)) throw new Error('Teacher.html has changed shape: the stand-in page cannot find its scripts');
  let view = '';
  const on = [];                                              /* [the element's opening tag, event, handler] */
  const unesc = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const el = tag => {
    const a = {};
    for (const m of tag.replace(/^<[a-z0-9]+/i, '').matchAll(/([\w-]+)(?:="([^"]*)")?/g)) a[m[1]] = m[2] === undefined ? '' : unesc(m[2]);
    const o = { tag, getAttribute: n => (n in a ? a[n] : null), value: a.value || '', checked: 'checked' in a,
                addEventListener: (ev, fn) => on.push([tag, ev, fn, o]), focus() {}, scrollIntoView() {}, closest: () => null };
    return o;
  };
  const tags = () => view.match(/<[a-z][^>]*>/gi) || [];
  const document = {
    getElementById: id => id === 'view' ? { set innerHTML(x) { view = x; }, get innerHTML() { return view; } }
      : (t => (t ? el(t) : null))(tags().find(t => new RegExp('\\sid="' + id + '"').test(t))),
    querySelectorAll: sel => {
      const m = /^(?:\.([\w-]+))?(?:\[([\w-]+)\])?$/.exec(sel);
      if (!m) throw new Error('the stand-in page cannot look for "' + sel + '"');
      return tags().filter(t => (!m[1] || new RegExp('class="[^"]*\\b' + m[1] + '\\b').test(t)) &&
                                (!m[2] || new RegExp('\\s' + m[2] + '(=|\\s|>)').test(t))).map(el);
    }
  };
  const win = { document, BOOT: { email: OWNER }, console };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(helpers + '\nwindow.__view = { $:$, esc:esc, r0:r0, r1:r1, pc:pc, heat:heat, short:short, cmpClass:cmpClass,' +
                  ' openDraw:function(){}, put:function(){} };', win);
  vm.runInContext(s2, win);
  return {
    win, html: () => view,
    /* press what carries the attribute (with that value, when given), as the latest drawing wired it */
    press(attr, val) {
      const want = new RegExp('\\s' + attr + '="' + (val === undefined ? '[^"]*' : val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) + '"');
      const hit = on.filter(x => x[1] === 'click' && want.test(x[0])).pop();
      if (!hit) throw new Error('nothing on the page to press: ' + attr + (val === undefined ? '' : '="' + val + '"'));
      hit[2]({ stopPropagation() {}, preventDefault() {}, target: { closest: () => null } });
    },
    /* an input, change or focus on what carries the attribute, as the latest drawing wired it; `value` is typed in first */
    fire(ev, attr, val, value) {
      const want = new RegExp('\\s' + attr + '="' + val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"');
      const hit = on.filter(x => x[1] === ev && want.test(x[0])).pop();
      if (!hit) throw new Error('nothing on the page takes ' + ev + ': ' + attr + '="' + val + '"');
      if (value !== undefined) { hit[3].value = value; if (typeof value === 'boolean') hit[3].checked = value; }
      hit[2]({ stopPropagation() {}, preventDefault() {}, target: { closest: () => null } });
    }
  };
}

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
  if (uiData('homework').ok !== false) throw new Error('a pupil read the homework data');
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
ok &= run('a due date means the end of that day in the SCHOOL’s clock', () => {
  /* The page used to send a naive "…T23:59:00", the server read it in the PROJECT's zone and the
     browser rendered it in its OWN, so a deadline could show a day out and be called overdue on
     the wrong day. The date is now pinned once, here, and the page is sent words and a verdict. */
  const dir = _studentDirectory_();
  /* a date far ahead, so this stays a future deadline on every day the test is run (it was 2026-09-25,
     which became overdue on 26 Sep 2026 and failed the check below) */
  const r = homeworkCreate({ title:'Clock', classes:[{ cls:dir.students[0].cls, due:'2099-09-25' }],
    tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
  if (!r.ok) throw new Error('refused: ' + r.why);
  const hw = _homeworkRows_().pop();
  /* 23:59:59 on the 25th in Asia/Seoul is 14:59:59 UTC on the 25th */
  const d = new Date(hw.due);
  if (d.getUTCHours() !== 14 || d.getUTCDate() !== 25) {
    throw new Error('not pinned to the end of the 25th in the school zone: ' + hw.due);
  }
  if (hw.dueText !== '25 Sep') throw new Error('the page is not sent the worded date: ' + hw.dueText);
  if (typeof hw.overdue !== 'boolean' || typeof hw.soon !== 'boolean') throw new Error('no verdict was sent');
  if (hw.overdue) throw new Error('a future date was called overdue');
  /* and a date the browser could never parse is refused rather than silently stored */
  if (homeworkCreate({ title:'Bad', classes:[{ cls:dir.students[0].cls, due:'25/09/2026' }],
      tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] }).ok !== false) {
    throw new Error('a non-ISO date was accepted');
  }
  homeworkDelete(hw.id);
});
ok &= run('the Set homework list is sent each date in words, and whether it is overdue or due soon (labs-script-001)', () => {
  /* _homeworkRows_ worded each date and judged it in the school's zone, but the page's own list (_homeworkData_)
     dropped all three: every homework read "— due", and none was ever shown overdue or due soon */
  const cls = _studentDirectory_().students[0].cls;
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const words = d => +d.slice(8, 10) + ' ' + MON[+d.slice(5, 7) - 1];
  const soon = homeworkCreate({ title:'Due tomorrow', classes:[{ cls, due: day(1) }], tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
  const late = homeworkCreate({ title:'Due last week', classes:[{ cls, due: day(-5) }], tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
  if (!soon.ok || !late.ok) throw new Error('could not set the test homework');
  try {
    const page = uiData('homework');
    if (!page.ok) throw new Error(page.why);
    const s = page.data.homework.filter(h => h.id === soon.made[0])[0], l = page.data.homework.filter(h => h.id === late.made[0])[0];
    if (!s || s.dueText !== words(day(1)) || s.soon !== true || s.overdue !== false)
      throw new Error('due tomorrow reads ' + JSON.stringify(s && [s.dueText, s.soon, s.overdue]) + ', want ' + words(day(1)) + ', soon');
    if (!l || l.dueText !== words(day(-5)) || l.overdue !== true || l.soon !== false)
      throw new Error('due last week reads ' + JSON.stringify(l && [l.dueText, l.overdue, l.soon]) + ', want ' + words(day(-5)) + ', overdue');
  } finally { homeworkDelete(soon.made[0]); homeworkDelete(late.made[0]); }
});
ok &= run('the Set homework page shows the date, and "Set again" refills the form: title, class and stations (labs-script-002)', () => {
  const cls = _studentDirectory_().students[0].cls;
  const r = homeworkCreate({ title:'Again, please', classes:[{ cls, due: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) }],
    tasks:[{ labId:'digestion-lab', stationIds:['stomach'] }] });
  if (!r.ok) throw new Error('could not set the test homework: ' + r.why);
  try {
    const D = uiData('homework').data, hw = D.homework.filter(h => h.id === r.made[0])[0];
    const page = teacherPage();
    page.win.vHomework(D);
    /* no time was typed: the list says which time that is (Daniel, 2 Oct 2026: "it's not clear what time is set") */
    if (!page.html().includes('<div class="hw__due soon"><b>' + hw.dueText + '</b>due at 23:59</div>')) throw new Error('the list does not show it due soon, on ' + hw.dueText + ', at 23:59');
    page.press('data-hw', hw.id);                   /* open it */
    page.press('data-again', hw.id);                /* threw: ReferenceError: names is not defined */
    const html = page.html();
    if (!/id="ht"[^>]*value="Again, please"/.test(html)) throw new Error('the title was not carried over');
    if (!new RegExp('<option value="' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '" selected>').test(html)) throw new Error('the class ' + cls + ' was not chosen again');
    if (!/data-pick="digestion-lab\|stomach" checked/.test(html)) throw new Error('its station was not ticked again');
    if (/data-pick="digestion-lab\|mouth" checked/.test(html)) throw new Error('a station it did not set was ticked');
  } finally { homeworkDelete(r.made[0]); }
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

console.log('— Bio English Lab —');
global.ENGLISH_JSON = JSON.stringify({ site:'bio-english-lab', built:'t',
  years:[ { y:9, title:'Year 9', units:['t3'] }, { y:10, title:'Year 10', units:['t7'] } ],
  units:{ t3:{ n:'3', title:'Movement into and out of cells', year:9, sets:['t3.kw.meanings', 't3.describe.1'] },
          t7:{ n:'7', title:'Human nutrition', year:10, sets:['t7.kw.meanings.1'] } },
  sets:[ { id:'m.describe', unit:null, kind:'method', title:'How to describe', total:3, v:'m1' },
         { id:'t3.kw.meanings', unit:'t3', kind:'kw', title:'Keywords: meanings', total:4, v:'k1' },
         { id:'t3.describe.1', unit:'t3', kind:'describe', title:'Describe: diffusion', total:2, v:'d1' },
         { id:'t7.kw.meanings.1', unit:'t7', kind:'kw', title:'Keywords: meanings 1', total:5, v:'k7' } ] });
const enCid = CLIENT_ID, enTok = TOKEN_EMAIL;
CLIENT_ID = 'CID'; SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
const enDir = _studentDirectory_().students;
const enA = enDir[0], enB = enDir.filter(s => s.cls && s.cls !== enA.cls)[0] || enDir[1];
const enPost = (body, email) => { TOKEN_EMAIL = email;
  return JSON.parse(doPost({ postData:{ contents: JSON.stringify(Object.assign({ token: TOK }, body)) } })); };
const enKept = email => {
  const sh = ss.getSheetByName(T_ENGLISH); if (!sh || sh.getLastRow() < 2) return null;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, EN_SNAP).getValues();
  const r = v.filter(x => String(x[EN_EMAIL - 1]).toLowerCase() === email)[0];
  return r ? { row: r, kept: _enParse_(r[EN_SNAP - 1]) } : null;
};
const enDay = days => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
let enHw = null;

ok &= run('a save from somebody not signed in, or not on the roster, leaves no trace', () => {
  const rows = () => { const sh = ss.getSheetByName(T_ENGLISH); return sh ? sh.getLastRow() : 0; };
  const before = rows();
  const junk = JSON.parse(doPost({ postData:{ contents: JSON.stringify({ action:'english.save', token:'junk',
    sets:{ 't3.kw.meanings':{ done:1 } } }) } }));
  if (junk.ok !== false) throw new Error('a junk token was accepted');
  const r = enPost({ action:'english.save', sets:{ 't3.kw.meanings':{ done:1, first:1, total:4, snap:'f000', v:'k1' } } },
                   'stranger@elsewhere.com');
  if (r.ok !== false || !/class list/.test(r.why)) throw new Error('a stranger was recorded: ' + JSON.stringify(r));
  if (rows() !== before) throw new Error('a row was written');
});
ok &= run('a pupil’s saves make ONE row, with vocabulary and writing counted apart', () => {
  let r = enPost({ action:'english.save', sets:{ 't3.kw.meanings':{ done:2, first:1, total:4, snap:'f1t0', v:'k1' } } }, enA.email);
  if (!r.ok || r.saved !== 1) throw new Error(JSON.stringify(r));
  r = enPost({ action:'english.save', sets:{ 't3.describe.1':{ done:2, first:2, total:2, snap:'ff', v:'d1' } } }, enA.email);
  if (!r.ok) throw new Error(JSON.stringify(r));
  const sh = ss.getSheetByName(T_ENGLISH);
  if (sh.getLastRow() - 1 !== 1) throw new Error((sh.getLastRow() - 1) + ' rows for one pupil');
  const v = enKept(enA.email).row;
  if (v[0] !== enA.name || v[1] !== enA.cls) throw new Error('name/class: ' + v[0] + ' ' + v[1]);
  if (v[2] !== 2 || v[4] !== 2) throw new Error('vocabulary ' + v[2] + ', writing ' + v[4] + ' — want 2 and 2');
  if (Math.abs(v[3] - 0.5) > 1e-9 || v[5] !== 1) throw new Error('right-first-time shares ' + v[3] + ', ' + v[5]);
  if (v[6] !== 1) throw new Error('sets finished: ' + v[6]);
  if (!/T3 Keywords: meanings 2\/4 \(1\)/.test(v[8]) || !/T3 Describe: diffusion 2\/2 \(2\)/.test(v[8]))
    throw new Error('Per set reads "' + v[8] + '"');
});
ok &= run('two computers: the better answer to each question wins, nothing goes backwards', () => {
  /* the second computer has not caught up: it only knows question 3 was right */
  enPost({ action:'english.save', sets:{ 't3.kw.meanings':{ done:1, first:0, total:4, snap:'001t', v:'k1' } } }, enA.email);
  const x = enKept(enA.email).kept['t3.kw.meanings'];
  if (x.s !== 'f11t' || x.d !== 3 || x.f !== 1) throw new Error(JSON.stringify(x));
});
ok &= run('a set the site does not have is ignored; an old page cannot overwrite a rebuilt set', () => {
  enPost({ action:'english.save', sets:{ 'ghost.set':{ done:3, total:3, snap:'111', v:'x' },
    't3.kw.meanings':{ done:4, first:4, total:4, snap:'ffff', v:'OLD' } } }, enA.email);
  const k = enKept(enA.email).kept;
  if (k['ghost.set']) throw new Error('an unknown set was stored');
  if (k['t3.kw.meanings'].s !== 'f11t') throw new Error('an old version overwrote the current one: ' + k['t3.kw.meanings'].s);
});
ok &= run('english.mine gives a pupil their own work back, and nobody else’s', () => {
  const me = enPost({ action:'english.mine' }, enA.email);
  if (!me.ok || !me.onList || me.cls !== enA.cls) throw new Error(JSON.stringify(me).slice(0, 200));
  if (!me.sets['t3.kw.meanings'] || me.sets['t3.kw.meanings'].snap !== 'f11t') throw new Error('their work did not come back');
  const other = enPost({ action:'english.mine' }, enB.email);
  if (Object.keys(other.sets).length) throw new Error('a pupil was sent somebody else’s work');
  const stranger = enPost({ action:'english.mine' }, 'stranger@elsewhere.com');
  if (stranger.onList || Object.keys(stranger.sets).length || stranger.homework.length) throw new Error('a stranger was told something');
  const t = enPost({ action:'english.mine' }, OWNER);
  if (!t.teacher) throw new Error('the owner was not recognised as a teacher');
});
ok &= run('English sets can be set as homework beside lab stations, named in words', () => {
  const r = homeworkCreate({ title:'Osmosis words and the gut', classes:[{ cls: enA.cls, due: enDay(30) }],
    tasks:[ { labId:'digestion-lab', stationIds:['mouth'] },
            { labId:'bio-english-lab', stationIds:['t3.kw.meanings', 't3.describe.1'] } ] });
  if (!r.ok) throw new Error('refused: ' + r.why);
  enHw = _homeworkRows_().filter(h => h.id === r.made[0])[0];
  if (!/Bio English Lab: T3 Keywords: meanings, T3 Describe: diffusion/.test(enHw.what)) throw new Error('What reads "' + enHw.what + '"');
  if (!/Mouth and teeth/.test(enHw.what)) throw new Error('the lab half was lost: ' + enHw.what);
  const d = _homeworkData_();
  if (!d.english || d.english.sets.length !== 4) throw new Error('the page was not given the English sets');
  if (d.labs.some(l => l.id === 'bio-english-lab')) throw new Error('Bio English Lab was offered as a lab');
});
ok &= run('English sets count in the homework score, answered or not', () => {
  const man = _hwManifest_(), idx = _hwLabIndex_(['digestion-lab', 'bio-english-lab']);
  const lab = idx['digestion-lab'] && idx['digestion-lab'][enA.email];
  const mouth = lab && lab.byId.mouth ? Math.min(lab.byId.mouth.done, 8) : 0;
  const s = _hwScoreOne_(enHw, enA.email, idx, man);
  if (s.total !== 8 + 4 + 2) throw new Error('total ' + s.total + ', want 14');
  if (s.done !== mouth + 3 + 2) throw new Error('done ' + s.done + ', want ' + (mouth + 5));
  if (s.missing.length) throw new Error('named as missing: ' + s.missing);
  const b = _hwScoreOne_(enHw, enB.email, idx, man);
  if (b.total !== 14) throw new Error('a pupil with no English row lost the English questions from the total');
});
ok &= run('the homework reaches the pupils it was set for on the English site, and nobody else', () => {
  const me = enPost({ action:'english.mine' }, enA.email);
  const hw = me.homework.filter(h => h.id === enHw.id)[0];
  if (!hw) throw new Error('the pupil was not given their homework');
  if (hw.sets.join(',') !== 't3.kw.meanings,t3.describe.1') throw new Error('sets: ' + hw.sets);
  if (enB.cls !== enA.cls && enPost({ action:'english.mine' }, enB.email).homework.some(h => h.id === enHw.id))
    throw new Error('another class was given it');
  const r = homeworkCreate({ title:'Just the lab', classes:[{ cls: enA.cls, due: enDay(31) }],
    tasks:[{ labId:'digestion-lab', stationIds:['stomach'] }] });
  if (enPost({ action:'english.mine' }, enA.email).homework.some(h => h.id === r.made[0]))
    throw new Error('a lab-only homework was listed on the English site');
  homeworkDelete(r.made[0]);
});
ok &= run('the Bio English view is teacher-only, and has what the page needs', () => {
  VISITOR = 'pupil@pupils.x.kr';
  if (uiData('english').ok !== false) throw new Error('a pupil read the English view');
  VISITOR = OWNER;
  const r = uiData('english');
  if (!r.ok) throw new Error(r.why);
  if (!r.data.english || r.data.english.sets.length !== 4) throw new Error('no set list');
  const p = r.data.progress[enA.email];
  if (!p || p.sets['t3.kw.meanings'][0] !== 3 || p.sets['t3.kw.meanings'][1] !== 1) throw new Error('progress: ' + JSON.stringify(p));
  const page = doGet({ parameter:{ page:'english' } }).html;
  if (!/"tab":"english"/.test(page)) throw new Error('?page=english did not open on the English view');
});
ok &= run('homework is posted to Classroom: one post per class, to that class’s course', () => {
  const POSTS = [];
  global.Classroom = { Courses: { CourseWork: { create: (body, courseId) => { POSTS.push({ body, courseId }); return { id: 'cw' + POSTS.length }; } } } };
  try {
    const ids = _classroomIds_(), course = ids[enA.email] && ids[enA.email].courseId;
    if (!course) throw new Error('the test roster has no course id for ' + enA.email);
    const r = homeworkCreate({ title:'Posted', post:true, classes:[{ cls: enA.cls, due:'2027-02-01' }],
      tasks:[{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] });
    if (!r.ok) throw new Error(r.why);
    if (POSTS.length !== 1 || POSTS[0].courseId !== course) throw new Error(JSON.stringify(POSTS));
    const b = POSTS[0].body;
    if (b.title !== 'Posted' || b.state !== 'PUBLISHED' || b.workType !== 'ASSIGNMENT') throw new Error('body: ' + JSON.stringify(b));
    if (!/\/bio-english-lab\/#\/hw\/HW-/.test(b.materials[0].link.url)) throw new Error('link: ' + b.materials[0].link.url);
    /* the end of 1 February in the school's zone (UTC+9 here) is 14:59 UTC that day */
    if (b.dueDate.day !== 1 || b.dueDate.month !== 2 || b.dueTime.hours !== 14 || b.dueTime.minutes !== 59)
      throw new Error('due ' + JSON.stringify([b.dueDate, b.dueTime]));
    if (b.assigneeMode) throw new Error('a whole class was posted to individuals');
    const row = _homeworkRows_().filter(h => h.id === r.made[0])[0];
    if (row.course !== course || row.courseWork !== 'cw1') throw new Error('ids not written back: ' + row.course + ' ' + row.courseWork);
    if (!r.posted.length || r.notPosted.length) throw new Error(JSON.stringify([r.posted, r.notPosted]));
    homeworkDelete(r.made[0]);
    /* chosen pupils: assigned to them alone */
    const r2 = homeworkCreate({ title:'One only', post:true, classes:[{ cls:'', due:'2027-02-02', emails:[enA.email] }],
      tasks:[{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] });
    const b2 = POSTS[1] && POSTS[1].body;
    if (!b2 || b2.assigneeMode !== 'INDIVIDUAL_STUDENTS' || b2.individualStudentsOptions.studentIds.length !== 1)
      throw new Error('not posted to the pupil alone: ' + JSON.stringify(b2));
    homeworkDelete(r2.made[0]);
  } finally { global.Classroom = undefined; }
});
ok &= run('with Classroom off, the homework is still set and it says why it was not posted', () => {
  const r = homeworkCreate({ title:'Not posted', post:true, classes:[{ cls: enA.cls, due:'2027-02-03' }],
    tasks:[{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] });
  if (!r.ok) throw new Error(r.why);
  if (r.posted.length || !/not switched on/.test(r.notPosted.join(' '))) throw new Error(JSON.stringify(r.notPosted));
  homeworkDelete(r.made[0]);
});
ok &= run('the due-date email goes to the teacher once, and never for last month’s homework', () => {
  MAILS.length = 0;
  const r = homeworkCreate({ title:'Due yesterday', classes:[{ cls: enA.cls, due: enDay(-1.5) }],
    tasks:[{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] });
  const old = homeworkCreate({ title:'Long ago', classes:[{ cls: enA.cls, due: enDay(-40) }],
    tasks:[{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] });
  if (!r.ok || !old.ok) throw new Error('could not set the test homework');
  sendDueSummaries();
  const mine = MAILS.filter(m => /Due yesterday/.test(m.subj));
  if (mine.length !== 1 || mine[0].to !== OWNER) throw new Error(JSON.stringify(MAILS.map(m => [m.to, m.subj])));
  if (!/T3 Keywords: meanings/.test(mine[0].body) || mine[0].body.indexOf(enA.name) < 0) throw new Error(mine[0].body);
  if (MAILS.some(m => /Long ago/.test(m.subj))) throw new Error('a homework a month past its date was emailed');
  const row = _homeworkRows_().filter(h => h.id === r.made[0])[0];
  if (row.status !== 'reported' || !row.reported) throw new Error('not marked reported');
  sendDueSummaries();
  if (MAILS.filter(m => /Due yesterday/.test(m.subj)).length !== 1) throw new Error('emailed twice');
  homeworkDelete(r.made[0]); homeworkDelete(old.made[0]);
});
ok &= run('a Due cell typed over with words breaks nothing, and the teacher is shown it (labs-script-003)', () => {
  /* Due is the teacher's to edit in the tab. new Date("next Friday").toISOString() threw, and one such cell broke the
     homework page, every rostered pupil's english.mine and the morning email */
  MAILS.length = 0;
  const due = homeworkCreate({ title:'Due before', classes:[{ cls: enA.cls, due: enDay(-1.5) }],
    tasks:[{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] });
  const r = homeworkCreate({ title:'Typed over', classes:[{ cls: enA.cls, due: enDay(3) }],
    tasks:[{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] });
  if (!due.ok || !r.ok) throw new Error('could not set the test homework');
  const sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh);
  const at = _homeworkRows_().filter(h => h.id === r.made[0])[0].row;
  sh.getRange(at, hc.Due).setValue('next Friday');
  sh.getRange(at, hc.Created).setValue('this morning');
  try {
    const bad = _homeworkRows_().filter(h => h.id === r.made[0])[0];
    if (!bad.dueBad || bad.due !== null || bad.dueText !== '' || bad.overdue || bad.soon || bad.created !== null)
      throw new Error('the row reads ' + JSON.stringify(bad).slice(0, 240));
    const page = uiData('homework');
    if (!page.ok) throw new Error('the homework page failed: ' + page.why);
    const card = page.data.homework.filter(h => h.id === r.made[0])[0];
    if (!card || !card.dueBad) throw new Error('the page is not told the date cannot be read');
    const tp = teacherPage(); tp.win.vHomework(page.data); tp.press('data-hw', card.id);
    if (!/the due date cannot be read/.test(tp.html()) || !/is not a date/.test(tp.html())) throw new Error('the teacher is not shown it');
    const me = enPost({ action:'english.mine' }, enA.email);
    const mine = (me.homework || []).filter(h => h.id === r.made[0])[0];
    if (!me.ok || !mine || mine.due !== '' || mine.overdue) throw new Error('english.mine: ' + JSON.stringify(me).slice(0, 240));
    sendDueSummaries();
    if (MAILS.filter(m => /Due before/.test(m.subj)).length !== 1) throw new Error('the homework really due was not emailed');
    if (MAILS.some(m => /Typed over/.test(m.subj))) throw new Error('homework with no readable date was emailed');
  } finally {
    sh.getRange(at, hc.Due).setValue(new Date()); sh.getRange(at, hc.Created).setValue(new Date());
    homeworkDelete(r.made[0]); homeworkDelete(due.made[0]);
  }
});
ok &= run('the morning email is switched on once, however often the menu is used', () => {
  installDailySummary(); installDailySummary();
  const t = ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction() === 'sendDueSummaries');
  if (t.length !== 1) throw new Error(t.length + ' triggers');
  VISITOR = 'pupil@pupils.x.kr'; installDailySummary(); VISITOR = OWNER;
  if (ScriptApp.getProjectTriggers().length !== 1) throw new Error('a pupil changed the triggers');
});
ok &= run('with the English site unreachable, lab homework carries on and English is named, not zeroed', () => {
  const keep = ENGLISH_JSON; ENGLISH_JSON = '';
  try { CacheService.getScriptCache().put('EN_STAMP', 'gone', 600); } catch (e) {}
  try {
    const d = _homeworkData_();
    if (d.english !== null) throw new Error('an English list appeared from nowhere');
    if (!d.manifestOk) throw new Error('the labs stopped working with it');
    const s = _hwScoreOne_(enHw, enA.email, _hwLabIndex_(['digestion-lab', 'bio-english-lab']), _hwManifest_());
    if (s.missing.indexOf('t3.kw.meanings') < 0) throw new Error('the English sets were not named as unmarkable');
    if (s.total !== 8) throw new Error('total ' + s.total + ', want the lab alone (8)');
  } finally { ENGLISH_JSON = keep; try { CacheService.getScriptCache().put('EN_STAMP', 'back', 600); } catch (e) {} }
});
/* ── Goes (Sept 2026), Bio English: Start again empties the set, never the record ── */
const enRowNo = email => { const sh = ss.getSheetByName(T_ENGLISH);
  return sh.getRange(2, EN_EMAIL, sh.getLastRow() - 1, 1).getValues().findIndex(r => String(r[0]).toLowerCase() === email) + 2; };
ok &= run('English: Start again — the set gets the new go; answered and right first time keep the first go', () => {
  enPost({ action:'english.save', sets:{ 't3.kw.meanings':{ done:3, first:2, total:4, snap:'ff1t', v:'k1' } } }, enB.email);
  enPost({ action:'english.save', sets:{ 't3.kw.meanings':{ done:3, first:2, total:4, snap:'0000', v:'k1', go:2, snap1:'ff1t', best:'ff1t' } } }, enB.email);
  const x = enKept(enB.email).kept['t3.kw.meanings'];
  if (x.s !== '0000' || x.g !== 2 || x.s1 !== 'ff1t' || x.b !== 'ff1t' || x.d !== 3 || x.f !== 2) throw new Error(JSON.stringify(x));
  const again = ss.getSheetByName(T_ENGLISH).getRange(enRowNo(enB.email), EN_AGAIN).getValue();
  if (!/Keywords: meanings \(round 2, 0\/4\)/.test(again)) throw new Error('practised again: ' + again);
});
ok &= run('English: an old page (no goes) never undoes a newer go, and its answers still count', () => {
  enPost({ action:'english.save', sets:{ 't3.kw.meanings':{ done:4, first:3, total:4, snap:'fff1', v:'k1' } } }, enB.email);
  const x = enKept(enB.email).kept['t3.kw.meanings'];
  if (x.s !== '0000' || x.g !== 2) throw new Error('an older go reached the page: ' + JSON.stringify(x));
  if (x.b !== 'fff1' || x.d !== 4) throw new Error('its answers did not count: ' + JSON.stringify(x));
  /* the set is past round 1: they may be a later round's answers, so the first round is left as it was */
  if (x.s1 !== 'ff1t' || x.f !== 2) throw new Error('the first round moved: ' + JSON.stringify(x));
});
ok &= run('English: an old page still adds to the first round of a set on round 1', () => {
  const m = _enMerge_({ s:'t000', g:1, s1:'', b:'t000', t:4, v:'k1', k:'kw', d:0, f:0 },
                      { s:'ff00', g:1, s1:'', b:'', t:4, v:'k1', k:'kw', d:2, f:2, oldPage:true });
  if (m.s1 !== 'ff00' || m.f !== 2 || m.d !== 2) throw new Error(JSON.stringify(m));
});
ok &= run('English: two computers on the same go add, question by question', () => {
  enPost({ action:'english.save', sets:{ 't3.kw.meanings':{ done:4, first:3, total:4, snap:'f000', v:'k1', go:2 } } }, enB.email);
  enPost({ action:'english.save', sets:{ 't3.kw.meanings':{ done:4, first:3, total:4, snap:'0t00', v:'k1', go:2 } } }, enB.email);
  const x = enKept(enB.email).kept['t3.kw.meanings'];
  if (x.s !== 'ft00' || x.g !== 2 || x.d !== 4) throw new Error(JSON.stringify(x));
});
ok &= run('English: english.mine gives the go, the first go and the best back', () => {
  const me = enPost({ action:'english.mine' }, enB.email).sets['t3.kw.meanings'];
  if (!me || me.go !== 2 || me.here !== 'ft00' || me.snap1 !== 'ff1t' || me.best !== 'fff1') throw new Error(JSON.stringify(me));
  /* `snap` is for a page from before goes: the first round, never round 2's letters */
  if (me.snap !== 'ff1t') throw new Error('snap: ' + me.snap);
  if (!_hasPractice_(enB.email)) throw new Error('Bio English practice not seen');
});
ok &= run('English: a tab made before the new column is widened by the next save', () => {
  const sh = ss.getSheetByName(T_ENGLISH);
  for (const k of Array.from(sh.cells.keys())) if (+k.split(':')[1] > 11) sh.cells.delete(k);
  sh.maxC = 11;
  const r = enPost({ action:'english.save', sets:{ 't3.kw.meanings':{ done:4, first:3, total:4, snap:'ff00', v:'k1', go:2 } } }, enB.email);
  if (!r.ok) throw new Error(JSON.stringify(r));
  if (sh.maxC < 12 || sh.getRange(1, 12).getValue() !== 'Practised again') throw new Error('not widened: ' + sh.maxC);
  if (!/round 2, 2\/4/.test(sh.getRange(enRowNo(enB.email), EN_AGAIN).getValue())) throw new Error('practised again not written');
});
/* ── The Write-Up Lab (Daniel, 3 Oct 2026: "make sure that when I set homework, this is also something I can set and
   that is tracked in the spreadsheet") ──────────────────────────────────────────────────────────────────────────────
   Whole parts; one standard for everyone: a part is finished when every red pen in it is done (each version) and every
   question is answered, IB ones too. A part's homework "questions" are its red-pen marks plus its questions (units).
   Learn steps, Mistakes to avoid and Go further are kept and shown, never needed; keyword cards are not kept. */
console.log('— Write-Up Lab —');
global.WRITEUP_JSON = JSON.stringify({ v:1, stages:[ { id:'plan', name:'Plan' } ], parts:[
  { id:'variables', title:'Variables', stage:'plan', levels:'gie', v:'vv1', steps:7, redpens:[ { l:'g', n:5 }, { l:'i', n:4 } ], questions:8, further:1, units:17 },
  { id:'background', title:'Background', stage:'plan', levels:'ie', v:'bb1', steps:9, redpens:[ { l:'i', n:5 }, { l:'e', n:4 } ], questions:8, further:1, units:17 } ] });
const wuPost = (body, email) => enPost(body, email);
const wuKept = email => {
  const sh = ss.getSheetByName(T_WRITEUP); if (!sh || sh.getLastRow() < 2) return null;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, WU_TIMES).getValues();
  const r = v.filter(x => String(x[WU_EMAIL - 1]).toLowerCase() === email)[0];
  return r ? { row: r, kept: _wuParse_(r[WU_SNAP - 1]) } : null;
};
const VAR_DONE = { v:'vv1', l:'1110000', r:{ g:'11111', i:'1111' }, m:1, q:'ff1s1111', f:'1' };   /* every mistake, every question */
let wuHw = null;

ok &= run('Write-Up: a save from somebody not signed in, or not on the roster, leaves no trace', () => {
  const rows = () => { const sh = ss.getSheetByName(T_WRITEUP); return sh ? sh.getLastRow() : 0; };
  const before = rows();
  const junk = JSON.parse(doPost({ postData:{ contents: JSON.stringify({ action:'writeup.save', token:'junk', parts:{ variables: VAR_DONE } }) } }));
  if (junk.ok !== false) throw new Error('a junk token was accepted');
  const r = wuPost({ action:'writeup.save', parts:{ variables: VAR_DONE } }, 'stranger@elsewhere.com');
  if (r.ok !== false || !/class list/.test(r.why)) throw new Error('a stranger was recorded: ' + JSON.stringify(r));
  if (rows() !== before) throw new Error('a row was written');
});
ok &= run('Write-Up: a pupil’s saves make ONE row: parts finished, mistakes found, questions answered, right first time, Learn steps, per part', () => {
  let r = wuPost({ action:'writeup.save', parts:{ variables: { v:'vv1', l:'1000000', r:{ g:'11000' }, q:'f0000000' } } }, enA.email);
  if (!r.ok || r.saved !== 1) throw new Error(JSON.stringify(r));
  r = wuPost({ action:'writeup.save', parts:{ variables: VAR_DONE } }, enA.email);
  if (!r.ok) throw new Error(JSON.stringify(r));
  const sh = ss.getSheetByName(T_WRITEUP);
  if (!sh) throw new Error('no 📝 Write-Up Lab tab');
  if (sh.getLastRow() - 1 !== 1) throw new Error((sh.getLastRow() - 1) + ' rows for one pupil');
  const v = wuKept(enA.email).row;
  if (v[0] !== enA.name || v[1] !== enA.cls) throw new Error('name/class: ' + v[0] + ' ' + v[1]);
  if (v[2] !== 1 || v[3] !== 9 || v[4] !== 8 || Math.abs(v[5] - 0.25) > 1e-9 || v[6] !== 3)
    throw new Error('finished ' + v[2] + ', found ' + v[3] + ', answered ' + v[4] + ', first ' + v[5] + ', learn ' + v[6] + ' — want 1, 9, 8, 0.25, 3');
  if (v[8] !== 'Variables ✓ (red pen 9/9, questions 8/8, 2 first time, Learn 3/7, Mistakes to avoid opened, Go further 1/1)') throw new Error('Per part reads "' + v[8] + '"');
  if (sh.getRange(1, WU_TIMES).getValue() !== 'Part times') throw new Error('no Part times column');
});
ok &= run('Write-Up: two computers — letter by letter the better one, nothing goes backwards', () => {
  wuPost({ action:'writeup.save', parts:{ variables: { v:'vv1', l:'0000000', r:{ g:'10000', i:'0000' }, q:'f0000000' } } }, enB.email);
  wuPost({ action:'writeup.save', parts:{ variables: { v:'vv1', l:'0100000', r:{ g:'01000' }, q:'t1000000' } } }, enB.email);
  const x = wuKept(enB.email).kept.variables;
  if (x.r.g !== '11000' || x.r.i !== '0000' || x.q !== 'f1000000' || x.l !== '0100000') throw new Error(JSON.stringify(x));
});
ok &= run('Write-Up: a part the site does not have is ignored; a page from before a part was rewritten cannot overwrite it', () => {
  wuPost({ action:'writeup.save', parts:{ ghost: { v:'g1', q:'111' }, variables: { v:'OLD', l:'1111111', r:{ g:'11111', i:'1111' }, q:'ffffffff', f:'1' } } }, enB.email);
  const k = wuKept(enB.email).kept;
  if (k.ghost) throw new Error('an unknown part was stored');
  if (k.variables.q !== 'f1000000') throw new Error('an old version overwrote the current one: ' + k.variables.q);
});
ok &= run('Write-Up: writeup.mine gives a pupil their own work back, and nobody else’s; a teacher is told the teacher page', () => {
  const me = wuPost({ action:'writeup.mine' }, enA.email);
  if (!me.ok || !me.onList || me.cls !== enA.cls) throw new Error(JSON.stringify(me).slice(0, 200));
  if (!me.parts.variables || me.parts.variables.q !== 'ff1s1111' || me.parts.variables.r.g !== '11111') throw new Error('their work did not come back');
  const stranger = wuPost({ action:'writeup.mine' }, 'stranger@elsewhere.com');
  if (stranger.onList || Object.keys(stranger.parts).length || stranger.homework.length) throw new Error('a stranger was told something');
  if (!wuPost({ action:'writeup.mine' }, OWNER).teacher) throw new Error('the owner was not recognised as a teacher');
});
ok &= run('Accommodation on a tab from before (8 Oct 2026): it is INSERTED after Course id, never written over a column of the teacher’s own; the switch and Tidy up agree', () => {
  const sh = ss.getSheetByName(T_STUDENTS), heads = () => sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).replace(/^✎\s*/, '').trim());
  const ac = heads().indexOf('Accommodation') + 1;
  if (ac) sh.deleteColumns(ac, 1);                                  /* the tab as it was before this change */
  const cid = heads().indexOf('Course id') + 1;
  sh.insertColumnAfter(cid); sh.getRange(1, cid + 1).setValue('My notes'); sh.getRange(2, cid + 1).setValue('needs glasses');
  if (heads()[cid] !== 'My notes') throw new Error('set-up: ' + heads().slice(-3));
  const r = studentAccommodation({ email: enA.email, on: true });
  if (!r.ok) throw new Error('refused: ' + JSON.stringify(r).slice(0, 160));
  let h = heads();
  if (h[cid] !== 'Accommodation' || h[cid + 1] !== 'My notes') throw new Error('the switch put it in the wrong place: ' + h.slice(-4));
  if (String(sh.getRange(2, cid + 2).getValue()) !== 'needs glasses') throw new Error('the teacher’s own column lost what it held');
  _repairStudentSheet_(); _styleStudents_();                        /* Tidy up, as Daniel presses it */
  h = heads();
  if (h.filter(x => x === 'Accommodation').length !== 1 || h.indexOf('Accommodation') !== h.indexOf('Course id') + 1 || h.indexOf('My notes') < 0)
    throw new Error('Tidy up wrote over a column: ' + h.slice(-4));
  if (_studentTrailColumns_(sh).length) throw new Error('a second Tidy up added something again');
  studentAccommodation({ email: enA.email, on: false });
  sh.deleteColumns(h.indexOf('My notes') + 1, 1);                   /* leave the tab as it was found */
});
ok &= run('Accommodation (8 Oct 2026): a teacher turns it on for one pupil; only that pupil is told, on all three pages; typed Yes works; Tidy up keeps it after Course id; never a pupil', () => {
  const heads = () => { const sh = ss.getSheetByName(T_STUDENTS); return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).replace(/^✎\s*/, '').trim()); };
  let r = studentAccommodation({ email: ' ' + enA.email.toUpperCase(), on: true });
  if (!r.ok || !/has the accommodation now/.test(r.note)) throw new Error('refused: ' + JSON.stringify(r).slice(0, 160));
  if (!r.data.students.some(x => x.email === enA.email && x.acc === true)) throw new Error('the Students view does not show it');
  if (r.data.students.some(x => x.email !== enA.email && x.acc)) throw new Error('another pupil shows it');
  if (heads().indexOf('Accommodation') !== heads().indexOf('Course id') + 1) throw new Error('the column is not after Course id: ' + heads().slice(-4));
  const told = e => [enPost({ action:'english.mine' }, e).acc, wuPost({ action:'writeup.mine' }, e).acc, pullFor(e).acc];
  if (told(enA.email).join() !== '1,1,1') throw new Error('the pupil was not told on every page: ' + told(enA.email));
  if (told(enB.email).some(x => x !== undefined)) throw new Error('a pupil without it was told: ' + told(enB.email));
  if (told('stranger@elsewhere.com').some(x => x !== undefined)) throw new Error('a stranger was told');
  VISITOR = 'pupil@pupils.x.kr';
  if (studentAccommodation({ email: enB.email, on: true }).ok !== false) throw new Error('a pupil turned it on');
  VISITOR = OWNER;
  if (told(enB.email).some(x => x !== undefined)) throw new Error('the refused call changed something');
  if (studentAccommodation({ email: 'nobody@x.kr', on: true }).ok !== false) throw new Error('somebody not on the tab was accepted');
  /* Tidy up: the heading is one it knows, so the column stays (even empty for others), last, with the Yes in it */
  _repairStudentSheet_(); _styleStudents_();
  if (heads().filter(h => h === 'Accommodation').length !== 1 || heads().indexOf('Accommodation') !== heads().indexOf('Course id') + 1)
    throw new Error('Tidy up moved, repeated or removed it: ' + heads().slice(-4));
  if (told(enA.email).join() !== '1,1,1') throw new Error('Tidy up lost the Yes');
  r = studentAccommodation({ email: enA.email, on: false });
  if (!r.ok || r.data.students.some(x => x.acc)) throw new Error('it did not go off');
  if (told(enA.email).some(x => x !== undefined)) throw new Error('still told after it went off');
  /* a teacher who types into the cell: yes / ✓ count, anything else does not */
  const sh = ss.getSheetByName(T_STUDENTS), C = _studentCols_(sh), rowOfB = sh.getRange(2, C.email, sh.getLastRow() - 1, 1).getValues().findIndex(x => _cleanEmail_(x[0]) === enB.email) + 2;
  sh.getRange(rowOfB, C.acc).setValue('yes');
  if (told(enB.email).join() !== '1,1,1') throw new Error('a typed yes did not count');
  sh.getRange(rowOfB, C.acc).setValue('no');
  if (told(enB.email).some(x => x !== undefined)) throw new Error('a typed no counted');
  sh.getRange(rowOfB, C.acc).setValue('');
});
ok &= run('Accommodation, the audits of 8 Oct 2026: 📊 Refresh and Tidy up insert it after Course id by themselves, never over a teacher’s column; X and O are not a yes', () => {
  const sh = ss.getSheetByName(T_STUDENTS);
  const heads = () => sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).replace(/^✎\s*/, '').trim());
  /* the fake's moveColumns (used below only to play a teacher's drag) does what Google documents: A:B moved to 5 become C:D */
  const t = ss.insertSheet('__move test'); t.getRange(1, 1, 1, 5).setValues([['a', 'b', 'c', 'd', 'e']]); t.moveColumns(t.getRange('A1:B1'), 5);
  const moved = t.getRange(1, 1, 1, 5).getValues()[0].join(''); ss.deleteSheet(t);
  if (moved !== 'cdabe') throw new Error('the fake moveColumns is wrong: ' + moved);
  const acCol = () => heads().indexOf('Accommodation') + 1, cidCol = () => heads().indexOf('Course id') + 1;
  const removeAcc = () => { if (acCol()) sh.deleteColumns(acCol(), 1); };
  const rowOf = (e) => { const C = _studentCols_(sh); return sh.getRange(2, C.email, sh.getLastRow() - 1, 1).getValues().findIndex(x => _cleanEmail_(x[0]) === e) + 2; };
  const told = (e) => pullFor(e).acc;
  /* 1. 📊 Refresh on a tab from before, with a column of the teacher's own right after Course id holding a "y" */
  removeAcc();
  const g = cidCol(), rA = rowOf(enA.email);
  sh.insertColumnAfter(g); sh.getRange(1, g + 1).setValue('Glasses?'); sh.getRange(rA, g + 1).setValue('y');
  refreshDashboard();
  let h = heads();
  if (h[g] !== 'Accommodation' || h[g + 1] !== 'Glasses?') throw new Error('Refresh wrote over a column: ' + h.slice(-4));
  if (String(sh.getRange(rA, g + 2).getValue()) !== 'y') throw new Error('the teacher’s column lost what it held');
  if (told(enA.email) !== undefined) throw new Error('a "y" in the teacher’s own column turned the help on');
  /* 2. Tidy up on its own, the switch never pressed */
  removeAcc();
  setup();
  h = heads();
  if (h.indexOf('Accommodation') !== h.indexOf('Course id') + 1 || h[h.indexOf('Accommodation') + 1] !== 'Glasses?') throw new Error('Tidy up alone: ' + h.slice(-4));
  sh.deleteColumns(heads().indexOf('Glasses?') + 1, 1);
  /* 3. X means no in Korea; O is not read either; a ticked box, Yes and the ticks a teacher may type are */
  if (_accOn_('X') || _accOn_('x') || _accOn_('O') || _accOn_('') || !_accOn_(true) || !_accOn_('Yes') || !_accOn_(' yes ') || !_accOn_('✓') || !_accOn_('✔️') || !_accOn_('✅')) throw new Error('_accOn_ reads the wrong values');
});
ok &= run('the Students tab’s guard (the verification audits, 8 Oct 2026): a column dragged out of its place is refused by Tidy up and 📊 Refresh alike; an empty column or a heading typed twice is refused by Refresh and put right by Tidy up; a cleared heading is given back, never replaced by an empty column; every address and the Accommodation kept', () => {
  const sh = ss.getSheetByName(T_STUDENTS);
  const heads = () => sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).replace(/^✎\s*/, '').trim());
  const col = (name) => heads().indexOf(name) + 1;
  const emailsNow = () => { const C = _studentCols_(sh); return sh.getRange(2, C.email, sh.getLastRow() - 1, 1).getValues().map(x => _cleanEmail_(x[0])).filter(Boolean).sort().join(','); };
  const rowOf = (e) => { const C = _studentCols_(sh); return sh.getRange(2, C.email, sh.getLastRow() - 1, 1).getValues().findIndex(x => _cleanEmail_(x[0]) === e) + 2; };
  const found = (e) => { const j = pullFor(e); return j.ok && 'homework' in j; };
  const accRead = () => pullFor(enA.email).acc === 1 && pullFor(enB.email).acc === undefined;
  setup();                                                  /* a tab as Tidy up lays it out */
  sh.getRange(rowOf(enA.email), col('Accommodation')).setValue('Yes');
  const lab0 = LABS.find(l => col(l.name) > 0).name;
  const keep = { cells: new Map(sh.cells), maxC: sh.maxC }, reset = () => { sh.cells = new Map(keep.cells); sh.maxC = keep.maxC; };
  const addresses = emailsNow(), layout = heads().join('|');
  /* refused by Tidy up and Refresh alike: a column out of its place */
  const refused = [
    ['Accommodation next to the names', () => sh.moveColumns(sh.getRange(1, col('Accommodation')), 3)],
    ['Labs started next to the names', () => sh.moveColumns(sh.getRange(1, col('Labs started')), 3)],
    ['Labs started and Average next to the names', () => sh.moveColumns(sh.getRange(1, col('Labs started'), 1, 2), 3)],
    ['a lab between Labs started and Average', () => sh.moveColumns(sh.getRange(1, col(lab0)), col('Average'))],
    ['a column of the teacher’s own between Course id and Accommodation', () => { const c = col('Course id'); sh.insertColumnAfter(c); sh.getRange(1, c + 1).setValue('My notes'); sh.getRange(2, c + 1).setValue('x'); }],
  ];
  /* refused by 📊 Refresh, put right by Tidy up (the final verification audit: written over, the empty column became the
     one every save reads; and a note once said to type the heading back, which made two) */
  const healed = [
    ['an empty column inserted before Accommodation', () => sh.insertColumnBefore(col('Accommodation')), /"Accommodation" stands in column [A-Z]+, but belongs in column [A-Z]+, which has no heading\. Tidy up removes that column when it is empty/],
    ['two empty columns inserted before Course id', () => { const c = col('Course id'); sh.insertColumnBefore(c); sh.insertColumnBefore(c); }, /"Course id" stands in column [A-Z]+, but belongs in column [A-Z]+, which has no heading/],
    ['"Accommodation" typed into an empty column inserted before it', () => { const c = col('Accommodation'); sh.insertColumnBefore(c); sh.getRange(1, c).setValue('Accommodation'); }, /two columns are headed "Accommodation" \([A-Z]+ and [A-Z]+\), and the script reads only the first/],
    ['"Course id" typed into the first of two empty columns inserted before it', () => { const c = col('Course id'); sh.insertColumnBefore(c); sh.insertColumnBefore(c); sh.getRange(1, c).setValue('Course id'); }, /two columns are headed "Course id"/],
  ];
  try {
    for (const [name, drag] of refused) {
      reset(); drag();
      const dragged = heads().join('|');
      const said = setup();
      refreshDashboard(); refreshDashboard();
      if (heads().join('|') !== dragged) throw new Error(name + ': a heading was written over: ' + heads().join(' | '));
      if (emailsNow() !== addresses) throw new Error(name + ': addresses lost or changed');
      if (!found(enA.email) || !found(enB.email)) throw new Error(name + ': a pupil is no longer found');
      if (!accRead()) throw new Error(name + ': the Accommodation is read wrongly');
      if (!/NOT restyled/.test(said) || !/NOT restyled/.test(_STUDENTS_NOT_STYLED_)) throw new Error(name + ': Tidy up did not say the tab was not restyled: ' + String(said).slice(0, 160));
      if (/type back a heading/.test(_STUDENTS_NOT_STYLED_)) throw new Error(name + ': the note still says to type a heading back');
    }
    for (const [name, drag, says] of healed) {
      reset(); drag();
      const dragged = heads().join('|');
      refreshDashboard();
      if (heads().join('|') !== dragged) throw new Error(name + ': Refresh wrote a heading over: ' + heads().join(' | '));
      if (!says.test(_STUDENTS_NOT_STYLED_)) throw new Error(name + ': Refresh did not say where: ' + _STUDENTS_NOT_STYLED_.slice(0, 220));
      if (emailsNow() !== addresses) throw new Error(name + ': addresses lost after Refresh');
      const said = setup();
      if (_STUDENTS_NOT_STYLED_ || /NOT restyled/.test(said)) throw new Error(name + ': Tidy up did not put it right: ' + String(said).slice(0, 220));
      if (heads().join('|') !== layout) throw new Error(name + ': Tidy up left ' + heads().join(' | '));
      if (emailsNow() !== addresses || !found(enA.email) || !accRead()) throw new Error(name + ': an address or the Accommodation was lost');
    }
    /* a heading cleared by mistake: nothing is inserted in its place (that empty column would become the one every save
       reads); the heading is given back over its own column */
    for (const name of ['School email', 'Accommodation', 'Classroom user id']) {
      reset();
      const width = sh.getLastColumn();
      sh.getRange(1, col(name)).setValue('');
      refreshDashboard();
      if (sh.getLastColumn() !== width) throw new Error('a column was inserted for the cleared ' + name + ' heading: ' + heads().join(' | '));
      if (heads().join('|') !== layout) throw new Error('the cleared ' + name + ' heading was not given back: ' + heads().join(' | '));
      if (emailsNow() !== addresses || !accRead()) throw new Error('the cleared ' + name + ' heading lost an address or the Accommodation');
    }
    /* a heading retyped ("Accommodations"): nothing inserted; the note says to type it exactly */
    reset();
    let width = sh.getLastColumn();
    sh.getRange(1, col('Accommodation')).setValue('Accommodations');
    refreshDashboard();
    if (sh.getLastColumn() !== width) throw new Error('a column was inserted beside "Accommodations"');
    if (!/holds "Accommodations", where "Accommodation" belongs\. If it is that column, type "Accommodation" as its heading/.test(_STUDENTS_NOT_STYLED_)) throw new Error('the retyped heading: ' + _STUDENTS_NOT_STYLED_.slice(0, 220));
    /* a hidden column deleted whole (Imported): Tidy up puts it back and restyles */
    reset();
    sh.deleteColumns(col('Imported'), 1);
    setup();
    if (_STUDENTS_NOT_STYLED_ || heads().join('|') !== layout) throw new Error('a deleted Imported column was not put back: ' + heads().join(' | ') + ' / ' + _STUDENTS_NOT_STYLED_.slice(0, 120));
    /* a tab from before Accommodation, with notes under no heading after Course id: Accommodation goes in before them */
    reset();
    sh.deleteColumns(col('Accommodation'), 1);
    const cid = col('Course id');
    sh.insertColumnAfter(cid); sh.getRange(rowOf(enB.email), cid + 1).setValue('sits at the front');
    refreshDashboard();
    if (heads()[cid] !== 'Accommodation' || String(sh.getRange(rowOf(enB.email), cid + 2).getValue()) !== 'sits at the front') throw new Error('notes under no heading were written over: ' + heads().slice(-3).join(' | '));
    /* the Setup tab's ↻ tick says a refusal as a warning (amber ⚠️), never a green tick */
    reset();
    sh.moveColumns(sh.getRange(1, col('Labs started')), 3);
    const setupTab = ss.getSheetByName(T_SETUP), tick = setupTab.getRange(BTN_ROW.refresh, 3);
    tick.setValue(true);
    onButtonTicked({ range: tick, source: ss, value: 'TRUE' });
    const beside = String(setupTab.getRange(BTN_ROW.refresh, 4).getValue());
    if (!/^⚠️/.test(beside) || !/NOT restyled/.test(beside)) throw new Error('the ↻ line reads: ' + beside.slice(0, 160));
  } finally { reset(); }   /* whatever happened, the tab as it was: no later case inherits a broken one */
  /* the tab as it was, restyled by a Tidy up that has nothing to refuse */
  sh.getRange(rowOf(enA.email), col('Accommodation')).setValue('');
  const said = setup();
  if (/NOT restyled/.test(said) || _STUDENTS_NOT_STYLED_) throw new Error('a tab in its own order was refused: ' + _STUDENTS_NOT_STYLED_);
});
ok &= run('Write-Up parts can be set as homework beside lab stations: named in words, scored as red-pen mistakes + questions', () => {
  const r = homeworkCreate({ title:'Planning a report', classes:[{ cls: enA.cls, due: enDay(40) }],
    tasks:[ { labId:'digestion-lab', stationIds:['mouth'] }, { labId:'write-up-lab', stationIds:['variables', 'background'] } ] });
  if (!r.ok) throw new Error('refused: ' + r.why);
  wuHw = _homeworkRows_().filter(h => h.id === r.made[0])[0];
  if (!/Write-Up Lab: Variables, Background/.test(wuHw.what)) throw new Error('What reads "' + wuHw.what + '"');
  const d = _homeworkData_();
  if (!d.writeup || d.writeup.parts.length !== 2 || d.writeup.parts[0].units !== 17 || d.writeup.parts[0].marks !== 9) throw new Error('the page was not given the parts: ' + JSON.stringify(d.writeup));
  if (d.labs.some(l => l.id === 'write-up-lab')) throw new Error('the Write-Up Lab was offered as a lab');
  const man = _hwManifest_(), idx = _hwLabIndex_(['digestion-lab', 'write-up-lab']);
  const only = { tasks: [{ labId:'write-up-lab', stationIds:['variables', 'background'] }] };
  const a = _hwScoreOne_(only, enA.email, idx, man), b = _hwScoreOne_(only, enB.email, idx, man);
  if (a.total !== 34 || a.done !== 17 || a.state !== 'partly') throw new Error('pupil A: ' + JSON.stringify(a));
  if (b.done !== 4) throw new Error('pupil B: ' + b.done + ' done, want 4 (2 mistakes + 2 questions)');
  const one = _hwScoreOne_({ tasks: [{ labId:'write-up-lab', stationIds:['variables'] }] }, enA.email, idx, man);
  if (one.state !== 'done') throw new Error('every red pen and every question, and the part is not done: ' + JSON.stringify(one));
  /* a part's Learn steps, Mistakes to avoid and Go further are never needed */
  wuPost({ action:'writeup.save', parts:{ background: { v:'bb1', r:{ i:'11111', e:'1111' }, q:'11111111' } } }, enA.email);
  const both = _hwScoreOne_(only, enA.email, _hwLabIndex_(['write-up-lab']), man);
  if (both.state !== 'done') throw new Error('Learn, Mistakes to avoid and Go further were required: ' + JSON.stringify(both));
});
ok &= run('Write-Up: the homework reaches its pupils on the Write-Up site, and nobody else; a lab-only homework is not listed there', () => {
  const me = wuPost({ action:'writeup.mine' }, enA.email);
  const hw = me.homework.filter(h => h.id === wuHw.id)[0];
  if (!hw) throw new Error('the pupil was not given their homework');
  if (hw.parts.join(',') !== 'variables,background') throw new Error('parts: ' + hw.parts);
  if (enB.cls !== enA.cls && wuPost({ action:'writeup.mine' }, enB.email).homework.some(h => h.id === wuHw.id)) throw new Error('another class was given it');
  const r = homeworkCreate({ title:'Just the lab', classes:[{ cls: enA.cls, due: enDay(41) }], tasks:[{ labId:'digestion-lab', stationIds:['stomach'] }] });
  if (wuPost({ action:'writeup.mine' }, enA.email).homework.some(h => h.id === r.made[0])) throw new Error('a lab-only homework was listed on the Write-Up site');
  homeworkDelete(r.made[0]);
  /* the labs' coloured stations come from the progress answer: the Write-Up parts are not lab stations */
  if (_ownHomework_(enA.email, enA.cls).some(h => (h.stations || []).some(s => s.lab === 'write-up-lab'))) throw new Error('a lab was told about Write-Up parts');
});
ok &= run('Write-Up: the Classroom post names the parts, has ONE link to the Write-Up Lab’s homework page, and says what finished means', () => {
  const man = _hwManifest_(), tasks = [{ labId:'write-up-lab', stationIds:['variables', 'background'] }];
  const links = _hwLinks_('HW-WU001', tasks, man);
  if (links.length !== 1 || links[0].url !== 'https://nlcsbiology.com/write-up-lab/#/hw/HW-WU001') throw new Error(JSON.stringify(links));
  const t = _hwPostText_('HW-WU001', tasks, man);
  if (!/^YOUR HOMEWORK: Write-Up Lab\n\nComplete these parts:\n1\. Variables\n2\. Background\n\nWHAT TO DO\n1\. Open the link below/.test(t)) throw new Error('the post reads:\n' + t);
  if (!/opens your homework parts in the Write-Up Lab/.test(t) || t.indexOf(HW_WU_LINE) < 0 || !/every homework part is green/.test(t)) throw new Error('what to do is not said:\n' + t);
  if (/https?:/.test(t)) throw new Error('a web address in the words');
  const mixed = _hwPostText_('HW-WU002', [{ labId:'digestion-lab', stationIds:['mouth'] }].concat(tasks), man);
  if (mixed.indexOf(HW_WU_LINE) < 0 || !/Practise tab/.test(mixed)) throw new Error('a mixed post lost a half:\n' + mixed);
  const rem = _hwRemindBody_({ id:'HW-WU001', title:'Planning', due: new Date(Date.now() + 864e5).toISOString(), tasks: tasks }, ['u1'], man);
  if (rem.text.indexOf(HW_WU_LINE) < 0 || rem.text.indexOf('https://nlcsbiology.com/write-up-lab/#/hw/HW-WU001') < 0) throw new Error('the reminder reads:\n' + rem.text);
});
ok &= run('Write-Up: each save notes when a part was first tried and first finished (⏱️ Homework habits); right first time counts questions only', () => {
  const k = wuKept(enA.email), t = _stParse_(k.row[WU_TIMES - 1]);
  if (!t.variables || !(t.variables[0] > 0) || !(t.variables[1] > 0)) throw new Error('Part times: ' + k.row[WU_TIMES - 1]);
  if (!t.background || !(t.background[1] !== 0)) throw new Error('background not finished in the times: ' + JSON.stringify(t.background));
  const man = _hwManifest_(), idx = _hwLabIndex_(['write-up-lab']);
  const ex = _hwTimesIndex_(['write-up-lab'], (() => { const n = {}; n[enA.email] = 1; return n; })());
  const cell = _hwHabitCell_({ id:'x', tasks:[{ labId:'write-up-lab', stationIds:['variables', 'background'] }], from: new Date(Date.now() - 864e5).toISOString(),
    due: new Date(Date.now() + 864e5).toISOString(), rem:[{}, {}] }, enA.email, idx, ex, man, {}, Date.now());
  if (!cell || cell.q !== 16 || cell.f !== 2 || cell.w !== 2) throw new Error('the cell: ' + JSON.stringify(cell));
  if (_hwPartsWords_(0, 0, 2) !== '2 Write-Up parts' || _hwPartsWords_(3, 1, 1) !== '3 stations, 1 Bio English set and 1 Write-Up part') throw new Error('the words');
});
ok &= run('Write-Up: the tab sits after Bio English, Tidy up dresses it, and 🩺 says whether its parts can be read', () => {
  _orderTabs_();
  const names = ss.getSheets().map(x => x.name);
  if (names.indexOf(T_WRITEUP) !== names.indexOf(T_ENGLISH) + 1) throw new Error('order: ' + names.slice(0, 8).join(', '));
  if (!/_dress2_\(wu, WRITEUP_COLS/.test(fs.readFileSync(process.argv[2] || 'apps-script/Code.gs', 'utf8'))) throw new Error('Tidy up does not dress it');
  const keep = SpreadsheetApp.getUi; let said = '';
  SpreadsheetApp.getUi = () => Object.assign(keep(), { alert: (a, b) => { said = String(b === undefined ? a : b); } });
  try { checkSetup(); } finally { SpreadsheetApp.getUi = keep; }
  if (!/✅  Write-Up Lab: its 2 parts can be read/.test(said)) throw new Error('🩺 does not say it: ' + said.slice(-500));
});
ok &= run('Write-Up: the Set homework form offers the parts and sends them as a task of their own', () => {
  const page = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  ['function wuBlock()', "var WUID = 'write-up-lab'", "tasks.push({labId:WUID,stationIds:wp})", "'[data-wupick]'", "'[data-wuall]'", "enBlock()+wuBlock()+"]
    .forEach(x => { if (page.indexOf(x) < 0) throw new Error('Teacher.html lacks ' + x); });
});

/* ── The best kept across a new version (8 Oct 2026, Daniel: "if students have answered questions before … and they had a
   score, then it'd be nice to have that score"): a rewritten Write-Up part or a rebuilt Bio English set starts its letters
   again, but what homework, the tabs and the teacher page count never drops. ── */
const keepRow = (tab, email, width) => { const sh = ss.getSheetByName(tab), n = sh.getLastRow() - 1;
  const em = sh.getRange(2, tab === T_WRITEUP ? WU_EMAIL : EN_EMAIL, n, 1).getValues().map(x => String(x[0]).toLowerCase());
  const r = em.indexOf(email) + 2; const vals = sh.getRange(r, 1, 1, width).getValues();
  return () => sh.getRange(r, 1, 1, width).setValues(vals); };
const wuRewrite = (vNew, run2) => { const keep = WRITEUP_JSON, j = JSON.parse(WRITEUP_JSON);
  j.parts[0].v = vNew; WRITEUP_JSON = JSON.stringify(j);
  try { CacheService.getScriptCache().put('WU_STAMP', 'rewritten-' + vNew, 600); } catch (e) {}
  try { return run2(); } finally { WRITEUP_JSON = keep; try { CacheService.getScriptCache().put('WU_STAMP', 'back', 600); } catch (e) {} } };
ok &= run('Write-Up: a rewritten part still counts what was done on the old version, before and after the next save', () => {
  const restoreA = keepRow(T_WRITEUP, enA.email, WU_TIMES), restoreB = keepRow(T_WRITEUP, enB.email, WU_TIMES);
  try {
    wuRewrite('vv2', () => {
      const man = _hwManifest_(), only = { tasks: [{ labId:'write-up-lab', stationIds:['variables'] }] };
      let s1 = _hwScoreOne_(only, enA.email, _hwLabIndex_(['write-up-lab']), man);
      if (s1.state !== 'done') throw new Error('the moment the part was rewritten, finished homework counted ' + s1.done + '/' + s1.total);
      wuPost({ action:'writeup.save', parts:{ variables: { v:'vv2', r:{ g:'10000' }, q:'f0000000' } } }, enA.email);
      const x = wuKept(enA.email).kept.variables;
      if (x.v !== 'vv2' || x.q !== 'f0000000') throw new Error('the new version was not kept: ' + JSON.stringify(x));
      if (x.x !== 17) throw new Error('the best of the old version was not carried: x = ' + x.x);
      s1 = _hwScoreOne_(only, enA.email, _hwLabIndex_(['write-up-lab']), man);
      if (s1.state !== 'done') throw new Error('after a save on the new version, homework fell to ' + s1.done + '/' + s1.total);
      const row = wuKept(enA.email).row;
      if (row[2] !== 2) throw new Error('Parts finished reads ' + row[2] + ', want 2');
      if (!/Variables ✓ \[best 17\/17 from an earlier version\]/.test(row[8])) throw new Error('Per part reads "' + row[8] + '"');
      const v = uiData('writeup');
      if (!v.ok || !v.data.writeup || v.data.writeup.parts.length !== 2 || v.data.writeup.parts[0].marks !== 9) throw new Error('the view: ' + JSON.stringify(v).slice(0, 300));
      const c = v.data.progress[enA.email].parts.variables;
      if (c[0] !== 17 || c[1] !== 1 || c[2] !== 1 || c[3] !== 2 || c[4] !== 1) throw new Error('the view cell (right first time goes with the best: 2 of the old version): ' + JSON.stringify(c));
      /* the page cannot raise the count: x is the script's own, never taken from a save */
      wuPost({ action:'writeup.save', parts:{ background: { v:'bb1', x:999, q:'1' } } }, enB.email);
      if ('x' in wuKept(enB.email).kept.background) throw new Error('a page-sent best was stored');
    });
  } finally { restoreA(); restoreB(); }
});
ok &= run('Bio English: a rebuilt set keeps its best answered count in homework, the tab and the teacher page', () => {
  const restore = keepRow(T_ENGLISH, enB.email, EN_TIMES);
  const keep = ENGLISH_JSON, j = JSON.parse(ENGLISH_JSON), set = j.sets.filter(s => s.id === 't3.describe.1')[0];
  try {
    enPost({ action:'english.save', sets:{ 't3.describe.1': { done:2, first:2, total:2, snap:'ff', v:'d1', go:1, snap1:'ff', best:'ff' } } }, enB.email);
    set.v = 'd2'; ENGLISH_JSON = JSON.stringify(j);
    try { CacheService.getScriptCache().put('EN_STAMP', 'rebuilt', 600); } catch (e) {}
    enPost({ action:'english.save', sets:{ 't3.describe.1': { done:1, first:1, total:2, snap:'f0', v:'d2', go:1, snap1:'f0', best:'f0' } } }, enB.email);
    const x = enKept(enB.email).kept['t3.describe.1'];
    if (x.v !== 'd2' || x.d !== 1) throw new Error('the new version was not kept: ' + JSON.stringify(x));
    if (x.x !== 2) throw new Error('the best of the old version was not carried: x = ' + x.x);
    const sc = _hwScoreOne_({ tasks: [{ labId:'bio-english-lab', stationIds:['t3.describe.1'] }] }, enB.email, _hwLabIndex_(['bio-english-lab']), _hwManifest_());
    if (sc.state !== 'done') throw new Error('homework fell to ' + sc.done + '/' + sc.total);
    const p = uiData('english').data.progress[enB.email].sets['t3.describe.1'];
    if (p[0] !== 2 || p[2] !== 1) throw new Error('the English view: ' + JSON.stringify(p));
    if (!/2\/2 \(2\) \[best from an earlier version\]/.test(enKept(enB.email).row[8])) throw new Error('Per set reads "' + enKept(enB.email).row[8] + '"');
  } finally { ENGLISH_JSON = keep; try { CacheService.getScriptCache().put('EN_STAMP', 'back2', 600); } catch (e) {} restore(); }
});
ok &= run('a carried best never turns unfinished work into finished when a set or part shrinks, and its right-first-time goes with it', () => {
  const restore = keepRow(T_ENGLISH, enB.email, EN_TIMES);
  const keep = ENGLISH_JSON, j = JSON.parse(ENGLISH_JSON), set = j.sets.filter(s => s.id === 't3.kw.meanings')[0];
  try {
    /* start from nothing on this set (an earlier test finished it) */
    { const sh = ss.getSheetByName(T_ENGLISH), n = sh.getLastRow() - 1, em = sh.getRange(2, EN_EMAIL, n, 1).getValues().map(v => String(v[0]).toLowerCase());
      const r = em.indexOf(enB.email) + 2, k = _enParse_(sh.getRange(r, EN_SNAP).getValue()); delete k['t3.kw.meanings']; sh.getRange(r, EN_SNAP).setValue(_enPack_(k)); }
    /* 3 of 4 answered, 3 right first time, never finished; the set is rebuilt with 2 questions; one wrong try on it */
    enPost({ action:'english.save', sets:{ 't3.kw.meanings': { done:3, first:3, total:4, snap:'fff0', v:'k1', go:1, snap1:'fff0', best:'fff0' } } }, enB.email);
    set.v = 'k2'; set.total = 2; ENGLISH_JSON = JSON.stringify(j);
    try { CacheService.getScriptCache().put('EN_STAMP', 'shrunk', 600); } catch (e) {}
    enPost({ action:'english.save', sets:{ 't3.kw.meanings': { done:0, first:0, total:2, snap:'t0', v:'k2', go:1, snap1:'t0', best:'t0' } } }, enB.email);
    const x = enKept(enB.email).kept['t3.kw.meanings'];
    const b = _enBestOf_(x);
    if (b.d !== 1 || b.f !== 1 || !b.old) throw new Error('3 of 4 on a set now of 2 should count 1 (and 1 right first time), not finished: ' + JSON.stringify(b) + ' ' + JSON.stringify(x));
    const sc = _hwScoreOne_({ tasks: [{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] }, enB.email, _hwLabIndex_(['bio-english-lab']), _hwManifest_());
    if (sc.state === 'done') throw new Error('unfinished work became a finished homework when the set shrank');
    const mine = enPost({ action:'english.mine' }, enB.email).sets['t3.kw.meanings'];
    if (mine.most !== 1) throw new Error('english.mine does not give the page the best: ' + JSON.stringify(mine));
    /* once the new version catches up, the carried best is dropped */
    enPost({ action:'english.save', sets:{ 't3.kw.meanings': { done:2, first:1, total:2, snap:'f1', v:'k2', go:1, snap1:'f1', best:'f1' } } }, enB.email);
    const y = enKept(enB.email).kept['t3.kw.meanings'];
    if ('x' in y || 'xt' in y || 'xf' in y) throw new Error('a carried best stayed after the new version caught up: ' + JSON.stringify(y));
  } finally { ENGLISH_JSON = keep; try { CacheService.getScriptCache().put('EN_STAMP', 'back3', 600); } catch (e) {} restore(); }
  /* the same for a Write-Up part: 8 of 17 units on the old version, the part now 6 units */
  const restoreW = keepRow(T_WRITEUP, enB.email, WU_TIMES), keepW = WRITEUP_JSON, w = JSON.parse(WRITEUP_JSON);
  try {
    w.parts[0].v = 'vv3'; w.parts[0].units = 6; w.parts[0].questions = 1; w.parts[0].redpens = [{ l:'g', n:5 }]; WRITEUP_JSON = JSON.stringify(w);
    try { CacheService.getScriptCache().put('WU_STAMP', 'shrunk', 600); } catch (e) {}
    const rec = { v:'vv1', l:'', r:{ g:'11111', i:'0000' }, m:0, q:'ff10000', f:'' };   /* 5 + 3 = 8 of its own 16 units (9 marks + 7 questions) */
    const b = _wuBestOf_(rec, _wuPartsById_(_writeupManifest_()).variables);
    if (b.done !== 3 || !b.old) throw new Error('8 of 16 on a part now of 6 should count 3, not finished: ' + JSON.stringify(b));
    if (_wuBest_({ v:'vv1', l:'', r:{ g:'11111', i:'1111' }, m:0, q:'ff1s1111', f:'' }, _wuPartsById_(_writeupManifest_()).variables) !== 6) throw new Error('a finished old version did not stay finished');
    const mine = wuPost({ action:'writeup.mine' }, enA.email);
    if (!mine.most || typeof mine.most.variables !== 'number') throw new Error('writeup.mine does not give the page the best: ' + JSON.stringify(mine.most));
  } finally { WRITEUP_JSON = keepW; try { CacheService.getScriptCache().put('WU_STAMP', 'back4', 600); } catch (e) {} restoreW(); }
});
ok &= run('the teacher page has a Write-Up view: served by ?page=writeup, drawn by vWriteup, refused to pupils', () => {
  VISITOR = 'pupil@pupils.x.kr';
  if (uiData('writeup').ok !== false) throw new Error('a pupil read the Write-Up view');
  VISITOR = OWNER;
  const page = doGet({ parameter:{ page:'writeup' } }).html;
  if (!/"tab":"writeup"/.test(page)) throw new Error('?page=writeup did not open on the Write-Up view');
  const t = fs.readFileSync('apps-script/Teacher.html', 'utf8');
  ["'writeup','students'", 'window.vWriteup = function', "if (cur==='writeup') return window.vWriteup(r.data);"].forEach(x => { if (t.indexOf(x) < 0) throw new Error('Teacher.html lacks ' + x); });
  if (!/\?page=writeup$/.test(_writeupTeacherUrl_() || '?page=writeup')) throw new Error('the Write-Up site still sends teachers elsewhere: ' + _writeupTeacherUrl_());
});

/* ── Homework the pupils can see (Daniel, 29 Sep 2026) ─────────────────────────────────────────────────────────
   The Classroom post names every station with its own link; a due TIME; a Classroom TOPIC; and the pupil's own
   homework in the progress answer, each station scored by the teacher's _hwScoreOne_. */
console.log('— homework the pupils can see —');
ok &= run('a due time is kept: 08:00 on that day in the school’s zone; no time still means the end of the day', () => {
  const cls = enA.cls, task = [{ labId:'digestion-lab', stationIds:['mouth'] }];
  const a = homeworkCreate({ title:'Timed', classes:[{ cls, due:'2027-03-02', time:'08:00' }], tasks:task });
  const b = homeworkCreate({ title:'Untimed', classes:[{ cls, due:'2027-03-02' }], tasks:task });
  const c = homeworkCreate({ title:'Old page', classes:[{ cls, due:'2027-03-02T23:59:00' }], tasks:task });
  try {
    if (!a.ok || !b.ok || !c.ok) throw new Error('refused: ' + [a.why, b.why, c.why].join(' / '));
    const rowOf = id => _homeworkRows_().filter(h => h.id === id)[0];
    const A = rowOf(a.made[0]), B = rowOf(b.made[0]), C = rowOf(c.made[0]);
    if (A.due !== '2027-03-01T23:00:00.000Z') throw new Error('08:00 in the school’s zone (UTC+9 here) is 23:00 UTC the day before, got ' + A.due);
    if (A.dueText !== '2 Mar, 08:00') throw new Error('the time is not in the words: ' + A.dueText);
    if (B.due !== '2027-03-02T14:59:59.000Z' || B.dueText !== '2 Mar') throw new Error('no time is no longer the end of the day: ' + B.due + ' ' + B.dueText);
    if (C.due !== B.due) throw new Error('a page from before (a date with a time glued on) changed meaning: ' + C.due);
    const bad = homeworkCreate({ title:'Bad time', classes:[{ cls, due:'2027-03-02', time:'25:00' }], tasks:task });
    if (bad.ok !== false || !/time/.test(bad.why)) throw new Error('a time that is not a time was accepted: ' + JSON.stringify(bad));
    if (_hwTime_('8:05') !== '08:05:00' || _hwTime_('') !== '' || _hwTime_('noon') !== '') throw new Error('_hwTime_ misreads a time');
  } finally { [a, b, c].forEach(r => r && r.ok && homeworkDelete(r.made[0])); }
});
ok &= run('the Classroom post has ONE link per lab, at its first homework station; its words are a heading, numbered stations and numbered steps (sign in, answer EVERY question in the Practise tab), with no web address (Daniel, 1 and 2 Oct 2026)', () => {
  /* 29 Sep 2026 the post linked every station (the lab's front page did not show the homework); since the labs colour the
     homework stations, Daniel asked for one link per lab: "just one link … that's more than enough" */
  const POSTS = [];
  global.Classroom = { Courses: { CourseWork: { create: (body, courseId) => { POSTS.push({ body, courseId }); return { id: 'cw' + POSTS.length }; } } } };
  try {
    const r = homeworkCreate({ title:'Gut and words', post:true, classes:[{ cls: enA.cls, due:'2027-03-03', time:'08:30' }],
      tasks:[ { labId:'digestion-lab', stationIds:['mouth', 'stomach'] }, { labId:'bio-english-lab', stationIds:['t3.kw.meanings'] } ] });
    if (!r.ok || !r.posted.length) throw new Error(JSON.stringify([r.why, r.notPosted]));
    const b = POSTS[0].body, d = b.description, urls = b.materials.map(m => m.link.url);
    if (urls.length !== 2 || urls[0] !== 'https://nlcsbiology.com/digestion-lab/#mouth' || !/\/bio-english-lab\/#\/hw\/HW-/.test(urls[1]))
      throw new Error('the links: ' + urls.join(' '));
    if (!/^YOUR HOMEWORK\n\nDigestion\nComplete these stations:\n1\. Mouth and teeth\n2\. Stomach\n\n/.test(d)) throw new Error('the stations are not named: ' + d);
    if (!/\n\nBio English Lab\nComplete these sets:\n1\. T3 Keywords: meanings\n\nWHAT TO DO\n/.test(d)) throw new Error('the English set is not named: ' + d);
    if (/https?:|nlcsbiology\.com|#\/hw\//.test(d)) throw new Error('a web address in the words: ' + d);
    if (!/\n1\. Open the links below\. There is one link for each lab\. Each link opens your homework in that lab\.\n/.test(d)) throw new Error('the links are not explained: ' + d);
    /* Daniel, 2 Oct 2026: the post did not say the practice questions must be answered, and the sign-in line did not stand out */
    if (!/\n2\. SIGN IN with your school GOOGLE ACCOUNT\. If you do not sign in, your work is not recorded\.\n/.test(d)) throw new Error('the sign-in step: ' + d);
    if (!/\n3\. In each homework station, open the Practise tab and answer EVERY question\. A station is done only when every question is answered\.\n/.test(d)) throw new Error('it does not say to answer every question: ' + d);
    if (!/\n4\. In Bio English Lab, answer EVERY question in each set\.\n/.test(d)) throw new Error('the English sets: ' + d);
    if (!/\n5\. Your homework stations are coloured: red = not started, orange = part done, green = done\. You have finished when every homework station is green\.$/.test(d)) throw new Error('the closing line: ' + d);
    if (/!/.test(d)) throw new Error('an exclamation mark in the post');
    /* plain text only: Classroom shows a script's post as typed, so no marks that would show as marks, and no letters made
       to look bold (a translator and a screen reader cannot read those) */
    if (/[*_<>]|[\u{1D400}-\u{1D7FF}]/u.test(d)) throw new Error('formatting marks or look-alike bold letters in the post: ' + d);
    /* 08:30 on 3 March here is 23:30 UTC on 2 March */
    if (b.dueDate.day !== 2 || b.dueDate.month !== 3 || b.dueTime.hours !== 23 || b.dueTime.minutes !== 30) throw new Error('due ' + JSON.stringify([b.dueDate, b.dueTime]));
    if (b.topicId) throw new Error('a topic appeared that nobody asked for');
    homeworkDelete(r.made[0]);
    /* one lab: exactly one link, the first homework station, and the words say where it opens */
    const one = homeworkCreate({ title:'Gut only', post:true, classes:[{ cls: enA.cls, due:'2027-03-03' }], tasks:[{ labId:'digestion-lab', stationIds:['stomach', 'mouth'] }] });
    const ob = POSTS[POSTS.length - 1].body;
    if (ob.materials.length !== 1 || ob.materials[0].link.url !== 'https://nlcsbiology.com/digestion-lab/#stomach') throw new Error('one lab: ' + JSON.stringify(ob.materials));
    if (ob.description !== 'YOUR HOMEWORK: Digestion\n\nComplete these stations:\n1. Stomach\n2. Mouth and teeth\n\n' +
        'WHAT TO DO\n1. Open the link below. It opens the lab at your first homework station.\n' +
        '2. SIGN IN with your school GOOGLE ACCOUNT. If you do not sign in, your work is not recorded.\n' +
        '3. In each homework station, open the Practise tab and answer EVERY question. A station is done only when every question is answered.\n' +
        '4. Your homework stations are coloured: red = not started, orange = part done, green = done. You have finished when every homework station is green.') throw new Error('one lab, the words: ' + ob.description);
    /* Bio English alone: its own link line and its own rule, and nothing about coloured stations */
    const en = _hwPostText_('HW-ENG01', [{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }], _hwManifest_());
    if (en !== 'YOUR HOMEWORK: Bio English Lab\n\nComplete these sets:\n1. T3 Keywords: meanings\n\n' +
        'WHAT TO DO\n1. Open the link below. It opens your homework sets in Bio English Lab.\n2. SIGN IN with your school GOOGLE ACCOUNT. If you do not sign in, your work is not recorded.\n' +
        '3. Answer EVERY question in each set. A set is done only when every question is answered.') throw new Error('Bio English alone, the words: ' + en);
    homeworkDelete(one.made[0]);
    /* 25 stations of one lab: still one link, and every station named */
    const many = []; for (let i = 0; i < 25; i++) many.push('s' + i);
    const p = _hwPost_('HW-MANY1', 'Many', 'x', [{ labId:'digestion-lab', stationIds: many }],
      { cls: enA.cls, setFor:[enA.email], due: new Date() }, _classroomIds_(), { man: _hwManifest_() });
    const last = POSTS[POSTS.length - 1].body;
    if (!p.ok || last.materials.length !== 1 || last.materials[0].link.url !== 'https://nlcsbiology.com/digestion-lab/#s0' || !/\n25\. s24\n/.test(last.description))
      throw new Error('with 25 stations: ' + last.materials.length + ' links; ' + last.description.slice(-160));
    /* no manifest handed over (an older caller): the old words, one link, never a throw */
    const q = _hwPost_('HW-OLD01', 'Old', 'Digestion: Mouth', [{ labId:'digestion-lab', stationIds:['mouth'] }], { cls: enA.cls, setFor:[enA.email], due: new Date() }, _classroomIds_());
    const qb = POSTS[POSTS.length - 1].body;
    if (!q.ok || !/^Digestion: Mouth\n\nSIGN IN with your school GOOGLE ACCOUNT\./.test(qb.description) || qb.materials.length !== 1) throw new Error('without a manifest: ' + qb.description);
  } finally { global.Classroom = undefined; }
});
ok &= run('a Classroom topic: an existing one is used, a new one is made, and if topics fail the post still goes, without it', () => {
  const POSTS = [], MADE = [], cid = _classroomIds_()[enA.email].courseId;
  let TOPICS = { [cid]: [ { topicId:'t-old', name:'Unit 7 — Nutrition' }, { topicId:'t-x', name:'Other' } ] }, broken = false;
  global.Classroom = { Courses: {
    CourseWork: { create: (body, courseId) => { POSTS.push({ body, courseId }); return { id: 'cw' + POSTS.length }; } },
    Topics: { list: (courseId) => { if (broken) throw new Error('Request had insufficient authentication scopes.'); return { topic: (TOPICS[courseId] || []).slice() }; },
              create: (t, courseId) => { if (broken) throw new Error('Request had insufficient authentication scopes.');
                                          const x = { topicId:'t-new' + (MADE.length + 1), name: t.name }; MADE.push(x); (TOPICS[courseId] = TOPICS[courseId] || []).push(x); return x; } } } };
  const task = [{ labId:'digestion-lab', stationIds:['mouth'] }], made = [];
  try {
    /* the teacher page's box: the course's topics, for a teacher only */
    VISITOR = 'pupil@pupils.x.kr';
    if (homeworkTopics({ classes:[{ cls: enA.cls }] }).ok !== false) throw new Error('a pupil listed the Classroom topics');
    VISITOR = OWNER;
    const list = homeworkTopics({ classes:[{ cls: enA.cls }] });
    if (!list.ok || list.topics.join('|') !== 'Unit 7 — Nutrition|Other') throw new Error('the topics: ' + JSON.stringify(list));
    /* an existing topic, typed with other capitals and spaces */
    let r = homeworkCreate({ title:'Topic 1', post:true, topic:'  unit 7 — nutrition ', classes:[{ cls: enA.cls, due:'2027-03-04' }], tasks:task }); made.push(r);
    if (!r.ok || POSTS[0].body.topicId !== 't-old' || MADE.length || r.topic !== 'Unit 7 — Nutrition' || r.topicMissed.length) throw new Error('existing: ' + JSON.stringify([r.topicMissed, POSTS[0].body.topicId, MADE]));
    /* a new one is made in the course, once */
    r = homeworkCreate({ title:'Topic 2', post:true, topic:'Unit 9 — Transport', classes:[{ cls: enA.cls, due:'2027-03-04' }], tasks:task }); made.push(r);
    if (!r.ok || MADE.length !== 1 || POSTS[1].body.topicId !== 't-new1') throw new Error('new: ' + JSON.stringify([MADE, POSTS[1].body.topicId]));
    r = homeworkCreate({ title:'Topic 3', post:true, topic:'Unit 9 — Transport', classes:[{ cls: enA.cls, due:'2027-03-04' }], tasks:task }); made.push(r);
    if (MADE.length !== 1 || POSTS[2].body.topicId !== 't-new1') throw new Error('the new topic was made twice');
    /* the permission not yet allowed: posted without the topic, and it says so; the homework is set either way */
    broken = true;
    r = homeworkCreate({ title:'Topic 4', post:true, topic:'Unit 10', classes:[{ cls: enA.cls, due:'2027-03-04' }], tasks:task }); made.push(r);
    if (!r.ok || !r.posted.length || POSTS.length !== 4 || POSTS[3].body.topicId) throw new Error('with topics broken it was not posted plainly: ' + JSON.stringify(r.notPosted));
    if (r.topicMissed.length !== 1 || !/could not be used/.test(r.topicMissed[0])) throw new Error('it did not say the topic was left out: ' + JSON.stringify(r.topicMissed));
    if (!_homeworkRows_().some(h => h.id === r.made[0])) throw new Error('the homework itself was lost');
    const l2 = homeworkTopics({ classes:[{ cls: enA.cls }] });
    if (l2.ok !== false || !/You can still type a topic/.test(l2.why)) throw new Error('the box was not told why: ' + JSON.stringify(l2));
    /* no topic asked for: nothing is listed or made */
    broken = false; const n0 = MADE.length;
    r = homeworkCreate({ title:'Topic 5', post:true, classes:[{ cls: enA.cls, due:'2027-03-04' }], tasks:task }); made.push(r);
    if (POSTS[4].body.topicId || MADE.length !== n0 || r.topicMissed.length) throw new Error('a topic was used with none asked for');
  } finally { global.Classroom = undefined; VISITOR = OWNER; made.forEach(r => r && r.ok && homeworkDelete(r.made[0])); }
  if (homeworkTopics({ classes:[{ cls: enA.cls }] }).ok !== false) throw new Error('with Classroom off the box claimed topics');
});
ok &= run('several classes, each with its own Classroom topic: a post goes under its own class’s topic, and a name is made new only where it is new (Daniel, 2 Oct 2026)', () => {
  /* Daniel: "what happens if different classes have different section names?" One name for all made a NEW topic of
     that name in every class that did not have it. Each class now brings its own. */
  const POSTS = [], MADE = [], ca = _classroomIds_()[enA.email].courseId, cb = _classroomIds_()[enB.email].courseId;
  if (!ca || !cb || ca === cb) throw new Error('this case needs two test classes from two Classroom courses, got ' + ca + ' and ' + cb);
  const TOPICS = { [ca]: [{ topicId:'a1', name:'Topic 7 Nutrition' }], [cb]: [{ topicId:'b1', name:'Human nutrition' }] };
  global.Classroom = { Courses: {
    CourseWork: { create: (body, courseId) => { POSTS.push({ body, courseId }); return { id: 'cw' + POSTS.length }; } },
    Topics: { list: (courseId) => ({ topic: (TOPICS[courseId] || []).slice() }),
              create: (t, courseId) => { const x = { topicId:'new' + (MADE.length + 1), name: t.name, courseId }; MADE.push(x); TOPICS[courseId].push(x); return x; } } } };
  const task = [{ labId:'digestion-lab', stationIds:['mouth'] }], made = [], A = enA.cls, B = enB.cls;
  const two = (ta, tb, extra) => { const r = homeworkCreate(Object.assign({ title:'Two classes', post:true, tasks:task,
    classes:[Object.assign({ cls: A, due:'2027-03-04' }, ta === undefined ? {} : { topic: ta }), Object.assign({ cls: B, due:'2027-03-05' }, tb === undefined ? {} : { topic: tb })] }, extra || {})); made.push(r); return r; };
  try {
    /* each class's box lists that class's own topics; an empty row in between keeps its place */
    const list = homeworkTopics({ classes:[{ cls: A }, { cls: '' }, { cls: B }] });
    if (!list.ok || list.byClass.length !== 3 || list.byClass[0].topics.join('|') !== 'Topic 7 Nutrition' || list.byClass[1].known !== false ||
        list.byClass[2].topics.join('|') !== 'Human nutrition' || list.byClass[2].cls !== String(B).toUpperCase() || list.topics.length !== 2)
      throw new Error('the topics by class: ' + JSON.stringify(list));
    /* each class under its own topic, spelt as its course spells it; nothing is made */
    let r = two('Topic 7 Nutrition', ' human  nutrition ');
    if (!r.ok || POSTS.length !== 2 || POSTS[0].courseId !== ca || POSTS[0].body.topicId !== 'a1' || POSTS[1].courseId !== cb || POSTS[1].body.topicId !== 'b1' || MADE.length)
      throw new Error('each class its own topic: ' + JSON.stringify([r.why, POSTS.map(x => [x.courseId, x.body.topicId]), MADE]));
    if (r.topic !== '' || r.topics.map(t => t.cls + '=' + t.name + (t.made ? '+' : '')).join('|') !== String(A).toUpperCase() + '=Topic 7 Nutrition|' + String(B).toUpperCase() + '=Human nutrition' || r.topicMissed.length)
      throw new Error('the answer does not name each class’s topic: ' + JSON.stringify([r.topic, r.topics, r.topicMissed]));
    /* one class with a topic, the other with none: nothing is made for the other, and nothing is reported as missed */
    r = two('Topic 7 Nutrition', '');
    if (POSTS[2].body.topicId !== 'a1' || POSTS[3].body.topicId || MADE.length || r.topicMissed.length) throw new Error('a class with no topic got one: ' + JSON.stringify([POSTS[3].body.topicId, MADE, r.topicMissed]));
    /* the same name for both: made new only in the class that does not have it, and the answer says where */
    r = two('Topic 7 Nutrition', 'Topic 7 Nutrition');
    if (MADE.length !== 1 || MADE[0].courseId !== cb || POSTS[4].body.topicId !== 'a1' || POSTS[5].body.topicId !== 'new1') throw new Error('made where it was not new: ' + JSON.stringify(MADE));
    if (r.topic !== 'Topic 7 Nutrition' || r.topics[0].made !== false || r.topics[1].made !== true) throw new Error('the answer does not say where it was made: ' + JSON.stringify(r.topics));
    /* a page from before sends ONE topic for all: it still works as it did */
    r = two(undefined, undefined, { topic:'Human nutrition' });
    if (MADE.length !== 2 || MADE[1].courseId !== ca || POSTS[6].body.topicId !== 'new2' || POSTS[7].body.topicId !== 'b1') throw new Error('one topic for all (an older page): ' + JSON.stringify([MADE, POSTS[6].body.topicId, POSTS[7].body.topicId]));
  } finally { global.Classroom = undefined; made.forEach(r => r && r.ok && r.made.forEach(id => homeworkDelete(id))); }
});
ok &= run('the Set homework form: "No time typed: due at 23:59"; with several classes, "↑ Same date and time" copies the class above and each class has its own topic box, which says when a name is new there (Daniel, 2 Oct 2026)', () => {
  const D = JSON.parse(JSON.stringify(uiData('homework').data)); D.classroomOk = true;
  const page = teacherPage(), CALLS = [], A = enA.cls, B = enB.cls;
  let okFn = null;
  const run = new Proxy({}, { get: (t, k) => k === 'withSuccessHandler' ? (f => { okFn = f; return run; }) : k === 'withFailureHandler' ? (() => run)
    : (...args) => { CALLS.push([k, args]); if (okFn) okFn(k === 'homeworkTopics'
        ? { ok:true, topics:['Topic 7 Nutrition', 'Human nutrition'], courses:2, byClass:[{ cls: String(A).toUpperCase(), known:true, topics:['Topic 7 Nutrition'] }, { cls: String(B).toUpperCase(), known:true, topics:['Human nutrition'] }] }
        : { ok:true, made:['HW-T1', 'HW-T2'], posted:[A, B], notPosted:[], topic:'Topic 7 Nutrition', topics:[{ cls:A, name:'Topic 7 Nutrition', made:false }, { cls:B, name:'Topic 7 Nutrition', made:true }], topicMissed:[], data:D }); } });
  page.win.google = { script: { run } };
  page.win.vHomework(D);
  let html = page.html();
  /* one class: the time's meaning is said in its row; no copy button; the one topic box below */
  if (!html.includes('<div class="tmsg" id="hth0" style="flex:1 1 100%">No time typed: due at 23:59, the end of that day.</div>')) throw new Error('an empty time does not say what it means');
  if (/data-same=/.test(html) || /data-topic=/.test(html) || !/id="htopic"/.test(html)) throw new Error('one class: a copy button or a per-class topic box, or no topic box at all');
  page.fire('change', 'data-cls', '0', A);
  page.fire('input', 'data-due', '0', '2027-03-08'); page.fire('input', 'data-time', '0', '08:15');
  page.fire('input', 'id', 'htopic', 'Topic 7 Nutrition');
  page.press('id', 'addrow');
  html = page.html();
  if (!html.includes('id="hth0" style="flex:1 1 100%" hidden>') || !html.includes('<div class="tmsg" id="hth1" style="flex:1 1 100%">No time typed')) throw new Error('the note stays beside a typed time, or is missing beside an empty one');
  if (/data-same="0"/.test(html) || !/<button class="act" data-same="1" data-tip="Copy the date and the time from the class above">↑ Same date and time<\/button>/.test(html)) throw new Error('no "↑ Same date and time" on the second class (or one on the first)');
  /* each class has its own topic box, in its row; the first keeps what was typed in the one box; the one box is gone */
  if (!/id="htp0" type="text" data-topic="0" list="htopics0"[^>]*value="Topic 7 Nutrition"/.test(html) || !/id="htp1" type="text" data-topic="1" list="htopics1"[^>]*value=""/.test(html) || /id="htopic"/.test(html))
    throw new Error('several classes: not one topic box per class');
  if (!html.includes('Each class has its own topic box')) throw new Error('the page does not say each class has its own topics');
  page.fire('change', 'data-cls', '1', B);
  page.press('data-same', '1');
  html = page.html();
  if (!/id="hd1" type="date" data-due="1" value="2027-03-08"/.test(html) || !/id="htm1" type="time" data-time="1" value="08:15"/.test(html)) throw new Error('"↑ Same date and time" did not copy the date and the time');
  if (!html.includes('id="hth1" style="flex:1 1 100%" hidden>')) throw new Error('the copied time still reads "No time typed"');
  if (CALLS.length) throw new Error('the page asked the server before a topic box was used: ' + CALLS.map(c => c[0]));
  page.fire('focus', 'data-topic', '1');
  if (CALLS.length !== 1 || CALLS[0][0] !== 'homeworkTopics' || CALLS[0][1][0].classes.map(c => c.cls).join('|') !== A + '|' + B) throw new Error('the topics were not asked for, for both classes: ' + JSON.stringify(CALLS));
  page.fire('input', 'data-topic', '1', 'Topic 7 Nutrition');
  page.fire('input', 'id', 'ht', 'Two classes');
  page.press('data-all', 'digestion-lab');                        /* tick the lab's stations: the form is drawn again */
  html = page.html();
  if (!/<datalist id="htopics0"><option value="Topic 7 Nutrition"><\/option><\/datalist>/.test(html) || !/<datalist id="htopics1"><option value="Human nutrition"><\/option><\/datalist>/.test(html))
    throw new Error('each box does not list its own class’s topics');
  if (!html.includes('<div class="tmsg" id="htn1" style="flex:1 1 100%">“Topic 7 Nutrition” is not a topic in ' + B + '’s Classroom yet: it is made there when you set the homework.</div>'))
    throw new Error('a name that is new in the second class is not said to be new there');
  if (!html.includes('<div class="tmsg" id="htn0" style="flex:1 1 100%" hidden></div>')) throw new Error('the first class is warned about a topic it has');
  page.press('id', 'hset');
  const set = CALLS.filter(c => c[0] === 'homeworkCreate')[0];
  if (!set) throw new Error('Set homework sent nothing');
  const a = set[1][0];
  if (a.topic !== '' || JSON.stringify(a.classes) !== JSON.stringify([{ cls:A, due:'2027-03-08', time:'08:15', emails:[], topic:'Topic 7 Nutrition' }, { cls:B, due:'2027-03-08', time:'08:15', emails:[], topic:'Topic 7 Nutrition' }]))
    throw new Error('sent ' + JSON.stringify(a));
  /* back to one class: the one box again, holding that class's topic */
  const p2 = teacherPage(); p2.win.google = { script: { run } }; p2.win.vHomework(D);
  p2.press('id', 'addrow'); p2.fire('input', 'data-topic', '0', 'Kept'); p2.press('data-rmrow', '1');
  if (!/id="htopic"[^>]*value="Kept"/.test(p2.html()) || /data-topic=/.test(p2.html())) throw new Error('back to one class: the topic box did not keep the class’s topic');
  /* a homework with a time shows it; one without says "due at 23:59" (the list) */
});
ok &= run('each teacher is sent only the homework they set, and nobody else’s is scored for them; the owner is sent everyone’s, each marked mine or not; the morning email still reads them all (Daniel, 2 Oct 2026)', () => {
  /* Daniel signed in as a colleague and saw the homework of every teacher: "that makes no sense" */
  const keepT = TEACHERS, keepD = SCHOOL_DOMAIN, made = [], task = [{ labId:'digestion-lab', stationIds:['mouth'] }];
  const ids = r => r.data.homework.map(h => h.id).sort().join();
  try {
    SCHOOL_DOMAIN = 'x.kr'; TEACHERS = 'colleague@x.kr, second@x.kr';
    VISITOR = OWNER;
    const o = homeworkCreate({ title:'By the owner', classes:[{ cls: enA.cls, due:'2027-07-01' }], tasks:task }); made.push(o.made[0]);
    VISITOR = 'colleague@x.kr';
    const c = homeworkCreate({ title:'By a colleague', classes:[{ cls: enA.cls, due:'2027-07-02' }], tasks:task }); made.push(c.made[0]);
    if (!c.ok || c.data.whose !== 'mine' || ids(c) !== c.made[0] || !c.data.homework[0].mine) throw new Error('the answer to setting it shows more than their own: ' + JSON.stringify([c.data.whose, ids(c)]));
    const page = uiData('homework');
    if (!page.ok || page.data.whose !== 'mine' || ids(page) !== c.made[0]) throw new Error('the colleague’s list: ' + JSON.stringify([page.data.whose, ids(page)]));
    if (!page.data.students.length || !page.data.labs) throw new Error('the colleague lost the roster or the labs: the form needs them');
    if (JSON.stringify(page.data).indexOf('By the owner') >= 0) throw new Error('the owner’s homework is somewhere in what the colleague was sent');
    /* the 🔔 switch and Remove answer with their own list too */
    const sw = homeworkRemind({ id: c.made[0], on: false });
    if (sw.data && ids(sw) !== c.made[0]) throw new Error('the 🔔 switch answered with ' + ids(sw));
    /* another teacher, who has set nothing: an empty list, and still no way to remove a colleague's */
    VISITOR = 'second@x.kr';
    const s = uiData('homework');
    if (s.data.whose !== 'mine' || s.data.homework.length) throw new Error('a teacher who set nothing sees ' + ids(s));
    if (homeworkDelete(c.made[0]).ok !== false) throw new Error('a teacher removed a colleague’s homework');
    /* the owner: everyone's, each marked */
    VISITOR = OWNER;
    const all = uiData('homework').data, mine = all.homework.filter(h => h.id === o.made[0])[0], theirs = all.homework.filter(h => h.id === c.made[0])[0];
    if (all.whose !== 'all' || !mine || !theirs || mine.mine !== true || theirs.mine !== false) throw new Error('the owner’s list: ' + JSON.stringify([all.whose, mine && mine.mine, theirs && theirs.mine]));
    /* the morning email reads with no teacher: all of them, as before */
    const em = _homeworkData_();
    if (em.whose !== '' || !em.homework.some(h => h.id === c.made[0]) || !em.homework.some(h => h.id === o.made[0])) throw new Error('the morning email no longer reads every homework');
  } finally { VISITOR = OWNER; made.forEach(id => homeworkDelete(id)); TEACHERS = keepT; SCHOOL_DOMAIN = keepD; if (!keepT) props.delete('TEACHERS'); if (!keepD) props.delete('SCHOOL_DOMAIN'); }
});
ok &= run('the Set homework list on the page: a teacher sees "Only the homework you set"; the owner sees their own, with "Mine · All teachers" to see every teacher’s', () => {
  const D0 = JSON.parse(JSON.stringify(uiData('homework').data));
  const hw = (id, title, mine, teacher) => ({ id, title, who:'9A', what:'Digestion: Mouth', teacher, mine, pupils:[], tally:{ done:0, partly:0, none:0 }, dueText:'10 Jun', due:'2027-06-10T14:59:59.000Z',
    overdue:false, soon:false, tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }], targets:{ cls:'9A' }, remind:null });
  /* a teacher: only their own came, no switch, and the page says so */
  let D = Object.assign({}, D0, { whose:'mine', homework:[hw('HW-M1', 'My one', true, OWNER)] }), page = teacherPage();
  page.win.vHomework(D);
  let html = page.html();
  if (/data-hwhose=/.test(html) || !html.includes('Only the homework you set is listed here.') || !html.includes('My one')) throw new Error('a teacher’s list: a switch, or no note');
  /* the owner: their own first; the switch shows every teacher's, and says who set it */
  D = Object.assign({}, D0, { whose:'all', homework:[hw('HW-M1', 'My one', true, OWNER), hw('HW-C1', 'A colleague’s', false, 'colleague@x.kr')] }); page = teacherPage();
  page.win.vHomework(D);
  html = page.html();
  if (!html.includes('My one') || html.includes('A colleague’s') || !/data-hwhose="mine" aria-pressed="true">Mine</.test(html) || !/data-hwhose="all" aria-pressed="false">All teachers</.test(html)) throw new Error('the owner does not start on their own');
  page.press('data-hwhose', 'all');
  html = page.html();
  if (!html.includes('A colleague’s') || !html.includes('set by colleague@x.kr') || !html.includes('What every teacher has set') || !/data-hwhose="all" aria-pressed="true"/.test(html)) throw new Error('"All teachers" does not show the colleague’s homework');
  page.press('data-hwhose', 'mine');
  if (page.html().includes('A colleague’s')) throw new Error('"Mine" still shows the colleague’s');
  /* the owner with nothing of their own: told that others have set some */
  D = Object.assign({}, D0, { whose:'all', homework:[hw('HW-C1', 'A colleague’s', false, 'colleague@x.kr')] }); page = teacherPage(); page.win.vHomework(D);
  if (!page.html().includes('You have set nothing yet. Other teachers have set 1: choose “All teachers” to see it.')) throw new Error('the owner with nothing of their own is not told');
});
ok &= run('the Set homework page sends the time and the topic, and asks for the course’s topics only when the box is used', () => {
  const cls = enA.cls;
  const r = homeworkCreate({ title:'Refill me', classes:[{ cls, due:'2027-03-05' }], tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
  if (!r.ok) throw new Error(r.why);
  try {
    const D = JSON.parse(JSON.stringify(uiData('homework').data)); D.classroomOk = true;
    const page = teacherPage(), CALLS = [];
    let okFn = null;
    const run = new Proxy({}, { get: (t, k) => k === 'withSuccessHandler' ? (f => { okFn = f; return run; }) : k === 'withFailureHandler' ? (() => run)
      : (...args) => { CALLS.push([k, args]); if (okFn) okFn(k === 'homeworkTopics' ? { ok:true, topics:['Unit 7'], courses:1 } : { ok:true, made:['HW-TEST1'], posted:[cls], notPosted:[], topic:'Unit 7', topicMissed:[], data:D }); } });
    page.win.google = { script: { run } };
    page.win.vHomework(D);
    page.press('data-hw', r.made[0]); page.press('data-again', r.made[0]);
    let html = page.html();
    if (!/id="htm0" type="time" data-time="0"/.test(html) || !/<label for="htm0">Time \(optional\)<\/label>/.test(html)) throw new Error('no labelled time box beside the date');
    if (!/id="htopic"[^>]*list="htopics"/.test(html) || !/<label for="htopic">Classroom topic \(optional\)<\/label>/.test(html)) throw new Error('no topic box under “Post it in Google Classroom”');
    if (CALLS.length) throw new Error('the page asked the server before the box was used: ' + CALLS.map(c => c[0]));
    page.fire('focus', 'id', 'htopic');
    if (!CALLS.length || CALLS[0][0] !== 'homeworkTopics' || CALLS[0][1][0].classes[0].cls !== cls) throw new Error('the topics were not asked for: ' + JSON.stringify(CALLS));
    page.fire('input', 'data-due', '0', '2027-03-06');
    page.fire('input', 'data-time', '0', '07:45');
    page.fire('input', 'id', 'htopic', 'Unit 7');
    page.press('id', 'hset');
    const set = CALLS.filter(c => c[0] === 'homeworkCreate')[0];
    if (!set) throw new Error('Set homework sent nothing');
    const a = set[1][0];
    if (a.classes[0].due !== '2027-03-06' || a.classes[0].time !== '07:45' || a.topic !== 'Unit 7' || !a.post) throw new Error('sent ' + JSON.stringify(a));
    /* the post box unticked: no topic box, and no topic sent */
    const page2 = teacherPage(); page2.win.google = { script: { run } }; D.classroomOk = false; page2.win.vHomework(D);
    if (/id="htopic"/.test(page2.html())) throw new Error('a topic box with Classroom off');
  } finally { homeworkDelete(r.made[0]); }
});
ok &= run('progress gives a pupil their own lab homework, each station scored by the teacher’s rule', () => {
  const cls = enA.cls;
  const r = homeworkCreate({ title:'Gut stations', classes:[{ cls, due: enDay(4) }],
    tasks:[ { labId:'digestion-lab', stationIds:['mouth', 'stomach', 'ghost'] }, { labId:'bio-english-lab', stationIds:['t3.kw.meanings'] } ] });
  const old = homeworkCreate({ title:'Long gone', classes:[{ cls, due: enDay(-40) }], tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
  const eng = homeworkCreate({ title:'Words only', classes:[{ cls, due: enDay(4) }], tasks:[{ labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] });
  if (!r.ok || !old.ok || !eng.ok) throw new Error('could not set the test homework');
  try {
    if (!hwStations(enA.email, 'mouth 8/8 in 11 · stomach 3/9 in 4')) throw new Error('no Digestion row for the pupil');
    const me = enPost({ action:'progress' }, enA.email);
    if (!me.ok || !Array.isArray(me.homework)) throw new Error('no homework in the answer: ' + JSON.stringify(me).slice(0, 200));
    const hw = me.homework.filter(h => h.id === r.made[0])[0];
    if (!hw) throw new Error('the pupil was not given their homework');
    if (me.homework.some(h => h.id === old.made[0])) throw new Error('homework a month past its date was listed');
    if (me.homework.some(h => h.id === eng.made[0])) throw new Error('English-only homework was listed for the labs');
    const by = {}; hw.stations.forEach(s => { by[s.id] = s; });
    if (!by.mouth || by.mouth.state !== 'done' || by.mouth.done !== 8 || by.mouth.total !== 8 || by.mouth.name !== 'Mouth and teeth' || by.mouth.lab !== 'digestion-lab')
      throw new Error('mouth: ' + JSON.stringify(by.mouth));
    if (!by.stomach || by.stomach.state !== 'partly' || by.stomach.done !== 3 || by.stomach.total !== 9) throw new Error('stomach: ' + JSON.stringify(by.stomach));
    if (by.ghost || by['t3.kw.meanings']) throw new Error('a station the lab does not have, or an English set, was listed: ' + Object.keys(by));
    if (hw.title !== 'Gut stations' || !hw.due || hw.overdue) throw new Error('the homework itself: ' + JSON.stringify([hw.title, hw.due, hw.overdue]));
    /* the teacher's page, on the same tabs, says the same about the lab part */
    const t = _hwScoreOne_({ tasks:[{ labId:'digestion-lab', stationIds:['mouth', 'stomach'] }] }, enA.email, _hwLabIndex_(['digestion-lab']), _hwManifest_());
    if (t.done !== hw.done || t.total !== hw.total || t.state !== hw.state) throw new Error('teacher ' + JSON.stringify(t) + ' vs pupil ' + JSON.stringify([hw.done, hw.total, hw.state]));
    /* nothing done yet: not started */
    hwStations(enA.email, '');
    const none = enPost({ action:'progress' }, enA.email).homework.filter(h => h.id === r.made[0])[0];
    if (none.stations.some(s => s.state !== 'none' || s.done !== 0)) throw new Error('not started: ' + JSON.stringify(none.stations));
    /* another class, a stranger: nothing */
    if (enB.cls !== cls && enPost({ action:'progress' }, enB.email).homework.some(h => h.id === r.made[0])) throw new Error('another class was given it');
    const stranger = enPost({ action:'progress' }, 'stranger@elsewhere.com');
    if (stranger.homework || Object.keys(stranger.labs).length) throw new Error('a stranger was told something: ' + JSON.stringify(stranger));
    /* the answer a page from before reads is unchanged beside the new field */
    if (!('labs' in me) || typeof me.labs !== 'object') throw new Error('the labs part of the answer changed');
  } finally { [r, old, eng].forEach(x => homeworkDelete(x.made[0])); }
});
ok &= run('progress makes no Homework tab and never fails over homework', () => {
  const t = ss.getSheetByName(T_HOMEWORK), keep = t;
  if (t) ss.deleteSheet(t);
  try {
    const me = enPost({ action:'progress' }, enA.email);
    if (!me.ok || me.homework.length !== 0) throw new Error(JSON.stringify(me).slice(0, 200));
    if (ss.getSheetByName(T_HOMEWORK)) throw new Error('a pupil’s question made the Homework tab');
    /* a broken manifest: an empty list, and the rest of the answer as ever */
    if (_ownHomework_('', '').length !== 0) throw new Error('an empty email was given homework');
  } finally { if (keep && !ss.getSheetByName(T_HOMEWORK)) ss.sheets.push(keep); }
});
/* ── Reminders to the pupils who have not finished, and the list's sort (Daniel, 1 Oct 2026) ─────────────────────
   Two Classroom announcements before the due time, at 70% and 85% of the time from setting to due, none between 22:00
   and 07:00, each addressed only to the pupils it was set for who have not finished, by their Classroom ids. The clock
   is the test's: _hwRemindRun_(ms) is the trigger's work at that moment, and times are written as the school's wall
   clock (UTC+9 in this stand-in). Each case removes its own homework, so one case's reminders never reach another. */
console.log('— reminders to the pupils who have not finished —');
{
  const KST = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 9, mi || 0);
  const W = 7 * 864e5, RA = [];                                 /* every announcement posted, in order */
  let annFail = '';
  const fakeClassroom = () => ({ Courses: {
    CourseWork: { create: () => ({ id: 'cw-' + Math.floor(Math.random() * 1e9) }) },
    Announcements: { create: (body, courseId) => { if (annFail) throw new Error(annFail); RA.push({ body, courseId }); return { id: 'an' + RA.length }; } } } });
  const withClassroom = fn => { global.Classroom = fakeClassroom(); try { return fn(); } finally { global.Classroom = undefined; } };
  const runAt = ms => withClassroom(() => _hwRemindRun_(ms));
  const cls = enA.cls, ids = _classroomIds_(), course = ids[enA.email] && ids[enA.email].courseId;
  const mates = _studentDirectory_().students.filter(s => s.cls === cls);
  const rowOf = id => _homeworkRows_().filter(h => h.id === id)[0];
  const cardOf = id => uiData('homework').data.homework.filter(h => h.id === id)[0];
  const notDone = () => mates.forEach(p => hwStations(p.email, ''));
  const uidsOf = ps => [...new Set(ps.map(p => ids[p.email] && ids[p.email].userId).filter(Boolean))].sort();
  const alertOf = fn => { const keep = SpreadsheetApp.getUi; let said = '';
    SpreadsheetApp.getUi = () => Object.assign(keep(), { alert: (a, b) => { said = String(b === undefined ? a : b); } });
    try { fn(); } finally { SpreadsheetApp.getUi = keep; } return said; };
  /* homework for the class (or chosen pupils), posted, reminders as asked; then the set and due times the case needs */
  const setHw = (title, setMs, dueMs, o) => withClassroom(() => {
    o = o || {};
    const r = homeworkCreate({ title, post: o.post !== false, remind: o.remind !== false,
      classes: [o.emails ? { cls:'', due:'2027-06-01', emails:o.emails } : { cls, due:'2027-06-01' }],
      tasks: o.tasks || [{ labId:'digestion-lab', stationIds:['mouth'] }] });
    if (!r.ok) throw new Error('could not set it: ' + r.why);
    const sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh), row = rowOf(r.made[0]).row;
    sh.getRange(row, hc.Created).setValue(new Date(setMs)); sh.getRange(row, hc.Due).setValue(new Date(dueMs));
    return r;
  });
  if (!course || mates.length < 5 || uidsOf(mates).length < 4) throw new Error('the test roster has changed: ' + cls + ' ' + course + ' ' + mates.length);

  ok &= run('a Homework tab made before the reminder columns is widened when homework is set; its old rows read as off', () => {
    const sh = ss.getSheetByName(T_HOMEWORK);
    for (const k of Array.from(sh.cells.keys())) if (+k.split(':')[1] > 14) sh.cells.delete(k);
    sh.maxC = 14;                                               /* as Tidy up left it before 1 Oct 2026 */
    if (_homeworkRows_().some(h => h.remindOn)) throw new Error('an old row reads as reminders on');
    const r = homeworkCreate({ title:'On an old tab', classes:[{ cls, due:'2027-06-02' }], tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
    if (!r.ok) throw new Error('an old tab refused homework: ' + r.why);
    try {
      const head = sh.getRange(1, 1, 1, 19).getValues()[0].map(h => String(h).replace(/^✎\s*/, ''));
      if (head.slice(14).join('|') !== 'Remind|Reminder 1|Reminder 1 students|Reminder 2|Reminder 2 students') throw new Error('headings: ' + head.slice(14).join('|'));
      const row = rowOf(r.made[0]);
      if (row.remindOn || row.rem.some(x => x.at)) throw new Error('reminders on for homework that was not posted: ' + JSON.stringify(row.rem));
    } finally { homeworkDelete(r.made[0]); }
  });
  ok &= run('reminder times: 70% and 85% of the time from setting to due — a week: 2.1 and 1.05 days before; six hours: 1 h 48 and 54 min before', () => {
    const s = KST(2027, 3, 1, 15, 0), d = s + W;
    const a = _hwRemindTime_(s, d, 1), b = _hwRemindTime_(s, d, 2);
    if (a.at !== s + Math.round(0.7 * W) || b.at !== s + Math.round(0.85 * W) || a.moved || b.moved) throw new Error('a week: ' + JSON.stringify([a, b]));
    if ((d - a.at) / 3600e3 !== 50.4 || (d - b.at) / 3600e3 !== 25.2) throw new Error('a week: ' + (d - a.at) / 3600e3 + ' h and ' + (d - b.at) / 3600e3 + ' h before');
    const s6 = KST(2027, 3, 2, 9, 0), d6 = s6 + 6 * 3600e3;
    const c = _hwRemindTime_(s6, d6, 1), e = _hwRemindTime_(s6, d6, 2);
    if ((d6 - c.at) / 60e3 !== 108 || (d6 - e.at) / 60e3 !== 54) throw new Error('six hours: ' + (d6 - c.at) / 60e3 + ' and ' + (d6 - e.at) / 60e3 + ' min before');
    if (!_hwRemindTime_(s, s, 1).skip || !_hwRemindTime_(d, s, 2).skip) throw new Error('a due time at or before the set time was timed');
  });
  ok &= run('none between 22:00 and 07:00: a reminder there goes at 07:00, or is skipped when 07:00 is 30 minutes or less from the due time', () => {
    /* set 06:00, due 07:36 the next day: reminder 1 falls at 23:55, reminder 2 at 03:45 — both wait for 07:00 */
    const s = KST(2027, 3, 3, 6, 0), d = KST(2027, 3, 4, 7, 36), seven = KST(2027, 3, 4, 7, 0);
    const a = _hwRemindTime_(s, d, 1), b = _hwRemindTime_(s, d, 2);
    if (a.at !== seven || !a.moved || b.at !== seven || !b.moved) throw new Error('moved to ' + new Date(a.at).toISOString() + ' and ' + new Date(b.at).toISOString());
    /* due at 07:30: 07:00 is only 30 minutes before it, so a reminder from the night is skipped */
    const d2 = KST(2027, 3, 4, 7, 30);
    if (!_hwRemindTime_(s, d2, 1).skip || !_hwRemindTime_(KST(2027, 3, 3, 20, 0), d2, 2).skip) throw new Error('a night reminder 30 minutes before the due time was not skipped');
    /* the trigger: nothing at night, then ONE reminder at 07:00 (reminder 2; reminder 1 is not repeated beside it) */
    notDone();
    const r = setHw('Night test', s, d), id = r.made[0]; RA.length = 0;
    try {
      [KST(2027, 3, 3, 22, 1), KST(2027, 3, 3, 23, 58), KST(2027, 3, 4, 3, 50), KST(2027, 3, 4, 6, 59)].forEach(t => {
        if (runAt(t) || RA.length) throw new Error('posted in the night, at ' + new Date(t).toISOString()); });
      if (runAt(KST(2027, 3, 4, 7, 2)) !== 1 || RA.length !== 1) throw new Error('not one reminder at 07:00: ' + RA.length);
      const row = rowOf(id);
      if (!/^skipped: reminder 2 was due at the same time/.test(row.rem[0].said) || !/^\d+$/.test(row.rem[1].said)) throw new Error('the row reads ' + JSON.stringify(row.rem));
      if (runAt(KST(2027, 3, 4, 7, 17)) || RA.length !== 1) throw new Error('posted again at 07:17');
    } finally { homeworkDelete(id); }
  });
  ok &= run('a reminder names pupils by the ids Classroom has for them, never the rounded copy in the Students tab (5 Oct 2026: every reminder failed)', () => {
    const s = KST(2027, 3, 15, 15, 0), d = s + W, t1 = s + Math.round(0.7 * W);
    notDone();
    const real = {}; mates.forEach((p, i) => { real[p.email] = '117346278912345' + String(678901 + i); });   /* 21 digits, as Classroom's */
    const r = setHw('Real ids', s, d), id = r.made[0]; RA.length = 0;
    try {
      global.Classroom = fakeClassroom();
      global.Classroom.Courses.Students = { list: cid => ({ students: cid === course ? mates.map(p => ({ userId: real[p.email], profile: { emailAddress: p.email } })) : [] }) };
      if (_hwRemindRun_(t1 + 60e3) !== 1 || RA.length !== 1) throw new Error('reminder 1 did not go: ' + RA.length);
      const got = RA[0].body.individualStudentsOptions.studentIds.slice().sort(), want = [...new Set(mates.map(p => real[p.email]))].sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error('to ' + got + ', want Classroom’s own ' + want);
    } finally { global.Classroom = undefined; homeworkDelete(id); }
  });
  ok &= run('importing again repairs a rounded Classroom id, and keeps ids as text', () => {
    const sh = ss.getSheetByName(T_STUDENTS), ec = _emailCol_(sh), uc = _headerCol_(sh, 'Classroom user id', ec + 3);
    const p = mates[0], row = sh.getRange(2, ec, sh.getLastRow() - 1, 1).getValues().findIndex(x => String(x[0]).toLowerCase() === p.email) + 2;
    const keep = sh.getRange(row, uc).getValue();
    sh.getRange(row, uc).setValue(1.17346278912346e20);                       /* what Sheets kept of a 21-digit id */
    try {
      _upsertStudents_([{ name: p.name, email: p.email, userId: '117346278912345678901' }], p.cls, 'Bio', course);
      if (sh.getRange(row, uc).getValue() !== '117346278912345678901') throw new Error('not repaired: ' + sh.getRange(row, uc).getValue());
      if (!sh.fmt || sh.fmt.get(row + ':' + uc) !== '@') throw new Error('the id cell is not text');
    } finally { sh.getRange(row, uc).setValue(keep); }
  });
  ok &= run('a reminder goes ONCE, as one announcement to the pupils who have not finished, by their Classroom ids, naming nobody; reminder 2 is worked out again', () => {
    const s = KST(2027, 3, 8, 15, 0), d = s + W, t1 = s + Math.round(0.7 * W), t2 = s + Math.round(0.85 * W);
    notDone();
    const fin = mates[0]; hwStations(fin.email, 'mouth 8/8 in 11');          /* this pupil has finished */
    const r = setHw('Week of the gut', s, d), id = r.made[0]; RA.length = 0;
    try {
      if (runAt(t1 - 60e3) || RA.length) throw new Error('a reminder went before 70% of the time had passed');
      if (runAt(t1 + 60e3) !== 1 || RA.length !== 1) throw new Error('reminder 1 did not go, once: ' + RA.length);
      const a = RA[0], want = uidsOf(mates.filter(p => p !== fin));
      if (a.courseId !== course) throw new Error('posted to ' + a.courseId + ', not the class’s course ' + course);
      if (a.body.assigneeMode !== 'INDIVIDUAL_STUDENTS' || a.body.state !== 'PUBLISHED') throw new Error('not addressed to individuals: ' + JSON.stringify(a.body).slice(0, 200));
      const got = a.body.individualStudentsOptions.studentIds.slice().sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error('to ' + got + ', want ' + want + ' (each id once, the finished pupil left out)');
      _studentDirectory_().students.forEach(p => {
        if ((p.name && a.body.text.indexOf(p.name) >= 0) || a.body.text.toLowerCase().indexOf(p.email) >= 0) throw new Error('the reminder names a pupil');
      });
      const words = 'Reminder: your homework "Week of the gut" is due on Monday 15 March at 15:00. You have not finished it yet.\n' +
                    'Open it here: https://nlcsbiology.com/digestion-lab/#mouth\n' +
                    'Answer EVERY question in the Practise tab of each homework station. You have finished when every homework station is green.\n' +
                    'SIGN IN with your school GOOGLE ACCOUNT. If you do not sign in, your work is not recorded.';
      if (a.body.text !== words) throw new Error('the words: ' + a.body.text);
      if (a.body.materials.length !== 1 || a.body.materials[0].link.url !== 'https://nlcsbiology.com/digestion-lab/#mouth') throw new Error('materials: ' + JSON.stringify(a.body.materials));
      const row = rowOf(id);
      if (!row.rem[0].at || row.rem[0].said !== String(want.length) || row.rem[1].at) throw new Error('the row: ' + JSON.stringify(row.rem));
      /* the row keeps a count: no name, address or Classroom id */
      const cells = ss.getSheetByName(T_HOMEWORK).getRange(row.row, 15, 1, 5).getValues()[0].join(' ');
      if (mates.some(p => cells.indexOf(p.email) >= 0 || (p.name && cells.indexOf(p.name) >= 0)) || want.some(u => new RegExp('\\b' + u + '\\b').test(cells)))
        throw new Error('the row holds who: ' + cells);
      if (runAt(t1 + 2 * 60e3) || RA.length !== 1) throw new Error('reminder 1 went twice');
      const c1 = cardOf(id).remind;
      if (c1.says !== '1: sent to ' + want.length + ' · 2: waiting' || c1.bad || !c1.on || !c1.can) throw new Error('the list says ' + JSON.stringify(c1));
      /* reminder 2, worked out again at its moment: another pupil has finished since */
      const fin2 = mates[1]; hwStations(fin2.email, 'mouth 8/8 in 11');
      if (runAt(t2 + 60e3) !== 1 || RA.length !== 2) throw new Error('reminder 2 did not go');
      const want2 = uidsOf(mates.filter(p => p !== fin && p !== fin2));
      if (JSON.stringify(RA[1].body.individualStudentsOptions.studentIds.slice().sort()) !== JSON.stringify(want2)) throw new Error('reminder 2 went to ' + RA[1].body.individualStudentsOptions.studentIds);
      if (RA[1].body.text !== words) throw new Error('reminder 2 has other words: ' + RA[1].body.text);
      if (cardOf(id).remind.says !== '1: sent to ' + want.length + ' · 2: sent to ' + want2.length) throw new Error('the list says ' + cardOf(id).remind.says);
      /* nothing after the due time, and never a third */
      if (runAt(d + 60e3) || RA.length !== 2) throw new Error('a reminder after the due time');
    } finally { homeworkDelete(id); notDone(); }
  });
  ok &= run('everyone finished: no announcement; the due time passed first: skipped, never posted late', () => {
    const s = KST(2027, 3, 15, 15, 0), d = s + W, t1 = s + Math.round(0.7 * W);
    notDone(); mates.forEach(p => hwStations(p.email, 'mouth 8/8 in 11'));
    const r = setHw('All done', s, d), id = r.made[0];
    const late = setHw('Too late', s, d), lid = late.made[0]; RA.length = 0;
    try {
      /* "Too late": its 70% moment passes while nothing runs, and the next run is after the due time */
      if (runAt(t1 + 60e3) || RA.length) throw new Error('an announcement to nobody');
      if (rowOf(id).rem[0].said !== 'not needed: everyone had finished') throw new Error('the row reads ' + rowOf(id).rem[0].said);
      notDone();
      const sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh);
      sh.getRange(rowOf(lid).row, hc['Reminder 1']).setValue(''); sh.getRange(rowOf(lid).row, hc['Reminder 1 students']).setValue('');
      if (runAt(d + 5 * 60e3) || RA.length) throw new Error('posted after the due time');
      const lr = rowOf(lid);
      if (!/^skipped: the due time had passed/.test(lr.rem[0].said) || !/^skipped: the due time had passed/.test(lr.rem[1].said)) throw new Error('the row reads ' + JSON.stringify(lr.rem));
      /* the list, read after the due time (the test's clock): both skipped, and no switch offered */
      const said = _hwRemindSays_(lr, d + 5 * 60e3);
      if (said.can || said.says !== '1: skipped: the due time had passed · 2: skipped: the due time had passed') throw new Error('the list says ' + JSON.stringify(said));
    } finally { homeworkDelete(id); homeworkDelete(lid); notDone(); }
  });
  ok &= run('the 🔔 switch: off stops the reminders, on starts them again; a pupil cannot touch it', () => {
    const s = KST(2027, 3, 22, 15, 0), d = s + W, t1 = s + Math.round(0.7 * W);
    notDone();
    const r = setHw('Switch test', s, d), id = r.made[0]; RA.length = 0;
    try {
      VISITOR = 'pupil@pupils.x.kr';
      if (homeworkRemind({ id, on:false }).ok !== false) throw new Error('a pupil switched the reminders off');
      VISITOR = OWNER;
      const off = homeworkRemind({ id, on:false });
      if (!off.ok) throw new Error(off.why);
      const c = off.data.homework.filter(h => h.id === id)[0].remind;
      if (c.says !== 'off' || c.on || !c.can) throw new Error('the list says ' + JSON.stringify(c));
      if (runAt(t1 + 60e3) || RA.length) throw new Error('a reminder went while switched off');
      if (rowOf(id).rem[0].at) throw new Error('a switched-off reminder was written down');
      const on = homeworkRemind({ id, on:true });
      if (!on.ok || !rowOf(id).remindOn) throw new Error('could not switch it on again: ' + on.why);
      if (runAt(t1 + 2 * 60e3) !== 1 || RA.length !== 1) throw new Error('switched on again, reminder 1 did not go');
      if (homeworkRemind({ id:'HW-NONE1', on:true }).ok !== false) throw new Error('a homework that is not there was switched');
    } finally { VISITOR = OWNER; homeworkDelete(id); }
  });
  ok &= run('homework for chosen pupils reminds only them; a pupil with no Classroom id is left out; homework not in Classroom is never reminded', () => {
    const s = KST(2027, 4, 5, 15, 0), d = s + W, t1 = s + Math.round(0.7 * W);
    notDone();
    const chosen = [mates[2], mates[4]];
    const a = setHw('Two of them', s, d, { emails: chosen.map(p => p.email) }), ida = a.made[0];
    /* posting asked for, but Classroom is off: the switch is kept, and nothing can ever be reminded */
    const b = homeworkCreate({ title:'Never posted', post:true, remind:true, classes:[{ cls, due:'2027-06-01' }], tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] }), idb = b.made[0];
    const sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh);
    sh.getRange(rowOf(idb).row, hc.Created).setValue(new Date(s)); sh.getRange(rowOf(idb).row, hc.Due).setValue(new Date(d));
    RA.length = 0;
    /* one of the chosen pupils has no Classroom user id */
    const st = ss.getSheetByName(T_STUDENTS), ec = _emailCol_(st), uc = _headerCol_(st, 'Classroom user id', ec + 3);
    const at = st.getRange(2, ec, st.getLastRow() - 1, 1).getValues().findIndex(x => String(x[0]).toLowerCase() === chosen[1].email) + 2;
    const keep = st.getRange(at, uc).getValue(); st.getRange(at, uc).setValue('');
    try {
      if (b.remind !== 'no post' || !rowOf(idb).remindOn) throw new Error('the switch was not kept: ' + b.remind);
      if (runAt(t1 + 60e3) !== 1 || RA.length !== 1) throw new Error(RA.length + ' announcements');
      const got = RA[0].body.individualStudentsOptions.studentIds;
      if (got.join() !== ids[chosen[0].email].userId) throw new Error('to ' + got + ', want only ' + ids[chosen[0].email].userId);
      if (rowOf(idb).rem[0].at) throw new Error('homework not in Classroom was reminded');
      if (cardOf(idb).remind.says !== 'no reminders: not posted in Google Classroom') throw new Error('the list says ' + cardOf(idb).remind.says);
    } finally { st.getRange(at, uc).setValue(keep); homeworkDelete(ida); homeworkDelete(idb); }
  });
  ok &= run('🩺 says plainly when the Classroom announcements permission is missing; a reminder then is not tried, and the list shows why', () => {
    const s = KST(2027, 4, 12, 15, 0), d = s + W, t1 = s + Math.round(0.7 * W);
    notDone();
    const r = setHw('Permission test', s, d), id = r.made[0]; RA.length = 0;
    SCOPES_GRANTED = false;
    try {
      const said = withClassroom(() => alertOf(() => checkSetup()));
      if (!/❌  the reminders CANNOT be posted: Google has not been allowed to post Classroom announcements for this script/.test(said) ||
          !/checkSetup/.test(said) || !/▶ Run/.test(said) || !/Select all/.test(said)) throw new Error('🩺 does not say it: ' + said.slice(-700));
      if (uiData('homework').data.remindAllowed !== false) throw new Error('the page is not told');
      if (runAt(t1 + 60e3) || RA.length) throw new Error('a reminder was tried without the permission');
      if (!/^not sent: Google has not been allowed to post Classroom announcements/.test(rowOf(id).rem[0].said)) throw new Error('the row reads ' + rowOf(id).rem[0].said);
      const c = cardOf(id).remind;
      if (!/^1: ⚠ not sent: Google has not been allowed/.test(c.says) || !c.bad) throw new Error('the list says ' + c.says);
      SCOPES_GRANTED = true;
      const fine = withClassroom(() => alertOf(() => checkSetup()));
      if (!/✅  the reminders can be posted: Google Classroom announcements are allowed/.test(fine)) throw new Error('with the permission: ' + fine.slice(-500));
    } finally { SCOPES_GRANTED = true; homeworkDelete(id); }
  });
  ok &= run('🩺 says which time zone due times and the reminders’ night hours are read in, and ❌ when the spreadsheet’s and the script’s differ or the spreadsheet has none', () => {
    /* 2 Oct 2026: the paste list asked Daniel to check the spreadsheet's time zone by hand; he looked at the script's */
    const handle = _ss_(), real = handle.getSpreadsheetTimeZone, keep = Session.getScriptTimeZone;
    try {
      Session.getScriptTimeZone = () => 'Asia/Seoul';
      const fine = withClassroom(() => alertOf(() => checkSetup()));
      if (!fine.includes('✅  times are read in Asia/Seoul (the spreadsheet’s time zone)')) throw new Error('both Asia/Seoul: ' + fine.slice(-400));
      Session.getScriptTimeZone = () => 'America/New_York';
      const two = withClassroom(() => alertOf(() => checkSetup()));
      if (!two.includes('❌  the spreadsheet’s time zone is Asia/Seoul, but the script’s is America/New_York.') || !/File ▸ Settings ▸ Time zone/.test(two) || /✅  times are read in/.test(two))
        throw new Error('two different zones: ' + two.slice(-600));
      handle.getSpreadsheetTimeZone = () => '';
      const none = alertOf(() => checkSetup());
      if (!none.includes('❌  the spreadsheet has no time zone, so due times and the reminders’ night hours (22:00–07:00) are read in the script’s, America/New_York.')) throw new Error('no zone in the spreadsheet: ' + none.slice(-600));
      /* a script zone that cannot be read: the spreadsheet's is said, with no ❌ */
      handle.getSpreadsheetTimeZone = real; Session.getScriptTimeZone = () => { throw new Error('no'); };
      if (_tzLine_() !== '✅  times are read in Asia/Seoul (the spreadsheet’s time zone)') throw new Error('script zone unreadable: ' + _tzLine_());
    } finally { handle.getSpreadsheetTimeZone = real; if (keep) Session.getScriptTimeZone = keep; else delete Session.getScriptTimeZone; _TZ_MEMO = null; }
  });
  /* ── Homework set for a later date (Daniel, 2 Oct 2026: "when you set homework, you can schedule it for a specific date") ── */
  const CW = [], GONE = [];
  let rmFail = '';
  const schedClassroom = () => ({ Courses: {
    CourseWork: { create: (body, courseId) => { CW.push({ body, courseId }); return { id: 'cw' + CW.length }; },
                  remove: (courseId, id) => { if (rmFail) throw new Error(rmFail); GONE.push(courseId + '/' + id); } },
    Announcements: { create: (body, courseId) => { RA.push({ body, courseId }); return { id: 'an' + RA.length }; } } } });
  const withSched = fn => { global.Classroom = schedClassroom(); try { return fn(); } finally { global.Classroom = undefined; } };
  const TASK = [{ labId:'digestion-lab', stationIds:['mouth'] }];
  const cellOfHw = (id, name, v) => { const sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh); sh.getRange(rowOf(id).row, hc[name]).setValue(v); };
  ok &= run('set for a later date: the start is kept (no time = 08:00), the row is waiting, and Google Classroom holds the post as a draft with that time', () => {
    const made = [];
    try {
      CW.length = 0;
      let r = withSched(() => homeworkCreate({ title:'Later', post:true, remind:true, classes:[{ cls, due:'2027-06-10', start:'2027-06-03' }], tasks:TASK })); made.push(r);
      if (!r.ok) throw new Error(r.why);
      const row = rowOf(r.made[0]);
      if (row.start !== '2027-06-02T23:00:00.000Z' || row.startText !== '3 Jun, 08:00' || row.waiting !== true || row.from !== row.start) throw new Error('the row: ' + JSON.stringify([row.start, row.startText, row.waiting, row.from]));
      const head = ss.getSheetByName(T_HOMEWORK).getRange(1, 1, 1, 20).getValues()[0].map(h => String(h).replace(/^✎\s*/, ''));
      if (head[19] !== 'Starts' || head[18] !== 'Reminder 2 students') throw new Error('"Starts" is not the last heading: ' + head.slice(17).join('|'));
      const b = CW[0].body;
      if (b.state !== 'DRAFT' || b.scheduledTime !== '2027-06-02T23:00:00.000Z') throw new Error('Classroom was not asked to hold it: ' + JSON.stringify([b.state, b.scheduledTime]));
      if (r.posted.length || JSON.stringify(r.later) !== JSON.stringify([{ who: String(cls).toUpperCase(), when:'3 Jun, 08:00', classroom:true }]) || r.remind !== 'on') throw new Error('the answer: ' + JSON.stringify([r.posted, r.later, r.remind]));
      if (!rowOf(r.made[0]).courseWork) throw new Error('the held post’s id was not kept (Remove and the reminders need it)');
      const card = uiData('homework').data.homework.filter(h => h.id === r.made[0])[0];
      if (card.waiting !== true || card.startText !== '3 Jun, 08:00') throw new Error('the list is not told: ' + JSON.stringify([card.waiting, card.startText]));
      /* a start time, in the school's zone */
      r = withSched(() => homeworkCreate({ title:'Later, 14:30', post:true, classes:[{ cls, due:'2027-06-10', time:'09:00', start:'2027-06-03', startTime:'14:30' }], tasks:TASK })); made.push(r);
      if (rowOf(r.made[0]).start !== '2027-06-03T05:30:00.000Z' || CW[1].body.scheduledTime !== '2027-06-03T05:30:00.000Z') throw new Error('14:30 here: ' + rowOf(r.made[0]).start);
      /* no start: out at once, exactly as before */
      r = withSched(() => homeworkCreate({ title:'Now', post:true, classes:[{ cls, due:'2027-06-10' }], tasks:TASK })); made.push(r);
      const now = rowOf(r.made[0]);
      if (CW[2].body.state !== 'PUBLISHED' || 'scheduledTime' in CW[2].body || now.start !== null || now.waiting || now.from !== now.created || r.later.length || r.posted.length !== 1)
        throw new Error('with no start: ' + JSON.stringify([CW[2].body.state, now.start, now.waiting, r.later, r.posted]));
      /* not posted in Classroom: still set for later, in the labs alone */
      r = homeworkCreate({ title:'Later, labs only', classes:[{ cls, due:'2027-06-10', start:'2027-06-03' }], tasks:TASK }); made.push(r);
      if (!r.ok || r.later.length !== 1 || r.later[0].classroom !== false || !rowOf(r.made[0]).waiting) throw new Error('labs only: ' + JSON.stringify(r.later));
    } finally { made.forEach(r => r && r.ok && r.made.forEach(id => homeworkDelete(id))); }
  });
  ok &= run('a start that cannot be is refused in words and nothing is set: a time with no date, not a time, already passed, not before the due time', () => {
    const n0 = _homeworkRows_().length, tryIt = c => homeworkCreate({ title:'Bad start', classes:[Object.assign({ cls, due:'2027-06-10' }, c)], tasks:TASK });
    const cases = [[{ startTime:'08:00' }, /a start time needs a start date/], [{ start:'2027-06-03', startTime:'25:00' }, /the start time is not a time/],
                   [{ start:'soon' }, /the start date cannot be read/], [{ start:'2020-01-01' }, /has passed\. Choose a later time, or leave the start empty to set it now\./],
                   [{ start:'2027-06-11' }, /it must start before it is due \(10 Jun, 23:59\)/], [{ start:'2027-06-10', startTime:'09:00', time:'09:00' }, /it must start before it is due/]];
    cases.forEach(([c, why]) => { const r = tryIt(c); if (r.ok !== false || !why.test(r.why) || r.why.indexOf(String(cls).toUpperCase() + ': ') !== 0) throw new Error(JSON.stringify(c) + ' → ' + JSON.stringify(r).slice(0, 200)); });
    if (_homeworkRows_().length !== n0) throw new Error('a refused homework left a row');
  });
  ok &= run('until its start no pupil sees it, in the labs or in Bio English Lab; from its start they do', () => {
    const r = homeworkCreate({ title:'Not yet', classes:[{ cls, due:'2027-06-10', start:'2027-06-03' }],
      tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }, { labId:'bio-english-lab', stationIds:['t3.kw.meanings'] }] });
    if (!r.ok) throw new Error(r.why);
    const id = r.made[0];
    try {
      const inLabs = () => (enPost({ action:'progress' }, enA.email).homework || []).some(h => h.id === id);
      const inEnglish = () => (enPost({ action:'english.mine' }, enA.email).homework || []).some(h => h.id === id);
      if (inLabs() || inEnglish()) throw new Error('a pupil sees homework that has not started: labs ' + inLabs() + ', Bio English ' + inEnglish());
      cellOfHw(id, 'Starts', new Date(Date.now() - 60e3));          /* its start has come */
      if (!inLabs() || !inEnglish()) throw new Error('after its start a pupil still does not see it: labs ' + inLabs() + ', Bio English ' + inEnglish());
      /* and Homework habits lists it only from its start, and counts from there */
      const s = Date.parse(rowOf(id).start);
      if (_habitsData_(s - 1000).homework.some(h => h.id === id)) throw new Error('Homework habits lists it before its start');
      const hb = _habitsData_(s + 1000).homework.filter(h => h.id === id)[0];
      if (!hb || hb.set !== _hwWhen_(s)) throw new Error('Homework habits does not count from the start: ' + JSON.stringify(hb));
    } finally { homeworkDelete(id); }
  });
  ok &= run('the reminders count from the start, not from when it was set: nothing before the start, reminder 1 at 70% of start to due', () => {
    const s0 = KST(2027, 4, 16, 15, 0), s = KST(2027, 4, 19, 15, 0), d = s + W;       /* set on the 16th, for the 19th, due the 26th */
    notDone(); RA.length = 0;
    const r = withSched(() => homeworkCreate({ title:'Counted from the start', post:true, remind:true, classes:[{ cls, due:'2027-06-10', start:'2027-06-03' }], tasks:TASK }));
    if (!r.ok) throw new Error(r.why);
    const id = r.made[0];
    try {
      cellOfHw(id, 'Created', new Date(s0)); cellOfHw(id, 'Starts', new Date(s)); cellOfHw(id, 'Due', new Date(d));
      const run = ms => withSched(() => _hwRemindRun_(ms));
      if (run(s - 3600e3) || RA.length || rowOf(id).rem[0].at) throw new Error('a reminder, or a mark, before the start');
      /* 70% of set→due is the 23rd at 15:00: from the start it is too early */
      if (run(s0 + Math.round(0.7 * (d - s0)) + 60e3) || RA.length) throw new Error('reminder 1 was counted from when it was set');
      const t1 = s + Math.round(0.7 * W);
      if (_hwRemindTime_(s, d, 1).at !== t1) throw new Error('the 70% moment fell in the night: choose other times for this case');
      if (run(t1 - 60e3) || RA.length) throw new Error('reminder 1 a minute early');
      if (run(t1 + 60e3) !== 1 || RA.length !== 1) throw new Error('reminder 1 did not go at 70% of start to due');
      if (!new RegExp('Reminder 2: about ' + _hwWhen_(_hwRemindTime_(s, d, 2).at).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(_hwRemindSays_(rowOf(id), t1 + 120e3).plan))
        throw new Error('the list’s plan does not count from the start: ' + _hwRemindSays_(rowOf(id), t1 + 120e3).plan);
    } finally { homeworkDelete(id); }
  });
  ok &= run('Remove before the start also removes the post Google Classroom is holding; if Classroom refuses, the page is told what to do; a post already out is left', () => {
    GONE.length = 0; rmFail = '';
    const mk = start => { const r = withSched(() => homeworkCreate({ title:'To remove', post:true, classes:[Object.assign({ cls, due:'2027-06-10' }, start ? { start } : {})], tasks:TASK }));
      if (!r.ok) throw new Error(r.why); return r.made[0]; };
    try {
      let id = mk('2027-06-03'), row = rowOf(id), out = withSched(() => homeworkDelete(id));
      if (!out.ok || out.note || GONE.join() !== row.course + '/' + row.courseWork || rowOf(id)) throw new Error('waiting: ' + JSON.stringify([out.ok, out.note, GONE]));
      /* Classroom refuses: the homework is still removed here, and the page says where the post is */
      id = mk('2027-06-03'); rmFail = 'The caller does not have permission';
      out = withSched(() => homeworkDelete(id));
      if (!out.ok || rowOf(id) || !/^Removed here\. Its post in Google Classroom, set for 3 Jun, 08:00, could not be removed: open Classroom ▸ Classwork and delete the scheduled post “To remove” by hand\.$/.test(out.note)) throw new Error('refused by Classroom: ' + JSON.stringify(out.note));
      /* Classroom switched off altogether: said the same way, never a throw */
      rmFail = ''; id = mk('2027-06-03'); out = homeworkDelete(id);
      if (!out.ok || !/could not be removed/.test(out.note)) throw new Error('Classroom off: ' + JSON.stringify(out.note));
      /* started, or never set for later: the post is out, and it is left (as before) */
      GONE.length = 0;
      id = mk('2027-06-03'); cellOfHw(id, 'Starts', new Date(Date.now() - 60e3)); out = withSched(() => homeworkDelete(id));
      const id2 = mk(''); const out2 = withSched(() => homeworkDelete(id2));
      if (GONE.length || out.note || out2.note) throw new Error('a post already out was removed: ' + JSON.stringify([GONE, out.note, out2.note]));
    } finally { rmFail = ''; }
  });
  ok &= run('the Set homework form, set for a later date: the switch shows a start date and time per class; an empty one says what it means; they are sent; the list says "Starts …"', () => {
    const D = JSON.parse(JSON.stringify(uiData('homework').data)); D.classroomOk = true;
    D.homework = [Object.assign({}, D.homework[0] || {}, { id:'HW-WAIT1', title:'Waiting', who:'9A', what:'Digestion: Mouth', pupils:[], tally:{ done:0, partly:0, none:0 }, dueText:'10 Jun', due:'2027-06-10T14:59:59.000Z',
      overdue:false, soon:false, tasks:TASK, targets:{ cls:'9A' }, remind:null, start:'2027-06-02T23:00:00.000Z', startText:'3 Jun, 08:00', waiting:true, teacher: OWNER })];
    const page = teacherPage(), CALLS = [], A = enA.cls, B = enB.cls;
    let okFn = null;
    const run = new Proxy({}, { get: (t, k) => k === 'withSuccessHandler' ? (f => { okFn = f; return run; }) : k === 'withFailureHandler' ? (() => run)
      : (...args) => { CALLS.push([k, args]); if (okFn) okFn({ ok:true, made:['HW-T1', 'HW-T2'], posted:[], later:[{ who:A, when:'3 Jun, 08:00', classroom:true }, { who:B, when:'3 Jun, 08:00', classroom:true }], notPosted:[], topic:'', topics:[], topicMissed:[], data:D }); } });
    page.win.google = { script: { run } };
    page.win.vHomework(D);
    let html = page.html();
    if (!html.includes('<input type="checkbox" id="hlater"><span>Set it for a later date: choose when pupils get it</span>') || /data-start=|data-stime=/.test(html)) throw new Error('the switch is missing, or the start boxes show before it is ticked');
    /* Daniel, 2 Oct 2026: "if no start date is set, does it start immediately — is that clear?" */
    if (!html.includes('<div class="tmsg" id="hlatersay" style="margin:3px 0 0 22px">Not ticked: pupils get it at once, when you press Set homework.</div>')) throw new Error('with the switch off the form does not say pupils get it at once');
    if (!html.includes('<div class="hw__r">🗓 Starts 3 Jun, 08:00: pupils do not see it yet</div>')) throw new Error('the list does not say a waiting homework starts later');
    page.fire('change', 'id', 'hlater', true);
    html = page.html();
    if (!/<label for="hs0">Starts<\/label><input id="hs0" type="date" data-start="0" value="">/.test(html) || !/<label for="hst0">Start time \(optional\)<\/label><input id="hst0" type="time" data-stime="0" value="">/.test(html)) throw new Error('no start date and time for the class');
    if (!html.includes('<div class="tmsg" id="hsn0" style="flex:1 1 100%">No start date: this class gets it at once, when you press Set homework.</div>') || !html.includes('Until its start, pupils see nothing') || !html.includes('A class with no start date gets it at once.'))
      throw new Error('an empty start does not say what it means');
    page.fire('change', 'data-cls', '0', A);
    page.fire('input', 'data-start', '0', '2027-06-03'); page.fire('input', 'data-due', '0', '2027-06-10');
    page.press('id', 'addrow');
    html = page.html();
    if (!html.includes('<div class="tmsg" id="hsn0" style="flex:1 1 100%">No start time typed: pupils get it at 08:00 that day.</div>')) throw new Error('a start with no time does not say 08:00');
    page.fire('change', 'data-cls', '1', B);
    page.press('data-same', '1');
    html = page.html();
    if (!/id="hs1" type="date" data-start="1" value="2027-06-03"/.test(html) || !/id="hd1" type="date" data-due="1" value="2027-06-10"/.test(html)) throw new Error('"↑ Same date and time" did not copy the start with the due date');
    page.fire('input', 'data-stime', '1', '14:30');
    page.fire('input', 'id', 'ht', 'Later, two classes');
    page.press('data-all', 'digestion-lab');
    if (!page.html().includes('id="hsn1" style="flex:1 1 100%" hidden>')) throw new Error('a class with a start date and time still shows a note');
    page.press('id', 'hset');
    const a = CALLS.filter(c => c[0] === 'homeworkCreate')[0][1][0];
    if (a.classes[0].start !== '2027-06-03' || a.classes[0].startTime !== '' || a.classes[1].start !== '2027-06-03' || a.classes[1].startTime !== '14:30') throw new Error('sent ' + JSON.stringify(a.classes));
    /* the switch off: nothing about a start is sent, even if one was typed before */
    const p2 = teacherPage(), C2 = [];
    const run2 = new Proxy({}, { get: (t, k) => k === 'withSuccessHandler' ? (() => run2) : k === 'withFailureHandler' ? (() => run2) : (...args) => { C2.push([k, args]); } });
    p2.win.google = { script: { run: run2 } }; p2.win.vHomework(D);
    p2.fire('change', 'id', 'hlater', true); p2.fire('change', 'data-cls', '0', A); p2.fire('input', 'data-start', '0', '2027-06-03'); p2.fire('input', 'data-due', '0', '2027-06-10');
    p2.fire('change', 'id', 'hlater', false); p2.fire('input', 'id', 'ht', 'Now after all'); p2.press('data-all', 'digestion-lab'); p2.press('id', 'hset');
    const a2 = C2.filter(c => c[0] === 'homeworkCreate')[0][1][0];
    if ('start' in a2.classes[0] || 'startTime' in a2.classes[0]) throw new Error('a start was sent with the switch off: ' + JSON.stringify(a2.classes));
  });
  ok &= run('a failed announcement breaks nothing: written down (no long ids), logged, shown on the list, never tried again', () => {
    const s = KST(2027, 4, 19, 15, 0), d = s + W, t1 = s + Math.round(0.7 * W);
    notDone();
    const r = setHw('Failure test', s, d), id = r.made[0]; RA.length = 0;
    annFail = 'Classroom is busy for user 114583920114583920114 just now';
    try {
      if (runAt(t1 + 60e3) !== 0) throw new Error('a failed post was counted');
      const said = rowOf(id).rem[0].said;
      if (!/^not sent: Classroom is busy/.test(said) || /\d{12,}/.test(said)) throw new Error('the row reads ' + said);
      const c = cardOf(id).remind;
      if (!c.bad || !/^1: ⚠ not sent: Classroom is busy/.test(c.says)) throw new Error('the list says ' + c.says);
      if (!calls.some(x => /^log: Homework reminder 1 for HW-\w+ not sent: Classroom is busy/.test(x))) throw new Error('the failure was not logged');
      annFail = '';
      if (runAt(t1 + 20 * 60e3) || RA.length) throw new Error('a failed reminder was tried again');
    } finally { annFail = ''; homeworkDelete(id); }
  });
  ok &= run('the 15-minute check is cheap when nothing is due: one read of the Homework tab, no station list, no Classroom', () => {
    const s = KST(2027, 4, 26, 15, 0);
    const r = setHw('Cheap test', s, s + W), id = r.made[0];
    const seen = [], keepGet = ss.getSheetByName, keepFetch = UrlFetchApp.fetch;
    let fetched = 0, asked = 0;
    ss.getSheetByName = function (n) { seen.push(n); return keepGet.call(ss, n); };
    UrlFetchApp.fetch = function () { fetched++; return keepFetch.apply(UrlFetchApp, arguments); };
    global.Classroom = new Proxy({}, { get: () => { asked++; return undefined; } });
    try {
      const c0 = __CALLS;
      if (_hwRemindRun_(s + 60e3) !== 0) throw new Error('something was posted');
      const reads = __CALLS - c0;
      if (sendHomeworkReminders({ now: 9e15 }) !== 0) throw new Error('the trigger, called with something, posted now');
      if (seen.some(n => n !== T_HOMEWORK)) throw new Error('it read ' + [...new Set(seen)].join(', '));
      if (fetched || asked) throw new Error('it fetched the station list or asked Classroom: ' + fetched + ' / ' + asked);
      if (reads > 2) throw new Error(reads + ' reads of the sheet, want the headings and the rows');
    } finally { ss.getSheetByName = keepGet; UrlFetchApp.fetch = keepFetch; global.Classroom = undefined; homeworkDelete(id); }
  });
  ok &= run('the 15-minute check starts by itself when homework with reminders is set — once — and 🩺 reports it, and starts it again if it is gone', () => {
    const mine = () => TRIGGERS.filter(t => t.getHandlerFunction() === 'sendHomeworkReminders');
    const daily = TRIGGERS.filter(t => t.getHandlerFunction() === 'sendDueSummaries').length;
    mine().forEach(t => ScriptApp.deleteTrigger(t));
    const s = KST(2027, 5, 3, 15, 0);
    const off = setHw('No reminders', s, s + W, { remind:false }), made = [off];
    try {
      if (mine().length) throw new Error('reminders off, and the check started anyway');
      if (rowOf(off.made[0]).remindOn || off.remind !== 'off') throw new Error('the switch was not kept off');
      made.push(setHw('Reminders 1', s, s + W), setHw('Reminders 2', s, s + W));
      if (mine().length !== 1 || mine()[0].minutes !== 15) throw new Error(mine().length + ' checks, every ' + (mine()[0] || {}).minutes + ' minutes');
      if (made[1].remind !== 'on' || made[1].remindWhy) throw new Error('the answer: ' + JSON.stringify([made[1].remind, made[1].remindWhy]));
      const said = withClassroom(() => alertOf(() => checkSetup()));
      if (!/✅  homework reminders: checked every 15 minutes/.test(said) || /started just now/.test(said)) throw new Error('🩺: ' + said.slice(-600));
      mine().forEach(t => ScriptApp.deleteTrigger(t));            /* deleted by hand in the editor */
      const again = withClassroom(() => alertOf(() => checkSetup()));
      if (mine().length !== 1 || !/✅  homework reminders: checked every 15 minutes \(started just now\)/.test(again)) throw new Error('🩺 did not start it again: ' + mine().length);
      if (TRIGGERS.filter(t => t.getHandlerFunction() === 'sendDueSummaries').length !== daily) throw new Error('the morning email changed');
    } finally { made.forEach(x => homeworkDelete(x.made[0])); mine().forEach(t => ScriptApp.deleteTrigger(t)); }
  });
  ok &= run('the list sorts by due date or by class, remembered in this browser; the 🔔 line and switch; the form asks about reminders, ticked by default', () => {
    const now = Date.now(), iso = days => new Date(now + days * 864e5).toISOString();
    const hw = (id, c, days) => ({ id, title: 'Homework ' + id, who: c || '2 students', what: 'Digestion: Mouth and teeth', teacher: OWNER,
      due: days === null ? null : iso(days), dueText: days === null ? '' : 'a day', overdue: days !== null && days < 0, soon: false, dueBad: days === null,
      targets: c ? { cls: c } : { emails: ['a@x.kr', 'b@x.kr'] }, tasks: [], pupils: [], tally: { done:0, partly:0, none:0 }, missing: [],
      setCount: 0, gone: 0, joined: 0, created: iso(-10),
      remind: { on: true, can: true, bad: false, says: '1: sent to 4 · 2: waiting', plan: 'Reminder 1: sent on 1 Oct, 17:00 to 4 pupils. Reminder 2: about 2 Oct, 09:00, to the pupils who have not finished then.' } });
    const D = { labs: [], students: [], english: null, classroomOk: true, manifestOk: true, hubSet: true, remindAllowed: true,
      homework: [ hw('A', '10B', 2), hw('B', '9A', 5), hw('C', '9A', -1), hw('D', '', 1), hw('E', '10B', -3), hw('F', '9A', null) ] };
    const order = h => [...h.matchAll(/class="hw__h"[^>]*data-hw="([^"]+)"/g)].map(m => m[1]).join('');
    const store = { m: {}, getItem(k) { return k in this.m ? this.m[k] : null; }, setItem(k, v) { this.m[k] = String(v); } };
    const page = teacherPage(); page.win.localStorage = store; page.win.vHomework(D);
    let html = page.html();
    if (!/data-hsort="due" aria-pressed="true">Due date</.test(html) || !/data-hsort="class" aria-pressed="false">Class</.test(html)) throw new Error('no “Sort by: Due date · Class” switch, on Due date');
    /* not yet due, soonest first; no readable date last; past its due date: in the Archive (7 Oct 2026), folded */
    if (order(html) !== 'DABF') throw new Error('by due date: ' + order(html));
    page.press('data-arch', '1'); html = page.html();       /* the Archive, opened: the most recent first, sorted as the list is */
    if (order(html) !== 'DABFCE') throw new Error('by due date, the Archive open: ' + order(html));
    page.press('data-arch', '1'); html = page.html();
    page.press('data-hsort', 'class'); html = page.html();
    if (order(html) !== 'BFAD') throw new Error('by class: ' + order(html));
    const groups = [...html.matchAll(/<span class="coh__t">([^<]+)<\/span>/g)].map(m => m[1]);
    if (groups.join('|') !== '9A|10B|Chosen pupils') throw new Error('the groups: ' + groups.join('|'));
    if (store.m['homework.sort'] !== 'class') throw new Error('the choice was not remembered');
    const page2 = teacherPage(); page2.win.localStorage = store; page2.win.vHomework(D);   /* a reload */
    if (order(page2.html()) !== 'BFAD') throw new Error('not remembered after a reload: ' + order(page2.html()));
    page2.press('data-arch', '1');
    if (order(page2.html()) !== 'BFADCE') throw new Error('by class, the Archive open: ' + order(page2.html()));
    if ([...page2.html().matchAll(/<span class="coh__t">([^<]+)<\/span>/g)].map(m => m[1]).join('|') !== '9A|10B|Chosen pupils|9A|10B')
      throw new Error('the Archive is not grouped by class as the list is');
    const page3 = teacherPage();                                 /* storage blocked: still drawn, by due date, and the switch works */
    page3.win.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    page3.win.vHomework(D);
    if (order(page3.html()) !== 'DABF') throw new Error('with storage blocked: ' + order(page3.html()));
    page3.press('data-hsort', 'class'); if (order(page3.html()) !== 'BFAD') throw new Error('the switch failed with storage blocked');
    /* the 🔔 line; opened, the plan and the switch, which asks the server */
    if (!/class="hw__r">🔔 1: sent to 4 · 2: waiting</.test(html)) throw new Error('no 🔔 line');
    const CALLS = [];
    const gsr = new Proxy({}, { get: (t, k) => (k === 'withSuccessHandler' || k === 'withFailureHandler') ? (() => gsr) : (...args) => { CALLS.push([k, args]); } });
    page.win.google = { script: { run: gsr } };
    page.press('data-hw', 'A'); html = page.html();
    if (!/🔔 Reminder 1: sent on 1 Oct, 17:00 to 4 pupils/.test(html) || !/data-remind="A" data-on="0">Switch reminders off</.test(html)) throw new Error('no plan or switch on an opened homework');
    page.press('data-remind', 'A');
    if (!CALLS.length || CALLS[0][0] !== 'homeworkRemind' || CALLS[0][1][0].id !== 'A' || CALLS[0][1][0].on !== false) throw new Error('the switch sent ' + JSON.stringify(CALLS));
    const D2 = JSON.parse(JSON.stringify(D)); D2.remindAllowed = false;
    const page4 = teacherPage(); page4.win.vHomework(D2);
    if (!/The reminders cannot be posted: Google has not been allowed/.test(page4.html())) throw new Error('no warning when the permission is missing');
    /* the form: the reminder box under the Classroom box, ticked by default; what it sends, ticked and unticked */
    const r0 = homeworkCreate({ title:'Refill for reminders', classes:[{ cls, due:'2027-03-05' }], tasks:[{ labId:'digestion-lab', stationIds:['mouth'] }] });
    try {
      const real = JSON.parse(JSON.stringify(uiData('homework').data)); real.classroomOk = true;
      const sentWith = untick => {
        const got = [];
        const g2 = new Proxy({}, { get: (t, k) => (k === 'withSuccessHandler' || k === 'withFailureHandler') ? (() => g2) : (...args) => { got.push([k, args]); } });
        const p = teacherPage(); p.win.google = { script: { run: g2 } }; p.win.vHomework(real);
        p.press('data-hw', r0.made[0]); p.press('data-again', r0.made[0]);
        p.fire('input', 'data-due', '0', '2027-03-06');
        if (!/<input type="checkbox" id="hremind" checked><span>Remind pupils who have not finished \(2 reminders before the due time\)<\/span>/.test(p.html()))
          throw new Error('no reminder box under “Post it in Google Classroom too”, ticked');
        if (untick) p.fire('change', 'id', 'hremind', false);
        p.press('id', 'hset');
        const c = got.filter(x => x[0] === 'homeworkCreate')[0];
        if (!c) throw new Error('Set homework sent nothing');
        return c[1][0];
      };
      const a1 = sentWith(false), a2 = sentWith(true);
      if (a1.remind !== true || !a1.post) throw new Error('ticked, it sent ' + JSON.stringify([a1.post, a1.remind]));
      if (a2.remind !== false || !a2.post) throw new Error('unticked, it sent ' + JSON.stringify([a2.post, a2.remind]));
      const p5 = teacherPage(); p5.win.vHomework(real); p5.fire('change', 'id', 'hpost', false);
      if (/id="hremind"/.test(p5.html())) throw new Error('a reminder box with no Classroom post');
    } finally { homeworkDelete(r0.made[0]); }
  });
}
/* ── ⏱️ Homework habits, part 1 (Daniel, 1 Oct 2026, night) ──────────────────────────────────────────────────────────
   Each save notes when each station (and each Bio English set) was FIRST tried and FIRST finished, inside the one read and
   one write it always made; "finished" is the homework scorer's own verdict. The teacher page's ⏱️ Homework habits reads
   those times: a band per homework and pupil, ⏰ after a reminder, a habit line, and neutral "worth a look" flags. No
   measure of time spent: the span is from the first try to the finish, between two saves. */
console.log('— ⏱️ homework habits —');
{
  const habCid = CLIENT_ID, habTok = TOKEN_EMAIL, habMan = MANIFEST_JSON, realOpen = SpreadsheetApp.openById;
  CLIENT_ID = 'CID'; VISITOR = OWNER; SCHOOL_DOMAIN = 'x.kr';
  const KST = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 9, mi || 0);
  const MAN = (mouth, stomach) => JSON.stringify({ generated:'t', labs: { 'digestion-lab': { name:'Digestion', questions:123,
    stations:[ {id:'mouth',name:'Mouth and teeth',questions:mouth}, {id:'stomach',name:'Stomach',questions:stomach} ] } } });
  const setMan = j => { MANIFEST_JSON = j; for (const k of Array.from(cacheStore.keys())) if (/^STATIONS_MANIFEST_/.test(k)) cacheStore.delete(k); };
  setMan(MAN(8, 9));
  const HCLS = '9H', HCOURSE = 'cH';
  const people = ['Ana', 'Ben', 'Cal', 'Dov', 'Eve', 'Fay', 'Gus'].map((n, i) => ({ name: 'Hab ' + n, email: 'hab' + i + '@x.kr', userId: 'uh' + i }));
  _upsertStudents_(people, HCLS, 'Y9 Habits', HCOURSE);
  _seedLab_(LABS.filter(l => l.id === 'digestion-lab')[0]);
  const E = people.map(p => p.email);
  const dig = () => ss.getSheetByName('Digestion');
  const rowOf = email => { const sh = dig(), n = sh.getLastRow() - 1, v = sh.getRange(2, 1, n, LAB_COLS.length).getValues();
    for (let i = 0; i < n; i++) if (String(v[i][LAB_EMAIL - 1]).toLowerCase() === email) return { r: i + 2, v: v[i] };
    throw new Error('no Digestion row for ' + email); };
  const timesOf = email => _stParse_(rowOf(email).v[LAB_TIMES - 1]);
  const save = (email, stations, more) => { TOKEN_EMAIL = email;
    try { return String(doPost({ postData: { contents: JSON.stringify(Object.assign({ app: 'digestion-lab', token: TOK, name: 'Hab',
      score: 0, total: QN, complete: false, stations: stations }, more || {})) } })); } finally { TOKEN_EMAIL = habTok; } };
  const setRow = (email, per, first, times) => { const r = rowOf(email).r, sh = dig();
    sh.getRange(r, 14).setValue(per || ''); sh.getRange(r, LAB_FIRST).setValue(first || '');
    sh.getRange(r, LAB_TIMES).setValue(times ? JSON.stringify(times) : ''); };
  /* every range call a function makes, and on which tab */
  const counted = fn => { const seen = [], orig = Sheet.prototype.getRange, c0 = __CALLS;
    Sheet.prototype.getRange = function (...a) { seen.push(this.name); return orig.apply(this, a); };
    let out; try { out = fn(); } finally { Sheet.prototype.getRange = orig; }
    return { out, calls: __CALLS - c0, on: name => seen.filter(n => n === name).length }; };
  /* homework of our own for the pupils given, on mouth (8) + stomach (9), set at S and due at D; posted in course HCOURSE
     with its reminders as given ([when, what the row says]) */
  const made = [];
  const mkHw = (title, S, D, emails, o) => {
    o = o || {};
    const r = homeworkCreate({ title, classes: [{ cls: '', due: '2027-06-01', emails }], tasks: [{ labId: 'digestion-lab', stationIds: ['mouth', 'stomach'] }] });
    if (!r.ok) throw new Error('could not set it: ' + r.why);
    const id = r.made[0], sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh), row = _homeworkRows_().filter(h => h.id === id)[0].row;
    made.push(id);
    sh.getRange(row, hc.Created).setValue(new Date(S)); sh.getRange(row, hc.Due).setValue(new Date(D));
    if (o.course) { sh.getRange(row, hc.Course).setValue(o.course); sh.getRange(row, hc.CourseWork).setValue('cw-' + id); }
    (o.rem || []).forEach((x, i) => { if (!x) return;
      sh.getRange(row, hc['Reminder ' + (i + 1)]).setValue(new Date(x[0])); sh.getRange(row, hc['Reminder ' + (i + 1) + ' students']).setValue(x[1]); });
    return id;
  };
  const L = (S, D, share) => S + Math.round(share * (D - S));
  const cellOf = (d, id, name) => { const h = d.homework.findIndex(x => x.id === id), p = d.pupils.filter(x => x.name === name)[0];
    return p ? (p.cells.filter(c => c[0] === h)[0] || null) : null; };
  const DONE = 'mouth 8/8 in 9 · stomach 9/9 in 12', HALF = 'mouth 3/8 in 4 · stomach 0/9';
  const ALLF = 'mouth~8:aa:ffffffff|stomach~9:bb:fffffffff';
  try {
    ok &= run('habits: a save notes when each station was first tried and first finished, in the one read and one write it always made (5 range calls, 3 on the lab tab)', () => {
      const e = E[0], t0 = Date.now();
      let out = save(e, { mouth: '0/8 in 2', stomach: '0/9' });
      if (!/^recorded/.test(out)) throw new Error(out);
      let t = timesOf(e);
      if (!t.mouth || !(t.mouth[0] >= t0 && t.mouth[0] <= Date.now()) || t.mouth[1] !== 0) throw new Error('mouth, tried: ' + JSON.stringify(t));
      if (t.stomach) throw new Error('a station not tried has a time: ' + JSON.stringify(t));
      /* an older first try stays: a first time is never overwritten */
      dig().getRange(rowOf(e).r, LAB_TIMES).setValue(JSON.stringify({ mouth: [111, 0] }));
      const t1 = Date.now(), c = counted(() => save(e, { mouth: '8/8 in 9', stomach: '3/9 in 3' }));
      if (!/^recorded/.test(c.out)) throw new Error(c.out);
      t = timesOf(e);
      if (t.mouth[0] !== 111) throw new Error('the first try was overwritten: ' + JSON.stringify(t.mouth));
      if (!(t.mouth[1] >= t1)) throw new Error('mouth was finished and has no time: ' + JSON.stringify(t.mouth));
      if (!(t.stomach && t.stomach[0] >= t1 && t.stomach[1] === 0)) throw new Error('stomach: ' + JSON.stringify(t.stomach));
      /* measured on the code from before this change (1 Oct 2026): 5 range calls, 3 on the lab tab (the address column, the
         row read, the row write) and 2 on the Students tab (who this is) */
      if (c.calls !== 5 || c.on('Digestion') !== 3) throw new Error('a save now costs ' + c.calls + ' range calls (' + c.on('Digestion') + ' on the lab tab), want 5 (3)');
      const again = _stNext_(JSON.stringify({ a: [5, 7] }), { a: { tried: true, done: true } }, { a: { tried: true, done: true } }, 99);
      if (again !== JSON.stringify({ a: [5, 7] })) throw new Error('a later save moved a first time: ' + again);
    });
    ok &= run('habits: "finished" is exactly the homework scorer\'s verdict, station by station, whatever the lab says', () => {
      const e = E[1];
      const scorer = sid => _hwScoreOne_({ tasks: [{ labId: 'digestion-lab', stationIds: [sid] }] }, e,
                                         _hwLabIndex_(['digestion-lab'], { [e]: 1 }), _hwManifest_()).state;
      setMan(MAN(8, 10));                                         /* the list says stomach has 10 questions; the lab says 9/9 */
      save(e, { mouth: '8/8 in 8', stomach: '9/9 in 12' });
      let t = timesOf(e);
      if (!(t.mouth[1] > 0) || scorer('mouth') !== 'done') throw new Error('mouth: ' + JSON.stringify(t.mouth) + ' ' + scorer('mouth'));
      if (t.stomach[1] !== 0 || scorer('stomach') === 'done') throw new Error('stomach, 9 of the list\'s 10, was taken as finished: ' + JSON.stringify(t.stomach));
      setMan(MAN(8, 9));                                          /* the list agrees now: finished at or before this save */
      const t1 = Date.now();
      save(e, { mouth: '8/8 in 8', stomach: '9/9 in 12' });
      t = timesOf(e);
      if (scorer('stomach') !== 'done' || !(t.stomach[1] < 0 && -t.stomach[1] >= t1)) throw new Error('stomach once the list agrees: ' + JSON.stringify(t.stomach));
      save(e, { mouth: '8/8 in 8', stomach: '9/9 in 12', ghost: '5/5 in 5' });  /* a station the list does not have */
      t = timesOf(e);
      if (!t.ghost || t.ghost[1] !== 0) throw new Error('a station the list lacks was finished: ' + JSON.stringify(t.ghost));
    });
    ok &= run('habits: work already saved when the times began is "at or before" that save (a negative time), never a time it was not done', () => {
      const e = E[2];
      setRow(e, 'mouth 8/8 in 9 · stomach 2/9 in 2', '', null);         /* saved before the paste: no times */
      const t1 = Date.now();
      save(e, { mouth: '8/8 in 9', stomach: '3/9 in 4' });
      const t = timesOf(e);
      if (!(t.mouth[0] < 0 && t.mouth[1] < 0 && -t.mouth[0] >= t1 && -t.mouth[1] >= t1)) throw new Error('mouth: ' + JSON.stringify(t.mouth));
      if (!(t.stomach[0] < 0 && t.stomach[1] === 0)) throw new Error('stomach: ' + JSON.stringify(t.stomach));
    });
    ok &= run('habits: a times cell never passes 45,000 characters (a cell holds 50,000): nothing new is kept, and nothing kept is lost', () => {
      const big = {}; let i = 0;
      while (JSON.stringify(big).length < ST_CAP - 30) big['s' + (i++)] = [1759300000000, 1759300000001];
      const cell = JSON.stringify(big);
      if (_stNext_(cell, {}, { mouth: { tried: true, done: true } }, 1759400000000) !== cell) throw new Error('the full cell changed');
      const small = _stNext_(JSON.stringify({ a: [5, 0] }), {}, { a: { tried: true, done: true }, b: { tried: true } }, 9);
      if (small !== JSON.stringify({ a: [5, 9], b: [9, 0] })) throw new Error('under the cap: ' + small);
      const e = E[3];
      dig().getRange(rowOf(e).r, LAB_TIMES).setValue(cell);
      const out = save(e, { mouth: '2/8 in 2', stomach: '0/9' });
      if (!/^recorded/.test(out)) throw new Error(out);
      if (rowOf(e).v[LAB_TIMES - 1] !== cell) throw new Error('a save changed the full cell');
    });
    ok &= run('habits: a save never fails because of the times — a step that throws, no station list, an unreadable cell', () => {
      const e = E[4], keepNext = _stNext_, keepMan = _manifest_;
      try {
        _stNext_ = () => { throw new Error('boom'); };
        dig().getRange(rowOf(e).r, LAB_TIMES).setValue('{"mouth":[5,0]}');
        let out = save(e, { mouth: '4/8 in 4', stomach: '0/9' }, { score: 4 });
        if (!/^recorded/.test(out)) throw new Error('a broken times step failed the save: ' + out);
        let v = rowOf(e).v;
        if (v[2] !== 4 || v[LAB_TIMES - 1] !== '{"mouth":[5,0]}') throw new Error('the save was not written as before: ' + v[2] + ' ' + v[LAB_TIMES - 1]);
        _stNext_ = keepNext;
        _manifest_ = () => { throw new Error('no list'); };
        out = save(e, { mouth: '8/8 in 9', stomach: '0/9' }, { score: 8 });
        if (!/^recorded/.test(out)) throw new Error('no station list failed the save: ' + out);
        v = rowOf(e).v;
        const m = _stParse_(v[LAB_TIMES - 1]).mouth;
        if (m[0] !== 5 || m[1] !== 0) throw new Error('with no station list to judge by, it was called finished: ' + JSON.stringify(m));
        _manifest_ = keepMan;
        dig().getRange(rowOf(e).r, LAB_TIMES).setValue('{oops');
        out = save(e, { mouth: '8/8 in 9', stomach: '1/9 in 1' }, { score: 9 });
        if (!/^recorded/.test(out)) throw new Error('an unreadable cell failed the save: ' + out);
        const t = timesOf(e);
        if (!(t.mouth[0] < 0 && t.mouth[1] < 0 && t.stomach[0] > 0)) throw new Error('an unreadable cell was not started again: ' + JSON.stringify(t));
      } finally { _stNext_ = keepNext; _manifest_ = keepMan; }
    });
    ok &= run('habits: Bio English sets are timed the same way, inside the same one read and one write (7 range calls, 5 on its tab)', () => {
      const e = E[5];
      const en = d => { TOKEN_EMAIL = e; try { return JSON.parse(doPost({ postData:{ contents: JSON.stringify({ action:'english.save', token: TOK, sets:{ 't3.kw.meanings': d } }) } })); }
                        finally { TOKEN_EMAIL = habTok; } };
      const setTimes = () => { const sh = ss.getSheetByName(T_ENGLISH), v = sh.getRange(2, 1, sh.getLastRow() - 1, EN_TIMES).getValues();
        const r = v.filter(x => String(x[EN_EMAIL - 1]).toLowerCase() === e)[0]; return r ? _stParse_(r[EN_TIMES - 1]) : null; };
      const t0 = Date.now();
      if (!en({ done:1, first:1, total:4, snap:'f000', v:'k1' }).ok) throw new Error('the first save');
      let t = setTimes();
      if (!t || !t['t3.kw.meanings'] || !(t['t3.kw.meanings'][0] >= t0) || t['t3.kw.meanings'][1] !== 0) throw new Error('tried: ' + JSON.stringify(t));
      const c = counted(() => en({ done:4, first:3, total:4, snap:'ff1f', v:'k1' }));
      if (!c.out.ok) throw new Error(JSON.stringify(c.out));
      const x = setTimes()['t3.kw.meanings'];
      if (!(x[0] >= t0 && x[1] >= x[0])) throw new Error('finished: ' + JSON.stringify(x));
      /* measured on the code from before this change: 7 range calls, 5 on ✍️ Bio English and 2 on the Students tab */
      if (c.calls !== 7 || c.on(T_ENGLISH) !== 5) throw new Error('a Bio English save now costs ' + c.calls + ' range calls (' + c.on(T_ENGLISH) + ' on its tab), want 7 (5)');
      const keep = _stEnState_;
      try { _stEnState_ = () => { throw new Error('boom'); };
        if (!en({ done:4, first:3, total:4, snap:'ff1f', v:'k1' }).ok) throw new Error('a broken times step failed a Bio English save');
      } finally { _stEnState_ = keep; }
    });
    ok &= run('habits: the bands at their edges, on a fake clock: before, early (50%), in good time (85%, when reminder 2 is due), last minute, late; not done; still open', () => {
      const S = KST(2027, 3, 1, 9, 0), D = S + 100000, at = F => _hwHabitCat_(S, D, { at: F }, D + 5);
      [[S - 1, 'before'], [S, 'early'], [S + 50000, 'early'], [S + 50001, 'good'], [S + 85000, 'good'], [S + 85001, 'last'], [D, 'last'], [D + 1, 'late']]
        .forEach(([F, c]) => { if (at(F) !== c) throw new Error('finished at S+' + (F - S) + ': ' + at(F) + ', want ' + c); });
      if (_hwHabitCat_(S, D, null, D) !== 'open' || _hwHabitCat_(S, D, null, D + 1) !== 'none') throw new Error('not finished: still open until the due time, not done after it');
      if (_hwHabitCat_(S, D, { hi: S - 1 }, D) !== 'before' || _hwHabitCat_(S, D, { hi: S + 10 }, D) !== 'unknown') throw new Error('a finish known only as "at or before"');
      if (HW_BAND_GOOD !== HW_REMIND_AT[1]) throw new Error('"in good time" no longer ends when reminder 2 is due');
      const W = 7 * 864e5, s = KST(2027, 3, 1, 15, 0);
      if (_hwRemindTime_(s, s + W, 2).at !== _hwBandAt_(s, s + W, HW_BAND_GOOD)) throw new Error('the 85% edge and reminder 2 disagree');
    });
    ok &= run('habits: the view puts each pupil in a band from the recorded times; before the due time a pupil not finished is still open', () => {
      const S = KST(2027, 4, 5, 9, 0), D = S + 7 * 864e5, now = D + 3600e3;
      const id = mkHw('Habits bands', S, D, E.slice(0, 6));
      const fin = (t, f) => ({ mouth: [t, f], stomach: [t + 1000, f - 1000] });
      setRow(E[0], DONE, ALLF, fin(S - 864e5, S - 3600e3));
      setRow(E[1], DONE, ALLF, fin(S + 1000, L(S, D, 0.5)));
      setRow(E[2], DONE, ALLF, fin(S + 1000, L(S, D, 0.85)));
      setRow(E[3], DONE, ALLF, fin(S + 1000, D));
      setRow(E[4], DONE, ALLF, fin(S + 1000, D + 60000));
      setRow(E[5], HALF, '', { mouth: [S + 1000, 0] });
      const d = _habitsData_(now);
      ['before', 'early', 'good', 'last', 'late', 'none'].forEach((c, i) => {
        const x = cellOf(d, id, people[i].name); if (!x || x[1] !== c) throw new Error(people[i].name + ': ' + JSON.stringify(x) + ', want ' + c); });
      if (!d.recorded) throw new Error('times were recorded, and the view says none');
      const x1 = cellOf(d, id, people[1].name);
      if (x1[3] !== 21 || x1[4] !== 17 || x1[5] !== 17 || x1[6] !== 2 || x1[8] !== '3 days 12 h') throw new Error('checks, right first time, the span: ' + JSON.stringify(x1));
      if (cellOf(_habitsData_(D - 1), id, people[5].name)[1] !== 'open') throw new Error('before the due time a pupil not finished is not "still open"');
      if (/@/.test(JSON.stringify(d))) throw new Error('an address reached the page');
    });
    ok &= run('habits: ⏰ — finished after a reminder had gone to them: it went, they were not done then, and they are in its Classroom course', () => {
      const S = KST(2027, 5, 3, 9, 0), D = S + 7 * 864e5, R1 = L(S, D, 0.7), R2 = L(S, D, 0.85), now = D + 3600e3;
      const id = mkHw('Habits reminders', S, D, E.slice(0, 5), { course: HCOURSE, rem: [[R1, '4'], [R2, '2']] });
      const fin = f => ({ mouth: [S + 1000, f], stomach: [S + 2000, f - 1] });
      setRow(E[0], DONE, ALLF, fin(R1 - 60000));
      setRow(E[1], DONE, ALLF, fin(R1 + 60000));
      setRow(E[2], DONE, ALLF, fin(R2 + 60000));
      setRow(E[3], DONE, ALLF, fin(R2 + 60000));
      setRow(E[4], HALF, '', { mouth: [S + 1000, 0] });
      const st = ss.getSheetByName('Students'), ec = _emailCol_(st), cc = _headerCol_(st, 'Course id', ec + 4);
      const r3 = st.getRange(2, 1, st.getLastRow() - 1, ec).getValues().findIndex(r => String(r[ec - 1]).toLowerCase() === E[3]) + 2;
      const keepCourse = st.getRange(r3, cc).getValue();
      if (keepCourse !== HCOURSE) throw new Error('the pupils were not imported into ' + HCOURSE + ': ' + keepCourse);
      st.getRange(r3, cc).setValue('another-course');
      try {
        const d = _habitsData_(now), r = i => (cellOf(d, id, people[i].name) || [])[2];
        if ([0, 1, 2, 3, 4].map(r).join(',') !== '0,1,2,0,0') throw new Error('⏰: ' + [0, 1, 2, 3, 4].map(r).join(','));
        const sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh), row = _homeworkRows_().filter(h => h.id === id)[0].row;
        sh.getRange(row, hc['Reminder 1 students']).setValue('not sent: Classroom is busy');
        sh.getRange(row, hc['Reminder 2 students']).setValue('skipped: the due time had passed');
        const d2 = _habitsData_(now);
        if ([1, 2].some(i => cellOf(d2, id, people[i].name)[2] !== 0)) throw new Error('⏰ for a reminder that never went');
        if (_homeworkRows_().filter(h => h.id === id)[0].rem.some(x => /hab/i.test(x.said))) throw new Error('a name in the row');
      } finally { st.getRange(r3, cc).setValue(keepCourse); }
    });
    ok &= run('habits: the habit line — one table of rules in Daniel\'s words, the first that holds wins, from the last 6 with a band', () => {
      const want = ['Usually early', 'Usually in good time', 'Usually the last minute', 'Often late or not done', 'Only after a reminder', 'Getting better', 'Getting worse', 'Mixed'];
      if (HW_HABIT_RULES.map(r => r.say).sort().join('|') !== want.slice().sort().join('|')) throw new Error('the phrases: ' + HW_HABIT_RULES.map(r => r.say).join(', '));
      if (HW_HABIT_RULES.some(r => !r.when || typeof r.test !== 'function')) throw new Error('a rule with no words or no test');
      const R = c => ({ c, r: 1 }), say = cs => { const h = _hwHabitOf_(cs.map(c => typeof c === 'string' ? { c, r: 0 } : c)); return h ? h.say : null; };
      [[['early', 'early', 'before', 'early'], 'Usually early'],
       [['good', 'early', 'good', 'good', 'last'], 'Usually in good time'],
       [['last', 'last', 'good', 'last'], 'Usually the last minute'],
       [['late', 'none', 'good', 'early', 'late', 'none'], 'Often late or not done'],
       [[R('good'), R('last'), 'early', R('good')], 'Only after a reminder'],
       [[R('last'), R('last'), R('good'), R('last')], 'Usually the last minute'],   /* after 85% is always after reminder 2: last minute is asked first */
       [['none', 'none', 'late', 'good', 'early', 'good'], 'Getting better'],
       [['early', 'good', 'early', 'late', 'none', 'late'], 'Getting worse'],
       [['early', 'last', 'good', 'late'], 'Mixed'],
       [['early', 'early'], null],
       [['open', 'unknown', 'early', 'early'], null],
       [['none', 'none', 'none', 'none', 'early', 'early', 'early', 'early', 'early', 'early'], 'Usually early']
      ].forEach(([cs, w]) => { const got = say(cs); if (got !== w) throw new Error(JSON.stringify(cs) + ': ' + got + ', want ' + w); });
      const h = _hwHabitOf_(['late', 'none', 'late'].map(c => ({ c, r: 0 })));
      if (!/late or not done in at least half/.test(h.why) || !/Their last 3 homework: 2 late, 1 not done\./.test(h.why)) throw new Error('the words: ' + h.why);
    });
    ok &= run('habits: "worth a look" — under a third of the median, 90%+ right first time, and a low baseline: each edge, and the words say which baseline', () => {
      const cell = (sm, f) => ({ sm, f, q: 17, n: 2, m: 0 });
      const low = { pct: 38, n: 2 }, MED = 864e5, fast = 9 * 60e3;
      const says = _hwHabitFlag_(cell(fast, 17), MED, low, []);
      if (says !== 'Finished 2 stations within 9 min of the first try (median for this homework: 1 day), all right first time; teacher-marked tests average 38% (2 papers).')
        throw new Error('the words: ' + says);
      if (_hwHabitFlag_(cell(MED / 3, 17), MED, low, [])) throw new Error('a third of the median exactly is not under it');
      if (_hwHabitFlag_(cell(fast, 15), MED, low, [])) throw new Error('88% right first time was flagged');
      if (!/94% right first time/.test(_hwHabitFlag_(cell(fast, 16), MED, low, []))) throw new Error('94% is 90% or more');
      if (_hwHabitFlag_(cell(fast, 17), MED, { pct: 50, n: 3 }, [])) throw new Error('a 50% average is not under 50%');
      if (_hwHabitFlag_(cell(fast, 17), null, low, [])) throw new Error('flagged with no median (fewer than 3 with times)');
      const earlier = [{ q: 10, f: 3, e: 5 }, { q: 10, f: 4, e: -5 }, { q: 10, f: 10, e: 0 }];
      const fb = _hwHabitFlag_(cell(fast, 17), MED, null, earlier);
      if (!/; right first time on their earlier homework: median 35% \(2 homework\)\.$/.test(fb)) throw new Error('the fallback: ' + fb);
      if (_hwHabitFlag_(cell(fast, 17), MED, null, earlier.slice(0, 1))) throw new Error('flagged from one earlier homework');
      if (/cheat|copied|suspicious|dishonest/i.test(says + fb)) throw new Error('the words accuse');
    });
    ok &= run('habits: the baseline is the teacher-marked test average in the tracker (three kinds of score: partly self-reported counts, self-reported never), else the earlier homework', () => {
      const S = KST(2027, 6, 7, 9, 0), D = S + 7 * 864e5, now = D + 3600e3;
      const id = mkHw('Habits flags', S, D, E.slice(0, 5));
      const span = ms => ({ mouth: [S + 3600e3, S + 3600e3 + ms], stomach: [S + 3600e3 + 1, S + 3600e3 + ms - 1] });
      setRow(E[0], DONE, ALLF, span(9 * 60e3));
      setRow(E[1], DONE, ALLF, span(2 * 864e5));
      setRow(E[2], DONE, ALLF, span(864e5));
      setRow(E[3], DONE, ALLF, span(3 * 864e5));
      setRow(E[4], DONE, ALLF, span(4 * 3600e3));
      const tss = new SS(), tab = tss.insertSheet('Class of 2029'), other = tss.insertSheet('TEST');
      const src = (o, q) => JSON.stringify(Object.assign({ overall: o, mcq: o, written: o }, q ? { questions: q } : {}));
      [['Email', 'StudentName', 'Class', 'AssessmentID', 'AssessmentDate', 'TotalScore', 'MaxScore', 'ScoreSource'],
       [E[0], 'x', HCLS, 'A1', '', 28, 80, src('teacher', 'teacher')],
       [E[0], 'x', HCLS, 'A2', '', 33, 80, ''],
       [E[0], 'x', HCLS, '', '', 80, 80, ''],
       [E[0], 'x', HCLS, 'A3', '', '', 80, src('teacher')],
       [E[2], 'x', HCLS, 'A1', '', 70, 80, src('teacher', 'self')],
       [E[3], 'x', HCLS, 'A1', '', 10, 80, src('self')]].forEach((r, i) => r.forEach((v, j) => tab.getRange(i + 1, j + 1).setValue(v)));
      [['Email', 'AssessmentID', 'TotalScore', 'MaxScore'], [E[4], 'T1', 1, 80]].forEach((r, i) => r.forEach((v, j) => other.getRange(i + 1, j + 1).setValue(v)));
      props.set('TRACKER_ID', 'HABITS-TRACKER');
      SpreadsheetApp.openById = x => x === 'HABITS-TRACKER' ? tss : realOpen(x);
      try {
        const b = _hwBaselines_({ [E[0]]: 1, [E[2]]: 1, [E[3]]: 1, [E[4]]: 1 });
        if (!b[E[0]] || b[E[0]].pct !== 38 || b[E[0]].n !== 2) throw new Error('teacher marked (two papers; a stub and an unmarked paper left out): ' + JSON.stringify(b[E[0]]));
        if (!b[E[2]] || b[E[2]].pct !== 88) throw new Error('partly self-reported counts: ' + JSON.stringify(b[E[2]]));
        if (b[E[3]]) throw new Error('a self-reported paper was counted: ' + JSON.stringify(b[E[3]]));
        if (b[E[4]]) throw new Error('the TEST tab was read: ' + JSON.stringify(b[E[4]]));
        const d = _habitsData_(now), h = d.homework.findIndex(x => x.id === id), pupil = n => d.pupils.filter(p => p.name === people[n].name)[0];
        if (d.homework[h].med !== '1 day') throw new Error('the median: ' + d.homework[h].med);
        const f0 = pupil(0).flags.filter(f => f.h === h);
        if (f0.length !== 1 || !/within 9 min of the first try .*teacher-marked tests average 38% \(2 papers\)\.$/.test(f0[0].says)) throw new Error('the flag: ' + JSON.stringify(f0));
        if (pupil(0).base !== 'Teacher-marked tests average 38% (2 papers)') throw new Error('the baseline line: ' + pupil(0).base);
        if (pupil(2).flags.some(f => f.h === h)) throw new Error('an 88% average was flagged');
        /* Hab Eve: 4 h, all right first time, no marked paper; her earlier finished homework were all right first time */
        if (pupil(4).flags.some(f => f.h === h)) throw new Error('flagged against a high earlier-homework baseline');
        if (pupil(4).base !== '') throw new Error('a baseline from the TEST tab: ' + pupil(4).base);
      } finally { SpreadsheetApp.openById = realOpen; props.delete('TRACKER_ID'); }
    });
    ok &= run('habits: no times yet, no homework, and homework with no due time — said plainly, never an error', () => {
      const keep = ss.getSheetByName(T_HOMEWORK);
      ss.deleteSheet(keep);
      try {
        const d = _habitsData_(Date.now());
        if (d.homework.length || d.pupils.length || d.recorded) throw new Error('something from nothing: ' + JSON.stringify(d).slice(0, 160));
        if (ss.getSheetByName(T_HOMEWORK)) throw new Error('reading the view made a Homework tab');
      } finally { if (ss.getSheetByName(T_HOMEWORK)) ss.deleteSheet(ss.getSheetByName(T_HOMEWORK)); ss.sheets.push(keep); }
      const S = KST(2027, 7, 5, 9, 0), id = mkHw('Habits no times', S, S + 864e5, [E[6]]);
      setRow(E[6], HALF, '', null);
      const d = _habitsData_(S + 2 * 864e5), x = cellOf(d, id, people[6].name);
      if (!x || x[1] !== 'none') throw new Error('a pupil with no times who did not finish: ' + JSON.stringify(x));
      const sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh), row = _homeworkRows_().filter(h => h.id === id)[0].row;
      sh.getRange(row, hc.Due).setValue('next Friday');
      const d2 = _habitsData_(S + 2 * 864e5);
      if (d2.homework.some(x2 => x2.id === id) || !(d2.left >= 1)) throw new Error('homework with no due time was not left out and counted');
    });
    ok &= run('habits: the view is behind the teacher gate like every view, and reads nothing it writes', () => {
      VISITOR = 'hab0@pupils.x.kr';
      try { const r = uiData('habits'); if (r.ok !== false || r.data) throw new Error('a pupil read the habits: ' + JSON.stringify(r).slice(0, 120)); }
      finally { VISITOR = OWNER; }
      const before = JSON.stringify(dig().getRange(1, 1, dig().getLastRow(), LAB_COLS.length).getValues()) +
                     JSON.stringify(ss.getSheetByName(T_HOMEWORK).getRange(1, 1, ss.getSheetByName(T_HOMEWORK).getLastRow(), _HW_HEADERS_.length).getValues());
      const t = uiData('habits');
      if (!t.ok || !t.data || !Array.isArray(t.data.pupils) || !t.data.pupils.length) throw new Error('a teacher was refused: ' + JSON.stringify(t).slice(0, 160));
      const after = JSON.stringify(dig().getRange(1, 1, dig().getLastRow(), LAB_COLS.length).getValues()) +
                    JSON.stringify(ss.getSheetByName(T_HOMEWORK).getRange(1, 1, ss.getSheetByName(T_HOMEWORK).getLastRow(), _HW_HEADERS_.length).getValues());
      if (before !== after) throw new Error('reading the view changed a tab');
      if (/@/.test(JSON.stringify(t.data))) throw new Error('an address reached the page');
      const page = doGet({ parameter: { page: 'habits' } });
      if (!/"tab":"habits"/.test(page.html)) throw new Error('?page=habits does not open the view');
    });
    ok &= run('habits and homework read the spreadsheet\u2019s time zone once per call, not once per pupil per homework (2 Oct 2026)', () => {
      /* Daniel: the teacher page is slow to open. _tz_() asked the spreadsheet every time — about twice per pupil per
         homework in ⏱️ Homework habits. Now once per execution, kept with the handle it was read from. */
      const handle = _ss_(), real = handle.getSpreadsheetTimeZone;
      let n = 0;
      handle.getSpreadsheetTimeZone = function () { n++; return real.apply(this, arguments); };
      try {
        for (const view of ['habits', 'homework']) {
          _TZ_MEMO = null; n = 0;                          /* a new execution */
          const r = uiData(view);
          if (!r.ok) throw new Error(view + ' was refused: ' + JSON.stringify(r).slice(0, 120));
          if (n !== 1) throw new Error(view + ' read the time zone ' + n + ' times in one call');
        }
        _TZ_MEMO = { ss: {}, tz: 'Europe/London' };       /* kept from another handle: read again, not used */
        n = 0;
        if (_tz_() !== 'Asia/Seoul' || n !== 1) throw new Error('a time zone kept from another handle was used: ' + _tz_());
      } finally { handle.getSpreadsheetTimeZone = real; _TZ_MEMO = null; }
    });
    ok &= run('habits: no new public name — the view is a branch of uiData behind _hwCaller_ (ALLOWED unchanged), and every habits function ends in _', () => {
      const mine = [...SRC.matchAll(/^function\s+(_(?:st[A-Z]|hwHabit|hwBand|hwSpan|hwMoment|hwMedian|hwBaselines|hwTimesIndex|hwPartsWords|habitsData|scoreKind)\w*)\s*\(/gm)].map(m => m[1]);
      if (mine.length < 16) throw new Error('the habits code is not all here: ' + mine.join(', '));
      if (mine.some(n => !n.endsWith('_'))) throw new Error('public: ' + mine.filter(n => !n.endsWith('_')).join(', '));
      const ui = SRC.slice(SRC.indexOf('function uiData('), SRC.indexOf('function showTeacherPanel('));
      if (ui.indexOf('_hwCaller_()') < 0 || ui.indexOf("which === 'habits'") < ui.indexOf('_hwCaller_()')) throw new Error('the habits branch is not behind the gate');
      if ((global.ALLOWED_NAMES || []).some(n => /habit/i.test(n))) throw new Error('a habits name was added to ALLOWED');
    });
    /* ── the page (Teacher.html), with made-up data in the stand-in page ── */
    const HD = () => ({ recorded: true, left: 1, bands: { early: 50, good: 85 }, words: HW_CAT_WORDS, flagWords: 'Worth a look: the rule.',
      homework: [ { id:'HW-A', title:'Gut stations', who:'9H', set:'1 Oct, 16:00', due:'8 Oct, 16:00', day:'8 Oct', med:'1 day', withTimes:3 },
                  { id:'HW-B', title:'Osmosis words, and a very long title indeed', who:'9H', set:'9 Oct, 16:00', due:'16 Oct, 16:00', day:'16 Oct', med:'', withTimes:1 },
                  { id:'HW-C', title:'Ten A only', who:'10A', set:'9 Oct, 16:00', due:'16 Oct, 16:00', day:'16 Oct', med:'', withTimes:0 } ],
      pupils: [
        { name:'Zed Park', cls:'9H', base:'', habit:{ say:'Often late or not done', o:0, why:'late or not done in at least half of them. Their last 3 homework: 2 late, 1 not done.' },
          cells:[[0,'late',0,21,17,17,2,0,'1 day 2 h','7 Oct, 18:00','8 Oct, 20:00'], [1,'good',1,12,6,8,1,0,'5 h','10 Oct, 09:00','14 Oct, 14:00']], flags:[] },
        { name:'Amy Cho', cls:'9H', base:'Teacher-marked tests average 38% (2 papers)', habit:{ say:'Usually early', o:7, why:'early, or done before it was set, in at least two thirds of them.' },
          cells:[[0,'early',0,5,17,17,2,0,'9 min','1 Oct, 18:00','1 Oct, 18:09']],
          flags:[{ h:0, says:'Finished 2 stations within 9 min of the first try (median for this homework: 1 day), all right first time; teacher-marked tests average 38% (2 papers).' }] },
        { name:'Bo Lim', cls:'10A', base:'', habit:null, cells:[[2,'none',0,0,0,8,1,0,'','','']], flags:[] } ] });
    const habPage = store => { const p = teacherPage();
      p.win.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
      p.drawn = null; p.win.__view.openDraw = (t, m, b) => { p.drawn = { t, m, b }; };
      return p; };
    ok &= run('habits page: a sixth view of the one page — its tab "⏱️ Homework habits", a note of what the page cannot show, drawn by the second script', () => {
      const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
      if (!/var ORDER = \[[^\]]*'habits'\];/.test(h)) throw new Error('no habits tab in ORDER');
      if (!/habits:\{ label:'⏱️ Homework habits'/.test(h)) throw new Error('the tab is not called ⏱️ Homework habits');
      /* Daniel, 2 Oct 2026: a note says what a teacher cannot see or guess; "Start here: pick a class" was obvious and went */
      const hn = (h.match(/habits:\{[\s\S]*?note:'([^']*)'/) || ['', ''])[1];
      if (!/^Hover over or tap a mark/.test(hn) || !/never proof of anything/.test(hn) || !/not time spent working/.test(hn)) throw new Error('the habits note lost what only it can say: ' + hn.slice(0, 120));
      const notes = (h.match(/\n      note:'[^']*'/g) || []);
      if (notes.length !== 7) throw new Error('not seven notes (one per view; Write-Up since 8 Oct 2026): ' + notes.length);
      const lame = notes.filter(n => /Nothing here changes a mark|Start here: pick a class|stays hidden from pupils until its start|Completion is worked out|never a zero|because you are their teacher/.test(n));
      if (lame.length) throw new Error('a note says the obvious again: ' + lame[0].slice(0, 120));
      if (!/Reminders \(🔔\) go in Google Classroom only to the pupils who have not finished, when 70% and 85% of the time from setting to due has passed, and never between 22:00 and 07:00\.' \},/.test(h)) throw new Error('the homework note is not the reminders rule alone');
      if (!/\$\('note'\)\.hidden = !VIEWS\[cur\]\.note;/.test(h)) throw new Error('an empty note would still be drawn');
      if (/homework analysis/i.test(h)) throw new Error('it is not called "homework analysis"');
      if (!/if \(cur==='habits'\) return window\.vHabits\(r\.data\);/.test(h)) throw new Error('the view is never drawn');
      if (!/window\.vHabits = function/.test(h.slice(h.indexOf('<script>', h.indexOf('</script>', h.indexOf('<script>')))))) throw new Error('the view is not in the second script');
      const spent = [...h.matchAll(/time spent/gi)].map(m => h.slice(m.index - 4, m.index));
      if (spent.some(x => x !== 'not ')) throw new Error('a time is called "time spent"');
    });
    ok &= run('habits page: one class, pupils down and homework across in date order, one mark with its words on hover, the habit line, the flags column, the key', () => {
      const store = {}, p = habPage(store);
      p.win.vHabits(HD());
      const html = p.html();
      if (!/<select id="hbcls"><option value="9H" selected>9H<\/option><option value="10A">10A<\/option><\/select>/.test(html)) throw new Error('the class picker: ' + (html.match(/<select id="hbcls">.*?<\/select>/) || [''])[0]);
      const a = html.indexOf('>Amy Cho<'), z = html.indexOf('>Zed Park<');
      if (a < 0 || z < 0 || a > z || html.indexOf('Bo Lim') >= 0) throw new Error('the pupils of 9H by name');
      const A = html.indexOf('Gut stations<span class="lt">8 Oct'), Bc = html.indexOf('Osmosis words, and a …<span class="lt">16 Oct');
      if (A < 0 || Bc < 0 || A > Bc || /Ten A only/.test(html)) throw new Error('the homework columns, oldest first, this class only');
      if (!/class="hbm hbm--early" data-tip="Gut stations\nSet 1 Oct, 16:00 · due 8 Oct, 16:00\nEarly: finished 1 Oct, 18:09\nFrom first try to finish: 9 min\n5 checks · 17\/17 right first time \(100%\)"/.test(html))
        throw new Error('a mark and its words');
      if (!/class="hbm hbm--good" data-tip="[^"]*⏰ finished after reminder 1[^"]*"><i aria-hidden="true">⏰<\/i><\/span>/.test(html)) throw new Error('⏰ on a mark');
      if (!/<div class="hbh" data-tip="Usually early — early, or done before it was set[^"]*">Usually early<\/div>/.test(html)) throw new Error('the habit line under the name');
      if (!/<span class="hbflag" data-tip="Gut stations: Finished 2 stations within 9 min[^"]*">⚑ 1<\/span>/.test(html)) throw new Error('the flags column');
      if (!/class="hbkey"/.test(html) || !/Early \(by 50% of the time\)/.test(html) || !/In good time \(by 85%\)/.test(html) || !/finished after a reminder/.test(html)) throw new Error('the key');
      if (!/1 homework left out: it has no due time to measure against/.test(html)) throw new Error('homework left out is not said');
      if (/\stitle="/.test(html)) throw new Error('help in a title= tooltip');
    });
    ok &= run('habits page: sort by name or by habit (most worth a look first), remembered in this browser; the class picker', () => {
      const store = {}, p = habPage(store);
      p.win.vHabits(HD());
      p.press('data-hbsort', 'habit');
      let html = p.html();
      if (!(html.indexOf('>Zed Park<') < html.indexOf('>Amy Cho<'))) throw new Error('by habit, "often late or not done" first');
      if (store['habits.sort'] !== 'habit' || !/data-hbsort="habit" aria-pressed="true"/.test(html)) throw new Error('the sort is not remembered or shown');
      const p2 = habPage(store); p2.win.vHabits(HD());
      if (!(p2.html().indexOf('>Zed Park<') < p2.html().indexOf('>Amy Cho<'))) throw new Error('a new page forgot the sort');
      p2.press('data-hbsort', 'name');
      if (store['habits.sort'] !== 'name' || !(p2.html().indexOf('>Amy Cho<') < p2.html().indexOf('>Zed Park<'))) throw new Error('back to names');
      p2.fire('change', 'id', 'hbcls', '10A');
      html = p2.html();
      if (!/>Bo Lim</.test(html) || /Amy Cho/.test(html) || !/Ten A only/.test(html) || !/class="hbm hbm--none"/.test(html)) throw new Error('10A');
      if (!/class="hbh none" data-tip="Fewer than 3 homework with times so far\.">—/.test(html)) throw new Error('no habit line yet is said');
      const p3 = habPage({}); p3.win.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
      p3.win.vHabits(HD()); p3.press('data-hbsort', 'habit');
      if (!(p3.html().indexOf('>Zed Park<') < p3.html().indexOf('>Amy Cho<'))) throw new Error('storage blocked broke the sort');
    });
    ok &= run('habits page: a name opens the pupil\'s timeline — set and due, first try, finish, band, ⏰, checks, right first time, the flag words', () => {
      const p = habPage({});
      p.win.vHabits(HD());
      p.press('data-hbp', '0');
      const d = p.drawn;
      if (!d || d.t !== 'Zed Park' || !/9H · Often late or not done/.test(d.m)) throw new Error('the drawer: ' + JSON.stringify(d && [d.t, d.m]));
      ['Set 9 Oct, 16:00 · due 16 Oct, 16:00', 'First try <b>10 Oct, 09:00</b>', 'Finished <b>14 Oct, 14:00</b>', 'From first try to finish <b>5 h</b>',
       'In good time · ⏰ after reminder 1', '<b>12</b> checks', '<b>6</b>/8 right first time', 'Late', 'No teacher-marked test in the Student Progress Tracker yet.']
        .forEach(w => { if (d.b.indexOf(w) < 0) throw new Error('the timeline lacks: ' + w); });
      p.press('data-hbp', '1');
      if (p.drawn.b.indexOf('⚑ Worth a look: Finished 2 stations within 9 min') < 0 || p.drawn.b.indexOf('Teacher-marked tests average 38% (2 papers).') < 0)
        throw new Error('the flag words or the baseline in the timeline');
    });
    ok &= run('habits page: "No times recorded yet" before the first saves after the paste; no homework said plainly', () => {
      const p = habPage({});
      p.win.vHabits(Object.assign(HD(), { recorded: false }));
      if (!/No times recorded yet\./.test(p.html()) || /<table/.test(p.html())) throw new Error('no times: ' + p.html().slice(0, 160));
      p.win.vHabits({ homework: [], pupils: [], recorded: false });
      if (!/No homework with a due time yet\./.test(p.html())) throw new Error('no homework: ' + p.html().slice(0, 160));
    });
    ok &= run('📊 Analysis ↗: only for the people on the analysis website\'s 👥 list (the tracker\'s ANALYSIS_VIEWERS metadata), cached 5 minutes; the list never reaches the page', () => {
      let finds = 0, meta = JSON.stringify({ v: 1, emails: ['teacher@x.kr', 'other.teacher@x.kr'] });
      const tracker = { createDeveloperMetadataFinder: () => ({ withKey: k => ({ find: () => { finds++;
        return k === 'ANALYSIS_VIEWERS' && meta !== null ? [{ getValue: () => meta }] : []; } }) }) };
      const keepHub = HUB_URL, LINK = 'https://nlcsbiology.com/biology-hub/analysis.html', fresh = () => cacheStore.delete('analysis-viewers');
      props.set('TRACKER_ID', 'ANALYSIS-TRACKER');
      SpreadsheetApp.openById = x => x === 'ANALYSIS-TRACKER' ? tracker : realOpen(x);
      try {
        HUB_URL = 'https://nlcsbiology.com/biology-hub'; fresh();
        if (_analysisLink_(OWNER) !== LINK) throw new Error('a viewer: ' + _analysisLink_(OWNER));
        const f1 = finds;
        if (_analysisLink_(OWNER) !== LINK || finds !== f1) throw new Error('the second load read the tracker again');
        if (_analysisLink_('colleague@x.kr') !== '') throw new Error('a teacher not on the list got the link');
        fresh(); meta = null;
        if (_analysisLink_(OWNER) !== '') throw new Error('no metadata, and still a link');
        fresh(); meta = '{broken';
        if (_analysisLink_(OWNER) !== '') throw new Error('broken JSON, and still a link');
        fresh(); meta = JSON.stringify({ v: 1, emails: ['teacher@x.kr'] }); HUB_URL = ''; props.delete('HUB_URL');   /* a typed HUB_URL is kept in Script Properties */
        if (_analysisLink_(OWNER) !== '') throw new Error('no hub address, and still a link');
        HUB_URL = 'https://nlcsbiology.com/biology-hub'; fresh(); meta = JSON.stringify({ v: 1, emails: ['teacher@x.kr', 'other.teacher@x.kr'] });
        const page = doGet({ parameter: { page: 'teachers' } }).html;
        if (page.indexOf('"analysis":"' + LINK + '"') < 0) throw new Error('the page was not given the address');
        if (/other\.teacher@x\.kr/.test(page)) throw new Error('the list reached the page');
        if (/analysis/i.test((global.ALLOWED_NAMES || []).join(' ')) || !/^function _analysisLink_\(/m.test(SRC)) throw new Error('a new public name');
      } finally { HUB_URL = keepHub; SpreadsheetApp.openById = realOpen; props.delete('TRACKER_ID'); fresh(); }
    });
    ok &= run('the header in two rows: the eyebrow with who is signed in, the age, Refresh and ☀/☾ (one group, on the right); then the tabs with 📊 Analysis ↗ at the far right; on a phone the group flows as before', () => {
      /* Daniel, 1 Oct 2026 (night): with ⏱️ Homework habits and 📊 Analysis ↗ the header had grown to three ragged rows */
      const h0 = fs.readFileSync('apps-script/Teacher.html', 'utf8');
      const r1 = h0.indexOf('<div class="row1">'), r2 = h0.indexOf('<div class="row2">');
      if (r1 < 0 || r2 < r1 || h0.indexOf('<div class="meta">') < r1 || h0.indexOf('<div class="meta">') > r2 || h0.indexOf('<nav class="tabs"') < r2) throw new Error('not two rows: the eyebrow and the group, then the tabs');
      if (!/\n\.row2 \.ana\{margin-left:auto\}/.test(h0)) throw new Error('📊 Analysis ↗ is not at the right end of the tab row');
      /* found 1 Oct 2026 (late night) in headless Chrome: with six tabs, at 1280 px Refresh wrapped ALONE to the left of a second
         row; grouped, the three wrap as one, on the right; below 700 px the group dissolves (display:contents) */
      const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
      if (!/<div class="meta">\s*<span class="who" id="who"><\/span>\s*<span class="age" id="age"[^>]*><\/span>\s*<button class="rf" id="rf"[\s\S]*?Refresh<\/button>\s*<button class="rf thm" id="thm" type="button">[^<]*<\/button>\s*<\/div>/.test(h))
        throw new Error('who, age, Refresh and ☀/☾ are not one group');
      const css = h.slice(h.indexOf('<style>'), h.indexOf('</style>'));
      const meta = (css.match(/\n\.meta\{([^}]*)\}/) || ['', ''])[1];
      if (!/margin-left:auto/.test(meta) || !/flex-wrap:wrap/.test(meta) || !/justify-content:flex-end/.test(meta)) throw new Error('the group does not sit on the right: ' + meta);
      if (!/@media \(max-width:700px\)\{\.meta\{display:contents\}/.test(css)) throw new Error('on a phone the group does not dissolve');
    });
    ok &= run('a bright and a dark version: set before the page draws, the computer\'s own setting until ☀/☾, every colour a token with both values', () => {
      /* Daniel, 1 Oct 2026: "have a bright version… all of the teacher tabs". The page was dark only. */
      const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
      const boot = h.indexOf('<script data-theme-boot>'), sty = h.indexOf('<style>');
      if (boot < 0 || boot > sty) throw new Error('no theme script in <head> before the styles: the page would flash the wrong version');
      const bs = h.slice(boot, h.indexOf('</script>', boot));
      if (!/localStorage\.getItem\('biology\.theme'\)/.test(bs) || !/prefers-color-scheme: light/.test(bs) || !/setAttribute\('data-theme', t\)/.test(bs)) throw new Error('the early script does not read the saved choice, then the computer\'s own setting');
      const css = h.slice(sty, h.indexOf('</style>'));
      const block = re => (css.match(re) || ['', ''])[1];
      const dark = block(/:root,:root\[data-theme="dark"\]\{([^}]*)\}/), lite = block(/:root\[data-theme="light"\]\{([^}]*)\}/);
      const toks = b => [...b.matchAll(/(--[a-z0-9-]+):([^;]+);/g)].filter(m => /#|rgba?\(|%/.test(m[2])).map(m => m[1]);
      const dT = toks(dark), lT = new Set(toks(lite));
      const miss = dT.filter(k => !lT.has(k) && k !== '--accent');
      if (dT.length < 40 || miss.length) throw new Error('colours with no bright value: ' + miss.join(', '));
      /* below the tokens, no rule names a colour of its own, apart from the habit marks' own dark/bright pairs and the
         \"done\" corner dot of a cell */
      const rest = css.slice(css.indexOf('*{box-sizing')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?::root\[data-theme="light"\] )?\.hbm--[a-z]+\{[^}]*\}/g, '');
      const stray = [...rest.matchAll(/#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsl\(\d+ \d/g)].map(m => rest.slice(Math.max(0, m.index - 30), m.index + 12));
      if (stray.length) throw new Error('colours outside the tokens: ' + stray.join(' | '));
      for (const k of ['before', 'early', 'good', 'last', 'late', 'none', 'unknown'])
        if (!new RegExp(':root\\[data-theme="light"\\] \\.hbm--' + k + '\\{').test(css)) throw new Error('the habit mark "' + k + '" has no bright version');
      const views = [...h.matchAll(/\n    (\w+):\{ label:'[^']*', accent:'(#[0-9A-F]{6})'(, accentL:'(#[0-9A-F]{6})')?/g)];
      if (views.length !== 7 || views.some(v => !v[4])) throw new Error('a view has no bright accent (seven views since 8 Oct 2026): ' + views.filter(v => !v[4]).map(v => v[1]).join(', '));
      if (!/function heat\(p\)\{[^\n]*var\(--hb\)[^\n]*var\(--hd\)[^\n]*var\(--hf\)/.test(h)) throw new Error('the colour scale does not take its lightness from the version');
      if (!/<button class="rf thm" id="thm" type="button">/.test(h) || !/\$\('thm'\)\.addEventListener\('click'/.test(h)) throw new Error('no ☀/☾ button');
      if (!/localStorage\.setItem\('biology\.theme', t\)/.test(h)) throw new Error('the choice is not kept');
      if ((h.match(/localStorage\.setItem\('biology\./g) || []).length !== 1) throw new Error('the page writes another biology.* key');
    });
    ok &= run('📊 Analysis on the page: opens in the SAME tab (no target of its own; the page\'s base is _top), beside the tab list and never one of its tabs, hidden unless the server gave an address', () => {
      const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
      const tag = (h.match(/<a class="ana"[^>]*>[^<]*<\/a>/) || [''])[0];
      /* Daniel, 2 Oct 2026: "I open the biology hub, I press my assessments, and I press analysis, and I have three tabs open instead of one" */
      if (/target=/.test(tag) || !/\shidden>/.test(tag) || !/>📊 Analysis<\/a>$/.test(tag)) throw new Error('the link: ' + tag);
      if (!/<base target="_top">/.test(h)) throw new Error('the page has no base target _top: a link would open inside the frame');
      if (!/<\/nav>\n\s*<a class="ana"/.test(h)) throw new Error('not the next thing after the tab list');
      if (/\btab\b/.test((tag.match(/class="([^"]*)"/) || ['', ''])[1])) throw new Error('the link is a tab');
      const iife = (h.match(/\(function\(\)\{ var a=\$\('ana'\)[\s\S]*?\}\)\(\);/) || [''])[0];
      if (!iife) throw new Error('the page no longer shows the link from BOOT');
      const show = url => { const a = { hidden: true, at: {}, setAttribute(k, v) { this.at[k] = v; } };
        require('vm').runInNewContext(iife, { $: () => a, BOOT: { analysis: url } }); return a; };
      const ok1 = show('https://nlcsbiology.com/biology-hub/analysis.html');
      if (ok1.hidden || ok1.at.href !== 'https://nlcsbiology.com/biology-hub/analysis.html') throw new Error('a viewer does not see it');
      if (!show('').hidden || !show(undefined).hidden || !show('javascript:alert(1)//analysis.html').hidden) throw new Error('shown without a good address');
    });
    ok &= run('← Biology Hub on the page: the hub opens the teacher page in the same tab, so the page links back — only to an https address the server gave (HUB_URL), in the same tab', () => {
      const h = fs.readFileSync('apps-script/Teacher.html', 'utf8');
      const tag = (h.match(/<a class="backhub"[^>]*>[^<]*<\/a>/) || [''])[0];
      if (!/id="backHub"/.test(tag) || /target=/.test(tag) || !/\shidden>/.test(tag) || !/>← Biology Hub<\/a>$/.test(tag)) throw new Error('the link: ' + tag);
      const iife = (h.match(/\(function\(\)\{ var b=\$\('backHub'\)[\s\S]*?\}\)\(\);/) || [''])[0];
      if (!iife) throw new Error('the page never shows the link from BOOT');
      const show = url => { const els = { backHub: { hidden: true, at: {}, setAttribute(k, v) { this.at[k] = v; } }, eyeHub: { hidden: false } };
        require('vm').runInNewContext(iife, { $: id => els[id], BOOT: { hub: url } }); return els; };
      const a = show('https://nlcsbiology.com/biology-hub');
      if (a.backHub.hidden || a.backHub.at.href !== 'https://nlcsbiology.com/biology-hub/' || !a.eyeHub.hidden) throw new Error('a teacher does not get the way back: ' + JSON.stringify(a.backHub.at));
      for (const bad of ['', undefined, 'javascript:alert(1)', 'http://nlcsbiology.com/biology-hub']) { const b = show(bad); if (!b.backHub.hidden || b.eyeHub.hidden) throw new Error('shown without a good address: ' + bad); }
      if (!/\n    hub: _hubUrl_\(\) /.test(fs.readFileSync('apps-script/Code.gs', 'utf8'))) throw new Error('the server does not give the page the hub\'s address');
      const hub = fs.readFileSync('js/hub.js', 'utf8');
      if (!/asLink\(teacher\.page, lbl, 'Assessment system', 'Signed in · teacher mode', true\);/.test(hub) || !/if \(sameTab\) \{ link\.removeAttribute\('target'\);/.test(hub)) throw new Error('the hub still opens the teacher page in a new tab');
    });
  } finally {
    made.forEach(id => { try { homeworkDelete(id); } catch (e) {} });
    setMan(habMan); CLIENT_ID = habCid; TOKEN_EMAIL = habTok; SpreadsheetApp.openById = realOpen;
  }
}
homeworkDelete(enHw.id);
{ const t = ss.getSheetByName(T_ENGLISH); if (t) ss.deleteSheet(t); }
ENGLISH_JSON = ''; TRIGGERS.length = 0; MAILS.length = 0; CLIENT_ID = enCid; TOKEN_EMAIL = enTok;
{ const t = ss.getSheetByName(T_HOMEWORK); if (t) ss.deleteSheet(t); }
VISITOR = ''; SCHOOL_DOMAIN = ''; HUB_URL = ''; MANIFEST_JSON = '';
props.delete('HUB_URL'); props.delete('SCHOOL_DOMAIN');

/* ── §front-door (28 Sep 2026): My assessments follows the newest reflection copy ─────────────────────
   The reflection copy running the newest code writes its address into the tracker's "🚪 My assessments address"
   tab; this script reads it for the record answer and the health line. The writer itself is tested beside its
   Code.gs (IGCSE/AppScript/Test System harness/check_front_door.mjs, which also runs this reader on its tab). */
console.log('— my assessments follows the newest reflection copy —');
{
  const fdCid = CLIENT_ID, fdTok = TOKEN_EMAIL, fdDom = SCHOOL_DOMAIN;
  const EXEC = 'https://script.google.com/a/macros/x.kr/s/AKfycbFRONTDOORtestdeployment00001/exec?page=student';
  const fdTab = () => ss.getSheetByName(FRONT_DOOR_TAB);
  const fdWrite = rows => { const old = fdTab(); if (old) ss.deleteSheet(old); const sh = ss.insertSheet(FRONT_DOOR_TAB);
    rows.forEach((r, i) => { sh.getRange(i + 1, 1).setValue(r[0]); sh.getRange(i + 1, 2).setValue(r[1]); }); return sh; };
  const fdRows = (url, build) => [['What', 'Value'], ['Address', url], ['Code edition', '28 Sep 2026 — test'], ['Build', build],
    ['Spreadsheet', 'Topic 9 test'], ['Spreadsheet id', 'ss9'], ['Registered', new Date()], ['Keep students here', false]];
  const fdPost = (body, email) => { TOKEN_EMAIL = email;
    return JSON.parse(doPost({ postData:{ contents: JSON.stringify(Object.assign({ token: TOK }, body)) } })); };
  const fdWho = _studentDirectory_().students.filter(s => /@/.test(s.email))[0];
  ok &= run('front door: the tab the newest reflection copy writes is read — its address, edition and build', () => {
    fdWrite(fdRows(EXEC, 2026092807));
    const d = _frontDoor_(ss);
    if (!d || d.url !== EXEC || d.build !== 2026092807 || d.edition !== '28 Sep 2026 — test') throw new Error(JSON.stringify(d));
  });
  ok &= run('front door: a row moved or added by hand is still read by its label', () => {
    fdWrite([['A note typed by hand', 'x']].concat(fdRows(EXEC, 5)));
    if (_frontDoorUrl_(ss) !== EXEC) throw new Error('read ' + _frontDoorUrl_(ss));
  });
  ok &= run('front door: never an address that is not an Apps Script web app, or not the student page', () => {
    for (const bad of ['https://evil.example/macros/s/AKfycbFRONTDOORtestdeployment00001/exec?page=student', EXEC.replace('?page=student', ''),
                       'javascript:alert(1)//script.google.com/macros/s/AKfycbFRONTDOORtestdeployment00001/exec?page=student',
                       EXEC + '&email=pupil@x.kr', EXEC.replace('page=student', 'page=dashboard'), ' ']) {
      fdWrite(fdRows(bad, 9));
      if (_frontDoor_(ss) !== null || _frontDoorUrl_(ss) !== '') throw new Error('accepted ' + bad);
    }
  });
  ok &= run('front door: no tab, or no tracker — nothing, and never an error', () => {
    const old = fdTab(); if (old) ss.deleteSheet(old);
    if (_frontDoor_(ss) !== null || _frontDoorUrl_(ss) !== '' || _frontDoorUrl_(null) !== '') throw new Error('something from nothing');
  });
  ok &= run('front door: the record answer carries the address, and leaves it out until a copy has registered', () => {
    props.set('TRACKER_ID', 'tracker'); CLIENT_ID = 'CID'; SCHOOL_DOMAIN = 'x.kr';
    if (!fdWho || !/@x\.kr$/.test(fdWho.email)) throw new Error('no pupil at x.kr to sign in as: ' + JSON.stringify(fdWho));
    let j = fdPost({ action:'record' }, fdWho.email);
    if (!j.ok || 'myAssessments' in j) throw new Error('before any copy registered: ' + JSON.stringify(j).slice(0, 200));
    fdWrite(fdRows(EXEC, 2026092807));
    j = fdPost({ action:'record' }, fdWho.email);
    if (!j.ok || j.myAssessments !== EXEC) throw new Error('after: ' + JSON.stringify(j).slice(0, 200));
    fdWrite(fdRows('https://evil.example/exec?page=student', 9));
    j = fdPost({ action:'record' }, fdWho.email);
    if (!j.ok || 'myAssessments' in j) throw new Error('a bad address was handed over: ' + JSON.stringify(j).slice(0, 200));
  });
  ok &= run('front door: the health line names the code students\' My assessments runs, so it can be checked without signing in', () => {
    fdWrite(fdRows(EXEC, 2026092807)); cacheStore.delete('frontdoor-health');
    const a = doGet({ parameter:{} });
    if (a !== 'Biology Labs endpoint is running · ' + SCRIPT_EDITION + ' · My assessments: 28 Sep 2026 — test (build 2026092807)') throw new Error(a);
    fdWrite(fdRows(EXEC, 2026092899));
    if (doGet({ parameter:{} }) !== a) throw new Error('not kept for ten minutes');
    const old = fdTab(); if (old) ss.deleteSheet(old); cacheStore.delete('frontdoor-health');
    if (!/ · My assessments: no reflection copy has registered yet$/.test(doGet({ parameter:{} }))) throw new Error('no tab: ' + doGet({ parameter:{} }));
    props.delete('TRACKER_ID'); cacheStore.delete('frontdoor-health');
    if (doGet({ parameter:{} }) !== 'Biology Labs endpoint is running · ' + SCRIPT_EDITION) throw new Error('record card off: ' + doGet({ parameter:{} }));
  });
  { const old = fdTab(); if (old) ss.deleteSheet(old); }
  props.delete('TRACKER_ID'); cacheStore.delete('frontdoor-health');
  CLIENT_ID = fdCid; TOKEN_EMAIL = fdTok; SCHOOL_DOMAIN = fdDom;
}

/* ── §hub-card (28 Sep 2026): "Your reflection" on the hub ──────────────────────────────────────────────────────────
   A reflection spreadsheet switches itself on in the tracker's "📣 Reflections on the hub" tab; this script reads it and
   the reflection spreadsheet's Marks tabs, LiveProgress and Reflections, and puts this person's card in the "Sit a test"
   answer. The rule itself is run beside the reflection form's own functions on 39 pupils in
   IGCSE/AppScript/Test System harness/check_reflect_card.mjs; these check the way through doPost. Here every id opens
   the one fake spreadsheet, so the tracker tab and the reflection's tabs sit side by side in it. */
console.log('— your reflection on the hub —');
{
  const rcCid = CLIENT_ID, rcTok = TOKEN_EMAIL, rcDom = SCHOOL_DOMAIN;
  const FORM = 'https://script.google.com/a/macros/x.kr/s/AKfycbREFLECTIONformDeployment0001/exec';
  const TABS = [REFL_CARD_TAB, 'Marks · 10A · C', 'LiveProgress', 'Reflections'];
  const clear = () => { TABS.forEach(n => { const t = ss.getSheetByName(n); if (t) ss.deleteSheet(t); });
                        ['rflon1', 'rsnap1:REFLECTIONspreadsheetId0001'].forEach(k => cacheStore.delete(k)); };
  const rows = (name, list) => { const sh = ss.insertSheet(name); list.forEach((r, i) => r.forEach((v, j) => sh.getRange(i + 1, j + 1).setValue(v))); return sh; };
  const post = email => { TOKEN_EMAIL = email;
    return JSON.parse(doPost({ postData:{ contents: JSON.stringify({ token: TOK, action: 'test' }) } })); };
  const pupils = _studentDirectory_().students.filter(s => /@x\.kr$/.test(s.email)).map(s => s.email);
  const [p1, p2, p3] = pupils;
  const switchOn = url => rows(REFL_CARD_TAB, [['Spreadsheet id', 'Assessment', 'Form address', 'Showing', 'Switched on', 'Switched on by', 'Time zone'],
    ['REFLECTIONspreadsheetId0001', 'Test — Topic 7: Human Nutrition', url, true, new Date(), 'teacher@x.kr', 'Asia/Seoul']]);
  const setUp = () => {
    rows('Marks · 10A · C', [['T7'], [''], [''], [''], ['Email', 'Student Name'], [p1, 'One'], [p2, 'Two'], [p3, 'Three']]);
    rows('LiveProgress', [['Email', 'Last update', 'Name', 'Class', 'Screen #', 'Current screen', 'Progress', 'Status', 'Self-score', 'Flags', 'Started',
                           'Completed', 'Integrity', 'Test', 'Session Token', 'Validation flag names', 'MCQ Access Granted At', 'Started Screen 1 At'],
                          [p2, '', 'Two', '10A', 8, '', '', 'Submitted incomplete'], [p3, '', 'Three', '10A', 8, '', '', 'Complete']]);
    rows('Reflections', [['Email', 'Timestamp', 'Name', 'Class', 'Validation flags', 'Submission Count', 'Retry Allowed'],
                         [p2, new Date(), 'Two', '10A', 'INCOMPLETE-SUBMISSION (screen 4)', 1, ''], [p3, new Date(), 'Three', '10A', '', 1, '']]);
  };
  ok &= run('your reflection: nothing switched on — no card, and nothing else in the answer changes', () => {
    props.set('TRACKER_ID', 'tracker'); CLIENT_ID = 'CID'; SCHOOL_DOMAIN = 'x.kr'; clear();
    if (!p1 || !p2 || !p3) throw new Error('three pupils at x.kr needed: ' + JSON.stringify(pupils));
    const j = post(p1);
    if (!j.ok || 'reflect' in j || 'reflectWhy' in j || j.state !== 'none') throw new Error(JSON.stringify(j).slice(0, 300));
  });
  ok &= run('your reflection: switched on, a pupil on its Marks tab who has not started gets Start, with the form\'s address', () => {
    clear(); setUp(); switchOn(FORM);
    const j = post(p1);
    if (!j.ok || !j.reflect || j.reflect.state !== 'start' || j.reflect.url !== FORM || j.reflect.name !== 'Test — Topic 7: Human Nutrition')
      throw new Error(JSON.stringify(j).slice(0, 300));
  });
  ok &= run('your reflection: only part of it handed in — the reminder, and no address', () => {
    const j = post(p2);
    if (!j.reflect || j.reflect.state !== 'part' || 'url' in j.reflect) throw new Error(JSON.stringify(j).slice(0, 300));
  });
  ok &= run('your reflection: a complete one — no card; and no answer ever names another pupil', () => {
    const j = post(p3);
    if ('reflect' in j) throw new Error(JSON.stringify(j).slice(0, 300));
    for (const who of [p1, p2, p3]) { const a = JSON.stringify(post(who)); if ([p1, p2, p3].some(o => o !== who && a.includes(o))) throw new Error(who + ': ' + a.slice(0, 300)); }
  });
  ok &= run('your reflection: an address that is not an Apps Script web app is never handed over', () => {
    for (const bad of ['https://evil.example/s/AKfycbREFLECTIONformDeployment0001/exec', FORM + '?page=student', 'javascript:alert(1)', '']) {
      clear(); setUp(); switchOn(bad);
      const j = post(p1);
      if ('reflect' in j) throw new Error('handed over ' + bad + ': ' + JSON.stringify(j).slice(0, 200));
    }
  });
  clear();
  props.delete('TRACKER_ID');
  CLIENT_ID = rcCid; TOKEN_EMAIL = rcTok; SCHOOL_DOMAIN = rcDom;
}

/* ── "Sit a test": each version's Marks tab read with ITS OWN columns (test-169, 30 Sep 2026) ─────────────────────────
   The Test System's ⏰ Hub schedule names each version's columns in marks.byVersion: T3T4's versions differ in Section B,
   so Extra time is column 40 on an A tab, 43 on a B tab and 39 on a C tab. A class tab left by another, narrower test
   must not hide the banner from the whole spreadsheet (labs-script-004), and a Test System from before byVersion is
   read exactly as before. The whole two-system run, on the real Test System, is audit_versions.py in the harness. */
console.log('— sit a test: each version read with its own columns —');
{
  const tss = new SS(), TSID = 'TESTsystemSpreadsheet0001', realOpen = SpreadsheetApp.openById;
  const stCid = CLIENT_ID, stTok = TOKEN_EMAIL, stIds = _testSheetIds_;
  const NOW = Date.now(), REL = NOW - 3600e3, LOCK = NOW + 3600e3, WIN = LOCK - REL;
  const when = ms => new Date(ms).toISOString();
  const version = id => ({ id, name: 'Test T3T4', releaseAt: when(REL), lockoutAt: when(LOCK), classes: {} });
  const OWN = { A: { email: 1, cls: 3, extraTime: 40 }, B: { email: 1, cls: 3, extraTime: 43 }, C: { email: 1, cls: 3, extraTime: 39 } };
  const schedule = byVersion => {
    const old = tss.getSheetByName(T_HUB_SCHEDULE); if (old) tss.deleteSheet(old);
    const m = { v: 1, at: NOW, activeId: 'Test T3T4', formUrl: 'https://script.google.com/macros/s/AKfycbSITtestForm0000001/exec',
      timerMode: 'window', timeLimitMinutes: 60,
      marks: Object.assign({ prefix: 'Marks · ', dataStart: 5, email: 1, cls: 3, extraTime: 40 }, byVersion ? { byVersion } : {}),
      versions: { '': version('Test T3T4'), A: version('Test T3T4'), B: version('Test T3T4·B'), C: version('Test T3T4·C') }, names: {} };
    const sh = tss.insertSheet(T_HUB_SCHEDULE);
    sh.getRange(1, 1).setValue(HUB_SCHEDULE_KEY); sh.getRange(1, 2).setValue(JSON.stringify(m));
  };
  const marks = (name, width, email, cells) => {
    const old = tss.getSheetByName(name); if (old) tss.deleteSheet(old);
    const sh = tss.insertSheet(name); sh.maxC = width;
    sh.getRange(4, 1).setValue('Email'); sh.getRange(5, 1).setValue(email); sh.getRange(5, 3).setValue('9A');
    (cells || []).forEach(([c, v]) => sh.getRange(5, c).setValue(v));
  };
  const read = email => { cacheStore.delete('tsnap4:' + TSID); const snap = _testSnapshot_(TSID, true);
    return { snap, me: _testFor_(snap, email, Date.now()) }; };
  const PA = 'pa.sit@x.kr', PB = 'pb.sit@x.kr', PZ = 'pz.sit@x.kr', EXTRA = LOCK + Math.round(25 / 100 * WIN);
  SpreadsheetApp.openById = id => (id === TSID ? tss : realOpen(id));
  try {
    ok &= run('sit a test: a version B pupil\'s extra time comes from B\'s own column, not A\'s (test-169, labs-script-005)', () => {
      schedule(OWN);
      marks('Marks · 9A · A', 42, PA, [[40, 'Extra 25%']]);
      marks('Marks · 9A · B', 45, PB, [[40, 12], [43, 'Extra 25%']]);   /* 40 on a B tab is a mark (its total), never extra time */
      const a = read(PA).me, b = read(PB).me;
      if (!a || a.state !== 'open' || a.closesAt !== EXTRA) throw new Error('A: ' + JSON.stringify(a));
      if (!b || b.state !== 'open' || b.closesAt !== EXTRA)
        throw new Error('B closes at ' + (b && when(b.closesAt)) + ', want ' + when(EXTRA) + ' (25 % extra time in window mode)');
    });
    ok &= run('sit a test: a class tab narrower than this test (left by another) no longer hides the banner from everybody (labs-script-004)', () => {
      marks('Marks · 9Z', 14, PZ);
      const { snap, me } = read(PA);
      if (!snap || snap.fail) throw new Error('the spreadsheet could not be read: ' + JSON.stringify(snap));
      if (!me || me.closesAt !== EXTRA) throw new Error('a version A pupil lost the banner: ' + JSON.stringify(me));
      const z = _testFor_(snap, PZ, Date.now());
      if (!z || z.closesAt !== LOCK) throw new Error('the narrow tab\'s pupil (no Extra time column there, so none): ' + JSON.stringify(z));
      /* and the banner itself, through doPost */
      CLIENT_ID = 'CID'; TOKEN_EMAIL = PA; _testSheetIds_ = () => [TSID]; cacheStore.delete('tsnap4:' + TSID);
      const j = JSON.parse(doPost({ postData:{ contents: JSON.stringify({ token: TOK, action: 'test' }) } }));
      if (j.state !== 'open' || j.closesAt !== EXTRA || !j.url) throw new Error(JSON.stringify(j).slice(0, 300));
    });
    ok &= run('sit a test: a Test System from before byVersion is read exactly as before, and a narrow tab no longer hides it', () => {
      tss.deleteSheet(tss.getSheetByName('Marks · 9Z'));
      schedule(null);
      /* the old reading, all an old Test System allows: the active test's column 40 on every tab — B's total, 12 → 12 % */
      const b = read(PB).me;
      if (!b || b.closesAt !== LOCK + Math.round(12 / 100 * WIN)) throw new Error('B: ' + JSON.stringify(b));
      marks('Marks · 9Z', 14, PZ);
      const { snap } = read(PA);
      if (!snap || snap.fail || !_testFor_(snap, PA, Date.now())) throw new Error('with an old Test System a narrow tab still hides the banner');
    });
  } finally {
    SpreadsheetApp.openById = realOpen; _testSheetIds_ = stIds; CLIENT_ID = stCid; TOKEN_EMAIL = stTok;
    cacheStore.delete('tsnap4:' + TSID);
  }
}

console.log('— who a homework is for: joiners, movers and the 11C six (Daniel, 6 Oct 2026) —');
/* Daniel, 6 Oct 2026: a pupil who did a homework badly in class A and moves to class B keeps that result ("everything is
   ported"); a pupil who joins mid-year: "any previous homework should not be accounted for, only the one that it is
   included"; and the special case of 11C, whose import stopped part way: pupils in the class (and its Classroom course)
   the day it was set, but on the Students tab only later. */
{
  const keepCid = CLIENT_ID, made = [];
  CLIENT_ID = 'CID'; SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
  const hwOf = (id) => _homeworkData_().homework.filter((h) => h.id === id)[0];
  const rowOf = (id) => _homeworkRows_().filter((x) => x.id === id)[0];
  const names = (h) => h.pupils.map((x) => x.name).sort().join(', ');
  const task = [{ labId: 'digestion-lab', stationIds: ['mouth'] }];
  const setFor = (cls, title) => { const r = homeworkCreate({ title, classes: [{ cls, due: '2027-03-01T23:59:00' }], tasks: task });
    if (!r.ok) throw new Error('refused: ' + r.why); made.push(r.made[0]); return r.made[0]; };
  const pupil = (n, e) => ({ name: n, email: e, userId: 'u-' + e.split('@')[0] });
  try {
    ok &= run('a pupil who joins the class after a homework was set is not in it: the list, their own page and the counts leave it out, and the list names them', () => {
      _upsertStudents_([pupil('Joiner One', 'joiner.one@x.kr'), pupil('Joiner Two', 'joiner.two@x.kr')], '8Z', 'Y8 Biology', 'c8z');
      const id = setFor('8Z', 'Joiners stay out');
      _upsertStudents_([pupil('Joiner Three', 'joiner.three@x.kr')], '8Z', 'Y8 Biology', 'c8z');
      const h = hwOf(id);
      if (names(h) !== 'Joiner One, Joiner Two') throw new Error('the list has ' + names(h));
      if (_hwIsFor_(rowOf(id), 'joiner.three@x.kr', '8Z')) throw new Error('their own page shows homework set before they came');
      if (h.tally.none !== 2) throw new Error('the counts: ' + JSON.stringify(h.tally));
      const out = (h.outside || []).map((x) => x.name + (x.late ? ' (late)' : '')).join(', ');
      if (out !== 'Joiner Three (late)') throw new Error('the list does not name the pupil outside it: ' + out);
    });
    ok &= run('a pupil who was in the class’s Classroom course the day it was set is in it once imported (the 11C case); one who joined the course later is not', () => {
      const course = [pupil('Joiner One', 'joiner.one@x.kr'), pupil('Joiner Two', 'joiner.two@x.kr'), pupil('Joiner Four', 'joiner.four@x.kr')];
      global.Classroom = { Courses: { Students: { list: (cid) => ({ students: cid === 'c8z' ? course.map((p) => ({ userId: p.userId, profile: { emailAddress: p.email } })) : [] }) } } };
      let id;
      try { id = setFor('8Z', 'Who was in Classroom'); } finally { global.Classroom = undefined; }
      if (JSON.stringify(rowOf(id).inCourse) !== JSON.stringify(['joiner.four@x.kr', 'joiner.one@x.kr', 'joiner.two@x.kr'])) throw new Error('the course that day was not kept: ' + JSON.stringify(rowOf(id).inCourse));
      _upsertStudents_([pupil('Joiner Four', 'joiner.four@x.kr'), pupil('Joiner Five', 'joiner.five@x.kr')], '8Z', 'Y8 Biology', 'c8z');
      const h = hwOf(id);
      if (names(h) !== 'Joiner Four, Joiner One, Joiner Three, Joiner Two') throw new Error('the list has ' + names(h));   /* Three was on the tab that day */
      if (!_hwIsFor_(rowOf(id), 'joiner.four@x.kr', '8Z') || _hwIsFor_(rowOf(id), 'joiner.five@x.kr', '8Z')) throw new Error('their own pages disagree with the list');
      if (h.gone) throw new Error('a pupil in Classroom but not yet on the tab was counted as left');
    });
    ok &= run('the teacher can count in pupils who were in the class all along: only pupils in its class now, never twice, their own homework or the owner’s; never a pupil', () => {
      const id = made[0];
      let r = homeworkAddPupils({ id, emails: ['joiner.three@x.kr'] });
      if (!r.ok || !/1 pupil of 8Z now counts/.test(r.note)) throw new Error('refused: ' + JSON.stringify(r).slice(0, 160));
      if (names(hwOf(id)) !== 'Joiner One, Joiner Three, Joiner Two') throw new Error('the list has ' + names(hwOf(id)));
      if (!_hwIsFor_(rowOf(id), 'joiner.three@x.kr', '8Z')) throw new Error('their own page does not show it');
      r = homeworkAddPupils({ id, emails: ['joiner.three@x.kr'] });
      if (r.ok !== false || !/Nobody to add/.test(r.why)) throw new Error('added twice: ' + JSON.stringify(r).slice(0, 120));
      if (homeworkAddPupils({ id, emails: [enA.email] }).ok !== false) throw new Error('a pupil of another class was added');
      if (homeworkAddPupils({ id, emails: [] }).ok !== false) throw new Error('nothing ticked was accepted');
      TEACHERS = 'colleague@x.kr'; VISITOR = 'colleague@x.kr';
      r = homeworkAddPupils({ id, emails: ['joiner.five@x.kr'] });
      if (r.ok !== false || !/Only they \(or the owner\)/.test(r.why)) throw new Error('a colleague changed it: ' + JSON.stringify(r).slice(0, 120));
      VISITOR = 'pupil@pupils.x.kr';
      if (homeworkAddPupils({ id, emails: ['joiner.five@x.kr'] }).ok !== false) throw new Error('a pupil changed it');
      VISITOR = OWNER;
    });
    ok &= run('Move: the pupil keeps the homework set while they were in the old class; the new class’s earlier homework never counts for them; homework set after the move includes them', () => {
      _upsertStudents_([pupil('Mover Kim', 'mover.kim@x.kr')], '8Z', 'Y8 Biology', 'c8z');
      const before = setFor('8Z', 'Set in the old class'), theirsNot = setFor('8Y', 'The new class, before the move');
      const r = studentMove({ email: 'Mover.Kim@x.kr ', cls: '8y' });
      if (!r.ok || !/moved from 8Z to 8Y/.test(r.note) || !/Google Classroom/.test(r.note)) throw new Error('refused: ' + JSON.stringify(r).slice(0, 200));
      const dir = r.data.students.filter((x) => x.email === 'mover.kim@x.kr')[0];
      if (!dir || dir.cls !== '8Y') throw new Error('the Students tab still says ' + (dir && dir.cls));
      const dg = ss.getSheetByName('Digestion'), v = dg.getRange(2, 1, dg.getLastRow() - 1, LAB_EMAIL).getValues().filter((x) => x[LAB_EMAIL - 1] === 'mover.kim@x.kr')[0];
      if (!v || v[1] !== '8Y') throw new Error('their Digestion row still says ' + (v && v[1]));
      const after = setFor('8Y', 'The new class, after the move');
      const inIt = (id) => hwOf(id).pupils.some((x) => x.name === 'Mover Kim');
      if (!inIt(before)) throw new Error('the homework from the old class was lost');
      if (inIt(theirsNot)) throw new Error('the new class’s earlier homework counts against them');
      if (!inIt(after)) throw new Error('homework set after the move leaves them out');
      if (!hwOf(before).pupils.some((x) => x.name === 'Mover Kim' && x.cls === '8Y')) throw new Error('the old homework does not show their new class');
      const mine = (id) => _hwIsFor_(rowOf(id), 'mover.kim@x.kr', '8Y');
      if (!mine(before) || mine(theirsNot) || !mine(after)) throw new Error('their own page disagrees with the list');
    });
    ok &= run('Move is refused in words: no pupil, not on the tab, no class, the class they are in; never a pupil', () => {
      [[{ cls: '8Z' }, /Which pupil/], [{ email: 'nobody@x.kr', cls: '8Z' }, /not on the Students tab/], [{ email: 'mover.kim@x.kr', cls: '' }, /Choose the class/],
       [{ email: 'mover.kim@x.kr', cls: '8Y' }, /in 8Y already/]].forEach(([d, re]) => {
        const r = studentMove(d); if (r.ok !== false || !re.test(r.why)) throw new Error(JSON.stringify(d) + ' → ' + JSON.stringify(r).slice(0, 120)); });
      VISITOR = 'pupil@pupils.x.kr';
      if (studentMove({ email: 'mover.kim@x.kr', cls: '8Z' }).ok !== false) throw new Error('a pupil moved somebody');
      VISITOR = OWNER;
    });
    ok &= run('homework set for chosen pupils never gains anybody', () => {
      const set = Date.now() - 864e5;
      const roster = [{ name: 'Chosen', cls: '8X', email: 'chosen@x.kr', since: set - 864e5 }, { name: 'Classmate', cls: '8X', email: 'classmate@x.kr', since: Date.now() }];
      const chosen = { setFor: ['chosen@x.kr'], targets: { cls: '', emails: ['chosen@x.kr'] }, created: new Date(set).toISOString(), due: '2027-03-01T23:59:00' };
      if (_hwPupils_(chosen, roster).map((x) => x.name).join() !== 'Chosen') throw new Error('chosen pupils: ' + _hwPupils_(chosen, roster).map((x) => x.name));
      if (_hwIsFor_(chosen, 'classmate@x.kr', '8X')) throw new Error('a classmate sees homework set for one chosen pupil');
    });
  } finally {
    VISITOR = OWNER; made.forEach((id) => { try { homeworkDelete(id); } catch (e) {} });
    CLIENT_ID = keepCid; TEACHERS = ''; props.delete('TEACHERS'); global.Classroom = undefined;
  }
}

console.log('— a new school year: pupils in none of this year’s classes (Daniel, 7 Oct 2026) —');
/* "the next following year … a new Google Classroom … the same student, but a different year, how is it going to handle
   that?" Each import keeps, for the school year, which pupils each course listed. The import window lists the pupils in
   none of this year's courses; one press puts them in LEFT <year>: their records stay, and they drop out of every class
   list and every class's new homework. Importing their class again, or Move, brings one back. */
{
  const d0 = new Date(), sy = d0.getMonth() >= 7 ? d0.getFullYear() : d0.getFullYear() - 1;   /* the school year, worked out here: the code may not have it */
  const label = 'LEFT ' + d0.getFullYear(), keepCid = CLIENT_ID, made = [];
  const clsOf = em => { const d = _studentDirectory_().students.filter(x => x.email === em)[0]; return d ? d.cls : null; };
  const courses = {};
  const classroom = () => ({ Courses: { list: () => ({ courses: [] }), Students: { list: c => ({ students: courses[c] || [] }) } } });
  const kid = (pre, i) => ({ userId: 'u-' + pre + i, profile: { name: { fullName: pre + ' ' + i }, emailAddress: pre.toLowerCase() + i + '@x.kr' } });
  const importOne = (cid, code, list) => { courses[cid] = list; global.Classroom = classroom();
    try { return _importOneClass_({ courseId: cid, classCode: code, courseName: 'Course ' + code }, 'jobNY'); } finally { global.Classroom = undefined; } };
  const listed = () => { const v = _notThisYearView_(); return { v, emails: [].concat(...v.groups.map(g => g.pupils.map(p => p.email))).sort() }; };
  const record = () => [...props.keys()].filter(k => /^IMPORTED_/.test(k));
  const labRow = (tab, em) => { const sh = ss.getSheetByName(tab); return sh.getRange(2, 1, sh.getLastRow() - 1, LAB_EMAIL).getValues().filter(x => x[LAB_EMAIL - 1] === em)[0]; };
  const hwOf = id => _homeworkData_().homework.filter(h => h.id === id)[0];
  const task = [{ labId: 'digestion-lab', stationIds: ['mouth'] }];
  const setHw = (o) => { const r = homeworkCreate(Object.assign({ title: 'New year', tasks: task }, o)); if (!r.ok) throw new Error('refused: ' + r.why); made.push(r.made[0]); return r.made[0]; };
  let before = '';
  try {
    CLIENT_ID = 'CID'; SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
    record().forEach(k => props.delete(k));          /* as on the day the code is first pasted */
    /* the pupils as imports before this code left them: a class and a course id each, and no lists */
    _upsertStudents_([0, 1, 2, 3].map(i => ({ name: 'Leaver ' + i, email: 'leaver' + i + '@x.kr', userId: 'u-Leaver' + i })), '8L', 'Y8 L', 'cL');
    _upsertStudents_([0, 1, 2].map(i => ({ name: 'Stayer ' + i, email: 'stayer' + i + '@x.kr', userId: 'u-Stayer' + i })), '8M', 'Y8 M', 'cM');
    _upsertStudents_([{ name: 'Hand Added', email: 'hand.added@x.kr', userId: '' }], '8L', '', '');   /* typed in by hand: no course */
    _upsertStudents_([{ name: 'Teacher Row', email: 'teacher.row@x.kr', userId: 'u-t' }], 'TEST', 'A test course', 'cTest');
    before = setHw({ classes: [{ cls: '8L', due: '2027-03-01T23:59:00' }] });

    ok &= run('the first school year it runs in: nobody is listed, until a course is imported again and no longer lists a pupil', () => {
      let { v, emails } = listed();
      if (v.n !== 0) throw new Error('pupils were listed before any course was imported again: ' + emails.join(', '));
      if (props.get('IMPORTED_COURSES_FROM') !== String(sy) || !JSON.parse(props.get('IMPORTED_COURSES_' + sy)).seeded) throw new Error('the first year’s record was not made: ' + record().join(', '));
      const r = importOne('cL', '8L', [0, 1, 2].map(i => kid('Leaver', i)));      /* Leaver 3 is not in the course any more */
      if (r.status !== 'success') throw new Error('the import failed: ' + JSON.stringify(r));
      ({ v, emails } = listed());
      if (emails.join() !== 'leaver3@x.kr') throw new Error('wanted only Leaver 3, got: ' + emails.join(', '));
      const g = v.groups[0];
      if (g.cls !== '8L' || g.total !== 5 || g.pupils[0].why !== 'gone' || g.pupils[0].name !== 'Leaver 3') throw new Error('the class as the window shows it: ' + JSON.stringify(g));
      if (v.label !== label || v.since !== '1 August ' + sy || v.busy) throw new Error('the window’s words: ' + JSON.stringify(v).slice(0, 200));
    });

    ok &= run('a new school year: once a course is imported, every pupil whose course was not is listed, by class; a pupil added by hand, and the TEST row, never', () => {
      props.set('IMPORTED_COURSES_' + (sy - 3), '{"at":{}}'); props.set('IMPORTED_LIST_' + (sy - 3) + '_old', '[]');   /* records of years long gone */
      record().filter(k => k.indexOf('IMPORTED_COURSES_' + sy) === 0 || k.indexOf('IMPORTED_LIST_' + sy + '_') === 0).forEach(k => props.delete(k));
      props.set('IMPORTED_COURSES_FROM', String(sy - 1));                       /* this is the year after the one it was pasted in */
      let { v, emails } = listed();
      if (v.imported !== 0) throw new Error('a course counts as imported before any was: ' + v.imported);
      if (props.get('IMPORTED_COURSES_' + (sy - 3)) || props.get('IMPORTED_LIST_' + (sy - 3) + '_old')) throw new Error('the records of years long gone were kept');
      importOne('cM', '8M', [0, 1, 2].map(i => kid('Stayer', i)));
      ({ v, emails } = listed());
      if (emails.some(e => /^stayer/.test(e))) throw new Error('pupils of the course just imported are listed');
      const g = v.groups.filter(x => x.cls === '8L')[0];
      if (!g || g.pupils.map(p => p.name).join() !== 'Leaver 0,Leaver 1,Leaver 2,Leaver 3' || g.total !== 5 || g.pupils.some(p => p.why !== 'course'))
        throw new Error('8L, whose course was not imported: ' + JSON.stringify(g));
      if (emails.indexOf('hand.added@x.kr') >= 0 || emails.indexOf('teacher.row@x.kr') >= 0) throw new Error('a pupil added by hand, or the TEST row, was listed');
      global.Classroom = { Courses: { list: () => ({ courses: [] }), Students: { list: () => ({ students: [] }) } } };
      let d; try { d = getBatchImportData(); } finally { global.Classroom = undefined; }
      if (!d.left || d.left.n !== v.n || d.left.imported !== 1) throw new Error('the window does not get the list when it opens: ' + JSON.stringify(d.left).slice(0, 160));
      importOne('cL', '8L', [0, 1, 2].map(i => kid('Leaver', i)));
      ({ v, emails } = listed());
      if (emails.filter(e => /^leaver/.test(e)).join() !== 'leaver3@x.kr') throw new Error('after 8L was imported: ' + emails.filter(e => /^leaver/.test(e)).join(', '));
    });

    ok &= run('a pupil Classroom lists with no address is still in their course, by their Classroom user id', () => {
      importOne('cM', '8M', [kid('Stayer', 0), kid('Stayer', 1), { userId: 'u-Stayer2', profile: { name: { fullName: 'Stayer 2' } } }]);
      if (listed().emails.indexOf('stayer2@x.kr') >= 0) throw new Error('a pupil with no address from Classroom was listed as no longer in the course');
    });

    ok &= run('one press: the ticked pupils go to LEFT <year> on the Students tab and on their row of every lab, Bio English and Write-Up tab; only pupils still in none of this year’s classes', () => {
      _enRowFor_(_englishSheet_(), 'leaver3@x.kr', { name: 'Leaver 3', cls: '8L' });
      _wuRowFor_(_writeupSheet_(), 'leaver3@x.kr', { name: 'Leaver 3', cls: '8L' });
      const r = markPupilsLeft(['LEAVER3@x.kr ', 'stayer0@x.kr', 'nobody@x.kr']);
      if (!r.ok || !new RegExp('^1 pupil is in ' + label + ' now').test(r.note)) throw new Error('refused: ' + JSON.stringify(r).slice(0, 200));
      if (clsOf('leaver3@x.kr') !== label) throw new Error('the Students tab says ' + clsOf('leaver3@x.kr'));
      if (clsOf('stayer0@x.kr') !== '8M') throw new Error('a pupil in a class imported this year was marked');
      ['Digestion', T_ENGLISH, T_WRITEUP].forEach(tab => {
        const em = tab === T_ENGLISH ? EN_EMAIL : tab === T_WRITEUP ? WU_EMAIL : LAB_EMAIL, sh = ss.getSheetByName(tab);
        const row = sh.getRange(2, 1, sh.getLastRow() - 1, em).getValues().filter(x => x[em - 1] === 'leaver3@x.kr')[0];
        if (!row || row[1] !== label) throw new Error('their ' + tab + ' row says ' + (row && row[1]));
      });
      if (r.left.groups.some(g => g.pupils.some(p => p.email === 'leaver3@x.kr'))) throw new Error('they are still on the window’s list');
      const again = markPupilsLeft(['leaver3@x.kr']);
      if (again.ok !== false || !/Nobody to mark/.test(again.why)) throw new Error('marked twice: ' + JSON.stringify(again).slice(0, 120));
    });

    ok &= run('marking waits for a running import, needs a tick, and is for teachers only', () => {
      _saveImportJob_({ id: 'jobBusyLeft', sels: [], i: 0, phase: 'classes', tickAt: Date.now(), finishTries: 0 });
      try {
        const r = markPupilsLeft(['leaver2@x.kr']);
        if (r.ok !== false || !/import is still running/.test(r.why)) throw new Error('marked while an import runs: ' + JSON.stringify(r).slice(0, 120));
        if (!_notThisYearView_().busy) throw new Error('the window is not told an import is running');
      } finally { _clearImportJob_(); }
      if (markPupilsLeft([]).ok !== false) throw new Error('nothing ticked was accepted');
      const was = VISITOR; VISITOR = 'kid@pupils.x.kr';
      try {
        if (markPupilsLeft(['leaver2@x.kr']).ok !== false) throw new Error('a pupil marked somebody');
        if (getNotThisYear() !== null) throw new Error('a pupil read the list');
      } finally { VISITOR = was; }
    });

    ok &= run('in LEFT: out of every class list, the class views and every new homework; on the Students view still; homework set while they were in the class keeps them', () => {
      const dir = _studentDirectory_();
      if (dir.classes.indexOf(label) >= 0) throw new Error('LEFT is offered as a class');
      if (!dir.students.some(x => x.email === 'leaver3@x.kr' && x.cls === label)) throw new Error('the Students view lost them');
      if (_labProgressData_().students.some(x => x.name === 'Leaver 3')) throw new Error('Lab progress still shows them');
      if (_englishProgressData_().students.some(x => x.email === 'leaver3@x.kr')) throw new Error('Bio English still shows them');
      const H = _homeworkData_();
      if (H.students.some(x => x.email === 'leaver3@x.kr') || H.classes.indexOf(label) >= 0) throw new Error('Set homework still offers them');
      if (!hwOf(before).pupils.some(x => x.name === 'Leaver 3' && x.cls === label)) throw new Error('the homework set while they were in 8L lost them');
      const now = setHw({ classes: [{ cls: '8L', due: '2027-03-02T23:59:00' }] });
      if (hwOf(now).pupils.some(x => x.name === 'Leaver 3')) throw new Error('a new 8L homework takes them in');
      const chosen = setHw({ classes: [{ cls: '', due: '2027-03-02T23:59:00', emails: ['leaver3@x.kr', 'leaver0@x.kr'] }] });
      if (hwOf(chosen).pupils.map(x => x.name).join() !== 'Leaver 0') throw new Error('homework for chosen pupils took in a pupil in LEFT: ' + hwOf(chosen).pupils.map(x => x.name));
      const r = homeworkCreate({ title: 'For LEFT', tasks: task, classes: [{ cls: label, due: '2027-03-02T23:59:00' }] });
      if (r.ok !== false || !/not a class/.test(r.why)) throw new Error('homework was set for LEFT: ' + JSON.stringify(r).slice(0, 120));
    });

    ok &= run('a new homework’s Classroom list never takes in a pupil marked LEFT who is still in the course', () => {
      global.Classroom = { Courses: { Students: { list: (cid) => ({ students: cid === 'cL' ? [0, 1, 2, 3].map(i => ({ userId: 'u-Leaver' + i, profile: { emailAddress: 'leaver' + i + '@x.kr' } })) : [] }) } } };
      let id; try { id = setHw({ classes: [{ cls: '8L', due: '2027-03-03T23:59:00' }] }); } finally { global.Classroom = undefined; }
      const row = _homeworkRows_().filter(x => x.id === id)[0];
      if (!row.inCourse || row.inCourse.indexOf('leaver0@x.kr') < 0) throw new Error('the course list was not kept, so this proves nothing: ' + JSON.stringify(row.inCourse));
      if (row.inCourse.indexOf('leaver3@x.kr') >= 0) throw new Error('the pupil marked LEFT is in it through Classroom');
    });

    ok &= run('importing their class again puts them back; Move takes a pupil out of every class, and brings one back', () => {
      importOne('cL', '8L', [0, 1, 2, 3].map(i => kid('Leaver', i)));
      if (clsOf('leaver3@x.kr') !== '8L') throw new Error('importing their class did not put them back: ' + clsOf('leaver3@x.kr'));
      let r = studentMove({ email: 'leaver2@x.kr', left: true });
      if (!r.ok || clsOf('leaver2@x.kr') !== label || !/none of the classes/.test(r.note) || !/the next import puts them back/.test(r.note)) throw new Error('Move to LEFT: ' + JSON.stringify(r).slice(0, 200));
      if ((labRow('Digestion', 'leaver2@x.kr') || [])[1] !== label) throw new Error('their Digestion row was not moved');
      if (r.data.classes.indexOf(label) >= 0) throw new Error('LEFT came back as a class');
      r = studentMove({ email: 'leaver2@x.kr', left: true });
      if (r.ok !== false || !/none of the classes already/.test(r.why)) throw new Error('twice: ' + JSON.stringify(r).slice(0, 120));
      r = studentMove({ email: 'leaver1@x.kr', cls: label.toLowerCase() });
      if (r.ok !== false || !/Left: in no class/.test(r.why)) throw new Error('LEFT typed as a class: ' + JSON.stringify(r).slice(0, 120));
      r = studentMove({ email: 'leaver2@x.kr', cls: '8L' });
      if (!r.ok || clsOf('leaver2@x.kr') !== '8L' || (labRow('Digestion', 'leaver2@x.kr') || [])[1] !== '8L') throw new Error('Move did not bring them back: ' + JSON.stringify(r).slice(0, 160));
    });

    ok &= run('an import refuses an empty class code, and LEFT, in words, and changes nothing', () => {
      courses.cZ = [kid('Zed', 0)]; global.Classroom = classroom();
      try {
        [['', /No class code/], ['LEFT', /LEFT is kept/], [label, /LEFT is kept/]].forEach(([code, re]) => {
          const r = _importOneClass_({ courseId: 'cZ', classCode: code, courseName: 'Z' }, 'jobZ');
          if (r.status !== 'error' || !re.test(r.error)) throw new Error(JSON.stringify(code) + ' → ' + JSON.stringify(r));
        });
      } finally { global.Classroom = undefined; }
      if (clsOf('zed0@x.kr') !== null) throw new Error('a pupil was added');
      if (JSON.parse(props.get('IMPORTED_COURSES_' + sy)).at.cZ !== undefined) throw new Error('a refused class counts as imported');
    });

    ok &= run('a reminder never names a pupil Classroom no longer lists in the course: one id the course does not have fails the whole post', () => {
      global.Classroom = { Courses: { Students: { list: (cid) => ({ students: cid === 'cR' ? [{ userId: 'u-stay', profile: { emailAddress: 'stay@x.kr' } }] : [] }) } } };
      let ids;
      try { ids = _freshIds_({ 'stay@x.kr': { userId: 'old', courseId: 'cR' }, 'gone@x.kr': { userId: 'u-gone', courseId: 'cR' }, 'other@x.kr': { userId: 'u-o', courseId: 'cQ' } }, 'cR', {}); }
      finally { global.Classroom = undefined; }
      if (ids['stay@x.kr'].userId !== 'u-stay') throw new Error('the course’s own id was not taken');
      if (ids['gone@x.kr'].userId || ids['gone@x.kr'].courseId) throw new Error('a pupil no longer in the course is still named to it: ' + JSON.stringify(ids['gone@x.kr']));
      if (ids['other@x.kr'].courseId !== 'cQ' || ids['other@x.kr'].userId !== 'u-o') throw new Error('a pupil of another course was changed');
    });
    /* ── the audit (7 Oct 2026) ── */
    ok &= run('audit: a new homework counts a pupil through its Classroom course only if they are in its class now (a mover, a split course, a TEST account)', () => {
      global.Classroom = { Courses: { Students: { list: (cid) => ({ students: cid === 'cL' ? [0, 1, 2, 3].map(i => ({ userId: 'u-Leaver' + i, profile: { emailAddress: 'leaver' + i + '@x.kr' } }))
        .concat([{ userId: 'u-Stayer2', profile: { emailAddress: 'stayer2@x.kr' } }, { userId: 'u-t', profile: { emailAddress: 'teacher.row@x.kr' } }]) : [] }) } } };
      let id; try { id = setHw({ classes: [{ cls: '8L', due: '2027-03-04T23:59:00' }] }); } finally { global.Classroom = undefined; }
      const names = hwOf(id).pupils.map(x => x.name);
      if (names.indexOf('Stayer 2') >= 0 || names.indexOf('Teacher Row') >= 0) throw new Error('taken in through the course: ' + names.join(', '));
      if (_hwIsFor_(_homeworkRows_().filter(x => x.id === id)[0], 'stayer2@x.kr', '8M')) throw new Error('their own page would colour it');
    });
    ok &= run('audit: Move gives a pupil the course of their new class, so the old course’s next import never lists them', () => {
      const r = studentMove({ email: 'stayer1@x.kr', cls: '8L' });
      if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 160));
      const sh = ss.getSheetByName('Students'), ec = _emailCol_(sh), cc = _headerCol_(sh, 'Course id', ec + 4);
      const row = sh.getRange(2, 1, sh.getLastRow() - 1, cc).getDisplayValues().filter(x => x[ec - 1] === 'stayer1@x.kr')[0];
      if (!row || row[cc - 1] !== 'cL') throw new Error('Course id: ' + (row && row[cc - 1]));
      importOne('cM', '8M', [kid('Stayer', 0), kid('Stayer', 2)]);          /* 8M's course no longer lists the mover */
      if (listed().emails.indexOf('stayer1@x.kr') >= 0) throw new Error('the mover is listed under the old course');
    });
    ok &= run('audit: Left marks every row of an address; LEFT is never a class to choose on the Students tab', () => {
      const sh = ss.getSheetByName('Students'), ec = _emailCol_(sh);
      const src = sh.getRange(2, 1, sh.getLastRow() - 1, ec).getValues().findIndex(x => x[ec - 1] === 'leaver1@x.kr') + 2;
      const copy = sh.getRange(src, 1, 1, ec).getValues()[0]; sh.appendRow(copy);           /* the same address, a second row */
      importOne('cL', '8L', [kid('Leaver', 0), kid('Leaver', 2), kid('Leaver', 3)]);
      const r = markPupilsLeft(['leaver1@x.kr']);
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, ec).getValues().filter(x => x[ec - 1] === 'leaver1@x.kr').map(x => x[1]);
      if (!r.ok || rows.length !== 2 || rows.some(c => c !== label)) throw new Error(JSON.stringify([r.ok, rows]));
      if (_classList_().some(c => /^LEFT/.test(c))) throw new Error('the class list offers ' + _classList_().join(', '));
      const last = sh.getLastRow(); sh.deleteRows(last, 1);
      importOne('cL', '8L', [0, 1, 2, 3].map(i => kid('Leaver', i)));     /* back, for the tests after */
    });
    ok &= run('audit: in a later school year nothing can be marked before a course is imported (a window opened on 31 July)', () => {
      const keep = record().map(k => [k, props.get(k)]);
      record().forEach(k => props.delete(k)); props.set('IMPORTED_COURSES_FROM', String(sy - 1)); props.set('IMPORTED_LIST_' + (sy - 1) + '_cL', '[]');
      const r = markPupilsLeft(['leaver1@x.kr']);
      const lastYear = props.get('IMPORTED_LIST_' + (sy - 1) + '_cL');
      record().forEach(k => props.delete(k)); keep.forEach(([k, v]) => props.set(k, v));
      if (r.ok !== false || !/Nothing has been imported since 1 August/.test(r.why) || clsOf('leaver1@x.kr') !== '8L') throw new Error(JSON.stringify(r).slice(0, 160));
      if (lastYear) throw new Error('last year’s list of addresses was kept: it is never read');
    });
    ok &= run('audit: the first year’s record counts only courses still active in Classroom: last year’s archived course is found', () => {
      const keep = record().map(k => [k, props.get(k)]);
      record().forEach(k => props.delete(k));
      const v = _notThisYearView_(null, ['cM']);                          /* cL is archived: not offered by Classroom */
      const emails = [].concat(...v.groups.map(g => g.pupils.map(p => p.email)));
      record().forEach(k => props.delete(k)); keep.forEach(([k, val]) => props.set(k, val));
      if (!['leaver0@x.kr', 'leaver3@x.kr'].every(e => emails.indexOf(e) >= 0) || ['stayer0@x.kr', 'stayer2@x.kr'].some(e => emails.indexOf(e) >= 0)) throw new Error(emails.join(', ').slice(0, 300));
    });
    ok &= run('audit: a reminder keeps a pupil Classroom still lists in the course without an address', () => {
      global.Classroom = { Courses: { Students: { list: () => ({ students: [{ userId: 'u-na', profile: {} }] }) } } };
      let ids; try { ids = _freshIds_({ 'noaddr@x.kr': { userId: 'u-na', courseId: 'cR' } }, 'cR', {}); } finally { global.Classroom = undefined; }
      if (ids['noaddr@x.kr'].userId !== 'u-na') throw new Error(JSON.stringify(ids));
    });
    ok &= run('audit: a save that read the pupil before a Move or Left reads them again under the lock', () => {
      const readAt = Date.now() - 5000, was = { name: 'Leaver 2', cls: 'OLDCLASS' };
      if (_freshStudent_('leaver2@x.kr', was, readAt + 60000).cls !== 'OLDCLASS') throw new Error('it re-read with nothing changed since');
      _classesChanged_();
      if (_freshStudent_('leaver2@x.kr', was, readAt).cls !== clsOf('leaver2@x.kr')) throw new Error('it kept the class it read before the change');
    });
    ok &= run('audit: a lab’s question words are kept under the hub’s station list too (a lab pushed before its hub)', () => {
      const src = SRC.slice(SRC.indexOf('function _labQuestions_('), SRC.indexOf('function _labQuestions_(') + 2500);
      if (!/var KEY = 'LABQ_' \+ lab\.id \+ '_' \+ \(ver \|\| 'none'\) \+ '_' \+ \(hubStamp/.test(src)) throw new Error('the cache key is the lab’s version alone');
    });
  } finally {
    VISITOR = OWNER; made.forEach(id => { try { homeworkDelete(id); } catch (e) {} });
    CLIENT_ID = keepCid; TEACHERS = ''; props.delete('TEACHERS'); global.Classroom = undefined;
    try { _clearImportJob_(); } catch (e) {}
    record().forEach(k => props.delete(k));
  }
}

console.log('— this script’s own pass —');
/* 6 Oct 2026, Daniel: a pupil shown as signed in must be synced "no matter what". Google's sign-in lasts an hour; the script
   gives a pass of its own (HMAC under a secret kept only in Script Properties), good for 30 days, for saving and the pupil's
   own practice only. */
{
  const keepCid = CLIENT_ID, keepTok = TOKEN_EMAIL, realNow = Date.now, keepUi = SpreadsheetApp.getUi, keepTracker = props.get('TRACKER_ID');
  CLIENT_ID = 'CID'; TOKEN_EMAIL = 'ana@x.kr'; props.set('TRACKER_ID', 'tracker');
  const J = (body) => JSON.parse(String(doPost({ postData: { contents: JSON.stringify(body) } })));
  const passFor = (email) => { TOKEN_EMAIL = email; const j = J({ action: 'pass', token: TOK }); TOKEN_EMAIL = 'ana@x.kr'; return j; };
  /* Google's sign-in from two hours ago: the script turns it away itself, before any call to Google */
  const OLD = jwt({ aud: 'CID', exp: Math.floor(Date.now() / 1000) - 7200, email: 'ana@x.kr' });
  const rowOf = email => { const sh = ss.getSheetByName('Digestion');
    return sh.getRange(2, 1, sh.getLastRow() - 1, LAB_COLS.length).getValues().filter(r => String(r[LAB_EMAIL - 1]).toLowerCase() === email)[0]; };
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const mac = (b, key) => require('crypto').createHmac('sha256', key).update(b).digest('base64url');
  try {
    ok &= run('a pass is given for Google’s own sign-in, to a pupil on the class list or a teacher, and the answer holds nothing else', () => {
      props.delete('PASS_SECRET');
      const j = passFor('ana@x.kr');
      if (!j.ok || !/^p1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{40,60}$/.test(j.pass)) throw new Error(JSON.stringify(j));
      if (Object.keys(j).sort().join() !== 'exp,ok,pass') throw new Error('the answer holds ' + Object.keys(j));
      const days = (j.exp - Date.now()) / 864e5;
      if (days < 29.9 || days > 30.1) throw new Error('it lasts ' + days + ' days');
      const secret = props.get('PASS_SECRET');
      if (!secret || secret.length < 64) throw new Error('no secret was made: ' + secret);
      if (JSON.stringify(j).indexOf(secret) >= 0 || SRC.indexOf(secret) >= 0) throw new Error('the secret is in the answer or the code');
      if (passFor('ana@x.kr').pass === j.pass && false) throw new Error('unreachable');
      if (!passFor(OWNER).ok) throw new Error('a teacher got no pass');
      const s = passFor('stranger@elsewhere.com');
      if (s.ok || s.why !== 'not on this class list') throw new Error('a stranger: ' + JSON.stringify(s));
      const old = J({ action: 'pass', token: OLD });
      if (old.ok || old.why !== 'not signed in') throw new Error('an out-of-date Google sign-in got a pass: ' + JSON.stringify(old));
    });
    ok &= run('a pass never makes a pass, so a stolen one cannot be kept alive', () => {
      const P = passFor('ana@x.kr').pass;
      const j = J({ action: 'pass', pass: P }), k = J({ action: 'pass', token: OLD, pass: P });
      if (j.ok || j.why !== 'not signed in' || k.ok || k.why !== 'not signed in') throw new Error(JSON.stringify([j, k]));
    });
    ok &= run('Google’s hour is up: a save with the pass is recorded, at the script’s own time, with no call to Google', () => {
      const P = passFor('ana@x.kr').pass, f0 = FETCHES, t0 = Date.now(), seen = Number(rowOf('ana@x.kr')[9]) || 0;
      const out = hand({ token: OLD, pass: P, score: 1, total: QN, checks: 987654 });
      if (!/^recorded/.test(out)) throw new Error(out);
      const r = rowOf('ana@x.kr');
      if (Number(r[6]) !== 987654 || Number(r[9]) !== seen + 1) throw new Error('the save was not written: checks ' + r[6] + ', saves ' + r[9]);
      const at = new Date(r[10]).getTime();
      if (!(at >= t0 && at <= Date.now())) throw new Error('Last saved is not the script’s own time: ' + r[10]);
      if (FETCHES !== f0) throw new Error((FETCHES - f0) + ' call(s) to Google for an out-of-date sign-in and a pass');
    });
    ok &= run('a pass altered, stamped with another secret, out of date or dated too far ahead is refused', () => {
      const P = passFor('ana@x.kr').pass, [h, body, sig] = P.split('.');
      const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
      const tries = {
        'another pupil’s email, the stamp kept': h + '.' + enc(Object.assign({}, claims, { e: 'dee@x.kr' })) + '.' + sig,
        'one letter of the stamp changed': h + '.' + body + '.' + (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1),
        'stamped with another secret': (() => { const b = h + '.' + enc(Object.assign({}, claims, { e: 'dee@x.kr' })); return b + '.' + mac(b, 'f'.repeat(128)); })(),
        'no stamp': h + '.' + body + '.',
        'another kind': 'p2.' + body + '.' + sig,
        'not text': { e: 'ana@x.kr' }
      };
      for (const [what, p] of Object.entries(tries)) {
        const out = hand({ token: OLD, pass: p, score: 1, total: QN });
        if (out !== 'not recorded: not signed in') throw new Error(what + ': ' + out);
      }
      Date.now = () => realNow() + 31 * 864e5;
      try { const out = hand({ token: OLD, pass: P, score: 1, total: QN }); if (out !== 'not recorded: not signed in') throw new Error('31 days on: ' + out); }
      finally { Date.now = realNow; }
      /* a good stamp on a date further ahead than any pass is made (how a leaked secret would show): refused */
      const b = 'p1.' + enc(Object.assign({}, claims, { x: Date.now() + 400 * 864e5 }));
      const far = hand({ token: OLD, pass: b + '.' + mac(b, props.get('PASS_SECRET')), score: 1, total: QN });
      if (far !== 'not recorded: not signed in') throw new Error('400 days ahead: ' + far);
    });
    ok &= run('a pass opens only a pupil’s own saving and practice: never the reflection record, a test, or the teacher page', () => {
      const P = passFor('ana@x.kr').pass;
      const rec = J({ action: 'record', pass: P }), tst = J({ action: 'test', pass: P });
      if (rec.ok || rec.why !== 'not signed in' || tst.ok || tst.why !== 'not signed in') throw new Error(JSON.stringify([rec, tst]));
      const pr = J({ action: 'progress', token: OLD, pass: P });
      if (!pr.ok || !pr.labs || !pr.labs['digestion-lab']) throw new Error('progress: ' + JSON.stringify(pr).slice(0, 160));
      const TP = passFor(OWNER).pass;
      const viaPass = J({ action: 'english.mine', token: OLD, pass: TP }), wu = J({ action: 'writeup.mine', token: OLD, pass: TP });
      TOKEN_EMAIL = OWNER; const viaGoogle = J({ action: 'english.mine', token: TOK }); TOKEN_EMAIL = 'ana@x.kr';
      if (!viaPass.ok || 'teacher' in viaPass || 'teacherPage' in viaPass) throw new Error('english.mine with a pass: ' + JSON.stringify(viaPass));
      if (!wu.ok || 'teacher' in wu || 'teacherPage' in wu) throw new Error('writeup.mine with a pass: ' + JSON.stringify(wu));
      if (!viaGoogle.teacher) throw new Error('english.mine with Google’s own sign-in lost the teacher’s way in');
    });
    ok &= run('every use still asks the class list: a teacher’s pass saves nothing in a lab', () => {
      const out = hand({ token: OLD, pass: passFor(OWNER).pass, name: 'T', score: 1, total: QN });
      if (!/^not recorded: not on this class list/.test(out)) throw new Error(out);
    });
    ok &= run('Bio English and the Write-Up Lab save with a pass too; Google’s good sign-in still wins over a pass for someone else', () => {
      const P = passFor(enA.email).pass;
      const e = J({ action: 'english.save', token: OLD, pass: P, sets: { 't3.kw.meanings': { done: 1, first: 1, total: 4, snap: 'f000', v: 'k1', go: 1, snap1: 'f000', best: 'f000' } } });
      if (!e.ok || e.saved !== 1) throw new Error('english.save: ' + JSON.stringify(e));
      const w = J({ action: 'writeup.save', token: OLD, pass: P, parts: { variables: { v: 'vv1', l: '1000000', r: { g: '10000' }, q: 'f0000000' } } });
      if (!w.ok || w.saved !== 1) throw new Error('writeup.save: ' + JSON.stringify(w));
      const deeBefore = Number(rowOf('dee@x.kr')[9]) || 0, anaBefore = Number(rowOf('ana@x.kr')[9]) || 0;
      const out = hand({ token: TOK, pass: passFor('dee@x.kr').pass, score: 1, total: QN });
      if (!/^recorded/.test(out) || Number(rowOf('dee@x.kr')[9]) !== deeBefore || Number(rowOf('ana@x.kr')[9]) !== anaBefore + 1)
        throw new Error('a save with Ana’s Google sign-in and Dee’s pass went to the wrong row: ' + out);
    });
    ok &= run('🔑 in the menu cancels every pass at once (after a question); the next pass made works', () => {
      const P = passFor('ana@x.kr').pass, said = [];
      let answer = 'NO';
      SpreadsheetApp.getUi = () => Object.assign(keepUi(), { ButtonSet: { OK: 1, YES_NO: 2 }, Button: { YES: 'YES', NO: 'NO' },
        alert: (a, b, c) => { said.push(String(b)); return c === 2 ? answer : 'OK'; } });
      newPassSecretMENU_();
      if (!/^recorded/.test(hand({ token: OLD, pass: P, score: 1, total: QN }))) throw new Error('"No" cancelled the passes');
      answer = 'YES'; newPassSecretMENU_();
      const out = hand({ token: OLD, pass: P, score: 1, total: QN });
      if (out !== 'not recorded: not signed in') throw new Error('an old pass after 🔑: ' + out);
      if (!/^recorded/.test(hand({ token: OLD, pass: passFor('ana@x.kr').pass, score: 1, total: QN }))) throw new Error('a new pass after 🔑 does not save');
      if (!/sign in again/.test(said.join(' ')) || !/Nothing they did is lost/.test(said.join(' '))) throw new Error('the question does not say what pupils will see: ' + said.join(' | '));
    });
    ok &= run('a refused save (numbers that do not add up) keeps no sign-in and no pass in the Rejected tab (audit, 6 Oct 2026)', () => {
      const P = passFor('ana@x.kr').pass;
      const out = hand({ token: OLD, pass: P, score: 5, total: 2 });
      if (!/^rejected/.test(out)) throw new Error(out);
      const rj = ss.getSheetByName('Rejected'), row = rj.getRange(rj.getLastRow(), 1, 1, rj.getLastColumn()).getValues()[0].join(' ');
      if (row.indexOf(P) >= 0 || row.indexOf(OLD) >= 0 || /"(token|pass)"/.test(row)) throw new Error('the Rejected row keeps a credential: ' + row.slice(0, 200));
      if (!/"score":5/.test(row)) throw new Error('the Rejected row lost the body it is there for: ' + row.slice(0, 200));
    });
    ok &= run('🔑 while saves hold the lock: nothing is cancelled, and the teacher is told to try again (audit, 6 Oct 2026)', () => {
      const P = passFor('ana@x.kr').pass, said = [], keepLock = LockService.getScriptLock;
      SpreadsheetApp.getUi = () => Object.assign(keepUi(), { ButtonSet: { OK: 1, YES_NO: 2 }, Button: { YES: 'YES', NO: 'NO' },
        alert: (a, b, c) => { said.push(String(a) + ' ' + String(b)); return c === 2 ? 'YES' : 'OK'; } });
      LockService.getScriptLock = () => ({ waitLock: () => { throw new Error('Lock timeout: another process was holding the lock for too long.'); }, releaseLock: () => {} });
      let threw = '';
      try { newPassSecretMENU_(); } catch (e) { threw = e.message; } finally { LockService.getScriptLock = keepLock; }
      if (threw) throw new Error('a raw error reached the teacher: ' + threw);
      if (!/[Tt]ry again/.test(said.join(' '))) throw new Error('the teacher was not told: ' + said.join(' | '));
      if (!/^recorded/.test(hand({ token: OLD, pass: P, score: 1, total: QN }))) throw new Error('the passes were cancelled anyway');
    });
    ok &= run('a long or unusual name (Hangul, an emoji, half an emoji) still gets a pass that works (audit, 6 Oct 2026)', () => {
      for (const name of ['김'.repeat(200), 'Ana 😀'.repeat(40), 'Ana ' + String.fromCharCode(0xD83D)]) {
        let p = null;
        try { p = _issuePass_({ email: 'ana@x.kr', name: name }); } catch (e) { throw new Error('making a pass threw for ' + name.slice(0, 12) + ': ' + e.message); }
        const who = p && _whoByPass_(p.pass);
        if (!who || who.email !== 'ana@x.kr') throw new Error('the pass made for ' + JSON.stringify(name.slice(0, 12)) + ' is refused');
      }
    });
  } finally {
    Date.now = realNow; SpreadsheetApp.getUi = keepUi; CLIENT_ID = keepCid; TOKEN_EMAIL = keepTok;
    if (keepTracker == null) props.delete('TRACKER_ID'); else props.set('TRACKER_ID', keepTracker);
  }
}

console.log('— changing a due date from the teacher page (Daniel, 6 Oct 2026) —');
/* "if I decide to change the due date, I can do it from the website and I don't have to go to Google Classroom" */
{
  const PATCHES = [], CREATES = [], made = [];
  let patchFail = '';
  const fake = () => ({ Courses: { CourseWork: {
    create: (body, courseId) => { CREATES.push({ body, courseId }); return { id: 'cw-due-' + CREATES.length }; },
    patch: (body, courseId, id, opt) => { if (patchFail) throw new Error(patchFail); PATCHES.push({ body, courseId, id, opt }); return Object.assign({ id }, body); } } } });
  const task = [{ labId:'digestion-lab', stationIds:['mouth'] }];
  const rowOf = id => _homeworkRows_().filter(h => h.id === id)[0];
  const setOne = o => { global.Classroom = fake();
    try { const r = homeworkCreate(Object.assign({ title:'Due test', post:true, classes:[{ cls: enA.cls, due:'2027-03-02' }], tasks: task }, o || {}));
          if (!r.ok) throw new Error('could not set it: ' + r.why); made.push(r.made[0]); return r.made[0]; }
    finally { global.Classroom = undefined; } };
  const change = d => { global.Classroom = fake(); try { return homeworkChangeDue(d); } finally { global.Classroom = undefined; } };
  const keep = { V: VISITOR, D: SCHOOL_DOMAIN, T: TEACHERS };
  try {
    SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
    ok &= run('the new date and time go into the 📚 Homework row and onto its Google Classroom assignment (its due date and time only)', () => {
      if (typeof homeworkChangeDue !== 'function') throw new Error('there is no homeworkChangeDue for the page to call');
      const id = setOne(), was = rowOf(id);
      if (!was.courseWork) throw new Error('the homework was not posted, so this proves nothing');
      PATCHES.length = 0;
      const r = change({ id, due:'2027-03-09', time:'08:30' });
      if (!r.ok) throw new Error('refused: ' + r.why);
      if (rowOf(id).due !== '2027-03-08T23:30:00.000Z') throw new Error('the row’s due is ' + rowOf(id).due + ' (08:30 in the school’s zone, UTC+9, is 23:30 UTC the day before)');
      if (PATCHES.length !== 1) throw new Error('Classroom was asked ' + PATCHES.length + ' times');
      const p = PATCHES[0];
      if (p.courseId !== was.course || p.id !== was.courseWork) throw new Error('the wrong assignment: ' + JSON.stringify(p).slice(0, 160));
      if (!p.opt || p.opt.updateMask !== 'dueDate,dueTime') throw new Error('more than the due was asked to change: ' + JSON.stringify(p.opt));
      if (JSON.stringify(p.body) !== JSON.stringify({ dueDate: { year: 2027, month: 3, day: 8 }, dueTime: { hours: 23, minutes: 30 } })) throw new Error('the due sent: ' + JSON.stringify(p.body));
      if (!/here and in Google Classroom/.test(r.note)) throw new Error('the page is not told: ' + r.note);
      if (!r.data || !r.data.homework.some(h => h.id === id && h.dueText === '9 Mar, 08:30' && h.dueDay === '2027-03-09' && h.dueHm === '08:30'))
        throw new Error('the list that comes back does not show the new date, ready for the boxes: ' + JSON.stringify(r.data && r.data.homework.filter(h => h.id === id)).slice(0, 300));
    });
    ok &= run('a date that has passed, a time that is not a time, no date, the same date, before a later start, or gone: refused in words, nothing changed', () => {
      const id = setOne(), later = setOne({ classes:[{ cls: enA.cls, due:'2027-03-20', start:'2027-03-10', startTime:'09:00' }] });
      PATCHES.length = 0;
      [[{ id, due:'2026-01-05' }, /has passed/], [{ id, due:'2027-03-09', time:'25:00' }, /not a time/], [{ id, due:'' }, /Give it a due date/],
       [{ id, due:'2027-03-02' }, /already its due time/], [{ id: later, due:'2027-03-09' }, /due after it starts/], [{ id:'HW-nope', due:'2027-03-09' }, /not there any more/]]
        .forEach(([d, re]) => { const r = change(d); if (r.ok !== false || !re.test(r.why)) throw new Error(JSON.stringify(d) + ' → ' + JSON.stringify(r).slice(0, 160)); });
      if (PATCHES.length) throw new Error('Google Classroom was changed for a refused date');
      if (rowOf(id).due !== '2027-03-02T14:59:59.000Z') throw new Error('the row changed: ' + rowOf(id).due);
    });
    ok &= run('only the teacher who set it, or the owner; never a pupil', () => {
      const id = setOne();
      TEACHERS = 'colleague@x.kr'; VISITOR = 'colleague@x.kr';
      const r = change({ id, due:'2027-03-10' });
      if (r.ok !== false || !/Only they \(or the owner\)/.test(r.why)) throw new Error('a colleague changed it: ' + JSON.stringify(r).slice(0, 120));
      VISITOR = 'pupil@pupils.x.kr';
      if (change({ id, due:'2027-03-10' }).ok !== false) throw new Error('a pupil changed it');
      VISITOR = OWNER;
      if (!change({ id, due:'2027-03-10' }).ok) throw new Error('the owner could not');
    });
    ok &= run('Classroom refusing: the date still changes here, and the page says to change it in Classroom by hand', () => {
      const id = setOne(); patchFail = 'ProjectPermissionDenied: The Developer Console project is not permitted to make this request.';
      let r; try { r = change({ id, due:'2027-03-11' }); } finally { patchFail = ''; }
      if (!r.ok || !/did not take it/.test(r.note) || !/by hand/.test(r.note)) throw new Error(JSON.stringify(r).slice(0, 200));
      if (!/^2027-03-11/.test(rowOf(id).due)) throw new Error('the row did not change: ' + rowOf(id).due);
    });
    ok &= run('homework never posted: only the row changes, and the page says there is nothing to change in Classroom', () => {
      const id = setOne({ post:false }); PATCHES.length = 0;
      const r = change({ id, due:'2027-03-12' });
      if (!r.ok || PATCHES.length || !/not posted to Google Classroom/.test(r.note)) throw new Error(JSON.stringify(r).slice(0, 200));
    });
    ok &= run('a reminder skipped for the old due time can go at the new one; one that went, or one skipped because the next went, never goes again', () => {
      const sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh);
      const put = (id, k, txt) => { const r = rowOf(id).row; sh.getRange(r, hc['Reminder ' + k]).setValue(new Date()); sh.getRange(r, hc['Reminder ' + k + ' students']).setValue(txt); };
      const a = setOne({ remind: true }), b = setOne({ remind: true }), c = setOne({ remind: true }), off = setOne();
      put(a, 1, 'skipped: the due time had passed'); put(a, 2, 'skipped: the due time had passed');
      put(b, 1, 'skipped: reminder 2 was due at the same time'); put(b, 2, '12');
      put(c, 1, '9'); put(c, 2, 'skipped: its time fell between 22:00 and 07:00, and 07:00 was too close to the due time');
      put(off, 1, 'skipped: the due time had passed');
      const said = {}; [a, b, c, off].forEach(id => { const r = change({ id, due:'2027-03-20' }); if (!r.ok) throw new Error('refused: ' + r.why); said[id] = r.note; });
      const st = id => rowOf(id).rem.map(x => (x.at ? 'at' : '-') + ':' + x.said).join(' | ');
      if (st(a) !== '-: | -:') throw new Error('both skipped reminders should wait for the new time: ' + st(a));
      if (st(b) !== 'at:skipped: reminder 2 was due at the same time | at:12') throw new Error('a reminder that went, or the one it replaced, changed: ' + st(b));
      if (st(c) !== 'at:9 | -:') throw new Error('reminder 1 went and reminder 2 was skipped: ' + st(c));
      if (!/skipped for the old due time/.test(said[a]) || !/skipped for the old due time/.test(said[c])) throw new Error('the page is not told: ' + said[a]);
      if (/skipped for the old due time/.test(said[b]) || /skipped for the old due time/.test(said[off])) throw new Error('told of a reminder that will not go: ' + said[b] + ' / ' + said[off]);
    });
    ok &= run('a summary already emailed for the old date goes again after the new one', () => {
      const id = setOne(), sh = ss.getSheetByName(T_HOMEWORK), hc = _hwHeadCols_(sh);
      sh.getRange(rowOf(id).row, hc.Status).setValue('reported'); sh.getRange(rowOf(id).row, hc.Reported).setValue(new Date());
      const r = change({ id, due:'2027-03-13' }), row = rowOf(id);
      if (!r.ok || row.status !== 'set' || row.reported) throw new Error('still reported: ' + row.status + ' ' + row.reported);
      if (!/summary/.test(r.note)) throw new Error('the page is not told: ' + r.note);
    });
  } finally {
    VISITOR = OWNER; made.forEach(id => { try { homeworkDelete(id); } catch (e) {} });
    VISITOR = keep.V; SCHOOL_DOMAIN = keep.D; TEACHERS = keep.T; props.delete('TEACHERS'); props.delete('SCHOOL_DOMAIN');
    global.Classroom = undefined;
  }
}

console.log('— the Archive of Set homework: Hide keeps everything, Remove deletes (Daniel, 7 Oct 2026) —');
/* "I think deleting a homework should just hide it, not remove it from everywhere else … it's worth having the homework set
   for all of the students throughout their whole progress"; "remove before the due date and hide after the due date"; the
   tips say what Remove does to Homework habits, and that a wrong date only needs Change the due date */
{
  const made = [];
  const task = [{ labId:'digestion-lab', stationIds:['mouth'] }];
  const tab = () => ss.getSheetByName(T_HOMEWORK);
  const rowOf = id => _homeworkRows_().filter(h => h.id === id)[0];
  const isDate = v => Object.prototype.toString.call(v) === '[object Date]';
  const setOne = o => { const r = homeworkCreate(Object.assign({ title:'Archive test', classes:[{ cls: enA.cls, due:'2027-03-02' }], tasks: task }, o || {}));
    if (!r.ok) throw new Error('could not set it: ' + r.why); made.push(r.made[0]); return r.made[0]; };
  /* set nine days ago, due two days ago: past its due date, and inside ⏱️ Homework habits' window */
  const pastDue = id => { const hc = _hwHeadCols_(tab()), r = rowOf(id).row;
    tab().getRange(r, hc.Created).setValue(new Date(Date.now() - 9 * 864e5)); tab().getRange(r, hc.Due).setValue(new Date(Date.now() - 2 * 864e5)); };
  const keep = { V: VISITOR, D: SCHOOL_DOMAIN, T: TEACHERS, H: HUB_URL, M: MANIFEST_JSON };
  /* the station list the pupils' own list scores against (the tests above left no hub address) */
  const freshMan = () => { for (const k of Array.from(cacheStore.keys())) if (/^(STATIONS_MANIFEST_|HUB_STAMP)/.test(k)) cacheStore.delete(k); };
  try {
    SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;
    HUB_URL = 'https://hub.test';
    MANIFEST_JSON = JSON.stringify({ generated:'t', labs: { 'digestion-lab': { name:'Digestion', questions:123,
      stations:[ { id:'mouth', name:'Mouth and teeth', questions:8 }, { id:'stomach', name:'Stomach', questions:9 } ] } } });
    freshMan();
    ok &= run('homework still to come cannot be hidden; the refusal points to Remove for a mistake and to a new due date', () => {
      if (typeof homeworkHide !== 'function') throw new Error('there is no homeworkHide for the page to call');
      const id = setOne(), r = homeworkHide({ id, hide: true });
      if (r.ok !== false || !/due date has passed/.test(r.why) || !/Remove/.test(r.why) || !/change the due date/.test(r.why)) throw new Error(JSON.stringify(r).slice(0, 220));
      if (rowOf(id).hidden) throw new Error('it was hidden anyway');
    });
    ok &= run('past its due date, Hide writes the time under the last heading, Hidden, and the list says it is hidden; no other cell moves', () => {
      const id = setOne(); pastDue(id);
      const n = _HW_HEADERS_.length, row = rowOf(id).row, before = JSON.stringify(tab().getRange(row, 1, 1, n - 1).getValues()[0]);
      const r = homeworkHide({ id, hide: true });
      if (!r.ok) throw new Error('refused: ' + r.why);
      const head = tab().getRange(1, 1, 1, tab().getLastColumn()).getValues()[0].map(x => String(x).replace(/^\u270e\s*/, '').trim());
      if (head.indexOf('Hidden') !== n - 1) throw new Error('Hidden is not the last heading: ' + head.join(', '));
      const cell = tab().getRange(row, n).getValue();
      if (!isDate(cell) || Math.abs(cell.getTime() - Date.now()) > 60000) throw new Error('the Hidden cell holds ' + cell);
      if (JSON.stringify(tab().getRange(row, 1, 1, n - 1).getValues()[0]) !== before) throw new Error('another cell of the row changed');
      const h = r.data.homework.filter(x => x.id === id)[0];
      if (!h || h.hidden !== true || !h.overdue || !/^\d{1,2} [A-Z][a-z]{2}, \d\d:\d\d$/.test(h.hiddenText))
        throw new Error('the page is not told: ' + JSON.stringify(h && { hidden: h.hidden, overdue: h.overdue, t: h.hiddenText }));
    });
    ok &= run('hidden homework still counts everywhere else: the pupil’s own list, ⏱️ Homework habits, and the teacher’s list, marked hidden', () => {
      const id = setOne(); pastDue(id);
      const mine = () => _ownHomework_(enA.email, enA.cls).map(x => x.id).indexOf(id) >= 0;
      const habits = () => _habitsData_(Date.now()).homework.map(x => x.id).indexOf(id) >= 0;
      if (!mine() || !habits()) throw new Error('before hiding it is not in the pupil’s list (' + mine() + ') or Homework habits (' + habits() + '): this proves nothing');
      if (!homeworkHide({ id, hide: true }).ok) throw new Error('could not hide it');
      if (!mine()) throw new Error('hiding took it off the pupil’s own list');
      if (!habits()) throw new Error('hiding took it out of ⏱️ Homework habits');
      if (!_homeworkData_(undefined, OWNER).homework.some(x => x.id === id && x.hidden)) throw new Error('the teacher’s list lost it: it must stay there, marked hidden');
    });
    ok &= run('Show it again empties the cell; hiding twice, or showing twice, changes nothing', () => {
      const id = setOne(); pastDue(id);
      const cellOf = () => tab().getRange(rowOf(id).row, _HW_HEADERS_.length).getValue();
      homeworkHide({ id, hide: true });
      const at = String(cellOf());
      if (!homeworkHide({ id, hide: true }).ok || String(cellOf()) !== at) throw new Error('hiding again moved its time');
      const r = homeworkHide({ id, hide: false });
      if (!r.ok || rowOf(id).hidden || cellOf() !== '') throw new Error('not shown again: ' + JSON.stringify(r).slice(0, 120) + ' / ' + cellOf());
      if (!homeworkHide({ id, hide: false }).ok || rowOf(id).hidden) throw new Error('showing twice went wrong');
    });
    ok &= run('only the teacher who set it, or the owner, hides it; never a pupil; never homework that is not there', () => {
      const id = setOne(); pastDue(id);
      TEACHERS = 'colleague@x.kr'; VISITOR = 'colleague@x.kr';
      const r = homeworkHide({ id, hide: true });
      if (r.ok !== false || !/Only they \(or the owner\)/.test(r.why)) throw new Error('a colleague hid it: ' + JSON.stringify(r).slice(0, 120));
      VISITOR = 'pupil@pupils.x.kr';
      if (homeworkHide({ id, hide: true }).ok !== false) throw new Error('a pupil hid it');
      VISITOR = OWNER;
      if (rowOf(id).hidden) throw new Error('hidden by somebody who may not');
      if (!homeworkHide({ id, hide: true }).ok) throw new Error('the owner could not');
      const no = homeworkHide({ id:'HW-nope', hide: true });
      if (no.ok !== false || !/not there any more/.test(no.why)) throw new Error('hiding nothing: ' + JSON.stringify(no));
      TEACHERS = keep.T; props.delete('TEACHERS');
    });
    ok &= run('a new due date lists hidden homework again, and the page is told', () => {
      const id = setOne(); pastDue(id);
      homeworkHide({ id, hide: true });
      const r = homeworkChangeDue({ id, due:'2027-04-01' });
      if (!r.ok) throw new Error('refused: ' + r.why);
      if (rowOf(id).hidden) throw new Error('still hidden, though students are doing it again');
      if (!/listed again/.test(r.note)) throw new Error('the page is not told: ' + r.note);
    });
    ok &= run('a tab from before Hidden, tidied over a teacher’s own column: words there never hide anything, and Hide never writes over them', () => {
      const id = setOne(); pastDue(id);
      const n = _HW_HEADERS_.length, sh = tab(), row = rowOf(id).row;
      sh.getRange(1, n).setValue('My notes'); sh.getRange(row, n).setValue('ring the parents');
      try {
        if (rowOf(id).hidden) throw new Error('a column headed My notes hid it');
        const r = homeworkHide({ id, hide: true });
        if (r.ok !== false || !/holds something else/.test(r.why)) throw new Error('Hide wrote into the teacher’s column: ' + JSON.stringify(r).slice(0, 160));
        if (sh.getRange(row, n).getValue() !== 'ring the parents') throw new Error('the note changed: ' + sh.getRange(row, n).getValue());
        sh.getRange(1, n).setValue('Hidden');      /* Tidy up writes its heading over that column */
        if (rowOf(id).hidden) throw new Error('words under the Hidden heading hid it');
        if (_homeworkData_(undefined, OWNER).homework.some(x => x.id === id && x.hidden)) throw new Error('the page was told it is hidden');
      } finally { sh.getRange(1, n).setValue('Hidden'); sh.getRange(row, n).setValue(''); }
    });
    ok &= run('Remove still deletes, before and after the due date', () => {
      const a = setOne(), b = setOne(); pastDue(b);
      if (!homeworkDelete(a).ok || rowOf(a)) throw new Error('homework still to come was not removed');
      if (!homeworkDelete(b).ok || rowOf(b)) throw new Error('homework past its due date was not removed');
    });
    ok &= run('the page: past its due date, homework is in a folded Archive, not the list; open, it has Hide, and Remove says what it does to Homework habits', () => {
      const a = setOne({ title:'Still to come' }), b = setOne({ title:'Past and listed' }), c = setOne({ title:'Past and hidden' });
      pastDue(b); pastDue(c);
      if (!homeworkHide({ id: c, hide: true }).ok) throw new Error('could not hide the test homework');
      const D = uiData('homework').data, page = teacherPage();
      const mine = D.homework.filter(h => h.mine), nPast = mine.filter(h => h.overdue && !h.hidden).length, nHid = mine.filter(h => h.overdue && h.hidden).length;
      page.win.vHomework(D);
      let html = page.html();
      const at = html.indexOf('id="harch"');
      if (at < 0) throw new Error('there is no Archive');
      const listPart = html.slice(0, at);
      if (listPart.indexOf('data-hw="' + a + '"') < 0) throw new Error('homework still to come left the list');
      if (listPart.indexOf('data-hw="' + b + '"') >= 0 || listPart.indexOf('data-hw="' + c + '"') >= 0) throw new Error('homework past its due date is still in the list');
      if (html.indexOf('data-hw="' + b + '"') >= 0) throw new Error('the Archive is open before it is asked');
      if (html.indexOf(nPast + ' past ' + (nPast === 1 ? 'its' : 'their') + ' due date · ' + nHid + ' hidden') < 0) throw new Error('the Archive does not say how many: ' + html.slice(at, at + 400));
      page.press('data-arch', '1');
      html = page.html();
      if (html.indexOf('data-hw="' + b + '"') < 0) throw new Error('open, the Archive does not list it');
      if (html.indexOf('data-hw="' + c + '"') >= 0) throw new Error('hidden homework is listed before it is asked for');
      page.press('data-hw', b);
      html = page.html();
      if (!new RegExp('data-hide="' + b + '"[^>]*data-tip="[^"]*still counts in ⏱️ Homework habits').test(html)) throw new Error('its Hide does not say it still counts in Homework habits');
      if (!new RegExp('data-ask="' + b + '"[^>]*data-tip="[^"]*leaves ⏱️ Homework habits[^"]*set by mistake[^"]*press “Hide”').test(html)) throw new Error('its Remove does not warn about Homework habits and point to Hide');
      page.press('data-hw', a);
      html = page.html();
      if (new RegExp('data-hide="' + a + '"').test(html)) throw new Error('homework still to come offers Hide');
      if (!new RegExp('data-ask="' + a + '"[^>]*data-tip="[^"]*leaves ⏱️ Homework habits[^"]*set by mistake[^"]*Change the due date').test(html)) throw new Error('Remove on homework still to come does not warn about Homework habits and point to Change the due date');
      page.press('data-ask', a);
      html = page.html();
      if (!/Remove deletes it, and it cannot be undone[^<]*Homework habits[^<]*“Change the due date”/.test(html)) throw new Error('waiting for a yes, the card does not say what Remove does');
      page.press('data-hidopen', '1');
      html = page.html();
      if (html.indexOf('data-hw="' + c + '"') < 0) throw new Error('the hidden homework cannot be shown');
      page.press('data-hw', c);
      html = page.html();
      if (!new RegExp('data-unhide="' + c + '"').test(html)) throw new Error('hidden homework has no Show it again');
      if (new RegExp('data-hide="' + c + '"').test(html) || new RegExp('data-duechg="' + c + '"').test(html)) throw new Error('hidden homework offers Hide or a new date before it is shown again');
      if (!new RegExp('data-ask="' + c + '"').test(html)) throw new Error('hidden homework cannot be removed');
    });
  } finally {
    VISITOR = OWNER; made.forEach(id => { try { homeworkDelete(id); } catch (e) {} });
    VISITOR = keep.V; SCHOOL_DOMAIN = keep.D; TEACHERS = keep.T; props.delete('TEACHERS'); props.delete('SCHOOL_DOMAIN');
    HUB_URL = keep.H; MANIFEST_JSON = keep.M; props.delete('HUB_URL'); freshMan();
  }
}

console.log('— keep: a reworded station keeps its fingerprint (the practice-questions audit, 7 Oct 2026) —');
/* "even if you shuffle the questions, even if you rephrase the questions … the students still have the correct answer"
   (Daniel). The teacher page shows a pupil's squares and words only where _labSig_ matches the fingerprint their letters
   were saved under, so it must honour `keep` exactly as every lab's own stationSig does. */
ok &= run('_labSig_ honours keep exactly as the four labs’ stationSig do; reworded again, the station is new', () => {
  const vm = require('vm');
  const appSig = lab => {
    const src = fs.readFileSync('../../labs/' + lab + '-lab/js/app.js', 'utf8');
    const a = src.indexOf('  function hash36('), z = src.indexOf('  function reconcile()');
    if (a < 0 || z < a) throw new Error(lab + '’s app.js has changed shape: no hash36 … reconcile');
    const ctx = {}; vm.runInNewContext(src.slice(a, z) + '\nthis.stationSig = stationSig;', ctx); return ctx.stationSig;
  };
  const w = {}; vm.runInNewContext(fs.readFileSync('../../labs/plants-lab/js/data/stations.js', 'utf8'), { window: w });
  const st = JSON.parse(JSON.stringify(w.STATIONS.filter(s => (s.activities || []).some(a => a.type === 'mcq'))[0]));
  const labs = ['plants', 'circulation', 'classification', 'digestion'].map(l => [l, appSig(l)]);
  const was = _labSig_(st);
  labs.forEach(([l, sig]) => { if (sig(st) !== was) throw new Error(l + ' and _labSig_ disagree on a station as published'); });
  const q = st.activities.findIndex(a => a.type === 'mcq');
  st.activities[q].options = st.activities[q].options.map(o => o + ' (in new words)');
  const now = _labSig_(st);
  if (now === was) throw new Error('new words did not change the fingerprint: this proves nothing');
  st.keep = { sig: was, now: now, on: '2026-10-07', why: 'the test' };
  if (_labSig_(st) !== was) throw new Error('_labSig_ does not honour keep: the teacher page would drop the pupils’ squares for this station');
  labs.forEach(([l, sig]) => { if (sig(st) !== was) throw new Error(l + '’s stationSig does not honour keep'); });
  st.activities[q].options[0] += ' again';
  if (_labSig_(st) === was) throw new Error('reworded again, the station still claims its old fingerprint');
  labs.forEach(([l, sig]) => { if (sig(st) !== _labSig_(st)) throw new Error(l + ' and _labSig_ disagree once keep no longer applies'); });
  st.keep = { sig: 5, now: _labSig_(st) };
  if (_labSig_(st) === 5) throw new Error('a keep whose sig is not a fingerprint was taken');
});

console.log('— each question as a square on the teacher page (Daniel, 6 Oct 2026) —');
/* "so that I know exactly where the students had to check multiple times": Lab progress carries each pupil's first-round
   letters per station, and the page asks for one lab's question words when a teacher opens them. The letters and the
   words are both tied to the station's fingerprint, so a station rewritten since is never shown against other questions. */
{
  const labJs = lab => fs.readFileSync('../../labs/' + lab + '-lab/js/data/stations.js', 'utf8');
  const stationsOf = txt => { const a = txt.indexOf('window.STATIONS = '), z = txt.indexOf('\n];', a); return JSON.parse(txt.slice(a + 18, z + 2)); };
  const REAL_MAN = fs.readFileSync('../../labs-shared/stations.json', 'utf8');
  const keepMan = MANIFEST_JSON, keepHub = HUB_URL, keepVisitor = VISITOR, keepDomain = SCHOOL_DOMAIN, keepFetch = UrlFetchApp.fetch;
  const setMan = j => { MANIFEST_JSON = j; for (const k of Array.from(cacheStore.keys())) if (/^(STATIONS_MANIFEST_|HUB_STAMP|LABQ_|LABV_)/.test(k)) cacheStore.delete(k); };
  let jsFetches = 0;
  UrlFetchApp.fetch = (url, o) => {
    const u = String(url);
    if (/\/digestion-lab\/version\.txt$/.test(u)) return { getResponseCode: () => 200, getContentText: () => '1759990000' };
    if (/\/digestion-lab\/js\/data\/stations\.js/.test(u)) { jsFetches++; return { getResponseCode: () => 200, getContentText: () => labJs('digestion') }; }
    return keepFetch(url, o);
  };
  const dig = ss.getSheetByName('Digestion'), keepRows = {};
  const rowAt = email => dig.getRange(2, LAB_EMAIL, dig.getLastRow() - 1, 1).getValues().findIndex(r => String(r[0]).toLowerCase() === email) + 2;
  const nameOf = email => { const sh = ss.getSheetByName('Students'), ec = _emailCol_(sh);
    const r = sh.getRange(2, 1, sh.getLastRow() - 1, ec).getValues().find(x => String(x[ec - 1]).toLowerCase() === email); return r ? r[0] : null; };
  const putRow = (email, cells) => { const r = rowAt(email); if (r < 2) throw new Error('no Digestion row for ' + email);
    if (!keepRows[email]) keepRows[email] = dig.getRange(r, 1, 1, LAB_COLS.length).getValues()[0];
    Object.keys(cells).forEach(c => dig.getRange(r, +c).setValue(cells[c])); };
  try {
    HUB_URL = 'https://hub.test'; setMan(REAL_MAN); SCHOOL_DOMAIN = 'x.kr'; VISITOR = OWNER;

    ok &= run('the script works out a station’s fingerprint exactly as each lab’s own page does (every station of the four labs)', () => {
      let n = 0;
      ['digestion', 'classification', 'plants', 'circulation'].forEach(lab => {
        const app = fs.readFileSync('../../labs/' + lab + '-lab/js/app.js', 'utf8');
        const h = app.slice(app.indexOf('function hash36('), app.indexOf('\n  }\n', app.indexOf('function hash36(')) + 4);
        const sg = app.slice(app.indexOf('function stationSig('), app.indexOf('\n  }\n', app.indexOf('function stationSig(')) + 4);
        if (h.length < 60 || sg.length < 60) throw new Error(lab + ': its stationSig has moved, so this test cannot read it');
        const theirs = new Function(h + '\n' + sg + '\nreturn stationSig;')();
        stationsOf(labJs(lab)).forEach(st => { n++;
          if (_labSig_(st) !== theirs(st)) throw new Error(lab + ' ' + st.id + ': the script says ' + _labSig_(st) + ', the lab ' + theirs(st)); });
      });
      if (n < 40) throw new Error('only ' + n + ' stations were compared');
    });

    ok &= run('Lab progress gives each pupil’s first-round letters per station, the best only where it differs, never for a station rewritten since', () => {
      const man = JSON.parse(REAL_MAN), D = man.labs['digestion-lab'].stations, diet = D.find(x => x.id === 'diet').sig, mouth = D.find(x => x.id === 'mouth').sig;
      putRow('ana@x.kr', { 3: 5, [LAB_SNAP]: 'diet~' + diet + ':ffft1t0f0@2|mouth~8:old:ffffffff',
                               [LAB_FIRST]: 'diet~' + diet + ':f1t000000|mouth~8:old:ffffffff', [LAB_BEST]: 'diet~' + diet + ':ff1t1f000' });
      putRow('bo@x.kr', { 3: 2, [LAB_SNAP]: 'diet~' + diet + ':ff1|mouth~' + mouth + ':tt', [LAB_FIRST]: '', [LAB_BEST]: '' });
      const d = _labProgressData_(SEP26), who = n => d.students.find(x => x.name === n), a = who(nameOf('ana@x.kr')), b = who(nameOf('bo@x.kr'));
      const ea = a && a.byLab['digestion-lab'], eb = b && b.byLab['digestion-lab'];
      if (!ea || !ea.q) throw new Error('no letters for the first pupil: ' + JSON.stringify(ea).slice(0, 200));
      if (ea.q.diet !== 'f1t000000') throw new Error('the first round is not what the squares show: ' + ea.q.diet);
      if (!ea.b || ea.b.diet !== 'ffft1f0f0') throw new Error('the best ever (this round and the kept best, folded) is wrong: ' + JSON.stringify(ea.b));
      if ('mouth' in ea.q) throw new Error('a station rewritten since its letters were saved still got squares');
      if (!eb || !eb.q || eb.q.diet !== 'ff1000000' || eb.q.mouth !== 'tt000000') throw new Error('a save from before rounds is not read as round 1: ' + JSON.stringify(eb && eb.q));
      if (eb.b) throw new Error('a best was sent where it is the same as the first round: ' + JSON.stringify(eb.b));
    });

    ok &= run('Lab progress gives each station’s rounds, the checks no question can be given, the resets and round 1’s checks (for Stuck)', () => {
      const man = JSON.parse(REAL_MAN), D = man.labs['digestion-lab'].stations, diet = D.find(x => x.id === 'diet').sig;
      putRow('ana@x.kr', { 3: 5, 7: 30, [LAB_ROUNDS]: '#2|diet~' + diet + ':+3;f1t000000.132000000;0t1000000.023000000|mouth~8:old:^7' });
      const d = _labProgressData_(SEP26), a = d.students.find(x => x.name === nameOf('ana@x.kr')), e = a && a.byLab['digestion-lab'];
      if (!e || !e.rd || JSON.stringify(e.rd) !== JSON.stringify({ diet: ['f1t000000.132000000', '0t1000000.023000000'] })) throw new Error('rounds: ' + JSON.stringify(e && e.rd));
      if (JSON.stringify(e.rx) !== JSON.stringify({ diet: 3, mouth: 7 })) throw new Error('not by question: ' + JSON.stringify(e.rx));
      /* round 1's checks: every check (30) less those known to be in a later round (5): what the cell does not hold counts */
      if (e.rs !== 2 || e.ag !== 1 || e.c1 !== 25) throw new Error('resets / again / round 1: ' + [e.rs, e.ag, e.c1]);
    });

    ok &= run('a lab’s question words come from its own page, cut short, only where the fingerprint matches, fetched once per version', () => {
      const man = JSON.parse(REAL_MAN); man.labs['digestion-lab'].stations.find(x => x.id === 'overview').sig = '9:rewritten';
      setMan(JSON.stringify(man)); jsFetches = 0;
      const r = uiData('questions', 'digestion-lab');
      if (!r.ok || !r.data) throw new Error('no words: ' + JSON.stringify(r).slice(0, 160));
      const words = r.data;
      if (!words.diet || words.diet.length !== 9 || !/^Four people, four pie charts/.test(words.diet[0])) throw new Error('the diet station’s words are wrong: ' + JSON.stringify(words.diet).slice(0, 160));
      if ('overview' in words) throw new Error('a station whose fingerprint differs from the hub list still got words');
      const all = [].concat(...Object.values(words));
      if (all.some(w => typeof w !== 'string' || !w || w.length > 171)) throw new Error('a question’s words are missing or not cut short');
      if (!all.some(w => /…$/.test(w))) throw new Error('nothing long was cut with …');
      if (jsFetches !== 1) throw new Error('the lab page was fetched ' + jsFetches + ' times');
      uiData('questions', 'digestion-lab');
      if (jsFetches !== 1) throw new Error('a second ask fetched the lab page again instead of using the cache');
      if (uiData('questions', 'no-such-lab').data !== null) throw new Error('an unknown lab gave words');
      VISITOR = 'stu@pupils.x.kr';
      if (uiData('questions', 'digestion-lab').ok !== false) throw new Error('a pupil was given the question words through the teacher page');
    });
  } finally {
    UrlFetchApp.fetch = keepFetch; HUB_URL = keepHub; VISITOR = keepVisitor; SCHOOL_DOMAIN = keepDomain; setMan(keepMan);
    Object.keys(keepRows).forEach(email => dig.getRange(rowAt(email), 1, 1, LAB_COLS.length).setValues([keepRows[email]]));
  }
}

const st = ss.getSheetByName('Students');
console.log('Students: ' + (st.getLastRow() - 1) + ' rows × ' + st.getLastColumn() + ' cols');
const dg = ss.getSheetByName('Digestion');
const filled = dg ? dg.getRange(2, 3, dg.getLastRow() - 1, 1).getValues().filter(r => r[0] !== '').length : 0;
console.log('Digestion: ' + (dg ? dg.getLastRow() - 1 : 0) + ' student(s), ' + filled + ' with work saved');
const rj = ss.getSheetByName('Rejected');
console.log('Rejected:  ' + (rj ? rj.getLastRow() - 1 : 0) + ' row(s)');
process.exit(ok ? 0 : 1);
