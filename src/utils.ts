import { extname } from 'node:path'

import { SUPPORTED_IMAGE_MIME_TYPES, type ImageFileType } from 'inkdrop-model'

/**
 * Builds the canonical Inkdrop note URI for a note ID.
 *
 * The `note:` prefix is stripped so the result matches how note links are stored
 * in note bodies (`note:foobar` → `inkdrop://note/foobar`). Backlink searches rely
 * on this exact form to find notes that link to a given note.
 *
 * @param noteId - The note document ID, with or without the `note:` prefix
 * @returns The `inkdrop://note/<id>` URI
 */
export function getNoteUri(noteId: string): string {
  return `inkdrop://note/${noteId.replace(/^note:/, '')}`
}

/**
 * Builds the Inkdrop attachment URI for a file ID.
 *
 * Unlike note links, attachment URIs keep the `file:` prefix and use no slash
 * (`file:foobar` → `inkdrop://file:foobar`). This matches how the desktop app
 * renders an attachment into a note body, so the result can be embedded as-is.
 *
 * @param fileId - The file document ID, with or without the `file:` prefix
 * @returns The `inkdrop://file:<id>` URI
 */
export function getFileUri(fileId: string): string {
  return `inkdrop://${fileId.startsWith('file:') ? fileId : `file:${fileId}`}`
}

/**
 * Infers the attachment content type from a file name or path extension.
 *
 * `SUPPORTED_IMAGE_MIME_TYPES` is keyed by MIME subtype, which doubles as the file
 * extension for every supported type except SVG, whose subtype is `svg+xml`.
 *
 * @returns The matching image MIME type, or `undefined` when the extension is
 * missing or not a supported attachment type
 */
export function inferImageContentType(filePath: string): ImageFileType | undefined {
  const ext = extname(filePath).toLowerCase().replace(/^\./, '')
  return SUPPORTED_IMAGE_MIME_TYPES[ext === 'svg' ? 'svg+xml' : ext]
}

export type TextEdit = {
  old_string: string
  new_string: string
}

export type ApplyTextEditsResult = { ok: true; text: string } | { ok: false; error: string }

/**
 * Applies exact string replacements in order, each against the result of the
 * previous one, so a later edit can match text an earlier edit produced.
 *
 * Every `old_string` must match exactly one location at the time it is applied.
 * Processing stops at the first edit that does not, so callers never see a
 * partially patched text.
 *
 * @param text - The text to patch
 * @param edits - The replacements to perform
 * @returns The patched text, or an error naming the 1-based position of the failing edit
 */
export function applyTextEdits(text: string, edits: TextEdit[]): ApplyTextEditsResult {
  let patchedText = text

  for (const [editIndex, { old_string, new_string }] of edits.entries()) {
    const editLabel = `edit ${editIndex + 1} of ${edits.length}`

    const firstMatchIndex = patchedText.indexOf(old_string)
    if (firstMatchIndex === -1) {
      return {
        ok: false,
        error: `\`old_string\` of ${editLabel} was not found in the note body.`
      }
    }

    if (patchedText.indexOf(old_string, firstMatchIndex + 1) !== -1) {
      return {
        ok: false,
        error: `\`old_string\` of ${editLabel} matches multiple locations in the note body. Provide more surrounding context to make it unique.`
      }
    }

    patchedText =
      patchedText.slice(0, firstMatchIndex) +
      new_string +
      patchedText.slice(firstMatchIndex + old_string.length)
  }

  return { ok: true, text: patchedText }
}

/**
 * Content types the MCP `image` content block can carry. Inkdrop also accepts
 * SVG and HEIC/HEIF attachments, which have to be written to disk instead.
 */
const VIEWABLE_IMAGE_TYPES = new Set<ImageFileType>([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif'
])

/**
 * Whether an attachment can be returned as an MCP `image` content block.
 */
export function isViewableImageType(contentType: ImageFileType | undefined): boolean {
  return contentType !== undefined && VIEWABLE_IMAGE_TYPES.has(contentType)
}
