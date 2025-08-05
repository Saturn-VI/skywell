import { getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { createSignal } from "solid-js";
import type { Did } from "@atcute/lexicons";
import {
  Client,
  FetchHandler,
  FetchHandlerObject,
  simpleFetchHandler,
} from "@atcute/client";

export const [did, setDid] = createSignal<Did | null>(null);
export const [agent, setAgent] = createSignal<OAuthUserAgent | null>(null);

export function getRPC(): Client {
  var hand: FetchHandler | FetchHandlerObject;
  if (agent() == null) {
    hand = simpleFetchHandler({
      service: "http://127.0.0.1:8080",
    });
  } else {
    hand = agent()!;
  }
  return new Client({ handler: hand });
}

export function getRelayRpc(): Client {
  return new Client({
    handler: simpleFetchHandler({
      service: "https://bsky.network",
    }),
  });
}
