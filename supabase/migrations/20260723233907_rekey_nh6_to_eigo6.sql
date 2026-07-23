-- Roadmap debt #8: rekey the grade-6 English module nh6 -> eigo6 so the
-- 外国語 5/6 pair (eigo5/eigo6) is consistent internally.
--
-- Applied live 2026-07-23 (ledger version 20260723233907) AFTER the frontend
-- directory rename (modules/nh6 -> modules/eigo6, eigo6-report.js querying
-- key='eigo6') was deployed and confirmed live at
-- https://gakuenza.com/modules/eigo6/index.html. A redirect stub remains at
-- /modules/nh6/index.html -> /modules/eigo6/index.html so neither ordering of
-- (deploy, this migration) could 404 the hub tile.
--
-- module_id is unchanged, so the class_modules assignments (2 at apply time)
-- and any activity_results (0 at apply time) stay linked. Idempotent: a second
-- run matches no rows.
update public.modules
set key = 'eigo6', launch_url = '/modules/eigo6/index.html'
where key = 'nh6';
