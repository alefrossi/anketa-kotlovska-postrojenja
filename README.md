# Anketni upitnik – kotlovska postrojenja

Online verzija anketnog upitnika (Mašinski fakultet, Univerzitet u Sarajevu).
Stranica je statična (GitHub Pages); odgovori se šalju u privatni Google Sheet istraživača.

## Postavljanje
1. **Google Sheet** – napraviti novu praznu tabelu, npr. „Upitnik kotlovi – odgovori“.
2. **Apps Script** – u tabeli: *Extensions → Apps Script*, obrisati sadržaj i zalijepiti `Code.gs`, sačuvati.
3. **Objava skripte** – *Deploy → New deployment → Web app*:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - odobriti pristup tabeli i kopirati **Web app URL** (`https://script.google.com/macros/s/.../exec`).
4. **Povezivanje** – u `index.html` upisati URL u `const SCRIPT_URL = "...";` (po potrebi i `ROK`, `KONTAKT`).
5. **GitHub Pages** – postaviti `index.html` u repozitorij, *Settings → Pages → Deploy from branch (main, /root)*.

Ko vidi odgovore: samo vlasnik Google tabele. „Anyone“ u koraku 3 znači da svako može *poslati* odgovor, ne i čitati tabelu.
Nakon izmjene `Code.gs` potrebno je *Deploy → Manage deployments → Edit → New version*.

## PDF potvrda i e-mail
Pri slanju forma u pregledniku popuni originalni PDF upitnika (`predlozak.pdf`, izvor `predlozak.tex`)
odgovorima – pozicije polja su u `pozicije.json`, a upis radi `popuni-pdf.js` (pdf-lib). Skripta zatim:
- prima tu PDF potvrdu (naziv firme, datum unosa, šifra i svi odgovori),
- sprema je u Drive folder „Upitnik kotlovska postrojenja – PDF potvrde“,
- šalje je kao prilog na e-mail adresu iz pitanja 1.4.

Nakon zamjene `Code.gs`: u editoru izabrati funkciju `autorizacija` → **Run** → odobriti pristup Drive-u i Gmailu,
zatim *Deploy → Manage deployments → Edit (olovka) → Version: New version → Deploy* (URL ostaje isti).
