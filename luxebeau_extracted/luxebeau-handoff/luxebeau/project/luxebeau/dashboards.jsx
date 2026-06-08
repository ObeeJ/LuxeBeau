// LuxeBeau — Seller Dashboard, Artisan Dashboard, Admin Dashboard

// ─── STATUS TOKEN MAP (strict purple, no off-palette) ────────────
const STATUS_TONE = {
  // Tone is encoded by depth of purple, not hue. Available/positive states
  // use brand purple; pending/in-flight states use a softer mid-tone; negative
  // states drop to a desaturated muted purple-grey.
  positive: { bg: C.soft,    fg: C.brand,   dot: C.brand   },
  active:   { bg: C.soft,    fg: C.brand,   dot: C.brand   },
  pending:  { bg: C.bgAlt,   fg: C.primary, dot: C.lighter },
  shipped:  { bg: C.mist,    fg: C.deep,    dot: C.light   },
  neutral:  { bg: C.bgAlt,   fg: C.muted,   dot: C.subtle  },
  negative: { bg: C.bgAlt,   fg: C.muted,   dot: C.subtle  },
};

const ORDER_STATUS_TONE = {
  'Delivered':  STATUS_TONE.positive,
  'Processing': STATUS_TONE.pending,
  'Shipped':    STATUS_TONE.shipped,
  'Cancelled':  STATUS_TONE.negative,
  'Upcoming':   STATUS_TONE.shipped,
  'Completed':  STATUS_TONE.positive,
  'Active':     STATUS_TONE.positive,
  'Pending':    STATUS_TONE.pending,
  'Review':     STATUS_TONE.shipped,
};

function StatusPill({ status }) {
  const t = ORDER_STATUS_TONE[status] || STATUS_TONE.neutral;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6,
      fontFamily:'Sora', fontSize:10, fontWeight:600, padding:'4px 10px', borderRadius:20,
      background:t.bg, color:t.fg, letterSpacing:1, textTransform:'uppercase' }}>
      <Icon name="dot" size={6} color={t.dot} />
      {status}
    </span>
  );
}

// ─── SHARED DASHBOARD COMPONENTS ─────────────────────────────────
function StatCard({ icon, label, value, change, bg='#fff' }) {
  const up = change && change >= 0;
  return (
    <div style={{ background:bg, borderRadius:16, padding:'22px 24px', border:`1px solid ${C.borderLight}`,
      boxShadow:'0 2px 12px rgba(67,0,123,0.04)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ width:44, height:44, borderRadius:12, background:C.bgAlt, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name={icon} size={20} color={C.brand} strokeWidth={1.5} />
        </div>
        {change !== undefined && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:4,
            fontFamily:'Sora', fontSize:10, fontWeight:600, padding:'4px 10px', borderRadius:20,
            background: up ? C.soft : C.bgAlt, color: up ? C.brand : C.muted, letterSpacing:0.8 }}>
            <Icon name={up ? 'trend' : 'chart'} size={11} color="currentColor" strokeWidth={2} />
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <div style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:30, color:C.bgDark, marginBottom:4, letterSpacing:-0.6 }}>{value}</div>
      <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted, letterSpacing:1, textTransform:'uppercase' }}>{label}</div>
    </div>
  );
}

function MiniBar({ label, value, max, color=C.brand }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontFamily:'Sora', fontSize:12, color:C.textMid }}>{label}</span>
        <span style={{ fontFamily:'Sora', fontSize:12, fontWeight:600, color:C.primary }}>{value}</span>
      </div>
      <div style={{ height:6, background:C.bgAlt, borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${(parseInt(value)/max)*100}%`, background:color, borderRadius:3, transition:'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function DashSidebar({ links, active, setActive, role, navigate }) {
  return (
    <div style={{ width:240, flexShrink:0, background:'#fff', borderRight:`1px solid ${C.borderLight}`,
      minHeight:'calc(100vh - 68px)', padding:'28px 0', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'0 24px 24px', borderBottom:`1px solid ${C.borderLight}`, marginBottom:16 }}>
        <div style={{ fontFamily:'Sora', fontSize:10, color:C.muted, letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>{role} Portal</div>
        <div style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:18, color:C.bgDark, letterSpacing:-0.4 }}>LuxeBeau</div>
      </div>
      {links.map(([id,icon,label])=>(
        <div key={id} onClick={()=>setActive(id)}
          style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 24px', cursor:'pointer', transition:'all 0.2s',
            background: active===id ? C.bgAlt : 'transparent',
            borderLeft: `2px solid ${active===id ? C.brand : 'transparent'}`,
            color: active===id ? C.brand : C.textMid }}>
          <Icon name={icon} size={16} color="currentColor" strokeWidth={1.5} />
          <span style={{ fontFamily:'Sora', fontSize:13, fontWeight: active===id ? 600 : 400 }}>{label}</span>
        </div>
      ))}
      <div style={{ flex:1 }} />
      <div style={{ padding:'16px 20px', borderTop:`1px solid ${C.borderLight}` }}>
        <div onClick={()=>navigate('landing')}
          style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'10px 14px',
            borderRadius:10, background:C.bgAlt, transition:'all 0.2s', color:C.muted }}
          onMouseEnter={e=>{ e.currentTarget.style.background=C.mist; e.currentTarget.style.color=C.brand; }}
          onMouseLeave={e=>{ e.currentTarget.style.background=C.bgAlt; e.currentTarget.style.color=C.muted; }}>
          <Icon name="arrowL" size={14} color="currentColor" />
          <span style={{ fontFamily:'Sora', fontSize:12 }}>Back to Store</span>
        </div>
      </div>
    </div>
  );
}

// ─── SELLER DASHBOARD ─────────────────────────────────────────────
function SellerDashboard({ navigate }) {
  const [active, setActive] = React.useState('overview');
  const links = [
    ['overview','chart','Overview'],
    ['products','package','Products'],
    ['orders','cart','Orders'],
    ['earnings','wallet','Earnings'],
    ['analytics','trend','Analytics'],
    ['settings','settings','Settings'],
  ];

  const orders = [
    { id:'ORD-8821', customer:'Amaka Obi',     product:'Shea Butter Cream', amount:4500, status:'Delivered',  date:'Today' },
    { id:'ORD-8820', customer:'Kemi Adeyemi',  product:'Rosehip Serum',     amount:8900, status:'Processing', date:'Today' },
    { id:'ORD-8819', customer:'Blessing Eze',  product:'Cantu Curl Cream',  amount:5200, status:'Shipped',    date:'Yesterday' },
    { id:'ORD-8818', customer:'Ngozi Peters',  product:'Lip Gloss Set',     amount:4200, status:'Delivered',  date:'Yesterday' },
    { id:'ORD-8817', customer:'Sandra Musa',   product:'Black Soap',        amount:2800, status:'Cancelled',  date:'2 days ago' },
  ];

  const products = PRODUCTS.slice(0,6).map((p,i)=>({ ...p, stock:Math.floor(Math.random()*50)+5, sold:p.reviews }));

  return (
    <div style={{ display:'flex', height:'calc(100vh - 68px)', overflow:'hidden' }}>
      <DashSidebar links={links} active={active} setActive={setActive} role="Seller" navigate={navigate} />
      <div style={{ flex:1, overflowY:'auto', background:C.bgAlt }}>
        <div style={{ padding:'40px 48px' }}>

          {active === 'overview' && (
            <>
              <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:36 }}>
                <div>
                  <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted, letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Seller · GlowLab</div>
                  <h1 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:34, color:C.bgDark, margin:0, letterSpacing:-1 }}>
                    Good morning, <em style={{ fontStyle:'italic', color:C.brand, fontWeight:300 }}>GlowLab.</em>
                  </h1>
                  <span style={{ fontFamily:'Sora', fontSize:13, color:C.muted, marginTop:6, display:'block' }}>Here's what's happening with your store today</span>
                </div>
                <Btn label="Add Product" icon="plus" variant="purple" size="sm" onClick={()=>setActive('products')} />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20, marginBottom:28 }}>
                <StatCard icon="wallet"  label="Total Revenue" value="₦284,500" change={12} />
                <StatCard icon="package" label="Total Orders"  value="48"       change={8} />
                <StatCard icon="star"    label="Avg. Rating"   value="4.8/5"    change={2} />
                <StatCard icon="trend"   label="Return Rate"   value="1.2%"     change={-0.3} />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:28 }}>
                {/* Revenue Chart */}
                <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
                    <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:0, letterSpacing:-0.4 }}>Revenue · 30 days</h3>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontFamily:'Sora', fontSize:11, color:C.brand, fontWeight:600, background:C.soft, padding:'4px 10px', borderRadius:20 }}>
                      <Icon name="trend" size={11} color={C.brand} strokeWidth={2} />+12%
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120 }}>
                    {[40,55,35,70,80,60,90,75,85,65,95,88].map((h,i)=>(
                      <div key={i} style={{ flex:1, height:`${h}%`, borderRadius:'4px 4px 0 0',
                        background: i===11 ? C.brand : `${C.light}55`, transition:'all 0.3s' }} />
                    ))}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:10 }}>
                    {['Apr 1','Apr 8','Apr 15','Apr 22'].map(d=>(
                      <span key={d} style={{ fontFamily:'Sora', fontSize:10, color:C.muted, letterSpacing:0.8 }}>{d}</span>
                    ))}
                  </div>
                </div>

                {/* Top Products */}
                <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                  <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:'0 0 24px', letterSpacing:-0.4 }}>Top Products</h3>
                  {[['Rosehip Serum','₦89,000','102'],['Shea Butter Cream','₦67,500','124'],['Vitamin C Eye Cream','₦43,200','78'],['Beard Oil','₦36,250','145']].map(([n,r,s])=>(
                    <div key={n} style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:C.bgAlt, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Icon name="sparkle" size={16} color={C.brand} strokeWidth={1.5} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:'Sora', fontSize:13, fontWeight:500, color:C.textMid }}>{n}</div>
                        <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted, marginTop:2 }}>{s} sold</div>
                      </div>
                      <span style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:15, color:C.primary }}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders */}
              <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                  <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:0, letterSpacing:-0.4 }}>Recent Orders</h3>
                  <span onClick={()=>setActive('orders')} style={{ fontFamily:'Sora', fontSize:12, color:C.brand, cursor:'pointer', fontWeight:500, display:'inline-flex', alignItems:'center', gap:6 }}>
                    View All <Icon name="arrowR" size={12} color="currentColor" />
                  </span>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.borderLight}` }}>
                      {['Order ID','Customer','Product','Amount','Status','Date'].map(h=>(
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontFamily:'Sora', fontSize:10, color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:1.2 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o=>(
                      <tr key={o.id} style={{ borderBottom:`1px solid ${C.borderLight}` }}
                        onMouseEnter={e=>e.currentTarget.style.background=C.bgAlt}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, fontWeight:600, color:C.brand }}>{o.id}</td>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, color:C.textMid }}>{o.customer}</td>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, color:C.textMid }}>{o.product}</td>
                        <td style={{ padding:'14px 12px', fontFamily:'Clash Display', fontSize:14, fontWeight:500, color:C.primary }}>₦{o.amount.toLocaleString()}</td>
                        <td style={{ padding:'14px 12px' }}><StatusPill status={o.status} /></td>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, color:C.muted }}>{o.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {active === 'products' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
                <h1 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:30, color:C.bgDark, margin:0, letterSpacing:-0.8 }}>My Products</h1>
                <div style={{ display:'flex', gap:10 }}>
                  <TextInput placeholder="Search products..." icon="search" sx={{ width:240 }} />
                  <Btn label="Add Product" icon="plus" variant="purple" size="sm" />
                </div>
              </div>
              <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.borderLight}` }}>
                      {['Product','Category','Price','Stock','Sold','Status','Actions'].map(h=>(
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontFamily:'Sora', fontSize:10, color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:1.2 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p=>(
                      <tr key={p.id} style={{ borderBottom:`1px solid ${C.borderLight}` }}
                        onMouseEnter={e=>e.currentTarget.style.background=C.bgAlt}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'14px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                            <div style={{ width:38, height:38, borderRadius:8, background:p.bg, flexShrink:0 }} />
                            <div>
                              <div style={{ fontFamily:'Sora', fontSize:12, fontWeight:600, color:C.textMid }}>{p.name}</div>
                              <div style={{ fontFamily:'Sora', fontSize:10, color:C.muted, marginTop:2 }}>{p.brand}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, color:C.textMid, textTransform:'capitalize' }}>{p.category}</td>
                        <td style={{ padding:'14px 12px', fontFamily:'Clash Display', fontSize:13, fontWeight:500, color:C.primary }}>₦{p.price.toLocaleString()}</td>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, color: p.stock<10?C.muted:C.textMid, fontWeight: p.stock<10?600:400 }}>{p.stock}</td>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, color:C.textMid }}>{p.sold}</td>
                        <td style={{ padding:'14px 12px' }}><StatusPill status="Active" /></td>
                        <td style={{ padding:'14px 12px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <Btn label="Edit"   variant="outline" size="sm" />
                            <Btn label="Delete" variant="ghost"   size="sm" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {active === 'earnings' && (
            <>
              <h1 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:30, color:C.bgDark, margin:'0 0 28px', letterSpacing:-0.8 }}>Earnings</h1>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, marginBottom:28 }}>
                <StatCard icon="wallet" label="Total Earnings" value="₦1.2M"  change={14} />
                <StatCard icon="bank"   label="Withdrawn"      value="₦980K" />
                <StatCard icon="card"   label="Available"      value="₦220K" change={6} />
              </div>
              <div style={{ background:'#fff', borderRadius:20, padding:'32px', border:`1px solid ${C.borderLight}`, marginBottom:20 }}>
                <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:'0 0 24px', letterSpacing:-0.4 }}>Monthly Breakdown</h3>
                {[['January','₦94,000',94],['February','₦112,000',112],['March','₦187,500',188],['April (so far)','₦284,500',285]].map(([m,a,v])=>(
                  <div key={m} style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
                    <div style={{ width:120, fontFamily:'Sora', fontSize:13, color:C.textMid }}>{m}</div>
                    <div style={{ flex:1, height:28, background:C.bgAlt, borderRadius:6, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(v/300)*100}%`, background:`linear-gradient(90deg,${C.primary},${C.brand})`, borderRadius:6, display:'flex', alignItems:'center', paddingLeft:12 }}>
                        <span style={{ fontFamily:'Sora', fontSize:11, fontWeight:600, color:'#fff' }}>{a}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Btn label="Withdraw ₦220,000" iconRight="arrowR" variant="primary" size="md" />
            </>
          )}

          {['orders','analytics','settings'].includes(active) && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'120px 0' }}>
              <div style={{ width:80, height:80, borderRadius:'50%', background:C.bgAlt, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24 }}>
                <Icon name={active==='orders'?'cart':active==='analytics'?'chart':'settings'} size={32} color={C.brand} strokeWidth={1.4} />
              </div>
              <h2 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:28, color:C.bgDark, margin:'0 0 10px', letterSpacing:-0.6 }}>
                {active.charAt(0).toUpperCase()+active.slice(1)}
              </h2>
              <p style={{ fontFamily:'Sora', fontSize:13, color:C.muted }}>This section is fully functional in the live build</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ARTISAN DASHBOARD ────────────────────────────────────────────
function ArtisanDashboard({ navigate }) {
  const [active, setActive] = React.useState('overview');
  const links = [
    ['overview','chart','Overview'],
    ['bookings','calendar','Bookings'],
    ['services','sparkle','My Services'],
    ['earnings','wallet','Earnings'],
    ['availability','clock','Availability'],
    ['profile','user','Profile'],
  ];

  const bookings = [
    { id:'BK-441', client:'Adaeze Martins',   service:'Knotless Braids',   date:'Today, 2:00 PM',     amount:12000, type:'Home',   status:'Upcoming' },
    { id:'BK-440', client:'Funmi Okafor',     service:'Box Braids',        date:'Today, 5:00 PM',     amount:8000,  type:'Studio', status:'Upcoming' },
    { id:'BK-439', client:'Joy Nwachukwu',    service:'Wig Installation',  date:'Yesterday, 11AM',    amount:15000, type:'Home',   status:'Completed' },
    { id:'BK-438', client:'Chisom Eze',       service:'Loc Maintenance',   date:'Apr 20, 9AM',        amount:10000, type:'Home',   status:'Completed' },
  ];

  return (
    <div style={{ display:'flex', height:'calc(100vh - 68px)', overflow:'hidden' }}>
      <DashSidebar links={links} active={active} setActive={setActive} role="Artisan" navigate={navigate} />
      <div style={{ flex:1, overflowY:'auto', background:C.bgAlt }}>
        <div style={{ padding:'40px 48px' }}>

          {active === 'overview' && (
            <>
              <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:36 }}>
                <div>
                  <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted, letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Artisan · Hairstylist</div>
                  <h1 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:34, color:C.bgDark, margin:0, letterSpacing:-1 }}>
                    Good morning, <em style={{ fontStyle:'italic', color:C.brand, fontWeight:300 }}>Chidinma.</em>
                  </h1>
                  <span style={{ fontFamily:'Sora', fontSize:13, color:C.muted, marginTop:6, display:'block' }}>You have <strong style={{ color:C.primary, fontWeight:600 }}>3 bookings</strong> today</span>
                </div>
                <Btn label="New Service" icon="plus" variant="purple" size="sm" onClick={()=>setActive('services')} />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20, marginBottom:28 }}>
                <StatCard icon="calendar" label="This Week"  value="12 Bookings" change={15} />
                <StatCard icon="wallet"   label="This Month" value="₦312,000"   change={22} />
                <StatCard icon="star"     label="Rating"     value="4.9 / 5.0"  change={1} />
                <StatCard icon="award"    label="Completed"  value="412 Jobs" />
              </div>

              {/* Today's Schedule */}
              <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}`, marginBottom:20 }}>
                <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:'0 0 20px', letterSpacing:-0.4 }}>Today's Schedule</h3>
                {bookings.filter(b=>b.date.includes('Today')).map(b=>(
                  <div key={b.id} style={{ display:'flex', gap:16, alignItems:'center', padding:'16px 0',
                    borderBottom:`1px solid ${C.borderLight}` }}>
                    <div style={{ width:48, height:48, borderRadius:12, background:C.soft, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Icon name="sparkle" size={20} color={C.brand} strokeWidth={1.5} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'Sora', fontWeight:600, fontSize:14, color:C.bgDark, marginBottom:3 }}>{b.service}</div>
                      <div style={{ fontFamily:'Sora', fontSize:12, color:C.muted, display:'inline-flex', alignItems:'center', gap:8 }}>
                        <Icon name="user" size={12} color={C.muted} /> {b.client}
                        <span style={{ color:C.subtle }}>·</span>
                        {b.date}
                        <span style={{ color:C.subtle }}>·</span>
                        <Icon name={b.type==='Home'?'home':'store'} size={12} color={C.muted} /> {b.type==='Home'?'Home Visit':'Studio'}
                      </div>
                    </div>
                    <span style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:18, color:C.primary }}>₦{b.amount.toLocaleString()}</span>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn label="Confirm" variant="purple"  size="sm" />
                      <Btn label="Message" variant="outline" size="sm" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Earnings & Reviews */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                  <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:'0 0 20px', letterSpacing:-0.4 }}>Earnings Breakdown</h3>
                  <MiniBar label="Hairstyling"      value="68%" max={100} color={C.brand} />
                  <MiniBar label="Wig Installation" value="22%" max={100} color={C.light} />
                  <MiniBar label="Loc Maintenance"  value="10%" max={100} color={C.lighter} />
                </div>
                <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                  <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:'0 0 20px', letterSpacing:-0.4 }}>Recent Reviews</h3>
                  {[{n:'Adaeze M.', t:'Amazing work — exactly what I wanted.', r:5},{n:'Kemi F.', t:'Professional and punctual. Will definitely rebook.', r:5}].map((r,i)=>(
                    <div key={i} style={{ marginBottom:14, paddingBottom:14, borderBottom: i<1?`1px solid ${C.borderLight}`:'none' }}>
                      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:6 }}>
                        <div style={{ width:30, height:30, borderRadius:'50%', background:C.lighter, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Sora', fontWeight:600, fontSize:12, color:'#fff' }}>{r.n[0]}</div>
                        <span style={{ fontFamily:'Sora', fontWeight:600, fontSize:12, color:C.textMid }}>{r.n}</span>
                        <span style={{ display:'inline-flex', gap:1 }}>
                          {[1,2,3,4,5].map(j=> <Icon key={j} name={j<=r.r?'starFill':'star'} size={11} color={C.brand} strokeWidth={1.4} />)}
                        </span>
                      </div>
                      <p style={{ fontFamily:'Sora', fontSize:12, color:C.muted, margin:0, lineHeight:1.65 }}>{r.t}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {active === 'bookings' && (
            <>
              <h1 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:30, color:C.bgDark, margin:'0 0 28px', letterSpacing:-0.8 }}>All Bookings</h1>
              <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.borderLight}` }}>
                      {['ID','Client','Service','Date','Type','Amount','Status'].map(h=>(
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontFamily:'Sora', fontSize:10, color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:1.2 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b=>(
                      <tr key={b.id} style={{ borderBottom:`1px solid ${C.borderLight}` }}
                        onMouseEnter={e=>e.currentTarget.style.background=C.bgAlt}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, fontWeight:600, color:C.brand }}>{b.id}</td>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, color:C.textMid }}>{b.client}</td>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, color:C.textMid }}>{b.service}</td>
                        <td style={{ padding:'14px 12px', fontFamily:'Sora', fontSize:12, color:C.muted }}>{b.date}</td>
                        <td style={{ padding:'14px 12px' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontFamily:'Sora', fontSize:11, padding:'4px 10px', borderRadius:20, background: b.type==='Home'?C.soft:C.mist, color: b.type==='Home'?C.brand:C.primary, fontWeight:500 }}>
                            <Icon name={b.type==='Home'?'home':'store'} size={11} color="currentColor" strokeWidth={1.6} />
                            {b.type}
                          </span>
                        </td>
                        <td style={{ padding:'14px 12px', fontFamily:'Clash Display', fontSize:14, fontWeight:500, color:C.primary }}>₦{b.amount.toLocaleString()}</td>
                        <td style={{ padding:'14px 12px' }}><StatusPill status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {['services','earnings','availability','profile'].includes(active) && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'120px 0' }}>
              <div style={{ width:80, height:80, borderRadius:'50%', background:C.bgAlt, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24 }}>
                <Icon name={active==='services'?'sparkle':active==='earnings'?'wallet':active==='availability'?'clock':'user'} size={32} color={C.brand} strokeWidth={1.4} />
              </div>
              <h2 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:28, color:C.bgDark, margin:'0 0 10px', letterSpacing:-0.6 }}>
                {active.charAt(0).toUpperCase()+active.slice(1)}
              </h2>
              <p style={{ fontFamily:'Sora', fontSize:13, color:C.muted }}>This section is fully functional in the live build</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────
function AdminDashboard({ navigate }) {
  const [active, setActive] = React.useState('overview');
  const links = [
    ['overview','chart','Overview'],
    ['users','users','Users'],
    ['products','package','Products'],
    ['artisans','sparkle','Artisans'],
    ['orders','cart','Orders'],
    ['partnerships','handshake','Partnerships'],
    ['settings','settings','Settings'],
  ];

  const pendingApps = [
    { name:'Zara Beauty Co.', type:'Seller',  date:'Apr 22', status:'Pending', products:'24 products listed' },
    { name:'Ngozi Okafor',    type:'Artisan', date:'Apr 21', status:'Pending', products:'Makeup Artist · Lagos' },
    { name:'GlossUp Store',   type:'Seller',  date:'Apr 20', status:'Review',  products:'12 products listed' },
    { name:'Taiwo Williams',  type:'Artisan', date:'Apr 20', status:'Pending', products:'Hairstylist · Abuja' },
  ];

  return (
    <div style={{ display:'flex', height:'calc(100vh - 68px)', overflow:'hidden' }}>
      <DashSidebar links={links} active={active} setActive={setActive} role="Admin" navigate={navigate} />
      <div style={{ flex:1, overflowY:'auto', background:C.bgAlt }}>
        <div style={{ padding:'40px 48px' }}>

          {active === 'overview' && (
            <>
              <div style={{ marginBottom:36 }}>
                <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted, letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Admin · April 22, 2026</div>
                <h1 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:34, color:C.bgDark, margin:0, letterSpacing:-1 }}>
                  Platform <em style={{ fontStyle:'italic', color:C.brand, fontWeight:300 }}>overview.</em>
                </h1>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20, marginBottom:28 }}>
                <StatCard icon="users"   label="Total Users"      value="52,841" change={8} />
                <StatCard icon="cart"    label="Orders Today"     value="1,284"  change={14} />
                <StatCard icon="wallet"  label="GMV Today"        value="₦4.8M" change={11} />
                <StatCard icon="sparkle" label="Active Artisans"  value="2,103"  change={5} />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:28 }}>
                {/* Platform chart */}
                <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                  <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:'0 0 24px', letterSpacing:-0.4 }}>Platform Activity · 7 days</h3>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:130 }}>
                    {[
                      {orders:65, gmv:72},{orders:80, gmv:85},{orders:55, gmv:60},
                      {orders:90, gmv:95},{orders:75, gmv:80},{orders:88, gmv:92},{orders:100, gmv:100},
                    ].map((d,i)=>(
                      <div key={i} style={{ flex:1, display:'flex', alignItems:'flex-end', gap:3, height:'100%' }}>
                        <div style={{ flex:1, height:`${d.orders}%`, background:C.brand, borderRadius:'3px 3px 0 0' }} />
                        <div style={{ flex:1, height:`${d.gmv}%`, background:`${C.light}66`, borderRadius:'3px 3px 0 0' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:24, marginTop:14 }}>
                    <span style={{ fontFamily:'Sora', fontSize:11, color:C.muted, display:'inline-flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:C.brand, display:'inline-block' }} />Orders
                    </span>
                    <span style={{ fontFamily:'Sora', fontSize:11, color:C.muted, display:'inline-flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:`${C.light}66`, display:'inline-block' }} />GMV
                    </span>
                  </div>
                </div>

                {/* Category split */}
                <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                  <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:'0 0 24px', letterSpacing:-0.4 }}>Top Categories</h3>
                  {[['Skincare','38%'],['Makeup','27%'],['Hairstyling','18%'],['Hair Products','12%'],['Other','5%']].map(([cat,pct])=>(
                    <MiniBar key={cat} label={cat} value={pct} max={50} color={C.brand} />
                  ))}
                </div>
              </div>

              {/* Pending Partnerships */}
              <div style={{ background:'#fff', borderRadius:20, padding:'28px', border:`1px solid ${C.borderLight}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                  <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:20, color:C.bgDark, margin:0, letterSpacing:-0.4 }}>Pending Applications</h3>
                  <span onClick={()=>setActive('partnerships')} style={{ fontFamily:'Sora', fontSize:12, color:C.brand, cursor:'pointer', fontWeight:500, display:'inline-flex', alignItems:'center', gap:6 }}>
                    View All <Icon name="arrowR" size={12} color="currentColor" />
                  </span>
                </div>
                {pendingApps.map((app,i)=>(
                  <div key={i} style={{ display:'flex', gap:16, alignItems:'center', padding:'16px 0',
                    borderBottom: i<pendingApps.length-1?`1px solid ${C.borderLight}`:'none' }}>
                    <div style={{ width:44, height:44, borderRadius:12, background: app.type==='Seller'?C.mist:C.soft,
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Icon name={app.type==='Seller'?'store':'sparkle'} size={18} color={C.brand} strokeWidth={1.5} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'Sora', fontWeight:600, fontSize:13, color:C.bgDark, marginBottom:2 }}>{app.name}</div>
                      <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted }}>{app.products} · Applied {app.date}</div>
                    </div>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontFamily:'Sora', fontSize:10, padding:'4px 10px', borderRadius:20, background: app.type==='Seller'?C.mist:C.soft, color: app.type==='Seller'?C.primary:C.brand, fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>
                      {app.type}
                    </span>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn label="Approve" variant="purple" size="sm" />
                      <Btn label="Reject"  variant="ghost"  size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {active !== 'overview' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'120px 0' }}>
              <div style={{ width:80, height:80, borderRadius:'50%', background:C.bgAlt, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24 }}>
                <Icon name={active==='users'?'users':active==='products'?'package':active==='artisans'?'sparkle':active==='orders'?'cart':active==='partnerships'?'handshake':'settings'} size={32} color={C.brand} strokeWidth={1.4} />
              </div>
              <h2 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:28, color:C.bgDark, margin:'0 0 10px', letterSpacing:-0.6 }}>
                {active.charAt(0).toUpperCase()+active.slice(1)} Management
              </h2>
              <p style={{ fontFamily:'Sora', fontSize:13, color:C.muted, marginBottom:24 }}>This section is fully functional in the live build</p>
              <Btn label="Back to Overview" variant="purple" size="md" onClick={()=>setActive('overview')} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SellerDashboard, ArtisanDashboard, AdminDashboard });
