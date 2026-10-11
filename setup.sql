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

-- 默认拒绝浏览器访问；建表后继续执行 supabase/migrations/20261011_private_access.sql。
alter table foods enable row level security;
alter table entries enable row level security;

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

alter table daily_metrics enable row level security;

-- 三大营养素目标：单行表，按「每公斤体重克数」存储，空值表示未设置该项目标
-- 每日目标 = 系数 × 截至当天最近一次体重
create table if not exists macro_targets (
  id int primary key default 1 check (id = 1),
  protein_g_per_kg numeric,
  fat_g_per_kg numeric,
  carbs_g_per_kg numeric,
  updated_at timestamptz not null default now()
);

alter table macro_targets enable row level security;
