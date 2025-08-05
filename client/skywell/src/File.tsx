import { createSignal, type Component } from "solid-js";
import {
  DevSkywellDefs,
  DevSkywellFile,
  DevSkywellGetActorFiles,
  DevSkywellGetActorProfile,
  DevSkywellGetFileFromSlug,
} from "skywell";

import logo from "./logo.svg";
import styles from "./App.module.css";

import Header from "./Header.tsx";
import Sidebar from "./Sidebar.tsx";
import { getEntrywayRpc, getRPC } from "./Auth.tsx";
import { type Params, useParams } from "@solidjs/router";
import { toast } from "solid-toast";
import { Client, isXRPCErrorPayload } from "@atcute/client";
import { ComAtprotoSyncGetBlob } from "@atcute/atproto";

async function loadData(params: Params, rpc: Client) {
  const data = await rpc.get(DevSkywellGetFileFromSlug.mainSchema.nsid, {
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
  }
}

async function fetchBlob(cid: string, did: `did:${string}:${string}`) {
  const rpc = getEntrywayRpc();

  try {
    const data = await rpc.get(ComAtprotoSyncGetBlob.mainSchema.nsid, {
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
      let b = data.data as Blob;
      console.log(b)
      setBlob(b);
    }
  } catch (error) {
    console.error("Error fetching blob:", error);
    toast.error("Failed to load file.");
  }
}

async function clickDownloadLink() {
  let link = document.getElementById("download-link") as HTMLAnchorElement;
  if (blob() != null) {
    link.href = URL.createObjectURL(blob()!)
    link.click();
  }
}

const [filename, setFilename] = createSignal<string>("Loading...");
const [creationDate, setCreationDate] = createSignal<Date>(new Date(0));
const [author, setAuthor] = createSignal<string>("Loading...");
const [authorHandle, setAuthorHandle] = createSignal<string>("Loading...");
const [description, setDescription] = createSignal<string>("");
const [blob, setBlob] = createSignal<Blob | null>(null);

const File: Component = () => {
  const params = useParams();
  const rpc = getRPC();

  toast.promise(
    loadData(params, rpc),
    {
      loading: "Loading file data...",
      success: "Loaded file data!",
      error: "Failed to load file data.",
    },
    {
      position: "top-center",
    },
  );

  return (
    <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
      <a
        id="download-link"
        download={filename()}
        class="hidden w-0 h-0"
      />
      <div class="flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 bg-gray-800 justify-between mb-4">
        {/* filename, author info, download button */}
        <div class="flex flex-col md:w-1/3 w-full h-full p-4 justify-center">
          {/* filename + author info */}
          <div class="sm:text-4xl text-3xl font-semibold">{filename()}</div>
          <div class="sm:text-xl text-lg font-medium">
            uploaded {creationDate().toLocaleString()}
          </div>
          <div class="sm:text-xl text-lg font-medium">created by {author()}</div>
          <div class="sm:text-xl text-lg font-light">@{authorHandle()}</div>
        </div>
        <div class="flex justify-center items-center lg:w-1/4 md:w-5/8 w-full lg:h-full md:h-5/8 h-1/2 p-2  text-white">
          {/* download button */}
          <button
            onclick={clickDownloadLink}
            class="font-bold lg:w-2/3 w-1/2 md:h-2/3 h-full p-2 bg-blue-600 hover:bg-blue-700 text-center lg:text-2xl text-xl"
          >
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
