// reading-units.js — 読解ユニット。生徒が授業で本文を読んだことを前提に、
// 内容の理解を確認する問題です。本文そのものは一切ふくまれていません
// （著作権の理由）。設問は、単元の構成・テーマについて広く知られている
// 情報（授業案・指導書などで公開されている単元構造）にもとづいて作成
// しています。
//
// IMPORTANT (for future contributors): this file must NEVER contain the
// actual text of any textbook passage — only questions ABOUT it, the way
// a workbook or teacher-made worksheet does. See project notes on the
// "reference, don't reproduce" model agreed for this module.
//
// Two content shapes live here:
//  - 説明文 (informational: daizu, ari) — questions center on the 問い→答え
//    structure, factual content, and observation-vs-conclusion reasoning.
//  - 物語・民話 (narrative/folktale: haru, maigo, chiichan, touge, mochimochi)
//    — questions center on character feelings/change, sequence of events,
//    theme, and vocabulary-in-context. The informational question shapes are
//    deliberately NOT forced onto these; each unit was researched for its own
//    real teaching focus (単元の目標).
//
// Units are listed in roughly the school-year order they are taught.

const READING_UNITS = {
  // ─────────────────────────────────────────────────────────────────────
  //  春風をたどって — 物語（国語三上 わかば・4月）如月かずさ
  //  Teaching focus: read a character's actions and how feelings change; the
  //  shift in setting mirrors ルウ's emotional shift (before/after contrast).
  // ─────────────────────────────────────────────────────────────────────
  haru: {
    title: '春風をたどって',
    author: '如月かずさ',
    volume: '国語三上 わかば',
    month: '4月',
    note: 'この物語を教室で読んだあとに取り組みましょう。',
    questions: [
      {
        itemRef: 'kokugo3/haru/character/01',
        category: '読解：登場人物',
        prompt: 'この物語の主人公「ルウ」は、どんな動物ですか。',
        options: ['リス', 'ウサギ', 'キツネ', 'タヌキ'],
        correctAnswer: 'リス',
      },
      {
        itemRef: 'kokugo3/haru/feeling_start/01',
        category: '読解：気持ち',
        prompt: '物語のはじめ、ルウは自分の住む森について、どんな気持ちでいましたか。',
        options: [
          'いつもの森にあきて、遠くの知らない場所にあこがれていた',
          '森がこわくて、どこにも出かけたくなかった',
          '森の食べ物が足りなくて、こまっていた',
          '友だちがいなくて、さびしがっていた',
        ],
        correctAnswer: 'いつもの森にあきて、遠くの知らない場所にあこがれていた',
      },
      {
        itemRef: 'kokugo3/haru/trigger/01',
        category: '読解：出来事',
        prompt: 'ルウとノノンが、森の中を進んで行くきっかけになったのは何ですか。',
        options: [
          '風にのってきた、よいかおり',
          '遠くで鳴っていた大きな音',
          '空からふってきた雨',
          '道におちていた地図',
        ],
        correctAnswer: '風にのってきた、よいかおり',
      },
      {
        itemRef: 'kokugo3/haru/discovery/01',
        category: '読解：出来事',
        prompt: 'かおりをたどって行った先で、ルウたちは何を見つけましたか。',
        options: [
          '青い花がいちめんにさく、知らなかった場所',
          '大きな町とたくさんの人',
          'こわれた古い家',
          '海にうかぶ船',
        ],
        correctAnswer: '青い花がいちめんにさく、知らなかった場所',
      },
      {
        itemRef: 'kokugo3/haru/feeling_change/01',
        category: '読解：気持ちの変化',
        prompt: '物語の終わりで、ルウの気持ちはどのように変わりましたか。',
        options: [
          '近くの森にも、まだ知らないすてきな場所があると気づき、これからもさがしたいと思った',
          'やっぱり遠くの森の方がよいと、あらためて思った',
          '森を出て、遠い町でくらそうと決めた',
          'もう二度と出かけないでおこうと思った',
        ],
        correctAnswer: '近くの森にも、まだ知らないすてきな場所があると気づき、これからもさがしたいと思った',
      },
      {
        itemRef: 'kokugo3/haru/theme/01',
        category: '読解：主題',
        prompt: 'この物語がいちばん伝えたいことに、近いのはどれですか。',
        options: [
          'すてきなものは、遠くだけでなく、身近なところにもかくれている',
          '遠くへ行くほど、よいものが見つかる',
          '一人でいる方が、楽しくすごせる',
          '知らない場所には、行かない方がよい',
        ],
        correctAnswer: 'すてきなものは、遠くだけでなく、身近なところにもかくれている',
      },
      {
        itemRef: 'kokugo3/haru/character/02',
        category: '読解：登場人物',
        prompt: 'ルウといっしょに、かおりをたどって行ったのはだれですか。',
        options: ['ノノン', 'じさま', 'りいこ', 'トルトリ'],
        correctAnswer: 'ノノン',
      },
      {
        itemRef: 'kokugo3/haru/reading_skill/01',
        category: '読解：読み方',
        prompt: '物語を読むとき、「場面がかわると、人物の気持ちもかわる」ことに気をつけて読むと、どんなことが分かりますか。',
        options: [
          '人物の気持ちが、どのように変わっていったか',
          'その本の作者が住んでいる町',
          '文章に出てくる漢字の画数',
          '物語のねだんや、ページ数',
        ],
        correctAnswer: '人物の気持ちが、どのように変わっていったか',
      },
      {
        itemRef: 'kokugo3/haru/genre/01',
        category: '読解：話の種類',
        prompt: '「春風をたどって」は、どんな種類の文章ですか。',
        options: [
          '人物の様子や気持ちがえがかれる、物語（お話）',
          '生き物の育て方を教える、説明文',
          '新聞にのっている、ニュースの記事',
          '数え方だけが書かれた、表',
        ],
        correctAnswer: '人物の様子や気持ちがえがかれる、物語（お話）',
      },
      {
        itemRef: 'kokugo3/haru/setting_season/01',
        category: '読解：場面のせってい',
        prompt: '題名や「春風」という言葉から、この物語はいつの季節のお話だと分かりますか。',
        options: ['春', '夏', '秋', '冬'],
        correctAnswer: '春',
      },
      {
        itemRef: 'kokugo3/haru/vocab_akogare/01',
        category: '読解：言葉の意味',
        prompt: '物語のはじめでルウが感じていた「あこがれ」とは、どんな気持ちを表す言葉ですか。',
        options: [
          'そこへ行きたい、そうなりたいと、強く心がひかれる気持ち',
          'こわくて、にげ出したい気持ち',
          'つかれて、ねむくなる気持ち',
          'おこって、ゆるせない気持ち',
        ],
        correctAnswer: 'そこへ行きたい、そうなりたいと、強く心がひかれる気持ち',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  //  まいごのかぎ — 物語（国語三上・6月）斉藤倫
  //  Teaching focus: read how りいこ's feelings change across scenes; imagine
  //  the fantastical events; before/after contrast (regret -> relief/joy).
  // ─────────────────────────────────────────────────────────────────────
  maigo: {
    title: 'まいごのかぎ',
    author: '斉藤倫',
    volume: '国語三上',
    month: '6月',
    note: 'この物語を教室で読んだあとに取り組みましょう。',
    questions: [
      {
        itemRef: 'kokugo3/maigo/character/01',
        category: '読解：登場人物',
        prompt: 'この物語の主人公はだれですか。',
        options: ['りいこ', 'ルウ', 'ちいちゃん', '豆太'],
        correctAnswer: 'りいこ',
      },
      {
        itemRef: 'kokugo3/maigo/feeling_start/01',
        category: '読解：気持ち',
        prompt: '物語のはじめ、りいこはどんな気持ちで歩いていましたか。',
        options: [
          '自分のかいた絵を消してしまい、しずんだ気持ちだった',
          'テストで百点を取って、うれしい気持ちだった',
          'おいしいものを食べて、まんぞくした気持ちだった',
          '遠足が楽しみで、わくわくした気持ちだった',
        ],
        correctAnswer: '自分のかいた絵を消してしまい、しずんだ気持ちだった',
      },
      {
        itemRef: 'kokugo3/maigo/object/key',
        category: '読解：出来事',
        prompt: 'りいこが道で拾ったものは何ですか。',
        options: ['金色のかぎ', '赤いぼうし', '古い地図', '青い花'],
        correctAnswer: '金色のかぎ',
      },
      {
        itemRef: 'kokugo3/maigo/event_bench/01',
        category: '読解：出来事',
        prompt: 'かぎをつかったとき、公園のベンチはどうなりましたか。',
        options: [
          '立ち上がって、歩き出した',
          '色が赤くかわった',
          '二つにわれた',
          '空にとんで行った',
        ],
        correctAnswer: '立ち上がって、歩き出した',
      },
      {
        itemRef: 'kokugo3/maigo/event_climax/01',
        category: '読解：出来事',
        prompt: 'バスていの時こく表の数字が動き出したあと、何が起こりましたか。',
        options: [
          'たくさんのバスが集まってきた',
          '大きな雨がふり出した',
          '時こく表が消えてしまった',
          'りいこがねむってしまった',
        ],
        correctAnswer: 'たくさんのバスが集まってきた',
      },
      {
        itemRef: 'kokugo3/maigo/realize/01',
        category: '読解：読み取り',
        prompt: 'ふしぎな出来事を通して、りいこが分かったことは何ですか。',
        options: [
          'ものたちは、楽しいことをしてみたかったのだということ',
          'かぎは、こわれていたのだということ',
          '町の人が、いたずらをしていたのだということ',
          '自分がゆめを見ていたのだということ',
        ],
        correctAnswer: 'ものたちは、楽しいことをしてみたかったのだということ',
      },
      {
        itemRef: 'kokugo3/maigo/feeling_end/01',
        category: '読解：気持ちの変化',
        prompt: '物語の終わりで、りいこの気持ちはどのようになりましたか。',
        options: [
          '消してしまったうさぎがうれしそうにしているのを見て、ほっとして明るい気持ちになった',
          'かぎをなくして、ますますかなしくなった',
          'こわい思いをして、二度と外に出たくないと思った',
          '何も感じず、いつもと同じ気持ちだった',
        ],
        correctAnswer: '消してしまったうさぎがうれしそうにしているのを見て、ほっとして明るい気持ちになった',
      },
      {
        itemRef: 'kokugo3/maigo/theme/01',
        category: '読解：主題',
        prompt: 'この物語が伝えようとしていることに、近いのはどれですか。',
        options: [
          '思いきって表したことや、思いがけない出来事にも、よさがある',
          'まちがいをしたら、かくした方がよい',
          '知らないものには、さわらない方がよい',
          '人の話は、聞かなくてよい',
        ],
        correctAnswer: '思いきって表したことや、思いがけない出来事にも、よさがある',
      },
      {
        itemRef: 'kokugo3/maigo/genre/01',
        category: '読解：話の種類',
        prompt: '「まいごのかぎ」は、どんな種類のお話ですか。',
        options: [
          'ふしぎな出来事が起こる、物語（お話）',
          '実さいにあったことを伝える、新聞記事',
          '物の作り方を教える、説明文',
          '短い言葉でリズムを楽しむ、詩',
        ],
        correctAnswer: 'ふしぎな出来事が起こる、物語（お話）',
      },
      {
        itemRef: 'kokugo3/maigo/reading_skill/01',
        category: '読解：読み方',
        prompt: 'かぎをつかってふしぎな出来事が起こる場面を読むとき、どんな読み方をするとよいですか。',
        options: [
          '頭の中で、その場面の様子を思いうかべながら読む',
          '出てくる漢字の画数を、数えながら読む',
          '文の数だけを、かぞえながら読む',
          '声を出さずに、絵だけを見て読む',
        ],
        correctAnswer: '頭の中で、その場面の様子を思いうかべながら読む',
      },
      {
        itemRef: 'kokugo3/maigo/feeling_arc/01',
        category: '読解：気持ちの変化',
        prompt: '物語のはじめから終わりまでで、りいこの気持ちは全体としてどのように動きましたか。',
        options: [
          'しずんだ気持ちから、明るい気持ちへと動いた',
          '明るい気持ちから、ずっとしずんだままになった',
          'おこった気持ちから、こわい気持ちへと動いた',
          'はじめから終わりまで、まったく変わらなかった',
        ],
        correctAnswer: 'しずんだ気持ちから、明るい気持ちへと動いた',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  //  ちいちゃんのかげおくり — 物語（国語三下 あおぞら・9月）あまんきみこ
  //  A serious WWII-era story of a child's loss. Questions are comprehension-
  //  and theme-focused and handled with the weight the material deserves —
  //  no playful framing. The かげおくり motif bookends the story; the closing
  //  peaceful-park scene contrasts with the wartime tragedy.
  // ─────────────────────────────────────────────────────────────────────
  chiichan: {
    title: 'ちいちゃんのかげおくり',
    author: 'あまんきみこ',
    volume: '国語三下 あおぞら',
    month: '9月',
    note: '戦争の時代の、命と平和について考える物語です。教室で読んだあとに、落ち着いて取り組みましょう。',
    questions: [
      {
        itemRef: 'kokugo3/chiichan/vocab_kageokuri/01',
        category: '読解：言葉の意味',
        prompt: '「かげおくり」とは、どんな遊びですか。',
        options: [
          '自分のかげをじっと見つめてから空を見上げ、かげのように見える形を空にうつす遊び',
          'かげの中にかくれて、見つからないようにする遊び',
          'かげの長さをはかって、時間を当てる遊び',
          'かげの上をとびこえて、きょうそうする遊び',
        ],
        correctAnswer: '自分のかげをじっと見つめてから空を見上げ、かげのように見える形を空にうつす遊び',
      },
      {
        itemRef: 'kokugo3/chiichan/opening/01',
        category: '読解：場面',
        prompt: '物語のはじめのころ、ちいちゃんはだれと「かげおくり」をしましたか。',
        options: [
          '家族といっしょに',
          '学校の先生と',
          '一人きりで',
          '知らない人と',
        ],
        correctAnswer: '家族といっしょに',
      },
      {
        itemRef: 'kokugo3/chiichan/separation/01',
        category: '読解：出来事',
        prompt: 'ちいちゃんが家族とはなればなれになってしまったのは、なぜですか。',
        options: [
          '空しゅうがあり、にげるうちにはぐれてしまったから',
          '道にまよって、遠くまで来てしまったから',
          'けんかをして、家を出て行ったから',
          '引っこしをして、町がかわったから',
        ],
        correctAnswer: '空しゅうがあり、にげるうちにはぐれてしまったから',
      },
      {
        itemRef: 'kokugo3/chiichan/waiting/01',
        category: '読解：気持ち',
        prompt: '一人になったちいちゃんは、どんな思いでいましたか。',
        options: [
          '家族がきっとむかえに来てくれると信じて、待っていた',
          'もう家族のことは、わすれてしまおうと思っていた',
          '早く遠くの町へ行きたいと思っていた',
          '新しい友だちをさがそうと思っていた',
        ],
        correctAnswer: '家族がきっとむかえに来てくれると信じて、待っていた',
      },
      {
        itemRef: 'kokugo3/chiichan/motif/01',
        category: '読解：物語のしくみ',
        prompt: '「かげおくり」は、この物語の中でどのように出てきますか。',
        options: [
          '物語のはじめと終わりの両方に出てきて、家族との思い出を結びつけている',
          '物語のまん中に一度だけ出てくる',
          '物語には出てこず、題名だけにある',
          '毎日くり返し出てくる',
        ],
        correctAnswer: '物語のはじめと終わりの両方に出てきて、家族との思い出を結びつけている',
      },
      {
        itemRef: 'kokugo3/chiichan/ending_contrast/01',
        category: '読解：場面のうつり変わり',
        prompt: '物語の最後の場面では、その場所は今どうなっていますか。',
        options: [
          '子どもたちが元気に遊ぶ、明るい公園になっている',
          '戦争が今も続いている町になっている',
          'だれも来ない、あれた野原になっている',
          '大きなビルがならぶ町になっている',
        ],
        correctAnswer: '子どもたちが元気に遊ぶ、明るい公園になっている',
      },
      {
        itemRef: 'kokugo3/chiichan/theme/01',
        category: '読解：主題',
        prompt: 'この物語が読む人に伝えようとしていることに、近いのはどれですか。',
        options: [
          '家族とともにくらせる毎日や、平和のたいせつさ',
          '遊びは、一人でする方が楽しいということ',
          '遠くへ旅をすることの楽しさ',
          '新しいものを買うことのうれしさ',
        ],
        correctAnswer: '家族とともにくらせる毎日や、平和のたいせつさ',
      },
      {
        itemRef: 'kokugo3/chiichan/reading_skill/01',
        category: '読解：読み方',
        prompt: 'はじめの場面と終わりの場面を くらべて読むと、この物語のどんなことが強く感じられますか。',
        options: [
          '家族そろっていたころと、今の平和な公園がつながり、失われたものの大きさが感じられる',
          '登場人物の名前が、どれだけ出てくるか',
          '文章にある、かたかなの数',
          'その日の天気が、晴れか雨か',
        ],
        correctAnswer: '家族そろっていたころと、今の平和な公園がつながり、失われたものの大きさが感じられる',
      },
      {
        itemRef: 'kokugo3/chiichan/setting_era/01',
        category: '読解：場面のせってい',
        prompt: 'この物語は、どんな時代を背景にえがかれていますか。',
        options: [
          '戦争があった時代',
          'まだ人がいなかった、大昔',
          'ロボットがくらす、遠い未来',
          '外国の、お城のある時代',
        ],
        correctAnswer: '戦争があった時代',
      },
      {
        itemRef: 'kokugo3/chiichan/vocab_kuushuu/01',
        category: '読解：言葉の意味',
        prompt: '物語に出てくる「空しゅう」とは、どんな出来事のことですか。',
        options: [
          '飛行機が来て、空から爆弾などを落とすこと',
          '空に、大きなにじがかかること',
          '空を、たくさんの鳥がとんでいくこと',
          '空が、急に赤くやけて見えること',
        ],
        correctAnswer: '飛行機が来て、空から爆弾などを落とすこと',
      },
      {
        itemRef: 'kokugo3/chiichan/reading_skill/02',
        category: '読解：読み方',
        prompt: 'このような戦争をえがいた物語を読むとき、大切にしたい読み方はどれですか。',
        options: [
          '登場人物の気持ちを想像し、命や平和について考えながら読む',
          'できるだけ早く、読み終える速さをきそう',
          '出てくる数字だけを、書き出しながら読む',
          'おもしろい所だけを、えらんで読む',
        ],
        correctAnswer: '登場人物の気持ちを想像し、命や平和について考えながら読む',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  //  すがたをかえる大豆 — 説明文（国語三下 あおぞら・11月）国分牧衛
  //  (Already built and live — kept intact. Informational: 問い→答え structure,
  //  食品への変化の知識, 説明文の読み方.)
  // ─────────────────────────────────────────────────────────────────────
  daizu: {
    title: 'すがたをかえる大豆',
    author: '国分牧衛',
    volume: '国語三下 あおぞら',
    month: '11月',
    note: 'この文章を教室で読んだあとに取り組みましょう。',
    questions: [
      {
        itemRef: 'kokugo3/daizu/structure/01',
        category: '読解：文章の組み立て',
        prompt: 'この説明文は、大きく分けるとどのような組み立てになっていますか。',
        options: [
          '話題を出す「問い」の段落と、くわしい例を挙げる「答え」の段落',
          '会話文だけで進んでいく物語の形',
          '短歌が何首も並んでいる形',
          '手紙のやり取りが書かれている形',
        ],
        correctAnswer: '話題を出す「問い」の段落と、くわしい例を挙げる「答え」の段落',
      },
      {
        itemRef: 'kokugo3/daizu/topic/01',
        category: '読解：話題',
        prompt: 'この文章は、どんな食べ物について書かれていますか。',
        options: ['大豆', 'お米', 'とうもろこし', 'じゃがいも'],
        correctAnswer: '大豆',
      },
      {
        itemRef: 'kokugo3/daizu/mainidea/01',
        category: '読解：話題',
        prompt: 'この文章がいちばん伝えたいことに近いのはどれですか。',
        options: [
          '大豆は、姿を変えていろいろな食品になっている',
          '大豆は日本でしか作られていない',
          '大豆は野菜の仲間ではない',
          '大豆は最近発見された新しい食べ物である',
        ],
        correctAnswer: '大豆は、姿を変えていろいろな食品になっている',
      },
      {
        itemRef: 'kokugo3/daizu/foodscience/tofu',
        category: '読解：食べ物の知しき',
        prompt: '大豆をくだいて水を加え、にがりなどで固めて作る食品はどれですか。',
        options: ['豆腐', 'せんべい', 'うどん', 'ジャム'],
        correctAnswer: '豆腐',
      },
      {
        itemRef: 'kokugo3/daizu/foodscience/natto',
        category: '読解：食べ物の知しき',
        prompt: '大豆に納豆きん（細菌）を加えて発酵させて作る食品はどれですか。',
        options: ['納豆', 'かまぼこ', 'ちくわ', 'こんにゃく'],
        correctAnswer: '納豆',
      },
      {
        itemRef: 'kokugo3/daizu/foodscience/miso_shoyu',
        category: '読解：食べ物の知しき',
        prompt: '大豆を発酵させて作る調味料を、次の中から2つ選ぶなら正しい組み合わせはどれですか。',
        options: ['みそ・しょうゆ', 'さとう・しお', 'す・みりん', 'こしょう・からし'],
        correctAnswer: 'みそ・しょうゆ',
      },
      {
        itemRef: 'kokugo3/daizu/foodscience/edamame',
        category: '読解：食べ物の知しき',
        prompt: '大豆をまだ若く、さやごとくきから取ったときに食べる、緑色の豆は何と呼ばれていますか。',
        options: ['えだ豆', 'そら豆', 'グリンピース', 'あずき'],
        correctAnswer: 'えだ豆',
      },
      {
        itemRef: 'kokugo3/daizu/foodscience/moyashi',
        category: '読解：食べ物の知しき',
        prompt: '大豆に日光を当てずに水だけをやって育て、細長い姿にしてから食べる食品はどれですか。',
        options: ['もやし', 'きなこ', 'とうふ', 'なっとう'],
        correctAnswer: 'もやし',
      },
      {
        itemRef: 'kokugo3/daizu/closing/01',
        category: '読解：まとめ',
        prompt: '文章の最後で、筆者はどんなことに驚かされると言っていますか。',
        options: [
          '大豆のよいところに気づき、食事に取り入れてきた昔の人々の知恵',
          '大豆が外国から来た植物であること',
          '大豆の作り方が最近発明されたこと',
          '大豆が高い値段で売られていること',
        ],
        correctAnswer: '大豆のよいところに気づき、食事に取り入れてきた昔の人々の知恵',
      },
      {
        itemRef: 'kokugo3/daizu/skill/signalwords',
        category: '読解：説明文の読み方',
        prompt: '説明文で「まず」「次に」「さらに」のような言葉が出てきたとき、それはどんな役目をしていますか。',
        options: [
          '話の順序や、例がいくつあるかを分かりやすく示す',
          '文章を終わらせる合図',
          '登場人物の気持ちを表す',
          '筆者の名前を紹介する',
        ],
        correctAnswer: '話の順序や、例がいくつあるかを分かりやすく示す',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  //  三年とうげ — 民話（国語三下・12月）李錦玉
  //  Teaching focus: enjoy a folktale's structure/rhythm and the humor of the
  //  clever reframing (発想の転換); folktale features (repetition, a song).
  // ─────────────────────────────────────────────────────────────────────
  touge: {
    title: '三年とうげ',
    author: '李錦玉',
    volume: '国語三下',
    month: '12月',
    note: 'この民話を教室で読んだあとに取り組みましょう。',
    questions: [
      {
        itemRef: 'kokugo3/touge/genre/01',
        category: '読解：話の種類',
        prompt: '「三年とうげ」は、どんな種類のお話ですか。',
        options: [
          '昔から語りつがれてきた民話（昔話）',
          '新聞に書かれたニュース',
          '生き物の育て方を教える説明文',
          '実際にあった出来事の日記',
        ],
        correctAnswer: '昔から語りつがれてきた民話（昔話）',
      },
      {
        itemRef: 'kokugo3/touge/premise/01',
        category: '読解：話のせってい',
        prompt: '「三年とうげ」には、どんな言いつたえがありましたか。',
        options: [
          'そのとうげで転ぶと、あと三年しか生きられない',
          'そのとうげをこえると、宝物が見つかる',
          'そのとうげでは、雨がふり続ける',
          'そのとうげには、だれも登ってはいけない',
        ],
        correctAnswer: 'そのとうげで転ぶと、あと三年しか生きられない',
      },
      {
        itemRef: 'kokugo3/touge/problem/01',
        category: '読解：出来事',
        prompt: 'おじいさんがびょうきになって、ねこんでしまったのはなぜですか。',
        options: [
          'とうげで転んでしまい、あと三年しか生きられないと思ってなやんだから',
          '寒い日に、うすい服で出かけたから',
          '食べすぎて、おなかをこわしたから',
          '遠くまで歩いて、つかれてしまったから',
        ],
        correctAnswer: 'とうげで転んでしまい、あと三年しか生きられないと思ってなやんだから',
      },
      {
        itemRef: 'kokugo3/touge/idea/01',
        category: '読解：話の山場',
        prompt: 'トルトリという子どもは、おじいさんにどんな考えを教えましたか。',
        options: [
          '何度も転べば、そのたびに生きられる年がふえるという考え',
          'とうげを通らなければ、元気になるという考え',
          '薬を飲めば、すぐに元気になるという考え',
          'だれかにおんぶしてもらえば、転ばないという考え',
        ],
        correctAnswer: '何度も転べば、そのたびに生きられる年がふえるという考え',
      },
      {
        itemRef: 'kokugo3/touge/action/01',
        category: '読解：出来事',
        prompt: 'トルトリの考えを聞いたあと、おじいさんはどうしましたか。',
        options: [
          'とうげへ行って、わざと何度も転がった',
          '二度ととうげに近づかなかった',
          '家からまったく出なくなった',
          '別の村へ引っこして行った',
        ],
        correctAnswer: 'とうげへ行って、わざと何度も転がった',
      },
      {
        itemRef: 'kokugo3/touge/resolution/01',
        category: '読解：話のむすび',
        prompt: 'お話の終わりで、おじいさんはどうなりましたか。',
        options: [
          '元気を取りもどして、幸せにくらした',
          'とうとう村を出て行った',
          'ずっとびょうきのままだった',
          'とうげをこわしてしまった',
        ],
        correctAnswer: '元気を取りもどして、幸せにくらした',
      },
      {
        itemRef: 'kokugo3/touge/theme/01',
        category: '読解：おもしろさ',
        prompt: 'このお話の、いちばんのおもしろさはどこにありますか。',
        options: [
          '同じ言いつたえを、考え方を変えることで、こわいものからうれしいものに変えたところ',
          '大きな力で、てきをやっつけたところ',
          'たくさんの宝物を見つけたところ',
          '遠い国へ、旅に出たところ',
        ],
        correctAnswer: '同じ言いつたえを、考え方を変えることで、こわいものからうれしいものに変えたところ',
      },
      {
        itemRef: 'kokugo3/touge/folktale_feature/01',
        category: '読解：民話のとくちょう',
        prompt: '民話には、聞いて楽しいように、どんな特ちょうがよく見られますか。',
        options: [
          '同じような言葉や場面がくり返され、歌のようなリズムがある',
          '数字や記号だけで書かれている',
          '会話がまったく出てこない',
          'むずかしい漢字だけで書かれている',
        ],
        correctAnswer: '同じような言葉や場面がくり返され、歌のようなリズムがある',
      },
      {
        itemRef: 'kokugo3/touge/origin/01',
        category: '読解：話のせってい',
        prompt: '「三年とうげ」は、もともとどこに伝わる民話をもとにしていますか。',
        options: [
          '朝鮮（韓国）に伝わる民話',
          'アメリカに伝わる民話',
          'エジプトに伝わる民話',
          'オーストラリアに伝わる民話',
        ],
        correctAnswer: '朝鮮（韓国）に伝わる民話',
      },
      {
        itemRef: 'kokugo3/touge/reasoning/01',
        category: '読解：話のしくみ',
        prompt: 'トルトリの考え方（一度転べば三年、二度転べば……と生きられる年がふえる）にしたがうと、二度転ぶと、あと何年生きられることになりますか。',
        options: ['六年', '三年', '五年', '九年'],
        correctAnswer: '六年',
      },
      {
        itemRef: 'kokugo3/touge/reading_skill/01',
        category: '読解：読み方',
        prompt: '「三年とうげ」のような民話を声に出して読むと、どんなよさがありますか。',
        options: [
          'くり返される言葉やリズムを、声で楽しむことができる',
          '文章にある漢字の画数を、正しく数えられる',
          'その日の天気を、当てることができる',
          '作者が住んでいる町が、分かるようになる',
        ],
        correctAnswer: 'くり返される言葉やリズムを、声で楽しむことができる',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  //  ありの行列 — 説明文（国語三下・1月）大滝哲也
  //  Teaching focus: 問い→答え structure; observation/experiment vs conclusion;
  //  paragraph roles. Science facts about pheromone trails are general knowledge
  //  and safe; the textbook's coined term is NOT reproduced.
  // ─────────────────────────────────────────────────────────────────────
  ari: {
    title: 'ありの行列',
    author: '大滝哲也',
    volume: '国語三下',
    month: '1月',
    note: 'この説明文を教室で読んだあとに取り組みましょう。',
    questions: [
      {
        itemRef: 'kokugo3/ari/structure/01',
        category: '読解：文章の組み立て',
        prompt: 'この説明文は、大きく分けるとどんな組み立てになっていますか。',
        options: [
          'はじめに「問い」を出し、中で調べたことを述べ、終わりに「答え」をまとめる',
          '登場人物の会話だけで進む物語の形',
          '手紙のやり取りが書かれている形',
          '短歌がいくつも並んでいる形',
        ],
        correctAnswer: 'はじめに「問い」を出し、中で調べたことを述べ、終わりに「答え」をまとめる',
      },
      {
        itemRef: 'kokugo3/ari/question/01',
        category: '読解：問い',
        prompt: 'この文章のはじめで出される「問い」は、どんなことですか。',
        options: [
          '目がよく見えないありが、なぜ食べ物まで長い行列を作れるのか',
          'ありは、どこにすを作るのか',
          'ありは、一年に何回たまごをうむのか',
          'ありは、どうやって冬をこすのか',
        ],
        correctAnswer: '目がよく見えないありが、なぜ食べ物まで長い行列を作れるのか',
      },
      {
        itemRef: 'kokugo3/ari/experiment_sugar/01',
        category: '読解：実験',
        prompt: '研究者が行った実験では、すから少しはなれた所に何を置きましたか。',
        options: ['さとう', '水', '石だけ', '葉っぱ'],
        correctAnswer: 'さとう',
      },
      {
        itemRef: 'kokugo3/ari/experiment_stone/01',
        category: '読解：実験',
        prompt: 'ありの通り道に大きな石を置くと、ありの様子はどうなりましたか。',
        options: [
          '行列は一度みだれたが、しばらくすると、また道を見つけて進んだ',
          'ありは、二度ともどってこなかった',
          'ありは、石の上でねむってしまった',
          'ありは、みんな飛んで行ってしまった',
        ],
        correctAnswer: '行列は一度みだれたが、しばらくすると、また道を見つけて進んだ',
      },
      {
        itemRef: 'kokugo3/ari/conclusion/01',
        category: '読解：答え',
        prompt: 'ありが行列を作れるのは、なぜだと分かりましたか。',
        options: [
          '地面につけられた、においをたどっているから',
          '目で、よく見えているから',
          '大きな音を、聞いているから',
          '風の向きを、感じているから',
        ],
        correctAnswer: '地面につけられた、においをたどっているから',
      },
      {
        itemRef: 'kokugo3/ari/mechanism/01',
        category: '読解：内容の読み取り',
        prompt: '後から来たありは、どのようにして道をたどっていきますか。',
        options: [
          '前のありがつけたにおいを、たどっていく',
          '前のありの体を、糸でつないでいく',
          '地面にかいた絵を、見ていく',
          '空の星を、見て進んでいく',
        ],
        correctAnswer: '前のありがつけたにおいを、たどっていく',
      },
      {
        itemRef: 'kokugo3/ari/reasoning_skill/01',
        category: '読解：説明文の読み方',
        prompt: '「ありが石をよけて、また道を見つけた」というのは、この文章では何にあたりますか。',
        options: [
          '目で見て分かった「事実（観察したこと）」',
          '研究者の気持ち',
          '物語のさし絵',
          '読む人への質問',
        ],
        correctAnswer: '目で見て分かった「事実（観察したこと）」',
      },
      {
        itemRef: 'kokugo3/ari/vocab/01',
        category: '読解：言葉の意味',
        prompt: '「行列」とは、この文章ではどんな様子を表していますか。',
        options: [
          'ありが列を作って、ならんで進んでいる様子',
          'ありがばらばらに動き回っている様子',
          'ありがじっと止まっている様子',
          'ありが土の中でねむっている様子',
        ],
        correctAnswer: 'ありが列を作って、ならんで進んでいる様子',
      },
      {
        itemRef: 'kokugo3/ari/topic/01',
        category: '読解：話題',
        prompt: 'この説明文は、おもに何について書かれていますか。',
        options: [
          'ありが、行列を作ることができるわけ',
          'ありの、たまごの育て方',
          'ありが、冬をこす方法',
          'ありの巣の、大きさのはかり方',
        ],
        correctAnswer: 'ありが、行列を作ることができるわけ',
      },
      {
        itemRef: 'kokugo3/ari/paragraph_role/01',
        category: '読解：文章の組み立て',
        prompt: 'この説明文の「終わり」の部分には、どんなことが書かれていますか。',
        options: [
          '調べて分かったことの「答え」のまとめ',
          'これから調べたい「問い」の始まり',
          '登場人物どうしの、長い会話',
          '作者への、読者からの手紙',
        ],
        correctAnswer: '調べて分かったことの「答え」のまとめ',
      },
      {
        itemRef: 'kokugo3/ari/reading_skill/01',
        category: '読解：説明文の読み方',
        prompt: '説明文を「問い」と「答え」に気をつけて読むと、どんなよさがありますか。',
        options: [
          '筆者がいちばん伝えたいことの中心が、はっきり分かる',
          '文章に出てくる漢字の数が、分かる',
          'その本のねだんが、分かる',
          '筆者の生まれた年が、分かる',
        ],
        correctAnswer: '筆者がいちばん伝えたいことの中心が、はっきり分かる',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  //  モチモチの木 — 物語（国語三下・3月）斎藤隆介
  //  Teaching focus: how 豆太 changes (timid -> brave for someone he loves);
  //  the bond with じさま; courage and fear coexisting.
  // ─────────────────────────────────────────────────────────────────────
  mochimochi: {
    title: 'モチモチの木',
    author: '斎藤隆介',
    volume: '国語三下',
    month: '3月',
    note: 'この物語を教室で読んだあとに取り組みましょう。',
    questions: [
      {
        itemRef: 'kokugo3/mochimochi/character/01',
        category: '読解：登場人物',
        prompt: '豆太とじさまは、どんな関係で、どのようにくらしていますか。',
        options: [
          '豆太とおじいさんが、山の小屋で二人でくらしている',
          '豆太と友だちが、町の学校でくらしている',
          '豆太が、一人で海のそばにすんでいる',
          '豆太と大ぜいの家族が、大きな家にすんでいる',
        ],
        correctAnswer: '豆太とおじいさんが、山の小屋で二人でくらしている',
      },
      {
        itemRef: 'kokugo3/mochimochi/character_start/01',
        category: '読解：登場人物',
        prompt: '物語のはじめ、豆太はどんな子どもとしてえがかれていますか。',
        options: [
          '夜になると、こわがりで、一人で外に出られない子',
          '何でも一人でできる、こわいもの知らずの子',
          'いつもおこってばかりいる子',
          '本を読むのが大すきな子',
        ],
        correctAnswer: '夜になると、こわがりで、一人で外に出られない子',
      },
      {
        itemRef: 'kokugo3/mochimochi/tree/01',
        category: '読解：話のせってい',
        prompt: '「モチモチの木」について、言いつたえられていることは何ですか。',
        options: [
          'ある夜、木に灯がともり、それを見られるのは勇気のある子どもだけだということ',
          '木の実を食べると、大きくなれるということ',
          '木にさわると、ねがいがかなうということ',
          '木の下に、宝物がうまっているということ',
        ],
        correctAnswer: 'ある夜、木に灯がともり、それを見られるのは勇気のある子どもだけだということ',
      },
      {
        itemRef: 'kokugo3/mochimochi/crisis/01',
        category: '読解：出来事',
        prompt: 'ある夜、豆太が目をさますと、どんなことが起きていましたか。',
        options: [
          'じさまが、急に苦しみ出して、びょうきになっていた',
          '外で、大きな祭りが始まっていた',
          '雪で、小屋がうまってしまっていた',
          '友だちが、あそびに来ていた',
        ],
        correctAnswer: 'じさまが、急に苦しみ出して、びょうきになっていた',
      },
      {
        itemRef: 'kokugo3/mochimochi/brave_act/01',
        category: '読解：山場',
        prompt: 'じさまのために、豆太はどうしましたか。',
        options: [
          'こわい夜道を、たった一人で走って、医者をよびに行った',
          'こわくて、朝まで小屋の中でじっとしていた',
          '大きな声で、近くの人をよんだ',
          'じさまをおんぶして、山を下りた',
        ],
        correctAnswer: 'こわい夜道を、たった一人で走って、医者をよびに行った',
      },
      {
        itemRef: 'kokugo3/mochimochi/sees_light/01',
        category: '読解：出来事',
        prompt: '医者といっしょに帰る道で、豆太はモチモチの木がどうなっているのを見ましたか。',
        options: [
          '灯がともって、明るくかがやいているのを見た',
          '木がたおれているのを見た',
          '木が花でうまっているのを見た',
          '木が消えてなくなっているのを見た',
        ],
        correctAnswer: '灯がともって、明るくかがやいているのを見た',
      },
      {
        itemRef: 'kokugo3/mochimochi/theme/01',
        category: '読解：主題',
        prompt: 'この物語が伝えようとしていることに、いちばん近いのはどれですか。',
        options: [
          'こわがりな子でも、大切な人のためには、勇気を出せるということ',
          '強い子だけが、みとめられるということ',
          'こわいものからは、いつもにげた方がよいということ',
          '一人で生きていく方が、よいということ',
        ],
        correctAnswer: 'こわがりな子でも、大切な人のためには、勇気を出せるということ',
      },
      {
        itemRef: 'kokugo3/mochimochi/character_change/01',
        category: '読解：気持ちの変化',
        prompt: '豆太が勇気を出して走り出したのは、どんな気持ちからでしたか。',
        options: [
          'じさまが死んでしまうかもしれないという心配が、夜のこわさよりも強かったから',
          '灯がともった木を、早く見たかったから',
          '医者と、話をしたかったから',
          '外で、遊びたかったから',
        ],
        correctAnswer: 'じさまが死んでしまうかもしれないという心配が、夜のこわさよりも強かったから',
      },
      {
        itemRef: 'kokugo3/mochimochi/setting_time/01',
        category: '読解：場面のせってい',
        prompt: '豆太が勇気を出して医者をよびに行く、物語の山場の出来事は、いつ起きますか。',
        options: [
          '真夜中（夜）',
          '朝の学校',
          '昼の祭り',
          '夕方の海べ',
        ],
        correctAnswer: '真夜中（夜）',
      },
      {
        itemRef: 'kokugo3/mochimochi/bond/01',
        category: '読解：登場人物',
        prompt: '豆太は、いっしょにくらすじさまのことを、どのように思っていますか。',
        options: [
          '大すきで、大切に思っている',
          'こわくて、はなれたいと思っている',
          'きらいで、口もききたくないと思っている',
          '何とも思っていない',
        ],
        correctAnswer: '大すきで、大切に思っている',
      },
      {
        itemRef: 'kokugo3/mochimochi/reading_skill/01',
        category: '読解：読み方',
        prompt: 'この物語で、豆太が「変わったところ」を読み取るには、どこをくらべて読むとよいですか。',
        options: [
          'はじめのこわがりな豆太と、勇気を出したあとの豆太をくらべる',
          '文章に出てくる漢字の、画数の多い少ないをくらべる',
          '物語のページ数と、絵の数をくらべる',
          'その日の気温の、高い低いをくらべる',
        ],
        correctAnswer: 'はじめのこわがりな豆太と、勇気を出したあとの豆太をくらべる',
      },
    ],
  },
};

if (typeof module !== 'undefined') module.exports = READING_UNITS;
