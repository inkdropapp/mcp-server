import type { Note } from 'inkdrop-model'

import { fetchJSON, postJSON } from '../../client/local-server.js'

/** The fields to change on a note, with the ID and current revision that identify it. */
export type NoteUpdate = Partial<Note> & Pick<Note, '_id' | '_rev'>

/**
 * Merges the given fields into the stored note and saves it.
 *
 * @param noteUpdate - The note ID, its current revision, and the fields to change
 * @returns The response of the local server for the saved note
 * @throws If the note can't be fetched at that revision or the save is rejected
 */
export async function updateNote(noteUpdate: NoteUpdate) {
  const existingNote = await fetchJSON<Note>(`/${noteUpdate._id}`, { rev: noteUpdate._rev })

  return postJSON<{ ok: boolean; id: string; rev: string }>('/notes', {
    ...existingNote,
    ...noteUpdate,
    updatedAt: noteUpdate.updatedAt ?? +new Date()
  })
}
