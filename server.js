'use strict';
/**
 * KINOCLUB — minimal Node.js web app, no external dependencies.
 * Local development uses a JSON data store. For public production use, configure
 * persistent storage and operational backups; see README.md.
 */
const http=require('node:http');
const fs=require('node:fs');
const fsp=fs.promises;
const path=require('node:path');
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const STATIC=path.join(__dirname,'public');
const DATA=process.env.DATA_DIR||path.join(__dirname,'data');
const FILE=path.join(DATA,'db.json');
const PORT=Number(process.env.PORT||3000);
const COOKIE='kinoclub_sid';
const SESSION_DAYS=14;
const VALID={audioLanguage:['en','ru'],quality:['auto','1080p','720p','480p'],subtitles:['en','ru','off']};
const DEF={audioLanguage:'en',quality:'auto',subtitles:'en',reducedMotion:false};
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
const LIMIT=128*1024;
let db={users:[],sessions:[],feedback:[]};
let writeQueue=Promise.resolve();
const clientIP=req=>String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].slice(0,100);
const throttle=new Map();
function limit(req,scope,max=20,seconds=900){const key=scope+'|'+clientIP(req);const now=Date.now();let state=throttle.get(key);if(!state||now-state.start>seconds*1000)state={start:now,count:0};state.count++;throttle.set(key,state);if(throttle.size>10000){for(const [k,v] of throttle){if(now-v.start>seconds*1000)throttle.delete(k)}}return state.count<=max}
function reply(res,status,obj,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(obj))}
function noStore(res){res.setHeader('Cache-Control','no-store')}
async function save(){const copy=JSON.stringify(db,null,2);writeQueue=writeQueue.then(async()=>{await fsp.mkdir(DATA,{recursive:true,mode:0o700});const tmp=FILE+'.'+process.pid+'.tmp';await fsp.writeFile(tmp,copy,{mode:0o600});await fsp.rename(tmp,FILE)});return writeQueue}
function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=').map((x,i)=>i?x.trim():x.trim())).filter(p=>p[0]))}
function secureRequest(req){return Boolean(req.socket.encrypted||req.headers['x-forwarded-proto']==='https')}
function sessionCookie(req,id,remove=false){return `${COOKIE}=${remove?'':id}; HttpOnly; SameSite=Lax; Path=/; ${secureRequest(req)?'Secure; ':''}${remove?'Max-Age=0':`Max-Age=${SESSION_DAYS*86400}`}`}
function findUser(req){const token=parseCookies(req)[COOKIE];if(!token||!(/^[a-f0-9]{64}$/.test(token)))return null;const digest=crypto.createHash('sha256').update(token).digest('hex');const sess=db.sessions.find(s=>s.hash===digest&&s.exp>Date.now());return sess?db.users.find(u=>u.id===sess.uid)||null:null}
function publicUser(u){return{id:u.id,email:u.email,settings:u.settings||DEF}}
function isValidOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host}catch{return false}}
async function body(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>LIMIT){const err=Error('Запрос слишком большой');err.status=413;throw err}chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{const err=Error('Неверный формат JSON');err.status=400;throw err}}
async function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){const hash=await scrypt(password,salt,64,{N:16384,r:8,p:1});return `${salt}:${hash.toString('hex')}`}
async function verify(password,stored){const [salt,expected]=String(stored||'').split(':');if(!salt||!expected||expected.length!==128)return false;const hash=await scrypt(password,salt,64,{N:16384,r:8,p:1});return crypto.timingSafeEqual(hash,Buffer.from(expected,'hex'))}
async function newSession(req,res,user){const id=crypto.randomBytes(32).toString('hex');db.sessions=db.sessions.filter(s=>s.exp>Date.now());db.sessions.push({uid:user.id,hash:crypto.createHash('sha256').update(id).digest('hex'),exp:Date.now()+SESSION_DAYS*86400000});await save();res.setHeader('Set-Cookie',sessionCookie(req,id))}
function cleanString(v,max=256){return typeof v==='string'?v.trim().slice(0,max):''}
async function api(req,res,url){if(req.method==='POST'){if(!isValidOrigin(req))return reply(res,403,{error:'Недопустимый источник запроса'});if(!req.headers['content-type']?.startsWith('application/json'))return reply(res,415,{error:'Ожидается JSON'})}
  if(url.pathname==='/api/health'&&req.method==='GET')return reply(res,200,{status:'ok',service:'kinoclub',persistentData:!!process.env.DATA_DIR});
  if(url.pathname==='/api/me'&&req.method==='GET'){const u=findUser(req);return reply(res,200,{user:u?publicUser(u):null})}
  if(url.pathname==='/api/register'&&req.method==='POST'){
    if(!limit(req,'register',8,3600))return reply(res,429,{error:'Слишком много попыток. Попробуйте позднее.'});const b=await body(req);const email=cleanString(b.email,254).toLowerCase();const pass=b.password;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply(res,400,{error:'Проверьте адрес электронной почты'});
    if(typeof pass!=='string'||pass.length<8||pass.length>128)return reply(res,400,{error:'Пароль должен содержать от 8 до 128 символов'});
    if(db.users.some(u=>u.email===email))return reply(res,409,{error:'Такой аккаунт уже зарегистрирован'});
    const user={id:crypto.randomUUID(),email,password:await hashPassword(pass),createdAt:new Date().toISOString(),settings:{...DEF}};db.users.push(user);await newSession(req,res,user);return reply(res,201,{user:publicUser(user)})
  }
  if(url.pathname==='/api/login'&&req.method==='POST'){
    if(!limit(req,'login',20,900))return reply(res,429,{error:'Слишком много попыток входа. Попробуйте позднее.'});const b=await body(req);const email=cleanString(b.email,254).toLowerCase();const user=db.users.find(u=>u.email===email);const pass=typeof b.password==='string'?b.password:'';
    // Perform equivalent password work for unknown email (reduces account enumeration via timing).
    if(pass.length>128)return reply(res,401,{error:'Неверный email или пароль'});
    const fallback='31f2253b728e0f25dfe0ad01be82a310:'+('a'.repeat(128));
    const valid=await verify(pass,user?.password||fallback);if(!valid||!user)return reply(res,401,{error:'Неверный email или пароль'});
    await newSession(req,res,user);return reply(res,200,{user:publicUser(user)})
  }
  if(url.pathname==='/api/logout'&&req.method==='POST'){const token=parseCookies(req)[COOKIE];if(token&&/^[a-f0-9]{64}$/.test(token)){const hashed=crypto.createHash('sha256').update(token).digest('hex');db.sessions=db.sessions.filter(s=>s.hash!==hashed);await save()}res.setHeader('Set-Cookie',sessionCookie(req,'',true));return reply(res,200,{ok:true})}
  if(url.pathname==='/api/settings'&&req.method==='POST'){const user=findUser(req);if(!user)return reply(res,401,{error:'Сначала войдите в аккаунт'});const value=await body(req);const next={};for(const [key,list] of Object.entries(VALID)){if(!list.includes(value[key]))return reply(res,400,{error:'Недопустимая настройка: '+key});next[key]=value[key]}if(typeof value.reducedMotion!=='boolean')return reply(res,400,{error:'Недопустимая настройка анимации'});next.reducedMotion=value.reducedMotion;user.settings=next;await save();return reply(res,200,{ok:true,settings:next})}
  if(url.pathname==='/api/feedback'&&req.method==='POST'){if(!limit(req,'feedback',5,3600))return reply(res,429,{error:'Лимит сообщений исчерпан. Напишите позднее.'});const b=await body(req),msg=cleanString(b.message,2000),email=cleanString(b.email,254);if(msg.length<3||msg.length>2000)return reply(res,400,{error:'Сообщение должно содержать от 3 до 2000 символов'});if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(res,400,{error:'Проверьте email'});db.feedback.push({id:crypto.randomUUID(),email:email||findUser(req)?.email||'',message:msg,createdAt:new Date().toISOString()});await save();return reply(res,201,{ok:true})}
  return reply(res,404,{error:'Такой API-команды нет'})
}
async function staticFile(req,res,pathname){const requested=pathname==='/'?'/index.html':pathname;let file;
  try{file=decodeURIComponent(requested)}catch{return reply(res,400,{error:'Некорректный путь'})}
  // Explicitly disallow dot files and traversal and keep every static asset in public.
  if(file.includes('\\')||file.split('/').some(segment=>segment==='..'||segment.startsWith('.')))return reply(res,403,{error:'Доступ запрещен'});
  const resolved=path.resolve(STATIC,'.'+file);if(!resolved.startsWith(STATIC+path.sep))return reply(res,403,{error:'Доступ запрещен'});
  let st;try{st=await fsp.stat(resolved)}catch{return reply(res,404,{error:'Файл не найден'})}
  if(!st.isFile())return reply(res,404,{error:'Файл не найден'});
  const ext=path.extname(resolved).toLowerCase();res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' https://img.youtube.com data:; media-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; script-src 'self'; frame-src https://www.youtube-nocookie.com; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'"});if(req.method==='HEAD')return res.end();fs.createReadStream(resolved).pipe(res)}
async function main(){await fsp.mkdir(DATA,{recursive:true});try{db=JSON.parse(await fsp.readFile(FILE,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(req.method==='GET'||req.method==='HEAD'){if(url.pathname.startsWith('/api/'))return await api(req,res,url);return await staticFile(req,res,url.pathname)}if(req.method==='POST'&&url.pathname.startsWith('/api/'))return await api(req,res,url);return reply(res,405,{error:'Метод не поддерживается'})}catch(e){console.error('HTTP error:',e);if(!res.headersSent)reply(res,e.status||500,{error:e.status?e.message:'Внутренняя ошибка сервера'})}});
 server.listen(PORT,'0.0.0.0',()=>console.log('🎬 KINOCLUB on http://localhost:'+PORT))}
main().catch(e=>{console.error(e);process.exit(1)});
