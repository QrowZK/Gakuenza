// units.js — self-registered focus-unit registry for kokugo2.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// kokugo2 keys == the module's internal unit keys (kanji + kana/grammar).
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.kokugo2 = [
    { key: 'kanji', label: '漢字れんしゅう' },
    { key: 'katakana', label: 'ことば：カタカナ' },
    { key: 'kanazukai', label: 'ことば：かなづかい' },
    { key: 'shugo_jutsugo', label: 'ことば：主語と述語' },
    { key: 'nakama', label: 'ことば：なかま・反対の言葉' },
    { key: 'kutouten', label: 'ことば：丸・点・かぎ' },
  ];
})();
