import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,finishPurchase,purchaseItem,receiptFingerprint,unitPrice} from './domain.js';

test('normaliza acentos e espaços preservando variantes', () => {
 assert.equal(normalize('  CAFÉ   em pó '),normalize('cafe em po'));
 assert.notEqual(normalize('leite integral'),normalize('leite sem lactose'));
});

test('finalizar registra a compra parcial e preserva o saldo e os demais pedidos', () => {
 const item={id:'a',name:'Tomate',quantity:1.250,bought:0,price:0};
 const pending={id:'b',name:'Arroz',quantity:1,bought:0};
 const {purchase,remaining}=finishPurchase([purchaseItem(item,.5,7.8),pending],'Mercado','2026-11-16');
 assert.equal(purchase.total,3.9);
 assert.equal(purchase.lines[0].quantity,.5);
 assert.equal(remaining[0].quantity,.75);
 assert.deepEqual(remaining[1],pending);
});

test('converte gramas e mililitros para o preço de referência', () => {
 assert.deepEqual(unitPrice(9,500,'g'),{value:18,unit:'kg'});
 assert.deepEqual(unitPrice(4,250,'ml'),{value:16,unit:'L'});
});

test('a ordem de revisão não altera a identificação do cupom', () => {
 const lines=[{name:'Pão',quantity:2,price:3},{name:'Suco',quantity:1,price:4}];
 assert.equal(receiptFingerprint(lines,'Mercado','2026-11-16'),receiptFingerprint([...lines].reverse(),'mercado','2026-11-16'));
});
