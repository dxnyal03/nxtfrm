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
      ?(lastPerfDate?`${lifts.length} lifts · last logged ${N.shortDate(lastPerfDate)}`:'No recent comparable sessions')
      :`${lifts.length} lifts with recent history`;
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
    const weekLogged=N.completedWeek();
    const weekStart=N.weekStart();
    const weekShort={FullA:'Full A',FullB:'Full B',FullC:'Full C',Zone2:'Walk',Rest:'Rest',Floorball:'FB',Push:'Push',Pull:'Pull',Legs:'Legs',Pump:'Legs'};
    const weekStrip=`<div class="vn-week" role="list">${Array.from({length:7},(_,i)=>{
      const d=N.dateAdd(weekStart,i),t=N.typeFor(d),complete=work.some(row=>row.date===d),isToday=d===state.date;
      const short=weekShort[t]||String(t).slice(0,3);
      const day=Number.isFinite(N.dateMs(d))?new Date(N.dateMs(d)).toLocaleDateString('en-SG',{weekday:'narrow',timeZone:'UTC'}):['M','T','W','T','F','S','S'][i];
      return `<button type="button" class="vn-week-c${isToday?' is-today':''}${liftDays(t)?' is-lift':''} is-k-${({FullA:'full',FullB:'full',FullC:'full',Push:'push',Pull:'pull',Legs:'legs',Pump:'legs',Zone2:'walk',Floorball:'fb',Rest:'rest'})[t]||(liftDays(t)?'full':'rest')}" role="listitem" onclick="NXT.openDay('${d}')" aria-label="${esc(N.shortDate(d)+' · '+N.label(t))}" ${isToday?'aria-current="date"':''}><span class="vn-week-d">${esc(day)}</span><span class="vn-week-t">${esc(short)}</span><span class="vn-week-m" aria-hidden="true">${complete?'<i></i>':''}</span></button>`;
    }).join('')}</div>`;
    function liftDays(t){return !['Rest','Zone2','Floorball'].includes(t);}
    const textAct=(label,fn,mute)=>`<button type="button" class="vn-text${mute?' is-mute':''}" onclick="${esc(fn)}">${label}</button>`;
    N.logSuggestion({kind:"review",subject:null,payload:{title:r.title,action:r.action,tone:r.tone,reason:r.reason}});
    const logged=list.reduce((a,e)=>a+Math.min(N.done(e.name),Number(e.sets)),0);
    const trainTile=lift?`
      <article class="st-tile st-t-train" style="--c:var(--st-lift)">
        <div class="st-tile-head"><span class="st-cat">${finished?'Workout saved':'Today’s training'}</span>${textAct('Change','showSessionSheet()',true)}</div>
        <div class="st-train-row">
          <div class="st-train-id">
            <h2 class="st-h2">${esc(N.label(state.dayType))}</h2>
            <p class="st-meta">${list.length} exercises · ${sets} working sets · ${esc(state.gym||'Gym')}</p>
          </div>
          ${logged?ringHTML(logged,sets,'sets','var(--st-lift)'):''}
        </div>
        <div class="st-tweek st-tweek-top"><div class="st-tweek-h"><span>This week · ${weekLogged} lifting ${weekLogged===1?'day':'days'}</span>${textAct('Edit plan',"NXT.more('training')",true)}</div>${weekStrip}</div>
        <button type="button" class="st-cta" onclick="${esc(finished?"switchTab('train')":action)}">${esc(title)}<span aria-hidden="true">›</span></button>
        ${lastLiftLine?`<p class="st-meta st-mt2 st-center">${esc(lastLiftLine)}</p>`:''}
      </article>`:`
      <article class="st-tile st-t-train" style="--c:${state.dayType==='Zone2'?'var(--st-cardio)':state.dayType==='Floorball'?'var(--st-floor)':'var(--st-rest)'}">
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
        <div class="st-tweek"><div class="st-tweek-h"><span>This week · ${weekLogged} lifting ${weekLogged===1?'day':'days'}</span>${textAct('Edit plan',"NXT.more('training')",true)}</div>${weekStrip}</div>
      </article>`;
    document.getElementById('homePage').innerHTML=`<div class="vn-today st-today">
      <div class="vn-pad">
        <header class="st-head">
          <div>
            <p class="st-eyebrow">${esc(weekday)} · ${esc(dateLine)}</p>
            <h1 class="st-h1">${esc(greeting())}</h1>
          </div>
          ${lift?`<button type="button" class="st-chip" onclick="cycleGym()">${esc(state.gym||'Gym')}<span aria-hidden="true">⇄</span></button>`:''}
        </header>
        <div class="st-bento">
          ${trainTile}
          <div class="st-minis">
            ${weightTileHTML()}
            <button type="button" class="st-tile st-mini" style="--c:var(--st-cardio)" onclick="showCardioSheet()">
              <span class="st-cat">Cardio</span>
              <span class="st-mini-v"><b class="vn-num">${cardioMins}</b><small>/${cardioTarget}</small></span>
              <span class="st-mini-bar"><i style="width:${Math.min(100,cardioTarget?cardioMins/cardioTarget*100:0).toFixed(0)}%"></i></span>
              <span class="st-meta">min/wk</span>
            </button>
            <button type="button" class="st-tile st-mini" style="--c:var(--st-lift)" onclick="NXT.ui.view='strength';switchTab('weight')">
              <span class="st-cat">Lifts</span>
              <span class="st-mini-v st-mini-w">${esc(perfLabel)}</span>
              <span class="st-meta">${perfLabel==='Older history'&&lastPerfDate?`Last ${esc(N.shortDate(lastPerfDate))}`:`${lifts.length} lifts`}</span>
            </button>
          </div>
          <section class="st-tile st-t-dec${toneClass}" data-st-view aria-labelledby="vn-dec-h" style="--c:var(--st-accent)">
            <div class="st-tile-head"><span class="st-cat">Decision</span><button type="button" class="st-link st-why" onclick="NXT.openReview()">Why<span aria-hidden="true">›</span></button></div>
            <h2 class="st-h3" id="vn-dec-h">${esc(r.title)}</h2>
            ${support?`<p class="st-body st-mt2">${esc(support)}</p>`:''}
            ${decEvidenceHTML(trendEv,confEv,plateau)}
            ${N.proposalRowHTML()}
          </section>
          ${bodyTileHTML()}
        </div>
      </div>

      <nav class="vn-pad st-quick" aria-label="Quick actions">
        <button type="button" class="st-qa" style="--c:var(--st-weight)" onclick="apx95OpenQuickWeight()"><span aria-hidden="true">+</span>Weight</button>
        ${state.dayType==='Zone2'?'':`<button type="button" class="st-qa" style="--c:var(--st-cardio)" onclick="showCardioSheet()"><span aria-hidden="true">+</span>Cardio</button>`}
        <button type="button" class="st-qa" style="--c:var(--st-rest)" onclick="apx96OpenReadiness()"><span aria-hidden="true">+</span>Check-in</button>
      </nav>

      <details class="vn-more vn-pad st-more">
        <summary>More for today</summary>
        <div class="vn-more-body">
          ${recoveryHomeCard()}
          <button type="button" class="nxp-home-kcal" onclick="NXT.openCalories()"><span><small>Calorie guide</small><strong>${cal?formatNumber(cal)+' <em>kcal</em>':'Set target'}</strong></span><span>${cal?'Edit':'Set up'}</span></button>
          ${N.adherenceHTML()}
        </div>
      </details>
    </div>`;
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
  function heroTileHTML() {
    const rows=N.weights();
    if(!rows.length)return `<article class="st-tile st-hero is-empty" style="--c:var(--st-weight)"><span class="st-cat">Weight</span><h2 class="st-h3 st-mt2">Your first weigh-in starts the trend</h2><p class="st-body st-mt2">Morning readings appear as dots; the trend line starts once a week has three of them.</p><button type="button" class="st-cta" onclick="apx95OpenQuickWeight()">Log morning weight<span aria-hidden="true">›</span></button></article>`;
    const start=N.dateAdd(state.date,-29);
    const series=N.trend(rows).filter(p=>p.date>=start&&p.date<=state.date);
    const pts=series.map(p=>({d:p.date,w:Math.round(p.weight*100)/100,a:p.avg===null?null:Math.round(p.avg*1000)/1000,t:/^morning$/i.test(String(p.timeOfDay||''))?'m':'o'}));
    const lastAvg=[...series].reverse().find(p=>p.avg!==null);
    const firstAvg=series.find(p=>p.avg!==null);
    const plateau=N.detectPlateau(rows),rate=N.finite(plateau&&plateau.weeklyRate);
    const main=lastAvg?lastAvg.avg:rows.at(-1).weight;
    const change=lastAvg&&firstAvg&&lastAvg!==firstAvg?lastAvg.avg-firstAvg.avg:null;
    const span=lastAvg&&firstAvg?Math.round((N.dateMs(lastAvg.date)-N.dateMs(firstAvg.date))/86400000):0;
    const data=esc(JSON.stringify({pts,today:state.date}));
    return `<article class="st-tile st-hero" style="--c:var(--st-weight)" data-st-hero="${data}">
      <div class="st-hero-top">
        <span class="st-cat">Weight trend</span>
        <button type="button" class="st-replay" data-st-replay aria-label="Replay the last 30 days"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.8v10.4L13 8z" fill="currentColor"/></svg><span>Replay</span></button>
      </div>
      <p class="st-hero-eb" data-st-eb>${lastAvg?'Trend · '+esc(N.shortDate(lastAvg.date)):'Latest reading · '+esc(N.shortDate(rows.at(-1).date))}</p>
      <div class="st-big"><span class="st-odo" data-st-odo="${main.toFixed(1)}">${main.toFixed(1)}</span><small>kg</small></div>
      <div class="st-hero-meta" data-st-meta>
        ${change!==null?`<span class="st-pill${change<=0?'':' is-up'}">${change>0?'+':'−'}${Math.abs(change).toFixed(1)} kg</span><span>over ${span} days</span>`:'<span>Trend building</span>'}
        ${rate!==null&&plateau.ok?`<span class="st-rate"><b class="vn-num">${N.signed(rate)}</b> kg/wk</span>`:''}
      </div>
      <div class="st-hero-chart" data-st-chart role="img" aria-label="Morning weight and trend, last 30 days. Drag to inspect a day."></div>
      <div class="st-hero-foot">
        <span class="st-key"><i class="st-key-line"></i>Trend</span><span class="st-key"><i class="st-key-dot"></i>Morning</span>
        <button type="button" class="st-link" onclick="NXT.ui.view='overview';switchTab('weight')">Progress<span aria-hidden="true">›</span></button>
      </div>
    </article>`;
  }
  /* Compact weight: the canonical 7-day trend and the engine's weekly rate.
     The chart itself lives on Progress. */
  function decEvidenceHTML(trendEv,confEv,plateau) {
    const rate=N.finite(plateau&&plateau.weeklyRate);
    const dir=rate===null?'flat':rate<-0.05?'down':rate>0.05?'up':'flat';
    const pts=N.trend(N.weights()).filter(p=>p.avg!==null).slice(-21).map(p=>p.avg);
    let spark='';
    if(pts.length>=4){
      const lo=Math.min(...pts),hi=Math.max(...pts),span=(hi-lo)||1,W=64,H=24,pad=3;
      const xy=pts.map((v,i)=>[(i/(pts.length-1))*(W-pad*2)+pad,H-pad-((v-lo)/span)*(H-pad*2)]);
      const d=xy.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
      const e=xy[xy.length-1];
      spark=`<svg class="st-dec-spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false"><path class="st-dec-line" pathLength="1" d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle class="st-dec-dot" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="2.4" fill="currentColor"/></svg>`;
    }
    const arrow={down:'M12 5v13M6.5 12.5 12 18l5.5-5.5',up:'M12 19V6M6.5 11.5 12 6l5.5 5.5',flat:'M5 12h14'}[dir];
    const lvl={low:1,medium:2,high:3}[String(confEv).toLowerCase()]||0;
    const bars=lvl?`<span class="st-dec-bars" aria-hidden="true">${[1,2,3].map(i=>`<i class="${i<=lvl?'on':''}"></i>`).join('')}</span>`:'';
    return `<div class="st-dec-ev">
      <button type="button" class="st-dec-chip st-dec-trend is-${dir}" onclick="NXT.ui.view='overview';switchTab('weight')" aria-label="Open your weight trend"><span class="st-dec-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${arrow}"/></svg></span><span class="st-dec-txt"><small>Trend</small><b class="vn-num st-dec-val">${esc(trendEv)}</b></span>${spark}</button>
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
      <span class="st-meta">${rate!==null&&pl.ok?`${N.signed(rate)}/wk`:'7-day trend'}</span>
    </button>`;
  }
  function weeklyTileHTML() {
    const rows=N.weights();if(!rows.length)return '';
    const ws=N.weekStart(state.date),weeks=[];
    for(let i=4;i>=0;i--){
      const st=N.dateAdd(ws,-7*i),end=i===0?state.date:N.dateAdd(st,6);
      const s=N.windowStats(rows,end,i===0?Math.round((N.dateMs(state.date)-N.dateMs(st))/86400000)+1:7);
      weeks.push({st,avg:s.avg,n:s.n,part:i===0});
    }
    const have=weeks.filter(w=>w.avg!==null);if(have.length<2)return '';
    const lo=Math.min(...have.map(w=>w.avg))-.6,hi=Math.max(...have.map(w=>w.avg))+.2;
    const cur=weeks.at(-1),prev=weeks.at(-2);
    const d=cur.avg!==null&&prev.avg!==null?cur.avg-prev.avg:null;
    return `<button type="button" class="st-tile st-t-avg" style="--c:var(--st-weight)" onclick="NXT.ui.view='overview';switchTab('weight')">
      <div class="st-tile-head"><span class="st-cat">Weekly average</span>${d!==null?`<span class="st-pill${d<=0?'':' is-up'}">${d>0?'+':'−'}${Math.abs(d).toFixed(1)} kg</span>`:''}</div>
      <div class="st-bars" role="img" aria-label="${esc(have.map(w=>N.shortDate(w.st)+' '+w.avg.toFixed(1)+' kilograms').join(', '))}">
        ${weeks.map((w,i)=>`<span class="st-bar${i===weeks.length-1?' is-now':''}" style="--h:${w.avg===null?0:Math.max(.08,(w.avg-lo)/(hi-lo)).toFixed(3)};--i:${i}"><b class="vn-num">${w.avg===null?'—':w.avg.toFixed(1)}</b><i></i><small>${esc(N.shortDate(w.st))}${w.part?` · ${w.n}d`:''}</small></span>`).join('')}
      </div>
      <p class="st-meta">Morning weight, averaged Monday to Sunday${cur.part?' · this week so far':''}</p>
    </button>`;
  }
  function calendarTileHTML() {
    const work=new Set(N.workRows().map(r=>r.date));
    const cardio=new Set((state.cardio||[]).filter(r=>r&&r.date).map(r=>r.date));
    const floor=new Set((state.floorball||[]).filter(r=>r&&r.date).map(r=>r.date));
    const weigh=new Set(N.weights().map(r=>r.date));
    const end=N.dateAdd(N.weekStart(state.date),6),start=N.dateAdd(end,-34);
    const dows=['M','T','W','T','F','S','S'];
    let cells='';
    for(let i=0;i<35;i++){
      const d=N.dateAdd(start,i),fut=d>state.date,dn=Number(d.slice(8,10));
      const marks=(work.has(d)?'<i class="m-lift"></i>':'')+(cardio.has(d)?'<i class="m-cardio"></i>':'');
      const any=work.has(d)||cardio.has(d);
      cells+=`<span class="st-cal-d${fut?' is-fut':''}${d===state.date?' is-today':''}${any?' is-active':''}${weigh.has(d)?' is-w':''}" style="--i:${i}"><em>${dn===1?esc(N.shortDate(d)):dn}</em><span class="st-cal-m">${marks}</span></span>`;
    }
    const n=[...work].filter(d=>d>=start&&d<=state.date).length;
    return `<button type="button" class="st-tile st-t-cal" style="--c:var(--st-cardio)" onclick="switchTab('history')">
      <div class="st-tile-head"><span class="st-cat">Last 5 weeks</span><span class="st-meta">${n} lifting ${n===1?'day':'days'}</span></div>
      <div class="st-cal">${dows.map(x=>`<span class="st-cal-h">${x}</span>`).join('')}${cells}</div>
      <div class="st-cal-k"><span><i class="m-lift"></i>Lifting</span><span><i class="m-cardio"></i>Cardio</span><span><i class="m-w"></i>Weigh-in</span></div>
    </button>`;
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
  /* Strength-day overview before entering focused mode. Session data is
     untouched — leave/enter only toggles presentation (D6). */
  /* ---- Anatomy, two ways -------------------------------------------------
     Lens: a zoom onto the worked region of one exercise, ringed by that
     exercise's set progress. Map: front and back of the whole session, so the
     day's focus is readable at a glance. Both reuse NXTANAT; muscles are
     always named in text beside them. */
  function bleedHTML(name){
    if(typeof NXTLIB==='undefined'||typeof NXTANAT==='undefined')return '';
    const m=NXTLIB.musclesFor(name);if(!m.primary.length)return '';
    const view=NXTANAT.viewFor(m.primary,[]);
    /* Widen the engine's tight crop so the muscle reads in context. */
    const fig=NXTANAT.figure({primary:m.primary,secondary:m.secondary,view}).replace(/viewBox="([\d.\-]+) ([\d.\-]+) ([\d.]+) ([\d.]+)"/,(s,x,y,w,h)=>{x=+x;y=+y;w=+w;h=+h;const px=w*.3,py=h*.2;return `viewBox="${(x-px).toFixed(0)} ${Math.max(0,y-py).toFixed(0)} ${(w+2*px).toFixed(0)} ${(h+2*py).toFixed(0)}"`;});
    return `<span class="st-bleed" aria-hidden="true">${fig}</span>`;
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
          <h2 class="st-h2 st-mt2">${list.length} exercises</h2>
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
    return `<p class="st-meta st-mt2">${working.length} working sets · ${Object.keys(byEx).length} exercises</p>
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
        <button type="button" class="st-row-btn" onclick="NXP.queue()"><span>Workout queue</span><small>${list.length} exercises</small><i aria-hidden="true">›</i></button>
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
    const coach=N.coachFor(ex),tg=n=>esc(trimNum(n));
    const pillTxt=(()=>{if(!coach)return '';
      if(coach.kind==='load'&&prev)return `+${tg(coach.weight-Number(prev.weight))} kg`;
      return ({rep:'+1 rep',reentry:'Ease in',stall:'Stalled',tired:'Easy day',rebuild:'Rebuild',hold:'Hold',new:'Baseline',baseline:'Baseline'})[coach.kind]||'';})();
    const coachHTML=coach?`<section class="st-coach is-${coach.kind}${exMove?' is-enter':''}" aria-label="Coach">
          <div class="st-coach-top">
            <span class="st-coach-ico" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M10 2.4l1.8 5.3 5.3 1.8-5.3 1.8L10 16.6l-1.8-5.3L2.9 9.5l5.3-1.8z"/></svg></span>
            <div class="st-coach-tt"><p class="st-coach-k">Coach</p><h3 class="st-coach-h">${esc(coach.headline)}</h3></div>
            ${pillTxt?`<span class="st-coach-pill">${esc(pillTxt)}</span>`:''}
          </div>
          <p class="st-coach-n">${esc(coach.note)}</p>
          ${coach.sets&&coach.sets.length?`<div class="st-coach-sets" role="group" aria-label="Target for each set">${coach.sets.map((x,k)=>`<button type="button" class="st-cs${setType==='working'&&k===done?' is-now':''}${k<done?' is-done':''}" onclick="NXP.useTarget(${k})" aria-label="Set ${x.n}: ${tg(x.weight)} kilograms for ${x.reps} reps. Tap to fill"><small>Set ${x.n}</small><b class="vn-num">${tg(x.weight)} × ${x.reps}</b></button>`).join('')}</div>`:''}
        </section>`:'';
    const restPct=restLeft&&(ui.restTotal||restPlan)?Math.max(0,Math.min(100,restLeft/(ui.restTotal||restPlan)*100)):0;
    /* Set chips: warm-ups, then one chip per planned working set (extras are
       appended). Logged chips open the same edit sheet as before. */
    const freshId=justLogged&&loggedEntry&&loggedEntry.exercise===ex?loggedEntry.id:null;
    const dots=Array.from({length:Number(t.sets)},(_,k)=>`<i class="${k<done?'is-done':k===done?'is-now':''}"></i>`).join('');
    const setNo=setType==='warmup'?'Warm-up':(done>=Number(t.sets)?`Extra set`:`Set ${done+1}`);
    const setOf=setType==='warmup'||done>=Number(t.sets)?'':`of ${t.sets}`;
    /* Logged sets for this exercise, as small chips inside the card. Each
       compares with the best set last time (D20). Tap to edit. */
    const chips=current.map((r,i)=>{
      const c=cmpBest(r),warm=r.setType==='warmup';
      return `<button type="button" class="st-chip2${warm?' is-warm':''}${c==='up'?' is-up':''}${r.id===freshId?' is-fresh':''}" onclick="NXP.editCurrentSet(${i})" aria-label="Edit ${warm?'warm-up':'set '+r.setNum}: ${esc(trimNum(r.weight))} kilograms for ${esc(r.reps)}${c==='up'?', beat last time':c==='eq'?', matched last time':''}"><span>${warm?'W':r.setNum}</span>${esc(trimNum(r.weight))}×${esc(r.reps)}${c==='up'?'<i aria-hidden="true">↑</i>':''}</button>`;
    }).join('');
    const form=`<form id="nxp-set-form" class="st-card" onsubmit="event.preventDefault();NXP.logSet()">
        <div class="st-card-head">
          <p class="st-card-t"><b>${esc(setNo)}</b>${setOf?` <span>${esc(setOf)}</span>`:''}</p>
          <fieldset class="nxp-seg-block nxp-seg-type">
            <legend class="st-sr">Set type</legend>
            <div class="nxp-seg" role="group">${[['working','Working'],['warmup','Warm-up']].map(([v,l])=>`<button type="button" class="${setType===v?'is-on':''}" aria-pressed="${setType===v}" onclick="NXP.setSetType('${v}')">${l}</button>`).join('')}</div>
          </fieldset>
        </div>
        <div class="st-dots" role="img" aria-label="${done} of ${t.sets} working sets logged">${dots}</div>
        ${chips?`<div class="st-chips" aria-label="Logged sets">${chips}</div>`:''}
        <div class="st-entry">
          ${stepper('weightInput','kg','',`<input id="weightInput" type="number" min="0" max="1000" step="0.1" inputmode="decimal" enterkeyhint="done" autocomplete="off" required placeholder="${esc(trimNum(aim?aim.weight:prev?prev.weight:0))}" value="${esc(weight)}" aria-labelledby="weightInput-label" oninput="NXP.rememberInput(this)">`,trimNum(t.inc||2.5),`weight by ${trimNum(t.inc||2.5)} kilograms`)}
          <span class="st-x" aria-hidden="true">×</span>
          ${stepper('repsInput','reps','',`<input id="repsInput" type="number" min="1" max="100" step="1" inputmode="numeric" enterkeyhint="done" autocomplete="off" required placeholder="${aim?aim.reps:prev?prev.reps:t.reps[0]}" value="${esc(draft.repsInput??'')}" aria-labelledby="repsInput-label" oninput="NXP.rememberInput(this)">`,'1','reps by one')}
        </div>
        <div class="st-refs">
          ${aim?`<button type="button" class="st-refc is-aim" onclick="NXP.useAim()" aria-label="Aim ${esc(trimNum(aim.weight))} kilograms for ${aim.reps}. Tap to fill">
            <small>Aim <em>Tap to fill</em></small><b class="vn-num">${esc(trimNum(aim.weight))} × ${esc(aim.reps)}</b><span>${esc(aimText)}</span></button>`
          :`<div class="st-refc is-aim"><small>Aim</small><b class="vn-num">${t.reps[0]}–${t.reps[1]} reps</b><span>Set a baseline</span></div>`}
          <div class="st-refc"${prev?` data-w="${esc(prev.weight)}" data-r="${esc(prev.reps)}"`:''}><small>Best last time</small><b class="vn-num">${prev?`${esc(trimNum(prev.weight))} × ${esc(prev.reps)}`:'—'}</b><span>${previous?esc(N.shortDate(previous.date)):'No history yet'}</span></div>
        </div>
        ${coachHTML}
        <input type="hidden" id="n99-set-type" value="${setType}">
        <input type="hidden" id="n99-rir" value="${esc(rir)}">
        <button id="nxp-log-button" type="submit" class="n99-button nxp-train-cta st-log" data-idle-label="${esc(idleLabel)}">${justLogged?`<span class="nxp-cta-check" aria-hidden="true">✓</span>${esc(confirmLabel)}`:esc(idleLabel)}</button>
      </form>`;

    page.innerHTML=`<div class="${outer} st-train-active${justLogged?' is-just-logged':''}${focused?' is-mode':''}${allDone?' is-all-done':''}">
      <header class="st-tbar">
        <button type="button" class="st-icon" onclick="NXP.leaveTrain()" aria-label="Leave workout"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg></button>
        <div class="st-tbar-mid">
          <p class="st-tbar-t">${esc(N.label(state.dayType))}</p>
          <p class="st-tbar-s"><b class="vn-num">${count}</b> of ${total} sets</p>
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
        <div><b>All ${total} sets logged</b><span>Finish to save the session</span></div>
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

      ${!addOnActive()&&sessionDiffers()?`<button type="button" class="st-diff" onclick="NXP.saveTodayToRoutine()"><span><b>Changed for today only</b><small>Save this order and these exercises to your ${esc(N.label(state.dayType))} routine</small></span><em>Save</em></button>`:''}

      <aside class="nxp-rest st-rest${restLeft?' is-active':''}" aria-label="Rest timer"${restLeft?' role="timer"':''} ${restLeft?'':'hidden'} style="--pct:${restPct.toFixed(1)}">
        <span class="st-rest-l"><small>Rest</small><b id="apx96TimerValue" class="vn-num">${restLeft?apx96FormatTimer(restLeft):'Ready'}</b></span>
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
        ${row('gear','Session options','Shorter session, notes, check-in','NXP.sessionMenu()')}
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
    const c=N.coachFor(state.exercise),s=c&&c.sets&&c.sets[k];if(!s)return;
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
    /* Swap opens the sheet the mode bar already uses. That sheet writes
       today's session plan only, then closeModal returns to Train, which
       render() has repainted with the replacement. Cancel returns to Train
       on the same exercise. History and the base programme are not touched. */
    N.modal(ex,`<div class="nxp-detail">
      ${anat}${muscleBlock}
      <div class="nxp-detail-facts">${facts}</div>
      ${note?`<section class="nxp-detail-block"><h3>Equipment note</h3><p>${esc(note)}</p></section>`:''}
      <section class="nxp-detail-block"><h3>${esc(cue.label)}</h3><p>${esc(cue.text)}</p></section>
      <section class="nxp-detail-block"><h3>Recent sessions</h3>${history}</section>
      ${button(note?'Edit equipment note':'Add equipment note','NXP.equipmentNote()',true)}
      <button type="button" class="nxp-detail-swap" onclick="showSubstituteSheet()">Swap exercise</button>
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
  /* "Down so far": the same facts the Cut journey card uses (start weight, current
     trend, goal range), brought to the top. Only when a goal is confirmed. */
  function downSoFarHTML(){
    if(!N.cfg().targetConfirmed)return '';
    const rows=N.weights(),start=N.finite(typeof START_WEIGHT!=='undefined'?START_WEIGHT:null);
    const seed=start!==null?start:(rows[0]?rows[0].weight:null);
    const pl=N.detectPlateau(rows),cur=N.finite(pl.lastAvg)!==null?pl.lastAvg:(rows.at(-1)?rows.at(-1).weight:null);
    const hi=typeof goalHigh==='function'?Number(goalHigh()):NaN;
    if(seed===null||cur===null||!Number.isFinite(hi))return '';
    const done=seed-cur,remain=Math.max(0,cur-hi);
    if(done<=0)return '';
    return `<p class="st-down"><b class="vn-num">${done.toFixed(1)} kg</b> down${remain>0?` · <b class="vn-num">${remain.toFixed(1)} kg</b> to your goal range`:' · in your goal range'}</p>`;
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
    const period=r===14?'Last 2 weeks':r===30?'Last month':r===90?'Last 3 months':'All recorded weigh-ins';
    const tabs=`<div class="n99-progress-tabs nxp-progress-tabs vn-progress-tabs" role="group" aria-label="Progress view">${[['overview','Weight'],['strength','Performance'],['body','Body']].map(([key,title])=>`<button type="button" class="${v===key?'active':''}" aria-pressed="${v===key}" onclick="NXT.setView('${key}')">${title}</button>`).join('')}</div>`;
    const chrome=`<header class="nxp-heading nxp-progress-chrome vn-progress-chrome"><div><h1>Progress</h1><p>${esc(period)}</p></div>${button('+ Weight','apx95OpenQuickWeight()',true)}</header>`;
    if(v==='body'){
      const waist=N.cleanRows(N.cfg().waist,'cm'),scans=bodyScanSource();
      document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress nxp-progress-body"><header class="nxp-heading nxp-progress-chrome"><div><h1>Progress</h1><p>${esc(bodyTitle(waist,scans))}</p></div>${button('+ Weight','apx95OpenQuickWeight()',true)}</header>${tabs}${bodySummary(waist,scans)}${compMapHTML(scans)}${bodyView(waist,scans)}</div>`;
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
    document.getElementById('weightPage').innerHTML=`<div class="n99 nxp nxp-progress nxp-progress-weight vn-progress">${chrome}${tabs}${withGoalDate(N.chartHTML()).replace('<div class="vn-mhead"',downSoFarHTML()+weightHighlightsHTML()+slowWeekHTML()+'<div class="vn-mhead"')}<details class="nxp-progress-tdee nxp-disclosure vn-more-block"><summary>Energy estimate</summary>${N.tdeeCardHTML()}</details>${N.calorieTargetHTML()}<button type="button" class="vn-row vn-weighins" onclick="NXT.openWeightHistory()"><span class="vn-row-l"><span class="vn-row-t">All weigh-ins</span><span class="vn-row-s">${N.weights().length} readings</span></span><span class="vn-chev">›</span></button></div>`;
  }
  function syncLatestControl() {
    const btn=document.getElementById('nxp-progress-latest');
    if(!btn)return;
    const pts=N.ui.chart?.points||[];
    const last=pts.at(-1);
    const away=!!(last&&N.ui.selected&&N.ui.selected!==last.date);
    btn.hidden=!away;
  }
  function arrangeWeightView() {
    /* Retired for 2C: chartHTML owns the Weight surface. Kept as a no-op so
       any stray caller does not throw. */
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
  function performanceMeta(item) {
    const bits=[item.gym,item.sessions===1?'1 session':item.sessions+' sessions'];
    if(item.latestDate)bits.push(N.shortDate(item.latestDate));
    const last=item.history.at(-1),set=last?.sets?.at(-1);
    const load=set?N.finite(set.weight):null,reps=set?N.finite(set.reps):null;
    if(load!==null&&reps!==null&&reps>0)bits.push(fmtLoad(load)+' kg × '+reps);
    if(item.latestE1rm)bits.push('Est. 1RM '+fmtLoad(item.latestE1rm));
    return bits.join(' · ');
  }
  function performanceRow(item, i) {
    const flag=statusFlag(item.status);
    const delta=deltaText(item);
    const model=sparkModel(item.history);
    const title=item.name+' at '+item.gym+', estimated 1RM';
    const eq=model?sparkText(item, model):item.name+' at '+item.gym+'. No sessions to plot.';
    const lineTone=item.tone==='good'?'is-good':item.tone==='watch'?'is-watch':'is-neutral';
    const lastPt=model?.points.at(-1);
    const plot=model?`<div class="vn-perf-plot"><svg class="n99-spark vn-perf-spark" viewBox="0 0 110 40" role="img" aria-label="${esc(title)}" aria-labelledby="vn-perf-t-${i}" aria-describedby="vn-perf-eq-${i}" data-min="${model.min}" data-max="${model.max}"><title id="vn-perf-t-${i}">${esc(title)}</title><line class="vn-perf-grid" x1="4" y1="21" x2="106" y2="21"/><path class="vn-perf-line ${lineTone} ${flag}" d="${model.d}" fill="none"/>${lastPt?endMark(lastPt, item.status):''}</svg><p class="vn-perf-eq" id="vn-perf-eq-${i}">${esc(eq)}</p></div>`:'';
    return `<li class="vn-perf-row" data-status="${esc(item.status)}" data-gym="${esc(item.gym)}" data-e1rm="${Number(item.latestE1rm)||0}"><div class="vn-perf-main"><h3 class="vn-perf-name">${esc(item.name)}</h3><p class="vn-perf-meta">${esc(performanceMeta(item))}</p><p class="vn-perf-statusline"><span class="vn-perf-flag ${flag}">${esc(item.status)}<i aria-hidden="true"></i></span>${delta?`<span class="vn-perf-delta">${esc(delta)}</span>`:''}</p><p class="vn-perf-read">${esc(statusRead(item.status))}</p></div>${plot}</li>`;
  }
  function performanceSubtitle(items) {
    const last=items.map(x=>x.latestDate).filter(Boolean).sort().at(-1);
    if(!items.length)return 'No lifting history yet';
    if(items.every(x=>x.status==='Older history'))return 'Too old to compare';
    if(items.every(x=>x.status==='Building data'))return 'Not enough yet';
    return last?'Last lift '+N.shortDate(last):items.length+' exercises tracked';
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
  function performanceView(items) {
    const note=`<p class="vn-perf-note">${esc(PERF_NOTE)}</p>`;
    if(!items.length)return `<section class="vn-perf">${performanceSummary(items)}${note}</section>`;
    return `<section class="vn-perf" aria-label="Exercise comparisons">${performanceSummary(items)}<ol class="vn-perf-rows">${items.map(performanceRow).join('')}</ol>${note}</section>`;
  }
  function arrangeStrengthView() {
    /* 2G paints the comparison list in performanceView(). The V99 cards this
       used to reorder are no longer injected. Kept so a stray caller does not throw. */
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
      <div class="st-tile-head"><span class="st-cat">Composition map</span><span class="st-meta">${pts.length} scans</span></div>
      <p class="st-meta">Where each scan sits on fat mass and muscle mass</p>
      <div class="st-cm" data-st-cmap="${esc(JSON.stringify(pts))}" role="img" aria-label="${esc(pts.map(p=>N.shortDate(p.d)+': fat mass '+p.f+' kilograms, muscle mass '+p.m).join('; '))}"></div>
      <p class="st-cm-read"><b>${esc(N.shortDate(A.d))} → ${esc(N.shortDate(B.d))}</b> · <span style="color:var(--st-fat)">${sg(df)} kg fat mass</span> · <span style="color:var(--st-lean)">${sg(dm)} kg muscle mass</span></p>
      <p class="st-meta st-mt2">Left means less fat mass, up means more muscle mass. Scan estimates move with hydration, so small steps between neighbouring scans are within normal variation.</p>
    </section>`;
  }
  function bodyView(waist,scans) {
    const waistRows=waist.slice().reverse().map(r=>`<button type="button" class="n99-list-row nxp-progress-body-row" onclick="NXT.openWaist('${r.date}')"><span>${esc(N.shortDate(r.date))}</span><b>${r.cm.toFixed(1)} cm</b><span>Edit ›</span></button>`).join('');
    return `<section class="nxp-progress-body-section"><h2 class="nxp-caption nxp-progress-body-heading">All readings</h2>${waist.length?waistRows:`<p class="nxp-progress-body-empty">No waist measurements yet. Optional, about once a week, with the same tape position.</p>`}${row('Log waist','+',"NXT.openWaist()",'Same position and similar conditions')}</section><section class="nxp-progress-body-section"><h2 class="nxp-caption nxp-progress-body-heading">Evo scans</h2>${bodyScanAnalysis(scans)}${row('New scan','Add','NXP.openBodyCapture()','Review and save in Settings')}${row('Import from Strata','Paste','NXT.importScans()','Bring in scans exported from Strata as CSV')}</section><p class="n99-small nxp-progress-body-note">Body fat and muscle figures only appear from saved Evo scans. They are not calculated from waist or scale weight.</p>`;
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
  function setRow(title,value,action,sub='',tone='') {
    return `<button type="button" class="vn-set-row" onclick="${esc(action)}">`
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
      return `<button type="button" class="st-rt" onclick="NXP.editRoutine('${ty}')"><span class="st-rt-l"><b>${esc(N.label(ty))}</b><small>${rows.length} exercises · ${sets} sets${days.length?' · '+days.join(', '):''}</small><span class="st-rt-p">${esc(rows.slice(0,3).map(e=>e.name).join(' · '))}${rows.length>3?' …':''}</span></span><i aria-hidden="true">›</i></button>`;};
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
    N.modal(DAY_LONG[d],`<div class="st-mgroup">${N.typeNames().map(ty=>`<button type="button" class="st-mrow st-pick${ty===cur?' is-on':''}" onclick="NXP.setDay(${d},'${ty}')"><span class="st-mrow-l"><b>${esc(N.label(ty))}</b>${NON_LIFT.includes(ty)?'':`<small>${N.templateFor(ty,routineGym()).length} exercises</small>`}</span><i aria-hidden="true">${ty===cur?'✓':''}</i></button>`).join('')}</div>`);
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
        <h1>${esc(N.label(r.type))}</h1><p>${esc(r.gym)} · ${r.rows.length} exercises · ${sets} sets${days.length?' · '+days.join(', '):''}</p></header>
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
        ${step('hi','Max reps',e.reps[1],'Hit this on every set to earn the next load')}
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
        setRow('Goals & calories',c.calories?formatNumber(c.calories)+' kcal':'Set up',"NXT.more('goals')",c.targetConfirmed?goalLow()+'–'+goalHigh()+' kg range':'Calorie guide and optional goal range')
        +setRow('Training',lifts+(lifts===1?' lifting day':' lifting days'),"NXT.more('training')",'Weekly plan, saved workouts and gyms')
        +setRow('Cardio & recovery',(Number(settings.zone2WeeklyTarget)||90)+' min / week',"NXT.more('coach')",'Weekly minutes and recovery check-ins'))}
      ${setGroup('Preferences',
        setRow('Your name',userName()||'Not set',"NXP.nameSheet()",'Used in the greeting on Today')
        +setRow('Appearance',look,"NXT.more('appearance')",'Text size and motion')
        +setRow('Reminders',state.notifs?.enabled?'On':'Off',"NXT.more('notifications')",'Weigh-in, cardio and backup prompts'))}
      ${setGroup('Body',
        setRow('Body & scans',waist?waist+(waist===1?' waist entry':' waist entries'):'None yet',"NXT.more('body')",'Evo scans and measurements'))}
      ${setGroup('Data',
        setRow('Cloud & sync',cloud.word,"NXT.more('data')",cloud.sub,cloud.tone)
        +(()=>{const st=storageStatus();return st?setRow('Storage',st.used,"NXT.more('data')",st.sub,st.tone):'';})()
        +setRow('Wearable',wearableConnectionLabel(),'NXP.openWearableConnection()','Connection stays off until a secure backend exists'))}
      ${setGroup('About',
        setRow('App & install','',"NXT.more('app')",'Install, build version and safe reset')
        +setRow('Classic app','Backup',"location.href='classic/'",'The previous design, using the same data'))}
      ${cloudUser?`<div class="vn-set-account-out"><button type="button" class="vn-set-text" onclick="cloudSignOut()">Sign out</button></div>`:''}
      <p class="vn-set-foot">NXTFRM · your next form</p>`,'vn-settings');
  }
  function moreAccount() {
    const signed=!!cloudUser;
    const configured=!!((localStorage.getItem('apm_sb_url')||'').trim()&&(localStorage.getItem('apm_sb_key')||'').trim());
    const title=signed?(cloudUser.email||'Signed in'):configured?'Sign-in needed':'Local-only';
    const detail=[state.gym||null,signed?'Cloud session on this device':'Stored on this device'].filter(Boolean).join(' · ');
    return `<section class="vn-set-account"><span class="vn-set-eyebrow">Account</span><h2>${esc(title)}</h2><p>${esc(detail)}</p></section>`;
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
      </form>`,'vn-settings');
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
        <p class="vn-set-body">Export workouts, weigh-ins, settings and check-ins stored in this browser. Wearable evidence in the on-device wearable store is not included; it remains on this device until you reset the app, and can be rebuilt by a later provider sync.</p>
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
    const bw=bwForDate(date);
    return {logs,cardio:cardioForDate(date),floorball:(state.floorball||[]).filter(r=>r&&r.date===date),bw:bw&&historyNum(bw.weight)?bw:null};
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
      const label=new Date(`${key}T12:00:00`).toLocaleDateString('en-SG',{day:'numeric',month:'long'})+(kinds.length?`, ${kinds.join(', ')}`:', no records');
      cells.push(`<button type="button" class="${cls.join(' ')}" data-date="${key}" data-k="${kind}"${second?` data-k2="${second}"`:''} style="--i:${i}" aria-label="${esc(label)}" aria-pressed="${key===selected?'true':'false'}"${key===today?' aria-current="date"':''} onclick="NXP.historySelect('${key}')"><b${d===1?' class="is-m1"':''}>${d===1?d+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]:d}</b><span class="nxp-cal-marks" aria-hidden="true">${historyMarkHTML(marks)}</span></button>`);
    }
    return `<section class="nxp-history-calendar vn-hist-calendar" id="vn-hist-calendar"><div class="nxp-cal-head" id="vn-hist-calhead"><h2 class="nxp-cal-month" aria-label="${esc(title)}"><span>${esc(monthName)}</span> <em>${yearNum}</em></h2><div class="nxp-cal-nav"><button type="button" aria-label="Previous month" onclick="NXP.historyShiftMonth(-1)">‹</button><button type="button" class="nxp-cal-today" aria-label="Jump to current month" onclick="NXP.historyThisMonth()">Today</button><button type="button" aria-label="Next month" onclick="NXP.historyShiftMonth(1)">›</button></div></div><div class="nxp-cal-weekdays" aria-hidden="true">${['M','T','W','T','F','S','S'].map(x=>`<span>${x}</span>`).join('')}</div><div class="nxp-cal-grid" id="vn-hist-grid">${cells.join('')}</div><p class="nxp-cal-legend st-cal-stats" aria-label="This month">${scope.lift?`<span class="lift${counts.lift?'':' is-zero'}"><i></i>Lifting<b>${counts.lift}</b></span>`:''}${scope.cond?`<span class="cond${counts.cardio?'':' is-zero'}"><i></i>Cardio<b>${counts.cardio}</b></span>`:''}${scope.body?`<span class="body${counts.body?'':' is-zero'}"><i></i>Weigh-in<b>${counts.body}</b></span>`:''}</p></section>`;
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
  function historyWeightBlock(bw) {
    return `<div class="nxp-history-block vn-hist-block" data-kind="weight"><span class="nxp-history-block-label">Weight</span><div class="nxp-history-ex"><b>${esc(historyNum(bw.weight))} kg</b>${bw.timeOfDay?`<span>${esc(bw.timeOfDay)}</span>`:''}</div></div>`;
  }
  /* Audit lanes. The intervention lane reads the calorie ledger (D47): a target
     change on this date, with its source. Event and annotation lanes stay
     structural until a record kind exists for them. */
  function historyAuditLanes(date) {
    const changes=typeof N.calorieChanges==='function'?N.calorieChanges().filter(x=>x.date===date):[];
    const src={proposal:'Proposal applied',manual:'Set in calorie guide'};
    const lane=changes.length?`<section class="vn-hist-lane nxp-history-block vn-hist-block st-hist-int" data-lane="intervention" data-kind="intervention"><span class="nxp-history-block-label">Intervention</span>${changes.map(x=>`<div class="nxp-history-ex" data-kind="intervention"><b>Calorie target${x.from===null?' set':''}</b><span class="vn-num">${x.from===null?'':formatNumber(x.from)+' → '}${formatNumber(x.to)} kcal</span></div><p class="nxp-history-meta">${esc(src[x.source]||x.source)}${x.reason?' · '+esc(x.reason):''}</p>`).join('')}</section>`:`<section class="vn-hist-lane" data-lane="intervention" hidden></section>`;
    return `<div class="vn-hist-audit" aria-label="Day audit trail">
      <section class="vn-hist-lane" data-lane="event" hidden></section>
      ${lane}
      <section class="vn-hist-lane" data-lane="annotation" hidden></section>
    </div>`;
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
    /* A weigh-in-only day: the weight block below already says it, so the
       summary line would just repeat "82 kg". */
    if(parts.length===1&&scope.body&&r.bw&&!(scope.lift&&r.logs.length)&&!(scope.cond&&(r.cardio.length||r.floorball.length)))parts.length=0;
    const emptyCopy=filter==='strength'?'No lifting logged on this date.':filter==='conditioning'?'No cardio logged on this date.':filter==='body'?'No weigh-in recorded on this date.':'No training or measurements logged.';
    return `<section class="nxp-history-selected vn-hist-day"><header class="nxp-history-selected-head"><h2>${esc(when.toLocaleDateString('en-SG',{weekday:'short'}))} ${esc(when.toLocaleDateString('en-SG',{day:'numeric',month:'long'}))} <em>${esc(String(when.getFullYear()))}</em></h2>${parts.length?`<p class="nxp-history-selected-summary">${esc(parts.join(' · '))}</p>`:''}${(()=>{const k=[scope.lift&&r.logs.length?'<span class="lift"><i></i>Lifting</span>':'',scope.cond&&r.cardio.length?'<span class="cond"><i></i>Cardio</span>':'',scope.cond&&r.floorball.length?'<span class="floor"><i></i>Floorball</span>':'',scope.body&&r.bw?'<span class="body"><i></i>Weigh-in</span>':''].join('');return k?`<p class="st-day-k" aria-hidden="true">${k}</p>`:'';})()}</header>${blocks.length?blocks.join(''):(N.calorieChanges&&N.calorieChanges().some(x=>x.date===date)?'':`<p class="nxp-history-empty">${esc(emptyCopy)}</p>`)}${historyAuditLanes(date)}</section>`;
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
    if(next){next.classList.add('is-selected');next.setAttribute('aria-pressed','true');}
  }
  function history() {
    applyAppearance();
    syncTrainNav(false);
    const month=calendarMonthState(),filter=state.historyFilter||'all',scope=historyScope(filter),selected=historySelectedDate(month,scope);
    state.historyDate=selected;
    document.getElementById('historyPage').innerHTML=`<div class="n99 nxp nxp-history vn-history"><header class="nxp-heading nxp-history-chrome vn-hist-chrome" id="vn-hist-chrome"><div><h1>History</h1><p id="vn-hist-summary">${esc(historyMonthSummary(month,filter,scope))}</p></div></header>${historyFiltersHTML(filter)}<div id="vn-hist-calhost">${historyCalendar(month,scope,selected)}</div><div id="vn-hist-dayhost" class="vn-hist-dayhost">${historyDayView(selected,filter,scope)}</div></div>`;
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
  return {removeScanPhotos,nameSheet,saveName,ui,useAim,useTarget,trainMenu,setRoutineGym,pickDay,setDay,editRoutine,routineBack,routineMove,routineBoth,routineDefault,routineEdit,routineStep,routineRemove,routinePick,routineFilter,routineChoose,routineSave,saveTodayToRoutine,home,training,progress,more,history,enterTrain,leaveTrain,syncTrainNav,addOnAdd,addOnRemove,addOnPick,addOnFilter,addOnSelect,rememberInput,logSet,queue,queueMove,exerciseDetails,paintRest,noteRestTotal,setSetType,setRir,goExercise,chooseExercise,editCurrentSet,sessionMenu,equipmentNote,sessionSummary,saveAppearance,pickOption,applyAppearance,exportBackup,cloudLabel,backupLabel,connectionHTML,validConfig,testConnection,historyDay,editHistorySet,otherDayDetails,historySelect,setHistoryFilter,historyShiftMonth,historyThisMonth,openRecovery,setRecoveryPreview,openWearableConnection,openBodyCapture,keyboardBottom};
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
