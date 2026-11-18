import { describe, expect, test } from 'bun:test'

import { documentIdSchema, timestampSchema } from '../../src/utils/document-fields'

describe('documentIdSchema', () => {
  const tagIdSchema = documentIdSchema('tag:')

  test('accepts an ID with the prefix', () => {
    expect(tagIdSchema.parse('tag:abc123')).toBe('tag:abc123')
  })

  test('rejects an ID of another document type', () => {
    expect(tagIdSchema.safeParse('note:abc123').success).toBe(false)
  })

  test('rejects an ID that has the prefix in the middle', () => {
    expect(tagIdSchema.safeParse('my-tag:abc123').success).toBe(false)
  })

  test('rejects an ID shorter than 6 characters', () => {
    expect(tagIdSchema.safeParse('tag:a').success).toBe(false)
  })

  test('rejects an ID longer than 128 characters', () => {
    expect(tagIdSchema.safeParse(`tag:${'a'.repeat(125)}`).success).toBe(false)
  })
})

describe('timestampSchema', () => {
  test('accepts a Unix timestamp in milliseconds', () => {
    expect(timestampSchema.parse(1700000000000)).toBe(1700000000000)
  })

  test('rejects a negative number', () => {
    expect(timestampSchema.safeParse(-1).success).toBe(false)
  })

  test('rejects a fractional number', () => {
    expect(timestampSchema.safeParse(1.5).success).toBe(false)
  })
})
