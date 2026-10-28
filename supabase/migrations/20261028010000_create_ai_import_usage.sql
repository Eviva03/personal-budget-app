create table public.ai_import_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, period_start)
);

create table public.ai_import_global_usage (
  period_start date primary key,
  estimated_cost_eur numeric(6, 3) not null default 0 check (estimated_cost_eur >= 0)
);

alter table public.ai_import_usage enable row level security;
alter table public.ai_import_global_usage enable row level security;

create or replace function public.consume_ai_import_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_period date := date_trunc('month', current_date)::date;
  next_count integer;
  next_cost numeric(6, 3);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.ai_import_global_usage (period_start, estimated_cost_eur)
  values (current_period, 0.010)
  on conflict (period_start) do update
    set estimated_cost_eur = ai_import_global_usage.estimated_cost_eur + 0.010
    where ai_import_global_usage.estimated_cost_eur + 0.010 <= 5.000
  returning estimated_cost_eur into next_cost;

  if next_cost is null then
    return jsonb_build_object('allowed', false, 'reason', 'global_limit');
  end if;

  insert into public.ai_import_usage (user_id, period_start, request_count)
  values (auth.uid(), current_period, 1)
  on conflict (user_id, period_start) do update
    set request_count = ai_import_usage.request_count + 1
    where ai_import_usage.request_count < 20
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

revoke all on function public.consume_ai_import_quota() from public;
grant execute on function public.consume_ai_import_quota() to authenticated;