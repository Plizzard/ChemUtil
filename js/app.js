/* ============================================================
   app.js — shell: bridge, tab routing, status, service worker
   The popup-wipe problem from the extension is gone in a single-page
   app, so the cross-session chrome.storage.session handoff collapses
   to a simple in-memory publish/subscribe bridge.
   ============================================================ */
window.Bench = window.Bench || {};

/* ---- StructureBridge (in-memory) ---- */
window.Bench.bridge = (function () {
  let state = { mw: NaN, smiles: "" };
  const subs = new Set();
  return {
    set(patch) { state = { ...state, ...patch }; subs.forEach((fn) => { try { fn(state); } catch (_) {} }); },
    get() { return state; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
})();

/* ---- Tab routing ---- */
(function tabs() {
  const buttons = Array.from(document.querySelectorAll("nav.tabs button"));
  const views = {
    structure: document.getElementById("view-structure"),
    dilution:  document.getElementById("view-dilution"),
    nmr:       document.getElementById("view-nmr"),
  };
  function show(name) {
    buttons.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === name)));
    Object.entries(views).forEach(([k, el]) => { el.hidden = (k !== name); });
    try { history.replaceState(null, "", "#" + name); } catch (_) {}
  }
  buttons.forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));
  const start = (location.hash || "#structure").slice(1);
  show(views[start] ? start : "structure");
})();

/* ---- Online / offline + engine status pill ---- */
(function status() {
  const el = document.getElementById("status");
  function paint() {
    if (!navigator.onLine) { el.className = "status offline"; el.querySelector(".txt").textContent = "Offline"; }
  }
  window.addEventListener("online", paint);
  window.addEventListener("offline", paint);
  window.RDKitBench.ready.then(() => {
    if (navigator.onLine) { el.className = "status ready"; el.querySelector(".txt").textContent = "Engine ready"; }
    else { el.className = "status ready"; el.querySelector(".txt").textContent = "Ready · offline"; }
  });
  paint();
})();

/* ---- Boot ---- */
window.RDKitBench.init().catch((e) => {
  const d = document.getElementById("depiction");
  if (d) d.innerHTML = `<div class="err">Could not load the chemistry engine.<br>Check your connection on first run.</div>`;
});
window.Bench.structure.init();
window.Bench.dilution.init();
window.Bench.nmr.init();

/* ---- Service worker (offline-first) ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
