create type public.import_journal_status as enum ('proposed', 'imported', 'partial', 'failed', 'dismissed');

create table public.import_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  document_type text not null check (document_type in ('csv', 'pdf', 'image', 'receipt', 'invoice', 'bank_statement', 'unknown')),
  source text not null check (source in ('local', 'assistant')),
  status public.import_journal_status not null default 'proposed',
  detected_count integer not null default 0 check (detected_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index import_journal_user_created_idx on public.import_journal (user_id, created_at desc);

grant select, insert, update, delete on public.import_journal to authenticated;

alter table public.import_journal enable row level security;

create policy import_journal_owner on public.import_journal for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);