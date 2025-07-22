import type { Component } from "solid-js";

import Header from "./Header.tsx";
import Sidebar from "./Sidebar.tsx";

const Home: Component = () => {
  return (
    <div class="flex flex-col h-screen">
      <Header></Header>
      <div class="flex flex-row h-full">
        <Sidebar></Sidebar>
        {/* <Body></Body> */}
      </div>
    </div>
  );
};

export default Home;
