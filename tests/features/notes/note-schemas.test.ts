import { describe, expect, test } from 'bun:test'

import { sourceTemplateIdSchema } from '../../../src/features/notes/note-schemas'

describe('sourceTemplateIdSchema', () => {
  test('accepts a note ID', () => {
    expect(sourceTemplateIdSchema.parse('note:abc123')).toBe('note:abc123')
  })

  test('accepts an omitted value', () => {
    expect(sourceTemplateIdSchema.parse(undefined)).toBeUndefined()
  })

  test('rejects an ID of another document type', () => {
    expect(sourceTemplateIdSchema.safeParse('book:abc123').success).toBe(false)
  })

  test('rejects a note link', () => {
    expect(sourceTemplateIdSchema.safeParse('inkdrop://note/abc123').success).toBe(false)
  })
})
