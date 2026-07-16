# shakai5 — new module build spec

Built against 東京書籍「新編 新しい社会」第5学年, 令和6年度版
(shakai_keikaku_ryakuan_5.pdf, fetched directly from Tokyo Shoseki).

## Module identity

Directory `modules/shakai5/`, key `shakai5`, subject `'social'`,
launch_url `/modules/shakai5/index.html`, name `社会 5年`.

## Verified unit structure — 5 units, 100 hours

1. **わたしたちの国土** (20h) — Japan's position in the world, terrain
   features, climate, contrasting-lifestyle sub-units (low-land vs.
   high-land living, warm-region vs. cold-region living — each pair
   is a 選択, schools pick one side, so building both is the right
   call for a practice tool, same reasoning as shakai3's unit 2).
2. **わたしたちの生活と食料生産** (25h) — food production nationally:
   rice-farming regions, fishing industry regions, the future of food
   production.
3. **わたしたちの生活と工業生産** (21h) — industrial production:
   automobile manufacturing specifically, transport/trade supporting
   industry, the future of industrial production.
4. **情報化した社会と産業の発展** (15h) — information industry, how
   industries use information, how citizens use information.
5. **わたしたちの生活と環境** (19h) — disaster prevention, forestry
   and daily life, environmental protection.

## Important, genuinely good news: this grade mostly sidesteps the
## Miyagi/Ishikawa regional-substitution problem that shakai3/shakai4 hit

Unlike grades 3-4 (built around "your own prefecture/city"), grade 5's
content is **national in scope** — Japan's overall geography, and
industry content built around nationally-representative regions
(major rice-growing regions, major fishing ports, automobile
manufacturing centers) that the real curriculum picks for their
national significance, not because they're the student's home region.
Using the same nationally-representative examples every edition of
this textbook uses should be safe and correct here — this is a
different situation from shakai3/shakai4's spec, not the same caution
repeated.

**One real check still worth doing**: confirm which specific
regions/examples the actual textbook edition uses for the 選択 sub-
units (rice/fishing/automobile) before authoring questions — "which
specific representative region" is a fact worth verifying directly
rather than assuming, even though the *category* of region (a real,
significant national example) isn't the regional-substitution problem
grades 3-4 had.

## Design approach

Closer to shakai3/shakai4's model (mostly fixed, authored content per
topic) than a generator-heavy approach — geography/industry facts are
specific and don't parameterize the way arithmetic does.

## Copyright

Underlying civic/geographic facts (Japan's terrain, real industry
statistics, how rice farming works) are independently-documented and
safe to build from. Never reproduce the reference PDF's specific
phrasing.

## Testing

Same structural bar as shakai3/shakai4 — no duplicate/invalid options,
correct answer present, flow test through the actual quiz UI.

## focus_units

Build to honor `class_modules.focus_units` from the start. Suggested
keys: `u1_national_land`, `u2_food_production`, `u3_industrial_production`,
`u4_information_society`, `u5_environment`.
