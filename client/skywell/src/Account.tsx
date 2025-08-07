import { Component, createSignal, onMount } from "solid-js";
import {
  isLoggedIn,
  agent,
  did,
  getAuthedSkywellClient,
  getAuthedClient,
  trySignOut,
} from "./Auth.tsx";
import { toast } from "solid-toast";
import { Navigate, redirect, useNavigate } from "@solidjs/router";
import { getSkywellRpc } from "./Auth.tsx";
import { DevSkywellGetActorFiles, DevSkywellGetActorProfile } from "skywell";
import { isXRPCErrorPayload } from "@atcute/client";
import { ServiceProxyOptions } from "@atcute/client";
import { ComAtprotoServerGetServiceAuth } from "@atcute/atproto";
import { SKYWELL_DID } from "./Constants.tsx";

interface ListFile {
  name: string;
  createdAt: Date;
  size: number;
  slug: string;
}

const Account: Component = () => {
  const [handle, setHandle] = createSignal<string>("Loading...");
  const [displayName, setDisplayName] = createSignal<string>("Loading...");
  const [files, setFiles] = createSignal<any[]>([]);
  const [fileCount, setFileCount] = createSignal<number>(0);
  const [loading, setLoading] = createSignal(true);
  const navigate = useNavigate();

  onMount(async () => {
    if (!(await isLoggedIn())) {
      console.log("Not logged in");
      toast.error("Not logged in, redirecting...");
      navigate("/login", { replace: true });
    }

    try {
      const currentAgent = agent();
      if (currentAgent && currentAgent.session) {
        toast.promise(
          (async () => {
            const userDid = currentAgent.session.info.sub;

            const skywellRpc = getSkywellRpc();
            const res = await skywellRpc.get(
              DevSkywellGetActorProfile.mainSchema.nsid,
              {
                params: { actor: userDid },
              },
            );
            if (isXRPCErrorPayload(res.data)) {
              throw new Error("Failed to fetch user profile");
            }
            setHandle(res.data.handle);
            setDisplayName(res.data.displayName || handle());
            setFileCount(res.data.fileCount || 0);
            console.log("here");

            const skywellClient = await getAuthedSkywellClient();
            if (!skywellClient) return;
            console.log(skywellClient);
            console.log(skywellClient.proxy);
            const flist = await skywellClient.get(
              DevSkywellGetActorFiles.mainSchema.nsid,
              {
                params: { actor: userDid },
              },
            );
            if (isXRPCErrorPayload(res.data)) {
              throw new Error("Failed to fetch user files");
            }
          })(),
          {
            loading: "Loading account data...",
            success: "Account data loaded successfully!",
            error: "Failed to load account data",
          },
          {
            position: "top-center",
          },
        );
        setFiles([
          {
            name: "example-file.pdf",
            createdAt: "2024-01-15",
            size: "2.5 MB",
            slug: "abc123",
          },
          {
            name: "document.docx",
            createdAt: "2024-01-10",
            size: "1.2 MB",
            slug: "def456",
          },
          {
            name: "image.png",
            createdAt: "2024-01-05",
            size: "500 KB",
            slug: "ghi789",
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to load account data:", error);
      toast.error("Failed to load account data");
    } finally {
      setLoading(false);
    }
  });

  return (
    <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
      {/* User Info Section */}
      <div class="flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 bg-gray-800 justify-between mb-4">
        <div class="flex flex-col md:w-2/3 w-full h-full p-4 justify-center">
          <div class="sm:text-4xl text-3xl font-semibold mb-2">
            {displayName()}
          </div>
          <div class="sm:text-xl text-lg font-medium text-gray-300">
            @{handle()}
          </div>
          <div class="sm:text-lg text-base font-light text-gray-400 mt-2">
            {fileCount()} file{fileCount() != 1 ? "s" : ""} uploaded
          </div>
        </div>
        <div class="flex justify-center items-center lg:w-1/4 md:w-1/3 w-full lg:h-full md:h-2/3 h-1/2 p-2">
          <button
            class="font-bold lg:w-2/3 w-1/2 md:h-2/3 h-full p-2 bg-red-600 hover:bg-red-700 text-center lg:text-xl text-lg"
            onClick={(e) => {
              trySignOut();
              navigate("/");
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Files Section */}
      <div class="flex flex-col w-full h-full">
        <div class="text-2xl font-semibold mb-4">Your Files</div>

        {loading() ? (
          <div class="flex items-center justify-center h-32">
            <p class="text-xl text-gray-400">Loading files...</p>
          </div>
        ) : files().length === 0 ? (
          <div class="flex flex-col items-center justify-center h-32">
            <p class="text-xl text-gray-400 mb-4">No files uploaded yet</p>
            <a
              href="/upload"
              class="bg-blue-600 hover:bg-blue-700 px-4 py-2 font-semibold"
            >
              upload a file
            </a>
          </div>
        ) : (
          <div class="bg-gray-800 w-full">
            {/* Files Header */}
            <div class="grid grid-cols-4 gap-4 p-4 border-b border-gray-600 font-semibold">
              <div>Name</div>
              <div>Date Uploaded</div>
              <div>Size</div>
              <div>Actions</div>
            </div>

            {/* Files List */}
            {files().map((file) => (
              <div class="grid grid-cols-4 gap-4 p-4 border-b border-gray-700 hover:bg-gray-700">
                <div class="font-medium">{file.name}</div>
                <div class="text-gray-300">
                  {new Date(file.createdAt).toLocaleDateString()}
                </div>
                <div class="text-gray-300">{file.size}</div>
                <div class="flex space-x-2">
                  <a
                    href={`/file/${file.slug}`}
                    class="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-sm font-medium"
                  >
                    View
                  </a>
                  <button class="bg-red-600 hover:bg-red-700 px-3 py-1 text-sm font-medium">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Account;
