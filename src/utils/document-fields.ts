import { z } from 'zod'

/**
 * Builds the ID schema for one kind of Inkdrop document.
 *
 * @param idPrefix - The prefix every ID of that kind starts with, e.g. `note:`
 * @returns A schema that accepts an ID with that prefix, within the length Inkdrop allows
 */
export function documentIdSchema(idPrefix: string) {
  return z
    .string()
    .min(6)
    .max(128)
    .regex(new RegExp(`^${idPrefix}`))
}

/** A CouchDB revision token of a document. */
export const revisionSchema = z.string()

/** A point in time as a Unix timestamp in milliseconds. */
export const timestampSchema = z.number().int().nonnegative()
