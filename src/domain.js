export const DEFAULT_SECTORS = ['Hortifruti','Padaria','Laticínios','Carnes e ovos','Mercearia','Bebidas','Limpeza','Higiene','Tecnologia','Sem setor'];
export const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
export const number = v => Number(String(v ?? '').replace(/\s/g,'').replace(',','.'));
export function suggestSector(name, available=DEFAULT_SECTORS) {
 const n=normalize(name);
 const byName=new Map(available.map(label=>[normalize(label),label]));
 const custom=available.find(label=>label!=='Sem setor'&&!DEFAULT_SECTORS.includes(label)&&(' '+n+' ').includes(' '+normalize(label)+' '));
 if(custom)return custom;
 const groups=[
  [['Tecnologia'],/\b(carregador|cabo usb|pendrive|pen drive|fone de ouvido|mouse|teclado|adaptador usb|pilha|pilhas|bateria|cartao de memoria|hdmi)\b/],
  [['Salgadinhos','Mercearia'],/\b(salgadinh\w*|chips|doritos|cheetos|ruffles|fandangos|baconzitos|pipoca|popcor\w*)\b/],
  [['Higiene'],/\b(sabonete|shampoo|xampu|condicionador|papel higienico|creme dental|desodorante|absorvente|fralda)\b/],
  [['Limpeza'],/\b(detergente|sabao|amaciante|desinfetante|esponja|alvejante|agua sanitaria|limpa vidros|multiuso)\b/],
  [['Laticínios'],/\b(leite|queijo|iogurte|manteiga|requeijao|creme de leite|coalhada|muss\w*|mozzarella|mucarela|burrata|ricota)\b/],
  [['Carnes e ovos'],/\b(carne|frango|ovos?|peixe|bife|linguica|file peito|peito de frango|tilapia|patinho|acem|calabresa)\b/],
  [['Hortifruti'],/\b(banana|maca|alface|tomate|batata|cebola|cenoura|fruta|limao|laranja|abac\w*|brocol\w*|verdura|alho|pepino|manga|pera|mamao|coentro|salsinha)\b/],
  [['Padaria'],/\b(pao|bolo|torrada|croissant|baguete|bisnaguinha)\b/],
  [['Bebidas'],/\b(agua|suco|refrigerante|cerveja|vinho|energetico|coca cola|guarana|fanta)\b/],
  [['Mercearia'],/\b(arroz|feijao|cafe|acucar|sal|oleo|azeite|macarrao|farinha|molho|biscoito|bolacha|farofa|nutella|creme de avela|leite condensado|l cond|milho|aveia|chocolate)\b/],
 ];
 if(/\b(leite condensado|l cond)\b/.test(n))return byName.get('mercearia')||'Sem setor';
 for(const [names,rule] of groups){
  if(rule.test(n))return names.map(value=>byName.get(normalize(value))).find(Boolean)||'Sem setor';
 }
 return 'Sem setor';
}
export function purchaseItem(item,qty,price) {
 if(!Number.isFinite(qty)||qty<=0||qty>item.quantity) throw Error('Informe uma quantidade entre zero e a quantidade pedida.');
 if(price!==null&&(!Number.isFinite(price)||price<0)) throw Error('Informe um preço válido.');
 return {...item,bought:qty,paidPrice:price};
}
export const isAdHocRequest=item=>Boolean(item&&(item.generic||!item.productId));

export function finishPurchase(items,market,date) {
 const bought=items.filter(i=>i.bought>0);
 if(!bought.length) throw Error('Marque pelo menos um produto comprado.');
 const lines=bought.map(i=>{const price=Object.hasOwn(i,'paidPrice')?i.paidPrice:i.price;const {quickNote,...line}=i;return {...line,...(isAdHocRequest(i)?{adHoc:true}:{}),price,quantity:i.bought,total:price==null?null:Math.round(i.bought*price*100)/100};});
 const remaining=items.flatMap(i=>{if(!i.bought)return [i];const {paidPrice,...rest}=i;return i.quantity>i.bought?[{...rest,quantity:Math.round((i.quantity-i.bought)*1000)/1000,bought:0}]:[];});
 return {purchase:{market:market.trim()||'Mercado não informado',date,lines,total:lines.reduce((s,i)=>s+i.total,0)},remaining};
}
export function unitPrice(price,size,unit) {
 if(!(size>0)||price==null||!(price>=0))return null;
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

export const originalPrice=line=>line.originalPrice??(line.price==null?null:line.price+(line.discount||0)/line.quantity);

export function distinctPriceLines(lines){
 const priceKey=price=>price==null?null:Number(price.toFixed(10));
 const seen=new Set();
 return lines.filter(line=>{
  const key=JSON.stringify([
   normalize(line.name),normalize(line.presentation),line.unit||'un',line.size??null,
   line.packUnit||'un',priceKey(originalPrice(line)),priceKey(line.price),line.allocatedDiscount>0
  ]);
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
}

export function comparePackages(a,b){
 const convert=item=>Number.isFinite(item.price)&&Number.isFinite(item.quantity)&&['un','g','kg','ml','L'].includes(item.unit)?
  unitPrice(item.price,item.quantity,item.unit):null;
 const first=convert(a),second=convert(b);
 if(!first||!second)return {status:'incomplete'};
 if(first.unit!==second.unit)return {status:'incompatible'};
 const difference=Math.abs(first.value-second.value),higher=Math.max(first.value,second.value);
 const winner=difference<=Number.EPSILON*Math.max(1,higher)*8?null:first.value<second.value?'A':'B';
 return {status:'comparable',first,second,winner,savings:winner?difference/higher*100:0};
}
