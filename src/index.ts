#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  Note,
  Book,
  TAG_COLOR,
  Tag,
  File as IDFile,
  maxAttachmentFileSize,
  supportedImageFileTypes
} from 'inkdrop-model'
import { z } from 'zod'

import { fetchJSON, postJSON } from './api'
import { getFileUri, getNoteUri, inferImageContentType, isViewableImageType } from './utils'

const server = new McpServer({
  name: 'Inkdrop',
  version: '1.3.0'
})

server.registerResource(
  'note',
  new ResourceTemplate('inkdrop://note/{noteId}', { list: undefined }),
  {
    description: 'A note data',
    mimeType: 'application/json'
  },
  async (uri, { noteId }) => {
    const id = Array.isArray(noteId) ? noteId[0] : noteId
    const normalizedId = id.startsWith('note:') ? id : `note:${id}`
    const note: Note[] = await fetchJSON(`/${normalizedId}`, {})
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(note, null, 2),
          mimeType: 'application/json'
        }
      ]
    }
  }
)

server.registerTool(
  'read-note',
  {
    description:
      'Retrieve the complete contents of the note by its ID from the database. ' +
      'A note created from a template has a `sourceTemplateId`; when present, the response ' +
      'includes a resource link to that source template, whose body holds the fill-out ' +
      'instructions and examples. Read the template (or pass `includeTemplate: true`) before ' +
      'completing the note.',
    inputSchema: {
      noteId: z
        .string()
        .describe(
          'ID of the note to retrieve. It can be found as `_id` in the note docs. It always starts with \`note:\`.'
        ),
      includeTemplate: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'When true and the note has a `sourceTemplateId`, also fetch that template and embed its body (the fill-out instructions and examples) as an extra text block, so you get the note and its template in one call.'
        )
    }
  },
  async ({ noteId, includeTemplate }) => {
    if (!noteId.startsWith('note:')) noteId = `note:${noteId}`
    const note = await fetchJSON<Note>(`/${noteId}`, {})

    let templateBlockText: string | null = null
    if (includeTemplate && note.sourceTemplateId) {
      try {
        const template = await fetchJSON<Note>(`/${note.sourceTemplateId}`, {})
        templateBlockText = `# Source template: ${template.title}\n\n${template.body}`
      } catch {
        // Template unavailable (e.g. deleted → 404). Skip the embed; the note read still succeeds.
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(note, null, 2)
        },
        ...(note.sourceTemplateId
          ? [
              {
                type: 'resource_link' as const,
                uri: getNoteUri(note.sourceTemplateId),
                name: 'Source template',
                mimeType: 'application/json',
                description:
                  'The template this note was created from. Read it to get the fill-out instructions and examples before completing this note.'
              }
            ]
          : []),
        ...(templateBlockText ? [{ type: 'text' as const, text: templateBlockText }] : [])
      ]
    }
  }
)

server.registerTool(
  'read-backlinks',
  {
    description: `Retrieve backlinks for a note — the notes that link to it.
Each result is returned as a resource link (\`inkdrop://note/<id>\`) pointing to the referring note.
Backlinks are found by searching all note bodies for the note's link URI.`,
    inputSchema: {
      noteId: z
        .string()
        .describe(
          'ID of the note to find backlinks for. It can be found as `_id` in the note docs. It always starts with \`note:\`.'
        )
    }
  },
  async ({ noteId }) => {
    if (!noteId.startsWith('note:')) noteId = `note:${noteId}`
    const noteLink = getNoteUri(noteId)
    const backlinks: Note[] = await fetchJSON('/notes', {
      keyword: noteLink,
      limit: 100
    })
    if (backlinks.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No backlinks found for ${noteLink}.`
          }
        ]
      }
    }
    return {
      content: backlinks.map(note => ({
        type: 'resource_link' as const,
        uri: getNoteUri(note._id),
        name: note.title || 'Untitled note',
        mimeType: 'application/json'
      }))
    }
  }
)

server.registerTool(
  'search-notes',
  {
    description: `List all notes that contain a given keyword.
The result does not include entire note bodies as they are truncated in 200 characters.
You have to retrieve the full note content by calling \`read-note\`.
Here are tips to specify keywords effectively:

## Use special qualifiers to narrow down results

You can use special qualifiers to get more accurate results. See the qualifiers and their usage examples:

- **book**
  \`book:Blog\`: Searches for notes in the 'Blog' notebook.
  \`book:"Desktop App"\`: Searches for notes in the 'Desktop App' notebook.
- **bookId**
  \`bookId:kGlLniaV\`: Searches for notes in the notebook ID 'book:kGlLniaV'.
- **tag**
  \`tag:JavaScript\`: Searches for all notes having the 'JavaScript' tag. Read more about [tags](https://docs.inkdrop.app/manual/write-notes#tag-notes).
- **status**
  \`status:onHold\`: Searches for all notes with the 'On hold' status. Read more about [statuses](/reference/note-statuses).
- **title**
  \`title:"JavaScript setTimeout"\`: Searches for the note with the specified title.
- **body**
  \`body:KEYWORD\`: Searches for a specific word in all notes. Equivalent to a [global search](#search-for-notes-across-all-notebooks).

### Combine qualifiers

You can combine the filter qualifiers to refine data even more.

**Find notes that contain the word 'Hello' and have the 'Issue' tag.**

\`\`\`text
Hello tag:Issue
\`\`\`

**Find notes that contain the word 'Typescript,' have the 'Contribution' tag, and the 'Completed' status**

\`\`\`text
Typescript tag:Contribution status:Completed
\`\`\`

## Search for text with spaces

To find the text that includes spaces, put the text into the double quotation marks ("):

\`\`\`text
"database associations"
\`\`\`

## Exclude text from search

To exclude text from the search results or ignore a specific qualifier, put the minus sign (-) before it. You can also combine the exclusions. See the examples:

- \`-book:Backend "closure functions"\`: Ignores the 'Backend' notebook while searching for the 'closure functions' phrase.
- \`-tag:JavaScript\`: Ignores all notes having the 'JavaScript' tag.
- \`-book:Typescript tag:work "Data types"\`: Ignores the 'Typescript' notebook and the 'work' tag while searching for the 'Data types' phrase.
- \`-status:dropped title:"Sprint 10.0" debounce\`: Ignores notes with the 'Dropped' status while searching for the 'debounce' word in the note with the 'Sprint 10.0' title.
- \`-"Phrase to ignore" "in the rest of a sentence"\`: Ignores the 'Phrase to ignore' part while searching for 'in the rest of a sentence'.

Note that you can't specify excluding modifiers only without including conditions.

**WARNING**: Make sure to enter a text to search for after the exclusion modifier.

- ✅ Will work
  \`-book:Backend "closure functions"\`

- ⛔️ Won't work
   \`-book:Backend\`. There's no query. Inkdrop doesn't understand what to search for.
    `,
    inputSchema: {
      keyword: z.string().describe(`Keyword to search for.`)
    }
  },
  async ({ keyword }) => {
    const notes: Note[] = await fetchJSON('/notes', { keyword, limit: 10 })
    const summaries = notes.map(note => {
      return {
        ...note,
        body: note.body.substring(0, 200)
      }
    })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summaries, null, 2)
        }
      ]
    }
  }
)

server.registerTool(
  'list-notes',
  {
    description: `List all notes with specified conditions.
The result does not include entire note bodies as they are truncated in 200 characters.
You have to retrieve the full note content by calling \`read-note\`.
`,
    inputSchema: {
      bookId: z
        .string()
        .optional()
        .describe(
          `ID of the notebook. It always starts with 'book:'. You can retrieve a list of notebooks with \`list-notebooks\``
        ),
      tagIds: z
        .array(z.string())
        .optional()
        .default([])
        .describe(
          `An array of tag IDs to filter. It always starts with 'tag:'. You can retrieve a list of available tags from \`list-tags\`.`
        ),
      keyword: z.string().optional().describe(`Keyword to filter notes`),
      sort: z
        .enum(['updatedAt', 'createdAt', 'title'])
        .optional()
        .default('updatedAt')
        .describe(`Sort the documents by the specified field`),
      descending: z
        .boolean()
        .optional()
        .default(true)
        .describe(`Reverse the order of the output documents`),
      limit: z.number().optional().default(100).describe(`Limit the number of results returned`)
    }
  },
  async ({ bookId, tagIds, keyword, sort, descending, limit }) => {
    const bookFilter = bookId ? `bookId:${bookId.split(':')[1]}` : ''
    const tagFilter = tagIds ? tagIds.map(t => `tagId:${t}`).join(' ') : ''
    keyword = `${bookFilter} ${tagFilter} ${keyword || ''}`.trim()
    const notes: Note[] = await fetchJSON('/notes', {
      keyword,
      sort,
      descending,
      limit
    })
    const summaries = notes.map(note => {
      return {
        ...note,
        body: note.body.substring(0, 200)
      }
    })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summaries, null, 2)
        }
      ]
    }
  }
)

server.registerTool(
  'create-note',
  {
    description: 'Create a new note in the database',
    inputSchema: {
      bookId: z
        .string()
        .min(5)
        .max(128)
        .regex(/^(book:|trash$)/)
        .describe('The notebook ID'),

      title: z.string().max(128).describe('The note title'),

      body: z.string().max(1048576).describe('The content of the note represented with Markdown'),

      status: z
        .enum(['none', 'active', 'onHold', 'completed', 'dropped'])
        .optional()
        .describe('The status of the note'),

      tags: z
        .array(z.string().startsWith('tag:'))
        .optional()
        .describe(
          'An array of tag IDs to assign to the note. Call `list-tags` or `read-tag` to retrieve available tags. You can create a new tag with `create-tag` tool if necessary.'
        )
    }
  },
  async noteData => {
    const res = await postJSON(`/notes`, noteData)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(res, null, 2)
        }
      ]
    }
  }
)

server.registerTool(
  'update-note',
  {
    description:
      'Update the existing note in the database. Only the fields you provide will be updated; omitted fields remain unchanged.',
    inputSchema: {
      _id: z
        .string()
        .min(6)
        .max(128)
        .regex(/^note:/)
        .describe(
          'The unique document ID which should start with `note:` and the remains are randomly generated string'
        ),

      _rev: z
        .string()
        .describe(
          'This is a CouchDB specific field. The current MVCC-token/revision of this document (mandatory and immutable).'
        ),

      bookId: z
        .string()
        .min(5)
        .max(128)
        .regex(/^(book:|trash$)/)
        .optional()
        .describe('The notebook ID'),

      title: z.string().max(128).optional().describe('The note title'),

      body: z
        .string()
        .max(1048576)
        .optional()
        .describe(
          'The content of the note in Markdown. NOTE: Do not escape special characters like `\\n`.'
        ),

      status: z
        .enum(['none', 'active', 'onHold', 'completed', 'dropped'])
        .optional()
        .describe('The status of the note'),

      tags: z
        .array(z.string().startsWith('tag:'))
        .optional()
        .describe(
          'An array of tag IDs to assign to the note. Call `list-tags` or `read-tag` to retrieve available tags. You can create a new tag with `create-tag` tool if necessary.'
        )
    }
  },
  async noteData => {
    const rev = noteData._rev
    const existingNote = await fetchJSON<Note>(`/${noteData._id}`, { rev })

    const res = await postJSON(`/notes`, {
      ...existingNote,
      ...noteData,
      updatedAt: +new Date()
    })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(res, null, 2)
        }
      ]
    }
  }
)

server.registerTool(
  'patch-note',
  {
    description:
      'Update the body of the existing note by performing an exact string replacement. Use this tool to make partial updates to the note body without replacing the entire content. You must first read the note with `read-note` to get the current body, then specify the exact substring to replace.',
    inputSchema: {
      _id: z
        .string()
        .min(6)
        .max(128)
        .regex(/^note:/)
        .describe(
          'The unique document ID which should start with `note:` and the remains are randomly generated string'
        ),

      _rev: z
        .string()
        .describe(
          'This is a CouchDB specific field. The current MVCC-token/revision of this document (mandatory and immutable).'
        ),

      old_string: z
        .string()
        .min(1)
        .describe(
          'The exact text to find in the note body. Must match exactly one occurrence. Include enough surrounding context to ensure a unique match.'
        ),

      new_string: z
        .string()
        .describe(
          'The text to replace `old_string` with. Use an empty string to delete the matched text.'
        )
    }
  },
  async ({ _id, _rev, old_string, new_string }) => {
    const existingNote = await fetchJSON<Note>(`/${_id}`, { rev: _rev })
    const body = existingNote.body

    const firstIndex = body.indexOf(old_string)
    if (firstIndex === -1) {
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to patch: `old_string` was not found in the note body.'
          }
        ],
        isError: true
      }
    }

    const secondIndex = body.indexOf(old_string, firstIndex + 1)
    if (secondIndex !== -1) {
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to patch: `old_string` matches multiple locations in the note body. Provide more surrounding context to make it unique.'
          }
        ],
        isError: true
      }
    }

    const patched =
      body.slice(0, firstIndex) + new_string + body.slice(firstIndex + old_string.length)

    const res = await postJSON('/notes', {
      ...existingNote,
      body: patched,
      updatedAt: +new Date()
    })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(res, null, 2)
        }
      ]
    }
  }
)

server.registerTool('list-tags', { description: 'Retrieve a list of all tags' }, async () => {
  const tags: Tag[] = await fetchJSON('/tags')
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(tags, null, 2)
      }
    ]
  }
})

server.registerTool(
  'read-tag',
  {
    description: 'Retrieve a single tag',
    inputSchema: {
      tagId: z
        .string()
        .describe(
          'ID of the tag to retrieve. It can be found as `_id` in the tag docs. It always starts with \`tag:\`.'
        )
    }
  },
  async ({ tagId }) => {
    if (!tagId.startsWith('tag:')) tagId = `tag:${tagId}`
    const tag: Tag = await fetchJSON(`/${tagId}`, {})
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(tag, null, 2)
        }
      ]
    }
  }
)

const TagColors = Object.values(TAG_COLOR) as [string, ...string[]]

server.registerTool(
  'create-tag',
  {
    description: 'Create a new tag in the database',
    inputSchema: {
      color: z.enum(TagColors).default('default').describe('The color type of the tag'),

      name: z.string().max(64).describe('The name of the tag')
    }
  },
  async tagData => {
    const res = await postJSON(`/tags`, tagData)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(res, null, 2)
        }
      ]
    }
  }
)

server.registerTool(
  'update-tag',
  {
    description:
      'Update the existing tag in the database. Only the fields you provide will be updated; omitted fields remain unchanged, so you do not need to read the tag first. Call `list-tags` or `read-tag` to find the tag ID.',
    inputSchema: {
      _id: z
        .string()
        .min(6)
        .max(128)
        .regex(/^tag:/)
        .describe(
          'The unique document ID which should start with `tag:` and the remains are randomly generated string'
        ),
      _rev: z
        .string()
        .optional()
        .describe(
          'This is a CouchDB specific field. The current MVCC-token/revision of this document. Optional: the server merges your fields into the stored tag, so it is only needed as an optimistic-concurrency guard. Pass it when you have read the tag first and want the update to fail on a conflicting concurrent edit.'
        ),
      color: z.enum(TagColors).optional().describe('The color type of the tag'),
      name: z.string().max(64).optional().describe('The name of the tag')
    }
  },
  async ({ _id, ...updateFields }) => {
    const res = await postJSON(`/${_id}`, updateFields)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(res, null, 2)
        }
      ]
    }
  }
)

server.registerTool(
  'list-notebooks',
  { description: 'Retrieve a list of all notebooks' },
  async () => {
    const books: Book[] = await fetchJSON('/books')
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(books, null, 2)
        }
      ]
    }
  }
)

server.registerTool(
  'read-book',
  {
    description: 'Retrieve a single book',
    inputSchema: {
      bookId: z
        .string()
        .describe(
          'ID of the book to retrieve. It can be found as `_id` in the book docs. It always starts with \`book:\`.'
        )
    }
  },
  async ({ bookId }) => {
    if (!bookId.startsWith('book:')) bookId = `book:${bookId}`
    const book: Book = await fetchJSON(`/${bookId}`, {})
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(book, null, 2)
        }
      ]
    }
  }
)

server.registerTool(
  'create-book',
  {
    description:
      'Create a new notebook in the database. To create a nested notebook, pass the parent notebook ID as `parentBookId`. Call `list-notebooks` first to find it.',
    inputSchema: {
      name: z.string().min(1).max(64).describe('The notebook name'),
      parentBookId: z
        .string()
        .min(6)
        .max(128)
        .regex(/^book:/)
        .optional()
        .describe(
          'The ID of the parent notebook. Omit it to create the notebook at the root level.'
        )
    }
  },
  async bookData => {
    const res = await postJSON(`/books`, bookData)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(res, null, 2)
        }
      ]
    }
  }
)

server.registerTool(
  'update-book',
  {
    description:
      'Update the existing notebook in the database. Only the fields you provide will be updated; omitted fields remain unchanged, so you do not need to read the notebook first. Call `list-notebooks` or `read-book` to find the notebook ID.',
    inputSchema: {
      _id: z
        .string()
        .min(6)
        .max(128)
        .regex(/^book:/)
        .describe(
          'The unique document ID which should start with `book:` and the remains are randomly generated string'
        ),
      _rev: z
        .string()
        .optional()
        .describe(
          'This is a CouchDB specific field. The current MVCC-token/revision of this document. Optional: the server merges your fields into the stored notebook, so it is only needed as an optimistic-concurrency guard. Pass it when you have read the notebook first and want the update to fail on a conflicting concurrent edit.'
        ),
      name: z.string().min(1).max(64).optional().describe('The notebook name'),
      parentBookId: z
        .string()
        .min(6)
        .max(128)
        .regex(/^book:/)
        .nullable()
        .optional()
        .describe(
          'The ID of the parent notebook. Pass `null` to move the notebook to the root level.'
        )
    }
  },
  async ({ _id, ...updateFields }) => {
    const res = await postJSON(`/${_id}`, {
      ...updateFields,
      updatedAt: +new Date()
    })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(res, null, 2)
        }
      ]
    }
  }
)

const ImageFileTypes = [...supportedImageFileTypes] as [string, ...string[]]

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
          'ID of the attachment to retrieve. It can be found as `_id` in the file docs. It always starts with \`file:\`.'
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

async function runServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('Secure MCP Inkdrop Server running on stdio')
}

runServer().catch(error => {
  console.error('Fatal error running server:', error)
  process.exit(1)
})
