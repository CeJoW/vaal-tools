import {ability,remaining} from './core.mjs';
const ID='vaal-tools';
export function installSheetControls(request){
  Hooks.on('renderActorSheet',(app,html)=>{
    const actor=app.actor??app.document,root=html instanceof HTMLElement?html:html?.[0];
    if(actor?.type!=='character'||!actor.isOwner||!root)return;
    root.querySelectorAll('[data-vaal-sheet]').forEach(e=>e.remove());
    const current=remaining(actor.getFlag(ID,'reactions')??{},Boolean(ability(actor,'endless-return')));
    const header=root.querySelector('[data-action="create-item"][data-action-type="reaction"]')?.closest('header');
    if(header){
      const counter=document.createElement('span');counter.dataset.vaalSheet='counter';
      counter.textContent=` Реакции: ${current.normal}/1${current.extra?' (+1 Inevitable Return)':''}`;
      counter.title='Общий запас для всех реакций. Восстанавливается в начале вашего хода.';
      counter.style.cssText='font-weight:bold;margin:0 8px;font-size:12px';header.append(counter);
    }
    for(const row of root.querySelectorAll('li.action[data-item-id]')){
      const item=actor.items.get(row.dataset.itemId);
      if(item?.actionCost?.type!=='reaction')continue;
      const isReturn=ability(actor,'inevitable-return')?.id===item.id;
      const native=row.querySelector('[data-action="use-action"]');
      if(native)native.hidden=true;
      const button=document.createElement('button');button.type='button';button.dataset.vaalSheet='use';button.className='use-action';
      button.textContent='USE ↶';button.title=isReturn?'Использовать актуальное предложение Inevitable Return':'Использовать реакцию: потратить общий запас и отправить способность в чат';
      button.disabled=(isReturn?current.normal+current.extra:current.normal)===0||(item.system.frequency?.value===0);
      button.addEventListener('click',async event=>{
        event.preventDefault();event.stopPropagation();button.disabled=true;
        try{
          if(isReturn){
            const prompts=game.messages.filter(m=>{const p=m.getFlag(ID,'prompt');return p?.actor===actor.uuid&&p.status==='pending'&&Date.now()-p.created<=120000;});
            if(!prompts.length){ui.notifications.info('Нет актуального предложения Inevitable Return. Сначала отметьте смерть подходящего врага.');return;}
            if(prompts.length>1){ui.notifications.info('Есть несколько целей: выберите нужное предложение в чате.');return;}
            await request('use',{message:prompts[0].id});
          }else await request('sheet-use',{actor:actor.uuid,item:item.id});
        }finally{button.disabled=false;}
      });
      (row.querySelector('.button-group')??row).append(button);
    }
  });
}
