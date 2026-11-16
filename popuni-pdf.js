/* =====================================================================
   Popunjavanje originalnog PDF upitnika (predložak.pdf) odgovorima.
   Predložak je isti LaTeX dokument kao štampani upitnik; pozicije polja,
   kućica i linija izvučene su iz LaTeX-a u pozicije.json (jedinice: pt,
   ishodište dolje lijevo). Stranice 2–3 su blok jednog kotla i ponavljaju
   se za svaki kotao.
   Koristi pdf-lib i @pdf-lib/fontkit (u pregledniku kao globalne PDFLib i fontkit).
   ===================================================================== */
(function (root) {
  const NAVY = [0, 0, 0.5], CRNA = [0.08, 0.08, 0.11], SIVA = [0.36, 0.37, 0.42];

  async function popuniPdf({ PDFLib, fontkit, predlozak, font, pozicije, pitanja, zapis, rok = "", kontakt = "" }) {
    const { PDFDocument, rgb } = PDFLib;
    const boja = c => rgb(c[0], c[1], c[2]);
    const tpl = await PDFDocument.load(predlozak);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const F = await doc.embedFont(font, { subset: false });

    const kotlovi = zapis.kotlovi && zapis.kotlovi.length ? zapis.kotlovi : [{}];
    const N = kotlovi.length;
    // redoslijed stranica: 1, (2,3) × N, 4
    const plan = [0];
    for (let i = 0; i < N; i++) plan.push(1, 2);
    plan.push(3);
    // svaka stranica se kopira zasebno, da ponovljene stranice kotla ne dijele isti sadržaj
    for (const idx of plan) { const [pg] = await doc.copyPages(tpl, [idx]); doc.addPage(pg); }
    const pages = doc.getPages();
    const ukupno = pages.length;

    // izlazna stranica za oznaku iz predloška (tplStr 1..4) i kotao i
    const izlaz = (tplStr, i = 0) => tplStr === 1 ? 0 : tplStr === 4 ? 1 + 2 * N : 1 + 2 * i + (tplStr - 2);
    const P = k => pozicije[k];

    /* --- crtanje teksta --- */
    const sirina = (t, s) => F.widthOfTextAtSize(t, s);
    // znakovi kojih nema u fontu: zamjena bliskim ekvivalentom ili "?"
    const skup = new Set(F.getCharacterSet());
    const ZAMJENE = { "≈": "~", "≤": "<=", "≥": ">=", "×": "x", "−": "-", "‒": "-", "…": "...", "•": "-", "→": "->", "²": "2", "³": "3", "₂": "2", "ₓ": "x", "\u00a0": " " };
    const ocisti = t => Array.from(String(t == null ? "" : t).replace(/\s+/g, " ").trim())
      .map(ch => skup.has(ch.codePointAt(0)) ? ch : (ZAMJENE[ch] !== undefined ? ZAMJENE[ch] : "?")).join("");
    function tekst(page, t, x, y, s = 10, c = CRNA) { t = ocisti(t); if (t) page.drawText(t, { x, y, size: s, font: F, color: boja(c) }); }
    function prelomi(t, s, w) {
      const rijeci = t.split(" "), redovi = []; let r = "";
      for (const w0 of rijeci) {
        const pokus = r ? r + " " + w0 : w0;
        if (sirina(pokus, s) <= w || !r) r = pokus; else { redovi.push(r); r = w0; }
      }
      if (r) redovi.push(r);
      return redovi;
    }
    // tekst u uokvireno polje (x0,y0 = donji lijevi ugao, w, h)
    function uPolje(page, t, x0, y0, w, h, sMax = 10) {
      t = ocisti(t); if (!t) return;
      const pad = 4, sw = w - 2 * pad;
      let s = sMax;
      while (s > 7.5 && sirina(t, s) > sw) s -= 0.5;
      if (sirina(t, s) <= sw) { tekst(page, t, x0 + pad, y0 + (h - s * 0.7) / 2, s); return; }
      // dva reda
      s = Math.min(8.5, (h - 4) / 2.3);
      let red = prelomi(t, s, sw);
      if (red.length > 2) { red = red.slice(0, 2); while (sirina(red[1] + "…", s) > sw && red[1].length) red[1] = red[1].slice(0, -1); red[1] += "…"; }
      const vis = s * 1.15;
      red.forEach((r, i) => tekst(page, r, x0 + pad, y0 + h / 2 + (red.length / 2 - i - 1) * vis + s * 0.25, s));
    }
    // tekst na liniju za upis
    function naLiniju(page, t, x0, x1, y) {
      t = ocisti(t); if (!t) return;
      let s = 10; const w = x1 - x0 - 2;
      while (s > 6.5 && sirina(t, s) > w) s -= 0.5;
      while (sirina(t, s) > w && t.length > 1) t = t.slice(0, -2) + "…";
      tekst(page, t, x0 + 1, y + 1.6, s);
    }
    function kvacica(page, x0, y0, x1) {
      const d = x1 - x0, m = d * 0.18;
      const o = { thickness: 0.9, color: boja(NAVY) };
      page.drawLine({ start: { x: x0 + m, y: y0 + m }, end: { x: x1 - m, y: y0 + d - m }, ...o });
      page.drawLine({ start: { x: x0 + m, y: y0 + d - m }, end: { x: x1 - m, y: y0 + m }, ...o });
    }

    /* --- pojedinačni elementi predloška --- */
    const HP = 21; // visina polja: 2,1em pri \small (10 pt)
    function polje(kljuc, vrijednost, i) {
      const s = P(`P:${kljuc}:s`), e = P(`P:${kljuc}:e`); if (!s || !e) return;
      uPolje(pages[izlaz(s[2], i)], vrijednost, s[0], s[1], e[0] - s[0], HP);
    }
    function linija(q, n, vrijednost, i) {
      const s = P(`L:${q}:${n}:s`), e = P(`L:${q}:${n}:e`); if (!s || !e) return;
      naLiniju(pages[izlaz(e[2], i)], vrijednost, e[0] - (e[0] - s[0]), e[0], e[1]);
    }
    function kucica(q, n, i) {
      const s = P(`C:${q}:${n}:s`), e = P(`C:${q}:${n}:e`); if (!s || !e) return;
      kvacica(pages[izlaz(s[2], i)], s[0], s[1], e[0]);
    }
    function pitanje(f, v, i) {
      const t = f.t || "text";
      if (t === "text") return polje(f.k, v, i);
      if (t === "pair") { (v || []).forEach((x, n) => linija(f.k, n + 1, x, i)); return; }
      // radio / multi: v = {opcija: true | "tekst"}
      if (!v || typeof v !== "object") return;
      let ln = 0;
      f.o.forEach((raw, idx) => {
        const o = raw.replace(/^\*/, "");
        const imaLiniju = o.endsWith(":");
        if (imaLiniju) ln++;
        if (o in v) {
          kucica(f.k, idx + 1, i);
          if (imaLiniju && typeof v[o] === "string") linija(f.k, ln, v[o], i);
        }
      });
    }

    /* --- stranica 1: šifra, datum zaprimanja, rok/kontakt, odjeljak 1 --- */
    const t = new Date(zapis.poslano || Date.now());
    const dd = n => String(n).padStart(2, "0");
    const datum = `${dd(t.getDate())}.${dd(t.getMonth() + 1)}.${t.getFullYear()}.`;
    const vrijeme = `${dd(t.getHours())}:${dd(t.getMinutes())}`;
    {
      const e = P("S:e"), p0 = pages[0];
      const w = 3.4 * 72 / 2.54 + 0.8, h = 0.75 * 72 / 2.54, x0 = e[0] - w;
      const s = 11, sw = sirina(zapis.id, s);
      tekst(p0, zapis.id, x0 + (w - sw) / 2, e[1] + (h - s * 0.7) / 2, s, NAVY);
      const z = `Zaprimljeno online: ${datum} u ${vrijeme} h`;
      tekst(p0, z, e[0] - sirina(z, 7.5), e[1] - 10, 7.5, SIVA);
      if (rok) linija("meta", 1, rok, 0);
      if (kontakt) linija("meta", 2, kontakt, 0);
    }
    pitanja.S1.forEach(f => polje(f.k, (zapis.firma || {})[f.k], 0));

    /* --- kotlovi --- */
    kotlovi.forEach((k, i) => {
      ["2", "3", "4"].forEach(n => {
        const s = P(`K:${n}:s`), e = P(`K:${n}:e`); if (!s || !e) return;
        const pg = pages[izlaz(s[2], i)], br = String(i + 1), sz = 10;
        tekst(pg, br, s[0] + (e[0] - s[0] - sirina(br, sz)) / 2, s[1], sz, NAVY);
      });
      [...pitanja.S2, ...pitanja.S3, ...pitanja.S4].forEach(f => {
        if (f.plant && i > 0) return;
        pitanje(f, k[f.k], i);
      });
    });

    /* --- posljednja stranica: napomene, saglasnost, ovjera --- */
    {
      const s = P("N:s"), e = P("N:e"), pg = pages[ukupno - 1];
      const nap = ocisti(zapis.napomene);
      if (nap) {
        const h = 46.2, sz = 9.5, red = prelomi(nap, sz, e[0] - s[0] - 8).slice(0, 4);
        red.forEach((r, n) => tekst(pg, r, s[0] + 4, s[1] + h - 12 - n * sz * 1.2, sz));
      }
      if (zapis.saglasnost) kucica("sag", 1, 0);
      const ov = zapis.ovjera || {};
      const d = ov.datum ? ov.datum.split("-").reverse().join(".") + "." : datum;
      linija("ov", 1, d, 0);
      linija("ov", 2, ov.ime, 0);
      linija("ov", 3, ov.funkcija, 0);
      const ls = P("L:ov:4:s"), le = P("L:ov:4:e");
      tekst(pg, "poslano elektronski (online upitnik)", ls[0] + 1, le[1] + 1.6, 8, SIVA);
      // M.P. polje: desni donji ugao = M:e, širina 3,6 cm, visina 2,6 cm
      const me = P("M:e"), mw = 3.6 * 72 / 2.54, mh = 2.6 * 72 / 2.54, mx = me[0] - mw;
      ["Online upitnik", "zaprimljen", `${datum} u ${vrijeme} h`, `šifra ${zapis.id}`].forEach((r, n) => {
        tekst(pg, r, mx + (mw - sirina(r, 8)) / 2, me[1] + mh / 2 + 14 - n * 10, 8, SIVA);
      });
    }

    /* --- broj stranice u podnožju --- */
    pages.forEach((pg, n) => {
      const pp = P("PG:1"), s = `Stranica ${n + 1} od ${ukupno}`, sz = 9;
      const xr = 595.28 - 2.4 * 72 / 2.54;
      tekst(pg, s, xr - sirina(s, sz), pp[1], sz, CRNA);
    });

    doc.setTitle(`Anketni upitnik – ${ocisti((zapis.firma || {})["1.1"])} (${zapis.id})`);
    doc.setAuthor("Mašinski fakultet, Univerzitet u Sarajevu");
    doc.setSubject("Potvrda o popunjenom anketnom upitniku – kotlovska postrojenja");
    return await doc.save();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { popuniPdf };
  else root.popuniPdf = popuniPdf;
})(typeof window !== "undefined" ? window : globalThis);
