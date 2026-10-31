create or replace function public.prevent_budget_currency_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.budget_currency is distinct from new.budget_currency then
    raise exception 'La devise d origine ne peut pas etre modifiee une fois le budget configure.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_budget_currency_change on public.budget_settings;

create trigger prevent_budget_currency_change
  before update of budget_currency on public.budget_settings
  for each row execute function public.prevent_budget_currency_change();