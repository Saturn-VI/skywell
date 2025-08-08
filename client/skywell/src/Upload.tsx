import type { Component } from "solid-js";
import { createSignal, onMount } from "solid-js";
import { createDropzone } from "@solid-primitives/upload";
import { isLoggedIn } from "./Auth.tsx";
import { Navigate, redirect, useNavigate } from "@solidjs/router";
import { toast } from "solid-toast";

const Upload: Component = () => {
  const [isDragging, setIsDragging] = createSignal(false);
  const [currentFile, setCurrentFile] = createSignal<File | null>(null);
  const [fileName, setFileName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const navigate = useNavigate();
  let fileInputRef: HTMLInputElement;

  const { setRef: dropzoneRef, files: droppedFiles } = createDropzone({
    onDrop: async (files) => {
      setIsDragging(false);
    },
  });

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    if (!(e.currentTarget == (e.relatedTarget as Node))) {
      setIsDragging(true);
    } else {
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
    files.forEach((f) => console.log("dropped", f));
    if (files.length > 0) {
      setCurrentFile(files[0]);
      setFileName(files[0].name);
    } else {
      setCurrentFile(null);
    }
  };

  const handleDragEnd = (e: DragEvent) => {
    setIsDragging(false);
  };

  const handleDragExit = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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
    } else {
      setCurrentFile(null);
    }
  };

  const uploadFile = async () => {};

  const handleWindowBlur = () => {
    if (isDragging()) {
      setIsDragging(false);
    }
  };

  const handleDocumentDragLeave = (e: DragEvent) => {
    if (
      e.clientX <= 0 ||
      e.clientY <= 0 ||
      e.clientX >= window.innerWidth ||
      e.clientY >= window.innerHeight
    ) {
      setIsDragging(false);
    }
  };

  onMount(async () => {
    if (!(await isLoggedIn())) {
      console.log("Not logged in");
      toast.error("Not logged in, redirecting...");
      navigate("/login", { replace: true });
    }

    // Prevent default browser drag and drop behavior
    const preventDefaults = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // buttload of event listeners
    document.addEventListener("dragenter", preventDefaults);
    document.addEventListener("dragover", preventDefaults);
    document.addEventListener("drop", preventDefaults);
    window.addEventListener("dragend", handleDragEnd);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("dragleave", handleDocumentDragLeave);

    return () => {
      document.removeEventListener("dragenter", preventDefaults);
      document.removeEventListener("dragover", preventDefaults);
      document.removeEventListener("drop", preventDefaults);
      window.removeEventListener("dragend", handleDragEnd);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("dragleave", handleDocumentDragLeave);
    };
  });

  return (
    <div
      class="relative flex flex-col h-screen w-full"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnd={handleDragEnd}
      onDragExit={handleDragExit}
    >
      <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
        <div class="flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 bg-gray-800 justify-between">
          {/* text, upload button */}
          <button
            class="flex flex-col md:w-1/3 w-full h-full p-4 text-4xl font-semibold justify-center text-center md:text-left"
            onClick={(e) => uploadFile()}
          >
            upload file
          </button>
          <div class="flex justify-center items-center lg:w-1/4 md:w-5/8 w-full lg:h-full md:h-5/8 h-1/2 p-2 text-white">
            <button class="font-bold lg:w-2/3 w-1/2 md:h-2/3 h-full p-2 bg-blue-600 hover:bg-blue-700 text-center lg:text-2xl text-xl">
              publish
            </button>
          </div>
        </div>
        <div class="flex w-full h-full">
          {/* all the text inputs */}
          <div class="flex flex-col w-full h-full mt-4">
            <div class="mb-4">
              {/* file */}
              <label class="block text-lg w-fit font-medium mb-2 cursor-text">
                Upload File
              </label>
              {/* hidden file input */}
              <input
                ref={fileInputRef!}
                type="file"
                id="fileUpload"
                class="hidden"
                onChange={handleFileSelect}
              />
              {/* file browser button */}
              <button
                onClick={openFileBrowser}
                class="block w-fit text-sm text-white bg-gray-800 hover:bg-gray-700 border border-gray-600 py-2 px-4 font-semibold"
              >
                Choose File
              </button>
              <div>
                {currentFile() ? (
                  <p class="mt-2 text-gray-300">
                    Selected file: {currentFile()?.name}
                  </p>
                ) : (
                  <p class="mt-2 text-gray-500">No file selected</p>
                )}
              </div>
            </div>
            <div class="mb-4">
              {/* file name */}
              <label class="block text-lg w-fit font-medium mb-2 cursor-text">
                File Name
              </label>
              <input
                maxlength="80"
                type="text"
                id="fileName"
                class="lg:w-1/2 w-full p-2 bg-gray-800 text-white border border-gray-600"
                value={fileName()}
                onInput={(e) => setFileName(e.target.value)}
              />
            </div>
            <div class="mb-4">
              {/* description */}
              <label class="block text-lg w-fit font-medium mb-2 cursor-text">
                Description
              </label>
              <textarea
                maxlength="500"
                id="description"
                rows="6"
                class="lg:w-3/4 w-full p-2 bg-gray-800 text-white border border-gray-600"
                value={description()}
                onInput={(e) => setDescription(e.target.value)}
              ></textarea>
            </div>
          </div>
        </div>
        {/* appears when dragging files - positioned at root level */}
        {isDragging() && (
          <div
            ref={dropzoneRef}
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
          >
            <div class="text-center opacity-100">
              <p class="text-white text-4xl font-bold mb-2">Drop files here</p>
              <p class="text-gray-300 text-xl">Release to upload</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;
