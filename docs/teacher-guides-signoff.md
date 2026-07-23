# Teacher-guide curriculum sign-off tracker

Every teacher guide in `gakuenza.com/hub/guides/*.md` includes a
standards-alignment section (学習指導要領 / 検定 との対応). **Those sections
are currently marked めやす・要確認** — they are our good-faith estimate of
where each module sits against the national curriculum, written from public
MEXT 学習指導要領 structure, and have **not** yet been confirmed by a
licensed classroom teacher.

This file tracks that confirmation. It is not a blocker for using the
guides (the 概要 / 単元一覧 / 使い方 sections stand on their own) — it's the
one thing to have a real educator eyeball before the alignment claims are
treated as authoritative.

**What sign-off means:** an educator reads the "学習指導要領との対応"
(and 検定対応, where present) section and confirms the grade, strand/領域,
and unit mapping are right — then the めやす・要確認 hedge on that section can
be dropped for that guide.

Status legend: ☐ pending · ☑ confirmed.

---

## All 29 need MEXT 学習指導要領 sign-off

Grouped by subject. Each guide lives at `hub/guides/<key>.md`.

### 国語 (kokugo) — grades 1–6
- ☐ kokugo1 · ☐ kokugo2 · ☐ kokugo3 · ☐ kokugo4 · ☐ kokugo5 · ☐ kokugo6

### 算数 (sansu) — grades 1–6
- ☐ sansu1 · ☐ sansu2 · ☐ sansu3 · ☐ sansu4 · ☐ sansu5 · ☐ sansu6

### 理科 (rika) — grades 3–6
- ☐ rika3 · ☐ rika4 · ☐ rika5 · ☐ rika6

### 社会 (shakai) — grades 3–6
- ☐ shakai3 · ☐ shakai4 · ☐ shakai5 · ☐ shakai6
- **Extra care — shakai5:** its territory questions (竹島・尖閣諸島 etc.)
  use MEXT-textbook framing deliberately ("MEXT standard is our standard").
  Worth an explicit educator nod that the framing matches what the school
  teaches, not just the unit mapping.

### 外国語 / 英語 (English)
- ☐ eigo5 · ☐ nh6 · ☐ nhvocab · ☐ letstry1 · ☐ letstry2

---

## Four also need 検定 (certification) sign-off

These map to a private certification standard **in addition to** MEXT, so
they carry a second alignment claim to confirm:

- ☐ kanken3 — 漢字検定 (＋学習指導要領 学年別漢字配当表)
- ☐ kanken4 — 漢字検定
- ☐ kanken5 — 漢字検定
- ☐ eiken — 英検 (実用英語技能検定)

The 検定 mappings are level→grade approximations; a teacher familiar with
漢検/英検 levels should confirm the level each module targets is stated
correctly.

---

## How to clear an item

1. Educator reviews the guide's alignment section in `hub/guides/<key>.md`.
2. If correct, edit that guide to drop the めやす・要確認 qualifier on the
   confirmed section (leave it on any part still uncertain).
3. Tick the box here (☐ → ☑) and note who confirmed + the date.

Guides are static Markdown deployed with the site (they render in
`hub/guides.html`), so a fix is just an edit + merge to `main`.
