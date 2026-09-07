<div align="center">

<h1>🧬 &nbsp;Biology Hub</h1>

**Free interactive revision for Cambridge IGCSE Biology 0610 — for any school, anywhere.**

Four doors, one for each part of the subject. Behind each door is a map students can point at;
behind the map are the labs, where they practise and the questions mark themselves.

[![Open the site](https://img.shields.io/badge/▶_Open_the_site-0969DA?style=for-the-badge&logoColor=white)](https://mompel226.github.io/igcse-biology-hub/)

![IGCSE Biology 0610](https://img.shields.io/badge/IGCSE_Biology-0610-3D7A54)
![IB as a layer](https://img.shields.io/badge/IB-a_layer,_not_a_silo-7c4dc0)
![No sign-up](https://img.shields.io/badge/students-no_sign--up_needed-6FA287)

by **Dr Daniel Mompel Riera**

</div>

---

## For your students — there is nothing to set up

Send them the link and you are done: **<https://mompel226.github.io/igcse-biology-hub/>**

No account, no sign-up, no install, nothing to pay. It works on a phone, a Chromebook or a
school PC, and progress is saved in the student's own browser. Anyone in the world is welcome
to use it.

| Door | Topics (0610) | Behind it |
|---|---|---|
| **Foundations** | 2 · 3 · 4 · 5 | being built |
| **The human body** | 7 · 9–16 | [Human Body Hub](https://mompel226.github.io/human-body-hub/) 🟢 · [Digestion Lab](https://mompel226.github.io/digestion-lab/) 🟢 |
| **Plants** | 6 · 8 · 16.3 | planned |
| **Life on Earth** | 1 · 17–21 | [Life on Earth Hub](https://mompel226.github.io/life-on-earth-hub/) 🟢 · [Classification Lab](https://mompel226.github.io/classification-lab/) 🟢 |

Also reachable from the front page: the
[Protein & Enzyme Sim](https://mompel226.github.io/protein-enzyme-sim/) (topics 4 and 5, and
IB B1.2) and, behind the **IB extension** toggle, an
[IB B1.1 practical](https://mompel226.github.io/B11-starch-calibration-curve-pract/).

The three tabs in the masthead — Year 9, Year 10, Year 11 — show which topics each year meets,
in the order they are usually taught. `…/#y10` opens the page on a year; `…/#plants` opens a
door. Both are useful links to hand a class.

## Two editions, one codebase

This is the **open edition**, meant to be shared. There is also an
[NLCS Jeju edition](https://github.com/Mompel226/biology-hub) carrying that school's own
co-curricular doors. The two repositories share every file except one — `js/local.js` — so a
fix made once reaches both.

## Using it at your own school

You are welcome to. Two ways:

**Just send the link.** Nothing to install, and you always have the latest version.

**Or make it yours.** Fork this repository, switch on GitHub Pages (Settings ▸ Pages ▸ branch
`main`), and edit **one file**: [`js/local.js`](js/local.js). It is commented with a worked
example. There you can rename the site to your school, add your own byline, and add doors for
your own clubs or resources. Everything else stays in step with this repository, so you can
pull updates without losing your changes.

If you add a door you will need a picture for it at `assets/doors/<id>-900|1400|1800.jpg` and
`.webp`. Keep it public domain, CC0 or CC BY, and credit it in `assets/doors/CREDITS.md`.

## How it is built

Static files. No build step, no framework, no dependencies — GitHub Pages serves it as it is.

- **`js/shelves.js`** — the shared register: the doors, the year groups, what is open, the
  image credits. The only file to edit when something changes for everyone.
- **`js/local.js`** — the school layer. Empty here.
- `js/hub.js` stands the doors up: the accordion, the light that follows the cursor, the idle
  tour, the arrow keys, the IB toggle, progress read back from the labs.
- `css/hub.css` is the whole style — Fraunces, IBM Plex Mono, Inter, on ink and paper.

Deploy with `node tools/stamp.mjs`, which rewrites every `?v=` stamp in `index.html` **and**
`version.txt` from one value. Never hand-edit `version.txt`: the `?v=` stamps are the real
cache key, and bumping only the file ships new JavaScript behind an old URL.

## The pictures

Every door image is public domain, CC0 or a Creative Commons licence that permits this use,
and each is credited on the page itself and in
[`assets/doors/CREDITS.md`](assets/doors/CREDITS.md) — HeLa cells from NIGMS, Bourgery and
Jacob's 1830s anatomy, a marram-grass leaf from Berkshire Community College, and NOAA's white
smokers at NW Eifuku.

## Licence and credit

Made by **Dr Daniel Mompel Riera**. Free to use and adapt for teaching; please keep the
credit. The labs behind the doors are separate repositories under the same account.
