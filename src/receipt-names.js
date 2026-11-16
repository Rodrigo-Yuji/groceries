import {normalize} from './domain.js';

export const marketAliasKey=name=>normalize(name)?'market:'+normalize(name):'';

export function receiptName(raw,products,aliases,history=[]){
 const key=normalize(raw);
 const learned=aliases.find(row=>row.key===key)?.name||
  history.flatMap(p=>p.lines||[]).find(line=>normalize(line.sourceName)===key&&normalize(line.name)!==key)?.name;
 if(learned)return learned;
 const exact=products.find(product=>normalize(product.name)===key);
 const suggestion=expandReceiptName(raw);
 if(exact&&exact.name!==raw)return exact.name;
 return products.find(product=>normalize(product.name)===normalize(suggestion))?.name||suggestion;
}

const receiptRules=[
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
