import { extname } from 'node:path'

import { SUPPORTED_IMAGE_MIME_TYPES, type ImageFileType } from 'inkdrop-model'

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
