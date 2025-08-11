import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import {
  AuthorizationServerMetadata,
  configureOAuth,
  createAuthorizationUrl,
  IdentityMetadata,
  resolveFromIdentity,
} from "@atcute/oauth-browser-client";
import sleep from "sleep-promise";
import { toast } from "solid-toast";
import { trySignOut } from "./Auth.tsx";

configureOAuth({
  metadata: {
    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
  },
});

const [userHandle, setUserHandle] = createSignal<string>("");

async function runLoginFlow() {
  try {
    toast.promise(
      (async () => {
        const { identity, metadata } = await resolveFromIdentity(userHandle());
      })(),
      {
        loading: "Resolving identity...",
        success: "Identity resolved!",
        error: "Failed to resolve identity",
      },
    );
    const { identity, metadata } = await resolveFromIdentity(userHandle());

    const authUrl = await createAuthorizationUrl({
      metadata: metadata,
      identity: identity,
      scope: import.meta.env.VITE_OAUTH_SCOPE,
    });

    toast.success("Redirecting to login...");
    await trySignOut();
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
    <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
      <div class="flex flex-col items-center justify-center h-full space-y-6">
        <div class="text-4xl font-semibold mb-8">Sign In</div>
        <div class="flex flex-col space-y-4 w-full max-w-md">
          <input
            type="text"
            class="p-3 bg-gray-800 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="you.bsky.social (no @)"
            name="username"
            autocomplete="username"
            value={userHandle()}
            onInput={(e) => setUserHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                runLoginFlow();
              }
            }}
          />
          <button
            onClick={(e) => runLoginFlow()}
            class="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
