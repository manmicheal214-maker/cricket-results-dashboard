require("dotenv").config();
const express = require("express");
const path = require("path");
const { unwrap, getMatches, getStoredMatches, getMatch, getScorecard, getSeries } = require("./src/cricket-api");
const app = express();
const PORT = process.env.PORT || 3000;
app.disable("x-powered-by");
app.use((req,res,next)=>{const origin=req.headers.origin;if(origin==="https://manmicheal214-maker.github.io"){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin");res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type")}if(req.method==="OPTIONS")return res.sendStatus(204);next()});
app.use(express.json());
app.use(express.static(path.join(__dirname,"public"),{maxAge:process.env.NODE_ENV==="production"?"1h":0}));
app.get("/api/health",(req,res)=>res.json({ok:true,service:"cricket-results-dashboard",timestamp:new Date().toISOString()}));
function matchArray(payload){const v=unwrap(payload);if(Array.isArray(v))return v;if(Array.isArray(v?.matches))return v.matches;if(Array.isArray(v?.results))return v.results;if(Array.isArray(v?.items))return v.items;return[]}
function matchId(m){return m?.id||m?.match_id||m?.matchId||m?.key||""}
function matchKey(m){const h=String(m?.home?.name||m?.homeTeam?.name||m?.team1?.name||m?.teamA?.name||m?.home||"").trim().toLowerCase(),a=String(m?.away?.name||m?.awayTeam?.name||m?.team2?.name||m?.teamB?.name||m?.away||"").trim().toLowerCase(),d=String(m?.kickoff_utc||m?.date||m?.startTime||m?.startDate||"").slice(0,10);return`${matchId(m)}|${h}|${a}|${d}`}
function merge(groups){const map=new Map();for(const m of groups.flat()){const k=matchKey(m);if(!k||k==="|||")continue;const old=map.get(k);if(!old||Object.keys(m).length>Object.keys(old).length)map.set(k,m)}return[...map.values()]}
function statusOf(m){const s=String(m?.status||m?.state||m?.matchStatus||"").trim().toLowerCase();if(["live","in_progress","progress","in play"].includes(s)||s.includes("live")||s.includes("progress"))return"live";if(["finished","finish","complete","completed","result","results","final","post","abandoned","no result"].includes(s)||s.includes("finish")||s.includes("complete")||s.includes("result")||s.includes("final"))return"completed";return"upcoming"}
function countStatuses(data){return data.reduce((a,m)=>{const s=statusOf(m);a[s]=(a[s]||0)+1;return a},{all:data.length,completed:0,live:0,upcoming:0})}
let cache={data:null,expiresAt:0};const CACHE_MS=60*1000;
app.get("/api/matches",async(req,res)=>{if(cache.data&&Date.now()<cache.expiresAt){return res.json({ok:true,data:cache.data,count:cache.data.length,statusCounts:countStatuses(cache.data),cached:true,updatedAt:new Date().toISOString()})}try{const limit=Math.min(Math.max(Number(req.query.limit)||200,1),200);const results=await Promise.allSettled([getMatches({limit}),getMatches({status:"live",limit}),getStoredMatches({status:"finished",limit})]);const groups=results.filter(r=>r.status==="fulfilled").map(r=>matchArray(r.value));const data=merge(groups);if(!data.length)throw new Error(results.filter(r=>r.status==="rejected").map(r=>r.reason?.message).filter(Boolean).join("; ")||"Cricket API returned no matches");cache={data,expiresAt:Date.now()+CACHE_MS};res.json({ok:true,data,count:data.length,statusCounts:countStatuses(data),partial:results.some(r=>r.status==="rejected"),updatedAt:new Date().toISOString()})}catch(error){console.error(error);if(cache.data)return res.json({ok:true,data:cache.data,count:cache.data.length,statusCounts:countStatuses(cache.data),cached:true,stale:true,updatedAt:new Date().toISOString()});res.status(502).json({ok:false,error:error.message})}});
app.get("/api/series",async(req,res)=>{try{const p=await getSeries();res.json({ok:true,data:unwrap(p)})}catch(e){res.status(502).json({ok:false,error:e.message})}});
app.get("/api/matches/:id",async(req,res)=>{try{const p=await getMatch(req.params.id);res.json({ok:true,data:unwrap(p)})}catch(e){res.status(502).json({ok:false,error:e.message})}});
app.get("/api/matches/:id/scorecard",async(req,res)=>{try{const p=await getScorecard(req.params.id);res.json({ok:true,data:unwrap(p)})}catch(e){res.status(502).json({ok:false,error:e.message})}});
app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`Cricket dashboard running on port ${PORT}`));
