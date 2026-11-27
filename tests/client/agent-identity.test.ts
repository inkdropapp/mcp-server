import { describe, expect, test } from 'bun:test'

import { AGENT_HEADERS } from 'inkdrop-consts'

import { buildAgentHeaders, workspaceNameFromRoot } from '../../src/client/agent-identity'

const SESSION_ID = '3f0c1c3e-6f0a-4d0e-9f5b-0a4f2d6f7b11'

describe('buildAgentHeaders', () => {
  test('sends only the session ID before the client is known', () => {
    expect(buildAgentHeaders({ sessionId: SESSION_ID })).toEqual({
      [AGENT_HEADERS.session]: SESSION_ID
    })
  })

  test('sends the client name, title, version and the workspace', () => {
    const headers = buildAgentHeaders({
      sessionId: SESSION_ID,
      client: { name: 'claude-code', title: 'Claude Code', version: '2.1.0' },
      workspace: 'inkdrop'
    })

    expect(headers).toEqual({
      [AGENT_HEADERS.session]: SESSION_ID,
      [AGENT_HEADERS.clientName]: 'claude-code',
      [AGENT_HEADERS.clientTitle]: 'Claude%20Code',
      [AGENT_HEADERS.clientVersion]: '2.1.0',
      [AGENT_HEADERS.workspace]: 'inkdrop'
    })
  })

  test('percent-encodes values that a header cannot carry as they are', () => {
    const headers = buildAgentHeaders({
      sessionId: SESSION_ID,
      client: { name: 'client', version: '1' },
      workspace: 'ノート\r\nInjected: 1'
    })

    expect(headers[AGENT_HEADERS.workspace]).toBe(encodeURIComponent('ノート\r\nInjected: 1'))
  })

  test('leaves out an empty value', () => {
    const headers = buildAgentHeaders({
      sessionId: SESSION_ID,
      client: { name: 'client', title: '', version: '1' }
    })

    expect(AGENT_HEADERS.clientTitle in headers).toBe(false)
  })

  test('cuts a long value', () => {
    const headers = buildAgentHeaders({
      sessionId: SESSION_ID,
      client: { name: 'a'.repeat(500), version: '1' }
    })

    expect(headers[AGENT_HEADERS.clientName]).toBe('a'.repeat(128))
  })

  test('cuts a long value in the middle of an emoji without throwing', () => {
    const headers = buildAgentHeaders({
      sessionId: SESSION_ID,
      workspace: `${'a'.repeat(127)}😀`
    })

    expect(headers[AGENT_HEADERS.workspace]).toBe(
      `${'a'.repeat(127)}${encodeURIComponent('\uFFFD')}`
    )
  })
})

describe('workspaceNameFromRoot', () => {
  test('prefers the name the client gives the root', () => {
    expect(workspaceNameFromRoot({ uri: 'file:///Users/me/dev/inkdrop', name: 'Inkdrop' })).toBe(
      'Inkdrop'
    )
  })

  test('falls back to the last folder of a file URI', () => {
    expect(workspaceNameFromRoot({ uri: 'file:///Users/me/dev/inkdrop' })).toBe('inkdrop')
  })

  test('ignores a trailing slash', () => {
    expect(workspaceNameFromRoot({ uri: 'file:///Users/me/dev/inkdrop/' })).toBe('inkdrop')
  })

  test('decodes an encoded folder name', () => {
    expect(workspaceNameFromRoot({ uri: 'file:///Users/me/my%20notes' })).toBe('my notes')
  })

  test('returns undefined for a URI with no folder', () => {
    expect(workspaceNameFromRoot({ uri: 'file:///' })).toBeUndefined()
  })

  test('returns undefined for a malformed URI', () => {
    expect(workspaceNameFromRoot({ uri: 'not a uri' })).toBeUndefined()
  })
})
