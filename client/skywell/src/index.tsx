/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";

import "./index.css";
import File from "./File.tsx";
import Upload from "./Upload.tsx";
import Home from "./Home.tsx";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

render(() => <Router>
  <Route path="/" component={Home}/>
  <Route path="/file/:slug" component={File}/>
  <Route path="/upload" component={File}/>
</Router>, root!);
