# Verification record

November 3, 2026. Implemented scope: foundation plus private library/deck editing. The complete product is not release-ready. No deployment was performed.

## Branding and motion refresh

The subsequent reference-led landing refresh uses self-hosted Paytone One for the wordmark/display typography and Geist for body and actual flashcard content. The SVG favicon outlines the original Paytone Q; its OFL license is shipped with the public assets. The interactive sample uses GSAP rotateY, two real card faces, and accessible active-face state. Lenis is the only smooth-scroll library and is scoped to the landing; no Three.js or WebGL is used.

Six Chrome browser tests passed after the refresh: the original three workspace journeys plus actual 3D card rotation and interruption, live reduced-motion changes, font/favicons/responsive sections, and a readable JavaScript-disabled fallback. Screenshots were inspected at 390, 768, and 1440. Independent review found no remaining P1/P2 issues in the motion lifecycle, active-face accessibility, typography, or page layout. No copied reference assets, invented usage metrics, testimonials, AI features, or pricing are displayed.

The final desktop pass reduces the hero's vertical footprint to bring the demo question into the first viewport. The landing is lazy-loaded: its GSAP/Lenis code is in a separate approximately 152 kB chunk (57 kB gzip); the authenticated main bundle is approximately 381 kB (122 kB gzip). The final production build, lint, formatting, and six browser tests pass after this split.

The signed-out page includes clearly labeled illustrative card content. Real Google/MongoDB acceptance remains pending as recorded below; the animation work does not change that gate.

## Shared workspace theme

The theme now also covers the library, deck editor, shared shadcn controls, new/delete/unsaved-change dialogs, empty/loading/error states, and not-found content. Paytone is limited to branding and structural headings; student content and editable values stay in Geist. Shared actions have 44px touch targets, and controls use a stronger neutral boundary than decorative panels. Legacy login/sample styles were removed.

The production web build, workspace type checks, ESLint, and all six Chrome journeys pass after these changes. Editor screenshots were inspected at 390, 768, and 1440, alongside empty-library, new-deck-dialog, unsaved-dialog, and save-error captures. No API or persistence behavior changed. `.gitignore` covers local secrets, browser authentication state, caches, generated reports/builds, and machine-specific files, while retaining the lockfile, environment template, and source/font licenses.

## Automated and visual checks

- Production workspace build and TypeScript checks passed.
- ESLint and Prettier checks passed.
- Eight Vitest/Supertest API/domain tests passed: session requirement, CSRF/origin rejection, malformed Unicode token rejection, ownership isolation, validation, revision conflict, content version changes, safe return URLs, environment checks, and honest missing configuration.
- Three Playwright Chrome journeys passed: setup-required login and keyboard sample card; save failure/draft preservation/CSRF refresh/reload/unsaved navigation; empty library/create/delete. These use intercepted API fixtures, not real OAuth or MongoDB.
- Screenshots inspected at 390, 768, and 1440 pixels for login and editor. No horizontal overflow. Editor stacks card front/back on phones, preserves visible save action, and shows text feedback alongside state changes.
- Geist loaded in browser; the bundled app inspector measured Geist for 100% of detected text. Ndot remains an explicit Geist fallback and is not an accepted Ndot implementation.
- Taste app inspector on the production-built login at port 4173: zero failures, one warning. Desktop/tablet/mobile screenshots were inspected. The large login title is intentional for the signed-out introduction; authenticated app titles remain compact. Dialog shadow is appropriate for a floating modal; Skeleton animation is disabled by reduced-motion preferences.
- Live unconfigured development server: `/` HTTP 200, `/api/session` HTTP 200 with null user and configured false, `/api/health` HTTP 503 setup-required. Private endpoints never receive a demo session.
- Dependency audit after patched direct dependencies and the `minimatch` lint-tool override: zero reported vulnerabilities. The override retains the same named matcher API used by the tooling; verify lint when updating it.

API tests inject authentication and an in-memory repository. They exercise HTTP authorization and schema boundaries but do not prove the native MongoDB repository, unique provider identity, or production cookies. Local network/browser checks require loopback permission in the execution sandbox.

## Real-provider gate — pending

After filling `.env`, use synthetic students only:

1. Sign in with Google account A. Confirm one Auth.js user/account and a database session; sign out and sign in again and confirm identity reuse.
2. Cancel/deny login and retry. Open `/login?returnTo=/s/example` and confirm a safe same-origin destination survives OAuth. External return destinations must fall back to library. Sharing routes themselves are not implemented yet.
3. Create a deck, add/edit/reorder/remove cards, save, reload, and verify persisted content in MongoDB. Change it in a second tab and confirm a stale save preserves the local draft and reports conflict.
4. Sign in with account B. Confirm account A's deck cannot be listed, fetched, changed, or deleted; inaccessible IDs return not-found.
5. Expire/revoke a database session, then check private APIs reject it. Sign-out removes access.
6. Through the actual HTTPS reverse proxy, inspect Secure/HttpOnly/SameSite session cookies, callback URLs, logout, and Origin/CSRF rejection. Verify the configured proxy hop count.
7. Simulate lost network during save. Confirm the draft remains visible and can be retried. Verify expired CSRF token renewal in a long-running real session.
8. Check keyboard navigation, screen-reader announcements, 200% browser zoom, fallback fonts, reduced motion, and mobile touch targets with actual authenticated content.

Only after this gate should study progress, quiz snapshots and scoring, immutable sharing/imports, and the two-student end-to-end release journey be implemented and accepted per the source plan.
