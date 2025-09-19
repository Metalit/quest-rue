import { createRenderEffect, lazy, Show } from "solid-js";
import { Toaster } from "solid-toast";

import { darkMode, monoFont } from "./global/settings";
import { socket } from "./global/socket";
import ConnectMenu from "./pages/ConnectMenu";

const SceneViewer = lazy(() => import("./pages/SceneViewer"));

export default function App() {
  createRenderEffect(() =>
    document
      .getElementById("root")
      ?.setAttribute("data-theme", darkMode() ? "dark" : "light"),
  );

  return (
    <div id="app" style={{ "--mono-font": monoFont() }}>
      <Show when={socket.connected()} fallback={<ConnectMenu />}>
        <SceneViewer />
      </Show>
      <div>
        <Toaster />
      </div>
    </div>
  );
}
