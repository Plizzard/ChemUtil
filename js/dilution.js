/* ============================================================
   dilution.js — stock prep + C1V1 = C2V2
   All maths done in SI base units (mol/L, L) at the boundary.
   MW can be handed off live from the structure view via Bench.bridge.
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id);

  // unit -> factor to SI base
  const CONC = { "M": 1, "mM": 1e-3, "uM": 1e-6, "nM": 1e-9 };       // -> mol/L
  const VOL  = { "L": 1, "mL": 1e-3, "uL": 1e-6 };                    // -> L
  const MASS = { "g": 1, "mg": 1e-3, "ug": 1e-6 };                    // -> g

  const num = (id) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : NaN; };
  const unit = (id) => $(id).value;

  function fmtConc(molPerL) {
    if (!Number.isFinite(molPerL)) return "—";
    const abs = Math.abs(molPerL);
    if (abs >= 1) return molPerL.toFixed(3) + " M";
    if (abs >= 1e-3) return (molPerL * 1e3).toFixed(3) + " mM";
    if (abs >= 1e-6) return (molPerL * 1e6).toFixed(3) + " µM";
    return (molPerL * 1e9).toFixed(2) + " nM";
  }
  function fmtVol(L) {
    if (!Number.isFinite(L)) return "—";
    const abs = Math.abs(L);
    if (abs >= 1) return L.toFixed(3) + " L";
    if (abs >= 1e-3) return (L * 1e3).toFixed(3) + " mL";
    if (abs >= 1e-6) return (L * 1e6).toFixed(2) + " µL";
    return (L * 1e9).toFixed(2) + " nL";
  }

  /* ---------- Card 1: stock concentration from a weighed mass ---------- */
  function computeStock() {
    const mass = num("st-mass") * MASS[unit("st-mass-u")];   // g
    const mw   = num("st-mw");                               // g/mol
    const vol  = num("st-vol") * VOL[unit("st-vol-u")];      // L
    const out  = $("st-out");
    if (![mass, mw, vol].every(Number.isFinite) || mw <= 0 || vol <= 0) {
      out.innerHTML = `<span class="lbl">Stock concentration</span><div class="big">—</div>`;
      stockMolPerL = NaN;
      return;
    }
    const molPerL = (mass / mw) / vol;
    stockMolPerL = molPerL;
    out.innerHTML =
      `<span class="lbl">Stock concentration</span>` +
      `<div class="big">${fmtConc(molPerL)}</div>` +
      `<div class="note">${(mass / mw * 1e3).toPrecision(4)} mmol in ${fmtVol(vol)}</div>`;
    // make the freshly computed stock available to the dilution card
    if ($("use-stock").checked) writeC1(molPerL);
  }
  let stockMolPerL = NaN;

  function writeC1(molPerL) {
    // pick a friendly unit for display
    let u = "M", v = molPerL;
    if (Math.abs(molPerL) < 1e-3) { u = "uM"; v = molPerL * 1e6; }
    else if (Math.abs(molPerL) < 1) { u = "mM"; v = molPerL * 1e3; }
    $("dl-c1").value = Number(v.toPrecision(5));
    $("dl-c1-u").value = u;
  }

  /* ---------- Card 2: C1 V1 = C2 V2 ---------- */
  let solveFor = "V1"; // V1 | C2 | V2 | C1

  function computeDilution() {
    // gather the three knowns (everything except the solve-for target)
    const C1 = Number.isFinite(num("dl-c1")) ? num("dl-c1") * CONC[unit("dl-c1-u")] : NaN;
    const C2 = Number.isFinite(num("dl-c2")) ? num("dl-c2") * CONC[unit("dl-c2-u")] : NaN;
    const V1 = Number.isFinite(num("dl-v1")) ? num("dl-v1") * VOL[unit("dl-v1-u")]  : NaN;
    const V2 = Number.isFinite(num("dl-v2")) ? num("dl-v2") * VOL[unit("dl-v2-u")]  : NaN;

    const out = $("dl-out");
    let result = {};
    try {
      if (solveFor === "V1") result = { V1: (C2 * V2) / C1 };
      else if (solveFor === "V2") result = { V2: (C1 * V1) / C2 };
      else if (solveFor === "C1") result = { C1: (C2 * V2) / V1 };
      else if (solveFor === "C2") result = { C2: (C1 * V1) / V2 };
    } catch (_) {}

    const val = Object.values(result)[0];
    if (!Number.isFinite(val) || val < 0) {
      out.innerHTML = `<span class="lbl">Recipe</span><div class="big">—</div>` +
        `<div class="note">Fill the three known fields.</div>`;
      $("dl-flash").innerHTML = "";
      return;
    }

    // resolve the full set for the recipe text
    const r = {
      C1: solveFor === "C1" ? result.C1 : C1,
      C2: solveFor === "C2" ? result.C2 : C2,
      V1: solveFor === "V1" ? result.V1 : V1,
      V2: solveFor === "V2" ? result.V2 : V2,
    };
    const diluent = (Number.isFinite(r.V2) && Number.isFinite(r.V1)) ? r.V2 - r.V1 : NaN;

    out.innerHTML =
      `<span class="lbl">Solved: ${labelFor(solveFor)}</span>` +
      `<div class="big">${solveFor.startsWith("C") ? fmtConc(val) : fmtVol(val)}</div>` +
      `<div class="line"><span>Take stock (C₁=${fmtConc(r.C1)})</span><span class="val">${fmtVol(r.V1)}</span></div>` +
      (Number.isFinite(diluent)
        ? `<div class="line"><span>Add diluent</span><span class="val">${fmtVol(diluent)}</span></div>` : "") +
      `<div class="line"><span>Final (C₂=${fmtConc(r.C2)})</span><span class="val">${fmtVol(r.V2)}</span></div>`;

    // sub-1 µL pipettability warning
    const flash = $("dl-flash");
    if (Number.isFinite(r.V1) && r.V1 > 0 && r.V1 < 1e-6) {
      const factor = Math.ceil(1e-6 / r.V1);
      flash.className = "flash warn";
      flash.innerHTML =
        `Aliquot is ${fmtVol(r.V1)} — below ~1 µL and hard to pipette accurately. ` +
        `Consider an intermediate dilution (e.g. pre-dilute the stock ${factor}×) before this step.`;
    } else if (Number.isFinite(diluent) && diluent < 0) {
      flash.className = "flash bad";
      flash.innerHTML = `Required stock volume exceeds the final volume — C₂ can't be higher than C₁.`;
    } else {
      flash.className = ""; flash.innerHTML = "";
    }
  }

  function labelFor(k) {
    return { V1: "stock volume (V₁)", V2: "final volume (V₂)", C1: "stock conc. (C₁)", C2: "final conc. (C₂)" }[k];
  }

  /* ---------- wiring ---------- */
  function setSolve(target, segButtons) {
    solveFor = target;
    segButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.solve === target)));
    // disable the field we are solving for
    ["C1", "C2", "V1", "V2"].forEach((k) => {
      const idMap = { C1: "dl-c1", C2: "dl-c2", V1: "dl-v1", V2: "dl-v2" };
      const on = (k === target);
      $(idMap[k]).disabled = on;
      $(idMap[k]).placeholder = on ? "← solved" : "";
      if (on) $(idMap[k]).value = "";
    });
    computeDilution();
  }

  function init() {
    // stock card listeners
    ["st-mass", "st-mass-u", "st-mw", "st-vol", "st-vol-u"].forEach((id) =>
      $(id).addEventListener("input", computeStock));

    // MW handoff from the structure view
    const applyMw = (state) => {
      const pill = $("mw-pill");
      if (state && Number.isFinite(state.mw)) {
        pill.textContent = state.mw.toFixed(2) + " g/mol";
        $("mw-from-structure").classList.remove("hide");
      } else {
        $("mw-from-structure").classList.add("hide");
      }
    };
    window.Bench.bridge.subscribe(applyMw);
    applyMw(window.Bench.bridge.get());
    $("mw-use").addEventListener("click", () => {
      const s = window.Bench.bridge.get();
      if (s && Number.isFinite(s.mw)) { $("st-mw").value = s.mw.toFixed(2); computeStock(); }
    });

    // dilution card listeners
    ["dl-c1", "dl-c1-u", "dl-c2", "dl-c2-u", "dl-v1", "dl-v1-u", "dl-v2", "dl-v2-u"].forEach((id) =>
      $(id).addEventListener("input", computeDilution));

    const seg = Array.from(document.querySelectorAll("#dl-seg [data-solve]"));
    seg.forEach((b) => b.addEventListener("click", () => setSolve(b.dataset.solve, seg)));

    $("use-stock").addEventListener("change", () => {
      if ($("use-stock").checked && Number.isFinite(stockMolPerL)) writeC1(stockMolPerL);
      computeDilution();
    });

    setSolve("V1", seg);   // default: solve for stock volume to take
    computeStock();
  }

  window.Bench = window.Bench || {};
  window.Bench.dilution = { init };
})();
