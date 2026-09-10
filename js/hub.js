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

  /* A school's own front. `entry` stands a page of doors in front of the revision hub: the
     one marked `hero` leads into it, the rest into `sections`, each a page of the wide banner
     doors that carry that section's `kind`. The open edition declares neither, so for it this
     file does exactly what it always did: index.html is the revision hub, and there is no way
     back to a school it does not belong to. */
  var ENTRY    = L.entry || null;
  var SECTIONS = ENTRY ? (L.sections || []) : [];
  if (ENTRY) DOORS = DOORS.concat((ENTRY.doors || []).map(function (d) { d.kind = 'entry'; return d; }));
  function sectionOf(id) { return SECTIONS.filter(function (s) { return s.id === id; })[0] || null; }

  /* Under the shelves stand the wide doors — the school's own clubs and societies, each
     with a website of its own. js/local.js names them and tags each one with a kind; this
     says which kinds there are, what each band is called, and the order they stand in.
     A school with none of a kind simply gets no band. Adding a band is one line here;
     adding a club or a society is one entry in js/local.js. */
  var BANDS = SECTIONS.length
    ? SECTIONS.map(function (s) { return { kind:s.kind, label:s.label, section:s.id }; })
    : [ { kind:'cca',     label:'Co-curricular activities' },
        { kind:'society', label:'Societies' } ];
  /* A door whose kind names a band belongs on that band's page. There it is a wide banner —
     unless it is the page's hero, which stands full width like the one on the front, with its
     picture behind the words. A shelf is a door that is neither of those nor an entry door.
     (Defining a shelf as "not wide" once put a section's hero on the shelves as well.) */
  function inBand(d) { return BANDS.some(function (b) { return b.kind === d.kind; }); }
  function isWide(d)  { return inBand(d) && !d.hero; }
  function isShelf(d) { return !inBand(d) && d.kind !== 'entry'; }
  /* "#F7EBD5" → "247 235 213", so a gradient can fade a banner's own ground away to
     nothing instead of drifting through grey on the way out. */
  function rgbOf(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return null;
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(' ');
  }

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
    var b = 'assets/doors/' + (d.img || d.id);
    var sizes = (isWide(d) || d.hero) ? '100vw'
              : d.kind === 'entry' ? '(max-width:900px) 100vw, 30vw'
              : '(max-width:900px) 100vw, 45vw';
    var set = function (ext) { return [900, 1400, 1800].map(function (w) { return b + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', '); };
    return '<picture>' +
      '<source type="image/webp" srcset="' + set('webp') + '" sizes="' + sizes + '">' +
      '<img class="door__img" src="' + b + '-1400.jpg" srcset="' + set('jpg') + '" sizes="' + sizes + '"' +
      ' alt="' + esc(d.alt) + '" loading="' + (eager ? 'eager' : 'lazy') + '"' +
      (eager ? ' fetchpriority="high"' : '') + ' decoding="async" draggable="false">' +
      '</picture>';
  }
  /* ---------- a banner that moves ----------
     A picture cannot beat, so a banner may hand over the geometry of what is printed on it
     and the page draws the moving part live on top. The overlay is an SVG cropped exactly
     the way the picture is — "slice" is what object-fit: cover does — so it lands on the
     printed art at every width, in the shut strip and the open plate alike. Only the banner
     knows its own coordinates, which is why they sit in the register beside it.

       motion.trace   a light runs along a line: the pulse on the Medical Review plate
       motion.orbits  electrons run round an atom: the three rings on the Science NHS plate

     The overlay sits above the picture, so it has to stop where the printed art does, and
     two different things stop it. `fadeOut` is a pair of banner x-coordinates where the
     printed art itself goes behind something — the Science NHS rings pass behind the
     society's name — so it holds in both states. `underWords` is where a *shut* door lays
     its own words over the plate, and a light at full strength there would read as a line
     struck through them; that one is lifted the moment the door opens and the words move
     off the banner.

     Nothing is drawn at all for a reader who has asked for less movement. */
  function tracePart(t, id) {
    if (!t || !t.d) return '';
    return '<path class="mo-trace" pathLength="1000" d="' + esc(t.d) + '" ' +
      'stroke="' + esc(t.colour || '#fff') + '" stroke-width="' + (t.width || 5) + '" ' +
      'style="--beat:' + (t.seconds || 2) + 's"/>';
  }
  /* the shut door's words lie over the left of the plate. In that state the picture is
     width-bound, so a percentage across the door is a percentage across the banner. */
  function underWordsMask(m, w) {
    if (!m.underWords) return null;
    return 'linear-gradient(to right,transparent ' + (100 * m.underWords[0] / w).toFixed(2) +
           '%,#000 ' + (100 * m.underWords[1] / w).toFixed(2) + '%)';
  }
  function orbitPart(o, id) {
    if (!o || !o.rx) return '';
    var secs = o.seconds || 7, dot = o.r || 6, out = '';
    /* the same three rings the crest carries, and one electron on each, evenly spread */
    [0, 60, 120].forEach(function (deg, i) {
      var ref = 'o-' + id + '-' + i;
      out += '<g transform="translate(' + o.cx + ' ' + o.cy + ') rotate(' + deg + ')">' +
        '<path id="' + ref + '" fill="none" d="M' + (-o.rx) + ' 0' +
          'a' + o.rx + ' ' + o.ry + ' 0 1 0 ' + (2 * o.rx) + ' 0' +
          'a' + o.rx + ' ' + o.ry + ' 0 1 0 ' + (-2 * o.rx) + ' 0"/>' +
        '<g class="mo-e">' +
          '<circle r="' + (dot * 3.4) + '" fill="' + esc(o.glow || o.colour) + '" opacity=".16"/>' +
          '<circle r="' + (dot * 1.9) + '" fill="' + esc(o.glow || o.colour) + '" opacity=".24"/>' +
          '<circle r="' + dot + '" fill="' + esc(o.colour) + '"/>' +
          '<animateMotion dur="' + secs + 's" repeatCount="indefinite" ' +
            'begin="-' + (secs / 3 * i).toFixed(2) + 's">' +
            '<mpath href="#' + ref + '" xlink:href="#' + ref + '"/>' +
          '</animateMotion>' +
        '</g></g>';
    });
    return out;
  }
  /* the banner's own pixel size — everything the register says about a banner, the path it
     hands over included, is in these coordinates */
  function plateOf(d) { return d.plate || [1800, 614]; }

  /* one gradient mask across the plate, from the fades the banner asked for */
  function fadeMask(m, w, id) {
    if (!m.fadeOut) return ['', ''];
    var stops = [[0, '#fff'], [m.fadeOut[0], '#fff'], [m.fadeOut[1], '#000']];
    return ['<defs><linearGradient id="g-' + id + '" gradientUnits="userSpaceOnUse" ' +
      'x1="0" x2="' + w + '" y1="0" y2="0">' +
      stops.map(function (st) {
        return '<stop offset="' + (st[0] / w).toFixed(4) + '" stop-color="' + st[1] + '"/>';
      }).join('') +
      '</linearGradient><mask id="mk-' + id + '"><rect width="100%" height="100%" ' +
      'fill="url(#g-' + id + ')"/></mask></defs>', ' mask="url(#mk-' + id + ')"'];
  }
  function motion(d) {
    var m = d.motion;
    if (!m || still) return '';
    var body = tracePart(m.trace, d.id) + orbitPart(m.orbits, d.id);
    if (!body) return '';
    var p = plateOf(d), mk = fadeMask(m, p[0], d.id);
    return '<svg class="door__motion" viewBox="0 0 ' + p[0] + ' ' + p[1] + '" ' +
      'preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" ' +
      'xmlns:xlink="http://www.w3.org/1999/xlink">' +
      mk[0] + '<g' + mk[1] + '>' + body + '</g></svg>';
  }
  function chips(d) {
    if (!d.topics || !d.topics.length) return '';
    return '<ul class="door__chips" aria-label="Topics">' + d.topics.map(function (t) {
      return '<li class="chip">' + (t.no != null ? '<b>' + t.no + '</b>' : '') + esc(t.t) + '</li>';
    }).join('') + '</ul>';
  }
  /* the name a wide door goes by: the emphasised word of its title, or the whole title */
  function nameOf(d) {
    if (d.name) return d.name;
    var m = /<em>(.*?)<\/em>/.exec(d.title || '');
    return m ? plain(m[1]) : plain(d.title || d.id);
  }
  /* An entry door leads to a section or to the revision hub, and says what is there by
     looking, so a club added to `doors` shows up on its entry door without another edit. */
  function fillEntry(d) {
    d.url = d.url || ('#' + (d.view || 'revision'));
    if (d.view === 'revision' || d.hero) {
      if (!d.detail) {
        var hubs = OPEN.filter(function (o) { return o.kind === 'hub'; }).length;
        var labs = OPEN.filter(function (o) { return o.kind === 'lab'; }).length;
        d.detail = hubs + ' hub' + (hubs === 1 ? '' : 's') + ' · ' + labs + ' lab' + (labs === 1 ? '' : 's') + ' open';
      }
      return;
    }
    var sec = sectionOf(d.view);
    if (!sec) return;
    var mine = DOORS.filter(function (x) { return x.kind === sec.kind && x.status !== 'planned'; });
    if (!d.topics) d.topics = mine.map(function (x) { return { t: nameOf(x) }; });
    if (!d.detail) d.detail = mine.length ? mine.length + ' door' + (mine.length === 1 ? '' : 's') : 'Opens soon';
  }

  function build(d, eager) {
    var a = document.createElement('a');
    if (d.kind === 'entry') fillEntry(d);
    var closed = !(d.url && (d.status === 'live' || d.status === 'local'));
    a.className = 'door door--' + d.id +
      (d.tone === 'light' ? ' door--light' : '') +
      (d.kind === 'entry' ? ' door--entry' : '') +
      (d.hero ? ' door--hero' : '') +
      (isWide(d) ? ' door--wide' : '') +
      (d.bleed ? ' door--bleed' : '') +
      (closed ? ' door--closed' : '');
    a.href = d.url || '#';
    a.dataset.id = d.id;
    a.style.setProperty('--accent', d.accent);
    a.style.setProperty('--focus', d.focus || '50% 50%');
    /* a wide door's box is cut to its banner's own shape, so a short banner is not given a
       deep box with the picture floating in the middle of it */
    if (isWide(d)) a.style.setProperty('--ar', (plateOf(d)[0] / plateOf(d)[1]).toFixed(5));
    if (d.motion) {
      var mask = underWordsMask(d.motion, plateOf(d)[0]);
      if (mask) a.style.setProperty('--mo-mask', mask);
    }
    /* a wide door's words sit on a fade of the banner's own ground, so each banner brings
       the colour its fade is made of */
    if (rgbOf(d.ground)) a.style.setProperty('--ground-rgb', rgbOf(d.ground));
    if (d.status === 'local') { a.target = '_blank'; a.rel = 'noopener'; }
    a.setAttribute('aria-label', plain(d.title) + ' — ' + STATUS[d.status]);
    a.innerHTML = picture(d, eager) + motion(d) +
      '<span class="door__veil" aria-hidden="true"></span><span class="door__light" aria-hidden="true"></span>' +
      '<div class="door__body">' +
        '<span class="door__no">' + esc(d.eyebrow) + '</span>' +
        '<h2 class="door__title">' + d.title + '</h2>' +
        '<p class="door__lede">' + esc(d.blurb) + '</p>' +
        chips(d) +
        '<div class="door__foot">' +
          /* an entry door is always open, so a pill saying so would only be noise */
          (d.kind === 'entry' ? '' : '<span class="door__status door__status--' + d.status + '">' + STATUS[d.status] + '</span>') +
          (d.detail ? '<span class="door__detail">' + esc(d.detail) + '</span>' : '') +
          '<span class="door__go">' + (closed ? 'Not yet' : (d.go || (isWide(d) ? 'Visit' : 'Enter'))) + '</span>' +
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
      var all = Array.prototype.slice.call(document.querySelectorAll('.door'))
                  .filter(function (el) { return el.offsetParent !== null; });
      var n = all[all.indexOf(a) + (e.key === 'ArrowRight' ? 1 : -1)];
      if (n) { n.focus(); e.preventDefault(); }
    });
  }
  function on(id)  { Object.keys(doorEls).forEach(function (k) { doorEls[k].classList.toggle('is-on', k === id); }); }
  function off(id) { if (doorEls[id]) doorEls[id].classList.remove('is-on'); }

  DOORS.filter(isShelf).forEach(function (d, i) { doorsEl.appendChild(build(d, i < 2)); });

  /* the front of the building: the hero door across the top, the rest in a row beneath */
  var entryEl = document.getElementById('entryDoors'), rowEl = null;
  if (ENTRY && entryEl) {
    (ENTRY.doors || []).forEach(function (d) {
      var a = build(d, true);
      if (d.hero) { entryEl.appendChild(a); return; }
      if (!rowEl) { rowEl = document.createElement('div'); rowEl.className = 'doors doors--row'; entryEl.appendChild(rowEl); }
      rowEl.appendChild(a);
    });
  }

  /* each band, in the order declared, with its own doors beneath it. Nothing is written
     when a band has no doors, so the open edition's section stays empty and hides itself.
     With sections, each band is a page of its own and only shows when that page is open. */
  if (wideEl) BANDS.forEach(function (b) {
    var mine = DOORS.filter(function (d) { return d.kind === b.kind; });
    if (!mine.length) return;
    var band = document.createElement('div');
    band.className = 'band';
    band.dataset.section = b.section || '';
    band.innerHTML = '<h2 class="eyebrow">' + esc(b.label) + '</h2>';
    if (b.section) band.hidden = true;       /* a section names itself in the masthead */
    wideEl.appendChild(band);
    mine.forEach(function (d) { var a = build(d, false); a.dataset.section = b.section || ''; wideEl.appendChild(a); });
  });

  /* ---------- 2. the idle tour ----------
     Left alone, the doors take turns opening, so anyone glancing at
     the screen sees what is behind each one. Any touch stops it; it
     picks up again after a long pause. Not on a phone, where every
     door already stands open. */
  var tour = null, resume = null, i = 0;
  var TOURABLE = [];
  function tourable() {
    return DOORS.filter(function (d) {
      var a = doorEls[d.id];
      return a && !isWide(d) && !d.hero && a.offsetParent !== null;   /* on the screen right now */
    });
  }
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
  /* ---------- the views ----------
     One page, several rooms. With an entry, the address bar says which: nothing after the
     hash is the front; #revision is the hub; a section's id is that section; anything else —
     #plants, #y10, the links classes already hold — lands in the hub as it always did.
     Without an entry there is only the hub, so every address goes there. */
  var mastEl = { eyebrow: document.getElementById('siteEyebrow'),
                 title:   document.querySelector('.masthead h1'),
                 lede:    document.querySelector('.masthead .lede'),
                 crumb:   document.getElementById('crumb'),
                 desc:    document.querySelector('meta[name="description"]') };
  /* what the hub says about itself, taken after the school's own strings went in */
  var base = { eyebrow: mastEl.eyebrow ? mastEl.eyebrow.innerHTML : '',
               title:   mastEl.title   ? mastEl.title.innerHTML   : '',
               lede:    mastEl.lede    ? mastEl.lede.innerHTML    : '',
               doc:     document.title,
               desc:    mastEl.desc ? mastEl.desc.getAttribute('content') : '' };
  function setMast(eyebrow, title, lede, doc, desc) {
    if (mastEl.eyebrow && eyebrow != null) mastEl.eyebrow.innerHTML = eyebrow;
    if (mastEl.title   && title   != null) mastEl.title.innerHTML   = title;
    if (mastEl.lede    && lede    != null) mastEl.lede.innerHTML    = lede;
    if (doc) document.title = doc;
    if (mastEl.desc && desc) mastEl.desc.setAttribute('content', plain(desc));
  }
  function viewFor(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!ENTRY) return 'revision';
    if (!h || h === 'entry') return 'entry';
    if (h === 'revision' || !sectionOf(h)) return 'revision';
    return h;
  }
  var VIEW = null, progHas = false;
  function show(view) {
    if (view === VIEW) return;
    VIEW = view;
    document.body.setAttribute('data-view', view);
    var sec = sectionOf(view), atEntry = view === 'entry', atHub = view === 'revision';
    if (entryEl) entryEl.hidden = !atEntry;
    doorsEl.hidden = !atHub;
    if (wideEl) {
      if (SECTIONS.length) {
        wideEl.hidden = !sec;
        Array.prototype.forEach.call(wideEl.children, function (el) {
          if (el.classList.contains('band')) return;          /* stays hidden: the masthead names the page */
          el.hidden = !sec || el.dataset.section !== sec.id;
        });
      } else wideEl.hidden = !atHub;
    }
    var prog = document.getElementById('prog'), open = document.querySelector('.open');
    if (prog) prog.hidden = !(atHub && progHas);
    if (open) open.hidden = !atHub;
    if (mastEl.crumb) {
      mastEl.crumb.hidden = !ENTRY || atEntry;
      if (ENTRY && ENTRY.crumb) mastEl.crumb.textContent = ENTRY.crumb;
    }
    if (atEntry)  setMast(ENTRY.eyebrow, ENTRY.title, ENTRY.lede, ENTRY.docTitle || base.doc, ENTRY.description || ENTRY.lede);
    else if (sec) setMast(sec.eyebrow || base.eyebrow, sec.title, sec.lede, plain(sec.title) + ' \u2014 ' + base.doc, sec.lede);
    else          setMast(base.eyebrow, (ENTRY && ENTRY.revisionTitle) || base.title, base.lede,
                          (ENTRY && ENTRY.revisionDocTitle) || base.doc, base.desc);
    stopTour(); TOURABLE = tourable(); i = 0;
  }
  show(viewFor(location.hash));

  /* /#plants opens that door and holds it — for projecting a prepared state in class.
     The tour only takes over once someone has touched the page. */
  function lit(id) { return doorEls[id] && doorEls[id].offsetParent !== null ? doorEls[id] : null; }
  var want = (location.hash || '').replace(/^#/, '');
  if (lit(want)) { on(want); doorEls[want].scrollIntoView({ block:'nearest' }); }
  else setTimeout(startTour, 1400);
  window.addEventListener('hashchange', function () {
    var was = VIEW;
    show(viewFor(location.hash));
    if (VIEW !== was) { window.scrollTo(0, 0); restTour(); }
    var id = (location.hash || '').replace(/^#/, '');
    if (lit(id)) { stopTour(); on(id); }
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
    progHas = P.any(res);
    sec.hidden = !(progHas && VIEW === 'revision');
    if (!progHas) return;

    var shelves = (REG.shelves || []).filter(function (sh) { return res.byShelf[sh.id]; });
    document.getElementById('progGrid').innerHTML = shelves.map(function (sh) {
      var t = res.byShelf[sh.id], acc = accentOf(sh.id);
      var mine = LABS.filter(function (l) { return l.shelf === sh.id && res.byLab[l.id]; });
      return '<div class="pshelf" style="--acc:' + acc + '">' +
        '<div class="pshelf__top"><span class="pshelf__name">' + esc(sh.name) + '</span>' +
        '<span class="pshelf__n">' + P.pct(t) + '%</span></div>' +
        bar(t.done, t.total, acc) +
        '<p class="pshelf__of">' + t.done + ' of ' + t.total + ' questions answered correctly</p>' +
        '<ul class="plabs">' + mine.map(function (l) {
          var p = res.byLab[l.id];
          var on = p.started || p.handedIn;
          return '<li class="plab' + (on ? '' : ' plab--cold') + '">' +
            '<a href="' + l.url + '"><span class="plab__name">' + esc(l.short) + '</span>' +
            '<span class="plab__n">' + (on ? P.pct(p) + '%<small> · ' + p.done + ' of ' + p.total + '</small>'
                                          : 'not started') + '</span></a>' +
            (p.handedIn ? '<span class="plab__in">handed in</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }).join('');

    var w = res.whole;
    document.getElementById('progCount').innerHTML =
      '<b>' + P.pct(w) + '% correct so far</b> · ' + w.done + ' of ' + w.total +
      ' questions in ' + w.labs + ' lab' + (w.labs === 1 ? '' : 's') +
      ' · ' + w.started + ' started';

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

    function onDoor(id, t) {
      var el = doorEls[id]; if (!el) return;
      var foot = el.querySelector('.door__foot');
      if (!foot) return;
      var sp = foot.querySelector('.door__prog');
      if (!sp) { sp = document.createElement('span'); sp.className = 'door__prog'; foot.insertBefore(sp, foot.querySelector('.door__go')); }
      sp.title = t.done + ' of ' + t.total + ' questions answered correctly';
      sp.innerHTML = bar(t.done, t.total, 'var(--accent)') + '<span>' + P.pct(t) + '%</span>';
    }
    Object.keys(res.byShelf).forEach(function (id) { onDoor(id, res.byShelf[id]); });
    /* the same figure for the whole subject, on the door that leads to it */
    if (ENTRY) (ENTRY.doors || []).forEach(function (d) { if (d.hero || d.view === 'revision') onDoor(d.id, w); });
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
  function serverProgress(loud) {
    var url = L.submitUrl || (L.site && L.site.submitUrl) || '';   /* each school's own — js/local.js */
    if (!url || !P || !LABS.length) { if (loud) toast('This hub is not set up to keep marks.'); return; }

    var tok = null;
    for (var i = 0; i < LABS.length && !tok; i++) {
      var sv = P.read(LABS[i].id + '.signin');
      if (sv && sv.token && sv.exp * 1000 > Date.now() + 60000) tok = sv.token;
    }
    if (!tok) {                             /* no token here: they must sign in inside a lab */
      if (loud) toast('Open a lab, sign in when you hand in, and your work will follow you here.');
      return;
    }
    var btn = document.getElementById('btnSync');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
    function done(msg) {
      if (btn) { btn.disabled = false; btn.textContent = 'Sync my work'; }
      if (loud && msg) toast(msg);
    }

    fetch(url, { method: 'POST', mode: 'cors',
                 headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                 body: JSON.stringify({ action: 'progress', token: tok }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !j.labs) { done('Could not reach your teacher\u2019s records just now.'); return; }
        window.__SERVER_PROGRESS = j.labs;
        showProgress();                     /* redraw with whichever is further on */
        var n = Object.keys(j.labs).length;
        done(n ? 'Brought back what you have handed in — ' + n + ' lab' + (n === 1 ? '' : 's') +
                 '. Open a lab and press Sync there to get the answers themselves back.'
               : 'Nothing has been handed in yet, so there is nothing to bring back.');
      })
      .catch(function () { done('Could not reach your teacher\u2019s records just now.'); });
  }
  (function () {
    var btn = document.getElementById('btnSync');
    if (btn && (L.submitUrl || (L.site && L.site.submitUrl))) {
      btn.hidden = false;
      btn.addEventListener('click', function () { serverProgress(true); });
    }
  })();
  serverProgress(false);

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
