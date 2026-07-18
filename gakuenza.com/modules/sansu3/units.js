// units.js — self-registered focus-unit registry for sansu3.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly. sansu3 keys u01..u17
// == 'u' + zero-padded unit number in modules/sansu3/generators.js UNITS (see
// app.js unitKey()). A module with no units.js offers no unit picker.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.sansu3 = [
    { key: 'u01', label: '1. かけ算（九九の表とかけ算）' },
    { key: 'u02', label: '2. 時こくと時間' },
    { key: 'u03', label: '3. わり算' },
    { key: 'u04', label: '4. たし算とひき算の筆算' },
    { key: 'u05', label: '5. 長さ' },
    { key: 'u06', label: '6. ぼうグラフと表' },
    { key: 'u07', label: '7. あまりのあるわり算' },
    { key: 'u08', label: '8. かけ算の筆算（×1けた）' },
    { key: 'u09', label: '9. 大きい数のしくみ' },
    { key: 'u10', label: '10. 円と球' },
    { key: 'u11', label: '11. 小数' },
    { key: 'u12', label: '12. 重さ' },
    { key: 'u13', label: '13. 分数' },
    { key: 'u14', label: '14. □を使った式' },
    { key: 'u15', label: '15. かけ算の筆算（×2けた）' },
    { key: 'u16', label: '16. 三角形' },
    { key: 'u17', label: '17. 3年のまとめ' },
  ];
})();
