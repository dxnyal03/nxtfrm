/* NXTFRM V99. Additive extension: existing records, storage keys and cloud envelope stay compatible. */
"use strict";
/* Shared chart theme. Every chart in NXTFRM draws from this so they read as
   one instrument; it mirrors the --nxt-chart-* CSS tokens. Phase 5's dual
   weight graph builds on these values rather than new literals. */
const CHART = {
  ink: "#b49aff",           // primary series (trend)
  inkSecondary: "#7f74a8",  // supporting series
  raw: "#8b8499",           // recorded readings
  grid: "#e8e2f5",          // gridlines, drawn at low opacity
  gridOpacity: ".055",
  axisText: "#8b8499",
  axisSize: 13,
  cursor: "#b49aff",
  active: "#f2eff7",
  activeRing: "#0f0e14",    // matches --nxt-background so the dot reads as cut out
  line: 2.5,
  lineForecast: 2,
  point: 3,
  pointActive: 5.5,
  bandOpacity: ".10",
  areaOpacity: ".16",
  label: "#f2eff7"
};

const NXT = (() => {
  const DAY = 86400000;
  const copy = value => JSON.parse(JSON.stringify(value));
  const old = { renderHistory, renderFloorball, apx96MoreSectionHTML, getT, readiness,
    getFullBackup, applyCloudPayload, apx96OpenQueueManager, openEditSet, closeModal };
  const exercise = (name, sets, lo, hi, inc = 2.5) => ({name, sets, reps:[lo, hi], inc});
  const defaults = {
    FullA:[exercise("Incline Dumbbell Press",3,8,12),exercise("Chest Supported T-Bar Row",3,8,12),exercise("Leg Press",3,8,12,5),exercise("Hamstring Curl",2,10,15),exercise("Cable Lateral Raise",2,12,20,1),exercise("Ab Crunch",2,12,20)],
    FullB:[exercise("Romanian Deadlift",3,8,10,5),exercise("Lat Pulldown",3,8,12),exercise("Smith Machine Bench Press",3,8,12),exercise("Leg Extension",2,10,15),exercise("Reverse Fly",2,12,20,1),exercise("DB Preacher Curl",2,10,15,1)],
    FullC:[exercise("Leg Press",2,10,15,5),exercise("Machine Shoulder Press",2,8,12),exercise("Unilateral Seated Row",3,8,12),exercise("Hamstring Curl",2,10,15),exercise("Tricep Pushdown",2,10,15),exercise("Ab Crunch",2,12,20)]
  };
  const split = {0:"Rest",1:"FullA",2:"Zone2",3:"FullB",4:"Zone2",5:"FullC",6:"Zone2"};
  const names = {FullA:"Full Body A",FullB:"Full Body B",FullC:"Full Body C",Push:"Push",Pull:"Pull",Pump:"Legs",Legs:"Legs",Zone2:"Easy cardio",Rest:"Rest",Floorball:"Floorball"};
  /* D33: one legs session. The plain "Legs" type is folded into Pump (shown as "Legs"); it stays in names only so old records still label. */
  const typeNames = () => Object.keys(names).filter(k=>k!=="Legs");
  const ui = {view:"overview", range:30, showGoal:false, showPost:false, showForecast:false, selected:null, draft:null, lastFocus:null};
  function cfg() {
    if(!settings.cutSupport || typeof settings.cutSupport!=="object" || Array.isArray(settings.cutSupport))settings.cutSupport={};
    const c=settings.cutSupport;
    for(const key of ["profile","templates","sessions","sessionTargets","recovery","adherence"])if(!c[key]||typeof c[key]!=="object"||Array.isArray(c[key]))c[key]={};
    if(!Array.isArray(c.waist))c.waist=[];
    if(!Array.isArray(c.suggestions))c.suggestions=[];
    if(!Array.isArray(c.tdeeHistory))c.tdeeHistory=[];
    return c;
  }
  function finite(v) { return v!==""&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null; }
  function dateMs(d) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d)))return NaN;
    const ms=Date.parse(d+"T12:00:00Z");
    return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===d?ms:NaN;
  }
  function dateAdd(d,n) { return new Date(dateMs(d)+n*DAY).toISOString().slice(0,10); }
  function weekStart(d=state.date) { return dateAdd(d,-((new Date(dateMs(d)).getUTCDay()+6)%7)); }
  function shortDate(d) { return new Date(dateMs(d)).toLocaleDateString("en-SG",{day:"numeric",month:"short",timeZone:"UTC"}); }
  function label(t) { return names[t]||t||"Workout"; }
  function cleanRows(input,key="weight") {
    const byDate=new Map();
    for(const r of Array.isArray(input)?input:[]) {
      if(!r||!Number.isFinite(dateMs(r.date))||r.date>state.date)continue;
      const v=finite(r[key]);
      if(v===null||v<=0||(key==="weight"&&(v<20||v>400))||(key==="cm"&&(v<30||v>250)))continue;
      /* D14 — a canonical weight is a Morning weigh-in, or a row that never
         recorded a timing (the pre-timing weigh-in). Any other recorded timing
         is contextual and is skipped, so a date with no morning reading stays
         absent. Waist rows are not filtered here. The two lines below still
         choose among the rows that remain eligible. */
      if(key==="weight"){
        const timing=String(r.timeOfDay||"").trim().toLowerCase();
        if(timing&&timing!=="morning")continue;
      }
      const prior=byDate.get(r.date),morning=String(r.timeOfDay||"").toLowerCase()==="morning";
      if(!prior||morning||String(prior.timeOfDay||"").toLowerCase()!=="morning")byDate.set(r.date,{...r,[key]:v});
    }
    return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function weights() { return cleanRows(state.bws); }
  /* Chart-only view over the raw weigh-ins. cleanRows() collapses each date to a
     single canonical row (morning preferred) and is what every trend, forecast
     and cut calculation reads; this instead keeps one row per date for ONE
     timing, so a second series can be drawn without touching that contract.
     Nothing here writes: state.bws is read and left exactly as stored. */
  function timingRows(timing,input=state.bws) {
    const want=String(timing||'').toLowerCase(),byDate=new Map();
    for(const r of Array.isArray(input)?input:[]) {
      if(!r||!Number.isFinite(dateMs(r.date))||r.date>state.date)continue;
      if(String(r.timeOfDay||'').toLowerCase()!==want)continue;
      const v=finite(r.weight);
      if(v===null||v<20||v>400)continue;
      const prior=byDate.get(r.date);
      /* "Latest" follows the order contract the rest of the app uses: the stored
         ts when both rows carry one, otherwise later insertion wins. */
      if(!prior||finite(r.ts)===null||finite(prior.ts)===null||Number(r.ts)>=Number(prior.ts))byDate.set(r.date,{...r,weight:v});
    }
    return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function windowStats(rows,end=state.date,days=7,key="weight") {
    const start=dateAdd(end,1-days),items=rows.filter(r=>r.date>=start&&r.date<=end);
    return {items,n:items.length,avg:items.length?items.reduce((s,r)=>s+r[key],0)/items.length:null};
  }
  const EWMA_HALF_LIFE=7,EWMA_ALPHA=1-Math.exp(-Math.log(2)/EWMA_HALF_LIFE),EWMA_GAP_DAYS=3;
  function ewmaTrend(rows=weights()) {
    const ordered=(Array.isArray(rows)?rows:[]).filter(r=>r&&finite(r.weight)!==null&&Number.isFinite(dateMs(r.date))).sort((a,b)=>a.date.localeCompare(b.date));
    const out=[];let avg=null,prev=null,contributing=0;
    for(const r of ordered) {
      const weight=finite(r.weight);
      // A long gap makes the carried average stale, so restart from the new reading.
      if(avg===null||(dateMs(r.date)-dateMs(prev))/DAY>EWMA_GAP_DAYS){avg=weight;contributing=1;}
      else {avg=avg+EWMA_ALPHA*(weight-avg);contributing++;}
      prev=r.date;
      out.push({...r,weight,avg,trendReady:contributing>=3});
    }
    return out;
  }
  function trend(rows=weights()) {
    return ewmaTrend(rows).map(r=>({...r,avg:r.trendReady?r.avg:null,coverage:windowStats(rows,r.date).n}));
  }
  const BAND_K=1,BAND_WINDOW_DAYS=14,BAND_MIN_READINGS=7;
  function trendConfidence(rows=weights()) {
    const series=ewmaTrend(rows);
    if(series.length<BAND_MIN_READINGS)return null;
    const out=[];
    for(const point of series) {
      const start=dateAdd(point.date,1-BAND_WINDOW_DAYS);
      const window=series.filter(r=>r.date>=start&&r.date<=point.date);
      if(window.length<BAND_MIN_READINGS)continue;
      const residuals=window.map(r=>r.weight-r.avg),mean=residuals.reduce((s,v)=>s+v,0)/residuals.length;
      // Clamped at zero so floating-point error can never reach Math.sqrt as a negative.
      const sigma=Math.sqrt(Math.max(0,residuals.reduce((s,v)=>s+(v-mean)**2,0)/(residuals.length-1)));
      out.push({date:point.date,avg:point.avg,sigma,n:window.length,lower:point.avg-BAND_K*sigma,upper:point.avg+BAND_K*sigma});
    }
    return out.length?out:null;
  }
  // Ordinary least squares over {x,y} points. Deliberately dumb: callers own their own guards,
  // including the sxx>0 check that keeps slope finite.
  function lsFit(points) {
    const n=points.length;
    const xbar=points.reduce((s,p)=>s+p.x,0)/n,ybar=points.reduce((s,p)=>s+p.y,0)/n;
    const sxx=points.reduce((s,p)=>s+(p.x-xbar)**2,0);
    const slope=points.reduce((s,p)=>s+(p.x-xbar)*(p.y-ybar),0)/sxx;
    const intercept=ybar-slope*xbar;
    const sse=points.reduce((s,p)=>s+(p.y-(intercept+slope*p.x))**2,0);
    return {slope,intercept,sse,se_slope:Math.sqrt(Math.max(0,sse/(n-2)/sxx)),n,sxx,xbar};
  }
  const FORECAST_WINDOW_DAYS=21,FORECAST_MIN_POINTS=3,FORECAST_TRUST_POINTS=10,FORECAST_MAX_WEEKS=104,FORECAST_SLOPE_FLOOR=-.02,FORECAST_SIGMA_FALLBACK=.5;
  function forecastGoal(rows=weights()) {
    const base={ok:false,weeks:null,lowWeeks:null,highWeeks:null,confidence:"none",reason:"",slope:null,lastDate:null,lastAvg:null,fittedLevel:null};
    const series=ewmaTrend(rows).filter(r=>r.trendReady);
    if(!series.length)return {...base,reason:"Log a few more weigh-ins before a forecast can be made."};
    const last=series.at(-1),lastDate=last.date,lastAvg=last.avg;
    const target=typeof goalHigh==="function"?finite(goalHigh()):null;
    if(target===null)return {...base,lastDate,lastAvg,reason:"Set your goal range to see a forecast."};
    if(lastAvg<=target)return {ok:true,weeks:0,lowWeeks:0,highWeeks:0,confidence:"high",reason:"Already at goal range",slope:0,lastDate,lastAvg,fittedLevel:null};
    const start=dateAdd(lastDate,1-FORECAST_WINDOW_DAYS),window=series.filter(r=>r.date>=start&&r.date<=lastDate);
    const thin={...base,lastDate,lastAvg,reason:"Not enough weigh-ins in the last three weeks to read a direction."};
    if(window.length<FORECAST_MIN_POINTS)return thin;
    // Fitted to raw readings, not the EWMA: smoothed points are autocorrelated, which would
    // shrink se_slope well below the real uncertainty and fake a precise horizon.
    const fit=lsFit(window.map(r=>({x:(dateMs(r.date)-dateMs(start))/DAY,y:r.weight}))),n=fit.n;
    if(!(fit.sxx>0))return thin;
    const slope=fit.slope;
    if(!(slope<FORECAST_SLOPE_FLOOR))return {...base,slope,lastDate,lastAvg,reason:"Trend isn't moving toward goal yet."};
    const se=fit.se_slope;
    // Two independent unknowns feed the estimate: where the trend sits today, and how fast it is moving.
    const band=trendConfidence(rows),here=band?band.find(b=>b.date===lastDate)||band.at(-1):null;
    // Too few readings for a band leaves the level unmeasured, not certain, so a nominal spread stands in.
    const sigmaLevel=here&&finite(here.sigma)!==null?here.sigma:FORECAST_SIGMA_FALLBACK;
    // Level and slope are read off the same raw fit. An EWMA trails a moving trend by roughly its
    // mean observation age, about ten days at a seven-day half-life, which would pad the horizon.
    const fittedLevel=fit.intercept+fit.slope*((dateMs(lastDate)-dateMs(start))/DAY);
    const gap=fittedLevel-target,days=gap/-slope;
    // The fitted level leads the EWMA, so arrival can register here before lastAvg has caught up.
    // Without this the negative gap would round back up into a bogus one-week horizon.
    if(!(gap>0))return {ok:true,weeks:0,lowWeeks:0,highWeeks:0,confidence:"high",reason:"Already at goal range",slope,lastDate,lastAvg,fittedLevel};
    const sigmaDays=Math.sqrt(Math.max(0,(sigmaLevel/slope)**2+gap**2*se**2/slope**4));
    const rawWeeks=days/7,rawLow=Math.max(1,(days-sigmaDays)/7),rawHigh=(days+sigmaDays)/7;
    // A near-flat slope can push the horizon past any useful date, so every bound is capped.
    const cap=v=>Math.min(FORECAST_MAX_WEEKS,Math.max(0,Math.round(v)));
    const lowWeeks=Math.max(1,cap(rawLow)),weeks=Math.max(lowWeeks,cap(rawWeeks));
    const highWeeks=Math.max(weeks,cap(rawHigh));
    // Whole-week rounding quantizes the span, so the ratio is taken before it.
    const spanRatio=rawWeeks>0?(rawHigh-rawLow)/rawWeeks:Infinity;
    const confidence=n<FORECAST_TRUST_POINTS||spanRatio>2?"low":spanRatio>.5?"medium":"high";
    return {ok:true,weeks,lowWeeks,highWeeks,confidence,reason:"",slope,lastDate,lastAvg,fittedLevel};
  }
  const PLATEAU_WINDOW_DAYS=28,PLATEAU_MIN_READINGS=10,PLATEAU_MIN_SPAN_DAYS=14,PLATEAU_FLAT_KG_WEEK=.15,PLATEAU_T=2;
  const PLATEAU_LADDER=[35,42,49,56,63,70,77,84,90],PLATEAU_LADDER_SLACK=7;
  // One equivalence test over the trailing `days` of raw readings, or null when the window is too thin.
  // Raw rather than EWMA: smoothed points are autocorrelated, so their se_slope would fake precision.
  function plateauWindow(rows,end,days) {
    const items=windowStats(rows,end,days).items;
    if(items.length<PLATEAU_MIN_READINGS)return null;
    const ms=items.map(r=>dateMs(r.date)),first=Math.min(...ms),span=(Math.max(...ms)-first)/DAY;
    if(!(span>=PLATEAU_MIN_SPAN_DAYS))return null;
    const fit=lsFit(items.map(r=>({x:(dateMs(r.date)-first)/DAY,y:r.weight})));
    if(!(fit.sxx>0)||!Number.isFinite(fit.se_slope))return null;
    const weeklyRate=fit.slope*7,half=PLATEAU_T*fit.se_slope*7,lower=weeklyRate-half,upper=weeklyRate+half;
    // An equivalence test, not a test against zero: the whole interval has to sit inside the flat
    // band to call a plateau, so noisy data lands on "undetermined" instead of a false positive.
    const status=upper < -PLATEAU_FLAT_KG_WEEK?"losing":lower > PLATEAU_FLAT_KG_WEEK?"gaining":
      lower > -PLATEAU_FLAT_KG_WEEK&&upper < PLATEAU_FLAT_KG_WEEK?"flat":"undetermined";
    return {n:items.length,span:Math.round(span),weeklyRate,half,lower,upper,status};
  }
  function detectPlateau(rows=weights()) {
    const base={ok:false,plateau:false,status:"undetermined",weeklyRate:null,lower:null,upper:null,
      n:0,windowDays:PLATEAU_WINDOW_DAYS,spanDays:0,plateauDays:null,lastDate:null,lastAvg:null,confidence:"none",reason:""};
    const last=ewmaTrend(rows).filter(r=>r.trendReady).at(-1);
    const head={...base,lastDate:last?last.date:null,lastAvg:last?last.avg:null};
    const w=plateauWindow(rows,state.date,PLATEAU_WINDOW_DAYS);
    if(!w)return {...head,n:windowStats(rows,state.date,PLATEAU_WINDOW_DAYS).n,
      reason:`Four weeks with at least ${PLATEAU_MIN_READINGS} weigh-ins are needed before a plateau can be identified.`};
    let plateauDays=null;
    if(w.status==="flat") {
      // Walk the ladder upward and stop at the first window that is no longer flat. Seven-day
      // resolution on purpose: "about six weeks" is honest where "43 days" is false precision.
      plateauDays=PLATEAU_WINDOW_DAYS;
      for(const days of PLATEAU_LADDER) {
        const step=plateauWindow(rows,state.date,days);
        // The readings must actually reach back into the longer window. Without this the same four
        // weeks of data keep passing every rung and claim a plateau older than the record itself.
        if(!step||step.status!=="flat"||step.span<days-PLATEAU_LADDER_SLACK)break;
        plateauDays=days;
      }
    }
    const confidence=w.half<PLATEAU_FLAT_KG_WEEK/2?"high":w.half<PLATEAU_FLAT_KG_WEEK?"medium":"low";
    const weeks=plateauDays===null?0:Math.round(plateauDays/7);
    const reason=w.status==="flat"?`Your weight trend has been level for about ${weeks} week${weeks===1?"":"s"}. Food intake is not logged, so the app cannot identify the cause.`:
      w.status==="losing"?"Your weight is still trending down, so this is not a plateau.":
      w.status==="gaining"?"Your weight trend is moving up rather than levelling off.":
      "Your readings vary too much over four weeks to separate a plateau from normal fluctuation. Keep logging.";
    return {...head,ok:true,plateau:w.status==="flat",status:w.status,weeklyRate:w.weeklyRate,
      lower:w.lower,upper:w.upper,n:w.n,windowDays:PLATEAU_WINDOW_DAYS,spanDays:w.span,plateauDays,confidence,reason};
  }
  function trendStats(rows=weights()) {
    const current=windowStats(rows),previous=windowStats(rows,dateAdd(state.date,-7)),earlier=windowStats(rows,dateAdd(state.date,-14));
    const change=current.n>=3&&previous.n>=3?current.avg-previous.avg:null;
    const priorChange=previous.n>=3&&earlier.n>=3?previous.avg-earlier.avg:null;
    return {current,previous,earlier,change,priorChange,percent:change!==null?change/previous.avg*100:null};
  }
  function workRows() {
    return (Array.isArray(state.logs)?state.logs:[]).filter(r=>r&&r.setType!=="warmup"&&Number.isFinite(dateMs(r.date))&&r.date<=state.date&&finite(r.weight)!==null&&Number(r.weight)>=0&&finite(r.reps)>0&&Number.isInteger(Number(r.reps)));
  }
  function sessionRows(ex,gym=state.gym,before=state.date,maxReps=15) {
    const groups=new Map();
    for(const r of workRows()) {
      if((r.exercise||r.name)!==ex||(r.gym||"Gym A")!==gym||r.date>=before||r.reps>maxReps||Number(r.weight)<=0)continue;
      if(!groups.has(r.date))groups.set(r.date,[]);
      groups.get(r.date).push(r);
    }
    return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,sets])=>({date,sets:sets.sort((a,b)=>Number(a.setNum)-Number(b.setNum)),value:Math.max(...sets.map(r=>Number(r.weight)*(1+Number(r.reps)/30)))}));
  }
  function strengthItems() {
    const keys=new Map();
    workRows().forEach(r=>keys.set(JSON.stringify([r.exercise||r.name,r.gym||"Gym A"]),[r.exercise||r.name,r.gym||"Gym A"]));
    return [...keys.values()].map(([name,gym])=>{
      const all=sessionRows(name,gym,dateAdd(state.date,1)),recent=all.slice(-4),last=all.at(-1);
      let delta=null,status="Building data",tone="neutral";
      const fresh=!!last&&last.date>=dateAdd(state.date,-21);
      if(recent.length>=4&&fresh&&recent[0].date>=dateAdd(state.date,-56)) {
        const baseline=(recent[0].value+recent[1].value)/2;
        delta=(((recent[2].value+recent[3].value)/2)/baseline-1)*100;
        const sustained=recent[2].value<baseline*.95&&recent[3].value<baseline*.95;
        status=sustained?"Review":delta>=2?"Improving":delta>=-5?"Holding steady":"Watch";
        tone=sustained?"watch":delta>=-5?"good":"neutral";
      } else if(!fresh&&all.length)status="Older history";
      return {name,family:name,gym,sessions:all.length,latestDate:last?.date||"",latestE1rm:last?.value||0,delta,status,tone,history:all};
    }).sort((a,b)=>b.latestDate.localeCompare(a.latestDate)).slice(0,24);
  }
  function review() {
    const rows=weights(),s=trendStats(rows),lifts=strengthItems(),waist=cleanRows(cfg().waist,"cm"),check=cfg().recovery[state.date];
    const base={tone:"neutral",title:"Building your baseline",message:"Log morning weights across two weeks. Each weekly average needs at least three readings.",action:"Keep logging",reason:`${s.current.n} readings this week · ${s.previous.n} last week`,change:s.change};
    if(detectPlateau().plateau===true) {
      const d=NXT.diagnose();
      if(d.ok&&d.verdict!=="insufficient_context") {
        const waistDown=waist.length>=2&&waist.at(-1).date>=dateAdd(state.date,-14)&&waist.at(-1).cm<waist.at(-2).cm-.5;
        const stall=waistDown?"Scale averages are fairly flat, while your recent waist measurement is lower. Keep measuring consistently before changing the plan.":"Recent weekly averages are fairly flat. Check consistency, measurement conditions and recovery. Food intake is not logged, so the app cannot identify the cause or calculate your deficit.";
        return {...base,title:d.headline,message:stall,tone:base.tone};
      }
    }
    if(check&&(Number(check.energy)<=2&&check.energy!==""||Number(check.soreness)>=4))return {...base,title:"Give recovery some attention",message:"Your check-in suggests low energy or high soreness. Consider a shorter session or rest, and review how you feel before adding work.",action:"Review recovery",reason:"Based on today’s check-in",tone:"watch"};
    if(lifts.filter(x=>x.status==="Review").length>=2)return {...base,title:"Review your training load",message:"Several comparable lifts are down across repeated sessions. Check recovery and technique before changing calories or adding cardio.",action:"Review recovery",reason:"Repeated declines in two or more lifts",tone:"watch"};
    // One rate drives both the headline and the evidence chip on Today: the four-week trend when
    // it is available (it ignores a single noisy week), otherwise the week-on-week change.
    const pl=detectPlateau(rows),rate=pl.ok&&finite(pl.weeklyRate)!==null?pl.weeklyRate:s.change;
    if(rate===null)return base;
    const ref=(pl.ok&&finite(pl.lastAvg)!==null?pl.lastAvg:s.previous.avg)||s.current.avg,pct=ref?rate/ref*100:s.percent;
    const kg=v=>(v>0?"+":"")+v.toFixed(2)+" kg/wk";
    const fresh=lifts.filter(x=>x.delta!==null),holding=fresh.filter(x=>x.status==="Improving"||x.status==="Holding steady").length;
    const slipping=fresh.some(x=>x.status==="Watch"||x.status==="Review");
    const strengthLine=fresh.length?`${holding} of ${fresh.length} tracked lift${fresh.length===1?" is":"s are"} holding or improving.`:"Strength history is still building, so muscle retention is not yet assessable.";
    const fc=forecastGoal(rows),eta=fc.ok&&fc.weeks>0?` At this pace your goal range is about ${fc.weeks} week${fc.weeks===1?"":"s"} away.`:"";
    const why=`${kg(rate)} over ${pl.ok?"four weeks":"the last week"} · ${Math.abs(pct).toFixed(1)}% of body weight`;
    if(pct < -1)return {...base,title:slipping?"Losing fast, and lifts are slipping":"Losing quickly",message:slipping?"Weight is dropping faster than usual while some lifts are down. Consider easing the deficit before strength suffers; this is a review prompt, not a diagnosis.":"Check energy, hunger and strength before pushing further. "+strengthLine+" Early water changes can contribute; this is a review prompt, not a diagnosis.",action:"Review your target",reason:why,change:rate,tone:"watch"};
    const c=cfg(),target=c.targetConfirmed?{low:goalLow(),high:goalHigh()}:null;
    if(target&&s.current.avg!==null&&s.previous.avg!==null&&s.current.avg>=target.low&&s.current.avg<=target.high&&s.previous.avg>=target.low&&s.previous.avg<=target.high)return {...base,title:"Your trend is in your goal range",message:"Two weekly averages are within your chosen range. Consider maintaining if you are happy with your progress; nothing changes automatically.",action:"Review your goal",reason:why,change:rate,tone:"good"};
    if(rate<-PLATEAU_FLAT_KG_WEEK)return {...base,title:slipping?"Losing steadily, watch your lifts":holding&&holding===fresh.length?"Cutting steadily, strength holding":"Cutting steadily",message:(slipping?"Weight is moving at a comfortable pace, but some lifts are down. Keep an eye on recovery. ":"Keep your current plan if energy feels manageable. ")+strengthLine+eta,action:slipping?"Review recovery":"Stay consistent",reason:why,change:rate,tone:slipping?"watch":"good"};
    if(rate>PLATEAU_FLAT_KG_WEEK&&(pl.status==="gaining"||(s.change!==null&&s.change>.15&&s.priorChange!==null&&s.priorChange>0)))return {...base,title:"Your weight is trending up",message:"The recent trend is rising, not flat. Check measurement conditions and consistency before changing anything; food intake is not logged, so the app cannot name the cause.",action:"Review consistency",reason:why,change:rate,tone:"watch"};
    if(s.change!==null&&Math.abs(s.change)<.2&&s.priorChange!==null&&Math.abs(s.priorChange)<.2) {
      const waistDown=waist.length>=2&&waist.at(-1).date>=dateAdd(state.date,-14)&&waist.at(-1).cm<waist.at(-2).cm-.5;
      return {...base,title:waistDown?"Look beyond the scale":"Time for a small review",message:waistDown?"Scale averages are fairly flat, while your recent waist measurement is lower. Keep measuring consistently before changing the plan.":"Recent weekly averages are fairly flat. Check consistency, measurement conditions and recovery. Food intake is not logged, so the app cannot identify the cause or calculate your deficit.",action:waistDown?"Keep observing":"Review your plan",tone:"neutral"};
    }
    return {...base,title:"Let the trend settle",message:"One week is not enough to identify a plateau or explain a gain. Keep the plan consistent and reassess with more readings.",action:"Hold steady"};
  }
  function estimate(p) {
    const age=finite(p.age),height=finite(p.height),weight=finite(p.weight),activity=finite(p.activity);
    if(age===null||height===null||weight===null||activity===null||!["male","female"].includes(p.sex))return {error:"Complete your profile to calculate a starting estimate."};
    if(age<18||age>80||height<130||height>220||weight<40||weight>250||![1.2,1.375,1.55,1.725].includes(activity))return {error:"Check your profile values. This adult estimate supports ages 18–80; outside that range, use personalised professional guidance."};
    if(p.eligible!==true)return {error:"Confirm the suitability statement before using this estimate."};
    if(weight/((height/100)**2)<18.5)return {error:"The app will not recommend a cut at this weight and height. Discuss a suitable goal with a qualified clinician."};
    const resting=10*weight+6.25*height-5*age+(p.sex==="male"?5:-161),maintenance=Math.round(resting*activity/50)*50;
    const target=Math.round(maintenance*.85/50)*50;
    if(target<(p.sex==="male"?1500:1200))return {error:"This calculation produces a low-energy target. Get personalised guidance instead of using an automatic cut target."};
    return {resting,maintenance,target};
  }
  const ADHERENCE_FACTORS = {yes:1, close:.95, no:.85, over:1.1};
  function adherenceIn(start,end) {
    const rows=[],map=cfg().adherence;
    for(const date of Object.keys(map)) {
      const row=map[date];
      if(!row||ADHERENCE_FACTORS[row.status]===undefined||!Number.isFinite(dateMs(date)))continue;
      if(date<start||date>end)continue;
      rows.push({date,status:row.status});
    }
    return rows.sort((a,b)=>a.date.localeCompare(b.date));
  }
  function formulaTDEE() {
    // A saved TDEE is the user's own figure, so it outranks the profile calculation.
    const saved=finite(settings.tdee);
    if(saved!==null&&saved>0)return saved;
    const estimated=finite(cfg().maintenanceEstimate);
    if(estimated!==null)return estimated;
    return finite(typeof USER_TDEE==="undefined"?null:USER_TDEE);
  }
  function adaptiveTDEE(windowDays=14) {
    const requested=finite(windowDays);
    const base={ok:false,reason:"",tdee:null,intake:null,daysLogged:0,weightChange:null,windowDays:14,confidence:"none",coverage:0,weighIns:0,spanDays:0};
    let days=requested!==null&&requested>=7?Math.round(requested):14;
    let start=dateAdd(state.date,1-days),logged=adherenceIn(start,state.date);
    // Sparse logging widens the window once rather than reporting nothing.
    if(logged.length<10&&days<21) {days=21;start=dateAdd(state.date,1-days);logged=adherenceIn(start,state.date);}
    const rows=weights().filter(r=>r.date>=start&&r.date<=state.date);
    Object.assign(base,{windowDays:days,daysLogged:logged.length,weighIns:rows.length,coverage:Math.min(1,logged.length/days)});
    const target=finite(cfg().calories);
    if(target===null||target<=0)return {...base,reason:"Save your daily calorie target first. Your real TDEE is measured against it."};
    if(logged.length<10)return {...base,reason:`Log adherence for ${10-logged.length} more day${10-logged.length===1?"":"s"} to see your real TDEE.`};
    if(rows.length<5)return {...base,reason:`Add ${5-rows.length} more weigh-in${5-rows.length===1?"":"s"} to see your real TDEE.`};
    // Endpoints are EWMA trend values with a 7-day half-life, so daily water swings do not move the result.
    const series=trend(weights()).filter(r=>r.date>=start&&r.date<=state.date&&r.avg!==null);
    const first=series[0],last=series.at(-1);
    const span=first&&last?Math.round((dateMs(last.date)-dateMs(first.date))/DAY):0;
    if(!Number.isFinite(span)||span<7)return {...base,reason:"Your weigh-ins need to span at least a week before a trend can be measured."};
    const weightChange=last.avg-first.avg;
    const intake=logged.reduce((sum,r)=>sum+target*ADHERENCE_FACTORS[r.status],0)/logged.length;
    const tdee=Math.round((intake-weightChange*7700/span)/10)*10;
    if(!Number.isFinite(tdee)||tdee<1000||tdee>5000)return {...base,reason:"Your intake and weight trend disagree too much to trust an estimate yet. Keep logging."};
    const confidence=logged.length>=12&&rows.length>=8&&base.coverage>=.9?"high":logged.length>=10&&rows.length>=6?"medium":"low";
    return {...base,ok:true,tdee,intake:Math.round(intake),weightChange:Math.round(weightChange*100)/100,confidence,spanDays:span};
  }
  function diagnose() {
    const p=detectPlateau(),f=forecastGoal(),at=adaptiveTDEE();
    const days=p.plateauDays||p.windowDays||PLATEAU_WINDOW_DAYS;
    const end=state.date,start=dateAdd(end,1-days);
    const map=cfg().adherence;let adhSum=0,adhLogged=0,adhDays=0;
    for(let d=start;d<=end;d=dateAdd(d,1)) {
      adhDays++;
      const factor=map[d]?ADHERENCE_FACTORS[map[d].status]:undefined;
      if(factor!==undefined){adhSum+=factor;adhLogged++;}
    }
    const adhMean=adhDays?adhSum/adhDays:0;
    const waistRows=cleanRows(cfg().waist,"cm").filter(r=>r.date>=start&&r.date<=end);
    const waistDrop=waistRows.length>=2?waistRows[0].cm-waistRows.at(-1).cm:null;
    const lifts=strengthItems().filter(x=>x.delta!==null&&x.delta<=-8);
    const recScore=r=>{
      const s=Number(r.sleep),e=Number(r.energy||3),sore=Number(r.soreness||2);
      let score=78;
      if(s)score+=Math.min(10,Math.max(-18,(s-6.5)*7));
      score+=(e-3)*6;score-=Math.max(0,sore-2)*8;
      return Math.max(35,Math.min(96,Math.round(score)));
    };
    const rec=cfg().recovery;let lowReady=0;
    for(let d=start;d<=end;d=dateAdd(d,1)) {
      const r=rec[d];
      if(!r||[r.sleep,r.energy,r.soreness].every(v=>v===""||v===undefined||v===null))continue;
      if(recScore(r)<60)lowReady++;
    }
    const hist=(cfg().tdeeHistory||[]).filter(r=>r&&Number.isFinite(dateMs(r.date))&&r.date>=start&&r.date<=end&&finite(r.tdee)!==null)
      .slice().sort((a,b)=>a.date.localeCompare(b.date));
    const tdeeNow=at.ok?at.tdee:(hist.at(-1)?hist.at(-1).tdee:null);
    const tdeeThen=hist[0]?hist[0].tdee:null;
    const tdeeDrop=tdeeThen!==null&&tdeeNow!==null?tdeeThen-tdeeNow:null;
    const pct=v=>Math.round(v*100),kcal=n=>Number(n).toLocaleString("en-SG");
    const rate=p.weeklyRate===null?"—":`${p.weeklyRate>0?"+":p.weeklyRate<0?"-":""}${Math.abs(p.weeklyRate).toFixed(2)} kg / week · ${p.spanDays||days} days`;
    const rateTone=!p.ok||p.status==="undetermined"?"neutral":p.status==="losing"?"good":"watch";
    const adhValue=`Logged: ${adhLogged} of ${adhDays} days · ${pct(adhMean)}% weighted`;
    const adhTone=adhLogged===0?"neutral":adhMean>=.85?"good":"watch";
    const plateauValue=p.plateau?`${p.plateauDays} days`:!p.ok||p.status==="undetermined"?"Undetermined":"No plateau detected";
    const plateauTone=p.plateau?"watch":p.status==="losing"?"good":"neutral";
    const base=[
      {label:"Weight trend",value:rate,tone:rateTone},
      {label:"Adherence",value:adhValue,tone:adhTone},
      {label:"Plateau",value:plateauValue,tone:plateauTone}
    ];
    const rank=complete=>{
      if(!p.ok||p.confidence==="low"||p.confidence==="none")return complete?"medium":"low";
      if(p.confidence==="high"&&complete)return "high";
      return "medium";
    };
    const pack=(verdict,headline,extra,actions,confidence,reason)=>({
      ok:true,verdict,headline,evidence:base.concat(extra).slice(0,4),actions,confidence,reason
    });
    const gap=()=>{
      if(!p.ok)return {what:"weigh-ins",need:Math.max(1,PLATEAU_MIN_READINGS-p.n)};
      if(adhLogged<10)return {what:"adherence",need:10-adhLogged};
      if(waistRows.length<2)return {what:"waist",need:Math.max(1,2-waistRows.length)};
      if((hist.length<2&&!(hist.length>=1&&at.ok&&hist[0].date!==state.date)))return {what:"TDEE snapshots",need:Math.max(1,2-hist.length)};
      if(lifts.length<2&&lowReady<5)return {what:"recovery check-ins",need:Math.max(1,5-lowReady)};
      return {what:"weigh-ins",need:7};
    };
    if(!p.plateau&&f.ok&&finite(f.slope)!==null&&f.slope<0) {
      const extra=[{label:"Forecast",value:f.weeks===0?"At goal range":`~${f.weeks} week${f.weeks===1?"":"s"} to goal`,tone:"good"}];
      const conf=f.confidence==="high"&&p.ok&&p.confidence==="high"?"high":f.confidence==="low"||!p.ok?"low":"medium";
      return pack("no_issue","Cut is progressing.",extra,[{text:"Keep the current plan.",kind:"hold"}],conf,"Weight is still trending down.");
    }
    if(p.plateau&&adhMean<.85) {
      return pack("dietary_drift",`No weight change, but adherence is ${pct(adhMean)}%. This looks like compliance, not metabolism.`,
        [],[{text:"Tighten adherence before changing calories.",kind:"adjust"}],
        rank(adhDays>=14),"Adherence is below 85% over the plateau window.");
    }
    if(p.plateau&&waistDrop!==null&&waistDrop>.5&&adhMean>=.85) {
      return pack("water_masking","Scale is flat, but waist is shrinking. This may not be a real plateau.",
        [{label:"Waist",value:`−${waistDrop.toFixed(1)} cm over ${days} days`,tone:"good"}],
        [{text:"Keep measuring waist; don’t cut calories yet.",kind:"hold"}],
        rank(waistRows.length>=2),"Waist dropped while adherence held.");
    }
    if(p.plateau&&(lifts.length>=2||lowReady>=5)) {
      const extra=[];
      if(lifts.length)extra.push({label:"Strength",value:lifts.slice(0,2).map(x=>`${x.name} ${x.delta.toFixed(1)}%`).join(" · "),tone:"watch"});
      if(lowReady)extra.push({label:"Readiness",value:`Below 60 on ${lowReady} day${lowReady===1?"":"s"}`,tone:"watch"});
      return pack("recovery_deficit","Strength or recovery is slipping. This looks like load, not metabolism.",extra,
        [{text:"Deload or sleep more before cutting further.",kind:"hold"}],
        rank(lifts.length>=2||lowReady>=5),
        lifts.length>=2?"Two or more lifts dropped at least 8%.":"Readiness stayed below 60 for at least five days.");
    }
    if(p.plateau&&adhMean>=.85&&tdeeDrop!==null&&tdeeDrop>=150) {
      return pack("metabolic_adaptation","Likely metabolic adaptation, not a real plateau.",
        [{label:"TDEE",value:`${kcal(tdeeThen)} → ${kcal(tdeeNow)} kcal`,tone:"watch"}],
        [{text:"A small calorie adjustment may be warranted.",kind:"adjust"}],
        rank(hist.length>=2||(hist.length>=1&&at.ok&&hist[0].date!==state.date)),
        `Adaptive TDEE fell ${Math.round(tdeeDrop)} kcal over the plateau window.`);
    }
    const need=gap();
    const headline=p.plateau
      ?`Plateau confirmed. Not enough context to name the cause — keep logging ${need.what} for ${need.need} more day${need.need===1?"":"s"}.`
      :`Not enough context to name the cause — keep logging ${need.what} for ${need.need} more day${need.need===1?"":"s"}.`;
    return pack("insufficient_context",headline,
      [{label:"Needed",value:`${need.what} · ${need.need} more day${need.need===1?"":"s"}`,tone:"neutral"}],
      [{text:`Keep logging ${need.what} for ${need.need} more day${need.need===1?"":"s"}.`,kind:"diagnose_more"}],
      p.plateau&&p.confidence==="high"?"medium":"low",
      p.plateau?"Plateau confirmed, but no cause matched strictly.":p.reason||"Not enough data to diagnose.");
  }
  function maybeSnapshotTDEE(replaceToday=false) {
    const c=cfg(),at=c.tdeeHistory.findIndex(r=>r&&r.date===state.date);
    if(at>-1&&!replaceToday)return false;
    const r=adaptiveTDEE();
    if(!r.ok)return false;
    const row={date:state.date,tdee:r.tdee,intake:r.intake,weightChange:r.weightChange,windowDays:r.windowDays,confidence:r.confidence};
    if(at>-1)c.tdeeHistory[at]=row;else c.tdeeHistory.push(row);
    if(c.tdeeHistory.length>180)c.tdeeHistory.splice(0,c.tdeeHistory.length-180);
    try{persist();}catch(e){}
    return true;
  }
  function tdeeCardHTML() {
    const r=adaptiveTDEE(),formula=formulaTDEE(),kcal=n=>Number(n).toLocaleString("en-SG");
    if(!r.ok)return card("Your real TDEE",`<p>${r.reason}</p><div class="n99-stats">${metric("Adherence logged",r.daysLogged+`<small> / ${r.windowDays} days</small>`)}${metric("Formula estimate",formula===null?"—":kcal(formula)+"<small> kcal</small>","From your profile")}</div>`);
    const diff=formula===null?null:r.tdee-formula,weekly=r.weightChange/r.spanDays*7;
    const names={high:"High",medium:"Medium",low:"Low"};
    const signedKcal=n=>(n>0?"+":n<0?"-":"")+kcal(Math.abs(Math.round(n)));
    return card("Your real TDEE",`<div class="n99-big">${kcal(r.tdee)}<small> kcal / day</small></div>
      <p class="n99-small">${names[r.confidence]} confidence · ${r.daysLogged} of ${r.windowDays} days logged</p>
      <div class="n99-measurements">
        <div class="n99-list-row"><span>Estimated</span><small>${formula===null?"—":kcal(formula)+" kcal · formula"}</small></div>
        <div class="n99-list-row"><span>Adaptive</span><small>${kcal(r.tdee)} kcal · your data</small></div>
        <div class="n99-list-row"><span>Difference</span><small>${diff===null?"—":signedKcal(diff)+" kcal / day"}</small></div>
      </div>
      <p>Weight trending ${(weekly>0?"+":"")+weekly.toFixed(1)} kg / week, eating about ${kcal(r.intake)} kcal a day.</p>`);
  }
  function cardioWeek() { return (state.cardio||[]).filter(r=>r&&r.date>=weekStart()&&r.date<=state.date&&finite(r.duration)>0).reduce((s,r)=>s+Number(r.duration),0); }
  function completedWeek() { return new Set(workRows().filter(r=>r.date>=weekStart()).map(r=>r.date)).size; }
  /* Delegates to index.html's resolveDayType so dated overrides, the weekly plan
     and the built-in split are read in one order everywhere. The local fallback
     keeps this module usable if it is ever loaded on its own. */
  function typeFor(d) {
    if(typeof resolveDayType==="function")return resolveDayType(d);
    return settings.dayOverrides?.[d]||settings.weeklyPlan?.[new Date(dateMs(d)).getUTCDay()]||"Rest";
  }
  function templateFor(type=state.dayType,gym=state.gym) {
    const saved=cfg().templates[gym+"__"+type];
    return NXT.validTemplate?.(saved)?saved:TEMPLATES[type]||[];
  }
  function targetFor(ex) { return cfg().sessionTargets[sessionKey()]?.find?.(x=>x.name===ex)||templateFor().find(x=>x.name===ex)||old.getT(ex)||exercise(ex,3,8,12); }
  function done(ex) { return workRows().filter(r=>r.date===state.date&&(r.gym||"Gym A")===state.gym&&(r.exercise||r.name)===ex).length; }
  function planDone() { return !!cfg().sessions[sessionKey()]?.finished; }
  function suggestionAction(label) {
    if(/increase/i.test(label||""))return "increase";
    if(/baseline/i.test(label||""))return "baseline";
    return "hold";
  }
  function logSuggestion(entry) {
    const c=cfg();
    const row={
      id:typeof uid==="function"?uid():Math.random().toString(36).slice(2,10),
      date:state.date,
      kind:entry.kind,
      subject:entry.subject==null?null:entry.subject,
      payload:entry.payload||{},
      followed:null,
      ts:Date.now()
    };
    const last=c.suggestions.at(-1);
    if(last&&last.date===row.date&&last.kind===row.kind&&last.subject===row.subject&&JSON.stringify(last.payload)===JSON.stringify(row.payload))return;
    c.suggestions.push(row);
    if(c.suggestions.length>1000)c.suggestions.splice(0,c.suggestions.length-1000);
    try{persist();}catch(e){}
  }
  function logAdherence(status) {
    if(!["yes","close","no","over"].includes(status))return;
    cfg().adherence[state.date]={status,ts:Date.now()};
    try{persist();}catch(e){toast("Could not save on this device.");return;}
    repaint();
  }
  function adherenceHTML() {
    const row=cfg().adherence[state.date];
    const labels={yes:"Hit target",close:"Close (~10%)",no:"Missed",over:"Way over"};
    if(row&&row.status)return `<p class="n99-small">Today’s calories: ${labels[row.status]||row.status}</p>`;
    return `<div class="n99-quick" role="group" aria-label="Calorie adherence">${button("Hit target",'NXT.logAdherence("yes")',true)}${button("Close",'NXT.logAdherence("close")',true)}${button("Missed",'NXT.logAdherence("no")',true)}${button("Way over",'NXT.logAdherence("over")',true)}</div>`;
  }
  /* D20 — a session is judged by its best working set: the heaviest load, and
     at that load the most reps. The first set of a session is often a
     ramp-up, so it understated what was actually lifted. */
  function bestSet(sets) {
    let best=null;
    for(const r of sets||[]) {
      const w=Number(r&&r.weight),n=Number(r&&r.reps);
      if(!Number.isFinite(w)||!Number.isFinite(n))continue;
      if(!best||w>Number(best.weight)||(w===Number(best.weight)&&n>Number(best.reps)))best=r;
    }
    return best;
  }
  /* What "beating last time" means for the next working set, derived from the
     same double-progression rule cue() applies: add a rep at the best load until
     the top of the range, then the load moves up only once cue() says so. */
  /* D25: expected reps at a heavier load, from the lifter's own best set (Epley, the
     usual rep-max relation). It only sets the target reps for a load increase, is
     clamped to the exercise's rep range, and is never stored or shown as a 1RM. */
  function repsAt(best,newWeight,t) {
    const w=Number(best.weight),n=Number(best.reps);
    if(!(newWeight>w)||!(w>0))return n;
    const r=Math.round(30*(w*(1+n/30)/newWeight-1));
    return Math.max(t.reps[0],Math.min(t.reps[1],r));
  }
  function aimFor(ex) {
    const t=targetFor(ex),all=sessionRows(ex,state.gym,state.date,100),last=all.at(-1);
    if(!last)return null;
    const best=bestSet(last.sets);if(!best)return null;
    const c=cue(ex),w=Number(best.weight),n=Number(best.reps);
    if(c.label==="Ease back in")return {best,date:last.date,weight:Number(c.weight),reps:Math.min(n,t.reps[1]),kind:"reentry",why:c.why||""};
    if(Number(c.weight)>w)return {best,date:last.date,weight:Number(c.weight),reps:repsAt(best,Number(c.weight),t),kind:"load"};
    if(n<t.reps[1])return {best,date:last.date,weight:w,reps:n+1,kind:"rep",why:c.why||""};
    return {best,date:last.date,weight:w,reps:n,kind:"match",why:c.why||""};
  }
  /* D25: the coach. Deterministic copy written from the lifter's own history (no model call,
     nothing stored): one headline, one concise note with the real numbers, and a target for
     each planned set that mirrors how the sets fell off last time. */
  function coachFor(ex) {
    const t=targetFor(ex),all=sessionRows(ex,state.gym,state.date,100),last=all.at(-1);
    const lo=t.reps[0],hi=t.reps[1],planned=Math.max(1,Number(t.sets)||1),num=v=>String(Math.round(Number(v)*100)/100);
    if(!last)return {kind:"new",headline:"First session on this lift",note:`Choose a load you can move for ${lo}–${hi} reps with about two to spare. Today sets your baseline.`,sets:[]};
    const best=bestSet(last.sets);if(!best)return null;
    const w=Number(best.weight),n=Number(best.reps),gap=Math.round((dateMs(state.date)-dateMs(last.date))/864e5);
    if(gap>28)return {kind:"baseline",headline:`Back after ${gap} days`,note:"Your last session is over four weeks old. Pick a manageable load and re-establish your baseline.",sets:[],gap};
    const c=cue(ex),a=aimFor(ex);if(!a)return null;
    const step=Number(t.inc)>0?Number(t.inc):2.5,backoff=Math.max(step,+(Math.round(w*0.9/step)*step).toFixed(2));
    /* How the sets fell off last time at the best load (reps below the best set), padded for planned sets. */
    const shape=last.sets.filter(r=>Number(r.weight)===w).map(r=>Number(r.reps)),top=Math.max(...shape,n);
    const known=shape.map(r=>top-r);
    const drops=Array.from({length:planned},(_,k)=>k<known.length?known[k]:known.length>1?known[known.length-1]:k);
    const sets=drops.map((d,k)=>({n:k+1,weight:a.weight,reps:Math.max(1,a.reps-d)}));
    const prev=all.at(-2),pb=prev&&bestSet(prev.sets);
    const imp=(x,y)=>Number(y.weight)>Number(x.weight)||(Number(y.weight)===Number(x.weight)&&Number(y.reps)>Number(x.reps));
    const three=all.slice(-3).map(x=>bestSet(x.sets)),stalled=three.length===3&&three.every(Boolean)&&!imp(three[0],three[1])&&!imp(three[1],three[2])&&all.at(-3).date>=dateAdd(state.date,-28);
    const lighter=!!pb&&imp(best,pb);
    const out=(kind,headline,note)=>({kind,headline,note,sets,weight:a.weight,reps:a.reps,gap});
    if(a.kind==="load"){
      const steps=Math.round((a.weight-w)/step);
      return out("load",`Add ${num(a.weight-w)} kg`,
        (n>hi?`${num(w)} × ${n} ${steps>1?`is ${n-hi} over the top of your ${lo}–${hi} range, so take two steps`:`cleared your ${lo}–${hi} range`}.`:`You topped your ${lo}–${hi} range twice at ${num(w)}.`)+` Target ${num(a.weight)} × ${a.reps}.`);
    }
    if(a.kind==="reentry")return out("reentry","Ease back in",`${gap} days off. Re-enter at ${num(a.weight)} (about 90% of ${num(w)}) for ${a.reps} reps.`);
    if(c.label==="Keep today manageable")return out("tired","Keep it manageable",`Check-in says tired. Aim ${num(a.weight)} × ${a.reps}, stopping a rep or two short.`);
    if(stalled&&Number(t.inc)>0)return out("stall","Same best set three times",`Best set flat for three sessions. Repeat ${num(w)} × ${n}, or drop to ${num(backoff)} and rebuild.`);
    if(a.why==="No kg step set")return out("hold","Add a weight step",`Range topped, but this lift has no kg step. Set one in the routine editor.`);
    if(a.why==="Low reserve · hold")return out("hold","Keep a rep in hand","Last time was close to failure. Repeat the load with a couple in hand before adding weight.");
    if(a.why==="Top once · repeat to add")return out("hold","Confirm the top",`${num(w)} × ${n} tops your range. Hit it once more and the weight goes up.`);
    if(a.kind==="rep"&&n<lo)return out("rebuild","Rebuild the reps",`${num(w)} × ${n} was under ${lo}. Stay at ${num(w)} and build to ${lo}+.`);
    if(a.kind==="rep")return out("rep","One more rep",(lighter?"One lighter session is not a trend. ":"")+`${num(w)} × ${n} last time. Target ${num(a.weight)} × ${a.reps}.`);
    return out("hold","Match your best",`Repeat ${num(w)} × ${n}. Holding strength on a cut counts.`);
  }
  function cue(ex) {
    const t=targetFor(ex),all=sessionRows(ex,state.gym,state.date,100),last=all.at(-1),prev=all.at(-2);
    let out;
    if(!last)out={label:"Set your baseline",weight:0,text:"Choose a manageable load and leave around two reps in reserve. Your first session establishes the baseline."};
    else {
      const weight=Number(bestSet(last.sets).weight),recent=last.date>=dateAdd(state.date,-28);
      const gapDays=Math.round((dateMs(state.date)-dateMs(last.date))/864e5);
      if(!recent)out={label:"Re-establish your baseline",weight:0,text:"This exercise history is over four weeks old. Choose a manageable starting load for today."};
      else if(gapDays>14){
        /* D25: after two to four weeks away, re-enter lighter (about 90%, on the lift's own step). */
        const stp=Number(targetFor(ex).inc)>0?Number(targetFor(ex).inc):2.5;
        out={label:"Ease back in",weight:Math.max(stp,+(Math.round(weight*0.9/stp)*stp).toFixed(2)),why:"Ease back in",text:`It has been ${gapDays} days. Re-enter lighter, then build back up.`};
      }
      else {
        /* Top-set double progression (D20): a session "tops out" when its best
           set, at this load, reached the top of the rep range. */
        const top=s=>{const b=s&&bestSet(s.sets);return !!b&&Number(b.weight)===weight&&Number(b.reps)>=t.reps[1];};
        /* D24: going past the top of the range is proof on its own; exactly reaching it still needs a second session. */
        const over=s=>{const b=s&&bestSet(s.sets);return !!b&&Number(b.weight)===weight&&Number(b.reps)>t.reps[1];};
        const effortOkay=last.sets.every(r=>r.rir===null||r.rir===undefined||r.rir===""||Number(r.rir)>=2);
        const r=cfg().recovery[state.date],tired=r&&(Number(r.energy)<=2&&r.energy!==""||Number(r.soreness)>=4);
        const earned=top(last)&&(top(prev)||over(last)),step=Number(t.inc)>0;
        if(!tired&&earned&&effortOkay&&step)out={label:"Ready to consider an increase",weight:weight+Number(t.inc)*(Number(bestSet(last.sets).reps)>=t.reps[1]+3?2:1),text:over(last)&&!top(prev)?"You went past the top of the rep range last time. Use the next increment only if today’s warm-up feels controlled.":"You reached the top of the rep range in two sessions. Use the next increment only if today’s warm-up feels controlled."};
        else {
          const lb=bestSet(last.sets),lowReps=lb&&Number(lb.reps)<t.reps[0];
          const why=tired?"Tired today · hold":earned&&!effortOkay?"Low reserve · hold":earned&&!step?"No kg step set":top(last)?"Top once · repeat to add":lowReps?`Under ${t.reps[0]} · rebuild`:"";
          out={label:tired?"Keep today manageable":"Hold load · build clean reps",weight,why,text:tired?"Your check-in suggests fatigue. Keep the session manageable; use the shorter option if needed.":"Match your recent load within the rep range. Maintaining performance while cutting counts; an increase is optional."};
        }
      }
    }
    logSuggestion({kind:"progression",subject:ex||null,payload:{weight:out.weight,label:out.label,action:suggestionAction(out.label)}});
    return out;
  }
  /* Recovery copy before a risky edit. If the first write fails (typically a full
     device quota, because the copy is a second full backup), the previous copy is the
     only thing that can be freed, so it is dropped and the write retried; the old copy
     is put back if that also fails. The reason is kept in N.snapshotIssue so callers
     can say why instead of guessing. opts.quiet skips the toast for callers that ask. */
  function snapshotFail(stage,e,opts) {
    let used=0;try{used=Object.keys(localStorage).reduce((a,k)=>a+k.length+(localStorage.getItem(k)||"").length,0);}catch(_){}
    const full=/quota/i.test(String(e&&e.name)+" "+String(e&&e.message));
    snapshot.issue={stage,name:e&&e.name||"Error",full,usedKB:Math.round(used/1024)};
    if(!(opts&&opts.quiet))toast("Could not make a safety copy"+(full?" (device storage is full)":"")+". Export a backup before continuing.");
    return false;
  }
  function snapshot(reason,opts) {
    snapshot.issue=null;
    const key="nxtfrm_recovery_snapshot";
    let payload;
    try {
      const data=old.getFullBackup();
      delete data.localStorageDump.apm_recovery_backup;
      /* getFullBackup carries every record twice: as structured fields and again inside
         the raw localStorage dump. Restore (validateBackup) reads the structured field
         whenever it is present and only falls back to the dump, so for a recovery copy
         the duplicate is dropped. File exports still use the full backup untouched. */
      for(const [field,key] of [["logs","apm_logs"],["cardio","apm_cardio"],["floorball","apm_floorball"],["bws","apm_bws"],["scans","apm_evo_scans"],["rest","apm_rest"],["settings","apm_settings"],["notifications","apm_notifications"]]) {
        if(data[field]!==undefined)delete data.localStorageDump[key];
      }
      payload=JSON.stringify({reason,createdAt:new Date().toISOString(),data});
    } catch(e) { return snapshotFail("build",e,opts); }
    try { localStorage.setItem(key,payload);return true; }
    catch(e1) {
      let prev=null;
      try { prev=localStorage.getItem(key);localStorage.removeItem(key);localStorage.setItem(key,payload);return true; }
      catch(e2) {
        try { if(prev!==null)localStorage.setItem(key,prev); } catch(_) {}
        return snapshotFail("write",e2,opts);
      }
    }
  }
  function repaint() { document.activeElement?.blur?.();window.__apexTyping=false;state.typingWeight=false;render(); }
  function commit(message) {
    let localFail=false;
    try{persist();}catch(e){localFail=true;}
    /* A signed-in account still gets the change: persist() starts the cloud save before it reports a local failure. */
    if(localFail&&typeof cloudUser!=='undefined'&&cloudUser){toast('Saved online. This device’s storage is full, so export a backup and free some space.');old.closeModal();repaint();return true;}
    if(localFail){toast('Could not save on this device. Export a backup and free storage before retrying.');return false;}
    old.closeModal();repaint();if(message)toast(message);return true;
  }
  function modal(title,body) {
    ui.lastFocus=document.activeElement;
    document.getElementById("modalRoot").innerHTML=`<div class="modal n99-modal" onclick="if(event.target===this)closeModal()"><section class="sheet n99" role="dialog" aria-modal="true" aria-labelledby="n99-modal-title"><div class="n99-row"><h2 id="n99-modal-title">${esc(title)}</h2><button class="n99-icon" aria-label="Close" onclick="closeModal()">×</button></div>${body}</section></div>`;
    document.querySelector(".n99-modal .n99-icon")?.focus();
  }
  const button = (text,action,secondary=false) => `<button type="button" class="n99-button ${secondary?"secondary":""}" onclick="${esc(action)}">${text}</button>`;
  const heading = (eyebrow,title,action="") => `<header class="n99-heading"><div><p class="n99-eyebrow">${eyebrow}</p><h1>${title}</h1></div>${action}</header>`;
  function card(title,body,extra="") { return `<section class="n99-card ${extra}"><h2>${title}</h2>${body}</section>`; }
  function metric(label,value,detail="") { return `<div class="n99-metric"><span>${label}</span><strong>${value}</strong>${detail?`<small>${detail}</small>`:""}</div>`; }
  function reviewCard() {
    const r=review();
    logSuggestion({kind:"review",subject:null,payload:{title:r.title,action:r.action,tone:r.tone,reason:r.reason}});
    return `<section class="n99-card n99-review ${r.tone}"><div class="n99-eyebrow">Weekly cut review</div><h2>${r.title}</h2><p>${r.message}</p><div class="n99-review-foot"><span>${r.reason}</span><button class="n99-text" onclick="NXT.openReview()">Why this advice? ›</button></div></section>`;
  }
  function diagnosisCard() {
    const d=diagnose();
    const tone={dietary_drift:"watch",water_masking:"good",recovery_deficit:"watch",metabolic_adaptation:"watch"}[d.verdict]||"";
    const evidence=(d.evidence||[]).filter(e=>cfg().targetConfirmed||e.label!=='Forecast');

    /* --- Presentation only. Every string below comes out of diagnose() as-is;
       nothing is recomputed, rephrased or re-thresholded. ---------------- */

    /* The shipped headline is one long sentence joined by an em dash:
       "Not enough context to name the cause — keep logging weigh-ins for 9 more
       days." Splitting it at the dash gives a real headline and a real piece of
       sub-copy without altering a word, which reads far better than one
       run-on line and lets the sub-copy carry the actionable half. */
    const dash=d.headline.indexOf(" — ");
    const lead=dash===-1?d.headline:d.headline.slice(0,dash).replace(/[.\u2014\s]+$/,"");
    const sub=dash===-1?"":d.headline.slice(dash+3).replace(/^\s*(.)/,(m,c)=>c.toUpperCase());

    /* In the insufficient-context branch diagnose() puts the SAME sentence in
       both headline and actions, which is why "Keep logging weigh-ins for 9
       more days." rendered twice. Drop an action whose text is already carried
       by the headline; the information is preserved, the repetition is not. */
    const norm=t=>String(t||"").toLowerCase().replace(/[^a-z0-9]+/g,"");
    const headNorm=norm(d.headline);
    const actions=(d.actions||[]).filter(a=>a&&a.text&&headNorm.indexOf(norm(a.text))===-1);

    /* Values arrive as " · "-joined clauses. The clause carrying a number is the
       one worth scanning, so it leads and the rest becomes a quiet second line —
       "weigh-ins · 9 more days" reads as "9 more days / weigh-ins". This is a
       generic rule about which clause is most informative, not a per-label
       special case, so a new verdict gets the same treatment for free. */
    const splitValue=v=>{
      const parts=String(v==null?"":v).split(" · ").map(x=>x.trim()).filter(Boolean);
      if(parts.length<2)return {head:parts[0]||"—",rest:""};
      /* A percentage is the summary figure wherever one exists, so it leads;
         otherwise the first clause carrying a number does. Everything else
         drops to the quiet second line. Adherence reads "83% weighted" over
         "Logged: 24 of 28 days" rather than the other way round. */
      const pctAt=parts.findIndex(x=>x.indexOf("%")!==-1);
      const numAt=pctAt!==-1?pctAt:parts.findIndex(x=>/\d/.test(x));
      if(numAt>0){const head=parts[numAt];const rest=parts.filter((_,i)=>i!==numAt);return {head,rest:rest.join(" · ")};}
      return {head:parts[0],rest:parts.slice(1).join(" · ")};
    };
    const absent=v=>{const t=String(v||"").trim();return t===""||t==="—"||/^undetermined$/i.test(t);};

    const rows=evidence.map(e=>{
      const {head,rest}=splitValue(e.value);
      const quiet=absent(head)?" is-absent":"";
      return `<div class="n99-diag-row${quiet}"><span class="n99-diag-label">${esc(e.label)}</span>`
        +`<span class="n99-diag-value ${esc(e.tone||"")}"><b>${esc(head)}</b>`
        +`${rest?`<small>${esc(rest)}</small>`:""}</span></div>`;
    }).join("");

    return `<section class="n99-card n99-review n99-diagnosis ${tone}">
    <div class="n99-eyebrow">Trend</div>
    <h2>${esc(lead)}</h2>
    ${sub?`<p class="n99-diag-sub">${esc(sub)}</p>`:""}
    <div class="n99-diag-rows">${rows}</div>
    ${actions.length?`<div class="n99-diag-actions">${actions.map(a=>`<p class="n99-diag-action ${esc(a.kind)}">${esc(a.text)}</p>`).join("")}</div>`:""}
    <div class="n99-diag-foot"><span>Confidence</span><b>${esc(d.confidence)}</b></div>
  </section>`;
  }
  function calorieCard() {
    const c=cfg(),target=finite(c.calories);
    return `<button class="n99-calorie" onclick="NXT.openCalories()"><div><span class="n99-eyebrow">Daily calorie guide</span><strong>${target?target.toLocaleString("en-SG"):'Set your target'}${target?'<small> kcal</small>':''}</strong><p>${target?'Your saved target · no meal logging':'A starting estimate, personalised to you'}</p></div><span class="n99-calorie-edit">${target?'Edit':'Set up'} ›</span></button>`;
  }
  function weekHTML() {
    const start=weekStart(),logs=workRows();
    return `<div class="n99-week">${Array.from({length:7},(_,i)=>{
      const d=dateAdd(start,i),t=typeFor(d),complete=logs.some(r=>r.date===d),short={FullA:"A",FullB:"B",FullC:"C",Zone2:"Walk",Rest:"Rest",Floorball:"FB"}[t]||t.slice(0,3);
      return `<button class="n99-day ${d===state.date?'today':''} ${complete?'done':''}" onclick="NXT.openDay('${d}')" aria-label="${esc(fmt(d)+' · '+label(t))}"><span>${['M','T','W','T','F','S','S'][i]}</span><b>${short}</b><small>${complete?'✓':new Date(dateMs(d)).getUTCDate()}</small></button>`;
    }).join('')}</div>`;
  }
  function home() {
    const list=template(),r=review(),isLift=!['Rest','Zone2','Floorball'].includes(state.dayType),finished=planDone(),minutes=cardioWeek(),target=Number(settings.zone2WeeklyTarget)||90;
    const last=weights().at(-1),s=trendStats();
    const next=list.find(x=>done(x.name)<x.sets);
    document.getElementById("homePage").innerHTML=`<div class="n99">
      ${heading(shortDate(state.date)+" · YOUR DAILY PLAN","Make today count.",'<span class="n99-version">V99 PURPLE</span>')}
      <section class="n99-mission"><div class="n99-row"><span class="n99-eyebrow">${finished?'SESSION SAVED':'TODAY’S SESSION'}</span><button class="n99-chip" onclick="showSessionSheet()">Change</button></div><h2>${label(state.dayType)}</h2><p>${finished?'Your work is saved. Take recovery seriously.':isLift?`${list.length} exercises · ${list.reduce((s,e)=>s+e.sets,0)} working sets · ${esc(state.gym)}`:state.dayType==='Zone2'?'Easy, conversational effort. Build consistency at a manageable pace.':state.dayType==='Floorball'?'Log your session and account for it in your recovery.':'A planned rest day. Your programme continues after recovery.'}</p>
      ${isLift&&!finished?`<div class="n99-next"><span>Next up</span><b>${esc(next?.name||'All planned sets logged')}</b></div>`:''}
      ${button(finished?'Review session':isLift?'Start / resume workout':state.dayType==='Zone2'?'Log cardio':'Open today',finished?"switchTab('train')":"startWorkoutNow()")}</section>
      ${calorieCard()}
      ${adherenceHTML()}
      <div class="n99-stats">${metric('Latest weight',last?last.weight.toFixed(1)+'<small> kg</small>':'—',last?shortDate(last.date):'Log your baseline')}${metric('Weekly change',s.change===null?'—':(s.change>0?'+':'')+s.change.toFixed(2)+'<small> kg</small>',s.change===null?'Building data':'Weekly averages')}</div>
      <section class="n99-card"><div class="n99-row"><h2>Your weekly rhythm</h2><button class="n99-text" onclick="NXT.more('training')">Edit ›</button></div>${weekHTML()}<div class="n99-week-footer"><span>${completedWeek()} lifting days logged</span><span>${minutes} / ${target} cardio min</span></div></section>
      <div class="n99-quick">${button('+ Weight','apx95OpenQuickWeight()',true)}${button('⌁ Cardio','showCardioSheet()',true)}${button('◉ Check-in','apx96OpenReadiness()',true)}</div>
      ${reviewCard()}
    </div>`;
  }
  function openCalories() {
    const p=cfg().profile,latest=weights().at(-1);
    modal("Your calorie guide",`<p>A daily target, without meal tracking. Complete the profile once; changes only apply when you save.</p><form onsubmit="event.preventDefault();NXT.saveCalories()">
    <div class="n99-form-grid"><label>Age<input id="n99-age" type="number" min="18" max="80" inputmode="numeric" required value="${esc(p.age||'')}"></label><label>Height · cm<input id="n99-height" type="number" min="130" max="220" inputmode="decimal" required value="${esc(p.height||176)}"></label><label>Measured weight · kg<input id="n99-weight" type="number" min="40" max="250" step="0.1" inputmode="decimal" required value="${esc(p.weight||latest?.weight||'')}"></label><label>Equation sex<select id="n99-sex" required><option value="">Select</option><option value="male" ${p.sex==='male'?'selected':''}>Male</option><option value="female" ${p.sex==='female'?'selected':''}>Female</option></select></label></div>
    <label>Usual activity, including exercise<select id="n99-activity" required><option value="">Select</option>${[[1.2,'Mostly seated · little exercise'],[1.375,'Lightly active'],[1.55,'Moderately active'],[1.725,'Very active · physical work / frequent training']].map(([v,t])=>`<option value="${v}" ${Number(p.activity)===v?'selected':''}>${t}</option>`).join('')}</select></label>
    <label class="n99-check"><input id="n99-eligible" type="checkbox" ${p.eligible?'checked':''}>I’m an adult, not pregnant/breastfeeding, and not using a clinician-managed diet.</label>
    <button class="n99-button secondary" type="button" onclick="NXT.previewCalories()">Calculate estimate</button><div id="n99-calorie-preview" aria-live="polite"></div>
    <label>Daily target · kcal<input id="n99-calories" type="number" inputmode="numeric" step="50" min="1200" max="5000" required value="${esc(cfg().calories||'')}" placeholder="Calculate above, or enter your agreed target"></label>
    <p class="n99-small">Mifflin–St Jeor resting estimate × an approximate activity factor, then a 15% starting reduction. Activity factors are estimates, not measured metabolism. Exercise calories are not added again. <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener">Formula source</a>.</p><p class="n99-small">These calculator guardrails are not personal minimum requirements. Seek individual guidance if energy, health or training suffers.</p>
    <button class="n99-button" type="submit">Save my daily target</button></form>`);
  }
  function profileInputs() {return {age:val('n99-age'),height:val('n99-height'),weight:val('n99-weight'),sex:val('n99-sex'),activity:val('n99-activity'),eligible:!!document.getElementById('n99-eligible')?.checked};}
  function previewCalories() {
    const e=estimate(profileInputs()),box=document.getElementById('n99-calorie-preview');
    box.innerHTML=e.error?`<p class="n99-error">${e.error}</p>`:`<div class="n99-estimate"><span>Estimated maintenance · ${e.maintenance} kcal</span><strong>${e.target}<small> kcal / day</small></strong><span>Starting guide · review against your results</span></div>`;
    if(!e.error)document.getElementById('n99-calories').value=e.target;
  }
  function saveCalories() {
    const p=profileInputs(),e=estimate(p),target=finite(val('n99-calories'));
    if(e.error)return toast(e.error);
    if(target===null||target<(p.sex==='male'?1500:1200)||target>5000)return toast('Choose a suitable target within the calculator range, or seek personalised guidance.');
    if(target<e.maintenance*.75)return toast('This is over 25% below estimated maintenance. The app will not set that automatically; get personalised guidance.');
    const c=cfg();c.profile=p;c.calories=target;c.calorieUpdated=state.date;c.maintenanceEstimate=e.maintenance;
    logSuggestion({kind:"calorie",subject:null,payload:{calories:target,maintenanceEstimate:e.maintenance}});
    maybeSnapshotTDEE(true);
    commit('Daily calorie target saved');
  }
  function openReview() { const r=review(),s=trendStats();modal('Your weekly review',`${reviewCard()}<div class="n99-stats">${metric('This week',s.current.avg===null?'—':s.current.avg.toFixed(2)+' kg',s.current.n+' weigh-ins')}${metric('Previous week',s.previous.avg===null?'—':s.previous.avg.toFixed(2)+' kg',s.previous.n+' weigh-ins')}</div><p>These are transparent coaching rules, not a medical assessment. Weight windows use calendar days. Strength compares the same exercise and gym across repeated sessions.</p><p>No food intake is recorded, so your actual deficit and the cause of a plateau are unknown. Any target change stays your choice.</p><div class="n99-stack">${button('Review calorie guide','NXT.openCalories()',true)}${button('Update recovery check-in','apx96OpenReadiness()',true)}${button('Done','closeModal()')}</div>`); }
  // Views and integrations are defined below, before install() runs.
  return {cfg,copy,ui,old,defaults,coachFor,split,names,typeNames,finite,dateMs,dateAdd,weekStart,shortDate,label,weights,timingRows,cleanRows,windowStats,ewmaTrend,trend,trendConfidence,forecastGoal,detectPlateau,trendStats,workRows,sessionRows,strengthItems,review,estimate,cardioWeek,completedWeek,typeFor,templateFor,targetFor,done,planDone,cue,bestSet,aimFor,logSuggestion,logAdherence,adherenceHTML,adaptiveTDEE,diagnose,maybeSnapshotTDEE,formulaTDEE,tdeeCardHTML,snapshot,repaint,commit,modal,button,heading,card,metric,reviewCard,diagnosisCard,calorieCard,weekHTML,home,openCalories,profileInputs,previewCalories,saveCalories,openReview};
})();

Object.assign(NXT, (()=>{
  const N=NXT;
  function signed(v,digits=2) { return v===null?'—':(v>0?'+':'')+v.toFixed(digits); }
  function smoothPath(points) {
    if(!points.length)return '';
    if(points.length===1)return `M ${points[0].x} ${points[0].y}`;
    // Monotone cubic interpolation: no overshooting the measured rolling averages.
    const slopes=points.slice(1).map((p,i)=>(p.y-points[i].y)/(p.x-points[i].x||1));
    const tangent=points.map((p,i)=>i===0?slopes[0]:i===points.length-1?slopes.at(-1):slopes[i-1]*slopes[i]<=0?0:2/(1/slopes[i-1]+1/slopes[i]));
    let path=`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=(b.x-a.x)/3;
      path+=` C ${(a.x+dx).toFixed(2)} ${(a.y+dx*tangent[i-1]).toFixed(2)}, ${(b.x-dx).toFixed(2)} ${(b.y-dx*tangent[i]).toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }
    return path;
  }
  // The stats module keeps its constants private, so the chart holds its own copies: the gap that
  // resets the EWMA (and so breaks the band into runs) and the level spread forecastGoal falls back
  // on when no band exists. Changing either there means changing it here.
  const BAND_GAP_DAYS=3,CONE_SIGMA_FALLBACK=.5,FUTURE_MAX_DAYS=42,FUTURE_SHARE=.4;
  // Forecast geometry in data space: day offsets from the last trend reading, weights in kg.
  // Presentation only — its extremes must NEVER enter the recent-trajectory Y-domain (D2).
  function forecastGeometry(f,start,bandRows) {
    const target=N.finite(goalHigh()),level=N.finite(f.fittedLevel),slope=N.finite(f.slope);
    if(!f.ok||!f.weeks||target===null||level===null||slope===null||!(slope<0))return null;
    // An anchor older than the visible window would be drawn off the left edge, so it is dropped
    // from the chart. The trend read line still reports the horizon.
    if(f.lastDate<start)return null;
    const days=(level-target)/-slope;
    if(!Number.isFinite(days)||!(days>0))return null;
    const here=bandRows.find(b=>b.date===f.lastDate);
    // No band means the level is unmeasured rather than certain, so the cone opens on the same
    // nominal spread forecastGoal itself falls back on.
    const sigma=here&&N.finite(here.sigma)!==null?here.sigma:CONE_SIGMA_FALLBACK;
    const historyDays=Math.max(1,(N.dateMs(state.date)-N.dateMs(start))/86400000);
    // Room for the future without letting it crowd out the record. A horizon past the cap runs to
    // the edge unfinished, which reads as "continues"; the trend read line carries the number.
    const soon=f.lowWeeks*7,late=f.highWeeks*7;
    const futureDays=Math.min(Math.max(days,late),Math.max(7,Math.round(FUTURE_SHARE*historyDays)),FUTURE_MAX_DAYS);
    // The cone spans the band's mouth today and the reported arrival window on the goal line: the
    // upper wall reaches the goal at highWeeks, the lower wall at lowWeeks. Neither is a new
    // statistic, both are forecastGoal's own bounds drawn out. It narrows instead of widening when
    // today's level spread is wider than the arrival window, which is a fact about the data, and the
    // walls provably cannot cross before their own arrivals, so the polygon stays simple.
    const upper=t=>level+sigma+(target-level-sigma)*t/late,lower=t=>level-sigma+(target-level+sigma)*t/soon;
    const tU=Math.min(futureDays,late),tL=Math.min(futureDays,soon),tMid=Math.min(futureDays,days);
    const cone=[[0,level+sigma],[tU,upper(tU)]];
    // Once the fast wall has landed, the goal line itself closes the shape, so the arrival window
    // reads as a segment along the goal rather than a vertical cut through it.
    if(futureDays>soon&&futureDays<late)cone.push([futureDays,target]);
    cone.push([tL,lower(tL)],[0,level-sigma]);
    return {weeks:f.weeks,lowWeeks:f.lowWeeks,highWeeks:f.highWeeks,confidence:f.confidence,lastDate:f.lastDate,
      level,slope,sigma,target,days,futureDays,arrives:days<=futureDays,cone,mid:[[0,level],[tMid,level+slope*tMid]]};
  }
  // One line of plain reading under the chart. The bounds are printed exactly as forecastGoal
  // returns them and never widened to centre the point estimate: the chart, this line and
  // NXT.forecastGoal() in the console have to tell the same story or none of them is trusted.
  function trendReadText(forecast,plateau) {
    const spell=n=>n===1?"1 week":n+" weeks";
    // forecastGoal's reasons are full sentences; the trailing stop is dropped so the two clauses
    // punctuate alike. Wording and numbers are left exactly as the stats layer produced them.
    const horizon=!forecast.ok?forecast.reason.replace(/\.$/,""):forecast.weeks===0?"At your goal range":
      forecast.lowWeeks===forecast.weeks&&forecast.highWeeks===forecast.weeks?`~${spell(forecast.weeks)} to goal`:
      `~${spell(forecast.weeks)} to goal (range ${forecast.lowWeeks}–${forecast.highWeeks})`;
    // "Undetermined" is dropped rather than reported as no plateau: too noisy to call is not the
    // same finding as still losing.
    const level=!plateau.ok||plateau.status==="undetermined"?"":
      plateau.status==="flat"?`Plateau: ${plateau.plateauDays} days`:
      plateau.status==="gaining"?"Trend is gaining":"No plateau detected";
    return [horizon,level].filter(Boolean).join(" · ");
  }
  function chartModel(rows=N.weights(),range=N.ui.range,showGoal=N.ui.showGoal) {
    const series=N.trend(rows),start=range?N.dateAdd(state.date,1-range):rows[0]?.date||N.dateAdd(state.date,-29);
    const visible=series.filter(r=>r.date>=start),W=420,H=392,left=20,right=20,top=18,bottom=110;
    if(!visible.length)return {visible,start,W,H,left,right,top,bottom,low:null,high:null,step:null};
    /* D2 — Y-domain from visible morning readings + trend ONLY.
       Goal band, target reference, forecast cone/endpoint, confidence band
       extremes and post-workout must never stretch the recent-trajectory scale. */
    const values=visible.flatMap(r=>r.avg===null?[r.weight]:[r.weight,r.avg]);
    /* Post-workout is contextual only (D8): never enters trend/plateau/forecast
       maths, and also never enters this domain. Drawn through the same scale
       when toggled on; readings outside the plot simply clip. */
    const postRows=N.ui.showPost?N.timingRows('Post-workout').filter(r=>r.date>=start&&r.date<=state.date):[];
    // showGoal is accepted for API compatibility but must not affect the domain (D2/D3).
    void showGoal;
    const bandRows=(N.trendConfidence(rows)||[]).filter(r=>r.date>=start&&r.date<=state.date);
    const forecastRead=N.forecastGoal(rows);
    /* Projection is off by default. Omit entirely when forecastGoal reports
       insufficient evidence (!ok) rather than drawing a weak estimate (I11). */
    const canForecast=!!(N.cfg().targetConfirmed&&forecastRead.ok&&forecastRead.weeks!==null&&forecastRead.confidence!=='none');
    const fc=N.ui.showForecast&&canForecast?forecastGeometry(forecastRead,start,bandRows):null;
    const dataLow=Math.min(...values),rawHigh=Math.max(...values);
    const span=Math.max(1,rawHigh-dataLow);
    const step=span<=2?.5:span<=4?1:span<=10?2:Math.ceil(span/20)*5;
    const low=Math.floor((dataLow-step*.45)/step)*step,high=Math.ceil((rawHigh+step*.45)/step)*step;
    // Future strip only when a projection is actually drawn — still same px/day.
    const futureDays=fc?fc.futureDays:0;
    const first=N.dateMs(start),end=Math.max(N.dateMs(state.date),first+86400000)+futureDays*86400000;
    const xMs=ms=>left+(ms-first)/(end-first)*(W-left-right),x=d=>xMs(N.dateMs(d)),y=v=>top+(high-v)/(high-low)*(H-top-bottom);
    const points=visible.map(r=>({...r,x:x(r.date),y:y(r.weight),ty:r.avg===null?null:y(r.avg)}));
    /* Same x and y closures as the primary series: there is one scale, so a
       second y-axis cannot be introduced by accident. */
    const post=postRows.map(r=>({...r,x:x(r.date),y:y(r.weight)}));
    const postByDate=new Map(post.map(r=>[r.date,r]));
    const segments=[];let segment=[];
    for(const p of points) {
      if(p.avg===null||(segment.length&&N.dateMs(p.date)-N.dateMs(segment.at(-1).date)>7*86400000)) {if(segment.length)segments.push(segment);segment=[];}
      if(p.avg!==null)segment.push({...p,y:p.ty});
    }
    if(segment.length)segments.push(segment);
    const ticks=[];for(let n=low;n<=high+step/10;n+=step)ticks.push({value:n,y:y(n)});
    // One polygon per contiguous run. Past the EWMA reset gap the carried average restarts, so a
    // residual spread means nothing across the break and the runs are never bridged.
    const runs=[];let run=[];
    for(const b of bandRows) {
      if(run.length&&(N.dateMs(b.date)-N.dateMs(run.at(-1).date))/86400000>BAND_GAP_DAYS){runs.push(run);run=[];}
      run.push(b);
    }
    if(run.length)runs.push(run);
    const bands=runs.filter(r=>r.length>1).map(r=>r.map(b=>({x:x(b.date),upper:y(b.upper),lower:y(b.lower)})));
    let forecast=null;
    if(fc) {
      const fx=d=>xMs(N.dateMs(fc.lastDate)+d*86400000),tMid=fc.mid[1][0],wMid=fc.mid[1][1];
      // Clamp projected y into the plot so a distant goal cannot invent vertical space.
      const cy=v=>Math.min(H-bottom,Math.max(top,y(v)));
      forecast={...fc,cone:fc.cone.map(([t,w])=>[fx(t),cy(w)]),
        mid:{x1:fx(0),y1:cy(fc.level),x2:fx(tMid),y2:cy(wMid)},
        endpoint:fc.arrives?{x:fx(tMid),y:cy(wMid)}:null};
    }
    const tail=segments.at(-1)?.at(-1)||null;
    const anchor=forecast?{x:forecast.mid.x1,y:forecast.mid.y1,fitted:true}:tail?{x:tail.x,y:tail.y,fitted:false}:null;
    // Distant goal lives on Journey (D3) — never as a chart reference line.
    return {visible,start,W,H,left,right,top,bottom,low,high,step,points,post,postByDate,segments,ticks,x,y,
      todayX:x(state.date),futureDays,bands,forecast,anchor,forecastRead,canForecast,
      plateau:N.detectPlateau(rows),goalRef:null};
  }
  /* The primary series is the canonical per-date row, which prefers Morning but
     falls back to whatever timing exists on days with no morning reading. That
     fallback is unchanged, so the readout names the timing actually recorded
     rather than claiming every point is a morning one. */
  /* One plain line under the trend figure: how far this reading sits from its own trend value. */
  function gapLine(p) {
    if(!p||p.avg===null||p.avg===undefined||!Number.isFinite(p.weight))return (p&&p.coverage!==undefined?p.coverage+' readings':'');
    const d=p.weight-p.avg;
    if(Math.abs(d)<0.05)return 'On trend';
    return Math.abs(d).toFixed(1)+' kg '+(d<0?'below':'above')+' trend';
  }
  function pointTiming(p) {
    const t=String(p&&p.timeOfDay||'').trim();
    if(!t)return 'Timing not recorded';
    return /^morning$/i.test(t)?'Morning':t;
  }
  function postDelta(p,postRow) {
    if(!postRow||!p||!Number.isFinite(p.weight)||!Number.isFinite(postRow.weight))return '';
    const d=postRow.weight-p.weight;
    return (d>0?'+':'')+d.toFixed(1)+' kg vs '+(/^morning$/i.test(String(p.timeOfDay||''))?'morning':'the day\u2019s other reading');
  }
  function trajectoryHeadline(plateau) {
    const rate=N.finite(plateau&&plateau.weeklyRate);
    if(!plateau||!plateau.ok||rate===null)return 'Building your baseline';
    if(plateau.status==='losing')return `Losing ${Math.abs(rate).toFixed(2)} kg per week`;
    if(plateau.status==='flat')return plateau.plateauDays?`Trend is flat · ${plateau.plateauDays} days`:'Trend is flat';
    if(plateau.status==='gaining')return 'Trend is gaining';
    return 'Direction still settling';
  }
  /* D3 — long-term goal as a separate non-time-series rail: start → current → target. */
  function journeyHTML() {
    if(!N.cfg().targetConfirmed)return '';
    const rows=N.weights();
    const startW=N.finite(typeof START_WEIGHT!=='undefined'?START_WEIGHT:null);
    const seed=startW!==null?startW:(rows[0]?rows[0].weight:null);
    const lo=goalLow(),hi=goalHigh();
    const plateau=N.detectPlateau(rows);
    const cur=N.finite(plateau.lastAvg)!==null?plateau.lastAvg:(rows.at(-1)?rows.at(-1).weight:null);
    if(seed===null||cur===null||!Number.isFinite(lo)||!Number.isFinite(hi))return '';
    const max=Math.max(seed,cur,hi)+0.6,min=Math.min(lo,cur)-1.2,span=Math.max(0.8,max-min);
    const pct=v=>Math.max(0,Math.min(100,((max-v)/span)*100));
    const done=seed-cur,remain=Math.max(0,cur-hi);
    const cs=typeof settings!=='undefined'&&settings&&Number.isFinite(N.dateMs(settings.cutStart))&&settings.cutStart<=state.date?settings.cutStart:null;
    const first=cs||rows[0]?.date;
    const elapsed=first?Math.round((N.dateMs(state.date)-N.dateMs(first))/86400000):0;
    const leftTrav=Math.min(pct(seed),pct(cur)),widthTrav=Math.abs(pct(cur)-pct(seed));
    const leftBand=Math.min(pct(lo),pct(hi)),widthBand=Math.abs(pct(lo)-pct(hi));
    return `<section class="vn-journey" aria-label="Cut journey">
      <div class="vn-sect-head"><p class="vn-h-sect">Cut journey</p>
        <span class="vn-tiny">${first?esc(N.shortDate(first)):'Start'} → now</span></div>
      <div class="vn-journey-metrics">
        <div><span class="vn-metric-l">Down</span><div class="vn-metric-v vn-num">${done.toFixed(1)}<em>kg</em></div></div>
        <div class="vn-journey-remain"><span class="vn-metric-l">To goal range</span>
          <div class="vn-h-sub vn-num">${remain.toFixed(1)} kg</div></div>
      </div>
      <div class="vn-journey-rail" role="img" aria-label="Start ${seed.toFixed(1)} kilograms, now ${cur.toFixed(1)}, goal ${lo} to ${hi}">
        <div class="vn-journey-track"></div>
        <div class="vn-journey-band" style="left:${leftBand}%;width:${Math.max(2,widthBand)}%"></div>
        <div class="vn-journey-travel" style="left:${leftTrav}%;width:${Math.max(0,widthTrav)}%"></div>
        <div class="vn-journey-now" style="left:${pct(cur)}%"></div>
      </div>
      <div class="vn-journey-labels">
        <span class="vn-tiny">Start ${seed.toFixed(1)}</span>
        <span class="vn-tiny vn-journey-now-l">Now ${cur.toFixed(1)}</span>
        <span class="vn-tiny">Goal ${lo}–${hi}</span>
      </div>
      <p class="vn-tiny vn-mt3">Elapsed ${elapsed} days. A weight range alone does not measure leanness.</p>
    </section>`;
  }
  function evidenceHTML(plateau,forecastRead) {
    const rate=N.finite(plateau&&plateau.weeklyRate);
    const rateTxt=rate===null?'—':`${signed(rate)} kg`;
    const band=rate!==null&&N.finite(plateau.lower)!==null&&N.finite(plateau.upper)!==null
      ?`28-day window · 95% range ${signed(plateau.upper)} to ${signed(plateau.lower)}`:'28-day window';
    let plateauStatus='—',plateauTone='is-neutral';
    if(plateau&&plateau.ok){
      if(plateau.status==='flat'&&plateau.plateau){plateauStatus=`${plateau.plateauDays} days`;plateauTone='is-watch';}
      else if(plateau.status==='losing'){plateauStatus='None';plateauTone='is-ok';}
      else if(plateau.status==='gaining'){plateauStatus='Gaining';plateauTone='is-watch';}
      else {plateauStatus='Settling';plateauTone='is-neutral';}
    }
    /* A horizon only means something against a goal the lifter confirmed (same gate as the chart and Today). */
    const proj=N.cfg().targetConfirmed&&forecastRead&&forecastRead.ok&&forecastRead.weeks!==null
      ?`${forecastRead.weeks} wk <span class="vn-ink-3">(${forecastRead.lowWeeks}–${forecastRead.highWeeks})</span>`
      :(N.cfg().targetConfirmed?'Unavailable':'Set a goal');
    const conf=plateau&&plateau.confidence&&plateau.confidence!=='none'
      ?plateau.confidence.charAt(0).toUpperCase()+plateau.confidence.slice(1):'—';
    return `<section class="vn-evidence">
      <p class="vn-h-sect">Evidence</p>
      <div class="vn-rows">
        <div class="vn-row"><span class="vn-row-l"><span class="vn-row-t">Weekly rate</span>
          <span class="vn-row-s">${esc(band)}</span></span>
          <span class="vn-row-v vn-num">${rateTxt}</span></div>
        <div class="vn-row"><span class="vn-row-l"><span class="vn-row-t">Plateau</span>
          <span class="vn-row-s">${esc(plateau&&plateau.reason||'')}</span></span>
          <span class="vn-row-v"><span class="vn-status ${plateauTone}"><i></i>${esc(plateauStatus)}</span></span></div>
        <div class="vn-row"><span class="vn-row-l"><span class="vn-row-t">Projection</span>
          <span class="vn-row-s">Model estimate, not a measurement</span></span>
          <span class="vn-row-v vn-num">${proj}</span></div>
        <div class="vn-row"><span class="vn-row-l"><span class="vn-row-t">Confidence</span>
          <span class="vn-row-s">Reading coverage and consistency</span></span>
          <span class="vn-row-v">${esc(conf)}</span></div>
      </div>
    </section>`;
  }
  function chartHTML() {
    const model=chartModel();N.ui.chart=model;
    const {visible,W,H,left,right,top,bottom}=model;
    const latestKey=visible.length?visible.at(-1).date+':'+visible.at(-1).weight:'';
    const grew=!!(N.ui.lastPlotted&&latestKey&&latestKey!==N.ui.lastPlotted);
    N.ui.lastPlotted=latestKey;
    const animClass=N.ui.chartAnim==='range'?' is-range-change':grew?' is-new-point':'';
    N.ui.chartAnim=null;
    const ranges=[[14,'2W'],[30,'1M'],[90,'3M'],[0,'All']];
    const rangeBtns=`<div class="vn-seg n99-segments" role="group" aria-label="Chart date range">${ranges.map(([r,l])=>{
      const active=N.ui.range===r;
      return `<button type="button" aria-pressed="${active}" class="${active?'active':''}" onclick="NXT.setRange(${r})">${l}</button>`;
    }).join('')}</div>`;
    if(!visible.length){
      const emptyTitle=N.weights().length?'No weigh-ins in this period':'Your first weigh-in starts here';
      const emptyBody=N.weights().length?'Choose All to see older entries, or log a current weight.':'Your actual readings will appear as dots. A trend line starts when a seven-day window has three readings.';
      return `<section class="vn-weight n99-chart" id="vn-weight">
        <h2 class="vn-h-sub">Building your baseline</h2>
        <div class="vn-mt4">${rangeBtns}</div>
        <div class="vn-chart-empty n99-chart-empty"><div class="n99-empty-number">—<small> kg</small></div>
          <h3>${emptyTitle}</h3><p>${emptyBody}</p>${N.button('+ Log weight','apx95OpenQuickWeight()')}</div>
        ${journeyHTML()}
        <details class="vn-more-block"><summary>Why NXTFRM says this</summary>${N.diagnosisCard()}</details>
      </section>`;
    }
    const {points,post,postByDate,segments,ticks,y,bands,forecast,anchor,plateau,forecastRead,canForecast,futureDays,todayX,low,high}=model;
    const selected=Math.max(0,points.findIndex(p=>p.date===N.ui.selected));
    const idx=N.ui.selected&&selected>=0?selected:points.length-1;
    const p=points[idx],baseline=H-bottom,isLatest=!N.ui.selected||N.ui.selected===points.at(-1).date;
    const px=v=>v.toFixed(2);
    const headline=trajectoryHeadline(plateau);
    const readLine=trendReadText(N.cfg().targetConfirmed?forecastRead:{ok:false,reason:''},plateau);
    const narrowTicks=ticks.length>5?ticks.filter((_,i)=>i%2===0||i===ticks.length-1):ticks;
    const bandFill=bands.map(run=>`<path d="M ${run.map(b=>`${px(b.x)} ${px(b.upper)}`).join(' L ')} L ${[...run].reverse().map(b=>`${px(b.x)} ${px(b.lower)}`).join(' L ')} Z" fill="${CHART.ink}" fill-opacity=".06" pointer-events="none"/>`).join('');
    const today=futureDays?`<line x1="${px(todayX)}" x2="${px(todayX)}" y1="${top}" y2="${baseline}" stroke="${CHART.grid}" stroke-opacity=".12" pointer-events="none"/>`:'';
    const cone=forecast?`<polygon points="${forecast.cone.map(([cx,cy])=>`${px(cx)},${px(cy)}`).join(' ')}" fill="url(#n99-chart-cone)" pointer-events="none"/>`:'';
    const forecastLine=forecast?`<line class="vn-proj-line" x1="${px(forecast.mid.x1)}" y1="${px(forecast.mid.y1)}" x2="${px(forecast.mid.x2)}" y2="${px(forecast.mid.y2)}" stroke="${CHART.ink}" stroke-width="${CHART.lineForecast}" stroke-linecap="round" stroke-dasharray="2 5" stroke-opacity=".55" pointer-events="none"/>${forecast.endpoint?`<circle cx="${px(forecast.endpoint.x)}" cy="${px(forecast.endpoint.y)}" r="3.5" fill="none" stroke="${CHART.ink}" stroke-width="1.5" stroke-opacity=".7" pointer-events="none"/>`:''}`:'';
    /* Diamonds, not circles: shape separates post-workout from morning without hue (I6). */
    const postSeries=post.map(pt=>{
      const s=3.4;
      return `<path class="vn-post-mark" d="M${px(pt.x)} ${px(pt.y-s)}L${px(pt.x+s)} ${px(pt.y)}L${px(pt.x)} ${px(pt.y+s)}L${px(pt.x-s)} ${px(pt.y)}Z" fill="none" stroke="${CHART.inkSecondary}" stroke-width="1.5" pointer-events="none"/>`;
    }).join('');
    const trendPaths=segments.map(seg=>`${seg.length>1?`<path d="${smoothPath(seg)} L ${seg.at(-1).x} ${baseline} L ${seg[0].x} ${baseline} Z" fill="url(#n99-chart-fill)" pointer-events="none"/>`:''}<path class="vn-trend-line" d="${smoothPath(seg)}" filter="url(#st-glow)" pathLength="1" fill="none" stroke="${CHART.ink}" stroke-width="${CHART.line}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>${seg.length===1?`<circle cx="${seg[0].x}" cy="${seg[0].y}" r="${CHART.point}" fill="${CHART.ink}" pointer-events="none"/>`:''}`).join('');
    const dateLabel=isLatest?'Latest morning':N.shortDate(p.date);
    const postRow=postByDate.get(p.date);
    const xLabs=(()=>{
      const n=points.length<3?points.length:3;
      if(!n)return '';
      const idxs=n===1?[0]:n===2?[0,points.length-1]:[0,Math.round((points.length-1)/2),points.length-1];
      return [...new Set(idxs)].map((i,k)=>{
        const pt=points[i],anchor=k===0?'start':k===idxs.length-1?'end':'middle';
        return `<text x="${px(pt.x)}" y="${H-8}" text-anchor="${anchor}" fill="${CHART.axisText}" font-size="11" pointer-events="none">${N.shortDate(pt.date)}</text>`;
      }).join('');
    })();
    const togPost=`<button type="button" class="vn-tog" data-tog="post" aria-pressed="${!!N.ui.showPost}" onclick="NXT.setPostVisible(!NXT.ui.showPost)">
      <span class="vn-tog-box" aria-hidden="true"></span>Post-workout
      <svg class="vn-tog-key" width="10" height="10" aria-hidden="true"><path d="M5 1.2L8.8 5L5 8.8L1.2 5Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>`;
    const togProj=canForecast?`<button type="button" class="vn-tog" data-tog="proj" aria-pressed="${!!N.ui.showForecast}" onclick="NXT.setForecastVisible(!NXT.ui.showForecast)">
      <span class="vn-tog-box" aria-hidden="true"></span>Projection
      <svg class="vn-tog-key" width="14" height="10" aria-hidden="true"><line x1="0" y1="5" x2="14" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/></svg></button>`:'';
    /* All range: the first weigh-in is marked so the whole journey reads at a glance.
       Presentation only: the point is one the chart already plots. */
    const first=points[0],startMark=(!N.ui.range&&points.length>=2&&first)?`<g pointer-events="none"><circle cx="${px(first.x)}" cy="${px(first.y)}" r="5" fill="none" stroke="${CHART.ink}" stroke-width="1.6"/><text x="${px(Math.min(first.x+8,W-right-60))}" y="${px(Math.max(first.y-14,top+10))}" fill="${CHART.axisText}" font-size="11">Start ${first.weight.toFixed(1)} kg</text></g>`:'';
    const summary=`${points.length} readings, ${N.shortDate(points[0].date)} to ${N.shortDate(points.at(-1).date)}. Dotted steps mark each week’s morning average. The strip shows each reading against the trend: while you are cutting most land below it, because the trend averages the days before; several days above it in a row mean the drop is slowing.`
      +(forecast?' Projection is a model estimate, shown dashed — not a measurement.':'');
    return `<section class="vn-weight n99-chart" id="vn-weight">
      <div class="vn-read">
        <h2 class="vn-h-sub" id="vn-traj-headline">${esc(headline)}</h2>
        <p class="vn-meta vn-mt2" id="vn-traj-read">${esc(readLine||(plateau.reason||''))}</p>
      </div>
      <div class="vn-mhead" id="vn-mhead" aria-live="polite">
        <div class="vn-mhead-row">
          <div class="vn-mhead-cell">
            <span class="vn-metric-l" id="n99-chart-date">${esc(dateLabel)}</span>
            <div class="vn-metric-v vn-num" id="n99-chart-weight">${p.weight.toFixed(1)}<em>kg</em></div>
            <small class="vn-tiny" id="n99-chart-timing">${esc(pointTiming(p))}</small>
          </div>
          <div class="vn-mhead-cell vn-mhead-right">
            <span class="vn-metric-l">Trend</span>
            <div class="vn-h-sub vn-num vn-trend-val" id="n99-chart-average">${p.avg===null?'—':p.avg.toFixed(2)}<em>kg</em></div>
            <small class="vn-tiny st-gapline" id="n99-chart-coverage">${esc(gapLine(p))}</small>
          </div>
        </div>
        <div class="vn-mhead-post" id="n99-chart-post" ${postRow?'':'hidden'}>
          <span class="vn-metric-l">Post-workout</span>
          <b class="vn-num" id="n99-chart-post-weight">${postRow?postRow.weight.toFixed(1)+' kg':''}</b>
          <small class="vn-tiny" id="n99-chart-post-delta">${esc(postDelta(p,postRow))}</small>
        </div>
      </div>
      <div class="vn-mt4 st-range-row">${rangeBtns}<button type="button" class="st-replay" data-st-chart-replay aria-label="Replay this range"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.8v10.4L13 8z" fill="currentColor"/></svg><span>Replay</span></button></div>
      <div class="vn-chart-wrap" id="vn-chart-wrap" tabindex="0" role="application"
        aria-label="Weight trend chart. Drag to inspect a day. Use left and right arrow keys; Escape returns to latest."
        onpointerdown="NXT.scrub(event)" onpointermove="if(event.buttons)NXT.scrub(event)"
        onkeydown="NXT.chartKey(event)">
        <svg id="n99-chart-svg" class="n99-chart-svg vn-chart-svg${animClass}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="n99-chart-title n99-chart-desc">
          <title id="n99-chart-title">Morning weight and smoothed trend${forecast?' with model projection':''}</title>
          <desc id="n99-chart-desc">${points.length} weigh-ins. Circles are morning readings. The solid line is the smoothed trend. Diamonds are post-workout when enabled. ${forecast?'A dashed faded line is a model projection, not a measurement. ':''}Y-axis covers recent readings only — the long-term goal is on Cut journey below.</desc>
          <defs>
            <clipPath id="vn-chart-clip"><rect id="vn-chart-clip-r" x="${left}" y="${top}" width="${W-left-right}" height="${H-top-bottom}"/></clipPath>
            <linearGradient id="n99-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CHART.ink}" stop-opacity=".34"/><stop offset=".7" stop-color="${CHART.ink}" stop-opacity=".06"/><stop offset="1" stop-color="${CHART.ink}" stop-opacity="0"/></linearGradient><filter id="st-glow" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="n99-chart-cone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${CHART.ink}" stop-opacity=".10"/><stop offset="1" stop-color="${CHART.ink}" stop-opacity=".02"/></linearGradient>
          </defs>
          ${narrowTicks.map(t=>`<line x1="${left}" x2="${W-right}" y1="${t.y}" y2="${t.y}" stroke="${CHART.grid}" stroke-opacity="${CHART.gridOpacity}" pointer-events="none"/><text x="${left+2}" y="${t.y-5}" text-anchor="start" fill="${CHART.axisText}" font-size="11" pointer-events="none">${Number(t.value.toFixed(1))}</text>`).join('')}
          <g clip-path="url(#vn-chart-clip)" pointer-events="none">
            ${today}${cone}${bandFill}${trendPaths}${forecastLine}${postSeries}
            ${points.map(pt=>`<circle class="vn-raw-dot" cx="${pt.x}" cy="${pt.y}" r="2.8" fill="${CHART.raw}" fill-opacity=".85"/>`).join('')}
            <line id="n99-chart-cursor" x1="${p.x}" x2="${p.x}" y1="${top}" y2="${baseline}" stroke="${CHART.cursor}" stroke-opacity=".38" stroke-dasharray="3 4"/>
            <circle id="st-chart-halo" class="st-halo" cx="${p.x}" cy="${p.y}" r="11" fill="${CHART.ink}"/>
            <circle id="n99-chart-active" cx="${p.x}" cy="${p.y}" r="${CHART.pointActive}" fill="${CHART.active}" stroke="${CHART.activeRing}" stroke-width="2"/>
            ${anchor&&forecast?`<circle cx="${px(anchor.x)}" cy="${px(anchor.y)}" r="4" fill="${CHART.ink}" stroke="${CHART.activeRing}" stroke-width="2"/>`:''}
          </g>
          ${startMark}
          ${xLabs}
        </svg>
      </div>
      <div class="vn-legend n99-legend" id="vn-legend">
        <span><i class="vn-key-trend"></i>Trend</span>
        <span><i class="vn-key-raw raw"></i>Morning</span>
        ${N.ui.showPost?'<span><i class="vn-key-post post"></i>Post-workout</span>':''}
        ${forecast?'<span><i class="vn-key-proj dash"></i>Projection</span>':''}
      </div>
      <p class="vn-tiny vn-mt3" id="vn-csum">${esc(summary)}</p>
      <div class="vn-togs">${togPost}${togProj}</div>
      ${journeyHTML()}
      ${evidenceHTML(plateau,forecastRead)}
      <details class="vn-more-block"><summary>Why NXTFRM says this</summary>${N.diagnosisCard()}${N.reviewCard()}</details>
      <input type="hidden" id="n99-chart-slider" value="${idx}" aria-hidden="true">
    </section>`;
  }
  function selectPoint(index, opts) {
    const m=N.ui.chart,p=m?.points?.[index];if(!p)return;
    if(opts&&opts.clear)N.ui.selected=null;
    else N.ui.selected=p.date;
    const isLatest=!N.ui.selected||N.ui.selected===m.points.at(-1).date;
    const text=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    const html=(id,v)=>{const el=document.getElementById(id);if(el)el.innerHTML=v;};
    text('n99-chart-date',isLatest?'Latest morning':N.shortDate(p.date));
    html('n99-chart-weight',p.weight.toFixed(1)+'<em>kg</em>');
    html('n99-chart-average',p.avg===null?'—<em>kg</em>':p.avg.toFixed(2)+'<em>kg</em>');
    text('n99-chart-coverage',gapLine(p));
    text('n99-chart-timing',pointTiming(p));
    const postRow=m.postByDate?m.postByDate.get(p.date):null,postBox=document.getElementById('n99-chart-post');
    if(postBox)postBox.hidden=!postRow;
    text('n99-chart-post-weight',postRow?postRow.weight.toFixed(1)+' kg':'');
    text('n99-chart-post-delta',postDelta(p,postRow));
    const line=document.getElementById('n99-chart-cursor'),dot=document.getElementById('n99-chart-active'),slider=document.getElementById('n99-chart-slider');
    line?.setAttribute('x1',p.x);line?.setAttribute('x2',p.x);dot?.setAttribute('cx',p.x);dot?.setAttribute('cy',p.y);
    const halo=document.getElementById('st-chart-halo');halo?.setAttribute('cx',p.x);halo?.setAttribute('cy',p.y);
    if(slider){slider.value=index;slider.setAttribute('aria-valuetext',N.shortDate(p.date)+', '+p.weight+' kilograms');}
  }
  function scrub(event) {
    const m=N.ui.chart,wrap=document.getElementById('vn-chart-wrap'),svg=document.getElementById('n99-chart-svg');
    if(!m?.points?.length||!svg)return;
    if(event.type==='pointerdown'&&wrap?.setPointerCapture){
      try{wrap.setPointerCapture(event.pointerId);}catch(_){}
    }
    const bounds=svg.getBoundingClientRect(),x=(event.clientX-bounds.left)/bounds.width*m.W;
    const index=m.points.reduce((best,p,i)=>Math.abs(p.x-x)<Math.abs(m.points[best].x-x)?i:best,0);
    N.selectPoint(index);
  }
  function chartKey(event) {
    const m=N.ui.chart;if(!m?.points?.length)return;
    const n=m.points.length;
    let idx=Math.max(0,m.points.findIndex(p=>p.date===N.ui.selected));
    if(!N.ui.selected||idx<0)idx=n-1;
    if(event.key==='ArrowRight'){N.selectPoint(Math.min(n-1,idx+1));event.preventDefault();}
    else if(event.key==='ArrowLeft'){N.selectPoint(Math.max(0,idx-1));event.preventDefault();}
    else if(event.key==='Escape'){N.selectPoint(n-1,{clear:true});event.preventDefault();}
  }
  /* A repaint happens for many reasons — logging a set, saving a weigh-in,
     switching tabs. Only a deliberate range change should animate, so it is
     flagged here and consumed once by chartHTML(). Without this the chart would
     replay its reveal every time anything on the app changed. */
  function setRange(range) {N.ui.range=range;N.ui.selected=null;N.ui.chartAnim='range';N.repaint();}
  function setGoalVisible(on) {N.ui.showGoal=!!on;N.repaint();}
  function setPostVisible(on) {N.ui.showPost=!!on;N.repaint();}
  function setForecastVisible(on) {N.ui.showForecast=!!on;N.repaint();}
  function setView(view) {N.ui.view=view;N.repaint();}
  function strengthHTML() {
    const items=N.strengthItems();
    return N.card('Keep your performance',`<p>Compare the same exercise, at the same gym. Four recent sessions establish a repeatable comparison; warm-ups and sets over 15 reps are excluded from the estimate.</p><div class="n99-stats">${N.metric('Holding / improving',items.filter(x=>x.tone==='good').length)}${N.metric('Worth reviewing',items.filter(x=>x.status==='Review').length)}</div>`)+N.card('Exercise trends',items.length?items.map(item=>{
      const values=item.history.slice(-8).map(x=>x.value),min=Math.min(...values)-1,max=Math.max(...values)+1;
      const points=values.map((v,i)=>({x:4+i/Math.max(1,values.length-1)*102,y:35-(v-min)/(max-min)*28}));
      return `<div class="n99-strength-row"><div><h3>${esc(item.name)}</h3><p>${esc(item.gym)} · ${item.sessions} sessions</p><span class="n99-status ${item.tone}">${item.status}${item.delta===null?'':' · '+signed(item.delta,1)+'%'}</span></div><svg viewBox="0 0 110 40" class="n99-spark" role="img" aria-label="Estimated strength across ${item.history.length} sessions"><path d="${smoothPath(points)}" fill="none" stroke="${item.tone==='watch'?'#e8b271':CHART.ink}" stroke-width="2"/><circle cx="${points.at(-1)?.x||4}" cy="${points.at(-1)?.y||20}" r="3" fill="${CHART.ink}"/></svg></div>`;
    }).join(''):'<p>Your first logged workouts will appear here. Equipment loads are not mixed across gyms.</p>')+`<p class="n99-small">Estimated 1RM is a comparison aid, not a tested maximum or proof of muscle retention. Technique, effort and equipment setup affect it.</p>`;
  }
  function bodyHTML() {
    const rows=N.cleanRows(N.cfg().waist,'cm'),last=rows.at(-1),prior=rows.at(-2);
    return N.card('Waist measurement',`<p>Optional, once a week. Use the same tape position and similar conditions.</p><div class="n99-stats">${N.metric('Latest',last?last.cm.toFixed(1)+' cm':'—',last?N.shortDate(last.date):'No measurement yet')}${N.metric('Previous change',last&&prior?signed(last.cm-prior.cm,1)+' cm':'—')}</div>${N.button('+ Log waist','NXT.openWaist()')}${rows.length?`<div class="n99-measurements">${rows.slice(-8).reverse().map(r=>`<button class="n99-list-row" onclick="NXT.openWaist('${r.date}')"><span>${N.shortDate(r.date)}</span><b>${r.cm.toFixed(1)} cm</b><span>Edit ›</span></button>`).join('')}</div>`:''}`)+N.card('Evo scans',`<p>Your existing scans are still available. Compare readings under similar conditions; treat changes as estimates, not proof of fat or muscle loss.</p>${N.button('Open scans','NXT.more(\'body\')',true)}`);
  }
  function progress() {
    const rows=N.weights(),v=N.ui.view;
    document.getElementById('weightPage').innerHTML=`<div class="n99 vn-progress">${N.heading('YOUR RESULTS, IN CONTEXT','Progress.',N.button('+ Log','apx95OpenQuickWeight()',true))}<div class="n99-progress-tabs vn-progress-tabs" role="group" aria-label="Progress view">${[['overview','Weight'],['strength','Performance'],['body','Body']].map(([key,text])=>`<button class="${v===key?'active':''}" aria-pressed="${v===key}" onclick="NXT.setView('${key}')">${text}</button>`).join('')}</div>${v==='strength'?strengthHTML():v==='body'?bodyHTML():`${chartHTML()}<details class="vn-more-block"><summary>Weigh-in history · ${rows.length}</summary>${typeof apx95WeightLogHTML==='function'?apx95WeightLogHTML(rows):rows.slice(-30).reverse().map(r=>`<div class="n99-list-row"><span>${N.shortDate(r.date)}</span><b>${r.weight.toFixed(1)} kg</b></div>`).join('')}${N.button('Manage all weight entries',"NXT.openWeightHistory()",true)}</details>`}</div>`;
  }
  function openWaist(date=state.date) {
    const row=N.cfg().waist.find(r=>r.date===date);
    N.modal(row?'Edit waist measurement':'Log waist',`<form onsubmit="event.preventDefault();NXT.saveWaist('${date}')"><label>Date<input id="n99-waist-date" type="date" max="${state.date}" required value="${date}"></label><label>Waist · cm<input id="n99-waist" type="number" inputmode="decimal" min="30" max="250" step="0.1" required value="${row?row.cm:''}"></label><p class="n99-small">Use the same position each time, with the tape level and without pulling it tight.</p><button class="n99-button" type="submit">Save measurement</button>${row?N.button('Delete measurement',`NXT.deleteWaist('${date}')`,true):''}</form>`);
  }
  function saveWaist(original) {
    const date=val('n99-waist-date'),cm=N.finite(val('n99-waist'));
    if(!Number.isFinite(N.dateMs(date))||date>state.date||cm===null||cm<30||cm>250)return toast('Enter a valid date and waist measurement.');
    const rows=N.cfg().waist;
    if(date!==original&&rows.some(r=>r.date===date)&&!confirm('Replace the measurement already saved on this date?'))return;
    N.cfg().waist=rows.filter(r=>r.date!==original&&r.date!==date).concat({id:uid(),date,cm,ts:Date.now()});N.commit('Waist measurement saved');
  }
  function deleteWaist(date) {if(!confirm('Delete this measurement?'))return;N.cfg().waist=N.cfg().waist.filter(r=>r.date!==date);N.commit('Measurement deleted');}
  function openWeightHistory() {
    const rows=N.weights().slice().reverse();N.modal('Weigh-in history',rows.length?rows.map((r,i)=>`<button class="n99-list-row" onclick="NXT.editWeight('${r.date}')"><span>${N.shortDate(r.date)}</span><b>${r.weight.toFixed(1)} kg</b><span>Edit ›</span></button>`).join(''):'<p>No weights recorded yet.</p>');
  }
  function editWeight(date) {
    const r=N.weights().find(x=>x.date===date);if(!r)return;
    N.ui.editWeightId=r.id;N.ui.editWeightDate=date;
    N.modal('Edit weigh-in',`<form onsubmit="event.preventDefault();NXT.saveWeightEdit()"><label>Date<input id="n99-edit-weight-date" type="date" max="${state.date}" required value="${date}"></label><label>Weight · kg<input id="n99-edit-weight-value" type="number" min="20" max="400" step="0.1" inputmode="decimal" required value="${r.weight}"></label><button type="submit" class="n99-button">Save correction</button>${N.button('Delete this weigh-in','NXT.deleteWeight()',true)}</form>`);
  }
  function findEditWeight() {return (state.bws||[]).find(r=>N.ui.editWeightId?r.id===N.ui.editWeightId:r.date===N.ui.editWeightDate);}
  function saveWeightEdit() {
    const r=findEditWeight(),date=val('n99-edit-weight-date'),weight=N.finite(val('n99-edit-weight-value'));
    if(!r||!Number.isFinite(N.dateMs(date))||date>state.date||weight===null||weight<20||weight>400)return toast('Check the date and weight.');
    r.date=date;r.weight=weight;r.ts=Date.now();N.commit('Weigh-in corrected');
  }
  function deleteWeight() {const r=findEditWeight();if(!r||!confirm('Delete this weigh-in?'))return;state.bws=state.bws.filter(x=>x!==r);N.commit('Weigh-in deleted');}
  return {signed,smoothPath,trendReadText,chartModel,chartHTML,journeyHTML,selectPoint,scrub,chartKey,setRange,setGoalVisible,setPostVisible,setForecastVisible,setView,strengthHTML,bodyHTML,progress,openWaist,saveWaist,deleteWaist,openWeightHistory,editWeight,saveWeightEdit,deleteWeight};
})());

Object.assign(NXT, (()=>{
  const N=NXT;
  function sessionLogs() {return (state.logs||[]).filter(r=>r&&r.date===state.date&&(r.gym||'Gym A')===state.gym&&(!r.dayType||r.dayType===state.dayType));}
  function training() {
    if(state.dayType==='Floorball')return N.old.renderFloorball();
    if(['Rest','Zone2'].includes(state.dayType))return recoveryDay();
    const list=template();if(!list.some(x=>x.name===state.exercise))state.exercise=list[0]?.name||'';
    if(!list.length){document.getElementById('trainPage').innerHTML=`<div class="n99">${N.heading('YOUR WORKOUT',esc(N.label(state.dayType)))}${N.card('Your queue is empty',`<p>Add an exercise or restore your saved programme.</p><div class="n99-stack">${N.button('Add exercise','v88OpenAddModal()')}${N.button('Restore saved programme','NXT.fullSession()',true)}</div>`)}</div>`;return;}
    const ex=state.exercise,t=N.targetFor(ex),done=N.done(ex),cue=N.cue(ex),prev=N.sessionRows(ex,state.gym,state.date,100).at(-1),finished=N.planDone();
    const total=list.reduce((s,e)=>s+Number(e.sets),0),logged=list.reduce((s,e)=>s+Math.min(N.done(e.name),e.sets),0);
    document.getElementById('trainPage').innerHTML=`<div class="n99">${N.heading(esc(state.gym)+' · '+N.shortDate(state.date),esc(N.label(state.dayType)),N.button('Change','showSessionSheet()',true))}
      <div class="n99-session-rail"><span style="width:${total?Math.min(100,logged/total*100):0}%"></span></div><div class="n99-week-footer"><span>${logged} / ${total} working sets</span><button class="n99-text" onclick="cycleGym()">${esc(state.gym)} · switch</button></div>
      ${finished?N.card('Session saved',`<p>${logged} working sets logged. A shortened session still counts; nothing was filled in for you.</p>${N.button('Resume this workout','NXT.resume()',true)}`):`<section class="n99-card n99-focus"><div class="n99-row"><span class="n99-eyebrow">EXERCISE ${Math.max(1,list.findIndex(e=>e.name===ex)+1)} OF ${list.length}</span><span class="n99-status neutral">${Math.min(done+1,t.sets)} / ${t.sets}</span></div><h2>${esc(ex||'Choose an exercise')}</h2><div class="n99-cue"><b>${cue.label}</b><p>${cue.text}</p></div>
      <div class="n99-stats">${N.metric('Previous session',prev?prev.sets[0].weight+' × '+prev.sets[0].reps:'—',prev?N.shortDate(prev.date):'Same exercise & gym')}${N.metric('Rep range',t.reps[0]+'–'+t.reps[1],'Controlled working sets')}</div>
      <form onsubmit="event.preventDefault();NXT.logSet()"><div class="n99-form-grid"><label>Weight · kg<input id="weightInput" type="number" min="0" max="1000" step="0.1" inputmode="decimal" required value="${cue.weight||''}" placeholder="Choose load"></label><label>Reps<input id="repsInput" type="number" min="1" max="100" step="1" inputmode="numeric" required placeholder="${t.reps[0]}–${t.reps[1]}"></label></div>
      <div class="n99-form-grid"><label>Set type<select id="n99-set-type"><option value="working">Working set</option><option value="warmup">Warm-up</option></select></label><label>Reps left · optional<select id="n99-rir"><option value="">Not recorded</option>${[0,1,2,3,4].map(n=>`<option value="${n}">${n===4?'4+':n} reps left</option>`).join('')}</select></label></div><button type="submit" class="n99-button">Log set</button></form>
      <div class="n99-quick">${N.button('Swap exercise','showSubstituteSheet()',true)}${N.button('Next exercise','NXT.nextExercise()',true)}</div></section>`}
      ${apx96RestTimerHTML()}
      <section class="n99-card"><div class="n99-row"><h2>Workout queue</h2><button class="n99-text" onclick="apx96OpenQueueManager()">Manage ›</button></div>${list.map((e,i)=>`<button class="n99-list-row ${e.name===ex?'selected':''}" onclick="NXT.selectExercise(${i})"><span class="n99-order">${N.done(e.name)>=e.sets?'✓':i+1}</span><span><b>${esc(e.name)}</b><small>${e.sets} sets · ${e.reps[0]}–${e.reps[1]} reps</small></span><span>${N.done(e.name)}/${e.sets}</span></button>`).join('')}</section>
      <div class="n99-quick">${N.button('Undo last set','apx96UndoLastSet()',true)}${N.button(finished?'Session complete':'Finish workout',finished?'NXT.openFinishSummary()':'NXT.finish()',finished)}</div>
      <details class="n99-card"><summary>Session options & notes</summary><p>${esc(v88NoteFor(ex)||'No equipment note for this exercise.')}</p><div class="n99-stack">${N.button('Edit equipment note',`v88OpenNoteModal('${jss(ex)}')`,true)}${N.button('Use shorter session','NXT.shorter()',true)}${N.button('Restore full session','NXT.fullSession()',true)}${N.button('Recovery check-in','apx96OpenReadiness()',true)}</div></details>
      ${recentSetsHTML(10)}
    </div>`;
    setTimeout(apx96TickTimer,0);
  }
  function selectExercise(index) {const e=template()[index];if(!e)return;state.exercise=e.name;state.setNum=N.done(e.name)+1;N.repaint();}
  function nextExercise() {
    const list=template(),i=list.findIndex(e=>e.name===state.exercise),next=list[i+1];
    if(next){state.exercise=next.name;state.setNum=N.done(next.name)+1;N.commit();}else finish();
  }
  function logSet() {
    const ex=state.exercise,weight=N.finite(val('weightInput')),reps=N.finite(val('repsInput')),setType=val('n99-set-type')==='warmup'?'warmup':'working',rir=N.finite(val('n99-rir'));
    if(!ex||weight===null||weight<0||weight>1000||reps===null||reps<1||reps>100||!Number.isInteger(reps))return toast('Enter a valid weight and whole-number reps.');
    if(N.planDone())return toast('Resume the workout before adding sets.');
    const t=N.targetFor(ex);
    if(setType==='working'&&N.done(ex)>=t.sets&&!confirm('Planned sets are complete. Add an extra working set?'))return;
    const entry={id:uid(),date:state.date,dayType:state.dayType,gym:state.gym,exercise:ex,setNum:setType==='warmup'?sessionLogs().filter(x=>x.exercise===ex&&x.setType==='warmup').length+1:N.done(ex)+1,weight,reps,setType,rir,volume:Math.round(weight*reps),ts:Date.now()};
    state.logs.push(entry);
    if(setType==='working'&&N.done(ex)>=t.sets) {
      const next=template().find(e=>N.done(e.name)<e.sets);if(next)state.exercise=next.name;
    }
    N.commit(setType==='warmup'?'Warm-up saved':'Working set saved');
    apx96StartRest(setType==='warmup'?60:suggestedRestSeconds(ex));
  }
  function finish() {
    const logs=sessionLogs();if(!logs.length)return toast('Log at least one set before finishing.');
    if(!confirm('Finish this session? All logged sets stay saved, including a shorter workout.'))return;
    N.cfg().sessions[sessionKey()]={date:state.date,gym:state.gym,type:state.dayType,finished:true,finishedAt:Date.now(),sets:logs.filter(x=>x.setType!=='warmup').length};
    apx96SkipRest();N.commit('Workout saved');openFinishSummary();
  }
  function openFinishSummary() {
    const logs=sessionLogs(),working=logs.filter(x=>x.setType!=='warmup');
    N.modal('Session saved',`<p>${esc(N.label(state.dayType))} · ${esc(state.gym)} · ${N.shortDate(state.date)}</p><div class="n99-stats">${N.metric('Working sets',working.length)}${N.metric('Exercises',new Set(working.map(r=>r.exercise)).size)}</div><p>Your logged work is preserved. No need to add cardio simply because this workout is finished.</p><div class="n99-stack">${N.button('Done','closeModal()')}${N.button('Log planned cardio','showCardioSheet()',true)}</div>`);
  }
  function resume() {delete N.cfg().sessions[sessionKey()];N.commit('Session reopened');}
  function shorter() {
    if(!confirm('Use the first three exercises for this session? Already logged sets will remain in history.'))return;
    const list=ensureSessionPlan().slice(0,3);state.sessionPlans[sessionKey()]=list;state.exercise=list[0]||'';state.minimumWorkout=true;N.commit('Shorter session selected');
  }
  function fullSession() {state.sessionPlans[sessionKey()]=N.templateFor().map(e=>e.name);N.cfg().sessionTargets[sessionKey()]=N.copy(N.templateFor());state.minimumWorkout=false;N.commit('Full session restored');}
  function undo() {
    const last=sessionLogs().slice().reverse().sort((a,b)=>Number(b.ts||0)-Number(a.ts||0))[0];if(!last)return toast('No set in this session to undo.');
    if(!confirm(`Undo ${last.exercise} · ${last.weight} kg × ${last.reps}?`))return;
    state.logs=state.logs.filter(x=>x!==last);delete N.cfg().sessions[sessionKey()];state.exercise=last.exercise;N.commit('Last set undone');
  }
  function sessionPicker() {N.modal('Choose today’s session',`<p>Your existing records and saved workout queues stay intact.</p><div class="n99-picker">${N.typeNames().map(t=>N.button(N.label(t),`NXT.chooseSession('${t}')`,state.dayType!==t)).join('')}</div>`);}
  function chooseSession(type) {
    if(!N.typeNames().includes(type))return;
    settings.dayOverrides=settings.dayOverrides||{};settings.dayOverrides[state.date]=type;state.dayType=type;state.exercise=N.templateFor(type)[0]?.name||'';state.setNum=1;N.commit('Today’s session updated');
  }
  function cardioModal(date) {
    const d=typeof date==='string'&&date<=state.date?date:state.date;
    N.modal('Log cardio',`<form onsubmit="event.preventDefault();NXT.saveCardio()"><label>Date<input id="n99-card-date" type="date" max="${state.date}" required value="${d}"></label><label>Activity<select id="n99-card-type">${CARDIO_TYPES.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label><div class="n99-form-grid"><label>Duration · minutes<input id="n99-card-min" type="number" min="1" max="600" step="1" inputmode="numeric" required></label><label>Effort · 1–10<input id="n99-card-effort" type="number" min="1" max="10" step="1" inputmode="numeric" placeholder="Optional"></label></div><div class="n99-form-grid"><label>Speed · km/h<input id="n99-card-speed" type="number" min="0" max="80" step="0.1" inputmode="decimal" placeholder="Optional"></label><label>Incline · %<input id="n99-card-incline" type="number" min="0" max="40" step="0.5" inputmode="decimal" placeholder="Optional"></label></div><label>Average heart rate · optional<input id="n99-card-hr" type="number" min="30" max="240" inputmode="numeric"></label><p class="n99-small">For easy cardio, use a pace where conversation feels comfortable. Speed or incline alone cannot establish your physiological Zone 2.</p><button class="n99-button" type="submit">Save cardio</button></form>`);
  }
  function saveCardio() {
    const duration=N.finite(val('n99-card-min')),intensity=N.finite(val('n99-card-effort')),speed=N.finite(val('n99-card-speed')),incline=N.finite(val('n99-card-incline')),hr=N.finite(val('n99-card-hr'));
    if(duration===null||duration<1||duration>600||intensity!==null&&(intensity<1||intensity>10)||speed!==null&&(speed<0||speed>80)||incline!==null&&(incline<0||incline>40)||hr!==null&&(hr<30||hr>240))return toast('Check your cardio values.');
    const cd=val('n99-card-date')||state.date;if(!Number.isFinite(N.dateMs(cd))||cd>state.date)return toast('Pick today or an earlier date.');
    state.cardio.push({id:uid(),date:cd,gym:state.gym,type:val('n99-card-type'),duration,intensity:intensity??'',speed:speed??'',incline:incline??'',hr:hr??'',ts:Date.now()});N.commit(cd===state.date?'Cardio saved':'Cardio saved for '+N.shortDate(cd));
  }
  function cardioCard() {
    const minutes=N.cardioWeek(),target=Number(settings.zone2WeeklyTarget)||90;
    return N.card('Your cardio rhythm',`<div class="n99-row"><div class="n99-big">${minutes}<small> / ${target} min</small></div><button class="n99-text" onclick="NXT.more('coach')">Edit goal ›</button></div><div class="n99-session-rail"><span style="width:${Math.min(100,minutes/target*100)}%"></span></div><p>${minutes>=target?'Your planned minutes are logged. More is optional, not a requirement.':'Build towards your weekly goal at a manageable pace. Rest days remain part of the plan.'}</p>${N.button('+ Log cardio','showCardioSheet()')}`);
  }
  function recoveryDay() {
    document.getElementById('trainPage').innerHTML=`<div class="n99">${N.heading('TODAY’S PLAN',N.label(state.dayType),N.button('Change','showSessionSheet()',true))}${N.card(state.dayType==='Rest'?'Recovery is part of progress':'Keep it conversational',`<p>${state.dayType==='Rest'?'No workout is due today. Resume your programme after recovery; you do not have a session to make up.':'Use the activity and duration that suit your current fitness. Increase gradually when the current week feels manageable.'}</p>${N.button('Quick recovery check-in','apx96OpenReadiness()',true)}`)}${cardioCard()}${N.reviewCard()}</div>`;
  }
  function recoveryModal() {
    const r=N.cfg().recovery[state.date]||{};
    N.modal('Quick recovery check-in',`<form onsubmit="event.preventDefault();NXT.saveRecovery()"><p>Only today’s check-in guides today’s session. All fields are optional.</p><label>Sleep · hours<input id="n99-sleep" type="number" min="0" max="24" step="0.5" inputmode="decimal" value="${esc(r.sleep??'')}"></label><div class="n99-form-grid"><label>Energy<select id="n99-energy"><option value="">Not recorded</option>${[[1,'Very low'],[2,'Low'],[3,'Okay'],[4,'Good'],[5,'Great']].map(([v,t])=>`<option value="${v}" ${Number(r.energy)===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Soreness<select id="n99-soreness"><option value="">Not recorded</option>${[[1,'None'],[2,'Mild'],[3,'Moderate'],[4,'High'],[5,'Very high']].map(([v,t])=>`<option value="${v}" ${Number(r.soreness)===v?'selected':''}>${t}</option>`).join('')}</select></label></div><button class="n99-button" type="submit">Save check-in</button></form>`);
  }
  function saveRecovery() {
    const sleep=N.finite(val('n99-sleep')),energy=N.finite(val('n99-energy')),soreness=N.finite(val('n99-soreness'));
    if(sleep!==null&&(sleep<0||sleep>24)||energy!==null&&(energy<1||energy>5)||soreness!==null&&(soreness<1||soreness>5))return toast('Check the values.');
    const r={sleep:sleep??'',energy:energy??'',soreness:soreness??'',date:state.date};state.read=r;N.cfg().recovery[state.date]=r;N.commit('Check-in saved');
  }
  function openDay(date) {
    const current=N.typeFor(date),dow=new Date(N.dateMs(date)).getUTCDay(),dn=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dow];
    const logged=(state.logs||[]).some(r=>r.date===date);
    N.modal(N.shortDate(date),`<p>${esc(N.label(current))}. Pick what this day should be.</p>${logged?'<p class="n99-small">This day already has logged sets, so it can’t be changed.</p>':`<div class="n99-picker">${N.typeNames().map(t=>N.button(N.label(t),`NXT.setDayType('${date}','${t}')`,t!==current)).join('')}</div><label class="n99-check"><input type="checkbox" id="n99-day-every"> Make every ${dn} this</label>`}${date===state.date?N.button('Choose a different session','showSessionSheet()',true):''}`);
  }
  function setDayType(date,type) {
    if(!N.typeNames().includes(type))return;
    if((state.logs||[]).some(r=>r.date===date))return toast('This day already has logged sets.');
    const every=!!document.getElementById('n99-day-every')?.checked,dow=new Date(N.dateMs(date)).getUTCDay();
    settings.dayOverrides=settings.dayOverrides||{};
    if(every){settings.weeklyPlan=settings.weeklyPlan||{};settings.weeklyPlan[dow]=type;delete settings.dayOverrides[date];}
    else settings.dayOverrides[date]=type;
    state.dayType=N.typeFor(state.date);state.exercise=N.templateFor()[0]?.name||'';
    N.commit(every?'Weekly plan updated':'Day updated');
  }
  function moveDay(from) {
    const to=val('n99-move-date');if(!Number.isFinite(N.dateMs(to))||to<state.date||to===from)return toast('Choose a different current or future date.');
    if((state.logs||[]).some(r=>r.date===from||r.date===to))return toast('One of these dates already has logged sets. Those sessions will not be moved.');
    const a=N.typeFor(from),b=N.typeFor(to);settings.dayOverrides=settings.dayOverrides||{};settings.dayOverrides[from]=b;settings.dayOverrides[to]=a;
    state.dayType=N.typeFor(state.date);state.exercise=N.templateFor()[0]?.name||'';N.commit('Sessions swapped');
  }
  return {sessionLogs,training,selectExercise,nextExercise,logSet,finish,openFinishSummary,resume,shorter,fullSession,undo,sessionPicker,chooseSession,cardioModal,saveCardio,cardioCard,recoveryDay,recoveryModal,saveRecovery,openDay,setDayType,moveDay};
})());

Object.assign(NXT, (()=>{
  const N=NXT;
  function more(view='hub') {state.moreView=view;state.tab='more';N.repaint();}
  function menuRow(title,sub,view,tag='') {return `<button class="n99-menu-row" onclick="NXT.more('${view}')"><div><h3>${title}</h3><p>${sub}</p></div><span>${tag?`<small>${tag}</small>`:''} ›</span></button>`;}
  function moreView() {
    const view=state.moreView||'hub';
    if(view==='hub') {
      document.getElementById('morePage').innerHTML=`<div class="n99">${N.heading('MAKE IT YOURS','Your setup.','<span class="n99-version">V99 PURPLE</span>')}${N.calorieCard()}<section class="n99-card n99-menu">${menuRow('Goals & calories','Your calorie guide and optional weight range','goals')}${menuRow('Training programme','Full Body A/B/C, saved routines and gym setup','training')}${menuRow('Cardio & recovery','Weekly minutes and quick check-ins','coach')}</section><div class="n99-section-label">APP & DATA</div><section class="n99-card n99-menu">${menuRow('Body & scans','Evo scans and body measurements','body')}${menuRow('Reminders','Your existing weigh-in and activity prompts','notifications')}${menuRow('Data & sync','Backup, restore, exports and cloud','data')}${menuRow('App & install','Version, installation and safe reset','app','V99 PURPLE')}</section><p class="n99-small">NXTFRM · workouts, progress and a clear calorie guide. No fixed programme deadline.</p></div>`;return;
    }
    let content='',title={goals:'Goals & calories',training:'Training programme',coach:'Cardio & recovery'}[view];
    if(view==='goals')content=goalsHTML();
    else if(view==='training')content=programmeHTML();
    else if(view==='coach')content=coachHTML();
    else {
      document.getElementById('morePage').innerHTML=N.old.apx96MoreSectionHTML(view).replace("if(confirm('Clear all local NXTFRM data?')){localStorage.clear();location.reload()}","NXT.resetData()");
      if(view==='data')document.getElementById('morePage').insertAdjacentHTML('beforeend',`<div class="n99">${N.card('Safety copy',`<p>A local recovery copy is made before a restore, cloud load or reset. Export it to keep an independent copy.</p><div class="n99-stack">${N.button('Download safety copy','NXT.exportSafety()',true)}${N.button('Restore safety copy','NXT.restoreSafety()',true)}</div>`)}</div>`);
      return;
    }
    document.getElementById('morePage').innerHTML=`<div class="n99">${N.heading('YOUR SETUP',title,N.button('‹ Back',"NXT.more('hub')",true))}${content}</div>`;
  }
  function goalsHTML() {
    const c=N.cfg();
    return N.calorieCard()+N.card('Your goal range',`<p>Optional. Set a checkpoint you can review alongside waist and strength. There is no deadline or automatic push to keep losing weight.</p>${!c.targetConfirmed?'<p class="n99-small">The values below come from your previous app settings. Save to confirm or change them.</p>':''}<form onsubmit="event.preventDefault();NXT.saveGoal()"><div class="n99-form-grid"><label>Lower weight · kg<input id="n99-goal-low" type="number" min="40" max="300" step="0.1" required value="${goalLow()}"></label><label>Upper weight · kg<input id="n99-goal-high" type="number" min="40" max="300" step="0.1" required value="${goalHigh()}"></label></div><button type="submit" class="n99-button">Save goal range</button></form>`)+N.card('Cut start',`<p>When your cut began and your weight that day. Used for the “down so far” line and the cut journey.</p><form onsubmit="event.preventDefault();NXT.saveCutStart()"><label>Start date<input id="n99-cut-date" type="date" max="${state.date}" value="${esc(settings.cutStart||'')}"></label><label>Start weight · kg<input id="n99-cut-weight" type="number" min="30" max="300" step="0.1" inputmode="decimal" value="${Number(settings.startWeight)||''}"></label><button type="submit" class="n99-button">Save cut start</button></form>`)+N.card('How your advice works',`<p>Weight averages, repeated strength comparisons and dated check-ins inform your review. Recommendations explain their evidence; calorie changes are never automatic.</p>${N.button('Open weekly review','NXT.openReview()',true)}`);
  }
  /* Cut start (D31): the day the cut began and the weight that day. Display and
     "down so far" only; no trend, forecast or calorie calculation reads it. */
  function saveCutStart() {
    const d=val('n99-cut-date'),w=N.finite(val('n99-cut-weight'));
    if(!Number.isFinite(N.dateMs(d))||d>state.date)return toast('Choose the day your cut started.');
    if(w===null||w<30||w>300)return toast('Enter your start weight in kg.');
    settings.cutStart=d;settings.startWeight=w;START_WEIGHT=w;N.commit('Cut start saved');
  }
  function saveGoal() {
    const lo=N.finite(val('n99-goal-low')),hi=N.finite(val('n99-goal-high')),height=Number(N.cfg().profile.height)||176;
    if(lo===null||hi===null||lo<40||hi>300||lo>=hi)return toast('Enter a valid lower and upper weight.');
    if(lo/(height/100)**2<18.5)return toast('That goal is below the adult underweight screening threshold. Seek individual guidance instead.');
    TARGET_LOW=lo;TARGET_HIGH=hi;settings.targetLow=lo;settings.targetHigh=hi;settings.goalLow=lo;settings.goalHigh=hi;N.cfg().targetConfirmed=true;N.commit('Goal range saved');
  }
  function programmeHTML() {
    return N.card('Your weekly plan',`<p>Three full-body sessions, easy cardio between them, and a rest day. All routines remain editable.</p><form onsubmit="event.preventDefault();NXT.saveWeek()"><div class="n99-week-editor">${[1,2,3,4,5,6,0].map(d=>`<label>${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]}<select id="n99-day-${d}">${N.typeNames().map(t=>`<option value="${t}" ${settings.weeklyPlan[d]===t?'selected':''}>${N.label(t)}</option>`).join('')}</select></label>`).join('')}</div><button type="submit" class="n99-button">Save weekly plan</button></form><p class="n99-small">Tap any day on Home to change what it is.</p>`)+N.card('Saved workouts',`<p>Edits apply to future sessions at the selected gym. Logged history and current workout queues are preserved.</p><button class="n99-chip" onclick="cycleGym()">${esc(state.gym)} · switch gym</button><div class="n99-stack">${['FullA','FullB','FullC'].map(t=>N.button(`${N.label(t)} · ${N.templateFor(t).length} exercises`,`NXT.editTemplate('${t}')`,true)).join('')}</div><details><summary>Other saved routines</summary><div class="n99-stack">${['Push','Pull','Pump','Legs'].map(t=>N.button(N.label(t),`NXT.editTemplate('${t}')`,true)).join('')}</div></details>`)+`<details class="n99-card"><summary>Gym names & equipment</summary>${gymSettingsHTML()}</details>`+N.card('Programme defaults',`<p>Restore the A/B/C weekly rhythm or return to the weekly plan saved before this upgrade.</p><div class="n99-stack">${N.button('Use A/B/C weekly rhythm','NXT.restoreWeek(false)',true)}${N.button('Use my previous weekly plan','NXT.restoreWeek(true)',true)}</div>`);
  }
  function saveWeek() {
    const plan={};for(let i=0;i<7;i++){const t=val('n99-day-'+i);if(!N.typeNames().includes(t))return toast('Choose a session for every day.');plan[i]=t;}
    const liftCount=Object.values(plan).filter(t=>!['Rest','Zone2','Floorball'].includes(t)).length;
    if(liftCount>3&&!confirm('This schedules more than three lifting days. Save this custom plan?'))return;
    if(!N.snapshot('Before weekly plan change'))return;
    settings.weeklyPlan=plan;state.dayType=N.typeFor(state.date);state.exercise=N.templateFor()[0]?.name||'';N.commit('Weekly plan saved');
  }
  function restoreWeek(previous) {
    const plan=previous?N.cfg().previousWeeklyPlan:N.split;
    if(!plan)return toast('No previous weekly plan is stored.');
    if(!confirm('Replace your weekly schedule? Dated overrides and all logs will stay unchanged.'))return;
    if(!N.snapshot('Before programme reset'))return;
    settings.weeklyPlan=N.copy(plan);state.dayType=N.typeFor(state.date);state.exercise=N.templateFor()[0]?.name||'';N.commit('Weekly schedule updated');
  }
  function editTemplate(type) {N.ui.draft={type,gym:state.gym,rows:N.copy(N.templateFor(type))};drawTemplate();}
  function captureDraft() {
    const draft=N.ui.draft;if(!draft)return;
    for(let i=0;i<draft.rows.length;i++) {
      const name=document.getElementById('n99-ex-'+i);if(!name)continue;
      draft.rows[i]={...draft.rows[i],name:name.value.trim(),sets:Number(val('n99-sets-'+i)),reps:[Number(val('n99-lo-'+i)),Number(val('n99-hi-'+i))],inc:Number(val('n99-inc-'+i))};
    }
  }
  function drawTemplate() {
    const d=N.ui.draft;
    N.modal(N.label(d.type),`<p>${esc(d.gym)} · saved programme. Your current workout queue stays unchanged.</p><datalist id="n99-exercises">${v88AllExerciseNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist><div class="n99-stack">${d.rows.map((r,i)=>`<fieldset class="n99-template-row"><legend>Exercise ${i+1}</legend><label>Name<input id="n99-ex-${i}" list="n99-exercises" maxlength="100" value="${esc(r.name)}"></label><div class="n99-form-grid four"><label>Sets<input id="n99-sets-${i}" type="number" min="1" max="8" value="${r.sets}"></label><label>Min reps<input id="n99-lo-${i}" type="number" min="1" max="30" value="${r.reps[0]}"></label><label>Max reps<input id="n99-hi-${i}" type="number" min="1" max="30" value="${r.reps[1]}"></label><label>Step · kg<input id="n99-inc-${i}" type="number" min="0" max="25" step="0.25" value="${r.inc}"></label></div><div class="n99-row"><button class="n99-chip" ${i===0?'disabled':''} onclick="NXT.draftMove(${i},-1)">Move up</button><button class="n99-chip" ${i===d.rows.length-1?'disabled':''} onclick="NXT.draftMove(${i},1)">Move down</button><button class="n99-text" onclick="NXT.draftRemove(${i})">Remove</button></div></fieldset>`).join('')}</div><div class="n99-stack">${N.button('+ Add exercise','NXT.draftAdd()',true)}${N.button('Save workout','NXT.saveTemplate()')}${N.button('Restore this workout’s defaults','NXT.defaultTemplate()',true)}</div>`);
  }
  function draftMove(i,dir) {captureDraft();const rows=N.ui.draft.rows,j=i+dir;if(j<0||j>=rows.length)return;[rows[i],rows[j]]=[rows[j],rows[i]];drawTemplate();}
  function draftRemove(i) {captureDraft();if(N.ui.draft.rows.length<=1)return toast('Keep at least one exercise.');N.ui.draft.rows.splice(i,1);drawTemplate();}
  function draftAdd() {captureDraft();if(N.ui.draft.rows.length>=15)return toast('A workout can contain up to 15 exercises.');N.ui.draft.rows.push({name:'',sets:2,reps:[8,12],inc:2.5});drawTemplate();}
  function validTemplate(rows) {return Array.isArray(rows)&&rows.length>0&&rows.length<=15&&new Set(rows.map(x=>x?.name)).size===rows.length&&rows.every(r=>r&&typeof r.name==='string'&&r.name.trim().length>0&&r.name.length<=100&&Number.isInteger(r.sets)&&r.sets>=1&&r.sets<=8&&Array.isArray(r.reps)&&r.reps.length===2&&r.reps.every(x=>Number.isInteger(x)&&x>=1&&x<=30)&&r.reps[0]<=r.reps[1]&&Number.isFinite(r.inc)&&r.inc>=0&&r.inc<=25);}
  function saveTemplate() {
    captureDraft();const d=N.ui.draft;if(!validTemplate(d.rows))return toast('Check names, unique exercises, sets, rep ranges and increments.');
    if(!N.snapshot('Before saved workout edit'))return;
    N.cfg().templates[d.gym+'__'+d.type]=N.copy(d.rows);N.ui.draft=null;N.commit('Workout saved for future sessions');
  }
  function defaultTemplate() {
    const d=N.ui.draft;if(!confirm('Restore the default exercises for this workout?'))return;
    d.rows=N.copy(N.defaults[d.type]||TEMPLATES[d.type]||[]);drawTemplate();
  }
  function saveQueueAsTemplate() {
    if(!confirm('Save this queue as your programme for future sessions at this gym?'))return;
    const rows=template();if(!validTemplate(rows))return toast('Check this workout in the programme editor first.');
    if(!N.snapshot('Before saving workout queue'))return;
    N.cfg().templates[state.gym+'__'+state.dayType]=N.copy(rows);N.commit('Queue saved as your programme');
  }
  function coachHTML() {
    const target=Number(settings.zone2WeeklyTarget)||90;
    return N.card('Weekly cardio target',`<p>A minutes goal, not a calorie-burn score. Start with what you can recover from and review before increasing it.</p><form onsubmit="event.preventDefault();NXT.saveCardioGoal()"><label>Minutes per week<input id="n99-card-goal" type="number" min="30" max="600" step="5" inputmode="numeric" required value="${target}"></label><button type="submit" class="n99-button">Save weekly target</button></form>`)+N.card('Recovery check-ins',`<p>Sleep, energy and soreness are optional. An old check-in is never presented as today’s readiness.</p>${N.button('Update today','apx96OpenReadiness()',true)}<div class="n99-measurements">${Object.values(N.cfg().recovery).filter(r=>r.date&&r.date<=state.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).map(r=>`<div class="n99-list-row"><span>${N.shortDate(r.date)}</span><small>Sleep ${r.sleep===''?'—':r.sleep+'h'} · energy ${r.energy||'—'}/5</small></div>`).join('')}</div>`)+N.reviewCard();
  }
  function saveCardioGoal() {const n=N.finite(val('n99-card-goal'));if(n===null||n<30||n>600)return toast('Choose a weekly target between 30 and 600 minutes.');settings.zone2WeeklyTarget=n;ZONE2_WEEKLY_TARGET=n;N.commit('Weekly cardio target saved');}
  function history() {
    N.old.renderHistory();
    const summary=`<div class="n99">${N.card('This week, together',`<div class="n99-stats">${N.metric('Lifting days',N.completedWeek())}${N.metric('Cardio',N.cardioWeek()+'<small> min</small>')}</div><p>${N.review().title}. ${N.trendStats().change===null?'Weight trend is still building.':'Weekly average change: '+N.signed(N.trendStats().change)+' kg.'}</p>${N.button('Open weekly review','NXT.openReview()',true)}`)}</div>`;
    document.getElementById('historyPage').insertAdjacentHTML('afterbegin',summary);
  }
  function exportSafety() {
    let saved;try{saved=JSON.parse(localStorage.getItem('nxtfrm_recovery_snapshot')||'null');}catch(e){}
    if(!saved?.data)return toast('No safety copy yet. Export an app backup instead. Wearable evidence is not included in that file.');
    const url=URL.createObjectURL(new Blob([JSON.stringify(saved.data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='nxtfrm-safety-copy.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function restoreSafety() {
    let saved;try{saved=JSON.parse(localStorage.getItem('nxtfrm_recovery_snapshot')||'null');}catch(e){}
    if(!saved?.data)return toast('No safety copy is available.');
    restoreData(saved.data,'Restore the safety copy? Your current data will become the new safety copy.');
  }
  function validateBackup(data) {
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('This is not an app backup.');
    const dump=data.localStorageDump||{},get=(field,key,fallback)=>data[field]!==undefined?data[field]:dump[key]?JSON.parse(dump[key]):fallback;
    if(!['logs','bws','cardio','settings'].some(k=>data[k]!==undefined)&&!Object.keys(dump).some(k=>/^apm_(logs|bws|settings)$/.test(k)))throw Error('No recognised app records in this file.');
    const out={};for(const [field,key] of [['logs','apm_logs'],['cardio','apm_cardio'],['floorball','apm_floorball'],['bws','apm_bws'],['scans','apm_evo_scans'],['rest','apm_rest']]) {
      out[field]=get(field,key,[]);if(!Array.isArray(out[field])||out[field].some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('Invalid '+field+' records.');
    }
    out.settings=get('settings','apm_settings',{});if(!out.settings||typeof out.settings!=='object'||Array.isArray(out.settings))throw Error('Invalid settings.');
    if(out.settings.weeklyPlan&&(typeof out.settings.weeklyPlan!=='object'||Array.isArray(out.settings.weeklyPlan)||Object.values(out.settings.weeklyPlan).some(v=>typeof v!=='string')))throw Error('Invalid weekly programme.');
    out.current=data.current||{};if(typeof out.current!=='object'||Array.isArray(out.current)||out.current.gyms&&!Array.isArray(out.current.gyms))throw Error('Invalid current profile.');
    out.notifications=get('notifications','apm_notifications',state.notifs);out.dump=dump;
    return out;
  }
  function restoreData(data,message='Restore this backup? Current app data will be replaced after making a safety copy.') {
    let d;try{d=validateBackup(data);}catch(e){return toast(e.message);}
    if(!confirm(message)||!N.snapshot('Before backup restore'))return;
    for(const key of ['logs','cardio','floorball','bws','scans','rest'])state[key]=d[key];
    const incoming={...SETTINGS_DEFAULTS,...d.settings};settings=incoming;
    for(const [field,key,fallback] of [['sessionPlans','apm_session_plans',{}],['coachInsights','apm_coach_insights',{}],['exerciseNotes','apm_exercise_notes',{}]]) {
      try{state[field]=JSON.parse(d.dump[key]||JSON.stringify(fallback));}catch(e){state[field]=fallback;}
    }
    state.gym=d.current.gym||state.gym;state.gyms=d.current.gyms||state.gyms;state.read=d.current.read||state.read;state.notifs=d.notifications||state.notifs;
    START_WEIGHT=Number(settings.startWeight)||START_WEIGHT;TARGET_LOW=Number(settings.targetLow)||TARGET_LOW;TARGET_HIGH=Number(settings.targetHigh)||TARGET_HIGH;USER_TDEE=Number(settings.tdee)||USER_TDEE;ZONE2_WEEKLY_TARGET=Number(settings.zone2WeeklyTarget)||ZONE2_WEEKLY_TARGET;
    install(false);state.date=today();state.dayType=N.typeFor(state.date);state.exercise=N.templateFor()[0]?.name||'';N.commit('Backup restored');
  }
  function resetData() {
    if(!confirm('Reset NXTFRM records on this device? A safety copy will be kept. Other sites and unrelated storage will not be touched.'))return;
    if(!N.snapshot('Before local reset'))return;
    const keys=['apm_logs','apm_cardio','apm_floorball','apm_bws','apm_evo_scans','apm_rest','apm_current_read','apm_current_gym','apm_gyms','apm_notifications','apm_coach_insights','apm_session_plans','apm_exercise_notes','apm_settings','apm_last_open_date'];
    for(const key of keys)localStorage.removeItem(key);
    // Prevent an automatic cloud write while this device reloads after its local-only reset.
    clearTimeout(cloudTimer);cloudUser=null;
    const reload=()=>{location.reload();};
    try {
      const store=typeof NXT==='object'&&NXT.wearables&&NXT.wearables.store;
      if(store&&typeof store.deleteDatabase==='function'){
        Promise.resolve(store.deleteDatabase()).then(reload,reload);
        return;
      }
    } catch (e) {}
    reload();
  }
  /* D33: fold the plain "Legs" session into Pump (shown as "Legs"). Idempotent; moves
     plan entries, date overrides, saved routines and per-day queues across, and never
     overwrites an existing Pump routine. Logged records are not rewritten. */
  function mergeLegsIntoPump() {
    const c=N.cfg();let changed=false;
    const swap=o=>{if(o&&typeof o==='object'&&!Array.isArray(o))for(const k of Object.keys(o))if(o[k]==='Legs'){o[k]='Pump';changed=true;}};
    swap(settings.weeklyPlan);swap(settings.dayOverrides);swap(c.previousWeeklyPlan);
    if(state.dayType==='Legs'){state.dayType='Pump';changed=true;}
    const moveKeys=(obj)=>{
      if(!obj||typeof obj!=='object'||Array.isArray(obj))return;
      for(const k of Object.keys(obj)){
        if(!k.endsWith('__Legs'))continue;
        const to=k.slice(0,-6)+'__Pump';
        if(obj[to]===undefined){obj[to]=obj[k];delete obj[k];changed=true;}
      }
    };
    moveKeys(c.templates);moveKeys(c.sessionTargets);moveKeys(c.sessions);moveKeys(state.sessionPlans);
    if(changed){try{persist();}catch(e){}}
    return changed;
  }
  function install(migrate=true) {
    for(const [type,rows] of Object.entries(N.defaults))TEMPLATES[type]=N.copy(rows);
    const c=N.cfg();
    if(!c.version&&migrate) {
      if(!N.snapshot('Before V99 upgrade'))return;
      c.previousWeeklyPlan=N.copy(settings.weeklyPlan||{});settings.weeklyPlan=N.copy(N.split);
      c.previousCardioTarget=settings.zone2WeeklyTarget;
      if(Number(settings.zone2WeeklyTarget)===180){settings.zone2WeeklyTarget=90;ZONE2_WEEKLY_TARGET=90;}
      // Preserve an already-started day and all explicit date overrides.
      const started=(state.logs||[]).find(r=>r.date===state.date&&r.dayType);
      if(started){settings.dayOverrides=settings.dayOverrides||{};settings.dayOverrides[state.date]=started.dayType;}
      c.version=99;
      if(!Object.keys(c.recovery).length&&state.read?.date)c.recovery[state.read.date]=N.copy(state.read);
    }
    // Loading an older backup is not permission to replace its programme.
    if(!c.version)c.version=99;
    mergeLegsIntoPump();
    settings.weeklyPlan={...N.split,...settings.weeklyPlan};
    state.dayType=N.typeFor(state.date);state.exercise=N.templateFor()[0]?.name||'';
    persist();
    // Once per app load; the function itself skips a day already recorded.
    N.maybeSnapshotTDEE();
  }
  return {more,moreView,goalsHTML,saveGoal,saveCutStart,programmeHTML,saveWeek,restoreWeek,editTemplate,captureDraft,drawTemplate,draftMove,draftRemove,draftAdd,validTemplate,saveTemplate,defaultTemplate,saveQueueAsTemplate,coachHTML,saveCardioGoal,history,exportSafety,restoreSafety,validateBackup,restoreData,resetData,install};
})());

// Existing routes, records and advanced tools are retained behind the new working surfaces.
renderHome=NXT.home;
renderTrain=NXT.training;
renderWeight=NXT.progress;
renderHistory=NXT.history;
renderMore=NXT.moreView;
getT=NXT.targetFor;
exerciseDefByName=function(name,type=state.dayType){return NXT.cfg().sessionTargets[sessionKey(type)]?.find?.(e=>e.name===name)||NXT.templateFor(type).find(e=>e.name===name)||NXT.old.getT(name)||{name,sets:3,reps:[8,12],inc:2.5};};
ensureSessionPlan=function(type=state.dayType){state.sessionPlans=state.sessionPlans||{};const key=sessionKey(type);if(!Array.isArray(state.sessionPlans[key]))state.sessionPlans[key]=NXT.templateFor(type).map(e=>e.name);if(!Array.isArray(NXT.cfg().sessionTargets[key]))NXT.cfg().sessionTargets[key]=NXT.copy(NXT.templateFor(type));return state.sessionPlans[key];};
setsDone=NXT.done;
safeSetsDone=NXT.done;
safeSuggestedWeight=function(ex){return NXT.cue(ex).weight;};
safeLastSet=function(ex){return NXT.sessionRows(ex,state.gym,state.date,100).at(-1)?.sets?.at(-1)||null;};
logSet=NXT.logSet;
apx96UndoLastSet=NXT.undo;
completeDay=NXT.planDone;
window.showSessionSheet=NXT.sessionPicker;
cycleDayType=NXT.sessionPicker;
window.showCardioSheet=NXT.cardioModal;
renderRest=NXT.recoveryDay;
window.apx96OpenReadiness=NXT.recoveryModal;
apx96SaveReadiness=NXT.saveRecovery;
readiness=function(){
  const r=NXT.cfg().recovery[state.date];
  const head=document.getElementById('headScore');
  if(r&&[r.sleep,r.energy,r.soreness].some(x=>x!==''&&x!==undefined&&x!==null)){
    state.read=r;
    const out={...NXT.old.readiness(),known:true};
    if(head){
      head.textContent=String(out.score);
      head.style.setProperty('--score',out.score);
      head.setAttribute('aria-label','Readiness '+out.score);
    }
    return out;
  }
  if(head){
    head.textContent='—';
    head.style.setProperty('--score',0);
    head.setAttribute('aria-label','No recovery check-in for today');
  }
  return {score:78,msg:'Check-in not logged',known:false};
};
suggestedRestSeconds=function(ex){return /press|row|pulldown|deadlift|squat/i.test(ex)&&!/tricep|pushdown/i.test(ex)?150:90;};
weeklyLossRate=function(){const change=NXT.trendStats().change;return change===null?null:-change;};
weekStartString=NXT.weekStart;
zone2MinutesThisWeek=NXT.cardioWeek;
zone2MinutesThisWeekSafe=NXT.cardioWeek;
projectedGoalDate=function(){return 'No fixed deadline';};
estimatedTotalBurnToday=function(){return Number(NXT.cfg().maintenanceEstimate)||Number(USER_TDEE);};
apx95StrengthItems=NXT.strengthItems;
apx95Verdict=function(){return {...NXT.review(),score:null};};
apx95SetView=NXT.setView;
enhancedRecoveryWarningHTML=function(){return NXT.review().tone==='watch'?NXT.reviewCard():'';};
weeklyPlanHTML=NXT.weekHTML;
workoutTemplateSettingsHTML=NXT.programmeHTML;
apx96SetMoreView=NXT.more;
restoreBackup=function(){if(!window.pendingApexRestore)return toast('Choose a backup first.');NXT.restoreData(window.pendingApexRestore);};
applyCloudPayload=function(payload){
  if(!payload||typeof payload!=='object')return;
  try {
    for(const field of ['logs','cardio','floorball','bws','scans','rest'])if(payload[field]!==undefined&&!Array.isArray(payload[field]))throw Error('Invalid cloud records.');
    if(payload.settings!==undefined&&(!payload.settings||typeof payload.settings!=='object'||Array.isArray(payload.settings)))throw Error('Invalid cloud settings.');
    if(!NXT.snapshot('Before cloud load'))return;
    NXT.old.applyCloudPayload(payload);NXT.install(false);
  }catch(e){toast('Cloud data could not be applied. Your safety copy is available in Data & sync.');}
};
apx96OpenQueueManager=function(){NXT.old.apx96OpenQueueManager();document.querySelector('#modalRoot .sheet')?.insertAdjacentHTML('beforeend',`<div class="n99">${NXT.button('Save queue as future programme','NXT.saveQueueAsTemplate()',true)}</div>`);};
v88OpenNoteModal=function(ex){NXT.ui.noteExercise=ex;NXT.modal('Equipment note',`<p>${esc(state.gym)} · ${esc(ex)}</p><label>Note<textarea id="n99-equipment-note" maxlength="2000">${esc(v88NoteFor(ex))}</textarea></label>${NXT.button('Save note','NXT.saveEquipmentNote()')}`);};
NXT.saveEquipmentNote=function(){state.exerciseNotes=state.exerciseNotes||{};state.exerciseNotes[v88NoteKey(NXT.ui.noteExercise)]=val('n99-equipment-note').trim();NXT.commit('Equipment note saved');};
closeModal=function(){NXT.old.closeModal();window.__apexTyping=false;state.typingWeight=false;NXT.ui.lastFocus?.focus?.();};
apx95OpenQuickWeight=function(){NXT.modal('Log bodyweight',`<form onsubmit="event.preventDefault();apx95SaveQuickWeight()"><div class="n99-form-grid"><label>Date<input id="apx95WeightDate" type="date" required max="${state.date}" value="${state.date}"></label><label>Weight · kg<input id="apx95WeightValue" type="number" min="20" max="400" step="0.1" inputmode="decimal" required></label></div><label>Timing<select id="apx95WeightTime"><option>Morning</option><option>Pre-workout</option><option>Post-workout</option><option>Night</option></select></label><p class="n99-small">Use similar conditions each time. Morning readings drive your progress trend; post-workout readings are shown separately for context. Every original entry stays saved.</p><button type="submit" class="n99-button">Save weigh-in</button></form>`);};
apx95SaveQuickWeight=function(){const date=val('apx95WeightDate'),weight=NXT.finite(val('apx95WeightValue'));if(!Number.isFinite(NXT.dateMs(date))||date>state.date||weight===null||weight<20||weight>400)return toast('Enter a valid date and bodyweight.');const prior=NXT.weights().map(r=>Number(r.weight)),newLow=(val('apx95WeightTime')||'Morning')==='Morning'&&prior.length>=5&&weight<Math.min(...prior);state.bws.push({id:uid(),date,weight,timeOfDay:val('apx95WeightTime')||'Morning',ts:Date.now()});NXT.commit(newLow?'Weigh-in saved · new low':'Weigh-in saved');};
saveEditedSet=function(id){
  const row=(state.logs||[]).find(r=>r.id===id),weight=NXT.finite(val('editSetWeight')),reps=NXT.finite(val('editSetReps')),date=val('editSetDate'),number=NXT.finite(val('editSetNum'));
  if(!row||weight===null||weight<0||weight>1000||reps===null||reps<1||reps>100||!Number.isInteger(reps)||!Number.isFinite(NXT.dateMs(date))||date>state.date||number===null||number<1||!Number.isInteger(number))return toast('Check the weight, reps, set number and date.');
  Object.assign(row,{exercise:val('editSetExercise').trim()||row.exercise,weight,reps,date,setNum:number,notes:val('editSetNotes'),volume:Math.round(weight*reps)});NXT.commit('Set updated');
};
/* One sheet language, applied at a single boundary.
   Two families of sheet exist: NXT.modal()'s `.n99-modal`, which always had a
   dialog role, a focus trap, Escape and focus restoration — and roughly a dozen
   legacy call sites that build `<div class="modal"><div class="sheet">` by
   innerHTML and had none of it. Rather than edit every one of those call sites
   (and miss the next one), the behaviour is attached here, once, to whatever
   lands in #modalRoot. Escape, the Tab trap and focus restoration below now
   query `.modal`, which both families carry. */
(function(){
  const root=document.getElementById('modalRoot');
  if(!root||typeof MutationObserver!=='function')return;
  let restoreTo=null;
  new MutationObserver(function(){
    const modal=root.querySelector('.modal');
    if(!modal){ const back=restoreTo; restoreTo=null; if(back&&document.contains(back))back.focus?.(); return; }
    const sheet=modal.querySelector('.sheet');
    if(!sheet||sheet.dataset.nxtDialog==='1')return;
    sheet.dataset.nxtDialog='1';
    if(!sheet.getAttribute('role'))sheet.setAttribute('role','dialog');
    if(!sheet.getAttribute('aria-modal'))sheet.setAttribute('aria-modal','true');
    // Remember where focus came from so closing can hand it back. Prefer the
    // element that actually had focus when the sheet opened; NXT.ui.lastFocus is
    // only set by NXT.modal(), so for a legacy sheet it is often stale.
    if(!restoreTo){
      const live=document.activeElement;
      restoreTo=(live&&live!==document.body&&!root.contains(live))?live:(NXT.ui.lastFocus||null);
    }
    // Move focus into the sheet if the opener did not already do it.
    if(!sheet.contains(document.activeElement)){
      const target=sheet.querySelector('.n99-icon,button,input,select,textarea,a[href]');
      target?.focus?.();
    }
  }).observe(root,{childList:true,subtree:false});
})();
document.addEventListener('keydown',function(event){
  const modal=document.querySelector('.modal');if(!modal)return;
  if(event.key==='Escape'){event.preventDefault();closeModal();return;}
  if(event.key!=='Tab')return;
  const focusable=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,a[href]')],first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
NXT.install();
document.title='NXTFRM — Your Cut Companion';
if(document.readyState!=='loading')NXT.repaint();

let lastCloudMergeOk=false;
let lastCloudError=null;
let lastCloudSyncAt=null;
(function(){
  function isPlain(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function hasId(r){return r&&r.id!=null&&r.id!=='';}
  function recTs(r){const n=Number(r&&r.ts);return Number.isFinite(n)?n:0;}
  function nonEmpty(v){
    if(Array.isArray(v))return v.length>0;
    if(isPlain(v))return Object.keys(v).length>0;
    return v!=null&&v!=='';
  }
  function mergeObjectsLocalWins(cloud,local){
    const C=isPlain(cloud)?cloud:{};const L=isPlain(local)?local:{};
    const out={};
    for(const key of new Set([...Object.keys(C),...Object.keys(L)])){
      const lv=L[key],cv=C[key];
      if(isPlain(lv)&&isPlain(cv))out[key]=mergeObjectsLocalWins(cv,lv);
      else if(lv!==undefined)out[key]=lv;
      else out[key]=cv;
    }
    return out;
  }
  function unionById(local,cloud){
    const localArr=Array.isArray(local)?local:[];
    const cloudArr=Array.isArray(cloud)?cloud:[];
    const map=new Map();
    const extras=[];
    for(const r of cloudArr){
      if(hasId(r))map.set(r.id,r);
      else if(r)extras.push(r);
    }
    for(const r of localArr){
      if(hasId(r)){
        const other=map.get(r.id);
        if(!other||recTs(r)>recTs(other))map.set(r.id,r);
      }else if(r)extras.push(r);
    }
    const localIds=new Set(localArr.filter(hasId).map(r=>r.id));
    const added=cloudArr.filter(r=>hasId(r)?!localIds.has(r.id):!!r).length;
    return {rows:[...map.values(),...extras],added};
  }
  function mergeCutSupport(local,cloud){
    const L=isPlain(local)?local:{};const C=isPlain(cloud)?cloud:{};
    const out={};
    for(const key of new Set([...Object.keys(C),...Object.keys(L)])){
      const lv=L[key],cv=C[key];
      if(key==='adherence'||key==='suggestions'||key==='tdeeHistory'){
        out[key]=nonEmpty(lv)?lv:cv;
        continue;
      }
      if(isPlain(lv)&&isPlain(cv))out[key]=mergeObjectsLocalWins(cv,lv);
      else if(lv!==undefined)out[key]=lv;
      else out[key]=cv;
    }
    return out;
  }
  NXT.old.applyCloudPayload=function(d){
    lastCloudMergeOk=false;
    if(!d)return;
    const added={};
    for(const field of ['logs','bws','cardio','floorball','scans','rest']){
      if(d[field]===undefined){added[field]=0;continue;}
      const merged=unionById(state[field],d[field]);
      state[field]=merged.rows;
      added[field]=merged.added;
    }
    if(d.gyms)state.gyms=d.gyms;
    if(d.gym)state.gym=d.gym;
    if(d.settings&&isPlain(d.settings)){
      const localSettings=settings&&isPlain(settings)?settings:{};
      const merged={...d.settings,...localSettings};
      merged.cutSupport=mergeCutSupport(localSettings.cutSupport,d.settings.cutSupport);
      settings=merged;
      START_WEIGHT=Number(settings.startWeight)||START_WEIGHT;
      TARGET_HIGH=Number(settings.targetHigh)||TARGET_HIGH;
      TARGET_LOW=Number(settings.targetLow)||TARGET_LOW;
      USER_TDEE=Number(settings.tdee)||USER_TDEE;
      ZONE2_WEEKLY_TARGET=Number(settings.zone2WeeklyTarget)||ZONE2_WEEKLY_TARGET;
    }
    console.log(`Merged cloud: +${added.logs} logs, +${added.bws} bws, +${added.cardio} cardio, +${added.floorball} floorball, +${added.scans} scans, +${added.rest} rest`);
    persist();
    lastCloudMergeOk=true;
  };
})();

let cloudSessionChecked=false;
function hasStoredSbAuthToken(){
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i)||'';
      if(k.startsWith('sb-')&&k.indexOf('auth-token')!==-1){
        const raw=localStorage.getItem(k);
        if(raw&&raw!=='null')return true;
      }
    }
  }catch(e){}
  return false;
}
function clearStoredSbAuthTokens(){
  try{
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i)||'';
      if(k.startsWith('sb-')&&k.indexOf('auth-token')!==-1)keys.push(k);
    }
    for(const k of keys)localStorage.removeItem(k);
  }catch(e){}
}
function sessionIsExpired(session){
  if(!session)return false;
  const exp=Number(session.expires_at);
  return Number.isFinite(exp)&&exp*1000<Date.now();
}
async function cloudSignOutSilent(){
  const prevToast=toast;
  toast=function(){};
  try{await cloudSignOut();}finally{toast=prevToast;clearStoredSbAuthTokens();}
}
initCloudFromStorage=async function(){
  try{
    const client=initSupabaseClient();
    const stored=hasStoredSbAuthToken();
    if(!client){
      cloudSessionChecked=true;
      if(stored)await cloudSignOutSilent();
      return;
    }
    let data=null,error=null;
    try{
      const res=await client.auth.getSession();
      data=res.data;error=res.error;
    }catch(e){error=e;}
    const session=data&&data.session;
    const expired=sessionIsExpired(session);
    if(error||expired||(stored&&!(session&&session.user))){
      cloudSessionChecked=true;
      if(stored||session||cloudUser)await cloudSignOutSilent();
      else {cloudUser=null;cloudStatusText='Not logged in';}
      return;
    }
    if(session&&session.user){
      cloudUser=session.user;
      cloudStatusText='Connected';
      cloudSessionChecked=true;
      const prevToast=toast;
      toast=function(){};
      try{await loadCloudNow();}finally{toast=prevToast;}
      render();
      return;
    }
    cloudSessionChecked=true;
    cloudUser=null;
    cloudStatusText='Not logged in';
  }catch(e){
    cloudSessionChecked=true;
    if(hasStoredSbAuthToken()||cloudUser)try{await cloudSignOutSilent();}catch(x){}
  }finally{
    updateCloudSyncStatus();
  }
};
function cloudSyncAgo(ts){
  const diff=Date.now()-ts;
  if(diff<60000)return 'just now';
  if(diff<3600000)return Math.max(1,Math.floor(diff/60000))+'m ago';
  if(diff<86400000)return Math.max(1,Math.floor(diff/3600000))+'h ago';
  const day=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  if(day(new Date())-day(new Date(ts))===86400000)return 'yesterday';
  return new Date(ts).toLocaleDateString('en-SG',{day:'numeric',month:'short'});
}
function updateCloudSyncStatus(){
  // The V-era header that held #cloudSyncStatus is gone. The status line is
  // optional, but the local-only banner update at the end of this function is
  // not, so the missing element must not short-circuit it.
  const el=document.getElementById('cloudSyncStatus');
  let text='Checking…',tone='busy';
  if(!cloudSessionChecked){text='Checking…';tone='busy';}
  else if(lastCloudError&&cloudStatusText!=='Syncing...'){text='Sync error';tone='warn';}
  else if(cloudStatusText==='Syncing...'){text='Syncing...';tone='busy';}
  else if(!cloudUser){text='Not logged in';tone='warn';}
  else if(lastCloudSyncAt){text='Synced · '+cloudSyncAgo(lastCloudSyncAt);tone='ok';}
  else {text='Syncing...';tone='busy';}
  if(el){
    el.textContent=text;
    el.className='cloud-sync-status is-'+tone;
  }
  updateCloudLocalBanner();
}
let cloudErrDismissed=null;
function updateCloudLocalBanner(){
  const el=document.getElementById('cloudLocalBanner');
  if(!el)return;
  // D11: show only on a genuine actionable condition; never flash before session is known.
  if(!cloudSessionChecked){el.setAttribute('hidden','');return;}
  let dismissed=false,configured=false;
  try{dismissed=localStorage.getItem('nxtfrm_cloud_banner_dismissed')==='1';}catch(e){}
  try{configured=!!((localStorage.getItem('apm_sb_url')||'').trim()&&(localStorage.getItem('apm_sb_key')||'').trim());}catch(e){}
  const signedOut=!cloudUser&&!hasStoredSbAuthToken();
  /* A failed save while signed in is its own condition: say so and offer Retry, rather than telling a signed-in user to log in. */
  const saveFailed=!!lastCloudError&&!signedOut&&lastCloudError!==cloudErrDismissed;
  const syncFail=!!lastCloudError&&signedOut; // A — always actionable
  const cloudButSignedOut=configured&&signedOut; // B — always actionable
  const hasData=(Array.isArray(state.logs)&&state.logs.length>0)||(Array.isArray(state.bws)&&state.bws.length>0);
  const unsyncedAtRisk=signedOut&&hasData&&!lastCloudSyncAt&&!dismissed; // C — dismissible
  const show=saveFailed||syncFail||cloudButSignedOut||unsyncedAtRisk;
  const text=document.getElementById('cloudLocalBannerText'),act=document.getElementById('cloudLocalBannerAction');
  if(text&&act){
    if(saveFailed){
      text.textContent='The last cloud save did not go through. Your data is safe on this device.';
      act.textContent='Retry';act.disabled=false;act.setAttribute('onclick','retryCloudSave()');
    }else{
      text.textContent='Your data is local-only on this device. iOS may wipe it. Log in to sync.';
      act.textContent='Log in';act.disabled=false;act.setAttribute('onclick','openCloudLoginFromBanner()');
    }
  }
  if(show)el.removeAttribute('hidden');else el.setAttribute('hidden','');
}
/* Same save the Settings button runs, started by the lifter from the banner. */
async function retryCloudSave(){
  const act=document.getElementById('cloudLocalBannerAction');
  if(act){act.disabled=true;act.textContent='Retrying…';}
  try{await saveCloudNow(true);}catch(e){}
  updateCloudSyncStatus();
}
function dismissCloudLocalBanner(){
  if(lastCloudError&&(cloudUser||hasStoredSbAuthToken()))cloudErrDismissed=lastCloudError;
  else try{localStorage.setItem('nxtfrm_cloud_banner_dismissed','1');}catch(e){}
  updateCloudLocalBanner();
}
function openCloudLoginFromBanner(){switchTab('more');NXT.more('data');}
window.dismissCloudLocalBanner=dismissCloudLocalBanner;
window.retryCloudSave=retryCloudSave;
window.openCloudLoginFromBanner=openCloudLoginFromBanner;
const _render=render;
render=function(){_render.apply(this,arguments);updateCloudSyncStatus();readiness();};

let cloudSaveQuiet=false;
saveCloudNow=async function(show=true){
  try{
    const client=initSupabaseClient();
    if(!client||!cloudUser){
      if(show)toast('Cloud not connected');
      return;
    }
    cloudStatusText='Syncing...';
    updateCloudSyncStatus();
    const payload=getCloudPayload();
    let row={user_id:cloudUser.id,data:payload,updated_at:new Date().toISOString()};
    let {error}=await client.from('apexcut_profiles').upsert(row,{onConflict:'user_id'});
    if(error&&String(error.message||'').toLowerCase().includes('updated_at')){
      row={user_id:cloudUser.id,data:payload};
      error=(await client.from('apexcut_profiles').upsert(row,{onConflict:'user_id'})).error;
    }
    if(error)throw error;
    lastCloudError=null;
    lastCloudSyncAt=Date.now();
    cloudStatusText='Saved online';
    if(show)toast('Saved to Supabase');
    render();
  }catch(e){
    lastCloudError=e;
    cloudStatusText='Sync error';
    updateCloudSyncStatus();
    if(cloudSaveQuiet){console.error(e);return;}
    if(show)toast(e.message||'Cloud save failed');
    else toast(e.message||'Cloud autosave failed');
  }
};

loadCloudNow=async function(){
  try{
    const client=initSupabaseClient();
    if(!client||!cloudUser){
      toast('Cloud not connected');
      return;
    }
    cloudStatusText='Syncing...';
    updateCloudSyncStatus();
    const {data,error}=await client.from('apexcut_profiles').select('data').eq('user_id',cloudUser.id).maybeSingle();
    if(error)throw error;
    if(!(data&&data.data)){
      cloudStatusText='Loaded online';
      toast('No cloud data yet');
      updateCloudSyncStatus();
      return;
    }
    lastCloudMergeOk=false;
    applyCloudPayload(data.data);
    if(!lastCloudMergeOk)return;
    cloudStatusText='Loaded online';
    toast('Loaded from Supabase');
    const prevToast=toast;
    toast=function(){};
    cloudSaveQuiet=true;
    try{
      await saveCloudNow(false);
    }catch(e){
      lastCloudError=e;
      console.error(e);
    }finally{
      cloudSaveQuiet=false;
      toast=prevToast;
    }
    render();
  }catch(e){
    lastCloudError=e;
    cloudStatusText='Sync error';
    updateCloudSyncStatus();
    toast(e.message||'Cloud load failed');
  }
};

initCloudFromStorage();

