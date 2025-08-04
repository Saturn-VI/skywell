import { Component } from "solid-js";

import Header from "./Header.tsx";
import Sidebar from "./Sidebar.tsx";

const Account: Component = () => {
  return (
    <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
      <div class="flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 bg-gray-800 justify-between mb-4"></div>
      <div>{/* TODO - file list, only when authenticated */}</div>
    </div>
  );
};

export default Account;
