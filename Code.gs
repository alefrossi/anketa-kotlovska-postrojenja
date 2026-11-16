/**
 * Prijem odgovora online upitnika (GitHub Pages) u Google Sheet.
 *  1) upis u tabelu: "Privredni subjekti" (red po upitniku) i "Kotlovi" (red po kotlu)
 *  2) PDF potvrda popunjenog upitnika -> folder na Google Drive-u
 *  3) PDF potvrda -> e-mail adresa navedena u pitanju 1.4
 * Zaglavlja kolona se kreiraju automatski iz pristiglih upitnika.
 */
const SHEET_ID = '1jFLcj7ErQh0pYMuyHFpG0tQxZqIbstX_Yv0W9f9NGAM'; // tabela "Upitnik kotlovska postrojenja – odgovori"
const VERZIJA = '2026-11-16 PDF-original, naziv = šifra';  // vidljivo u tabeli – potvrđuje da radi nova skripta
const SHEET_FIRME = 'Privredni subjekti';
const SHEET_KOTLOVI = 'Kotlovi';
const PDF_FOLDER_NAZIV = 'Upitnik kotlovska postrojenja – PDF potvrde';
const POSILJALAC = 'Anketa – Mašinski fakultet Sarajevo';  // ime pošiljaoca u e-mailu
const KOPIJA_NA = '';  // npr. vlastita adresa ako želiš kopiju svakog e-maila (BCC); prazno = bez kopije

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);                       // dva istovremena slanja ne pišu u isti red
  let data;
  try {
    data = JSON.parse(e.postData.contents);
    if (data.hp) return json_({ ok: true });  // popunjeno skriveno polje = spam robot, ignoriši
    if (!data.firma || !data.firma['Šifra']) return json_({ ok: false, error: 'neispravan zahtjev' });
    if (!data.pdf && data.firma['PDF potvrda'] === undefined) data.firma['PDF potvrda'] = 'stara verzija forme (bez PDF-a)';
    data.firma['Verzija skripte'] = VERZIJA;
    const ss = SpreadsheetApp.openById(SHEET_ID);
    upisi_(ss, SHEET_FIRME, [data.firma]);
    upisi_(ss, SHEET_KOTLOVI, data.kotlovi || []);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }

  // PDF i e-mail: greška ovdje ne poništava upis u tabelu
  const rez = { ok: true, sifra: data.firma['Šifra'], pdf: false, email: '' };
  try {
    // PDF potvrda iz forme (originalni upitnik popunjen odgovorima); rezervno: HTML verzija iz skripte
    const pdf = data.pdf
      ? Utilities.newBlob(Utilities.base64Decode(data.pdf), 'application/pdf', nazivPdf_(data.firma))
      : napraviPdf_(data);
    folder_().createFile(pdf);
    rez.pdf = true;
    const adresa = izvuciEmail_(data.firma['1.4 Telefon i e-mail adresa']);
    if (adresa) {
      posaljiEmail_(adresa, data, pdf);
      rez.email = adresa;
    }
  } catch (err) {
    rez.napomena = 'PDF/e-mail: ' + String(err);
    console.error(err);
  }
  return json_(rez);
}

/** Upisuje redove; nove kolone dodaje na kraj zaglavlja ako ih još nema. */
function upisi_(ss, ime, redovi) {
  if (!redovi.length) return;
  const sh = ss.getSheetByName(ime) || ss.insertSheet(ime);
  let zag = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  redovi.forEach(r => Object.keys(r).forEach(k => { if (zag.indexOf(k) < 0) zag.push(k); }));
  sh.getRange(1, 1, 1, zag.length).setValues([zag]).setFontWeight('bold')
    .setBackground('#00007F').setFontColor('#FFFFFF').setWrap(true);
  sh.setFrozenRows(1);
  const vals = redovi.map(r => zag.map(k => (r[k] === undefined ? '' : r[k])));
  sh.getRange(sh.getLastRow() + 1, 1, vals.length, zag.length).setValues(vals);
}

/* ------------------------------------------------------------------ */
/* PDF potvrda                                                        */
/* ------------------------------------------------------------------ */

/** Folder za PDF potvrde: pronađe postojeći po ID-u, inače ga napravi (jednom). */
function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PDF_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* obrisan – pravi novi */ } }
  const f = DriveApp.createFolder(PDF_FOLDER_NAZIV);
  props.setProperty('PDF_FOLDER_ID', f.getId());
  return f;
}

function izvuciEmail_(tekst) {
  const m = String(tekst || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : '';
}

const esc_ = s => String(s === undefined || s === null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Naslovi odjeljaka prema prvoj cifri broja pitanja. */
const ODJELJCI_ = {
  '1': '1. Opći podaci o privrednom subjektu',
  '2': '2. Podaci o kotlovskom postrojenju',
  '3': '3. Tehnologija sagorijevanja i radni parametri',
  '4': '4. Podaci o trenutno korištenom gorivu'
};

/** Pitanja jednog odjeljka kao redovi tabele (ključ kolone = "broj tekst pitanja"). */
function redoviOdjeljka_(obj, prefiks) {
  return Object.keys(obj)
    .filter(k => k.indexOf(prefiks + '.') === 0)
    .map(k => {
      const sp = k.indexOf(' ');
      const br = k.slice(0, sp), pit = k.slice(sp + 1);
      const v = obj[k] === '' ? '<span style="color:#999">–</span>' : esc_(obj[k]);
      return '<tr><td class="n">' + esc_(br) + '</td><td class="q">' + esc_(pit) + '</td><td class="a">' + v + '</td></tr>';
    }).join('');
}

function tabela_(naslov, desno, redovi) {
  return '<div class="band"><span>' + esc_(naslov) + '</span>' + (desno ? '<span class="kb">' + esc_(desno) + '</span>' : '') + '</div>' +
    '<table><tr class="th"><td class="n">R.br.</td><td class="q">Traženi podatak / pitanje</td><td class="a">Odgovor</td></tr>' + redovi + '</table>';
}

function napraviPdf_(d) {
  const f = d.firma, sifra = f['Šifra'];
  const t = new Date(f['Vrijeme slanja'] || new Date());
  const datum = Utilities.formatDate(t, 'Europe/Sarajevo', 'dd.MM.yyyy.');
  const vrijeme = Utilities.formatDate(t, 'Europe/Sarajevo', 'HH:mm');
  const firma = f['1.1 Naziv privrednog subjekta'] || '';
  let tijelo = tabela_(ODJELJCI_['1'], '', redoviOdjeljka_(f, '1'));
  (d.kotlovi || []).forEach(k => {
    ['2', '3', '4'].forEach(o => {
      tijelo += tabela_(ODJELJCI_[o], 'Kotao br. ' + k['Kotao br.'], redoviOdjeljka_(k, o));
    });
  });
  tijelo += '<div class="band"><span>5. Dodatne napomene</span></div><p class="box">' + (esc_(f['5. Dodatne napomene']) || '–') + '</p>';
  tijelo += '<div class="band"><span>Saglasnost i ovjera</span></div>' +
    '<p>&#9746; Saglasan/na sam da se dostavljeni podaci koriste u naučno-istraživačke svrhe i objavljuju zbirno, bez navođenja naziva privrednog subjekta.</p>' +
    '<table class="ov"><tr><td>Datum popunjavanja:</td><td>' + esc_(f['Datum popunjavanja']) + '</td></tr>' +
    '<tr><td>Ime i prezime:</td><td>' + esc_(f['Popunio/la']) + '</td></tr>' +
    '<tr><td>Funkcija:</td><td>' + esc_(f['Funkcija']) + '</td></tr></table>';

  const html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Georgia,"Times New Roman",serif;font-size:10.5pt;color:#16161d;margin:0}' +
    '.run{display:flex;justify-content:space-between;border-bottom:.5pt solid #16161d;font-size:8.5pt;padding-bottom:3pt}' +
    '.inst{font-variant:small-caps;font-size:9.5pt;margin-top:10pt}' +
    'h1{color:#00007F;text-align:center;font-size:20pt;margin:14pt 0 2pt}' +
    '.sub{color:#1C1C99;text-align:center;margin:0 0 10pt}' +
    '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}' +
    '.potvrda{border:1pt solid #00008C;background:#F4F4FC;padding:7pt 10pt;margin-bottom:6pt}' +
    '.pt{color:#00007F;font-weight:bold;letter-spacing:.04em;margin-bottom:3pt}' +
    'table.pk td{border:0;padding:1.5pt 4pt 1.5pt 0}table.pk td:first-child{width:26%;color:#5b5f6b}' +
    'td.firma{font-size:13pt;font-weight:bold}' +
    '.band{background:#00007F;color:#fff;font-weight:bold;padding:3pt 6pt;margin-top:12pt;overflow:hidden}' +
    '.band .kb{float:right;font-weight:normal}' +
    'table{width:100%;border-collapse:collapse;margin-top:2pt}' +
    'td{vertical-align:top;padding:3pt 4pt;border-bottom:.4pt solid #ddd}' +
    'tr.th td{font-weight:bold;border-bottom:1pt solid #00007F}' +
    'td.n{width:9%;color:#00007F;font-weight:bold}td.q{width:46%}td.a{width:45%}' +
    '.box{border:.5pt solid #9a9da6;padding:5pt;min-height:30pt}' +
    'table.ov td{border:0;padding:2pt 4pt}table.ov td:first-child{width:30%}' +
    '.foot{margin-top:16pt;border-top:.5pt solid #16161d;font-size:8pt;color:#5b5f6b;padding-top:3pt}' +
    '</style></head><body>' +
    '<div class="run"><span>Anketni upitnik – kotlovska postrojenja</span><span>Mašinski fakultet, Univerzitet u Sarajevu</span></div>' +
    '<div class="inst">Univerzitet u Sarajevu · Mašinski fakultet · Katedra za energetiku i KGH tehniku</div>' +
    '<h1>ANKETNI UPITNIK</h1><p class="sub">Prikupljanje tehničkih i pogonskih podataka o kotlovskim postrojenjima</p>' +
    '<div class="potvrda"><div class="pt">POTVRDA O POPUNJENOM UPITNIKU</div>' +
    '<table class="pk"><tr><td>Privredni subjekt:</td><td class="firma">' + esc_(firma) + '</td></tr>' +
    '<tr><td>Datum unosa:</td><td><b>' + datum + '</b> u ' + vrijeme + ' h</td></tr>' +
    '<tr><td>Šifra upitnika:</td><td><b>' + esc_(sifra) + '</b></td></tr></table></div>' +
    tijelo +
    '<div class="foot">Povjerljivo – isključivo za naučno-istraživačke svrhe. Dokument je automatski generisan pri slanju online upitnika.</div>' +
    '<div class="foot">' + esc_(firma) + ' · upitnik zaprimljen ' + datum + ' u ' + vrijeme + ' h · šifra ' + esc_(sifra) + '</div>' +
    '</body></html>';

  const naziv = nazivPdf_(f);
  return Utilities.newBlob(html, 'text/html', naziv.replace('.pdf', '.html')).getAs('application/pdf').setName(naziv);
}

function nazivPdf_(f) {
  return f['Šifra'] + '.pdf';   // PDF se sprema isključivo pod šifrom upitnika
}

function posaljiEmail_(adresa, d, pdf) {
  const f = d.firma;
  const tekst =
    'Poštovani,\n\n' +
    'zahvaljujemo se na popunjavanju anketnog upitnika o kotlovskim postrojenjima.\n' +
    'Upitnik za ' + (f['1.1 Naziv privrednog subjekta'] || 'Vaš privredni subjekt') + ' je uspješno zaprimljen ' +
    Utilities.formatDate(new Date(f['Vrijeme slanja'] || new Date()), 'Europe/Sarajevo', 'dd.MM.yyyy. \'u\' HH:mm') + ' h pod šifrom ' + f['Šifra'] + '.\n\n' +
    'U prilogu se nalazi PDF potvrda sa svim dostavljenim podacima.\n' +
    'Podaci će se koristiti isključivo u naučno-istraživačke svrhe i biće prikazani zbirno, bez navođenja naziva privrednog subjekta.\n\n' +
    'S poštovanjem,\n' +
    'Mašinski fakultet, Univerzitet u Sarajevu\n' +
    'Katedra za energetiku i KGH tehniku';
  const opcije = { name: POSILJALAC, attachments: [pdf] };
  if (KOPIJA_NA) opcije.bcc = KOPIJA_NA;
  MailApp.sendEmail(adresa, 'Potvrda – anketni upitnik o kotlovskim postrojenjima – ' + (f['1.1 Naziv privrednog subjekta'] || '') + ' (' + f['Šifra'] + ')', tekst, opcije);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Pokreni JEDNOM ručno iz editora (Run -> autorizacija) da Google odobri
 * pristup Drive-u i slanju e-maila prije objave nove verzije.
 */
function autorizacija() {
  folder_();
  console.log('Folder za PDF: ' + folder_().getUrl());
  console.log('Preostalo e-mailova danas: ' + MailApp.getRemainingDailyQuota());
}
