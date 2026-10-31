update public.transactions as transaction
set direction = 'income'
from public.categories as category
where transaction.category_id = category.id
  and transaction.user_id = category.user_id
  and category.type = 'income';