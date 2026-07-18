// units.js — self-registered focus-unit registry for rika4.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// rika4 unit keys == the `key` of each unit in modules/rika4/rika4-data.js
// (RIKA4_DATA.UNIT_KEYS). The module runner reads focus_units and foregrounds
// these same keys on its menu.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.rika4 = [
    { key: 'u01_warm_season', label: '1. あたたかくなると' },
    { key: 'u02_animal_body', label: '2. 動物のからだのつくりと運動' },
    { key: 'u03_weather_temp', label: '3. 天気と気温' },
    { key: 'u04_electric_current', label: '4. 電流のはたらき' },
    { key: 'u05_rainwater', label: '5. 雨水のゆくえと地面のようす' },
    { key: 'u06_moon_star', label: '6. 月や星の見え方' },
    { key: 'u07_water_states', label: '7. 自然のなかの水のすがた' },
    { key: 'u08_air_water', label: '8. とじこめた空気と水' },
    { key: 'u09_volume_temp', label: '9. 物の体積と温度' },
    { key: 'u10_heat_transfer', label: '10. 物のあたたまり方' },
    { key: 'u11_water_temp', label: '11. 水のすがたと温度' },
    { key: 'u12_year_review', label: '12. 生き物の1年をふり返って' },
  ];
})();
