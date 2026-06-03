/**
 * 分块向量化重试：POST /yansee/api/documents/{documentId}/chunks/vectorization/retry
 * 若后端要求 chunkId，默认放在 JSON body；仅需文档级重试时可传 chunkId 为 null。
 */
import { API_BASE } from './apiBase'

export const retryDocumentChunkVectorization = async (documentId, chunkId) => {
  const url = `${API_BASE}/yansee/api/documents/${encodeURIComponent(documentId)}/chunks/vectorization/retry`
  const body =
    chunkId != null && chunkId !== ''
      ? JSON.stringify({ chunkId: String(chunkId) })
      : '{}'
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text?.trim() || `HTTP error! status: ${response.status}`)
  }
  const text = await response.text().catch(() => '')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}
