alter table public.commitments
  add column installment_count integer check (installment_count is null or installment_count >= 2);