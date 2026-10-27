import { supabase } from '../../lib/supabase'
import type { BudgetSettings, Category, CategoryType, Commitment, NewCommitment, NewTransaction, Transaction } from './types'

function client() {
  if (!supabase) throw new Error('Supabase n est pas configure.')
  return supabase
}

export async function listCategories(userId: string) {
  const { data, error } = await client().from('categories').select('*').eq('user_id', userId).order('name')
  if (error) throw error
  return data as Category[]
}

export async function createCategory(userId: string, category: Pick<Category, 'name' | 'color' | 'type'>) {
  const { data, error } = await client().from('categories').insert({ ...category, user_id: userId }).select().single()
  if (error) throw error
  return data as Category
}

export async function updateCategory(userId: string, categoryId: string, changes: Partial<Pick<Category, 'name' | 'color' | 'type'>>) {
  const { data, error } = await client().from('categories').update(changes).eq('id', categoryId).eq('user_id', userId).select().single()
  if (error) throw error
  return data as Category
}

export async function deleteCategory(userId: string, categoryId: string) {
  const { error } = await client().from('categories').delete().eq('id', categoryId).eq('user_id', userId)
  if (error) throw error
}

export async function listTransactions(userId: string) {
  const { data, error } = await client().from('transactions').select('*').eq('user_id', userId).order('occurred_at', { ascending: false })
  if (error) throw error
  return data as Transaction[]
}

export async function createTransaction(userId: string, transaction: NewTransaction) {
  const { data, error } = await client().from('transactions').insert({ ...transaction, user_id: userId }).select().single()
  if (error) throw error
  return data as Transaction
}

export async function createTransactions(userId: string, transactions: NewTransaction[]) {
  if (transactions.length === 0) return []
  const { data, error } = await client().from('transactions').insert(transactions.map((transaction) => ({ ...transaction, user_id: userId }))).select()
  if (error) throw error
  return data as Transaction[]
}

export async function updateTransaction(userId: string, transactionId: string, changes: Partial<NewTransaction>) {
  const { data, error } = await client().from('transactions').update(changes).eq('id', transactionId).eq('user_id', userId).select().single()
  if (error) throw error
  return data as Transaction
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const { error } = await client().from('transactions').delete().eq('id', transactionId).eq('user_id', userId)
  if (error) throw error
}

export async function listCommitments(userId: string) {
  const { data, error } = await client().from('commitments').select('*').eq('user_id', userId).order('due_date')
  if (error) throw error
  return data as Commitment[]
}

export async function createCommitment(userId: string, commitment: NewCommitment) {
  const { data, error } = await client().from('commitments').insert({ ...commitment, user_id: userId }).select().single()
  if (error) throw error
  return data as Commitment
}

export async function updateCommitment(userId: string, commitmentId: string, changes: Partial<NewCommitment>) {
  const { data, error } = await client().from('commitments').update(changes).eq('id', commitmentId).eq('user_id', userId).select().single()
  if (error) throw error
  return data as Commitment
}

export async function deleteCommitment(userId: string, commitmentId: string) {
  const { error } = await client().from('commitments').delete().eq('id', commitmentId).eq('user_id', userId)
  if (error) throw error
}

export async function getBudgetSettings(userId: string) {
  const { data, error } = await client().from('budget_settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as BudgetSettings | null
}

export async function saveBudgetSettings(userId: string, settings: Pick<BudgetSettings, 'monthly_income' | 'reserve_amount' | 'payday_day'>) {
  const { data, error } = await client().from('budget_settings').upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data as BudgetSettings
}

export const categoryTypes: CategoryType[] = ['income', 'expense']