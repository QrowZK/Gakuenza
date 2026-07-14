// kanken3-generators.js — 漢検3級の各出題形式の問題を、検証済みデータ
// (kanken3-data.js の284字 + kanken3-content.js の原作バンク) から毎回
// 生成する。固定問題バンクではないので「いずれ底をつく」問題がない。
//
// 各ジェネレータは次の形の1問を返す:
//   { itemRef, category, prompt, note?, options:[...], correctAnswer }
// options は文字列配列（4択が基本。熟語の構成のみ5択）。
//
// 配布時の最重要規約: 「誤答が実は正答でもある」衝突を作らないこと。この
// プロジェクトでは kokugo3 の漢字ジェネレータで同種のバグを2度出荷している
// (画数の重複で選択肢が4未満になる／同音の漢字が誤答に紛れて実は正しい)。
// そのため各ジェネレータは (1) 選択肢が既定数ちょうど (2) 全て相異なる
// (3) 正答が選択肢に含まれる ことを構造的に保証し、別途 stress-test でも
// 大量生成して機械チェックする。同音・同訓異字/部首は特に collision が
// 起きやすいので、誤答が答えの語を成立させない形で人手検証済みのデータのみ
// を使う。

(function (global) {
  'use strict';

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function sampleDistinct(pool, n, exclude) {
    // returns up to n distinct strings from pool, none equal to any in exclude set
    const seen = new Set(exclude || []);
    const out = [];
    for (const x of shuffle(pool)) {
      if (out.length >= n) break;
      if (!seen.has(x)) { seen.add(x); out.push(x); }
    }
    return out;
  }

  // ── 読み — 語を示し、正しい読みを選ぶ ────────────────────────────────
  function genYomi(C, K) {
    const w = pick(C.words);
    const distractors = sampleDistinct(
      C.words.map(x => x.r), 3, [w.r]
    );
    const options = shuffle([w.r, ...distractors]);
    return {
      itemRef: `kanken3/yomi/${w.w}`,
      category: '読み',
      prompt: `次の熟語の読みをえらびなさい。\n\n「${w.w}」`,
      options,
      correctAnswer: w.r,
    };
  }

  // ── 書き取り — 読みを示し、正しい漢字表記を選ぶ ─────────────────────
  function genKakitori(C, K) {
    const w = pick(C.words);
    // distractor words must not share the same reading (else ambiguous)
    const pool = C.words.filter(x => x.r !== w.r).map(x => x.w);
    const distractors = sampleDistinct(pool, 3, [w.w]);
    const options = shuffle([w.w, ...distractors]);
    return {
      itemRef: `kanken3/kakitori/${w.w}`,
      category: '書き取り',
      prompt: `次の読みを漢字で書くとどれですか。\n\n「${w.r}」`,
      options,
      correctAnswer: w.w,
    };
  }

  // ── 熟語の構成 — 二字熟語の組み立て方を5択から選ぶ ─────────────────
  function genKosei(C, K) {
    const w = pick(C.words);
    const L = C.koseiLabels;
    // authentic 5-option order (ア〜オ)
    const options = [L.similar, L.opposite, L.modifier, L.object, L.negation];
    return {
      itemRef: `kanken3/kosei/${w.w}`,
      category: '熟語の構成',
      prompt: `次の熟語は、どのような組み立てになっていますか。\n\n「${w.w}」（${w.r}）`,
      options,
      correctAnswer: L[w.kosei],
    };
  }

  // ── 対義語・類義語 ──────────────────────────────────────────────────
  function genPair(C, K) {
    const p = pick(C.pairs);
    const isAnt = p.rel === 'antonym';
    // distractors drawn from other pair words (both sides), never = answer,
    // and excluding the prompt word a (so a isn't offered as its own pair)
    const poolWords = [];
    C.pairs.forEach(x => { poolWords.push(x.a, x.b); });
    const distractors = sampleDistinct(poolWords, 3, [p.b, p.a]);
    const options = shuffle([p.b, ...distractors]);
    return {
      itemRef: `kanken3/${isAnt ? 'antonym' : 'synonym'}/${p.a}`,
      category: isAnt ? '対義語' : '類義語',
      prompt: `「${p.a}（${p.ar}）」の${isAnt ? '対義語' : '類義語'}をえらびなさい。`,
      options,
      correctAnswer: p.b,
    };
  }

  // ── 四字熟語 — 空欄に入る漢字を選ぶ ────────────────────────────────
  function genYoji(C, K) {
    const y = pick(C.yoji);
    const shown = y.w.split('').map((c, i) => (i === y.blank ? '◯' : c)).join('');
    // distractors: other yoji answer kanji + random target kanji, never = ans,
    // and never a kanji already visible in this idiom
    const visible = new Set(y.w.split(''));
    const pool = C.yoji.map(x => x.ans).concat(K.map(x => x.k));
    const distractors = sampleDistinct(
      pool.filter(c => !visible.has(c)), 3, [y.ans]
    );
    const options = shuffle([y.ans, ...distractors]);
    return {
      itemRef: `kanken3/yoji/${y.w}`,
      category: '四字熟語',
      prompt: `次の四字熟語の◯に入る漢字をえらびなさい。\n\n「${shown}」（${y.r}）\n${y.gloss}`,
      options,
      correctAnswer: y.ans,
    };
  }

  // ── 送り仮名 — 正しい漢字＋送り仮名の書き方を選ぶ ─────────────────
  function genOkuri(C, K) {
    const o = pick(C.okuri);
    const L = o.r.length;
    const form = (split) => o.stem + o.r.slice(split);      // kanji + okurigana
    const correct = form(o.split);
    // kanji-form distractors: nearby boundary shifts (all invalid spellings)
    const cand = [];
    [o.split - 2, o.split - 1, o.split + 1, o.split + 2].forEach(s => {
      if (s >= 1 && s <= L && s !== o.split) cand.push(form(s));
    });
    const kanjiDistractors = sampleDistinct(cand, 2, [correct]);
    // + the all-hiragana form (never uses the kanji → unambiguously wrong)
    const options = [correct, ...kanjiDistractors];
    if (!options.includes(o.r)) options.push(o.r);
    // top up if a short reading left us under 4 (rare)
    let s = 1;
    while (options.length < 4 && s <= L) {
      const f = form(s);
      if (!options.includes(f)) options.push(f);
      s++;
    }
    return {
      itemRef: `kanken3/okuri/${o.stem}`,
      category: '送り仮名',
      prompt: `「${o.r}」（${o.gloss}）を漢字と送り仮名で正しく書いたものをえらびなさい。`,
      options: shuffle(options.slice(0, 4)),
      correctAnswer: correct,
    };
  }

  // ── 同音・同訓異字 — 読みは同じだが意味の違う漢字を選ぶ ───────────
  function genDoon(C, K) {
    const d = pick(C.doon);
    const phrase = d.phrase.replace('◯', '（　）');
    const options = shuffle([d.ans, ...d.dis]);
    return {
      itemRef: `kanken3/doon/${d.ans}/${d.read}`,
      category: '同音・同訓異字',
      prompt: `次の（　）に入る、読みが「${d.read}」の漢字をえらびなさい。\n\n${phrase}`,
      options,
      correctAnswer: d.ans,
    };
  }

  // ── 部首 — 漢字の部首を選ぶ ────────────────────────────────────────
  function genBushu(C, K) {
    const b = pick(C.bushu);
    const label = (e) => `${e.rad}（${e.name}）`;
    // Distractors must have a DIFFERENT radical CHARACTER from the answer AND
    // from each other — the same radical (e.g. 木) can legitimately carry two
    // names (き / きへん) across different kanji, and offering both as options
    // would be a collision. Dedupe the pool by radical char. (This exact
    // "same radical, two labels" case was caught by the stress test.)
    const seenRad = new Set([b.rad]);
    const distractors = [];
    for (const e of shuffle(C.bushu)) {
      if (distractors.length >= 3) break;
      if (seenRad.has(e.rad)) continue;
      seenRad.add(e.rad);
      distractors.push(label(e));
    }
    const options = shuffle([label(b), ...distractors]);
    return {
      itemRef: `kanken3/bushu/${b.k}`,
      category: '部首',
      prompt: `「${b.k}」の部首をえらびなさい。`,
      options,
      correctAnswer: label(b),
    };
  }

  // Category registry — key, JP label, generator, and how many unique items
  // exist (used to cap single-category quiz length sensibly).
  const CATEGORIES = [
    { key: 'yomi',     label: '読み',           gen: genYomi,     size: (C) => C.words.length },
    { key: 'kakitori', label: '書き取り',       gen: genKakitori, size: (C) => C.words.length },
    { key: 'kosei',    label: '熟語の構成',     gen: genKosei,    size: (C) => C.words.length },
    { key: 'pair',     label: '対義語・類義語', gen: genPair,     size: (C) => C.pairs.length },
    { key: 'yoji',     label: '四字熟語',       gen: genYoji,     size: (C) => C.yoji.length },
    { key: 'okuri',    label: '送り仮名',       gen: genOkuri,    size: (C) => C.okuri.length },
    { key: 'doon',     label: '同音・同訓異字', gen: genDoon,     size: (C) => C.doon.length },
    { key: 'bushu',    label: '部首',           gen: genBushu,    size: (C) => C.bushu.length },
  ];

  function generateQuiz(C, K, categoryKey, count) {
    const cats = categoryKey && categoryKey !== 'mix'
      ? CATEGORIES.filter(c => c.key === categoryKey)
      : CATEGORIES;
    const n = count || 10;
    const out = [];
    // avoid two identical prompts back-to-back where the pool allows it
    let guard = 0;
    while (out.length < n && guard < n * 40) {
      guard++;
      const cat = pick(cats);
      const q = cat.gen(C, K);
      if (out.length && out[out.length - 1].prompt === q.prompt) continue;
      out.push(q);
    }
    return out;
  }

  global.Kanken3Gen = { generateQuiz, CATEGORIES,
    _gens: { genYomi, genKakitori, genKosei, genPair, genYoji, genOkuri, genDoon, genBushu } };

  if (typeof module !== 'undefined') {
    module.exports = global.Kanken3Gen;
  }
})(typeof window !== 'undefined' ? window : globalThis);
