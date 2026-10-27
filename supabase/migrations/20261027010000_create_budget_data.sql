create type public.category_type as enum ('income', 'expense');
create type public.commitment_frequency as enum ('once', 'weekly', 'monthly', 'yearly');
create type public.commitment_status as enum ('active', 'paused', 'completed');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color text not null default '#4a7462' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  type public.category_type not null,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null check (char_length(trim(description)) between 1 and 200),
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null check (char_length(trim(description)) between 1 and 200),
  due_date date not null,
  frequency public.commitment_frequency not null default 'once',
  status public.commitment_status not null default 'active',
  created_at timestamptz not null default now()
);

create index categories_user_id_idx on public.categories (user_id);
create index transactions_user_occurred_at_idx on public.transactions (user_id, occurred_at desc);
create index commitments_user_due_date_idx on public.commitments (user_id, due_date);

create function public.ensure_category_belongs_to_user()
returns trigger
language plpgsql
security definer set search_path = ''
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

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.commitments enable row level security;

create policy "Users manage their own categories" on public.categories
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own transactions" on public.transactions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own commitments" on public.commitments
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);