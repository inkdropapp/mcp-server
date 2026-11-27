import type { Server } from '@modelcontextprotocol/sdk/server/index.js'

import { updateAgentIdentity, workspaceNameFromRoot } from './agent-identity.js'
import { sendAgentSessionSignal } from './local-server.js'

const HEARTBEAT_INTERVAL_MS = 60_000

async function readWorkspaceName(server: Server): Promise<string | undefined> {
  if (!server.getClientCapabilities()?.roots) {
    return undefined
  }
  try {
    const { roots } = await server.listRoots()
    const firstRoot = roots[0]
    return firstRoot ? workspaceNameFromRoot(firstRoot) : undefined
  } catch {
    return undefined
  }
}

async function handleInitialized(server: Server): Promise<void> {
  const client = server.getClientVersion()
  if (client) {
    updateAgentIdentity({
      client: { name: client.name, title: client.title, version: client.version }
    })
  }
  await sendAgentSessionSignal('POST')

  const workspace = await readWorkspaceName(server)
  if (workspace) {
    updateAgentIdentity({ workspace })
    await sendAgentSessionSignal('POST')
  }
}

/**
 * Tells the Inkdrop app when this agent session starts and ends, and that it is still alive in
 * between.
 *
 * Call it before the server connects to its transport. A signal that fails is dropped: the app may
 * not be running, or may be a version without agent sessions.
 *
 * @param server - The MCP server whose client is the agent
 * @param stdin - The stream whose end means the client has gone. A termination signal ends the
 *   session too, and then exits the process.
 */
export function trackAgentSession(server: Server, stdin: NodeJS.ReadableStream): void {
  server.oninitialized = () => {
    void handleInitialized(server)
  }

  const heartbeat = setInterval(() => {
    void sendAgentSessionSignal('POST')
  }, HEARTBEAT_INTERVAL_MS)
  heartbeat.unref()

  let ended = false
  const endSession = async () => {
    if (ended) {
      return
    }
    ended = true
    clearInterval(heartbeat)
    await sendAgentSessionSignal('DELETE')
  }

  stdin.once('end', () => void endSession())
  stdin.once('close', () => void endSession())
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void endSession().finally(() => process.exit(0))
    })
  }
}
