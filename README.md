# Ryler's DSE Dashboard

A full-stack Next.js app for tracking Dar es Salaam Stock Exchange securities, prepared for Cloudflare Workers deployment with Postgres persistence.

## Production Stack
- Next.js App Router
- Cloudflare Workers via OpenNext
- PostgreSQL for market, watchlist, alert, notification, and ingestion data
- Resend for email alerts

## Core Commands
```bash
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run sync:dse
npm.cmd run backfill:dse-history
npm.cmd run cf:build
npm.cmd run cf:deploy
```

## Environment Variables
Use `.env.local` for local development.

```bash
DATABASE_URL=
RESEND_API_KEY=
ALERT_EMAIL_TO=
ALERT_EMAIL_FROM=
SYNC_WEBHOOK_SECRET=
```

## Local Postgres Setup
1. Create a Postgres database and set `DATABASE_URL`.
2. Run `npm.cmd run db:migrate`.
3. Run `npm.cmd run db:seed` if you want to import the current local JSON dataset.
4. Run `npm.cmd run sync:dse` to pull the latest official DSE market page into Postgres.
5. Run `npm.cmd run backfill:dse-history` to import roughly 90 calendar days of history for the 20 most-traded DSE equities based on the latest market session.

If `DATABASE_URL` is not set, the app falls back to the existing local JSON store so development can continue without a database.

## Local Dev Stability
`npm.cmd run dev` now clears `.next` before starting Next.js. That avoids the intermittent stale chunk issue where CSS disappears and the app temporarily renders as plain HTML during local development.

## Cloudflare Workers Deployment
1. Push this project to GitHub.
2. Provision a Postgres database and collect the connection string.
3. Create a Resend API key and verify your sending domain or sender.
4. Add secrets in Cloudflare Workers:
   - `DATABASE_URL`
   - `RESEND_API_KEY`
   - `ALERT_EMAIL_TO`
   - `ALERT_EMAIL_FROM`
   - `SYNC_WEBHOOK_SECRET`
5. Build for Cloudflare with `npm.cmd run cf:build`.
6. Deploy with `npm.cmd run cf:deploy`.

Key deployment files:
- `open-next.config.ts`
- `wrangler.jsonc`
- `db/schema.sql`

## Scheduled Sync Option
A secure sync endpoint is available at `POST /api/admin/sync`.
Send either:
- `x-sync-secret: <SYNC_WEBHOOK_SECRET>`
- or `Authorization: Bearer <SYNC_WEBHOOK_SECRET>`

You can use that endpoint from an external scheduler or CI workflow.

## Notes
- The Postgres-backed store lives in `lib/postgres-store.ts`.
- The local fallback store lives in `lib/local-store.ts`.
- `lib/store.ts` chooses the correct backend automatically based on `DATABASE_URL`.
