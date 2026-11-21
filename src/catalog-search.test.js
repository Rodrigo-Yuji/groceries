import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogSuggestions,equivalentRequestNames,requestSearchKey} from './catalog-search.js';
import {suggestRequestLinks} from './receipt-links.js';

const products=[
 {id:'a',name:'Queijo mussarela fatiado - Piracanjuba 500g'},
 {id:'b',name:'Linguiça calabresa - Sadia 1 kg'},
 {id:'c',name:'Linguiça calabresa - Seara 400g'},
 {id:'d',name:'Queijo cheddar'},
];

test('busca por apelido, plural e marca sem misturar as apresentações',()=>{
 assert.deepEqual(catalogSuggestions('muçarelas pirac',products,[]).map(product=>product.id),['a']);
 assert.deepEqual(catalogSuggestions('calabresa',products,[]).map(product=>product.id),['b','c']);
 assert.equal(equivalentRequestNames('linguiça calabresa','Calabresas'),true);
 assert.equal(equivalentRequestNames('Leite integral','Leite sem lactose'),false);
});
test('uma associação de pedido é reaproveitada no catálogo e na revisão',()=>{
 const alias={key:requestSearchKey('queijo para lasanha',products[0].name),name:products[0].name};
 assert.deepEqual(catalogSuggestions('queijo para lasanha',products,[alias]).map(product=>product.id),['a']);
 assert.deepEqual(suggestRequestLinks([{name:products[0].name,unit:'un',quantity:1}],[{id:'req',name:'Queijo para lasanha',unit:'un',quantity:1}],[alias]),['req']);
});
