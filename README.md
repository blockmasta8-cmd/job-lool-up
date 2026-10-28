# Job-Lool-Up

A mobile-first global job discovery SaaS. Launch focus: United States, then South Africa, followed by other major employment markets.

## Product direction
- Search jobs by keyword, country, location, work arrangement, and job type.
- Source-transparent listings with links to original employer/application pages.
- Deduplication and stale-listing detection.
- Saved jobs, alerts, and application tracking as later milestones.
- Country-aware currencies and salary display.
- Collect listings only from permitted public APIs, employer career pages, and feeds; respect source terms, rate limits, and robots directives where applicable.

## Status
Initial project setup. No live job-source integrations are configured yet; listings must not be represented as live until a real source is integrated and verified.

## Run locally

```bash
npm install
npm run dev
```

## Current implementation
The initial UI is responsive and includes keyword filtering, country/work-type filters, product direction, and explicit sample-data labeling. The cards are placeholders, not real job postings. API ingestion, authentication, persistence, alerts, and deployment are not implemented yet.
