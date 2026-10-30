alter table public.budget_settings
  add column if not exists budget_currency text not null default 'EUR'
    check (budget_currency in ('EUR', 'XAF')),
  add column if not exists display_currency text not null default 'EUR'
    check (display_currency in ('EUR', 'XAF'));