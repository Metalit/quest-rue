import { defineConfig } from "vite";

import tailwindcss from "@tailwindcss/vite";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import devtools from "solid-devtools/vite";
import directive from "unplugin-solid-directive/vite";
import solidPlugin from "vite-plugin-solid";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    devtools({
      /* additional options */
      autoname: true, // e.g. enable autoname
      // pass `true` or an object with options
      locator: {
        targetIDE: "vscode",
        componentLocation: true,
        jsxLocation: true,
      },
    }),
    solidPlugin(),
    tailwindcss(),
    directive({
      directives: [
        {
          from: "/src/utils/directives",
          imports: ["onInput", "valueSignal", "onCheck", "onEnter", "onHide", "stopDrag"],
        },
      ],
    }),
  ],
  css: {
    modules: {
      localsConvention: "camelCaseOnly",
    },
    postcss: {
      plugins: [
        autoprefixer(),
        ...(process.env.NODE_ENV === "production" ? [cssnano()] : []),
      ],
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    // if the host Tauri is expecting is set, use it
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  // to make use of `TAURI_DEBUG` and other env variables
  // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target:
      process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
