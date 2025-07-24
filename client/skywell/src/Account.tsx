import { Component } from "solid-js";

import Header from "./Header.tsx";
import Sidebar from "./Sidebar.tsx";

const Account: Component = () => {
  return (
    <div class="flex flex-col h-screen">
      <Header />
      <div class="flex flex-row h-full">
        <Sidebar />
        <div>
        </div>
      </div>
    </div>
  );
}

export default Account;
