create type public.transaction_direction as enum ('income', 'expense');
create type public.transaction_review_status as enum ('confirmed', 'needs_review', 'ignored');

alter table public.transactions
  add column if not exists direction public.transaction_direction not null default 'expense',
  add column if not exists review_status public.transaction_review_status not null default 'confirmed',
  add column if not exists source text not null default 'manual' check (source in ('manual', 'import', 'assistant')),
  add column if not exists merchant_name text;

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  target_amount numeric(12, 2) not null check (target_amount > 0),
  target_date date,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.goal_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  allocated_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pattern text not null check (char_length(trim(pattern)) between 1 and 120),
  category_id uuid references public.categories(id) on delete set null,
  direction public.transaction_direction not null default 'expense',
  created_at timestamptz not null default now(),
  unique (user_id, pattern, direction)
);

create index if not exists transactions_user_review_idx on public.transactions (user_id, review_status, occurred_at desc);
create index if not exists savings_goals_user_idx on public.savings_goals (user_id);
create index if not exists goal_allocations_goal_idx on public.goal_allocations (goal_id, allocated_at desc);
create index if not exists merchant_rules_user_idx on public.merchant_rules (user_id);

insert into public.categories (user_id, name, type, color, icon)
select profiles.id, income_category.name, 'income', income_category.color, 'banknote'
from public.profiles
cross join (
  values
    ('Salaire', '#2f855a'),
    ('Prime', '#3b82f6'),
    ('Don', '#a855f7'),
    ('Remboursement', '#0f766e'),
    ('Vente', '#d97706'),
    ('Autre revenu', '#64748b')
) as income_category(name, color)
on conflict (user_id, name, type) do nothing;

grant select, insert, update, delete on public.savings_goals, public.goal_allocations, public.merchant_rules to authenticated;

alter table public.savings_goals enable row level security;
alter table public.goal_allocations enable row level security;
alter table public.merchant_rules enable row level security;

create policy savings_goals_owner on public.savings_goals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_allocations_owner on public.goal_allocations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy merchant_rules_owner on public.merchant_rules for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);