// units.js — self-registered focus-unit registry for rika5.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// rika5 unit keys == the `key` of each unit in modules/rika5/rika5-data.js
// (RIKA5_DATA.UNIT_KEYS). The module runner reads focus_units and foregrounds
// these same keys on its menu.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.rika5 = [
    { key: 'u01_weather', label: '1. 天気の変化' },
    { key: 'u02_germination', label: '2. 植物の発芽と成長' },
    { key: 'u03_fish', label: '3. 魚のたんじょう' },
    { key: 'u04_flower_fruit', label: '4. 花から実へ' },
    { key: 'u05_typhoon', label: '5. 台風と天気の変化' },
    { key: 'u06_running_water', label: '6. 流れる水のはたらき' },
    { key: 'u07_dissolving', label: '7. 物のとけ方' },
    { key: 'u08_human_birth', label: '8. 人のたんじょう' },
    { key: 'u09_electromagnet', label: '9. 電流がうみ出す力' },
    { key: 'u10_pendulum', label: '10. ふりこのきまり' },
  ];
})();
