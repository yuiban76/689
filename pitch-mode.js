/* Adapter: one authoritative pitch stream for every game mode. */
(() => {
  "use strict";
  const E=PitchEngine;
  function game(){
    state.pitchVersion=1;
    return state.pitchGame ||= {energy:100,opponentEnergy:100,pitches:0,opponentPitches:0,batter:0,zone:4,effort:"normal",call:"catcher-fastball",ball:null,play:null,halfRuns:0,halfErrors:0,manualP:0,manualC:0,history:[]};
  }
  const rating=p=>p?.ratings||{};
  const opponentBatter=()=>teamFor(state.opponentId).roster[game().batter%9];
  const critical=()=>!!state.bases.second||!!state.bases.third||state.inning>=7&&Math.abs(state.score.home-state.score.away)<=2;
  const repeats=ball=>game().history.filter(h=>h.side===state.phase).slice(-2).filter(h=>h.type===ball.type).length;
  function boosted(player){
    const r={...rating(player)};
    for(const [track,keys] of Object.entries({contact:["contact","contactL","contactR","vision"],power:["power","powerL","powerR"],speed:["speed","stealing"],defense:["fielding","reaction"],pitching:["velocity","break"],catcher:["blocking"]})){
      const multiplier=window.CareerMode?.modifier(player,track)||1;
      keys.forEach(k=>r[k]=Math.min(99,Number(r[k]||60)*multiplier));
    }
    return r;
  }
  function ensureOffense(){
    const g=game();
    if(state.phase!=="home"||state.homeMode==="runner"||g.ball)return;
    const p=matchPlayerForPosition("P",state.opponentId);
    const type=Object.keys(E.types)[Math.floor(nextRandom()*4)];
    g.ball=E.pitch({ratings:boosted(p),energy:g.opponentEnergy,type,zone:Math.floor(nextRandom()*9),timing:55+nextRandom()*35,random:nextRandom});
  }
  function beginDefense(){
    const g=game();g.ball=null;g.play=null;g.halfRuns=0;g.awayRunsPosted=0;g.halfErrors=0;g.virtualOuts=0;g.manualP=0;g.manualC=0;
    state.defenseMode="catcher";state.defenseOwner="C";
    state.awaySeries={pitchAction:"",catcherAction:"",playIndex:0,outs:0,runs:0};
    addLog("逐球配球開始：捕手建議 → 投手選球種與落點 → 場內球交由責任區守備。");
    armActionDeadline();
  }
  function catcher(action){
    const g=game();g.call=action;
    if(state.actionCredit?.manual)g.manualC++;
    g.zone=action==="catcher-low"?7:action==="catcher-away"?5:4;
    state.awaySeries.catcherAction=action;
    state.defenseMode="strategy";state.defenseOwner="P";
    addLog("捕手建議："+(CATCHER_ACTION_META[action]?.title||"配球")+"；投手可調整落點與力道。");
  }
  const pitchType=action=>action==="defense-fast"?"fastball":action==="defense-break"?"slider":action==="defense-change"?"changeup":action==="defense-curve"?"curve":"fastball";
  function nextAway(advance=true){
    if(state.phase==="gameover")return;
    const g=game();if(advance)g.batter++;g.ball=null;g.play=null;state.balls=0;state.strikes=0;state.currentAwayPlay=null;
    if(state.outs>=3){
      if(!g.halfRuns&&g.manualP)CareerMode.credit("P","scorelessHalves",1,true);
      if(!g.halfRuns&&g.manualC)CareerMode.credit("C","catcherSuccess",1,true);
      completeAwayHalf(g.halfRuns,"本半局結束，對手取得 "+g.halfRuns+" 分。");
    } else {state.defenseMode="catcher";state.defenseOwner="C";}
  }
  function awayOut(n=1){
    const count=Math.min(n,3-state.outs);state.outs+=count;
    game().virtualOuts=Number(game().virtualOuts||0)+count;
    const p=state.playerStats.P;p.pitchingOuts=Number(p.pitchingOuts||0)+count;
    POSITION_DEFS.forEach(({code})=>state.playerStats[code].teamDefenseOuts=Number(state.playerStats[code].teamDefenseOuts||0)+count);
  }
  function awayAdvance(kind,error=false){
    const g=game(),a=E.advance(state.bases,kind,"AWAY-"+g.batter+(error?"-E":""));state.bases=a.bases;addAwayRuns(a.scored.length);
    const p=state.playerStats.P;
    p.pitchingER=Number(p.pitchingER||0)+(g.virtualOuts>=3?0:a.scored.filter(id=>!String(id).endsWith("-E")).length);
    if(!error&&kind!=="walk")p.pitchingHits=Number(p.pitchingHits||0)+1;
    if(kind==="homer")p.pitchingHomeRuns=Number(p.pitchingHomeRuns||0)+1;
    addLog(opponentBatter().name+" "+({walk:"四壞球保送",single:"一壘安打",double:"二壘安打",triple:"三壘安打",homer:"全壘打"}[kind]||"上壘")+(a.scored.length?"，帶回 "+a.scored.length+" 分":""));
    opponentWalkoff();
  }
  function opponentWalkoff(){
    if(state.careerPlayerId&&state.schedulePlayerIsAway&&state.inning>=9&&state.score.away>state.score.home){
      ensureInning().away=game().halfRuns;state.awaySeries=null;state.currentAwayPlay=null;endGame("loss");return true;
    }
    return false;
  }
  function addAwayRuns(n){
    const g=game();g.halfRuns+=n;g.awayRunsPosted=Number(g.awayRunsPosted||0)+n;state.score.away+=n;ensureInning().away=g.halfRuns;
  }
  function pitch(action,timing){
    const g=game(),p=matchPlayerForPosition("P",state.teamId);
    if(state.actionCredit?.manual)g.manualP++;
    if(action==="defense-intentional"){
      state.playerStats.P.pitchingWalks=Number(state.playerStats.P.pitchingWalks||0)+1;awayAdvance("walk");nextAway();return;
    }
    if(action==="defense-pickoff"){
      const base=state.bases.first?"first":state.bases.second?"second":null;
      if(base&&nextRandom()<.04+E.skill(rating(p).control)*.05){state.bases[base]=null;awayOut();CareerMode.credit("P","runnerStops");addLog("投手牽制成功，跑者出局。");}
      else addLog("投手牽制，跑者安全回壘。");
      if(state.outs>=3)nextAway(false);else {state.defenseMode="catcher";state.defenseOwner="C";}return;
    }
    const stealBase=state.bases.first&&!state.bases.second?"first":state.bases.second&&!state.bases.third?"second":null;
    if(stealBase&&nextRandom()<.04){
      const c=boosted(matchPlayerForPosition("C",state.teamId)),runner=opponentBatter().ratings;
      const attempt=E.steal({speed:runner.speed,stealing:runner.stealing,arm:c.armStrength,accuracy:c.armAccuracy,reaction:c.reaction,pickoff:g.call==="catcher-pickoff",random:nextRandom});
      const runnerId=state.bases[stealBase];state.bases[stealBase]=null;
      if(attempt.success){state.bases[stealBase==="first"?"second":"third"]=runnerId;addLog("對手盜壘成功。");}
      else {awayOut();state.playerStats.C.assists++;if(g.manualC)CareerMode.credit("C","runnerStops",1,true);addLog("捕手傳球阻殺跑者。");if(state.outs>=3){nextAway(false);return;}}
    }
    const ball=E.pitch({ratings:boosted(p),energy:g.energy,type:pitchType(action),zone:g.zone,effort:g.effort,timing,precision:action==="defense-control",random:nextRandom});
    g.energy=ball.energy;g.pitches++;g.ball=ball;
    const batter=opponentBatter(),r=boosted(batter);
    const choice=E.npcAction(ball,r,state.strikes,nextRandom);
    const result=E.resolve({ball,batter:r,pitcher:boosted(p),action:choice,timing:55+nextRandom()*35,clutch:critical(),repeats:repeats(ball),random:nextRandom});
    remember(ball,result);awayResult(result);
  }
  function remember(ball,result){
    const g=game();g.history.push({side:state.phase,type:ball.type,x:ball.x,y:ball.y,result:result.kind});
    g.history=g.history.slice(-12);
    addLog(E.types[ball.type]+"："+({ball:"壞球",strike:"好球／揮空",foul:"界外球",inplay:"擊成場內球",homer:"全壘打"}[result.kind]||result.kind));
  }
  function awayResult(result){
    const g=game();
    if(result.kind==="ball"){
      state.balls++;
      // Only an actual low missed pitch can become a passed ball / wild pitch.
      if(g.ball.y< -1.05&&hasRunners()){
        const c=matchPlayerForPosition("C",state.teamId);
        if(nextRandom()> .7+E.skill(rating(c).blocking)*.26){
          const keys=["third","second","first"];
          keys.forEach((k,i)=>{if(state.bases[k]){if(i===0){addAwayRuns(1);if(g.virtualOuts<3&&!String(state.bases[k]).endsWith("-E"))state.playerStats.P.pitchingER=Number(state.playerStats.P.pitchingER||0)+1;}else state.bases[keys[i-1]]=state.bases[k];state.bases[k]=null;}});
          addLog("低球未能擋住，壘上跑者推進。");
        } else if(g.manualC)CareerMode.credit("C","runnerStops",1,true);
      }
      if(opponentWalkoff())return;
      if(state.balls>=4){state.playerStats.P.pitchingWalks=Number(state.playerStats.P.pitchingWalks||0)+1;awayAdvance("walk");nextAway();return;}
    } else if(result.kind==="strike"){
      state.strikes++;
      if(state.strikes>=3){awayOut();state.playerStats.C.putouts++;g.opponentStrikeouts=Number(g.opponentStrikeouts||0)+1;state.playerStats.P.pitchingStrikeouts=Number(state.playerStats.P.pitchingStrikeouts||0)+1;if(state.actionCredit?.manual)CareerMode.credit("P","pitchingStrikeouts",1,true);addLog("三振！");nextAway();return;}
    } else if(result.kind==="foul"){state.strikes=Math.min(2,state.strikes+1);}
    else if(result.kind==="homer"){awayAdvance("homer");nextAway();return;}
    else {
      g.play={...result,outs:state.outs,runnerOnFirst:!!state.bases.first,runnerOnThird:!!state.bases.third,kind:result.ground?"groundball":"flyball",runnerCount:Object.values(state.bases).filter(Boolean).length,leadRunnerOnThird:!!state.bases.third};
      state.currentAwayPlay={...g.play,potentialRuns:0,number:1,situation:"實際擊球：選擇抓出局或冒險攔截。"};
      state.defenseMode="fielding";state.defenseOwner=result.position;return;
    }
    g.ball=null;state.defenseMode="catcher";state.defenseOwner="C";
  }
  function field(action){
    const g=game(),play=g.play;if(!play)return;
    const f=matchPlayerForPosition(play.position,state.teamId),stats=state.playerStats[play.position];
    const result=E.field({play,action,ratings:boosted(f),runnerSpeed:rating(opponentBatter()).speed,random:nextRandom});
    stats.fieldingChances++;stats.defenseOpportunities++;stats.putouts+=result.outs;
    if(result.error){stats.errors++;g.halfErrors++;g.virtualOuts++;}
    CareerMode.creditFielding(play.position,result);
    if(result.runnerOut){
      if(state.bases.third)state.bases.third=null;else state.bases.first=null;
      awayOut();if(state.outs<3)awayAdvance(result.hit); 
    }else if(result.outs){awayOut(result.outs);if(result.outs===2)state.bases.first=null;
      if((result.sacrifice||!play.ground)&&state.outs<3&&state.bases.third&&!result.savedRun){addAwayRuns(1);if(g.virtualOuts<3&&!String(state.bases.third).endsWith("-E"))state.playerStats.P.pitchingER=Number(state.playerStats.P.pitchingER||0)+1;state.bases.third=null;}}
    else awayAdvance(result.hit,result.error);
    if(opponentWalkoff())return;
    addLog(positionName(play.position)+(result.outs?"完成 "+result.outs+" 個出局":result.error?"守備失誤":"未能完成出局"));
    nextAway();
  }
  function swing(action,timing){
    ensureOffense();const g=game(),b=currentBatter(),r=boosted(b),p=matchPlayerForPosition("P",state.opponentId);
    const side=p.throws==="左"?"L":"R";r.contact=r["contact"+side]??r.contact;r.power=r["power"+side]??r.power;
    const result=E.resolve({ball:g.ball,batter:r,pitcher:boosted(p),action,timing,balls:state.balls,strikes:state.strikes,clutch:critical(),repeats:repeats(g.ball),random:nextRandom});
    const thrown=g.ball;
    g.opponentEnergy=g.ball.energy;g.opponentPitches++;remember(g.ball,result);g.ball=null;
    if(result.kind==="ball"&&thrown.y< -1.05&&hasRunners()&&nextRandom()>.7+E.skill(rating(matchPlayerForPosition("C",state.opponentId)).blocking)*.26){
      ["third","second","first"].forEach((k,i,keys)=>{if(state.bases[k]){if(i===0)scoreRun(state.bases[k]);else state.bases[keys[i-1]]=state.bases[k];state.bases[k]=null;}});
      addLog("對手捕手未能擋住低球，跑者推進。");if(checkWalkoff())return;
    }
    if(result.kind==="ball"){state.balls++;if(state.balls>=4)applyWalk();return;}
    if(result.kind==="strike"){state.strikes++;if(state.strikes>=3)recordOut("遭到三振");return;}
    if(result.kind==="foul"){state.strikes=Math.min(2,state.strikes+1);return;}
    if(result.kind==="homer"){applyHit("homer");return;}
    const defender=matchPlayerForPosition(result.position,state.opponentId),play={...result,outs:state.outs,runnerOnFirst:!!state.bases.first,runnerOnThird:!!state.bases.third};
    const f=E.field({play,action:result.ground?"fielding-first":"fielding-catch",ratings:boosted(defender),runnerSpeed:r.speed,random:nextRandom});
    if(f.outs){
      if(result.bunt&&hasRunners()){
        const run=state.bases.third?1:0;if(run)scoreRun(state.bases.third);
        state.bases.third=state.bases.second;state.bases.second=state.bases.first;state.bases.first=null;
        state.outs++;CareerMode.credit(b.position,"advances");finishPlateAppearance({atBat:false,rbi:run});checkWalkoff();
      }else recordOut("擊球被守備處理");
    }else if(f.error){
      const a=E.advance(state.bases,"single",b.position);state.bases=a.bases;a.scored.forEach(scoreRun);finishPlateAppearance({atBat:true});checkWalkoff();
    }else {
      const hit=f.hit;
      g.advanceWindow={runner:b.position,arm:rating(defender).armStrength,accuracy:rating(defender).armAccuracy};
      applyHit(hit);
    }
  }
  function steal(){
    const position=state.bases.first&&!state.bases.second?state.bases.first:state.bases.second&&!state.bases.third?state.bases.second:null;if(!position)return;
    const r=boosted(matchPlayerForPosition(position,state.teamId)),c=boosted(matchPlayerForPosition("C",state.opponentId)),s=state.playerStats[position];
    const result=E.steal({speed:r.speed,stealing:r.stealing,arm:c.armStrength,accuracy:c.armAccuracy,reaction:c.reaction,random:nextRandom});
    const from=state.bases.first===position?"first":"second",to=from==="first"?"second":"third";state.bases[from]=null;
    if(result.success){state.bases[to]=position;s.steals++;CareerMode.credit(position,"steals");addLog("盜壘成功。");}
    else {s.caughtStealing++;state.outs++;CareerMode.credit(position,"caughtStealing");addLog("盜壘被阻殺。");if(state.outs>=3)finishHomeHalf();}
  }
  function extraBase(){
    const g=game(),w=g.advanceWindow;if(!w)return;g.advanceWindow=null;
    const from=state.bases.first===w.runner?"first":state.bases.second===w.runner?"second":null;
    if(!from)return;const to=from==="first"?"second":"third";if(state.bases[to])return;
    const r=boosted(matchPlayerForPosition(w.runner,state.teamId));
    const result=E.extraBase({speed:r.speed,arm:w.arm,accuracy:w.accuracy,random:nextRandom});
    state.bases[from]=null;
    if(result.success){state.bases[to]=w.runner;CareerMode.credit(w.runner,"advances");addLog("趁傳球成功多推進一個壘包。");}
    else {state.playerStats[w.runner].baserunningOuts=Number(state.playerStats[w.runner].baserunningOuts||0)+1;state.outs++;addLog("冒險推進遭到觸殺。");if(state.outs>=3)finishHomeHalf();}
  }
  const root=document.createElement("section");root.id="pitch-controls";root.className="pitch-controls";$("match-actions-grid").before(root);
  function render(){
    const g=game(),active=state.phase==="home"||state.phase==="defense";
    root.hidden=!active||!!matchTimingChallenge;
    const flight=$("pitch-flight"),take=$("pitch-take");if(flight)flight.hidden=state.phase!=="home";if(take)take.hidden=state.phase!=="home";
    if(!active)return;
    const pitcherTurn=state.phase==="defense"&&state.defenseMode==="strategy",can=localControlsActiveEvent();
    root.innerHTML=`<div class="pitch-status">逐球實戰 · 投球 ${g.pitches} 球 · 體力 ${Math.round(g.energy)}% · 對手 ${state.phase==="defense"?escapeHtml(opponentBatter().name):"NPC 投手"}</div>${pitcherTurn?`<details class="pitch-zone-picker"><summary>落點：${["左高","正高","右高","左側","中央","右側","左低","正低","右低"][g.zone]}</summary><div class="pitch-targets" aria-label="九宮格目標">${Array.from({length:9},(_,i)=>`<button type="button" data-pitch-zone="${i}" aria-label="第 ${i+1} 格落點" aria-pressed="${i===g.zone}" ${can?"":"disabled"}>${["左高","正高","右高","左側","中央","右側","左低","正低","右低"][i]}</button>`).join("")}</div><button type="button" data-pitch-extra="defense-pickoff" ${can&&hasRunners()?"":"disabled"}>牽制跑者</button><button type="button" data-pitch-extra="defense-intentional" ${can?"":"disabled"}>故意四壞球</button></details><label>投球力道 <select id="pitch-effort" ${can?"":"disabled"}><option value="save">節省體力</option><option value="normal">正常</option><option value="max">全力投球</option></select></label>`:""}${state.phase==="home"&&state.homeMode!=="runner"?"<p>選打法後觀察來球；可抓時機揮棒，也可放掉。時機與能力不保證安打。</p>":""}`;
    if(pitcherTurn)$("pitch-effort").value=g.effort;
    if(matchTimingChallenge&&state.phase==="home"){
      const hint=$("match-timing-hint");if(hint)hint.textContent="觀察來球軌跡，揮棒或放掉；高視野更早看清來球。";
    }
    const note=$("pitch-count-note");if(note&&state.phase==="defense")note.textContent=state.defenseMode==="fielding"?"實際場內球：處理責任區來球":state.defenseMode==="catcher"?"每球先由捕手建議，再由投手決定":"選擇落點、力道與球種，再抓放球時機";
  }
  document.addEventListener("click",e=>{const extra=e.target.closest("[data-pitch-extra]");if(extra&&!extra.disabled){handleAction(extra.dataset.pitchExtra);return;}const z=e.target.closest("[data-pitch-zone]");if(z&&!z.disabled&&localControlsActiveEvent()){game().zone=Number(z.dataset.pitchZone);render();}});
  document.addEventListener("change",e=>{if(e.target.id==="pitch-effort"&&localControlsActiveEvent())game().effort=e.target.value;});
  const flight=document.createElement("div");flight.id="pitch-flight";flight.innerHTML='<div class="flight-zone"></div><i id="flight-ball"></i>';
  $("match-timing-panel").append(flight);
  const take=document.createElement("button");take.type="button";take.id="pitch-take";take.textContent="放掉這一球";
  $("match-timing-panel").append(take);
  take.addEventListener("click",()=>{if(!localControlsActiveEvent()||state.phase!=="home")return;clearMatchTiming();handleAction("patient");});
  function animate(challenge,timestamp){
    const ball=game().ball;
    flight.hidden=state.phase!=="home";take.hidden=state.phase!=="home";
    if(!ball||state.phase!=="home")return;
    const t=clamp((timestamp-challenge.startedAt)/challenge.config.cycleMs*2,0,1);
    const vision=(rating(currentBatter()).vision||60)*.55+(rating(currentBatter()).discipline||60)*.45;
    const marker=$("flight-ball");
    marker.style.left=(50+ball.x*28*t)+"%";marker.style.top=(5+(45-ball.y*28)*t)+"%";
    marker.style.opacity=t> .55-vision/250?1:.25;
    marker.style.transform="scale("+( .4+t*.6)+")";
  }
  window.PitchMode={game,options:()=>({zone:game().zone,effort:game().effort}),ensureOffense,beginDefense,catcher,pitch,field,swing,steal,extraBase,render,animate};
  render();
})();
