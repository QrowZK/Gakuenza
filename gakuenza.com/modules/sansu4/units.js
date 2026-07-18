// units.js — self-registered focus-unit registry for sansu4.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// sansu4 unit keys == the `key` of each unit in modules/sansu4/generators.js
// (window.SANSU4_DATA.UNITS), documented in modules/sansu4/README.md.
// u15_review (4年のまとめ) is intentionally excluded — a mixed review, not a
// focus-unit target.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.sansu4 = [
    { key: 'u01_big_numbers', label: '1. 大きい数のしくみ' },
    { key: 'u02_line_graphs', label: '2. 折れ線グラフと表' },
    { key: 'u03_division1', label: '3. わり算の筆算(1)' },
    { key: 'u04_angles', label: '4. 角の大きさ' },
    { key: 'u05_decimals_structure', label: '5. 小数のしくみ' },
    { key: 'u06_division2', label: '6. わり算の筆算(2)' },
    { key: 'u07_rounding', label: '7. がい数の表し方と使い方' },
    { key: 'u08_calc_rules', label: '8. 計算のきまり' },
    { key: 'u09_quadrilaterals', label: '9. 垂直、平行と四角形' },
    { key: 'u10_fractions', label: '10. 分数' },
    { key: 'u11_change', label: '11. 変わり方調べ' },
    { key: 'u12_area', label: '12. 面積のくらべ方と表し方' },
    { key: 'u13_decimal_muldiv', label: '13. 小数のかけ算とわり算' },
    { key: 'u14_boxes', label: '14. 直方体と立方体' },
  ];
})();
