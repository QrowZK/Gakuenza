// grammar-generators.js — procedural generators for the grade-4 language /
// grammar drills. The five units are closed, rule-based 言葉 topics that are core
// to the 光村図書『国語四』curriculum, chosen so as not to duplicate kokugo3
// (こそあど・修飾語・ことわざ・ローマ字) or kokugo5 (敬語・慣用句bank・和語漢語外来語・
// 同じ読み方の漢字):
//   1. bushu         漢字の部首        (radical of a kanji)
//   2. jukugo        熟語の組み立て    (structure of two-kanji compounds)
//   3. setsuzoku     つなぎ言葉（接続語）(connective between two clauses)
//   4. shugo_jutsugo 主語・述語        (identify the subject / predicate)
//   5. kanyouku      慣用句            (idiom ⇄ meaning; grade-4 bank)
// Same "generator, not fixed bank" philosophy as kanji-generator.js — these are
// closed systems, so questions are produced procedurally with randomized
// distractors rather than hand-authored one by one.
//
// COLLISION DISCIPLINE (kokugo3's kanji generator shipped two real "a wrong
// option is secretly also correct" bugs): every generator here is built so that,
// by construction, a distractor can NEVER also be a valid answer — see the
// per-generator notes. grammar-generators.test.js stress-tests all five at scale
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
  //  1. 部首 (bushu — radicals)
  //  Each kanji has exactly ONE 部首 (its Kangxi radical). A question fixes one
  //  kanji and asks for its radical; the correct answer is that kanji's radical
  //  LABEL, and the three distractors are radical labels drawn from the global
  //  radical pool EXCLUDING the target's radical. Because a kanji's radical is
  //  single-valued, any other radical label is a guaranteed-wrong option — the
  //  "secretly also correct" trap cannot occur. Direction is kanji→radical ONLY
  //  (never "which kanji has radical X", which WOULD collide, since the bank has
  //  several kanji per radical). Every entry uses a grade-4 配当漢字 whose radical
  //  is textbook-standard and unambiguous.
  // ══════════════════════════════════════════════════════════════════════
  // radical key -> display label (name + form)
  const RADICALS = {
    sanzui:   'さんずい（氵）',
    kihen:    'きへん（木）',
    ninben:   'にんべん（人・亻）',
    itohen:   'いとへん（糸）',
    gonben:   'ごんべん（言）',
    ukanmuri: 'うかんむり（宀）',
    kusa:     'くさかんむり（艹）',
    madare:   'まだれ（广）',
    hihen:    'ひへん（火）',
    rekka:    'れんが・れっか（灬）',
    kozato:   'こざとへん（阝）',
    gyounin:  'ぎょうにんべん（彳）',
  };
  // kanji -> radical key (all kanji here are grade-4 配当漢字)
  const BUSHU = [
    { k: '泣', r: 'sanzui' }, { k: '治', r: 'sanzui' }, { k: '清', r: 'sanzui' },
    { k: '満', r: 'sanzui' }, { k: '浅', r: 'sanzui' }, { k: '浴', r: 'sanzui' },
    { k: '材', r: 'kihen' }, { k: '松', r: 'kihen' }, { k: '梅', r: 'kihen' },
    { k: '械', r: 'kihen' }, { k: '標', r: 'kihen' },
    { k: '位', r: 'ninben' }, { k: '低', r: 'ninben' }, { k: '例', r: 'ninben' },
    { k: '側', r: 'ninben' }, { k: '借', r: 'ninben' }, { k: '億', r: 'ninben' },
    { k: '給', r: 'itohen' }, { k: '結', r: 'itohen' }, { k: '続', r: 'itohen' },
    { k: '約', r: 'itohen' }, { k: '縄', r: 'itohen' },
    { k: '議', r: 'gonben' }, { k: '試', r: 'gonben' }, { k: '説', r: 'gonben' },
    { k: '課', r: 'gonben' }, { k: '訓', r: 'gonben' },
    { k: '官', r: 'ukanmuri' }, { k: '完', r: 'ukanmuri' }, { k: '察', r: 'ukanmuri' },
    { k: '富', r: 'ukanmuri' }, { k: '害', r: 'ukanmuri' },
    { k: '英', r: 'kusa' }, { k: '芽', r: 'kusa' }, { k: '芸', r: 'kusa' },
    { k: '菜', r: 'kusa' }, { k: '茨', r: 'kusa' },
    { k: '底', r: 'madare' }, { k: '府', r: 'madare' }, { k: '康', r: 'madare' },
    { k: '席', r: 'madare' },
    { k: '焼', r: 'hihen' }, { k: '灯', r: 'hihen' },
    { k: '照', r: 'rekka' }, { k: '熱', r: 'rekka' }, { k: '然', r: 'rekka' },
    { k: '陸', r: 'kozato' }, { k: '隊', r: 'kozato' }, { k: '阪', r: 'kozato' },
    { k: '徒', r: 'gyounin' }, { k: '径', r: 'gyounin' },
  ];
  const RADICAL_KEYS = Object.keys(RADICALS);

  function genBushu() {
    const entry = pick(BUSHU);
    const correct = RADICALS[entry.r];
    // Distractors: radical labels for OTHER radical keys (never the target's).
    const otherKeys = shuffle(RADICAL_KEYS.filter(rk => rk !== entry.r)).slice(0, 3);
    const distractors = otherKeys.map(rk => RADICALS[rk]);
    return {
      itemRef: `kokugo4/grammar/bushu/${entry.k}`,
      category: 'ことば：部首',
      prompt: `「${entry.k}」の 部首（ぶしゅ）は どれですか。`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  2. 熟語の組み立て (jukugo — compound structure)
  //  Each two-kanji compound is authored into exactly ONE of five structure
  //  categories. A question shows a compound and asks its structure; the correct
  //  answer is that compound's category label, and the three distractors are the
  //  OTHER category labels. Because each compound maps to a single category, any
  //  other category is a guaranteed-wrong option (same by-construction discipline
  //  as kokugo5's 和語・漢語・外来語). Compounds were curated to only those whose
  //  textbook classification is unambiguous — near-boundary compounds were
  //  dropped so a distractor category can never secretly also fit.
  // ══════════════════════════════════════════════════════════════════════
  const JUKUGO_CATS = {
    ruiji:    '似た意味の漢字の組み合わせ',
    hantai:   '反対（対）の意味の漢字の組み合わせ',
    shuushoku:'上の漢字が下の漢字をくわしくしている',
    taisho:   '下の漢字が「〜を・〜に」に当たる',
    shujutsu: '主語と述語の関係になっている',
  };
  const JUKUGO = [
    // ruiji — two kanji of similar meaning
    { w: '森林', c: 'ruiji' }, { w: '道路', c: 'ruiji' }, { w: '絵画', c: 'ruiji' },
    { w: '岩石', c: 'ruiji' }, { w: '生産', c: 'ruiji' }, { w: '願望', c: 'ruiji' },
    // hantai — two kanji of opposite meaning
    { w: '高低', c: 'hantai' }, { w: '大小', c: 'hantai' }, { w: '左右', c: 'hantai' },
    { w: '前後', c: 'hantai' }, { w: '強弱', c: 'hantai' }, { w: '売買', c: 'hantai' },
    { w: '勝敗', c: 'hantai' },
    // shuushoku — upper kanji modifies the lower
    { w: '国旗', c: 'shuushoku' }, { w: '青空', c: 'shuushoku' }, { w: '電車', c: 'shuushoku' },
    { w: '白紙', c: 'shuushoku' }, { w: '冷水', c: 'shuushoku' }, { w: '老人', c: 'shuushoku' },
    { w: '新年', c: 'shuushoku' },
    // taisho — lower kanji is the を/に object of the upper (verb)
    { w: '読書', c: 'taisho' }, { w: '消火', c: 'taisho' }, { w: '着席', c: 'taisho' },
    { w: '乗車', c: 'taisho' }, { w: '登山', c: 'taisho' }, { w: '開店', c: 'taisho' },
    { w: '加熱', c: 'taisho' },
    // shujutsu — subject + predicate relation
    { w: '国立', c: 'shujutsu' }, { w: '県立', c: 'shujutsu' }, { w: '日照', c: 'shujutsu' },
    { w: '年少', c: 'shujutsu' },
  ];
  const JUKUGO_CAT_KEYS = Object.keys(JUKUGO_CATS);

  function genJukugo() {
    const entry = pick(JUKUGO);
    const correct = JUKUGO_CATS[entry.c];
    const otherKeys = shuffle(JUKUGO_CAT_KEYS.filter(ck => ck !== entry.c)).slice(0, 3);
    const distractors = otherKeys.map(ck => JUKUGO_CATS[ck]);
    return {
      itemRef: `kokugo4/grammar/jukugo/${entry.w}`,
      category: 'ことば：熟語の組み立て',
      prompt: `「${entry.w}」という 熟語の 組み立てとして、正しいものは どれですか。`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  3. つなぎ言葉・接続語 (setsuzoku — connectives)
  //  Four logical relations, each with a DISJOINT set of connectives and a bank
  //  of clause-pairs that unambiguously express ONLY that relation. A question
  //  picks a relation, shows one of its clause-pairs, and the correct answer is a
  //  connective from that relation's set; the three distractors are connectives
  //  drawn from the OTHER relations' sets. Because the connective sets are
  //  pairwise disjoint (each connective belongs to exactly one relation) and the
  //  clause-pair fixes the relation, a distractor connective can never also fit —
  //  the same closed-column safety as kokugo3's こそあど generator.
  // ══════════════════════════════════════════════════════════════════════
  const SETSUZOKU = {
    juntetsu: {
      label: '順接',
      conj: ['だから', 'それで', 'そこで'],
      // c1 is the cause/reason; c2 is its natural result.
      pairs: [
        ['雨が 強く なってきた', '遠足は 中止に なった'],
        ['朝ねぼうを して しまった', '学校に おくれそうに なった'],
        ['のどが とても かわいた', '水を 一気に 飲んだ'],
      ],
    },
    gyakusetsu: {
      label: '逆接',
      conj: ['しかし', 'けれども', 'ところが'],
      // c2 goes AGAINST what c1 would lead you to expect.
      pairs: [
        ['一生けんめい 走った', '一等賞には なれなかった'],
        ['朝から よく 晴れていた', '午後は 雨が ふってきた'],
        ['薬を きちんと 飲んだ', 'ねつは なかなか 下がらなかった'],
      ],
    },
    tenka: {
      label: '添加（つけ加え）',
      conj: ['そして', 'それに', 'しかも'],
      // c2 ADDS a further point to c1 (signalled by も / さらに).
      pairs: [
        ['この 店の ケーキは おいしい', 'ねだんも とても 安い'],
        ['急に 雨が ふってきた', '風も どんどん 強く なってきた'],
        ['宿題を 全部 終わらせた', '部屋の そうじも きれいに した'],
      ],
    },
    sentaku: {
      label: '選択（どちらか）',
      conj: ['それとも', 'または'],
      // c1 and c2 are two ALTERNATIVES to choose between.
      pairs: [
        ['お茶に しますか', 'コーヒーに しますか'],
        ['えん筆で 書きますか', 'ペンで 書きますか'],
        ['歩いて 行こうか', 'バスに 乗ろうか'],
      ],
    },
  };
  const SETSUZOKU_KEYS = Object.keys(SETSUZOKU);
  // Global pool of every connective (deduped) — used to build distractors.
  const SETSUZOKU_POOL = (function () {
    const s = [];
    SETSUZOKU_KEYS.forEach(k => SETSUZOKU[k].conj.forEach(c => { if (!s.includes(c)) s.push(c); }));
    return s;
  })();

  function genSetsuzoku() {
    const key = pick(SETSUZOKU_KEYS);
    const rel = SETSUZOKU[key];
    const pairIdx = Math.floor(Math.random() * rel.pairs.length);
    const [c1, c2] = rel.pairs[pairIdx];
    const correct = pick(rel.conj);
    // Distractors: connectives that are NOT in this relation's set.
    const own = new Set(rel.conj);
    const distractors = shuffle(SETSUZOKU_POOL.filter(c => !own.has(c))).slice(0, 3);
    return {
      itemRef: `kokugo4/grammar/setsuzoku/${key}/${pairIdx}`,
      category: 'ことば：つなぎ言葉',
      prompt: `「${c1}。＿、${c2}。」\n＿に 入る つなぎ言葉は どれですか。`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  4. 主語・述語 (shugo_jutsugo)
  //  A sentence is built from four 文節: [主語=名詞+が/は] [連用修飾=副詞]
  //  [目的=名詞+を] [述語=動詞]. The question asks for either the 主語 or the 述語:
  //    - 主語 → the が/は-marked noun 文節 (the only subject).
  //    - 述語 → the sentence-final verb 文節 (the only predicate).
  //  The other two 文節 (adverb, object) are neither, so the answer is unique and
  //  the three distractors are safe by construction. The noun/adverb/verb banks
  //  are kept in disjoint roles (a subject-noun is never reused as an object in
  //  the same sentence — the two nouns are drawn distinct) so no 文節 can fill two
  //  slots.
  // ══════════════════════════════════════════════════════════════════════
  const SJ_SUBJ = ['妹', '弟', '兄', '姉', '父', '母', '犬', 'ねこ', '小鳥', '子ども', '友だち', '先生'];
  const SJ_OBJ  = ['花', 'ボール', '手紙', '絵', '本', '荷物', 'ケーキ', '写真'];
  const SJ_ADV  = ['元気に', 'ゆっくり', '大きな声で', '楽しそうに', '一生けんめい', 'しずかに', 'そっと'];
  const SJ_VERB = ['育てる', '投げる', '書く', 'かく', '歌う', '読む', '運ぶ', '食べる', '飲む', 'とる', '見る'];
  // subject+particle variants
  const SJ_PART = ['が', 'は'];

  function genShugoJutsugo() {
    const subj = pick(SJ_SUBJ);
    const part = pick(SJ_PART);
    let obj = pick(SJ_OBJ);
    // keep the object noun distinct from the subject noun (defensive; the banks
    // barely overlap, but never let one 文節 be ambiguous between roles).
    let guard = 0;
    while (obj === subj && guard < 10) { obj = pick(SJ_OBJ); guard++; }
    const adv = pick(SJ_ADV);
    const verb = pick(SJ_VERB);
    const subjBun = `${subj}${part}`;
    const objBun = `${obj}を`;
    const verbBun = `${verb}。`;
    const sentence = `${subjBun} ${adv} ${objBun} ${verb}。`;
    const bunsetsu = [subjBun, adv, objBun, verbBun];
    const askSubject = Math.random() < 0.5;
    if (askSubject) {
      return {
        itemRef: 'kokugo4/grammar/shugo/shugo',
        category: 'ことば：主語・述語',
        prompt: `「${sentence}」\nこの 文の 主語（しゅご）は どれですか。`,
        options: shuffle(bunsetsu.slice()),
        correctAnswer: subjBun,
      };
    }
    return {
      itemRef: 'kokugo4/grammar/shugo/jutsugo',
      category: 'ことば：主語・述語',
      prompt: `「${sentence}」\nこの 文の 述語（じゅつご）は どれですか。`,
      options: shuffle(bunsetsu.slice()),
      correctAnswer: verbBun,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  5. 慣用句 (kanyouku — idioms)
  //  Fixed, curated bank. Every entry has a DISTINCT meaning AND a distinct
  //  phrase (near-synonyms were dropped during curation), so when the correct
  //  meaning/idiom is one entry, any other entry used as a distractor is
  //  guaranteed wrong — the "secretly also correct" trap can't occur. Bank is
  //  authored fresh for grade-4 and does not reuse kokugo5's 慣用句 set.
  // ══════════════════════════════════════════════════════════════════════
  const KANYOUKU = [
    { p: '手を貸す',       m: '人を 手伝って、力を 貸すこと。' },
    { p: '目が高い',       m: 'よい物を 見分ける 力が あること。' },
    { p: '耳が痛い',       m: '自分の 弱点を 言われて、聞くのが つらいこと。' },
    { p: '口をそろえる',   m: '何人もの 人が、同じことを 言うこと。' },
    { p: '頭をかかえる',   m: 'どうしたら よいか 分からず、ひどく なやむこと。' },
    { p: '首を長くする',   m: '今か今かと、待ち遠しく 思うこと。' },
    { p: '目を通す',       m: '初めから 終わりまで、ざっと 読むこと。' },
    { p: '手に負えない',   m: '自分の 力では、どうにも あつかえないこと。' },
    { p: '息をのむ',       m: 'おどろいて、思わず 息を 止めること。' },
    { p: '気が短い',       m: 'すぐに いらいらして、おこりやすいこと。' },
    { p: '名を上げる',     m: '世間に 広く 知られて、有名に なること。' },
    { p: '水に流す',       m: '過去の もめごとを、なかったことに すること。' },
    { p: '顔から火が出る', m: 'とても はずかしくて、顔が 赤く なること。' },
    { p: '肩を持つ',       m: '味方を して、その人を かばうこと。' },
    { p: '音を上げる',     m: '苦しさに たえられず、弱音を はくこと。' },
    { p: '足が棒になる',   m: '長く 歩いて、足が ひどく つかれること。' },
    { p: '図に乗る',       m: '調子に 乗って、つけあがること。' },
    { p: 'ねこの手も借りたい', m: 'とても いそがしくて、だれの 手でも かりたいほどだ ということ。' },
  ];

  function genKanyouku() {
    const idx = Math.floor(Math.random() * KANYOUKU.length);
    const target = KANYOUKU[idx];
    const others = shuffle(KANYOUKU.filter((_, i) => i !== idx)).slice(0, 3);
    const meaningToPhrase = Math.random() < 0.5;
    if (meaningToPhrase) {
      return {
        itemRef: `kokugo4/grammar/kanyouku/toP/${target.p}`,
        category: 'ことば：慣用句',
        prompt: `「${target.m}」\nこの意味を表す慣用句はどれですか。`,
        options: shuffle([target.p, ...others.map(o => o.p)]),
        correctAnswer: target.p,
      };
    }
    return {
      itemRef: `kokugo4/grammar/kanyouku/toM/${target.p}`,
      category: 'ことば：慣用句',
      prompt: `「${target.p}」の意味に、いちばん近いものはどれですか。`,
      options: shuffle([target.m, ...others.map(o => o.m)]),
      correctAnswer: target.m,
    };
  }

  // ── registry + quiz builder ────────────────────────────────────────────
  const GRAMMAR_UNITS = {
    bushu:        { key: 'bushu',        title: '部首', desc: '漢字の 部首（へん・つくりなど）を 見分けます。', gen: genBushu },
    jukugo:       { key: 'jukugo',       title: '熟語の組み立て', desc: '二字の 熟語が どんな 組み立てかを 考えます。', gen: genJukugo },
    setsuzoku:    { key: 'setsuzoku',    title: 'つなぎ言葉', desc: '二つの 文を つなぐ つなぎ言葉（接続語）を 選びます。', gen: genSetsuzoku },
    shugo_jutsugo:{ key: 'shugo_jutsugo',title: '主語・述語', desc: '文の 主語と 述語を 見つけます。', gen: genShugoJutsugo },
    kanyouku:     { key: 'kanyouku',     title: '慣用句', desc: '慣用句の 意味を、正しく 結びつけます。', gen: genKanyouku },
  };

  // Units backed by a finite bank shouldn't repeat the same base item within one
  // session unless the bank is exhausted. The base ref drops direction detail so
  // both directions of one 慣用句 count as one; setsuzoku collapses to its
  // (relation, pair). shugo_jutsugo is fully procedural over large banks, so it
  // is not de-duped.
  const FINITE = {
    bushu:     { size: BUSHU.length,   baseRef: ref => ref },
    jukugo:    { size: JUKUGO.length,  baseRef: ref => ref },
    setsuzoku: { size: SETSUZOKU_KEYS.reduce((n, k) => n + SETSUZOKU[k].pairs.length, 0), baseRef: ref => ref },
    kanyouku:  { size: KANYOUKU.length, baseRef: ref => ref.replace(/\/(toP|toM)\//, '/') },
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
      genBushu, genJukugo, genSetsuzoku, genShugoJutsugo, genKanyouku,
      RADICALS, BUSHU, JUKUGO_CATS, JUKUGO, SETSUZOKU, SETSUZOKU_KEYS, SETSUZOKU_POOL,
      SJ_SUBJ, SJ_OBJ, SJ_ADV, SJ_VERB, KANYOUKU,
    },
  };
  if (typeof window !== 'undefined') { window.GRAMMAR_UNITS = GRAMMAR_UNITS; window.generateGrammarQuiz = generateGrammarQuiz; window.GrammarGen = api; }
  if (typeof module !== 'undefined') module.exports = api;
})();
