// units.js — self-registered focus-unit registry for shakai4.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file to render the focus_units checkboxes; the
// keys MUST match the module's internal unit keys exactly.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.shakai4 = [
    { key: 'u1_prefecture', label: '1. わたしたちの県 石川県' },
    { key: 'u2_water_waste', label: '2. 健康なくらしを支える仕組み（水・ごみ）' },
    { key: 'u3_disaster_prep', label: '3. 自然災害からくらしを守る' },
    { key: 'u4_heritage_and_pioneers', label: '4. 県内の伝統・文化と先人の働き' },
    { key: 'u5_featured_areas', label: '5. 県内の特色ある地域' },
  ];
})();
