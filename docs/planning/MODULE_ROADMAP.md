# Module Roadmap — closing the grades 1–6 coverage gap

_Scoping doc, 2026-07-16. Design/planning only — no code, no migrations._

> **Update 2026-07-17:** sansu1, sansu2, kokugo1, and kokugo2 (Priority tier A
> item 1–2 and tier B items 4–5 below) all shipped — see
> `docs/specs/completed/`. Coverage matrix and gap table below updated
> accordingly.
>
> **Update 2026-07-18:** the last two core-grid gaps **shipped** — **kokugo4**
> (#101) and **eigo5** (#100), built in parallel by subagents from
> `docs/specs/completed/SPEC_kokugo4_new_module.md` / `SPEC_eigo5_new_module.md`.
> **The grades-1–6 core grid is now complete.** Both used the post-#99 per-module
> `modules/<key>/units.js` convention (the shared `hub/module-units.js` registry
> that had corrupted twice under parallel PRs was deleted in #99). The §3.3/§3.6
> sketches below are the historical build specs, now superseded by the completed
> spec docs; where a sketch still says "add a block to `module-units.js`," that
> shared file no longer exists — the built modules ship their own `units.js`.

The top sketches below are written to be droppable into
`docs/specs/pending/` later, matching the `docs/specs/completed/` format.

> **Detail layer.** This is the deep-dive for curriculum modules. The single
> source of truth for roadmap priority/ordering is [`../ROADMAP.md`](../ROADMAP.md)
> — change ordering there, keep module detail (matrix, gaps, specs) here.

Pilot school: 羽咋市立瑞穂小学校 (Mizuho ES, Hakui). Publisher facts that
matter and are already established in this repo:

- **算数 (math):** built against 東京書籍「新編 新しい算数」 (sansu3–6 all
  use this series). Grades 1–2 continue the same publisher.
- **国語 (japanese):** Hakui uses **光村図書 (Mitsumura Tosho)**, NOT Tokyo
  Shoseki. The kokugo5 spec records a real caught mistake where grade-5/6
  research initially pulled the wrong publisher's line. Any new kokugo
  module must source unit structure from Mitsumura.
- **理科 / 社会:** 東京書籍 series (rika3–6, shakai3–6).
- **外国語 (english):** nh6 is New Horizon Elementary 6 (東京書籍);
  letstry1/2 are MEXT's *Let's Try! 1 & 2* (外国語活動, grades 3–4).

---

## 1. Coverage matrix (subject × grade)

Legend: ✅ built · ❌ missing · — not taught at this grade in the Japanese
curriculum.

| Subject (constraint value)        | G1 | G2 | G3 | G4 | G5 | G6 |
|-----------------------------------|----|----|----|----|----|----|
| 算数 math (`math`)                | ✅ sansu1 | ✅ sansu2 | ✅ sansu3 | ✅ sansu4 | ✅ sansu5 | ✅ sansu6 |
| 国語 japanese (`japanese`)        | ✅ kokugo1 | ✅ kokugo2 | ✅ kokugo3 | ✅ kokugo4 | ✅ kokugo5 | ✅ kokugo6 |
| 理科 science (`science`)          | — | — | ✅ rika3 | ✅ rika4 | ✅ rika5 | ✅ rika6 |
| 社会 social (`social`)            | — | — | ✅ shakai3 | ✅ shakai4 | ✅ shakai5 | ✅ shakai6 |
| 外国語 english (`english`)        | — | — | ✅ letstry1* | ✅ letstry2* | ✅ eigo5 | ✅ nh6 |

\* Let's Try! 1 & 2 are the MEXT 外国語活動 materials for grades 3–4.
Mapping them strictly to a single grade is approximate (schools split them
3→LT1, 4→LT2), but both grade-3 and grade-4 English have a live module.

**Supplementary / cross-grade modules (not grade-locked):**

| Module   | What it is | Notes |
|----------|-----------|-------|
| kanken3  | 漢検 grade-3 kanji drill (≈8級 range) | supplements kokugo kanji |
| kanken4  | 漢検 grade-4 kanji drill (≈7級 range) | |
| kanken5  | 漢検 grade-5 kanji drill (≈6級 range) | |
| eiken    | Eiken (英検) prep | supplements english |
| nhvocab  | New Horizon vocabulary drill | supplements english |

**Kanken coverage note:** kanken drills exist for grade-3/4/5 kanji only.
漢検 for grades 1/2/6 (10級/9級/5級 material) is absent, but these largely
duplicate the per-grade kokugo kanji drills and are supplementary, so they
sit at the bottom of the priority list.

### Core gaps (the grades-1–6 completion set)

| # | Missing module | Subject | Grade | Fills |
|---|----------------|---------|-------|-------|
| 1 | ~~sansu1~~ ✅ shipped 2026-07-17 | math | 1 | grade-1 math |
| 2 | ~~sansu2~~ ✅ shipped 2026-07-17 | math | 2 | grade-2 math |
| 3 | ~~kokugo4~~ ✅ shipped 2026-07-18 (#101) | japanese | 4 | hole in the middle of the built japanese line |
| 4 | ~~kokugo1~~ ✅ shipped 2026-07-17 | japanese | 1 | grade-1 japanese |
| 5 | ~~kokugo2~~ ✅ shipped 2026-07-17 | japanese | 2 | grade-2 japanese |
| 6 | ~~eigo5 / nh5~~ ✅ shipped 2026-07-18 (#100) | english | 5 | only remaining 外国語 grade gap |

**The core grades-1–6 grid is now complete** — kokugo4 (#101) and eigo5 (#100)
shipped 2026-07-18, closing the last two holes. 算数/国語 cover grades 1–6,
理科/社会 cover 3–6, and 外国語 covers 3/4 (Let's Try) + 5/6.

---

## 2. Prioritized build list

### Priority tier A — build first (pilot breadth, low risk, fast)

1. **sansu1 (算数 1年)** and **2. sansu2 (算数 2年)** — ✅ shipped 2026-07-17
   - _Why first:_ grades 1–2 have zero coverage; math is the most
     proceduralizable, copyright-safe, and battle-tested generator family in
     the repo (sansu3–6 share one architecture). Highest ROI per hour.
   - _Risk:_ low. No passage/copyright exposure. Main watch item is that G1/G2
     content leans on manipulatives/pictures the drill format must translate
     into text/number questions (see sketches for which units survive that
     translation and which shrink to a token drill).
   - sansu2 carries the かけ算九九 (multiplication tables) — one of the
     highest-value, most drillable objects in the entire elementary
     curriculum. Reason enough to prioritize sansu2 even alone.

3. **kokugo4 (国語 4年) — kanji + grammar only** — ✅ shipped 2026-07-18 (#101)
   - _Why:_ fills the conspicuous hole between kokugo3 and kokugo5/6, and the
     safe half (grade-4 kanji list is a closed MEXT set; grammar is closed
     rule systems) is exactly the kokugo5/6 pattern already shipped twice.
     Reading-comprehension units deferred, same as kokugo5/6.
   - _Risk:_ low for the kanji+grammar scope; the deferred reading units are
     where the copyright care lives (see §4). Registry decentralization
     (formerly a build-order blocker for building this alongside eigo5 in
     parallel) shipped 2026-07-18 — see the update note at the top of this
     doc; no longer a constraint.

### Priority tier B — completes lines, moderate effort

4. **kokugo1 (国語 1年)** and **5. kokugo2 (国語 2年) — kanji + kana + grammar**
   — ✅ shipped 2026-07-17
   - _Why after tier A:_ completes the japanese line for the youngest grades
     and pairs with sansu1/sansu2 to give grades 1–2 a real two-subject shelf.
   - _Risk / extra design:_ grade 1 is an early-literacy grade — the drill is
     as much かな (hiragana/katakana) and 助詞 as it is the 80-kanji list.
     This is a genuinely different generator mix than kokugo3+ (which assume
     the child already reads kana). Needs its own kana-drill generator, not
     just a smaller kanji list. Grade-2 is closer to the kokugo3 shape
     (160 kanji + more grammar).

### Priority tier C — completes english line, higher effort

6. **eigo5 / nh5 (外国語 5年)** — ✅ shipped 2026-07-18 (#100)
   - _Why last of the core set:_ the only remaining English grade gap, but
     English modules are the "ported app" family (nh6, nhvocab, eiken,
     letstry1/2) — heavier to stand up than a native generator, and grade-5
     English is partially shadowed by eiken/nhvocab already. Also the most
     copyright-sensitive english surface (New Horizon 5 dialogues/passages).

### Priority tier D — supplementary, optional

7. **kanken 10級 / 9級 / 5級** (grades 1/2/6 漢字検定). Duplicates the
   per-grade kokugo kanji drills; build only if 漢検 prep is a distinct
   product goal, not for curriculum coverage.

---

## 3. Spec sketches for the top priorities

Each follows the `docs/specs/completed/` structure: module identity → verified
unit structure → generator/design approach → distractor-collision cautions →
module-units.js keys → registration migration notes → copyright. All migration
notes obey CLAUDE.md hard rules: absolute `launch_url`, idempotent
update-then-insert, explicit `is_active=true`, subject matching the CHECK
constraint (`english/math/japanese/science/social/sougou/misc`), and
`recommended_grades int[]`. All reporting MUST go through
`HubCommon.reportActivityWithItems()` (never hand-roll the `activity_results`
insert — see CLAUDE.md rule 2 and the five modules that got this wrong).
Student context resolves via `enrollments → classes.school_id`, never
`profiles.home_school_id` (rule 3). All new `style.css` files are
self-contained token copies, never linking root `style.css` (rule 1).

---

### 3.1 sansu1 — 算数 1年

**Identity.** Dir `modules/sansu1/`, key `sansu1`, subject `'math'`,
launch_url `/modules/sansu1/index.html`, name `算数 1年`,
recommended_grades `[1]`. Build against 東京書籍「新しい算数」1年 (same series
as sansu3–6; verify current 令和 edition unit list from Tokyo Shoseki before
authoring, same as every sansu spec).

**Verified-against-source unit structure (typical Tokyo Shoseki G1 order —
confirm exact titles/edition):**
1. 10までのかず — counting/reading numbers to 10
2. なんばんめ — ordinal position (前から3番目)
3. いくつといくつ — number composition/decomposition of 10 (the core G1 skill)
4. たしざん(1) — addition without carrying (sums ≤ 10)
5. ひきざん(1) — subtraction without borrowing (minuend ≤ 10)
6. 20までのかず — numbers 11–20, tens-and-ones intro
7. なんじ・なんじはん — clock: o'clock and half-past only
8. 3つのかずのけいさん — three-term add/subtract
9. たしざん(2) — addition with carrying (くり上がり)
10. ひきざん(2) — subtraction with borrowing (くり下がり)
11. 大きいかず — numbers to 100, tens-and-ones place value
12. たしざんとひきざん — two-digit ± one-digit (no regroup)
13. どちらがながい／おおい／ひろい — direct comparison of length/volume/area
14. かたちづくり・いろいろなかたち — shape recognition/composition

**Design.** Reuse the sansu3–6 generator architecture directly. Per-unit
translatability into a text/number drill:
- Fully proceduralizable (build these): 1, 3, 4, 5, 8, 9, 10, 11, 12 —
  parameterized number generation, the sansu family's core competency.
- Clock (7): reuse whatever clock-reading question UI sansu3 unit 2 (時こくと
  時間) uses; G1 restricts to o'clock/half-past.
- Comparison (13) and shapes (14): these are picture-native in the textbook.
  Render as text comparisons ("12cm と 9cm、ながいのはどちら") and shape-name
  ID rather than manipulatives; keep them a small share of the bank.
- Ordinal (2): "前から3番目・後ろから2番目" position questions.

**Distractor-collision cautions (testing bar).**
- 「いくつといくつ」 decomposition: a "10 は 6 と □" question has exactly one
  answer, but if you also generate "which pair makes 10" multi-select, ensure
  no distractor pair also sums to the target (e.g. don't let 3+7 and 4+6 both
  appear as options when the prompt is "makes 10").
- Comparison questions with equal magnitudes ("same length") — either exclude
  ties or make "同じ" an explicit option; never emit two options that are both
  the correct comparison.
- Clock: half-past vs o'clock ambiguity — verify the generated hand positions
  map to exactly one stated time.
Stress-test at hundreds–thousands per unit, asserting exactly one correct
option and no secretly-also-correct distractor.

**module-units.js keys** (register under `sansu1`, must match the module's
internal `UNITS` keys exactly):
`u01_to10`, `u02_ordinal`, `u03_compose`, `u04_add1`, `u05_sub1`,
`u06_to20`, `u07_clock`, `u08_three_terms`, `u09_add2`, `u10_sub2`,
`u11_to100`, `u12_addsub2digit`, `u13_compare`, `u14_shapes`.

**Registration migration.** Idempotent update-then-insert into `modules`;
`key='sansu1'`, `subject='math'`, `launch_url='/modules/sansu1/index.html'`,
`name='算数 1年'`, `recommended_grades='{1}'`, `is_active=true` set
explicitly. Commit the matching `supabase/migrations/<ts>_register_sansu1.sql`
AND apply via MCP `apply_migration` (writes the ledger) — never
`execute_sql`/dashboard. (sansu1 shipped 2026-07-17; its unit keys now live in
`modules/sansu1/units.js`, migrated off the old shared registry by #99.)

**Copyright.** No passage risk. Original problems from the verified unit list;
never reproduce the textbook's specific example problems or illustrations.

---

### 3.2 sansu2 — 算数 2年

**Identity.** Dir `modules/sansu2/`, key `sansu2`, subject `'math'`,
launch_url `/modules/sansu2/index.html`, name `算数 2年`,
recommended_grades `[2]`. 東京書籍「新しい算数」2年.

**Verified-against-source unit structure (typical Tokyo Shoseki G2 order —
confirm edition):**
1. 表とグラフ — simple tables and picture graphs
2. たし算のひっ算 — 2-digit column addition (with carry)
3. ひき算のひっ算 — 2-digit column subtraction (with borrow)
4. 長さ — length: cm / mm
5. 100より大きい数 — numbers to 1000, place value
6. かさ — volume: L / dL / mL
7. 時こくと時間 — time and elapsed duration (minutes)
8. 計算のくふう — grouping/order strategies for mental calc
9. たし算とひき算のひっ算 — 3-digit column add/subtract
10. 三角形と四角形 — triangles & quadrilaterals, right angles
11. かけ算(1) — multiplication intro + 九九 for 2,3,4,5
12. かけ算(2) — 九九 for 6,7,8,9,1; whole times-table
13. 長い長さ — length in m; unit conversion
14. 分数 — simple fractions (1/2, 1/4)
15. はこの形 — box shapes: faces/edges/vertices

**Design.** Same sansu architecture. The centerpiece is **かけ算九九 (units
11–12)** — the single most drillable object in elementary math: generate the
full 1×1…9×9 space with reading direction both ways, missing-factor
(□×4=28), and mixed review. Column arithmetic (2, 3, 9) and place value (5)
are straight parameterized generation. Length/volume unit conversion (4, 6,
13) generate cleanly. Time/duration (7) reuses the sansu clock UI with
elapsed-minute questions. Geometry (10, 15) as shape-property ID / counting
faces-edges-vertices.

**Distractor-collision cautions.**
- 九九: with a numeric answer and three numeric distractors, ensure no
  distractor equals the product. The classic G2 trap is off-by-one-row
  distractors (7×8=56 with 48/54/63) — fine as long as none equals 56;
  auto-assert `distractor !== answer` for every generated item.
- Missing-factor 九九 (□×6=42): must have a unique factor in 1–9. Exclude
  products with two factorizations inside the table (e.g. 12 = 2×6 = 3×4 =
  4×3 = 6×2) when the prompt fixes only the product and one operand is blank —
  or fix the other operand so the answer is unique.
- Unit conversion (1m20cm ↔ 120cm): ensure only one option is the correct
  equivalent; watch mixed-unit distractors that reduce to the same value.
- 分数: don't let 2/4 and 1/2 both appear as options for "half."
Stress-test the full 九九 space exhaustively (it's small — enumerate all 81)
plus thousands of the parameterized units.

**module-units.js keys** (`sansu2`):
`u01_tables_graphs`, `u02_add_column`, `u03_sub_column`, `u04_length_cm_mm`,
`u05_to1000`, `u06_volume`, `u07_time`, `u08_calc_tricks`,
`u09_addsub3digit`, `u10_tri_quad`, `u11_mult1`, `u12_mult2`,
`u13_length_m`, `u14_fractions`, `u15_boxes`.
(If a 2年のまとめ review unit exists in the edition, exclude it from
focus_units like sansu5/6 exclude their review unit.)

**Registration migration.** As sansu1, with `key='sansu2'`,
`recommended_grades='{2}'`, `name='算数 2年'`.

**Copyright.** No passage risk; original problems only.

---

### 3.3 kokugo4 — 国語 4年 (kanji + grammar; reading deferred)

**Identity.** Dir `modules/kokugo4/`, key `kokugo4`, subject `'japanese'`,
launch_url `/modules/kokugo4/index.html`, name `国語 4年`,
recommended_grades `[4]`. Publisher: **光村図書 (Mitsumura Tosho)** — the same
publisher kokugo3/5/6 were correctly built against. Do NOT pull Tokyo
Shoseki's 国語 line (the exact mistake the kokugo5 spec caught).

**Scope note (mirror kokugo5/6 exactly).** Ship **kanji + grammar only**.
Reading-comprehension units are deferred to a properly-sourced Mitsumura
research pass, same discipline as kokugo5/6 — a kanji-and-grammar kokugo4 is a
real, testable module on its own; a rushed reading set on unverified research
is not.

**Kanji drill.** Grade-4 MEXT 学年別漢字配当表 is a closed set (verify the
complete grade-4 list and its official count against a dedicated reference —
same rigor kokugo3's list got; do not reconstruct from memory). Follow
kokugo3's `kanji-generator.js` exactly (reading / kanji-selection /
stroke-count question types, procedural, not a fixed bank).

**Grammar / language-mechanics.** Grade-4-appropriate closed rule systems,
templated on kokugo3's `grammar-generators.js`. Verify grade-4 topics from
MEXT 学習指導要領 / Mitsumura materials rather than assuming grade-3 carries
over. Strong grade-4 candidates (confirm against source):
- 漢字の組み立て・部首 (radical/構成 of kanji, 漢字辞典の使い方: 音訓・部首索引)
- 慣用句 (idioms) and/or ことわざ (grade-3 built ことわざ・故事成語; pick
  grade-4-level items)
- つなぎ言葉・接続語 (conjunctions: だから/しかし/また…)
- 主語・述語・修飾語の関係 (sentence structure, extends grade-3's 修飾語)
- 熟語の意味 (two-kanji compound meaning)

**Distractor-collision cautions.** This is the exact bug class kokugo3's kanji
generator shipped TWICE:
- Stroke-count questions: guarantee ≥4 options and that no distractor equals
  the true stroke count.
- Reading questions: a "wrong reading" distractor must never be a *valid*
  reading of the same kanji (同訓/同音 leakage). By construction, draw
  distractors from readings that are provably not attached to the target.
- Grammar (接続語, 部首): a distractor must never also be a correct fit for the
  blank — kokugo3's grammar generators are built so a distractor can never be
  a valid answer by construction (see the COLLISION DISCIPLINE header in
  `kokugo3/grammar-generators.js`); replicate that.
Stress-test 500–5000 generated instances per generator; these bugs only
surface at scale.

**units.js keys** (`kokugo4`): ship `modules/kokugo4/units.js` self-registering
`window.MODULE_UNITS.kokugo4` — `kanji` + one key per GRAMMAR_UNIT, matching
kokugo5/6's convention (they register `kanji` + grammar keys, no reading keys).
Suggested: `kanji`, `bushu` (部首・漢字の組み立て), `setsuzoku` (つなぎ言葉),
`kanyouku` (慣用句), `shugo_jutsugo` (主語・述語・修飾語), `jukugo` (熟語の意味).
Final keys MUST equal the module's internal GRAMMAR_UNITS keys exactly. There is
NO shared registry — never edit a common file (#94, deleted in #99).

**Registration migration.** Idempotent; `key='kokugo4'`,
`subject='japanese'`, `launch_url='/modules/kokugo4/index.html'`,
`name='国語 4年'`, `recommended_grades='{4}'`, `is_active=true` explicit.
Commit `supabase/migrations/` file + apply via MCP.

**Copyright.** Kanji/grammar are closed rule systems / official lists — zero
passage-reproduction risk. When reading units are eventually built, the
"reference, don't reproduce" rule applies exactly as for kokugo3 (§4).

---

### 3.4 kokugo2 — 国語 2年 (kanji + kana + grammar; reading deferred)

**Identity.** Dir `modules/kokugo2/`, key `kokugo2`, subject `'japanese'`,
launch_url `/modules/kokugo2/index.html`, name `国語 2年`,
recommended_grades `[2]`. Publisher **光村図書**.

**Scope.** Kanji + kana/orthography + grammar; defer Mitsumura reading units
(same discipline as kokugo4/5/6).

**Kanji drill.** Grade-2 MEXT list (closed set; verify complete list + count).
kokugo3 `kanji-generator.js` pattern. Grade-2 kanji have more 音訓 pairs than
grade-1 — good reading-drill material.

**Kana / orthography generators (the grade-2-specific addition).** Grade 2
still teaches orthography that grade 3+ assumes fluent — build closed
rule-system generators for:
- カタカナ (katakana forms + when to use カタカナ: 外来語/擬音語)
- かなづかい (は/わ, を/お, へ/え particle spelling; ぢ/じ, づ/ず;
  長音・拗音・促音 spelling)
- 主語と述語 (subject/predicate identification — grade-2 intro)
- なかまの言葉・反対の言葉 (word categories, antonyms)
- 丸・点・かぎ (句読点・かぎかっこ placement)

**Distractor-collision cautions.** Same kanji-generator discipline as kokugo4.
For かなづかい: a "wrong spelling" distractor must be genuinely wrong — watch
homophone traps where two spellings are both acceptable in different contexts
(disambiguate by fixing the sentence context so exactly one is right). For
antonyms/categories: ensure only one option is the true antonym/member.

**module-units.js keys** (`kokugo2`): `kanji`, `katakana`, `kanazukai`,
`shugo_jutsugo`, `nakama` (なかま・反対の言葉), `kutouten`. Match internal keys.

**Registration migration.** `key='kokugo2'`, `subject='japanese'`,
`recommended_grades='{2}'`, else as §3.3.

**Copyright.** Closed systems / official kanji list — no passage risk in this
scope.

---

### 3.5 kokugo1 — 国語 1年 (kana-first: hiragana/katakana + 80 kanji + basics)

**Identity.** Dir `modules/kokugo1/`, key `kokugo1`, subject `'japanese'`,
launch_url `/modules/kokugo1/index.html`, name `国語 1年`,
recommended_grades `[1]`. Publisher **光村図書**.

**Design note — this is NOT just a smaller kokugo3.** Grade 1 is the
early-literacy grade; the drill's center of gravity is **かな**, not kanji.
The kanji list is only 80 characters. Build, in priority order:
- ひらがな recognition/reading (50音, 濁音/半濁音, 拗音・促音・長音)
- カタカナ recognition/reading
- 助詞 は・を・へ (particle usage — the canonical grade-1 orthography point)
- 句読点・かぎ (basic punctuation placement)
- 漢字 80字 drill (kokugo3 `kanji-generator.js` pattern, small list)

**Distractor-collision cautions.** かな/kanji reading questions: a distractor
character/reading must never also be a correct reading of the prompt. For 拗音
(きゃ/きゅ/きょ) vs 促音 vs 長音 spelling, fix sentence context so exactly one
spelling is right. Same ≥4-options and no-secretly-correct-distractor asserts.
Because the audience is 6-year-olds, keep option counts and prompt length
small; that constrains the generator but does not change the collision rule.

**module-units.js keys** (`kokugo1`): `hiragana`, `katakana`, `joshi`
(は・を・へ), `kutouten`, `kanji`. Match internal keys.

**Registration migration.** `key='kokugo1'`, `subject='japanese'`,
`recommended_grades='{1}'`, else as §3.3.

**Copyright.** No passage risk (かな/kanji are the official writing system;
grade-1 reading passages, if ever built, need the §4 discipline).

---

### 3.6 eigo5 / nh5 — 外国語 5年 (English)

**Identity.** Dir `modules/eigo5/` (or `nh5/`), key `eigo5`, subject
`'english'`, launch_url `/modules/eigo5/index.html`, name `外国語 5年`,
recommended_grades `[5]`. Grade-5 外国語 in Hakui is New Horizon Elementary 5
(東京書籍) — same series as nh6.

**Design decision to resolve in the spec.** Two viable patterns already exist
in the repo:
- **Ported-app pattern** (nh6/nhvocab/eiken/letstry1/2): heavier; reuses an
  upstream engine with a report shim. If porting a New Horizon 5 app, follow
  `nh6/README.md` and re-point it at the shared session + `activity_results`.
- **Native vocab/phrase generator** (recommended for a fresh build): a
  nhvocab-style native drill over the grade-5 外国語 target vocabulary and
  key sentence patterns, reporting through `HubCommon.reportActivityWithItems`
  from the start (cleaner than the ported apps, several of which hand-roll and
  are missing item-level rows — CLAUDE.md rule 2).

**Grade-5 外国語 target skills (New Horizon Elementary 5 unit arc — verify
against current edition):** self-introduction/spelling, months & birthdays,
subjects & timetable (What do you want to study), daily schedule & time (What
time do you…), can/can't (abilities), locations & directions (Where is…),
food & prices (What would you like), describing a person/hero (Who is…).
Build vocabulary + sentence-pattern drills around these; keep to the
listening/reading-recognition and word/phrase-choice question shapes that fit
a text drill (this grade is heavily oral in class — the module supplements,
not replaces, that).

**Distractor-collision cautions.** Vocab multiple-choice: a distractor gloss
must never also be a correct translation of the prompt word (synonym leakage —
e.g. "行く" for both *go* and a near-synonym). Sentence-pattern fill-ins:
ensure only one option is grammatical/correct in context. Standard scale
stress-test.

**units.js keys.** Optional (English modules aren't unit-scoped today). If
added, ship `modules/eigo5/units.js` with a key per New Horizon 5 unit
(`u01_hello`…`u08_hero`), matching internal keys; otherwise ship no `units.js`
at all (focus_units stays null = all). No shared registry (#94).

**Registration migration.** `key='eigo5'`, `subject='english'`,
`launch_url='/modules/eigo5/index.html'`, `recommended_grades='{5}'`,
`is_active=true` explicit, idempotent, ledger via MCP.

**Copyright (elevated care — see §4).** New Horizon 5's dialogues, passages,
and character-specific content ARE copyrighted expression. Build original
vocabulary and sentence-pattern items testing the same target language;
never reproduce the textbook's dialogues, story text, character names, or
specific example sentences.

---

## 4. Copyright — where special care is needed

The repo rule is "reference, don't reproduce": build original content testing
the same skills/facts/structure, never the textbook's actual passages,
problems, diagrams, or exact wording. Risk is not uniform across subjects:

- **Lowest risk (build freely from structure/fact):** all 算数 (sansu1/2),
  and the **kanji + kana + grammar** halves of every kokugo module. These are
  official closed systems — the MEXT 学年別漢字配当表, the かな writing system,
  and rule-based grammar. There is no "passage" to reproduce. This is exactly
  why the kokugo5/6 specs shipped kanji+grammar first and deferred reading.

- **Highest risk — 国語 reading-comprehension units (all grades).** These lean
  on *specific literary and informational texts* chosen by 光村図書
  (e.g. the named units kokugo3 built: ちいちゃんのかげおくり, すがたをかえる
  大豆, モチモチの木). Two distinct hazards:
  1. **Publisher mismatch:** Hakui is 光村図書, not Tokyo Shoseki. The kokugo5
     spec records a real caught error where research pulled the wrong
     publisher's unit list. Any reading-unit research MUST be sourced from
     Mitsumura's own materials (teacher-resource site / 単元一覧表), never
     another publisher's line.
  2. **Text reproduction:** never reproduce the passage text, specific
     comprehension questions, or exact wording — build original comprehension
     items testing the same structure/skills, the way kokugo3 did per unit.
     Seeing the copyrighted text during research does not make it safe to use.
  For this reason every kokugo sketch above **defers reading units** and ships
  kanji/kana/grammar only, matching kokugo5/6. Reading units are a separate,
  slower, properly-sourced pass — one research effort per unit.

- **Elevated risk — 外国語 (eigo5) reading/dialogue.** New Horizon 5's
  dialogues, storylines, character names, and example sentences are
  copyrighted. Build original vocabulary/sentence-pattern drills over the same
  target language; do not reproduce the textbook's conversations or passages.

- **Moderate/none — 理科 / 社会:** already fully built; underlying science and
  official social-studies facts are universal and independently documented.
  The existing rika/shakai specs already handle this correctly.

---

## 5. Cross-cutting build reminders (apply to every module above)

- **Reporting:** always `HubCommon.reportActivityWithItems(sb, {schoolId,
  classId, moduleId, userId, activityRef, score, maxScore, payload, items})`.
  Do NOT hand-roll the `activity_results` insert (five modules already do and
  lost their per-question analysis — don't add a sixth).
- **Context:** resolve student school/class via `enrollments →
  classes.school_id`; never read/backfill `profiles.home_school_id`.
- **style.css:** self-contained token copy (rule 1 tokens), never link root
  `style.css`; Zen Maru Gothic for display text.
- **Migration:** idempotent, absolute `launch_url`, explicit `is_active=true`,
  subject from the CHECK set, `recommended_grades int[]`. Apply via MCP
  `apply_migration` (writes the prod ledger) AND commit the matching
  `supabase/migrations/<ts>_<name>.sql` in the same PR. Never
  `execute_sql`/dashboard.
- **units.js:** if the module is unit-scoped, ship `modules/<key>/units.js`
  self-registering `window.MODULE_UNITS.<key>` with keys that exactly match its
  internal unit keys (the assignment UIs cannot load a module's generators, so
  this is the contract). There is NO shared registry — never edit a common file
  (#94). A module with no `units.js` simply offers no unit picker (harmless;
  focus_units = null = all units).
- **Testing bar:** stress-test generators at hundreds–thousands of instances
  for structural bugs AND distractor collisions; run a real headless flow test
  asserting `reportActivityWithItems` was called and `activity_result_items`
  got populated; verify migration idempotency + correct
  is_active/subject/launch_url.
- **focus_units reality check:** no `class_modules` row has `focus_units`
  populated yet — build and test the null ("all units") path for real.
