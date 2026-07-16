// kokugo5-report.js — reports a completed drill (kanji quiz or grammar unit)
// via the shared HubCommon.reportActivityWithItems helper, same pattern as
// kokugo3's report shim. Deliberately does NOT hand-roll the activity_results/
// activity_result_items insert — that's exactly where several modules shipped a
// real bug (right columns, but activity_result_items never written) by not
// using the shared helper. kokugo5 has no reading-comprehension mode yet, so
// only 'kanji' and 'grammar' are handled.
(function () {
  async function reportKokugo5(sb, ctx, { mode, unitKey, results }) {
    // mode: 'kanji' | 'grammar'
    // results: [{ itemRef, category, prompt, correct, selectedAnswer, correctAnswer }]
    const score = results.filter(r => r.correct).length;
    const maxScore = results.length;
    // activity_ref shape: "<module_key>/<part>/.../<timestamp>" — the gradebook
    // strips the trailing timestamp to group retries into one assignment column,
    // so keep the unit key in the ref for per-unit grouping.
    let activityRef;
    if (mode === 'kanji') activityRef = `kokugo5/kanji/${Date.now()}`;
    else activityRef = `kokugo5/grammar/${unitKey}/${Date.now()}`;

    const payload = (mode === 'kanji') ? { mode: 'kanji' } : { mode: 'grammar', unit: unitKey };

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
  window.Kokugo5Report = { reportKokugo5 };
})();
