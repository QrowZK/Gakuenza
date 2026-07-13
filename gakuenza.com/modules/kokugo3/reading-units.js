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

const READING_UNITS = {
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
};

if (typeof module !== 'undefined') module.exports = READING_UNITS;
