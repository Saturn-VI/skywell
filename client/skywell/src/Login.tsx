import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import {
  configureOAuth,
  createAuthorizationUrl,
  resolveFromIdentity,
} from "@atcute/oauth-browser-client";
import sleep from "sleep-promise";
import { toast } from "solid-toast";
import { getSkywellClient, trySignOut } from "./Auth.tsx";
import { DevSkywellIndexActorProfile } from "skywell";

configureOAuth({
  metadata: {
    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
  },
});

const [userHandle, setUserHandle] = createSignal<string>("");

async function runLoginFlow() {
  try {
    const { identity, metadata } = await toast.promise(
      resolveFromIdentity(userHandle()),
      {
        loading: "Resolving identity...",
        success: "Identity resolved!",
        error: "Failed to resolve identity",
      },
    );

    const authUrl = await createAuthorizationUrl({
      metadata: metadata,
      identity: identity,
      scope: import.meta.env.VITE_OAUTH_SCOPE,
    });

    toast.success("Redirecting to login...");
    trySignOut();
    await getSkywellClient().post(DevSkywellIndexActorProfile.mainSchema.nsid, {
      input: {
        actor: identity.id
      },
      as: null
    })
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
  } catch (error) {
    console.log("Login error:", error);
    toast.error("Invalid handle or login failed");
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
            name="handle"
            autocomplete="handle"
            value={userHandle()}
            onInput={(e) => {
              const value = e.target.value;
              const filteredValue = value.replace(/[^a-zA-Z0-9.-]/g, '');
              setUserHandle(filteredValue);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                runLoginFlow();
              }
            }}
          />
          <button
            onClick={() => runLoginFlow()}
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
