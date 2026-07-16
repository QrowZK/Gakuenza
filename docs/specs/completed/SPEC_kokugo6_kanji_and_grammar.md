# kokugo6 — new module build spec (kanji drill only — see scope note)

## Scope note — read this first

Same situation as kokugo5's spec: reading-comprehension units are
explicitly NOT specced here, for the same reason — a research pass
this session initially (and incorrectly) pulled Tokyo Shoseki's own
"新編 新しい国語" line instead of Mitsumura Tosho's actual grade-6
materials (光村図書 is the real publisher Hakui uses). That research
was discarded rather than built on. One thing worth knowing even
though it isn't being used to build anything yet: the (wrong-publisher)
search did surface real, well-known grade-6-appropriate literary works
as a general sense of what this grade covers — an explanatory text
about Easter Island deforestation, and 海のいのち (a well-known,
significant work) among them — useful only as a *sense of the grade's
general shape*, not as verified Mitsumura curriculum. Treat none of it
as confirmed until a proper Mitsumura-sourced pass happens.

## Module identity

Directory `modules/kokugo6/`, key `kokugo6`, subject `'japanese'`,
launch_url `/modules/kokugo6/index.html`, name `国語 6年`.

## What's safe to build right now: the kanji drill

Grade 6's MEXT-assigned kanji list is a closed, officially-defined
set, same category as kokugo3's/kokugo5's. Verify the complete list
from a dedicated reference source before building, cross-checking the
count against the officially documented total — don't assume or
reconstruct from memory.

Follow kokugo3's exact generator pattern and stress-test discipline
(large-batch checks for wrong option counts and distractor collisions
— this bug class has shipped twice already in this project's own
kanji generator).

Note: grade 6 is the final elementary grade, so this kanji list
completes the full elementary 学年別漢字配当表 across all six grades
once built — worth flagging as a real milestone when it lands, not
just another module.

## Grammar/language-mechanics — also plausible to include now

Same reasoning as kokugo5 — closed rule-system content is safe to
build fast. Verify grade-6-appropriate grammar/language content
specifically rather than assuming grade-3's or grade-5's topics
carry over unchanged.

## What's deferred, deliberately

Reading-comprehension units — needs a proper research pass against
Mitsumura's real grade-6 materials, same rigor as every prior kokugo
reading unit got individually. Not something to rush under this
deadline, especially given how close this session came to building on
the wrong publisher's content entirely — worth treating that near-miss
as a reason for *more* care on this specific piece, not less.

## Copyright

Same discipline as every kokugo module — kanji/grammar has no
passage-reproduction risk; reading units, whenever built, follow the
same "reference, don't reproduce" rule kokugo3 established.

## Testing

Same bar as kokugo3's/kokugo5's kanji drill — large-batch stress
test, flow test, migration idempotency.
