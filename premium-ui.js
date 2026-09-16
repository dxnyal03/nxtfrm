/* V100 presentation layer. Uses the existing workout, chart and backup engines. */
"use strict";
const NXP = (() => {
  const N=NXT;
  const base={home:N.home,training:N.training,more:N.moreView,historyDay:showHistoryDay,exportJSON,logSet:N.logSet};
  const ui={drafts:new Map(),historyRows:[],restTotal:0,confirmFrom:null,confirmTimer:null,lastExercise:null,lastIndex:-1,addOnFlash:null,connection:{busy:false,lines:[],summary:'Not tested on this device'}};
  const button=N.button;
  const formatNumber=n=>Number(n).toLocaleString('en-SG');
  function header(title,sub='',action='') {return `<header class="nxp-heading nxp-more-chrome"><div><h1>${esc(title)}</h1>${sub?`<p>${esc(sub)}</p>`:''}</div>${action}</header>`;}
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
  function home() {
    applyAppearance();
    const list=template(),logs=N.sessionLogs(),lift=!['Rest','Zone2','Floorball'].includes(state.dayType),finished=N.planDone();
    const s=N.trendStats(),last=N.weights().at(-1),r=N.review(),cal=N.finite(N.cfg().calories);
    const action=lift?"startWorkoutNow()":state.dayType==='Zone2'?"showCardioSheet()":state.dayType==='Floorball'?"startWorkoutNow()":"apx96OpenReadiness()";
    const title=finished?'Review workout':lift?(logs.length?'Resume workout':'Start workout'):state.dayType==='Zone2'?'Log cardio':state.dayType==='Floorball'?'Open session':'Recovery check-in';
    const context=lift?`${list.length} exercises · ${list.reduce((a,e)=>a+Number(e.sets),0)} working sets`:state.dayType==='Rest'?'A planned day to recharge.':state.dayType==='Zone2'?'An easy, conversational effort.':'Your activity and recovery, together.';
    const weekly=s.change===null?'Building':N.signed(s.change,2)+' kg';
    const link=(label,fn)=>`<button type="button" class="n99-text" onclick="${esc(fn)}">${label}</button>`;
    const dayMs=N.dateMs(state.date);
    const dayLabel=Number.isFinite(dayMs)?new Date(dayMs).toLocaleDateString('en-SG',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'}):N.shortDate(state.date);
    const rec=N.cfg().recovery[state.date];
    const recLogged=!!(rec&&[rec.sleep,rec.energy,rec.soreness].some(v=>v!==''&&v!==undefined&&v!==null));
    const recEnergy=rec?N.finite(rec.energy):null,recSore=rec?N.finite(rec.soreness):null;
    const recLabel=!recLogged?'Not logged':(recEnergy!==null&&recEnergy<=2)||(recSore!==null&&recSore>=4)?'Review':recEnergy!==null&&recEnergy>=4?'Good':'Okay';
    void recLabel;
    const cardioMins=N.cardioWeek(),cardioTarget=Number(settings.zone2WeeklyTarget)||90;
    const lifts=N.strengthItems();
    const liftReview=lifts.filter(x=>x.status==='Review').length;
    const perfLabel=!lifts.length?'Building':liftReview>=2?'Review':lifts.some(x=>x.status==='Improving')?'Improving':lifts.some(x=>x.status==='Holding steady')?'Holding':lifts.some(x=>x.status==='Watch')?'Watch':'Building';
    let weightNote=s.change===null?'Needs two weeks of readings':'Compared with prior 7 days';
    if(s.change!==null&&N.cfg().targetConfirmed&&s.current.avg!==null){
      const lo=goalLow(),hi=goalHigh();
      if(s.current.avg>=lo&&s.current.avg<=hi)weightNote='In goal range';
    }
    const work=N.workRows();
    const lastLift=[...new Set(work.map(row=>row.date))].sort().at(-1);
    const lastLiftRow=lastLift?work.find(row=>row.date===lastLift):null;
    const lastLiftLine=lastLiftRow?(lastLift===state.date?(finished?'Logged today':'In progress today'):`${N.label(lastLiftRow.dayType||'Workout')} · ${N.shortDate(lastLift)}`):'';
    N.logSuggestion({kind:"review",subject:null,payload:{title:r.title,action:r.action,tone:r.tone,reason:r.reason}});
    document.getElementById('homePage').innerHTML=`<div class="n99 nxp nxp-home">
      <header class="nxp-heading nxp-home-chrome"><div><h1>Today</h1><p>${esc(dayLabel)}</p></div>${button(esc(state.gym),'cycleGym()',true)}</header>
      <button type="button" class="nxp-home-decision ${esc(r.tone)}" onclick="NXT.openReview()"><span class="nxp-caption">NXTFRM Decision</span><b>${esc(r.title)}</b>${r.message?`<p>${esc(r.message)}</p>`:r.reason?`<p>${esc(r.reason)}</p>`:''}<span class="nxp-home-review">View evidence →</span></button>
      <section class="nxp-home-card nxp-home-today"><div class="n99-row"><span class="nxp-caption">${finished?'Workout saved':'Today’s training'}</span>${link('Change','showSessionSheet()')}</div><h2>${esc(N.label(state.dayType))}</h2><p>${esc(context)}</p><button type="button" class="n99-button nxp-home-cta" onclick="${esc(finished?"switchTab('train')":action)}">${esc(title)}</button>${lastLiftLine?`<p class="nxp-home-last"><span class="nxp-caption">Last lift</span><span>${esc(lastLiftLine)}</span></p>`:''}</section>
      <section class="nxp-home-card nxp-home-weight"><span class="nxp-caption">Bodyweight</span><strong>${last?esc(last.weight.toFixed(1))+' <em>kg</em>':'—'}</strong><p>${esc(weekly)}${s.change===null?'':' / week'}</p><small>${esc(weightNote)}</small>${link('View progress ›',"switchTab('weight')")}</section>
      ${recoveryHomeCard()}
      <div class="nxp-home-signals" role="group" aria-label="Cardio and performance">${linkSignal('Cardio',cardioMins+' / '+cardioTarget+' min','showCardioSheet()')}${linkSignal('Performance',perfLabel,"NXT.ui.view='strength';switchTab('weight')")}</div>
      <button type="button" class="nxp-home-kcal" onclick="NXT.openCalories()"><span><small>Calorie guide</small><strong>${cal?formatNumber(cal)+' <em>kcal</em>':'Set target'}</strong></span><span>${cal?'Edit':'Set up'}</span></button>
      ${N.adherenceHTML()}
      <nav class="nxp-home-secondary" aria-label="Quick actions">${link('+ Weight','apx95OpenQuickWeight()')}${state.dayType==='Zone2'?'':link('Log cardio','showCardioSheet()')}${state.dayType==='Rest'?'':link('Check-in','apx96OpenReadiness()')}</nav>
      <details class="nxp-home-week nxp-disclosure" open><summary><span>Your week</span><small>${N.completedWeek()} lifting days logged</small></summary>${N.weekHTML()}<div class="nxp-card-foot"><span>${cardioMins} / ${cardioTarget} cardio min</span>${link('Edit plan ›',"NXT.more('training')")}</div></details>
    </div>`;
  }
  function linkSignal(label,value,action) {return `<button type="button" class="nxp-home-signal" onclick="${esc(action)}"><small>${esc(label)}</small><strong>${esc(value)}</strong></button>`;}
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
    if(!training||training.state==='no_recovery_signal')return '';
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
  function trainChrome() {return `<header class="nxp-train-chrome"><div><h1>${esc(N.label(state.dayType))}</h1><p>${esc(state.gym||'Gym')} · ${N.shortDate(state.date)}</p></div>${button('Change','showSessionSheet()',true)}</header>`;}
  function trainIdle(kind,body) {document.getElementById('trainPage').innerHTML=`<div class="n99 nxp nxp-train nxp-train-idle ${kind}">${trainChrome()}${trainGuidanceHTML()}${body}</div>`;}
  function idleSecondary(label,action) {return `<button type="button" class="n99-text" onclick="${esc(action)}">${label}</button>`;}
  function cardioWeekLine() {
    const mins=N.cardioWeek(),target=Number(settings.zone2WeeklyTarget)||90;
    return {mins,target,pct:target?Math.min(100,mins/target*100):0};
  }
  function trainRest() {
    const w=cardioWeekLine();
    trainIdle('nxp-train-rest',`<section class="nxp-train-idle-copy"><h2>No lifting session due</h2><p>Recovery is part of the plan. Nothing needs to be made up today.</p></section><p class="nxp-caption nxp-train-idle-metric">${w.mins} / ${w.target} cardio min this week</p><div class="nxp-train-idle-actions">${button('Quick recovery check-in','apx96OpenReadiness()')}${idleSecondary('Log cardio','showCardioSheet()')}</div>${addOnSection()}`);
  }
  function trainZone2() {
    const w=cardioWeekLine();
    trainIdle('nxp-train-zone2',`<section class="nxp-train-idle-copy"><p>Zone 2 — a conversational effort. No lifting session is due.</p></section><div class="nxp-train-pace"><span class="nxp-caption">This week</span><strong>${w.mins} <em>/ ${w.target} min</em></strong><div class="n99-session-rail" aria-hidden="true"><span style="width:${w.pct}%"></span></div></div><div class="nxp-train-idle-actions">${button('Log cardio','showCardioSheet()')}${idleSecondary('Check-in','apx96OpenReadiness()')}</div>${addOnSection()}`);
  }
  function trainFloorball() {
    const recent=(state.floorball||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,3);
    trainIdle('nxp-train-floorball',`<section class="nxp-train-idle-copy"><p>Hard conditioning day. Log duration and effort.</p></section><section class="nxp-train-floorball-log"><div class="nxp-train-floorball-grid"><label>Duration <small>min</small><input id="apx96FbDuration" type="number" min="1" max="600" inputmode="numeric"></label><label>Intensity <small>1–10</small><input id="apx96FbIntensity" type="number" min="1" max="10" inputmode="numeric"></label></div><label class="nxp-train-floorball-notes">Notes<textarea id="apx96FbNotes" rows="2" placeholder="Energy, match load, soreness…"></textarea></label><div class="nxp-train-idle-actions">${button('Save session','apx96SaveFloorball()')}</div></section>${recent.length?`<section class="nxp-train-floorball-history"><h2 class="nxp-caption">Recent</h2>${recent.map(x=>`<div class="nxp-train-recent"><span>${esc(N.shortDate(x.date))}</span><b>${esc(x.duration||'—')} min · RPE ${esc(x.intensity||'—')}</b>${x.notes?`<small>${esc(x.notes)}</small>`:''}</div>`).join('')}</section>`:`<p class="nxp-caption nxp-train-idle-metric">No Floorball sessions logged yet.</p>`}`);
  }
  /* An add-on eligible day can reach here too (a Cardio day carries no lifting
     template), and this is the one Train branch that would otherwise offer no
     way back to the optional block. addOnSection() returns nothing on days that
     are not eligible, so a strength day with an emptied plan is unchanged. */
  function trainEmpty() {
    trainIdle('nxp-train-empty',`<section class="nxp-train-idle-copy"><h2>No exercises in this session</h2><p>This session currently has no exercises.</p></section><div class="nxp-train-idle-actions">${button('Add exercise','v88OpenAddModal()')}${idleSecondary('Restore programme','NXT.fullSession()')}</div>${addOnSection()}`);
  }
  /* ---- Train: shared presentation helpers --------------------------------
     Numbers are rendered, never re-derived: every figure below comes from the
     workout engine (targetFor / done / sessionRows / cue). Nothing here invents
     metadata, so an exercise with no history simply shows fewer lines. */
  function trimNum(n) {const v=Math.round(Number(n)*1000)/1000;return Number.isFinite(v)?String(v):'';}
  function loadLine(weight,reps) {return `${esc(trimNum(weight))}<em>kg</em> × ${esc(reps)}`;}
  /* One label + one figure. No border, no fill: the comparison is carried by
     type weight and colour, so three of these read as one line of instruments
     rather than three competing cards. */
  function aimCell(label,value,sub,action) {
    const top=`<span class="nxp-aim-top"><span class="nxp-caption">${esc(label)}</span>${action?'<i aria-hidden="true">›</i>':''}</span>`;
    const inner=`${top}<b>${value}</b>${sub?`<small>${sub}</small>`:''}`;
    return action
      ? `<button type="button" class="nxp-aim-cell is-tappable" onclick="${esc(action)}">${inner}</button>`
      : `<div class="nxp-aim-cell">${inner}</div>`;
  }
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
  function training() {
    applyAppearance();
    if(state.dayType==='Floorball')return trainFloorball();
    /* A non-strength day keeps its own screen unless the user has explicitly
       added an optional exercise AND is currently on it. Falling through then
       reuses the normal logging controls — it does not change what the day is.
       dayType is resolved from settings.dayOverrides / weeklyPlan and is never
       written here or anywhere downstream of an add-on. */
    if((state.dayType==='Rest'||state.dayType==='Zone2')&&!addOnActive()){
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
    const ex=state.exercise,t=N.targetFor(ex),done=N.done(ex),cue=N.cue(ex),draft=ui.drafts.get(draftKey())||{};
    const previous=N.sessionRows(ex,state.gym,state.date,100).at(-1),prev=previous?.sets[Math.min(done,previous.sets.length-1)];
    const current=N.sessionLogs().filter(r=>r.exercise===ex),last=current.filter(r=>r.setType!=='warmup').at(-1);
    const total=list.reduce((a,e)=>a+Number(e.sets),0),count=list.reduce((a,e)=>a+Math.min(N.done(e.name),e.sets),0),finished=N.planDone();
    const weight=draft.weightInput??last?.weight??(cue.weight||'');
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

    if(finished){
      page.innerHTML=`<div class="n99 nxp nxp-train nxp-train-lift is-finished">
        ${trainChrome()}
        <section class="nxp-train-done">${N.card('Workout saved',`<p>${N.sessionLogs().filter(r=>r.setType!=='warmup').length} working sets recorded. Everything you logged is in History.</p><div class="n99-stack">${button('View session','NXP.sessionSummary()')}${button('Resume workout','NXT.resume()',true)}</div>`)}</section>
        <button type="button" class="nxp-queue-open" onclick="NXP.queue()"><span>Workout queue</span><small>${list.length} exercises</small><i aria-hidden="true">›</i></button>
      </div>`;
      return;
    }

    /* Every region below sits in normal document flow and is separated by the
       spacing scale. Nothing is positioned by coordinate, so no control can
       drift over another one at any width. The order is thumb-ordered too:
       load, effort and Log Set sit together, with rest and Next immediately
       under them and the growing set list pushed below all of it. */
    page.innerHTML=`<div class="n99 nxp nxp-train nxp-train-lift${justLogged?' is-just-logged':''}">
      <header class="nxp-train-chrome">
        <div><h1>Train</h1><p>${esc(N.label(state.dayType))} · ${esc(state.gym)}</p></div>
        ${button('Session','NXP.sessionMenu()',true)}
      </header>

      ${trainAlertHTML()}

      <div class="nxp-ex-rail">
        <ol aria-hidden="true">${list.map((e,i)=>{
          const complete=N.done(e.name)>=Number(e.sets);
          return `<li class="${i===index?'is-current':complete?'is-done':''}"></li>`;
        }).join('')}</ol>
        <p>
          <button type="button" class="nxp-rail-jump" onclick="NXP.queue()">Exercise ${index+1} of ${list.length}<i aria-hidden="true">›</i></button>
          <span>${count} of ${total} sets</span>
        </p>
        ${sessionFocus(list)}
      </div>

      <section class="nxp-ex-head">
        <span class="nxp-ex-bar" aria-hidden="true"></span>
        <div class="nxp-ex-main">
          <div class="nxp-ex-top${exMove}">
            <div class="nxp-ex-text">
              <h2><button type="button" class="nxp-ex-title" onclick="NXP.exerciseDetails()">${esc(ex)}</button></h2>
              <p class="nxp-ex-muscles">${esc(muscleLine(ex)) || '&nbsp;'}</p>
              <p class="nxp-ex-meta">${t.sets} sets · ${t.reps[0]}–${t.reps[1]} reps${note?' · '+esc(note):''}</p>
            </div>
            ${anatomyStrip(ex)}
          </div>
          <div class="nxp-ex-actions">
            <button type="button" class="nxp-ex-chip" onclick="NXP.exerciseDetails()">Exercise details<i aria-hidden="true">›</i></button>
            <button type="button" class="nxp-ex-chip" onclick="showSubstituteSheet()">Swap</button>
          </div>
        </div>
      </section>

      <div class="nxp-aim">
        ${aimCell('Last',prev?loadLine(prev.weight,prev.reps):'—',previous?esc(N.shortDate(previous.date)):'First session',previous?'NXP.exerciseDetails()':'')}
        ${aimCell('Target',`${t.reps[0]}–${t.reps[1]}`,'reps','')}
        ${aimCell('Rest',esc(apx96FormatTimer(restPlan)),'planned','')}
      </div>

      <details class="nxp-coach nxp-disclosure"><summary>${esc(cue.label)}</summary><p>${esc(cue.text)}</p></details>

      <div class="nxp-set-dots" aria-label="${done} working sets logged, ${t.sets} planned">${Array.from({length:t.sets},(_,i)=>`<span class="${i<done?'done'+(justLogged&&loggedEntry&&loggedEntry.setType!=='warmup'&&loggedEntry.exercise===ex&&i===done-1?' is-new':''):i===done?'next':''}">${i<done?'✓':i+1}</span>`).join('')}<small>Set ${Math.min(done+1,t.sets)} of ${t.sets}</small></div>

      <form id="nxp-set-form" onsubmit="event.preventDefault();NXP.logSet()">
        <div class="nxp-steppers">
          ${stepper('weightInput','Weight','kg',`<input id="weightInput" type="number" min="0" max="1000" step="0.1" inputmode="decimal" enterkeyhint="done" autocomplete="off" required placeholder="0" value="${esc(weight)}" aria-labelledby="weightInput-label" oninput="NXP.rememberInput(this)">`,trimNum(t.inc||2.5),`weight by ${trimNum(t.inc||2.5)} kilograms`)}
          ${stepper('repsInput','Reps','',`<input id="repsInput" type="number" min="1" max="100" step="1" inputmode="numeric" enterkeyhint="done" autocomplete="off" required placeholder="${prev?prev.reps:t.reps[0]}" value="${esc(draft.repsInput??'')}" aria-labelledby="repsInput-label" oninput="NXP.rememberInput(this)">`,'1','reps by one')}
        </div>

        <input type="hidden" id="n99-set-type" value="${setType}">
        <input type="hidden" id="n99-rir" value="${esc(rir)}">

        <div class="nxp-seg-row">
          <fieldset class="nxp-seg-block nxp-seg-type">
            <legend>Set type</legend>
            <div class="nxp-seg" role="group">${[['working','Working'],['warmup','Warm-up']].map(([v,l])=>`<button type="button" class="${setType===v?'is-on':''}" aria-pressed="${setType===v}" onclick="NXP.setSetType('${v}')">${l}</button>`).join('')}</div>
          </fieldset>
          <fieldset class="nxp-seg-block nxp-seg-rir">
            <legend>Reps left <small>optional</small></legend>
            <div class="nxp-seg" role="group">${[['','—'],['0','0'],['1','1'],['2','2'],['3','3'],['4','4+']].map(([v,l])=>`<button type="button" class="${rir===v?'is-on':''}" aria-pressed="${rir===v}" aria-label="${v===''?'Not recorded':v==='4'?'4 or more reps left':v+' reps left'}" onclick="NXP.setRir('${v}')">${l}</button>`).join('')}</div>
          </fieldset>
        </div>

        <button id="nxp-log-button" type="submit" class="n99-button nxp-train-cta" data-idle-label="${esc(idleLabel)}">${justLogged?`<span class="nxp-cta-check" aria-hidden="true">✓</span>${esc(confirmLabel)}`:esc(idleLabel)}</button>
      </form>

      <aside class="nxp-rest${restLeft?' is-active':''}" aria-label="Rest timer">
        <div class="nxp-rest-row">
          <span><small>Rest</small><b id="apx96TimerValue">${restLeft?apx96FormatTimer(restLeft):'Ready'}</b></span>
          <div>${button('+30s','apx96AdjustRest(30)',true)}${button('Skip','apx96SkipRest()',true)}</div>
        </div>
        ${restRail(restLeft,ui.restTotal||restPlan)}
      </aside>

      <nav class="nxp-ex-nav" aria-label="Exercise navigation">
        <button type="button" ${index<=0?'disabled':''} onclick="NXP.goExercise(-1)" aria-label="Previous exercise"><span aria-hidden="true">←</span>Prev</button>
        <button type="button" class="nxp-ex-nav-pos" onclick="NXP.queue()" aria-label="Open workout queue">${index+1} / ${list.length}</button>
        <button type="button" ${lastMove?'disabled':''} onclick="NXP.goExercise(1)" aria-label="Next exercise">Next<span aria-hidden="true">→</span></button>
      </nav>

      ${current.length?`<section class="nxp-set-history"><h3>Today’s sets</h3>${current.map((r,i)=>{const latest=i===current.length-1;const rirLabel=r.rir===null||r.rir===undefined||r.rir===''?'':Number(r.rir)===4?'4+ left':r.rir+' left';const meta=r.setType==='warmup'?'Warm-up':rirLabel;return `<button type="button" class="nxp-set-row${latest?' is-latest':''}" onclick="NXP.editCurrentSet(${i})"><span>${r.setType==='warmup'?'W':r.setNum}</span><b>${loadLine(r.weight,r.reps)}</b>${meta?`<small>${esc(meta)}</small>`:''}<span>Edit</span></button>`;}).join('')}</section>`:''}

      <button type="button" class="nxp-queue-open" onclick="NXP.queue()"><span>Workout queue</span><small>${list.length} exercises</small><i aria-hidden="true">›</i></button>

      ${addOnEligible()?addOnSection():''}
      <div class="nxp-session-tools">${button('Undo last set','apx96UndoLastSet()',true)}${addOnEligible()?'':button('Finish workout','NXT.finish()',true)}</div>
    </div>`;
    if(justLogged)scheduleConfirmReset();
    setTimeout(apx96TickTimer,0);
  }
  /* The confirmation lives on the button that was pressed rather than in a
     modal, so it never interrupts the next set. It clears itself without a
     repaint: replacing the DOM again would reset scroll and re-focus. */
  function scheduleConfirmReset() {
    clearTimeout(ui.confirmTimer);
    ui.confirmTimer=setTimeout(()=>{
      const root=document.querySelector('.nxp-train-lift.is-just-logged');
      if(root)root.classList.remove('is-just-logged');
      const btn=document.getElementById('nxp-log-button');
      if(btn&&btn.dataset.idleLabel)btn.textContent=btn.dataset.idleLabel;
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
    const lede=list.length?`<p class="nxp-queue-lede">${list.length} exercises · ${on?'move an exercise up or down':'tap one to switch'}</p>`:'';
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
    if (!list.length) { try { apx96StopRest(); } catch (e) {} }
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
    state.exercise = name; state.setNum = 1; persist(); render();
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
    return `<button type="button" class="nxp-ex-anat" onclick="NXP.exerciseDetails()" `
      + `aria-label="Show exercise details">`
      + NXTANAT.figure({ primary: m.primary, secondary: m.secondary })
      + `</button>`;
  }

  function exerciseDetails() {
    const ex=state.exercise,t=N.targetFor(ex),cue=N.cue(ex);
    const note=typeof v88NoteFor==='function'?v88NoteFor(ex):'';
    const sessions=N.sessionRows(ex,state.gym,state.date,100).slice(-5).reverse();
    const rest=typeof suggestedRestSeconds==='function'?suggestedRestSeconds(ex):90;
    /* Equipment shows only when the library actually knows it — no "Unknown"
       placeholder, and never inferred from the exercise name. */
    const equip=typeof NXTLIB!=='undefined'?NXTLIB.equipmentFor(ex):'';
    const facts=[['Target',`${t.sets} × ${t.reps[0]}–${t.reps[1]} reps`],['Rest',apx96FormatTimer(rest)],['Increment',`${trimNum(t.inc||2.5)} kg`]].concat(equip?[['Equipment',equip]]:[])
      .map(([k,v])=>`<div class="nxp-detail-fact"><span class="nxp-caption">${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    const history=sessions.length
      ? `<ol class="nxp-detail-history">${sessions.map(s=>`<li><span>${esc(N.shortDate(s.date))}</span><b>${s.sets.map(r=>`${esc(trimNum(r.weight))}×${esc(r.reps)}`).join(' · ')}</b></li>`).join('')}</ol>`
      : `<p class="n99-small">No previous sessions recorded for this exercise at ${esc(state.gym)}.</p>`;
    /* The full body belongs here, where there is room for it. Same renderer as
       the Train crop — one anatomy implementation, two sizes. */
    const m=typeof NXTLIB!=='undefined'?NXTLIB.musclesFor(ex):{primary:[],secondary:[]};
    const anat=(typeof NXTANAT!=='undefined'&&m.primary.length)
      ? `<div class="nxp-detail-anat">${NXTANAT.pair(m.primary,m.secondary)}</div>` : '';
    const muscleBlock=m.primary.length
      ? `<section class="nxp-detail-block"><h3>Primary</h3><p>${esc(m.primary.map(id=>NXTANAT.label(id)).join(' · '))}</p></section>`
        + (m.secondary.length?`<section class="nxp-detail-block"><h3>Secondary</h3><p>${esc(m.secondary.map(id=>NXTANAT.label(id)).join(' · '))}</p></section>`:'')
      : '';
    N.modal(ex,`<div class="nxp-detail">
      ${anat}${muscleBlock}
      <div class="nxp-detail-facts">${facts}</div>
      ${note?`<section class="nxp-detail-block"><h3>Equipment note</h3><p>${esc(note)}</p></section>`:''}
      <section class="nxp-detail-block"><h3>${esc(cue.label)}</h3><p>${esc(cue.text)}</p></section>
      <section class="nxp-detail-block"><h3>Recent sessions</h3>${history}</section>
      ${button(note?'Edit equipment note':'Add equipment note','NXP.equipmentNote()',true)}
    </div>`);
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
  function sessionMenu() {N.modal('Session options',row('Session',N.label(state.dayType),'showSessionSheet()')+row('Gym',state.gym,'closeModal();cycleGym()')+row('Equipment note',v88NoteFor(state.exercise)?'Saved':'Add note','NXP.equipmentNote()')+row('Recovery','Check-in','apx96OpenReadiness()')+row('Shorter session','First 3 exercises','NXT.shorter()')+row('Full session','Restore queue','NXT.fullSession()')+button('Finish workout','NXT.finish()',true));}
  function equipmentNote() {v88OpenNoteModal(state.exercise);}
  function progress() {
    applyAppearance();
    const s=N.trendStats(),v=N.ui.view,r=N.ui.range;
    const period=r===14?'Last 2 weeks':r===30?'Last month':r===90?'Last 3 months':'All recorded weigh-ins';
    const tabs=`<div class="n99-progress-tabs nxp-progress-tabs" role="group" aria-label="Progress view">${[['overview','Weight'],['strength','Performance'],['body','Body']].map(([key,title])=>`<button type="button" class="${v===key?'active':''}" aria-pressed="${v===key}" onclick="NXT.setView('${key}')">${title}</button>`).join('')}</div>`;
    const chrome=`<header class="nxp-heading nxp-progress-chrome"><div><h1>Progress</h1><p>${esc(period)}</p></div>${button('+ Weight','apx95OpenQuickWeight()',true)}</header>`;
    if(v==='body'){
      const waist=N.cleanRows(N.cfg().waist,'cm'),scans=bodyScans();
      document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress nxp-progress-body"><header class="nxp-heading nxp-progress-chrome"><div><h1>Progress</h1><p>${esc(bodyTitle(waist,scans))}</p></div>${button('+ Weight','apx95OpenQuickWeight()',true)}</header>${tabs}${bodySummary(waist,scans)}${bodyView(waist,scans)}</div>`;
      return;
    }
    if(v==='strength'){
      const items=N.strengthItems();
      document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress nxp-progress-strength"><header class="nxp-heading nxp-progress-chrome"><div><h1>Progress</h1><p>${esc(performanceSubtitle(items))}</p></div>${button('+ Weight','apx95OpenQuickWeight()',true)}</header>${tabs}${performanceSummary(items)}<div class="nxp-progress-strength-body">${N.strengthHTML()}</div></div>`;
      arrangeStrengthView(items);
      return;
    }
    const vsPrior=s.change===null?'Latest 7-day mean vs previous 7 days is still building — each week needs 3 weigh-ins.':`Latest 7-day mean vs previous 7 days: ${N.signed(s.change)} kg`;
    document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress nxp-progress-weight">${chrome}<section class="nxp-progress-hero" id="nxp-progress-hero"></section>${tabs}<div class="nxp-progress-overview">${N.chartHTML()}<details class="nxp-progress-tdee nxp-disclosure"><summary>Energy estimate</summary>${N.tdeeCardHTML()}</details>${row('Weigh-in history',N.weights().length+' days','NXT.openWeightHistory()')}</div></div>`;
    arrangeWeightView(vsPrior);
  }
  function syncLatestControl() {
    const btn=document.getElementById('nxp-progress-latest');
    if(!btn)return;
    const pts=N.ui.chart?.points||[];
    const last=pts.at(-1);
    const away=!!(last&&N.ui.selected&&N.ui.selected!==last.date);
    btn.hidden=!away;
  }
  function arrangeWeightView(vsPrior) {
    const root=document.querySelector('.nxp-progress-weight');
    if(!root)return;
    const hero=document.getElementById('nxp-progress-hero');
    const overview=root.querySelector('.nxp-progress-overview');
    const chart=root.querySelector('.n99-chart');
    const selected=root.querySelector('.n99-chart-selected');
    const controls=root.querySelector('.n99-chart-controls');
    const insight=root.querySelector('.n99-review');
    if(hero){
      if(selected)hero.appendChild(selected);
      else hero.innerHTML=`<div class="n99-chart-selected"><div><span id="n99-chart-date">—</span><strong id="n99-chart-weight">—<small> kg</small></strong></div><div><span>7-day average</span><b id="n99-chart-average">—</b><small id="n99-chart-coverage">No weigh-in in this view</small></div></div>`;
      const note=document.createElement('p');
      note.className='nxp-progress-compare';
      note.textContent=vsPrior;
      hero.appendChild(note);
      if(selected||hero.querySelector('#n99-chart-weight')){
        const latest=document.createElement('button');
        latest.type='button';
        latest.id='nxp-progress-latest';
        latest.className='n99-text nxp-progress-latest';
        latest.textContent='Show latest';
        latest.setAttribute('aria-label','Return to the latest weigh-in in this range');
        latest.hidden=true;
        latest.addEventListener('click',()=>{N.ui.selected=null;N.repaint();});
        const dateEl=hero.querySelector('#n99-chart-date');
        const primary=dateEl&&dateEl.parentElement;
        if(primary){
          primary.classList.add('nxp-progress-hero-primary');
          dateEl.insertAdjacentElement('afterend',latest);
        }else hero.appendChild(latest);
        syncLatestControl();
      }
    }
    if(overview&&controls)overview.insertBefore(controls,overview.firstChild);
    if(overview&&insight){
      insight.classList.add('nxp-progress-insight');
      const tdee=overview.querySelector('.nxp-progress-tdee');
      overview.insertBefore(insight,tdee||null);
    }
    if(chart){
      const title=chart.querySelector(':scope > .n99-row');
      if(title)title.hidden=true;
      chart.querySelectorAll(':scope > .n99-small').forEach(el=>{
        const keep=el.textContent.split(' · ').map(s=>s.trim()).filter(Boolean)
          .filter(part=>!/^No plateau detected$/i.test(part)&&!/^Plateau:/i.test(part)&&!/^Trend is gaining$/i.test(part));
        if(!keep.length)el.hidden=true;
        else el.textContent=keep.join(' · ');
      });
    }
  }
  function performanceSubtitle(items) {
    const last=items.map(x=>x.latestDate).filter(Boolean).sort().at(-1);
    if(!items.length)return 'No lifting history yet';
    if(items.every(x=>x.status==='Older history'))return 'Older history';
    return last?'Last comparable lift '+N.shortDate(last):items.length+' exercises tracked';
  }
  function performanceSummary(items) {
    const last=items.map(x=>x.latestDate).filter(Boolean).sort().at(-1);
    const older=items.filter(x=>x.status==='Older history').length;
    const holding=items.filter(x=>x.tone==='good').length;
    const review=items.filter(x=>x.status==='Review').length;
    const building=items.filter(x=>x.status==='Building data').length;
    const watch=items.filter(x=>x.status==='Watch').length;
    let title='No lifts yet';
    let detail='Log the same exercise at the same gym to start a comparison.';
    if(items.length&&older===items.length){
      title='Older history';
      detail=last?`Last comparable lift ${N.shortDate(last)}. None of the ${items.length} tracked exercises is recent enough for a current comparison.`:`${items.length} exercises tracked, none recent enough to compare.`;
    }else if(items.length){
      title=review?`${holding} holding / improving · ${review} to review`:holding||watch?`${holding} holding / improving`:`${items.length} exercises`;
      const bits=[older?older+' older history':'',building?building+' still building':'',watch?watch+' watch':''].filter(Boolean);
      detail=(last?'Last comparable lift '+N.shortDate(last)+'. ':'')+(bits.length?bits.join(' · ')+'.':'Comparable sessions are available.');
    }
    return `<section class="nxp-progress-strength-summary"><span class="nxp-caption">Performance history</span><strong>${esc(title)}</strong><p>${esc(detail)}</p></section>`;
  }
  function arrangeStrengthView(items) {
    const root=document.querySelector('.nxp-progress-strength');
    if(!root)return;
    const cards=[...root.querySelectorAll('.nxp-progress-strength-body > .n99-card')];
    const intro=cards[0],list=cards[1];
    if(intro){
      intro.classList.add('nxp-progress-strength-note');
      const heading=intro.querySelector('h2'),stats=intro.querySelector('.n99-stats');
      if(heading)heading.hidden=true;
      if(stats)stats.hidden=true;
      if(list)list.insertAdjacentElement('afterend',intro);
    }
    if(list){
      list.classList.add('nxp-progress-strength-list');
      const heading=list.querySelector('h2');
      if(heading){
        heading.className='nxp-caption nxp-progress-strength-heading';
        heading.textContent=items.length?'Exercise trends · '+items.length:'Exercise trends';
      }
    }
    const rows=[...root.querySelectorAll('.n99-strength-row')];
    items.forEach((item,i)=>{
      const row=rows[i];if(!row)return;
      const meta=row.querySelector('p');
      const last=item.history.at(-1),set=last?.sets?.at(-1);
      const bits=[item.gym,item.sessions+(item.sessions===1?' session':' sessions')];
      if(item.latestDate)bits.push(N.shortDate(item.latestDate));
      const load=set?N.finite(set.weight):null,reps=set?N.finite(set.reps):null;
      if(load!==null&&reps!==null&&reps>0)bits.push((Number.isInteger(load)?load:load.toFixed(1))+' kg × '+reps);
      else if(item.latestE1rm)bits.push('Est. 1RM '+Math.round(item.latestE1rm));
      if(meta)meta.textContent=bits.join(' · ');
      const status=row.querySelector('.n99-status');
      if(status&&item.status==='Older history')status.classList.add('nxp-progress-status-quiet');
    });
  }
  function bodyScans() {
    return [...(state.scans||[])].filter(s=>s&&Number.isFinite(N.dateMs(s.date))&&s.date<=state.date)
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }
  function bodyTitle(waist,scans) {
    if(waist.length&&scans.length)return 'Waist and scans';
    if(waist.length)return waist.length===1?'One waist measurement':waist.length+' waist measurements';
    if(scans.length)return scans.length===1?'One Evo scan':scans.length+' Evo scans';
    return 'No measurements yet';
  }
  function scanBits(scan) {
    const bits=[],w=N.finite(scan.weight),bf=N.finite(scan.bodyFat),mm=N.finite(scan.muscleMass),fm=N.finite(scan.fatMass);
    if(w!==null)bits.push(w.toFixed(1)+' kg');
    if(bf!==null)bits.push(bf.toFixed(1)+'% body fat');
    if(mm!==null)bits.push(mm.toFixed(1)+' kg muscle');
    if(fm!==null)bits.push(fm.toFixed(1)+' kg fat mass');
    return bits;
  }
  function bodySummary(waist,scans) {
    const lastW=waist.at(-1),priorW=waist.at(-2),lastS=scans.at(-1);
    /* Lead with the measurement, not the count. The header already says how many
       readings exist, so repeating "3 waist measurements" as the headline said
       the same thing twice and made a tally the loudest thing on a screen whose
       subject is a number in centimetres. The delta beside it is presentation
       arithmetic over the two readings already listed below — the same class of
       display-only figure as the chart's post-workout delta. It is not stored,
       not fed to any calculation, and no Body semantics change. */
    if(lastW){
      const delta=priorW?lastW.cm-priorW.cm:null;
      const move=delta===null?'':`${delta>0?'+':''}${delta.toFixed(1)} cm vs ${esc(N.shortDate(priorW.date))}`;
      const meta=[esc(N.shortDate(lastW.date)),move].filter(Boolean).join(' · ');
      const scanLine=lastS?`<p class="nxp-progress-body-scanline">Latest Evo scan ${esc(N.shortDate(lastS.date))}.</p>`:'';
      return `<section class="nxp-progress-body-summary"><span class="nxp-caption">Waist</span>`
        +`<strong>${esc(lastW.cm.toFixed(1))} <em>cm</em></strong>`
        +`<p>${meta}</p>${waist.length<2?'<p class="nxp-progress-body-scanline">A second reading is needed before a comparison.</p>':''}${scanLine}</section>`;
    }
    if(lastS){
      const bits=scanBits(lastS);
      return `<section class="nxp-progress-body-summary"><span class="nxp-caption">Evo scan</span>`
        +`<strong>${esc(bits[0]||'Saved scan')}</strong>`
        +`<p>${esc(N.shortDate(lastS.date))}${bits.length>1?' · '+esc(bits.slice(1).join(' · ')):''}</p>`
        +`<p class="nxp-progress-body-scanline">No waist measurements yet.</p></section>`;
    }
    return `<section class="nxp-progress-body-summary"><span class="nxp-caption">Body</span>`
      +`<strong>Nothing measured yet</strong>`
      +`<p>Waist and Evo scans are optional. Scale weight stays on the Weight tab; nothing here is estimated.</p></section>`;
  }
  function bodyView(waist,scans) {
    const waistRows=waist.slice().reverse().map(r=>`<button type="button" class="n99-list-row nxp-progress-body-row" onclick="NXT.openWaist('${r.date}')"><span>${esc(N.shortDate(r.date))}</span><b>${r.cm.toFixed(1)} cm</b><span>Edit ›</span></button>`).join('');
    const scanRows=scans.slice().reverse().map(s=>{
      const bits=scanBits(s);
      return `<div class="nxp-progress-body-scan"><span>${esc(N.shortDate(s.date))}</span><b>${esc(bits[0]||'Evo scan')}</b><small>${esc(bits.slice(1).join(' · ')||'Saved scan')}</small></div>`;
    }).join('');
    return `<section class="nxp-progress-body-section"><h2 class="nxp-caption nxp-progress-body-heading">All readings</h2>${waist.length?waistRows:`<p class="nxp-progress-body-empty">No waist measurements yet. Optional, about once a week, with the same tape position.</p>`}${row('Log waist','+',"NXT.openWaist()",'Same position and similar conditions')}</section><section class="nxp-progress-body-section"><h2 class="nxp-caption nxp-progress-body-heading">Evo scans</h2>${scans.length?scanRows:`<p class="nxp-progress-body-empty">No scans saved. Compare readings under similar conditions; treat changes as estimates, not proof of fat or muscle loss.</p>`}${row('Open scans','Open',"NXT.more('body')",'Existing scan tools and history')}</section><p class="n99-small nxp-progress-body-note">Body fat and muscle figures only appear from saved Evo scans. They are not calculated from waist or scale weight.</p>`;
  }
  function more() {
    applyAppearance();
    const view=state.moreView||'hub',c=N.cfg(),page=document.getElementById('morePage');
    page.classList.toggle('nxp-settings-page',view!=='hub'&&view!=='appearance'&&view!=='data');
    if(view==='appearance'){page.innerHTML=shell(header('Appearance','Purple & charcoal',button('‹ Back',"NXT.more('hub')",true))+N.card('Make it comfortable',`<form onsubmit="event.preventDefault();NXP.saveAppearance()"><label>Text size<select id="nxp-text"><option value="normal">Standard</option><option value="large" ${pref().text==='large'?'selected':''}>Larger</option></select></label><label>Motion<select id="nxp-motion"><option value="system">Follow device setting</option><option value="reduced" ${pref().motion==='reduced'?'selected':''}>Reduce motion</option></select></label><button type="submit" class="n99-button">Save appearance</button></form>`));return;}
    if(view==='data'){dataView();return;}
    if(view!=='hub'){base.more();return;}
    const lifts=Object.values(settings.weeklyPlan||{}).filter(t=>!['Rest','Zone2','Floorball'].includes(t)).length;
    const waist=N.cleanRows(c.waist,'cm').length;
    page.innerHTML=shell(`${header('More')}
      ${moreAccount()}
      ${moreGroup('Plan',row('Profile & cut',c.calories?formatNumber(c.calories)+' kcal':'Set up',"NXT.more('goals')",c.targetConfirmed?goalLow()+'–'+goalHigh()+' kg range':'Calorie guide and optional goal range')+row('Training',lifts+' lifting days',"NXT.more('training')",'Plan, workouts and gyms'))}
      ${moreGroup('Recovery',row('Wearable',wearableConnectionLabel(),'NXP.openWearableConnection()','Connect stays disconnected until a secure backend exists')+row('Cardio & recovery',(Number(settings.zone2WeeklyTarget)||90)+' min / week',"NXT.more('coach')",'Weekly minutes and check-ins'))}
      ${moreGroup('Body',row('Body & scans',waist?waist+(waist===1?' waist entry':' waist entries'):'None yet',"NXT.more('body')",'Evo scans and measurements'))}
      ${moreGroup('Preferences',row('Appearance','Purple · charcoal',"NXT.more('appearance')")+row('Reminders',state.notifs?.enabled?'Enabled':'Off',"NXT.more('notifications')"))}
      ${moreGroup('Data',row('Data & sync',cloudUser?'Signed in':'Local-only',"NXT.more('data')",'Backup export: '+backupLabel())+row('App','Install & reset',"NXT.more('app')"))}
      ${cloudUser?`<button type="button" class="nxp-more-signout" onclick="cloudSignOut()">Sign out</button>`:''}
      <p class="nxp-footer">NXTFRM · your next form</p>`,'nxp-more');
  }
  function moreAccount() {
    const signed=!!cloudUser;
    const configured=!!((localStorage.getItem('apm_sb_url')||'').trim()&&(localStorage.getItem('apm_sb_key')||'').trim());
    const title=signed?(cloudUser.email||'Signed in'):configured?'Sign-in needed':'Local-only';
    const detail=[state.gym||null,signed?'Cloud session on this device':'Stored on this device'].filter(Boolean).join(' · ');
    return `<section class="nxp-more-account"><span class="nxp-caption">Account</span><h2>${esc(title)}</h2><p>${esc(detail)}</p></section>`;
  }
  function moreGroup(title,html) {
    return `<h2 class="nxp-group-title">${esc(title)}</h2><section class="nxp-more-group">${html}</section>`;
  }
  function saveAppearance() {N.cfg().appearance={text:val('nxp-text')==='large'?'large':'normal',motion:val('nxp-motion')==='reduced'?'reduced':'system'};applyAppearance();N.commit('Appearance saved');}
  function dataView() {
    const settingsHTML=cloudCardHTML().replace(/>Online</g,'>Signed in<').replace(/>Connected</g,'>Signed in<').replace('Supabase Anon Public Key','Supabase publishable / anon key').replace('id="sbKey" class="input"','id="sbKey" type="password" autocomplete="off" class="input"');
    document.getElementById('morePage').innerHTML=shell(`${header('Data & sync','Your records stay yours.',button('‹ Back',"NXT.more('hub')",true))}<section class="n99-card"><div class="n99-row"><h2>Supabase connection</h2><span class="nxp-tag">Read-only test</span></div><p>${esc(cloudLabel())}</p><div id="nxp-connection-result" aria-live="polite">${connectionHTML()}</div><button type="button" id="nxp-connection-test" class="n99-button" onclick="NXP.testConnection()">Test connection</button><p class="n99-small">Checks your project, sign-in and whether your backup row is visible. It does not upload, load or replace workout data. Write access is not tested.</p><details class="nxp-advanced"><summary>Account & connection settings</summary>${settingsHTML}</details></section>
      <section class="n99-card"><h2>Backup & restore</h2><p>Export workouts, weigh-ins, settings and check-ins stored in this browser. Wearable evidence in the on-device wearable store is not included; it remains on this device until you reset the app, and can be rebuilt by a later provider sync.</p><p class="n99-small">Export last requested: ${esc(backupLabel())}. Check your Downloads to confirm the file was saved.</p><div class="n99-stack">${button('Export app backup','exportJSON()')}${button('Export workout CSV','exportCSV()',true)}</div><details class="nxp-advanced"><summary>Restore a backup</summary>${backupRestoreHTML()}</details></section>
      <details class="n99-card"><summary>Local safety copy</summary><p>Recovery copy made before a restore, cloud load or reset. It is not an independent backup.</p><div class="n99-stack">${button('Download safety copy','NXT.exportSafety()',true)}${button('Restore safety copy','NXT.restoreSafety()',true)}</div></details><details class="n99-card"><summary>Advanced cloud setup</summary>${supabaseSQLHelpHTML()}</details>`);
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
      await request('/auth/v1/settings');c.lines.push('Project reachable · public key accepted');paintConnection();
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
    }catch(e){c.tone='watch';c.summary=e.message==='timeout'?'Connection check timed out':e instanceof TypeError?'Could not reach the project. Check your network, project status or browser restrictions.':e.message||'Connection check failed';}
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
    const bw=bwForDate(date);
    return {logs,cardio:cardioForDate(date),floorball:(state.floorball||[]).filter(r=>r&&r.date===date),bw:bw&&historyNum(bw.weight)?bw:null};
  }
  function historyMarks(date,scope) {
    const r=historyRecords(date);
    return {lift:scope.lift&&r.logs.length>0,cond:scope.cond&&(r.cardio.length>0||r.floorball.length>0),body:scope.body&&!!r.bw};
  }
  function historyMonthDates(month,scope) {
    const seen=new Set(),add=arr=>(arr||[]).forEach(r=>{const d=r&&r.date;if(typeof d==='string'&&d.startsWith(month)&&Number.isFinite(N.dateMs(d)))seen.add(d);});
    if(scope.lift)add(state.logs);
    if(scope.cond){add(state.cardio);add(state.floorball);}
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
  function historyCalendar(month,scope,selected) {
    const [year,monthNum]=month.split('-').map(Number);
    const first=new Date(year,monthNum-1,1,12,0,0);
    const title=first.toLocaleDateString('en-SG',{month:'long',year:'numeric'});
    const firstDow=(first.getDay()+6)%7,days=new Date(year,monthNum,0).getDate(),prevDays=new Date(year,monthNum-1,0).getDate();
    const total=Math.ceil((firstDow+days)/7)*7,today=localToday(),cells=[];
    for(let i=0;i<total;i++){
      const offset=i-firstDow+1;
      let y=year,m=monthNum,d=offset,outside=false;
      if(offset<1){m=monthNum-1;if(m<1){m=12;y--;}d=prevDays+offset;outside=true;}
      else if(offset>days){m=monthNum+1;if(m>12){m=1;y++;}d=offset-days;outside=true;}
      const key=dateKeyFromParts(y,m,d),marks=historyMarks(key,scope),cls=['nxp-cal-day'];
      if(outside)cls.push('is-outside');
      if(key===today)cls.push('is-today');
      if(key===selected)cls.push('is-selected');
      if(marks.lift)cls.push('has-lift');
      const kinds=[marks.lift?'lifting':'',marks.cond?'cardio':'',marks.body?'weigh-in':''].filter(Boolean);
      const label=new Date(`${key}T12:00:00`).toLocaleDateString('en-SG',{day:'numeric',month:'long'})+(kinds.length?`, ${kinds.join(', ')}`:', no records');
      cells.push(`<button type="button" class="${cls.join(' ')}" aria-label="${esc(label)}" aria-pressed="${key===selected?'true':'false'}"${key===today?' aria-current="date"':''} onclick="NXP.historySelect('${key}')"><b>${d}</b><span class="nxp-cal-marks" aria-hidden="true">${marks.lift?'<i class="lift"></i>':''}${marks.cond?'<i class="cond"></i>':''}${marks.body?'<i class="body"></i>':''}</span></button>`);
    }
    return `<section class="nxp-history-calendar"><div class="nxp-cal-head"><h2 class="nxp-cal-month">${esc(title)}</h2><div class="nxp-cal-nav"><button type="button" aria-label="Previous month" onclick="NXP.historyShiftMonth(-1)">‹</button><button type="button" class="nxp-cal-today" aria-label="Jump to current month" onclick="NXP.historyThisMonth()">Today</button><button type="button" aria-label="Next month" onclick="NXP.historyShiftMonth(1)">›</button></div></div><div class="nxp-cal-weekdays" aria-hidden="true">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<span>${x}</span>`).join('')}</div><div class="nxp-cal-grid">${cells.join('')}</div><p class="nxp-cal-legend"><span class="lift">Lifting</span><span class="cond">Cardio</span><span class="body">Weigh-in</span></p></section>`;
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
    return `<div class="nxp-history-block"><span class="nxp-history-block-label">Lifting</span>${identity?`<p class="nxp-history-block-title">${esc(identity)}</p>`:''}${rows}<button type="button" class="nxp-history-edit" onclick="NXP.historyDay('${date}')">Edit sets<i aria-hidden="true">›</i></button></div>`;
  }
  function historyConditioningBlock(cardio,floorball) {
    const rows=[];
    cardio.forEach(r=>{
      const mins=historyNum(r.duration||r.minutes),hr=historyNum(r.hr),effort=historyNum(r.intensity),incline=historyNum(r.incline),speed=historyNum(r.speed);
      rows.push({name:r.type||'Cardio',value:mins?`${mins} min`:'',meta:[hr?`HR ${hr}`:'',effort?`Intensity ${effort}`:'',incline?`Incline ${incline}`:'',speed?`Speed ${speed}`:'',r.gym||''].filter(Boolean)});
    });
    floorball.forEach(r=>{
      const mins=historyNum(r.duration),effort=historyNum(r.intensity);
      rows.push({name:'Floorball',value:mins?`${mins} min`:'',meta:[effort?`Intensity ${effort}`:'',r.notes?String(r.notes):''].filter(Boolean)});
    });
    return `<div class="nxp-history-block"><span class="nxp-history-block-label">Cardio</span>${rows.map(r=>`<div class="nxp-history-ex"><b>${esc(r.name)}</b>${r.value?`<span>${esc(r.value)}</span>`:''}</div>${r.meta.length?`<p class="nxp-history-meta">${esc(r.meta.join(' · '))}</p>`:''}`).join('')}</div>`;
  }
  function historyWeightBlock(bw) {
    return `<div class="nxp-history-block"><span class="nxp-history-block-label">Weight</span><div class="nxp-history-ex"><b>${esc(historyNum(bw.weight))} kg</b>${bw.timeOfDay?`<span>${esc(bw.timeOfDay)}</span>`:''}</div></div>`;
  }
  function historyDayView(date,filter,scope) {
    const r=historyRecords(date),when=new Date(`${date}T12:00:00`),blocks=[],parts=[];
    if(scope.lift&&r.logs.length)blocks.push(historyLiftingBlock(date,r.logs));
    if(scope.cond&&(r.cardio.length||r.floorball.length))blocks.push(historyConditioningBlock(r.cardio,r.floorball));
    if(scope.body&&r.bw)blocks.push(historyWeightBlock(r.bw));
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
    if(scope.body&&r.bw)parts.push(`${historyNum(r.bw.weight)} kg`);
    const emptyCopy=filter==='strength'?'No lifting logged on this date.':filter==='conditioning'?'No cardio logged on this date.':filter==='body'?'No weigh-in recorded on this date.':'No training or measurements logged.';
    return `<section class="nxp-history-selected"><header class="nxp-history-selected-head"><span class="nxp-history-weekday">${esc(when.toLocaleDateString('en-SG',{weekday:'long'}))}</span><h2>${esc(when.toLocaleDateString('en-SG',{day:'numeric',month:'long',year:'numeric'}))}</h2>${parts.length?`<p class="nxp-history-selected-summary">${esc(parts.join(' · '))}</p>`:''}</header>${blocks.length?blocks.join(''):`<p class="nxp-history-empty">${esc(emptyCopy)}</p>`}</section>`;
  }
  function history() {
    applyAppearance();
    const month=calendarMonthState(),filter=state.historyFilter||'all',scope=historyScope(filter),selected=historySelectedDate(month,scope);
    document.getElementById('historyPage').innerHTML=`<div class="n99 nxp nxp-history"><header class="nxp-heading nxp-history-chrome"><div><h1>History</h1><p>${esc(historyMonthSummary(month,filter,scope))}</p></div></header><div class="nxp-history-filters" role="group" aria-label="Activity type">${HISTORY_TABS.map(([k,t])=>`<button type="button" aria-pressed="${filter===k?'true':'false'}" class="${filter===k?'active':''}" onclick="NXP.setHistoryFilter('${k}')">${t}</button>`).join('')}</div>${historyCalendar(month,scope,selected)}${historyDayView(selected,filter,scope)}</div>`;
  }
  function setHistoryFilter(filter) {
    state.historyFilter=filter;
    ui.historyRows=[];
    history();
  }
  function historySelect(date) {
    if(!Number.isFinite(N.dateMs(date)))return;
    state.historyDate=date;
    const month=date.slice(0,7);
    if(month!==calendarMonthState())state.historyMonth=month;
    history();
  }
  function historyShiftMonth(delta) {
    const [y,m]=calendarMonthState().split('-').map(Number),d=new Date(y,m-1+delta,1,12,0,0);
    state.historyMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    history();
  }
  function historyThisMonth() {
    state.historyDate=localToday();
    state.historyMonth=state.historyDate.slice(0,7);
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
  function bindSteppers() {
    /* Delegated once. The Train screen replaces its own markup on every engine
       repaint, so per-element listeners would leak on each logged set. */
    document.addEventListener('pointerdown',holdStart);
    document.addEventListener('pointermove',holdMove,{passive:true});
    ['pointerup','pointercancel','pointerleave','contextmenu','blur'].forEach(name=>document.addEventListener(name,holdEnd,true));
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
    rest.classList.toggle('is-active',left>0);
    const fill=rest.querySelector('.nxp-rest-rail > span');
    if(fill)fill.style.width=(left&&ui.restTotal?Math.max(0,Math.min(100,left/ui.restTotal*100)):0)+'%';
    /* The engine writes a shouted "READY" into the value. At rest-timer size
       that is the loudest thing on a screen where nothing is happening, so the
       idle state is set back to a quiet word here. */
    const value=document.getElementById('apx96TimerValue');
    if(value&&!left&&value.textContent!=='Ready')value.textContent='Ready';
  }
  bindSteppers();
  return {ui,home,training,progress,more,history,addOnAdd,addOnRemove,addOnPick,addOnFilter,addOnSelect,rememberInput,logSet,queue,queueMove,exerciseDetails,paintRest,noteRestTotal,setSetType,setRir,goExercise,chooseExercise,editCurrentSet,sessionMenu,equipmentNote,sessionSummary,saveAppearance,applyAppearance,exportBackup,cloudLabel,backupLabel,connectionHTML,validConfig,testConnection,historyDay,editHistorySet,otherDayDetails,historySelect,setHistoryFilter,historyShiftMonth,historyThisMonth,openRecovery,setRecoveryPreview,openWearableConnection};
})();
(function hookProgressSelect(){
  const orig=NXT.selectPoint;
  NXT.selectPoint=function(index){
    orig(index);
    const el=document.getElementById('n99-chart-weight');
    const p=NXT.ui.chart?.points?.[index];
    if(el&&p)el.innerHTML=`${p.weight.toFixed(1)}<small> kg</small>`;
    const btn=document.getElementById('nxp-progress-latest');
    if(!btn)return;
    const pts=NXT.ui.chart?.points||[];
    const last=pts.at(-1);
    btn.hidden=!(last&&p&&p.date!==last.date);
  };
})();
renderHome=NXP.home;renderTrain=NXP.training;renderWeight=NXP.progress;renderMore=NXP.more;renderHistory=NXP.history;
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
if(document.readyState!=='loading')NXT.repaint();
