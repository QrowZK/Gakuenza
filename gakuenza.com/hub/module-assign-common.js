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
// Focus-unit source of truth: each module ships its own
// modules/<key>/units.js that self-registers window.MODULE_UNITS[<key>].
// There is NO shared registry file — moduleUnitsFor() lazy-loads a module's
// own units.js on demand and caches it. A module with no units.js simply
// offers no unit picker (its file 404s → []), which is harmless
// (focus_units stays null = all units).
(function () {
  'use strict';

  // ---- per-module unit registry (lazy-loaded) -------------------------------

  // Cache of resolved unit lists, keyed by module key ([] for "no units").
  var _unitCache = {};
  // In-flight/settled <script> injections, keyed by src (one per key).
  var _scriptPromises = {};

  // Inject a <script> exactly once per src and resolve when it settles.
  // Resolves on BOTH load and error: a module with no units.js (404) is a
  // valid "no unit picker" state, not a failure to surface.
  function loadScriptOnce(src) {
    if (_scriptPromises[src]) return _scriptPromises[src];
    _scriptPromises[src] = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { resolve(); };
      document.head.appendChild(s);
    });
    return _scriptPromises[src];
  }

  // Async: the unit list for a module key, or [] if it has none. Lazy-loads
  // the module's own /modules/<key>/units.js (self-registers MODULE_UNITS[key])
  // the first time it's asked for, then caches.
  async function moduleUnitsFor(moduleKey) {
    if (!moduleKey) return [];
    if (_unitCache[moduleKey]) return _unitCache[moduleKey];
    if (!(window.MODULE_UNITS && window.MODULE_UNITS[moduleKey])) {
      await loadScriptOnce('/modules/' + moduleKey + '/units.js');
    }
    _unitCache[moduleKey] = (window.MODULE_UNITS && window.MODULE_UNITS[moduleKey]) || [];
    return _unitCache[moduleKey];
  }

  // Sync: the ALREADY-loaded unit list for a key, or [] if not yet loaded /
  // no units. Use only after moduleUnitsFor(key) has resolved for that key
  // (e.g. when building an HTML string that can't await per item).
  function moduleUnitsCached(moduleKey) {
    if (!moduleKey) return [];
    if (_unitCache[moduleKey]) return _unitCache[moduleKey];
    return (window.MODULE_UNITS && window.MODULE_UNITS[moduleKey]) || [];
  }

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

  // Coarse "ensure assigned, don't touch config" — the shape the bulk matrix
  // (hub/admin/modules.html) wants. Upserts a null-metadata row ONLY when none
  // exists; ignoreDuplicates means an already-assigned class keeps whatever
  // due_date / total_items / focus_units a teacher set in the gradebook, and a
  // stale-read re-assign can't raise a PK-conflict error. Never carries
  // metadata itself — null focus_units = all units, null due_date = no deadline,
  // which are the correct defaults for a grid toggle (metadata is configured in
  // the gradebook's per-assignment modal, not here).
  function assignModuleIfAbsent(sb, opts) {
    var row = { class_id: opts.classId, module_id: opts.moduleId };
    return sb.from('class_modules')
      .upsert(row, { onConflict: 'class_id,module_id', ignoreDuplicates: true });
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

  // ---- data operations on module_assignments (#176 — discrete tasks) --------
  // A module_assignment is a discrete task a teacher hands out (module + optional
  // units + target + due), distinct from class_modules "enablement". Multiple per
  // class, attributed to the creator. RLS: read = student/teacher/staff of the
  // class; write = teacher/staff, self-attributed. See migration
  // 20260724024845 and SPEC_teacher_assignment_workflow.md.

  // Assignments for a class (or array of class_ids, for the multi-class student
  // hub), soonest-due first, with joined module info.
  function loadModuleAssignments(sb, classId) {
    var q = sb.from('module_assignments')
      .select('id, class_id, module_id, created_by, title, focus_units, target_items, due_date, created_at, modules(id, key, name, subject, launch_url)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    return Array.isArray(classId) ? q.in('class_id', classId) : q.eq('class_id', classId);
  }

  // Create a discrete assignment. createdBy MUST be the caller's own user id —
  // RLS enforces created_by = auth.uid() on insert (self-attribution).
  function createModuleAssignment(sb, opts) {
    return sb.from('module_assignments').insert({
      class_id: opts.classId,
      module_id: opts.moduleId,
      created_by: opts.createdBy,
      title: opts.title || null,
      focus_units: normalizeFocus(opts.focusUnits),
      target_items: opts.targetItems != null ? opts.targetItems : null,
      due_date: opts.dueDate || null,
      instructions: opts.instructions || null,
    });
  }

  function deleteModuleAssignment(sb, id) {
    return sb.from('module_assignments').delete().eq('id', id);
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
  // has no unit structure (no modules/<key>/units.js). selected = array of
  // currently-focused keys (checks those boxes). Async: lazy-loads the module's
  // units.js on first use — callers must await it.
  async function focusUnitsFieldHtml(moduleKey, selected) {
    var units = await moduleUnitsFor(moduleKey);
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

  // Async unit lookup, kept on window for back-compat with existing callers.
  window.moduleUnitsFor = moduleUnitsFor;

  window.ModuleAssign = {
    moduleUnitsFor: moduleUnitsFor,
    moduleUnitsCached: moduleUnitsCached,
    loadAssigned: loadAssigned,
    loadSchoolEnabledIds: loadSchoolEnabledIds,
    assignModule: assignModule,
    assignModuleIfAbsent: assignModuleIfAbsent,
    unassignModule: unassignModule,
    updateAssignment: updateAssignment,
    loadModuleAssignments: loadModuleAssignments,
    createModuleAssignment: createModuleAssignment,
    deleteModuleAssignment: deleteModuleAssignment,
    gradeMismatch: gradeMismatch,
    gradeMismatchMessage: gradeMismatchMessage,
    focusUnitsFieldHtml: focusUnitsFieldHtml,
    readFocusUnitsField: readFocusUnitsField,
    bulkResetPasswords: bulkResetPasswords,
    bulkResultMessage: bulkResultMessage,
  };
})();
