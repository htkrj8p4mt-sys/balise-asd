(() => {
  "use strict";

  // ---------- Référentiels ----------
  const SEG = [["civil", "Aéronautique civile"], ["spatial", "Spatial"], ["defense", "Défense aéro & spatiale"]];
  const MAIL = [
    ["mat", "Matériaux & matières critiques"],
    ["elec", "Électronique & composants"],
    ["prop", "Propulsion"],
    ["struct", "Aérostructures & équipements"],
    ["sys", "Systèmes complets & programmes"],
    ["num", "Logiciel, données & connectivité"],
    ["serv", "Services, MRO & énergie"],
    ["comp", "Compétences & cadences"],
    ["fin", "Financement & cadre politique"]
  ];
  const NAT = { atout: "Force", manque: "Manque", dependance: "Dépendance", besoin: "Besoin" };
  const NAT_HELP = {
    atout: "Une position de force : leader, succès commercial, capacité souveraine, financement acquis.",
    manque: "Une capacité, une compétence ou une ressource qui fait défaut, ou un programme en difficulté.",
    dependance: "Un approvisionnement ou une technologie qui dépend d'un pays hors Union européenne.",
    besoin: "Une demande nouvelle ou en hausse : marché, réglementation, programme, commande publique."
  };
  const FAM = {
    force: { l: "Forces", nats: ["atout"], col: "atout", help: "Ce sur quoi la France et l'Europe peuvent s'appuyer." },
    fragilite: { l: "Fragilités", nats: ["manque", "dependance"], col: "manque", help: "Manques de capacités et dépendances hors UE." },
    besoin: { l: "Besoins du marché", nats: ["besoin"], col: "besoin", help: "Là où la demande attend des réponses : opportunités." }
  };
  const FAM_KEYS = ["force", "fragilite", "besoin"];
  const famOf = n => n === "atout" ? "force" : n === "besoin" ? "besoin" : "fragilite";
  const GEO = { FR: "France", EU: "Europe" };
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const segName = k => (SEG.find(s => s[0] === k) || [k, k])[1];
  const mailName = k => (MAIL.find(s => s[0] === k) || [k, k])[1];
  const NEW_DAYS = 60;

  // ---------- Stockage local (confort par lecteur) ----------
  const ls = {
    get(k, d) { try { const v = localStorage.getItem("balise:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("balise:" + k, JSON.stringify(v)); } catch { /* indisponible */ } }
  };

  // ---------- État ----------
  let DATA = null, signals = [];
  const TABS = [["radar", "Radar", "M12 12l6-6M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5"], ["etat", "État des lieux", "M4 19V9m6 10V5m6 14v-7m4 7H3"], ["news", "Actualités", "M5 5h14v14H5zM8 9h8M8 13h8M8 17h5"], ["carte", "Cartographie", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"], ["dep", "Dépendances", "M4 7h5c5 0 5 10 11 10M4 17h5c5 0 5-10 11-10"], ["risques", "Risques", "M12 4l9 16H3zM12 10v4M12 17v.5"], ["pays", "Pays", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"], ["leaders", "Leaders", "M12 4l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z"]];
  const POS = { forte: ["Position française forte", "atout"], moyenne: ["Position française moyenne", "dependance"], faible: ["Position française faible", "manque"] };
  const st = {
    tab: TABS.some(t => t[0] === ls.get("tab", "radar")) ? ls.get("tab", "radar") : "radar",
    mode: "bilan",
    sel: null,
    f: { period: "90", seg: "", fam: "", geo: "", m: "", q: "" },
    lf: { seg: "", geo: "" },
    depOrig: "",
    dv: { seg: "", geo: "" },
    riskSel: null,
    editor: false, adding: false, draft: emptyDraft(), analysing: false, saving: false, flash: null, confirmDel: null,
    ai: {},
    newsView: "analyse",
    etatSeg: "civil",
    radarSel: null,
    radarOff: [],
  };
  function emptyDraft() {
    return { raw: "", t: "", s: "", d: new Date().toISOString().slice(0, 10), seg: "civil", m: "sys", n: "besoin", geo: "FR", imp: "2", act: "", orig: "", src: "", u: "" };
  }
  let sample = null, art = null;

  // ---------- Utilitaires ----------
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const parts = d => String(d || "").split("-").map(Number);
  const toDate = d => { const [y, m, j] = parts(d); return new Date(y || 2000, (m || 1) - 1, j || 1); };
  const dateKey = d => { const [y, m, j] = parts(d); return [y || 0, m || 0, j || 0].map((v, i) => String(v).padStart(i ? 2 : 4, "0")).join("-"); };
  const fmtD = d => { const [y, m, j] = parts(d); if (!y) return "—"; if (!m) return String(y); return (j ? j + " " : "") + MONTHS[m - 1] + " " + y; };
  const byDate = (a, b) => dateKey(b.d).localeCompare(dateKey(a.d)) || (b.imp - a.imp);
  const byWeight = (a, b) => (b.imp - a.imp) || dateKey(b.d).localeCompare(dateKey(a.d));
  const ageDays = s => (Date.now() - toDate(s.d).getTime()) / 864e5;
  const isNew = s => s.k === "actu" && ageDays(s) <= NEW_DAYS;
  const impDots = n => "●".repeat(n) + "○".repeat(3 - n);
  const origins = s => String(s.orig || "").split("/").map(x => x.trim()).filter(Boolean);
  const link = (u, label) => u ? `<a class="src-link" href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : esc(label);
  const srcInfo = (u, label) => (u || label) ? `<details class="srcd"><summary title="Voir la source" aria-label="Voir la source">i</summary><span>${link(u, label || "Source")}</span></details>` : "";
  const sum = s => s.r || s.t;
  const WHY = { atout: "Pourquoi c'est une force", manque: "Pourquoi c'est un manque", dependance: "Pourquoi c'est une dépendance", besoin: "Pourquoi c'est un besoin du marché" };
  const whyBlock = s => s.why ? `<p class="why ${s.n}"><b>${WHY[s.n] || "Pourquoi"} :</b> ${esc(s.why)}</p>` : "";
  const srcLine = s => (s.u || s.src) ? `<span class="src">Source : ${link(s.u, s.src || "lien")}</span>` : "";
  const opt = (v, l, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(l)}</option>`;

  function stats(list) {
    const c = { atout: 0, besoin: 0, manque: 0, dependance: 0 }, w = { atout: 0, besoin: 0, manque: 0, dependance: 0 };
    list.forEach(s => { if (c[s.n] != null) { c[s.n]++; w[s.n] += Number(s.imp) || 1; } });
    const fw = { force: w.atout, fragilite: w.manque + w.dependance, besoin: w.besoin };
    const fc = { force: c.atout, fragilite: c.manque + c.dependance, besoin: c.besoin };
    return { c, w, fw, fc, tension: fw.fragilite - fw.force, total: list.length };
  }
  function verdict(x) {
    if (!x.total) return { l: "Pas de signal", cls: "" };
    if (x.fw.force >= x.fw.fragilite * 1.3) return { l: "Position solide", cls: "atout" };
    if (x.fw.force >= x.fw.fragilite * 0.8) return { l: "Position contrastée", cls: "dependance" };
    return { l: "Position fragilisée", cls: "manque" };
  }
  function cellState(x) {
    if (!x.total) return "Aucun signal";
    if (x.tension >= 5) return "Fragile";
    if (x.tension >= 2) return "Sous tension";
    if (x.tension > -2) return "Contrasté";
    if (x.tension > -5) return "Solide";
    return "Point fort";
  }
  function tint(col, p) { return p ? `background:color-mix(in oklab, var(--${col}) ${Math.min(p, 50)}%, var(--surface))` : ""; }
  function cellStyle(x) {
    if (!x.total) return "";
    if (st.mode === "force") return tint("atout", x.fw.force * 9);
    if (st.mode === "fragilite") return tint("manque", x.fw.fragilite * 9);
    if (st.mode === "besoin") return tint("besoin", x.fw.besoin * 9);
    return tint(x.tension > 0 ? "manque" : "atout", Math.abs(x.tension) * 8);
  }
  const natPill = s => `<span class="pill ${s.n}">${NAT[s.n] || s.n}</span>`;
  const geoPill = s => s.geo ? `<span class="pill geo">${GEO[s.geo] || s.geo}</span>` : "";
  const newPill = s => isNew(s) ? `<span class="newb">Nouveau</span>` : "";

  // ---------- Menu et compteurs
  const inDays = (s, n) => s.k === "actu" && ageDays(s) <= n;
  function renderSide() {
    return `<aside class="side">
      <div class="logo"><span class="logo-mark"></span>Balise ASD</div>
      <nav class="tabs" role="tablist">${TABS.map(([k, l, ico]) => `<button role="tab" data-act="tab" data-v="${k}" aria-selected="${st.tab === k}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ico}"/></svg>${l}</button>`).join("")}</nav>
      <div class="status"><span class="live"></span><span>Veille active<br><small>Données du ${esc(fmtD(DATA.updated))}</small></span></div>
    </aside>`;
  }
  function renderMetrics() {
    const r30 = signals.filter(s => inDays(s, 30));
    const frag = r30.filter(s => s.n === "manque" || s.n === "dependance").length;
    const best = r30.filter(s => s.n === "besoin").length;
    const force = r30.filter(s => s.n === "atout").length;
    const ao = (DATA.tenders || []).filter(t => t.id.startsWith("ted-")).length;
    const m = (cls, v, l, tab) => `<button class="metric ${cls}" data-act="tab" data-v="${tab}"><b>${v}</b><span>${l}</span></button>`;
    return `<div class="metrics">
      ${m("atout", force, "forces, 30 jours", "etat")}
      ${m("manque", frag, "fragilités, 30 jours", "risques")}
      ${m("besoin", best, "besoins, 30 jours", "pays")}
      ${m("ao", ao, "appels d'offres ouverts", "pays")}
    </div>`;
  }

  // ---------- Radar de tendances
  const RING = [[30, "30 jours"], [90, "3 mois"], [365, "12 mois"]];
  const NAT_ALL = ["atout", "manque", "dependance", "besoin"];
  function radarData() {
    const out = [];
    const W = 360 / SEG.length;
    SEG.forEach(([sk], si) => {
      RING.forEach(([days], ri) => {
        const min = ri ? RING[ri - 1][0] : -1;
        const list = signals.filter(s => s.k === "actu" && s.seg === sk && !st.radarOff.includes(s.n) && ageDays(s) > min && ageDays(s) <= days).sort(byDate);
        list.forEach((s, i) => {
          const ang = si * W + 8 + (i + 1) / (list.length + 1) * (W - 16) - 90;
          const band = [[34, 104], [122, 192], [210, 280]][ri];
          const r = band[0] + (band[1] - band[0]) * [.25, .75, .5][i % 3];
          const a = ang * Math.PI / 180;
          out.push({ s, x: 320 + r * Math.cos(a), y: 320 + r * Math.sin(a) });
        });
      });
    });
    return out;
  }
  function renderRadar() {
    const blips = radarData();
    const W = 360 / SEG.length;
    const sel = signals.find(s => s.id === st.radarSel) || (blips.slice().sort((a, b) => b.s.imp - a.s.imp || byDate(a.s, b.s))[0] || {}).s;
    const rings = [104, 192, 280].map(r => `<circle cx="320" cy="320" r="${r}" class="r-ring"/>`).join("");
    const spokes = SEG.map((_, i) => { const a = (i * W - 90) * Math.PI / 180; return `<line x1="320" y1="320" x2="${320 + 280 * Math.cos(a)}" y2="${320 + 280 * Math.sin(a)}" class="r-ring"/>`; }).join("");
    const labels = SEG.map(([, l], i) => { const a = (i * W + W / 2 - 90) * Math.PI / 180; return `<text x="${320 + 302 * Math.cos(a)}" y="${320 + 302 * Math.sin(a)}" text-anchor="middle" dominant-baseline="middle" class="r-seg">${esc(l)}</text>`; }).join("");
    const ringL = RING.map(([, l], i) => `<text x="324" y="${320 - [104, 192, 280][i] + 13}" class="r-lab">${l}</text>`).join("");
    const dots = blips.map(({ s, x, y }) => `<g class="blip ${s.n}${sel && sel.id === s.id ? " sel" : ""}" data-act="radar-sel" data-id="${esc(s.id)}" tabindex="0"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${3 + s.imp * 2}"/><title>${esc(s.t)}</title></g>`).join("");
    const r30 = signals.filter(s => inDays(s, 30)), prev = signals.filter(s => s.k === "actu" && ageDays(s) > 30 && ageDays(s) <= 90);
    const trends = MAIL.map(([k, l]) => { const now = r30.filter(s => s.m === k).length, before = prev.filter(s => s.m === k).length / 2; return { k, l, now, d: now - before }; })
      .filter(t => t.now).sort((a, b) => b.d - a.d || b.now - a.now).slice(0, 5);
    const max = Math.max(1, ...trends.map(t => t.now));
    return `<section class="intro"><div class="stack"><h2>Radar de tendances</h2><p>Chaque point est un fait récent : plus il est près du centre, plus il est frais, plus il est gros, plus il compte. <b>Cliquez un point</b> pour le lire.</p></div></section>
      <div class="legend-chips">${NAT_ALL.map(n => `<button class="chip ${n}" data-act="radar-off" data-v="${n}" aria-pressed="${!st.radarOff.includes(n)}"><i></i>${NAT[n]}</button>`).join("")}</div>
      <div class="radar-wrap">
        <div class="radar-box"><svg class="radar" viewBox="-90 0 820 640" role="img" aria-label="Radar des tendances">
          <circle cx="320" cy="320" r="280" class="r-bg"/>
          <g class="sweep"><path d="M320 320 L320 40 A280 280 0 0 1 518 122 Z"/></g>
          ${rings}${spokes}${ringL}${labels}${dots}
        </svg></div>
        <div class="radar-side">
          ${sel ? `<div class="detail ${sel.n}"><div class="sig-meta">${natPill(sel)}<span class="when-i">${esc(segName(sel.seg))} · ${esc(fmtD(sel.d))}</span></div>
            <b>${esc(sum(sel))}</b>${whyBlock(sel)}${srcLine(sel)}
            <button class="btn small" data-act="goto" data-seg="${esc(sel.seg)}" data-m="${esc(sel.m)}">Voir dans la cartographie →</button></div>` : `<p class="msg">Aucun point pour ce filtre.</p>`}
          <div class="box trends"><h3>Sujets qui montent (30 jours)</h3>
            ${trends.map(t => `<button class="trend" data-act="trend" data-v="${t.k}"><span class="t-l">${esc(t.l)}</span><span class="t-b"><i style="width:${(t.now / max * 100).toFixed(0)}%"></i></span><span class="t-n">${t.now}</span><span class="t-d ${t.d > 0 ? "up" : t.d < 0 ? "down" : ""}">${t.d > 0 ? "▲" : t.d < 0 ? "▼" : "="}</span></button>`).join("") || `<p class="note">Pas assez de données récentes.</p>`}
          </div>
        </div>
      </div>`;
  }

  // ---------- État des lieux ----------
  function sigLine(s, showSeg) {
    return `<button class="sig" data-act="open-sig" data-seg="${esc(s.seg)}" data-m="${esc(s.m)}">
      <span class="sig-meta">${natPill(s)}${geoPill(s)}${newPill(s)}<span class="when-i">${esc(fmtD(s.d))}</span>${showSeg ? `<span class="when-i">· ${esc(segName(s.seg))}</span>` : ""}</span>
      <span class="sig-t">${esc(sum(s))}</span>
    </button>`;
  }
  function renderEtat() {
    const ov = DATA.overview || {};
    const kpis = (DATA.kpis || []).filter(k => k.seg === st.etatSeg).map(k => `<div class="kpi">
        <span class="eyebrow">${esc(segName(k.seg))}</span>
        <span class="kpi-v">${esc(k.value)}</span>
        <span class="kpi-l">${esc(k.label)}</span>
        <span class="kpi-n">${esc(k.note || "")} ${srcInfo(k.u, "Source")}</span>
      </div>`).join("");
    const segSections = SEG.filter(([sk]) => sk === st.etatSeg).map(([sk, sl]) => {
      const o = ov[sk] || {};
      const stat = l => verdict(stats(signals.filter(s => s.seg === sk && l(s))));
      const vf = stat(s => s.geo === "FR"), ve = stat(s => s.geo !== "FR");
      const cols = FAM_KEYS.map(fk => {
        const key = fk === "force" ? "forces" : fk === "fragilite" ? "fragilites" : "besoins";
        return `<div class="fam ${FAM[fk].col}"><h3>${FAM[fk].l}</h3><ul class="clist">${(o[key] || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
      }).join("");
      return `<section class="segsec">
        <div class="segsec-h"><h2>${esc(sl)}</h2><button class="btn small ghost" data-act="seg-map" data-seg="${sk}">Voir sur la cartographie →</button></div>
        <div class="pos">
          <div><div class="pos-h"><span class="eyebrow">Position de la France</span><span class="pill ${vf.cls}">${vf.l}</span></div><p>${esc(o.fr || "")}</p></div>
          <div><div class="pos-h"><span class="eyebrow">Position de l'Europe</span><span class="pill ${ve.cls}">${ve.l}</span></div><p>${esc(o.eu || "")}</p></div>
        </div>
        <div class="fam-cols">${cols}</div>
      </section>`;
    }).join("");
    const watch = (DATA.watch || []).filter(w => w.seg === st.etatSeg).sort((a, b) => dateKey(a.d).localeCompare(dateKey(b.d))).map(w => `<li>
        <span class="mono w-d">${esc(fmtD(w.d))}</span>
        <div><span class="pill tag">${esc(segName(w.seg))}</span> <b>${esc(w.t)}</b><p class="note">${esc(w.why)}</p></div>
      </li>`).join("");
    return `<section class="intro"><div class="stack"><span class="eyebrow">Au ${esc(fmtD(DATA.updated))}</span><h2>État des lieux du marché</h2>
        <p>La synthèse du marché, sans les articles (ils sont dans Actualités). Choisissez un secteur.</p></div></section>
      <div class="box"><h3>En bref</h3><ul class="bullets">${(ov.bref || []).map(b => `<li>${esc(b)}</li>`).join("")}</ul></div>
      <div class="seg-ctl etat-switch" role="group" aria-label="Secteur">${SEG.map(([k, l]) => `<button data-act="etat-seg" data-v="${k}" aria-pressed="${st.etatSeg === k}">${l}</button>`).join("")}</div>
      <div class="kpis">${kpis}</div>
      ${segSections}
      <section class="box"><h3>Échéances à surveiller</h3><ol class="watch">${watch || `<li><p class="note">Aucune échéance pour ce secteur.</p></li>`}</ol></section>`;
  }

  // ---------- Cartographie ----------
  function renderMap() {
    
    let grid = `<div></div>` + SEG.map(([, l]) => `<div class="colh">${esc(l)}</div>`).join("");
    MAIL.forEach(([mk, ml]) => {
      grid += `<div class="rowh">${esc(ml)}</div>`;
      SEG.forEach(([sk]) => {
        const list = signals.filter(s => s.seg === sk && s.m === mk);
        const x = stats(list);
        const dim = "";
        if (!x.total) { grid += `<div class="cell empty${dim}"><span class="state">Aucun signal</span></div>`; return; }
        const sel = st.sel && st.sel.seg === sk && st.sel.m === mk ? " sel" : "";
        const hasNew = list.some(isNew);
        const bars = FAM_KEYS.map(fk => `<span class="fb${st.mode !== "bilan" && st.mode !== fk ? " mute" : ""}"><span class="fb-l">${FAM[fk].l.split(" ")[0]}</span><span class="fb-t"><i style="width:${Math.min(x.fw[fk] / 7 * 100, 100).toFixed(0)}%;background:var(--${FAM[fk].col})"></i></span><span class="fb-n">${x.fc[fk]}</span></span>`).join("");
        grid += `<button class="cell${sel}${dim}" style="${cellStyle(x)}" data-act="cell" data-seg="${sk}" data-m="${mk}" aria-label="${esc(segName(sk) + ", " + ml + " : " + cellState(x))}">
          <span class="state">${cellState(x)}${hasNew ? ` <span class="newb">Nouveau</span>` : ""}</span>
          ${bars}
        </button>`;
      });
    });
    const scale = {
      bilan: `<span class="scale"><span>point fort</span><i></i><span>fragile</span></span>`,
      force: `<span class="scale one" style="--c:var(--atout)"><span>peu</span><i></i><span>forces marquées</span></span>`,
      fragilite: `<span class="scale one" style="--c:var(--manque)"><span>peu</span><i></i><span>fragilités marquées</span></span>`,
      besoin: `<span class="scale one" style="--c:var(--besoin)"><span>peu</span><i></i><span>forte demande</span></span>`
    }[st.mode];
    return `<section class="intro">
        <div class="stack"><h2>Cartographie de la chaîne de valeur</h2>
          <p>Chaque case croise un maillon et un secteur. Les trois barres mesurent séparément les forces, les fragilités et les besoins, pondérés par l'impact. Cliquez une case pour le détail et la lecture stratégique.</p></div>
        <div class="seg-ctl" role="group" aria-label="Lecture de la carte">
          ${[["bilan", "Bilan"], ["force", "Forces"], ["fragilite", "Fragilités"], ["besoin", "Besoins"]].map(([k, l]) => `<button data-act="mode" data-v="${k}" aria-pressed="${st.mode === k}">${l}</button>`).join("")}
        </div>
      </section>
      <div class="legend">${scale}</div>
      <div class="map-scroll"><div class="map">${grid}</div></div>`;
  }

  function renderDrawer() {
    if (!st.sel) return "";
    const { seg, m } = st.sel;
    const list = signals.filter(s => s.seg === seg && s.m === m).sort(byDate);
    const x = stats(list);
    const actors = [...new Set(list.flatMap(s => s.act || []))];
    const key = seg + ":" + m, ai = st.ai[key] || {};
    const groups = FAM_KEYS.filter(fk => x.fc[fk]).map(fk => `<div class="group">
        <h3 class="fam-h ${FAM[fk].col}">${FAM[fk].l} <span class="count">${x.fc[fk]}</span></h3>
        ${list.filter(s => famOf(s.n) === fk).map(miniItem).join("")}
      </div>`).join("");
    let aiBlock = "";
    if (sample) {
      if (ai.busy) aiBlock = `<div class="ai"><h4>Lecture stratégique</h4><p class="note">Analyse en cours… (10 à 40 secondes)</p></div>`;
      else if (ai.data) aiBlock = renderAi(ai.data);
      else aiBlock = `<div class="ai"><h4>Lecture stratégique</h4><p class="note">Claude résume la position française et européenne sur cette case et propose des pistes d'action.</p>${ai.err ? `<p class="msg err">${esc(ai.err)}</p>` : ""}<div><button class="btn accent small" data-act="ai-cell">Générer la lecture</button></div></div>`;
    }
    return `<div class="scrim" data-act="close"></div>
    <aside class="drawer" role="dialog" aria-label="Détail de la case">
      <header>
        <div class="row">
          <div class="stack"><span class="eyebrow">${esc(segName(seg))}</span><h2>${esc(mailName(m))}</h2></div>
          <button class="x" data-act="close" aria-label="Fermer">×</button>
        </div>
        <div class="legend"><span class="pill tag">${cellState(x)}</span>${FAM_KEYS.map(fk => `<span><span class="dot ${FAM[fk].col}"></span>${FAM[fk].l} : ${x.fc[fk]}</span>`).join("")}</div>
      </header>
      <div class="body">
        ${aiBlock}
        ${groups}
        ${actors.length ? `<div class="group"><h3>Acteurs cités</h3><div class="actors">${actors.map(a => `<span>${esc(a)}</span>`).join("")}</div></div>` : ""}
      </div>
    </aside>`;
  }
  function miniItem(s) {
    return `<div class="mini ${s.n}"><small>${natPill(s)} ${geoPill(s)} ${newPill(s)} ${esc(fmtD(s.d))}${s.orig ? " · origine : " + esc(s.orig) : ""}</small><b>${esc(sum(s))}</b>${whyBlock(s)}${srcLine(s)}</div>`;
  }
  function renderAi(d) {
    const list = (title, arr, col) => Array.isArray(arr) && arr.length ? `<div><h4 class="fam-h ${col}">${title}</h4><ul>${arr.map(v => `<li>${esc(v)}</li>`).join("")}</ul></div>` : "";
    return `<div class="ai">
      <h4>Lecture stratégique</h4>
      ${d.france ? `<p><b>France.</b> ${esc(d.france)}</p>` : ""}
      ${d.europe ? `<p><b>Europe.</b> ${esc(d.europe)}</p>` : ""}
      ${list("Forces", d.forces, "atout")}${list("Fragilités", d.fragilites, "manque")}${list("Besoins du marché", d.besoins, "besoin")}${list("Pistes d'action", d.pistes, "")}
      <p class="note">Générée par Claude à partir des signaux de la case. À vérifier avant toute décision.</p>
    </div>`;
  }
  async function aiCell() {
    const { seg, m } = st.sel; const key = seg + ":" + m;
    const list = signals.filter(s => s.seg === seg && s.m === m).sort(byDate);
    st.ai[key] = { busy: true }; render();
    const prompt = `Tu es analyste en market intelligence sur la filière aéronautique et spatiale, civile et de défense (France et Europe). Nous sommes le ${fmtD(DATA.updated)}.
Voici les signaux de veille pour le maillon « ${mailName(m)} » du secteur « ${segName(seg)} ».
Rédige une lecture stratégique courte et précise, en français clair, qui sépare bien les forces, les fragilités et les besoins du marché.
Réponds uniquement avec un objet JSON :
{"france":"2 phrases sur la position française","europe":"1 à 2 phrases sur la position européenne","forces":["..."],"fragilites":["..."],"besoins":["..."],"pistes":["action concrète pour une entreprise ou un décideur"]}
Chaque liste contient 0 à 4 phrases courtes. Privilégie les signaux récents, cite les chiffres des signaux, reste prudent sur ce qui n'y figure pas.

Signaux (les plus récents d'abord) :
${list.map(s => `- [${FAM[famOf(s.n)].l} / ${NAT[s.n]}, ${GEO[s.geo] || ""}, impact ${s.imp}/3, ${fmtD(s.d)}] ${sum(s)} ${s.s || ""} Raison du classement : ${s.why || ""}${s.orig ? " (origine : " + s.orig + ")" : ""}`).join("\n")}`;
    try {
      const data = await sample.json(prompt);
      st.ai[key] = { data: data && typeof data === "object" ? data : { france: String(data) } };
    } catch (e) {
      st.ai[key] = { err: sampleErr(e) };
      if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e && e.code)) sample = null;
    }
    render();
  }
  function sampleErr(e) {
    const c = e && e.code;
    if (c === "rate_limited") return "Trop de demandes pour le moment. Réessayez dans quelques minutes.";
    if (c === "not_granted") return "L'accès à Claude n'a pas été autorisé pour cette page.";
    if (c === "invalid_json") return "La réponse n'a pas pu être lue. Réessayez.";
    if (c === "session_expired") return "Votre session a expiré. Reconnectez-vous à Claude.";
    if (c === "cancelled") return "";
    return "L'analyse n'a pas abouti. Réessayez.";
  }

  // ---------- Nouveautés (fil de veille) ----------
  function filtered() {
    const q = st.f.q.trim().toLowerCase();
    const maxAge = st.f.period === "all" ? Infinity : Number(st.f.period);
    return signals.filter(s =>
      (maxAge === Infinity || ageDays(s) <= maxAge) &&
      (!st.f.seg || s.seg === st.f.seg) && (!st.f.fam || famOf(s.n) === st.f.fam) && (!st.f.geo || s.geo === st.f.geo) && (!st.f.m || s.m === st.f.m) &&
      (!q || [s.t, s.r, s.why, s.s, (s.act || []).join(" "), s.orig, s.src].join(" ").toLowerCase().includes(q))
    ).sort(byDate);
  }
  function feedItem(s) {
    const del = st.editor ? (st.confirmDel === s.id
      ? `<span class="actions"><button class="btn danger small" data-act="del-confirm" data-id="${esc(s.id)}">Confirmer le retrait</button><button class="btn ghost small" data-act="del-cancel">Annuler</button></span>`
      : `<button class="link" data-act="del" data-id="${esc(s.id)}">Retirer</button>`) : "";
    return `<article class="item fam-${famOf(s.n)}">
      <div class="when">${esc(fmtD(s.d))}${isNew(s) ? `<br><span class="newb">Nouveau</span>` : ""}</div>
      <div class="content">
        <div class="meta"><span class="pill fam ${FAM[famOf(s.n)].col}">${FAM[famOf(s.n)].l}</span>${s.n !== "atout" && s.n !== "besoin" ? natPill(s) : ""}${geoPill(s)}<span class="pill tag">${esc(segName(s.seg))}</span><button class="link" data-act="goto" data-seg="${esc(s.seg)}" data-m="${esc(s.m)}">${esc(mailName(s.m))}</button><span class="imp" title="Impact">${impDots(Number(s.imp) || 1)}</span></div>
        <h3>${esc(sum(s))}</h3>
        ${whyBlock(s)}
        <div class="meta">${(s.act || []).length ? `<span class="actors">${s.act.map(a => `<span>${esc(a)}</span>`).join("")}</span>` : ""}${s.orig ? `<span class="pill dependance">Origine : ${esc(s.orig)}</span>` : ""}</div>
        <div class="meta">${srcLine(s)}${del}</div>
      </div>
    </article>`;
  }
  function renderFeedList() {
    const list = filtered();
    return list.length ? list.map(feedItem).join("") : `<p class="msg">Aucun signal ne correspond à ces filtres. Élargissez la période.</p>`;
  }
  function newsSwitch() {
    return `<div class="seg-ctl" role="group" aria-label="Type d'actualités">${[["analyse", "Analysées"], ["flux", "Flux direct"]].map(([k, l]) => `<button data-act="news-view" data-v="${k}" aria-pressed="${st.newsView === k}">${l}</button>`).join("")}</div>`;
  }
  function renderNews() {
    if (st.newsView === "flux") return renderFlux();
    const periods = [["30", "30 jours"], ["90", "3 mois"], ["365", "12 mois"], ["all", "Tout"]];
    return `<section class="intro">
        <div class="stack"><h2>Actualités</h2><p>Les faits résumés et expliqués, du plus récent au plus ancien, classés comme force, fragilité ou besoin du marché.</p></div>${newsSwitch()}
        ${st.editor && !st.adding ? `<button class="btn accent" data-act="add-open">Ajouter un signal</button>` : ""}
      </section>
      ${st.flash ? `<p class="msg${st.flash.err ? " err" : ""}">${esc(st.flash.text)}</p>` : ""}
      ${st.adding ? renderAdd() : ""}
      <div class="seg-ctl" role="group" aria-label="Période">${periods.map(([k, l]) => `<button data-act="period" data-v="${k}" aria-pressed="${st.f.period === k}">${l}</button>`).join("")}</div>
      <div class="filters">
        <div class="field"><label for="f-q">Rechercher</label><input id="f-q" type="search" placeholder="Safran, titane, IRIS²…" value="${esc(st.f.q)}"></div>
        <div class="field"><label for="f-fam">Lecture</label><select id="f-fam">${opt("", "Toutes", st.f.fam)}${FAM_KEYS.map(k => opt(k, FAM[k].l, st.f.fam)).join("")}</select></div>
        <div class="field"><label for="f-seg">Secteur</label><select id="f-seg">${opt("", "Tous", st.f.seg)}${SEG.map(([k, l]) => opt(k, l, st.f.seg)).join("")}</select></div>
        <div class="field"><label for="f-geo">Portée</label><select id="f-geo">${opt("", "France et Europe", st.f.geo)}${opt("FR", "France", st.f.geo)}${opt("EU", "Europe", st.f.geo)}</select></div>
        <div class="field"><label for="f-m">Maillon</label><select id="f-m">${opt("", "Tous", st.f.m)}${MAIL.map(([k, l]) => opt(k, l, st.f.m)).join("")}</select></div>
      </div>
      <p class="count" id="feed-count">${filtered().length} signal(s)</p>
      <div class="feed" id="feed-list">${renderFeedList()}</div>`;
  }
  function renderAdd() {
    const d = st.draft;
    return `<div class="panel">
      <div class="stack"><h3 class="panel-h">Nouveau signal</h3>
      <p class="note">Collez un extrait d'article ou décrivez l'événement. ${sample ? "Claude peut pré-remplir le classement ; vous le vérifiez avant de publier." : "Remplissez les champs puis publiez."}</p></div>
      <div class="field"><label for="add-raw">Texte source</label><textarea id="add-raw" placeholder="Ex. : Safran annonce l'ouverture d'une nouvelle usine…">${esc(d.raw)}</textarea></div>
      ${sample ? `<div class="actions"><button class="btn" data-act="add-analyse"${st.analysing ? " disabled" : ""}>${st.analysing ? "Analyse en cours…" : "Analyser avec Claude"}</button><span class="note">Classement proposé en 10 à 30 secondes.</span></div>` : ""}
      <div class="grid2">
        <div class="field wide"><label for="add-t">Mini résumé (1 phrase)</label><input id="add-t" value="${esc(d.t)}"></div>
        <div class="field wide"><label for="add-s">Pourquoi ce classement</label><textarea id="add-s">${esc(d.s)}</textarea></div>
        <div class="field"><label for="add-d">Date (AAAA-MM-JJ)</label><input id="add-d" value="${esc(d.d)}"></div>
        <div class="field"><label for="add-seg">Secteur</label><select id="add-seg">${SEG.map(([k, l]) => opt(k, l, d.seg)).join("")}</select></div>
        <div class="field"><label for="add-m">Maillon</label><select id="add-m">${MAIL.map(([k, l]) => opt(k, l, d.m)).join("")}</select></div>
        <div class="field"><label for="add-n">Nature</label><select id="add-n">${Object.keys(NAT).map(n => opt(n, FAM[famOf(n)].l + " · " + NAT[n], d.n)).join("")}</select></div>
        <div class="field"><label for="add-geo">Portée</label><select id="add-geo">${opt("FR", "France", d.geo)}${opt("EU", "Europe", d.geo)}</select></div>
        <div class="field"><label for="add-imp">Impact</label><select id="add-imp">${opt("1", "1 · faible", d.imp)}${opt("2", "2 · notable", d.imp)}${opt("3", "3 · structurant", d.imp)}</select></div>
        <div class="field"><label for="add-orig">Pays d'origine (si dépendance)</label><input id="add-orig" value="${esc(d.orig)}" placeholder="États-Unis, Chine…"></div>
        <div class="field"><label for="add-act">Acteurs (séparés par des virgules)</label><input id="add-act" value="${esc(d.act)}"></div>
        <div class="field"><label for="add-src">Source</label><input id="add-src" value="${esc(d.src)}" placeholder="Média, communiqué, rapport…"></div>
        <div class="field"><label for="add-u">Lien de la source</label><input id="add-u" value="${esc(d.u)}" placeholder="https://…"></div>
      </div>
      <p class="note">${esc(NAT_HELP[d.n] || "")}</p>
      <div class="actions">
        <button class="btn accent" data-act="add-save"${st.saving ? " disabled" : ""}>${st.saving ? "Publication…" : "Publier dans la veille"}</button>
        <button class="btn ghost" data-act="add-cancel">Annuler</button>
      </div>
    </div>`;
  }
  async function analyseDraft() {
    const raw = st.draft.raw.trim();
    if (!raw) { st.flash = { err: true, text: "Collez d'abord un texte à analyser." }; render(); return; }
    st.analysing = true; st.flash = null; render();
    const prompt = `Tu classes des informations de market intelligence sur la filière aéronautique et spatiale, civile et de défense, du point de vue de la France et de l'Europe.
Lis le texte et réponds uniquement avec un objet JSON :
{"t":"mini résumé factuel en une phrase, avec les chiffres clés (pas un titre d'article)","s":"une phrase qui explique pourquoi ce fait est une force, un manque, une dépendance ou un besoin du marché pour la France ou l'Europe","d":"AAAA-MM-JJ ou AAAA-MM si connue, sinon chaîne vide","seg":"civil|spatial|defense","m":"${MAIL.map(x => x[0]).join("|")}","n":"atout|besoin|manque|dependance","geo":"FR|EU","imp":1,"act":["acteurs cités"],"orig":"pays hors UE dont on dépend, sinon chaîne vide"}
Maillons : ${MAIL.map(([k, l]) => k + " = " + l).join(" ; ")}.
Natures : ${Object.keys(NAT).map(n => n + " = " + NAT_HELP[n]).join(" ")}
geo : FR si le signal concerne surtout la position française, EU s'il concerne l'Europe dans son ensemble.
imp : 1 faible, 2 notable, 3 structurant pour la filière.

Texte :
${raw.slice(0, 8000)}`;
    try {
      const r = await sample.json(prompt);
      if (r && typeof r === "object") {
        const d = st.draft;
        if (r.t) d.t = String(r.t);
        if (r.s) d.s = String(r.s);
        if (/^\d{4}(-\d{2}){0,2}$/.test(r.d || "")) d.d = r.d;
        if (SEG.some(x => x[0] === r.seg)) d.seg = r.seg;
        if (MAIL.some(x => x[0] === r.m)) d.m = r.m;
        if (NAT[r.n]) d.n = r.n;
        if (GEO[r.geo]) d.geo = r.geo;
        if ([1, 2, 3].includes(Number(r.imp))) d.imp = String(Number(r.imp));
        if (Array.isArray(r.act)) d.act = r.act.map(String).join(", ");
        d.orig = r.orig ? String(r.orig) : "";
        st.flash = { text: "Classement proposé. Vérifiez les champs avant de publier." };
      }
    } catch (e) { const t = sampleErr(e); if (t) st.flash = { err: true, text: t }; }
    st.analysing = false; render();
  }
  async function saveDraft() {
    const d = st.draft;
    if (!d.t.trim() || !d.s.trim()) { st.flash = { err: true, text: "Le mini résumé et le « pourquoi » sont obligatoires." }; render(); return; }
    if (!/^\d{4}(-\d{2}){0,2}$/.test(d.d.trim())) { st.flash = { err: true, text: "La date doit être au format AAAA-MM-JJ, par exemple 2026-09-28." }; render(); return; }
    const sig = {
      id: "u" + Date.now().toString(36), k: "actu", d: d.d.trim(), seg: d.seg, m: d.m, n: d.n, imp: Number(d.imp) || 2, geo: d.geo,
      t: d.t.trim().slice(0, 140), r: d.t.trim(), why: d.s.trim(), s: "", act: d.act.split(",").map(x => x.trim()).filter(Boolean), orig: d.orig.trim(), src: d.src.trim(),
      u: /^https?:\/\//.test(d.u.trim()) ? d.u.trim() : ""
    };
    const ok = await persist([sig, ...signals]);
    if (ok) { st.adding = false; st.draft = emptyDraft(); st.flash = { text: "Signal publié. L'état des lieux et la cartographie sont à jour." }; }
    render();
  }
  async function persist(next) {
    if (!art) { st.flash = { err: true, text: "L'enregistrement n'est pas disponible dans cette vue." }; return false; }
    st.saving = true; render();
    const data = Object.assign({}, DATA, { updated: new Date().toISOString().slice(0, 10), signals: next });
    try {
      await art.publish({ "data.json": JSON.stringify(data, null, 1) });
      DATA = data; signals = next;
      return true;
    } catch (e) {
      const c = e && e.code;
      st.flash = { err: true, text:
        c === "conflict" ? "Une version plus récente vient d'être publiée (par exemple la mise à jour quotidienne). La page se recharge ; refaites votre ajout ensuite." :
        c === "not_writer" || c === "not_granted" || c === "capability_disabled" ? "Cette vue est en lecture seule : l'ajout n'est pas possible ici." :
        c === "rate_limited" ? "Trop de publications rapprochées. Patientez un peu." :
        c === "too_large" ? "La veille est devenue trop volumineuse pour être enregistrée." :
        "L'enregistrement a échoué. Réessayez." };
      if (["not_writer", "not_granted", "capability_disabled", "not_declared"].includes(c)) st.editor = false;
      return false;
    } finally { st.saving = false; }
  }

  // ---------- Leaders ----------
  function renderLeaders() {
    const L = (DATA.leaders || []).filter(l => !st.lf.seg || l.segs.includes(st.lf.seg));
    const groups = [...new Set(L.map(l => l.paysGroupe || (l.pays || "").split(" · ")[0]))];
    const card = l => `<article class="lcard">
        <div class="lcard-h"><h3>${esc(l.name)}</h3></div>
        <p class="note">${esc(l.metier)}</p>
        <div class="gb">
          <div class="gb-c bon"><h4>Bon en</h4>${(l.bon || []).map(x => `<div><b>${esc(x.t)}</b><span>${esc(x.ex)}</span></div>`).join("")}</div>
          <div class="gb-c moins"><h4>Moins bon en</h4>${(l.moins || []).map(x => `<div><b>${esc(x.t)}</b><span>${esc(x.ex)}</span></div>`).join("") || `<span class="note">Pas de faiblesse documentée à ce stade.</span>`}</div>
        </div>
      </article>`;
    return `<section class="intro"><div class="stack"><h2>Leaders</h2>
        <p>Les groupes qui structurent le marché, par pays : ce qu'ils font bien, ce qu'ils font moins bien, avec des exemples.</p></div></section>
      <div class="seg-ctl" role="group" aria-label="Secteur">${[["", "Tous"], ...SEG].map(([k, l]) => `<button data-act="lf-seg" data-v="${k}" aria-pressed="${st.lf.seg === k}">${l}</button>`).join("")}</div>
      ${groups.map(g => `<section class="lgroup"><h2>${esc(g)}</h2><div class="lgrid">${L.filter(l => (l.paysGroupe || (l.pays || "").split(" · ")[0]) === g).map(card).join("")}</div></section>`).join("") || `<p class="msg">Aucun leader pour ce filtre.</p>`}`;
  }

  // ---------- Dépendances ----------
  // Filtres communs aux deux vues visuelles
  const inView = s => (!st.dv.seg || s.seg === st.dv.seg) && (!st.dv.geo || s.geo === st.dv.geo);
  function viewFilters() {
    return `<div class="filters-row">
      <div class="seg-ctl" role="group" aria-label="Secteur">${[["", "Tous secteurs"], ...SEG].map(([k, l]) => `<button data-act="dv-seg" data-v="${k}" aria-pressed="${st.dv.seg === k}">${l}</button>`).join("")}</div>
      <div class="seg-ctl" role="group" aria-label="Entreprises">${[["", "Toutes"], ["FR", "Entreprises françaises"], ["EU", "Entreprises européennes"]].map(([k, l]) => `<button data-act="dv-geo" data-v="${k}" aria-pressed="${st.dv.geo === k}">${l}</button>`).join("")}</div>
    </div>`;
  }

  function flowSVG(deps) {
    const acc = {}; // une dépendance compte une fois par pays et par maillon, même si plusieurs articles en parlent
    deps.forEach(s => origins(s).forEach(o => { const k = o + "|" + s.m; acc[k] = Math.max(acc[k] || 0, Number(s.imp) || 1); }));
    const L = Object.entries(acc).map(([k, w]) => { const [o, m] = k.split("|"); return { o, m, w }; });
    if (!L.length) return `<p class="msg">Aucune dépendance pour ce filtre.</p>`;
    const oW = {}, mW = {};
    L.forEach(l => { oW[l.o] = (oW[l.o] || 0) + l.w; mW[l.m] = (mW[l.m] || 0) + l.w; });
    const os = Object.keys(oW).sort((a, b) => oW[b] - oW[a]);
    const ms = MAIL.map(x => x[0]).filter(k => mW[k]);
    const total = L.reduce((a, l) => a + l.w, 0);
    const W = 820, gap = 16, top = 30, x1 = 150, x2 = 560, nw = 12;
    const H = Math.max(280, Math.max(os.length, ms.length) * 54) + top;
    const avail = H - top - 10;
    const sL = (avail - gap * (os.length - 1)) / total, sR = (avail - gap * (ms.length - 1)) / total;
    const oP = {}, mP = {};
    let y = top; os.forEach(o => { oP[o] = { y, h: oW[o] * sL, off: 0 }; y += oW[o] * sL + gap; });
    y = top; ms.forEach(m => { mP[m] = { y, h: mW[m] * sR, off: 0 }; y += mW[m] * sR + gap; });
    L.sort((a, b) => os.indexOf(a.o) - os.indexOf(b.o) || ms.indexOf(a.m) - ms.indexOf(b.m));
    const hot = st.depOrig;
    const paths = L.map(l => {
      const a = oP[l.o], b = mP[l.m], h1 = l.w * sL, h2 = l.w * sR;
      const ya = a.y + a.off, yb = b.y + b.off; a.off += h1; b.off += h2;
      const xa = x1 + nw, xb = x2, cx = (xa + xb) / 2;
      const cls = hot ? (hot === l.o ? " on" : " off") : "";
      return `<path class="flow${cls}" data-act="dep-orig" data-v="${esc(l.o)}" d="M${xa},${ya.toFixed(1)} C${cx},${ya.toFixed(1)} ${cx},${yb.toFixed(1)} ${xb},${yb.toFixed(1)} L${xb},${(yb + h2).toFixed(1)} C${cx},${(yb + h2).toFixed(1)} ${cx},${(ya + h1).toFixed(1)} ${xa},${(ya + h1).toFixed(1)} Z"><title>${esc(l.o)} → ${esc(mailName(l.m))}</title></path>`;
    }).join("");
    const oN = os.map(o => { const p = oP[o]; const cls = hot && hot !== o ? " off" : ""; return `<g class="node${cls}" data-act="dep-orig" data-v="${esc(o)}"><rect x="${x1}" y="${p.y.toFixed(1)}" width="${nw}" height="${Math.max(p.h, 2).toFixed(1)}" rx="2" class="n-o"></rect><text x="${x1 - 10}" y="${(p.y + p.h / 2).toFixed(1)}" text-anchor="end" dominant-baseline="middle" class="n-l">${esc(o)}</text></g>`; }).join("");
    const mN = ms.map(m => { const p = mP[m]; return `<g class="node"><rect x="${x2}" y="${p.y.toFixed(1)}" width="${nw}" height="${Math.max(p.h, 2).toFixed(1)}" rx="2" class="n-m"></rect><text x="${x2 + nw + 10}" y="${(p.y + p.h / 2).toFixed(1)}" dominant-baseline="middle" class="n-l">${esc(mailName(m))}</text></g>`; }).join("");
    return `<div class="svg-scroll"><svg class="flowsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Flux de dépendances des pays d'origine vers les maillons">
      <text x="${x1 + nw}" y="14" text-anchor="end" class="ax">Pays d'origine</text>
      <text x="${x2}" y="14" class="ax">Maillons exposés</text>
      ${paths}${oN}${mN}
    </svg></div>`;
  }

  function renderDeps() {
    const deps = signals.filter(s => s.n === "dependance" && inView(s));
    return `<section class="intro"><div class="stack"><h2>Dépendances</h2>
      <p>D'où viennent les dépendances et quels maillons de la chaîne elles touchent. Plus un flux est épais, plus la dépendance pèse. Cliquez un pays pour isoler ses flux.</p></div></section>
      ${viewFilters()}
      <div class="box">${flowSVG(deps)}
        ${st.depOrig ? `<div class="actions"><span class="pill dependance">${esc(st.depOrig)}</span><button class="btn ghost small" data-act="dep-orig" data-v="">Voir tous les pays</button></div>` : ""}
      </div>`;
  }

  // ---------- Matrice des risques (critères objectivés) ----------
  const CRIT_L = { c: "Concentration des fournisseurs", e: "Exposition hors UE", t: "Délai de remplacement", p: "Probabilité d'aggravation (12 mois)" };
  const recency = s => { const a = ageDays(s); return a <= 120 ? 3 : a <= 400 ? 2 : 1; };
  const critOf = s => s.crit || { c: 2, e: s.n === "dependance" ? 3 : 1, t: 2, p: recency(s) };
  const criticite = s => { const k = critOf(s); return (k.c + k.e + k.t) / 3; };
  const riskScore = s => (Number(s.imp) || 1) + critOf(s).p + criticite(s);
  const riskLevel = s => { const v = riskScore(s); return v >= 7.5 ? ["Élevé", "manque"] : v >= 5.5 ? ["Moyen", "dependance"] : ["Faible", "tag"]; };
  function critBars(s) {
    const k = critOf(s);
    return `<dl class="crit">${Object.keys(CRIT_L).map(x => `<dt>${CRIT_L[x]}</dt><dd><span class="cbar">${[1, 2, 3].map(i => `<i class="${i <= k[x] ? "on" : ""}"></i>`).join("")}</span><span class="mono">${k[x]}/3</span></dd>`).join("")}</dl>`;
  }
  function riskList() {
    const auto = signals.filter(s => s.k === "actu" && (s.n === "manque" || s.n === "dependance") && dateKey(s.d) > dateKey(DATA.risksUpdated || "2000"));
    return [...(DATA.risks || []), ...auto].filter(inView).sort((a, b) => riskScore(b) - riskScore(a));
  }
  function renderRisk() {
    const risks = riskList();
    const num = new Map(risks.map((s, i) => [s.id, i + 1]));
    const W = 820, H = 480, ml = 96, mb = 58, mt = 16, mr = 12;
    const cw = (W - ml - mr) / 3, ch = (H - mt - mb) / 3, step = 34;
    const COLS = ["Faible", "Moyenne", "Forte"], ROWS = ["Faible", "Notable", "Structurant"];
    let cells = "", dots = "";
    for (let c = 1; c <= 3; c++) for (let i = 1; i <= 3; i++) {
      const x = ml + (c - 1) * cw, y = mt + (3 - i) * ch, heat = c + i - 2;
      cells += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" class="rc" style="fill:color-mix(in oklab, var(--manque) ${[4, 10, 18, 28, 40][heat]}%, var(--surface))"></rect>`;
      const inCell = risks.filter(s => critOf(s).p === c && (Number(s.imp) || 1) === i);
      const per = Math.max(1, Math.floor((cw - 12) / step));
      inCell.forEach((s, k) => {
        const r = 8 + criticite(s) * 2.3;
        const cx = x + 6 + step / 2 + (k % per) * step, cy = y + 6 + step / 2 + Math.floor(k / per) * step;
        const sel = st.riskSel === s.id ? " sel" : "";
        dots += `<g class="rdot ${s.n}${sel}" data-act="risk-dot" data-id="${esc(s.id)}" tabindex="0"><circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"></circle><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central">${num.get(s.id)}</text><title>${esc(s.t)}</title></g>`;
      });
    }
    const axes = COLS.map((l, c) => `<text x="${ml + c * cw + cw / 2}" y="${H - mb + 22}" text-anchor="middle" class="ax">${l}</text>`).join("")
      + ROWS.map((l, i) => `<text x="${ml - 10}" y="${mt + (2 - i) * ch + ch / 2}" text-anchor="end" dominant-baseline="middle" class="ax">${l}</text>`).join("")
      + `<text x="${ml + (W - ml - mr) / 2}" y="${H - 8}" text-anchor="middle" class="ax-t">Probabilité d'aggravation à 12 mois →</text>`
      + `<text transform="translate(16 ${mt + (H - mt - mb) / 2}) rotate(-90)" text-anchor="middle" class="ax-t">Impact →</text>`
      + `<text x="${W - mr - 8}" y="${mt + 16}" text-anchor="end" class="zone">Priorité</text>`;
    const list = risks.map(s => { const [lv, cls] = riskLevel(s); return `<button class="rrow${st.riskSel === s.id ? " sel" : ""}" data-act="risk-dot" data-id="${esc(s.id)}">
        <span class="rnum ${s.n}">${num.get(s.id)}</span>
        <span class="stack"><span class="sig-t">${esc(s.t)} <span class="pill ${cls}">${lv}</span></span>${st.riskSel === s.id ? `<span class="note">${esc(s.why)}</span>${critBars(s)}` : ""}</span>
      </button>`; }).join("");
    return `<section class="intro"><div class="stack"><h2>Risques</h2>
      <p>Les principaux risques de la filière, placés selon leur impact et leur probabilité. Plus un point est gros, plus le risque est difficile à contourner. Cliquez un point pour comprendre.</p></div></section>
      ${viewFilters()}
      <div class="legend"><span><span class="dot manque"></span>Manque</span><span><span class="dot dependance"></span>Dépendance</span><span class="note">Plus le point est gros, plus le risque est difficile à contourner · ${risks.length} risque(s)</span></div>
      <div class="box">${risks.length ? `<div class="svg-scroll"><svg class="risksvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Matrice impact et probabilité des risques">${cells}${axes}${dots}</svg></div>` : `<p class="msg">Aucun risque pour ce filtre.</p>`}</div>
      <div class="box"><h3>Du plus au moins grave</h3><div class="rlist">${list}</div></div>`;
  }

  const countryName = id => id === "FR" ? "France" : id === "EU" ? "Union européenne" : ((DATA.countries || []).find(c => c.id === id) || { name: id }).name;
  const textOf = s => [s.t, s.r, s.why, s.s, (s.act || []).join(" "), s.orig].join(" ").toLowerCase();

  // ---------- Flux direct ----------
  let FLUX = null;
  function renderFlux() {
    if (!FLUX) return `${newsSwitch()}<p class="msg">Chargement du flux…</p>`;
    const list = FLUX.items.filter(i => !st.fluxSeg || i.seg === st.fluxSeg);
    return `<section class="intro"><div class="stack"><h2>Actualités</h2>
      <p>Les derniers articles repérés toutes les heures, pas encore analysés. Le secteur est déduit de mots-clés et peut se tromper.</p></div>${newsSwitch()}</section>
      <div class="seg-ctl" role="group" aria-label="Secteur">${[["", "Tous"], ...SEG].map(([k, l]) => `<button data-act="flux-seg" data-v="${k}" aria-pressed="${(st.fluxSeg || "") === k}">${l}</button>`).join("")}</div>
      <p class="count">${list.length} article(s)${FLUX.updated ? " · dernier ajout le " + esc(fmtD(FLUX.updated)) : ""}</p>
      <div class="feed">${list.map(i => `<article class="tcard flux"><div class="sig-meta"><span class="when-i">${esc(fmtD(i.d))}</span><span class="pill tag">${esc(segName(i.seg))}</span></div><b>${link(i.u, i.t)}</b><span class="src">Source : ${esc(i.src)}</span></article>`).join("") || `<p class="msg">Aucun article pour l'instant : le flux se remplit au prochain passage.</p>`}</div>`;
  }

  // ---------- Pays
  const NEEDS = [["avions", "Avions"], ["helico", "Hélicoptères"], ["drones", "Drones"], ["missiles", "Missiles et défense aérienne"], ["spatial", "Spatial"]];
  const LEVEL = ["Faible", "Moyen", "Fort"];
  function tenderNeed(t) {
    const o = t.objet || "";
    if (/satellite|spatial|spationef|lanceur/i.test(o.replace(/spationefs et/i, ""))) return "spatial";
    if (/missile|radar|sol-air/i.test(o)) return "missiles";
    if (/sans pilote|drone|UAS/i.test(o)) return "drones";
    if (/hélicoptère|UH-60|AB-205|AW-?169/i.test(o)) return "helico";
    if (/avion|aéronef|simulateur de vol|vol\b/i.test(o)) return "avions";
    return "";
  }
  function openTenders() { return (DATA.tenders || []).filter(t => t.id.startsWith("ted-") && tenderNeed(t)); }
  const tenderCountry = t => (t.objet || "").split(" – ")[0];
  function countryCard(p, tenders) {
    const names = p.name.split(" et ");
    const mine = tenders.filter(t => names.includes(tenderCountry(t)));
    const tiles = NEEDS.map(([k, l], i) => {
      const n = mine.filter(t => tenderNeed(t) === k).length;
      const lv = Math.min(2, (p.lv || [])[i] + (n && (p.lv || [])[i] === 0 ? 1 : 0));
      return `<div class="tile l${lv}" title="Besoin ${LEVEL[lv].toLowerCase()}${n ? ` · ${n} appel(s) d'offres ouvert(s)` : ""}"><span>${esc(l)}</span>${n ? `<b class="ao">${n} AO</b>` : ""}</div>`;
    }).join("");
    const dots = { forte: 3, moyenne: 2, faible: 1 }[p.pos];
    return `<article class="ccard">
      <header><div><h3>${esc(p.name)}</h3><span class="plabel ${POS[p.pos][1]}"><i class="dots">${[1, 2, 3].map(i => `<em class="${i <= dots ? "on" : ""}"></em>`).join("")}</i>France : ${esc(p.pos)}</span></div>
        <div class="cstat"><b>${esc(p.stat || "")}</b><small>${esc(p.statL || "")}</small></div></header>
      <p class="ret">${esc(p.ret || "")}</p>
      <div class="tiles">${tiles}</div>
      <div class="supp">${(p.f || []).map(([n, o]) => `<span class="o-${o}">${esc(n)}</span>`).join("")}</div>
      <div class="ov"><p><b class="plus">+</b>${esc(p.op || "")}</p><p><b class="minus">!</b>${esc(p.vi || "")}</p></div>
      ${mine.length ? `<details class="ao-list"><summary>${mine.length} appel(s) d'offres ouvert(s)</summary><ul>${mine.map(t => `<li>${link(t.u, (t.objet || "").split(" – ").slice(1).join(" – "))}</li>`).join("")}</ul></details>` : ""}
    </article>`;
  }
  function renderCountries() {
    const tenders = openTenders();
    const counts = NEEDS.map(([k, l]) => [l, tenders.filter(t => tenderNeed(t) === k).length]);
    const max = Math.max(1, ...counts.map(c => c[1]));
    const top = counts.slice().sort((a, b) => b[1] - a[1])[0];
    return `<section class="intro"><div class="stack"><h2>Pays</h2>
      <p>Pour chaque marché : ce qu'il achète, qui le fournit, et la place de la France. Plus une case est foncée, plus le besoin est fort (estimation Balise).</p></div></section>
      <div class="legend"><span class="tile-key l0"></span>Faible<span class="tile-key l1"></span>Moyen<span class="tile-key l2"></span>Fort
        <span class="supp"><span class="o-fr">France</span><span class="o-eu">Europe</span><span class="o-us">États-Unis</span></span></div>
      <div class="cgrid2">${(DATA.countries || []).map(p => countryCard(p, tenders)).join("")}</div>
      <div class="box"><h3>Ce que l'Europe achète en ce moment</h3>
        <p class="note">${tenders.length} appels d'offres publics ouverts sur le portail européen TED${top && top[1] ? ` : la demande la plus visible porte sur ${esc(top[0].toLowerCase())}` : ""}. Ils alimentent aussi les cases « AO » des pays.</p>
        <div class="bars-plain">${counts.map(([l, n]) => `<div class="bar"><span>${esc(l)}</span><div class="track"><div class="fill demand" style="width:${(n / max * 100).toFixed(0)}%"></div></div><span class="n">${n}</span></div>`).join("")}</div>
      </div>`;
  }

  // ---------- Rendu global ----------
  function render() {
    const app = document.getElementById("app");
    if (!DATA) return;
    const view = { radar: renderRadar, etat: renderEtat, news: renderNews, carte: renderMap, leaders: renderLeaders, dep: renderDeps, risques: renderRisk, pays: renderCountries,  }[st.tab] || renderEtat;
    const y = window.scrollY;
    app.innerHTML = `<div class="shell">${renderSide()}<div class="content">${renderMetrics()}<main>${view()}</main>
      <footer class="foot"><span>Balise ASD · données du ${esc(fmtD(DATA.updated))}</span><span>Sources citées sur chaque fait. Estimations à vérifier avant décision.</span></footer></div></div>
      ${st.sel ? renderDrawer() : ""}`;
    window.scrollTo(0, y);
  }
  function go(tab) { st.tab = tab; ls.set("tab", tab); }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "tab") { go(b.dataset.v); st.sel = null; st.flash = null; render(); window.scrollTo(0, 0); }
    else if (a === "radar-sel") { st.radarSel = b.dataset.id; render(); }
    else if (a === "radar-off") { const v = b.dataset.v; st.radarOff = st.radarOff.includes(v) ? st.radarOff.filter(x => x !== v) : [...st.radarOff, v]; render(); }
    else if (a === "trend") { Object.assign(st.f, { period: "90", seg: "", fam: "", geo: "", m: b.dataset.v, q: "" }); st.newsView = "analyse"; go("news"); render(); window.scrollTo(0, 0); }
    else if (a === "etat-seg") { st.etatSeg = b.dataset.v; render(); }
    else if (a === "news-view") { st.newsView = b.dataset.v; render(); }
    else if (a === "flux-seg") { st.fluxSeg = b.dataset.v; render(); }
    else if (a === "mode") { st.mode = b.dataset.v; render(); }
    else if (a === "cell" || a === "open-sig") { st.sel = { seg: b.dataset.seg, m: b.dataset.m }; render(); }
    else if (a === "close") { st.sel = null; render(); }
    else if (a === "ai-cell") aiCell();
    else if (a === "goto") { go("carte"); st.sel = { seg: b.dataset.seg, m: b.dataset.m }; render(); }
    else if (a === "see") { Object.assign(st.f, { period: "all", seg: b.dataset.seg, fam: b.dataset.fam, geo: "", m: "", q: "" }); go("news"); render(); window.scrollTo(0, 0); }
    else if (a === "seg-map") { go("carte"); render(); window.scrollTo(0, 0); }
    else if (a === "period") { st.f.period = b.dataset.v; render(); }
    else if (a === "lf-seg") { st.lf.seg = b.dataset.v; render(); }
    else if (a === "add-open") { st.adding = true; st.flash = null; render(); }
    else if (a === "add-cancel") { st.adding = false; st.flash = null; render(); }
    else if (a === "add-analyse") analyseDraft();
    else if (a === "add-save") saveDraft();
    else if (a === "del") { st.confirmDel = b.dataset.id; render(); }
    else if (a === "del-cancel") { st.confirmDel = null; render(); }
    else if (a === "del-confirm") {
      const id = b.dataset.id;
      persist(signals.filter(s => s.id !== id)).then(ok => { st.confirmDel = null; if (ok) st.flash = { text: "Signal retiré." }; render(); });
    }
    else if (a === "dep-orig") { st.depOrig = st.depOrig === b.dataset.v ? "" : b.dataset.v; render(); }
    else if (a === "dv-seg") { st.dv.seg = b.dataset.v; st.depOrig = ""; st.riskSel = null; render(); }
    else if (a === "dv-geo") { st.dv.geo = b.dataset.v; st.depOrig = ""; st.riskSel = null; render(); }
    else if (a === "risk-dot") { st.riskSel = st.riskSel === b.dataset.id ? null : b.dataset.id; render(); }
  });

  const DRAFT_IDS = { "add-raw": "raw", "add-t": "t", "add-s": "s", "add-d": "d", "add-seg": "seg", "add-m": "m", "add-n": "n", "add-geo": "geo", "add-imp": "imp", "add-act": "act", "add-orig": "orig", "add-src": "src", "add-u": "u" };
  function onField(e) {
    const el = e.target, id = el.id || "";
    if (DRAFT_IDS[id]) { st.draft[DRAFT_IDS[id]] = el.value; if (id === "add-n" && e.type === "change") render(); return; }
    if (id.startsWith("f-")) {
      st.f[id.slice(2)] = el.value;
      const list = document.getElementById("feed-list"), cnt = document.getElementById("feed-count");
      if (list) list.innerHTML = renderFeedList();
      if (cnt) cnt.textContent = filtered().length + " signal(s)";
      return;
    }
  }
  document.addEventListener("input", onField);
  document.addEventListener("change", onField);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && st.sel) { st.sel = null; render(); }
    const bl = e.target.closest && e.target.closest(".blip");
    if (bl && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); st.radarSel = bl.dataset.id; render(); }
    const g = e.target.closest && e.target.closest(".rdot");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); st.riskSel = st.riskSel === g.dataset.id ? null : g.dataset.id; render(); }
  });

  // ---------- Chargement ----------
  fetch("flux.json", { cache: "no-store" }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] }))
    .then(f => { FLUX = { updated: f.updated, items: f.items || [] }; if (st.tab === "news" && st.newsView === "flux" && DATA) render(); });
  fetch("data.json", { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { DATA = d; signals = Array.isArray(d.signals) ? d.signals : []; render(); })
    .catch(() => { document.getElementById("app").innerHTML = `<div class="wrap"><p class="msg err" style="margin-top:32px">Les données de veille n'ont pas pu être chargées. Rechargez la page.</p></div>`; });

  (async () => {
    if (!window.claude || typeof window.claude.use !== "function") return;
    const [a, u, s] = await Promise.all([
      window.claude.use("artifact").catch(() => null),
      window.claude.use("user").catch(() => null),
      window.claude.use("sample").catch(() => null)
    ]);
    art = a; sample = s;
    let editor = !!a;
    if (a && u) {
      try {
        const ce = await Promise.resolve(u.canEdit && u.canEdit());
        const ow = await Promise.resolve(u.isOwner && u.isOwner());
        editor = ce === true || ow === true || (ce == null && ow == null);
      } catch { /* valeur par défaut */ }
    }
    st.editor = editor;
    render();
  })();
})();
