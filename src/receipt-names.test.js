import test from 'node:test';
import assert from 'node:assert/strict';
import {marketName,receiptName,suggestReceiptNames} from './receipt-names.js';
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

test('consulta produtos novos por código e preserva correções e nomes originais',async()=>{
 const calls=[];
 const fetchProduct=async url=>{
  calls.push(url);
  return {ok:true,json:async()=>({product:{code:'7891095008452',product_name_pt:'Pipoca Manteiga de Cinema',brands:'Yoki',quantity:'100 g'}})};
 };
 const lines=[
  {name:'PIP PCT A',barcode:'7891095008452'},
  {name:'PIP PCT B',barcode:'7891095008452'},
  {name:'ABC XYZ',barcode:'SEM GTIN'},
 ];
 const results=await suggestReceiptNames(lines,[],[{key:'pip pct b',name:'Minha pipoca'}],[],fetchProduct);
 assert.equal(calls.length,1);
 assert.equal(results[0].name,'Pipoca Manteiga de Cinema - Yoki 100 g');
 assert.equal(results[0].sourceName,'PIP PCT A');
 assert.equal(results[1].name,'Minha pipoca');
 assert.equal(results[2].name,'ABC XYZ');
 assert.equal(receiptName('OVO BCO GRANDE C/30',[],[]),'Ovos brancos grandes, 30 un');
});

test('interpreta descrições da nova nota e mantém as abreviações ambíguas',()=>{
 const name=raw=>receiptName(raw,[],[]);
 assert.equal(name('P FORMA VISC TR 400G'),'Pão de forma tradicional - Visconti 400g');
 assert.equal(name('BEB MONSTER 473ML TR'),'Energético Monster tradicional 473 mL');
 assert.equal(name('BEB MONSTER 473ML AZ'),'Energético Monster azul 473 mL');
 assert.equal(name('ACEM S/O BOV FC kg'),'Acém bovino sem osso');
 assert.equal(name('M PIM MEND 215ML DEF'),'M PIM MEND 215ML DEF');
});

test('preserva gramatura do cupom ou do código de barras e aceita medidas decimais',async()=>{
 const result=await suggestReceiptNames([
  {name:'Doritos Sabor Queijo Nacho 90G'},
  {name:'DOR NACHO',barcode:'3017620422003'},
  {name:'PATINHO BOV FC kg'},
  {name:'ACH TOD SACH 1,02kg'},
  {name:'LT INT COMPLEITE 1LT'},
  {name:'FILTRO 3 COR 102 30U'},
  {name:'COND OX 400ML NUT IN'},
  {name:'SH OX 400ML NUTR INT'}
 ],[],[],[],async()=>({ok:true,json:async()=>({product:{code:'3017620422003',product_name_pt:'Doritos Sabor Queijo Nacho',product_quantity:100,product_quantity_unit:'g'}})}));
 assert.deepEqual(result.map(line=>[line.name,line.size,line.packUnit]),[
  ['Doritos Sabor Queijo Nacho 90G',90,'g'],
  ['Doritos Sabor Queijo Nacho 100 g',100,'g'],
  ['Patinho bovino',undefined,undefined],
  ['Achocolatado em pó - Toddy, sachê 1,02 kg',1.02,'kg'],
  ['Leite integral - Compleite 1 L',1,'L'],
  ['Filtro de café nº 102 - 3 Corações, 30 un',undefined,undefined],
  ['Condicionador Nutrição Intensa - OX 400 mL',400,'ml'],
  ['Shampoo Nutrição Intensa - OX 400 mL',400,'ml']
 ]);
 assert.equal(result[3].sourceName,'ACH TOD SACH 1,02kg');
});
