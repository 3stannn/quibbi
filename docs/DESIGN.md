# Quibbi interface direction

The student's main question is: which deck do I want to work on? In the editor it becomes: what do I want to remember?

## Reference-led brand refresh

The user's November 3 references supersede the initial quiet-workbench landing. Extract their spacious centered hierarchy, tangible card demo, light/dark progression, and confident closing statement. Retain the requested #121212 / #F5F5F5 palette and create original copy and compositions; do not reuse the reference site's identity, usage figures, testimonials, or feature claims.

Visual thesis: a small, physical practice desk. A large real two-sided flashcard is the hero focal asset. Paytone One supplies Quibbi's wordmark and brand/display typography; Geist stays on body text, controls, and authored cards. Sequence: centered introduction and Google action, interactive example card, dark principles section, light front/back deck specimen, closing action and wordmark footer. The same theme extends through the authenticated library and deck editor, shared buttons, inputs, dialogs, empty/loading/error states, and not-found screens. Use consistent pill actions, comfortable controls, rounded tonal surfaces, and Paytone structural headings; editable fields, student deck titles, and card content remain Geist. The workspace retains its data behavior and native scrolling; GSAP/Lenis are scoped to the landing.

Motion: GSAP intro transforms keep text readable from the first frame; section headings move in restrained word sequences with complete accessible names. The signature interaction is a reversible rotateY card flip. Reduced motion swaps faces immediately and bypasses scrolling/reveal animation. GSAP context/matchMedia and explicit cleanup handle navigation and React StrictMode.

Lenis is the sole smooth-scroll engine, scoped to the signed-out landing. It was selected over Locomotive Scroll because this page needs a direct native-scroll integration rather than its additional detection/parallax layer. Lenis scroll updates feed ScrollTrigger, and GSAP's ticker supplies elapsed milliseconds. Font and resize changes refresh measurements. No Three.js is used: the card needs DOM depth, not WebGL.

Compatible design guidance: build-awwwards-quality-sites with the bundled frontend-design and Taste craft/review guidance. Official GSAP core, React, and ScrollTrigger skills were read from [GreenSock's skill repository](https://github.com/greensock/gsap-skills). User references govern composition over the previous randomized app sheet.

Assets: original semantic interface specimens, offline Solar icons from the Iconify Solar package (MIT), no photography or endorsements. Paytone One 5.3.0 is self-hosted through Fontsource under OFL-1.1. The favicon is the actual Paytone Q glyph converted into an SVG outline, with its license shipped at `/fonts/OFL-Paytone-One.txt`. Geist provenance remains below.

The library is scoped to the signed-in student, contains private deck titles and honest card counts, and places creation next to its heading. New accounts start empty. The editor exposes front/back pairs, ordering, and explicit save state. The original stacked-card symbol remains appropriate for empty-state content; the brand identity now uses the Paytone wordmark and Q.

## Tokens and precedence

- Ground: #F5F5F5; ink and primary action: #121212.
- Surfaces: white; secondary surface: #EBEBEB; muted text: #626262; controls use stronger neutral borders than panels.
- Geist Sans is the text family, including student-authored digits and editable fields.
- Dedicated counts use an explicit Numeric component. Until an intended Ndot file and a web embedding license are supplied, they intentionally use Geist. Ndot acceptance is pending; an unrelated dotted font must not be substituted.
- Flat surfaces, one quiet navigation bar, compact sentence-case headings, visible focus, 44px mobile actions, and reduced motion support.

The bundled Taste app workflow dealt **Achromatic ledger**, seed **1888254822**, keeping palette and typography. The user's monochrome direction overrides its chart hue, and the plan's Geist/Ndot requirements override its figure-face suggestions. A top navigation bar is appropriate for this initial single-destination workspace. No charts or invented progress metrics are needed.

The Kip website reference was not supplied or found in the bundled frontend reference. This workbench is the documented proposed alternative; it does not claim to reproduce that reference.

## Scope

The first slice covers login, a private library, and saved deck editing. Study, quizzes, invitation previews, and sharing remain subsequent milestones behind the real authentication/persistence gate. The login's example flashcard is explanatory sample content, never represented as a student's saved data.

## Font provenance

Geist is distributed through `@fontsource/geist`; see the installed package's LICENSE and upstream [Geist](https://github.com/vercel/geist-font), SIL Open Font License 1.1. Only required sans weights are imported with swap loading. Ndot has no verified supplied asset or license and is not bundled.
