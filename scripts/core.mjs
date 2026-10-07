export const SOURCE='Compendium.pf2e.actionspf2e.Item.9KkkDjNz5HMtutwA';
export const usesFeet=units=>['ft','ft.','feet','foot','фут','футы','футов','фут.'].includes(String(units??'').trim().toLowerCase());
export const normalizeState=(s={})=>({normalSpent:false,extraSpent:false,normalOperation:null,extraOperation:null,...s});
export const resetState=()=>({normalSpent:false,extraSpent:false,normalOperation:null,extraOperation:null});
export function refundOperation(s,slot,operation){
  if(!['normal','extra'].includes(slot)||s[`${slot}Operation`]!==operation)return s;
  return {...s,[`${slot}Spent`]:false,[`${slot}Operation`]:null};
}
export const ability=(a,s)=>a.items.find(i=>i.slug===s||i.system?.slug===s||(s==='inevitable-return'&&i.sourceId===SOURCE));
export function eligible(p){return Boolean(p.ability&&p.canAct&&p.enemy&&['sm','med'].includes(p.size)&&Number.isFinite(p.distance)&&p.distance<=30&&p.available>0&&p.sameLevel);}
export function remaining(s={},extra=false){return {normal:s.normalSpent?0:1,extra:extra&&!s.extraSpent?1:0};}
export function spend(s,extra){const r=remaining(s,extra);if(r.extra)return {...s,extraSpent:true};if(r.normal)return {...s,normalSpent:true};throw Error('Реакция уже потрачена.');}
