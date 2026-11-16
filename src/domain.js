export const DEFAULT_SECTORS = ['Hortifruti','Padaria','Laticínios','Carnes e ovos','Mercearia','Bebidas','Limpeza','Higiene','Sem setor'];
export const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
export const number = v => Number(String(v ?? '').replace(/\s/g,'').replace(',','.'));
export function suggestSector(name) {
 const n=normalize(name);
 const groups=[['Hortifruti',/banana|maca|alface|tomate|batata|cebola|cenoura|fruta|limao|laranja|abac|brocol|verdura/],['Padaria',/pao|bolo|biscoito|torrada/],['Laticínios',/leite|queijo|iogurte|manteiga|requeijao/],['Carnes e ovos',/carne|frango|ovo|peixe|bife|linguica/],['Bebidas',/agua|suco|refrigerante|cerveja|vinho/],['Limpeza',/detergente|sabao|amaciante|desinfetante|esponja|alvejante/],['Higiene',/sabonete|shampoo|papel higienico|creme dental|desodorante/],['Mercearia',/arroz|feijao|cafe|acucar|sal\b|oleo|azeite|macarrao|farinha|molho/]];
 return groups.find(([,r])=>r.test(n))?.[0]||'Sem setor';
}
export function purchaseItem(item,qty,price) {
 if(!Number.isFinite(qty)||qty<=0||qty>item.quantity) throw Error('Informe uma quantidade entre zero e a quantidade pedida.');
 if(!Number.isFinite(price)||price<0) throw Error('Informe um preço válido.');
 return {...item,bought:qty,price};
}
export function finishPurchase(items,market,date) {
 const bought=items.filter(i=>i.bought>0);
 if(!bought.length) throw Error('Marque pelo menos um produto comprado.');
 const lines=bought.map(i=>({...i,quantity:i.bought,total:Math.round(i.bought*i.price*100)/100}));
 const remaining=items.flatMap(i=>i.quantity>i.bought?[{...i,quantity:Math.round((i.quantity-i.bought)*1000)/1000,bought:0}]:[]);
 return {purchase:{market:market.trim()||'Mercado não informado',date,lines,total:lines.reduce((s,i)=>s+i.total,0)},remaining};
}
export function unitPrice(price,size,unit) {
 if(!(size>0)||!(price>=0))return null;
 const divisor=['g','ml'].includes(unit)?size/1000:size;
 return {value:price/divisor,unit:['g','kg'].includes(unit)?'kg':['ml','L'].includes(unit)?'L':'un'};
}
// OCR is deliberately conservative: only lines ending in a monetary amount become suggestions.
export function parseReceipt(text) {
 const result=[];
 for(const raw of text.split(/\r?\n/)) {
  const line=raw.trim();
  if(/^(total|subtotal|troco|dinheiro|cart[aã]o|desconto|valor|cnpj|cpf|tribut|qtd|chave|consumidor)/i.test(line))continue;
  const match=line.match(/^(.{3,}?)\s+(\d+[.,]\d{2})\s*$/);
  if(!match||!/[a-zÀ-ÿ]{2}/i.test(match[1]))continue;
  let name=match[1].replace(/^\d{1,14}\s+/,'').trim();
  let quantity=1,price=number(match[2]);
  const q=name.match(/\s+(\d+(?:[.,]\d+)?)\s*(UN|KG|L|PC|PCT)?\s*[xX]\s*(\d+[.,]\d{2})$/i);
  if(q){quantity=number(q[1]);price=number(q[3]);name=name.slice(0,q.index).trim();}
  if(name&&quantity>0&&price>=0)result.push({name,quantity,price,unit:q?.[2]?.toLowerCase()==='kg'?'kg':'un',size:1,packUnit:'un'});
 }
 return result;
}
export function receiptFingerprint(lines,market,date){return normalize(market)+'|'+date+'|'+lines.map(i=>normalize(i.name)+':'+i.quantity+':'+i.price).sort().join('|');}
