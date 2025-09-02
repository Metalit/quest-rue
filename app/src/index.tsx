import { render } from "solid-js/web";

import "@thisbeyond/solid-select/style.css";
// higher priority
import "./styles.css";

import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "solid-devtools";
import App from "./App";
import { SettingsProvider } from "./components/Settings";
import { cleanup_forward } from "./misc/adb";

getCurrentWebviewWindow().onCloseRequested(async () => {
  await cleanup_forward();
});

render(
  () => (
    <SettingsProvider>
      <App />
    </SettingsProvider>
  ),
  document.getElementById("root") as HTMLElement,
);
