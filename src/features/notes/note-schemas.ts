import { z } from 'zod'

/** The optional link from a note to the template it was created from, shared by the note write tools. */
export const sourceTemplateIdSchema = z
  .string()
  .min(6)
  .max(128)
  .regex(/^note:/)
  .optional()
  .describe(
    'The ID of the template the note was created from, as returned by `list-templates`. It always starts with `note:`. Pass it to `create-note` when you create a note from a template, so that `read-note` can link the note back to its fill-out instructions.'
  )
