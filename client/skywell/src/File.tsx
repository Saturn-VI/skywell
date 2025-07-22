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

const File: Component = () => {
  return (
    <div class="flex flex-col h-screen">
      <Header></Header>
      <div class="flex flex-row h-full">
        <Sidebar></Sidebar>
        <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
          <div class="flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 bg-gray-800 justify-between">
            {/* filename, author info, download button */}
            <div class="flex flex-col md:w-1/3 w-full h-full p-4">
              {/* filename + author info */}
              <div class="text-4xl font-semibold">filename.exe</div>
            </div>
            <div class="flex justify-center items-center lg:w-1/4 md:w-5/8 w-full lg:h-full md:h-5/8 h-1/2 p-2  text-white">
              {/* download button */}
              <button class="lg:w-2/3 w-1/2 md:h-2/3 h-full p-2 bg-blue-600 hover:bg-blue-700 text-center lg:text-2xl text-xl">
                download
              </button>
            </div>
          </div>
          <div class="flex w-full h-full">{/* description */}</div>
        </div>
      </div>
    </div>
  );
};

export default File;
