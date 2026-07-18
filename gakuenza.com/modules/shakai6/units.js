// units.js — self-registered focus-unit registry for shakai6.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
//
// shakai6 focus keys are matched at the SECTION level (see modules/shakai6/
// app.js partitionUnits): units 1 & 3 share one key each, history (unit 2) has
// a distinct key per chronological period.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.shakai6 = [
    { key: 'u1_politics', label: '1. わたしたちの生活と政治' },
    { key: 'u2a_jomon_kofun', label: '2-① 縄文・弥生・古墳の時代' },
    { key: 'u2b_asuka_nara', label: '2-② 天皇中心の国づくり' },
    { key: 'u2c_heian', label: '2-③ 貴族のくらし' },
    { key: 'u2d_kamakura', label: '2-④ 武士の世の始まり' },
    { key: 'u2e_muromachi', label: '2-⑤ 室町文化' },
    { key: 'u2f_sengoku_unification', label: '2-⑥ 戦国から天下統一へ' },
    { key: 'u2g_edo_bakufu', label: '2-⑦ 江戸幕府の政治' },
    { key: 'u2h_edo_culture', label: '2-⑧ 町人の文化と新しい学問' },
    { key: 'u2i_meiji', label: '2-⑨ 明治の国づくり' },
    { key: 'u2j_meiji_world', label: '2-⑩ 世界に歩み出した日本' },
    { key: 'u2k_wwii', label: '2-⑪ 長く続いた戦争と人々のくらし' },
    { key: 'u2l_postwar_japan', label: '2-⑫ 新しい日本、平和な日本へ' },
    { key: 'u3_japan_and_the_world', label: '3. 世界の中の日本' },
  ];
})();
