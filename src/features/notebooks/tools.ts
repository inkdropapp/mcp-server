import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BOOK_DOCID_PREFIX, type Book } from 'inkdrop-model'
import { z } from 'zod'

import { fetchJSON, postJSON } from '../../client/local-server.js'
import { documentIdSchema, revisionSchema, timestampSchema } from '../../utils/document-fields.js'

/**
 * Registers the tools that read, create and update notebooks.
 *
 * @param server - The MCP server to register on
 */
export function registerNotebookTools(server: McpServer): void {
  server.registerTool(
    'list-notebooks',
    { description: 'Retrieve a list of all notebooks' },
    async () => {
      const books: Array<Book> = await fetchJSON('/books')
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
            'ID of the book to retrieve. It can be found as `_id` in the book docs. It always starts with `book:`.'
          )
      }
    },
    async ({ bookId }) => {
      if (!bookId.startsWith('book:')) {
        bookId = `book:${bookId}`
      }
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
        parentBookId: documentIdSchema(BOOK_DOCID_PREFIX)
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
        _id: documentIdSchema(BOOK_DOCID_PREFIX).describe(
          'The unique document ID which should start with `book:` and the remains are randomly generated string'
        ),
        _rev: revisionSchema
          .optional()
          .describe(
            'This is a CouchDB specific field. The current MVCC-token/revision of this document. Optional: the server merges your fields into the stored notebook, so it is only needed as an optimistic-concurrency guard. Pass it when you have read the notebook first and want the update to fail on a conflicting concurrent edit.'
          ),
        name: z.string().min(1).max(64).optional().describe('The notebook name'),
        parentBookId: documentIdSchema(BOOK_DOCID_PREFIX)
          .nullable()
          .optional()
          .describe(
            'The ID of the parent notebook. Pass `null` to move the notebook to the root level.'
          ),
        createdAt: timestampSchema
          .optional()
          .describe(
            'The date time when the notebook was created, represented with Unix timestamps in milliseconds. Omit it to keep the current value.'
          ),
        updatedAt: timestampSchema
          .optional()
          .describe(
            'The date time when the notebook was last updated, represented with Unix timestamps in milliseconds. Defaults to the current time.'
          )
      }
    },
    async ({ _id, ...updateFields }) => {
      const res = await postJSON(`/${_id}`, {
        ...updateFields,
        updatedAt: updateFields.updatedAt ?? +new Date()
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
}
