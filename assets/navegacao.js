// F-3905 Concept V3.3: navegação por botões, sem efeito âncora.
(()=>{'use strict';
const $=id=>document.getElementById(id);
const normalize=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const main=document.querySelector('main');
const linkNodes=[...document.querySelectorAll('#navlinks [data-topic]')];
const topics=linkNodes.map((link,i)=>({
  id:link.dataset.topic,
  short:link.textContent.trim(),
  name:document.querySelector('#'+link.dataset.topic+' h2')?.textContent.trim()||link.textContent.trim(),
  n:i+1
}));
const ids=new Set(topics.map(t=>t.id));
const sections=[...document.querySelectorAll('main > section.chapter')];
const dialog=$('reader-index-dialog');
let active='inicio', continuous=false;
function group(n){return n<=3?'Conhecer a malha':n<=7?'Estratégias de controle':n<=9?'Simulações':'Diagnóstico e aprendizado'}
const entries=[{id:'inicio',n:0,name:'Apresentação, objetivos e indicadores',short:'Visão geral'},...topics];
function ensureSidebar(){
  if($('reader-sidebar-dock')) return;
  const dock=document.createElement('aside'); dock.id='reader-sidebar-dock'; dock.className='reader-sidebar-dock';
  dock.innerHTML=`<div class="reader-sidebar-card"><div class="reader-sidebar-head"><div class="reader-eyebrow">PAINEL TÉCNICO</div><h2>Assuntos do Concept</h2><p>Acesse qualquer capítulo sem rolagem longa. O conteúdo permanece integral.</p></div><label class="reader-search-label" for="reader-sidebar-search">Buscar assunto</label><input id="reader-sidebar-search" class="reader-search" type="search" placeholder="Ex.: LIC-151C, MIN, dinâmica, CIC"><div id="reader-sidebar-list" class="reader-topic-list reader-topic-list--sidebar"></div><div id="reader-sidebar-empty" class="reader-empty" hidden>Nenhum assunto encontrado.</div></div>`;
  main.insertBefore(dock, sections[0]||$('reader-pager'));
  $('reader-sidebar-search').addEventListener('input',renderLists);
}
function renderList(containerId, filter, emptyId){
  const container=$(containerId); if(!container) return; container.replaceChildren(); let last='', shown=0;
  entries.forEach(t=>{
    const text=normalize([t.short,t.name,t.id,t.n||''].join(' ')); if(filter && !text.includes(filter)) return;
    const g=t.n===0?'Início':group(t.n); if(g!==last){const lbl=document.createElement('div'); lbl.className='reader-list-group'; lbl.textContent=g; container.append(lbl); last=g;}
    const b=document.createElement('button'); b.type='button'; b.className='reader-topic-item'; b.dataset.topic=t.id; if(t.id===active) b.setAttribute('aria-current','page');
    const num=document.createElement('span'); num.className='reader-topic-num'; num.textContent=t.n?String(t.n).padStart(2,'0'):'⌂';
    const copy=document.createElement('span'); copy.className='reader-topic-copy'; const title=document.createElement('strong'); title.textContent=t.short; const detail=document.createElement('small'); detail.textContent=t.n?t.name:'Apresentação, objetivos e indicadores'; copy.append(title,detail);
    const ch=document.createElement('span'); ch.textContent='›'; ch.setAttribute('aria-hidden','true'); b.append(num,copy,ch);
    b.addEventListener('click',()=>{if(dialog?.open) dialog.close(); select(t.id,{push:true,focus:true});}); container.append(b); shown++;});
  if($(emptyId)) $(emptyId).hidden=shown!==0;
}
function renderLists(){ renderList('reader-topic-list', normalize($('reader-search')?.value || ''), 'reader-search-empty'); renderList('reader-sidebar-list', normalize($('reader-sidebar-search')?.value || ''), 'reader-sidebar-empty'); }
function title(id){return id==='inicio'?'Visão geral':topics.find(t=>t.id===id)?.short||'Visão geral'}
function index(id){return topics.findIndex(t=>t.id===id)}
function syncMode(){ document.documentElement.classList.toggle('reader-topic',!continuous); document.documentElement.classList.toggle('reader-continuous',continuous); $('reader-topic-mode').setAttribute('aria-pressed',String(!continuous)); $('reader-full-mode').setAttribute('aria-pressed',String(continuous)); $('reader-mode-toggle').setAttribute('aria-pressed',String(continuous)); $('reader-mode-toggle').textContent=continuous?'▤ Por assuntos':'☷ Leitura contínua'; $('reader-pager').hidden=continuous||active==='inicio'; }
function goTopForTopic(id){ if(continuous && id!=='inicio'){ const el=$(id), topbar=document.querySelector('.topbar'); const y=el.getBoundingClientRect().top+window.scrollY-(topbar?topbar.offsetHeight:0)-8; window.scrollTo({top:Math.max(0,y),behavior:'auto'});} else { window.scrollTo({top:0,behavior:'auto'});} }
function select(id,options={}){ if(id!=='inicio'&&!ids.has(id)) id='inicio'; active=id; sections.forEach(s=>s.classList.toggle('reader-active',s.id===active)); linkNodes.forEach(a=>{ const isCurrent=a.dataset.topic===active; a.classList.toggle('current',isCurrent); if(isCurrent) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  const navCurrent=linkNodes.find(a=>a.dataset.topic===active), strip=document.querySelector('.reader-navscroll'); if(navCurrent && strip && strip.offsetWidth){const r=navCurrent.getBoundingClientRect(), p=strip.getBoundingClientRect(); if(r.right>p.right-10) strip.scrollLeft+=r.right-p.right+22; else if(r.left<p.left+10) strip.scrollLeft-=p.left-r.left+22;}
  const n=index(active), number=n<0?0:n+1; $('reader-selected-title').textContent=title(active); $('reader-position').textContent=String(number).padStart(2,'0')+'/'+topics.length; $('reader-bottom-position').textContent=number+' de '+topics.length; $('reader-prev').disabled=number<=0; $('reader-next').disabled=number>=topics.length; $('reader-bottom-prev').disabled=number<=1; $('reader-bottom-next').disabled=number>=topics.length; $('reader-pager').hidden=continuous||active==='inicio'; renderLists();
  if(options.push){ const url=new URL(location.href); url.hash=active==='inicio'?'inicio':active; history.pushState({topic:active},'',url); }
  requestAnimationFrame(()=>{ goTopForTopic(id); if(active==='dinamica') window.dispatchEvent(new Event('resize')); if(options.focus){ const h=active==='inicio'?document.querySelector('h1'):$(active)?.querySelector('h2'); if(h){ h.setAttribute('tabindex','-1'); h.focus({preventScroll:true}); } } }); }
function setMode(continuousMode){ continuous=continuousMode; syncMode(); select(active); try{sessionStorage.setItem('f3905-reading-mode',continuous?'continuous':'topic')}catch(e){} }
function shift(delta){ let n=index(active); n=Math.max(-1,Math.min(topics.length-1,n+delta)); select(n<0?'inicio':topics[n].id,{push:true,focus:true}); }
ensureSidebar();
$('reader-open-index').addEventListener('click',()=>{ $('reader-search').value=''; renderLists(); dialog.showModal(); $('reader-search').focus(); });
$('reader-close-index').addEventListener('click',()=>dialog.close()); dialog.addEventListener('click',ev=>{ if(ev.target===dialog) dialog.close(); });
$('reader-search').addEventListener('input',renderLists); $('reader-topic-mode').addEventListener('click',()=>setMode(false)); $('reader-full-mode').addEventListener('click',()=>setMode(true)); $('reader-mode-toggle').addEventListener('click',()=>setMode(!continuous)); $('reader-prev').addEventListener('click',()=>shift(-1)); $('reader-next').addEventListener('click',()=>shift(1)); $('reader-bottom-prev').addEventListener('click',()=>shift(-1)); $('reader-bottom-next').addEventListener('click',()=>shift(1));
document.querySelectorAll('[data-topic]').forEach(el=>{ el.addEventListener('click',ev=>{ ev.preventDefault(); select(el.dataset.topic,{push:true,focus:true}); }); });
window.addEventListener('popstate',()=>select(decodeURIComponent(location.hash.slice(1))||'inicio'));
try{continuous=sessionStorage.getItem('f3905-reading-mode')==='continuous'}catch(e){}
syncMode(); renderLists(); select(decodeURIComponent(location.hash.slice(1))||'inicio');
})();
