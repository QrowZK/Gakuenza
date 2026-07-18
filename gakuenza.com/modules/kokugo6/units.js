// units.js — self-registered focus-unit registry for kokugo6.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// kokugo6 unit keys == 'kanji' (the kanji drill) + each key of GRAMMAR_UNITS in
// modules/kokugo6/grammar-generators.js. Reading-comprehension units are
// deliberately deferred, so there are no reading keys here yet.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.kokugo6 = [
    { key: 'kanji', label: '漢字れんしゅう' },
    { key: 'keigo', label: 'ことば：敬語' },
    { key: 'jukugo', label: 'ことば：熟語の成り立ち' },
    { key: 'goshu', label: 'ことば：和語・漢語・外来語' },
    { key: 'yoji', label: 'ことば：四字熟語・故事成語' },
  ];
})();
