// Shared calculations/formatting + PDF generation on the letterhead.
(function () {
  const CFG = window.JETTY_CONFIG;

  const CURRENCIES = {
    NGN: { symbol: '₦', name: 'Naira' },
    USD: { symbol: '$', name: 'Dollar' },
    EUR: { symbol: '€', name: 'Euro' },
  };

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function parseNum(v) {
    const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  const nf = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const qf = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 });
  const fmt = (n) => nf.format(n);
  const fmtQty = (n) => qf.format(n);
  const money = (n, cur) => (CURRENCIES[cur] || CURRENCIES.NGN).symbol + nf.format(n);

  // An item counts if it has a description or a price.
  const usedItems = (items) =>
    (items || []).filter((it) => String(it.desc || '').trim() || parseNum(it.price));

  function totals(letter) {
    const rows = usedItems(letter.items).map((it) => {
      const qty = parseNum(it.qty);
      const price = parseNum(it.price);
      return { desc: String(it.desc || '').trim(), qty, price, amount: round2(qty * price) };
    });
    const subtotal = round2(rows.reduce((s, r) => s + r.amount, 0));
    const rate = parseNum(letter.taxRate);
    const tax = rate > 0 ? round2((subtotal * rate) / 100) : 0;
    return { rows, subtotal, rate, tax, grand: round2(subtotal + tax) };
  }

  // "2026-11-08" -> "8th November, 2026"
  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    const s = d % 100 >= 11 && d % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[d % 10] || 'th');
    return `${d}${s} ${months[m - 1]}, ${y}`;
  }

  // 1076075.5, 'NGN' -> "One Million, Seventy-Six Thousand and Seventy-Five Naira, Fifty Kobo Only"
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
    'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  const UNITS = {
    NGN: ['Naira', 'Naira', 'Kobo', 'Kobo'],
    USD: ['Dollar', 'Dollars', 'Cent', 'Cents'],
    EUR: ['Euro', 'Euros', 'Cent', 'Cents'],
  };
  function under100(n) {
    return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  }
  function under1000(n) {
    const h = Math.floor(n / 100), r = n % 100;
    return [h ? ONES[h] + ' Hundred' : '', r ? (h ? 'and ' : '') + under100(r) : ''].filter(Boolean).join(' ');
  }
  function intToWords(n) {
    if (n === 0) return 'Zero';
    const groups = [];
    for (let i = 0; n > 0 && i < SCALES.length; i++, n = Math.floor(n / 1000)) groups.push(n % 1000);
    const parts = [];
    for (let i = groups.length - 1; i >= 0; i--) {
      if (!groups[i]) continue;
      const w = under1000(groups[i]) + (SCALES[i] ? ' ' + SCALES[i] : '');
      // "One Thousand and Five": a final group under 100 joins with "and"
      if (i === 0 && parts.length && groups[0] < 100) parts.push('and ' + w);
      else parts.push(w);
    }
    return parts.join(', ').replace(/, and /g, ' and ');
  }
  function amountInWords(amount, cur) {
    const [one, many, subOne, subMany] = UNITS[cur] || UNITS.NGN;
    const cents = Math.round(Math.abs(amount) * 100);
    const whole = Math.floor(cents / 100), sub = cents % 100;
    const parts = [];
    if (whole || !sub) parts.push(`${intToWords(whole)} ${whole === 1 ? one : many}`);
    if (sub) parts.push(`${intToWords(sub)} ${sub === 1 ? subOne : subMany}`);
    return parts.join(', ') + ' Only';
  }

  // ---- PDF ----------------------------------------------------------------

  let assetsPromise = null;

  async function toDataURL(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url}`);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  function loadAssets() {
    if (!assetsPromise) {
      assetsPromise = Promise.all([
        toDataURL(CFG.letterheadImage).catch(() => null),
        toDataURL('assets/fonts/NotoSans-Regular.ttf'),
        toDataURL('assets/fonts/NotoSans-Bold.ttf'),
      ]).then(([letterhead, reg, bold]) => ({
        letterhead,
        letterheadFormat: letterhead && /^data:image\/jpe?g/i.test(letterhead) ? 'JPEG' : 'PNG',
        reg: reg.split(',')[1],
        bold: bold.split(',')[1],
      })).catch((e) => { assetsPromise = null; throw e; });
    }
    return assetsPromise;
  }

  async function buildPdf(letter) {
    const A = await loadAssets();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.addFileToVFS('NotoSans-Regular.ttf', A.reg);
    doc.addFont('NotoSans-Regular.ttf', 'Noto', 'normal');
    doc.addFileToVFS('NotoSans-Bold.ttf', A.bold);
    doc.addFont('NotoSans-Bold.ttf', 'Noto', 'bold');

    const PW = 210, PH = 297;
    const M = CFG.margins;
    const CW = PW - M.left - M.right;
    const BODY = 11;
    const lineH = (pt) => pt * 0.3528 * 1.4;

    const decorated = new Set();
    const decorate = () => {
      const n = doc.getCurrentPageInfo().pageNumber;
      if (decorated.has(n)) return;
      decorated.add(n);
      if (A.letterhead) doc.addImage(A.letterhead, A.letterheadFormat, 0, 0, PW, PH, 'letterhead', 'FAST');
    };
    const newPage = () => { doc.addPage(); decorate(); y = M.top; };

    let y = M.top;
    decorate();
    const ensure = (h) => { if (y + h > PH - M.bottom) newPage(); };

    function write(text, { size = BODY, bold = false, align = 'left', underline = false, upper = false } = {}) {
      if (!text) return;
      doc.setFont('Noto', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const lh = lineH(size);
      const lines = doc.splitTextToSize(upper ? text.toUpperCase() : text, CW);
      for (const ln of lines) {
        ensure(lh);
        const x = align === 'right' ? PW - M.right : M.left;
        doc.text(ln, x, y, { align, baseline: 'top' });
        if (underline && ln.trim()) {
          const w = doc.getTextWidth(ln);
          const ux = align === 'right' ? x - w : x;
          doc.setLineWidth(0.3);
          doc.line(ux, y + size * 0.3528 * 1.15, ux + w, y + size * 0.3528 * 1.15);
        }
        y += lh;
      }
    }
    const gap = (mm) => { y += mm; };

    // Reference + date
    doc.setFont('Noto', 'normal');
    doc.setFontSize(BODY);
    if (letter.ref) doc.text(`Ref: ${letter.ref}`, M.left, y, { baseline: 'top' });
    doc.text(formatDate(letter.date), PW - M.right, y, { align: 'right', baseline: 'top' });
    gap(lineH(BODY) + 6);

    // Recipient
    write(letter.recipientName, { bold: true });
    write(letter.recipientAddress);
    gap(6);

    write(letter.salutation);
    gap(4);
    write(letter.subject, { bold: true, underline: true, upper: true });
    gap(4);
    if (letter.intro) { write(letter.intro); gap(5); }

    // Quotation table
    const t = totals(letter);
    if (t.rows.length) {
      const sym = (CURRENCIES[letter.currency] || CURRENCIES.NGN).symbol;
      const foot = [['', '', '', 'Subtotal', money(t.subtotal, letter.currency)]];
      if (t.tax > 0) foot.push(['', '', '', `VAT (${t.rate}%)`, money(t.tax, letter.currency)]);
      foot.push(['', '', '', 'Grand Total', money(t.grand, letter.currency)]);
      const lastFoot = foot.length - 1;

      ensure(25);
      doc.autoTable({
        startY: y,
        margin: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
        head: [['S/N', 'Item / Description', 'Qty', `Unit Price (${sym})`, `Amount (${sym})`]],
        body: t.rows.map((r, i) => [String(i + 1), r.desc, fmtQty(r.qty), fmt(r.price), fmt(r.amount)]),
        foot,
        showHead: 'everyPage',
        showFoot: 'lastPage',
        theme: 'plain',
        styles: { font: 'Noto', fontSize: 10, cellPadding: 2, textColor: [26, 26, 26], valign: 'top', overflow: 'linebreak' },
        headStyles: { font: 'Noto', fontStyle: 'bold', fillColor: CFG.brandColor, textColor: 255 },
        footStyles: { font: 'Noto', fontStyle: 'bold', textColor: [26, 26, 26] },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 16, halign: 'center' },
          3: { cellWidth: 32, halign: 'right' },
          4: { cellWidth: 34, halign: 'right' },
        },
        willDrawPage: decorate,
        didParseCell: (d) => {
          if (d.section === 'head' && d.column.index >= 2) d.cell.styles.halign = d.column.index === 2 ? 'center' : 'right';
          if (d.section === 'foot' && d.column.index === 3) {
            d.cell.styles.halign = 'right';
            d.cell.styles.overflow = 'visible';
          }
          if (d.section === 'foot' && d.column.index === 4) d.cell.styles.halign = 'right';
        },
        didDrawCell: (d) => {
          if (d.section === 'body') {
            doc.setDrawColor(204, 211, 220);
            doc.setLineWidth(0.2);
            doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
          }
          if (d.section === 'foot' && d.row.index === lastFoot && d.column.index >= 3) {
            doc.setDrawColor(26, 26, 26);
            doc.setLineWidth(0.4);
            doc.line(d.cell.x, d.cell.y, d.cell.x + d.cell.width, d.cell.y);
          }
        },
      });
      y = doc.lastAutoTable.finalY + 4;
      write(`Amount in words: ${amountInWords(t.grand, letter.currency)}.`, { size: 10, bold: true });
      gap(6);
    }

    if (letter.closing) { write(letter.closing); gap(7); }

    // Keep the sign-off block together on one page.
    const sig = letter.signatory || {};
    ensure(lineH(BODY) * 3 + 15);
    write(CFG.signOff);
    gap(15);
    write(sig.name, { bold: true });
    write(sig.title);

    // Page numbers when the letter runs over one page.
    const pages = doc.getNumberOfPages();
    if (pages > 1) {
      doc.setFont('Noto', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110);
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.text(`Page ${i} of ${pages}`, PW - M.right, PH - M.bottom + 2, { align: 'right', baseline: 'top' });
      }
    }
    return doc;
  }

  function fileName(letter) {
    const who = String(letter.recipientName || 'Letter').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    return `Jetty_${who || 'Letter'}_${letter.date || ''}.pdf`.replace(/_\.pdf$/, '.pdf');
  }

  window.Jetty = { CURRENCIES, amountInWords, parseNum, fmt, fmtQty, money, totals, formatDate, loadAssets, buildPdf, fileName, usedItems };
})();
