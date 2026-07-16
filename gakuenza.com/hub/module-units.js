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
//              modules/kokugo3/reading-units.js + each key of GRAMMAR_UNITS in
//              modules/kokugo3/grammar-generators.js.
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
      { key: 'haru', label: '読解：春風をたどって' },
      { key: 'maigo', label: '読解：まいごのかぎ' },
      { key: 'chiichan', label: '読解：ちいちゃんのかげおくり' },
      { key: 'daizu', label: '読解：すがたをかえる大豆' },
      { key: 'touge', label: '読解：三年とうげ' },
      { key: 'ari', label: '読解：ありの行列' },
      { key: 'mochimochi', label: '読解：モチモチの木' },
      { key: 'kosoado', label: 'ことば：こそあど言葉' },
      { key: 'shuushoku', label: 'ことば：修飾語' },
      { key: 'kotowaza', label: 'ことば：ことわざ・故事成語' },
      { key: 'romaji', label: 'ことば：ローマ字' },
    ],
    // kokugo5 unit keys == the literal 'kanji' (the kanji drill) + each key of
    // GRAMMAR_UNITS in modules/kokugo5/grammar-generators.js. (No reading-
    // comprehension units yet — kokugo5 ships kanji + grammar only; see its
    // build spec.)
    kokugo5: [
      { key: 'kanji', label: '漢字れんしゅう' },
      { key: 'keigo', label: 'ことば：敬語' },
      { key: 'kanyouku', label: 'ことば：慣用句' },
      { key: 'goshu', label: 'ことば：和語・漢語・外来語' },
      { key: 'doukun', label: 'ことば：同じ読み方の漢字' },
    ],
    // rika4 unit keys == the `key` of each unit in modules/rika4/rika4-data.js
    // (RIKA4_DATA.UNIT_KEYS). The module runner reads focus_units and
    // foregrounds these same keys on its menu.
    rika4: [
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
    ],
    // rika6 unit keys == the `key` of each unit in modules/rika6/rika6-data.js
    // (RIKA6_DATA.UNIT_KEYS). The module runner reads focus_units and
    // foregrounds these same keys on its menu. Listed in the real 11-unit
    // teaching order (units cross the two strand families, so this ordering
    // differs from the module's B-then-A menu grouping).
    rika6: [
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
    ],
    shakai4: [
      { key: 'u1_prefecture', label: '1. わたしたちの県 石川県' },
      { key: 'u2_water_waste', label: '2. 健康なくらしを支える仕組み（水・ごみ）' },
      { key: 'u3_disaster_prep', label: '3. 自然災害からくらしを守る' },
      { key: 'u4_heritage_and_pioneers', label: '4. 県内の伝統・文化と先人の働き' },
      { key: 'u5_featured_areas', label: '5. 県内の特色ある地域' },
    ],
    // shakai6 focus keys are matched at the SECTION level (see
    // modules/shakai6/app.js partitionUnits): units 1 & 3 share one key each,
    // history (unit 2) has a distinct key per chronological period.
    shakai6: [
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
    ],
    // sansu4 unit keys == the `key` of each unit in modules/sansu4/generators.js
    // (window.SANSU4_DATA.UNITS), documented in modules/sansu4/README.md.
    // u15_review (4年のまとめ) is intentionally excluded — a mixed review,
    // not a focus-unit target.
    sansu4: [
      { key: 'u01_big_numbers', label: '1. 大きい数のしくみ' },
      { key: 'u02_line_graphs', label: '2. 折れ線グラフと表' },
      { key: 'u03_division1', label: '3. わり算の筆算(1)' },
      { key: 'u04_angles', label: '4. 角の大きさ' },
      { key: 'u05_decimals_structure', label: '5. 小数のしくみ' },
      { key: 'u06_division2', label: '6. わり算の筆算(2)' },
      { key: 'u07_rounding', label: '7. がい数の表し方と使い方' },
      { key: 'u08_calc_rules', label: '8. 計算のきまり' },
      { key: 'u09_quadrilaterals', label: '9. 垂直、平行と四角形' },
      { key: 'u10_fractions', label: '10. 分数' },
      { key: 'u11_change', label: '11. 変わり方調べ' },
      { key: 'u12_area', label: '12. 面積のくらべ方と表し方' },
      { key: 'u13_decimal_muldiv', label: '13. 小数のかけ算とわり算' },
      { key: 'u14_boxes', label: '14. 直方体と立方体' },
    ],
    // sansu5 unit keys == the `key` of each unit in modules/sansu5/generators.js
    // (window.SANSU5_DATA.UNITS), documented in modules/sansu5/README.md.
    // u19_review (5年のまとめ) is intentionally excluded — a mixed review,
    // not a focus-unit target.
    sansu5: [
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
    ],
  };

  // Convenience: the unit list for a module key, or [] if it has no units.
  window.moduleUnitsFor = function (moduleKey) {
    return (window.MODULE_UNITS && window.MODULE_UNITS[moduleKey]) || [];
  };
})();
