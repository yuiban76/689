module.exports = ()=>{
    const data=[];
    for(const {code:position} of POSITION_DEFS) for(const template of templatesForPosition(position)) {
      const player=buildCustomPlayer({name:"校準",number:"00",teamId:TEAM_DEFS[0].id,position,bats:"右",throws:"右",archetype:template.id});
      const ratings={...player.ratings}, max={...ratings};
      for(const key of builderOverallKeys(position))max[key]=attributeCapForPlayer(player,key);
      let coins=80,xp=0,level=1,at80=null,at90=null;
      const start=overallForPlayer(player), potential=overallForPlayer({position,ratings:max});
      for(let game=1;game<=120;game++){
        const match={decisions:8,strikeouts:1,pitchingER:3,earned:{hits:1,onBase:1,fieldSuccess:1,scorelessHalves:4,pitchingStrikeouts:4,catcherSuccess:4}};
        const report=CareerEngine.payout(position,match,{objective:CareerEngine.objective(position,game)});
        coins+=report.coins; xp+=report.xp;
        while(xp>=xpToNextLevel(level)){xp-=xpToNextLevel(level);level++;coins+=70;}
        for(let i=0;i<300;i++){
          const choices=builderOverallKeys(position).filter(key=>ratings[key]<attributeCapForPlayer(player,key)&&attributeUpgradeGate(ratings[key]+1,overallForPlayer({position,ratings:{...ratings,[key]:ratings[key]+1}})).level<=level&&attributeUpgradePrice(player,key,ratings[key])<=coins);
          choices.sort((a,b)=>overallWeightsFor(position)[b]/attributeUpgradePrice(player,b,ratings[b])-overallWeightsFor(position)[a]/attributeUpgradePrice(player,a,ratings[a]));
          if(!choices.length)break;
          const key=choices[0];coins-=attributeUpgradePrice(player,key,ratings[key]);ratings[key]++;
        }
        const ovr=overallForPlayer({position,ratings});
        if(ovr>=80&&at80===null)at80=game;
        if(ovr>=90&&at90===null)at90=game;
      }
      data.push({position,template:template.id,start,potential,at80,at90});
    }
    return data;
  };
