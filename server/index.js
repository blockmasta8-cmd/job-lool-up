import http from 'node:http'
import { URL } from 'node:url'
const PORT = Number(process.env.API_PORT || 8787)
const COUNTRIES = new Set(['us', 'za'])
const COUNTRY = { us: 'United States', za: 'South Africa' }
const clean = (v, n=120) => String(v || '').trim().slice(0,n)
const salary = (a,b,c='') => a == null && b == null ? null : `${c} ${[a,b].filter(v=>v!=null).map(v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:0})).join('–')}`.trim()
function send(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))}
function normalizeAdzuna(x,country){
 const url=x.redirect_url||'', title=clean(x.title,180), postedAt=x.created||null
 if(!title||!/^https?:\/\//i.test(url))return null
 if(postedAt&&Number.isFinite(Date.parse(postedAt))&&Date.parse(postedAt)<Date.now()-45*86400000)return null
 return {id:`adzuna-${country}-${clean(x.id,100)}`,title,company:clean(x.company?.display_name)||'Employer not listed',location:clean(x.location?.display_name)||COUNTRY[country],country:COUNTRY[country],countryCode:country,type:x.contract_time==='full_time'?'Full-time':x.contract_time==='part_time'?'Part-time':'Not specified',category:clean(x.category?.label)||'General',salary:salary(x.salary_min,x.salary_max,x.salary_currency||(country==='za'?'ZAR':'USD')),postedAt,url,source:'Adzuna',sourceUrl:country==='za'?'https://www.adzuna.co.za/':'https://www.adzuna.com/'}
}
async function adzuna({country,query,location,limit}){
 const {ADZUNA_APP_ID:id,ADZUNA_APP_KEY:key}=process.env
 if(!id||!key)return {configured:false,jobs:[]}
 const p=new URLSearchParams({app_id:id,app_key:key,results_per_page:String(limit),'content-type':'application/json'})
 if(query)p.set('what',query);if(location)p.set('where',location)
 const r=await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${p}`,{signal:AbortSignal.timeout(10000)})
 if(!r.ok)throw Error(`Adzuna HTTP ${r.status}`)
 const data=await r.json();return {configured:true,jobs:(data.results||[]).map(x=>normalizeAdzuna(x,country)).filter(Boolean)}
}
async function usajobs({query,location,limit}){
 const {USAJOBS_API_KEY:key,USAJOBS_USER_AGENT:agent}=process.env
 if(!key||!agent)return {configured:false,jobs:[]}
 const p=new URLSearchParams({ResultsPerPage:String(Math.min(limit,50)),Fields:'Min',WhoMayApply:'Public'})
 if(query)p.set('Keyword',query);if(location)p.set('LocationName',location)
 const r=await fetch(`https://data.usajobs.gov/api/Search?${p}`,{headers:{Host:'data.usajobs.gov','User-Agent':agent,'Authorization-Key':key,accept:'application/json'},signal:AbortSignal.timeout(10000)})
 if(!r.ok)throw Error(`USAJOBS HTTP ${r.status}`)
 const data=await r.json()
 const jobs=(data.SearchResult?.SearchResultItems||[]).map(row=>{
  const x=row.MatchedObjectDescriptor||{},url=x.PositionURI||x.ApplyURI?.[0]||'',title=clean(x.PositionTitle,180),end=x.PositionEndDate||x.ApplicationCloseDate
  if(!title||!url.startsWith('https://')||(end&&Date.parse(end)<Date.now()))return null
  const pay=x.PositionRemuneration?.[0]
  return {id:`usajobs-${clean(row.MatchedObjectId||x.PositionID,100)}`,title,company:clean(x.OrganizationName||x.DepartmentName)||'U.S. federal agency',location:clean(x.PositionLocationDisplay)||'United States',country:'United States',countryCode:'us',type:clean(x.PositionSchedule?.map(y=>y.Name).filter(Boolean).join(', '))||'Not specified',category:clean(x.JobCategory?.map(y=>y.Name).filter(Boolean).join(', '))||'Federal government',salary:salary(pay?.MinimumRange,pay?.MaximumRange,'USD'),postedAt:x.PublicationStartDate||x.PositionStartDate||null,url,source:'USAJOBS',sourceUrl:'https://www.usajobs.gov/'}
 }).filter(Boolean)
 return {configured:true,jobs}
}
function dedupe(jobs){const seen=new Set();return jobs.filter(j=>{const k=[j.title,j.company,j.location].map(s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()).join('|');if(seen.has(k))return false;seen.add(k);return true})}
http.createServer(async(req,res)=>{
 const u=new URL(req.url||'/',`http://localhost:${PORT}`)
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed'})
 if(u.pathname==='/api/health')return send(res,200,{status:'ok',providers:{adzuna:Boolean(process.env.ADZUNA_APP_ID&&process.env.ADZUNA_APP_KEY),usajobs:Boolean(process.env.USAJOBS_API_KEY&&process.env.USAJOBS_USER_AGENT)}})
 if(u.pathname!=='/api/jobs')return send(res,404,{error:'Not found'})
 const requested=clean(u.searchParams.get('country'),2).toLowerCase(), countries=requested?[requested]:['us','za']
 if(countries.some(c=>!COUNTRIES.has(c)))return send(res,400,{error:'Supported launch countries are us and za.'})
 const query=clean(u.searchParams.get('query'),100),location=clean(u.searchParams.get('location'),100),limit=Math.max(1,Math.min(30,Number(u.searchParams.get('limit'))||15))
 const providers=[],jobs=[],errors=[]
 for(const country of countries){
  const tasks=[adzuna({country,query,location,limit}).then(x=>({name:'Adzuna',country,...x})).catch(e=>({name:'Adzuna',country,configured:true,jobs:[],error:e.message}))]
  if(country==='us')tasks.push(usajobs({query,location,limit}).then(x=>({name:'USAJOBS',country,...x})).catch(e=>({name:'USAJOBS',country,configured:true,jobs:[],error:e.message})))
  for(const x of await Promise.all(tasks)){providers.push({name:x.name,country,configured:x.configured,returned:x.jobs.length,...(x.error?{error:x.error}:{})});if(x.error)errors.push(`${x.name} (${country}): ${x.error}`);jobs.push(...x.jobs)}
 }
 const result=dedupe(jobs).sort((a,b)=>Date.parse(b.postedAt||0)-Date.parse(a.postedAt||0)).slice(0,limit*countries.length)
 return send(res,200,{jobs:result,total:result.length,providers,errors,configured:providers.some(p=>p.configured),message:result.length?null:providers.some(p=>p.configured)?'No current listings matched. Try a broader search.':'No job sources are configured yet. Add API credentials to enable live listings.'})
}).listen(PORT,'0.0.0.0',()=>console.log(`Job-Lool-Up API listening on ${PORT}`))
