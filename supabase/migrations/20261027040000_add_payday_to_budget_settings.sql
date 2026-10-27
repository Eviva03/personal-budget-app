alter table public.budget_settings
  add column payday_day smallint not null default 1 check (payday_day between 1 and 28);