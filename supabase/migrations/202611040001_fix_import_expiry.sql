-- Saved imports are retained indefinitely; only unsaved/deleted imports expire.
-- Keep the seven-day default for newly created imports.
alter table public.imports alter column expires_at drop not null;

comment on column public.imports.expires_at is
  'NULL retains a saved import indefinitely; a timestamp schedules cleanup.';

-- Repair imports whose post-save update failed under the old NOT NULL constraint.
update public.imports as source
set state = 'saved', expires_at = null
where exists (
  select 1 from public.jobs as job
  where job.import_id = source.id and job.user_id = source.user_id
)
and (source.state <> 'saved' or source.expires_at is not null);
