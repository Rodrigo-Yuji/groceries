import {createClient} from '@supabase/supabase-js';
import {DEFAULT_SECTORS} from './domain.js';
export const supabase=createClient('https://vdlmvlycofddjmdzffyd.supabase.co','sb_publishable_L7OvV-QDf12iD3L3IAAJag_jZ8QCK9z');
const KEY='compra-em-dia-v1';
let data;
try{data=JSON.parse(localStorage.getItem(KEY));}catch{}
export const state=data?.schema===1?data:{schema:1,household:null,records:{},queue:[],conflicts:[],name:'',lastSeen:Date.now()};
export const session={user:null,status:'local',error:''};
let callback=()=>{}; let syncing=false; let channel;
export function onChange(fn){callback=fn;}
export function persist(){localStorage.setItem(KEY,JSON.stringify(state));}
export function records(kind){return Object.values(state.records).filter(r=>r.kind===kind&&!r.deleted).map(r=>({...r.data,id:r.id}));}
export function get(id){const r=state.records[id];return r&&!r.deleted?{...r.data,id}:null;}
export function put(kind,value){
 const id=value.id||crypto.randomUUID(); const old=state.records[id];
 const {id:_,...rest}=value;
 const row={id,kind,data:rest,deleted:false,version:old?.version||0,household_id:state.household?.id};
 state.records[id]=row;
 if(state.household){const q=state.queue.find(q=>q.id===id);if(q){q.data=rest;q.deleted=false;}else state.queue.push({...row});}
 persist();callback();void sync();return id;
}
export function remove(id){const r=state.records[id];if(!r)return;r.deleted=true;if(state.household){const q=state.queue.find(q=>q.id===id);if(q)q.deleted=true;else state.queue.push({...r});}persist();callback();void sync();}
export function sectors(){return records('settings').find(x=>x.key==='sectors')?.values||DEFAULT_SECTORS;}
export function setSectors(values){const old=records('settings').find(x=>x.key==='sectors');put('settings',{id:old?.id,key:'sectors',values});}
function errorMessage(error){return /relation|schema cache|does not exist|PGRST|404/.test(error.message||'')?'O banco ainda precisa ser configurado. Consulte Configurações → Instalação do Supabase.':error.message||'Não foi possível sincronizar.';}
export async function sync(){
 if(syncing||!session.user||!state.household||!navigator.onLine)return;
 syncing=true;session.status='syncing';callback();
 try{
  while(state.queue.length){
   const q=state.queue[0]; const {version,...fields}=q;
   const result=version===0?await supabase.from('grocery_records').insert({...fields,version:1}).select().single():await supabase.from('grocery_records').update({data:q.data,deleted:q.deleted,version:version+1}).eq('id',q.id).eq('version',version).select().maybeSingle();
   if(result.error)throw result.error;
   if(!result.data){state.conflicts.push({...q,conflictAt:Date.now()});state.queue.shift();delete state.records[q.id];persist();continue;}
   state.records[q.id]=result.data;state.queue.shift();persist();
  }
  const {data,error}=await supabase.from('grocery_records').select('*').eq('household_id',state.household.id);
  if(error)throw error;
  const pending=new Set(state.queue.map(q=>q.id));
  for(const row of data)if(!pending.has(row.id))state.records[row.id]=row;
  session.status='synced';session.error='';persist();
 }catch(e){session.status='error';session.error=errorMessage(e);}finally{syncing=false;callback();}
}
export async function connectHousehold(id){
 if(state.household&&state.household.id!==id)throw Error('Saia da casa atual antes de entrar em outra.');
 const {data,error}=await supabase.from('grocery_households').select('*').eq('id',id).single();if(error)throw error;
 state.household=data;
 for(const r of Object.values(state.records))if(!r.household_id){r.household_id=id;r.version=0;state.queue.push({...r});}
 persist();
 channel?.unsubscribe();channel=supabase.channel('house-'+id).on('postgres_changes',{event:'*',schema:'public',table:'grocery_records',filter:'household_id=eq.'+id},()=>sync()).subscribe();
 await sync();
}
export async function createHouse(name){const {data,error}=await supabase.rpc('grocery_create_house',{house_name:name});if(error)throw Error(errorMessage(error));await connectHousehold(data);}
export async function joinHouse(code){const {data,error}=await supabase.rpc('grocery_join_house',{invite_code:code.trim()});if(error)throw Error(errorMessage(error));await connectHousehold(data);}
export async function initialize(){
 const {data:{session:s}}=await supabase.auth.getSession();session.user=s?.user||null;
 if(session.user){
  if(state.household)await connectHousehold(state.household.id).catch(e=>{session.error=errorMessage(e);session.status='error';});
  else {const {data,error}=await supabase.from('grocery_households').select('*').limit(1);if(data?.[0])await connectHousehold(data[0].id);if(error)session.error=errorMessage(error);}
 }
 callback();
 supabase.auth.onAuthStateChange((event,s)=>{session.user=s?.user||null;callback();if(event==='SIGNED_IN')setTimeout(()=>initializeHouse(),0);});
 window.addEventListener('online',sync);window.addEventListener('offline',()=>{session.status='offline';callback();});
 setInterval(()=>{if(document.visibilityState==='visible')void sync();},15000);
}
async function initializeHouse(){if(state.household)await connectHousehold(state.household.id).catch(()=>{});else {const {data}=await supabase.from('grocery_households').select('*').limit(1);if(data?.[0])await connectHousehold(data[0].id);}callback();}
export async function logout(){if(state.queue.length)throw Error('Sincronize as alterações pendentes antes de sair.');await supabase.auth.signOut();channel?.unsubscribe();state.household=null;state.records={};state.conflicts=[];persist();session.status='local';callback();}
