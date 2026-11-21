const brazilianNumber=value=>{
 const match=String(value).match(/\d+(?:\.\d{3})*(?:,\d+)?/);
 return match?Number(match[0].replaceAll('.','').replace(',','.')):NaN;
};

export function readGoiásLines(text){
 const number='(\\d+(?:\\.\\d{3})*(?:,\\d+)?)';
 const pattern=new RegExp('([^\\n]+?)\\s*\\(\\s*C[oó]digo\\s*:\\s*[^)]+\\)\\s*Qtde\\.?\\s*:\\s*'+number+'\\s*UN\\s*:\\s*([A-Za-z]+)\\s*Vl\\.?\\s*Unit\\.?\\s*:\\s*'+number+'(?:\\s*Vl\\.?\\s*Total\\s*:?\\s*'+number+')?','giu');
 return [...text.matchAll(pattern)].flatMap(([,name,quantityText,unit,priceText,totalText])=>{
  const quantity=brazilianNumber(quantityText);
  const price=brazilianNumber(priceText);
  const total=brazilianNumber(totalText);
  if(!(quantity>0)||!Number.isFinite(price))return [];
  return [{name:name.trim(),quantity,unit,price:Number.isFinite(total)?total/quantity:price,originalPrice:price,discount:0}];
 });
}

export function receiptAmount(text,label){
 const match=text.match(new RegExp(label+'\\s*(?:R\\$)?\\s*:?\\s*(\\d[\\d.,]*)','i'));
 return match?brazilianNumber(match[1]):undefined;
}
