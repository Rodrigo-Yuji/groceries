import {supabase} from './store.js';

const invitationKey='groceries.pending-invitation';
export function appURL(){
 return new URL(import.meta.env.BASE_URL,location.origin);
}
export function invitationURL(code){
 const url=appURL();
 url.searchParams.set('convite',code);
 return url.href;
}
export function pendingInvitation(){
 const url=new URL(location.href);
 const code=url.searchParams.get('convite');
 if(code!==null){
  url.searchParams.delete('convite');
  history.replaceState(history.state,'',url.href);
  if(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(code))localStorage.setItem(invitationKey,code);
 }
 return localStorage.getItem(invitationKey)||'';
}
export function clearInvitation(){localStorage.removeItem(invitationKey);}

export function authMessage(error){
 switch(error?.code){
  case 'invalid_credentials': return 'E-mail ou senha incorretos.';
  case 'email_not_confirmed': return 'Confirme o e-mail antes de entrar.';
  case 'same_password': return 'Escolha uma senha diferente da atual.';
  case 'weak_password': return 'A senha não atende aos requisitos de segurança.';
  case 'over_email_send_rate_limit': return 'Aguarde um pouco antes de pedir outro e-mail.';
  case 'session_not_found': return 'Sua sessão expirou. Entre novamente ou solicite outro link.';
  default: return 'Não foi possível concluir. Confira sua conexão e tente novamente.';
 }
}
export async function changePassword(current,password){
 if(current!==null){
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user?.email)throw error||Error('Sessão indisponível.');
  const {error:signInError}=await supabase.auth.signInWithPassword({email:user.email,password:current});
  if(signInError)throw signInError;
 }
 const {error}=await supabase.auth.updateUser({password});
 if(error)throw error;
}
