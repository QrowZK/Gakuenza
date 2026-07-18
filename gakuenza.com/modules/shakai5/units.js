// units.js — self-registered focus-unit registry for shakai5.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// shakai5 unit keys == the `key` of each unit in modules/shakai5/questions.js
// (window.SHAKAI5_DATA.UNITS). Grade-5 content is national in scope. The module
// runner reads focus_units and foregrounds these same keys.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.shakai5 = [
    { key: 'u1_national_land', label: '1. わたしたちの国土' },
    { key: 'u2_food_production', label: '2. わたしたちの生活と食料生産' },
    { key: 'u3_industrial_production', label: '3. わたしたちの生活と工業生産' },
    { key: 'u4_information_society', label: '4. 情報化した社会と産業の発展' },
    { key: 'u5_environment', label: '5. わたしたちの生活と環境' },
  ];
})();
