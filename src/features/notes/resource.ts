import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Note } from 'inkdrop-model'

import { fetchJSON } from '../../client/local-server.js'

/**
 * Registers the `inkdrop://note/{noteId}` resource.
 *
 * @param server - The MCP server to register on
 */
export function registerNoteResource(server: McpServer): void {
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
}
