(() => {
"use strict";

/* GameHub Plus: 1 file JS, 1.000 playable entries, 20 deterministic engines. */
const GENRES = [
  ["Arcade","🕹️"],["Action","⚔️"],["Puzzle","🧩"],["Racing","🏎️"],["Adventure","🗺️"],
  ["Sports","🏆"],["Strategy","♟️"],["Casual","✨"],["Reflex","⚡"],["Survival","🛡️"]
];
const ADJ = ["Neon","Turbo","Pixel","Cosmic","Shadow","Hyper","Lucky","Mystic","Cyber","Mega","Rapid","Star","Golden","Crystal","Power","Tiny","Wild","Epic","Retro","Future"];
const NOUN = ["Runner","Arena","Quest","Rush","Challenge","Blitz","Dash","Hunter","Master","Battle","Maze","Collector","Racer","Defense","Jump","Match","Strike","Puzzle","Survival","Mission"];
const ICONS = ["🎮","🕹️","⚡","🚀","🧩","🏎️","🛡️","🎯","💎","🌟"];
const games = [];
for(let i=1;i<=1000;i++){
  const g=(i-1)%GENRES.length, a=(i-1)%ADJ.length, n=Math.floor((i-1)/ADJ.length)%NOUN.length;
  const engine=(i-1)%20;
  games.push({
    id:i, name:`${ADJ[a]} ${NOUN[n]} ${String(i).padStart(4,"0")}`,
    genre:GENRES[g][0], icon:ICONS[(i-1)%ICONS.length], engine,
    seed:(i*7919)%1000003,
    desc:`Game ${i}: variasi ${GENRES[g][0].toLowerCase()} dengan pola tantangan yang berubah.`
  });
}

const $ = id => document.getElementById(id);
const state = {
  filtered:[...games], page:1, perPage:24, current:null, running:false,
  score:0, lives:3, time:30, timer:null, raf:null, cleanup:[],
  best:Object.create(null), seed:1, keys:new Set()
};

const arena=$("arena"), modal=$("modal"), result=$("result");
const search=$("search"), genre=$("genre"), sort=$("sort");

GENRES.forEach(([name]) => {
  const o=document.createElement("option"); o.value=name; o.textContent=name; genre.appendChild(o);
});

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function rng(seed){let x=(seed>>>0)||1; return ()=>((x=x*1664525+1013904223>>>0)/4294967296);}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function pos(r,w,h,size=40){return {x:Math.floor(r()*(Math.max(1,w-size))),y:Math.floor(r()*(Math.max(1,h-size)))};}
function clearTimers(){
  if(state.timer){clearInterval(state.timer);state.timer=null;}
  if(state.raf){cancelAnimationFrame(state.raf);state.raf=null;}
  state.cleanup.forEach(fn=>{try{fn()}catch(e){}});
  state.cleanup=[];
}
function onArena(type,fn){arena.addEventListener(type,fn);state.cleanup.push(()=>arena.removeEventListener(type,fn));}
function interval(fn,ms){const x=setInterval(fn,ms);state.cleanup.push(()=>clearInterval(x));return x;}
function rafLoop(fn){let alive=true;const stop=()=>{alive=false;cancelAnimationFrame(id)};state.cleanup.push(stop);let id=requestAnimationFrame(function tick(t){if(!alive)return;fn(t);id=requestAnimationFrame(tick)});state.raf=id;return stop;}
function el(cls,text=""){const d=document.createElement("div");d.className=cls;if(text)d.textContent=text;return d;}
function randInt(r,min,max){return Math.floor(r()*(max-min+1))+min;}
function placeAbsolute(node,r,size=40){const p=pos(r,arena.clientWidth,arena.clientHeight,size);node.style.left=p.x+"px";node.style.top=p.y+"px";}

function render(){
  const q=search.value.trim().toLowerCase(), gr=genre.value, so=sort.value;
  state.filtered=games.filter(g=>(!q||(g.name+" "+g.genre+" "+g.desc).toLowerCase().includes(q))&&(gr==="all"||g.genre===gr));
  state.filtered.sort((a,b)=>{
    if(so==="name")return a.name.localeCompare(b.name);
    if(so==="genre")return a.genre.localeCompare(b.genre)||a.id-b.id;
    if(so==="best")return (state.best[b.id]||0)-(state.best[a.id]||0);
    return a.id-b.id;
  });
  const pages=Math.max(1,Math.ceil(state.filtered.length/state.perPage));
  state.page=clamp(state.page,1,pages);
  const slice=state.filtered.slice((state.page-1)*state.perPage,state.page*state.perPage);
  $("countLabel").textContent=`${state.filtered.length.toLocaleString("id-ID")} game`;
  $("pageInfo").textContent=`Halaman ${state.page} / ${pages}`;
  $("prev").disabled=state.page<=1;$("next").disabled=state.page>=pages;
  $("gameGrid").innerHTML="";
  slice.forEach(g=>{
    const card=document.createElement("article");card.className="game-card";
    const best=state.best[g.id]||0;
    card.innerHTML=`<div class="game-icon">${g.icon}</div><h3>${esc(g.name)}</h3><p>${esc(g.desc)}</p><div class="card-bottom"><span class="tag">${esc(g.genre)} · Best ${best}</span><button class="play-btn" type="button" data-id="${g.id}">Mainkan</button></div>`;
    card.querySelector("button").addEventListener("click",()=>openGame(g.id));
    $("gameGrid").appendChild(card);
  });
}
function setStats(){ $("score").textContent=state.score; $("lives").textContent=state.lives; $("time").textContent=state.time; $("best").textContent=state.best[state.current?.id]||0; }
function addScore(n){state.score=Math.max(0,state.score+n);setStats();}
function finish(msg="Game selesai!"){
  if(!state.running)return;
  state.running=false;clearTimers();
  if(state.current){const old=state.best[state.current.id]||0;if(state.score>old)state.best[state.current.id]=state.score;}
  setStats();result.textContent=`🏁 ${msg} Skor: ${state.score}.`;
}
function loseLife(){
  state.lives--; setStats();
  if(state.lives<=0) finish("Nyawa habis.");
}
function resetArena(){arena.innerHTML="";result.textContent="";clearTimers();state.running=false;}
function openGame(id){
  const g=games.find(x=>x.id===id); if(!g)return;
  resetArena();state.current=g;state.score=0;state.lives=3;state.time=30;state.seed=g.seed;
  $("modalIcon").textContent=g.icon;$("modalTitle").textContent=g.name;$("modalGenre").textContent=g.genre;
  $("modalDesc").textContent=g.desc;$("instruction").textContent=instruction(g.engine);
  setStats();modal.classList.add("show");modal.setAttribute("aria-hidden","false");
}
function closeGame(){resetArena();modal.classList.remove("show");modal.setAttribute("aria-hidden","true");}
function startGame(){
  if(!state.current)return;
  resetArena();state.running=true;state.score=0;state.lives=3;state.time=30;state.seed=state.current.seed;
  setStats();result.textContent=""; engine(state.current.engine,state.current.seed);
}
function countdown(seconds=30){
  state.time=seconds;setStats();
  state.timer=setInterval(()=>{if(!state.running)return;state.time--;setStats();if(state.time<=0)finish("Waktu habis.");},1000);
  state.cleanup.push(()=>{clearInterval(state.timer);state.timer=null});
}
function instruction(e){
  const a=[
    "Klik target ungu secepat mungkin. Setiap target memberi poin.",
    "Gerakkan kotak biru dengan WASD/arrow keys untuk mengumpulkan koin.",
    "Klik target dan hindari target merah yang bergerak.",
    "Gerakkan pemain di jalur untuk mengambil koin sebanyak mungkin.",
    "Gunakan WASD/arrow keys untuk menuju kotak hijau.",
    "Gerakkan pemain dan hindari rintangan merah.",
    "Klik ubin yang menyala. Ikuti pola yang muncul.",
    "Klik target yang terus berpindah sebelum waktu habis.",
    "Ambil energi kuning; beberapa energi bergerak.",
    "Bertahan dari objek merah yang turun dan kumpulkan bintang.",
    "Klik pasangan warna yang sama.",
    "Tangkap bintang sebelum menghilang.",
    "Gerakkan pemain untuk menghindari gelombang rintangan.",
    "Klik tombol yang benar sesuai angka yang diminta.",
    "Kumpulkan permata sebanyak mungkin.",
    "Pilih pintu aman; pintu salah mengurangi nyawa.",
    "Jaga pemain tetap di area dan tangkap bonus.",
    "Klik target hanya ketika target berwarna hijau.",
    "Geser pemain ke kiri/kanan untuk melewati rintangan.",
    "Pecahkan target berurutan dari angka terkecil."
  ];return a[e]||a[0];
}

function engine(type,seed){
  switch(type){
    case 0:return clickTarget(seed,false);
    case 1:return moveCollect(seed,false);
    case 2:return clickTarget(seed,true);
    case 3:return runner(seed);
    case 4:return goalMove(seed);
    case 5:return dodge(seed);
    case 6:return sequence(seed);
    case 7:return movingTarget(seed);
    case 8:return energy(seed);
    case 9:return survival(seed);
    case 10:return pairs(seed);
    case 11:return starCatch(seed);
    case 12:return waveDodge(seed);
    case 13:return numberTap(seed);
    case 14:return gemCollect(seed);
    case 15:return safeDoors(seed);
    case 16:return bonusField(seed);
    case 17:return greenOnly(seed);
    case 18:return laneRunner(seed);
    case 19:return numberOrder(seed);
  }
}

/* 0,2 */
function clickTarget(seed,enemyMode){
  const r=rng(seed), target=el("div","🎯");target.className="target";arena.appendChild(target);
  let clicks=0, enemy=null;
  const spawn=()=>{
    if(!state.running)return;
    placeAbsolute(target,r,48);clicks++;
    if(enemyMode&&clicks%2===0){
      if(!enemy){enemy=el("div","💥");enemy.className="target enemy";arena.appendChild(enemy);enemy.addEventListener("click",()=>loseLife());state.cleanup.push(()=>enemy?.remove());}
      placeAbsolute(enemy,r,48);
    }
  };
  target.addEventListener("click",()=>{if(!state.running)return;addScore(10+randInt(r,0,9));spawn();});
  onArena("keydown",e=>{if(e.code==="Space"){e.preventDefault();target.click();}});
  spawn();countdown(30);
}

/* 1 */
function moveCollect(seed){
  const r=rng(seed), p=el("player","●"), c=el("coin","★");arena.append(p,c);
  let x=20,y=20,speed=4;
  const draw=()=>{p.style.left=x+"px";p.style.top=y+"px";placeAbsolute(c,r,38)};
  placeAbsolute(c,r,38);draw();
  const key=e=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD"].includes(e.code)){e.preventDefault();state.keys.add(e.code)}};
  const up=e=>state.keys.delete(e.code);onArena("keydown",key);onArena("keyup",up);arena.focus();
  rafLoop(()=>{
    if(!state.running)return;
    if(state.keys.has("ArrowUp")||state.keys.has("KeyW"))y-=speed;
    if(state.keys.has("ArrowDown")||state.keys.has("KeyS"))y+=speed;
    if(state.keys.has("ArrowLeft")||state.keys.has("KeyA"))x-=speed;
    if(state.keys.has("ArrowRight")||state.keys.has("KeyD"))x+=speed;
    x=clamp(x,0,arena.clientWidth-42);y=clamp(y,0,arena.clientHeight-42);draw();
    const cx=parseFloat(c.style.left),cy=parseFloat(c.style.top);
    if(Math.abs(x-cx)<40&&Math.abs(y-cy)<40){addScore(12);placeAbsolute(c,r,38);}
  });countdown(30);
}

/* 2 already clickTarget enemy mode */

/* 3 */
function runner(seed){
  const r=rng(seed),p=el("player","🚀"),coin=el("coin","💰"),bad=el("obstacle","");bad.style.width="44px";bad.style.height="44px";arena.append(p,coin,bad);
  let x=20,y=arena.clientHeight/2, vy=0, bx=arena.clientWidth, cy=0, by=0;
  const resetCoin=()=>{bx=arena.clientWidth+randInt(r,0,120);by=randInt(r,20,arena.clientHeight-60);coin.style.left=bx+"px";coin.style.top=by+"px";};
  const resetBad=()=>{bad.style.left=arena.clientWidth+randInt(r,60,200)+"px";bad.style.top=randInt(r,10,arena.clientHeight-55)+"px";};
  resetCoin();resetBad();p.style.left=x+"px";
  onArena("pointerdown",()=>{vy=-7});onArena("keydown",e=>{if(e.code==="Space"||e.code==="ArrowUp"){e.preventDefault();vy=-7}});
  rafLoop(()=>{
    if(!state.running)return;
    vy+=.32;y+=vy;x=35;
    bx-=3.2;let ex=parseFloat(bad.style.left)-3.2;bad.style.left=ex+"px";
    if(bx<-50)resetCoin();else coin.style.left=bx+"px";
    if(ex<-60)resetBad();
    p.style.top=clamp(y,0,arena.clientHeight-42)+"px";
    if(Math.abs(x-bx)<38&&Math.abs(y-by)<38){addScore(15);resetCoin();}
    const ey=parseFloat(bad.style.top),px=x,py=y;
    if(Math.abs(px-ex)<40&&Math.abs(py-ey)<42){loseLife();resetBad();}
  });countdown(30);
}

/* 4 */
function goalMove(seed){
  const r=rng(seed),p=el("player","🧑"),g=el("goal","🏁");arena.append(p,g);
  let x=15,y=15;const speed=4;
  const key=e=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD"].includes(e.code)){e.preventDefault();state.keys.add(e.code)}};
  onArena("keydown",key);onArena("keyup",e=>state.keys.delete(e.code));arena.focus();placeAbsolute(g,r,52);
  rafLoop(()=>{
    if(!state.running)return;
    if(state.keys.has("ArrowUp")||state.keys.has("KeyW"))y-=speed;if(state.keys.has("ArrowDown")||state.keys.has("KeyS"))y+=speed;
    if(state.keys.has("ArrowLeft")||state.keys.has("KeyA"))x-=speed;if(state.keys.has("ArrowRight")||state.keys.has("KeyD"))x+=speed;
    x=clamp(x,0,arena.clientWidth-42);y=clamp(y,0,arena.clientHeight-42);p.style.left=x+"px";p.style.top=y+"px";
    const gx=parseFloat(g.style.left),gy=parseFloat(g.style.top);if(Math.abs(x-gx)<45&&Math.abs(y-gy)<50){addScore(50);placeAbsolute(g,r,52);}
  });countdown(35);
}

/* 5 */
function dodge(seed){
  const r=rng(seed),p=el("player","🛡️");arena.append(p);let x=arena.clientWidth/2-21,y=arena.clientHeight-65; p.style.left=x+"px";p.style.top=y+"px";
  const obs=[];for(let i=0;i<6;i++){const o=el("obstacle");o.style.width=randInt(r,35,75)+"px";o.style.height=randInt(r,18,35)+"px";o.style.top=-50-randInt(r,0,500)+"px";o.style.left=randInt(r,0,arena.clientWidth-75)+"px";arena.append(o);obs.push(o);}
  onArena("pointermove",e=>{const b=arena.getBoundingClientRect();x=clamp(e.clientX-b.left-21,0,arena.clientWidth-42)});
  onArena("keydown",e=>{if(e.code==="ArrowLeft"||e.code==="KeyA")x-=20;if(e.code==="ArrowRight"||e.code==="KeyD")x+=20;x=clamp(x,0,arena.clientWidth-42)});
  rafLoop(()=>{if(!state.running)return;p.style.left=x+"px";obs.forEach(o=>{let y=parseFloat(o.style.top)+3.5;o.style.top=y+"px";if(y>arena.clientHeight+40){o.style.top="-50px";o.style.left=randInt(r,0,arena.clientWidth-75)+"px";addScore(2)}const ox=parseFloat(o.style.left),ow=o.offsetWidth,oy=y;if(Math.abs((x+21)-(ox+ow/2))<=(ow/2+20)&&Math.abs((arena.clientHeight-44)-(oy+o.offsetHeight/2))<35){o.style.top="-70px";loseLife();}})});countdown(30);
}

/* 6 */
function sequence(seed){
  const r=rng(seed),tiles=[];for(let i=0;i<9;i++){const t=el("tile",String(i+1));t.dataset.n=i+1;arena.append(t);tiles.push(t);}
  tiles.forEach((t,i)=>{t.style.left=(i%3)*72+20+"px";t.style.top=Math.floor(i/3)*72+25+"px";});
  let target=randInt(r,1,9);let locked=false;
  const ask=()=>{if(!state.running)return;target=randInt(r,1,9);result.textContent=`🔢 Cari angka ${target}`;locked=false;};
  tiles.forEach(t=>t.addEventListener("click",()=>{if(locked||!state.running)return;locked=true;if(+t.dataset.n===target){t.classList.add("good");addScore(12);setTimeout(()=>t.classList.remove("good"),120);ask();}else{t.classList.add("bad");loseLife();setTimeout(()=>t.classList.remove("bad"),120);ask();}}));
  ask();countdown(35);
}

/* 7 */
function movingTarget(seed){
  const r=rng(seed),t=el("target","⭐");arena.append(t);let x=30,y=30,vx=2.4,vy=1.8;
  const draw=()=>{t.style.left=x+"px";t.style.top=y+"px"};draw();
  t.addEventListener("click",()=>{addScore(10);x=randInt(r,0,arena.clientWidth-48);y=randInt(r,0,arena.clientHeight-48);vx=(r()>.5?1:-1)*(2+r()*3);vy=(r()>.5?1:-1)*(2+r()*3);draw()});
  rafLoop(()=>{if(!state.running)return;x+=vx;y+=vy;if(x<0||x>arena.clientWidth-48)vx*=-1;if(y<0||y>arena.clientHeight-48)vy*=-1;draw()});countdown(30);
}

/* 8 */
function energy(seed){
  const r=rng(seed),p=el("player","⚡"),e=el("power","⚡");arena.append(p,e);let x=30,y=30;
  const key=e2=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD"].includes(e2.code)){e2.preventDefault();state.keys.add(e2.code)}};onArena("keydown",key);onArena("keyup",e2=>state.keys.delete(e2.code));arena.focus();
  const spawn=()=>placeAbsolute(e,r,38);spawn();
  rafLoop(()=>{if(!state.running)return;if(state.keys.has("ArrowUp")||state.keys.has("KeyW"))y-=4;if(state.keys.has("ArrowDown")||state.keys.has("KeyS"))y+=4;if(state.keys.has("ArrowLeft")||state.keys.has("KeyA"))x-=4;if(state.keys.has("ArrowRight")||state.keys.has("KeyD"))x+=4;x=clamp(x,0,arena.clientWidth-42);y=clamp(y,0,arena.clientHeight-42);p.style.left=x+"px";p.style.top=y+"px";const ex=parseFloat(e.style.left),ey=parseFloat(e.style.top);if(Math.abs(x-ex)<40&&Math.abs(y-ey)<40){addScore(18);spawn()}});countdown(30);
}

/* 9 */
function survival(seed){
  const r=rng(seed),p=el("player","🧙"),star=el("star","★");arena.append(p,star);let x=30,y=30;placeAbsolute(star,r,38);
  onArena("pointermove",e=>{const b=arena.getBoundingClientRect();x=clamp(e.clientX-b.left-21,0,arena.clientWidth-42);y=clamp(e.clientY-b.top-21,0,arena.clientHeight-42)});
  const enemies=[];for(let i=0;i<5;i++){const q=el("enemy","●");q.style.width="32px";q.style.height="32px";q.style.left=randInt(r,0,arena.clientWidth-32)+"px";q.style.top=randInt(r,0,arena.clientHeight-32)+"px";arena.append(q);enemies.push(q);}
  rafLoop(()=>{if(!state.running)return;p.style.left=x+"px";p.style.top=y+"px";const sx=parseFloat(star.style.left),sy=parseFloat(star.style.top);if(Math.abs(x-sx)<38&&Math.abs(y-sy)<38){addScore(10);placeAbsolute(star,r,38)}enemies.forEach(q=>{let ex=parseFloat(q.style.left),ey=parseFloat(q.style.top),dx=x-ex,dy=y-ey,d=Math.hypot(dx,dy)||1;ex+=dx/d*1.15;ey+=dy/d*1.15;q.style.left=ex+"px";q.style.top=ey+"px";if(d<34){loseLife();q.style.left=randInt(r,0,arena.clientWidth-32)+"px";q.style.top="0px"}})});countdown(35);
}

/* 10 */
function pairs(seed){
  const r=rng(seed),vals=["🍎","🍋","🍇","🍒","🥝","🍉"];let cards=vals.concat(vals).sort(()=>r()-.5),open=[];
  cards.forEach((v,i)=>{const t=el("tile","?");t.dataset.v=v;t.style.left=(i%4)*68+10+"px";t.style.top=Math.floor(i/4)*68+25+"px";arena.append(t);t.addEventListener("click",()=>{if(!state.running||t.classList.contains("good")||open.includes(t)||open.length>=2)return;t.textContent=v;open.push(t);if(open.length===2){const [a,b]=open;if(a.dataset.v===b.dataset.v){a.classList.add("good");b.classList.add("good");addScore(25);open=[];if(arena.querySelectorAll(".good").length===cards.length)finish("Semua pasangan ditemukan!");}else{const old=[...open];open=[];setTimeout(()=>old.forEach(x=>{x.textContent="?"}),450);loseLife();}}})});countdown(45);
}

/* 11 */
function starCatch(seed){
  const r=rng(seed),s=el("star","★");arena.append(s);let shown=true;
  const spawn=()=>{shown=true;s.style.display="flex";placeAbsolute(s,r,38);};
  s.addEventListener("click",()=>{if(!state.running||!shown)return;shown=false;s.style.display="none";addScore(14);setTimeout(spawn,250+r()*700)});
  spawn();countdown(30);
}

/* 12 */
function waveDodge(seed){
  const r=rng(seed),p=el("player","🚗");arena.append(p);let x=arena.clientWidth/2-21,y=arena.clientHeight-60;p.style.left=x+"px";p.style.top=y+"px";
  const blocks=[];for(let i=0;i<8;i++){const b=el("obstacle");b.style.width=randInt(r,30,60)+"px";b.style.height=randInt(r,20,45)+"px";b.style.left=randInt(r,0,arena.clientWidth-60)+"px";b.style.top=-i*80+"px";arena.append(b);blocks.push(b);}
  onArena("keydown",e=>{if(e.code==="ArrowLeft"||e.code==="KeyA")x-=22;if(e.code==="ArrowRight"||e.code==="KeyD")x+=22;x=clamp(x,0,arena.clientWidth-42)});
  rafLoop(()=>{if(!state.running)return;p.style.left=x+"px";blocks.forEach(b=>{let y2=parseFloat(b.style.top)+4;b.style.top=y2+"px";if(y2>arena.clientHeight){b.style.top="-50px";b.style.left=randInt(r,0,arena.clientWidth-60)+"px";addScore(3)}if(y2>arena.clientHeight-100&&y2<arena.clientHeight&&Math.abs(x-parseFloat(b.style.left))<45)loseLife()})});countdown(30);
}

/* 13 */
function numberTap(seed){
  const r=rng(seed),b=el("target","1");arena.append(b);let n=randInt(r,1,9);
  const ask=()=>{n=randInt(r,1,9);b.textContent=String(n);placeAbsolute(b,r,48);result.textContent=`🎯 Klik ${n}`};
  b.addEventListener("click",()=>{addScore(10);ask()});ask();countdown(30);
}

/* 14 */
function gemCollect(seed){
  const r=rng(seed),p=el("player","💎"),gem=el("coin","💎");arena.append(p,gem);let x=20,y=20;placeAbsolute(gem,r,38);
  onArena("pointermove",e=>{const b=arena.getBoundingClientRect();x=clamp(e.clientX-b.left-21,0,arena.clientWidth-42);y=clamp(e.clientY-b.top-21,0,arena.clientHeight-42)});
  rafLoop(()=>{if(!state.running)return;p.style.left=x+"px";p.style.top=y+"px";const gx=parseFloat(gem.style.left),gy=parseFloat(gem.style.top);if(Math.abs(x-gx)<40&&Math.abs(y-gy)<40){addScore(20);placeAbsolute(gem,r,38)}});countdown(30);
}

/* 15 */
function safeDoors(seed){
  const r=rng(seed),doors=[];for(let i=0;i<3;i++){const d=el("tile","🚪");d.style.left=(i*90+45)+"px";d.style.top="130px";arena.append(d);doors.push(d)}
  let safe=randInt(r,0,2),round=0;
  doors.forEach((d,i)=>d.addEventListener("click",()=>{if(!state.running)return;if(i===safe){addScore(18);round++;safe=randInt(r,0,2);result.textContent="✅ Pintu aman! Cari lagi."}else{loseLife();result.textContent="❌ Pintu itu bukan yang aman."}}));countdown(30);
}

/* 16 */
function bonusField(seed){
  const r=rng(seed),p=el("player","⭐"),bonus=el("power","✦");arena.append(p,bonus);let x=30,y=30;placeAbsolute(bonus,r,38);
  onArena("pointerdown",e=>{const b=arena.getBoundingClientRect();x=clamp(e.clientX-b.left-21,0,arena.clientWidth-42);y=clamp(e.clientY-b.top-21,0,arena.clientHeight-42)});
  rafLoop(()=>{if(!state.running)return;p.style.left=x+"px";p.style.top=y+"px";const bx=parseFloat(bonus.style.left),by=parseFloat(bonus.style.top);if(Math.abs(x-bx)<42&&Math.abs(y-by)<42){addScore(22);placeAbsolute(bonus,r,38)}});countdown(30);
}

/* 17 */
function greenOnly(seed){
  const r=rng(seed),t=el("target","🟢");arena.append(t);let green=false;
  const cycle=()=>{if(!state.running)return;green=!green;t.textContent=green?"🟢":"🔴";t.style.background=green?"#66d39e":"#ff6677";placeAbsolute(t,r,48)};
  t.addEventListener("click",()=>{if(green){addScore(15);cycle()}else loseLife()});
  cycle();interval(cycle,800);countdown(30);
}

/* 18 */
function laneRunner(seed){
  const r=rng(seed),p=el("player","🚗"),lane=el("lane");arena.append(lane,p);let laneIndex=1;const lanes=[70,160,250].map(y=>Math.min(y,arena.clientHeight-55));let obs=[];
  const setP=()=>{p.style.left="45px";p.style.top=(lanes[laneIndex]||70)+"px"};setP();
  onArena("keydown",e=>{if(e.code==="ArrowUp"||e.code==="KeyW")laneIndex=clamp(laneIndex-1,0,2);if(e.code==="ArrowDown"||e.code==="KeyS")laneIndex=clamp(laneIndex+1,0,2);setP()});
  for(let i=0;i<4;i++){const o=el("obstacle","");o.style.width="45px";o.style.height="45px";o.style.left=(300+i*180)+"px";o.style.top=lanes[i%3]+"px";arena.append(o);obs.push(o)}
  rafLoop(()=>{if(!state.running)return;obs.forEach(o=>{let x=parseFloat(o.style.left)-4;o.style.left=x+"px";if(x<-60){o.style.left=(arena.clientWidth+randInt(r,80,280))+"px";o.style.top=lanes[randInt(r,0,2)]+"px";addScore(2)}if(x<90&&x>15&&Math.abs(parseFloat(o.style.top)-(lanes[laneIndex]))<20)loseLife()})});countdown(30);
}

/* 19 */
function numberOrder(seed){
  const r=rng(seed),nums=[1,2,3,4,5,6],nodes=[];nums.forEach(n=>{const t=el("tile",String(n));arena.append(t);nodes.push(t);});
  let next=1;const shuffle=()=>{nodes.forEach(t=>{t.style.left=randInt(r,10,arena.clientWidth-65)+"px";t.style.top=randInt(r,20,arena.clientHeight-70)+"px";t.dataset.n=t.textContent});result.textContent=`Klik angka ${next}`};
  nodes.forEach(t=>t.addEventListener("click",()=>{if(+t.dataset.n===next){t.classList.add("good");addScore(8);next++;if(next>6){next=1;nodes.forEach(x=>x.classList.remove("good"));shuffle()}else result.textContent=`Klik angka ${next}`}else loseLife()}));shuffle();countdown(40);
}

$("search").addEventListener("input",()=>{state.page=1;render()});
genre.addEventListener("change",()=>{state.page=1;render()});
sort.addEventListener("change",()=>{state.page=1;render()});
$("prev").addEventListener("click",()=>{state.page--;render();scrollTo({top:$("games").offsetTop-70,behavior:"smooth"})});
$("next").addEventListener("click",()=>{state.page++;render();scrollTo({top:$("games").offsetTop-70,behavior:"smooth"})});
$("start").addEventListener("click",startGame);
$("reset").addEventListener("click",()=>{if(state.current){resetArena();state.score=0;state.lives=3;state.time=30;setStats();result.textContent="Game di-reset. Tekan Mulai Game."}});
$("closeModal").addEventListener("click",closeGame);
modal.addEventListener("click",e=>{if(e.target===modal)closeGame()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("show"))closeGame()});
$("themeBtn").addEventListener("click",()=>{document.body.classList.toggle("light");$("themeBtn").textContent=document.body.classList.contains("light")?"🌙":"☀️"});

render();
})();