// LuxeBeau — Landing Page (Luxury Purple Minimal)

function LandingPage({ navigate, addToCart }) {
  const stats = [
    { value:'50K+', label:'Customers' },
    { value:'2,000+', label:'Artisans' },
    { value:'30 min', label:'Avg Delivery' },
    { value:'99%', label:'Satisfaction' },
  ];

  const howItWorks = [
    { step:'01', icon:'search', title:'Browse & Discover', desc:'Explore curated beauty products and skilled artisans across Nigeria.' },
    { step:'02', icon:'bag', title:'Order or Book', desc:'Add products to cart or schedule a home or studio service.' },
    { step:'03', icon:'sparkle', title:'Enjoy the Experience', desc:'Products delivered in 30 minutes. Artisans arrive on time.' },
  ];

  const whyUs = [
    { icon:'truck', title:'Swift Delivery', desc:'30-minute delivery across major cities.' },
    { icon:'shield', title:'Secure Payment', desc:'Bank-grade encryption on every transaction.' },
    { icon:'award', title:'Curated Quality', desc:'Every product and artisan verified by our team.' },
    { icon:'sparkle', title:'Exceptional Care', desc:'24/7 concierge support for every order.' },
  ];

  const featured = PRODUCTS.slice(0, 4);
  const featuredArtisans = ARTISANS.slice(0, 3);

  const categories = [
    { label:'Skincare', icon:'leaf' },
    { label:'Makeup', icon:'palette' },
    { label:'Hair', icon:'scissors' },
    { label:'Fragrance', icon:'sparkle' },
    { label:"Men's", icon:'user' },
    { label:'Nails', icon:'star' },
    { label:'Tools', icon:'settings' },
    { label:'Wellness', icon:'heart' },
  ];

  return (
    <div style={{ background:C.bg, minHeight:'100vh' }}>

      {/* ── HERO ── */}
      <section style={{ background:C.bgDark, minHeight:'100vh', position:'relative', overflow:'hidden',
        display:'flex', alignItems:'center', justifyContent:'center', paddingTop:120, paddingBottom:80 }}>
        {/* Ambient purple glows */}
        <div style={{ position:'absolute', left:'50%', top:'10%', width:700, height:700, borderRadius:'50%',
          transform:'translateX(-50%)',
          background:C.brand, filter:'blur(160px)', opacity:0.32, pointerEvents:'none' }} />
        <div style={{ position:'absolute', left:'50%', bottom:'-20%', width:600, height:600, borderRadius:'50%',
          transform:'translateX(-50%)',
          background:C.light, filter:'blur(140px)', opacity:0.18, pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:2, width:'100%', maxWidth:880, padding:'0 56px',
          display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
          <h1 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:96, color:'#fff',
            lineHeight:0.98, margin:'0 0 28px', letterSpacing:-3.5 }}>
            Beauty,{' '}
            <em style={{ fontStyle:'italic', color:C.lighter, fontWeight:300 }}>considered.</em><br />
            At your door.
          </h1>

          <p style={{ fontFamily:'Sora', fontSize:17, color:'rgba(255,255,255,0.6)',
            lineHeight:1.85, margin:'0 0 44px', maxWidth:520, fontWeight:300 }}>
            A refined marketplace for premium beauty products and skilled artisans.
            Delivered with the care you deserve.
          </p>

          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:72, justifyContent:'center' }}>
            <Btn label="Shop the Collection" variant="accent" size="lg" onClick={()=>navigate('shop')} iconRight="arrowR" />
            <Btn label="Book an Artisan" variant="white" size="lg" onClick={()=>navigate('services')} />
          </div>

          <div style={{ display:'flex', gap:64, justifyContent:'center', flexWrap:'wrap' }}>
            {stats.map(s=>(
              <div key={s.label} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:28, color:'#fff', letterSpacing:-0.5 }}>{s.value}</div>
                <div style={{ fontFamily:'Sora', fontSize:11, color:'rgba(255,255,255,0.4)',
                  marginTop:4, letterSpacing:1.5, textTransform:'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORY STRIP ── */}
      <section style={{ background:'#fff', padding:'48px 56px', borderBottom:`1px solid ${C.borderLight}` }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', overflowX:'auto' }} className="no-scrollbar">
          <span style={{ fontFamily:'Sora', fontSize:11, fontWeight:500, color:C.muted,
            whiteSpace:'nowrap', marginRight:16, letterSpacing:2, textTransform:'uppercase' }}>Shop</span>
          {categories.map(cat=>(
            <div key={cat.label} onClick={()=>navigate('shop')}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 22px', borderRadius:999,
                border:`1px solid ${C.borderLight}`, background:'#fff', cursor:'pointer', whiteSpace:'nowrap',
                fontFamily:'Sora', fontSize:13, color:C.textMid, fontWeight:400, transition:'all 0.25s', flexShrink:0 }}
              onMouseEnter={e=>{ e.currentTarget.style.background=C.mist; e.currentTarget.style.borderColor=C.lighter; e.currentTarget.style.color=C.brand; }}
              onMouseLeave={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor=C.borderLight; e.currentTarget.style.color=C.textMid; }}>
              <Icon name={cat.icon} size={14} color="currentColor" />
              {cat.label}
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ── */}
      <section style={{ padding:'112px 56px', background:C.bg }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:64 }}>
          <SectionHeader tag="The Edit" title={"Essentials."} subtitle="A quiet edit of the season's most loved beauty objects." />
          <Btn label="View Collection" variant="ghost" size="sm" onClick={()=>navigate('shop')} iconRight="arrowR" />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24 }}>
          {featured.map(p=>(
            <ProductCard key={p.id} p={p} navigate={navigate} addToCart={addToCart} />
          ))}
        </div>
      </section>

      {/* ── SERVICES EDITORIAL ── */}
      <section style={{ margin:'0 56px 112px', borderRadius:32, overflow:'hidden', position:'relative',
        background:C.primary, padding:'96px 80px', minHeight:480 }}>
        <div style={{ position:'absolute', left:-100, top:-60, width:500, height:500, borderRadius:'50%',
          background:C.brand, filter:'blur(120px)', opacity:0.5 }} />
        <div style={{ position:'absolute', right:-80, bottom:-80, width:400, height:400, borderRadius:'50%',
          background:C.light, filter:'blur(100px)', opacity:0.25 }} />

        <div style={{ position:'relative', zIndex:2, maxWidth:560 }}>
          <div style={{ fontFamily:'Sora', fontSize:11, color:C.lighter, letterSpacing:3,
            textTransform:'uppercase', marginBottom:20 }}>Home & Studio Services</div>
          <h2 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:60, color:'#fff',
            lineHeight:1.0, margin:'0 0 24px', letterSpacing:-2 }}>
            Skilled hands,<br /><em style={{ fontStyle:'italic', color:C.lighter, fontWeight:300 }}>delivered.</em>
          </h2>
          <p style={{ fontFamily:'Sora', fontSize:15, color:'rgba(255,255,255,0.65)',
            lineHeight:1.85, margin:'0 0 40px', maxWidth:460, fontWeight:300 }}>
            Two thousand verified artisans — hairstylists, makeup artists, nail specialists and more.
            They come to you, or you to them.
          </p>
          <div style={{ display:'flex', gap:12 }}>
            <Btn label="Explore Artisans" variant="white" size="lg" onClick={()=>navigate('artisans')} iconRight="arrowR" />
          </div>
        </div>

        <div style={{ position:'absolute', right:80, top:'50%', transform:'translateY(-50%)',
          display:'flex', flexDirection:'column', gap:14, zIndex:2 }}>
          {featuredArtisans.map((a,i)=>(
            <div key={a.id} onClick={()=>navigate('artisan',a)}
              style={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(24px)',
                border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'18px 22px',
                minWidth:240, cursor:'pointer', display:'flex', alignItems:'center', gap:14,
                transform: i===1?'translateX(-24px)':'none', transition:'all 0.25s' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:a.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Clash Display', fontWeight:500, fontSize:16, color:C.brand, flexShrink:0 }}>
                {a.name.split(' ').map(n=>n[0]).join('')}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:15, color:'#fff' }}>{a.name.split(' ')[0]}</div>
                <div style={{ fontFamily:'Sora', fontSize:10, color:'rgba(255,255,255,0.55)',
                  letterSpacing:1, textTransform:'uppercase', marginTop:2 }}>{a.specialty}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <Icon name="starFill" size={11} color={C.lighter} />
                <span style={{ fontFamily:'Sora', fontSize:12, color:'#fff', fontWeight:500 }}>{a.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding:'112px 56px', background:'#fff' }}>
        <SectionHeader tag="The Process" title="Three Quiet Steps" subtitle="Elevated beauty, delivered without friction." center />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:32, maxWidth:1200, margin:'0 auto' }}>
          {howItWorks.map((s,i)=>(
            <div key={i} style={{ padding:'48px 40px', borderRadius:20, position:'relative', overflow:'hidden',
              background: i===1 ? C.primary : C.mist,
              border: i!==1 ? `1px solid ${C.soft}` : 'none', transition:'all 0.3s' }}>
              {i===1 && <div style={{ position:'absolute', left:-40, top:-40, width:200, height:200, borderRadius:'50%',
                background:C.light, filter:'blur(60px)', opacity:0.4 }} />}
              <div style={{ position:'relative', zIndex:1 }}>
                <div style={{ fontFamily:'Clash Display', fontWeight:300, fontSize:14,
                  color: i===1 ? 'rgba(255,255,255,0.4)' : C.muted,
                  marginBottom:24, letterSpacing:3, textTransform:'uppercase' }}>{s.step}</div>
                <div style={{ width:56, height:56, borderRadius:'50%',
                  background: i===1 ? 'rgba(255,255,255,0.1)' : '#fff',
                  display:'flex', alignItems:'center', justifyContent:'center', marginBottom:28,
                  border: i!==1 ? `1px solid ${C.soft}` : 'none' }}>
                  <Icon name={s.icon} size={22} color={i===1 ? C.lighter : C.brand} strokeWidth={1.4} />
                </div>
                <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:24,
                  color: i===1 ? '#fff' : C.text, margin:'0 0 14px', letterSpacing:-0.5 }}>{s.title}</h3>
                <p style={{ fontFamily:'Sora', fontSize:14, fontWeight:300,
                  color: i===1 ? 'rgba(255,255,255,0.65)' : C.muted,
                  lineHeight:1.8, margin:0 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY LUXEBEAU — editorial split ── */}
      <section style={{ padding:'112px 56px', background:C.bg }}>
        <div style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:96, alignItems:'center', maxWidth:1400, margin:'0 auto' }}>
          <div>
            <SectionHeader tag="The Difference" title={"Considered,\nnot compromised."} subtitle="Every detail — from selection to delivery — tuned to the beauty consumer who expects more." />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0,
              borderTop:`1px solid ${C.borderLight}`, borderLeft:`1px solid ${C.borderLight}` }}>
              {whyUs.map((w,i)=>(
                <div key={i} style={{ padding:'28px 28px', background:'#fff',
                  borderRight:`1px solid ${C.borderLight}`, borderBottom:`1px solid ${C.borderLight}`,
                  transition:'background 0.25s' }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.mist}
                  onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                  <div style={{ marginBottom:16, color:C.brand }}>
                    <Icon name={w.icon} size={22} color="currentColor" strokeWidth={1.4} />
                  </div>
                  <div style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:17, color:C.text, marginBottom:8, letterSpacing:-0.3 }}>{w.title}</div>
                  <div style={{ fontFamily:'Sora', fontSize:13, color:C.muted, lineHeight:1.7, fontWeight:300 }}>{w.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, height:560 }}>
            <div style={{ gridRow:'1 / 3', borderRadius:20, overflow:'hidden' }}>
              <ImgPlaceholder label="Editorial flat lay" height="100%" bg={C.soft} fg={C.brand} icon="sparkle" />
            </div>
            <div style={{ borderRadius:20, overflow:'hidden' }}>
              <ImgPlaceholder label="Artisan portrait" height="100%" bg={C.brand} fg={C.lighter} icon="scissors" />
            </div>
            <div style={{ borderRadius:20, overflow:'hidden' }}>
              <ImgPlaceholder label="Studio moment" height="100%" bg={C.bgDark} fg={C.lighter} icon="palette" />
            </div>
          </div>
        </div>
      </section>

      {/* ── PARTNER CTA ── */}
      <section style={{ padding:'0 56px 112px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
        {[
          { title:'Sell on LuxeBeau', desc:'Reach a discerning audience across Nigeria. Low commissions, fast payouts, serious customers.', cta:'Start Selling', icon:'store', bg:C.primary },
          { title:'Become an Artisan', desc:'Offer your services to clients who value your craft. Set your terms, build your name.', cta:'Apply Now', icon:'scissors', bg:C.brand },
        ].map((item,i)=>(
          <div key={i} style={{ background:item.bg, borderRadius:24, padding:'64px 56px',
            position:'relative', overflow:'hidden', minHeight:340 }}>
            <div style={{ position:'absolute', right:-40, bottom:-40, width:300, height:300, borderRadius:'50%',
              background: i===0?C.light:C.lighter, filter:'blur(80px)', opacity:0.3 }} />
            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(255,255,255,0.12)',
                border:'1px solid rgba(255,255,255,0.2)',
                display:'flex', alignItems:'center', justifyContent:'center', marginBottom:28 }}>
                <Icon name={item.icon} size={22} color="#fff" strokeWidth={1.4} />
              </div>
              <h3 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:36, color:'#fff',
                margin:'0 0 16px', letterSpacing:-1 }}>{item.title}</h3>
              <p style={{ fontFamily:'Sora', fontSize:14, color:'rgba(255,255,255,0.65)',
                lineHeight:1.8, margin:'0 0 36px', maxWidth:360, fontWeight:300 }}>{item.desc}</p>
              <Btn label={item.cta} variant="white" size="md" onClick={()=>navigate('partnership')} iconRight="arrowR" />
            </div>
          </div>
        ))}
      </section>

      {/* ── NEWSLETTER ── */}
      <section style={{ margin:'0 56px 112px', borderRadius:32, background:C.bgDark,
        padding:'80px 80px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:48,
        position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:-100, top:-100, width:400, height:400, borderRadius:'50%',
          background:C.brand, filter:'blur(120px)', opacity:0.4 }} />
        <div style={{ maxWidth:480, position:'relative' }}>
          <div style={{ fontFamily:'Sora', fontSize:11, color:C.lighter, letterSpacing:3,
            textTransform:'uppercase', marginBottom:16 }}>The List</div>
          <h2 style={{ fontFamily:'Clash Display', fontWeight:400, fontSize:44, color:'#fff',
            margin:'0 0 14px', lineHeight:1.1, letterSpacing:-1 }}>
            Ten percent off,<br /><em style={{ fontStyle:'italic', color:C.lighter, fontWeight:300 }}>on us.</em>
          </h2>
          <p style={{ fontFamily:'Sora', fontSize:14, color:'rgba(255,255,255,0.5)',
            lineHeight:1.75, margin:0, fontWeight:300 }}>
            Beauty notes, editor picks and private sales. Delivered once a week.
          </p>
        </div>
        <div style={{ display:'flex', gap:12, flex:1, maxWidth:440, position:'relative' }}>
          <TextInput placeholder="your@email.com" sx={{ flex:1 }} icon="mail" />
          <Btn label="Subscribe" variant="accent" size="md" iconRight="arrowR" />
        </div>
      </section>

    </div>
  );
}

Object.assign(window, { LandingPage });
