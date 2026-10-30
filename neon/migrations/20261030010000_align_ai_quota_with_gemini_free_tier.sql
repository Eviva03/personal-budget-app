create or replace function public.consume_ai_import_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_period date := current_date;
  next_count integer;
  next_cost numeric(6, 3);
  current_user_id uuid := auth.user_id();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.ai_import_global_usage (period_start, estimated_cost_eur)
  values (current_period, 0.010)
  on conflict (period_start) do update
    set estimated_cost_eur = public.ai_import_global_usage.estimated_cost_eur + 0.010
    where public.ai_import_global_usage.estimated_cost_eur + 0.010 <= 0.200
  returning estimated_cost_eur into next_cost;

  if next_cost is null then
    return jsonb_build_object('allowed', false, 'reason', 'global_limit');
  end if;

  insert into public.ai_import_usage (user_id, period_start, request_count)
  values (current_user_id, current_period, 1)
  on conflict (user_id, period_start) do update
    set request_count = public.ai_import_usage.request_count + 1
    where public.ai_import_usage.request_count < 20
  returning request_count into next_count;

  if next_count is null then
    update public.ai_import_global_usage
    set estimated_cost_eur = estimated_cost_eur - 0.010
    where period_start = current_period;
    return jsonb_build_object('allowed', false, 'reason', 'user_limit');
  end if;

  return jsonb_build_object('allowed', true, 'estimated_cost_eur', next_cost);
end;
$$;