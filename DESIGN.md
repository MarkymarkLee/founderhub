---
name: FounderHub
description: Startup hypotheses drawn as transit lines, on a station-sign shell over a concrete work ground.
colors:
  ground: "#e9e7e2"
  panel: "#f6f5f2"
  sunk: "#dddad3"
  ink: "#14171c"
  ink-2: "#353a45"
  mute: "#555a66"
  rule: "#c9c6be"
  rule-strong: "#8b8880"
  sign: "#14233c"
  sign-2: "#24395c"
  sign-ink: "#ffffff"
  sign-mute: "#b9c3d6"
  sup: "#217a45"
  dis: "#bf3528"
  line-yellow: "#f2b632"
  line-red: "#d8402f"
  line-green: "#2f9e57"
  line-blue: "#2b6fd6"
  action: "#14233c"
  action-ink: "#ffffff"
  action-hover: "#24395c"
  accent: "#1f5fbf"
  accent-strong: "#184c99"
typography:
  display:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.05em"
  score:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.05em"
    fontFeature: '"tnum"'
  headline:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  quote:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.33
  numeral:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: '"tnum"'
  map-label:
    fontFamily: "Overpass Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
  code:
    fontFamily: "Overpass Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  none: "0px"
  control: "4px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "24": "96px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.section}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-quiet:
    textColor: "{colors.mute}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-quiet-hover:
    textColor: "{colors.ink}"
  pill:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "24px"
  filter-chip:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  filter-chip-pressed:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  card-ruled:
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  card-boxed:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.none}"
    padding: "24px"
  route-bullet:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.full}"
    size: "24px"
  route-bullet-lg:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.full}"
    size: "40px"
  sign-band:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.sign-ink}"
    height: "64px"
  sign-tab:
    textColor: "{colors.sign-mute}"
    typography: "{typography.section}"
    padding: "0 16px"
  sign-tab-active:
    textColor: "{colors.sign-ink}"
---

# Design System: FounderHub

## Overview

**Creative North Star: "The Line Map"**

FounderHub reads like a transit system's wayfinding. A navy station-sign band carries the wordmark and tabs; under it runs a four-colour line rule, one segment per agent team; below that is a concrete-grey work ground where evidence is laid out on hairlines rather than in boxes. Every hypothesis is a line: quotes are its stops, and the score is where the line ends up.

Colour is never decoration. Green means a quote supports, red means it disproves, and yellow, red, green and blue mark the Research, Strategy, Growth and Operations teams. One signage face, Overpass, carries everything including numerals, which are set with tabular figures. Controls are square-ish, panels are not rounded at all, and nothing casts a shadow. The surface is dense and calm, built for a founder glancing in between building sessions.

The system rejects the zinc admin dashboard of rounded cards and a single orange accent that it replaced.

**Key Characteristics:**

- Navy sign band over a four-colour line rule, on a concrete-grey ground.
- Sections are separated by rules (2px ink on top, 1px hairlines between), not boxes.
- Line colours carry meaning: stance (supports / disproves) and team.
- One type family, Overpass; tabular numerals; Overpass Mono only for code.
- Round route bullets and station rings; everything else is square or 4px.
- Flat. No shadows anywhere; depth comes from the band, rules and tone.

## Colors

A neutral concrete-and-navy wayfinding palette in which the only saturated colours are transit line colours, and each one has a job.

### Primary

- **Station-Sign Navy** (sign): the shell band behind the wordmark and tabs on every screen, and the favicon field. Its lighter step, **Sign Navy Lift** (sign-2), is its hover and the dark-mode band lift.
- **Action Navy** (action): primary buttons, route bullets, pressed filter chips, the founder's own chat bubbles and the budget meter fill. It equals Station-Sign Navy in light mode and inverts to the light ground colour in dark mode, so primary actions always read as the strongest mark on the page. Hover is **Action Navy Lift** (action-hover); text on it is action-ink.

### Secondary

- **Supports Green** (sup): a quote that supports, a score at or above 50, the Supports column rule, success notes.
- **Disproves Red** (dis): a quote that disproves, a score below 50, the Disproves column rule, refused agent actions, and every error message.

### Tertiary

- **Research Yellow** (line-yellow): the Research team line, the current-tab marker in the sign band, the "fresh" bar on a newly updated hypothesis cell, the paused-agents banner rules, the contested fork on the route strip, text selection, and the signed-out Sign in button.
- **Strategy Red** (line-red), **Growth Green** (line-green), **Operations Blue** (line-blue): the other three team lines, in the line rule, the fleet panel and the sign-in system map.
- **Signal Blue** (accent): focus outlines, text caret and the report callout tint. **Signal Blue Deep** (accent-strong) is text: the "New" marker on fresh quotes and the accent pill.

### Neutral

- **Concrete Ground** (ground): the page background.
- **Paper Panel** (panel): raised surfaces: hypothesis board cells, inputs, boxed panels, station-ring fills.
- **Sunk Concrete** (sunk): meter tracks, skeletons, code blocks.
- **Ink** (ink): primary text, the 2px section rule, the 50% tick, station-ring strokes. **Ink Two** (ink-2) is secondary text and quote bodies; **Mute** (mute) is metadata, hints and placeholders.
- **Hairline** (rule) and **Strong Hairline** (rule-strong): 1px dividers and borders; the strong step outlines secondary buttons, inputs and chips.
- **Sign Text** (sign-ink) and **Sign Mute** (sign-mute): active and inactive text on the sign band.

Dark mode (prefers-color-scheme) swaps every neutral for a night-navy set and brightens sup, dis and three team lines; Research Yellow and sign-ink do not change.

### Named Rules

**The Lines Do Jobs Rule.** A saturated colour always means something: stance (sup / dis) or team (the four line colours). Never use one as decoration, and never use a team colour to mean stance.

**The Two Reds Rule.** Disproves Red (dis) and Strategy Red (line-red) are separate tokens. Evidence and errors take dis; the Strategy team takes line-red. Do not swap them.

**The Error Is Disproof Rule.** Errors are plain text in Disproves Red with role="alert". No error boxes, no icons, no toasts.

## Typography

**Display Font:** Overpass Variable (with ui-sans-serif, system-ui)
**Body Font:** Overpass Variable
**Label/Mono Font:** Overpass Mono Variable, for code only

**Character:** Highway and transit signage type: open, legible, slightly condensed. Weight does the work of hierarchy: extrabold for headings, bold for labels, regular for reading.

### Hierarchy

- **Display** (800, 2.25rem rising to 3.75rem, 1.05, tracking -0.05em): the signed-out landing headline only.
- **Score** (700, 4.5rem, 1, tracking -0.05em, tabular): the large score on the hypothesis page, coloured sup or dis.
- **Headline** (800, 1.875rem rising to 40px, 1.25, tracking -0.025em): the hypothesis statement beside its large route bullet, max 30ch.
- **Title** (800, 1.5rem to 1.875rem, tracking -0.025em): page titles on every tab.
- **Section** (700 or 800, 1rem): section headings inside a page. Also the weight and size of buttons and tabs.
- **Body** (400, 0.875rem): the working size of the app. Long prose holds to 60 to 70ch.
- **Quote** (400, 0.875rem, 1.625): quotes, in ink-2, so the words are easy to read.
- **Label** (700, 0.75rem): pills, stance labels over quotes, table heads, hints.
- **Map label** (700, 11px, uppercase): station names on the route strip and the letter inside a small route bullet.
- **Code** (Overpass Mono, 0.75rem): tool names, URLs and prompt or page source blocks.

### Named Rules

**The One Signage Face Rule.** Overpass sets every word and number. There is no second display or body face.

**The Tabular Numerals Rule.** Scores, money, counts and times use font-num, which is tabular Overpass. Never set numbers in Overpass Mono; it spaces decimals into "1 . 5". Mono is for code only.

**The Station Caps Rule.** Uppercase is reserved for station labels drawn on a line map. Headings and labels elsewhere stay in sentence case.

## Layout

Desktop-first. Content sits in a centred column 72rem (1152px) wide, with 16px gutters widening to 32px. The sign band is 64px tall and sticky, with the 4px line rule fixed beneath it. Main content stacks in a grid with 32px gaps. The hypothesis page header splits into the statement column and a 16rem score column separated by a 1px rule; supports and disproves sit in two equal columns 48px apart. The hypothesis board packs cells edge to edge in two columns, divided by 1px hairlines.

Spacing follows an 8px module: 8, 16, 24, 32, 48 and 96px, with 4px for tight label pairs.

### Named Rules

**The 8px Module Rule.** Space in steps of 8px. Use 4px only to pair a label with its value.

## Elevation & Depth

Flat. The build has no box-shadows. Depth comes from three things: the navy sign band sitting above the ground, panels stepping lighter (panel) or darker (sunk) than the ground, and rules (2px ink on top of a section, 1px hairlines between items). Motion supplies the remaining sense of life: new items rise 8px into place over 0.4s, the newest segment of a route draws itself in over 1.1s, and score bars and numerals ease to new values over 0.9s, all with cubic-bezier(0.16, 1, 0.3, 1) and all switched off for reduced motion.

### Named Rules

**The No-Shadow Rule.** Nothing casts a shadow. To separate something, use a rule, a hairline or a step in tone.

## Shapes

Square by default. Panels, cells, sections and banners have no radius. Interactive controls (buttons, inputs, pills, chips) get a 4px corner, enough to read as signage plates. The only full circles are route bullets, station rings and stops on the route strip: the transit-map vocabulary. Lines are 4px (line rule, fleet lines, fresh bar), 6px on the sign-in map, and 8px with round caps and 45° bends on the route strip.

### Named Rules

**The Rule, Not Box Rule.** A section is a 2px ink rule with content beneath it, not a bordered box. Only live panels (the agent fleet and the idea chat) are boxed.

## Components

### Buttons

Plain signage plates: confident, flat, bold.

- **Shape:** 4px corner, 40px tall, 16px side padding, bold 14px label, optional 16px icon with an 8px gap.
- **Primary:** Action Navy fill with action-ink text; hover steps to Action Navy Lift. One primary per region.
- **Secondary (default):** transparent with a 1px Strong Hairline border and ink text; hover darkens the border to ink.
- **Quiet:** mute text, no border; hover to ink. Used for back links and cancel.
- **Press / Disabled:** press nudges down 1px; disabled drops to 50% opacity and ignores the pointer.
- **Band CTA:** on the signed-out sign band only, Sign in is a Research Yellow plate with navy text.

### Chips

- **Pill (status label):** 24px tall, 4px corner, 1px border in its own text colour, bold 12px. Tones: neutral (ink-2), accent (accent-strong), sup, dis. Always outlined, never filled.
- **Filter chip:** 32px tall, 4px corner, 1px Strong Hairline border, bold 14px. Pressed fills with Action Navy. Example-idea chips on sign-in use the same shape on a panel fill.

### Cards / Containers

- **Ruled card (default):** no box: a 2px ink rule across the top, content below, transparent on the ground.
- **Boxed card:** 1px Hairline border, Paper Panel fill, 24px padding. Only for the agent fleet panel and the idea chat.
- **Hypothesis board cell:** Paper Panel, 24px padding, packed edge to edge in a hairline grid. A 4px Research Yellow bar fades in along the top when the hypothesis has just changed.
- **Empty state:** dashed Strong Hairline border, centred icon, bold title and a short mute line.
- **Banners:** full-width strips with 1px hairlines top and bottom on Paper Panel; the paused-agents banner uses 4px Research Yellow rules instead.
- **Shadow Strategy:** none (see Elevation & Depth).

### Inputs / Fields

- **Style:** Paper Panel fill, 1px Strong Hairline border, 4px corner, 8px by 12px padding, 14px ink text, mute placeholder, Signal Blue caret.
- **Focus:** the border darkens to ink; no glow. Other focusable elements get a 2px Signal Blue outline offset 2px.
- **Field:** bold label above the control, optional 12px mute hint below, 8px apart.
- **Error:** a Disproves Red text line below the form (see The Error Is Disproof Rule).

### Navigation

- **Sign band:** 64px Station-Sign Navy band, sticky, wordmark at left, tabs in bold 14px Sign Mute with 16px icons, Sign in or out at the right in Sign Mute.
- **Active tab:** text turns sign-ink and a 4px Research Yellow bar sits along the top edge of the tab, like a lit platform sign.
- **Line rule:** a 4px strip under the band in four equal segments: yellow, red, green, blue.

### Route Bullet

A hypothesis type as a transit roundel: a filled Action Navy circle with an extrabold letter (P, C, W, Ch, Co, M). 24px beside board cells, 40px beside the hypothesis headline.

### Score Bar

A 8px Sunk Concrete track filled from the left in Supports Green at 50 or above and Disproves Red below, with a 1px ink tick at 50% (the starting score) that overhangs the track by 3px. The percentage sits to the right in bold tabular numerals.

### Route Strip

The signature component: score history drawn as a transit line across the page between 1px hairlines. Each quote is a stop; the run before a stop is proportional to that quote's weight, and each change in score bends the line at 45°. Segments are 8px with round caps, coloured by the stance of the quote that caused them (green or red). Stops are Paper Panel rings stroked in the stance colour; the terminus is a larger ink ring. A dotted hairline marks 50%. Station labels are 11px bold caps, set above climbing stops and below falling ones. When the persona analysts disagree, the line forks into a dotted Research Yellow spur labelled with the disagreement. The newest segment draws itself in.

### Fleet and System Map

Teams are lines, agents are stations. Each team has a 4px line in its colour behind a row of 18px station rings; a running agent's ring fills Research Yellow and pulses, an agent that has acted has an ink ring, and an idle one a Strong Hairline ring. The signed-out page shows the same map statically with 24px rings on 6px lines that draw in on scroll.

## Do's and Don'ts

### Do:

- **Do** colour every score, score bar and stance mark by the 50 threshold: sup at 50 or above, dis below.
- **Do** separate sections with a 2px ink rule on top and items with 1px hairlines.
- **Do** set every number in font-num with tabular figures.
- **Do** put the four-colour line rule under every sign band.
- **Do** give interactive controls a 4px corner and keep panels square.
- **Do** honour prefers-reduced-motion for every draw, rise, pulse and tick.

### Don't:

- **Don't** use a line colour as decoration, or a team colour to mean supports or disproves.
- **Don't** use a box shadow, gradient or glow.
- **Don't** set numerals in Overpass Mono, or use mono for anything but code.
- **Don't** box a section; boxed cards are for the fleet panel and the idea chat only.
- **Don't** fill a status pill; pills are outlined in their own colour.
- **Don't** set uppercase labels or kickers above headings; caps belong only to station labels on a line map.
- **Don't** introduce a second typeface or a rounded card radius.
