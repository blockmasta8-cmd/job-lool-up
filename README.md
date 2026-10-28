# Job-Lool-Up

A mobile-first global job discovery SaaS. Launch focus: United States, then South Africa, followed by other major employment markets.

## Current status

The app now has a backend search API with adapters for Adzuna (US and South Africa) and USAJOBS (US federal vacancies). It normalizes results, deduplicates similar title/company/location records, filters old Adzuna posts older than 45 days and expired USAJOBS announcements, and links each result to its original listing. The UI does not create fake fallback listings.

**Live search requires credentials.** Copy `.env.example` to `.env` and add provider credentials. `.env` is ignored by Git. Adzuna's free API is for evaluation; the current terms restrict ongoing commercial use without a written licence after the 14-day trial. Do not enable it for a public commercial service until permission/licensing is confirmed. See https://developer.adzuna.com/docs/terms_of_service. USAJOBS search requires an API key and the email used in its application: https://developer.usajobs.gov/.

## Run locally

```bash
npm install
cp .env.example .env
# Edit .env and add keys only for sources you are authorized to use.
npm run dev
```

Vite serves the frontend and proxies `/api` requests to the Node API on port 8787. You can check provider configuration at `/api/health`. To run only the API, use `npm run api`.

## API

- `GET /api/health` — checks which provider credentials are configured (never returns secrets).
- `GET /api/jobs?country=us&query=engineer&location=New%20York` — live search.
- `GET /api/jobs?country=za&query=developer&location=Cape%20Town` — live search.
- `GET /api/jobs?query=analyst` — searches both launch countries.

Supported country codes are `us` and `za`. API keys are server-side only. Search failures are surfaced as source status/errors, not disguised as empty live data. Salary is omitted when the source does not provide it; source salary values are not independently verified.

## Product roadmap

- Confirm commercial data permissions and configure credentials.
- Add automated scheduled refresh, persistent storage, stronger cross-source deduplication, and vacancy re-checking.
- Add accounts, saved jobs, alerts, and application tracking.
- Add additional countries through source-specific adapters only where their terms permit.

## Security and data policy

Use only official APIs, permitted feeds, or source-approved scrapers. Respect each provider's terms and rate limits. Never commit secrets, fabricate job listings, or claim a listing is open without a recent source check.
