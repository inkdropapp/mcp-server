import { randomUUID } from 'node:crypto'

import { AGENT_HEADERS } from 'inkdrop-consts'

const MAX_VALUE_LENGTH = 128

export type AgentClient = {
  name: string
  title?: string
  version?: string
}

export type AgentIdentity = {
  sessionId: string
  client?: AgentClient
  /** A display name of the folder the client works in. */
  workspace?: string
}

type Root = { uri: string; name?: string }

function encodeHeaderValue(value: string): string {
  return encodeURIComponent(value.slice(0, MAX_VALUE_LENGTH).toWellFormed())
}

/**
 * Builds the identity headers of a request.
 *
 * Each value is cut to 128 UTF-16 code units and percent-encoded, since a header value cannot carry
 * line breaks or characters outside Latin-1.
 */
export function buildAgentHeaders(identity: AgentIdentity): Record<string, string> {
  const values: Array<[string, string | undefined]> = [
    [AGENT_HEADERS.session, identity.sessionId],
    [AGENT_HEADERS.clientName, identity.client?.name],
    [AGENT_HEADERS.clientTitle, identity.client?.title],
    [AGENT_HEADERS.clientVersion, identity.client?.version],
    [AGENT_HEADERS.workspace, identity.workspace]
  ]
  return Object.fromEntries(
    values.flatMap(([header, value]) => (value ? [[header, encodeHeaderValue(value)]] : []))
  )
}

/**
 * Picks a display name for an MCP root: the name the client gave it, or the last folder of its URI.
 *
 * @returns `undefined` when the URI is malformed or names no folder
 */
export function workspaceNameFromRoot(root: Root): string | undefined {
  if (root.name) {
    return root.name
  }
  if (!URL.canParse(root.uri)) {
    return undefined
  }
  const lastSegment = new URL(root.uri).pathname.split('/').findLast(segment => segment !== '')
  return lastSegment ? decodeURIComponent(lastSegment) : undefined
}

let currentIdentity: AgentIdentity = { sessionId: randomUUID() }

export function getAgentIdentity(): AgentIdentity {
  return currentIdentity
}

/** Adds what the MCP handshake told about the client to the identity of this process. */
export function updateAgentIdentity(update: Pick<AgentIdentity, 'client' | 'workspace'>): void {
  currentIdentity = { ...currentIdentity, ...update }
}
