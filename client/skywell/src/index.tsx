/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { Toaster } from "solid-toast";

import "./index.css";
import File from "./File.tsx";
import Upload from "./Upload.tsx";
import Home from "./Home.tsx";
import Login from "./Login.tsx";
import Account from "./Account.tsx";
import Callback from "./Callback.tsx";
import Header from "./Header.tsx";
import Footer from "./Footer.tsx";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

render(
  () => (
    <>
      <div class="flex flex-col h-auto min-h-screen bg-gray-700 items-center">
        <Header></Header>
        <div class="flex flex-row flex-1 w-full md:w-11/12 lg:w-3/4 xl:w-2/3 2xl:w-1/2">
          <Router>
            <Route path="/" component={Home} />
            <Route path="/file/:slug" component={File} />
            <Route path="/upload" component={Upload} />
            <Route path="/account" component={Account} />
            <Route path="/login" component={Login} />
            <Route path="/login/callback" component={Callback} />
          </Router>
        </div>
        <Footer />
        <Toaster position="top-center" gutter={32} />
      </div>
    </>
  ),
  root!,
);
