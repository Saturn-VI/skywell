import { createSignal, type Component } from "solid-js";
import {
  DevSkywellDefs,
  DevSkywellFile,
  DevSkywellGetActorFiles,
  DevSkywellGetActorProfile,
  DevSkywellGetUriFromSlug,
} from "skywell";

import logo from "./logo.svg";
import styles from "./App.module.css";

import Header from "./Header.tsx";
import Sidebar from "./Sidebar.tsx";
import { getRelayRpc, getRPC } from "./Auth.tsx";
import { type Params, useParams } from "@solidjs/router";
import { toast } from "solid-toast";
import { Client, isXRPCErrorPayload } from "@atcute/client";
import { ComAtprotoSyncGetBlob } from "@atcute/atproto";

async function loadData(params: Params, rpc: Client) {
  const data = await rpc.get(DevSkywellGetUriFromSlug.mainSchema.nsid, {
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
      return;
    }
    const fileData = data.data;
    setFilename(fileData.file.name);
    setAuthor(fileData.actor.displayName || fileData.actor.handle);
    setAuthorHandle(fileData.actor.handle);
    setDescription(fileData.file.description || "");
    fetchBlob(fileData.file.blob.ref.$link, fileData.actor.did);
  }
}

async function fetchBlob(cid: string, did: `did:${string}:${string}`) {
  const rpc = getRelayRpc();

  try {
    const data = await rpc.get(ComAtprotoSyncGetBlob.mainSchema.nsid, {
      params: {
        cid: cid,
        did: did,
      },
      as: 'blob',
    });

    if (data instanceof Error) {
      console.error("Error fetching blob:", data);
      toast.error("Failed to load file.");
      return;
    } else {
      setBlob(data.data as Blob);
    }
  } catch (error) {
    console.error("Error fetching blob:", error);
    toast.error("Failed to load file.");
  }
}

const [filename, setFilename] = createSignal<string>("Loading...");
const [author, setAuthor] = createSignal<string>("Loading...");
const [authorHandle, setAuthorHandle] = createSignal<string>("Loading...");
const [description, setDescription] = createSignal<string>("");
const [blob, setBlob] = createSignal<Blob | null>(null);

const File: Component = () => {
  const params = useParams();
  const rpc = getRPC();

  loadData(params, rpc);

  return (
    <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
      <div class="flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 bg-gray-800 justify-between mb-4">
        {/* filename, author info, download button */}
        <div class="flex flex-col md:w-1/3 w-full h-full p-4 justify-center">
          {/* filename + author info */}
          <div class="text-4xl font-semibold">{filename()}</div>
          <div class="text-xl font-medium">created by @{author()}</div>
          <div class="text-xl font-light">{authorHandle()}</div>
        </div>
        <div class="flex justify-center items-center lg:w-1/4 md:w-5/8 w-full lg:h-full md:h-5/8 h-1/2 p-2  text-white">
          {/* download button */}
          <button class="font-bold lg:w-2/3 w-1/2 md:h-2/3 h-full p-2 bg-blue-600 hover:bg-blue-700 text-center lg:text-2xl text-xl">
            download
          </button>
        </div>
      </div>
      <div class="flex w-full h-full">
        {/* description */}
        <div class="flex flex-col w-full h-full">
          <div class="mb-4">
            {/* description */}
            <textarea
              id="description"
              rows="6"
              class="lg:w-3/4 w-full p-2 bg-gray-800 text-white border border-gray-600 cursor-text"
              readonly
              disabled
            >
              {description()}
            </textarea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default File;
