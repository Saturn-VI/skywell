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
  ServiceProxyOptions,
  simpleFetchHandler,
} from "@atcute/client";
import { toast } from "solid-toast";
import sleep from "sleep-promise";
import { XRPCProcedures, XRPCQueries } from "@atcute/lexicons/ambient";
import { ENTRYWAY_URL, SKYWELL_DID, SKYWELL_SERVICE_LABEL, SKYWELL_URL } from "./Constants.tsx";

export const [did, setDid] = makePersisted(createSignal<Did | null>(null));
export const [agent, setAgent] = makePersisted(
  createSignal<OAuthUserAgent | null>(null),
);

// onMount(async () => {
//   runAuthChecks();
// });

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

export async function getAuthedClient(): Promise<Client<
  XRPCQueries,
  XRPCProcedures
> | null> {
  if (isLoggedIn()) {
    if (agent()) {
      await sleep(5); // this is ridiculous but necessary
      return new Client({
        handler: agent()!,
      });
    }
  }
  return null;
}

export async function getAuthedSkywellClient(): Promise<Client<
  XRPCQueries,
  XRPCProcedures
> | null> {
  if (isLoggedIn()) {
    if (agent) {
      await sleep(5); // this is ridiculous but necessary
      console.log("here3")
      const p: ServiceProxyOptions = {
        did: SKYWELL_DID,
        serviceId: SKYWELL_SERVICE_LABEL,
      }
      console.log(p)
      const c = new Client({
        handler: agent()!,
        proxy: p
      });
      console.log(c)
      return c
    }
  }
  return null;
}

export function getSkywellRpc(): Client {
  return new Client({
    handler: simpleFetchHandler({
      service: SKYWELL_URL,
    }),
  });
}

export function getEntrywayRpc(): Client {
  return new Client({
    handler: simpleFetchHandler({
      service: ENTRYWAY_URL,
    }),
  });
}
