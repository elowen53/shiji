-- 单人应用：只允许指定账号的有效登录会话访问数据。
-- 必须由数据库管理员执行；可重复执行，不修改已有饮食记录。
begin;

create or replace function public.shiji_has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join auth.sessions s on s.user_id = u.id
    where u.id = (select auth.uid())
      and u.email = 'owner@shiji.local'
      and s.id::text = ((select auth.jwt()) ->> 'session_id')
  );
$$;

revoke all on function public.shiji_has_access() from public, anon;
grant execute on function public.shiji_has_access() to authenticated;

do $$
declare
  table_name text;
  old_policy record;
begin
  foreach table_name in array array['foods', 'entries', 'daily_metrics', 'macro_targets'] loop
    execute format('alter table public.%I enable row level security', table_name);
    -- 旧的 permissive 策略会与新策略 OR，必须清除才能保证只限专用账号。
    for old_policy in select policyname from pg_policies where schemaname = 'public' and tablename = table_name loop
      execute format('drop policy %I on public.%I', old_policy.policyname, table_name);
    end loop;
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select public.shiji_has_access()))', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select public.shiji_has_access()))', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select public.shiji_has_access())) with check ((select public.shiji_has_access()))', table_name);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select public.shiji_has_access()))', table_name);
  end loop;
end;
$$;

commit;
