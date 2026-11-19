import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TAG_COLOR, TAG_DOCID_PREFIX, type Tag } from 'inkdrop-model'
import { z } from 'zod'

import { fetchJSON, postJSON } from '../../client/local-server.js'
import { documentIdSchema, revisionSchema } from '../../utils/document-fields.js'

const TagColors = Object.values(TAG_COLOR) as [string, ...Array<string>]

/**
 * Registers the tools that read, create and update tags.
 *
 * @param server - The MCP server to register on
 */
export function registerTagTools(server: McpServer): void {
  server.registerTool('list-tags', { description: 'Retrieve a list of all tags' }, async () => {
    const tags: Array<Tag> = await fetchJSON('/tags')
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
            'ID of the tag to retrieve. It can be found as `_id` in the tag docs. It always starts with `tag:`.'
          )
      }
    },
    async ({ tagId }) => {
      if (!tagId.startsWith('tag:')) {
        tagId = `tag:${tagId}`
      }
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
        _id: documentIdSchema(TAG_DOCID_PREFIX).describe(
          'The unique document ID which should start with `tag:` and the remains are randomly generated string'
        ),
        _rev: revisionSchema
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
}
