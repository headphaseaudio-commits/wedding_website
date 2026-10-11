/* Site settings — edit these, nothing else needs touching. */
window.WEDDING_CONFIG = {
  // Google Apps Script web-app URL (see README → "Collecting replies").
  // Leave empty to run in preview mode: the form works but nothing is saved.
  rsvpEndpoint: 'https://script.google.com/macros/s/AKfycbwng0s9q2b48dfyIDyw5YqVOwH7Y0bUfkJYC5Dxmd-EChnW9Kkc1t9y-vbPPy1mGJ9iFQ/exec',

  // RSVP deadline as YYYY-MM-DD, e.g. '2027-03-31'. Empty = "as soon as you can".
  rsvpDeadline: '',

  // Shown in the footer as "Questions? …". Empty = hidden.
  contactEmail: '',

  // Ceremony start, with the Polish summer offset (CEST, UTC+2).
  weddingStart: '2027-06-05T14:00:00+02:00',
  // Rough end of the party, used for calendar entries only.
  weddingEnd: '2027-06-06T01:00:00+02:00'
};
