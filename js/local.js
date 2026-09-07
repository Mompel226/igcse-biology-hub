/* ============================================================
   Biology Hub — the local layer (open edition)
   ------------------------------------------------------------
   THIS IS THE ONE FILE THAT MAKES AN EDITION.

   Everything else in this repository is shared: the same page,
   the same stylesheet, the same engine, and the same register
   of shelves in js/shelves.js. This file is where a school adds
   what belongs to it alone — and in the open edition it is
   deliberately empty, so the site is four shelves and nothing
   school-specific.

   USING THIS AT YOUR OWN SCHOOL? This is the file to edit, and
   the only one you need to touch. Fill it in like this:

     window.HUB_LOCAL = {
       site: {
         title:'Biology Hub — Your School',
         description:'…',
         eyebrow:'Cambridge IGCSE Biology 0610 · Your School',
         maker:'Made by <strong>Your Name</strong> · Biology, Your School',
         byline:'Made by <strong>Your Name</strong> · <a href="mailto:you@school">you@school</a>'
       },
       doors: [ { id:'your-club', kind:'cca', eyebrow:'CCA · Beyond the syllabus',
                  title:'<em>Your club</em> — what it is',
                  blurb:'…', topics:[ {t:'…'} ],
                  status:'live', url:'https://…', detail:'…',
                  accent:'#2A8C7A', tone:'light', focus:'50% 50%',
                  alt:'what the picture shows' } ],
       open: [], credits: []
     };

   A door needs an image at assets/doors/<id>-900|1400|1800.jpg
   and .webp. Everything else is optional. Keep the credit for
   any picture you add, in `credits` and in assets/doors/CREDITS.md.
   ============================================================ */
window.HUB_LOCAL = { site:null, doors:[], open:[], credits:[] };
