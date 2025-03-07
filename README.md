## Inkdrop MCP Server

A [Model Context Protocol](https://github.com/modelcontextprotocol) server for the [Linear API](https://developers.linear.app/docs/graphql/working-with-the-graphql-api).

This server provides integration with Linear's issue tracking system through MCP, allowing LLMs to interact with Linear issues.

## Installation

1. [Set up a local HTTP server]( [https://linear.app/YOUR-TEAM/settings/api](https://linear.app/YOUR-TEAM/settings/api))

2. Add server config to Claude Desktop:
   - MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": [
        "-y",
        "inkdrop-mcp-server"
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
