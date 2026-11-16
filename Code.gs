/**
 * Prijem odgovora online upitnika (GitHub Pages) u Google Sheet.
 * Tabela ima dva sheeta: "Privredni subjekti" (red po upitniku) i "Kotlovi" (red po kotlu).
 * Zaglavlja kolona se kreiraju automatski iz prvog pristiglog upitnika.
 */
const SHEET_ID = '1jFLcj7ErQh0pYMuyHFpG0tQxZqIbstX_Yv0W9f9NGAM'; // tabela "Upitnik kotlovska postrojenja – odgovori"
const SHEET_FIRME = 'Privredni subjekti';
const SHEET_KOTLOVI = 'Kotlovi';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);                       // dva istovremena slanja ne pišu u isti red
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.hp) return json_({ ok: true });  // popunjeno skriveno polje = spam robot, ignoriši
    if (!data.firma || !data.firma['Šifra']) return json_({ ok: false, error: 'neispravan zahtjev' });
    const ss = SpreadsheetApp.openById(SHEET_ID);
    upisi_(ss, SHEET_FIRME, [data.firma]);
    upisi_(ss, SHEET_KOTLOVI, data.kotlovi || []);
    return json_({ ok: true, sifra: data.firma['Šifra'] });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
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

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
