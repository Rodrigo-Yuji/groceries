import {normalize} from './domain.js';
import {requestSearchKey} from './catalog-search.js';

const measures={g:[1,'mass'],kg:[1000,'mass'],ml:[1,'volume'],L:[1000,'volume']};
const counted=new Set(['un','pacote']);

export function requestedQuantity(line,request){
 const from=line.unit||'un',to=request.unit||'un';
 if(!Number.isFinite(line.quantity)||line.quantity<=0)return null;
 if(from===to||counted.has(from)&&counted.has(to))return line.quantity;
 const requested=measures[to];
 if(!requested)return null;
 const supplied=measures[from]||(counted.has(from)&&line.size>0?measures[line.packUnit]:null);
 if(!supplied||requested[1]!==supplied[1])return null;
 const quantity=line.quantity*supplied[0]*(measures[from]?1:line.size)/requested[0];
 return Math.round(quantity*1000)/1000||null;
}
function includesTokens(request,line){
 const words=normalize(request).split(' ').filter(Boolean);
 if(!words.length||words.join('').length<4)return false;
 const candidate=new Set(normalize(line).split(' '));
 return words.every(word=>candidate.has(word));
}
function packageConflict(line,request){
 if(!(request.size>0&&measures[request.packUnit]&&line.size>0&&measures[line.packUnit]))return false;
 const a=measures[request.packUnit],b=measures[line.packUnit];
 return a[1]!==b[1]||Math.abs(request.size*a[0]-line.size*b[0])>.001;
}
export function suggestRequestLinks(lines,requests,aliases){
 const matched=lines.map(line=>{
  const names=new Set([line.name,line.sourceName].map(normalize).filter(Boolean));
  const compatible=requests.filter(request=>requestedQuantity(line,request)!==null&&!packageConflict(line,request));
  const exact=compatible.filter(request=>{
   const key=normalize(request.name);
   const saved=aliases.find(alias=>alias.key===key);
   return names.has(key)||(saved&&names.has(normalize(saved.name)));
  });
  if(exact.length)return {exact};
  return {generic:compatible.filter(request=>[...names].some(name=>includesTokens(request.name,name))||
   aliases.some(alias=>alias.key===requestSearchKey(request.name,line.name)))};
 });
 return matched.map(({exact,generic},index)=>{
  if(exact)return exact.length===1?exact[0].id:'';
  if(generic.length!==1)return '';
  const [{id}]=generic;
  if(matched.some(entry=>entry.exact?.some(item=>item.id===id)))return '';
  const names=new Set(matched.flatMap((entry,i)=>entry.generic?.some(item=>item.id===id)?[normalize(lines[i].name)]:[]));
  return names.size===1&&normalize(lines[index].name)?id:'';
 });
}
