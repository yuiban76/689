const test=require("node:test"),assert=require("node:assert/strict"),E=require("./pitch-engine.js"),M=require("./match-engine.js");
test("forced walk advances only forced runners",()=>{
  assert.deepEqual(E.advance({first:"a",second:null,third:"b"},"walk","c"),{bases:{first:"c",second:"a",third:"b"},scored:[]});
});
test("same seed preserves actual pitch and result",()=>{
  const run=()=>{const random=M.createRandom(42),ball=E.pitch({random});return {ball,result:E.resolve({ball,random})};};
  assert.deepEqual(run(),run());
});
test("taking a ball cannot invent a strikeout; two-strike bunt foul strikes out",()=>{
  assert.equal(E.resolve({ball:{strike:false},action:"patient"}).kind,"ball");
  assert.equal(E.resolve({ball:{strike:true},action:"patient"}).kind,"strike");
  const ball={strike:true,velocity:.5,movement:.5};
  let n=0;assert.equal(E.resolve({ball,action:"bunt",strikes:2,random:()=>n++===0?0:1}).kind,"strike");
});
test("stamina conserves energy, effort spends energy and tired players remain playable",()=>{
  const low=E.pitch({ratings:{stamina:60},effort:"save",random:()=>.5}),high=E.pitch({ratings:{stamina:60},effort:"max",random:()=>.5});
  assert.ok(low.cost<high.cost);
  assert.ok(E.pitch({ratings:{stamina:90},random:()=>.5}).cost<E.pitch({ratings:{stamina:60},random:()=>.5}).cost);
  assert.ok(E.fatigue(0,60)<=.28);
});
test("double play has a real zero-out failure path",()=>{
  const result=E.field({play:{quality:.5,ground:true,runnerOnFirst:true,outs:0},action:"fielding-double",random:()=>.99});
  assert.equal(result.outs,0);
});
test("strong runners improve steal odds and catcher arm can counter them",()=>{
  const base=E.steal({random:()=>.5});
  assert.ok(E.steal({speed:90,stealing:90}).chance>base.chance);
  assert.ok(E.steal({arm:90,accuracy:90,reaction:90}).chance<base.chance);
});
test("repeated pitch patterns help the batter; clutch is conditional and not guaranteed",()=>{
  const run=(opts)=>{const random=M.createRandom(55);let contact=0;for(let i=0;i<20000;i++){const ball=E.pitch({random});const r=E.resolve({ball,random,...opts});if(["inplay","homer"].includes(r.kind))contact++;}return contact;};
  assert.ok(run({repeats:2})>run({repeats:0}));
  assert.ok(run({clutch:true,batter:{clutch:90}})>run({clutch:false,batter:{clutch:90}}));
  assert.ok(run({timing:99,batter:{contact:99,power:99}})<20000);
});
test("ordinary rewards are bounded independently of button presses",()=>{
  const C=require("./career-engine.js");
  assert.equal(C.payout("P",{decisions:1},{career:false}).xp,C.payout("P",{decisions:1000},{career:false}).xp);
});
test("extra-base advancement gives speed an advantage but can fail against an arm",()=>{
  assert.ok(E.extraBase({speed:90}).chance>E.extraBase({speed:60}).chance);
  assert.ok(E.extraBase({arm:90,accuracy:90}).chance<E.extraBase({arm:60,accuracy:60}).chance);
  assert.equal(E.extraBase({speed:99,random:()=>.99}).success,false);
});
