/* ============================================================
   nmr.js — qNMR quantification
   Two sub-modes:
     • Mixture composition — relative mol% / wt% from integrals & proton counts
     • Internal standard   — absolute amount & purity vs a weighed standard
   Core identity: normalised integral  I/N  is proportional to moles.
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id);
  const num = (id) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : NaN; };

  let mode = "mixture";
  let rows = 2;

  /* ---------------- Mixture composition ---------------- */
  function rowHtml(i) {
    return `
      <div class="nmr-row" data-row="${i}">
        <span class="idx">${i + 1}</span>
        <input id="mx-name-${i}" placeholder="label" style="flex:1.4" aria-label="component ${i + 1} label">
        <input id="mx-int-${i}" type="number" inputmode="decimal" placeholder="integral" aria-label="integral">
        <input id="mx-nh-${i}" type="number" inputmode="decimal" placeholder="¹H" aria-label="protons">
        <input id="mx-mw-${i}" type="number" inputmode="decimal" placeholder="MW (opt)" aria-label="molar mass">
        <button class="act ghost rm" data-rm="${i}" title="remove" ${rows <= 2 ? "disabled" : ""}>×</button>
      </div>`;
  }

  function renderRows() {
    const host = $("mx-rows");
    host.innerHTML = Array.from({ length: rows }, (_, i) => rowHtml(i)).join("");
    host.querySelectorAll("input").forEach((el) => el.addEventListener("input", computeMixture));
    host.querySelectorAll("[data-rm]").forEach((b) =>
      b.addEventListener("click", () => { if (rows > 2) { rows--; renderRows(); computeMixture(); } }));
  }

  function computeMixture() {
    const comps = [];
    for (let i = 0; i < rows; i++) {
      const I = num(`mx-int-${i}`), N = num(`mx-nh-${i}`), MW = num(`mx-mw-${i}`);
      const name = ($(`mx-name-${i}`)?.value || `#${i + 1}`).trim() || `#${i + 1}`;
      if (Number.isFinite(I) && Number.isFinite(N) && N > 0) {
        comps.push({ name, molar: I / N, mw: MW });
      }
    }
    const out = $("mx-out");
    if (comps.length < 2) {
      out.innerHTML = `<span class="lbl">Composition</span><div class="note">Enter integral and ¹H count for at least two components.</div>`;
      return;
    }
    const sumMol = comps.reduce((a, c) => a + c.molar, 0);
    const haveAllMw = comps.every((c) => Number.isFinite(c.mw) && c.mw > 0);
    let sumMass = 0;
    if (haveAllMw) { comps.forEach((c) => (c.mass = c.molar * c.mw)); sumMass = comps.reduce((a, c) => a + c.mass, 0); }

    out.innerHTML =
      `<span class="lbl">Composition${haveAllMw ? " (mol% · wt%)" : " (mol%)"}</span>` +
      comps.map((c) => {
        const molPct = (c.molar / sumMol) * 100;
        const wtPct = haveAllMw ? (c.mass / sumMass) * 100 : null;
        return `<div class="line"><span>${escapeHtml(c.name)}</span>` +
               `<span class="val">${molPct.toFixed(2)} %${wtPct !== null ? `  ·  ${wtPct.toFixed(2)} wt%` : ""}</span></div>`;
      }).join("");
  }

  /* ---------------- Internal standard ---------------- */
  function computeStandard() {
    const Ia = num("is-int-a"), Na = num("is-nh-a"), MWa = num("is-mw-a");
    const Is = num("is-int-s"), Ns = num("is-nh-s"), MWs = num("is-mw-s"), ms = num("is-mass-s");
    const msample = num("is-mass-sample");
    const out = $("is-out");
    const flash = $("is-flash");
    flash.className = ""; flash.innerHTML = "";

    const haveCore = [Ia, Na, Is, Ns, MWs, ms].every(Number.isFinite) && Na > 0 && Ns > 0 && MWs > 0;
    if (!haveCore) {
      out.innerHTML = `<span class="lbl">Result</span><div class="note">Fill the analyte (I, ¹H) and the standard (I, ¹H, MW, mass).</div>`;
      return;
    }
    const molStd = ms / 1000 / MWs;                 // mass in mg -> g
    const molAnalyte = (Ia / Na) / (Is / Ns) * molStd;
    const mmolAnalyte = molAnalyte * 1000;

    let lines =
      `<div class="line"><span>Analyte amount</span><span class="val">${mmolAnalyte.toPrecision(4)} mmol</span></div>`;

    if (Number.isFinite(MWa) && MWa > 0) {
      const massAnalyte = molAnalyte * MWa * 1000;  // mg
      lines += `<div class="line"><span>Analyte mass</span><span class="val">${massAnalyte.toPrecision(4)} mg</span></div>`;
      if (Number.isFinite(msample) && msample > 0) {
        const purity = (massAnalyte / msample) * 100;
        lines = `<span class="lbl">Purity (wt%)</span><div class="big">${purity.toFixed(2)} %</div>` + lines;
        if (purity > 100.5) {
          flash.className = "flash warn";
          flash.innerHTML = `Purity > 100% — check integral assignment, proton counts, or that the standard mass is correct.`;
        }
      } else {
        lines = `<span class="lbl">Result</span>` + lines;
      }
    } else {
      lines = `<span class="lbl">Result</span>` + lines +
        `<div class="note">Add the analyte MW (and sample mass) to get mass and wt% purity.</div>`;
    }
    out.innerHTML = lines;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setMode(m, segButtons) {
    mode = m;
    segButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    $("nmr-mixture").classList.toggle("hide", m !== "mixture");
    $("nmr-standard").classList.toggle("hide", m !== "standard");
  }

  function init() {
    renderRows();
    $("mx-add").addEventListener("click", () => { rows++; renderRows(); computeMixture(); });

    ["is-int-a", "is-nh-a", "is-mw-a", "is-int-s", "is-nh-s", "is-mw-s", "is-mass-s", "is-mass-sample"]
      .forEach((id) => $(id).addEventListener("input", computeStandard));

    const seg = Array.from(document.querySelectorAll("#nmr-seg [data-mode]"));
    seg.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode, seg)));
    setMode("mixture", seg);
    computeMixture();
    computeStandard();
  }

  window.Bench = window.Bench || {};
  window.Bench.nmr = { init };
})();
