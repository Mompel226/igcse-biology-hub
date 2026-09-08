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
  getRange(a, b, c, d) {
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
  deleteRows(at, n) { if (at + n - 1 > this.maxR) throw new Error(`deleteRows past the end on "${this.name}"`); this.maxR -= n; return this; }
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
global.CacheService = { getScriptCache: () => ({ put: () => {}, get: () => null }) };  /* never a hit, so each call re-verifies */
global.ContentService = { createTextOutput: t => ({ setMimeType: () => t }), MimeType: { TEXT: 1, JSON: 2, JAVASCRIPT: 3 } };
global.HtmlService = { createHtmlOutputFromFile: () => ({ setWidth: () => ({ setHeight: () => ({}) }) }) };
global.ScriptApp = { getProjectTriggers: () => [], newTrigger: () => ({ forSpreadsheet: () => ({ onEdit: () => ({ create: () => {} }) }) }) };
global.LockService = { getScriptLock: () => ({ waitLock: () => true, releaseLock: () => {} }) };
global.Logger = { log: m => log('log: ' + m) };
global.Classroom = undefined;                    /* as it is before the service is added */
global.TOKEN_EMAIL = 'ana@x.kr';
global.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200,
  getContentText: () => JSON.stringify({ aud: 'CID', exp: Math.floor(Date.now()/1000)+3600,
                                         email_verified: 'true', email: TOKEN_EMAIL, name: 'A Person' }) }) };
global.Utilities = { base64EncodeWebSafe: b => 'b64' + String(b).length,
                     computeDigest: (a, t) => String(t), DigestAlgorithm: { SHA_256: 1 } };

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
ok &= run('the window file the script opens is really there', () => {
  const m = SRC.match(/createHtmlOutputFromFile\('([^']+)'\)/);
  if (!m) throw new Error('nothing opens the import window at all');
  if (!fs.existsSync('apps-script/' + m[1] + '.html')) throw new Error('no such file: ' + m[1] + '.html');
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
ok &= run('import two students', () => _upsertStudents(
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
  _upsertStudents([{ name: 'Ana Lee', email: 'ana@x.kr', userId: 'u1' }], '9A', 'Y9 Biology', 'c1');
  const sh = ss.getSheetByName('Digestion');
  if (sh.getLastRow() !== 3) throw new Error('now ' + (sh.getLastRow() - 1) + ' rows');
});

console.log('— handing in —');
CLIENT_ID = 'CID';
const hand = (o) => String(doPost({ postData: { contents: JSON.stringify(Object.assign({
  app: 'digestion-lab', name: 'Ana Lee', form: '9A', token: 'tok', complete: true,
  from: new Date(Date.now() - 3 * 864e5).toISOString(), stations: { mouth: '8/8 in 11' } }, o)) } }));
/* However many questions the Digestion Lab actually asks. Hard-coding it meant every code
   test broke the day the real count was corrected, which looked like a bug in the script. */
const QN = LABS.filter(l => l.id === 'digestion-lab')[0].questions;

const anaRow = () => ss.getSheetByName('Digestion').getRange(2, 1, 1, LAB_COLS.length).getValues()[0];

ok &= run('a hand-in fills the row that was waiting', () => {
  const out = hand({ score: 90, total: QN, checks: 214, firstTime: 71, code: _code('digestion-lab', 'Ana Lee', '9A', '90/' + QN) });
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
  const out = hand({ score: 40, total: QN, checks: 300, firstTime: 20, code: _code('digestion-lab', 'Ana Lee', '9A', '40/' + QN) });
  const r = anaRow();
  if (r[2] !== 90) throw new Error('a worse run overwrote the best score: ' + r[2]);
  if (r[6] !== 214) throw new Error('the rest of the worse run leaked in');
  if (r[9] !== 2) throw new Error('hand-ins should read 2, reads ' + r[9]);
  if (!(r[10] >= was)) throw new Error('the date did not move');
  if (!/higher/.test(out)) throw new Error('should say an earlier one still scores higher: ' + out);
});
ok &= run('a better go replaces it', () => {
  hand({ score: QN, total: QN, checks: 118, firstTime: 99, code: _code('digestion-lab', 'Ana Lee', '9A', QN + '/' + QN) });
  const r = anaRow();
  if (r[2] !== QN || r[6] !== 118 || r[7] !== 99) throw new Error('the better run was not kept: ' + r.slice(2, 8));
  if (r[9] !== 3) throw new Error('hand-ins should read 3, reads ' + r[9]);
});
ok &= run('handing in part-way through says so', () => {
  TOKEN_EMAIL = 'bo@x.kr';
  hand({ name: 'Bo Kim', score: 20, total: 40, complete: false, code: _code('digestion-lab', 'Bo Kim', '9A', '20/40') });
  TOKEN_EMAIL = 'ana@x.kr';
  const bo = ss.getSheetByName('Digestion').getRange(3, 1, 1, LAB_COLS.length).getValues()[0];
  if (bo[5] !== 'progress') throw new Error('not marked as in progress: ' + bo[5]);
  if (!/NOT ALL QUESTIONS|PROGRESS/.test(bo[12])) throw new Error('no flag raised: ' + bo[12]);
});
ok &= run('a student who joined after the import gets a row', () => {
  _upsertStudents([{ name: 'Chae Won', email: 'chae@x.kr', userId: 'u3' }], '9A', 'Y9 Biology', 'c1');
  TOKEN_EMAIL = 'chae@x.kr';
  hand({ name: 'Chae Won', score: 50, total: QN, code: _code('digestion-lab', 'Chae Won', '9A', '50/' + QN) });
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
  const out = hand({ name: 'A Stranger', score: QN, total: QN, code: _code('digestion-lab', 'A Stranger', '9A', QN + '/' + QN) });
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
  const out = String(doPost({ postData: { contents: JSON.stringify({ app: 'not-a-lab', score: 1, total: 1, token: 'tok' }) } }));
  if (!/unknown lab/.test(out)) throw new Error(out);
});

console.log('— reading a completion code —');
const setupSheet = () => ss.getSheetByName('Setup');
const askAbout = (code) => {
  setupSheet().getRange(CODE_ROW, 2).setValue(code);
  checkCode();
  return String(setupSheet().getRange(CODE_ROW + 1, 2).getValue());
};
ok &= run("a student's own code resolves to their name and score", () => {
  const answer = askAbout(_code('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
  if (!/Ana Lee/.test(answer)) throw new Error('did not name her: ' + answer);
  if (!new RegExp(QN + '\\/' + QN).test(answer)) throw new Error('did not give the score: ' + answer);
  if (!/finished/.test(answer)) throw new Error('did not say it was complete: ' + answer);
});
ok &= run('a part-way code resolves too, and says so', () => {
  const answer = askAbout(_code('digestion-lab', 'Bo Kim', '9A', '20/' + QN));
  if (!/Bo Kim/.test(answer) || !new RegExp('20\\/' + QN).test(answer)) throw new Error(answer);
  if (!/part way/.test(answer)) throw new Error('should say part way: ' + answer);
});
ok &= run('it says whether the hand-in actually arrived', () => {
  const answer = askAbout(_code('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
  if (!/Already in the Digestion tab/.test(answer)) throw new Error(answer);
});
ok &= run("a stranger's code cannot be read, and it says why", () => {
  const answer = askAbout(_code('digestion-lab', 'Someone In Peru', '', QN + '/' + QN));
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
  const code = _code('digestion-lab', 'Ana Lee Full Name From Google', '', QN + '/' + QN);
  sh.getRange(2, 12).setValue(code);
  const answer = askAbout(code);
  if (!/Ana Lee/.test(answer)) throw new Error('did not find the row it is written on: ' + answer);
  if (!/Already in the Digestion tab, row 2/.test(answer)) throw new Error(answer);
});
ok &= run('a Google name seen on a hand-in is remembered and tried', () => {
  const sh = ss.getSheetByName('Digestion');
  sh.getRange(3, LAB_GNAME).setValue('Bo Kim As Google Spells It');
  sh.getRange(3, 12).setValue('');                       /* so it cannot just be looked up */
  const answer = askAbout(_code('digestion-lab', 'Bo Kim As Google Spells It', '', '77/' + QN));
  if (!/Bo Kim As Google Spells It/.test(answer)) throw new Error(answer);
  if (!new RegExp('77\\/' + QN).test(answer)) throw new Error(answer);
});
ok &= run('clearing the code clears the answer under it', () => {
  const sh = setupSheet();
  askAbout(_code('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
  if (!String(sh.getRange(CODE_ROW + 1, 2).getValue())) throw new Error('no answer to clear');
  sh.getRange(CODE_ROW, 2).setValue('');                       /* he deletes the code */
  onButtonTicked({ range: sh.getRange(CODE_ROW, 2) });
  const left = String(sh.getRange(CODE_ROW + 1, 2).getValue());
  if (left) throw new Error('the old answer is still sitting there: ' + left);
});
ok &= run('typing a new code replaces the old answer with a prompt', () => {
  const sh = setupSheet();
  askAbout(_code('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
  sh.getRange(CODE_ROW, 2).setValue('DL-ZZZZ-ZZZZ');
  onButtonTicked({ range: sh.getRange(CODE_ROW, 2) });
  const now = String(sh.getRange(CODE_ROW + 1, 2).getValue());
  if (/Ana Lee/.test(now)) throw new Error('still showing the answer to the previous code');
  if (!/Tick the box/.test(now)) throw new Error('no prompt to check it: ' + now);
});
ok &= run('editing anything else on Setup is left alone', () => {
  const sh = setupSheet();
  askAbout(_code('digestion-lab', 'Ana Lee', '', QN + '/' + QN));
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
ok &= run('refreshDashboard twice running is the same', () => {
  refreshDashboard();
  const a = JSON.stringify(ss.getSheetByName('Students').getRange(2, 1, 3, 3 + LABS.length + 2).getValues());
  refreshDashboard();
  const b = JSON.stringify(ss.getSheetByName('Students').getRange(2, 1, 3, 3 + LABS.length + 2).getValues());
  if (a !== b) throw new Error('it drifts each time it runs');
});

console.log('\ntabs built: ' + ss.sheets.map(s => s.name).join(', '));
ok &= run('the tabs end up in syllabus order, however they started', () => {
  /* Shuffle them the way a real sheet drifts: the general tabs scattered, Digestion before
     Classification because it was built first, and the newest labs stuck on the end. */
  const shuffled = ss.getSheets().slice().reverse();
  ss.sheets.length = 0; shuffled.forEach(x => ss.sheets.push(x));
  const before = ss.getSheets().map(x => x.name).join(', ');

  const moved = _orderTabs();

  const got = ss.getSheets().map(x => x.name);
  const want = ['Setup', 'Labs', 'Students']
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
  if (_orderTabs() !== 0) throw new Error('it moved tabs that were already in place');
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
  _upsertStudents([{ name: 'Zed Audit', email: 'zed@x.kr', userId: 'u9' }], '9A', 'Y9 Biology', 'c1');
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
    const code = PREFIXES[i % PREFIXES.length] + _code(lab.id, 'Zed Audit', '9A', score + '/' + total);
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
    const code = PREFIXES[i % PREFIXES.length] + _code(lab.id, 'Zed Audit', '9A', score + '/' + total);
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
                     code: 'DL-' + _code('digestion-lab', 'Zed Audit', '9A', QN + '/' + QN) });
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

const st = ss.getSheetByName('Students');
console.log('Students: ' + (st.getLastRow() - 1) + ' rows × ' + st.getLastColumn() + ' cols');
const dg = ss.getSheetByName('Digestion');
const filled = dg ? dg.getRange(2, 3, dg.getLastRow() - 1, 1).getValues().filter(r => r[0] !== '').length : 0;
console.log('Digestion: ' + (dg ? dg.getLastRow() - 1 : 0) + ' student(s), ' + filled + ' handed in');
const rj = ss.getSheetByName('Rejected');
console.log('Rejected:  ' + (rj ? rj.getLastRow() - 1 : 0) + ' row(s)');
process.exit(ok ? 0 : 1);
