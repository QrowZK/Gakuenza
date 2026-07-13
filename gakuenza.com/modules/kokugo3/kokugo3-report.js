// kokugo3-report.js — reports a completed drill (kanji quiz or reading
// unit) via the shared HubCommon.reportActivityWithItems helper, same
// pattern as sansu3's report shim. Deliberately does NOT hand-roll the
// activity_results/activity_result_items insert — that's exactly where
// shakai3 shipped a real bug (wrong column names) by not doing this.
(function () {
  async function reportKokugo3(sb, ctx, { mode, unitKey, results }) {
    // mode: 'kanji' | 'reading'
    // results: [{ itemRef, category, prompt, correct, selectedAnswer, correctAnswer }]
    const score = results.filter(r => r.correct).length;
    const maxScore = results.length;
    const activityRef = mode === 'kanji'
      ? `kokugo3/kanji/${Date.now()}`
      : `kokugo3/reading/${unitKey}/${Date.now()}`;

    return window.HubCommon.reportActivityWithItems(sb, {
      schoolId: ctx.schoolId,
      classId: ctx.classId,
      moduleId: ctx.moduleId,
      userId: ctx.userId,
      activityRef,
      score,
      maxScore,
      payload: mode === 'kanji' ? { mode: 'kanji' } : { mode: 'reading', unit: unitKey },
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
