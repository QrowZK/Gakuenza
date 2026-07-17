// kokugo1-report.js — reports a completed drill (kanji quiz or one of the
// かな/助詞/句読点 units) via the shared HubCommon.reportActivityWithItems
// helper, same pattern as kokugo3/5's report shims. Deliberately does NOT
// hand-roll the activity_results / activity_result_items insert — that's
// exactly where several modules shipped a real bug (right columns, but
// activity_result_items never written) by not using the shared helper.
(function () {
  async function reportKokugo1(sb, ctx, { unitKey, results }) {
    // unitKey: 'kanji' | 'hiragana' | 'katakana' | 'joshi' | 'kutouten'
    // results: [{ itemRef, category, prompt, correct, selectedAnswer, correctAnswer }]
    const score = results.filter(r => r.correct).length;
    const maxScore = results.length;
    // activity_ref shape: "<module_key>/<unit>/<timestamp>" — the gradebook
    // strips the trailing timestamp to group retries into one assignment
    // column, so keep the unit key in the ref for per-unit grouping.
    const activityRef = `kokugo1/${unitKey}/${Date.now()}`;
    const payload = { unit: unitKey };

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
  window.Kokugo1Report = { reportKokugo1 };
})();
