// kanken4-generators.js — 漢検4級の各出題形式の問題を、検証済みデータ
// (kanken4-data.js の313字 + kanken4-content.js の原作バンク) から毎回
// 生成する。固定問題バンクではないので「いずれ底をつく」問題がない。
//
// 各ジェネレータは次の形の1問を返す:
//   { itemRef, category, prompt, note?, options:[...], correctAnswer }
// options は文字列配列（4択が基本。熟語の構成のみ5択）。
//
// 4級は9出題形式。3級の8形式（読み・書き取り・熟語の構成・対義語/類義語・
// 四字熟語・送り仮名・同音同訓異字・部首）に加え、本級から「誤字訂正」が入る。
// 協会の「各級の概要」に無い 漢字識別・筆順/画数 は 4級では出さない（前者は
// 一部の市販3級問題集、後者は5級の公式範囲で、隣接級からの思い込みで持ち込ま
// ない）。
//
// 配布時の最重要規約: 「誤答が実は正答でもある」衝突を作らないこと。この
// プロジェクトでは kokugo3 の漢字ジェネレータで同種のバグを2度出荷している
// (画数の重複で選択肢が4未満になる／同音の漢字が誤答に紛れて実は正しい)。
// そのため各ジェネレータは (1) 選択肢が既定数ちょうど (2) 全て相異なる
// (3) 正答が選択肢に含まれる ことを構造的に保証し、別途 stress-test でも
// 大量生成して機械チェックする。同音・同訓異字／誤字訂正／部首は特に collision
// が起きやすいので、誤答が答えの語を成立させない形で人手検証済みのデータのみ
// を使う（誤字訂正の各文は、正答以外の同音字を入れても文が成立しないことを確認済）。

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
      itemRef: `kanken4/yomi/${w.w}`,
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
      itemRef: `kanken4/kakitori/${w.w}`,
      category: '書き取り',
      prompt: `次の読みを漢字で書くとどれですか。\n\n「${w.r}」`,
      options,
      correctAnswer: w.w,
    };
  }

  // ── 部首・部首名 — 漢字の部首を選ぶ ────────────────────────────────
  function genBushu(C, K) {
    const b = pick(C.bushu);
    const label = (e) => `${e.rad}（${e.name}）`;
    // Distractors must have a DIFFERENT radical CHARACTER from the answer AND
    // from each other — the same radical (e.g. 金) can legitimately carry two
    // names (かね / かねへん) across different kanji, and offering both as
    // options would be a collision. Dedupe the pool by radical char. (This
    // exact "same radical, two labels" case was caught by kanken3's stress
    // test — 金/かねへん and 金/かね, 火/ひへん and 火/ひ, etc.)
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
      itemRef: `kanken4/bushu/${b.k}`,
      category: '部首・部首名',
      prompt: `「${b.k}」の部首をえらびなさい。`,
      options,
      correctAnswer: label(b),
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
      itemRef: `kanken4/okuri/${o.stem}`,
      category: '送り仮名',
      prompt: `「${o.r}」（${o.gloss}）を漢字と送り仮名で正しく書いたものをえらびなさい。`,
      options: shuffle(options.slice(0, 4)),
      correctAnswer: correct,
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
      itemRef: `kanken4/${isAnt ? 'antonym' : 'synonym'}/${p.a}`,
      category: isAnt ? '対義語' : '類義語',
      prompt: `「${p.a}（${p.ar}）」の${isAnt ? '対義語' : '類義語'}をえらびなさい。`,
      options,
      correctAnswer: p.b,
    };
  }

  // ── 同音・同訓異字 — 読みは同じだが意味の違う漢字を選ぶ ───────────
  function genDoon(C, K) {
    const d = pick(C.doon);
    const phrase = d.phrase.replace('◯', '（　）');
    const options = shuffle([d.ans, ...d.dis]);
    return {
      itemRef: `kanken4/doon/${d.ans}/${d.read}`,
      category: '同音・同訓異字',
      prompt: `次の（　）に入る、読みが「${d.read}」の漢字をえらびなさい。\n\n${phrase}`,
      options,
      correctAnswer: d.ans,
    };
  }

  // ── 誤字訂正 — 文中で誤って使われている同音の漢字を正しく直す ─────
  // 4級から加わる形式。文には【】で示した誤字が一つあり、これを正しい漢字に
  // 直す。選択肢は「正しい漢字」＋「同じ読みだがこの文には当てはまらない漢字」で
  // 構成する。誤字そのもの（g.wrong）は文中に見えているので選択肢には入れない。
  function genGoji(C, K) {
    const g = pick(C.goji);
    const options = shuffle([g.ans, ...g.dis]);
    return {
      itemRef: `kanken4/goji/${g.ans}`,
      category: '誤字訂正',
      prompt: `次の文には、【　】の中に誤って使われている漢字が一つあります。`
        + `正しい漢字をえらびなさい。\n\n${g.sentence}`,
      options,
      correctAnswer: g.ans,
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
      itemRef: `kanken4/yoji/${y.w}`,
      category: '四字熟語',
      prompt: `次の四字熟語の◯に入る漢字をえらびなさい。\n\n「${shown}」（${y.r}）\n${y.gloss}`,
      options,
      correctAnswer: y.ans,
    };
  }

  // ── 熟語の構成 — 二字熟語の組み立て方を5択から選ぶ ─────────────────
  function genKosei(C, K) {
    const w = pick(C.words);
    const L = C.koseiLabels;
    // authentic 5-option order (ア〜オ)
    const options = [L.similar, L.opposite, L.modifier, L.object, L.negation];
    return {
      itemRef: `kanken4/kosei/${w.w}`,
      category: '熟語の構成',
      prompt: `次の熟語は、どのような組み立てになっていますか。\n\n「${w.w}」（${w.r}）`,
      options,
      correctAnswer: L[w.kosei],
    };
  }

  // Category registry — key, JP label, generator, and how many unique items
  // exist (used to cap single-category quiz length sensibly). Order follows
  // the 協会 official 4級 category listing (読み → 熟語の構成).
  const CATEGORIES = [
    { key: 'yomi',     label: '読み',           gen: genYomi,     size: (C) => C.words.length },
    { key: 'kakitori', label: '書き取り',       gen: genKakitori, size: (C) => C.words.length },
    { key: 'bushu',    label: '部首・部首名',   gen: genBushu,    size: (C) => C.bushu.length },
    { key: 'okuri',    label: '送り仮名',       gen: genOkuri,    size: (C) => C.okuri.length },
    { key: 'pair',     label: '対義語・類義語', gen: genPair,     size: (C) => C.pairs.length },
    { key: 'doon',     label: '同音・同訓異字', gen: genDoon,     size: (C) => C.doon.length },
    { key: 'goji',     label: '誤字訂正',       gen: genGoji,     size: (C) => C.goji.length },
    { key: 'yoji',     label: '四字熟語',       gen: genYoji,     size: (C) => C.yoji.length },
    { key: 'kosei',    label: '熟語の構成',     gen: genKosei,    size: (C) => C.words.length },
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

  global.Kanken4Gen = { generateQuiz, CATEGORIES,
    _gens: { genYomi, genKakitori, genBushu, genOkuri, genPair, genDoon, genGoji, genYoji, genKosei } };

  if (typeof module !== 'undefined') {
    module.exports = global.Kanken4Gen;
  }
})(typeof window !== 'undefined' ? window : globalThis);
