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
