// LuxeBeau — Shared tokens, data, icons & UI primitives (LUXURY MINIMAL PURPLE)

// Strict purple palette — no other hues
const C = {
  // Core purples
  primary:  '#2E0054',   // deepest royal purple
  brand:    '#43007B',   // rich purple (brand)
  deep:     '#6400B8',   // mid-purple for hover/active
  light:    '#9747FF',   // luminous purple
  lighter:  '#B881FF',   // lavender-purple
  soft:     '#E9DEFF',   // ultra-soft lavender
  mist:     '#F5EEFF',   // misty purple bg
  ivory:    '#FAF8FC',   // purple-tinted off-white
  // Accent (still under purple)
  accent:   '#B881FF',   // lavender accent
  accentDk: '#9747FF',

  // Surfaces
  bg:       '#FAF8FC',
  bgAlt:    '#F5EEFF',
  bgDark:   '#120025',   // near-black purple
  card:     '#FFFFFF',

  // Text
  text:     '#1A0B2E',   // near-black purple
  textMid:  '#3D2B5A',
  muted:    '#7A6B8E',   // muted purple-gray
  subtle:   '#B8AEC7',

  // Lines
  border:      '#E0D4EE',
  borderLight: '#EEE6F7',

  // Status (desaturated, restrained)
  success: '#6B9B6B',
  error:   '#A84B4B',
  warning: '#B38A4A',
};

const PRODUCTS = [
  { id:1, name:'Shea Butter Glow Cream', brand:'SheaGlow', price:4500, original:6000, category:'skincare', rating:4.8, reviews:124, badge:'Bestseller', bg:'#E9DEFF', fg:'#3D2B5A' },
  { id:2, name:'African Black Soap', brand:'NaturGlow', price:2800, original:null, category:'skincare', rating:4.6, reviews:89, badge:null, bg:'#2E0054', fg:'#fff' },
  { id:3, name:'Cantu Curl Activator', brand:'Cantu', price:5200, original:6500, category:'hair', rating:4.7, reviews:210, badge:'Sale', bg:'#B881FF', fg:'#1A0B2E' },
  { id:4, name:'MAC Studio Fix Foundation', brand:'MAC', price:18000, original:null, category:'makeup', rating:4.9, reviews:302, badge:'Top Pick', bg:'#43007B', fg:'#fff' },
  { id:5, name:'Zaron Lavender Body Mist', brand:'Zaron', price:3200, original:null, category:'fragrance', rating:4.5, reviews:67, badge:null, bg:'#F5EEFF', fg:'#43007B' },
  { id:6, name:'Knotless Braids Hair Pack', brand:'XpressWeave', price:7500, original:9000, category:'hair', rating:4.4, reviews:156, badge:'Sale', bg:'#120025', fg:'#B881FF' },
  { id:7, name:'Rosehip Brightening Serum', brand:'GlowLab', price:8900, original:null, category:'skincare', rating:4.8, reviews:93, badge:'New', bg:'#9747FF', fg:'#fff' },
  { id:8, name:'Lip Gloss Set (6 Shades)', brand:'Zaron', price:4200, original:5500, category:'makeup', rating:4.6, reviews:178, badge:'Bundle', bg:'#E9DEFF', fg:'#3D2B5A' },
  { id:9, name:"Men's Grooming Kit", brand:'GroomNaija', price:6500, original:null, category:'mens', rating:4.7, reviews:112, badge:'New', bg:'#3D2B5A', fg:'#fff' },
  { id:10, name:'Activated Charcoal Mask', brand:'PureGlow', price:3800, original:4500, category:'skincare', rating:4.5, reviews:203, badge:'Sale', bg:'#1A0B2E', fg:'#B881FF' },
  { id:11, name:'Vitamin C Eye Cream', brand:'GlowLab', price:7200, original:null, category:'skincare', rating:4.7, reviews:78, badge:null, bg:'#F5EEFF', fg:'#43007B' },
  { id:12, name:'Natural Beard Oil', brand:'GroomNaija', price:2500, original:null, category:'mens', rating:4.8, reviews:145, badge:'Bestseller', bg:'#6400B8', fg:'#fff' },
];

const ARTISANS = [
  { id:1, name:'Chidinma Okafor', specialty:'Hairstylist', rating:4.9, reviews:234, location:'Lekki, Lagos', price:8000, services:['Box Braids','Knotless Braids','Loc Maintenance','Wig Installation'], available:true, bg:'#E9DEFF', exp:'5 yrs', done:412 },
  { id:2, name:'Amara Nwosu', specialty:'Makeup Artist', rating:4.8, reviews:189, location:'Victoria Island, Lagos', price:15000, services:['Bridal Makeup','Editorial','Natural Glam','Party Look'], available:true, bg:'#B881FF', exp:'7 yrs', done:356 },
  { id:3, name:'Fatima Abdullahi', specialty:'Nail Technician', rating:4.7, reviews:145, location:'Wuse, Abuja', price:6000, services:['Gel Nails','Acrylic Nails','Nail Art','Manicure'], available:false, bg:'#F5EEFF', exp:'4 yrs', done:298 },
  { id:4, name:'Blessing Eze', specialty:'Skincare Specialist', rating:4.9, reviews:98, location:'Ikeja, Lagos', price:12000, services:['Facial','Chemical Peel','Hydrafacial','Brightening'], available:true, bg:'#9747FF', exp:'6 yrs', done:187 },
  { id:5, name:'Emeka Obi', specialty:'Barber', rating:4.8, reviews:312, location:'Surulere, Lagos', price:3500, services:['Haircut','Fade','Shape Up','Beard Trim'], available:true, bg:'#43007B', exp:'8 yrs', done:892 },
  { id:6, name:'Tolu Adeyemi', specialty:'Hairstylist', rating:4.7, reviews:167, location:'Gbagada, Lagos', price:7000, services:['Relaxer','Natural Styles','Weave','Cornrows'], available:true, bg:'#E9DEFF', exp:'5 yrs', done:345 },
];

const PRODUCT_CATS = ['All','Skincare','Makeup','Hair','Fragrance',"Men's"];
const SERVICE_CATS = ['All Services','Hairstyling','Makeup','Nails','Skincare','Barber'];

// ─── Icons (SVG line icons, minimal) ─────────────────────────────
function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.6, style = {} }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'inline-block', flexShrink: 0, ...style } };
  const paths = {
    cart:     <><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>,
    search:   <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    heart:    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
    plus:     <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    minus:    <path d="M5 12h14"/>,
    check:    <path d="M20 6 9 17l-5-5"/>,
    x:        <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    arrowR:   <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
    arrowL:   <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
    chevR:    <path d="m9 18 6-6-6-6"/>,
    chevL:    <path d="m15 18-6-6 6-6"/>,
    chevD:    <path d="m6 9 6 6 6-6"/>,
    location: <><path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>,
    mail:     <><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/></>,
    phone:    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>,
    lock:     <><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    card:     <><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></>,
    bank:     <><path d="M3 10h18L12 3 3 10z"/><path d="M5 10v8"/><path d="M10 10v8"/><path d="M14 10v8"/><path d="M19 10v8"/><path d="M3 21h18"/></>,
    wallet:   <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></>,
    sparkle:  <><path d="m12 3-1.5 6L4 10.5 10.5 12 12 18l1.5-6L20 10.5 13.5 9z"/></>,
    star:     <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
    starFill: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={color} />,
    package:  <><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22.08V12"/></>,
    truck:    <><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
    shield:   <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>,
    chart:    <><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16v-4"/><path d="M11 16V8"/><path d="M15 16v-6"/><path d="M19 16v-2"/></>,
    bag:      <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
    store:    <><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4l-2 2-3-2-3 2-3-2-3 2-2-2z"/><path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/></>,
    scissors: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/></>,
    home:     <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>,
    calendar: <><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></>,
    clock:    <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    instagram:<><rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></>,
    x_social: <><path d="M4 4l16 16"/><path d="M20 4 4 20"/></>,
    play:     <polygon points="5 3 19 12 5 21 5 3"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    menu:     <><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></>,
    users:    <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    bell:     <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    handshake:<><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></>,
    palette:  <><circle cx="13.5" cy="6.5" r=".5" fill={color}/><circle cx="17.5" cy="10.5" r=".5" fill={color}/><circle cx="8.5" cy="7.5" r=".5" fill={color}/><circle cx="6.5" cy="12.5" r=".5" fill={color}/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></>,
    flame:    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>,
    ticket:   <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>,
    award:    <><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></>,
    trend:    <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
    leaf:     <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96a1 1 0 0 1 1.8.58V10a10 10 0 0 1-10 10z"/>,
    grid:     <><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></>,
    filter:   <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>,
    eye:      <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    book:     <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>,
    logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></>,
    dot:      <circle cx="12" cy="12" r="4" fill={color}/>,
    pin:      <><path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>,
    briefcase:<><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}

// ─── Primitive UI ────────────────────────────────────────────────

function ImgPlaceholder({ label, height=220, bg='#E9DEFF', fg='#43007B', radius=0, icon }) {
  return (
    <div style={{ width:'100%', height, borderRadius:radius, overflow:'hidden', position:'relative',
      background:bg, display:'flex', alignItems:'center', justifyContent:'center',
      backgroundImage:`linear-gradient(135deg, ${bg} 0%, ${bg}dd 100%)` }}>
      {icon && <div style={{ position:'absolute', opacity:0.15 }}><Icon name={icon} size={Math.min(height*0.5, 120)} color={fg} strokeWidth={0.8} /></div>}
      {label && <span style={{ fontFamily:'Sora', fontSize:9, color:fg, background:'rgba(255,255,255,0.85)',
        padding:'3px 9px', borderRadius:4, letterSpacing:0.5, textTransform:'uppercase', fontWeight:500,
        position:'relative', zIndex:1 }}>{label}</span>}
    </div>
  );
}

function Stars({ rating, small }) {
  const sz = small ? 11 : 13;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, lineHeight:1 }}>
      <span style={{ display:'inline-flex', gap:1 }}>
        {[1,2,3,4,5].map(i =>
          <Icon key={i} name={i <= Math.round(rating) ? 'starFill' : 'star'} size={sz} color={C.brand} strokeWidth={1.4} />
        )}
      </span>
      <span style={{ color:C.muted, fontSize:sz, fontFamily:'Sora', fontWeight:500 }}>{rating}</span>
    </span>
  );
}

function BadgePill({ label }) {
  const map = {
    'Bestseller': { bg:C.brand, c:'#fff' },
    'Sale':       { bg:C.primary, c:'#fff' },
    'New':        { bg:C.soft, c:C.brand },
    'Top Pick':   { bg:C.light, c:'#fff' },
    'Bundle':     { bg:C.lighter, c:C.primary },
  };
  const s = map[label] || { bg:C.soft, c:C.brand };
  return <span style={{ background:s.bg, color:s.c, fontSize:10, fontFamily:'Sora', fontWeight:600,
    padding:'3px 9px', borderRadius:20, letterSpacing:0.4, textTransform:'uppercase' }}>{label}</span>;
}

function Btn({ label, variant='primary', onClick, style:sx={}, size='md', icon, iconRight }) {
  const [hov, setHov] = React.useState(false);
  const pad = { sm:'9px 18px', md:'13px 28px', lg:'16px 38px' }[size];
  const fsz = { sm:12, md:14, lg:15 }[size];
  const vs = {
    primary: { bg: hov?C.deep:C.brand, color:'#fff', shadow: hov?`0 8px 24px ${C.brand}44`:'none' },
    purple:  { bg: hov?C.deep:C.brand, color:'#fff', shadow: hov?`0 8px 24px ${C.brand}44`:'none' },
    accent:  { bg: hov?C.accentDk:C.accent, color:'#fff', shadow: hov?`0 8px 24px ${C.accent}55`:'none' },
    dark:    { bg: hov?C.bgDark:C.primary, color:'#fff', shadow: hov?`0 8px 24px ${C.primary}55`:'none' },
    outline: { bg: hov?C.mist:'transparent', color:C.brand, border:`1.5px solid ${C.brand}` },
    ghost:   { bg: hov?C.mist:'transparent', color:C.brand },
    white:   { bg:'#fff', color:C.brand, shadow: hov?'0 8px 24px rgba(67,0,123,0.15)':'none', border:`1px solid ${C.borderLight}` },
  }[variant] || {};
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ cursor:'pointer', border:vs.border||'none', borderRadius:999, padding:pad,
        fontFamily:'Sora', fontWeight:500, fontSize:fsz, letterSpacing:0.3,
        display:'inline-flex', alignItems:'center', gap:8,
        transition:'all 0.25s cubic-bezier(.2,.8,.2,1)',
        transform: hov && !['ghost','outline'].includes(variant) ? 'translateY(-1px)' : 'none',
        background:vs.bg, color:vs.color, boxShadow:vs.shadow||'none', ...sx }}>
      {icon && <Icon name={icon} size={14} color="currentColor" />}
      {label}
      {iconRight && <Icon name={iconRight} size={14} color="currentColor" />}
    </button>
  );
}

function TextInput({ placeholder, value, onChange, type='text', icon, sx={} }) {
  const [foc, setFoc] = React.useState(false);
  return (
    <div style={{ position:'relative', ...sx }}>
      {icon && <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
        pointerEvents:'none', color:foc?C.brand:C.muted, transition:'color 0.2s',
        display:'flex', alignItems:'center' }}>
        <Icon name={icon} size={15} color="currentColor" />
      </span>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width:'100%', padding:`13px ${icon?'16px 13px 42px':'18px'}`, boxSizing:'border-box',
          border:`1px solid ${foc?C.brand:C.border}`, borderRadius:12, fontFamily:'Sora',
          fontSize:13, color:C.text, background:'#fff', outline:'none',
          transition:'border-color 0.2s, box-shadow 0.2s',
          boxShadow: foc?`0 0 0 3px ${C.soft}`:'none' }}
        onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)} />
    </div>
  );
}

function Select({ value, onChange, options, sx={} }) {
  return (
    <select value={value} onChange={onChange}
      style={{ padding:'13px 36px 13px 16px', border:`1px solid ${C.border}`, borderRadius:12, fontFamily:'Sora',
        fontSize:13, color:C.text, background:'#fff', outline:'none', cursor:'pointer',
        appearance:'none',
        backgroundImage:`url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237A6B8E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>")`,
        backgroundRepeat:'no-repeat', backgroundPosition:'right 12px center',
        ...sx }}>
      {options.map(o => <option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
    </select>
  );
}

function ProductCard({ p, navigate, addToCart }) {
  const [hov, setHov] = React.useState(false);
  const fmt = n => '₦'+n.toLocaleString();
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:C.card, borderRadius:20, overflow:'hidden', cursor:'pointer',
        boxShadow: hov?`0 24px 48px ${C.primary}18`:`0 1px 3px ${C.primary}08`,
        transform: hov?'translateY(-6px)':'none',
        transition:'all 0.35s cubic-bezier(.2,.8,.2,1)',
        border:`1px solid ${hov?C.soft:C.borderLight}` }}>
      <div style={{ position:'relative' }} onClick={()=>navigate&&navigate('product',p)}>
        <ImgPlaceholder label={p.name} height={240} bg={p.bg} fg={p.fg} icon="sparkle" />
        {p.badge && <div style={{ position:'absolute', top:14, left:14 }}><BadgePill label={p.badge}/></div>}
        <div style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,0.95)', borderRadius:999,
          width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
          color:C.brand, transition:'all 0.2s',
          boxShadow: hov?`0 4px 12px ${C.primary}22`:'0 2px 6px rgba(0,0,0,0.08)' }}>
          <Icon name="heart" size={15} color={C.brand} />
        </div>
      </div>
      <div style={{ padding:'18px 18px 20px' }}>
        <div style={{ fontSize:10, color:C.muted, fontFamily:'Sora', marginBottom:4, letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{p.brand}</div>
        <div onClick={()=>navigate&&navigate('product',p)}
          style={{ fontFamily:'Clash Display', fontSize:16, fontWeight:500, color:C.text, marginBottom:10, lineHeight:1.3 }}>{p.name}</div>
        <Stars rating={p.rating} small /><span style={{ fontSize:11, color:C.muted, fontFamily:'Sora', marginLeft:6 }}>({p.reviews})</span>
        <div style={{ marginTop:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <span style={{ fontFamily:'Clash Display', fontWeight:600, fontSize:20, color:C.brand }}>{fmt(p.price)}</span>
            {p.original && <span style={{ fontSize:12, color:C.subtle, textDecoration:'line-through', marginLeft:8, fontFamily:'Sora' }}>{fmt(p.original)}</span>}
          </div>
          <div onClick={(e)=>{ e.stopPropagation(); addToCart&&addToCart(p); }}
            style={{ width:38, height:38, borderRadius:999, border:`1px solid ${C.border}`,
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
              transition:'all 0.2s', color:C.brand }}
            onMouseEnter={e=>{ e.currentTarget.style.background=C.brand; e.currentTarget.style.borderColor=C.brand; e.currentTarget.style.color='#fff'; }}
            onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.brand; }}>
            <Icon name="plus" size={16} color="currentColor" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtisanCard({ a, navigate }) {
  const [hov, setHov] = React.useState(false);
  const initials = a.name.split(' ').map(n=>n[0]).join('');
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={()=>navigate&&navigate('artisan',a)}
      style={{ background:C.card, borderRadius:20, overflow:'hidden', cursor:'pointer',
        boxShadow: hov?`0 24px 48px ${C.primary}18`:`0 1px 3px ${C.primary}08`,
        transform: hov?'translateY(-6px)':'none',
        transition:'all 0.35s cubic-bezier(.2,.8,.2,1)',
        border:`1px solid ${hov?C.soft:C.borderLight}` }}>
      <div style={{ background:a.bg, height:130, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
        <div style={{ position:'absolute', opacity:0.1 }}><Icon name="sparkle" size={100} color="#fff" strokeWidth={0.8} /></div>
        <div style={{ width:76, height:76, borderRadius:'50%', background:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'Clash Display', fontWeight:600, fontSize:26, color:C.brand,
          boxShadow:`0 8px 20px ${C.primary}25`, position:'relative', zIndex:1 }}>{initials}</div>
      </div>
      <div style={{ padding:'18px 18px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:16, color:C.text }}>{a.name}</span>
          <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, fontFamily:'Sora', fontWeight:500,
            display:'inline-flex', alignItems:'center', gap:4, letterSpacing:0.5, textTransform:'uppercase',
            background:a.available?C.soft:C.bgAlt, color:a.available?C.brand:C.muted,
            border:`1px solid ${a.available?C.lighter:C.borderLight}` }}>
            <Icon name="dot" size={7} color={a.available?C.brand:C.muted} /> {a.available?'Available':'Busy'}
          </span>
        </div>
        <div style={{ fontSize:11, color:C.light, fontFamily:'Sora', fontWeight:500, marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>{a.specialty}</div>
        <Stars rating={a.rating} small /><span style={{ fontSize:11, color:C.muted, marginLeft:5, fontFamily:'Sora' }}>({a.reviews})</span>
        <div style={{ fontSize:12, color:C.muted, fontFamily:'Sora', marginTop:8, display:'flex', alignItems:'center', gap:6 }}>
          <Icon name="location" size={13} color={C.muted} /> {a.location}
        </div>
        <div style={{ marginTop:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily:'Clash Display', fontWeight:600, fontSize:17, color:C.brand }}>From ₦{a.price.toLocaleString()}</span>
          <div style={{ padding:'7px 18px', borderRadius:999, fontFamily:'Sora', fontSize:12, fontWeight:500,
            background:C.brand, color:'#fff', cursor:'pointer', transition:'all 0.2s' }}>Book</div>
        </div>
      </div>
    </div>
  );
}

function Navbar({ navigate, page, cartCount }) {
  const links = [['landing','Home'],['shop','Shop'],['services','Services'],['artisans','Artisans'],['partnership','Partner']];
  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:1000,
      background:'rgba(250,248,252,0.92)', backdropFilter:'blur(20px)',
      borderBottom:`1px solid ${C.borderLight}`, height:72,
      display:'flex', alignItems:'center', padding:'0 56px', justifyContent:'space-between' }}>
      <div onClick={()=>navigate('landing')} style={{ fontFamily:'Clash Display', fontWeight:600, fontSize:24,
        cursor:'pointer', color:C.primary, letterSpacing:-0.8, display:'flex', alignItems:'center', gap:2 }}>
        Luxe<span style={{ color:C.light }}>Beau</span>
      </div>
      <div style={{ display:'flex', gap:36, alignItems:'center' }}>
        {links.map(([id,label])=>(
          <span key={id} onClick={()=>navigate(id)}
            style={{ fontFamily:'Sora', fontSize:13, cursor:'pointer', transition:'color 0.2s', letterSpacing:0.3,
              color: page===id?C.brand:C.textMid, fontWeight: page===id?500:400, position:'relative' }}>
            {label}
            {page===id && <span style={{ position:'absolute', bottom:-22, left:'50%', transform:'translateX(-50%)',
              width:4, height:4, borderRadius:'50%', background:C.light }} />}
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <span onClick={()=>navigate('cart')} style={{ position:'relative', cursor:'pointer', padding:'8px 10px',
          color:C.textMid, display:'flex', alignItems:'center', transition:'color 0.2s' }}
          onMouseEnter={e=>e.currentTarget.style.color=C.brand}
          onMouseLeave={e=>e.currentTarget.style.color=C.textMid}>
          <Icon name="cart" size={19} color="currentColor" />
          {cartCount>0 && <span style={{ position:'absolute', top:2, right:0, background:C.brand, color:'#fff',
            fontSize:9, fontWeight:600, minWidth:16, height:16, padding:'0 4px', borderRadius:999,
            display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Sora' }}>{cartCount}</span>}
        </span>
        <span onClick={()=>navigate('auth')} style={{ cursor:'pointer', padding:'8px 10px',
          color:C.textMid, display:'flex', alignItems:'center', transition:'color 0.2s' }}
          onMouseEnter={e=>e.currentTarget.style.color=C.brand}
          onMouseLeave={e=>e.currentTarget.style.color=C.textMid}>
          <Icon name="user" size={19} color="currentColor" />
        </span>
        <Btn label="Sign In" variant="dark" size="sm" onClick={()=>navigate('auth')} />
      </div>
    </nav>
  );
}

function Footer({ navigate }) {
  return (
    <footer style={{ background:C.bgDark, color:'#fff', padding:'72px 56px 36px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:48, marginBottom:56 }}>
        <div>
          <div style={{ fontFamily:'Clash Display', fontWeight:600, fontSize:28, marginBottom:16, letterSpacing:-0.8 }}>
            Luxe<span style={{ color:C.lighter }}>Beau</span>
          </div>
          <p style={{ fontFamily:'Sora', fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.9, maxWidth:260 }}>
            An elevated beauty marketplace. Curated products and artisans delivered to your doorstep across Nigeria.
          </p>
          <div style={{ marginTop:24, display:'flex', gap:10 }}>
            {[['instagram'],['x_social'],['mail']].map(([ic],i)=>(
              <div key={i} style={{ width:36, height:36, borderRadius:'50%', border:`1px solid rgba(255,255,255,0.15)`,
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                color:'rgba(255,255,255,0.6)', transition:'all 0.2s' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.lighter; e.currentTarget.style.color=C.lighter; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.15)'; e.currentTarget.style.color='rgba(255,255,255,0.6)'; }}>
                <Icon name={ic} size={14} color="currentColor" />
              </div>
            ))}
          </div>
        </div>
        {[
          { title:'Shop', links:['Skincare','Makeup','Hair Care',"Men's","Fragrance"] },
          { title:'Services', links:['Hairstyling','Makeup Artist','Nail Tech','Skincare','Barber'] },
          { title:'Company', links:['About Us','Partnership','Careers','Support'] },
        ].map(col=>(
          <div key={col.title}>
            <div style={{ fontFamily:'Sora', fontWeight:500, fontSize:11, color:'rgba(255,255,255,0.4)',
              marginBottom:18, textTransform:'uppercase', letterSpacing:2 }}>{col.title}</div>
            {col.links.map(l=>(
              <div key={l} style={{ fontFamily:'Sora', fontSize:13, color:'rgba(255,255,255,0.65)',
                marginBottom:12, cursor:'pointer', transition:'color 0.2s' }}
                onMouseEnter={e=>e.target.style.color='#fff'}
                onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.65)'}>{l}</div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:24, display:'flex',
        alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontFamily:'Sora', fontSize:12, color:'rgba(255,255,255,0.4)' }}>
          © 2026 LuxeBeau · Crafted in Lagos
        </span>
        <div style={{ display:'flex', gap:24 }}>
          {['Privacy','Terms','Cookies'].map(l=>(
            <span key={l} style={{ fontFamily:'Sora', fontSize:12, color:'rgba(255,255,255,0.4)',
              cursor:'pointer', transition:'color 0.2s' }}
              onMouseEnter={e=>e.target.style.color='#fff'}
              onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.4)'}>{l}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}

function SectionHeader({ tag, title, subtitle, center }) {
  return (
    <div style={{ textAlign:center?'center':'left', marginBottom:56 }}>
      {tag && <div style={{ display:'inline-block', color:C.light, fontFamily:'Sora',
        fontSize:11, fontWeight:500, marginBottom:16, textTransform:'uppercase', letterSpacing:3 }}>{tag}</div>}
      <h2 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:48, color:C.text,
        margin:'0 0 16px', lineHeight:1.05, letterSpacing:-1.2 }}>{title}</h2>
      {subtitle && <p style={{ fontFamily:'Sora', fontSize:15, color:C.muted, margin: center?'0 auto':'0',
        lineHeight:1.75, maxWidth:center?560:640, fontWeight:300 }}>{subtitle}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children, width=520 }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(18,0,37,0.55)', zIndex:2000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(8px)' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:24, padding:36, width, maxWidth:'100%',
        maxHeight:'90vh', overflowY:'auto', position:'relative' }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
          <h3 style={{ fontFamily:'Clash Display', fontWeight:500, fontSize:26, color:C.text, margin:0, letterSpacing:-0.5 }}>{title}</h3>
          <div onClick={onClose} style={{ cursor:'pointer', color:C.muted, display:'flex', alignItems:'center' }}>
            <Icon name="x" size={20} color="currentColor" />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { C, PRODUCTS, ARTISANS, PRODUCT_CATS, SERVICE_CATS,
  Icon, ImgPlaceholder, Stars, BadgePill, Btn, TextInput, Select,
  ProductCard, ArtisanCard, Navbar, Footer, SectionHeader, Modal });
