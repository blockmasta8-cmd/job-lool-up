import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, Bookmark, BriefcaseBusiness, CheckCircle2, Globe2, MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react'

type Job = {
  id: string; title: string; company: string; location: string; country: string; countryCode: string
  type: string; category: string; salary: string | null; postedAt: string | null; url: string
  source: string; sourceUrl: string
}
type Provider = { name: string; country: string; configured: boolean; returned: number; error?: string }\ntype ApplicationStage = 'Saved' | 'Applied' | 'Interviewing' | 'Offered' | 'Rejected'\nconst applicationStages: ApplicationStage[] = ['Saved', 'Applied', 'Interviewing', 'Offered', 'Rejected']
type SearchResponse = { jobs: Job[]; total: number; providers: Provider[]; errors: string[]; configured: boolean; message: string | null }
const countries = ['All countries', 'United States', 'South Africa']
const countryCode: Record<string, string> = { 'United States': 'us', 'South Africa': 'za' }

export default function App() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState('All countries')
  const [workType, setWorkType] = useState('Any work type')
  const [savedOnly, setSavedOnly] = useState(false)\n  const [trackerMode, setTrackerMode] = useState(false)\n  const [applicationStagesByJob, setApplicationStagesByJob] = useState<Record<string, ApplicationStage>>(() => {\n    try { return JSON.parse(window.localStorage.getItem('job-lool-up:application-stages') || '{}') as Record<string, ApplicationStage> } catch { return {} }\n  })\n  useEffect(() => {\n    try { window.localStorage.setItem('job-lool-up:application-stages', JSON.stringify(applicationStagesByJob)) } catch { /* Storage can be unavailable in private browsing. */ }\n  }, [applicationStagesByJob])\n  const updateApplicationStage = (jobId: string, stage: ApplicationStage) => setApplicationStagesByJob(current => ({ ...current, [jobId]: stage }))
  const [savedJobs, setSavedJobs] = useState<Job[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('job-lool-up:saved-jobs') || '[]') as Job[] } catch { return [] }
  })
  useEffect(() => {
    try { window.localStorage.setItem('job-lool-up:saved-jobs', JSON.stringify(savedJobs)) } catch { /* Storage can be unavailable in private browsing. */ }
  }, [savedJobs])
  const toggleSaved = (job: Job) => setSavedJobs(current => current.some(saved => saved.id === job.id) ? current.filter(saved => saved.id !== job.id) : [job, ...current])
  const [jobs, setJobs] = useState<Job[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Searching connected job sources…')
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (countryCode[country]) params.set('country', countryCode[country])
        if (query.trim()) params.set('query', query.trim())
        if (location.trim()) params.set('location', location.trim())
        const response = await fetch('/api/jobs?' + params.toString(), { signal: controller.signal })
        const data = await response.json() as SearchResponse
        if (!response.ok) throw new Error((data as unknown as { error?: string }).error || 'Job search failed')
        if (!cancelled) {
          setJobs(data.jobs || [])
          setProviders(data.providers || [])
          setErrors(data.errors || [])
          setMessage(data.message || '')
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          setJobs([]); setMessage('The job search service is unavailable. Start the API server and try again.')
          setErrors([error instanceof Error ? error.message : 'Unknown error'])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 350)
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer) }
  }, [query, location, country])
  const filtered = useMemo(() => (savedOnly || trackerMode ? savedJobs : jobs).filter(job => {
    if (workType === 'Any work type') return true
    const description = job.type + ' ' + job.location
    if (workType === 'Remote') return /remote/i.test(description)
    if (workType === 'Hybrid') return /hybrid/i.test(description)
    return /on[- ]?site|in[- ]person|in[- ]office|office-based/i.test(description)
  }), [jobs, savedJobs, savedOnly, trackerMode, workType])
  const searchJobs = () => document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' })
  const configuredNames = [...new Set(providers.filter(p => p.configured && !p.error).map(p => p.name))]
  return <main>
    <nav className="nav wrap"><a className="brand" href="#top"><span className="brand-mark"><BriefcaseBusiness size={20}/></span><span>job-lool-up<span className="brand-dot">.</span></span></a><div className="nav-links"><a href="#jobs">Find jobs</a><a href="#how">How it works</a><a href="#countries">Countries</a></div><a className="nav-cta" href="#jobs">Explore jobs <ArrowRight size={16}/></a></nav>
    <section className="hero wrap" id="top"><div className="hero-copy"><div className="eyebrow"><Sparkles size={15}/> YOUR NEXT CHAPTER STARTS HERE</div><h1>Good work.<br/><span>Better possibilities.</span></h1><p className="hero-text">Find opportunities that fit your life, wherever you want to work. One search, more of the world.</p><div className="search-box"><div className="search-input"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchJobs()} placeholder="Job title, skill or keyword" aria-label="Job title, skill or keyword"/></div><button onClick={searchJobs}>Find jobs <ArrowRight size={17}/></button></div><div className="hero-meta"><span><CheckCircle2 size={15}/> Original source links</span><span><Globe2 size={15}/> US + South Africa launch</span></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="globe"><div className="globe-lines"/><div className="globe-pin"><MapPin size={27} fill="currentColor"/></div></div><div className="float-card card-top"><span className="float-icon"><BriefcaseBusiness size={18}/></span><span><b>Find your fit</b><small>Search across borders</small></span></div><div className="float-card card-bottom"><span className="pulse-dot"/><span><b>More possibilities</b><small>One search, many paths</small></span><ArrowDownRight size={18}/></div><div className="art-caption">CAREERS WITHOUT BORDERS</div></div></section>
    <section className="trust-strip"><div className="wrap trust-inner"><span>START YOUR SEARCH IN</span><b>🇺🇸 United States</b><i/><b>🇿🇦 South Africa</b><i/><span className="muted">Expanding worldwide</span></div></section>
    <section className="jobs-section wrap" id="jobs"><div className="section-heading"><div><div className="eyebrow">THE NEXT STEP</div><h2>Explore opportunities</h2><p>Live listings from connected sources, with links to the original advert.</p></div><span className="demo-label">{loading ? 'SEARCHING SOURCES…' : configuredNames.length ? (errors.length ? 'PARTIAL SOURCE RESULTS' : 'LIVE SOURCE SEARCH') : errors.length ? 'SOURCE CONNECTION ISSUE' : 'SOURCES NOT CONFIGURED'}</span></div>
      <div className="filters"><label className="filter-select"><MapPin size={17}/><select value={country} onChange={e => setCountry(e.target.value)} aria-label="Filter by country">{countries.map(c => <option key={c}>{c}</option>)}</select></label><label className="filter-select"><Search size={17}/><input value={location} onChange={e => setLocation(e.target.value)} placeholder="City or region" aria-label="Filter by location" style={{border:0,outline:0,minWidth:0,width:'100%',background:'transparent',fontSize:12}}/></label><label className="filter-select"><BriefcaseBusiness size={17}/><select value={workType} onChange={e => setWorkType(e.target.value)} aria-label="Filter by work type"><option>Any work type</option><option>Remote</option><option>Hybrid</option><option>On-site</option></select></label><button className={'saved-toggle' + (savedOnly ? ' active' : '')} onClick={() => { setSavedOnly(value => !value); setTrackerMode(false) }} aria-pressed={savedOnly}><Bookmark size={14}/>{savedOnly ? 'All jobs' : 'Saved jobs'} ({savedJobs.length})</button><button className={'saved-toggle' + (trackerMode ? ' active' : '')} onClick={() => { setTrackerMode(value => !value); setSavedOnly(false) }} aria-pressed={trackerMode}>Application tracker</button><span className="result-count">{filtered.length} listings</span></div>
      {configuredNames.length > 0 && <p className="source-line">Connected: {configuredNames.join(' · ')}</p>}
      <div className="job-grid">{filtered.map(job => <article className="job-card" key={job.id}><div className="job-card-top"><span className="company-logo">{job.company.slice(0,2).toUpperCase()}</span><div className="job-card-actions"><span className="preview-pill">{job.source}</span><button className={'save-job' + (savedJobs.some(saved => saved.id === job.id) ? ' saved' : '')} onClick={() => toggleSaved(job)} aria-label={(savedJobs.some(saved => saved.id === job.id) ? 'Remove saved job ' : 'Save job ') + job.title} title={savedJobs.some(saved => saved.id === job.id) ? 'Remove saved job' : 'Save job'}><Bookmark size={16} fill={savedJobs.some(saved => saved.id === job.id) ? 'currentColor' : 'none'}/></button></div></div><h3>{job.title}</h3><p className="company">{job.company}</p><div className="job-tags"><span>{job.type}</span><span>{job.category}</span></div><div className="job-location"><MapPin size={15}/>{job.location} · {job.country}</div>{trackerMode && savedJobs.some(saved => saved.id === job.id) && <label className="application-stage">Application status<select aria-label={'Application status for ' + job.title} value={applicationStagesByJob[job.id] || 'Saved'} onChange={event => updateApplicationStage(job.id, event.target.value as ApplicationStage)}>{applicationStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}</select></label>}<div className="job-card-bottom"><span>{job.salary || 'Salary not provided'}</span><a href={job.url} target="_blank" rel="noreferrer" aria-label={'Open original listing for ' + job.title}>Apply <ArrowRight size={15}/></a></div>{job.source === 'Adzuna' ? <div className="source-credit"><a className="adzuna-credit" href={job.sourceUrl} target="_blank" rel="noreferrer">Adzuna</a>{job.postedAt ? ' · Posted ' + new Date(job.postedAt).toLocaleDateString() : ''}</div> : <div className="source-credit">Source: <a href={job.sourceUrl} target="_blank" rel="noreferrer">{job.source}</a>{job.postedAt ? ' · Posted ' + new Date(job.postedAt).toLocaleDateString() : ''}</div>}</article>)}</div>
      {!filtered.length && <div className="empty-state"><ShieldCheck size={24}/><h3>{loading && !savedOnly ? 'Finding current vacancies…' : savedOnly ? 'No saved jobs yet' : 'No live listings to show'}</h3><p>{savedOnly ? 'Save a job with the bookmark icon and it will appear here on this device.' : message || 'Try another keyword, location, or country.'}</p>{!loading && providers.length > 0 && <p>Source setup: {providers.map(p => p.name + (p.error ? ' unavailable' : p.configured ? ' connected' : ' needs credentials')).join(' · ')}</p>}</div>}
      {errors.length > 0 && <p className="source-line">Some sources reported an issue: {errors.join(' · ')}</p>}
      <div className="notice"><ShieldCheck size={20}/><p><b>Honest by design.</b> Only source-returned vacancies are displayed. Listings are deduplicated, old Adzuna results are filtered, and each card links to the original source. Always confirm the vacancy is still open before applying.</p></div></section>
    <section className="how-section" id="how"><div className="wrap"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>A clearer path to your next role.</h2><div className="steps"><article><span>01</span><Search/><h3>Search your way</h3><p>Use skills, role names, location and work preferences to narrow your search.</p></article><article><span>02</span><Globe2/><h3>Explore the world</h3><p>Compare opportunities across countries, with local context as we expand.</p></article><article><span>03</span><ShieldCheck/><h3>Apply with confidence</h3><p>See where a listing came from and follow the original application link.</p></article></div></div></section>
    <section className="countries-section wrap" id="countries"><div><div className="eyebrow">START LOCAL. THINK GLOBAL.</div><h2>One platform.<br/>A world of work.</h2><p>We’re building country by country, starting with the United States and South Africa. More markets will follow as reliable sources are added.</p></div><div className="country-list">{[['🇺🇸','United States','Launch focus'],['🇿🇦','South Africa','Launch focus'],['🇬🇧','United Kingdom','Planned'],['🇨🇦','Canada','Planned'],['🇦🇺','Australia','Planned'],['🇩🇪','Germany','Planned']].map(([flag,name,status])=><div className="country-row" key={name}><span className="country-flag">{flag}</span><b>{name}</b><span className={status==='Launch focus'?'status-focus':'status-planned'}>{status}</span></div>)}</div></section>
    <footer><div className="wrap footer-inner"><a className="brand" href="#top"><span className="brand-mark"><BriefcaseBusiness size={18}/></span><span>job-lool-up<span className="brand-dot">.</span></span></a><span>Discover what’s next. Wherever you are.</span><span>© {new Date().getFullYear()} Job-Lool-Up</span></div></footer>
  </main>
}
