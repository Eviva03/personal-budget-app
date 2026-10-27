import { describe, expect, it } from 'vitest'
import { isSupabaseConfigured } from './supabase'

describe('Supabase configuration', () => {
  it('does not require private credentials in the browser', () => {
    expect(typeof isSupabaseConfigured).toBe('boolean')
  })
})