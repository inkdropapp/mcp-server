import { describe, expect, test } from 'bun:test'

import { noteTitleSchema, sourceTemplateIdSchema } from '../../../src/features/notes/note-schemas'

describe('sourceTemplateIdSchema', () => {
  test('accepts a note ID', () => {
    expect(sourceTemplateIdSchema.parse('note:abc123')).toBe('note:abc123')
  })

  test('rejects an ID of another document type', () => {
    expect(sourceTemplateIdSchema.safeParse('book:abc123').success).toBe(false)
  })

  test('rejects a note link', () => {
    expect(sourceTemplateIdSchema.safeParse('inkdrop://note/abc123').success).toBe(false)
  })
})

describe('noteTitleSchema', () => {
  test('accepts a title as long as inkdrop-model allows', () => {
    expect(noteTitleSchema.safeParse('a'.repeat(256)).success).toBe(true)
  })

  test('rejects a title longer than inkdrop-model allows', () => {
    expect(noteTitleSchema.safeParse('a'.repeat(257)).success).toBe(false)
  })
})
