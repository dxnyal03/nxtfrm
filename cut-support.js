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
  /* What the pickers offer. typeNames() stays the validation list, so a stored plan that
     still holds a hidden type keeps saving. */
  const pickTypes = (keep) => typeNames().filter(k=>k!=="Floorball"||(typeof FEATURES!=="undefined"&&FEATURES.floorball)||k===keep);
  /* Weight chart state lives here, in memory only (no storage key). D109 adds the layer flags (Weekly averages and
     Day-to-day spread off, Notes on, Projection and Post-workout off as before), the Layers drawer and Expand flags,
     the compare request, the Open day return point and the measured chart widths. */
  const ui = {view:"overview", range:30, showGoal:false, showPost:false, showForecast:false, selected:null, draft:null, lastFocus:null,
    showWeekly:false, showSpread:false, showNotes:true, layersOpen:false, expanded:false, compare:null, returnTo:null, chartW:{}, wxWide:false};
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
  /* D100 (proposed; the owner asked for notes on the chart, 2026-10-19) — a holiday, a sick day, a refeed, or
     anything else worth seeing beside the line. One per day in cutSupport.chartNotes as {kind, text, ts}; the
     object exists only once a note is saved. Context only: no calculation reads it. */
  const NOTE_KINDS=["holiday","sick","refeed","other"];
  function chartNotes() {
    const raw=settings&&settings.cutSupport&&settings.cutSupport.chartNotes,out={};
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return out;
    for(const date of Object.keys(raw)) {
      const n=raw[date];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+"T12:00:00Z"))||!n||typeof n!=="object"||Array.isArray(n))continue;
      out[date]={kind:NOTE_KINDS.includes(n.kind)?n.kind:"other",text:typeof n.text==="string"?n.text.replace(/\s+/g," ").trim().slice(0,80):"",ts:Number.isFinite(Number(n.ts))?Number(n.ts):0};
    }
    return out;
  }
  function noteLabel(kind) { return {holiday:"Holiday",sick:"Sick",refeed:"Refeed",other:"Note"}[kind]||"Note"; }
  function dateMs(d) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d)))return NaN;
    const ms=Date.parse(d+"T12:00:00Z");
    return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===d?ms:NaN;
  }
  function dateAdd(d,n) { return new Date(dateMs(d)+n*DAY).toISOString().slice(0,10); }
  function weekStart(d=state.date) { return dateAdd(d,-((new Date(dateMs(d)).getUTCDay()+6)%7)); }
  function shortDate(d) { return new Date(dateMs(d)).toLocaleDateString("en-SG",{day:"numeric",month:"short",timeZone:"UTC"}); }
  /* "1 reading", "3 readings". Wording only: the count it is given is printed unchanged beside it. */
  function plural(n,one,many) { return Number(n)===1?one:(many||one+"s"); }
  function label(t) { return names[t]||t||"Workout"; }
  /* D107 — one printing rule for signed figures: rounded first, then signed, so a value that rounds to zero
     prints "0.00" (or "0.0"), never "-0.00" / "−0.0". minus picks the glyph the surface already uses. */
  function signedFixed(v,digits=2,minus="-") {
    const n=finite(v);if(n===null)return "—";
    const r=Number(n.toFixed(digits));
    return r===0?(0).toFixed(digits):(r>0?"+":minus)+Math.abs(r).toFixed(digits);
  }
  /* D107 — a rate is named for the span it was fitted over. detectPlateau fits the 28-day window once its
     readings span at least 14 days; it is the "4-week rate" only when they reach across it (span ≥ 25 days,
     within a couple of days of each end), otherwise "N-day rate". The figure itself is unchanged. */
  function rateSpan(p) {
    const d=Math.max(0,Math.round(Number(p&&p.spanDays)||0)),full=d>=PLATEAU_WINDOW_DAYS-3;
    return {full,days:d,label:full?"4-week rate":`${d}-day rate`,over:full?"over four weeks":`over ${d} days`};
  }
  /* Readings logged at another time of day (D14: contextual, never canonical) — counted so a person who only
     weighs in later in the day is told where their readings are, not that there are none. It counts readings
     (the copy says "N readings"), each passing cleanRows()'s own validity test (above 0, 20–400 kg). */
  function otherTimingCount(input=state.bws) {
    return (Array.isArray(input)?input:[]).filter(r=>{
      if(!r||!Number.isFinite(dateMs(r.date))||r.date>state.date)return false;
      const v=finite(r.weight),t=String(r.timeOfDay||"").trim().toLowerCase();
      return v!==null&&v>0&&v>=20&&v<=400&&t!==""&&t!=="morning";
    }).length;
  }
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
  /* D104 (proposed) — forecast time semantics. forecastGoal() fits the 21 days ending at its last trend-ready
     morning, the model origin, and counts every week from there; it never reads the calendar. This view is the
     one place its weeks become dates, so every surface prints the same arrival, anchored at the origin: an old
     forecast keeps its own date instead of sliding a day later for every day without a weigh-in. Weeks still
     count from the origin; weeksRemaining counts from the calculation date (today), for copy that says "away".
     Freshness is days since the origin, on thresholds the app already uses: fresh to 3 (EWMA_GAP_DAYS; past it
     the trend restarts), aging to 14 (the coach's STALE_DAYS, the span of its weigh-in nudge), stale to 21
     (FORECAST_WINDOW_DAYS; a fit made today would hold no reading), then expired, as is any forecast whose
     earliest arrival (arrivalLow) is today or past. Fresh and aging may print the anchored date, aging "as of"
     the origin; stale and expired pause and never print an arrival. Freshness is separate from the model's own
     confidence (modelConfidence, unchanged): an old forecast is not a less certain one, it is an old one. The
     last observation (the newest morning reading) can be later than the origin: after a break of more than three
     days the trend needs three mornings before it, and the fit, move on. Nothing here changes a number. */
  const FORECAST_FRESH_DAYS=EWMA_GAP_DAYS,FORECAST_AGING_DAYS=14,FORECAST_STALE_DAYS=FORECAST_WINDOW_DAYS;
  function forecastView(rows=weights(),calculationDate=state.date) {
    const calc=Number.isFinite(dateMs(calculationDate))?calculationDate:state.date;
    const seen=(Array.isArray(rows)?rows:[]).filter(r=>r&&Number.isFinite(dateMs(r.date))&&r.date<=calc);
    const f=forecastGoal(seen),origin=f.lastDate||null;
    const obs=seen.reduce((m,r)=>!m||r.date>m?r.date:m,null);
    const since=d=>d?Math.round((dateMs(calc)-dateMs(d))/DAY):null;
    const ahead=!!(f.ok&&origin&&finite(f.weeks)!==null&&f.weeks>0);
    const at=w=>ahead?dateAdd(origin,w*7):null;
    const arrivalDate=at(f.weeks),arrivalLow=at(f.lowWeeks),arrivalHigh=at(f.highWeeks);
    // "About N weeks away" from today: never 0 while the date is still ahead, nothing once it has passed.
    const left=d=>!d?null:d<=calc?0:Math.max(1,Math.round((dateMs(d)-dateMs(calc))/DAY/7));
    const daysSinceOrigin=since(origin);
    let freshness=null;
    if(origin)freshness=arrivalLow&&calc>=arrivalLow?"expired":daysSinceOrigin<=FORECAST_FRESH_DAYS?"fresh":
      daysSinceOrigin<=FORECAST_AGING_DAYS?"aging":daysSinceOrigin<=FORECAST_STALE_DAYS?"stale":"expired";
    const current=freshness==="fresh"||freshness==="aging",goalConfirmed=!!cfg().targetConfirmed;
    return {ok:f.ok,reason:f.reason,lastObservationDate:obs,modelOriginDate:origin,calculationDate:calc,
      originLevel:f.fittedLevel,slopeKgWk:finite(f.slope)===null?null:f.slope*7,modelConfidence:f.confidence,
      weeks:f.weeks,lowWeeks:f.lowWeeks,highWeeks:f.highWeeks,arrivalDate,arrivalLow,arrivalHigh,
      weeksRemaining:left(arrivalDate),lowWeeksRemaining:left(arrivalLow),highWeeksRemaining:left(arrivalHigh),
      daysSinceOrigin,daysSinceObservation:since(obs),freshness,current,goalConfirmed,
      // No confirmed goal, no goal ETA anywhere (goalHigh() still falls back to a default range).
      showArrival:ahead&&current&&goalConfirmed,
      // Elapsed copy ("down in 11 weeks", the share card's range) counts to the origin once it is not fresh.
      asOfDate:origin&&freshness!=="fresh"?origin:calc};
  }
  /* The words for a forecast's age, so every surface says it the same way (D104). */
  function forecastWords(v) {
    const out={asOf:"",paused:"",restart:""};
    if(!v||!v.modelOriginDate)return out;
    if(v.freshness==="aging")out.asOf=`as of ${shortDate(v.modelOriginDate)}`;
    const n=v.daysSinceObservation;
    if((v.freshness==="stale"||v.freshness==="expired")&&v.lastObservationDate)
      out.paused=`Last morning weigh-in ${shortDate(v.lastObservationDate)}, ${n===0?"today":n===1?"yesterday":n+" days ago"}.`;
    if(v.lastObservationDate&&v.lastObservationDate>v.modelOriginDate)
      out.restart=`After a break of more than ${EWMA_GAP_DAYS} days the trend needs three mornings before the projection moves on.`;
    return out;
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
  /* D97 (proposed; the owner asked for "Now" to stop lagging, 2026-10-19) — where your weight is now.
     At each trend-ready reading: the level of the least-squares line through the trend-ready morning
     readings of the 21 days ending there (forecastGoal's own window and fit), read at that day, once the
     window holds FORECAST_TRUST_POINTS readings; until then, the smoothed trend. The trend line itself
     (ewmaTrend) is unchanged; it trails a moving weight by about ten days, which this does not. At the
     last reading the value is forecastGoal's fittedLevel whenever the forecast computes one. */
  function levelSeries(rows=weights()) {
    const series=ewmaTrend(rows).filter(r=>r.trendReady),out=[];
    let lo=0;
    for(let i=0;i<series.length;i++) {
      const d=series[i].date,start=dateAdd(d,1-FORECAST_WINDOW_DAYS);
      while(lo<i&&series[lo].date<start)lo++;
      const win=series.slice(lo,i+1);
      let value=series[i].avg,source="trend";
      if(win.length>=FORECAST_TRUST_POINTS) {
        const fit=lsFit(win.map(r=>({x:(dateMs(r.date)-dateMs(start))/DAY,y:r.weight})));
        if(fit.sxx>0&&Number.isFinite(fit.slope)&&Number.isFinite(fit.intercept)){value=fit.intercept+fit.slope*((dateMs(d)-dateMs(start))/DAY);source="line";}
      }
      out.push({date:d,value,source,trend:series[i].avg,weight:series[i].weight});
    }
    return out;
  }
  function nowLevel(rows=weights()) { const s=levelSeries(rows); return s.length?s[s.length-1]:null; }
  /* D96 — the four-week rate across the cut: plateauWindow (the rate and its 95% range) read with its
     end moved back one day at a time. Same fit, same window, same thresholds. ref is the smoothed trend at
     that day, the body weight review() divides by for the 1% line (D37). Days without a window are skipped. */
  function rateSeries(rows=weights(),from=null,to=state.date) {
    const first=rows.length?rows.reduce((m,r)=>r.date<m?r.date:m,rows[0].date):null;
    let d=from&&Number.isFinite(dateMs(from))?from:first;
    if(!d||!Number.isFinite(dateMs(to)))return [];
    const tr=ewmaTrend(rows).filter(r=>r.trendReady),out=[];
    let k=-1,guard=0;
    for(;d<=to&&guard<800;d=dateAdd(d,1),guard++) {
      while(k+1<tr.length&&tr[k+1].date<=d)k++;
      const w=plateauWindow(rows,d,PLATEAU_WINDOW_DAYS);
      if(!w||k<0)continue;
      out.push({date:d,weeklyRate:w.weeklyRate,lower:w.lower,upper:w.upper,status:w.status,ref:tr[k].avg});
    }
    return out;
  }
  function trendStats(rows=weights()) {
    const current=windowStats(rows),previous=windowStats(rows,dateAdd(state.date,-7)),earlier=windowStats(rows,dateAdd(state.date,-14));
    const change=current.n>=3&&previous.n>=3?current.avg-previous.avg:null;
    const priorChange=previous.n>=3&&earlier.n>=3?previous.avg-earlier.avg:null;
    return {current,previous,earlier,change,priorChange,percent:change!==null?change/previous.avg*100:null};
  }
  /* Compare periods (Weight "Instrument", spec §11; proposed D110). A presentation of figures the app already has
     (D9): the morning readings in two calendar windows, their count and coverage, average, lowest, and the smoothed
     trend at each end. It reads the canonical morning set only (cleanRows), so a post-workout or other-time reading
     can never enter a window. The difference is returned unrounded; rounding to 0.1 kg happens on screen, and
     roundingNote says when the printed averages would not subtract to the printed change. Nothing here is a test of
     significance, and nothing here writes. */
  const COMPARE_MIN_MORNINGS=3,COMPARE_MIN_COVERAGE=.3;
  function spanLabel(from,to) {
    if(from===to)return shortDate(from);
    return from.slice(0,7)===to.slice(0,7)?`${Number(from.slice(8))}–${shortDate(to)}`:`${shortDate(from)}–${shortDate(to)}`;
  }
  function daysIn(from,to) { return Math.round((dateMs(to)-dateMs(from))/DAY)+1; }
  function monthStart(d) { return d.slice(0,8)+"01"; }
  function monthEnd(d) { const n=new Date(dateMs(monthStart(d)));n.setUTCMonth(n.getUTCMonth()+1,0);return n.toISOString().slice(0,10); }
  function shiftMonth(d,k) { const n=new Date(dateMs(monthStart(d)));n.setUTCMonth(n.getUTCMonth()+k);return n.toISOString().slice(0,10); }
  /* One window: {from, to, label, days, partial, elapsed, total, completed}. A window never runs past today. */
  function compareWindow(from,to,extra) { return {from,to,label:spanLabel(from,to),days:daysIn(from,to),partial:false,completed:false,...(extra||{})}; }
  /* The two windows a comparison kind names. Kinds: 'previous' (the matched window immediately before),
     'sameDays' (the same elapsed calendar days of last month), 'completed' (the last completed weeks or months,
     labelled completed), 'firstLast' (first vs last 4 weeks of the cut; Cut range only). Returns {kind, range,
     before, current, ok, reason}; before/current are null when the kind cannot apply. */
  function compareWindows(range=30,kind="previous",today=state.date) {
    const out=(before,current,reason)=>({kind,range,before,current,ok:!!(before&&current)&&!reason,reason:reason||""});
    const cutStart=typeof settings!=="undefined"&&settings&&Number.isFinite(dateMs(settings.cutStart))&&settings.cutStart<=today?settings.cutStart:null;
    let days=range==="cut"?(cutStart?daysIn(cutStart,today):null):Math.round(Number(range));
    if(kind==="firstLast") {
      if(range!=="cut")return out(null,null,"Only for the Cut range");
      if(!cutStart)return out(null,null,"Needs a cut start date");
      if(days<56)return out(null,null,"Needs 8 weeks of cut");
      return out(compareWindow(cutStart,dateAdd(cutStart,27),{name:"First 4 weeks"}),compareWindow(dateAdd(today,-27),today,{name:"Last 4 weeks"}));
    }
    if(!(days>0))return out(null,null,"Needs a cut start date");
    if(kind==="sameDays") {
      const ms=monthStart(today),elapsed=daysIn(ms,today),total=daysIn(ms,monthEnd(today));
      const pms=shiftMonth(today,-1),pTotal=daysIn(pms,monthEnd(pms)),pTo=dateAdd(pms,Math.min(elapsed,pTotal)-1);
      return out(compareWindow(pms,pTo,{name:"Same days last month"}),compareWindow(ms,today,{name:"This month",partial:elapsed<total,elapsed,total}));
    }
    if(kind==="completed") {
      if(range==="cut")return out(null,null,"Not for the Cut range");
      if(days<28) {
        /* Weeks: Mon–Sun, ending before this week; as many as the range holds (2W → two weeks). */
        const n=Math.max(1,Math.round(days/7)),end=dateAdd(weekStart(today),-1);
        const cFrom=dateAdd(end,1-7*n),bTo=dateAdd(cFrom,-1),bFrom=dateAdd(bTo,1-7*n);
        return out(compareWindow(bFrom,bTo,{completed:true,unit:"week",count:n}),compareWindow(cFrom,end,{completed:true,unit:"week",count:n}));
      }
      const n=Math.max(1,Math.round(days/30)),cFrom=shiftMonth(today,-n),cTo=dateAdd(monthStart(today),-1),bFrom=shiftMonth(today,-2*n),bTo=dateAdd(cFrom,-1);
      return out(compareWindow(bFrom,bTo,{completed:true,unit:"month",count:n}),compareWindow(cFrom,cTo,{completed:true,unit:"month",count:n}));
    }
    if(kind!=="previous")return out(null,null,"Unknown comparison");
    const cFrom=dateAdd(today,1-days),bTo=dateAdd(cFrom,-1);
    return out(compareWindow(dateAdd(bTo,1-days),bTo,{name:"Before"}),compareWindow(cFrom,today,{name:"This range"}));
  }
  /* Figures for one window. trendFirst/trendLast are the smoothed trend on the window's first and last morning,
     and only when the trend is ready on both (it carries in from the readings before the window). */
  function periodStats(rows,series,w) {
    const to=w.to>state.date?state.date:w.to,days=daysIn(w.from,to);
    const ws=windowStats(rows,to,days),items=ws.items;
    let low=null;for(const r of items)if(!low||r.weight<low.weight)low={weight:r.weight,date:r.date};
    const inWin=series.filter(r=>r.date>=w.from&&r.date<=to),first=inWin[0],last=inWin.at(-1);
    const trendFirst=first&&first.avg!==null?first.avg:null,trendLast=last&&last.avg!==null?last.avg:null;
    const coverage=days>0?ws.n/days:0;
    let reason="";
    if(ws.n<COMPARE_MIN_MORNINGS||coverage<COMPARE_MIN_COVERAGE)reason=`${ws.n} ${plural(ws.n,"morning")} in ${w.label} — too few to compare`;
    const trendReason=trendFirst===null||trendLast===null?(ws.n?`Smoothed trend not ready at the ${trendFirst===null?"start":"end"} of ${w.label}`:`No mornings in ${w.label}`):"";
    return {from:w.from,to,label:w.label,n:ws.n,days,coverage,avg:ws.avg,low,trendFirst,trendLast,
      trendChange:trendFirst!==null&&trendLast!==null&&inWin.length>1?trendLast-trendFirst:null,trendReason,
      partial:!!w.partial,elapsed:w.elapsed||null,total:w.total||null,completed:!!w.completed,ok:!reason,reason};
  }
  /* comparePeriods(rows, before, current, quantity): before/current are {from,to} windows (compareWindows' own, or
     any two). quantity is 'avg' (Average morning, the default), 'trendChange' or 'low' (Lowest morning). diff is
     current − before, unrounded. */
  function comparePeriods(rows=weights(),before,current,quantity="avg") {
    const morning=cleanRows(rows),series=trend(morning);
    const win=w=>w&&w.from&&w.to?{...w,label:w.label||spanLabel(w.from,w.to)}:null;
    const a=win(before),b=win(current);
    if(!a||!b)return {a:null,b:null,quantity,diff:null,ok:false,reason:"No windows to compare",roundingNote:false};
    const A=periodStats(morning,series,a),B=periodStats(morning,series,b);
    const pick=s=>quantity==="low"?(s.low?s.low.weight:null):quantity==="trendChange"?s.trendChange:s.avg;
    const va=pick(A),vb=pick(B);
    let reason=!A.ok?A.reason:!B.ok?B.reason:"";
    if(!reason&&quantity==="trendChange"&&(va===null||vb===null))reason=(va===null?A:B).trendReason||"Trend not ready";
    const ok=!reason&&va!==null&&vb!==null,diff=ok?vb-va:null;
    /* The change is the unrounded difference. When the two printed (0.1 kg) values would not subtract to the
       printed change, the screen adds a one-line footnote saying so. */
    const r1=v=>Number(v.toFixed(1));
    const roundingNote=ok&&Math.abs(r1(r1(vb)-r1(va))-r1(diff))>1e-9;
    return {a:A,b:B,quantity,diff,ok,reason,roundingNote};
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
    /* D106 — waist evidence only while the waist feature is on (D55). */
    const rows=weights(),s=trendStats(rows),lifts=strengthItems(),waist=FEATURES.waist?cleanRows(cfg().waist,"cm"):[],check=cfg().recovery[state.date];
    const base={tone:"neutral",title:"Building your baseline",message:"Log morning weights across two weeks. Each weekly average needs at least three readings.",action:"Keep logging",reason:`${s.current.n} ${plural(s.current.n,"reading")} this week · ${s.previous.n} last week`,change:s.change};
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
    const kg=v=>signedFixed(v,2)+" kg/wk";
    const fresh=lifts.filter(x=>x.delta!==null),holding=fresh.filter(x=>x.status==="Improving"||x.status==="Holding steady").length;
    const slipping=fresh.some(x=>x.status==="Watch"||x.status==="Review");
    const strengthLine=fresh.length?`${holding} of ${fresh.length} tracked lift${fresh.length===1?" is":"s are"} holding or improving.`:"Strength history is still building, so muscle retention is not yet assessable.";
    /* D104: counted from today to the anchored arrival, said "as of" the last reading once it is not fresh,
       silent once the forecast is paused, and silent without a confirmed goal. */
    const fc=forecastView(rows),wk=fc.weeksRemaining,eta=fc.showArrival?` ${fc.freshness==="aging"?`At your pace as of ${shortDate(fc.modelOriginDate)},`:"At this pace"} your goal range is about ${wk} week${wk===1?"":"s"} away.`:"";
    /* D107: the reason names the span the rate was fitted over ("over 15 days"), not always "four weeks". */
    const why=`${kg(rate)} ${pl.ok?rateSpan(pl).over:"over the last week"} · ${Math.abs(pct).toFixed(1)}% of body weight`;
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
  /* Stage 1 — one caution predicate for every surface. Today's decision card, the Progress
     diagnosis and Train's coach line all ask this instead of re-reading the rate: review()
     already applied the 1% rule, the lift review and the recovery check-in, so "cautious"
     is simply what review() concluded (tone watch, or a recovery / slipping-lifts verdict). */
  function cautionOf(r) {
    return !!r&&(r.tone==="watch"||/slipping|recovery/i.test(String(r.title||""))||/recovery/i.test(String(r.action||"")));
  }
  function caution() {
    const r=review();
    return {cautious:cautionOf(r),tone:r.tone,title:r.title,message:r.message,action:r.action,reason:r.reason};
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
  /* D49 — the calorie system is switched off. The owner does not log calories or
     adherence, so the guide, the adherence taps, the energy estimate and the
     adherence-dependent verdicts are hidden behind this one flag. Stored data
     (cfg().calories, adherence, tdeeHistory) is untouched and the maths is intact:
     flip the flag and everything returns. */
  const CALORIES_ENABLED=false;
  /* D55 — features the owner does not use are switched off the same way: entry points
     hidden, stored records and engine maths untouched, history still shows what exists.
     Flip a flag to bring a feature back. */
  const FEATURES={calories:CALORIES_ENABLED,floorball:false,wearable:false,waist:false,classic:false,reminders:false,checkin:false};
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
    const p=detectPlateau(),f=forecastGoal(),fv=forecastView(),fw=forecastWords(fv),at=adaptiveTDEE();
    const days=p.plateauDays||p.windowDays||PLATEAU_WINDOW_DAYS;
    const end=state.date,start=dateAdd(end,1-days);
    const map=cfg().adherence;let adhSum=0,adhLogged=0,adhDays=0;
    for(let d=start;d<=end;d=dateAdd(d,1)) {
      adhDays++;
      const factor=map[d]?ADHERENCE_FACTORS[map[d].status]:undefined;
      if(factor!==undefined){adhSum+=factor;adhLogged++;}
    }
    const adhMean=adhDays?adhSum/adhDays:0;
    /* D106 — a switched-off feature never feeds a visible conclusion: with waist off (D55) its stored
       rows stay in storage and backups but no verdict ("waist is shrinking") is drawn from them. */
    const waistRows=FEATURES.waist?cleanRows(cfg().waist,"cm").filter(r=>r.date>=start&&r.date<=end):[];
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
    const rate=p.weeklyRate===null?"—":`${signedFixed(p.weeklyRate,2)} kg / week · ${p.spanDays||days} ${plural(p.spanDays||days,"day")}`;
    const rateTone=!p.ok||p.status==="undetermined"?"neutral":p.status==="losing"?"good":"watch";
    const adhValue=`Logged: ${adhLogged} of ${adhDays} days · ${pct(adhMean)}% weighted`;
    const adhTone=adhLogged===0?"neutral":adhMean>=.85?"good":"watch";
    const plateauValue=p.plateau?`${p.plateauDays} days`:!p.ok||p.status==="undetermined"?"Undetermined":"No plateau detected";
    const plateauTone=p.plateau?"watch":p.status==="losing"?"good":"neutral";
    const base=[
      {label:"Weight trend",value:rate,tone:rateTone},
      {label:"Plateau",value:plateauValue,tone:plateauTone}
    ];
    if(CALORIES_ENABLED)base.splice(1,0,{label:"Adherence",value:adhValue,tone:adhTone});
    const rank=complete=>{
      if(!p.ok||p.confidence==="low"||p.confidence==="none")return complete?"medium":"low";
      if(p.confidence==="high"&&complete)return "high";
      return "medium";
    };
    const pack=(verdict,headline,extra,actions,confidence,reason)=>({
      ok:true,verdict,headline,evidence:base.concat(extra).slice(0,4),actions,confidence,reason
    });
    /* D108: a paused forecast (one that was made, then went stale) means mornings stopped, not that a count is short; and with the readings
       already at PLATEAU_MIN_READINGS the shortfall is span, not readings. "1 more day" after a 15-day absence
       named neither, so both take the no-missing-record read ("Keep weighing in each morning"). */
    const lapsed=!!(f.ok&&fv.modelOriginDate&&!fv.current);
    const gap=()=>{
      if(!p.ok)return lapsed||(p.n||0)>=PLATEAU_MIN_READINGS?{what:"weigh-ins",need:null}:{what:"weigh-ins",need:Math.max(1,PLATEAU_MIN_READINGS-p.n)};
      if(CALORIES_ENABLED&&adhLogged<10)return {what:"adherence",need:10-adhLogged};
      if(FEATURES.waist&&waistRows.length<2)return {what:"waist",need:Math.max(1,2-waistRows.length)};
      if(CALORIES_ENABLED&&(hist.length<2&&!(hist.length>=1&&at.ok&&hist[0].date!==state.date)))return {what:"TDEE snapshots",need:Math.max(1,2-hist.length)};
      if(FEATURES.checkin&&lifts.length<2&&lowReady<5)return {what:"recovery check-ins",need:Math.max(1,5-lowReady)};
      /* D107: the weigh-ins already cover the window (p.ok), so asking for "7 more days" after 30 of 30 mornings
         was a count of nothing. No missing record is named; the readings row says what the read rests on. */
      return {what:"weigh-ins",need:null};
    };
    if(!p.plateau) {
      /* Stage 1: this card may not say "keep the plan" while the shared decision says to be
         careful. Same verdict words, same rate sentence and same action as Today; the two
         extra rows are the decision itself and how many mornings it rests on. */
      const care=caution();
      if(care.cautious) {
        const cover={label:"Readings",value:`${p.n||0} over ${p.spanDays||0} ${plural(p.spanDays||0,"day")}`,tone:"neutral"};
        return pack("caution",`${care.title} — ${care.message}`,[{label:"Decision",value:care.title,tone:"watch"},cover],
          [{text:`${care.action}.`,kind:"hold"}],p.ok&&p.confidence==="high"?"high":p.ok?"medium":"low",care.reason);
      }
    }
    /* D104: "Cut is progressing" needs a forecast that is still current (fresh or aging). Its row counts from
       today to the anchored date, names that date and, once not fresh, the reading it rests on; without a
       confirmed goal there is no row at all. A paused forecast falls through to the cases below. It also needs
       the rate Today's review() reads (the plateau window's, else week on week): with neither, Today says
       "Building your baseline" and this card may not say "progressing" (D108). */
    const ts=trendStats(),rateRead=p.ok&&finite(p.weeklyRate)!==null?p.weeklyRate:ts.change;
    const fcRow=()=>{const wk=fv.weeksRemaining,asOf=fw.asOf?` · ${fw.asOf}`:"";
      return {label:"Forecast",value:f.weeks===0?`At goal range${asOf}`:`~${wk} week${wk===1?"":"s"} to goal · around ${shortDate(fv.arrivalDate)}${asOf}`,tone:"good"};};
    if(!p.plateau&&f.ok&&finite(f.slope)!==null&&f.slope<0&&fv.current&&finite(rateRead)!==null) {
      const extra=!fv.goalConfirmed?[]:[fcRow()];
      const conf=f.confidence==="high"&&p.ok&&p.confidence==="high"?"high":f.confidence==="low"||!p.ok?"low":"medium";
      return pack("no_issue","Cut is progressing.",extra,[{text:"Keep the current plan.",kind:"hold"}],conf,"Weight is still trending down.");
    }
    if(CALORIES_ENABLED&&p.plateau&&adhMean<.85) {
      return pack("dietary_drift",`No weight change, but adherence is ${pct(adhMean)}%. This looks like compliance, not metabolism.`,
        [],[{text:"Tighten adherence before changing calories.",kind:"adjust"}],
        rank(adhDays>=14),"Adherence is below 85% over the plateau window.");
    }
    if(p.plateau&&waistDrop!==null&&waistDrop>.5&&(!CALORIES_ENABLED||adhMean>=.85)) {
      return pack("water_masking","Scale is flat, but waist is shrinking. This may not be a real plateau.",
        [{label:"Waist",value:`−${waistDrop.toFixed(1)} cm over ${days} days`,tone:"good"}],
        [{text:"Keep measuring waist; don’t cut calories yet.",kind:"hold"}],
        rank(waistRows.length>=2),CALORIES_ENABLED?"Waist dropped while adherence held.":"Waist dropped while the scale stayed flat.");
    }
    if(p.plateau&&(lifts.length>=2||lowReady>=5)) {
      const extra=[];
      if(lifts.length)extra.push({label:"Strength",value:lifts.slice(0,2).map(x=>`${x.name} ${x.delta.toFixed(1)}%`).join(" · "),tone:"watch"});
      if(lowReady)extra.push({label:"Readiness",value:`Below 60 on ${lowReady} day${lowReady===1?"":"s"}`,tone:"watch"});
      /* Stage 1: an observation and a hypothesis, never a claim about what the cause is not. */
      return pack("recovery_deficit",`Weight is flat while ${lifts.length>=2?"two or more lifts are down":"recovery check-ins are low"} — load or recovery may be involved; this is a hypothesis, not a diagnosis.`,extra,
        [{text:"Review training load and recovery before cutting further.",kind:"hold"}],
        rank(lifts.length>=2||lowReady>=5),
        lifts.length>=2?"Two or more lifts dropped at least 8%.":"Readiness stayed below 60 for at least five days.");
    }
    if(CALORIES_ENABLED&&p.plateau&&adhMean>=.85&&tdeeDrop!==null&&tdeeDrop>=150) {
      return pack("metabolic_adaptation","Likely metabolic adaptation, not a real plateau.",
        [{label:"TDEE",value:`${kcal(tdeeThen)} → ${kcal(tdeeNow)} kcal`,tone:"watch"}],
        [{text:"A small calorie adjustment may be warranted.",kind:"adjust"}],
        rank(hist.length>=2||(hist.length>=1&&at.ok&&hist[0].date!==state.date)),
        `Adaptive TDEE fell ${Math.round(tdeeDrop)} kcal over the plateau window.`);
    }
    const need=gap();
    /* D104: a projection that has gone quiet says so, with the reading it last rested on. */
    /* A current forecast that reached here (no rate read yet) keeps its anchored row, so the Why fold and the
       Evidence tile still name the same date. */
    const paused=!p.plateau&&fv.goalConfirmed&&f.ok&&f.weeks>0&&!fv.current&&fw.paused?[{label:"Forecast",value:`Paused · ${fw.paused.replace(/\.$/,"")}`,tone:"neutral"}]
      :!p.plateau&&fv.goalConfirmed&&f.ok&&finite(f.slope)!==null&&f.slope<0&&fv.current&&fv.showArrival?[fcRow()]:[];
    if(need.need===null) {
      /* Without a plateau read there is no fitted span; say what the window holds instead of "over 0 days". */
      const covered={label:"Readings",value:p.ok?`${p.n||0} over ${p.spanDays||0} ${plural(p.spanDays||0,"day")}`:`${p.n||0} in the last ${PLATEAU_WINDOW_DAYS} days`,tone:"neutral"};
      return pack("insufficient_context",p.plateau
        ?"Plateau confirmed. Not enough context to name the cause — food intake is not logged, so no cause matched."
        :"Not enough context to name the cause from the records the app keeps.",
        [covered].concat(paused),
        [{text:"Keep weighing in each morning.",kind:"diagnose_more"}],
        p.plateau&&p.confidence==="high"?"medium":"low",
        p.plateau?"Plateau confirmed, but no cause matched strictly.":p.reason||"Not enough data to diagnose.");
    }
    const headline=p.plateau
      ?`Plateau confirmed. Not enough context to name the cause — keep logging ${need.what} for ${need.need} more day${need.need===1?"":"s"}.`
      :`Not enough context to name the cause — keep logging ${need.what} for ${need.need} more day${need.need===1?"":"s"}.`;
    return pack("insufficient_context",headline,
      [{label:"Needed",value:`${need.what} · ${need.need} more day${need.need===1?"":"s"}`,tone:"neutral"}].concat(paused),
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
    if(!CALORIES_ENABLED)return "";
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
  /* ---- Training activity (Progress › Training) ------------------------------
     Weekly ledger of what was actually recorded: lifting days, working sets,
     tonnage, cardio minutes. Every figure is a count or a sum over stored rows
     through the same workRows() filter the rest of the engine uses — nothing is
     estimated, smoothed or scored. Weeks are Mon–Sun, the same weekStart() as
     Today. Weeks that end before the first stored record are not returned at
     all: before tracking began there is no observation, and absence must not
     be drawn as zero. A week after that with nothing in it is a real zero.
     Tonnage is load × reps over working sets; a set logged at 0 kg (bodyweight)
     adds no tonnage, and the view says so. */
  function activityWeeks(weeks=12,end=state.date) {
    const n=Math.max(1,Math.min(104,Number(weeks)||12));
    const ok=d=>Number.isFinite(dateMs(d))&&d<=end;
    const lifts=workRows();
    const cardio=(state.cardio||[]).filter(r=>r&&ok(r.date)&&finite(r.duration)>0);
    const floor=(state.floorball||[]).filter(r=>r&&ok(r.date));
    const first=[...lifts.map(r=>r.date),...cardio.map(r=>r.date),...floor.map(r=>r.date)].sort()[0]||null;
    const ws0=weekStart(end),out=[];
    for(let i=n-1;i>=0;i--) {
      const start=dateAdd(ws0,-7*i),stop=dateAdd(start,6);
      if(!first||stop<first)continue;
      const within=r=>r.date>=start&&r.date<=stop;
      const lr=lifts.filter(within),cr=cardio.filter(within),fr=floor.filter(within);
      const sum=(rows,f)=>rows.reduce((a,r)=>a+f(r),0);
      out.push({
        start,end:stop,current:start===ws0,
        daysElapsed:stop<=end?7:Math.round((dateMs(end)-dateMs(start))/DAY)+1,
        liftDays:new Set(lr.map(r=>r.date)).size,
        sets:lr.length,
        tonnage:Math.round(sum(lr,r=>Number(r.weight)*Number(r.reps))),
        exercises:new Set(lr.map(r=>r.exercise||r.name)).size,
        cardioMin:Math.round(sum(cr,r=>Number(r.duration))),
        cardioSessions:cr.length,
        floorSessions:fr.length,
        floorMin:Math.round(sum(fr,r=>Math.max(0,Number(r.duration)||0)))
      });
    }
    return out;
  }
  /* Plain totals over the ledger, against the CURRENT weekly plan and cardio
     target. The plan is read as it stands today and applied to past weeks as
     well, because the app does not store plan history; the view states that.
     "Met" is a count of weeks, never a percentage score. The current partial
     week is reported separately and excluded from the met/avg figures. */
  function activitySummary(items=activityWeeks()) {
    const planLifts=Object.values((typeof settings==="object"&&settings&&settings.weeklyPlan)||{}).filter(t=>t&&!["Rest","Zone2","Floorball"].includes(t)).length;
    const cardioTarget=Number(typeof settings==="object"&&settings&&settings.zone2WeeklyTarget)||90;
    const full=items.filter(w=>!w.current),cur=items.find(w=>w.current)||null;
    const tot=k=>items.reduce((a,w)=>a+(Number(w[k])||0),0);
    const avg=k=>full.length?full.reduce((a,w)=>a+(Number(w[k])||0),0)/full.length:null;
    let streak=0,best=0;
    for(const w of full){ if(planLifts>0&&w.liftDays>=planLifts){streak++;best=Math.max(best,streak);} else streak=0; }
    return {
      weeks:items.length,fullWeeks:full.length,current:cur,planLifts,cardioTarget,
      weeksAtPlan:planLifts>0?full.filter(w=>w.liftDays>=planLifts).length:null,
      weeksAtCardio:full.filter(w=>w.cardioMin>=cardioTarget).length,
      bestRun:best,
      totalLiftDays:tot("liftDays"),totalSets:tot("sets"),totalTonnage:tot("tonnage"),totalCardioMin:tot("cardioMin"),totalCardioSessions:tot("cardioSessions"),
      avgLiftDays:avg("liftDays"),avgSets:avg("sets"),avgCardioMin:avg("cardioMin")
    };
  }
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
    if(!CALORIES_ENABLED)return "";
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
    /* Stage 1: the coach carries the effort fact (recorded / unknown) without commenting on it. */
    const effort=c.effort||null;
    const out=(kind,headline,note)=>({kind,headline,note,sets,weight:a.weight,reps:a.reps,gap,effort});
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
        /* Stage 1: how much of last session carried a reps-in-reserve value, kept as a fact on
           the suggestion (none / partial / full). The owner does not log reserve, so "none" is
           normal use, not a gap: nothing below asks for it or says it is missing. A value from
           an earlier build is still read by effortOkay above exactly as before. Warm-ups are
           not in last.sets (workRows), so they never count. */
        const effortKnown=last.sets.filter(r=>r.rir!==null&&r.rir!==undefined&&r.rir!=="").length;
        const effort={known:effortKnown,sets:last.sets.length,state:effortKnown===0?"none":effortKnown<last.sets.length?"partial":"full"};
        const r=cfg().recovery[state.date],tired=r&&(Number(r.energy)<=2&&r.energy!==""||Number(r.soreness)>=4);
        const earned=top(last)&&(top(prev)||over(last)),step=Number(t.inc)>0;
        if(!tired&&earned&&effortOkay&&step)out={label:"Ready to consider an increase",effort,weight:weight+Number(t.inc)*(Number(bestSet(last.sets).reps)>=t.reps[1]+3?2:1),text:over(last)&&!top(prev)?"You went past the top of the rep range last time. Use the next increment only if today’s warm-up feels controlled.":"You reached the top of the rep range in two sessions. Use the next increment only if today’s warm-up feels controlled."};
        else {
          const lb=bestSet(last.sets),lowReps=lb&&Number(lb.reps)<t.reps[0];
          const why=tired?"Tired today · hold":earned&&!effortOkay?"Low reserve · hold":earned&&!step?"No kg step set":top(last)?"Top once · repeat to add":lowReps?`Under ${t.reps[0]} · rebuild`:"";
          out={label:tired?"Keep today manageable":"Hold load · build clean reps",effort,weight,why,text:tired?"Your check-in suggests fatigue. Keep the session manageable; use the shorter option if needed.":"Match your recent load within the rep range. Maintaining performance while cutting counts; an increase is optional."};
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
  /* Programme edit stamps, the cloud merge's conflict rule. A load keeps the newer copy of
     the weekly plan, of each dated override and of each saved routine, so an edit records
     when it happened: settings.planUpdatedAt, cfg().overrideMeta[date] (also kept when a
     day is cleared, so the clear survives a merge) and cfg().templateMeta[gym__type]. All
     optional ISO strings beside the records they describe; no record shape changes.
     commit() is the door every programme edit goes through, so the stamp is taken there,
     against the programme as it was last installed, merged or committed. install() and the
     merge re-base without stamping: a factory default, a migration or a copy that came from
     the cloud never looks like a fresh edit. */
  let programmeBase=null;
  function programmeNow() {
    const over=settings.dayOverrides&&typeof settings.dayOverrides==="object"?settings.dayOverrides:{},tpl={},saved=cfg().templates;
    for(const k of Object.keys(saved))tpl[k]=JSON.stringify(saved[k]);
    return {plan:JSON.stringify(settings.weeklyPlan||{}),over:{...over},tpl};
  }
  function rebaseProgramme() { programmeBase=programmeNow(); }
  function stampProgramme() {
    const was=programmeBase,now=programmeNow();programmeBase=now;
    if(!was)return;
    const at=new Date().toISOString(),c=cfg(),meta=k=>c[k]&&typeof c[k]==="object"&&!Array.isArray(c[k])?c[k]:(c[k]={});
    if(now.plan!==was.plan)settings.planUpdatedAt=at;
    for(const d of new Set([...Object.keys(was.over),...Object.keys(now.over)]))if(was.over[d]!==now.over[d])meta("overrideMeta")[d]=at;
    for(const k of Object.keys(now.tpl))if(was.tpl[k]!==now.tpl[k])meta("templateMeta")[k]=at;
  }
  function commit(message) {
    stampProgramme();
    let localFail=false;
    try{persist();}catch(e){localFail=true;}
    /* A signed-in account still gets the change: persist() starts the cloud save before it reports a local failure.
       That save has not finished yet, so the message says the change is on its way, not that it is saved. */
    if(localFail&&typeof cloudUser!=='undefined'&&cloudUser){toast('This device’s storage is full. Sending the change to your account; export a backup and free some space.');old.closeModal();repaint();return true;}
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
  function reviewCard(inSheet) {
    const r=review();
    logSuggestion({kind:"review",subject:null,payload:{title:r.title,action:r.action,tone:r.tone,reason:r.reason}});
    /* Inside the review sheet itself the "Why this advice?" link would only reopen the same sheet. */
    return `<section class="n99-card n99-review ${r.tone}"><div class="n99-eyebrow">Weekly cut review</div><h2>${r.title}</h2><p>${r.message}</p><div class="n99-review-foot"><span>${r.reason}</span>${inSheet===true?'':'<button class="n99-text" onclick="NXT.openReview()">Why this advice? ›</button>'}</div></section>`;
  }
  function diagnosisCard() {
    const d=diagnose();
    const tone={dietary_drift:"watch",water_masking:"good",recovery_deficit:"watch",metabolic_adaptation:"watch",caution:"watch"}[d.verdict]||"";
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
    <div class="n99-diag-foot"><span>Confidence in this read</span><b>${esc(d.confidence)}</b></div>
  </section>`;
  }
  function calorieCard() {
    if(!CALORIES_ENABLED)return "";
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
      <section class="n99-mission"><div class="n99-row"><span class="n99-eyebrow">${finished?'SESSION SAVED':'TODAY’S SESSION'}</span><button class="n99-chip" onclick="showSessionSheet()">Change</button></div><h2>${label(state.dayType)}</h2><p>${finished?'Your work is saved. Take recovery seriously.':isLift?`${list.length} ${plural(list.length,'exercise')} · ${list.reduce((s,e)=>s+e.sets,0)} working ${plural(list.reduce((s,e)=>s+e.sets,0),'set')} · ${esc(state.gym)}`:state.dayType==='Zone2'?'Easy, conversational effort. Build consistency at a manageable pace.':state.dayType==='Floorball'?'Log your session and account for it in your recovery.':'A planned rest day. Your programme continues after recovery.'}</p>
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
  function openReview() { const r=review(),s=trendStats();modal('Your weekly review',`${reviewCard(true)}<div class="n99-stats">${metric('This week',s.current.avg===null?'—':s.current.avg.toFixed(1)+' kg',s.current.n+' '+plural(s.current.n,'weigh-in'))}${metric('Previous week',s.previous.avg===null?'—':s.previous.avg.toFixed(1)+' kg',s.previous.n+' '+plural(s.previous.n,'weigh-in'))}</div><p>These are transparent coaching rules, not a medical assessment. Weight windows use calendar days. Strength compares the same exercise and gym across repeated sessions.</p><p>No food intake is recorded, so your actual deficit and the cause of a plateau are unknown. Any change to your plan stays your choice.</p><div class="n99-stack">${CALORIES_ENABLED?button('Review calorie guide','NXT.openCalories()',true):''}${FEATURES.checkin?button('Update recovery check-in','apx96OpenReadiness()',true):''}${button('Done','closeModal()')}</div>`); }
  // Views and integrations are defined below, before install() runs.
  return {cfg,copy,ui,old,defaults,features:FEATURES,flatKgWeek:PLATEAU_FLAT_KG_WEEK,plateauRules:{windowDays:PLATEAU_WINDOW_DAYS,minReadings:PLATEAU_MIN_READINGS,minSpanDays:PLATEAU_MIN_SPAN_DAYS},levelSeries,nowLevel,rateSeries,forecastView,comparePeriods,compareWindows,forecastWords,chartNotes,noteLabel,noteKinds:NOTE_KINDS.slice(),pickTypes,coachFor,split,names,typeNames,finite,dateMs,dateAdd,weekStart,shortDate,plural,label,signedFixed,rateSpan,otherTimingCount,weights,timingRows,cleanRows,windowStats,ewmaTrend,trend,trendConfidence,forecastGoal,detectPlateau,trendStats,workRows,sessionRows,strengthItems,review,estimate,cardioWeek,completedWeek,activityWeeks,activitySummary,typeFor,templateFor,targetFor,done,planDone,cue,bestSet,aimFor,cautionOf,caution,logSuggestion,logAdherence,adherenceHTML,adaptiveTDEE,diagnose,maybeSnapshotTDEE,formulaTDEE,tdeeCardHTML,snapshot,repaint,rebaseProgramme,commit,modal,button,heading,card,metric,reviewCard,diagnosisCard,calorieCard,weekHTML,home,openCalories,profileInputs,previewCalories,saveCalories,openReview};
})();

Object.assign(NXT, (()=>{
  const N=NXT;
  /* D107: through signedFixed, so a figure that rounds to zero carries no sign. */
  function signed(v,digits=2) { return v===null?'—':N.signedFixed(v,digits); }
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
    // from the chart. Evidence still reports the horizon.
    if(f.lastDate<start)return null;
    const days=(level-target)/-slope;
    if(!Number.isFinite(days)||!(days>0))return null;
    const here=bandRows.find(b=>b.date===f.lastDate);
    // No band means the level is unmeasured rather than certain, so the cone opens on the same
    // nominal spread forecastGoal itself falls back on.
    const sigma=here&&N.finite(here.sigma)!==null?here.sigma:CONE_SIGMA_FALLBACK;
    const historyDays=Math.max(1,(N.dateMs(state.date)-N.dateMs(start))/86400000);
    // Room for the future without letting it crowd out the record. A horizon past the cap runs to
    // the edge unfinished, which reads as "continues"; the goal pill carries the date.
    const soon=f.lowWeeks*7,late=f.highWeeks*7;
    const futureDays=Math.min(Math.max(days,late),Math.max(7,Math.round(FUTURE_SHARE*historyDays)),FUTURE_MAX_DAYS);
    /* D104: the cone starts at its origin, which can be days before today while the forecast is aging. It
       still runs to the plot's right edge (today + futureDays), so it never ends before the today line. */
    const reach=futureDays+Math.max(0,(N.dateMs(state.date)-N.dateMs(f.lastDate))/86400000);
    // The cone spans the band's mouth today and the reported arrival window on the goal line: the
    // upper wall reaches the goal at highWeeks, the lower wall at lowWeeks. Neither is a new
    // statistic, both are forecastGoal's own bounds drawn out. It narrows instead of widening when
    // today's level spread is wider than the arrival window, which is a fact about the data, and the
    // walls provably cannot cross before their own arrivals, so the polygon stays simple.
    const upper=t=>level+sigma+(target-level-sigma)*t/late,lower=t=>level-sigma+(target-level+sigma)*t/soon;
    const tU=Math.min(reach,late),tL=Math.min(reach,soon),tMid=Math.min(reach,days);
    const cone=[[0,level+sigma],[tU,upper(tU)]];
    // Once the fast wall has landed, the goal line itself closes the shape, so the arrival window
    // reads as a segment along the goal rather than a vertical cut through it.
    if(reach>soon&&reach<late)cone.push([reach,target]);
    cone.push([tL,lower(tL)],[0,level-sigma]);
    return {weeks:f.weeks,lowWeeks:f.lowWeeks,highWeeks:f.highWeeks,confidence:f.confidence,lastDate:f.lastDate,
      level,slope,sigma,target,days,futureDays,arrives:days<=reach,cone,mid:[[0,level],[tMid,level+slope*tMid]]};
  }
  /* "Cut" range (D48): from settings.cutStart (D31) to today. Display only — the
     same series, domain rule and trend; only the window changes. */
  function cutRangeDays() {
    const d=settings.cutStart;
    if(!d||!Number.isFinite(N.dateMs(d))||d>state.date)return null;
    return Math.round((N.dateMs(state.date)-N.dateMs(d))/86400000)+1;
  }
  /* Chart geometry (Weight "Instrument", spec §7.1; proposed D109). chartModel() takes its frame from here instead
     of literals. With no kind (N.ui.chartKind unset), or wherever nothing can be measured (node tests, no window
     size), it is exactly the frame the chart has always had — 420 × 460 viewBox units, left gutter 34, right 8, top
     28, bottom 110, readings 12 inside the edges — so the default render and every contract test are unchanged.
     The measured kinds ('page', 'wide', 'expand') use 1 SVG unit = 1 CSS px, so text never scales: W is the wrap's
     measured width (N.ui.chartW[kind], set by the presentation layer) or an estimate from the viewport, and the plot
     height comes from the small viewport height (100svh), which Safari's collapsing toolbar does not change. */
  const GEO_LEGACY={W:420,H:460,left:34,right:8,top:28,bottom:110,padX:12,plotH:322,gutter:"left",kind:"legacy"};
  const clampN=(lo,v,hi)=>Math.min(hi,Math.max(lo,v));
  /* The small viewport height from a hidden 100svh probe (falls back to innerHeight where svh is unsupported). */
  function chartSvh() {
    const w=typeof window!=="undefined"?window:null,vh=w&&Number(w.innerHeight);
    if(typeof document==="undefined"||!document.body||!document.createElement)return vh>0?vh:null;
    let probe=document.getElementById("wx-svh");
    if(!probe){
      probe=document.createElement("div");probe.id="wx-svh";probe.setAttribute("aria-hidden","true");
      probe.style.cssText="position:fixed;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
    }
    const h=Number(probe.offsetHeight);
    return h>0?h:(vh>0?vh:null);
  }
  function chartGeo(kind=N.ui.chartKind) {
    if(!kind||kind==="legacy")return {...GEO_LEGACY};
    const w=typeof window!=="undefined"?window:null,vw=w&&Number(w.innerWidth);
    if(!(vw>0))return {...GEO_LEGACY};
    const svh=chartSvh()||Number(w.innerHeight)||844;
    const narrow=vw<360,gutter=narrow?12:16,platePad=narrow?10:14;
    const measured=N.ui.chartW&&Number(N.ui.chartW[kind]);
    const W=Math.round(measured>0?measured:kind==="expand"?vw-2*gutter:kind==="wide"?clampN(580,vw-140-24-340-2*platePad,820):vw-2*gutter-2*platePad);
    const plotH=Math.round(kind==="wide"?clampN(300,svh-470,440):kind==="expand"?Math.max(232,(N.ui.expandH>0?N.ui.expandH:svh-324)):clampN(232,Math.round(svh*.355),320));
    const left=6,right=42,top=11,bottom=26;
    return {W,H:top+plotH+bottom,left,right,top,bottom,padX:9,plotH,gutter:"right",kind,svh};
  }
  /* Re-render only for a real change: width by more than 2 px, the svh bucket (24 px steps), or orientation. A
     geometry that has not changed this way keeps the chart (and its dressing) as it is. */
  function chartGeoChanged(prev,next) {
    if(!prev||!next)return true;
    if(prev.kind!==next.kind)return true;
    if(Math.abs((prev.W||0)-(next.W||0))>2)return true;
    const bucket=g=>Math.floor((Number(g.svh)||0)/24),orient=g=>(g.W||0)>=(Number(g.svh)||0);
    return bucket(prev)!==bucket(next)||orient(prev)!==orient(next);
  }
  function chartModel(rows=N.weights(),range=N.ui.range,showGoal=N.ui.showGoal,geo=chartGeo(),win=null) {
    /* "Cut" (D51) replaces "All": from settings.cutStart, or from the first weigh-in when no
       cut start is saved, to today. The window grows with every reading and always opens on
       the starting point. */
    if(range==='cut')range=cutRangeDays()||0;
    /* win {from, to} (Compare, spec §11) widens the x-window over both compared windows; null keeps the range. */
    const winTo=win&&win.to&&win.to<state.date?win.to:state.date;
    const series=N.trend(rows),start=win&&win.from?win.from:range?N.dateAdd(state.date,1-range):rows[0]?.date||N.dateAdd(state.date,-29);
    /* D52: taller plot (H 392→460) and thin side margins (20→8); the wrap runs edge to edge
       across the card, so the plot uses the full card width. */
    /* D58: the plot's left edge is moved in by a label gutter (8→34), so tick numbers sit beside
       the plot instead of on it and no reading, start marker or step ever paints over them. */
    /* The frame comes from chartGeo() (D109); its default is the frame these two decisions set. */
    const visible=series.filter(r=>r.date>=start&&r.date<=winTo),{W,H,left,right,top,bottom}=geo;
    if(!visible.length)return {visible,start,W,H,left,right,top,bottom,low:null,high:null,step:null,geo,win};
    /* D2 — Y-domain from visible morning readings + trend ONLY.
       Goal band, target reference, forecast cone/endpoint, confidence band
       extremes and post-workout must never stretch the recent-trajectory scale. */
    const values=visible.flatMap(r=>r.avg===null?[r.weight]:[r.weight,r.avg]);
    /* Post-workout is contextual only (D8): never enters trend/plateau/forecast
       maths, and also never enters this domain. Drawn through the same scale
       when toggled on; readings outside the plot simply clip. */
    const postRows=N.ui.showPost?N.timingRows('Post-workout').filter(r=>r.date>=start&&r.date<=winTo):[];
    // showGoal is accepted for API compatibility but must not affect the domain (D2/D3).
    void showGoal;
    const bandRows=(N.trendConfidence(rows)||[]).filter(r=>r.date>=start&&r.date<=winTo);
    const forecastRead=N.forecastGoal(rows),forecastView=N.forecastView(rows);
    /* Projection is off by default. Omit entirely when forecastGoal reports
       insufficient evidence (!ok) rather than drawing a weak estimate (I11),
       and when it has gone stale (D104): a paused projection draws no cone. */
    const canForecast=!!(N.cfg().targetConfirmed&&forecastRead.ok&&forecastRead.weeks!==null&&forecastRead.confidence!=='none'&&forecastView.current);
    const fc=N.ui.showForecast&&canForecast?forecastGeometry(forecastRead,start,bandRows):null;
    const dataLow=Math.min(...values),rawHigh=Math.max(...values);
    const span=Math.max(1,rawHigh-dataLow);
    const step=span<=2?.5:span<=4?1:span<=10?2:Math.ceil(span/20)*5;
    /* D51: a little more headroom (was .45 of a step) so the line never presses on the frame. Still data-only (D2). */
    const low=Math.floor((dataLow-step*.6)/step)*step,high=Math.ceil((rawHigh+step*.6)/step)*step;
    // Future strip only when a projection is actually drawn — still same px/day.
    const futureDays=fc?fc.futureDays:0;
    const first=N.dateMs(start),end=Math.max(N.dateMs(winTo),first+86400000)+futureDays*86400000;
    /* D51: readings sit 12 units inside the plot edges, so the first and last day's dots and the
       selected-point halo are never cut in half by the clip. */
    const padX=geo.padX;
    const xMs=ms=>left+padX+(ms-first)/(end-first)*(W-left-right-padX*2),x=d=>xMs(N.dateMs(d)),y=v=>top+(high-v)/(high-low)*(H-top-bottom);
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
      todayX:x(state.date),futureDays,bands,forecast,anchor,forecastRead,forecastView,canForecast,
      plateau:N.detectPlateau(rows),goalRef:null,geo,win};
  }
  /* The primary series is the canonical per-date row, which prefers Morning but
     falls back to whatever timing exists on days with no morning reading. That
     fallback is unchanged, so the readout names the timing actually recorded
     rather than claiming every point is a morning one. */
  /* One plain line under the trend figure: how far this reading sits from its own trend value. */
  function gapLine(p) {
    if(!p||p.avg===null||p.avg===undefined||!Number.isFinite(p.weight))return (p&&p.coverage!==undefined?p.coverage+' '+N.plural(p.coverage,'reading'):'');
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
    if(plateau.status==='losing')return `Losing ${Math.abs(rate).toFixed(2)} kg a week`;
    if(plateau.status==='flat')return plateau.plateauDays?`Trend is flat · ${plateau.plateauDays} days`:'Trend is flat';
    if(plateau.status==='gaining')return 'Trend is gaining';
    return 'Direction still settling';
  }
  /* D3 — long-term goal as a separate non-time-series rail: start → current → target. */
  /* Cut journey and Evidence (proposed D95; the owner approved the direction on 2026-10-19). Presentation
     only: every figure is the engine's own — the start weight, the trend now (plateau.lastAvg), the goal
     range, the four-week rate and its 95% range (detectPlateau), the D37 1%-of-body-weight line (review()),
     and the goal forecast (forecastGoal, dated by forecastView, D104). What changes: the projection names
     its date and both of its inputs (where the last three weeks put you today, and their pace), so the
     weeks add up on the card; the rate leads with its share of body weight and the word review() already
     uses; confidence says what it measures; a plateau only takes a card when there is one. */
  function journeyHTML(forecastRead,view,opts={}) {
    if(!N.cfg().targetConfirmed)return '';
    const rows=N.weights(),fv=view||N.forecastView(rows),fw=N.forecastWords(fv);
    const startW=N.finite(typeof START_WEIGHT!=='undefined'?START_WEIGHT:null);
    const seed=startW!==null?startW:(rows[0]?rows[0].weight:null);
    const lo=goalLow(),hi=goalHigh();
    /* "Now" is where your weight is today (D97): the line through the last three weeks of mornings,
       or the smoothed trend while there are too few readings for a line. */
    const nl=N.nowLevel(rows);
    const cur=nl?nl.value:(rows.at(-1)?rows.at(-1).weight:null);
    if(seed===null||cur===null||!Number.isFinite(lo)||!Number.isFinite(hi))return '';
    const max=Math.max(seed,cur,hi)+0.6,min=Math.min(lo,cur)-1.2,span=Math.max(0.8,max-min);
    const pct=v=>Math.max(0,Math.min(100,((max-v)/span)*100));
    const done=seed-cur,remain=Math.max(0,cur-hi);
    const cs=typeof settings!=='undefined'&&settings&&Number.isFinite(N.dateMs(settings.cutStart))&&settings.cutStart<=state.date?settings.cutStart:null;
    const first=cs||rows[0]?.date;
    /* D104: "down in N weeks" ends where Now is measured once the forecast is not fresh, so an old figure is not
       credited to the weeks since. */
    const elapsed=first?Math.max(0,Math.round((N.dateMs(fv.asOfDate)-N.dateMs(first))/86400000)):0;
    const sinceTxt=elapsed>=14?`${Math.round(elapsed/7)} weeks`:`${elapsed} ${N.plural(elapsed,'day')}`;
    const dir=done>=.05?'down':done<=-.05?'up':'no change';
    /* The goal label's date is the anchored arrival (D104), shown only while the forecast is current. */
    const arrive=remain>0&&fv.showArrival?N.shortDate(fv.arrivalDate):null;
    const leftTrav=Math.min(pct(seed),pct(cur)),widthTrav=Math.abs(pct(cur)-pct(seed));
    const leftBand=Math.min(pct(lo),pct(hi)),widthBand=Math.abs(pct(lo)-pct(hi));
    /* A net gain is ground to make up: drawn in the review hue, and the road ahead starts where it ends. */
    const back=done<=-.05,aheadFrom=back?pct(seed):pct(cur),aheadW=remain>0?Math.max(0,pct(hi)-aheadFrom):0;
    /* D96 · Milestones. Every figure is read off the same level series as "Now": the first day it was at
       or below a weight. Beads mark each whole kilogram between the start and the goal (every 2 or 5 kg on a
       long road); a bead is lit once it has been reached. */
    const lv=N.levelSeries(rows).filter(q=>(!first||q.date>=first)&&q.date<=state.date);
    const reached=k=>{const q=lv.find(x=>x.value<=k);return q?q.date:null;};
    const beads=[];
    {
      const topK=Math.floor(seed-1e-6),n=topK-Math.floor(hi)+0;
      const step=n>48?5:n>24?2:1;
      for(let k=topK;k>hi;k--){if(k%step)continue;beads.push({k,date:reached(k)});}
    }
    const ms=[];
    if(seed-1>hi){const d=reached(seed-1);if(d)ms.push({d,t:'First kg down'});}
    if(seed*.95>hi){const d=reached(seed*.95);if(d)ms.push({d,t:'5% of your start'});}
    {const d=reached((seed+hi)/2);if(d)ms.push({d,t:'Halfway'});}
    const inCut=rows.filter(r=>(!first||r.date>=first)&&r.date<=state.date);
    const low=inCut.length>=5?inCut.reduce((m,r)=>Number(r.weight)<Number(m.weight)?r:m):null;
    if(low)ms.push({d:low.date,t:`Lowest weigh-in ${Number(low.weight).toFixed(1)}`,low:true});
    ms.sort((x,y)=>x.d.localeCompare(y.d));
    /* The next whole kilogram, at the projection's own pace from its own origin (D104): an estimate, drawn dashed
       (I11), dropped once that day has come without a reading to show it, or while the forecast is paused. */
    const pace=fv.ok&&fv.current&&N.finite(fv.slopeKgWk)!==null&&fv.slopeKgWk<0?fv.slopeKgWk/7:null;
    let next=null;
    if(pace&&remain>0&&fv.modelOriginDate){
      const k=Math.ceil(cur-1e-6)-1,from=N.finite(fv.originLevel)!==null?fv.originLevel:cur;
      const d=k>=hi?N.dateAdd(fv.modelOriginDate,Math.max(1,Math.round((from-k)/-pace))):null;
      if(d&&d>state.date)next={k,d};
    }
    const play='<button type="button" class="st-share-b is-icon st-jr-play" aria-label="Play your cut" data-st-story><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.6v10.8L15.2 10z" fill="currentColor" stroke="none"/></svg></button>';
    /* NXP is a top-level const (a global binding, not a window property), so the handler names it directly. */
    const share='<button type="button" class="st-share-b is-icon" aria-label="Share your cut" onclick="typeof NXP!==\'undefined\'&&NXP.shareProgress&&NXP.shareProgress()"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 12.5V3M6.5 6.5 10 3l3.5 3.5M5.5 9.5H5a1.5 1.5 0 0 0-1.5 1.5v4.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V11A1.5 1.5 0 0 0 15 9.5h-.5"/></svg></button>';
    const hiTxt=Number.isInteger(hi)?String(hi):hi.toFixed(1);
    /* D107 — "Now" is named for what it is: the fitted "Estimated level" on the day it is measured (D97), never
       called a measurement; while the line has too few mornings it is the smoothed trend and says so; with no
       trend yet it is the latest morning reading. */
    const nowName=nl?'Estimated level':'Latest morning';
    const nowWord=N.shortDate(nl?nl.date:(rows.at(-1)?rows.at(-1).date:state.date));
    const nowNoteTxt=!nl?'From your latest morning reading. An estimated level starts once three mornings make a trend.':nl.source==='trend'?'Estimated level is your smoothed trend for now. A fitted line needs ten mornings in three weeks.':'';
    /* The legend reads in rail order, so after a net gain "Now" comes before "Start". */
    const startLab=`<span><b class="vn-num">${seed.toFixed(1)}</b>Start${first?`<i>${esc(N.shortDate(first))}</i>`:''}</span>`;
    /* The legend row is aria-hidden (the summary and the slider carry the full name). "Estimated level · 19 Oct"
       wrapped to three lines in a column the Start and Goal labels fill in two, so the row shows "Est. level". */
    const nowShort=nl?'Est. level':nowName;
    const nowLab=`<span class="is-now"><b class="vn-num" data-st-jr-nowv>${cur.toFixed(1)}</b><em data-st-jr-noww>${nowShort}<i>${esc(nowWord)}</i></em></span>`;
    const days=lv.length?Math.max(0,Math.round((N.dateMs(state.date)-N.dateMs(lv[0].date))/864e5)):0;
    const canRewind=lv.length>=3;
    const payload={seed:+seed.toFixed(2),first:first||null,lo,hi,max:+max.toFixed(3),span:+span.toFixed(3),today:state.date,now:+cur.toFixed(2),nowWord,
      pts:lv.map(q=>[q.date,+q.value.toFixed(2)])};
    const sum=`Start ${seed.toFixed(1)} kilograms${first?' on '+N.shortDate(first):''}, ${nowName.toLowerCase()} ${cur.toFixed(1)} on ${nowWord}, goal ${lo} to ${hi}${arrive?', projected around '+arrive+(fw.asOf?' '+fw.asOf:''):''}.`;
    const railHTML=`<div class="vn-journey-rail st-jr-rail" ${canRewind?`role="slider" tabindex="0" aria-label="Rewind your cut" aria-valuemin="0" aria-valuemax="${days}" aria-valuenow="${days}" aria-valuetext="${esc(`${nowName}, ${nowWord}: ${cur.toFixed(1)} kilograms, ${Math.abs(done).toFixed(1)} ${dir}`)}" aria-describedby="st-jr-sum"`:`role="img" aria-label="${esc(sum)}"`}>
        <div class="vn-journey-track"></div>
        <div class="vn-journey-band" style="left:${leftBand}%;width:${Math.max(2,widthBand)}%"></div>
        <div class="vn-journey-travel${back?' is-back':''}" style="left:${leftTrav}%;width:${Math.max(0,widthTrav)}%"></div>
        <div class="st-jr-fut" hidden></div>
        ${aheadW>0&&!beads.some(x=>!x.date)?`<div class="st-jr-ahead" style="left:${aheadFrom}%;width:${aheadW}%"></div>`:''}
        ${beads.map(x=>`<i class="st-jr-bead${x.date?' is-on':''}" style="left:${pct(x.k)}%" data-k="${x.k}"></i>`).join('')}
        <i class="st-jr-today" hidden style="left:${pct(cur)}%"></i>
        <div class="vn-journey-now" style="left:${pct(cur)}%"></div>
      </div>`;
    /* Summary mode (spec §13.1, w4): the quiet surface the Weight page shows, closed by default; ⌄ Details opens
       the rest in place (NXT.jrToggle, STRATA.morph). The default mode below is unchanged. Five kinds of fact stay
       visibly distinct (§13.2): a recorded weigh-in (solid, ✓), a milestone reached on the estimated level (dashed
       outline, under its own heading), the model's next-kilogram estimate (dashed, "estimate"), the rewind snapshot
       (◷ capsule + Back to today, the Rate card gaining "Current analysis · as of <date>") and the Simulation box
       (Evidence). "Start weight" is the saved setting; the plate's "First reading" is never called that (W6). */
    if(opts&&opts.mode==='summary'){
      const open=!!N.ui.jrOpen;
      const wk=remain>0&&fv.showArrival&&fv.weeksRemaining!==undefined&&fv.weeksRemaining!==null?(fv.lowWeeksRemaining!==undefined&&fv.lowWeeksRemaining!==fv.highWeeksRemaining?`${fv.lowWeeksRemaining}–${fv.highWeeksRemaining} wk`:`${fv.weeksRemaining} wk`):'';
      const goalWhen=arrive?`~${arrive}${wk?' · '+wk:''}`:'';
      const sinceLine=`${dir}${first&&elapsed>0?` in ${sinceTxt}`:''}`;
      const togo=remain>0?`<b class="vn-num"><span data-st-jr-togo data-st-num>${remain.toFixed(1)}</span> kg</b><span data-st-jr-togol>to go to the top of ${lo}–${esc(hiTxt)}</span>`:cur>=lo?'<b>In range</b><span>your goal range</span>':`<b class="vn-num">${(lo-cur).toFixed(1)} kg</b><span>below your goal range</span>`;
      const startLabS=`<span class="is-start"><b class="vn-num">${seed.toFixed(1)}</b><em>Start weight</em>${first?`<i>${esc(N.shortDate(first))}</i>`:''}</span>`;
      const nowLabS=`<span class="is-now"><b class="vn-num" data-st-jr-nowv>${cur.toFixed(1)}</b><em data-st-jr-noww>${nowName}<i>${esc(nowWord)}</i></em>${nl?'<u class="st-jr-est">estimate</u>':''}</span>`;
      const goalLabS=`<span class="is-goal"><b class="vn-num">${lo}–${hi}</b><em>Goal range</em>${goalWhen?`<i>${esc(goalWhen)}</i>`:''}</span>`;
      const recorded=ms.filter(x=>x.low),onLevel=ms.filter(x=>!x.low);
      const chip=(x,cls,glyph)=>`<li><button type="button" class="st-jr-mc ${cls}"${canRewind?` data-st-jr-go="${x.d}"`:''}><i aria-hidden="true">${glyph}</i>${esc(x.t)} <em>${esc(N.shortDate(x.d))}</em></button></li>`;
      const msHTML=(recorded.length||onLevel.length||next)?`<div class="st-jr-ms">
          ${recorded.length?`<p class="st-jr-mh">Recorded</p><ul>${recorded.map(x=>chip(x,'is-rec','✓')).join('')}</ul>`:''}
          ${onLevel.length||next?`<p class="st-jr-mh">Milestones · on your estimated level</p><ul>${onLevel.map(x=>chip(x,'is-lvl','◌')).join('')}${next?`<li><span class="st-jr-mc is-est"><i aria-hidden="true"></i>${next.k} kg <em>~${esc(N.shortDate(next.d))} · estimate</em></span></li>`:''}</ul>`:''}
        </div>`:'';
      const playB=lv.length>=7?'<button type="button" class="st-jr-act st-jr-play" data-st-story><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.6v10.8L15.2 10z" fill="currentColor" stroke="none"/></svg><span>Play your cut</span></button>':'';
      const detB=`<button type="button" class="st-jr-act st-jr-det" id="st-jr-det" aria-expanded="${open}" aria-controls="st-jr-more" onclick="NXT.jrToggle()"><span>Details</span><i aria-hidden="true">⌄</i></button>`;
      return `<section class="vn-journey st-jr is-sum${open?' is-open':''}" aria-label="Cut journey"${canRewind?` data-st-jr="${esc(JSON.stringify(payload))}"`:''}>
      <div class="vn-sect-head"><p class="vn-h-sect">Cut journey</p>
        <span class="vn-tiny st-jr-when">${first?esc(N.shortDate(first)):'Start'} → now</span>${share}</div>
      <div class="st-jr-hero">
        <div><div class="st-jr-big vn-num"><span data-st-jr-done data-st-num>${Math.abs(done).toFixed(1)}</span><small>kg</small></div><p class="st-jr-sub" data-st-jr-sub>${sinceLine}</p></div>
        <div class="st-jr-togo">${togo}</div>
      </div>
      ${canRewind?'<div class="st-jr-rw" hidden><span class="st-jr-rwc"><i aria-hidden="true">◷</i>Rewound · <b data-st-jr-rwd></b> · <span data-st-jr-rwk></span></span><button type="button" class="st-jr-back" hidden>Back to today</button></div>':''}
      ${railHTML}
      ${canRewind?`<p class="st-sr" id="st-jr-sum">${esc(sum)} Drag along the bar, or use the arrow keys, to rewind to an earlier day.</p>`:''}
      <div class="st-jr-labs is-sum" aria-hidden="true">${back?nowLabS+startLabS:startLabS+nowLabS}${goalLabS}</div>
      <div class="st-jr-acts">${playB}${detB}</div>
      <div class="st-jr-more" id="st-jr-more"${open?'':' hidden'}>
        ${nowNoteTxt?`<p class="vn-tiny st-jr-note">${esc(nowNoteTxt)}</p>`:''}
        ${msHTML}
      </div>
    </section>`;
    }
    return `<section class="vn-journey st-jr" aria-label="Cut journey"${canRewind?` data-st-jr="${esc(JSON.stringify(payload))}"`:''}>
      <div class="vn-sect-head"><p class="vn-h-sect">Cut journey</p>
        <span class="vn-tiny st-jr-when">${first?esc(N.shortDate(first)):'Start'} → now</span>${lv.length>=7?play:''}${share}</div>
      <div class="st-jr-hero">
        <div><div class="st-jr-big vn-num"><span data-st-jr-done data-st-num>${Math.abs(done).toFixed(1)}</span><small>kg</small></div><p class="st-jr-sub" data-st-jr-sub>${dir}${first&&elapsed>0?` in ${esc(sinceTxt)}`:''}</p></div>
        <div class="st-jr-togo">${remain>0?`<b class="vn-num"><span data-st-jr-togo data-st-num>${remain.toFixed(1)}</span> kg</b><span data-st-jr-togol>to your ${esc(hiTxt)} kg goal</span>`:cur>=lo?'<b>In range</b><span>your goal range</span>':`<b class="vn-num">${(lo-cur).toFixed(1)} kg</b><span>below your goal range</span>`}</div>
      </div>
      <div class="vn-journey-rail st-jr-rail" ${canRewind?`role="slider" tabindex="0" aria-label="Rewind your cut" aria-valuemin="0" aria-valuemax="${days}" aria-valuenow="${days}" aria-valuetext="${esc(`${nowName}, ${nowWord}: ${cur.toFixed(1)} kilograms, ${Math.abs(done).toFixed(1)} ${dir}`)}" aria-describedby="st-jr-sum"`:`role="img" aria-label="${esc(sum)}"`}>
        <div class="vn-journey-track"></div>
        <div class="vn-journey-band" style="left:${leftBand}%;width:${Math.max(2,widthBand)}%"></div>
        <div class="vn-journey-travel${back?' is-back':''}" style="left:${leftTrav}%;width:${Math.max(0,widthTrav)}%"></div>
        <div class="st-jr-fut" hidden></div>
        ${aheadW>0&&!beads.some(x=>!x.date)?`<div class="st-jr-ahead" style="left:${aheadFrom}%;width:${aheadW}%"></div>`:''}
        ${beads.map(x=>`<i class="st-jr-bead${x.date?' is-on':''}" style="left:${pct(x.k)}%" data-k="${x.k}"></i>`).join('')}
        <i class="st-jr-today" hidden style="left:${pct(cur)}%"></i>
        <div class="vn-journey-now" style="left:${pct(cur)}%"></div>
      </div>
      ${canRewind?`<p class="st-sr" id="st-jr-sum">${esc(sum)} Drag along the bar, or use the arrow keys, to rewind to an earlier day.</p>`:''}
      <div class="st-jr-labs" aria-hidden="true">
        ${back?nowLab+startLab:startLab+nowLab}
        <span class="is-goal"><b class="vn-num">${lo}–${hi}</b>Goal${arrive?`<i>~${esc(arrive)}</i>`:''}</span>
      </div>
      ${nowNoteTxt?`<p class="vn-tiny st-jr-note">${esc(nowNoteTxt)}</p>`:''}
      ${ms.length||next?`<div class="st-jr-ms"><p class="st-jr-mh">Milestones</p><ul>${ms.map(m=>`<li><button type="button" class="st-jr-mc${m.low?' is-low':''}"${canRewind?` data-st-jr-go="${m.d}"`:''}><i aria-hidden="true"></i>${esc(m.t)} <em>${esc(N.shortDate(m.d))}</em></button></li>`).join('')}${next?`<li><span class="st-jr-mc is-est"><i aria-hidden="true"></i>${next.k} kg <em>~${esc(N.shortDate(next.d))} · estimate</em></span></li>`:''}</ul></div>`:''}
      ${canRewind?'<div class="st-jr-backrow"><button type="button" class="st-jr-back" hidden>Back to today</button></div>':''}
    </section>`;
  }
  /* D97: what "Now" is, said once, in the fold that explains the numbers. */
  function nowNote() {
    if(!N.cfg().targetConfirmed)return '';
    const nl=N.nowLevel();
    /* D107: the same names as the chart header and the Journey. */
    return nl&&nl.source==='line'?`<p class="vn-tiny vn-mt3">The Cut journey’s “Estimated level” (${esc(N.shortDate(nl.date))}) is where the line through your last three weeks of mornings puts you: a fitted estimate, not a measurement. The chart’s smoothed trend runs about ten days behind a moving weight, and “Latest morning” is the reading itself.</p>`
      :nl?'<p class="vn-tiny vn-mt3">The Cut journey’s “Estimated level” is your smoothed trend until the last three weeks hold ten mornings for a fitted line.</p>':'';
  }
  function evidenceHTML(plateau,forecastRead,view,opts={}) {
    const fv=view||N.forecastView(N.weights()),fw=N.forecastWords(fv);
    const rate=N.finite(plateau&&plateau.weeklyRate),ref=N.finite(plateau&&plateau.lastAvg);
    const ok=!!(plateau&&plateau.ok)&&rate!==null;
    /* The D37 reading, exactly as review() takes it: the four-week rate over the trend now. */
    const pct=ok&&ref?rate/ref*100:null;
    let word='',tone='is-neutral';
    if(ok){
      if(pct!==null&&pct<-1){word='Losing quickly';tone='is-watch';}
      else if(rate<-N.flatKgWeek){word='Cutting steadily';tone='is-ok';}
      else if(plateau.status==='gaining'){word='Trending up';tone='is-watch';}
      else if(plateau.plateau){word='Flat';tone='is-watch';}
      else {word='Settling';tone='is-neutral';}
    }
    const sgn=v=>{const r=Math.round(v*100)/100;return `${r<0?'−':r>0?'+':''}${Math.abs(r).toFixed(2)}`;};
    const rateV=rate===null?'—':sgn(rate);
    const band=ok&&N.finite(plateau.lower)!==null&&N.finite(plateau.upper)!==null?{lo:plateau.lower,hi:plateau.upper,half:(plateau.upper-plateau.lower)/2}:null;
    /* A gauge of the loss rate as a share of body weight: flat band, steady, the 1% line, fast. */
    let gauge='';
    if(ok&&pct!==null&&ref&&rate<N.flatKgWeek&&plateau.status!=='gaining'){
      const axis=Math.max(2,Math.min(4,Math.abs(pct)+.3)),flat=N.flatKgWeek/ref*100;
      const w=v=>(Math.max(0,Math.min(axis,v))/axis*100).toFixed(2);
      /* D96 · What-if pace: drag the marker to try another pace. Plain arithmetic from where you are now to the
         top of the goal range, shown as a what-if and dropped when you let go; nothing is stored or forecast.
         D104: it counts from the day Now is measured (base), not from today, and rests while the forecast is
         paused, since Now is then too old to start from. */
      const nl=N.nowLevel(),nowV=nl?nl.value:null,canWhat=N.cfg().targetConfirmed&&fv.current&&nowV!==null&&nowV>goalHigh()+.05;
      const gl=`${rate<0?'Losing':'Gaining'} ${Math.abs(pct).toFixed(1)} percent of body weight a week; the 1 percent line is where losing quickly starts`;
      const wdata={axis:+axis.toFixed(3),ref:+ref.toFixed(3),flat:+flat.toFixed(4),now:nowV===null?null:+nowV.toFixed(3),hi:goalHigh(),rate:+rate.toFixed(3),today:state.date,base:nl?nl.date:state.date,nowName:nl?'estimated level':'latest morning'};
      gauge=`<div class="st-ev-g${canWhat?' is-what':''}" ${canWhat?`role="slider" tabindex="0" aria-label="What-if pace" aria-valuemin="0" aria-valuemax="${(axis*ref/100).toFixed(2)}" aria-valuenow="${Math.max(0,-rate).toFixed(2)}" aria-valuetext="${esc(`Your ${N.rateSpan(plateau).label}, ${Math.abs(rate).toFixed(2)} kilograms a week. Arrow keys try another pace.`)}" data-st-ev="${esc(JSON.stringify(wdata))}"`:`role="img" aria-label="${esc(gl)}"`}><div class="st-ev-z"><i class="z-flat" style="width:${w(flat)}%"></i><i class="z-steady" style="width:${(w(1)-w(flat)).toFixed(2)}%"></i><i class="z-fast" style="flex:1"></i></div><i class="st-ev-mk" style="left:${w(Math.max(0,-pct))}%"></i>${canWhat?'<i class="st-ev-trail" hidden></i><i class="st-ev-gk" hidden></i><span class="st-ev-gkl" hidden></span>':''}<div class="st-ev-zl" aria-hidden="true"><span>Flat</span>${axis<=2.2?`<span class="is-mid is-steady" style="left:${w((flat+1)/2)}%">Steady</span>`:''}<span class="is-mid" style="left:${w(1)}%">1% line</span><span>Fast</span></div></div>${canWhat?'<p class="st-ev-hint" aria-hidden="true">Drag the marker to try another pace</p>':''}`;
    }
    const plateauLine=!ok?esc((plateau&&plateau.reason)||''):plateau.plateau?'':plateau.status==='losing'?'No plateau: still trending down.':esc(plateau.reason||'');
    const plateauTile=ok&&plateau.plateau?`<div class="st-ev-t is-wide is-watch"><p>Plateau</p><b>${esc(String(plateau.plateauDays))} days</b><span>${esc(plateau.reason||'')}</span></div>`:'';
    /* Projection: the D28 date and the pace it runs at, so it adds up beside the four-week rate. D104: the date is
       anchored at the forecast's origin (forecastView) and the weeks count from today to it; once the origin is not
       fresh the tile says "as of" it and the start is "on" that day; once stale it pauses, names the last morning
       weigh-in and prints no date. */
    let proj;
    const read=!!(forecastRead&&forecastRead.ok&&N.finite(forecastRead.weeks)!==null);
    if(!N.cfg().targetConfirmed)proj=`<b>Set a goal</b><span>A projection needs a confirmed goal range.</span>`;
    else if(read&&!fv.current)proj=`<b>Paused</b><span>${esc(fw.paused||'No recent morning weigh-in.')} ${esc(fw.restart||'Weigh in to refresh it.')}</span>`;
    else if(read){
      const asOf=fw.asOf?` ${fw.asOf.charAt(0).toUpperCase()}${fw.asOf.slice(1)}.`:'';
      if(forecastRead.weeks===0){
        const la=N.finite(forecastRead.lastAvg),under=la!==null&&la<goalLow();
        proj=under?`<b>Below goal</b><span>The trend is under your goal range.${esc(asOf)}</span>`:`<b>At goal</b><span>The trend is in your goal range.${esc(asOf)}</span>`;
      }
      else{
        const d=N.shortDate(fv.arrivalDate),pace=N.finite(fv.slopeKgWk),wk=fv.weeksRemaining,lo=fv.lowWeeksRemaining,hi=fv.highWeeksRemaining;
        const range=lo!==wk||hi!==wk?` <small>(${lo}–${hi})</small>`:'';
        /* The forecast starts where the line through the last three weeks sits on its origin day (fittedLevel),
           which runs ahead of the trend figure; naming both inputs lets the weeks add up on the card. */
        const lvl=N.finite(fv.originLevel),nl=N.nowLevel(),same=lvl!==null&&nl&&Math.abs(nl.value-lvl)<.05;
        const on=fv.freshness==='aging'?'on '+N.shortDate(fv.modelOriginDate):'';
        const basis=pace===null?"At your last 3 weeks' pace":same?`From ${lvl.toFixed(1)} kg ${on||'now'}, at your last 3 weeks' pace of ${sgn(pace)} kg/wk`:lvl!==null?`Your last 3 weeks: ${lvl.toFixed(1)} kg ${on||'today'}, ${sgn(pace)} kg/wk`:`At your last 3 weeks' pace, ${sgn(pace)} kg/wk`;
        /* Projection range (CONTRACTS §3, W6): the arrival window as two dates, "Likely between", never a
           percentage, and "an estimate, not a promise". Nothing here is dated while the forecast is paused (the
           branch above prints no future date). */
        const pr=fv.arrivalLow&&fv.arrivalHigh&&fv.arrivalLow!==fv.arrivalHigh?`<b>Projection range</b> · Likely between ${esc(N.shortDate(fv.arrivalLow))} and ${esc(N.shortDate(fv.arrivalHigh))}. `:'';
        proj=`<b class="vn-num">~<span data-st-num>${wk}</span> wk${range}</b><em>around ${esc(d)}${fw.asOf?` · ${esc(fw.asOf)}`:''}</em><span>${pr}${basis}.${fw.restart?' '+esc(fw.restart):''} An estimate, not a promise.</span>`;
      }
    } else proj=`<b>Unavailable</b><span>${esc((forecastRead&&forecastRead.reason)||'Not enough recent weigh-ins for a projection.')}</span>`;
    /* D107: this word is detectPlateau's half-width bucket, i.e. how tightly the rate is pinned down, so it is
       named "Rate precision"; the Why fold's word is the read's own and keeps its own name. */
    const rs=N.rateSpan(plateau);
    const conf=plateau&&plateau.confidence&&plateau.confidence!=='none'?plateau.confidence:null;
    const steps=conf==='high'?3:conf==='medium'?2:conf==='low'?1:0;
    /* Rate range and Rate precision copy (CONTRACTS §4, W6): "Likely between A and B kg/wk over the last four
       weeks." and "The 4-week rate is likely within ±X kg a week." No frequency is printed ("known to within",
       "95%" and "9 in 10" are retired). An N-day rate names its own span in place of "four weeks". */
    const over=rs.full?'four weeks':`${rs.days} days`;
    const confTxt=band?`The ${rs.label} is likely within ±${band.half.toFixed(2)} kg a week.${conf==='high'?'':' More mornings and steadier readings tighten it.'}`:'How tightly the rate is pinned down, from your morning readings.';
    const rangeTxt=band?`<b>Rate range</b> · Likely between ${Math.abs(band.hi)<=Math.abs(band.lo)?`${sgn(band.hi)} and ${sgn(band.lo)}`:`${sgn(band.lo)} and ${sgn(band.hi)}`} kg/wk over the last ${over}. `:'';
    /* Rewind (spec §13.2): the journey replays the past, the analysis does not; while rewound this line reads
       "Current analysis · as of <date>" (strata.js composes and unhides it with the journey's capsule, so the
       words are not in a default render). */
    const current=`<p class="wx-current" data-wx-current="${esc(N.shortDate(state.date))}" hidden></p>`;
    return `<section class="vn-evidence st-ev">
      <p class="vn-h-sect">Evidence</p>${current}
      <div class="st-ev-rate ${tone}">
        <div class="st-ev-rt"><p>${ok?esc(rs.label):'4-week rate'}</p>${word?`<span class="st-ev-pill ${tone}"><i aria-hidden="true"></i>${esc(word)}</span>`:''}</div>
        <div class="st-ev-rv vn-num"><span data-st-num>${rateV}</span>${rate===null?'':'<small> kg/wk</small>'}</div>
        ${pct!==null?`<p class="st-ev-pct">${pct>0?'+':''}${Math.abs(pct).toFixed(1)}% of body weight a week</p>`:''}
        ${gauge}
        ${band||plateauLine?`<p class="st-ev-note">${rangeTxt}${plateauLine}</p>`:''}
      </div>
      ${opts.rax===false?'':rateTrendHTML(sgn)}
      ${plateauTile}
      <div class="st-ev-two">
        <div class="st-ev-t"><p>Projection</p>${proj}</div>
        <div class="st-ev-t"><p>Rate precision</p><b>${conf?esc(conf.charAt(0).toUpperCase()+conf.slice(1)):'—'}</b>${steps?`<div class="st-ev-meter" aria-hidden="true">${[1,2,3].map(k=>`<i${k<=steps?' class="on"':''} style="--k:${k}"></i>`).join('')}</div>`:''}<span>${esc(confTxt)}</span></div>
      </div>
    </section>`;
  }
  function chartHTML() {
    /* Compare (spec §11): the x-window widens over both compared windows; the model carries the view for the
       plot's bands and the slot's table. The builders live after chartHTML. */
    const cv=N.ui.compare?compareView():null;
    const model=chartModel(undefined,undefined,undefined,chartGeo(),cv&&cv.ok?cv.win:null);model.compare=cv;N.ui.chart=model;
    const {visible}=model;
    const latestKey=visible.length?visible.at(-1).date+':'+visible.at(-1).weight:'';
    const grew=!!(N.ui.lastPlotted&&latestKey&&latestKey!==N.ui.lastPlotted);
    N.ui.lastPlotted=latestKey;
    const animClass=N.ui.chartAnim==='range'?' is-range-change':N.ui.chartAnim==='layer'?' is-layer-change':N.ui.chartAnim==='compare'?' is-compare-change':grew?' is-new-point':'';
    N.ui.chartAnim=null;
    /* Weight "Instrument" (spec §2): the plate (interpretation, readouts, range row, layers, plot, slot) is the
       page's first section and holds no nested section, then the highlights, the Cut journey and Analysis. The
       builders are defined after chartHTML, outside the release gate's model slice. */
    if(!visible.length)return emptyPlateHTML(model)+journeyHTML()+analysisHTML(model,null);
    const {points,plateau,forecastRead}=model;
    const sel=N.ui.selected?points.findIndex(p=>p.date===N.ui.selected):-1;
    const idx=sel>=0?sel:points.length-1;
    const after=typeof N.highlightsHTML==='function'?N.highlightsHTML():'';
    return `${plateHTML(model,idx,animClass)}${after}
      ${journeyHTML(forecastRead,model.forecastView,{mode:'summary'})}
      ${analysisHTML(model,plateau)}`;
  }
  /* ---- Weight "Instrument" builders (spec §2–§7, §12, §14; proposed D118, D119) ------------------------------
     Defined after chartHTML on purpose: the release gate reads chartModel…chartHTML as the weight chart's model,
     and nothing here defines a scale. Every mark goes through the model's own x and y; every figure is the
     engine's (chartModel, detectPlateau, forecastView, windowStats, trend). Presentation only. */
  const RANGE_NAMES={14:'Last 2 weeks',30:'Last month',90:'Last 3 months'};
  function rangeName(r=N.ui.range) {
    if(r==='cut'||!r)return cutRangeDays()?'Since your cut started':'Since your first weigh-in';
    return RANGE_NAMES[r]||`Last ${r} days`;
  }
  function spanText(a,b) { return a===b?N.shortDate(a):`${N.shortDate(a)}–${N.shortDate(b)}`; }
  const kgSigned=v=>N.signedFixed(v,1,'−');
  const rateSigned=v=>N.signedFixed(v,2,'−');
  const daysBetween=(a,b)=>Math.round((N.dateMs(b)-N.dateMs(a))/864e5);
  function chipHTML(tone,glyph,word) { return `<span class="wx-status ${tone}"><i aria-hidden="true">${glyph}</i>${esc(word)}</span>`; }
  /* Review states only (spec §6.1): a word and a shape, never colour alone (I2). */
  function statusChip(model) {
    const pl=model.plateau,rate=N.finite(pl&&pl.weeklyRate),ref=N.finite(pl&&pl.lastAvg);
    if(!pl||!pl.ok||rate===null)return '';
    const lo=goalLow(),hi=goalHigh();
    if(N.cfg().targetConfirmed&&ref!==null&&Number.isFinite(lo)&&Number.isFinite(hi)&&ref>=lo&&ref<=hi)return chipHTML('is-ok','✓','In range');
    if(ref&&rate/ref*100<-1)return chipHTML('is-review','◆','Losing quickly');
    if(pl.plateau)return chipHTML('is-review','◆','Plateau');
    if(pl.status==='gaining')return chipHTML('is-concern','◆','Review');
    return '';
  }
  /* The caption names the rate's own window (detectPlateau's 28 days ending today) and how many mornings it
     holds; a long and a short form (the short one below 360 px). Freshness (D104) replaces the tail. */
  function captionParts(model) {
    const pl=model.plateau,fv=model.forecastView,rows=N.weights();
    const win=N.windowStats(rows,state.date,N.plateauRules.windowDays).items;
    let full,short;
    if(pl&&pl.ok&&win.length){
      const rs=N.rateSpan(pl),n=win.length,m=`${n} ${N.plural(n,'morning')}`;
      full=`${rs.label} · ${m}, ${spanText(win[0].date,win.at(-1).date)}`;
      short=rs.full?`Last 4 weeks · ${m}`:`${rs.days} days · ${m}`;
    }else{
      const n=win.length,m=`${n} ${N.plural(n,'morning')}`;
      const ready=model.points&&model.points.some(p=>p.avg!==null);
      const need=ready?`a rate needs ${N.plateauRules.minReadings} mornings across ${N.plateauRules.minSpanDays} days`:'a trend needs 3 mornings within a week';
      full=`${m} in 4 weeks · ${need}`;short=`${m} · ${ready?'rate after '+N.plateauRules.minReadings:'trend after 3'}`;
    }
    let tail='';
    if(fv&&fv.freshness==='aging'){const d=fv.daysSinceObservation;tail=`As of ${N.shortDate(fv.modelOriginDate)} · ${d} ${N.plural(d,'day')} without a morning`;}
    else if(fv&&(fv.freshness==='stale'||fv.freshness==='expired')&&fv.lastObservationDate)tail=`Paused · last morning ${N.shortDate(fv.lastObservationDate)}`;
    return {full,short,tail,dates:win.length?spanText(win[0].date,win.at(-1).date):''};
  }
  function interpretationHTML(model) {
    const c=captionParts(model),tail=c.tail?`<span class="wx-cap-tail"><i aria-hidden="true">◆</i>${esc(c.tail)}</span>`:'';
    const expand=typeof N.expandChart==='function'?`<button type="button" class="wx-xbtn" aria-label="Expand chart" onclick="NXT.expandChart()"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 3.5h4.5V8M8 16.5H3.5V12M16.5 3.5 11 9M3.5 16.5 9 11"/></svg></button>`:'';
    return `<div class="wx-int">
        <div class="wx-int-t"><h2 class="wx-h2" id="wx-h" aria-describedby="wx-cap">${esc(trajectoryHeadline(model.plateau))}</h2>${statusChip(model)}</div>
        <p class="wx-cap" id="wx-cap"><span class="wx-cap-l">${esc(c.tail?c.full.split(' · ')[0]:c.full)}</span><span class="wx-cap-s" aria-hidden="true">${esc(c.tail?c.short.split(' · ')[0]:c.short)}</span>${tail}</p>
        ${expand}
      </div>`;
  }
  /* Readouts (spec §6.2): the legend and the selected day's figures in one row. The recorded reading, the gap to
     its trend (U+2212, kg) and the smoothed trend; post-workout appears only on a day that has one. Never the
     Estimated level (that belongs to the Journey). */
  function readoutsHTML(model,idx) {
    const p=model.points[idx],isLatest=idx===model.points.length-1,fv=model.forecastView;
    const postRow=model.postByDate.get(p.date);
    const gap=p.avg===null||p.avg===undefined?'—':kgSigned(p.weight-p.avg)+' kg';
    const lastTrend=model.points.filter(q=>q.avg!==null).at(-1);
    let fresh='';
    if(fv&&fv.freshness&&fv.freshness!=='fresh'&&fv.modelOriginDate)fresh=`<span class="wx-fresh is-old"><i aria-hidden="true">◆</i>As of ${esc(N.shortDate(fv.modelOriginDate))}</span>`;
    else if(lastTrend)fresh=`<span class="wx-fresh"><i aria-hidden="true">●</i>Updated ${lastTrend.date===state.date?'today':esc(N.shortDate(lastTrend.date))}</span>`;
    return `<div class="wx-ro" role="group" aria-label="Selected day">
        <div class="wx-cell wx-ca">
          <span class="wx-lab"><i class="vn-key-raw raw" aria-hidden="true"></i><span id="n99-chart-date">${isLatest?'Latest morning':'Morning reading'}</span></span>
          <div class="wx-v vn-num" id="n99-chart-weight">${p.weight.toFixed(1)}<em>kg</em></div>
          <div class="wx-sub"><span><span id="wx-date">${esc(dayDate(p.date))}</span><span class="wx-tm"> · <span id="n99-chart-timing">${esc(pointTiming(p))}</span></span></span>${noteChipHTML(p.date)}</div>
        </div>
        <div class="wx-cell wx-cb">
          <span class="wx-lab">vs trend</span>
          <b class="wx-gap vn-num" id="wx-gap">${gap}</b>
        </div>
        <div class="wx-cell wx-cc">
          <span class="wx-lab"><i class="vn-key-trend" aria-hidden="true"></i><span id="wx-lab-c">Smoothed trend</span></span>
          <div class="wx-v wx-v-t vn-num" id="n99-chart-average">${p.avg===null?'—':p.avg.toFixed(1)}<em>kg</em></div>
          <div class="wx-sub">${fresh}<span class="wx-on" id="wx-on"${isLatest?' hidden':''}>on ${esc(N.shortDate(p.date))}</span><span class="wx-gapline" id="n99-chart-coverage">${esc(gapLine(p))}</span></div>
        </div>
        <div class="wx-cell wx-cd" id="n99-chart-post" ${postRow?'':'hidden'}>
          <span class="wx-lab"><i class="vn-key-post post" aria-hidden="true"></i>Post-workout</span>
          <b class="vn-num" id="n99-chart-post-weight">${postRow?postRow.weight.toFixed(1)+' kg':''}</b>
          <small id="n99-chart-post-delta">${esc(postDelta(p,postRow))}</small>
        </div>
      </div>`;
  }
  /* Weekly steps (D41): a step per Mon–Sun week at that week's morning average, for every week of the range that
     holds three mornings. The old loop stopped after 20 weeks (guard<20); a long cut now draws every week. */
  function weeklySteps(m) {
    const out=[];
    if(!m.points||m.points.length<2)return out;
    const rows=N.weights(),first=m.points[0].date,last=m.points.at(-1).date,left=m.left,right=m.W-m.right;
    for(let st=N.weekStart(first),guard=0;st<=last&&guard<600;st=N.dateAdd(st,7),guard++){
      const en=N.dateAdd(st,6),wEnd=en>state.date?state.date:en,days=daysBetween(st,wEnd)+1,w=N.windowStats(rows,wEnd,days);
      if(!w||w.avg===null||w.n<3)continue;
      const from=st<first?first:st,to=en>last?last:en;
      out.push({st,en,x1:Math.max(left,m.x(from)),x2:Math.min(right,m.x(to)),y:m.y(w.avg),avg:w.avg,n:w.n});
    }
    return out;
  }
  /* Runs of four or more days without a morning reading inside the plotted window (and up to today). */
  function gapRuns(m) {
    const out=[],pts=m.points;
    for(let i=1;i<pts.length;i++){const d=daysBetween(pts[i-1].date,pts[i].date)-1;if(d>=4)out.push({a:N.dateAdd(pts[i-1].date,1),b:N.dateAdd(pts[i].date,-1),days:d});}
    const tailDays=pts.length?daysBetween(pts.at(-1).date,state.date):0;
    if(tailDays>=4)out.push({a:N.dateAdd(pts.at(-1).date,1),b:state.date,days:tailDays,tail:true});
    return out;
  }
  function layerState(model) {
    const start=model.start,end=state.date;
    const postN=N.timingRows('Post-workout').filter(r=>r.date>=start&&r.date<=end).length;
    const notesN=Object.keys(N.chartNotes()).filter(d=>d>=start&&d<=end).length;
    const weeks=weeklySteps(model).length;
    const fv=model.forecastView,fr=model.forecastRead;
    let projReason='';
    if(!N.cfg().targetConfirmed)projReason='Needs a confirmed goal';
    else if(fv&&(fv.freshness==='stale'||fv.freshness==='expired'))projReason='Paused · 3 mornings needed';
    else if(!model.canForecast)projReason=fr&&fr.ok&&fr.weeks===0?'Trend is in your goal range':'Needs 3 weeks of steady mornings';
    return [
      {k:'weekly',key:'showWeekly',glyph:'<i class="wx-key-step" aria-hidden="true"></i>',name:'Weekly averages',why:weeks>=2?'':'Needs 2 weeks with 3 mornings'},
      {k:'spread',key:'showSpread',glyph:'<i class="wx-key-band" aria-hidden="true"></i>',name:'Day-to-day spread',why:model.bands.length?'':'Needs 7 mornings in 14 days'},
      {k:'post',key:'showPost',glyph:'<i class="vn-key-post post" aria-hidden="true"></i>',name:'Post-workout',why:postN?'':'No post-workout readings in this range'},
      {k:'notes',key:'showNotes',glyph:'<i class="st-key-note" aria-hidden="true"></i>',name:`Notes · ${notesN}`,why:''},
      {k:'forecast',key:'showForecast',glyph:'<i class="vn-key-proj dash" aria-hidden="true"></i>',name:'Projection',why:projReason}
    ];
  }
  /* Range row (spec §6.3): range, one fixed transport slot (Replay / Stop / ↺ Latest, the same button in every
     state) and Layers. The drawer under it is always in the DOM (hidden when closed), so the series names stay in
     the chart's markup. */
  function rangeRowHTML(model,idx) {
    const ranges=[[14,'2W'],[30,'1M'],[90,'3M'],['cut','Cut']];
    const seg=`<div class="vn-seg n99-segments wx-seg" role="group" aria-label="Chart date range">${ranges.map(([r,l])=>{
      const active=N.ui.range===r||(r==='cut'&&!N.ui.range);
      return `<button type="button" aria-pressed="${active}" class="${active?'active':''}" onclick="NXT.setRange(${typeof r==='string'?`'${r}'`:r})"${r==='cut'?` aria-label="${cutRangeDays()?'Since your cut started, '+N.shortDate(settings.cutStart):'Since your first weigh-in'}"`:''}>${l}</button>`;
    }).join('')}</div>`;
    const isLatest=idx===model.points.length-1;
    const layers=layerState(model),on=layers.filter(l=>N.ui[l.key]&&!l.why).length,open=!!N.ui.layersOpen;
    const transport=`<button type="button" class="wx-tp" id="nxp-progress-latest" data-st-chart-replay data-wx-state="${isLatest?'idle':'historical'}">
        <svg class="wx-tp-g is-idle" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z"/></svg><svg class="wx-tp-g is-playing" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5"/></svg><svg class="wx-tp-g is-historical" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v2.6h2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="wx-tp-t is-idle">Replay</span><span class="wx-tp-t is-playing">Stop</span><span class="wx-tp-t is-historical">Latest</span>
      </button>`;
    const lbtn=`<button type="button" class="wx-lyb" id="wx-lyb" aria-expanded="${open}" aria-controls="wx-layers" aria-label="Chart layers, ${on} on" onclick="NXT.toggleLayers()"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 17 6.8 10 10.6 3 6.8z"/><path d="M3 10.2l7 3.8 7-3.8M3 13.6l7 3.8 7-3.8"/></svg>${on?`<b class="wx-badge" aria-hidden="true">${on}</b>`:''}</button>`;
    const chips=layers.map(l=>{
      const pressed=!!N.ui[l.key]&&!l.why,rid=`wx-why-${l.k}`;
      return `<button type="button" class="wx-lc${l.why?' is-off':''}" data-wx-layer="${l.k}" aria-pressed="${pressed}"${l.why?` aria-disabled="true" aria-describedby="${rid}"`:''} onclick="NXT.layerChip('${l.k}',this)">${l.glyph}<span>${esc(l.name)}</span>${l.why?`<small id="${rid}">${esc(l.why)}</small>`:''}</button>`;
    }).join('');
    return `<div class="wx-rr">${seg}${transport}${lbtn}</div>
      <div class="wx-layers" id="wx-layers" role="group" aria-label="Chart layers"${open?'':' hidden'}>
        <span class="wx-fixed"><i class="vn-key-raw raw" aria-hidden="true"></i>Morning readings</span><span class="wx-fixed"><i class="vn-key-trend" aria-hidden="true"></i>Smoothed trend</span>${chips}
      </div>`;
  }
  /* The range summary (D50): what this window says without scrubbing. Trend change (first → last smoothed trend
     plotted), the lowest morning and how many of the window's days were weighed. On Cut the first cell is the
     First reading, a name of its own (never "Start", which is the Journey's saved start weight, W6). */
  function rangeReadHTML(model) {
    const pts=model.points,tr=pts.filter(q=>q.avg!==null),isCut=!N.ui.range||N.ui.range==='cut';
    const days=daysBetween(model.start,state.date)+1;
    const low=pts.reduce((m,q)=>q.weight<m.weight?q:m,pts[0]);
    const ch=tr.length>=2?tr.at(-1).avg-tr[0].avg:null,over=tr.length>=2?daysBetween(tr[0].date,tr.at(-1).date):0;
    const change=`<div><small>Trend change</small><b class="vn-num">${ch===null?'—':kgSigned(ch)}<em>kg</em></b><span>${ch===null?'building':`over ${over} ${N.plural(over,'day')}`}</span></div>`;
    const first=`<div><small>First reading</small><b class="vn-num">${pts[0].weight.toFixed(1)}<em>kg</em></b><span>${esc(N.shortDate(pts[0].date))}</span></div>`;
    const cells=`${isCut?first:change}
        <div><small>Lowest</small><b class="vn-num">${low.weight.toFixed(1)}<em>kg</em></b><span>${esc(N.shortDate(low.date))}</span></div>
        <div><small>Weighed</small><b class="vn-num">${pts.length}<em> of ${days}</em></b><span>${Math.round(pts.length/days*100)}%</span></div>`;
    return `<div class="wx-sum" role="group" aria-label="This range">
        <p class="wx-sum-h"><span>${esc(rangeName())} · ${esc(spanText(model.start,state.date))}</span>${compareButtonHTML()}</p>
        <div class="wx-sum-c">${cells}</div>
        ${isCut&&ch!==null?`<p class="wx-sum-x">Trend change <b class="vn-num">${kgSigned(ch)} kg</b> over ${over} ${N.plural(over,'day')}</p>`:''}
      </div>`;
  }
  function srSummary(model) {
    const pts=model.points,tr=pts.filter(q=>q.avg!==null),low=pts.reduce((m,q)=>q.weight<m.weight?q:m,pts[0]),last=pts.at(-1);
    const n=pts.length,parts=[`${rangeName()}: ${n} morning ${N.plural(n,'reading')}, ${longDate(pts[0].date).replace(/^\S+ /,'')} to ${longDate(last.date).replace(/^\S+ /,'')}.`];
    if(tr.length>=2){const ch=tr.at(-1).avg-tr[0].avg;parts.push(`Smoothed trend from ${tr[0].avg.toFixed(1)} to ${tr.at(-1).avg.toFixed(1)} kilograms, ${Math.abs(ch)<.05?'unchanged':(ch<0?'down ':'up ')+Math.abs(ch).toFixed(1)}.`);}
    parts.push(`Lowest ${low.weight.toFixed(1)} on ${longDate(low.date).replace(/^\S+ /,'')}.`);
    if(last.avg!==null){const d=Number((last.weight-last.avg).toFixed(1));parts.push(`Latest morning ${last.weight.toFixed(1)}, ${d===0?'on trend':Math.abs(d).toFixed(1)+' '+(d<0?'below':'above')+' trend'}.`);}
    if(model.forecast)parts.push('A dashed line is a model projection, not a measurement.');
    parts.push('Use arrow keys to move between readings, Enter to open the day.');
    return parts.join(' ');
  }
  /* The plate (spec §2): the only lit edge above the fold. No nested <section>: the contract reads the chart
     HTML up to the first </section>. */
  function plateHTML(model,idx,animClass) {
    const p=model.points[idx],n=model.points.length,isLatest=idx===n-1,wide=!!N.ui.wxWide;
    return `<section class="wx-plate n99-chart${isLatest?'':' is-hist'}${wide?' is-wide':''}" id="vn-weight" aria-labelledby="wx-h" data-wx-timing="${pointTiming(p)==='Morning'?'morning':'other'}">
      ${interpretationHTML(model)}
      ${readoutsHTML(model,idx)}
      ${rangeRowHTML(model,idx)}
      <div class="vn-chart-wrap wx-wrap" id="vn-chart-wrap" tabindex="0" role="slider" aria-label="Weight chart, ${esc(rangeName().toLowerCase())}"
        aria-valuemin="0" aria-valuemax="${n-1}" aria-valuenow="${idx}" aria-valuetext="${esc(pointWords(p))}" aria-describedby="wx-sr-sum"
        onpointerdown="NXT.scrub(event)" onpointermove="NXT.scrub(event)" onpointerup="NXT.scrubUp(event)" onpointercancel="NXT.scrubCancel(event)"
        onkeydown="NXT.chartKey(event)">${plotHTML(model,{idx,animClass})}</div>
      ${legendHTML(model)}
      ${wide?selectionHTML(model,idx,true):''}
      <p class="st-sr" id="wx-sr-sum">${esc(srSummary(model))}</p>
      <p class="st-sr" id="wx-sel-sr" aria-live="polite"></p>
      <div class="wx-slot${model.compare?' is-cmp':''}" id="wx-slot" data-wx-slot="${N.ui.selected&&!isLatest?'select':'summary'}">${model.compare?compareHTML(model):rangeReadHTML(model)}${wide?'':selectionHTML(model,idx,false)}</div>
      <input type="hidden" id="n99-chart-slider" value="${idx}" aria-hidden="true">
    </section>`;
  }
  /* The inspector (spec §8.4, §4). On a phone the plate's slot swaps from the range summary to this bar while a
     day is selected: the selected date with × (Back to latest), the day's context from NXP.dayState (D105) as a
     link to the day, then + Note and Open day. On a wide layout the same content is a persistent strip under the
     plot, which at the latest reading reads "Selected · Latest · Mon 19 Oct" and carries ↺ Back to latest only
     while historical. One of the two is in the DOM at a time (a render-time choice), so the ids are unique and
     selectPoint writes to whichever exists. */
  function selectionHTML(model,idx,strip) {
    const p=model.points[idx],isLatest=idx===model.points.length-1,ctx=dayContext(p.date);
    const x=`<button type="button" class="wx-sel-x" id="wx-sel-x" aria-label="Back to latest" onclick="NXT.backToLatest()"${strip&&isLatest?' hidden':''}>${strip?'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v2.6h2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Back to latest</span>':'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'}</button>`;
    return `<div class="${strip?'wx-insp':'wx-sel'}" id="wx-sel" role="group" aria-label="Selected day">
        <div class="wx-sel-r1"><span class="wx-sel-h">Selected · <span id="wx-sel-l"${isLatest?'':' hidden'}>Latest · </span><b id="wx-sel-d">${esc(dayDate(p.date))}</b></span>${strip?'':x}</div>
        <button type="button" class="wx-sel-ctx${ctx.quiet?' is-quiet':''}" id="wx-sel-ctx" data-date="${p.date}" onclick="NXT.openChartDay(this.dataset.date)" aria-label="${esc((strip?'That day: ':'')+ctx.text)}. Open in History">${strip?'<span class="wx-sel-k">That day</span>':''}<span id="wx-sel-ctxt">${esc(ctx.text)}</span><i aria-hidden="true">›</i></button>
        <div class="wx-sel-r3"><span id="wx-sel-note-h">${noteChipHTML(p.date,'wx-sel-note')}</span><button type="button" class="wx-sel-open" id="wx-sel-open" data-date="${p.date}" onclick="NXT.openChartDay(this.dataset.date)">Open day<i aria-hidden="true"> ›</i></button>${strip?x:''}</div>
      </div>`;
  }
  /* The day's context for the inspector: the D105 state from NXP.dayState ("Full Body A · In progress · 6 of 15
     sets"), "Rest day", or the quiet "No training logged"; without NXP (node) the records themselves. */
  const DS_SHORT={finished:'Finished',complete:'Sets complete',progress:'In progress',partial:'Partly logged',done:'Done',addon:'Add-on logged'};
  function dayContext(date) {
    const nxp=typeof NXP==='object'&&NXP&&typeof NXP.dayState==='function'?NXP:null;
    let ds=null;try{ds=nxp?nxp.dayState(date,null,null):null;}catch(_){ds=null;}
    const did=dayDidText(date);
    if(ds){
      if(ds.k==='rest'&&!ds.recorded.any)return {text:'Rest day',quiet:false,k:ds.k};
      if(ds.lift&&(ds.recorded.workingSets>0||ds.finished)){
        const sets=ds.detail||`${ds.recorded.workingSets} ${N.plural(ds.recorded.workingSets,'set')}`;
        return {text:`${ds.label} · ${DS_SHORT[ds.k]||ds.w||'Logged'} · ${sets}`,quiet:false,k:ds.k};
      }
      if(ds.recorded.any)return {text:`${ds.label} · ${DS_SHORT[ds.k]||ds.w||'Done'}${did?' · '+did:''}`,quiet:false,k:ds.k};
      if(ds.k==='excused'||ds.k==='moved')return {text:`${ds.label} · ${ds.w}`,quiet:false,k:ds.k};
      if(ds.k==='today'||ds.k==='planned')return {text:`${ds.label} · ${ds.w}`,quiet:false,k:ds.k};
      return {text:'No training logged',quiet:true,k:ds.k};
    }
    return did?{text:did,quiet:false,k:'records'}:{text:'No training logged',quiet:true,k:'none'};
  }
  function dayDidText(date) {
    try{
      const sets=(state.logs||[]).filter(r=>r&&r.date===date&&r.setType!=='warmup'),bits=[];
      if(sets.length){const t=sets[0].dayType;bits.push((t?N.label(t):'Lifted')+' · '+sets.length+' '+N.plural(sets.length,'set'));}
      const mins=(state.cardio||[]).filter(r=>r&&r.date===date).reduce((a,r)=>a+(Number(r.duration||r.minutes)||0),0);
      if(mins>0)bits.push(Math.round(mins)+' min cardio');
      return bits.join(' · ');
    }catch(_){return '';}
  }
  /* Lane placement (spec §8.3): the date lane sits in the top lane (plot top + 6), centred on the cursor and
     clamped 10 px from the plot's edges; if any plotted mark falls inside it, it flips to the bottom lane (above
     the x-axis); if both lanes collide it is hidden, and the readouts carry the date. w and h are the lane's own
     size in chart units. Pure geometry over the model's own marks, so a test can place every reading. */
  function laneMarks(m,idx) {
    const {points,segments,top,W,H,right,bottom}=m,base=H-bottom,plotR=W-right,n=points.length,out=[];
    const dotR=(n>90?1.8:n>45?2.4:3)+1.4;
    points.forEach((p,i)=>out.push({x:p.x,y:p.y,r:i===idx?6:dotR}));
    segments.forEach(seg=>{for(let i=0;i<seg.length;i++){out.push({x:seg[i].x,y:seg[i].y,r:5});if(i)out.push({x:(seg[i].x+seg[i-1].x)/2,y:(seg[i].y+seg[i-1].y)/2,r:5});}});
    (m.post||[]).forEach(pt=>out.push({x:pt.x,y:pt.y<top?top+5:pt.y>base?base-5:pt.y,r:5}));
    if(N.ui.showNotes!==false&&n>=2){const a=points[0],b=points[n-1],t0=N.dateMs(a.date),t1=N.dateMs(b.date);
      Object.keys(N.chartNotes()).filter(d=>d>=a.date&&d<=b.date).forEach(d=>out.push({x:a.x+(N.dateMs(d)-t0)/Math.max(1,t1-t0)*(b.x-a.x),y:top+6,r:6}));}
    if(N.ui.showWeekly)weeklySteps(m).forEach(s=>{for(let x=s.x1;x<=s.x2;x+=8)out.push({x,y:s.y,r:1.5});});
    if(m.forecast){const f=m.forecast.mid,len=Math.hypot(f.x2-f.x1,f.y2-f.y1)||1;for(let t=0;t<=len;t+=8)out.push({x:f.x1+(f.x2-f.x1)*t/len,y:f.y1+(f.y2-f.y1)*t/len,r:1.5});
      if(m.forecast.endpoint)out.push({x:m.forecast.endpoint.x,y:m.forecast.endpoint.y,r:4});
      const fv=m.forecastView;if(fv&&fv.showArrival){const t='Goal range · ~'+N.shortDate(fv.arrivalDate),w=18+t.length*5.9;out.push({x:plotR-w/2-4,y:top+14,r:0,w,h:20});}}
    if(n>=7){const low=points.reduce((a,q)=>q.weight<a.weight?q:a,points[0]);if(low!==points[n-1])out.push({x:low.x,y:low.y,r:7});}
    return out;
  }
  function lanePlace(m,idx,w,h) {
    const p=m.points[idx];if(!p)return {lane:null};
    const plotR=m.W-m.right,base=m.H-m.bottom;
    const cx=Math.min(Math.max(p.x,m.left+10+w/2),plotR-10-w/2);
    const marks=laneMarks(m,idx);
    const hit=(r,k)=>{const rw=k.w||0,rh=k.h||0;return k.x+rw/2+k.r>r.x&&k.x-rw/2-k.r<r.x+r.w&&k.y+rh/2+k.r>r.y&&k.y-rh/2-k.r<r.y+r.h;};
    for(const L of [{lane:'top',y:m.top+6},{lane:'bottom',y:base-6-h}]){
      const rect={x:cx-w/2,y:L.y,w,h};
      if(!marks.some(k=>hit(rect,k)))return {lane:L.lane,x:cx,y:L.y,w,h};
    }
    return {lane:null,x:cx,w,h};
  }
  /* A week on the chart (spec §8.6): the band spans that Monday to Sunday on the model's own x scale (clamped to
     the plot), and the week's step is the same figure weeklySteps draws, found whether or not the layer is on. */
  function weekBand(m,st) {
    if(!m||!m.points||!m.points.length)return null;
    const en=N.dateAdd(st,6),left=m.left,right=m.W-m.right;
    const x1=Math.max(left,m.x(st)),x2=Math.min(right,m.x(en));
    if(!(x2>x1))return null;
    const inWk=m.points.map((q,i)=>({q,i})).filter(o=>o.q.date>=st&&o.q.date<=en);
    const step=weeklySteps(m).find(s=>s.st===st)||null;
    return {st,en,x1,x2,top:m.top,bottom:m.H-m.bottom,step,last:inWk.length?inWk[inWk.length-1].i:-1,n:inWk.length};
  }
  /* Back to latest (spec §8.6): the selection bar's ×, the strip's ↺ and the transport share this. The glide is
     the presentation layer's (opts.glide), a jump under reduced motion. */
  function backToLatest() {
    const m=N.ui.chart;if(!m||!m.points||!m.points.length)return;
    N.selectPoint(m.points.length-1,{clear:true,glide:true});
  }
  /* ‹ Weight (spec §8.6): History's day header returns to where Weight was: the range, the layers, Compare and
     the selected day are restored before the tab renders; the selection and the scroll position after it. The
     memory is cleared once used, and progress() drops it when Weight is reached any other way. */
  function returnToWeight() {
    const r=N.ui.returnTo;if(!r)return false;
    N.ui.returnTo=null;N.ui.restoring=r;
    N.ui.view=r.view||'overview';N.ui.range=r.range;N.ui.selected=r.selected;N.ui.compare=r.compare||null;
    if(r.layers)for(const k of Object.keys(r.layers))if(k in N.ui)N.ui[k]=r.layers[k];
    if(typeof switchTab==='function')switchTab('weight');
    let tries=0;
    const settle=()=>{
      const m=N.ui.chart;
      if(N.ui.restoring&&tries++<40){setTimeout(settle,25);return;}
      N.ui.restoring=null;
      if(m&&m.points&&m.points.length){const i=r.selected?m.points.findIndex(p=>p.date===r.selected):-1;N.selectPoint(i>=0?i:m.points.length-1,i>=0?{}:{clear:true});}
      if(typeof window!=='undefined'&&window.scrollTo)window.scrollTo(0,Number(r.scrollY)||0);
    };
    settle();
    return true;
  }
  /* The plot (spec §7.3), back to front: screen, grid, week bands, spread, area, post-workout, trend, readings,
     weekly steps, notes, projection, lowest ring, selection, and the scale gutter with one trend tag. */
  function plotHTML(m,o={}) {
    const {points,post,segments,ticks,bands,forecast,anchor,futureDays,todayX,W,H,left,right,top,bottom,geo}=m;
    const base=H-bottom,px=v=>Number(v).toFixed(2),plotR=W-right,gutterRight=!!(geo&&geo.gutter==='right');
    const idx=o.idx===undefined?points.length-1:o.idx,p=points[idx],n=points.length;
    const dotR=n>90?1.8:n>45?2.4:3;
    let kept=ticks;while(kept.length>5)kept=kept.filter((_,i)=>(kept.length-1-i)%2===0);
    const grid=kept.map(t=>`<line class="wx-grid" x1="${left}" x2="${plotR}" y1="${px(t.y)}" y2="${px(t.y)}"/>`).join('');
    /* The trend tag: the last smoothed value, in the gutter, tied to the stroke by a dotted leader. */
    const tail=segments.at(-1)?.at(-1)||null;
    const tagY=tail?Math.min(base-10,Math.max(top+10,tail.y)):null;
    const tag=gutterRight&&tail?`<g class="wx-tag" aria-hidden="true"><line class="wx-leader" x1="${px(tail.x+4)}" y1="${px(tail.y)}" x2="${px(plotR+2)}" y2="${px(tagY)}"/><rect x="${px(plotR+3)}" y="${px(tagY-9.5)}" width="${right-5}" height="19" rx="9.5"/><text x="${px(plotR+3+(right-5)/2)}" y="${px(tagY+4.4)}" text-anchor="middle">${tail.avg.toFixed(1)}</text></g>`:'';
    const tickTxt=kept.filter(t=>!(tag&&Math.abs(t.y-tagY)<13)).map((t,i,arr)=>{
      const v=Number(t.value.toFixed(1)),topTick=t===kept[kept.length-1]&&gutterRight;
      return gutterRight?`<text class="vn-ytick wx-scale" x="${W-6}" y="${px(t.y+4)}" text-anchor="end">${v}${topTick?'<tspan class="wx-unit"> kg</tspan>':''}</text>`
        :`<text class="vn-ytick" x="${left-7}" y="${px(t.y+3.8)}" text-anchor="end" fill="${CHART.axisText}" font-size="11">${v}</text>`;
    }).join('')+(gutterRight?'':`<text class="vn-yunit" x="${left-7}" y="${px(Math.max(11,Math.min(...kept.map(k=>k.y))-11))}" text-anchor="end" fill="${CHART.axisText}" font-size="10">kg</text>`);
    /* Gaps: four or more days without a morning are a hatched column, labelled in the bottom lane. */
    const gaps=gapRuns(m).map(g=>{const x1=Math.max(left,m.x(g.a)-3),x2=Math.min(plotR,(g.tail?todayX:m.x(g.b))+3);return {...g,x1,x2};}).filter(g=>g.x2-g.x1>2);
    const gapCols=gaps.map(g=>`<rect class="wx-gapcol" x="${px(g.x1)}" y="${top}" width="${px(g.x2-g.x1)}" height="${px(base-top)}"/>`).join('');
    const gapLabs=gaps.filter(g=>g.x2-g.x1>=96).map(g=>({x:(g.x1+g.x2)/2,t:`No mornings ${spanText(g.a,g.b)}`}));
    /* x dates in the bottom lane, dropped where a gap label sits. */
    const xY=gutterRight?base+18:H-8;
    const xIdx=n<3?[...new Set([0,n-1])]:[0,Math.round((n-1)/2),n-1];
    const xLabs=[...new Set(xIdx)].map((i,k,arr)=>({pt:points[i],anchor:arr.length===1?'start':k===0?'start':k===arr.length-1?'end':'middle'}))
      .filter(l=>!gapLabs.some(g=>Math.abs(g.x-l.pt.x)<70))
      .map(l=>`<text class="wx-x" x="${px(l.pt.x)}" y="${xY}" text-anchor="${l.anchor}"${gutterRight?'':` fill="${CHART.axisText}" font-size="11"`}>${esc(N.shortDate(l.pt.date))}</text>`).join('')
      +gapLabs.map(g=>`<text class="wx-x wx-gaplab" x="${px(g.x)}" y="${xY}" text-anchor="middle">${esc(g.t)}</text>`).join('');
    /* Optional layers (spec §9): drawn only when on. */
    const steps=N.ui.showWeekly?weeklySteps(m):[];
    let weekBands='';
    if(N.ui.showWeekly&&n>1){
      let k=0;for(let st=N.weekStart(points[0].date),guard=0;st<=points.at(-1).date&&guard<600;st=N.dateAdd(st,7),guard++,k++){
        if(k%2)continue;const a=Math.max(left,m.x(st)),b=Math.min(plotR,m.x(N.dateAdd(st,7)));
        if(b>a)weekBands+=`<rect class="st-band" x="${px(a)}" y="${top}" width="${px(b-a)}" height="${px(base-top)}"/>`;
      }
    }
    const spread=N.ui.showSpread?bands.map(run=>`<path class="wx-spread" d="M ${run.map(b=>`${px(b.x)} ${px(b.upper)}`).join(' L ')} L ${[...run].reverse().map(b=>`${px(b.x)} ${px(b.lower)}`).join(' L ')} Z"/>`).join(''):'';
    const area=segments.filter(s=>s.length>1).map(seg=>`<path class="wx-area" d="${smoothPath(seg)} L ${px(seg.at(-1).x)} ${px(base)} L ${px(seg[0].x)} ${px(base)} Z" fill="url(#wx-area-g)"/>`).join('');
    /* Post-workout: hollow diamonds on the same scale, painted before the morning readings (contract); a value
       off this scale becomes a chevron at the plot edge (the domain stays data-only, D2). */
    const postSeries=post.map(pt=>{
      const s=3.4;
      if(pt.y<top)return `<path class="vn-post-mark is-off" d="M${px(pt.x)} ${px(top+2)}L${px(pt.x+4)} ${px(top+8)}L${px(pt.x-4)} ${px(top+8)}Z"/>`;
      if(pt.y>base)return `<path class="vn-post-mark is-off" d="M${px(pt.x)} ${px(base-2)}L${px(pt.x+4)} ${px(base-8)}L${px(pt.x-4)} ${px(base-8)}Z"/>`;
      return `<path class="vn-post-mark" d="M${px(pt.x)} ${px(pt.y-s)}L${px(pt.x+s)} ${px(pt.y)}L${px(pt.x)} ${px(pt.y+s)}L${px(pt.x-s)} ${px(pt.y)}Z" fill="none" stroke="${CHART.inkSecondary}" stroke-width="1.5"/>`;
    }).join('');
    const trend=segments.map(seg=>seg.length>1?`<path class="wx-under" d="${smoothPath(seg)}"/><path class="vn-trend-line" d="${smoothPath(seg)}" pathLength="1" fill="none" stroke="url(#st-tg)" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>`
      :`<circle class="wx-trend-pt" cx="${px(seg[0].x)}" cy="${px(seg[0].y)}" r="${CHART.point}"/>`).join('');
    const dots=points.map((pt,i)=>`<circle class="vn-raw-dot" cx="${px(pt.x)}" cy="${px(pt.y)}" r="${dotR}" style="--i:${i}"/>`).join('');
    const stepMarks=steps.map(s=>`<line class="st-wstep" x1="${px(s.x1)}" x2="${px(s.x2)}" y1="${px(s.y)}" y2="${px(s.y)}"/>`).join('');
    const notes=N.ui.showNotes===false?'':noteFlags(points,top,base);
    const today=futureDays?`<line class="wx-today" x1="${px(todayX)}" x2="${px(todayX)}" y1="${top}" y2="${base}"/>`:'';
    const cone=forecast?`<polygon points="${forecast.cone.map(([cx,cy])=>`${px(cx)},${px(cy)}`).join(' ')}" fill="url(#n99-chart-cone)"/>`:'';
    const projLine=forecast?`<line class="vn-proj-line" x1="${px(forecast.mid.x1)}" y1="${px(forecast.mid.y1)}" x2="${px(forecast.mid.x2)}" y2="${px(forecast.mid.y2)}" stroke="${CHART.ink}" stroke-width="${CHART.lineForecast}" stroke-linecap="round" stroke-dasharray="2 5" stroke-opacity=".55"/>${forecast.endpoint?`<circle cx="${px(forecast.endpoint.x)}" cy="${px(forecast.endpoint.y)}" r="3.5" fill="none" stroke="${CHART.ink}" stroke-width="1.5" stroke-opacity=".7"/>`:''}${tail&&anchor&&Math.hypot(anchor.x-tail.x,anchor.y-tail.y)>3?`<line class="st-bridge" x1="${px(tail.x)}" y1="${px(tail.y)}" x2="${px(anchor.x)}" y2="${px(anchor.y)}"/>`:''}`:'';
    const fv=m.forecastView;
    let goalPill='';
    if(forecast&&fv&&fv.showArrival){const t='Goal range · ~'+N.shortDate(fv.arrivalDate),w=18+t.length*5.9,gx=plotR-w-4,gy=top+4;goalPill=`<g class="st-pillg is-goal"><rect x="${px(gx)}" y="${px(gy)}" width="${px(w)}" height="20" rx="10"/><text x="${px(gx+w/2)}" y="${px(gy+13.6)}" text-anchor="middle">${esc(t)}</text></g>`;}
    const low=n>=7?points.reduce((a,q)=>q.weight<a.weight?q:a,points[0]):null;
    const lowRing=low&&low!==points.at(-1)?`<circle class="wx-low" cx="${px(low.x)}" cy="${px(low.y)}" r="6.5"/>`:'';
    const hasStem=p.ty!==null&&p.ty!==undefined&&Math.abs(p.y-p.ty)>3;
    /* Compare (spec §11): "Before" on the hatch, "This range" on a faint violet wash, an uncompared stretch between
       them dimmed; the same marks are drawn in both windows (nothing shifted, nothing interpolated) and a veil
       over the "before" window lowers their emphasis. The window labels take the bottom lane. */
    const cv=m.compare&&m.compare.ok?m.compare:null;
    let cmpBands='',cmpVeil='',cmpLabs='';
    if(cv){
      const A=cv.cw.before,B=cv.cw.current,bTo=B.to>state.date?state.date:B.to;
      const xa1=Math.max(left,m.x(A.from)-3),xa2=Math.min(plotR,m.x(A.to)+3),xb1=Math.max(left,m.x(B.from)-3),xb2=Math.min(plotR,m.x(bTo)+3);
      const band=(cls,x1,x2)=>x2-x1>1?`<rect class="${cls}" x="${px(x1)}" y="${top}" width="${px(x2-x1)}" height="${px(base-top)}"/>`:'';
      cmpBands=band('wx-cmp-before',xa1,xa2)+band('wx-cmp-cur',xb1,xb2)+(xb1-xa2>4?band('wx-cmp-gap',xa2,xb1):'');
      cmpVeil=band('wx-cmp-veil',xa1,xa2)+(xb1-xa2>4?band('wx-cmp-veil is-gap',xa2,xb1):'');
      const lab=(x1,x2,t,short)=>{const w=x2-x1,full=t.length*5.9+6;return `<text class="wx-x wx-cmp-l" x="${px((x1+x2)/2)}" y="${xY}" text-anchor="middle">${esc(full<=w?t:short)}</text>`;};
      cmpLabs=lab(xa1,xa2,`Before · ${spanText(A.from,A.to)}`,'Before')+lab(xb1,xb2,'This range','Now');
    }
    return `<svg id="n99-chart-svg" class="n99-chart-svg vn-chart-svg wx-svg${o.animClass||''}${n>45?' is-busy':''}" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="vn-chart-clip"><rect id="vn-chart-clip-r" x="${left}" y="${top}" width="${W-left-right}" height="${base-top}"/></clipPath>
          <linearGradient id="st-tg" x1="${left}" y1="0" x2="${plotR}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7C5CFF" stop-opacity=".6"/><stop offset=".55" stop-color="#B49AFF"/><stop offset="1" stop-color="#F3EEFF"/></linearGradient>
          <linearGradient id="wx-area-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8B5CF6" stop-opacity=".16"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></linearGradient>
          <linearGradient id="n99-chart-cone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${CHART.ink}" stop-opacity=".10"/><stop offset="1" stop-color="${CHART.ink}" stop-opacity=".02"/></linearGradient>
          <pattern id="wx-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line class="wx-hatch-l" x1="0" y1="0" x2="0" y2="6"/></pattern>
        </defs>
        <rect class="wx-screen" x="${left}" y="${top}" width="${W-left-right}" height="${px(base-top)}"/>
        <line class="wx-hair" x1="${left}" x2="${plotR}" y1="${top}" y2="${top}"/><line class="wx-hair" x1="${left}" x2="${plotR}" y1="${px(base)}" y2="${px(base)}"/>
        ${grid}
        <g clip-path="url(#vn-chart-clip)" pointer-events="none">
          ${cmpBands}${weekBands}${gapCols}${today}${cone}${spread}${area}${notes}${postSeries}${trend}${projLine}${dots}${stepMarks}${lowRing}${cmpVeil}
          <line id="n99-chart-cursor" class="wx-cur" x1="${px(p.x)}" x2="${px(p.x)}" y1="${top}" y2="${px(base)}"/>
          <line id="st-stem" class="st-stem" x1="${px(p.x)}" x2="${px(p.x)}" y1="${px(p.y)}" y2="${hasStem?px(p.ty):px(p.y)}" visibility="${hasStem&&idx!==n-1?'visible':'hidden'}"/>
        </g>
        ${anchor&&forecast?`<circle cx="${px(anchor.x)}" cy="${px(anchor.y)}" r="4" fill="${CHART.ink}" stroke="${CHART.activeRing}" stroke-width="2" pointer-events="none"/>`:''}
        <circle id="st-chart-halo" class="st-halo" cx="${px(p.x)}" cy="${px(p.y)}" r="11" pointer-events="none"/>
        <circle id="n99-chart-active" cx="${px(p.x)}" cy="${px(p.y)}" r="5" pointer-events="none"/>
        ${goalPill}${tickTxt}${tag}${cv?cmpLabs:xLabs}
      </svg>`;
  }
  /* Empty plate (spec §15): the same frame with its first step. Contextual-only weigh-ins (D14) are not denied:
     they are named, with where to find them. */
  function emptyPlateHTML(model) {
    const other=N.weights().length?0:N.otherTimingCount();
    const emptyTitle=N.weights().length?'No weigh-ins in this period':other?'No morning readings yet':'Your first weigh-in starts here';
    const emptyBody=N.weights().length?'Choose Cut to see older entries, or log a current weight.':other?`${other} ${N.plural(other,'reading')} logged at other times of day ${other===1?'is':'are'} in History. The trend, rate and projection use morning weigh-ins only, so your first morning reading starts the chart.`:'Your actual readings will appear as dots. A trend line starts when a seven-day window has three readings.';
    const ranges=[[14,'2W'],[30,'1M'],[90,'3M'],['cut','Cut']];
    return `<section class="wx-plate n99-chart is-empty" id="vn-weight" aria-labelledby="wx-h">
      <div class="wx-int"><div class="wx-int-t"><h2 class="wx-h2" id="wx-h">${N.weights().length?'Building your baseline':'Your first morning reading starts this chart'}</h2></div></div>
      <div class="wx-rr"><div class="vn-seg n99-segments wx-seg" role="group" aria-label="Chart date range">${ranges.map(([r,l])=>{const a=N.ui.range===r||(r==='cut'&&!N.ui.range);return `<button type="button" aria-pressed="${a}" class="${a?'active':''}" onclick="NXT.setRange(${typeof r==='string'?`'${r}'`:r})">${l}</button>`;}).join('')}</div></div>
      <div class="vn-chart-empty n99-chart-empty wx-empty"><div class="n99-empty-number">—<small> kg</small></div>
        <h3>${emptyTitle}</h3><p>${emptyBody}</p>${N.button('+ Log morning weight','apx95OpenQuickWeight()')}</div>
    </section>`;
  }
  /* Analysis (spec §14): quiet disclosure rows, each summary a real fact. Open state is memory only. */
  function analysisRow(key,title,summary,body,o={}) {
    N.ui.wxOpen=N.ui.wxOpen||{};
    const open=!!N.ui.wxOpen[key];
    if(o.action)return `<div class="wx-row" data-wx-row="${key}"><button type="button" class="wx-row-b" onclick="${o.action}"><span class="wx-row-l"><span class="wx-row-t">${esc(title)}</span><span class="wx-row-s">${esc(summary)}</span></span><i class="wx-chev" aria-hidden="true">›</i></button></div>`;
    return `<div class="wx-row${open?' is-open':''}${o.cls?' '+o.cls:''}" data-wx-row="${key}"><button type="button" class="wx-row-b" aria-expanded="${open}" aria-controls="wx-p-${key}" onclick="NXT.wxRow('${key}')"><span class="wx-row-l"><span class="wx-row-t">${esc(title)}</span><span class="wx-row-s" id="wx-s-${key}">${esc(summary)}</span></span><i class="wx-chev" aria-hidden="true">›</i></button><div class="wx-row-p" id="wx-p-${key}"${open?'':' hidden'}>${body}</div></div>`;
  }
  function weeksSummary() {
    const rows=N.weights(),ws=N.weekStart(state.date),prev=N.dateAdd(ws,-7);
    const a=N.windowStats(rows,N.dateAdd(prev,6),7),b=N.windowStats(rows,N.dateAdd(prev,-1),7);
    if(!a.n)return 'Monday to Sunday morning averages';
    const chg=a.n>=3&&b.n>=3?a.avg-b.avg:null;
    return `Week of ${N.shortDate(prev)}${chg===null?'':' '+kgSigned(chg)+' kg'} · ${a.n} of 7 mornings`;
  }
  function devSummary(model) {
    const t=model.points.filter(q=>q.avg!==null&&Math.abs(q.weight-q.avg)>=.05);
    if(t.length<4)return 'Needs 4 mornings with a trend';
    const below=t.filter(q=>q.weight<q.avg).length,above=t.length-below;
    return below>=above?`${below} of ${t.length} mornings below the trend this range`:`${above} of ${t.length} mornings above the trend this range`;
  }
  function analysisHTML(model,plateau) {
    const rows=N.weights(),has=!!(model.points&&model.points.length);
    const ev=has?evidenceParts(plateau,model.forecastRead,model.forecastView):null;
    const how=`<div class="wx-how">
        <p class="vn-tiny">Dots are morning readings. The solid line is the smoothed trend, an average that weights recent mornings more, so it runs behind a moving weight. The tag at its end is the latest smoothed value. A hatched column marks four or more days without a morning reading.</p>
        <p class="vn-tiny vn-mt3"><b>Day-to-day spread</b> is the scatter of your mornings around the trend. <b>Rate range</b> is where the four-week rate likely sits, about ±2 standard errors of its line. <b>Projection range</b> is the spread of the projected arrival, about 2 in 3.</p>
        ${nowNote()}${N.diagnosisCard()}${N.reviewCard()}${N.cfg().targetConfirmed?'<p class="vn-tiny vn-mt3">A weight range alone does not measure leanness.</p>':''}
      </div>`;
    const other=N.otherTimingCount(),latest=rows.at(-1);
    const weighSum=latest?`Latest ${latest.weight.toFixed(1)} kg · ${N.shortDate(latest.date)}${other?` · ${other} other-time`:''}`:`0 morning readings${other?` · ${other} other-time`:''}`;
    const out=[];
    if(has){
      out.push(analysisRow('weeks','Week by week',weeksSummary(),'<div class="wx-weeks" id="wx-weeks"></div>'));
      out.push(analysisRow('rate','Rate',ev.summary,ev.html,{cls:'is-rate'}));
      if(ev.rax)out.push(analysisRow('rax','Rate across your cut',ev.raxNote,ev.rax));
      out.push(analysisRow('dev','Each day vs its trend',devSummary(model),`<div class="wx-dev" id="wx-dev"></div><p class="vn-tiny">Each bar is one morning against its own smoothed trend value. While you are cutting most mornings land below it, because the trend averages the days before; several days above it in a row mean the drop is slowing.</p>`));
    }
    out.push(analysisRow('how','How these numbers are made','Trend, rate, spread and projection explained',how));
    out.push(analysisRow('all',`All weigh-ins · ${rows.length}`,weighSum,'',{action:'NXT.openWeightHistory()'}));
    /* The Rate row leads when the cut is losing quickly (spec §15). */
    if(ev&&ev.quick){const i=out.findIndex(r=>r.indexOf('data-wx-row="rate"')!==-1);if(i>0)out.unshift(out.splice(i,1)[0]);}
    return `<section class="wx-an" aria-labelledby="wx-an-h"><h2 class="wx-an-h" id="wx-an-h">Analysis</h2>${out.join('')}</section>`;
  }
  function evidenceParts(plateau,forecastRead,view) {
    const fv=view||N.forecastView(N.weights()),rate=N.finite(plateau&&plateau.weeklyRate),ref=N.finite(plateau&&plateau.lastAvg);
    const raxOut={};
    const html=evidenceHTML(plateau,forecastRead,fv,{rax:false});
    const rax=rateTrendHTML(rateSigned,raxOut,fv);
    const conf=plateau&&plateau.confidence&&plateau.confidence!=='none'?plateau.confidence:null;
    const summary=plateau&&plateau.ok&&rate!==null?`${rateSigned(rate)} kg/wk${conf?` · Rate precision ${conf.charAt(0).toUpperCase()+conf.slice(1)}`:''}`:'Building: '+((plateau&&plateau.n)||0)+' mornings in 4 weeks';
    return {html,rax,raxNote:raxOut.note||'',summary,quick:!!(plateau&&plateau.ok&&ref&&rate!==null&&rate/ref*100<-1)};
  }
  /* Analysis rows open in place; the open set lives in memory only (N.ui.wxOpen), so a repaint keeps it. */
  function wxRow(key) {
    N.ui.wxOpen=N.ui.wxOpen||{};
    const row=typeof document!=='undefined'&&document.querySelector(`[data-wx-row="${key}"]`);
    const open=!N.ui.wxOpen[key];N.ui.wxOpen[key]=open;
    if(!row)return open;
    row.classList.toggle('is-open',open);
    const b=row.querySelector('.wx-row-b'),p=row.querySelector('.wx-row-p');
    if(b)b.setAttribute('aria-expanded',String(open));
    if(p)p.hidden=!open;
    return open;
  }
  /* Layers drawer: opened and closed in place (no repaint); a chip sets its layer (D111's setLayer) and focus
     returns to the same chip after the repaint. A disabled chip says why instead of toggling. */
  function toggleLayers(force) {
    N.ui.layersOpen=force===undefined?!N.ui.layersOpen:!!force;
    const d=typeof document!=='undefined'&&document.getElementById('wx-layers'),b=d&&document.getElementById('wx-lyb');
    const apply=()=>{if(d)d.hidden=!N.ui.layersOpen;if(b)b.setAttribute('aria-expanded',String(N.ui.layersOpen));};
    /* The drawer opens and closes as one movement (STRATA.morph, 240 ms; a plain change under reduced motion). */
    const plate=d&&d.closest?d.closest('.wx-plate'):null;
    if(plate&&typeof STRATA==='object'&&STRATA&&typeof STRATA.morph==='function')STRATA.morph(plate,apply);else apply();
    return N.ui.layersOpen;
  }
  function layerChip(name,el) {
    if(el&&el.getAttribute('aria-disabled')==='true'){const why=el.querySelector('small');if(why&&typeof toast==='function')toast(why.textContent);return;}
    N.setLayer(name,undefined,()=>{const again=typeof document!=='undefined'&&document.querySelector(`[data-wx-layer="${name}"]`);if(again&&again.focus)again.focus({preventScroll:true});});
  }
  /* ---- Compare periods, presentation (spec §11, §12; D110 engine; w4) ----------------------------------------
     N.ui.compare is memory only: null, or {kind, quantity}. compareView() reads the engine's windows and figures;
     the plot takes its x-window from it and the slot shows the table. No significance language anywhere. */
  const CMP_KINDS=[['previous','Previous'],['sameDays','Same days last month'],['completed','Completed'],['firstLast','First vs last 4 weeks']];
  const CMP_QTY=[['avg','Average morning'],['trendChange','Trend change'],['low','Lowest morning']];
  const RANGE_SHORT={14:'2W',30:'1M',90:'3M'};
  function cmpRange() { return N.ui.range==='cut'||!N.ui.range?'cut':N.ui.range; }
  function compareView(kind,quantity) {
    const c=N.ui.compare||{};kind=kind||c.kind||'previous';quantity=quantity||c.quantity||'avg';
    const range=cmpRange(),cw=N.compareWindows(range,kind,state.date);
    if(!cw.ok)return {ok:false,kind,quantity,range,reason:cw.reason||'Not available',cw,cp:null,win:null};
    const cp=N.comparePeriods(N.weights(),cw.before,cw.current,quantity);
    return {ok:true,kind,quantity,range,cw,cp,win:{from:cw.before.from,to:cw.current.to},reason:cp.ok?'':cp.reason};
  }
  /* The first kind that compares on this range decides whether the capsule is live; the reason comes from the
     default kind (W5 / D115: disabled with its reason, never hidden). */
  function compareAvail() {
    let why='';
    for(const [k] of CMP_KINDS){const v=compareView(k,'avg');if(v.ok&&v.cp.ok)return {ok:true,kind:k,why:''};if(!why)why=v.reason;}
    return {ok:false,kind:null,why:why||'Not enough mornings to compare'};
  }
  function compareButtonHTML() {
    const on=!!N.ui.compare;
    if(on)return '';
    const a=compareAvail();
    if(a.ok)return `<button type="button" class="wx-cmp-b" id="wx-cmp-b" aria-pressed="false" onclick="NXT.toggleCompare()"><i aria-hidden="true">⇄</i>Compare</button>`;
    return `<span class="wx-cmp-off"><button type="button" class="wx-cmp-b is-off" id="wx-cmp-b" aria-pressed="false" aria-disabled="true" aria-describedby="wx-cmp-why" onclick="NXT.layerChip('compare',this)"><i aria-hidden="true">⇄</i>Compare</button><small id="wx-cmp-why">${esc(a.why)}</small></span>`;
  }
  function cmpKindWord(kind,range) {
    const r=range==='cut'?'cut':RANGE_SHORT[range]||`${range} days`;
    if(kind==='previous')return `Previous ${range==='cut'?'span':r}`;
    if(kind==='completed')return Math.round(Number(range))<28?'Completed weeks':'Completed months';
    return CMP_KINDS.find(k=>k[0]===kind)[1];
  }
  function cmpValue(s,quantity) {
    if(!s)return '—';
    if(quantity==='low')return s.low?`${s.low.weight.toFixed(1)} kg · ${N.shortDate(s.low.date)}`:'—';
    if(quantity==='trendChange')return s.trendChange===null?'—':`${kgSigned(s.trendChange)} kg`;
    return s.avg===null||s.avg===undefined?'—':`${s.avg.toFixed(1)} kg`;
  }
  function compareHTML(model) {
    const cv=model.compare||compareView(),range=cv.range,qName=CMP_QTY.find(q=>q[0]===cv.quantity)[1];
    const kinds=CMP_KINDS.filter(([k])=>k!=='firstLast'||range==='cut').map(([k])=>{
      const v=k===cv.kind?cv:compareView(k,cv.quantity),live=v.ok&&v.cp.ok,why=live?'':(v.reason||'Not available'),rid=`wx-cmp-why-${k}`;
      return `<button type="button" class="wx-lc${live?'':' is-off'}" data-wx-cmp-kind="${k}" aria-pressed="${k===cv.kind}"${live?'':` aria-disabled="true" aria-describedby="${rid}"`} onclick="NXT.setCompare({kind:'${k}'},this)"><span>${esc(cmpKindWord(k,range))}</span>${live?'':`<small id="${rid}">${esc(why)}</small>`}</button>`;
    }).join('');
    const qtys=CMP_QTY.map(([q,name])=>`<button type="button" class="wx-lc" data-wx-cmp-q="${q}" aria-pressed="${q===cv.quantity}" onclick="NXT.setCompare({quantity:'${q}'},this)"><span>${esc(name)}</span></button>`).join('');
    const head=`<div class="wx-cmp-h"><p class="wx-sum-h"><span>${esc(rangeName())} vs ${esc(cmpKindWord(cv.kind,range).replace(/^(Previous|Completed|Same|First)/,m=>m.toLowerCase()))}</span></p><button type="button" class="wx-cmp-done" id="wx-cmp-done" onclick="NXT.setCompare(null)">Done</button></div>`;
    let table='',foot='';
    if(cv.cw&&cv.cw.before&&cv.cw.current){
      const A=cv.cp?cv.cp.a:null,B=cv.cp?cv.cp.b:null,wa=cv.cw.before,wb=cv.cw.current;
      const status=s=>s?(s.partial&&s.elapsed?`In progress · ${s.elapsed} of ${s.total} days`:s.completed?'Completed':''):'';
      const row=(name,w,s)=>`<tr><th scope="row">${esc(name)}<small>${esc(spanText(w.from,w.to>state.date?state.date:w.to))}</small>${status(s)?`<small class="wx-cmp-st">${esc(status(s))}</small>`:''}</th><td>${s?`${s.n} of ${s.days}<small> · ${Math.round(s.coverage*100)}%</small>`:'—'}</td><td class="vn-num">${esc(cmpValue(s,cv.quantity))}</td></tr>`;
      const ok=!!(cv.cp&&cv.cp.ok),diff=ok?cv.cp.diff:null;
      table=`<table class="wx-cmp-t"><caption class="st-sr">${esc(qName)} in two windows: ${esc(wa.label||spanText(wa.from,wa.to))} and ${esc(wb.label||spanText(wb.from,wb.to))}.</caption>
          <thead><tr><th scope="col">Window</th><th scope="col">Mornings</th><th scope="col">${esc(qName)}</th></tr></thead>
          <tbody>${row('Before',wa,A)}${row('This range',wb,B)}
          <tr class="is-chg"><th scope="row">Change</th><td></td><td class="vn-num"><b>${ok?esc(kgSigned(diff))+' kg':'—'}</b></td></tr></tbody></table>`;
      const base=cv.quantity==='low'?'A difference between your lowest mornings in two windows, not a test.':cv.quantity==='trendChange'?'A difference between two changes in your smoothed trend, not a test.':'A difference between two averages of your mornings, not a test.';
      foot=`<p class="wx-cmp-f">${base}</p>${ok&&cv.cp.roundingNote?'<p class="wx-cmp-f">Averages are rounded to 0.1 kg; the change uses the unrounded averages.</p>':''}${ok?'':`<p class="wx-cmp-f is-why"><i aria-hidden="true">◆</i>${esc(cv.cp?cv.cp.reason:cv.reason)}</p>`}`;
    } else foot=`<p class="wx-cmp-f is-why"><i aria-hidden="true">◆</i>${esc(cv.reason||'Not available')}</p>`;
    return `<div class="wx-cmp" id="wx-cmp" role="group" aria-label="Compare periods" onkeydown="if(event.key==='Escape'){event.preventDefault();event.stopPropagation();NXT.setCompare(null);}">
        ${head}
        <div class="wx-cmp-k wx-layers" role="group" aria-label="Comparison">${kinds}</div>
        <div class="wx-cmp-k wx-layers" role="group" aria-label="Quantity">${qtys}</div>
        ${table}${foot}
      </div>`;
  }
  /* Compare on / off and its kind / quantity: memory only; the plot's x rescale crossfades 320 ms (is-compare-change),
     instant under reduced motion. Focus returns to the control that was pressed, as a layer chip does. */
  function setCompare(patch,el) {
    if(el&&el.getAttribute&&el.getAttribute('aria-disabled')==='true'){const why=el.querySelector&&el.querySelector('small');if(why&&typeof toast==='function')toast(why.textContent);return N.ui.compare;}
    const was=N.ui.compare;
    if(patch===null)N.ui.compare=null;
    else {const a=!was?compareAvail():null;N.ui.compare={kind:patch.kind||(was&&was.kind)||(a&&a.kind)||'previous',quantity:patch.quantity||(was&&was.quantity)||'avg'};}
    if(!!was!==!!N.ui.compare){N.ui.selected=null;N.ui.chartAnim='compare';}
    const after=()=>{
      if(typeof document==='undefined')return;
      const back=N.ui.compare?(patch&&patch.kind?`[data-wx-cmp-kind="${patch.kind}"]`:patch&&patch.quantity?`[data-wx-cmp-q="${patch.quantity}"]`:'#wx-cmp-done'):'#wx-cmp-b';
      const el2=document.querySelector(back);if(el2&&el2.focus)el2.focus({preventScroll:true});
    };
    const wrap=typeof document!=='undefined'&&document.getElementById('vn-chart-wrap');
    const paint=()=>{N.repaint();after();};
    if(wrap&&typeof STRATA==='object'&&STRATA&&typeof STRATA.morph==='function')STRATA.morph(wrap,paint);else paint();
    return N.ui.compare;
  }
  function toggleCompare() { return setCompare(N.ui.compare?null:{}); }
  /* The plot's legend row under the chart, present only while an opt-in band is drawn: "Day-to-day spread" has
     its own entry whenever the band is on (CONTRACTS §5); Compare names its two windows. */
  function legendHTML(model) {
    const items=[];
    if(N.ui.showSpread&&model.bands&&model.bands.length)items.push('<span><i class="wx-key-band" aria-hidden="true"></i>Day-to-day spread</span>');
    if(model.compare&&model.compare.ok)items.push('<span><i class="wx-key-before" aria-hidden="true"></i>Before</span><span><i class="wx-key-cur" aria-hidden="true"></i>This range</span>');
    return items.length?`<p class="wx-leg" id="wx-leg" aria-label="Chart legend">${items.join('')}</p>`:'';
  }
  /* ---- Expand (spec §10; w4) ------------------------------------------------------------------------------
     A <dialog> inside #weightPage (so the plate's stylesheet applies) re-hosts the SAME nodes, never a clone: the
     readouts, range row, Layers drawer, chart wrap, legend, sr summaries and the slot move into it and one
     placeholder of their height is left behind. The plot is re-rendered with chartGeo('expand') for the dialog's
     remaining height. The restore list runs on every exit (×, Esc / cancel, swipe down on the top bar, Open day,
     a tab switch, a page re-render): nodes back before the placeholder, placeholder removed, the plot re-rendered
     for the page, scroll restored, focus on Expand, N.ui.expanded = false. No history entry. A View Transition
     when available, an instant swap under reduced motion. "Show as table" swaps the plot for a plain table. */
  const XV_MOVE=['.wx-ro','.wx-rr','#wx-layers','#vn-chart-wrap','#wx-leg','#wx-sr-sum','#wx-sel-sr','#wx-slot'];
  const XV={nodes:null,parent:null,scrollY:0,btn:null,busy:false,d:null};
  function reducedMotion() {
    try{const de=document.documentElement;if(de&&de.getAttribute('data-nxp-motion')==='reduced')return true;return !!(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(_){return false;}
  }
  function el(tag,cls,id) { const e=document.createElement(tag);if(cls)e.className=cls;if(id)e.id=id;return e; }
  function xvDialog() {
    let d=XV.d&&XV.d.isConnected!==false?XV.d:null;
    if(d)return d;
    d=el('dialog','wx-xv','wx-xv');d.setAttribute('aria-labelledby','wx-xv-h');
    const top=el('div','wx-xv-top','wx-xv-top'),x=el('button','wx-xv-x','wx-xv-x'),h=el('h2','wx-xv-h','wx-xv-h'),r=el('span','wx-xv-r','wx-xv-r'),tb=el('button','wx-xv-tb','wx-xv-tb');
    x.type='button';x.setAttribute('aria-label','Close');x.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    h.textContent='Weight';h.appendChild(r);
    tb.type='button';tb.setAttribute('aria-pressed','false');tb.textContent='Show as table';
    top.appendChild(x);top.appendChild(h);top.appendChild(tb);
    const body=el('div','wx-xv-body','wx-xv-body'),table=el('div','wx-xv-table','wx-xv-table'),foot=el('div','wx-xv-foot','wx-xv-foot');
    table.hidden=true;
    d.appendChild(top);d.appendChild(body);d.appendChild(table);d.appendChild(foot);
    XV.d=d;XV.top=top;XV.body=body;XV.foot=foot;XV.table=table;XV.x=x;XV.tb=tb;XV.r=r;
    if(d.addEventListener){
      x.addEventListener('click',()=>collapseChart());
      tb.addEventListener('click',()=>xvToggleTable());
      d.addEventListener('cancel',e=>{e.preventDefault();collapseChart();});
      /* A close the app did not run itself (e.g. the browser's close watcher). Lifting an open dialog out of the DOM
         for a re-render also queues a close event; by the time it lands the dialog is open again, so it is ignored. */
      d.addEventListener('close',()=>{if(!XV.busy&&N.ui.expanded&&!d.open)collapseChart({silent:true});});
      /* Swipe down on the top bar closes (bindSheets' rule: 120 px, or 40 px fast). */
      let y0=null,t0=0;
      top.addEventListener('pointerdown',e=>{if(e.target&&e.target.closest&&e.target.closest('button'))return;y0=e.clientY;t0=Date.now();try{top.setPointerCapture(e.pointerId);}catch(_){}});
      top.addEventListener('pointermove',e=>{if(y0===null)return;const dy=e.clientY-y0;if(dy>120||(dy>40&&dy/Math.max(1,Date.now()-t0)>.6)){y0=null;collapseChart();}});
      const end=()=>{y0=null;};top.addEventListener('pointerup',end);top.addEventListener('pointercancel',end);
    }
    const host=document.getElementById('weightPage')||document.body;
    if(host&&host.appendChild)host.appendChild(d);
    return d;
  }
  function xvRangeWords() { const m=N.ui.chart;return m&&m.start?`${rangeName()} · ${spanText(m.start,state.date)}`:rangeName(); }
  /* The plot takes the dialog's remaining height: everything else in the dialog measured, the rest to the plot. */
  function xvFit() {
    const d=XV.d,wrap=document.getElementById('vn-chart-wrap');if(!d||!wrap)return;
    const hh=e=>e&&Number(e.offsetHeight)||0;
    const dh=Number(d.clientHeight)||chartSvh()||844;
    const others=hh(XV.top)+hh(XV.foot)+[...(XV.body.children||[])].filter(c=>c!==wrap).reduce((s,c)=>s+hh(c),0);
    const avail=dh-others-24;
    N.ui.expandH=Math.max(232,Math.round(avail-(6+11+26)));
    const w=Math.round(Number(wrap.clientWidth)||0);N.ui.chartW=N.ui.chartW||{};if(w>0)N.ui.chartW.expand=w;
  }
  /* Re-render the plot in place for the current kind (page or expand), keeping the model, selection and lane. */
  function repaintPlot() {
    const wrap=typeof document!=='undefined'&&document.getElementById('vn-chart-wrap');if(!wrap)return null;
    const cv=N.ui.compare?compareView():null;
    const model=chartModel(undefined,undefined,undefined,chartGeo(),cv&&cv.ok?cv.win:null);model.compare=cv;N.ui.chart=model;
    const pts=model.points||[];if(!pts.length)return model;
    const sel=N.ui.selected?pts.findIndex(p=>p.date===N.ui.selected):-1,idx=sel>=0?sel:pts.length-1;
    wrap.innerHTML=plotHTML(model,{idx});
    wrap.setAttribute('aria-valuemax',pts.length-1);wrap.setAttribute('aria-valuenow',idx);
    if(typeof STRATA==='object'&&STRATA&&typeof STRATA.dressChart==='function')STRATA.dressChart();
    if(sel>=0)N.selectPoint(sel);
    return model;
  }
  function expandChart(opts={}) {
    if(typeof document==='undefined')return false;
    const plate=document.getElementById('vn-weight'),wrap=document.getElementById('vn-chart-wrap');
    const m=N.ui.chart;if(!plate||!wrap||!wrap.parentNode||!m||!m.points||!m.points.length)return false;
    const rehost=!!opts.rehost;
    if(N.ui.expanded&&!rehost)return true;
    const nodes=XV_MOVE.map(s=>plate.querySelector?plate.querySelector(s):null).filter(Boolean);
    if(!nodes.includes(wrap))nodes.splice(Math.min(3,nodes.length),0,wrap);
    const d=xvDialog(),old=XV.nodes||[];
    XV.nodes=nodes;XV.parent=nodes[0].parentNode;XV.btn=plate.querySelector?plate.querySelector('.wx-xbtn'):null;
    if(!rehost)XV.scrollY=typeof window!=='undefined'&&Number(window.scrollY)||0;
    const ph=el('div','wx-ph','wx-ph');ph.setAttribute('aria-hidden','true');
    const r1=nodes[0].getBoundingClientRect?nodes[0].getBoundingClientRect():null,r2=nodes.at(-1).getBoundingClientRect?nodes.at(-1).getBoundingClientRect():null;
    ph.style.height=Math.max(0,Math.round(r1&&r2?r2.bottom-r1.top:0))+'px';
    const pick=sel=>nodes.find(n=>n.id===sel.slice(1)||(n.classList&&n.classList.contains&&n.classList.contains(sel.slice(1))));
    const run=()=>{
      /* A rehost replaces what the dialog held: the previous render's nodes are dropped first. */
      if(rehost)for(const n of old)if(n&&n.parentNode&&!nodes.includes(n))n.parentNode.removeChild(n);
      XV.parent.insertBefore(ph,nodes[0]);
      for(const s of ['.wx-ro','#vn-chart-wrap','#wx-leg','#wx-sr-sum','#wx-sel-sr','#wx-slot']){const n=pick(s);if(n)XV.body.appendChild(n);}
      for(const s of ['.wx-rr','#wx-layers']){const n=pick(s);if(n)XV.foot.appendChild(n);}
      N.ui.expanded=true;N.ui.chartKind='expand';
      /* A re-render detached and re-appended the dialog (premium-ui progress()), which drops it from the top
         layer while the open attribute stays, so a rehost closes and shows it again. */
      XV.busy=true;try{if(rehost&&d.open&&typeof d.close==='function')d.close();if(!d.open&&typeof d.showModal==='function')d.showModal();}catch(_){}XV.busy=false;
      if(XV.r)XV.r.textContent=xvRangeWords();
      xvFit();repaintPlot();
      if(N.ui.xvTable)xvTableSync();
    };
    const vt=!rehost&&!reducedMotion()&&typeof document.startViewTransition==='function';
    if(vt){
      wrap.style.viewTransitionName='wx-plot';document.documentElement.setAttribute('data-st-xv','');
      const done=()=>{wrap.style.viewTransitionName='';document.documentElement.removeAttribute('data-st-xv');};
      try{const t=document.startViewTransition(run);t.finished.then(done,done);if(t.ready&&t.ready.catch)t.ready.catch(()=>{});}catch(_){done();run();}
    } else run();
    if(!rehost&&XV.x&&XV.x.focus)XV.x.focus({preventScroll:true});
    return true;
  }
  function collapseChart(opts={}) {
    if(typeof document==='undefined'||!N.ui.expanded)return false;
    const d=XV.d,ph=document.getElementById('wx-ph'),nodes=XV.nodes||[],parent=ph&&ph.parentNode?ph.parentNode:XV.parent;
    const wrap=document.getElementById('vn-chart-wrap');
    const run=()=>{
      /* 1 · the nodes back where the placeholder stands, the placeholder removed */
      if(parent&&parent.insertBefore)for(const n of nodes)if(n)parent.insertBefore(n,ph&&ph.parentNode===parent?ph:null);
      if(ph&&ph.remove)ph.remove();
      /* 5 · the flag, first, so a render in step 2 sees the page state */
      N.ui.expanded=false;N.ui.chartKind='page';
      if(N.ui.xvTable){N.ui.xvTable=false;if(wrap)wrap.hidden=false;const lg=document.getElementById('wx-leg');if(lg)lg.hidden=false;if(XV.table){XV.table.hidden=true;XV.table.innerHTML='';}if(XV.tb)XV.tb.setAttribute('aria-pressed','false');}
      XV.busy=true;try{if(d&&d.open&&typeof d.close==='function')d.close();}catch(_){}XV.busy=false;
      /* 2 · the plot for the page */
      if(opts.rerender!==false)repaintPlot();
      /* 3 · the page's scroll */
      if(opts.scroll!==false&&typeof window!=='undefined'&&window.scrollTo)window.scrollTo(0,XV.scrollY||0);
      /* 4 · focus on Expand (skipped when leaving to History) */
      if(opts.focus!==false){const b=(document.querySelector&&document.querySelector('#vn-weight .wx-xbtn'))||XV.btn;if(b&&b.focus)b.focus({preventScroll:true});}
      XV.nodes=null;N.ui.xvRestores=(N.ui.xvRestores||0)+1;
    };
    const vt=!opts.silent&&!reducedMotion()&&typeof document.startViewTransition==='function'&&wrap;
    if(vt){
      wrap.style.viewTransitionName='wx-plot';document.documentElement.setAttribute('data-st-xv','');
      const done=()=>{if(wrap)wrap.style.viewTransitionName='';document.documentElement.removeAttribute('data-st-xv');};
      try{const t=document.startViewTransition(run);t.finished.then(done,done);if(t.ready&&t.ready.catch)t.ready.catch(()=>{});}catch(_){done();run();}
    } else run();
    return true;
  }
  /* Show as table (spec §10, §17): the range's mornings as a plain table — date, morning reading, smoothed trend
     and the gap to it — with a caption and scoped headers; kg at 1 dp, U+2212. */
  function chartTableHTML(model=N.ui.chart) {
    const pts=model&&model.points?model.points:[];
    const rows=[...pts].reverse().map(p=>`<tr><th scope="row">${esc(dayDate(p.date))}</th><td>${p.weight.toFixed(1)}</td><td>${p.avg===null||p.avg===undefined?'—':p.avg.toFixed(1)}</td><td>${p.avg===null||p.avg===undefined?'—':kgSigned(p.weight-p.avg)}</td></tr>`).join('');
    return `<table class="wx-tbl"><caption>Morning readings and smoothed trend, kg · ${esc(xvRangeWords())}</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Morning</th><th scope="col">Smoothed trend</th><th scope="col">vs trend</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function xvTableSync() {
    const wrap=document.getElementById('vn-chart-wrap'),lg=document.getElementById('wx-leg'),on=!!N.ui.xvTable;
    if(XV.table){XV.table.hidden=!on;XV.table.innerHTML=on?chartTableHTML():'';}
    if(wrap)wrap.hidden=on;if(lg)lg.hidden=on;
    if(XV.tb){XV.tb.setAttribute('aria-pressed',String(on));XV.tb.textContent=on?'Show as chart':'Show as table';}
  }
  function xvToggleTable(force) { if(!N.ui.expanded)return false;N.ui.xvTable=force===undefined?!N.ui.xvTable:!!force;xvTableSync();return N.ui.xvTable; }
  /* ⌄ Details on the Cut journey (spec §13.1–13.2): opens the rest in place, memory only (N.ui.jrOpen). */
  function jrToggle(force) {
    N.ui.jrOpen=force===undefined?!N.ui.jrOpen:!!force;
    const more=typeof document!=='undefined'&&document.getElementById('st-jr-more'),b=more&&document.getElementById('st-jr-det');
    const sec=more&&more.closest?more.closest('.st-jr'):null;
    const apply=()=>{if(more)more.hidden=!N.ui.jrOpen;if(b)b.setAttribute('aria-expanded',String(N.ui.jrOpen));if(sec&&sec.classList)sec.classList.toggle('is-open',N.ui.jrOpen);};
    if(sec&&typeof STRATA==='object'&&STRATA&&typeof STRATA.morph==='function')STRATA.morph(sec,apply);else apply();
    return N.ui.jrOpen;
  }
  /* Defined after chartHTML on purpose: the release gate reads chartModel…chartHTML as the weight chart's
     model, and this separate chart has its own axes. */
  /* D96 · Rate across your cut: rateSeries() (the four-week rate read on every day of the cut) against
     review()'s own lines, the flat band and the 1% line (D37), which moves with body weight. One question:
     is the cut speeding up or slowing down? The sentence under it names the zone you are in and since when. */
  function rateTrendHTML(sgn,out,view) {
    const rows=N.weights();
    const cs=typeof settings!=='undefined'&&settings&&Number.isFinite(N.dateMs(settings.cutStart))&&settings.cutStart<=state.date?settings.cutStart:null;
    /* D104 (stage 2 open item): once the forecast is not fresh the series ends where the analysis is measured
       (forecastView().asOfDate), not on today, so the axis and the "as of" figures agree. */
    const fv=view||N.forecastView(rows),to=fv&&fv.freshness&&fv.freshness!=='fresh'&&fv.asOfDate?fv.asOfDate:state.date;
    const rs=N.rateSeries(rows,cs||null,to);
    if(rs.length<5)return '';
    const W=338,H=136,P={l:4,r:64,t:8,b:8},flat=N.flatKgWeek;
    const one=q=>-q.ref/100;
    const hiV=Math.max(.3,Math.max(...rs.map(q=>q.weeklyRate))+.12),loV=Math.min(-.3,Math.min(...rs.flatMap(q=>[q.weeklyRate,one(q)]))-.15);
    const t0=N.dateMs(rs[0].date),t1=N.dateMs(rs[rs.length-1].date),dt=Math.max(864e5,t1-t0);
    const X=d=>P.l+(N.dateMs(d)-t0)/dt*(W-P.l-P.r),Y=v=>P.t+(hiV-v)/(hiV-loV)*(H-P.t-P.b);
    const f1=n=>n.toFixed(1),xL=X(rs[0].date),xR=X(rs[rs.length-1].date),yB=H-P.b;
    const onePts=rs.map(q=>`${f1(X(q.date))},${f1(Y(one(q)))}`);
    const steady=`M${f1(xL)},${f1(Y(-flat))} L${f1(xR)},${f1(Y(-flat))} L${onePts.slice().reverse().join(' L')} Z`;
    const fast=`M${onePts.join(' L')} L${f1(xR)},${f1(yB)} L${f1(xL)},${f1(yB)} Z`;
    const line=smoothPath(rs.map(q=>({x:X(q.date),y:Y(q.weeklyRate)})));
    const zone=q=>q.weeklyRate<one(q)?'fast':q.weeklyRate< -flat?'steady':q.weeklyRate<=flat?'flat':'up';
    const last=rs[rs.length-1],z=zone(last);
    let i=rs.length-1;while(i>0&&zone(rs[i-1])===z)i--;
    const zTxt={fast:'Beyond the 1% line',steady:'In the steady zone',flat:'Inside the flat band',up:'Above zero'}[z];
    const ago=rs.find(q=>q.date===N.dateAdd(last.date,-28));
    const note=`${zTxt} ${i===0?`at every point since ${N.shortDate(rs[0].date)}`:`since ${N.shortDate(rs[i].date)}`}.${ago?` Four weeks ago it was ${sgn(ago.weeklyRate)} kg/wk.`:''}`;
    if(out)out.note=`${zTxt} ${i===0?`at every point since ${N.shortDate(rs[0].date)}`:`since ${N.shortDate(rs[i].date)}`}`;
    /* Zone names sit in the right margin as text (they keep their size at any width), each at the middle of
       its band on the latest day; one that would touch a neighbour is left out. The 1% line keeps its label. */
    const yOne=Y(one(last)),labs=[{t:'1% line',y:yOne-8,c:'is-one'}];
    const cand=[{t:'Steady',y:(Y(-flat)+yOne)/2},{t:'Fast',y:(yOne+yB)/2},{t:'Flat',y:(Y(flat)+Y(-flat))/2},{t:'Up',y:(P.t+Y(flat))/2}];
    for(const c of cand){if(c.y<P.t+6||c.y>yB-4)continue;if(labs.every(l=>Math.abs(l.y-c.y)>=19))labs.push(c);}
    const mid=rs[Math.floor(rs.length/2)];
    const data={x0:+xL.toFixed(2),x1:+xR.toFixed(2),d0:rs[0].date,d1:last.date,pts:rs.map(q=>[q.date,+Y(q.weeklyRate).toFixed(1)])};
    const label=`Four-week rate from ${N.shortDate(rs[0].date)} to ${N.shortDate(last.date)}, now ${sgn(last.weeklyRate)} kilograms a week. ${note}`;
    return `<section class="st-ev-t is-wide st-rax">
      <div class="st-rax-h"><p>Rate across your cut</p><span>4-week rate, kg/wk</span></div>
      <div class="st-rax-plot">
      <svg class="st-rax-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" data-st-rax="${esc(JSON.stringify(data))}">
        ${hiV>flat?`<rect class="z-up" x="${f1(xL)}" y="${P.t}" width="${f1(xR-xL)}" height="${f1(Math.max(0,Y(flat)-P.t))}"/>`:''}
        <rect class="z-flat" x="${f1(xL)}" y="${f1(Y(flat))}" width="${f1(xR-xL)}" height="${f1(Y(-flat)-Y(flat))}"/>
        <path class="z-steady" d="${steady}"/><path class="z-fast" d="${fast}"/>
        <polyline class="z-one" points="${onePts.join(' ')}"/>
        <line class="z-zero" x1="${f1(xL)}" x2="${f1(xR)}" y1="${f1(Y(0))}" y2="${f1(Y(0))}"/>
        <path class="st-rax-line" d="${line}" pathLength="1"/>
        <g class="st-rax-cur" visibility="hidden"><line y1="${P.t}" y2="${f1(yB)}"/><circle r="4.5"/></g>
        <circle class="st-rax-dot" cx="${f1(xR)}" cy="${f1(Y(last.weeklyRate))}" r="5"/><circle class="st-rax-halo" cx="${f1(xR)}" cy="${f1(Y(last.weeklyRate))}" r="11"/>
      </svg>
      ${labs.map(l=>`<span class="st-rax-zl ${l.c||''}" aria-hidden="true" style="top:${(l.y/H*100).toFixed(2)}%">${l.t}</span>`).join('')}
      </div>
      <div class="st-rax-xl" aria-hidden="true" style="padding:0 ${(P.r/W*100).toFixed(2)}% 0 ${(P.l/W*100).toFixed(2)}%"><span>${esc(N.shortDate(rs[0].date))}</span>${rs.length>=14?`<span>${esc(N.shortDate(mid.date))}</span>`:''}<span>${esc(N.shortDate(last.date))}</span></div>
      <span>${esc(note)}</span>
    </section>`;
  }
  function selectPoint(index, opts) {
    const m=N.ui.chart,p=m?.points?.[index];if(!p)return;
    if(opts&&opts.clear)N.ui.selected=null;
    else N.ui.selected=p.date;
    const isLatest=!N.ui.selected||N.ui.selected===m.points.at(-1).date;
    const text=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    const html=(id,v)=>{const el=document.getElementById(id);if(el)el.innerHTML=v;};
    /* The plate (D118): the label names the quantity, the date and timing sit on the line under the value. */
    text('n99-chart-date',isLatest?'Latest morning':'Morning reading');
    text('wx-date',dayDate(p.date));
    html('n99-chart-weight',p.weight.toFixed(1)+'<em>kg</em>');
    html('n99-chart-average',p.avg===null?'—<em>kg</em>':p.avg.toFixed(1)+'<em>kg</em>');
    text('n99-chart-coverage',gapLine(p));
    text('n99-chart-timing',pointTiming(p));
    const plate=document.getElementById('vn-weight');if(plate&&plate.classList){plate.classList.toggle('is-hist',!isLatest);plate.setAttribute('data-wx-timing',pointTiming(p)==='Morning'?'morning':'other');}
    const postRow=m.postByDate?m.postByDate.get(p.date):null,postBox=document.getElementById('n99-chart-post');
    if(postBox)postBox.hidden=!postRow;
    text('n99-chart-post-weight',postRow?postRow.weight.toFixed(1)+' kg':'');
    text('n99-chart-post-delta',postDelta(p,postRow));
    const line=document.getElementById('n99-chart-cursor'),dot=document.getElementById('n99-chart-active'),slider=document.getElementById('n99-chart-slider');
    line?.setAttribute('x1',p.x);line?.setAttribute('x2',p.x);dot?.setAttribute('cx',p.x);dot?.setAttribute('cy',p.y);
    const halo=document.getElementById('st-chart-halo');halo?.setAttribute('cx',p.x);halo?.setAttribute('cy',p.y);
    if(slider){slider.value=index;slider.setAttribute('aria-valuetext',N.shortDate(p.date)+', '+p.weight+' kilograms');}
    /* Instrument plumbing (D111): the vs-trend cell, the label switch, the transport's state, the plate slot and
       the slider's value text. Each writes only where its element exists; the plate markup lands in a later commit,
       so today's chart is unchanged. opts.announce (pointer selections, once on pointerup) speaks the same words
       through the polite region; keyboard steps rely on aria-valuetext instead. */
    text('wx-gap',p.avg===null||p.avg===undefined||!Number.isFinite(p.weight)?'—':N.signedFixed(p.weight-p.avg,1,'−')+' kg');
    text('wx-lab-a',isLatest?'Latest morning':'Morning reading');
    /* The trend cell keeps its name; on a historical day its sub line names the day ("on 28 Sept") in place of the
       freshness word, since the full label does not fit beside the vs cell on a phone (D118 amends D111 here). */
    text('wx-lab-c','Smoothed trend');
    const on=document.getElementById('wx-on');if(on){on.textContent='on '+N.shortDate(p.date);on.hidden=isLatest;}
    const transport=document.getElementById('nxp-progress-latest');
    if(transport&&transport.getAttribute('data-wx-state')!=='playing')transport.setAttribute('data-wx-state',isLatest?'idle':'historical');
    const slot=document.getElementById('wx-slot');
    if(slot)slot.setAttribute('data-wx-slot',N.ui.selected?'select':'summary');
    const words=pointWords(p),wrap=document.getElementById('vn-chart-wrap');
    if(wrap&&wrap.getAttribute('role')==='slider'){wrap.setAttribute('aria-valuenow',index);wrap.setAttribute('aria-valuetext',words);}
    if(opts&&opts.announce)text('wx-sel-sr',words);
    /* The inspector (spec §8.4): the selection bar on a phone or the strip on a wide layout, whichever is in the DOM. */
    if(document.getElementById('wx-sel')){
      const ctx=dayContext(p.date),cb=document.getElementById('wx-sel-ctx');
      text('wx-sel-d',dayDate(p.date));
      const lat=document.getElementById('wx-sel-l');if(lat)lat.hidden=!isLatest;
      if(cb){cb.dataset.date=p.date;cb.classList.toggle('is-quiet',!!ctx.quiet);cb.setAttribute('aria-label',(cb.querySelector('.wx-sel-k')?'That day: ':'')+ctx.text+'. Open in History');}
      text('wx-sel-ctxt',ctx.text);
      html('wx-sel-note-h',noteChipHTML(p.date,'wx-sel-note'));
      const ob=document.getElementById('wx-sel-open');if(ob)ob.dataset.date=p.date;
      const xb=document.getElementById('wx-sel-x');if(xb&&xb.querySelector('span'))xb.hidden=isLatest;
    }
  }
  /* "Monday 28 September: morning 83.1 kilograms, smoothed trend 83.7, 0.6 below trend." The screen-reader form of
     the readouts; every figure is the point's own (1 dp, D107). */
  const WEEKDAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  function longDate(d) { const t=new Date(N.dateMs(d));return `${WEEKDAYS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`; }
  /* "Mon 19 Oct": the readouts' date line (spec §6.2). */
  function dayDate(d) { const t=new Date(N.dateMs(d));return `${WEEKDAYS[t.getUTCDay()].slice(0,3)} ${N.shortDate(d)}`; }
  function pointWords(p) {
    if(!p)return '';
    const morning=/^morning$/i.test(String(p.timeOfDay||'')),head=`${longDate(p.date)}: ${morning?'morning':'reading'} ${p.weight.toFixed(1)} kilograms`;
    if(p.avg===null||p.avg===undefined)return head+', smoothed trend not ready yet.';
    const d=Number((p.weight-p.avg).toFixed(1));
    return `${head}, smoothed trend ${p.avg.toFixed(1)}, ${d===0?'on trend':Math.abs(d).toFixed(1)+' '+(d<0?'below':'above')+' trend'}.`;
  }
  /* Scrub intent (spec §8.1). A touch pointerdown only records where it started, so a vertical swipe that begins on
     the plot scrolls the page (the wrap is touch-action: pan-y) and never selects a day. A horizontal move of at least
     8 px that is more than 1.2 × the vertical one locks the gesture to the chart: the pointer is captured and every
     move selects the nearest real reading (never an interpolated one). A short tap (< 8 px, < 350 ms) selects on
     pointerup. A mouse (or a synthetic event with no pointer type) selects on pointerdown and drags to scrub. */
  const SCRUB_LOCK_PX=8,SCRUB_LOCK_RATIO=1.2,SCRUB_TAP_MS=350;
  let gesture=null;
  const scrubNow=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
  function scrubIndex(event) {
    const m=N.ui.chart,svg=document.getElementById('n99-chart-svg');
    if(!m?.points?.length||!svg)return -1;
    const bounds=svg.getBoundingClientRect();if(!(bounds.width>0))return -1;
    const x=(event.clientX-bounds.left)/bounds.width*m.W;
    return m.points.reduce((best,p,i)=>Math.abs(p.x-x)<Math.abs(m.points[best].x-x)?i:best,0);
  }
  function scrubPick(event,opts) { const i=scrubIndex(event);if(i>=0){N.selectPoint(i,opts);gesture&&(gesture.index=i);}return i; }
  function scrubCapture(event) {
    const wrap=document.getElementById('vn-chart-wrap');
    if(wrap?.setPointerCapture){try{wrap.setPointerCapture(event.pointerId);}catch(_){}}
  }
  function scrub(event) {
    const m=N.ui.chart,svg=document.getElementById('n99-chart-svg');
    if(!m?.points?.length||!svg)return;
    const touch=event.pointerType==='touch'||event.pointerType==='pen';
    if(event.type==='pointerdown'){
      if(!touch&&event.button>0)return;
      gesture={id:event.pointerId,x0:event.clientX,y0:event.clientY,t0:scrubNow(),mode:touch?'pending':'drag',index:-1};
      if(!touch){scrubCapture(event);scrubPick(event);}
      return;
    }
    /* pointermove: only inside a gesture this chart started (hover does nothing yet). */
    if(!gesture||gesture.id!==event.pointerId)return;
    if(gesture.mode==='pending'){
      const dx=event.clientX-gesture.x0,dy=event.clientY-gesture.y0;
      if(Math.abs(dx)>=SCRUB_LOCK_PX&&Math.abs(dx)>SCRUB_LOCK_RATIO*Math.abs(dy)){gesture.mode='h';scrubCapture(event);}
      else if(Math.abs(dx)>=SCRUB_LOCK_PX||Math.abs(dy)>=SCRUB_LOCK_PX){gesture.mode='v';return;}
      else return;
    }
    if(gesture.mode==='v')return;
    if(gesture.mode==='drag'&&event.buttons===0)return;
    const i=scrubIndex(event);
    if(i>=0&&i!==gesture.index){gesture.index=i;N.selectPoint(i);}
  }
  function scrubUp(event) {
    const g=gesture;
    if(!g||g.id!==event.pointerId)return;
    gesture=null;
    const wrap=document.getElementById('vn-chart-wrap');
    if(wrap?.releasePointerCapture){try{wrap.releasePointerCapture(event.pointerId);}catch(_){}}
    if(g.mode==='pending'){
      const moved=Math.hypot(event.clientX-g.x0,event.clientY-g.y0);
      if(moved<SCRUB_LOCK_PX&&scrubNow()-g.t0<SCRUB_TAP_MS){const i=scrubIndex(event);if(i>=0)N.selectPoint(i,{announce:true});}
      return;
    }
    /* One polite announcement for the reading a drag ended on. */
    if((g.mode==='h'||g.mode==='drag')&&g.index>=0)N.selectPoint(g.index,{announce:true});
  }
  /* pointercancel: the browser took the gesture (a vertical scroll). Nothing is selected. */
  function scrubCancel(event) { if(gesture&&(!event||gesture.id===event.pointerId))gesture=null; }
  /* The reading nearest to `days` from point idx, strictly in that direction (PageUp / PageDown). */
  function stepDays(points,idx,days) {
    const target=N.dateMs(points[idx].date)+days*86400000;let best=idx;
    for(let i=0;i<points.length;i++){
      if(days<0?i>=idx:i<=idx)continue;
      if(best===idx||Math.abs(N.dateMs(points[i].date)-target)<Math.abs(N.dateMs(points[best].date)-target))best=i;
    }
    return best;
  }
  /* Keyboard (spec §8.5): ← / → step between readings, Home / End go to the first / latest (End and Escape return to
     latest), PageUp / PageDown move about a week, Enter opens the day in History, F opens Expand once it exists. */
  function chartKey(event) {
    const m=N.ui.chart;if(!m?.points?.length)return;
    const n=m.points.length,key=event.key;
    let idx=N.ui.selected?m.points.findIndex(p=>p.date===N.ui.selected):-1;
    if(idx<0)idx=n-1;
    const go=(i,o)=>{N.selectPoint(i,o);event.preventDefault();};
    if(key==='ArrowRight')go(Math.min(n-1,idx+1));
    else if(key==='ArrowLeft')go(Math.max(0,idx-1));
    else if(key==='Home')go(0);
    else if(key==='End')go(n-1,{clear:true,glide:true});
    /* Escape clears a selection; with nothing selected it is left to the host (inside Expand the dialog closes). */
    else if(key==='Escape'){if(N.ui.selected)go(n-1,{clear:true,glide:true});}
    else if(key==='PageUp')go(stepDays(m.points,idx,-7));
    else if(key==='PageDown')go(stepDays(m.points,idx,7));
    else if(key==='Enter'){event.preventDefault();openChartDay(m.points[idx].date);}
    else if((key==='f'||key==='F')&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&typeof N.expandChart==='function'){event.preventDefault();N.expandChart();}
  }
  /* Open day (spec §8.6): remember where Weight was (memory only), then show that day in History. */
  function openChartDay(date) {
    if(!Number.isFinite(N.dateMs(date)))return;
    /* Leaving to History runs the Expand restore list first (focus is not returned, spec §10). */
    if(N.ui.expanded)collapseChart({focus:false,rerender:false,scroll:false});
    N.ui.returnTo={view:'overview',range:N.ui.range,selected:N.ui.selected,
      layers:{showWeekly:N.ui.showWeekly,showSpread:N.ui.showSpread,showNotes:N.ui.showNotes,showPost:N.ui.showPost,showForecast:N.ui.showForecast},
      compare:N.ui.compare,expanded:false,scrollY:typeof window!=='undefined'&&Number(window.scrollY)||0};
    const nxp=typeof NXP==='object'&&NXP?NXP:null;
    if(typeof switchTab==='function')switchTab('history');
    if(nxp&&typeof nxp.historySelect==='function')setTimeout(()=>nxp.historySelect(date),80);
  }
  /* A repaint happens for many reasons — logging a set, saving a weigh-in,
     switching tabs. Only a deliberate range change should animate, so it is
     flagged here and consumed once by chartHTML(). Without this the chart would
     replay its reveal every time anything on the app changed. */
  function setRange(range) {N.ui.range=range;N.ui.selected=null;N.ui.chartAnim='range';N.repaint();}
  function setGoalVisible(on) {N.ui.showGoal=!!on;N.repaint();}
  /* Chart layers (spec §9; D111): one memory-only flag each, no storage key. setPostVisible and setForecastVisible
     stay as the wrappers they were. */
  const LAYERS={weekly:'showWeekly',spread:'showSpread',notes:'showNotes',post:'showPost',forecast:'showForecast'};
  function setLayer(name,on,after) {
    const key=LAYERS[name];if(!key)return false;
    const next=on===undefined?!N.ui[key]:!!on;
    if(N.ui[key]===next)return next;
    N.ui[key]=next;N.ui.chartAnim='layer';
    /* The plot updates in place: the repaint runs inside STRATA.morph where it exists (instant under reduced
       motion); the layer's own marks fade in through the is-layer-change class. */
    const wrap=typeof document!=='undefined'&&document.getElementById('vn-chart-wrap');
    const paint=()=>{N.repaint();if(typeof after==='function')after();};
    if(wrap&&typeof STRATA==='object'&&STRATA&&typeof STRATA.morph==='function')STRATA.morph(wrap,paint);else paint();
    return next;
  }
  function setPostVisible(on) {setLayer('post',!!on);}
  function setForecastVisible(on) {setLayer('forecast',!!on);}
  function setView(view) {N.ui.view=view;N.repaint();}
  function strengthHTML() {
    const items=N.strengthItems();
    return N.card('Keep your performance',`<p>Compare the same exercise, at the same gym. Four recent sessions establish a repeatable comparison; warm-ups and sets over 15 reps are excluded from the estimate.</p><div class="n99-stats">${N.metric('Holding / improving',items.filter(x=>x.tone==='good').length)}${N.metric('Worth reviewing',items.filter(x=>x.status==='Review').length)}</div>`)+N.card('Exercise trends',items.length?items.map(item=>{
      const values=item.history.slice(-8).map(x=>x.value),min=Math.min(...values)-1,max=Math.max(...values)+1;
      const points=values.map((v,i)=>({x:4+i/Math.max(1,values.length-1)*102,y:35-(v-min)/(max-min)*28}));
      return `<div class="n99-strength-row"><div><h3>${esc(item.name)}</h3><p>${esc(item.gym)} · ${item.sessions} ${N.plural(item.sessions,"session")}</p><span class="n99-status ${item.tone}">${item.status}${item.delta===null?'':' · '+signed(item.delta,1)+'%'}</span></div><svg viewBox="0 0 110 40" class="n99-spark" role="img" aria-label="Estimated strength across ${item.history.length} ${N.plural(item.history.length,"session")}"><path d="${smoothPath(points)}" fill="none" stroke="${item.tone==='watch'?'#e8b271':CHART.ink}" stroke-width="2"/><circle cx="${points.at(-1)?.x||4}" cy="${points.at(-1)?.y||20}" r="3" fill="${CHART.ink}"/></svg></div>`;
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
  /* D100 · The chart header's note chip for the shown day, and a faint flag on the plot for each note in range
     (one colour for every kind: the kind is a word in the chip and the tooltip, never a colour, I6). */
  function noteChipHTML(date,id='st-note-chip') {
    const n=N.chartNotes()[date];
    const label=n?`Note on ${N.shortDate(date)}: ${N.noteLabel(n.kind)}${n.text?', '+n.text:''}. Edit`:`Add a note for ${N.shortDate(date)}`;
    return `<button type="button" class="st-note-chip${n?' has-note':''}" id="${id}" data-date="${date}" onclick="NXT.openNote(this.dataset.date)" aria-label="${esc(label)}">${n?`<i aria-hidden="true"></i><span>${esc(N.noteLabel(n.kind))}${n.text?' · '+esc(n.text):''}</span>`:'<span>+ Note</span>'}</button>`;
  }
  function noteFlags(points,top,baseline) {
    if(!points||points.length<2)return '';
    const notes=N.chartNotes(),a=points[0],b=points[points.length-1],t0=N.dateMs(a.date),t1=N.dateMs(b.date);
    return Object.keys(notes).filter(d=>d>=a.date&&d<=b.date).sort().map(d=>{
      const x=(a.x+(N.dateMs(d)-t0)/Math.max(1,t1-t0)*(b.x-a.x)).toFixed(1);
      return `<g class="st-nflag"><line x1="${x}" x2="${x}" y1="${top+12}" y2="${baseline}"/><path d="M${x} ${top+1} l5 5 -5 5 -5 -5z"/></g>`;
    }).join('');
  }
  /* D100 · Notes on the chart: one sheet to add, change or remove a day's note. */
  function openNote(date) {
    if(!Number.isFinite(N.dateMs(date))||date>state.date)date=state.date;
    const n=N.chartNotes()[date],kind=n?n.kind:'holiday';
    const kinds=N.noteKinds.map(k=>`<label class="st-note-k"><input type="radio" name="st-note-kind" value="${k}"${k===kind?' checked':''}><span>${N.noteLabel(k)==='Note'?'Other':N.noteLabel(k)}</span></label>`).join('');
    N.modal(n?'Edit note':'Add a note',`<form class="st-note-f" onsubmit="event.preventDefault();NXT.saveNote('${date}')"><p class="n99-small">${esc(N.shortDate(date))}. Shown on the weight chart as context; nothing is calculated from it.</p><fieldset class="st-note-ks"><legend class="st-sr">What kind of day</legend>${kinds}</fieldset><label>Note <span class="n99-small">optional</span><input id="st-note-text" type="text" maxlength="80" autocomplete="off" enterkeyhint="done" value="${esc(n?n.text:'')}" placeholder="For example, trip to KL"></label><button class="n99-button" type="submit">Save note</button>${n?N.button('Remove note',`NXT.removeNote('${date}')`,true):''}</form>`);
  }
  function saveNote(date) {
    if(!Number.isFinite(N.dateMs(date))||date>state.date)return toast('Notes are for days up to today.');
    const pick=document.querySelector('input[name="st-note-kind"]:checked'),kind=pick&&N.noteKinds.includes(pick.value)?pick.value:'other';
    const text=String(val('st-note-text')||'').replace(/\s+/g,' ').trim().slice(0,80);
    const c=N.cfg();
    if(!c.chartNotes||typeof c.chartNotes!=='object'||Array.isArray(c.chartNotes))c.chartNotes={};
    c.chartNotes[date]={kind,text,ts:Date.now()};
    N.commit('Note saved');
  }
  async function removeNote(date) {
    const ok=typeof NXP==='object'&&NXP.ask?await NXP.ask({title:'Remove this note?',body:`${N.shortDate(date)}. Your weigh-ins are not affected.`,ok:'Remove',danger:true}):confirm('Remove this note?');
    if(!ok)return;
    const c=N.cfg();
    if(c.chartNotes&&c.chartNotes[date]){delete c.chartNotes[date];N.commit('Note removed');}
    else if(typeof closeModal==='function')closeModal();
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
    const rows=N.weights().slice().reverse(),all=(state.bws||[]).length;N.modal('Weigh-in history',(all?`<button type="button" class="n99-button secondary st-copy-wi" onclick="NXT.copyWeighIns()">${all===1?"Copy 1 weigh-in":`Copy all ${all} weigh-ins`}</button><p class="n99-small">Copies date, weight and timing as a table you can paste into Notes, Sheets or a chat.</p>`:'')+(rows.length?rows.map((r,i)=>`<button class="n99-list-row" onclick="NXT.editWeight('${r.date}')"><span>${N.shortDate(r.date)}</span><b>${r.weight.toFixed(1)} kg</b><span>Edit ›</span></button>`).join(''):'<p>No weights recorded yet.</p>'));
  }
  /* Every stored weigh-in (all timings), oldest first, tab-separated so it pastes as a table. Read-only. */
  function copyWeighIns() {
    const rows=(state.bws||[]).filter(r=>r&&r.date&&Number.isFinite(Number(r.weight))).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.ts||0)-Number(b.ts||0));
    const text=['Date\tWeight (kg)\tTiming'].concat(rows.map(r=>`${r.date}\t${Number(r.weight).toFixed(1)}\t${r.timeOfDay||'Not recorded'}`)).join('\n');
    const done=()=>toast(`Copied ${rows.length} ${N.plural(rows.length,"weigh-in")}`);
    const fallback=()=>{const t=document.createElement('textarea');t.value=text;t.setAttribute('readonly','');t.style.cssText='position:fixed;opacity:0;top:0';document.body.appendChild(t);t.select();t.setSelectionRange(0,text.length);let ok=false;try{ok=document.execCommand('copy');}catch(e){}t.remove();ok?done():toast('Copy was blocked. Try again.');};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done,fallback);else fallback();
  }
  /* D46 · Import Evo scans exported from Strata (CSV from Strata's Export, or its JSON).
     Each new scan is saved exactly as the scan form saves one — same record shape, plus the
     same contextual "Evo Scan" weigh-in, which never enters the morning trend (D14/D15).
     Scans already in NXTFRM (same date and weight) are skipped. Nothing existing is changed. */
  function parseStrataScans(text) {
    const t=String(text||'').trim();if(!t)return [];
    const num=v=>{const n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)&&String(v).trim()!==''?n:null;};
    const pick=o=>({date:String(o.timestamp||o.date||'').slice(0,10),time:String(o.timestamp||'').slice(11,16),weight:num(o.weightKg),bodyFat:num(o.bodyFatPct),muscleMass:num(o.skeletalMuscleMassKg),fatMass:num(o.bodyFatMassKg),bmr:num(o.bmrKcal),tdee:num(o.teeKcal)});
    if(/^[\[{]/.test(t)){
      try{const j=JSON.parse(t),arr=Array.isArray(j)?j:(j.scans||[]);
        return arr.map(x=>{const d=x.data||x,c=d.composition||{},f=d.fat||{},m=d.metabolism||{};return pick({timestamp:d.timestamp,weightKg:c.weightKg,bodyFatPct:f.bodyFatPct,skeletalMuscleMassKg:c.skeletalMuscleMassKg,bodyFatMassKg:f.bodyFatMassKg,bmrKcal:m.bmrKcal,teeKcal:m.teeKcal});}).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date));
      }catch(e){return [];}
    }
    const lines=t.split(/\r?\n/).filter(l=>l.trim());if(lines.length<2)return [];
    const split=l=>{const out=[];let cur='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(q){if(ch==='"'&&l[i+1]==='"'){cur+='"';i++;}else if(ch==='"')q=false;else cur+=ch;}else if(ch==='"')q=true;else if(ch===','){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;};
    const head=split(lines[0]).map(h=>h.trim());
    return lines.slice(1).map(l=>{const v=split(l),o={};head.forEach((h,i)=>o[h]=v[i]);return pick(o);}).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.date<=state.date);
  }
  function scanPlan(rows) {
    const have=(state.scans||[]).map(x=>x.date+'|'+(Number.isFinite(Number(x.weight))?Number(x.weight).toFixed(1):''));
    const seen=new Set(have);
    return rows.map(r=>{const k=r.date+'|'+(r.weight!==null?r.weight.toFixed(1):'');const dup=seen.has(k);seen.add(k);return {...r,dup};});
  }
  function importScans() {
    N.ui.scanImport=null;
    N.modal('Import from Strata',`<p class="n99-small">In Strata, use Export → CSV, then paste it here or choose the file. New scans are saved like ones you enter yourself; scans already here are skipped.</p>
      <label>Strata export<textarea id="n99-scan-import" rows="6" placeholder="id,timestamp,heightCm,…" oninput="NXT.previewScanImport()"></textarea></label>
      <label class="n99-file">Or choose a file<input type="file" accept=".csv,.json,text/csv,application/json" onchange="NXT.readScanFile(this)"></label>
      <div id="n99-scan-preview" class="n99-small" aria-live="polite"></div>
      <button type="button" class="n99-button" id="n99-scan-go" disabled onclick="NXT.commitScanImport()">Import scans</button>`);
  }
  function readScanFile(input) {const f=input.files&&input.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const ta=document.getElementById('n99-scan-import');if(ta){ta.value=String(r.result||'');previewScanImport();}};r.readAsText(f);}
  function previewScanImport() {
    const ta=document.getElementById('n99-scan-import'),box=document.getElementById('n99-scan-preview'),go=document.getElementById('n99-scan-go');if(!ta||!box)return;
    const plan=scanPlan(parseStrataScans(ta.value)),fresh=plan.filter(r=>!r.dup);N.ui.scanImport=fresh;
    if(!ta.value.trim()){box.innerHTML='';if(go)go.disabled=true;return;}
    if(!plan.length){box.textContent='No scans found in that text. Paste the CSV exactly as Strata exports it.';if(go)go.disabled=true;return;}
    box.innerHTML=`<b>${plan.length} ${plan.length===1?'scan':'scans'} found · ${fresh.length} new</b>`+plan.map(r=>`<div class="n99-list-row"><span>${esc(N.shortDate(r.date))}${r.time?' · '+esc(r.time):''}</span><b>${r.weight!==null?r.weight.toFixed(1)+' kg':'—'}</b><span>${r.dup?'Already here':(r.bodyFat!==null?r.bodyFat.toFixed(1)+'% fat':'New')}</span></div>`).join('');
    if(go){go.disabled=!fresh.length;go.textContent=fresh.length?`Import ${fresh.length} ${fresh.length===1?'scan':'scans'}`:'Nothing new to import';}
  }
  function commitScanImport() {
    const rows=N.ui.scanImport||[];if(!rows.length)return;
    state.scans=state.scans||[];state.bws=state.bws||[];
    const keys=['weight','bodyFat','muscleMass','fatMass','tdee','bmr'];
    rows.forEach(r=>{
      const provenance={};keys.forEach(k=>provenance[k]={source:'MANUAL_ENTRY',ocr:'',raw:''});
      const scan={id:uid(),date:r.date,image:'',weight:r.weight??'',bodyFat:r.bodyFat??'',muscleMass:r.muscleMass??'',fatMass:r.fatMass??'',tdee:r.tdee??'',bmr:r.bmr??'',notes:'Imported from Strata'+(r.time?' · scanned '+r.time:''),context:'EVOSCAN',provenance};
      if(r.weight!==null&&r.weight>0){const wid=uid();scan.weighInId=wid;state.bws.push({id:wid,date:r.date,weight:r.weight,timeOfDay:'Evo Scan'});}
      state.scans.push(scan);
    });
    N.ui.scanImport=null;N.commit(`Imported ${rows.length} ${rows.length===1?'scan':'scans'} from Strata`);
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
  async function deleteWeight() {
    const r=findEditWeight();if(!r)return;
    const ask=typeof NXP==='object'&&NXP&&typeof NXP.ask==='function'
      ?NXP.ask({title:'Delete this weigh-in?',body:`${Number(r.weight).toFixed(1)} kg · ${N.shortDate(r.date)}. This cannot be undone.`,ok:'Delete',danger:true})
      :Promise.resolve(confirm('Delete this weigh-in?'));
    if(!(await ask))return;
    state.bws=state.bws.filter(x=>x!==r);N.commit('Weigh-in deleted');
  }
  return {signed,smoothPath,chartGeo,chartGeoChanged,chartModel,chartHTML,plotHTML,weeklySteps,layerState,lanePlace,weekBand,dayContext,backToLatest,returnToWeight,journeyHTML,wxRow,toggleLayers,layerChip,compareView,compareAvail,compareHTML,setCompare,toggleCompare,legendHTML,expandChart,collapseChart,repaintPlot,chartTableHTML,xvToggleTable,jrToggle,selectPoint,pointWords,scrub,scrubUp,scrubCancel,chartKey,openChartDay,setLayer,openNote,saveNote,removeNote,copyWeighIns,importScans,readScanFile,previewScanImport,commitScanImport,parseStrataScans,setRange,setGoalVisible,setPostVisible,setForecastVisible,setView,strengthHTML,bodyHTML,progress,openWaist,saveWaist,deleteWaist,openWeightHistory,editWeight,saveWeightEdit,deleteWeight};
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
      <section class="n99-card"><div class="n99-row"><h2>Workout queue</h2><button class="n99-text" onclick="apx96OpenQueueManager()">Manage ›</button></div>${list.map((e,i)=>`<button class="n99-list-row ${e.name===ex?'selected':''}" onclick="NXT.selectExercise(${i})"><span class="n99-order">${N.done(e.name)>=e.sets?'✓':i+1}</span><span><b>${esc(e.name)}</b><small>${e.sets} ${N.plural(e.sets,"set")} · ${e.reps[0]}–${e.reps[1]} reps</small></span><span>${N.done(e.name)}/${e.sets}</span></button>`).join('')}</section>
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
  async function finish() {
    const logs=sessionLogs();if(!logs.length)return toast('Log at least one set before finishing.');
    const ask=typeof NXP==='object'&&NXP&&typeof NXP.ask==='function'
      ?NXP.ask({title:'Finish workout?',body:'All logged sets stay saved, including a shorter workout.',ok:'Finish workout'})
      :Promise.resolve(confirm('Finish this session? All logged sets stay saved, including a shorter workout.'));
    if(!(await ask))return;
    N.cfg().sessions[sessionKey()]={date:state.date,gym:state.gym,type:state.dayType,finished:true,finishedAt:Date.now(),sets:logs.filter(x=>x.setType!=='warmup').length};
    apx96SkipRest();N.commit('Workout saved');N.openFinishSummary();
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
  async function undo() {
    const last=sessionLogs().slice().reverse().sort((a,b)=>Number(b.ts||0)-Number(a.ts||0))[0];if(!last)return toast('No set in this session to undo.');
    const ask=typeof NXP==='object'&&NXP&&typeof NXP.ask==='function'
      ?NXP.ask({title:'Undo last set?',body:`${last.exercise} · ${last.weight} kg × ${last.reps}`,ok:'Undo set',danger:true})
      :Promise.resolve(confirm(`Undo ${last.exercise} · ${last.weight} kg × ${last.reps}?`));
    if(!(await ask))return;
    state.logs=state.logs.filter(x=>x!==last);delete N.cfg().sessions[sessionKey()];state.exercise=last.exercise;N.commit('Last set undone');
  }
  function sessionPicker() {N.modal('Choose today’s session',`<p>Your existing records and saved workout queues stay intact.</p><div class="n99-picker">${N.pickTypes(state.dayType).map(t=>N.button(N.label(t),`NXT.chooseSession('${t}')`,state.dayType!==t)).join('')}</div>`);}
  function chooseSession(type) {
    if(!N.typeNames().includes(type))return;
    // Same rule as the day sheet (D35): a day with logged sets keeps its type.
    if((state.logs||[]).some(r=>r.date===state.date))return toast('This day already has logged sets.');
    settings.dayOverrides=settings.dayOverrides||{};settings.dayOverrides[state.date]=type;state.dayType=type;state.exercise=N.templateFor(type)[0]?.name||'';state.setNum=1;N.commit('Today’s session updated');
  }
  /* D102 · Cardio could be logged but never corrected. With an id the same sheet opens filled in, saves
     over that record (same id, same fields) and offers Delete; without one it logs a new session. */
  function cardioModal(date,id) {
    const rec=id?(state.cardio||[]).find(r=>r&&r.id===id):null;
    const d=rec?rec.date:typeof date==='string'&&date<=state.date?date:state.date;
    N.modal(rec?'Edit cardio':'Log cardio',`<form onsubmit="event.preventDefault();NXT.saveCardio(${rec?`'${esc(rec.id)}'`:''})"><label>Date<input id="n99-card-date" type="date" max="${state.date}" required value="${d}"></label><label>Activity<select id="n99-card-type">${(rec&&rec.type&&!CARDIO_TYPES.includes(rec.type)?[rec.type,...CARDIO_TYPES]:CARDIO_TYPES).map(t=>`<option${rec&&rec.type===t?' selected':''}>${esc(t)}</option>`).join('')}</select></label><div class="n99-form-grid"><label>Duration · minutes<input id="n99-card-min" type="number" min="1" max="600" step="1" inputmode="numeric" required${rec&&rec.duration!==''&&rec.duration!=null?` value="${esc(rec.duration)}"`:''}></label><label>Effort · 1–10<input id="n99-card-effort" type="number" min="1" max="10" step="1" inputmode="numeric" placeholder="Optional"${rec&&rec.intensity!==''&&rec.intensity!=null?` value="${esc(rec.intensity)}"`:''}></label></div><div class="n99-form-grid"><label>Speed · km/h<input id="n99-card-speed" type="number" min="0" max="80" step="0.1" inputmode="decimal" placeholder="Optional"${rec&&rec.speed!==''&&rec.speed!=null?` value="${esc(rec.speed)}"`:''}></label><label>Incline · %<input id="n99-card-incline" type="number" min="0" max="40" step="0.5" inputmode="decimal" placeholder="Optional"${rec&&rec.incline!==''&&rec.incline!=null?` value="${esc(rec.incline)}"`:''}></label></div><label>Average heart rate · optional<input id="n99-card-hr" type="number" min="30" max="240" inputmode="numeric"${rec&&rec.hr!==''&&rec.hr!=null?` value="${esc(rec.hr)}"`:''}></label><p class="n99-small">For easy cardio, use a pace where conversation feels comfortable. Speed or incline alone cannot establish your physiological Zone 2.</p><button class="n99-button" type="submit">${rec?'Save changes':'Save cardio'}</button>${rec?N.button('Delete this session',`NXT.deleteCardio('${esc(rec.id)}')`,true):''}</form>`);
  }
  function saveCardio(id) {
    const duration=N.finite(val('n99-card-min')),intensity=N.finite(val('n99-card-effort')),speed=N.finite(val('n99-card-speed')),incline=N.finite(val('n99-card-incline')),hr=N.finite(val('n99-card-hr'));
    if(duration===null||duration<1||duration>600||intensity!==null&&(intensity<1||intensity>10)||speed!==null&&(speed<0||speed>80)||incline!==null&&(incline<0||incline>40)||hr!==null&&(hr<30||hr>240))return toast('Check your cardio values.');
    const cd=val('n99-card-date')||state.date;if(!Number.isFinite(N.dateMs(cd))||cd>state.date)return toast('Pick today or an earlier date.');
    const fields={date:cd,type:val('n99-card-type'),duration,intensity:intensity??'',speed:speed??'',incline:incline??'',hr:hr??''};
    const at=id?(state.cardio||[]).findIndex(r=>r&&r.id===id):-1;
    if(id&&at<0)return toast('That session is no longer here. Nothing was changed.');
    if(at>=0){Object.assign(state.cardio[at],fields);N.commit('Cardio updated');return;}
    state.cardio.push({id:uid(),gym:state.gym,...fields,ts:Date.now()});N.commit(cd===state.date?'Cardio saved':'Cardio saved for '+N.shortDate(cd));
  }
  async function deleteCardio(id) {
    const r=(state.cardio||[]).find(x=>x&&x.id===id);if(!r)return;
    const what=`${r.type||'Cardio'}${N.finite(r.duration)?' · '+N.finite(r.duration)+' min':''} · ${N.shortDate(r.date)}`;
    const ok=typeof NXP==='object'&&NXP.ask?await NXP.ask({title:'Delete this cardio session?',body:`${what}. This cannot be undone.`,ok:'Delete',danger:true}):confirm('Delete this cardio session?');
    if(!ok)return;
    state.cardio=state.cardio.filter(x=>x!==r);N.commit('Cardio deleted');
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
    /* Ascension — "Didn't happen?" (coach.js). A past planned day the coach reads as missed or
       partial can be excused; an excused day shows its reason and can be restored; a moved day
       says where it went. The picker below and its rules are exactly as they were. */
    let didnt='';
    try{
      const cx=N.coach&&typeof N.coach.dayContext==='function'?N.coach.dayContext(date):null;
      if(cx&&cx.status==='excused')didnt=`<section class="co-dh"><h3 class="co-dh-t">Excused${cx.reason&&cx.reason!=='other'?' · '+esc(cx.reason):''}</h3><p class="n99-small">It does not count as missed. Your plan and your logged records do not change.</p>${N.button('Remove excuse',`NXT.coach.unexcuse('${date}')`,true)}</section>`;
      else if(cx&&date<state.date&&!logged&&(cx.status==='missed'||cx.status==='partial'))didnt=`<section class="co-dh"><h3 class="co-dh-t">Didn’t happen?</h3><p class="n99-small">Mark it excused so it stops counting as missed. Your plan and your logged records do not change.</p><div class="n99-picker co-reasons">${[['sick','Sick'],['travel','Travel'],['rest','Rest'],['other','Other']].map(([k,t])=>N.button(t,`NXT.coach.excuse('${date}','${k}')`,true)).join('')}</div></section>`;
      else if(cx&&cx.status==='moved'&&cx.movedTo)didnt=`<p class="n99-small co-dh-note">Moved to ${esc(N.shortDate(cx.movedTo))}.</p>`;
    }catch(e){didnt='';}
    N.modal(N.shortDate(date),`${didnt?`<p>${esc(N.label(current))}.</p>${didnt}<p>Pick what this day should be.</p>`:`<p>${esc(N.label(current))}. Pick what this day should be.</p>`}${logged?'<p class="n99-small">This day already has logged sets, so it can’t be changed.</p>':`<div class="n99-picker">${N.pickTypes(current).map(t=>N.button(N.label(t),`NXT.setDayType('${date}','${t}')`,t!==current)).join('')}</div><label class="n99-check"><input type="checkbox" id="n99-day-every"> Make every ${dn} this</label>`}${date===state.date?N.button('Choose a different session','showSessionSheet()',true):''}`);
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
  return {sessionLogs,training,selectExercise,nextExercise,logSet,finish,openFinishSummary,resume,shorter,fullSession,undo,sessionPicker,chooseSession,cardioModal,saveCardio,deleteCardio,cardioCard,recoveryDay,recoveryModal,saveRecovery,openDay,setDayType,moveDay};
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
    let content='',title={goals:N.features&&N.features.calories?'Goals & calories':'Goals',training:'Training programme',coach:N.features.checkin?'Cardio & recovery':'Cardio'}[view];
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
    return N.calorieCard()+N.card('Your goal range',`<p>Optional. Set a checkpoint you can review alongside ${N.features.waist?'waist and strength':'your strength and scans'}. There is no deadline or automatic push to keep losing weight.</p>${!c.targetConfirmed?'<p class="n99-small">The values below come from your previous app settings. Save to confirm or change them.</p>':''}<form onsubmit="event.preventDefault();NXT.saveGoal()"><div class="n99-form-grid"><label>Lower weight · kg<input id="n99-goal-low" type="number" min="40" max="300" step="0.1" required value="${goalLow()}"></label><label>Upper weight · kg<input id="n99-goal-high" type="number" min="40" max="300" step="0.1" required value="${goalHigh()}"></label></div><button type="submit" class="n99-button">Save goal range</button></form>`)+N.card('Cut start',`<p>When your cut began and your weight that day. Used for the “down so far” line and the cut journey.</p><form onsubmit="event.preventDefault();NXT.saveCutStart()"><label>Start date<input id="n99-cut-date" type="date" max="${state.date}" value="${esc(settings.cutStart||'')}"></label><label>Start weight · kg<input id="n99-cut-weight" type="number" min="30" max="300" step="0.1" inputmode="decimal" value="${Number(settings.startWeight)||''}"></label><button type="submit" class="n99-button">Save cut start</button></form>`)+N.card('How your advice works',`<p>Weight averages and repeated strength comparisons inform your review. Recommendations explain their evidence; nothing in your plan changes automatically.</p>${N.button('Open weekly review','NXT.openReview()',true)}`);
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
    return N.card('Your weekly plan',`<p>Three full-body sessions, easy cardio between them, and a rest day. All routines remain editable.</p><form onsubmit="event.preventDefault();NXT.saveWeek()"><div class="n99-week-editor">${[1,2,3,4,5,6,0].map(d=>`<label>${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]}<select id="n99-day-${d}">${N.pickTypes(settings.weeklyPlan[d]).map(t=>`<option value="${t}" ${settings.weeklyPlan[d]===t?'selected':''}>${N.label(t)}</option>`).join('')}</select></label>`).join('')}</div><button type="submit" class="n99-button">Save weekly plan</button></form><p class="n99-small">Tap any day on Home to change what it is.</p>`)+N.card('Saved workouts',`<p>Edits apply to future sessions at the selected gym. Logged history and current workout queues are preserved.</p><button class="n99-chip" onclick="cycleGym()">${esc(state.gym)} · switch gym</button><div class="n99-stack">${['FullA','FullB','FullC'].map(t=>N.button(`${N.label(t)} · ${(n=>n+" "+N.plural(n,"exercise"))(N.templateFor(t).length)}`,`NXT.editTemplate('${t}')`,true)).join('')}</div><details><summary>Other saved routines</summary><div class="n99-stack">${['Push','Pull','Pump','Legs'].map(t=>N.button(N.label(t),`NXT.editTemplate('${t}')`,true)).join('')}</div></details>`)+`<details class="n99-card"><summary>Gym names & equipment</summary>${gymSettingsHTML()}</details>`+N.card('Programme defaults',`<p>Restore the A/B/C weekly rhythm or return to the weekly plan saved before this upgrade.</p><div class="n99-stack">${N.button('Use A/B/C weekly rhythm','NXT.restoreWeek(false)',true)}${N.button('Use my previous weekly plan','NXT.restoreWeek(true)',true)}</div>`);
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
    return N.card('Weekly cardio target',`<p>A minutes goal, not a calorie-burn score. Start with what you can recover from and review before increasing it.</p><form onsubmit="event.preventDefault();NXT.saveCardioGoal()"><label>Minutes per week<input id="n99-card-goal" type="number" min="30" max="600" step="5" inputmode="numeric" required value="${target}"></label><button type="submit" class="n99-button">Save weekly target</button></form>`)+(N.features.checkin?N.card('Recovery check-ins',`<p>Sleep, energy and soreness are optional. An old check-in is never presented as today’s readiness.</p>${N.button('Update today','apx96OpenReadiness()',true)}<div class="n99-measurements">${Object.values(N.cfg().recovery).filter(r=>r.date&&r.date<=state.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).map(r=>`<div class="n99-list-row"><span>${N.shortDate(r.date)}</span><small>Sleep ${r.sleep===''?'—':r.sleep+'h'} · energy ${r.energy||'—'}/5</small></div>`).join('')}</div>`):'')+N.reviewCard();
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
    // Add-on lifts ride in the backup's storage dump like session plans; an older backup without them restores an empty map.
    for(const [field,key,fallback] of [['sessionPlans','apm_session_plans',{}],['addOns','apm_addons',{}],['coachInsights','apm_coach_insights',{}],['exerciseNotes','apm_exercise_notes',{}]]) {
      try{state[field]=JSON.parse(d.dump[key]||JSON.stringify(fallback));}catch(e){state[field]=fallback;}
    }
    state.gym=d.current.gym||state.gym;state.gyms=d.current.gyms||state.gyms;state.read=d.current.read||state.read;state.notifs=d.notifications||state.notifs;
    START_WEIGHT=Number(settings.startWeight)||START_WEIGHT;TARGET_LOW=Number(settings.targetLow)||TARGET_LOW;TARGET_HIGH=Number(settings.targetHigh)||TARGET_HIGH;USER_TDEE=Number(settings.tdee)||USER_TDEE;ZONE2_WEEKLY_TARGET=Number(settings.zone2WeeklyTarget)||ZONE2_WEEKLY_TARGET;
    install(false);state.date=today();state.dayType=N.typeFor(state.date);state.exercise=N.templateFor()[0]?.name||'';N.commit('Backup restored');
  }
  function resetData() {
    if(!confirm('Reset NXTFRM records on this device? A safety copy will be kept. Other sites and unrelated storage will not be touched.'))return;
    if(!N.snapshot('Before local reset'))return;
    const keys=['apm_logs','apm_cardio','apm_floorball','apm_bws','apm_evo_scans','apm_rest','apm_current_read','apm_current_gym','apm_gyms','apm_notifications','apm_coach_insights','apm_session_plans','apm_addons','apm_exercise_notes','apm_settings','apm_last_open_date'];
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
      if(!N.snapshot('Before V99 upgrade')){N.rebaseProgramme();return;}
      c.previousWeeklyPlan=N.copy(settings.weeklyPlan||{});settings.weeklyPlan=N.copy(N.split);
      // A migrated plan is not an edit: an older edit stamp must not make the factory split win a merge.
      delete settings.planUpdatedAt;
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
    /* persist() rethrows its first refused write (D29). On a full phone that exception
       used to end cut-support.js at load, before the Safe Sync merge and the cloud
       overrides below were installed. The state stays in memory; the next save that fits
       writes it. */
    try{persist();}catch(e){console.error('NXTFRM: storage refused the installed state',e);}
    // What install() normalised or migrated is the base later edits are stamped against.
    N.rebaseProgramme();
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
/* Weigh-in sheet (D44): the daily action gets the same big-number entry as a set on Train.
   Same ids and the same save path; timing is a segmented control writing the same value. */
apx95OpenQuickWeight=function(){
  const last=NXT.weights().at(-1),hint=last?Number(last.weight).toFixed(1):'';
  const times=['Morning','Pre-workout','Post-workout','Night'];
  NXT.modal('Log weigh-in',`<form class="st-qw" onsubmit="event.preventDefault();apx95SaveQuickWeight()">
    <div class="st-qw-num">
      <button type="button" class="st-qw-step" aria-label="Down 0.1 kilograms" onclick="NXT.qwStep(-1)">−</button>
      <label class="st-qw-field"><span class="st-sr">Weight in kilograms</span><input id="apx95WeightValue" type="number" min="20" max="400" step="0.1" inputmode="decimal" required placeholder="${hint}" data-hint="${hint}" autocomplete="off"><em aria-hidden="true">kg</em></label>
      <button type="button" class="st-qw-step" aria-label="Up 0.1 kilograms" onclick="NXT.qwStep(1)">+</button>
    </div>
    <p class="st-qw-last">${last?`Last morning reading ${hint} kg · ${esc(NXT.shortDate(last.date))}`:'Morning, before food, gives the cleanest trend.'}</p>
    <div class="st-qw-seg" role="group" aria-label="Timing">${times.map((t,i)=>`<button type="button" aria-pressed="${i===0}" class="${i===0?'is-on':''}" onclick="NXT.qwTime(this,'${t}')">${t==='Pre-workout'?'Pre':t==='Post-workout'?'Post':t}</button>`).join('')}</div>
    <select id="apx95WeightTime" class="st-sr" tabindex="-1" aria-hidden="true"><option>Morning</option><option>Pre-workout</option><option>Post-workout</option><option>Night</option></select>
    <label class="st-qw-date">Date<input id="apx95WeightDate" type="date" required max="${state.date}" value="${state.date}"></label>
    <p class="n99-small">Use similar conditions each time. Morning readings drive your progress trend; post-workout readings are shown separately for context. Every original entry stays saved.</p>
    <button type="submit" class="n99-button">Save weigh-in</button></form>`);
  setTimeout(()=>document.getElementById('apx95WeightValue')?.focus(),60);
};
NXT.qwStep=function(dir){const el=document.getElementById('apx95WeightValue');if(!el)return;const cur=NXT.finite(el.value)??NXT.finite(el.dataset.hint)??80;el.value=(Math.round((cur+dir*0.1)*10)/10).toFixed(1);el.classList.remove('st-bump-up','st-bump-dn');void el.offsetWidth;el.classList.add(dir>0?'st-bump-up':'st-bump-dn');};
NXT.qwTime=function(btn,t){const h=document.getElementById('apx95WeightTime');if(h)h.value=t;btn.parentElement.querySelectorAll('button').forEach(b=>{const on=b===btn;b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));});};
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
/* install() must not throw on a full phone: below it are the Safe Sync merge and the
   cloud overrides, and without them the page keeps index.html's original
   applyCloudPayload, which replaces local records with the cloud's. Every storage write
   inside it is caught (persist, snapshot, D33, TDEE). A programming error still surfaces. */
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
      /* Waist rows are records like weigh-ins: union by id, the later ts winning. cfg()
         gives every device an array, which used to win outright and drop the account's. */
      if(key==='waist'){out[key]=unionById(lv,cv).rows;continue;}
      if(isPlain(lv)&&isPlain(cv))out[key]=mergeObjectsLocalWins(cv,lv);
      else if(lv!==undefined)out[key]=lv;
      else out[key]=cv;
    }
    return out;
  }
  /* ---- Programme conflict strategy ------------------------------------------------
     The weekly plan, dated overrides and saved routines are settings, not records, so
     union by id cannot merge them, and "this device wins" let a fresh or reset phone,
     which holds the factory plan before it has read anything, overwrite the account's
     split and then write it back. Each is now settled on its edit stamp (commit() in the
     engine): the newer copy wins. A copy without a stamp predates stamping and loses to
     a stamped one. When neither side is stamped, a factory value on this device counts
     as unset and the account's copy wins; two unstamped customised copies keep this
     device's, as before. */
  const stampMs=v=>{const n=Date.parse(v);return Number.isFinite(n)?n:0;};
  const legs=t=>t==='Legs'?'Pump':t; // D33, as install() maps it
  function planKey(p){return isPlain(p)?[0,1,2,3,4,5,6].map(d=>legs(p[d]||'')).join('|'):'';}
  // The factory plans: index.html's default split, and the A/B/C rhythm install() writes on a new device.
  function factoryPlan(p){return [NXT.split,typeof DEFAULT_WEEKLY_PLAN!=='undefined'?DEFAULT_WEEKLY_PLAN:null].some(f=>f&&planKey(f)===planKey(p));}
  function rowsKey(rows){return JSON.stringify((Array.isArray(rows)?rows:[]).map(r=>r&&[r.name,Number(r.sets),Array.isArray(r.reps)?r.reps.map(Number):null,Number(r.inc)]));}
  function factoryRoutine(key,rows){
    const type=legs(String(key).split('__').pop());
    return [NXT.defaults[type],typeof TEMPLATES!=='undefined'?TEMPLATES[type]:null].some(f=>Array.isArray(f)&&rowsKey(f)===rowsKey(rows));
  }
  const metaOf=(cs,name)=>isPlain(cs)&&isPlain(cs[name])?cs[name]:{};
  // The account's copy wins when its stamp is newer, or when neither is stamped and this device's carries nothing of the user's.
  function cloudWins(local,cloud,unset){const l=stampMs(local),c=stampMs(cloud);return c!==l?c>l:!l&&unset;}
  function resolveProgramme(out,L,C){
    const LC=isPlain(L.cutSupport)?L.cutSupport:{},CC=isPlain(C.cutSupport)?C.cutSupport:{};
    // Weekly plan. The plan it replaced (restoreWeek's "previous plan") travels with it.
    const fromCloud=isPlain(C.weeklyPlan)&&cloudWins(L.planUpdatedAt,C.planUpdatedAt,!isPlain(L.weeklyPlan)||(factoryPlan(L.weeklyPlan)&&planKey(L.weeklyPlan)!==planKey(C.weeklyPlan)));
    const P=fromCloud?C:L;
    if(isPlain(P.weeklyPlan))out.weeklyPlan={...P.weeklyPlan};
    if(P.planUpdatedAt)out.planUpdatedAt=P.planUpdatedAt;else delete out.planUpdatedAt;
    if(fromCloud&&isPlain(CC.previousWeeklyPlan))out.cutSupport.previousWeeklyPlan={...CC.previousWeeklyPlan};
    // Dated overrides: union by date. Where both sides know a date the newer stamp decides,
    // and a stamp without a value is a day that was cleared.
    const LO=isPlain(L.dayOverrides)?L.dayOverrides:{},CO=isPlain(C.dayOverrides)?C.dayOverrides:{};
    const LM=metaOf(LC,'overrideMeta'),CM=metaOf(CC,'overrideMeta'),days={},dayMeta={};
    for(const d of new Set([...Object.keys(CO),...Object.keys(LO),...Object.keys(CM),...Object.keys(LM)])){
      const useCloud=cloudWins(LM[d],CM[d],!Object.prototype.hasOwnProperty.call(LO,d));
      const v=useCloud?CO[d]:LO[d],at=useCloud?CM[d]:LM[d];
      if(typeof v==='string'&&v)days[d]=v;
      if(at)dayMeta[d]=at;
    }
    if(isPlain(L.dayOverrides)||isPlain(C.dayOverrides))out.dayOverrides=days;
    if(Object.keys(dayMeta).length)out.cutSupport.overrideMeta=dayMeta;else delete out.cutSupport.overrideMeta;
    // Saved routines, per gym and type. Unstamped on both sides, a routine this device
    // cannot use (validTemplate) or holds at the factory list counts as unset.
    const LT=isPlain(LC.templates)?LC.templates:{},CT=isPlain(CC.templates)?CC.templates:{};
    const LTM=metaOf(LC,'templateMeta'),CTM=metaOf(CC,'templateMeta'),tpl={},tplMeta={};
    const usable=v=>!!(NXT.validTemplate&&NXT.validTemplate(v));
    for(const k of new Set([...Object.keys(CT),...Object.keys(LT)])){
      const lv=LT[k],cv=CT[k];
      const useCloud=lv===undefined||(cv!==undefined&&cloudWins(LTM[k],CTM[k],(!usable(lv)&&usable(cv))||(factoryRoutine(k,lv)&&rowsKey(lv)!==rowsKey(cv))));
      tpl[k]=useCloud?cv:lv;
      const at=useCloud?CTM[k]:LTM[k];if(at)tplMeta[k]=at;
    }
    out.cutSupport.templates=tpl;
    if(Object.keys(tplMeta).length)out.cutSupport.templateMeta=tplMeta;else delete out.cutSupport.templateMeta;
  }
  /* The same rule for the values every fresh device starts with: boot fills SETTINGS_DEFAULTS
     and install() turns a 180-minute cardio target into 90, so a phone that has read nothing
     holds a factory goal range, start weight, TDEE and cardio target, and these used to
     replace the account's. When this device's copy is the factory one and the account's
     differs, the account's wins; a customised copy here is kept, as before. Values saved
     together move together, so a range or a cut start is never half-taken: the goal range
     with its confirmation (saveGoal), the start weight with its date (saveCutStart). */
  function resolveDefaults(out,L,C){
    const D=typeof SETTINGS_DEFAULTS!=='undefined'?SETTINGS_DEFAULTS:{},LC=isPlain(L.cutSupport)?L.cutSupport:{},CC=isPlain(C.cutSupport)?C.cutSupport:{};
    const none=v=>v===undefined||v===null||v==='';
    const at=(k,...factory)=>none(L[k])||factory.some(f=>Number(L[k])===Number(f));
    for(const [keys,factory] of [
      [['targetLow','targetHigh','goalLow','goalHigh'],LC.targetConfirmed!==true&&at('targetLow',D.targetLow)&&at('targetHigh',D.targetHigh)&&at('goalLow',D.targetLow)&&at('goalHigh',D.targetHigh)],
      [['startWeight','cutStart'],at('startWeight',D.startWeight)&&none(L.cutStart)],
      [['tdee'],at('tdee',D.tdee)],
      [['zone2WeeklyTarget'],at('zone2WeeklyTarget',D.zone2WeeklyTarget,90)]
    ]){
      if(!factory||keys.every(k=>none(C[k])||String(C[k])===String(L[k])))continue;
      for(const k of keys){if(none(C[k]))delete out[k];else out[k]=C[k];}
      if(keys[0]==='targetLow'&&CC.targetConfirmed===true)out.cutSupport.targetConfirmed=true;
    }
    // An unset name greets as "Dan" (userName); an empty name is a choice and is kept.
    if((L.name===undefined||L.name==='Dan')&&typeof C.name==='string'&&C.name!==L.name)out.name=C.name;
  }
  /* Today's queues are seeded from this device's routines when the page first draws,
     before the account has been read (on a fresh phone, the factory list), and session
     plans are not part of the cloud row. A queue that is still exactly its seed, with no
     set logged in it on this device, is re-seeded from the routine the merge settled on:
     the D22 rule for a routine save. Started and edited queues are kept. */
  function untouchedToday(){
    const day=state.date,plans=isPlain(state.sessionPlans)?state.sessionPlans:{},targets=NXT.cfg().sessionTargets,out=[];
    for(const key of Object.keys(plans)){
      if(!key.startsWith(day+'__'))continue;
      const rest=key.slice(day.length+2),cut=rest.lastIndexOf('__');if(cut<1)continue;
      const gym=rest.slice(0,cut),type=rest.slice(cut+2),seed=NXT.templateFor(type,gym);
      const logged=(state.logs||[]).some(x=>x&&x.date===day&&(x.gym||'Gym A')===gym&&(!x.dayType||x.dayType===type));
      const same=Array.isArray(plans[key])&&plans[key].join('\n')===seed.map(e=>e.name).join('\n')&&(!Array.isArray(targets[key])||rowsKey(targets[key])===rowsKey(seed));
      if(!logged&&same)out.push({key,gym,type,seed:rowsKey(seed)});
    }
    return out;
  }
  function reseedToday(list){
    for(const s of list){
      const rows=NXT.templateFor(s.type,s.gym);
      if(rowsKey(rows)===s.seed)continue;
      state.sessionPlans[s.key]=rows.map(e=>e.name);NXT.cfg().sessionTargets[s.key]=NXT.copy(rows);
    }
  }
  NXT.old.applyCloudPayload=function(d){
    lastCloudMergeOk=false;
    if(!d)return;
    const today=untouchedToday(); // read before anything merges in
    const added={};
    for(const field of ['logs','bws','cardio','floorball','scans','rest']){
      if(d[field]===undefined){added[field]=0;continue;}
      const merged=unionById(state[field],d[field]);
      state[field]=merged.rows;
      added[field]=merged.added;
    }
    if(d.gyms)state.gyms=d.gyms;
    if(d.gym)state.gym=d.gym;
    // Add-on lifts are per session, like queues: union by session, this device's list first.
    if(isPlain(d.addOns))state.addOns=mergeObjectsLocalWins(d.addOns,state.addOns);
    if(d.settings&&isPlain(d.settings)){
      const localSettings=settings&&isPlain(settings)?settings:{};
      const merged={...d.settings,...localSettings};
      merged.cutSupport=mergeCutSupport(localSettings.cutSupport,d.settings.cutSupport);
      resolveProgramme(merged,localSettings,d.settings);
      resolveDefaults(merged,localSettings,d.settings);
      settings=merged;
      START_WEIGHT=Number(settings.startWeight)||START_WEIGHT;
      TARGET_HIGH=Number(settings.targetHigh)||TARGET_HIGH;
      TARGET_LOW=Number(settings.targetLow)||TARGET_LOW;
      USER_TDEE=Number(settings.tdee)||USER_TDEE;
      ZONE2_WEEKLY_TARGET=Number(settings.zone2WeeklyTarget)||ZONE2_WEEKLY_TARGET;
    }
    reseedToday(today);
    console.log(`Merged cloud: +${added.logs} logs, +${added.bws} bws, +${added.cardio} cardio, +${added.floorball} floorball, +${added.scans} scans, +${added.rest} rest`);
    /* A refused local write (full phone) does not undo the merge: the load still sends
       the merged result to the account (D29). */
    try{persist();}catch(e){console.error('NXTFRM: storage refused the merged state',e);}
    // A merged copy keeps the stamps it arrived with; it is not a new edit.
    NXT.rebaseProgramme();
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
    /* The page no longer waits for supabase-js (loadSupabase). This restore does, however long it takes, and
       then runs exactly as it always has: session, read before write, merge, save. A library that is already
       there is not waited for, so the normal path does not yield and keeps its order. */
    if(typeof loadSupabase==='function'&&!window.supabase)await loadSupabase();
    const client=initSupabaseClient();
    const stored=hasStoredSbAuthToken();
    if(!client){
      cloudSessionChecked=true;
      /* A library that could not load says nothing about the account, so a stored session is left for the next
         launch. Only a device with no project URL or key (nothing could use the session) clears it, as before. */
      const libraryMissing=!window.supabase&&!!(localStorage.getItem('apm_sb_url')&&localStorage.getItem('apm_sb_key'));
      if(stored&&!libraryMissing)await cloudSignOutSilent();
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

/* Read before write. A save replaces the whole cloud row, so a page that has not read the
   account yet would upload whatever this device holds: on a fresh or reset phone, the
   factory plan and no workouts, which the load that follows then reads back. Until this
   page has fetched the row for the signed-in user, a save fetches it first; a merge ends
   with its own save of the result, and a failed fetch writes nothing. A row that was
   fetched but not merged (no safety copy on a full phone, or a row the app cannot apply)
   leaves saves as they were, so a change still reaches the account (D29). */
let cloudReadUser=null,cloudReading=null;
let cloudSaveQuiet=false;
/* afterRead: the save a load makes of its own merge; it must not wait on that load. */
saveCloudNow=async function(show=true,afterRead=false){
  try{
    /* The library loads lazily. The gate answers loading / unavailable / retry itself; a save never
       reports success it did not get, so a missing library simply leaves the change local for now. */
    if(typeof awaitCloudLibrary==="function"&&(await awaitCloudLibrary({show,restore:true}))!==true)return;

    const client=initSupabaseClient();
    if(!client||!cloudUser){
      if(show)toast('Cloud not connected');
      return;
    }
    // Twice at most: a read already running may belong to the sign-in this one replaced.
    for(let tries=0;!afterRead&&cloudUser&&cloudReadUser!==cloudUser&&tries<2;tries++){
      const read=await loadCloudNow(!show);
      if(read==='failed'||read==='offline')return;
      if(cloudReadUser!==cloudUser)continue;
      // Merged: that load has already saved the result. Empty or unmerged: this save writes.
      if(read==='merged'){if(show&&!lastCloudError)toast('Saved to Supabase');return;}
    }
    if(!cloudUser||(!afterRead&&cloudReadUser!==cloudUser))return;
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

/* Resolves to what happened: 'merged', 'empty', 'unmerged', 'failed' or 'offline'.
   quiet (a save reading first) keeps toasts out of normal operation (D11). */
loadCloudNow=function(quiet){
  // One read at a time: a save that needs the account waits for the read already running.
  if(!cloudReading)cloudReading=readCloudRow(quiet===true).finally(()=>{cloudReading=null;});
  return cloudReading;
};
async function readCloudRow(quiet){
  const say=m=>{if(!quiet)toast(m);};
  try{
    if(typeof awaitCloudLibrary==="function"&&(await awaitCloudLibrary({show:!quiet,restore:true}))!==true)return 'offline';

    const client=initSupabaseClient();
    if(!client||!cloudUser){
      say('Cloud not connected');
      return 'offline';
    }
    const user=cloudUser;
    cloudStatusText='Syncing...';
    updateCloudSyncStatus();
    const {data,error}=await client.from('apexcut_profiles').select('data').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(!(data&&data.data)){
      cloudReadUser=user; // nothing to merge: this device writes the first copy
      cloudStatusText='Loaded online';
      say('No cloud data yet');
      updateCloudSyncStatus();
      return 'empty';
    }
    lastCloudMergeOk=false;
    applyCloudPayload(data.data);
    cloudReadUser=user;
    if(!lastCloudMergeOk)return 'unmerged';
    cloudStatusText='Loaded online';
    say('Loaded from Supabase');
    const prevToast=toast;
    toast=function(){};
    cloudSaveQuiet=true;
    try{
      // The merged result goes back to the account it came from; a sign-in that changed hands mid-load waits for its own read.
      if(cloudUser===user)await saveCloudNow(false,true);
    }catch(e){
      lastCloudError=e;
      console.error(e);
    }finally{
      cloudSaveQuiet=false;
      toast=prevToast;
    }
    render();
    return 'merged';
  }catch(e){
    lastCloudError=e;
    cloudStatusText='Sync error';
    updateCloudSyncStatus();
    say(e.message||'Cloud load failed');
    return 'failed';
  }
}

initCloudFromStorage();

