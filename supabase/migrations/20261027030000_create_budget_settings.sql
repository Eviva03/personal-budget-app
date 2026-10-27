create table public.budget_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_income numeric(12, 2) not null default 0 check (monthly_income >= 0),
  reserve_amount numeric(12, 2) not null default 0 check (reserve_amount >= 0),
  updated_at timestamptz not null default now()
);

alter table public.budget_settings enable row level security;

create policy "Users manage their own budget settings" on public.budget_settings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.budget_settings to authenticated;