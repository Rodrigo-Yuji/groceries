import {parseReceipt,number} from './domain.js';
export async function readImage(file,onProgress){
 if(file.size>20*1024*1024)throw Error('Escolha uma imagem de até 20 MB.');
 const {createWorker}=await import('tesseract.js');
 const worker=await createWorker('por',1,{logger:m=>{if(m.status==='recognizing text')onProgress(Math.round(m.progress*100));}});
 try{const {data}=await worker.recognize(file);return {text:data.text,lines:parseReceipt(data.text)};}finally{await worker.terminate();}
}
export function readXML(text){
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('O arquivo XML é inválido.');
 const val=(node,key)=>node.getElementsByTagName(key)[0]?.textContent||'';
 const lines=[...doc.getElementsByTagName('det')].map(det=>{const p=det.getElementsByTagName('prod')[0];if(!p)return null;const quantity=number(val(p,'qCom'));const discount=number(val(p,'vDesc'));const total=number(val(p,'vProd'))-discount;return {name:val(p,'xProd'),quantity,price:quantity?total/quantity:0,unit:val(p,'uCom').toLowerCase()==='kg'?'kg':'un',size:1,packUnit:'un'};}).filter(x=>x?.name&&x.quantity>0);
 if(!lines.length)throw Error('Nenhum produto encontrado. Envie o XML completo da NFC-e/NF-e.');
 const emit=doc.getElementsByTagName('emit')[0];return {lines,market:emit?(val(emit,'xFant')||val(emit,'xNome')):'',date:val(doc,'dhEmi').slice(0,10),text};
}
export async function readQR(file){
 const img=await createImageBitmap(file);
 try{const c=document.createElement('canvas');const scale=Math.min(1,2200/Math.max(img.width,img.height));c.width=img.width*scale;c.height=img.height*scale;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,c.width,c.height);
 const {default:jsQR}=await import('jsqr');const pixels=ctx.getImageData(0,0,c.width,c.height);const code=jsQR(pixels.data,c.width,c.height);if(!code)throw Error('QR Code não encontrado. Tente uma foto mais próxima e bem iluminada.');return validateFiscalURL(code.data);
 }finally{img.close();}
}
export function validateFiscalURL(value){let u;try{u=new URL(value);}catch{throw Error('O QR Code não contém um endereço válido.');}if(u.protocol!=='https:'||!/(^|\.)[a-z0-9-]+\.gov\.br$/i.test(u.hostname)||u.username||u.password||u.port)throw Error('Use um QR Code de nota fiscal com endereço HTTPS de um portal governamental brasileiro.');return u.href;}
