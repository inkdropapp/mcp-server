## Inkdrop MCP Server

A [Model Context Protocol](https://github.com/modelcontextprotocol) server for the [Inkdrop Local HTTP Server API](https://developers.inkdrop.app/data-access/local-http-server).

> [!WARNING]
> This is highly experimental and use at your own risk.

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
      "args": [
        "-y",
        "@inkdropapp/mcp-server"
      ],
      "env": {
        "INKDROP_LOCAL_SERVER_URL": "http://localhost:19840",
        "INKDROP_LOCAL_USERNAME": "your-local-server-username"
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
     - `noteId`: The ID of the note to retrieve.
2. **`search-notes`**: List all notes that contain a given keyword.
   - Required inputs:
     - `keyword`: Keyword to search for.
3. **`create-note`**: Create a new note in the database
   - Required inputs:
     - `bookId`: The notebook ID
     - `title`: The note title
     - `body`: The content of the note in Markdown
   - Optional inputs:
     - `status`: The note status (`none`, `active`, `onHold`, `completed`, `dropped`)
4. **`update-note`**: Update the existing note in the database
   - Required inputs:
     - `_id`: The note ID
     - `_rev`: The revision ID
     - `bookId`: The notebook ID
     - `title`: The note title
     - `body`: The content of the note in Markdown
5. **`list-notebooks`**: Retrieve a list of all notebooks

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
