// units.js — self-registered focus-unit registry for kokugo1.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// kokugo1 keys == the module's internal unit keys (kana-first + 80 kanji).
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.kokugo1 = [
    { key: 'hiragana', label: 'ひらがな' },
    { key: 'katakana', label: 'カタカナ' },
    { key: 'joshi', label: 'は・を・へ' },
    { key: 'kutouten', label: '句読点・かぎ' },
    { key: 'kanji', label: 'かんじ（80字）' },
  ];
})();
