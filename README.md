## Inkdrop MCP Server

A [Model Context Protocol](https://github.com/modelcontextprotocol) server for the [Inkdrop Local HTTP Server API](https://developers.inkdrop.app/data-access/local-http-server).

<a href="https://glama.ai/mcp/servers/c7fgtnckbv">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/c7fgtnckbv/badge" alt="Inkdrop Server MCP server" />
</a>

## Installation

1. [Set up a local HTTP server](https://developers.inkdrop.app/guides/access-the-local-database#accessing-via-http-advanced)

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
2. **`search-notes`**: List all notes that contain a given keyword.
   - Required inputs:
     - `keyword`: Keyword to search for.
   - Note: Results include truncated note bodies (200 characters). Use `read-note` to get full content.
   - Supports advanced search qualifiers like `book:`, `tag:`, `status:`, `title:`, etc.
3. **`list-notes`**: List all notes with specified conditions.
   - Required inputs:
     - `bookId`: The notebook ID. It always starts with 'book:'.
   - Optional inputs:
     - `tagIds`: An array of tag IDs to filter. Each starts with 'tag:'.
     - `keyword`: Keyword to filter notes.
     - `sort`: Sort field (`updatedAt`, `createdAt`, or `title`). Default: `updatedAt`.
     - `descending`: Reverse the order of output. Default: `true`.
   - Note: Results include truncated note bodies (200 characters). Use `read-note` to get full content.
4. **`create-note`**: Create a new note in the database.
   - Required inputs:
     - `bookId`: The notebook ID. Must start with 'book:' or be 'trash'.
     - `title`: The note title.
     - `body`: The content of the note in Markdown.
   - Optional inputs:
     - `status`: The note status (`none`, `active`, `onHold`, `completed`, `dropped`).
     - `tags`: An array of tag IDs to assign to the note. Each must start with 'tag:'.
5. **`update-note`**: Update an existing note in the database.
   - Required inputs:
     - `_id`: The note ID. Must start with 'note:'.
     - `_rev`: The revision ID (CouchDB MVCC-token).
     - `bookId`: The notebook ID. Must start with 'book:' or be 'trash'.
     - `title`: The note title.
     - `body`: The content of the note in Markdown.
   - Optional inputs:
     - `status`: The note status (`none`, `active`, `onHold`, `completed`, `dropped`).
     - `tags`: An array of tag IDs to assign to the note. Each must start with 'tag:'.
6. **`list-notebooks`**: Retrieve a list of all notebooks.
7. **`read-book`**: Retrieve a single notebook by its ID.
   - Required inputs:
     - `bookId`: The notebook ID. Must start with 'book:'.
8. **`list-tags`**: Retrieve a list of all tags.
9. **`read-tag`**: Retrieve a single tag by its ID.
   - Required inputs:
     - `tagId`: The tag ID. Must start with 'tag:'.
10. **`create-tag`**: Create a new tag in the database.
    - Required inputs:
      - `name`: The name of the tag.
    - Optional inputs:
      - `color`: The color type of the tag (`default`, `red`, `orange`, `yellow`, `olive`, `green`, `teal`, `blue`, `violet`, `purple`, `pink`, `brown`, `grey`, `black`). Default: `default`.
11. **`update-tag`**: Update an existing tag in the database.
    - Required inputs:
      - `_id`: The tag ID. Must start with 'tag:'.
      - `_rev`: The revision ID (CouchDB MVCC-token).
      - `name`: The name of the tag.
    - Optional inputs:
      - `color`: The color type of the tag. Default: `default`.

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
