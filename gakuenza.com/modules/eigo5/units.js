// units.js — self-registered focus-unit registry for eigo5.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly. eigo5 keys u01..u08
// == the `key` field of each entry in modules/eigo5/data.js EIGO5_UNITS (and
// the `unit` tag on every vocab/sentence item). A module with no units.js
// offers no unit picker.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.eigo5 = [
    { key: 'u01', label: '1. 自己しょうかい・アルファベット' },
    { key: 'u02', label: '2. たんじょう日と月' },
    { key: 'u03', label: '3. 教科と時間わり' },
    { key: 'u04', label: '4. 一日の生活と時こく' },
    { key: 'u05', label: '5. できること (can)' },
    { key: 'u06', label: '6. 道あんないと場所' },
    { key: 'u07', label: '7. レストランとねだん' },
    { key: 'u08', label: '8. あの人はだれ？' },
  ];
})();
