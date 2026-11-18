#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerFileTools } from './features/files/tools.js'
import { registerNotebookTools } from './features/notebooks/tools.js'
import { registerNoteResource } from './features/notes/resource.js'
import { registerNoteTools } from './features/notes/tools.js'
import { registerTagTools } from './features/tags/tools.js'

const server = new McpServer({
  name: 'Inkdrop',
  version: '1.3.0'
})

registerNoteResource(server)
registerNoteTools(server)
registerTagTools(server)
registerNotebookTools(server)
registerFileTools(server)

async function runServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('Secure MCP Inkdrop Server running on stdio')
}

runServer().catch(error => {
  console.error('Fatal error running server:', error)
  process.exit(1)
})
