/* ==========================================================================
   NXTFRM VNext prototype - "INSTRUMENT"
   Phase 1. Disposable. Reads design-vnext/data.js (engine-computed fixture).
   Nothing here touches production state.
   ========================================================================== */
(() => {
'use strict';
const D = window.NXD;

/* ---- exercise metadata: verbatim from production train-anatomy.js -------- */
const EX = {
  "Romanian Deadlift":        {p:["hamstrings"],s:["glutes","spinal_erectors"],eq:"Barbell"},
  "Lat Pulldown":             {p:["lats"],s:["biceps","upper_back"],eq:"Cable"},
  "Smith Machine Bench Press":{p:["chest"],s:["triceps","front_delts"],eq:"Smith machine"},
  "Leg Extension":            {p:["quads"],s:[],eq:"Machine"},
  "Reverse Fly":              {p:["rear_delts"],s:["upper_back"],eq:"Dumbbells"},
  "DB Preacher Curl":         {p:["biceps"],s:["forearms"],eq:"Dumbbells"},
  "Incline Dumbbell Press":   {p:["upper_chest"],s:["front_delts","triceps"],eq:"Dumbbells"},
  "Chest Supported T-Bar Row":{p:["lats"],s:["upper_back","biceps"],eq:"Machine"},
  "Leg Press":                {p:["quads"],s:["glutes","hamstrings"],eq:"Machine"},
  "Hamstring Curl":           {p:["hamstrings"],s:["calves"],eq:"Machine"},
  "Cable Lateral Raise":      {p:["side_delts"],s:["front_delts","traps"],eq:"Cable"},
  "Ab Crunch":                {p:["abs"],s:[],eq:"Machine"},
  "Machine Shoulder Press":   {p:["front_delts"],s:["triceps","side_delts"],eq:"Machine"},
  "Unilateral Seated Row":    {p:["lats"],s:["upper_back","biceps"],eq:"Cable"},
  "Tricep Pushdown":          {p:["triceps"],s:[],eq:"Cable"}
};
const MLAB = {chest:"Chest",upper_chest:"Upper chest",front_delts:"Front delts",side_delts:"Side delts",
  rear_delts:"Rear delts",lats:"Lats",upper_back:"Upper back",traps:"Traps",spinal_erectors:"Lower back",
  biceps:"Biceps",triceps:"Triceps",forearms:"Forearms",quads:"Quads",hamstrings:"Hamstrings",
  glutes:"Glutes",adductors:"Adductors",calves:"Calves",abs:"Abs",obliques:"Obliques"};
const MVIEW = {chest:"f",upper_chest:"f",front_delts:"f",side_delts:"f",biceps:"f",forearms:"f",
  quads:"f",adductors:"f",abs:"f",obliques:"f",rear_delts:"b",lats:"b",upper_back:"b",traps:"b",
  spinal_erectors:"b",triceps:"b",hamstrings:"b",glutes:"b",calves:"b"};

/* ---- 1. utilities ------------------------------------------------------- */
const $ = (s,r=document)=>r.querySelector(s);
const el = (h)=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild;};
const esc = s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const ms = d=>Date.parse(d+'T12:00:00Z');
const addD=(d,n)=>{const x=new Date(ms(d));x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const dow = d=>new Date(ms(d)).getUTCDay();
const fmtD=(d,o)=>new Date(ms(d)).toLocaleDateString('en-GB',{timeZone:'UTC',...o});
const n1 = v=>(Math.round(v*10)/10).toFixed(1);
const n2 = v=>(Math.round(v*100)/100).toFixed(2);
const signed=(v,p=2)=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(p);
const trimN=v=>{const n=Math.round(v*100)/100;return Number.isInteger(n)?String(n):String(n);};

const LABEL={FullA:'Full Body A',FullB:'Full Body B',FullC:'Full Body C',Zone2:'Zone 2',Rest:'Rest',Floorball:'Floorball',Cardio:'Cardio'};
const SHORT={FullA:'A',FullB:'B',FullC:'C',Zone2:'Z2',Rest:'—',Floorball:'FB'};
const label=t=>LABEL[t]||t;
const typeFor=d=>D.weekPlan[String(dow(d))];
const isLift=t=>['FullA','FullB','FullC'].includes(t);

/* ---- 2. derived selectors ---------------------------------------------- */
const TODAY = D.today;
const trendRows = D.trend;
const logsOn = d => D.logs.filter(l=>l.d===d);
const cardioOn= d => D.cardio.filter(c=>c.d===d);
const weightOn= d => trendRows.find(r=>r.d===d);
const postOn  = d => D.post.find(r=>r.d===d);

/* previous session of an exercise, strictly before `date` */
function prevSession(exName,date){
  const ds=[...new Set(D.logs.filter(l=>l.e===exName&&l.d<date).map(l=>l.d))].sort();
  const d=ds.at(-1); if(!d) return null;
  return {date:d,sets:D.logs.filter(l=>l.e===exName&&l.d===d&&l.st!=='warmup').sort((a,b)=>a.n-b.n)};
}
/* double progression: top of range on every set -> add increment */
function suggestLoad(exName,date,tpl){
  const p=prevSession(exName,date); if(!p||!p.sets.length) return null;
  const hit=p.sets.length>=tpl.sets && p.sets.slice(0,tpl.sets).every(s=>s.r>=tpl.reps[1]);
  return hit ? Math.round((p.sets[0].w+(tpl.inc||2.5))*10)/10 : p.sets[0].w;
}
const cardioWeekMin = ()=>{
  const start=addD(TODAY,-6);
  return D.cardio.filter(c=>c.d>=start&&c.d<=TODAY).reduce((a,c)=>a+(c.min||0),0);
};

/* ---- 3. app state ------------------------------------------------------- */
const S = {
  tab:'today',
  date:TODAY,
  restDemo:false,          // Today - rest day variant
  active:false,            // active workout mode
  exIdx:0,
  session:[],              // logged sets this session
  setType:'working',
  rir:2,
  rest:null,               // {left,total,timer}
  histDate:addD(TODAY,-2),
  range:'12W',
  showPost:false,
  showProj:false,
  scrubIdx:null,
  weightView:'recent'
};
const view=$('#view'), navEl=$('#nav'), overlay=$('#overlay');

/* ---- 4. icons ----------------------------------------------------------- */
const I={
  today:'<path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M8 3v4M16 3v4M4 11h16"/>',
  train:'<path d="M3 10v4M21 10v4M6.5 7v10M17.5 7v10M6.5 12h11"/>',
  prog :'<path d="M4 18l5-6 4 3 6.5-8"/><path d="M20 7h-4M20 7v4"/>',
  hist :'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  more :'<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>'
};
const icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

/* ---- 5. navigation ------------------------------------------------------ */
const TABS=[['today','Today','today'],['train','Train','train'],['progress','Progress','prog'],['history','History','hist'],['more','More','more']];
function renderNav(){
  navEl.className='nav'+(S.active?' hidden':'');
  navEl.innerHTML=TABS.map(([id,txt,ic])=>
    `<button type="button" data-tab="${id}" ${S.tab===id?'aria-current="page"':''}>${icon(ic)}<span>${txt}</span></button>`).join('');
}
navEl.addEventListener('click',e=>{
  const b=e.target.closest('[data-tab]'); if(!b) return;
  go(b.dataset.tab);
});
function go(tab){
  if(S.tab===tab&&!S.active) return;
  S.tab=tab; S.active=false; render();
}

/* ---- 6. render root ----------------------------------------------------- */
function render(){
  const scr = S.tab==='today'   ? screenToday()
            : S.tab==='train'   ? (S.active?screenActive():screenTrainIdle())
            : S.tab==='progress'? screenWeight()
            : S.tab==='history' ? screenHistory()
            :                     screenMore();
  view.innerHTML='';
  view.appendChild(scr);
  scr.classList.add('enter');
  renderNav();
  window.scrollTo?.(0,0);
  if(S.tab==='progress') mountChart();
}

/* ============================================================
   TODAY  -  contextual command surface
   Protagonist: the decision, then the one action that follows it.
   ============================================================ */
function decision(){
  const p=D.plateau, f=D.forecast;
  if(S.restDemo) return {
    tone:'ok', verdict:'Nothing needs changing',
    line:`Weight is moving at ${n2(Math.abs(p.weeklyRate))} kg/week. Performance is holding. Today is a planned rest day.`,
    ev:[['Trend',signed(p.weeklyRate)+' kg/wk'],['Confidence',p.confidence]]
  };
  return {
    tone:'ok', verdict:'Hold the plan',
    line:`Weight is moving at ${n2(Math.abs(p.weeklyRate))} kg/week and performance is holding. No change is warranted.`,
    ev:[['Trend',signed(p.weeklyRate)+' kg/wk'],['Confidence',p.confidence]]
  };
}

function screenToday(){
  const date = S.restDemo ? nextDow(0) : TODAY;
  const type = S.restDemo ? 'Rest' : D.dayTypeToday;
  const d = decision();
  const w = trendRows.at(-1);
  const perf = perfLabel();
  const cw = cardioWeekMin(), ct = D.settings.zone2Target;
  const tpl = isLift(type) ? D.templates[type] : null;
  const sets = tpl ? tpl.reduce((a,e)=>a+e.sets,0) : 0;

  const s=el(`<main class="screen" id="scr"></main>`);
  s.innerHTML=`
  <div class="pad">
    <div class="spread" style="padding-block:var(--s3) var(--s5)">
      <div>
        <p class="eyebrow">${esc(fmtD(date,{weekday:'long'}))}</p>
        <h1 class="h-page mt1">${esc(fmtD(date,{day:'numeric',month:'long'}))}</h1>
      </div>
      ${isLift(type)?'<button type="button" class="act-text mute" data-sheet="gym">Gym A ›</button>':''}
    </div>

    <!-- THE one surface on this screen -->
    <section class="surface focal" aria-labelledby="dec-h">
      <p class="eyebrow">NXTFRM decision</p>
      <h2 class="h-sub mt2" id="dec-h" style="font-size:20px">${esc(d.verdict)}</h2>
      <p class="body mt2" style="font-size:14.5px">${esc(d.line)}</p>
      <div class="hstack mt4" style="gap:var(--s5);flex-wrap:wrap">
        ${d.ev.map(([k,v])=>`<span class="tiny"><span style="color:var(--ink-4)">${esc(k)}</span>
          <b style="color:var(--ink-2);font-weight:600;margin-left:5px" class="num">${esc(v)}</b></span>`).join('')}
      </div>
      <button type="button" class="act-text mt3" data-sheet="why">Why this call ›</button>
    </section>
  </div>

  ${ isLift(type) ? `
  <div class="pad section">
    <div class="sect-head">
      <p class="h-sect">Today’s training</p>
      <button type="button" class="act-text mute" data-sheet="session">Change</button>
    </div>
    <h2 class="h-sub" style="font-size:21px">${esc(label(type))}</h2>
    <p class="meta mt1">${tpl.length} exercises · ${sets} working sets · Gym A</p>
    <button type="button" class="act mt4" data-act="start">Start workout</button>
    <p class="meta mt3">Last ${esc(label(type))} · ${esc(lastOf(type))}</p>
  </div>` : `
  <div class="pad section">
    <div class="sect-head"><p class="h-sect">Today</p>
      <button type="button" class="act-text mute" data-sheet="session">Change</button></div>
    <h2 class="h-sub" style="font-size:21px">Rest</h2>
    <p class="body mt2" style="font-size:14.5px">A planned recovery day. Nothing is scheduled.</p>
    <div class="rows mt4">
      ${(()=>{const r=weightOn(date);return `<button type="button" class="row" data-act="weigh">
        <span class="row-l"><span class="row-t">Morning weight</span>
        <span class="row-s">${r?`Logged · ${n1(r.w)} kg`:'Not logged yet'}</span></span>
        ${r?'':'<span class="row-v" style="color:var(--violet-lift);font-weight:540">Log</span>'}
        <span class="chev">›</span></button>`;})()}
      <button type="button" class="row" data-act="addon">
        <span class="row-l"><span class="row-t">Add optional lifting</span>
        <span class="row-s">Kept as an add-on — today stays a rest day</span></span>
        <span class="chev">›</span></button>
    </div>
    <p class="meta mt5">Next session · ${esc(label(typeFor(addD(date,1))))} tomorrow</p>
  </div>`}

  <!-- Evidence: rows, not cards. Conclusions only; Progress holds the charts. -->
  <div class="pad section">
    <p class="h-sect" style="margin-bottom:var(--s3)">Current state</p>
    <div class="rows">
      <button type="button" class="row" data-act="toweight">
        <span class="row-l"><span class="row-t">Weight</span>
          <span class="row-s">7-day mean ${n2(D.stats.curAvg)} kg</span></span>
        <span class="row-v num">${signed(D.stats.change)} <span style="color:var(--ink-3);font-weight:500">kg/wk</span></span>
        <span class="chev">›</span></button>
      <button type="button" class="row" data-act="toperf">
        <span class="row-l"><span class="row-t">Performance</span>
          <span class="row-s">${D.strength.length} lifts with recent history</span></span>
        <span class="row-v"><span class="status ${perf.tone}"><i class="dot"></i>${esc(perf.text)}</span></span>
        <span class="chev">›</span></button>
      <div class="row">
        <span class="row-l"><span class="row-t">Cardio</span>
          <span class="row-s">This week</span></span>
        <span class="row-v num">${cw} <span style="color:var(--ink-3);font-weight:500">/ ${ct} min</span></span>
      </div>
    </div>
  </div>

  <div class="pad section">
    <div class="sect-head"><p class="h-sect">Your week</p>
      <span class="tiny">${D.completedWeek} lifting ${D.completedWeek===1?'day':'days'} logged</span></div>
    ${weekStrip(date)}
  </div>

  <div class="pad" style="padding-block:var(--s5)">
    <div class="hstack" style="gap:var(--s6)">
      <button type="button" class="act-text" data-act="weigh">+ Weight</button>
      <button type="button" class="act-text" data-act="cardio">Log cardio</button>
      <button type="button" class="act-text" data-act="checkin">Check-in</button>
    </div>
  </div>`;
  return s;
}
function nextDow(target){let d=TODAY;for(let i=0;i<8;i++){if(dow(d)===target)return d;d=addD(d,1);}return TODAY;}
function lastOf(type){
  const ds=[...new Set(D.logs.filter(l=>l.t===type).map(l=>l.d))].sort();
  return ds.length?fmtD(ds.at(-1),{day:'numeric',month:'short'}):'no history yet';
}
function perfLabel(){
  const it=D.strength; if(!it.length) return {text:'Building',tone:'neutral'};
  const rev=it.filter(x=>x.status==='Review').length;
  if(rev>=2) return {text:'Review',tone:'review'};
  if(it.some(x=>x.status==='Improving')) return {text:'Improving',tone:'ok'};
  return {text:'Holding',tone:'ok'};
}
function weekStrip(date){
  const start=addD(date,-dow(date));
  let out='<div class="cal" style="gap:3px">';
  for(let i=0;i<7;i++){
    const d=addD(start,i), t=typeFor(d), sel=d===date;
    const has=logsOn(d).length>0;
    out+=`<div class="cal-c ${sel?'':''}" ${sel?'aria-selected="true"':''} style="cursor:default;gap:5px">
      <span style="font-size:10px;color:var(--ink-4);font-weight:600">${fmtD(d,{weekday:'narrow'})}</span>
      <span style="font-size:12.5px;font-weight:${isLift(t)?'640':'500'};color:${isLift(t)?'var(--ink)':'var(--ink-3)'}">${SHORT[t]||'·'}</span>
      <span class="cal-marks">${has?'<i class="m-lift"></i>':''}</span>
    </div>`;
  }
  return out+'</div>';
}

/* ============================================================
   TRAIN  -  idle + ACTIVE WORKOUT MODE
   ============================================================ */
function sessionPlan(){ return D.templates[D.dayTypeToday]; }

function screenTrainIdle(){
  const tpl=sessionPlan(), type=D.dayTypeToday;
  const s=el('<main class="screen"></main>');
  s.innerHTML=`
  <div class="pad">
    <div class="spread" style="padding-block:var(--s3) var(--s5)">
      <div><p class="eyebrow">${esc(fmtD(TODAY,{weekday:'long',day:'numeric',month:'short'}))}</p>
        <h1 class="h-page mt1">${esc(label(type))}</h1></div>
      <button type="button" class="act-text mute" data-sheet="session">Change</button>
    </div>
    <section class="surface">
      <p class="eyebrow">Ready</p>
      <p class="body mt2" style="font-size:14.5px;color:var(--ink)">${tpl.length} exercises · ${tpl.reduce((a,e)=>a+e.sets,0)} working sets</p>
      <button type="button" class="act mt4" data-act="start">Start workout</button>
    </section>
    <div class="section">
      <p class="h-sect" style="margin-bottom:var(--s3)">Session plan</p>
      <div class="rows">${tpl.map((e,i)=>{
        const sug=suggestLoad(e.name,TODAY,e), p=prevSession(e.name,TODAY);
        return `<div class="row"><span class="row-l">
          <span class="row-t">${esc(e.name)}</span>
          <span class="row-s">${e.sets} × ${e.reps[0]}–${e.reps[1]}${p?` · last ${trimN(p.sets[0].w)} kg`:' · no history'}</span></span>
          ${sug?`<span class="row-v num" style="color:var(--ink-2);font-weight:560">${trimN(sug)} kg</span>`:''}</div>`;
      }).join('')}</div>
    </div>
  </div>`;
  return s;
}

function startWorkout(){
  S.active=true; S.tab='train'; S.exIdx=0; S.session=[]; S.setType='working'; S.rir=2;
  render();
}

function screenActive(){
  const tpl=sessionPlan(), ex=tpl[S.exIdx], meta=EX[ex.name]||{p:[],s:[],eq:''};
  const done=S.session.filter(x=>x.e===ex.name&&x.st==='working').length;
  const prev=prevSession(ex.name,TODAY);
  const sug=suggestLoad(ex.name,TODAY,ex);
  const totalSets=tpl.reduce((a,e)=>a+e.sets,0);
  const doneAll=S.session.filter(x=>x.st==='working').length;

  const s=el('<main class="screen no-nav"></main>');
  s.innerHTML=`
  <div class="train-top">
    <button type="button" class="act-icon" data-act="exit" aria-label="Leave workout">✕</button>
    <div class="grow" style="text-align:center">
      <p class="eyebrow" style="font-size:10.5px">${esc(label(D.dayTypeToday))} · Gym A</p>
      <p class="tiny mt1" style="color:var(--ink-3)">${doneAll} of ${totalSets} working sets</p>
    </div>
    <button type="button" class="act-icon" data-act="finish" aria-label="Finish workout">✓</button>
  </div>

  <div class="sessbar" role="img" aria-label="Session progress: exercise ${S.exIdx+1} of ${tpl.length}">
    ${tpl.map((e,i)=>{
      const d=S.session.filter(x=>x.e===e.name&&x.st==='working').length;
      const cls=i<S.exIdx||d>=e.sets?'done':i===S.exIdx?'cur':'';
      return `<i class="${cls}" style="--p:${i===S.exIdx?Math.round(d/e.sets*100):0}%"></i>`;
    }).join('')}
  </div>

  <div class="set-stage">
    <div class="hstack" style="align-items:flex-start;gap:var(--s4)">
      <div class="grow">
        <p class="eyebrow">Exercise ${S.exIdx+1} of ${tpl.length}</p>
        <h1 class="ex-name mt2">${esc(ex.name)}</h1>
        <p class="meta mt2">${meta.p.map(m=>MLAB[m]).join(' · ')}${meta.s.length?' · <span style="color:var(--ink-4)">'+meta.s.map(m=>MLAB[m]).join(' · ')+'</span>':''}</p>
      </div>
      <button type="button" class="act-icon" data-sheet="exdetail" aria-label="Exercise details" style="width:auto;height:auto;margin:0;padding:0">
        ${anatomySVG(meta.p,meta.s,64)}
      </button>
    </div>

    <div class="aim mt5 wrap3">
      <div><span class="metric-l">Last</span>
        <b class="num">${prev?`${trimN(prev.sets[0].w)}<em>kg</em> × ${prev.sets[0].r}`:'—'}</b>
        <small>${prev?fmtD(prev.date,{day:'numeric',month:'short'}):'No history'}</small></div>
      <div><span class="metric-l">Target</span>
        <b class="num">${ex.reps[0]}–${ex.reps[1]}</b><small>reps · ${ex.sets} sets</small></div>
      <div><span class="metric-l">Rest</span>
        <b class="num">${restFor(ex)}</b><small>planned</small></div>
    </div>

    ${setHistory(ex)}
  </div>

  ${S.rest?restStrip():''}

  <div class="set-stage" style="padding-top:var(--s5)">
    <div class="hstack" style="gap:var(--s3);align-items:flex-end">
      <div class="grow">
        <label class="f-lab" for="wIn">Weight</label>
        <div class="stepper">
          <button type="button" data-step="w,-2.5" aria-label="Decrease weight">−</button>
          <div class="field"><input id="wIn" type="number" inputmode="decimal" step="0.5"
            value="${sug!=null?trimN(sug):''}" placeholder="0" aria-label="Weight in kilograms"><span class="unit">kg</span></div>
          <button type="button" data-step="w,2.5" aria-label="Increase weight">+</button>
        </div>
      </div>
    </div>
    <div class="hstack mt4" style="gap:var(--s3);align-items:flex-end">
      <div class="grow">
        <label class="f-lab" for="rIn">Reps</label>
        <div class="stepper">
          <button type="button" data-step="r,-1" aria-label="Decrease reps">−</button>
          <div class="field"><input id="rIn" type="number" inputmode="numeric" step="1"
            value="${prev?prev.sets[Math.min(done,prev.sets.length-1)].r:ex.reps[1]}" placeholder="0" aria-label="Reps"></div>
          <button type="button" data-step="r,1" aria-label="Increase reps">+</button>
        </div>
      </div>
    </div>

    <div class="hstack mt5" style="gap:var(--s4);align-items:flex-start">
      <div class="grow"><span class="f-lab">Set type</span>
        <div class="seg" data-seg="type" role="group" aria-label="Set type">
          <button type="button" data-v="working" aria-pressed="${S.setType==='working'}">Working</button>
          <button type="button" data-v="warmup"  aria-pressed="${S.setType==='warmup'}">Warm-up</button>
        </div></div>
    </div>
    <div class="mt4"><span class="f-lab">Reps in reserve <span style="color:var(--ink-4);text-transform:none;letter-spacing:0;font-weight:500">optional</span></span>
      <div class="seg" data-seg="rir" role="group" aria-label="Reps in reserve">
        ${[0,1,2,3,4].map(v=>`<button type="button" data-v="${v}" aria-pressed="${S.rir===v}">${v===4?'4+':v}</button>`).join('')}
      </div></div>

    <button type="button" class="act mt5" data-act="log">
      ${S.setType==='warmup'?'Log warm-up':`Log set ${done+1}`}
    </button>

    <div class="spread mt5" style="padding-bottom:var(--s6)">
      <button type="button" class="act-text mute" data-act="prev" ${S.exIdx===0?'disabled style="opacity:.35"':''}>‹ Prev</button>
      <button type="button" class="act-text" data-sheet="queue">Queue · ${S.exIdx+1}/${tpl.length}</button>
      <button type="button" class="act-text mute" data-act="next" ${S.exIdx===tpl.length-1?'disabled style="opacity:.35"':''}>Next ›</button>
    </div>
  </div>`;
  return s;
}
function restFor(ex){ return ex.sets>=3?'2:30':'1:30'; }
function restSecs(ex){ return ex.sets>=3?150:90; }

function setHistory(ex){
  const rows=S.session.filter(x=>x.e===ex.name);
  if(!rows.length) return '';
  return `<div class="setlog mt5">${rows.map((r,i)=>`
    <div class="setrow ${r.st==='warmup'?'warm':''} ${r.fresh?'fresh':''}">
      <span class="n">${r.st==='warmup'?'W':r.i}</span>
      <b>${trimN(r.w)} kg × ${r.r}</b>
      ${r.rir!=null&&r.st==='working'?`<span class="rir">RIR ${r.rir}</span>`:''}
    </div>`).join('')}</div>`;
}
function restStrip(){
  const {left,total}=S.rest;
  const mm=Math.floor(left/60), ss=String(left%60).padStart(2,'0');
  return `<div class="rest mt5" role="timer" aria-live="off">
    <span class="t num">${mm}:${ss}</span>
    <span class="bar"><i style="transform:scaleX(${left/total})"></i></span>
    <button type="button" class="act-text mute" data-act="rest30">+30s</button>
    <button type="button" class="act-text mute" data-act="restskip">Skip</button>
  </div>`;
}

/* --- logging: the motion that matters most ------------------------------- */
function logSet(){
  const tpl=sessionPlan(), ex=tpl[S.exIdx];
  const w=parseFloat($('#wIn').value), r=parseInt($('#rIn').value,10);
  if(!(w>=0)||!(r>=1)) return toast('Enter a weight and whole-number reps.');
  const done=S.session.filter(x=>x.e===ex.name&&x.st==='working').length;
  S.session.forEach(x=>x.fresh=false);
  S.session.push({e:ex.name,w,r,rir:S.setType==='working'?S.rir:null,st:S.setType,i:done+1,fresh:true});
  if(S.setType==='working'){
    S.rest={left:restSecs(ex),total:restSecs(ex)};
    startRest();
  }
  // auto-advance when the planned sets for this exercise are complete
  const after=S.session.filter(x=>x.e===ex.name&&x.st==='working').length;
  if(S.setType==='working'&&after>=ex.sets&&S.exIdx<tpl.length-1) S.exIdx++;
  render();
  if(navigator.vibrate) navigator.vibrate(12);
}
let restTimer=null;
function startRest(){
  clearInterval(restTimer);
  restTimer=setInterval(()=>{
    if(!S.rest){clearInterval(restTimer);return;}
    S.rest.left--;
    if(S.rest.left<=0){S.rest=null;clearInterval(restTimer);render();return;}
    const st=$('.rest'); if(!st) return;
    const {left,total}=S.rest;
    st.querySelector('.t').textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
    st.querySelector('.bar i').style.transform=`scaleX(${left/total})`;
  },1000);
}

/* --- completion recap: real outcomes only -------------------------------- */
function finishWorkout(){
  const work=S.session.filter(x=>x.st==='working');
  if(!work.length){ closeSheet(); S.active=false; render(); return; }
  // compare each exercise's best working set against its previous session
  let up=0,same=0,down=0;
  const byEx={};
  work.forEach(x=>{(byEx[x.e]=byEx[x.e]||[]).push(x);});
  Object.entries(byEx).forEach(([name,sets])=>{
    const p=prevSession(name,TODAY);
    const best=Math.max(...sets.map(s=>s.w*s.r));
    if(!p){same+=sets.length;return;}
    const pbest=Math.max(...p.sets.map(s=>s.w*s.r));
    sets.forEach(()=>{ if(best>pbest*1.005)up++; else if(best<pbest*0.995)down++; else same++; });
  });
  openSheet('Session complete',`
    <p class="body" style="font-size:14.5px">${esc(label(D.dayTypeToday))} · Gym A · ${esc(fmtD(TODAY,{day:'numeric',month:'short'}))}</p>
    <div class="mt5"><span class="metric-l">Working sets</span>
      <div class="metric-v num mt1">${work.length}</div></div>
    <div class="rows mt5">
      <div class="row"><span class="row-l"><span class="row-t">Progressed</span></span><span class="row-v num">${up}</span></div>
      <div class="row"><span class="row-l"><span class="row-t">Maintained</span></span><span class="row-v num">${same}</span></div>
      <div class="row"><span class="row-l"><span class="row-t">Below recent</span></span><span class="row-v num">${down}</span></div>
    </div>
    <div class="rows mt4">
      <div class="row"><span class="row-l"><span class="row-t">Performance</span>
        <span class="row-s">Across lifts with recent history</span></span>
        <span class="row-v"><span class="status ok"><i class="dot"></i>Holding</span></span></div>
      <div class="row"><span class="row-l"><span class="row-t">Next</span>
        <span class="row-s">${esc(fmtD(addD(TODAY,1),{weekday:'long'}))}</span></span>
        <span class="row-v">${esc(label(typeFor(addD(TODAY,1))))}</span></div>
    </div>
    <button type="button" class="act mt6" data-act="done">Done</button>
  `,()=>{S.active=false;S.tab='today';render();});
}

/* ============================================================
   PROGRESS - WEIGHT  (flagship)
   Two representations, deliberately separate:
     1. RECENT TRAJECTORY - "which way am I going now?"  goal EXCLUDED from domain
     2. JOURNEY           - "how far through the cut am I?"  not a time-series
   ============================================================ */
const RANGES={'4W':28,'12W':84,'6M':182,'1Y':365,'All':null};
function rangeRows(){
  const days=RANGES[S.range];
  const first=days?addD(TODAY,-(days-1)):trendRows[0].d;
  return trendRows.filter(r=>r.d>=first);
}
function rangeAvailable(k){
  const days=RANGES[k]; if(!days) return true;
  const span=(ms(TODAY)-ms(trendRows[0].d))/86400000;
  return span>=days*0.6;
}

function screenWeight(){
  const s=el('<main class="screen"></main>');
  const p=D.plateau, f=D.forecast;
  s.innerHTML=`
  <div class="pad">
    <div class="spread" style="padding-block:var(--s3) var(--s4)">
      <h1 class="h-page">Progress</h1>
      <button type="button" class="act-text" data-act="weigh">+ Weight</button>
    </div>
    <div class="seg" data-seg="pview" role="tablist" aria-label="Progress area" style="margin-bottom:var(--s5)">
      <button type="button" data-v="weight" aria-selected="true" role="tab">Weight</button>
      <button type="button" data-v="perf" aria-selected="false" role="tab">Performance</button>
      <button type="button" data-v="body" aria-selected="false" role="tab">Body</button>
    </div>
  </div>

  <!-- Question first, then the conclusion, then the evidence. -->
  <div class="pad">
    <p class="h-sect">Is the cut working?</p>
    <h2 class="h-sub mt2" style="font-size:19px">Yes — losing ${n2(Math.abs(p.weeklyRate))} kg per week.</h2>
    <p class="meta mt2">${esc(p.reason)} Confidence ${esc(p.confidence)}, from ${p.n} readings over ${p.windowDays} days.</p>
  </div>

  <!-- stable metric header: updated by scrubbing, never moves -->
  <div class="pad mt5" id="mhead"></div>

  <div class="pad mt4">
    <div class="seg" data-seg="range" role="group" aria-label="Date range">
      ${Object.keys(RANGES).map(k=>{
        const ok=rangeAvailable(k);
        return `<button type="button" data-v="${k}" aria-pressed="${S.range===k}" ${ok?'':'disabled aria-disabled="true"'} ${ok?'':'title="Not enough history yet"'}>${k}</button>`;
      }).join('')}
    </div>
  </div>

  <div class="chart-wrap mt4" id="chart"></div>

  <div class="pad">
    <div class="legend" id="legend"></div>
    <p class="tiny mt3" id="csum" style="color:var(--ink-4)"></p>
    <div class="hstack mt4" style="gap:var(--s2);flex-wrap:wrap">
      <button type="button" class="tog" data-tog="post" aria-pressed="${S.showPost}">
        <span class="box" aria-hidden="true">✓</span>Post-workout
        <svg class="key" width="10" height="10" aria-hidden="true"><path d="M5 1.2L8.8 5L5 8.8L1.2 5Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
      <button type="button" class="tog" data-tog="proj" aria-pressed="${S.showProj}">
        <span class="box" aria-hidden="true">✓</span>Projection
        <svg class="key" width="14" height="10" aria-hidden="true"><line x1="0" y1="5" x2="14" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/></svg></button>
    </div>
  </div>

  <!-- JOURNEY: separate representation, so a distant goal never touches the chart above -->
  <div class="pad section">
    <div class="sect-head"><p class="h-sect">Cut journey</p>
      <span class="tiny">${esc(fmtD(trendRows[0].d,{day:'numeric',month:'short'}))} → now</span></div>
    ${journeyRail()}
  </div>

  <div class="pad section">
    <p class="h-sect" style="margin-bottom:var(--s3)">Evidence</p>
    <div class="rows">
      <div class="row"><span class="row-l"><span class="row-t">Weekly rate</span>
        <span class="row-s">28-day window · 95% range ${signed(p.upper)} to ${signed(p.lower)}</span></span>
        <span class="row-v num">${signed(p.weeklyRate)} kg</span></div>
      <div class="row"><span class="row-l"><span class="row-t">Plateau</span>
        <span class="row-s">${esc(p.reason)}</span></span>
        <span class="row-v"><span class="status ok"><i class="dot"></i>None</span></span></div>
      <div class="row"><span class="row-l"><span class="row-t">Projection</span>
        <span class="row-s">Model estimate, not a measurement</span></span>
        <span class="row-v">${f.weeks} wk <span style="color:var(--ink-3);font-weight:500">(${f.lowWeeks}–${f.highWeeks})</span></span></div>
      <div class="row"><span class="row-l"><span class="row-t">Confidence</span>
        <span class="row-s">Reading coverage and consistency</span></span>
        <span class="row-v" style="text-transform:capitalize">${esc(p.confidence)}</span></div>
    </div>
    <button type="button" class="act-text mt4" data-sheet="why">Why NXTFRM says this ›</button>
  </div>

  <div class="pad section" style="padding-bottom:var(--s8)">
    <button type="button" class="row" data-sheet="weighins" style="padding-block:var(--s2)">
      <span class="row-l"><span class="row-t">All weigh-ins</span>
      <span class="row-s">${trendRows.length} readings</span></span><span class="chev">›</span></button>
  </div>`;
  return s;
}

function journeyRail(){
  const st=D.settings.startWeight, lo=D.settings.targetLow, hi=D.settings.targetHigh;
  const cur=D.plateau.lastAvg;
  /* Reads left -> right as start -> goal, matching the sentence beneath it.
     This rail is the ONLY place the distant goal appears, which is exactly why
     the recent-trajectory chart above can keep a tight, honest y-domain. */
  const min=lo-1.2, max=st+0.6, span=max-min;
  const px=v=>((max-v)/span)*100;
  const done=st-cur, total=st-hi;
  return `
  <div>
    <div class="spread" style="align-items:flex-end">
      <div><span class="metric-l">Down</span><div class="metric-v num mt1" style="font-size:30px">${n1(done)}<em>kg</em></div></div>
      <div style="text-align:right"><span class="metric-l">To goal range</span>
        <div class="h-sub num mt1" style="font-size:18px;color:var(--ink-2)">${n1(Math.max(0,cur-hi))} kg</div></div>
    </div>
    <div style="position:relative;height:34px;margin-top:var(--s4)">
      <!-- track -->
      <div style="position:absolute;top:13px;left:0;right:0;height:4px;border-radius:2px;background:rgba(255,255,255,.07)"></div>
      <!-- target band -->
      <div style="position:absolute;top:8px;left:${px(hi)}%;width:${px(lo)-px(hi)}%;height:14px;border-radius:3px;
        background:var(--violet-dim);box-shadow:inset 0 0 0 1px var(--violet-line)"></div>
      <!-- travelled so far -->
      <div style="position:absolute;top:13px;left:${px(st)}%;width:${px(cur)-px(st)}%;height:4px;border-radius:2px;background:var(--c-raw)"></div>
      <!-- current -->
      <div style="position:absolute;top:8px;left:${px(cur)}%;transform:translateX(-50%);width:14px;height:14px;border-radius:50%;
        background:var(--violet);box-shadow:0 0 0 3px var(--canvas)"></div>
    </div>
    <div class="spread mt2">
      <span class="tiny">Start ${n1(st)}</span>
      <span class="tiny" style="color:var(--violet-lift)">Now ${n1(cur)}</span>
      <span class="tiny">Goal ${lo}–${hi}</span>
    </div>
    <p class="tiny mt3">Elapsed ${Math.round((ms(TODAY)-ms(trendRows[0].d))/86400000)} days. A weight range alone does not measure leanness.</p>
  </div>`;
}

/* ---- chart: measured render, true 320 behaviour ------------------------- */
let chartState=null;
function mountChart(){
  const host=$('#chart'); if(!host) return;
  drawChart();
  const ro=new ResizeObserver(()=>drawChart()); ro.observe(host);
  // scrub
  let dragging=false;
  const pick=e=>{
    const r=host.getBoundingClientRect();
    const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
    const g=chartState; if(!g) return;
    let best=0,bd=1e9;
    g.pts.forEach((p,i)=>{const d=Math.abs(p.x-x);if(d<bd){bd=d;best=i;}});
    if(S.scrubIdx!==best){S.scrubIdx=best;drawChart();if(navigator.vibrate)navigator.vibrate(4);}
  };
  host.addEventListener('pointerdown',e=>{dragging=true;host.setPointerCapture(e.pointerId);pick(e);});
  host.addEventListener('pointermove',e=>{if(dragging)pick(e);});
  host.addEventListener('pointerup',()=>{dragging=false;});
  host.addEventListener('pointercancel',()=>{dragging=false;});
  // keyboard access to the same selection
  host.tabIndex=0; host.setAttribute('role','application');
  host.setAttribute('aria-label','Weight trend chart. Use left and right arrow keys to inspect readings.');
  host.addEventListener('keydown',e=>{
    if(!chartState) return;
    const n=chartState.pts.length;
    if(e.key==='ArrowRight'){S.scrubIdx=Math.min(n-1,(S.scrubIdx??n-1)+1);drawChart();e.preventDefault();}
    if(e.key==='ArrowLeft'){S.scrubIdx=Math.max(0,(S.scrubIdx??n-1)-1);drawChart();e.preventDefault();}
    if(e.key==='Escape'){S.scrubIdx=null;drawChart();}
  });
}

function drawChart(){
  const host=$('#chart'); if(!host) return;
  const W=host.clientWidth||340;
  const narrow=W<340;
  const H=Math.round(Math.min(230,Math.max(180,W*0.56)));
  const L=narrow?30:36, R=12, T=10, B=26;
  const rows=rangeRows();
  const post=S.showPost?D.post.filter(r=>r.d>=rows[0].d):[];

  /* DOMAIN: visible morning readings + trend ONLY.
     The goal and the long-term journey are deliberately excluded - that is the
     whole point of splitting them onto separate representations. */
  const vals=[];
  rows.forEach(r=>{vals.push(r.w); if(r.a!=null)vals.push(r.a);});
  post.forEach(r=>vals.push(r.w));
  let lo=Math.min(...vals), hi=Math.max(...vals);
  const span=Math.max(0.8,hi-lo);
  const step=span<=2?0.5:span<=5?1:span<=12?2:5;
  lo=Math.floor((lo-span*0.12)/step)*step;
  hi=Math.ceil((hi+span*0.12)/step)*step;

  const first=ms(rows[0].d), last=ms(TODAY);
  const projDays=S.showProj?D.forecast.weeks*7:0;
  const end=last+projDays*86400000;
  const x=d=>L+(ms(d)-first)/Math.max(1,end-first)*(W-L-R);
  const xm=m=>L+(m-first)/Math.max(1,end-first)*(W-L-R);
  const y=v=>T+(hi-v)/(hi-lo)*(H-T-B);

  const pts=rows.map(r=>({...r,x:x(r.d),y:y(r.w),ay:r.a!=null?y(r.a):null}));
  const tr=pts.filter(p=>p.ay!=null);
  const line=tr.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.ay.toFixed(1)).join(' ');
  const area=tr.length?`${line} L${tr.at(-1).x.toFixed(1)} ${(H-B)} L${tr[0].x.toFixed(1)} ${(H-B)} Z`:'';

  // y ticks
  const ticks=[]; for(let v=lo;v<=hi+1e-9;v+=step) ticks.push(v);

  // x labels - fewer at 320
  const nLab=narrow?2:3;
  const labIdx=Array.from({length:nLab},(_,i)=>Math.round(i*(rows.length-1)/(nLab-1)));

  // projection
  let projPath='';
  if(S.showProj&&tr.length){
    const f=D.forecast, s=tr.at(-1);
    const tx=xm(last+f.weeks*7*86400000), ty=y(Math.max(lo,D.settings.targetHigh));
    projPath=`M${s.x.toFixed(1)} ${s.ay.toFixed(1)} L${tx.toFixed(1)} ${ty.toFixed(1)}`;
  }

  const si=S.scrubIdx==null?pts.length-1:Math.min(S.scrubIdx,pts.length-1);
  const sp=pts[si];

  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
      aria-label="Morning weight, ${S.range}. Trend ${signed(D.plateau.weeklyRate)} kilograms per week.">
    <defs><linearGradient id="tg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#8B5CF6" stop-opacity=".16"/>
      <stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(v=>`<line class="gridline" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`).join('')}
    ${ticks.map(v=>`<text class="axis-t" x="${L-7}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end">${step<1?v.toFixed(1):v}</text>`).join('')}
    ${labIdx.map(i=>`<text class="axis-t" x="${pts[i].x.toFixed(1)}" y="${H-8}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${fmtD(rows[i].d,{day:'numeric',month:'short'})}</text>`).join('')}
    ${area?`<path class="trend-area" d="${area}"/>`:''}
    ${projPath?`<path class="proj-line" d="${projPath}"/>`:''}
    ${pts.map(p=>`<circle class="raw-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.1"/>`).join('')}
    ${post.map(r=>{const px=x(r.d),py=y(r.w);
      return `<path class="post-mark" d="M${px} ${py-3.4}L${px+3.4} ${py}L${px} ${py+3.4}L${px-3.4} ${py}Z"/>`;}).join('')}
    ${line?`<path class="trend-line" d="${line}"/>`:''}
    ${sp?`<line class="sel-rule" x1="${sp.x.toFixed(1)}" x2="${sp.x.toFixed(1)}" y1="${T}" y2="${H-B}"/>
        <circle class="sel-dot" cx="${sp.x.toFixed(1)}" cy="${(sp.ay??sp.y).toFixed(1)}" r="5"/>`:''}
  </svg>`;
  chartState={pts};

  // stable metric header - the value lives OUTSIDE the plot and never moves
  const mh=$('#mhead');
  if(mh&&sp){
    mh.innerHTML=`
      <div class="spread" style="align-items:flex-end">
        <div>
          <span class="metric-l">${S.scrubIdx==null?'Latest morning':esc(fmtD(sp.d,{weekday:'short',day:'numeric',month:'short'}))}</span>
          <div class="metric-v num mt1 vswap" key="${sp.d}">${n1(sp.w)}<em>kg</em></div>
        </div>
        <div style="text-align:right">
          <span class="metric-l">Trend</span>
          <div class="h-sub num mt1 vswap" style="font-size:19px;color:var(--violet-lift)">${sp.a!=null?n2(sp.a):'—'}<span style="font-size:.62em;color:var(--ink-3);font-weight:520"> kg</span></div>
        </div>
      </div>`;
  }
  const lg=$('#legend');
  if(lg) lg.innerHTML=`
    <span><svg width="14" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke="#8B5CF6" stroke-width="2.25" stroke-linecap="round"/></svg>Trend (smoothed)</span>
    <span><svg width="8" height="8"><circle cx="4" cy="4" r="2.1" fill="#79818F"/></svg>Morning reading</span>
    ${S.showPost?'<span><svg width="10" height="10"><path d="M5 1.2L8.8 5L5 8.8L1.2 5Z" fill="none" stroke="#79818F" stroke-width="1.5"/></svg>Post-workout</span>':''}
    ${S.showProj?'<span><svg width="14" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke="rgba(139,92,246,.45)" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/></svg>Projection</span>':''}`;
  const cs=$('#csum');
  if(cs) cs.textContent=`${rows.length} morning readings from ${fmtD(rows[0].d,{day:'numeric',month:'short'})} to ${fmtD(TODAY,{day:'numeric',month:'short'})}. `
    + `Trend moved from ${n2(tr[0]?.a??0)} to ${n2(tr.at(-1)?.a??0)} kg.`
    + (S.showProj?' Projection is a model estimate, shown dashed — not a measurement.':'');
}

/* ============================================================
   HISTORY  -  calendar-first audit trail
   ============================================================ */
function screenHistory(){
  const s=el('<main class="screen"></main>');
  s.innerHTML=`
  <div class="pad">
    <div class="spread" style="padding-block:var(--s3) var(--s5)">
      <h1 class="h-page">History</h1>
    </div>
  </div>
  <div class="pad" id="calhost">${calendar()}</div>
  <div class="pad section" id="dayhost">${dayDetail()}</div>`;
  return s;
}
function calendar(){
  const sel=S.histDate;
  const d0=new Date(ms(sel)); d0.setUTCDate(1);
  const monthStart=d0.toISOString().slice(0,10);
  const lead=dow(monthStart);
  const days=new Date(Date.UTC(d0.getUTCFullYear(),d0.getUTCMonth()+1,0)).getUTCDate();
  let cells='';
  for(let i=0;i<lead;i++) cells+=`<div class="cal-c out" aria-hidden="true"></div>`;
  for(let i=1;i<=days;i++){
    const d=`${d0.getUTCFullYear()}-${String(d0.getUTCMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const fut=d>TODAY;
    const lift=logsOn(d).length>0, car=cardioOn(d).length>0, wt=!!weightOn(d);
    cells+=`<button type="button" class="cal-c ${fut?'out':''} ${d===TODAY?'today':''}" data-day="${d}"
      ${d===S.histDate?'aria-selected="true"':''} ${fut?'disabled':''}
      aria-label="${fmtD(d,{weekday:'long',day:'numeric',month:'long'})}${lift?', workout':''}${car?', cardio':''}${wt?', weight logged':''}">
      <span>${i}</span>
      <span class="cal-marks">${lift?'<i class="m-lift"></i>':''}${car?'<i class="m-cardio"></i>':''}${wt?'<i class="m-weight"></i>':''}</span>
    </button>`;
  }
  return `
  <div class="spread" style="margin-bottom:var(--s4)">
    <h2 class="h-sub">${fmtD(monthStart,{month:'long',year:'numeric'})}</h2>
    <div class="hstack" style="gap:var(--s2)">
      <button type="button" class="act-icon" data-mo="-1" aria-label="Previous month">‹</button>
      <button type="button" class="act-icon" data-mo="1" aria-label="Next month">›</button>
    </div>
  </div>
  <div class="cal" aria-hidden="true">${['M','T','W','T','F','S','S'].map((x,i)=>`<div class="cal-dow">${['S','M','T','W','T','F','S'][i]}</div>`).join('')}</div>
  <div class="cal mt1" role="grid">${cells}</div>
  <div class="legend mt4">
    <span><i style="width:5px;height:5px;border-radius:50%;background:var(--violet);display:block"></i>Workout</span>
    <span><i style="width:8px;height:3px;border-radius:1px;background:var(--ink-3);display:block"></i>Cardio</span>
    <span><i style="width:5px;height:5px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--ink-3);display:block"></i>Weight</span>
  </div>`;
}
function dayDetail(){
  const d=S.histDate, lg=logsOn(d), car=cardioOn(d), w=weightOn(d), pw=postOn(d);
  const t=typeFor(d);
  const byEx={}; lg.forEach(l=>{(byEx[l.e]=byEx[l.e]||[]).push(l);});
  const work=lg.filter(l=>l.st!=='warmup');
  return `
  <div class="spread" style="align-items:baseline">
    <div>
      <p class="eyebrow">${esc(fmtD(d,{weekday:'long'}))}</p>
      <h2 class="h-sub mt1" style="font-size:19px">${esc(fmtD(d,{day:'numeric',month:'long'}))}</h2>
    </div>
    <span class="tiny">${esc(label(t))}</span>
  </div>

  ${!lg.length&&!car.length&&!w ? `<p class="body mt4" style="font-size:14.5px">Nothing recorded on this day.</p>` : ''}

  ${w?`<div class="rows mt4">
    <div class="row"><span class="row-l"><span class="row-t">Morning weight</span>
      <span class="row-s">Canonical reading</span></span>
      <span class="row-v num">${n1(w.w)} kg</span></div>
    ${pw?`<div class="row"><span class="row-l"><span class="row-t">Post-workout</span>
      <span class="row-s">Contextual — not used for the trend</span></span>
      <span class="row-v num" style="color:var(--ink-2)">${n1(pw.w)} kg</span></div>`:''}
  </div>`:''}

  ${work.length?`
  <div class="mt6">
    <div class="sect-head"><p class="h-sect">${esc(label(t))}</p><span class="tiny">${work.length} working sets</span></div>
    <div class="rows">
      ${Object.entries(byEx).map(([name,sets])=>{
        const ws=sets.filter(s=>s.st!=='warmup');
        return `<button type="button" class="row" data-ex="${esc(name)}">
          <span class="row-l"><span class="row-t">${esc(name)}</span>
          <span class="row-s">${ws.map(s=>`${trimN(s.w)}×${s.r}`).join('  ·  ')}</span></span>
          <span class="chev">›</span></button>`;
      }).join('')}
    </div>
  </div>`:''}

  ${car.length?`
  <div class="mt6">
    <p class="h-sect" style="margin-bottom:var(--s3)">Cardio</p>
    <div class="rows">${car.map(c=>`<div class="row">
      <span class="row-l"><span class="row-t">${esc(c.type)}</span>
      <span class="row-s">${c.hr?`avg HR ${c.hr}`:''}${c.inc?` · incline ${c.inc}`:''}</span></span>
      <span class="row-v num">${c.min} min</span></div>`).join('')}</div>
  </div>`:''}

  <!-- Event / intervention / annotation model, designed for future State Engine -->
  ${d===addD(TODAY,-14)?`
  <div class="mt6">
    <p class="h-sect" style="margin-bottom:var(--s3)">Interventions</p>
    <div class="rows"><div class="row">
      <span class="row-l"><span class="row-t">Cardio target raised</span>
      <span class="row-s">60 → 90 min/week · review after 3 weeks</span></span>
      <span class="chev">›</span></div></div>
  </div>`:''}

  <div class="mt6" style="padding-bottom:var(--s7)">
    <button type="button" class="act-text mute" data-act="annotate">+ Add note to this day</button>
  </div>`;
}

/* ============================================================
   MORE (specified, not overbuilt)
   ============================================================ */
function screenMore(){
  const s=el('<main class="screen"></main>');
  const G=(t,rows)=>`<div class="pad section"><p class="h-sect" style="margin-bottom:var(--s3)">${t}</p><div class="rows">${rows}</div></div>`;
  const R=(t,v,sub)=>`<button type="button" class="row"><span class="row-l"><span class="row-t">${t}</span>${sub?`<span class="row-s">${sub}</span>`:''}</span><span class="row-v" style="color:var(--ink-3);font-weight:500">${v||''}</span><span class="chev">›</span></button>`;
  s.innerHTML=`
  <div class="pad"><h1 class="h-page" style="padding-block:var(--s3) var(--s2)">Settings</h1></div>
  ${G('Plan',R('Goal','78–80 kg')+R('Training','Full Body A/B/C')+R('Cardio','90 min/week'))}
  ${G('Preferences',R('Appearance','Dark')+R('Coaching','Concise')+R('Body','Metric'))}
  ${G('Body',R('Body Intelligence','','Scans, measurements and trends')+R('Add body scan','','Capture → review → save'))}
  ${G('Data',R('Cloud &amp; sync','On')+R('Backup','3 days ago')+R('Export',''))}
  <div class="pad section" style="padding-bottom:var(--s8)"><p class="tiny">NXTFRM VNext prototype · Phase 1</p></div>`;
  return s;
}

/* ============================================================
   SHEETS
   ============================================================ */
let sheetDone=null;
function openSheet(title,body,onDone){
  sheetDone=onDone||null;
  overlay.innerHTML=`<div class="scrim" data-close></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grip"></div>
      <div class="sheet-head"><h2 class="h-sub">${esc(title)}</h2>
        <button type="button" class="act-icon" data-close aria-label="Close">✕</button></div>
      <div class="sheet-body">${body}</div>
    </div>`;
  requestAnimationFrame(()=>{
    overlay.querySelector('.scrim').classList.add('in');
    overlay.querySelector('.sheet').classList.add('in');
    overlay.querySelector('.sheet').focus?.();
  });
}
function closeSheet(){
  const sc=overlay.querySelector('.scrim'), sh=overlay.querySelector('.sheet');
  if(!sh) return;
  sc.classList.remove('in'); sh.classList.remove('in');
  setTimeout(()=>{overlay.innerHTML='';},260);
}
function sheet(kind){
  const tpl=sessionPlan();
  if(kind==='queue'){
    openSheet('Workout queue', `
      <p class="meta" style="margin-bottom:var(--s4)">Reordering changes this session only. Your saved programme is unchanged.</p>
      <div class="rows">${tpl.map((e,i)=>{
        const done=S.session.filter(x=>x.e===e.name&&x.st==='working').length;
        return `<button type="button" class="row" data-jump="${i}">
          <span class="row-l"><span class="row-t" style="color:${i===S.exIdx?'var(--violet-lift)':'var(--ink)'}">${esc(e.name)}</span>
          <span class="row-s">${done}/${e.sets} sets · ${e.reps[0]}–${e.reps[1]} reps</span></span>
          ${done>=e.sets?'<span class="status ok"><i class="dot"></i>Done</span>':''}
          <span class="chev">›</span></button>`;}).join('')}</div>
      <button type="button" class="act quiet mt5" data-close>Close</button>`);
  }
  else if(kind==='exdetail'){
    const ex=tpl[S.exIdx], m=EX[ex.name]||{p:[],s:[],eq:''};
    const p=prevSession(ex.name,TODAY);
    openSheet(ex.name,`
      <div class="hstack" style="align-items:flex-start;gap:var(--s5)">
        ${anatomySVG(m.p,m.s,124)}
        <div class="grow">
          <span class="metric-l">Primary</span>
          <p class="body mt1" style="font-size:14.5px;color:var(--ink)">${m.p.map(x=>MLAB[x]).join(', ')||'—'}</p>
          <span class="metric-l" style="display:block;margin-top:var(--s4)">Secondary</span>
          <p class="body mt1" style="font-size:14.5px">${m.s.map(x=>MLAB[x]).join(', ')||'—'}</p>
          <span class="metric-l" style="display:block;margin-top:var(--s4)">Equipment</span>
          <p class="body mt1" style="font-size:14.5px">${esc(m.eq||'—')}</p>
        </div>
      </div>
      <div class="hr"></div>
      <span class="metric-l">Progression</span>
      <p class="body mt1" style="font-size:14.5px">Double progression — reach ${ex.reps[1]} reps on all ${ex.sets} sets, then add ${ex.inc} kg.</p>
      ${p?`<div class="hr"></div><span class="metric-l">Last session · ${fmtD(p.date,{day:'numeric',month:'short'})}</span>
        <div class="setlog mt2">${p.sets.map(s=>`<div class="setrow"><span class="n">${s.n}</span><b>${trimN(s.w)} kg × ${s.r}</b>${s.rir!=null?`<span class="rir">RIR ${s.rir}</span>`:''}</div>`).join('')}</div>`:''}
      <button type="button" class="act quiet mt5" data-act="swap">Swap exercise</button>`);
  }
  else if(kind==='why'){
    const p=D.plateau;
    openSheet('Why this call',`
      <p class="body" style="font-size:14.5px">NXTFRM reached this from deterministic calculations. AI did not decide it.</p>
      <div class="rows mt5">
        <div class="row"><span class="row-l"><span class="row-t">Rate</span><span class="row-s">Regression over ${p.windowDays} days</span></span><span class="row-v num">${signed(p.weeklyRate)} kg/wk</span></div>
        <div class="row"><span class="row-l"><span class="row-t">Range</span><span class="row-s">95% interval</span></span><span class="row-v num">${signed(p.upper)} … ${signed(p.lower)}</span></div>
        <div class="row"><span class="row-l"><span class="row-t">Readings</span><span class="row-s">Used in the window</span></span><span class="row-v num">${p.n}</span></div>
        <div class="row"><span class="row-l"><span class="row-t">Performance</span><span class="row-s">${D.strength.length} lifts, all holding steady</span></span><span class="row-v"><span class="status ok"><i class="dot"></i>Holding</span></span></div>
      </div>
      <p class="meta mt5">Because the interval sits entirely below zero, the loss is real rather than noise. No change is warranted.</p>
      <button type="button" class="act-text mt4">Ask NXTFRM about this ›</button>
      <button type="button" class="act quiet mt4" data-close>Close</button>`);
  }
  else if(kind==='session'){
    openSheet('Change today’s session',`
      <p class="meta" style="margin-bottom:var(--s4)">Your records and saved queues stay intact.</p>
      <div class="rows">${['FullA','FullB','FullC','Zone2','Rest'].map(t=>
        `<button type="button" class="row" data-close><span class="row-l"><span class="row-t">${label(t)}</span></span>
        ${t===D.dayTypeToday?'<span class="status ok"><i class="dot"></i>Today</span>':'<span class="chev">›</span>'}</button>`).join('')}</div>`);
  }
  else if(kind==='weighins'){
    openSheet('All weigh-ins',`<div class="rows">${trendRows.slice().reverse().slice(0,40).map(r=>
      `<button type="button" class="row"><span class="row-l"><span class="row-t">${fmtD(r.d,{weekday:'short',day:'numeric',month:'short'})}</span>
      <span class="row-s">Morning</span></span><span class="row-v num">${n1(r.w)} kg</span><span class="chev">›</span></button>`).join('')}</div>`);
  }
  else if(kind==='gym'){
    openSheet('Gym',`<div class="rows">
      <button type="button" class="row" data-close><span class="row-l"><span class="row-t">Gym A</span></span><span class="status ok"><i class="dot"></i>Active</span></button>
      <button type="button" class="row" data-close><span class="row-l"><span class="row-t">Gym B</span></span><span class="chev">›</span></button></div>`);
  }
}

/* ---- anatomy: schematic, consistent, monochrome graphite + violet ------- */
function anatomySVG(prim,sec,size){
  const set=new Set([...(prim||[]),...(sec||[])]);
  const back=[...set].some(m=>MVIEW[m]==='b');
  const on=m=>prim.includes(m)?'m-prim':sec.includes(m)?'m-sec':'m-off';
  /* Shared silhouette: one body, two annotations. Proportions are held in a
     single place so front and back always register against each other. */
  const SIL=`
    <ellipse class="body-sil" cx="50" cy="11.5" rx="7" ry="8.6"/>
    <path  class="body-sil" d="M46 19h8v5.5h-8z"/>
    <path  class="body-sil" d="M50 23c-7 0-12.4 1.5-15.8 3.2-1.3.7-2 1.9-1.9 3.3l.9 12.6c.3 4.2.9 8.3 1.8 12.4l1.7 7.8c.4 1.7 1.9 2.9 3.6 2.9h19.4c1.7 0 3.2-1.2 3.6-2.9l1.7-7.8c.9-4.1 1.5-8.2 1.8-12.4l.9-12.6c.1-1.4-.6-2.6-1.9-3.3C62.4 24.5 57 23 50 23z"/>
    <path  class="body-sil" d="M36.6 63.5h26.8l-1.3 9.2c-.3 2.2-2.2 3.8-4.4 3.8H42.3c-2.2 0-4.1-1.6-4.4-3.8z"/>
    <path  class="body-sil" d="M32.6 26.6c-3 1.6-4.8 3.6-5.4 6.3l-3.4 15.4c-.3 1.4.5 2.8 1.9 3.2s2.8-.4 3.2-1.8l4.2-14.8z"/>
    <path  class="body-sil" d="M67.4 26.6c3 1.6 4.8 3.6 5.4 6.3l3.4 15.4c.3 1.4-.5 2.8-1.9 3.2s-2.8-.4-3.2-1.8l-4.2-14.8z"/>
    <path  class="body-sil" d="M25.6 50.4l-2.9 15.3c-.3 1.5.7 2.9 2.2 3.1s2.9-.7 3.1-2.2l2.6-15z"/>
    <path  class="body-sil" d="M74.4 50.4l2.9 15.3c.3 1.5-.7 2.9-2.2 3.1s-2.9-.7-3.1-2.2l-2.6-15z"/>
    <path  class="body-sil" d="M39.6 76.5h8.6l-.6 30.4c0 1.6-.1 3.2-.4 4.8l-1.6 9.6h-6.2l-1.2-9.7c-.2-1.7-.3-3.4-.2-5.1z"/>
    <path  class="body-sil" d="M60.4 76.5h-8.6l.6 30.4c0 1.6.1 3.2.4 4.8l1.6 9.6h6.2l1.2-9.7c.2-1.7.3-3.4.2-5.1z"/>
    <path  class="body-sil" d="M39.4 123.5h6.4l-.5 17.6c0 1.3-.2 2.6-.4 3.9l-1.5 9.4h-3.4l-1.1-9.5c-.2-1.4-.2-2.8-.1-4.2z"/>
    <path  class="body-sil" d="M60.6 123.5h-6.4l.5 17.6c0 1.3.2 2.6.4 3.9l1.5 9.4h3.4l1.1-9.5c.2-1.4.2-2.8.1-4.2z"/>`;
  const F=SIL+`
    <path class="${on('front_delts')}" d="M33.8 25.9c-2.6 1.4-4.4 3.2-5.2 5.6l-1.4 5.7 6.9 1.6 1.8-11.6z"/>
    <path class="${on('front_delts')}" d="M66.2 25.9c2.6 1.4 4.4 3.2 5.2 5.6l1.4 5.7-6.9 1.6-1.8-11.6z"/>
    <path class="${on('side_delts')}" d="M27.2 31.5l-2.3 9.9 6.8 1.5 1.5-9.8z"/>
    <path class="${on('side_delts')}" d="M72.8 31.5l2.3 9.9-6.8 1.5-1.5-9.8z"/>
    <path class="${on('upper_chest')}" d="M36.4 26.6c9-2.3 18.2-2.3 27.2 0l.5 6.6c-9.4-2.1-18.8-2.1-28.2 0z"/>
    <path class="${on('chest')}" d="M35.7 34.6c9.5-2.1 19.1-2.1 28.6 0l.7 9.3c-10-1.9-20-1.9-30 0z"/>
    <path class="${on('abs')}" d="M43.6 45.5h12.8l-.7 17.2H44.3z"/>
    <path class="${on('obliques')}" d="M37.6 45.9h4.6l-.6 16.8h-4.3zM62.4 45.9h-4.6l.6 16.8h4.3z"/>
    <path class="${on('biceps')}" d="M31.6 33.4l-3.2 12.9 5.9 1.4 2.4-13z"/>
    <path class="${on('biceps')}" d="M68.4 33.4l3.2 12.9-5.9 1.4-2.4-13z"/>
    <path class="${on('forearms')}" d="M26.4 51.6l-2.4 12.8 5 .9 2.2-12.9z"/>
    <path class="${on('forearms')}" d="M73.6 51.6l2.4 12.8-5 .9-2.2-12.9z"/>
    <path class="${on('quads')}" d="M40 78h7.9l-.5 24.6h-7.1zM60 78h-7.9l.5 24.6h7.1z"/>
    <path class="${on('adductors')}" d="M48.7 78h2.6l-.3 19h-2z"/>`;
  const B=SIL+`
    <path class="${on('traps')}" d="M41 24h18l-1.6 11.4H42.6z"/>
    <path class="${on('rear_delts')}" d="M33.8 25.9c-2.6 1.4-4.4 3.2-5.2 5.6l-1.4 5.7 6.9 1.6 1.8-11.6z"/>
    <path class="${on('rear_delts')}" d="M66.2 25.9c2.6 1.4 4.4 3.2 5.2 5.6l1.4 5.7-6.9 1.6-1.8-11.6z"/>
    <path class="${on('upper_back')}" d="M35.6 27.6c9.6-2.3 19.2-2.3 28.8 0l.6 11.4c-10-2-20-2-30 0z"/>
    <path class="${on('lats')}" d="M34.4 40.5h12.9l-1.9 16.4-8.9-3.4zM65.6 40.5H52.7l1.9 16.4 8.9-3.4z"/>
    <path class="${on('spinal_erectors')}" d="M45.6 40.9h8.8l-.6 21.8h-7.6z"/>
    <path class="${on('triceps')}" d="M31.6 33.4l-3.2 12.9 5.9 1.4 2.4-13z"/>
    <path class="${on('triceps')}" d="M68.4 33.4l3.2 12.9-5.9 1.4-2.4-13z"/>
    <path class="${on('forearms')}" d="M26.4 51.6l-2.4 12.8 5 .9 2.2-12.9z"/>
    <path class="${on('forearms')}" d="M73.6 51.6l2.4 12.8-5 .9-2.2-12.9z"/>
    <path class="${on('glutes')}" d="M37.4 64.5h25.2l-1.2 8.4c-.3 2.1-2.1 3.6-4.2 3.6H42.8c-2.1 0-3.9-1.5-4.2-3.6z"/>
    <path class="${on('hamstrings')}" d="M40 79h7.9l-.5 23.6h-7.1zM60 79h-7.9l.5 23.6h7.1z"/>
    <path class="${on('calves')}" d="M39.6 125h6l-.4 15.4c0 1.1-.1 2.2-.3 3.3h-4.4c-.2-1.1-.3-2.2-.3-3.3zM60.4 125h-6l.4 15.4c0 1.1.1 2.2.3 3.3h4.4c.2-1.1.3-2.2.3-3.3z"/>`;
  return `<svg class="anat" viewBox="0 0 100 168" width="${size}" style="width:${size}px" role="img"
    aria-label="${back?'Back':'Front'} view. Primary: ${prim.map(m=>MLAB[m]).join(', ')||'none'}. Secondary: ${sec.map(m=>MLAB[m]).join(', ')||'none'}.">
    ${back?B:F}</svg>`;
}

/* ---- toast -------------------------------------------------------------- */
function toast(msg){
  const t=el(`<div role="status" style="position:absolute;left:50%;bottom:calc(var(--nav-h) + 26px);transform:translateX(-50%);
    z-index:80;background:#252A34;color:var(--ink);padding:11px 16px;border-radius:12px;font-size:13.5px;font-weight:520;
    box-shadow:0 10px 26px -10px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.08);max-width:80%;text-align:center">${esc(msg)}</div>`);
  $('#app').appendChild(t);
  setTimeout(()=>{t.style.transition='opacity 200ms';t.style.opacity='0';setTimeout(()=>t.remove(),220);},1500);
}

/* ---- segment thumb ------------------------------------------------------ */
function paintSegs(root=document){
  root.querySelectorAll('.seg').forEach(seg=>{
    if(!seg.querySelector('.seg-thumb')) seg.insertAdjacentHTML('afterbegin','<span class="seg-thumb"></span>');
    const th=seg.querySelector('.seg-thumb');
    const act=seg.querySelector('[aria-pressed=true],[aria-selected=true]');
    if(!act){th.style.opacity='0';return;}
    th.style.opacity='1';
    th.style.left=(act.offsetLeft)+'px';
    th.style.width=(act.offsetWidth)+'px';
  });
}

/* ---- global events ------------------------------------------------------ */
document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('[data-close]')){ const cb=sheetDone; sheetDone=null; closeSheet(); cb&&cb(); return; }
  const sh=t.closest('[data-sheet]'); if(sh){ sheet(sh.dataset.sheet); return; }

  const a=t.closest('[data-act]');
  if(a){
    const k=a.dataset.act;
    if(k==='start') return startWorkout();
    if(k==='exit'){ S.active=false; render(); return; }
    if(k==='finish') return finishWorkout();
    if(k==='done'){ const cb=sheetDone;sheetDone=null;closeSheet();cb&&cb(); return; }
    if(k==='log') return logSet();
    if(k==='prev'){ if(S.exIdx>0){S.exIdx--;render();} return; }
    if(k==='next'){ const n=sessionPlan().length; if(S.exIdx<n-1){S.exIdx++;render();} return; }
    if(k==='rest30'){ if(S.rest){S.rest.left+=30;S.rest.total+=30;} return; }
    if(k==='restskip'){ S.rest=null; clearInterval(restTimer); render(); return; }
    if(k==='toweight'){ go('progress'); return; }
    if(k==='toperf'){ go('progress'); return; }
    if(k==='weigh'||k==='cardio'||k==='checkin'||k==='annotate'||k==='addon'||k==='swap'||k==='mprev')
      return toast('Specified in the brief — not built in this pass.');
  }

  const j=t.closest('[data-jump]'); if(j){ S.exIdx=+j.dataset.jump; closeSheet(); setTimeout(render,180); return; }
  const day=t.closest('[data-day]');
  if(day){
    S.histDate=day.dataset.day;
    const host=$('#dayhost'); const cal=$('#calhost');
    if(cal){ cal.innerHTML=calendar(); }
    if(host){ host.innerHTML=dayDetail(); host.classList.remove('enter'); void host.offsetWidth; host.classList.add('enter'); }
    return;
  }
  const mo=t.closest('[data-mo]');
  if(mo){
    const d=new Date(ms(S.histDate)); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+ +mo.dataset.mo);
    let nd=d.toISOString().slice(0,10); if(nd>TODAY) nd=TODAY;
    S.histDate=nd; $('#calhost').innerHTML=calendar(); $('#dayhost').innerHTML=dayDetail(); return;
  }
  const tg=t.closest('[data-tog]');
  if(tg){ const k=tg.dataset.tog; if(k==='post')S.showPost=!S.showPost; else S.showProj=!S.showProj; render(); return; }

  const sb=t.closest('.seg button');
  if(sb&&!sb.disabled){
    const seg=sb.closest('.seg'), kind=seg.dataset.seg, v=sb.dataset.v;
    if(kind==='range'){ S.range=v; S.scrubIdx=null;
      seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===v)));
      paintSegs(); drawChart(); return; }
    if(kind==='type'){ S.setType=v; seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===v)));
      paintSegs(); const btn=$('[data-act=log]');
      if(btn){const tpl=sessionPlan(),ex=tpl[S.exIdx];const d=S.session.filter(x=>x.e===ex.name&&x.st==='working').length;
        btn.textContent=v==='warmup'?'Log warm-up':`Log set ${d+1}`;} return; }
    if(kind==='rir'){ S.rir=+v; seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===v)));
      paintSegs(); return; }
    if(kind==='pview'){ seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.v===v)));
      paintSegs(); if(v!=='weight') toast('Specified in the brief — not built in this pass.'); return; }
  }

  const st=t.closest('[data-step]');
  if(st){
    const [f,inc]=st.dataset.step.split(',');
    const input=$(f==='w'?'#wIn':'#rIn');
    const cur=parseFloat(input.value)||0;
    const next=Math.max(0,Math.round((cur+parseFloat(inc))*100)/100);
    input.value=f==='r'?Math.round(next):next;
    input.classList.add('vswap'); setTimeout(()=>input.classList.remove('vswap'),200);
    if(navigator.vibrate) navigator.vibrate(6);
    return;
  }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&overlay.querySelector('.sheet')){const cb=sheetDone;sheetDone=null;closeSheet();cb&&cb();} });

/* repaint segment thumbs after every render */
const _render=render;
window.requestAnimationFrame(()=>paintSegs());
new MutationObserver(()=>paintSegs()).observe(view,{childList:true,subtree:false});
new MutationObserver(()=>paintSegs()).observe(overlay,{childList:true});

/* ---- prototype harness (not product) ------------------------------------ */
document.querySelector('.devbar')?.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.w){
    document.body.style.setProperty('--dev-w',b.dataset.w+'px');
    document.querySelectorAll('.devbar [data-w]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    setTimeout(()=>{ if(S.tab==='progress') drawChart(); },320);
  }
  if(b.dataset.goto){
    const g=b.dataset.goto;
    S.restDemo=(g==='today-rest');
    if(g==='today'||g==='today-rest'){S.tab='today';S.active=false;}
    else if(g==='train'){S.tab='train';S.active=true;S.exIdx=0;S.session=[];}
    else if(g==='progress'){S.tab='progress';S.active=false;}
    else if(g==='history'){S.tab='history';S.active=false;}
    render();
  }
});

render();
})();
