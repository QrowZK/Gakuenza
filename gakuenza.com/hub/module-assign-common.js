// module-assign-common.js — shared module-assignment logic used by both the
// admin class-detail page and the educator-facing Gradebook 課題/名簿 pages.
//
// Extract-don't-copy: the assign / unassign / due-date / focus-units writes and
// the bulk-password loop live here once, so the admin surface and the educator
// surface can't drift (the exact failure this project hit with two class-detail
// copies). Surfaces differ only in their own markup and access scope; the data
// operations are identical and RLS is the real boundary (class_modules writes
// admit staff school-wide OR the taught-class educator; see cmod_write policy).
//
// Depends on: hub/module-units.js (window.MODULE_UNITS) for the focus-unit
// checkbox source of truth. Load module-units.js before this file.
(function () {
  'use strict';

  // ---- data operations on class_modules -------------------------------------

  // Assignment rows for a class, newest module metadata + focus_units included.
  function loadAssigned(sb, classId) {
    return sb
      .from('class_modules')
      .select('module_id, due_date, total_items, focus_units, modules(id, key, name, subject)')
      .eq('class_id', classId);
  }

  // Which modules are school-enabled for a school (the shelf a teacher picks
  // from). Returns a Set of module_id.
  async function loadSchoolEnabledIds(sb, schoolId) {
    const { data, error } = await sb
      .from('school_modules').select('module_id').eq('school_id', schoolId).eq('enabled', true);
    if (error) return null;
    return new Set((data || []).map(function (r) { return r.module_id; }));
  }

  function assignModule(sb, opts) {
    var row = {
      class_id: opts.classId,
      module_id: opts.moduleId,
      total_items: opts.totalItems != null ? opts.totalItems : null,
      due_date: opts.dueDate || null,
    };
    if (opts.focusUnits !== undefined) row.focus_units = normalizeFocus(opts.focusUnits);
    return sb.from('class_modules').insert(row);
  }

  function unassignModule(sb, opts) {
    return sb.from('class_modules').delete()
      .eq('class_id', opts.classId).eq('module_id', opts.moduleId);
  }

  // Patch an existing assignment: pass any of { dueDate, focusUnits, totalItems }.
  function updateAssignment(sb, opts) {
    var patch = {};
    if (opts.dueDate !== undefined) patch.due_date = opts.dueDate || null;
    if (opts.totalItems !== undefined) patch.total_items = opts.totalItems;
    if (opts.focusUnits !== undefined) patch.focus_units = normalizeFocus(opts.focusUnits);
    return sb.from('class_modules').update(patch)
      .eq('class_id', opts.classId).eq('module_id', opts.moduleId);
  }

  // null/empty -> null ("all units"); otherwise a de-duped array of keys.
  function normalizeFocus(keys) {
    if (!keys || !keys.length) return null;
    return Array.from(new Set(keys));
  }

  // ---- soft grade-mismatch warning ------------------------------------------

  // recommendedGrades = modules.recommended_grades (int[] or null); classYear =
  // classes.year. Returns true when there IS a recommendation and the class
  // year isn't in it. Advisory only — the caller shows a confirm, never blocks
  // (cross-grade use is valid: review, advanced students, special-ed).
  function gradeMismatch(recommendedGrades, classYear) {
    if (!recommendedGrades || !recommendedGrades.length) return false;
    if (classYear == null) return false;
    return recommendedGrades.indexOf(Number(classYear)) === -1;
  }

  function gradeMismatchMessage(recommendedGrades, classYear, moduleName) {
    return '「' + moduleName + '」は ' + recommendedGrades.join('・') + '年 向けのモジュールです。' +
      classYear + '年 のクラスに割り当てようとしています。\n\n続けますか？';
  }

  // ---- focus-unit checkbox field --------------------------------------------

  // Returns HTML for a set of unit checkboxes for a module, or '' if the module
  // has no unit structure (window.MODULE_UNITS has no entry). selected = array
  // of currently-focused keys (checks those boxes).
  function focusUnitsFieldHtml(moduleKey, selected) {
    var units = (window.moduleUnitsFor ? window.moduleUnitsFor(moduleKey) : []) || [];
    if (!units.length) return '';
    var sel = new Set(selected || []);
    var boxes = units.map(function (u) {
      var checked = sel.has(u.key) ? ' checked' : '';
      return '<label class="ma-focus-opt"><input type="checkbox" class="ma-focus-box" value="' +
        u.key + '"' + checked + '> <span>' + escapeHtml(u.label) + '</span></label>';
    }).join('');
    return '<div class="ma-focus-field" data-module-key="' + moduleKey + '">' +
      '<div class="ma-focus-hint">今週の単元（任意・チェックした単元を前面に）</div>' + boxes + '</div>';
  }

  // Read the checked keys back out of a container that holds a focus field.
  // Returns null when nothing is checked ("all units"), else an array of keys.
  function readFocusUnitsField(containerEl) {
    if (!containerEl) return null;
    var boxes = containerEl.querySelectorAll('.ma-focus-box');
    var keys = [];
    boxes.forEach(function (b) { if (b.checked) keys.push(b.value); });
    return keys.length ? keys : null;
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // ---- bulk password reset (per-student update-student loop) -----------------

  // Sets one password for every student in `roster` by calling the
  // update-student edge function once each (its own authorization already
  // admits school_admin/coordinator school-wide and a class-assigned teacher).
  // roster items: { user_id, profiles: { display_name, student_number } }.
  // onProgress(done, total) is called before each request. Returns
  // { successCount, failures: [displayName|id, ...] }.
  async function bulkResetPasswords(opts) {
    var roster = opts.roster || [];
    var successCount = 0;
    var failures = [];
    for (var i = 0; i < roster.length; i++) {
      var student = roster[i];
      if (opts.onProgress) opts.onProgress(i + 1, roster.length);
      try {
        var res = await fetch(opts.cfg.supabaseUrl + '/functions/v1/update-student', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + opts.accessToken,
          },
          body: JSON.stringify({
            student_id: student.user_id,
            school_id: opts.schoolId,
            class_id: opts.classId,
            student_number: (student.profiles && student.profiles.student_number) || '',
            display_name: (student.profiles && student.profiles.display_name) || '',
            password: opts.password,
          }),
        });
        var body = await res.json();
        if (res.ok && body.ok) successCount++;
        else failures.push((student.profiles && student.profiles.display_name) || student.user_id);
      } catch (err) {
        failures.push((student.profiles && student.profiles.display_name) || student.user_id);
      }
    }
    return { successCount: successCount, failures: failures };
  }

  // Standard partial-failure message, shared by both surfaces.
  function bulkResultMessage(successCount, failures) {
    if (!failures.length) return successCount + '名全員に設定しました。';
    return successCount + '名は設定できましたが、' + failures.length + '名は失敗しました（' +
      failures.slice(0, 3).join('、') + (failures.length > 3 ? ' 他' : '') + '）。';
  }

  window.ModuleAssign = {
    loadAssigned: loadAssigned,
    loadSchoolEnabledIds: loadSchoolEnabledIds,
    assignModule: assignModule,
    unassignModule: unassignModule,
    updateAssignment: updateAssignment,
    gradeMismatch: gradeMismatch,
    gradeMismatchMessage: gradeMismatchMessage,
    focusUnitsFieldHtml: focusUnitsFieldHtml,
    readFocusUnitsField: readFocusUnitsField,
    bulkResetPasswords: bulkResetPasswords,
    bulkResultMessage: bulkResultMessage,
  };
})();
