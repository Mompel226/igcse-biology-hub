/* ============================================================
   Biology Hub — the front door
   Reads window.HUB, stands the doors up, and makes them answer
   the pointer. Changing what is behind a door means editing
   js/shelves.js (both editions) or js/local.js (this school only).
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

  /* The wide doors — the school's own clubs and societies, each with a website of its own.
     js/local.js names them and tags each one with a kind. With `sections` (the NLCS edition),
     each section is a band: a page of its own behind an entry door (#ccas, #societies, #bryant,
     #enterprises), and a new kind is one more entry in `sections` in js/local.js. The two
     bands written here are only the fallback for an edition without sections: then they stand
     under the shelves, in this order. A school with none of a kind simply gets no band; adding
     a club or a society is one entry in js/local.js `doors`. */
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
    /* a click on a door that opens a new tab takes the focus with it; the blur that follows must
       not unlight a door the pointer is still on, or it grows and snaps back under the hand */
    a.addEventListener('blur',         function () { if (!a.matches(':hover')) off(d.id); restTour(); });
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
  function on(id)  { restWidths(); Object.keys(doorEls).forEach(function (k) { doorEls[k].classList.toggle('is-on', k === id); }); }   /* rest widths first: a door lit before its width was known would re-wrap */
  function off(id) { if (doorEls[id]) doorEls[id].classList.remove('is-on'); }

  /* ---------- a feature: the thing itself, on the page ----------
     A door leads somewhere else. Some activities have nowhere else to be: no website, only a film,
     a few facts and a teacher to ask. A band entry marked `feature` (js/local.js) is drawn here in
     full instead of as a door: a film, the steps of the activity down a depth line, the pictures
     taken from the film, and the facts.

       film    fetched only when somebody presses play, so a visitor who does not watch it pays
               nothing for it. It has no download button and no menu on a right click.
       rail    the steps, each at its depth. A step with `from` (a second of the film) lights while
               the film is in that part, so the line follows the film down.
       stills  a still with `at` is a button: it plays the film from that second.
       why     one coloured box of two or three short points, each with a small sign. On a wide
               screen it stands under the film, and it is what makes the two columns the same
               height: the box grows, or the steps of the rail spread, so that no empty water
               is left under the film (css/hub.css, .feat__a and .feat__b).

     Nothing here moves for a reader who has asked for less movement: the stylesheet's own rule
     stops the water, and the film only ever plays when asked. */
  function pic(base, widths, sizes, alt, cls) {
    var b = 'assets/doors/' + base;
    var set = function (ext) { return widths.map(function (w) { return b + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', '); };
    return '<picture><source type="image/webp" srcset="' + set('webp') + '" sizes="' + sizes + '">' +
      '<img class="' + cls + '" src="' + b + '-' + widths[widths.length - 1] + '.jpg" srcset="' + set('jpg') + '" sizes="' + sizes + '"' +
      ' alt="' + esc(alt || '') + '" loading="lazy" decoding="async" draggable="false"></picture>';
  }
  /* the small signs in a feature's `why` box, named by `icon` in js/local.js: a current, two fish that
     meet, a shield. Signs, not drawings of anything: each is a few strokes. */
  var WHY_ICON = {
    current: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8.5c2.4-2 4.6-2 7 0s4.6 2 7 0"/><path d="M2.5 15.5c2.4-2 4.6-2 7 0s4.6 2 7 0"/><path d="M17.5 5.5l3.5 3-3.5 3"/><path d="M17.5 12.5l3.5 3-3.5 3"/></svg>',
    meet: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8c2-2.6 5.5-2.6 7.5 0-2 2.6-5.5 2.6-7.5 0z"/><path d="M10 8l2.5-2v4z"/><path d="M21.5 16c-2-2.6-5.5-2.6-7.5 0 2 2.6 5.5 2.6 7.5 0z"/><path d="M14 16l-2.5-2v4z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 2.8v5.4c0 4.5-3 8-7.5 9.8-4.5-1.8-7.5-5.3-7.5-9.8V5.8z"/><path d="M8.6 12.2l2.4 2.4 4.6-4.9"/></svg>'
  };
  function clock(sec) { sec = Math.floor(sec); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
  function buildFeature(d) {
    var el = document.createElement('article');
    var f = d.film || null, steps = (d.rail && d.rail.steps) || [], st = d.stills || null, list = (st && st.list) || [];
    el.className = 'feat feat--' + d.id;
    el.dataset.id = d.id;
    el.style.setProperty('--accent', d.accent || '#4FC3F7');
    el.setAttribute('aria-label', plain(d.title));
    var bubbles = [[6, 7, 13, 0], [14, 4, 17, 6], [23, 9, 15, 3], [37, 5, 19, 9], [48, 8, 14, 1], [61, 4, 18, 11],
                   [70, 10, 16, 5], [82, 6, 13, 8], [91, 5, 20, 2]].map(function (b) {
      return '<i style="--x:' + b[0] + '%;--s:' + b[1] + 'px;--d:' + b[2] + 's;--w:-' + b[3] + 's"></i>';
    }).join('');
    el.innerHTML =
      '<div class="feat__water" aria-hidden="true">' + bubbles + '</div>' +
      '<div class="feat__main">' +
        '<div class="feat__b">' +
        '<header class="feat__head">' +
          '<span class="feat__no">' + esc(d.eyebrow) + '</span>' +
          '<h2 class="feat__title">' + d.title + '</h2>' +
          (d.sub ? '<p class="feat__sub">' + esc(d.sub) + '</p>' : '') +
          (d.blurb ? '<p class="feat__lede">' + esc(d.blurb) + '</p>' : '') +
          chips(d) +
        '</header>' +
        (steps.length ? '<div class="feat__rail">' +
          (d.rail.label ? '<h3 class="feat__label">' + esc(d.rail.label) + '</h3>' : '') +
          '<ol class="rail">' + steps.map(function (s) {
            return '<li class="rail__step"><span class="rail__mark">' + esc(s.mark) + '</span><span class="rail__dot" aria-hidden="true"></span>' +
              '<span class="rail__txt"><b class="rail__t">' + esc(s.t) + '</b> <span class="rail__text">' + esc(s.text) + '</span></span></li>';
          }).join('') + '</ol></div>' : '') +
        '</div>' +
        '<div class="feat__a">' +
        (f ? '<figure class="feat__film">' +
          '<div class="film" data-state="idle">' +
            '<video class="film__video" playsinline preload="none" poster="assets/doors/' + esc(f.poster) + '-1280.jpg"' +
              ' controlslist="nodownload noremoteplayback" disableremoteplayback aria-label="' + esc(f.alt || plain(d.title)) + '"></video>' +
            '<button type="button" class="film__play">' +
              '<span class="film__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5.2v13.6L19 12z" fill="currentColor"/></svg></span>' +
              '<span class="film__lbl">' + esc(f.play || 'Watch the film') + '</span>' +
              (f.note ? '<span class="film__len">' + esc(f.note) + '</span>' : '') +
            '</button>' +
          '</div>' +
          (f.credit ? '<figcaption class="film__credit">' + esc(f.credit) + '</figcaption>' : '') +
        '</figure>' : '') +
        (d.why ? '<aside class="why"' + (d.why.k ? ' aria-label="' + esc(d.why.k) + '"' : '') + '>' +
          (d.why.k ? '<h3 class="why__k">' + esc(d.why.k) + '</h3>' : '') +
          (d.why.points && d.why.points.length ? '<ul class="why__list">' + d.why.points.map(function (x) {
            return '<li class="why__i"><span class="why__top">' +
              (WHY_ICON[x.icon] ? '<span class="why__ico" aria-hidden="true">' + WHY_ICON[x.icon] + '</span>' : '') +
              '<b class="why__t">' + esc(x.t) + '</b></span><span class="why__text">' + esc(x.text) + '</span></li>';
          }).join('') + '</ul>' : '') +
          (d.why.text ? '<p class="why__p">' + esc(d.why.text) + '</p>' : '') +
        '</aside>' : '') +
        '</div>' +
      '</div>' +
      (list.length ? '<section class="feat__stills">' +
        '<div class="feat__h"><h3>' + esc(st.title || '') + '</h3>' + (f && st.hint ? '<p class="feat__hint">' + esc(st.hint) + '</p>' : '') + '</div>' +
        '<ul class="stills">' + list.map(function (x, i) {
          var can = f && x.at != null;
          var inner = '<span class="still__pic">' + pic(x.img, [480, 960], '(max-width:560px) 50vw, (max-width:900px) 33vw, 20vw', x.alt, 'still__img') +
              (can ? '<span class="still__at" aria-hidden="true"><svg viewBox="0 0 24 24" width="11" height="11"><path d="M8 5.2v13.6L19 12z" fill="currentColor"/></svg>' + clock(x.at) + '</span>' : '') +
            '</span><span class="still__cap"><b class="still__t">' + esc(x.t) + '</b>' +
              (x.sci ? '<i class="still__sci">' + esc(x.sci) + '</i>' : '') +
              '<span class="still__text">' + esc(x.text) + '</span></span>';
          return '<li class="stills__i">' + (can
            ? '<button type="button" class="still still--go" data-i="' + i + '" aria-label="' + esc(x.t + '. ' + x.text + ' Play the film from ' + clock(x.at) + '.') + '">' + inner + '</button>'
            : '<div class="still">' + inner + '</div>') + '</li>';
        }).join('') + '</ul>' +
      '</section>' : '') +
      (d.facts && d.facts.length ? '<dl class="facts">' + d.facts.map(function (x) {
        return '<div class="fact"><dt>' + esc(x.k) + '</dt><dd>' + esc(x.v) +
          (x.mail ? ' <a class="fact__mail" href="mailto:' + esc(x.mail) + '">' + esc(x.mail) + '</a>' : '') + '</dd></div>';
      }).join('') + '</dl>' : '');

    var v = el.querySelector('.film__video'), box = el.querySelector('.film');
    if (!v) return el;
    var playBtn = el.querySelector('.film__play'), lbl = el.querySelector('.film__lbl');
    var stepEls = el.querySelectorAll('.rail__step');
    function live(k) { Array.prototype.forEach.call(stepEls, function (li, i) { li.classList.toggle('is-live', i === k); }); }
    function follow() {
      var t = v.currentTime, k = -1;
      /* only while the film is showing: going back to the poster also sets the time, to 0 */
      if (box.dataset.state === 'on') steps.forEach(function (s, i) { if (s.from != null && t >= s.from) k = i; });
      live(k);
    }
    /* play() is called inside the press itself, which is what a phone asks for before it will play
       anything with sound; the jump to `at` waits until the film knows its own length */
    function start(at) {
      if (!v.getAttribute('src')) v.src = f.src;
      v.controls = true; box.dataset.state = 'on';
      if (at != null) {
        if (v.readyState >= 1) v.currentTime = at;
        else v.addEventListener('loadedmetadata', function () { v.currentTime = at; }, { once:true });
      }
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    playBtn.addEventListener('click', function () { start(null); });
    Array.prototype.forEach.call(el.querySelectorAll('.still--go'), function (b) {
      b.addEventListener('click', function () {
        start(list[+b.dataset.i].at);
        var r = box.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) box.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block:'center' });
      });
    });
    v.addEventListener('timeupdate', follow);
    v.addEventListener('seeked', follow);
    /* at the end the picture goes back to its poster, with the way to watch it again */
    v.addEventListener('ended', function () {
      v.controls = false; box.dataset.state = 'idle'; live(-1);
      if (lbl && f.again) lbl.textContent = f.again;
      v.load();
    });
    v.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return el;
  }

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
     The hero shares the front row with any `top` doors (Bio English Lab, Write-Up Lab) and
     with one personal door: My assessments for a signed-in student, or the Assessment system
     for a teacher in teacher mode. The personal door is placed after the loop, so the order it
     is declared in does not matter, and starts hidden: the record check further down opens it. */
  var entryEl = document.getElementById('entryDoors'), rowEl = null, topEl = null, mineEl = null, sysEl = null;
  if (ENTRY && entryEl) {
    (ENTRY.doors || []).forEach(function (d) {
      if (d.personal && !d.teacher && !d.url && L.record) d.url = L.record.url;   /* the fallback, kept in `record`; goMine() follows the newest copy */
      /* A teacher's door has no address anywhere in this site. The labs script hands it over only
         to a signed-in teacher on its list, and the page behind it checks again with the school's
         own Google sign-in before it shows a single link. Until then the door is not on the page. */
      if (d.teacher) d.url = '#';
      /* The student's door is built lazy: it starts hidden, and most visitors never see it, so
         its picture should cost them nothing — and must not be fetched at high priority beside
         the hero's. A lazy image inside a hidden door is not fetched until the door opens. */
      var a = build(d, !d.personal);
      if (d.hero) {
        topEl = document.createElement('div'); topEl.className = 'doors doors--top';
        entryEl.appendChild(topEl); topEl.appendChild(a); return;
      }
      if (d.personal) { if (d.teacher) sysEl = a; else mineEl = a; a.hidden = true; return; }
      /* a door marked `top` stands on the front row beside the hero, not in the row beneath */
      if (d.top && topEl) { a.classList.add('door--top'); topEl.appendChild(a); return; }
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
    /* Below the row, doors that lead out of the school altogether (entry.below in js/local.js):
       full width, words always out, like the hero. The open edition declares none. */
    if (ENTRY.below && ENTRY.below.doors && ENTRY.below.doors.length) {
      if (ENTRY.below.label) {
        var bl = document.createElement('div');
        bl.className = 'band band--entry band--below';
        bl.innerHTML = '<h2 class="eyebrow">' + esc(ENTRY.below.label) + '</h2>';
        entryEl.appendChild(bl);
      }
      var belowEl = document.createElement('div'); belowEl.className = 'doors doors--below';
      entryEl.appendChild(belowEl);
      ENTRY.below.doors.forEach(function (d) {
        d.kind = 'entry'; d.hero = true;
        var b = build(d, false); b.classList.add('door--below'); belowEl.appendChild(b);
      });
    }
    /* The personal door joins the front row as one more small door: like the `top` doors it
       takes one share of the row, and the hero takes 2.4 (css/hub.css, .door--hero and
       .door--top/.door--mine). restWidths() below sets the width the words are laid out at. */
    if ((mineEl || sysEl) && topEl) {
      if (mineEl) topEl.appendChild(mineEl);
      if (sysEl) topEl.appendChild(sysEl);       /* the same place: only one of the two is ever open */
    }
  }

  /* Open or shut the student's door. Arriving AFTER the page has settled — the tracker's
     answer comes a second or two in — it grows in from nothing so the hero visibly makes room
     for it, rather than the whole row jumping. `instant` is for a door that is known at load
     (a returning student): it is simply there, since growing it in would make the hero shrink
     just after the page appeared. With reduced motion, or on a phone, it always just appears.
     Shutting is immediate — a door that lingers after sign-out would be worse. */
  /* The words on a small front-row door are laid out at the width the door has AT REST, however
     wide the door grows when it is lit. Otherwise the title re-wraps from two lines to one half
     way through the widening and the whole block drops a line under the pointer. The resting
     width is arithmetic — (row − gaps) ÷ (hero's 2.4 shares + one per small door) — so it is the
     same whether or not a door happens to be lit when it is worked out. */
  function restWidths() {
    if (!topEl) return;
    var small = Array.prototype.filter.call(topEl.children, function (el) { return !el.hidden && !el.classList.contains('door--hero'); });
    if (narrow.matches) { small.forEach(function (el) { el.style.removeProperty('--rest-w'); }); return; }
    var row = topEl.getBoundingClientRect().width || (entryEl && entryEl.getBoundingClientRect().width) || 0;
    if (!row) { requestAnimationFrame(restWidths); return; }   /* not laid out yet: ask again next frame */
    var w = (row - 8 * small.length) / (2.4 + small.length);
    small.forEach(function (el) { el.style.setProperty('--rest-w', Math.floor(w) + 'px'); });
  }
  function showDoor(el, open, instant) {
    if (!el || open === !el.hidden) return;
    if (open) el.hidden = false;           /* count it before its width is worked out */
    restWidths();
    if (!open) { el.hidden = true; return; }
    el.hidden = false;
    if (instant || still || narrow.matches) return;
    el.style.transition = 'none';
    el.style.flexBasis = '0px';
    el.style.opacity = '0';
    void el.offsetWidth;                           /* commit the start before animating */
    el.style.transition = 'flex-basis .6s cubic-bezier(.2,.7,.2,1), opacity .45s ease .15s';
    el.style.flexBasis = '';                       /* back to the stylesheet's width, animated */
    el.style.opacity = '';
    setTimeout(function () { el.style.transition = ''; }, 800);
  }
  /* The place beside the hero holds one of two doors, or neither: 'mine', a student's own record,
     or 'system', the assessment system, for a teacher in teacher mode. Swapping one for the other
     is instant — the place is already open, so there is nothing to grow into. */
  function showPersonal(which, instant) {
    var want = which === 'system' ? sysEl : which === 'mine' ? mineEl : null;
    var swap = [mineEl, sysEl].some(function (el) { return el && el !== want && !el.hidden; });
    [mineEl, sysEl].forEach(function (el) { if (el !== want) showDoor(el, false); });
    if (want) showDoor(want, true, instant || swap);
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
    mine.forEach(function (d) { var a = d.feature ? buildFeature(d) : build(d, false); a.dataset.section = b.section || ''; wideEl.appendChild(a); });
  });
  fitOverlays();
  requestAnimationFrame(restWidths);
  window.addEventListener('load', restWidths);
  window.addEventListener('resize', function () { clearTimeout(restWidths.t); restWidths.t = setTimeout(restWidths, 120); });

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
      /* never the hero or a student's own door: those two open only when pointed at, so the
         front row does not shift every few seconds on its own */
      return a && !isWide(d) && !d.hero && !d.personal && !d.top && a.offsetParent !== null;   /* on the screen right now */
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
  /* A section may carry a `note` (js/local.js): one small card in the masthead, between the heading
     and the account corner. It says something about the page that is worth knowing and is not the
     page's subject: who the section is named after. With a `url` the whole card is the link. */
  var noteEl = null;
  function setNote(n) {
    var mast = document.querySelector('.masthead');
    if (!mast || (!n && !noteEl)) return;
    if (!noteEl) {
      noteEl = document.createElement('a'); noteEl.className = 'mnote';
      mast.insertBefore(noteEl, mast.querySelector('.masthead__r'));
    }
    mast.classList.toggle('masthead--note', !!n);
    noteEl.hidden = !n;
    if (!n) return;
    if (n.url) { noteEl.href = n.url; noteEl.target = '_blank'; noteEl.rel = 'noopener'; }
    else { noteEl.removeAttribute('href'); noteEl.removeAttribute('target'); noteEl.removeAttribute('rel'); }
    noteEl.innerHTML = (n.img ? pic(n.img, [128, 256], '56px', n.alt, 'mnote__img') : '') +
      '<span class="mnote__txt">' +
        (n.eyebrow ? '<span class="mnote__eye">' + esc(n.eyebrow) + '</span>' : '') +
        (n.name ? '<span class="mnote__name">' + esc(n.name) + '</span>' : '') +
        (n.text ? '<span class="mnote__text">' + esc(n.text) + '</span>' : '') +
        (n.url && n.go ? '<span class="mnote__go">' + esc(n.go) + '</span>' : '') +
      '</span>';
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
    setNote(sec && sec.note);
    /* a film must not play on behind a page that is no longer showing */
    if (wideEl) Array.prototype.forEach.call(wideEl.querySelectorAll('video'), function (v) { if (!v.paused) v.pause(); });
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
     Three years, the same split the student dashboard uses. Pick one and its
     topics appear beneath; point at a topic and its door opens; point at the
     year itself and every door that year touches lights up. */
  function mark(ids) {
    Object.keys(doorEls).forEach(function (k) { doorEls[k].classList.toggle('is-year', ids.indexOf(k) >= 0); });
  }
  var yearsEl = document.getElementById('years');
  var YKEY = 'biology-hub.year';
  /* Each year group's IGCSE exams, and so its syllabus (Daniel, 28 Sep 2026: "make very clear ... which syllabus is
     for what year"). The school year turns over on 1 August, so 2026–27 ends with the June 2027 exams: Year 11 sits
     them this year, Year 10 next, Year 9 in two. A student is kept as the year of their exams ('labs.examYear',
     which the labs' IGCSE 0610 badge and Bio English share), so next August a Year 9 becomes a Year 10 by itself.
     The versions come from js/data/syllabus-years.js (tools/stamp.mjs, from labs-shared). */
  var EXAM_KEY = 'labs.examYear';
  function schoolYearEnd() { var d = new Date(); return d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear(); }
  function examYearOf(g) { return schoolYearEnd() + (11 - g); }
  function groupOf(e) { var g = 11 - (e - schoolYearEnd()); return g >= 9 && g <= 11 ? g : null; }
  function sylFor(e) {
    var L = window.SYLLABUS_YEARS || [], hit = null, newest = null;
    L.forEach(function (v) {
      var m = /^(\d{4})(?:-(\d{4}))?$/.exec(v.id); if (!m) return;
      var a = +m[1], b = +(m[2] || m[1]);
      if (e >= a && e <= b) hit = v;
      if (!newest || b > newest.b) newest = { v: v, b: b };
    });
    return hit ? { v: hit, exact: true } : newest ? { v: newest.v, exact: false } : null;
  }
  function lab(id) { return String(id).replace('-', '\u2013'); }
  /* the two facts that follow from a year, as [label, value]: when its IGCSE exams are, and their syllabus */
  function examFacts(g) {
    var e = examYearOf(g), f = sylFor(e), out = [['IGCSE exams', String(e)]];
    if (f) out.push(['Syllabus', f.exact ? lab(f.v.id) + (f.v.same ? ' (the same as ' + lab(f.v.same) + ')' : '')
                                         : 'not published yet (until then, ' + lab(f.v.id) + ')']);
    return out;
  }
  if (yearsEl && YEARS.length) {
    /* Three lines, each one thing (Daniel, 28 Sep 2026: the block "looks a bit too much information and clunky"):
       the page's settings in one row (the three years as one switch, the IB layer at the end), then the two
       facts the year decides, then that year's topics as one run of words. */
    var head = document.createElement('div'); head.className = 'yhead';
    var lbl = document.createElement('span'); lbl.className = 'path__lbl'; lbl.textContent = 'Your year';
    var tabs = document.createElement('div'); tabs.className = 'ytabs';
    tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Your year');
    head.appendChild(lbl); head.appendChild(tabs);
    var ibBtn = document.getElementById('ibToggle'); if (ibBtn) head.appendChild(ibBtn);
    var pills = document.createElement('div'); pills.className = 'path'; pills.id = 'path';
    pills.setAttribute('aria-label', 'Your topics');
    var ysyl = document.createElement('p'); ysyl.className = 'ysyl'; ysyl.setAttribute('aria-live', 'polite');
    var paintFacts = function (g) {
      if (!g) { ysyl.textContent = 'Choose your year to see when your IGCSE exams are and which syllabus they follow.'; return; }
      ysyl.innerHTML = examFacts(g).map(function (p) { return '<span class="ysyl__k">' + esc(p[0]) + '</span> ' + esc(p[1]); })
        .join(' <span class="ysyl__sep" aria-hidden="true">·</span> ');
    };
    var choose = function (id, save) {
      var y = YEARS.filter(function (v) { return v.id === id; })[0];
      Array.prototype.forEach.call(tabs.querySelectorAll('.ytab'), function (b) {
        b.setAttribute('aria-pressed', y && b.dataset.year === y.id ? 'true' : 'false');
      });
      pills.innerHTML = '';
      paintFacts(y ? +String(y.id).replace(/\D/g, '') : 0);
      if (!y) return;
      y.steps.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'step'; b.dataset.shelf = s.shelf;
        b.innerHTML = '<b>' + esc(s.no) + '</b> ' + esc(s.t);      /* the space: a screen reader says "9 Transport…", not "9Transport…" */
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
      if (save) { try { localStorage.setItem(YKEY, y.id); localStorage.setItem(EXAM_KEY, String(examYearOf(+String(y.id).replace(/\D/g, '')))); } catch (e) {} }
    };
    YEARS.forEach(function (y) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ytab'; b.dataset.year = y.id; b.setAttribute('aria-pressed', 'false');
      var g = +String(y.id).replace(/\D/g, '');
      b.textContent = y.label;
      if (g) b.setAttribute('aria-label', y.label + ', IGCSE exams ' + examYearOf(g));
      var doors = y.steps.map(function (s) { return s.shelf; });
      b.addEventListener('click', function () { choose(y.id, true); });
      b.addEventListener('pointerenter', function () { stopTour(); mark(doors); });
      b.addEventListener('focus',        function () { stopTour(); mark(doors); });
      b.addEventListener('pointerleave', function () { mark([]); restTour(); });
      b.addEventListener('blur',         function () { mark([]); restTour(); });
      tabs.appendChild(b);
    });
    yearsEl.appendChild(head); yearsEl.appendChild(ysyl); yearsEl.appendChild(pills);
    var savedY = null; try { savedY = localStorage.getItem(YKEY); } catch (e) {}
    /* the year of the exams wins: it moves the tab on by itself each August */
    try { var ex = parseInt(localStorage.getItem(EXAM_KEY), 10), gx = ex ? groupOf(ex) : null; if (gx) savedY = 'y' + gx; } catch (e) {}
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

  /* ---------- 5. open now ----------
     A lab's size is added here from the register (js/data/labs.js, copied from labs-shared/labs.json
     by tools/stamp.mjs), never written in shelves.js: written there by hand it went stale as the labs
     grew — the Circulation Lab said 97 questions at 115, the Plants Lab 91 at 116. Matched by url, as
     a shelf's statOf() finds its lab, so an entry the register does not know shows no size.
     tools/status.mjs reports a sub that still states one. */
  function sizeOf(o) {
    var u = String(o.url || '').replace(/\/$/, '');
    var l = ((window.LABS_REGISTER || {}).labs || []).filter(function (x) {
      return String(x.url || '').replace(/\/$/, '') === u;
    })[0];
    return l && l.stations && l.questions ? l.stations + ' stations, ' + l.questions + ' questions' : '';
  }
  var openList = document.getElementById('openList');
  if (openList) {
    OPEN.forEach(function (o) {
      var size = sizeOf(o);
      var li = document.createElement('li');
      li.className = 'open__item' + (o.ibOnly ? ' open__item--ib' : '');
      li.innerHTML =
        '<a class="open__link" href="' + o.url + '">' +
          '<span class="kind kind--' + o.kind + '">' + esc(o.kind) + '</span>' +
          '<span class="open__txt">' +
            '<span class="open__title">' + esc(o.title) + '</span>' +
            '<span class="open__sub">' + esc(o.sub) + (size ? ' · ' + size : '') +
              (o.ib ? ' <span class="ib-note">· ' + esc(o.ib) + '</span>' : '') + '</span>' +
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
  /* One Google sign-in for the whole site, kept by js/signin.js (shared with every lab): who()
     is whoever signed in on this browser and has not signed out, live() the same while their
     token is still good for a minute or more. */
  var SI   = window.SignIn || null;

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
            (p.handedIn ? '<span class="plab__in">in the records</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }).join('');

    var w = res.whole;
    document.getElementById('progCount').innerHTML =
      '<b>' + P.pct(w) + '% correct so far</b> · ' + w.done + ' of ' + w.total +
      ' questions in ' + w.labs + ' lab' + (w.labs === 1 ? '' : 's') +
      ' · ' + w.started + ' started';

    var signedIn = !!(SI && SI.who());
    var note = 'Counted in <b>this browser</b>. Clearing your history or site data erases it, and another device starts from nothing.';
    if (w.handedIn) {
      note += signedIn
        ? ' What you did <b>while signed in</b> is also in your teacher\u2019s records \u2014 the labs save on their own \u2014 so it can be brought back.'
        : ' Sign in and the labs send your work to your teacher\u2019s records as you go, so it follows you to another computer.';
    } else {
      note += ' Nothing is in your teacher\u2019s records yet: sign in, and the labs save there on their own as you work.';
    }
    document.getElementById('progNote').innerHTML = note;

    function onDoor(id, t) {
      var el = doorEls[id]; if (!el) return;
      var foot = el.querySelector('.door__foot');
      if (!foot) return;
      var sp = foot.querySelector('.door__prog');
      if (!sp) { sp = document.createElement('span'); sp.className = 'door__prog'; foot.insertBefore(sp, foot.querySelector('.door__go')); }
      /* no title= tooltip (house rule: instant tooltips or none); the count is said to a screen reader */
      sp.setAttribute('role', 'img');
      sp.setAttribute('aria-label', P.pct(t) + '%: ' + t.done + ' of ' + t.total + ' questions answered correctly');
      sp.innerHTML = bar(t.done, t.total, 'var(--accent)') + '<span>' + P.pct(t) + '%</span>';
    }
    Object.keys(res.byShelf).forEach(function (id) { onDoor(id, res.byShelf[id]); });
    /* the same figure for the whole subject, on the door that leads to it */
    if (ENTRY) (ENTRY.doors || []).forEach(function (d) { if (d.hero || d.view === 'revision') onDoor(d.id, w); });
  }
  showProgress();

  /* ---------- bringing back what was saved ----------
     A student's working lives in their browser and dies with it. What the labs SAVED, while
     the student was signed in, is in the teacher's spreadsheet — so ask for it back. The token is one the
     labs already hold; it is sent in a POST body as text/plain, which is a "simple" request,
     so there is no preflight. Only the holder's own row comes back: the endpoint takes the
     email from the token, never from what we send.

     Everything here is best-effort. No token, no endpoint, no network, an old deployment, a
     teacher not collecting marks at all — every one of those just leaves the page showing
     what the browser knows, which is what it showed a moment ago anyway. */
  function serverProgress(loud) {
    var url = L.submitUrl || (L.site && L.site.submitUrl) || '';   /* each school's own — js/local.js */
    if (!url || !P || !LABS.length) { if (loud) toast('This hub is not set up to keep marks.'); return; }

    var who = SI && SI.live();
    if (!who) {
      /* signed in before, but Google's hour is up: pressing Sync renews it first, without a click
         when Google allows, and carries on */
      if (loud && SI && SI.who() && L.googleClientId) {
        SI.renew(L.googleClientId, function (v) {
          if (v) serverProgress(true);
          else toast('Your sign-in has run out. Sign in again at the top of the page, then press Sync.');
        });
        return;
      }
      /* nobody signed in, here or in a lab */
      if (loud) toast('Sign in at the top of the page, or inside a lab, and your work will follow you here.');
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
        done(n ? 'Brought back what your teacher\u2019s records hold — ' + n + ' lab' + (n === 1 ? '' : 's') +
                 '. Open a lab, signed in, and the answers themselves come back there.'
               : 'Nothing is in your teacher\u2019s records yet, so there is nothing to bring back.');
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
     own. Every assessment copy has its own address, behind the school's own Google gate, and
     each works out which student to show from whoever signed in to open it. The labs script's
     record answer hands over the newest copy's address (`myAssessments`, §front-door below;
     reflection spec §40.78); `record.url` in js/local.js is only the fallback. So there is no
     personal link to find, and nothing here that could hand one student's address to another.

     What is left for this page to do is ask, before it offers: are you on the list, and is
     there anything there yet? A student who has never reflected is told that plainly rather
     than being sent to an empty page, and a visitor from another school — this hub is
     public, and most people reading it are not at this one — is told who it is for before
     they sign in to anything.

     Configured from js/local.js, plus that record answer. No `record` block, no Client ID, or
     no place to ask: the rectangle never appears and the rest of the page is untouched. */

  /* Signing in is one sign-in for the whole site, kept by js/signin.js: a student who signed in
     inside a lab is signed in here, and signing in here signs them in to every lab. It lasts
     until they sign out — Google's hour-long token is renewed quietly when Google allows — and
     the corner says so plainly when it cannot be. */

  (function () {
    var REC  = L.record || null;
    var CID  = L.googleClientId || '';
    var URL_ = L.submitUrl || (L.site && L.site.submitUrl) || '';
    var box  = document.getElementById('acct');
    /* `REC.url` is required: a card that can never take them anywhere is worse than no
       card, so an unconfigured address means no card rather than a dead one. */
    if (!box || !REC || !REC.url || !CID || !URL_ || !SI) return;   /* not this edition's business */

    var btn     = document.getElementById('acctBtn'),
        btnLbl  = document.getElementById('acctBtnLbl'),
        btnAct  = document.getElementById('acctBtnAct'),
        link    = document.getElementById('acctLink'),
        linkLbl = document.getElementById('acctLinkLbl'),
        linkAct = document.getElementById('acctLinkAct'),
        gsi     = document.getElementById('acctGsi'),
        cap     = document.getElementById('acctFor'),
        whoCard = document.getElementById('acctWho'),
        whoLbl  = document.getElementById('acctWhoLbl'),
        whoAct  = document.getElementById('acctWhoAct'),
        foot    = document.getElementById('acctFoot'),
        modeEl  = document.getElementById('acctMode'),
        outBtn  = document.getElementById('acctOut');
    /* the stylesheet swaps link for identity on the front page — only if this page HAS the door */
    if (mineEl || sysEl) document.body.setAttribute('data-mine-door', '');

    box.hidden = false;
    document.body.setAttribute('data-acct', '');   /* the masthead keeps its second column */
    btnLbl.textContent = REC.label || 'Students';

    var acting  = null;     /* the sign-in this corner is showing as signed in; null while it offers the way in */
    var teacher = null;     /* for a teacher on the labs script's list: { page } — null for everybody else */
    var last    = null;     /* the last answer, so switching mode redraws without asking again */

    /* ---------- "Sit a test" ----------
       One banner under the credit, for whoever is SEATED for a test — the labs script works that
       out from the test system itself (_ownTest_ in apps-script/Code.gs), by the test's own rules.
       A pupil sees it while their test opens later or is open now, and never otherwise. A teacher
       sees exactly what a pupil would, in test mode only: they are seated on the test system's
       "Marks · Test" tab. In test mode a teacher also gets a quiet line when there is nothing to
       show, so an empty space never looks like a broken banner.
       The link is given only once the test is OPEN — before that its page can only say "not yet",
       so nobody is sent there early. And it opens in THIS tab: the test counts every time a student
       leaves its tab, so the hub must not be left open beside it. */
    var sitEl   = document.getElementById('sit'),
        sitNote = document.getElementById('sitNote'),
        sitEye  = document.getElementById('sitEye'),
        sitName = document.getElementById('sitName'),
        sitWhen = document.getElementById('sitWhen'),
        sitGo   = document.getElementById('sitGo');
    var sitLast = null, sitTimer = null;
    function sitHide() {
      clearTimeout(sitTimer);
      if (sitEl) { sitEl.hidden = true; sitEl.classList.remove('is-open'); }
      if (sitNote) sitNote.hidden = true;
      if (fbkEl) fbkEl.hidden = true;
      if (rflEl) rflEl.hidden = true;
      if (rflNote) rflNote.hidden = true;
    }
    /* ---------- "New feedback" (25 Sep 2026; a 5-day nudge since 26 Sep — the lasting way in is My assessments) ----------
       A second card under the test's, once the teacher has released this person's marked test in the
       test system: the test's name, when it was shared, and the way to the test system's own read-only
       feedback page. It comes in the same answer as the test banner, so it costs nothing more. A teacher
       sees it only in test mode, as a pupil would — they sit the test on "Marks · Test", and release
       their own work to try it. It opens in this tab, like the test link. */
    var fbkEl   = document.getElementById('fbk'),
        fbkEye  = document.getElementById('fbkEye'),
        fbkName = document.getElementById('fbkName'),
        fbkWhen = document.getElementById('fbkWhen'),
        fbkGo   = document.getElementById('fbkGo');
    function fbkDraw(j) {
      if (!fbkEl || !j || !acting) return;
      var f = j.feedback;
      if (!f || !f.url) return;
      if (j.teacher && mode() !== 'test') return;
      fbkEye.textContent  = (j.teacher ? 'Test mode \u00b7 ' : '') + 'New feedback';
      fbkName.textContent = f.name || 'Your test';
      fbkWhen.textContent = 'Shared ' + sitAt(f.at) + (f.more > 0 ? ' \u00b7 and ' + f.more + ' more' : '') + '. Read your marks and comments.';
      fbkGo.href = f.url;
      fbkEl.hidden = false;
    }
    /* ---------- "Your reflection" (§hub-card, reflection spec §40.80; 28 Sep 2026) ----------
       A third card under the test's, for a reflection the teacher has switched on for the hub. The labs script works
       out where this person is by the reflection form's own rules (_ownReflectCard_ in apps-script/Code.gs) and sends
       it in the same answer as the test banner, so it costs nothing more. Start; then Continue once they have started,
       or once the teacher lets them back in; a reminder with no link when they handed in only part of it or ran out
       of time (the form would only say "submitted" or "locked out"); nothing once a complete reflection is in — Daniel:
       it "should not disappear until they have made a complete submission". The link opens in THIS tab, like the
       test's: the form counts every time a student leaves its tab. A teacher sees it in test mode only, seated on the
       reflection's "Marks · Test" tab, and is told why when none shows. */
    var rflEl   = document.getElementById('rfl'),
        rflEye  = document.getElementById('rflEye'),
        rflName = document.getElementById('rflName'),
        rflWhen = document.getElementById('rflWhen'),
        rflGo   = document.getElementById('rflGo'),
        rflNote = document.getElementById('rflNote');
    var RFL_SAY = {   /* [eyebrow, the line, the button — none for a reminder] */
      start: ['Your reflection', 'Do it in class, when your teacher says. Look at your marks and plan your revision.', 'Start your reflection'],
      going: ['Your reflection', 'You have started. Carry on where you stopped.', 'Continue your reflection'],
      again: ['Your reflection', 'Your teacher has let you continue.', 'Continue your reflection'],
      part:  ['Not finished', 'You handed in only part of it. Ask your teacher to let you finish it.', ''],
      time:  ['Not finished', 'Your time ran out before you handed it in. Ask your teacher to let you finish it.', '']
    };
    function rflDraw(j) {
      if (!rflEl || !j || !acting) return;
      if (j.teacher && mode() !== 'test') return;
      var r = j.reflect, say = r && RFL_SAY[r.state];
      if (!say) {
        if (j.teacher && rflNote && j.reflectWhy && j.reflectWhy.length) {
          rflNote.textContent = 'Test mode · No reflection shows here: ' + j.reflectWhy[0] +
            (j.reflectWhy.length > 1 ? ' · and ' + (j.reflectWhy.length - 1) + ' more' : '') + '.';
          rflNote.hidden = false;
        }
        return;
      }
      rflEye.textContent  = (j.teacher ? 'Test mode · ' : '') + say[0];
      rflName.textContent = r.name || 'Your reflection';
      rflWhen.textContent = say[1];
      rflEl.classList.toggle('is-waiting', !say[2]);
      if (say[2] && r.url) { rflGo.firstChild.nodeValue = say[2] + ' '; rflGo.href = r.url; rflGo.hidden = false; }
      else { rflGo.hidden = true; rflGo.removeAttribute('href'); }
      rflEl.hidden = false;
    }
    /* "today at 09:00", "tomorrow at 09:00", "Tue 22 Sep at 09:00" — in the reader's own time */
    function sitAt(ms) {
      var d = new Date(ms), now = new Date();
      var day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
      var hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      var dd = Math.round((day(d) - day(now)) / 864e5);
      if (dd === 0) return 'today at ' + hm;
      if (dd === 1) return 'tomorrow at ' + hm;
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' at ' + hm;
    }
    /* A teacher in test mode is never left looking at an empty space: while the hub is asked they see
       that it is being checked (after a quiet spell the script can take several seconds to wake), and
       if the check fails they are told so. A pupil sees nothing either way — the banner is a shortcut,
       never the only way in. */
    function sitSay(text) { sitHide(); if (sitNote) { sitNote.textContent = text; sitNote.hidden = false; } }
    function sitTesting() { return !!(teacher && mode() === 'test'); }
    var sitAskedAt = 0;
    /* Coming back to this tab after a while (the dashboard or a spreadsheet was open in another)
       asks again, so what changed there shows here without signing out and in. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && acting && Date.now() - sitAskedAt > 20000) sitAsk(acting);
    });
    function sitAsk(who) {
      if (!sitEl || !URL_ || !who || !who.token) return;
      sitAskedAt = Date.now();
      if (sitTesting() && sitEl.hidden) sitSay('Test mode \u00b7 Checking your tests\u2026');
      var failed = function () {
        if (!acting || acting.email !== who.email) return;
        sitLast = null;
        if (sitTesting()) sitSay('Test mode \u00b7 The hub could not check your tests just now \u2014 reload the page to try again.');
        else sitHide();
      };
      fetch(URL_, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'test', token: who.token }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!acting || acting.email !== who.email) return;   /* signed out, or somebody else, meanwhile */
          if (!j || !j.ok) return failed();
          sitLast = j;
          sitDraw();
        })
        .catch(failed);
    }
    function sitDraw() {
      sitHide();
      fbkDraw(sitLast);
      rflDraw(sitLast);
      var j = sitLast;
      if (!j || !acting || !sitEl) return;
      var t = !!j.teacher;
      if (t && mode() !== 'test') return;                    /* teacher mode: the banner is not for you */
      var pre = t ? 'Test mode \u00b7 ' : '';
      if (j.state === 'open' || j.state === 'upcoming') {
        var open = j.state === 'open';
        sitName.textContent = j.name || 'Your test';
        sitEye.textContent  = pre + (open ? 'Open now' : 'Sit a test');
        sitWhen.textContent = open
          ? (j.closesAt ? 'Closes ' + sitAt(j.closesAt) + '.' : 'You can start now.')
          : 'Opens ' + sitAt(j.opensAt) + '. The link appears here when it opens.';
        sitEl.classList.toggle('is-open', open);
        if (open && j.url) { sitGo.href = j.url; sitGo.hidden = false; }
        else { sitGo.hidden = true; sitGo.removeAttribute('href'); }
        sitEl.hidden = false;
        /* ask again at the moment it opens or closes, so a page left open changes with it — the
           server's answer, not this device's clock, decides; nothing is scheduled days ahead */
        var next = open ? j.closesAt : j.opensAt, wait = next ? next - Date.now() + 1500 : 0;
        if (wait > 0 && wait < 12 * 3600e3) sitTimer = setTimeout(function () { if (acting) sitAsk(acting); }, wait);
        return;
      }
      if (t && sitNote) {
        sitNote.textContent =
          j.state === 'done'   ? 'Test mode \u00b7 You have handed in ' + (j.name || 'your test') + ', so no test shows here.' :
          j.state === 'closed' ? 'Test mode \u00b7 ' + (j.name || 'Your test') + ' has closed, so no test shows here.' :
          j.state === 'waiting' ? 'Test mode \u00b7 ' + (j.name || 'Your test') + ' has no start time yet, so no test shows here. Set one, or press \u23f0 Start now in its dashboard.' :
          (j.why && j.why.length
            ? 'Test mode \u00b7 No test shows here: ' + j.why[0] + (j.why.length > 1 ? ' \u00b7 and ' + (j.why.length - 1) + ' more' : '') + '.'
            : 'Test mode \u00b7 No test shows here. To see one, add yourself to the \u201cMarks \u00b7 Test\u201d tab of a test that opens later or is open now.');
        sitNote.hidden = false;
      }
    }

    /* Two cards, one shown at a time, because they are two different things: a button does
       something on this page, a link goes somewhere else. Swapping the text inside one
       element would have made a link that sometimes did not link. */
    function hideAll() { btn.hidden = true; link.hidden = true; gsi.hidden = true; cap.hidden = true;
                         if (whoCard) whoCard.hidden = true; }
    function asButton(lbl, act, busy) {
      hideAll(); btn.hidden = false;
      btnLbl.textContent = lbl; btnAct.textContent = act;
      btn.disabled = !!busy;
    }
    /* Signed in with somewhere to go. Two cards are filled and the stylesheet shows one: on the
       front page the door beside the hero is the way in, so the corner only says who is signed
       in; on every other page there is no door, so the corner card is the link. */
    function asLink(href, lbl, act, whoSays) {
      hideAll(); link.hidden = false;
      link.href = href; linkLbl.textContent = lbl; linkAct.textContent = act;
      if (whoCard) { whoLbl.textContent = lbl; if (whoAct) whoAct.textContent = whoSays || 'Signed in'; whoCard.hidden = false; }
    }

    /* Under the card, once somebody is signed in: a way to sign out — the sign-in now lasts, so on
       a shared computer it has to be easy to end — and, for a teacher, the switch between teacher
       mode and test mode. The switch changes only what this page shows. What a teacher may OPEN
       is decided by the labs script and by the page behind the door, never by this button. */
    var MODE_KEY = 'biology-hub.mode';
    function mode() {
      try { return localStorage.getItem(MODE_KEY) === 'test' ? 'test' : 'teacher'; } catch (e) { return 'teacher'; }
    }
    function footer(on) {
      if (!foot) return;
      foot.hidden = !on;
      if (modeEl) {
        modeEl.hidden = !(on && teacher);
        var m = mode();
        Array.prototype.forEach.call(modeEl.querySelectorAll('button[data-mode]'), function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === m));
        });
      }
    }
    if (modeEl) modeEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-mode]');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      try { localStorage.setItem(MODE_KEY, b.getAttribute('data-mode')); } catch (e2) {}
      footer(true);
      if (last && acting) render(last.who, last.j);
      /* ask again rather than redraw the last answer: a teacher switches mode to SEE the test as it
         is now — after changing a time or a row — not as it was when they signed in */
      if (acting) sitAsk(acting); else sitDraw();
    });
    if (outBtn) outBtn.addEventListener('click', function () {
      SI.out();                   /* the listener below puts the corner back */
      toast('Signed out on this computer: the hub and every lab.');
    });

    /* The name exactly as the school's roster writes it, and no cleverer than that.
       Taking the first word to make "Park's Biology" reads as a first name here and is a
       family name for most of this school — Korean rosters put the family name first, and
       a card that calls a student by the wrong half of their name every time they open the
       page is worse than one that does not try. So: no possessive, no reordering, no
       guessing which part is which. */
    function tidyName(n) {
      return String(n || '').trim().replace(/\s+/g, ' ');
    }

    /* The door beside the hero follows this same answer. A positive one is remembered against
       the email it was for, so a returning student sees their door at once instead of watching
       it arrive a second later; the check still runs and shuts the door if the answer has
       changed. Only a definite answer shuts it — a network failure leaves it as it was, because
       a door that vanishes whenever the wifi blinks teaches a student not to trust it. Whether
       they are a teacher is remembered too, only so that teacher mode does not flash a student's
       door first; the teacher page's address is never kept. */
    var MINE_KEY = 'biology-hub.mine';
    function mineRemembered(who) {
      try {
        var m = JSON.parse(localStorage.getItem(MINE_KEY) || 'null');
        return (m && who && m.email && m.email === who.email) ? m : null;
      } catch (e) { return null; }
    }
    function remember(who, t) {
      try { localStorage.setItem(MINE_KEY, JSON.stringify({ email: who.email, teacher: !!teacher,
                                                          reflected: t ? t.reflected : 0,
                                                          assessments: t ? t.assessments : null,
                                                          unfinished: t ? t.unfinished : 0,
                                                          practice: t ? !!t.practice : false,
                                                          myAssessments: t ? t.url : '',
                                                          at: Date.now() })); } catch (e) {}
    }
    /* Where My assessments lives now (§front-door, 28 Sep 2026). Every assessment gets its own reflection
       spreadsheet, and so its own web-app address; the one running the newest code writes its address into the
       tracker, and the labs script hands it over with the record answer as `myAssessments`. Only an Apps Script
       student page is ever followed; anything else, or no answer yet, keeps the address in `record.url`. */
    function newest(u) {
      u = String(u || '');
      return /^https:\/\/script\.google\.com\/(?:a\/macros\/[a-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]{20,}\/exec\?page=student$/.test(u) ? u : '';
    }
    function goMine(t) { var u = (t && t.url) || REC.url; if (mineEl) mineEl.href = u; return u; }
    /* Two numbers, never mixed up. `reflected` is digital reflections the student finished.
       `assessments` is everything with a real score — tests and lab reports the teacher marked,
       reflected on or not — so it is the bigger number: "3 of 7 reflected". Unfinished
       reflections are counted apart: an assessment done, a reflection not. An answer from a
       labs script that predates the two numbers has only `count` (= reflections), and then
       only that is said. `practice`: they have lab or Bio English practice in the records, which
       My assessments shows too (Sept 2026), so the door opens for it before any reflection. */
    function tally(j) {
      var n = function (v) { return (typeof v === 'number' && v >= 0) ? v : null; };
      var reflected = n(j.reflected) !== null ? j.reflected : (n(j.count) || 0);
      return { reflected: reflected, assessments: n(j.assessments),
               unfinished: n(j.unfinished) !== null ? j.unfinished : (n(j.incomplete) || 0),
               practice: !!j.practice, url: newest(j.myAssessments) };
    }
    /* anything on My assessments to see: a reflection, finished or not, or practice */
    function worthOpening(t) { return !!(t.reflected || t.unfinished || t.practice); }
    /* on the corner card and the door, one line: "3 of 7 reflected · 1 unfinished", or "your practice" before any reflection */
    function cardLine(t) {
      if (!t.reflected && !t.unfinished && t.practice) return 'your practice';
      var bits = [t.assessments !== null ? t.reflected + ' of ' + t.assessments + ' reflected'
                                         : t.reflected + ' reflected'];
      if (t.unfinished) bits.push(t.unfinished + ' unfinished');
      return bits.join(' · ');
    }
    function mineSay(t) {
      var el = mineEl && mineEl.querySelector('.door__detail');
      if (el) el.textContent = cardLine(t);
    }
    function mineOpen(who, t, instant) {
      mineSay(t);
      showPersonal('mine', instant);
      remember(who, t);
    }
    function mineShut(who) {
      showPersonal(null);
      if (who && teacher) remember(who, null);                 /* still a teacher, with nothing to show */
      else { try { localStorage.removeItem(MINE_KEY); } catch (e) {} }
    }

    /* What the labs script said, drawn. Called again, with the same answer, when a teacher
       switches between teacher mode and test mode. */
    function render(who, j) {
      last = { who: who, j: j };
      var lbl = tidyName(j.name) || tidyName(who.name) || (REC.label || 'Your Biology');
      var page = String(j.teacherPage || '');
      teacher = j.teacher ? { page: /^https:\/\/script\.google\.com\//.test(page) ? page : '' } : null;
      footer(true);

      if (teacher && mode() === 'teacher') {
        remember(who, null);
        if (!teacher.page) {
          showPersonal(null);
          asButton(lbl, 'Teacher mode · the teacher page is not set up yet', true);
          return;
        }
        if (sysEl) { sysEl.href = teacher.page; showPersonal('system'); } else showPersonal(null);
        asLink(teacher.page, lbl, 'Assessment system', 'Signed in · teacher mode');
        return;
      }

      var t = tally(j);
      if (!worthOpening(t)) {
        /* On the list, nothing recorded yet — a new student, or one who has not sat a test or
           practised in a lab. Not an error, and not worth a link to an empty page. */
        mineShut(who);
        asButton(lbl, teacher ? 'Test mode · no test reflections yet' : 'Your assessments start at your first reflection', true);
        return;
      }
      mineOpen(who, t);
      /* A teacher who has only ever submitted to the TEST class sees "test". */
      asLink(goMine(t), lbl, (j.testOnly ? 'My test assessments' : 'My assessments') + ' · ' + cardLine(t),
             teacher ? 'Signed in · test mode' : '');
      /* No `title` tooltip here: the house rule is instant tooltips or none, and the
         counts are already on the card and on the door. */
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
          if (!acting || acting.email !== who.email) return;   /* signed out, or somebody else, meanwhile */
          /* a failed check leaves a remembered answer standing, on the card as on the door */
          if (!j) return quiet ? null : offerRetry('Could not check just now — try again');

          if (!j.ok) {
            /* Signed in, but with the wrong account. Say which to use: "not on the list" sends a
               student hunting for a teacher when the whole of the problem is that they are signed
               in to their own Gmail. Pupils and staff both have school addresses — …nlcsjeju.kr —
               so the domain is named from its end. */
            if (j.why === 'not a school account') {
              stopActing(); mineShut();
              return asSignIn('Use your …' + (j.domain || REC.domain || 'school') + ' account');
            }
            if (j.why === 'not signed in') { stopActing(); mineShut(); return asSignIn(); }
            return offerRetry('Not available just now — try again');   /* not set up, or unreachable */
          }
          render(who, j);
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
       that rather than offering a button that does nothing. */
    var gsiReady = false, gsiWaiting = false;
    function mountGsi() {
      if (gsiReady) return true;
      /* `locale` pins the button to the site's English: Google otherwise follows the browser,
         and on a Korean computer it read "Google 계정으로 로그인" beside an English page */
      gsiReady = SI.button(gsi, CID, { type:'standard', theme:'filled_black', size:'large',
                                       text:'signin_with', shape:'pill', logo_alignment:'left', width: 240,
                                       locale:'en-GB' });
      return gsiReady;
    }
    function asSignIn(why) {
      footer(false);
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
      SI.loaded(function (ok) {
        gsiWaiting = false;
        if (ok && mountGsi()) { if (!SI.live()) asSignIn(why); return; }
        offerRetry('Sign-in could not load here — try again');
      });
    }

    /* The apps shelf is for staff, so the way in only appears once somebody signs in on a staff
       address. Pupils are @pupils.<domain>, which does not end in @<domain> and so never matches.
       This hides a link, it does not guard anything: applications.html is a public page and the
       apps themselves are public repositories. It is here so a fourteen-year-old is not offered a
       seating-plan app. The domain comes from the edition's own record, never hard-coded, because
       this file is shared with the open edition, where the school is somebody else's. */
    var toolsLink = document.querySelector('.tools');
    function tools(v) {
      if (!toolsLink) return;
      var d = String((REC && REC.domain) || '').toLowerCase();
      var e = String((v && v.email) || '').toLowerCase();
      toolsLink.hidden = !(d && e && e.slice(-(d.length + 1)) === '@' + d);
    }

    /* Somebody is signed in: show them, at once from what is remembered, then ask. */
    function start(v, instant) {
      /* somebody else than who was shown: nothing of theirs may stand while this one is checked */
      if (!acting || acting.email !== v.email) { teacher = null; last = null; }
      acting = v;
      tools(v);
      watchExpiry(v);
      var known = mineRemembered(v);
      if (known && known.teacher && !teacher) teacher = { page: '' };   /* only so the switch shows at once */
      footer(true);
      var kt = known ? tally(known) : null;
      var studentView = !(known && known.teacher && mode() === 'teacher');
      if (kt && studentView && worthOpening(kt)) {                   /* at once, then confirmed below */
        mineSay(kt);
        showPersonal('mine', instant);
        asLink(goMine(kt), tidyName(v.name) || (REC.label || 'Your Biology'), 'My assessments · ' + cardLine(kt),
               known.teacher ? 'Signed in · test mode' : '');
        ask(v, true);
      } else {
        showPersonal(null);
        ask(v, false);
      }
      sitAsk(v);
    }

    /* One place hears every change: a sign-in on this page, one renewed in the background, and
       one made or ended in another tab of the site — a lab's "not you?" included. */
    SI.on(function (v) {
      if (!v) {
        stopActing(); teacher = null;
        mineShut();
        asSignIn();
        return;
      }
      if (!SI.fresh(v)) return;                        /* an hour-old token from another tab: nothing to show */
      if (acting && acting.email === v.email) { acting = v; watchExpiry(v); return; }   /* renewed */
      start(v, false);
      serverProgress(false);                           /* their saved labs too, now we know who they are */
    });

    /* Google's token lasts an hour. Five minutes before it runs out the page asks Google for a new
       one, quietly; only if that does not work is the student told, at the last minute, with
       Google's button back and their door shut — exactly what reloading would show — rather than
       a name left in the corner of somebody who is no longer signed in. A tab in the background
       waits until it is looked at again: Google will not show anything in a tab nobody can see. */
    var SOON = 5 * 60000, expiryTimer = null, outTimer = null;
    function watchExpiry(v) {
      clearTimeout(expiryTimer); clearTimeout(outTimer);
      if (!v || !v.exp) return;
      var ms = v.exp * 1000 - Date.now() - SOON;
      expiryTimer = setTimeout(renewSoon, Math.max(0, Math.min(ms, 2147483000)));
    }
    function renewSoon() {
      if (!acting || document.hidden) return;
      /* asked for a token good for six minutes, so a timer that fires a moment early still renews */
      SI.renew(CID, function (v) {
        if (v || !acting) return;                        /* a new token arrives through SI.on */
        var cur = SI.who();
        var left = cur ? cur.exp * 1000 - Date.now() - 60000 : 0;
        if (left <= 0) { ranOut(); return; }
        clearTimeout(outTimer);
        outTimer = setTimeout(function () { if (!SI.live()) ranOut(); }, Math.min(left, 2147483000));
      }, SOON + 60000);
    }
    function stopActing() {
      acting = null; last = null;
      sitLast = null; sitHide();
      tools(null);
      clearTimeout(expiryTimer); clearTimeout(outTimer);
    }
    function ranOut() {
      if (!acting) return;
      stopActing();
      showPersonal(null);
      asSignIn('Your sign-in ran out after an hour — sign in again');
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden || !acting) return;
      var v = SI.who();
      if (v && v.exp * 1000 - Date.now() <= SOON) renewSoon();
    });

    /* Google would not renew it: offer its button — or, when Google's script never arrived (a
       school filter), say so at once rather than waiting for it a second time. */
    function notRenewed(v, why) {
      if (v || acting) return;                         /* a new token arrives through SI.on */
      if (why === 'unavailable') offerRetry('Sign-in could not load here — try again');
      else asSignIn();
    }

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      var v = SI.live();
      if (v) { if (acting) ask(v); else start(v, false); return; }
      if (SI.who()) {
        asButton(REC.label || 'Students', 'Signing you in…', true);
        SI.renew(CID, notRenewed);
        return;
      }
      asSignIn();
    });

    var have = SI.live(), was = SI.who();
    if (have) {
      start(have, true);                                  /* already signed in, here or in a lab */
    } else if (was) {
      /* Signed in before and never signed out, but Google's hour is up. Ask Google for a new token
         for the same account — without a click when it can — before offering the button. A door
         remembered from last time stays shut until the answer is in. */
      showPersonal(null);
      asButton(tidyName(was.name) || REC.label || 'Students', 'Signing you in…', true);
      SI.renew(CID, notRenewed);
    } else {
      /* signed out: a remembered door must not stand open, and the way to sign in is offered at once */
      showPersonal(null);
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
