import test from 'node:test';
import assert from 'node:assert/strict';
import {purchasePrices,latestCatalogPrice,discountPerUnit,priceSeries,sectorChanges,latestByMarket,matchingPriceSeries} from './price-analysis.js';
import {suggestSector,DEFAULT_SECTORS} from './domain.js';

const product={id:'aveia',name:'Aveia',sector:'Mercearia',unit:'un',size:500,packUnit:'g'};
const line={productId:product.id,name:product.name,unit:product.unit,quantity:1,size:product.size,packUnit:product.packUnit};
test('usa o último preço e desconto da mesma embalagem, mesmo após corrigir o valor no histórico',()=>{
 const purchases=[
  {id:'new',market:'Mercado novo',date:'2026-11-16',lines:[{...line,size:1000,price:10},{...line,price:8,originalPrice:10}]},
  {id:'old',market:'Mercado antigo',date:'2026-11-15',lines:[{...line,price:10}]}
 ];
 const price=latestCatalogPrice(product,purchasePrices(purchases));
 assert.equal(price.market,'Mercado novo');
 assert.equal(price.price,8);
 assert.equal(discountPerUnit(price),2);
 purchases[0].lines[1].price=7;
 assert.equal(latestCatalogPrice(product,purchasePrices(purchases)).price,7);
});
test('variação usa compras distintas, separa embalagens e agrega por setor',()=>{
 const purchases=[
  {id:'new',market:'Novo',date:'2026-11-16',lines:[{...line,price:7},{...line,price:9},{...line,size:1000,price:11}]},
  {id:'old',market:'Antigo',date:'2026-11-15',lines:[{...line,price:10}]}
 ];
 const series=priceSeries(purchasePrices(purchases),[product],DEFAULT_SECTORS);
 assert.equal(series.length,2);
 const comparable=series.find(item=>item.size===500);
 assert.equal(comparable.points.length,2);
 assert.equal(comparable.latest.price,8);
 assert.equal(Math.round(comparable.change),-20);
 assert.equal(series.find(item=>item.size===1000).change,null);
 const [sector]=sectorChanges(series,DEFAULT_SECTORS);
 assert.equal(sector.sector,'Mercearia');
 assert.equal(sector.count,1);
 assert.equal(Math.round(sector.change),-20);
});
test('tecnologia é sugerida para cabo USB e pilhas',()=>{
 assert.equal(suggestSector('Cabo USB-C'),'Tecnologia');
 assert.equal(suggestSector('Pilhas AAA'),'Tecnologia');
});

test('compara só o último preço pago por mercado e preserva a apresentação',()=>{
 const purchases=[
  {id:'a-new',market:'Mercado A',date:'2026-11-16',lines:[{...line,price:9}]},
  {id:'b',market:'Mercado B',date:'2026-11-15',lines:[{...line,price:8},{...line,size:1000,price:4}]},
  {id:'a-old',market:'Mercado A',date:'2026-11-12',lines:[{...line,price:5}]}
 ];
 const series=priceSeries(purchasePrices(purchases),[product],DEFAULT_SECTORS);
 const matching=matchingPriceSeries(product,series);
 assert.equal(matching.length,1);
 assert.deepEqual(latestByMarket(matching[0]).map(p=>[p.market,p.price]),[['Mercado B',8],['Mercado A',9]]);
});
