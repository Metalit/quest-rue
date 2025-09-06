import { Route, Router } from "@solidjs/router";
import { lazy } from "solid-js";
import { Toaster } from "solid-toast";

import { darkMode, monoFont } from "./global/settings";
import ConnectMenu from "./pages/ConnectMenu";

const SceneViewer = lazy(() => import("./pages/SceneViewer"));

export default function App() {
  return (
    <div class={darkMode() ? "dark" : ""}>
      <div id="app" style={{ "--mono-font": monoFont() }}>
        <Router>
          <Route path="/app/" component={SceneViewer} />
          <Route path="/" component={ConnectMenu} />
        </Router>
        <div>
          <Toaster />
        </div>
      </div>
    </div>
  );
}
