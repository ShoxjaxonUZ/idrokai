import { useRef, useMemo } from 'react'

const KEYWORDS = new Set([
  'function','return','if','else','for','while','var','let','const',
  'def','class','import','from','as','in','not','and','or',
  'true','false','True','False','None','null','undefined',
  'new','this','self','public','private','static','void',
  'int','string','bool','float','double','async','await',
  'try','catch','except','finally','throw','raise','break','continue',
  'pass','lambda','yield','with','elif'
])

// Token tipini aniqlovchi xavfsiz tokenizer.
// React elementlari yaratadi, hech qachon HTML inject qilinmaydi.
function tokenize(code) {
  const tokens = []
  let i = 0
  const n = code.length

  while (i < n) {
    const ch = code[i]

    // Yangi qator
    if (ch === '\n') { tokens.push({ type: 'plain', text: '\n' }); i++; continue }

    // Comment: // ... or # ...
    if ((ch === '/' && code[i + 1] === '/') || ch === '#') {
      let j = i
      while (j < n && code[j] !== '\n') j++
      tokens.push({ type: 'comment', text: code.slice(i, j) })
      i = j
      continue
    }

    // String: "..." '...' `...`
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      let j = i + 1
      while (j < n) {
        if (code[j] === '\\') { j += 2; continue }
        if (code[j] === quote) { j++; break }
        if (code[j] === '\n' && quote !== '`') { break }
        j++
      }
      tokens.push({ type: 'string', text: code.slice(i, j) })
      i = j
      continue
    }

    // Number
    if (ch >= '0' && ch <= '9') {
      let j = i
      while (j < n && (/[0-9.]/.test(code[j]))) j++
      tokens.push({ type: 'number', text: code.slice(i, j) })
      i = j
      continue
    }

    // Identifier / keyword / function
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i
      while (j < n && /[A-Za-z0-9_$]/.test(code[j])) j++
      const word = code.slice(i, j)
      let type = 'plain'
      if (KEYWORDS.has(word)) type = 'keyword'
      else if (code[j] === '(') type = 'function'
      tokens.push({ type, text: word })
      i = j
      continue
    }

    // Boshqa belgilar — bittadan
    tokens.push({ type: 'plain', text: ch })
    i++
  }

  return tokens
}

const CLASS_FOR = {
  comment: 'syn-comment',
  string: 'syn-string',
  number: 'syn-number',
  keyword: 'syn-keyword',
  function: 'syn-function',
  plain: ''
}

function CodeEditor({ code = '', setCode, language = 'python' }) {
  const safeCode = code || ''
  const lines = safeCode.split('\n')
  const lineNumbers = lines.map((_, i) => i + 1).join('\n')
  const textareaRef = useRef(null)
  const highlightRef = useRef(null)
  const linesRef = useRef(null)

  const tokens = useMemo(() => tokenize(safeCode), [safeCode])

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart
      const end = e.target.selectionEnd
      const newCode = safeCode.substring(0, start) + '    ' + safeCode.substring(end)
      setCode(newCode)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4
        }
      }, 0)
    }
  }

  const handleScroll = () => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
    if (linesRef.current && textareaRef.current) {
      linesRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  return (
    <div className="code-editor-wrapper">
      <div className="code-lines" ref={linesRef}>
        <pre>{lineNumbers}</pre>
      </div>
      <div className="code-editor-inner">
        <pre className="code-highlight" ref={highlightRef}>
          {tokens.map((t, idx) => {
            const cls = CLASS_FOR[t.type]
            return cls
              ? <span key={idx} className={cls}>{t.text}</span>
              : <span key={idx}>{t.text}</span>
          })}
          {'\n'}
        </pre>
        <textarea
          ref={textareaRef}
          className="code-textarea"
          value={safeCode}
          onChange={e => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          data-lang={language}
        />
      </div>
    </div>
  )
}

export default CodeEditor
