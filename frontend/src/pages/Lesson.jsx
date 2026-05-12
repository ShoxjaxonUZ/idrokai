import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Check, CheckCircle2, ChevronLeft, ChevronRight,
    PlayCircle, BookOpen, Flag, Download, Paperclip,
    Lock, FileText
} from 'lucide-react'
import { API_URL, assetUrl } from '../lib/api'
import { safeUrl } from '../lib/safeUrl'
import Navbar from '../components/Navbar'
import '../styles/lesson.css'

function getYouTubeId(url) {
    if (!url || typeof url !== 'string') return null
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[7] && match[7].length === 11 ? match[7] : null
}

function getVimeoId(url) {
    if (!url || typeof url !== 'string') return null
    // Vimeo URL formatlari: vimeo.com/123456, player.vimeo.com/video/123456,
    // vimeo.com/channels/staffpicks/123456, vimeo.com/groups/name/videos/123456
    const m = url.match(/vimeo\.com(?:\/(?:channels\/[^/]+|groups\/[^/]+\/videos|video|album\/\d+\/video|))?\/(\d+)/i)
    return m && m[1] ? m[1] : null
}

function Lesson() {
    const { courseId, lessonIndex } = useParams()
    const navigate = useNavigate()
    const [course, setCourse] = useState(null)
    const [lesson, setLesson] = useState(null)
    const [completedLessons, setCompletedLessons] = useState([])
    const token = localStorage.getItem('token')
    const index = parseInt(lessonIndex)
    const [videoEnded, setVideoEnded] = useState(false)
    const [moduleTestStatus, setModuleTestStatus] = useState({})

    useEffect(() => {
        setVideoEnded(false)
        let cancelled = false

        const loadCourse = async () => {
            try {
                const res = await fetch(`${API_URL}/api/teacher/all-courses`)
                const data = await res.json()
                if (cancelled || !Array.isArray(data)) return
                const found = data.find(c => String(c.id) === String(courseId))
                if (!found) return

                const normalizedLessons = (found.lessons || []).map((l, i) => {
                    if (!l) return { title: `${i + 1}-dars`, videoUrl: '', description: '', materialUrl: '', materialName: '' }
                    if (typeof l === 'string') return { title: l, videoUrl: '', description: '', materialUrl: '', materialName: '' }
                    if (typeof l === 'object') return {
                        title: l.title || `${i + 1}-dars`,
                        videoUrl: l.videoUrl || l.video || '',
                        description: l.description || l.desc || '',
                        materialUrl: l.materialUrl || l.material || '',
                        materialName: l.materialName || l.material_name || ''
                    }
                    return { title: `${i + 1}-dars`, videoUrl: '', description: '', materialUrl: '', materialName: '' }
                })

                setCourse({ ...found, lessons: normalizedLessons })
                setLesson(normalizedLessons[index] || null)
                document.title = normalizedLessons[index]
                    ? `${normalizedLessons[index].title} — IdrokAI`
                    : 'Dars — IdrokAI'

                // Modul testlar holatini local normalizedLessons asosida yuklash (course state'iga bog'liq emas)
                if (token) {
                    const totalModules = Math.ceil(normalizedLessons.length / 5)
                    for (let i = 0; i < totalModules; i++) {
                        if (!cancelled) checkModuleTest(i)
                    }
                }
            } catch (err) {
                console.error(err)
            }

            if (token && !cancelled) {
                fetch(`${API_URL}/api/courses/progress/${courseId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                    .then(r => r.json())
                    .then(data => {
                        if (cancelled || !Array.isArray(data)) return
                        const done = data.filter(l => l.completed).map(l => l.lesson_index)
                        setCompletedLessons(done)
                    })
                    .catch(console.error)
            }
        }
        loadCourse()
        return () => { cancelled = true }
    }, [courseId, lessonIndex])

    const markLessonDone = async () => {
        if (!token || completedLessons.includes(index)) return

        try {
            const res = await fetch(`${API_URL}/api/courses/progress`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    course_id: isNaN(parseInt(courseId)) ? courseId : parseInt(courseId),
                    lesson_index: index,
                    completed: true,
                    total_lessons: course.lessons.length
                })
            })
            if (res.ok) {
                setCompletedLessons([...completedLessons, index])
            }
        } catch (err) {
            console.error(err)
        }
    }

    const checkModuleTest = async (moduleIdx) => {
        if (!token) return
        try {
            const res = await fetch(`${API_URL}/api/module-test/status/${courseId}/${moduleIdx}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (res.ok) {
                setModuleTestStatus(prev => ({ ...prev, [moduleIdx]: data }))
            }
        } catch (err) {
            console.error(err)
        }
    }

    const handleComplete = async () => {
        if (!token) return navigate('/login')
        const isCompleted = completedLessons.includes(index)
        try {
            const res = await fetch(`${API_URL}/api/courses/progress`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    course_id: isNaN(parseInt(courseId)) ? courseId : parseInt(courseId),
                    lesson_index: index,
                    completed: !isCompleted,
                    total_lessons: course.lessons.length
                })
            })
            if (res.ok) {
                setCompletedLessons(isCompleted
                    ? completedLessons.filter(i => i !== index)
                    : [...completedLessons, index]
                )
            }
        } catch (err) {
            console.error(err)
        }
    }

    const goNext = async () => {
        if (!videoEnded && !completedLessons.includes(index)) {
            return
        }

        await markLessonDone()

        const next = index + 1

        // Hozirgi modul oxiri (5-, 10-, 15- darslar)
        const currentModule = Math.floor(index / 5)
        const isLastInModule = (index + 1) % 5 === 0
        const hasMoreLessons = next < course.lessons.length

        // Agar 5-dars tugagan bo'lsa va keyingi modul bo'lsa — testga yo'naltirish
        if (isLastInModule && hasMoreLessons) {
            const status = moduleTestStatus[currentModule]

            if (!status?.passed) {
                // Test o'tilmagan — testga yo'naltirish
                navigate(`/courses/${courseId}/module-test/${currentModule}`)
                return
            }
        }

        // Oddiy keyingi dars
        if (hasMoreLessons) {
            navigate(`/courses/${courseId}/lessons/${next}`)
        } else {
            navigate(`/courses/${courseId}`)
        }
    }

    const goPrev = () => {
        if (index > 0) navigate(`/courses/${courseId}/lessons/${index - 1}`)
    }

    if (!course || !lesson) return (
        <div>
            <Navbar />
            <div style={{ textAlign: 'center', padding: '80px' }}>
                <h2>Dars topilmadi</h2>
                <button className="btn-primary" onClick={() => navigate(`/courses/${courseId}`)}>
                    Kursga qaytish
                </button>
            </div>
        </div>
    )

    const isDone = completedLessons.includes(index)
    const youTubeId = getYouTubeId(lesson.videoUrl)
    const vimeoId = getVimeoId(lesson.videoUrl)

    return (
        <div>
            <Navbar />
            <div className="lesson-layout">

                {/* Sidebar */}
                <div className="lesson-sidebar">
                    <div className="lesson-sidebar-header" onClick={() => navigate(`/courses/${courseId}`)} style={{ cursor: 'pointer' }}>
                        <span><BookOpen size={28} /></span>
                        <h3>{course.title}</h3>
                    </div>
                    <div className="lesson-list">
                        {course.lessons.map((l, i) => {
                            // Qulflash logikasi
                            const moduleOfLesson = Math.floor(i / 5)
                            const previousModule = moduleOfLesson - 1
                            const isLockedByTest = moduleOfLesson > 0 && !moduleTestStatus[previousModule]?.passed

                            return (
                                <div
                                    key={i}
                                    className={`lesson-list-item ${i === index ? 'lesson-list-active' : ''} ${completedLessons.includes(i) ? 'lesson-list-done' : ''} ${isLockedByTest ? 'lesson-list-locked' : ''}`}
                                    onClick={() => {
                                        if (isLockedByTest) {
                                            navigate(`/courses/${courseId}/module-test/${previousModule}`)
                                        } else {
                                            navigate(`/courses/${courseId}/lessons/${i}`)
                                        }
                                    }}
                                >
                                    <span className="lesson-list-num">
                                        {isLockedByTest ? <Lock size={14} /> : completedLessons.includes(i) ? <Check size={14} /> : i + 1}
                                    </span>
                                    <span className="lesson-list-title">{l.title}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Main */}
                <div className="lesson-main">
                    <div className="lesson-video-wrap">
                        {vimeoId ? (
                            <iframe
                                key={vimeoId}
                                className="lesson-video"
                                src={`https://player.vimeo.com/video/${vimeoId}`}
                                title={lesson.title}
                                frameBorder="0"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                                onLoad={() => setVideoEnded(true)}
                            />
                        ) : youTubeId ? (
                            <iframe
                                key={youTubeId}
                                className="lesson-video"
                                src={`https://www.youtube.com/embed/${youTubeId}`}
                                title={lesson.title}
                                frameBorder="0"
                                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                onLoad={() => setVideoEnded(true)}
                            />
                        ) : lesson.videoUrl ? (
                            <video
                                key={lesson.videoUrl}
                                src={safeUrl(assetUrl(lesson.videoUrl))}
                                controls
                                controlsList="nodownload"
                                className="lesson-video"
                                poster={assetUrl(course.image)}
                                onEnded={async () => {
                                    setVideoEnded(true)
                                    await markLessonDone()

                                    const isLastInModule = (index + 1) % 5 === 0
                                    const hasMoreLessons = (index + 1) < course.lessons.length
                                    const currentModule = Math.floor(index / 5)

                                    if (isLastInModule && hasMoreLessons && !moduleTestStatus[currentModule]?.passed) {
                                        setTimeout(() => {
                                            navigate(`/courses/${courseId}/module-test/${currentModule}`)
                                        }, 2000)
                                    }
                                }}
                            >
                                Brauzer video formatini qo'llab-quvvatlamaydi
                            </video>
                        ) : (
                            <div className="lesson-no-video">
                                <PlayCircle size={64} style={{ opacity: 0.5, marginRight: '12px' }} />
                                Video qo'shilmagan
                            </div>
                        )}
                    </div>

                    <div className="lesson-content">
                        <div className="lesson-top">
                            <div className="lesson-info">
                                <span className="lesson-badge">
                                    <BookOpen size={12} /> {index + 1} / {course.lessons.length} — dars
                                </span>
                                <h2 className="lesson-title">{lesson.title}</h2>
                                {lesson.description && (
                                    <p className="lesson-desc">{lesson.description}</p>
                                )}
                            </div>
                            {isDone && (
                                <div className="lesson-done-badge">
                                    <CheckCircle2 size={18} /> Bajarildi
                                </div>
                            )}
                        </div>

                        {/* Material yuklab olish */}
                        {lesson.materialUrl && (
                            <div className="lesson-material">
                                <div className="material-icon">
                                    <Paperclip size={24} />
                                </div>
                                <div className="material-info">
                                    <div className="material-title">Dars materiallari</div>
                                    <div className="material-name">{lesson.materialName || 'Fayl'}</div>
                                </div>
                                <a
                                    href={safeUrl(assetUrl(lesson.materialUrl))}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="btn-primary material-download-btn"
                                >
                                    <Download size={16} /> Yuklab olish
                                </a>
                            </div>
                        )}

                        {/* Navigatsiya */}
                        <div className="lesson-nav">
                            <button
                                className="btn-outline"
                                onClick={goPrev}
                                disabled={index === 0}
                                style={{ opacity: index === 0 ? 0.4 : 1 }}
                            >
                                <ChevronLeft size={16} /> Oldingi dars
                            </button>
                            <button
                                className="btn-primary"
                                onClick={goNext}
                                disabled={!videoEnded && !completedLessons.includes(index)}
                                style={{ opacity: (!videoEnded && !completedLessons.includes(index)) ? 0.5 : 1 }}
                            >
                                {(() => {
                                    const isLastInModule = (index + 1) % 5 === 0
                                    const hasMoreLessons = (index + 1) < course.lessons.length
                                    const currentModule = Math.floor(index / 5)
                                    const testNeeded = isLastInModule && hasMoreLessons && !moduleTestStatus[currentModule]?.passed

                                    if (testNeeded) {
                                        return <><FileText size={16} /> Modul testiga o'tish</>
                                    }
                                    if (!hasMoreLessons) {
                                        return <><Flag size={16} /> Kursga qaytish</>
                                    }
                                    return <>Keyingi dars <ChevronRight size={16} /></>
                                })()}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div >
    )
}

export default Lesson