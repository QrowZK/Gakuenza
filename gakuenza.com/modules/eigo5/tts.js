// tts.js — text-to-speech helper for eigo5 (English pronunciation).
// Uses the browser's built-in Web Speech API (no server, no API key needed).
'use strict';

const Eigo5TTS = (function () {
  const synth = (typeof window !== 'undefined') ? window.speechSynthesis : null;
  let isSpeaking = false;
  let cachedVoice = null;

  function pickVoice() {
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices || !voices.length) return null;
    return (
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang && v.lang.startsWith('en')) ||
      voices[0]
    );
  }

  function warmUpVoices() { if (synth) cachedVoice = pickVoice(); }

  if (synth) {
    warmUpVoices();
    synth.addEventListener('voiceschanged', warmUpVoices);
  }

  function speak(text, opts) {
    if (!synth || !text) return;
    opts = opts || {};
    if (isSpeaking) synth.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
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

// Delegated click handler for any .tts-btn on the page.
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.tts-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation(); // don't bubble into choice-selection handlers

  const text = btn.getAttribute('data-tts');
  if (!text) return;
  if (!Eigo5TTS.supported()) {
    console.warn('[Eigo5TTS] Speech synthesis not supported in this browser.');
    return;
  }
  btn.classList.add('tts-playing');
  Eigo5TTS.speak(text, { onEnd: () => btn.classList.remove('tts-playing') });
});
