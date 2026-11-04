import { useEffect, useMemo, useRef, useState } from 'react'
import { GROUPS, CITIES } from './data'
import { loadDevice, saveDevice, timeAgoFrom } from './store'
import {
  fetchCounts, fetchRequests, registerDonor, createBloodRequest,
  acceptBloodRequest, confirmBloodRequest,
} from './api'
import heroImg from './assets/img/hero.webp'
import nurseImg from './assets/img/nurse.webp'
import bagImg from './assets/img/bag.webp'

const HOSPITALS = {
  Hangu: ['DHQ Hospital Hangu', 'Civil Hospital Hangu', 'Koi Aur Hospital'],
  Kohat: ['Liaqat Memorial Hospital Kohat', 'KDA Hospital Kohat', 'Civil Hospital Kohat', 'Koi Aur Hospital'],
}

/* ================= Splash ================= */
function Splash({ done }) {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const iv = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - t0) / 2400) * 100))
      setPct(p)
      if (p >= 100) clearInterval(iv)
    }, 40)
    return () => clearInterval(iv)
  }, [])
  return (
    <div className={`splash ${done ? 'splash-out' : ''}`} aria-hidden={done}>
      <svg className="splash-drop" width="110" height="110" viewBox="0 0 24 24">
        <defs>
          <clipPath id="dropClip"><path d="M12 2.7c3.2 4.1 6.5 8.3 6.5 12a6.5 6.5 0 1 1-13 0c0-3.7 3.3-7.9 6.5-12z" /></clipPath>
          <linearGradient id="bloodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF2E4D" /><stop offset="100%" stopColor="#A30A20" />
          </linearGradient>
        </defs>
        <path d="M12 2.7c3.2 4.1 6.5 8.3 6.5 12a6.5 6.5 0 1 1-13 0c0-3.7 3.3-7.9 6.5-12z" fill="#2A0D12" />
        <g clipPath="url(#dropClip)"><rect className="splash-fill" x="0" y="24" width="24" height="24" fill="url(#bloodGrad)" /></g>
        <path d="M12 2.7c3.2 4.1 6.5 8.3 6.5 12a6.5 6.5 0 1 1-13 0c0-3.7 3.3-7.9 6.5-12z" fill="none" stroke="#FF2E4D" strokeWidth="0.6" />
      </svg>
      <div className="splash-name">HAR <b>BOOND</b></div>
      <svg className="ecg" width="210" height="36" viewBox="0 0 190 36">
        <path d="M0 18 H55 L65 18 72 6 82 30 90 18 H120 L130 18 137 6 147 30 155 18 H190" fill="none" stroke="#FF2E4D" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      <div className="splash-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="splash-pct">{pct}%</div>
      <div className="splash-tag">Aik Boond — Aik Zindagi</div>
    </div>
  )
}

/* ================= Canvas cells ================= */
function Cells() {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv.getContext('2d')
    let raf, w, h
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const cells = Array.from({ length: 26 }, (_, i) => ({
      x: Math.random(), y: Math.random(), r: 8 + ((i * 37) % 26),
      s: 0.00022 + ((i * 13) % 10) * 0.00003, drift: ((i * 29) % 10 - 5) * 0.00003,
      a: 0.05 + ((i * 17) % 10) * 0.012,
    }))
    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight
      cv.width = w * dpr; cv.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      for (const c of cells) {
        c.y -= c.s; c.x += c.drift
        if (c.y < -0.08) { c.y = 1.08; c.x = Math.random() }
        const x = c.x * w, y = c.y * h
        const g = ctx.createRadialGradient(x - c.r * 0.3, y - c.r * 0.3, c.r * 0.15, x, y, c.r)
        g.addColorStop(0, `rgba(255,70,95,${c.a + 0.05})`)
        g.addColorStop(0.75, `rgba(200,16,46,${c.a})`)
        g.addColorStop(1, 'rgba(140,8,28,0)')
        ctx.beginPath(); ctx.arc(x, y, c.r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
        ctx.beginPath(); ctx.arc(x, y, c.r * 0.55, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(90,4,18,${c.a * 0.8})`; ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="cells" aria-hidden="true" />
}

function CountUp({ value }) {
  const [n, setN] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)
  useEffect(() => { started.current = false; setN(0) }, [value])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const t0 = Date.now()
        const iv = setInterval(() => {
          const p = Math.min(1, (Date.now() - t0) / 1000)
          setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
          if (p >= 1) clearInterval(iv)
        }, 30)
      }
    }, { threshold: 0.35 })
    ob.observe(el)
    return () => ob.disconnect()
  }, [value])
  return <span ref={ref}>{n}</span>
}

function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); ob.disconnect() }
    }, { threshold: 0.12 })
    if (ref.current) ob.observe(ref.current)
    return () => ob.disconnect()
  }, [])
  return <div ref={ref} className={`reveal ${inView ? 'reveal-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

/* ================= Lifeline Board ================= */
function LifelineBoard({ counts, group, setGroup, city }) {
  const C = 170, R = 122
  const pos = (i) => {
    const a = (i / GROUPS.length) * Math.PI * 2 - Math.PI / 2
    return [C + R * Math.cos(a), C + R * Math.sin(a)]
  }
  return (
    <div className="board-wrap">
      <svg className="board" viewBox="0 0 340 340" role="group" aria-label="Blood group select karo">
        <defs>
          <linearGradient id="bloodGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF2E4D" /><stop offset="100%" stopColor="#A30A20" />
          </linearGradient>
        </defs>
        <circle cx={C} cy={C} r={R} className="board-ring" />
        <circle cx={C} cy={C} r={R - 34} className="board-ring ring2" />
        {GROUPS.map((g, i) => {
          const [x, y] = pos(i)
          return <line key={`l${g}`} x1={C} y1={C} x2={x} y2={y} className={`board-line ${group === g ? 'line-on' : ''}`} />
        })}
        {GROUPS.map((g, i) => {
          const [x, y] = pos(i)
          const on = group === g
          const ready = counts?.[city]?.groups?.[g]?.ready ?? 0
          return (
            <g key={g} className={`node ${on ? 'node-on' : ''}`} onClick={() => setGroup(g)} style={{ animationDelay: `${i * 0.35}s` }}>
              <circle cx={x} cy={y} r={on ? 27 : 22} className="node-c" />
              <text x={x} y={y - 1} className="node-g">{g}</text>
              <text x={x} y={y + 12} className="node-n">{ready} ready</text>
            </g>
          )
        })}
        <g className="board-heart">
          <path transform={`translate(${C - 21},${C - 26}) scale(1.75)`} d="M12 2.7c3.2 4.1 6.5 8.3 6.5 12a6.5 6.5 0 1 1-13 0c0-3.7 3.3-7.9 6.5-12z" fill="url(#bloodGrad2)" />
          <text x={C} y={C + 38} className="board-city">{city}</text>
        </g>
      </svg>
      <p className="board-hint">Kisi bhi group par click karo — uske ready donors foran hisaab hokar samne ayenge</p>
    </div>
  )
}

const STATUS = {
  'searching': { label: 'Donor Dhunda Ja Raha Hai', cls: 'st-search' },
  'donor-found': { label: 'Donor Mil Gaya', cls: 'st-found' },
  'completed': { label: 'Khoon Mil Gaya', cls: 'st-done' },
}

/* ================= Request card (home + requests page) ================= */
function RequestCard({ r }) {
  return (
    <article className="req-card">
      <div className="req-top">
        <span className="req-group">{r.group}</span>
        <span className={`req-status ${STATUS[r.status].cls}`}><i />{STATUS[r.status].label}</span>
      </div>
      <h3>{r.hospital}</h3>
      <p>{r.city} • {r.bottles} bottle chahiye • {r.deadlineHrs} ghante ke andar</p>
      {r.status === 'donor-found' && r.donorName && <p className="req-donor">Donor: <b>{r.donorName}</b> araha hai</p>}
      <div className="req-foot"><span>{timeAgoFrom(r.postedAt)}</span><span className="req-id">{r.id}</span></div>
      <div className="req-line" />
    </article>
  )
}

/* ================= HOME ================= */
function Home({ counts, requests, goRegister, goRequest, goRequests }) {
  const [group, setGroup] = useState('O+')
  const [city, setCity] = useState('Hangu')
  const [reqCity, setReqCity] = useState('All')
  const st = useMemo(() => ({
    total: CITIES.reduce((a, c) => a + (counts?.[c]?.total || 0), 0),
    ready: CITIES.reduce((a, c) => a + (counts?.[c]?.readyTotal || 0), 0),
  }), [counts])
  const ready = counts?.[city]?.groups?.[group]?.ready ?? 0
  const registered = counts?.[city]?.groups?.[group]?.registered ?? 0
  const visibleRequests = requests.filter((r) => reqCity === 'All' || r.city === reqCity).slice(0, 4)

  const goBoard = (e) => {
    e.preventDefault()
    document.querySelector('#board')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main>
      <section className="hero">
        <Cells />
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-in anim-in">
          <span className="badge">HANGU + KOHAT — JAHAN SE SHURUAAT HOGI</span>
          <h1 className="mega">AIK <span className="fill">BOOND.</span><br />AIK <span className="stroke">ZINDAGI.</span></h1>
          <p className="hero-sub">
            Jab hospital me doctor kehta hai <em>"khoon lao, waqt kam hai"</em> — us waqt Facebook
            groups kaam nahi karte. Har Boond usi sheher ke <b>ready donors</b> ko minutes me
            tumhare samne le ata hai. Na sifarish, na intezar, na paisa.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-red btn-lg" href="#board" onClick={goBoard}>Lifeline Board Kholo</a>
            <button className="btn btn-line btn-lg" onClick={goRequests}>Live Requests Dekho</button>
          </div>
          <div className="hero-stats">
            <div><b><CountUp value={st.total} /></b><span>Register Donors</span></div>
            <div className="hs-sep" />
            <div><b><CountUp value={st.ready} /></b><span>Abhi Is Waqt Ready</span></div>
            <div className="hs-sep" />
            <div><b>Rs 0</b><span>Hamesha — Khoon Muft</span></div>
          </div>
        </div>
        <svg className="hero-ecg" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 40 H420 L455 40 480 10 510 72 535 40 H760 L790 40 805 22 825 58 840 40 H1200" fill="none" stroke="#FF2E4D" strokeWidth="2.5" />
        </svg>
      </section>

      <section className="section board-sec" id="board">
        <Reveal>
          <span className="kicker">THE LIFELINE BOARD</span>
          <h2 className="sec-title">Sheher ki dharkan, <span>aik circle me</span></h2>
          <p className="sec-sub">Har node aik blood group hai — aur har node ke andar wo taadad hai jo is waqt sach me khoon de sakti hai. Ye number koi likhta nahi, system har donor ki aakhri donation ki date se khud nikalta hai.</p>
        </Reveal>
        <div className="board-grid">
          <Reveal>
            <div className="city-switch">
              {CITIES.map((c) => (
                <button key={c} className={`cs-btn ${city === c ? 'cs-on' : ''}`} onClick={() => setCity(c)}>{c}</button>
              ))}
            </div>
            <LifelineBoard counts={counts} group={group} setGroup={setGroup} city={city} />
          </Reveal>
          <Reveal delay={140}>
            <div className="detail" key={`${city}-${group}-${ready}`}>
              <span className="detail-group">{group}</span>
              <div className="detail-num"><CountUp value={ready} /></div>
              <p className="detail-line"><b>{city}</b> me is group ke donors <b>abhi ready</b> hain</p>
              <div className="ready-bar"><i style={{ width: `${registered ? Math.round((ready / registered) * 100) : 0}%` }} /></div>
              <p className="detail-small">{registered} register donors me se {ready} ne 3 mahine wala rule poora kiya. Baqi ko system tang nahi karta — unki sehat pehle hai.</p>
              <button className="btn btn-red btn-full" onClick={() => goRequest(group, city)}>Request Bhejo — Inhi {ready} Ko Khabar Jayegi</button>
              <p className="detail-note">Request bhejne par number kisi ko nahi dikhta — donor khud "Me Araha Hon" bolay to rabta hota hai.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="manifesto" aria-hidden="true">
        <div className="manifesto-track">
          {[0, 1].map((k) => (<span key={k}>DONATE — SAVE — REPEAT — &nbsp;DONATE — SAVE — REPEAT — &nbsp;</span>))}
        </div>
      </div>

      <section className="section" id="live">
        <Reveal>
          <div className="live-head">
            <div>
              <span className="kicker">ABHI IS WAQT</span>
              <h2 className="sec-title">Live <span>Requests</span></h2>
            </div>
            <div className="chips">
              {['All', ...CITIES].map((c) => (
                <button key={c} className={`chip ${reqCity === c ? 'chip-on' : ''}`} onClick={() => setReqCity(c)}>
                  {c === 'All' ? 'Sab' : c}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
        <div className="requests">
          {visibleRequests.map((r, i) => (
            <Reveal key={r.id} delay={i * 90}><RequestCard r={r} /></Reveal>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <button className="btn btn-line" onClick={goRequests}>Saari Requests Aur Donor Jawab — Yahan Dekho</button>
        </div>
      </section>

      <section className="story" id="story">
        <div className="story-img">
          <img src={heroImg} alt="Donor khoon dete hue" loading="lazy" decoding="async" />
          <img className="story-img2" src={bagImg} alt="Blood bag" loading="lazy" decoding="async" />
        </div>
        <Reveal className="story-text">
          <span className="kicker">KAHAANI HAR DONOR KI</span>
          <blockquote>"Tum apna khoon kisi ajnabi ko dete ho —<br />aur kisi maa ki dua tumhe zindagi bhar dhundti rehti hai."</blockquote>
          <p>
            Pakistan me har roz hazaron log sirf is liye ruk jate hain ke waqt par donor nahi milta —
            halanke donor unhi ki gali, unhi ke sheher me hota hai. Masla khoon ki kami nahi hai.
            <b> Masla rabte ki kami hai.</b> Har Boond sirf wo rabta hai.
          </p>
          <div className="story-sign">— Har Boond ka wada: khoon kabhi bhi bikega nahi</div>
        </Reveal>
      </section>

      <section className="section">
        <Reveal><span className="kicker">SIRF 3 STEP</span><h2 className="sec-title">Waqt kam hai — <span>tareeka asan hai</span></h2></Reveal>
        <div className="steps">
          {[
            ['01', 'Request Dalo', 'Blood group, sheher, hospital, kitna time hai. Aik minute se kam.'],
            ['02', 'Board Khud Dhundega', 'Lifeline Board sirf unhi donors ko jagata hai jo match karte hain aur ready hain.'],
            ['03', '"Me Araha Hon"', 'Donor ka aik tap — aur tumhe tasalli. Na 50 calls, na jhooti umeed.'],
          ].map(([n, t, p], i) => (
            <Reveal key={n} delay={i * 110}><div className="step"><div className="step-num">{n}</div><h3>{t}</h3><p>{p}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="rule2">
          <Reveal className="rule2-img"><img src={nurseImg} alt="Medical staff donor se khoon lete hue" loading="lazy" decoding="async" /></Reveal>
          <Reveal className="rule2-text" delay={120}>
            <span className="kicker">YEHI ASAL FARQ HAI</span>
            <h2>3 mahine wala rule — system khud hisaab lagata hai</h2>
            <p>
              Jo banda pichle 3 mahine me khoon de chuka hai, wo dobara nahi de sakta — uski apni
              sehat pehle hai. Facebook group ye nahi janta, is liye ghanto zaya hote hain.
              Har Boond har donor ki aakhri date yaad rakhta hai, aur khabar sirf ready donor
              tak pohanchata hai.
            </p>
            <ul className="rule2-list">
              <li>Donor ki sehat ki hifazat — zabardasti kabhi nahi</li>
              <li>Family ka waqt zaya nahi — sirf sahi bande ko khabar</li>
              <li>Har hisaab date se — andaze se kabhi nahi</li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="section" id="trust">
        <Reveal><span className="kicker">BHAROSA</span><h2 className="sec-title">4 rule — <span>jo kabhi nahi tootein gay</span></h2></Reveal>
        <div className="trust-list">
          {[
            ['Number Private Hai', 'Donor ka number tab hi dikhega jab wo khud "Me araha hon" bolay.'],
            ['Paisa Mangna = Ban', 'Khoon muft hai. Paisa mangne wala pehli report par bahar.'],
            ['Sachha Record', '"Zindagi bachayi" ka number sirf family ki tasdeeq ke baad barhta hai.'],
            ['Mareez Ki Izzat', 'Photo ya bemari ki tafseel kabhi public nahi. Sirf group, sheher, hospital.'],
          ].map(([t, p], i) => (
            <Reveal key={t} delay={i * 70}><div className="trust-row"><span className="trust-no">0{i + 1}</span><h3>{t}</h3><p>{p}</p></div></Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <section className="cta" id="join">
          <h2>TUMHARI BOOND KA<br /><span>KISI KO INTEZAR HAI</span></h2>
          <p>Register karo. Jab tumhare sheher me zaroorat hogi, Lifeline Board tumhe jagayega.</p>
          <button className="btn btn-white btn-lg" onClick={goRegister}>Life Saver Bano — Register Karo</button>
        </section>
      </Reveal>
    </main>
  )
}

/* ================= Shared form pieces ================= */
function GroupChips({ value, onChange }) {
  return (
    <div className="chips">
      {GROUPS.map((g) => (
        <button type="button" key={g} className={`chip chip-g ${value === g ? 'chip-on' : ''}`} onClick={() => onChange(g)}>{g}</button>
      ))}
    </div>
  )
}
function CityChips({ value, onChange }) {
  return (
    <div className="chips">
      {CITIES.map((c) => (
        <button type="button" key={c} className={`chip ${value === c ? 'chip-on' : ''}`} onClick={() => onChange(c)}>{c}</button>
      ))}
    </div>
  )
}
const cleanPhone = (p) => (p || '').replace(/[\s-]/g, '')
const phoneOk = (p) => /^03\d{9}$/.test(cleanPhone(p))

/* ================= REGISTER ================= */
function Register({ myDonors, addDonor, removeDonor, goBoard }) {
  const [f, setF] = useState({ name: '', phone: '', group: 'O+', city: 'Hangu', lastType: 'never', lastDate: '', night: true, agree: false })
  const [err, setErr] = useState({})
  const [done, setDone] = useState(null)
  const [sending, setSending] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const mine = myDonors

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (f.name.trim().length < 3) er.name = 'Poora naam likho (kam az kam 3 harf)'
    if (!phoneOk(f.phone)) er.phone = 'Sahi WhatsApp number likho — 03 se shuru, 11 number (masalan 03221234567)'
    if (f.lastType === 'date') {
      if (!f.lastDate) er.lastDate = 'Date select karo'
      else if (new Date(f.lastDate) > new Date()) er.lastDate = 'Date aaj se age ki nahi ho sakti'
    }
    if (!f.agree) er.agree = 'Register karne ke liye ye manna zaroori hai'
    setErr(er)
    if (Object.keys(er).length) return
    setSending(true)
    try {
      const saved = await addDonor({
        name: f.name.trim(), phone: cleanPhone(f.phone),
        group: f.group, city: f.city,
        lastDonation: f.lastType === 'date' ? new Date(f.lastDate).toISOString() : null,
        nightAvailable: f.night,
      })
      setDone(saved)
      window.scrollTo({ top: 0 })
    } catch (err2) {
      setErr({ submit: err2.message || 'Server se rabta nahi ho raha — dobara try karo' })
    } finally {
      setSending(false)
    }
  }

  if (done) {
    const ready = done.ready !== false
    return (
      <main className="page-wrap">
        <div className="success-card anim-in">
          <svg width="70" height="70" viewBox="0 0 24 24"><path d="M12 2.7c3.2 4.1 6.5 8.3 6.5 12a6.5 6.5 0 1 1-13 0c0-3.7 3.3-7.9 6.5-12z" fill="#E8112D" /><path d="M8.6 12.4l2.3 2.3 4.4-4.6" stroke="#fff" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <h2>Mubarak ho, {done.name.split(' ')[0]} — tum Life Saver ban gaye</h2>
          <div className="badge-card">
            <div><span>Naam</span><b>{done.name}</b></div>
            <div><span>Blood Group</span><b>{done.group}</b></div>
            <div><span>Sheher</span><b>{done.city}</b></div>
            <div><span>Status</span><b className={ready ? 'ok-text' : 'warn-text'}>{ready ? 'Abhi Ready — board par ginay ja rahe ho' : 'Abhi Ready Nahi — 3 mahine poore hone par board khud ready dikhayega'}</b></div>
          </div>
          <p className="form-note">Tumhara number kisi ko nazar nahi ayega. Jab tumhare group ki request ayegi aur tum "Me Araha Hon" bologe, sirf tab rabta hoga.</p>
          <div className="hero-ctas" style={{ justifyContent: 'center' }}>
            <button className="btn btn-red" onClick={goBoard}>Lifeline Board Par Dekho</button>
            <button className="btn btn-line" onClick={() => setDone(null)}>Aik Aur Donor Register Karo</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrap">
      <span className="kicker">DONOR REGISTRATION</span>
      <h2 className="sec-title">Life Saver <span>Bano</span></h2>
      <p className="sec-sub">2 minute ka form hai. Tumhara number hamesha private rahega — ye hamara pehla rule hai.</p>

      <form className="form-card" onSubmit={submit} noValidate>
        <label className="lbl2">Poora Naam</label>
        <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Masalan: Ahmed Khan" />
        {err.name && <p className="err">{err.name}</p>}

        <label className="lbl2">WhatsApp Number</label>
        <input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03XX-XXXXXXX" inputMode="tel" />
        {err.phone && <p className="err">{err.phone}</p>}

        <label className="lbl2">Blood Group</label>
        <GroupChips value={f.group} onChange={(v) => set('group', v)} />

        <label className="lbl2">Sheher</label>
        <CityChips value={f.city} onChange={(v) => set('city', v)} />

        <label className="lbl2">Aakhri Dafa Khoon Kab Diya Tha?</label>
        <div className="chips">
          <button type="button" className={`chip ${f.lastType === 'never' ? 'chip-on' : ''}`} onClick={() => set('lastType', 'never')}>Kabhi Nahi Diya</button>
          <button type="button" className={`chip ${f.lastType === 'date' ? 'chip-on' : ''}`} onClick={() => set('lastType', 'date')}>Diya Tha — Date Bataunga</button>
        </div>
        {f.lastType === 'date' && (
          <>
            <input type="date" className="input" style={{ marginTop: 12 }} value={f.lastDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('lastDate', e.target.value)} />
            {err.lastDate && <p className="err">{err.lastDate}</p>}
            <p className="form-note">Agar 3 mahine se kam hue hain to tum abhi "ready" nahi gine jaoge — system tumhari sehat ki hifazat ke liye khud intezar karega.</p>
          </>
        )}

        <label className="check-row">
          <input type="checkbox" checked={f.night} onChange={(e) => set('night', e.target.checked)} />
          <span>Raat ko bhi emergency me mujhe khabar di ja sakti hai</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={f.agree} onChange={(e) => set('agree', e.target.checked)} />
          <span>Me wada karta hon ke khoon hamesha <b>muft</b> dunga aur kabhi paisa nahi mangunga</span>
        </label>
        {err.agree && <p className="err">{err.agree}</p>}
        {err.submit && <p className="err">{err.submit}</p>}

        <button className="btn btn-red btn-full" type="submit" style={{ marginTop: 18 }} disabled={sending}>{sending ? 'Register Ho Raha Hai…' : 'Register Karo — Life Saver Bano'}</button>
      </form>

      {mine.length > 0 && (
        <div className="mine-box">
          <h3>Is device se register donors ({mine.length})</h3>
          {mine.map((d) => (
            <div key={d.id} className="mine-row">
              <span><b>{d.name}</b> — {d.group}, {d.city} • {d.donations} dafa khoon diya</span>
              <button className="mini-btn" onClick={() => removeDonor(d.id)}>Hatao</button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

/* ================= NEW REQUEST ================= */
function NewRequest({ prefill, createRequest, goRequests }) {
  const [f, setF] = useState({
    attendant: '', phone: '', group: prefill.group || 'O+', city: prefill.city || 'Hangu',
    hospital: HOSPITALS[prefill.city || 'Hangu'][0], customHospital: '', bottles: 2, deadline: 6,
  })
  const [err, setErr] = useState({})
  const [doneId, setDoneId] = useState(null)
  const [sending, setSending] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const setCity = (c) => setF((s) => ({ ...s, city: c, hospital: HOSPITALS[c][0], customHospital: '' }))

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (f.attendant.trim().length < 3) er.attendant = 'Apna naam likho taake donor ko pata ho kis se rabta hai'
    if (!phoneOk(f.phone)) er.phone = 'Sahi number likho — 03 se shuru, 11 number'
    if (f.hospital === 'Koi Aur Hospital' && f.customHospital.trim().length < 4) er.customHospital = 'Hospital ka naam likho'
    setErr(er)
    if (Object.keys(er).length) return
    setSending(true)
    try {
      const id = await createRequest({
        attendant: f.attendant.trim(), phone: cleanPhone(f.phone),
        group: f.group, city: f.city,
        hospital: f.hospital === 'Koi Aur Hospital' ? f.customHospital.trim() : f.hospital,
        bottles: Number(f.bottles), deadlineHrs: Number(f.deadline),
      })
      setDoneId(id)
      window.scrollTo({ top: 0 })
    } catch (err2) {
      setErr({ submit: err2.message || 'Server se rabta nahi ho raha — dobara try karo' })
    } finally {
      setSending(false)
    }
  }

  if (doneId) {
    return (
      <main className="page-wrap">
        <div className="success-card anim-in">
          <h2>Tumhari request lag gayi hai</h2>
          <div className="badge-card">
            <div><span>Request Number</span><b>{doneId}</b></div>
            <div><span>Status</span><b className="warn-text">Donor Dhunda Ja Raha Hai</b></div>
          </div>
          <p className="form-note">Is group ke ready donors ko khabar ja rahi hai. Jaise hi koi donor "Me Araha Hon" bolega, is request ka status "Donor Mil Gaya" ho jayega — Requests wale page par nazar rakho.</p>
          <button className="btn btn-red" onClick={goRequests}>Meri Request Dekho</button>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrap">
      <span className="kicker">NAYI REQUEST</span>
      <h2 className="sec-title">Khoon Ki <span>Request Lagao</span></h2>
      <p className="sec-sub">Ye tafseel sirf is liye hai ke sahi donor sahi hospital tak pohanch sake. Mareez ka naam ya bemari kabhi nahi mangi jati.</p>

      <form className="form-card" onSubmit={submit} noValidate>
        <label className="lbl2">Tumhara Naam (mareez ke sath kon hai)</label>
        <input className="input" value={f.attendant} onChange={(e) => set('attendant', e.target.value)} placeholder="Masalan: Bilal Ahmed" />
        {err.attendant && <p className="err">{err.attendant}</p>}

        <label className="lbl2">Tumhara Number (donor rabta karega)</label>
        <input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03XX-XXXXXXX" inputMode="tel" />
        {err.phone && <p className="err">{err.phone}</p>}

        <label className="lbl2">Blood Group Jo Chahiye</label>
        <GroupChips value={f.group} onChange={(v) => set('group', v)} />

        <label className="lbl2">Sheher</label>
        <CityChips value={f.city} onChange={setCity} />

        <label className="lbl2">Hospital</label>
        <select className="input" value={f.hospital} onChange={(e) => set('hospital', e.target.value)}>
          {HOSPITALS[f.city].map((h) => (<option key={h} value={h}>{h}</option>))}
        </select>
        {f.hospital === 'Koi Aur Hospital' && (
          <>
            <input className="input" style={{ marginTop: 12 }} value={f.customHospital} onChange={(e) => set('customHospital', e.target.value)} placeholder="Hospital ka naam likho" />
            {err.customHospital && <p className="err">{err.customHospital}</p>}
          </>
        )}

        <div className="form-2col">
          <div>
            <label className="lbl2">Kitni Bottles</label>
            <select className="input" value={f.bottles} onChange={(e) => set('bottles', e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => (<option key={n} value={n}>{n} bottle</option>))}
            </select>
          </div>
          <div>
            <label className="lbl2">Kitne Time Ke Andar</label>
            <select className="input" value={f.deadline} onChange={(e) => set('deadline', e.target.value)}>
              {[2, 4, 6, 8, 12, 24].map((n) => (<option key={n} value={n}>{n} ghante</option>))}
            </select>
          </div>
        </div>

        {err.submit && <p className="err">{err.submit}</p>}
        <button className="btn btn-red btn-full" type="submit" style={{ marginTop: 20 }} disabled={sending}>{sending ? 'Request Lag Rahi Hai…' : 'Request Lagao — Donors Ko Khabar Bhejo'}</button>
        <p className="form-note">Request lagate hi ye Live Requests me ajayegi aur sirf usi group ke ready donors isay dekh kar jawab de sakenge.</p>
      </form>
    </main>
  )
}

/* ================= ALL REQUESTS + ACCEPT + CONFIRM ================= */
function RequestsPage({ requests, myDonor, acceptRequest, confirmRequest }) {
  const [cityF, setCityF] = useState('All')
  const [openId, setOpenId] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [codeIn, setCodeIn] = useState({})
  const [msg, setMsg] = useState({})
  const list = [...requests].sort((a, b) => b.postedAt - a.postedAt)
    .filter((r) => cityF === 'All' || r.city === cityF)

  const openAccept = (r) => {
    setOpenId(r.id)
    setForm({ name: myDonor ? myDonor.name : '', phone: myDonor ? myDonor.phone : '' })
    setMsg((m) => ({ ...m, [r.id]: '' }))
  }

  const doAccept = async (r) => {
    if (form.name.trim().length < 3) { setMsg((m) => ({ ...m, [r.id]: 'Apna naam likho' })); return }
    if (!phoneOk(form.phone)) { setMsg((m) => ({ ...m, [r.id]: 'Sahi number likho — 03 se shuru, 11 number' })); return }
    const res = await acceptRequest(r.id, form.name.trim(), cleanPhone(form.phone))
    if (!res.ok) { setMsg((m) => ({ ...m, [r.id]: res.error })); return }
    setOpenId(null)
  }

  const doConfirm = async (r) => {
    const ok = await confirmRequest(r.id, (codeIn[r.id] || '').trim())
    setMsg((m) => ({ ...m, [r.id]: ok ? '' : 'Code ghalat hai — donor se dobara pooch kar likho' }))
    if (ok) setCodeIn((c) => ({ ...c, [r.id]: '' }))
  }

  return (
    <main className="page-wrap wide">
      <span className="kicker">LIVE REQUESTS</span>
      <h2 className="sec-title">Saari <span>Requests</span></h2>
      <p className="sec-sub">Donor ho? Kisi request par "Me Araha Hon" bolo. Family ho? Khoon mil jane par donor ke diye hue code se tasdeeq karo — isi se record sachha rehta hai.</p>

      <div className="chips" style={{ margin: '20px 0 24px' }}>
        {['All', ...CITIES].map((c) => (
          <button key={c} className={`chip ${cityF === c ? 'chip-on' : ''}`} onClick={() => setCityF(c)}>{c === 'All' ? 'Sab Sheher' : c}</button>
        ))}
      </div>

      <div className="requests">
        {list.map((r) => (
          <article key={r.id} className="req-card">
            <div className="req-top">
              <span className="req-group">{r.group}</span>
              <span className={`req-status ${STATUS[r.status].cls}`}><i />{STATUS[r.status].label}</span>
            </div>
            <h3>{r.hospital}</h3>
            <p>{r.city} • {r.bottles} bottle chahiye • {r.deadlineHrs} ghante ke andar</p>
            {r.attendant && <p className="req-donor">Rabta: <b>{r.attendant}</b></p>}
            {r.status === 'donor-found' && r.donorName && <p className="req-donor">Donor: <b>{r.donorName}</b> araha hai</p>}
            <div className="req-foot"><span>{timeAgoFrom(r.postedAt)}</span><span className="req-id">{r.id}</span></div>

            {r.status === 'searching' && openId !== r.id && (
              <button className="btn btn-red btn-full" style={{ marginTop: 14 }} onClick={() => openAccept(r)}>Me Donor Hon — Me Araha Hon</button>
            )}
            {r.status === 'searching' && openId === r.id && (
              <div className="accept-box">
                <label className="lbl2">Tumhara Naam</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Donor ka naam" />
                <label className="lbl2">Tumhara Number</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03XX-XXXXXXX" inputMode="tel" />
                {msg[r.id] && <p className="err">{msg[r.id]}</p>}
                <button className="btn btn-red btn-full" style={{ marginTop: 12 }} onClick={() => doAccept(r)}>Confirm — Me Araha Hon</button>
                <p className="form-note">Confirm karte hi tumhe aik <b>4 number ka code</b> milega. Khoon dene ke baad ye code family ko dena — wo isi se tasdeeq karegi.</p>
              </div>
            )}
            {r.status === 'donor-found' && r.code && (
              <div className="code-show">Donor ka confirmation code: <b>{r.code}</b><span>Khoon mil jane par family ye code neeche likh kar tasdeeq karegi</span>{r.attendantPhone && <span>Family ka number: <b>{r.attendantPhone}</b> — call karke bata do ke tum arahe ho</span>}</div>
            )}
            {r.status === 'donor-found' && (
              <div className="accept-box">
                <label className="lbl2">Family Ke Liye — Khoon Mil Gaya? Code Likho</label>
                <div className="code-row">
                  <input className="input code-input" value={codeIn[r.id] || ''} onChange={(e) => setCodeIn((c) => ({ ...c, [r.id]: e.target.value }))} placeholder="4 number ka code" inputMode="numeric" maxLength={4} />
                  <button className="btn btn-red" onClick={() => doConfirm(r)}>Tasdeeq Karo</button>
                </div>
                {msg[r.id] && <p className="err">{msg[r.id]}</p>}
              </div>
            )}
            {r.status === 'completed' && <p className="done-note">Alhamdulillah — ye request poori ho chuki hai. Donor ka shukriya.</p>}
            <div className="req-line" />
          </article>
        ))}
      </div>
      {list.length === 0 && <p className="form-note">Is sheher me abhi koi request nahi hai.</p>}
    </main>
  )
}

/* ================= APP ================= */
function parseRoute() {
  const h = window.location.hash || '#/'
  if (h.startsWith('#/register')) return 'register'
  if (h.startsWith('#/requests')) return 'requests'
  if (h.startsWith('#/request')) return 'request'
  return 'home'
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [gone, setGone] = useState(false)
  const [route, setRoute] = useState(parseRoute)
  const [counts, setCounts] = useState(null)
  const [requests, setRequests] = useState([])
  const [device, setDevice] = useState(loadDevice)
  const [apiDown, setApiDown] = useState(false)
  const [prefill, setPrefill] = useState({ group: 'O+', city: 'Hangu' })

  const refresh = async () => {
    try {
      const [c, r] = await Promise.all([fetchCounts(), fetchRequests()])
      setCounts(c); setRequests(r); setApiDown(false)
    } catch { setApiDown(true) }
  }

  useEffect(() => {
    const a = setTimeout(() => setLoading(false), 2500)
    const b = setTimeout(() => setGone(true), 3150)
    refresh()
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])

  useEffect(() => { saveDevice(device) }, [device])

  useEffect(() => { if (route === 'requests' || route === 'home') refresh() }, [route])

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute())
      if (window.location.hash.startsWith('#/')) window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (r) => { window.location.hash = `#/${r}` }
  const goBoard = () => {
    if (route !== 'home') { go(''); setTimeout(() => document.querySelector('#board')?.scrollIntoView({ behavior: 'smooth' }), 350) }
    else document.querySelector('#board')?.scrollIntoView({ behavior: 'smooth' })
  }

  const addDonor = async (payload) => {
    const res = await registerDonor(payload)
    const saved = { ...payload, id: res.id, ready: res.ready, donations: 0 }
    setDevice((s) => ({ ...s, myDonors: [saved, ...s.myDonors] }))
    refresh()
    return saved
  }
  // Ye sirf is device ki list se hatata hai — server par donor ka record rehta hai
  const removeDonor = (id) => setDevice((s) => ({ ...s, myDonors: s.myDonors.filter((d) => d.id !== id) }))

  const createRequest = async (data) => {
    const res = await createBloodRequest(data)
    await refresh()
    return res.reqId
  }

  const acceptRequest = async (id, name, phone) => {
    try {
      const res = await acceptBloodRequest(id, { name, phone })
      setDevice((s) => ({
        ...s,
        myAccepts: { ...s.myAccepts, [id]: { code: res.code, attendantPhone: res.attendantPhone } },
      }))
      await refresh()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message || 'Server se rabta nahi ho raha — dobara try karo' }
    }
  }

  const confirmRequest = async (id, code) => {
    try {
      await confirmBloodRequest(id, code)
      await refresh()
      return true
    } catch {
      return false
    }
  }

  // Is device ke accept kiye hue codes requests ke sath jod kar dikhao
  const displayRequests = requests.map((r) => {
    const a = device.myAccepts[r.id]
    return a ? { ...r, code: a.code, attendantPhone: a.attendantPhone } : r
  })

  return (
    <div className="page">
      {!gone && <Splash done={!loading} />}

      <header className="header">
        <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); go('') }}>
          <svg width="27" height="27" viewBox="0 0 24 24"><path d="M12 2.7c3.2 4.1 6.5 8.3 6.5 12a6.5 6.5 0 1 1-13 0c0-3.7 3.3-7.9 6.5-12z" fill="#FF2E4D" /></svg>
          <span>HAR <b>BOOND</b></span>
        </a>
        <nav className="nav">
          <a href="#board" onClick={(e) => { e.preventDefault(); goBoard() }}>Lifeline Board</a>
          <a href="#/requests" onClick={(e) => { e.preventDefault(); go('requests') }}>Live Requests</a>
          <a href="#/request" onClick={(e) => { e.preventDefault(); go('request') }}>Request Lagao</a>
        </nav>
        <button className="btn btn-red btn-sm" onClick={() => go('register')}>Donor Bano</button>
      </header>

      {apiDown && (
        <div className="api-down">Server se rabta nahi ho raha — numbers aur requests abhi load nahi ho sakay. Thodi dair baad page refresh karo.</div>
      )}

      {route === 'home' && (
        <Home
          counts={counts}
          requests={[...displayRequests].sort((a, b) => b.postedAt - a.postedAt)}
          goRegister={() => go('register')}
          goRequest={(g, c) => { setPrefill({ group: g, city: c }); go('request') }}
          goRequests={() => go('requests')}
        />
      )}
      {route === 'register' && (
        <Register myDonors={device.myDonors} addDonor={addDonor} removeDonor={removeDonor} goBoard={goBoard} />
      )}
      {route === 'request' && (
        <NewRequest prefill={prefill} createRequest={createRequest} goRequests={() => go('requests')} />
      )}
      {route === 'requests' && (
        <RequestsPage requests={displayRequests} myDonor={device.myDonors[0] || null} acceptRequest={acceptRequest} confirmRequest={confirmRequest} />
      )}

      <footer className="footer">
        <div className="brand"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 2.7c3.2 4.1 6.5 8.3 6.5 12a6.5 6.5 0 1 1-13 0c0-3.7 3.3-7.9 6.5-12z" fill="#FF2E4D" /></svg><span>HAR <b>BOOND</b></span></div>
        <p>Har Boond sirf donor tak pohanchata hai. Donor theek hai ya nahi, is ka aakhri test hospital / blood bank hi karega.</p>
        <p className="foot-small">Photos: Pexels free photographers — FRANK MERIÑO, Kirill Dratsevich, Charlie-Helen Robinson • Hangu + Kohat, Khyber Pakhtunkhwa, Pakistan</p>
      </footer>
    </div>
  )
}
