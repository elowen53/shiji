-- 放纵日：聚餐、社交等没法记录热量的日子。
-- 保存估算的热量盈余（千卡，相对当天总消耗）；空值表示普通日。
-- 这天的热量收支直接取该估算值，当天已记录的食物不参与收支与蛋白质达标统计。
-- 幂等，可重复执行；沿用 daily_metrics 现有的 RLS 策略与表级授权，无需额外授权。
alter table public.daily_metrics add column if not exists cheat_surplus_kcal numeric
  check (cheat_surplus_kcal > 0);

-- 让 PostgREST 立即识别新列
notify pgrst, 'reload schema';
