/* ============================================================
   Biology Hub — the register
   ------------------------------------------------------------
   THIS IS THE ONLY FILE YOU EDIT WHEN SOMETHING CHANGES.

   It is SHARED BY BOTH EDITIONS — the NLCS one (repo biology-hub) and the
   open one every other school can use (repo igcse-biology-hub). Anything
   that belongs to one school alone goes in js/local.js instead, which is
   the only file the two editions do not share. After editing this file,
   run `node tools/sync-edition.mjs` to carry it across.
   A shelf goes live: give it a url and set status to "live".
   The term moves on: rewrite the path. A lab opens: add it to open.

   doors    the doors, in the order they stand
     id       unique key — also the image name in assets/doors/
     kind     "shelf" | "cca"
     eyebrow  the small line above the title
     title    what the door says; <em> marks the word that takes the accent
     blurb    one or two sentences, revealed when the door opens
     topics   0610 topic chips, { no, t }
     status   "live" | "build" | "planned" | "local"
     url      where the door leads, or null
     detail   a short fact shown beside the status
     note     what the toast says when a closed door is pressed
     accent   the colour that lights the door
     tone     "dark" (default) | "light" — veil and type colour
     focus    object-position for the image, e.g. "50% 40%"
     alt      what the image shows, for readers who cannot see it
   years    which topics each year group meets — the split the student dashboard uses
   open     everything that is live, for students who know where they are going
   credits  where each door's image came from — printed in the colophon
   ============================================================ */
window.HUB = {

  doors: [
    { id:'foundations', kind:'shelf', eyebrow:'01 · Foundations',
      title:'The science <em>everything</em> leans on',
      blurb:'Here you do not move across a body — you move down into one. Start with a whole organism and step inside: an organ, then a tissue, then a cell, then an organelle, and finally the molecules that do the work. Topics 2 to 5 sit at each step on the way down.',
      topics:[ {no:2,t:'Organisation of the organism'}, {no:3,t:'Movement in and out of cells'},
               {no:4,t:'Biological molecules'}, {no:5,t:'Enzymes'} ],
      status:'build', url:null,
      note:'Foundations is being built. Until it opens, the Protein & Enzyme Sim below covers topics 4 and 5.',
      accent:'#E879F9', tone:'dark', focus:'50% 50%',
      alt:'HeLa cells under a multiphoton microscope: microtubules in magenta, DNA in cyan' },

    { id:'human-body', kind:'shelf', eyebrow:'02 · The human body',
      title:'Nine topics, <em>one body</em>',
      blurb:'Here you move through a body, reconstructed from a real MRI scan. Point at a system and its organs light up where they really sit; open the one you are studying and work through it with questions that mark themselves.',
      topics:[ {no:7,t:'Human nutrition'}, {no:9,t:'Transport in animals'}, {no:10,t:'Diseases and immunity'},
               {no:11,t:'Gas exchange'}, {no:12,t:'Respiration'}, {no:13,t:'Excretion'},
               {no:14,t:'Coordination and response'}, {no:15,t:'Drugs'}, {no:16,t:'Reproduction'} ],
      status:'live', url:'https://mompel226.github.io/human-body-hub/', detail:'1 lab open · 8 being built',
      accent:'#FF5C5C', tone:'dark', focus:'50% 40%',
      alt:'The heart and lungs with their vessels, from Bourgery and Jacob\'s anatomy of the 1830s, shown in red' },

    { id:'plants', kind:'shelf', eyebrow:'03 · Plants',
      title:'Root, stem, <em>leaf</em>, flower',
      blurb:'Here you move through a plant the way you move through the body: root, stem, leaf, flower. How a plant makes its own food, moves water up from the ground, and grows the next generation. The leaf behind this door is rolled up to keep its water in.',
      topics:[ {no:6,t:'Plant nutrition'}, {no:8,t:'Transport in plants'}, {no:'14.5',t:'Tropic responses'},
               {no:'16.3',t:'Plant reproduction'}, {no:'18.2',t:'Adaptive features'} ],
      status:'live', url:'https://mompel226.github.io/plants-hub/', detail:'The plant is open · 1 lab open',
      accent:'#1C7442', tone:'light', focus:'50% 50%',
      alt:'Cross-section of a rolled marram-grass leaf at 100 times magnification' },

    { id:'life-on-earth', kind:'shelf', eyebrow:'04 · Life on Earth',
      title:'From the first cell to <em>every kingdom</em>',
      blurb:'Here you find out where you come from. Climb the tree of life from the first cells — perhaps at a vent like this one — to every kingdom alive today; see how one molecule, DNA, links all of it; then what we can do with that knowledge, from breeding crops to editing genes.',
      topics:[ {no:1,t:'Characteristics and classification'}, {no:17,t:'Inheritance'}, {no:18,t:'Variation and selection'},
               {no:19,t:'Organisms and their environment'}, {no:20,t:'Human influences on ecosystems'}, {no:21,t:'Biotechnology'} ],
      status:'live', url:'https://mompel226.github.io/life-on-earth-hub/', detail:'The tree is open · 1 lab open',
      accent:'#5EEAD4', tone:'dark', focus:'50% 58%',
      alt:'White smokers venting liquid carbon dioxide at NW Eifuku volcano, 1,600 metres down' }
  ],

  /* which topics each year group meets — the same split as the student dashboard */
  years: [
    { id:'y9',  label:'Year 9',  sub:'Topics 1–5', steps:[
      { no:'1',  t:'Classification',        shelf:'life-on-earth' },
      { no:'2',  t:'Cells',                 shelf:'foundations' },
      { no:'3',  t:'In and out of cells',   shelf:'foundations' },
      { no:'4',  t:'Biological molecules',  shelf:'foundations' },
      { no:'5',  t:'Enzymes',               shelf:'foundations' } ] },
    { id:'y10', label:'Year 10', sub:'Topics 7–16', steps:[
      { no:'7',  t:'Human nutrition',       shelf:'human-body' },
      { no:'9',  t:'Transport in animals',  shelf:'human-body' },
      { no:'10', t:'Diseases and immunity', shelf:'human-body' },
      { no:'11', t:'Gas exchange',          shelf:'human-body' },
      { no:'12', t:'Respiration',           shelf:'human-body' },
      { no:'13', t:'Excretion',             shelf:'human-body' },
      { no:'14', t:'Coordination and response', shelf:'human-body' },
      { no:'15', t:'Drugs',                 shelf:'human-body' },
      { no:'16', t:'Reproduction',          shelf:'human-body' } ] },
    { id:'y11', label:'Year 11', sub:'Plants, and topics 17–21', steps:[
      { no:'6',    t:'Plant nutrition',       shelf:'plants' },
      { no:'8',    t:'Transport in plants',   shelf:'plants' },
      { no:'14.5', t:'Tropic responses',      shelf:'plants' },
      { no:'16.3', t:'Plant reproduction',    shelf:'plants' },
      { no:'18.2', t:'Adaptive features',     shelf:'plants' },
      { no:'17',   t:'Inheritance',           shelf:'life-on-earth' },
      { no:'18',   t:'Variation and selection', shelf:'life-on-earth' },
      { no:'19',   t:'Organisms and their environment', shelf:'life-on-earth' },
      { no:'20',   t:'Human influences on ecosystems', shelf:'life-on-earth' },
      { no:'21',   t:'Biotechnology',         shelf:'life-on-earth' } ] }
  ],

  /* everything that is live — for students who know where they are going */
  open: [
    { title:'Human Body Hub',       kind:'hub',       shelf:'human-body',
      sub:'Nine topics on a body from MRI — the map above',
      url:'https://mompel226.github.io/human-body-hub/' },
    { title:'Life on Earth Hub',    kind:'hub',       shelf:'life-on-earth',
      sub:'Topics 1 and 17–21 on a tree of life, from the first cells — the map above',
      url:'https://mompel226.github.io/life-on-earth-hub/' },
    { title:'Plants Hub',           kind:'hub',       shelf:'plants',
      sub:'Topics 6, 8, 14.5, 16.3 and 18.2 on one plant, seed to fruit — the map above',
      url:'https://mompel226.github.io/plants-hub/' },
    { title:'Classification Lab',   kind:'lab',       shelf:'life-on-earth',
      sub:'Topic 1 · Characteristics and classification · 10 stations, 64 questions',
      url:'https://mompel226.github.io/classification-lab/' },
    { title:'Digestion Lab',        kind:'lab',       shelf:'human-body',
      sub:'Topic 7 · Human nutrition · 14 stations, 123 activities',
      url:'https://mompel226.github.io/digestion-lab/', progress:'digestion' },
    { title:'Plants Lab',           kind:'lab',       shelf:'plants',
      sub:'Topics 6, 8, 14.5, 16.3 and 18.2 · Plant nutrition to adaptive features · 12 stations, 91 questions',
      url:'https://mompel226.github.io/plants-lab/' },
    { title:'Protein & Enzyme Sim', kind:'sim',       shelf:'foundations',
      sub:'Topics 4 and 5 · build a protein, then watch heat and pH take it apart',
      url:'https://mompel226.github.io/protein-enzyme-sim/', ib:'also IB B1.2' },
    { title:'Starch calibration curve', kind:'practical', shelf:'foundations',
      sub:'IB B1.1 · worksheet, workbook and a guide to R',
      url:'https://mompel226.github.io/B11-starch-calibration-curve-pract/', ibOnly:true }
  ],

  credits: [
    { door:'Foundations',   text:'HeLa cells, NIGMS / NCMIR',                              licence:'CC BY-NC-SA 3.0',
      url:'https://nigms.nih.gov/image-gallery/3520' },
    { door:'Human body',    text:'heart and lungs, Bourgery & Jacob, 1830s',                      licence:'public domain, shown as a duotone',
      url:'https://commons.wikimedia.org/wiki/File:Bourgery_%26_Jacob.jpg' },
    { door:'Plants',        text:'marram-grass leaf, Berkshire Community College',        licence:'CC0',
      url:'https://commons.wikimedia.org/wiki/File:Ammophila_arenaria_leaf_cross_section.jpg' },
    { door:'Life on Earth', text:'Champagne vent, NW Eifuku — Submarine Ring of Fire 2014, NOAA/PMEL, NSF', licence:'public domain',
      url:'https://archive.oceanexplorer.noaa.gov/explorations/14fire/background/missionplan/media/eifuku_champagne_vent.html' }
  ]
};
