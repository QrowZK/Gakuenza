// tts.js — Reusable text-to-speech helper for Let's Try 2
// Uses the browser's built-in Web Speech API (no server, no API key needed).
'use strict';

const NHTTS = (function () {
  const synth = (typeof window !== 'undefined') ? window.speechSynthesis : null;
  let isSpeaking = false;
  let cachedVoice = null;

  function pickVoice() {
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices || !voices.length) return null;
    return (
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang && v.lang.startsWith('en')) ||
      voices[0]
    );
  }

  function warmUpVoices() { if (synth) cachedVoice = pickVoice(); }

  if (synth) {
    warmUpVoices();
    synth.addEventListener('voiceschanged', warmUpVoices);
  }

  // speak(text, opts?) — opts: { rate, onStart, onEnd }
  function speak(text, opts) {
    if (!synth || !text) return;
    opts = opts || {};

    if (isSpeaking) synth.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-GB';
    utt.rate = typeof opts.rate === 'number' ? opts.rate : 0.85;
    utt.pitch = 1.0;

    const voice = cachedVoice || pickVoice();
    if (voice) utt.voice = voice;

    utt.onstart = () => { isSpeaking = true; if (opts.onStart) opts.onStart(); };
    utt.onend   = () => { isSpeaking = false; if (opts.onEnd) opts.onEnd(); };
    utt.onerror = () => { isSpeaking = false; if (opts.onEnd) opts.onEnd(); };

    synth.speak(utt);
  }

  function stop() {
    if (synth) synth.cancel();
    isSpeaking = false;
  }

  function supported() { return !!synth; }

  return { speak, stop, supported };
})();

// ── Delegated click handler for any .tts-btn on the page ───────────────────
// NOTE: this stops propagation, but that only blocks ancestor listeners that
// haven't fired yet in the bubble phase. Any element that is itself a click
// container (cards that flip, choices that select, etc.) must ALSO check
// e.target.closest('.tts-btn') in its own handler and bail out early — see
// flashcard / match-item handlers in index.html for the pattern.
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.tts-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  const text = btn.getAttribute('data-tts');
  if (!text) return;

  if (!NHTTS.supported()) {
    console.warn('[NHTTS] Speech synthesis not supported in this browser.');
    return;
  }

  btn.classList.add('tts-playing');
  NHTTS.speak(text, {
    onEnd: () => btn.classList.remove('tts-playing')
  });
});
