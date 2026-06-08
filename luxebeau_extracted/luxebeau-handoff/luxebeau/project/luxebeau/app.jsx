// LuxeBeau — App Router

function App() {
  const [page, setPage] = React.useState(() => localStorage.getItem('lb_page') || 'landing');
  const [pageData, setPageData] = React.useState(null);
  const [fading, setFading] = React.useState(false);
  const [cart, setCart] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('lb_cart') || '[]'); } catch { return []; }
  });

  // Tweaks
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "accentColor": "#B881FF",
    "primaryColor": "#43007B",
    "fontScale": 1,
    "showTweaks": false
  }/*EDITMODE-END*/;
  const [tweaks, setTweaks] = React.useState(TWEAK_DEFAULTS);
  const [tweakOpen, setTweakOpen] = React.useState(false);

  React.useEffect(() => {
    window.addEventListener('message', e => {
      if (e.data?.type === '__activate_edit_mode') setTweakOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweakOpen(false);
    });
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
  }, []);

  const applyTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  const navigate = React.useCallback((p, data = null) => {
    setFading(true);
    setTimeout(() => {
      setPage(p);
      setPageData(data);
      localStorage.setItem('lb_page', p);
      setFading(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, 180);
  }, []);

  const addToCart = (product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      const next = existing
        ? prev.map(i => i.id === product.id ? { ...i, qty: i.qty + qty } : i)
        : [...prev, { ...product, qty }];
      localStorage.setItem('lb_cart', JSON.stringify(next));
      return next;
    });
  };

  const updateQty = (id, qty) => {
    if (qty < 1) { removeFromCart(id); return; }
    setCart(prev => {
      const next = prev.map(i => i.id === id ? { ...i, qty } : i);
      localStorage.setItem('lb_cart', JSON.stringify(next));
      return next;
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const next = prev.filter(i => i.id !== id);
      localStorage.setItem('lb_cart', JSON.stringify(next));
      return next;
    });
  };

  // Pages that get full nav + footer
  const withShell = ['landing','shop','product','services','artisans','artisan','about','partnership'];
  // Dashboard pages — no nav/footer
  const dashPages = ['seller-dash','artisan-dash','admin-dash'];
  // Auth + commerce — no footer
  const noFooter = ['auth','cart','checkout','payment'];

  const showNav = [...withShell, ...noFooter].includes(page);
  const showFooter = withShell.includes(page);

  const renderPage = () => {
    switch (page) {
      case 'landing':      return <LandingPage navigate={navigate} addToCart={addToCart} />;
      case 'shop':         return <ShopPage navigate={navigate} addToCart={addToCart} />;
      case 'product':      return <ProductDetail product={pageData || PRODUCTS[0]} navigate={navigate} addToCart={addToCart} />;
      case 'services':     return <ServicesPage navigate={navigate} />;
      case 'artisans':     return <ArtisansPage navigate={navigate} />;
      case 'artisan':      return <ArtisanProfile artisan={pageData || ARTISANS[0]} navigate={navigate} />;
      case 'auth':         return <AuthPage navigate={navigate} />;
      case 'cart':         return <CartPage cart={cart} updateQty={updateQty} removeFromCart={removeFromCart} navigate={navigate} />;
      case 'checkout':     return <CheckoutPage cart={cart} navigate={navigate} />;
      case 'payment':      return <PaymentPage navigate={navigate} />;
      case 'partnership':  return <PartnershipPage navigate={navigate} />;
      case 'seller-dash':  return <SellerDashboard navigate={navigate} />;
      case 'artisan-dash': return <ArtisanDashboard navigate={navigate} />;
      case 'admin-dash':   return <AdminDashboard navigate={navigate} />;
      default:             return <LandingPage navigate={navigate} addToCart={addToCart} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Sora, sans-serif' }}>
      {showNav && !dashPages.includes(page) && (
        <Navbar navigate={navigate} page={page} cartCount={cart.reduce((s,i)=>s+i.qty,0)} />
      )}

      {/* Page Transition Wrapper */}
      <div style={{
        opacity: fading ? 0 : 1,
        transform: fading ? 'translateY(8px)' : 'translateY(0)',
        transition: 'opacity 0.18s ease, transform 0.18s ease',
      }}>
        {renderPage()}
      </div>

      {showFooter && !fading && <Footer navigate={navigate} />}

      {/* Dashboard Quick Access Banner (on landing) */}
      {page === 'landing' && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: C.bgDark, borderRadius: 16, padding: '12px 20px',
          display: 'flex', gap: 8, alignItems: 'center', zIndex: 999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid #333' }}>
          <span style={{ fontFamily: 'Sora', fontSize: 11, color: '#888', marginRight: 4 }}>Demo:</span>
          {[
            ['Seller Dash', 'seller-dash', C.lighter],
            ['Artisan Dash', 'artisan-dash', C.light],
            ['Admin Dash', 'admin-dash', C.accent],
          ].map(([label, id, color]) => (
            <div key={id} onClick={() => navigate(id)}
              style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', background: `${color}18`,
                border: `1px solid ${color}44`, fontFamily: 'Sora', fontSize: 12, fontWeight: 600,
                color: color, transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = `${color}30`}
              onMouseLeave={e => e.currentTarget.style.background = `${color}18`}>{label}</div>
          ))}
        </div>
      )}

      {/* Tweaks Panel */}
      {tweakOpen && (
        <div style={{ position: 'fixed', bottom: 80, right: 20, zIndex: 9999,
          background: '#fff', borderRadius: 16, padding: '20px 22px', width: 280,
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)', border: `1px solid ${C.borderLight}` }}>
          <div style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 16, color: C.bgDark, marginBottom: 18 }}>Tweaks</div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Sora', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Accent Color</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['#B881FF','#9747FF','#E9DEFF','#6400B8','#2E0054'].map(col => (
                <div key={col} onClick={() => applyTweak('accentColor', col)}
                  style={{ width: 28, height: 28, borderRadius: 8, background: col, cursor: 'pointer',
                    border: `2px solid ${tweaks.accentColor === col ? C.bgDark : 'transparent'}`, transition: 'all 0.2s' }} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Sora', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Primary Color</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['#43007B','#6400B8','#2E0054','#9747FF','#120025'].map(col => (
                <div key={col} onClick={() => applyTweak('primaryColor', col)}
                  style={{ width: 28, height: 28, borderRadius: 8, background: col, cursor: 'pointer',
                    border: `2px solid ${tweaks.primaryColor === col ? C.bgDark : 'transparent'}`, transition: 'all 0.2s' }} />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'Sora', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Quick Navigate</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[['Landing','landing'],['Shop','shop'],['Services','services'],['Partner','partnership'],['Seller','seller-dash'],['Artisan','artisan-dash'],['Admin','admin-dash']].map(([label,id])=>(
                <div key={id} onClick={() => navigate(id)}
                  style={{ padding: '7px 12px', borderRadius: 8, cursor: 'pointer', background: page===id?C.mist:'transparent',
                    fontFamily: 'Sora', fontSize: 12, color: page===id?C.brand:C.textMid, fontWeight: page===id?500:400,
                    transition: 'all 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.mist}
                  onMouseLeave={e=>e.currentTarget.style.background=page===id?C.mist:'transparent'}>{label}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
