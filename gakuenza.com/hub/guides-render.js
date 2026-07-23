// hub/guides-render.js — thin wrapper around the vendored marked.min.js
// (hub/marked.min.js, MIT, https://github.com/markedjs/marked) used by
// hub/guides.html to render the per-module teacher guides
// (hub/guides/<key>.md) into HTML.
//
// Security note: marked's default behavior is to pass through any literal
// HTML found in the markdown source UNESCAPED (raw-HTML passthrough is
// standard CommonMark behavior, not a marked bug — see
// https://spec.commonmark.org/, "raw HTML blocks/spans"). The 29 guide
// files are repo-committed and currently contain no literal HTML, but this
// page renders whatever the fetched .md file contains at request time, so
// treat it like any other content this project doesn't fully control per
// the stored-XSS convention already documented on HubCommon.escapeHtml —
// never assume it's safe just because it "shouldn't" contain markup.
// Overriding renderer.html to escape (instead of the default passthrough)
// closes that vector at the source for both block-level raw HTML
// (`<div>...</div>` alone on a line) and inline raw HTML
// (`<img src=x onerror=...>` inside a paragraph), while leaving every bit
// of markup marked itself generates (tables, headings, lists, code spans,
// etc.) untouched — this is NOT a general-purpose sanitizer, it only ever
// escapes tokens marked itself classifies as literal raw HTML.
// Global-agnostic root: window in the browser, global under the Node test
// harness — so this same file loads unmodified in both.
var __gzRoot = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : this);

__gzRoot.GuidesRender = (function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let configured = false;
  function ensureConfigured(markedLib) {
    if (configured) return;
    const renderer = new markedLib.Renderer();
    renderer.html = function (token) {
      // marked v5+ passes either the raw string (older call sites) or a
      // token object with a .text field, depending on context — handle both.
      const raw = typeof token === 'string' ? token : (token && token.text) || '';
      return escapeHtml(raw);
    };
    markedLib.use({ renderer, gfm: true, breaks: false });
    configured = true;
  }

  // markedLib defaults to window.marked (the vendored global) but is
  // injectable so this file can also be exercised from a plain Node test
  // (see the verification script) without a browser/DOM present.
  function renderMarkdown(mdText, markedLib) {
    const lib = markedLib || __gzRoot.marked;
    if (!lib) throw new Error('GuidesRender.renderMarkdown: marked is not loaded');
    ensureConfigured(lib);
    return lib.parse(mdText || '');
  }

  return { renderMarkdown, escapeHtml };
})();

// Allow `require('./guides-render.js')` from a Node test script — harmless
// in the browser since `module` is undefined there.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = __gzRoot.GuidesRender;
}
