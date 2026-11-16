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

export function expandReceiptName(raw){
 const text=String(raw||'').trim().replace(/\s+/g,' ');
 let match=text.match(/^(?:CR(?:EME)?\s+(?:DE\s+)?AV(?:EL[ÃA])?\s+)?NUTELLA\s+(\d+)\s*G$/i);
 if(match)return 'Creme de avelã - Nutella '+match[1]+'g';
 match=text.match(/^L(?:EITE)?\s+COND(?:ENSADO)?\s+MO[ÇC]A(?:\s+LA)?\s+(\d+)\s*G$/i);
 if(match)return 'Leite condensado - Moça '+match[1]+'g';
 match=text.match(/^FAR(?:OFA)?\s+YOKI\s+(\d+)\s*G\s+TRA(?:DICIONAL)?$/i);
 if(match)return 'Farofa tradicional - Yoki '+match[1]+'g';
 match=text.match(/^FIL[ÉE]\s+PEITO\s+SEARA\s+(\d+(?:[.,]\d+)?)\s*KG$/i);
 if(match)return 'Filé de peito de frango - Seara '+match[1]+' kg';
 match=text.match(/^P[ÃA]O\s+FRANC[ÊE]S(?:\s+PANB)?(?:\s+KG)?$/i);
 if(match)return 'Pão francês';
 return text;
}

export const originalMarket=purchase=>purchase.marketSource||purchase.fingerprint?.split('|')[0]||purchase.market;

export function marketName(raw,aliases,purchases=[]){
 const key=marketAliasKey(raw);
 if(!key)return raw;
 return aliases.find(row=>row.key===key)?.name||
  purchases.find(p=>marketAliasKey(originalMarket(p))===key)?.market||raw;
}
