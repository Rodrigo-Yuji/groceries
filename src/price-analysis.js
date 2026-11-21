import {distinctPriceLines,normalize,originalPrice} from './domain.js';
import {readPackage} from './receipt-names.js';

export function purchasePrices(purchases){
 return purchases.flatMap((purchase,index)=>distinctPriceLines(purchase.lines.filter(line=>!line.adHoc&&!(line.generic&&!line.productId))).map(line=>({
  ...line,market:purchase.market,date:purchase.date,order:purchase.createdAt??index,purchaseId:purchase.id??index
 }))).sort((a,b)=>b.date.localeCompare(a.date)||b.order-a.order);
}

export const hasPackageSize=item=>item.size>1||(item.size>0&&['kg','g','L','ml'].includes(item.packUnit));

export function latestCatalogPrice(product,prices){
 const pack=analysisPackage(product,product.name);
 return prices.find(line=>{
  if(!Number.isFinite(line.price)||line.price<0||(line.unit||'un')!==(product.unit||'un'))return false;
  const linePack=analysisPackage(line,product.name);
  const matches=(product.id&&line.productId===product.id)||nameKey(line.name,linePack)===nameKey(product.name,pack);
  return matches&&(!pack.size||JSON.stringify(packageKey(linePack))===JSON.stringify(packageKey(pack)));
 });
}

export function discountPerUnit(line){
 if(line?.price==null)return null;
 if(Number.isFinite(line.discount)&&line.quantity>0)return Math.max(0,line.discount/line.quantity);
 return Math.max(0,(originalPrice(line)??line.price)-line.price);
}

function analysisPackage(line,name){
 if(hasPackageSize(line))return {size:line.size,packUnit:line.packUnit||'un'};
 return readPackage(line.name)||readPackage(name)||{size:undefined,packUnit:undefined};
}
function packageKey({size,packUnit}){
 if(!size)return '';
 if(packUnit==='kg')return [Math.round(size*1e6)/1000,'g'];
 if(packUnit==='L')return [Math.round(size*1e6)/1000,'ml'];
 return [size,packUnit];
}
function nameKey(name,pack){
 const measured=/\b\d+(?:[.,]\d+)?\s*(?:kg|ml|lt|g|l)\b/gi;
 const withoutMeasure=pack.size&&['kg','g','ml','L'].includes(pack.packUnit)?name.replace(measured,' '):name;
 return normalize(withoutMeasure);
}
export function priceSeries(prices,products,sectors){
 const series=new Map();
 for(const line of prices){
  if(!(Number.isFinite(line.price)&&line.price>=0))continue;
  const product=products.find(p=>p.id===line.productId)||products.find(p=>normalize(p.name)===normalize(line.name));
  const name=product?.name||line.name;
  const pack=analysisPackage(line,name);
  const key=JSON.stringify([nameKey(name,pack),normalize(line.presentation),line.unit||'un',packageKey(pack)]);
  if(!series.has(key)){
   const savedSector=product?.sector||line.sector;
   series.set(key,{name,presentation:line.presentation,unit:line.unit||'un',...pack,
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
 const pack=analysisPackage(item,item.name);
 return series.filter(group=>nameKey(group.name,group)===nameKey(item.name,pack)&&group.unit===(item.unit||'un')&&
  (!pack.size||JSON.stringify(packageKey(group))===JSON.stringify(packageKey(pack)))&&
  (!item.presentation||normalize(group.presentation)===normalize(item.presentation)));
}

export function searchPriceSeries(series,query){
 const term=normalize(query);
 return series.filter(item=>
  normalize([item.name,item.presentation,item.sector].join(' ')).includes(term)||
  item.points.some(point=>normalize(point.name+' '+point.market).includes(term))
 );
}

export function priceChartTimeline(series){
 return [...series.points].sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order);
}

export function filterAndSortPrices(series,trend,sort){
 const values={
  product:item=>item.name,
  latest:item=>item.latest.price,
  change:item=>item.change,
  market:item=>latestByMarket(item)[0]?.market
 };
 const value=values[sort.key]||values.product;
 const direction=sort.direction==='descending'?-1:1;
 return series.filter(item=>trend==='up'?item.change>0:trend==='down'?item.change<0:true)
  .map(item=>({item,value:value(item)}))
  .sort((a,b)=>{
   if(a.value==null||b.value==null)return Number(a.value==null)-Number(b.value==null);
   const order=typeof a.value==='number'?a.value-b.value:String(a.value).localeCompare(String(b.value),'pt-BR');
   return direction*order;
  }).map(({item})=>item);
}
