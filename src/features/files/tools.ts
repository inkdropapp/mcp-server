import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { getFileUri } from '@inkdropapp/protocol-utils'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { maxAttachmentFileSize, supportedImageFileTypes, type File as IDFile } from 'inkdrop-model'
import { z } from 'zod'

import { fetchJSON, postJSON } from '../../client/local-server.js'
import { inferImageContentType, isViewableImageType } from './image-type.js'

const ImageFileTypes = [...supportedImageFileTypes] as [string, ...string[]]

/**
 * Registers the tools that create and read attachment files.
 *
 * @param server - The MCP server to register on
 */
export function registerFileTools(server: McpServer): void {
  server.registerTool(
    'create-file',
    {
      description:
        'Create a new attachment file in the database from a local image file or from base64 image data. ' +
        'Returns the Markdown to embed the attachment in a note body. ' +
        'Prefer `filePath` over `data`: it keeps the image bytes out of the conversation.',
      inputSchema: {
        filePath: z
          .string()
          .optional()
          .describe(
            'Absolute path to a local image file to attach. Either this or `data` must be given.'
          ),
        data: z
          .string()
          .optional()
          .describe(
            'Base64-encoded image data, without a `data:` URI prefix. Use `filePath` instead whenever the image is already on disk.'
          ),
        name: z
          .string()
          .min(1)
          .max(128)
          .optional()
          .describe(
            'The file name. Defaults to the file name of `filePath`, or `image.<ext>` when `data` is given.'
          ),
        contentType: z
          .enum(ImageFileTypes)
          .optional()
          .describe(
            'The MIME type of the image. Inferred from the `filePath` extension when omitted, so it is required with `data`.'
          )
      }
    },
    async ({ filePath, data, name, contentType }) => {
      if ((filePath === undefined) === (data === undefined)) {
        return {
          content: [
            {
              type: 'text',
              text: 'Failed to create the attachment: provide exactly one of `filePath` or `data`.'
            }
          ],
          isError: true
        }
      }

      let buffer: Buffer
      if (filePath !== undefined) {
        try {
          buffer = await readFile(filePath)
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to read the file at ${filePath}: ${(e as Error).message}`
              }
            ],
            isError: true
          }
        }
        contentType ??= inferImageContentType(filePath)
        name ??= basename(filePath)
      } else {
        buffer = Buffer.from(data!, 'base64')
      }

      if (!contentType) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create the attachment: could not infer the content type${
                filePath ? ` from ${filePath}` : ''
              }. Pass \`contentType\` explicitly. Supported types: ${supportedImageFileTypes.join(', ')}.`
            }
          ],
          isError: true
        }
      }

      const base64 = buffer.toString('base64')
      const contentLength = Math.floor((base64.length * 3) / 4)
      if (contentLength > maxAttachmentFileSize) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create the attachment: the file is ${contentLength} bytes, over the ${maxAttachmentFileSize} byte limit.`
            }
          ],
          isError: true
        }
      }

      const res = await postJSON<{ id: string; ok: boolean; rev: string }>('/files', {
        name: name ?? `image.${contentType.replace(/^image\//, '')}`,
        contentType,
        contentLength,
        publicIn: [],
        md5digest: createHash('md5').update(buffer).digest('hex'),
        _attachments: {
          index: {
            content_type: contentType,
            data: base64
          }
        }
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2)
          },
          {
            type: 'text',
            text: `Markdown to embed this attachment in a note body:\n\n![${name}](${getFileUri(res.id)})`
          }
        ]
      }
    }
  )

  server.registerTool(
    'read-file',
    {
      description:
        'Retrieve an attachment file by its ID. Returns the file metadata, and the image itself when it is a PNG, JPEG or GIF. ' +
        'Pass `outputPath` to write the attachment to disk instead — required to get at SVG, HEIC and HEIF attachments, which cannot be displayed inline.',
      inputSchema: {
        fileId: z
          .string()
          .describe(
            'ID of the attachment to retrieve. It can be found as `_id` in the file docs. It always starts with `file:`.'
          ),
        outputPath: z
          .string()
          .optional()
          .describe(
            'Absolute path to write the attachment to. When given, the file is saved there and its bytes are not returned inline.'
          ),
        includeImage: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            'Whether to return the image itself alongside the metadata. Set to false to fetch only the metadata of a large attachment.'
          )
      }
    },
    async ({ fileId, outputPath, includeImage }) => {
      if (!fileId.startsWith('file:')) fileId = `file:${fileId}`
      const needsData = includeImage || outputPath !== undefined
      const file = await fetchJSON<IDFile>(`/${fileId}`, {
        attachments: needsData ? true : undefined
      })

      const { _attachments, ...metadata } = file
      const base64 =
        typeof _attachments?.index?.data === 'string' ? _attachments.index.data : undefined

      const attachmentBlock = async () => {
        if (!needsData) return []
        if (!base64) {
          return [
            {
              type: 'text' as const,
              text: 'The attachment data could not be read from the document.'
            }
          ]
        }
        if (outputPath !== undefined) {
          await writeFile(outputPath, Buffer.from(base64, 'base64'))
          return [{ type: 'text' as const, text: `Attachment written to ${outputPath}` }]
        }
        if (!isViewableImageType(file.contentType)) {
          return [
            {
              type: 'text' as const,
              text: `The attachment is a ${file.contentType} file, which cannot be displayed inline. Pass \`outputPath\` to write it to disk.`
            }
          ]
        }
        return [
          {
            type: 'image' as const,
            data: base64,
            // `image/jpg` is not a real MIME type; the image block expects `image/jpeg`.
            mimeType: file.contentType === 'image/jpg' ? 'image/jpeg' : file.contentType
          }
        ]
      }

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(metadata, null, 2) },
          ...(await attachmentBlock())
        ]
      }
    }
  )
}
