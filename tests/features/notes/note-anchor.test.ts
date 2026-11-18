import { describe, expect, test } from 'bun:test'

import {
  describeNoteLines,
  extractNoteLines,
  parseNoteReference
} from '../../../src/features/notes/note-anchor'

describe('parseNoteReference', () => {
  test('keeps a prefixed note ID', () => {
    expect(parseNoteReference('note:abc123')).toEqual({ noteId: 'note:abc123' })
  })

  test('adds the prefix to a bare note ID', () => {
    expect(parseNoteReference('abc123')).toEqual({ noteId: 'note:abc123' })
  })

  test('reads the note ID from a note URI', () => {
    expect(parseNoteReference('inkdrop://note/abc123')).toEqual({ noteId: 'note:abc123' })
  })

  test('reads a single-line anchor', () => {
    expect(parseNoteReference('inkdrop://note/abc123#L5')).toEqual({
      noteId: 'note:abc123',
      anchor: { type: 'lines', startLine: 5, endLine: 5 }
    })
  })

  test('reads a line-range anchor', () => {
    expect(parseNoteReference('inkdrop://note/abc123#L5-L8')).toEqual({
      noteId: 'note:abc123',
      anchor: { type: 'lines', startLine: 5, endLine: 8 }
    })
  })

  test('reads a heading anchor', () => {
    expect(parseNoteReference('inkdrop://note/abc123#setup-guide')).toEqual({
      noteId: 'note:abc123',
      anchor: { type: 'heading', slug: 'setup-guide' }
    })
  })

  test('reads the legacy note URI form', () => {
    expect(parseNoteReference('inkdrop://note:abc123#L2')).toEqual({
      noteId: 'note:abc123',
      anchor: { type: 'lines', startLine: 2, endLine: 2 }
    })
  })

  test('rejects an Inkdrop URI that is not a note', () => {
    expect(() => parseNoteReference('inkdrop://file:abc123')).toThrow(/not a note URI/)
  })
})

describe('extractNoteLines', () => {
  const body = 'one\ntwo\nthree\nfour\nfive'

  test('returns a single line', () => {
    expect(extractNoteLines(body, { startLine: 2, endLine: 2 })).toEqual({
      text: 'two',
      startLine: 2,
      endLine: 2,
      totalLines: 5
    })
  })

  test('returns an inclusive range', () => {
    expect(extractNoteLines(body, { startLine: 2, endLine: 4 })).toEqual({
      text: 'two\nthree\nfour',
      startLine: 2,
      endLine: 4,
      totalLines: 5
    })
  })

  test('clamps a range that runs past the end', () => {
    expect(extractNoteLines(body, { startLine: 4, endLine: 99 })).toEqual({
      text: 'four\nfive',
      startLine: 4,
      endLine: 5,
      totalLines: 5
    })
  })

  test('lands on the last line when the whole range is past the end', () => {
    expect(extractNoteLines(body, { startLine: 50, endLine: 60 })).toEqual({
      text: 'five',
      startLine: 5,
      endLine: 5,
      totalLines: 5
    })
  })

  test('counts CRLF and CR line breaks as one line break', () => {
    expect(extractNoteLines('one\r\ntwo\rthree', { startLine: 2, endLine: 3 })).toEqual({
      text: 'two\nthree',
      startLine: 2,
      endLine: 3,
      totalLines: 3
    })
  })

  test('treats an empty body as one empty line', () => {
    expect(extractNoteLines('', { startLine: 1, endLine: 3 })).toEqual({
      text: '',
      startLine: 1,
      endLine: 1,
      totalLines: 1
    })
  })
})

describe('describeNoteLines', () => {
  test('names a single line', () => {
    expect(
      describeNoteLines({ text: 'five', startLine: 5, endLine: 5, totalLines: 20 })
    ).toStartWith("`body` holds only line 5 of this note's 20 lines")
  })

  test('names a line range', () => {
    expect(
      describeNoteLines({ text: 'a\nb', startLine: 8, endLine: 9, totalLines: 20 })
    ).toStartWith("`body` holds only lines 8-9 of this note's 20 lines")
  })
})
