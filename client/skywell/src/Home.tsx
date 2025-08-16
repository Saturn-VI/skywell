import type { Component } from "solid-js";
import { Show } from "solid-js";

import { loggedIn } from "./Header.tsx";

const Home: Component = () => {
  return (
    <div class="flex flex-col w-full min-h-full bg-ctp-base text-ctp-text">
      <div class="flex flex-col items-center justify-center px-6 py-16 lg:py-24 text-center animate-fade-in">
        <h1 class="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-slide-up">
          welcome to{" "}
          <span
            class="font-normal align-top inline-block"
            style="font-family: 'Fredoka', sans-serif;"
          >
            skywell
          </span>
        </h1>
        <p
          class="text-xl md:text-2xl lg:text-3xl text-ctp-subtext0 mb-8 max-w-4xl animate-slide-up"
          style="animation-delay: 0.2s;"
        >
          a decentralized file sharing service built on{" "}
          <a
            href="https://atproto.com/guides/faq"
            target="_blank"
            rel="noopener external help"
          >
            atproto
          </a>
        </p>

        <div
          class="flex flex-col sm:flex-row gap-4 animate-slide-up"
          style="animation-delay: 0.6s;"
        >
          <Show
            when={loggedIn()}
            fallback={
              <a
                href="/login"
                class="bg-ctp-green hover:bg-ctp-green-700 text-ctp-base hover:scale-105 px-8 py-3 lg:px-10 lg:py-4 rounded-lg font-semibold text-lg lg:text-xl transition-all duration-300 transform"
              >
                get started
              </a>
            }
          >
            <a
              href="/upload"
              class="bg-ctp-blue hover:bg-ctp-blue-700 text-ctp-base hover:scale-105 px-8 py-3 lg:px-10 lg:py-4 rounded-lg font-semibold text-lg lg:text-xl transition-all duration-300 transform"
            >
              upload file
            </a>
            <a
              href="/account"
              class="bg-ctp-lavender-700 hover:bg-ctp-lavender-900 text-ctp-base hover:scale-105 px-8 py-3 lg:px-10 lg:py-4 rounded-lg font-semibold text-lg lg:text-xl transition-all duration-300 transform"
            >
              my account
            </a>
          </Show>
        </div>
      </div>

      <div class="px-6 py-16 bg-ctp-mantle md:rounded-lg">
        <div class="max-w-4xl mx-auto">
          <h2 class="text-3xl md:text-4xl font-bold text-center mb-3">
            how it works
          </h2>
          <h4 class="text-ctp-subtext1 text-sm md:text-md font-normal text-center mb-12">
            (not extremely complicated)
          </h4>

          <div class="grid md:grid-cols-3 gap-8">
            <div class="text-center">
              <div class="bg-ctp-red text-ctp-base w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 class="text-xl font-semibold mb-3">log in</h3>
              <p class="text-ctp-subtext0">
                use your existing Bluesky or AT Protocol account
              </p>
            </div>

            <div class="text-center">
              <div class="bg-ctp-yellow text-ctp-base w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 class="text-xl font-semibold mb-3">upload</h3>
              <p class="text-ctp-subtext0">
                upload your file, add a name and description
              </p>
            </div>

            <div class="text-center">
              <div class="bg-ctp-green text-ctp-base w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 class="text-xl font-semibold mb-3">share</h3>
              <p class="text-ctp-subtext0">
                (share tuah!) get a short link to share with others
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-16">
        <div class="max-w-4xl mx-auto text-center">
          <h2 class="text-3xl md:text-4xl font-bold mb-8">built on atproto</h2>
          <p class="text-lg text-ctp-subtext-1 mb-6">
            skywell is made with the Authenticated Transfer Protocol (AT
            Protocol), the same technology that powers Bluesky. this means that
            your files are stored on your own personal data server (PDS) so you
            keep all of your files (even if skywell shuts down).
          </p>
          <a
            href="https://atproto.com/"
            target="_blank"
            rel="noopener external help"
            class="text-ctp-base bg-ctp-mauve hover:bg-ctp-mauve-700 px-6 py-3 inline-block rounded-lg font-semibold transition-colors duration-300"
          >
            learn more about atproto
          </a>
        </div>
      </div>

      <Show when={!loggedIn()}>
        <div class="px-6 py-16 text-center bg-ctp-mantle md:rounded-lg">
          <h2 class="text-3xl md:text-4xl font-bold mb-6">interested?</h2>
          <p class="text-lg text-ctp-subtext1 mb-8 max-w-2xl mx-auto">
            experience the future of the web and start sharing files with
            Skywell today.
          </p>

          <a
            href="/login"
            class="bg-ctp-green hover:bg-ctp-green-700 text-ctp-base hover:scale-105 px-8 py-2 lg:px-10 lg:py-3 rounded-lg font-semibold text-xl lg:text-2xl transition-all duration-300 transform inline-block"
          >
            log in
          </a>
        </div>
      </Show>
    </div>
  );
};

export default Home;
