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
  /* motion.draw — a mark that draws itself when the door opens and stands finished when the
     door is shut. Unlike a trace or an orbit it has an end state, so it is also shown to a
     reader who asked for less movement, just without the drawing; on a narrow screen, where
     no door is ever hovered, it stands finished in its open arrangement (css, narrow).

     The mark is a set of GROUPS, each authored in its own box and placed on the plate twice:
       shut  { x, y, s }  where it sits, and how big, when the door is shut — so the whole of
                          it fits the band a shut door shows
       open  { x, y, s }  where it goes when the door opens: bigger, and beside the words
     A group with only `open` and `onlyOpen:true` is not there at all until the door opens.
     Inside a group:
       paths  [{ d, width, colour, at, seconds }]  each drawn over `seconds`, starting `at`
       marks  [{ cx, cy, r, colour, fill, width, at }]  discs that pop in
       text   [{ x, y, text, size, family, style, weight, spacing, fill, at }]  words that fade up
     `at` is seconds after the door opens; left out, each follows the one before. Strokes keep
     their width whatever the group's scale, so a small shut mark is not drawn in hairlines —
     unless the mark says `scaleStrokes`, when its lines scale with the drawing, because their
     weight is part of its proportion (the Veterinary Society's horse). */
  function drawPart(dr, id) {
    if (!dr) return '';
    var groups = dr.groups || [ { paths: dr.paths, marks: dr.marks, text: dr.text } ];
    var ve = dr.scaleStrokes ? '' : ' vector-effect="non-scaling-stroke"';
    var out = '';
    groups.forEach(function (g) {
      var t = 0, inner = '';
      (g.paths || []).forEach(function (p) {
        var secs = p.seconds || 1.2, at = (p.at != null) ? p.at : t; t = at + secs;
        inner += '<path class="mo-draw" pathLength="1000"' + ve + ' d="' + esc(p.d) + '" ' +
          'fill="none" stroke="' + esc(p.colour || '#fff') + '" stroke-width="' + (p.width || 8) + '" ' +
          'stroke-linecap="round" stroke-linejoin="round"' + (p.opacity != null ? ' opacity="' + p.opacity + '"' : '') +
          ' style="--t:' + secs + 's;--wait:' + at.toFixed(2) + 's"/>';
      });
      (g.marks || []).forEach(function (m, i) {
        var at = (m.at != null) ? m.at : t + 0.12 * i;
        inner += '<g class="mo-pop" style="--wait:' + at.toFixed(2) + 's">' +
          '<circle cx="' + m.cx + '" cy="' + m.cy + '" r="' + m.r + '" fill="' + esc(m.fill || 'none') + '" ' +
          'stroke="' + esc(m.colour || 'none') + '" stroke-width="' + (m.width || 0) + '"' + ve + '/></g>';
      });
      (g.text || []).forEach(function (x, i) {
        var at = (x.at != null) ? x.at : t + 0.35 + 0.15 * i;
        inner += '<text class="mo-fade" style="--wait:' + at.toFixed(2) + 's" ' +
          'x="' + x.x + '" y="' + x.y + '" font-family="' + esc(x.family || 'serif') + '" ' +
          'font-size="' + (x.size || 60) + '" font-style="' + esc(x.style || 'normal') + '" ' +
          'font-weight="' + (x.weight || 400) + '" letter-spacing="' + (x.spacing || 0) + '" ' +
          'fill="' + esc(x.fill || '#fff') + '">' + esc(x.text) + '</text>';
      });
      var sh = g.shut || g.open || { x:0, y:0, s:1 }, op = g.open || sh;
      out += '<g class="mo-g' + (g.onlyOpen ? ' mo-g--open' : '') + '" style="' +
        '--sx:' + (sh.x || 0) + 'px;--sy:' + (sh.y || 0) + 'px;--ss:' + (sh.s || 1) + ';' +
        '--ox:' + (op.x || 0) + 'px;--oy:' + (op.y || 0) + 'px;--os:' + (op.s || 1) + '">' + inner + '</g>';
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
    if (!m) return '';
    if (still && !m.draw) return '';        /* less movement: no lights or orbits, but a mark still stands */
    var body = tracePart(m.trace, d.id) + orbitPart(m.orbits, d.id) + drawPart(m.draw, d.id);
    if (!body) return '';
    var p = plateOf(d), mk = fadeMask(m, p[0], d.id);
    return '<svg class="door__motion' + (m.draw ? ' door__motion--still' : '') + '" viewBox="0 0 ' + p[0] + ' ' + p[1] + '" ' +
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
      (d.personal ? ' door--mine' : '') +
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
    if (d.status === 'local' || d.newTab) { a.target = '_blank'; a.rel = 'noopener'; }
    a.setAttribute('aria-label', plain(d.title) + ' — ' + STATUS[d.status]);
    a.innerHTML = picture(d, eager) + motion(d) +
      '<span class="door__veil" aria-hidden="true"></span><span class="door__light" aria-hidden="true"></span>' +
      '<div class="door__body">' +
        '<span class="door__no">' + esc(d.eyebrow) + '</span>' +
        '<h2 class="door__title">' + d.title + '</h2>' +
        /* a second line under the name, always out: what the thing behind the door is */
        (d.sub ? '<p class="door__sub">' + esc(d.sub) + '</p>' : '') +
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
    /* on a narrow screen every door already stands open, and a finger has no hover: a tap is
       the click, so a touch is left to it rather than flipping the door on the way through */
    a.addEventListener('pointerenter', function (e) { if (e.pointerType === 'touch' && narrow.matches) return; stopTour(); on(d.id); });
    a.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch' && narrow.matches) return; off(d.id); restTour(); });
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

  /* On a narrow screen the picture is fitted whole and top-aligned rather than cropped, so
     every overlay is fitted the same way there: the lights land on the printed art and a drawn
     mark stands on its plate. */
  function fitOverlays() {
    var v = narrow.matches ? 'xMidYMin meet' : 'xMidYMid slice';
    Array.prototype.forEach.call(document.querySelectorAll('.door__motion'), function (el) {
      el.setAttribute('preserveAspectRatio', v);
    });
  }

  /* the front of the building: the hero door across the top, the rest in a row beneath.
     The hero shares its row with one door that only a signed-in student ever sees — their
     own assessments — which is placed after the loop so the order it is declared in does
     not matter, and starts hidden: the record check further down is what opens it. */
  var entryEl = document.getElementById('entryDoors'), rowEl = null, topEl = null, mineEl = null;
  if (ENTRY && entryEl) {
    (ENTRY.doors || []).forEach(function (d) {
      if (d.personal && !d.url && L.record) d.url = L.record.url;   /* one address, kept in `record` */
      /* The student's door is built lazy: it starts hidden, and most visitors never see it, so
         its picture should cost them nothing — and must not be fetched at high priority beside
         the hero's. A lazy image inside a hidden door is not fetched until the door opens. */
      var a = build(d, !d.personal);
      if (d.hero) {
        topEl = document.createElement('div'); topEl.className = 'doors doors--top';
        entryEl.appendChild(topEl); topEl.appendChild(a); return;
      }
      if (d.personal) { mineEl = a; a.hidden = true; return; }
      if (!rowEl) {
        /* one line over the row says what the four have in common, so no door has to */
        if (ENTRY.rowLabel) {
          var lbl = document.createElement('div');
          lbl.className = 'band band--entry';
          lbl.innerHTML = '<h2 class="eyebrow">' + esc(ENTRY.rowLabel) + '</h2>';
          entryEl.appendChild(lbl);
        }
        rowEl = document.createElement('div'); rowEl.className = 'doors doors--row'; entryEl.appendChild(rowEl);
      }
      rowEl.appendChild(a);
    });
    /* The student's door is one door-width of the row beneath: the width each of those doors
       has at rest. The stylesheet works it out from how many doors that row holds, so the
       count is handed over here rather than written into the CSS. It deliberately follows
       the row AT REST, not the lit door: the tour widens a door every few seconds, and a
       door that followed it would drag the hero a third narrower every time Enterprises lit
       up. The top row stands still and the row beneath moves, as the hero alone did. */
    if (mineEl && topEl) {
      topEl.appendChild(mineEl);
      if (rowEl) topEl.style.setProperty('--row-n', rowEl.children.length);
    }
  }

  /* Open or shut the student's door. Arriving AFTER the page has settled — the tracker's
     answer comes a second or two in — it grows in from nothing so the hero visibly makes room
     for it, rather than the whole row jumping. `instant` is for a door that is known at load
     (a returning student): it is simply there, since growing it in would make the hero shrink
     just after the page appeared. With reduced motion, or on a phone, it always just appears.
     Shutting is immediate — a door that lingers after sign-out would be worse. */
  function showMine(open, instant) {
    if (!mineEl || open === !mineEl.hidden) return;
    if (!open) { mineEl.hidden = true; return; }
    mineEl.hidden = false;
    if (instant || still || narrow.matches) return;
    mineEl.style.transition = 'none';
    mineEl.style.flexBasis = '0px';
    mineEl.style.opacity = '0';
    void mineEl.offsetWidth;                       /* commit the start before animating */
    mineEl.style.transition = 'flex-basis .6s cubic-bezier(.2,.7,.2,1), opacity .45s ease .15s';
    mineEl.style.flexBasis = '';                   /* back to the stylesheet's width, animated */
    mineEl.style.opacity = '';
    setTimeout(function () { mineEl.style.transition = ''; }, 800);
  }

  narrow.addEventListener('change', fitOverlays);

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
  fitOverlays();

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
  /* the page a door lives on: a section's page for a door that carries its kind, else the hub */
  function pageOf(id) {
    var d = DOORS.filter(function (x) { return x.id === id; })[0];
    if (!d || d.kind === 'entry') return null;
    var b = BANDS.filter(function (x) { return x.kind === d.kind; })[0];
    return b && b.section ? b.section : 'revision';
  }
  function viewFor(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!ENTRY) return 'revision';
    if (!h || h === 'entry') return 'entry';
    if (h === 'revision') return 'revision';
    if (sectionOf(h)) return h;
    /* #vetsoc names a door on the Societies page: open that page with the door lit, the way
       #plants opens the hub with that shelf lit — a link to project a prepared state in class */
    return pageOf(h) || 'revision';
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

    var who = signedIn();
    if (!who) {                             /* nobody signed in, here or in a lab */
      if (loud) toast('Sign in at the top of the page, or inside a lab when you hand in, and your work will follow you here.');
      return;
    }
    var tok = who.token;
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

  /* ---------- 6. your record, top right ----------
     After every test the Assessment Reflection System builds each student a page of their
     own. That page is at ONE address for the whole school, behind the school's own Google
     gate, and it works out which student to show from whoever signed in to open it. So
     there is no personal link to find, and nothing here that could hand one student's
     address to another.

     What is left for this page to do is ask, before it offers: are you on the list, and is
     there anything there yet? A student who has never reflected is told that plainly rather
     than being sent to an empty page, and a visitor from another school — this hub is
     public, and most people reading it are not at this one — is told who it is for before
     they sign in to anything.

     Configured entirely from js/local.js. No `record` block, no Client ID, or no place to
     ask: the rectangle never appears and the rest of the page is untouched. */

  /* Who is signed in on this device — the hub's own sign-in first, then any lab's, since a
     student who signed in to hand in a lab a moment ago should not be asked again. One
     answer, used by both the record below and Sync above. */
  var SIGNIN_KEY = 'biology-hub.signin';
  function signedIn() {
    var keys = [SIGNIN_KEY].concat(LABS.map(function (l) { return l.id + '.signin'; }));
    for (var i = 0; i < keys.length; i++) {
      var sv = P && P.read(keys[i]);
      /* A minute in hand: a token that dies between the check and the reply is worse than
         no token at all, because the refusal arrives looking like a refusal. */
      if (sv && sv.token && sv.exp * 1000 > Date.now() + 60000) return sv;
    }
    return null;
  }

  (function () {
    var REC  = L.record || null;
    var CID  = L.googleClientId || '';
    var URL_ = L.submitUrl || (L.site && L.site.submitUrl) || '';
    var box  = document.getElementById('acct');
    /* `REC.url` is required: a card that can never take them anywhere is worse than no
       card, so an unconfigured address means no card rather than a dead one. */
    if (!box || !REC || !REC.url || !CID || !URL_) return;   /* not this edition's business */

    var btn     = document.getElementById('acctBtn'),
        btnLbl  = document.getElementById('acctBtnLbl'),
        btnAct  = document.getElementById('acctBtnAct'),
        link    = document.getElementById('acctLink'),
        linkLbl = document.getElementById('acctLinkLbl'),
        linkAct = document.getElementById('acctLinkAct'),
        gsi     = document.getElementById('acctGsi'),
        cap     = document.getElementById('acctFor');

    box.hidden = false;
    document.body.setAttribute('data-acct', '');   /* the masthead keeps its second column */
    btnLbl.textContent = REC.label || 'Students';

    /* Two cards, one shown at a time, because they are two different things: a button does
       something on this page, a link goes somewhere else. Swapping the text inside one
       element would have made a link that sometimes did not link. */
    function hideAll() { btn.hidden = true; link.hidden = true; gsi.hidden = true; cap.hidden = true; }
    function asButton(lbl, act, busy) {
      hideAll(); btn.hidden = false;
      btnLbl.textContent = lbl; btnAct.textContent = act;
      btn.disabled = !!busy;
    }
    function asLink(href, lbl, act) {
      hideAll(); link.hidden = false;
      link.href = href; linkLbl.textContent = lbl; linkAct.textContent = act;
    }

    /* The name exactly as the school's roster writes it, and no cleverer than that.
       Taking the first word to make "Park's Biology" reads as a first name here and is a
       family name for most of this school — Korean rosters put the family name first, and
       a card that calls a student by the wrong half of their name every time they open the
       page is worse than one that does not try. So: no possessive, no reordering, no
       guessing which part is which. */
    function tidyName(n) {
      return String(n || '').trim().replace(/\s+/g, ' ');
    }

    /* The student's door on the front page follows this same answer. A positive one is
       remembered against the email it was for, so a returning student sees their door at
       once instead of watching it arrive a second later; the check still runs and shuts
       the door if the answer has changed. Only a definite answer shuts it — a network
       failure leaves it as it was, because a door that vanishes whenever the wifi blinks
       teaches a student not to trust it. */
    var MINE_KEY = 'biology-hub.mine';
    function mineRemembered(who) {
      try {
        var m = JSON.parse(localStorage.getItem(MINE_KEY) || 'null');
        return (m && who && m.email && m.email === who.email) ? m : null;
      } catch (e) { return null; }
    }
    function mineSay(counts) {
      var el = mineEl && mineEl.querySelector('.door__detail');
      if (!el) return;
      var parts = [];
      if (counts.count) parts.push(counts.count + ' assessment' + (counts.count === 1 ? '' : 's'));
      if (counts.unfinished) parts.push(counts.unfinished + ' unfinished');
      el.textContent = parts.join(' · ');
    }
    /* the card's one line: "3" or "3 · 1 unfinished" — the door spells the words out */
    function cardCounts(n, unfinished) {
      var bits = [];
      if (n) bits.push(String(n));
      if (unfinished) bits.push(unfinished + ' unfinished');
      return bits.join(' · ');
    }
    function mineOpen(who, counts) {
      if (!mineEl) return;
      mineSay(counts);
      showMine(true);
      try { localStorage.setItem(MINE_KEY, JSON.stringify({ email: who.email, count: counts.count,
                                                          unfinished: counts.unfinished, at: Date.now() })); } catch (e) {}
    }
    function mineShut() {
      showMine(false);
      try { localStorage.removeItem(MINE_KEY); } catch (e) {}
    }

    /* `quiet`: something already stands on the card (a remembered answer), so leave it there
       while the check runs instead of flashing "Checking…" over counts the door already shows */
    function ask(who, quiet) {
      if (!quiet) asButton(REC.label || 'Students', 'Checking…', true);
      fetch(URL_, { method:'POST', mode:'cors',
                    headers:{ 'Content-Type':'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action:'record', token: who.token }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          /* a failed check leaves a remembered answer standing, on the card as on the door */
          if (!j) return quiet ? null : offerRetry('Could not check just now — try again');

          if (!j.ok) {
            /* Signed in, but with the wrong account. Say which, and which one to use:
               "not on the list" sends a student hunting for a teacher when the whole of
               the problem is that they are signed in to their own Gmail. */
            if (j.why === 'not a school account') {
              mineShut();
              return asSignIn('Use your @' + (j.domain || REC.domain || 'school') + ' account');
            }
            if (j.why === 'not signed in') { mineShut(); return asSignIn(); }
            return offerRetry('Not available just now — try again');   /* not set up, or unreachable */
          }

          var lbl = tidyName(j.name) || tidyName(who.name) || (REC.label || 'Your Biology');

          var unfinished = j.incomplete || 0;
          if (!j.count && !unfinished) {
            /* On the list, nothing recorded yet — a new student, or one who has not sat a
               test. Not an error, and not worth a link to an empty page. */
            mineShut();
            asButton(lbl, 'Your assessments start at your first reflection', true);
            return;
          }
          mineOpen(who, { count: j.count || 0, unfinished: unfinished });
          /* Two numbers, never added together. A finished reflection is an assessment the
             student has done; an unfinished one is not — the reflection IS the work — but
             hiding it would leave them wondering where a test went. So it is named, and the
             card still links through: the record page says plainly what is missing and why.
             A teacher who has only ever submitted to the TEST class sees "test record". */
          asLink(REC.url, lbl, (j.testOnly ? 'My test assessments' : 'My assessments') + ' · ' + cardCounts(j.count || 0, unfinished));
          /* No `title` tooltip here: the house rule is instant tooltips or none, and the
             counts are already on the card and on the door. */
        })
        .catch(function () { if (!quiet) offerRetry('Could not check just now — try again'); });
    }

    /* A card they can press to try again, with the reason on it. Pressing it runs the check
       again if they are still signed in, and brings Google's button back if they are not. */
    function offerRetry(act) { asButton(REC.label || 'Students', act, false); }

    /* Signed out, Google's own "Sign in with Google" button stands in the corner, so ONE press
       starts signing in. It used to sit in a panel behind a button of ours, which made students
       press "sign in" twice. The line above it says who it is for — or, after a try that did not
       work, why, with the button still there to choose another account. Google's script loads on
       its own time: until it arrives the card says so, and if a network blocks it the card says
       that rather than offering a button that does nothing. One Tap is not used — a browser may
       refuse it silently. */
    var gsiReady = false, gsiWaiting = false;
    function mountGsi() {
      if (gsiReady) return true;
      if (!(window.google && google.accounts && google.accounts.id)) return false;
      try {
        google.accounts.id.initialize({ client_id: CID, callback: onCredential });
        /* `locale` pins the button to the site's English: Google otherwise follows the browser,
           and on a Korean computer it read "Google 계정으로 로그인" beside an English page */
        google.accounts.id.renderButton(gsi, { type:'standard', theme:'filled_black', size:'large',
                                               text:'signin_with', shape:'pill', logo_alignment:'left', width: 240,
                                               locale:'en-GB' });
        gsiReady = true;
      } catch (e) { return false; }
      return true;
    }
    function asSignIn(why) {
      if (mountGsi()) {
        hideAll();
        cap.textContent = why || REC.label || 'Students';
        cap.classList.toggle('acct__for--why', !!why);
        cap.hidden = false; gsi.hidden = false;
        return;
      }
      asButton(REC.label || 'Students', 'Loading sign-in…', true);
      if (gsiWaiting) return;
      gsiWaiting = true;
      var t0 = Date.now();
      (function wait() {
        if (mountGsi()) { gsiWaiting = false; if (!signedIn()) asSignIn(why); return; }
        if (Date.now() - t0 > 10000) {
          gsiWaiting = false;
          offerRetry('Sign-in could not load here — try again');
          return;
        }
        setTimeout(wait, 150);
      })();
    }

    /* The token is Google's to vouch for, and the server checks its signature with Google
       before it reads a thing. It is opened here only to show a name while we wait. */
    function readToken(jwt) {
      try {
        var b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        var j = JSON.parse(decodeURIComponent(escape(atob(b))));
        return { token:jwt, name:j.name || j.email || '', email:j.email || '', exp:j.exp || 0 };
      } catch (e) { return null; }
    }
    function onCredential(res) {
      var who = res && res.credential ? readToken(res.credential) : null;
      if (!who) return;
      gsi.hidden = true;
      try { localStorage.setItem(SIGNIN_KEY, JSON.stringify(who)); } catch (e) {}
      ask(who);
      serverProgress(false);     /* their handed-in labs too, now we know who they are */
    }

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      var who = signedIn();
      if (who) ask(who); else asSignIn();
    });

    var have = signedIn();
    if (have) {                   /* already signed in, here or in a lab */
      var known = mineRemembered(have);
      if (known) {                                      /* at once, then confirmed below */
        mineSay(known);
        showMine(true, true);
        asLink(REC.url, tidyName(have.name) || (REC.label || 'Your Biology'), 'My assessments · ' + cardCounts(known.count, known.unfinished));
      }
      ask(have, !!known);
    } else {
      /* signed out, or the sign-in has expired: a remembered door must not stand open, and the
         way to sign in is offered at once */
      showMine(false);
      asSignIn();
    }
  })();

  /* ---------- 7. credits ----------
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

  /* ---------- 8. toast ---------- */
  var toastT = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 4200);
  }
})();
