# Job-Lool-Up

A mobile-first global job discovery SaaS. Country filters cover 27 major markets, with worldwide remote feeds and direct links to official job portals. Listing coverage varies by country and source.

## Current status

The app includes a React search interface and a Node.js API. The same Node.js service can serve the built frontend and the API, without tying the project to a serverless hosting platform. Sources:
- **Jobicy**: keyless public remote-job API; recent postings, with original Jobicy listing links and attribution.
- **Remote OK**: public remote-job feed; the UI links to each original listing and credits Remote OK.
- **Arbeitnow**: public job-board API feeds for Germany, the United Kingdom, France, Switzerland and the Netherlands. Original posting links and source attribution are retained; feed snapshots are cached for six hours to limit repeat requests.
- **USAJOBS**: US federal vacancy API, activated when an API key and registered email are configured.
- **Adzuna**: API supports a subset of the country filters. It remains disabled unless credentials are configured and `ADZUNA_COMMERCIAL_LICENSE_CONFIRMED=true` is explicitly set.

The app normalizes results and deduplicates matching title/company/location records. It filters old Adzuna results older than 45 days and expired USAJOBS announcements. Keyless remote feeds provide some real listings immediately, but do not represent all vacancies in either country. The interface does not invent fallback jobs.

## Provider setup

Copy `.env.example` to `.env` for local use. Never commit `.env` or put credentials in frontend code.

- Jobicy public API: no key required. Attribution is required and its listing URL is retained. See https://jobicy.com/jobs-rss-feed.
- Remote OK: no key required; link back to each original listing and credit Remote OK. See https://remoteok.com/faq.
- Arbeitnow: no key required for its public feed; retain the original listing link and credit Arbeitnow. API access is provided as-is and can be revoked. See https://www.arbeitnow.com/terms and https://blog.arbeitnow.com/blog/job-board-api.
- Adzuna: do not add credentials or set the licence-confirmation flag for commercial use until written permission is in place. See https://developer.adzuna.com/docs/terms_of_service.
- USAJOBS: request an API key and use the email registered with the key: https://developer.usajobs.gov/apirequest/index.
- Adzuna: https://developer.adzuna.com/. Its terms require written agreement for ongoing commercial use after a 14-day evaluation period, and a licence for revenue-generating services. Do not enable it for a public commercial service until the licence is confirmed: https://developer.adzuna.com/docs/terms_of_service.

## Run locally

```bash
npm install
cp .env.example .env
# Add credentials only for sources you are authorized to use.
npm run dev
```

Requires Node.js 22.12 or newer. Vite serves the frontend during development and proxies `/api` requests to the Node API on port 8787. Check `/api/health` for configured providers. Run only the API with `npm run api`.

## Build and run as a single Node.js service

This project can run on any suitable Node.js host or your own server; it is not tied to a specific hosting provider.

```bash
npm ci
npm run build
npm start
```

The service listens on `PORT` when supplied by the host, otherwise `API_PORT`, then port 8787. Build the frontend before starting the production service.

## API

- `GET /api/health` — provider configuration status; never returns secrets.
- `GET /api/jobs?country=us&query=engineer&location=New%20York` — US search.
- `GET /api/jobs?country=za&query=developer&location=Cape%20Town` — South Africa search.
- `GET /api/jobs?query=analyst` — searches launch countries and public remote feeds.

Supported country filters include `us`, `za`, `gb`, `ca`, `au`, `nz`, `de`, `fr`, `nl`, `ie`, `sg`, `jp`, `kr`, `ae`, `ch`, `se`, `no`, `dk`, `in`, `es`, `it`, `br`, `mx`, `at`, `be`, `pl`, and `pt`. With **All countries** selected, the API searches every market supported by the licensed Adzuna integration, the five country-specific Arbeitnow feeds, and the global remote feeds. For countries without a dedicated connected feed, individual country searches only show global-feed listings where the source indicates that country or worldwide eligibility. Official vacancy-board links provide additional search routes. This is global country selection, not a claim that every country has comprehensive live aggregation. Remote feeds only cover their own inventory and eligibility can vary by vacancy. Check the original posting before applying. Salaries are shown only when a source provides them.

## Quality checks

```bash
npm run build
npm test
```

GitHub Actions runs these checks for branch pushes and pull requests.

## Roadmap

- Obtain commercial permission and credentials for broad US and South African listings.
- Add scheduled refresh, persistent storage, user accounts and cross-device sync, job alerts, and stronger cross-source deduplication.
- Continue integrating permitted country-specific APIs and feeds, prioritizing broad commercial coverage for the US and South Africa.

## Data policy

Use only official APIs, permitted feeds, or source-approved scrapers. Respect terms and rate limits. Never commit secrets, fabricate listings, or claim a vacancy is open without a recent source check.
