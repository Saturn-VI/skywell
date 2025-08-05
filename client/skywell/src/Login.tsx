import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import {
  configureOAuth,
  createAuthorizationUrl,
  resolveFromIdentity,
} from "@atcute/oauth-browser-client";
import sleep from "sleep-promise";
import { toast } from "solid-toast";

configureOAuth({
  metadata: {
    client_id:
      "http://localhost?redirect_uri=http://127.0.0.1:3000/login/callback&scope=atproto transition:generic",
    redirect_uri: "http://127.0.0.1:3000/login/callback",
  },
});

const [userHandle, setUserHandle] = createSignal<string>("");

async function runLoginFlow() {
  try {
    const { identity, metadata } = await resolveFromIdentity(userHandle());

    const authUrl = await createAuthorizationUrl({
      metadata: metadata,
      identity: identity,
      scope: "atproto transition:generic",
    });

    toast.success("Redirecting to login...");
    await sleep(200);
    window.location.assign(authUrl);

    // from docs:
    // // if this is on an async function, ideally the function should never ever resolve.
    // // the only way it should resolve at this point is if the user aborted the authorization
    // // by returning back to this page (thanks to back-forward page caching)
    await new Promise((_resolve, reject) => {
      const listener = () => {
        toast.error("Login cancelled, probably.");
        reject(new Error(`user aborted the login request`));
      };

      window.addEventListener("pageshow", listener, { once: true });
    });
  } catch {
    console.log("Invalid handle, probably");
    toast.error("Invalid handle");
  }
}

const Login: Component = () => {
  return (
    <div class="flex flex-col h-screen">
      <div class="flex items">
        username
        <input
          type="text"
          class="bg-amber-100"
          value={userHandle()}
          onInput={(e) => setUserHandle(e.target.value)}
        />
        <button onClick={(e) => runLoginFlow()}>login</button>
      </div>
    </div>
  );
};

export default Login;
