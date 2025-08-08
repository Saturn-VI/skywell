import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as DevSkywellDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query("dev.skywell.getActorProfile", {
  params: /*#__PURE__*/ v.object({
    actor: /*#__PURE__*/ v.actorIdentifierString(),
  }),
  output: {
    type: "lex",
    get schema() {
      return DevSkywellDefs.profileViewSchema;
    },
  },
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema["params"]> {}
export type $output = v.InferXRPCBodyInput<mainSchema["output"]>;

declare module "@atcute/lexicons/ambient" {
  interface XRPCQueries {
    "dev.skywell.getActorProfile": mainSchema;
  }
}
