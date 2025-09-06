import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "solid-devtools";
import { render } from "solid-js/web";

import App from "./App";
import { cleanupForward } from "./global/adb";

import "@thisbeyond/solid-select/style.css";
// higher priority
import "./styles.css";

getCurrentWebviewWindow().onCloseRequested(async () => {
  await cleanupForward();
});

render(App, document.getElementById("root") as HTMLElement);
