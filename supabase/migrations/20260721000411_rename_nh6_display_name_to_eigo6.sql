-- Align the grade-6 English module's catalog display name with eigo5
-- (外国語 5年 / 外国語 6年) so the hub reads as a consistent 5年/6年 pair.
-- Display-name ONLY: the module key ('nh6'), launch_url, and directory are
-- intentionally unchanged here — a full rekey (nh6 -> eigo6) is roadmapped
-- as low priority. name_en ("New Horizons 6") already pairs with eigo5's
-- "New Horizons 5" and is left as-is. Idempotent: safe to re-run.
update public.modules
set name = '外国語 6年'
where key = 'nh6';
