// grammar-generators.js — procedural generators for the grade-6 language /
// grammar drills. Grade 6's language-mechanics topics are NOT grade 3's — they
// are the closed rule-systems the grade-6 国語 curriculum actually introduces:
//   1. 敬語        — 尊敬語・謙譲語（＋丁寧語）の使い分け
//   2. 熟語の成り立ち — 二字熟語の組み立て（似た意味／反対／修飾／目的・対象）
//   3. 和語・漢語・外来語 — 語の種類（語種）の見分け
//   4. 四字熟語・故事成語 — 意味の結びつけ
// Same "generator, not fixed bank" philosophy as kanji-generator.js: these are
// closed, systematic sets, so questions are produced procedurally with
// randomized distractors rather than hand-authored one by one.
//
// COLLISION DISCIPLINE (this project's kanji generator shipped two real "a
// wrong option is secretly also correct" bugs): every generator here is built
// so that, by construction, a distractor can NEVER also be a valid answer —
// see the per-generator notes. grammar-generators.test.js stress-tests all
// four at scale and asserts this holds.

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
  //  1. 敬語 (honorific language)
  //  Each entry gives a plain verb and its special 尊敬語 (son) / 謙譲語 (ken)
  //  form. COLLISION SAFETY relies on two curated invariants, asserted by the
  //  test:
  //   (a) every son-form string is unique, every ken-form string is unique,
  //       and no string is BOTH a son-form and a ken-form (son ∩ ken = ∅);
  //   (b) for any special form that in real Japanese serves several plain
  //       verbs (いらっしゃる = 行く/来る/いる, 参る = 行く/来る, いただく =
  //       食べる/飲む/もらう), AT MOST ONE of those verbs is in the bank. So a
  //       distractor drawn from another entry can never also be a valid answer
  //       for the target verb.
  //  丁寧語 (です・ます) is described in the unit blurb but not drilled here —
  //  it is not a verb substitution comparable to these, so mixing it into the
  //  same option set would be apples-to-oranges.
  // ══════════════════════════════════════════════════════════════════════
  const KEIGO = [
    { plain: '言う',      son: 'おっしゃる',   ken: '申す' },
    { plain: 'する',      son: 'なさる',       ken: 'いたす' },
    { plain: '食べる',    son: 'めしあがる',   ken: 'いただく' },   // 食べる/飲む/もらう family — only this one in the bank
    { plain: '見る',      son: 'ごらんになる', ken: '拝見する' },
    { plain: '来る',      son: 'いらっしゃる', ken: '参る' },        // 行く/来る/いる family — only this one in the bank
    { plain: '知っている', son: 'ご存じだ',     ken: '存じる' },
    { plain: 'くれる',    son: 'くださる',     ken: null },
    { plain: 'あげる',    son: null,           ken: 'さしあげる' },
    { plain: '会う',      son: null,           ken: 'お目にかかる' },
  ];
  const KEIGO_LABEL = { son: '尊敬語', ken: '謙譲語' };
  const sonForms = KEIGO.filter(e => e.son).map(e => e.son);
  const kenForms = KEIGO.filter(e => e.ken).map(e => e.ken);

  function genKeigo() {
    const classify = Math.random() < 0.5;
    if (classify) {
      // "次のうち、〔尊敬語/謙譲語〕はどれですか。" — 1 of the asked type + 3
      // of the OTHER type. son and ken form-sets are disjoint (invariant a),
      // so an other-type distractor can never also be the asked type.
      const type = pick(['son', 'ken']);
      const correct = pick(type === 'son' ? sonForms : kenForms);
      const otherPool = (type === 'son' ? kenForms : sonForms).filter(f => f !== correct);
      const distractors = shuffle(otherPool).slice(0, 3);
      return {
        itemRef: `kokugo6/grammar/keigo/classify/${type}/${correct}`,
        category: 'ことば：敬語',
        prompt: `次の言い方のうち、${KEIGO_LABEL[type]}はどれですか。`,
        options: shuffle([correct, ...distractors]),
        correctAnswer: correct,
      };
    }
    // "「言う」を尊敬語で言うと、どれですか。" — correct is the target's form;
    // the 3 distractors are OTHER entries' forms of the SAME type. Because
    // every same-type form string is unique AND multi-verb forms map to a
    // single bank entry (invariants a+b), no distractor is a valid form of the
    // target verb.
    const type = pick(['son', 'ken']);
    const withType = KEIGO.filter(e => e[type]);
    const target = pick(withType);
    const correct = target[type];
    const distractors = shuffle(withType.filter(e => e !== target).map(e => e[type])).slice(0, 3);
    return {
      itemRef: `kokugo6/grammar/keigo/form/${type}/${target.plain}`,
      category: 'ことば：敬語',
      prompt: `「${target.plain}」を${KEIGO_LABEL[type]}で言うと、どれですか。`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  2. 熟語の成り立ち (structure of two-kanji compounds)
  //  Four textbook categories. Every compound is curated to belong to EXACTLY
  //  ONE category (no compound that can be reasonably argued into a second) —
  //  that single-membership is the collision guard, since the classify-form
  //  options are the four fixed category labels and the pick-form options are
  //  words from distinct categories. The test asserts single-membership
  //  (no word appears under two categories) and structural integrity; the
  //  semantic "one true category" property is guaranteed by curation.
  // ══════════════════════════════════════════════════════════════════════
  const JUKUGO_CATS = {
    similar:  '似た意味の漢字を組み合わせた熟語',
    opposite: '反対（対）の意味の漢字を組み合わせた熟語',
    modify:   '上の漢字が下の漢字をくわしくする（修飾する）熟語',
    object:   '下の漢字が上の漢字の目的や対象になる（「〜を」「〜に」）熟語',
  };
  const JUKUGO_WORDS = {
    similar:  ['岩石', '河川', '絵画', '増加', '永久', '温暖', '寒冷', '森林', '救助', '尊敬', '思考', '豊富'],
    opposite: ['強弱', '高低', '大小', '前後', '左右', '売買', '開閉', '増減', '出入', '明暗', '進退', '縦横'],
    modify:   ['国旗', '曲線', '急流', '温水', '深海', '直線', '円形', '幼虫', '灰色', '親友'],
    object:   ['読書', '着席', '登山', '乗車', '消火', '作文', '投球', '開会', '帰国', '就職', '加熱', '洗顔'],
  };
  const JUKUGO_CAT_KEYS = Object.keys(JUKUGO_CATS);
  // Reverse index word -> category (also the single-membership guarantor).
  const JUKUGO_WORD_CAT = {};
  JUKUGO_CAT_KEYS.forEach(cat => JUKUGO_WORDS[cat].forEach(w => { JUKUGO_WORD_CAT[w] = cat; }));

  function genJukugo() {
    const classify = Math.random() < 0.55;
    if (classify) {
      // Given the compound, choose its structure. Options = the 4 fixed labels.
      const cat = pick(JUKUGO_CAT_KEYS);
      const word = pick(JUKUGO_WORDS[cat]);
      return {
        itemRef: `kokugo6/grammar/jukugo/type/${word}`,
        category: 'ことば：熟語の成り立ち',
        prompt: `「${word}」の熟語の成り立ちは、次のどれですか。`,
        options: shuffle(JUKUGO_CAT_KEYS.map(k => JUKUGO_CATS[k])),
        correctAnswer: JUKUGO_CATS[cat],
      };
    }
    // Given a structure, choose the matching compound. Distractors are words
    // from the OTHER three categories (single-membership => never also correct).
    const cat = pick(JUKUGO_CAT_KEYS);
    const word = pick(JUKUGO_WORDS[cat]);
    const otherWords = [];
    JUKUGO_CAT_KEYS.forEach(k => { if (k !== cat) otherWords.push(...JUKUGO_WORDS[k]); });
    const distractors = shuffle(otherWords).slice(0, 3);
    return {
      itemRef: `kokugo6/grammar/jukugo/pick/${cat}/${word}`,
      category: 'ことば：熟語の成り立ち',
      prompt: `次のうち、「${JUKUGO_CATS[cat]}」はどれですか。`,
      options: shuffle([word, ...distractors]),
      correctAnswer: word,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  3. 和語・漢語・外来語 (word origin — 語種)
  //  Three types. Every word is curated to a single unambiguous type: 和語 =
  //  native kun-reading words, 漢語 = Sino-Japanese on-reading compounds,
  //  外来語 = katakana loanwords. Deliberately excludes湯桶／重箱読み and
  //  borderline 呉音 single-kanji words whose type is genuinely arguable, so a
  //  distractor of a different type can never also be the asked type. The test
  //  asserts single-membership.
  // ══════════════════════════════════════════════════════════════════════
  const GOSHU_LABEL = { wago: '和語', kango: '漢語', gairaigo: '外来語' };
  const GOSHU_WORDS = {
    wago:     ['山', '川', '花', '空', '水', '朝', '雨', '声', '森', '星', '海', '心', '光', '道'],
    kango:    ['学校', '電車', '先生', '図書', '自然', '時間', '家族', '天気', '運動', '音楽', '新聞', '公園', '電話', '世界'],
    gairaigo: ['バス', 'テレビ', 'ノート', 'パン', 'ボタン', 'ガラス', 'ピアノ', 'コップ', 'カレー', 'スポーツ', 'ペン', 'ケーキ', 'ボール', 'ラジオ'],
  };
  const GOSHU_KEYS = Object.keys(GOSHU_LABEL);
  const GOSHU_WORD_TYPE = {};
  GOSHU_KEYS.forEach(t => GOSHU_WORDS[t].forEach(w => { GOSHU_WORD_TYPE[w] = t; }));

  function genGoshu() {
    // "次のうち、〔和語/漢語/外来語〕はどれですか。" — 1 of type + 3 of others.
    const type = pick(GOSHU_KEYS);
    const word = pick(GOSHU_WORDS[type]);
    const otherWords = [];
    GOSHU_KEYS.forEach(t => { if (t !== type) otherWords.push(...GOSHU_WORDS[t]); });
    const distractors = shuffle(otherWords).slice(0, 3);
    return {
      itemRef: `kokugo6/grammar/goshu/${type}/${word}`,
      category: 'ことば：和語・漢語・外来語',
      prompt: `次のうち、${GOSHU_LABEL[type]}はどれですか。`,
      options: shuffle([word, ...distractors]),
      correctAnswer: word,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  4. 四字熟語・故事成語 (four-character idioms / Chinese-origin idioms)
  //  Fixed, curated bank. Every entry has a DISTINCT meaning (near-synonyms
  //  such as 一挙両得 were dropped so no two entries share a meaning), so when
  //  the correct meaning/idiom is one entry, any other entry used as a
  //  distractor is guaranteed wrong — the "secretly also correct" trap can't
  //  occur. Same guard kokugo3's kotowaza uses; the test asserts it.
  // ══════════════════════════════════════════════════════════════════════
  const YOJI = [
    { p: '一石二鳥', m: '一つのことをして、同時に二つの利益を得ること。' },
    { p: '十人十色', m: '人によって、考えや好みがそれぞれ違うということ。' },
    { p: '温故知新', m: '昔のことをよく学んで、そこから新しい知識や考えを見つけ出すこと。' },
    { p: '起承転結', m: '文章や物事を組み立てる順序のこと。' },
    { p: '臨機応変', m: 'その場の状況に合わせて、うまく対応すること。' },
    { p: '一日千秋', m: '待ち遠しくて、時間がとても長く感じられること。' },
    { p: '大器晩成', m: 'すぐれた人ほど、力を発揮するまでに時間がかかるということ。' },
    { p: '単刀直入', m: '前置きをせず、いきなり大切な話に入ること。' },
    { p: '自画自賛', m: '自分で自分のことをほめること。' },
    { p: '半信半疑', m: '本当かどうか決めかねて、迷っていること。' },
    { p: '我田引水', m: '自分の都合のよいように、物事を進めること。' },
    { p: '二束三文', m: '数が多くても、値段がとても安いこと。' },
    { p: '矛盾', m: '話の前と後のつじつまが合わないこと。' },
    { p: '蛇足', m: 'なくてもよい、よけいなつけ足しのこと。' },
    { p: '五十歩百歩', m: '少しの違いはあっても、だいたい同じであること。' },
    { p: '漁夫の利', m: '二者が争っているうちに、別の者が横から利益を取ってしまうこと。' },
    { p: '推敲', m: '詩や文章の言葉を、何度も練り直してよくすること。' },
    { p: '蛍雪の功', m: '苦労して勉強に励み、りっぱな成果をあげること。' },
    { p: '背水の陣', m: '一歩も引けない覚悟で、全力で物事にあたること。' },
    { p: '四面楚歌', m: '周りがすべて敵ばかりで、味方が一人もいないこと。' },
    { p: '竜頭蛇尾', m: '初めは勢いがよいが、終わりの方はふるわないこと。' },
    { p: '呉越同舟', m: '仲の悪い者どうしが、同じ場所に居合わせること。' },
  ];

  function genYoji() {
    const idx = Math.floor(Math.random() * YOJI.length);
    const target = YOJI[idx];
    const others = shuffle(YOJI.filter((_, i) => i !== idx)).slice(0, 3);
    const meaningToIdiom = Math.random() < 0.5;
    if (meaningToIdiom) {
      return {
        itemRef: `kokugo6/grammar/yoji/toP/${target.p}`,
        category: 'ことば：四字熟語・故事成語',
        prompt: `「${target.m}」\nこの意味を表す四字熟語・故事成語はどれですか。`,
        options: shuffle([target.p, ...others.map(o => o.p)]),
        correctAnswer: target.p,
      };
    }
    return {
      itemRef: `kokugo6/grammar/yoji/toM/${target.p}`,
      category: 'ことば：四字熟語・故事成語',
      prompt: `「${target.p}」の意味に、いちばん近いものはどれですか。`,
      options: shuffle([target.m, ...others.map(o => o.m)]),
      correctAnswer: target.m,
    };
  }

  // ── registry + quiz builder ────────────────────────────────────────────
  const GRAMMAR_UNITS = {
    keigo:  { key: 'keigo',  title: '敬語', desc: '尊敬語・謙譲語（相手を敬う言い方）を選びます。', gen: genKeigo },
    jukugo: { key: 'jukugo', title: '熟語の成り立ち', desc: '二字熟語が、どんな組み立てでできているかを考えます。', gen: genJukugo },
    goshu:  { key: 'goshu',  title: '和語・漢語・外来語', desc: '言葉の種類（語種）を見分けます。', gen: genGoshu },
    yoji:   { key: 'yoji',   title: '四字熟語・故事成語', desc: '四字熟語や故事成語の意味を、正しく結びつけます。', gen: genYoji },
  };

  // Coarse identity of a question, used to avoid repeating the same underlying
  // item within one session (e.g. the same idiom as both toP and toM, or the
  // same compound in type- and pick-form). Falls back to allowing repeats when
  // the requested count exceeds the number of distinct items available.
  const BANK_SIZE = {
    keigo: KEIGO.length * 2,       // roughly: each entry × {son,ken} directions
    jukugo: Object.keys(JUKUGO_WORD_CAT).length,
    goshu: Object.keys(GOSHU_WORD_TYPE).length,
    yoji: YOJI.length,
  };
  function baseKey(unitKey, q) {
    const r = q.itemRef;
    if (unitKey === 'yoji') return r.replace(/\/(toP|toM)\//, '/');
    if (unitKey === 'jukugo') {
      // both forms ultimately identify a single compound word (last segment)
      return 'jukugo/' + r.split('/').pop();
    }
    if (unitKey === 'goshu') return 'goshu/' + r.split('/').pop();
    if (unitKey === 'keigo') {
      // identify by (form/classify, type, subject) — the whole ref minus module prefix
      return r;
    }
    return r;
  }

  function generateGrammarQuiz(unitKey, count) {
    const unit = GRAMMAR_UNITS[unitKey];
    if (!unit) return [];
    const out = [];
    const usedBases = new Set();
    const cap = BANK_SIZE[unitKey] || Infinity;
    let guard = 0;
    while (out.length < count && guard < count * 60) {
      guard++;
      const q = unit.gen();
      const bk = baseKey(unitKey, q);
      if (usedBases.has(bk) && usedBases.size < cap) continue;
      usedBases.add(bk);
      out.push(q);
    }
    return out;
  }

  const api = {
    GRAMMAR_UNITS,
    generateGrammarQuiz,
    // exported for the stress test
    _internals: {
      genKeigo, genJukugo, genGoshu, genYoji,
      KEIGO, sonForms, kenForms,
      JUKUGO_CATS, JUKUGO_WORDS, JUKUGO_WORD_CAT,
      GOSHU_LABEL, GOSHU_WORDS, GOSHU_WORD_TYPE,
      YOJI,
    },
  };
  if (typeof window !== 'undefined') { window.GRAMMAR_UNITS = GRAMMAR_UNITS; window.generateGrammarQuiz = generateGrammarQuiz; window.GrammarGen = api; }
  if (typeof module !== 'undefined') module.exports = api;
})();
