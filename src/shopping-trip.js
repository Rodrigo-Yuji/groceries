import {state,session,records,put,remove,persist,batch} from './store.js';

const tripDuration=12*60*60*1000;
const activeTrips=()=>records('settings').filter(row=>row.key==='shopping-trip'&&Date.now()-row.startedAt<tripDuration);
export const otherShoppingTrips=()=>state.household&&session.user?activeTrips().filter(trip=>trip.shopperId!==session.user.id):[];
export function currentShoppingTrip(){
 if(state.household&&session.user){
  return activeTrips().filter(trip=>trip.shopperId===session.user.id).sort((a,b)=>b.startedAt-a.startedAt)[0];
 }
 return state.shopping&&Date.now()-state.lastSeen<tripDuration?{id:'local',startedAt:state.lastSeen}:null;
}
export function startShoppingTrip(name){
 const startedAt=Date.now();
 if(state.household&&session.user){
  batch(()=>{
   stopShoppingTrip();
   put('settings',{key:'shopping-trip',shopperId:session.user.id,name,startedAt});
  });
 }else{
  state.shopping=true;
  state.lastSeen=startedAt;
  persist();
 }
}
export function stopShoppingTrip(){return batch(()=>{

 for(const trip of records('settings')){
  if(trip.key==='shopping-trip'&&trip.shopperId===session.user?.id)remove(trip.id);
 }
 state.shopping=false;
});}
export function freshRequest(name){
 return {id:crypto.randomUUID(),at:Date.now(),by:session.user?.id,name};
}
function newRequest(item,trip){
 const request=item.lastRequest||{id:item.id,at:item.createdAt,by:item.requesterId,name:item.requester};
 const isOther=request.by?request.by!==session.user?.id:request.name!==state.name;
 return trip&&request.at>trip.startedAt&&item.bought<item.quantity&&isOther?request:null;
}
export const isShoppingRequestNew=(item,trip)=>Boolean(newRequest(item,trip));
export const canEnableShoppingNotifications=()=>Boolean(state.household&&window.Notification?.permission==='default'&&navigator.serviceWorker);
export async function enableShoppingNotifications(){
 return canEnableShoppingNotifications()?Notification.requestPermission():window.Notification?.permission;
}
async function systemNotification(message,id){
 if(window.Notification?.permission!=='granted')return;
 const registration=await navigator.serviceWorker?.getRegistration();
 if(registration?.active)await registration.showNotification('Groceries',{body:message,icon:'icon-192.png',tag:id});
}
export function showShoppingNotifications(showMessage){
 if(!state.household||!session.user||session.status!=='synced')return;
 const key='groceries.shopping-notifications:'+state.household.id+':'+session.user.id;
 const seen=JSON.parse(localStorage.getItem(key)||'{}');
 const messages=[];
 const record=(id,message)=>{
  if(seen[id])return;
  seen[id]=Date.now();
  messages.push(message);
  void systemNotification(message,id).catch(()=>{});
 };
 for(const trip of otherShoppingTrips()){
  record(trip.id,trip.name+' está no mercado agora. Adicione à lista o que estiver faltando.');
 }
 const current=currentShoppingTrip();
 if(current){
  for(const item of records('item')){
   const request=newRequest(item,current);
   if(request)record(current.id+':'+request.id,(request.name||'Alguém da casa')+' pediu '+item.name+'.');
  }
 }
 if(!messages.length)return;
 for(const [id,at] of Object.entries(seen))if(Date.now()-at>=tripDuration)delete seen[id];
 localStorage.setItem(key,JSON.stringify(seen));
 showMessage(messages.join(' '));
}
