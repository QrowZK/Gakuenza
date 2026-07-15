<!-- BUILD STATUS: completed 2026-07-15 (branch claude/build-spec-4gsbdy) -->
<!-- Built: modules/shakai4/ (石川県版, 5 units / 15 sections / 66 questions),
     db/2026-07-15_register_shakai4_module.sql, hub/module-units.js entry.
     Region-specific facts researched & verified (白山/手取川, 令和6年能登半島地震,
     板屋兵四郎/辰巳用水, 輪島/金沢/加賀). Migration NOT yet applied to the live
     project — apply on merge, same as prior module registrations. -->

# shakai4 — new module build spec

Companion doc: SHARED_INFRA_CONTEXT.md — read that first.

Built against 東京書籍「新編 新しい社会」第4学年, 令和6年度版 (same
publisher/series as the already-live shakai3, which was independently
verified this session against the official structure and concept map
— see shakai3_verification.md if available).

## Module identity

Directory `modules/shakai4/`, key `shakai4`, subject `'social'`,
launch_url `/modules/shakai4/index.html`, name `社会 4年`.

## Verified unit structure — 5 units

1. **わたしたちの県** — the prefecture overview: all 47 prefectures'
   names/positions, then the home prefecture's own geography (terrain,
   land use, cities, transportation, industry distribution)
2. **健康なくらしを支える仕組み** — two sub-units, typically both
   covered: 水はどこから (drinking water supply — purification plant
   process, historical water-supply development, dam/watershed
   management) and ごみのしょりと利用 (waste processing — collection,
   incineration, recycling, historical development)
3. **自然災害からくらしを守る** — disaster preparedness (the real
   textbook example unit covers 風水害/flood-storm damage specifically,
   but the underlying 学習指導要領 content is natural disaster
   preparedness broadly — see note below on what to substitute for
   Ishikawa)
4. **県内の伝統・文化と先人の働き** — two sub-units: 残したいもの
   伝えたいもの (preserved local cultural properties/traditions and the
   people who maintain them) and a 先人の働き sub-unit (a historical
   figure whose work benefited the region — the reference example
   covers a historical irrigation/infrastructure project)
5. **県内の特色ある地域** — 選択 unit: schools choose representative
   examples across categories (traditional local industry, international
   exchange, scenic/heritage tourism) — the reference materials
   describe covering 2-3 of these categories via real example towns,
   not all possible categories exhaustively

## Critical: the source material's examples are from a different
## prefecture — do not use them

The Tokyo Shoseki 年間指導計画作成資料 fetched for this research uses
**宮城県 (Miyagi Prefecture) as its worked example throughout** —
仙台市, 松島町, 蔵王町, 登米市登米町, and a historical irrigation-project
figure all appear as the reference material's specific illustrative
content, not because Ishikawa's real textbook edition uses them.
**This is exactly the same pattern already confirmed for grade-3
shakai's concept map** (which used 福岡市/明石市 as its own worked
example) — the **5-unit structure above is the real, transferable
skeleton to build against**, but every region-specific fact (which
city, which industry, which historical figure, which specific
disaster) needs to be **Ishikawa's own real content, researched
separately**, not copied from this reference material.

**This means shakai4 needs a second research pass this spec doesn't
already cover**, specifically:
- Unit 1: Ishikawa's real geography — terrain, major cities, industry
  distribution, transportation network (Hakui's own location within
  this).
- Unit 2: the real water-supply and waste-processing operators/systems
  serving Hakui or a representative Ishikawa city — this is genuinely
  local civic information, needs its own lookup (likely a Hakui City
  or Ishikawa Prefecture public-works page, similar to how school
  adoption records were found earlier in this project).
- Unit 3: Ishikawa's real, regionally-significant natural disaster
  history is a strong, obvious candidate here — **令和6年能登半島地震
  (the January 2024 Noto Peninsula earthquake)** is exactly the kind
  of recent, regionally-significant event this unit type is built
  around, and was already referenced elsewhere in this project's own
  research (Hakui recorded 震度5強). Worth verifying this is
  age-appropriate and handled with the same tonal care noted for
  emotionally-weighted content elsewhere in this project (see
  kokugo3's wartime-story note in its own spec) — a real, recent
  disaster that affected the students' own region needs sensitive,
  factual framing, not a generic "storms are scary" treatment.
- Unit 4: a real Ishikawa historical figure/preserved tradition —
  needs its own research, not yet done.
- Unit 5: 2-3 real Ishikawa towns/cities with distinctive
  characteristics (industry, international exchange, or heritage
  tourism) — needs its own research, not yet done.

**Do not build this module's actual question content from the Miyagi
example material's specific facts.** Use it only for confirming the
unit *structure*, sub-unit breakdown, and question-type patterns
(the 学習問題-per-subunit, つかむ→調べる→まとめる→いかす flow) —
exactly the same "structure yes, examples no" discipline already
proven correct for shakai3.

## Design approach

Given the region-specific research gap above, this module has a
different risk profile than sansu4/rika4 — the structural research is
done, but the content research needs a dedicated pass before
questions can be authored responsibly. Recommend treating "confirm
Ishikawa's real facts for units 1-5" as an explicit first phase,
separate from building the actual quiz app — the same way shakai3's
concept-map verification was a distinct step from building shakai3
itself.

Question style: closer to shakai3's model (mostly fixed, authored
content per fact/topic) than to a generator-heavy approach — social
studies facts are specific and don't parameterize the way arithmetic
does.

## Copyright

Same discipline as shakai3: the underlying civic facts (how water
treatment works generally, what waste processing involves, that the
Noto earthquake happened and affected the region) are independently-
documented, verifiable facts — not the textbook's copyrighted
expression. Build original questions around Ishikawa's real facts;
never reproduce the reference PDF's specific Miyagi-example sentences,
even in adapted form, since the goal isn't to adapt Miyagi's content
to Ishikawa, it's to build genuinely Ishikawa-based content using the
same unit structure.

## focus_units

Same situation as sansu4/rika4 — build to honor `class_modules.
focus_units` from the start given it's a real column with no current
consumers. Suggested keys: `u1_prefecture`, `u2_water_waste`,
`u3_disaster_prep`, `u4_heritage_and_pioneers`, `u5_featured_areas`.
