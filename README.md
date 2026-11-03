# Quibbi

A private flashcard workspace built with React, Vite, TypeScript, React Router, Tailwind, shadcn/ui, Express, Auth.js, and MongoDB. Its monochrome landing uses Paytone One branding, Geist body text, a GSAP 3D flashcard, and landing-only Lenis scrolling with reduced-motion support.

This implementation covers the foundation and private-deck vertical slice: Google session integration, library, deck creation/editing/deletion, card ordering, explicit saves, ownership, and revision conflicts. Study, quizzes, history, and sharing are subsequent milestones. The source plan requires a real authentication/persistence proof before those features. That proof remains pending local credentials; no fake authentication is included.

## Run locally

Use Node 22.12+ and npm. From the repository root:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Use `localhost` consistently, including Google callback settings. The development server forwards `/api` and `/auth` to port 3001. Shared contracts build automatically before development starts.

Without credentials, the login page and its example card work, but Google sign-in is disabled, private endpoints reject unauthenticated access, and `/api/health` reports HTTP 503 `setup-required`. This is intentional. Never use this state as a successful authentication proof.

## Configure Google and MongoDB

Fill the root `.env` using `.env.example`. Set a MongoDB connection string, a random `AUTH_SECRET` of at least 32 characters, and Google OAuth client ID/secret. Configure a Google OAuth **Web application** with authorized redirect URI `http://localhost:5173/auth/callback/google`. Configure the consent screen and add development test users as required by Google. Restart development after changing the environment.

MongoDB must allow the server connection and a dedicated database user with read/write and index-creation permissions on the application database. The server shares one native driver pool between Auth.js and deck persistence. Startup creates indexes. No secrets belong in a `VITE_` variable or frontend bundle.

## Verify

```powershell
npm run build
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run format:check
```

Browser tests use installed Chrome by default; set `PLAYWRIGHT_CHANNEL=msedge` for Edge. Browser tests intercept APIs to check UI behavior; API integration tests inject sessions and a repository. Neither substitutes for Google or a real MongoDB smoke test. See [verification](docs/VERIFICATION.md) for the real-provider checklist and recorded limits.

## Structure and deployment

- `apps/web`: browser UI and same-origin API client.
- `apps/api`: Express, authentication, MongoDB repositories, API tests.
- `packages/shared`: public runtime schemas and contracts.
- `docs`: original plan, design decisions, verification, and operations.

See [operations](docs/OPERATIONS.md) before running a production server. No deployment or hosting account has been created. Geist is bundled under OFL-1.1; the intended Ndot font has not been supplied or licensed. Dedicated numeric displays currently use an explicit Geist fallback. See [design](docs/DESIGN.md).
