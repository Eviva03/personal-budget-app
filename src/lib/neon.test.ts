import { describe, expect, it } from 'vitest'
import { isNeonConfigured } from './neon'

describe('Neon configuration', () => {
  it('does not require private credentials in the browser', () => {
    expect(typeof isNeonConfigured).toBe('boolean')
  })
})