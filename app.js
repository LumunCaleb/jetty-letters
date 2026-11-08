(function () {
  const CFG = window.JETTY_CONFIG;
  const J = window.Jetty;
  const $ = (id) => document.getElementById(id);
  const CUSTOM = '__custom__';

  // ---- Storage (on this device only) --------------------------------------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('jetty.' + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('jetty.' + key, JSON.stringify(value)); } catch { /* storage full/blocked */ }
    },
  };

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const blankItem = () => ({ desc: '', qty: '1', price: '' });

  function blankLetter(prev) {
    return {
      id: uid(),
      date: today(),
      ref: '',
      recipientName: '',
      recipientAddress: '',
      salutation: CFG.defaultSalutation,
      subject: '',
      intro: '',
      currency: prev?.currency || 'NGN',
      taxRate: 0,
      items: [blankItem()],
      closing: CFG.defaultClosings[0],
      signatory: prev?.signatory || { ...CFG.defaultSignatories[0] },
    };
  }

  let letter = store.get('draft', null) || blankLetter();
  if (!Array.isArray(letter.items) || !letter.items.length) letter.items = [blankItem()];

  let saveTimer;
  const saveDraft = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set('draft', letter), 300); };

  // ---- Toast --------------------------------------------------------------
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    const open = document.querySelector('dialog[open]');
    (open || document.body).appendChild(t); // dialogs sit above everything else
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ---- Simple text fields --------------------------------------------------
  const FIELDS = ['date', 'ref', 'recipientName', 'recipientAddress', 'salutation', 'subject', 'intro'];
  FIELDS.forEach((f) => {
    $(f).addEventListener('input', (e) => {
      letter[f] = e.target.value;
      e.target.classList.remove('invalid');
      saveDraft();
    });
  });

  // ---- Currency ------------------------------------------------------------
  $('currency').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cur]');
    if (!b) return;
    letter.currency = b.dataset.cur;
    renderCurrency();
    renderTotals();
    saveDraft();
  });
  function renderCurrency() {
    document.querySelectorAll('#currency button').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.cur === letter.currency)));
    const sym = J.CURRENCIES[letter.currency].symbol;
    document.querySelectorAll('.price-label').forEach((el) => { el.textContent = `Price for one (${sym})`; });
  }

  // ---- Items ---------------------------------------------------------------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const withCommas = (v) => {
    const s = String(v ?? '').replace(/,/g, '').trim();
    if (s === '' || isNaN(Number(s))) return v ?? '';
    const [i, d] = s.split('.');
    return Number(i).toLocaleString('en-NG') + (d !== undefined ? '.' + d : '');
  };

  function renderItems() {
    const sym = J.CURRENCIES[letter.currency].symbol;
    $('items').innerHTML = letter.items.map((it, i) => `
      <div class="item" data-i="${i}">
        <div class="item-head">
          <strong>Item ${i + 1}</strong>
          ${letter.items.length > 1 ? `<button type="button" class="item-del" data-del="${i}">✕ Remove</button>` : ''}
        </div>
        <label>What is it?
          <textarea rows="2" data-f="desc" placeholder="e.g. Emulsion paint, 20 litres">${esc(it.desc)}</textarea>
        </label>
        <div class="item-nums">
          <label>Quantity
            <input data-f="qty" inputmode="decimal" autocomplete="off" value="${esc(it.qty)}">
          </label>
          <label><span class="price-label">Price for one (${sym})</span>
            <input data-f="price" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(withCommas(it.price))}">
          </label>
        </div>
        <div class="item-total"><span>Subtotal</span><strong data-line="${i}"></strong></div>
      </div>`).join('');
    renderTotals();
  }

  $('items').addEventListener('input', (e) => {
    const row = e.target.closest('.item');
    const f = e.target.dataset.f;
    if (!row || !f) return;
    letter.items[Number(row.dataset.i)][f] = e.target.value;
    renderTotals();
    saveDraft();
  });
  $('items').addEventListener('focusout', (e) => {
    if (e.target.dataset.f === 'price') e.target.value = withCommas(e.target.value);
  });
  $('items').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const i = Number(b.dataset.del);
    const it = letter.items[i];
    if ((it.desc || it.price) && !confirm(`Remove item ${i + 1}?`)) return;
    letter.items.splice(i, 1);
    renderItems();
    saveDraft();
  });
  $('btnAddItem').addEventListener('click', () => {
    letter.items.push(blankItem());
    renderItems();
    saveDraft();
    const last = $('items').lastElementChild;
    last.scrollIntoView({ behavior: 'smooth', block: 'center' });
    last.querySelector('textarea').focus({ preventScroll: true });
  });

  function renderTotals() {
    const cur = letter.currency;
    letter.items.forEach((it, i) => {
      const el = document.querySelector(`[data-line="${i}"]`);
      if (el) el.textContent = J.money(Math.round(J.parseNum(it.qty) * J.parseNum(it.price) * 100) / 100, cur);
    });
    const t = J.totals(letter);
    $('tSub').textContent = J.money(t.subtotal, cur);
    $('taxRow').hidden = !(t.rate > 0);
    $('tTaxLabel').textContent = `VAT (${t.rate}%)`;
    $('tTax').textContent = J.money(t.tax, cur);
    $('tGrand').textContent = J.money(t.grand, cur);
    $('tWords').textContent = t.grand > 0 ? J.amountInWords(t.grand, cur) : '';
  }

  $('tax').addEventListener('change', (e) => {
    letter.taxRate = Number(e.target.value);
    renderTotals();
    saveDraft();
  });

  // ---- Closing line dropdown ----------------------------------------------
  const savedClosings = () => store.get('closings', []);
  const allClosings = () => [...CFG.defaultClosings, ...savedClosings().filter((c) => !CFG.defaultClosings.includes(c))];

  function renderClosing() {
    const list = allClosings();
    const sel = $('closingSelect');
    sel.innerHTML = list.map((c, i) => `<option value="${i}">${esc(c)}</option>`).join('')
      + `<option value="${CUSTOM}">✎ Write my own…</option>`;
    const idx = list.indexOf(letter.closing);
    const custom = idx < 0;
    sel.value = custom ? CUSTOM : String(idx);
    $('closingCustomWrap').hidden = !custom;
    if (custom) $('closingCustom').value = letter.closing || '';
    $('btnRemoveClosing').hidden = custom || CFG.defaultClosings.includes(letter.closing);
  }
  $('closingSelect').addEventListener('change', (e) => {
    if (e.target.value === CUSTOM) {
      letter.closing = '';
      renderClosing();
      $('closingCustom').focus();
    } else {
      letter.closing = allClosings()[Number(e.target.value)];
      renderClosing();
    }
    saveDraft();
  });
  $('closingCustom').addEventListener('input', (e) => { letter.closing = e.target.value; saveDraft(); });
  $('btnRemoveClosing').addEventListener('click', () => {
    if (!confirm('Remove this closing line from the list?')) return;
    store.set('closings', savedClosings().filter((c) => c !== letter.closing));
    letter.closing = CFG.defaultClosings[0];
    renderClosing();
    saveDraft();
  });

  // ---- Signatory dropdown -------------------------------------------------
  const sameSig = (a, b) => a && b && a.name.trim() === b.name.trim() && (a.title || '').trim() === (b.title || '').trim();
  const sigLabel = (s) => (s.title ? `${s.name} — ${s.title}` : s.name);
  const savedSigs = () => store.get('signatories', []);
  const allSigs = () => [...CFG.defaultSignatories, ...savedSigs().filter((s) => !CFG.defaultSignatories.some((d) => sameSig(d, s)))];
  let sigCustomMode = false;

  function renderSignatory() {
    const list = allSigs();
    const sel = $('signatorySelect');
    sel.innerHTML = list.map((s, i) => `<option value="${i}">${esc(sigLabel(s))}</option>`).join('')
      + `<option value="${CUSTOM}">+ Someone else…</option>`;
    const idx = sigCustomMode ? -1 : list.findIndex((s) => sameSig(s, letter.signatory));
    const custom = idx < 0;
    sigCustomMode = custom;
    sel.value = custom ? CUSTOM : String(idx);
    $('signatoryCustomWrap').hidden = !custom;
    if (custom) {
      $('sigName').value = letter.signatory?.name || '';
      $('sigTitle').value = letter.signatory?.title || '';
    }
    $('btnRemoveSignatory').hidden = custom || CFG.defaultSignatories.some((d) => sameSig(d, letter.signatory));
  }
  $('signatorySelect').addEventListener('change', (e) => {
    if (e.target.value === CUSTOM) {
      sigCustomMode = true;
      letter.signatory = { name: '', title: '' };
      renderSignatory();
      $('sigName').focus();
    } else {
      sigCustomMode = false;
      letter.signatory = { ...allSigs()[Number(e.target.value)] };
      renderSignatory();
    }
    saveDraft();
  });
  ['sigName', 'sigTitle'].forEach((id) => $(id).addEventListener('input', () => {
    letter.signatory = { name: $('sigName').value, title: $('sigTitle').value };
    $('sigName').classList.remove('invalid');
    saveDraft();
  }));
  $('btnRemoveSignatory').addEventListener('click', () => {
    if (!confirm(`Remove ${letter.signatory.name} from the list?`)) return;
    store.set('signatories', savedSigs().filter((s) => !sameSig(s, letter.signatory)));
    letter.signatory = { ...CFG.defaultSignatories[0] };
    renderSignatory();
    saveDraft();
  });

  // Custom names/closings are remembered once a letter is made with them.
  function rememberCustomChoices() {
    const c = (letter.closing || '').trim();
    if (c && !allClosings().includes(c)) store.set('closings', [...savedClosings(), c]);
    const s = letter.signatory;
    if (s?.name?.trim() && !allSigs().some((x) => sameSig(x, s))) {
      store.set('signatories', [...savedSigs(), { name: s.name.trim(), title: (s.title || '').trim() }]);
    }
    sigCustomMode = false;
    renderClosing();
    renderSignatory();
  }

  // ---- Fill the whole form from `letter` ----------------------------------
  function renderAll() {
    FIELDS.forEach((f) => { $(f).value = letter[f] || ''; $(f).classList.remove('invalid'); });
    $('tax').value = String(letter.taxRate || 0);
    if (!$('tax').value) $('tax').value = '0';
    sigCustomMode = false;
    renderItems();
    renderCurrency();
    renderClosing();
    renderSignatory();
  }

  // ---- Checks before preview ----------------------------------------------
  function check() {
    const missing = [];
    const need = [['recipientName', 'who the letter is to'], ['subject', 'the subject']];
    need.forEach(([id, label]) => {
      if (!String(letter[id] || '').trim()) { $(id).classList.add('invalid'); missing.push({ id, label }); }
    });
    if (!letter.signatory?.name?.trim()) { $('sigName').classList.add('invalid'); missing.push({ id: 'sigName', label: 'who is signing' }); }
    if (missing.length) {
      toast('Please fill in ' + missing.map((m) => m.label).join(' and '));
      $(missing[0].id).scrollIntoView({ behavior: 'smooth', block: 'center' });
      $(missing[0].id).focus({ preventScroll: true });
      return false;
    }
    return true;
  }

  // ---- Preview -------------------------------------------------------------
  let pdfJob = null; // Promise<{blob, name}> built while the preview is open

  function previewHtml() {
    const t = J.totals(letter);
    const cur = letter.currency;
    const sym = J.CURRENCIES[cur].symbol;
    const brand = `rgb(${CFG.brandColor.join(',')})`;
    const p = (s, cls = '') => (s ? `<p class="${cls}">${esc(s)}</p>` : '');
    const table = t.rows.length ? `
      <table>
        <thead style="background:${brand}"><tr>
          <th class="ctr">S/N</th><th>Item / Description</th><th class="ctr">Qty</th>
          <th class="num">Unit Price (${sym})</th><th class="num">Amount (${sym})</th></tr></thead>
        <tbody>${t.rows.map((r, i) => `<tr><td class="ctr">${i + 1}</td><td>${esc(r.desc)}</td>
          <td class="ctr">${J.fmtQty(r.qty)}</td><td class="num">${J.fmt(r.price)}</td><td class="num">${J.fmt(r.amount)}</td></tr>`).join('')}</tbody>
        <tfoot>
          <tr><td colspan="4" class="num">Subtotal</td><td class="num">${J.money(t.subtotal, cur)}</td></tr>
          ${t.tax > 0 ? `<tr><td colspan="4" class="num">VAT (${t.rate}%)</td><td class="num">${J.money(t.tax, cur)}</td></tr>` : ''}
          <tr class="grand"><td colspan="3"></td><td class="num">Grand Total</td><td class="num">${J.money(t.grand, cur)}</td></tr>
        </tfoot>
      </table>` : '';
    const sig = letter.signatory || {};
    return `
      <div class="lt-top"><span>${letter.ref ? 'Ref: ' + esc(letter.ref) : ''}</span><span>${esc(J.formatDate(letter.date))}</span></div>
      <div class="lt-to"><p><b>${esc(letter.recipientName)}</b></p>${p(letter.recipientAddress)}</div>
      ${p(letter.salutation)}
      ${p(letter.subject, 'lt-subject')}
      ${p(letter.intro, 'lt-intro')}
      ${table}
      ${t.rows.length ? p(`Amount in words: ${J.amountInWords(t.grand, cur)}.`, 'lt-words') : ''}
      ${p(letter.closing, 'lt-closing')}
      <p>${esc(CFG.signOff)}</p>
      <p class="lt-sign">${esc(sig.name)}</p>
      ${p(sig.title)}`;
  }

  function fitPreview() {
    const page = $('previewPage');
    const wrap = page.parentElement;
    page.style.transform = '';
    const avail = wrap.clientWidth - 32;
    const scale = Math.min(1, avail / page.offsetWidth);
    page.style.transform = `scale(${scale})`;
    page.style.marginBottom = `${-(1 - scale) * page.offsetHeight}px`;
    page.style.marginLeft = `${Math.max(0, (avail - page.offsetWidth * scale) / 2)}px`;
  }

  $('btnPreview').addEventListener('click', async () => {
    if (!check()) return;
    const M = CFG.margins;
    const page = $('previewPage');
    page.style.backgroundImage = `url("${CFG.letterheadImage}")`;
    page.style.padding = `${M.top}mm ${M.right}mm ${M.bottom}mm ${M.left}mm`;
    page.innerHTML = previewHtml();
    $('previewDlg').showModal();
    $('previewDlg').querySelector('.preview-scroll').scrollTop = 0;
    fitPreview();
    const snapshot = JSON.parse(JSON.stringify(letter));
    pdfJob = J.buildPdf(snapshot).then((doc) => ({ blob: doc.output('blob'), name: J.fileName(snapshot) }));
    pdfJob.catch((err) => { console.error(err); toast('Could not prepare the PDF. Please try again.'); });
  });
  window.addEventListener('resize', () => { if ($('previewDlg').open) fitPreview(); });

  function addToHistory() {
    const hist = store.get('history', []).filter((h) => h.id !== letter.id);
    hist.unshift({ ...JSON.parse(JSON.stringify(letter)), savedAt: Date.now() });
    store.set('history', hist.slice(0, 100));
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function withPdf(fn, btn) {
    if (!pdfJob) return;
    btn.disabled = true;
    try {
      const { blob, name } = await pdfJob;
      await fn(blob, name);
      addToHistory();
      rememberCustomChoices();
      saveDraft();
    } catch (err) {
      if (err?.name !== 'AbortError') { console.error(err); toast('Something went wrong. Please try again.'); }
    } finally {
      btn.disabled = false;
    }
  }

  $('btnDownload').addEventListener('click', (e) => withPdf(async (blob, name) => {
    downloadBlob(blob, name);
    toast('PDF saved to your Downloads');
  }, e.currentTarget));

  $('btnShare').addEventListener('click', (e) => withPdf(async (blob, name) => {
    const file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: letter.subject || name });
    } else {
      downloadBlob(blob, name);
      toast('Sharing isn’t available here, so the PDF was saved instead');
    }
  }, e.currentTarget));

  // ---- Past letters --------------------------------------------------------
  function renderHistory() {
    const hist = store.get('history', []);
    $('historyList').innerHTML = hist.length ? hist.map((h, i) => `
      <li>
        <div class="h-main" data-open="${i}">
          <div><strong>${esc(h.recipientName || 'No name')}</strong></div>
          <div>${esc(h.subject || '')}</div>
          <div class="h-sub">${esc(J.formatDate(h.date))} · ${esc(J.money(J.totals(h).grand, h.currency || 'NGN'))}</div>
        </div>
        <button type="button" class="btn outline" data-copy="${i}">Copy</button>
        <button type="button" class="item-del" data-remove="${i}" aria-label="Delete">✕</button>
      </li>`).join('')
      : '<li class="empty">Letters you share or save will appear here.</li>';
  }
  $('btnHistory').addEventListener('click', () => { renderHistory(); $('historyDlg').showModal(); });
  $('historyList').addEventListener('click', (e) => {
    const hist = store.get('history', []);
    const open = e.target.closest('[data-open]');
    const copy = e.target.closest('[data-copy]');
    const remove = e.target.closest('[data-remove]');
    if (open || copy) {
      const h = JSON.parse(JSON.stringify(hist[Number((open || copy).dataset.open ?? (open || copy).dataset.copy)]));
      delete h.savedAt;
      if (copy) { h.id = uid(); h.date = today(); }
      letter = h;
      renderAll();
      saveDraft();
      $('historyDlg').close();
      window.scrollTo({ top: 0 });
      toast(copy ? 'Copied — edit it and create a new letter' : 'Letter opened for editing');
    } else if (remove) {
      if (!confirm('Delete this letter from the list?')) return;
      hist.splice(Number(remove.dataset.remove), 1);
      store.set('history', hist);
      renderHistory();
    }
  });

  // ---- New letter ----------------------------------------------------------
  $('btnNew').addEventListener('click', () => {
    if (!confirm('Start a new letter? The form will be cleared.\n(Letters you shared or saved stay in "Past letters".)')) return;
    letter = blankLetter(letter);
    renderAll();
    saveDraft();
    window.scrollTo({ top: 0 });
  });

  // ---- Dialog close buttons ----------------------------------------------
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close()));

  // ---- Start ---------------------------------------------------------------
  renderAll();
  J.loadAssets().catch(() => {}); // warm up fonts/letterhead
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
