export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    status: 'ok',
    providers: {
      adzuna: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY && process.env.ADZUNA_COMMERCIAL_LICENSE_CONFIRMED === 'true'),
      usajobs: Boolean(process.env.USAJOBS_API_KEY && process.env.USAJOBS_USER_AGENT),
    },
  })
}
