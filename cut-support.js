/* NXTFRM V99. Additive extension: existing records, storage keys and cloud envelope stay compatible. */
"use strict";
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
  const names = {FullA:"Full Body A",FullB:"Full Body B",FullC:"Full Body C",Push:"Push",Pull:"Pull",Pump:"Legs & Core",Legs:"Legs",Zone2:"Easy cardio",Rest:"Rest",Floorball:"Floorball"};
  const typeNames = () => Object.keys(names);
  const ui = {view:"overview", range:30, showGoal:false, selected:null, draft:null, lastFocus:null};
  function cfg() {
    if(!settings.cutSupport || typeof settings.cutSupport!=="object" || Array.isArray(settings.cutSupport))settings.cutSupport={};
    const c=settings.cutSupport;
    for(const key of ["profile","templates","sessions","sessionTargets","recovery"])if(!c[key]||typeof c[key]!=="object"||Array.isArray(c[key]))c[key]={};
    if(!Array.isArray(c.waist))c.waist=[];
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
      const prior=byDate.get(r.date),morning=String(r.timeOfDay||"").toLowerCase()==="morning";
      if(!prior||morning||String(prior.timeOfDay||"").toLowerCase()!=="morning")byDate.set(r.date,{...r,[key]:v});
    }
    return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function weights() { return cleanRows(state.bws); }
  function windowStats(rows,end=state.date,days=7,key="weight") {
    const start=dateAdd(end,1-days),items=rows.filter(r=>r.date>=start&&r.date<=end);
    return {items,n:items.length,avg:items.length?items.reduce((s,r)=>s+r[key],0)/items.length:null};
  }
  function trend(rows=weights()) {
    return rows.map(r=>{const w=windowStats(rows,r.date);return {...r,avg:w.n>=3?w.avg:null,coverage:w.n};});
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
    if(check&&(Number(check.energy)<=2&&check.energy!==""||Number(check.soreness)>=4))return {...base,title:"Give recovery some attention",message:"Your check-in suggests low energy or high soreness. Consider a shorter session or rest, and review how you feel before adding work.",action:"Review recovery",reason:"Based on today’s check-in",tone:"watch"};
    if(lifts.filter(x=>x.status==="Review").length>=2)return {...base,title:"Review your training load",message:"Several comparable lifts are down across repeated sessions. Check recovery and technique before changing calories or adding cardio.",action:"Review recovery",reason:"Repeated declines in two or more lifts",tone:"watch"};
    if(s.change===null)return base;
    if(s.percent < -1)return {...base,title:"Weight is moving quickly",message:"Check energy, hunger and strength before pushing further. Early water changes can contribute; this is a review prompt, not a diagnosis.",action:"Review your target",tone:"watch"};
    const c=cfg(),target=c.targetConfirmed?{low:goalLow(),high:goalHigh()}:null;
    if(target&&s.current.avg>=target.low&&s.current.avg<=target.high&&s.previous.avg>=target.low&&s.previous.avg<=target.high)return {...base,title:"Your trend is in your goal range",message:"Two weekly averages are within your chosen range. Consider maintaining if you are happy with your progress; nothing changes automatically.",action:"Review your goal",tone:"good"};
    if(s.change<-.15)return {...base,title:"Your weight trend is moving down",message:lifts.some(x=>x.delta!==null)?"Keep your current plan if energy and performance feel manageable. Stable strength is useful progress.":"Keep the plan steady if recovery feels manageable. Strength history is still building, so muscle retention is not yet assessable.",action:"Stay consistent",tone:"good"};
    if(Math.abs(s.change)<.2&&s.priorChange!==null&&Math.abs(s.priorChange)<.2) {
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
  function cardioWeek() { return (state.cardio||[]).filter(r=>r&&r.date>=weekStart()&&r.date<=state.date&&finite(r.duration)>0).reduce((s,r)=>s+Number(r.duration),0); }
  function completedWeek() { return new Set(workRows().filter(r=>r.date>=weekStart()).map(r=>r.date)).size; }
  function typeFor(d) { return settings.dayOverrides?.[d]||settings.weeklyPlan?.[new Date(dateMs(d)).getUTCDay()]||"Rest"; }
  function templateFor(type=state.dayType,gym=state.gym) {
    const saved=cfg().templates[gym+"__"+type];
    return NXT.validTemplate?.(saved)?saved:TEMPLATES[type]||[];
  }
  function targetFor(ex) { return cfg().sessionTargets[sessionKey()]?.find?.(x=>x.name===ex)||templateFor().find(x=>x.name===ex)||old.getT(ex)||exercise(ex,3,8,12); }
  function done(ex) { return workRows().filter(r=>r.date===state.date&&(r.gym||"Gym A")===state.gym&&(r.exercise||r.name)===ex).length; }
  function planDone() { return !!cfg().sessions[sessionKey()]?.finished; }
  function cue(ex) {
    const t=targetFor(ex),all=sessionRows(ex,state.gym,state.date,100),last=all.at(-1),prev=all.at(-2);
    if(!last)return {label:"Set your baseline",weight:0,text:"Choose a manageable load and leave around two reps in reserve. Your first session establishes the baseline."};
    const weight=Number(last.sets[0].weight),recent=last.date>=dateAdd(state.date,-28);
    if(!recent)return {label:"Re-establish your baseline",weight:0,text:"This exercise history is over four weeks old. Choose a manageable starting load for today."};
    const top=s=>s&&s.sets.length>=t.sets&&s.sets.slice(0,t.sets).every(r=>Number(r.reps)>=t.reps[1]&&Number(r.weight)===weight);
    const effortOkay=last.sets.every(r=>r.rir===null||r.rir===undefined||r.rir===""||Number(r.rir)>=2);
    const r=cfg().recovery[state.date],tired=r&&(Number(r.energy)<=2&&r.energy!==""||Number(r.soreness)>=4);
    if(!tired&&top(last)&&top(prev)&&effortOkay&&Number(t.inc)>0)return {label:"Ready to consider an increase",weight:weight+Number(t.inc),text:"You reached the top of the rep range in two sessions. Use the next increment only if today’s warm-up feels controlled."};
    return {label:tired?"Keep today manageable":"Hold load · build clean reps",weight,text:tired?"Your check-in suggests fatigue. Keep the session manageable; use the shorter option if needed.":"Match your recent load within the rep range. Maintaining performance while cutting counts; an increase is optional."};
  }
  function snapshot(reason) {
    try {
      const data=old.getFullBackup();
      delete data.localStorageDump.apm_recovery_backup;
      localStorage.setItem("nxtfrm_recovery_snapshot",JSON.stringify({reason,createdAt:new Date().toISOString(),data}));
      return true;
    } catch(e) { toast("Could not make a safety copy. Export a backup before continuing.");return false; }
  }
  function repaint() { document.activeElement?.blur?.();window.__apexTyping=false;state.typingWeight=false;render(); }
  function commit(message) { try{persist();}catch(e){toast('Could not save on this device. Export a backup and free storage before retrying.');return false;}old.closeModal();repaint();if(message)toast(message);return true; }
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
    return `<section class="n99-card n99-review ${r.tone}"><div class="n99-eyebrow">Weekly cut review</div><h2>${r.title}</h2><p>${r.message}</p><div class="n99-review-foot"><span>${r.reason}</span><button class="n99-text" onclick="NXT.openReview()">Why this advice? ›</button></div></section>`;
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
      <div class="n99-stats">${metric('Latest weight',last?last.weight.toFixed(1)+'<small> kg</small>':'—',last?shortDate(last.date):'Log your baseline')}${metric('Weekly change',s.change===null?'—':(s.change>0?'+':'')+s.change.toFixed(2)+'<small> kg</small>',s.change===null?'Building data':'Weekly averages')}</div>
      <section class="n99-card"><div class="n99-row"><h2>Your weekly rhythm</h2><button class="n99-text" onclick="NXT.more('training')">Edit ›</button></div>${weekHTML()}<div class="n99-week-footer"><span>${completedWeek()} lifting days logged</span><span>${minutes} / ${target} cardio min</span></div></section>
      <div class="n99-quick">${button('＋ Weight','apx95OpenQuickWeight()',true)}${button('⌁ Cardio','showCardioSheet()',true)}${button('◉ Check-in','apx96OpenReadiness()',true)}</div>
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
    commit('Daily calorie target saved');
  }
  function openReview() { const r=review(),s=trendStats();modal('Your weekly review',`${reviewCard()}<div class="n99-stats">${metric('This week',s.current.avg===null?'—':s.current.avg.toFixed(2)+' kg',s.current.n+' weigh-ins')}${metric('Previous week',s.previous.avg===null?'—':s.previous.avg.toFixed(2)+' kg',s.previous.n+' weigh-ins')}</div><p>These are transparent coaching rules, not a medical assessment. Weight windows use calendar days. Strength compares the same exercise and gym across repeated sessions.</p><p>No food intake is recorded, so your actual deficit and the cause of a plateau are unknown. Any target change stays your choice.</p><div class="n99-stack">${button('Review calorie guide','NXT.openCalories()',true)}${button('Update recovery check-in','apx96OpenReadiness()',true)}${button('Done','closeModal()')}</div>`); }
  // Views and integrations are defined below, before install() runs.
  return {cfg,copy,ui,old,defaults,split,names,typeNames,finite,dateMs,dateAdd,weekStart,shortDate,label,weights,cleanRows,windowStats,trend,trendStats,workRows,sessionRows,strengthItems,review,estimate,cardioWeek,completedWeek,typeFor,templateFor,targetFor,done,planDone,cue,snapshot,repaint,commit,modal,button,heading,card,metric,reviewCard,calorieCard,weekHTML,home,openCalories,profileInputs,previewCalories,saveCalories,openReview};
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
  function chartModel(rows=N.weights(),range=N.ui.range,showGoal=N.ui.showGoal) {
    const series=N.trend(rows),start=range?N.dateAdd(state.date,1-range):rows[0]?.date||N.dateAdd(state.date,-29);
    const visible=series.filter(r=>r.date>=start),W=420,H=290,left=48,right=16,top=22,bottom=44;
    if(!visible.length)return {visible,start,W,H,left,right,top,bottom};
    const values=visible.flatMap(r=>r.avg===null?[r.weight]:[r.weight,r.avg]);
    if(showGoal&&N.cfg().targetConfirmed)values.push(goalLow(),goalHigh());
    const rawLow=Math.min(...values),rawHigh=Math.max(...values),span=Math.max(1,rawHigh-rawLow);
    const step=span<=2?.5:span<=4?1:span<=10?2:Math.ceil(span/20)*5;
    const low=Math.floor((rawLow-step*.45)/step)*step,high=Math.ceil((rawHigh+step*.45)/step)*step;
    const first=N.dateMs(start),end=Math.max(N.dateMs(state.date),first+86400000);
    const x=d=>left+(N.dateMs(d)-first)/(end-first)*(W-left-right),y=v=>top+(high-v)/(high-low)*(H-top-bottom);
    const points=visible.map(r=>({...r,x:x(r.date),y:y(r.weight),ty:r.avg===null?null:y(r.avg)}));
    const segments=[];let segment=[];
    for(const p of points) {
      if(p.avg===null||(segment.length&&N.dateMs(p.date)-N.dateMs(segment.at(-1).date)>7*86400000)) {if(segment.length)segments.push(segment);segment=[];}
      if(p.avg!==null)segment.push({...p,y:p.ty});
    }
    if(segment.length)segments.push(segment);
    const ticks=[];for(let n=low;n<=high+step/10;n+=step)ticks.push({value:n,y:y(n)});
    return {visible,start,W,H,left,right,top,bottom,low,high,points,segments,ticks,x,y};
  }
  function chartHTML() {
    const model=chartModel();N.ui.chart=model;
    const {visible,W,H,left,right,top,bottom}=model;
    const ranges=[[14,'2W'],[30,'1M'],[90,'3M'],[0,'All']];
    const controls=`<div class="n99-chart-controls"><div class="n99-segments" role="group" aria-label="Chart date range">${ranges.map(([r,l])=>`<button aria-pressed="${N.ui.range===r}" class="${N.ui.range===r?'active':''}" onclick="NXT.setRange(${r})">${l}</button>`).join('')}</div><label class="n99-check"><input type="checkbox" ${N.ui.showGoal?'checked':''} ${N.cfg().targetConfirmed?'':'disabled'} onchange="NXT.setGoalVisible(this.checked)">Goal band</label></div>`;
    if(!visible.length)return `<section class="n99-card n99-chart"><div class="n99-row"><h2>Weight trend</h2><span class="n99-unit">kg</span></div>${controls}<div class="n99-chart-empty"><div class="n99-empty-number">—<small> kg</small></div><h3>${N.weights().length?'No weigh-ins in this period':'Your first weigh-in starts here'}</h3><p>${N.weights().length?'Choose All to see older entries, or log a current weight.':'Your actual readings will appear as dots. A trend line starts when a seven-day window has three readings.'}</p>${N.button('＋ Log weight','apx95OpenQuickWeight()')}</div></section>`;
    const {points,segments,ticks,y}=model,selected=Math.max(0,points.findIndex(p=>p.date===N.ui.selected)),idx=N.ui.selected&&selected>=0?selected:points.length-1;
    const p=points[idx],baseline=H-bottom;
    const band=N.ui.showGoal&&N.cfg().targetConfirmed?`<rect x="${left}" y="${y(goalHigh())}" width="${W-left-right}" height="${y(goalLow())-y(goalHigh())}" fill="#b18aff" fill-opacity=".065"/><line x1="${left}" x2="${W-right}" y1="${y(goalHigh())}" y2="${y(goalHigh())}" stroke="#b18aff" stroke-opacity=".4" stroke-dasharray="5 5"/>`:'';
    return `<section class="n99-card n99-chart"><div class="n99-row"><div><div class="n99-eyebrow">The bigger picture</div><h2>Weight trend</h2></div><span class="n99-unit">kg</span></div>${controls}
      <div class="n99-chart-selected" aria-live="polite"><div><span id="n99-chart-date">${N.shortDate(p.date)}</span><strong id="n99-chart-weight">${p.weight.toFixed(1)}<small> kg</small></strong></div><div><span>7-day average</span><b id="n99-chart-average">${p.avg===null?'Building data':p.avg.toFixed(2)+' kg'}</b><small id="n99-chart-coverage">${p.coverage} readings in this window</small></div></div>
      <svg id="n99-chart-svg" class="n99-chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="n99-chart-title n99-chart-desc" onpointerdown="NXT.scrub(event)" onpointermove="if(event.buttons)NXT.scrub(event)"><title id="n99-chart-title">Bodyweight and seven-day rolling average</title><desc id="n99-chart-desc">${points.length} weigh-ins. Silver dots are recorded weights. The purple line is a calendar-day average, shown only with at least three readings. Use the slider below to inspect exact values.</desc>
      <defs><linearGradient id="n99-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b18aff" stop-opacity=".18"/><stop offset="1" stop-color="#b18aff" stop-opacity="0"/></linearGradient></defs>
      ${band}${ticks.map(t=>`<line x1="${left}" x2="${W-right}" y1="${t.y}" y2="${t.y}" stroke="#ffffff" stroke-opacity=".065"/><text x="${left-10}" y="${t.y+5}" text-anchor="end" fill="#b0a7bb" font-size="16">${Number(t.value.toFixed(1))}</text>`).join('')}
      ${segments.map(seg=>`${seg.length>1?`<path d="${smoothPath(seg)} L ${seg.at(-1).x} ${baseline} L ${seg[0].x} ${baseline} Z" fill="url(#n99-chart-fill)"/>`:''}<path d="${smoothPath(seg)}" fill="none" stroke="#b18aff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>${seg.length===1?`<circle cx="${seg[0].x}" cy="${seg[0].y}" r="3" fill="#b18aff"/>`:''}`).join('')}
      ${points.map(pt=>`<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="#d0c8de" fill-opacity=".72"/>`).join('')}
      <line id="n99-chart-cursor" x1="${p.x}" x2="${p.x}" y1="${top}" y2="${baseline}" stroke="#eee8f6" stroke-opacity=".5" stroke-dasharray="3 4"/><circle id="n99-chart-active" cx="${p.x}" cy="${p.y}" r="6" fill="#f6f1fc" stroke="#0d0b10" stroke-width="2"/>
      <text x="${left}" y="${H-12}" fill="#b0a7bb" font-size="16">${N.shortDate(model.start)}</text><text x="${W-right}" y="${H-12}" text-anchor="end" fill="#b0a7bb" font-size="16">${N.shortDate(state.date)}</text></svg>
      ${points.length>1?`<input class="n99-scrubber" id="n99-chart-slider" type="range" min="0" max="${points.length-1}" value="${idx}" aria-label="Inspect weigh-in by date" aria-valuetext="${N.shortDate(p.date)}, ${p.weight} kilograms" oninput="NXT.selectPoint(Number(this.value))">`:''}
      <div class="n99-legend"><span><i class="raw"></i>Weigh-in</span><span><i></i>7-day trend</span><span>Drag to inspect</span></div>
      ${N.ui.showGoal&&N.cfg().targetConfirmed?`<p class="n99-small">Your chosen range: ${goalLow()}–${goalHigh()} kg. A weight range alone does not measure leanness.</p>`:''}
    </section>`;
  }
  function selectPoint(index) {
    const m=N.ui.chart,p=m?.points?.[index];if(!p)return;
    N.ui.selected=p.date;
    const text=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    text('n99-chart-date',N.shortDate(p.date));text('n99-chart-weight',p.weight.toFixed(1)+' kg');text('n99-chart-average',p.avg===null?'Building data':p.avg.toFixed(2)+' kg');text('n99-chart-coverage',p.coverage+' readings in this window');
    const line=document.getElementById('n99-chart-cursor'),dot=document.getElementById('n99-chart-active'),slider=document.getElementById('n99-chart-slider');
    line?.setAttribute('x1',p.x);line?.setAttribute('x2',p.x);dot?.setAttribute('cx',p.x);dot?.setAttribute('cy',p.y);
    if(slider){slider.value=index;slider.setAttribute('aria-valuetext',N.shortDate(p.date)+', '+p.weight+' kilograms');}
  }
  function scrub(event) {
    const m=N.ui.chart,svg=document.getElementById('n99-chart-svg');if(!m?.points?.length||!svg)return;
    const bounds=svg.getBoundingClientRect(),x=(event.clientX-bounds.left)/bounds.width*m.W;
    const index=m.points.reduce((best,p,i)=>Math.abs(p.x-x)<Math.abs(m.points[best].x-x)?i:best,0);selectPoint(index);
  }
  function setRange(range) {N.ui.range=range;N.ui.selected=null;N.repaint();}
  function setGoalVisible(on) {N.ui.showGoal=on;N.repaint();}
  function setView(view) {N.ui.view=view;N.repaint();}
  function strengthHTML() {
    const items=N.strengthItems();
    return N.card('Keep your performance',`<p>Compare the same exercise, at the same gym. Four recent sessions establish a repeatable comparison; warm-ups and sets over 15 reps are excluded from the estimate.</p><div class="n99-stats">${N.metric('Holding / improving',items.filter(x=>x.tone==='good').length)}${N.metric('Worth reviewing',items.filter(x=>x.status==='Review').length)}</div>`)+N.card('Exercise trends',items.length?items.map(item=>{
      const values=item.history.slice(-8).map(x=>x.value),min=Math.min(...values)-1,max=Math.max(...values)+1;
      const points=values.map((v,i)=>({x:4+i/Math.max(1,values.length-1)*102,y:35-(v-min)/(max-min)*28}));
      return `<div class="n99-strength-row"><div><h3>${esc(item.name)}</h3><p>${esc(item.gym)} · ${item.sessions} sessions</p><span class="n99-status ${item.tone}">${item.status}${item.delta===null?'':' · '+signed(item.delta,1)+'%'}</span></div><svg viewBox="0 0 110 40" class="n99-spark" role="img" aria-label="Estimated strength across ${item.history.length} sessions"><path d="${smoothPath(points)}" fill="none" stroke="${item.tone==='watch'?'#edc481':'#b18aff'}" stroke-width="2"/><circle cx="${points.at(-1)?.x||4}" cy="${points.at(-1)?.y||20}" r="3" fill="#b18aff"/></svg></div>`;
    }).join(''):'<p>Your first logged workouts will appear here. Equipment loads are not mixed across gyms.</p>')+`<p class="n99-small">Estimated 1RM is a comparison aid, not a tested maximum or proof of muscle retention. Technique, effort and equipment setup affect it.</p>`;
  }
  function bodyHTML() {
    const rows=N.cleanRows(N.cfg().waist,'cm'),last=rows.at(-1),prior=rows.at(-2);
    return N.card('Waist measurement',`<p>Optional, once a week. Use the same tape position and similar conditions.</p><div class="n99-stats">${N.metric('Latest',last?last.cm.toFixed(1)+' cm':'—',last?N.shortDate(last.date):'No measurement yet')}${N.metric('Previous change',last&&prior?signed(last.cm-prior.cm,1)+' cm':'—')}</div>${N.button('＋ Log waist','NXT.openWaist()')}${rows.length?`<div class="n99-measurements">${rows.slice(-8).reverse().map(r=>`<button class="n99-list-row" onclick="NXT.openWaist('${r.date}')"><span>${N.shortDate(r.date)}</span><b>${r.cm.toFixed(1)} cm</b><span>Edit ›</span></button>`).join('')}</div>`:''}`)+N.card('Evo scans',`<p>Your existing scans are still available. Compare readings under similar conditions; treat changes as estimates, not proof of fat or muscle loss.</p>${N.button('Open scans','NXT.more(\'body\')',true)}`);
  }
  function progress() {
    const rows=N.weights(),s=N.trendStats(rows),v=N.ui.view;
    document.getElementById('weightPage').innerHTML=`<div class="n99">${N.heading('YOUR RESULTS, IN CONTEXT','Progress.',N.button('＋ Log','apx95OpenQuickWeight()',true))}<div class="n99-progress-tabs" role="group" aria-label="Progress view">${[['overview','Overview'],['strength','Strength'],['body','Body']].map(([key,text])=>`<button class="${v===key?'active':''}" aria-pressed="${v===key}" onclick="NXT.setView('${key}')">${text}</button>`).join('')}</div>${v==='strength'?strengthHTML():v==='body'?bodyHTML():`${chartHTML()}<div class="n99-stats">${N.metric('Weekly average',s.current.n>=3?s.current.avg.toFixed(2)+'<small> kg</small>':'—',s.current.n+' readings this week')}${N.metric('Weekly change',signed(s.change)+'<small> kg</small>',s.change===null?'Needs two weeks of readings':'Compared with last week')}</div>${N.reviewCard()}<div class="n99-quick">${N.button('Strength trends',"NXT.setView('strength')",true)}${N.button('Waist & scans',"NXT.setView('body')",true)}</div><details class="n99-card"><summary>Weigh-in history</summary>${typeof apx95WeightLogHTML==='function'?apx95WeightLogHTML(rows):rows.slice(-30).reverse().map(r=>`<div class="n99-list-row"><span>${N.shortDate(r.date)}</span><b>${r.weight.toFixed(1)} kg</b></div>`).join('')}${N.button('Manage all weight entries',"NXT.openWeightHistory()",true)}</details>`}</div>`;
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
  return {signed,smoothPath,chartModel,chartHTML,selectPoint,scrub,setRange,setGoalVisible,setView,strengthHTML,bodyHTML,progress,openWaist,saveWaist,deleteWaist,openWeightHistory,editWeight,saveWeightEdit,deleteWeight};
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
  function cardioModal() {
    N.modal('Log cardio',`<form onsubmit="event.preventDefault();NXT.saveCardio()"><label>Activity<select id="n99-card-type">${CARDIO_TYPES.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label><div class="n99-form-grid"><label>Duration · minutes<input id="n99-card-min" type="number" min="1" max="600" step="1" inputmode="numeric" required></label><label>Effort · 1–10<input id="n99-card-effort" type="number" min="1" max="10" step="1" inputmode="numeric" placeholder="Optional"></label></div><div class="n99-form-grid"><label>Speed · km/h<input id="n99-card-speed" type="number" min="0" max="80" step="0.1" inputmode="decimal" placeholder="Optional"></label><label>Incline · %<input id="n99-card-incline" type="number" min="0" max="40" step="0.5" inputmode="decimal" placeholder="Optional"></label></div><label>Average heart rate · optional<input id="n99-card-hr" type="number" min="30" max="240" inputmode="numeric"></label><p class="n99-small">For easy cardio, use a pace where conversation feels comfortable. Speed or incline alone cannot establish your physiological Zone 2.</p><button class="n99-button" type="submit">Save cardio</button></form>`);
  }
  function saveCardio() {
    const duration=N.finite(val('n99-card-min')),intensity=N.finite(val('n99-card-effort')),speed=N.finite(val('n99-card-speed')),incline=N.finite(val('n99-card-incline')),hr=N.finite(val('n99-card-hr'));
    if(duration===null||duration<1||duration>600||intensity!==null&&(intensity<1||intensity>10)||speed!==null&&(speed<0||speed>80)||incline!==null&&(incline<0||incline>40)||hr!==null&&(hr<30||hr>240))return toast('Check your cardio values.');
    state.cardio.push({id:uid(),date:state.date,gym:state.gym,type:val('n99-card-type'),duration,intensity:intensity??'',speed:speed??'',incline:incline??'',hr:hr??'',ts:Date.now()});N.commit('Cardio saved');
  }
  function cardioCard() {
    const minutes=N.cardioWeek(),target=Number(settings.zone2WeeklyTarget)||90;
    return N.card('Your cardio rhythm',`<div class="n99-row"><div class="n99-big">${minutes}<small> / ${target} min</small></div><button class="n99-text" onclick="NXT.more('coach')">Edit goal ›</button></div><div class="n99-session-rail"><span style="width:${Math.min(100,minutes/target*100)}%"></span></div><p>${minutes>=target?'Your planned minutes are logged. More is optional, not a requirement.':'Build towards your weekly goal at a manageable pace. Rest days remain part of the plan.'}</p>${N.button('＋ Log cardio','showCardioSheet()')}`);
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
    const current=N.typeFor(date);
    N.modal(N.shortDate(date),`<p>${N.label(current)}. Moving a session swaps it with another date; it does not add an extra workout.</p><form onsubmit="event.preventDefault();NXT.moveDay('${date}')"><label>Move / swap with<input id="n99-move-date" type="date" min="${state.date}" required value="${N.dateAdd(state.date,1)}"></label><button class="n99-button" type="submit">Swap sessions</button></form>${date===state.date?N.button('Choose a different session','showSessionSheet()',true):''}`);
  }
  function moveDay(from) {
    const to=val('n99-move-date');if(!Number.isFinite(N.dateMs(to))||to<state.date||to===from)return toast('Choose a different current or future date.');
    if((state.logs||[]).some(r=>r.date===from||r.date===to))return toast('One of these dates already has logged sets. Those sessions will not be moved.');
    const a=N.typeFor(from),b=N.typeFor(to);settings.dayOverrides=settings.dayOverrides||{};settings.dayOverrides[from]=b;settings.dayOverrides[to]=a;
    state.dayType=N.typeFor(state.date);state.exercise=N.templateFor()[0]?.name||'';N.commit('Sessions swapped');
  }
  return {sessionLogs,training,selectExercise,nextExercise,logSet,finish,openFinishSummary,resume,shorter,fullSession,undo,sessionPicker,chooseSession,cardioModal,saveCardio,cardioCard,recoveryDay,recoveryModal,saveRecovery,openDay,moveDay};
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
      document.getElementById('morePage').innerHTML=N.old.apx96MoreSectionHTML(view).replaceAll('NXTFRM V98','NXTFRM V100').replaceAll('V93–V97','V93–V99').replace("if(confirm('Clear all local NXTFRM data?')){localStorage.clear();location.reload()}","NXT.resetData()");
      if(view==='data')document.getElementById('morePage').insertAdjacentHTML('beforeend',`<div class="n99">${N.card('Safety copy',`<p>A local recovery copy is made before a restore, cloud load or reset. Export it to keep an independent copy.</p><div class="n99-stack">${N.button('Download safety copy','NXT.exportSafety()',true)}${N.button('Restore safety copy','NXT.restoreSafety()',true)}</div>`)}</div>`);
      return;
    }
    document.getElementById('morePage').innerHTML=`<div class="n99">${N.heading('YOUR SETUP',title,N.button('‹ Back',"NXT.more('hub')",true))}${content}</div>`;
  }
  function goalsHTML() {
    const c=N.cfg();
    return N.calorieCard()+N.card('Your goal range',`<p>Optional. Set a checkpoint you can review alongside waist and strength. There is no deadline or automatic push to keep losing weight.</p>${!c.targetConfirmed?'<p class="n99-small">The values below come from your previous app settings. Save to confirm or change them.</p>':''}<form onsubmit="event.preventDefault();NXT.saveGoal()"><div class="n99-form-grid"><label>Lower weight · kg<input id="n99-goal-low" type="number" min="40" max="300" step="0.1" required value="${goalLow()}"></label><label>Upper weight · kg<input id="n99-goal-high" type="number" min="40" max="300" step="0.1" required value="${goalHigh()}"></label></div><button type="submit" class="n99-button">Save goal range</button></form>`)+N.card('How your advice works',`<p>Weight averages, repeated strength comparisons and dated check-ins inform your review. Recommendations explain their evidence; calorie changes are never automatic.</p>${N.button('Open weekly review','NXT.openReview()',true)}`);
  }
  function saveGoal() {
    const lo=N.finite(val('n99-goal-low')),hi=N.finite(val('n99-goal-high')),height=Number(N.cfg().profile.height)||176;
    if(lo===null||hi===null||lo<40||hi>300||lo>=hi)return toast('Enter a valid lower and upper weight.');
    if(lo/(height/100)**2<18.5)return toast('That goal is below the adult underweight screening threshold. Seek individual guidance instead.');
    TARGET_LOW=lo;TARGET_HIGH=hi;settings.targetLow=lo;settings.targetHigh=hi;settings.goalLow=lo;settings.goalHigh=hi;N.cfg().targetConfirmed=true;N.commit('Goal range saved');
  }
  function programmeHTML() {
    return N.card('Your weekly plan',`<p>Three full-body sessions, easy cardio between them, and a rest day. All routines remain editable.</p><form onsubmit="event.preventDefault();NXT.saveWeek()"><div class="n99-week-editor">${[1,2,3,4,5,6,0].map(d=>`<label>${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]}<select id="n99-day-${d}">${N.typeNames().map(t=>`<option value="${t}" ${settings.weeklyPlan[d]===t?'selected':''}>${N.label(t)}</option>`).join('')}</select></label>`).join('')}</div><button type="submit" class="n99-button">Save weekly plan</button></form><p class="n99-small">Need to move a session? Tap its day on Home to swap dates without adding extra work.</p>`)+N.card('Saved workouts',`<p>Edits apply to future sessions at the selected gym. Logged history and current workout queues are preserved.</p><button class="n99-chip" onclick="cycleGym()">${esc(state.gym)} · switch gym</button><div class="n99-stack">${['FullA','FullB','FullC'].map(t=>N.button(`${N.label(t)} · ${N.templateFor(t).length} exercises`,`NXT.editTemplate('${t}')`,true)).join('')}</div><details><summary>Other saved routines</summary><div class="n99-stack">${['Push','Pull','Pump','Legs'].map(t=>N.button(N.label(t),`NXT.editTemplate('${t}')`,true)).join('')}</div></details>`)+`<details class="n99-card"><summary>Gym names & equipment</summary>${gymSettingsHTML()}</details>`+N.card('Programme defaults',`<p>Restore the A/B/C weekly rhythm or return to the weekly plan saved before this upgrade.</p><div class="n99-stack">${N.button('Use A/B/C weekly rhythm','NXT.restoreWeek(false)',true)}${N.button('Use my previous weekly plan','NXT.restoreWeek(true)',true)}</div>`);
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
    N.modal(N.label(d.type),`<p>${esc(d.gym)} · saved programme. Your current workout queue stays unchanged.</p><datalist id="n99-exercises">${v88AllExerciseNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist><div class="n99-stack">${d.rows.map((r,i)=>`<fieldset class="n99-template-row"><legend>Exercise ${i+1}</legend><label>Name<input id="n99-ex-${i}" list="n99-exercises" maxlength="100" value="${esc(r.name)}"></label><div class="n99-form-grid four"><label>Sets<input id="n99-sets-${i}" type="number" min="1" max="8" value="${r.sets}"></label><label>Min reps<input id="n99-lo-${i}" type="number" min="1" max="30" value="${r.reps[0]}"></label><label>Max reps<input id="n99-hi-${i}" type="number" min="1" max="30" value="${r.reps[1]}"></label><label>Step · kg<input id="n99-inc-${i}" type="number" min="0" max="25" step="0.25" value="${r.inc}"></label></div><div class="n99-row"><button class="n99-chip" ${i===0?'disabled':''} onclick="NXT.draftMove(${i},-1)">Move up</button><button class="n99-chip" ${i===d.rows.length-1?'disabled':''} onclick="NXT.draftMove(${i},1)">Move down</button><button class="n99-text" onclick="NXT.draftRemove(${i})">Remove</button></div></fieldset>`).join('')}</div><div class="n99-stack">${N.button('＋ Add exercise','NXT.draftAdd()',true)}${N.button('Save workout','NXT.saveTemplate()')}${N.button('Restore this workout’s defaults','NXT.defaultTemplate()',true)}</div>`);
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
    if(!saved?.data)return toast('No safety copy yet. Export your current full backup instead.');
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
    clearTimeout(cloudTimer);cloudUser=null;location.reload();
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
    settings.weeklyPlan={...N.split,...settings.weeklyPlan};
    state.dayType=N.typeFor(state.date);state.exercise=N.templateFor()[0]?.name||'';
    persist();
  }
  return {more,moreView,goalsHTML,saveGoal,programmeHTML,saveWeek,restoreWeek,editTemplate,captureDraft,drawTemplate,draftMove,draftRemove,draftAdd,validTemplate,saveTemplate,defaultTemplate,saveQueueAsTemplate,coachHTML,saveCardioGoal,history,exportSafety,restoreSafety,validateBackup,restoreData,resetData,install};
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
showSessionSheet=NXT.sessionPicker;
cycleDayType=NXT.sessionPicker;
showCardioSheet=NXT.cardioModal;
renderRest=NXT.recoveryDay;
apx96OpenReadiness=NXT.recoveryModal;
apx96SaveReadiness=NXT.saveRecovery;
readiness=function(){const r=NXT.cfg().recovery[state.date];if(r&&[r.sleep,r.energy,r.soreness].some(x=>x!==''&&x!==undefined&&x!==null)){state.read=r;return {...NXT.old.readiness(),known:true};}const head=document.getElementById('headScore');if(head){head.textContent='—';head.style.setProperty('--score',0);head.setAttribute('aria-label','No recovery check-in for today');}return {score:78,msg:'Check-in not logged',known:false};};
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
apx95OpenQuickWeight=function(){NXT.modal('Log bodyweight',`<form onsubmit="event.preventDefault();apx95SaveQuickWeight()"><div class="n99-form-grid"><label>Date<input id="apx95WeightDate" type="date" required max="${state.date}" value="${state.date}"></label><label>Weight · kg<input id="apx95WeightValue" type="number" min="20" max="400" step="0.1" inputmode="decimal" required></label></div><label>Timing<select id="apx95WeightTime"><option>Morning</option><option>Pre-workout</option><option>Post-workout</option><option>Night</option></select></label><p class="n99-small">Use similar conditions each time. The chart keeps the latest morning reading for each day when available; every original entry stays saved.</p><button type="submit" class="n99-button">Save weigh-in</button></form>`);};
apx95SaveQuickWeight=function(){const date=val('apx95WeightDate'),weight=NXT.finite(val('apx95WeightValue'));if(!Number.isFinite(NXT.dateMs(date))||date>state.date||weight===null||weight<20||weight>400)return toast('Enter a valid date and bodyweight.');state.bws.push({id:uid(),date,weight,timeOfDay:val('apx95WeightTime')||'Morning',ts:Date.now()});NXT.commit('Weigh-in saved');};
saveEditedSet=function(id){
  const row=(state.logs||[]).find(r=>r.id===id),weight=NXT.finite(val('editSetWeight')),reps=NXT.finite(val('editSetReps')),date=val('editSetDate'),number=NXT.finite(val('editSetNum'));
  if(!row||weight===null||weight<0||weight>1000||reps===null||reps<1||reps>100||!Number.isInteger(reps)||!Number.isFinite(NXT.dateMs(date))||date>state.date||number===null||number<1||!Number.isInteger(number))return toast('Check the weight, reps, set number and date.');
  Object.assign(row,{exercise:val('editSetExercise').trim()||row.exercise,weight,reps,date,setNum:number,notes:val('editSetNotes'),volume:Math.round(weight*reps)});NXT.commit('Set updated');
};
document.addEventListener('keydown',function(event){
  const modal=document.querySelector('.n99-modal');if(!modal)return;
  if(event.key==='Escape'){event.preventDefault();closeModal();return;}
  if(event.key!=='Tab')return;
  const focusable=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,a[href]')],first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
NXT.install();
document.title='NXTFRM — Your Cut Companion';
if(document.readyState!=='loading')NXT.repaint();
