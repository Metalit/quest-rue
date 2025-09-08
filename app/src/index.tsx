import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "solid-devtools";
import { render } from "solid-js/web";

import App from "./App";
import { cleanupForward } from "./global/adb";

// order matters
import "dockview-core/dist/styles/dockview.css";
import "./dockview.css";
import "./styles.css";

try {
  getCurrentWebviewWindow().onCloseRequested(async () => {
    await cleanupForward();
  });
} catch (error) {
  console.log("failed to get webview window:", error);
}

render(App, document.getElementById("root") as HTMLElement);
