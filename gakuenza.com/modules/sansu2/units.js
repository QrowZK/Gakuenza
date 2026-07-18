// units.js — self-registered focus-unit registry for sansu2.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly (the module runner
// reads focus_units and foregrounds these same keys). A module with no units.js
// simply offers no unit picker (focus_units stays null = all units).
//
// sansu2 unit keys == the `key` of each unit in modules/sansu2/generators.js
// (window.SANSU2_DATA.UNITS), documented in modules/sansu2/README.md. かけ算九九
// spans units 11–12. (No 2年のまとめ review unit exists in this build, so there
// is nothing to exclude — every unit is a real focus-unit target.)
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.sansu2 = [
    { key: 'u01_tables_graphs', label: '1. 表とグラフ' },
    { key: 'u02_add_column', label: '2. たし算のひっ算' },
    { key: 'u03_sub_column', label: '3. ひき算のひっ算' },
    { key: 'u04_length_cm_mm', label: '4. 長さ（cm・mm）' },
    { key: 'u05_to1000', label: '5. 100より大きい数' },
    { key: 'u06_volume', label: '6. かさ（L・dL・mL）' },
    { key: 'u07_time', label: '7. 時こくと時間' },
    { key: 'u08_calc_tricks', label: '8. 計算のくふう' },
    { key: 'u09_addsub3digit', label: '9. たし算とひき算のひっ算' },
    { key: 'u10_tri_quad', label: '10. 三角形と四角形' },
    { key: 'u11_mult1', label: '11. かけ算(1)' },
    { key: 'u12_mult2', label: '12. かけ算(2)' },
    { key: 'u13_length_m', label: '13. 長い長さ（m）' },
    { key: 'u14_fractions', label: '14. 分数' },
    { key: 'u15_boxes', label: '15. はこの形' },
  ];
})();
