// units.js — self-registered focus-unit registry for sansu6.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// sansu6 unit keys == the `key` of each unit in modules/sansu6/generators.js
// (window.SANSU6_DATA.UNITS), documented in modules/sansu6/README.md.
// u13_review (6年のまとめ／算数のしあげ) is intentionally excluded — a mixed
// review, not a focus-unit target.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.sansu6 = [
    { key: 'u01_symmetry', label: '1. 対称な図形' },
    { key: 'u02_letters', label: '2. 文字と式' },
    { key: 'u03_fraction_mul', label: '3. 分数のかけ算' },
    { key: 'u04_fraction_div', label: '4. 分数のわり算' },
    { key: 'u05_ratio', label: '5. 比' },
    { key: 'u06_scale', label: '6. 拡大図と縮図' },
    { key: 'u07_data', label: '7. データの調べ方' },
    { key: 'u08_circle_area', label: '8. 円の面積' },
    { key: 'u09_volume', label: '9. 角柱と円柱の体積' },
    { key: 'u10_approx', label: '10. およその面積と体積' },
    { key: 'u11_proportion', label: '11. 比例と反比例' },
    { key: 'u12_combinatorics', label: '12. 並べ方と組み合わせ方' },
  ];
})();
