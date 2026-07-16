// kokugo6-report.js — reports a completed drill (kanji quiz or grammar unit)
// via the shared HubCommon.reportActivityWithItems helper, same pattern as
// kokugo3's report shim. Deliberately does NOT hand-roll the activity_results/
// activity_result_items insert — that's exactly where shakai3 shipped a real
// bug (wrong column names / no per-item rows) by not doing this.
//
// kokugo6 ships the kanji + grammar drills only; reading-comprehension units
// are deliberately deferred (see the module spec), so there is no 'reading'
// mode here yet.
(function () {
  async function reportKokugo6(sb, ctx, { mode, unitKey, results }) {
    // mode: 'kanji' | 'grammar'
    // results: [{ itemRef, category, prompt, correct, selectedAnswer, correctAnswer }]
    const score = results.filter(r => r.correct).length;
    const maxScore = results.length;
    // activity_ref shape: "<module_key>/<part>/.../<timestamp>" — the gradebook
    // strips the trailing timestamp to group retries into one assignment
    // column, so keep the unit key in the ref for per-unit grouping.
    let activityRef;
    if (mode === 'kanji') activityRef = `kokugo6/kanji/${Date.now()}`;
    else activityRef = `kokugo6/grammar/${unitKey}/${Date.now()}`;

    let payload;
    if (mode === 'kanji') payload = { mode: 'kanji' };
    else payload = { mode: 'grammar', unit: unitKey };

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
  window.Kokugo6Report = { reportKokugo6 };
})();
