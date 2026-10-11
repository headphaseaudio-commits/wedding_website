/**
 * RSVP backend: Google Apps Script bound to a Google Sheet.
 * Setup steps are in README.md → "Collecting replies".
 */

const SHEET_NAME = 'RSVPs';
const NOTIFY_EMAIL = 'ourweddingday.june27@gmail.com'; // gets a message for every reply ('' = off)
const SEND_GUEST_CONFIRMATION = true; // email accepting guests a confirmation in their language

const HEADERS = ['Received', 'Language', 'Name', 'Attending', 'Email', 'Diet', 'Allergies / dietary notes', 'Other notes', 'Message'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.website) return json({ ok: true }); // honeypot tripped: pretend success

    const name = clean(d.name, 120);
    const attending = d.attending === 'yes' ? 'yes' : d.attending === 'no' ? 'no' : '';
    const email = clean(d.email, 160);
    if (name.length < 2 || !attending) return json({ ok: false, error: 'invalid' });
    if (attending === 'yes' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, error: 'email' });

    const row = [
      new Date(),
      d.lang === 'pl' ? 'pl' : 'en',
      name,
      attending,
      email,
      (Array.isArray(d.diet) ? d.diet : []).map(x => clean(x, 30)).join(', '),
      clean(d.allergies, 600),
      clean(d.notes, 1000),
      clean(d.message, 1000)
    ];
    sheet().appendRow(row);

    if (NOTIFY_EMAIL) {
      const note = {
        to: NOTIFY_EMAIL,
        subject: `RSVP: ${name} — ${attending === 'yes' ? 'coming 🎉' : 'not coming'}`,
        body: HEADERS.map((h, i) => `${h}: ${row[i] || '—'}`).join('\n')
      };
      if (email) note.replyTo = email; // hitting Reply answers the guest directly
      MailApp.sendEmail(note);
    }
    if (SEND_GUEST_CONFIRMATION && attending === 'yes') {
      const pl = row[1] === 'pl';
      MailApp.sendEmail({
        to: email,
        name: 'Stephanie & Jakub',
        subject: pl ? 'Dziękujemy za potwierdzenie! 🐢' : 'Thank you for your RSVP! 🐢',
        body: pl
          ? `Cześć ${name},\n\ndziękujemy za potwierdzenie obecności! Do zobaczenia w sobotę 5 czerwca 2027 w Głogowie.\n\nCeremonia: godz. 14:00, Kościół Chrześcijan Baptystów, Fryderyka Chopina 55\nPrzyjęcie: godz. 15:00, Sala Bankietowa Marilyn, Strumykowa 2D\n\nStephanie i Jakub`
          : `Hi ${name},\n\nthank you for your RSVP! See you on Saturday 5 June 2027 in Głogów.\n\nCeremony: 2:00 PM, Kościół Chrześcijan Baptystów, Fryderyka Chopina 55\nReception: 3:00 PM, Sala Bankietowa Marilyn, Strumykowa 2D\n\nStephanie & Jakub`
      });
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

// Trim, cap length, and neutralise spreadsheet formula injection (=, +, -, @).
function clean(v, max) {
  const s = String(v == null ? '' : v).trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
