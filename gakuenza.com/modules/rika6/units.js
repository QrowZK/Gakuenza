// units.js — self-registered focus-unit registry for rika6.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// rika6 unit keys == the `key` of each unit in modules/rika6/rika6-data.js
// (RIKA6_DATA.UNIT_KEYS). The module runner reads focus_units and foregrounds
// these same keys on its menu. Listed in the real 11-unit teaching order (units
// cross the two strand families, so this ordering differs from the module's
// B-then-A menu grouping).
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.rika6 = [
    { key: 'u01_combustion', label: '1. 物の燃え方と空気' },
    { key: 'u02_animal_body', label: '2. 動物のからだのはたらき' },
    { key: 'u03_plant_body', label: '3. 植物のからだのはたらき' },
    { key: 'u04_ecosystem', label: '4. 生き物どうしのかかわり' },
    { key: 'u05_moon_sun', label: '5. 月の形と太陽' },
    { key: 'u06_strata', label: '6. 大地のつくり' },
    { key: 'u07_changing_land', label: '7. 変わり続ける大地' },
    { key: 'u08_lever', label: '8. てこのはたらきとしくみ' },
    { key: 'u09_electricity', label: '9. 電気と私たちのくらし' },
    { key: 'u10_solutions', label: '10. 水溶液の性質とはたらき' },
    { key: 'u11_earth_and_us', label: '11. 地球に生きる' },
  ];
})();
