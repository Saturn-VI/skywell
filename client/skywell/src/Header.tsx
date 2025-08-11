import { createEffect, createSignal, type Component } from "solid-js";
import { isLoggedIn } from "./Auth.tsx";
import { LoginOutlined, UploadFileOutlined } from "@suid/icons-material";

const Header: Component = () => {
  const [loggedIn, setLoggedIn] = createSignal(false);

  createEffect(async () => {
    setLoggedIn(await isLoggedIn());
  })

  return (
    <div class="w-full h-16 bg-gray-900 text-white p-4 items-center flex justify-between">
      <a href="/">skywell</a>
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
