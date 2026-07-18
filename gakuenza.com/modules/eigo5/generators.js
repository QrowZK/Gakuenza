// generators.js — 外国語 5年 (eigo5) question builders.
//
// Two shapes:
//   buildVocabQuestion(word, pool, qtype)   — 'en2ja' | 'ja2en'
//   buildSentenceQuestion(item)             — fill-in-the-blank
//
// Distractor-collision discipline (CLAUDE.md testing bar):
//   • Vocab: a distractor's shown gloss must NEVER also be a correct
//     translation of the prompt word. We enforce this by excluding any
//     candidate whose en OR ja matches the prompt word's en OR ja (so a
//     synonym pair sharing a gloss can never both appear), and by rejecting
//     any candidate whose *displayed* text equals the correct answer text.
//   • Sentences: each item carries its own hand-authored `distractors` pool
//     of contextually-wrong fills, so exactly one option is correct by
//     construction; we only assert uniqueness + answer-absence here.
'use strict';

(function (root) {
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n) { return shuffle(arr).slice(0, n); }
  const norm = s => String(s == null ? '' : s).trim().toLowerCase();

  // Build a vocab multiple-choice question.
  //   word  : the target vocab object
  //   pool  : candidate distractor words (array of vocab objects)
  //   qtype : 'en2ja' (prompt EN, answer JA) | 'ja2en' (prompt JA, answer EN)
  // Returns { prompt, promptLang, answer, answerLang, emoji, choices:[...],
  //           correctIndex, word }.
  function buildVocabQuestion(word, pool, qtype) {
    const answerText = qtype === 'en2ja' ? word.ja : word.en;
    const promptText = qtype === 'en2ja' ? word.en : word.ja;

    // Candidate distractors: exclude the word itself, and exclude any word
    // that shares the prompt's en OR ja (kills synonym-gloss leakage). Then
    // dedupe by the *displayed* text so no two options ever read identically.
    const seenDisplay = new Set([norm(answerText)]);
    const candidates = [];
    for (const w of pool) {
      if (w.id === word.id) continue;
      if (norm(w.en) === norm(word.en) || norm(w.ja) === norm(word.ja)) continue;
      const disp = qtype === 'en2ja' ? w.ja : w.en;
      const key = norm(disp);
      if (seenDisplay.has(key)) continue;
      seenDisplay.add(key);
      candidates.push(w);
    }

    const wrong = sample(candidates, 3).map(w => (qtype === 'en2ja' ? w.ja : w.en));
    const choices = shuffle([answerText, ...wrong]);
    return {
      word,
      qtype,
      prompt: promptText,
      promptLang: qtype === 'en2ja' ? 'en' : 'ja',
      answer: answerText,
      answerLang: qtype === 'en2ja' ? 'ja' : 'en',
      // Only the ENGLISH side is ever read aloud.
      ttsText: word.en,
      emoji: word.emoji || '',
      choices,
      correctIndex: choices.indexOf(answerText),
    };
  }

  // Build a sentence fill-in question from a self-contained item.
  // Returns { text, blankText, answer, hint, choices:[...], correctIndex }.
  function buildSentenceQuestion(item) {
    const wrong = sample(item.distractors, 3);
    const choices = shuffle([item.answer, ...wrong]);
    return {
      id: item.id,
      unit: item.unit,
      // Rendered prompt with the blank shown as a box.
      text: item.text.replace('____', '＿＿＿'),
      rawText: item.text,
      answer: item.answer,
      hint: item.hint || '',
      // Full correct sentence, for review/answer display.
      full: item.text.replace('____', item.answer),
      choices,
      correctIndex: choices.indexOf(item.answer),
    };
  }

  const api = { buildVocabQuestion, buildSentenceQuestion, shuffle, sample };
  if (typeof root !== 'undefined') root.Eigo5Gen = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
