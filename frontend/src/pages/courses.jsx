import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, GraduationCap, BookOpen, Clock, Users,
  Star, Play, BarChart3, Tag, TrendingUp, Sparkles, X
} from 'lucide-react'
import { API_URL, assetUrl } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Loading from '../components/Loading'
import '../styles/courses.css'

const categories = ["Barchasi", "Dasturlash", "Fan", "Til", "Dizayn", "Biznes", "Boshqa"]
const levels = ["Barchasi", "Boshlang'ich", "O'rta", "Yuqori"]

function Courses() {
  const navigate = useNavigate()
  const [active, setActive] = useState("Barchasi")
  const [activeLevel, setActiveLevel] = useState("Barchasi")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("popular")
  const [loading, setLoading] = useState(true)
  const [allCourses, setAllCourses] = useState([])

  useEffect(() => {
    document.title = "Kurslar — Eduzy"
    fetch(`${API_URL}/api/teacher/all-courses`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllCourses(data)
          localStorage.setItem('courses', JSON.stringify(data))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = allCourses
    .filter(k => {
      const categoryMatch = active === "Barchasi" || k.category === active
      const levelMatch = activeLevel === "Barchasi" || k.daraja === activeLevel
      const searchMatch = k.title.toLowerCase().includes(search.toLowerCase())
      return categoryMatch && levelMatch && searchMatch
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return (b.id > a.id ? 1 : -1)
      if (sortBy === 'lessons') return (b.lessons?.length || 0) - (a.lessons?.length || 0)
      if (sortBy === 'rating') return (b.avg_rating || 0) - (a.avg_rating || 0)
      return 0
    })

  if (loading) return (
    <div><Navbar /><Loading text="Kurslar yuklanmoqda..." /></div>
  )

  return (
    <div>
      <Navbar />

      {/* Hero */}
      <div className="courses-hero">
        <div className="courses-hero-inner">
          <div className="courses-hero-badge">
            <GraduationCap size={14} /> {allCourses.length}+ kurs mavjud
          </div>
          <h1>
            Barcha kurslarni <span className="gradient-text">o'rganing</span>
          </h1>
          <p>Professional o'qituvchilardan sifatli ta'lim. Istalgan vaqtda, istalgan joyda.</p>

          <div className="search-wrap">
            <Search size={18} className="search-icon" />
            <input
              className="search-input-new"
              placeholder="Python, JavaScript, Matematika..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="courses-page">

        {/* Filterlar */}
        <div className="filter-bar">
          <div className="filter-group">
            <label className="filter-label">
              <Tag size={14} /> Kategoriya
            </label>
            <div className="categories">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`cat-btn ${active === cat ? 'cat-active' : ''}`}
                  onClick={() => setActive(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <BarChart3 size={14} /> Daraja
            </label>
            <div className="categories">
              {levels.map(lvl => (
                <button
                  key={lvl}
                  className={`cat-btn ${activeLevel === lvl ? 'cat-active' : ''}`}
                  onClick={() => setActiveLevel(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Natija va sort */}
        <div className="results-bar">
          <div className="results-count">
            <strong>{filtered.length}</strong> ta kurs topildi
          </div>
          <div className="sort-wrap">
            <label>Saralash:</label>
            <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="popular">Mashhur</option>
              <option value="newest">Yangi</option>
              <option value="rating">Reyting</option>
              <option value="lessons">Darslar soni</option>
            </select>
          </div>
        </div>

        {/* Kurslar */}
        {filtered.length === 0 ? (
          <div className="no-results">
            <div className="no-results-icon">
              <Search size={48} />
            </div>
            <h3>Hech narsa topilmadi</h3>
            <p>Boshqa kalit so'z yoki filter bilan qidiring</p>
            <button className="btn-primary" onClick={() => {
              setSearch('')
              setActive('Barchasi')
              setActiveLevel('Barchasi')
            }}>
              <X size={16} /> Filterlarni tozalash
            </button>
          </div>
        ) : (
          <div className="course-grid">
            {filtered.map(kurs => (
              <div key={kurs.id} className="course-card" onClick={() => navigate(`/courses/${kurs.id}`)}>
                <div className="course-thumb">
                  {kurs.image ? (
                    <img src={assetUrl(kurs.image)} alt={kurs.title} className="course-thumb-img" />
                  ) : (
                    <div className="course-thumb-empty">
                      <BookOpen size={48} />
                    </div>
                  )}
                  <div className="course-badge-new">
                    <Sparkles size={12} /> Bepul
                  </div>
                  <div className="course-overlay">
                    <button className="btn-primary">
                      <Play size={16} /> Ko'rish
                    </button>
                  </div>
                </div>

                <div className="course-body">
                  <div className="course-tags">
                    <span className="tag tag-category">{kurs.category}</span>
                    <span className="tag tag-level">
                      <BarChart3 size={11} /> {kurs.daraja}
                    </span>
                  </div>

                  <h3 className="course-title">{kurs.title}</h3>
                  <p className="course-desc">
                    {(kurs.desc || kurs.description || '').substring(0, 80)}
                    {(kurs.desc || kurs.description || '').length > 80 ? '...' : ''}
                  </p>

                  <div className="course-rating">
                    {kurs.ratings_count > 0 ? (
                      <span className="rating-stars">
                        <Star size={14} fill="currentColor" /> <strong>{kurs.avg_rating.toFixed(1)}</strong>
                        <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({kurs.ratings_count})</span>
                      </span>
                    ) : (
                      <span className="rating-stars" style={{ opacity: 0.5 }}>
                        <Star size={14} /> <strong>Yangi</strong>
                      </span>
                    )}
                    <span className="rating-students">
                      <Users size={12} /> {kurs.students_count || 0} o'quvchi
                    </span>
                  </div>

                  <div className="course-footer">
                    <div className="course-stats">
                      <span><BookOpen size={13} /> {kurs.lessons?.length || kurs.darslar || 0} dars</span>
                      <span><Clock size={13} /> ~{Math.max(2, (kurs.lessons?.length || 1) * 1)}s</span>
                    </div>
                    <div className="course-price">Bepul</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default Courses