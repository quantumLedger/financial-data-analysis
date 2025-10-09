"use client";

import * as React from "react";

export type IcfMapping = any;

type Ctx = { icf: IcfMapping | null; ready: boolean };
const IcfCtx = React.createContext<Ctx>({ icf: null, ready: false });

export function useIcf() {
  return React.useContext(IcfCtx);
}

function normalize(v: any) {
  if (!v) return null;
  return v.icfMapping ? v.icfMapping : v;
}

export function IcfProvider({ children }: { children: React.ReactNode }) {
  const [icf, setIcf] = React.useState<IcfMapping | null>(null);
  const [ready, setReady] = React.useState(false);
  

  React.useEffect(() => {
    const readFromUrl = () => {
      try {
        const search = window.location.search.startsWith("?")
          ? window.location.search.slice(1)
          : window.location.search;
        const params = new URLSearchParams(search);
        
        let enc = params.get("icf");
        if (!enc) {
          const hash = window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash;
          const qs = new URLSearchParams(hash);
          enc = qs.get("icf");
        }
        if (!enc) return null;
        const json = decodeURIComponent(enc);
        return JSON.parse(json);
      } catch {
        return null;
      }
    };

    const initial = readFromUrl();
    if (initial !== null) setIcf(normalize(initial));

    const onHashChange = () => {
      const v = readFromUrl();
      if (v !== null) setIcf(normalize(v));
    };
    window.addEventListener("hashchange", onHashChange);

    const allowedParentOrigins = new Set<string>(["http://localhost:3000"]);
    const onMessage = (evt: MessageEvent) => {
      if (!allowedParentOrigins.has(evt.origin)) return;
      if (!evt.data || typeof evt.data !== "object") return;
      if (evt.data.type === "setICF") setIcf(normalize(evt.data.payload ?? null));
    };
    window.addEventListener("message", onMessage);

    try {
      window.parent?.postMessage({ type: "childReady" }, "*");
    } catch {}

    setReady(true);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const value = React.useMemo(() => ({ icf, ready }), [icf, ready]);
  return <IcfCtx.Provider value={value}>{children}</IcfCtx.Provider>;
}

export function IcfDebugBadge() {
  const { icf, ready } = useIcf();
  if (!ready) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        fontSize: 11,
        background: "rgba(0,0,0,0.65)",
        color: "#fff",
        padding: "4px 8px",
        borderRadius: 6,
        zIndex: 60,
      }}
    >
      ICF: {icf ? Object.keys(icf || {}).length : 0} keys
    </div>
  );
}
