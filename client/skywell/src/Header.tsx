import { Component } from "solid-js";
import { LoginOutlined, UploadFileOutlined } from "@suid/icons-material";
import { loggedIn, pfpUri } from "./Sidebar.tsx";

const Header: Component = () => {
  return (
    <div class="w-full h-16 bg-gray-900 text-white p-4 items-center flex justify-between">
      {loggedIn() &&
        <a href="/account" class="flex items-center">
          <img  src={pfpUri()!} alt="Logo" class="h-8 mr-4" />
        </a>
      }
      <a href="/" style="font-family: 'Fredoka', sans-serif; font-weight: 400; font-stretch: 125%;" class="text-xl">skywell</a>
      {loggedIn() ? (
        <a href="/upload" class="bg-blue-500 px-4 py-2 hover:bg-blue-600">
          <UploadFileOutlined />
        </a>
      ) : (
        <a href="/login" class="bg-blue-500 px-4 py-2 hover:bg-blue-600">
          <LoginOutlined />
        </a>
      )
      }
    </div>
  );
};

export default Header;
