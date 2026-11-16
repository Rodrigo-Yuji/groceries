const [site,expected]=process.argv.slice(2);
if(!site||!expected)throw Error('Informe a URL e a assinatura da compilação.');
const root=new URL(site);
const checks=[
 ['página inicial',new URL('.',root),expected],
 ['service worker',new URL('sw.js',root),expected]
];
async function verify(){
 for(const [label,url,bundle] of checks){
  const response=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
  if(!response.ok||!(await response.text()).includes(bundle))throw Error(label+' ainda não entrega a compilação '+bundle);
 }
 const bundle=await fetch(new URL('assets/'+expected,root),{signal:AbortSignal.timeout(10000)});
 if(!bundle.ok||!/(javascript|ecmascript)/i.test(bundle.headers.get('content-type')||''))throw Error('O JavaScript publicado não carregou.');
}
let consecutive=0,lastFailure;
for(let attempt=0;attempt<8;attempt++){
 try{
  await verify();
  consecutive++;
  if(consecutive===2){console.log('Página, JavaScript e service worker conferidos em '+root.href);process.exit(0);}
 }catch(error){
  lastFailure=error;
  consecutive=0;
  console.log(error.message);
 }
 if(attempt<7)await new Promise(resolve=>setTimeout(resolve,5000));
}
throw lastFailure||Error('A publicação não permaneceu estável.');
