// units.js — self-registered focus-unit registry for kokugo5.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// kokugo5 unit keys == the literal 'kanji' (the kanji drill) + each key of
// GRAMMAR_UNITS in modules/kokugo5/grammar-generators.js. (No reading-
// comprehension units yet — kokugo5 ships kanji + grammar only; see its build
// spec.)
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.kokugo5 = [
    { key: 'kanji', label: '漢字れんしゅう' },
    { key: 'keigo', label: 'ことば：敬語' },
    { key: 'kanyouku', label: 'ことば：慣用句' },
    { key: 'goshu', label: 'ことば：和語・漢語・外来語' },
    { key: 'doukun', label: 'ことば：同じ読み方の漢字' },
  ];
})();
