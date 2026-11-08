"""Capture phone-resolution screenshots of Jetty Letters for the tutorial video.
Drives headless Chrome over the DevTools protocol. Writes shots/*.png + shots/scenes.json + letter.pdf
"""
import base64, json, os, subprocess, sys, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots'); os.makedirs(SHOTS, exist_ok=True)
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
PORT = 9333
URL = 'http://localhost:8765/'
W, H, DPR = 390, 844, 3

proc = subprocess.Popen([CHROME, '--headless=new', f'--remote-debugging-port={PORT}',
                         f'--user-data-dir={os.path.join(HERE, "chrome-prof")}', '--no-first-run',
                         '--no-default-browser-check', '--hide-scrollbars', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            targets = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json'))
            break
        except Exception:
            time.sleep(0.2)
    page = next(t for t in targets if t['type'] == 'page')
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=60)
    msg_id = 0

    def cdp(method, **params):
        global msg_id
        msg_id += 1
        ws.send(json.dumps({'id': msg_id, 'method': method, 'params': params}))
        while True:
            m = json.loads(ws.recv())
            if m.get('id') == msg_id:
                if 'error' in m:
                    raise RuntimeError(f'{method}: {m["error"]}')
                return m.get('result', {})

    def js(code):
        r = cdp('Runtime.evaluate', expression=f'(async () => {{ {code} }})()', awaitPromise=True, returnByValue=True)
        if r.get('exceptionDetails'):
            raise RuntimeError(r['exceptionDetails'].get('exception', {}).get('description', r['exceptionDetails']))
        return r.get('result', {}).get('value')

    cdp('Emulation.setDeviceMetricsOverride', width=W, height=H, deviceScaleFactor=DPR, mobile=True)
    cdp('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)
    cdp('Page.enable')
    cdp('Page.navigate', url=URL)
    time.sleep(2.5)
    js("localStorage.clear(); location.reload();")
    time.sleep(2.5)

    HELPERS = r"""
    window.$$set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); el.dispatchEvent(new Event('focusout', {bubbles:true})); };
    window.$$box = (els) => { const rs = els.map(e => e.getBoundingClientRect()); const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom)); return [l, t, r - l, b - t]; };
    window.$$top = (el, offset = 76) => { window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset); };
    window.$$wait = (ms) => new Promise(r => setTimeout(r, ms));
    document.activeElement && document.activeElement.blur();
    """

    scenes = []

    def shot(name, code):
        boxes = js(HELPERS + code)
        time.sleep(0.4)
        data = cdp('Page.captureScreenshot', format='png')['data']
        path = os.path.join(SHOTS, name + '.png')
        open(path, 'wb').write(base64.b64decode(data))
        scenes.append({'name': name, 'boxes': [[round(v * DPR) for v in b] for b in (boxes or [])]})
        print('captured', name, boxes)

    # 1. The empty form
    shot('02_open', r"""
      window.scrollTo(0, 0); await $$wait(200);
      return [$$box([document.getElementById('btnNew')])];
    """)

    # 2. Letter details
    shot('03_details', r"""
      $$set(document.getElementById('ref'), 'JGR/QT/2026/021');
      $$set(document.getElementById('recipientName'), 'The Principal, Sunrise Model School');
      $$set(document.getElementById('recipientAddress'), 'Km 3, Gboko Road\nMakurdi, Benue State');
      window.scrollTo(0, 0); await $$wait(200);
      const lab = (id) => document.getElementById(id).closest('label');
      return [$$box([lab('date'), lab('ref')]), $$box([lab('recipientName'), lab('recipientAddress')])];
    """)

    # 3. Greeting, subject, opening paragraph
    shot('04_subject', r"""
      $$set(document.getElementById('subject'), 'Quotation for painting of classroom blocks');
      $$set(document.getElementById('intro'), 'Further to your request, we are pleased to forward our quotation for the painting of your classroom blocks as detailed below:');
      const lab = (id) => document.getElementById(id).closest('label');
      $$top(lab('salutation')); await $$wait(200);
      return [$$box([lab('subject')]), $$box([lab('intro')])];
    """)

    # 4. Currency + first item
    shot('05_items', r"""
      document.querySelector('#currency [data-cur="NGN"]').click();
      const it = document.querySelectorAll('#items .item')[0];
      $$set(it.querySelector('[data-f=desc]'), 'Supply of Jetty Emulsion Paint (20 litres)');
      $$set(it.querySelector('[data-f=qty]'), '15');
      $$set(it.querySelector('[data-f=price]'), '42000');
      $$top(document.getElementById('currency').closest('.card'), 70); await $$wait(200);
      return [$$box([document.getElementById('currency')]), $$box([it])];
    """)

    # 5. More items
    shot('06_more', r"""
      const add = (d, q, p) => { document.getElementById('btnAddItem').click(); const items = document.querySelectorAll('#items .item'); const it = items[items.length - 1];
        $$set(it.querySelector('[data-f=desc]'), d); $$set(it.querySelector('[data-f=qty]'), q); $$set(it.querySelector('[data-f=price]'), p); };
      add('Supply of Jetty Gloss Paint (4 litres)', '8', '16500');
      add('Labour: surface preparation and painting of 6 classrooms', '1', '450000');
      document.activeElement && document.activeElement.blur();
      const btn = document.getElementById('btnAddItem');
      window.scrollTo(0, btn.getBoundingClientRect().top + window.scrollY - 560); await $$wait(250);
      const items = document.querySelectorAll('#items .item');
      return [$$box([btn]), $$box([items[items.length - 1].querySelector('.item-del')])];
    """)

    # 6. Totals with VAT + amount in words
    shot('07_totals', r"""
      $$set(document.getElementById('tax'), '7.5');
      const t = document.querySelector('.totals');
      $$top(t, 220); await $$wait(250);
      return [$$box([document.getElementById('tax')]), $$box([document.querySelector('.trow.grand'), document.getElementById('tWords')])];
    """)

    # 7. Closing & signature
    shot('08_closing', r"""
      const card = document.getElementById('closingSelect').closest('.card');
      $$top(card, 70); await $$wait(250);
      return [$$box([document.getElementById('closingSelect')]), $$box([document.getElementById('signatorySelect')])];
    """)

    # Seed two older letters for the "Past letters" scene (the previewed one goes on top).
    js(r"""
      const base = JSON.parse(localStorage.getItem('jetty.draft'));
      const mk = (id, days, name, subject, items) => ({ ...base, id, date: new Date(Date.now() - days*864e5).toISOString().slice(0,10), recipientName: name, subject, items, taxRate: 0, savedAt: Date.now() - days*864e5 });
      localStorage.setItem('jetty.history', JSON.stringify([
        mk('old1', 6, 'Mrs. Grace Terver', 'Quotation for POP ceiling works', [{desc:'POP ceiling, living room and bedrooms', qty:'1', price:'780000'}]),
        mk('old2', 15, 'The Manager, Riverside Hotel, Makurdi', 'Quotation for screeding and painting of lobby', [{desc:'Screeding and painting of lobby', qty:'1', price:'1250000'}]),
      ]));
    """)

    # 8. Preview
    shot('09_preview', r"""
      window.scrollTo(0, 0);
      document.getElementById('btnPreview').click(); await $$wait(1500);
      return [$$box([document.querySelector('#previewDlg [data-close]')])];
    """)

    # 9. Share / save buttons
    shot('10_share', r"""
      document.querySelector('#previewDlg .preview-scroll').scrollTop = 220; await $$wait(250);
      return [$$box([document.getElementById('btnShare')]), $$box([document.getElementById('btnDownload')])];
    """)

    # 10. Past letters
    shot('11_past', r"""
      document.querySelector('#previewDlg [data-close]').click(); await $$wait(200);
      document.getElementById('btnHistory').click();
      for (let i = 0; i < 40 && window.JettySync.status().state === 'loading'; i++) await $$wait(250);
      document.getElementById('syncBar').hidden = true; // shown in the next scene
      await $$wait(300);
      const li = document.querySelector('#historyList li');
      return [$$box([li.querySelector('.h-main')]), $$box([li.querySelector('[data-copy]')])];
    """)

    # 11. Backup panel
    shot('12_backup', r"""
      document.getElementById('syncBar').hidden = false;
      for (let i = 0; i < 40 && window.JettySync.status().state === 'loading'; i++) await $$wait(250);
      await $$wait(300);
      return [$$box([document.getElementById('btnSync')])];
    """)

    # The finished letter as a PDF (for the closing scene)
    pdf_b64 = js(r"""
      const d = JSON.parse(localStorage.getItem('jetty.draft'));
      const doc = await Jetty.buildPdf(d);
      return doc.output('datauristring').split(',')[1];
    """)
    open(os.path.join(HERE, 'letter.pdf'), 'wb').write(base64.b64decode(pdf_b64))
    json.dump(scenes, open(os.path.join(SHOTS, 'scenes.json'), 'w'), indent=1)
    print('done', len(scenes), 'scenes; sync state', js('return window.JettySync.status().state'))
finally:
    proc.terminate()
