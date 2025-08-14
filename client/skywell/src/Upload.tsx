import type { Component } from "solid-js";
import { createSignal, onMount } from "solid-js";
import { createDropzone } from "@solid-primitives/upload";
import { agent, getAuthedClient, isLoggedIn } from "./Auth.tsx";
import { useNavigate } from "@solidjs/router";
import { toast } from "solid-toast";
import {
  ComAtprotoRepoCreateRecord,
  ComAtprotoRepoUploadBlob,
} from "@atcute/atproto";
import { ClientResponse, isXRPCErrorPayload } from "@atcute/client";
import { Blob } from "@atcute/lexicons";
import { DevSkywellFile } from "skywell";
import mime from "mime";
import {
  fileCount,
  loadFiles,
  setFileCount,
} from "./Account.tsx";
import { filesize } from "filesize";

const Upload: Component = () => {
  const [isDragging, setIsDragging] = createSignal(false);
  const [currentFile, setCurrentFile] = createSignal<File | null>(null);
  const [fileName, setFileName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [isUploading, setIsUploading] = createSignal(false);
  const navigate = useNavigate();
  let fileInputRef: HTMLInputElement;

  const { setRef: dropzoneRef } = createDropzone({
    onDrop: () => {
      setIsDragging(false);
    },
  });

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      setCurrentFile(files[0]);
      setFileName(files[0].name);
    }
  };

  const openFileBrowser = () => {
    fileInputRef!.click();
  };

  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    if (files.length > 0) {
      setCurrentFile(files[0]);
      setFileName(files[0].name);
    }
  };

  const uploadFile = async () => {
    if (isUploading()) {
      toast.error("Already uploading a file (just give it time)");
      return;
    }
    setIsUploading(true);
    const c = await getAuthedClient();
    if (!c) {
      toast.error("Not authenticated, please log in");
      setIsUploading(false);
      navigate("/login", { replace: true });
      return;
    }
    let cfile;
    if (!currentFile()) {
      toast.error("No file selected");
      setIsUploading(false);
      return;
    } else {
      cfile = currentFile()!;
    }
    if (!fileName()) {
      toast.error("File name is required");
      setIsUploading(false);
      return;
    }
    const arraybuf = await cfile.arrayBuffer();
    if (!arraybuf) {
      toast.error("File data missing");
      setIsUploading(false);
      return;
    }

    let blobRes:
      | ClientResponse<
          ComAtprotoRepoUploadBlob.mainSchema,
          {
            input: ArrayBuffer;
            headers: {
              "Content-Type": string;
            };
          }
        >
      | undefined;

    try {
      await toast.promise(
        (async () => {
          blobRes = await c.post(ComAtprotoRepoUploadBlob.mainSchema.nsid, {
            input: arraybuf,
            headers: {
              "Content-Type":
                mime.getType(cfile.name) || "application/octet-stream",
            },
          });
          if (!blobRes.ok) {
            if (blobRes.data.error == "PayloadTooLarge") {
              setIsUploading(false);
              throw new Error("File is too large");
            }
            if (blobRes.data.error == "InternalServerError") {
              blobRes = await c.post(ComAtprotoRepoUploadBlob.mainSchema.nsid, {
                input: arraybuf,
                headers: {
                  "Content-Type": "application/octet-stream",
                },
              });
              if (!blobRes.ok) {
                if (blobRes.data.error == "InvalidMimeType") {
                  toast.error("MimeType error. Maybe the file already exists?");
                }
                console.error("Error uploading file:", blobRes);
                setIsUploading(false);
                throw new Error(`Error uploading file: ${blobRes.data.error}`);
              }
            }
          }
        })(),
        {
          success: "Blob uploaded!",
          error: "Blob failed to upload",
          loading: "Blob uploading...",
        },
      );
    } catch (error) {
      console.error("Error during blob upload:", error);
      setIsUploading(false);
      return;
    }

    if (!blobRes) {
      console.error("blobRes is null or undefined");
      toast.error("blob response is null");
      setIsUploading(false);
      return;
    }

    if (isXRPCErrorPayload(blobRes)) {
      console.error("Error uploading file:", blobRes);
      toast.error("Error uploading file");
      setIsUploading(false);
      return;
    }
    const blobRef = blobRes.data as { blob: Blob<string> };
    await toast.promise(
      (async () => {
        const record: DevSkywellFile.Main = {
          $type: "dev.skywell.file",
          name: fileName(),
          description: description().length ? description() : undefined,
          blobRef: blobRef.blob,
          createdAt: new Date().toISOString(),
        };
        const recordres = await c.post(
          ComAtprotoRepoCreateRecord.mainSchema.nsid,
          {
            input: {
              repo: agent()!.sub,
              collection: "dev.skywell.file",
              record: record,
            },
          },
        );
        if (!recordres.ok) {
          console.error("Error creating record:", recordres);
          if ((recordres.data.error = "InvalidMimeType")) {
            toast.error("Invalid mime type. Does the file already exist?");
          }
          setIsUploading(false);
          throw new Error(`Error creating record: ${recordres.data.error}`);
        }
      })(),
      {
        success: "Record created!",
        error: "Failed to create record",
        loading: "Creating record...",
      },
    );
    setIsUploading(false);
    loadFiles();
    setFileCount(fileCount() + 1);
    navigate("/account", { replace: true });
  };

  onMount(async () => {
    if (!(await isLoggedIn())) {
      console.log("Not logged in");
      toast.error("Not logged in, redirecting...");
      navigate("/login", { replace: true });
    }
  });

  return (
    <div class="flex flex-col w-full min-h-full bg-gray-700 text-white p-6">
      <div class="max-w-6xl mx-auto w-full">
        <h1 class="text-3xl md:text-4xl font-bold mb-8 text-center">
          upload file
        </h1>

        <div class="grid lg:grid-cols-2 gap-8">
          <div class="space-y-6">
            <div class="lg:hidden">
              <label class="block text-lg font-medium mb-2">
                select file
              </label>
              <input
                ref={fileInputRef!}
                type="file"
                id="fileUpload"
                class="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={openFileBrowser}
                class="w-full text-sm text-white bg-gray-800 hover:bg-gray-700 border border-gray-600 py-2 px-4 font-semibold rounded transition-colors duration-200"
              >
                choose file
              </button>
              {currentFile() ? (
                <p class="mt-2 text-gray-300 text-sm">
                  selected: {currentFile()?.name}
                </p>
              ) : (
                <p class="mt-2 text-gray-500 text-sm">no file selected</p>
              )}
            </div>

            <div>
              <label class="block text-lg font-medium mb-2">
                file name
              </label>
              <input
                maxlength="80"
                type="text"
                id="fileName"
                class="w-full p-3 bg-gray-800 text-white border border-gray-600 rounded focus:border-blue-500 transition-colors duration-200"
                value={fileName()}
                onInput={(e) => setFileName(e.target.value)}
                placeholder="enter file name..."
              />
            </div>

            <div>
              <label class="block text-lg font-medium mb-2">
                description
              </label>
              <textarea
                maxlength="500"
                id="description"
                rows="6"
                class="w-full p-3 bg-gray-800 text-white border border-gray-600 rounded focus:border-blue-500 transition-colors duration-200"
                value={description()}
                onInput={(e) => setDescription(e.target.value)}
                placeholder="optional description..."
              ></textarea>
            </div>

            <button
              class="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => uploadFile()}
              disabled={isUploading() || !currentFile() || !fileName()}
            >
              {isUploading() ? "uploading..." : "publish file"}
            </button>
          </div>

          <div class="hidden lg:block">
            <label class="block text-lg font-medium mb-2">
              drag & drop or click to select
            </label>
            <div
              ref={dropzoneRef}
              class={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
                ${isDragging()
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-750 hover:border-gray-500'
                }
              `}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFileBrowser}
            >
              <input
                ref={fileInputRef!}
                type="file"
                id="fileUpload"
                class="hidden"
                onChange={handleFileSelect}
              />

              {currentFile() ? (
                <div class="space-y-4">
                  <div class="text-4xl">📄</div>
                  <div>
                    <p class="text-lg font-medium text-white">
                      {currentFile()?.name}
                    </p>
                    <p class="text-gray-400 text-sm">
                      {filesize(currentFile()?.size || 0)}
                    </p>
                  </div>
                  <p class="text-sm text-gray-400">
                    click to choose a different file
                  </p>
                </div>
              ) : (
                <div class="space-y-4">
                  <div class="text-4xl text-gray-500">📁</div>
                  <div>
                    <p class="text-lg font-medium">
                      {isDragging() ? "drop your file here!" : "choose a file to upload"}
                    </p>
                    <p class="text-gray-400 text-sm">
                      drag and drop or click to browse
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
