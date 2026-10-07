import {ability,eligible,remaining,spend} from './core.mjs';
import {createThrall} from './thrall.js';
import {installSheetControls} from './sheet.js';
const ID='vaal-tools';
const flag=(d,k)=>d.getFlag(ID,k);
const gm=()=>game.user.id===game.users.activeGM?.id;
const extra=a=>Boolean(ability(a,'endless-return'));
const state=a=>flag(a,'reactions')??{};
const available=a=>{const r=remaining(state(a),extra(a));return r.normal+r.extra;};
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let queue=Promise.resolve(),timer;
const schedule=fn=>{queue=queue.then(fn).catch(e=>{console.error('vaal Tools',e);ui.notifications.error(`vaal Tools: ${e.message??e}`);});};
const turn=()=>game.combat?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
function dead(t){const a=t.actor;return Boolean(a&&(a.statuses.has('dead')||(t.combatant?.defeated&&a.hitPoints?.value===0&&!a.hasCondition('dying','unconscious'))));}
function valid(h,c){
  if(!h?.object||!c?.object||h.parent.id!==canvas.scene?.id||h.parent.id!==c.parent.id)return false;
  if(!ability(h.actor,'inevitable-return'))return false;
  return eligible({ability:true,canAct:h.actor.canAct&&!h.actor.hasCondition('fascinated'),enemy:h.actor.isEnemyOf(c.actor),size:c.actor.system.traits?.size?.value,distance:h.object.distanceTo(c.object),available:available(h.actor),sameLevel:h.level===c.level});
}
function card(p,status='pending'){
  const labels={pending:'Можно использовать реакцию.',used:'Реакция использована. Тралл создан.',skipped:'Предложение пропущено.',expired:'Предложение больше не актуально.'};
  return `<section><h3>Inevitable Return</h3><p><strong>${esc(p.name)}</strong>: ${labels[status]}</p><p>Подходящий враг погиб в пределах 30 футов.</p>${status==='pending'?'<button type="button" data-vaal="use">Использовать реакцию</button><button type="button" data-vaal="skip">Пропустить</button>':''}</section>`;
}
async function closePrompts(actor){for(const m of game.messages){const p=flag(m,'prompt');if(p?.actor===actor.uuid&&p.status==='pending')await m.update({content:card(p,'expired'),[`flags.${ID}.prompt.status`]:'expired'});}}
async function scan(){
  if(!gm()||!canvas.scene||!game.settings.get(ID,'enabled'))return;
  for(const c of canvas.scene.tokens){
    const old=flag(c,'death');
    if(!dead(c)){if(old)await c.unsetFlag(ID,'death');continue;}
    if(old)continue;
    const event=foundry.utils.randomID();await c.setFlag(ID,'death',event);
    const seen=new Set();
    for(const h of canvas.scene.tokens){
      if(!h.actor||seen.has(h.actor.uuid)||!valid(h,c))continue;
      seen.add(h.actor.uuid);
      const p={hero:h.uuid,actor:h.actor.uuid,corpse:c.uuid,event,status:'pending',name:h.actor.name,turn:turn(),created:Date.now()};
      await ChatMessage.create({content:card(p),whisper:game.users.filter(u=>u.isGM||h.actor.testUserPermission(u,'OWNER')).map(u=>u.id),flags:{[ID]:{prompt:p}}});
    }
  }
}
function dirty(){if(!gm())return;clearTimeout(timer);timer=setTimeout(()=>schedule(scan),300);}
async function request(action,data){
  if(!game.users.activeGM)return ui.notifications.warn('Для vaal Tools нужен подключённый мастер.');
  return ChatMessage.create({content:'<p>vaal Tools: запрос обработки реакции.</p>',whisper:[game.users.activeGM.id],flags:{[ID]:{request:{action,...data}}}});
}
async function processRequest(m){
  const r=flag(m,'request');if(!r||flag(m,'processed'))return;
  await m.setFlag(ID,'processed',true);
  const user=m.author;if(!user?.active)return;
  if(r.action==='sheet-use'){
    const a=await fromUuid(r.actor),item=a?.items?.get(r.item);
    if(!a?.testUserPermission(user,'OWNER')||item?.actionCost?.type!=='reaction'||!a.canAct||ability(a,'inevitable-return')?.id===item.id)return;
    const before=state(a),frequency=item.system.frequency?{...item.system.frequency}:null;
    if(!remaining(before).normal||frequency?.value===0)return;
    await a.setFlag(ID,'reactions',{...before,normalSpent:true});
    try{
      if(frequency)await item.update({'system.frequency.value':frequency.value-1});
      await item.toMessage();
    }catch(error){
      await a.setFlag(ID,'reactions',before);
      if(frequency)await item.update({'system.frequency.value':frequency.value});
      throw error;
    }
    if(available(a)===0)await closePrompts(a);
    return;
  }
  if(['spent','reset'].includes(r.action)){
    const a=await fromUuid(r.actor);if(!a?.testUserPermission(user,'OWNER')||(r.action==='reset'&&!user.isGM))return;
    await a.setFlag(ID,'reactions',r.action==='reset'?{}:{...state(a),normalSpent:true});if(r.action==='reset'||available(a)===0)await closePrompts(a);return;
  }
  const message=game.messages.get(r.message),p=message&&flag(message,'prompt');
  if(!p||p.status!=='pending'||!message.author?.isGM)return;
  const h=await fromUuid(p.hero),c=await fromUuid(p.corpse);
  if(!h?.actor?.testUserPermission(user,'OWNER'))return;
  if(r.action==='skip'){await message.update({content:card(p,'skipped'),[`flags.${ID}.prompt.status`]:'skipped'});return;}
  if(r.action!=='use')return;
  if(!c||!dead(c)||flag(c,'death')!==p.event||turn()!==p.turn||Date.now()-p.created>120000||!valid(h,c)||flag(c,'claimed')===p.event){await message.update({content:card(p,'expired'),[`flags.${ID}.prompt.status`]:'expired'});return;}
  const before=state(h.actor);
  await message.setFlag(ID,'prompt.status','processing');
  await h.actor.setFlag(ID,'reactions',spend(before,extra(h.actor)));
  try{
    if(!c.parent.tokens.some(t=>flag(t,'operation')===message.id))await createThrall(h,c,ability(h.actor,'inevitable-return'),message.id);
  }catch(e){
    if(!c.parent.tokens.some(t=>flag(t,'operation')===message.id)){await h.actor.setFlag(ID,'reactions',before);await message.setFlag(ID,'prompt.status','pending');}
    throw e;
  }
  await c.setFlag(ID,'claimed',p.event);
  await message.update({content:card(p,'used'),[`flags.${ID}.prompt.status`]:'used'});
  if(available(h.actor)===0)await closePrompts(h.actor);
}
async function panel(){
  const actors=[...new Map(canvas.tokens.controlled.filter(t=>t.actor?.isOwner).map(t=>[t.actor.uuid,t.actor])).values()];
  if(!actors.length&&game.user.character)actors.push(game.user.character);
  if(!actors.length)return ui.notifications.warn('Выберите токен своего персонажа.');
  for(const a of actors){
    const r=remaining(state(a),extra(a));
    const action=await foundry.applications.api.DialogV2.wait({window:{title:`vaal Tools — ${a.name}`},content:`<p>Обычная реакция: ${r.normal}/1.</p>${extra(a)?`<p>Endless Return: ${r.extra}/1.</p>`:''}<p>Отметьте здесь реакцию, использованную вне vaal Tools.</p>`,buttons:[{action:'spent',label:'Потрачена обычная реакция'},...(game.user.isGM?[{action:'reset',label:'Восстановить реакции'}]:[]),{action:'close',label:'Закрыть'}]});
    if(['spent','reset'].includes(action))await request(action,{actor:a.uuid});
  }
}
Hooks.once('init',()=>{
  game.settings.register(ID,'enabled',{name:'Inevitable Return: оповещения',hint:'Предложения при отметке смерти врага. Требуется активный мастер на сцене.',scope:'world',config:true,type:Boolean,default:true});
  game.keybindings.register(ID,'reactions',{name:'Счётчик реакций vaal Tools',editable:[{key:'KeyR',modifiers:['Alt']}],onDown:()=>{void panel();return true;}});
});
Hooks.once('ready',()=>{
  if(game.system.id!=='pf2e')return;
  game.modules.get(ID).api={reactions:panel};
  installSheetControls(request);
  console.info('vaal Tools | Inevitable Return ready');
  for(const event of ['updateActor','updateToken','createItem','updateItem','deleteItem','createActiveEffect','updateActiveEffect','deleteActiveEffect','updateCombatant'])Hooks.on(event,dirty);
  Hooks.on('createChatMessage',m=>{if(gm()&&flag(m,'request'))schedule(()=>processRequest(m));});
  Hooks.on('renderChatMessageHTML',(m,html)=>{const p=flag(m,'prompt');if(p?.status!=='pending')return;for(const b of html.querySelectorAll('[data-vaal]'))b.addEventListener('click',async()=>{b.disabled=true;try{await request(b.dataset.vaal,{message:m.id});}finally{b.disabled=false;}});});
  Hooks.on('updateCombat',(combat,change)=>{if(!gm()||!('turn'in change||'round'in change))return;schedule(async()=>{
    for(const m of game.messages){const p=flag(m,'prompt');if(p?.status==='pending')await m.update({content:card(p,'expired'),[`flags.${ID}.prompt.status`]:'expired'});}
    if(combat.combatant?.actor)await combat.combatant.actor.setFlag(ID,'reactions',{});
  });});
  const initialize=()=>schedule(async()=>{if(!gm()||!canvas.scene)return;for(const t of canvas.scene.tokens)if(dead(t)&&!flag(t,'death'))await t.setFlag(ID,'death',foundry.utils.randomID());});
  Hooks.on('canvasReady',initialize);
  initialize();
});
