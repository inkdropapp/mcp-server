#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Note, NoteSchema, Book, BookSchema } from 'inkdrop-model'
import { z } from 'zod'
import { fetchJSON, postJSON } from './api'

const server = new McpServer({
  name: 'Inkdrop',
  version: '1.0.0'
})

server.resource(
  'note',
  new ResourceTemplate('inkdrop://note/{noteId}', { list: undefined }),
  {
    description: 'A note data',
    mimeType: 'application/json'
  },
  async (uri, { noteId }) => {
    const note: Note[] = await fetchJSON(`/${noteId}`, {})
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

server.tool(
  'read-note',
  'Retrieve the complete contents of the note by its ID from the database.',
  {
    noteId: z
      .string()
      .describe(
        'ID of the note to retrieve. It can be found as `_id` in the note docs'
      )
  },
  async ({ noteId }) => {
    const note: Note[] = await fetchJSON(`/${noteId}`, {})
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(note, null, 2)
        }
      ]
    }
  }
)

server.tool(
  'search-notes',
  `List all notes that contain a given keyword.
The result does not include entire note bodies as they are truncated in 200 characters.
You have to retrieve the full note content by calling \`read-note\`.
Here are tips to specify keywords effectively:

## Use special qualifiers to narrow down results

You can use special qualifiers to get more accurate results. See the qualifiers and their usage examples:

- **book**  
  \`book:Blog\`: Searches for notes in the 'Blog' notebook.
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
  {
    keyword: z.string().describe(`Keyword to search for.`)
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

server.tool(
  'create-note',
  'Create a new note in the database',
  {
    bookId: z
      .string()
      .min(5)
      .max(128)
      .regex(/^(book:|trash$)/)
      .describe('The notebook ID'),

    title: z.string().max(128).describe('The note title'),

    body: z
      .string()
      .max(1048576)
      .describe('The content of the note represented with Markdown'),

    status: z
      .enum(['none', 'active', 'onHold', 'completed', 'dropped'])
      .optional()
      .describe('The status of the note')
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

server.tool(
  'update-note',
  'Update the existing note in the database',
  {
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
      .describe('The notebook ID'),

    title: z.string().max(128).describe('The note title'),

    body: z
      .string()
      .max(1048576)
      .describe('The content of the note represented with Markdown'),

    status: z
      .enum(['none', 'active', 'onHold', 'completed', 'dropped'])
      .optional()
      .describe('The status of the note')
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

server.tool(
  'list-notebooks',
  `Retrieve a list of all notebooks`,
  {},
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

server.prompt(
  'inkdrop-prompt',
  'Instructions for using the Inkdrop MCP server effectively',
  () => ({
    messages: [
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `Inkdrop is a Markdown note-taking app designed for programmers to help their coding workflow.
This server provides access to the Inkdrop database. Use it to search notes, create new notes, and track issues written in the notes.

Key capabilities:
- Search notes by keyword
- Get a note by its ID
- Get a list of all notebooks

Best practices:
- When searching:
  - Use specific, targeted queries for better results (e.g., "auth mobile app" rather than just "auth")
  - Apply relevant filters when asked or when you can infer the appropriate filters to narrow results
  - Use \`read-note\` to get the full note content

Model schemas:

\`\`\`json
${JSON.stringify(NoteSchema, null, 2)}
\`\`\`

\`\`\`json
${JSON.stringify(BookSchema, null, 2)}
\`\`\`

`
        }
      }
    ]
  })
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
