import { Component } from "solid-js";
import { isLoggedIn } from "./Auth.tsx";
import { toast } from "solid-toast";
import { Navigate } from "@solidjs/router";

const Account: Component = () => {
  if (!isLoggedIn()) {
    console.log("Not logged in")
    toast.error("Not logged in, redirecting...")
    return <Navigate href="/login" />;;
  }

  return (
    <div class="flex flex-col w-full h-full bg-gray-700 text-white p-4">
      <div class="flex items-center md:flex-row flex-col w-full md:h-1/3 h-1/2 bg-gray-800 justify-between mb-4"></div>
      <div>{/* TODO - file list, only when authenticated */}</div>
    </div>
  );
};

export default Account;
