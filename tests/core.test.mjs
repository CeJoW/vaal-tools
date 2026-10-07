import test from 'node:test';
import assert from 'node:assert/strict';
import {eligible,remaining,spend,ability,SOURCE} from '../scripts/core.mjs';
const base={ability:true,canAct:true,enemy:true,size:'sm',distance:30,available:1,sameLevel:true};
test('range, size and eligibility boundaries',()=>{assert.equal(eligible(base),true);for(const patch of [{size:'lg'},{size:'tiny'},{distance:30.01},{distance:NaN},{enemy:false},{ability:false},{canAct:false},{available:0},{sameLevel:false}])assert.equal(eligible({...base,...patch}),false);assert.equal(eligible({...base,size:'med'}),true);});
test('ordinary reaction used once',()=>{const s=spend({},false);assert.equal(remaining(s).normal,0);assert.throws(()=>spend(s,false));});
test('Endless Return is consumed before general reaction',()=>{const s=spend({},true);assert.deepEqual(remaining(s,true),{normal:1,extra:0});const last=spend(s,true);assert.deepEqual(remaining(last,true),{normal:0,extra:0});assert.throws(()=>spend(last,true));});
test('ability identity independent of translation',()=>{assert.ok(ability({items:[{sourceId:SOURCE}]},'inevitable-return'));assert.ok(ability({items:[{system:{slug:'inevitable-return'}}]},'inevitable-return'));assert.equal(ability({items:[{name:'Inevitable Return'}]},'inevitable-return'),undefined);});
