/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { Toaster } from "solid-toast";
import { createResource, onMount } from "solid-js";

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

const getCatppuccinColors = () => {
  // Create temporary elements with Catppuccin classes to extract computed colors
  const tempEl = document.createElement("div");
  tempEl.className = "bg-ctp-surface0 text-ctp-text border-ctp-surface1";
  tempEl.style.position = "absolute";
  tempEl.style.visibility = "hidden";
  document.body.appendChild(tempEl);

  const computedStyle = getComputedStyle(tempEl);
  const colors = {
    background: computedStyle.backgroundColor,
    color: computedStyle.color,
    border: computedStyle.borderColor,
  };

  document.body.removeChild(tempEl);
  return colors;
};

const [toastColors] = createResource(() => {
  return new Promise<{background: string, color: string, border: string}>((resolve) => {
    const updateColors = () => {
      const colors = getCatppuccinColors();
      resolve(colors);
    };

    // Initial load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateColors);
    } else {
      updateColors();
    }

    // Listen for theme changes
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
  });
}, {
  initialValue: {
    background: "#313244",
    color: "#cdd6f4",
    border: "#45475a"
  }
});

render(
  () => (
    <>
      <div class="flex flex-col h-auto min-h-screen bg-ctp-base items-center">
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
        <Toaster
          position="top-center"
          gutter={32}
          toastOptions={{
            className: "text-lg",
            style: {
              background: toastColors()?.background || "#313244",
              color: toastColors()?.color || "#cdd6f4",
              border: `1px solid ${toastColors()?.border || "#45475a"}`,
              "border-radius": "8px",
              "font-weight": "500",
              padding: "12px 16px",
              "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.32)"
            }
          }}
        />
      </div>
    </>
  ),
  root!,
);
