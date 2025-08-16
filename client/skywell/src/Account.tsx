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
import { Navigator, useNavigate } from "@solidjs/router";
import {
  DevSkywellDefs,
  DevSkywellGetActorFiles,
  DevSkywellGetActorProfile,
} from "skywell";
import { Blob, parseResourceUri } from "@atcute/lexicons";
import { isXRPCErrorPayload } from "@atcute/client";

import { ComAtprotoRepoDeleteRecord } from "@atcute/atproto";
import { filesize } from "filesize";
import { pfpUri } from "./Header.tsx";

const [handle, setHandle] = createSignal<string>("Loading...");
const [displayName, setDisplayName] = createSignal<string>("Loading...");
const [files, setFiles] = createSignal<DevSkywellDefs.FileView[]>([]);
export const [fileCount, setFileCount] = createSignal<number>(0);
const [loading, setLoading] = createSignal(true);
const [loadingMore, setLoadingMore] = createSignal(false);
const [cursor, setCursor] = createSignal<string | undefined>(undefined);
const [hasMore, setHasMore] = createSignal(true);

export const loadFiles = async (loadMore = false) => {
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

export const loadUserData = async (did: `did:${string}:${string}`) => {
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

export const deleteFile = async (uri: string, navigate: Navigator) => {
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
          const res = await c.post(ComAtprotoRepoDeleteRecord.mainSchema.nsid, {
            input: {
              repo: result.value.repo,
              collection: result.value.collection!,
              rkey: result.value.rkey!,
            },
          });
          console.log(res);
          // allow deletion to propagate to server
          setTimeout(() => {
            loadFiles(false);
            loadUserData(did()!);
          }, 250);
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

const Account: Component = () => {
  const navigate = useNavigate();

  const copyFileUrl = async (slug: string) => {
    const url = `${window.location.origin}/file/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("File URL copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast.error("Failed to copy URL");
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
            success: "Account data loaded successfully!",
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
    <div class="flex flex-col w-full h-full bg-ctp-base text-ctp-text p-6">
      <div class="bg-ctp-surface0 text-ctp-text flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 justify-between mb-6 rounded-lg shadow-lg">
        <img src={pfpUri()!} alt="Profile picture" class="rounded-full w-24 h-24 md:w-32 md:h-32 m-6 mr-0 mb-0 md:mb-6" />
        <div class="flex flex-col md:w-2/3 w-full h-full p-6 justify-center">
          <div class="sm:text-4xl text-3xl font-semibold mb-2">
            {displayName()}
          </div>
          <div class="sm:text-xl text-lg font-medium">
            @{handle()}
          </div>
          <div class="sm:text-lg text-base font-normal mt-2">
            {fileCount()} file{fileCount() != 1 ? "s" : ""} uploaded
          </div>
        </div>
        <div class="flex justify-center items-center lg:w-1/4 md:w-1/3 w-full lg:h-full md:h-2/3 h-1/2 p-4">
          <button
            class="cursor-pointer text-ctp-surface0 font-bold lg:w-2/3 w-1/2 md:h-2/3 h-full p-2 bg-ctp-red hover:bg-ctp-red-700 text-center lg:text-xl text-lg rounded-md transition-colors duration-200"
            onClick={() => {
              trySignOut();
              navigate("/");
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <div class="flex flex-col w-full h-full">
        <div class="text-2xl font-semibold mb-6">Your Files</div>

        {loading() ? (
          <div class="bg-ctp-surface0 text-ctp-text flex items-center justify-center h-32 rounded-lg">
            <p class="text-xl">Loading files...</p>
          </div>
        ) : files().length === 0 ? (
          <div class="bg-ctp-surface0 text-ctp-text flex flex-col items-center justify-center h-32 rounded-lg">
            <p class="text-xl mb-4">No files uploaded yet</p>
            <a
              href="/upload"
              class="text-ctp-base bg-ctp-blue hover:bg-ctp-blue-700 px-4 py-2 font-semibold rounded-md transition-colors duration-200"
            >
              upload a file
            </a>
          </div>
        ) : (
          <div
            class="bg-ctp-surface0 text-ctp-text w-full overflow-y-auto max-h-full rounded-lg shadow-lg"
            onScroll={handleScroll}
          >
            <div class="grid grid-cols-12 gap-4 p-4 border-b border-ctp-overlay2 font-semibold sticky top-0">
              <div class="col-span-3">Name</div>
              <div class="col-span-3">Date Uploaded</div>
              <div class="col-span-2">Size</div>
              <div class="col-span-4">Actions</div>
            </div>

            {files().map((file) => (
              <div class="grid grid-cols-12 gap-4 p-4 border-b sm:border-0 border-ctp-text hover:bg-ctp-surface2 transition-colors duration-150 items-center">
                <div class="col-span-3 font-medium md:text-base sm:text-sm text-xs wrap-anywhere">
                  {file.name}
                </div>
                <div class="col-span-3 md:text-base sm:text-sm text-xs wrap-anywhere">
                  {new Date(file.createdAt).toLocaleDateString()}
                </div>
                <div class="col-span-2 md:text-base sm:text-sm text-xs wrap-anywhere">
                  {filesize((file.blob as Blob).size)}
                </div>
                <div class="text-ctp-base col-span-4 flex sm:space-x-2 sm:flex-row flex-col items-center justify-items-center sm:space-y-0 space-y-1">
                  <button
                    class="cursor-pointer bg-ctp-green hover:bg-ctp-green-700 px-3 py-1 xl:text-base md:text-sm text-xs font-medium wrap-anywhere rounded transition-colors duration-200"
                    onclick={() => {
                      copyFileUrl(file.slug);
                    }}
                  >
                    Copy
                  </button>
                  <a
                    href={`/file/${file.slug}`}
                    class="cursor-pointer bg-ctp-blue hover:bg-ctp-blue-700 px-3 py-1 xl:text-base md:text-sm text-xs font-medium wrap-anywhere rounded transition-colors duration-200"
                  >
                    View
                  </a>
                  <button
                    class="cursor-pointer bg-ctp-red hover:bg-ctp-red-700 px-3 py-1 xl:text-base md:text-sm text-xs font-medium wrap-anywhere rounded transition-colors duration-200"
                    onclick={() => {
                      if (
                        confirm(`are you sure you want to delete ${file.name}?`)
                      ) {
                        deleteFile(file.uri, navigate);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {loadingMore() && (
              <div class="flex items-center justify-center p-4">
                <p class="text-ctp-subtext1">Loading more files...</p>
              </div>
            )}

            {!hasMore() && files().length > 0 && (
              <div class="border-t border-ctp-overlay2 flex items-center justify-center p-4">
                <p class="text-ctp-overlay2 text-sm">No more files to load</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Account;
