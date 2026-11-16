import test from 'node:test';
import assert from 'node:assert/strict';
import {marketName,receiptName} from './receipt-names.js';
import {DEFAULT_SECTORS,suggestSector} from './domain.js';

test('corrigidos pelo usuário prevalecem sobre expansões e mantêm variantes',()=>{
 const aliases=[{key:'cr av nutella 350g',name:'Nutella pequena'}];
 assert.equal(receiptName('CR AV NUTELLA 350G',[],aliases),'Nutella pequena');
 assert.equal(receiptName('CR AV NUTELLA 650G',[],aliases),'Creme de avelã - Nutella 650g');
 assert.equal(receiptName('LEITE INTEGRAL',[],aliases),'LEITE INTEGRAL');
});
test('recupera nomes corrigidos de compras antigas com a origem disponível',()=>{
 const history=[{market:'Assaí Centro',fingerprint:'sendas distribuidora s a|2026-11-16|produto',lines:[{sourceName:'Cód Mercado',name:'Aveia'}]}];
 assert.equal(marketName('Sendas Distribuidora S/A',[],history),'Assaí Centro');
 assert.equal(receiptName('CÓD MERCADO',[],[],history),'Aveia');
 assert.equal(marketName('Sendas Distribuidora S/A',[{key:'market:sendas distribuidora s a',name:'Assaí'}],history),'Assaí');
});
test('sugere setores habilitados para abreviações e produtos conhecidos',()=>{
 const sectors=[...DEFAULT_SECTORS,'Salgadinhos'];
 assert.equal(suggestSector('POPCOR YOK 100G CINE',sectors),'Salgadinhos');
 assert.equal(suggestSector('POPCOR YOK 100G CINE'),'Mercearia');
 assert.equal(suggestSector('Água sanitária',sectors),'Limpeza');
 assert.equal(suggestSector('MUSS PIRAC FAT 500G',sectors),'Laticínios');
 assert.equal(suggestSector('FAROFA YOKI 400G TRA',sectors),'Mercearia');
 assert.equal(suggestSector('Farofa',['Bebidas','Sem setor']),'Sem setor');
});

test('expande mussarela, pipoca e abreviações comuns sem adivinhar variantes',()=>{
 const name=raw=>receiptName(raw,[],[]);
 assert.equal(name('MUSS PIRAC FAT 500G'),'Queijo mussarela fatiado - Piracanjuba 500g');
 assert.equal(name('POPCOR YOK 100G CINE'),'Pipoca de micro-ondas sabor manteiga de cinema - Yoki 100g');
 assert.equal(name('POPCOR YOK 100G DOCE'),'POPCOR YOK 100G DOCE');
 assert.equal(name('CEBOLA NAC kg'),'Cebola nacional');
 assert.equal(name('EXTR TOM 300G'),'Extrato de tomate 300g');
});
