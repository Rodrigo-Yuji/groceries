const monetaryFields=[
 'input[type=number][name=price]',
 'input[type=number][name=priceA]',
 'input[type=number][name=priceB]',
 'input[type=number][name=originalPrice]',
 'input[type=number][name=expected]',
 'input[type=number][name=receiptDiscount]',
 'input[type=number][data-field=price]',
 'input[type=number][data-field=discount]'
].join(',');
const displayMoney=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

export function maskMoney(value){
 const digits=String(value).replace(/\D/g,'');
 if(!digits)return {text:'',value:''};
 const padded=digits.replace(/^0+(?=\d)/,'').padStart(3,'0');
 const whole=padded.slice(0,-2),cents=padded.slice(-2);
 return {text:whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+cents,value:whole+'.'+cents};
}

export function enhanceMoneyFields(root){
 for(const field of root.querySelectorAll(monetaryFields)){
  const visible=field.cloneNode();
  visible.type='text';
  visible.inputMode='numeric';
  visible.autocomplete='off';
  visible.classList.add('monetary-input');
  visible.removeAttribute('name');
  visible.removeAttribute('data-field');
  visible.removeAttribute('min');
  visible.removeAttribute('max');
  visible.removeAttribute('step');
  visible.value=field.value===''?'':displayMoney.format(Number(field.value));
  const maximum=field.max===''?Infinity:Number(field.max);
  field.removeAttribute('id');
  field.type='hidden';
  field.before(visible);
  visible.addEventListener('input',()=>{
   const position=visible.selectionStart??visible.value.length;
   const remaining=visible.value.slice(position).replace(/\D/g,'').length;
   const formatted=maskMoney(visible.value);
   visible.value=formatted.text;
   field.value=formatted.value;
   const amount=Number(formatted.value);
   visible.setCustomValidity(!Number.isFinite(amount)||amount>maximum?'Informe um valor válido.':'');
   let caret=visible.value.length,unplaced=remaining;
   while(caret>0&&unplaced>0){
    if(/\d/.test(visible.value[--caret]))unplaced--;
   }
   visible.setSelectionRange(caret,caret);
  });
 }
}
