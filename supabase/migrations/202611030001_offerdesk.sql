create extension if not exists pgcrypto;

create table public.imports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  input_type text not null check(input_type in ('text','images')), raw_text text not null default '',
  state text not null default 'uploaded' check(state in ('uploaded','processing','ready','failed','saved')),
  extracted jsonb, error text, attempt_id uuid, locked_until timestamptz,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days', unique(id,user_id)
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid unique, company text not null check(length(trim(company)) between 1 and 200), title text not null check(length(trim(title)) between 1 and 200),
  city text, salary text, education text, graduation_year text, internship_duration text, days_per_week text, job_type text,
  required jsonb not null default '[]', preferred jsonb not null default '[]', availability jsonb not null default '[]', tags jsonb not null default '[]',
  source_url text, search_text text generated always as (company || ' ' || title || ' ' || tags::text) stored,
  status text not null default '待投递' check(status in ('待投递','已投递','笔试','面试','已结束')),
  applied_at date, notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(import_id,user_id) references public.imports(id,user_id)
);
create index jobs_owner_updated on public.jobs(user_id,updated_at desc);
create table public.attachments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid not null, path text not null unique, name text not null, mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
  size integer not null check(size>0 and size<=5242880), position integer not null check(position between 0 and 4),
  unique(import_id,position), foreign key(import_id,user_id) references public.imports(id,user_id) on delete cascade
);
create table public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade, day date not null, calls integer not null default 0,
  primary key(user_id,day)
);
alter table public.imports enable row level security;
alter table public.jobs enable row level security;
alter table public.attachments enable row level security;
alter table public.usage_daily enable row level security;
grant select,insert,update,delete on public.imports,public.jobs,public.attachments to authenticated;
revoke all on public.usage_daily from anon,authenticated;
grant select on public.usage_daily to authenticated;
create policy owner_imports on public.imports for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_jobs on public.jobs for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_attachments on public.attachments for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy read_own_usage on public.usage_daily for select to authenticated using ((select auth.uid())=user_id);

create function public.touch_job() returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at=now();
  if old.applied_at is null and new.applied_at is null and new.status<>'待投递' then new.applied_at=(now() at time zone 'Asia/Shanghai')::date; end if;
  return new;
end; $$;
create trigger touch_job before update on public.jobs for each row execute function public.touch_job();

-- Serialize each user's claim and quota update. Only this RPC may write usage_daily.
create function public.begin_extraction(target uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); item public.imports; token uuid:=gen_random_uuid(); used integer; today date:=(now() at time zone 'Asia/Shanghai')::date;
begin
  if actor is null then raise exception 'UNAUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select * into item from public.imports where id=target and user_id=actor for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if item.state='saved' or exists(select 1 from public.jobs where import_id=target) then raise exception 'ALREADY_SAVED'; end if;
  if exists(select 1 from public.imports where user_id=actor and state='processing' and locked_until>now()) then raise exception 'BUSY'; end if;
  insert into public.usage_daily(user_id,day,calls) values(actor,today,0) on conflict do nothing;
  select calls into used from public.usage_daily where user_id=actor and day=today for update;
  if used>=20 then raise exception 'QUOTA'; end if;
  update public.usage_daily set calls=calls+1 where user_id=actor and day=today;
  update public.imports set state='processing', attempt_id=token, locked_until=now()+interval '90 seconds', expires_at=now()+interval '7 days', error=null where id=target;
  return token;
end; $$;
revoke all on function public.begin_extraction(uuid) from public, anon;
grant execute on function public.begin_extraction(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('screenshots','screenshots',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Uploads are issued by the server with signed single-path upload tokens.
-- No client INSERT policy: clients cannot overwrite validated screenshots.
create policy read_owned_screenshots on storage.objects for select to authenticated using(bucket_id='screenshots' and (storage.foldername(name))[1]=(select auth.uid())::text);
