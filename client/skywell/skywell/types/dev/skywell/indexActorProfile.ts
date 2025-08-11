import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.query("dev.skywell.indexActorProfile", {
  params: /*#__PURE__*/ v.object({
    actor: /*#__PURE__*/ v.actorIdentifierString(),
  }),
  output: null,
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema["params"]> {}

declare module "@atcute/lexicons/ambient" {
  interface XRPCQueries {
    "dev.skywell.indexActorProfile": mainSchema;
  }
}
