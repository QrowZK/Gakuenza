// units.js — self-registered focus-unit registry for kokugo3.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// kokugo3 keys == the literal 'kanji' (the kanji drill) + each key of
// READING_UNITS in modules/kokugo3/reading-units.js + each key of GRAMMAR_UNITS
// in modules/kokugo3/grammar-generators.js.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.kokugo3 = [
    { key: 'kanji', label: '漢字れんしゅう' },
    { key: 'haru', label: '読解：春風をたどって' },
    { key: 'maigo', label: '読解：まいごのかぎ' },
    { key: 'chiichan', label: '読解：ちいちゃんのかげおくり' },
    { key: 'daizu', label: '読解：すがたをかえる大豆' },
    { key: 'touge', label: '読解：三年とうげ' },
    { key: 'ari', label: '読解：ありの行列' },
    { key: 'mochimochi', label: '読解：モチモチの木' },
    { key: 'kosoado', label: 'ことば：こそあど言葉' },
    { key: 'shuushoku', label: 'ことば：修飾語' },
    { key: 'kotowaza', label: 'ことば：ことわざ・故事成語' },
    { key: 'romaji', label: 'ことば：ローマ字' },
  ];
})();
