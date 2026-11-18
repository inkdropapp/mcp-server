export type TextEdit = {
  old_string: string
  new_string: string
}

export type ApplyTextEditsResult = { ok: true; text: string } | { ok: false; error: string }

/**
 * Applies exact string replacements in order, each against the result of the
 * previous one, so a later edit can match text an earlier edit produced.
 *
 * Every `old_string` must match exactly one location at the time it is applied.
 * Processing stops at the first edit that does not, so callers never see a
 * partially patched text.
 *
 * @param text - The text to patch
 * @param edits - The replacements to perform
 * @returns The patched text, or an error naming the 1-based position of the failing edit
 */
export function applyTextEdits(text: string, edits: TextEdit[]): ApplyTextEditsResult {
  let patchedText = text

  for (const [editIndex, { old_string, new_string }] of edits.entries()) {
    const editLabel = `edit ${editIndex + 1} of ${edits.length}`

    const firstMatchIndex = patchedText.indexOf(old_string)
    if (firstMatchIndex === -1) {
      return {
        ok: false,
        error: `\`old_string\` of ${editLabel} was not found in the note body.`
      }
    }

    if (patchedText.indexOf(old_string, firstMatchIndex + 1) !== -1) {
      return {
        ok: false,
        error: `\`old_string\` of ${editLabel} matches multiple locations in the note body. Provide more surrounding context to make it unique.`
      }
    }

    patchedText =
      patchedText.slice(0, firstMatchIndex) +
      new_string +
      patchedText.slice(firstMatchIndex + old_string.length)
  }

  return { ok: true, text: patchedText }
}
