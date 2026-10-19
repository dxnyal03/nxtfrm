/* V100 presentation layer. Uses the existing workout, chart and backup engines. */
"use strict";
const NXP = (() => {
  const N=NXT;
  const base={home:N.home,training:N.training,more:N.moreView,historyDay:showHistoryDay,exportJSON,logSet:N.logSet};
  const ui={drafts:new Map(),historyRows:[],restTotal:0,confirmFrom:null,confirmTimer:null,lastExercise:null,lastIndex:-1,addOnFlash:null,trainActive:false,connection:{busy:false,lines:[],summary:'Not tested on this device'}};
  /* D6: focused Train mode recedes global nav. Cleared on leave, finish, and
     any non-Train tab so the dock cannot stay hidden after a route change.
     The cloud/local banner is the same chrome — suppressed while mode is
     engaged, restored via D11 targeting on leave/finish (not a D11 change). */
  function syncTrainNav(active) {
    const tabs=document.querySelector('.tabs');
    if(tabs)tabs.classList.toggle('vn-recede',!!active);
    const banner=document.getElementById('cloudLocalBanner');
    if(active){
      if(banner)banner.setAttribute('hidden','');
    }else if(typeof updateCloudLocalBanner==='function'){
      updateCloudLocalBanner();
    }
  }
  function enterTrain() {
    ui.trainActive=true;
    if(typeof switchTab==='function'){
      if(state.tab!=='train')switchTab('train');
      else if(typeof render==='function')render();
      else training();
    }else{
      state.tab='train';
      if(typeof render==='function')render();
      else training();
    }
  }
  function leaveTrain() {
    ui.trainActive=false;
    syncTrainNav(false);
    if(typeof render==='function')render();
    else training();
  }
  const button=N.button;
  const formatNumber=n=>Number(n).toLocaleString('en-SG');
  function shell(html, extra='') {return `<div class="n99 nxp${extra?' '+extra:''}">${html}</div>`;}
  function row(title,value,action,sub='') {return `<button type="button" class="nxp-setting" onclick="${esc(action)}"><span><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span><span class="nxp-setting-value">${esc(value||'')}<i aria-hidden="true">›</i></span></button>`;}
  function pref() {return N.cfg().appearance||{};}
  function applyAppearance() {
    document.documentElement?.setAttribute('data-nxp-size',pref().text==='large'?'large':'normal');
    document.documentElement?.setAttribute('data-nxp-motion',pref().motion==='reduced'?'reduced':'system');
  }
  function cloudLabel() {
    if(!localStorage.getItem('apm_sb_url')||!localStorage.getItem('apm_sb_key'))return 'Not configured';
    return cloudUser?'Signed in · not a live status':'Sign-in needed';
  }
  function backupLabel() {
    const ts=Number(N.cfg().backupExportRequestedAt);
    return ts?new Date(ts).toLocaleDateString('en-SG',{day:'numeric',month:'short'}):'No export recorded';
  }
  /* Greeting. The name is a plain display string in settings (default "Dan");
     it never feeds a calculation. Time of day comes from the device clock. */
  function userName(){const n=typeof settings.name==='string'?settings.name.trim():'';return settings.name===undefined?'Dan':n;}
  function greeting(){
    const h=new Date().getHours(),part=h<5?'Late night':h<12?'Morning':h<18?'Afternoon':'Evening',n=userName();
    return n?`${part}, ${n}`:part;
  }
  function nameSheet(){
    N.modal('Your name',`<form onsubmit="event.preventDefault();NXP.saveName()"><label>What should the app call you?<input id="nxp-name" type="text" maxlength="24" autocomplete="given-name" autocapitalize="words" value="${esc(userName())}"></label><p class="n99-small">Shown in the greeting on Today. Leave it empty for no name.</p><button type="submit" class="n99-button">Save</button></form>`);
  }
  function saveName(){
    const v=(document.getElementById('nxp-name')?.value||'').replace(/\s+/g,' ').trim().slice(0,24);
    settings.name=v;N.commit('Name saved');
  }
  function home() {
    applyAppearance();
    syncTrainNav(false);
    const list=template(),logs=N.sessionLogs(),lift=!['Rest','Zone2','Floorball'].includes(state.dayType),finished=N.planDone();
    const s=N.trendStats(),r=N.review(),cal=N.finite(N.cfg().calories);
    const action=lift?"startWorkoutNow()":state.dayType==='Zone2'?"showCardioSheet()":state.dayType==='Floorball'?"startWorkoutNow()":"apx96OpenReadiness()";
    const title=finished?'Review workout':lift?(logs.length?'Resume workout':'Start workout'):state.dayType==='Zone2'?'Log cardio':state.dayType==='Floorball'?'Open session':'Recovery check-in';
    const dayMs=N.dateMs(state.date);
    const weekday=Number.isFinite(dayMs)?new Date(dayMs).toLocaleDateString('en-SG',{weekday:'long',timeZone:'UTC'}):'';
    const dateLine=Number.isFinite(dayMs)?new Date(dayMs).toLocaleDateString('en-SG',{day:'numeric',month:'long',timeZone:'UTC'}):N.shortDate(state.date);
    const cardioMins=N.cardioWeek(),cardioTarget=Number(settings.zone2WeeklyTarget)||90;
    const lifts=N.strengthItems();
    const liftReview=lifts.filter(x=>x.status==='Review').length;
    const perfLabel=!lifts.length?'Building':liftReview>=2?'Review':lifts.some(x=>x.status==='Improving')?'Improving':lifts.some(x=>x.status==='Holding steady')?'Holding':lifts.some(x=>x.status==='Watch')?'Watch':lifts.some(x=>x.status==='Older history')?'Older history':'Building';
    // Older history / Building map to is-neutral deliberately — do not promote to is-ok.
    const perfTone=perfLabel==='Review'||perfLabel==='Watch'?'is-watch':perfLabel==='Improving'||perfLabel==='Holding'?'is-ok':'is-neutral';
    const lastPerfDate=lifts.map(x=>x.latestDate).filter(Boolean).sort().at(-1);
    const perfSub=perfLabel==='Older history'
      ?(lastPerfDate?`${lifts.length} ${N.plural(lifts.length,"lift")} · last logged ${N.shortDate(lastPerfDate)}`:'No recent comparable sessions')
      :`${lifts.length} ${N.plural(lifts.length,"lift")} with recent history`;
    const mean=s.current.avg===null?'—':s.current.avg.toFixed(2);
    const weekly=s.change===null?'Building':N.signed(s.change,2);
    const work=N.workRows();
    const lastLift=[...new Set(work.map(row=>row.date))].sort().at(-1);
    const lastLiftRow=lastLift?work.find(row=>row.date===lastLift):null;
    const lastLiftLine=lastLiftRow?(lastLift===state.date?(finished?'Logged today':'In progress today'):(()=>{const n=work.filter(row=>row.date===lastLift).length,ago=Math.round((N.dateMs(state.date)-N.dateMs(lastLift))/864e5),when=ago===1?'yesterday':ago>1?ago+' days ago':N.shortDate(lastLift);return `Last lifted · ${N.label(lastLiftRow.dayType||state.dayType)}, ${when}${n?` · ${n} ${n===1?'set':'sets'}`:''}`;})()):'';
    const plateau=N.detectPlateau();
    const trendEv=plateau.weeklyRate===null?(s.change===null?'—':N.signed(s.change)+' kg/wk'):N.signed(plateau.weeklyRate)+' kg/wk';
    const confEv=!plateau.confidence||plateau.confidence==='none'?'—':plateau.confidence;
    const toneClass=r.tone==='watch'?' vn-tone-watch':'';
    const support=r.message||r.reason||'';
    const morning=N.timingRows('Morning').find(row=>row.date===state.date)||null;
    const sets=list.reduce((a,e)=>a+Number(e.sets),0);
    const nextDate=N.dateAdd(state.date,1);
    const nextLine=`Next session · ${N.label(N.typeFor(nextDate))} tomorrow`;
    /* Ascension — the rail and its header read the coach's statuses, so an excused or moved
       day is neither "not logged" nor counted as a planned lift (NXT.coach.context().week).
       Without coach.js the rail falls back to the plan, as before. */
    const cxCtx=coachCall('context'),cxWeek=cxCtx&&cxCtx.week&&Array.isArray(cxCtx.week.days)?cxCtx.week:null;
    const cxDay={};if(cxWeek)cxWeek.days.forEach(x=>{if(x&&x.date)cxDay[x.date]=x;});
    const weekLogged=cxWeek?cxWeek.liftsDone:N.completedWeek();
    const weekStart=N.weekStart();
    const weekShort={FullA:'Full A',FullB:'Full B',FullC:'Full C',Zone2:'Walk',Rest:'Rest',Floorball:'FB',Push:'Push',Pull:'Pull',Legs:'Legs',Pump:'Legs'};
    /* D48 — the rail reads outcome as well as plan. A day is done when its own
       record exists (lift sets, cardio minutes, or a floorball session); a planned
       day already behind us with no record is "not logged" (dashed ring); a morning
       weigh-in is a dot under the label. All from stored rows — no new metric. */
    const cardioDays=new Set((state.cardio||[]).filter(r=>r&&N.finite(r.duration)>0).map(r=>r.date));
    const floorDays=new Set((state.floorball||[]).filter(r=>r&&r.date).map(r=>r.date));
    const planLift=cxWeek?cxWeek.liftsPlanned:Array.from({length:7},(_,i)=>N.typeFor(N.dateAdd(weekStart,i))).filter(liftDays).length;
    const check='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 4.9 8.6 9.5 3.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const weekStrip=`<div class="vn-week" data-rail="capsule" role="list">${Array.from({length:7},(_,i)=>{
      const d=N.dateAdd(weekStart,i),t=N.typeFor(d),isToday=d===state.date,dc=cxDay[d]||null;
      const complete=t==='Zone2'?cardioDays.has(d):t==='Floorball'?floorDays.has(d):work.some(row=>row.date===d);
      /* "Not logged" means nothing at all was recorded that day. A walk day with an add-on
         lift is neither done (the plan was the walk) nor empty, so it stays a plain capsule. */
      const anything=work.some(row=>row.date===d)||cardioDays.has(d)||floorDays.has(d);
      /* Ascension — an excused or moved day is a decision, not a lapse, and the coach says
         which; a day before the first record is not "not logged" either. */
      const excused=!complete&&!!dc&&dc.status==='excused',moved=!complete&&!!dc&&dc.status==='moved';
      const missed=!complete&&!anything&&t!=='Rest'&&d<state.date&&!excused&&!moved&&!(dc&&dc.status==='untracked');
      const short=moved?'Moved':weekShort[t]||String(t).slice(0,3);
      const day=Number.isFinite(N.dateMs(d))?new Date(N.dateMs(d)).toLocaleDateString('en-SG',{weekday:'narrow',timeZone:'UTC'}):['M','T','W','T','F','S','S'][i];
      const stateWord=complete?'done':excused?'excused'+(dc.reason&&dc.reason!=='other'?' · '+dc.reason:''):moved?'moved'+(dc.movedTo?' to '+N.shortDate(dc.movedTo):''):missed?'not logged':isToday?'today':d<state.date?(anything?'logged, plan not done':''):'planned';
      const mark=complete?`<span class="st-cap-s is-done">${check}</span>`:excused?`<span class="st-cap-s is-excused">${coMark('excused','co-rm')}</span>`:moved?`<span class="st-cap-s is-moved">${coMark('moved','co-rm')}</span>`:missed?'<span class="st-cap-s is-missed"></span>':'';
      return `<button type="button" class="vn-week-c${isToday?' is-today':''}${liftDays(t)?' is-lift':''}${complete?' is-done':''}${missed?' is-missed':''}${excused?' is-excused':''}${moved?' is-moved':''}${d>state.date?' is-future':''} is-k-${({FullA:'full',FullB:'full',FullC:'full',Push:'push',Pull:'pull',Legs:'legs',Pump:'legs',Zone2:'walk',Floorball:'fb',Rest:'rest'})[t]||(liftDays(t)?'full':'rest')}" role="listitem" onclick="NXT.openDay('${d}')" aria-label="${esc(N.shortDate(d)+' · '+N.label(t)+(stateWord?' · '+stateWord:''))}" ${isToday?'aria-current="date"':''}><span class="st-cap"><span class="vn-week-d">${esc(day)}</span>${mark}</span><span class="vn-week-t">${esc(short)}</span></button>`;
    }).join('')}</div>`;
    function liftDays(t){return !['Rest','Zone2','Floorball'].includes(t);}
    const weekHead=weekLogged<=planLift?`${weekLogged} of ${planLift} ${N.plural(planLift,"lift")} done`:`${weekLogged} lifting ${N.plural(weekLogged,"day")}`;
    const textAct=(label,fn,mute)=>`<button type="button" class="vn-text${mute?' is-mute':''}" onclick="${esc(fn)}">${label}</button>`;
    const logged=list.reduce((a,e)=>a+Math.min(N.done(e.name),Number(e.sets)),0);
    const trainTile=lift?`
      <article class="st-tile st-t-train" style="--c:var(--st-lift)"><span class="st-ghost" aria-hidden="true">${esc(weekShort[state.dayType]||N.label(state.dayType))}</span>
        <div class="st-tile-head"><span class="st-cat">${finished?'Workout saved':'Today’s training'}</span>${textAct('Change','showSessionSheet()',true)}</div>
        <div class="st-train-row">
          <div class="st-train-id">
            <h2 class="st-h2">${esc(N.label(state.dayType))}</h2>
            <p class="st-meta">${list.length} ${N.plural(list.length,"exercise")} · ${sets} working ${N.plural(sets,"set")} · ${esc(state.gym||'Gym')}</p>
          </div>
          ${logged?ringHTML(logged,sets,'sets','var(--st-lift)'):''}
        </div>
        <div class="st-tweek st-tweek-top"><div class="st-tweek-h"><span>This week · ${weekHead}</span>${textAct('Edit plan',"NXT.more('training')",true)}</div>${weekStrip}</div>
        <button type="button" class="st-cta" onclick="${esc(finished?"switchTab('train')":action)}">${esc(title)}<span aria-hidden="true">›</span></button>
        ${lastLiftLine?`<p class="st-meta st-mt2 st-center">${esc(lastLiftLine)}</p>`:''}
      </article>`:`
      <article class="st-tile st-t-train" style="--c:${state.dayType==='Zone2'?'var(--st-cardio)':state.dayType==='Floorball'?'var(--st-floor)':'var(--st-rest)'}"><span class="st-ghost" aria-hidden="true">${esc(state.dayType==='Zone2'?'Walk':state.dayType==='Floorball'?'Floorball':N.label(state.dayType))}</span>
        <div class="st-tile-head"><span class="st-cat">Today</span>${textAct('Change','showSessionSheet()',true)}</div>
        <h2 class="st-h2">${esc(N.label(state.dayType))}</h2>
        <p class="st-body st-mt2">${state.dayType==='Rest'?'A planned recovery day. Nothing is scheduled.':state.dayType==='Zone2'?'An easy, conversational effort. No lifting session is due.':'Hard conditioning day. Log duration and effort.'}</p>
        ${state.dayType==='Rest'?'':`<button type="button" class="st-cta" onclick="${esc(action)}">${esc(title)}<span aria-hidden="true">›</span></button>`}
        <div class="vn-rows st-mt3">
          <button type="button" class="vn-row" onclick="apx95OpenQuickWeight()">
            <span class="vn-row-l"><span class="vn-row-t">Morning weight</span>
            <span class="vn-row-s">${morning?`Logged · ${morning.weight.toFixed(1)} kg`:'Not logged yet'}</span></span>
            ${morning?'':`<span class="vn-row-v st-accent-t">Log</span>`}
            <i class="vn-chev" aria-hidden="true">›</i>
          </button>
          ${addOnEligible()?`<button type="button" class="vn-row" onclick="NXP.addOnPick()">
            <span class="vn-row-l"><span class="vn-row-t">Add optional lifting</span>
            <span class="vn-row-s">Kept as an add-on — today’s plan is unchanged</span></span>
            <i class="vn-chev" aria-hidden="true">›</i>
          </button>`:''}
        </div>
        <p class="st-meta st-mt3">${esc(nextLine)}</p>
        <div class="st-tweek"><div class="st-tweek-h"><span>This week · ${weekHead}</span>${textAct('Edit plan',"NXT.more('training')",true)}</div>${weekStrip}</div>
      </article>`;
    /* Ascension — the Coach stack and the Week in review sit between the training tile and the
       minis. Each is a direct child of .st-bento, so it reveals on scroll like its neighbours. */
    const coStack=coachStackHTML(),coReview=reviewTileHTML();
    /* A warning verdict leads Today (it used to sit ~2,000px down, under every coach note); a calm one
       keeps its place after the minis. Same card, same words — only its position changes. */
    const decUp=r.tone==='watch';
    const decTile=`<section class="st-tile st-t-dec${toneClass}" data-st-view aria-labelledby="vn-dec-h" style="--c:var(--st-accent)">
            <div class="st-tile-head"><span class="st-cat">Decision</span><button type="button" class="st-link st-why" onclick="NXT.openReview()">Why<span aria-hidden="true">›</span></button></div>
            <h2 class="st-h3" id="vn-dec-h">${esc(r.title)}</h2>
            ${support?`<p class="st-body st-mt2">${esc(support)}</p>`:''}
            ${decEvidenceHTML(trendEv,confEv,plateau)}
          </section>`;
    document.getElementById('homePage').innerHTML=`<div class="vn-today st-today">
      <div class="vn-pad">
        <header class="st-head">
          <div>
            <p class="st-eyebrow">${esc(weekday)} · ${esc(dateLine)}</p>
            <h1 class="st-h1">${esc(greeting())}</h1>
            ${!morning&&new Date().getHours()>=4&&new Date().getHours()<12?`<button type="button" class="st-wchip" onclick="apx95OpenQuickWeight()"><i aria-hidden="true"></i>Log morning weight</button>`:''}
          </div>
          ${lift?`<button type="button" class="st-chip" onclick="cycleGym()">${esc(state.gym||'Gym')}<span aria-hidden="true">⇄</span></button>`:''}
        </header>
        <div class="st-bento">
          ${trainTile}${decUp?decTile:''}${coStack}${coReview}
          <div class="st-minis">
            ${weightTileHTML()}
            <button type="button" class="st-tile st-mini" style="--c:var(--st-cardio)" onclick="showCardioSheet()">
              <span class="st-cat">Cardio</span>
              <span class="st-mini-v"><b class="vn-num">${cardioMins}</b><small>/${cardioTarget}</small></span>
              <span class="st-mini-bar"><i style="width:${Math.min(100,cardioTarget?cardioMins/cardioTarget*100:0).toFixed(0)}%"></i></span>
              <span class="st-meta">min/wk</span>
            </button>
            ${(()=>{
              /* Recent session (≤7 days): lead with its D20 outcome — "3 of 5 beat" — and name the
                 session; otherwise the engine status word as before. */
              const ago=lastLift?Math.round((N.dateMs(state.date)-N.dateMs(lastLift))/864e5):null;
              const oc=lastLift&&ago!==null&&ago<=7?liftOutcome(lastLift,(lastLiftRow&&lastLiftRow.gym)||state.gym):null;
              if(oc&&oc.compared){
                const when=ago===0?'today':ago===1?'yesterday':`${ago}d ago`;
                return `<button type="button" class="st-tile st-mini st-mini-lifts" style="--c:var(--st-lift)" onclick="NXT.ui.view='strength';switchTab('weight')" aria-label="Lifts: ${oc.up} of ${oc.compared} beat last time, ${N.label(lastLiftRow.dayType||state.dayType)} ${when}">
              <span class="st-cat">Lifts</span>
              <span class="st-mini-v"><b class="vn-num">${oc.up}</b><small>/${oc.compared} beat</small></span>
              <span class="st-meta">${esc(weekShort[lastLiftRow.dayType]||N.label(lastLiftRow.dayType||state.dayType))} · ${when}</span>
            </button>`;
              }
              return `<button type="button" class="st-tile st-mini" style="--c:var(--st-lift)" onclick="NXT.ui.view='strength';switchTab('weight')">
              <span class="st-cat">Lifts</span>
              <span class="st-mini-v st-mini-w">${esc(perfLabel)}</span>
              <span class="st-meta">${perfLabel==='Older history'&&lastPerfDate?`Last ${esc(N.shortDate(lastPerfDate))}`:`${lifts.length} ${N.plural(lifts.length,"lift")}`}</span>
            </button>`;
            })()}
          </div>
          ${decUp?'':decTile}
          ${bodyTileHTML()}
        </div>
      </div>

      <nav class="vn-pad st-quick" aria-label="Quick actions">
        <button type="button" class="st-qa" style="--c:var(--st-weight)" onclick="apx95OpenQuickWeight()"><span aria-hidden="true">+</span>Weight</button>
        ${state.dayType==='Zone2'?'':`<button type="button" class="st-qa" style="--c:var(--st-cardio)" onclick="showCardioSheet()"><span aria-hidden="true">+</span>Cardio</button>`}
        ${N.features.checkin?`<button type="button" class="st-qa" style="--c:var(--st-rest)" onclick="apx96OpenReadiness()"><span aria-hidden="true">+</span>Check-in</button>`:''}
      </nav>

      ${(N.features.wearable||N.features.checkin||N.features.calories)?`<details class="vn-more vn-pad st-more">
        <summary>More for today</summary>
        <div class="vn-more-body">
          ${N.features.wearable||N.features.checkin?recoveryHomeCard():''}
          ${N.features&&N.features.calories?`<button type="button" class="nxp-home-kcal" onclick="NXT.openCalories()"><span><small>Calorie guide</small><strong>${cal?formatNumber(cal)+' <em>kcal</em>':'Set target'}</strong></span><span>${cal?'Edit':'Set up'}</span></button>${N.adherenceHTML()}`:''}
        </div>
      </details>`:''}
    </div>`;
  }
  /* ---- Ascension · coaching surfaces ------------------------------------------------
     The presentation of NXT.coach (coach.js, the engine). Every figure and sentence
     below is the engine's: this block lays them out, maps each action to a function
     that already exists, and writes only through NXT.coach's own writers (excuse,
     unexcuse, dismiss, markReviewSeen, applyCatchUp). Nothing here computes a score
     (D9) or a new statistic. If coach.js is missing, every helper returns an empty
     string or null and the screens read exactly as they did before. */
  const CO_DOM={schedule:'Schedule',strength:'Strength',cardio:'Cardio',weight:'Weight',data:'Data'};
  const CO_GLYPH={
    schedule:'<rect x="2.5" y="3.5" width="11" height="10" rx="2.5"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3"/>',
    strength:'<path d="M2.2 6.2v3.6M4.4 4.4v7.2M11.6 4.4v7.2M13.8 6.2v3.6M4.4 8h7.2"/>',
    cardio:'<path d="M1.6 8.6h3.1l1.8-4.6 2.8 7.2 1.8-3.4h3.3"/>',
    weight:'<path d="M2.6 12.4a5.6 5.6 0 1 1 10.8 0"/><path d="M8 12l2.6-4.4"/>',
    data:'<circle cx="8" cy="8" r="5.6"/><path d="M8 4.9V8l2.1 1.5"/>'
  };
  /* One small shape per day status, drawn in currentColor on a 12-unit grid: the same
     shape in the rail, the calendar, the legend, the day card and the review sheet. */
  const CO_MK={
    done:'<circle cx="6" cy="6" r="5.2" fill="currentColor"/><path d="M3.7 6.2 5.3 7.8 8.4 4.5" fill="none" stroke="#0d0b16" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    partial:'<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor"/>',
    missed:'<circle cx="6" cy="6" r="3.9" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    excused:'<path d="M3.1 8.9 8.9 3.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    moved:'<path d="M2.4 6h6.6M6.7 3.4 9.3 6 6.7 8.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    rest:'<path d="M3 6h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    none:'<circle cx="6" cy="6" r="1.4" fill="currentColor"/>'
  };
  const CO_KIND={FullA:'full',FullB:'full',FullC:'full',Push:'push',Pull:'pull',Legs:'legs',Pump:'legs',Zone2:'walk',Floorball:'fb',Rest:'rest'};
  const CO_SHORT={FullA:'Full A',FullB:'Full B',FullC:'Full C',Zone2:'Walk',Rest:'Rest',Floorball:'FB',Push:'Push',Pull:'Pull',Legs:'Legs',Pump:'Legs'};
  const CO_LETTER={FullA:'A',FullB:'B',FullC:'C',Push:'Pu',Pull:'Pl',Legs:'Lg',Pump:'Lg'};
  const CO_REASONS=[['sick','Sick'],['travel','Travel'],['rest','Rest'],['other','Other']];
  const coIcon=k=>`<svg class="co-gl" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${CO_GLYPH[k]||''}</svg>`;
  const coMark=(k,cls)=>`<svg class="${cls||'co-cm'} is-${k}" viewBox="0 0 12 12" aria-hidden="true" focusable="false">${CO_MK[k]||CO_MK.none}</svg>`;
  const coArrow=d=>`<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">${d==='up'?'<path d="M6 10V2.6M2.9 5.6 6 2.5l3.1 3.1"/>':d==='dn'?'<path d="M6 2v7.4M2.9 6.4 6 9.5l3.1-3.1"/>':'<path d="M2.4 6h7.2M6.9 3.5 9.4 6 6.9 8.5"/>'}</svg>`;
  const coIsLift=t=>!!t&&!['Rest','Zone2','Floorball'].includes(t);
  const coDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(N.dateMs(d));
  const coDow=d=>coDate(d)?new Date(N.dateMs(d)).toLocaleDateString('en-SG',{weekday:'short',timeZone:'UTC'}):'';
  const coDayShort=d=>coDate(d)?coDow(d)+' '+N.shortDate(d):'';
  const coNum=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
  /* Every read goes through here, so an engine failure can never break a screen. */
  function coachCall(name,...args){
    try{const C=N.coach;return C&&typeof C[name]==='function'?C[name](...args):null;}catch(e){return null;}
  }
  /* The status the engine reports, as a word and a shape (never colour alone, I6). */
  function coStatus(dc){
    if(!dc)return null;
    const why=dc.reason&&dc.reason!=='other'?' · '+dc.reason:'';
    switch(dc.status){
      case 'done':return {k:'done',w:'Done'};
      case 'partial':return {k:'partial',w:dc.logged&&dc.logged.sets>0?'Partly logged':'Plan not done'};
      case 'missed':return {k:'missed',w:'Not logged'};
      case 'excused':return {k:'excused',w:'Excused'+why};
      case 'moved':return {k:'moved',w:'Moved'+(dc.movedTo?' to '+N.shortDate(dc.movedTo):'')};
      case 'rest':return {k:'rest',w:'Rest'};
      case 'today':return {k:'plan',w:'Today'};
      case 'upcoming':return {k:'plan',w:'Planned'};
      default:return {k:'none',w:'No record'};
    }
  }
  /* What was actually logged that day, from the engine's own counts. Cardio is named;
     any other activity stays generic (D55: switched-off features are never named). */
  function coLogged(dc){
    const l=dc&&dc.logged||{},bits=[];
    if(l.sets>0)bits.push(`${l.sets} ${l.sets===1?'set':'sets'}`);
    if(l.cardioMin>0)bits.push(`${l.cardioMin} min cardio`);
    if(l.floorball>0&&!bits.length)bits.push('other activity');
    return bits.join(' · ');
  }
  const coInstead=p=>{const l=p&&p.logged||{};return l.cardioMin>0?`${l.cardioMin} min of cardio`:l.floorball>0?'other activity':'';};
  function coRange(ws,we){
    if(!coDate(ws)||!coDate(we))return '';
    const sb=N.shortDate(we),sa=N.shortDate(ws);
    return sa.split(' ').slice(1).join(' ')===sb.split(' ').slice(1).join(' ')?`${Number(ws.slice(8,10))}–${sb}`:`${sa}–${sb}`;
  }
  /* Train's coach line and its target rows: the coordinated advice when the engine has
     it (it is coachFor()'s own output unless a load step meets a cautious weight
     decision, then a hold), else coachFor() itself. */
  function coachAdvice(ex){
    try{
      const a=N.coach&&typeof N.coach.trainAdvice==='function'?N.coach.trainAdvice(ex):null;
      if(a)return a;
    }catch(e){/* fall through to the plain coach */}
    return N.coachFor(ex);
  }

  /* ---- Today · Coach stack ---------------------------------------------------------
     NXT.coach.insights(): at most three, ranked by the engine. weight.review repeats the
     Decision card's headline directly below, so it is not stacked here (engine report,
     integration note 3); the next-ranked insight takes its place. */
  function coachStackHTML() {
    ui.coachList=[];
    const list=coachCall('insights');
    if(!Array.isArray(list))return '';
    const pool=(Array.isArray(list.all)&&list.all.length?list.all:list).filter(it=>it&&it.id&&it.id!=='weight.review').slice(0,3);
    ui.coachList=pool;
    return pool.map(coachTileHTML).join('');
  }
  function coachTileHTML(it,i) {
    const dom=CO_DOM[it.domain]?it.domain:'data';
    const sev=it.severity==='act'||it.severity==='watch'?it.severity:'info';
    const ev=(Array.isArray(it.evidence)?it.evidence:[]).filter(e=>e&&e.label&&e.value!==undefined&&e.value!==null&&String(e.value)!=='');
    /* Three chips are enough on a phone; the folded "Why" carries the evidence sentence. */
    const chips=ev.slice(0,3).map(e=>`<li class="co-chip"><span class="co-chip-l">${esc(e.label)}</span><span class="co-chip-d" aria-hidden="true">·</span><b class="co-chip-v">${esc(e.value)}</b></li>`).join('');
    const w=it.why||{};
    const rows=[['Noticed',w.noticed],['Evidence',w.evidence],['Why it matters',w.matters],['What you can do',w.canDo]].filter(r=>r[1]);
    const why=rows.length?`<details class="co-why"><summary><span>Why</span><i aria-hidden="true">›</i></summary><dl>${rows.map(r=>`<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join('')}</dl></details>`:'';
    /* One primary capsule per tile at most, and only on an act: a watch or info action takes the quieter glass capsule (D56 tiers), so a stack of tiles never reads as three competing primaries. */
    const opensTrain=it.action&&it.action.kind==='open'&&it.action.payload&&it.action.payload.tab==='train';
    const act=it.action&&it.action.label?`<button type="button" class="${sev==='act'&&!opensTrain?'st-cta':'is-q'} co-act" onclick="NXP.coachAct(${i})">${esc(it.action.label)}<span aria-hidden="true">›</span></button>`:'';
    const sevHTML=sev==='info'?'':`<span class="co-sev"><i class="co-sh" aria-hidden="true"></i>${sev==='act'?'Action':'Watch'}</span>`;
    return `<article class="st-tile co-tile is-${sev} is-d-${dom}" aria-labelledby="co-h${i}">
          <div class="st-tile-head co-eb"><span class="co-tags"><span class="st-cat co-dom">${coIcon(dom)}<span>${esc(CO_DOM[dom])}</span></span>${sevHTML}</span><button type="button" class="vn-text co-dismiss" onclick="NXP.coachDismiss(${i})" aria-label="${esc('Dismiss: '+it.title)}">Dismiss</button></div>
          <h2 class="co-title" id="co-h${i}">${esc(it.title)}</h2>
          ${it.body?`<p class="co-body">${esc(it.body)}</p>`:''}
          ${chips?`<ul class="co-chips" aria-label="Evidence">${chips}</ul>`:''}
          ${act}
          ${why}
        </article>`;
  }
  /* Each action maps to the function that already exists (engine report §3.5). */
  function coachAct(i) {
    const it=ui.coachList&&ui.coachList[i],a=it&&it.action;
    if(!a)return;
    const p=a.payload||{};
    if(a.kind==='catchUp')return catchUpSheet();
    if(a.kind==='excuse')return excuseSheet(p.date);
    if(p.sheet==='review')return N.openReview();
    if(p.sheet==='cardio')return showCardioSheet();
    if(p.sheet==='weight')return apx95OpenQuickWeight();
    if(p.sheet==='day')return N.openDay(p.date);
    if(p.tab==='train')return switchTab('train');
    if(p.tab==='weight'){if(p.view==='strength')N.ui.view='strength';return switchTab('weight');}
  }
  function coachDismiss(i) {
    /* The stack repaints at once, so a second tap in the same spot would land on the tile that moved up. */
    const now=Date.now();
    if(ui.coachTap&&now-ui.coachTap<450)return;
    ui.coachTap=now;
    const it=ui.coachList&&ui.coachList[i];
    if(it&&N.coach)N.coach.dismiss(it.id,it.fingerprint);
  }

  /* ---- Catch-up: the confirmation shows what changes before anything is written ------
     The proposal's consequences are the engine's sentences, listed as they come. */
  function catchUpSheet() {
    const p=coachCall('catchUp');
    if(!p){if(typeof toast==='function')toast('This catch-up no longer applies.');return;}
    ui.catchUp=p;
    const inst=coInstead(p);
    N.modal(`Move ${p.missedLabel} to today?`,`<div class="co-sheet">
      <p class="co-lead">${esc(p.missedLabel)} was planned for ${esc(coDayShort(p.missedDate))} and has no logged sets${inst?` (${esc(inst)} instead)`:''}. This is exactly what changes. Nothing is saved until you confirm.</p>
      <h3 class="co-sec">What changes</h3>
      <ul class="co-eff">${(p.consequences||[]).map(c=>`<li><i aria-hidden="true"></i><span>${esc(c)}</span></li>`).join('')}</ul>
      <div class="n99-stack">${button('Move to today','NXP.catchUpApply()')}${button(`Mark ${esc(coDow(p.missedDate))} excused`,`NXP.excuseSheet('${p.missedDate}')`,true)}</div>
    </div>`);
  }
  function catchUpApply() {
    const p=ui.catchUp;ui.catchUp=null;
    if(!p||!N.coach)return;
    let ok=false;
    try{ok=N.coach.applyCatchUp(p);}catch(e){ok=false;}
    /* A refused (stale) proposal writes nothing; close the sheet and show the truth. */
    if(!ok){closeModal();N.repaint();}
  }

  /* ---- Excuse: Sick / Travel / Rest / Other, from the coach, History and the day sheet -- */
  function excuseSheet(date) {
    const dc=coachCall('dayContext',date);
    if(!dc||!coDate(date))return;
    const on=dc.status==='excused',cur=on?dc.reason:null;
    const lead=on
      ?`${dc.label} · ${coDayShort(date)}. It does not count as missed. Pick another reason, or remove the excuse.`
      :`${dc.label} · ${coDayShort(date)}. Mark it excused so it stops counting as missed. Your plan and your logged records do not change.`;
    N.modal(on?'Excused':'Didn’t happen?',`<div class="co-sheet">
      <p class="co-lead">${esc(lead)}</p>
      <div class="n99-picker co-reasons" role="group" aria-label="Reason">${CO_REASONS.map(([k,t])=>`<button type="button" class="n99-button secondary${cur===k?' is-on':''}" aria-pressed="${cur===k?'true':'false'}" onclick="NXT.coach.excuse('${date}','${k}')">${t}</button>`).join('')}</div>
      ${on?`<div class="n99-stack">${button('Remove excuse',`NXT.coach.unexcuse('${date}')`,true)}</div>`:''}
    </div>`);
  }

  /* ---- Today · Week in review --------------------------------------------------------- */
  function reviewTileHTML() {
    ui.coachReview=null;
    const rv=coachCall('weekReview');
    if(!rv||rv.seen||!coDate(rv.weekStart))return '';
    ui.coachReview=rv;
    const range=coRange(rv.weekStart,rv.weekEnd);
    const L=rv.lifts||{},vs=rv.vsPrev||{},cd=rv.cardio||{},wt=rv.weight||{},oc=rv.outcomes||{};
    const done=coNum(L.done),plan=coNum(L.planned),sets=coNum(rv.sets),dSets=coNum(vs.sets),cMin=coNum(cd.min),cTgt=coNum(cd.target),avg=coNum(wt.avg),dW=coNum(wt.change);
    const setsCtx=dSets===null?'':dSets>0?`<span class="co-fig-s is-good">${coArrow('up')}${dSets} more</span>`:dSets<0?`<span class="co-fig-s">${coArrow('dn')}${Math.abs(dSets)} fewer</span>`:`<span class="co-fig-s">${coArrow('eq')}same</span>`;
    const wCtx=dW===null?'<span class="co-fig-s">kg avg</span>':Math.abs(dW)<0.05?`<span class="co-fig-s">${coArrow('eq')}level</span>`:dW<0?`<span class="co-fig-s is-good">${coArrow('dn')}${Math.abs(dW).toFixed(1)} kg lower</span>`:`<span class="co-fig-s is-up">${coArrow('up')}${dW.toFixed(1)} kg higher</span>`;
    const fig=(l,v,u,ctx)=>`<div class="co-fig-c" role="listitem"><small>${l}</small><b class="vn-num">${v}${u?`<em>${u}</em>`:''}</b>${ctx}</div>`;
    const strip=`<div class="co-fig" role="list" aria-label="Last week in four figures">${
      fig('Lifting',done===null?'—':done,plan===null?'':'/'+plan,'<span class="co-fig-s">days</span>')+
      fig('Sets',sets===null?'—':sets,'',setsCtx||'<span class="co-fig-s">working</span>')+
      fig('Cardio',cMin===null?'—':cMin,cTgt===null?'':'/'+cTgt,'<span class="co-fig-s">min</span>')+
      fig('Weight',avg===null?'—':avg.toFixed(1),'',wCtx)
    }</div>`;
    const compared=(coNum(oc.beat)||0)+(coNum(oc.matched)||0)+(coNum(oc.below)||0);
    const outcomes=compared?`<p class="co-out"><span class="co-out-l">Best set vs last time</span><span class="is-beat"><i aria-hidden="true"></i><b class="vn-num">${oc.beat}</b> beat</span><span class="is-same"><i aria-hidden="true"></i><b class="vn-num">${oc.matched}</b> matched</span><span class="is-below"><i aria-hidden="true"></i><b class="vn-num">${oc.below}</b> below</span></p>`:'';
    /* The engine's own "Excused: …" and "Moved: …" lines, shown only when it wrote them. */
    const xm=(Array.isArray(rv.lines)?rv.lines:[]).filter(l=>/^(Excused|Moved): /.test(l)).map(l=>`<p class="co-xm">${esc(l)}</p>`).join('');
    return `<article class="st-tile co-tile co-review is-info" aria-labelledby="co-rv-h">
          <button type="button" class="co-open" onclick="NXP.reviewSheet()" aria-label="${esc('Open last week in review, '+range)}"></button>
          <div class="st-tile-head co-eb"><span class="st-cat co-dom">${coIcon('schedule')}<span>Last week · ${esc(range)}</span></span><button type="button" class="vn-text co-got" onclick="NXP.reviewSeen()">Got it</button></div>
          <h2 class="co-title" id="co-rv-h">${esc(rv.headline||'Last week')}</h2>
          ${strip}${outcomes}${xm}
          <p class="co-more" aria-hidden="true"><span>See the week</span><i>›</i></p>
        </article>`;
  }
  function reviewSheet() {
    const rv=ui.coachReview||coachCall('weekReview');
    if(!rv||!coDate(rv.weekStart))return;
    ui.coachReview=rv;
    const days=(Array.isArray(rv.days)?rv.days:[]).map(dc=>{
      const st=coStatus(dc),detail=coLogged(dc);
      return `<li class="co-day is-${st.k}"><span class="co-day-d"><b>${esc(coDow(dc.date))}</b><small class="vn-num">${Number(dc.date.slice(8,10))}</small></span><span class="co-day-t">${esc(dc.label)}${detail?`<small>${esc(detail)}</small>`:''}</span><span class="co-day-s">${coMark(st.k,'co-cm')}<span>${esc(st.w)}</span></span></li>`;
    }).join('');
    const next=(Array.isArray(rv.nextWeek)?rv.nextWeek:[]).map(n=>{
      const k=CO_KIND[n.type]||(coIsLift(n.type)?'full':'rest');
      return `<li class="co-nw-c is-k-${k}" aria-label="${esc(coDayShort(n.date)+' · '+n.label)}"><b>${esc(coDow(n.date).slice(0,1))}</b><span>${esc(CO_SHORT[n.type]||String(n.type).slice(0,4))}</span></li>`;
    }).join('');
    const lines=(Array.isArray(rv.lines)?rv.lines:[]).map(l=>`<li>${esc(l)}</li>`).join('');
    N.modal('Last week · '+coRange(rv.weekStart,rv.weekEnd),`<div class="co-sheet co-rvs">
      <p class="co-lead co-lead-h">${esc(rv.headline||'')}</p>
      <ol class="co-days" aria-label="The seven days">${days}</ol>
      ${lines?`<h3 class="co-sec">The week</h3><ul class="co-lines">${lines}</ul>`:''}
      ${next?`<h3 class="co-sec">This week</h3><ol class="co-nw" aria-label="This week's plan">${next}</ol>`:''}
      <div class="n99-stack">${button('Done','NXP.reviewSeen()')}</div>
    </div>`);
  }
  /* Both "Got it" and the sheet's Done mark the week seen; commit() closes the sheet and repaints. */
  function reviewSeen() {
    const rv=ui.coachReview||coachCall('weekReview');
    if(rv&&coDate(rv.weekStart)&&N.coach)N.coach.markReviewSeen(rv.weekStart);
  }

  /* ---- Train · a catch-up row on a non-lifting idle day ------------------------------- */
  function catchUpRowHTML() {
    const p=coachCall('catchUp');
    if(!p)return '';
    const k=Math.round((N.dateMs(state.date)-N.dateMs(p.missedDate))/864e5),inst=coInstead(p);
    const when=k>=7?'last '+coDow(p.missedDate):coDow(p.missedDate);
    return `<button type="button" class="co-row" onclick="NXP.catchUpSheet()"><span class="co-row-i" aria-hidden="true"><svg viewBox="0 0 12 12" focusable="false"><path d="M2.4 6h6.6M6.7 3.4 9.3 6 6.7 8.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="co-row-t"><b>${esc(p.missedLabel)} didn’t happen ${esc(when)}${inst?` (${esc(inst)} instead)`:''} — do it today?</b><span class="co-row-s">Optional. You confirm before anything is saved.</span></span><i class="co-row-c" aria-hidden="true">›</i></button>`;
  }

  /* ---- History · calendar marks and the day card --------------------------------------- */
  function coachDayMap(start,end) {
    const list=coachCall('dayStatuses',start,end);
    if(!Array.isArray(list)||!list.length)return null;
    const m=new Map();
    list.forEach(x=>{if(x&&x.date)m.set(x.date,x);});
    return m;
  }
  /* The mark a calendar cell carries: a faint session letter on a planned lifting day, a
     hollow ring for "Not logged", a short slash for "Excused", an arrow for "Moved".
     Floorball is not drawn (D40) and the marks follow the History filter. */
  function coCalMark(dc,scope) {
    if(!dc)return null;
    const lift=coIsLift(dc.type),cond=dc.type==='Zone2';
    if(!((lift&&scope.lift)||(cond&&scope.cond)))return null;
    const nm=dc.label;
    if(dc.status==='missed')return {k:'missed',aria:`${nm} not logged`};
    if(dc.status==='excused')return {k:'excused',aria:`${nm} excused${dc.reason&&dc.reason!=='other'?', '+dc.reason:''}`};
    if(dc.status==='moved')return {k:'moved',aria:`${nm} moved${dc.movedTo?' to '+N.shortDate(dc.movedTo):''}`};
    if(lift&&(dc.status==='upcoming'||dc.status==='today'))return {k:'plan',letter:CO_LETTER[dc.type]||String(nm||dc.type).slice(0,1).toUpperCase(),aria:`planned ${nm}`};
    return null;
  }
  const coCalMarkHTML=cm=>!cm?'':cm.k==='plan'?`<em class="co-cm-l" aria-hidden="true">${esc(cm.letter)}</em>`:coMark(cm.k,'co-cm');
  /* The day card's status line: the word, the shape, the plan it belongs to and, for a day
     the engine would accept an excuse for, the text action that opens the excuse sheet. */
  function coachDayLine(date,scope) {
    const dc=coDate(date)?coachCall('dayContext',date):null;
    if(!dc)return '';
    const lift=coIsLift(dc.type),cond=dc.type==='Zone2';
    if(!((lift&&scope.lift)||(cond&&scope.cond)))return '';
    const past=date<state.date,st=coStatus(dc);
    const show=['missed','partial','excused','moved'].includes(dc.status)||(['upcoming','today'].includes(dc.status)&&lift);
    if(!show&&!dc.movedFrom)return '';
    let action='';
    if(dc.status==='excused')action=`<button type="button" class="vn-text co-ds-a" onclick="NXP.excuseSheet('${date}')">Remove excuse</button>`;
    else if(past&&(dc.status==='missed'||dc.status==='partial')&&!dateRows(date).length)action=`<button type="button" class="vn-text co-ds-a" onclick="NXP.excuseSheet('${date}')">Excuse this day</button>`;
    const from=dc.movedFrom?coachCall('dayContext',dc.movedFrom):null;
    const note=dc.movedFrom?`<p class="co-ds-n">${esc(from&&from.label?from.label+' moved here from '+coDayShort(dc.movedFrom)+'.':'A session moved here from '+coDayShort(dc.movedFrom)+'.')}</p>`:'';
    return `${show||action?`<div class="co-ds is-${st.k}" data-cs="${esc(dc.status)}">${show?`<span class="co-ds-w">${coMark(st.k,'co-cm')}<b>${esc(st.w)}</b><span>${esc(dc.label)}</span></span>`:''}${action}</div>`:''}${note}`;
  }
  /* ---- Today tiles (Strata direction, D19) --------------------------------
     Every figure is read from the engine: the trend series is N.trend() over
     N.weights() (the same canonical rows chartModel() plots), weekly means are
     N.windowStats(), scans come from the saved Evo records. Nothing here
     computes a new statistic or a score. */
  /* Progress as a number with a thin bar under it (no rings: they read as
     empty at a glance). */
  function ringHTML(value,target,unit,color) {
    const v=Math.max(0,Number(value)||0),tg=Math.max(1,Number(target)||1),pct=Math.min(100,v/tg*100);
    return `<span class="st-count" style="--rc:${color}" role="img" aria-label="${v} of ${tg} ${esc(unit)}"><span class="st-count-v"><b class="vn-num">${v}</b><small>/${tg}</small></span><span class="st-count-u">${esc(unit)}</span><span class="st-count-bar"><i style="width:${pct.toFixed(0)}%"></i></span></span>`;
  }
  /* Compact weight: the canonical 7-day trend and the engine's weekly rate.
     The chart itself lives on Progress. */
  function decEvidenceHTML(trendEv,confEv,plateau) {
    const rate=N.finite(plateau&&plateau.weeklyRate);
    const dir=rate===null?'flat':rate<-0.05?'down':rate>0.05?'up':'flat';
    /* D50 — the trend chip is a 28-day mini chart: the engine's trend line over an area,
       each morning reading as a faint dot, the first and last trend values named. Same
       window as the four-week rate it sits beside. Drawn from N.trend(N.weights()) only. */
    const from=N.dateAdd(state.date,-27);
    const series=N.trend(N.weights()).filter(p=>p.date>=from&&p.date<=state.date);
    const tr=series.filter(p=>p.avg!==null);
    let plot='',range='';
    if(tr.length>=4){
      const W=300,H=64,padX=4,padT=8,padB=6;
      const vals=series.flatMap(p=>p.avg===null?[p.weight]:[p.weight,p.avg]);
      const lo=Math.min(...vals),hi=Math.max(...vals),span=(hi-lo)||1;
      const t0=N.dateMs(from),t1=N.dateMs(state.date),xs=ms=>padX+(ms-t0)/((t1-t0)||1)*(W-padX*2);
      const ys=v=>padT+(hi-v)/span*(H-padT-padB);
      const line=tr.map(p=>[xs(N.dateMs(p.date)),ys(p.avg)]);
      const d=line.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
      const area=d+` L ${line.at(-1)[0].toFixed(1)} ${H} L ${line[0][0].toFixed(1)} ${H} Z`;
      const dots=series.map(p=>`<circle class="st-dec-raw" cx="${xs(N.dateMs(p.date)).toFixed(1)}" cy="${ys(p.weight).toFixed(1)}" r="1.9"/>`).join('');
      const e=line.at(-1),gid='stdg'+Math.random().toString(36).slice(2,6);
      plot=`<svg class="st-dec-plot" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset=".72" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#${gid})" class="st-dec-area"/>${dots}<path class="st-dec-line" pathLength="1" d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle class="st-dec-dot" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="3.6" fill="currentColor"/></svg>`;
      range=`<span class="st-dec-range vn-num">${tr[0].avg.toFixed(1)} → ${tr.at(-1).avg.toFixed(1)} kg</span>`;
    }
    const arrow={down:'M12 5v13M6.5 12.5 12 18l5.5-5.5',up:'M12 19V6M6.5 11.5 12 6l5.5 5.5',flat:'M5 12h14'}[dir];
    const lvl={low:1,medium:2,high:3}[String(confEv).toLowerCase()]||0;
    const bars=lvl?`<span class="st-dec-bars" aria-hidden="true">${[1,2,3].map(i=>`<i class="${i<=lvl?'on':''}"></i>`).join('')}</span>`:'';
    const label=`Open your weight trend. Trend ${trendEv}${tr.length>=4?`, ${tr[0].avg.toFixed(1)} to ${tr.at(-1).avg.toFixed(1)} kilograms over 28 days`:''}`;
    return `<div class="st-dec-ev${plot?' has-plot':''}">
      <button type="button" class="st-dec-chip st-dec-trend is-${dir}${plot?' st-dec-chart':''}" onclick="NXT.ui.view='overview';switchTab('weight')" aria-label="${esc(label)}"><span class="st-dec-top"><span class="st-dec-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${arrow}"/></svg></span><span class="st-dec-txt"><small>Trend${plot?' · 28 days':''}</small><b class="vn-num st-dec-val">${esc(trendEv)}</b></span>${range}</span>${plot}</button>
      <button type="button" class="st-dec-chip st-dec-conf" onclick="NXT.openReview()" aria-label="Why this confidence"><span class="st-dec-txt"><small>Confidence</small><b>${esc(confEv)}</b></span>${bars}</button>
    </div>`;
  }
  function weightTileHTML() {
    const rows=N.weights();
    if(!rows.length)return `<button type="button" class="st-tile st-mini" style="--c:var(--st-weight)" onclick="apx95OpenQuickWeight()"><span class="st-cat">Weight</span><span class="st-mini-v">—</span><span class="st-meta">Log a weigh-in</span></button>`;
    const s=N.trend(rows).filter(p=>p.avg!==null).at(-1);
    const v=s?s.avg:rows.at(-1).weight;
    const pl=N.detectPlateau(rows),rate=N.finite(pl&&pl.weeklyRate);
    return `<button type="button" class="st-tile st-mini" style="--c:var(--st-weight)" onclick="NXT.ui.view='overview';switchTab('weight')">
      <span class="st-cat">Trend</span>
      <span class="st-mini-v"><b class="st-odo st-odo-sm" data-st-odo="${v.toFixed(1)}">${v.toFixed(1)}</b><small>kg</small></span>
      <span class="st-meta">${rate!==null&&pl.ok?(Math.abs(rate)<0.05?'Flat':`${N.signed(rate)}/wk`):'7-day trend'}</span>
    </button>`;
  }
  /* D20 comparison for any logged lifting day: best set per exercise against the
     previous session of that exercise at that gym. Same rule as the finish card. */
  function liftOutcome(date,gym) {
    const rows=N.workRows().filter(r=>r.date===date&&(r.gym||'Gym A')===gym&&r.setType!=='warmup'),byEx={};
    rows.forEach(r=>{(byEx[r.exercise||r.name]=byEx[r.exercise||r.name]||[]).push(r);});
    let up=0,same=0,down=0,compared=0;
    Object.entries(byEx).forEach(([name,sets])=>{
      const prev=N.sessionRows(name,gym,date,100).at(-1);
      if(!prev||!prev.sets||!prev.sets.length)return;
      compared+=1;
      const a=N.bestSet(sets),b=N.bestSet(prev.sets);
      const dw=Number(a.weight)-Number(b.weight),dr=Number(a.reps)-Number(b.reps);
      if(dw>0||(dw===0&&dr>0))up+=1; else if(dw===0&&dr===0)same+=1; else down+=1;
    });
    return {up,same,down,compared,exercises:Object.keys(byEx).length};
  }
  function bodyTileHTML() {
    const scans=bodyScanSource().filter(s=>s&&N.finite(s.weight)!==null);
    if(!scans.length)return '';
    const L=scans.at(-1),P=scans.at(-2)||null;
    /* Change pills read by metric, not by sign: less fat is good news, less muscle is
       something to watch (never a claim it was preserved), scale weight is neutral. The
       arrow and the number always carry the direction, so colour is never alone. */
    const ARW={dn:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v7.5M2.8 6.6 6 9.8l3.2-3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',up:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2.5M2.8 5.4 6 2.2l3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',eq:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'};
    const tone=(k,dir)=>dir==='eq'?'is-none':k==='muscleMass'?(dir==='dn'?'is-watch':'is-none'):k==='weight'?'is-none':(dir==='dn'?'is-down':'is-up');
    const cell=(k,label,unit,c)=>{
      const v=N.finite(L[k]);if(v===null)return '';
      const pv=P?N.finite(P[k]):null,d=pv===null?null:v-pv,dir=d===null?null:Math.abs(d)<0.05?'eq':d<0?'dn':'up';
      return `<span class="st-scan-c" style="--c:${c}"><small>${label}</small><b class="vn-num">${v.toFixed(1)}<em>${unit}</em></b>${d===null?'':`<span class="wx-chip ${tone(k,dir)}" aria-label="${dir==='eq'?'unchanged':(dir==='dn'?'down ':'up ')+Math.abs(d).toFixed(1)+' '+unit}">${ARW[dir]}${Math.abs(d).toFixed(1)}</span>`}</span>`;
    };
    return `<button type="button" class="st-tile st-t-body" style="--c:var(--st-fat)" onclick="NXT.ui.view='body';switchTab('weight')">
      <div class="st-tile-head"><span class="st-cat">Latest Evo scan</span><span class="st-meta">${esc(N.shortDate(L.date))}${P?`<span class="st-scan-vs"> · vs ${esc(N.shortDate(P.date))}</span>`:''}</span></div>
      <div class="st-scan-g">${cell('bodyFat','Fat %','%','var(--st-fat)')}${cell('fatMass','Fat mass','kg','var(--st-fat)')}${cell('muscleMass','Muscle','kg','var(--st-lean)')}${cell('weight','Weight','kg','var(--st-weight)')}</div>
    </button>`;
  }
  function previewAllowed() {
    const sync=NXT.wearables&&NXT.wearables.sync;
    if(sync&&typeof sync.previewAllowed==='function')return !!sync.previewAllowed();
    try {
      const host=String(location.hostname||'');
      return host==='localhost'||host==='127.0.0.1'||host==='[::1]'||host==='::1'||location.protocol==='file:';
    } catch (e) { return false; }
  }
  function recoveryPreview() {
    if(!previewAllowed())return null;
    return (typeof NXT==='object'&&NXT&&NXT.recoveryPreview)||null;
  }
  function currentIntegrated() {
    const preview=recoveryPreview();
    const sync=NXT.wearables&&NXT.wearables.sync;
    const manual=N.cfg().recovery[state.date]||null;
    if(sync&&typeof sync.integrateToday==='function'){
      const out=sync.integrateToday({local_date:state.date,manualRecovery:manual});
      if(out)return out;
    }
    if(preview&&preview.integrated)return preview.integrated;
    const api=NXT.wearables&&NXT.wearables.recoveryIntegration;
    if(!api||typeof api.integrate!=='function')return null;
    const wearable=sync&&sync.runtime&&sync.runtime.wearableByDate?sync.runtime.wearableByDate[state.date]:null;
    const out=api.integrate({
      local_date:state.date,
      manualRecovery:manual,
      wearableRecovery:wearable||(preview&&preview.wearableRecovery)||null,
      wearableLocalDate:(wearable||(preview&&preview.wearableRecovery))?state.date:null
    });
    return out&&out.result||null;
  }
  function currentTraining(integrated) {
    const api=NXT.wearables&&NXT.wearables.trainingReadiness;
    if(api&&typeof api.advise==='function'&&integrated){
      const out=api.advise({integratedRecovery:integrated});
      if(out&&out.result)return out.result;
    }
    const preview=recoveryPreview();
    if(preview&&preview.training)return preview.training;
    return null;
  }
  function wearableConnectionLabel() {
    const sync=NXT.wearables&&NXT.wearables.sync;
    const list=sync&&typeof sync.listConnections==='function'?sync.listConnections():[];
    const live=list.find(c=>c&&c.sync_enabled!==false&&c.state&&c.state!=='disconnected');
    if(!live)return 'Not connected';
    if(live.state==='syncing')return 'Syncing';
    if(live.state==='auth_expired')return 'Reconnect';
    if(live.state==='degraded'||live.state==='error')return 'Needs attention';
    if(live.state==='connected'||live.state==='sync_pending')return 'Connected';
    return 'Not connected';
  }
  function openWearableConnection() {
    const sync=NXT.wearables&&NXT.wearables.sync;
    const live=sync&&typeof sync.connectLive==='function'?sync.connectLive({provider_id:'garmin.connect'}):null;
    const decision=(live&&live.live_auth&&live.live_auth.decision)||'LIVE PROVIDER AUTH DEFERRED — SECURE BACKEND / PROVIDER ACCESS REQUIRED';
    N.modal('Connect wearable',`<p>Wearable connection stays disconnected until a confidential backend can complete provider OAuth. Historical canonical evidence already on this device is not erased if you disconnect later.</p><p class="n99-small">${esc(decision)}</p>${button('Close','closeModal()',true)}`);
  }
  function recoveryHomeCard() {
    const integrated=currentIntegrated();
    const guard=NXT.wearables&&NXT.wearables.trainingReadiness;
    const wear=guard&&typeof guard.presentWearable==='function'&&integrated?guard.presentWearable(integrated):{has_score:false,caption:'No wearable data',headline:null,status_note:null};
    const check=guard&&typeof guard.presentCheckin==='function'&&integrated?guard.presentCheckin(integrated):{label:'Not logged',detail:'No check-in today',present:false};
    const wearValue=wear.has_score&&wear.headline!=null?wear.headline:'—';
    const wearNote=wear.status_note?` <em>${esc(wear.status_note)}</em>`:'';
    return `<button type="button" class="nxp-home-recovery" onclick="NXP.openRecovery()"><span class="nxp-caption">Recovery</span><span class="nxp-rec-source"><small>Wearable</small><strong>${esc(wearValue)}</strong><span>${esc(wear.caption||'')}${wearNote}</span></span><span class="nxp-rec-source"><small>Check-in</small><strong>${esc(check.label)}</strong><span>${esc(check.detail||'')}</span></span></button>`;
  }
  function trainGuidanceHTML() {
    const training=currentTraining(currentIntegrated());
    if(!training||training.state==='no_recovery_signal'||training.state==='proceed')return '';
    const detail=training.guidance&&training.guidance.detail?`<small>${esc(training.guidance.detail)}</small>`:'';
    return `<aside class="nxp-train-rec" data-state="${esc(training.state)}"><span class="nxp-caption">Recovery guidance</span><strong>${esc(training.guidance.message)}</strong>${detail}</aside>`;
  }
  function openRecovery() {
    const integrated=currentIntegrated();
    const guard=NXT.wearables&&NXT.wearables.trainingReadiness;
    const wear=guard&&integrated?guard.presentWearable(integrated):null;
    const check=guard&&integrated?guard.presentCheckin(integrated):null;
    const signals=guard&&integrated&&typeof guard.describeSignals==='function'?guard.describeSignals(integrated):[];
    const wearLine=wear&&wear.has_score?`<p class="nxp-rec-hero"><b>${esc(wear.headline)}</b><span>${esc(wear.caption||'')}${wear.status_note?' · '+esc(wear.status_note):''}</span></p>`:`<p class="nxp-rec-hero"><b>—</b><span>${esc(wear&&wear.caption||'No wearable data')}</span></p>`;
    const checkLine=`<p class="nxp-rec-checkin"><b>${esc(check&&check.label||'Not logged')}</b><span>${esc(check&&check.detail||'No check-in today')}</span></p>`;
    const signalHTML=signals.map(function(s){
      if(!s.selected||!s.value)return `<div class="nxp-rec-signal"><b>${esc(s.name)}</b><p>${esc(s.trend)}</p></div>`;
      return `<div class="nxp-rec-signal"><b>${esc(s.name)}</b><strong>${esc(s.value)}</strong><p>${esc(s.trend)}</p></div>`;
    }).join('');
    N.modal('Recovery',`<div class="nxp-rec-detail"><h3>Wearable</h3>${wearLine}${signalHTML?`<div class="nxp-rec-signals">${signalHTML}</div>`:''}<h3>Check-in</h3>${checkLine}${button('Update check-in','apx96OpenReadiness()',true)}</div>`);
  }
  function setRecoveryPreview(preview) {NXT.recoveryPreview=preview||null;}
  function draftKey() {return sessionKey()+'__'+state.exercise;}
  function rememberInput(el) {
    const key=draftKey(),d=ui.drafts.get(key)||{};
    d[el.id]=el.value;ui.drafts.set(key,d);
    if(el.id!=='n99-set-type')return;
    const b=document.getElementById('nxp-log-button');
    if(!b)return;
    const label=logLabel(el.value==='warmup'?'warmup':'working',N.done(state.exercise));
    b.dataset.idleLabel=label;
    b.textContent=label;
  }
  function trainChrome() {return `<header class="nxp-train-chrome st-head"><div><p class="st-eyebrow">${esc(state.gym||'Gym')} · ${N.shortDate(state.date)}</p><h1 class="st-h1">${esc(N.label(state.dayType))}</h1></div><button type="button" class="st-chip" onclick="showSessionSheet()">Change</button></header>`;}
  function trainIdle(kind,body) {
    syncTrainNav(false);
    document.getElementById('trainPage').innerHTML=`<div class="n99 nxp nxp-train nxp-train-idle vn-train ${kind}">${trainChrome()}${trainGuidanceHTML()}${body}</div>`;
  }
  function idleSecondary(label,action) {return `<button type="button" class="n99-text" onclick="${esc(action)}">${label}</button>`;}
  function cardioWeekLine() {
    const mins=N.cardioWeek(),target=Number(settings.zone2WeeklyTarget)||90;
    return {mins,target,pct:target?Math.min(100,mins/target*100):0};
  }
  /* D50 — on a day with no lifting, Train previews the next planned lifting session from
     the saved routine: each exercise with its best set last time (D20), straight from
     N.sessionRows()/N.bestSet(). Read-only; the session is not started or changed. */
  function upNextHTML() {
    const isLift=t=>!['Rest','Zone2','Floorball'].includes(t);
    let date=null,type=null;
    for(let i=1;i<=7;i++){const d=N.dateAdd(state.date,i),t=N.typeFor(d);if(isLift(t)){date=d;type=t;break;}}
    if(!date)return '';
    const list=N.templateFor(type,state.gym)||[];
    if(!list.length)return '';
    const ahead=Math.round((N.dateMs(date)-N.dateMs(state.date))/864e5);
    const when=ahead===1?'Tomorrow':new Date(N.dateMs(date)).toLocaleDateString('en-SG',{weekday:'long',timeZone:'UTC'});
    const sets=list.reduce((a,e)=>a+Number(e.sets||0),0);
    const rows=list.map(e=>{
      const prev=N.sessionRows(e.name,state.gym,N.dateAdd(state.date,1),100).at(-1);
      const best=prev&&prev.sets&&prev.sets.length?N.bestSet(prev.sets):null;
      const last=best?`${fmtLoad(best.weight)} × ${best.reps}`:'New';
      return `<li class="st-next-row"><span class="st-next-n">${esc(e.name)}</span><span class="st-next-s">${Number(e.sets)||0} × ${Array.isArray(e.reps)?esc(e.reps.join('–')):esc(String(e.reps??''))}</span><span class="st-next-b vn-num${best?'':' is-new'}">${esc(last)}</span></li>`;
    }).join('');
    return `<section class="st-tile st-next" style="--c:var(--st-lift)" aria-label="Up next: ${esc(N.label(type))}, ${esc(when)}">
      <div class="st-tile-head"><span class="st-cat">Up next · ${esc(when)}</span><span class="st-meta">${list.length} ${N.plural(list.length,"exercise")} · ${sets} ${N.plural(sets,"set")}</span></div>
      <h2 class="st-h3">${esc(N.label(type))}</h2>
      <div class="st-next-h" aria-hidden="true"><span>Exercise</span><span>Plan</span><span>Best last time</span></div>
      <ol class="st-next-l">${rows}</ol>
    </section>`;
  }
  function cardioMeterHTML(w) {
    return `<div class="st-cmeter" role="img" aria-label="${w.mins} of ${w.target} cardio minutes this week"><div class="st-cmeter-h"><span class="st-cat">Cardio this week</span><span class="vn-num"><b>${w.mins}</b> / ${w.target} min</span></div><div class="st-cmeter-bar"><i style="width:${w.pct.toFixed(0)}%"></i></div></div>`;
  }
  function trainRest() {
    const w=cardioWeekLine();
    trainIdle('nxp-train-rest',`<section class="nxp-train-idle-copy"><h2>No lifting session due</h2><p>Recovery is part of the plan. Nothing needs to be made up today.</p></section>${catchUpRowHTML()}${cardioMeterHTML(w)}<div class="nxp-train-idle-actions">${N.features.checkin?button('Quick recovery check-in','apx96OpenReadiness()')+idleSecondary('Log cardio','showCardioSheet()'):button('Log cardio','showCardioSheet()')}</div>${upNextHTML()}${addOnSection()}`);
  }
  function trainZone2() {
    const w=cardioWeekLine();
    trainIdle('nxp-train-zone2',`<section class="nxp-train-idle-copy"><p>Zone 2 — a conversational effort. No lifting session is due.</p></section>${catchUpRowHTML()}<div class="nxp-train-pace"><span class="nxp-caption">This week</span><strong>${w.mins} <em>/ ${w.target} min</em></strong><div class="n99-session-rail" aria-hidden="true"><span style="width:${w.pct}%"></span></div></div><div class="nxp-train-idle-actions">${button('Log cardio','showCardioSheet()')}${N.features.checkin?idleSecondary('Check-in','apx96OpenReadiness()'):''}</div>${upNextHTML()}${addOnSection()}`);
  }
  function trainFloorball() {
    const recent=(state.floorball||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,3);
    trainIdle('nxp-train-floorball',`<section class="nxp-train-idle-copy"><p>Hard conditioning day. Log duration and effort.</p></section>${catchUpRowHTML()}<section class="nxp-train-floorball-log"><div class="nxp-train-floorball-grid"><label>Duration <small>min</small><input id="apx96FbDuration" type="number" min="1" max="600" inputmode="numeric"></label><label>Intensity <small>1–10</small><input id="apx96FbIntensity" type="number" min="1" max="10" inputmode="numeric"></label></div><label class="nxp-train-floorball-notes">Notes<textarea id="apx96FbNotes" rows="2" placeholder="Energy, match load, soreness…"></textarea></label><div class="nxp-train-idle-actions">${button('Save session','apx96SaveFloorball()')}</div></section>${recent.length?`<section class="nxp-train-floorball-history"><h2 class="nxp-caption">Recent</h2>${recent.map(x=>`<div class="nxp-train-recent"><span>${esc(N.shortDate(x.date))}</span><b>${esc(x.duration||'—')} min · RPE ${esc(x.intensity||'—')}</b>${x.notes?`<small>${esc(x.notes)}</small>`:''}</div>`).join('')}</section>`:`<p class="nxp-caption nxp-train-idle-metric">No Floorball sessions logged yet.</p>`}`);
  }
  /* An add-on eligible day can reach here too (a Cardio day carries no lifting
     template), and this is the one Train branch that would otherwise offer no
     way back to the optional block. addOnSection() returns nothing on days that
     are not eligible, so a strength day with an emptied plan is unchanged. */
  function trainEmpty() {
    trainIdle('nxp-train-empty',`<section class="nxp-train-idle-copy"><h2>No exercises in this session</h2><p>This session currently has no exercises.</p></section><div class="nxp-train-idle-actions">${button('Add exercise','v88OpenAddModal()')}${idleSecondary('Restore programme','NXT.fullSession()')}</div>${addOnSection()}`);
  }
  /* Strength-day overview before entering focused mode. Session data is
     untouched — leave/enter only toggles presentation (D6). */
  /* ---- Anatomy, two ways -------------------------------------------------
     Lens: a zoom onto the worked region of one exercise, ringed by that
     exercise's set progress. Map: front and back of the whole session, so the
     day's focus is readable at a glance. Both reuse NXTANAT; muscles are
     always named in text beside them. */
  function bleedHTML(name){
    /* The worked region as a lens: the engine's crop of the muscle (same
       cropFor() every other close-up uses), widened a little for context and
       set in a soft circular vignette so it reads as a detail of the body, not
       a stamp. Out of flow by CSS, so the head's height is the title's; taps
       open the same detail sheet as the title. */
    if(typeof NXTLIB==='undefined'||typeof NXTANAT==='undefined')return '';
    const m=NXTLIB.musclesFor(name);if(!m.primary.length)return '';
    const view=NXTANAT.viewFor(m.primary,[]);
    const fig=NXTANAT.figure({primary:m.primary,secondary:m.secondary,view}).replace(/viewBox="([\d.\-]+) ([\d.\-]+) ([\d.]+) ([\d.]+)"/,(s,x,y,w,h)=>{x=+x;y=+y;w=+w;h=+h;const side=Math.max(w,h)*1.35,cx=x+w/2,cy=y+h/2;return `viewBox="${(cx-side/2).toFixed(0)} ${Math.max(0,cy-side/2).toFixed(0)} ${side.toFixed(0)} ${side.toFixed(0)}"`;});
    return `<button type="button" class="st-ex-fig is-lens is-${view}" onclick="NXP.exerciseDetails()" aria-label="Show exercise details">${fig}</button>`;
  }
  function muscleMapHTML(names,title,sub){
    if(typeof NXTLIB==='undefined'||typeof NXTANAT==='undefined')return '';
    const f=NXTLIB.focusFor(names);if(!f.primary.length)return '';
    const figs=['front','back'].map(v=>`<div class="st-mm-f">${NXTANAT.figure({primary:f.primary,secondary:f.secondary,view:v,crop:false})}<small>${v==='front'?'Front':'Back'}</small></div>`).join('');
    const chips=f.primary.slice(0,6).map(id=>`<span class="st-mchip is-p">${esc(NXTANAT.label(id))}</span>`).join('')+(f.primary.length>6?`<span class="st-mchip">+${f.primary.length-6}</span>`:'');
    return `<section class="st-mm" aria-label="${esc(title)}"><p class="st-mm-h">${esc(title)}</p><div class="st-mm-figs" aria-hidden="true">${figs}</div><div class="st-mchips">${chips}</div><p class="st-mm-k"><span><i class="is-p"></i>Worked directly</span><span><i></i>Assists</span></p></section>`;
  }
  function trainLiftIdle(list) {
    const logs=N.sessionLogs(),working=logs.filter(r=>r.setType!=='warmup');
    const sets=list.reduce((a,e)=>a+Number(e.sets),0);
    const logged=list.reduce((a,e)=>a+Math.min(N.done(e.name),Number(e.sets)),0);
    const title=working.length?'Resume workout':'Start workout';
    const plan=list.map((e,i)=>{
      const done=N.done(e.name);
      const prev=N.sessionRows(e.name,state.gym,state.date,100).at(-1);
      const best=prev?N.bestSet(prev.sets):null;
      const m=typeof NXTLIB!=='undefined'?NXTLIB.musclesFor(e.name):{primary:[],secondary:[]};
      const fig=(typeof NXTANAT!=='undefined'&&m.primary.length)?NXTANAT.figure({primary:m.primary,secondary:m.secondary,view:NXTANAT.viewFor(m.primary,[])}):'';
      const complete=done>=Number(e.sets);
      return `<button type="button" class="st-plan-row${complete?' is-done':''}" style="--i:${i}" onclick="NXP.chooseExercise(${i});NXP.enterTrain()">
        <span class="st-plan-fig" aria-hidden="true">${fig}</span>
        <span class="st-plan-l"><b>${esc(e.name)}</b><small>${e.sets} × ${e.reps[0]}–${e.reps[1]}${best?` · best ${esc(trimNum(best.weight))} kg × ${esc(best.reps)}`:' · no history'}</small></span>
        <span class="st-plan-n vn-num">${complete?'✓':`${Math.min(done,e.sets)}/${e.sets}`}</span>
      </button>`;
    }).join('');
    syncTrainNav(false);
    document.getElementById('trainPage').innerHTML=`<div class="n99 nxp nxp-train nxp-train-idle st-train st-train-idle">
      ${trainChrome()}
      ${trainGuidanceHTML()}
      <section class="st-tile st-ready" style="--c:var(--st-lift)">
        <div class="st-train-row">
          <div><span class="st-cat">${working.length?'In progress':'Ready when you are'}</span>
          <h2 class="st-h2 st-mt2">${list.length} ${N.plural(list.length,"exercise")}</h2>
          <p class="st-meta">${sets} working sets${working.length?` · ${working.length} logged`:''}</p></div>
          ${logged?ringHTML(logged,sets,'sets','var(--st-lift)'):''}
        </div>
        ${muscleMapHTML(list.map(e=>e.name),'Today’s focus','')}
        <button type="button" class="st-cta" onclick="NXP.enterTrain()">${esc(title)}<span aria-hidden="true">›</span></button>
      </section>
      <section class="st-plan"><div class="st-plan-h"><h2 class="st-sect">Session plan</h2><button type="button" class="st-link" onclick="NXP.sessionMenu()">Options<span aria-hidden="true">›</span></button></div>${plan}</section>
    </div>`;
  }
  /* ---- Train: shared presentation helpers --------------------------------
     Numbers are rendered, never re-derived: every figure below comes from the
     workout engine (targetFor / done / sessionRows / cue). Nothing here invents
     metadata, so an exercise with no history simply shows fewer lines. */
  function trimNum(n) {const v=Math.round(Number(n)*1000)/1000;return Number.isFinite(v)?String(v):'';}
  /* A stepper is the primary way to set load and reps: it keeps the numeric
     keyboard closed, which keeps the CTA on screen and the layout still. The
     field stays a real <input id="weightInput"> so the engine reads it exactly
     as before. */
  function stepper(id,label,unit,input,step,stepLabel) {
    return `<div class="nxp-stepper">
      <span class="nxp-field-label" id="${id}-label">${esc(label)}${unit?` <small>${esc(unit)}</small>`:''}</span>
      <div class="nxp-stepper-row">
        <button type="button" class="nxp-step" data-step-target="${id}" data-step="-${step}" aria-label="Decrease ${esc(stepLabel)}" aria-controls="${id}"><span aria-hidden="true">−</span></button>
        ${input}
        <button type="button" class="nxp-step" data-step-target="${id}" data-step="${step}" aria-label="Increase ${esc(stepLabel)}" aria-controls="${id}"><span aria-hidden="true">+</span></button>
      </div>
    </div>`;
  }
  function logLabel(setType,done) {return setType==='warmup'?'Log warm-up':'Log set '+(done+1);}
  function restRail(left,total) {
    const pct=left&&total?Math.max(0,Math.min(100,left/total*100)):0;
    return `<div class="nxp-rest-rail" aria-hidden="true"><span style="width:${pct}%"></span></div>`;
  }
  /* Real outcomes only — progressed/maintained/below appear solely when each
     exercise has a previous session to compare against. No invented score. */
  /* Finish moments (D27). Everything here is derived from the logs on the fly:
     nothing is stored, no score is invented. A moment only appears when it is true. */
  function sessionMoments(){
    const out=[];
    const working=N.sessionLogs().filter(r=>r.setType!=='warmup');
    const byEx={};working.forEach(r=>{(byEx[r.exercise]=byEx[r.exercise]||[]).push(r);});
    const rows=N.workRows(),prior=rows.filter(r=>r.date<state.date);
    const bests=[];
    Object.entries(byEx).forEach(([name,sets])=>{
      const hist=prior.filter(r=>(r.exercise||r.name)===name&&Number(r.weight)>0);
      if(!hist.length)return;
      const a=N.bestSet(sets),b=N.bestSet(hist);
      if(!a||!b)return;
      const dw=Number(a.weight)-Number(b.weight),dr=Number(a.reps)-Number(b.reps);
      if(dw>0||(dw===0&&dr>0))bests.push({name,a,dw,dr});
    });
    bests.sort((x,y)=>y.dw-x.dw||y.dr-x.dr).slice(0,2).forEach(x=>out.push({k:'best',t:`New best · ${x.name} ${trimNum(x.a.weight)} kg × ${x.a.reps}`}));
    const days=new Set(rows.filter(r=>r.date<=state.date).map(r=>r.date)).size;
    if(days===10||days===25||days===75||(days>=50&&days%50===0))out.push({k:'count',t:`Workout ${days} logged`});
    /* Streak: consecutive weeks (Mon–Sun) with at least as many lifting days
       logged as the current plan has. The current week counts once it is met. */
    const planned=Object.values(settings.weeklyPlan||{}).filter(t=>!['Rest','Zone2','Floorball'].includes(t)).length;
    if(planned>0){
      const perWeek={};
      new Set(rows.map(r=>r.date)).forEach(d=>{const w=N.weekStart(d);perWeek[w]=(perWeek[w]||0)+1;});
      let w=N.weekStart(),streak=0;
      if((perWeek[w]||0)>=planned)streak=1;
      for(let i=0;i<104;i++){w=N.dateAdd(w,-7);if((perWeek[w]||0)>=planned)streak+=1;else break;}
      if(streak>=2)out.push({k:'streak',t:`${streak} weeks in a row hitting your lifting days`});
    }
    return out;
  }
  /* ---- D91 · Session prints ------------------------------------------------------------------------
     Every lifting session draws its own artwork from its real sets: each exercise is a ribbon (thicker with
     more kg lifted, load × reps of working sets; it swings wider for heavier loads), each working set a bead
     on it (larger with more reps), in the order they were logged. The shape is seeded by the date, so a
     session always draws the same print. Art from stored rows: nothing is stored or scored. */
  const PRINT_HUES=['#A78BFA','#BF75C5','#7C83F5','#E06C9F','#E39A5C','#C4B5FD','#8B5CF6','#9F7AEA'];
  let printSeq=0;
  function sessionPrintSVG(rows,key,opts){
    const o=opts||{};
    const work=(rows||[]).filter(r=>r&&r.setType!=='warmup'&&Number(r.weight)>0&&Number(r.reps)>0).slice().sort((a,b)=>(Number(a.ts||0)-Number(b.ts||0))||(Number(a.setNum||0)-Number(b.setNum||0)));
    if(!work.length)return '';
    const order=[],by=new Map();
    work.forEach(r=>{const k=r.exercise||r.name||'Exercise';if(!by.has(k)){by.set(k,[]);order.push(k);}by.get(k).push(r);});
    const vol=k=>by.get(k).reduce((a,r)=>a+Number(r.weight)*Number(r.reps),0),top=k=>Math.max(...by.get(k).map(r=>Number(r.weight)));
    const maxVol=Math.max(...order.map(vol))||1,maxTop=Math.max(...order.map(top))||1,maxReps=Math.max(...work.map(r=>Number(r.reps)))||1;
    let seed=2166136261;for(const ch of String(key||'')){seed^=ch.charCodeAt(0);seed=Math.imul(seed,16777619)>>>0;}
    const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const W=340,H=o.h||118,n=order.length;
    const ribbons=[],beads=[];
    order.forEach((name,i)=>{
      const sets=by.get(name),hue=PRINT_HUES[i%PRINT_HUES.length];
      const cy=H*(n===1?.5:.2+.6*i/(n-1)),amp=H*(.1+.17*(top(name)/maxTop)),th=2.4+10*(vol(name)/maxVol);
      const turns=.7+sets.length*.32,ph=rnd()*Math.PI*2,tilt=(rnd()-.5)*H*.18;
      const y=x=>cy+tilt*(x/W-.5)+amp*Math.sin(turns*2*Math.PI*x/W+ph)*(.5+.5*Math.sin(Math.PI*x/W));
      const pts=[];for(let s=0;s<=40;s++){const x=-8+(W+16)*s/40;pts.push({x,y:y(x)});}
      const d=typeof N.smoothPath==='function'?N.smoothPath(pts):pts.map((p,s)=>(s?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join('');
      ribbons.push(`<path class="sp-r" d="${d}" pathLength="1" stroke="${hue}" stroke-width="${th.toFixed(1)}" style="--i:${i}"/><path class="sp-c" d="${d}" pathLength="1" stroke-width=".9" style="--i:${i}"/>`);
      sets.forEach((r,j)=>{const x=W*(j+1)/(sets.length+1),rr=1.5+2.3*(Number(r.reps)/maxReps);beads.push(`<circle class="sp-b" cx="${x.toFixed(1)}" cy="${y(x).toFixed(1)}" r="${rr.toFixed(1)}" style="--i:${i};--j:${j}"/>`);});
    });
    const label=`Session print: ${n} ${N.plural(n,'exercise')} drawn as ribbons and ${work.length} working ${N.plural(work.length,'set')} as beads`;
    return `<figure class="st-print${o.cls?' '+o.cls:''}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid slice"><g class="sp-rs" fill="none" stroke-linecap="round" stroke-linejoin="round">${ribbons.join('')}</g><g class="sp-bs">${beads.join('')}</g></svg>${o.caption===false?'':'<figcaption>Each ribbon is an exercise, thicker with more kg lifted. Each bead is a set.</figcaption>'}</figure>`;
  }
  /* ---- D76 · In-app questions -------------------------------------------------------------------------
     A native confirm() shows the site's address over a grey system alert. Everyday questions (finish a
     workout, undo a set, delete a weigh-in) ask in a glass sheet instead: same answer, same wording.
     Escape, a tap outside or Cancel is "no"; a destructive answer starts on Cancel. */
  function ask(opts) {
    const o=opts||{};
    return new Promise(resolve=>{
      const old=document.getElementById('stAsk');if(old)old.remove();
      const el=document.createElement('div');el.id='stAsk';el.className='st-ask';
      el.innerHTML=`<div class="st-ask-scrim"></div><section class="st-ask-sheet" role="alertdialog" aria-modal="true" aria-labelledby="st-ask-t"${o.body?' aria-describedby="st-ask-b"':''}><h2 id="st-ask-t">${esc(o.title||'Are you sure?')}</h2>${o.body?`<p id="st-ask-b">${esc(o.body)}</p>`:''}<div class="st-ask-acts"><button type="button" class="st-ask-ok${o.danger?' is-danger':''}">${esc(o.ok||'OK')}</button><button type="button" class="st-ask-no">${esc(o.cancel||'Cancel')}</button></div></section>`;
      const back=document.activeElement;let settled=false;
      const done=v=>{
        if(settled)return;settled=true;
        document.removeEventListener('keydown',key,true);
        el.classList.add('is-out');setTimeout(()=>el.remove(),200);
        try{if(back&&back.focus&&document.contains(back))back.focus();}catch(e){}
        resolve(v);
      };
      const key=e=>{
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(false);}
        else if(e.key==='Tab'){e.preventDefault();e.stopPropagation();const b=[...el.querySelectorAll('button')],i=b.indexOf(document.activeElement);b[(i+(e.shiftKey?-1:1)+b.length)%b.length].focus();}
      };
      el.querySelector('.st-ask-scrim').addEventListener('click',()=>done(false));
      el.querySelector('.st-ask-no').addEventListener('click',()=>done(false));
      el.querySelector('.st-ask-ok').addEventListener('click',()=>done(true));
      document.addEventListener('keydown',key,true);
      document.body.appendChild(el);
      (o.danger?el.querySelector('.st-ask-no'):el.querySelector('.st-ask-ok')).focus();
    });
  }
  /* ---- D77 · Finish moment -----------------------------------------------------------------------------
     Finishing opens a full-screen scene in place of the small "Session saved" sheet: the session's working
     sets form a constellation (one star per set, joined within each exercise, in the order they were
     logged), a ring closes around a check, the session's own numbers count up — working sets, exercises
     and volume (load × reps of working sets, the tonnage Progress › Training already shows) — the D27
     highlights shimmer in, and a typeset receipt lists every set. Same facts as the sheet; nothing stored. */
  function finishScene() {
    const working=N.sessionLogs().filter(x=>x.setType!=='warmup').slice().sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));
    const order=[],by=new Map();
    working.forEach(r=>{const k=r.exercise||r.name||'Exercise';if(!by.has(k)){by.set(k,[]);order.push(k);}by.get(k).push(r);});
    const volume=Math.round(working.reduce((a,r)=>a+(Number(r.weight)||0)*(Number(r.reps)||0),0));
    const moments=sessionMoments();
    let seed=7;for(const ch of String(state.date)+String(state.dayType))seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
    const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const Wd=340,Ht=200,stars=[],lines=[],n=order.length,span=Math.min(.7,.18+n*.11);
    order.forEach((name,gi)=>{
      const f=n===1?.5:.5-span/2+span*gi/(n-1);
      const sets=by.get(name),cx=Wd*f,cy=Ht*(.56-Math.sin(Math.PI*f)*.22)+(rnd()-.5)*18;
      let px=null,py=null;
      sets.forEach((r,si)=>{
        const a=rnd()*Math.PI*2,rad=si?18+rnd()*20:0;
        const x=Math.max(10,Math.min(Wd-10,(px??cx)+Math.cos(a)*rad)),y=Math.max(12,Math.min(Ht-12,(py??cy)+Math.sin(a)*rad*.85));
        if(px!==null)lines.push(`<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" style="--i:${stars.length}"/>`);
        stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${si?2.6:3.8}" style="--i:${stars.length}"/>`);
        px=x;py=y;
      });
    });
    const receipt=order.map(name=>`<li><span>${esc(name)}</span><b>${by.get(name).map(r=>`<em>${esc(trimNum(r.weight))}<i>×</i>${esc(String(r.reps))}</em>`).join('')}</b></li>`).join('');
    const stat=(v,l,u='')=>`<div><b class="vn-num" data-to="${v}">${v.toLocaleString('en-SG')}</b>${u?`<small>${u}</small>`:''}<span>${l}</span></div>`;
    const old=document.getElementById('stFinish');if(old)old.remove();
    const el=document.createElement('div');el.id='stFinish';el.className='st-fin';
    el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','st-fin-t');
    el.innerHTML=`<div class="st-fin-bg" aria-hidden="true"></div><div class="st-fin-scroll"><div class="st-fin-in">
      <svg class="st-fin-sky" viewBox="0 0 ${Wd} ${Ht}" aria-hidden="true"><defs><radialGradient id="st-fin-neb"><stop offset="0" stop-color="rgba(167,139,250,.38)"/><stop offset=".55" stop-color="rgba(124,77,255,.12)"/><stop offset="1" stop-color="rgba(124,77,255,0)"/></radialGradient></defs><ellipse class="st-fin-neb" cx="${Wd/2}" cy="${Ht*.5}" rx="${Wd*.48}" ry="${Ht*.46}" fill="url(#st-fin-neb)"/><g class="st-fin-lines">${lines.join('')}</g><g class="st-fin-stars">${stars.join('')}</g></svg>
      <p class="st-fin-cap">${working.length} ${N.plural(working.length,'set')} · added to your sky</p>
      <div class="st-fin-head"><svg class="st-fin-ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="25" pathLength="1"/><path d="M18 28.5l6.5 6.5L38 21.5" pathLength="1"/></svg>
        <div><p class="st-fin-eb">Workout complete</p><h2 id="st-fin-t">${esc(N.label(state.dayType))}</h2><p class="st-fin-sub">${esc(state.gym||'Gym A')} · ${esc(N.shortDate(state.date))}</p></div></div>
      <div class="st-fin-stats">${stat(working.length,'Working sets')}${stat(order.length,order.length===1?'Exercise':'Exercises')}${stat(volume,'Volume','kg')}</div>
      ${moments.length?`<ul class="st-fin-moments" aria-label="Highlights">${moments.map((m,i)=>`<li class="is-${m.k}" style="--i:${i}"><i aria-hidden="true"></i><span>${esc(m.t)}</span></li>`).join('')}</ul>`:''}
      <section class="st-fin-printwrap"><h3>Session print</h3>${sessionPrintSVG(working,state.date+'|'+state.gym,{h:132,cls:'is-fin'})}</section>
      <section class="st-fin-receipt" aria-label="Session receipt"><h3>Session receipt</h3><ol>${receipt}</ol><p><span>Working sets ${working.length}</span><span>Volume ${volume.toLocaleString('en-SG')} kg</span></p></section>
      <p class="st-fin-note">Your logged work is saved. No need to add cardio just because this workout is finished.</p>
    </div></div>
    <div class="st-fin-acts"><button type="button" class="st-fin-done">Done</button><button type="button" class="st-fin-cardio">Log planned cardio</button></div>`;
    const back=document.activeElement;
    const close=then=>{document.removeEventListener('keydown',key,true);el.classList.add('is-out');setTimeout(()=>{el.remove();if(typeof then==='function')then();else{try{if(back&&back.focus&&document.contains(back))back.focus();}catch(e){}}},260);};
    const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
    el.querySelector('.st-fin-done').addEventListener('click',()=>close());
    el.querySelector('.st-fin-cardio').addEventListener('click',()=>close(()=>{if(typeof showCardioSheet==='function')showCardioSheet();}));
    document.addEventListener('keydown',key,true);
    document.body.appendChild(el);
    el.querySelector('.st-fin-done').focus({preventScroll:true});
    /* Count the numbers up once; reduced motion shows them as they are. */
    const still=document.documentElement.getAttribute('data-nxp-motion')==='reduced'||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(!still)el.querySelectorAll('.st-fin-stats b[data-to]').forEach((b,i)=>{
      const to=Number(b.dataset.to)||0,t0=performance.now()+500+i*120,dur=1100;
      b.textContent='0';
      const step=now=>{const k=Math.max(0,Math.min(1,(now-t0)/dur)),e2=1-Math.pow(1-k,3);b.textContent=Math.round(to*e2).toLocaleString('en-SG');if(k<1)requestAnimationFrame(step);};
      requestAnimationFrame(step);
    });
  }
  /* ---- D85 · Share your cut -----------------------------------------------------------------------------
     A 1080×1350 card drawn on a canvas from the facts the Cut journey already shows — start weight, current
     trend, goal range, days since the cut began — plus the morning trend line since then and the lifting
     days logged in that time. "Show weights" off keeps only the changes. Shared through the share sheet, or
     saved as a PNG where a browser cannot share files. The app stores and sends nothing. */
  const shareState={kg:true,blob:null,url:null};
  function progressFacts(){
    if(!N.cfg().targetConfirmed)return null;
    const rows=N.weights(),startW=N.finite(typeof START_WEIGHT!=='undefined'?START_WEIGHT:null);
    const seed=startW!==null?startW:(rows[0]?rows[0].weight:null);
    /* The Cut journey's own "Now" (D97), so the card and the journey never disagree. */
    const nl=N.nowLevel?N.nowLevel(rows):null,cur=nl?nl.value:(rows.at(-1)?rows.at(-1).weight:null);
    const lo=typeof goalLow==='function'?Number(goalLow()):NaN,hi=typeof goalHigh==='function'?Number(goalHigh()):NaN;
    if(seed===null||cur===null||!Number.isFinite(hi))return null;
    const cs=typeof settings!=='undefined'&&settings&&Number.isFinite(N.dateMs(settings.cutStart))&&settings.cutStart<=state.date?settings.cutStart:null;
    const first=cs||(rows[0]&&rows[0].date)||state.date;
    const days=Math.max(0,Math.round((N.dateMs(state.date)-N.dateMs(first))/864e5));
    const trend=N.trend(rows).filter(p=>p.avg!==null&&p.date>=first&&p.date<=state.date).map(p=>({d:p.date,v:Number(p.avg)}));
    const liftDays=new Set(N.workRows().filter(r=>r.date>=first&&r.date<=state.date).map(r=>r.date)).size;
    return {seed,cur,lo,hi,first,days,trend,liftDays,done:seed-cur,remain:Math.max(0,cur-hi)};
  }
  async function drawProgressCard(f,showKg){
    const W=1080,H=1350,cv=document.createElement('canvas');cv.width=W;cv.height=H;
    const g=cv.getContext('2d');if(!g)return null;
    try{if(document.fonts&&document.fonts.load)await Promise.all([document.fonts.load('600 60px Geist'),document.fonts.load('250 240px Geist'),document.fonts.load('500 34px Geist')]);}catch(e){}
    const F=(w,s)=>`${w} ${s}px Geist, -apple-system, system-ui, sans-serif`;
    const track=(px)=>{try{g.letterSpacing=px+'px';}catch(e){}};
    g.fillStyle='#07060B';g.fillRect(0,0,W,H);
    const glow=(x,y,r,col)=>{const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(7,6,11,0)');g.fillStyle=gr;g.fillRect(0,0,W,H);};
    glow(170,120,820,'rgba(139,92,246,.46)');glow(1010,300,560,'rgba(236,72,153,.17)');glow(520,1330,820,'rgba(85,82,187,.26)');
    /* the lifting days of the cut as stars (a stable hash of each date) */
    let seedN=2166136261;const rnd=()=>{seedN=(Math.imul(seedN^(seedN>>>15),2246822507)+1013904223)>>>0;return seedN/4294967296;};
    const ld=[...new Set(N.workRows().filter(r=>r.date>=f.first&&r.date<=state.date).map(r=>r.date))];
    ld.forEach((d,i)=>{seedN=2166136261^(N.dateMs(d)/864e5|0);const x=60+rnd()*960,y=40+rnd()*560,s=1.6+rnd()*2.2;g.fillStyle=`rgba(236,228,255,${(.35+rnd()*.5).toFixed(2)})`;g.beginPath();g.arc(x,y,s,0,Math.PI*2);g.fill();});
    g.textBaseline='alphabetic';g.textAlign='left';
    g.fillStyle='rgba(206,190,255,.92)';g.font=F(600,30);track(7);g.fillText('NXTFRM  ·  CUT',96,150);track(0);
    const range=`${N.shortDate(f.first)} – ${N.shortDate(state.date)} ${String(state.date).slice(0,4)}`;
    g.fillStyle='rgba(214,204,240,.72)';g.font=F(500,32);g.fillText(range,96,202);
    /* the headline: kilograms down on the trend */
    const big=f.done>0?f.done.toFixed(1):'0.0';
    const tg=g.createLinearGradient(0,300,0,560);tg.addColorStop(0,'#FFFFFF');tg.addColorStop(1,'#CDBAFF');
    g.fillStyle=tg;g.font=F(250,250);track(-10);g.fillText(big,84,520);const bw=g.measureText(big).width;track(0);
    g.fillStyle='rgba(225,214,255,.86)';g.font=F(520,64);g.fillText('kg down',84+bw+22,520);
    g.fillStyle='rgba(214,204,240,.8)';g.font=F(480,38);
    g.fillText(showKg?`${f.days} ${f.days===1?'day':'days'} · ${f.liftDays} lifting ${f.liftDays===1?'day':'days'} · on the morning trend`:'on the morning trend',96,592);
    /* the trend line since the cut began */
    const X0=96,X1=984,Y0=690,Y1=1010,pts=f.trend;
    if(pts.length>=2){
      const t0=N.dateMs(pts[0].d),t1=Math.max(t0+1,N.dateMs(pts.at(-1).d));
      const vs=pts.map(p=>p.v),vmin=Math.min(...vs),vmax=Math.max(...vs),pad=Math.max(.3,(vmax-vmin)*.12);
      const px=p=>X0+(N.dateMs(p.d)-t0)/(t1-t0)*(X1-X0),py=v=>Y0+(vmax+pad-v)/((vmax+pad)-(vmin-pad))*(Y1-Y0);
      g.strokeStyle='rgba(255,255,255,.07)';g.lineWidth=2;for(let k=0;k<=3;k++){const y=Y0+(Y1-Y0)*k/3;g.beginPath();g.moveTo(X0,y);g.lineTo(X1,y);g.stroke();}
      const area=g.createLinearGradient(0,Y0,0,Y1);area.addColorStop(0,'rgba(139,92,246,.42)');area.addColorStop(1,'rgba(139,92,246,0)');
      g.beginPath();pts.forEach((p,i)=>{const x=px(p),y=py(p.v);i?g.lineTo(x,y):g.moveTo(x,y);});g.lineTo(px(pts.at(-1)),Y1);g.lineTo(px(pts[0]),Y1);g.closePath();g.fillStyle=area;g.fill();
      const line=g.createLinearGradient(X0,0,X1,0);line.addColorStop(0,'#7C4DFF');line.addColorStop(1,'#E9E0FF');
      g.save();g.shadowColor='rgba(167,139,250,.9)';g.shadowBlur=26;g.beginPath();pts.forEach((p,i)=>{const x=px(p),y=py(p.v);i?g.lineTo(x,y):g.moveTo(x,y);});g.strokeStyle=line;g.lineWidth=9;g.lineJoin='round';g.lineCap='round';g.stroke();g.restore();
      const e=pts.at(-1),ex=px(e),ey=py(e.v);
      g.fillStyle='rgba(196,181,253,.28)';g.beginPath();g.arc(ex,ey,30,0,Math.PI*2);g.fill();
      g.save();g.shadowColor='rgba(255,255,255,.95)';g.shadowBlur=22;g.fillStyle='#fff';g.beginPath();g.arc(ex,ey,12,0,Math.PI*2);g.fill();g.restore();
      /* Only the end is labelled: the line starts at the first trend value, which is not the saved start weight. */
      if(showKg){g.font=F(560,34);g.fillStyle='rgba(225,214,255,.9)';g.textAlign='right';g.fillText(`${e.v.toFixed(1)} kg`,X1,Math.max(Y0-22,ey-46));g.textAlign='left';}
    }
    /* three facts along the bottom */
    const cols=showKg?[[f.seed.toFixed(1)+' kg','Start'],[f.cur.toFixed(1)+' kg','Trend now'],[f.remain>0?f.remain.toFixed(1)+' kg':'In range',f.remain>0?'To goal range':'Goal range']]
      :[[String(f.liftDays),f.liftDays===1?'Lifting day':'Lifting days'],[String(f.days),f.days===1?'Day':'Days'],[f.remain>0?f.remain.toFixed(1)+' kg':'In range',f.remain>0?'To goal range':'Goal range']];
    g.fillStyle='rgba(255,255,255,.05)';const rr=(x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
    rr(72,1080,936,180,44);g.fill();g.strokeStyle='rgba(255,255,255,.09)';g.lineWidth=2;g.stroke();
    cols.forEach(([v,l],i)=>{const cx=72+936/6*(2*i+1);g.textAlign='center';g.fillStyle='#fff';g.font=F(330,58);track(-2);g.fillText(v,cx,1170);track(0);g.fillStyle='rgba(214,204,240,.72)';g.font=F(500,30);g.fillText(l,cx,1218);});
    g.textAlign='center';g.fillStyle='rgba(206,190,255,.5)';g.font=F(560,24);track(6);g.fillText('BUILD YOUR NEXT FORM',W/2,1312);track(0);
    return cv;
  }
  async function paintShare(){
    const f=progressFacts(),img=document.getElementById('st-shr-img');if(!f||!img)return;
    img.classList.add('is-busy');
    const cv=await drawProgressCard(f,shareState.kg);if(!cv)return;
    const blob=await new Promise(r=>cv.toBlob(r,'image/png'));if(!blob)return;
    if(shareState.url)URL.revokeObjectURL(shareState.url);
    shareState.blob=blob;shareState.url=URL.createObjectURL(blob);
    img.src=shareState.url;img.classList.remove('is-busy');
  }
  async function shareProgress(){
    if(!progressFacts())return toast('Confirm a goal range to share your cut.');
    N.modal('Share your cut',`<div class="st-shr"><div class="st-shr-prev"><img id="st-shr-img" class="is-busy" alt="Your cut as a card: kilograms down, days, and the morning trend since the cut began"></div>
      <label class="st-shr-t"><span><b>Show weights</b><small>Off keeps only the changes</small></span><input type="checkbox" switch role="switch" id="st-shr-kg" ${shareState.kg?'checked':''} onchange="NXP.shareToggle(this.checked)"></label>
      <button type="button" class="n99-button" onclick="NXP.shareSend()">Share</button></div>`);
    await paintShare();
  }
  function shareToggle(on){shareState.kg=!!on;paintShare();}
  async function shareSend(){
    if(!shareState.blob)await paintShare();if(!shareState.blob)return;
    const file=new File([shareState.blob],'nxtfrm-cut.png',{type:'image/png'});
    try{
      if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'My cut · NXTFRM'});return;}
    }catch(e){if(e&&e.name==='AbortError')return;}
    const a=document.createElement('a');a.href=shareState.url;a.download='nxtfrm-cut.png';document.body.appendChild(a);a.click();a.remove();
    toast('Card saved as nxtfrm-cut.png');
  }
  function momentsHTML(){
    const m=sessionMoments();
    return m.length?`<ul class="st-moments" aria-label="Highlights">${m.map(x=>`<li class="is-${x.k}"><i aria-hidden="true"></i><span>${esc(x.t)}</span></li>`).join('')}</ul>`:'';
  }
  function sessionOutcomeHTML() {
    const working=N.sessionLogs().filter(r=>r.setType!=='warmup');
    const byEx={};
    working.forEach(r=>{(byEx[r.exercise]=byEx[r.exercise]||[]).push(r);});
    let up=0,same=0,down=0,compared=0;
    Object.entries(byEx).forEach(([name,sets])=>{
      const prev=N.sessionRows(name,state.gym,state.date,100).at(-1);
      if(!prev||!prev.sets||!prev.sets.length)return;
      compared+=1;
      /* D20: compared by best set — heavier load wins, then more reps at it. */
      const a=N.bestSet(sets),b=N.bestSet(prev.sets);
      const dw=Number(a.weight)-Number(b.weight),dr=Number(a.reps)-Number(b.reps);
      if(dw>0||(dw===0&&dr>0))up+=1; else if(dw===0&&dr===0)same+=1; else down+=1;
    });
    const nextDate=N.dateAdd(state.date,1);
    const compare=compared?`<div class="st-outcome">
      <div style="--c:var(--st-lean)"><b class="vn-num" data-st-count="${up}">${up}</b><span>Beat</span></div>
      <div style="--c:var(--st-accent)"><b class="vn-num" data-st-count="${same}">${same}</b><span>Matched</span></div>
      <div style="--c:var(--st-fat)"><b class="vn-num" data-st-count="${down}">${down}</b><span>Below</span></div>
    </div>`:'';
    return `<p class="st-meta st-mt2">${working.length} working ${N.plural(working.length,"set")} · ${Object.keys(byEx).length} ${N.plural(Object.keys(byEx).length,"exercise")}</p>
      ${compare}
      <p class="st-meta st-mt3">Best set vs last session, per exercise · Next: ${esc(N.label(N.typeFor(nextDate)))} tomorrow</p>`;
  }
  function training() {
    applyAppearance();
    if(state.dayType==='Floorball'){ui.trainActive=false;return trainFloorball();}
    /* A non-strength day keeps its own screen unless the user has explicitly
       added an optional exercise AND is currently on it in focused mode.
       Falling through then reuses the normal logging controls — it does not
       change what the day is. dayType is resolved from settings.dayOverrides /
       weeklyPlan and is never written here or anywhere downstream of an add-on. */
    const addonFocused=addOnActive()&&ui.trainActive;
    if((state.dayType==='Rest'||state.dayType==='Zone2')&&!addonFocused){
      ui.trainActive=false;
      return state.dayType==='Rest'?trainRest():trainZone2();
    }
    /* On a non-strength day the add-ons ARE the list. Resolved through the same
       exerciseDefByName() the normal queue uses, so sets/reps/increment come
       from the usual place and nothing forks the engine. */
    const list=addOnActive()
      ? addOns().map(n=>(typeof exerciseDefByName==='function'?exerciseDefByName(n,state.dayType):{name:n,sets:3,reps:[8,12],inc:2.5}))
      : template();
    if(!list.length)return trainEmpty();
    if(!list.some(e=>e.name===state.exercise))state.exercise=list[0].name;
    const finished=N.planDone();
    if(finished)ui.trainActive=false;
    /* Focused mode is opt-in. Leave returns here without discarding logs. */
    if(!ui.trainActive&&!finished&&!addOnActive())return trainLiftIdle(list);

    const ex=state.exercise,t=N.targetFor(ex),done=N.done(ex),cue=N.cue(ex),draft=ui.drafts.get(draftKey())||{};
    const previous=N.sessionRows(ex,state.gym,state.date,100).at(-1),prev=previous?N.bestSet(previous.sets):null,aim=N.aimFor(ex);
    const current=N.sessionLogs().filter(r=>r.exercise===ex),last=current.filter(r=>r.setType!=='warmup').at(-1);
    const total=list.reduce((a,e)=>a+Number(e.sets),0),count=list.reduce((a,e)=>a+Math.min(N.done(e.name),e.sets),0);
    /* Ascension: the coordinated advice (NXT.coach.trainAdvice) is coachFor()'s own output,
       except that a load step meeting a cautious weight decision reads as a hold. The field then
       opens at the hold load, as the headline says; Aim still fills the engine's step on tap. */
    const coach=finished?null:coachAdvice(ex);
    const weight=draft.weightInput??last?.weight??(coach&&coach.coordinated&&coach.coordinated.hold?coach.weight:(cue.weight||''));
    const index=list.findIndex(e=>e.name===ex),lastMove=index===list.length-1;
    /* Train repaints on every logged set, so an entrance animation declared in
       CSS alone would replay constantly. The class is only emitted when the
       exercise genuinely changed, and its direction follows the queue order so
       the motion says which way you moved. */
    const exMove=ui.lastExercise&&ui.lastExercise!==ex
      ? (index>ui.lastIndex?' is-forward':' is-back')
      : '';
    ui.lastExercise=ex; ui.lastIndex=index;
    const restLeft=apx96RestRemaining();
    const restPlan=typeof suggestedRestSeconds==='function'?suggestedRestSeconds(ex):90;
    const setType=draft['n99-set-type']==='warmup'?'warmup':'working';
    const rir=draft['n99-rir']===undefined?'':String(draft['n99-rir']);
    const note=typeof v88NoteFor==='function'?v88NoteFor(ex):'';
    /* Set by logSet() immediately before the engine writes, so the repaint the
       engine triggers can show the confirmation in place of a success modal. */
    const justLogged=ui.confirmFrom!==null&&ui.confirmFrom!==undefined&&state.logs.length>ui.confirmFrom;
    const loggedEntry=justLogged?state.logs[state.logs.length-1]:null;
    const confirmLabel=loggedEntry?(loggedEntry.setType==='warmup'?'Warm-up logged':'Set '+loggedEntry.setNum+' logged'):'';
    const idleLabel=logLabel(setType,done);
    const page=document.getElementById('trainPage');
    const focused=ui.trainActive&&!finished;
    syncTrainNav(focused);

    const allDone=total>0&&count>=total;
    const outer=`n99 nxp nxp-train st-train`;
    if(finished){
      page.innerHTML=`<div class="${outer} st-train-finished">
        ${trainChrome()}
        <section class="st-tile st-done" style="--c:var(--st-lift)">
          <div class="st-done-badge" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21"/><path d="M15 24.5l6 6 12-13"/></svg></div>
          <span class="st-cat">Workout saved</span>
          <h2 class="st-h2 st-mt2">${esc(N.label(state.dayType))} · ${esc(state.gym||'Gym')}</h2>
          ${momentsHTML()}
          ${sessionOutcomeHTML()}
          ${muscleMapHTML([...new Set(N.sessionLogs().filter(r=>r.setType!=='warmup').map(r=>r.exercise))],'What you trained','')}
          <div class="st-done-acts"><button type="button" class="st-cta" onclick="NXP.sessionSummary()">View session<span aria-hidden="true">›</span></button><button type="button" class="st-ghost" onclick="NXT.resume()">Resume workout</button></div>
        </section>
        <button type="button" class="st-row-btn" onclick="NXP.queue()"><span>Workout queue</span><small>${list.length} ${N.plural(list.length,"exercise")}</small><i aria-hidden="true">›</i></button>
      </div>`;
      return;
    }

    /* D20: every logged working set is compared with the best set last time —
       a real comparison, never a score. Input ids are unchanged for NXT.logSet(). */
    const cmpBest=r=>{
      if(!prev||r.setType==='warmup')return '';
      const dw=Number(r.weight)-Number(prev.weight),dr=Number(r.reps)-Number(prev.reps);
      if(dw>0||(dw===0&&dr>0))return 'up';
      if(dw===0&&dr===0)return 'eq';
      return '';
    };
    const m=typeof NXTLIB!=='undefined'?NXTLIB.musclesFor(ex):{primary:[],secondary:[]};
    const fig=(typeof NXTANAT!=='undefined'&&m.primary.length)?NXTANAT.figure({primary:m.primary,secondary:m.secondary,view:NXTANAT.viewFor(m.primary,[]),crop:false}):'';
    const aimText=aim?(aim.kind==='reentry'?'Ease back in · lighter':aim.kind==='load'?`+${trimNum(aim.weight-Number(prev.weight))} kg`:aim.kind==='rep'?(/^Under /.test(aim.why||'')?aim.why:'One more rep'):(aim.why||'Match your best')):'Set a baseline';
    /* D25 coach: note + a target for every planned set. Tapping a target fills the fields; nothing is logged. */
    const tg=n=>esc(trimNum(n));
    const pillTxt=(()=>{if(!coach)return '';
      if(coach.kind==='load'&&prev)return `+${tg(coach.weight-Number(prev.weight))} kg`;
      return ({rep:'+1 rep',reentry:'Ease in',stall:'Stalled',tired:'Easy day',rebuild:'Rebuild',hold:'Hold',new:'Baseline',baseline:'Baseline'})[coach.kind]||'';})();
    const coachLine=coach?`<details class="st-coachline is-${coach.kind}${coach.coordinated&&coach.coordinated.hold?' is-coordinated':''}${exMove?' is-enter':''}">
          <summary><span class="st-coach-ico" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M10 2.4l1.8 5.3 5.3 1.8-5.3 1.8L10 16.6l-1.8-5.3L2.9 9.5l5.3-1.8z"/></svg></span><b>${esc(coach.headline)}</b>${pillTxt?`<em class="st-coach-pill">${esc(pillTxt)}</em>`:''}<span class="st-coachline-why">Why<i aria-hidden="true">›</i></span></summary>
          <p class="st-coach-n">${esc(coach.note)}</p>
          <p class="st-coach-basis">Targets use your recorded weights, reps and sets. They can’t assess technique or how hard the sets felt.</p>
        </details>`:'';
    const restPct=restLeft&&(ui.restTotal||restPlan)?Math.max(0,Math.min(100,restLeft/(ui.restTotal||restPlan)*100)):0;
    /* Set chips: warm-ups, then one chip per planned working set (extras are
       appended). Logged chips open the same edit sheet as before. */
    const freshId=justLogged&&loggedEntry&&loggedEntry.exercise===ex?loggedEntry.id:null;
    const setNo=setType==='warmup'?'Warm-up':(done>=Number(t.sets)?`Extra set`:`Set ${done+1}`);
    const setOf=setType==='warmup'||done>=Number(t.sets)?'':`of ${t.sets}`;
    /* The set ledger (NXTFRM 2.0): one row per planned working set. Logged
       rows show the set and how it compared with the best set last time (D20);
       the current row IS the entry; rows still to come show the coach's target
       for that set (D25) and fill the fields on tap. Warm-ups sit above the
       plan. Nothing is logged by tapping a row; Log set still does that. */
    const entry=`          ${stepper('weightInput','kg','',`<input id="weightInput" type="number" min="0" max="1000" step="0.1" inputmode="decimal" enterkeyhint="done" autocomplete="off" required placeholder="${esc(trimNum(aim?aim.weight:prev?prev.weight:0))}" value="${esc(weight)}" aria-labelledby="weightInput-label" oninput="NXP.rememberInput(this)">`,trimNum(t.inc||2.5),`weight by ${trimNum(t.inc||2.5)} kilograms`)}
          <span class="st-x" aria-hidden="true">×</span>
          ${stepper('repsInput','reps','',`<input id="repsInput" type="number" min="1" max="100" step="1" inputmode="numeric" enterkeyhint="done" autocomplete="off" required placeholder="${aim?aim.reps:prev?prev.reps:t.reps[0]}" value="${esc(draft.repsInput??'')}" aria-labelledby="repsInput-label" oninput="NXP.rememberInput(this)">`,'1','reps by one')}`;
    const working=current.filter(r=>r.setType!=='warmup'),warm=current.filter(r=>r.setType==='warmup');
    const planned=Math.max(1,Number(t.sets)||1);
    /* D83 · New best, per set: the D27 rule (heaviest load, then most reps, against every earlier session of
       this exercise) applied as the sets come in, so the set that first passed the old best carries a star.
       Nothing is stored; a first-ever session has nothing to beat and shows none. */
    const prIds=(()=>{const ids=new Set();try{
      const prior=N.workRows().filter(x=>(x.exercise||x.name)===ex&&x.date<state.date&&Number(x.weight)>0);
      let best=prior.length?N.bestSet(prior):null;if(!best)return ids;
      working.slice().sort((a,b)=>(Number(a.ts||0)-Number(b.ts||0))||(Number(a.setNum||0)-Number(b.setNum||0))).forEach(r=>{
        const dw=Number(r.weight)-Number(best.weight),dr=Number(r.reps)-Number(best.reps);
        if(dw>0||(dw===0&&dr>0)){ids.add(r.id);best=r;}
      });
    }catch(e){}return ids;})();
    const loggedRow=(r,label)=>{
      const c=cmpBest(r),i=current.indexOf(r),isWarm=r.setType==='warmup';
      const word=isWarm?'Warm-up':c==='up'?'Beat last time':c==='eq'?'Matched':'Logged';
      const pr=!isWarm&&prIds.has(r.id);
      return `<li class="st-lrow is-done${isWarm?' is-warm':''}${c==='up'?' is-up':''}${pr?' is-pr':''}${r.id===freshId?' is-fresh':''}"><button type="button" onclick="NXP.editCurrentSet(${i})" aria-label="Edit ${isWarm?'warm-up':'set '+r.setNum}: ${esc(trimNum(r.weight))} kilograms for ${esc(r.reps)}, ${esc(word.toLowerCase())}${pr?', new best':''}"><span class="st-ln">${pr?'<svg class="st-pr-star" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l1.9 4.2 4.6.5-3.4 3.1 1 4.5L8 11.2l-4.1 2.3 1-4.5L1.5 5.9l4.6-.5z"/></svg>':esc(label)}</span><b class="vn-num">${esc(trimNum(r.weight))} <i>×</i> ${esc(r.reps)}</b><small>${c==='up'?'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2M2.5 5.5L6 2l3.5 3.5"/></svg>':''}<span class="st-lw">${esc(word)}</span><span class="st-lw-s" aria-hidden="true">${esc(word==='Beat last time'?'Beat':word)}</span></small></button></li>`;
    };
    const entryRow=(label)=>`<li class="st-lrow is-now"><span class="st-ln">${esc(label)}</span><div class="st-entry">${entry}</div></li>`;
    const nextRow=(k)=>{
      const x=coach&&coach.sets&&coach.sets[k];
      return x?`<li class="st-lrow is-next"><button type="button" onclick="NXP.useTarget(${k})" aria-label="Set ${k+1} target: ${tg(x.weight)} kilograms for ${x.reps} reps. Tap to fill"><span class="st-ln">${k+1}</span><b class="vn-num">${tg(x.weight)} <i>×</i> ${x.reps}</b><small>Target · tap to fill</small></button></li>`
              :`<li class="st-lrow is-next"><span class="st-ln">${k+1}</span><b class="vn-num">—</b><small>${t.reps[0]}–${t.reps[1]} reps</small></li>`;
    };
    const rows=[];
    warm.forEach(r=>rows.push(loggedRow(r,'W')));
    if(setType==='warmup')rows.push(entryRow('W'));
    for(let k=0;k<Math.max(planned,working.length);k++){
      if(k<working.length)rows.push(loggedRow(working[k],String(k+1)));
      else if(k===working.length&&setType==='working')rows.push(entryRow(String(k+1)));
      else rows.push(nextRow(k));
    }
    if(setType==='working'&&working.length>=planned)rows.push(entryRow('+'));
    const ledger=`<ol class="st-ledger" aria-label="Sets">${rows.join('')}</ol>`;
    const form=`<form id="nxp-set-form" class="st-card" onsubmit="event.preventDefault();NXP.logSet()">
        <div class="st-card-head">
          <p class="st-card-t"><b>${esc(setNo)}</b>${setOf?` <span>${esc(setOf)}</span>`:''}</p>
          <fieldset class="nxp-seg-block nxp-seg-type">
            <legend class="st-sr">Set type</legend>
            <div class="nxp-seg" role="group">${[['working','Working'],['warmup','Warm-up']].map(([v,l])=>`<button type="button" class="${setType===v?'is-on':''}" aria-pressed="${setType===v}" onclick="NXP.setSetType('${v}')">${l}</button>`).join('')}</div>
          </fieldset>
        </div>
        ${ledger}
        <input type="hidden" id="n99-set-type" value="${setType}">
        <input type="hidden" id="n99-rir" value="${esc(rir)}">
        <button id="nxp-log-button" type="submit" class="n99-button nxp-train-cta st-log" data-idle-label="${esc(idleLabel)}">${justLogged?`<span class="nxp-cta-check" aria-hidden="true">✓</span>${esc(confirmLabel)}`:esc(idleLabel)}</button>
      </form>`;

    page.innerHTML=`<div class="${outer} st-train-active${justLogged?' is-just-logged':''}${focused?' is-mode':''}${allDone?' is-all-done':''}">
      <header class="st-tbar">
        <button type="button" class="st-icon" onclick="NXP.leaveTrain()" aria-label="Leave workout"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg></button>
        <div class="st-tbar-mid">
          <p class="st-tbar-t">${esc(N.label(state.dayType))}</p>
          <p class="st-tbar-s"><span class="st-tbar-c"><b class="vn-num">${count}</b> of ${total} ${N.plural(total,"set")}</span><span class="st-tbar-g">${esc(state.gym||'Gym A')}</span></p>
        </div>
        <button type="button" class="st-icon" onclick="NXP.trainMenu()" aria-label="Workout options"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4.5" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="15.5" cy="10" r="1.5"/></svg></button>
        <button type="button" class="st-tfinish${allDone?' is-ready':''}" onclick="NXT.finish()">Finish</button>
      </header>
      <div class="st-segbar" aria-hidden="true">${list.map((e,i)=>{
        const d=Math.min(N.done(e.name),Number(e.sets));
        return `<span class="${i===index?'is-current':''}"><i style="width:${e.sets?Math.round(d/e.sets*100):0}%"></i></span>`;
      }).join('')}</div>

      ${trainAlertHTML()}

      ${allDone?`<section class="st-complete" aria-live="polite">
        <div><b>All ${total} ${N.plural(total,"set")} logged</b><span>Finish to save the session</span></div>
        <button type="button" class="st-complete-b" onclick="NXT.finish()">Finish</button>
      </section>`:''}

      <section class="st-ex${exMove}">
        <div class="st-ex-info">
          <p class="st-ex-pos">Exercise ${index+1} of ${list.length}</p>
          <h2><button type="button" class="st-ex-title" onclick="NXP.exerciseDetails()">${esc(ex)}</button></h2>
          <p class="st-ex-mus">${esc(m.primary.map(id=>NXTANAT.label(id)).join(' · ')||muscleLine(ex))} <span>· ${t.reps[0]}–${t.reps[1]} reps</span></p>
          ${note?`<p class="st-ex-note">${esc(note)}</p>`:''}
        </div>
        ${bleedHTML(ex)}
      </section>

      <div class="st-refline" role="group" aria-label="This exercise">
        ${aim?`<button type="button" class="st-ref is-aim" onclick="NXP.useAim()" aria-label="Aim ${esc(trimNum(aim.weight))} kilograms for ${aim.reps}. Tap to fill"><small>Aim</small><b class="vn-num">${esc(trimNum(aim.weight))} × ${esc(aim.reps)}</b><span>${esc(aimText)}</span></button>`
             :`<div class="st-ref is-aim"><small>Aim</small><b class="vn-num">${t.reps[0]}–${t.reps[1]} reps</b><span>Set a baseline</span></div>`}
        <div class="st-ref"${prev?` data-w="${esc(prev.weight)}" data-r="${esc(prev.reps)}"`:''}><small>Best</small><b class="vn-num">${prev?`${esc(trimNum(prev.weight))} × ${esc(prev.reps)}`:'—'}</b><span>${previous?esc(N.shortDate(previous.date)):'No history yet'}</span></div>
        <div class="st-ref"><small>Rest</small><b class="vn-num">${esc(apx96FormatTimer(restPlan))}</b><span>planned</span></div>
      </div>
      ${coachLine}

      ${!addOnActive()&&sessionDiffers()?`<button type="button" class="st-diff" onclick="NXP.saveTodayToRoutine()"><span><b>Changed for today only</b><small>Save this order and these exercises to your ${esc(N.label(state.dayType))} routine</small></span><em>Save</em></button>`:''}

      <aside class="nxp-rest st-rest st-orbcard${restLeft?' is-active':''}${restLeft&&restLeft<=10?' is-final':''}" aria-label="Rest timer"${restLeft?' role="timer"':''} ${restLeft?'':'hidden'} style="--pct:${restPct.toFixed(1)}">
        <div class="st-orb" aria-hidden="true"><i class="st-orb-core"></i><svg class="st-orb-ring" viewBox="0 0 120 120"><circle class="st-orb-track" cx="60" cy="60" r="54" pathLength="1"/><circle class="st-orb-arc" cx="60" cy="60" r="54" pathLength="1"/></svg></div>
        <span class="st-rest-l"><small>Rest</small><b id="apx96TimerValue" class="vn-num">${restLeft?apx96FormatTimer(restLeft):'Ready'}</b></span>
        <p class="st-orb-next"><small>Up next</small>${(()=>{
          /* The coach's target for the next set (the ledger's "Target" row) when there is one; otherwise what
             the fields will hold — the weight in the field and the Aim's reps. */
          if(setType==='warmup'||done>=Number(t.sets))return `<b>${esc(setNo)}</b>`;
          const x=coach&&coach.sets&&coach.sets[done];
          if(x)return `<b class="vn-num">${tg(x.weight)} × ${esc(String(x.reps))}</b>`;
          const w=String(weight||'')||(aim?trimNum(aim.weight):''),rp=aim?aim.reps:(prev?prev.reps:t.reps[0]);
          return w?`<b class="vn-num">${esc(trimNum(w))} × ${esc(String(rp))}</b>`:`<b>${esc(setNo)}</b>`;
        })()}</p>
        ${restRail(restLeft,ui.restTotal||restPlan)}
        <div class="vn-rest-actions">${button('+30s','apx96AdjustRest(30)',true)}${button('Skip','apx96SkipRest()',true)}</div>
      </aside>

      ${allDone?`<details class="st-extra"><summary>Log an extra set</summary>${form}</details>`:form}

      <nav class="st-exnav" aria-label="Exercise navigation">
        <button type="button" ${index<=0?'disabled':''} onclick="NXP.goExercise(-1)" aria-label="Previous exercise"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5"/></svg></button>
        <button type="button" class="st-exnav-mid nxp-queue-open" onclick="NXP.queue()">${index+1} / ${list.length} · All exercises</button>
        <button type="button" ${lastMove?'disabled':''} onclick="NXP.goExercise(1)" aria-label="Next exercise"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5L13 10l-5.5 5.5"/></svg></button>
      </nav>
    </div>`;
    if(justLogged)scheduleConfirmReset();
    setTimeout(apx96TickTimer,0);
  }
  /* The confirmation lives on the button that was pressed rather than in a
     modal, so it never interrupts the next set. It clears itself without a
     repaint: replacing the DOM again would reset scroll and re-focus. */
  /* Fills the two fields with the aim from aimFor(). It only writes the inputs
     (and their drafts); nothing is logged until Log Set is pressed. */
  /* Workout options as one bottom sheet with uniform rows. Every row calls
     the same function the old controls did. */
  function trainMenu() {
    const ex=state.exercise,cue=N.cue(ex);
    const ico={
      info:'<path d="M10 9v5M10 6.2v.1"/><circle cx="10" cy="10" r="7"/>',
      swap:'<path d="M4 7h11l-3-3M16 13H5l3 3"/>',
      list:'<path d="M7 5.5h9M7 10h9M7 14.5h9M3.8 5.5h.1M3.8 10h.1M3.8 14.5h.1"/>',
      undo:'<path d="M7 7L3.5 10.5 7 14"/><path d="M4 10.5h8a4 4 0 010 8h-2"/>',
      save:'<path d="M5 3.5h8l3 3V16a.5.5 0 01-.5.5h-11A.5.5 0 014 16V4a.5.5 0 01.5-.5z"/><path d="M7 3.5v4h6v-4M7 16.5v-5h6v5"/>',
      edit:'<path d="M13.5 3.5l3 3L7 16H4v-3z"/>',
      gear:'<circle cx="10" cy="10" r="2.6"/><path d="M10 2.8v2M10 15.2v2M17.2 10h-2M4.8 10h-2M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4M15.1 15.1l-1.4-1.4M6.3 6.3L4.9 4.9"/>'
    };
    const row=(i,label,sub,fn,danger)=>`<button type="button" class="st-mrow${danger?' is-danger':''}" onclick="${esc(fn)}"><span class="st-mrow-i"><svg viewBox="0 0 20 20" aria-hidden="true">${ico[i]}</svg></span><span class="st-mrow-l"><b>${esc(label)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span><i aria-hidden="true">›</i></button>`;
    N.modal(ex,`<div class="st-menu">
      <div class="st-menu-cue"><b>${esc(cue.label)}</b><span>${esc(cue.text)}</span></div>
      <div class="st-mgroup">
        ${row('info','Exercise details','Muscles, history and equipment','NXP.exerciseDetails()')}
        ${row('swap','Swap exercise','Replace it for today only','closeModal();showSubstituteSheet()')}
        ${row('list','All exercises','Jump or reorder','NXP.queue()')}
      </div>
      <div class="st-mgroup">
        ${row('save','Save to routine',sessionDiffers()?'Keep today’s changes for next time':'Today matches your routine','NXP.saveTodayToRoutine()')}
        ${row('edit','Edit '+N.label(state.dayType)+' routine','Exercises, sets and rep ranges',`closeModal();NXP.editRoutine('${state.dayType}')`)}
      </div>
      <div class="st-mgroup">
        ${row('undo','Undo last set','','closeModal();apx96UndoLastSet()')}
        ${row('gear','Session options',N.features.checkin?'Shorter session, notes, check-in':'Shorter session and notes','NXP.sessionMenu()')}
      </div>
      ${addOnEligible()?`<div class="st-mgroup st-madd">${addOnSection()}</div>`:''}
    </div>`);
  }
  function fillEntry(weight,reps) {
    const w=document.getElementById('weightInput'),r=document.getElementById('repsInput');
    if(w){w.value=trimNum(weight);rememberInput(w);w.classList.add('st-flash');setTimeout(()=>w.classList.remove('st-flash'),600);}
    if(r){r.value=String(reps);rememberInput(r);r.classList.add('st-flash');setTimeout(()=>r.classList.remove('st-flash'),600);}
  }
  function useAim() {
    const aim=N.aimFor(state.exercise);if(!aim)return;
    fillEntry(aim.weight,aim.reps);
  }
  function useTarget(k) {
    const c=coachAdvice(state.exercise),s=c&&c.sets&&c.sets[k];if(!s)return;
    fillEntry(s.weight,s.reps);
  }
  function scheduleConfirmReset() {
    clearTimeout(ui.confirmTimer);
    ui.confirmTimer=setTimeout(()=>{
      const root=document.querySelector('.st-train.is-just-logged');
      if(root)root.classList.remove('is-just-logged');
      const btn=document.getElementById('nxp-log-button');
      if(btn&&btn.dataset.idleLabel)btn.textContent=btn.dataset.idleLabel;
      document.querySelectorAll('.nxp-set-row.is-fresh,.st-chip2.is-fresh').forEach(el=>el.classList.remove('is-fresh'));
    },1200);
  }
  /* Only surfaces recovery guidance that asks for a change of plan. When the
     guidance is "proceed as planned" it adds nothing the rest of the screen
     does not already say, so it stays out of the way. */
  function trainAlertHTML() {
    const training=currentTraining(currentIntegrated());
    if(!training||training.state==='no_recovery_signal'||training.state==='proceed')return '';
    const detail=training.guidance&&training.guidance.detail?`<small>${esc(training.guidance.detail)}</small>`:'';
    return `<aside class="nxp-train-alert" data-state="${esc(training.state)}"><span class="nxp-caption">Recovery guidance</span><strong>${esc(training.guidance.message)}</strong>${detail}</aside>`;
  }
  /* Segmented controls write through the same hidden inputs the workout engine
     already reads (val('n99-set-type') / val('n99-rir')), so set logging,
     validation and the stored record are unchanged. */
  function setSetType(value) {
    const v=value==='warmup'?'warmup':'working';
    const el=document.getElementById('n99-set-type');
    if(!el)return;
    el.value=v;
    rememberInput(el);
    syncSeg(el.closest('form')?.querySelector('.nxp-seg-block .nxp-seg'),v);
  }
  function setRir(value) {
    const el=document.getElementById('n99-rir');
    if(!el)return;
    el.value=value;
    rememberInput(el);
    syncSeg(document.querySelector('.nxp-seg-rir .nxp-seg'),value);
  }
  function syncSeg(group,value) {
    if(!group)return;
    [...group.querySelectorAll('button')].forEach(btn=>{
      const on=btn.getAttribute('onclick')?.includes(`('${value}')`);
      btn.classList.toggle('is-on',!!on);
      btn.setAttribute('aria-pressed',String(!!on));
    });
  }
  /* The nav is rendered from whatever list training() resolved, so it has to
     walk that same list. On a non-strength day template() is empty, which left
     Prev and Next enabled but inert. Add-on days move by name through
     addOnSelect; strength days still go through the engine's selectExercise. */
  function goExercise(delta) {
    if(addOnActive()){
      const names=addOns();
      const next=names.indexOf(state.exercise)+delta;
      if(next<0||next>=names.length)return;
      addOnSelect(names[next]);
      return;
    }
    const list=template();
    const index=list.findIndex(e=>e.name===state.exercise);
    const next=index+delta;
    if(next<0||next>=list.length)return;
    N.selectExercise(next);
  }
  /* The queue sheet presents the session plan the engine already owns.

     template() (index.html) resolves through ensureSessionPlan(), which returns
     state.sessionPlans[sessionKey()] — so this list, the Train rail and the
     exercise header are all the same array, and every mutation below goes
     through the engine function that owns it (N.selectExercise,
     moveSessionExercise). Ordering, substitution and target rules are
     unchanged; only the presentation is ours.

     NXT.templateFor() is a different thing and must not be confused with
     template(): it is the base programme a session is seeded from, not the
     live session plan. */
  function queueRows(managing) {
    const list=template();
    if(!list.length){
      return `<p class="n99-small nxp-queue-empty">No exercises are queued for this session. Add an exercise or restore your saved programme.</p>`;
    }
    return `<ol class="nxp-queue-list${managing?' is-managing':''}">${list.map((e,i)=>{
      const current=e.name===state.exercise,complete=N.done(e.name)>=e.sets;
      /* Move buttons rather than a drag handle: plain buttons are reachable by
         keyboard and assistive tech, and they cannot capture a scroll the way a
         drag target on a scrolling sheet does. */
      const reorder=managing?`<span class="nxp-queue-move">
        <button type="button" ${i===0?'disabled':''} aria-label="Move ${esc(e.name)} up" onclick="NXP.queueMove(${i},-1)"><span aria-hidden="true">↑</span></button>
        <button type="button" ${i===list.length-1?'disabled':''} aria-label="Move ${esc(e.name)} down" onclick="NXP.queueMove(${i},1)"><span aria-hidden="true">↓</span></button>
      </span>`:'';
      const row=`<button type="button" class="nxp-queue-row${current?' is-current':''}${complete?' is-done':''}" ${current?'aria-current="true"':''} ${managing?'tabindex="-1" aria-hidden="true"':''} onclick="NXP.chooseExercise(${i})"><span class="nxp-queue-index">${complete?'✓':i+1}</span><span class="nxp-queue-name"><b>${esc(e.name)}</b><small>${e.sets} × ${e.reps[0]}–${e.reps[1]} reps</small></span><span class="nxp-queue-count">${N.done(e.name)}<em>/${e.sets}</em></span></button>`;
      return `<li>${row}${reorder}</li>`;
    }).join('')}</ol>`;
  }
  function queue(managing) {
    const list=template();
    const on=!!managing;
    const tools=list.length
      ? `<div class="nxp-queue-tools">${button(on?'Done':'Reorder',`NXP.queue(${on?'':'true'})`,true)}${button('Manage exercises','apx96OpenQueueManager()',true)}</div>`
      : `<div class="nxp-queue-tools">${button('Add exercise','v88OpenAddModal()')}${button('Restore programme','NXT.fullSession()',true)}</div>`;
    const lede=list.length?`<p class="nxp-queue-lede">${list.length} ${N.plural(list.length,"exercise")} · ${on?'move an exercise up or down':'tap one to switch'}</p>`:'';
    N.modal('Workout queue',`<div class="nxp-queue-sheet">${lede}${queueRows(on)}${tools}</div>`);
  }
  /* moveSessionExercise persists and repaints Train itself; re-opening the
     sheet re-reads the same array, so the sheet and the screen behind it can
     never show different orders. It keeps state.exercise by identity, so the
     lifter stays on the exercise they were on even if its index changed. */
  function queueMove(index,delta) {
    if(typeof moveSessionExercise!=='function')return;
    moveSessionExercise(index,delta);
    queue(true);
  }
  /* Only shows what the engine actually holds for this exercise. An exercise
     with no note and no history shows the target block alone rather than empty
     placeholder rows. */
  /* Session-level focus, derived from THIS session's actual plan — never from
     the day's label. A custom Push day that is all shoulders says shoulders.
     Primary anywhere in the session outranks secondary everywhere; that is the
     whole rule, and it feeds nothing but this line. Text only: the current
     exercise owns the one graphic on the screen. */
  function sessionFocus(list) {
    if (typeof NXTLIB === "undefined" || typeof NXTANAT === "undefined") return "";
    const f = NXTLIB.focusFor((list || []).map(e => e.name));
    if (!f.primary.length) return "";
    const shown = f.primary.slice(0, 4).map(id => NXTANAT.label(id));
    const more = f.primary.length - shown.length;
    return `<p class="nxp-session-focus"><span>Today's focus</span>`
      + `<b>${esc(shown.join(" · "))}${more > 0 ? " +" + more : ""}</b></p>`;
  }

  /* ---- Optional add-ons on non-strength days ---------------------------
     Rest stays Rest and Zone 2 stays Zone 2. These are extras logged against
     the day, never a reclassification of it: dayType is resolved purely from
     settings.dayOverrides / settings.weeklyPlan, and nothing below writes to
     either. The store is its own map so Zone 2's scheduled "Zone 2 Cardio"
     plan is untouched. */
  const ADDON_MAX = 2;
  const ADDON_DAYS = { Rest: 1, Zone2: 1, Cardio: 1 };

  function addOnEligible(type) {
    return !!ADDON_DAYS[type || state.dayType];
  }
  function addOnKey() { return sessionKey(); }
  function addOns() {
    state.addOns = state.addOns || {};
    const k = addOnKey();
    if (!Array.isArray(state.addOns[k])) state.addOns[k] = [];
    return state.addOns[k];
  }
  function addOnAdd(name) {
    if (!addOnEligible() || !name) return;
    const list = addOns();
    if (list.length >= ADDON_MAX) { toast("Two optional exercises is the limit."); return; }
    if (list.indexOf(name) !== -1) { toast("Already added."); return; }
    list.push(name);
    ui.addOnFlash = name;
    /* Pointing state.exercise at the add-on is what lets the shared logging
       controls work unchanged. It is only ever set to a name that is in this
       list, which is also what the logSet guard checks. */
    state.exercise = name;
    state.setNum = 1;
    ui.trainActive = true;
    persist(); render(); toast("Added " + name);
  }
  function addOnRemove(name) {
    const list = addOns();
    const i = list.indexOf(name);
    if (i === -1) return;
    list.splice(i, 1);
    /* Leaving state.exercise pointing at a removed add-on would strand the
       logging form on an exercise that is no longer part of the day. */
    if (state.exercise === name) { state.exercise = list[0] || ""; state.setNum = 1; }
    if (!list.length) apx96StopRest();
    persist(); render(); toast("Removed " + name);
  }
  function addOnPick() {
    const list = addOns();
    if (list.length >= ADDON_MAX) { toast("Two optional exercises is the limit."); return; }
    const names = (typeof NXTLIB !== "undefined" ? NXTLIB.names() : [])
      .filter(n => list.indexOf(n) === -1).sort((a, b) => a.localeCompare(b));
    N.modal("Add exercise",
      `<p class="n99-small">Optional. Logged as normal training; today stays a ${esc(N.label(state.dayType))} day.</p>`
      + `<input class="input nxp-addon-search" type="search" placeholder="Search exercises" `
      + `oninput="NXP.addOnFilter(this.value)" aria-label="Search exercises">`
      + `<div class="nxp-addon-list" id="nxp-addon-list">`
      + names.map(n => `<button type="button" class="n99-list-row nxp-addon-option" data-name="${esc(n).toLowerCase()}" `
          + `onclick="NXP.addOnAdd('${esc(n).replace(/'/g, "\\'")}')"><span>${esc(n)}</span>`
          + `<small>${esc(muscleLine(n))}</small></button>`).join("")
      + `</div>`);
  }
  /* Filtering a ~100-row list is the one presentation concession the larger
     library needs; it changes no identity and no data. */
  function addOnFilter(q) {
    const term = String(q || "").trim().toLowerCase();
    const box = document.getElementById("nxp-addon-list");
    if (!box) return;
    for (const el of box.querySelectorAll(".nxp-addon-option")) {
      const hay = (el.dataset.name || "") + " " + el.textContent.toLowerCase();
      el.hidden = term ? hay.indexOf(term) === -1 : false;
    }
  }

  /* The optional block, rendered under whatever the day actually is. */
  function addOnSection() {
    if (!addOnEligible()) return "";
    const list = addOns();
    const rows = list.map(name => {
      const done = N.done(name);
      /* Consumed as it is read: the reveal plays on the render that follows the
         add and never again. */
      const fresh = ui.addOnFlash === name ? " is-new" : "";
      if (fresh) ui.addOnFlash = null;
      return `<div class="nxp-addon-row${state.exercise === name ? " is-current" : ""}${fresh}">`
        + `<button type="button" class="nxp-addon-name" onclick="NXP.addOnSelect('${esc(name).replace(/'/g, "\\'")}')">`
        + `<b>${esc(name)}</b><small>${esc(muscleLine(name))}${done ? " · " + done + " set" + (done === 1 ? "" : "s") : ""}</small></button>`
        + `<button type="button" class="nxp-addon-drop" aria-label="Remove ${esc(name)}" `
        + `onclick="NXP.addOnRemove('${esc(name).replace(/'/g, "\\'")}')">×</button></div>`;
    }).join("");
    return `<section class="nxp-addon">`
      + `<h2 class="nxp-caption">Optional add-on</h2>`
      + (list.length ? rows : `<p class="n99-small nxp-addon-hint">Add a lift if you feel like doing a little more.</p>`)
      + (list.length < ADDON_MAX
          ? `<button type="button" class="nxp-addon-add" onclick="NXP.addOnPick()">+ Add exercise</button>` : "")
      + `</section>`;
  }
  /* True only when the day has add-ons AND the current exercise is one of them.
     The logging form and the logSet guard both key off this single condition, so
     they cannot disagree. */
  function addOnActive() {
    if (!addOnEligible()) return false;
    const list = addOns();
    return list.length > 0 && list.indexOf(state.exercise) !== -1;
  }

  function addOnSelect(name) {
    if (addOns().indexOf(name) === -1) return;
    state.exercise = name; state.setNum = 1; ui.trainActive = true; persist(); render();
  }

  /* ---- Muscle context --------------------------------------------------
     Text first: the muscle names are the information, the drawing is support.
     An exercise the library has never seen returns nothing rather than a guess
     — NXTFRM does not infer anatomy from a name string. */
  function muscleLine(ex) {
    if (typeof NXTLIB === "undefined" || typeof NXTANAT === "undefined") return "";
    const m = NXTLIB.musclesFor(ex);
    return m.primary.concat(m.secondary).map(id => NXTANAT.label(id)).join(" · ");
  }

  /* A compact crop of the worked region only. Tapping it opens the same detail
     sheet as the title, so there is one destination rather than a second modal.
     The figure is aria-hidden; the line above already names the muscles. */
  function anatomyStrip(ex) {
    if (typeof NXTLIB === "undefined" || typeof NXTANAT === "undefined") return "";
    const m = NXTLIB.musclesFor(ex);
    if (!m.primary.length) return "";
    /* One view, from the primary muscle. The crop is that view's mapped
       region. --nxa-ar is the crop's own aspect so the cap cannot stretch it. */
    const view = NXTANAT.viewFor(m.primary, []);
    const crop = NXTANAT.cropFor(m.primary, view);
    const ar = crop[2] > 0 && crop[3] > 0 ? crop[2] / crop[3] : 1;
    const arAttr = Number.isFinite(ar) && ar > 0 ? ar.toFixed(3) : "1";
    return `<button type="button" class="nxp-ex-anat" onclick="NXP.exerciseDetails()" `
      + `aria-label="Show exercise details" style="--nxa-ar:${arAttr}">`
      + NXTANAT.figure({ primary: m.primary, secondary: m.secondary, view })
      + `</button>`;
  }

  function exerciseDetails() {
    /* Optional arguments are read from `arguments`: the release gate slices this
       file on the exact marker "function exerciseDetails()". Train passes none —
       the current exercise at the current gym, with the session actions (swap,
       equipment note). Progress › Performance passes a lift's name and its gym —
       that lift's record only: nothing that acts on today's session, and no plan
       facts (target, rest, increment) unless the lift really is in today's plan at
       this gym. */
    const record=typeof arguments[0]==='string'&&arguments[0]!=='';
    const ex=record?arguments[0]:state.exercise;
    const gym=record&&typeof arguments[1]==='string'&&arguments[1]!==''?arguments[1]:state.gym;
    const sameGym=gym===state.gym;
    const planned=!record||(sameGym&&typeof template==='function'&&template().some(e=>e&&e.name===ex));
    const t=N.targetFor(ex),cue=sameGym?N.cue(ex):null;
    const note=sameGym&&typeof v88NoteFor==='function'?v88NoteFor(ex):'';
    const sessions=N.sessionRows(ex,gym,state.date,100).slice(-5).reverse();
    const rest=typeof suggestedRestSeconds==='function'?suggestedRestSeconds(ex):90;
    /* Equipment shows only when the library actually knows it — no "Unknown"
       placeholder, and never inferred from the exercise name. */
    const equip=typeof NXTLIB!=='undefined'?NXTLIB.equipmentFor(ex):'';
    const facts=(planned?[['Target',`${t.sets} × ${t.reps[0]}–${t.reps[1]} reps`],['Rest',apx96FormatTimer(rest)],['Increment',`${trimNum(t.inc||2.5)} kg`]]:[]).concat(equip?[['Equipment',equip]]:[])
      .map(([k,v])=>`<div class="nxp-detail-fact"><span class="nxp-caption">${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    const history=sessions.length
      ? `<ol class="nxp-detail-history">${sessions.map(s=>`<li><span>${esc(N.shortDate(s.date))}</span><b>${s.sets.map(r=>`${esc(trimNum(r.weight))}×${esc(r.reps)}`).join(' · ')}</b></li>`).join('')}</ol>`
      : `<p class="n99-small">No previous sessions recorded for this exercise at ${esc(gym)}.</p>`;
    /* The full body belongs here, where there is room for it. Same renderer as
       the Train crop — one anatomy implementation, two sizes. */
    const m=typeof NXTLIB!=='undefined'?NXTLIB.musclesFor(ex):{primary:[],secondary:[]};
    const anat=(typeof NXTANAT!=='undefined'&&m.primary.length)
      ? `<div class="nxp-detail-anat">${NXTANAT.pair(m.primary,m.secondary)}</div>` : '';
    const muscleBlock=m.primary.length
      ? `<section class="nxp-detail-block"><h3>Primary</h3><p>${esc(m.primary.map(id=>NXTANAT.label(id)).join(' · '))}</p></section>`
        + (m.secondary.length?`<section class="nxp-detail-block"><h3>Secondary</h3><p>${esc(m.secondary.map(id=>NXTANAT.label(id)).join(' · '))}</p></section>`:'')
      : '';
    /* Swap opens the sheet the mode bar already uses. That sheet writes
       today's session plan only, then closeModal returns to Train, which
       render() has repainted with the replacement. Cancel returns to Train
       on the same exercise. History and the base programme are not touched. */
    N.modal(ex,`<div class="nxp-detail">
      ${anat}${muscleBlock}
      ${facts?`<div class="nxp-detail-facts">${facts}</div>`:''}
      ${exhSectionHTML(ex,gym)}
      ${note?`<section class="nxp-detail-block"><h3>Equipment note</h3><p>${esc(note)}</p></section>`:''}
      ${cue?`<section class="nxp-detail-block"><h3>${esc(cue.label)}</h3><p>${esc(cue.text)}</p></section>`:''}
      <section class="nxp-detail-block"><h3>Recent sessions</h3>${history}</section>
      ${record?'':`${button(note?'Edit equipment note':'Add equipment note','NXP.equipmentNote()',true)}
      <button type="button" class="nxp-detail-swap" onclick="showSubstituteSheet()">Swap exercise</button>`}
    </div>`);
    exhOpen();
  }

  /* ---- Exercise history (Ascension · charts) ----------------------------------
     One question: how has my best working set for this exercise moved across
     sessions? One point per session date, for this exact exercise name at this
     exact gym — never merged across gyms or aliases. No new maths: N.sessionRows()
     groups the stored working sets by date (warm-ups already out), N.bestSet() is
     D20's best set (heaviest load, then most reps at it), and the optional dashed line
     is the engine's own per-session estimated 1RM — the figure Progress › Performance
     plots — drawn as an estimate (I11), never as a measurement, and off until the
     e1RM toggle is switched on (it stretches the kg scale). The SVG is built as
     a string at the measured width so labels stay a true 11px on a 320px phone;
     strata.css only animates what this markup carries. */
  const EXH_N=12;
  const EXH_WORD={up:'Beat last time',eq:'Matched last time',down:'Below last time',first:'First session'};
  const EXH_ICON={
    up:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2M2.5 5.5L6 2l3.5 3.5"/></svg>',
    eq:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5h7M2.5 7.5h7"/></svg>',
    down:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2.5 6.5L6 10l3.5-3.5"/></svg>',
    first:'<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="2.4"/></svg>'
  };
  let exh=null,exhUid=0,exhBound=false,exhRaf=0;
  const exhReduced=()=>{try{return document.documentElement.getAttribute('data-nxp-motion')==='reduced'||!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){return false;}};
  const exhYear=d=>String(d).slice(0,4)!==String(state.date).slice(0,4)?' '+String(d).slice(0,4):'';
  const exhAxis=d=>N.shortDate(d)+exhYear(d);
  const exhDate=d=>d===state.date?'Today':exhAxis(d);
  /* Best sets use every working set, as Train's "Best last time" does. The estimate
     follows the Performance tab's own rule (sets up to 15 reps), so the dashed line
     is the same figure that tab shows; a session with none has no estimate. */
  function exhSeries(ex,gym) {
    const upto=N.dateAdd(state.date,1);
    const est=new Map(N.sessionRows(ex,gym,upto).map(s=>[s.date,s.value]));
    const out=[];
    N.sessionRows(ex,gym,upto,100).forEach(s=>{
      const b=N.bestSet(s.sets),load=N.finite(b&&b.weight),reps=N.finite(b&&b.reps);
      if(load===null||reps===null||!(reps>0))return;
      out.push({date:s.date,load,reps,e1:N.finite(est.get(s.date))});
    });
    return out;
  }
  /* All-time best by D20's order. A strict improvement is required, so a tie keeps
     the session that first set it (the same rule as the "New best" moment, D27). */
  function exhBestIdx(series) {
    let bi=-1;
    series.forEach((s,i)=>{const b=bi<0?null:series[bi];if(!b||s.load>b.load||(s.load===b.load&&s.reps>b.reps))bi=i;});
    return bi;
  }
  /* The D20 comparison with the session before it. */
  function exhCmp(s,prev) {
    const dw=s.load-prev.load,dr=s.reps-prev.reps;
    return dw>0||(dw===0&&dr>0)?'up':dw===0&&dr===0?'eq':'down';
  }
  function exhParts(i) {
    const s=exh.series[i],c=i>0?exhCmp(s,exh.series[i-1]):'first';
    return {
      date:exhDate(s.date),c,word:EXH_WORD[c],plain:`${fmtLoad(s.load)} kg × ${s.reps}`,
      val:`${esc(fmtLoad(s.load))}<small>kg</small><i>×</i>${esc(s.reps)}`,
      e1:s.e1!==null?`e1RM ${fmtLoad(s.e1)} kg · estimate`:'No e1RM estimate for this session'
    };
  }
  /* The section's markup. Zero sessions and one session are text, never a blank
     panel and never a one-point "line". The plot itself is painted after the sheet
     is in the page, because only then is its width known (exhOpen). */
  function exhSectionHTML(ex,gym) {
    const series=exhSeries(ex,gym);
    /* The estimate is opt-in (I11, like the weight chart's Projection): a glass toggle, off
       by default, remembered for the page session in NXT.ui and nowhere else. A lift with no
       estimate at all (every set above 15 reps) has nothing to switch on, so no toggle. */
    const hasE1=series.some(s=>s.e1!==null),showE=!!N.ui.showE1rm&&hasE1;
    exh={ex,gym,series,best:exhBestIdx(series),all:false,sel:null,W:0,off:0,geo:null,hasE1,showE};
    const head=`<h3 id="exh-h">History · ${esc(gym)}</h3>`;
    if(!series.length)return `<section class="nxp-detail-block exh is-empty" id="exh" aria-labelledby="exh-h">${head}<div class="exh-empty"><b>No sessions yet</b><span>Log a working set of ${esc(ex)} at ${esc(gym)} and each session’s best set will build a line here.</span></div></section>`;
    const tog=hasE1
      ? `<button type="button" class="exh-tog" id="exh-tog" aria-pressed="${showE}" aria-label="Estimated one-rep max, e1RM"><span class="exh-tog-box" aria-hidden="true"></span>e1RM<svg class="exh-tog-key" width="14" height="10" viewBox="0 0 14 10" aria-hidden="true"><line x1="0" y1="5" x2="14" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/></svg></button>`
      : '';
    if(series.length===1){
      const p=exhParts(0);
      return `<section class="nxp-detail-block exh is-one" id="exh" aria-labelledby="exh-h"><div class="exh-head">${head}${tog}</div><div class="exh-one"><b class="exh-r-v vn-num">${p.val}</b><span>${esc(p.date)} · the only session so far</span>${hasE1?`<span id="exh-one-e"${showE?'':' hidden'}>${esc(p.e1)}</span>`:''}</div><p class="exh-hint">A line appears after the second session.</p></section>`;
    }
    const seg=series.length>EXH_N
      ? `<div class="vn-seg n99-segments exh-seg" role="group" aria-label="Sessions shown"><button type="button" class="active" aria-pressed="true" data-all="0" aria-label="Last ${EXH_N} sessions">Last ${EXH_N}</button><button type="button" aria-pressed="false" data-all="1" aria-label="All ${series.length} ${N.plural(series.length,"session")}">All</button></div>`
      : '';
    return `<section class="nxp-detail-block exh" id="exh" aria-labelledby="exh-h">
      <div class="exh-head">${head}${seg}${tog}</div>
      <div class="exh-read" aria-hidden="true"><span class="exh-r-d" id="exh-r-d"></span><span class="exh-r-c" id="exh-r-c"></span><b class="exh-r-v vn-num" id="exh-r-v"></b><span class="exh-r-e" id="exh-r-e"></span></div>
      <p class="st-sr" id="exh-live" aria-live="polite"></p>
      <div class="exh-plot" id="exh-plot" tabindex="0" role="application" aria-label="History chart, ${esc(ex)} at ${esc(gym)}. Drag across it to inspect a session; left and right arrow keys move; Escape returns to the latest."></div>
      <p class="st-sr" id="exh-eq"></p>
      <p class="exh-cap">Evenly spaced per session · numbers are reps</p>
      <details class="exh-how"><summary>How to read this chart</summary><p>Each point is one session’s best working set: the heaviest load, then the most reps at that load. Warm-ups are left out. Sessions are spaced evenly, not by date.</p><p>Switch on e1RM to add a dashed line: the estimated one-rep max (Epley: load × (1 + reps ÷ 30), working sets up to 15 reps), the figure Progress › Performance uses. It is an estimate, not a tested maximum, and it widens the kg scale, so it is off until you ask for it.</p></details>
    </section>`;
  }
  function exhOpen() {
    if(!exh||!document.getElementById('exh'))return;
    document.querySelectorAll('#exh .exh-tog').forEach(b=>b.addEventListener('click',()=>exhE1(b.getAttribute('aria-pressed')!=='true')));
    const host=document.getElementById('exh-plot');
    if(!host)return;
    document.querySelectorAll('#exh .exh-seg button').forEach(b=>b.addEventListener('click',()=>exhRange(b.dataset.all==='1')));
    /* The sheet closes by dragging down from anywhere; a scrub across the plot must
       not start that, so the plot keeps its pointerdown to itself. */
    host.addEventListener('pointerdown',e=>{e.stopPropagation();try{host.setPointerCapture(e.pointerId);}catch(_){ }exhScrub(e);});
    host.addEventListener('pointermove',e=>{if(e.buttons)exhScrub(e);});
    host.addEventListener('keydown',exhKey);
    if(!exhBound){exhBound=true;window.addEventListener('resize',exhResize);}
    exhPaint(true);
  }
  function exhResize() {
    cancelAnimationFrame(exhRaf);
    exhRaf=requestAnimationFrame(()=>{
      const host=document.getElementById('exh-plot');
      if(host&&exh&&Math.abs((host.clientWidth||0)-exh.W)>1)exhPaint(false);
    });
  }
  /* The e1RM toggle. The choice lives in NXT.ui for the page session (the weight chart keeps
     its Projection and Post-workout toggles there too) and is never written to storage. It
     changes the kg scale, so the plot is redrawn; the selection is kept. */
  function exhE1(on) {
    if(!exh)return;
    N.ui.showE1rm=!!on;
    exh.showE=!!on&&exh.hasE1;
    document.querySelectorAll('#exh .exh-tog').forEach(b=>b.setAttribute('aria-pressed',String(exh.showE)));
    const one=document.getElementById('exh-one-e');
    if(one)one.hidden=!exh.showE;
    if(document.getElementById('exh-plot'))exhPaint(true);
  }
  function exhRange(all) {
    if(!exh)return;
    exh.all=!!all;exh.sel=null;
    document.querySelectorAll('#exh .exh-seg button').forEach(b=>{const on=(b.dataset.all==='1')===exh.all;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    exhPaint(true);
  }
  function exhCur() {return exh.sel===null?exh.series.length-1:exh.sel;}
  /* Selection moves marks and text only; the plot is not redrawn. */
  function exhSelect(i,opts) {
    if(!exh)return;
    const hi=exh.series.length-1,j=opts&&opts.clear?hi:Math.max(exh.off,Math.min(hi,Number(i)||0));
    exh.sel=j===hi?null:j;
    exhMark(j);
  }
  function exhMark(i) {
    const host=document.getElementById('exh-plot');
    if(!host||!exh||!exh.geo)return;
    const g=exh.geo,k=i-exh.off;
    if(k<0||k>=g.n)return;
    const cur=host.querySelector('.exh-cur'),act=host.querySelector('.exh-act');
    /* The stem joins the selected session's estimate (when it has one) to its best set. */
    if(cur){cur.setAttribute('x1',g.xs[k].toFixed(1));cur.setAttribute('x2',g.xs[k].toFixed(1));cur.setAttribute('y1',(g.es[k]!==null?g.es[k]:g.top).toFixed(1));cur.setAttribute('y2',g.ys[k].toFixed(1));}
    if(act){act.setAttribute('cx',g.xs[k].toFixed(1));act.setAttribute('cy',g.ys[k].toFixed(1));}
    host.querySelectorAll('.exh-reps').forEach(t=>t.classList.toggle('is-sel',Number(t.dataset.k)===k));
    const p=exhParts(i),set=(id,fn)=>{const el=document.getElementById(id);if(el)fn(el);};
    set('exh-r-d',e=>{e.textContent=p.date;});
    set('exh-r-v',e=>{e.innerHTML=p.val;});
    set('exh-r-c',e=>{e.className='exh-r-c is-'+p.c;e.innerHTML=EXH_ICON[p.c]+esc(p.word);});
    set('exh-r-e',e=>{e.textContent=exh.showE?p.e1:'';});
    set('exh-live',e=>{e.textContent=`${p.date} · ${p.plain} · ${p.word}`;});
  }
  function exhScrub(e) {
    const host=document.getElementById('exh-plot'),svg=host&&host.querySelector('svg');
    if(!svg||!exh||!exh.geo)return;
    const b=svg.getBoundingClientRect(),x=(e.clientX-b.left)/Math.max(1,b.width)*exh.W,xs=exh.geo.xs;
    let k=0;
    xs.forEach((px,i)=>{if(Math.abs(px-x)<Math.abs(xs[k]-x))k=i;});
    exhSelect(exh.off+k);
  }
  /* Escape clears a moved selection back to the latest session and keeps the sheet
     open; with nothing to clear it is left alone, so it closes the sheet as usual. */
  function exhKey(e) {
    if(!exh)return;
    const cur=exhCur(),hi=exh.series.length-1;
    if(e.key==='ArrowRight'){exhSelect(Math.min(hi,cur+1));e.preventDefault();}
    else if(e.key==='ArrowLeft'){exhSelect(Math.max(exh.off,cur-1));e.preventDefault();}
    else if(e.key==='Home'){exhSelect(exh.off);e.preventDefault();}
    else if(e.key==='End'){exhSelect(hi);e.preventDefault();}
    else if(e.key==='Escape'&&cur!==hi){exhSelect(hi,{clear:true});e.preventDefault();e.stopPropagation();}
  }
  function exhPaint(animate) {
    const host=document.getElementById('exh-plot');
    if(!host||!exh)return;
    try{
      const series=exh.series,total=series.length,off=exh.all?0:Math.max(0,total-EXH_N),vis=series.slice(off),n=vis.length;
      const W=Math.max(240,Math.min(560,Math.round(host.clientWidth)||340)),H=W<330?216:236;
      const R=14,T=32,B=44,PX=10,base=H-B,plotH=base-T,f=v=>Number(v).toFixed(1);
      /* The kg axis follows the plotted data only (D2): the measured best-set loads, and the
         estimate too while its toggle is on, never a hidden series. Headroom is .6 of a step
         above and below (D51), so the line never presses on the frame; three or four ticks in a
         left gutter (D58), the unit its own small label above them. */
      const showE=exh.showE;
      const lo0=Math.min(...vis.map(p=>p.load)),hi0=Math.max(...vis.map(p=>showE&&p.e1!==null?Math.max(p.e1,p.load):p.load));
      const STEPS=[.5,1,2,2.5,5,10,20,25,50,100,200,250,500,1000],room=s=>({lo:lo0-s*.6,hi:hi0+s*.6});
      const cnt=s=>{const r=room(s);return Math.floor(r.hi/s+1e-9)-Math.ceil(r.lo/s-1e-9)+1;};
      const step=STEPS.find(s=>cnt(s)<=4)||1000;
      let {lo,hi}=room(step);
      const tickList=()=>{const a=[];for(let v=Math.ceil(lo/step-1e-9)*step;v<=hi+1e-9;v+=step)a.push(Math.round(v*100)/100);return a;};
      let ticks=tickList();
      /* A narrow domain can hold fewer than three ticks; widen it by one step, on the side that costs less. */
      for(let g=0;ticks.length<3&&g<4;g++){
        const down=(ticks.length?ticks[0]:Math.ceil(lo/step-1e-9)*step)-step,up=(ticks.length?ticks[ticks.length-1]:Math.floor(hi/step+1e-9)*step)+step;
        if(lo-down<=up-hi)lo=down;else hi=up;
        ticks=tickList();
      }
      /* The gutter is as wide as its longest tick label needs (34 for up to three characters). */
      const L=Math.max(34,Math.ceil(10+6.3*Math.max(...ticks.map(v=>String(Number(v.toFixed(1))).length))));
      const Y=v=>T+(hi-v)/(hi-lo)*plotH;
      /* Evenly spaced per session: the gaps between dates are not drawn to scale. */
      const xs=vis.map((_,i)=>L+PX+i/(n-1)*(W-L-R-2*PX)),ys=vis.map(p=>Y(p.load));
      const slot=(W-L-R-2*PX)/(n-1),dr=slot>=18?4:slot>=9?3:slot>=5?2.2:1.6,dly=i=>Math.round(i/(n-1)*200);
      const uid='exh'+(++exhUid),bk=exh.best-off,bv=series[exh.best],last=vis[n-1];
      const d=N.smoothPath(xs.map((x,i)=>({x,y:ys[i]})));
      const eP=showE?vis.map((p,i)=>p.e1!==null?{x:xs[i],y:Y(p.e1)}:null).filter(Boolean):[];
      const eTop=eP.reduce((m,q)=>q.y<=m.y?q:m,eP[0]||{x:0,y:0}),es=vis.map(p=>showE&&p.e1!==null?Y(p.e1):null);
      const grid=ticks.map(v=>`<line class="exh-grid" x1="${L}" x2="${W-R}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="exh-ytick" x="${L-7}" y="${f(Y(v)+4)}" text-anchor="end">${Number(v.toFixed(1))}</text>`).join('');
      const unit=`<text class="exh-yunit" x="${L-7}" y="${f(Math.max(11,Y(ticks[ticks.length-1])-13))}" text-anchor="end">kg</text>`;
      const defs=`<defs><linearGradient id="${uid}-l" gradientUnits="userSpaceOnUse" x1="${L}" y1="0" x2="${W-R}" y2="0"><stop offset="0" stop-color="#7C5CFF" stop-opacity=".7"/><stop offset=".55" stop-color="#B49AFF"/><stop offset="1" stop-color="#F3EEFF"/></linearGradient><linearGradient id="${uid}-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9B7BFF" stop-opacity=".34"/><stop offset=".65" stop-color="#7C5CFF" stop-opacity=".07"/><stop offset="1" stop-color="#7C5CFF" stop-opacity="0"/></linearGradient><filter id="${uid}-g" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
      const area=`<path class="exh-area" d="${d} L ${f(xs[n-1])} ${f(base)} L ${f(xs[0])} ${f(base)} Z" fill="url(#${uid}-a)"/>`;
      const line=`<path class="exh-line" d="${d}" pathLength="1" stroke="url(#${uid}-l)" filter="url(#${uid}-g)"/>`;
      /* The estimate: dashed, no dots (a dot is a measurement), named on the line. */
      const e1=eP.length>1?`<path class="exh-e1" d="${N.smoothPath(eP)}"/>`:'';
      const e1l=eP.length>1?`<text class="exh-e1l" x="${f(Math.min(W-R-42,Math.max(L+46,eTop.x)))}" y="${f(eTop.y-9)}" text-anchor="middle">e1RM · estimate</text>`:'';
      const dots=vis.map((p,i)=>`<circle class="exh-dot" cx="${f(xs[i])}" cy="${f(ys[i])}" r="${dr}" style="--d:${dly(i)}ms"/>`).join('');
      /* The word sits above and to the side of the ring, away from the selection stem,
         and above the line: the best load is the highest point, so the line only falls away from it. */
      const right=bk>=0&&xs[bk]>(L+W-R)/2;
      const best=bk>=0&&bk<n?`<circle class="exh-ring" cx="${f(xs[bk])}" cy="${f(ys[bk])}" r="${dr+4.5}"/><text class="exh-best" x="${f(xs[bk]+(right?-8:8))}" y="${f(ys[bk]-dr-6)}" text-anchor="${right?'end':'start'}">Best</text>`:'';
      const sel=`<g class="exh-sel"><line class="exh-cur" x1="0" x2="0" y1="${T-8}" y2="${f(base)}"/><circle class="exh-act" cx="0" cy="0" r="5.5"/></g>`;
      /* Reps under every point while they fit; on a long range only the selected
         point's, so the numerals never run together (the readout names the rest). */
      const reps=vis.map((p,i)=>`<text class="exh-reps${slot>=18?'':' is-off'}" data-k="${i}" x="${f(xs[i])}" y="${f(ys[i]+(i===bk?dr+4.5:dr)+12)}" text-anchor="middle" style="--d:${dly(i)+40}ms">${p.reps}</text>`).join('');
      const axl=`<text class="exh-ax" x="${L}" y="${H-10}" text-anchor="start">${esc(exhAxis(vis[0].date))}</text><text class="exh-ax" x="${W-R}" y="${H-10}" text-anchor="end">${esc(exhAxis(last.date))}</text>`;
      const label=`Best working set per session, ${exh.ex} at ${exh.gym}: ${n} ${N.plural(n,"session")} from ${exhAxis(vis[0].date)} to ${exhAxis(last.date)}${showE?', with the estimated 1RM as a dashed line':''}`;
      host.innerHTML=`<svg class="exh-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}" aria-describedby="exh-eq"><title>${esc(label)}</title>${defs}${grid}${unit}${area}${e1}${line}${dots}${best}${sel}${reps}${e1l}${axl}</svg>`;
      exh.W=W;exh.off=off;exh.geo={xs,ys,es,top:T-8,n};
      const eq=document.getElementById('exh-eq');
      if(eq)eq.textContent=`${n} ${N.plural(n,"session")} from ${exhAxis(vis[0].date)} to ${exhAxis(last.date)}, best ${fmtLoad(bv.load)} kg × ${bv.reps} on ${exhAxis(bv.date)}${bk<0?' (before this range)':''}${showE&&last.e1!==null?`, e1RM ${fmtLoad(last.e1)} kg (estimate)`:''}. Best set per session: ${vis.map(p=>`${exhAxis(p.date)} ${fmtLoad(p.load)} kg × ${p.reps}`).join('; ')}.`;
      exhMark(exhCur());
      /* Draw-in plays on open and on a range change, never on a resize or a scrub,
         and not at all under reduced motion. Held until the plot is on screen, so a
         chart below the fold of the sheet is seen drawing, not drawn unseen. */
      host.classList.remove('is-draw','is-wait');
      if(animate&&!exhReduced()){
        host.classList.add('is-draw');
        if(typeof IntersectionObserver==='function'){
          host.classList.add('is-wait');
          const go=()=>host.classList.remove('is-wait');
          const io=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting&&x.intersectionRatio>=.3)){io.disconnect();go();}},{threshold:[.3,.35]});
          io.observe(host);
          setTimeout(()=>{io.disconnect();go();},3000);
        }
      }
    }catch(err){
      host.innerHTML='<div class="exh-empty"><b>Chart unavailable</b><span>The sessions are listed under Recent sessions.</span></div>';
      if(typeof console!=='undefined')console.error(err);
    }
  }
  function chooseExercise(i) {closeModal();N.selectExercise(i);}
  function editCurrentSet(i) {const r=N.sessionLogs().filter(r=>r.exercise===state.exercise)[i];if(r)openEditSet(r.id);}
  /* base.logSet() validates, writes and repaints synchronously. Arming the
     confirmation before the call is what lets the repaint it triggers render
     the success state in place, instead of a modal on top of it. */
  function logSet() {
    /* NXT.logSet() has no dayType check and reads state.exercise, which can hold
       a name left over from a previous strength day. On Rest or Zone 2 the only
       legitimate target is an exercise the user explicitly added, so refuse
       anything else rather than writing a set the UI never offered. This is a
       presentation-layer guard; the engine is untouched. */
    if (addOnEligible() && !addOnActive()) { toast('Add an exercise first.'); return; }
    const key=draftKey(),d=ui.drafts.get(key),before=state.logs.length;
    ui.drafts.delete(key);
    ui.confirmFrom=before;
    try{base.logSet();}finally{ui.confirmFrom=null;}
    if(state.logs.length===before&&d)ui.drafts.set(key,d);
  }
  function sessionMenu() {N.modal('Session options',row('Session',N.label(state.dayType),'showSessionSheet()')+row('Gym',state.gym,'closeModal();cycleGym()')+row('Equipment note',v88NoteFor(state.exercise)?'Saved':'Add note','NXP.equipmentNote()')+(N.features.checkin?row('Recovery','Check-in','apx96OpenReadiness()'):'')+row('Shorter session','First 3 exercises','NXT.shorter()')+row('Full session','Restore queue','NXT.fullSession()')+button('Finish workout','NXT.finish()',true));}
  function equipmentNote() {v88OpenNoteModal(state.exercise);}
  /* Weight highlights (D28): facts read straight from the weigh-ins, shown only
     when true — a new lowest reading, and weeks of falling averages in a row.
     No score, nothing stored. */
  function weightHighlights(){
    const rows=N.weights().filter(r=>r.date<=state.date&&Number.isFinite(Number(r.weight)));
    const out=[];
    if(rows.length>=5){
      const last=rows.at(-1),min=Math.min(...rows.map(r=>Number(r.weight)));
      const ago=Math.round((N.dateMs(state.date)-N.dateMs(last.date))/864e5);
      if(Number(last.weight)<=min&&ago<=7&&rows.slice(0,-1).some(r=>Number(r.weight)>min))out.push({k:'low',t:`Lowest weigh-in yet · ${Number(last.weight).toFixed(1)} kg`});
    }
    const byWeek=new Map();
    rows.forEach(r=>{const w=N.weekStart(r.date),a=byWeek.get(w)||[];a.push(Number(r.weight));byWeek.set(w,a);});
    const avgs=[...byWeek.entries()].sort((a,b)=>a[0].localeCompare(b[0])).filter(([,a])=>a.length>=3).map(([,a])=>a.reduce((x,y)=>x+y,0)/a.length);
    let down=0;
    for(let i=avgs.length-1;i>0&&avgs[i]<avgs[i-1];i--)down+=1;
    if(down>=2)out.push({k:'down',t:`${down} weeks of falling averages in a row`});
    return out;
  }
  function weeklyAvgs(){
    const rows=N.weights().filter(r=>r.date<=state.date&&Number.isFinite(Number(r.weight)));
    const by=new Map();
    rows.forEach(r=>{const w=N.weekStart(r.date),a=by.get(w)||[];a.push(Number(r.weight));by.set(w,a);});
    return [...by.entries()].sort((a,b)=>a[0].localeCompare(b[0])).filter(([,a])=>a.length>=3).map(([w,a])=>({week:w,avg:a.reduce((x,y)=>x+y,0)/a.length}));
  }
  /* A flat or up week, said plainly with the real numbers. Shown only when this
     week's average is above last week's AND the longer trend is still down. */
  function slowWeekHTML(){
    const w=weeklyAvgs();
    if(w.length<2)return '';
    const cur=w.at(-1),prev=w.at(-2);
    if(cur.week!==N.weekStart()||prev.week!==N.dateAdd(cur.week,-7))return '';
    const up=cur.avg-prev.avg,pl=N.detectPlateau(),rate=N.finite(pl&&pl.weeklyRate);
    if(!(up>=0.05)||rate===null||!(rate<0))return '';
    return `<p class="st-slow">This week’s average is ${up.toFixed(1)} kg above last week. Your trend is still down ${Math.abs(rate).toFixed(2)} kg a week. Daily weight moves around; the trend is what counts.</p>`;
  }
  /* The projection already says "~N weeks to goal"; this adds the date it points to. */
  function withGoalDate(html){
    const f=N.cfg().targetConfirmed?N.forecastGoal():null;
    if(!f||!f.ok||!(f.weeks>0))return html;
    const d=N.shortDate(N.dateAdd(state.date,f.weeks*7));
    return html.replace(/(~\d+ weeks? to goal(?: \(range \d+–\d+\))?)/,`$1 · around ${d}`);
  }
  function weightHighlightsHTML(){
    const h=weightHighlights();
    return h.length?`<ul class="st-wchips" aria-label="Highlights">${h.map(x=>`<li class="is-${x.k}"><i aria-hidden="true"></i><span>${esc(x.t)}</span></li>`).join('')}</ul>`:'';
  }
  function progress() {
    applyAppearance();
    syncTrainNav(false);
    const v=N.ui.view,r=N.ui.range;
    const period=r===14?'Last 2 weeks':r===30?'Last month':r===90?'Last 3 months':r==='cut'?(settings.cutStart?'Since your cut started · '+N.shortDate(settings.cutStart):'Since your first weigh-in'):'All recorded weigh-ins';
    const tabs=`<div class="n99-progress-tabs nxp-progress-tabs vn-progress-tabs" role="group" aria-label="Progress view">${[['overview','Weight'],['training','Training'],['strength','Performance','Lifts'],['body','Body']].map(([key,title,short])=>`<button type="button" class="${v===key?'active':''}" aria-pressed="${v===key}" aria-label="${title}" onclick="NXT.setView('${key}')">${short?`<span class="st-tab-l">${title}</span><span class="st-tab-s" aria-hidden="true">${short}</span>`:title}</button>`).join('')}</div>`;
    const chrome=`<header class="nxp-heading nxp-progress-chrome vn-progress-chrome"><div><h1>Progress</h1><p>${esc(period)}</p></div>${button('+ Weight','apx95OpenQuickWeight()',true)}</header>`;
    if(v==='body'){
      const waist=N.cleanRows(N.cfg().waist,'cm'),scans=bodyScanSource();
      document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress nxp-progress-body"><header class="nxp-heading nxp-progress-chrome"><div><h1>Progress</h1><p>${esc(bodyTitle(waist,scans))}</p></div>${button('+ Weight','apx95OpenQuickWeight()',true)}</header>${tabs}${bodySummary(waist,scans)}${compMapHTML(scans)}${bodyView(waist,scans)}</div>`;
      return;
    }
    if(v!=='training')N.ui.actLast=v;
    if(v==='training'){
      /* NXTFRM 2.0 — Training: the activity ledger. Counts and sums over stored
         rows (N.activityWeeks / N.activitySummary); nothing estimated. */
      const items=N.activityWeeks(actWeeks()),sum=N.activitySummary(items);
      /* Bars grow on arrival at this view or on a range change, never on the
         repaint after logging (same rule as the weight chart). */
      if(N.ui.actLast!=='training')N.ui.actAnim=true;N.ui.actLast='training';
      document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress nxp-progress-training vn-progress"><header class="nxp-heading nxp-progress-chrome vn-progress-chrome"><div><h1>Progress</h1><p>${esc(activitySubtitle(items,sum))}</p></div>${button('+ Weight','apx95OpenQuickWeight()',true)}</header>${tabs}${activityView(items,sum)}</div>`;
      return;
    }
    if(v==='strength'){
      /* 2G seam: the engine still owns strengthHTML for the legacy progress
         renderer. This screen paints its own list from strengthItems(), which
         remains the only source of status and e1RM. */
      const items=N.strengthItems();
      document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress nxp-progress-strength vn-progress"><header class="nxp-heading nxp-progress-chrome vn-progress-chrome"><div><h1>Progress</h1><p>${esc(performanceSubtitle(items))}</p></div>${button('+ Weight','apx95OpenQuickWeight()',true)}</header>${tabs}${performanceView(items)}</div>`;
      return;
    }
    /* Phase 2C — Weight owns its layout inside chartHTML (trajectory + journey).
       TDEE and weigh-in history are demoted below, not deleted. */
    document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress nxp-progress-weight vn-progress">${chrome}${tabs}${withGoalDate(N.chartHTML()).replace('<div class="vn-mhead"',weightHighlightsHTML()+slowWeekHTML()+'<div class="vn-mhead"')}${N.features&&N.features.calories?`<details class="nxp-progress-tdee nxp-disclosure vn-more-block"><summary>Energy estimate</summary>${N.tdeeCardHTML()}</details>`:''}<button type="button" class="vn-row vn-weighins" onclick="NXT.openWeightHistory()"><span class="vn-row-l"><span class="vn-row-t">All weigh-ins</span><span class="vn-row-s">${(n=>n+" "+N.plural(n,"reading"))(N.weights().length)}</span></span><span class="vn-chev">›</span></button></div>`;
  }
  /* Engine vocabulary only (I12). The word is the status; colour and shape follow it. */
  const PERF_NOTE='Estimated 1RM is a comparison aid, not a tested maximum or proof of muscle retention. Technique, effort and equipment setup affect it.';
  function fmtLoad(v) {
    const n=N.finite(v);
    if(n===null)return '';
    const r=Math.round(n*10)/10;
    return Number.isInteger(r)?String(r):r.toFixed(1);
  }
  function statusFlag(status) {
    return {
      'Improving':'is-improving',
      'Holding steady':'is-holding',
      'Watch':'is-watch',
      'Review':'is-review',
      'Older history':'is-older',
      'Building data':'is-building'
    }[status]||'is-building';
  }
  function statusRead(status) {
    switch(status){
      case 'Older history': return 'Too old to compare';
      case 'Building data': return 'Not enough yet';
      case 'Review': return 'Down on both of the latest two sessions';
      case 'Watch': return 'Down on this comparison, not repeated yet';
      case 'Improving': return 'Up across the last four sessions';
      case 'Holding steady': return 'Within the steady band';
      default: return '';
    }
  }
  /* A missing delta is not zero. Only a real engine delta is printed, at one decimal. */
  function deltaText(item) {
    if(item.delta===null||item.delta===undefined||!Number.isFinite(Number(item.delta)))return '';
    return N.signed(item.delta,1)+'%';
  }
  /* Each exercise is scaled from its own last eight sessions. Padding matches the
     engine spark so a flat series still has a line, and a pulldown is not drawn
     on a fly's axis. */
  function sparkModel(history) {
    const series=(history||[]).slice(-8);
    const values=series.map(x=>x.value);
    if(!values.length||values.some(v=>!Number.isFinite(v)))return null;
    const min=Math.min(...values)-1,max=Math.max(...values)+1,span=max-min||1;
    const points=values.map((v,i)=>({x:4+i/Math.max(1,values.length-1)*102,y:35-(v-min)/span*28}));
    return {series,values,min,max,points,d:N.smoothPath(points)};
  }
  function sparkText(item, model) {
    const bits=model.series.map(s=>N.shortDate(s.date)+' '+fmtLoad(s.value));
    return item.name+' at '+item.gym+'. Estimated 1RM, own scale '+fmtLoad(model.min)+' to '+fmtLoad(model.max)+': '+bits.join(', ')+'.';
  }
  function endMark(point, status) {
    const x=point.x,y=point.y,f=n=>Number(n).toFixed(2);
    if(status==='Holding steady')return `<rect class="vn-perf-mark is-holding" x="${f(x-2.6)}" y="${f(y-2.6)}" width="5.2" height="5.2"/>`;
    if(status==='Review'||status==='Watch'){
      const r=3.4,pts=`${f(x)},${f(y-r)} ${f(x+r)},${f(y)} ${f(x)},${f(y+r)} ${f(x-r)},${f(y)}`;
      const cls=status==='Review'?'is-review':'is-watch';
      return `<polygon class="vn-perf-mark ${cls}" points="${pts}"${status==='Watch'?' fill="none"':''}/>`;
    }
    if(status==='Older history')return `<line class="vn-perf-mark is-older" x1="${f(x-4)}" y1="${f(y)}" x2="${f(x+4)}" y2="${f(y)}"/>`;
    if(status==='Building data')return `<circle class="vn-perf-mark is-building" cx="${f(x)}" cy="${f(y)}" r="3.2" fill="none"/>`;
    return `<circle class="vn-perf-mark is-improving" cx="${f(x)}" cy="${f(y)}" r="3.2"/>`;
  }
  /* D50 — a performance row leads with the best set of the latest session (D20: heaviest
     load, then most reps), names the status as a pill, and plots the engine's estimated
     1RM per session as dots on a line with a soft area, the latest point carrying the
     status mark. The read sentence shows only when it says something the pill does not. */
  function performanceBest(item) {
    const last=item.history.at(-1),sets=last&&last.sets;
    if(!sets||!sets.length)return null;
    const b=N.bestSet(sets),load=N.finite(b&&b.weight),reps=N.finite(b&&b.reps);
    return load!==null&&reps!==null&&reps>0?{load,reps}:null;
  }
  function performanceMeta(item) {
    const bits=[];
    if(item.latestDate)bits.push(N.shortDate(item.latestDate));
    bits.push(item.sessions===1?'1 session':item.sessions+' sessions');
    bits.push(item.gym);
    return bits.join(' · ');
  }
  function performanceRow(item, i) {
    const flag=statusFlag(item.status);
    const delta=deltaText(item);
    const model=sparkModel(item.history);
    const best=performanceBest(item);
    const title=item.name+' at '+item.gym+', estimated 1RM';
    const eq=model?sparkText(item, model):item.name+' at '+item.gym+'. No sessions to plot.';
    const lineTone=item.tone==='good'?'is-good':item.tone==='watch'?'is-watch':'is-neutral';
    const lastPt=model?.points.at(-1);
    const f=n=>Number(n).toFixed(2);
    const gid='vpg'+i;
    const area=model&&model.points.length>1?`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".3"/><stop offset=".75" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><path class="vn-perf-area ${lineTone}" fill="url(#${gid})" d="${model.d} L ${f(model.points.at(-1).x)} 40 L ${f(model.points[0].x)} 40 Z"/>`:'';
    const dots=model?model.points.slice(0,-1).map(p=>`<circle class="vn-perf-dot" cx="${f(p.x)}" cy="${f(p.y)}" r="1.7"/>`).join(''):'';
    const plot=model?`<div class="vn-perf-plot"><svg class="n99-spark vn-perf-spark" viewBox="0 0 110 40" role="img" aria-labelledby="vn-perf-t-${i}" aria-describedby="vn-perf-eq-${i}" data-min="${model.min}" data-max="${model.max}"><title id="vn-perf-t-${i}">${esc(title)}</title>${area}<path class="vn-perf-line ${lineTone} ${flag}" d="${model.d}" fill="none"/>${dots}${lastPt?endMark(lastPt, item.status):''}</svg><span class="vn-perf-e1rm vn-num">e1RM ${esc(fmtLoad(item.latestE1rm))}</span><p class="vn-perf-eq" id="vn-perf-eq-${i}">${esc(eq)}</p></div>`:'';
    const read=['Review','Watch','Improving'].includes(item.status)?statusRead(item.status):'';
    const pillWord={'Building data':'Building','Older history':'Older','Holding steady':'Holding'}[item.status]||item.status;
    return `<li class="vn-perf-row st-perf" data-status="${esc(item.status)}" data-gym="${esc(item.gym)}" data-e1rm="${Number(item.latestE1rm)||0}" aria-label="${esc(item.name+'. '+(best?'Best set last time '+fmtLoad(best.load)+' kilograms for '+best.reps+'. ':'')+item.status+(delta?' '+delta:'')+'. '+statusRead(item.status))}"><div class="vn-perf-main"><h3 class="vn-perf-name">${esc(item.name)}<svg class="st-ico st-perf-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l7 7-7 7"/></svg></h3><div class="st-perf-line">${best?`<p class="st-perf-best vn-num">${esc(fmtLoad(best.load))}<small>kg</small> × ${best.reps}</p>`:''}<span class="vn-perf-flag st-perf-pill ${flag}" title="${esc(statusRead(item.status))}"><i aria-hidden="true"></i>${esc(pillWord)}${delta?` <b class="vn-num">${esc(delta)}</b>`:''}</span></div><p class="vn-perf-meta">${esc(performanceMeta(item))}</p>${read?`<p class="vn-perf-read">${esc(read)}</p>`:''}</div>${plot}<button type="button" class="st-perf-open" data-ex="${esc(item.name)}" data-gym="${esc(item.gym)}" onclick="NXP.exerciseDetails(this.dataset.ex,this.dataset.gym)" aria-label="${esc('Exercise details: '+item.name+' at '+item.gym)}"></button></li>`;
  }
  function performanceSubtitle(items) {
    const last=items.map(x=>x.latestDate).filter(Boolean).sort().at(-1);
    if(!items.length)return 'No lifting history yet';
    if(items.every(x=>x.status==='Older history'))return 'Too old to compare';
    if(items.every(x=>x.status==='Building data'))return 'Not enough yet';
    return last?'Last lift '+N.shortDate(last):items.length+' '+N.plural(items.length,'exercise')+' tracked';
  }
  function performanceIntro(items) {
    const last=items.map(x=>x.latestDate).filter(Boolean).sort().at(-1);
    if(!items.length)return 'Log the same exercise at the same gym to start a comparison.';
    if(items.every(x=>x.status==='Older history')){
      return 'Too old to compare. '+(last?'Last session '+N.shortDate(last)+'. ':'')+'None of these exercises is inside the 21-day window, so no change is shown.';
    }
    if(items.every(x=>x.status==='Building data')){
      return 'Not enough yet. Four sessions of the same exercise at the same gym are needed before a change is shown.';
    }
    const order=['Review','Watch','Improving','Holding steady','Building data','Older history'];
    const bits=order.map(status=>{
      const n=items.filter(x=>x.status===status).length;
      return n?n+' '+status:'';
    }).filter(Boolean);
    return bits.join(' · ')+(last?'. Latest session '+N.shortDate(last)+'.':'.');
  }
  function performanceSummary(items) {
    return `<header class="vn-perf-lead"><p class="vn-perf-intro">${esc(performanceIntro(items))}</p></header>`;
  }
  /* D99 · Your lifts since the cut started. Each lift's session value from the engine (the estimated 1RM of its
     best set, a comparison aid) at the cut start against its latest session, same exercise and gym: the last
     session on or before the cut start, or the first one after it. One question only, so no status words here:
     those answer "the last four sessions" in the list below (I12). Nothing here is a score. Lifts with only older
     history, or a single session, are left out; past seven lifts the middle folds behind "Show all". */
  function strengthSinceHTML(items) {
    const rows0=N.weights(),cs=settings&&Number.isFinite(N.dateMs(settings.cutStart))&&settings.cutStart<=state.date?settings.cutStart:(rows0[0]&&rows0[0].date);
    if(!cs)return '';
    const gyms=new Set(items.map(x=>x.gym));
    const rows=items.filter(x=>x.status!=='Older history'&&Array.isArray(x.history)&&x.history.length>=2).map(x=>{
      const h=x.history;let b=null;
      for(const s of h){if(s.date<=cs)b=s;else break;}
      if(!b)b=h.find(s=>s.date>cs);
      const l=h[h.length-1];
      if(!b||!l||b===l||!(b.value>0))return null;
      return {name:x.name,gym:x.gym,status:x.status,pct:(l.value/b.value-1)*100,from:b.date};
    }).filter(Boolean).sort((a,b)=>b.pct-a.pct);
    if(rows.length<2)return '';
    const mx=Math.max(4,...rows.map(r=>Math.abs(r.pct))),up=rows.filter(r=>r.pct>=.5).length,down=rows.filter(r=>r.pct<=-.5).length;
    const sum=`<b>${up} of ${rows.length}</b> ${N.plural(rows.length,'lift')} up since ${esc(N.shortDate(cs))}${down?`, ${down} down`:''}.`;
    return `<section class="st-since" aria-label="Your lifts since the cut started">
      <div class="st-since-h"><h2>Since your cut started</h2><span>${esc(N.shortDate(cs))} → now</span></div>
      <p class="st-since-sum">${sum}</p>
      <ol class="st-since-l">${rows.map((r,i)=>{const fold=rows.length>7&&i>=3&&i<rows.length-3,flat=Math.abs(r.pct)<.05,v=`${flat?'':r.pct>0?'+':'−'}${Math.abs(r.pct).toFixed(1)}%`;
        return `<li class="${fold?'is-more':''}" style="--i:${i}">
        <span class="st-since-n"><span class="nm">${esc(r.name)}</span>${gyms.size>1?`<small>${esc(r.gym)}</small>`:''}</span>
        <span class="st-since-bar${r.pct<0?' is-neg':''}" aria-hidden="true"><i style="--w:${(Math.abs(r.pct)/mx*50).toFixed(2)}%"></i></span>
        <b class="vn-num">${v}</b></li>`;}).join('')}</ol>
      ${rows.length>7?`<button type="button" class="st-since-more" aria-expanded="false" onclick="const s=this.closest('.st-since'),o=s.classList.toggle('is-open');this.setAttribute('aria-expanded',String(o));this.textContent=o?'Show fewer':'Show all ${rows.length}'">Show all ${rows.length}</button>`:''}
      <p class="st-since-note">Estimated 1RM of the best set: first session of your cut against the latest, same gym.</p>
    </section>`;
  }
  function performanceView(items) {
    const note=`<p class="vn-perf-note">${esc(PERF_NOTE)}</p>`;
    if(!items.length)return `<section class="vn-perf">${performanceSummary(items)}${note}</section>`;
    return `<section class="vn-perf" aria-label="Exercise comparisons">${performanceSummary(items)}${strengthSinceHTML(items)}<ol class="vn-perf-rows">${items.map(performanceRow).join('')}</ol>${note}</section>`;
  }
  /* ---- Progress › Training: the activity ledger (NXTFRM 2.0) ---------------
     Every figure is N.activityWeeks() / N.activitySummary(): counts and sums
     over the stored rows, through the engine's own workRows() filter. Three
     bar charts share one selected week and one stable readout; drag or arrow
     across any chart and the readout changes, the layout does not. The plan
     line is the CURRENT weekly plan drawn over past weeks as a reference and
     labelled as such — the app keeps no plan history, so it cannot claim
     what the plan was. Weeks before the first record are absent, never zero.
     No score, no streak badge, no estimate. */
  const ACT_RANGES=[[12,'12W'],[26,'26W'],[52,'1Y']];
  function actWeeks() { const n=Number(N.ui.actWeeks)||12; return ACT_RANGES.some(([w])=>w===n)?n:12; }
  function actFmt(n) { return Number(n||0).toLocaleString('en-SG'); }
  function actWeekLabel(w) { return w.current?'This week':'Week of '+N.shortDate(w.start); }
  function actWeekLong(w) { return N.shortDate(w.start)+' – '+N.shortDate(w.end); }
  function actWeekSub(w) { return w.current&&w.daysElapsed<7?`${actWeekLong(w)} · day ${w.daysElapsed} of 7`:actWeekLong(w); }
  function actTick(top) {
    /* One or two round gridlines under the bars; never more, the bars carry the value. */
    const raw=top/2,mag=Math.pow(10,Math.floor(Math.log10(Math.max(1,raw))));
    const step=[1,2,2.5,5,10].map(m=>m*mag).find(v=>v>=raw)||mag*10;
    const ticks=[];for(let v=step;v<top;v+=step)ticks.push(v);
    return ticks.slice(0,2);
  }
  function actBars(items,key,o) {
    const W=420,H=150,L=26,R=8,T=20,B=22,n=items.length;
    const vals=items.map(w=>Number(w[key])||0),ref=o.ref>0?o.ref:null;
    const top=Math.max(1,...vals,ref||0)*1.15;
    const y=v=>T+(1-v/top)*(H-T-B),base=y(0);
    const slot=(W-L-R)/n,bw=Math.min(34,slot*.62),x=i=>L+slot*i+(slot-bw)/2;
    const f=v=>Number(v).toFixed(1);
    const grid=actTick(top).map(v=>`<line class="st-act-grid" x1="${L}" x2="${W-R}" y1="${f(y(v))}" y2="${f(y(v))}"/><text class="st-ax st-act-gl" x="${L-6}" y="${f(y(v)+3.5)}" text-anchor="end">${actFmt(Math.round(v))}</text>`).join('');
    const bars=items.map((w,i)=>{
      const v=vals[i],h=v>0?Math.max(2,base-y(v)):0;
      const cls=['st-act-bar',i===o.sel?'is-sel':'',w.current?'is-cur':'',v===0?'is-zero':''].filter(Boolean).join(' ');
      const r=Math.min(6,bw/2);
      const rect=v>0
        ?`<rect class="${cls}" data-i="${i}" x="${f(x(i))}" y="${f(base-h)}" width="${f(bw)}" height="${f(h)}" rx="${f(r)}" style="--i:${i}"/>`
        :`<rect class="${cls}" data-i="${i}" x="${f(x(i))}" y="${f(base-2)}" width="${f(bw)}" height="2" rx="1" style="--i:${i}"/>`;
      const val=n<=13&&v>0?`<text class="st-act-val${i===o.sel?' is-sel':''}" data-i="${i}" x="${f(x(i)+bw/2)}" y="${f(base-h-5)}" text-anchor="middle">${actFmt(v)}</text>`:'';
      return rect+val;
    }).join('');
    const refLine=ref?`<line class="st-act-ref" x1="${L}" x2="${W-R}" y1="${f(y(ref))}" y2="${f(y(ref))}"/><text class="st-act-refl" x="${W-R}" y="${f(y(ref)-4)}" text-anchor="end">${esc(o.refLabel||'')}</text>`:'';
    const idx=n<=1?[0]:n<=4?items.map((_,i)=>i):[0,Math.round((n-1)/2),n-1];
    const xl=[...new Set(idx)].map((i,k,arr)=>{
      const w=items[i],anchor=k===0?'start':k===arr.length-1?'end':'middle';
      const cx=anchor==='start'?x(i):anchor==='end'?x(i)+bw:x(i)+bw/2;
      return `<text class="st-ax" x="${f(cx)}" y="${H-6}" text-anchor="${anchor}">${esc(w.current?'Now':N.shortDate(w.start))}</text>`;
    }).join('');
    return `<svg class="st-act-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${esc(o.id)}-t" aria-describedby="${esc(o.id)}-eq" style="--c:${o.color}"><title id="${esc(o.id)}-t">${esc(o.title)}</title>${grid}<line class="st-act-base" x1="${L}" x2="${W-R}" y1="${f(base)}" y2="${f(base)}"/>${refLine}${bars}${xl}</svg>`;
  }
  function actEq(items,key,unit) {
    return items.map(w=>N.shortDate(w.start)+' '+actFmt(w[key])+(unit?' '+unit:'')).join(', ')+'.';
  }
  function activitySubtitle(items,sum) {
    if(!items.length)return 'No training logged yet';
    const span=items.length===1?'This week':`Last ${items.length} weeks`;
    return `${span} · ${actFmt(sum.totalLiftDays)} lifting ${sum.totalLiftDays===1?'day':'days'} · ${actFmt(sum.totalCardioMin)} min cardio`;
  }
  function activityHeadline(items,sum) {
    if(!items.length)return 'Nothing logged yet';
    if(sum.fullWeeks===0)return 'Your first week of records';
    const lifts=sum.avgLiftDays===null?null:Math.round(sum.avgLiftDays*10)/10;
    if(lifts===null||lifts===0)return sum.avgCardioMin?`${Math.round(sum.avgCardioMin)} min of cardio a week on average`:'No lifting in these weeks';
    return `${lifts} lifting ${lifts===1?'day':'days'} a week on average`;
  }
  function activityView(items,sum) {
    const ranges=`<div class="vn-seg n99-segments st-act-seg" role="group" aria-label="Weeks shown">${ACT_RANGES.map(([w,l])=>`<button type="button" aria-pressed="${actWeeks()===w}" class="${actWeeks()===w?'active':''}" onclick="NXP.actRange(${w})">${l}</button>`).join('')}</div>`;
    if(!items.length){
      return `<section class="st-act is-empty" aria-label="Training activity">
        <p class="st-sect">Training</p>
        <h2 class="st-h3">Nothing logged yet</h2>
        <p class="st-body st-mt2">Lifting days, working sets, kg lifted and cardio minutes appear here week by week once a session or a walk is logged. Nothing is estimated.</p>
        <button type="button" class="st-cta" onclick="switchTab('train')">Open Train<span aria-hidden="true">›</span></button>
      </section>`;
    }
    const n=items.length,selIdx=N.ui.actSel!==null&&N.ui.actSel!==undefined&&N.ui.actSel<n?N.ui.actSel:n-1,sel=items[selIdx];
    const anim=N.ui.actAnim?' is-draw':'';N.ui.actAnim=false;
    const planLabel=sum.planLifts>0?`Plan · ${sum.planLifts}/wk`:'';
    const plan=sum.planLifts>0?`${sum.planLifts} lifting ${sum.planLifts===1?'day':'days'} a week in your current plan`:'No lifting days in your current plan';
    const consHead=sum.planLifts>0
      ?(sum.fullWeeks?`${sum.weeksAtPlan} of ${sum.fullWeeks} full ${sum.fullWeeks===1?'week':'weeks'} reached the plan${sum.bestRun>1?` · best run ${sum.bestRun} weeks`:''}`:'No full week yet')
      :'Set lifting days in Settings › Training to compare';
    const cons=sum.planLifts>0?`<ol class="st-act-cons" aria-label="Weeks at plan">${items.map((w,i)=>{
      const met=!w.current&&w.liftDays>=sum.planLifts;
      const cls=w.current?'is-cur':met?'is-met':'is-miss';
      const word=w.current?'this week, in progress':met?'plan met':'below plan';
      return `<li class="${cls}" style="--i:${i}"><span class="st-act-cd" aria-hidden="true"></span><span class="st-sr">${esc(actWeekLabel(w))}: ${w.liftDays} of ${sum.planLifts} lifting days, ${word}.</span></li>`;
    }).join('')}</ol>`:'';
    const read=`<div class="st-act-read" id="st-act-read" aria-live="polite">
        <p class="st-act-rl"><b id="st-act-rl">${esc(actWeekLabel(sel))}</b><span id="st-act-rs">${esc(actWeekSub(sel))}</span></p>
        <div class="st-act-rv">
          <div style="--c:var(--st-lift)"><b class="vn-num" id="st-act-v0">${sel.liftDays}</b><small>lift days</small></div>
          <div style="--c:var(--st-lift)"><b class="vn-num" id="st-act-v1">${sel.sets}</b><small>sets</small></div>
          <div style="--c:var(--st-lift)"><b class="vn-num" id="st-act-v2">${actFmt(sel.tonnage)}</b><small>kg lifted</small></div>
          <div style="--c:var(--st-cardio)"><b class="vn-num" id="st-act-v3">${sel.cardioMin}</b><small>cardio min</small></div>
        </div>
      </div>`;
    const block=(id,title,meta,key,o,unit)=>`<div class="st-act-blk">
        <div class="st-act-bh"><span class="st-cat" style="--c:${o.color}">${esc(title)}</span>${meta?`<span class="st-meta">${esc(meta)}</span>`:''}</div>
        <div class="st-act-wrap${anim}" id="${id}" tabindex="0" role="application" aria-label="${esc(title)} by week. Drag to inspect a week; left and right arrow keys move; Escape returns to this week."
          onpointerdown="NXP.actScrub(event)" onpointermove="if(event.buttons)NXP.actScrub(event)" onkeydown="NXP.actKey(event)">${actBars(items,key,Object.assign({id,title,sel:selIdx},o))}</div>
        <p class="st-sr" id="${id}-eq">${esc(title)}, by week: ${esc(actEq(items,key,unit))}</p>
      </div>`;
    const avgSets=sum.avgSets===null?'':`avg ${Math.round(sum.avgSets)} / full week`;
    return `<section class="st-act" aria-label="Training activity">
      <div class="st-act-head">
        <div><p class="st-sect">Training</p><h2 class="st-h3">${esc(activityHeadline(items,sum))}</h2><p class="st-meta st-mt2">${esc(plan)}${sum.cardioTarget?` · cardio target ${sum.cardioTarget} min`:''}</p></div>
      </div>
      <div class="st-range-row st-act-range">${ranges}</div>
      ${read}
      ${block('st-act-lifts','Lifting days',planLabel,'liftDays',{color:'var(--st-lift)',ref:sum.planLifts,refLabel:planLabel},'days')}
      ${block('st-act-sets','Working sets',avgSets,'sets',{color:'var(--st-lift)'},'sets')}
      ${block('st-act-cardio','Cardio minutes',sum.cardioTarget?`Target · ${sum.cardioTarget} min`:'','cardioMin',{color:'var(--st-cardio)',ref:sum.cardioTarget,refLabel:sum.cardioTarget?`Target · ${sum.cardioTarget}`:''},'min')}
      <div class="st-act-blk st-act-consblk">
        <div class="st-act-bh"><span class="st-cat" style="--c:var(--st-accent-lift)">Weeks at plan</span></div>
        <p class="st-meta">${esc(consHead)}</p>
        ${cons}
      </div>
      <details class="st-csum-d"><summary>How to read this</summary>
        <p>Every bar is a count over your saved records: lifting days are days with at least one working set, working sets exclude warm-ups, kg lifted is load × reps across working sets (a set at 0 kg adds none), and cardio is the minutes you logged.</p>
        <p>Weeks run Monday to Sunday. Weeks before your first record are not shown. The plan and cardio lines are your <em>current</em> settings drawn over past weeks as a reference — the app does not keep a history of plan changes. Nothing here is a score.</p>
      </details>
    </section>`;
  }
  function actRange(weeks) { N.ui.actWeeks=weeks;N.ui.actSel=null;N.ui.actAnim=true;N.repaint(); }
  function actItems() { return N.activityWeeks(actWeeks()); }
  function actSelect(index,opts) {
    const items=actItems();if(!items.length)return;
    const n=items.length,i=opts&&opts.clear?n-1:Math.max(0,Math.min(n-1,Number(index)||0));
    N.ui.actSel=i===n-1?null:i;
    const w=items[i];
    const text=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    text('st-act-rl',actWeekLabel(w));text('st-act-rs',actWeekSub(w));
    text('st-act-v0',w.liftDays);text('st-act-v1',w.sets);text('st-act-v2',actFmt(w.tonnage));text('st-act-v3',w.cardioMin);
    document.querySelectorAll('.st-act-bar[data-i],.st-act-val[data-i]').forEach(el=>el.classList.toggle('is-sel',Number(el.dataset.i)===i));
  }
  function actScrub(event) {
    const wrap=event.currentTarget||(event.target&&event.target.closest&&event.target.closest('.st-act-wrap')),svg=wrap&&wrap.querySelector('svg');
    const items=actItems();if(!svg||!items.length)return;
    if(event.type==='pointerdown'&&wrap.setPointerCapture){try{wrap.setPointerCapture(event.pointerId);}catch(_){}}
    const b=svg.getBoundingClientRect(),x=(event.clientX-b.left)/b.width*420;
    const n=items.length,slot=(420-26-8)/n;
    actSelect(Math.max(0,Math.min(n-1,Math.floor((x-26)/slot))));
  }
  function actKey(event) {
    const items=actItems();if(!items.length)return;
    const n=items.length,cur=N.ui.actSel===null||N.ui.actSel===undefined?n-1:N.ui.actSel;
    if(event.key==='ArrowRight'){actSelect(Math.min(n-1,cur+1));event.preventDefault();}
    else if(event.key==='ArrowLeft'){actSelect(Math.max(0,cur-1));event.preventDefault();}
    else if(event.key==='Home'){actSelect(0);event.preventDefault();}
    else if(event.key==='End'||event.key==='Escape'){actSelect(n-1,{clear:true});event.preventDefault();}
  }
  function bodyScans() {
    return [...(state.scans||[])].filter(s=>s&&Number.isFinite(N.dateMs(s.date))&&s.date<=state.date)
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }
  /* Settings reads scans through evoOrdered(). Progress uses that same list
     so the two surfaces cannot disagree about which reading is latest. */
  function bodyScanSource() {
    if(typeof evoOrdered==='function')return evoOrdered();
    return bodyScans();
  }
  function bodyTitle(waist,scans) {
    if(waist.length&&scans.length)return 'Waist and scans';
    if(waist.length)return waist.length===1?'One waist measurement':waist.length+' waist measurements';
    if(scans.length)return scans.length===1?'One Evo scan':scans.length+' Evo scans';
    return 'No measurements yet';
  }
  function bodySummary(waist) {
    const lastW=waist.at(-1),priorW=waist.at(-2);
    /* Lead with the measurement, not the count. The header already says how many
       readings exist, so repeating "3 waist measurements" as the headline said
       the same thing twice and made a tally the loudest thing on a screen whose
       subject is a number in centimetres. The delta beside it is presentation
       arithmetic over the two readings already listed below — the same class of
       display-only figure as the chart's post-workout delta. It is not stored,
       not fed to any calculation, and no Body semantics change. Scan figures
       are not repeated here; evoAnalysisHTML owns them. */
    if(lastW){
      const delta=priorW?lastW.cm-priorW.cm:null;
      const move=delta===null?'':`${delta>0?'+':''}${delta.toFixed(1)} cm vs ${esc(N.shortDate(priorW.date))}`;
      const meta=[esc(N.shortDate(lastW.date)),move].filter(Boolean).join(' · ');
      return `<section class="nxp-progress-body-summary"><span class="nxp-caption">Waist</span>`
        +`<strong>${esc(lastW.cm.toFixed(1))} <em>cm</em></strong>`
        +`<p>${meta}</p>${waist.length<2?'<p class="nxp-progress-body-scanline">A second reading is needed before a comparison.</p>':''}</section>`;
    }
    if(bodyScanSource().length)return '';
    return `<section class="nxp-progress-body-summary"><span class="nxp-caption">Body</span>`
      +`<strong>Nothing measured yet</strong>`
      +`<p>Waist and Evo scans are optional. Scale weight stays on the Weight tab; nothing here is estimated.</p></section>`;
  }
  /* Detail is the shared scan page. The capture form is not: that stays on
     Settings even if a form was left open there. */
  function bodyScanAnalysis(scans) {
    if(typeof evoUi==='function'&&typeof evoDetailHTML==='function'){
      const ui=evoUi();
      if(ui.mode==='detail'){
        const scan=scans.find(s=>s&&s.id===ui.detail);
        if(scan)return `<div class="vn-evo">${evoDetailHTML(scan,scans)}</div>`;
      }
    }
    if(!scans.length||typeof evoAnalysisHTML!=='function'){
      return `<p class="nxp-progress-body-empty">No scans saved. A scan is a reading from that moment, usually after a workout. It is not your morning weigh-in, and it never becomes the body-weight trend.</p>`;
    }
    return `<div class="vn-evo">${evoAnalysisHTML(scans)}</div>`;
  }
  /* Fat mass against muscle mass, scan by scan. Both axes are values the scan
     itself reported — nothing is derived — and each keeps its own scale. */
  function compMapHTML(scans) {
    const pts=(scans||[]).filter(s=>s&&N.finite(s.fatMass)!==null&&N.finite(s.muscleMass)!==null)
      .map(s=>({d:s.date,f:Number(s.fatMass),m:Number(s.muscleMass)}));
    if(pts.length<2)return '';
    const A=pts[0],B=pts.at(-1),df=B.f-A.f,dm=B.m-A.m;
    const sg=v=>(v>0?'+':v<0?'−':'±')+Math.abs(v).toFixed(1);
    return `<section class="st-tile st-compmap" style="--c:var(--st-fat)">
      <div class="st-tile-head"><span class="st-cat">Composition map</span><span class="st-meta">${pts.length} ${N.plural(pts.length,"scan")}</span></div>
      <p class="st-meta">Where each scan sits on fat mass and muscle mass</p>
      <div class="st-cm" data-st-cmap="${esc(JSON.stringify(pts))}" role="img" aria-label="${esc(pts.map(p=>N.shortDate(p.d)+': fat mass '+p.f+' kilograms, muscle mass '+p.m).join('; '))}"></div>
      <p class="st-cm-read"><b>${esc(N.shortDate(A.d))} → ${esc(N.shortDate(B.d))}</b> · <span style="color:var(--st-fat)">${sg(df)} kg fat mass</span> · <span style="color:var(--st-lean)">${sg(dm)} kg muscle mass</span></p>
      <p class="st-meta st-mt2">Left means less fat mass, up means more muscle mass. Scan estimates move with hydration, so small steps between neighbouring scans are within normal variation.</p>
    </section>`;
  }
  function bodyView(waist,scans) {
    const waistRows=waist.slice().reverse().map(r=>`<button type="button" class="n99-list-row nxp-progress-body-row" onclick="NXT.openWaist('${r.date}')"><span>${esc(N.shortDate(r.date))}</span><b>${r.cm.toFixed(1)} cm</b><span>Edit ›</span></button>`).join('');
    /* D55: the waist section shows only while the waist feature is on. */
    const waistSec=`<section class="nxp-progress-body-section"><h2 class="nxp-caption nxp-progress-body-heading">All readings</h2>${waist.length?waistRows:`<p class="nxp-progress-body-empty">No waist measurements yet. Optional, about once a week, with the same tape position.</p>`}${row('Log waist','+',"NXT.openWaist()",'Same position and similar conditions')}</section>`;
    return `${N.features.waist?waistSec:''}<section class="nxp-progress-body-section"><h2 class="nxp-caption nxp-progress-body-heading">Evo scans</h2>${bodyScanAnalysis(scans)}${row('New scan','Add','NXP.openBodyCapture()','Review and save in Settings')}${row('Import from Strata','Paste','NXT.importScans()','Bring in scans exported from Strata as CSV')}</section><p class="n99-small nxp-progress-body-note">Body fat and muscle figures only appear from saved Evo scans. They are not calculated from waist or scale weight.</p>`;
  }
  /* Opens the Settings capture form. It does not paint that form here, and
     it does not send the user to the analysis board to go looking. */
  function openBodyCapture() {
    if(typeof evoUi==='function'){
      const ui=evoUi();
      ui.mode='form';
      ui.detail='';
      if(!ui.draft&&typeof evoBlankReport==='function')ui.draft=evoBlankReport();
    }
    N.more('body');
  }
  /* ---- VNext Settings primitives (Phase 2E) --------------------------------
     Settings is configuration, not a dashboard. A row is typography, a
     hairline and a chevron — the group heading is a quiet label, not a
     container. Under D1 that leaves the hub with no protagonist surface at
     all, which is the correct answer for this destination. */
  /* Settings › Data: how full this device's storage is and when a backup was last requested.
     Reads existing records only (localStorage size, backupExportRequestedAt); stores nothing.
     The browser's real quota varies, so the figure is "roughly 5 MB", never exact. */
  function storageStatus() {
    let n=0;
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=k.length+(localStorage.getItem(k)||'').length;}}catch(e){return null;}
    const mb=n/1048576,pct=Math.min(100,Math.round(mb/5*100));
    const used=n<1048576?Math.max(1,Math.round(n/1024))+' KB':mb.toFixed(1)+' MB';
    const ts=Number(N.cfg().backupExportRequestedAt),age=ts?(Date.now()-ts)/864e5:null;
    const records=(state.logs||[]).length+(state.bws||[]).length;
    const stale=records>=10&&(age===null||age>30);
    const nearFull=pct>=70;
    const ph=scanPhotoStats();
    const sub=(ph.bytes>262144?'Scan photos use '+(ph.bytes/1048576).toFixed(1)+' MB \u2014 open to remove them. ':nearFull?'Getting full \u2014 export a backup. ':pct+'% of roughly 5 MB. ')+'Backup: '+(ts?backupLabel()+(stale?' \u2014 over a month ago':''):'none recorded yet');
    return {used,sub,tone:(nearFull||stale||ph.bytes>262144)?'watch':''};
  }
  /* D53 — Settings rows carry an iOS-style icon tile in a category hue. Decorative only
     (aria-hidden); the row's text still names it. Unknown titles get no icon. */
  const SET_ICONS={
    'Goals':['#8B5CF6','<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'],
    'Goals & calories':['#8B5CF6','<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'],
    'Training':['#7C6CF2','<path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/>'],
    'Cardio & recovery':['#D37732','<path d="M3.5 12.5h3.6l2.1-4.8 3.6 9.3 2.4-6.2 1.3 1.7h4"/>'],
    'Cardio':['#D37732','<path d="M3.5 12.5h3.6l2.1-4.8 3.6 9.3 2.4-6.2 1.3 1.7h4"/>'],
    'Your name':['#9B7BFF','<circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.2c1.3-3.3 3.8-4.9 6.5-4.9s5.2 1.6 6.5 4.9"/>'],
    'Appearance':['#6366F1','<circle cx="12" cy="12" r="7.6"/><path d="M12 4.4v15.2" /><path d="M12 4.4a7.6 7.6 0 0 1 0 15.2z" fill="currentColor" stroke="none"/>'],
    'Reminders':['#E8A93A','<path d="M7 16.5V11a5 5 0 0 1 10 0v5.5l1.5 1.5h-13z"/><path d="M10.3 20.2a1.9 1.9 0 0 0 3.4 0"/>'],
    'Body & scans':['#F07A52','<path d="M4.5 8V5.5a1 1 0 0 1 1-1H8M16 4.5h2.5a1 1 0 0 1 1 1V8M19.5 16v2.5a1 1 0 0 1-1 1H16M8 19.5H5.5a1 1 0 0 1-1-1V16"/><path d="M8 12h8"/>'],
    'Cloud & sync':['#5552BB','<path d="M7.5 18.5h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.6 9.3 4.6 4.6 0 0 0 7.5 18.5z"/>'],
    'Storage':['#7D7891','<ellipse cx="12" cy="6.8" rx="6.5" ry="2.6"/><path d="M5.5 6.8v10.4c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6V6.8M5.5 12c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6"/>'],
    'Wearable':['#A43066','<rect x="7" y="6.5" width="10" height="11" rx="3"/><path d="M9 6.5l.7-3h4.6l.7 3M9 17.5l.7 3h4.6l.7-3M12 9.8V12l1.5 1"/>'],
    'App & install':['#8B5CF6','<rect x="7" y="3.5" width="10" height="17" rx="2.6"/><path d="M10.5 17.6h3"/>'],
    'Classic app':['#7D7891','<path d="M4.8 12a7.2 7.2 0 1 0 2.1-5.1"/><path d="M4.5 4.8v3.4h3.4M12 8.2V12l2.6 1.6"/>']
  };
  function setIcon(title) {
    const ic=SET_ICONS[title];
    return ic?`<span class="st-set-ic" style="--ic:${ic[0]}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic[1]}</svg></span>`:'';
  }
  function setRow(title,value,action,sub='',tone='') {
    return `<button type="button" class="vn-set-row${SET_ICONS[title]?' has-ic':''}" onclick="${esc(action)}">`+setIcon(title)
      +`<span class="vn-set-l"><span class="vn-set-t">${esc(title)}</span>${sub?`<span class="vn-set-s">${esc(sub)}</span>`:''}</span>`
      +`<span class="vn-set-v${tone?' vn-set-flag is-'+tone:''}">${tone?'<i aria-hidden="true"></i>':''}${esc(value||'')}</span>`
      +`<i class="vn-chev" aria-hidden="true">›</i></button>`;
  }
  function setGroup(title,rows) {
    return `<section class="vn-set-group"><h2 class="vn-set-grp">${esc(title)}</h2><div class="vn-set-rows">${rows}</div></section>`;
  }
  function settingsHead(title,sub='') {
    return `<header class="vn-set-head"><button type="button" class="vn-set-back" aria-label="Back to Settings" onclick="NXT.more('hub')"><i aria-hidden="true">‹</i>Settings</button>`
      +`<h1>${esc(title)}</h1>${sub?`<p>${esc(sub)}</p>`:''}</header>`;
  }
  /* D11 / §3.6 — the actionable conditions are the ones already encoded in
     updateCloudLocalBanner() (cut-support.js): A sync failure, B configured
     but signed out, C unsynced data at meaningful risk. This reads the same
     signals and only decides how loud the row is. It derives nothing new,
     writes nothing, and changes no sync behaviour. Healthy operation returns
     an empty tone, so the row is a plain value with no status mark. */
  function cloudSignal() {
    const calm={word:cloudUser?'Signed in':'Local-only',tone:'',sub:'Backup export: '+backupLabel()};
    if(typeof cloudSessionChecked!=='undefined'&&!cloudSessionChecked)return calm;
    let configured=false,dismissed=false;
    try{configured=!!((localStorage.getItem('apm_sb_url')||'').trim()&&(localStorage.getItem('apm_sb_key')||'').trim());}catch(e){}
    try{dismissed=localStorage.getItem('nxtfrm_cloud_banner_dismissed')==='1';}catch(e){}
    const signedOut=!cloudUser&&!(typeof hasStoredSbAuthToken==='function'&&hasStoredSbAuthToken());
    const hasData=(Array.isArray(state.logs)&&state.logs.length>0)||(Array.isArray(state.bws)&&state.bws.length>0);
    if(typeof lastCloudError!=='undefined'&&lastCloudError)return {word:'Sync error',tone:'concern',sub:'The last cloud save did not complete'};
    if(configured&&signedOut)return {word:'Sign-in needed',tone:'watch',sub:'Cloud backup is set up but this device is signed out'};
    if(signedOut&&hasData&&!(typeof lastCloudSyncAt!=='undefined'&&lastCloudSyncAt)&&!dismissed)return {word:'Not backed up',tone:'watch',sub:'Your records exist on this device only'};
    return calm;
  }
  /* ---- Training: split + routines (D22) ------------------------------------
     A routine is the saved programme for one workout type at one gym
     (cfg().templates[gym+'__'+type], validated by NXT.validTemplate). The
     editor works on a draft and writes only on Save, after a safety snapshot.
     Today's workout is re-seeded from the new routine when nothing has been
     logged in it yet, so an edit shows up immediately. */
  const NON_LIFT=['Rest','Zone2','Floorball'];
  const DAY_ORDER=[1,2,3,4,5,6,0],DAY_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],DAY_LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function liftTypes(){return N.typeNames().filter(x=>!NON_LIFT.includes(x));}
  function gyms(){const g=['Gym A','Gym B'];if(state.gym&&!g.includes(state.gym))g.push(state.gym);return g;}
  function routineGym(){return ui.routineGym||state.gym||'Gym A';}
  function daysFor(type){return DAY_ORDER.filter(d=>settings.weeklyPlan&&settings.weeklyPlan[d]===type).map(d=>DAY_SHORT[d]);}
  function typeShort(t){return ({FullA:'Full A',FullB:'Full B',FullC:'Full C',Zone2:'Walk',Floorball:'Floorball',Pump:'Legs',Rest:'Rest'})[t]||N.label(t);}
  function trainingView(){
    syncTrainNav(false);
    const gym=routineGym(),plan=settings.weeklyPlan||{};
    const used=[...new Set(DAY_ORDER.map(d=>plan[d]).filter(x=>x&&!NON_LIFT.includes(x)))];
    const others=liftTypes().filter(x=>!used.includes(x));
    const week=DAY_ORDER.map(d=>{const ty=plan[d]||'Rest',lift=!NON_LIFT.includes(ty);return `<button type="button" class="st-wd${lift?' is-lift':''}${d===new Date(N.dateMs(state.date)).getUTCDay()?' is-today':''}" onclick="NXP.pickDay(${d})" aria-label="${DAY_LONG[d]}: ${esc(N.label(ty))}. Change"><small>${DAY_SHORT[d].slice(0,1)}</small><b>${esc(typeShort(ty))}</b></button>`;}).join('');
    const card=ty=>{const rows=N.templateFor(ty,gym),sets=rows.reduce((a,e)=>a+Number(e.sets),0),days=daysFor(ty);
      return `<button type="button" class="st-rt" onclick="NXP.editRoutine('${ty}')"><span class="st-rt-l"><b>${esc(N.label(ty))}</b><small>${rows.length} ${N.plural(rows.length,"exercise")} · ${sets} ${N.plural(sets,"set")}${days.length?' · '+days.join(', '):''}</small><span class="st-rt-p">${esc(rows.slice(0,3).map(e=>e.name).join(' · '))}${rows.length>3?' …':''}</span></span><i aria-hidden="true">›</i></button>`;};
    document.getElementById('morePage').innerHTML=shell(`${settingsHead('Training','Your split, routines and gyms')}
      <section class="st-set-sec"><div class="st-set-h"><h2>Your week</h2><span>Tap a day to change it</span></div><div class="st-week7">${week}</div></section>
      <section class="st-set-sec"><div class="st-set-h"><h2>Routines</h2>
        <div class="st-gymseg" role="group" aria-label="Gym">${gyms().map(g=>`<button type="button" class="${g===gym?'is-on':''}" aria-pressed="${g===gym}" onclick="NXP.setRoutineGym('${esc(g)}')">${esc(g)}</button>`).join('')}</div></div>
        <p class="st-set-note">Each gym keeps its own routines, so loads and machines stay comparable.</p>
        <div class="st-rts">${used.map(card).join('')||'<p class="st-set-note">No lifting days in your week yet.</p>'}</div>
        ${others.length?`<details class="st-more-rt"><summary>Other routines · ${others.length}</summary><div class="st-rts">${others.map(card).join('')}</div></details>`:''}
      </section>`,'vn-settings st-settings');
  }
  function setRoutineGym(g){ui.routineGym=g;trainingView();}
  function pickDay(d){
    const cur=(settings.weeklyPlan||{})[d];
    N.modal(DAY_LONG[d],`<div class="st-mgroup">${N.pickTypes(cur).map(ty=>`<button type="button" class="st-mrow st-pick${ty===cur?' is-on':''}" onclick="NXP.setDay(${d},'${ty}')"><span class="st-mrow-l"><b>${esc(N.label(ty))}</b>${NON_LIFT.includes(ty)?'':`<small>${(n=>n+' '+N.plural(n,'exercise'))(N.templateFor(ty,routineGym()).length)}</small>`}</span><i aria-hidden="true">${ty===cur?'✓':''}</i></button>`).join('')}</div>`);
  }
  function setDay(d,ty){
    if(!N.typeNames().includes(ty))return;
    const plan={...(settings.weeklyPlan||{})};if(plan[d]===ty){closeModal();return;}
    if(!N.snapshot('Before weekly plan change'))return;
    N.cfg().previousWeeklyPlan=N.copy(settings.weeklyPlan||{});
    plan[d]=ty;settings.weeklyPlan=plan;state.dayType=N.typeFor(state.date);
    closeModal();N.commit(DAY_LONG[d]+' set to '+N.label(ty));
  }
  function editRoutine(type){
    const gym=routineGym();
    ui.routine={type,gym,rows:N.copy(N.templateFor(type,gym)),dirty:false,both:false};
    N.more('routine');
  }
  function routineView(){
    syncTrainNav(false);
    const r=ui.routine;if(!r){N.more('training');return;}
    const sets=r.rows.reduce((a,e)=>a+Number(e.sets),0),days=daysFor(r.type);
    const other=gyms().filter(g=>g!==r.gym)[0];
    const rows=r.rows.map((e,i)=>`<div class="st-rx">
        <span class="st-rx-n">${i+1}</span>
        <button type="button" class="st-rx-main" onclick="NXP.routineEdit(${i})"><b>${esc(e.name||'Choose exercise')}</b><small>${e.sets} × ${e.reps[0]}–${e.reps[1]}${Number(e.inc)>0?' · +'+trimNum(e.inc)+' kg':''}</small></button>
        <span class="st-rx-mv"><button type="button" ${i===0?'disabled':''} aria-label="Move ${esc(e.name)} up" onclick="NXP.routineMove(${i},-1)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12.5L10 7.5l5 5"/></svg></button><button type="button" ${i===r.rows.length-1?'disabled':''} aria-label="Move ${esc(e.name)} down" onclick="NXP.routineMove(${i},1)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5l5 5 5-5"/></svg></button></span>
      </div>`).join('');
    document.getElementById('morePage').innerHTML=shell(`<header class="vn-set-head"><button type="button" class="vn-set-back" aria-label="Back to Training" onclick="NXP.routineBack()"><i aria-hidden="true">‹</i>Training</button>
        <h1>${esc(N.label(r.type))}</h1><p>${esc(r.gym)} · ${r.rows.length} ${N.plural(r.rows.length,"exercise")} · ${sets} ${N.plural(sets,"set")}${days.length?' · '+days.join(', '):''}</p></header>
      <div class="st-rxs">${rows}
        <button type="button" class="st-rx-add" onclick="NXP.routinePick(-1)"><span aria-hidden="true">+</span>Add exercise</button>
      </div>
      ${other?`<label class="st-both"><input type="checkbox" ${r.both?'checked':''} onchange="NXP.routineBoth(this.checked)"><span><b>Also save to ${esc(other)}</b><small>Overwrites ${esc(other)}’s ${esc(N.label(r.type))} routine</small></span></label>`:''}
      <button type="button" class="st-rx-reset" onclick="NXP.routineDefault()">Restore default exercises</button>
      <div class="st-savebar${r.dirty?' is-dirty':''}"><span>${r.dirty?'Unsaved changes':'All changes saved'}</span><button type="button" class="st-save" ${r.dirty?'':'disabled'} onclick="NXP.routineSave()">Save routine</button></div>`,'vn-settings st-settings st-routine');
  }
  function routineBack(){
    const r=ui.routine;
    if(r&&r.dirty&&!confirm('Discard unsaved changes to this routine?'))return;
    ui.routine=null;N.more('training');
  }
  function routineTouch(){ui.routine.dirty=true;routineView();}
  function routineMove(i,dir){const rows=ui.routine.rows,j=i+dir;if(j<0||j>=rows.length)return;[rows[i],rows[j]]=[rows[j],rows[i]];routineTouch();}
  function routineBoth(on){ui.routine.both=!!on;ui.routine.dirty=true;routineView();}
  function routineDefault(){
    const r=ui.routine,def=N.copy(N.defaults[r.type]||TEMPLATES[r.type]||[]);
    if(!def.length)return toast('No default exists for this routine.');
    if(!confirm('Replace this draft with the default exercises? Nothing is saved until you tap Save.'))return;
    r.rows=def;routineTouch();
  }
  /* Edit sheet: steppers write straight into the draft row. */
  function routineEdit(i){
    const e=ui.routine.rows[i];if(!e)return;
    const step=(k,label,val,sub)=>`<div class="st-es"><span><b>${label}</b>${sub?`<small>${sub}</small>`:''}</span><div class="st-es-c"><button type="button" aria-label="Decrease ${label}" onclick="NXP.routineStep(${i},'${k}',-1)">−</button><output class="vn-num" id="st-es-${k}">${val}</output><button type="button" aria-label="Increase ${label}" onclick="NXP.routineStep(${i},'${k}',1)">+</button></div></div>`;
    N.modal(e.name||'Exercise',`<div class="st-menu">
      <div class="st-mgroup">
        ${step('sets','Working sets',e.sets,'')}
        ${step('lo','Min reps',e.reps[0],'Bottom of the rep range')}
        ${step('hi','Max reps',e.reps[1],'Your best set reaching this twice, or passing it once, earns the next load')}
        ${step('inc','Load step',trimNum(e.inc)+' kg','How much the weight goes up')}
      </div>
      <div class="st-mgroup">
        <button type="button" class="st-mrow" onclick="NXP.routinePick(${i})"><span class="st-mrow-l"><b>Change exercise</b><small>Keep these sets and reps</small></span><i aria-hidden="true">›</i></button>
        <button type="button" class="st-mrow is-danger" onclick="NXP.routineRemove(${i})"><span class="st-mrow-l"><b>Remove from routine</b></span></button>
      </div>
      <button type="button" class="st-cta" onclick="closeModal()">Done</button>
    </div>`);
  }
  const INC_STEPS=[0,1,1.25,2,2.5,5,10];
  function routineStep(i,k,dir){
    const e=ui.routine.rows[i];if(!e)return;
    if(k==='sets')e.sets=Math.max(1,Math.min(8,Number(e.sets)+dir));
    else if(k==='lo'){e.reps=[Math.max(1,Math.min(e.reps[1],e.reps[0]+dir)),e.reps[1]];}
    else if(k==='hi'){e.reps=[e.reps[0],Math.max(e.reps[0],Math.min(30,e.reps[1]+dir))];}
    else if(k==='inc'){const ix=Math.max(0,INC_STEPS.findIndex(x=>x>=Number(e.inc)-1e-9));e.inc=INC_STEPS[Math.max(0,Math.min(INC_STEPS.length-1,ix+dir))];}
    const out=document.getElementById('st-es-'+k);
    if(out)out.textContent=k==='sets'?e.sets:k==='lo'?e.reps[0]:k==='hi'?e.reps[1]:trimNum(e.inc)+' kg';
    ui.routine.dirty=true;routineView();
  }
  function routineRemove(i){
    if(ui.routine.rows.length<=1)return toast('Keep at least one exercise.');
    ui.routine.rows.splice(i,1);closeModal();routineTouch();
  }
  /* Exercise picker: search the shipped library plus every name in use. */
  function routinePick(i){
    ui.pickIndex=i;
    N.modal(i<0?'Add exercise':'Change exercise',`<div class="st-picker"><input id="st-pick-q" class="st-pick-q" type="search" placeholder="Search exercises" autocomplete="off" oninput="NXP.routineFilter(this.value)"><div id="st-pick-list" class="st-mgroup st-pick-list">${pickList('')}</div></div>`);
  }
  function pickList(q){
    const have=new Set(ui.routine.rows.map(e=>e.name)),s=String(q||'').trim().toLowerCase();
    const names=v88AllExerciseNames().filter(n=>!s||n.toLowerCase().includes(s)).slice(0,80);
    const mus=n=>{try{if(typeof NXTLIB==='undefined')return '';const m=NXTLIB.musclesFor(n);return m.primary.map(id=>NXTANAT.label(id)).join(' · ');}catch(e){return '';}};
    const custom=s&&!names.some(n=>n.toLowerCase()===s)?`<button type="button" class="st-mrow" data-name="${esc(q.trim())}" onclick="NXP.routineChoose(this.dataset.name)"><span class="st-mrow-l"><b>Use “${esc(q.trim())}”</b><small>Custom exercise</small></span><i aria-hidden="true">+</i></button>`:'';
    return names.map(n=>`<button type="button" class="st-mrow${have.has(n)?' is-in':''}" data-name="${esc(n)}" ${have.has(n)?'disabled':''} onclick="NXP.routineChoose(this.dataset.name)"><span class="st-mrow-l"><b>${esc(n)}</b>${mus(n)?`<small>${esc(mus(n))}</small>`:''}</span><i aria-hidden="true">${have.has(n)?'In routine':'+'}</i></button>`).join('')+custom;
  }
  function routineFilter(q){const el=document.getElementById('st-pick-list');if(el)el.innerHTML=pickList(q);}
  function routineChoose(name){
    name=String(name||'').trim().slice(0,100);if(!name)return;
    const r=ui.routine;
    if(r.rows.some((e,j)=>e.name===name&&j!==ui.pickIndex))return toast('Already in this routine.');
    if(ui.pickIndex<0){
      if(r.rows.length>=15)return toast('A routine can hold up to 15 exercises.');
      const d=typeof exerciseDefByName==='function'?exerciseDefByName(name,r.type):null;
      r.rows.push({name,sets:Number(d&&d.sets)||3,reps:Array.isArray(d&&d.reps)?[Number(d.reps[0]),Number(d.reps[1])]:[8,12],inc:Number.isFinite(Number(d&&d.inc))?Number(d.inc):2.5});
    }else{
      r.rows[ui.pickIndex]={...r.rows[ui.pickIndex],name};
    }
    closeModal();routineTouch();
  }
  function reseedToday(type,gym){
    /* Only a session that has not started is re-seeded: logged sets are never
       orphaned, and a workout in progress keeps its queue. */
    const key=sessionKey(type,state.date,gym);
    const logged=(state.logs||[]).some(x=>x&&x.date===state.date&&(x.gym||'Gym A')===gym&&(!x.dayType||x.dayType===type));
    if(logged)return false;
    state.sessionPlans=state.sessionPlans||{};
    state.sessionPlans[key]=N.templateFor(type,gym).map(e=>e.name);
    N.cfg().sessionTargets[key]=N.copy(N.templateFor(type,gym));
    if(type===state.dayType&&gym===state.gym)state.exercise=state.sessionPlans[key][0]||'';
    return true;
  }
  /* Routine edits only rewrite the saved workout template; logs, weights and scans are not touched.
     If the local safety copy cannot be made, say why and let the person choose. */
  function confirmNoSafetyCopy(){
    const i=N.snapshot.issue||{};
    return confirm('Could not make a safety copy'+(i.full?' because this device\u2019s storage is full':'')+'. Saving this routine only changes the workout list; your logs, weights and scans are not touched.\n\nSave anyway? Export a backup from Settings \u203a Data when you can.');
  }
  function routineSave(){
    const r=ui.routine;if(!r)return;
    r.rows=r.rows.map(e=>({...e,name:String(e.name||'').trim(),sets:Math.round(Number(e.sets)),reps:[Math.round(Number(e.reps[0])),Math.round(Number(e.reps[1]))],inc:Number(e.inc)}));
    if(!N.validTemplate(r.rows))return toast('Check names are filled in and not repeated.');
    if(!N.snapshot('Before routine edit',{quiet:true})&&!confirmNoSafetyCopy())return;
    const targets=[r.gym].concat(r.both?gyms().filter(g=>g!==r.gym):[]);
    let live=false;
    targets.forEach(g=>{N.cfg().templates[g+'__'+r.type]=N.copy(r.rows);if(reseedToday(r.type,g)&&g===state.gym&&r.type===state.dayType)live=true;});
    r.dirty=false;r.both=false;
    N.commit(N.label(r.type)+' saved'+(live?' · today’s workout updated':''));
  }
  /* Train: when today's queue differs from the routine, offer to keep it. */
  function sessionDiffers(){
    const names=template().map(e=>e.name),base=N.templateFor().map(e=>e.name);
    return names.length!==base.length||names.some((n,i)=>n!==base[i]);
  }
  function saveTodayToRoutine(){
    const rows=template().map(e=>({name:e.name,sets:Number(e.sets),reps:[Number(e.reps[0]),Number(e.reps[1])],inc:Number(e.inc)}));
    if(!N.validTemplate(rows))return toast('Check this workout in Settings › Training first.');
    if(!N.snapshot('Before saving workout to routine',{quiet:true})&&!confirmNoSafetyCopy())return;
    N.cfg().templates[state.gym+'__'+state.dayType]=N.copy(rows);
    if(typeof closeModal==='function')closeModal();
    N.commit(N.label(state.dayType)+' routine updated');
  }
  function evoScanView() {
    const page=document.getElementById('morePage');
    if(!page)return;
    page.classList.remove('nxp-settings-page');
    page.setAttribute('data-vn-view','body');
    page.innerHTML=shell(typeof renderEvoScanPage==='function'?renderEvoScanPage():'','vn-evo');
  }
  function more() {
    applyAppearance();
    syncTrainNav(false);
    const view=state.moreView||'hub',c=N.cfg(),page=document.getElementById('morePage');
    page.classList.toggle('nxp-settings-page',view!=='hub'&&view!=='appearance'&&view!=='data'&&view!=='body');
    page.setAttribute('data-vn-view',view);
    if(view==='appearance'){appearanceView();return;}
    if(view==='data'){dataView();return;}
    if(view==='body'){evoScanView();return;}
    if(view==='training'){page.classList.add('nxp-settings-page');trainingView();return;}
    if(view==='routine'){page.classList.add('nxp-settings-page');routineView();return;}
    if(view!=='hub'){base.more();subviewChrome();return;}
    const lifts=Object.values(settings.weeklyPlan||{}).filter(t=>!['Rest','Zone2','Floorball'].includes(t)).length;
    const waist=N.cleanRows(c.waist,'cm').length;
    const p=pref(),cloud=cloudSignal();
    const look=[p.text==='large'?'Larger text':'Standard text',p.motion==='reduced'?'Reduced motion':''].filter(Boolean).join(' · ');
    page.innerHTML=shell(`<h1 class="vn-set-title">Settings</h1>
      ${moreAccount()}
      ${setGroup('Plan',
        (N.features&&N.features.calories?setRow('Goals & calories',c.calories?formatNumber(c.calories)+' kcal':'Set up',"NXT.more('goals')",c.targetConfirmed?goalLow()+'–'+goalHigh()+' kg range':'Calorie guide and optional goal range'):setRow('Goals',c.targetConfirmed?goalLow()+'–'+goalHigh()+' kg':'Set up',"NXT.more('goals')",settings.cutStart?'Goal range and cut start · from '+N.shortDate(settings.cutStart):'Optional goal range and cut start'))
        +setRow('Training',lifts+(lifts===1?' lifting day':' lifting days'),"NXT.more('training')",'Weekly plan, saved workouts and gyms')
        +setRow(N.features.checkin?'Cardio & recovery':'Cardio',(Number(settings.zone2WeeklyTarget)||90)+' min / week',"NXT.more('coach')",N.features.checkin?'Weekly minutes and recovery check-ins':'Weekly minutes'))}
      ${setGroup('Preferences',
        setRow('Your name',userName()||'Not set',"NXP.nameSheet()",'Used in the greeting on Today')
        +setRow('Appearance',look,"NXT.more('appearance')",'Text size and motion')
        +(N.features.reminders?setRow('Reminders',state.notifs?.enabled?'On':'Off',"NXT.more('notifications')",'Weigh-in, cardio and backup prompts'):''))}
      ${setGroup('Body',
        setRow('Body & scans',waist?waist+(waist===1?' waist entry':' waist entries'):'None yet',"NXT.more('body')",'Evo scans and measurements'))}
      ${setGroup('Data',
        setRow('Cloud & sync',cloud.word,"NXT.more('data')",cloud.sub,cloud.tone)
        +(()=>{const st=storageStatus();return st?setRow('Storage',st.used,"NXT.more('data')",st.sub,st.tone):'';})()
        +(N.features.wearable?setRow('Wearable',wearableConnectionLabel(),'NXP.openWearableConnection()','Connection stays off until a secure backend exists'):''))}
      ${setGroup('About',
        setRow('App & install','',"NXT.more('app')",'Install, build version and safe reset')
        +(N.features.classic?setRow('Classic app','Backup',"location.href='classic/'",'The previous design, using the same data'):''))}
      ${cloudUser?`<div class="vn-set-account-out"><button type="button" class="vn-set-text" onclick="cloudSignOut()">Sign out</button></div>`:''}
      <p class="vn-set-foot">NXTFRM · your next form</p>`,'vn-settings');
  }
  function moreAccount() {
    const signed=!!cloudUser;
    const configured=!!((localStorage.getItem('apm_sb_url')||'').trim()&&(localStorage.getItem('apm_sb_key')||'').trim());
    const title=signed?(cloudUser.email||'Signed in'):configured?'Sign-in needed':'Local-only';
    const detail=[state.gym||null,signed?'Cloud session on this device':'Stored on this device'].filter(Boolean).join(' · ');
    /* D53: the account block is an identity card — monogram, name, storage state. */
    const name=userName(),mono=(name||'N').trim().charAt(0).toUpperCase();
    return `<section class="vn-set-account st-id"><span class="st-id-mono" aria-hidden="true">${esc(mono)}</span><span class="st-id-t"><b>${esc(name||'NXTFRM')}</b><span class="st-id-s">${esc(title)}</span><small>${esc(detail)}</small></span></section>`;
  }
  /* Tier 2 / Tier 3 (§3.5): the bodies of goals / training / coach live in
     cut-support.js and body / notifications / app in index.html, neither of
     which this slice may edit. Chrome is normalised here, from the
     premium-ui.js side, after the engine has written the page. Nothing inside
     the subviews is rewritten. */
  function subviewChrome() {
    const page=document.getElementById('morePage');if(!page)return;
    const head=page.querySelector('.n99-heading');
    if(head){
      head.classList.add('vn-set-subhead');
      const eyebrow=head.querySelector('.n99-eyebrow');
      if(eyebrow)eyebrow.textContent='Settings';
      const back=head.querySelector('.n99-button');
      if(back){back.innerHTML='<svg class="st-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Settings';back.setAttribute('aria-label','Back to Settings');}
    }
    /* Tier 3 keeps its V96 body by design; the icon-only back control is the
       one thing that cannot stay as it is, because it has no accessible name. */
    const legacyBack=page.querySelector('.apx96-back');
    if(legacyBack&&!legacyBack.getAttribute('aria-label'))legacyBack.setAttribute('aria-label','Back to Settings');
  }
  /* The VNext form language this slice establishes: a persistent label above
     the control, the current value legible without opening anything, a
     segment with a real selected state, and explanatory copy only where it
     earns its place. The hidden input keeps the stored shape identical — the
     saved record is still {text,motion} written by saveAppearance(). */
  function setField(id,label,help,options,current) {
    const opts=options.map(([v,t])=>`<button type="button" class="vn-seg-opt${v===current?' is-on':''}" data-value="${esc(v)}" aria-pressed="${v===current?'true':'false'}" onclick="NXP.pickOption('${esc(id)}',this)">${esc(t)}</button>`).join('');
    return `<div class="vn-set-field"><span class="vn-set-label" id="${esc(id)}-label">${esc(label)}</span>`
      +`<input type="hidden" id="${esc(id)}" value="${esc(current)}">`
      +`<div class="vn-seg" role="group" aria-labelledby="${esc(id)}-label">${opts}</div>`
      +`${help?`<p class="vn-set-help">${esc(help)}</p>`:''}</div>`;
  }
  function pickOption(id,btn) {
    const input=document.getElementById(id);if(!input||!btn)return;
    input.value=btn.dataset.value||'';
    const group=btn.parentElement;if(!group)return;
    [...group.children].forEach(b=>{
      const on=b===btn;
      b.classList.toggle('is-on',on);
      b.setAttribute('aria-pressed',on?'true':'false');
    });
  }
  function appearanceView() {
    const p=pref();
    document.getElementById('morePage').innerHTML=shell(`${settingsHead('Appearance')}
      <form class="vn-set-form" onsubmit="event.preventDefault();NXP.saveAppearance()">
        ${setField('nxp-text','Text size','Applies to every screen, not just this one.',[['normal','Standard'],['large','Larger']],p.text==='large'?'large':'normal')}
        ${setField('nxp-motion','Motion','Reduce motion removes page and set-logging animation. Your device setting is followed by default.',[['system','Follow device'],['reduced','Reduce motion']],p.motion==='reduced'?'reduced':'system')}
        <button type="submit" class="vn-set-act">Save appearance</button>
      </form>
      `,'vn-settings');
  }
  function saveAppearance() {N.cfg().appearance={text:val('nxp-text')==='large'?'large':'normal',motion:val('nxp-motion')==='reduced'?'reduced':'system'};applyAppearance();N.commit('Appearance saved');}
  /* Associates the persistent labels the legacy cloud/backup forms already
     print with the inputs they describe. Adds `for`/`id` only — no control,
     no id and no value is changed, so every reader of sbUrl / sbKey / sbEmail
     / sbPass keeps working exactly as before. */
  function linkFieldLabels(root) {
    if(!root)return;
    root.querySelectorAll('label.label').forEach((label,i)=>{
      if(label.getAttribute('for'))return;
      let field=label.nextElementSibling;
      if(!field||!['INPUT','SELECT','TEXTAREA'].includes(field.tagName))field=label.parentElement?.querySelector('input,select,textarea');
      if(!field||field.type==='hidden')return;
      if(!field.id)field.id='nxp-field-'+i+'-'+Math.random().toString(36).slice(2,7);
      label.setAttribute('for',field.id);
    });
  }
  /* D30: scan photos are no longer stored. This removes the ones already saved;
     the readings (weight, body fat, muscle, etc.) are kept. */
  function scanPhotoStats(){
    const withImg=(state.scans||[]).filter(x=>x&&typeof x.image==='string'&&x.image.length>0);
    return {count:withImg.length,bytes:withImg.reduce((a,x)=>a+x.image.length,0)};
  }
  function removeScanPhotos(){
    const st=scanPhotoStats();
    if(!st.count)return toast('No scan photos are saved.');
    const mb=(st.bytes/1048576).toFixed(1);
    if(!confirm('Remove '+st.count+(st.count===1?' saved scan photo':' saved scan photos')+' ('+mb+' MB)?\n\nYour scan readings stay. The photos are deleted from this phone and from your online copy, and cannot be brought back. Export a backup first if you want to keep them.'))return;
    const now=Date.now();
    state.scans=state.scans.map(x=>(x&&typeof x.image==='string'&&x.image.length)?{...x,image:'',ts:now}:x);
    const ok=N.commit('Scan photos removed · '+mb+' MB freed');
    /* Replace the old recovery copy, which still holds the photos. */
    try{N.snapshot('After removing scan photos',{quiet:true});}catch(e){}
    if(ok)more();
  }
  function dataView() {
    const settingsHTML=cloudCardHTML().replace(/>Online</g,'>Signed in<').replace(/>Connected</g,'>Signed in<').replace('Supabase Anon Public Key','Supabase publishable / anon key').replace('id="sbKey" class="input"','id="sbKey" type="password" autocomplete="off" class="input"');
    const cloud=cloudSignal();
    const page=document.getElementById('morePage');
    page.innerHTML=shell(`${settingsHead('Data & sync','Your records stay yours.')}
      <section class="vn-set-block">
        <h2 class="vn-set-grp">Cloud</h2>
        <p class="vn-set-state"><span class="vn-set-flag is-${cloud.tone||'calm'}"><i aria-hidden="true"></i>${esc(cloud.word)}</span><span>${esc(cloudLabel())}</span></p>
        <div id="nxp-connection-result" aria-live="polite">${connectionHTML()}</div>
        <button type="button" id="nxp-connection-test" class="vn-set-act is-quiet" onclick="NXP.testConnection()">Test connection</button>
        <p class="vn-set-note">Checks your project, sign-in and whether your backup row is visible. It does not upload, load or replace workout data. Write access is not tested.</p>
        <details class="vn-set-disc nxp-advanced"><summary>Account &amp; connection settings</summary>${settingsHTML}</details>
      </section>
      <section class="vn-set-block">
        <h2 class="vn-set-grp">Backup &amp; restore</h2>
        <p class="vn-set-body">Export workouts, weigh-ins, settings and check-ins stored in this browser. Wearable evidence in the on-device wearable store is not included; wearable sync is switched off, so the app holds none.</p>
        <p class="vn-set-note">Export last requested: ${esc(backupLabel())}. Check your Downloads to confirm the file was saved.</p>
        <div class="vn-set-actions"><button type="button" class="vn-set-act" onclick="exportJSON()">Export app backup</button><button type="button" class="vn-set-act is-quiet" onclick="exportCSV()">Export workout CSV</button></div>
        <details class="vn-set-disc nxp-advanced"><summary>Restore a backup</summary>${backupRestoreHTML()}</details>
        <details class="vn-set-disc nxp-advanced"><summary>Local safety copy</summary><p class="vn-set-body">Recovery copy made before a restore, cloud load or reset. It is not an independent backup.</p><div class="vn-set-actions"><button type="button" class="vn-set-act is-quiet" onclick="NXT.exportSafety()">Download safety copy</button><button type="button" class="vn-set-act is-quiet" onclick="NXT.restoreSafety()">Restore safety copy</button></div></details>
      </section>
      ${(()=>{const st=scanPhotoStats();return st.count?`<section class="vn-set-block"><h2 class="vn-set-grp">Scan photos</h2><p class="vn-set-body">${st.count} saved ${st.count===1?'photo is':'photos are'} using ${(st.bytes/1048576).toFixed(1)} MB, most of your storage. Your scan readings are kept in the body views, so the photos are not needed.</p><div class="vn-set-actions"><button type="button" class="vn-set-act" onclick="NXP.removeScanPhotos()">Remove scan photos</button></div></section>`:'';})()}
      <section class="vn-set-block">
        <h2 class="vn-set-grp">Advanced</h2>
        <details class="vn-set-disc nxp-advanced"><summary>Advanced cloud setup</summary>${supabaseSQLHelpHTML()}</details>
      </section>`,'vn-settings');
    linkFieldLabels(page);
  }
  function exportBackup() {try{base.exportJSON();N.cfg().backupExportRequestedAt=Date.now();persist();toast('Backup download requested — check Downloads');}catch(e){toast('Could not prepare the backup. Try again before changing devices.');}}
  function connectionHTML() {const c=ui.connection;return `<div class="nxp-connection ${c.tone||''}"><b>${esc(c.busy?'Checking connection…':c.summary)}</b>${c.lines.length?`<ul>${c.lines.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${c.checkedAt?`<small>Checked ${new Date(c.checkedAt).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'})} · this browser only</small>`:''}</div>`;}
  function paintConnection() {
    const box=document.getElementById('nxp-connection-result');if(box)box.innerHTML=connectionHTML();
    /* The button sits outside #nxp-connection-result, so repainting the box alone
       left the control looking idle for the whole request. data-loading drives the
       spinner that already existed in premium-ui.css but had no caller; disabled
       stops a second request landing mid-flight, and aria-busy says the same thing
       to assistive tech. testConnection()'s finally{} clears ui.connection.busy and
       repaints, so both the success and failure paths reset this. */
    const btn=document.getElementById('nxp-connection-test');
    if(btn){
      const busy=!!ui.connection.busy;
      if(busy)btn.setAttribute('data-loading','true');else btn.removeAttribute('data-loading');
      btn.disabled=busy;
      btn.setAttribute('aria-busy',busy?'true':'false');
    }
  }
  async function bounded(promise) {let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),12000);})]);}finally{clearTimeout(timer);}}
  function validConfig(url,key) {
    let parsed;try{parsed=new URL(url);}catch{return 'Enter a valid Supabase project URL in Account & connection settings.';}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||!['','/'].includes(parsed.pathname)||parsed.search||parsed.hash)return 'Use the HTTPS project origin, without a path, password or query.';
    if(key.startsWith('sb_secret_'))return 'Never put a Supabase secret key in this app. Use a publishable or anon key.';
    if(key.startsWith('sb_publishable_'))return '';
    try{const part=key.split('.')[1];const claim=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));if(claim.role==='anon')return '';}catch{}
    return 'Use the project’s publishable or anon public key, not a service-role key or user token.';
  }
  async function testConnection() {
    if(ui.connection.busy)return;
    if(typeof awaitCloudLibrary==='function'&&!window.supabase){
      ui.connection={busy:true,lines:[],summary:'Loading the cloud library',tone:''};paintConnection();
      const lib=await awaitCloudLibrary({show:false});
      ui.connection.busy=false;
      if(lib!==true){
        ui.connection={busy:false,lines:[],summary:lib===false?'Cloud library unavailable. Check your connection and try again.':'The cloud library is still loading. Try again shortly.',tone:'watch',checkedAt:Date.now()};
        paintConnection();return;
      }
    }
    const savedUrl=(localStorage.getItem('apm_sb_url')||'').trim().replace(/\/$/,''),savedKey=(localStorage.getItem('apm_sb_key')||'').trim();
    const url=(document.getElementById('sbUrl')?.value??savedUrl).trim().replace(/\/$/,''),key=(document.getElementById('sbKey')?.value??savedKey).trim();
    ui.connection={busy:true,lines:[],summary:'Checking',tone:''};paintConnection();
    const c=ui.connection;let controller;
    try {
      if(!url||!key)throw Error('Add your project URL and public key under Account & connection settings first.');
      const invalid=validConfig(url,key);if(invalid)throw Error(invalid);
      if(!window.supabase?.createClient)throw Error('The Supabase library did not load. Check your connection and reopen the app.');
      c.lines.push('Supabase library loaded');paintConnection();
      controller=new AbortController();
      const request=async(path,token)=>{
        const response=await bounded(fetch(url+path,{method:'GET',headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{})},signal:controller.signal,cache:'no-store'}));
        if(!response.ok)throw Error(response.status===401||response.status===403?'The project rejected the key, session or read permissions. Check settings and sign in again.':'The project returned HTTP '+response.status+'. Check its status and configuration.');
        return bounded(response.json());
      };
      try{await request('/auth/v1/settings');}
      catch(e){
        if(e.message!=='timeout')throw e;
        c.lines.push('Slow to answer · trying once more');paintConnection();
        await request('/auth/v1/settings');
      }
      c.lines.push('Project reachable · public key accepted');paintConnection();
      if(url!==savedUrl||key!==savedKey){c.summary='Project reachable; entered settings are not saved';c.lines.push('Use the account controls to connect before checking a personal backup.');return;}
      const client=initSupabaseClient();
      const sessionResult=await bounded(client.auth.getSession());
      if(sessionResult.error)throw Error('Your saved session could not be read. Sign in again.');
      const token=sessionResult.data?.session?.access_token;
      if(!token){c.summary='Project reachable · sign-in required';c.lines.push('Personal backup access was not tested.');return;}
      const user=await request('/auth/v1/user',token);
      if(!user?.id)throw Error('The auth server did not return a valid signed-in user.');
      c.lines.push('Account verified by the auth server');paintConnection();
      const rows=await request('/rest/v1/apexcut_profiles?select=user_id&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',token);
      if(!Array.isArray(rows))throw Error('Unexpected database response. Check the table configuration.');
      c.summary=rows.some(r=>r.user_id===user.id)?'Connection works · your backup row is visible':'Connection works · no backup row visible';
      c.tone=rows.length?'good':'';
      c.lines.push(rows.length?'Own backup row can be queried. No workout contents were fetched.':'The query succeeded, but a backup may not exist or a row policy may hide it.');
      c.lines.push('No records written or restored. Save permissions remain untested.');
    }catch(e){c.tone='watch';c.summary=e.message==='timeout'?'No reply in time. Your connection may be slow; try again, ideally on wifi.':e instanceof TypeError?'Could not reach the project. Check your network, project status or browser restrictions.':e.message||'Connection check failed';}
    finally{controller?.abort();c.busy=false;c.checkedAt=Date.now();paintConnection();}
  }
  function dateRows(date) {return (state.logs||[]).filter(r=>r&&r.date===date);}
  const HISTORY_TABS=[['all','All'],['strength','Lifting'],['conditioning','Cardio'],['body','Weight']];
  const historyNum=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?String(Math.round(n*100)/100):null;};
  const historyPlural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
  function historyScope(filter) {
    return {lift:filter==='all'||filter==='strength',cond:filter==='all'||filter==='conditioning',body:filter==='all'||filter==='body'};
  }
  function historyRecords(date) {
    const logs=logsForDate(date).slice().sort((a,b)=>(Number(a.ts||0)-Number(b.ts||0))||(Number(a.setNum||0)-Number(b.setNum||0)));
    /* Morning is canonical (D7): when a day has a morning reading it leads, whatever was weighed later. */
    const all=(state.bws||[]).filter(b=>b&&b.date===date&&historyNum(b.weight)).sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));
    const morning=all.filter(b=>/^morning$/i.test(String(b.timeOfDay||''))).at(-1)||null;
    const bw=morning||bwForDate(date);
    return {logs,cardio:cardioForDate(date),floorball:(state.floorball||[]).filter(r=>r&&r.date===date),bw:bw&&historyNum(bw.weight)?bw:null,bwOthers:all.filter(b=>b!==bw)};
  }
  function historyMarks(date,scope) {
    const r=historyRecords(date);
    /* Four kinds, four shapes — floorball is never folded into cardio. */
    return {
      lift:scope.lift&&r.logs.length>0,
      cardio:scope.cond&&r.cardio.length>0,
      floorball:false,/* floorball is no longer drawn on the calendar; the records stay in the day detail */
      body:scope.body&&!!r.bw
    };
  }
  function historyMonthDates(month,scope) {
    const seen=new Set(),add=arr=>(arr||[]).forEach(r=>{const d=r&&r.date;if(typeof d==='string'&&d.startsWith(month)&&Number.isFinite(N.dateMs(d)))seen.add(d);});
    if(scope.lift)add(state.logs);
    if(scope.cond){add(state.cardio);}
    if(scope.body)add(state.bws);
    return [...seen].sort();
  }
  function historyMonthSummary(month,filter,scope) {
    const days=historyMonthDates(month,scope).length;
    if(!days)return filter==='strength'?'No lifting logged this month':filter==='conditioning'?'No cardio logged this month':filter==='body'?'No weigh-ins this month':'No records this month';
    if(filter==='strength')return historyPlural(days,'lifting day');
    if(filter==='conditioning')return historyPlural(days,'cardio day');
    if(filter==='body')return historyPlural(days,'weigh-in');
    return historyPlural(days,'active day');
  }
  function historySelectedDate(month,scope) {
    const current=state.historyDate;
    if(typeof current==='string'&&current.startsWith(month)&&Number.isFinite(N.dateMs(current)))return current;
    const today=localToday();
    if(today.startsWith(month))return today;
    const dates=historyMonthDates(month,scope);
    return dates.length?dates[dates.length-1]:`${month}-01`;
  }
  function historyMarkHTML(marks) {
    return `${marks.lift?'<i class="lift"></i>':''}${marks.cardio?'<i class="cond"></i>':''}${marks.floorball?'<i class="floor"></i>':''}${marks.body?'<i class="body"></i>':''}`;
  }
  function historyFiltersHTML(filter) {
    return `<div class="nxp-history-filters vn-hist-filters" id="vn-hist-filters" role="group" aria-label="Activity type">${HISTORY_TABS.map(([k,t])=>`<button type="button" aria-pressed="${filter===k?'true':'false'}" class="${filter===k?'active':''}" onclick="NXP.setHistoryFilter('${k}')">${t}</button>`).join('')}</div>`;
  }
  function historyCalendar(month,scope,selected) {
    const [year,monthNum]=month.split('-').map(Number);
    const first=new Date(year,monthNum-1,1,12,0,0);
    /* ≤359px: long "September 2026" + 44pt nav controls wrap the title. Short month stays one line. */
    const narrow=typeof matchMedia==='function'&&matchMedia('(max-width:480px)').matches;
    const monthName=first.toLocaleDateString('en-SG',{month:narrow?'short':'long'}),yearNum=String(year),title=monthName+' '+yearNum;
    const firstDow=(first.getDay()+6)%7,days=new Date(year,monthNum,0).getDate(),prevDays=new Date(year,monthNum-1,0).getDate();
    const total=Math.ceil((firstDow+days)/7)*7,today=localToday(),cells=[],counts={lift:0,cardio:0,floor:0,body:0};
    /* Ascension — one status read for the whole grid (NXT.coach.dayStatuses), once per paint. */
    const gridStart=N.dateAdd(`${month}-01`,-firstDow),cxMap=coachDayMap(gridStart,N.dateAdd(gridStart,total-1)),cc={plan:0,missed:0,excused:0,moved:0},ccLetters=[];
    /* D84 · The calendar shows the numbers: the morning reading under Weight, working sets under Lifting,
       minutes under Cardio. The same stored values the day card lists; All keeps the marks. */
    const vf=state.historyFilter||'all',vMap=new Map();
    if(vf==='body')N.timingRows('Morning').forEach(r=>{if(r&&typeof r.date==='string'&&Number(r.weight)>0)vMap.set(r.date,Number(r.weight));});
    else if(vf==='strength')(state.logs||[]).forEach(r=>{if(r&&r.setType!=='warmup'&&typeof r.date==='string')vMap.set(r.date,(vMap.get(r.date)||0)+1);});
    else if(vf==='conditioning')(state.cardio||[]).forEach(r=>{const m=Number(r&&(r.duration||r.minutes));if(r&&typeof r.date==='string'&&m>0)vMap.set(r.date,(vMap.get(r.date)||0)+m);});
    const vText=v=>vf==='body'?v.toFixed(1):vf==='conditioning'?Math.round(v)+'′':String(v);
    const vAria=v=>vf==='body'?`, morning ${v.toFixed(1)} kilograms`:vf==='conditioning'?`, ${Math.round(v)} minutes of cardio`:`, ${v} working ${v===1?'set':'sets'}`;
    for(let i=0;i<total;i++){
      const offset=i-firstDow+1;
      let y=year,m=monthNum,d=offset,outside=false;
      if(offset<1){m=monthNum-1;if(m<1){m=12;y--;}d=prevDays+offset;outside=true;}
      else if(offset>days){m=monthNum+1;if(m>12){m=1;y++;}d=offset-days;outside=true;}
      const key=dateKeyFromParts(y,m,d),marks=historyMarks(key,scope),cls=['nxp-cal-day'];
      if(outside)cls.push('is-outside');
      if(key===today)cls.push('is-today');
      if(key>today)cls.push('is-future');
      if(key===selected)cls.push('is-selected');
      if(marks.lift)cls.push('has-lift');
      if(marks.cardio)cls.push('has-cardio');
      if(marks.floorball)cls.push('has-floor');
      const kinds=[marks.lift?'lifting':'',marks.cardio?'cardio':'',marks.floorball?'floorball':'',marks.body?'weigh-in':''].filter(Boolean);
      const kind=marks.lift?'lift':marks.cardio?'cardio':marks.floorball?'floor':marks.body?'w':'none';
      const second=marks.lift?(marks.cardio?'cardio':marks.floorball?'floor':''):(marks.cardio&&marks.floorball?'floor':'');
      if(!outside){if(marks.lift)counts.lift++;if(marks.cardio)counts.cardio++;if(marks.floorball)counts.floor++;if(marks.body)counts.body++;}
      const cm=coCalMark(cxMap&&cxMap.get(key),scope);
      if(cm){cls.push('has-cs');if(!outside){cc[cm.k]++;if(cm.k==='plan'&&!ccLetters.includes(cm.letter)&&ccLetters.length<3)ccLetters.push(cm.letter);}}
      const cv=!outside&&vMap.has(key)?vMap.get(key):null;if(cv!==null)cls.push('has-v');
      const label=new Date(`${key}T12:00:00`).toLocaleDateString('en-SG',{day:'numeric',month:'long'})+(kinds.length?`, ${kinds.join(', ')}`:', no records')+(cv!==null?vAria(cv):'')+(cm?`, ${cm.aria}`:'');
      cells.push(`<button type="button" class="${cls.join(' ')}" data-date="${key}" data-k="${kind}"${second?` data-k2="${second}"`:''}${cm?` data-cs="${cm.k}"`:''} style="--i:${i}" tabindex="${key===selected?'0':'-1'}" aria-label="${esc(label)}" aria-pressed="${key===selected?'true':'false'}"${key===today?' aria-current="date"':''} onclick="NXP.historySelect('${key}')"><b${d===1?' class="is-m1"':''}>${d===1?d+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]:d}</b><span class="nxp-cal-marks" aria-hidden="true">${historyMarkHTML(marks)}${coCalMarkHTML(cm)}</span>${cv!==null?`<span class="nxp-cal-v" aria-hidden="true">${esc(vText(cv))}</span>`:''}</button>`);
    }
    /* Ascension — legend entries for the status marks, only for those this month actually has. */
    const coLg=[['plan','Planned'],['missed','Not logged'],['excused','Excused'],['moved','Moved']].filter(([k])=>cc[k]).map(([k,w])=>`<span class="co-lg is-${k}">${k==='plan'?`<em aria-hidden="true">${esc(ccLetters.slice().sort().join(' '))}</em>`:coMark(k,'co-cm')}${w}<b>${cc[k]}</b></span>`).join('');
    return `<section class="nxp-history-calendar vn-hist-calendar" id="vn-hist-calendar"><div class="nxp-cal-head" id="vn-hist-calhead"><h2 class="nxp-cal-month" aria-label="${esc(title)}"><span>${esc(monthName)}</span> <em>${yearNum}</em></h2><div class="nxp-cal-nav"><button type="button" aria-label="Previous month" onclick="NXP.historyShiftMonth(-1)">‹</button><button type="button" class="nxp-cal-today" aria-label="Jump to current month" onclick="NXP.historyThisMonth()">Today</button><button type="button" aria-label="Next month" onclick="NXP.historyShiftMonth(1)">›</button></div></div><div class="nxp-cal-weekdays" aria-hidden="true">${['M','T','W','T','F','S','S'].map(x=>`<span>${x}</span>`).join('')}</div><div class="nxp-cal-grid" id="vn-hist-grid" role="group" aria-label="${esc(title)}" onkeydown="NXP.historyKey(event)">${cells.join('')}</div><p class="nxp-cal-legend st-cal-stats" aria-label="This month">${scope.lift?`<span class="lift${counts.lift?'':' is-zero'}"><i></i>Lifting<b>${counts.lift}</b></span>`:''}${scope.cond?`<span class="cond${counts.cardio?'':' is-zero'}"><i></i>Cardio<b>${counts.cardio}</b></span>`:''}${scope.body?`<span class="body${counts.body?'':' is-zero'}"><i></i>Weigh-in<b>${counts.body}</b></span>`:''}${coLg}</p></section>`;
  }
  function historyLiftingBlock(date,logs) {
    const order=[],groups=new Map();
    logs.forEach(r=>{const key=r.exercise||'Exercise';if(!groups.has(key)){groups.set(key,[]);order.push(key);}groups.get(key).push(r);});
    const types=[...new Set(logs.map(r=>dayTypeLabel(r.dayType)).filter(Boolean))],gyms=[...new Set(logs.map(r=>r.gym).filter(Boolean))];
    const identity=[types.join(' + '),gyms.join(' · ')].filter(Boolean).join(' · ');
    const rows=order.map(name=>{
      const sets=groups.get(name);
      const lines=sets.map(r=>{
        const load=historyNum(r.weight),reps=historyNum(r.reps);
        if(load&&reps)return `${reps} × ${load} kg`;
        if(reps)return `${reps} reps`;
        return load?`${load} kg`:null;
      }).filter(Boolean);
      return `<div class="nxp-history-ex"><b>${esc(name)}</b><span>${esc(historyPlural(sets.length,'set'))}</span></div>${lines.length?`<div class="nxp-history-sets">${lines.map(l=>`<span>${esc(l)}</span>`).join('')}</div>`:''}`;
    }).join('');
    return `<div class="nxp-history-block vn-hist-block" data-kind="lifting"><span class="nxp-history-block-label">Lifting</span>${identity?`<p class="nxp-history-block-title">${esc(identity)}</p>`:''}${rows}<button type="button" class="nxp-history-edit" onclick="NXP.historyDay('${date}')">Edit sets<i aria-hidden="true">›</i></button></div>`;
  }
  function historyConditioningBlock(cardio,floorball) {
    const rows=[];
    cardio.forEach(r=>{
      const mins=historyNum(r.duration||r.minutes),hr=historyNum(r.hr),effort=historyNum(r.intensity),incline=historyNum(r.incline),speed=historyNum(r.speed);
      rows.push({name:r.type||'Cardio',value:mins?`${mins} min`:'',meta:[hr?`HR ${hr}`:'',effort?`Intensity ${effort}`:'',incline?`Incline ${incline}`:'',speed?`Speed ${speed}`:'',r.gym||''].filter(Boolean),kind:'cardio'});
    });
    floorball.forEach(r=>{
      const mins=historyNum(r.duration),effort=historyNum(r.intensity);
      rows.push({name:'Floorball',value:mins?`${mins} min`:'',meta:[effort?`Intensity ${effort}`:'',r.notes?String(r.notes):''].filter(Boolean),kind:'floorball'});
    });
    return `<div class="nxp-history-block vn-hist-block" data-kind="conditioning"><span class="nxp-history-block-label">Conditioning</span>${rows.map(r=>`<div class="nxp-history-ex" data-kind="${r.kind}"><b>${esc(r.name)}</b>${r.value?`<span>${esc(r.value)}</span>`:''}</div>${r.meta.length?`<p class="nxp-history-meta">${esc(r.meta.join(' · '))}</p>`:''}`).join('')}</div>`;
  }
  /* D50 — a morning weigh-in in History shows where it sat: the change from the previous
     morning and the engine's trend value that day. Contextual readings (post-workout,
     scan) show only their own value, as before (D14). */
  function historyWeightBlock(bw,others) {
    let ctx='';
    if(/^morning$/i.test(String(bw.timeOfDay||''))){
      const mornings=N.timingRows('Morning').filter(r=>r.date<bw.date);
      const prev=mornings.at(-1),pt=N.trend(N.weights()).find(p=>p.date===bw.date);
      const w=Number(bw.weight),bits=[];
      if(prev){const d=w-Number(prev.weight),ago=Math.round((N.dateMs(bw.date)-N.dateMs(prev.date))/864e5);bits.push(`<span class="st-hw-c ${d<-0.04?'is-dn':d>0.04?'is-up':''}"><i aria-hidden="true">${d<-0.04?'↓':d>0.04?'↑':'→'}</i>${Math.abs(d).toFixed(1)} kg<small> vs ${ago===1?'yesterday':N.shortDate(prev.date)}</small></span>`);}
      if(pt&&pt.avg!==null){const g=w-pt.avg;bits.push(`<span class="st-hw-t">Trend <b class="vn-num">${pt.avg.toFixed(2)}</b><small> · ${Math.abs(g)<0.05?'on trend':Math.abs(g).toFixed(1)+' kg '+(g<0?'below':'above')}</small></span>`);}
      if(bits.length)ctx=`<p class="st-hw">${bits.join('')}</p>`;
    }
    const more=(others||[]).map(o=>`<p class="st-hw-o"><b class="vn-num">${esc(historyNum(o.weight))} kg</b><span>${esc(o.timeOfDay||'Weigh-in')}</span></p>`).join('');
    return `<div class="nxp-history-block vn-hist-block" data-kind="weight"><span class="nxp-history-block-label">Weight</span><div class="nxp-history-ex"><b>${esc(historyNum(bw.weight))} kg</b>${bw.timeOfDay?`<span>${esc(bw.timeOfDay)}</span>`:''}</div>${ctx}${more}</div>`;
  }
  /* Structural homes for future State Engine record kinds — layout only, no persistence. */
  function historyAuditLanes() {
    return `<div class="vn-hist-audit" aria-label="Day audit trail">
      <section class="vn-hist-lane" data-lane="event" hidden></section>
      <section class="vn-hist-lane" data-lane="intervention" hidden></section>
      <section class="vn-hist-lane" data-lane="annotation" hidden></section>
    </div>`;
  }
  function historyDayView(date,filter,scope) {
    const r=historyRecords(date),when=new Date(`${date}T12:00:00`),blocks=[],parts=[];
    if(scope.lift&&r.logs.length)blocks.push(historyLiftingBlock(date,r.logs));
    if(scope.cond&&(r.cardio.length||r.floorball.length))blocks.push(historyConditioningBlock(r.cardio,r.floorball));
    if(scope.body&&r.bw)blocks.push(historyWeightBlock(r.bw,r.bwOthers));
    if(scope.lift&&r.logs.length){
      parts.push(historyPlural(r.logs.length,'set'));
      const exercises=new Set(r.logs.map(x=>x.exercise).filter(Boolean)).size;
      if(exercises)parts.push(historyPlural(exercises,'exercise'));
    }
    if(scope.cond){
      // Durations only sum within one activity; a walk and a match are not 145 min of anything.
      const activities=[...r.cardio,...r.floorball];
      if(activities.length>1)parts.push(`${activities.length} activities`);
      else if(activities.length){
        const mins=historyNum(activities[0].duration||activities[0].minutes);
        if(mins)parts.push(`${mins} min`);
      }
    }
    if(scope.body&&r.bw)parts.push(`weighed ${historyNum(r.bw.weight)} kg`);
    /* A weigh-in-only day: the weight block below already says it, so the
       summary line would just repeat "82 kg". */
    if(parts.length===1&&scope.body&&r.bw&&!(scope.lift&&r.logs.length)&&!(scope.cond&&(r.cardio.length||r.floorball.length)))parts.length=0;
    const emptyCopy=filter==='strength'?'No lifting logged on this date.':filter==='conditioning'?'No cardio logged on this date.':filter==='body'?'No weigh-in recorded on this date.':'No training or measurements logged.';
    return `<section class="nxp-history-selected vn-hist-day"><header class="nxp-history-selected-head"><h2 class="st-dayhead" aria-label="${esc(when.toLocaleDateString('en-SG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}"><span class="st-dayhead-n" aria-hidden="true">${when.getDate()}</span><span class="st-dayhead-t" aria-hidden="true"><b>${esc(when.toLocaleDateString('en-SG',{weekday:'long'}))}</b><em>${esc(when.toLocaleDateString('en-SG',{month:'long'}))} ${esc(String(when.getFullYear()))}</em></span></h2>${coachDayLine(date,scope)}${parts.length?`<p class="nxp-history-selected-summary">${esc(parts.join(' · '))}</p>`:''}${(()=>{const k=[scope.lift&&r.logs.length?'<span class="lift"><i></i>Lifting</span>':'',scope.cond&&r.cardio.length?'<span class="cond"><i></i>Cardio</span>':'',scope.cond&&r.floorball.length?'<span class="floor"><i></i>Floorball</span>':'',scope.body&&r.bw?'<span class="body"><i></i>Weigh-in</span>':''].join('');return k?`<p class="st-day-k" aria-hidden="true">${k}</p>`:'';})()}</header>${scope.lift&&r.logs.length?sessionPrintSVG(r.logs,date+'|'+(r.logs[0].gym||'Gym A'),{cls:'is-day'}):''}${blocks.length?blocks.join(''):`<p class="nxp-history-empty">${esc(emptyCopy)}</p>`}${historyAuditLanes()}</section>`;
  }
  function historyPaintDay(date) {
    const host=document.getElementById('vn-hist-dayhost');
    if(!host)return false;
    const filter=state.historyFilter||'all',scope=historyScope(filter);
    host.innerHTML=historyDayView(date,filter,scope);
    host.classList.remove('vn-enter');
    void host.offsetWidth;
    host.classList.add('vn-enter');
    /* The day card renders below the grid; bring it up when a tap would leave it under the dock. */
    const r=host.getBoundingClientRect(),dock=document.querySelector('.tabs'),dh=dock?dock.getBoundingClientRect().height:0;
    if(r.top>innerHeight-dh-60){const rm=matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;window.scrollBy({top:r.top-(innerHeight*.35),behavior:rm?'auto':'smooth'});}
    return true;
  }
  function historyMoveSelection(from,to) {
    const root=document.getElementById('vn-hist-calendar')||document.getElementById('historyPage');
    if(!root)return;
    if(from&&from!==to){
      const prev=root.querySelector(`.nxp-cal-day[data-date="${from}"]`);
      if(prev){prev.classList.remove('is-selected');prev.setAttribute('aria-pressed','false');}
    }
    const next=root.querySelector(`.nxp-cal-day[data-date="${to}"]`);
    if(next){next.classList.add('is-selected');next.setAttribute('aria-pressed','true');next.setAttribute('tabindex','0');}
    if(from&&from!==to){const prev=root.querySelector(`.nxp-cal-day[data-date="${from}"]`);if(prev)prev.setAttribute('tabindex','-1');}
  }
  function history() {
    applyAppearance();
    syncTrainNav(false);
    const month=calendarMonthState(),filter=state.historyFilter||'all',scope=historyScope(filter),selected=historySelectedDate(month,scope);
    state.historyDate=selected;
    document.getElementById('historyPage').innerHTML=`<div class="n99 nxp nxp-history vn-history"><header class="nxp-heading nxp-history-chrome vn-hist-chrome" id="vn-hist-chrome"><div><h1>History</h1><p id="vn-hist-summary">${esc(historyMonthSummary(month,filter,scope))}</p></div><button type="button" class="st-sky-b" onclick="STRATA.observatory()" aria-label="Open your sky: every session as a star"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z"/><circle cx="15.5" cy="14.5" r="1.2"/><circle cx="4.5" cy="15.5" r=".9"/></svg>Your sky</button></header>${historyFiltersHTML(filter)}<div id="vn-hist-calhost">${historyCalendar(month,scope,selected)}</div><div id="vn-hist-dayhost" class="vn-hist-dayhost">${historyDayView(selected,filter,scope)}</div></div>`;
  }
  function setHistoryFilter(filter) {
    state.historyFilter=filter;
    ui.historyRows=[];
    history();
  }
  function historySelect(date) {
    if(!Number.isFinite(N.dateMs(date)))return;
    const prev=state.historyDate;
    state.historyDate=date;
    const month=date.slice(0,7);
    if(month!==calendarMonthState()){
      state.historyMonth=month;
      history();
      return;
    }
    /* Same month: move selection on cells and refresh the day region only.
       Calendar, header and filters stay in the DOM — no full-page rebuild. */
    const page=document.getElementById('historyPage');
    if(!page||!page.querySelector('#vn-hist-calendar')||!page.querySelector('#vn-hist-dayhost')){
      history();
      return;
    }
    historyMoveSelection(prev,date);
    historyPaintDay(date);
  }
  /* Keyboard on the calendar: a roving tabindex (the selected day is the one
     tab stop) and arrow keys that move the selection a day or a week, PageUp
     and PageDown a month, Home and End to the week's ends. Each move goes
     through historySelect, the same path a tap takes, and focus follows the
     selected cell — including after a month repaint. The days are toggle buttons in
     one labelled group: role="grid" would need row and gridcell owners, and the
     layout (cells as direct children of the grid) has none. */
  function historyKey(event) {
    const KEYS={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    const cur=state.historyDate||localToday();
    let next=null;
    if(KEYS[event.key]!==undefined)next=N.dateAdd(cur,KEYS[event.key]);
    else if(event.key==='Home')next=N.weekStart(cur);
    else if(event.key==='End')next=N.dateAdd(N.weekStart(cur),6);
    else if(event.key==='PageUp'||event.key==='PageDown'){
      const [y,m]=cur.split('-').map(Number),d=new Date(y,m-1+(event.key==='PageUp'?-1:1),1,12,0,0);
      const days=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
      next=dateKeyFromParts(d.getFullYear(),d.getMonth()+1,Math.min(Number(cur.slice(8,10)),days));
    }
    if(!next||!Number.isFinite(N.dateMs(next)))return;
    event.preventDefault();
    historySelect(next);
    const cell=document.querySelector(`#historyPage .nxp-cal-day[data-date="${next}"]`);
    if(cell){
      document.querySelectorAll('#historyPage .nxp-cal-day[tabindex="0"]').forEach(el=>{if(el!==cell)el.setAttribute('tabindex','-1');});
      cell.setAttribute('tabindex','0');
      cell.focus({preventScroll:true});
    }
  }
  function historyShiftMonth(delta) {
    const [y,m]=calendarMonthState().split('-').map(Number),d=new Date(y,m-1+delta,1,12,0,0);
    state.historyMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    history();
    const g=document.getElementById('vn-hist-grid');
    if(g)g.classList.add(delta>0?'st-slide-n':'st-slide-p');
  }
  function historyThisMonth() {
    const today=localToday(),month=today.slice(0,7);
    const prev=state.historyDate;
    state.historyDate=today;
    if(month!==calendarMonthState()){
      state.historyMonth=month;
      history();
      return;
    }
    state.historyMonth=month;
    const page=document.getElementById('historyPage');
    if(page&&page.querySelector('#vn-hist-calendar')&&page.querySelector('#vn-hist-dayhost')){
      historyMoveSelection(prev,today);
      historyPaintDay(today);
      return;
    }
    history();
  }
  function historyDay(date) {
    if(!Number.isFinite(N.dateMs(date)))return;
    ui.historyRows=dateRows(date);const working=ui.historyRows.filter(r=>r.setType!=='warmup');
    const stamps=ui.historyRows.map(r=>Number(r.ts)).filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b),span=stamps.length>1?Math.round((stamps.at(-1)-stamps[0])/60000):null;
    N.modal(N.shortDate(date),`<div class="nxp-history-day"><div class="n99-stats">${N.metric('Working sets',working.length)}${N.metric('Exercises',new Set(working.map(r=>r.exercise)).size)}</div>${span!==null&&span>=0?`<p class="n99-small">Logging span: ${span} min · first to last recorded set, not measured workout duration.</p>`:''}${ui.historyRows.map((r,i)=>`<button type="button" class="nxp-history-set" onclick="NXP.editHistorySet(${i})"><span><b>${esc(r.exercise||'Exercise')}</b><small>${esc(r.gym||'Gym A')} · ${r.setType==='warmup'?'Warm-up':'Set '+esc(r.setNum)}</small></span><b>${esc(r.weight)} × ${esc(r.reps)}</b><span>Edit ›</span></button>`).join('')}${button('All day details & activities',`NXP.otherDayDetails('${date}')`,true)}</div>`);
  }
  function editHistorySet(i) {const r=ui.historyRows[i];if(r)openEditSet(r.id);}
  function otherDayDetails(date) {base.historyDay(date);}
  function sessionSummary() {historyDay(state.date);}
  /* ---- Stepper input ------------------------------------------------------
     Weight and reps are the two controls used most, usually one-handed and
     often mid-set. The steppers write straight into the same inputs the engine
     reads, so nothing re-renders on a tap: the value changes, the draft is
     stored, and the layout does not move.

     Press-and-hold repeats, but only after a deliberate 420ms hold and only
     while the finger stays put — a vertical drag that starts on a stepper is a
     scroll, so it cancels the repeat and never changes the number. A plain tap
     is always exactly one increment, and keyboard activation (click with no
     pointer) takes the same single-increment path. */
  const HOLD_DELAY=420,HOLD_EVERY=110,HOLD_SLOP=10;
  const hold={timer:null,repeat:null,btn:null,x:0,y:0};
  function stepValue(btn) {
    const input=document.getElementById(btn.dataset.stepTarget);
    if(!input||input.disabled)return false;
    const step=Number(btn.dataset.step);
    if(!Number.isFinite(step)||!step)return false;
    const min=input.min===''?-Infinity:Number(input.min);
    const max=input.max===''?Infinity:Number(input.max);
    const raw=input.value===''?Number(input.placeholder):Number(input.value);
    const base=Number.isFinite(raw)?raw:0;
    let next=Math.round((base+step)*1000)/1000;
    if(next<min)next=min;
    if(next>max)next=max;
    if(next===base&&input.value!=='')return false;
    input.value=String(next);
    rememberInput(input);
    /* A script write raises no input event; this lets strata's numeral fit follow every step of a hold. */
    input.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  }
  function holdEnd() {
    clearTimeout(hold.timer);clearInterval(hold.repeat);
    hold.timer=hold.repeat=null;
    if(hold.btn)hold.btn.classList.remove('is-held');
    hold.btn=null;
  }
  function holdStart(event) {
    const btn=event.target.closest?.('.nxp-step');
    if(!btn||btn.disabled)return;
    if(event.pointerType==='mouse'&&event.button!==0)return;
    holdEnd();
    stepValue(btn);
    hold.btn=btn;hold.x=event.clientX;hold.y=event.clientY;
    hold.timer=setTimeout(()=>{
      btn.classList.add('is-held');
      hold.repeat=setInterval(()=>{if(!stepValue(btn))holdEnd();},HOLD_EVERY);
    },HOLD_DELAY);
  }
  function holdMove(event) {
    if(!hold.btn)return;
    if(Math.abs(event.clientX-hold.x)>HOLD_SLOP||Math.abs(event.clientY-hold.y)>HOLD_SLOP)holdEnd();
  }
  /* Distance from the layout bottom to the top of the keyboard, plus a gap.
     A real keyboard (visual viewport shorter than the layout viewport by more
     than a browser chrome) covers the home indicator, so the safe area and a
     visible nav are not added again. With no keyboard, clear both. */
  function keyboardBottom(layoutHeight, viewHeight, viewOffset, safeBottom, navClear) {
    const layout=Number(layoutHeight)||0;
    const view=Number(viewHeight)||0;
    const offset=Number(viewOffset)||0;
    const overlap=Math.max(0, layout-view-offset);
    const gap=8;
    if(overlap>40)return overlap+gap;
    const safe=Math.max(0, Number(safeBottom)||0);
    const nav=Math.max(0, Number(navClear)||0);
    return Math.max(gap, safe)+nav;
  }
  function kbField(el) {return !!(el&&(el.id==='weightInput'||el.id==='repsInput'));}
  function keyboardOverlap() {
    const vv=window.visualViewport;
    if(!vv||!window.innerHeight)return 0;
    return Math.max(0, window.innerHeight-vv.height-(vv.offsetTop||0));
  }
  function safeBottomPx() {
    if(!document.body||typeof document.createElement!=='function')return 0;
    const probe=document.createElement('div');
    if(!probe||!probe.style)return 0;
    probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;height:env(safe-area-inset-bottom,0px);';
    document.body.appendChild(probe);
    const h=probe.offsetHeight||0;
    probe.remove();
    return h;
  }
  function navClearance() {
    const tabs=document.querySelector('.tabs');
    if(!tabs||tabs.classList.contains('vn-recede'))return 0;
    if(typeof tabs.getBoundingClientRect!=='function')return 0;
    const r=tabs.getBoundingClientRect();
    const vv=window.visualViewport;
    const viewH=vv&&vv.height?vv.height:(window.innerHeight||0);
    if(!r||r.top>=viewH-1)return 0;
    return Math.max(0, viewH-r.top);
  }
  function fieldCovered(btn) {
    const overlap=keyboardOverlap();
    if(!btn||typeof btn.getBoundingClientRect!=='function')return overlap>40;
    const rect=btn.getBoundingClientRect();
    if(!rect)return overlap>40;
    const vv=window.visualViewport;
    const viewH=vv&&vv.height?vv.height:(window.innerHeight||0);
    return rect.bottom>viewH-8||rect.top<8;
  }
  function scrollByY(dy) {
    if(!dy)return;
    const scroller=document.scrollingElement||document.documentElement;
    if(scroller&&typeof scroller.scrollTop==='number')scroller.scrollTop+=dy;
    else if(typeof window.scrollBy==='function')window.scrollBy(0, dy);
  }
  function undockLog() {
    const btn=document.getElementById('nxp-log-button');
    const form=document.getElementById('nxp-set-form');
    if(btn){
      btn.classList.remove('is-kb');
      if(btn.style){
        btn.style.removeProperty('left');
        btn.style.removeProperty('width');
        btn.style.removeProperty('right');
        btn.style.removeProperty('--nxp-kb-bottom');
      }
    }
    if(form)form.classList.remove('is-kb');
  }
  function placeDock(btn, form) {
    const vv=window.visualViewport;
    const bottom=keyboardBottom(
      window.innerHeight||0,
      vv?vv.height:(window.innerHeight||0),
      vv?(vv.offsetTop||0):0,
      safeBottomPx(),
      navClearance()
    );
    if(btn.style)btn.style.setProperty('--nxp-kb-bottom', bottom+'px');
    if(!form||typeof form.getBoundingClientRect!=='function'||!btn.style)return;
    const r=form.getBoundingClientRect();
    if(!r||!r.width)return;
    const origin=vv?(vv.offsetLeft||0):0;
    btn.style.setProperty('left', (r.left+origin)+'px');
    btn.style.setProperty('width', r.width+'px');
    btn.style.setProperty('right', 'auto');
  }
  function keepFieldClear(btn) {
    const active=document.activeElement;
    if(!kbField(active)||typeof active.getBoundingClientRect!=='function')return;
    if(typeof btn.getBoundingClientRect!=='function')return;
    const br=btn.getBoundingClientRect();
    const ir=active.getBoundingClientRect();
    if(!br||!ir)return;
    if(ir.bottom>br.top-8)scrollByY(ir.bottom-(br.top-8));
    const again=active.getBoundingClientRect();
    if(again&&again.top<8)scrollByY(again.top-8);
  }
  function keepRestClear(btn) {
    const rest=document.querySelector('#trainPage .vn-rest.is-active');
    if(!rest||rest.hidden||typeof rest.getBoundingClientRect!=='function')return;
    if(typeof btn.getBoundingClientRect!=='function')return;
    const br=btn.getBoundingClientRect();
    const rr=rest.getBoundingClientRect();
    if(!br||!rr)return;
    const hit=rr.bottom>br.top+1&&rr.top<br.bottom-1&&rr.right>br.left&&rr.left<br.right;
    if(!hit)return;
    const active=document.activeElement;
    const ir=kbField(active)&&typeof active.getBoundingClientRect==='function'?active.getBoundingClientRect():null;
    const shift=rr.bottom-br.top+8;
    const room=ir?Math.max(0, ir.top-8):shift;
    scrollByY(Math.min(shift, room));
  }
  let kbTimer=0, kbPointer=false, docking=false;
  function syncDock() {
    if(docking)return;
    docking=true;
    try{
      const btn=document.getElementById('nxp-log-button');
      const active=document.activeElement;
      if(!btn||!kbField(active)){
        if(!kbPointer)undockLog();
        return;
      }
      const form=document.getElementById('nxp-set-form');
      if(!btn.classList.contains('is-kb')&&!fieldCovered(btn)&&keyboardOverlap()<=40)return;
      btn.classList.add('is-kb');
      if(form)form.classList.add('is-kb');
      placeDock(btn, form);
      keepFieldClear(btn);
      keepRestClear(btn);
      placeDock(btn, form);
    }finally{
      docking=false;
    }
  }
  function scheduleUndock() {
    clearTimeout(kbTimer);
    kbTimer=setTimeout(function(){
      if(kbPointer){scheduleUndock();return;}
      if(kbField(document.activeElement))return;
      undockLog();
    }, 320);
  }
  function bindKeyboardDock() {
    document.addEventListener('focusin', function(e){
      if(!kbField(e.target))return;
      clearTimeout(kbTimer);
      syncDock();
    }, true);
    document.addEventListener('focusout', function(e){
      if(!kbField(e.target))return;
      scheduleUndock();
    }, true);
    /* A tap on Log Set blurs the field before click. Keeping focus until the
       click lands means the dock does not jump out from under the finger, and
       the submit still reads the same inputs. */
    document.addEventListener('mousedown', function(e){
      const btn=e.target&&e.target.closest&&e.target.closest('#nxp-log-button');
      if(btn&&btn.classList.contains('is-kb'))e.preventDefault();
    }, true);
    document.addEventListener('pointerdown', function(e){
      const btn=e.target&&e.target.closest&&e.target.closest('#nxp-log-button');
      if(btn&&btn.classList.contains('is-kb'))kbPointer=true;
    }, true);
    document.addEventListener('pointerup', function(){
      setTimeout(function(){kbPointer=false;}, 400);
    }, true);
    document.addEventListener('pointercancel', function(){kbPointer=false;}, true);
    const vv=window.visualViewport;
    if(vv&&typeof vv.addEventListener==='function'){
      vv.addEventListener('resize', syncDock);
      vv.addEventListener('scroll', syncDock);
    }
    if(typeof window.addEventListener==='function')window.addEventListener('resize', syncDock);
  }
  function bindSteppers() {
    /* Delegated once. The Train screen replaces its own markup on every engine
       repaint, so per-element listeners would leak on each logged set. */
    document.addEventListener('pointerdown',holdStart);
    document.addEventListener('pointermove',holdMove,{passive:true});
    ['pointerup','pointercancel','pointerleave','blur'].forEach(name=>document.addEventListener(name,holdEnd,true));
    /* A long press can raise the context menu on some touch browsers. It is suppressed on a
       stepper, so the hold keeps repeating until the finger lifts (strata.js used to do this). */
    document.addEventListener('contextmenu',event=>{if(event.target.closest?.('.nxp-step'))event.preventDefault();},true);
    document.addEventListener('click',event=>{
      /* detail === 0 is a keyboard-activated button; pointer taps already
         stepped on pointerdown and must not step twice. */
      if(event.detail!==0)return;
      const btn=event.target.closest?.('.nxp-step');
      if(btn&&!btn.disabled)stepValue(btn);
    });
  }
  /* ---- Rest timer paint ---------------------------------------------------
     The engine owns the countdown; this only reflects it, so the timer can
     update every second without touching the rest of the screen. */
  function noteRestTotal(seconds) {ui.restTotal=Math.max(10,Number(seconds)||90);}
  function paintRest() {
    const rest=document.querySelector('.nxp-rest');
    if(!rest)return;
    const left=apx96RestRemaining();
    /* Rest orb (D74): the last ten seconds pulse; a rest that runs out (not one that is skipped) glows
       "Go" for a moment before the strip folds away. Presentation of the engine's own countdown. */
    rest.classList.toggle('is-final',left>0&&left<=10);
    const ranOut=!left&&ui.restLast>0&&ui.restLast<=2;
    ui.restLast=left;
    if(ranOut&&rest.classList.contains('st-orbcard')){
      rest.removeAttribute('hidden');rest.classList.remove('is-active');rest.classList.add('is-go');
      const value=document.getElementById('apx96TimerValue');if(value)value.textContent='Go';
      clearTimeout(ui.restGo);ui.restGo=setTimeout(()=>{const r=document.querySelector('.nxp-rest');if(r){r.classList.remove('is-go');if(!apx96RestRemaining())r.setAttribute('hidden','');const v=document.getElementById('apx96TimerValue');if(v&&!apx96RestRemaining())v.textContent='Ready';}},2600);
      return;
    }
    if(rest.classList.contains('is-go')&&!left)return;
    if(left)rest.classList.remove('is-go');
    rest.classList.toggle('is-active',left>0);
    if(rest.hasAttribute('hidden')){
      if(left>0)rest.removeAttribute('hidden');
    }else if(!left){
      /* Keep the node for timer writes, but hide the strip when idle so it
         does not consume fold space during the set. */
      rest.setAttribute('hidden','');
    }
    rest.style.setProperty('--pct',String(left&&ui.restTotal?Math.max(0,Math.min(100,left/ui.restTotal*100)):0));
    const fill=rest.querySelector('.nxp-rest-rail > span');
    if(fill)fill.style.width=(left&&ui.restTotal?Math.max(0,Math.min(100,left/ui.restTotal*100)):0)+'%';
    /* The engine writes a shouted "READY" into the value. At rest-timer size
       that is the loudest thing on a screen where nothing is happening, so the
       idle state is set back to a quiet word here. */
    const value=document.getElementById('apx96TimerValue');
    if(value&&!left&&value.textContent!=='Ready')value.textContent='Ready';
  }
  bindSteppers();
  bindKeyboardDock();
  return {shareProgress,shareToggle,shareSend,ask,finishScene,actRange,actSelect,actScrub,actKey,historyKey,removeScanPhotos,nameSheet,saveName,ui,useAim,useTarget,trainMenu,setRoutineGym,pickDay,setDay,editRoutine,routineBack,routineMove,routineBoth,routineDefault,routineEdit,routineStep,routineRemove,routinePick,routineFilter,routineChoose,routineSave,saveTodayToRoutine,home,training,progress,more,history,enterTrain,leaveTrain,syncTrainNav,addOnAdd,addOnRemove,addOnPick,addOnFilter,addOnSelect,rememberInput,logSet,queue,queueMove,exerciseDetails,paintRest,noteRestTotal,setSetType,setRir,goExercise,chooseExercise,editCurrentSet,sessionMenu,equipmentNote,sessionSummary,saveAppearance,pickOption,applyAppearance,exportBackup,cloudLabel,backupLabel,connectionHTML,validConfig,testConnection,historyDay,editHistorySet,otherDayDetails,historySelect,setHistoryFilter,historyShiftMonth,historyThisMonth,openRecovery,setRecoveryPreview,openWearableConnection,openBodyCapture,keyboardBottom,coachAct,coachDismiss,catchUpSheet,catchUpApply,excuseSheet,reviewSheet,reviewSeen};
})();
(function hookProgressSelect(){
  const orig=NXT.selectPoint;
  NXT.selectPoint=function(index){
    orig(index);
    /* 2C metric header uses .vn-metric-v > em; keep that shape if present. */
    const el=document.getElementById('n99-chart-weight');
    const p=NXT.ui.chart?.points?.[index];
    if(el&&p){
      if(el.querySelector('em'))el.innerHTML=`${p.weight.toFixed(1)}<em>kg</em>`;
      else el.innerHTML=`${p.weight.toFixed(1)}<small> kg</small>`;
    }
    const btn=document.getElementById('nxp-progress-latest');
    if(!btn)return;
    const pts=NXT.ui.chart?.points||[];
    const last=pts.at(-1);
    btn.hidden=!(last&&p&&p.date!==last.date);
  };
})();
renderHome=NXP.home;renderTrain=NXP.training;renderWeight=NXP.progress;renderMore=NXP.more;renderHistory=NXP.history;
/* D77: finishing a workout opens the full-screen finish moment (the sheet's facts, staged). */
NXT.openFinishSummary=NXP.finishScene;
showHistoryDay=NXP.historyDay;exportJSON=NXP.exportBackup;
NXP.applyAppearance();
document.title='NXTFRM — Training & Progress';
if(typeof apx96TickTimer==='function'){
  const apx96TickTimerSource=apx96TickTimer;
  apx96TickTimer=function(){
    const result=apx96TickTimerSource.apply(this,arguments);
    NXP.paintRest();
    return result;
  };
}
/* The engine decides how long the rest is; the premium timer needs the total
   as well as the remaining seconds so it can draw how much is left. */
if(typeof apx96StartRest==='function'){
  const apx96StartRestSource=apx96StartRest;
  apx96StartRest=function(seconds){
    NXP.noteRestTotal(seconds);
    return apx96StartRestSource.apply(this,arguments);
  };
}
/* Removing the last add-on stops the rest timer under this name. The engine's stop is
   apx96SkipRest: it clears the deadline and the interval, then ticks, and the tick wrapper
   above repaints the strip. */
function apx96StopRest(){return apx96SkipRest();}
/* Mode entry: Today CTA and legacy startWorkoutNow both enter focused Train. */
if(typeof startWorkoutNow==='function'){
  const startWorkoutNowSource=startWorkoutNow;
  startWorkoutNow=function(){
    NXP.enterTrain();
    return;
  };
  void startWorkoutNowSource;
}
if(typeof NXT.resume==='function'){
  const resumeSource=NXT.resume;
  NXT.resume=function(){
    const result=resumeSource.apply(this,arguments);
    NXP.ui.trainActive=true;
    return result;
  };
}
/* Mode-scoped banner suppression (D6). D11 conditions stay in updateCloudLocalBanner;
   render() re-runs that function after every paint, so re-apply the gate here. */
if(typeof updateCloudLocalBanner==='function'){
  const updateCloudLocalBannerSource=updateCloudLocalBanner;
  updateCloudLocalBanner=function(){
    if(document.querySelector('.tabs.vn-recede')){
      const el=document.getElementById('cloudLocalBanner');
      if(el)el.setAttribute('hidden','');
      return;
    }
    return updateCloudLocalBannerSource.apply(this,arguments);
  };
}
if(document.readyState!=='loading')NXT.repaint();
