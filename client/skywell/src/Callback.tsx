import {
  finalizeAuthorization,
  getSession,
  OAuthUserAgent,
} from "@atcute/oauth-browser-client";
import type { Component } from "solid-js";
import { agent, did, setAgent, setDid } from "./Auth.tsx";
import { toast } from "solid-toast";
import sleep from "sleep-promise";

if (did() == null) {
  agent()?.signOut();
} else {
  const session = await getSession(did()!, { allowStale: true });

  setAgent(new OAuthUserAgent(session));
}

async function runAuth() {
  const params = new URLSearchParams(location.hash.slice(1));

  // safety, prevent auth state from being replayed
  history.replaceState(null, "", location.pathname + location.search);

  try {
    const session = await finalizeAuthorization(params);

    setAgent(new OAuthUserAgent(session));

    setDid(agent()!.session.info.sub);

    toast.success("Successfully logged in, redirecting to home...");
    await sleep(1000);
    window.location.assign("/");
  } catch {
    toast.error("Missing URL parameters, redirecting to home...");

    await sleep(1000);

    window.location.assign("/");
    return;
  }
}

const Callback: Component = () => {
  runAuth();

  return (
    <div class="flex flex-col h-screen w-full">
      <div class="flex flex-row h-full">
        <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
          <div>Callback page. You should be redirected momentarily.</div>
        </div>
      </div>
    </div>
  );
};

export default Callback;
