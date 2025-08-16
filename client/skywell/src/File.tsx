import { createSignal, onMount, type Component } from "solid-js";
import { DevSkywellGetFileFromSlug } from "skywell";

import {
  getEntrywayClient,
  isLoggedIn,
  agent,
  getSkywellClient,
} from "./Auth.tsx";
import {
  type Params,
  useParams,
  useNavigate,
  Navigator,
} from "@solidjs/router";
import { toast } from "solid-toast";
import { isXRPCErrorPayload } from "@atcute/client";
import { ComAtprotoSyncGetBlob } from "@atcute/atproto";
import { deleteFile } from "./Account.tsx";

async function loadData(navigate: Navigator, params: Params) {
  const client = getSkywellClient();
  const data = await client.get(DevSkywellGetFileFromSlug.mainSchema.nsid, {
    params: {
      slug: params.slug,
    },
  });
  if (data instanceof Error) {
    console.error("Error fetching file data:", data);
    toast.error("Failed to load file data.");
    return;
  } else {
    if (isXRPCErrorPayload(data.data)) {
      toast.error("File not found.");
      navigate("/", { replace: true });
      return;
    }
    const fileData = data.data;
    toast.promise(fetchBlob(fileData.file.blob.ref.$link, fileData.actor.did), {
      loading: "Loading blob data...",
      success: "Loaded blob data!",
      error: "Failed to load blob data.",
    });
    setFilename(fileData.file.name);
    setCreationDate(new Date(fileData.file.createdAt));
    setAuthor(fileData.actor.displayName || fileData.actor.handle);
    setAuthorHandle(fileData.actor.handle);
    setDescription(fileData.file.description || "");
    setFileUri(fileData.file.uri);

    const loggedIn = await isLoggedIn();
    setUserLoggedIn(loggedIn);
    if (loggedIn) {
      const currentAgent = agent();
      if (currentAgent?.session) {
        setIsOwner(currentAgent.session.info.sub === fileData.actor.did);
      }
    }
  }
}

async function fetchBlob(cid: string, did: `did:${string}:${string}`) {
  const client = getEntrywayClient();

  try {
    const data = await client.get(ComAtprotoSyncGetBlob.mainSchema.nsid, {
      params: {
        cid: cid,
        did: did,
      },
      as: "blob",
    });

    if (data instanceof Error) {
      console.error("Error fetching blob:", data);
      toast.error("Failed to load file.");
      return;
    } else {
      const b = data.data as Blob;
      console.log(b);
      setBlob(b);
    }
  } catch (error) {
    console.error("Error fetching blob:", error);
    toast.error("Failed to load file.");
  }
}

async function copyFileUrl() {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("File URL copied to clipboard!");
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    toast.error("Failed to copy URL");
  }
}

async function clickDownloadLink() {
  const link = document.getElementById("download-link") as HTMLAnchorElement;
  if (blob() != null) {
    link.href = URL.createObjectURL(blob()!);
    link.click();
  }
}

const [filename, setFilename] = createSignal<string>("Loading...");
const [creationDate, setCreationDate] = createSignal<Date>(new Date(0));
const [author, setAuthor] = createSignal<string>("Loading...");
const [authorHandle, setAuthorHandle] = createSignal<string>("Loading...");
const [description, setDescription] = createSignal<string>("");
const [blob, setBlob] = createSignal<Blob | null>(null);
const [fileUri, setFileUri] = createSignal<string>("");
const [userLoggedIn, setUserLoggedIn] = createSignal<boolean>(false);
const [isOwner, setIsOwner] = createSignal<boolean>(false);

const File: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  onMount(() => {
    loadData(navigate, params);
  });

  return (
    <div class="flex flex-col w-full min-h-full bg-ctp-base text-ctp-text p-6">
      <a id="download-link" download={filename()} class="hidden w-0 h-0" />

      <div class="max-w-4xl mx-auto w-full">
        <div class="bg-ctp-surface0 rounded-lg shadow-lg p-6 mb-6">
          <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div class="flex-1 min-w-0 max-w-full">
              <h1 class="text-3xl md:text-4xl font-bold mb-3 break-words truncate">
                {filename()}
              </h1>
              <div class="space-y-2 text-ctp-subtext1">
                <p class="text-lg">
                  uploaded {creationDate().toLocaleDateString()} at{" "}
                  {creationDate().toLocaleTimeString()}
                </p>
                <p class="text-lg">
                  created by{" "}
                  <span class="font-bold text-ctp-subtext1">{author()}</span>
                </p>
                <p class="text-ctp-subtext0">
                  <code>@{authorHandle()}</code>
                </p>
              </div>
            </div>

            <div class="text-ctp-base flex flex-col gap-3 w-full lg:w-auto">
              <button
                onclick={copyFileUrl}
                class="cursor-pointer bg-ctp-green hover:bg-ctp-green-700 px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
              >
                copy link
              </button>
              <button
                onclick={clickDownloadLink}
                class="cursor-pointer bg-ctp-blue hover:bg-ctp-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
              >
                download
              </button>
              {userLoggedIn() && isOwner() && (
                <button
                  onclick={() => {
                    navigate("/account");
                    if (
                      confirm(`are you sure you want to delete ${filename()}?`)
                    ) {
                      deleteFile(fileUri(), navigate);
                    }
                  }}
                  class="cursor-pointer bg-ctp-red hover:bg-ctp-red-700 px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
                >
                  delete
                </button>
              )}
            </div>
          </div>

          {description() ? (
            <div class="rounded-lg">
              <div class="bg-ctp-surface1 rounded-lg mt-4 p-4">
                <p class="text-ctp-text whitespace-pre-wrap leading-relaxed">
                  {description()}
                </p>
              </div>
            </div>
          ) : (
            <div class="rounded-lg">
              <p class="text-ctp-overlay1 text-center mt-4 italic">
                no description provided
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default File;
