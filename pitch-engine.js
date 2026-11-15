"use strict";
(function(root,factory){const api=factory();if(typeof module==="object")module.exports=api;root.PitchEngine=api;})(globalThis,()=>{
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const skill=n=>Math.sqrt(clamp(n??60,20,99)/100);
  const rating=(r,k)=>Number(r?.[k]??60);
  const types={fastball:"四縫線速球",slider:"滑球",changeup:"變速球",curve:"曲球"};
  function fatigue(energy,stamina){return clamp((45-energy)/90*(1.15-skill(stamina)*.4),0,.28);}
  function pitch({ratings={},energy=100,type="fastball",zone=4,effort="normal",timing=65,precision=false,random=Math.random}={}){
    const power={save:.75,normal:1,max:1.25}[effort]||1;
    const tired=fatigue(energy,rating(ratings,"stamina"));
    const scatter=clamp(.53-skill(rating(ratings,"control"))*.35+(100-timing)/500+tired*.45+(type==="curve"?.04:type==="slider"?.02:0)-(precision?.07:0),.08,.65);
    const centers=[[-.72,.72],[0,.72],[.72,.72],[-.72,0],[0,0],[.72,0],[-.72,-.72],[0,-.72],[.72,-.72]];
    const [tx,ty]=centers[clamp(zone,0,8)]||centers[4];
    const x=tx+(random()-.5)*scatter*5,y=ty+(random()-.5)*scatter*5;
    const cost=(.65+(1-skill(rating(ratings,"stamina")))*.8)*power*(type==="fastball"?1:1.08);
    return {type,zone,effort,x,y,strike:Math.abs(x)<=1&&Math.abs(y)<=1,
      velocity:clamp((skill(rating(ratings,"velocity"))+({fastball:.08,slider:-.04,changeup:-.12,curve:-.1}[type]||0)-(precision?.08:0))*power*(1-tired),.3,1.12),
      movement:clamp(skill(rating(ratings,"break"))*(type==="fastball"?.65:type==="changeup"?.95:1.12)*(1-tired),.2,1),
      energy:Math.max(0,energy-cost),cost,tired};
  }
  function resolve({ball,batter={},pitcher={},action="contact",timing=65,balls=0,strikes=0,clutch=false,repeats=0,random=Math.random}){
    if(action==="patient")return {kind:ball.strike?"strike":"ball"};
    const contact=skill(rating(batter,"contact")),vision=skill(rating(batter,"vision"));
    const accuracy=clamp(timing/100,0,1);
    const chase=ball.strike?0:.23+Math.max(0,Math.abs(ball.x)-1)*.12;
    const clutchBonus=clutch?Math.max(0,skill(rating(batter,"clutch"))-.5)*.06:0;
    const chance=clamp(.52+contact*.27+vision*.08+accuracy*.16-ball.velocity*.13-ball.movement*.09-chase-(action==="power"?.18:0)+clutchBonus+Math.min(2,repeats)*.025-(ball.type==="changeup"?(1-vision)*.08:0),.25,.94);
    if(random()>chance)return {kind:"strike",swing:true};
    if(action==="bunt"){
      if(random()>(.23+skill(rating(batter,"bunt"))*.5+accuracy*.12))return {kind:strikes>=2?"strike":"foul",swing:true};
      return {kind:"inplay",bunt:true,quality:.15+skill(rating(batter,"bunt"))*.25,position:random()<.5?"P":"3B",ground:true};
    }
    if(random()<.22+(1-accuracy)*.12)return {kind:"foul"};
    const quality=clamp(random()*.65+skill(rating(batter,"power"))*.32+accuracy*.13-ball.movement*.13+(action==="power"?.025:-.03)+clutchBonus,0,1);
    if(quality>.88&&random()<.3+skill(rating(batter,"power"))*.25)return {kind:"homer",quality};
    const ground=random()<clamp(.57-(quality-.4)*.3+(ball.y<0?.08:0),.25,.8);
    const positions=ground?["P","1B","2B","3B","SS"]:["LF","CF","RF"];
    return {kind:"inplay",quality,ground,position:positions[Math.floor(random()*positions.length)]};
  }
  function field({play,action,ratings={},runnerSpeed=60,random=Math.random}){
    const range=skill(rating(ratings,"fielding"))*.5+skill(rating(ratings,"reaction"))*.3+skill(rating(ratings,"speed"))*.2;
    const throwing=skill(rating(ratings,"armStrength"))*.55+skill(rating(ratings,"armAccuracy"))*.45;
    if(["fielding-relay","fielding-cutoff","fielding-throw","fielding-home"].includes(action)){
      const target=action==="fielding-home"?play.runnerOnThird:play.runnerOnFirst||play.runnerOnThird;
      const aggressive=action==="fielding-throw"||action==="fielding-home";
      const stopChance=clamp(.2+throwing*.55-skill(runnerSpeed)*.2+(aggressive?-.05:.06),.15,.85);
      const runnerOut=!!target&&random()<stopChance;
      return {outs:runnerOut?1:0,runnerOut,error:!runnerOut&&aggressive&&random()>(.7+throwing*.25),hit:play.quality>.73?"double":"single",savedRun:runnerOut&&!!play.runnerOnThird};
    }
    const dive=action==="fielding-dive",double=action==="fielding-double";
    const chance=clamp(.46+range*.4-play.quality*.24+(dive?.08:0)-(double?.12:0),.25,.95);
    let success=random()<chance;
    let error=!success&&random()<clamp(.22-skill(rating(ratings,"armAccuracy"))*.15+(dive?.18:0),.03,.35);
    if(!success)return {outs:0,error,hit:play.quality>.73?"double":"single"};
    if(play.ground&&random()>clamp(.58+throwing*.35-skill(runnerSpeed)*.15,.35,.93))return {outs:0,error:false,hit:"single"};
    const outs=double&&play.runnerOnFirst&&play.outs<2&&random()<clamp(.2+throwing*.4+range*.2,.2,.85)?2:1;
    return {outs,error:false,hit:"",sacrifice:!!play.bunt,savedRun:action==="fielding-home"&&play.runnerOnThird};
  }
  function steal({speed=60,stealing=60,arm=60,accuracy=60,reaction=60,pickoff=false,random=Math.random}={}){
    const popTime=2.45-skill(arm)*.25-skill(reaction)*.2;
    const chance=clamp(.64+(skill(speed)-skill(60))*.28+(skill(stealing)-skill(60))*.52-(skill(arm)-skill(60))*.25-(skill(accuracy)-skill(60))*.2-(2.05-popTime)*.12-(pickoff?.18:0),.2,.9);
    return {success:random()<chance,chance,popTime};
  }
  function npcAction(ball,ratings={},strikes=0,random=Math.random){
    // Same incomplete visual information as a player; never a guaranteed read.
    const read=clamp(.52+skill(rating(ratings,"discipline"))*.24+skill(rating(ratings,"vision"))*.1,.55,.88);
    const believesStrike=random()<read?ball.strike:!ball.strike;
    return believesStrike||strikes===2&&random()<.22?"contact":"patient";
  }
  function advance(bases,kind,runner){
    const b={...bases},scored=[];
    if(kind==="walk"){
      if(b.first&&b.second&&b.third)scored.push(b.third);
      if(b.first&&b.second)b.third=b.second;
      if(b.first)b.second=b.first;
      b.first=runner;return {bases:b,scored};
    }
    const n={single:1,double:2,triple:3,homer:4}[kind]||1;
    const next={first:null,second:null,third:null},keys=["first","second","third"];
    keys.forEach((k,i)=>{if(b[k]){if(i+n>=3)scored.push(b[k]);else next[keys[i+n]]=b[k];}});
    if(n===4)scored.push(runner);else next[keys[n-1]]=runner;
    return {bases:next,scored};
  }
  function extraBase({speed=60,arm=60,accuracy=60,random=Math.random}={}){
    const chance=clamp(.65+(skill(speed)-skill(60))*.45-(skill(arm)-skill(60))*.3-(skill(accuracy)-skill(60))*.2,.2,.85);
    return {success:random()<chance,chance};
  }
  return {version:1,types,skill,pitch,resolve,field,steal,extraBase,npcAction,advance,fatigue};
});
