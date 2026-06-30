import 'server-only'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfMeta {
  title: string
  type: string
  version: number
  ownerName?: string
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    padding: 0,
  },
  header: {
    backgroundColor: '#14b8a6',
    padding: '16px 24px',
  },
  headerBrand: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
  },
  body: {
    padding: '24px 32px',
    flex: 1,
  },
  titleText: {
    fontSize: 20,
    color: '#1e293b',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  subheader: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12,
  },
  subheaderText: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Helvetica',
  },
  contentText: {
    fontSize: 11,
    color: '#334155',
    fontFamily: 'Helvetica',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
})

// ── generatePdf ───────────────────────────────────────────────────────────────

export async function generatePdf(contentMd: string, meta: PdfMeta): Promise<Buffer> {
  const capitalizedType = meta.type.charAt(0).toUpperCase() + meta.type.slice(1)

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Teal ARIA header bar */}
        <View style={styles.header}>
          <Text style={styles.headerBrand}>ARIA</Text>
        </View>

        <View style={styles.body}>
          {/* Document title */}
          <Text style={styles.titleText}>{meta.title}</Text>

          {/* Version + type subheader in grey */}
          <View style={styles.subheader}>
            <Text style={styles.subheaderText}>{capitalizedType}</Text>
            <Text style={styles.subheaderText}>Version {meta.version}</Text>
            {meta.ownerName && (
              <Text style={styles.subheaderText}>{meta.ownerName}</Text>
            )}
          </View>

          {/* Body text — raw contentMd, not parsed Markdown */}
          <Text style={styles.contentText}>{contentMd}</Text>
        </View>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(doc)
  return Buffer.from(buffer)
}
