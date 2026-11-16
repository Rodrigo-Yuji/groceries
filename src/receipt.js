import {readGoiásLines,receiptAmount} from './goias-receipt.js';
import {parseReceipt,number} from './domain.js';
export async function readImage(file,onProgress){
 if(file.size>20*1024*1024)throw Error('Escolha uma imagem de até 20 MB.');
 const {createWorker}=await import('tesseract.js');
 const worker=await createWorker('por',1,{logger:m=>{if(m.status==='recognizing text')onProgress(Math.round(m.progress*100));}});
 try{const {data}=await worker.recognize(file);const lines=readGoiásLines(data.text);return lines.length?{lines:lines.map(line=>({...line,unit:fiscalUnit(line.unit)})),expected:receiptAmount(data.text,'Valor a pagar'),discount:receiptAmount(data.text,'Descontos?')}:{text:data.text,lines:parseReceipt(data.text)};}finally{await worker.terminate();}
}
export function readXML(text){
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('O arquivo XML é inválido.');
 const val=(node,key)=>node.getElementsByTagName(key)[0]?.textContent||'';
 const lines=[...doc.getElementsByTagName('det')].map(det=>{const p=det.getElementsByTagName('prod')[0];if(!p)return null;const quantity=number(val(p,'qCom'));const discount=number(val(p,'vDesc'));const gross=number(val(p,'vProd'));return {name:val(p,'xProd'),quantity,price:quantity?gross/quantity:0,discount, unit:fiscalUnit(val(p,'uCom'))};}).filter(x=>x?.name&&x.quantity>0);
 if(!lines.length)throw Error('Nenhum produto encontrado. Envie o XML completo da NFC-e/NF-e.');
 const emit=doc.getElementsByTagName('emit')[0];return {lines,market:emit?(val(emit,'xFant')||val(emit,'xNome')):'',date:(val(doc,'dhEmi')||val(doc,'dEmi')).slice(0,10),expected:val(doc,'vNF'),key:doc.querySelector('infNFe')?.getAttribute('Id')?.match(/\d{44}/)?.[0]};
}
export async function readQR(file){
 const img=await createImageBitmap(file);
 try{const c=document.createElement('canvas');const scale=Math.min(1,2200/Math.max(img.width,img.height));c.width=img.width*scale;c.height=img.height*scale;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,c.width,c.height);
 const {default:jsQR}=await import('jsqr');const pixels=ctx.getImageData(0,0,c.width,c.height);const code=jsQR(pixels.data,c.width,c.height);if(!code)throw Error('QR Code não encontrado. Tente uma foto mais próxima e bem iluminada.');return validateFiscalURL(code.data);
 }finally{img.close();}
}
export function validateFiscalURL(value){let u;try{u=new URL(value);}catch{throw Error('O QR Code não contém um endereço válido.');}if(u.protocol!=='https:'||!/(^|\.)[a-z0-9-]+\.gov\.br$/i.test(u.hostname)||u.username||u.password||u.port)throw Error('Use um QR Code de nota fiscal com endereço HTTPS de um portal governamental brasileiro.');return u.href;}

function fiscalUnit(value){
 const unit=value.toLowerCase().trim();
 return ({kg:'kg',g:'g',l:'L',ml:'ml',pc:'pacote',pct:'pacote',cx:'caixa'})[unit]||'un';
}
function readDetailedReceipt(document){
 const amount=text=>{
  const value=String(text||'').trim();
  return /^\d+(?:\.\d{3})*(?:,\d+)?$/.test(value)?number(value.replaceAll('.','')):NaN;
 };
 const field=(rows,pattern)=>{
  for(const row of rows){
   for(const [index,cell] of [...row.cells].entries()){
    const label=[...cell.querySelectorAll('label,strong,b')].find(node=>pattern.test(node.textContent.trim()));
    if(label)return cell.textContent.slice(cell.textContent.indexOf(label.textContent)+label.textContent.length).trim()||row.nextElementSibling?.cells?.[index]?.textContent.trim();
    if(pattern.test(cell.textContent.trim()))return row.nextElementSibling?.cells?.[index]?.textContent.trim();
   }
  }
 };
 const detail=[...document.querySelectorAll('tr')].filter(row=>row.cells.length>=5&&row.cells.length<=7);
 const header=detail.find(row=>/descri[cç][aã]o/i.test(row.textContent)&&/unidade comercial/i.test(row.textContent)&&/qtd/i.test(row.textContent));
 if(!header)return null;
 const candidates=[...header.closest('table').querySelectorAll('tr')];
 const lines=[];
 for(let index=0;index<candidates.length;index++){
  const cell=[...candidates[index].cells].map(value=>value.textContent.trim());
  const offset=cell.length===6?1:0;
  const [lineNumber,name,qty,unit,value]=cell.slice(offset,offset+5);
  const quantity=amount(qty),gross=amount(value);
  if(!/^\d+$/.test(lineNumber)||!name||!(quantity>0)||!Number.isFinite(gross))continue;
  const rows=[];
  for(let next=index+1;next<candidates.length;next++){
   const values=[...candidates[next].cells].map(value=>value.textContent.trim());
   const start=values.length===6?1:0;
   if(/^\d+$/.test(values[start])&&amount(values[start+2])>0&&Number.isFinite(amount(values[start+4])))break;
   rows.push(candidates[next]);
  }
  const discount=amount(field(rows,/^valor do desconto$/i));
  const originalPrice=amount(field(rows,/^valor unit[aá]rio de comercializa[cç][aã]o$/i));
  lines.push({name,quantity,unit:fiscalUnit(unit),price:gross/quantity,originalPrice:Number.isFinite(originalPrice)?originalPrice:gross/quantity,discount:Number.isFinite(discount)?discount:0});
 }
 if(!lines.length)return null;
 const all=[...document.querySelectorAll('tr')];
 const fiscalKey=field(all,/^chave de acesso$/i)?.replace(/\D/g,'');
 const market=field(all,/^raz[aã]o social$/i)||'';
 return {lines,market,key:fiscalKey?.length===44?fiscalKey:undefined};
}
export function readPortalHTML(html){
 const document=new DOMParser().parseFromString(html,'text/html');
 const detailed=readDetailedReceipt(document);
 if(detailed)return detailed;
 let lines=[...document.querySelectorAll('#tabResult tr')].flatMap(row=>{
  const field=selector=>row.querySelector(selector)?.textContent.trim()||'';
  const name=field('.txtTit');
  const numeric=selector=>{
   const value=field(selector).match(/[\d.]+,\d+|\d+/)?.[0];
   return value?number(value.replace(/\.(?=\d{3}\b)/g,'')):NaN;
  };
  const quantity=numeric('.Rqtd'), price=numeric('.RvlUnit'), total=numeric('.valor');
  if(!name||!(quantity>0)||!(price>=0))return [];
  return [{name,quantity,price,unit:fiscalUnit(field('.RUN').split(':').pop()),discount:Number.isFinite(total)?Math.max(0,Math.round((quantity*price-total)*100)/100):0}];
 });
 if(!lines.length){
  const frame=document.querySelector('iframe.iframe-danfe-nfce');
  const embedded=frame?.getAttribute('srcdoc');
  if(embedded)return readPortalHTML(embedded);
  const rows=[...document.querySelectorAll('tr,li,article,div')].flatMap(element=>{
   if([...element.children].some(child=>/Qtde\.?\s*:/i.test(child.textContent)&&/C[oó]digo\s*:/i.test(child.textContent)))return [];
   const walker=document.createTreeWalker(element,4);
   const parts=[];
   while(walker.nextNode())parts.push(walker.currentNode.textContent);
   const text=parts.join(' ').replace(/\s+/g,' ').trim();
   if(!/C[oó]digo\s*:.*Qtde\.?\s*:/i.test(text))return [];
   return readGoiásLines(text);
  });
  if(rows.length){
   const text=document.body.textContent.replace(/\s+/g,' ');
   const market=document.querySelector('#u20,.txtTopo')?.textContent.trim()||'';
   return {lines:rows.map(line=>({...line,unit:fiscalUnit(line.unit)})),market,expected:receiptAmount(text,'Valor a pagar'),discount:receiptAmount(text,'Descontos?')};
  }
  if(frame||document.querySelector('#danfe-nfce-container'))throw Error('Este HTML de Goiás contém apenas a página externa ou um DANFE carregado por script. Abra a área dos produtos em uma aba própria e salve essa página. Você também pode importar um print em Foto para OCR.');
  throw Error('Nenhuma linha fiscal compatível encontrada. Salve a página que mostra os produtos, ou importe um print em Foto para OCR.');
 }
 const key=document.querySelector('.chave')?.textContent.replace(/\D/g,'');
 const formatted=document.body.textContent.match(/(?:Emissão|Emiss[aã]o)\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i);
 const total=[...document.querySelectorAll('#linhaTotal')].find(row=>/valor a pagar|valor total/i.test(row.textContent))?.querySelector('.totalNumb')?.textContent;
 return {lines,market:document.querySelector('#u20')?.textContent.trim()||'',date:formatted?[formatted[3],formatted[2],formatted[1]].join('-'):'',expected:total?.replace(/[^\d,]/g,'').replace(',','.'),key:key?.length===44?key:undefined};
}
export async function importFiscalURL(url){
 const validated=validateFiscalURL(url);
 const response=await fetch(validated,{mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(7000)});
 if(!response.ok)throw Error('O portal não retornou o cupom.');
 const body=await response.text();
 return response.headers.get('content-type')?.includes('xml')?readXML(body):readPortalHTML(body);
}
