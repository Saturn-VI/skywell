import type { Component } from "solid-js";

const Home: Component = () => {
  return (
    <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
      skywell
      <a class="text-blue-400" href="/file/DCsW4t">
        file test link
      </a>
      <a class="text-blue-400" href="/upload">
        upload test link
      </a>
      <a class="text-blue-400" href="/account">
        account test link
      </a>
      <a class="text-blue-400" href="/login">
        login test link
      </a>
    </div>
  );
};

export default Home;
