// Country metadata and remote-eligibility rules shared by the API and tests.
export const COUNTRY = {
  us: 'United States', za: 'South Africa', gb: 'United Kingdom', ca: 'Canada', au: 'Australia', de: 'Germany',
  fr: 'France', nl: 'Netherlands', nz: 'New Zealand', sg: 'Singapore', ie: 'Ireland', in: 'India',
}

export const CURRENCY = {
  us: 'USD', za: 'ZAR', gb: 'GBP', ca: 'CAD', au: 'AUD', de: 'EUR', fr: 'EUR', nl: 'EUR', nz: 'NZD', sg: 'SGD', ie: 'EUR', in: 'INR',
}

// Countries with an Adzuna index, mapped to the Adzuna site used for attribution links.
// Ireland has no Adzuna index, so it is intentionally absent.
export const ADZUNA_SITE = {
  us: 'https://www.adzuna.com/', gb: 'https://www.adzuna.co.uk/', au: 'https://www.adzuna.com.au/', ca: 'https://www.adzuna.ca/',
  de: 'https://www.adzuna.de/', fr: 'https://www.adzuna.fr/', nl: 'https://www.adzuna.nl/', nz: 'https://www.adzuna.co.nz/',
  sg: 'https://www.adzuna.sg/', in: 'https://www.adzuna.in/', za: 'https://www.adzuna.co.za/',
}
export const ADZUNA_SUPPORTED = new Set(Object.keys(ADZUNA_SITE))

// Place names are matched case-insensitively on word boundaries; short codes are case-sensitive
// so "us" in prose, "ie" in "i.e." and "CA" (California) cannot create false matches.
const NAME = {
  us: /\b(?:united states(?: of america)?|u\.s\.a?)(?![a-z])/i, za: /\bsouth africa\b/i,
  gb: /\b(?:united kingdom|great britain|england|scotland|wales|northern ireland)\b/i, ca: /\bcanada\b/i,
  au: /\baustralia\b/i, de: /\b(?:germany|deutschland)\b/i, fr: /\bfrance\b/i, nl: /\b(?:the netherlands|netherlands|holland)\b/i,
  nz: /\bnew zealand\b/i, sg: /\bsingapore\b/i, ie: /\b(?:republic of ireland|eire)\b|(?<!northern )\bireland\b/i, in: /\bindia\b/i,
}
const CODE = { us: /\b(?:US|USA)\b/, za: /\bZA\b/, gb: /\b(?:UK|GB)\b/ }
const WORLDWIDE = /\b(?:worldwide|anywhere|global(?:ly)?)\b/i
const RESTRICTED = /\b(?:excluding|excl\.?|except|outside|not available|not eligible)\b/i

export const isIn = (geo, country) => Boolean(NAME[country]?.test(geo) || CODE[country]?.test(geo))
export const detectCountry = geo => Object.keys(NAME).find(code => isIn(geo, code)) || null

/**
 * Label a remote-feed job. Remote eligibility is not the same as being physically located in a country:
 * 'country' = the posting names the country, 'worldwide' = open to anywhere, 'unspecified' = not stated.
 * With a selected country, anything else (or any exclusion wording) is rejected rather than guessed.
 */
export function tagRemote(job, country) {
  const geo = `${job.location} ${job.eligibility || ''}`
  const restricted = RESTRICTED.test(geo)
  const worldwide = WORLDWIDE.test(geo) && !restricted
  if (country) {
    if (!restricted && isIn(geo, country)) return { ...job, remoteEligibility: 'country', countryCode: country }
    if (worldwide) return { ...job, remoteEligibility: 'worldwide', countryCode: 'remote' }
    return null
  }
  if (worldwide) return { ...job, remoteEligibility: 'worldwide', countryCode: 'remote' }
  const found = restricted ? null : detectCountry(geo)
  return found
    ? { ...job, remoteEligibility: 'country', countryCode: found }
    : { ...job, remoteEligibility: 'unspecified', countryCode: 'remote' }
}
