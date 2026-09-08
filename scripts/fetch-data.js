const fs=require("fs"),path=require("path");
const BASE_URL="https://api.bigballsdata.com/v1/cricket";
const RECENT_DAYS=30;
const extractMatches=p=>{const c=[p?.data,p?.data?.matches,p?.data?.results,p?.data?.items,p?.matches,p?.results,p?.items];return c.find(Array.isArray)||[]};
const text=v=>String(v??"").trim(),teamName=t=>typeof t==="string"?text(t):text(t?.name||t?.teamName||t?.short_name||t?.shortName),home=m=>m?.home||m?.homeTeam||m?.team1||m?.teamA,away=m=>m?.away||m?.awayTeam||m?.team2||m?.teamB,competition=m=>text(m?.league||m?.seriesName||m?.series||m?.competition||m?.tournament||"Other"),kickoff=m=>m?.kickoff_utc||m?.date||m?.startTime||m?.startDate||"";
const normalize=v=>text(v).toLowerCase().replace(/\s+/g," ");
const STATUS={live:"live",in_progress:"live",ongoing:"live",progress:"live","in play":"live",scheduled:"upcoming",not_started:"upcoming",pre:"upcoming",upcoming:"upcoming",finished:"completed",finish:"completed",complete:"completed",completed:"completed",result:"completed",results:"completed",final:"completed",ft:"completed",post:"completed",abandoned:"completed","no result":"completed"};
function statusOf(m){const s=normalize(m?.status||m?.state||m?.matchStatus||m?.match_state);return STATUS[s]||(s.includes("live")||s.includes("progress")||s.includes("ongoing")||s.includes("in play")?"live":s.includes("complete")||s.includes("result")||s.includes("finish")||s.includes("final")||s==="ft"?"completed":"upcoming")}
function fixtureKey(m){const d=kickoff(m),x=new Date(d),day=d?(Number.isNaN(x.getTime())?normalize(d).slice(0,10):x.toISOString().slice(0,10)):"";return`${normalize(teamName(home(m)))}|${normalize(teamName(away(m)))}|${day}|${normalize(competition(m))}`}
function quality(m){return(statusOf(m)==="live"?300:statusOf(m)==="completed"?200:100)+(m.score||m.scores||m.linescore?10:0)+Object.keys(m||{}).length}
function dedupe(a){const out=new Map;for(const m of a){const k=fixtureKey(m);if(!k||k.startsWith("team|team|"))continue;if(!out.has(k)||quality(m)>quality(out.get(k)))out.set(k,m)}return[...out.values()]}
async function apiRequest(p,key){const r=await fetch(`${BASE_URL}${p}`,{headers:{Accept:"application/json","x-api-key":key}}),t=await r.text();let j;try{j=t?JSON.parse(t):{}}catch{throw Error(`Cricket API returned non-JSON (${r.status})`)}if(!r.ok)throw Error(String(j?.error?.message||j?.error||j?.message||`Cricket API returned ${r.status}`));return j}
function unwrap(p){return p?.data??p}function inningsCount(d){const r=d?.data??d;return Array.isArray(r?.innings)?r.innings.length:0}
function isoDate(daysAgo){const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-daysAgo);return d.toISOString().slice(0,10)}
async function fetchScorecards(matches,key){const dir=path.join(__dirname,"..","public","data","scorecards");fs.mkdirSync(dir,{recursive:true});const index={},candidates=matches.filter(m=>statusOf(m)==="live"||statusOf(m)==="completed").sort((a,b)=>(new Date(kickoff(b)).getTime()||0)-(new Date(kickoff(a)).getTime()||0)).slice(0,20);let cursor=0;async function worker(){while(cursor<candidates.length){const m=candidates[cursor++],id=m?.id||m?.match_id||m?.matchId||m?.key;if(!id)continue;try{const data=unwrap(await apiRequest(`/matches/${encodeURIComponent(String(id))}/scorecard`,key)),count=inningsCount(data),updatedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,`${encodeURIComponent(String(id))}.json`),JSON.stringify({ok:count>0,id,data,inningsCount:count,updatedAt},null,2)+"\n");index[id]={available:count>0,inningsCount:count,updatedAt}}catch(e){index[id]={available:false,inningsCount:0,error:e.message,updatedAt:new Date().toISOString()}}}}await Promise.all([worker(),worker(),worker()]);fs.writeFileSync(path.join(dir,"index.json"),JSON.stringify({updatedAt:new Date().toISOString(),matches:index},null,2)+"\n")}
async function main(){const key=process.env.BBS_API_KEY;if(!key)throw Error("BBS_API_KEY is required");
  const requests=[apiRequest("/matches?limit=200",key)];
  for(let i=0;i<RECENT_DAYS;i++) requests.push(apiRequest(`/matches?date=${isoDate(i)}&limit=200`,key));
  const results=await Promise.allSettled(requests);
  const groups=results.filter(r=>r.status==="fulfilled").map(r=>extractMatches(r.value));
  const matches=dedupe(groups.flat());
  if(!matches.length){const errors=results.filter(r=>r.status==="rejected").map(r=>r.reason?.message).filter(Boolean);throw Error(errors.join("; ")||"Cricket API returned zero usable matches; refusing to publish an empty snapshot")}
  const counts=matches.reduce((a,m)=>(a[statusOf(m)]=(a[statusOf(m)]||0)+1,a),{});
  const output={ok:true,updatedAt:new Date().toISOString(),sourceCounts:{requests:results.length,succeeded:results.filter(r=>r.status==="fulfilled").length,failed:results.filter(r=>r.status==="rejected").length},count:matches.length,statusCounts:counts,data:matches};
  const out=path.join(__dirname,"..","public","data","matches.json");fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(output,null,2)+"\n");
  if(process.env.FETCH_SCORECARDS!=="false")await fetchScorecards(matches,key);
  console.log(`Published ${matches.length} unique cricket matches: completed=${counts.completed||0}, live=${counts.live||0}, upcoming=${counts.upcoming||0}`)
}
main().catch(e=>{console.error(e);process.exit(1)})
