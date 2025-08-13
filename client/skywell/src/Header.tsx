import { Component, createEffect, createSignal, onMount } from "solid-js";
import { LoginOutlined, UploadFileOutlined } from "@suid/icons-material";
import {toast} from "solid-toast";
import { agent, did, getAuthedSkywellClient, isLoggedIn } from "./Auth.tsx";
import { DevSkywellGetActorProfile } from "skywell";

export const [pfpUri, setPfpUri] = createSignal<string | null>(null);
export const [displayName, setDisplayName] = createSignal<string | null>(null);
export const [loggedIn, setLoggedIn] = createSignal<boolean>(false);
export const [loading, setLoading] = createSignal<boolean>(true);

const Header: Component = () => {
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
    <div class=" w-full md:w-11/12 lg:w-3/4 xl:w-2/3 2xl:w-1/2 h-14 bg-gray-900 text-white p-4 items-center flex justify-between md:rounded-b-md">
      {loggedIn() &&
        <a href="/account" class="flex items-center w-1/3">
          <img src={pfpUri()!} alt="Logo" class="h-8 mr-4" />
          <div class="truncate">{displayName()}</div>
        </a>
      }
      <a href="/" style="font-family: 'Fredoka', sans-serif; font-weight: 400; font-stretch: 125%;" class="w-1/3 text-xl self-center text-center">skywell</a>
      <div class="w-1/3 text-right">
        {loggedIn() ? (
          <a href="/upload" class="bg-blue-500 px-4 py-2 hover:bg-blue-600">
            <UploadFileOutlined />
          </a>
        ) : (
          <a href="/login" class="bg-blue-500 px-4 py-2 hover:bg-blue-600">
            <LoginOutlined />
          </a>
        )
        }
      </div>
    </div>
  );
};

export default Header;
