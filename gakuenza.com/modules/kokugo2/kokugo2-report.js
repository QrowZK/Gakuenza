// kokugo2-report.js — reports a completed drill (kanji quiz or a kana/
// orthography/grammar unit) via the shared HubCommon.reportActivityWithItems
// helper, same pattern as kokugo3's report shim. Deliberately does NOT
// hand-roll the activity_results/activity_result_items insert — that's exactly
// where shakai3 shipped a real bug (wrong column names) by not doing this.
(function () {
  async function reportKokugo2(sb, ctx, { mode, unitKey, results }) {
    // mode: 'kanji' | 'grammar'
    // results: [{ itemRef, category, prompt, correct, selectedAnswer, correctAnswer }]
    const score = results.filter(r => r.correct).length;
    const maxScore = results.length;
    // activity_ref shape: "<module_key>/<part>/.../<timestamp>" — the gradebook
    // strips the trailing timestamp to group retries into one assignment
    // column, so keep the unit key in the ref for per-unit grouping.
    let activityRef;
    if (mode === 'kanji') activityRef = `kokugo2/kanji/${Date.now()}`;
    else activityRef = `kokugo2/grammar/${unitKey}/${Date.now()}`;

    const payload = mode === 'kanji' ? { mode: 'kanji' } : { mode: 'grammar', unit: unitKey };

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
  window.Kokugo2Report = { reportKokugo2 };
})();
