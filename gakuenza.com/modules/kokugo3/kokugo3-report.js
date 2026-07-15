// kokugo3-report.js — reports a completed drill (kanji quiz or reading
// unit) via the shared HubCommon.reportActivityWithItems helper, same
// pattern as sansu3's report shim. Deliberately does NOT hand-roll the
// activity_results/activity_result_items insert — that's exactly where
// shakai3 shipped a real bug (wrong column names) by not doing this.
(function () {
  async function reportKokugo3(sb, ctx, { mode, unitKey, results }) {
    // mode: 'kanji' | 'reading' | 'grammar'
    // results: [{ itemRef, category, prompt, correct, selectedAnswer, correctAnswer }]
    const score = results.filter(r => r.correct).length;
    const maxScore = results.length;
    // activity_ref shape: "<module_key>/<part>/.../<timestamp>" — the gradebook
    // strips the trailing timestamp to group retries into one assignment
    // column, so keep the unit key in the ref for per-unit grouping.
    let activityRef;
    if (mode === 'kanji') activityRef = `kokugo3/kanji/${Date.now()}`;
    else if (mode === 'grammar') activityRef = `kokugo3/grammar/${unitKey}/${Date.now()}`;
    else activityRef = `kokugo3/reading/${unitKey}/${Date.now()}`;

    let payload;
    if (mode === 'kanji') payload = { mode: 'kanji' };
    else if (mode === 'grammar') payload = { mode: 'grammar', unit: unitKey };
    else payload = { mode: 'reading', unit: unitKey };

    return window.HubCommon.reportActivityWithItems(sb, {
      schoolId: ctx.schoolId,
      classId: ctx.classId,
      moduleId: ctx.moduleId,
      userId: ctx.userId,
      activityRef,
      score,
      maxScore,
      payload,
      items: results.map(r => ({
        itemRef: r.itemRef,
        category: r.category,
        prompt: r.prompt,
        correct: r.correct,
        selectedAnswer: r.selectedAnswer,
        correctAnswer: r.correctAnswer,
      })),
    });
  }
  window.Kokugo3Report = { reportKokugo3 };
})();
