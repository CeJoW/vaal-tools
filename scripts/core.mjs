export const SOURCE='Compendium.pf2e.actionspf2e.Item.9KkkDjNz5HMtutwA';
export const ability=(a,s)=>a.items.find(i=>i.slug===s||i.system?.slug===s||(s==='inevitable-return'&&i.sourceId===SOURCE));
export function eligible(p){return Boolean(p.ability&&p.canAct&&p.enemy&&['sm','med'].includes(p.size)&&Number.isFinite(p.distance)&&p.distance<=30&&p.available>0&&p.sameLevel);}
export function remaining(s={},extra=false){return {normal:s.normalSpent?0:1,extra:extra&&!s.extraSpent?1:0};}
export function spend(s,extra){const r=remaining(s,extra);if(r.extra)return {...s,extraSpent:true};if(r.normal)return {...s,normalSpent:true};throw Error('Реакция уже потрачена.');}
