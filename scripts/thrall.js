import {SOURCE} from './core.mjs';
export async function createThrall(hero,corpse,item,operation){
  if(!game.modules.get('pf2e-summons-assistant')?.active||!game.tcal?.importTransientActor)throw Error('Включите PF2e Summons Assistant и TCAL.');
  const {getSpecificSummonDetails}=await import('/modules/pf2e-summons-assistant/scripts/specificSummons.js');
  const groups=await getSpecificSummonDetails(SOURCE,{rank:0,summonerLevel:hero.actor.level,summonerRollOptions:hero.actor.getRollOptions(['all']),ignoreDialogue:true});
  const g=groups?.[0];
  if(!g||g.amount!==1||g.specific_uuids?.length!==1)throw Error('Недоступен шаблон Inevitable Return в Summons Assistant.');
  const actor=await game.tcal.importTransientActor(g.specific_uuids[0],{preferExisting:false},{...g.modifications,'system.traits.size.value':corpse.actor.system.traits.size.value,'system.details.alliance':hero.actor.alliance,ownership:foundry.utils.deepClone(hero.actor.ownership),'prototypeToken.actorLink':false,'flags.vaal-tools.operation':operation});
  let created;
  try{
    const effects=foundry.utils.deepClone(g.itemsToAdd??[]);
    for(const e of effects)if(e.system)e.system.context={origin:{actor:hero.actor.uuid,token:hero.uuid,item:item.uuid}};
    if(effects.length)await actor.createEmbeddedDocuments('Item',effects);
    await actor.setFlag('pf2e-summons-assistant','summoner',{uuid:hero.actor.uuid,id:hero.actor.id,signature:hero.actor.signature});
    await actor.setFlag('pf2e-toolbelt','shareData',{data:{master:hero.actor.id,timeEvents:true}});
    const data=await actor.getTokenDocument({x:corpse.x,y:corpse.y,elevation:corpse.elevation,level:corpse.level,width:1,height:1,actorLink:false,disposition:hero.disposition,flags:{'vaal-tools':{operation,summoner:hero.uuid}}});
    [created]=await corpse.parent.createEmbeddedDocuments('Token',[data.toObject()]);
    return created;
  }catch(e){if(!created)await actor.delete().catch(console.error);throw e;}
}
