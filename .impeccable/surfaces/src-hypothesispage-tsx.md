---
version: 1
slug: "src-hypothesispage-tsx"
primary_target: "src/HypothesisPage.tsx"
related_targets:
  [
    "src/App.tsx",
    "src/Project.tsx",
    "src/Hypotheses.tsx",
    "src/HypothesisCard.tsx",
    "src/Customers.tsx",
    "src/Market.tsx",
    "src/Report.tsx",
    "src/Activity.tsx",
    "src/Fleet.tsx",
    "src/Settings.tsx",
    "src/Draft.tsx",
    "src/Home.tsx",
    "src/SignIn.tsx",
    "src/ui.tsx",
    "src/index.css",
  ]
---

# Surface brief: FounderHub app (all screens)

Scope: the whole signed-in and signed-out web app, desktop only. Mode: Operate. Lead screen, which sets the bar: the hypothesis page. Redesign that replaces the zinc + orange + Geist + rounded-card look.

Audience and job: a student founder checks between building sessions which hypotheses hold and why, then asks scouts for more or edits a hypothesis. Proof is the quotes and their sources. Ruled out: generic SaaS, hacker terminal, playful, academic.

## Direction contract

THESIS: Every hypothesis is a transit line. Each quote is a stop on that line, and the score is where the line ends up. Refuses the zinc admin dashboard of rounded cards and a single accent.

OWN-WORLD: A station-sign navy shell band (#14233c) over a concrete-grey work ground. Line colours do real jobs: green means supports, red means disproves, and yellow, red, green and blue mark the four agent teams. One signage face, Overpass, for everything, numerals included (tabular figures, because Overpass Mono spaces decimals into "1 . 5"). Overpass Mono is kept for code: tool names, URLs, prompts. Hypothesis types are round route bullets with a letter. 1px hairlines instead of boxes. Square-ish 4px controls. Everything sits on an 8px module.

STORY: The founder sees the claim, how far the evidence has moved it, and the exact words behind each move. Then they act: ask scouts for more, or edit.

FIRST VIEWPORT: The navy band with the wordmark and standard tabs, the current tab marked by a yellow top bar inside the band, and a four-colour line rule beneath it. Left: a route bullet inline with the 40px hypothesis statement, the "Disproved if" line, and the primary "Ask scouts for more" button. Right: the score in large tabular numerals with its change. Full width: a route strip where the score line bends at 45° at each stop. Below it, the Supports and Disproves columns, each headed by a thick stance-coloured rule.

FORM: Bay Area transit system map and station wayfinding, #4 of 7 on my ordered list. seed:da147dc13599ecf5. Raises: contested lines fork (Exposure Record); one type family plus hairlines (Design Annual); the hypothesis board packs whole cells edge to edge (Circle Catalog); one 8px module (Grid Specimen); segment length equals quote weight (Dance Score). Signature interaction: when a new quote lands, the line draws on to its new stop and the score numerals tick to the new value.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- No visual-regression goldens exist. Screens are verified against the seeded sample project.
