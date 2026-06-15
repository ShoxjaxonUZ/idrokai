import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Briefcase, Award, Flame, Star, BookOpen, Trophy, Code2, Send,
  Plus, Pencil, Trash2, ExternalLink, Check, X, ShieldCheck, Link2, Save
} from 'lucide-react'
import { API_URL, apiGet, apiPut, apiPost, apiDelete, getUser } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const initial = (name) => (name && name.trim()[0] ? name.trim()[0].toUpperCase() : '?')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('uz-UZ') : ''

const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }
const input = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }
const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: 'var(--primary)', color: '#fff' }
const ghostBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 13, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }

function StatChip({ Icon, value, label, color }) {
  return (
    <div style={{ ...card, padding: 14, textAlign: 'center', flex: 1, minWidth: 90 }}>
      <Icon size={20} color={color} />
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function Portfolio() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const me = getUser()
  const isOwn = !userId || (me && String(me.id) === String(userId))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [pf, setPf] = useState({ headline: '', bio: '', github_url: '', telegram_url: '', looking_for_work: false })
  const [proj, setProj] = useState(null)        // {id?, title, description, url, tech}
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setNotFound(false)
    try {
      let d
      if (isOwn) {
        d = await apiGet('/api/portfolio/me')
      } else {
        const res = await fetch(`${API_URL}/api/portfolio/${userId}`)
        d = res.ok ? await res.json() : null
      }
      if (!d) { setNotFound(true) }
      else {
        setData(d)
        setPf({
          headline: d.portfolio?.headline || '', bio: d.portfolio?.bio || '',
          github_url: d.portfolio?.github_url || '', telegram_url: d.portfolio?.telegram_url || '',
          looking_for_work: !!d.portfolio?.looking_for_work
        })
      }
    } catch { setNotFound(true) }
    setLoading(false)
  }, [isOwn, userId])

  useEffect(() => { document.title = 'Portfel — Eduzy'; load() }, [load])

  const saveProfile = async () => {
    setSaving(true)
    try { await apiPut('/api/portfolio/me', pf); setEditProfile(false); await load() }
    catch (e) { alert(e.message || 'Xatolik') }
    setSaving(false)
  }

  const submitProject = async () => {
    if (!proj || proj.title.trim().length < 2) return alert("Loyiha nomini kiriting (kamida 2 belgi)")
    setSaving(true)
    try {
      if (proj.id) await apiPut(`/api/portfolio/projects/${proj.id}`, proj)
      else await apiPost('/api/portfolio/projects', proj)
      setProj(null); await load()
    } catch (e) { alert(e.message || 'Xatolik') }
    setSaving(false)
  }

  const deleteProject = async (id) => {
    if (!window.confirm("Loyihani o'chirilsinmi?")) return
    try { await apiDelete(`/api/portfolio/projects/${id}`); await load() } catch (e) { alert(e.message) }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portfolio/${data.user.id}`)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  if (loading) return <div><Navbar /><p style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Yuklanmoqda…</p></div>
  if (notFound || !data) return (
    <div><Navbar />
      <div style={{ textAlign: 'center', padding: 80 }}>
        <h2>Portfel topilmadi</h2>
        <button style={primaryBtn} onClick={() => navigate('/')}>Bosh sahifa</button>
      </div>
    </div>
  )

  const { user, portfolio, projects, certificates, stats } = data

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 18px 60px' }}>

        {/* ===== Profil sarlavhasi ===== */}
        <div style={{ ...card, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800,
            background: 'linear-gradient(135deg, #5B5BD6, #A78BFA, #F472B6)'
          }}>{initial(user.name)}</div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 24 }}>{user.name}</h1>
              {portfolio.looking_for_work && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#0F9D7715', color: '#0F9D77', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  <ShieldCheck size={13} /> Ish qidiryapman
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--primary)', fontWeight: 600 }}>
              {portfolio.headline || (isOwn ? 'Sarlavha qo\'shing (masalan: Junior Frontend Developer)' : 'Eduzy o\'quvchisi')}
            </p>
            {portfolio.bio && <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', lineHeight: 1.5 }}>{portfolio.bio}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {portfolio.github_url && <a href={portfolio.github_url} target="_blank" rel="noopener noreferrer" style={ghostBtn}><Code2 size={15} /> GitHub</a>}
              {portfolio.telegram_url && <a href={portfolio.telegram_url} target="_blank" rel="noopener noreferrer" style={ghostBtn}><Send size={15} /> Telegram</a>}
              {isOwn && <button style={ghostBtn} onClick={() => setEditProfile(v => !v)}><Pencil size={15} /> Tahrirlash</button>}
              {isOwn && <button style={ghostBtn} onClick={copyLink}><Link2 size={15} /> {copied ? 'Nusxalandi!' : 'Ulashish'}</button>}
            </div>
          </div>
        </div>

        {/* ===== Profil tahrirlash formasi ===== */}
        {isOwn && editProfile && (
          <div style={{ ...card, marginTop: 14, display: 'grid', gap: 10 }}>
            <input style={input} placeholder="Sarlavha — masalan: Junior Frontend Developer" maxLength={120}
              value={pf.headline} onChange={e => setPf({ ...pf, headline: e.target.value })} />
            <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} placeholder="O'zingiz haqingizda qisqacha…" maxLength={600}
              value={pf.bio} onChange={e => setPf({ ...pf, bio: e.target.value })} />
            <input style={input} placeholder="GitHub havola (https://github.com/…)"
              value={pf.github_url} onChange={e => setPf({ ...pf, github_url: e.target.value })} />
            <input style={input} placeholder="Telegram havola (https://t.me/…)"
              value={pf.telegram_url} onChange={e => setPf({ ...pf, telegram_url: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={pf.looking_for_work} onChange={e => setPf({ ...pf, looking_for_work: e.target.checked })} />
              Ish/amaliyot qidiryapman (portfelimda ko'rinsin)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={primaryBtn} disabled={saving} onClick={saveProfile}><Save size={15} /> Saqlash</button>
              <button style={ghostBtn} onClick={() => setEditProfile(false)}>Bekor</button>
            </div>
          </div>
        )}

        {/* ===== Yutuqlar (avtomatik) ===== */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <StatChip Icon={Award} value={stats.certificates} label="Sertifikat" color="#DC8B1A" />
          <StatChip Icon={BookOpen} value={stats.courses} label="Kurs" color="#5B5BD6" />
          <StatChip Icon={Flame} value={stats.streak} label="Streak" color="#EC4899" />
          <StatChip Icon={Trophy} value={stats.battle_rating} label="Battle reyting" color="#0F9D77" />
        </div>

        {/* ===== Loyihalar ===== */}
        <div style={{ ...card, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><Briefcase size={18} color="var(--primary)" /> Loyihalar</h3>
            {isOwn && !proj && <button style={primaryBtn} onClick={() => setProj({ title: '', description: '', url: '', tech: '' })}><Plus size={15} /> Qo'shish</button>}
          </div>

          {/* Loyiha formasi */}
          {isOwn && proj && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 14, marginBottom: 14, display: 'grid', gap: 9 }}>
              <input style={input} placeholder="Loyiha nomi" maxLength={120} value={proj.title} onChange={e => setProj({ ...proj, title: e.target.value })} />
              <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} placeholder="Qisqa tavsif — nima qildingiz?" maxLength={800} value={proj.description} onChange={e => setProj({ ...proj, description: e.target.value })} />
              <input style={input} placeholder="Havola (https://… — GitHub, demo, video)" value={proj.url} onChange={e => setProj({ ...proj, url: e.target.value })} />
              <input style={input} placeholder="Texnologiyalar (masalan: React, Node.js)" maxLength={120} value={proj.tech} onChange={e => setProj({ ...proj, tech: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={primaryBtn} disabled={saving} onClick={submitProject}><Check size={15} /> {proj.id ? 'Saqlash' : "Qo'shish"}</button>
                <button style={ghostBtn} onClick={() => setProj(null)}><X size={15} /> Bekor</button>
              </div>
            </div>
          )}

          {projects.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              {isOwn ? "Hali loyiha yo'q. Birinchi loyihangizni qo'shing — ish beruvchiga ko'rsatadigan dalil!" : "Loyihalar hali qo'shilmagan."}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {projects.map(pr => (
                <div key={pr.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontWeight: 700 }}>{pr.title}</div>
                    {isOwn && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button style={{ ...ghostBtn, padding: 6 }} onClick={() => setProj({ id: pr.id, title: pr.title, description: pr.description || '', url: pr.url || '', tech: pr.tech || '' })}><Pencil size={14} /></button>
                        <button style={{ ...ghostBtn, padding: 6 }} onClick={() => deleteProject(pr.id)}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                  {pr.description && <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>{pr.description}</p>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {pr.tech && <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{pr.tech}</span>}
                    {pr.url && <a href={pr.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ExternalLink size={13} /> Ko'rish</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== Sertifikatlar (avtomatik, real dalil) ===== */}
        <div style={{ ...card, marginTop: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px' }}><Award size={18} color="#DC8B1A" /> Sertifikatlar</h3>
          {certificates.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              {isOwn ? "Kursni tugatib birinchi sertifikatingizni oling — u shu yerda avtomatik ko'rinadi." : "Hali sertifikat yo'q."}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {certificates.map(c => (
                <div key={c.cert_code} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: '#DC8B1A1A', color: '#DC8B1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Award size={18} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{c.course_title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(c.issued_at)}</div>
                  </div>
                  <a href={`/verify/${c.cert_code}`} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, padding: '6px 10px' }}>
                    <ShieldCheck size={14} /> Tekshirish
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Natija halqasi — CTA (faqat o'z portfelida) */}
        {isOwn && (
          <div style={{ ...card, marginTop: 20, textAlign: 'center', background: 'var(--surface)' }}>
            <p style={{ margin: '0 0 10px', color: 'var(--text-muted)' }}>
              Portfelingni do'stlaringga va ish beruvchilarga ulashing — bu sening natijang.
            </p>
            <button style={primaryBtn} onClick={copyLink}><Link2 size={15} /> {copied ? 'Havola nusxalandi!' : 'Havolani nusxalash'}</button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default Portfolio
