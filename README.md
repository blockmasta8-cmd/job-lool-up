# Job-Lool-Up

A mobile-first global job discovery SaaS. Launch focus: United States, then South Africa, followed by other major employment markets.

## Current status

The app includes serverless search endpoints for deployment and a local Node API. Sources:
- **Jobicy**: keyless public remote-job API; recent postings, with original Jobicy listing links and attribution.
- **Remote OK**: public remote-job feed; the UI links to each original listing and credits Remote OK.
- **USAJOBS**: US federal vacancy API, activated when an API key and registered email are configured.
- **Adzuna**: general vacancy API for 11 of the 12 markets (US, ZA, GB, CA, AU, DE, FR, NL, NZ, SG, IN), activated when credentials are configured. Adzuna has no Ireland index, so Ireland shows remote-eligible feed listings only.

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

Country-specific search codes currently accepted by the API are `us`, `za`, `gb`, `ca`, `au`, `de`, `fr`, `nl`, `nz`, `sg`, `ie`, and `in`. The US and South Africa remain the initial launch markets; additional country-specific general listings depend on Adzuna credentials and approved commercial use. Remote feed listings are labelled by eligibility (open worldwide, country named, or not stated) and are not claimed to be physically located in the selected country; Adzuna and USAJOBS listings are labelled as located in-country. "All countries" searches local listings in the US and South Africa plus the remote feeds. Remote feeds only cover their own inventory. Check the original posting before applying. Salaries are shown only when a source provides them.

## Roadmap

- Confirm provider licensing and credentials before enabling broad commercial listings in each market.
- Add a scheduled refresh, persistent storage, source status rechecks, and stronger cross-source deduplication.
- Add accounts, saved jobs, alerts, and application tracking.
- Expand country-by-country using permitted APIs or feeds, with source-specific coverage and attribution.

## Data policy

Use only official APIs, permitted feeds, or source-approved scrapers. Respect terms and rate limits. Never commit secrets, fabricate listings, or claim a vacancy is open without a recent source check.

## Verification

- `npm test` runs offline checks (country-code consistency, false-match cases, API validation). It does not call live providers.
- `npm run verify:providers` calls the live providers for every country and prints per-provider counts; it needs outbound internet and, for Adzuna/USAJOBS, credentials in `.env`.

## Provider terms and production requirements

Terms below come from the providers' own responses where noted; confirm them against each provider's current terms before launch.

| Source | Terms (as verified or reported) | Handling in this app |
| --- | --- | --- |
| Remote OK | The API response itself requires a followed link back to the listing on Remote OK and naming Remote OK as the source; the logo may not be used. Access is suspended if not followed. | Every card links to the original `remoteok.com` URL (no `nofollow`) and shows "Remote OK"; no logo used. |
| Jobicy | Reported (third-party summaries, not verified on Jobicy's site): credit Jobicy, send apply buttons to the Jobicy job URL, at most one sync per hour, results delayed about 3 hours. | Feeds are cached for 60 minutes per upstream URL; search text and location are applied locally to the cached feed, so narrow queries only see that feed. |
| Adzuna | Needs written agreement for ongoing commercial use after the 14-day evaluation. Not enabled without credentials. | No credentials configured, so no Adzuna vacancies are returned yet. |
| USAJOBS | Requires an API key and a registered user-agent. | No credentials configured. |

Still required before a public launch: Adzuna and USAJOBS credentials and licence confirmation; a persistent store and scheduled refresh (the cache is in memory and per instance); per-IP rate limiting and restricted CORS on `/api/*` (currently open to all origins); request logging and monitoring; a hosting target that is not Vercel, Netlify or Cloudflare (the repo still contains `vercel.json`); and a local-listings source for Ireland, since Adzuna has none.
