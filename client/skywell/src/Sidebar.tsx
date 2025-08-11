import { createEffect, createSignal, onMount, type Component } from "solid-js";
import {
  agent,
  did,
  getAuthedSkywellClient,
  isLoggedIn,
} from "./Auth.tsx";
import { toast } from "solid-toast";
import { DevSkywellGetActorProfile } from "skywell";

const Sidebar: Component = () => {
  const [pfpUri, setPfpUri] = createSignal<string | null>(null);
  const [displayName, setDisplayName] = createSignal<string | null>(null);
  const [loggedIn, setLoggedIn] = createSignal<boolean>(false);
  const [loading, setLoading] = createSignal<boolean>(true);

  createEffect(async () => {
    if (await isLoggedIn()) {
      if (!loggedIn()) {
        setLoading(true);
        try {
          await doTheLoginThing();
        } catch (error) {
          console.error("Error during login:", error);
          toast.error("Failed to load user data");
        } finally {
          setLoading(false);
        }
      }
    } else {
      setLoggedIn(false);
      setPfpUri(null);
      setDisplayName(null);
      setLoading(false);
    }
  });

  const doTheLoginThing = async () => {
    try {
      const currentAgent = agent();
      if (currentAgent && currentAgent.session) {
        const c = await getAuthedSkywellClient();
        if (!c || !did()) {
          return;
        }
        const res = await c.get(DevSkywellGetActorProfile.mainSchema.nsid, {
          params: {
            actor: did()!,
          },
        });
        if (res.ok) {
          setPfpUri(res.data.avatar || null);
          setDisplayName(res.data.displayName || res.data.handle);
          setLoggedIn(true);
        }
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    if (!(await isLoggedIn())) {
      console.log("Not logged in");
      return;
    }

    await doTheLoginThing();
  });

  return (
    <div class="sm:w-1/12 items-center flex flex-col sm:visible invisible w-0 h-full bg-gray-800 text-white sm:p-4 p-0">
      {loading() ? (
        <div class="flex items-center justify-center h-full">
          <span class="text-gray-400">Loading...</span>
        </div>
      ) : loggedIn() ? (
        <>
          <a href="/account">
            {/* Profile Picture */}
            <img
              src={pfpUri() || "/default-avatar.png"}
              alt="Profile"
              class="w-16 h-16 object-cover mb-2"
            />

            {/* Display Name */}
            <span class="text-sm text-center mb-4 break-words">
              {displayName()}
            </span>
          </a>

          {/* Upload Link */}
          <a
            href="/upload"
            class="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Upload
          </a>
        </>
      ) : (
        <div class="text-center text-sm text-gray-400">
          <p>
            Please <a href="/login">log in</a> to access your profile.
          </p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
