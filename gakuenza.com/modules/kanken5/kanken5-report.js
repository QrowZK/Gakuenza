// kanken5-report.js — reports a completed 漢検5級 practice set via the shared
// HubCommon.reportActivityWithItems helper. Deliberately does NOT hand-roll the
// activity_results / activity_result_items insert — using the shared helper is
// what keeps per-question detail flowing into the gradebook (three other
// modules skipped it and lost their item-level analysis). Best-effort: a
// reporting failure never blocks the student's result screen.
(function () {
  'use strict';

  async function reportKanken5(sb, ctx, { categoryKey, categoryLabel, results }) {
    // results: [{ itemRef, category, prompt, correct, selectedAnswer, correctAnswer }]
    const score = results.filter(r => r.correct).length;
    const maxScore = results.length;
    // activity_ref: <module>/<category>/<timestamp> — the trailing timestamp
    // is stripped by the gradebook to group repeated attempts of the same
    // category into one assignment column (HubCommon.assignmentKeyFromRef).
    const activityRef = `kanken5/${categoryKey}/${Date.now()}`;

    return window.HubCommon.reportActivityWithItems(sb, {
      schoolId: ctx.schoolId,
      classId: ctx.classId,
      moduleId: ctx.moduleId,
      userId: ctx.userId,
      activityRef,
      score,
      maxScore,
      payload: { section: categoryLabel, category: categoryKey },
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

  window.Kanken5Report = { reportKanken5 };
})();
