import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedQuantity,suggestRequestLinks} from './receipt-links.js';

test('sugere uma correspondência única para pedido avulso e converte embalagem em peso',()=>{
 const request={id:'a',name:'Calabresa',quantity:2,unit:'kg'};
 const line={name:'Linguiça calabresa - Sadia 500 g',unit:'pacote',quantity:2,size:500,packUnit:'g'};
 assert.equal(requestedQuantity(line,request),1);
 assert.deepEqual(suggestRequestLinks([line],[request],[]),['a']);
 assert.deepEqual(suggestRequestLinks([line,line],[request],[]),['a','a']);
 assert.deepEqual(suggestRequestLinks([line],[{...request,unit:'ml'}],[]),['']);
});
test('não adivinha qual variante vincular quando um pedido genérico combina com duas',()=>{
 const request={id:'a',name:'Leite',quantity:1,unit:'un'};
 const lines=[{name:'Leite integral',unit:'un',quantity:1},{name:'Leite sem lactose',unit:'un',quantity:1}];
 assert.deepEqual(suggestRequestLinks(lines,[request],[]),['','']);
 assert.deepEqual(suggestRequestLinks(lines,[{...request,name:'Leite integral'}],[]),['a','']);
});
test('não sugere embalagem diferente e respeita associações salvas',()=>{
 const request={id:'a',name:'Achocolatado',quantity:1,unit:'un',size:400,packUnit:'g'};
 const line={name:'Choco teste',unit:'un',quantity:1,size:500,packUnit:'g'};
 const aliases=[{key:'achocolatado',name:'Choco teste'}];
 assert.deepEqual(suggestRequestLinks([line],[request],aliases),['']);
 assert.deepEqual(suggestRequestLinks([{...line,size:400}],[request],aliases),['a']);
});
