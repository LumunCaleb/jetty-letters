// Cloud backup: keeps "Past letters" and the saved signer/closing lists in step
// across devices signed in to the same Google account (Firebase Auth + Firestore).
// Everything still works offline; Firestore queues changes and uploads them later.
(function () {
  const FB = window.JETTY_CONFIG.firebase;
  const LIBS = ['vendor/firebase-app-compat.js', 'vendor/firebase-auth-compat.js', 'vendor/firebase-firestore-compat.js'];

  const statusFns = new Set();
  let handlers = null; // { onLetters(docs), onLists(data) } supplied by app.js
  let auth = null, db = null, user = null, unsubs = [];
  let state = FB ? 'loading' : 'unavailable'; // unavailable | loading | signed-out | signed-in | error
  let lastError = '';

  const emit = () => statusFns.forEach((fn) => fn(Sync.status()));

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  const userDoc = () => db.collection('users').doc(user.uid);
  const clean = (o) => JSON.parse(JSON.stringify(o)); // drops undefined values Firestore rejects

  function listen() {
    unsubs.forEach((u) => u());
    unsubs = [];
    if (!user || !handlers) return;
    unsubs.push(userDoc().collection('letters').onSnapshot(
      (snap) => handlers.onLetters(snap.docs.map((d) => d.data())),
      (err) => fail(err)
    ));
    unsubs.push(userDoc().collection('settings').doc('lists').onSnapshot(
      (snap) => handlers.onLists(snap.exists ? snap.data() : null),
      (err) => fail(err)
    ));
  }

  function fail(err) {
    console.error('[sync]', err);
    lastError = err?.code === 'permission-denied'
      ? 'The backup refused access. Check the Firestore security rules.'
      : 'Backup problem: ' + (err?.message || err);
    state = 'error';
    emit();
  }

  async function start() {
    try {
      for (const src of LIBS) await loadScript(src);
      firebase.initializeApp(FB);
      auth = firebase.auth();
      db = firebase.firestore();
      // Keep a local copy so letters open offline and edits upload when back online.
      await db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
      auth.getRedirectResult().catch((e) => fail(e));
      auth.onAuthStateChanged((u) => {
        user = u;
        state = u ? 'signed-in' : 'signed-out';
        lastError = '';
        listen();
        emit();
      });
    } catch (err) {
      fail(err);
    }
  }

  const Sync = {
    available: !!FB,
    status: () => ({ state, email: user?.email || '', name: user?.displayName || '', error: lastError, online: navigator.onLine }),
    onStatus(fn) { statusFns.add(fn); fn(Sync.status()); },
    connect(h) { handlers = h; listen(); },

    async signIn() {
      if (!auth) return;
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await auth.signInWithPopup(provider);
      } catch (err) {
        if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
          return auth.signInWithRedirect(provider);
        }
        if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') throw err;
      }
    },
    signOut: () => auth && auth.signOut(),

    saveLetter(letter) {
      if (!user) return;
      userDoc().collection('letters').doc(letter.id).set(clean(letter)).catch(fail);
    },
    deleteLetter(id, at) {
      if (!user) return;
      userDoc().collection('letters').doc(id).set({ id, deleted: true, savedAt: at }).catch(fail);
    },
    saveLists(lists) {
      if (!user) return;
      userDoc().collection('settings').doc('lists').set(clean(lists)).catch(fail);
    },
  };

  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);
  window.JettySync = Sync;
  if (FB) start();
})();
