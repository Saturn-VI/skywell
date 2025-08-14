import type { Component } from "solid-js";

const Footer: Component = () => {
  return (
    <footer class="w-full px-6 py-8 bg-gray-900 text-center text-gray-400">
      <p class="mb-2">
        <span class="font-normal" style="font-family: 'Fredoka', sans-serif;">skywell</span> - decentralized file sharing
      </p>
      <p class="text-sm">
        built with ❤️ by <a
        href="https://bsky.app/profile/did:plc:l7ufwp4ypley2oghdml3ohcm"
        target="_blank"
        rel="noopener external author">
          kilroy
        </a>
      </p>
    </footer>
  );
};

export default Footer;
