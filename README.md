# Job-Lool-Up

A mobile-first global job discovery SaaS. Launch focus: United States, then South Africa, followed by other major employment markets.

## Current status

The app includes serverless search endpoints for deployment and a local Node API. Sources:
- **Jobicy**: keyless public remote-job API; recent postings, with original Jobicy listing links and attribution.
- **Remote OK**: public remote-job feed; the UI links to each original listing and credits Remote OK.
- **USAJOBS**: US federal vacancy API, activated when an API key and registered email are configured.
- **Adzuna**: US and South Africa general vacancy API, activated when credentials are configured.

The app normalizes results and deduplicates matching title/company/location records. It filters old Adzuna results older than 45 days and expired USAJOBS announcements. Keyless remote feeds provide some real listings immediately, but do not represent all vacancies in either country. The interface does not invent fallback jobs.

## Provider setup

Copy `.env.example` to `.env` for local use. Never commit `.env` or put credentials in frontend code.

- Jobicy public API: no key required. Attribution is required and its listing URL is retained. See https://jobicy.com/jobs-rss-feed.
- Remote OK: no key required; link back to each original listing and credit Remote OK. See https://remoteok.com/faq.
- USAJOBS: request an API key and use the email registered with the key: https://developer.usajobs.gov/apirequest/index.
- Adzuna: https://developer.adzuna.com/. Its terms require written agreement for ongoing commercial use after a 14-day evaluation period, and a licence for revenue-generating services. Do not enable it for a public commercial service until the licence is confirmed: https://developer.adzuna.com/docs/terms_of_service.

## Run locally

```bash
npm install
cp .env.example .env
# Add credentials only for sources you are authorized to use.
npm run dev
```

Vite serves the frontend and proxies `/api` requests to the Node API on port 8787. Check `/api/health` for configured providers. Run only the API with `npm run api`.

## API

- `GET /api/health` — provider configuration status; never returns secrets.
- `GET /api/jobs?country=us&query=engineer&location=New%20York` — US search.
- `GET /api/jobs?country=za&query=developer&location=Cape%20Town` — South Africa search.
- `GET /api/jobs?query=analyst` — searches launch countries and public remote feeds.

Supported country codes are `us` and `za`. Remote feeds only cover their own inventory and eligibility can vary by vacancy. Check the original posting before applying. Salaries are shown only when a source provides them.

## Roadmap

- Obtain commercial permission and credentials for broad US and South African listings.
- Add a scheduled refresh, persistent storage, source status rechecks, and stronger cross-source deduplication.
- Add accounts, saved jobs, alerts, and application tracking.
- Expand country-by-country using permitted APIs or feeds.

## Data policy

Use only official APIs, permitted feeds, or source-approved scrapers. Respect terms and rate limits. Never commit secrets, fabricate listings, or claim a vacancy is open without a recent source check.
