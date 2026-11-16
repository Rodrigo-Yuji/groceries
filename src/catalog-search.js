import {normalize} from './domain.js';

const words={
 mussarela:'mucarela',mussarelas:'mucarela',mucarelas:'mucarela',mozarela:'mucarela',mozzarella:'mucarela',
 calabresas:'calabresa',linguicas:'linguica',ovos:'ovo',leites:'leite',paes:'pao',tomates:'tomate',
 bananas:'banana',cebolas:'cebola',batatas:'batata',pilhas:'pilha',biscoitos:'biscoito',bolacha:'biscoito',bolachas:'biscoito'
};
const requestSearchPrefix='request-search:';
export const requestSearchKey=(request,product)=>requestSearchPrefix+normalize(request)+'|'+normalize(product);

function searchTerms(value){
 return normalize(value).split(' ').filter(Boolean).map(word=>Object.hasOwn(words,word)?words[word]:word);
}

export function catalogSuggestions(query,products,aliases){
 const term=normalize(query);
 if(term.length<3)return [];
 const tokens=searchTerms(query);
 const matches=product=>{
  const name=normalize(product.name);
  const relevant=aliases.some(alias=>(alias.key===term||alias.key.startsWith(requestSearchPrefix+term+'|'))&&normalize(alias.name)===name);
  const available=searchTerms(product.name+' '+(product.presentation||''));
  if(relevant||name===term)return 2;
  return tokens.every(token=>available.some(word=>word===token||token.length>=4&&word.startsWith(token)))?1:0;
 };
 return products.map(product=>({product,score:matches(product)})).filter(entry=>entry.score>0)
  .sort((a,b)=>b.score-a.score||a.product.name.localeCompare(b.product.name,'pt-BR')).map(entry=>entry.product);
}

export function equivalentRequestNames(a,b){
 const canonical=value=>{
  const tokens=searchTerms(value);
  return tokens.includes('calabresa')?tokens.filter(token=>token!=='linguica').sort().join(' '):tokens.sort().join(' ');
 };
 const first=canonical(a);
 return Boolean(first&&first===canonical(b));
}
