import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("dev.skywell.file"),
    blobRef: /*#__PURE__*/ v.blob(),
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
    slug: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
  }),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "dev.skywell.file": mainSchema;
  }
}
