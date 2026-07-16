# kokugo5 — new module build spec (kanji drill only — see scope note)

## Scope note — read this first

This spec covers **only the kanji drill**, following kokugo3's proven,
verified pattern exactly. **Reading-comprehension units are explicitly
NOT specced here.** During research for this batch, a real mistake was
caught and discarded: a search for grade 5/6 kokugo unit structure
initially pulled Tokyo Shoseki's own "新編 新しい国語" line — a
*different publisher's textbook* than the one Hakui actually uses.
Hakui's 国語 is 光村図書 (Mitsumura Tosho), the same publisher kokugo3
was correctly built against. Rather than build a spec on the wrong
textbook's structure, or rush un-verified Mitsumura research under
time pressure, reading units are deferred to a proper follow-up pass
sourced correctly from Mitsumura's own grade-5 materials — the same
research rigor daizu, ari, and モチモチの木 each got individually.

## Module identity

Directory `modules/kokugo5/`, key `kokugo5`, subject `'japanese'`,
launch_url `/modules/kokugo5/index.html`, name `国語 5年`.

## What's safe to build right now: the kanji drill

Grade 5's MEXT-assigned kanji list (学年別漢字配当表) is a closed,
officially-defined set — same category of fast, safe, verifiable
research as kokugo3's 200-character grade-3 list. Before building:
verify the complete grade-5 list from a dedicated reference source
(the same rigor kokugo3's list got — fetch a real source, cross-check
the count against the officially documented total, don't reconstruct
from memory or a single unverified page).

Follow kokugo3's exact generator pattern (`kanji-generator.js`) as the
template — reading/kanji-selection/stroke-count question types,
procedurally generated, not a fixed bank. Apply the identical
stress-test discipline: kokugo3's generator shipped two real
distractor-collision bugs (fewer-than-4-options on stroke-count
questions; same-reading kanji sneaking in as secretly-also-correct
distractors) that only surfaced at scale (500-5000 generated
instances), not from manual spot-checks. Assume the same risk exists
here.

## Grammar/language-mechanics — also plausible to include now

Grade 5's 文法/language-mechanics content (kokugo3's finish-spec built
こそあど言葉, 修飾語, ことわざ・故事成語, ローマ字 generators as
closed, rule-based systems) is a similar category of safe, fast-
buildable content — closed rule systems, not per-unit narrative
research. If there's time, a grade-5-appropriate grammar generator set
is reasonable to include in this same pass, using kokugo3's grammar-
generators.js as the template. Verify grade-5-specific grammar content
(from MEXT's 学習指導要領 or Mitsumura's own materials) rather than
assuming grade-3's topics carry over unchanged.

## What's deferred, deliberately

Reading-comprehension units — needs a real research pass against
Mitsumura's actual grade-5 materials (their teacher-resource site,
matching the pattern used for kokugo3: unit structure + 単元一覧表,
never the actual passage text). This is genuinely slower work — each
narrative/informational unit needs its own research the way daizu,
ari, and モチモチの木 each did — and shouldn't be rushed to hit this
deadline. A kanji-and-grammar-only kokugo5 is a real, useful,
testable thing on its own; a rushed reading-unit set built on
unverified or wrong-publisher research is not.

## Copyright

Same discipline as kokugo3 throughout — kanji/grammar content has no
passage-reproduction risk at all (closed rule systems, official
lists). Whenever reading units do get built, the same "reference,
don't reproduce" rule applies exactly as it did for kokugo3.

## Testing

Same bar as kokugo3's kanji drill — large-batch stress test, flow
test through the actual quiz UI, migration idempotency.
