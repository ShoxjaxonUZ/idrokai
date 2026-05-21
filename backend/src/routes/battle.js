const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')
const { extractAndParseJson } = require('../lib/jsonParse')
const notifications = require('../lib/notifications')

const { groqFetch } = require('../lib/groq')

const MAX_CODE_LEN = 10000

// HTML/CSS preview iframe uchun standart skafold (newlines kafolatlanadi)
const HTML_SCAFFOLD = (body, css) => `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<style>
${(css || '/* CSS shu yerga */').trim()}
</style>
</head>
<body>
${(body || '<!-- HTML shu yerga -->').trim()}
</body>
</html>`

// React preview iframe uchun komponent template
const REACT_TEMPLATE = (componentCode = '') => `${componentCode}

ReactDOM.createRoot(document.getElementById('__root')).render(<App />);`

const PROBLEMS = {
  python: [
    // === OSON ===
    {
      id: 'py-e1', difficulty: 'oson', title: "Sonlar yig'indisi",
      text: `Berilgan ikki sonni qo'shing va natijani qaytaring.\n\nMisol:\nsum(3, 5) → 8`,
      template: `def sum(a, b):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(sum(3, 5))`
    },
    {
      id: 'py-e2', difficulty: 'oson', title: "Salomlashish",
      text: `Berilgan ismni qabul qilib, 'Salom, ISM!' qaytaring.\n\nMisol:\ngreet('Ali') → 'Salom, Ali!'`,
      template: `def greet(name):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(greet('Ali'))`
    },
    // === ORTA ===
    {
      id: 'py-m1', difficulty: 'orta', title: "Eng katta son",
      text: `Berilgan ro'yxatdan eng katta sonni toping.\n\nMisol:\nmax_num([1, 5, 3, 9, 2]) → 9`,
      template: `def max_num(nums):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(max_num([1, 5, 3, 9, 2]))`
    },
    {
      id: 'py-m2', difficulty: 'orta', title: "Palindrom",
      text: `So'z palindrom yoki yo'qligini tekshiring.\n\nMisol:\nis_palindrom("madam") → True`,
      template: `def is_palindrom(word):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(is_palindrom("madam"))`
    },
    {
      id: 'py-m3', difficulty: 'orta', title: "Faktorial",
      text: `N sonning faktorialini hisoblang.\nN! = 1*2*3*...*N\n\nMisol:\nfactorial(5) → 120`,
      template: `def factorial(n):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(factorial(5))`
    },
    // === QIYIN ===
    {
      id: 'py-h1', difficulty: 'qiyin', title: "Tublik tekshiruvi",
      text: `Sonning tub son ekanligini tekshiring.\n\nMisol:\nis_prime(7) → True\nis_prime(8) → False`,
      template: `def is_prime(n):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(is_prime(7))`
    },
    {
      id: 'py-h2', difficulty: 'qiyin', title: "Anagram",
      text: `Ikki so'z anagram (bir xil harflardan) ekanligini aniqlang.\n\nMisol:\nis_anagram("listen", "silent") → True`,
      template: `def is_anagram(a, b):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(is_anagram("listen", "silent"))`
    }
  ],
  javascript: [
    // === OSON ===
    {
      id: 'js-e1', difficulty: 'oson', title: "Sonlar yig'indisi",
      text: `Ikki sonni qo'shing.\n\nsum(3, 5) → 8`,
      template: `function sum(a, b) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(sum(3, 5));`
    },
    {
      id: 'js-e2', difficulty: 'oson', title: "String uzunligi",
      text: `Stringning uzunligini qaytaring.\n\nstrLen("hello") → 5`,
      template: `function strLen(s) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(strLen("hello"));`
    },
    // === ORTA ===
    {
      id: 'js-m1', difficulty: 'orta', title: "Eng katta son",
      text: `Massivdan eng katta sonni toping.\n\nmaxNum([1, 5, 3, 9]) → 9`,
      template: `function maxNum(nums) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(maxNum([1, 5, 3, 9]));`
    },
    {
      id: 'js-m2', difficulty: 'orta', title: "Massivni teskari",
      text: `Massivni teskari aylantiring.\n\nreverse([1,2,3,4]) → [4,3,2,1]`,
      template: `function reverse(arr) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(reverse([1,2,3,4]));`
    },
    {
      id: 'js-m3', difficulty: 'orta', title: "Unli harflar",
      text: `String dagi unli harflar (a,e,i,o,u) sonini hisoblang.\n\ncountVowels("hello") → 2`,
      template: `function countVowels(str) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(countVowels("hello"));`
    },
    // === QIYIN ===
    {
      id: 'js-h1', difficulty: 'qiyin', title: "Fibonachchi",
      text: `Fibonachchi N-elementi.\n1, 1, 2, 3, 5, 8, 13, 21...\n\nfib(8) → 21`,
      template: `function fib(n) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(fib(8));`
    },
    {
      id: 'js-h2', difficulty: 'qiyin', title: "Eng uzun so'z",
      text: `Jumladan eng uzun so'zni qaytaring.\n\nlongestWord("bu eng katta so'z") → "katta"`,
      template: `function longestWord(s) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(longestWord("bu eng katta so'z"));`
    }
  ],
  typescript: [
    // === OSON ===
    {
      id: 'ts-e1', difficulty: 'oson', title: "Tip annotation",
      text: `sum funksiyasini number tiplari bilan yozing.\n\nsum(3, 5) → 8`,
      template: `function sum(a: number, b: number): number {\n    // Kodingizni shu yerga yozing\n    return 0;\n}\n\nconsole.log(sum(3, 5));`
    },
    {
      id: 'ts-e2', difficulty: 'oson', title: "Interface",
      text: `User interface yarating va getName funksiyasini yozing.\n\nUser: { name: string, age: number }\ngetName({name:'Ali',age:20}) → 'Ali'`,
      template: `interface User {\n    // shu yerga maydonlar\n}\n\nfunction getName(u: User): string {\n    // shu yerga\n    return '';\n}\n\nconsole.log(getName({name:'Ali', age:20}));`
    },
    // === ORTA ===
    {
      id: 'ts-m1', difficulty: 'orta', title: "Generic funksiya",
      text: `Generic <T> bilan massivning birinchi elementini qaytaruvchi funksiya.\n\nfirst([1,2,3]) → 1\nfirst(['a','b']) → 'a'`,
      template: `function first<T>(arr: T[]): T | undefined {\n    // Kodingizni shu yerga yozing\n    return undefined;\n}\n\nconsole.log(first([1,2,3]));\nconsole.log(first(['a','b']));`
    },
    {
      id: 'ts-m2', difficulty: 'orta', title: "Union type",
      text: `string | number qabul qiluvchi funksiya. String bo'lsa parseInt, son bo'lsa 0 qaytaring.\n\nparseValue("42") → 42\nparseValue(99) → 0`,
      template: `function parseValue(v: string | number): number {\n    // Kodingizni shu yerga yozing\n    return 0;\n}\n\nconsole.log(parseValue("42"));\nconsole.log(parseValue(99));`
    },
    // === QIYIN ===
    {
      id: 'ts-h1', difficulty: 'qiyin', title: "Filter generic",
      text: `Generic filterArr<T> — predicate true bo'lgan elementlarni qaytaradi.\n\nfilterArr([1,2,3,4], x => x > 2) → [3,4]`,
      template: `function filterArr<T>(arr: T[], pred: (x: T) => boolean): T[] {\n    // Kodingizni shu yerga yozing\n    return [];\n}\n\nconsole.log(filterArr([1,2,3,4], x => x > 2));`
    }
  ],
  react: [
    // === OSON ===
    {
      id: 'rx-e1', difficulty: 'oson', title: "Salom komponent",
      text: `App komponenti.\n\n- "Salom, React!" matnini h1 ichida ko'rsating`,
      template: REACT_TEMPLATE(`function App() {\n  // Kodingizni shu yerga yozing\n  return <div>...</div>;\n}`)
    },
    {
      id: 'rx-e2', difficulty: 'oson', title: "Props",
      text: `Greet komponenti props.name ni qabul qilib "Salom, NAME!" chiqaradi.\n\n<Greet name="Ali" /> → "Salom, Ali!"`,
      template: REACT_TEMPLATE(`function Greet(props) {\n  // Kodingizni shu yerga yozing\n  return <div>...</div>;\n}\n\nfunction App() {\n  return <Greet name="Ali" />;\n}`)
    },
    // === ORTA ===
    {
      id: 'rx-m1', difficulty: 'orta', title: "Counter (useState)",
      text: `useState bilan Counter.\n\n- "Bosishlar: N" matni\n- Tugma bosilganda N oshadi`,
      template: REACT_TEMPLATE(`function App() {\n  // React.useState ishlating\n  return <div>...</div>;\n}`)
    },
    {
      id: 'rx-m2', difficulty: 'orta', title: "Controlled input",
      text: `Input va h2 — foydalanuvchi yozgan matn h2 da real vaqtda chiqsin.\n\n- useState\n- input + h2`,
      template: REACT_TEMPLATE(`function App() {\n  // Controlled input + h2\n  return <div>...</div>;\n}`)
    },
    // === QIYIN ===
    {
      id: 'rx-h1', difficulty: 'qiyin', title: "Todo list",
      text: `Todo list:\n- input + qo'shish tugmasi\n- ro'yxat\n- har birida o'chirish tugmasi`,
      template: REACT_TEMPLATE(`function App() {\n  // useState bilan ro'yxat boshqaring\n  return <div>...</div>;\n}`)
    }
  ],
  html: [
    // === OSON ===
    {
      id: 'html-e1', difficulty: 'oson', title: "Tugma yaratish",
      text: `"Bosing" matnli tugma.\n\nTalab:\n- Yashil fon (#22c55e)\n- Oq matn\n- 10px ichki bo'shliq\n- Yumaloq burchaklar (8px)`,
      template: HTML_SCAFFOLD('<!-- shu yerga button -->', '/* shu yerga stil */')
    },
    {
      id: 'html-e2', difficulty: 'oson', title: "Sarlavha + paragraf",
      text: `Sahifa yarating:\n- h1: "Mening sayam"\n- p: 2 jumla matn\n- markazlashtirilgan`,
      template: HTML_SCAFFOLD('<!-- shu yerga h1 va p -->', 'body { text-align: center; font-family: sans-serif; }')
    },
    // === ORTA ===
    {
      id: 'html-m1', difficulty: 'orta', title: "Profil karta",
      text: `Profil kartasi:\n- Ism (h2)\n- Qisqa tavsif (p)\n- Soya bilan\n- 300px keng, oq fon`,
      template: HTML_SCAFFOLD('<!-- shu yerga karta -->', '/* shu yerga stil */')
    },
    {
      id: 'html-m2', difficulty: 'orta', title: "Ro'yxat",
      text: `3 ta vazifa bilan ul:\n- "Birinchi vazifa"\n- "Ikkinchi vazifa"\n- "Uchinchi vazifa"\n\nHar bir li chap tomonda • bilan`,
      template: HTML_SCAFFOLD('<!-- shu yerga ul -->', 'ul { list-style: disc; padding-left: 20px; }')
    },
    // === QIYIN ===
    {
      id: 'html-h1', difficulty: 'qiyin', title: "Login forma",
      text: `Login formani yarating:\n- Email input (type=email)\n- Parol input (type=password)\n- "Kirish" tugma\n- Forma markazda, ramka va soya bilan`,
      template: HTML_SCAFFOLD('<!-- shu yerga forma -->', '/* shu yerga stil */')
    }
  ],
  css: [
    // === OSON ===
    {
      id: 'css-e1', difficulty: 'oson', title: "Markazga joylash",
      text: `.box klassini ekran markaziga joylang (flexbox yoki grid).\n\nQuti 200x200px, ko'k fonli (#5B5BD6).`,
      template: HTML_SCAFFOLD('<div class="box">Quti</div>', `body {\n  margin: 0;\n  min-height: 100vh;\n}\n\n.box {\n  width: 200px;\n  height: 200px;\n  background: #5B5BD6;\n  /* shu yerga markazga joylash */\n}`)
    },
    {
      id: 'css-e2', difficulty: 'oson', title: "Rang va matn",
      text: `Tayyor h1 ni quyidagicha bezing:\n- Ko'k rang (#0ea5e9)\n- 32px o'lcham\n- Qalin\n- Markazda`,
      template: HTML_SCAFFOLD('<h1>Salom dunyo</h1>', `h1 {\n  /* shu yerga */\n}`)
    },
    // === ORTA ===
    {
      id: 'css-m1', difficulty: 'orta', title: "Tugma stili",
      text: `Tugmaga gradient stil bering:\n- Fon: linear-gradient(135deg, #6366f1, #ec4899)\n- Oq matn, qalin\n- Hover'da rangini o'zgartiring\n- Yumaloq burchaklar (8px)`,
      template: HTML_SCAFFOLD('<button class="btn">Bosing</button>', `body {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n  margin: 0;\n}\n\n.btn {\n  /* shu yerga */\n}`)
    },
    {
      id: 'css-m2', difficulty: 'orta', title: "Card grid",
      text: `3 ta karta — grid bilan tartiblang:\n- 3 ta ustun\n- 16px gap\n- Har bir karta oq fon, ramka, soya bilan`,
      template: HTML_SCAFFOLD('<div class="grid">\n  <div class="card">1</div>\n  <div class="card">2</div>\n  <div class="card">3</div>\n</div>', `body { padding: 20px; background: #f1f5f9; }\n\n.grid {\n  /* shu yerga */\n}\n\n.card {\n  /* shu yerga */\n}`)
    },
    // === QIYIN ===
    {
      id: 'css-h1', difficulty: 'qiyin', title: "Hover animatsiya",
      text: `Kartaga smooth hover effekti:\n- Hover'da 8px yuqori ko'tariladi\n- Soya kattalashadi\n- Transition 0.3s ease\n- Border-radius 12px`,
      template: HTML_SCAFFOLD('<div class="card">\n  <h3>Sarlavha</h3>\n  <p>Karta matni</p>\n</div>', `body { display: flex; justify-content: center; padding-top: 80px; background: #f8fafc; }\n\n.card {\n  width: 280px;\n  padding: 20px;\n  background: #fff;\n  /* shu yerga animatsiya */\n}`)
    }
  ],
  cpp: [
    // === OSON ===
    {
      id: 'cpp-e1', difficulty: 'oson', title: "Sonlar yig'indisi",
      text: `Ikki son yig'indisini chiqaring.\n\nMisol:\n3 + 5 → 8`,
      template: `#include <iostream>\nusing namespace std;\n\nint sum(int a, int b) {\n    // Kodingizni shu yerga yozing\n    return 0;\n}\n\nint main() {\n    cout << sum(3, 5) << endl;\n    return 0;\n}`
    },
    {
      id: 'cpp-e2', difficulty: 'oson', title: "Salomlashish",
      text: `Foydalanuvchining ismini chiqaring (constant).\n\nNatija: "Salom, Ali!"`,
      template: `#include <iostream>\n#include <string>\nusing namespace std;\n\nstring greet(string name) {\n    // Kodingizni shu yerga yozing\n    return "";\n}\n\nint main() {\n    cout << greet("Ali") << endl;\n    return 0;\n}`
    },
    // === ORTA ===
    {
      id: 'cpp-m1', difficulty: 'orta', title: "Faktorial",
      text: `N sonning faktorialini hisoblang.\n\nfactorial(5) → 120`,
      template: `#include <iostream>\nusing namespace std;\n\nint factorial(int n) {\n    // Kodingizni shu yerga yozing\n    return 0;\n}\n\nint main() {\n    cout << factorial(5) << endl;\n    return 0;\n}`
    },
    {
      id: 'cpp-m2', difficulty: 'orta', title: "Eng katta son",
      text: `Massivdan eng katta sonni toping.\n\nmax_num({1,5,3,9,2}) → 9`,
      template: `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint max_num(vector<int> v) {\n    // Kodingizni shu yerga yozing\n    return 0;\n}\n\nint main() {\n    cout << max_num({1,5,3,9,2}) << endl;\n    return 0;\n}`
    },
    // === QIYIN ===
    {
      id: 'cpp-h1', difficulty: 'qiyin', title: "Tublik tekshiruvi",
      text: `Sonning tub son ekanligini tekshiring.\n\nis_prime(7) → 1 (true)\nis_prime(8) → 0 (false)`,
      template: `#include <iostream>\nusing namespace std;\n\nbool is_prime(int n) {\n    // Kodingizni shu yerga yozing\n    return false;\n}\n\nint main() {\n    cout << is_prime(7) << endl;\n    cout << is_prime(8) << endl;\n    return 0;\n}`
    }
  ],
  java: [
    // === OSON ===
    {
      id: 'java-e1', difficulty: 'oson', title: "Sonlar yig'indisi",
      text: `Ikki sonni qo'shing.\n\nsum(3, 5) → 8`,
      template: `public class Main {\n    public static int sum(int a, int b) {\n        // Kodingizni shu yerga yozing\n        return 0;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(sum(3, 5));\n    }\n}`
    },
    {
      id: 'java-e2', difficulty: 'oson', title: "Salomlashish",
      text: `"Salom, NAME!" qaytaring.\n\ngreet("Ali") → "Salom, Ali!"`,
      template: `public class Main {\n    public static String greet(String name) {\n        // Kodingizni shu yerga yozing\n        return "";\n    }\n\n    public static void main(String[] args) {\n        System.out.println(greet("Ali"));\n    }\n}`
    },
    // === ORTA ===
    {
      id: 'java-m1', difficulty: 'orta', title: "Faktorial",
      text: `N sonning faktorialini hisoblang.\n\nfactorial(5) → 120`,
      template: `public class Main {\n    public static long factorial(int n) {\n        // Kodingizni shu yerga yozing\n        return 0;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(factorial(5));\n    }\n}`
    },
    {
      id: 'java-m2', difficulty: 'orta', title: "Palindrom",
      text: `So'z palindrommi tekshiring.\n\nisPalindrome("madam") → true`,
      template: `public class Main {\n    public static boolean isPalindrome(String s) {\n        // Kodingizni shu yerga yozing\n        return false;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(isPalindrome("madam"));\n    }\n}`
    },
    // === QIYIN ===
    {
      id: 'java-h1', difficulty: 'qiyin', title: "Fibonachchi",
      text: `Fibonachchi N-elementi.\n\nfib(8) → 21`,
      template: `public class Main {\n    public static int fib(int n) {\n        // Kodingizni shu yerga yozing\n        return 0;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(fib(8));\n    }\n}`
    }
  ],
  go: [
    // === OSON ===
    {
      id: 'go-e1', difficulty: 'oson', title: "Sonlar yig'indisi",
      text: `Ikki sonni qo'shing.\n\nSum(3, 5) → 8`,
      template: `package main\n\nimport "fmt"\n\nfunc Sum(a, b int) int {\n    // Kodingizni shu yerga yozing\n    return 0\n}\n\nfunc main() {\n    fmt.Println(Sum(3, 5))\n}`
    },
    {
      id: 'go-e2', difficulty: 'oson', title: "Salomlashish",
      text: `"Salom, NAME!" qaytaring.\n\nGreet("Ali") → "Salom, Ali!"`,
      template: `package main\n\nimport "fmt"\n\nfunc Greet(name string) string {\n    // Kodingizni shu yerga yozing\n    return ""\n}\n\nfunc main() {\n    fmt.Println(Greet("Ali"))\n}`
    },
    // === ORTA ===
    {
      id: 'go-m1', difficulty: 'orta', title: "Eng katta son",
      text: `Slice'dan eng katta sonni toping.\n\nMax([]int{1,5,3,9}) → 9`,
      template: `package main\n\nimport "fmt"\n\nfunc Max(nums []int) int {\n    // Kodingizni shu yerga yozing\n    return 0\n}\n\nfunc main() {\n    fmt.Println(Max([]int{1, 5, 3, 9}))\n}`
    },
    {
      id: 'go-m2', difficulty: 'orta', title: "String teskari",
      text: `Stringni teskari aylantiring.\n\nReverse("hello") → "olleh"`,
      template: `package main\n\nimport "fmt"\n\nfunc Reverse(s string) string {\n    // Kodingizni shu yerga yozing\n    return ""\n}\n\nfunc main() {\n    fmt.Println(Reverse("hello"))\n}`
    },
    // === QIYIN ===
    {
      id: 'go-h1', difficulty: 'qiyin', title: "Tublik",
      text: `Sonning tub son ekanligini tekshiring.\n\nIsPrime(7) → true`,
      template: `package main\n\nimport "fmt"\n\nfunc IsPrime(n int) bool {\n    // Kodingizni shu yerga yozing\n    return false\n}\n\nfunc main() {\n    fmt.Println(IsPrime(7))\n    fmt.Println(IsPrime(8))\n}`
    }
  ],
  rust: [
    // === OSON ===
    {
      id: 'rs-e1', difficulty: 'oson', title: "Sonlar yig'indisi",
      text: `Ikki sonni qo'shing.\n\nsum(3, 5) → 8`,
      template: `fn sum(a: i32, b: i32) -> i32 {\n    // Kodingizni shu yerga yozing\n    0\n}\n\nfn main() {\n    println!("{}", sum(3, 5));\n}`
    },
    {
      id: 'rs-e2', difficulty: 'oson', title: "Salomlashish",
      text: `"Salom, NAME!" qaytaring.\n\ngreet("Ali") → "Salom, Ali!"`,
      template: `fn greet(name: &str) -> String {\n    // Kodingizni shu yerga yozing\n    String::new()\n}\n\nfn main() {\n    println!("{}", greet("Ali"));\n}`
    },
    // === ORTA ===
    {
      id: 'rs-m1', difficulty: 'orta', title: "Eng katta son",
      text: `Vec<i32>'dan eng katta sonni toping.\n\nmax_num(&vec![1,5,3,9]) → 9`,
      template: `fn max_num(nums: &Vec<i32>) -> i32 {\n    // Kodingizni shu yerga yozing\n    0\n}\n\nfn main() {\n    let v = vec![1, 5, 3, 9];\n    println!("{}", max_num(&v));\n}`
    },
    {
      id: 'rs-m2', difficulty: 'orta', title: "Faktorial",
      text: `N sonning faktorialini hisoblang.\n\nfactorial(5) → 120`,
      template: `fn factorial(n: u64) -> u64 {\n    // Kodingizni shu yerga yozing\n    0\n}\n\nfn main() {\n    println!("{}", factorial(5));\n}`
    },
    // === QIYIN ===
    {
      id: 'rs-h1', difficulty: 'qiyin', title: "Tublik",
      text: `Tub son tekshiruvi.\n\nis_prime(7) → true`,
      template: `fn is_prime(n: u32) -> bool {\n    // Kodingizni shu yerga yozing\n    false\n}\n\nfn main() {\n    println!("{}", is_prime(7));\n    println!("{}", is_prime(8));\n}`
    }
  ]
}

// 3 daraja
const DIFFICULTIES = ['oson', 'orta', 'qiyin']

const SUPPORTED_LANGS = Object.keys(PROBLEMS)

// Reyting balliga qarab darajani aniqlash
const getDifficultyFromRating = async (userId) => {
  try {
    const r = await pool.query('SELECT points FROM ratings WHERE user_id = $1', [userId])
    const points = r.rows[0]?.points ?? 1000
    if (points < 1050) return 'oson'
    if (points > 1300) return 'qiyin'
    return 'orta'
  } catch {
    return 'orta'
  }
}

const getRandomProblem = (lang = 'python', difficulty = 'orta') => {
  const list = PROBLEMS[lang] || PROBLEMS.python
  const filtered = list.filter(p => p.difficulty === difficulty)
  const choices = filtered.length > 0 ? filtered : list
  return choices[Math.floor(Math.random() * choices.length)]
}

const LANG_NAMES = {
  python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript',
  react: 'React (JSX)', html: 'HTML', css: 'CSS',
  cpp: 'C++', java: 'Java', go: 'Go', rust: 'Rust'
}

// Piston API — bepul kod ishga tushiruvchi (https://piston.readthedocs.io/)
// Faqat brauzerda preview qila olmaydigan tillar uchun
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute'
const PISTON_LANGS = {
  cpp: { language: 'c++', version: '10.2.0' },
  java: { language: 'java', version: '15.0.2' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.68.2' }
}

const DIFF_TEXT = {
  oson: "oson (yangi boshlovchi uchun — 2-3 daqiqada yechiladigan, asosiy sintaksis)",
  orta: "o'rta (5 daqiqada yechiladigan, biroz fikrlash kerak)",
  qiyin: "qiyin (5 daqiqada bajariladigan, lekin algoritmik fikr yoki murakkab mantiq talab qiladi)"
}

// AI orqali masala yaratish — agar AI muvaffaqiyatsiz bo'lsa, fallback berila beradi
const generateAIProblem = async (language, difficulty = 'orta') => {
  const langName = LANG_NAMES[language] || 'JavaScript'
  const diffText = DIFF_TEXT[difficulty] || DIFF_TEXT.orta

  let prompt
  if (language === 'html' || language === 'css') {
    // HTML/CSS — AI faqat title, text, body, css ni qaytaradi. Skafold serverda yopiladi
    prompt = `Sen frontend battle uchun masala yaratuvchi AI san. ${langName} bilan kichik vizual element masalasini yarat.

DARAJA: ${diffText}

QOIDALAR:
1. Masala — kichik vizual element (tugma, karta, forma, layout, animatsiya)
2. Natija qanday ko'rinishi aniq tasvirlangan (rang, o'lcham, joylashuv)
3. O'zbek tilida (lotin yozuvi)
4. ${language === 'css' ? 'CSS battle: body_html da tayyor HTML elementlar (selektorlar bilan), css_starter da minimal placeholder' : 'HTML battle: body_html bo\'sh (foydalanuvchi to\'ldiradi), css_starter da kerakli boshlang\'ich stil'}

JAVOB FAQAT JSON formatda (boshqa hech narsa yozma):
{
  "title": "Masala nomi (3-5 so'z)",
  "text": "Nima qilish kerak va qanday ko'rinish (3-5 qator)",
  "body_html": "${language === 'css' ? '<div class=\\"box\\">...</div> kabi tayyor HTML' : '<!-- foydalanuvchi shu yerga yozadi -->'}",
  "css_starter": "${language === 'css' ? '/* foydalanuvchi shu yerga CSS yozadi */' : 'minimal CSS (body, font)'}"
}`
  } else if (language === 'react') {
    prompt = `Sen React battle uchun masala yaratuvchi AI san.

DARAJA: ${diffText}
TIL: React (JSX)

QOIDALAR:
1. Masala — App nomli kichik komponent yozish
2. Natija qanday ko'rinishi aniq tasvirlangan
3. O'zbek tilida (lotin yozuvi)
4. component_starter — App funksiyasining bosh shabloni (komponent ichi to'ldirilmagan)
5. JSX sintaksis, ReactDOM.createRoot bilan render qilish keyin avtomatik qo'shiladi

JAVOB FAQAT JSON formatda:
{
  "title": "Masala nomi (3-5 so'z)",
  "text": "Nima qilish kerak (3-5 qator)",
  "component_starter": "function App() {\\n  // shu yerga\\n  return <div>...</div>;\\n}"
}`
  } else {
    // Python, JS, TS — funksiya yozish masalasi
    prompt = `Sen kod battle uchun masala yaratuvchi AI san. ${langName} dasturlash tilida YANGI masala yarat.

DARAJA: ${diffText}
DASTURLASH TILI: ${langName}

QOIDALAR:
1. Masala bitta funksiyani yozish bilan yechilsin
2. 2-3 ta input/output misol bilan
3. O'zbek tilida (lotin yozuvi)
4. Funksiya nomini ingliz tilida (kichik harf, snake_case yoki camelCase)
5. Template'da funksiya tananasi placeholder bilan
6. Algoritmik masala (string, array, son, mantiq)
${language === 'typescript' ? '7. TypeScript tip annotation bilan (number, string, T[], union types)' : ''}

JAVOB FAQAT JSON formatda:
{
  "title": "Masala nomi (3-5 so'z)",
  "text": "Masala matni va misollar (3-5 qator)\\nMisol:\\nfuncName(arg) → result",
  "template": "Funksiya shabloni + console.log yoki print"
}`
  }

  try {
    const groqRes = await groqFetch({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 700
    }, 20000)

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content || ''
    const parsed = extractAndParseJson(text)
    if (!parsed) return null

    const title = String(parsed.title || '').trim().slice(0, 100)
    const probText = String(parsed.text || '').trim().slice(0, 2000)
    if (!title || !probText) return null

    let template = ''
    if (language === 'html' || language === 'css') {
      const body = String(parsed.body_html || '').slice(0, 2000)
      const css = String(parsed.css_starter || '').slice(0, 2000)
      if (!body && !css) return null
      template = HTML_SCAFFOLD(body, css)
    } else if (language === 'react') {
      const starter = String(parsed.component_starter || '').slice(0, 3000)
      if (!starter) return null
      template = REACT_TEMPLATE(starter)
    } else {
      template = String(parsed.template || '').trim().slice(0, 4000)
      if (!template) return null
    }

    return {
      id: `ai-${language}-${Date.now()}`,
      title,
      text: probText,
      template
    }
  } catch (err) {
    // Fallback ishlaydi — bu warn, error emas
    console.warn('[battle] AI fallback used:', err.message?.slice(0, 80))
    return null
  }
}

// Yagona kirish — AI urinish, muvaffaqiyatsiz bo'lsa fallback
const getProblemForBattle = async (language, difficulty = 'orta') => {
  const aiProb = await generateAIProblem(language, difficulty)
  if (aiProb) return aiProb
  return getRandomProblem(language, difficulty)
}

const generateId = () => Math.random().toString(36).substring(2, 8).toUpperCase()

const ensureRating = async (userId) => {
  await pool.query(
    'INSERT INTO ratings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  )
}

const evaluateCode = async (code, problem, language) => {
  if (!code?.trim() || code.trim().length < 30) {
    return { score: 0, feedback: 'Kod yozilmagan yoki juda qisqa' }
  }

  if (problem.template && code.trim() === problem.template.trim()) {
    return { score: 0, feedback: 'Asl shablon o\'zgartirilmagan' }
  }

  if (problem.template) {
    const cleanCode = code.replace(/\s+/g, '')
    const cleanTemplate = problem.template.replace(/\s+/g, '')
    const diff = Math.abs(cleanCode.length - cleanTemplate.length)
    if (diff < 10) {
      return { score: 0, feedback: 'Yechim yozilmagan, faqat shablon o\'zgartirilgan' }
    }
  }

  try {
    const prompt = `Sen QATTIQ kod baholovchi AI san. Aldama, faqat haqiqatan ham to'g'ri yechimga yuqori ball ber.

MASALA: ${problem.title}
${problem.text}

DASTURLASH TILI: ${language}

YUBORILGAN KOD:
\`\`\`${language}
${code}
\`\`\`

QATTIQ TEKSHIRUV:
1. Funksiya ichida HAQIQATAN ALGORITM YOZILGANMI? (Agar yo'q — 0 ball)
2. "pass", "return 0", "// kod", "TODO" kabi placeholder lar bormi? (Agar bor — 0 ball)
3. Funksiya tananasi BO'SHMI yoki BIR QATORDAN IBORATMI? (Agar shunday — 0-15 ball)
4. Kod MASALANI HAQIQATAN YECHADIMI? (Test qiling fikran)
5. Sintaktik xatolar bormi?

JAVOB FAQAT JSON formatda:
{"score": 0-100 oraliqdagi son, "feedback": "qisqa o'zbek tahlil"}`

    const groqRes = await groqFetch({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 400
    })

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content || ''
    const parsed = extractAndParseJson(text)

    if (parsed) {
      let score = Math.min(100, Math.max(0, parseInt(parsed.score) || 0))

      const codeNorm = code.toLowerCase()
      const hasPlaceholder = (
        codeNorm.includes('pass\n') ||
        codeNorm.endsWith('pass') ||
        codeNorm.match(/^\s*return 0;?\s*$/m) ||
        codeNorm.includes('todo') ||
        codeNorm.includes('# kodingizni') ||
        codeNorm.includes('// kodingizni')
      )

      if (hasPlaceholder && score > 20) {
        return { score: 0, feedback: 'Kod yozilmagan — placeholder topildi' }
      }

      return { score, feedback: String(parsed.feedback || 'Tahlil qilindi').slice(0, 1000) }
    }

    return { score: 30, feedback: 'AI tahlil qila olmadi' }
  } catch (err) {
    console.error('AI eval error:', err)
    return { score: 0, feedback: 'AI xatosi' }
  }
}

// Haftalik turnir balli — faqat g'alaba uchun qo'shiladi. Lazy-reset:
// saqlangan hafta joriy haftadan farq qilsa, hisob shu g'alabadan qayta boshlanadi.
const addWeeklyPoints = async (client, userId, pts) => {
  await client.query(`
    UPDATE ratings SET
      weekly_points = CASE
        WHEN week_start = date_trunc('week', NOW())::date THEN weekly_points + $2
        ELSE $2 END,
      week_start = date_trunc('week', NOW())::date
    WHERE user_id = $1
  `, [userId, pts])
}

// Atomic finish: lock battle row first, only finish once.
const finishBattle = async (battleId) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const battleRes = await client.query('SELECT * FROM battles WHERE id = $1 FOR UPDATE', [battleId])
    if (battleRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return
    }
    const battle = battleRes.rows[0]
    if (battle.status === 'finished') {
      await client.query('ROLLBACK')
      return
    }

    const subs = await client.query('SELECT * FROM battle_submissions WHERE battle_id = $1', [battleId])

    if (battle.mode === 'solo') {
      if (subs.rows.length >= 1) {
        const sub = subs.rows[0]
        let pointsChange = 0
        if (sub.score >= 80) pointsChange = 15
        else if (sub.score >= 60) pointsChange = 10
        else if (sub.score >= 40) pointsChange = 5
        else pointsChange = -5

        await client.query(`
          UPDATE ratings
          SET points = GREATEST(0, points + $1),
              wins = wins + CASE WHEN $2 >= 60 THEN 1 ELSE 0 END,
              total_battles = total_battles + 1,
              updated_at = NOW()
          WHERE user_id = $3
        `, [pointsChange, sub.score, sub.user_id])

        // Haftalik turnir — solo g'alaba (60+ ball)
        if (sub.score >= 60) {
          await addWeeklyPoints(client, sub.user_id, pointsChange)
        }

        await client.query(`
          UPDATE battles SET status = 'finished', finished_at = NOW(), winner_id = $1
          WHERE id = $2
        `, [sub.score >= 60 ? sub.user_id : null, battleId])

        // Solo natija notification
        const passed = sub.score >= 60
        notifications.notify(
          sub.user_id,
          'system',
          passed ? 'Solo battle yutdingiz!' : "Solo battle — yana urinib ko'ring",
          passed
            ? `${sub.score} ball oldingiz${pointsChange > 0 ? ` (+${pointsChange} reyting)` : ''}`
            : `${sub.score} ball. Boshqa masalalarni ko'rib chiqing.`,
          '/battle',
          'swords'
        ).catch(() => {})
      }
      await client.query('COMMIT')
      return
    }

    const players = await client.query('SELECT user_id FROM battle_players WHERE battle_id = $1', [battleId])
    if (subs.rows.length < players.rows.length) {
      await client.query('ROLLBACK')
      return
    }

    const sortedSubs = [...subs.rows].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (a.time_taken || 0) - (b.time_taken || 0)
    })

    const winnerId = sortedSubs[0]?.score > 0 ? sortedSubs[0].user_id : null

    for (const sub of subs.rows) {
      if (sub.user_id === winnerId) {
        await client.query(`
          UPDATE ratings
          SET points = points + 25, wins = wins + 1, total_battles = total_battles + 1, updated_at = NOW()
          WHERE user_id = $1
        `, [sub.user_id])
        // Haftalik turnir — multiplayer g'alaba
        await addWeeklyPoints(client, sub.user_id, 25)
      } else if (winnerId) {
        await client.query(`
          UPDATE ratings
          SET points = GREATEST(0, points - 15), losses = losses + 1, total_battles = total_battles + 1, updated_at = NOW()
          WHERE user_id = $1
        `, [sub.user_id])
      } else {
        await client.query(`
          UPDATE ratings
          SET draws = draws + 1, total_battles = total_battles + 1, updated_at = NOW()
          WHERE user_id = $1
        `, [sub.user_id])
      }
    }

    await client.query(`
      UPDATE battles SET status = 'finished', finished_at = NOW(), winner_id = $1
      WHERE id = $2
    `, [winnerId, battleId])

    await client.query('COMMIT')

    // Multiplayer natija notification — har bir player uchun
    for (let i = 0; i < sortedSubs.length; i++) {
      const sub = sortedSubs[i]
      const place = i + 1
      let title, msg, icon = 'swords'

      if (sub.user_id === winnerId) {
        title = "G'alaba qozondingiz!"
        msg = `${sub.score} ball — Top 1 (+25 reyting)`
      } else if (place === 2) {
        title = "2-o'rin — yaxshi natija!"
        msg = `${sub.score} ball`
      } else if (place === 3) {
        title = "3-o'rin"
        msg = `${sub.score} ball`
      } else if (winnerId) {
        title = "Battle tugadi"
        msg = `${place}-o'rin — ${sub.score} ball. Yana urinib ko'ring!`
      } else {
        title = "Battle — durang"
        msg = `${sub.score} ball — hech kim 60 dan yuqori olmadi`
      }

      notifications.notify(sub.user_id, 'system', title, msg, '/battle', icon).catch(() => {})
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Finish battle error:', err)
  } finally {
    client.release()
  }
}

router.post('/create', auth, async (req, res) => {
  try {
    const { language = 'python', maxPlayers = 2 } = req.body
    if (!SUPPORTED_LANGS.includes(language)) return res.status(400).json({ message: 'Til qo\'llanmaydi' })
    const max = Math.min(10, Math.max(2, parseInt(maxPlayers) || 2))

    await ensureRating(req.user.id)
    const difficulty = await getDifficultyFromRating(req.user.id)
    const problem = await getProblemForBattle(language, difficulty)
    const battleId = generateId()

    await pool.query(`
      INSERT INTO battles (id, host_id, mode, max_players, problem_id, problem_title, problem_text, language, template, status, difficulty)
      VALUES ($1, $2, 'multiplayer', $3, $4, $5, $6, $7, $8, 'waiting', $9)
    `, [battleId, req.user.id, max, problem.id, problem.title, problem.text, language, problem.template, difficulty])

    await pool.query(`
      INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)
    `, [battleId, req.user.id])

    res.json({ id: battleId, language, maxPlayers: max, status: 'waiting', difficulty })
  } catch (err) {
    console.error('Create error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/join', auth, async (req, res) => {
  const { battleId } = req.body
  if (!battleId || typeof battleId !== 'string') return res.status(400).json({ message: 'ID yo\'q' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query('SELECT * FROM battles WHERE id = $1 FOR UPDATE', [battleId.toUpperCase()])
    if (result.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Xona topilmadi' })
    }

    const battle = result.rows[0]
    if (battle.status !== 'waiting') {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Xona band yoki tugagan' })
    }

    const existing = await client.query(
      'SELECT 1 FROM battle_players WHERE battle_id = $1 AND user_id = $2',
      [battle.id, req.user.id]
    )
    if (existing.rows.length === 0) {
      const players = await client.query('SELECT COUNT(*) FROM battle_players WHERE battle_id = $1', [battle.id])
      if (parseInt(players.rows[0].count) >= battle.max_players) {
        await client.query('ROLLBACK')
        return res.status(400).json({ message: 'Xona to\'la' })
      }

      await client.query(
        'INSERT INTO ratings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
        [req.user.id]
      )
      await client.query('INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)', [battle.id, req.user.id])
    }

    await client.query('COMMIT')

    // Host'ga notification — yangi player qo'shildi (faqat host boshqa user bo'lsa)
    if (existing.rows.length === 0 && battle.host_id !== req.user.id) {
      try {
        const joinerRes = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id])
        const joinerName = joinerRes.rows[0]?.name || 'Foydalanuvchi'
        notifications.notify(
          battle.host_id,
          'battle_invite',
          `${joinerName} sizning Battle xonangizga qo'shildi`,
          `Xona ID: ${battle.id} — endi boshlash mumkin`,
          '/battle',
          'swords'
        ).catch(() => {})
      } catch {}
    }

    res.json({ id: battle.id, status: battle.status })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Join error:', err)
    res.status(500).json({ message: 'Xatolik' })
  } finally {
    client.release()
  }
})

router.post('/start/:id', auth, async (req, res) => {
  try {
    const battleRes = await pool.query('SELECT * FROM battles WHERE id = $1', [req.params.id])
    if (battleRes.rows.length === 0) return res.status(404).json({ message: 'Topilmadi' })

    const battle = battleRes.rows[0]
    if (battle.host_id !== req.user.id) return res.status(403).json({ message: 'Faqat host boshlay oladi' })
    if (battle.status !== 'waiting') return res.status(400).json({ message: 'Battle holati noto\'g\'ri' })

    const players = await pool.query('SELECT COUNT(*) FROM battle_players WHERE battle_id = $1', [battle.id])
    if (parseInt(players.rows[0].count) < 2) return res.status(400).json({ message: 'Kamida 2 o\'yinchi kerak' })

    await pool.query(`UPDATE battles SET status = 'playing', started_at = NOW() WHERE id = $1`, [battle.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/solo', auth, async (req, res) => {
  try {
    const { language = 'python' } = req.body
    if (!SUPPORTED_LANGS.includes(language)) return res.status(400).json({ message: 'Til qo\'llanmaydi' })

    await ensureRating(req.user.id)
    const difficulty = await getDifficultyFromRating(req.user.id)
    const problem = await getProblemForBattle(language, difficulty)
    const battleId = 'S' + generateId()

    await pool.query(`
      INSERT INTO battles (id, host_id, mode, max_players, problem_id, problem_title, problem_text, language, template, status, started_at, difficulty)
      VALUES ($1, $2, 'solo', 1, $3, $4, $5, $6, $7, 'playing', NOW(), $8)
    `, [battleId, req.user.id, problem.id, problem.title, problem.text, language, problem.template, difficulty])

    await pool.query('INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)', [battleId, req.user.id])

    res.json({ id: battleId, status: 'playing', difficulty })
  } catch (err) {
    console.error('Solo error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/random', auth, async (req, res) => {
  const { language = 'python' } = req.body
  if (!SUPPORTED_LANGS.includes(language)) return res.status(400).json({ message: 'Til qo\'llanmaydi' })

  const difficulty = await getDifficultyFromRating(req.user.id)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'INSERT INTO ratings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [req.user.id]
    )

    // Match topishda darajani ham hisobga olamiz — bir xil daraja eng yaxshisi
    const waiting = await client.query(`
      SELECT b.* FROM battles b
      WHERE b.status = 'waiting'
        AND b.mode = 'multiplayer'
        AND b.language = $1
        AND b.host_id != $2
        AND b.created_at > NOW() - INTERVAL '5 minutes'
        AND (SELECT COUNT(*) FROM battle_players WHERE battle_id = b.id) < b.max_players
      ORDER BY (b.difficulty = $3) DESC, b.created_at ASC
      LIMIT 1
      FOR UPDATE OF b SKIP LOCKED
    `, [language, req.user.id, difficulty])

    if (waiting.rows.length > 0) {
      const battle = waiting.rows[0]
      const exists = await client.query(
        'SELECT 1 FROM battle_players WHERE battle_id = $1 AND user_id = $2',
        [battle.id, req.user.id]
      )
      if (exists.rows.length === 0) {
        await client.query('INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)', [battle.id, req.user.id])
      }
      await client.query('COMMIT')
      return res.json({ id: battle.id, status: battle.status })
    }

    const problem = await getProblemForBattle(language, difficulty)
    const battleId = generateId()
    await client.query(`
      INSERT INTO battles (id, host_id, mode, max_players, problem_id, problem_title, problem_text, language, template, status, difficulty)
      VALUES ($1, $2, 'multiplayer', 2, $3, $4, $5, $6, $7, 'waiting', $8)
    `, [battleId, req.user.id, problem.id, problem.title, problem.text, language, problem.template, difficulty])

    await client.query('INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)', [battleId, req.user.id])
    await client.query('COMMIT')

    res.json({ id: battleId, status: 'waiting', difficulty })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Random error:', err)
    res.status(500).json({ message: 'Xatolik' })
  } finally {
    client.release()
  }
})

router.get('/status/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM battles WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: 'Topilmadi' })

    const battle = result.rows[0]
    const players = await pool.query(`
      SELECT bp.user_id, u.name,
        EXISTS(SELECT 1 FROM battle_submissions WHERE battle_id = $1 AND user_id = bp.user_id) as submitted
      FROM battle_players bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.battle_id = $1
      ORDER BY bp.joined_at ASC
    `, [battle.id])

    let submissions = []
    if (battle.status === 'finished') {
      const subs = await pool.query(`
        SELECT bs.*, u.name as user_name
        FROM battle_submissions bs
        JOIN users u ON bs.user_id = u.id
        WHERE bs.battle_id = $1
        ORDER BY bs.score DESC, bs.time_taken ASC
      `, [battle.id])
      submissions = subs.rows
    }

    res.json({
      id: battle.id,
      host_id: battle.host_id,
      mode: battle.mode,
      max_players: battle.max_players,
      problem_id: battle.problem_id,
      problem_title: battle.problem_title,
      problem: battle.problem_text,
      template: battle.template,
      language: battle.language,
      difficulty: battle.difficulty,
      status: battle.status,
      winner_id: battle.winner_id,
      players: players.rows,
      submissions
    })
  } catch (err) {
    console.error('Status error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/submit/:id', auth, async (req, res) => {
  const { code, time_taken } = req.body
  const battleId = req.params.id

  if (typeof code !== 'string') return res.status(400).json({ message: 'Kod kerak' })
  if (code.length > MAX_CODE_LEN) return res.status(400).json({ message: 'Kod juda uzun' })
  const timeTaken = Math.max(0, Math.min(86400, parseInt(time_taken, 10) || 0))

  // 1-bosqich: tekshiruvlar (qisqa, tranzaksiyasiz)
  let battle
  try {
    const battleRes = await pool.query('SELECT * FROM battles WHERE id = $1', [battleId])
    if (battleRes.rows.length === 0) return res.status(404).json({ message: 'Topilmadi' })
    battle = battleRes.rows[0]
    if (battle.status === 'finished') return res.status(400).json({ message: 'Battle tugagan' })

    const playerCheck = await pool.query(
      'SELECT 1 FROM battle_players WHERE battle_id = $1 AND user_id = $2',
      [battleId, req.user.id]
    )
    if (playerCheck.rows.length === 0) return res.status(403).json({ message: 'Siz ishtirokchi emassiz' })

    const existing = await pool.query(
      'SELECT 1 FROM battle_submissions WHERE battle_id = $1 AND user_id = $2',
      [battleId, req.user.id]
    )
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Allaqachon yuborgansiz' })
  } catch (err) {
    console.error('Submit precheck error:', err)
    return res.status(500).json({ message: 'Xatolik' })
  }

  // 2-bosqich: AI baholash (DB lock ushlanmaydi)
  const { score, feedback } = await evaluateCode(
    code,
    { title: battle.problem_title, text: battle.problem_text, template: battle.template },
    battle.language
  )

  // 3-bosqich: natijani yozish (qisqa tranzaksiya, INSERT UNIQUE constraint
  // birgalik race'larni tutadi — bir foydalanuvchi bir battle'ga 1 marta)
  try {
    await pool.query(`
      INSERT INTO battle_submissions (battle_id, user_id, code, language, score, time_taken, feedback)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (battle_id, user_id) DO NOTHING
    `, [battleId, req.user.id, code, battle.language, score, timeTaken, feedback])

    await finishBattle(battleId)
    res.json({ score, feedback })
  } catch (err) {
    console.error('Submit write error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/cancel/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM battles WHERE id = $1 AND host_id = $2 AND status = $3',
      [req.params.id, req.user.id, 'waiting']
    )
    if (r.rowCount === 0) return res.status(404).json({ message: 'Topilmadi yoki ruxsat yo\'q' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, r.points, r.wins, r.losses, r.draws, r.total_battles
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE u.role != 'admin'
      ORDER BY r.points DESC
      LIMIT 20
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

// GET /api/battle/weekly — joriy hafta turnir reytingi
router.get('/weekly', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, r.weekly_points
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE u.role != 'admin'
        AND r.week_start = date_trunc('week', NOW())::date
        AND r.weekly_points > 0
      ORDER BY r.weekly_points DESC
      LIMIT 10
    `)
    res.json(result.rows)
  } catch (err) {
    console.error('[battle] weekly error:', err.message)
    res.status(500).json({ message: 'Xatolik' })
  }
})

// GET /api/battle/my-stats — foydalanuvchining o'z battle statistikasi
// (leaderboard TOP 20 bilan cheklangan — bu har doim o'z natijani qaytaradi)
router.get('/my-stats', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT points, wins, losses, draws, total_battles
       FROM ratings WHERE user_id = $1`,
      [req.user.id]
    )
    if (result.rows.length === 0) {
      return res.json({ points: 1000, wins: 0, losses: 0, draws: 0, total_battles: 0 })
    }

    // Reytingdagi o'rni
    const rankResult = await pool.query(`
      SELECT COUNT(*)::int + 1 AS rank
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE u.role != 'admin' AND r.points > $1
    `, [result.rows[0].points])

    res.json({ ...result.rows[0], rank: rankResult.rows[0]?.rank || null })
  } catch (err) {
    console.error('[battle] my-stats error:', err.message)
    res.status(500).json({ message: 'Xatolik' })
  }
})

// GET /api/battle/history — foydalanuvchining tugagan battle'lari.
// Yechimlarni ko'rish — mavjud /status/:id orqali (finished battle kodlarni qaytaradi).
router.get('/history', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.mode, b.language, b.problem_title, b.finished_at, b.winner_id,
             bs.score AS my_score, bs.time_taken AS my_time,
             (
               SELECT COALESCE(json_agg(json_build_object(
                 'name', u2.name,
                 'score', bs2.score
               )), '[]'::json)
               FROM battle_players bp2
               JOIN users u2 ON u2.id = bp2.user_id
               LEFT JOIN battle_submissions bs2
                 ON bs2.battle_id = b.id AND bs2.user_id = bp2.user_id
               WHERE bp2.battle_id = b.id AND bp2.user_id != $1
             ) AS opponents
      FROM battle_players bp
      JOIN battles b ON b.id = bp.battle_id
      LEFT JOIN battle_submissions bs ON bs.battle_id = b.id AND bs.user_id = $1
      WHERE bp.user_id = $1 AND b.status = 'finished'
      ORDER BY b.finished_at DESC NULLS LAST
      LIMIT 30
    `, [req.user.id])

    const history = result.rows.map(r => {
      let outcome
      if (r.winner_id === req.user.id) outcome = 'win'
      else if (r.winner_id) outcome = 'loss'
      else outcome = 'draw'
      return {
        id: r.id,
        mode: r.mode,
        language: r.language,
        problemTitle: r.problem_title,
        finishedAt: r.finished_at,
        myScore: r.my_score,
        myTime: r.my_time,
        outcome,
        opponents: r.opponents || []
      }
    })
    res.json(history)
  } catch (err) {
    console.error('[battle] history error:', err.message)
    res.status(500).json({ message: 'Xatolik' })
  }
})

// POST /api/battle/exec — Piston API orqali kodni ishga tushiradi (preview uchun)
// Faqat C++/Java/Go/Rust kabi brauzerda ishlamaydigan tillar
// Natija scoring uchun emas, faqat preview UX uchun
router.post('/exec', auth, async (req, res) => {
  const { language, code } = req.body
  if (!language || !PISTON_LANGS[language]) {
    return res.status(400).json({ error: 'Til qo\'llanmaydi' })
  }
  if (typeof code !== 'string' || code.length === 0 || code.length > MAX_CODE_LEN) {
    return res.status(400).json({ error: 'Kod noto\'g\'ri' })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const resp = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...PISTON_LANGS[language],
        files: [{ content: code }],
        compile_timeout: 8000,
        run_timeout: 5000,
        compile_memory_limit: -1,
        run_memory_limit: -1
      }),
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!resp.ok) {
      return res.status(502).json({ error: 'Executor xatosi', status: resp.status })
    }
    const data = await resp.json()
    res.json({
      stdout: (data.run?.stdout || '').slice(0, 8000),
      stderr: (data.run?.stderr || '').slice(0, 4000),
      compileStderr: (data.compile?.stderr || '').slice(0, 4000),
      exitCode: typeof data.run?.code === 'number' ? data.run.code : null
    })
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).json({ error: 'Executor javob bermadi' })
    console.warn('[battle] exec error:', e.message?.slice(0, 100))
    res.status(500).json({ error: 'Executor xatosi' })
  }
})

module.exports = router
