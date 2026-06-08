// LuxeBeau — Shop, Product Detail, Services, Artisan Profile & Booking

// ─── SHOP PAGE ───────────────────────────────────────────────────
function ShopPage({ navigate, addToCart }) {
  const [activeCat, setActiveCat] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState('popular');
  const [priceRange, setPriceRange] = React.useState([0, 20000]);
  const [showFilters, setShowFilters] = React.useState(true);

  const filtered = PRODUCTS.filter(p => {
    const catMatch = activeCat === 'All' || p.category === activeCat.toLowerCase().replace("'s", 's');
    const searchMatch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
    const priceMatch = p.price >= priceRange[0] && p.price <= priceRange[1];
    return catMatch && searchMatch && priceMatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'price-asc') return a.price - b.price;
    if (sort === 'price-desc') return b.price - a.price;
    if (sort === 'rating') return b.rating - a.rating;
    return b.reviews - a.reviews;
  });

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: C.bg }}>
      {/* Top Bar */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${C.borderLight}`, padding: '20px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <div>
            <h1 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 28, color: C.bgDark, margin: '0 0 4px' }}>Beauty Shop</h1>
            <span style={{ fontFamily: 'Sora', fontSize: 13, color: C.muted }}>{sorted.length} products found</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, maxWidth: 480 }}>
            <TextInput placeholder="Search products, brands..." icon="search" value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Select value={sort} onChange={e => setSort(e.target.value)}
              options={[{ value: 'popular', label: 'Most Popular' }, { value: 'rating', label: 'Top Rated' }, { value: 'price-asc', label: 'Price: Low→High' }, { value: 'price-desc', label: 'Price: High→Low' }]} />
          </div>
        </div>
        {/* Category Pills */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {PRODUCT_CATS.map(cat => (
            <div key={cat} onClick={() => setActiveCat(cat)}
              style={{ padding: '7px 18px', borderRadius: 30, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'Sora', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                background: activeCat === cat ? C.primary : '#fff',
                color: activeCat === cat ? '#fff' : C.textMid,
                border: `1.5px solid ${activeCat === cat ? C.primary : C.borderLight}` }}>
              {cat}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', padding: '32px 56px', gap: 32 }}>
        {/* Sidebar */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px', border: `1px solid ${C.borderLight}`, position: 'sticky', top: 88 }}>
            <div style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 16, color: C.bgDark, marginBottom: 20 }}>Filters</div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Price Range</div>
              {[
                { label: 'Under ₦5,000', min: 0, max: 5000 },
                { label: '₦5K – ₦10K', min: 5000, max: 10000 },
                { label: '₦10K – ₦20K', min: 10000, max: 20000 },
                { label: 'All Prices', min: 0, max: 100000 },
              ].map(r => (
                <div key={r.label} onClick={() => setPriceRange([r.min, r.max])}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${priceRange[0] === r.min && priceRange[1] === r.max ? C.brand : C.border}`,
                    background: priceRange[0] === r.min && priceRange[1] === r.max ? C.brand : 'transparent', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {priceRange[0] === r.min && priceRange[1] === r.max && <Icon name="check" size={10} color="#fff" strokeWidth={2.5} />}
                  </div>
                  <span style={{ fontFamily: 'Sora', fontSize: 13, color: C.textMid }}>{r.label}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Rating</div>
              {[4.5, 4.0, 3.5].map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${C.border}` }} />
                  <span style={{ display:'inline-flex', gap:1 }}>{[1,2,3,4,5].map(i=> <Icon key={i} name={i<=Math.floor(r)?'starFill':'star'} size={11} color={C.brand} strokeWidth={1.4} />)}</span>
                  <span style={{ fontFamily: 'Sora', fontSize: 12, color: C.muted }}>{r}+</span>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Brands</div>
              {['SheaGlow', 'Zaron', 'MAC', 'Cantu', 'GlowLab'].map(b => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${C.border}` }} />
                  <span style={{ fontFamily: 'Sora', fontSize: 13, color: C.textMid }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1 }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <div style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 22, color: C.textMid }}>No products found</div>
              <div style={{ fontFamily: 'Sora', fontSize: 14, color: C.muted, marginTop: 8 }}>Try adjusting your filters</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
              {sorted.map(p => <ProductCard key={p.id} p={p} navigate={navigate} addToCart={addToCart} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT DETAIL ───────────────────────────────────────────────
function ProductDetail({ product, navigate, addToCart }) {
  const [qty, setQty] = React.useState(1);
  const [activeImg, setActiveImg] = React.useState(0);
  const [added, setAdded] = React.useState(false);
  const related = PRODUCTS.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

  const handleAdd = () => {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const reviews = [
    { name: 'Adaeze M.', rating: 5, date: '2 days ago', text: 'Absolutely love this! My skin has never felt better. Will definitely reorder.' },
    { name: 'Kemi F.', rating: 5, date: '1 week ago', text: 'Fast delivery to Ikeja. Product is authentic and works well. Highly recommend!' },
    { name: 'Taiwo B.', rating: 4, date: '2 weeks ago', text: 'Great product but packaging was slightly dented. Customer service sorted it quickly though.' },
  ];

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: C.bg }}>
      {/* Breadcrumb */}
      <div style={{ padding: '16px 56px', background: '#fff', borderBottom: `1px solid ${C.borderLight}` }}>
        <div style={{ fontFamily: 'Sora', fontSize: 13, color: C.muted, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ cursor: 'pointer', color: C.brand }} onClick={() => navigate('landing')}>Home</span> /
          <span style={{ cursor: 'pointer', color: C.brand }} onClick={() => navigate('shop')}>Shop</span> /
          <span style={{ color: C.textMid }}>{product.name}</span>
        </div>
      </div>

      <div style={{ padding: '48px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, marginBottom: 64 }}>
          {/* Left: Images */}
          <div>
            <div style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
              <ImgPlaceholder label={`${product.name} · main shot`} height={400} bg={product.bg} fg={product.fg} radius={20} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[0,1,2,3].map(i => (
                <div key={i} onClick={() => setActiveImg(i)}
                  style={{ borderRadius: 10, overflow: 'hidden', cursor: 'pointer', flex:1,
                    border: `2px solid ${activeImg === i ? C.brand : C.borderLight}`, transition: 'border-color 0.2s' }}>
                  <ImgPlaceholder label={`view ${i+1}`} height={72} bg={product.bg} fg={product.fg} radius={8} />
                </div>
              ))}
            </div>
          </div>

          {/* Right: Info */}
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {product.badge && <BadgePill label={product.badge} />}
              <span style={{ fontFamily: 'Sora', fontSize: 11, color: C.brand, fontWeight: 500, letterSpacing:1.5, textTransform:'uppercase', display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="dot" size={6} color={C.brand} />In Stock</span>
            </div>
            <div style={{ fontFamily: 'Sora', fontSize: 13, color: C.muted, marginBottom: 6 }}>{product.brand}</div>
            <h1 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 32, color: C.bgDark, margin: '0 0 14px', lineHeight: 1.2 }}>{product.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Stars rating={product.rating} />
              <span style={{ fontFamily: 'Sora', fontSize: 13, color: C.muted }}>{product.reviews} reviews</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 24 }}>
              <span style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 36, color: C.primary }}>₦{product.price.toLocaleString()}</span>
              {product.original && <span style={{ fontFamily: 'Sora', fontSize: 16, color: C.muted, textDecoration: 'line-through' }}>₦{product.original.toLocaleString()}</span>}
              {product.original && <span style={{ background: C.soft, color: C.brand, fontFamily: 'Sora', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, letterSpacing:0.5 }}>
                {Math.round((1-product.price/product.original)*100)}% off
              </span>}
            </div>

            <div style={{ height: 1, background: C.borderLight, marginBottom: 24 }} />

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: C.textMid, marginBottom: 10 }}>Size / Variant</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {['50ml', '100ml', '200ml'].map((v, i) => (
                  <div key={v} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${i===1 ? C.brand : C.border}`,
                    background: i===1 ? C.bgAlt : '#fff',
                    fontFamily: 'Sora', fontSize: 13, color: i===1 ? C.brand : C.textMid, fontWeight: i===1 ? 600 : 400 }}>{v}</div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <button onClick={() => setQty(Math.max(1, qty-1))}
                  style={{ width: 40, height: 44, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 18, color: C.textMid }}>−</button>
                <span style={{ width: 44, textAlign: 'center', fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: C.bgDark }}>{qty}</span>
                <button onClick={() => setQty(qty+1)}
                  style={{ width: 40, height: 44, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 18, color: C.textMid }}>+</button>
              </div>
              <Btn label={added ? 'Added to Cart' : 'Add to Cart'} icon={added ? 'check' : undefined} variant={added ? 'ghost' : 'purple'} size="lg"
                onClick={handleAdd} style={{ flex: 1 }} />
              <div style={{ width: 44, height: 44, border: `1.5px solid ${C.border}`, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color:C.brand }}><Icon name="heart" size={18} color={C.brand} /></div>
            </div>

            <Btn label="Buy Now" iconRight="arrowR" variant="primary" size="lg" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { addToCart(product, qty); navigate('cart'); }} />

            <div style={{ marginTop: 24, display: 'flex', gap: 16 }}>
              {[['truck','Fast Delivery','30 min in Lagos'],['shield','Secure Pay','Encrypted checkout'],['arrowL','Easy Return','7-day returns']].map(([ic, t, sub]) => (
                <div key={t} style={{ flex: 1, background: C.bgAlt, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ marginBottom: 8, display:'flex', justifyContent:'center' }}>
                    <Icon name={ic} size={18} color={C.brand} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontFamily: 'Sora', fontSize: 11, fontWeight: 600, color: C.textMid }}>{t}</div>
                  <div style={{ fontFamily: 'Sora', fontSize: 10, color: C.muted, marginTop:2 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 26, color: C.bgDark, margin: '0 0 24px' }}>Customer Reviews</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {reviews.map((r, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '20px', border: `1px solid ${C.borderLight}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.lighter,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 700, fontSize: 13, color: C.primary }}>
                      {r.name[0]}
                    </div>
                    <span style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 13, color: C.textMid }}>{r.name}</span>
                  </div>
                  <span style={{ fontFamily: 'Sora', fontSize: 11, color: C.muted }}>{r.date}</span>
                </div>
                <Stars rating={r.rating} small />
                <p style={{ fontFamily: 'Sora', fontSize: 13, color: C.textMid, lineHeight: 1.65, margin: '10px 0 0' }}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Related */}
        <div>
          <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 26, color: C.bgDark, margin: '0 0 24px' }}>You Might Also Like</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {related.map(p => <ProductCard key={p.id} p={p} navigate={navigate} addToCart={addToCart} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SERVICES PAGE ────────────────────────────────────────────────
function ServicesPage({ navigate }) {
  const [activeService, setActiveService] = React.useState('All Services');

  const services = [
    { icon:'sparkle',   title:'Hairstyling',         desc:'Braids, locs, weaves, natural styles & more',  count:'800+ artisans',     bg:C.soft,     fg:C.brand },
    { icon:'palette',   title:'Makeup Artist',       desc:'Bridal, glam, editorial, natural looks',         count:'450+ artists',      bg:C.mist,     fg:C.primary },
    { icon:'star',      title:'Nail Technician',     desc:'Gel, acrylic, nail art, manicure & pedicure',    count:'320+ techs',        bg:C.lighter,  fg:C.primary },
    { icon:'leaf',      title:'Skincare Specialist', desc:'Facials, chemical peels, hydrafacials & more',   count:'280+ specialists',  bg:C.soft,     fg:C.brand },
    { icon:'scissors',  title:'Barber',              desc:'Haircuts, fades, shape-ups, beard grooming',     count:'600+ barbers',      bg:C.mist,     fg:C.primary },
    { icon:'flame',     title:'Wellness & Spa',      desc:'Massages, body wraps, aromatherapy & more',      count:'150+ therapists',   bg:C.lighter,  fg:C.primary },
  ];

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: C.bg }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${C.bgDark} 0%, ${C.primary} 100%)`,
        padding: '80px 56px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position:'absolute', right:-120, top:-80, width:520, height:520, borderRadius:'50%',
          background:C.brand, filter:'blur(140px)', opacity:0.45, pointerEvents:'none' }} />
        <div style={{ position:'absolute', left:-100, bottom:-100, width:420, height:420, borderRadius:'50%',
          background:C.light, filter:'blur(120px)', opacity:0.22, pointerEvents:'none' }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 560 }}>
          <div style={{ display: 'inline-flex', alignItems:'center', gap:10, padding: '6px 16px',
            border:`1px solid rgba(184,129,255,0.28)`, background:'rgba(184,129,255,0.08)',
            borderRadius: 999, marginBottom: 20 }}>
            <Icon name="dot" size={6} color={C.lighter} />
            <span style={{ fontFamily: 'Sora', fontSize: 11, color: C.lighter, fontWeight: 500, letterSpacing:1.5, textTransform:'uppercase' }}>Home & Studio Beauty Services</span>
          </div>
          <h1 style={{ fontFamily: 'Clash Display', fontWeight: 400, fontSize: 64, color: '#fff', margin: '0 0 20px', lineHeight: 1.02, letterSpacing:-2 }}>
            Book expert<br /><em style={{ fontStyle:'italic', color:C.lighter, fontWeight:300 }}>beauty services.</em>
          </h1>
          <p style={{ fontFamily: 'Sora', fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.85, margin: '0 0 32px', fontWeight:300 }}>
            Verified artisans come to your home or you visit their studio. Real-time booking, secure payment, guaranteed quality.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Btn label="Find Artisans" variant="accent" size="lg" iconRight="arrowR" onClick={() => navigate('artisans')} />
          </div>
        </div>
      </div>

      {/* Service Categories */}
      <div style={{ padding: '72px 56px' }}>
        <SectionHeader tag="What We Offer" title="Beauty Services" subtitle="From hairstyling to skincare — we have the best artisans across Nigeria" center />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {services.map((s, i) => (
            <div key={i} onClick={() => navigate('artisans')}
              style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', cursor: 'pointer',
                border: `1px solid ${C.borderLight}`, transition: 'all 0.25s', overflow: 'hidden', position: 'relative' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 40px ${C.primary}11`; e.currentTarget.style.borderColor = C.light; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = C.borderLight; }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon name={s.icon} size={26} color={s.fg} strokeWidth={1.4} />
              </div>
              <h3 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 22, color: C.bgDark, margin: '0 0 8px' }}>{s.title}</h3>
              <p style={{ fontFamily: 'Sora', fontSize: 13, color: C.muted, lineHeight: 1.65, margin: '0 0 16px' }}>{s.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Sora', fontSize: 12, color: C.brand, fontWeight: 600 }}>{s.count}</span>
                <Icon name="arrowR" size={16} color={C.primary} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How booking works */}
      <div style={{ padding: '0 56px 80px' }}>
        <div style={{ background: C.bgAlt, borderRadius: 24, padding: '56px 56px' }}>
          <SectionHeader tag="Booking Process" title="How to Book" subtitle="Get a beauty service at your door in minutes" center />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
            {[
              { n:'1', icon:'search',   t:'Browse Artisans', d:'Filter by service, location & budget' },
              { n:'2', icon:'calendar', t:'Pick Date & Time', d:'Choose when works best for you' },
              { n:'3', icon:'card',     t:'Secure Payment',   d:'Pay safely via card, transfer or USSD' },
              { n:'4', icon:'sparkle',  t:'Enjoy Service',    d:'Artisan arrives on time, fully equipped' },
            ].map((step, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '24px 20px' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Clash Display', fontWeight: 700, fontSize: 18, color: '#fff', margin: '0 auto 14px' }}>{step.n}</div>
                <div style={{ marginBottom: 10, display:'flex', justifyContent:'center' }}>
                  <Icon name={step.icon} size={26} color={C.brand} strokeWidth={1.4} />
                </div>
                <div style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 16, color: C.bgDark, marginBottom: 6 }}>{step.t}</div>
                <div style={{ fontFamily: 'Sora', fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{step.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ARTISANS PAGE ────────────────────────────────────────────────
function ArtisansPage({ navigate }) {
  const [activeCat, setActiveCat] = React.useState('All Services');
  const [search, setSearch] = React.useState('');
  const [location, setLocation] = React.useState('Lagos');

  const filtered = ARTISANS.filter(a => {
    const catMatch = activeCat === 'All Services' || a.specialty.toLowerCase().includes(activeCat.split(' ')[0].toLowerCase());
    const searchMatch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.specialty.toLowerCase().includes(search.toLowerCase());
    return catMatch && searchMatch;
  });

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: C.bg }}>
      <div style={{ background: '#fff', borderBottom: `1px solid ${C.borderLight}`, padding: '20px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 28, color: C.bgDark, margin: '0 0 4px' }}>Beauty Artisans</h1>
            <span style={{ fontFamily: 'Sora', fontSize: 13, color: C.muted }}>{filtered.length} artisans available</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <TextInput placeholder="Search artisans..." icon="search" value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 260 }} />
            <Select value={location} onChange={e => setLocation(e.target.value)}
              options={['Lagos','Abuja','Port Harcourt','Ibadan','Kano']} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {SERVICE_CATS.map(cat => (
            <div key={cat} onClick={() => setActiveCat(cat)}
              style={{ padding: '7px 18px', borderRadius: 30, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'Sora', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                background: activeCat === cat ? C.primary : '#fff',
                color: activeCat === cat ? '#fff' : C.textMid,
                border: `1.5px solid ${activeCat === cat ? C.primary : C.borderLight}` }}>{cat}</div>
          ))}
        </div>
      </div>

      <div style={{ padding: '32px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {filtered.map(a => <ArtisanCard key={a.id} a={a} navigate={navigate} />)}
        </div>
      </div>
    </div>
  );
}

// ─── ARTISAN PROFILE ─────────────────────────────────────────────
function ArtisanProfile({ artisan, navigate }) {
  const [showBooking, setShowBooking] = React.useState(false);
  const [selectedService, setSelectedService] = React.useState(artisan.services[0]);
  const [selectedDate, setSelectedDate] = React.useState('');
  const [selectedTime, setSelectedTime] = React.useState('');
  const [serviceType, setServiceType] = React.useState('home');
  const [step, setStep] = React.useState(1);

  const times = ['9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'];
  const reviews = [
    { name:'Ngozi A.', rating:5, date:'3 days ago', text:'She did my knotless braids and they were PERFECT. Will definitely book again!' },
    { name:'Amaka L.', rating:5, date:'1 week ago', text:'Came to my house on time, brought all her tools. Very professional and talented.' },
    { name:'Sandra O.', rating:4, date:'2 weeks ago', text:'Great work! Took a bit longer than expected but the result was beautiful.' },
  ];

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: C.bg }}>
      {/* Breadcrumb */}
      <div style={{ padding: '14px 56px', background: '#fff', borderBottom: `1px solid ${C.borderLight}` }}>
        <span style={{ fontFamily: 'Sora', fontSize: 13, color: C.muted }}>
          <span style={{ cursor: 'pointer', color: C.brand }} onClick={() => navigate('artisans')}>Artisans</span> / {artisan.name}
        </span>
      </div>

      <div style={{ padding: '40px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 40 }}>
          {/* Left */}
          <div>
            {/* Profile Header */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '32px', border: `1px solid ${C.borderLight}`, marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: artisan.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36, fontFamily: 'Clash Display', fontWeight: 700, color: C.primary, flexShrink: 0 }}>
                  {artisan.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h1 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 28, color: C.bgDark, margin: 0 }}>{artisan.name}</h1>
                    <span style={{ background: artisan.available ? C.soft : C.bgAlt, color: artisan.available ? C.brand : C.muted,
                      fontFamily: 'Sora', fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 20, letterSpacing:1, textTransform:'uppercase',
                      display:'inline-flex', alignItems:'center', gap:6, border:`1px solid ${artisan.available ? C.lighter : C.borderLight}` }}>
                      <Icon name="dot" size={6} color={artisan.available ? C.brand : C.muted} />
                      {artisan.available ? 'Available' : 'Busy'}</span>
                  </div>
                  <div style={{ fontFamily: 'Sora', fontSize: 14, color: C.brand, fontWeight: 600, marginBottom: 8 }}>{artisan.specialty}</div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <Stars rating={artisan.rating} />
                    <span style={{ fontFamily: 'Sora', fontSize: 12, color: C.muted }}>📍 {artisan.location}</span>
                    <span style={{ fontFamily: 'Sora', fontSize: 12, color: C.muted }}>💼 {artisan.exp} experience</span>
                    <span style={{ fontFamily: 'Sora', fontSize: 12, color: C.muted }}>✅ {artisan.done} completed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Services Offered */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px', border: `1px solid ${C.borderLight}`, marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 20, color: C.bgDark, margin: '0 0 20px' }}>Services & Pricing</h2>
              {artisan.services.map((svc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 0', borderBottom: i < artisan.services.length-1 ? `1px solid ${C.borderLight}` : 'none' }}>
                  <div>
                    <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 14, color: C.textMid, marginBottom: 3 }}>{svc}</div>
                    <div style={{ fontFamily: 'Sora', fontSize: 12, color: C.muted }}>Duration: {60+i*30} mins</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 16, color: C.primary }}>
                      ₦{(artisan.price + i * 2000).toLocaleString()}
                    </span>
                    <Btn label="Book" variant="outline" size="sm" onClick={() => { setSelectedService(svc); setShowBooking(true); }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Reviews */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px', border: `1px solid ${C.borderLight}` }}>
              <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 20, color: C.bgDark, margin: '0 0 20px' }}>
                Reviews ({artisan.reviews})
              </h2>
              {reviews.map((r, i) => (
                <div key={i} style={{ paddingBottom: 20, marginBottom: i < reviews.length-1 ? 20 : 0, borderBottom: i < reviews.length-1 ? `1px solid ${C.borderLight}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.lighter,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 700, fontSize: 13, color: C.primary }}>{r.name[0]}</div>
                      <span style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 13, color: C.textMid }}>{r.name}</span>
                    </div>
                    <span style={{ fontFamily: 'Sora', fontSize: 11, color: C.muted }}>{r.date}</span>
                  </div>
                  <Stars rating={r.rating} small />
                  <p style={{ fontFamily: 'Sora', fontSize: 13, color: C.textMid, lineHeight: 1.65, margin: '8px 0 0' }}>{r.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Booking Card */}
          <div>
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px', border: `1px solid ${C.borderLight}`, position: 'sticky', top: 88 }}>
              <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 20, color: C.bgDark, margin: '0 0 4px' }}>Book {artisan.name.split(' ')[0]}</h2>
              <p style={{ fontFamily: 'Sora', fontSize: 13, color: C.muted, margin: '0 0 20px' }}>Starting from ₦{artisan.price.toLocaleString()}</p>

              {/* Service Type Toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                {[['home', '🏠 Home Visit'], ['studio', '🏪 At Studio']].map(([val, label]) => (
                  <div key={val} onClick={() => setServiceType(val)}
                    style={{ padding: '10px', textAlign: 'center', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${serviceType === val ? C.brand : C.border}`,
                      background: serviceType === val ? C.bgAlt : '#fff',
                      fontFamily: 'Sora', fontSize: 12, fontWeight: 600,
                      color: serviceType === val ? C.brand : C.muted, transition: 'all 0.2s' }}>
                    <Icon name={ic} size={14} color={serviceType === val ? C.brand : C.muted} strokeWidth={1.6} />
                    {label}
                  </div>
                ))}
              </div>

              {/* Service Select */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Service</div>
                <select value={selectedService} onChange={e => setSelectedService(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10,
                    fontFamily: 'Sora', fontSize: 13, color: C.textMid, outline: 'none' }}>
                  {artisan.services.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Date */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Date</div>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10,
                    fontFamily: 'Sora', fontSize: 13, color: C.textMid, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Time */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>Available Times</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {times.map(t => (
                    <div key={t} onClick={() => setSelectedTime(t)}
                      style={{ padding: '7px 4px', textAlign: 'center', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${selectedTime === t ? C.brand : C.borderLight}`,
                        background: selectedTime === t ? C.bgAlt : '#fff',
                        fontFamily: 'Sora', fontSize: 11, fontWeight: selectedTime === t ? 600 : 400,
                        color: selectedTime === t ? C.brand : C.textMid, transition: 'all 0.2s' }}>{t}</div>
                  ))}
                </div>
              </div>

              <Btn label="Confirm Booking" iconRight="arrowR" variant="purple" size="md" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('checkout')} />
              <div style={{ height: 1, background: C.borderLight, margin: '16px 0' }} />
              <div style={{ fontFamily: 'Sora', fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.6 }}>
                🔒 Free cancellation up to 2 hours before<br />⚡ Usually responds in under 15 minutes
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ShopPage, ProductDetail, ServicesPage, ArtisansPage, ArtisanProfile });
