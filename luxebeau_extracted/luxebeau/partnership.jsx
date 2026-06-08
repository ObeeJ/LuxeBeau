// LuxeBeau — Partnership Application (Luxury Purple Minimal)

function PartnershipPage({ navigate }) {
  const [role, setRole] = React.useState('seller');
  const [step, setStep] = React.useState(1);
  const [submitted, setSubmitted] = React.useState(false);
  const [form, setForm] = React.useState({
    name:'', email:'', phone:'', city:'Lagos', instagram:'',
    businessName:'', businessType:'individual', productCats:[], bankName:'', accountNumber:'',
    specialty:'', experience:'', serviceArea:'home', bio:'',
  });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const benefits = {
    seller: [
      { icon:'package', title:'Easy Listing', desc:'List unlimited products through a refined seller dashboard.' },
      { icon:'wallet', title:'Fast Payouts', desc:'Settle within 24–48 hours of delivery confirmation.' },
      { icon:'chart', title:'Sales Analytics', desc:'Real-time data on views, conversions and revenue.' },
      { icon:'trend', title:'Marketing Boost', desc:'Featured placement across promotions and category pages.' },
      { icon:'shield', title:'Fraud Protection', desc:'We handle chargebacks and disputes on your behalf.' },
      { icon:'handshake', title:'Dedicated Support', desc:'24/7 seller concierge via chat and phone.' },
    ],
    artisan: [
      { icon:'calendar', title:'Flexible Bookings', desc:'Set your own availability, prices and service area.' },
      { icon:'wallet', title:'Keep 85%', desc:'The lowest commission in the market. Keep 85% per booking.' },
      { icon:'home', title:'Home or Studio', desc:'Offer home visits, studio sessions or both.' },
      { icon:'award', title:'Build Your Brand', desc:'Collect reviews, grow your reputation, own your name.' },
      { icon:'lock', title:'Safe Payments', desc:'All payments secured end to end. No cash required.' },
      { icon:'clock', title:'Smart Scheduling', desc:'One clean dashboard for every appointment.' },
    ],
  };

  const steps = { seller: ['Business Info', 'Products & Categories', 'Banking'], artisan: ['Personal Info', 'Services & Skills', 'Availability'] };
  const totalSteps = 3;

  if (submitted) {
    return (
      <div style={{ paddingTop:72, minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px' }}>
        <div style={{ background:'#fff', borderRadius:28, padding:'64px 52px', maxWidth:520, width:'100%', textAlign:'center',
          boxShadow:`0 32px 80px ${C.primary}15`, border:`1px solid ${C.borderLight}` }}>
          <div style={{ width:84, height:84, borderRadius:'50%', background:C.soft,
            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 32px', color:C.brand }}>
            <Icon name="check" size={38} color="currentColor" strokeWidth={1.8} />
          </div>
          <div style={{ fontFamily:'Sora', fontSize:11, color:C.lighter, letterSpacing:3, textTransform:'uppercase', marginBottom:12 }}>Received</div>
          <h1 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:36, color:C.text, margin:'0 0 16px', letterSpacing:-1 }}>Application Submitted</h1>
          <p style={{ fontFamily:'Sora', fontSize:14, color:C.muted, lineHeight:1.85, margin:'0 0 32px', fontWeight:300 }}>
            Thank you for applying to join LuxeBeau as a <span style={{ color:C.brand, fontWeight:500 }}>{role === 'seller' ? 'Seller' : 'Beauty Artisan'}</span>. Our team will review and respond within 2–3 business days.
          </p>
          <div style={{ background:C.mist, borderRadius:16, padding:'20px 22px', marginBottom:32, textAlign:'left' }}>
            {[['mail','Check your email','Confirmation sent to your inbox'],['phone','WhatsApp','Our team may reach out'],['clock','Review time','2–3 business days']].map(([ic,t,s])=>(
              <div key={t} style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                <span style={{ color:C.brand, display:'flex' }}><Icon name={ic} size={16} color="currentColor" /></span>
                <div>
                  <div style={{ fontFamily:'Sora', fontWeight:500, fontSize:13, color:C.text }}>{t}</div>
                  <div style={{ fontFamily:'Sora', fontSize:11, color:C.muted, marginTop:2 }}>{s}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <Btn label="Back to Home" variant="outline" size="md" style={{ flex:1, justifyContent:'center' }} onClick={()=>navigate('landing')} />
            <Btn label="Learn More" variant="purple" size="md" iconRight="arrowR" style={{ flex:1, justifyContent:'center' }} onClick={()=>navigate('landing')} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop:72, minHeight:'100vh', background:C.bg }}>
      {/* Hero */}
      <div style={{ background:C.bgDark, padding:'96px 56px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-100, right:-100, width:500, height:500, borderRadius:'50%',
          background:C.brand, filter:'blur(140px)', opacity:0.35 }} />
        <div style={{ position:'absolute', bottom:-80, left:100, width:400, height:400, borderRadius:'50%',
          background:C.light, filter:'blur(120px)', opacity:0.2 }} />
        <div style={{ position:'relative', zIndex:2, maxWidth:720, margin:'0 auto', textAlign:'center' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'8px 16px',
            border:`1px solid rgba(184,129,255,0.25)`, borderRadius:999, marginBottom:28,
            background:'rgba(184,129,255,0.06)' }}>
            <Icon name="dot" size={6} color={C.lighter} />
            <span style={{ fontFamily:'Sora', fontSize:11, color:C.lighter, letterSpacing:2, textTransform:'uppercase' }}>Join the LuxeBeau Family</span>
          </div>
          <h1 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:60, color:'#fff', margin:'0 0 24px', lineHeight:1.0, letterSpacing:-2 }}>
            Grow your beauty<br /><em style={{ fontStyle:'italic', color:C.lighter, fontWeight:300 }}>business</em> with us
          </h1>
          <p style={{ fontFamily:'Sora', fontSize:15, color:'rgba(255,255,255,0.6)', lineHeight:1.85, margin:'0 0 40px', fontWeight:300, maxWidth:560, marginLeft:'auto', marginRight:'auto' }}>
            Whether you're a beauty product seller or a skilled artisan, LuxeBeau gives you an audience, tools and support to thrive.
          </p>
          <div style={{ display:'inline-flex', background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.08)', borderRadius:999, padding:6, gap:6 }}>
            {[['seller','store','I\'m a Seller'],['artisan','scissors','I\'m an Artisan']].map(([val,ic,label])=>(
              <div key={val} onClick={()=>{ setRole(val); setStep(1); }}
                style={{ padding:'12px 28px', borderRadius:999, cursor:'pointer', transition:'all 0.25s',
                  background: role===val ? C.lighter : 'transparent',
                  color: role===val ? C.primary : 'rgba(255,255,255,0.7)',
                  fontFamily:'Sora', fontSize:13, fontWeight: role===val ? 500 : 400,
                  display:'inline-flex', alignItems:'center', gap:8 }}>
                <Icon name={ic} size={14} color="currentColor" />{label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ background:'#fff', borderBottom:`1px solid ${C.borderLight}`, padding:'36px 56px' }}>
        <div style={{ display:'flex', justifyContent:'center', gap:80 }}>
          {(role === 'seller'
            ? [['2,400+','Active Sellers'],['₦50M+','Monthly Sales'],['48hrs','Average Payout'],['0%','Listing Fee']]
            : [['2,100+','Active Artisans'],['₦85K','Avg Monthly Earnings'],['85%','Commission Kept'],['24/7','Support Available']]
          ).map(([v,l])=>(
            <div key={l} style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:30, color:C.brand, letterSpacing:-0.5 }}>{v}</div>
              <div style={{ fontFamily:'Sora', fontSize:10, color:C.muted, marginTop:4, letterSpacing:1.5, textTransform:'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, minHeight:'600px' }}>
        {/* Left: Benefits */}
        <div style={{ padding:'80px 56px', background:C.mist, borderRight:`1px solid ${C.borderLight}` }}>
          <SectionHeader tag={role==='seller'?'Seller Benefits':'Artisan Benefits'}
            title={role==='seller'?'Everything you need.':'Build your career.'}
            subtitle={role==='seller'?'The most seller-friendly beauty platform in Nigeria.':'Join thousands of artisans earning more with LuxeBeau.'} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {benefits[role].map((b,i)=>(
              <div key={i} style={{ background:'#fff', borderRadius:16, padding:'24px', border:`1px solid ${C.borderLight}`, transition:'all 0.25s' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.lighter; e.currentTarget.style.boxShadow=`0 12px 32px ${C.primary}10`; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.borderLight; e.currentTarget.style.boxShadow='none'; }}>
                <div style={{ marginBottom:16, color:C.brand }}>
                  <Icon name={b.icon} size={22} color="currentColor" strokeWidth={1.4} />
                </div>
                <div style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:16, color:C.text, marginBottom:8, letterSpacing:-0.2 }}>{b.title}</div>
                <div style={{ fontFamily:'Sora', fontSize:12, color:C.muted, lineHeight:1.75, fontWeight:300 }}>{b.desc}</div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div style={{ marginTop:36, background:C.primary, borderRadius:20, padding:'32px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', right:-60, top:-60, width:240, height:240, borderRadius:'50%', background:C.light, filter:'blur(80px)', opacity:0.35 }} />
            <div style={{ position:'relative' }}>
              <div style={{ fontFamily:'Clash Display', fontSize:48, lineHeight:0.6, marginBottom:16, color:C.lighter, fontWeight:400 }}>“</div>
              <p style={{ fontFamily:'Sora', fontSize:14, color:'rgba(255,255,255,0.85)', lineHeight:1.85, margin:'0 0 20px', fontStyle:'italic', fontWeight:300 }}>
                {role === 'seller'
                  ? 'Since joining LuxeBeau, my skincare brand went from 20 orders a month to over 300. The platform quietly does the marketing for you.'
                  : 'I used to hustle for clients on Instagram. Now I get 15+ bookings weekly just from LuxeBeau. My income tripled in 6 months.'}
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:42, height:42, borderRadius:'50%', background:C.lighter,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Clash Display', fontWeight:500, color:C.primary }}>
                  {role==='seller'?'F':'C'}
                </div>
                <div>
                  <div style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:14, color:'#fff' }}>{role==='seller'?'Funmi Okafor':'Chidinma Obi'}</div>
                  <div style={{ fontFamily:'Sora', fontSize:11, color:'rgba(255,255,255,0.55)', letterSpacing:1.2, textTransform:'uppercase', marginTop:2 }}>{role==='seller'?'GlowSkin · Lagos':'Hairstylist · Abuja'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Application Form */}
        <div style={{ padding:'80px 56px', background:'#fff' }}>
          <div style={{ marginBottom:40 }}>
            <div style={{ fontFamily:'Sora', fontSize:11, color:C.lighter, letterSpacing:2.5, textTransform:'uppercase', marginBottom:10 }}>Step {step} of {totalSteps}</div>
            <h2 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:32, color:C.text, margin:'0 0 8px', letterSpacing:-0.8 }}>
              Apply as a {role==='seller'?'Seller':'Beauty Artisan'}
            </h2>
            <p style={{ fontFamily:'Sora', fontSize:13, color:C.muted, margin:'0 0 28px', fontWeight:300 }}>
              {steps[role][step-1]}
            </p>

            {/* Progress */}
            <div style={{ display:'flex', gap:6 }}>
              {Array.from({length:totalSteps}).map((_,i)=>(
                <div key={i} style={{ flex:1, height:2, borderRadius:1, background: step>i ? C.brand : C.borderLight, transition:'background 0.3s' }} />
              ))}
            </div>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Full Name</div>
                <TextInput placeholder={role==='seller'?'Funmi Okafor':'Chidinma Adeyemi'} value={form.name} onChange={set('name')} icon="user" />
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Email Address</div>
                <TextInput placeholder="your@email.com" value={form.email} onChange={set('email')} type="email" icon="mail" />
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Phone Number</div>
                <TextInput placeholder="0801 234 5678" value={form.phone} onChange={set('phone')} icon="phone" />
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>City</div>
                <Select value={form.city} onChange={set('city')} options={['Lagos','Abuja','Port Harcourt','Ibadan','Kano','Enugu','Benin City']} sx={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Instagram (optional)</div>
                <TextInput placeholder="@yourhandle" value={form.instagram} onChange={set('instagram')} icon="instagram" />
              </div>
              {role === 'seller' && (
                <div>
                  <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Business Name</div>
                  <TextInput placeholder="e.g. GlowSkin Store" value={form.businessName} onChange={set('businessName')} icon="store" />
                </div>
              )}
              {role === 'artisan' && (
                <>
                  <div>
                    <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Primary Specialty</div>
                    <Select value={form.specialty} onChange={set('specialty')}
                      options={['Hairstylist','Makeup Artist','Nail Technician','Skincare Specialist','Barber','Lash Technician','Brow Artist']}
                      sx={{ width:'100%' }} />
                  </div>
                  <div>
                    <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Years of Experience</div>
                    <Select value={form.experience} onChange={set('experience')}
                      options={['Less than 1 year','1–2 years','3–5 years','6–10 years','10+ years']}
                      sx={{ width:'100%' }} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2 - Seller */}
          {step === 2 && role === 'seller' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:12, letterSpacing:1.5, textTransform:'uppercase' }}>Product Categories</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {['Skincare','Makeup','Hair Care',"Men's Grooming",'Fragrance','Nail Care','Wellness','Tools & Accessories'].map(cat=>{
                    const on = form.productCats.includes(cat);
                    return (
                      <div key={cat} onClick={()=> setForm(f=>({ ...f, productCats: on ? f.productCats.filter(c=>c!==cat) : [...f.productCats,cat] }))}
                        style={{ padding:'12px 16px', borderRadius:10, cursor:'pointer', transition:'all 0.2s',
                          border:`1px solid ${on?C.brand:C.borderLight}`,
                          background: on ? C.mist : '#fff',
                          fontFamily:'Sora', fontSize:12, fontWeight: on?500:400,
                          color: on?C.brand:C.textMid, display:'flex', alignItems:'center', gap:8 }}>
                        {on && <Icon name="check" size={13} color={C.brand} />}{cat}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:10, letterSpacing:1.5, textTransform:'uppercase' }}>Business Type</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[['individual','user','Individual'],['business','store','Registered Business']].map(([val,ic,label])=>(
                    <div key={val} onClick={()=>setForm(f=>({...f,businessType:val}))}
                      style={{ padding:'14px', textAlign:'center', borderRadius:10, cursor:'pointer',
                        border:`1px solid ${form.businessType===val?C.brand:C.borderLight}`,
                        background: form.businessType===val?C.mist:'#fff',
                        fontFamily:'Sora', fontSize:13, fontWeight: form.businessType===val?500:400,
                        color: form.businessType===val?C.brand:C.textMid, transition:'all 0.2s',
                        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', boxSizing:'border-box' }}>
                      <Icon name={ic} size={14} color="currentColor" />{label}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Product Volume</div>
                <Select value="" onChange={()=>{}} options={['Select volume','1–10 products','11–50 products','51–200 products','200+ products']} sx={{ width:'100%' }} />
              </div>
              <div style={{ background:C.mist, borderRadius:12, padding:'18px 20px', border:`1px solid ${C.soft}` }}>
                <div style={{ fontFamily:'Sora', fontSize:12, fontWeight:500, color:C.brand, marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
                  <Icon name="eye" size={14} color="currentColor" />Product Photos
                </div>
                <div style={{ fontFamily:'Sora', fontSize:12, color:C.muted, fontWeight:300, lineHeight:1.7 }}>Upload product photos after approval. JPG or PNG up to 10MB per image.</div>
              </div>
            </div>
          )}

          {/* Step 2 - Artisan */}
          {step === 2 && role === 'artisan' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:12, letterSpacing:1.5, textTransform:'uppercase' }}>Services Offered</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {['Box Braids','Knotless Braids','Wig Installation','Natural Styles','Locs','Makeup (Glam)','Makeup (Bridal)','Gel Nails','Acrylic Nails','Facial','Haircut','Beard Trim'].map(svc=>(
                    <div key={svc} style={{ padding:'11px 14px', borderRadius:8, cursor:'pointer', transition:'all 0.2s',
                      border:`1px solid ${C.borderLight}`, background:'#fff',
                      fontFamily:'Sora', fontSize:12, color:C.textMid }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.brand; e.currentTarget.style.background=C.mist; e.currentTarget.style.color=C.brand; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.borderLight; e.currentTarget.style.background='#fff'; e.currentTarget.style.color=C.textMid; }}>{svc}</div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Short Bio</div>
                <textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))}
                  placeholder="Tell clients about yourself and your style..." rows={4}
                  style={{ width:'100%', padding:'14px 18px', border:`1px solid ${C.border}`, borderRadius:12, boxSizing:'border-box',
                    fontFamily:'Sora', fontSize:13, color:C.text, resize:'vertical', outline:'none', lineHeight:1.7, background:'#fff' }} />
              </div>
            </div>
          )}

          {/* Step 3 - Seller */}
          {step === 3 && role === 'seller' && (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div style={{ background:C.mist, borderRadius:14, padding:'18px 22px', border:`1px solid ${C.soft}` }}>
                <div style={{ fontFamily:'Sora', fontWeight:500, fontSize:13, color:C.brand, marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
                  <Icon name="lock" size={14} color="currentColor" />Banking details are encrypted and secure
                </div>
                <div style={{ fontFamily:'Sora', fontSize:12, color:C.muted, fontWeight:300, lineHeight:1.7 }}>Bank-level encryption. Your details are never shared.</div>
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Bank Name</div>
                <Select value={form.bankName} onChange={set('bankName')}
                  options={['Select bank','Access Bank','GTBank','First Bank','UBA','Zenith Bank','FCMB','Wema Bank','Kuda Bank','Opay','Palmpay']}
                  sx={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Account Number</div>
                <TextInput placeholder="0123456789" value={form.accountNumber} onChange={set('accountNumber')} icon="bank" />
              </div>
              <div style={{ background:'#fff', borderRadius:14, padding:'22px', border:`1px solid ${C.borderLight}` }}>
                <div style={{ fontFamily:'Sora', fontWeight:500, fontSize:12, color:C.text, marginBottom:14, letterSpacing:1.5, textTransform:'uppercase' }}>Commission Structure</div>
                {[['0–₦500K / month','8%'],['₦500K–₦2M / month','6%'],['₦2M+ / month','4%']].map(([tier,fee])=>(
                  <div key={tier} style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:`1px solid ${C.borderLight}` }}>
                    <span style={{ fontFamily:'Sora', fontSize:13, color:C.textMid, fontWeight:300 }}>{tier}</span>
                    <span style={{ fontFamily:'Clash Display', fontSize:15, fontWeight:500, color:C.brand }}>{fee}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <input type="checkbox" id="terms" style={{ marginTop:2, accentColor:C.brand }} />
                <label htmlFor="terms" style={{ fontFamily:'Sora', fontSize:12, color:C.muted, lineHeight:1.7, cursor:'pointer', fontWeight:300 }}>
                  I agree to LuxeBeau's <span style={{ color:C.brand }}>Seller Terms</span> and <span style={{ color:C.brand }}>Privacy Policy</span>.
                </label>
              </div>
            </div>
          )}

          {/* Step 3 - Artisan */}
          {step === 3 && role === 'artisan' && (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:10, letterSpacing:1.5, textTransform:'uppercase' }}>Service Area</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  {[['home','home','Home'],['studio','store','Studio'],['both','location','Both']].map(([val,ic,label])=>(
                    <div key={val} onClick={()=>setForm(f=>({...f,serviceArea:val}))}
                      style={{ padding:'14px', textAlign:'center', borderRadius:10, cursor:'pointer',
                        border:`1px solid ${form.serviceArea===val?C.brand:C.borderLight}`,
                        background: form.serviceArea===val?C.mist:'#fff',
                        fontFamily:'Sora', fontSize:12, fontWeight: form.serviceArea===val?500:400,
                        color: form.serviceArea===val?C.brand:C.textMid, transition:'all 0.2s',
                        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <Icon name={ic} size={13} color="currentColor" />{label}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Bank for Payouts</div>
                <Select value={form.bankName} onChange={set('bankName')}
                  options={['Select bank','Access Bank','GTBank','First Bank','UBA','Zenith Bank','Kuda Bank','Opay','Palmpay']} sx={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.textMid, marginBottom:8, letterSpacing:1.5, textTransform:'uppercase' }}>Account Number</div>
                <TextInput placeholder="0123456789" value={form.accountNumber} onChange={set('accountNumber')} icon="bank" />
              </div>
              <div style={{ background:'#fff', borderRadius:14, padding:'22px', border:`1px solid ${C.borderLight}` }}>
                <div style={{ fontFamily:'Sora', fontWeight:500, fontSize:12, color:C.text, marginBottom:10, letterSpacing:1.5, textTransform:'uppercase' }}>Commission</div>
                <div style={{ fontFamily:'Sora', fontSize:14, color:C.muted, lineHeight:1.75, fontWeight:300 }}>
                  LuxeBeau keeps <span style={{ color:C.brand, fontWeight:500 }}>15%</span> per booking. You keep 85%. Payouts every 48 hours.
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <input type="checkbox" id="aterms" style={{ marginTop:2, accentColor:C.brand }} />
                <label htmlFor="aterms" style={{ fontFamily:'Sora', fontSize:12, color:C.muted, lineHeight:1.7, cursor:'pointer', fontWeight:300 }}>
                  I agree to LuxeBeau's <span style={{ color:C.brand }}>Artisan Terms</span>.
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', gap:12, marginTop:40 }}>
            {step > 1 && <Btn label="Back" variant="ghost" size="md" icon="arrowL" onClick={()=>setStep(s=>s-1)} />}
            {step < totalSteps
              ? <Btn label="Continue" variant="purple" size="lg" iconRight="arrowR" style={{ flex:1, justifyContent:'center' }} onClick={()=>setStep(s=>s+1)} />
              : <Btn label="Submit Application" variant="accent" size="lg" iconRight="check" style={{ flex:1, justifyContent:'center' }} onClick={()=>setSubmitted(true)} />
            }
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PartnershipPage });
