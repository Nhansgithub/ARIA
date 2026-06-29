export {}

// Inline buildGreeting logic — never import from project lib/ (ts-node inline pattern)
function buildGreeting(ownerName: string | null, lang: 'vi' | 'en'): string {
  if (lang === 'vi') {
    return ownerName
      ? `Chào Anh ${ownerName}! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên.`
      : `Chào anh! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên.`
  }
  return ownerName
    ? `Hi ${ownerName}! I'm ARIA, your business consultant. You don't have any deals yet — just tell me about someone you're working with. No forms needed.`
    : `Hi there! I'm ARIA, your business consultant. You don't have any deals yet — just tell me about someone you're working with. No forms needed.`
}

// Inline isFirstRun derivation logic
function deriveIsFirstRun(
  clientCount: number | string | null,
  dealCount: number | string | null
): boolean {
  return (Number(clientCount) ?? 0) === 0 && (Number(dealCount) ?? 0) === 0
}

// Inline browser lang detection logic
function detectBrowserLang(languageTag: string): 'vi' | 'en' {
  return languageTag.startsWith('vi') ? 'vi' : 'en'
}

let passed = 0
let failed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

// ── T1: VI with name ──────────────────────────────────────────────────────────
console.log('T1 — VI greeting with name "Nhan"')
const t1 = buildGreeting('Nhan', 'vi')
assert(t1.includes('Chào Anh Nhan!'), 'contains "Chào Anh Nhan!"')
assert(t1.includes('Không cần điền form'), 'contains "Không cần điền form"')
assert(!t1.includes('undefined'), 'does not contain "undefined"')

// ── T2: VI without name ───────────────────────────────────────────────────────
console.log('T2 — VI greeting without name (null)')
const t2 = buildGreeting(null, 'vi')
assert(t2.includes('Chào anh!'), 'contains "Chào anh!"')
assert(!t2.includes('undefined'), 'does not contain "undefined"')
assert(!t2.includes('null'), 'does not contain "null"')
assert(!t2.includes('[Name]'), 'does not contain "[Name]"')

// ── T3: EN with name ──────────────────────────────────────────────────────────
console.log('T3 — EN greeting with name "Nhan"')
const t3 = buildGreeting('Nhan', 'en')
assert(t3.includes('Hi Nhan!'), 'contains "Hi Nhan!"')
assert(t3.includes('No forms needed'), 'contains "No forms needed"')
assert(!t3.includes('undefined'), 'does not contain "undefined"')

// ── T4: EN without name ───────────────────────────────────────────────────────
console.log('T4 — EN greeting without name (null)')
const t4 = buildGreeting(null, 'en')
assert(t4.includes('Hi there!'), 'contains "Hi there!"')
assert(!t4.includes('undefined'), 'does not contain "undefined"')
assert(!t4.includes('null'), 'does not contain "null"')

// ── T5: isFirstRun logic ──────────────────────────────────────────────────────
console.log('T5 — isFirstRun derivation')
assert(deriveIsFirstRun(0, 0) === true, 'both 0 → isFirstRun true')
assert(deriveIsFirstRun(1, 0) === false, 'clientCount > 0 → isFirstRun false')
assert(deriveIsFirstRun(0, 1) === false, 'dealCount > 0 → isFirstRun false')
assert(deriveIsFirstRun(5, 3) === false, 'both > 0 → isFirstRun false')

// ── T6: isFirstRun coercion edge case ────────────────────────────────────────
console.log('T6 — isFirstRun string "0" coercion')
assert(deriveIsFirstRun('0', '0') === true, 'string "0","0" → isFirstRun true')
assert(deriveIsFirstRun('1', '0') === false, 'string "1","0" → isFirstRun false')
assert(deriveIsFirstRun(null, null) === true, 'null,null → isFirstRun true')

// ── T7: Browser lang detection ────────────────────────────────────────────────
console.log('T7 — Browser lang detection')
assert(detectBrowserLang('vi-VN') === 'vi', '"vi-VN" → "vi"')
assert(detectBrowserLang('vi') === 'vi', '"vi" → "vi"')
assert(detectBrowserLang('en-US') === 'en', '"en-US" → "en"')
assert(detectBrowserLang('zh-CN') === 'en', '"zh-CN" → "en" (default)')
assert(detectBrowserLang('fr-FR') === 'en', '"fr-FR" → "en" (default)')

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\nonboarding114: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
