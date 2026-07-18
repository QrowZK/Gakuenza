// units.js — self-registered focus-unit registry for sansu1.
//
// A module declares its own units here; there is NO shared registry. The
// assignment UIs lazy-load this file on demand (module-assign-common.js →
// moduleUnitsFor) to render the focus_units checkboxes. The keys here MUST
// match the module's internal unit keys exactly, because the module runner
// reads focus_units and foregrounds by these same keys. A module with no
// units.js simply offers no unit picker (focus_units stays null = all units).
//
// sansu1 unit keys == the `key` of each unit in modules/sansu1/generators.js.
(function () {
  'use strict';
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.sansu1 = [
    { key: 'u01_to10', label: '1. 10までのかず' },
    { key: 'u02_ordinal', label: '2. なんばんめ' },
    { key: 'u03_compose', label: '3. いくつといくつ' },
    { key: 'u04_add1', label: '4. たしざん(1)' },
    { key: 'u05_sub1', label: '5. ひきざん(1)' },
    { key: 'u06_to20', label: '6. 20までのかず' },
    { key: 'u07_clock', label: '7. なんじ・なんじはん' },
    { key: 'u08_three_terms', label: '8. 3つのかずのけいさん' },
    { key: 'u09_add2', label: '9. たしざん(2)' },
    { key: 'u10_sub2', label: '10. ひきざん(2)' },
    { key: 'u11_to100', label: '11. 大きいかず' },
    { key: 'u12_addsub2digit', label: '12. たしざんとひきざん' },
    { key: 'u13_compare', label: '13. どちらがながい・おおい・ひろい' },
    { key: 'u14_shapes', label: '14. かたちづくり・いろいろなかたち' },
  ];
})();
