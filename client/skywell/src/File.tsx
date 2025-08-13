import { createSignal, onMount, type Component } from "solid-js";
import { DevSkywellGetFileFromSlug } from "skywell";

import {
  getEntrywayClient,
  isLoggedIn,
  getAuthedClient,
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
import {
  ComAtprotoSyncGetBlob,
  ComAtprotoRepoDeleteRecord,
} from "@atcute/atproto";
import { parseResourceUri } from "@atcute/lexicons";

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

    // Check if current user created the file
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

async function clickDownloadLink() {
  const link = document.getElementById("download-link") as HTMLAnchorElement;
  if (blob() != null) {
    link.href = URL.createObjectURL(blob()!);
    link.click();
  }
}

async function deleteFile(uri: string, navigate: Navigator) {
  const result = parseResourceUri(uri);
  if (result.ok) {
    const c = await getAuthedClient();
    if (!c) {
      toast.error("Not authenticated, please log in");
      navigate("/login", { replace: true });
      return;
    }
    if (result.value.collection && result.value.rkey) {
      try {
        await toast.promise(
          c.post(ComAtprotoRepoDeleteRecord.mainSchema.nsid, {
            input: {
              repo: result.value.repo,
              collection: result.value.collection!,
              rkey: result.value.rkey!,
            },
          }),
          {
            loading: "Deleting file...",
            success: "File deleted successfully!",
            error: "Failed to delete file",
          },
        );
        navigate("/account", { replace: true });
      } catch (error) {
        console.error("Failed to delete file:", error);
        toast.error("Failed to delete file");
      }
    }
  } else {
    console.error("Invalid resource URI:", uri);
    toast.error("Invalid file URI");
    return;
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
    loadData(navigate, params)
  });

  return (
    <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
      <a id="download-link" download={filename()} class="hidden w-0 h-0" />
      <div class="flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 bg-gray-800 justify-between mb-4">
        {/* filename, author info, download button */}
        <div class="flex flex-col md:w-1/3 w-full h-full p-4 justify-center">
          {/* filename + author info */}
          <div class="sm:text-4xl text-3xl font-semibold truncate">{filename()}</div>
          <div class="sm:text-xl text-lg font-medium">
            uploaded {creationDate().toLocaleString()}
          </div>
          <div class="sm:text-xl text-lg font-medium">
            created by {author()}
          </div>
          <div class="sm:text-xl text-lg font-light">@{authorHandle()}</div>
        </div>
        <div class="flex justify-center items-center lg:w-1/4 md:w-5/8 w-full lg:h-full md:h-5/8 h-1/2 p-2 text-white">
          {/* download and delete buttons */}
          <div class="flex flex-col lg:w-2/3 w-1/2 h-full gap-2">
            <button
              onclick={clickDownloadLink}
              class="font-bold w-full flex-1 p-2 bg-blue-600 hover:bg-blue-700 text-center lg:text-xl text-lg"
            >
              download
            </button>
            {userLoggedIn() && isOwner() && (
              <button
                onclick={() => deleteFile(fileUri(), navigate)}
                class="font-bold w-full flex-1 p-2 bg-red-600 hover:bg-red-700 text-center lg:text-xl text-lg"
              >
                delete
              </button>
            )}
          </div>
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
