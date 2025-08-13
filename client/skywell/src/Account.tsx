import { Component, createSignal, onMount } from "solid-js";
import {
  isLoggedIn,
  agent,
  did,
  getAuthedSkywellClient,
  getAuthedClient,
  getSkywellClient,
  trySignOut,
} from "./Auth.tsx";
import { toast } from "solid-toast";
import { useNavigate } from "@solidjs/router";
import {
  DevSkywellDefs,
  DevSkywellGetActorFiles,
  DevSkywellGetActorProfile,
} from "skywell";
import { Blob, parseResourceUri } from "@atcute/lexicons";
import { isXRPCErrorPayload } from "@atcute/client";

import { ComAtprotoRepoDeleteRecord } from "@atcute/atproto";
import { filesize } from "filesize";

const Account: Component = () => {
  const [handle, setHandle] = createSignal<string>("Loading...");
  const [displayName, setDisplayName] = createSignal<string>("Loading...");
  const [files, setFiles] = createSignal<DevSkywellDefs.FileView[]>([]);
  const [fileCount, setFileCount] = createSignal<number>(0);
  const [loading, setLoading] = createSignal(true);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [cursor, setCursor] = createSignal<string | undefined>(undefined);
  const [hasMore, setHasMore] = createSignal(true);
  const navigate = useNavigate();

  const loadFiles = async (loadMore = false) => {
    try {
      const currentAgent = agent();
      if (!currentAgent?.session) return;

      const userDid = currentAgent.session.info.sub;
      const skywellClient = await getAuthedSkywellClient();
      if (!skywellClient) return;

      const params: DevSkywellGetActorFiles.$params = {
        actor: userDid,
        limit: 50,
      };

      if (loadMore && cursor()) {
        params.cursor = cursor();
      }

      const flist = await skywellClient.get(
        DevSkywellGetActorFiles.mainSchema.nsid,
        { params },
      );

      if (isXRPCErrorPayload(flist.data)) {
        throw new Error("Failed to fetch user files");
      }

      const newFiles = (flist.data.files || []) as DevSkywellDefs.FileView[];

      if (loadMore) {
        setFiles((prev) => [...prev, ...newFiles]);
      } else {
        setFiles(newFiles);
      }

      setCursor(flist.data.cursor);
      setHasMore(newFiles.length >= 50);
    } catch (error) {
      console.error("Failed to load files:", error);
      if (!loadMore) {
        toast.error("Failed to load files");
      }
    }
  };

  const loadUserData = async (did: `did:${string}:${string}`) => {
    const skywellClient = getSkywellClient();
    const res = await skywellClient.get(
      DevSkywellGetActorProfile.mainSchema.nsid,
      {
        params: { actor: did },
      },
    );
    if (isXRPCErrorPayload(res.data)) {
      throw new Error("Failed to fetch user profile");
    }
    setHandle(res.data.handle);
    setDisplayName(res.data.displayName || handle());
    setFileCount(res.data.fileCount || 0);
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    const { scrollTop, scrollHeight, clientHeight } = target;

    // Load more when user scrolls to within 200px of the bottom
    if (
      scrollHeight - scrollTop - clientHeight < 200 &&
      hasMore() &&
      !loadingMore()
    ) {
      setLoadingMore(true);
      Promise.all([loadUserData(did()!), loadFiles()]).finally(() => {
        setLoadingMore(false);
      });
    }
  };

  const deleteFile = async (uri: string) => {
    const result = parseResourceUri(uri);
    if (result.ok) {
      const c = await getAuthedClient();
      if (!c) {
        // this shouldn't happen but whatever
        toast.error("Not authenticated, please log in");
        navigate("/login", { replace: true });
        return;
      }
      if (result.value.collection && result.value.rkey) {
        await toast.promise(
          (async () => {
            const res = await c.post(
              ComAtprotoRepoDeleteRecord.mainSchema.nsid,
              {
                input: {
                  repo: result.value.repo,
                  collection: result.value.collection!,
                  rkey: result.value.rkey!,
                },
              },
            );
            console.log(res);
            setFiles(files().filter((f) => f.uri !== uri));
            setFileCount(fileCount() - 1);
          })(),
          {
            loading: "Deleting file...",
            success: "File deleted successfully!",
            error: "Failed to delete file",
          },
        );
      }
    } else {
      console.error("Invalid resource URI:", uri);
      toast.error("Invalid file URI");
      return;
    }
  };

  onMount(async () => {
    if (!(await isLoggedIn())) {
      console.log("Not logged in");
      toast.error("Not logged in, redirecting...");
      navigate("/login", { replace: true });
      return;
    }

    try {
      const currentAgent = agent();
      if (currentAgent && currentAgent.session) {
        await toast.promise(
          (async () => {
            const userDid = currentAgent.session.info.sub;

            // Load user data and files parallelally (is that a word?)
            await Promise.all([loadUserData(userDid), loadFiles()]);
          })(),
          {
            loading: "Loading account data...",
            success: "Account data loaded successfully",
            error: "Failed to load account data",
          },
          {
            position: "top-center",
          },
        );
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
            onClick={() => {
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
          <div
            class="bg-gray-800 w-full overflow-y-auto max-h-full"
            onScroll={handleScroll}
          >
            {/* Files Header */}
            <div class="grid grid-cols-4 gap-4 p-4 border-b border-gray-600 font-semibold sticky top-0 bg-gray-800">
              <div>Name</div>
              <div>Date Uploaded</div>
              <div>Size</div>
              <div>Actions</div>
            </div>

            {/* Files List */}
            {files().map((file) => (
              <div class="grid grid-cols-4 gap-4 p-4 border-b border-gray-700 hover:bg-gray-700">
                <div class="font-medium md:text-base sm:text-sm text-xs wrap-anywhere">
                  {file.name}
                </div>
                <div class="text-gray-300 md:text-base sm:text-sm text-xs wrap-anywhere">
                  {new Date(file.createdAt).toLocaleDateString()}
                </div>
                <div class="text-gray-300 md:text-base sm:text-sm text-xs wrap-anywhere">
                  {filesize((file.blob as Blob).size)}
                </div>
                <div class="flex sm:space-x-2 sm:flex-row flex-col items-start justify-items-center space-y-1">
                  <a
                    href={`/file/${file.slug}`}
                    class="bg-blue-600 hover:bg-blue-700 px-3 py-1 md:text-base sm:text-sm text-xs font-medium wrap-anywhere"
                  >
                    View
                  </a>
                  <button
                    class="bg-red-600 hover:bg-red-700 px-3 py-1 md:text-base sm:text-sm text-xs font-medium wrap-anywhere"
                    onclick={() => {
                      deleteFile(file.uri);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {/* Loading More Indicator */}
            {loadingMore() && (
              <div class="flex items-center justify-center p-4">
                <p class="text-gray-400">Loading more files...</p>
              </div>
            )}

            {/* End of List Indicator */}
            {!hasMore() && files().length > 0 && (
              <div class="flex items-center justify-center p-4">
                <p class="text-gray-500 text-sm">No more files to load</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Account;
