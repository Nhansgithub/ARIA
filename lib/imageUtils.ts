// Client-only browser utility. No server-only imports. No 'use client' directive.

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB (AC-2)
export const MAX_LONG_EDGE_PX = 1568 // AD-9

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

export function validateImageFile(file: File): { ok: boolean; error?: string } {
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: 'Image must be under 10 MB' }
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: 'Unsupported format. Use JPEG, PNG, WebP, GIF, or HEIC.' }
  }
  return { ok: true }
}

export async function compressImage(
  file: File,
  maxLongEdge = MAX_LONG_EDGE_PX
): Promise<{ base64: string; mediaType: SupportedMediaType; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, maxLongEdge / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas 2D context unavailable'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const outputType: SupportedMediaType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const dataUrl = canvas.toDataURL(outputType, 0.85)
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({ base64, mediaType: outputType, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for compression'))
    }
    img.src = url
  })
}
