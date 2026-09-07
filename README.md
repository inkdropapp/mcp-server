## Inkdrop MCP Server

A [Model Context Protocol](https://github.com/modelcontextprotocol) server for the [Inkdrop Local HTTP Server API](https://developers.inkdrop.app/data-access/local-http-server).

## Installation

1. [Set up a local HTTP server](https://developers.inkdrop.app/guides/integrate-with-external-programs)

2. Add server config to Claude Desktop:
   - MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "inkdrop": {
      "command": "npx",
      "args": ["-y", "@inkdropapp/mcp-server"],
      "env": {
        "INKDROP_LOCAL_SERVER_URL": "http://localhost:19840",
        "INKDROP_LOCAL_USERNAME": "your-local-server-username",
        "INKDROP_LOCAL_PASSWORD": "your-local-server-password"
      }
    }
  }
}
```

## Components

### Tools

1. **`read-note`**: Retrieve the complete contents of the note by its ID from the database.
   - Required inputs:
     - `noteId`: The ID of the note to retrieve. It can be found as `_id` in the note docs. It always starts with `note:`.
   - Optional inputs:
     - `includeTemplate`: When `true` and the note has a `sourceTemplateId`, also fetch that template and embed its body (fill-out instructions and examples) as an extra text block. Default: `false`.
   - Note: If the note was created from a template, the response includes a resource link to its source template, whose body holds the fill-out instructions and examples.
2. **`read-backlinks`**: Retrieve backlinks for a note — the notes that link to it.
   - Required inputs:
     - `noteId`: The ID of the note to find backlinks for. It always starts with `note:`.
   - Note: Each result is returned as a resource link (`inkdrop://note/<id>`) pointing to the referring note. Backlinks are found by searching all note bodies for the note's link URI.
3. **`search-notes`**: List all notes that contain a given keyword.
   - Required inputs:
     - `keyword`: Keyword to search for.
   - Note: Results include truncated note bodies (200 characters). Use `read-note` to get full content.
   - Supports advanced search qualifiers like `book:`, `tag:`, `status:`, `title:`, etc.
4. **`list-notes`**: List all notes with specified conditions.
   - Required inputs:
     - `bookId`: The notebook ID. It always starts with 'book:'.
   - Optional inputs:
     - `tagIds`: An array of tag IDs to filter. Each starts with 'tag:'.
     - `keyword`: Keyword to filter notes.
     - `sort`: Sort field (`updatedAt`, `createdAt`, or `title`). Default: `updatedAt`.
     - `descending`: Reverse the order of output. Default: `true`.
   - Note: Results include truncated note bodies (200 characters). Use `read-note` to get full content.
5. **`create-note`**: Create a new note in the database.
   - Required inputs:
     - `bookId`: The notebook ID. Must start with 'book:' or be 'trash'.
     - `title`: The note title.
     - `body`: The content of the note in Markdown.
   - Optional inputs:
     - `status`: The note status (`none`, `active`, `onHold`, `completed`, `dropped`).
     - `tags`: An array of tag IDs to assign to the note. Each must start with 'tag:'.
6. **`update-note`**: Update an existing note in the database. Only the fields you provide will be updated; omitted fields remain unchanged.
   - Required inputs:
     - `_id`: The note ID. Must start with 'note:'.
     - `_rev`: The revision ID (CouchDB MVCC-token).
   - Optional inputs:
     - `bookId`: The notebook ID. Must start with 'book:' or be 'trash'.
     - `title`: The note title.
     - `body`: The content of the note in Markdown.
     - `status`: The note status (`none`, `active`, `onHold`, `completed`, `dropped`).
     - `tags`: An array of tag IDs to assign to the note. Each must start with 'tag:'.
7. **`patch-note`**: Update the body of an existing note by performing an exact string replacement. More efficient than `update-note` for small edits to large notes as it saves tokens. You must first read the note with `read-note` to get the current body.
   - Required inputs:
     - `_id`: The note ID. Must start with 'note:'.
     - `_rev`: The revision ID (CouchDB MVCC-token).
     - `old_string`: The exact text to find in the note body. Must match exactly one occurrence. Include enough surrounding context to ensure a unique match.
     - `new_string`: The text to replace `old_string` with. Use an empty string to delete the matched text.
8. **`list-notebooks`**: Retrieve a list of all notebooks.
9. **`read-book`**: Retrieve a single notebook by its ID.
   - Required inputs:
     - `bookId`: The notebook ID. Must start with 'book:'.
10. **`create-book`**: Create a new notebook in the database.
    - Required inputs:
      - `name`: The notebook name.
    - Optional inputs:
      - `parentBookId`: The ID of the parent notebook. Must start with 'book:'. Omit it to create the notebook at the root level.
11. **`update-book`**: Update an existing notebook in the database. Only the fields you provide will be updated; omitted fields remain unchanged, so you don't need to read the notebook first.
    - Required inputs:
      - `_id`: The notebook ID. Must start with 'book:'.
    - Optional inputs:
      - `_rev`: The revision ID (CouchDB MVCC-token). Only needed as an optimistic-concurrency guard — pass it to make the update fail on a conflicting concurrent edit.
      - `name`: The notebook name.
      - `parentBookId`: The ID of the parent notebook. Pass `null` to move the notebook to the root level.
12. **`list-tags`**: Retrieve a list of all tags.
13. **`read-tag`**: Retrieve a single tag by its ID.
    - Required inputs:
      - `tagId`: The tag ID. Must start with 'tag:'.
14. **`create-tag`**: Create a new tag in the database.
    - Required inputs:
      - `name`: The name of the tag.
    - Optional inputs:
      - `color`: The color type of the tag (`default`, `red`, `orange`, `yellow`, `olive`, `green`, `teal`, `blue`, `violet`, `purple`, `pink`, `brown`, `grey`, `black`). Default: `default`.
15. **`update-tag`**: Update an existing tag in the database. Only the fields you provide will be updated; omitted fields remain unchanged, so you don't need to read the tag first.
    - Required inputs:
      - `_id`: The tag ID. Must start with 'tag:'.
    - Optional inputs:
      - `_rev`: The revision ID (CouchDB MVCC-token). Only needed as an optimistic-concurrency guard — pass it to make the update fail on a conflicting concurrent edit.
      - `name`: The name of the tag.
      - `color`: The color type of the tag. Omit it to keep the tag's current color.

## Debugging

Since MCP servers run over stdio, debugging can be challenging. For the best debugging
experience, we strongly recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

You can launch the MCP Inspector via [`npm`](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) with this command:

```bash
npx @modelcontextprotocol/inspector "./dist/index.js"
```

Be sure that environment variables are properly configured.

Upon launching, the Inspector will display a URL that you can access in your browser to begin debugging.

You can also watch the server logs with this command:

```bash
tail -n 20 -f ~/Library/Logs/Claude/mcp-server-inkdrop.log
```
