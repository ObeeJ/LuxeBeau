// LuxeBeau — Auth, Cart, Checkout, Payment

// ─── AUTH ─────────────────────────────────────────────────────────
function AuthPage({ navigate }) {
  const [tab, setTab] = React.useState('signin');
  const [form, setForm] = React.useState({ email:'', password:'', name:'', phone:'', role:'buyer' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, maxWidth: 900, width: '100%',
        background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 24px 80px rgba(67,0,123,0.12)', border: `1px solid ${C.borderLight}` }}>
        {/* Left Panel */}
        <div style={{ background: `linear-gradient(160deg, ${C.primary} 0%, ${C.brand} 100%)`,
          padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(232,255,88,0.08)' }} />
          <div style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 28, color: '#fff', marginBottom: 8 }}>
            Luxe<span style={{ color: C.lighter, fontStyle:'italic', fontWeight:300 }}>Beau</span>
          </div>
          <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 36, color: '#fff', margin: '24px 0 16px', lineHeight: 1.2 }}>
            {tab === 'signin' ? 'Welcome\nback!' : 'Join the\ncommunity'}
          </h2>
          <p style={{ fontFamily: 'Sora', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, margin: '0 0 32px' }}>
            {tab === 'signin'
              ? 'Sign in to access your orders, bookings and wishlist.'
              : 'Create your free account and start your beauty journey today.'}
          </p>
          {['50,000+ products','2,000+ artisans','30-min delivery','Secure payments'].map((t)=>(
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Icon name="check" size={14} color={C.lighter} strokeWidth={2.2} />
              <span style={{ fontFamily: 'Sora', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{t}</span>
            </div>
          ))}
        </div>

        {/* Right Panel */}
        <div style={{ padding: '60px 48px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: C.bgAlt, borderRadius: 12, padding: 4, marginBottom: 32 }}>
            {[['signin','Sign In'],['signup','Create Account']].map(([val,label])=>(
              <div key={val} onClick={() => setTab(val)}
                style={{ flex: 1, padding: '10px', textAlign: 'center', borderRadius: 9, cursor: 'pointer', transition: 'all 0.2s',
                  background: tab === val ? '#fff' : 'transparent',
                  fontFamily: 'Sora', fontSize: 13, fontWeight: tab === val ? 700 : 400,
                  color: tab === val ? C.primary : C.muted,
                  boxShadow: tab === val ? '0 2px 8px rgba(0,0,0,0.08)' : 'none' }}>{label}</div>
            ))}
          </div>

          {tab === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>I want to</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[['buyer','cart','Shop'],['seller','store','Sell'],['artisan','sparkle','Offer Services']].map(([val,ic,label])=>(
                  <div key={val} onClick={() => setForm(f=>({...f,role:val}))}
                    style={{ padding: '12px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${form.role===val ? C.brand : C.borderLight}`,
                      background: form.role===val ? C.bgAlt : '#fff',
                      fontFamily: 'Sora', fontSize: 11, fontWeight: form.role===val ? 600 : 400,
                      color: form.role===val ? C.brand : C.muted, transition: 'all 0.2s' }}>
                    <Icon name={ic} size={16} color={form.role===val ? C.brand : C.muted} strokeWidth={1.5} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab === 'signup' && <TextInput placeholder="Full Name" icon="user" value={form.name} onChange={set('name')} />}
            <TextInput placeholder="Email Address" icon="mail" value={form.email} onChange={set('email')} type="email" />
            {tab === 'signup' && <TextInput placeholder="Phone Number (e.g. 0801 234 5678)" icon="phone" value={form.phone} onChange={set('phone')} />}
            <TextInput placeholder="Password" icon="🔒" value={form.password} onChange={set('password')} type="password" />
          </div>

          {tab === 'signin' && (
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <span style={{ fontFamily: 'Sora', fontSize: 12, color: C.brand, cursor: 'pointer' }}>Forgot password?</span>
            </div>
          )}

          <Btn label={tab === 'signin' ? 'Sign In' : 'Create Account'} iconRight="arrowR" variant="purple" size="lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}
            onClick={() => navigate('landing')} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: C.borderLight }} />
            <span style={{ fontFamily: 'Sora', fontSize: 12, color: C.muted }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: C.borderLight }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['G','Google'],['f','Facebook']].map(([ic,label])=>(
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px', border: `1.5px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor = C.light; e.currentTarget.style.background = C.bgAlt; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = '#fff'; }}>
                <span style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 15, color: C.primary }}>{ic}</span>
                <span style={{ fontFamily: 'Sora', fontSize: 13, color: C.textMid }}>{label}</span>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: 'Sora', fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 20 }}>
            {tab === 'signin' ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => setTab(tab==='signin'?'signup':'signin')}
              style={{ color: C.brand, cursor: 'pointer', fontWeight: 600 }}>
              {tab === 'signin' ? 'Sign Up' : 'Sign In'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── CART ─────────────────────────────────────────────────────────
function CartPage({ cart, updateQty, removeFromCart, navigate }) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = subtotal > 10000 ? 0 : 1500;
  const total = subtotal + delivery;
  const fmt = n => '₦' + n.toLocaleString();

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: C.bg }}>
      <div style={{ padding: '32px 56px' }}>
        <h1 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 32, color: C.bgDark, margin: '0 0 32px' }}>
          Shopping Cart <span style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 400, color: C.muted }}>({cart.length} items)</span>
        </h1>

        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width:96, height:96, borderRadius:'50%', background:C.bgAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 28px' }}>
              <Icon name="cart" size={36} color={C.lighter} strokeWidth={1.4} />
            </div>
            <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 28, color: C.textMid, margin: '0 0 12px' }}>Your cart is empty</h2>
            <p style={{ fontFamily: 'Sora', fontSize: 14, color: C.muted, marginBottom: 32 }}>Start shopping to add products to your cart</p>
            <Btn label="Browse Products" variant="purple" size="lg" onClick={() => navigate('shop')} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>
            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {cart.map(item => (
                <div key={item.id} style={{ background: '#fff', borderRadius: 16, padding: '20px',
                  border: `1px solid ${C.borderLight}`, display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ width: 90, height: 90, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                    <ImgPlaceholder label={item.name} height={90} bg={item.bg} fg={item.fg} radius={12} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Sora', fontSize: 11, color: C.muted, marginBottom: 3 }}>{item.brand}</div>
                    <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: C.bgDark, marginBottom: 8 }}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                        <button onClick={() => updateQty(item.id, item.qty - 1)}
                          style={{ width: 34, height: 34, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 16, color: C.textMid }}>−</button>
                        <span style={{ width: 36, textAlign: 'center', fontFamily: 'Sora', fontWeight: 600, fontSize: 14 }}>{item.qty}</span>
                        <button onClick={() => updateQty(item.id, item.qty + 1)}
                          style={{ width: 34, height: 34, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 16, color: C.textMid }}>+</button>
                      </div>
                      <span style={{ fontFamily: 'Sora', fontSize: 11, color: C.muted, cursor: 'pointer' }}
                        onClick={() => removeFromCart(item.id)}>✕ Remove</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 20, color: C.primary, flexShrink: 0 }}>
                    {fmt(item.price * item.qty)}
                  </div>
                </div>
              ))}

              {/* Promo Code */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: `1px solid ${C.borderLight}` }}>
                <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 13, color: C.bgDark, marginBottom: 12 }}>Have a promo code?</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <TextInput placeholder="Enter promo code" sx={{ flex: 1 }} />
                  <Btn label="Apply" variant="outline" size="sm" />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px', border: `1px solid ${C.borderLight}`, position: 'sticky', top: 88 }}>
              <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 20, color: C.bgDark, margin: '0 0 24px' }}>Order Summary</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                {[['Subtotal', fmt(subtotal)], ['Delivery', delivery === 0 ? 'Free' : fmt(delivery)], ['Service Fee', 'Free']].map(([k,v])=>(
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Sora', fontSize: 13, color: C.muted }}>{k}</span>
                    <span style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: v.includes('Free') ? 600 : 400, color: v.includes('Free') ? C.brand : C.textMid }}>{v.replace('','')}</span>
                  </div>
                ))}
                {delivery > 0 && (
                  <div style={{ background: C.bgAlt, borderRadius: 10, padding: '10px 14px', fontFamily: 'Sora', fontSize: 11, color: C.brand }}>
                    💡 Add ₦{(10000 - subtotal).toLocaleString()} more for free delivery!
                  </div>
                )}
              </div>
              <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 16, color: C.bgDark }}>Total</span>
                  <span style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 24, color: C.primary }}>{fmt(total)}</span>
                </div>
              </div>
              <Btn label="Proceed to Checkout" iconRight="arrowR" variant="purple" size="md" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('checkout')} />
              <Btn label="Continue Shopping" variant="ghost" size="sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                onClick={() => navigate('shop')} />
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 16 }}>
                {['💳','🏦','📱','🔒'].map((ic,i)=>(<span key={i} style={{ fontSize: 20 }}>{ic}</span>))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CHECKOUT ─────────────────────────────────────────────────────
function CheckoutPage({ cart, navigate }) {
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState({
    fname:'', lname:'', email:'', phone:'', address:'', city:'Lagos', state:'Lagos', landmark:'',
    payMethod:'card', cardNum:'', cardName:'', expiry:'', cvv:'', saveCard:false
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = subtotal > 10000 ? 0 : 1500;
  const total = subtotal + delivery;
  const fmt = n => '₦' + n.toLocaleString();

  const steps = ['Delivery', 'Payment', 'Review'];

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: C.bg }}>
      <div style={{ background: '#fff', borderBottom: `1px solid ${C.borderLight}`, padding: '20px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span style={{ fontFamily: 'Sora', fontSize: 13, color: C.brand, cursor: 'pointer', display:'inline-flex', alignItems:'center', gap:6 }} onClick={() => navigate('cart')}><Icon name="arrowL" size={12} color={C.brand} />Back to Cart</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: step > i+1 ? C.brand : step === i+1 ? C.primary : C.borderLight,
                    color: step >= i+1 ? '#fff' : C.muted, fontFamily: 'Sora', fontSize: 12, fontWeight: 600 }}>
                    {step > i+1 ? <Icon name="check" size={12} color="#fff" strokeWidth={2.5} /> : i+1}
                  </div>
                  <span style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: step === i+1 ? 600 : 400, color: step === i+1 ? C.primary : C.muted }}>{s}</span>
                </div>
                {i < steps.length-1 && <div style={{ width: 40, height: 1, background: step > i+1 ? C.brand : C.borderLight }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, padding: '32px 56px', alignItems: 'start' }}>
        <div>
          {/* Step 1: Delivery */}
          {step === 1 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '32px', border: `1px solid ${C.borderLight}` }}>
              <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 22, color: C.bgDark, margin: '0 0 24px' }}>Delivery Address</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>First Name</div>
                  <TextInput placeholder="Chioma" value={form.fname} onChange={set('fname')} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Last Name</div>
                  <TextInput placeholder="Okafor" value={form.lname} onChange={set('lname')} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Email</div>
                <TextInput placeholder="chioma@email.com" value={form.email} onChange={set('email')} type="email" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Phone Number</div>
                <TextInput placeholder="0801 234 5678" value={form.phone} onChange={set('phone')} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Delivery Address</div>
                <TextInput placeholder="123 Admiralty Way, Lekki Phase 1" value={form.address} onChange={set('address')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>City</div>
                  <Select value={form.city} onChange={set('city')} options={['Lagos','Abuja','Port Harcourt','Ibadan']} sx={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>State</div>
                  <Select value={form.state} onChange={set('state')} options={['Lagos','FCT','Rivers','Oyo','Kano']} sx={{ width:'100%' }} />
                </div>
              </div>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Closest Landmark (optional)</div>
                <TextInput placeholder="e.g. Beside Shoprite Lekki" value={form.landmark} onChange={set('landmark')} />
              </div>
              <Btn label="Continue to Payment" iconRight="arrowR" variant="purple" size="lg" style={{ width:'100%', justifyContent:'center' }}
                onClick={() => setStep(2)} />
            </div>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '32px', border: `1px solid ${C.borderLight}` }}>
              <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 22, color: C.bgDark, margin: '0 0 24px' }}>Payment Method</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 28 }}>
                {[
                  { val:'card', label:'💳 Debit/Credit Card', desc:'Visa, Mastercard, Verve' },
                  { val:'transfer', label:'🏦 Bank Transfer', desc:'Direct bank transfer' },
                  { val:'ussd', label:'📱 USSD', desc:'*737#, *822#, *901# etc.' },
                  { val:'wallet', label:'👛 LuxeBeau Wallet', desc:'Balance: ₦2,500' },
                ].map(opt => (
                  <div key={opt.val} onClick={() => setForm(f=>({...f,payMethod:opt.val}))}
                    style={{ padding: '16px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                      border: `2px solid ${form.payMethod===opt.val ? C.brand : C.border}`,
                      background: form.payMethod===opt.val ? C.bgAlt : '#fff' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <Icon name={opt.icon} size={16} color={form.payMethod===opt.val ? C.brand : C.muted} strokeWidth={1.5} />
                      <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 13, color: C.textMid }}>{opt.label}</div>
                    </div>
                    <div style={{ fontFamily: 'Sora', fontSize: 11, color: C.muted, paddingLeft:26 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>

              {form.payMethod === 'card' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
                  <div>
                    <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Card Number</div>
                    <TextInput placeholder="0000  0000  0000  0000" value={form.cardNum} onChange={set('cardNum')} icon="💳" />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Cardholder Name</div>
                    <TextInput placeholder="CHIOMA OKAFOR" value={form.cardName} onChange={set('cardName')} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Expiry</div>
                      <TextInput placeholder="MM / YY" value={form.expiry} onChange={set('expiry')} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>CVV</div>
                      <TextInput placeholder="•••" value={form.cvv} onChange={set('cvv')} type="password" />
                    </div>
                  </div>
                </div>
              )}

              {form.payMethod === 'transfer' && (
                <div style={{ background: C.bgAlt, borderRadius: 16, padding: '20px 24px', marginBottom: 28 }}>
                  <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 13, color: C.bgDark, marginBottom: 12 }}>Transfer to this account:</div>
                  {[['Bank','Wema Bank'],['Account No.','0123456789'],['Account Name','LuxeBeau Payments Ltd'],['Amount',`₦${total.toLocaleString()}`]].map(([k,v])=>(
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontFamily:'Sora', fontSize:12, color:C.muted }}>{k}</span>
                      <span style={{ fontFamily:'Sora', fontSize:12, fontWeight:700, color:C.textMid }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ fontFamily:'Sora', fontSize:11, color:C.brand, marginTop:10 }}>⚡ Order confirms automatically within 5 minutes of payment</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <Btn label="Back" icon="arrowL" variant="ghost" size="md" onClick={() => setStep(1)} />
                <Btn label="Review Order" iconRight="arrowR" variant="purple" size="lg" style={{ flex:1, justifyContent:'center' }}
                  onClick={() => setStep(3)} />
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '32px', border: `1px solid ${C.borderLight}` }}>
              <h2 style={{ fontFamily: 'Clash Display', fontWeight: 700, fontSize: 22, color: C.bgDark, margin: '0 0 24px' }}>Review Your Order</h2>
              <div style={{ marginBottom: 24 }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display:'flex', gap:14, alignItems:'center', paddingBottom:14, marginBottom:14, borderBottom:`1px solid ${C.borderLight}` }}>
                    <div style={{ width:56, height:56, borderRadius:8, overflow:'hidden', flexShrink:0 }}>
                      <ImgPlaceholder label={item.name} height={56} bg={item.bg} fg={item.fg} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'Sora', fontWeight:600, fontSize:13, color:C.textMid }}>{item.name}</div>
                      <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted }}>Qty: {item.qty}</div>
                    </div>
                    <span style={{ fontFamily:'Clash Display', fontWeight:700, fontSize:15, color:C.primary }}>₦{(item.price*item.qty).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:C.bgAlt, borderRadius:14, padding:'16px 20px', marginBottom:24 }}>
                <div style={{ fontFamily:'Sora', fontWeight:700, fontSize:12, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Delivery To</div>
                <div style={{ fontFamily:'Sora', fontSize:13, color:C.textMid }}>
                  {form.fname||'Chioma'} {form.lname||'Okafor'} · {form.phone||'0801 234 5678'}<br/>
                  {form.address||'123 Admiralty Way'}, {form.city}, {form.state}
                </div>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <Btn label="Back" icon="arrowL" variant="ghost" size="md" onClick={() => setStep(2)} />
                <Btn label={`Place Order · ${fmt(total)}`} variant="primary" size="lg" style={{ flex:1, justifyContent:'center' }}
                  onClick={() => navigate('payment')} />
              </div>
              <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted, textAlign:'center', marginTop:14 }}>
                🔒 Your payment is encrypted and secure
              </div>
            </div>
          )}
        </div>

        {/* Summary Sidebar */}
        <div style={{ background:'#fff', borderRadius:20, padding:'24px', border:`1px solid ${C.borderLight}`, position:'sticky', top:88 }}>
          <h3 style={{ fontFamily:'Clash Display', fontWeight:700, fontSize:18, color:C.bgDark, margin:'0 0 16px' }}>Order Summary</h3>
          {cart.slice(0,3).map(item=>(
            <div key={item.id} style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12 }}>
              <div style={{ width:44, height:44, borderRadius:8, overflow:'hidden', flexShrink:0 }}>
                <ImgPlaceholder label="" height={44} bg={item.bg} fg={item.fg} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'Sora', fontSize:12, color:C.textMid, fontWeight:500 }}>{item.name}</div>
                <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted }}>x{item.qty}</div>
              </div>
              <span style={{ fontFamily:'Sora', fontSize:12, fontWeight:700, color:C.primary }}>₦{(item.price*item.qty).toLocaleString()}</span>
            </div>
          ))}
          {cart.length > 3 && <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted, marginBottom:12 }}>+{cart.length-3} more items</div>}
          <div style={{ borderTop:`1px solid ${C.borderLight}`, paddingTop:14, marginTop:8 }}>
            {[['Subtotal',fmt(subtotal)],['Delivery',delivery===0?'Free':fmt(delivery)],['Total',fmt(total)]].map(([k,v],i)=>(
              <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontFamily:'Sora', fontSize:i===2?14:13, fontWeight:i===2?700:400, color:i===2?C.bgDark:C.muted }}>{k}</span>
                <span style={{ fontFamily:i===2?'Clash Display':'Sora', fontWeight:700, fontSize:i===2?20:13, color:i===2?C.primary:C.textMid }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAYMENT SUCCESS ───────────────────────────────────────────────
function PaymentPage({ navigate }) {
  const [processing, setProcessing] = React.useState(true);
  React.useEffect(() => { const t = setTimeout(() => setProcessing(false), 2000); return () => clearTimeout(t); }, []);
  const orderNum = 'LB-' + Math.floor(Math.random()*90000+10000);

  if (processing) {
    return (
      <div style={{ paddingTop:68, minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:C.bgAlt, border:`3px solid ${C.brand}`,
            borderTopColor:'transparent', margin:'0 auto 24px', animation:'spin 0.8s linear infinite' }} />
          <div style={{ fontFamily:'Clash Display', fontWeight:700, fontSize:22, color:C.bgDark }}>Processing Payment...</div>
          <div style={{ fontFamily:'Sora', fontSize:13, color:C.muted, marginTop:8 }}>Please don't close this page</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ paddingTop:68, minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px' }}>
      <div style={{ background:'#fff', borderRadius:24, padding:'60px 48px', maxWidth:520, width:'100%', textAlign:'center',
        boxShadow:'0 24px 80px rgba(67,0,123,0.1)', border:`1px solid ${C.borderLight}` }}>
        <div style={{ width:88, height:88, borderRadius:'50%', background:C.soft, display:'flex', alignItems:'center', justifyContent:'center',
          margin:'0 auto 28px', border:`1.5px solid ${C.lighter}` }}>
          <Icon name="check" size={36} color={C.brand} strokeWidth={2} />
        </div>
        <h1 style={{ fontFamily:'Clash Display', fontWeight:700, fontSize:34, color:C.bgDark, margin:'0 0 12px' }}>Order Placed!</h1>
        <p style={{ fontFamily:'Sora', fontSize:15, color:C.muted, lineHeight:1.7, margin:'0 0 28px' }}>
          Your order has been confirmed. You'll receive a delivery update via SMS and email.
        </p>
        <div style={{ background:C.bgAlt, borderRadius:14, padding:'16px 24px', marginBottom:28 }}>
          <div style={{ fontFamily:'Sora', fontSize:12, color:C.muted, marginBottom:6 }}>Order Number</div>
          <div style={{ fontFamily:'Clash Display', fontWeight:700, fontSize:22, color:C.primary }}>{orderNum}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[['package','Your order is being prepared',''],['truck','Estimated delivery','30–45 minutes'],['phone','Track via SMS','Updates sent to your phone']].map(([ic,t,s])=>(
            <div key={t} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:C.bgAlt, borderRadius:12, textAlign:'left' }}>
              <Icon name={ic} size={18} color={C.brand} strokeWidth={1.5} />
              <div>
                <div style={{ fontFamily:'Sora', fontWeight:600, fontSize:13, color:C.textMid }}>{t}</div>
                {s && <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted }}>{s}</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:12, marginTop:32 }}>
          <Btn label="Track Order" variant="outline" size="md" style={{ flex:1, justifyContent:'center' }} onClick={()=>navigate('landing')} />
          <Btn label="Continue Shopping" variant="purple" size="md" style={{ flex:1, justifyContent:'center' }} onClick={()=>navigate('shop')} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AuthPage, CartPage, CheckoutPage, PaymentPage });
