// grammar-generators.js — procedural generators for the grade-2 kana /
// orthography / grammar drills (カタカナ・かなづかい・主語と述語・なかまの
// 言葉と反対の言葉・丸点かぎ). Same "generator, not fixed bank" philosophy as
// kokugo3's grammar-generators.js: these are closed, systematic rule-sets, so
// questions are produced procedurally (or from curated banks where the rule
// has real exceptions) with randomized distractors.
//
// COLLISION DISCIPLINE (this project's kanji generator shipped two real
// "a wrong option is secretly also correct" bugs): every generator here is
// built so that, by construction, a distractor can NEVER also be a valid
// answer — see the per-generator notes. grammar-generators.test.js
// stress-tests all five at scale and asserts this holds.

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
  // sample n distinct elements from arr
  function sample(arr, n) { return shuffle(arr).slice(0, n); }

  // ══════════════════════════════════════════════════════════════════════
  //  1. カタカナ (katakana)
  //  Two question forms, both collision-safe:
  //   (a) form: a single kana's katakana form (or the reverse). The
  //       hiragana<->katakana mapping is bijective, so exactly one option is
  //       the target's form and the other three (other kana) are all wrong.
  //   (b) usage: which of four words is written in カタカナ? The bank of
  //       外来語/擬音語 (KATAKANA_WORDS) and the bank of native words
  //       (NATIVE_WORDS) are DISJOINT, so exactly one option is a katakana
  //       word and the three native distractors never are.
  // ══════════════════════════════════════════════════════════════════════
  // Basic gojūon + dakuten/handakuten hiragana (no small kana). Katakana is
  // computed by the fixed +0x60 codepoint offset (あ U+3042 -> ア U+30A2).
  const HIRAGANA_BASIC = (
    'あいうえお' + 'かきくけこ' + 'さしすせそ' + 'たちつてと' + 'なにぬねの' +
    'はひふへほ' + 'まみむめも' + 'やゆよ' + 'らりるれろ' + 'わをん' +
    'がぎぐげご' + 'ざじずぜぞ' + 'だでど' + 'ばびぶべぼ' + 'ぱぴぷぺぽ'
  ).split('');
  const toKatakana = (h) => String.fromCharCode(h.charCodeAt(0) + 0x60);

  const KATAKANA_WORDS = [
    'テレビ', 'ラジオ', 'パン', 'コップ', 'ノート', 'ボール', 'ピアノ', 'バス',
    'タクシー', 'ケーキ', 'トマト', 'カレー', 'ペン', 'ガラス', 'スプーン',
    'フォーク', 'ドア', 'ロボット', 'ボタン', 'ポケット', 'スカート', 'シャツ',
    'ミルク', 'ジュース', 'チョコレート', 'アイス', 'プール', 'ブランコ',
    'ワンワン', 'ニャーニャー', 'ゴロゴロ', 'ザーザー', 'ドンドン', 'コケコッコー',
  ];
  const NATIVE_WORDS = [
    'いぬ', 'ねこ', 'やま', 'かわ', 'はな', 'みず', 'そら', 'つき', 'ほし', 'とり',
    'さかな', 'むし', 'いし', 'あめ', 'ゆき', 'かぜ', 'うみ', 'もり', 'はたけ',
    'ごはん', 'おにぎり', 'たまご', 'みそしる', 'くつ', 'ぼうし', 'かさ', 'つくえ',
    'いす', 'まど', 'いえ', 'こうえん', 'せんせい', 'ともだち', 'て', 'あし',
    'あたま', 'くち', 'みみ', 'ゆび', 'みち',
  ];

  function genKatakana() {
    const roll = Math.random();
    if (roll < 0.5) {
      // form: hiragana -> katakana (or reverse)
      const h = pick(HIRAGANA_BASIC);
      const others = sample(HIRAGANA_BASIC.filter(x => x !== h), 3);
      const hira2kata = Math.random() < 0.5;
      if (hira2kata) {
        return {
          itemRef: `kokugo2/grammar/katakana/form/toK/${h}`,
          category: 'ことば：カタカナ',
          prompt: `「${h}」を カタカナで 書くと どれですか。`,
          options: shuffle([toKatakana(h), ...others.map(toKatakana)]),
          correctAnswer: toKatakana(h),
        };
      }
      return {
        itemRef: `kokugo2/grammar/katakana/form/toH/${h}`,
        category: 'ことば：カタカナ',
        prompt: `「${toKatakana(h)}」を ひらがなで 書くと どれですか。`,
        options: shuffle([h, ...others]),
        correctAnswer: h,
      };
    }
    // usage: which word is written in katakana (外来語 / 擬音語)?
    const kw = pick(KATAKANA_WORDS);
    const distractors = sample(NATIVE_WORDS, 3);
    return {
      itemRef: `kokugo2/grammar/katakana/use/${kw}`,
      category: 'ことば：カタカナ',
      prompt: 'つぎの うち、カタカナで 書く 言葉は どれですか。',
      options: shuffle([kw, ...distractors]),
      correctAnswer: kw,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  2. かなづかい (kana orthography)
  //  Two question forms:
  //   (a) particle spelling は/を/へ: the topic particle は and one of を/へ
  //       each have exactly one correct spelling (は / を / へ) and one common
  //       wrong spelling (わ / お / え). The four options are the four
  //       spellings of the SAME sentence formed by toggling the two particles,
  //       so EXACTLY ONE option has both particles right — the other three are
  //       genuinely wrong.
  //   (b) word spelling (ぢ/じ, づ/ず, 長音, 拗音, 促音): a curated bank where
  //       each cue word has ONE standard spelling and three hand-authored
  //       wrong spellings. These rules have real exceptions (氷=こおり but
  //       王さま=おうさま), so the answer is fixed per entry — a distractor is
  //       never also correct because the correct spelling is authored, not
  //       derived. The spec's homophone caution is met by cueing with the word
  //       (kanji/gloss) so exactly one hiragana spelling is right.
  // ══════════════════════════════════════════════════════════════════════
  const KZ_SUBJECTS = ['わたし', 'ぼく', 'おとうと', 'いもうと', 'ともだち', 'せんせい', 'あね', 'あに'];
  const KZ_HE = {
    dests: ['がっこう', 'こうえん', 'うみ', 'やま', 'えき', 'いえ'],
    verbs: ['いきます', 'いった', 'あるく', 'むかう'],
  };
  const KZ_WO = {
    objs: ['ごはん', 'パン', 'みず', 'ほん', 'えほん', 'おちゃ'],
    verbs: ['たべる', 'よむ', 'のむ', 'かう'],
  };

  function genKanazukaiParticle() {
    const subj = pick(KZ_SUBJECTS);
    const useHe = Math.random() < 0.5;
    let mid, verb, correct2, wrong2, kind;
    if (useHe) {
      mid = pick(KZ_HE.dests); verb = pick(KZ_HE.verbs);
      correct2 = 'へ'; wrong2 = 'え'; kind = 'he';
    } else {
      mid = pick(KZ_WO.objs); verb = pick(KZ_WO.verbs);
      correct2 = 'を'; wrong2 = 'お'; kind = 'wo';
    }
    const build = (p1, p2) => `${subj}${p1} ${mid}${p2} ${verb}。`;
    const correct = build('は', correct2);
    const opts = [
      correct,
      build('わ', correct2),
      build('は', wrong2),
      build('わ', wrong2),
    ];
    return {
      itemRef: `kokugo2/grammar/kanazukai/particle/${kind}`,
      category: 'ことば：かなづかい',
      prompt: 'かなづかいが 正しい 文は どれですか。',
      options: shuffle(opts),
      correctAnswer: correct,
    };
  }

  // Curated orthography bank. Each: cue (the word, as kanji/gloss), the one
  // standard hiragana spelling, and three genuinely-wrong spellings.
  const KANAZUKAI_WORDS = [
    { cue: '三日月', correct: 'みかづき', wrong: ['みかずき', 'みかづぎ', 'みっかづき'] },
    { cue: '鼻血', correct: 'はなぢ', wrong: ['はなじ', 'はなぢぃ', 'はなちぃ'] },
    { cue: '縮む', correct: 'ちぢむ', wrong: ['ちじむ', 'ちづむ', 'ちぢゅむ'] },
    { cue: '続く', correct: 'つづく', wrong: ['つずく', 'つづぐ', 'づつく'] },
    { cue: '近々', correct: 'ちかぢか', wrong: ['ちかじか', 'ちかづか', 'ちかぢが'] },
    { cue: 'お父さん', correct: 'おとうさん', wrong: ['おとおさん', 'おとーさん', 'おとさん'] },
    { cue: 'お母さん', correct: 'おかあさん', wrong: ['おかーさん', 'おかさん', 'おがあさん'] },
    { cue: 'お兄さん', correct: 'おにいさん', wrong: ['おにーさん', 'おにさん', 'おいにさん'] },
    { cue: 'お姉さん', correct: 'おねえさん', wrong: ['おねいさん', 'おねーさん', 'おねさん'] },
    { cue: '氷', correct: 'こおり', wrong: ['こうり', 'こをり', 'こおおり'] },
    { cue: '遠く', correct: 'とおく', wrong: ['とうく', 'とをく', 'とおおく'] },
    { cue: '大きい', correct: 'おおきい', wrong: ['おうきい', 'おおきぃ', 'おきい'] },
    { cue: '通り', correct: 'とおり', wrong: ['とうり', 'とをり', 'とおおり'] },
    { cue: '時計', correct: 'とけい', wrong: ['とけえ', 'とけぃ', 'とけー'] },
    { cue: '先生', correct: 'せんせい', wrong: ['せんせえ', 'せんせぃ', 'せんせー'] },
    { cue: '学校', correct: 'がっこう', wrong: ['がつこう', 'がっこお', 'がこう'] },
    { cue: '切手', correct: 'きって', wrong: ['きつて', 'きいて', 'きっって'] },
    { cue: '切符', correct: 'きっぷ', wrong: ['きつぷ', 'きっぷう', 'きぷ'] },
    { cue: '宿題', correct: 'しゅくだい', wrong: ['しゆくだい', 'しゅくだいい', 'しゅくだ'] },
    { cue: '電車', correct: 'でんしゃ', wrong: ['でんしや', 'でんしゃあ', 'でんちゃ'] },
    { cue: 'お客さん', correct: 'おきゃくさん', wrong: ['おきやくさん', 'おきゃくさぁん', 'おきくさん'] },
    { cue: '金魚', correct: 'きんぎょ', wrong: ['きんぎよ', 'きんぎょう', 'きぎょ'] },
    { cue: '王さま', correct: 'おうさま', wrong: ['おおさま', 'をうさま', 'おうさまあ'] },
    { cue: 'こおろぎ', correct: 'こおろぎ', wrong: ['こうろぎ', 'こをろぎ', 'ころぎ'] },
  ];

  function genKanazukaiWord() {
    const e = pick(KANAZUKAI_WORDS);
    return {
      itemRef: `kokugo2/grammar/kanazukai/word/${e.cue}`,
      category: 'ことば：かなづかい',
      prompt: `「${e.cue}」を ひらがなで 正しく 書いた ものは どれですか。`,
      options: shuffle([e.correct, ...e.wrong]),
      correctAnswer: e.correct,
    };
  }

  function genKanazukai() {
    return Math.random() < 0.4 ? genKanazukaiParticle() : genKanazukaiWord();
  }

  // ══════════════════════════════════════════════════════════════════════
  //  3. 主語と述語 (subject and predicate)
  //  Fixed 4-bunsetsu shape: [主語=noun+は/が] [目的語=noun+を] [連用=adverb]
  //  [述語=verb]. The four options are exactly these four bunsetsu.
  //   - 主語 question: the answer is the noun+は/が bunsetsu. The object ends
  //     in を, the adverb is an adverb, the verb is a verb — none can be the
  //     subject. Unique by construction.
  //   - 述語 question: the answer is the final verb. None of the other three
  //     bunsetsu is a predicate. Unique by construction.
  // ══════════════════════════════════════════════════════════════════════
  const SJ_SUBJECTS = ['犬', 'ねこ', 'とり', 'うま', 'おとうと', 'いもうと', 'おにいさん', 'おねえさん', '先生', 'ともだち', '子ども', 'あかちゃん'];
  const SJ_OBJ_VERB = [
    ['ボールを', 'なげる'], ['本を', 'よむ'], ['ごはんを', 'たべる'],
    ['うたを', 'うたう'], ['水を', 'のむ'], ['えを', 'かく'],
    ['てがみを', 'かく'], ['パンを', 'たべる'], ['おちゃを', 'のむ'],
    ['にもつを', 'はこぶ'],
  ];
  const SJ_ADVERBS = ['ゆっくり', '元気に', 'たのしそうに', 'しずかに', 'すばやく', 'そっと', '大きな こえで', 'じょうずに'];

  function genShugoJutsugo() {
    const noun = pick(SJ_SUBJECTS);
    const particle = Math.random() < 0.5 ? 'は' : 'が';
    const subj = `${noun}${particle}`;
    const [obj, verb] = pick(SJ_OBJ_VERB);
    const adv = pick(SJ_ADVERBS);
    const sentence = `${subj} ${obj} ${adv} ${verb}。`;
    const bunsetsu = [subj, obj, adv, verb];
    const askSubject = Math.random() < 0.5;
    if (askSubject) {
      return {
        itemRef: 'kokugo2/grammar/shugo_jutsugo/shugo',
        category: 'ことば：主語と述語',
        prompt: `「${sentence}」\n「何が（だれが）」に あたる 主語は どれですか。`,
        options: shuffle(bunsetsu.slice()),
        correctAnswer: subj,
      };
    }
    return {
      itemRef: 'kokugo2/grammar/shugo_jutsugo/jutsugo',
      category: 'ことば：主語と述語',
      prompt: `「${sentence}」\n「どうする」に あたる 述語は どれですか。`,
      options: shuffle(bunsetsu.slice()),
      correctAnswer: verb,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  4. なかまの言葉・反対の言葉 (categories / antonyms)
  //   - antonym: each word appears in exactly ONE pair and has exactly ONE
  //     antonym in the bank; distractors are drawn from OTHER pairs' members,
  //     so a distractor is never also the target's antonym.
  //   - category (member-pick): the correct word is a member of the asked
  //     category; distractors come from OTHER categories. The categories are
  //     pairwise DISJOINT, so a distractor is never also a member.
  //   - category (odd-one-out): three words from one category + one outsider;
  //     the outsider is the unique answer (disjointness again).
  // ══════════════════════════════════════════════════════════════════════
  const ANTONYM_PAIRS = [
    ['大きい', '小さい'], ['たかい', 'ひくい'], ['ながい', 'みじかい'],
    ['おおい', 'すくない'], ['あたらしい', 'ふるい'], ['あかるい', 'くらい'],
    ['つよい', 'よわい'], ['ふとい', 'ほそい'], ['おもい', 'かるい'],
    ['ひろい', 'せまい'], ['うえ', 'した'], ['みぎ', 'ひだり'],
    ['まえ', 'うしろ'], ['いりぐち', 'でぐち'], ['かつ', 'まける'],
    ['あける', 'しめる'],
  ];
  const ANTONYM_MEMBERS = ANTONYM_PAIRS.flat();
  const ANTONYM_OF = new Map();
  ANTONYM_PAIRS.forEach(([a, b]) => { ANTONYM_OF.set(a, b); ANTONYM_OF.set(b, a); });

  function genAntonym() {
    const target = pick(ANTONYM_MEMBERS);
    const answer = ANTONYM_OF.get(target);
    const pool = ANTONYM_MEMBERS.filter(w => w !== target && w !== answer);
    const distractors = sample(pool, 3);
    return {
      itemRef: `kokugo2/grammar/nakama/antonym/${target}`,
      category: 'ことば：なかま・反対の言葉',
      prompt: `「${target}」の はんたいの 意味の 言葉は どれですか。`,
      options: shuffle([answer, ...distractors]),
      correctAnswer: answer,
    };
  }

  const CATEGORIES = {
    'くだもの': ['りんご', 'みかん', 'ばなな', 'いちご', 'ぶどう', 'もも', 'なし', 'メロン'],
    'どうぶつ': ['いぬ', 'ねこ', 'うま', 'うし', 'ぞう', 'きりん', 'さる', 'ぶた'],
    'やさい': ['にんじん', 'だいこん', 'なす', 'きゅうり', 'キャベツ', 'ねぎ', 'ピーマン', 'かぼちゃ'],
    'のりもの': ['でんしゃ', 'バス', 'じてんしゃ', 'ふね', 'ひこうき', 'くるま', 'タクシー'],
    'いろ': ['あか', 'あお', 'きいろ', 'みどり', 'しろ', 'くろ', 'ちゃいろ', 'むらさき'],
    'からだ': ['あたま', 'て', 'あし', 'め', 'みみ', 'くち', 'ゆび', 'かた'],
    'てんき': ['はれ', 'あめ', 'くもり', 'ゆき'],
  };
  const CATEGORY_NAMES = Object.keys(CATEGORIES);

  function genCategoryMember() {
    const cat = pick(CATEGORY_NAMES);
    const correct = pick(CATEGORIES[cat]);
    const otherWords = [];
    CATEGORY_NAMES.forEach(c => { if (c !== cat) otherWords.push(...CATEGORIES[c]); });
    const distractors = sample(otherWords, 3);
    return {
      itemRef: `kokugo2/grammar/nakama/category/${cat}`,
      category: 'ことば：なかま・反対の言葉',
      prompt: `つぎの うち、「${cat}」の なかまは どれですか。`,
      options: shuffle([correct, ...distractors]),
      correctAnswer: correct,
    };
  }

  function genOddOneOut() {
    const cat = pick(CATEGORY_NAMES);
    const three = sample(CATEGORIES[cat], 3);
    const otherWords = [];
    CATEGORY_NAMES.forEach(c => { if (c !== cat) otherWords.push(...CATEGORIES[c]); });
    const outsider = pick(otherWords);
    return {
      itemRef: `kokugo2/grammar/nakama/odd/${cat}`,
      category: 'ことば：なかま・反対の言葉',
      prompt: 'つぎの うち、なかま（同じ グループ）で ない ものは どれですか。',
      options: shuffle([outsider, ...three]),
      correctAnswer: outsider,
    };
  }

  function genNakama() {
    const roll = Math.random();
    if (roll < 0.45) return genAntonym();
    if (roll < 0.75) return genCategoryMember();
    return genOddOneOut();
  }

  // ══════════════════════════════════════════════════════════════════════
  //  5. 丸・点・かぎ (句読点・かぎかっこ)
  //   - usage: each of the four marks has a DISTINCT job (。=言い切りの文の
  //     おわり / 、=文の中の切れめ / 「」=話した言葉をかこむ / ？=たずねる文の
  //     おわり). The prompt names one job; only the matching mark is right.
  //   - name<->shape: the mark<->name mapping is bijective, so exactly one
  //     option matches.
  // ══════════════════════════════════════════════════════════════════════
  const MARKS = [
    { mark: '。', name: 'まる（句点）', use: '言い切りの 文の おわりに つける' },
    { mark: '、', name: 'てん（読点）', use: '文の 中の、言葉の 切れめに つける' },
    { mark: '「」', name: 'かぎ（かぎかっこ）', use: '人が 話した 言葉を かこむ' },
    { mark: '？', name: 'はてな（疑問符）', use: 'たずねる（聞く）文の おわりに つける' },
  ];

  function genKutoutenUsage() {
    const target = pick(MARKS);
    return {
      itemRef: `kokugo2/grammar/kutouten/use/${target.name}`,
      category: 'ことば：丸・点・かぎ',
      prompt: `「${target.use}」しるしは どれですか。`,
      options: shuffle(MARKS.map(m => m.mark)),
      correctAnswer: target.mark,
    };
  }

  function genKutoutenName() {
    const target = pick(MARKS);
    const markToName = Math.random() < 0.5;
    if (markToName) {
      return {
        itemRef: `kokugo2/grammar/kutouten/nameOf/${target.name}`,
        category: 'ことば：丸・点・かぎ',
        prompt: `「${target.mark}」の 名前は どれですか。`,
        options: shuffle(MARKS.map(m => m.name)),
        correctAnswer: target.name,
      };
    }
    return {
      itemRef: `kokugo2/grammar/kutouten/markOf/${target.name}`,
      category: 'ことば：丸・点・かぎ',
      prompt: `「${target.name}」の しるしは どれですか。`,
      options: shuffle(MARKS.map(m => m.mark)),
      correctAnswer: target.mark,
    };
  }

  function genKutouten() {
    return Math.random() < 0.5 ? genKutoutenUsage() : genKutoutenName();
  }

  // ── registry + quiz builder ────────────────────────────────────────────
  const GRAMMAR_UNITS = {
    katakana: { key: 'katakana', title: 'カタカナ', desc: 'カタカナの 形と、カタカナで 書く 言葉を おぼえます。', gen: genKatakana },
    kanazukai: { key: 'kanazukai', title: 'かなづかい', desc: 'は・を・へ や、づ・ぢ、のばす音などの 正しい 書き方を えらびます。', gen: genKanazukai },
    shugo_jutsugo: { key: 'shugo_jutsugo', title: '主語と述語', desc: '「何が どうする」の、主語と述語を 見つけます。', gen: genShugoJutsugo },
    nakama: { key: 'nakama', title: 'なかま・反対の言葉', desc: 'なかまの 言葉や、反対の 意味の 言葉を えらびます。', gen: genNakama },
    kutouten: { key: 'kutouten', title: '丸・点・かぎ', desc: '「。」「、」「かぎかっこ」の つかい方を おぼえます。', gen: genKutouten },
  };

  function generateGrammarQuiz(unitKey, count) {
    const unit = GRAMMAR_UNITS[unitKey];
    if (!unit) return [];
    const out = [];
    let guard = 0;
    // Avoid repeating the same base item within one session where the unit's
    // pool is finite enough to allow it (kanazukai words, nakama, kutouten).
    const usedRefs = new Set();
    const poolLimited = unitKey === 'kutouten';
    while (out.length < count && guard < count * 60) {
      guard++;
      const q = unit.gen();
      if (poolLimited) {
        // kutouten has a small mark set — de-dup by mark/name where possible.
        if (usedRefs.has(q.itemRef) && usedRefs.size < 12) continue;
        usedRefs.add(q.itemRef);
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
      genKatakana, genKanazukai, genKanazukaiParticle, genKanazukaiWord,
      genShugoJutsugo, genNakama, genAntonym, genCategoryMember, genOddOneOut,
      genKutouten,
      HIRAGANA_BASIC, toKatakana, KATAKANA_WORDS, NATIVE_WORDS,
      KANAZUKAI_WORDS, ANTONYM_PAIRS, ANTONYM_MEMBERS, ANTONYM_OF,
      CATEGORIES, CATEGORY_NAMES, MARKS,
    },
  };
  if (typeof window !== 'undefined') { window.GRAMMAR_UNITS = GRAMMAR_UNITS; window.generateGrammarQuiz = generateGrammarQuiz; window.GrammarGen = api; }
  if (typeof module !== 'undefined') module.exports = api;
})();
