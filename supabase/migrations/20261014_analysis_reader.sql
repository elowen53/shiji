-- AI analysis uses a direct PostgreSQL role, never anon/authenticated/service_role.
-- NOLOGIN until an administrator provisions its password; no secret belongs here.
begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'shiji_analysis_reader') then
    create role shiji_analysis_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if exists (
    select 1 from pg_roles r where r.rolname = 'shiji_analysis_reader'
      and (r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb or r.rolinherit or r.rolreplication
        or exists (select 1 from pg_auth_members where member = r.oid))
  ) then
    raise exception 'shiji_analysis_reader must be a dedicated unprivileged NOINHERIT role';
  end if;
  execute format('grant connect on database %I to shiji_analysis_reader', current_database());
end;
$$;

grant usage on schema public to shiji_analysis_reader;
revoke create on schema public from shiji_analysis_reader;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['foods', 'entries', 'daily_metrics', 'macro_targets'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from shiji_analysis_reader', table_name);
    execute format('grant select on table public.%I to shiji_analysis_reader', table_name);
    execute format('drop policy if exists analysis_reader_select on public.%I', table_name);
    execute format('create policy analysis_reader_select on public.%I for select to shiji_analysis_reader using (true)', table_name);
  end loop;
end;
$$;

create index if not exists entries_analysis_cursor_idx on public.entries(entry_date, id);

alter role shiji_analysis_reader set default_transaction_read_only = on;
alter role shiji_analysis_reader set statement_timeout = '5s';

commit;
