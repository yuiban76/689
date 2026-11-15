"use strict";
const E=require("./pitch-engine.js"),M=require("./match-engine.js");
const assert=require("node:assert/strict");
const ratings=n=>Object.fromEntries(["contact","power","vision","discipline","clutch","speed","stealing","fielding","reaction","armStrength","armAccuracy","blocking","velocity","control","break","stamina","bunt"].map(k=>[k,n]));
function simulate({bat=60,pit=75,field=75,action="adaptive",timing=65,games=2000,seed=2026}={}){
  const random=M.createRandom(seed),b=ratings(bat),p=ratings(pit),f=ratings(field);
  let pa=0,hits=0,walks=0,ks=0,hr=0,runs=0,pitches=0;
  for(let game=0;game<games;game++){
    let energy=100;
    for(let inning=0;inning<9;inning++){
      let outs=0,balls=0,strikes=0,bases={first:null,second:null,third:null},watch=0;
      while(outs<3){
        assert.ok(watch++<300,"inning must terminate");
        const ball=E.pitch({ratings:p,energy,type:Object.keys(E.types)[Math.floor(random()*4)],zone:Math.floor(random()*9),timing:65,random});
        energy=ball.energy;pitches++;
        const choice=action==="adaptive"?E.npcAction(ball,b,strikes,random):action;
        const r=E.resolve({ball,batter:b,pitcher:p,action:choice,timing,strikes,balls,random});
        let kind="";
        if(r.kind==="strike"){strikes++;if(strikes>=3){ks++;outs++;}}
        else if(r.kind==="ball"){balls++;if(balls>=4){walks++;kind="walk";}}
        else if(r.kind==="foul")strikes=Math.min(2,strikes+1);
        else if(r.kind==="homer"){hits++;hr++;kind="homer";}
        else {
          const result=E.field({play:{...r,outs,runnerOnFirst:!!bases.first},action:r.ground?"fielding-first":"fielding-catch",ratings:f,runnerSpeed:b.speed,random});
          if(result.outs)outs+=result.outs;else {kind=result.hit;if(!result.error)hits++;}
        }
        if(kind){const a=E.advance(bases,kind,"r"+pa);bases=a.bases;runs+=a.scored.length;}
        if(kind||strikes>=3||r.kind==="inplay"){pa++;balls=0;strikes=0;}
      }
    }
  }
  return {bat,pit,field,action,timing,games,pa,avg:+(hits/(pa-walks)).toFixed(3),obp:+((hits+walks)/pa).toFixed(3),kRate:+(ks/pa).toFixed(3),bbRate:+(walks/pa).toFixed(3),hrRate:+(hr/pa).toFixed(3),runsPerGame:+(runs/games).toFixed(2),pitchesPerGame:+(pitches/games).toFixed(1)};
}
if(require.main===module){
  const rows=[60,75,90].map(bat=>simulate({bat}));
  rows.push(simulate({bat:60,timing:90}),simulate({bat:90,timing:40}),simulate({action:"contact"}),simulate({action:"power"}),simulate({action:"patient"}));
  console.table(rows);assert.ok(rows[2].avg>rows[0].avg);assert.ok(rows[2].hrRate>rows[0].hrRate);assert.ok(rows[3].avg>rows[0].avg);
  assert.ok(rows[6].avg<rows[5].avg&&rows[6].hrRate>rows[5].hrRate&&rows[6].kRate>rows[5].kRate,"power trades contact for extra bases and strikeout risk");
  let wins=0,losses=0,ties=0;
  for(let seed=1;seed<=2000;seed++){
    const a=simulate({bat:75,pit:75,field:75,games:1,seed:seed*2}).runsPerGame;
    const b=simulate({bat:75,pit:75,field:75,games:1,seed:seed*2+1}).runsPerGame;
    if(a>b)wins++;else if(a<b)losses++;else ties++;
  }
  const winRate=wins/(wins+losses);
  console.log("Equal-ability independent seeded comparison",{wins,losses,ties,winRate});
  assert.ok(winRate>.45&&winRate<.55,"equal ability has no one-sided advantage");
}
module.exports={simulate};
