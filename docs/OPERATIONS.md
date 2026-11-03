# Operations

## Production configuration

Choose a Node-capable host and managed MongoDB before deployment. Build with `npm ci` and `npm run build`. Set `NODE_ENV=production`, `APP_ORIGIN=https://your-domain.example`, Google callback `https://your-domain.example/auth/callback/google`, and all secrets through the host's secret manager. Run `npm start`; Express serves both the built frontend and API. Do not use Vite's development server for production.

Terminate HTTPS at the trusted reverse proxy. Set `TRUST_PROXY_HOPS` to its actual hop count; block direct public access to the Node port when relying on proxy headers. Preserve the public Host header. Auth.js is pinned to the configured origin, production session cookies are Secure/HttpOnly, and application mutations require both same-origin Origin and a signed CSRF token. Sessions expire after 30 days. Provider sign-out uses Auth.js's own CSRF-protected POST.

The authentication integration is experimental upstream. Real-provider acceptance, secure-cookie checks through the actual proxy, and deployment approval remain pending. Configure Google consent/verification appropriate to the audience before release.

## Storage

Domain ownership uses the canonical Auth.js user ID string. MongoDB stores decks with owner/update-time/id indexes. Auth.js manages users, accounts, and sessions; sessions have an expires TTL index. Database session reads enforce expiry independently of TTL cleanup timing. Deck content is embedded, bounded to 200 cards with 2,000-character front/back fields and three alternatives; requests are bounded to 3 MB. Writes use an atomic owner/id/revision match.

Back up the entire application database using the managed provider's encrypted backups or `mongodump` with a private credential mechanism. Restore into an isolated staging database first, then verify users/accounts/session expiry and deck ownership with two test accounts. Restrict backup access and define retention before accepting real student data. A backup/restore drill has not yet been performed.

Current deck deletion is one MongoDB document deletion. Study progress, attempts, and share collections are not implemented in this slice. Before adding them, implement the plan's recoverable cleanup/revocation job; do not imply current deletion already cleans up those future collections.

## Account-data deletion

A self-service account deletion flow is not implemented. Until it is, fulfill a verified deletion request administratively: identify the canonical user `_id` through the Auth.js users collection, revoke sessions by `userId`, delete owned decks by its string ID, delete linked provider accounts by `userId`, and delete the user record last. Use a resumable job/checklist, preserve no secrets in logs, and reconcile counts afterward. Document backup-retention handling for deleted data. This is an operator procedure, not a shipped UI capability.

## Monitoring

`GET /api/health` returns 200 only when authentication is configured and MongoDB responds. It returns 503 for incomplete setup or database failure. Avoid recording request URLs, cookies, Google tokens, or future share tokens in logs. The application logs generic error names rather than payloads. Add deployment-specific alerting before release.
