import {
  getSession,
  OAuthUserAgent,
} from "@atcute/oauth-browser-client";
import { createSignal, onMount } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import type { Did } from "@atcute/lexicons";
import {
  Client,
  simpleFetchHandler,
} from "@atcute/client";
import { toast } from "solid-toast";
import { XRPCProcedures, XRPCQueries } from "@atcute/lexicons/ambient";
import {
  ENTRYWAY_URL,
  SKYWELL_DID,
  SKYWELL_SERVICE_ID,
  SKYWELL_URL,
} from "./Constants.tsx";

export const [did, setDid] = makePersisted(createSignal<Did | null>(null));
export const [agent, setAgent] = createSignal<OAuthUserAgent | null>(null);

onMount(async () => {
  runAuthChecks();
});

export async function runAuthChecks() {
  if (did() == null) {
    trySignOut();
  } else {
    try {
      const session = await getSession(did()!, { allowStale: true });
      const newAgent = new OAuthUserAgent(session);
      setAgent(newAgent);
    } catch (error) {
      toast.error(`Failed while creating session: ${error}`);
      trySignOut();
    }
  }
}

export function trySignOut() {
  if (did() == null || agent() == null) {
    return;
  }
  toast.promise(
    (async () => {
      await agent()?.signOut();

      setDid(null);
      setAgent(null);
    })(),
    {
      success: "Signed out.",
      error: "Failed to sign out.",
      loading: "Signing out...",
    },
    {
      position: "top-center",
    },
  );
}

export async function isLoggedIn(): Promise<boolean> {
  await runAuthChecks();
  return did() != null && agent() != null;
}

export async function getAuthedClient(): Promise<Client<
  XRPCQueries,
  XRPCProcedures
> | null> {
  if (await isLoggedIn()) {
    if (agent()) {
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
  if (await isLoggedIn()) {
    if (agent()) {
      try {
        const c = new Client({
          handler: agent()!,
          proxy: {
            did: SKYWELL_DID,
            serviceId: SKYWELL_SERVICE_ID,
          },
        });
        return c;
      } catch (error) {
        console.error("Failed to create authed Skywell client:", error);
      }
    }
  }
  return null;
}

export function getSkywellClient(): Client {
  return new Client({
    handler: simpleFetchHandler({
      service: SKYWELL_URL,
    }),
  });
}

export function getEntrywayClient(): Client {
  return new Client({
    handler: simpleFetchHandler({
      service: ENTRYWAY_URL,
    }),
  });
}
