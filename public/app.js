'use strict';
const MOVIES = [
  {id:'sheldon',title:'Детство Шелдона',english:'YOUNG SHELDON',type:'series',label:'СЕРИАЛ',year:'2017–2024',focus:'ПОВСЕДНЕВНАЯ РЕЧЬ',youtube:'9AVt5oyzMbw',by:'Warner Channel / трейлер',theme:'fallback-sheldon',short:'YOUNG SHELDON'},
  {id:'blonde',title:'Блондинка в законе',english:'LEGALLY BLONDE',type:'movie',label:'ФИЛЬМ',year:'2001',focus:'БЫСТРЫЕ ФРАЗЫ',youtube:'vWOHwI_FgAo',by:'MGM Studios / официальный трейлер',theme:'fallback-blonde',short:'LEGALLY BLONDE'},
  {id:'proposal',title:'Предложение',english:'THE PROPOSAL',type:'movie',label:'ФИЛЬМ',year:'2009',focus:'ЖИВЫЕ ДИАЛОГИ',youtube:'jHraHCjK094',by:'Movieclips / официальный трейлер',theme:'fallback-proposal',short:'THE PROPOSAL'},
  {id:'ted',title:'Тед Лассо',english:'TED LASSO',type:'series',label:'СЕРИАЛ',year:'2020–2026',focus:'BRITISH & AMERICAN ENGLISH',youtube:'GACU1N9hg5o',by:'Apple TV / официальный трейлер',theme:'fallback-ted',short:'TED LASSO'}
];
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const defaults = {audioLanguage:'en',quality:'auto',subtitles:'en',reducedMotion:false};
const model = {filter:'all',authMode:'login',me:null,settings:{...defaults},currentMovie:0,menuOpen:false};
const toast = (msg) => {const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3000)};
const safeText = (value) => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async (path,options={})=>{const response=await fetch('/api/'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});let data;try{data=await response.json()}catch{throw Error('Сервер недоступен. Запустите сайт через node server.js.')}if(!response.ok)throw Error(data.error||'Не удалось выполнить действие');return data};
function monitorImages(root=document){root.querySelectorAll('img[src*="img.youtube.com"]').forEach(img=>{if(img.dataset.monitored)return;img.dataset.monitored='1';const loaded=()=>img.classList.add('loaded');const failed=()=>img.remove();img.addEventListener('load',loaded,{once:true});img.addEventListener('error',failed,{once:true});if(img.complete){if(img.naturalWidth)loaded();else failed()}})}
const readLocalSettings=()=>{try{return JSON.parse(localStorage.getItem('kinoclub_settings')||'{}')}catch{return {}}};
const applySettings = () => {document.body.classList.toggle('no-motion',!!model.settings.reducedMotion);$('#audioSetting').value=model.settings.audioLanguage;$('#qualitySetting').value=model.settings.quality;$('#subtitleSetting').value=model.settings.subtitles;$('#motionSetting').checked=!!model.settings.reducedMotion;};
const renderAuth = () => {$('#loginTop').innerHTML=model.me ? `Мой профиль <span>↗</span>` : `Войти <span>↗</span>`;$('#accountMenuLabel').textContent=model.me?`Мой профиль (${model.me.email.split('@')[0]})`:'Вход / регистрация';$('#logoutButton').hidden=!model.me;};
const syncUser = async()=>{model.settings={...defaults,...readLocalSettings()};try{const result=await api('me');if(result.user){model.me=result.user;model.settings={...defaults,...result.user.settings}}}catch(err){console.info('Предпросмотр без сервера:',err.message)}applySettings();renderAuth()};
function renderCatalog(){const term=$('#catalogSearch').value.trim().toLocaleLowerCase('ru');const items=MOVIES.filter(m=>(model.filter==='all'||m.type===model.filter)&&(`${m.title} ${m.english} ${m.focus}`.toLowerCase().includes(term)));$('#catalogGrid').innerHTML=items.map(m=>`<article class="movie-card" role="button" tabindex="0" data-id="${m.id}" aria-label="Посмотреть трейлер ${safeText(m.title)}"><div class="movie-art"><div class="fallback-art ${m.theme}">${safeText(m.short)}</div><img loading="lazy" src="https://img.youtube.com/vi/${m.youtube}/hqdefault.jpg" alt="Превью трейлера ${safeText(m.title)}"/><span class="movie-chip">${m.label}</span><span class="movie-arrow">↗</span></div><div class="movie-meta"><span>${m.year}</span><span>${m.focus}</span></div><h3>${safeText(m.english)}</h3><span class="english-name">${safeText(m.title)}</span></article>`).join('');monitorImages($('#catalogGrid'));$('#noResults').hidden=items.length!==0;}
function openMenu(){model.menuOpen=true;$('#menuPanel').classList.add('open');$('#menuPanel').setAttribute('aria-hidden','false');$('#menuToggle').setAttribute('aria-expanded','true');$('#scrim').hidden=false;}
function closeMenu(){model.menuOpen=false;$('#menuPanel').classList.remove('open');$('#menuPanel').setAttribute('aria-hidden','true');$('#menuToggle').setAttribute('aria-expanded','false');$('#scrim').hidden=true;}
function openDialog(id){closeMenu();const el=$('#'+id+'Dialog');if(el && !el.open)el.showModal();}
function closeDialog(id){const el=$('#'+id+'Dialog');if(el?.open)el.close();if(id==='video')$('#videoFrame').replaceChildren();}
function setAuthMode(mode){model.authMode=mode;const isRegister=mode==='register';$('#tabLogin').classList.toggle('active',!isRegister);$('#tabRegister').classList.toggle('active',isRegister);$('#authHeading').innerHTML=isRegister?'ВАШ ПЕРВЫЙ КАДР<span>!</span>':'С ВОЗВРАЩЕНИЕМ<span>!</span>';$('#authSubmitLabel').textContent=isRegister?'Создать аккаунт':'Войти';$('#authForm [name=password]').autocomplete=isRegister?'new-password':'current-password';$('#authError').textContent='';}
function showAuth(){if(model.me){openDialog('settings')}else{setAuthMode('login');openDialog('auth')}}
function openMovie(id){const ix=MOVIES.findIndex(m=>m.id===id);if(ix<0)return;model.currentMovie=ix;const m=MOVIES[ix];$('#videoName').textContent=m.english;$('#videoEyebrow').textContent=m.title+' / '+m.by.toUpperCase();$('#youtubeLink').href='https://www.youtube.com/watch?v='+m.youtube;const frame=$('#videoFrame');frame.replaceChildren();const iframe=document.createElement('iframe');iframe.title='Трейлер: '+m.title;iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;iframe.src=`https://www.youtube-nocookie.com/embed/${m.youtube}?autoplay=1&rel=0&playsinline=1`;frame.append(iframe);openDialog('video');}
function closeIntro(){
  const intro=$('#intro');
  if(!intro || intro.classList.contains('is-finished'))return;
  intro.classList.add('is-finished');
  document.body.classList.remove('intro-active');
  // Удаляем заставку только после плавного перехода, чтобы не было вспышки.
  setTimeout(()=>intro.remove(),700);
}
function initIntro(){
  const intro=$('#intro');
  if(!intro)return;
  const fill=$('#introFill'),track=$('#introTrack'),logo=$('#introLogo');
  const started=performance.now();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.add('intro-active');
  let current=0;
  const update=(value)=>{
    if(!intro.isConnected)return;
    current=Math.max(current,Math.min(100,value));
    fill.style.transform=`scaleX(${current/100})`;
    track.setAttribute('aria-valuenow',String(Math.round(current)));
  };
  const limitWait=(promise,ms)=>Promise.race([
    Promise.resolve(promise).catch(()=>{}),
    new Promise(resolve=>setTimeout(resolve,ms))
  ]);
  update(16);
  const logoReady=logo?.decode?logo.decode():Promise.resolve();
  const fontsReady=document.fonts?.ready||Promise.resolve();
  let progressDone=false;
  const progressTimer=setInterval(()=>{
    if(progressDone || !intro.isConnected){clearInterval(progressTimer);return;}
    const elapsed=performance.now()-started;
    update(Math.min(94,Math.max(current,16+78*(elapsed/3500))));
  },90);
  const readyLogo=limitWait(logoReady,2000);
  const readyFonts=limitWait(fontsReady,1800);
  const readyLayout=new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  Promise.all([readyLogo,readyFonts,readyLayout]).then(()=>{
    const minimum=reduced?160:3500;
    const remaining=Math.max(0,minimum-(performance.now()-started));
    setTimeout(()=>{
      progressDone=true;clearInterval(progressTimer);update(100);
      setTimeout(closeIntro,reduced?0:360);
    },remaining);
  });
  // Даже при сетевой ошибке главная страница останется доступна.
  setTimeout(()=>{progressDone=true;clearInterval(progressTimer);update(100);closeIntro()},6500);
}

// A single continuous one-line marquee. Clones follow the *exact* width of the first run.
function initSeamlessTicker(){
  const track=$('#tickerTrack');
  const viewport=track?.closest('.marquee');
  if(!track||!viewport)return;
  const original=track.querySelector('.ticker-run');
  if(!original)return;
  const template=original.cloneNode(true);
  let lastWidth=0;
  function rebuild(){
    const viewportWidth=viewport.getBoundingClientRect().width;
    if(Math.abs(viewportWidth-lastWidth)<1 && track.children.length>1)return;
    lastWidth=viewportWidth;
    track.replaceChildren(template.cloneNode(true));
    track.style.animation='none';
    const unit=track.firstElementChild;
    const width=unit.getBoundingClientRect().width;
    if(!width)return;
    const repetitions=Math.max(2,Math.ceil(viewportWidth/width)+2);
    for(let i=1;i<repetitions;i++){
      const clone=template.cloneNode(true);
      clone.setAttribute('aria-hidden','true');
      track.append(clone);
    }
    track.style.setProperty('--ticker-distance',`${width}px`);
    track.style.setProperty('--ticker-time',`${Math.max(16,width/65).toFixed(1)}s`);
    void track.offsetWidth;
    track.style.animation='';
  }
  rebuild();
  document.fonts?.ready.then(()=>{lastWidth=0;rebuild()}).catch(()=>{});
  window.addEventListener('resize',()=>{lastWidth=0;rebuild()},{passive:true});
}

function onCardKey(e){const card=e.target.closest('[data-id]');if(card && (e.key==='Enter'||e.key===' ')){e.preventDefault();openMovie(card.dataset.id)}}
function onNavigate(key){if(key==='collection'||key==='method'){closeMenu();document.getElementById(key)?.scrollIntoView({behavior:'smooth'})}else if(key==='auth')showAuth();else if(key==='settings')openDialog('settings');else if(key==='feedback')openDialog('feedback')}
async function handleAuth(e){e.preventDefault();const form=e.currentTarget;const btn=form.querySelector('button[type=submit]');const email=form.email.value.trim();const password=form.password.value;const output=$('#authError');output.classList.remove('success');output.textContent='';btn.disabled=true;try{const result=await api(model.authMode==='register'?'register':'login',{method:'POST',body:JSON.stringify({email,password})});model.me=result.user;model.settings={...defaults,...result.user.settings};renderAuth();applySettings();form.reset();closeDialog('auth');toast(model.authMode==='register'?'Аккаунт создан. Добро пожаловать!':'Вы вошли в КиноКлуб!')}catch(err){output.textContent=err.message}finally{btn.disabled=false}}
async function handleSaveSettings(){const next={audioLanguage:$('#audioSetting').value,quality:$('#qualitySetting').value,subtitles:$('#subtitleSetting').value,reducedMotion:$('#motionSetting').checked};const el=$('#settingsFeedback');el.classList.remove('success');el.textContent='';try{if(model.me){await api('settings',{method:'POST',body:JSON.stringify(next)})}localStorage.setItem('kinoclub_settings',JSON.stringify(next));model.settings=next;applySettings();el.textContent='Настройки сохранены';el.classList.add('success');toast('Настройки сохранены')}catch(err){el.textContent=err.message}}
async function handleFeedback(e){e.preventDefault();const form=e.currentTarget;const out=$('#feedbackStatus');out.classList.remove('success');out.textContent='';const btn=form.querySelector('button[type=submit]');btn.disabled=true;try{await api('feedback',{method:'POST',body:JSON.stringify({email:form.email.value.trim(),message:form.message.value.trim()})});out.textContent='Сообщение получено. Спасибо!';out.classList.add('success');form.reset()}catch(err){out.textContent=err.message}finally{btn.disabled=false}}
async function logout(){try{await api('logout',{method:'POST',body:'{}'});model.me=null;model.settings={...defaults,...readLocalSettings()};renderAuth();applySettings();closeDialog('settings');toast('Вы вышли из аккаунта')}catch(err){toast(err.message)}}
let heroPreviewsOn=false;
// Keep the branded poster visible until the video host confirms actual playback.
// In restricted regions, blocked embeds never replace a film card with an error page.
window.addEventListener('message',event=>{
  if(!['https://www.youtube-nocookie.com','https://www.youtube.com'].includes(event.origin))return;
  let msg=event.data;
  if(typeof msg==='string'){try{msg=JSON.parse(msg)}catch{return}}
  if(!msg||typeof msg!=='object')return;
  const card=$$('.screen-card').find(el=>el.querySelector('iframe.preview-motion')?.contentWindow===event.source);
  if(!card)return;
  if(msg.event==='onReady'){
    event.source.postMessage(JSON.stringify({event:'command',func:'mute',args:[]}),event.origin);
    event.source.postMessage(JSON.stringify({event:'command',func:'playVideo',args:[]}),event.origin);setTimeout(()=>{try{event.source.postMessage(JSON.stringify({event:'command',func:'playVideo',args:[]}),event.origin)}catch{}},900);
  }
  if(msg.event==='onStateChange' && msg.info===1){card.classList.add('video-playing');card.dataset.previewStatus='playing'}
  if(msg.event==='onError'){card.classList.remove('video-playing');card.dataset.previewStatus='poster'}
});
function startHeroPreviews(){
  if(heroPreviewsOn)return;
  if(model.settings.reducedMotion||navigator.connection?.saveData)return;
  heroPreviewsOn=true;
  $$('.screen-card').forEach((card,index)=>{
    const movie=MOVIES.find(m=>m.id===card.dataset.id);
    if(!movie)return;
    const frame=document.createElement('iframe');
    frame.className='preview-motion';
    frame.tabIndex=-1;
    frame.title='Беззвучный видеофон: '+movie.title;
    frame.loading='eager';
    frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.setAttribute('aria-hidden','true');
    const origin=encodeURIComponent(location.origin);
    frame.src=`https://www.youtube-nocookie.com/embed/${movie.youtube}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${movie.youtube}&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&rel=0&enablejsapi=1&origin=${origin}`;
    frame.addEventListener('load',()=>{
      const listen=()=>frame.contentWindow?.postMessage(JSON.stringify({event:'listening',id:movie.id}),'https://www.youtube-nocookie.com');
      listen();[350,900,1800,3000,4900].forEach(delay=>setTimeout(listen,delay));
    });
    const holder=card.querySelector('.screen-image');
    holder.append(frame);
    card.classList.add('has-video');
  });
}
function observeHeroPreviews(){
  const scene=$('#screenScene');
  if(!('IntersectionObserver' in window)){startHeroPreviews();return;}
  const observer=new IntersectionObserver(entries=>{
    if(entries.some(e=>e.isIntersecting)){
      observer.disconnect();
      startHeroPreviews();
    }
  },{threshold:.08});
  observer.observe(scene);
}
function attach(){initIntro();initSeamlessTicker();const brand=$('.brand');let brandClapTimer;const clapBrand=()=>{brand.classList.remove('is-clapping');void brand.offsetWidth;brand.classList.add('is-clapping');clearTimeout(brandClapTimer);brandClapTimer=setTimeout(()=>brand.classList.remove('is-clapping'),1300)};brand.addEventListener('pointerenter',clapBrand);brand.addEventListener('pointerdown',clapBrand);brand.addEventListener('focusin',clapBrand);$('#helpTop').onclick=()=>openDialog('help');$('#helpContact').onclick=()=>{closeDialog('help');openDialog('feedback')};$('#menuToggle').onclick=()=>model.menuOpen?closeMenu():openMenu();$('#scrim').onclick=closeMenu;$$('[data-close=menu]').forEach(b=>b.onclick=closeMenu);$$('[data-nav]').forEach(b=>b.onclick=()=>onNavigate(b.dataset.nav));$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));$$('[data-close]').filter(b=>b.dataset.close!=='menu').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));$('#videoDialog').addEventListener('close',()=>$('#videoFrame').replaceChildren());$('#loginTop').onclick=showAuth;$('#joinButton').onclick=()=>{if(model.me){openDialog('settings')}else{setAuthMode('register');openDialog('auth')}};$('#showHow').onclick=()=>$('#method').scrollIntoView({behavior:'smooth'});$('#footerFeedback').onclick=()=>openDialog('feedback');$('#tabLogin').onclick=()=>setAuthMode('login');$('#tabRegister').onclick=()=>setAuthMode('register');$('#authForm').onsubmit=handleAuth;$('#saveSettings').onclick=handleSaveSettings;$('#logoutButton').onclick=logout;$('#feedbackForm').onsubmit=handleFeedback;$('#nextVideo').onclick=()=>openMovie(MOVIES[(model.currentMovie+1)%MOVIES.length].id);$$('.filter').forEach(b=>b.onclick=()=>{$$('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');model.filter=b.dataset.filter;renderCatalog()});$('#catalogSearch').oninput=renderCatalog;$('#catalogGrid').addEventListener('click',e=>{const card=e.target.closest('.movie-card');if(card)openMovie(card.dataset.id)});$('#catalogGrid').addEventListener('keydown',onCardKey);$$('.screen-card').forEach(c=>{c.onclick=()=>openMovie(c.dataset.id);c.onkeydown=onCardKey});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  // Gentle cursor depth on desktop; automatically disabled for reduced motion.
  const scene=$('#screenScene');scene.addEventListener('pointermove',e=>{if(matchMedia('(prefers-reduced-motion:reduce)').matches||model.settings.reducedMotion||!matchMedia('(min-width:850px)').matches)return;const box=scene.getBoundingClientRect();const x=(e.clientX-box.left)/box.width-.5,y=(e.clientY-box.top)/box.height-.5;$$('.screen-card').forEach((card,index)=>{card.style.translate=`${x*(index%2===0?-12:12)}px ${y*(index<2?-10:10)}px`})});scene.addEventListener('pointerleave',()=>$$('.screen-card').forEach(c=>c.style.translate='0px 0px'));}
renderCatalog();monitorImages();attach();syncUser();
// Начинаем загрузку немых видеофонов сразу, пока видна заставка.
// На устройствах с Reduced Motion / Data Saver сохраняем постеры.
setTimeout(startHeroPreviews,120);
