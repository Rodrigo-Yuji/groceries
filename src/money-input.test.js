import test from 'node:test';
import assert from 'node:assert/strict';
import {maskMoney} from './money-input.js';

test('digitar centavos mostra o dinheiro em formato brasileiro',()=>{
 assert.deepEqual(maskMoney('2500'),{text:'25,00',value:'25.00'});
 assert.deepEqual(maskMoney('1'),{text:'0,01',value:'0.01'});
 assert.deepEqual(maskMoney('R$ 1.234,56'),{text:'1.234,56',value:'1234.56'});
 assert.deepEqual(maskMoney(''),{text:'',value:''});
});
