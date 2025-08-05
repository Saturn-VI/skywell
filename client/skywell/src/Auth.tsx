import {
  deleteStoredSession,
  getSession,
  OAuthUserAgent,
} from "@atcute/oauth-browser-client";
import { createSignal, onMount } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import type { Did } from "@atcute/lexicons";
import {
  Client,
  FetchHandler,
  FetchHandlerObject,
  simpleFetchHandler,
} from "@atcute/client";
import { toast } from "solid-toast";

export const [did, setDid] = makePersisted(createSignal<Did | null>(null));
export const [agent, setAgent] = makePersisted(
  createSignal<OAuthUserAgent | null>(null),
);

onMount(async () => {
  runAuthChecks();
});

async function runAuthChecks() {
  if (did() == null) {
    trySignOut();
  } else {
    try {
      const session = await getSession(did()!, { allowStale: true });
      setAgent(new OAuthUserAgent(session));
    } catch (error) {
      console.error("Failed to restore session:", error);
      toast.error("Failed to restore session, logging out.");
      trySignOut();
    }
  }
}

export function trySignOut() {
  try {
    agent()?.signOut();
  } catch (error) {
    console.error("Failed to sign out:", error);
  }
}

export function isLoggedIn(): boolean {
  return did() != null && agent() != null;
}

export function getRPC(): Client {
  var hand: FetchHandler | FetchHandlerObject;
  const currentAgent = agent();
  if (currentAgent != null && currentAgent.session != null) {
    hand = currentAgent;
  } else {
    hand = simpleFetchHandler({
      service: "https://bsky.social",
    });
  }
  return new Client({ handler: hand });
}

export function getSkywellRpc(): Client {
  return new Client({
    handler: simpleFetchHandler({
      service: "http://127.0.0.1:8080",
    }),
  });
}

export function getEntrywayRpc(): Client {
  return new Client({
    handler: simpleFetchHandler({
      service: "https://bsky.social",
    }),
  });
}
