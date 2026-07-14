// Eiken Practice App — main application logic
'use strict';

// Category colours on the satoyama palette: 語い moss, 文法 blue, 会話 clay,
// 語順 taupe. Badge backgrounds are the matching light tints.
const BADGE_BG={VOCAB:"#E8EDE6",GRAMMAR:"#E7ECF3",CONVERSATION:"#F5E7DE",ORDER:"#EFE9DB"};
const BADGE_FG={VOCAB:"#4A6B4F",GRAMMAR:"#4A6FA5",CONVERSATION:"#C9622A",ORDER:"#7A6A53"};
const CAT_LABEL={VOCAB:"語い",GRAMMAR:"文法",CONVERSATION:"会話",ORDER:"語順"};
const CAT_ICON={VOCAB:"📖",GRAMMAR:"✏️",CONVERSATION:"💬",ORDER:"🔤"};
const CAT_COLOR={VOCAB:"#4A6B4F",GRAMMAR:"#4A6FA5",CONVERSATION:"#C9622A",ORDER:"#7A6A53"};
const CATS=["VOCAB","GRAMMAR","CONVERSATION","ORDER"];
const MENU_ITEMS=[
  {key:"ALL",label:"すべての問題",icon:"📝"},
  {key:"VOCAB",label:"語い",icon:"📖"},
  {key:"GRAMMAR",label:"文法",icon:"✏️"},
  {key:"CONVERSATION",label:"会話",icon:"💬"},
  {key:"ORDER",label:"語順",icon:"🔤"},
];

let currentLevel="5", currentSet="1", questions=[];
let pool=[],idx=0,selected=null,answered=false,results=[];
let darkMode = localStorage.getItem("eiken_dark")==="1";

const $=id=>document.getElementById(id);
const show=id=>{$(id).classList.remove("hidden");};
const hide=id=>{$(id).classList.add("hidden");};
function hideAll(){["menu-screen","quiz-screen","review-screen","stats-screen"].forEach(hide);}
function escHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function cfg(){return LEVEL_CFG[currentLevel];}
// Readable foreground for text sitting on an accent fill — ink on the light
// gold accent, paper on the darker ones.
function lum(hex){const h=hex.replace("#","");return (0.299*parseInt(h.slice(0,2),16)+0.587*parseInt(h.slice(2,4),16)+0.114*parseInt(h.slice(4,6),16))/255;}
function onAccent(hex){return lum(hex)>0.62?"#1C2530":"#F7F3EA";}

// ── Dark mode ─────────────────────────────────────────────────
function applyDark(){
  document.body.classList.toggle("dark", darkMode);
  $("theme-btn").textContent = darkMode ? "☀️" : "🌙";
}
$("theme-btn").onclick=function(){
  darkMode=!darkMode;
  localStorage.setItem("eiken_dark", darkMode?"1":"0");
  applyDark();
};

// ── Theme (accent colours) ────────────────────────────────────
function applyTheme(){
  const c=cfg(), on=onAccent(c.accent);
  // Expose the active level's accent to CSS (hovers, selected states).
  document.body.style.setProperty("--lvl-accent", c.accent);
  document.body.style.setProperty("--lvl-accent-light", c.accentLight);
  document.querySelectorAll(".level-tab").forEach(t=>{
    const active=t.getAttribute("data-level")===currentLevel;
    t.classList.toggle("active",active);
    t.style.background=active?c.accent:"";
    t.style.borderColor=active?c.accent:"";
    t.style.color=active?on:"";
  });
  document.querySelectorAll(".set-tab").forEach(t=>{
    const active=t.getAttribute("data-set")===currentSet;
    t.classList.toggle("active",active);
    t.style.background=active?c.accent:"";
    t.style.borderColor=active?c.accent:"";
    t.style.color=active?on:"";
  });
  $("hdr-icon").style.background=c.accent;
  $("hdr-icon").style.color=on;
  $("hdr-title").textContent="英検"+c.label+" Practice";
  $("next-btn").style.background=c.accent;
  $("next-btn").style.color=on;
  $("prog-bar").style.background="linear-gradient(90deg,"+c.accent+","+c.accentMid+")";
  $("modal-confirm").style.background=c.accent;
  $("modal-confirm").style.color=on;
}

// ── Side panel tracker ────────────────────────────────────────
// One numbered tile per question: moss=correct, clay=wrong, gold outline=
// current, mist=upcoming (see the .tk-tile styles + legend).
function buildTracker(){
  const grid=$("tracker-grid");
  grid.innerHTML="";
  pool.forEach(function(q,i){
    const t=document.createElement("div");
    t.className="tk-tile upcoming";
    t.id="tk-"+i;
    t.textContent=String(i+1);
    grid.appendChild(t);
  });
  $("side-panel").classList.add("visible");
  document.body.classList.add("has-panel");
  updateTracker();
}

function updateTracker(){
  var right=0, wrong=0;
  pool.forEach(function(q,i){
    const t=$("tk-"+i);
    if(!t) return;
    var cls="tk-tile ";
    if(results[i]){
      if(results[i].chosen===results[i].correct){ cls+="correct"; right++; }
      else { cls+="wrong"; wrong++; }
    } else if(i===idx){ cls+="current"; }
    else { cls+="upcoming"; }
    t.className=cls;
  });
  const counts=$("tk-counts");
  if(counts) counts.innerHTML='<span>せいかい <b style="color:var(--moss)">'+right+'</b></span>'
    +'<span>まちがい <b style="color:var(--clay)">'+wrong+'</b></span>';
  const cur=$("tk-"+idx);
  if(cur) cur.scrollIntoView({block:"nearest",behavior:"smooth"});
}

function hideTracker(){
  $("side-panel").classList.remove("visible");
  $("tracker-grid").innerHTML="";
  document.body.classList.remove("has-panel");
}

// ── Modal ─────────────────────────────────────────────────────
let modalResolveFn=null;
function openModal(title,msg,confirmLabel){
  $("modal-title").textContent=title;$("modal-msg").textContent=msg;
  $("modal-confirm").textContent=confirmLabel||"確認";
  show("modal");
  return new Promise(resolve=>{modalResolveFn=resolve;});
}
$("modal-cancel").onclick=()=>{hide("modal");if(modalResolveFn)modalResolveFn(false);};
$("modal-confirm").onclick=()=>{hide("modal");if(modalResolveFn)modalResolveFn(true);};

// ── Stats ─────────────────────────────────────────────────────
function defaultStats(){const s={totalRight:0,totalWrong:0,sessions:0};CATS.forEach(c=>{s[c]={right:0,wrong:0};});return s;}
function loadStats(){try{return JSON.parse(localStorage.getItem(cfg().statsKey))||defaultStats();}catch(e){return defaultStats();}}
function saveStats(s){try{localStorage.setItem(cfg().statsKey,JSON.stringify(s));}catch(e){}}
function recordSession(res){
  const s=loadStats();s.sessions++;
  res.forEach(r=>{const q=questions.find(x=>x.id===r.qId);const ok=r.chosen===r.correct;
    if(ok){s.totalRight++;s[q.cat].right++;}else{s.totalWrong++;s[q.cat].wrong++;}});
  saveStats(s);
}

// ── Menu ──────────────────────────────────────────────────────
function switchLevel(lv){currentLevel=lv;questions=[...ALL_SETS[lv][currentSet]];buildMenu();applyTheme();}
function switchSet(st){currentSet=st;questions=[...ALL_SETS[currentLevel][st]];buildMenu();applyTheme();}

function buildMenu(){
  const c=cfg(),g=$("menu-grid");g.innerHTML="";
  MENU_ITEMS.forEach(item=>{
    const count=item.key==="ALL"?questions.length:questions.filter(q=>q.cat===item.key).length;
    if(count===0)return;
    // ALL uses the theme's text colour (adapts light/dark); categories use
    // their fixed satoyama accent.
    const color=item.key==="ALL"?"var(--text)":CAT_COLOR[item.key];
    const btn=document.createElement("button");btn.className="menu-card";
    btn.style.borderLeft="4px solid "+color;
    btn.innerHTML='<span class="menu-icon">'+item.icon+'</span><div>'
      +'<div class="menu-label" style="color:'+color+'">'+item.label+'</div>'
      +'<div class="menu-desc">'+count+' 問</div></div>';
    btn.onclick=()=>startQuiz(item.key);
    g.appendChild(btn);
  });
  // Note: the old "成績 (cumulative history)" menu card was removed here —
  // redundant now that every session's results already show at the end
  // (showReview) and report to the hub (activity_results). showStats()
  // itself is left intact/unused rather than deleted, in case it's wanted
  // again later; only its entry point is gone.

  // Interview button — only for levels with a speaking component (3級 and up)
  if(currentLevel==='3'||currentLevel==='P'||currentLevel==='Q'||currentLevel==='2'){
    const ib=document.createElement("button");ib.className="menu-card";
    ib.style.borderLeft="4px solid #B5572E";
    ib.innerHTML='<span class="menu-icon">🎤</span><div>'
      +'<div class="menu-label" style="color:#B5572E">面接練習</div>'
      +'<div class="menu-desc">スピーキング / 10セッション</div></div>';
    ib.onclick=()=>{ if(typeof openInterviewMenu==='function') openInterviewMenu(); else console.error('[EikenApp] interview.js not loaded - openInterviewMenu undefined'); };
    g.appendChild(ib);
  }
}

function goMenu(){hideAll();hideTracker();show("menu-screen");}

// ── Quiz ──────────────────────────────────────────────────────
function startQuiz(cat){
  const filtered=cat==="ALL"?[...questions]:questions.filter(q=>q.cat===cat);
  if(filtered.length===0){alert("このセットにこのカテゴリーの問題はありません。");return;}
  pool=shuffle(filtered);idx=0;selected=null;answered=false;results=[];
  hideAll();show("quiz-screen");
  buildTracker();
  renderQuestion();
}

// Shuffled option order per question (rebuilt each render)
let _optOrder = [];

function renderQuestion(){
  const q=pool[idx];
  $("prog-bar").style.width=(((idx+1)/pool.length)*100)+"%";
  $("prog-text").textContent="問題 "+(idx+1)+" / "+pool.length;
  $("q-badge").textContent=CAT_LABEL[q.cat];
  $("q-badge").style.background=BADGE_BG[q.cat];
  $("q-badge").style.color=BADGE_FG[q.cat];
  $("q-text").textContent=q.q;

  // Shuffle option display order, keeping track of where correct ans ends up
  _optOrder = [0,1,2,3];
  for(let i=3;i>0;i--){const j=Math.floor(Math.random()*(i+1));[_optOrder[i],_optOrder[j]]=[_optOrder[j],_optOrder[i]];}

  const opts=$("opts");opts.innerHTML="";
  _optOrder.forEach(function(origIdx,displayPos){
    const btn=document.createElement("button");btn.className="opt-btn";
    btn.innerHTML='<span class="opt-letter">'+String.fromCharCode(65+displayPos)+'</span>'+escHtml(q.opts[origIdx]);
    btn.onclick=function(){handleSelect(displayPos);};
    opts.appendChild(btn);
  });
  _pendingOi=null;
  hide("feedback");hide("explanation");updateRunScore();
  updateTracker();
}

// Pending selection before confirm
let _pendingOi = null;

function handleSelect(oi){
  if(answered)return;
  const btns=$("opts").querySelectorAll(".opt-btn");
  // Second click on same option confirms it
  if(_pendingOi===oi){ commitAnswer(oi); return; }
  // First click — highlight, wait for second click
  _pendingOi=oi;
  btns.forEach(function(b,i){
    b.classList.remove("pending");
    b.style.borderColor=""; b.style.background="";
  });
  btns[oi].classList.add("pending");
  btns[oi].style.borderColor=cfg().accent;
  btns[oi].style.background=cfg().accentLight;
}

function commitAnswer(oi){
  if(answered)return;
  _pendingOi=null;
  selected=oi; answered=true;
  const q=pool[idx];
  const chosenOrigIdx=_optOrder[oi];
  const isCorrect=chosenOrigIdx===q.ans;
  const correctDisplayPos=_optOrder.indexOf(q.ans);
  results[idx]={qId:q.id,chosen:oi,correct:correctDisplayPos,origChosen:chosenOrigIdx,origCorrect:q.ans};
  $("opts").querySelectorAll(".opt-btn").forEach(function(b,i){
    b.classList.remove("pending"); b.style.borderColor=""; b.style.background="";
    b.classList.add("locked");
    if(i===correctDisplayPos)b.classList.add("correct");
    else if(i===oi&&!isCorrect)b.classList.add("wrong");
  });
  $("fb-text").textContent=isCorrect?"✅ 正解！":"❌ 正解は："+q.opts[q.ans];
  $("exp-text").textContent=q.exp;
  show("explanation");
  $("next-btn").textContent=idx+1>=pool.length?"結果を見る →":"次へ →";
  show("feedback"); updateRunScore(); updateTracker();
}

function nextQuestion(){
  if(idx+1>=pool.length){finishQuiz();return;}
  idx++;selected=null;answered=false;renderQuestion();
}
function updateRunScore(){
  var cor=Object.values(results).filter(r=>r.chosen===r.correct).length;
  var tot=Object.keys(results).length;
  var p=tot>0?Math.round(cor/tot*100):0;
  $("run-score").textContent="得点："+cor+" / "+tot+(tot>0?" ("+p+"%)":"");
}
async function quitQuiz(){
  if(Object.keys(results).length>0){
    var ok=await openModal("クイズを終了しますか？","現在の回答は成績に保存されますが、結果画面は表示されません。","終了する");
    if(!ok)return;recordSession(Object.values(results));
  }
  goMenu();
}
function finishQuiz(){recordSession(Object.values(results));showReview();}

// ── Review ────────────────────────────────────────────────────
function showReview(){
  hideAll();hideTracker();show("review-screen");
  const c=cfg();
  const res=Object.values(results);
  var cor=res.filter(r=>r.chosen===r.correct).length,tot=res.length,p=Math.round(cor/tot*100);
  $("rv-pct").textContent=p+"%";$("rv-pct").style.color=c.accent;
  $("rv-label").textContent=cor+" / "+tot;
  $("rv-circle").style.background="conic-gradient("+c.accent+" 0 "+p+"%, var(--mist) "+p+"% 100%)";
  $("rv-pass").classList.toggle("hidden", p<60); // 合格ライン 60%
  $("rv-grade").textContent=p>=80?"🎉 素晴らしい！":p>=60?"👍 よくできました！":"📚 もっと頑張りましょう！";
  var catData={};
  res.forEach(r=>{var q=questions.find(x=>x.id===r.qId);if(!catData[q.cat])catData[q.cat]={right:0,wrong:0};
    if(r.chosen===r.correct)catData[q.cat].right++;else catData[q.cat].wrong++;});
  var bd=$("rv-stats-breakdown");bd.innerHTML="";
  if(Object.keys(catData).length>1){
    var h='<div style="margin:0 0 12px"><h3 style="font-size:14px;font-weight:700;color:var(--text2);margin-bottom:8px">カテゴリー別の成績</h3>';
    CATS.forEach(cat=>{if(!catData[cat])return;var d=catData[cat],tot=d.right+d.wrong,pct=Math.round(d.right/tot*100);
      h+='<div class="stats-cat-card"><div class="stats-cat-row"><span class="stats-cat-name" style="color:'+CAT_COLOR[cat]+'">'+CAT_ICON[cat]+' '+CAT_LABEL[cat]+'</span>'
        +'<span class="stats-cat-nums">'+d.right+' / '+tot+' ('+pct+'%)</span></div>'
        +'<div class="stats-bar-track"><div class="stats-bar-correct" style="width:'+pct+'%;background:'+CAT_COLOR[cat]+';opacity:.7"></div></div></div>';});
    h+='</div>';bd.innerHTML=h;
  }
  var wrong=res.filter(r=>r.chosen!==r.correct);
  var sec=$("wrong-section");sec.innerHTML="";
  if(wrong.length>0){
    sec.innerHTML='<h3 class="wrong-title">まちがえた問題を見直そう ('+wrong.length+')</h3><div class="dot-rule"></div>';
    wrong.forEach(r=>{
      var q=questions.find(x=>x.id===r.qId);
      var card=document.createElement("div");card.className="wrong-card";
      card.innerHTML='<span class="badge" style="background:'+BADGE_BG[q.cat]+';color:'+BADGE_FG[q.cat]+'">'+CAT_LABEL[q.cat]+'</span>'
        +'<p class="wrong-q">'+escHtml(q.q)+'</p>'
        +'<div class="wrong-answers"><span class="wrong-you">✕ あなた：<s>'+escHtml(q.opts[r.origChosen])+'</s></span>'
        +'<span class="wrong-correct">○ せいかい：'+escHtml(q.opts[r.origCorrect])+'</span></div>'
        +'<p class="wrong-exp">解説：'+escHtml(q.exp)+'</p>';
      sec.appendChild(card);
    });
  }
}

// ── Stats screen ──────────────────────────────────────────────
function showStats(){
  hideAll();hideTracker();show("stats-screen");
  const c=cfg();
  $("stats-sub").textContent=c.label+" の通算成績";
  var s=loadStats(),tot=s.totalRight+s.totalWrong,pct=tot>0?Math.round(s.totalRight/tot*100):0;
  $("stats-overall").innerHTML=
    '<div class="stats-big"><div class="stats-big-num" style="color:'+c.accent+'">'+s.sessions+'</div><div class="stats-big-label">セッション数</div></div>'
    +'<div class="stats-big"><div class="stats-big-num" style="color:'+c.accent+'">'+tot+'</div><div class="stats-big-label">回答数</div></div>'
    +'<div class="stats-big"><div class="stats-big-num" style="color:'+c.accent+'">'+pct+'%</div><div class="stats-big-label">正答率</div></div>';
  var cc=$("stats-cats");cc.innerHTML="";
  if(tot===0){cc.innerHTML='<p style="text-align:center;color:var(--text3);padding:18px 0">まだデータがありません。</p>';return;}
  CATS.forEach(cat=>{
    var d=s[cat],t=d.right+d.wrong;if(t===0)return;
    var p=Math.round(d.right/t*100),wp=100-p;
    var card=document.createElement("div");card.className="stats-cat-card";
    card.innerHTML='<div class="stats-cat-row"><span class="stats-cat-name" style="color:'+CAT_COLOR[cat]+'">'+CAT_ICON[cat]+' '+CAT_LABEL[cat]+'</span>'
      +'<span class="stats-cat-nums">正解 '+d.right+' · 不正解 '+d.wrong+'</span></div>'
      +'<div class="stats-bar-track"><div class="stats-bar-correct" style="width:'+p+'%;background:'+CAT_COLOR[cat]+';opacity:.75"></div>'
      +'<div class="stats-bar-wrong" style="width:'+wp+'%;background:'+c.barWrong+'"></div></div>'
      +'<div class="stats-detail"><span>'+p+'% 正解</span><span>計 '+t+'問</span></div>';
    cc.appendChild(card);
  });
}
async function resetStatsConfirm(){
  var ok=await openModal("成績をリセットしますか？","「"+cfg().label+"」のすべての成績データが削除されます。","リセット");
  if(!ok)return;saveStats(defaultStats());showStats();
}

// ── Event wiring ──────────────────────────────────────────────
document.querySelectorAll(".level-tab").forEach(tab=>{
  tab.addEventListener("click",function(){switchLevel(this.getAttribute("data-level"));});
});
document.querySelectorAll(".set-tab").forEach(tab=>{
  tab.addEventListener("click",function(){switchSet(this.getAttribute("data-set"));});
});
$("next-btn").onclick=nextQuestion;
$("back-btn").onclick=goMenu;
$("quit-btn").onclick=quitQuiz;
$("stats-back-btn").onclick=goMenu;
$("stats-reset-btn").onclick=resetStatsConfirm;

// ── Init ──────────────────────────────────────────────────────
applyDark();
// Support ?level= URL shortcut (from manifest shortcuts)
const _urlLevel = new URLSearchParams(window.location.search).get('level');
const _validLevels = ['5','4','3','P','Q','2'];
switchLevel(_validLevels.includes(_urlLevel) ? _urlLevel : '5');