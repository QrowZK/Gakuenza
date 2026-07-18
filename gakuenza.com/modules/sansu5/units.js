// units.js — self-registered focus-unit registry for sansu5.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// sansu5 unit keys == the `key` of each unit in modules/sansu5/generators.js
// (window.SANSU5_DATA.UNITS), documented in modules/sansu5/README.md.
// u19_review (5年のまとめ) is intentionally excluded — a mixed review, not a
// focus-unit target.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.sansu5 = [
    { key: 'u01_decimals', label: '1. 整数と小数' },
    { key: 'u02_volume', label: '2. 直方体や立方体の体積' },
    { key: 'u03_proportion', label: '3. 比例' },
    { key: 'u04_decimal_mul', label: '4. 小数のかけ算' },
    { key: 'u05_decimal_div', label: '5. 小数のわり算' },
    { key: 'u06_congruence', label: '6. 合同な図形' },
    { key: 'u07_angles', label: '7. 図形の角' },
    { key: 'u08_multiples_factors', label: '8. 偶数と奇数、倍数と約数' },
    { key: 'u09_fraction_decimal', label: '9. 分数と小数、整数の関係' },
    { key: 'u10_fraction_addsub', label: '10. 分数のたし算とひき算' },
    { key: 'u11_average', label: '11. 平均' },
    { key: 'u12_per_unit', label: '12. 単位量あたりの大きさ' },
    { key: 'u13_area', label: '13. 四角形と三角形の面積' },
    { key: 'u14_percentage', label: '14. 割合' },
    { key: 'u15_graphs', label: '15. 帯グラフと円グラフ' },
    { key: 'u16_functional', label: '16. 変わり方調べ' },
    { key: 'u17_polygon_circle', label: '17. 正多角形と円周の長さ' },
    { key: 'u18_prisms_cylinders', label: '18. 角柱と円柱' },
  ];
})();
