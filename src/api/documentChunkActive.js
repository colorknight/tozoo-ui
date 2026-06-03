/**
 * 分块启停：PUT /yansee/api/documents/chunks/{chunkId}/active?active=
 */
import { API_BASE } from './apiBase'

export const setDocumentChunkActive = async (chunkId, active) => {
  const queryParams = new URLSearchParams()
  queryParams.append('active', active ? 'true' : 'false')
  const url = `${API_BASE}/yansee/api/documents/chunks/${encodeURIComponent(chunkId)}/active?${queryParams.toString()}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text?.trim() || `HTTP error! status: ${response.status}`)
  }
  return response.json()
}
