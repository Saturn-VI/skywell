import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.query("dev.skywell.getUriFromSlug", {
  params: /*#__PURE__*/ v.object({
    slug: /*#__PURE__*/ v.actorIdentifierString(),
  }),
  output: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      cid: /*#__PURE__*/ v.cidString(),
      did: /*#__PURE__*/ v.actorIdentifierString(),
      uri: /*#__PURE__*/ v.resourceUriString(),
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
    "dev.skywell.getUriFromSlug": mainSchema;
  }
}
