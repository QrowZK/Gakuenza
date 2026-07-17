-- Nullable free-text publisher/textbook-series attribution for catalog cards (#81).
alter table public.modules add column if not exists publisher text;
comment on column public.modules.publisher is
  'Textbook series / publisher a module aligns to, for admin display. Free text, nullable.';

-- One-time idempotent backfill from MODULE_ROADMAP.md §publisher-facts.
-- Any module not listed stays null (renders with no badge on the catalog card).
update public.modules set publisher = case key
  when 'sansu3' then '東京書籍'  when 'sansu4' then '東京書籍'
  when 'sansu5' then '東京書籍'  when 'sansu6' then '東京書籍'
  when 'rika3'  then '東京書籍'  when 'rika4'  then '東京書籍'
  when 'rika5'  then '東京書籍'  when 'rika6'  then '東京書籍'
  when 'shakai3' then '東京書籍' when 'shakai4' then '東京書籍'
  when 'shakai5' then '東京書籍' when 'shakai6' then '東京書籍'
  when 'kokugo3' then '光村図書' when 'kokugo5' then '光村図書'
  when 'kokugo6' then '光村図書'
  when 'nh6' then '東京書籍（New Horizon Elementary）'
  when 'nhvocab' then '東京書籍（New Horizon）'
  when 'letstry1' then '文部科学省（Let''s Try!）'
  when 'letstry2' then '文部科学省（Let''s Try!）'
  when 'kanken3' then '日本漢字能力検定協会' when 'kanken4' then '日本漢字能力検定協会'
  when 'kanken5' then '日本漢字能力検定協会'
  when 'eiken' then '日本英語検定協会'
  else publisher
end
where key in ('sansu3','sansu4','sansu5','sansu6','rika3','rika4','rika5','rika6',
  'shakai3','shakai4','shakai5','shakai6','kokugo3','kokugo5','kokugo6',
  'nh6','nhvocab','letstry1','letstry2','kanken3','kanken4','kanken5','eiken');
