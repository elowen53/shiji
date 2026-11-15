-- 同一天、同一食物、同一单位累加保存；临时食物（food_id 为空）保持独立。
-- 不批量重写历史数据；再次添加时收拢该组已有重复行，并保留营养快照总量。
begin;

create or replace function public.add_food_entry(
  p_entry_date date,
  p_food_id uuid,
  p_food_name text,
  p_unit text,
  p_quantity numeric,
  p_kcal numeric,
  p_protein numeric,
  p_fat numeric,
  p_carbs numeric
)
returns setof public.entries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.entries;
  saved public.entries;
  total_quantity numeric := p_quantity;
  total_kcal numeric := p_kcal;
  total_protein numeric := p_protein;
  total_fat numeric := p_fat;
  total_carbs numeric := p_carbs;
begin
  if not public.shiji_has_access() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0
    or p_quantity::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Quantity must be positive and finite' using errcode = '22023';
  end if;

  if p_food_id is not null then
    -- 即使首条记录还不存在，也能串行化同组新增；事务结束时自动释放。
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'shiji:entry:' || p_entry_date::text || ':' || p_food_id::text || ':' || p_unit, 0
    ));

    for existing in
      select e.* from public.entries e
      where e.entry_date = p_entry_date and e.food_id = p_food_id and e.unit = p_unit
      order by e.created_at, e.id
      for update
    loop
      total_quantity := total_quantity + existing.quantity;
      total_kcal := total_kcal + existing.kcal;
      total_protein := total_protein + existing.protein;
      total_fat := total_fat + existing.fat;
      total_carbs := total_carbs + existing.carbs;
      if saved.id is null then
        saved := existing;
      else
        delete from public.entries where id = existing.id;
      end if;
    end loop;
  end if;

  if saved.id is null then
    insert into public.entries(entry_date, food_id, food_name, unit, quantity, kcal, protein, fat, carbs)
    values (p_entry_date, p_food_id, p_food_name, p_unit, total_quantity,
      total_kcal, total_protein, total_fat, total_carbs)
    returning * into saved;
  else
    -- 保留最早的 id、名称与时间；旧营养不从当前食物库重新折算。
    update public.entries set quantity = total_quantity, kcal = total_kcal,
      protein = total_protein, fat = total_fat, carbs = total_carbs
    where id = saved.id
    returning * into saved;
  end if;
  return next saved;
end;
$$;

revoke all on function public.add_food_entry(date, uuid, text, text, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.add_food_entry(date, uuid, text, text, numeric, numeric, numeric, numeric, numeric) to authenticated;

commit;
