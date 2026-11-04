-- Run in a disposable/staging Supabase SQL editor after all migrations, in order.
-- Fixtures and changes are rolled back; a failed assertion aborts the test.
begin;

-- Existing saved jobs must have been repaired by the incremental migration.
do $$
begin
  if exists (
    select 1 from public.imports as source
    join public.jobs as job on job.import_id = source.id and job.user_id = source.user_id
    where source.state <> 'saved' or source.expires_at is not null
  ) then
    raise exception 'FAIL: existing saved imports were not repaired';
  end if;
end; $$;

insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000000003','offerdesk-expiry@example.invalid');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);

do $$
declare
  actor uuid := '10000000-0000-4000-8000-000000000003';
  draft uuid;
  expired uuid;
  deadline timestamptz;
  saved_state text;
begin
  insert into public.imports(user_id,input_type,raw_text)
    values(actor,'text','expiry regression fixture') returning id,expires_at into draft,deadline;
  if deadline is distinct from now() + interval '7 days' then
    raise exception 'FAIL: new imports must still expire after seven days';
  end if;

  insert into public.imports(user_id,input_type,expires_at)
    values(actor,'text',now() - interval '1 day') returning id into expired;
  insert into public.jobs(user_id,import_id,company,title)
    values(actor,draft,'到期回归测试','测试岗位');

  -- Same update used by the job-save API; rejected by the original schema.
  update public.imports set state='saved',expires_at=null where id=draft;
  select state,expires_at into saved_state,deadline from public.imports where id=draft;
  if saved_state is distinct from 'saved' or deadline is not null then
    raise exception 'FAIL: saved imports cannot be retained indefinitely';
  end if;
  if exists(select 1 from public.imports where id=draft and expires_at < now()) then
    raise exception 'FAIL: saved imports enter the cleanup queue';
  end if;
  if not exists(select 1 from public.imports where id=expired and expires_at < now()) then
    raise exception 'FAIL: expired unsaved imports do not enter the cleanup queue';
  end if;

  -- Cleanup also clears the deadline when it finds an associated job.
  update public.imports set expires_at=now() - interval '1 day' where id=draft;
  update public.imports set expires_at=null where id=draft;
  if exists(select 1 from public.imports where id=draft and expires_at < now()) then
    raise exception 'FAIL: cleanup cannot retain an import associated with a job';
  end if;

  -- A deleted job's import may receive an expiry timestamp again.
  delete from public.jobs where import_id=draft;
  update public.imports set state='failed',expires_at=now() - interval '1 second' where id=draft;
  if not exists(select 1 from public.imports where id=draft and expires_at < now()) then
    raise exception 'FAIL: deleted jobs cannot schedule import cleanup';
  end if;

  raise notice 'PASS: default expiry, saved retention, cleanup retention and deleted-job expiry';
end; $$;

rollback;
