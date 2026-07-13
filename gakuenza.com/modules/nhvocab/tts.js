// tts.js — Reusable text-to-speech helper for NH Vocab (TangoApp)
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
// Buttons should be created like:
//   <button class="tts-btn" data-tts="apple" aria-label="発音を聞く">🔊</button>
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.tts-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation(); // don't let it bubble into choice-selection / flip handlers

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
