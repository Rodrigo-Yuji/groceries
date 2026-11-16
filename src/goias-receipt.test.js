import test from 'node:test';
import assert from 'node:assert/strict';
import {readGoiásLines,receiptAmount} from './goias-receipt.js';

test('lê quantidade fracionada, valor de linha e itens repetidos no DANFE de Goiás',()=>{
 const text=[
  'CEBOLA NAC kg (Código: 7832) Qtde.:0,716 UN: Kg Vl. Unit.: 7,79 Vl. Total 5,57',
  'FAROFA 400G (Código: 1187448) Qtde.:1 UN: PC Vl. Unit.: 11,89 Vl. Total 11,89',
  'FAROFA 400G (Código: 1187448) Qtde.:1 UN: PC Vl. Unit.: 11,89 Vl. Total 11,89',
  'Descontos R$: 6,90 Valor a pagar R$: 169,39'
 ].join('\n');
 const lines=readGoiásLines(text);
 assert.equal(lines.length,3);
 assert.equal(lines[0].quantity,.716);
 assert.equal(Math.round(lines[0].quantity*lines[0].price*100),557);
 assert.deepEqual(lines[1],lines[2]);
 assert.equal(receiptAmount(text,'Descontos?'),6.9);
 assert.equal(receiptAmount(text,'Valor a pagar'),169.39);
});
