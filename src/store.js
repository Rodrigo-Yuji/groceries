import {createClient} from '@supabase/supabase-js';
import {DEFAULT_SECTORS} from './domain.js';

export const supabase=createClient('https://vdlmvlycofddjmdzffyd.supabase.co','sb_publishable_L7OvV-QDf12iD3L3IAAJag_jZ8QCK9z');
const KEY='compra-em-dia-v1';
const fresh=()=>({schema:1,household:null,records:{},queue:[],conflicts:[],name:'',shopping:false,lastSeen:Date.now()});
function load(key){
 try {
  const saved=JSON.parse(localStorage.getItem(key));
  if(saved?.schema===1 && !saved.queue.some(row=>!Array.isArray(row.edits))) return saved;
 } catch {}
 return fresh();
}
const local=load(KEY);
export const state=local.household?fresh():local;
export const session={user:null,status:'local',error:''};
let key=KEY, callback=()=>{}, channel, epoch=0, running, operations, refresh=false;
export function onChange(fn){callback=fn;}
export function persist(){localStorage.setItem(key,JSON.stringify(state));}
const visible=row=>row&&!row.deleted?{...row.data,id:row.id}:null;
export function records(kind){return Object.values(state.records).filter(row=>row.kind===kind&&!row.deleted).map(visible);}
export function get(id){return visible(state.records[id]);}

export function batch(fn){
 if(operations)return fn();
 const before=state.records;
 state.records={...before};
 operations=new Map();
 try {
  const result=fn();
  if(state.household&&operations.size)state.queue.push({id:crypto.randomUUID(),edits:[...operations.values()]});
  persist();
  return result;
 } catch(error){
  state.records=before;
  throw error;
 } finally {
  operations=null;
  callback();
  void sync();
 }
}
function stage(row){
 const {household_id,...edit}=row;
 const original=operations.get(row.id);
 operations.set(row.id,{...edit,version:original?.version??edit.version});
 state.records[row.id]={...row,version:(original?.version??edit.version)+(state.household?1:0)};
}
export function put(kind,value){
 if(!operations)return batch(()=>put(kind,value));
 const {id=crypto.randomUUID(),...data}=value;
 const old=state.records[id];
 stage({id,kind,data,deleted:false,version:old?.version||0,household_id:state.household?.id});
 return id;
}
export function remove(id){
 if(!operations)return batch(()=>remove(id));
 const row=state.records[id];
 if(row&&!row.deleted)stage({...row,deleted:true});
}
export function sectors(){return records('settings').find(row=>row.key==='sectors')?.values||DEFAULT_SECTORS;}
export function setSectors(values){put('settings',{id:records('settings').find(row=>row.key==='sectors')?.id,key:'sectors',values});}

function fail(error){return error?.message||'Não foi possível sincronizar.';}
function rebuild(rows){
 state.records=Object.fromEntries(rows.map(row=>[row.id,row]));
 for(const entry of state.queue){
  for(const edit of entry.edits)state.records[edit.id]={...edit,version:edit.version+1,household_id:state.household.id};
 }
}
export function sync(){
 if(!session.user||!state.household||!navigator.onLine)return;
 if(running){refresh=true;return running;}
 const generation=epoch, house=state.household.id;
 running=(async()=>{
  session.status='syncing';
  callback();
  while(state.queue.length&&generation===epoch){
   const entry=state.queue[0];
   const {data,error}=await supabase.rpc('grocery_apply_batch',{house,operation:entry.id,edits:entry.edits});
   if(generation!==epoch)return;
   if(error&&!['PT409','23505'].includes(error.code))throw error;
   state.queue.shift();
   if(error){
    state.conflicts.push({...entry,message:error.code==='23505'?'Este cupom já consta no histórico.':error.message});
   }else{
    for(const row of data){
     if(!state.queue.some(next=>next.edits.some(edit=>edit.id===row.id)))state.records[row.id]=row;
    }
   }
   persist();
  }
  if(generation!==epoch)return;
  const rows=[];
  for(let offset=0;;offset+=500){
   const {data,error}=await supabase.from('grocery_records').select('*').eq('household_id',house).order('id').range(offset,offset+499);
   if(generation!==epoch)return;
   if(error)throw error;
   rows.push(...data);
   if(data.length<500)break;
  }
  rebuild(rows);
  session.status='synced';
  session.error='';
  persist();
 })().catch(error=>{
  if(generation===epoch){session.status='error';session.error=fail(error);}
 }).finally(()=>{
  running=null;
  callback();
  if(refresh){refresh=false;void sync();}
 });
 return running;
}
export function resolveConflict(index,retry){
 const [entry]=state.conflicts.splice(index,1);
 if(retry&&entry)batch(()=>{
  for(const edit of entry.edits){
   if(edit.deleted)remove(edit.id);
   else put(edit.kind,{...edit.data,id:edit.id});
  }
 });
 persist();
 callback();
}
function subscribe(id){
 channel?.unsubscribe();
 channel=supabase.channel('house-'+id).on('postgres_changes',{event:'*',schema:'public',table:'grocery_records',filter:'household_id=eq.'+id},()=>void sync()).subscribe();
}
export async function connectHousehold(id){
 if(state.household?.id===id){subscribe(id);await sync();return;}
 if(state.queue.length)throw Error('Sincronize as alterações pendentes antes de trocar de casa.');
 const generation=epoch;
 const {data,error}=await supabase.from('grocery_households').select('*').eq('id',id).single();
 if(generation!==epoch)return;
 if(error)throw Error(fail(error));
 const prior=state.household;
 epoch++;
 state.household=data;
 if(prior){state.records={};state.conflicts=[];persist();}
 else {
  const local=Object.values(state.records).filter(row=>!row.deleted);
  state.records={};
  for(let offset=0;offset<local.length;offset+=500)batch(()=>{
   for(const {id,kind,data} of local.slice(offset,offset+500))put(kind,{...data,id});
  });
  persist();
 }
 subscribe(id);
 await sync();
}
async function houseRPC(name,args){
 const {data,error}=await supabase.rpc(name,args);
 if(error)throw Error(fail(error));
 await connectHousehold(data);
}
export const createHouse=name=>houseRPC('grocery_create_house',{house_name:name});
export const joinHouse=code=>houseRPC('grocery_join_house',{invite_code:code.trim()});
export async function listHouses(){
 const {data,error}=await supabase.from('grocery_households').select('*').order('name');
 if(error)throw Error(fail(error));
 return data;
}
export async function manageHouse(action,target=null){
 const {data,error}=await supabase.rpc('grocery_manage_house',{house:state.household.id,action,target});
 if(error)throw Error(fail(error));
 return data;
}
function applyDisplayName(user){
 const name=user?.user_metadata?.groceries_display_name;
 if(typeof name!=='string'||name===state.name)return;
 state.name=name;
 persist();
 callback();
}
let profileVersion=0;
async function refreshDisplayName(){
 const id=session.user?.id,version=profileVersion;
 if(!id||!navigator.onLine)return;
 const {data,error}=await supabase.auth.getUser();
 if(!error&&data.user?.id===id&&session.user?.id===id&&version===profileVersion)applyDisplayName(data.user);
}
export async function saveDisplayName(value){
 const name=value.trim().slice(0,60);
 if(!name)throw Error('Digite seu nome.');
 const id=session.user?.id;
 if(!id){
  state.name=name;persist();callback();return;
 }
 if(!navigator.onLine)throw Error('Conecte-se à internet para salvar o nome na conta.');
 profileVersion++;
 const {data,error}=await supabase.auth.updateUser({data:{groceries_display_name:name}});
 profileVersion++;
 if(error)throw Error(fail(error));
 if(session.user?.id===id&&data.user?.id===id){
  session.user=data.user;
  applyDisplayName(data.user);
 }
}
async function useAccount(user,importGuest=false){
 if(user?.id===session.user?.id){
  session.user=user;
  applyDisplayName(user);
  return;
 }
 const guest=importGuest&&!session.user&&!state.household?structuredClone(state):null;
 epoch++;
 channel?.unsubscribe();
 session.user=user;
 session.error='';
 session.status='local';
 key=user?KEY+':'+user.id:KEY;
 Object.assign(state,load(key));
 if(guest&&user&&!state.household&&!Object.keys(state.records).length){
  Object.assign(state,guest);
  localStorage.removeItem(KEY);
  persist();
 }
 applyDisplayName(user);
 callback();
 if(!user)return;
 void refreshDisplayName();
 const generation=epoch;
 if(state.household){subscribe(state.household.id);await sync();return;}
 if(!navigator.onLine)return;
 const houses=await listHouses();
 if(epoch===generation&&houses.length)await connectHousehold(houses[0].id);
}
export async function initialize(onAuthEvent=()=>{}){
 supabase.auth.onAuthStateChange((event,next)=>{
  setTimeout(async()=>{
   try { await useAccount(next?.user||null,event==='SIGNED_IN'); }
   catch(error){session.error=fail(error);callback();}
   onAuthEvent(event,next);
  },0);
 });
 const {data:{session:auth}}=await supabase.auth.getSession();
 await useAccount(auth?.user||null).catch(error=>{session.error=fail(error);callback();});
 window.addEventListener('online',()=>{callback();void sync();void refreshDisplayName();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshDisplayName();});
 window.addEventListener('offline',callback);
 setInterval(()=>{if(document.visibilityState==='visible')void sync();},15000);
}
export async function logout(){
 if(state.queue.length)throw Error('Sincronize as alterações pendentes antes de sair.');
 const {error}=await supabase.auth.signOut({scope:'local'});
 if(error)throw Error(fail(error));
 if(session.user)localStorage.removeItem(KEY+':'+session.user.id);
 await useAccount(null);
}
