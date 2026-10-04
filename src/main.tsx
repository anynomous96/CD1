/// <reference types="vite-plugin-pwa/client" />

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App";

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

window.addEventListener("signal:apply-update", () => {
  void updateServiceWorker?.();
});

updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event("signal:pwa-update"));
  },
  onOfflineReady() {
    window.dispatchEvent(new Event("signal:pwa-offline-ready"));
  },
  onRegisterError(error) {
    // The application remains usable online if a browser blocks SW registration.
    console.warn("Signal offline mode could not be enabled:", error);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
