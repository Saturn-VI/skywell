import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";

const _fileViewSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("dev.skywell.defs#fileView"),
  ),
  blob: /*#__PURE__*/ v.blob(),
  createdAt: /*#__PURE__*/ v.datetimeString(),
  description: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(1),
      /*#__PURE__*/ v.stringGraphemes(0, 500),
    ]),
  ),
  name: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
    /*#__PURE__*/ v.stringGraphemes(1, 80),
  ]),
});
const _profileViewSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("dev.skywell.defs#profileView"),
  ),
  avatar: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.genericUriString()),
  did: /*#__PURE__*/ v.actorIdentifierString(),
  displayName: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 640),
      /*#__PURE__*/ v.stringGraphemes(0, 64),
    ]),
  ),
  fileCount: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
  handle: /*#__PURE__*/ v.handleString(),
});

type fileView$schematype = typeof _fileViewSchema;
type profileView$schematype = typeof _profileViewSchema;

export interface fileViewSchema extends fileView$schematype {}
export interface profileViewSchema extends profileView$schematype {}

export const fileViewSchema = _fileViewSchema as fileViewSchema;
export const profileViewSchema = _profileViewSchema as profileViewSchema;

export interface FileView extends v.InferInput<typeof fileViewSchema> {}
export interface ProfileView extends v.InferInput<typeof profileViewSchema> {}
