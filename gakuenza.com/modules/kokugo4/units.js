// units.js — self-registered focus-unit registry for kokugo4.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// kokugo4 unit keys == the literal 'kanji' (the kanji drill) + each key of
// GRAMMAR_UNITS in modules/kokugo4/grammar-generators.js. (No reading-
// comprehension units yet — kokugo4 ships kanji + grammar only; see its build
// spec.)
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.kokugo4 = [
    { key: 'kanji', label: '漢字れんしゅう' },
    { key: 'bushu', label: 'ことば：部首' },
    { key: 'jukugo', label: 'ことば：熟語の組み立て' },
    { key: 'setsuzoku', label: 'ことば：つなぎ言葉' },
    { key: 'shugo_jutsugo', label: 'ことば：主語・述語' },
    { key: 'kanyouku', label: 'ことば：慣用句' },
  ];
})();
