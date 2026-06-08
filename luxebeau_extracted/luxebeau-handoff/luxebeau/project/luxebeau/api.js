// LuxeBeau — Production-ready API client
// =========================================================
// Central HTTP layer. Swap API_BASE_URL to point at the live backend.
// Every function returns a Promise that resolves to typed data, or throws
// an ApiError. In dev, falls back to localStorage + in-memory mock data
// when the backend is unreachable, so the entire UI stays clickable.
//
// USAGE:
//   const products = await api.products.list({ category: 'skincare' });
//   const order    = await api.orders.create({ items, shipping });
//   const me       = await api.auth.me();
// =========================================================

(function () {
  const API_BASE_URL = window.LUXEBEAU_API_URL || 'https://api.luxebeau.com/v1';
  const TOKEN_KEY    = 'lb_token';
  const USER_KEY     = 'lb_user';

  // ── Error class ────────────────────────────────────────
  class ApiError extends Error {
    constructor(message, status, code, details) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }

  // ── Auth state ─────────────────────────────────────────
  const auth = {
    token: () => localStorage.getItem(TOKEN_KEY),
    user:  () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
    set:   (token, user) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clear: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  };

  // ── Core fetch wrapper ─────────────────────────────────
  async function request(method, path, { body, query, signal } = {}) {
    let url = API_BASE_URL + path;
    if (query) {
      const qs = new URLSearchParams(
        Object.entries(query).filter(([_, v]) => v != null && v !== '')
      ).toString();
      if (qs) url += '?' + qs;
    }

    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const token = auth.token();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers, signal };
    if (body != null) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      // Network failure → fall through to mock layer
      if (window.LUXEBEAU_MOCK !== false) return mockHandle(method, path, { body, query });
      throw new ApiError('Network error', 0, 'NETWORK_ERROR', { cause: String(err) });
    }

    if (!res.ok) {
      let payload = null;
      try { payload = await res.json(); } catch {}
      // Mock fallback for 404/5xx during development
      if (window.LUXEBEAU_MOCK !== false && (res.status >= 500 || res.status === 404)) {
        return mockHandle(method, path, { body, query });
      }
      throw new ApiError(payload?.message || res.statusText, res.status, payload?.code, payload);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  // ── Mock backend (localStorage-backed) ─────────────────
  // Lets every screen stay functional offline / pre-backend.
  const STORE = {
    get(key, fallback) {
      try { const v = localStorage.getItem('lb_db_' + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) { localStorage.setItem('lb_db_' + key, JSON.stringify(value)); },
  };

  const seedProducts = () => (window.PRODUCTS || []).map(p => ({ ...p, stock: 12 + (p.id * 3) % 40 }));
  const seedArtisans = () => (window.ARTISANS || []);

  function mockHandle(method, path, { body, query } = {}) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockHandleSync(method, path, { body, query })), 180 + Math.random() * 140);
    });
  }

  function mockHandleSync(method, path, { body, query } = {}) {
    // Auth
    if (path === '/auth/login' && method === 'POST') {
      const user = { id: 'u_' + Date.now(), email: body.email, name: body.email?.split('@')[0] || 'You', role: body.role || 'buyer' };
      auth.set('mock_' + user.id, user);
      return { token: 'mock_' + user.id, user };
    }
    if (path === '/auth/signup' && method === 'POST') {
      const user = { id: 'u_' + Date.now(), email: body.email, name: body.name, phone: body.phone, role: body.role || 'buyer' };
      auth.set('mock_' + user.id, user);
      return { token: 'mock_' + user.id, user };
    }
    if (path === '/auth/me' && method === 'GET') {
      const u = auth.user();
      if (!u) throw new ApiError('Not authenticated', 401, 'UNAUTHENTICATED');
      return u;
    }
    if (path === '/auth/logout' && method === 'POST') { auth.clear(); return null; }

    // Products
    if (path === '/products' && method === 'GET') {
      let items = STORE.get('products', null) || (() => { const s = seedProducts(); STORE.set('products', s); return s; })();
      if (query?.category && query.category !== 'All') items = items.filter(p => p.category?.toLowerCase() === query.category.toLowerCase());
      if (query?.q) {
        const q = query.q.toLowerCase();
        items = items.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
      }
      if (query?.min) items = items.filter(p => p.price >= +query.min);
      if (query?.max) items = items.filter(p => p.price <= +query.max);
      return { items, total: items.length };
    }
    const productMatch = path.match(/^\/products\/(\d+)$/);
    if (productMatch && method === 'GET') {
      const id = +productMatch[1];
      const p = seedProducts().find(x => x.id === id);
      if (!p) throw new ApiError('Product not found', 404, 'NOT_FOUND');
      return p;
    }

    // Artisans
    if (path === '/artisans' && method === 'GET') {
      let items = seedArtisans();
      if (query?.specialty && query.specialty !== 'All Services') items = items.filter(a => a.specialty.toLowerCase().includes(query.specialty.toLowerCase()));
      if (query?.q) items = items.filter(a => a.name.toLowerCase().includes(query.q.toLowerCase()));
      return { items, total: items.length };
    }
    const artisanMatch = path.match(/^\/artisans\/(\d+)$/);
    if (artisanMatch && method === 'GET') {
      const id = +artisanMatch[1];
      const a = seedArtisans().find(x => x.id === id);
      if (!a) throw new ApiError('Artisan not found', 404, 'NOT_FOUND');
      return a;
    }

    // Cart (server-mirror; UI also keeps a local copy)
    if (path === '/cart' && method === 'GET') return STORE.get('cart', { items: [] });
    if (path === '/cart' && method === 'PUT') { STORE.set('cart', body); return body; }

    // Orders
    if (path === '/orders' && method === 'POST') {
      const orders = STORE.get('orders', []);
      const order = {
        id: 'LB-' + Date.now().toString(36).toUpperCase(),
        ...body,
        status: 'processing',
        createdAt: new Date().toISOString(),
        timeline: [
          { at: new Date().toISOString(), label: 'Order placed', done: true },
          { at: null, label: 'Preparing for dispatch', done: false },
          { at: null, label: 'Out for delivery', done: false },
          { at: null, label: 'Delivered', done: false },
        ],
      };
      orders.unshift(order);
      STORE.set('orders', orders);
      STORE.set('cart', { items: [] });
      return order;
    }
    if (path === '/orders' && method === 'GET') return { items: STORE.get('orders', []) };
    const orderMatch = path.match(/^\/orders\/([^/]+)$/);
    if (orderMatch && method === 'GET') {
      const o = STORE.get('orders', []).find(x => x.id === orderMatch[1]);
      if (!o) throw new ApiError('Order not found', 404, 'NOT_FOUND');
      return o;
    }

    // Bookings (artisan services)
    if (path === '/bookings' && method === 'POST') {
      const bookings = STORE.get('bookings', []);
      const b = { id: 'BK-' + Date.now().toString(36).toUpperCase(), ...body, status: 'confirmed', createdAt: new Date().toISOString() };
      bookings.unshift(b);
      STORE.set('bookings', bookings);
      return b;
    }
    if (path === '/bookings' && method === 'GET') return { items: STORE.get('bookings', []) };

    // Wishlist
    if (path === '/wishlist' && method === 'GET') return { items: STORE.get('wishlist', []) };
    if (path === '/wishlist' && method === 'POST') {
      const list = STORE.get('wishlist', []);
      if (!list.find(p => p.id === body.id)) list.push(body);
      STORE.set('wishlist', list);
      return { items: list };
    }
    const wlDel = path.match(/^\/wishlist\/(\d+)$/);
    if (wlDel && method === 'DELETE') {
      const list = STORE.get('wishlist', []).filter(p => p.id !== +wlDel[1]);
      STORE.set('wishlist', list);
      return { items: list };
    }

    // Addresses
    if (path === '/addresses' && method === 'GET') return { items: STORE.get('addresses', []) };
    if (path === '/addresses' && method === 'POST') {
      const list = STORE.get('addresses', []);
      const addr = { id: 'a_' + Date.now(), ...body };
      list.push(addr);
      STORE.set('addresses', list);
      return addr;
    }

    // Partnership applications
    if (path === '/partnerships' && method === 'POST') {
      const apps = STORE.get('partnerships', []);
      const app = {
        id: 'APP-' + Date.now().toString(36).toUpperCase(),
        ...body,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };
      apps.unshift(app);
      STORE.set('partnerships', apps);
      return app;
    }

    // Newsletter
    if (path === '/newsletter' && method === 'POST') {
      const list = STORE.get('newsletter', []);
      list.push({ email: body.email, at: new Date().toISOString() });
      STORE.set('newsletter', list);
      return { ok: true };
    }

    // Search (cross-index)
    if (path === '/search' && method === 'GET') {
      const q = (query?.q || '').toLowerCase();
      const products = seedProducts().filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
      const artisans = seedArtisans().filter(a => a.name.toLowerCase().includes(q) || a.specialty.toLowerCase().includes(q) || a.location.toLowerCase().includes(q));
      return { products, artisans };
    }

    // Default
    throw new ApiError('Mock route not found: ' + method + ' ' + path, 404, 'NOT_FOUND');
  }

  // ── Public API ─────────────────────────────────────────
  const api = {
    config: { baseUrl: API_BASE_URL },
    ApiError,
    auth: {
      currentToken: auth.token,
      currentUser:  auth.user,
      isAuthed:     () => !!auth.token(),
      login:    (creds) => request('POST', '/auth/login',  { body: creds }),
      signup:   (data)  => request('POST', '/auth/signup', { body: data }),
      me:       ()      => request('GET',  '/auth/me'),
      logout:   ()      => request('POST', '/auth/logout').finally(auth.clear),
    },
    products: {
      list:   (q)  => request('GET', '/products', { query: q }),
      get:    (id) => request('GET', `/products/${id}`),
    },
    artisans: {
      list:   (q)  => request('GET', '/artisans', { query: q }),
      get:    (id) => request('GET', `/artisans/${id}`),
    },
    cart: {
      get: ()      => request('GET', '/cart'),
      set: (cart)  => request('PUT', '/cart', { body: cart }),
    },
    orders: {
      create: (data) => request('POST', '/orders', { body: data }),
      list:   ()     => request('GET',  '/orders'),
      get:    (id)   => request('GET',  `/orders/${id}`),
    },
    bookings: {
      create: (data) => request('POST', '/bookings', { body: data }),
      list:   ()     => request('GET',  '/bookings'),
    },
    wishlist: {
      list:   ()    => request('GET',    '/wishlist'),
      add:    (p)   => request('POST',   '/wishlist',     { body: p }),
      remove: (id)  => request('DELETE', `/wishlist/${id}`),
    },
    addresses: {
      list: ()      => request('GET',  '/addresses'),
      add:  (data)  => request('POST', '/addresses', { body: data }),
    },
    partnerships: {
      apply: (data) => request('POST', '/partnerships', { body: data }),
    },
    newsletter: {
      subscribe: (email) => request('POST', '/newsletter', { body: { email } }),
    },
    search: (q) => request('GET', '/search', { query: { q } }),
  };

  window.api = api;
  window.ApiError = ApiError;
})();
