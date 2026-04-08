// ══════════════════════════════════════════════════════
//  InvControl — Service Worker
//  Estrategia: Cache-first para assets, Network-first para API
// ══════════════════════════════════════════════════════

const CACHE_NAME   = 'invcontrol-v1.0.0';
const STATIC_CACHE = 'invcontrol-static-v1';
const DATA_CACHE   = 'invcontrol-data-v1';

// Assets a pre-cachear
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&display=swap',
];

// ── INSTALL ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando InvControl SW...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Error pre-cacheando assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando InvControl SW...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DATA_CACHE)
          .map(k => { console.log('[SW] Eliminando cache viejo:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar extensiones de Chrome, datos URI, etc.
  if (!request.url.startsWith('http')) return;

  // Estrategia para Google Apps Script (API backend)
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(networkWithQueueFallback(request));
    return;
  }

  // Estrategia para Google Fonts (red primero, cache como fallback)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Estrategia para assets propios (cache primero)
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ── ESTRATEGIAS ────────────────────────────────────────

// Cache-First: bueno para assets estáticos
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    console.warn('[SW] Fetch fallido (sin conexión):', request.url);
    return new Response('<h1>Sin conexión</h1><p>La aplicación no está disponible offline.</p>', {
      headers: { 'Content-Type': 'text/html' },
      status: 503,
    });
  }
}

// Stale-While-Revalidate: sirve cache, actualiza en background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || networkFetch;
}

// Network con cola offline para el GAS backend
async function networkWithQueueFallback(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (err) {
    // Guardamos la solicitud en IndexedDB para reintentar luego
    await queueRequest(request);
    return new Response(JSON.stringify({
      success: false,
      offline: true,
      message: 'Sin conexión. El registro fue guardado localmente.',
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 202,
    });
  }
}

// ── BACKGROUND SYNC ────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-records') {
    console.log('[SW] Background Sync: sync-records');
    event.waitUntil(replayQueuedRequests());
  }
});

// Cola simple en memoria para esta versión (usar IndexedDB en producción)
const requestQueue = [];

async function queueRequest(request) {
  try {
    const body = await request.json();
    requestQueue.push({ url: request.url, body, timestamp: Date.now() });
    console.log('[SW] Solicitud encolada para reintento:', request.url);
  } catch (e) {}
}

async function replayQueuedRequests() {
  const toRetry = [...requestQueue];
  requestQueue.length = 0;
  for (const queued of toRetry) {
    try {
      await fetch(queued.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queued.body),
      });
      console.log('[SW] Solicitud reenviada exitosamente:', queued.url);
    } catch (err) {
      requestQueue.push(queued); // reencolar si falla
    }
  }
}

// ── PUSH NOTIFICATIONS (placeholder) ──────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  self.registration.showNotification(data.title || 'InvControl', {
    body: data.body || 'Notificación del sistema',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: data.tag || 'invcontrol',
    data: { url: data.url || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});

console.log('[SW] InvControl Service Worker cargado ✓');
