'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { ComponentPropsWithoutRef } from 'react'

const PROSE: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.65,
  color: '#e2e8f0',
}

const components: Components = {
  p: ({ children }) => <p style={{ ...PROSE, marginBottom: 10 }}>{children}</p>,
  h1: ({ children }) => (
    <h1
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 22,
        fontWeight: 700,
        color: '#e2e8f0',
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 18,
        fontWeight: 600,
        color: '#e2e8f0',
        marginBottom: 10,
        marginTop: 4,
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 16,
        fontWeight: 600,
        color: '#e2e8f0',
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {children}
    </h3>
  ),
  ul: ({ children }) => <ul style={{ paddingLeft: 20, marginBottom: 10, ...PROSE }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 20, marginBottom: 10, ...PROSE }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 4, lineHeight: 1.65 }}>{children}</li>,
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: '#e2e8f0' }}>{children}</strong>
  ),
  em: ({ children }) => <em style={{ fontStyle: 'italic', color: '#e2e8f0' }}>{children}</em>,
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: '3px solid #14b8a6',
        paddingLeft: 16,
        marginBottom: 10,
        color: '#94a3b8',
      }}
    >
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre
      style={{
        background: '#0a0e27',
        border: '1px solid #2a3350',
        borderRadius: 6,
        padding: '12px 16px',
        overflowX: 'auto',
        marginBottom: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) => {
    const isBlock = Boolean(className)
    if (isBlock) {
      return (
        <code
          className={className}
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#e2e8f0' }}
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          background: '#1c2440',
          border: '1px solid #2a3350',
          borderRadius: 4,
          padding: '2px 6px',
          color: '#e2e8f0',
        }}
        {...props}
      >
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 14,
          color: '#e2e8f0',
        }}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      style={{
        border: '1px solid #2a3350',
        padding: '6px 12px',
        background: '#1c2440',
        fontWeight: 600,
        textAlign: 'left',
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ border: '1px solid #2a3350', padding: '6px 12px' }}>{children}</td>
  ),
}

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
