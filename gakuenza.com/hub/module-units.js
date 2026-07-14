// module-units.js — canonical unit-key registry for unit-scoped assignment.
//
// Source of truth for the checkboxes the assignment UIs (admin class-detail,
// Gradebook 課題, modules.html matrix) offer when a teacher sets
// class_modules.focus_units. The keys here MUST match each module's internal
// unit keys exactly, because the module runner reads focus_units and
// foregrounds by these same keys:
//   - sansu3:  keys u01..u17  ==  'u' + zero-padded unit number in
//              modules/sansu3/generators.js UNITS (see app.js unitKey()).
//   - kokugo3: 'kanji' (the kanji drill) + each key of READING_UNITS in
//              modules/kokugo3/reading-units.js (currently just 'daizu').
//
// Do NOT invent a parallel key scheme. When a module gains/renames units,
// update both the module and this registry (kept in sync deliberately —
// the assignment pages cannot load a module's generators). A module with no
// entry here simply offers no unit picker, which is harmless (focus_units
// stays null = all units).
(function () {
  'use strict';

  window.MODULE_UNITS = {
    sansu3: [
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
    ],
    kokugo3: [
      { key: 'kanji', label: '漢字れんしゅう' },
      { key: 'daizu', label: '読解：すがたをかえる大豆' },
    ],
  };

  // Convenience: the unit list for a module key, or [] if it has no units.
  window.moduleUnitsFor = function (moduleKey) {
    return (window.MODULE_UNITS && window.MODULE_UNITS[moduleKey]) || [];
  };
})();
