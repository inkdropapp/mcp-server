/**
 * Builds the canonical Inkdrop note URI for a note ID.
 *
 * The `note:` prefix is stripped so the result matches how note links are stored
 * in note bodies (`note:foobar` → `inkdrop://note/foobar`). Backlink searches rely
 * on this exact form to find notes that link to a given note.
 *
 * @param noteId - The note document ID, with or without the `note:` prefix
 * @returns The `inkdrop://note/<id>` URI
 */
export function getNoteUri(noteId: string): string {
  return `inkdrop://note/${noteId.replace(/^note:/, '')}`
}
