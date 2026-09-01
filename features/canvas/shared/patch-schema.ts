import { z } from "zod";
import { IdSchema } from "./document-schema.js";

export const RevisionPatchSchema = z.object({
  pageId: IdSchema,
  fromRevision: z.number().int().nonnegative(),
  toRevision: z.number().int().positive(),
  changedObjectIds: z.array(IdSchema),
  changedAnnotationIds: z.array(IdSchema),
  writtenAt: z.string().datetime(),
});

export type RevisionPatch = z.infer<typeof RevisionPatchSchema>;
