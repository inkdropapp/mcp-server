import { NOTE_DOCID_PREFIX, TAG_DOCID_PREFIX } from 'inkdrop-model'
import { z } from 'zod'

import { documentIdSchema, revisionSchema, timestampSchema } from '../../utils/document-fields.js'

const noteIdFormatSchema = documentIdSchema(NOTE_DOCID_PREFIX)

/** The ID of a note document. */
export const noteIdSchema = noteIdFormatSchema.describe(
  'The unique document ID which should start with `note:` and the remains are randomly generated string'
)

/** The revision a write must be based on. */
export const noteRevSchema = revisionSchema.describe(
  'This is a CouchDB specific field. The current MVCC-token/revision of this document (mandatory and immutable).'
)

/**
 * A notebook ID, or one of the `trash` and `template` pseudo-notebooks.
 * It has no description because each tool explains what `template` does there.
 */
export const noteBookIdSchema = z
  .string()
  .min(5)
  .max(128)
  .regex(/^(book:|trash$|template$)/)

/** The title of a note. */
export const noteTitleSchema = z.string().max(128).describe('The note title')

/** The Markdown body of a note. It has no description because each tool words it differently. */
export const noteBodySchema = z.string().max(1048576)

/** The task status of a note. */
export const noteStatusSchema = z
  .enum(['none', 'active', 'onHold', 'completed', 'dropped'])
  .describe('The status of the note')

/** The IDs of the tags assigned to a note. */
export const noteTagsSchema = z
  .array(documentIdSchema(TAG_DOCID_PREFIX))
  .describe(
    'An array of tag IDs to assign to the note. Call `list-tags` or `read-tag` to retrieve available tags. You can create a new tag with `create-tag` tool if necessary.'
  )

/** The creation time of a note, which a write keeps unless it is given. */
export const noteCreatedAtSchema = timestampSchema.describe(
  'The date time when the note was created, represented with Unix timestamps in milliseconds. Omit it to keep the current value.'
)

/** The last update time of a note, which a write sets to now unless it is given. */
export const noteUpdatedAtSchema = timestampSchema.describe(
  'The date time when the note was last updated, represented with Unix timestamps in milliseconds. Defaults to the current time.'
)

/**
 * The ID of the template a note was created from.
 * It has no description because each tool words it differently.
 */
export const sourceTemplateIdSchema = noteIdFormatSchema
