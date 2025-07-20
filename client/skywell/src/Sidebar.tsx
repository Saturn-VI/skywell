import type { Component } from "solid-js";

const Sidebar: Component = () => {
  return (
    <div class="sm:w-1/12 items-center flex flex-col sm:visible invisible w-0 h-full bg-gray-800 text-white sm:p-4 p-0">
      profile
    </div>
  );
};

export default Sidebar;
