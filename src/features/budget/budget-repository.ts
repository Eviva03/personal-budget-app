import { neon } from '../../lib/neon'
import type { BudgetSettings, Category, CategoryType, Commitment, GoalAllocation, ImportJournalEntry, MerchantRule, NewCommitment, NewTransaction, SavingsGoal, Transaction } from './types'

function client() {
  if (!neon) throw new Error('Neon n’est pas configuré.')
  return neon
}

export async function listCategories(userId: string) {
  const { data, error } = await client().from('categories').select('*').eq('user_id', userId).order('name')
  if (error) throw error
  return data as Category[]
}

export async function createCategory(userId: string, category: Pick<Category, 'name' | 'color' | 'icon' | 'type'>) {
  const { data, error } = await client().from('categories').insert({ ...category, icon: category.icon ?? 'tag', user_id: userId }).select().single()
  if (error) throw error
  return data as Category
}

export async function updateCategory(userId: string, categoryId: string, changes: Partial<Pick<Category, 'name' | 'color' | 'icon' | 'type'>>) {
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

export async function createCommitments(userId: string, commitments: NewCommitment[]) {
  if (commitments.length === 0) return []
  const { data, error } = await client().from('commitments').insert(commitments.map((commitment) => ({ ...commitment, user_id: userId }))).select()
  if (error) throw error
  return data as Commitment[]
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

export async function listSavingsGoals(userId: string) {
  const { data, error } = await client().from('savings_goals').select('*').eq('user_id', userId).order('created_at')
  if (error) throw error
  return data as SavingsGoal[]
}

export async function createSavingsGoal(userId: string, goal: Pick<SavingsGoal, 'name' | 'target_amount' | 'target_date'>) {
  const { data, error } = await client().from('savings_goals').insert({ ...goal, user_id: userId }).select().single()
  if (error) throw error
  return data as SavingsGoal
}

export async function listGoalAllocations(userId: string) {
  const { data, error } = await client().from('goal_allocations').select('*').eq('user_id', userId).order('allocated_at', { ascending: false })
  if (error) throw error
  return data as GoalAllocation[]
}

export async function createGoalAllocation(userId: string, allocation: Pick<GoalAllocation, 'goal_id' | 'transaction_id' | 'amount' | 'allocated_at'>) {
  const { data, error } = await client().from('goal_allocations').insert({ ...allocation, user_id: userId }).select().single()
  if (error) throw error
  return data as GoalAllocation
}

export async function listMerchantRules(userId: string) {
  const { data, error } = await client().from('merchant_rules').select('*').eq('user_id', userId).order('created_at')
  if (error) throw error
  return data as MerchantRule[]
}

export async function createMerchantRule(userId: string, rule: Pick<MerchantRule, 'pattern' | 'category_id' | 'direction'>) {
  const { data, error } = await client().from('merchant_rules').insert({ ...rule, user_id: userId }).select().single()
  if (error) throw error
  return data as MerchantRule
}

export async function deleteMerchantRule(userId: string, ruleId: string) {
  const { error } = await client().from('merchant_rules').delete().eq('id', ruleId).eq('user_id', userId)
  if (error) throw error
}

export async function listImportJournal(userId: string) {
  const { data, error } = await client().from('import_journal').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
  if (error) throw error
  return data as ImportJournalEntry[]
}

export async function createImportJournalEntry(userId: string, entry: Pick<ImportJournalEntry, 'file_name' | 'document_type' | 'source' | 'status' | 'detected_count' | 'imported_count' | 'message'>) {
  const { data, error } = await client().from('import_journal').insert({ ...entry, user_id: userId }).select().single()
  if (error) throw error
  return data as ImportJournalEntry
}

export async function updateImportJournalEntry(userId: string, entryId: string, changes: Partial<Pick<ImportJournalEntry, 'document_type' | 'source' | 'status' | 'detected_count' | 'imported_count' | 'message'>>) {
  const { data, error } = await client().from('import_journal').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', entryId).eq('user_id', userId).select().single()
  if (error) throw error
  return data as ImportJournalEntry
}

export async function getBudgetSettings(userId: string) {
  const { data, error } = await client().from('budget_settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as BudgetSettings | null
}

export async function saveBudgetSettings(userId: string, settings: Pick<BudgetSettings, 'monthly_income' | 'reserve_amount' | 'payday_day'> & Partial<Pick<BudgetSettings, 'budget_currency' | 'display_currency'>>) {
  const { data, error } = await client().from('budget_settings').upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data as BudgetSettings
}

export const categoryTypes: CategoryType[] = ['income', 'expense']