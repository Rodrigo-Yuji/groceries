import './style.css';
import {purchasePrices,latestCatalogPrice,discountPerUnit,priceSeries,sectorChanges,latestByMarket,matchingPriceSeries,hasPackageSize} from './price-analysis.js';
import {suggestReceiptNames,marketName,marketAliasKey,originalMarket} from './receipt-names.js';
import {appURL,invitationURL,pendingInvitation,clearInvitation,authMessage,changePassword} from './account.js';
import {createIcons,icons} from 'lucide';
import {normalize,money,number,suggestSector,purchaseItem,finishPurchase,unitPrice,parseReceipt,receiptFingerprint,originalPrice} from './domain.js';
import {state,session,supabase,records,get,put,remove,sectors,setSectors,persist,onChange,initialize,createHouse,joinHouse,logout,sync,batch,resolveConflict,listHouses,connectHousehold,manageHouse,saveDisplayName} from './store.js';
import {readImage,readQR,readReceiptFiles,importFiscalURL} from './receipt.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,cls='')=>`<i data-lucide="${name}" class="${cls}"></i>`;
function rememberName(key,name){
 if(!key||!name)return;
 const existing=records('alias').find(row=>row.key===key);
 if(existing?.name!==name)put('alias',{...existing,key,name});
}
const priceLabel=price=>price==null?'Sem preço':money(price);
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateLabel=s=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
let page='list',filter='all',search='',modalCleanup=null,receiptDraft=null,installPrompt=null,undoAction=null,modalBusy=false;
const nav=[['list','shopping-basket','Lista de compras'],['products','package','Meus produtos'],['history','receipt-text','Histórico'],['prices','chart-no-axes-combined','Preços'],['settings','settings-2','Configurações']];
function toast(message,undo){$('#toast').innerHTML=`<span>${esc(message)}</span>${undo?'<button id="undo">Desfazer</button>':''}`;$('#toast').classList.add('show');undoAction=undo;if(undo)$('#undo').onclick=()=>{undoAction?.();$('#toast').classList.remove('show');};clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),6500);}
function showModal(title,content,wide=false){closeModal();$('#modal-root').innerHTML=`<div class="overlay"><section role="dialog" aria-modal="true" aria-labelledby="dialog-title" class="modal ${wide?'wide':''}"><div class="modal-heading"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button></div>${content}</section></div>`;renderIcons();$('[data-close]').onclick=()=>{if(!modalBusy)closeModal();};const overlay=$('.overlay');let backdropPressed=false;overlay.addEventListener('pointerdown',event=>{backdropPressed=event.target===overlay;});overlay.addEventListener('pointercancel',()=>{backdropPressed=false;});overlay.addEventListener('click',event=>{const dismiss=backdropPressed&&event.target===overlay;backdropPressed=false;if(dismiss&&!modalBusy)closeModal();});requestAnimationFrame(()=>$('.modal input:not([type=file]),.modal button')?.focus());}
function closeModal(){modalCleanup?.();modalCleanup=null;$('#modal-root').innerHTML='';}
function renderIcons(){createIcons({icons,attrs:{'stroke-width':1.8}});}
function button(text,action,ic,cls='primary'){return `<button class="${cls}" data-action="${action}">${ic?icon(ic):''}${text}</button>`;}
function empty(title,text,action){return `<div class="empty">${icon('shopping-basket')}<h3>${title}</h3><p>${text}</p>${action||''}</div>`;}
function app(){
 const field=document.activeElement?.id==='search'?document.activeElement:null;
 const selection=field?[field.selectionStart,field.selectionEnd,field.selectionDirection]:null;
 const active=nav.find(n=>n[0]===page);const items=records('item'),pending=items.filter(i=>i.bought<i.quantity),bought=items.filter(i=>i.bought>0);
 const status=!navigator.onLine?'Sem internet':state.household?(session.status==='syncing'?'Sincronizando':session.status==='error'?'Sincronização pendente':state.queue.length?'Alterações pendentes':'Casa conectada'):'Neste aparelho';
 $('#app').innerHTML=`<aside class="sidebar"><a class="brand" href="#" aria-label="Groceries, início"><span class="brand-icon">${icon('shopping-basket')}</span><span>Groceries</span></a><div class="sidebar-caption">MENOS ESQUECIMENTO. MAIS TEMPO.</div><nav>${nav.map(([key,ic,title])=>`<button data-page="${key}" class="nav-item ${page===key?'active':''}">${icon(ic)}<span>${title}</span>${key==='list'?`<b>${pending.length}</b>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="little-illustration">${icon('sprout')}<strong>Uma casa, uma lista.</strong><p>Todo mundo pede.<br>Você compra com tranquilidade.</p></div><button class="house-switch" data-action="house">${icon('house')}<span><strong>${esc(state.household?.name||'Minha casa')}</strong><small>${state.household?'Lista compartilhada':'Modo local · sem cadastro'}</small></span>${icon('chevron-right')}</button></div></aside><main><header class="topbar"><span class="breadcrumb">Minha casa <span>/</span> ${active[2]}</span><a class="mobile-brand" href="#" aria-label="Groceries, início"><img src="${import.meta.env.BASE_URL}icon.svg" alt="" width="34" height="34"><span>Groceries</span></a><div class="top-actions"><button class="sync-pill ${session.status==='error'?'warn':''}" data-action="sync">${icon(!navigator.onLine?'wifi-off':state.household?'cloud-check':'hard-drive')}<span>${status}</span></button><button class="avatar" data-action="account" aria-label="Minha conta">${icon('user-round')}</button></div></header><div class="content"><div class="page-heading"><div><div class="eyebrow">${page==='list'?'DO PEDIDO AO CARRINHO':'GROCERIES'}</div><h1>${page==='list'?'O que a casa precisa?':active[2]}</h1><p>${({list:'A lista da casa, os preços e as compras em um só lugar.',products:'Seus produtos de sempre, prontos para a próxima compra.',history:'Cada ida ao mercado, guardada em um só lugar.',prices:'Saiba quanto pagou. Compare com mais clareza.',settings:'Deixe o Groceries do seu jeito.'})[page]}</p></div><div class="heading-actions">${page==='list'?button('Ler cupom','receipt','scan-line','secondary')+button(state.shopping?'Encerrar ida':'Começar ida','shopping','shopping-cart','secondary')+button('Adicionar item','add','plus'):page==='products'?button('Novo produto','product','plus'):page==='history'?button('Importar cupom','receipt','scan-line'):''}</div></div>${session.error?`<div class="notice">${icon('cloud-off')}<span>${esc(session.error)}</span><button data-page="settings">Ver configuração</button></div>`:''}${state.conflicts.length?`<div class="notice">${icon('git-compare-arrows')}<span>${state.conflicts.length} alteração(ões) precisam de revisão porque outra pessoa editou o mesmo item.</span><button data-action="conflicts">Revisar</button></div>`:''}${({list:renderList,products:renderProducts,history:renderHistory,prices:renderPrices,settings:renderSettings})[page]()}</div><footer>Groceries <span>Uma rotina mais leve começa aqui.</span></footer></main><nav class="mobile-nav">${nav.map(([key,ic,title])=>`<button data-page="${key}" class="${page===key?'active':''}" aria-label="${title}">${icon(ic)}<span>${key==='list'?'Lista':key==='settings'?'Ajustes':title.replace('Meus ','')}</span></button>`).join('')}</nav>`;
 renderIcons();bind();if(page==='prices')bindPriceAnalysis();
 if(selection&&$('#search')){const searchInput=$('#search');searchInput.focus({preventScroll:true});searchInput.setSelectionRange(...selection);}
}
function renderList(){
 const all=records('item');const comparisons=priceSeries(priceEntries(),records('product'),sectors());const count=all.length,bought=all.filter(i=>i.bought>=i.quantity).length;
 const est=all.reduce((sum,i)=>sum+i.quantity*(i.price||0),0),real=all.reduce((sum,i)=>sum+(i.bought||0)*(i.paidPrice??0),0);
 let shown=all.filter(i=>(filter==='pending'?i.bought<i.quantity:filter==='bought'?i.bought>0:true)&&normalize(i.name+' '+i.note).includes(normalize(search)));
 const groups=[...new Set([...sectors(),...shown.map(i=>i.sector)])];
 return `<div class="stats"><div class="stat"><span class="stat-icon green">${icon('list-checks')}</span><div><span>Na lista</span><strong>${count} <small>${count===1?'produto':'produtos'}</small></strong></div></div><div class="stat"><span class="stat-icon amber">${icon('shopping-cart')}</span><div><span>No carrinho</span><strong>${bought} <small>de ${count} completos</small></strong></div></div><div class="stat"><span class="stat-icon blue">${icon('wallet')}</span><div><span>Total estimado</span><strong>${money(est)}</strong><small>${all.some(i=>i.price==null)?'Estimativa incompleta':'Com os preços disponíveis'}</small></div></div></div><div class="list-layout"><section class="panel list-panel"><div class="list-toolbar"><div class="tabs">${[['all','Todos',all.length],['pending','Pendentes',all.filter(i=>i.bought<i.quantity).length],['bought','Comprados',all.filter(i=>i.bought>0).length]].map(([key,label,n])=>`<button data-filter="${key}" class="${filter===key?'selected':''}">${label}<span>${n}</span></button>`).join('')}</div><label class="search">${icon('search')}<input id="search" type="text" inputmode="search" role="searchbox" placeholder="Buscar na lista" value="${esc(search)}" aria-label="Buscar na lista"></label></div>${shown.length?groups.filter(s=>shown.some(i=>i.sector===s)).map(s=>`<div class="sector-heading"><span>${icon(sectorIcon(s))}${esc(s)}</span><small>${shown.filter(i=>i.sector===s).length} itens</small></div><div>${shown.filter(i=>i.sector===s).sort((a,b)=>(a.bought>=a.quantity)-(b.bought>=b.quantity)) .map(item=>renderItem(item,matchingPriceSeries(item,comparisons).length>0)).join('')}</div>`).join(''):empty(all.length?'Nenhum item por aqui':'Sua próxima compra começa aqui',all.length?'Tente outra busca ou filtro.':'Adicione o que está faltando. Quem mora com você também pode ajudar.',!all.length?button('Adicionar primeiro item','add','plus'):'')}<button class="add-row" data-action="add">${icon('plus')}Adicionar produto à lista</button></section><aside class="right-column"><div class="summary-card"><div class="summary-title">${icon('shopping-bag')}Sua compra</div><div class="progress-label"><span>Lista concluída</span><strong>${count?Math.round(bought/count*100):0}%</strong></div><div class="progress"><div style="width:${count?bought/count*100:0}%"></div></div><div class="summary-row"><span>Já no carrinho</span><strong>${money(real)}</strong></div><div class="summary-row muted"><span>Ainda na lista</span><span>${money(Math.max(0,est-real))}</span></div><div class="summary-total"><span>Total estimado</span><strong>${money(est)}</strong></div><button class="primary full" data-action="finish" ${!all.some(i=>i.bought>0)?'disabled':''}>${icon('check')}Finalizar compra</button><p class="micro">Os itens não comprados continuam na lista para a próxima vez.</p></div><div class="tip-card"><span class="tip-icon">${icon('lightbulb')}</span><h3>Faltou no mercado?</h3><p>Deixe o produto pendente. Ele continua aqui, sem precisar adicionar de novo.</p></div><button class="receipt-card" data-action="receipt"><span class="receipt-illustration">${icon('receipt-text')}</span><span><strong>O cupom faz as contas</strong><small>Importe os produtos e preços da sua compra.</small><b>Ler meu cupom ${icon('arrow-up-right')}</b></span></button></aside></div>`;
}
function sectorIcon(s){return ({Hortifruti:'carrot',Padaria:'croissant',Laticínios:'milk','Carnes e ovos':'egg',Mercearia:'wheat',Bebidas:'cup-soda',Limpeza:'spray-can',Higiene:'bath',Tecnologia:'cpu'})[s]||'package';}
function renderItem(i,canCompare){const done=i.bought>=i.quantity;return `<article class="item ${done?'done':''}"><button class="check-item ${done?'checked':i.bought>0?'partial':''}" data-check="${i.id}" aria-label="${done?'Desmarcar':'Marcar compra de'} ${esc(i.name)}">${i.bought>0?icon(done?'check':'minus'):''}</button><div class="item-main"><button class="item-name" data-edit="${i.id}">${esc(i.name)}</button>${state.shopping&&i.createdAt>state.lastSeen&&(i.requesterId ? i.requesterId!==session.user?.id : i.requester!==state.name)?'<span class="new-tag">Novo</span>':''}<div class="item-meta"><span>${i.quantity} ${esc(i.unit||'un')}${i.bought>0&&!done?` · ${i.bought} comprado(s)`:''}</span>${i.note||i.quickNote?`<span class="note">${esc([i.note,i.quickNote].filter(Boolean).join(' · '))}</span>`:''}<span class="requester">${esc(i.requester||'Você')}</span></div></div><div class="item-price">${i.price!=null?money(i.price):'<span>Sem preço</span>'}<small>${i.price!=null?'por '+esc(i.unit||'un'):''}</small></div>${canCompare?`<button class="icon-btn compare-markets" data-item-markets="${i.id}" title="Comparar mercados" aria-label="Comparar mercados para ${esc(i.name)}">${icon('store')}</button>`:''}<button class="icon-btn more" data-edit="${i.id}" aria-label="Editar ${esc(i.name)}">${icon('ellipsis')}</button></article>`;}
const catalogDrafts=new Map();
function renderProducts(){
 const catalog=records('product'),prices=priceEntries();
 const products=catalog.filter(product=>normalize(product.name+' '+product.sector).includes(normalize(search)))
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return `<div class="panel"><div class="panel-toolbar"><h2>Seu catálogo <span class="badge">${catalog.length}</span></h2><label class="search">${icon('search')}<input id="search" type="text" inputmode="search" role="searchbox" value="${esc(search)}" placeholder="Buscar produto" aria-label="Buscar produto"></label></div>${products.length?`<ul class="catalog-list">${products.map(product=>{const latest=latestCatalogPrice(product,prices);return `<li class="catalog-row"><span class="catalog-icon" aria-hidden="true">${icon(sectorIcon(product.sector))}</span><div class="catalog-name"><strong>${esc(product.name)}</strong><small>${esc(product.sector||'Sem setor')}</small></div><div class="catalog-price"><strong>${priceLabel(latest?.price??product.lastPrice)}</strong>${latest?`<small>Original ${priceLabel(originalPrice(latest))}</small><small>Desconto ${money(discountPerUnit(latest))}</small><small>${esc(latest.market)}</small>`:''}</div><form class="catalog-add" data-catalog-add="${product.id}"><div class="catalog-quantity"><button type="button" class="icon-btn" data-qty="-1" aria-label="Diminuir quantidade de ${esc(product.name)}">${icon('minus')}</button><input name="quantity" type="number" min=".001" max="100000" step="any" inputmode="decimal" required value="${esc(catalogDrafts.get(product.id)?.quantity??1)}" aria-label="Quantidade de ${esc(product.name)}"><button type="button" class="icon-btn" data-qty="1" aria-label="Aumentar quantidade de ${esc(product.name)}">${icon('plus')}</button></div><input name="note" class="catalog-note" value="${esc(catalogDrafts.get(product.id)?.note)}" placeholder="Observação" maxlength="300" aria-label="Observação para ${esc(product.name)}"><button class="primary catalog-submit" type="submit" aria-label="Adicionar ${esc(product.name)} à lista">${icon('plus')}<span>À lista</span></button></form><button class="icon-btn catalog-edit" data-product-edit="${product.id}" aria-label="Editar ${esc(product.name)}" title="Editar produto">${icon('pencil')}</button></li>`;}).join('')}</ul>`:catalog.length?empty('Nenhum produto encontrado','Tente buscar por outro nome ou setor.'):empty('Seu catálogo está vazio','Adicione um produto para reutilizá-lo nas próximas compras.',button('Cadastrar produto','product','plus'))}</div>`;
}
function renderHistory(){const purchases=records('purchase').sort((a,b)=>b.date.localeCompare(a.date));return `<div class="panel"><div class="panel-toolbar"><h2>Compras finalizadas <span class="badge">${purchases.length}</span></h2><span class="muted">Total registrado: ${money(purchases.reduce((s,p)=>s+p.total,0))}</span></div>${purchases.length?purchases.map(p=>`<button class="purchase-row" data-purchase="${p.id}"><span class="purchase-icon">${icon('store')}</span><span class="purchase-info"><strong>${esc(p.market)}</strong><small>${dateLabel(p.date)} · ${p.lines.length} produtos</small></span><strong>${money(p.total)}</strong>${icon('chevron-right')}</button>`).join(''):empty('Cada compra tem sua história','Finalize uma compra ou importe um cupom para começar seu histórico.',button('Ler cupom','receipt','scan-line'))}</div>`;}
function priceEntries(){return purchasePrices(records('purchase'));}
let priceHistoryOpen=false;
const percent=value=>new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1,signDisplay:'exceptZero'}).format(value/100);
const trendClass=value=>value>0?'trend-up':value<0?'trend-down':'muted';
function presentationOf(line){
 return [line.presentation,hasPackageSize(line)?line.size+' '+(line.packUnit||'un'):''].filter(Boolean).join(' · ');
}
function renderPrices(){
 const lines=priceEntries().filter(line=>normalize(line.name+' '+line.market).includes(normalize(search)));
 const series=priceSeries(lines,records('product'),sectors());
 const changes=sectorChanges(series,sectors());
 return `<section class="panel price-analysis"><div class="panel-toolbar"><h2>Análise de preços</h2><label class="search">${icon('search')}<input id="search" type="text" inputmode="search" role="searchbox" value="${esc(search)}" placeholder="Produto ou mercado" aria-label="Buscar preços"></label></div><p class="price-explainer">A variação compara a primeira e a última compra de cada apresentação dentro dos resultados. Se houver preços diferentes no mesmo cupom, o gráfico usa a média.</p>${series.length?`<div class="price-overview"><span><strong>${series.length}</strong> apresentações</span><span><strong>${series.filter(item=>item.change>0).length}</strong> subiram</span><span><strong>${series.filter(item=>item.change<0).length}</strong> caíram</span><button class="secondary" id="sector-chart" ${changes.length?'':'disabled'}>${icon('chart-bar')}Gráfico por setor</button></div><div class="table-scroll price-analysis-scroll"><table><thead><tr><th>Produto</th><th>Último preço pago</th><th>Variação</th><th>Melhor mercado</th><th>Gráfico</th></tr></thead><tbody>${series.map((item,index)=>{const markets=latestByMarket(item),best=markets[0];return `<tr><td><strong>${esc(item.name)}</strong><small>${esc([presentationOf(item),item.sector].filter(Boolean).join(' · '))}</small></td><td>${priceLabel(item.latest.price)} / ${esc(item.unit)}<small>${esc(item.latest.market)} · ${dateLabel(item.latest.date)}</small></td><td>${item.change==null?'<span class="muted">Sem comparação</span>':`<strong class="${trendClass(item.change)}">${percent(item.change)}</strong><small>Desde ${dateLabel(item.first.date)}</small>`}</td><td><button class="text-btn best-market" data-market-compare="${index}">${esc(best.market)}<small>${money(best.price)}${markets.length===1?' · 1 mercado':''}</small></button></td><td><button class="icon-btn" data-price-chart="${index}" aria-label="Ver gráfico de ${esc(item.name)}" title="Ver gráfico">${icon('chart-no-axes-combined')}</button></td></tr>`;}).join('')}</tbody></table></div>`:empty('Nenhum preço para analisar','Registre uma compra com preços ou ajuste a busca.')}</section><details class="panel price-history" ${priceHistoryOpen?'open':''}><summary>Histórico de preços <span>${lines.length} registros</span></summary>${lines.length?`<div class="table-scroll price-history-scroll"><table><thead><tr><th>Produto</th><th>Mercado</th><th>Data</th><th>Original</th><th>Pago</th><th>Preço base</th></tr></thead><tbody>${lines.map(line=>{
  const base=hasPackageSize(line)?unitPrice(line.price,line.size,line.packUnit||'un'):unitPrice(line.price,1,line.unit||'un');
  return `<tr><td><strong>${esc(line.name)}</strong><small>${esc(presentationOf(line))}</small></td><td>${esc(line.market)}</td><td>${dateLabel(line.date)}</td><td>${priceLabel(originalPrice(line))}</td><td>${priceLabel(line.price)}${line.allocatedDiscount>0?'<small>Desconto geral rateado</small>':''}</td><td>${base?money(base.value)+' / '+base.unit:'—'}</td></tr>`;
 }).join('')}</tbody></table></div>`:empty('Nenhum preço registrado','Os preços aparecem aqui depois de finalizar compras com valores informados.')}</details>`;
}
function bindPriceAnalysis(){
 const history=$('.price-history');
 if(history)history.ontoggle=()=>{priceHistoryOpen=history.open;};
 const lines=priceEntries().filter(line=>normalize(line.name+' '+line.market).includes(normalize(search)));
 const series=priceSeries(lines,records('product'),sectors());
 for(const button of document.querySelectorAll('[data-price-chart]')){
  button.onclick=()=>productPriceChart(series[Number(button.dataset.priceChart)]);
 }
 for(const button of document.querySelectorAll('[data-market-compare]')){
  button.onclick=()=>{const item=series[Number(button.dataset.marketCompare)];showMarketComparison(item.name,[item]);};
 }
 $('#sector-chart')?.addEventListener('click',()=>sectorPriceChart(sectorChanges(series,sectors())));
}
function showMarketComparison(name,series){
 const blocks=series.map(item=>{
  const markets=latestByMarket(item);
  return `<section class="market-comparison"><h3>${esc(presentationOf(item)||'Por '+item.unit)}</h3><ul>${markets.map((point,index)=>`<li><div><strong>${esc(point.market)}</strong><small>${dateLabel(point.date)}${index===0&&markets.length>1?' · menor preço registrado':''}</small></div><strong>${money(point.price)} / ${esc(item.unit)}</strong></li>`).join('')}</ul></section>`;
 }).join('');
 showModal(name,`<p class="muted">Último preço pago em cada mercado, do menor ao maior.</p>${blocks}`);
}

function productPriceChart(series){
 const points=[...series.points].reverse();
 const max=Math.max(.01,...points.map(point=>point.price));
 showModal(series.name,`<p class="muted">${esc(presentationOf(series)||series.sector)} · preço pago por ${esc(series.unit)}</p><ol class="price-bars">${points.map(point=>`<li><div><span>${dateLabel(point.date)} · ${esc(point.market)}</span><strong>${money(point.price)}</strong></div><div class="price-bar-track" aria-hidden="true"><i style="--bar:${point.price/max*100}%"></i></div></li>`).join('')}</ol>`);
}
function sectorPriceChart(rows){
 const max=Math.max(1,...rows.map(row=>Math.abs(row.change)));
 showModal('Variação por setor',`<p class="muted">Média das variações das apresentações com pelo menos dois preços comparáveis. Cada apresentação tem o mesmo peso.</p><ol class="price-bars">${rows.map(row=>`<li><div><span>${esc(row.sector)} · ${row.count} ${row.count===1?'apresentação':'apresentações'}</span><strong class="${trendClass(row.change)}">${percent(row.change)}</strong></div><div class="price-bar-track ${trendClass(row.change)}" aria-hidden="true"><i style="--bar:${Math.abs(row.change)/max*100}%"></i></div></li>`).join('')}</ol>`);
}
function renderSettings(){return `<div class="settings-grid"><section class="panel settings-card"><div class="section-icon">${icon('user-round')}</div><h2>Você e sua casa</h2><p>Seu nome identifica quem pediu cada produto.</p><form id="name-form"><label>Seu nome<input name="name" maxlength="60" value="${esc(state.name)}" required placeholder="Como você quer aparecer?"></label><button class="secondary" type="submit">Salvar nome</button></form><hr><h3>${esc(state.household?.name||'Compartilhe a lista')}</h3><p>${state.household?'Pessoas com o código podem entrar na casa e participar das compras.':'Entre na sua conta para criar uma casa ou participar da lista de outra pessoa.'}</p>${button(state.household?'Gerenciar casa':'Configurar compartilhamento','house','users','secondary')}${button(session.user?'Minha conta':'Entrar ou criar conta','account','log-in','text-btn')}</section><section class="panel settings-card"><div class="section-icon">${icon('layout-list')}</div><h2>Setores do mercado</h2><p>Organize na mesma ordem do seu percurso. Arrume os setores com as setas.</p><div class="sector-settings">${sectors().map((s,i)=>`<div><span>${icon(sectorIcon(s))}${esc(s)}</span><div><button class="icon-btn" data-sector-up="${i}" aria-label="Mover ${esc(s)} para cima" ${i===0?'disabled':''}>${icon('arrow-up')}</button><button class="icon-btn" data-sector-edit="${i}" aria-label="Renomear ${esc(s)}">${icon('pencil')}</button><button class="icon-btn" data-sector-remove="${i}" aria-label="Remover ${esc(s)}">${icon('x')}</button></div></div>`).join('')}</div>${button('Criar setor','sector','plus','secondary')}</section><section class="panel settings-card"><div class="section-icon">${icon('smartphone')}</div><h2>Seu aplicativo, sempre à mão</h2><p>Instale pelo navegador para abrir como aplicativo. Sua lista fica disponível mesmo sem internet após o primeiro acesso.</p>${button('Como instalar','install','download','secondary')}<hr><h3>Seus dados</h3><p>Exporte um backup para guardar suas listas, produtos e histórico.</p>${button('Exportar backup','export','download','secondary')}<label class="file-label secondary">${icon('upload')}Restaurar backup<input id="backup-file" type="file" accept="application/json,.json" hidden></label><p class="micro">A restauração adiciona registros ausentes. Dados existentes com o mesmo identificador são preservados.</p></section></div>`;}
function bind(){
 document.querySelectorAll('[data-page]').forEach(el=>el.onclick=()=>{page=el.dataset.page;search='';app();window.scrollTo(0,0);});
 document.querySelectorAll('.brand,.mobile-brand').forEach(link=>link.onclick=e=>{e.preventDefault();page='list';search='';app();window.scrollTo(0,0);});
 document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>actions[el.dataset.action]?.());
 document.querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>{filter=el.dataset.filter;app();});
 document.querySelectorAll('[data-item-markets]').forEach(button=>button.onclick=()=>{
  const item=get(button.dataset.itemMarkets);
  if(!item)return;
  const series=priceSeries(priceEntries(),records('product'),sectors());
  showMarketComparison(item.name,matchingPriceSeries(item,series));
 });
 const searchInput=$('#search');
 if(searchInput){
  const updateSearch=event=>{
   if(event.isComposing||search===searchInput.value)return;
   search=searchInput.value;
   app();
  };
  searchInput.oninput=updateSearch;
  searchInput.oncompositionend=updateSearch;
 }
 document.querySelectorAll('[data-check]').forEach(el=>el.onclick=()=>{const i=get(el.dataset.check);if(i.bought>0){const old={...i};put('item',{...i,bought:0,paidPrice:undefined});toast('Produto desmarcado.',()=>put('item',old));}else buyDialog(i);});
 document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>itemDialog(get(el.dataset.edit)));
 bindCatalogForms();
 document.querySelectorAll('[data-product-edit]').forEach(el=>el.onclick=()=>productDialog(get(el.dataset.productEdit)));
 document.querySelectorAll('[data-purchase]').forEach(el=>el.onclick=()=>purchaseDialog(get(el.dataset.purchase)));
 $('#name-form')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button');
  button.disabled=true;
  try{await saveDisplayName(form.elements.name.value);toast('Nome atualizado.');}
  catch(error){toast(error.message);}
  finally{button.disabled=false;}
 });
 document.querySelectorAll('[data-sector-up]').forEach(el=>el.onclick=()=>{let list=[...sectors()],i=+el.dataset.sectorUp;[list[i-1],list[i]]=[list[i],list[i-1]];setSectors(list);});
 document.querySelectorAll('[data-sector-edit]').forEach(el=>el.onclick=()=>sectorDialog(+el.dataset.sectorEdit));
 document.querySelectorAll('[data-sector-remove]').forEach(el=>el.onclick=()=>{const name=sectors()[+el.dataset.sectorRemove];if(name==='Sem setor')return toast('O setor padrão precisa permanecer.');confirmDialog('Remover setor?',`Os produtos de “${name}” passam para Sem setor.`,()=>{for(const kind of ['item','product'])for(const r of records(kind).filter(r=>r.sector===name))put(kind,{...r,sector:'Sem setor'});setSectors(sectors().filter(s=>s!==name));});});
 $('#backup-file')?.addEventListener('change',restoreBackup);
}
const actions={shopping:()=>{state.shopping=!state.shopping;if(state.shopping)state.lastSeen=Date.now();persist();app();},add:()=>itemDialog(),product:()=>productDialog(),receipt:()=>receiptDialog(),finish:()=>finishDialog(),account:()=>accountDialog(),house:()=>houseDialog(),sync:()=>{if(state.household){void sync();toast('Tentando sincronizar…');}else toast('Lista salva neste aparelho. Entre na sua conta para compartilhar.');},sector:()=>sectorDialog(),install:()=>install(),export:()=>exportBackup(),conflicts:()=>conflictDialog()};
function bindCatalogForms(){
 document.querySelectorAll('[data-catalog-add]').forEach(form=>{
  const id=form.dataset.catalogAdd;
  const quantity=form.elements.quantity,note=form.elements.note;
  const remember=()=>catalogDrafts.set(id,{quantity:quantity.value,note:note.value});
  form.oninput=remember;
  for(const button of form.querySelectorAll('[data-qty]')){
   button.onclick=()=>{
    const current=quantity.valueAsNumber;
    const next=(Number.isFinite(current)?current:1)+Number(button.dataset.qty);
    quantity.value=Math.min(100000,Math.max(Number.isInteger(current)?1:.001,Math.round(next*1000)/1000));
    remember();
   };
  }
  form.onsubmit=event=>{
   event.preventDefault();
   const product=get(id),qty=number(quantity.value),observation=note.value.trim();
   if(!product||!(qty>0&&qty<=100000))return;
   const unit=product.unit||'un',latest=latestCatalogPrice(product,priceEntries());
   const existing=records('item').find(item=>item.unit===unit&&normalize(item.name)===normalize(product.name));
   const newQuantity=Math.round(((existing?.quantity||0)+qty)*1000)/1000;
   if(newQuantity>100000){toast('A quantidade total deve ser de até 100.000.');return;}
   catalogDrafts.delete(id);
   if(existing){
    const notes=[...new Set([existing.quickNote,observation].filter(Boolean))];
    put('item',{...existing,quantity:newQuantity,quickNote:notes.join(' · ')});
   }else{
    put('item',{productId:id,name:product.name,quantity:newQuantity,bought:0,unit,sector:product.sector||'Sem setor',price:latest?.price??product.lastPrice??null,size:product.size||1,packUnit:product.packUnit||unit,presentation:product.presentation||'',quickNote:observation,createdAt:Date.now(),requester:state.name||session.user?.email?.split('@')[0]||'Você'});
   }
   toast(existing?'Quantidade atualizada na lista.':'Produto adicionado à lista.');
  };
 });
}
function sectorOptions(selected){return [...new Set([...sectors(),selected].filter(Boolean))].map(s=>`<option ${s===selected?'selected':''}>${esc(s)}</option>`).join('');}
function units(selected='un'){return ['un','kg','g','L','ml','pacote','caixa'].map(s=>`<option ${s===selected?'selected':''}>${s}</option>`).join('');}
function itemDialog(item=null,product=null){
 const p=product|| (item?.productId?get(item.productId):null);const value=item||{name:p?.name||'',quantity:1,unit:p?.unit||'un',sector:p?.sector||'Sem setor',price:p?.lastPrice??null,size:p?.size||1,packUnit:p?.packUnit||'un',presentation:p?.presentation||''};
 showModal(item?'Editar item':'Adicionar à lista',`<form id="item-form"><label>Produto<input name="name" id="product-name" list="product-suggestions" value="${esc(value.name)}" placeholder="Ex.: leite integral" maxlength="120" required autocomplete="off"><datalist id="product-suggestions">${records('product').map(p=>`<option value="${esc(p.name)}">${esc(p.sector)}</option>`).join('')}</datalist></label><div id="duplicate-hint" class="field-hint"></div><div class="form-row"><label>Quantidade<input name="quantity" type="number" min="0.001" max="100000" step="0.001" value="${value.quantity}" required></label><label>Unidade<select name="unit">${units(value.unit)}</select></label></div><label>Setor<select name="sector" id="item-sector">${sectorOptions(value.sector)}</select></label><label>Observação <span class="optional">opcional</span><input name="note" value="${esc(value.note)}" maxlength="300" placeholder="Marca preferida, substituição…"></label><div class="form-row"><label>Preço por unidade (R$)<input name="price" type="number" min="0" max="1000000" step="0.01" value="${value.price??''}" placeholder="Opcional"></label><label>Quem pediu<input name="requester" maxlength="60" value="${esc(value.requester||state.name||session.user?.email?.split('@')[0]||'Você')}"></label></div><details><summary>Marca e tamanho da embalagem</summary><label>Apresentação<input name="presentation" maxlength="120" placeholder="Ex.: marca X, integral" value="${esc(value.presentation)}"></label><div class="form-row"><label>Tamanho<input name="size" type="number" min="0.001" step="0.001" value="${value.size||1}"></label><label>Unidade da embalagem<select name="packUnit">${units(value.packUnit||'un')}</select></label></div></details><p id="form-error" class="form-error" role="alert"></p><div class="modal-actions">${item?'<button type="button" class="danger-text" id="remove-item">Remover item</button>':'<button type="button" class="secondary" data-cancel>Cancelar</button>'}<button class="primary" type="submit">${icon('plus')}${item?'Salvar alterações':'Adicionar à lista'}</button></div></form>`);
 let sectorChanged=!!item||!!p;$('#item-sector').onchange=()=>{sectorChanged=true;};
 $('#product-name').oninput=e=>{const name=e.target.value;const existing=records('product').find(p=>normalize(p.name)===normalize(name));if(!sectorChanged)$('#item-sector').value=existing?.sector||suggestSector(name,sectors());const dup=records('item').find(i=>i.id!==item?.id&&normalize(i.name)===normalize(name));$('#duplicate-hint').textContent=dup?`Já está na lista (${dup.quantity} ${dup.unit}). Ao adicionar, as quantidades serão somadas.`:'';};
 $('[data-cancel]')?.addEventListener('click',closeModal);
 $('#remove-item')?.addEventListener('click',()=>{const old={...item};remove(item.id);closeModal();toast('Item removido.',()=>put('item',old));});
 $('#item-form').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const qty=number(f.quantity),price=f.price===""?null:number(f.price),size=number(f.size)||1;const name=f.name.trim();if(!name)return;const dup=records('item').find(i=>i.id!==item?.id&&normalize(i.name)===normalize(name));if(dup&&dup.unit!==f.unit){$('#form-error').textContent='Este produto já está na lista com outra unidade. Edite o item existente ou diferencie o nome.';return;}if(item&&qty<(item.bought||0)){$('#form-error').textContent='A quantidade pedida não pode ser menor que a já comprada.';return;}
 const existing=records('product').find(p=>normalize(p.name)===normalize(name));const productId=put('product',{...existing,name,sector:f.sector,unit:f.unit,lastPrice:price,size,packUnit:f.packUnit,presentation:f.presentation});
 if(dup){put('item',{...dup,quantity:dup.quantity+qty});toast('Produto existente: quantidade aumentada.');if(item)remove(item.id);}else put('item',{...item,...f,name,quantity:qty,price,size,productId,bought:item?.bought||0,createdAt:item?.createdAt||Date.now()});closeModal();};
}
function buyDialog(i){showModal('Colocar no carrinho',`<form id="buy-form"><p class="dialog-lead">${esc(i.name)}</p><div class="form-row"><label>Quantidade comprada (${esc(i.unit)})<input name="qty" type="number" min="0.001" max="${i.quantity}" step="0.001" value="${i.quantity}" required></label><label>Preço por ${esc(i.unit)} (R$)<input name="price" type="number" min="0" max="1000000" step="0.01" value="${i.paidPrice??i.price??''}" placeholder="Opcional"></label></div><p class="micro">Comprou menos? O restante continua pendente. Sem preço, o valor fica como não informado.</p><p id="form-error" class="form-error"></p><div class="modal-actions"><button type="button" class="secondary" data-cancel>Cancelar</button><button class="primary">${icon('check')}Confirmar</button></div></form>`);$('[data-cancel]').onclick=closeModal;$('#buy-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);try{put('item',purchaseItem(i,number(f.get('qty')),f.get('price')===''?null:number(f.get('price'))));closeModal();toast('Produto no carrinho.',()=>put('item',i));}catch(err){$('#form-error').textContent=err.message;}};}
function finishDialog(){const items=records('item').filter(i=>i.bought>0);if(!items.length)return toast('Marque os produtos que você comprou primeiro.');showModal('Finalizar compra',`<form id="finish-form"><p>${items.length} produtos no carrinho · <strong>${money(items.reduce((s,i)=>s+i.bought*(i.paidPrice??0),0))}</strong></p>${items.some(i=>i.paidPrice==null)?'<div class="info-strip">Há produtos sem preço. O total ficará incompleto; você pode corrigir no histórico depois.</div>':''}<label>Mercado<input name="market" maxlength="120" placeholder="Onde você comprou?" required></label><label>Data da compra<input name="date" type="date" value="${today()}" max="${today()}" required></label><p class="micro">Os produtos comprados vão para o histórico. O que faltar continua na lista.</p><div class="modal-actions"><button type="button" class="secondary" data-cancel>Voltar</button><button class="primary">Finalizar compra</button></div></form>`);$('[data-cancel]').onclick=closeModal;$('#finish-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);savePurchase(records('item'),f.get('market'),f.get('date'));closeModal();toast('Compra finalizada. Os pendentes continuam na lista.');};}
function savePurchase(items,market,date,extra={}){return batch(()=>{const {purchase,remaining}=finishPurchase(items,market,date);put('purchase',{...purchase,createdAt:Date.now(),...extra});for(const i of items){const next=remaining.find(r=>r.id===i.id);if(next)put('item',next);else remove(i.id);}for(const l of purchase.lines){const p=get(l.productId);if(p)put('product',{...p,lastPrice:l.price??p.lastPrice,size:l.size||p.size,packUnit:l.packUnit||p.packUnit});}state.lastSeen=Date.now();state.shopping=false;});}
function productDialog(p){showModal(p?'Editar produto':'Novo produto',`<form id="product-form"><label>Nome<input name="name" required maxlength="120" value="${esc(p?.name)}"></label><label>Setor<select name="sector">${sectorOptions(p?.sector||'Sem setor')}</select></label><label>Unidade<select name="unit">${units(p?.unit||'un')}</select></label><div class="modal-actions">${p?'<button type="button" class="danger-text" id="delete-product">Excluir produto</button>':'<button type="button" class="secondary" data-cancel>Cancelar</button>'}<button class="primary">Salvar produto</button></div><p id="form-error" class="form-error"></p></form>`);$('[data-cancel]')?.addEventListener('click',closeModal);$('#delete-product')?.addEventListener('click',()=>{remove(p.id);closeModal();toast('Produto excluído do catálogo.');});$('#product-form').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.name=f.name.trim();if(!f.name)return;const duplicate=records('product').find(r=>r.id!==p?.id&&normalize(r.name)===normalize(f.name));if(duplicate){$('#form-error').textContent='Já existe um produto com este nome.';return;}put('product',{...p,...f});for(const i of records('item').filter(i=>i.productId===p?.id))put('item',{...i,sector:f.sector});closeModal();toast('Produto salvo.');};}
function sectorDialog(index){const old=index===undefined?'':sectors()[index];showModal(old?'Renomear setor':'Criar setor',`<form id="sector-form"><label>Nome do setor<input name="name" value="${esc(old)}" maxlength="50" required></label><p id="form-error" class="form-error"></p><div class="modal-actions"><button class="primary">Salvar setor</button></div></form>`);$('#sector-form').onsubmit=e=>{e.preventDefault();const name=new FormData(e.target).get('name').trim();if(!name||sectors().some(s=>s!==old&&normalize(s)===normalize(name))){$('#form-error').textContent='Escolha um nome diferente dos setores existentes.';return;}if(old==='Sem setor'){$('#form-error').textContent='O nome do setor padrão precisa permanecer.';return;}const list=[...sectors()];if(old){list[index]=name;for(const kind of ['item','product'])for(const r of records(kind).filter(r=>r.sector===old))put(kind,{...r,sector:name});}else list.splice(list.length-1,0,name);setSectors(list);closeModal();};}
function confirmDialog(title,text,fn){showModal(title,`<p>${esc(text)}</p><div class="modal-actions"><button class="secondary" data-cancel>Cancelar</button><button class="primary" id="confirm">Confirmar</button></div>`);$('[data-cancel]').onclick=closeModal;$('#confirm').onclick=()=>{fn();closeModal();};}
function purchaseDialog(p){showModal(p.market,`<div class="summary-row"><span class="muted">${dateLabel(p.date)} · ${p.lines.length} produtos</span><button class="secondary" id="edit-market">${icon('pencil')}Editar mercado</button></div><div class="purchase-lines">${p.lines.map((l,idx)=>`<label class="history-line"><input type="checkbox" name="repeat" value="${idx}"><span><strong>${esc(l.name)}</strong><small>${l.quantity} ${esc(l.unit||'un')}</small><small>Original: ${priceLabel(originalPrice(l))} · Pago: ${priceLabel(l.price)} por ${esc(l.unit||'un')}${l.allocatedDiscount>0?' · desconto geral rateado':''}</small></span><strong>${priceLabel(l.total)}</strong><button class="icon-btn" data-price-edit="${idx}" aria-label="Editar produto ${esc(l.name)}">${icon('pencil')}</button></label>`).join('')}</div><div class="summary-total"><strong>Total</strong><strong>${money(p.total)}</strong></div><div class="modal-actions"><button class="danger-text" id="delete-purchase">Excluir compra</button><button class="secondary" id="select-all">Selecionar todos</button><button class="primary" id="repeat-purchase">${icon('plus')}Adicionar selecionados à lista</button></div>`,true);$('#edit-market').onclick=()=>editMarket(p);$('#delete-purchase').onclick=()=>deletePurchase(p);$('#select-all').onclick=()=>document.querySelectorAll('[name=repeat]').forEach(el=>el.checked=true);$('#repeat-purchase').onclick=()=>{const selected=[...document.querySelectorAll('[name=repeat]:checked')].map(e=>p.lines[+e.value]);if(!selected.length)return toast('Selecione os produtos que quer comprar novamente.');for(const l of selected){const existing=records('item').find(i=>normalize(i.name)===normalize(l.name)&&i.unit===l.unit);if(!existing)put('item',{...l,id:undefined,quantity:l.quantity,bought:0,createdAt:Date.now(),requester:state.name||'Você'});}closeModal();page='list';app();toast('Produtos adicionados. Os que já estavam na lista foram mantidos.');};document.querySelectorAll('[data-price-edit]').forEach(el=>el.onclick=e=>{e.preventDefault();priceEdit(p,+el.dataset.priceEdit);});}
function deletePurchase(p){
 confirmDialog('Excluir esta compra?', 'A compra será removida do histórico e o cupom poderá ser importado novamente. Os nomes corrigidos serão mantidos.',()=>{
  const current=get(p.id);
  if(!current)return;
  batch(()=>{
   const source=originalMarket(current);
   if(normalize(source)!==normalize(current.market)&&!records('alias').some(alias=>alias.key===marketAliasKey(source))){
    rememberName(marketAliasKey(source),current.market);
   }
   for(const line of current.lines){
    const key=normalize(line.sourceName);
    if(key&&key!==normalize(line.name)&&!records('alias').some(alias=>alias.key===key))rememberName(key,line.name);
   }
   remove(p.id);
  });
  toast('Compra excluída. Você já pode importar o cupom novamente.');
 });
}
function editMarket(p){
 showModal('Editar mercado','<form id="market-edit"><label>Nome do mercado<input name="market" maxlength="120" required value="'+esc(p.market)+'"></label><div class="modal-actions"><button type="button" class="secondary" id="back-purchase">Voltar</button><button class="primary">Salvar nome</button></div></form>');
 $('#back-purchase').onclick=()=>purchaseDialog(get(p.id)||p);
 $('#market-edit').onsubmit=event=>{
  event.preventDefault();
  const form=event.currentTarget,market=form.elements.market.value.trim();
  if(!market){form.elements.market.setCustomValidity('Informe o nome do mercado.');form.elements.market.reportValidity();return;}
  const current=get(p.id);
  if(!current){closeModal();return toast('Compra não encontrada.');}
  const marketSource=originalMarket(current);
  const updated={...current,market,marketSource};
  batch(()=>{rememberName(marketAliasKey(marketSource),market);rememberName(marketAliasKey(current.market),market);put('purchase',updated);});
  purchaseDialog(updated);
  toast('Nome do mercado atualizado.');
 };
 $('#market-edit input').oninput=event=>event.target.setCustomValidity('');
}
function priceEdit(p,idx){const l=p.lines[idx];showModal('Editar produto da compra',`<form id="price-edit"><label>Nome do produto<input name="name" required maxlength="120" value="${esc(l.name)}"></label><label>Preço por ${esc(l.unit||'un')}<input name="price" type="number" min="0" max="1000000" step="any" value="${l.price??''}"></label><label>Preço original por ${esc(l.unit||'un')}<input name="originalPrice" type="number" min="0" max="1000000" step="any" value="${originalPrice(l)??''}"></label><label>Marca / apresentação<input name="presentation" maxlength="120" value="${esc(l.presentation)}"></label><div class="form-row"><label>Tamanho da embalagem<input name="size" type="number" min="0.001" step="0.001" value="${l.size||1}" required></label><label>Unidade<select name="packUnit">${units(l.packUnit||l.unit||'un')}</select></label></div><div class="modal-actions"><button class="primary">Salvar correção</button></div></form>`);$('#price-edit').onsubmit=e=>{
 e.preventDefault();
 const form=e.currentTarget;
 const f=Object.fromEntries(new FormData(form)),name=f.name.trim();
 if(!name){form.elements.name.setCustomValidity('Informe o nome do produto.');form.elements.name.reportValidity();return;}
 const current=get(p.id);
 if(!current||!current.lines[idx]){closeModal();return toast('Produto não encontrado.');}
 const price=f.price===''?null:number(f.price),original=f.originalPrice===''?price:number(f.originalPrice);
 const lines=current.lines.map((v,i)=>i===idx?{...v,name,presentation:f.presentation,packUnit:f.packUnit,price,originalPrice:original,
  discount:original===originalPrice(v)&&price===v.price?v.discount:original==null||price==null?0:Math.round((original-price)*v.quantity*100)/100,
  allocatedDiscount:original===originalPrice(v)&&price===v.price?v.allocatedDiscount:0,
  size:number(f.size),total:price===v.price?v.total:price==null?null:Math.round(price*v.quantity*100)/100}:v);
 const oldLine=current.lines[idx];
 const updated={...current,lines,total:Math.round(lines.reduce((s,l)=>s+(l.total??0),0)*100)/100};
 batch(()=>{
  if(name!==oldLine.name){
   rememberName(normalize(oldLine.sourceName||oldLine.name),name);
   rememberName(normalize(oldLine.name),name);
   const catalog=get(oldLine.productId);
   const duplicate=records('product').some(product=>product.id!==catalog?.id&&normalize(product.name)===normalize(name));
   if(catalog&&!duplicate&&normalize(catalog.name)===normalize(oldLine.name))put('product',{...catalog,name});
  }
  put('purchase',updated);
 });
 purchaseDialog(updated);
 toast('Produto atualizado.');
 };$('#price-edit [name=name]').oninput=event=>event.target.setCustomValidity('');}

function accountDialog(mode='login',message='',email=''){
 if(session.user&&!['reset','register'].includes(mode)){
  showModal('Minha conta',`<p>${esc(session.user.email)}</p><p id="account-error" role="alert"></p><div class="modal-actions"><button class="secondary" id="sign-out">Sair</button><button class="primary" id="change-password">Alterar senha</button></div>`);
  $('#change-password').onclick=()=>passwordDialog(false);
  $('#sign-out').onclick=async()=>{
   try{await logout();closeModal();}catch(error){const status=$('#account-error');if(status)status.textContent=error.message;}
  };
  return;
 }
 const reset=mode==='reset',register=mode==='register';
 const title=reset?'Esqueci minha senha':register?'Criar conta':'Entrar';
 const password=reset?'':`<label>Senha<input type="password" name="password" autocomplete="${register?'new-password':'current-password'}" ${register?'minlength="8"':''} required></label>`;
 showModal(title,`<form id="account-form"><label>E-mail<input type="email" name="email" value="${esc(email)}" required autocomplete="email"></label>${password}<p id="account-error" role="status">${esc(message)}</p><button class="primary" type="submit">${reset?'Enviar link de recuperação':title}</button></form><div class="modal-actions">${!reset&&!register?'<button class="text-btn" id="forgot-password">Esqueci minha senha</button><button class="secondary" id="register-account">Criar conta</button>':'<button class="text-btn" id="back-to-login">Voltar para entrar</button>'}</div>`);
 const form=$('#account-form'),status=$('#account-error'),submit=form.querySelector('button');
 const emailValue=()=>form.elements.email.value.trim();
 $('#forgot-password')?.addEventListener('click',()=>accountDialog('reset','',emailValue()));
 $('#register-account')?.addEventListener('click',()=>accountDialog('register','',emailValue()));
 $('#back-to-login')?.addEventListener('click',()=>accountDialog('login','',emailValue()));
 form.onsubmit=async event=>{
  event.preventDefault();
  submit.disabled=true;
  try{
   const email=emailValue();
   const url=appURL();
   if(reset){
    url.searchParams.set('recuperar','1');
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:url.href});
    if(error)throw error;
    status.textContent='Se houver uma conta para este e-mail, enviaremos um link para redefinir a senha.';
   }else if(register){
    const {data,error}=await supabase.auth.signUp({email,password:form.elements.password.value,options:{emailRedirectTo:url.href}});
    if(error)throw error;
    if(data.session){if(form.isConnected)closeModal();}
    else status.textContent='Confira seu e-mail para confirmar a conta. Se já tiver cadastro, entre ou recupere a senha.';
   }else{
    const {error}=await supabase.auth.signInWithPassword({email,password:form.elements.password.value});
    if(error)throw error;
    if(form.isConnected)closeModal();
   }
  }catch(error){status.textContent=authMessage(error);}
  finally{submit.disabled=false;}
 };
}
function cleanRecoveryURL(){
 const url=new URL(location.href);
 url.searchParams.delete('recuperar');
 url.hash='';
 history.replaceState(history.state,'',url.href);
}
function passwordDialog(recovery){
 showModal(recovery?'Redefinir senha':'Alterar senha',`<form id="password-form">${recovery?'':'<label>Senha atual<input type="password" name="current" required autocomplete="current-password"></label>'}<label>Nova senha<input type="password" name="password" minlength="8" required autocomplete="new-password"></label><label>Confirme a nova senha<input type="password" name="confirm" minlength="8" required autocomplete="new-password"></label><p id="password-status" role="alert"></p><button class="primary">Salvar nova senha</button></form>`);
 const form=$('#password-form'),status=$('#password-status'),submit=form.querySelector('button');
 form.onsubmit=async event=>{
  event.preventDefault();
  const password=form.elements.password.value;
  if(password!==form.elements.confirm.value){status.textContent='As duas senhas precisam ser iguais.';return;}
  submit.disabled=true;
  try{
   await changePassword(recovery?null:form.elements.current.value,password);
   if(recovery)cleanRecoveryURL();
   if(form.isConnected)closeModal();
   toast('Senha atualizada.');
   if(pendingInvitation())void houseDialog();
  }catch(error){status.textContent=authMessage(error);}
  finally{submit.disabled=false;}
 };
}
function renderHouseInvite(result){
 const status=$('#invite-code');
 if(!status)return;
 status.replaceChildren();
 if(!result.code){status.textContent='Convite revogado.';return;}
 const url=invitationURL(result.code);
 const label=document.createElement('label');
 label.textContent='Link de convite · válido por 7 dias';
 const input=Object.assign(document.createElement('input'),{type:'text',value:url,readOnly:true});
 input.onclick=()=>input.select();
 label.append(input);
 const copy=Object.assign(document.createElement('button'),{className:'secondary',textContent:'Copiar link'});
 copy.onclick=async()=>{
  try{await navigator.clipboard.writeText(url);toast('Link copiado.');}
  catch{input.select();toast('Selecione e copie o link.');}
 };
 status.append(label,copy);
}
async function houseDialog() {
 if (!session.user) return accountDialog();
 const active = state.household;
 const invitation=pendingInvitation();
 showModal('Casas', '<div id="house-details"></div><form id="create-house"><label>Nome da casa<input name="value" maxlength="100" required></label><button class="primary">Criar casa</button></form><form id="join-house"><label>Código de convite<input name="value" required></label><button class="secondary">Entrar na casa</button></form><p id="house-error" role="status"></p>');
 const pane = $('#house-details');
 if(invitation)$('#join-house input').value=invitation;
 const showError = error => { const status=$('#house-error'); if(status)status.textContent=error.message; };
 for (const [selector,action] of [['#create-house',createHouse],['#join-house',joinHouse]]) {
  $(selector).onsubmit = async event => {
   event.preventDefault();
   if(state.queue.length)return showError(Error('Sincronize a lista antes de trocar de casa.'));
   try { await action(new FormData(event.currentTarget).get('value')); if(action===joinHouse)clearInvitation(); if(pane.isConnected)void houseDialog(); }
   catch (error) { showError(error); }
  };
 }
 try {
  const houses=await listHouses();
  const details=active?await manageHouse('list'):null;
  if(!pane.isConnected)return;
  pane.innerHTML='<div class="house-list"></div><p id="invite-code" role="status"></p>';
  for(const house of houses){
   const button=document.createElement('button');
   button.className='secondary';
   button.textContent=house.name+(house.id===active?.id?' · atual':'');
   button.disabled=house.id===active?.id;
   button.onclick=async()=>{try{await connectHousehold(house.id);void houseDialog();}catch(error){showError(error);}};
   pane.querySelector('.house-list').append(button);
  }
  if(!details)return;
  for(const member of details.members){
   const row=document.createElement('div');
   row.className='summary-row';
   row.textContent=member.name+(member.owner?' · responsável':'');
   if(details.owner&&!member.owner){
    const removeButton=document.createElement('button');
    removeButton.className='danger-text';
    removeButton.textContent='Remover';
    removeButton.onclick=async()=>{if(!window.confirm('Remover este participante?'))return;try{await manageHouse('remove',member.id);void houseDialog();}catch(error){showError(error);}};
    row.append(removeButton);
   }
   pane.append(row);
  }
  if(details.owner)for(const [action,label] of [['invite','Gerar convite por 7 dias'],['revoke','Revogar convite']]){
   const inviteButton=document.createElement('button');
   inviteButton.className='secondary';
   inviteButton.textContent=label;
   inviteButton.onclick=async()=>{try{const result=await manageHouse(action);renderHouseInvite(result);}catch(error){showError(error);}};
   pane.append(inviteButton);
  }
 } catch(error){showError(error);}
}
function install() {
 if (installPrompt) {
  void installPrompt.prompt();
  installPrompt = null;
 } else {
  showModal('Instalar Groceries', '<p>No iPhone, abra no Safari e escolha Compartilhar → Adicionar à Tela de Início. No Android, procure a opção Instalar app no menu do navegador.</p>');
 }
}
function exportBackup() {
 const blob = new Blob([JSON.stringify({schema:1,records:Object.values(state.records).filter(row=>!row.deleted).map(({id,kind,data})=>({id,kind,data}))},null,2)],{type:'application/json'});
 const url = URL.createObjectURL(blob);
 const link = Object.assign(document.createElement('a'),{href:url,download:'groceries-backup.json'});
 link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function restoreBackup(event) {
 const file = event.target.files[0];
 if (!file) return;
 try {
  if (file.size>10_000_000) throw Error('O backup excede 10 MB.');
  const backup = JSON.parse(await file.text());
  const text = value => typeof value==='string' && value.length>0;
  const amount = value => Number.isFinite(value) && value>=0;
  const item = value => value && text(value.name) && amount(value.quantity) && value.quantity>0;
  const valid = ({id,kind,data}) => typeof id==='string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) && ({
   item: () => item(data) && amount(data.bought) && data.bought<=data.quantity,
   product: () => text(data?.name),
   purchase: () => text(data?.market) && /^\d{4}-\d{2}-\d{2}$/.test(data?.date) && amount(data.total) && Array.isArray(data.lines) && data.lines.every(item),
   alias: () => text(data?.key) && text(data?.name),
   settings: () => data?.key==='sectors' && Array.isArray(data.values) && data.values.every(text)
  })[kind]?.();
  if (backup.schema!==1 || !Array.isArray(backup.records) || !backup.records.every(valid)) throw Error('Backup inválido.');
  confirmDialog('Restaurar backup?', 'Os registros serão adicionados à lista atual.', ()=>{
   for (const {id,kind,data} of backup.records) {
    if (state.records[id]) continue;
    if (['product','item'].includes(kind) && records(kind).some(row=>normalize(row.name)===normalize(data.name))) continue;
    if (kind==='purchase' && data.fingerprint && records(kind).some(row=>row.fingerprint===data.fingerprint)) continue;
    if (kind==='settings' && records(kind).some(row=>row.key===data.key)) continue;
    put(kind,{...data,id});
   }
   toast('Backup restaurado.');
  });
 } catch (error) { toast(error.message); }
}
function conflictDialog() {
 showModal('Revisar alterações pendentes', state.conflicts.map((entry,index)=>'<div class="summary-row"><span>'+esc(entry.message)+' · '+entry.edits.length+' registro(s)</span><button class="secondary" data-discard="'+index+'">Descartar alteração</button><button class="primary" data-retry="'+index+'">Reaplicar lote</button></div>').join(''));
 for(const button of document.querySelectorAll('[data-discard],[data-retry]')){
  button.onclick=()=>{resolveConflict(Number(button.dataset.discard??button.dataset.retry),button.hasAttribute('data-retry'));closeModal();};
 }
}
async function reviewImportedReceipt(receipt){
 $('#receipt-status').textContent='Identificando os produtos…';
 const lines=await suggestReceiptNames(receipt.lines,records('product'),records('alias'),records('purchase').reverse());
 receiptDialog({...receipt,lines});
}
function receiptDialog(draft={lines:[],market:'',date:today()}) {
 const aliases=records('alias'),history=records('purchase').reverse();
 const marketSource=draft.market?.trim()||'';
 const displayMarket=marketName(marketSource,aliases,history);
 showModal('Revisar cupom', `<div class="form-row"><label>Foto para OCR<input type="file" id="ocr" accept="image/*" capture="environment"></label><label>Imagem com QR Code<input type="file" id="qr" accept="image/*"></label><label>XML fiscal ou página HTML salva<input type="file" id="xml" multiple accept=".xml,.html,.htm,application/xml,text/xml,text/html"></label></div><p id="receipt-status" role="status"></p><form id="receipt-form"><div class="form-row"><label>Mercado<input name="market" value="${esc(displayMarket)}" required></label><label>Data<input name="date" type="date" value="${esc(draft.date||today())}" required></label></div><label>Total do cupom (R$)<input name="expected" type="number" min="0" step=".01" value="${esc(draft.expected)}"></label><label>Desconto geral do cupom (R$)<input name="receiptDiscount" type="number" min="0" step=".01" value="${esc(draft.discount??0)}"></label><datalist id="receipt-products">${records('product').map(p=>`<option value="${esc(p.name)}"></option>`).join('')}</datalist><div id="receipt-lines"></div><button class="secondary" id="add-line" type="button">Adicionar linha</button><output id="receipt-total"></output><button class="primary">Salvar compra revisada</button></form>`,true);
 const form = $('#receipt-form');
 function lines() {
  return [...form.querySelectorAll('fieldset')].map(row=>{
   const value = key=>row.querySelector(`[data-field="${key}"]`).value;
   const quantity=number(value('quantity')), price=number(value('price')), discount=number(value('discount'));
   return {name:value('name').trim(),quantity,unit:value('unit'),price,discount,size:number(value('size'))||undefined,packUnit:value('packUnit'),total:Math.round((quantity*price-discount)*100)/100,sourceName:row.dataset.source,originalPrice:price===Number(row.dataset.importPrice)&&row.dataset.originalPrice!==undefined?Number(row.dataset.originalPrice):price};
  });
 }
 function totals() {
  const total=lines().reduce((sum,line)=>sum+line.total,0)-number(form.elements.receiptDiscount.value), expected=form.elements.expected.value;
  $('#receipt-total').textContent=`Soma das linhas: ${money(total)}${expected!=='' && Math.abs(number(expected)-total)>=.01 ? ' · Divergência de '+money(Math.abs(number(expected)-total)) : ''}`;
 }
 function add(line={}) {
  const row=document.createElement('fieldset');
  row.dataset.source=line.sourceName||line.name||'';
  if(line.originalPrice!=null){row.dataset.originalPrice=line.originalPrice;row.dataset.importPrice=line.price;}
  row.innerHTML=`<label>Produto<input data-field="name" list="receipt-products" value="${esc(line.name)}" required maxlength="120">${line.sourceName?`<small class="receipt-source">No cupom: ${esc(line.sourceName)}</small>`:''}</label><div class="form-row"><label>Quantidade<input data-field="quantity" type="number" min=".001" step=".001" value="${line.quantity??1}" required></label><label>Unidade<select data-field="unit">${units(line.unit)}</select></label><label>Preço unitário<input data-field="price" type="number" min="0" step="any" value="${line.price??''}" required></label><label>Desconto<input data-field="discount" type="number" min="0" step=".01" value="${line.discount??0}" required></label></div><div class="form-row receipt-package"><label>Tamanho da embalagem<input data-field="size" type="number" min=".001" step="any" placeholder="Ex.: 100" value="${esc(line.size)}"></label><label>Unidade da embalagem<select data-field="packUnit">${units(line.packUnit||'un')}</select></label></div><button class="danger-text" type="button">Remover linha</button>`;
  row.querySelector('button').onclick=()=>{row.remove();totals();};
  $('#receipt-lines').append(row);
  totals();
 }
 for(const line of draft.lines) {
  add(line);
 }
 form.oninput=totals;
 $('#add-line').onclick=()=>add();
 totals();
 for(const [id,read] of [['ocr',file=>readImage(file,n=>{$('#receipt-status').textContent=`Lendo imagem: ${n}%`;})],['xml',readReceiptFiles],['qr',readQR]]) {
  $('#'+id).onchange=async event=>{
   const file=event.target.files[0];
   if(!file)return;
   modalBusy=true;
   try {
    $('#receipt-status').textContent='Lendo arquivo…';
    const result=await read(id==='xml'?event.target.files:file);
    if(typeof result==='string'){
     try { await reviewImportedReceipt(await importFiscalURL(result)); return; } catch {}
     const link=Object.assign(document.createElement('a'),{href:result,target:'_blank',rel:'noopener noreferrer',textContent:'Abrir portal fiscal'});
     $('#receipt-status').replaceChildren('QR reconhecido. O portal bloqueou a consulta direta ou usa formato incompatível. Abra a nota e importe o XML ou o HTML salvo. Você também pode usar a foto. ',link);
    }else await reviewImportedReceipt(result);
   } catch(error){$('#receipt-status').textContent=error.message;}
   finally{modalBusy=false;}
  };
 }
 form.onsubmit=event=>{
  event.preventDefault();
  const entries=lines(),market=form.elements.market.value.trim(),date=form.elements.date.value;
  const status=$('#receipt-status');
  if(!market||!entries.length||entries.some(line=>!line.name||line.total<0)){status.textContent='Confira o mercado, os produtos e os descontos.';return;}
  const fingerprint=receiptFingerprint(entries.map(line=>({...line,name:line.sourceName||line.name,price:line.total})),marketSource||market,date)+(number(form.elements.receiptDiscount.value)?'|desconto:'+form.elements.receiptDiscount.value:'');
  if(records('purchase').some(row=>row.fingerprint===fingerprint || (draft.key&&row.receiptKey===draft.key))){status.textContent='Este cupom já aparece no histórico.';return;}
  const receiptDiscount=number(form.elements.receiptDiscount.value);
  const subtotal=entries.reduce((sum,line)=>sum+line.total,0);
  if(receiptDiscount<0||receiptDiscount>subtotal){status.textContent='O desconto geral não pode exceder a soma dos itens.';return;}
  const expected=form.elements.expected.value;
  if(expected!==''&&Math.abs(number(expected)-(subtotal-receiptDiscount))>=.01&&!window.confirm('A soma diverge do total do cupom. Salvar assim mesmo?'))return;
  batch(()=>{
  if(marketSource&&market!==displayMarket)rememberName(marketAliasKey(marketSource),market);
  let allocated=0,grossThroughLine=0;
  const discountCents=Math.round(receiptDiscount*100),subtotalCents=Math.round(subtotal*100);
  for(const line of entries){
   grossThroughLine+=Math.round(line.total*100);
   const next=subtotalCents?Math.round(discountCents*grossThroughLine/subtotalCents):0;
   const discount=(next-allocated)/100;
   line.allocatedDiscount=discount;
   line.discount=Math.round((line.discount+discount)*100)/100;
   line.total=Math.round((line.total-discount)*100)/100;
   allocated=next;
  }
  const pending=records('item');
  for(const line of entries){
   const product=records('product').find(row=>normalize(row.name)===normalize(line.name))||records('product').find(row=>normalize(row.name)===normalize(line.sourceName));
   const item=pending.find(row=>row.unit===line.unit&&(normalize(row.name)===normalize(line.name)||normalize(row.name)===normalize(line.sourceName)));
   const sector=product?.sector||item?.sector||suggestSector(line.name,sectors());
   line.productId=put('product',{...product,name:line.name,unit:line.unit,sector,...(line.size?{size:line.size,packUnit:line.packUnit}:{}),lastPrice:line.total/line.quantity});
   line.sector=sector;
   line.price=line.total/line.quantity;
   if(item)item.receiptQuantity=(item.receiptQuantity||0)+line.quantity;
   if(line.sourceName&&line.name!==line.sourceName)rememberName(normalize(line.sourceName),line.name);
  }
  put('purchase',{market,marketSource:marketSource||market,date,createdAt:Date.now(),lines:entries,total:Math.round(entries.reduce((sum,line)=>sum+line.total,0)*100)/100,fingerprint,receiptKey:draft.key});
  for(const item of pending.filter(row=>row.receiptQuantity)){
   const {receiptQuantity,...data}=item;
   const balance=Math.round((data.quantity-receiptQuantity)*1000)/1000;
   if(balance>0)put('item',{...data,quantity:balance,bought:Math.max(0,Math.round((data.bought-receiptQuantity)*1000)/1000)});
   else remove(data.id);
  }
  });
  closeModal();
  toast('Cupom salvo no histórico.');
 };
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modalBusy)closeModal();});
onChange(app);
app();
const incomingInvite=pendingInvitation();
const recoveryReturn=new URLSearchParams(location.search).has('recuperar');
let recoveryOpened=false;
void initialize((event,next)=>{
 if(event==='PASSWORD_RECOVERY'&&next){recoveryOpened=true;passwordDialog(true);}
 if(event==='SIGNED_IN'&&next&&pendingInvitation()&&!recoveryReturn&&!recoveryOpened)void houseDialog();
}).then(()=>{
 if(incomingInvite&&!recoveryOpened&&!recoveryReturn)void houseDialog();
 if(recoveryReturn&&!recoveryOpened&&location.hash.includes('error=')){
  cleanRecoveryURL();
  accountDialog('reset','O link expirou ou já foi usado. Solicite outro.');
 }
}).catch(error=>toast(error.message));

if(import.meta.env.PROD&&'serviceWorker' in navigator){
 window.addEventListener('load',()=>{void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js').catch(error=>console.error('Falha ao ativar modo offline',error));});
}
