import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "solid-devtools";
import { render } from "solid-js/web";

import App from "./App";
import { cleanupForward } from "./global/adb";
import "./global/theme";
import "./global/monaco";

// order matters
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

render(App, document.getElementById("root") as HTMLElement);
