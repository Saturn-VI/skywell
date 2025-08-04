import { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { createSignal } from "solid-js";

export const [agent, setAgent] = createSignal<OAuthUserAgent | null>(null);
