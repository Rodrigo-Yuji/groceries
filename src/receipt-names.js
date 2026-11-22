import {normalize} from './domain.js';
import {expandAbbreviations,matchKnownName} from './receipt-expansion.js';

export const marketAliasKey=name=>normalize(name)?'market:'+normalize(name):'';

export const barcodeAliasKey=code=>validBarcode(code)?'gtin:'+validBarcode(code):'';
const internalAlias=key=>/^(market|request-search|gtin):/.test(key);

// Names the household already uses, with how each was written on past receipts.
export function knownNames(products,aliases,history=[]){
 const names=products.map(product=>({text:product.name,name:product.name,package:product,sized:product.size>0&&['g','kg','ml','L'].includes(product.packUnit)}));
 for(const alias of aliases)if(alias.key&&!internalAlias(alias.key))names.push({text:alias.key,name:alias.name});
 for(const line of history.flatMap(purchase=>purchase.lines||[])){
  if(line.name&&line.sourceName&&!line.adHoc)names.push({text:line.sourceName,name:line.name,package:line});
 }
 return names;
}

export function receiptName(raw,products,aliases,history=[],barcode=''){
 const key=normalize(raw),code=validBarcode(barcode);
 const lines=history.flatMap(p=>p.lines||[]);
 // 1. What the household already decided: same text, or the same barcode on any receipt.
 const learned=aliases.find(row=>row.key===key)?.name||
  (code&&aliases.find(row=>row.key==='gtin:'+code)?.name)||
  (code&&lines.find(line=>validBarcode(line.barcode)===code&&line.name)?.name)||
  lines.find(line=>normalize(line.sourceName)===key&&normalize(line.name)!==key)?.name;
 if(learned)return learned;
 const exact=products.find(product=>normalize(product.name)===key);
 if(exact&&exact.name!==raw)return exact.name;
 // 2. Hand-written rules for common descriptions.
 const suggestion=expandReceiptName(raw);
 if(suggestion!==String(raw||'').trim().replace(/\s+/g,' '))return products.find(product=>normalize(product.name)===normalize(suggestion))?.name||suggestion;
 // 3. The same product written differently (another market, another abbreviation).
 return matchKnownName(raw,knownNames(products,aliases,history))||suggestion;
}

const receiptRules=[
 [/^ach tod s ach (\d+)[ ,](\d+)\s*kg$/,m=>'Achocolatado em pó - Toddy, sachê '+m[1]+','+m[2]+' kg'],
 [/^ach tod sach (\d+)[ ,](\d+)\s*kg$/,m=>'Achocolatado em pó - Toddy, sachê '+m[1]+','+m[2]+' kg'],
 [/^ach tod sach (\d+)\s*g$/,m=>'Achocolatado em pó - Toddy, sachê '+m[1]+'g'],
 [/^lt int compleite (\d+)\s*lt?$/,m=>'Leite integral - Compleite '+m[1]+' L'],
 [/^filtro 3 cor (\d+) (\d+)\s*u$/,m=>'Filtro de café nº '+m[1]+' - 3 Corações, '+m[2]+' un'],
 [/^patinho bov(?: fc)?(?: kg)?$/,'Patinho bovino'],
 [/^cond ox (\d+)\s*ml nut in(?:t)?$/,m=>'Condicionador Nutrição Intensa - OX '+m[1]+' mL'],
 [/^sh ox (\d+)\s*ml nutr int$/,m=>'Shampoo Nutrição Intensa - OX '+m[1]+' mL'],

 [/^beb monster (\d+)\s*ml tr$/,m=>'Energético Monster tradicional '+m[1]+' mL'],
 [/^beb monster (\d+)\s*ml az$/,m=>'Energético Monster azul '+m[1]+' mL'],
 [/^p forma visc tr (\d+)\s*g$/,m=>'Pão de forma tradicional - Visconti '+m[1]+'g'],
 [/^salame sadia mini(?: kg)?$/,'Salame mini - Sadia'],
 [/^carga venus c (\d+) pele$/,m=>'Refil para aparelho de depilação Venus, '+m[1]+' un'],
 [/^mini chi perd (\d+(?:[.,]\d+)?)\s*kg tr$/,m=>'Mini Chester tradicional - Perdigão '+m[1]+' kg'],
 [/^always not l(\d+)p(\d+) sv$/,m=>'Absorvente noturno - Always, leve '+m[1]+' e pague '+m[2]],
 [/^pim po mika (\d+)\s*g$/,m=>'Pimenta em pó - Mika '+m[1]+'g'],
 [/^sazon marron(?:m)? (\d+)\s*g$/,m=>'Tempero Sazón marrom '+m[1]+'g'],
 [/^sal ref lebre (\d+)\s*kg$/,m=>'Sal refinado - Lebre '+m[1]+' kg'],
 [/^acem s o bov(?: fc)?(?: kg)?$/,'Acém bovino sem osso'],
 [/^banana nanica(?: kg)?$/,'Banana nanica'],

 [/^ling calab sadia (\d+)\s*kg$/,m=>'Linguiça calabresa - Sadia '+m[1]+' kg'],
 [/^bisc mari (\d+)\s*g choc$/,m=>'Biscoito de chocolate - Marilan '+m[1]+'g'],
 [/^det ype (\d+)\s*ml care$/,m=>'Detergente Care - Ypê '+m[1]+' mL'],
 [/^ac cristal (\d+)\s*kg$/,m=>'Açúcar cristal '+m[1]+' kg'],
 [/^feij car cristal (\d+)\s*kg$/,m=>'Feijão carioca - Cristal '+m[1]+' kg'],
 [/^mac nissin carne (\d+)\s*g$/,m=>'Macarrão instantâneo sabor carne - Nissin '+m[1]+'g'],
 [/^esp bombril c (\d+)$/,m=>'Esponja - Bombril, '+m[1]+' un'],
 [/^sorv eskibon (\d+)\s*g$/,m=>'Sorvete Eskibon '+m[1]+'g'],
 [/^batata monali(?:sa)?(?: lav(?:ada)?)?(?: kg)?$/,'Batata Monalisa lavada'],
 [/^lte int italac (\d+)\s*l(?: ct)?$/,m=>'Leite integral - Italac '+m[1]+' L'],
 [/^guarana jesus (\d+)\s*lt?$/,m=>'Guaraná Jesus '+m[1]+' L'],
 [/^coca cola s ac (\d+)\s*lt?$/,m=>'Coca-Cola sem açúcar '+m[1]+' L'],
 [/^contra file frib(?:oi)?(?: fc)?$/,'Contrafilé - Friboi'],
 [/^iog itambe (\d+)\s*g floc$/,m=>'Iogurte sabor flocos - Itambé '+m[1]+'g'],
 [/^cup noodles? (\d+)\s*g cost(?:ela)?$/,m=>'Cup Noodles sabor costela '+m[1]+'g'],
 [/^cup noodles? (\d+)\s*g bolon(?:hesa)?$/,m=>'Cup Noodles sabor bolonhesa '+m[1]+'g'],
 [/^pilha pan al pal c (\d+)$/,m=>'Pilha alcalina AAA - Panasonic, '+m[1]+' un'],
 [/^mort sadia fat (\d+)\s*g$/,m=>'Mortadela fatiada - Sadia '+m[1]+'g'],
 [/^bala dori (\d+)\s*g banana$/,m=>'Bala sabor banana - Dori '+m[1]+'g'],
 [/^ovo bco grande c (\d+)$/,m=>'Ovos brancos grandes, '+m[1]+' un'],

 [/^(?:cr(?:eme)? (?:de )?av(?:ela)? )?nutella (\d+)\s*g$/,m=>'Creme de avelã - Nutella '+m[1]+'g'],
 [/^l(?:eite)? cond(?:ensado)? moca(?: la)? (\d+)\s*g$/,m=>'Leite condensado - Moça '+m[1]+'g'],
 [/^far(?:ofa)? yoki (\d+)\s*g tra(?:dicional)?$/,m=>'Farofa tradicional - Yoki '+m[1]+'g'],
 [/^file peito seara (\d+(?:[.,]\d+)?)\s*kg$/,m=>'Filé de peito de frango - Seara '+m[1]+' kg'],
 [/^pao frances(?: panb)?(?: kg)?$/,'Pão francês'],
 [/^(?:queijo )?(?:muss|mussarela|mucarela) (?:pirac|piracanjuba) fat(?:iado|iada)? (\d+)\s*g$/,m=>'Queijo mussarela fatiado - Piracanjuba '+m[1]+'g'],
 [/^(?:popcor(?:n)?|pipoca) (?:yok|yoki) (\d+)\s*g cine(?:ma)?$/,m=>'Pipoca de micro-ondas sabor manteiga de cinema - Yoki '+m[1]+'g'],
 [/^cebola nac(?:ional)?(?: kg)?$/,'Cebola nacional'],
 [/^batata ingl(?:esa)?(?: kg)?$/,'Batata inglesa'],
 [/^banana (prata|nanica)(?: kg)?$/,m=>'Banana '+m[1]],
 [/^maca (gala|fuji)(?: kg)?$/,m=>'Maçã '+m[1]],
 [/^tomate (ital|italiano)(?: kg)?$/,'Tomate italiano'],
 [/^ovos? (br|branco|brancos|verm|vermelho|vermelhos) (\d+)\s*(?:un|und)$/,m=>'Ovos '+(m[1].startsWith('br')?'brancos':'vermelhos')+' '+m[2]+' un'],
 [/^cr(?:eme)? (?:de )?leite (?:nest|nestle) (\d+)\s*g$/,m=>'Creme de leite - Nestlé '+m[1]+'g'],
 [/^l(?:eite)? (?:uht )?(int(?:egral)?|desn(?:atado)?|semi(?:desnatado)?) (?:pirac|piracanjuba) (\d+)\s*l$/,m=>'Leite '+(m[1].startsWith('int')?'integral':m[1].startsWith('desn')?'desnatado':'semidesnatado')+' - Piracanjuba '+m[2]+' L'],
 [/^det(?:ergente)? (?:liq(?:uido)? )?ype (neutro|lim[aã]o|coco|maca) (\d+)\s*ml$/,m=>'Detergente '+({limao:'limão',maca:'maçã'}[m[1]]||m[1])+' - Ypê '+m[2]+' mL'],
 [/^ac(?:ucar)? ref(?:inado)? uniao (\d+)\s*kg$/,m=>'Açúcar refinado - União '+m[1]+' kg'],
 [/^arroz (?:ag|agulhinha) (?:t1|tipo 1) (\d+)\s*kg$/,m=>'Arroz agulhinha tipo 1 '+m[1]+' kg'],
 [/^feij(?:ao)? (carioca|preto) (\d+)\s*kg$/,m=>'Feijão '+m[1]+' '+m[2]+' kg'],
 [/^oleo (?:de )?soja (\d+)\s*ml$/,m=>'Óleo de soja '+m[1]+' mL'],
 [/^extr(?:ato)? (?:de )?tom(?:ate)? (\d+)\s*g$/,m=>'Extrato de tomate '+m[1]+'g'],
];

export function expandReceiptName(raw){
 const text=String(raw||'').trim().replace(/\s+/g,' ');
 // Match the complete line so unknown variants and package sizes stay distinct.
 const key=normalize(text.replace(/(\d)[,.](\d)/g,'$1,$2')).replace(/(\d) (\d)\s*kg$/,'$1,$2 kg');
 for(const [pattern,name] of receiptRules){
  const match=key.match(pattern);
  if(match)return typeof name==='function'?name(match):name;
 }
 return text;
}

export const originalMarket=purchase=>purchase.marketSource||purchase.fingerprint?.split('|')[0]||purchase.market;

export function marketName(raw,aliases,purchases=[]){
 const key=marketAliasKey(raw);
 if(!key)return raw;
 return aliases.find(row=>row.key===key)?.name||
  purchases.find(p=>marketAliasKey(originalMarket(p))===key)?.market||raw;
}

function validBarcode(value){
 const code=String(value||'').trim();
 if(!/^(?:\d{8}|\d{12,14})$/.test(code)||/^0+$/.test(code))return '';
 const digits=[...code].map(Number);
 const check=digits.pop();
 const sum=digits.reverse().reduce((total,digit,index)=>total+digit*(index%2?1:3),0);
 return (10-sum%10)%10===check?code:'';
}

export function readPackage(text){
 const matches=[...String(text||'').matchAll(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(kg|mg|ml|lt|g|l)\b/gi)];
 const match=matches.at(-1);
 if(!match||match[2].toLowerCase()==='mg')return null;
 const unit=match[2].toLowerCase();
 const size=Number(match[1].replace(',','.'));
 return size>0?{size,packUnit:unit==='lt'||unit==='l'?'L':unit}:null;
}
function withPackage(line,display,remoteSize){
 const pack=readPackage(line.sourceName)||readPackage(remoteSize)||readPackage(display);
 if(!pack)return {...line,name:display};
 const shown=readPackage(display);
 const text=pack.size.toLocaleString('pt-BR',{maximumFractionDigits:3})+' '+pack.packUnit;
 return {...line,...pack,name:shown?display:(display+' '+text).slice(0,120)};
}

// Open Food Facts covers food; its sister databases cover hygiene and cleaning products.
const barcodeSources=['https://world.openfoodfacts.org','https://world.openbeautyfacts.org','https://world.openproductsfacts.org'];
const barcodeFields='code,product_name_pt,product_name,generic_name_pt,lang,countries_tags,brands,quantity,product_quantity,product_quantity_unit';
const CACHE_KEY='groceries-barcode-names-v1',DAY=864e5;
const barcodeNames=new Map();
function cachedBarcode(code){
 if(barcodeNames.has(code))return barcodeNames.get(code);
 try{
  const entry=JSON.parse(globalThis.localStorage?.getItem(CACHE_KEY)||'{}')[code];
  if(entry&&Date.now()-entry.at<(entry.label?90:7)*DAY)return entry.label?{label:entry.label,quantity:entry.quantity}:null;
 }catch{}
 return undefined;
}
function storeBarcode(code,entry){
 barcodeNames.set(code,entry);
 try{
  const storage=globalThis.localStorage;
  if(!storage)return;
  const all=JSON.parse(storage.getItem(CACHE_KEY)||'{}');
  all[code]={...(entry||{}),at:Date.now()};
  const codes=Object.keys(all);
  for(const old of codes.slice(0,Math.max(0,codes.length-800)))delete all[old];
  storage.setItem(CACHE_KEY,JSON.stringify(all));
 }catch{}
}
function productLabel(product,code){
 if(product?.code!==code)return null;
 const brazilian=(product.countries_tags||[]).includes('en:brazil');
 const name=String(product.product_name_pt||((product.lang==='pt'||brazilian)?product.product_name:'')||product.generic_name_pt||'').trim();
 if(!name)return null;
 const brand=String(product.brands||'').split(',')[0].trim(),quantity=String(product.quantity||(product.product_quantity&&product.product_quantity_unit?product.product_quantity+' '+product.product_quantity_unit:'')).trim();
 const label=[name,brand&&!normalize(name).includes(normalize(brand))?' - '+brand:''].join('');
 return label.length<=120?{label,quantity}:null;
}
async function lookupBarcode(code,fetchProduct,signal){
 const cached=cachedBarcode(code);
 if(cached!==undefined)return cached;
 let answered=0;
 for(const source of barcodeSources){
  try{
   const response=await fetchProduct(source+'/api/v2/product/'+code+'.json?fields='+barcodeFields,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
   if(response.status===404){answered++;continue;}
   if(!response.ok)continue;
   answered++;
   const found=productLabel((await response.json()).product,code);
   if(found){storeBarcode(code,found);return found;}
  }catch{if(signal.aborted)break;}
 }
 // Remember a miss only when every database answered, so timeouts are retried later.
 if(answered===barcodeSources.length)storeBarcode(code,null);
 return null;
}

const looksTyped=text=>/[a-zà-ú]/.test(String(text||''));
export async function suggestReceiptNames(lines,products,aliases,history,fetchProduct=fetch){
 const suggested=lines.map(line=>({...line,sourceName:line.name,name:receiptName(line.name,products,aliases,history,line.barcode)}));
 const candidates=suggested.filter(line=>line.name===line.sourceName&&validBarcode(line.barcode)&&
  !aliases.some(alias=>alias.key===normalize(line.sourceName)||alias.key===barcodeAliasKey(line.barcode)));
 const codes=[...new Set(candidates.map(line=>validBarcode(line.barcode)))].slice(0,24);
 const deadline=AbortSignal.timeout(5000);
 const remote=new Map(await Promise.all(codes.map(async code=>[code,await lookupBarcode(code,fetchProduct,deadline)])));
 const known=knownNames(products,aliases,history);
 return suggested.map(line=>{
  const found=candidates.includes(line)?remote.get(validBarcode(line.barcode)):null;
  if(found){
   // Prefer the household's own name for the same product, if it already has one.
   const own=matchKnownName(found.label+' '+found.quantity,known);
   return withPackage(line,own||found.label,found.quantity);
  }
  // 4. Last resort: spell out the abbreviations of descriptions nobody has seen before.
  const expanded=line.name===line.sourceName&&!looksTyped(line.sourceName)?expandAbbreviations(line.sourceName):null;
  return withPackage(line,expanded||line.name);
 });
}
