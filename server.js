const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws'),P=require('./data');
const K=['Профессия','Пол и возраст','Здоровье','Хобби','Багаж','Факт','Черта','Фобия','Спецкарта'],MIN=4,rooms={};
const rnd=n=>Math.random()*n|0,pk=a=>a[rnd(a.length)];
const sh=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const pool=(t,k)=>t=='S'?P[k][0]:t=='F'?(P[k][1]||P[k][0]):P[k][0].concat(P[k][1]||[]);
const PUB=path.join(__dirname,'public'),MT={'.html':'text/html; charset=utf-8','.png':'image/png','.json':'application/manifest+json'},files={};
fs.readdirSync(PUB).forEach(f=>files['/'+f]={b:fs.readFileSync(path.join(PUB,f)),t:MT[path.extname(f)]||'application/octet-stream'});
const srv=http.createServer((q,s)=>{const u=q.url.split('?')[0];if(u=='/health')return s.end('ok');const f=files[u]||files['/index.html'];s.writeHead(200,{'Content-Type':f.t,'Cache-Control':f.t.startsWith('text/html')?'no-cache':'public,max-age=86400'});s.end(f.b)});
const wss=new WebSocketServer({server:srv});
const send=(ws,o)=>{if(ws&&ws.readyState==1)ws.send(JSON.stringify(o))};
const alive=R=>R.pl.filter(p=>!p.out);
function code(){let c;do c=String(1000+rnd(9000));while(rooms[c]);return c}
function view(R,me){const end=R.phase=='end';return{t:'state',room:R.id,tone:R.tone,phase:R.phase,round:R.round,last:R.last,tied:R.tied,g:R.g,
me:{id:me.id,card:me.card,open:me.open,out:me.out},
pl:R.pl.map(p=>({id:p.id,name:p.name,out:p.out,on:!!p.ws,voted:!!R.votes[p.id],mine:R.votes[me.id]==p.id,shown:p.card?(end?p.card:Object.fromEntries(Object.keys(p.open).map(i=>[K[i],p.card[K[i]]]))):{}}))}}
function bc(R){R.ts=Date.now();R.pl.forEach(p=>send(p.ws,view(R,p)))}
function deal(R){const n=R.pl.length,t=R.tone;
R.g={n,seats:n>>1,E:n-(n>>1),cat:pk(pool(t,'Катастрофа')),bun:pk(pool(t,'Бункер')),yrs:1+rnd(9),mo:3+rnd(22),m2:50+rnd(15)*10};
R.pl.forEach(p=>{p.card={};p.open={};p.out=false});
K.forEach(k=>{if(k=='Пол и возраст')R.pl.forEach(p=>p.card[k]=(rnd(2)?'Мужчина':'Женщина')+', '+(18+rnd(55)));else{const a=sh(pool(t,k));R.pl.forEach((p,i)=>p.card[k]=a[i%a.length])}});
R.phase='reveal';R.round=1;R.votes={};R.last=null;R.tied=null}
function tally(R){const c={};Object.values(R.votes).forEach(id=>c[id]=(c[id]||0)+1);
const mx=Math.max(...Object.values(c)),top=Object.keys(c).filter(id=>c[id]==mx),nm=id=>R.pl.find(p=>p.id==id).name,tl=Object.entries(c).map(([id,n])=>[nm(id),n]);
if(top.length>1&&!R.tied){R.tied=top;R.votes={};R.last={tie:top.map(nm),tally:tl};return}
const p=R.pl.find(x=>x.id==pk(top));p.out=true;R.last={out:p.name,tally:tl};R.tied=null;R.votes={};
if(alive(R).length<=R.g.seats)R.phase='end';else{R.round++;R.phase='reveal'}}
wss.on('connection',ws=>{let R=null,me=null;ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.t=='create'||m.t=='join'){const tok=String(m.token||'').slice(0,40);if(!tok)return;
if(m.t=='create'){const id=code();R=rooms[id]={id,tone:['S','X','F'].includes(m.tone)?m.tone:'X',phase:'lobby',pl:[],round:1,votes:{},last:null,tied:null,g:null,ts:Date.now()}}
else R=rooms[String(m.room)]||null;
if(!R)return send(ws,{t:'err',msg:'Комната не найдена'});
me=R.pl.find(p=>p.token==tok);
if(!me){if(R.phase!='lobby'){R=null;return send(ws,{t:'err',msg:'Игра уже идёт, войти нельзя'})}
if(R.pl.length>=10){R=null;return send(ws,{t:'err',msg:'В комнате уже 10 игроков'})}
me={id:Math.random().toString(36).slice(2,8),token:tok,name:String(m.name||'Игрок').slice(0,14),open:{},out:false,card:null,ws};R.pl.push(me)}
me.ws=ws;return bc(R)}
if(!R||!me)return;
switch(m.t){
case'start':if(R.phase=='lobby'&&R.pl.length>=MIN)deal(R);break;
case'open':if(R.phase!='lobby'&&R.phase!='end'&&K[m.i])me.open[m.i]=1;break;
case'startvote':if(R.phase=='reveal'){R.phase='vote';R.votes={};R.last=null}break;
case'vote':if(R.phase!='vote'||me.out||m.target==me.id||!R.pl.some(p=>p.id==m.target&&!p.out)||(R.tied&&!R.tied.includes(m.target)))return;
R.votes[me.id]=m.target;if(alive(R).every(p=>R.votes[p.id]))tally(R);break;
case'again':if(R.phase=='end'){R.phase='lobby';R.g=null;R.last=null;R.tied=null;R.votes={};R.pl.forEach(p=>{p.card=null;p.open={};p.out=false})}break;
case'leave':if(R.phase=='lobby'){R.pl=R.pl.filter(p=>p!==me);if(!R.pl.length)delete rooms[R.id];else bc(R)}R=me=null;return}
bc(R)});
ws.on('close',()=>{if(me&&me.ws===ws){me.ws=null;if(R&&rooms[R.id])bc(R)}})});
setInterval(()=>{wss.clients.forEach(c=>{if(!c.isAlive)return c.terminate();c.isAlive=false;c.ping()});
for(const id in rooms)if(Date.now()-rooms[id].ts>12*36e5)delete rooms[id]},25000);
srv.listen(process.env.PORT||3000,()=>console.log('Bunker on :'+(process.env.PORT||3000)));
