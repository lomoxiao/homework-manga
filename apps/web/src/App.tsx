import { useEffect, useState } from "preact/hooks";
import { ParentApp } from "./parent/ParentApp";
import { KidsApp } from "./kids/KidsApp";
import { LocalApp } from "./local/LocalApp";

type Route = "parent" | "kids" | "local";

function currentRoute(): Route {
  const hash = window.location.hash;
  if (hash.startsWith("#/kids")) return "kids";
  if (hash.startsWith("#/local")) return "local";
  return "parent";
}

export function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div class={`app-shell route-${route}`}>
      <header class="toolbar">
        <div class="brand">
          <p class="eyebrow">HOMEWORK MANGA</p>
          <h1>まちがいから学ぶ 算数まんが</h1>
        </div>
        <nav class="mode-nav" aria-label="モード切替">
          <a href="#/" class={route === "parent" ? "active" : ""}>ほごしゃ</a>
          <a href="#/kids" class={route === "kids" ? "active" : ""}>こども</a>
          <a href="#/local" class={route === "local" ? "active" : ""}>おためし</a>
        </nav>
      </header>
      <main>
        {route === "parent" && <ParentApp />}
        {route === "kids" && <KidsApp />}
        {route === "local" && <LocalApp />}
      </main>
    </div>
  );
}
