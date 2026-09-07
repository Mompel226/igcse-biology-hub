/* ============================================================
   Biology Hub — the front door
   Reads window.HUB, stands the doors up, and makes them answer
   the pointer. Changing what is behind a door means editing
   shelves.js only.
   ============================================================ */
(function () {
  'use strict';

  /* The shared register, plus whatever the local layer adds. js/local.js is the only
     file that differs between the NLCS edition and the open one; in the open edition it
     is a stub, so everything below simply sees four doors and no school in the name. */
  var H       = window.HUB || {};
  var L       = window.HUB_LOCAL || {};
  var DOORS   = (H.doors || []).concat(L.doors || []);
  var YEARS   = H.years || [];
  var OPEN    = (H.open || []).concat(L.open || []);
  var CREDITS = (H.credits || []).concat(L.credits || []);

  /* the strings that name the school, if this edition has one */
  (function (site) {
    if (!site) return;
    if (site.title) document.title = site.title;
    if (site.description) {
      var m = document.querySelector('meta[name="description"]');
      if (m) m.setAttribute('content', site.description);
    }
    [['siteEyebrow', 'eyebrow'], ['siteMaker', 'maker'], ['siteByline', 'byline']].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el && site[pair[1]]) el.innerHTML = site[pair[1]];
    });
  })(L.site);
  var doorsEl = document.getElementById('doors');
  var wideEl  = document.getElementById('beyond');
  var toastEl = document.getElementById('toast');
  var narrow  = window.matchMedia('(max-width: 900px)');
  var coarse  = window.matchMedia('(hover: none)');
  var still   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var STATUS = { live:'Open', build:'Being built', planned:'Planned', local:'School network only' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
    });
  }
  function plain(html) { return String(html).replace(/<[^>]+>/g, ''); }

  /* ---------- 1. the doors ---------- */
  var doorEls = {};

  function picture(d, eager) {
    var b = 'assets/doors/' + d.id;
    var sizes = d.kind === 'cca' ? '100vw' : '(max-width:900px) 100vw, 45vw';
    var set = function (ext) { return [900, 1400, 1800].map(function (w) { return b + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', '); };
    return '<picture>' +
      '<source type="image/webp" srcset="' + set('webp') + '" sizes="' + sizes + '">' +
      '<img class="door__img" src="' + b + '-1400.jpg" srcset="' + set('jpg') + '" sizes="' + sizes + '"' +
      ' alt="' + esc(d.alt) + '" loading="' + (eager ? 'eager' : 'lazy') + '"' +
      (eager ? ' fetchpriority="high"' : '') + ' decoding="async" draggable="false">' +
      '</picture>';
  }
  function chips(d) {
    if (!d.topics || !d.topics.length) return '';
    return '<ul class="door__chips" aria-label="Topics">' + d.topics.map(function (t) {
      return '<li class="chip">' + (t.no != null ? '<b>' + t.no + '</b>' : '') + esc(t.t) + '</li>';
    }).join('') + '</ul>';
  }
  function build(d, i) {
    var a = document.createElement('a');
    var closed = !(d.url && (d.status === 'live' || d.status === 'local'));
    a.className = 'door door--' + d.id +
      (d.tone === 'light' ? ' door--light' : '') +
      (d.kind === 'cca' ? ' door--wide' : '') +
      (closed ? ' door--closed' : '');
    a.href = d.url || '#';
    a.dataset.id = d.id;
    a.style.setProperty('--accent', d.accent);
    a.style.setProperty('--focus', d.focus || '50% 50%');
    if (d.status === 'local') { a.target = '_blank'; a.rel = 'noopener'; }
    a.setAttribute('aria-label', plain(d.title) + ' — ' + STATUS[d.status]);
    a.innerHTML = picture(d, i < 2) +
      '<span class="door__veil" aria-hidden="true"></span><span class="door__light" aria-hidden="true"></span>' +
      '<div class="door__body">' +
        '<span class="door__no">' + esc(d.eyebrow) + '</span>' +
        '<h2 class="door__title">' + d.title + '</h2>' +
        '<p class="door__lede">' + esc(d.blurb) + '</p>' +
        chips(d) +
        '<div class="door__foot">' +
          '<span class="door__status door__status--' + d.status + '">' + STATUS[d.status] + '</span>' +
          (d.detail ? '<span class="door__detail">' + esc(d.detail) + '</span>' : '') +
          '<span class="door__go">' + (closed ? 'Not yet' : (d.kind === 'cca' ? 'Visit' : 'Enter')) + '</span>' +
        '</div>' +
      '</div>';
    wire(a, d);
    return a;
  }
  function wire(a, d) {
    doorEls[d.id] = a;
    a.addEventListener('pointerenter', function () { stopTour(); on(d.id); });
    a.addEventListener('pointerleave', function () { off(d.id); restTour(); });
    a.addEventListener('focus',        function () { stopTour(); on(d.id); });
    a.addEventListener('blur',         function () { off(d.id); restTour(); });
    a.addEventListener('pointermove', function (e) {
      var r = a.getBoundingClientRect();
      a.style.setProperty('--mx', ((e.clientX - r.left) / r.width  * 100).toFixed(1) + '%');
      a.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%');
    });
    a.addEventListener('click', function (e) {
      if (!a.classList.contains('door--closed')) return;
      e.preventDefault();
      toast(d.note || (plain(d.title) + ' is not open yet.'));
    });
    /* the arrow keys walk along the doors */
    a.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var all = Array.prototype.slice.call(document.querySelectorAll('.door'));
      var n = all[all.indexOf(a) + (e.key === 'ArrowRight' ? 1 : -1)];
      if (n) { n.focus(); e.preventDefault(); }
    });
  }
  function on(id)  { Object.keys(doorEls).forEach(function (k) { doorEls[k].classList.toggle('is-on', k === id); }); }
  function off(id) { if (doorEls[id]) doorEls[id].classList.remove('is-on'); }

  DOORS.forEach(function (d, i) {
    var a = build(d, i);
    (d.kind === 'cca' && wideEl ? wideEl : doorsEl).appendChild(a);
  });

  /* ---------- 2. the idle tour ----------
     Left alone, the doors take turns opening, so anyone glancing at
     the screen sees what is behind each one. Any touch stops it; it
     picks up again after a long pause. Not on a phone, where every
     door already stands open. */
  var tour = null, resume = null, i = 0;
  var TOURABLE = DOORS.filter(function (d) { return d.kind !== 'cca'; });
  var TOUR_MS = 5200;
  function canTour() { return !still && !narrow.matches && TOURABLE.length > 1; }   /* an iPad in landscape gets the tour too */
  function startTour() { if (tour || !canTour()) return; step(); tour = setInterval(step, TOUR_MS); }
  function step() { on(TOURABLE[i % TOURABLE.length].id); i++; }
  function stopTour() { clearInterval(tour); tour = null; clearTimeout(resume); }
  function restTour() {
    clearTimeout(resume);
    resume = setTimeout(function () {
      if (!document.querySelector('.door:hover, .door:focus, .step:hover, .ytab:hover, .open__link:hover')) startTour();
    }, 12000);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopTour(); else restTour(); });
  /* /#plants opens that door and holds it — for projecting a prepared state in class.
     The tour only takes over once someone has touched the page. */
  var want = (location.hash || '').replace(/^#/, '');
  if (doorEls[want]) { on(want); doorEls[want].scrollIntoView({ block:'nearest' }); }
  else setTimeout(startTour, 1400);
  window.addEventListener('hashchange', function () {
    var id = (location.hash || '').replace(/^#/, '');
    if (doorEls[id]) { stopTour(); on(id); }
  });

  /* ---------- 3. your year — which doors are yours ----------
     Three tabs, the same split the student dashboard uses. Pick one and its
     topics appear as pills; point at a pill and its door opens; point at the
     tab itself and every door that year touches lights up. */
  function mark(ids) {
    Object.keys(doorEls).forEach(function (k) { doorEls[k].classList.toggle('is-year', ids.indexOf(k) >= 0); });
  }
  var yearsEl = document.getElementById('years');
  var YKEY = 'biology-hub.year';
  if (yearsEl && YEARS.length) {
    var tabs = document.createElement('div'); tabs.className = 'ytabs';
    var lbl = document.createElement('span'); lbl.className = 'path__lbl'; lbl.textContent = 'Your year';
    tabs.appendChild(lbl);
    var pills = document.createElement('div'); pills.className = 'path'; pills.id = 'path';
    pills.setAttribute('aria-label', 'Your topics');
    var choose = function (id, save) {
      var y = YEARS.filter(function (v) { return v.id === id; })[0];
      Array.prototype.forEach.call(tabs.querySelectorAll('.ytab'), function (b) {
        b.setAttribute('aria-pressed', y && b.dataset.year === y.id ? 'true' : 'false');
      });
      pills.innerHTML = '';
      if (!y) return;
      y.steps.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'step'; b.dataset.shelf = s.shelf;
        b.innerHTML = '<b>' + esc(s.no) + '</b>' + esc(s.t);
        var lit = function () { stopTour(); on(s.shelf); b.classList.add('is-on'); };
        var dim = function () { off(s.shelf); b.classList.remove('is-on'); restTour(); };
        b.addEventListener('pointerenter', lit); b.addEventListener('focus', lit);
        b.addEventListener('pointerleave', dim); b.addEventListener('blur', dim);
        b.addEventListener('click', function () {
          var a = doorEls[s.shelf]; if (!a) return;
          if (a.classList.contains('door--closed')) a.click();      /* the door explains itself */
          else window.location.href = a.href;
        });
        pills.appendChild(b);
      });
      if (save) { try { localStorage.setItem(YKEY, y.id); } catch (e) {} }
    };
    YEARS.forEach(function (y) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ytab'; b.dataset.year = y.id; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = esc(y.label) + '<small>' + esc(y.sub) + '</small>';
      var doors = y.steps.map(function (s) { return s.shelf; });
      b.addEventListener('click', function () { choose(y.id, true); });
      b.addEventListener('pointerenter', function () { stopTour(); mark(doors); });
      b.addEventListener('focus',        function () { stopTour(); mark(doors); });
      b.addEventListener('pointerleave', function () { mark([]); restTour(); });
      b.addEventListener('blur',         function () { mark([]); restTour(); });
      tabs.appendChild(b);
    });
    yearsEl.appendChild(tabs); yearsEl.appendChild(pills);
    var savedY = null; try { savedY = localStorage.getItem(YKEY); } catch (e) {}
    choose(savedY, false);
    /* /#y11 opens the hub on that year's topics — a link to give a class */
    var hashY = (location.hash || '').replace(/^#/, '');
    if (YEARS.some(function (y) { return y.id === hashY; })) choose(hashY, false);
  }

  /* ---------- 4. IB is a layer, not a shelf ---------- */
  var IBKEY = 'biology-hub.ib';
  var ib = document.getElementById('ibToggle');
  function setIB(onoff, save) {
    document.body.classList.toggle('ib', onoff);
    if (ib) ib.setAttribute('aria-pressed', onoff ? 'true' : 'false');
    if (save) { try { localStorage.setItem(IBKEY, onoff ? '1' : '0'); } catch (e) {} }
  }
  var savedIB = null; try { savedIB = localStorage.getItem(IBKEY); } catch (e) {}
  setIB(savedIB === '1', false);
  if (ib) ib.addEventListener('click', function () {
    var now = !document.body.classList.contains('ib');
    setIB(now, true);
    toast(now ? 'IB material shown — the same labs, with the extension revealed.' : 'IB material hidden.');
  });

  /* ---------- 5. open now ---------- */
  var openList = document.getElementById('openList');
  if (openList) {
    OPEN.forEach(function (o) {
      var li = document.createElement('li');
      li.className = 'open__item' + (o.ibOnly ? ' open__item--ib' : '');
      li.innerHTML =
        '<a class="open__link" href="' + o.url + '">' +
          '<span class="kind kind--' + o.kind + '">' + esc(o.kind) + '</span>' +
          '<span class="open__txt">' +
            '<span class="open__title">' + esc(o.title) + '</span>' +
            '<span class="open__sub">' + esc(o.sub) + (o.ib ? ' <span class="ib-note">· ' + esc(o.ib) + '</span>' : '') + '</span>' +
            (o.progress ? '<span class="open__prog" id="prog-' + esc(o.progress) + '"></span>' : '') +
          '</span>' +
          '<span class="open__go" aria-hidden="true">→</span>' +
        '</a>';
      var a = li.firstChild;
      a.addEventListener('pointerenter', function () { stopTour(); on(o.shelf); });
      a.addEventListener('pointerleave', function () { off(o.shelf); restTour(); });
      openList.appendChild(li);
    });
    var cnt = document.getElementById('openCount');
    var nIB = OPEN.filter(function (o) { return o.ibOnly; }).length;
    if (cnt) cnt.textContent = (OPEN.length - nIB) + ' open' + (nIB ? ' · ' + nIB + ' more with IB' : '');
  }

  /* ---------- progress ----------
     Every app is on one origin, so each lab's own record is readable from here. HOW to read it
     lives in js/progress.js, shared with every hub; WHICH labs exist lives in js/data/labs.js,
     generated from labs-shared/labs.json. So adding a lab means editing that one file and
     rebuilding — no hub changes. Nothing here writes to a lab's record. */
  var REG  = window.LABS_REGISTER || {};
  var LABS = REG.labs || [];
  var P    = window.LabProgress;

  function bar(done, total, accent) {
    var w = total ? Math.round(100 * done / total) : 0;
    return '<span class="pbar"><span class="pbar__fill" style="width:' + w + '%;background:' +
           (accent || 'var(--cyan)') + '"></span></span>';
  }
  function accentOf(id) {
    var d = DOORS.filter(function (x) { return x.id === id; })[0];
    return d ? d.accent : 'var(--cyan)';
  }

  function showProgress() {
    var sec = document.getElementById('prog');
    if (!sec || !P || !LABS.length) return;
    var res = P.all(LABS, window.__SERVER_PROGRESS || null);
    if (!P.any(res)) { sec.hidden = true; return; }
    sec.hidden = false;

    var shelves = (REG.shelves || []).filter(function (sh) { return res.byShelf[sh.id]; });
    document.getElementById('progGrid').innerHTML = shelves.map(function (sh) {
      var t = res.byShelf[sh.id], acc = accentOf(sh.id);
      var mine = LABS.filter(function (l) { return l.shelf === sh.id && res.byLab[l.id]; });
      return '<div class="pshelf" style="--acc:' + acc + '">' +
        '<div class="pshelf__top"><span class="pshelf__name">' + esc(sh.name) + '</span>' +
        '<span class="pshelf__n">' + t.done + ' / ' + t.total + '</span></div>' +
        bar(t.done, t.total, acc) +
        '<ul class="plabs">' + mine.map(function (l) {
          var p = res.byLab[l.id];
          var on = p.started || p.handedIn;
          return '<li class="plab' + (on ? '' : ' plab--cold') + '">' +
            '<a href="' + l.url + '"><span class="plab__name">' + esc(l.short) + '</span>' +
            '<span class="plab__n">' + (on ? p.done + ' / ' + p.total : 'not started') + '</span></a>' +
            (p.handedIn ? '<span class="plab__in">handed in</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }).join('');

    var w = res.whole;
    document.getElementById('progCount').textContent =
      w.done + ' of ' + w.total + ' right · ' + P.pct(w) + '% · ' + w.started + ' of ' + w.labs +
      ' lab' + (w.labs === 1 ? '' : 's') + ' started';

    var signedIn = LABS.some(function (l) { return P.read(l.id + '.signin'); });
    var note = 'Counted in <b>this browser</b>. Clearing your history or site data erases it, and another device starts from nothing.';
    if (w.handedIn) {
      note += signedIn
        ? ' What you handed in <b>while signed in</b> is also in your teacher\u2019s records, so it can be brought back \u2014 if your teacher is collecting them.'
        : ' You have handed work in, but <b>not signed in</b>, so there is nothing to bring it back from. Sign in before you hand in next time.';
    } else {
      note += ' Nothing handed in yet, so there is no copy anywhere else.';
    }
    document.getElementById('progNote').innerHTML = note;

    Object.keys(res.byShelf).forEach(function (id) {
      var el = doorEls[id]; if (!el) return;
      var t = res.byShelf[id], foot = el.querySelector('.door__foot');
      if (!foot || foot.querySelector('.door__prog')) return;
      var sp = document.createElement('span');
      sp.className = 'door__prog';
      sp.innerHTML = bar(t.done, t.total, 'var(--accent)') + '<span>' + t.done + '/' + t.total + '</span>';
      foot.insertBefore(sp, foot.querySelector('.door__go'));
    });
  }
  showProgress();

  /* ---------- bringing back what was handed in ----------
     A student's working lives in their browser and dies with it. What they HANDED IN, while
     signed in, is in the teacher's spreadsheet — so ask for it back. The token is one the
     labs already hold; it is sent in a POST body as text/plain, which is a "simple" request,
     so there is no preflight. Only the holder's own row comes back: the endpoint takes the
     email from the token, never from what we send.

     Everything here is best-effort. No token, no endpoint, no network, an old deployment, a
     teacher not collecting marks at all — every one of those just leaves the page showing
     what the browser knows, which is what it showed a moment ago anyway. */
  function serverProgress() {
    var url = L.submitUrl || (L.site && L.site.submitUrl) || '';   /* each school's own — js/local.js */
    if (!url || !P || !LABS.length) return;

    var tok = null;
    for (var i = 0; i < LABS.length && !tok; i++) {
      var sv = P.read(LABS[i].id + '.signin');
      if (sv && sv.token && sv.exp * 1000 > Date.now() + 60000) tok = sv.token;
    }
    if (!tok) return;                       /* not signed in anywhere — nothing to ask with */

    fetch(url, { method: 'POST', mode: 'cors',
                 headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                 body: JSON.stringify({ action: 'progress', token: tok }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !j.labs) return;
        window.__SERVER_PROGRESS = j.labs;
        showProgress();                     /* redraw with whichever is further on */
      })
      .catch(function () {});               /* offline, or an older deployment: say nothing */
  }
  serverProgress();

  /* ---------- 6. credits ----------
     Both editions ship this file, so the link to the full credits works out which
     repository it is in from the address rather than being told: a GitHub Pages URL
     is <user>.github.io/<repo>/. Off Pages, fall back to the file beside the page. */
  function creditsHref() {
    var m = /^https?:\/\/([^.]+)\.github\.io\/([^/]+)/.exec(location.href);
    return m ? 'https://github.com/' + m[1] + '/' + m[2] + '/blob/main/assets/doors/CREDITS.md'
             : 'assets/doors/CREDITS.md';
  }

  var cr = document.getElementById('credits');
  if (cr && CREDITS.length) {
    cr.innerHTML = 'Doors: ' + CREDITS.map(function (c) {
      var t = c.url ? '<a href="' + c.url + '" target="_blank" rel="noopener">' + esc(c.text) + '</a>' : esc(c.text);
      return '<span class="cr"><b>' + esc(c.door) + '</b> — ' + t + (c.licence ? ' (' + esc(c.licence) + ')' : '') + '</span>';
    }).join(' · ') +
    '. <a href="' + creditsHref() + '" target="_blank" rel="noopener">Full credits</a>.';
  }

  /* ---------- 7. toast ---------- */
  var toastT = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 4200);
  }
})();
