import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// A PWA needs separately cacheable assets and a service worker, so this build
// intentionally does not use a single-file output plugin.
export default defineConfig({
  // Relative asset URLs keep the installed app working on sub-path hosts (for example GitHub Pages).
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["signal-logo.svg", "icons/signal-icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        id: ".",
        name: "Signal — Morse Code Translator",
        short_name: "Signal",
        description: "Translate Morse code, transmit audio signals, and keep messages available offline.",
        theme_color: "#18342b",
        background_color: "#08120f",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "any",
        start_url: ".",
        scope: ".",
        lang: "en",
        categories: ["utilities", "productivity", "education"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "Text to Morse",
            short_name: "Encode",
            description: "Open the text to Morse translator",
            url: "./?mode=text",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Morse reference",
            short_name: "Reference",
            description: "Open the Morse character sheet",
            url: "./?mode=morse#reference",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
        share_target: {
          action: "./",
          method: "GET",
          enctype: "application/x-www-form-urlencoded",
          params: { title: "title", text: "text", url: "url" },
        },
        launch_handler: { client_mode: ["navigate-existing", "auto"] },
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "signal-images",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: true, type: "module" },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    // Arena previews are exposed on an ephemeral subdomain.
    allowedHosts: [".e2b.app"],
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: [".e2b.app"],
  },
});
