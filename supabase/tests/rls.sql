-- Run only in a disposable/staging Supabase SQL editor after the migration.
-- Every fixture and quota change is rolled back. Any failed assertion aborts.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','offerdesk-rls-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','offerdesk-rls-b@example.invalid');
insert into public.imports(id,user_id,input_type,raw_text) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','text','Java 本科'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','text','Python 本科');
insert into public.jobs(user_id,import_id,company,title) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','测试A','Java'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','测试B','Python');
insert into public.attachments(user_id,import_id,path,name,mime,size,position) values
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002/test','test.png','image/png',100,0);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare n integer; target uuid; token uuid; i integer;
begin
  select count(*) into n from public.jobs where company='测试B';
  if n<>0 then raise exception 'FAIL: cross-user read'; end if;
  update public.jobs set notes='forged' where company='测试B'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL: cross-user update'; end if;
  delete from public.jobs where company='测试B'; get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL: cross-user delete'; end if;
  select count(*) into n from public.attachments where import_id='20000000-0000-4000-8000-000000000002';
  if n<>0 then raise exception 'FAIL: cross-user attachment'; end if;
  begin
    insert into public.jobs(user_id,company,title) values('10000000-0000-4000-8000-000000000002','forged','forged');
    raise exception 'FAIL: forged owner accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.jobs(user_id,import_id,company,title) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','forged','forged');
    raise exception 'FAIL: foreign import accepted';
  exception when foreign_key_violation then null; end;
  begin
    perform public.begin_extraction('20000000-0000-4000-8000-000000000002');
    raise exception 'FAIL: extraction of foreign import accepted';
  exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise; end if; end;
  for i in 1..20 loop
    insert into public.imports(user_id,input_type,raw_text) values('10000000-0000-4000-8000-000000000001','text','test') returning id into target;
    token=public.begin_extraction(target);
    if token is null then raise exception 'FAIL: missing attempt token'; end if;
    if i=1 then
      begin
        perform public.begin_extraction(target);
        raise exception 'FAIL: parallel claim accepted';
      exception when raise_exception then if sqlerrm<>'BUSY' then raise; end if; end;
    end if;
    update public.imports set state='ready',locked_until=null where id=target;
  end loop;
  begin
    perform public.begin_extraction(target);
    raise exception 'FAIL: daily quota bypass';
  exception when raise_exception then if sqlerrm<>'QUOTA' then raise; end if; end;
  select calls into n from public.usage_daily where user_id='10000000-0000-4000-8000-000000000001';
  if n<>20 then raise exception 'FAIL: quota accounting'; end if;
  begin
    update public.usage_daily set calls=0;
    raise exception 'FAIL: client can reset quota';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: owner isolation, foreign keys, claim lock and daily quota';
end; $$;
rollback;
