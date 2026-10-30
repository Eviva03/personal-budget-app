create type public.category_type as enum ('income', 'expense');
create type public.commitment_frequency as enum ('once', 'weekly', 'monthly', 'yearly');
create type public.commitment_status as enum ('active', 'paused', 'completed');

create table public.legacy_accounts (
  legacy_user_id uuid primary key,
  email text not null unique,
  claimed_user_id uuid unique references neon_auth."user"(id) on delete set null,
  claimed_at timestamptz
);

create table public.profiles (
  id uuid primary key,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_settings (
  user_id uuid primary key,
  monthly_income numeric(12, 2) not null default 0 check (monthly_income >= 0),
  reserve_amount numeric(12, 2) not null default 0 check (reserve_amount >= 0),
  updated_at timestamptz not null default now(),
  payday_day smallint not null default 1 check (payday_day between 1 and 28),
  budget_currency text not null default 'EUR' check (budget_currency in ('EUR', 'XAF')),
  display_currency text not null default 'EUR' check (display_currency in ('EUR', 'XAF'))
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color text not null default '#4a7462' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  type public.category_type not null,
  created_at timestamptz not null default now(),
  icon text not null default 'tag' check (icon in ('banknote', 'bus', 'credit-card', 'dumbbell', 'house', 'shopping-bag', 'smartphone', 'tag', 'utensils')),
  unique (user_id, name, type)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null check (char_length(trim(description)) between 1 and 200),
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null check (char_length(trim(description)) between 1 and 200),
  due_date date not null,
  frequency public.commitment_frequency not null default 'once',
  status public.commitment_status not null default 'active',
  created_at timestamptz not null default now(),
  installment_count integer check (installment_count is null or installment_count >= 2)
);

create table public.ai_import_usage (
  user_id uuid not null,
  period_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, period_start)
);

create table public.ai_import_global_usage (
  period_start date primary key,
  estimated_cost_eur numeric(6, 3) not null default 0 check (estimated_cost_eur >= 0)
);

create index categories_user_id_idx on public.categories (user_id);
create index transactions_user_occurred_at_idx on public.transactions (user_id, occurred_at desc);
create index commitments_user_due_date_idx on public.commitments (user_id, due_date);

create function public.ensure_category_belongs_to_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories
    where id = new.category_id and user_id = new.user_id
  ) then
    raise exception 'Category must belong to the same user';
  end if;
  return new;
end;
$$;

create trigger ensure_transaction_category_owner
  before insert or update on public.transactions
  for each row execute procedure public.ensure_category_belongs_to_user();

create trigger ensure_commitment_category_owner
  before insert or update on public.commitments
  for each row execute procedure public.ensure_category_belongs_to_user();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.name, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_neon_auth_user_created
  after insert on neon_auth."user"
  for each row execute procedure public.handle_new_user();

create function public.claim_legacy_budget()
returns boolean
language plpgsql
security definer
set search_path = public, neon_auth
as $$
declare
  current_user_id uuid := auth.user_id();
  current_email text;
  source_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select email into current_email
  from neon_auth."user"
  where id = current_user_id;

  select legacy_user_id into source_user_id
  from public.legacy_accounts
  where lower(email) = lower(current_email)
    and claimed_user_id is null
  for update;

  if source_user_id is null then
    return false;
  end if;

  delete from public.profiles where id = current_user_id;
  update public.profiles set id = current_user_id, updated_at = now() where id = source_user_id;
  update public.budget_settings set user_id = current_user_id where user_id = source_user_id;
  update public.categories set user_id = current_user_id where user_id = source_user_id;
  update public.transactions set user_id = current_user_id where user_id = source_user_id;
  update public.commitments set user_id = current_user_id where user_id = source_user_id;
  update public.ai_import_usage set user_id = current_user_id where user_id = source_user_id;
  update public.legacy_accounts set claimed_user_id = current_user_id, claimed_at = now() where legacy_user_id = source_user_id;
  return true;
end;
$$;

create function public.consume_ai_import_quota()
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

revoke all on function public.ensure_category_belongs_to_user() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.claim_legacy_budget() from public;
revoke all on function public.consume_ai_import_quota() from public;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.budget_settings, public.categories, public.transactions, public.commitments, public.ai_import_usage to authenticated;
grant execute on function public.claim_legacy_budget() to authenticated;
grant execute on function public.consume_ai_import_quota() to authenticated;

alter table public.profiles enable row level security;
alter table public.budget_settings enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.commitments enable row level security;
alter table public.ai_import_usage enable row level security;
alter table public.ai_import_global_usage enable row level security;

create policy profiles_owner on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy budget_settings_owner on public.budget_settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy categories_owner on public.categories for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transactions_owner on public.transactions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy commitments_owner on public.commitments for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ai_import_usage_owner on public.ai_import_usage for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);