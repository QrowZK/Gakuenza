// Eiken Practice App — main application logic
'use strict';

// Category colours on the satoyama palette (matches the 1a mock's chips):
// 語い moss, 文法 blue, 会話 clay, 語順 taupe. Badge backgrounds are the tints.
const BADGE_BG={VOCAB:"#E8EDE6",GRAMMAR:"#E9EEF5",CONVERSATION:"#F7E8E1",ORDER:"#EFE9DB"};
const BADGE_FG={VOCAB:"#4A6B4F",GRAMMAR:"#4A6FA5",CONVERSATION:"#C9622A",ORDER:"#7A6A53"};
const CAT_LABEL={VOCAB:"語い",GRAMMAR:"文法",CONVERSATION:"会話",ORDER:"語順"};
const CAT_ICON={VOCAB:"📖",GRAMMAR:"✏️",CONVERSATION:"💬",ORDER:"🔤"};
const CAT_COLOR={VOCAB:"#4A6B4F",GRAMMAR:"#4A6FA5",CONVERSATION:"#C9622A",ORDER:"#7A6A53"};
const CATS=["VOCAB","GRAMMAR","CONVERSATION","ORDER"];
// Display order for the level-card grid, per-level blurbs, and which levels
// carry a speaking (面接) component.
const LEVEL_ORDER=["5","4","3","P","Q","2"];
const LEVEL_DESC={"5":"はじめての英検","4":"中学中級レベル","3":"中学卒業レベル · 面接あり","P":"高校中級レベル · 面接あり","Q":"高校中級＋ · 面接あり","2":"高校卒業レベル · 面接あり"};
const IV_LEVELS=["3","P","Q","2"];

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
// Readable foreground for text on an accent fill (ink on the light gold, paper on the rest).
function lum(hex){const h=hex.replace("#","");return (0.299*parseInt(h.slice(0,2),16)+0.587*parseInt(h.slice(2,4),16)+0.114*parseInt(h.slice(4,6),16))/255;}
function onAccent(hex){return lum(hex)>0.62?"#1C2530":"#F7F3EA";}
// Per-level question data helpers (the app has 3 sets × 4 categories per level).
function levelCount(lv){return ["1","2","3"].reduce((n,st)=>n+((ALL_SETS[lv]&&ALL_SETS[lv][st])?ALL_SETS[lv][st].length:0),0);}
function catPool(lv,cat){const out=[];["1","2","3"].forEach(st=>{(ALL_SETS[lv]&&ALL_SETS[lv][st]||[]).forEach(q=>{if(q.cat===cat)out.push(q);});});return out;}
function statsFor(lv){try{const s=JSON.parse(localStorage.getItem(LEVEL_CFG[lv].statsKey));return s?{right:s.totalRight||0,wrong:s.totalWrong||0,sessions:s.sessions||0}:{right:0,wrong:0,sessions:0};}catch(e){return {right:0,wrong:0,sessions:0};}}

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
  document.body.style.setProperty("--lvl-accent", c.accent);
  document.body.style.setProperty("--lvl-accent-light", c.accentLight);
  const nb=$("next-btn"); if(nb){nb.style.background=c.accent; nb.style.color=on;}
  const pb=$("prog-bar"); if(pb) pb.style.background="linear-gradient(90deg,"+c.accent+","+c.accentMid+")";
  const mc=$("modal-confirm"); if(mc){mc.style.background=c.accent; mc.style.color=on;}
}

// ── Side panel tracker ────────────────────────────────────────
function buildTracker(){
  const grid=$("tracker-grid");
  grid.innerHTML="";
  // Set CSS custom property for current accent colour
  $("side-panel").style.setProperty("--accent-color", cfg().accent);
  // Row per question: num + 4 option cells (A B C D)
  pool.forEach(function(q,i){
    // row number
    const num=document.createElement("div");
    num.className="tracker-row-num";
    num.textContent=String(i+1).padStart(2,"0");
    grid.appendChild(num);
    // 4 option cells
    q.opts.forEach(function(opt,oi){
      const cell=document.createElement("div");
      cell.className="tracker-cell";
      cell.id="tc-"+i+"-"+oi;
      cell.textContent=oi+1;
      cell.title=opt;
      grid.appendChild(cell);
    });
  });
  $("panel-title").textContent=cfg().label+" 進捗";
  $("side-panel").classList.add("visible");
  document.body.classList.add("has-panel");
}

function updateTracker(){
  pool.forEach(function(q,i){
    q.opts.forEach(function(opt,oi){
      const cell=$("tc-"+i+"-"+oi);
      if(!cell) return;
      // reset
      cell.className="tracker-cell";
      // current row highlight
      if(i===idx) cell.classList.add("current-row");
      // answered
      if(results[i]){
        const chosen=results[i].chosen;
        const correct=results[i].correct;
        if(oi===chosen && chosen===correct) cell.classList.add("chosen-correct");
        else if(oi===chosen && chosen!==correct) cell.classList.add("chosen-wrong");
      }
    });
  });
  // scroll current row into view
  const cur=$("tc-"+idx+"-0");
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

// ── Menu (1a: level-card grid + set list + category chips) ────
function switchLevel(lv){
  currentLevel=lv;
  questions=[...ALL_SETS[lv][currentSet]];
  buildLevelCards(); buildSetList(); buildChips(); buildIvCta(); applyTheme();
}

// Level picker — one color-topped card per 級, with a real progress bar
// (cumulative accuracy from that level's saved stats; no fabricated data).
function buildLevelCards(){
  const wrap=$("level-cards"); wrap.innerHTML="";
  LEVEL_ORDER.forEach(lv=>{
    const cf=LEVEL_CFG[lv], s=statsFor(lv), tot=s.right+s.wrong, pct=tot?Math.round(s.right/tot*100):0;
    const card=document.createElement("button");
    card.className="level-card"+(lv===currentLevel?" active":"");
    card.style.borderTopColor=cf.accent;
    card.innerHTML=
      '<div class="lc-num" style="color:'+cf.accent+'">'+cf.label+'</div>'
      +'<div class="lc-desc">'+LEVEL_DESC[lv]+'</div>'
      +'<div class="lc-meta">全3セット · '+levelCount(lv)+'問</div>'
      +'<div class="lc-bar"><div class="lc-bar-fill" style="width:'+pct+'%;background:'+cf.accent+'"></div></div>'
      +'<div class="lc-prog" style="color:'+cf.accentDark+'">'+(tot?('通算せいかい率 '+pct+'%'):'まだ挑戦していません')+'</div>';
    card.onclick=()=>switchLevel(lv);
    wrap.appendChild(card);
  });
}

// Set list — the active level's 3 sets; a row starts that whole set.
function buildSetList(){
  const list=$("set-list"); list.innerHTML="";
  $("set-panel-title").textContent=cfg().label+" · セットをえらぶ";
  $("set-count").textContent="3セット";
  ["1","2","3"].forEach(st=>{
    const n=(ALL_SETS[currentLevel][st]||[]).length;
    const row=document.createElement("button");
    row.className="set-row";
    row.innerHTML='<span class="sr-name">セット '+st+'</span>'
      +'<span class="sr-meta">全'+n+'問</span>'
      +'<span class="sr-go" style="color:'+cfg().accent+'">はじめる →</span>';
    row.onclick=()=>startSetQuiz(st);
    list.appendChild(row);
  });
}

// Category chips — level-wide practice for one category (across all 3 sets).
function buildChips(){
  const box=$("cat-chips"); box.innerHTML="";
  CATS.forEach(cat=>{
    const pool=catPool(currentLevel,cat);
    if(!pool.length) return;
    const chip=document.createElement("button");
    chip.className="chip";
    chip.innerHTML='<span class="chip-dot" style="background:'+CAT_COLOR[cat]+'"></span>'
      +CAT_LABEL[cat]+'<span class="chip-n">'+pool.length+'</span>';
    chip.onclick=()=>startCategoryQuiz(cat);
    box.appendChild(chip);
  });
}

function buildIvCta(){
  const cta=$("iv-cta");
  cta.style.display=IV_LEVELS.includes(currentLevel)?"":"none";
}

function startSetQuiz(st){
  currentSet=st;
  questions=[...ALL_SETS[currentLevel][st]];
  startQuiz("ALL");
}
function startCategoryQuiz(cat){
  questions=catPool(currentLevel,cat); // all same-category questions; stats attribution stays correct
  startQuiz("ALL");
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
  $("rv-circle").style.background="conic-gradient("+c.accent+" 0 "+p+"%, #E4E0D4 "+p+"% 100%)";
  $("rv-circle").style.borderColor="transparent";
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
    sec.innerHTML='<h3 class="wrong-title" style="color:'+c.accent+'">間違えた問題 ('+wrong.length+')</h3>';
    wrong.forEach(r=>{
      var q=questions.find(x=>x.id===r.qId);
      var card=document.createElement("div");card.className="wrong-card";
      card.innerHTML='<span class="badge" style="background:'+BADGE_BG[q.cat]+';color:'+BADGE_FG[q.cat]+'">'+CAT_LABEL[q.cat]+'</span>'
        +'<p class="wrong-q">'+escHtml(q.q)+'</p>'
        +'<p style="font-size:13px;color:var(--text2)">あなたの回答：<span style="color:'+c.accent+'">'+escHtml(q.opts[r.origChosen])+'</span></p>'
        +'<p style="font-size:13px;color:var(--text2);margin-top:2px">正解：<span style="color:'+c.accent+';font-weight:700">'+escHtml(q.opts[r.origCorrect])+'</span></p>'
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
$("iv-cta-btn").onclick=()=>{ if(typeof openInterviewMenu==='function') openInterviewMenu(); else console.error('[EikenApp] interview.js not loaded'); };
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