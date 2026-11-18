import { parseInkdropUri, type NoteAnchor } from '@inkdropapp/protocol-utils'

/** A note, and optionally a location inside it. */
export type NoteReference = {
  /** The note document ID, with the `note:` prefix. */
  noteId: string
  anchor?: NoteAnchor
}

/** A 1-based, inclusive line range. */
export type NoteLineRange = {
  startLine: number
  endLine: number
}

export type NoteLines = NoteLineRange & {
  /** The requested lines, joined with `\n`. */
  text: string
  totalLines: number
}

const INKDROP_URI_PREFIX = 'inkdrop://'
const LINE_BREAK_PATTERN = /\r\n?|\n/

/**
 * Parses what a tool received as a note ID: a document ID with or without the
 * `note:` prefix, or a note link such as `inkdrop://note/abc123#L5-L8`.
 *
 * @param noteIdOrUri - The note ID or note URI
 * @returns The note ID, plus the anchor when the URI has one
 * @throws {Error} If the input is an Inkdrop URI that doesn't point to a note
 */
export function parseNoteReference(noteIdOrUri: string): NoteReference {
  if (!noteIdOrUri.startsWith(INKDROP_URI_PREFIX)) {
    return { noteId: noteIdOrUri.startsWith('note:') ? noteIdOrUri : `note:${noteIdOrUri}` }
  }

  const parsedUri = parseInkdropUri(noteIdOrUri)
  if (parsedUri?.resourceType !== 'note') {
    throw new Error(`\`${noteIdOrUri}\` is not a note URI. Expected \`inkdrop://note/<id>\`.`)
  }
  return parsedUri.anchor
    ? { noteId: parsedUri.resourceId, anchor: parsedUri.anchor }
    : { noteId: parsedUri.resourceId }
}

/**
 * Picks a line range out of a note body.
 *
 * The range is clamped to the body the same way the editor clamps a line anchor,
 * so a link to lines that no longer exist lands on the last line.
 *
 * @param body - The note body
 * @param lineRange - The lines to pick
 * @returns The lines that were picked, their actual range, and the body's line count
 */
export function extractNoteLines(body: string, lineRange: NoteLineRange): NoteLines {
  const lines = body.split(LINE_BREAK_PATTERN)
  const totalLines = lines.length
  const clampLine = (line: number) => Math.min(Math.max(line, 1), totalLines)
  const startLine = clampLine(lineRange.startLine)
  const endLine = clampLine(lineRange.endLine)

  return {
    text: lines.slice(startLine - 1, endLine).join('\n'),
    startLine,
    endLine,
    totalLines
  }
}

/**
 * Words the notice `read-note` adds when `body` is an excerpt, so the excerpt
 * isn't mistaken for the whole note.
 *
 * @param noteLines - The lines that were picked out of the note body
 * @returns The notice text
 */
export function describeNoteLines({ startLine, endLine, totalLines }: NoteLines): string {
  const lineLabel = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`
  return (
    `\`body\` holds only ${lineLabel} of this note's ${totalLines} lines, as the link's anchor asks for. ` +
    'Call `read-note` with the note ID alone to get the whole body.'
  )
}
