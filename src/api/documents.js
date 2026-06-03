/**
 * 文档相关 API
 */
import { API_BASE } from './apiBase'

// 根据文档名称获取 documentId
export const getDocumentIdByName = async (fileName) => {
  const response = await fetch(`${API_BASE}/yansee/api/documents/name/${encodeURIComponent(fileName)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`未找到文档：${response.status}`)
  }
  return response.text()
}

// 搜索文档
export const searchDocuments = async (params) => {
  const queryParams = new URLSearchParams()
  if (params.kbId !== undefined && params.kbId !== null) {
    queryParams.append('kbId', params.kbId)
  }
  if (params.keyword !== undefined && params.keyword !== null) {
    queryParams.append('keyword', params.keyword)
  }
  if (params.page !== undefined && params.page !== null) {
    queryParams.append('page', params.page)
  }
  if (params.size !== undefined && params.size !== null) {
    queryParams.append('size', params.size)
  }
  const url = `${API_BASE}/yansee/api/documents/search?${queryParams.toString()}`
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

/**
 * @typedef {Object} DocumentUploadProgressEvent
 * @property {'preparing'|'uploading'|'processing'|'complete'} phase
 * @property {number} [percent] — 上传阶段 0–100，无法计算时为 undefined
 * @property {number} [loaded]
 * @property {number} [total]
 */

/**
 * 上传文档（统一使用 /yansee/api/documents/upload）
 * @param {Object} params
 * @param {File} params.file - 文件（必填）
 * @param {string} params.kbId - 知识库 ID（必填）
 * @param {string} [params.title] - 标题
 * @param {string} [params.description] - 描述
 * @param {Object} [options]
 * @param {(evt: DocumentUploadProgressEvent) => void} [options.onProgress] — 提供时用 XHR 以支持上传字节进度与服务端处理阶段
 * @param {(xhr: XMLHttpRequest) => void} [options.onXhrReady] — 可用于中止上传
 * @returns {Promise<SeeDocument>}
 */
export const createDocument = async ({ file, kbId, title, description }, options = {}) => {
  const { onProgress, onXhrReady } = options
  const queryParams = new URLSearchParams()
  queryParams.append('kbId', String(kbId))
  if (title != null && title !== '') queryParams.append('title', title)
  if (description != null && description !== '') queryParams.append('description', description)
  const url = `${API_BASE}/yansee/api/documents/upload?${queryParams.toString()}`
  const formData = new FormData()
  formData.append('file', file)

  if (!onProgress) {
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    onXhrReady?.(xhr)

    xhr.open('POST', url)
    xhr.responseType = 'json'

    onProgress({ phase: 'preparing' })

    xhr.upload.addEventListener('loadstart', () => {
      onProgress({
        phase: 'uploading',
        loaded: 0,
        total: file.size,
        percent: 0
      })
    })

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && e.total > 0) {
        const percent = Math.min(100, Math.round((100 * e.loaded) / e.total))
        onProgress({
          phase: 'uploading',
          loaded: e.loaded,
          total: e.total,
          percent
        })
      } else {
        onProgress({
          phase: 'uploading',
          loaded: e.loaded,
          total: undefined,
          percent: undefined
        })
      }
    })

    xhr.upload.addEventListener('load', () => {
      onProgress({ phase: 'processing' })
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({ phase: 'complete', percent: 100 })
        let data = xhr.response
        if (data == null && xhr.responseText) {
          try {
            data = JSON.parse(xhr.responseText)
          } catch {
            data = null
          }
        }
        resolve(data)
        return
      }
      const msg = xhr.responseText?.trim() || `HTTP error! status: ${xhr.status}`
      reject(new Error(msg))
    })

    xhr.addEventListener('error', () => {
      reject(new Error('网络错误，上传失败'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('上传已取消'))
    })

    xhr.send(formData)
  })
}

// 获取文档详情
export const getDocumentById = async (id) => {
  const response = await fetch(`${API_BASE}/yansee/api/documents/${id}`)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// 获取文档 Markdown 全文
export const getDocumentMarkdown = async (documentId) => {
  const response = await fetch(`${API_BASE}/yansee/api/documents/${documentId}/markdown`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.text()
}

// 删除文档
export const deleteDocument = async (id) => {
  const response = await fetch(`${API_BASE}/yansee/api/documents/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return { success: true }
}

// 获取文档图片列表（分页）
export const getImagesByDocument = async (documentId, page = 0, size = 10) => {
  const queryParams = new URLSearchParams()
  if (page !== undefined && page !== null) queryParams.append('page', page)
  if (size !== undefined && size !== null) queryParams.append('size', size)
  const url = `${API_BASE}/yansee/api/document-images/document/${documentId}?${queryParams.toString()}`
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// 获取文档指定页起始的图片列表（返回 pageNumber, pageNumber+1, pageNumber+2，超范围则返回有效页）
export const getImageByPageNumber = async (documentId, pageNumber, options = {}) => {
  const url = `${API_BASE}/yansee/api/document-images/document/${documentId}/page/${pageNumber}`
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// 获取文档总页数
export const countImagesByDocument = async (documentId) => {
  const url = `${API_BASE}/yansee/api/document-images/document/${documentId}/count`
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

/**
 * 按文档 + pageIndex 查看 chunk 列表。当前接口按批量语义返回 pageIndex、pageIndex+1、pageIndex+2 的分块集合。
 * pageIndex 为文档真实页码（与 SEE_DOCUMENT_CHUNK.page_numbers、整页预览图一致，通常从 1 起），不是数组下标。
 * @param {string} documentId
 * @param {{ pageIndex: number, resolveEmbeddedImages?: boolean }} query
 * @returns {Promise<Array>} SeeDocumentChunk[] — active, chunkIndex, content, pageNumbers 等
 */
export const getDocumentChunksView = async (documentId, query, options = {}) => {
  const pageIndex = Number(query?.pageIndex)
  if (!Number.isFinite(pageIndex)) {
    throw new Error('getDocumentChunksView: pageIndex 无效')
  }
  const queryParams = new URLSearchParams()
  queryParams.append('pageIndex', String(Math.trunc(pageIndex)))
  if (typeof query?.resolveEmbeddedImages === 'boolean') {
    queryParams.append('resolveEmbeddedImages', String(query.resolveEmbeddedImages))
  }
  const url = `${API_BASE}/yansee/api/documents/${encodeURIComponent(documentId)}/chunks/view?${queryParams.toString()}`
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    signal: options?.signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

export { setDocumentChunkActive } from './documentChunkActive.js'
export { retryDocumentChunkVectorization } from './documentChunkVectorization.js'
