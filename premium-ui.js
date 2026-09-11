/* V100 presentation layer. Uses the existing workout, chart and backup engines. */
"use strict";
const NXP = (() => {
  const N=NXT;
  const base={home:N.home,training:N.training,more:N.moreView,historyDay:showHistoryDay,exportJSON,logSet:N.logSet};
  const ui={drafts:new Map(),historyRows:[],connection:{busy:false,lines:[],summary:'Not tested on this device'}};
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
    N.logSuggestion({kind:"review",subject:null,payload:{title:r.title,action:r.action,tone:r.tone,reason:r.reason}});
    document.getElementById('homePage').innerHTML=`<div class="n99 nxp nxp-home">
      <header class="nxp-heading nxp-home-chrome"><div><h1>Today</h1><p>${N.shortDate(state.date)}</p></div>${button(esc(state.gym),'cycleGym()',true)}</header>
      <section class="nxp-home-status">
        <button type="button" class="nxp-home-kcal" onclick="NXT.openCalories()"><small>Daily guide</small><strong>${cal?formatNumber(cal)+' <em>kcal</em>':'Set target'}</strong><span>${cal?'Edit':'Set up'}</span></button>
        <div class="nxp-home-change"><small>Weekly change</small><strong>${weekly}</strong>${last?`<span>Latest ${last.weight.toFixed(1)} kg</span>`:`<span>${s.change===null?'Needs two weeks':'vs prior 7 days'}</span>`}</div>
      </section>
      <button type="button" class="nxp-home-decision ${esc(r.tone)}" onclick="NXT.openReview()"><span class="nxp-caption">NXTFRM Decision</span><b>${esc(r.title)}</b>${r.reason?`<p>${esc(r.reason)}</p>`:''}<span class="nxp-home-review">Review →</span></button>
      <section class="nxp-home-today"><div class="n99-row"><span class="nxp-caption">${finished?'Workout saved':'Today'}</span>${link('Change','showSessionSheet()')}</div><h2>${esc(N.label(state.dayType))}</h2><p>${context}</p>${button(title,finished?"switchTab('train')":action)}</section>
      ${N.adherenceHTML()}
      <nav class="nxp-home-secondary" aria-label="Quick actions">${link('＋ Weight','apx95OpenQuickWeight()')}${state.dayType==='Zone2'?'':link('Log cardio','showCardioSheet()')}${state.dayType==='Rest'?'':link('Check-in','apx96OpenReadiness()')}</nav>
      <details class="nxp-home-week nxp-disclosure"><summary><span>Your week</span><small>${N.completedWeek()} lifting days logged</small></summary>${N.weekHTML()}<div class="nxp-card-foot"><span>${N.cardioWeek()} / ${Number(settings.zone2WeeklyTarget)||90} cardio min</span>${link('Edit plan ›',"NXT.more('training')")}</div></details>
      <details class="nxp-home-trend nxp-disclosure"><summary><span>Weight detail</span><small>${last?last.weight.toFixed(1)+' kg':'No weigh-in yet'}</small></summary><div class="n99-stats">${N.metric('7-day average',s.current.n>=3?s.current.avg.toFixed(1)+'<small> kg</small>':'—',s.current.n>=3?'From '+s.current.n+' weigh-ins':'Needs 3 readings in 7 days')}${N.metric('Weekly change',s.change===null?'—':N.signed(s.change,2)+'<small> kg</small>',s.change===null?'Building a comparison':'Compared with prior 7 days')}</div><div class="nxp-card-foot"><span>${last?'Latest: '+last.weight.toFixed(1)+' kg · '+N.shortDate(last.date):'Your first weigh-in sets the baseline.'}</span>${link('View progress ›',"switchTab('weight')")}</div></details>
    </div>`;
  }
  function draftKey() {return sessionKey()+'__'+state.exercise;}
  function rememberInput(el) {const key=draftKey(),d=ui.drafts.get(key)||{};d[el.id]=el.value;ui.drafts.set(key,d);if(el.id==='n99-set-type'){const b=document.getElementById('nxp-log-button');if(b)b.textContent='＋ Log '+(el.value==='warmup'?'warm-up':'set '+(N.done(state.exercise)+1));}}
  function trainChrome() {return `<header class="nxp-train-chrome"><div><p class="nxp-caption">${esc(N.label(state.dayType))}</p><p>${N.shortDate(state.date)}</p></div>${button('Change','showSessionSheet()',true)}</header>`;}
  function trainIdle(kind,body) {document.getElementById('trainPage').innerHTML=`<div class="n99 nxp nxp-train ${kind}">${trainChrome()}${body}</div>`;}
  function cardioWeekLine() {
    const mins=N.cardioWeek(),target=Number(settings.zone2WeeklyTarget)||90;
    return {mins,target,pct:target?Math.min(100,mins/target*100):0};
  }
  function trainRest() {
    const w=cardioWeekLine();
    trainIdle('nxp-train-rest',`<section class="nxp-train-state"><h2>No lifting session due</h2><p>Recovery is part of the plan. Nothing needs to be made up today.</p><p class="nxp-caption">${w.mins} / ${w.target} cardio min this week</p><div class="nxp-train-state-actions">${button('Quick recovery check-in','apx96OpenReadiness()')}${button('Log cardio','showCardioSheet()',true)}</div></section>`);
  }
  function trainZone2() {
    const w=cardioWeekLine();
    trainIdle('nxp-train-zone2',`<section class="nxp-train-state"><h2>Easy cardio</h2><p>Zone 2 — a conversational effort. No lifting session is due.</p><div class="nxp-train-pace"><span class="nxp-caption">This week</span><strong>${w.mins} <em>/ ${w.target} min</em></strong><div class="n99-session-rail" aria-hidden="true"><span style="width:${w.pct}%"></span></div></div><div class="nxp-train-state-actions">${button('Log cardio','showCardioSheet()')}${button('Check-in','apx96OpenReadiness()',true)}</div></section>`);
  }
  function trainFloorball() {
    const recent=(state.floorball||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,3);
    trainIdle('nxp-train-floorball',`<section class="nxp-train-state"><h2>Floorball</h2><p>Hard conditioning. Count it toward recovery; no extra intervals needed.</p><div class="nxp-train-floorball-grid"><label>Duration <small>min</small><input id="apx96FbDuration" type="number" min="1" max="600" inputmode="numeric" placeholder="120"></label><label>Intensity <small>1–10</small><input id="apx96FbIntensity" type="number" min="1" max="10" inputmode="numeric" placeholder="8"></label></div><label>Notes<textarea id="apx96FbNotes" rows="3" placeholder="Energy, match load, soreness…"></textarea></label><div class="nxp-train-state-actions">${button('Save session','apx96SaveFloorball()')}</div>${recent.length?`<h3 class="nxp-group-title">Recent</h3>${recent.map(x=>`<div class="nxp-train-recent"><span>${esc(N.shortDate(x.date))}</span><b>${esc(x.duration||'—')} min · RPE ${esc(x.intensity||'—')}</b>${x.notes?`<small>${esc(x.notes)}</small>`:''}</div>`).join('')}`:`<p class="nxp-caption">No Floorball sessions logged yet.</p>`}</section>`);
  }
  function trainEmpty() {
    trainIdle('nxp-train-empty',`<section class="nxp-train-state"><h2>No exercises in this session</h2><p>This session currently has no exercises.</p><div class="nxp-train-state-actions">${button('Add exercise','v88OpenAddModal()')}${button('Restore programme','NXT.fullSession()',true)}</div></section>`);
  }
  function training() {
    applyAppearance();
    if(state.dayType==='Floorball')return trainFloorball();
    if(state.dayType==='Rest')return trainRest();
    if(state.dayType==='Zone2')return trainZone2();
    const list=template();
    if(!list.length)return trainEmpty();
    if(!list.some(e=>e.name===state.exercise))state.exercise=list[0].name;
    const ex=state.exercise,t=N.targetFor(ex),done=N.done(ex),cue=N.cue(ex),draft=ui.drafts.get(draftKey())||{};
    const previous=N.sessionRows(ex,state.gym,state.date,100).at(-1),prev=previous?.sets[Math.min(done,previous.sets.length-1)];
    const current=N.sessionLogs().filter(r=>r.exercise===ex),last=current.filter(r=>r.setType!=='warmup').at(-1);
    const total=list.reduce((a,e)=>a+Number(e.sets),0),count=list.reduce((a,e)=>a+Math.min(N.done(e.name),e.sets),0),finished=N.planDone();
    const weight=draft.weightInput??last?.weight??(cue.weight||'');
    const index=list.findIndex(e=>e.name===ex),nextEx=list[index+1],lastMove=index===list.length-1;
    const restLeft=apx96RestRemaining();
    document.getElementById('trainPage').innerHTML=`<div class="n99 nxp nxp-train">
      <header class="nxp-train-chrome"><div><p class="nxp-caption">${esc(N.label(state.dayType))}</p><p>${esc(state.gym)} · ${N.shortDate(state.date)}</p></div>${button('Session','NXP.sessionMenu()',true)}</header>
      <div class="nxp-session-progress"><span>${count} of ${total} working sets</span><button type="button" class="n99-text" onclick="NXP.queue()">Exercise ${index+1} of ${list.length}</button></div>
      <div class="n99-session-rail"><span style="width:${total?Math.min(100,count/total*100):0}%"></span></div>
      ${finished?N.card('Workout saved',`<p>${N.sessionLogs().filter(r=>r.setType!=='warmup').length} working sets recorded. Everything you logged is in History.</p><div class="n99-stack">${button('View session','NXP.sessionSummary()')}${button('Resume workout','NXT.resume()',true)}</div>`):`
      <aside class="nxp-rest${restLeft?' is-active':''}" aria-label="Rest timer"><span><small>Rest</small><b id="apx96TimerValue">${restLeft?apx96FormatTimer(restLeft):'READY'}</b></span><div>${button('+30s','apx96AdjustRest(30)',true)}${button('Skip','apx96SkipRest()',true)}</div></aside>
      <section class="nxp-workspace">
        <div class="nxp-ex"><div class="n99-row"><h2>${esc(ex)}</h2><button type="button" class="n99-text" onclick="showSubstituteSheet()">Swap</button></div>
        <div class="nxp-set-dots" aria-label="${done} working sets logged, ${t.sets} planned">${Array.from({length:t.sets},(_,i)=>`<span class="${i<done?'done':i===done?'next':''}">${i<done?'✓':i+1}</span>`).join('')}<small>Set ${Math.min(done+1,t.sets)} / ${t.sets}</small></div></div>
        <div class="nxp-aim"><div class="nxp-aim-row"><span>Target <b>${t.reps[0]}–${t.reps[1]}</b></span><span>Last${previous?' · '+N.shortDate(previous.date):''} <b>${prev?esc(prev.weight)+' kg × '+esc(prev.reps):'First session'}</b></span></div><p class="nxp-cue-label">${esc(cue.label)}</p><details class="nxp-coach"><summary>How to apply</summary><p>${esc(cue.text)}</p></details></div>
        <form id="nxp-set-form" onsubmit="event.preventDefault();NXP.logSet()"><div class="nxp-load-inputs"><label>Weight <small>kg</small><input id="weightInput" type="number" min="0" max="1000" step="0.1" inputmode="decimal" required placeholder="0" value="${esc(weight)}" oninput="NXP.rememberInput(this)"></label><label>Reps<input id="repsInput" type="number" min="1" max="100" step="1" inputmode="numeric" required placeholder="${prev?prev.reps:t.reps[0]+'–'+t.reps[1]}" value="${esc(draft.repsInput??'')}" oninput="NXP.rememberInput(this)"></label></div>
        <div class="n99-form-grid nxp-effort"><label><span class="nxp-effort-caption">Set type</span><select id="n99-set-type" onchange="NXP.rememberInput(this)"><option value="working" ${draft['n99-set-type']!=='warmup'?'selected':''}>Working</option><option value="warmup" ${draft['n99-set-type']==='warmup'?'selected':''}>Warm-up</option></select></label><label><span class="nxp-effort-caption">Reps left · <small>Optional</small></span><select id="n99-rir" onchange="NXP.rememberInput(this)"><option value="">Not recorded</option>${[0,1,2,3,4].map(n=>`<option value="${n}" ${String(draft['n99-rir'])===String(n)?'selected':''}>${n===4?'4+':n}</option>`).join('')}</select></label></div>
        <div class="nxp-log-action"><button id="nxp-log-button" type="submit" class="n99-button">＋ Log ${draft['n99-set-type']==='warmup'?'warm-up':'set '+(done+1)}</button></div></form>
        ${current.length?`<div class="nxp-set-history"><h3>Today’s sets</h3>${current.map((r,i)=>{const latest=i===current.length-1;const rir=r.rir===null||r.rir===undefined||r.rir===''?'':Number(r.rir)===4?'4+ left':r.rir+' left';const meta=r.setType==='warmup'?'Warm-up':rir;return `<button type="button" class="nxp-set-row${latest?' is-latest':''}" onclick="NXP.editCurrentSet(${i})"><span>${r.setType==='warmup'?'W':r.setNum}</span><b>${esc(r.weight)} <small>kg</small> × ${esc(r.reps)}</b>${meta?`<small>${esc(meta)}</small>`:''}<span>Edit</span></button>`;}).join('')}</div>`:''}
        <p class="nxp-next">${nextEx?`Next · ${esc(nextEx.name)}`:'Last exercise in this session'}</p>
        <div class="nxp-session-tools">${button('Undo last set','apx96UndoLastSet()',true)}${button(lastMove?'Finish workout':'Next exercise','NXT.nextExercise()',true)}</div>
        ${lastMove?'':`<button type="button" class="n99-text nxp-finish-quiet" onclick="NXT.finish()">Finish workout</button>`}
      </section>`}
      <details class="nxp-queue nxp-disclosure"><summary><span>Workout queue</span><small>${list.length} exercises</small></summary>${queueRows()}${button('Manage exercises','apx96OpenQueueManager()',true)}</details>
    </div>`;
    setTimeout(apx96TickTimer,0);
  }
  function queueRows() {return template().map((e,i)=>{const current=e.name===state.exercise,complete=N.done(e.name)>=e.sets;return `<button type="button" class="nxp-queue-row${current?' is-current':''}${complete?' is-done':''}" onclick="NXP.chooseExercise(${i})"><span>${complete?'✓':i+1}</span><span><b>${esc(e.name)}</b><small>${e.reps[0]}–${e.reps[1]} reps</small></span><span>${N.done(e.name)} / ${e.sets}</span></button>`;}).join('');}
  function queue() {N.modal('Workout queue',queueRows()+button('Manage exercises','apx96OpenQueueManager()',true));}
  function chooseExercise(i) {closeModal();N.selectExercise(i);}
  function editCurrentSet(i) {const r=N.sessionLogs().filter(r=>r.exercise===state.exercise)[i];if(r)openEditSet(r.id);}
  function logSet() {
    const key=draftKey(),d=ui.drafts.get(key),before=state.logs.length;
    ui.drafts.delete(key);base.logSet();if(state.logs.length===before&&d)ui.drafts.set(key,d);
  }
  function sessionMenu() {N.modal('Session options',row('Session',N.label(state.dayType),'showSessionSheet()')+row('Gym',state.gym,'closeModal();cycleGym()')+row('Equipment note',v88NoteFor(state.exercise)?'Saved':'Add note','NXP.equipmentNote()')+row('Recovery','Check-in','apx96OpenReadiness()')+row('Shorter session','First 3 exercises','NXT.shorter()')+row('Full session','Restore queue','NXT.fullSession()')+button('Finish workout','NXT.finish()',true));}
  function equipmentNote() {v88OpenNoteModal(state.exercise);}
  function progress() {
    applyAppearance();
    const s=N.trendStats(),v=N.ui.view,r=N.ui.range;
    const period=r===14?'Last 2 weeks':r===30?'Last month':r===90?'Last 3 months':'All recorded weigh-ins';
    const tabs=`<div class="n99-progress-tabs nxp-progress-tabs" role="group" aria-label="Progress view">${[['overview','Overview'],['strength','Strength'],['body','Body']].map(([key,title])=>`<button type="button" class="${v===key?'active':''}" aria-pressed="${v===key}" onclick="NXT.setView('${key}')">${title}</button>`).join('')}</div>`;
    const overview=`${N.chartHTML()}<section class="nxp-progress-pace"><span class="nxp-caption">Weekly pace</span><strong>${s.change===null?'Building':N.signed(s.change)+' kg'}</strong><small>${s.change===null?'Needs two weeks of readings':'Compared with prior 7 days'}</small></section><details class="nxp-progress-tdee nxp-disclosure"><summary>Energy estimate</summary>${N.tdeeCardHTML()}</details>${row('Weigh-in history',N.weights().length+' days','NXT.openWeightHistory()')}`;
    document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress"><header class="nxp-heading nxp-progress-chrome"><div><h1>Progress</h1><p>${esc(period)}</p></div>${button('＋ Weight','apx95OpenQuickWeight()',true)}</header>${tabs}${v==='strength'?N.strengthHTML():v==='body'?N.bodyHTML():overview}</div>`;
  }
  function more() {
    applyAppearance();
    const view=state.moreView||'hub',c=N.cfg(),page=document.getElementById('morePage');
    page.classList.toggle('nxp-settings-page',view!=='hub'&&view!=='appearance'&&view!=='data');
    if(view==='appearance'){page.innerHTML=shell(header('Appearance','Purple & charcoal',button('‹ Back',"NXT.more('hub')",true))+N.card('Make it comfortable',`<form onsubmit="event.preventDefault();NXP.saveAppearance()"><label>Text size<select id="nxp-text"><option value="normal">Standard</option><option value="large" ${pref().text==='large'?'selected':''}>Larger</option></select></label><label>Motion<select id="nxp-motion"><option value="system">Follow device setting</option><option value="reduced" ${pref().motion==='reduced'?'selected':''}>Reduce motion</option></select></label><button type="submit" class="n99-button">Save appearance</button></form>`));return;}
    if(view==='data'){dataView();return;}
    if(view!=='hub'){base.more();return;}
    const lifts=Object.values(settings.weeklyPlan||{}).filter(t=>!['Rest','Zone2','Floorball'].includes(t)).length;
    page.innerHTML=shell(`${header('More','Secondary settings and tools')}
      <h2 class="nxp-group-title">Profile & cut</h2><section class="nxp-settings-group">${row('Profile & cut',c.calories?formatNumber(c.calories)+' kcal':'Set up',"NXT.more('goals')",c.targetConfirmed?goalLow()+'–'+goalHigh()+' kg range':'Calorie guide and optional goal range')}</section>
      <h2 class="nxp-group-title">Training</h2><section class="nxp-settings-group">${row('Training',lifts+' lifting days',"NXT.more('training')",'Plan, workouts and gyms')}</section>
      <h2 class="nxp-group-title">Cardio & recovery</h2><section class="nxp-settings-group">${row('Cardio & recovery',(Number(settings.zone2WeeklyTarget)||90)+' min / week',"NXT.more('coach')",'Weekly minutes and check-ins')}</section>
      <h2 class="nxp-group-title">Body & scans</h2><section class="nxp-settings-group">${row('Body & scans',N.cleanRows(c.waist,'cm').length+' waist entries',"NXT.more('body')",'Evo scans and measurements')}</section>
      <h2 class="nxp-group-title">Preferences</h2><section class="nxp-settings-group">${row('Appearance','Purple · charcoal',"NXT.more('appearance')")}${row('Reminders',state.notifs?.enabled?'Enabled':'Off',"NXT.more('notifications')")}</section>
      <h2 class="nxp-group-title">Data & app</h2><section class="nxp-settings-group">${row('Data & sync',cloudUser?'Signed in':'Local-first',"NXT.more('data')",'Backup export: '+backupLabel())}${row('App','Install & reset',"NXT.more('app')")}</section>
      <p class="nxp-footer">NXTFRM · your next form</p>`,'nxp-more');
  }
  function saveAppearance() {N.cfg().appearance={text:val('nxp-text')==='large'?'large':'normal',motion:val('nxp-motion')==='reduced'?'reduced':'system'};applyAppearance();N.commit('Appearance saved');}
  function dataView() {
    const settingsHTML=cloudCardHTML().replace(/>Online</g,'>Signed in<').replace(/>Connected</g,'>Signed in<').replace('Supabase Anon Public Key','Supabase publishable / anon key').replace('id="sbKey" class="input"','id="sbKey" type="password" autocomplete="off" class="input"');
    document.getElementById('morePage').innerHTML=shell(`${header('Data & sync','Your records stay yours.',button('‹ Back',"NXT.more('hub')",true))}<section class="n99-card"><div class="n99-row"><h2>Supabase connection</h2><span class="nxp-tag">Read-only test</span></div><p>${esc(cloudLabel())}</p><div id="nxp-connection-result" aria-live="polite">${connectionHTML()}</div>${button('Test connection','NXP.testConnection()')}<p class="n99-small">Checks your project, sign-in and whether your backup row is visible. It does not upload, load or replace workout data. Write access is not tested.</p><details class="nxp-advanced"><summary>Account & connection settings</summary>${settingsHTML}</details></section>
      <section class="n99-card"><h2>Backup & restore</h2><p>Export a copy before updating or switching devices.</p><p class="n99-small">Export last requested: ${esc(backupLabel())}. Check your Downloads to confirm the file was saved.</p><div class="n99-stack">${button('Export full backup','exportJSON()')}${button('Export workout CSV','exportCSV()',true)}</div><details class="nxp-advanced"><summary>Restore a backup</summary>${backupRestoreHTML()}</details></section>
      <details class="n99-card"><summary>Local safety copy</summary><p>Recovery copy made before a restore, cloud load or reset. It is not an independent backup.</p><div class="n99-stack">${button('Download safety copy','NXT.exportSafety()',true)}${button('Restore safety copy','NXT.restoreSafety()',true)}</div></details><details class="n99-card"><summary>Advanced cloud setup</summary>${supabaseSQLHelpHTML()}</details>`);
  }
  function exportBackup() {try{base.exportJSON();N.cfg().backupExportRequestedAt=Date.now();persist();toast('Backup download requested — check Downloads');}catch(e){toast('Could not prepare the backup. Try again before changing devices.');}}
  function connectionHTML() {const c=ui.connection;return `<div class="nxp-connection ${c.tone||''}"><b>${esc(c.busy?'Checking connection…':c.summary)}</b>${c.lines.length?`<ul>${c.lines.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${c.checkedAt?`<small>Checked ${new Date(c.checkedAt).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'})} · this browser only</small>`:''}</div>`;}
  function paintConnection() {const box=document.getElementById('nxp-connection-result');if(box)box.innerHTML=connectionHTML();}
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
  function history() {
    applyAppearance();const month=calendarMonthState(),filter=state.historyFilter||'all';
    const source=filter==='strength'?[state.logs]:filter==='conditioning'?[state.cardio,state.floorball]:filter==='body'?[state.bws]:[state.logs,state.cardio,state.floorball,state.bws,state.scans,state.rest];
    const dates=[...new Set(source.flatMap(a=>(a||[]).map(r=>r?.date)).filter(d=>typeof d==='string'&&d.startsWith(month)&&Number.isFinite(N.dateMs(d))))].sort().reverse();
    const empty=filter==='strength'?'No lifting sessions this month.':filter==='conditioning'?'No cardio logged this month.':filter==='body'?'No weigh-ins this month.':'No activity logged this month.';
    document.getElementById('historyPage').innerHTML=`<div class="n99 nxp nxp-history"><header class="nxp-heading nxp-history-chrome"><div><h1>History</h1></div></header><div class="n99-progress-tabs nxp-history-filters" role="group" aria-label="Activity type">${[['all','All'],['strength','Lifting'],['conditioning','Cardio'],['body','Weight']].map(([k,t])=>`<button type="button" aria-pressed="${filter===k}" class="${filter===k?'active':''}" onclick="nxt98SetHistoryFilter('${k}')">${t}</button>`).join('')}</div>${apx96CalendarHTML()}<h2 class="nxp-group-title">${dates.length?'Logged days':'No records in this view'}</h2>${dates.map(d=>historyCard(d,filter)).join('')}${!dates.length?`<p>${esc(empty)}</p>`:''}</div>`;
  }
  function historyCard(date,filter=state.historyFilter||'all') {
    const logs=dateRows(date).filter(r=>r.setType!=='warmup'),types=[...new Set(logs.map(r=>N.label(r.dayType)))],gyms=[...new Set(logs.map(r=>r.gym||'Gym A'))];
    const cardio=(state.cardio||[]).filter(r=>r.date===date).reduce((a,r)=>a+Number(r.duration||r.minutes||0),0),bw=N.weights().find(r=>r.date===date),fb=(state.floorball||[]).some(r=>r.date===date);
    const parts=[gyms.length?gyms.join(' · '):'',logs.length?logs.length+' sets':'',cardio?cardio+' min cardio':'',fb?'Floorball':'',bw?bw.weight+' kg':''].filter(Boolean);
    const title=filter==='strength'?types.join(' + ')||'Lifting':filter==='conditioning'?fb&&cardio?'Cardio + Floorball':fb?'Floorball':'Cardio':filter==='body'?'Weigh-in':types.join(' + ')||(cardio?'Cardio':fb?'Floorball':bw?'Weigh-in':(state.scans||[]).some(r=>r.date===date)?'Scan':(state.rest||[]).some(r=>r.date===date)?'Rest':'Daily records');
    return `<button type="button" class="nxp-history-card" onclick="NXP.historyDay('${date}')"><span class="nxp-caption">${esc(N.shortDate(date))}</span><b>${esc(title)}</b><small>${esc(parts.join(' · ')||'View records')}</small></button>`;
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
  return {ui,home,training,progress,more,history,rememberInput,logSet,queue,chooseExercise,editCurrentSet,sessionMenu,equipmentNote,sessionSummary,saveAppearance,applyAppearance,exportBackup,cloudLabel,backupLabel,connectionHTML,validConfig,testConnection,historyDay,editHistorySet,otherDayDetails};
})();
renderHome=NXP.home;renderTrain=NXP.training;renderWeight=NXP.progress;renderMore=NXP.more;renderHistory=NXP.history;
showHistoryDay=NXP.historyDay;exportJSON=NXP.exportBackup;
NXP.applyAppearance();
document.title='NXTFRM — Training & Progress';
if(typeof apx96TickTimer==='function'){
  const apx96TickTimerSource=apx96TickTimer;
  apx96TickTimer=function(){
    const result=apx96TickTimerSource.apply(this,arguments);
    const rest=document.querySelector('.nxp-rest');
    if(rest)rest.classList.toggle('is-active',apx96RestRemaining()>0);
    return result;
  };
}
if(document.readyState!=='loading')NXT.repaint();
