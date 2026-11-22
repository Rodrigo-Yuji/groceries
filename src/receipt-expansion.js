// Generic understanding of Brazilian receipt descriptions (NFC-e "xProd").
// Two jobs:
//  1. expandAbbreviations: turn "BISC RECH TRAKINAS 126G MOR" into
//     "Biscoito recheado Trakinas morango 126g" when every piece is understood.
//  2. matchKnownName: find the catalog product or past correction that a new
//     description refers to, even when another market abbreviates it differently.
import {normalize} from './domain.js';

// Multi-word abbreviations, checked before single words. Keys are normalized.
const phrases=[
 ['lt cond','leite condensado'],['l cond','leite condensado'],['leite cond','leite condensado'],
 ['cr leite','creme de leite'],['cr de leite','creme de leite'],['cr dent','creme dental'],['cr dental','creme dental'],
 ['cr av','creme de avelã'],['cr aveia','creme de aveia'],
 ['pap hig','papel higiênico'],['pap higienico','papel higiênico'],['papel hig','papel higiênico'],
 ['pap toalha','papel toalha'],['pap toal','papel toalha'],['papel toal','papel toalha'],
 ['p forma','pão de forma'],['pao forma','pão de forma'],['p frances','pão francês'],['p queijo','pão de queijo'],
 ['sab po','sabão em pó'],['sabao po','sabão em pó'],['sab em po','sabão em pó'],['sab liq','sabão líquido'],['sabao liq','sabão líquido'],
 ['sab barra','sabão em barra'],['sab bar','sabão em barra'],
 ['agua sanit','água sanitária'],['ag sanit','água sanitária'],['agua min','água mineral'],['ag min','água mineral'],
 ['lava roup','lava-roupas'],['lava roupa','lava-roupas'],['lava loucas','lava-louças'],['lava louca','lava-louças'],
 ['esc dent','escova dental'],['esc dental','escova dental'],['fio dent','fio dental'],
 ['s o','sem osso'],['c o','com osso'],['s ac','sem açúcar'],['s acucar','sem açúcar'],['s gas','sem gás'],['c gas','com gás'],
 ['s lact','sem lactose'],['zero lact','zero lactose'],['s sal','sem sal'],['c sal','com sal'],
 ['far trigo','farinha de trigo'],['far trig','farinha de trigo'],['farinha trigo','farinha de trigo'],['far mand','farinha de mandioca'],
 ['mac inst','macarrão instantâneo'],['macarrao inst','macarrão instantâneo'],
 ['beb lact','bebida láctea'],['beb lac','bebida láctea'],
 ['oleo soja','óleo de soja'],['ol soja','óleo de soja'],['ext tom','extrato de tomate'],['extr tom','extrato de tomate'],
 ['mol tom','molho de tomate'],['molho tom','molho de tomate'],['carne moida','carne moída'],['cx leite','caixa de leite'],
 ['feij car','feijão carioca'],['feij pto','feijão preto'],['feij preto','feijão preto'],['feijao car','feijão carioca'],
 ['saco lixo','saco de lixo'],['sc lixo','saco de lixo'],['cream crack','cream cracker'],['agua e sal','água e sal'],
 ['bat doce','batata-doce'],['batata doce','batata-doce'],['3 cor','3 Corações'],['tres cor','3 Corações'],['tres coracoes','3 Corações'],
 ['coca cola','Coca-Cola'],['guar antarc','Guaraná Antarctica'],['guarana antarc','Guaraná Antarctica'],['dona benta','Dona Benta'],['tio joao','Tio João'],
 ['ext virg','extravirgem'],['sal ref','sal refinado'],['acuc ref','açúcar refinado'],['acucar ref','açúcar refinado'],['del valle','Del Valle'],['extra virg','extravirgem'],['roll on','roll-on'],['pao frances','pão francês'],
];

// Single tokens. Values starting with an uppercase letter are brands.
const words={
 // Groceries
 ach:'achocolatado',achoc:'achocolatado',acuc:'açúcar',acucar:'açúcar',adoc:'adoçante',agua:'água',ag:'água',
 alc:'álcool',alcool:'álcool',amend:'amendoim',arr:'arroz',arroz:'arroz',azeit:'azeite',azeite:'azeite',aveia:'aveia',
 bisc:'biscoito',biscoito:'biscoito',bolach:'bolacha',bomb:'bombom',caldo:'caldo',cafe:'café',cereal:'cereal',
 choc:'chocolate',chocolate:'chocolate',ervilh:'ervilha',ext:'extrato',extr:'extrato',far:'farofa',farin:'farinha',farinha:'farinha',
 feij:'feijão',feijao:'feijão',fub:'fubá',fuba:'fubá',gelat:'gelatina',granola:'granola',ketc:'ketchup',ketchup:'ketchup',
 lasanha:'lasanha',mac:'macarrão',macarrao:'macarrão',maion:'maionese',maionese:'maionese',milho:'milho',mist:'mistura',
 mol:'molho',molh:'molho',molho:'molho',most:'mostarda',mostarda:'mostarda',oleo:'óleo',ol:'óleo',pipoca:'pipoca',popcor:'pipoca',popcorn:'pipoca',
 sal:'sal',salg:'salgadinho',sard:'sardinha',sardinha:'sardinha',sorv:'sorvete',sorvete:'sorvete',suc:'suco',suco:'suco',
 temp:'tempero',tempero:'tempero',trigo:'trigo',trig:'trigo',vinag:'vinagre',vinagre:'vinagre',atum:'atum',
 torr:'torrado',torrado:'torrado',moido:'moído',soluv:'solúvel',inst:'instantâneo',parb:'parboilizado',agulh:'agulhinha',
 t1:'tipo 1',tp1:'tipo 1',pto:'preto',cristal:'cristal',refin:'refinado',
 // Bakery and dairy
 pao:'pão',bolo:'bolo',torrada:'torrada',leite:'leite',leit:'leite',lte:'leite',iog:'iogurte',iogurte:'iogurte',
 qjo:'queijo',qj:'queijo',queij:'queijo',queijo:'queijo',muss:'muçarela',mus:'muçarela',mucarela:'muçarela',mussarela:'muçarela',
 prato:'prato',parm:'parmesão',ralad:'ralado',ralado:'ralado',requeij:'requeijão',req:'requeijão',requeijao:'requeijão',
 mant:'manteiga',mantei:'manteiga',manteiga:'manteiga',marg:'margarina',margarina:'margarina',cr:'creme',creme:'creme',
 desn:'desnatado',semid:'semidesnatado',semi:'semidesnatado',integ:'integral',integral:'integral',uht:'UHT',
 lact:'lactose',cond:'condicionador',
 // Meat, eggs, frozen
 bov:'bovino',bovino:'bovino',suin:'suíno',suino:'suíno',frang:'frango',frango:'frango',fgo:'frango',peit:'peito',peito:'peito',
 file:'filé',fil:'filé',coxa:'coxa',sobrecx:'sobrecoxa',sobrecoxa:'sobrecoxa',asa:'asa',cost:'costela',costela:'costela',
 alcatra:'alcatra',picanha:'picanha',patinho:'patinho',acem:'acém',musc:'músculo',moida:'moída',ling:'linguiça',linguica:'linguiça',
 calab:'calabresa',calabresa:'calabresa',salsic:'salsicha',salsicha:'salsicha',hamb:'hambúrguer',mort:'mortadela',mortadela:'mortadela',
 pres:'presunto',presunto:'presunto',salame:'salame',bacon:'bacon',empan:'empanado',cong:'congelado',resf:'resfriado',
 ovo:'ovo',ovos:'ovos',bco:'branco',br:'branco',branco:'branco',verm:'vermelho',caipira:'caipira',
 // Produce
 tom:'tomate',tomate:'tomate',ceb:'cebola',cebola:'cebola',bat:'batata',batata:'batata',cenour:'cenoura',cen:'cenoura',cenoura:'cenoura',
 alho:'alho',lim:'limão',limao:'limão',lar:'laranja',laranja:'laranja',banana:'banana',maca:'maçã',mamao:'mamão',abobr:'abobrinha',
 pim:'pimenta',pimenta:'pimenta',pimentao:'pimentão',alf:'alface',alface:'alface',repolh:'repolho',mand:'mandioca',mandioca:'mandioca',
 nac:'nacional',hort:'hortaliça',
 // Drinks
 beb:'bebida',refri:'refrigerante',refrig:'refrigerante',refrigerante:'refrigerante',cerv:'cerveja',cerveja:'cerveja',
 nect:'néctar',isot:'isotônico',energ:'energético',min:'mineral',gas:'gás',pet:'PET',garraf:'garrafa',vinho:'vinho',
 // Hygiene and cleaning
 sabon:'sabonete',sabonete:'sabonete',sh:'shampoo',sham:'shampoo',shamp:'shampoo',shampoo:'shampoo',desod:'desodorante',deo:'desodorante',
 aer:'aerossol',aerosol:'aerossol',absorv:'absorvente',fral:'fralda',fralda:'fralda',lenc:'lenço',cotonete:'cotonete',
 det:'detergente',detergente:'detergente',amac:'amaciante',amaciante:'amaciante',desinf:'desinfetante',limp:'limpador',
 alvej:'alvejante',multiuso:'multiuso',esponja:'esponja',lixo:'lixo',guard:'guardanapo',toalha:'toalha',liq:'líquido',
 // Descriptors and flavors
 sabor:'sabor',trad:'tradicional',tr:'tradicional',tradicional:'tradicional',orig:'original',original:'original',
 fat:'fatiado',fatiado:'fatiado',fatiada:'fatiada',rech:'recheado',rec:'recheado',recheado:'recheado',
 mor:'morango',morango:'morango',baun:'baunilha',coco:'coco',uva:'uva',marac:'maracujá',abac:'abacaxi',pess:'pêssego',
 doce:'doce',salgado:'salgado',natural:'natural',nat:'natural',light:'light',diet:'diet',zero:'zero',neutro:'neutro',neutr:'neutro',
 peq:'pequeno',gde:'grande',grande:'grande',med:'médio',mini:'mini',inteiro:'inteiro',pedaco:'pedaço',
 lata:'lata',sache:'sachê',sach:'sachê',refil:'refil',sem:'sem',com:'com',de:'de',
 // Brands (full and abbreviated)
 ype:'Ypê',nestle:'Nestlé',nest:'Nestlé',itambe:'Itambé',itamb:'Itambé',piracanjuba:'Piracanjuba',pirac:'Piracanjuba',
 italac:'Italac',sadia:'Sadia',perdigao:'Perdigão',perd:'Perdigão',seara:'Seara',friboi:'Friboi',frib:'Friboi',
 yoki:'Yoki',yok:'Yoki',nissin:'Nissin',bombril:'Bombril',omo:'Omo',comfort:'Comfort',downy:'Downy',ariel:'Ariel',
 colgate:'Colgate',sorriso:'Sorriso',dove:'Dove',rexona:'Rexona',nivea:'Nivea',pantene:'Pantene',seda:'Seda',elseve:'Elseve',
 garnier:'Garnier',pepsi:'Pepsi',fanta:'Fanta',sprite:'Sprite',coca:'Coca-Cola',skol:'Skol',brahma:'Brahma',heineken:'Heineken',
 amstel:'Amstel',itaipava:'Itaipava',budweiser:'Budweiser',quaker:'Quaker',nescau:'Nescau',toddy:'Toddy',tod:'Toddy',
 pilao:'Pilão',melitta:'Melitta',maggi:'Maggi',knorr:'Knorr',hellmanns:"Hellmann's",hellm:"Hellmann's",heinz:'Heinz',
 quero:'Quero',elefante:'Elefante',fugini:'Fugini',pomarola:'Pomarola',camil:'Camil',kicaldo:'Kicaldo',renata:'Renata',
 barilla:'Barilla',adria:'Adria',vitarella:'Vitarella',bauducco:'Bauducco',marilan:'Marilan',mari:'Marilan',piraque:'Piraquê',
 trakinas:'Trakinas',oreo:'Oreo',danone:'Danone',activia:'Activia',batavo:'Batavo',vigor:'Vigor',aviacao:'Aviação',
 qualy:'Qualy',doriana:'Doriana',becel:'Becel',liza:'Liza',soya:'Soya',gallo:'Gallo',andorinha:'Andorinha',veja:'Veja',
 harpic:'Harpic',vanish:'Vanish',scott:'Scott',neve:'Neve',personal:'Personal',visconti:'Visconti',visc:'Visconti',
 pullman:'Pullman',wickbold:'Wickbold',plusvita:'Plus Vita',moca:'Moça',ninho:'Ninho',molico:'Molico',
 lebre:'Lebre',uniao:'União',guarani:'Guarani',caravelas:'Caravelas',mika:'Mika',sazon:'Sazón',kitano:'Kitano',
 compleite:'Compleite',jesus:'Jesus',monster:'Monster',redbull:'Red Bull',eskibon:'Eskibon',kibon:'Kibon',
 panasonic:'Panasonic',duracell:'Duracell',always:'Always',intimus:'Intimus',pampers:'Pampers',huggies:'Huggies',
 gillette:'Gillette',venus:'Venus',ox:'OX',tresemme:'TRESemmé',palmolive:'Palmolive',protex:'Protex',lux:'Lux',
 assolan:'Assolan',scotchbrite:'Scotch-Brite',brilhante:'Brilhante',tixan:'Tixan',minuano:'Minuano',limpol:'Limpol',
 dori:'Dori',fini:'Fini',lacta:'Lacta',garoto:'Garoto',bis:'Bis',kitkat:'KitKat',elma:'Elma',ruffles:'Ruffles',doritos:'Doritos',
 cheetos:'Cheetos',pringles:'Pringles',tang:'Tang',fresh:'Fresh',dafruta:'Da Fruta',maguary:'Maguary',
};
// Tokens that carry no product identity (packaging, sale unit, internal codes).
const noise=new Set(['kg','kgs','un','und','unid','pc','pct','cx','emb','bdj','band','fc','pt','vd','gf','gfa','cj','fd','sc','lv','pg','leve','pague']);
// Packaging words describe the container, not the product.
const packaging=new Set(['lata','garrafa','pet','sache','refil','caixa','pacote']);
const stop=new Set(['de','da','do','das','dos','com','e','em','c','a','o','tipo','sabor','para']);
const sizePattern=/^(\d+(?:[.,]\d+)?)(kg|g|gr|grs|mg|ml|l|lt|lts|un|und|m|mts|cm)?$/;

function sizeLabel(amount,unit){
 const value=amount.replace('.',',');
 const u=({gr:'g',grs:'g',lt:'L',lts:'L',l:'L',ml:'mL',und:'un',mts:'m'})[unit]||unit;
 return ['g','kg'].includes(u)?value+(u==='g'?'g':' kg'):value+' '+u;
}

// Split a raw description into tokens, keeping sizes ("500 G" -> "500g") together.
function rawTokens(raw){
 const text=normalize(String(raw||'').replace(/(\d)[,.](\d)/g,'$1_$2').replace(/\b[cC]\s*\/\s*(\d+)/g,' c $1 '));
 const tokens=text.replace(/_/g,'.').split(' ').filter(Boolean);
 const joined=[];
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i].replace(/\./g,','),next=tokens[i+1];
  if(/^\d+(?:,\d+)?$/.test(token)&&next&&/^(kg|g|gr|grs|ml|l|lt|lts|mg)$/.test(next)){joined.push(token+next);i++;}
  else joined.push(token);
 }
 return joined;
}

// Read tokens into pieces: {text, kind: 'word'|'brand'|'size'|'count'|'unknown'|'noise'}.
function readPieces(raw){
 const tokens=rawTokens(raw),pieces=[];
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i];
  const two=tokens.slice(i,i+2).join(' '),three=tokens.slice(i,i+3).join(' ');
  const phrase=phrases.find(([key])=>key===three)||phrases.find(([key])=>key===two);
  if(phrase){
   pieces.push({text:phrase[1],kind:/^[A-Z0-9]/.test(phrase[1])?'brand':'word'});
   i+=phrase[0].split(' ').length-1;
   continue;
  }
  if(token==='c'&&/^\d+$/.test(tokens[i+1]||'')){pieces.push({text:tokens[i+1]+' un',kind:'count'});i++;continue;}
  const size=token.match(sizePattern);
  if(size&&size[2]&&!['m','cm','mg'].includes(size[2])){pieces.push({text:sizeLabel(size[1],size[2]),kind:'size'});continue;}
  if(/^\d/.test(token)){pieces.push({text:token,kind:'number'});continue;}
  // "LT" opens a description as leite; elsewhere it is the can ("CERV SKOL LT 350ML").
  if(token==='lt'){pieces.push({text:i===0?'leite':'lata',kind:'word'});continue;}
  // "INT" is integral for grains and milk, inteiro for whole chickens and fish.
  if(token==='int'){
   const before=pieces.filter(piece=>piece.kind==='word').map(piece=>normalize(piece.text)).join(' ');
   const meaning=/\b(frango|peixe|tilapia|chester|peru)\b/.test(before)?'inteiro':
    /\b(leite|arroz|pao|farinha|macarrao|biscoito|torrada|iogurte|aveia|trigo)\b/.test(before)?'integral':'';
   pieces.push(meaning?{text:meaning,kind:'word'}:{text:token,kind:'unknown'});
   continue;
  }
  if(Object.hasOwn(words,token)){
   const value=words[token];
   pieces.push({text:value,kind:/^[A-Z]/.test(value)?'brand':'word'});
   continue;
  }
  if(noise.has(token)){pieces.push({text:token,kind:'noise'});continue;}
  pieces.push({text:token,kind:'unknown'});
 }
 return pieces;
}

const titleCase=word=>word.charAt(0).toUpperCase()+word.slice(1);

// Returns a readable name, or null when the description is not understood well enough.
export function expandAbbreviations(raw){
 const pieces=readPieces(raw);
 const known=pieces.filter(piece=>piece.kind==='word'||piece.kind==='brand');
 const unknown=pieces.filter(piece=>piece.kind==='unknown');
 if(!known.length||!pieces.some(piece=>piece.kind==='word'))return null;
 // One- and two-letter leftovers are unknown abbreviations ("M PIM MEND"): do not guess.
 if(unknown.some(piece=>piece.text.length<=2))return null;
 if(unknown.length>known.length)return null;
 const body=[],tail=[];
 for(const piece of pieces){
  if(piece.kind==='noise')continue;
  if(piece.kind==='size'||piece.kind==='count')tail.push(piece.text);
  else if(piece.kind==='unknown')body.push(piece.text.length<=3?piece.text.toUpperCase():titleCase(piece.text));
  else body.push(piece.text);
 }
 const text=[...body,...tail].join(' ').replace(/\s+/g,' ').trim();
 if(!text)return null;
 const name=titleCase(text);
 return normalize(name)===normalize(raw)?null:name.slice(0,120);
}

// ---------- Matching against names the household already uses ----------
const stem=word=>{
 let w=word;
 if(w.length>4&&w.endsWith('s'))w=w.slice(0,-1);
 if(w.length>4&&/[ao]$/.test(w))w=w.slice(0,-1);
 return w;
};
// Canonical, accent-free identity tokens; sizes, numbers and noise are left out.
export function identityTokens(text){
 const tokens=[];
 for(const piece of readPieces(text)){
  if(['size','count','noise','number'].includes(piece.kind))continue;
  for(const word of normalize(piece.text).split(' ')){
   if(!word||stop.has(word)||noise.has(word)||packaging.has(word))continue;
   tokens.push(stem(word));
  }
 }
 return [...new Set(tokens)];
}
const sameToken=(a,b)=>a===b||(a.length>=3&&b.length>=3&&(a.startsWith(b)||b.startsWith(a)));
const covers=(from,to)=>to.every(token=>from.some(other=>sameToken(token,other)));

const units={g:[1,'m'],kg:[1000,'m'],ml:[1,'v'],L:[1000,'v']};
function packageOf(text,fallback){
 const match=[...String(text||'').matchAll(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|lt|l)\b/gi)].at(-1);
 if(match){
  const unit=match[2].toLowerCase();
  return {size:Number(match[1].replace(',','.')),packUnit:unit==='lt'||unit==='l'?'L':unit==='gr'?'g':unit};
 }
 return fallback?.size>0&&units[fallback.packUnit]?{size:fallback.size,packUnit:fallback.packUnit}:null;
}
function samePackage(a,b){
 if(!a||!b)return true;
 const x=units[a.packUnit],y=units[b.packUnit];
 if(!x||!y)return a.packUnit===b.packUnit&&a.size===b.size;
 return x[1]===y[1]&&Math.abs(a.size*x[0]-b.size*y[0])<.001;
}

// candidates: [{text, name, package?}] where text is how it was written and name is
// the household's chosen name. Returns the name only when a single one fits.
export function matchKnownName(raw,candidates){
 const tokens=identityTokens(raw);
 if(tokens.length<2&&!(tokens.length===1&&tokens[0].length>=5))return null;
 const pack=packageOf(raw);
 const found=new Map();
 for(const candidate of candidates){
  const other=identityTokens(candidate.text);
  if(!other.length)continue;
  // Both sides must be fully explained by each other, so variants never merge
  // ("leite integral" never becomes "leite desnatado").
  if(!covers(tokens,other)||!covers(other,tokens))continue;
  const candidatePack=packageOf(candidate.text,candidate.package);
  if(pack&&candidatePack&&!samePackage(pack,candidatePack))continue;
  if(pack&&!candidatePack&&candidate.sized)continue;
  found.set(normalize(candidate.name),candidate.name);
 }
 return found.size===1?[...found.values()][0]:null;
}
