import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as DevSkywellDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query("dev.skywell.getUriFromSlug", {
  params: /*#__PURE__*/ v.object({
    slug: /*#__PURE__*/ v.string(),
  }),
  output: {
    type: "lex",
    schema: /*#__PURE__*/ v.object({
      get actor() {
        return DevSkywellDefs.profileViewSchema;
      },
      cid: /*#__PURE__*/ v.cidString(),
      get file() {
        return DevSkywellDefs.fileViewSchema;
      },
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
