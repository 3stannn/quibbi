# Quibbi implementation plan

Status: proposed implementation sequence, November 3, 2026. Planning only; application code and deployments have not been created.

## Product scope

Quibbi is a playful, mobile-friendly study space for students. Version one supports Google authentication, personal flashcard decks, personal quizzes, and sharing independent copies of decks.

Primary journey: Continue with Google -> create a deck -> study cards -> take a quiz -> review mistakes -> share a link -> a friend saves their own copy.

Defer leaderboards, challenge membership, live multiplayer, teacher administration, public deck discovery, AI question generation, payments, collaborative editing, and offline synchronization.

## Architecture

- Frontend: React, Vite, TypeScript, React Router, and Tailwind CSS.
- Backend: Node.js, Express, and TypeScript; JSON REST endpoints.
- Database: MongoDB using the native driver. Keep one shared connection pool per server process.
- Authentication: Auth.js Express integration, Google provider, MongoDB adapter, and database-backed sessions. Verify this combination before building domain features.
- Validation: shared runtime request schemas, such as Zod; TypeScript types alone do not validate requests.
- State: local React state for card flips and current interactions; server persistence for saved decks, progress, and quiz attempts. Add a server-state library only when fetching/invalidation needs justify it.
- Testing: Vitest for domain logic, Supertest for API integration, and Playwright for core browser journeys. Pin compatible dependency versions during setup.

Use one repository with npm workspaces:

```text
apps/web/          React routes, features, components, API client
apps/api/          Express routes, authentication, services, repositories
packages/shared/  Request/response schemas and public types
docs/             Setup, data rules, and deployment notes
```

Share only safe public contracts with the frontend. Database credentials, auth secrets, and quiz answer keys remain server-side.

Development: Vite proxies `/api` and `/auth` to Express. Production proposal: Express serves the built frontend and API behind one HTTPS origin on a Node-capable host, with managed MongoDB. Select the hosting provider before deployment; no publishing is authorized by this plan.

## Authentication and access rules

- One button: Continue with Google. First successful login creates a user; subsequent logins reuse the same Google account identity.
- Configure Google OAuth credentials, consent-screen settings, development/production callback URLs, `AUTH_SECRET`, and `MONGODB_URI`. Commit only an `.env.example` with placeholders.
- Mount Auth.js at `/auth`; callback is `/auth/callback/google` on the configured origin. Use the Express integration's session APIs, not Next.js-specific React helpers.
- Use secure HttpOnly session cookies in production. Configure proxy trust for the actual deployment, session expiry, logout, and CSRF protection for state-changing requests, including application endpoints.
- Require a server-verified session for personal data. Derive ownership from that session, never a request-supplied user ID.
- Authorize every deck, progress, attempt, and share-management request. Return a consistent not-found response for inaccessible resources.
- Allow unauthenticated visitors to view only the explicit share preview. Do not expose the creator's email, study history, or authentication records.
- Preserve invitation intent through Google login using a validated same-origin return path. After login, return to the invitation; copying still requires the student's explicit Save a copy action.

## Data model

Auth.js manages its user, provider-account, and session collections. Use the adapter's canonical user identifier consistently throughout domain collections.

| Collection     | Main fields and rules                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decks`        | Owner ID, title, description, revision, embedded cards, timestamps, optional source-share ID. Each card has a stable ID, front, back, optional approved quiz alternatives, and content version.        |
| `cardProgress` | Owner ID, deck ID, card ID, card content version, got-it/practice-again status, last-reviewed time. Unique owner/deck/card key. This is self-reported progress, not a mastery claim.                   |
| `quizAttempts` | Owner ID, source deck/revision, immutable question snapshot with server-only keys, question/option order, saved selections, in-progress/completed status, score, timestamps, creation idempotency key. |
| `shareLinks`   | Owner ID, source deck ID/revision, immutable deck snapshot, hashed random token, created time, optional expiry, revoked time. Exclude all personal progress.                                           |

Initial proposed content limits: 200 cards per deck, 2,000 characters per card text field, and at most three alternative answers per card. Enforce bounded titles, descriptions, payload sizes, and pagination too. Revisit limits from observed use; embedding must remain comfortably below MongoDB's document-size limit.

Indexes: decks by owner/update time; progress by owner/deck/card; attempts by owner/deck/create time; unique token hash; share links by owner/source deck. Use a partial unique index on copied decks `(ownerId, sourceShareId)` to make repeated imports of a link return the existing copy, without restricting ordinary decks.

Deck edits use a revision check to detect simultaneous edits. Changed card content resets its effective progress via content version; removed cards do not appear in current progress. Deck deletion removes its current progress and revokes its links. Completed quiz snapshots remain readable without the original deck. In-progress snapshots can still be completed. Imported copies remain independent. Deletion cleanup must be recoverable if interrupted.

## Feature behavior

### Personal study

- Create, rename, edit, and delete decks; add, edit, reorder, and remove text cards.
- Explicit Save with visible dirty/saving/saved/error states; warn before leaving unsaved edits.
- Study all cards or only cards marked Practice again; optional shuffle.
- Flip using a visible button or keyboard control. Mark Got it or Practice again, then advance.
- Persist each review result. A network failure must show unsaved progress and allow retry without claiming success.
- Empty decks guide students to add cards. A completed session offers Review difficult cards or Return to deck.

### Personal quizzes

- Multiple-choice quizzes use a card's front as the prompt and back as the correct answer.
- Suggest distractors from distinct answers elsewhere in the deck; the creator explicitly reviews/approves alternatives and may enter their own. No AI dependency.
- An eligible question has a nonempty prompt, one correct answer, and three distinct approved distractors. Normalize whitespace/case for duplicate detection. Editing the prompt, correct answer, or alternatives invalidates approval for that card.
- Quiz setup shows eligible-card count and explains how to fix excluded cards. Require at least four eligible cards; choose 4-20 questions, capped by available questions.
- Starting creates a persistent snapshot. Shuffle question/option order once and preserve that order on resume. Later deck edits cannot change the attempt.
- Save selections server-side as the student proceeds; resume after refresh. Clearly indicate save failures.
- Guard answer updates by in-progress status and attempt revision. Submission supplies the final complete selection set and expected revision, then atomically freezes those selections, score, and completed status in one conditional document update. Reject stale writes and edits to completed attempts; return the stored result on repeated submission. Delayed saves must never change completed results.
- Correct = one point, incorrect/unanswered = zero. No timer or ranking. Confirm submission with unanswered questions.
- Finalize and calculate score on the server; repeated submission returns the same result. Reveal answer review after completion.
- Results show accuracy, original prompts/answers, and mistakes. Review mistakes works from the attempt snapshot even when the source deck changes or is deleted. Practice again creates a new attempt.
- These are personal practice results, not a claim of exam integrity; students already have access to their deck answers.

### Deck sharing

- Sharing creates an immutable snapshot of the current saved deck. Explain that later edits require a new link. Offer revocation of older links.
- Anyone holding an active link can preview and copy its deck content. Clearly state this before creating the link.
- Generate an unpredictable token, store only its hash, redact tokens from application logs, and avoid third-party analytics on preview pages.
- Preview displays deck title, card count, and a small sample. Saving requires Google login and explicit confirmation.
- Backend validates the link and inserts the entire copied deck as one document, assigning a new owner and new card IDs. Include approved quiz configuration, but no attempts or progress.
- The copy includes the source-share ID for the unique import index. Duplicate requests return the existing copy, including under concurrent requests.
- Revoked/expired links deny future previews and imports. Existing copies survive. A request authorized just before revocation may finish; revocation is not a recall of prior content.
- Creator cannot import their own link; show Open your deck. If a recipient deletes a copy, importing again can create a new one.

## Screen and API map

| Screen                | Route                                     | Main API operations                                                                                                         |
| --------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Sign-in               | `/login`                                  | Auth.js sign-in/sign-out/session endpoints under `/auth`                                                                    |
| Library               | `/library`                                | `GET /api/decks`, `POST /api/decks`                                                                                         |
| Deck workspace/editor | `/decks/:id`                              | `GET`, `PATCH`, `DELETE /api/decks/:id`                                                                                     |
| Study                 | `/decks/:id/study`                        | `GET /api/decks/:id/progress`, `PUT /api/decks/:id/progress/:cardId`                                                        |
| Quiz setup/player     | `/decks/:id/quiz`, `/quizzes/:attemptId`  | `POST /api/decks/:id/attempts`, `GET /api/attempts/:id`, `PATCH /api/attempts/:id/answers`, `POST /api/attempts/:id/submit` |
| Quiz history/results  | `/history`, `/quizzes/:attemptId/results` | `GET /api/attempts`, completed attempt detail                                                                               |
| Share controls        | Within deck workspace                     | `POST/GET /api/decks/:id/shares`, `DELETE /api/shares/:id`                                                                  |
| Invitation preview    | `/s/:token`                               | `GET /api/share-preview/:token`, `POST /api/share-preview/:token/import`                                                    |

Use structured validation errors and consistent authentication, conflict, expired-link, and rate-limit responses. Rate-limit public preview/import and mutation endpoints. Render user content as text; no raw HTML in version one.

## Visual direction and accessibility

Quibbi should feel like a friendly study companion. Put actual flashcards, deck titles, and the next useful action at the center. Keep library navigation quiet and study mode focused on one card. Use a restrained accent palette and brief action-driven flips/completion feedback. Final colors and any mascot are design decisions for the implementation stage; typography is specified below.

### Typography requirements

- Use **Geist Sans** for normal interface text: headings, navigation, buttons, labels, body copy, forms, deck titles, flashcard content, and quiz questions/answers.
- Use **Ndot** for dedicated numeric displays: deck/card counts, study position (for example, 3 / 20), quiz scores, accuracy percentages, and progress summaries. Keep adjacent words in Geist.
- Scope Ndot through an explicit numeric component/token, not automatic digit replacement. Numbers inside student-authored cards, answers, titles, formulas, dates in prose, editable fields, URLs, and technical identifiers stay in Geist for reading and editing consistency.
- Define shared font tokens, such as `--font-text` and `--font-numeric`, and use consistent number formatting. Verify Ndot supports the digits, separators, and symbols required by each display; use Geist for unsupported glyphs and avoid changing a value's meaning or accessible name.
- Obtain the intended Ndot font from a verified source and confirm permitted web embedding before including it. The specific Ndot asset and license are not yet supplied or verified; do not substitute an unrelated dotted font or claim the font is bundled. Record source/license details for both fonts when adding assets.
- Load only the needed font files/weights with suitable fallbacks and `font-display: swap`. Preserve readable sizing and contrast for Ndot's dot forms; reserve enough space for loading and changing numeric values. Keep complete values available to assistive technology.
- Typography acceptance: verify actual loaded fonts in the browser, check that numeric displays use Ndot and prose uses Geist, and inspect narrow screens, 200% zoom, fallback rendering, and representative scores/counts/percentages. Do not claim Ndot is implemented while a fallback is rendering.

Use Kip's bundled frontend-design guidance and Taste's app-screen workflow for implementation and visual review, with the applicable bundled React engineering rules. Treat Geist/Ndot as the fixed typography system: preserve it when choosing a design direction rather than accepting randomized type suggestions. Use one coherent design workflow. The project preference for a reference from Kip's website is recorded, but that reference is not available in this task; do not invent its details. Resolve the reference or document a proposed alternative before final visual implementation.

Support keyboard-only use, visible focus, accessible form labels, announced save/errors, reduced motion, adequate contrast, touch controls, and layouts at 390, 768, and 1440 pixels. Do not use motion or color as the only feedback. Keep React renders local to the interaction, avoid request waterfalls, and apply React guidance that fits Vite rather than Next.js APIs.

## Implementation sequence and completion gates

### 1. Foundation and authentication proof

Set up workspaces, formatting/linting/type checks, database connection, environment validation, health endpoint, same-origin routing, and one Google sign-in button.

Gate: real Google sign-in creates one account; repeat login reuses it; logout and expiry protect an API route; denied/canceled login is recoverable; invitation return paths survive login and reject external redirects. Test production-style HTTPS/proxy cookies too. Auth.js Express is experimental: if the proof fails, report the exact incompatibility and choose a documented resolution before continuing dependent work; do not silently replace the agreed library.

### 2. Library and deck editing

Implement ownership rules, deck schema/indexes, editor, library, limits, revisions, and empty/error states.

Gate: a student creates and edits a deck across reloads. Another account cannot read or mutate it. Invalid data is rejected, stale edits produce a conflict, and failed saves preserve the draft.

### 3. Study mode

Implement flip/shuffle/filter controls, versioned review progress, session completion, and keyboard/mobile behavior.

Gate: reviews persist after reload; difficult-card filtering works; edited/removed cards do not show stale mastery; failed writes remain visible and retry safely.

### 4. Personal quizzes

Implement reviewed alternatives, eligibility, quiz snapshots, saved answers, resumable attempts, submission, results, and history.

Gate: small/ambiguous decks get actionable guidance. Server scoring handles unanswered questions and repeated submission. Concurrent answer-save/submission requests cannot mutate completed answers or produce a score inconsistent with them; stale writes recover through refetch/retry. Answer keys are absent from unfinished-attempt responses. Refresh resumes the same questions/order; source edits/deletion do not break snapshot results.

### 5. Sharing and independent copies

Implement snapshot links, previews, Google return flow, import, revocation, and independent ownership.

Gate: a second account opens a link, signs in, and imports exactly one complete copy. Concurrent/retried imports return the same deck. Copies have no progress and remain editable after source changes/deletion or link revocation. Invalid, expired, revoked, and own-deck links behave as specified.

### 6. Release preparation

Run production builds and focused integration/browser checks; inspect actual screenshots at target widths using Kip's bundled design review guidance. Verify Geist/Ndot font loading and usage, session, privacy, keyboard, reduced-motion, network failure, and mobile paths. Document deployment, indexes, secret management, backup/restore, account-data deletion, and recoverable cleanup. Provide a reproducible seeded demo without exposing real student data.

Gate: the complete two-student journey passes in a production-like environment; no unresolved privacy/data-loss failures; setup instructions reproduce the app. A real deployment requires configured Google credentials, MongoDB, and a chosen hosting target. Automated tests may mock OAuth; separately record real-provider smoke-test results.

## Verification priorities

Prioritize API integration tests for cross-account isolation, session expiry, CSRF, invalid inputs, unique import races, revocation, stale deck edits, quiz snapshot grading, and double submission. Use unit tests for quiz eligibility/scoring and progress version rules. Browser tests cover the main student journeys, with manual keyboard and screenshot inspection. Avoid tests that merely mirror CSS or implementation details.

First implementation target: complete milestone 1, then a vertical slice that signs in, creates a private deck, and reloads it successfully. Do not build all screens against mocked behavior before proving persistence and authentication.

## Documentation checked

- [Auth.js Express integration](https://authjs.dev/reference/express): experimental status and Express session integration.
- [Auth.js Google provider](https://authjs.dev/getting-started/providers/google): Google authentication configuration.
- [Auth.js MongoDB adapter](https://authjs.dev/getting-started/adapters/mongodb): auth persistence and driver integration.
- [MongoDB transactions and atomicity](https://www.mongodb.com/docs/manual/core/transactions/): single-document writes are atomic; multi-document atomicity requires transactions when used.

No runtime tests, OAuth login, or visual checks were performed while preparing this plan.
