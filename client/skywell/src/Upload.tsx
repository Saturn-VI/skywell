import type { Component } from "solid-js";
import type {
  DevSkywellDefs,
  DevSkywellFile,
  DevSkywellGetActorFiles,
  DevSkywellGetActorProfile,
} from "skywell";

import logo from "./logo.svg";
import styles from "./App.module.css";

import Header from "./Header.tsx";
import Sidebar from "./Sidebar.tsx";

const Upload: Component = () => {
  return (
    <div class="flex flex-col h-screen">
      <Header></Header>
      <div class="flex flex-row h-full">
        <Sidebar></Sidebar>
        <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
          <div class="flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 bg-gray-800 justify-between">
            {/* text, upload button */}
            <div class="flex flex-col md:w-1/3 w-full h-full p-4 text-4xl font-semibold justify-center text-center md:text-left">
              {/* text */}
              upload file
            </div>
            <div class="flex justify-center items-center lg:w-1/4 md:w-5/8 w-full lg:h-full md:h-5/8 h-1/2 p-2  text-white">
              {/* publish button */}
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
                <label for="fileUpload" class="block text-lg font-medium mb-2">Upload File</label>
                <input type="file" id="fileUpload" class="block w-fit text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-white hover:file:bg-gray-700" />
              </div>
              <div class="mb-4">
                {/* file name */}
                <label for="fileName" class="block text-lg font-medium mb-2">File Name</label>
                <input type="text" id="fileName" class="lg:w-1/2 w-full p-2 bg-gray-800 text-white border border-gray-600" />
              </div>
              <div class="mb-4">
                {/* description */}
                <label for="description" class="block text-lg font-medium mb-2">Description</label>
                <textarea id="description" rows="6" class="lg:w-3/4 w-full p-2 bg-gray-800 text-white border border-gray-600"></textarea>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
