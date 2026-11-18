import { getNoteUri } from '@inkdropapp/protocol-utils'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Note } from 'inkdrop-model'
import { z } from 'zod'

import { fetchJSON, postJSON } from '../../client/local-server.js'
import { describeNoteLines, extractNoteLines, parseNoteReference } from './note-anchor.js'
import { sourceTemplateIdSchema } from './note-schemas.js'
import { updateNote } from './note-update.js'
import { applyTextEdits } from './text-edits.js'

/**
 * Registers the tools that read, search, create and update notes and templates.
 *
 * @param server - The MCP server to register on
 */
export function registerNoteTools(server: McpServer): void {
  server.registerTool(
    'read-note',
    {
      description:
        'Retrieve the complete contents of the note by its ID or its note link from the database. ' +
        'A note link can carry a line anchor (`inkdrop://note/<id>#L5` or `#L5-L8`); ' +
        'the returned `body` then holds only those lines. ' +
        'A note created from a template has a `sourceTemplateId`; when present, the response ' +
        'includes a resource link to that source template, whose body holds the fill-out ' +
        'instructions and examples. Read the template (or pass `includeTemplate: true`) before ' +
        'completing the note.',
      inputSchema: {
        noteId: z
          .string()
          .describe(
            'ID of the note to retrieve, or a note link. The ID can be found as `_id` in the note docs and always starts with \`note:\`. ' +
              'A note link looks like `inkdrop://note/<id>`, optionally followed by `#L5` (one line) or `#L5-L8` (a line range) to read only those lines.'
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
    async ({ noteId: noteIdOrUri, includeTemplate }) => {
      const { noteId, anchor } = parseNoteReference(noteIdOrUri)
      const storedNote = await fetchJSON<Note>(`/${noteId}`, {})
      const anchoredLines =
        anchor?.type === 'lines' ? extractNoteLines(storedNote.body, anchor) : undefined
      const note = anchoredLines ? { ...storedNote, body: anchoredLines.text } : storedNote

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
          ...(anchoredLines
            ? [{ type: 'text' as const, text: describeNoteLines(anchoredLines) }]
            : []),
          ...(anchor?.type === 'heading'
            ? [
                {
                  type: 'text' as const,
                  text: `The link points to the heading whose slug is \`${anchor.slug}\`. Heading anchors are not resolved by this tool, so \`body\` holds the whole note.`
                }
              ]
            : []),
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
  \`book:kGlLniaV\`: Searches for notes in the notebook with the ID 'book:kGlLniaV'.
- **tag**
  \`tag:JavaScript\`: Searches for all notes having the 'JavaScript' tag. Read more about [tags](https://docs.inkdrop.app/manual/write-notes#tag-notes).
  \`tag:pQ7xYt2R\`: Searches for all notes having the tag with the ID 'tag:pQ7xYt2R'.
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
            `ID of the notebook. It always starts with 'book:'. You can retrieve a list of notebooks with \`list-notebooks\`. The pseudo-notebooks 'trash' and 'template' are not supported here; use \`list-templates\` for templates`
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
      const bookFilter = bookId ?? ''
      const tagFilter = tagIds?.join(' ') ?? ''
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
    'list-templates',
    {
      description: `List note templates: your custom templates, followed by the official ones bundled with Inkdrop.
Templates are notes whose \`bookId\` is \`template\`. Official templates are read-only.
The result does not include entire template bodies as they are truncated in 200 characters.
You have to retrieve the full template content by calling \`read-note\`.
When you create a note from a template, pass the template's \`_id\` as \`sourceTemplateId\` to \`create-note\`.
`,
      inputSchema: {
        keyword: z
          .string()
          .optional()
          .describe(
            'Filter templates by fuzzy-matching their titles. Search qualifiers such as `book:` or `tag:` are not supported.'
          )
      }
    },
    async ({ keyword }) => {
      const templates: Note[] = await fetchJSON('/templates', { keyword })
      const summaries = templates.map(template => {
        return {
          ...template,
          body: template.body.substring(0, 200)
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
          .regex(/^(book:|trash$|template$)/)
          .describe('The notebook ID. Specify `template` to create a custom note template'),

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
          ),

        sourceTemplateId: sourceTemplateIdSchema
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
        'Update one or more existing notes in the database. Only the fields you provide will be updated; omitted fields remain unchanged. Each note is saved independently, so a failed update does not roll back the others; the result reports the outcome of every note.',
      inputSchema: {
        notes: z
          .array(
            z.object({
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
                .regex(/^(book:|trash$|template$)/)
                .optional()
                .describe(
                  'The notebook ID. Specify `template` to turn the note into a custom note template'
                ),

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
                ),

              sourceTemplateId: sourceTemplateIdSchema,

              createdAt: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe(
                  'The date time when the note was created, represented with Unix timestamps in milliseconds. Omit it to keep the current value.'
                ),

              updatedAt: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe(
                  'The date time when the note was last updated, represented with Unix timestamps in milliseconds. Defaults to the current time.'
                )
            })
          )
          .min(1)
          .describe('The notes to update.')
      }
    },
    async ({ notes }) => {
      const settledUpdates = await Promise.allSettled(notes.map(updateNote))
      const results = settledUpdates.map((settledUpdate, noteIndex) =>
        settledUpdate.status === 'fulfilled'
          ? settledUpdate.value
          : {
              ok: false,
              id: notes[noteIndex]._id,
              error: (settledUpdate.reason as Error).message
            }
      )
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }
        ],
        isError: settledUpdates.some(settledUpdate => settledUpdate.status === 'rejected')
      }
    }
  )

  server.registerTool(
    'patch-note',
    {
      description:
        'Update the body of the existing note by performing one or more exact string replacements. Use this tool to make partial updates to the note body without replacing the entire content. You must first read the note with `read-note` to get the current body, then specify the exact substrings to replace. Edits are applied in order, each against the result of the previous one, and the note is only saved if all of them succeed.',
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

        edits: z
          .array(
            z.object({
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
            })
          )
          .min(1)
          .describe('The replacements to perform, applied in order.'),

        createdAt: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            'The date time when the note was created, represented with Unix timestamps in milliseconds. Omit it to keep the current value.'
          ),

        updatedAt: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            'The date time when the note was last updated, represented with Unix timestamps in milliseconds. Defaults to the current time.'
          )
      }
    },
    async ({ _id, _rev, edits, createdAt, updatedAt }) => {
      const existingNote = await fetchJSON<Note>(`/${_id}`, { rev: _rev })

      const patchResult = applyTextEdits(existingNote.body, edits)
      if (!patchResult.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to patch: ${patchResult.error} No edits were saved.`
            }
          ],
          isError: true
        }
      }

      const res = await postJSON('/notes', {
        ...existingNote,
        body: patchResult.text,
        createdAt: createdAt ?? existingNote.createdAt,
        updatedAt: updatedAt ?? +new Date()
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
