import test from 'node:test';
import assert from 'node:assert/strict';
import {expandAbbreviations,matchKnownName} from './receipt-expansion.js';
import {knownNames,receiptName,suggestReceiptNames} from './receipt-names.js';

test('expande abreviações comuns de cupons sem regra específica',()=>{
 assert.equal(expandAbbreviations('BISC RECH TRAKINAS 126G MOR'),'Biscoito recheado Trakinas morango 126g');
 assert.equal(expandAbbreviations('REFRIG COCA COLA 2L'),'Refrigerante Coca-Cola 2 L');
 assert.equal(expandAbbreviations('CERV SKOL LT 350ML'),'Cerveja Skol lata 350 mL');
 assert.equal(expandAbbreviations('PAP HIG NEVE 12UN'),'Papel higiênico Neve 12 un');
 assert.equal(expandAbbreviations('SAB PO OMO 800G'),'Sabão em pó Omo 800g');
 assert.equal(expandAbbreviations('QJO MUSS FAT 150G'),'Queijo muçarela fatiado 150g');
 assert.equal(expandAbbreviations('AGUA MIN S GAS 500ML'),'Água mineral sem gás 500 mL');
 assert.equal(expandAbbreviations('CR DENT COLGATE 90G'),'Creme dental Colgate 90g');
});

test('interpreta abreviações ambíguas pelo contexto',()=>{
 assert.equal(expandAbbreviations('FRANGO INT CONG KG'),'Frango inteiro congelado');
 assert.equal(expandAbbreviations('ARROZ INT CAMIL 1KG'),'Arroz integral Camil 1 kg');
 assert.equal(expandAbbreviations('LT INT ITALAC 1L'),'Leite integral Italac 1 L');
});

test('não adivinha quando a descrição tem abreviações desconhecidas',()=>{
 assert.equal(expandAbbreviations('M PIM MEND 215ML DEF'),null);
 assert.equal(expandAbbreviations('ABC XYZ 12'),null);
 assert.equal(expandAbbreviations('LEITE INTEGRAL'),null);
});

test('reconhece o mesmo produto escrito de outro jeito, sem misturar variantes',()=>{
 const products=[
  {name:'Leite integral - Italac 1 L',size:1,packUnit:'L'},
  {name:'Leite desnatado - Italac 1 L',size:1,packUnit:'L'},
  {name:'Iogurte natural Nestlé 170g',size:170,packUnit:'g'}
 ];
 const aliases=[{key:'det ype neutro 500ml',name:'Detergente neutro Ypê 500 mL'},{key:'gtin:7891000100103',name:'Ignorado'}];
 const known=knownNames(products,aliases);
 assert.equal(matchKnownName('LEITE INT ITALAC 1L',known),'Leite integral - Italac 1 L');
 assert.equal(matchKnownName('LT INTEG ITALAC 1LT',known),'Leite integral - Italac 1 L');
 assert.equal(matchKnownName('LT DESN ITALAC 1L',known),'Leite desnatado - Italac 1 L');
 assert.equal(matchKnownName('DETERG YPE NEUTRO 500ML',known),'Detergente neutro Ypê 500 mL');
 assert.equal(matchKnownName('LEITE ITALAC 1L',known),null,'ambíguo entre integral e desnatado');
 assert.equal(matchKnownName('LT INT ITALAC 500ML',known),null,'outra embalagem');
 assert.equal(matchKnownName('IOG NAT NESTLE 510G',known),null,'outra gramatura');
 assert.equal(receiptName('IOG NATURAL NESTLE 170G',products,[]),'Iogurte natural Nestlé 170g');
});

test('aprende pelo código de barras em qualquer mercado',async()=>{
 const history=[{lines:[{name:'Achocolatado Nescau 400g',sourceName:'ACHOC NESCAU 400G',barcode:'7891000100103'}]}];
 assert.equal(receiptName('NESCAU PO 400G',[],[],history,'7891000100103'),'Achocolatado Nescau 400g');
 assert.equal(receiptName('PIP PCT X',[],[{key:'gtin:7891095008452',name:'Pipoca da casa'}],[],'7891095008452'),'Pipoca da casa');
 let calls=0;
 const result=await suggestReceiptNames([{name:'NESCAU PO 400G',barcode:'7891000100103'}],[],[],history,async()=>{calls++;return {ok:false,status:404};});
 assert.equal(calls,0,'não consulta a internet quando já conhece o código');
 assert.equal(result[0].name,'Achocolatado Nescau 400g');
});

test('consulta bases de higiene e limpeza quando o Open Food Facts não conhece o código',async()=>{
 const sources=[];
 const result=await suggestReceiptNames([{name:'SAB DOVE ORIG 90G',barcode:'7891150019799'},{name:'DET YPE 500ML LIMAO'}],[],[],[],async url=>{
  sources.push(new URL(url).hostname);
  return url.includes('openbeautyfacts')?{ok:true,status:200,json:async()=>({product:{code:'7891150019799',product_name:'Sabonete em barra Original',countries_tags:['en:brazil'],brands:'Dove',quantity:'90 g'}})}:{ok:false,status:404};
 });
 assert.deepEqual(sources,['world.openfoodfacts.org','world.openbeautyfacts.org']);
 assert.equal(result[0].name,'Sabonete em barra Original - Dove 90 g');
 assert.equal(result[1].name,'Detergente Ypê limão 500 mL');
 assert.equal(result[1].sourceName,'DET YPE 500ML LIMAO');
});
