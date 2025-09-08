import { Route, Router } from "@solidjs/router";
import { createRenderEffect, lazy } from "solid-js";
import { Toaster } from "solid-toast";

import { darkMode, monoFont } from "./global/settings";
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
      <Router>
          <Route path="/app/" component={SceneViewer} />
          <Route path="/" component={ConnectMenu} />
      </Router>
      <div>
        <Toaster />
      </div>
    </div>
  );
}
