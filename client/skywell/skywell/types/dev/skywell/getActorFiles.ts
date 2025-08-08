import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as DevSkywellDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query("dev.skywell.getActorFiles", {
  params: /*#__PURE__*/ v.object({
    actor: /*#__PURE__*/ v.actorIdentifierString(),
    cursor: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
    limit: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.integer(), [
        /*#__PURE__*/ v.integerRange(1, 100),
      ]),
      50,
    ),
  }),
  output: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      get actor() {
        return DevSkywellDefs.profileViewSchema;
      },
      cursor: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      get files() {
        return /*#__PURE__*/ v.array(DevSkywellDefs.fileViewSchema);
      },
    }),
  },
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema["params"]> {}
export interface $output extends v.InferXRPCBodyInput<mainSchema["output"]> {}

declare module "@atcute/lexicons/ambient" {
  interface XRPCQueries {
    "dev.skywell.getActorFiles": mainSchema;
  }
}
