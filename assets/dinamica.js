// F-3905 Concept v3.0 — laboratório temporal, sinais, falhas, eventos e estabilidade sustentada
(()=>{'use strict';
const $=id=>document.getElementById(id), cap=[17,15,13,15], names=['GOP 32','RV 32','GOP 09','RV 09'],tags=['250','251','252','253'];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),fmt=(v,n=1)=>Number(v).toFixed(n).replace('.',','),lerp=(x,y,k)=>x+(y-x)*k;
let running=true,scenario='baseline',view='level',data=[],v,events=[],lastAssessment='';
const baseline={level:65,pressure:100,out:48,sps:[8,8,8,8],coldAuto:true,highAuto:true,stuck:false,ltBiasA:0,ltBiasB:0,ftBias:0,lsSelect:'A'};
const cases={baseline:{...baseline},withdrawal:{...baseline,level:67,out:28},pressure:{...baseline,pressure:130},load:{...baseline,level:71,sps:[12,12,11,12]},high:{...baseline,level:94,out:36},stuck:{...baseline,level:73,out:35,stuck:true},levelBias:{...baseline,level:76,out:42,ltBiasA:-16},flowBias:{...baseline,level:67,out:48,ftBias:-5}};
const missions={baseline:'Observe o LIC-151A manter o inventário em torno de 65%. Aplique uma perturbação e acompanhe o retorno à estabilidade.',withdrawal:'A retirada caiu. Observe a redução da carga fria; se o nível continuar subindo, acompanhe o override e restabeleça um balanço de massa adequado.',pressure:'A pressão de alimentação aumentou. Verifique se o FIC-151 e os quatro FICs recuperam suas vazões de referência.',load:'Os quatro SPs das correntes aumentaram. Avalie o limite de atuação da cascata de carga fria e procure estabilizar o nível.',high:'Com nível inicial de 94%, observe quais FY passam a limitar as cargas; recupere o balanço sem grandes oscilações.',stuck:'A FV-252 está travada. Compare comando do FY-252 com posição efetiva e fluxo FT-252; avalie o que a malha ainda consegue corrigir.',levelBias:'O LT-151A apresenta leitura 16 pontos percentuais abaixo do nível real. Compare LT-A/LT-B e veja como o sinal escolhido pelo LS modifica as duas respostas de nível.',flowBias:'O FT-151 indicado está 5 u.r./min abaixo do fluxo efetivo. Investigue o aumento de comando da FV-151 e o balanço de massa; compare indicação e vazão física simulada.'};
function makeState(cfg){const hFactor=Math.sqrt(cfg.pressure/100);const fOut=cfg.sps.map((q,i)=>clamp(q/cap[i]/hFactor*100,0,100));const cold=clamp(16/32/hFactor*100,0,100);return {level:cfg.level,pressure:cfg.pressure,out:cfg.out,sps:[...cfg.sps],coldAuto:cfg.coldAuto,highAuto:cfg.highAuto,stuck:cfg.stuck,ltBiasA:cfg.ltBiasA,ltBiasB:cfg.ltBiasB,ftBias:cfg.ftBias,lsSelect:cfg.lsSelect,stableTime:0,completed:false,wasRestricted:false,wasHigh:false,wasDivergent:false,coldSP:16,coldMan:16,lyMan:100,ly:100,levelI:0,highI:0,ficOut:fOut.slice(),prevFicError:[0,0,0,0],pos:fOut.slice(),fy:fOut.slice(),q:cfg.sps.slice(),coldFicOut:cold,coldPos:cold,coldQ:16,coldErrPrev:0,cpv:Math.max(...fOut),levelRate:0,balance:0,t:0, restricted:0};}
function getInput(id){return +$(id).value;}
function ltA(){return clamp(v.level+v.ltBiasA,0,100);}
function ltB(){return clamp(v.level+v.ltBiasB,0,100);}
function selectedLevel(){return v.lsSelect==='B'?ltB():ltA();}
function ftIndicated(){return Math.max(0,v.coldQ+v.ftBias);}
function isStable(){return v.level>=62&&v.level<=68&&Math.abs(v.levelRate)<=.4&&Math.abs(v.balance)<=1.7&&Math.abs(ltA()-ltB())<5;}
function logEvent(msg,urgent=false){events.unshift({time:v?v.t:0,msg,urgent});events=events.slice(0,25);drawEvents();}
function drawEvents(){const e=$('dyn-log');if(e)e.innerHTML=events.length?events.slice(0,12).map(x=>'<li class="'+(x.urgent?'urgent':'')+'"><small>t='+fmt(x.time)+' min</small>'+x.msg+'</li>').join(''):'<li>Sem eventos registrados.</li>';}
function syncInputs(){ $('dyn-out').value=v.out;$('dyn-pressure').value=v.pressure;$('dyn-initial').value=v.level;$('dyn-cold-auto').checked=v.coldAuto;$('dyn-override-auto').checked=v.highAuto;$('dyn-stuck').checked=v.stuck;$('dyn-ls-select').value=v.lsSelect;$('dyn-bias-a').value=v.ltBiasA;$('dyn-bias-b').value=v.ltBiasB;$('dyn-ft-bias').value=v.ftBias;$('dyn-cold-man').value=v.coldMan;$('dyn-ly-man').value=v.lyMan;tags.forEach((id,i)=>$('dyn-sp-'+id).value=v.sps[i]);syncLabels();}
function syncLabels(){ $('dyn-out-num').textContent=fmt(v.out)+' u.r./min';$('dyn-pressure-num').textContent=fmt(v.pressure,0)+'%';$('dyn-initial-num').textContent=$('dyn-initial').value+'%';$('dyn-cold-man-num').textContent=fmt(v.coldMan);$('dyn-ly-man-num').textContent=fmt(v.lyMan,0)+'%';$('dyn-bias-a-num').textContent=fmt(v.ltBiasA,0)+' pp';$('dyn-bias-b-num').textContent=fmt(v.ltBiasB,0)+' pp';$('dyn-ft-bias-num').textContent=fmt(v.ftBias)+' u.r./min';tags.forEach((id,i)=>$('dyn-sp-'+id+'-num').textContent=fmt(v.sps[i])+' u.r./min');$('dyn-cold-man').disabled=v.coldAuto;$('dyn-ly-man').disabled=v.highAuto;}
function flowRate(c,pos,press){return c*pos/100*Math.sqrt(Math.max(0,press)/100);}
function tick(dt){const old=v.level;
 // Cascade LIC-151A: level PID output -> cold FIC flow SP; conditional integral on saturation
 const e=65-selectedLevel();
 if(v.coldAuto){let candidate=16+1.15*e+0.075*v.levelI;
   if((candidate>0&&candidate<32)||(candidate<=0&&e>0)||(candidate>=32&&e<0))v.levelI=clamp(v.levelI+e*dt,-180,180);
   v.coldSP=clamp(16+1.15*e+0.075*v.levelI,0,32);
 }else v.coldSP=v.coldMan;
 // FIC-151 secondary, cold-valve first order + source pressure effect
 const ce=v.coldSP-ftIndicated();
 v.coldFicOut=clamp(v.coldFicOut+6*(ce-v.coldErrPrev)+4.5*ce*dt,0,100);v.coldErrPrev=ce;
 v.coldPos=lerp(v.coldPos,v.coldFicOut,clamp(dt/0.65,0,1));v.coldQ=flowRate(32,v.coldPos,v.pressure);
 // Four normal flow controllers generate MV. Level override selects minimum.
 for(let i=0;i<4;i++){
   const err=v.sps[i]-v.q[i];const suppressed=v.ficOut[i]>v.ly+.01;
   const delta=6*(err-v.prevFicError[i])+3.6*err*dt*(suppressed&&err>0?0:1);
   v.ficOut[i]=clamp(v.ficOut[i]+delta,0,100);
   // back-calculation prevents integral windup in constrained branch, but permits observable FIC/FY difference
   if(suppressed&&err>0)v.ficOut[i]=Math.max(v.ly,lerp(v.ficOut[i],v.ly+7,clamp(dt*0.22,0,1)));
   v.prevFicError[i]=err;
 }
 const maxRequest=Math.max(...v.ficOut);
 // LY high-limit: tracks the greatest normal request outside high-level band;
 // progressive level correction above 88%. Tunings illustrative, not DCS values.
 if(v.highAuto){
    if(selectedLevel()>88)v.highI=clamp(v.highI+Math.max(0,selectedLevel()-90)*dt*.50,0,36);
    else v.highI=Math.max(0,v.highI-2*dt);
    const target=clamp(maxRequest+7-7.2*Math.max(0,selectedLevel()-88)-v.highI,0,100);
    v.ly=lerp(v.ly,target,clamp(dt/0.7,0,1));
 }else v.ly=v.lyMan;
 v.restricted=0;
 for(let i=0;i<4;i++){
   v.fy[i]=Math.min(v.ficOut[i],v.ly);
   if(v.ficOut[i]>v.ly+.25)v.restricted++;
   if(!(i===2&&v.stuck))v.pos[i]=lerp(v.pos[i],v.fy[i],clamp(dt/0.8,0,1));
   v.q[i]=flowRate(cap[i],v.pos[i],v.pressure);
 }
 v.cpv=Math.max(...v.fy);
 const inSum=v.coldQ+v.q.reduce((a,b)=>a+b,0);
 v.balance=inSum-v.out;
 // 200 normalized volume units represent 100%: slow inventory dynamics
 v.level=clamp(v.level+v.balance/2.25*dt,0,100);
 if(v.level===0||v.level===100)v.levelI=0;
 v.levelRate=(v.level-old)/dt;
 v.t+=dt;
 if(isStable())v.stableTime=Math.min(3,v.stableTime+dt);else v.stableTime=0;
 if(v.stableTime>=3&&!v.completed){v.completed=true;logEvent('Estabilidade sustentada por 3 minutos simulados com medição coerente.');}
 const high=v.level>=90; if(high&&!v.wasHigh)logEvent('Nível real ultrapassou 90% no modelo; observar override e balanço.',true);v.wasHigh=high;
 const restricted=v.restricted>0;if(restricted!==v.wasRestricted){logEvent(restricted?'Um ou mais seletores MIN passaram a restringir vazões.':'Override liberado: seletores MIN devolveram autoridade aos FICs.');v.wasRestricted=restricted;}
 const divergent=Math.abs(ltA()-ltB())>=5;if(divergent&&!v.wasDivergent)logEvent('Divergência LT-151A × LT-151B ≥ 5 pp: confrontar a seleção LS.',true);v.wasDivergent=divergent;
}
function record(){data.push({t:v.t,level:v.level,sp:65,high:90,inside:v.coldQ+v.q.reduce((a,b)=>a+b,0),lta:ltA(),ltb:ltB(),physical:v.level,fy252:v.fy[2],pos252:v.pos[2],out:v.out,ly:v.ly,cpv:v.cpv,fic:Math.max(...v.ficOut),cold:v.coldQ});if(data.length>900)data.shift();}
let lastFrame=0,accum=0;
function loop(now){if(lastFrame){const elapsed=Math.min((now-lastFrame)/1000,.13);if(running){accum+=elapsed*Number($('dyn-speed').value);while(accum>=.15){tick(.15);record();accum-=.15;}render();}}lastFrame=now;requestAnimationFrame(loop);}
function reset(which){scenario=which||scenario;v=makeState(cases[scenario]);data=[];events=[];lastAssessment='';record();syncInputs();logEvent('Iniciado: '+scenario.toUpperCase()+' • '+missions[scenario]);$('dyn-mission').textContent=missions[scenario];document.querySelectorAll('[data-dyn-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dynScenario===scenario)));accum=0;render();}
function flowPipe(el,q){const e=$(el);e.style.opacity=String(clamp(q/12,.13,1));e.style.strokeWidth=String(clamp(3+q*.42,3,11));e.style.animationDuration=clamp(3/(.3+q/12),.3,5)+'s';}
function render(){const lv=v.level;const levelMeter=$('dyn-level-meter');levelMeter.classList.toggle('good',lv>=61&&lv<=72);levelMeter.classList.toggle('warn',lv>72&&lv<90 || lv<61);levelMeter.classList.toggle('danger',lv>=90);
 $('dyn-level').textContent=fmt(lv)+'%';$('dyn-cold-sp').textContent=fmt(v.coldSP);$('dyn-cold-ft').textContent=fmt(ftIndicated());$('dyn-ly').textContent=fmt(v.ly,0)+'%';$('dyn-cpv').textContent=fmt(v.cpv,0)+'%';$('dyn-trend').textContent=(v.levelRate>0?'+':'')+fmt(v.levelRate,2);$('dyn-time').textContent='t = '+fmt(v.t)+' min';$('dyn-trend-time').textContent='t = '+fmt(v.t)+' min';
 $('dyn-lta').textContent=fmt(ltA())+'%';$('dyn-ltb').textContent=fmt(ltB())+'%';$('dyn-ls').textContent=v.lsSelect+' • '+fmt(selectedLevel())+'%';
 const diff=Math.abs(ltA()-ltB());$('dyn-ltdiff').textContent=fmt(diff)+' pp';$('dyn-ltdiff').parentElement.classList.toggle('bad',diff>=5);
 $('dyn-ftind').textContent=fmt(ftIndicated());$('dyn-ftind').parentElement.classList.toggle('bad',Math.abs(v.ftBias)>=2);
 $('dyn-stable').textContent=fmt(v.stableTime)+' / 3,0 min';$('dyn-stable').parentElement.classList.toggle('bad',diff>=5);
 const progress=Math.min(100,100*v.stableTime/3);$('dyn-progress-fill').style.width=progress+'%';$('dyn-progress-label').textContent=fmt(progress,0)+'%';
 $('dyn-signal-lic').textContent='PV '+fmt(selectedLevel())+'% → SP '+fmt(v.coldSP);
 $('dyn-signal-fic').textContent='FT '+fmt(ftIndicated())+' → MV '+fmt(v.coldFicOut,0)+'%';
 $('dyn-signal-ly').textContent='LY '+fmt(v.ly,0)+'%';$('dyn-signal-lx').textContent=v.restricted+'/4 • CPV '+fmt(v.cpv,0)+'%';
 $('dyn-sumin').textContent=fmt(v.coldQ+v.q.reduce((a,b)=>a+b,0));$('dyn-sumout').textContent=fmt(v.out);$('dyn-balance').textContent=(v.balance>0?'+':'')+fmt(v.balance);
 const y=91+293*(1-lv/100),h=293*lv/100;$('dyn-water').setAttribute('y',y);$('dyn-water').setAttribute('height',h);$('dyn-water-top').setAttribute('d',`M620 ${y} Q656 ${y-3} 692 ${y} T764 ${y}`);$('dyn-tank-pv').textContent=fmt(lv)+'%';
 [v.coldQ,...v.q].forEach((q,i)=>{flowPipe('dyn-flow-'+i,q);$('dyn-flowtxt-'+i).textContent=fmt(q)+' u.r./min';});flowPipe('dyn-outflow-anim',v.out);$('dyn-outflow-txt').textContent=fmt(v.out)+' u.r./min';
 $('dyn-plant').classList.toggle('is-paused',!running);$('dyn-run-badge').classList.toggle('paused',!running);$('dyn-run-badge').textContent=running?'Simulação em execução':'Simulação pausada';$('dyn-play').textContent=running?'Ⅱ Pausar':'▶ Continuar';
 const row=['<tr><td><strong>Carga fria · 151</strong></td><td>'+fmt(v.coldSP)+'</td><td>'+fmt(v.coldQ)+'</td><td>'+fmt(v.coldFicOut,0)+'%</td><td>—</td><td>'+fmt(v.coldPos,0)+'%</td><td class="free">'+(v.coldAuto?'Cascata':'Manual')+'</td></tr>'];
 tags.forEach((id,i)=>{const restricted=v.ficOut[i]>v.ly+.25;row.push('<tr><td><strong>'+names[i]+' · '+id+'</strong></td><td>'+fmt(v.sps[i])+'</td><td>'+fmt(v.q[i])+'</td><td>'+fmt(v.ficOut[i],0)+'%</td><td>'+fmt(v.fy[i],0)+'%</td><td>'+fmt(v.pos[i],0)+'%</td><td class="'+(restricted?'restricted':'free')+'">'+(i===2&&v.stuck?'FV travada':restricted?'Override':'FIC')+'</td></tr>');});$('dyn-table-body').innerHTML=row.join('');
 $('dyn-cascade-text').innerHTML=`Medição selecionada <strong>${fmt(selectedLevel())}%</strong> (nível físico simulado ${fmt(lv)}%) frente a SP <strong>65%</strong>. O LIC-151A ${v.coldAuto?'solicita':'está em modo manual com'} SP <strong>${fmt(v.coldSP)} u.r./min</strong>; o FT-151 mede <strong>${fmt(ftIndicated())}</strong> (medido); a vazão física no modelo é <strong>${fmt(v.coldQ)}</strong>. ${v.coldAuto?(lv>67?'A redução de carga fria procura frear a elevação de nível.':lv<63?'O aumento de carga fria procura recuperar o inventário.':'A cascata ajusta a admissão para manter o balanço.'):'A atuação automática da cascata está desabilitada neste ensaio.'}`;
 $('dyn-override-text').innerHTML=`LIC-151C: SP <strong>90%</strong> • LY <strong>${fmt(v.ly,0)}%</strong>. Há <strong>${v.restricted}/4</strong> seletores MIN restringindo comandos. O LX-151C calcula <strong>CPV = MAX(${v.fy.map(x=>fmt(x,0)).join('; ')}) = ${fmt(v.cpv,0)}%</strong>. ${v.stuck?'A FV-252 está travada e pode divergir da saída FY-252.':''}`;
 const panel=$('dyn-feedback');panel.className='dyn-feedback';let msg;
 if(Math.abs(ltA()-ltB())>=5){panel.classList.add('warning');msg='<strong>Divergência instrumental LT-A/LT-B.</strong> A malha age sobre a medição selecionada, que pode não representar o inventário real do vaso.';}
 else if(Math.abs(v.ftBias)>=2){panel.classList.add('warning');msg='<strong>Inconsistência no FT-151.</strong> O FIC ajusta a FV-151 pela vazão indicada, não pela vazão física simulada.';}
 else
 if(lv>=95){panel.classList.add('critical');msg='<strong>Nível extremamente alto no modelo.</strong> A soma das entradas continua determinante. Observe se a restrição de cargas e a retirada disponível conseguem reduzir o inventário.';}
 else if(lv>=90){panel.classList.add('warning');msg='<strong>Nível acima da referência extra-alta (90%).</strong> Compare os comandos dos FICs com os FY, a CPV calculada e a retirada do equipamento.';}
 else if(lv>75){panel.classList.add('warning');msg='<strong>Nível acima da faixa normal.</strong> O LIC-151A reduz a carga fria; avalie se sua autoridade é suficiente e acompanhe a evolução do LY-151C.';}
 else if(lv<55){panel.classList.add('warning');msg='<strong>Nível abaixo do alvo.</strong> Observe o LIC-151A aumentar a referência de vazão fria e verifique se o balanço de entradas supera a retirada.';}
 else if(Math.abs(v.levelRate)>.3){msg='<strong>Inventário em movimento.</strong> Tendência '+(v.levelRate>0?'crescente':'decrescente')+' de '+fmt(Math.abs(v.levelRate),2)+'%/min. Acompanhe os gráficos antes de concluir que houve estabilização.';}
 else {panel.classList.add('good');msg='<strong>Balanço próximo do equilíbrio.</strong> A diferença entre entradas e retirada está pequena; verifique a proximidade de 65% e a persistência da estabilidade.';}
 panel.innerHTML=msg;
 $('dyn-selector-cards').innerHTML=tags.map((id,i)=>{const r=v.ficOut[i]>v.ly+.25;return '<div class="dyn-selector '+(r?'restrict':'')+'"><strong>FY-'+id+' • '+names[i]+'</strong><p>FIC '+fmt(v.ficOut[i],0)+'% → MIN '+fmt(v.fy[i],0)+'% → FV '+fmt(v.pos[i],0)+'%</p><div class="dyn-track"><span style="width:'+clamp(v.fy[i],0,100)+'%"></span></div><p>'+(r?'Override atuando':'Autoridade do FIC')+'</p></div>';}).join('');
 drawChart();}
function plotSetup(){const canvas=$('dyn-chart'),rc=canvas.getBoundingClientRect(),w=Math.max(300,rc.width||700),h=Math.max(200,rc.height||265),ratio=Math.min(2,window.devicePixelRatio||1);if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);return {ctx,w,h};}
const palette={cyan:'#86e8fa',green:'#66e4b6',amber:'#ffc66f',red:'#ff9d96',blue:'#809eff',muted:'#c1d1e2'};
function drawChart(){const {ctx,w,h}=plotSetup(),pad={left:43,right:12,top:15,bottom:31},wid=w-pad.left-pad.right,hei=h-pad.top-pad.bottom;ctx.clearRect(0,0,w,h);
 const mode=view,lo=0,hi=mode==='flow'?85:100;
 const specs=mode==='level'?[['level','Nível LT',palette.cyan],['sp','SP 65%',palette.green],['high','SP 90%',palette.amber]]:mode==='flow'?[['inside','Σ entradas',palette.cyan],['out','Retirada',palette.amber],['cold','Carga fria',palette.green]]:mode==='act'?[['ly','Limite LY',palette.amber],['fic','Maior saída FIC',palette.blue],['cpv','CPV MAX',palette.cyan]]:mode==='sensors'?[['physical','Nível físico',palette.green],['lta','LT-151A',palette.cyan],['ltb','LT-151B',palette.amber]]:[['fy252','FY-252 (comando)',palette.cyan],['pos252','FV-252 (posição)',palette.amber]];
 const end=v.t,start=Math.max(0,end-40),x=(t)=>pad.left+(t-start)/Math.max(40,end-start)*wid,y=(val)=>pad.top+(1-(val-lo)/(hi-lo))*hei;
 ctx.lineWidth=1;ctx.font='11px system-ui';ctx.textAlign='right';for(let k=0;k<=4;k++){const v0=lo+(hi-lo)*k/4,yp=y(v0);ctx.strokeStyle='#29445b';ctx.beginPath();ctx.moveTo(pad.left,yp);ctx.lineTo(w-pad.right,yp);ctx.stroke();ctx.fillStyle='#abc3d4';ctx.fillText(String(v0),pad.left-8,yp+4);}ctx.textAlign='center';for(let k=0;k<=4;k++){const t=start+40*k/4,xp=x(t);ctx.fillStyle='#abc3d4';ctx.fillText(fmt(t,0),xp,h-9);}
 const visible=data.filter(p=>p.t>=start);for(const [key,name,color] of specs){ctx.strokeStyle=color;ctx.lineWidth=key==='level'?2.6:2;ctx.setLineDash(key==='sp'||key==='high'?[7,5]:[]);ctx.beginPath();visible.forEach((p,i)=>{const px=x(p.t),py=y(p[key]);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);});ctx.stroke();ctx.setLineDash([]);}ctx.fillStyle='#97bfd1';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText(mode==='level'?'Nível (%)':mode==='flow'?'Vazão relativa':mode==='sensors'?'Nível e instrumentos (%)':'Comando (%)',pad.left+3,12);
 $('dyn-legend').innerHTML=specs.map(([,name,color])=>'<span style="--legend-color:'+color+'">'+name+'</span>').join('');}
function assess(){const ok=v.stableTime>=3;const txt=ok?'Critérios mantidos por ao menos 3 min simulados: nível real entre 62–68%, |balanço| ≤ 1,7, |tendência| ≤ 0,4%/min e LT-A/LT-B coerentes.':'A estabilidade exige 3 min contínuos dentro dos critérios. Confira LT-A/B, referência do LS, vazões, balanço e tendência, e não apenas o nível instantâneo.';$('dyn-feedback').className='dyn-feedback '+(ok?'good':'warning');$('dyn-feedback').innerHTML='<strong>'+(ok?'✓ Missão concluída.':'◌ Estabilidade ainda não sustentada.')+'</strong> '+txt;logEvent(ok?'Missão avaliada como estabilizada.':'Missão avaliada: estabilidade sustentada ainda não demonstrada.');}
for(const id of ['dyn-out','dyn-pressure','dyn-initial','dyn-cold-man','dyn-ly-man',...tags.map(i=>'dyn-sp-'+i),'dyn-bias-a','dyn-bias-b','dyn-ft-bias'])$(id).addEventListener('input',()=>{v.out=getInput('dyn-out');v.pressure=getInput('dyn-pressure');v.coldMan=getInput('dyn-cold-man');v.lyMan=getInput('dyn-ly-man');if(!v.highAuto){v.ly=v.lyMan;v.fy=v.ficOut.map(u=>Math.min(u,v.ly));v.cpv=Math.max(...v.fy);v.restricted=v.ficOut.filter(u=>u>v.ly+.25).length;}v.sps=tags.map(i=>getInput('dyn-sp-'+i));v.ltBiasA=getInput('dyn-bias-a');v.ltBiasB=getInput('dyn-bias-b');v.ftBias=getInput('dyn-ft-bias');syncLabels();render();});
$('dyn-cold-auto').addEventListener('change',e=>{v.coldAuto=e.target.checked;v.coldMan=v.coldSP;$('dyn-cold-man').value=v.coldMan;syncLabels();});
$('dyn-override-auto').addEventListener('change',e=>{v.highAuto=e.target.checked;v.lyMan=v.ly;$('dyn-ly-man').value=v.lyMan;syncLabels();});
$('dyn-stuck').addEventListener('change',e=>{v.stuck=e.target.checked;logEvent(v.stuck?'FV-252 travada na posição atual.':'FV-252 liberada; o comando pode voltar a atuar.',v.stuck);render();});
$('dyn-ls-select').addEventListener('change',e=>{v.lsSelect=e.target.value;logEvent('LS de demonstração selecionou LT-151'+v.lsSelect+'.');render();});
['dyn-out','dyn-pressure','dyn-bias-a','dyn-bias-b','dyn-ft-bias',...tags.map(i=>'dyn-sp-'+i)].forEach(id=>$(id).addEventListener('change',()=>{logEvent('Ajuste realizado: '+id.replace('dyn-','')+' = '+$(id).value+'.');}));
$('dyn-clear-log').addEventListener('click',()=>{events=[];drawEvents();});
$('dyn-report').addEventListener('click',async()=>{const lines=['F-3905 CONCEPT V3 — RELATÓRIO DIDÁTICO CIC','Cenário: '+scenario,'Tempo simulado: '+fmt(v.t)+' min','Nível físico: '+fmt(v.level)+'%','LT-151A: '+fmt(ltA())+'% / LT-151B: '+fmt(ltB())+'%','LS selecionado: LT-151'+v.lsSelect,'PV selecionada: '+fmt(selectedLevel())+'%','SP LIC-151A: 65% / SP LIC-151C: 90%','SP FIC-151: '+fmt(v.coldSP)+' / FT-151 indicado: '+fmt(ftIndicated())+' / vazão física: '+fmt(v.coldQ),'LY-151C: '+fmt(v.ly)+'% / CPV LX-151C: '+fmt(v.cpv)+'%','Válvulas restringidas: '+v.restricted+'/4','Entradas totais: '+fmt(v.coldQ+v.q.reduce((a,b)=>a+b,0))+' / saída: '+fmt(v.out)+' / balanço: '+fmt(v.balance),'Estabilidade sustentada: '+fmt(v.stableTime)+' de 3 min',...tags.map((id,i)=>id+' ('+names[i]+'): SP='+fmt(v.sps[i])+' PV='+fmt(v.q[i])+' FIC='+fmt(v.ficOut[i])+' FY='+fmt(v.fy[i])+' FV='+fmt(v.pos[i])),'Registro de ocorrências:',...events.map(x=>'t='+fmt(x.time)+' — '+x.msg),'Valores e sintonias demonstrativos; verificação de parâmetros reais no SDCD.'];try{await navigator.clipboard.writeText(lines.join('\n'));$('dyn-report-feedback').textContent='Diagnóstico copiado.';}catch(err){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));a.download='F3905-diagnostico-CIC.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800);$('dyn-report-feedback').textContent='Arquivo de diagnóstico salvo.';}});
$('dyn-set-level').addEventListener('click',()=>{v.level=+ $('dyn-initial').value;v.levelI=0;v.highI=0;record();render();});
$('dyn-play').addEventListener('click',()=>{running=!running;render();});
$('dyn-step').addEventListener('click',()=>{running=false;for(let n=0;n<10;n++){tick(.1);record();}render();});
$('dyn-reset').addEventListener('click',()=>reset());
$('dyn-assess').addEventListener('click',assess);
document.querySelectorAll('[data-dyn-scenario]').forEach(b=>b.addEventListener('click',()=>{running=true;reset(b.dataset.dynScenario);render();}));
document.querySelectorAll('[data-dyn-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.dynView;document.querySelectorAll('[data-dyn-view]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.dynView===view)));drawChart();}));
window.addEventListener('resize',drawChart,{passive:true});reset('baseline');requestAnimationFrame(loop);
})();
