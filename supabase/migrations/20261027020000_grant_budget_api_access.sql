grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.commitments to authenticated;