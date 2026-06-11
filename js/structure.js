/* ============================================================
   structure.js — SMILES -> 2D structure view
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id);
  const els = {
    smiles:   $("smiles-in"),
    depict:   $("depiction"),
    chips:    $("chips"),
    badges:   $("badges"),
    getName:  $("btn-getname"),
    nameBox:  $("namebox"),
    suppliers:$("suppliers"),
  };

  let hasRendered = false;
  let debounceT = null;
  let lastValidSmiles = "";

  function chip(label, value, digits) {
    if (value === undefined || value === null || Number.isNaN(value)) return "";
    const v = (typeof value === "number" && digits !== undefined) ? value.toFixed(digits) : value;
    return `<div class="chip"><b>${label}</b><span>${v}</span></div>`;
  }

  function renderChips(d) {
    els.chips.innerHTML = [
      chip("MW", d.mw, 2),
      chip("Monoiso", d.exact, 4),
      chip("TPSA", d.tpsa, 1),
      chip("cLogP", d.clogp, 2),
      chip("HBD", d.hbd),
      chip("HBA", d.hba),
      chip("RotB", d.rotb),
      chip("Fsp³", d.fsp3, 2),
      chip("Arom rings", d.aromRings),
      chip("Heavy", d.heavy),
    ].join("");
  }

  function badge(name, pass, detail) {
    return `<span class="badge ${pass ? "pass" : "fail"}">${name}` +
           (detail ? ` <span class="v">${detail}</span>` : "") + `</span>`;
  }

  function renderBadges(d) {
    // Lipinski Ro5: MW<=500, cLogP<=5, HBD<=5, HBA<=10
    const ro5Viol =
      (d.mw > 500) + (d.clogp > 5) + (d.hbd > 5) + (d.hba > 10);
    // Veber: RotB<=10, TPSA<=140
    const veber = d.rotb <= 10 && d.tpsa <= 140;
    // Rule of 3 (fragment-like): MW<=300, cLogP<=3, HBD<=3, HBA<=3, RotB<=3
    const ro3 = d.mw <= 300 && d.clogp <= 3 && d.hbd <= 3 && d.hba <= 3 && d.rotb <= 3;

    els.badges.innerHTML = [
      badge("Lipinski Ro5", ro5Viol <= 1, ro5Viol === 0 ? "0 viol." : `${ro5Viol} viol.`),
      badge("Veber", veber),
      badge("Rule of 3", ro3),
    ].join("");
  }

  function showDepiction(svg) {
    els.depict.innerHTML = svg;
  }
  function showError(msg) {
    // After the first successful render, keep the last good picture and stay quiet
    // (per UX preference: no persistent invalid-SMILES nagging once something is shown).
    if (hasRendered) return;
    els.depict.innerHTML = msg
      ? `<div class="err">${msg}</div>`
      : `<div class="placeholder">Paste or type a SMILES string to render its structure offline.</div>`;
  }

  function run() {
    const smiles = els.smiles.value;
    const res = window.RDKitBench.analyse(smiles, 380, 300);
    if (res.ok) {
      hasRendered = true;
      lastValidSmiles = smiles.trim();
      showDepiction(res.svg);
      renderChips(res.descriptors);
      renderBadges(res.descriptors);
      els.chips.classList.remove("hide");
      els.badges.classList.remove("hide");
      els.getName.disabled = false;
      // publish MW to the shared bridge for the dilution calculator
      window.Bench.bridge.set({ mw: res.descriptors.mw, smiles: lastValidSmiles });
    } else {
      showError(res.error);
      if (!hasRendered) {
        els.chips.classList.add("hide");
        els.badges.classList.add("hide");
        els.getName.disabled = true;
      }
    }
    // reset the name box whenever the structure changes
    els.nameBox.classList.add("hide");
  }

  function debounced() {
    clearTimeout(debounceT);
    debounceT = setTimeout(run, 220);
  }

  /* ---------- PubChem: opt-in only, fired by the Get name button ---------- */
  function casCheckDigit(cas) {
    // CAS format n..n-nn-c ; check digit = (Σ d_i * position_i) mod 10, counting from the right (excl. check)
    const m = /^(\d{2,7})-(\d{2})-(\d)$/.exec(cas);
    if (!m) return false;
    const digits = (m[1] + m[2]).split("").reverse().map(Number);
    const sum = digits.reduce((acc, d, i) => acc + d * (i + 1), 0);
    return (sum % 10) === Number(m[3]);
  }

  async function pubchemLookup() {
    if (!lastValidSmiles) return;
    const box = els.nameBox;
    box.classList.remove("hide");
    box.innerHTML = `<div class="ln"><span class="muted">Querying PubChem…</span></div>`;
    els.getName.disabled = true;
    try {
      const base = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/" +
        encodeURIComponent(lastValidSmiles) +
        "/property/IUPACName,Title/JSON";
      const r = await fetch(base);
      if (!r.ok) throw new Error("PubChem returned " + r.status);
      const data = await r.json();
      const props = data?.PropertyTable?.Properties?.[0] || {};
      const cid = props.CID;
      const iupac = props.IUPACName || "—";
      const title = props.Title || "—";

      // second, optional call for CAS (synonyms) — only if we got a CID
      let cas = "—";
      if (cid) {
        try {
          const sr = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`);
          if (sr.ok) {
            const sd = await sr.json();
            const syns = sd?.InformationList?.Information?.[0]?.Synonym || [];
            const hit = syns.find((s) => /^\d{2,7}-\d{2}-\d$/.test(s) && casCheckDigit(s));
            if (hit) cas = hit;
          }
        } catch (_) {}
      }

      box.innerHTML =
        `<div class="ln"><span class="k">IUPAC</span><span class="val">${escapeHtml(iupac)}</span></div>` +
        `<div class="ln"><span class="k">Trivial</span><span class="val">${escapeHtml(title)}</span></div>` +
        `<div class="ln"><span class="k">CAS</span><span class="val cas">${cas}${cas !== "—" ? " ✓" : ""}</span></div>`;
    } catch (e) {
      box.innerHTML = `<div class="ln"><span class="val" style="color:var(--bad)">No match found, or network unavailable.</span></div>`;
    } finally {
      els.getName.disabled = false;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function buildSuppliers() {
    const link = (label, href) => `<a target="_blank" rel="noopener" href="${href}">${label}</a>`;
    els.suppliers.innerHTML = [
      link("BLD Pharm", "https://www.bldpharm.com/products/search.html?key="),
      link("TCI", "https://www.tcichemicals.com/US/en/search/?text="),
      link("Sigma-Aldrich", "https://www.sigmaaldrich.com/US/en/search/"),
    ].join("");
  }

  function init() {
    buildSuppliers();
    els.smiles.addEventListener("input", debounced);
    els.getName.addEventListener("click", pubchemLookup);
    // first paint
    showError("");
    window.RDKitBench.ready.then(() => { if (els.smiles.value.trim()) run(); });
  }

  window.Bench = window.Bench || {};
  window.Bench.structure = { init };
})();
