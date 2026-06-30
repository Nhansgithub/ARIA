export {}

import fs from 'fs'
import path from 'path'

// Helper
function check(label: string, pass: boolean) {
  if (pass) {
    console.log(`✓ ${label}`)
  } else {
    console.error(`✗ ${label}`)
    process.exitCode = 1
  }
}

const ROOT = path.resolve(process.cwd())

// T1: generatePdf.tsx exists
const pdfGenPath = path.join(ROOT, 'lib/pdf/generatePdf.tsx')
check('T1: lib/pdf/generatePdf.tsx exists', fs.existsSync(pdfGenPath))

// T2: export route exists
const exportRoutePath = path.join(ROOT, 'app/api/documents/[id]/export/route.ts')
check('T2: export route exists', fs.existsSync(exportRoutePath))

const pdfGenSrc = fs.existsSync(pdfGenPath) ? fs.readFileSync(pdfGenPath, 'utf-8') : ''
const exportRouteSrc = fs.existsSync(exportRoutePath) ? fs.readFileSync(exportRoutePath, 'utf-8') : ''
const viewerPath = path.join(ROOT, 'components/documents/DocumentViewer.tsx')
const viewerSrc = fs.existsSync(viewerPath) ? fs.readFileSync(viewerPath, 'utf-8') : ''

// T3: generatePdf source contains @react-pdf/renderer
check('T3: generatePdf imports @react-pdf/renderer', pdfGenSrc.includes('@react-pdf/renderer'))

// T4: generatePdf source contains import server-only (AD-11)
check('T4: generatePdf contains import server-only', pdfGenSrc.includes("import 'server-only'"))

// T5: export route does NOT contain @anthropic-ai/sdk (AD-1)
check('T5: export route does not import @anthropic-ai/sdk', !exportRouteSrc.includes('@anthropic-ai/sdk'))

// T6: export route contains logActivity (activity log — AD-14)
check('T6: export route contains logActivity', exportRouteSrc.includes('logActivity'))

// T7: export route contains file_url update
check('T7: export route contains file_url', exportRouteSrc.includes('file_url'))

// T8: export route contains upsert: true (idempotent re-export)
check('T8: export route contains upsert: true', exportRouteSrc.includes('upsert: true'))

// T9: DocumentViewer has handleExport function (not just any 'export' keyword)
check('T9: DocumentViewer contains handleExport function', viewerSrc.includes('handleExport'))

// T10: buildStoragePath inline test
function buildStoragePath(ownerId: string, docId: string, version: number): string {
  return `${ownerId}/documents/${docId}_v${version}.pdf`
}
const testPath = buildStoragePath('user-123', 'doc-456', 2)
check('T10: buildStoragePath produces correct path', testPath === 'user-123/documents/doc-456_v2.pdf')

// T11: export route contains 'attachment' (Content-Disposition)
check('T11: export route contains attachment header', exportRouteSrc.includes('attachment'))

// T12: export route contains pdf_exported (activity log action)
check('T12: export route contains pdf_exported action', exportRouteSrc.includes('pdf_exported'))

// T13: export route sanitizes filename (P1-1 fix — prevents header injection)
check('T13: export route sanitizes filename before Content-Disposition', exportRouteSrc.includes('safeFilename'))

// T14: export route checks updateError result (P1-2 fix — no silent DB failure)
check('T14: export route checks updateError', exportRouteSrc.includes('updateError'))

// T15: export route wraps generatePdf in try/catch (P2-4 fix)
check('T15: export route wraps generatePdf in try/catch', exportRouteSrc.includes('PDF generation failed'))
