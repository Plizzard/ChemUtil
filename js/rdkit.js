/* ============================================================
   rdkit.js — thin wrapper over RDKit MinimalLib (WASM)
   - initialises with CoordGen (bridged/cage systems depict correctly)
   - renders SMILES to an SVG recoloured for the dark instrument theme
   - extracts the descriptor set used by the structure panel
   No SMILES ever leaves the device here. PubChem is a separate, opt-in call.
   ============================================================ */
window.RDKitBench = (function () {
  let RDKit = null;
  let readyResolve;
  const ready = new Promise((res) => (readyResolve = res));

  async function init() {
    if (RDKit) return RDKit;
    // initRDKitModule is provided by the RDKit_minimal.js script tag.
    // locateFile points the loader at the self-hosted .wasm (same folder as the JS).
    RDKit = await window.initRDKitModule({
      locateFile: (file) => "./lib/" + file,
    });
    // CoordGen gives correct 2D layouts for bridged cage systems (e.g. triptycene)
    try { RDKit.prefer_coordgen(true); } catch (_) {}
    readyResolve(RDKit);
    return RDKit;
  }

  // Recolour RDKit's default (black-on-white) SVG for the dark theme:
  // strip the opaque background, turn the black carbon skeleton phosphor-green,
  // keep CPK heteroatom colours so chemistry stays readable.
  function themeSvg(svg) {
    return svg
      // RDKit emits the XML prolog; harmless but drop it for clean innerHTML
      .replace(/<\?xml[^>]*\?>/i, "")
      // drop RDKit's opaque background: <rect ...fill:#FFFFFF...> </rect> (paired, not self-closing)
      .replace(/<rect[^>]*?fill:#FFFFFF[^>]*?>\s*(?:<\/rect>)?/gi, "")
      // carbon skeleton (bonds + any C labels): black -> phosphor green; keep CPK heteroatom colours
      .replace(/#000000/gi, "#5dffa0");
  }

  // Returns { ok, svg?, descriptors?, error? }
  function analyse(smiles, w, h) {
    if (!RDKit) return { ok: false, error: "Engine still loading…" };
    const s = (smiles || "").trim();
    if (!s) return { ok: false, error: "" };
    let mol = null;
    try {
      mol = RDKit.get_mol(s);
      if (!mol || !mol.is_valid()) {
        return { ok: false, error: "Not a valid SMILES." };
      }
      const svg = themeSvg(mol.get_svg(w || 380, h || 300));
      const desc = JSON.parse(mol.get_descriptors());
      return { ok: true, svg, descriptors: normaliseDesc(desc) };
    } catch (e) {
      return { ok: false, error: "Could not parse that structure." };
    } finally {
      if (mol) mol.delete();
    }
  }

  function normaliseDesc(d) {
    // Map RDKit MinimalLib keys to the panel's vocabulary.
    return {
      mw:        d.amw,
      exact:     d.exactmw,
      tpsa:      d.tpsa,
      clogp:     d.CrippenClogP,
      hbd:       d.lipinskiHBD ?? d.NumHBD,
      hba:       d.lipinskiHBA ?? d.NumHBA,
      rotb:      d.NumRotatableBonds,
      fsp3:      d.FractionCSP3,
      aromRings: d.NumAromaticRings,
      heavy:     d.NumHeavyAtoms,
    };
  }

  return { init, ready, analyse };
})();
