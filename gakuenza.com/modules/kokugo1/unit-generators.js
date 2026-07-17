// unit-generators.js — procedural generators for the grade-1 かな / 助詞 /
// 句読点 units (templated on kokugo3's grammar-generators.js). Grade 1 is the
// early-literacy grade, so the centre of gravity is かな, not kanji.
//
// COLLISION DISCIPLINE (kokugo3's kanji generator shipped the "a wrong option
// is secretly also correct" bug TWICE): every unit here is built so that, by
// construction, a distractor can NEVER also be a valid answer:
//   - gojuon matching: each sound maps to exactly ONE kana, so any other kana
//     is a different sound and cannot also be correct.
//   - 濁音/半濁音: each (base, mark) pair maps to exactly one kana.
//   - spelling (促音・拗音・長音 / カタカナ): the prompt fixes ONE target word
//     via a meaning gloss; only that word's exact spelling is correct and every
//     distractor is an authored mis-spelling that is a different string (never
//     an alternate spelling of the same word).
//   - 助詞 は/を/へ: distractors are drawn ONLY from the phonetic-twin kana
//     {わ, お, え}, which are never grammatical particles in these fixed
//     positions — so は is never offered where topicalisation could also be
//     valid, and exactly one option is right.
//   - 句読点・かぎ: each item's blank has exactly one correct mark by authoring;
//     pause (、) items use て-form clauses where ending with 。 is ungrammatical,
//     and かぎ items show the paired bracket so the blank is unambiguous.
// unit-generators.test.js stress-tests all four at scale and asserts this holds.
(function () {
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
    const out = [];
    const src = shuffle(pool.filter(x => x !== exclude));
    for (const x of src) { if (out.length >= n) break; if (!out.includes(x)) out.push(x); }
    return out;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Kana tables
  // ══════════════════════════════════════════════════════════════════════
  // 五十音 base (46) — each sound maps to exactly one hiragana and one katakana.
  const GOJUON = [
    { h:'あ', k:'ア' }, { h:'い', k:'イ' }, { h:'う', k:'ウ' }, { h:'え', k:'エ' }, { h:'お', k:'オ' },
    { h:'か', k:'カ' }, { h:'き', k:'キ' }, { h:'く', k:'ク' }, { h:'け', k:'ケ' }, { h:'こ', k:'コ' },
    { h:'さ', k:'サ' }, { h:'し', k:'シ' }, { h:'す', k:'ス' }, { h:'せ', k:'セ' }, { h:'そ', k:'ソ' },
    { h:'た', k:'タ' }, { h:'ち', k:'チ' }, { h:'つ', k:'ツ' }, { h:'て', k:'テ' }, { h:'と', k:'ト' },
    { h:'な', k:'ナ' }, { h:'に', k:'ニ' }, { h:'ぬ', k:'ヌ' }, { h:'ね', k:'ネ' }, { h:'の', k:'ノ' },
    { h:'は', k:'ハ' }, { h:'ひ', k:'ヒ' }, { h:'ふ', k:'フ' }, { h:'へ', k:'ヘ' }, { h:'ほ', k:'ホ' },
    { h:'ま', k:'マ' }, { h:'み', k:'ミ' }, { h:'む', k:'ム' }, { h:'め', k:'メ' }, { h:'も', k:'モ' },
    { h:'や', k:'ヤ' }, { h:'ゆ', k:'ユ' }, { h:'よ', k:'ヨ' },
    { h:'ら', k:'ラ' }, { h:'り', k:'リ' }, { h:'る', k:'ル' }, { h:'れ', k:'レ' }, { h:'ろ', k:'ロ' },
    { h:'わ', k:'ワ' }, { h:'を', k:'ヲ' }, { h:'ん', k:'ン' },
  ];
  const ALL_HIRA = GOJUON.map(e => e.h);
  const ALL_KATA = GOJUON.map(e => e.k);

  // 濁音 — (清音 base) + ゛ maps to exactly one 濁音 kana.
  const DAKUTEN = [
    { base:'か', d:'が' }, { base:'き', d:'ぎ' }, { base:'く', d:'ぐ' }, { base:'け', d:'げ' }, { base:'こ', d:'ご' },
    { base:'さ', d:'ざ' }, { base:'し', d:'じ' }, { base:'す', d:'ず' }, { base:'せ', d:'ぜ' }, { base:'そ', d:'ぞ' },
    { base:'た', d:'だ' }, { base:'ち', d:'ぢ' }, { base:'つ', d:'づ' }, { base:'て', d:'で' }, { base:'と', d:'ど' },
    { base:'は', d:'ば' }, { base:'ひ', d:'び' }, { base:'ふ', d:'ぶ' }, { base:'へ', d:'べ' }, { base:'ほ', d:'ぼ' },
  ];
  // 半濁音 — (は行 base) + ゜ maps to exactly one 半濁音 kana.
  const HANDAKUTEN = [
    { base:'は', d:'ぱ' }, { base:'ひ', d:'ぴ' }, { base:'ふ', d:'ぷ' }, { base:'へ', d:'ぺ' }, { base:'ほ', d:'ぽ' },
  ];
  const ALL_DAKU = DAKUTEN.map(e => e.d);
  const ALL_HANDAKU = HANDAKUTEN.map(e => e.d);

  // ── word banks for spelling (促音・拗音・長音 / カタカナ長音) ──────────────
  // Each entry fixes ONE target word by a meaning gloss (never by naming the
  // word), so only its exact spelling is correct. `wrong` are authored
  // mis-spellings — each is a different string from the target and from every
  // other option, and is NOT an alternate valid spelling of the same word.
  const HIRA_WORDS = [
    { w:'らっぱ',   gloss:'ふいて おとを ならす がっき', wrong:['らつぱ', 'らぱ', 'らっば'] },
    { w:'きって',   gloss:'てがみに はって ゆうびんで おくる もの', wrong:['きつて', 'きて', 'きっで'] },
    { w:'きっぷ',   gloss:'でんしゃや バスに のる ときに いる もの', wrong:['きつぷ', 'きぷ', 'きっふ'] },
    { w:'がっこう', gloss:'みんなで あつまって べんきょうする ところ', wrong:['がつこう', 'がこう', 'がっこ'] },
    { w:'きんぎょ', gloss:'あかい いろの、はちで かって たのしむ さかな', wrong:['きんぎよ', 'きんぎゃ', 'きんじょ'] },
    { w:'でんしゃ', gloss:'レールの うえを はしる のりもの', wrong:['でんしや', 'でんちゃ', 'でんじゃ'] },
    { w:'おもちゃ', gloss:'こどもが あそぶ ための どうぐ', wrong:['おもちや', 'おもしゃ', 'おもちゅ'] },
    { w:'しゃしん', gloss:'カメラで うつした え', wrong:['しやしん', 'さしん', 'しゃしゅん'] },
    { w:'おかあさん', gloss:'かぞくの おんなのひと。ママの こと', wrong:['おかさん', 'おかーさん', 'おかあさ'] },
    { w:'おにいさん', gloss:'じぶんより としうえの おとこの きょうだい', wrong:['おにさん', 'おにーさん', 'おにいさ'] },
    { w:'こおり',   gloss:'みずが つめたく こおって かたく なった もの', wrong:['こうり', 'こり', 'こおーり'] },
    { w:'とおい',   gloss:'きょりが たくさん ある ようす。ちかいの はんたい', wrong:['とうい', 'とい', 'とおーい'] },
  ];
  const KATA_WORDS = [
    { w:'ケーキ',   gloss:'たんじょうびに たべる、あまい おかし', wrong:['ケエキ', 'ケキ', 'ケーク'] },
    { w:'ラーメン', gloss:'スープに めんが はいった、あたたかい たべもの', wrong:['ラメン', 'ラーメソ', 'ラーメ'] },
    { w:'ノート',   gloss:'じや えを かく ための ちょうめん', wrong:['ノオト', 'ノト', 'ノード'] },
    { w:'プール',   gloss:'みずを ためて、およいで あそぶ ところ', wrong:['プウル', 'プル', 'プーリ'] },
    { w:'コップ',   gloss:'みずや ジュースを のむ ときに つかう いれもの', wrong:['コツプ', 'コプ', 'コッブ'] },
    { w:'バナナ',   gloss:'きいろくて ながい、あまい くだもの', wrong:['パナナ', 'バナ', 'ハナナ'] },
    { w:'ジュース', gloss:'くだものなどで つくった、あまい のみもの', wrong:['ジユース', 'シュース', 'ジュウス'] },
    { w:'テレビ',   gloss:'ばんぐみや アニメを うつして みる きかい', wrong:['デレビ', 'テレヒ', 'テルビ'] },
    { w:'ロボット', gloss:'にんげんの かわりに うごいて はたらく きかい', wrong:['ロボツト', 'ロボト', 'ロホット'] },
    { w:'パン',     gloss:'こむぎこを やいて つくる、まるや しかくの たべもの', wrong:['バン', 'ハン', 'パソ'] },
  ];

  // ── 助詞 は・を・へ ────────────────────────────────────────────────────
  // Each sentence's blank takes exactly one of は/を/へ. Distractors come ONLY
  // from {わ, お, え} — the phonetic twins that grade-1 learners wrongly write
  // for these particles. None of わ/お/え is ever a grammatical particle in
  // these positions, so exactly one option is correct and the pedagogical trap
  // (the twin) is always present.
  const JOSHI_TWINS = ['わ', 'お', 'え'];
  const JOSHI_SENTENCES = [
    { id:'s01', particle:'は', text:'わたし＿ いちねんせいです。' },
    { id:'s02', particle:'は', text:'そら＿ とても あおい。' },
    { id:'s03', particle:'は', text:'これ＿ ぼくの ほんです。' },
    { id:'s04', particle:'は', text:'きょう＿ いい てんきです。' },
    { id:'s05', particle:'は', text:'いもうと＿ げんきです。' },
    { id:'s06', particle:'を', text:'ごはん＿ たべる。' },
    { id:'s07', particle:'を', text:'ほん＿ よむ。' },
    { id:'s08', particle:'を', text:'え＿ かく。' },
    { id:'s09', particle:'を', text:'みず＿ のむ。' },
    { id:'s10', particle:'を', text:'うた＿ うたう。' },
    { id:'s11', particle:'へ', text:'がっこう＿ いく。' },
    { id:'s12', particle:'へ', text:'うみ＿ いく。' },
    { id:'s13', particle:'へ', text:'いえ＿ かえる。' },
    { id:'s14', particle:'へ', text:'こうえん＿ あるく。' },
    { id:'s15', particle:'へ', text:'やま＿ のぼる。' },
  ];

  // ── 句読点・かぎ ────────────────────────────────────────────────────────
  // Options are always the four marks 。/、/「/」. Each item's blank has exactly
  // one correct mark by authoring:
  //   - kuten: a complete declarative sentence ends → only 。
  //   - touten: a て-form clause continues → only 、 (ending with 。 after a
  //     て-form is ungrammatical; 「」 don't fit).
  //   - kagi_open / kagi_close: the paired bracket is shown literally, so the
  //     blank is unambiguously the opening 「 or the closing 」.
  const KUTOUTEN_MARKS = ['。', '、', '「', '」'];
  const KUTOUTEN_ITEMS = [
    { id:'k01', kind:'kuten', text:'ぼくは あした えんそくに いきます＿', correct:'。' },
    { id:'k02', kind:'kuten', text:'はなが たくさん さきました＿', correct:'。' },
    { id:'k03', kind:'kuten', text:'いぬと こうえんで あそんだ＿', correct:'。' },
    { id:'k04', kind:'kuten', text:'わたしは ほんを よむのが すきです＿', correct:'。' },
    { id:'k05', kind:'touten', text:'あさ おきて＿ かおを あらった。', correct:'、' },
    { id:'k06', kind:'touten', text:'ほんを よんで＿ かんそうを かいた。', correct:'、' },
    { id:'k07', kind:'touten', text:'あめが ふって＿ そとで あそべない。', correct:'、' },
    { id:'k08', kind:'touten', text:'てを あらって＿ ごはんを たべる。', correct:'、' },
    { id:'k09', kind:'kagi_open', text:'せんせいが ＿おはよう。」と いいました。', correct:'「' },
    { id:'k10', kind:'kagi_open', text:'ともだちが ＿いっしょに あそぼう。」と いった。', correct:'「' },
    { id:'k11', kind:'kagi_close', text:'おかあさんが「いってらっしゃい。＿と いった。', correct:'」' },
    { id:'k12', kind:'kagi_close', text:'ぼくは「ありがとう。＿と こたえた。', correct:'」' },
  ];

  // ══════════════════════════════════════════════════════════════════════
  //  Generators
  // ══════════════════════════════════════════════════════════════════════

  // ひらがな: gojuon 読み (カタカナ→ひらがな), 濁音/半濁音, 促音・拗音・長音 spelling.
  function genHiragana() {
    const r = Math.random();
    if (r < 0.34) {
      // gojuon: given the katakana, choose the same-sound hiragana.
      const e = pick(GOJUON);
      const distractors = sampleDistinct(ALL_HIRA, 3, e.h);
      return {
        itemRef: `kokugo1/hiragana/gojuon/${e.h}`,
        category: 'ひらがな：ごじゅうおん',
        prompt: `「${e.k}」と おなじ おとの ひらがなは どれですか。`,
        options: shuffle([e.h, ...distractors]),
        correctAnswer: e.h,
      };
    }
    if (r < 0.6) {
      // 濁音 or 半濁音: base + mark → one kana.
      const handaku = Math.random() < 0.4;
      if (handaku) {
        const e = pick(HANDAKUTEN);
        const pool = ALL_HANDAKU.concat(ALL_DAKU); // include the 濁音 twin as a trap
        const distractors = sampleDistinct(pool, 3, e.d);
        return {
          itemRef: `kokugo1/hiragana/handakuten/${e.base}`,
          category: 'ひらがな：はんだくおん',
          prompt: `「${e.base}」に まる（゜）を つけた じは どれですか。`,
          options: shuffle([e.d, ...distractors]),
          correctAnswer: e.d,
        };
      }
      const e = pick(DAKUTEN);
      const distractors = sampleDistinct(ALL_DAKU, 3, e.d);
      return {
        itemRef: `kokugo1/hiragana/dakuten/${e.base}`,
        category: 'ひらがな：だくおん',
        prompt: `「${e.base}」に てんてん（゛）を つけた じは どれですか。`,
        options: shuffle([e.d, ...distractors]),
        correctAnswer: e.d,
      };
    }
    // 促音・拗音・長音: pick the correct spelling of the glossed word.
    const e = pick(HIRA_WORDS);
    const distractors = sampleDistinct(e.wrong, 3, e.w);
    return {
      itemRef: `kokugo1/hiragana/spell/${e.w}`,
      category: 'ひらがな：かきかた',
      prompt: `「${e.gloss}」を ひらがなで かくと どれですか。`,
      options: shuffle([e.w, ...distractors]),
      correctAnswer: e.w,
    };
  }

  // カタカナ: gojuon 書き (ひらがな→カタカナ), 外来語の かきかた（長音符 ー ほか）.
  function genKatakana() {
    if (Math.random() < 0.5) {
      const e = pick(GOJUON);
      const distractors = sampleDistinct(ALL_KATA, 3, e.k);
      return {
        itemRef: `kokugo1/katakana/gojuon/${e.h}`,
        category: 'カタカナ：ごじゅうおん',
        prompt: `「${e.h}」を カタカナで かくと どれですか。`,
        options: shuffle([e.k, ...distractors]),
        correctAnswer: e.k,
      };
    }
    const e = pick(KATA_WORDS);
    const distractors = sampleDistinct(e.wrong, 3, e.w);
    return {
      itemRef: `kokugo1/katakana/spell/${e.w}`,
      category: 'カタカナ：かきかた',
      prompt: `「${e.gloss}」を カタカナで かくと どれですか。`,
      options: shuffle([e.w, ...distractors]),
      correctAnswer: e.w,
    };
  }

  // 助詞 は・を・へ
  function genJoshi() {
    const s = pick(JOSHI_SENTENCES);
    const distractors = sampleDistinct(JOSHI_TWINS, 3, s.particle);
    return {
      itemRef: `kokugo1/joshi/${s.particle}/${s.id}`,
      category: 'じょし：は・を・へ',
      prompt: `つぎの ＿に 入る じは どれですか。\n${s.text}`,
      options: shuffle([s.particle, ...distractors]),
      correctAnswer: s.particle,
    };
  }

  // 句読点・かぎ
  function genKutouten() {
    const it = pick(KUTOUTEN_ITEMS);
    const distractors = sampleDistinct(KUTOUTEN_MARKS, 3, it.correct);
    return {
      itemRef: `kokugo1/kutouten/${it.kind}/${it.id}`,
      category: 'くとうてん・かぎ',
      prompt: `つぎの ＿に 入る しるしは どれですか。\n${it.text}`,
      options: shuffle([it.correct, ...distractors]),
      correctAnswer: it.correct,
    };
  }

  // ── registry + quiz builder ────────────────────────────────────────────
  const KOKUGO1_UNITS = {
    hiragana: { key:'hiragana', title:'ひらがな', desc:'ごじゅうおん・だくおん・小さい じ（っ・ゃゅょ）・のばす おとの れんしゅう。', gen: genHiragana },
    katakana: { key:'katakana', title:'カタカナ', desc:'ごじゅうおんと、のばす おと（ー）の ある ことばの れんしゅう。', gen: genKatakana },
    joshi:    { key:'joshi',    title:'は・を・へ', desc:'「は」「を」「へ」の つかいかたを たしかめます。', gen: genJoshi },
    kutouten: { key:'kutouten', title:'。、「」', desc:'まる・てん・かぎかっこの つけかたを たしかめます。', gen: genKutouten },
  };

  function generateUnitQuiz(unitKey, count) {
    const unit = KOKUGO1_UNITS[unitKey];
    if (!unit) return [];
    const out = [];
    // These units draw from finite banks; avoid repeating the same base item in
    // one session where possible (fall back to allowing repeats if count is
    // larger than the bank).
    const usedRefs = new Set();
    let guard = 0;
    while (out.length < count && guard < count * 60) {
      guard++;
      const q = unit.gen();
      // Group spelling toP/toM-style variants by their base ref; for kana the
      // ref already identifies the base item.
      const baseRef = q.itemRef;
      if (usedRefs.has(baseRef)) continue;
      usedRefs.add(baseRef);
      out.push(q);
    }
    // If the bank was too small to fill `count` distinct items, top up allowing
    // repeats so the quiz always has the requested length.
    while (out.length < count) out.push(unit.gen());
    return out;
  }

  const api = {
    KOKUGO1_UNITS,
    generateUnitQuiz,
    _internals: {
      genHiragana, genKatakana, genJoshi, genKutouten,
      GOJUON, DAKUTEN, HANDAKUTEN, HIRA_WORDS, KATA_WORDS,
      JOSHI_SENTENCES, JOSHI_TWINS, KUTOUTEN_ITEMS, KUTOUTEN_MARKS,
    },
  };
  if (typeof window !== 'undefined') {
    window.KOKUGO1_UNITS = KOKUGO1_UNITS;
    window.generateUnitQuiz = generateUnitQuiz;
    window.Kokugo1Units = api;
  }
  if (typeof module !== 'undefined') module.exports = api;
})();
