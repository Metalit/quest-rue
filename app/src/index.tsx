import "solid-devtools";

import { attachDevtoolsOverlay } from "@solid-devtools/overlay";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { render } from "solid-js/web";

import App from "./App";
import { cleanupForward } from "./global/adb";
import "./global/monaco";
import "./global/theme";

// preserve order
import "dockview-core/dist/styles/dockview.css";

import "./styles.css";

import "./dockview.css";

import "./monaco.css";

try {
  getCurrentWebviewWindow().onCloseRequested(async () => {
    await cleanupForward();
  });
} catch (error) {
  console.log("failed to get webview window:", error);
}

attachDevtoolsOverlay();

render(App, document.getElementById("root") as HTMLElement);
