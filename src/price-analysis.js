import {distinctPriceLines,normalize,originalPrice} from './domain.js';

export function purchasePrices(purchases){
 return purchases.flatMap((purchase,index)=>distinctPriceLines(purchase.lines).map(line=>({
  ...line,market:purchase.market,date:purchase.date,order:purchase.createdAt??index,purchaseId:purchase.id??index
 }))).sort((a,b)=>b.date.localeCompare(a.date)||b.order-a.order);
}

export function latestCatalogPrice(product,prices){
 return prices.find(line=>line.price!=null&&(
  (product.id&&line.productId===product.id)||normalize(line.name)===normalize(product.name)
 )&&(line.unit||'un')===(product.unit||'un')&&(
  !(product.size>1)||(line.size===product.size&&(line.packUnit||'un')===(product.packUnit||'un'))
 ));
}

export function discountPerUnit(line){
 if(line?.price==null)return null;
 if(Number.isFinite(line.discount)&&line.quantity>0)return Math.max(0,line.discount/line.quantity);
 return Math.max(0,(originalPrice(line)??line.price)-line.price);
}

export function priceSeries(prices,products,sectors){
 const series=new Map();
 for(const line of prices){
  if(!(Number.isFinite(line.price)&&line.price>=0))continue;
  const product=products.find(p=>p.id===line.productId)||products.find(p=>normalize(p.name)===normalize(line.name));
  const name=product?.name||line.name;
  const key=JSON.stringify([normalize(name),normalize(line.presentation),line.unit||'un',line.size??1,line.packUnit||line.unit||'un']);
  if(!series.has(key)){
   const savedSector=product?.sector||line.sector;
   series.set(key,{name,presentation:line.presentation,unit:line.unit||'un',size:line.size,packUnit:line.packUnit,
    sector:sectors.includes(savedSector)?savedSector:'Sem setor',observations:new Map()});
  }
  const observations=series.get(key).observations;
  const observed=observations.get(line.purchaseId);
  if(observed){observed.sum+=line.price;observed.count++;}
  else observations.set(line.purchaseId,{line,sum:line.price,count:1});
 }
 return [...series.values()].map(({observations,...item})=>{
  const points=[...observations.values()].map(({line,sum,count})=>({...line,price:sum/count}));
  const latest=points[0],first=points.at(-1);
  const change=points.length>1&&first.price>0?(latest.price/first.price-1)*100:null;
  return {...item,points,latest,first,change};
 }).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}

export function sectorChanges(series,sectors){
 return sectors.flatMap(sector=>{
  const items=series.filter(item=>item.sector===sector&&item.change!=null);
  if(!items.length)return [];
  return [{sector,count:items.length,change:items.reduce((sum,item)=>sum+item.change,0)/items.length}];
 });
}

export function latestByMarket(series){
 const last=new Map();
 for(const point of series.points){
  const key=normalize(point.market);
  if(key&&!last.has(key))last.set(key,point);
 }
 return [...last.values()].sort((a,b)=>a.price-b.price||b.date.localeCompare(a.date));
}

export function matchingPriceSeries(item,series){
 return series.filter(group=>normalize(group.name)===normalize(item.name)&&group.unit===(item.unit||'un')&&
  (!(item.size>1)||(group.size===item.size&&(group.packUnit||'un')===(item.packUnit||'un')))&&
  (!item.presentation||normalize(group.presentation)===normalize(item.presentation)));
}
