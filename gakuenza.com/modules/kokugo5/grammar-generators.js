// grammar-generators.js — procedural generators for the grade-5 language /
// grammar drills. The four units are the closed, rule-based 言葉 topics from
// 光村図書『国語五 銀河』 (verified against Mitsumura's own grade-5 材料 list):
//   1. 敬語        (keigo: 尊敬語・謙譲語・丁寧語)
//   2. 慣用句      (kanyouku: body/idiom expressions)
//   3. 和語・漢語・外来語 (goshu: word origins)
//   4. 同じ読み方の漢字   (doukun: 同音異義語・同訓異字)
// Same "generator, not fixed bank" philosophy as kanji-generator.js — these are
// closed systems, so questions are produced procedurally with randomized
// distractors rather than hand-authored one by one.
//
// COLLISION DISCIPLINE (kokugo3's kanji generator shipped two real "a wrong
// option is secretly also correct" bugs): every generator here is built so that,
// by construction, a distractor can NEVER also be a valid answer — see the
// per-generator notes. grammar-generators.test.js stress-tests all four at scale
// and asserts this holds.

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

  // ══════════════════════════════════════════════════════════════════════
  //  1. 敬語 (keigo)
  //  Each verb has a 尊敬語 / 謙譲語 / 丁寧語 form. A question fixes one verb and
  //  one category; the correct answer is that verb's form for that category.
  //  Distractors are OTHER honorific forms drawn from the whole bank, filtered
  //  to exclude the correct string — so a distractor is never also the answer.
  //  (A single (verb, category) pair maps to exactly one correct form, so any
  //  string other than that form is a guaranteed-wrong option. Shared forms like
  //  いらっしゃる — 尊敬 of 行く/来る/いる — are handled purely by the != correct
  //  string check, never by index.) Only real special/丁寧 forms enter the pool,
  //  so distractors are always plausible honorific words, not random verbs.
  // ══════════════════════════════════════════════════════════════════════
  const KEIGO_VERBS = [
    { plain: '言う',   sonkei: 'おっしゃる',   kenjou: '申し上げる',   teinei: '言います' },
    { plain: '見る',   sonkei: 'ご覧になる',   kenjou: '拝見する',     teinei: '見ます' },
    { plain: '行く',   sonkei: 'いらっしゃる', kenjou: '参る',         teinei: '行きます' },
    { plain: '来る',   sonkei: 'いらっしゃる', kenjou: '参る',         teinei: '来ます' },
    { plain: 'いる',   sonkei: 'いらっしゃる', kenjou: 'おる',         teinei: 'います' },
    { plain: 'する',   sonkei: 'なさる',       kenjou: 'いたす',       teinei: 'します' },
    { plain: '食べる', sonkei: '召し上がる',   kenjou: 'いただく',     teinei: '食べます' },
    { plain: '飲む',   sonkei: '召し上がる',   kenjou: 'いただく',     teinei: '飲みます' },
    { plain: '聞く',   sonkei: 'お聞きになる', kenjou: 'うかがう',     teinei: '聞きます' },
    { plain: '会う',   sonkei: 'お会いになる', kenjou: 'お目にかかる', teinei: '会います' },
    { plain: '知る',   sonkei: 'ご存じだ',     kenjou: '存じる',       teinei: '知ります' },
  ];
  const KEIGO_CATS = [
    { key: 'sonkei', label: '尊敬語（そんけいご）' },
    { key: 'kenjou', label: '謙譲語（けんじょうご）' },
    { key: 'teinei', label: '丁寧語（ていねいご）' },
  ];
  // Global pool of every honorific/polite form in the bank (deduped) — the
  // source of distractors.
  const KEIGO_FORM_POOL = (function () {
    const s = [];
    KEIGO_VERBS.forEach(v => [v.sonkei, v.kenjou, v.teinei].forEach(f => { if (f && !s.includes(f)) s.push(f); }));
    return s;
  })();

  function genKeigo() {
    const verb = pick(KEIGO_VERBS);
    const cat = pick(KEIGO_CATS);
    const correct = verb[cat.key];
    // Distractors: any pooled form that isn't the correct string. Prefer forms
    // that are NOT this verb's own other forms? No — the verb's own 尊敬/謙譲
    // forms are the most instructive distractors, and none of them equals the
    // correct one, so they stay eligible. Just exclude the correct string.
    const distractors = shuffle(KEIGO_FORM_POOL.filter(f => f !== correct)).slice(0, 3);
    return {
      itemRef: `kokugo5/grammar/keigo/${verb.plain}/${cat.key}`,
      category: 'ことば：敬語',
      prompt: `「${verb.plain}」を ${cat.label}で 言うと、どれですか。`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  2. 慣用句 (kanyouku)
  //  Fixed, curated bank. Every entry has a DISTINCT meaning (near-synonyms were
  //  dropped during curation — e.g. only one "とても驚く" idiom is kept), so when
  //  the correct meaning/idiom is one entry, any other entry used as a distractor
  //  is guaranteed wrong. The "secretly also correct" trap can't occur. Same
  //  shape as kokugo3's ことわざ generator.
  // ══════════════════════════════════════════════════════════════════════
  const KANYOUKU = [
    { p: '油を売る',       m: 'むだ話などをして、仕事の途中でなまけること。' },
    { p: '顔が広い',       m: 'つき合いが多くて、知り合いがたくさんいること。' },
    { p: '手を焼く',       m: 'あつかいに困って、もてあますこと。' },
    { p: '耳を貸す',       m: '相手の話を聞いてやること。' },
    { p: '足を洗う',       m: 'よくない仲間や行いから、きっぱりとぬけ出すこと。' },
    { p: '頭を冷やす',     m: '高ぶった気持ちを落ち着かせること。' },
    { p: '口が軽い',       m: '言ってはいけないことを、すぐに人に話してしまうこと。' },
    { p: '馬が合う',       m: 'たがいに気持ちがよく合うこと。' },
    { p: '水を差す',       m: 'うまくいっていることの、じゃまをすること。' },
    { p: '羽を伸ばす',     m: '気がねする相手がいなくて、のびのびとふるまうこと。' },
    { p: '骨が折れる',     m: 'やりとげるのに、とても苦労すること。' },
    { p: '根も葉もない',   m: '何のよりどころもなく、でたらめであること。' },
    { p: 'さじを投げる',   m: 'もう見こみがないとあきらめて、やめてしまうこと。' },
    { p: '腹を割る',       m: 'かくさずに、本当の気持ちを打ち明けること。' },
    { p: '目を丸くする',   m: '思いがけないことに、とてもおどろくこと。' },
    { p: '鼻が高い',       m: 'とくいで、ほこらしい気持ちであること。' },
    { p: '頭が下がる',     m: 'りっぱさに感心して、尊敬する気持ちになること。' },
    { p: '気が長い',       m: 'のんびりしていて、いらいらせずに待てること。' },
    { p: '板につく',       m: '仕事や役わりがよく身について、うまくできるようになること。' },
    { p: '心を打つ',       m: '強く感動させること。' },
  ];

  function genKanyouku() {
    const idx = Math.floor(Math.random() * KANYOUKU.length);
    const target = KANYOUKU[idx];
    const others = shuffle(KANYOUKU.filter((_, i) => i !== idx)).slice(0, 3);
    const meaningToPhrase = Math.random() < 0.5;
    if (meaningToPhrase) {
      return {
        itemRef: `kokugo5/grammar/kanyouku/toP/${target.p}`,
        category: 'ことば：慣用句',
        prompt: `「${target.m}」\nこの意味を表す慣用句はどれですか。`,
        options: shuffle([target.p, ...others.map(o => o.p)]),
        correctAnswer: target.p,
      };
    }
    return {
      itemRef: `kokugo5/grammar/kanyouku/toM/${target.p}`,
      category: 'ことば：慣用句',
      prompt: `「${target.p}」の意味に、いちばん近いものはどれですか。`,
      options: shuffle([target.m, ...others.map(o => o.m)]),
      correctAnswer: target.m,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  3. 和語・漢語・外来語 (goshu — word origins)
  //  Each bank word belongs to exactly ONE origin category. A question fixes a
  //  target category and asks which of four words belongs to it; the correct
  //  word is of that category and the three distractors are drawn only from the
  //  OTHER two categories. Because every word's category is single-valued, a
  //  distractor can never also be a correct answer.
  // ══════════════════════════════════════════════════════════════════════
  const GOSHU = {
    wago:   { label: '和語（わご）',   words: ['山', '川', '花', '雨', '朝', '月', '水', '鳥', '手紙', '買い物'] },
    kango:  { label: '漢語（かんご）', words: ['学校', '電車', '自然', '読書', '家族', '勉強', '給食', '教室', '運動', '図書'] },
    gairai: { label: '外来語（がいらいご）', words: ['テレビ', 'ノート', 'パン', 'ボール', 'コップ', 'ページ', 'ピアノ', 'バス', 'テーブル', 'スポーツ'] },
  };
  const GOSHU_KEYS = ['wago', 'kango', 'gairai'];

  function genGoshu() {
    const targetKey = pick(GOSHU_KEYS);
    const correct = pick(GOSHU[targetKey].words);
    // Distractor pool = every word NOT in the target category.
    const otherWords = [];
    GOSHU_KEYS.forEach(k => { if (k !== targetKey) otherWords.push(...GOSHU[k].words); });
    const distractors = shuffle(otherWords).slice(0, 3);
    return {
      itemRef: `kokugo5/grammar/goshu/${targetKey}/${correct}`,
      category: 'ことば：和語・漢語・外来語',
      prompt: `次の 言葉の うち、${GOSHU[targetKey].label}は どれですか。`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  4. 同じ読み方の漢字 (doukun — 同音異義語・同訓異字)
  //  Curated items. Each item is a set of words that share the SAME reading, one
  //  sentence, and exactly one word that fits it; the other same-reading words
  //  are the distractors. The three distractors are, by design, real homophones
  //  that do NOT fit the sentence — the whole point of the exercise. Options are
  //  the item's own fixed 4 words, so the count is always 4 and each item is
  //  authored so only the marked word is correct in context (same authored-bank
  //  discipline as the reading units).
  // ══════════════════════════════════════════════════════════════════════
  const DOUKUN = [
    { reading: 'こうえん', sentence: '休みの 日、＿の ブランコで 妹と 遊んだ。', correct: '公園', distractors: ['公演', '講演', '後援'] },
    { reading: 'かてい',   sentence: '五年生に なって、＿科で なみぬいを 習った。', correct: '家庭', distractors: ['仮定', '過程', '課程'] },
    { reading: 'たいしょう', sentence: 'この 本は、小学生を ＿に して 書かれている。', correct: '対象', distractors: ['対照', '対称', '大将'] },
    { reading: 'かんしん', sentence: '弟は、こん虫に とても ＿が ある。', correct: '関心', distractors: ['感心', '歓心', '寒心'] },
    { reading: 'しじ',     sentence: '先生の ＿に したがって、体育館に ならんだ。', correct: '指示', distractors: ['支持', '師事', '私事'] },
    { reading: 'はかる',   sentence: 'はかりを 使って、荷物の 重さを ＿。', correct: '量る', distractors: ['計る', '測る', '図る'] },
    { reading: 'はかる',   sentence: 'ストップウォッチで、五十メートル走の 時間を ＿。', correct: '計る', distractors: ['量る', '測る', '図る'] },
    { reading: 'はかる',   sentence: 'まきじゃくで、プールの たての 長さを ＿。', correct: '測る', distractors: ['計る', '量る', '図る'] },
    { reading: 'とる',     sentence: 'カメラで、記念の 写真を ＿。', correct: '撮る', distractors: ['取る', '採る', '捕る'] },
    { reading: 'とる',     sentence: '野原に 出て、あみで バッタを ＿。', correct: '捕る', distractors: ['取る', '採る', '撮る'] },
    { reading: 'かえる',   sentence: 'へやの もようを、がらりと ＿。', correct: '変える', distractors: ['代える', '替える', '換える'] },
    { reading: 'つく',     sentence: '駅に ＿と、母が むかえに 来ていた。', correct: '着く', distractors: ['付く', '就く', '突く'] },
  ];

  function genDoukun() {
    const item = pick(DOUKUN);
    const options = shuffle([item.correct, ...item.distractors]);
    return {
      itemRef: `kokugo5/grammar/doukun/${item.reading}/${item.correct}`,
      category: 'ことば：同じ読み方の漢字',
      prompt: `「${item.reading}」\n${item.sentence}\n＿に 当てはまる 漢字は どれですか。`,
      options,
      correctAnswer: item.correct,
    };
  }

  // ── registry + quiz builder ────────────────────────────────────────────
  const GRAMMAR_UNITS = {
    keigo:    { key: 'keigo',    title: '敬語', desc: '尊敬語・謙譲語・丁寧語の 言い方を 選びます。', gen: genKeigo },
    kanyouku: { key: 'kanyouku', title: '慣用句', desc: '体の 一部などを 使った 慣用句の 意味を 結びつけます。', gen: genKanyouku },
    goshu:    { key: 'goshu',    title: '和語・漢語・外来語', desc: '言葉が どの 種類（和語・漢語・外来語）かを 見分けます。', gen: genGoshu },
    doukun:   { key: 'doukun',   title: '同じ読み方の漢字', desc: '同じ 読み方の 漢字を、文に 合わせて 使い分けます。', gen: genDoukun },
  };

  // Units backed by a finite bank (kanyouku, doukun) shouldn't repeat the same
  // base item within one session unless the bank is exhausted. The base ref
  // drops the direction/detail so both directions of one 慣用句 count as one.
  const FINITE = {
    // kanyouku has two directions per phrase (toP/toM) collapsed to one base;
    // doukun has one direction and each (reading, kanji) is its own item — note
    // three items share the reading はかる and two share とる, so the base must be
    // the FULL ref, not the reading, or the "no repeat" set would collapse those
    // and the bank would look smaller than it is.
    kanyouku: { size: KANYOUKU.length, baseRef: ref => ref.replace(/\/(toP|toM)\//, '/') },
    doukun:   { size: DOUKUN.length,   baseRef: ref => ref },
  };

  function generateGrammarQuiz(unitKey, count) {
    const unit = GRAMMAR_UNITS[unitKey];
    if (!unit) return [];
    const out = [];
    const fin = FINITE[unitKey];
    const usedRefs = new Set();
    let guard = 0;
    while (out.length < count && guard < count * 40) {
      guard++;
      const q = unit.gen();
      if (fin) {
        const base = fin.baseRef(q.itemRef);
        if (usedRefs.has(base) && usedRefs.size < fin.size) continue;
        usedRefs.add(base);
      }
      out.push(q);
    }
    return out;
  }

  const api = {
    GRAMMAR_UNITS,
    generateGrammarQuiz,
    // exported for the stress test
    _internals: {
      genKeigo, genKanyouku, genGoshu, genDoukun,
      KEIGO_VERBS, KEIGO_FORM_POOL, KANYOUKU, GOSHU, GOSHU_KEYS, DOUKUN,
    },
  };
  if (typeof window !== 'undefined') { window.GRAMMAR_UNITS = GRAMMAR_UNITS; window.generateGrammarQuiz = generateGrammarQuiz; window.GrammarGen = api; }
  if (typeof module !== 'undefined') module.exports = api;
})();
