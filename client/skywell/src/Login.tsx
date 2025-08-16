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
const [isLoading, setIsLoading] = createSignal<boolean>(false);

async function runLoginFlow() {
  if (isLoading()) return;

  if (!userHandle().trim()) {
    toast.error("Please enter your handle");
    return;
  }

  setIsLoading(true);

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
        actor: identity.id,
      },
      as: null,
    });
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
  } finally {
    setIsLoading(false);
  }
}

const Login: Component = () => {
  return (
    <div class="flex flex-col w-full min-h-full text-ctp-text">
      <div class="px-6 pt-16 lg:pt-24 lg:pb-6 pb-2 text-center">
        <div class="max-w-md mx-auto">
          <h1 class="text-5xl font-bold mb-2">
            sign in
          </h1>
          <p class="text-lg text-ctp-subtext0 mb-8">
            use your existing Bluesky or AT Protocol account
          </p>
        </div>
      </div>

      <div class="px-6 pt-8 pb-16">
        <div class="max-w-md mx-auto">
          <div class="bg-ctp-surface1 rounded-lg shadow-lg p-8">
            <div class="space-y-6">
              <div>
                <label class="block text-lg font-medium mb-3 text-ctp-text">
                  your handle
                </label>
                <input
                  type="text"
                  class="w-full p-4 bg-ctp-surface0 text-ctp-text border-2 border-dashed border-ctp-overlay1 rounded-lg focus:border-ctp-blue transition-all duration-200 outline-hidden text-lg"
                  placeholder="you.bsky.social (no @)"
                  name="handle"
                  autocomplete="handle"
                  value={userHandle()}
                  disabled={isLoading()}
                  onBeforeInput={(e) => {
                    if (
                      e.data &&
                      e.data.length === 1 &&
                      !/^[a-zA-Z0-9.-]$/.test(e.data)
                    ) {
                      e.preventDefault();
                    }
                  }}
                  onInput={(e) => {
                    const value = e.target.value;
                    const filteredValue = value.replace(/[^a-zA-Z0-9.-]/g, "").trim();
                    setUserHandle(filteredValue);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading()) {
                      runLoginFlow();
                    }
                  }}
                />
                <p class="text-sm text-ctp-subtext0 mt-2">
                  if it's not working, try typing it in manually
                </p>
              </div>

              <button
                onClick={() => runLoginFlow()}
                disabled={isLoading() || !userHandle().trim()}
                class="cursor-pointer w-full py-4 px-6 bg-ctp-mauve hover:bg-ctp-blue disabled:bg-none disabled:bg-ctp-overlay1 disabled:cursor-not-allowed text-ctp-base font-semibold text-lg rounded-lg transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
              >
                {isLoading() ? "signing in..." : "sign in with atproto"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-16 text-center bg-ctp-surface1 md:rounded-lg">
        <div class="max-w-2xl mx-auto">
          <h2 class="text-2xl md:text-3xl font-bold mb-6">
            what is atproto?
          </h2>
          <p class="mb-6">
            atproto is the decentralized technology that powers Bluesky.
            by using your existing Bluesky account, you can access Skywell
            without creating any new passwords or accounts.
          </p>
          <a
            href="https://atproto.com/"
            target="_blank"
            rel="noopener external help"
            class="inline-block text-ctp-base bg-ctp-lavender hover:bg-ctp-sky px-6 py-3 rounded-lg font-semibold transition-colors duration-300"
          >
            learn more
          </a>
        </div>
      </div>

      <div class="px-6 py-16">
        <div class="max-w-2xl mx-auto text-center">
          <h3 class="text-xl font-semibold mb-4">
            don't have an account?
          </h3>
          <p class="text-ctp-subtext0 mb-6">
            you'll need an atproto account to use Skywell. create one with bluesky!
          </p>
          <a
            href="https://bsky.app"
            target="_blank"
            rel="noopener external help"
            class="inline-block text-ctp-base bg-ctp-lavender hover:bg-ctp-blue-600 px-6 py-3 rounded-lg font-semibold transition-colors duration-300"
          >
            create a Bluesky account
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
