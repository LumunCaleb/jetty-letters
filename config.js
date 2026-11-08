// Jetty Letters — settings you may want to change.
window.JETTY_CONFIG = {
  // Full-page A4 image of the letterhead (PNG or JPG, portrait). Regenerate with tools/make_letterhead.py.
  letterheadImage: 'assets/brand/letterhead.jpg',

  // Blank writing area inside the letterhead, in millimetres from each page edge.
  // Increase `top` if text runs into the logo/header, `bottom` if it hits the footer.
  margins: { top: 54, bottom: 24, left: 20, right: 20 },

  // Colour used for the table header (R, G, B). Match it to the letterhead.
  brandColor: [15, 61, 110],

  vatRate: 7.5,

  defaultSalutation: 'Dear Sir/Madam,',

  // Always available in the "Signed by" list. Position is optional.
  defaultSignatories: [
    { name: 'Dr. Isaiah Asen', title: '' },
  ],

  // Always available in the "Closing line" list.
  defaultClosings: [
    'Thank you for your patronage.',
    'We look forward to doing business with you.',
    'We hope our offer meets your approval. Thank you.',
  ],

  signOff: 'Yours faithfully,',
};
