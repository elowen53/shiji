-- ============================================================
-- 「食记」Supabase 建表脚本
-- 使用方法：在 Supabase 控制台 → SQL Editor 中整段执行
-- ============================================================

-- 食物库表：营养值为「每单位」含量，单位名称完全自定义（如 100g / 1份 / 1碗）
create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  fat numeric not null default 0,
  carbs numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 每日记录表（营养值为按数量折算后的快照，删除食物不影响历史记录）
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  food_id uuid references foods(id) on delete set null,
  food_name text not null,
  unit text not null,
  quantity numeric not null default 1,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  fat numeric not null default 0,
  carbs numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 单人使用：关闭行级安全（anon key 即访问凭证，请勿泄露）
alter table foods disable row level security;
alter table entries disable row level security;

create index if not exists entries_entry_date_idx on entries(entry_date);

-- 每日指标表：一天一行，记录体重、腰围与总消耗（均可空）
create table if not exists daily_metrics (
  entry_date date primary key,
  weight_kg numeric,
  waist_cm numeric,
  burn_kcal numeric,
  updated_at timestamptz not null default now()
);

-- 旧环境升级用（幂等）：已存在 daily_metrics 但缺少 waist_cm 列时执行补齐
alter table daily_metrics add column if not exists waist_cm numeric;

-- 单人使用：关闭行级安全（anon key 即访问凭证，请勿泄露）
alter table daily_metrics disable row level security;
