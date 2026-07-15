// grammar-generators.js — procedural generators for the grade-3 language /
// grammar drills (こそあど言葉・修飾語・ことわざ故事成語・ローマ字). Same
// "generator, not fixed bank" philosophy as kanji-generator.js: these are
// closed, systematic rule-sets, so questions are produced procedurally with
// randomized distractors rather than hand-authored one by one.
//
// COLLISION DISCIPLINE (this project's kanji generator shipped two real
// "a wrong option is secretly also correct" bugs): every generator here is
// built so that, by construction, a distractor can NEVER also be a valid
// answer — see the per-generator notes. grammar-generators.test.js
// stress-tests all four at scale and asserts this holds.

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
  //  1. こそあど言葉 (demonstratives)
  //  Each "column" (物 / 連体 / 場所 / 方向) has exactly four members, one
  //  per distance category こ(near speaker)/そ(near listener)/あ(far from
  //  both)/ど(asking). Options are ALWAYS the four members of one column, so
  //  the correct member for the chosen distance is unique and the other three
  //  are its siblings — a distractor is never also correct because each
  //  (column, distance) pair maps to exactly one word.
  // ══════════════════════════════════════════════════════════════════════
  const KOSOADO_COLUMNS = [
    {
      col: 'thing',
      // ko, so, a, do
      words: ['これ', 'それ', 'あれ', 'どれ'],
      scenarios: {
        ko: '自分の手もとにある物を指して「___ を 見て。」と言うとき',
        so: '相手のそばにある物を指して「その ___ を 取って。」…相手の近くの物を指すとき',
        a: '自分からも相手からも遠くにある物を指して「___ は 何だろう。」と言うとき',
        do: 'どの物か分からなくて「___ が ほしいの。」とたずねるとき',
      },
    },
    {
      col: 'place',
      words: ['ここ', 'そこ', 'あそこ', 'どこ'],
      scenarios: {
        ko: '今、自分がいる場所を指して「___ で 待つね。」と言うとき',
        so: '相手がいる場所を指して「___ に いるんだね。」と言うとき',
        a: '自分からも相手からも遠い場所を指して「___ まで 行こう。」と言うとき',
        do: '場所が分からなくて「___ に あるの。」とたずねるとき',
      },
    },
    {
      col: 'direction',
      words: ['こちら', 'そちら', 'あちら', 'どちら'],
      scenarios: {
        ko: '自分のいる方を指して「___ へ どうぞ。」とすすめるとき',
        so: '相手のいる方を指して「___ は 雨ですか。」とたずねるとき',
        a: '自分からも相手からも遠い方を指して「___ に 山が 見える。」と言うとき',
        do: '方向が分からなくて「___ へ 進むの。」とたずねるとき',
      },
    },
  ];
  const KOSOADO_RENTAI = {
    // 連体詞 この/その/あの/どの — need a following noun.
    words: ['この', 'その', 'あの', 'どの'],
    nouns: ['本', 'かばん', '花', '車', '犬', 'ぼうし'],
    scenarios: {
      ko: '自分のすぐ近くにある{n}を指すとき',
      so: '相手の近くにある{n}を指すとき',
      a: '自分からも相手からも遠くにある{n}を指すとき',
      do: 'どの{n}か分からなくてたずねるとき',
    },
  };
  const KOSOADO_DIST = ['ko', 'so', 'a', 'do'];
  const KOSOADO_IDX = { ko: 0, so: 1, a: 2, do: 3 };

  function genKosoado() {
    const useRentai = Math.random() < 0.35;
    const dist = pick(KOSOADO_DIST);
    if (useRentai) {
      const noun = pick(KOSOADO_RENTAI.nouns);
      const correct = KOSOADO_RENTAI.words[KOSOADO_IDX[dist]];
      const scenario = KOSOADO_RENTAI.scenarios[dist].replace(/\{n\}/g, noun);
      return {
        itemRef: `kokugo3/grammar/kosoado/rentai/${dist}`,
        category: 'ことば：こそあど言葉',
        prompt: `${scenario}、「___ ${noun}」の ___ に入る言葉はどれですか。`,
        options: shuffle(KOSOADO_RENTAI.words.slice()),
        correctAnswer: correct,
      };
    }
    const column = pick(KOSOADO_COLUMNS);
    const correct = column.words[KOSOADO_IDX[dist]];
    return {
      itemRef: `kokugo3/grammar/kosoado/${column.col}/${dist}`,
      category: 'ことば：こそあど言葉',
      prompt: `${column.scenarios[dist]}、___ に入る言葉はどれですか。`,
      options: shuffle(column.words.slice()),
      correctAnswer: correct,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  2. 修飾語 (modifiers)
  //  Sentence shape (4 bunsetsu): [連体修飾=adj] [主語=noun+が] [連用修飾=adv]
  //  [述語=verb]. Two question forms:
  //    - 連体: which word describes the NOUN? -> the adjective (only a 連体
  //      modifier can describe a noun; the adverb describes the verb, the
  //      verb/subject can't describe the noun).
  //    - 連用: which word describes the VERB? -> the adverb (only a 連用
  //      modifier can; the adjective describes the noun, the subject is not a
  //      修飾語). So the answer is unique and the other three bunsetsu are
  //      safe distractors by construction.
  //  Adjective bank = strictly 連体 (noun-modifying) forms; adverb bank =
  //  strictly 連用 (verb-modifying) forms — kept disjoint so no word can
  //  legitimately modify both targets.
  // ══════════════════════════════════════════════════════════════════════
  const SHU_ADJ = ['小さな', '大きな', '白い', '黒い', 'かわいい', '新しい', '赤い', '古い'];
  const SHU_NOUN = ['犬', '鳥', '子ども', '花', '魚', 'ねこ', '車', '風船'];
  const SHU_ADV = ['ゆっくり', '元気に', '楽しそうに', 'しずかに', 'すばやく', 'そっと'];
  const SHU_VERB = ['歩く', '走る', '遊ぶ', '泳ぐ', '鳴く', 'とぶ', 'わらう'];

  function genShuushoku() {
    const adj = pick(SHU_ADJ);
    const noun = pick(SHU_NOUN);
    const adv = pick(SHU_ADV);
    const verb = pick(SHU_VERB);
    const subj = `${noun}が`;
    const sentence = `${adj} ${subj} ${adv} ${verb}。`;
    const bunsetsu = [adj, subj, adv, verb];
    const rentai = Math.random() < 0.5;
    if (rentai) {
      return {
        itemRef: 'kokugo3/grammar/shuushoku/rentai',
        category: 'ことば：修飾語',
        prompt: `「${sentence}」\n「${subj}」を くわしく している 言葉は どれですか。`,
        options: shuffle(bunsetsu.slice()),
        correctAnswer: adj,
      };
    }
    return {
      itemRef: 'kokugo3/grammar/shuushoku/renyou',
      category: 'ことば：修飾語',
      prompt: `「${sentence}」\n「${verb}」を くわしく している 言葉は どれですか。`,
      options: shuffle(bunsetsu.slice()),
      correctAnswer: adv,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  3. ことわざ・故事成語 (proverbs / idioms)
  //  Fixed, curated bank. Every entry has a DISTINCT meaning (no two proverbs
  //  in the bank share a meaning), so when the correct meaning/proverb is one
  //  entry, any other entry used as a distractor is guaranteed wrong — the
  //  "secretly also correct" trap can't occur. Near-synonyms were dropped
  //  during curation for exactly this reason.
  // ══════════════════════════════════════════════════════════════════════
  const KOTOWAZA = [
    { p: '石の上にも三年', m: 'つらくても、しんぼう強く続ければ、いつか成功するということ。' },
    { p: 'ちりも積もれば山となる', m: 'わずかな物でも、積み重なれば大きな物になるということ。' },
    { p: '花より団子', m: '見た目の美しさよりも、役に立つものの方がよいということ。' },
    { p: '急がば回れ', m: '急ぐときこそ、遠くても安全で確実な方法を選ぶ方がよいということ。' },
    { p: '七転び八起き', m: '何度失敗しても、あきらめずに立ち上がってがんばること。' },
    { p: 'さるも木から落ちる', m: 'その道の名人でも、ときには失敗することがあるということ。' },
    { p: 'ねこに小判', m: '値打ちの分からない人には、よい物をあたえてもむだだということ。' },
    { p: '二階から目薬', m: '思うようにいかなくて、もどかしいこと。' },
    { p: '犬も歩けば棒に当たる', m: '何かをしていると、思いがけない幸運や災難に出会うということ。' },
    { p: '一石二鳥', m: '一つのことをして、同時に二つの得をすること。' },
    { p: '十人十色', m: '人によって、考えや好みはそれぞれちがうということ。' },
    { p: '百聞は一見にしかず', m: '何度も聞くより、一度自分の目で見る方がよく分かるということ。' },
    { p: '五十歩百歩', m: '少しのちがいはあっても、だいたい同じであるということ。' },
    { p: '漁夫の利', m: '二人が争っているうちに、別の人が横から利益を取ってしまうこと。' },
    { p: '矛盾', m: '話の前と後のつじつまが合わないこと。' },
    { p: '蛇足', m: 'しなくてもよい、よけいなつけたしのこと。' },
    { p: '転ばぬ先のつえ', m: '失敗しないように、前もって用心しておくこと。' },
    { p: '早起きは三文の得', m: '早く起きると、何かしらよいことがあるということ。' },
    { p: '頭かくして尻かくさず', m: '悪い所の一部だけをかくして、全部かくしたつもりでいること。' },
    { p: '泣きっ面に蜂', m: '悪いことの上に、さらに悪いことが重なること。' },
  ];

  function genKotowaza() {
    const idx = Math.floor(Math.random() * KOTOWAZA.length);
    const target = KOTOWAZA[idx];
    const others = shuffle(KOTOWAZA.filter((_, i) => i !== idx)).slice(0, 3);
    const meaningToProverb = Math.random() < 0.5;
    if (meaningToProverb) {
      // Given the meaning, choose the proverb.
      return {
        itemRef: `kokugo3/grammar/kotowaza/toP/${target.p}`,
        category: 'ことば：ことわざ・故事成語',
        prompt: `「${target.m}」\nこの意味を表すことわざ・故事成語はどれですか。`,
        options: shuffle([target.p, ...others.map(o => o.p)]),
        correctAnswer: target.p,
      };
    }
    // Given the proverb, choose the meaning.
    return {
      itemRef: `kokugo3/grammar/kotowaza/toM/${target.p}`,
      category: 'ことば：ことわざ・故事成語',
      prompt: `「${target.p}」の意味に、いちばん近いものはどれですか。`,
      options: shuffle([target.m, ...others.map(o => o.m)]),
      correctAnswer: target.m,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  4. ローマ字 (romaji)
  //  System: 訓令式 (kunrei-shiki), the primary system taught in grade-3
  //  国語. A romanizer builds the canonical answer from a kana table; the
  //  ヘボン式 (Hepburn) alternate of the SAME word is computed and excluded
  //  from the distractor pool, so a "wrong" romaji option can never actually
  //  be a valid alternate spelling of the target (the し=si/shi, つ=tu/tsu,
  //  etc. trap). Covers sokuon (っ), long vowels (repeated vowel), and ん.
  // ══════════════════════════════════════════════════════════════════════
  const KANA_KUNREI = {
    'あ':'a','い':'i','う':'u','え':'e','お':'o',
    'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
    'さ':'sa','し':'si','す':'su','せ':'se','そ':'so',
    'た':'ta','ち':'ti','つ':'tu','て':'te','と':'to',
    'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
    'は':'ha','ひ':'hi','ふ':'hu','へ':'he','ほ':'ho',
    'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
    'や':'ya','ゆ':'yu','よ':'yo',
    'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
    'わ':'wa','を':'wo','ん':'n',
    'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
    'ざ':'za','じ':'zi','ず':'zu','ぜ':'ze','ぞ':'zo',
    'だ':'da','ぢ':'zi','づ':'zu','で':'de','ど':'do',
    'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
    'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
    'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
    'しゃ':'sya','しゅ':'syu','しょ':'syo',
    'ちゃ':'tya','ちゅ':'tyu','ちょ':'tyo',
    'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
    'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
    'みゃ':'mya','みゅ':'myu','みょ':'myo',
    'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
    'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
    'じゃ':'zya','じゅ':'zyu','じょ':'zyo',
    'びゃ':'bya','びゅ':'byu','びょ':'byo',
    'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
  };
  const SMALL_Y = { 'ゃ':1, 'ゅ':1, 'ょ':1 };

  function romanizeKunrei(word) {
    let out = '';
    let sokuon = false;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (ch === 'っ') { sokuon = true; continue; }
      let kana = ch;
      if (i + 1 < word.length && SMALL_Y[word[i + 1]]) { kana = ch + word[i + 1]; i++; }
      let rom = KANA_KUNREI[kana];
      if (rom == null) return null; // unsupported kana -> skip this word
      if (sokuon) { rom = rom[0] + rom; sokuon = false; }
      out += rom;
    }
    return out;
  }

  // ヘボン式 alternate of a word's kunrei romaji, for distractor exclusion.
  // (Whole-string substitution — digraphs first so 'sya' becomes 'sha' before
  // the bare 'si'->'shi' rule can touch it.)
  function toHepburn(kunrei) {
    let s = kunrei;
    const rules = [
      ['sya','sha'],['syu','shu'],['syo','sho'],
      ['tya','cha'],['tyu','chu'],['tyo','cho'],
      ['zya','ja'],['zyu','ju'],['zyo','jo'],
      ['si','shi'],['ti','chi'],['tu','tsu'],['hu','fu'],['zi','ji'],
    ];
    for (const [a, b] of rules) s = s.split(a).join(b);
    return s;
  }

  // Word bank: only kana the romanizer supports; deliberately excludes お列/
  // え列 long vowels (おう/えい — their romanization convention is itself
  // ambiguous) and っち/っし/っつ clusters (Hepburn sokuon irregularities),
  // so every entry has exactly one clean kunrei form and one Hepburn form.
  const ROMAJI_WORDS = [
    'ねこ','いぬ','さかな','やま','かめ','とり','くも','うみ','あめ','ゆき',
    'はな','みず','すいか','たまご','さくら','くるま','はさみ','ぱんだ','みかん','りんご',
    'ほん','きりん','しんぶん','でんしゃ','つくえ','ちず','ふね','しお','くつ','いす',
    'きって','きっぷ','らっぱ','ねっこ','まっか',
    'おかあさん','おにいさん','くうき','おおきい','おばあさん',
  ];
  // Precompute (hiragana, kunrei) pairs, dropping any the romanizer rejects.
  const ROMAJI_BANK = ROMAJI_WORDS
    .map(w => ({ kana: w, rom: romanizeKunrei(w) }))
    .filter(x => x.rom);

  const VOWELS = ['a', 'i', 'u', 'e', 'o'];
  const CONSONANTS = 'kstnhmyrwgzdbp'.split('');

  // Build wrong-but-plausible romaji distractors by perturbing the correct
  // one (swap a vowel, toggle a sokuon double, drop/add a repeated vowel).
  function romajiDistractors(correct, forbidden) {
    const out = [];
    const add = (s) => {
      if (s && s !== correct && !forbidden.has(s) && !out.includes(s)) out.push(s);
    };
    const chars = correct.split('');
    // vowel swaps
    for (let i = 0; i < chars.length; i++) {
      if (VOWELS.includes(chars[i])) {
        for (const v of VOWELS) {
          if (v !== chars[i]) { const c = chars.slice(); c[i] = v; add(c.join('')); }
        }
      }
    }
    // sokuon toggle: remove one of a doubled consonant, or double a consonant
    for (let i = 1; i < chars.length; i++) {
      if (chars[i] === chars[i - 1] && CONSONANTS.includes(chars[i])) {
        add(correct.slice(0, i) + correct.slice(i + 1)); // undouble
      }
    }
    for (let i = 0; i < chars.length; i++) {
      if (CONSONANTS.includes(chars[i]) && i > 0 && VOWELS.includes(chars[i - 1])) {
        add(correct.slice(0, i) + chars[i] + correct.slice(i)); // double
      }
    }
    // drop a repeated vowel (long-vowel error)
    for (let i = 1; i < chars.length; i++) {
      if (chars[i] === chars[i - 1] && VOWELS.includes(chars[i])) {
        add(correct.slice(0, i) + correct.slice(i + 1));
      }
    }
    return shuffle(out);
  }

  function genRomaji() {
    const entry = pick(ROMAJI_BANK);
    const forbidden = new Set([entry.rom, toHepburn(entry.rom)]);
    const kanaToRomaji = Math.random() < 0.6;
    if (kanaToRomaji) {
      let distractors = romajiDistractors(entry.rom, forbidden).slice(0, 3);
      if (distractors.length < 3) {
        // Fall back to other words' romaji (still excluding any Hepburn alt).
        const pool = shuffle(ROMAJI_BANK.filter(e => e.kana !== entry.kana))
          .map(e => e.rom)
          .filter(r => !forbidden.has(r) && r !== entry.rom && !distractors.includes(r));
        while (distractors.length < 3 && pool.length) distractors.push(pool.shift());
      }
      return {
        itemRef: `kokugo3/grammar/romaji/toR/${entry.kana}`,
        category: 'ことば：ローマ字',
        prompt: `「${entry.kana}」をローマ字（訓令式）で書くと、どれですか。`,
        options: shuffle([entry.rom, ...distractors]),
        correctAnswer: entry.rom,
      };
    }
    // romaji -> hiragana: options are distinct bank words (unique mapping).
    const others = shuffle(ROMAJI_BANK.filter(e => e.kana !== entry.kana)).slice(0, 3);
    return {
      itemRef: `kokugo3/grammar/romaji/toK/${entry.kana}`,
      category: 'ことば：ローマ字',
      prompt: `ローマ字（訓令式）で「${entry.rom}」と書く言葉はどれですか。`,
      options: shuffle([entry.kana, ...others.map(o => o.kana)]),
      correctAnswer: entry.kana,
    };
  }

  // ── registry + quiz builder ────────────────────────────────────────────
  const GRAMMAR_UNITS = {
    kosoado: { key: 'kosoado', title: 'こそあど言葉', desc: 'これ・それ・あれ・どれ など、指し示す言葉を選びます。', gen: genKosoado },
    shuushoku: { key: 'shuushoku', title: '修飾語', desc: 'どの言葉が、どの言葉をくわしくしているかを考えます。', gen: genShuushoku },
    kotowaza: { key: 'kotowaza', title: 'ことわざ・故事成語', desc: 'ことわざや故事成語の意味を、正しく結びつけます。', gen: genKotowaza },
    romaji: { key: 'romaji', title: 'ローマ字', desc: 'ひらがなとローマ字（訓令式）を、書きかえます。', gen: genRomaji },
  };

  function generateGrammarQuiz(unitKey, count) {
    const unit = GRAMMAR_UNITS[unitKey];
    if (!unit) return [];
    const out = [];
    // kotowaza draws from a finite bank; avoid repeating the same proverb in
    // one session where possible (fall back to allowing repeats if count is
    // larger than the bank).
    const usedRefs = new Set();
    let guard = 0;
    while (out.length < count && guard < count * 40) {
      guard++;
      const q = unit.gen();
      if (unitKey === 'kotowaza') {
        const baseRef = q.itemRef.replace(/\/(toP|toM)\//, '/');
        if (usedRefs.has(baseRef) && usedRefs.size < KOTOWAZA.length) continue;
        usedRefs.add(baseRef);
      }
      out.push(q);
    }
    return out;
  }

  const api = {
    GRAMMAR_UNITS,
    generateGrammarQuiz,
    // exported for the stress test
    _internals: { genKosoado, genShuushoku, genKotowaza, genRomaji, romanizeKunrei, toHepburn, KOTOWAZA, ROMAJI_BANK },
  };
  if (typeof window !== 'undefined') { window.GRAMMAR_UNITS = GRAMMAR_UNITS; window.generateGrammarQuiz = generateGrammarQuiz; window.GrammarGen = api; }
  if (typeof module !== 'undefined') module.exports = api;
})();
