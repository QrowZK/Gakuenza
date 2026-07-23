// units.js — self-registered focus-unit registry for rika3 (理科3年).
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs (hub/admin/class-detail.html, hub/gradebook/assign.html via
// hub/module-assign-common.js) lazy-load this file to render the focus_units
// checkboxes; the keys MUST match the module's internal unit keys exactly.
// rika3 keys == the `key` field of every unit in RIKA3_DATA.STRANDS[].units
// (rika3-data.js UNIT_KEYS: u1_haru … u11_jishaku) and the `unitKey` the
// runner reports/foregrounds on. A module with no units.js offers no picker.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.rika3 = [
    { key: 'u1_haru',         label: '1. 春の生き物' },
    { key: 'u2_tane',         label: '2. たねまき' },
    { key: 'u3_chou',         label: '3. チョウのかんさつ' },
    { key: 'u4_kaze_gomu',    label: '4. 風とゴムのはたらき' },
    { key: 'u5_konchu',       label: '5. こん虫のかんさつ' },
    { key: 'u6_taiyo_kage',   label: '6. 太陽とかげ' },
    { key: 'u7_taiyo_hikari', label: '7. 太陽の光' },
    { key: 'u8_oto',          label: '8. 音のせいしつ' },
    { key: 'u9_omosa',        label: '9. 物の重さ' },
    { key: 'u10_denki',       label: '10. 電気の通り道' },
    { key: 'u11_jishaku',     label: '11. じしゃくのせいしつ' },
  ];
})();
