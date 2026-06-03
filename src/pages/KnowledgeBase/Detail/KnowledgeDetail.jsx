import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getKnowledgeBaseById } from '../../../api/knowledge'
import {
  searchDocuments,
  createDocument,
  deleteDocument,
  getImageByPageNumber,
  getDocumentChunksView
} from '../../../api/documents'
import { setDocumentChunkActive } from '../../../api/documentChunkActive'
import { retryDocumentChunkVectorization } from '../../../api/documentChunkVectorization'
import './KnowledgeDetail.css'

/**
 * 文档列表状态元信息：
 * 1) 与后端主链路状态保持对齐；
 * 2) 未识别状态统一归类为“处理中”；
 * 3) 原始状态值通过 rawForTitle 保留用于悬浮提示。
 */
const DOC_STATUS_META = {
  use: {
    label: '可使用',
    variant: 'success',
    background: '#f6ffed',
    color: '#389e0d',
    borderColor: '#b7eb8f',
    rawForTitle: ''
  },
  pipeline: {
    label: '处理中',
    variant: 'progress',
    background: '#fff7e6',
    color: '#d46b08',
    borderColor: '#ffd591',
    rawForTitle: ''
  },
  upload: {
    label: '正在上传',
    variant: 'progress',
    background: '#fff7e6',
    color: '#d46b08',
    borderColor: '#ffd591',
    rawForTitle: ''
  },
  done: {
    label: '处理完成',
    variant: 'success',
    background: '#f6ffed',
    color: '#389e0d',
    borderColor: '#b7eb8f',
    rawForTitle: ''
  },
  fail: {
    label: '处理失败',
    variant: 'error',
    background: '#fff2f0',
    color: '#cf1322',
    borderColor: '#ffccc7',
    rawForTitle: ''
  },
  muted: {
    label: '已停用',
    variant: 'muted',
    background: '#f5f5f5',
    color: '#8c8c8c',
    borderColor: '#d9d9d9',
    rawForTitle: ''
  },
  deleted: {
    label: '已删除',
    variant: 'muted',
    background: '#f5f5f5',
    color: '#8c8c8c',
    borderColor: '#d9d9d9',
    rawForTitle: ''
  }
}

const pickDocMeta = (baseKey, overrides = {}) => ({
  ...DOC_STATUS_META[baseKey],
  rawForTitle: '',
  ...overrides
})

/** 后端主链路状态映射：进行中阶段统一显示为“处理中”，并保留原始状态值。 */
const CANONICAL_DOC_STATUS = {
  UPLOADING: pickDocMeta('pipeline', { label: '处理中' }),
  PENDING: pickDocMeta('pipeline', { label: '处理中' }),
  CONVERTING_TO_PDF: pickDocMeta('pipeline', { label: '处理中' }),
  RENDERING_IMAGES: pickDocMeta('pipeline', { label: '处理中' }),
  CONVERTING_MARKDOWN: pickDocMeta('pipeline', { label: '处理中' }),
  EMBEDDING: pickDocMeta('pipeline', { label: '处理中' }),
  COMPLETED: pickDocMeta('done', { label: '处理完成' }),
  FAILED: pickDocMeta('fail', { label: '处理失败' }),
  DELETED: pickDocMeta('deleted', { label: '已删除' })
}

const LEGACY_PIPELINE_STATUSES = new Set([
  'PROCESSING',
  'PARSING',
  'INDEXING',
  'CHUNK',
  'CHUNKING',
  'CHUNKS',
  'SPLIT',
  'SPLITTING',
  'EMBED',
  'EMBEDDINGS',
  'VECTOR',
  'VECTORIZE',
  'VECTORIZING',
  'VECTORIZED',
  'RENDER',
  'RENDERING',
  'THUMBNAIL',
  'OCR',
  'EXTRACT',
  'EXTRACTING',
  'CONVERT',
  'CONVERTING',
  'ANALYZE',
  'ANALYZING',
  'RUNNING',
  'IN_PROGRESS',
  'INIT',
  'INITIALIZING'
])

const getDocStatusMeta = (rawStatus) => {
  const raw = rawStatus != null ? String(rawStatus).trim() : ''
  if (!raw) {
    return { ...DOC_STATUS_META.use }
  }

  const status = raw.replace(/\s+/g, '_').toUpperCase()

  if (CANONICAL_DOC_STATUS[status]) {
    const m = { ...CANONICAL_DOC_STATUS[status] }
    if (m.variant === 'progress') {
      m.rawForTitle = raw
    }
    return m
  }

  const legacyMap = {
    READY: DOC_STATUS_META.use,
    COMPLETE: CANONICAL_DOC_STATUS.COMPLETED,
    COMPLETED: CANONICAL_DOC_STATUS.COMPLETED,
    SUCCESS: CANONICAL_DOC_STATUS.COMPLETED,
    OK: DOC_STATUS_META.use,
    DONE: CANONICAL_DOC_STATUS.COMPLETED,
    ACTIVE: DOC_STATUS_META.use,
    AVAILABLE: DOC_STATUS_META.use,
    ONLINE: DOC_STATUS_META.use,
    QUEUED: CANONICAL_DOC_STATUS.PENDING,
    WAITING: CANONICAL_DOC_STATUS.PENDING,
    FAILED: CANONICAL_DOC_STATUS.FAILED,
    ERROR: CANONICAL_DOC_STATUS.FAILED,
    FAILURE: CANONICAL_DOC_STATUS.FAILED,
    DELETED: CANONICAL_DOC_STATUS.DELETED,
    DISABLED: DOC_STATUS_META.muted,
    OFFLINE: DOC_STATUS_META.muted
  }

  if (legacyMap[status]) {
    return { ...legacyMap[status] }
  }

  if (LEGACY_PIPELINE_STATUSES.has(status)) {
    return { ...DOC_STATUS_META.pipeline, label: '处理中', rawForTitle: raw }
  }

  return {
    ...DOC_STATUS_META.pipeline,
    label: '处理中',
    rawForTitle: raw
  }
}

const getDocumentListStatusRaw = (doc) =>
  doc?.status ?? doc?.documentStatus ?? doc?.state ?? doc?.docStatus ?? ''

const normalizeDocumentStatusKey = (rawStatus) => {
  const raw = rawStatus != null ? String(rawStatus).trim() : ''
  if (!raw) return ''
  return raw.replace(/\s+/g, '_').toUpperCase()
}

/** 文档处于 EMBEDDING 阶段时，列表显示“重新处理”入口（续跑向量化）。 */
const isDocumentEmbeddingStatus = (doc) =>
  normalizeDocumentStatusKey(getDocumentListStatusRaw(doc)) === 'EMBEDDING'

/** 优先使用后端返回的进度百分比；缺失时按阶段估算进度条宽度。 */
const getDocumentPipelineBarPercent = (doc) => {
  const p = doc?.processingProgress ?? doc?.progressPercent ?? doc?.progress
  if (typeof p === 'number' && Number.isFinite(p)) {
    return Math.max(2, Math.min(100, Math.round(p)))
  }
  const key = normalizeDocumentStatusKey(getDocumentListStatusRaw(doc))
  const map = {
    UPLOADING: 14,
    PENDING: 24,
    CONVERTING_TO_PDF: 32,
    RENDERING_IMAGES: 44,
    CONVERTING_MARKDOWN: 56,
    EMBEDDING: 72
  }
  return map[key] ?? 28
}

const getDocumentPipelineStageHint = (doc) => {
  const key = normalizeDocumentStatusKey(getDocumentListStatusRaw(doc))
  const hints = {
    UPLOADING: '上传与记录创建',
    PENDING: '等待异步处理',
    CONVERTING_TO_PDF: '转换为PDF（预留）',
    RENDERING_IMAGES: '分页预览',
    CONVERTING_MARKDOWN: '解析与分块',
    EMBEDDING: '建立检索索引'
  }
  return hints[key] || null
}

const formatDocumentListTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const getDisplayDocTitle = (rawName, maxChars = 28) => {
  const name = (rawName || '').trim()
  if (!name || name.length <= maxChars) return name

  const dotIndex = name.lastIndexOf('.')
  const hasExt = dotIndex > 0 && dotIndex < name.length - 1
  if (hasExt) {
    const ext = name.slice(dotIndex)
    const base = name.slice(0, dotIndex)
    const budget = maxChars - ext.length - 1
    if (budget < 6) {
      return `${name.slice(0, Math.max(1, maxChars - 1))}…`
    }
    const head = Math.ceil(budget * 0.62)
    const tail = Math.max(2, budget - head)
    return `${base.slice(0, head)}…${base.slice(-tail)}${ext}`
  }

  const head = Math.ceil((maxChars - 1) / 2)
  const tail = Math.max(1, maxChars - 1 - head)
  return `${name.slice(0, head)}…${name.slice(-tail)}`
}

/**
 * 基于 react-markdown 的默认 URL 校验逻辑扩展白名单：
 * 除默认协议外，额外允许 data: 与 blob:，避免内联图片 src 被清空。
 */
const markdownUrlTransformAllowData = (value) => {
  const v = String(value ?? '')
  const colon = v.indexOf(':')
  const questionMark = v.indexOf('?')
  const numberSign = v.indexOf('#')
  const slash = v.indexOf('/')
  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign) ||
    /^(https?|ircs?|mailto|xmpp|data|blob)$/i.test(v.slice(0, colon))
  ) {
    return v
  }
  return ''
}

const resolveMarkdownAssetUrl = (src) => {
  if (src == null) return null
  const s = String(src).trim().replace(/^['"]|['"]$/g, '')
  if (!s) return null
  if (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('data:') ||
    s.startsWith('blob:')
  ) {
    // data:...;base64,... 中若混入空白字符会导致加载失败，这里先做一次清洗。
    if (s.startsWith('data:') && s.includes(';base64,')) {
      const idx = s.indexOf(';base64,')
      const head = s.slice(0, idx + ';base64,'.length)
      const body = s.slice(idx + ';base64,'.length).replace(/\s+/g, '')
      return head + body
    }
    return s
  }
  // 对浏览器不直接识别但合法的自定义协议（如 attachment:）保持原样返回。
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
    return s
  }
  // 相对路径统一补成根路径形式：foo/bar.png -> /foo/bar.png
  if (!s.startsWith('/'))
    return `/${s}`
  return s
}

const normalizeMarkdownDataImages = (md) => {
  if (!md) return md
  // 若 Markdown 中 data URL 被换行，可能导致 src 解析丢失；这里将 base64 内容压平。
  return String(md).replace(
    /(!\[[^\]]*]\(data:[^)]*?;base64,)([^)]*?)\)/g,
    (_m, head, body) => `${head}${String(body).replace(/\s+/g, '')})`
  )
}

const extractDataImageSrcList = (md) => {
  if (!md) return []
  const list = []
  const re = /!\[[^\]]*]\((data:image\/[^)]+)\)/gi
  let m
  while ((m = re.exec(md))) {
    list.push(m[1])
    if (list.length >= 20) break
  }
  return list
}

const getTextContent = (node) => {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getTextContent).join('')
  if (typeof node === 'object' && node.props && node.props.children != null) {
    return getTextContent(node.props.children)
  }
  return ''
}

const extractMarkdownTableRows = (children) => {
  // 输出二维表格文本：rows[rowIndex][cellIndex] = string
  const rows = []
  const stack = Array.isArray(children) ? children : [children]

  const visit = (el) => {
    if (!el) return
    if (Array.isArray(el)) {
      el.forEach(visit)
      return
    }
    if (typeof el !== 'object') return

    const type = el.type
    const ch = el.props?.children

    if (type === 'tr') {
      const cells = []
      const cellEls = Array.isArray(ch) ? ch : [ch]
      for (const c of cellEls) {
        if (!c || typeof c !== 'object') continue
        if (c.type === 'td' || c.type === 'th') {
          cells.push(getTextContent(c).replace(/\s+/g, ' ').trim())
        }
      }
      if (cells.length) rows.push(cells)
      return
    }
    visit(ch)
  }

  stack.forEach(visit)
  return rows
}

const isTocLikeTable = (rows) => {
  if (!rows || rows.length < 4) return false
  const sample = rows.slice(0, 12)
  const colCount = Math.max(...sample.map((r) => r.length))
  if (colCount < 2 || colCount > 4) return false

  // 目录表常见特征：点引导线较多，且末列通常为页码（数字或罗马数字）。
  const dotLineCount = sample.filter((r) => r.some((c) => /\.+\s*\d*\s*$/.test(c) || /\.\.+/.test(c))).length
  const pageLikeCount = sample.filter((r) => {
    const last = r[r.length - 1] || ''
    return /^(\d+|[IVXLCDM]+)$/i.test(last.trim())
  }).length

  return dotLineCount >= 2 && pageLikeCount >= 2
}

const stripLeaderDots = (s) => String(s || '').replace(/\.\s*\.\s*\.+/g, ' ').replace(/\.+\s*$/g, '').trim()

const formatUploadBytes = (n) => {
  if (n == null || !Number.isFinite(n)) return ''
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/** 计算分块 UTF-8 字节数：优先使用接口字段，缺失时按 content 编码长度计算。 */
const getChunkByteLength = (chunk) => {
  const fromApi =
    chunk?.byteSize ?? chunk?.contentLength ?? chunk?.contentByteLength ?? chunk?.bytes
  if (typeof fromApi === 'number' && Number.isFinite(fromApi) && fromApi >= 0) {
    return Math.round(fromApi)
  }
  return new TextEncoder().encode(String(chunk?.content ?? '')).length
}

const normalizeChunkListResponse = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.records)) return data.records
  if (data && typeof data === 'object' && (data.content != null || data.id != null)) return [data]
  return []
}

const parseChunkPageNumbers = (chunk) => {
  const raw = chunk?.pageNumbers
  if (Array.isArray(raw)) {
    return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n)).map((n) => Math.trunc(n))
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return [Math.trunc(raw)]
  }
  const text = String(raw ?? '').trim()
  if (!text) return []
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n)).map((n) => Math.trunc(n))
      }
    } catch {
      // ignore malformed JSON and fallback to regexp parsing
    }
  }
  const matches = text.match(/\d+/g) || []
  return matches.map((n) => Number(n)).filter((n) => Number.isFinite(n)).map((n) => Math.trunc(n))
}

const splitChunksByPages = (chunkList, targetPages) => {
  const pages = Array.isArray(targetPages) ? targetPages : []
  const targetSet = new Set(pages)
  const grouped = {}
  pages.forEach((p) => {
    grouped[p] = []
  })
  let hasMatched = false
  chunkList.forEach((chunk) => {
    const pagesOfChunk = parseChunkPageNumbers(chunk).filter((p) => targetSet.has(p))
    if (pagesOfChunk.length === 0) return
    hasMatched = true
    pagesOfChunk.forEach((p) => grouped[p].push(chunk))
  })
  if (!hasMatched && pages.length > 0) {
    grouped[pages[0]] = chunkList
  }
  return grouped
}

const CHUNK_CONTENT_TYPE_LABEL_MAP = {
  cover: '封面',
  toc: '目录',
  body: '正文',
  header_footer: '页眉页脚',
  appendix: '附件'
}

const getChunkContentTypeLabel = (rawType) => {
  const key = String(rawType ?? '').trim().toLowerCase()
  if (!key) return ''
  return CHUNK_CONTENT_TYPE_LABEL_MAP[key] || '未知类型'
}

const CHUNK_INTENT_TYPE_LABEL_MAP = {
  background: '背景/概述',
  definition: '定义解释',
  requirement: '规范要求/约束',
  procedure: '步骤流程',
  conclusion: '结论结果',
  reference: '参考/附录指引',
  contact: '联系方式',
  other: '其他'
}

const getChunkIntentTypeLabel = (rawType) => {
  const key = String(rawType ?? '').trim().toLowerCase()
  if (!key) return ''
  return CHUNK_INTENT_TYPE_LABEL_MAP[key] || '其他'
}

const getChunkRefPathSegments = (rawPath) => {
  const segments = String(rawPath ?? '')
    .split('>')
    .map((part) => part.replace(/\s+/g, ''))
    .filter(Boolean)

  if (segments.length >= 2) return segments.slice(1)
  return segments
}

const getDocUploadBarPercent = (state) => {
  if (!state) return 0
  const { phase, percent } = state
  if (phase === 'preparing') return 8
  if (phase === 'uploading') {
    return 12 + (typeof percent === 'number' ? percent * 0.68 : 36)
  }
  if (phase === 'processing') return 90
  if (phase === 'complete') return 100
  return 0
}

const getDocUploadProgressHint = (state) => {
  if (!state) return ''
  if (state.phase === 'preparing') return '正在准备上传'
  if (state.phase === 'uploading')
    return state.loaded != null && state.total != null
      ? `已传${formatUploadBytes(state.loaded)} / ${formatUploadBytes(state.total)}`
      : '正在上传，请稍候'
  if (state.phase === 'processing') {
    return '文件已送达服务器，正在解析并写入知识库，大文件可能需多等片刻'
  }
  if (state.phase === 'complete') return '处理完成，正在刷新列表'
  return ''
}

function KnowledgeDetail() {
  const { id } = useParams()
  const [knowledgeBase, setKnowledgeBase] = useState(null)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [loading, setLoading] = useState(false) // 初始不展示全局加载态。
  const [showAddDocModal, setShowAddDocModal] = useState(false)
  /** 弹窗内容延迟一帧渲染，减少首次挂载压力，避免阻塞文件选择器弹出。 */
  const [addDocModalContentReady, setAddDocModalContentReady] = useState(false)
  const [newDocument, setNewDocument] = useState({
    name: '',
    description: '',
    fileType: '',
    fileSize: 0,
    enabled: true
  })
  const [selectedFile, setSelectedFile] = useState(null)
  const [activeUploadFile, setActiveUploadFile] = useState(null)
  const [docUploadState, setDocUploadState] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [documents, setDocuments] = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [pagination, setPagination] = useState({
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  /** 左侧面板模式：文档列表与切片列表互斥，仅在可见时请求各自数据。 */
  const [leftPanelMode, setLeftPanelMode] = useState('documents')
  const leftPanelModeRef = useRef(leftPanelMode)
  leftPanelModeRef.current = leftPanelMode
  // 文档预览按页懒加载：维护总页数、占位高度、图片缓存和当前页。
  const PAGE_SLOT_HEIGHT = 1000 // 单页占位高度（px），实际高度会随缩放比例变化。
  const PREVIEW_ZOOM_MIN = 0.5
  const PREVIEW_ZOOM_MAX = 2.5
  const PREVIEW_ZOOM_STEP = 0.25
  const DEFAULT_PREVIEW_ZOOM = 1
  const PREVIEW_PREFETCH_BEHIND = 1
  const PREVIEW_PREFETCH_AHEAD = 2
  const PREVIEW_PAGE_CACHE_LIMIT = (() => {
    if (typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number') {
      if (navigator.deviceMemory <= 4) return 4
      if (navigator.deviceMemory <= 8) return 8
    }
    return 12
  })()
  const CHUNK_PREFETCH_AHEAD = 1
  const CHUNK_CACHE_LIMIT = 8
  const [previewZoom, setPreviewZoom] = useState(DEFAULT_PREVIEW_ZOOM)
  const previewSlotHeight = PAGE_SLOT_HEIGHT * previewZoom
  const [totalPreviewPages, setTotalPreviewPages] = useState(0)
  const [pageImages, setPageImages] = useState({}) // 有界 LRU：仅保留当前页附近与最近访问页，避免 base64 长驻占用内存。
  const [loadingPages, setLoadingPages] = useState({}) // pageNum -> true，表示该页图片正在加载。
  const [previewPage, setPreviewPage] = useState(1) // 当前滚动页，用于工具栏显示及翻页控制。
  const previewPageRef = useRef(1)
  previewPageRef.current = previewPage
  const selectedDocumentIdRef = useRef(null)
  selectedDocumentIdRef.current = selectedDocument?.id ?? null
  const [jumpPageInput, setJumpPageInput] = useState('1')
  const [documentChunks, setDocumentChunks] = useState([])
  const [chunksLoading, setChunksLoading] = useState(false)
  const [chunksFetchError, setChunksFetchError] = useState(null)
  const [chunkActiveSavingId, setChunkActiveSavingId] = useState(null)
  const [chunkActiveActionError, setChunkActiveActionError] = useState(null)
  const [documentVectorRetryingId, setDocumentVectorRetryingId] = useState(null)
  const [documentListRetryError, setDocumentListRetryError] = useState(null)
  const fileInputRef = useRef(null)
  const documentUploadXhrRef = useRef(null)
  const docUploadBusyRef = useRef(false)
  const scrollContainerRef = useRef(null)
  const loadingPagesRef = useRef({}) // 与 loadingPages 同步，避免同一页重复请求。
  const pageImageCacheOrderRef = useRef([]) // LRU 顺序：越靠后越新。
  const pageImageAbortMapRef = useRef(new Map()) // requestStartPage -> { controller, coveredPages }
  const pageImagesRef = useRef({})
  pageImagesRef.current = pageImages
  const chunkCacheRef = useRef({})
  const chunkCacheOrderRef = useRef([])
  const chunkAbortMapRef = useRef(new Map()) // requestStartPage -> { controller, coveredPages }
  const chunkLoadingRef = useRef({})
  loadingPagesRef.current = loadingPages

  // 使用 useRef 保存 pageSize，避免因依赖变化触发不必要重渲染。
  const pageSizeRef = useRef(10)
  const prevIdRef = useRef(null)
  const isLoadingRef = useRef(false) // 防止重复加载。
  const documentListRef = useRef(null) // 文档列表容器引用。
  /** 列表进度条平滑策略：按 docId 记录历史最大宽度，避免进度条回退。 */
  const docPipelineBarPeakRef = useRef({})

  const getDocumentPipelineBarPercentStable = (doc) => {
    const instant = getDocumentPipelineBarPercent(doc)
    const docId = doc?.id
    if (!docId) return instant
    const peaks = docPipelineBarPeakRef.current
    const prev = peaks[docId] ?? 0
    const next = Math.max(prev, instant)
    peaks[docId] = next
    return next
  }

  const abortAllPageImageRequests = () => {
    pageImageAbortMapRef.current.forEach((task) => task?.controller?.abort())
    pageImageAbortMapRef.current.clear()
  }

  const touchPageImageCache = (pageNum) => {
    const order = pageImageCacheOrderRef.current.filter((p) => p !== pageNum)
    order.push(pageNum)
    pageImageCacheOrderRef.current = order
  }

  const upsertPageImageCache = (pageNum, imageUrl) => {
    setPageImages((prev) => {
      const next = { ...prev, [pageNum]: imageUrl }
      touchPageImageCache(pageNum)
      while (pageImageCacheOrderRef.current.length > PREVIEW_PAGE_CACHE_LIMIT) {
        const evictedPage = pageImageCacheOrderRef.current.shift()
        if (evictedPage != null) {
          delete next[evictedPage]
        }
      }
      return next
    })
  }

  const abortAllChunkRequests = () => {
    chunkAbortMapRef.current.forEach((task) => task?.controller?.abort())
    chunkAbortMapRef.current.clear()
    chunkLoadingRef.current = {}
  }

  const touchChunkCache = (pageNum) => {
    const order = chunkCacheOrderRef.current.filter((p) => p !== pageNum)
    order.push(pageNum)
    chunkCacheOrderRef.current = order
  }

  const upsertChunkCache = (pageNum, chunkList) => {
    chunkCacheRef.current[pageNum] = chunkList
    touchChunkCache(pageNum)
    while (chunkCacheOrderRef.current.length > CHUNK_CACHE_LIMIT) {
      const evictedPage = chunkCacheOrderRef.current.shift()
      if (evictedPage != null) {
        delete chunkCacheRef.current[evictedPage]
      }
    }
  }

  useEffect(() => {
    setLeftPanelMode('documents')
    docPipelineBarPeakRef.current = {}
  }, [id])

  useEffect(() => {
    return () => {
      abortAllPageImageRequests()
      abortAllChunkRequests()
    }
  }, [])

  useEffect(() => {
    if (selectedDocument?.id) return
    abortAllPageImageRequests()
    abortAllChunkRequests()
    loadingPagesRef.current = {}
    pageImageCacheOrderRef.current = []
    chunkCacheRef.current = {}
    chunkCacheOrderRef.current = []
    setPageImages({})
    setLoadingPages({})
    setDocumentChunks([])
    setChunksLoading(false)
  }, [selectedDocument?.id])

  useEffect(() => {
    if (isLoadingRef.current || prevIdRef.current === id) {
      return
    }

    isLoadingRef.current = true

    const fetchKb = async () => {
      try {
        const kbData = await getKnowledgeBaseById(id)
        setKnowledgeBase(kbData)
        prevIdRef.current = id
      } catch (error) {
        console.error('获取知识库信息失�?', error)
      } finally {
        setLoading(false)
        isLoadingRef.current = false
      }
    }

    fetchKb()
  }, [id])

  // 仅在左侧为“文档列表”模式时拉取列表数据。
  useEffect(() => {
    if (!id || leftPanelMode !== 'documents') return
    let cancelled = false
    setLoadingDocs(true)
    const load = async () => {
      try {
        const searchResponse = await searchDocuments({
          kbId: id,
          keyword: searchTerm,
          page: 0,
          size: pageSizeRef.current
        })
        if (cancelled) return
        setDocuments(searchResponse.content || [])
        setCurrentPage(0)
        setHasMore(!searchResponse.last)
        setPagination({
          totalElements: searchResponse.totalElements,
          totalPages: searchResponse.totalPages,
          first: searchResponse.first,
          last: searchResponse.last
        })
      } catch (error) {
        console.error('加载文档列表失败:', error)
        if (!cancelled) {
          setDocuments([])
          setHasMore(false)
        }
      } finally {
        if (!cancelled) setLoadingDocs(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, leftPanelMode])

  // 弹窗打开后下一帧再渲染表单，降低首帧挂载压力。
  useEffect(() => {
    if (!showAddDocModal) return
    const id = requestAnimationFrame(() => {
      setAddDocModalContentReady(true)
    })
    return () => cancelAnimationFrame(id)
  }, [showAddDocModal])

  const handleDocumentSelect = (document) => {
    abortAllPageImageRequests()
    abortAllChunkRequests()
    setSelectedDocument(document)
    setPreviewZoom(DEFAULT_PREVIEW_ZOOM)
    setPreviewPage(1)
    setTotalPreviewPages(0)
    setPageImages({})
    setLoadingPages({})
    setJumpPageInput('1')
    setDocumentChunks([])
    setChunksFetchError(null)
    setChunkActiveActionError(null)
    setDocumentListRetryError(null)
    loadingPagesRef.current = {}
    pageImageCacheOrderRef.current = []
    chunkCacheRef.current = {}
    chunkCacheOrderRef.current = []
  }

  // 进入切片视图或占位高度变化时，用滚动位置校正当前页，避免状态与视图不一致。
  useLayoutEffect(() => {
    if (leftPanelMode !== 'chunks' || !selectedDocument?.id || totalPreviewPages < 1) return
    const el = scrollContainerRef.current
    if (!el) return
    const fromScroll = Math.floor(el.scrollTop / previewSlotHeight) + 1
    const page = Math.max(1, Math.min(totalPreviewPages, fromScroll))
    setPreviewPage((p) => (p === page ? p : page))
    setJumpPageInput((prev) => {
      const next = String(page)
      return prev === next ? prev : next
    })
  }, [leftPanelMode, selectedDocument?.id, totalPreviewPages, previewSlotHeight])

  // 退出切片视图时释放分块数据，避免在文档列表模式下继续占用内存。
  useEffect(() => {
    if (leftPanelMode === 'chunks') return
    abortAllChunkRequests()
    setDocumentChunks([])
    setChunksFetchError(null)
    setChunkActiveActionError(null)
    setChunksLoading(false)
  }, [leftPanelMode])

  // 切片模式：按接口语义批量请求（n,n+1,n+2），当前页优先并预取后续页。
  useEffect(() => {
    if (leftPanelMode !== 'chunks' || !selectedDocument?.id) {
      return
    }
    const docId = selectedDocument.id
    const page = Math.max(1, Math.min(totalPreviewPages || 1, previewPage))
    const requestedPages = Array.from({ length: CHUNK_PREFETCH_AHEAD + 1 }, (_, i) => page + i).filter(
        (p) => p >= 1 && p <= totalPreviewPages
    )
    const keepPages = new Set(requestedPages)

    chunkAbortMapRef.current.forEach((task, requestStartPage) => {
      const hasNeededPage = Array.isArray(task?.coveredPages) && task.coveredPages.some((p) => keepPages.has(p))
      if (!hasNeededPage) {
        task?.controller?.abort()
        chunkAbortMapRef.current.delete(requestStartPage)
        if (Array.isArray(task?.coveredPages)) {
          task.coveredPages.forEach((p) => {
            delete chunkLoadingRef.current[p]
          })
        }
      }
    })

    const fetchChunkBatch = async (startPage) => {
      if (!startPage || startPage < 1 || startPage > totalPreviewPages) return
      const coveredPages = [startPage, startPage + 1, startPage + 2].filter(
        (p) => p >= 1 && p <= totalPreviewPages
      )
      const uncachedPages = coveredPages.filter((p) => !chunkCacheRef.current[p])
      if (uncachedPages.length === 0) {
        coveredPages.forEach((p) => touchChunkCache(p))
        if (chunkCacheRef.current[previewPageRef.current]) {
          setDocumentChunks(chunkCacheRef.current[previewPageRef.current])
          setChunksFetchError(null)
          setChunksLoading(false)
        }
        return
      }
      if (chunkAbortMapRef.current.has(startPage)) return
      const controller = new AbortController()
      chunkAbortMapRef.current.set(startPage, { controller, coveredPages })
      uncachedPages.forEach((p) => {
        chunkLoadingRef.current[p] = true
      })
      if (uncachedPages.includes(previewPageRef.current)) {
        setChunksLoading(true)
      }

      try {
        const data = await getDocumentChunksView(
          docId,
          { pageIndex: startPage },
          { signal: controller.signal }
        )
        if (selectedDocumentIdRef.current !== docId) return
        const chunkList = normalizeChunkListResponse(data)
        const groupedByPage = splitChunksByPages(chunkList, coveredPages)
        coveredPages.forEach((p) => {
          if (Object.prototype.hasOwnProperty.call(groupedByPage, p)) {
            upsertChunkCache(p, groupedByPage[p] || [])
          }
        })
        if (chunkCacheRef.current[previewPageRef.current]) {
          setDocumentChunks(chunkCacheRef.current[previewPageRef.current])
          setChunksFetchError(null)
        }
      } catch (e) {
        if (controller.signal.aborted) return
        if (selectedDocumentIdRef.current !== docId) return
        if (coveredPages.includes(previewPageRef.current)) {
          setChunksFetchError(e?.message || '分块加载失败')
          setDocumentChunks([])
        }
      } finally {
        const task = chunkAbortMapRef.current.get(startPage)
        if (task?.controller === controller) {
          chunkAbortMapRef.current.delete(startPage)
        }
        coveredPages.forEach((p) => {
          delete chunkLoadingRef.current[p]
        })
        if (!chunkLoadingRef.current[previewPageRef.current]) {
          setChunksLoading(false)
        }
      }
    }

    setChunkActiveActionError(null)
    if (chunkCacheRef.current[page]) {
      setDocumentChunks(chunkCacheRef.current[page])
      setChunksLoading(false)
      setChunksFetchError(null)
    } else {
      setDocumentChunks([])
    }
    const requestStartPages = []
    let coveredUntil = 0
    requestedPages.forEach((p) => {
      if (p > coveredUntil) {
        requestStartPages.push(p)
        coveredUntil = p + 2
      }
    })
    requestStartPages.forEach((p) => fetchChunkBatch(p))
  }, [leftPanelMode, selectedDocument?.id, previewPage, totalPreviewPages])

  const handleChunkActiveToggle = async (chunk, nextActive) => {
    const cid = chunk?.id
    if (!cid) {
      setChunkActiveActionError('该分块缺少id，无法更新状态')
      return
    }
    setChunkActiveActionError(null)
    setChunkActiveSavingId(cid)
    try {
      const updated = await setDocumentChunkActive(cid, nextActive)
      setDocumentChunks((prev) =>
        prev.map((c) => (c.id === cid ? { ...c, ...updated } : c))
      )
    } catch (e) {
      setChunkActiveActionError(e?.message || '更新分块状态失败')
    } finally {
      setChunkActiveSavingId(null)
    }
  }

  const handleDocumentVectorRetry = async (doc) => {
    const docId = doc?.id
    if (!docId) return
    setDocumentListRetryError(null)
    setDocumentVectorRetryingId(docId)
    try {
      await retryDocumentChunkVectorization(docId, null)
      const res = await handleRefreshDocuments()
      if (res?.content && selectedDocument?.id) {
        const row = res.content.find((d) => d.id === selectedDocument.id)
        if (row) setSelectedDocument((prev) => (prev ? { ...prev, ...row } : prev))
      }
    } catch (e) {
      setDocumentListRetryError(e?.message || '重新处理失败')
    } finally {
      setDocumentVectorRetryingId(null)
    }
  }

  // 根据当前文档的 totalPages 同步预览总页数。
  useEffect(() => {
    if (!selectedDocument) return
    const total = Number(selectedDocument?.totalPages)
    setTotalPreviewPages(Number.isFinite(total) && total > 0 ? Math.floor(total) : 0)
  }, [selectedDocument])

  // 预览图片加载：按接口语义批量请求（n,n+1,n+2），当前页优先并预取前后页。
  useEffect(() => {
    if (!selectedDocument || totalPreviewPages < 1) return
    const docId = selectedDocument.id
    const pageNum = Math.max(1, Math.min(totalPreviewPages, previewPage))
    const requestedPages = []
    for (let p = pageNum - PREVIEW_PREFETCH_BEHIND; p <= pageNum + PREVIEW_PREFETCH_AHEAD; p += 1) {
      if (p >= 1 && p <= totalPreviewPages) requestedPages.push(p)
    }
    const requestedSet = new Set(requestedPages)

    pageImageAbortMapRef.current.forEach((task, requestStartPage) => {
      const hasNeededPage = Array.isArray(task?.coveredPages) && task.coveredPages.some((p) => requestedSet.has(p))
      if (!hasNeededPage) {
        task?.controller?.abort()
        pageImageAbortMapRef.current.delete(requestStartPage)
        if (Array.isArray(task?.coveredPages)) {
          task.coveredPages.forEach((p) => {
            delete loadingPagesRef.current[p]
          })
        }
      }
    })

    const fetchPageImageBatch = async (startPage) => {
      const coveredPages = [startPage, startPage + 1, startPage + 2].filter(
        (p) => p >= 1 && p <= totalPreviewPages
      )
      const uncachedPages = coveredPages.filter((p) => !pageImagesRef.current[p])
      if (uncachedPages.length === 0) {
        coveredPages.forEach((p) => touchPageImageCache(p))
        return
      }
      if (pageImageAbortMapRef.current.has(startPage)) return
      const controller = new AbortController()
      pageImageAbortMapRef.current.set(startPage, { controller, coveredPages })
      const loadingPatch = {}
      uncachedPages.forEach((p) => {
        loadingPagesRef.current[p] = true
        loadingPatch[p] = true
      })
      if (Object.keys(loadingPatch).length > 0) {
        setLoadingPages((prev) => ({ ...prev, ...loadingPatch }))
      }
      try {
        const res = await getImageByPageNumber(docId, startPage, { signal: controller.signal })
        if (selectedDocumentIdRef.current !== docId || controller.signal.aborted) return
        const imageList = Array.isArray(res) ? res : (res ? [res] : [])
        imageList.forEach((item) => {
          const p = Number(item?.pageNumber)
          if (!Number.isFinite(p) || !item?.imageData) return
          const url = `data:${item.imageType || 'image/png'};base64,${item.imageData}`
          upsertPageImageCache(Math.trunc(p), url)
        })
      } catch (e) {
        if (!controller.signal.aborted) {
          console.error(`加载预览页失败: ${startPage}`, e)
        }
      } finally {
        const task = pageImageAbortMapRef.current.get(startPage)
        if (task?.controller === controller) {
          pageImageAbortMapRef.current.delete(startPage)
        }
        setLoadingPages((prev) => {
          const next = { ...prev }
          coveredPages.forEach((p) => {
            delete loadingPagesRef.current[p]
            delete next[p]
          })
          return next
        })
      }
    }

    const requestStartPages = []
    let coveredUntil = 0
    requestedPages.forEach((p) => {
      if (p > coveredUntil) {
        requestStartPages.push(p)
        coveredUntil = p + 2
      }
    })
    requestStartPages.forEach((p) => fetchPageImageBatch(p))
  }, [selectedDocument?.id, totalPreviewPages, previewPage])

  const adjustPreviewZoomBy = (delta) => {
    setPreviewZoom((prev) => {
      const z = Math.min(
        PREVIEW_ZOOM_MAX,
        Math.max(PREVIEW_ZOOM_MIN, Math.round((prev + delta) * 100) / 100)
      )
      const el = scrollContainerRef.current
      const prevSlot = PAGE_SLOT_HEIGHT * prev
      let page = 1
      if (el && prevSlot > 0 && totalPreviewPages > 0) {
        page = Math.max(1, Math.min(totalPreviewPages, Math.floor(el.scrollTop / prevSlot) + 1))
      }
      const newSlot = PAGE_SLOT_HEIGHT * z
      requestAnimationFrame(() => {
        const c = scrollContainerRef.current
        if (c) c.scrollTop = (page - 1) * newSlot
      })
      return z
    })
  }

  // 根据滚动位置实时更新当前页（工具栏“第 x 页”）。
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!selectedDocument || !container || totalPreviewPages < 1) return
    const onScroll = () => {
      const page = Math.floor(container.scrollTop / previewSlotHeight) + 1
      const clamped = Math.max(1, Math.min(totalPreviewPages, page))
      setPreviewPage(clamped)
      setJumpPageInput(String(clamped))
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [selectedDocument?.id, totalPreviewPages, previewSlotHeight])

  // 页码变化时同步跳转输入框（例如初始化或外部更新 previewPage）。
  useEffect(() => {
    setJumpPageInput(String(previewPage))
  }, [previewPage])

  const handleDeleteDocument = async (docId, e) => {
    console.log('删除按钮被点击，docId:', docId)
    console.log('事件对象:', e)
    e.stopPropagation() // 阻止冒泡，避免误触发文档选中。
    setDocumentToDelete(docId)
    setShowDeleteConfirm(true)
    console.log('确认框状态已设置')
  }

  const confirmDelete = async () => {
    if (!documentToDelete) return

    try {
      setDeleteLoading(true)
      await deleteDocument(documentToDelete)

      // 删除成功后从列表移除该文档。
      setDocuments(documents.filter(doc => doc.id !== documentToDelete))

      // 若删除的是当前选中文档，同时清空选中状态。
      if (selectedDocument && selectedDocument.id === documentToDelete) {
        setSelectedDocument(null)
      }

      setShowDeleteConfirm(false)
      setDocumentToDelete(null)
    } catch (error) {
      console.error('删除文档失败:', error)
      alert('删除失败: ' + error.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  const cancelDelete = () => {
    if (deleteLoading) return
    setShowDeleteConfirm(false)
    setDocumentToDelete(null)
  }

  const handleRefreshDocuments = async () => {
    if (leftPanelMode !== 'documents') return undefined
    setDocumentListRetryError(null)
    try {
      setLoadingDocs(true)
      // 刷新时重置到第一页。
      const searchResponse = await searchDocuments({
        kbId: id,
        keyword: searchTerm,
        page: 0,
        size: pageSizeRef.current
      })
      setDocuments(searchResponse.content)
      setCurrentPage(0)
      setHasMore(!searchResponse.last)
      setPagination({
        totalElements: searchResponse.totalElements,
        totalPages: searchResponse.totalPages,
        first: searchResponse.first,
        last: searchResponse.last
      })
      return searchResponse
    } catch (error) {
      console.error('刷新文档列表失败:', error)
      alert('刷新失败: ' + error.message)
      return undefined
    } finally {
      setLoadingDocs(false)
    }
  }

  // 触底加载更多文档。
  const loadMoreDocuments = async () => {
    if (leftPanelMode !== 'documents' || loadingDocs || !hasMore) return

    setLoadingDocs(true)
    try {
      const nextPage = currentPage + 1
      const searchResponse = await searchDocuments({
        kbId: id,
        keyword: searchTerm,
        page: nextPage,
        size: pageSizeRef.current
      })

      // 以追加方式合并新一页文档。
      setDocuments(prev => [...prev, ...searchResponse.content])
      setCurrentPage(nextPage)
      setHasMore(!searchResponse.last)
      setPagination({
        totalElements: searchResponse.totalElements,
        totalPages: searchResponse.totalPages,
        first: searchResponse.first,
        last: searchResponse.last
      })
    } catch (error) {
      console.error('加载更多文档失败:', error)
    } finally {
      setLoadingDocs(false)
    }
  }

  const handleAddDocument = () => {
    setAddDocModalContentReady(false)
    setShowAddDocModal(true)
  }

  const resetAddDocForm = () => {
    setNewDocument({
      name: '',
      description: '',
      fileType: '',
      fileSize: 0,
      enabled: true
    })
    setSelectedFile(null)
  }

  const closeAddDocModal = () => {
    setShowAddDocModal(false)
    setAddDocModalContentReady(false)
    resetAddDocForm()
  }

  const handleCloseModal = () => {
    // 用户在弹窗内主动取消时，终止当前上传。
    documentUploadXhrRef.current?.abort()
    documentUploadXhrRef.current = null
    setDocUploadState(null)
    setActiveUploadFile(null)
    docUploadBusyRef.current = false
    closeAddDocModal()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)

      // 从已选文件自动提取元信息。
      const fileName = file.name
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''

      // 常见扩展名到业务文件类型的映射。
      const typeMap = {
        'pdf': 'pdf',
        'doc': 'doc',
        'docx': 'docx',
        'xls': 'xls',
        'xlsx': 'xlsx',
        'ppt': 'ppt',
        'pptx': 'pptx',
        'txt': 'txt',
        'png': 'image',
        'jpg': 'image',
        'jpeg': 'image',
        'gif': 'image',
        'bmp': 'image',
        'svg': 'image',
        'webp': 'image',
        'mp4': 'video',
        'avi': 'video',
        'mov': 'video',
        'wmv': 'video',
        'flv': 'video',
        'html': 'html',
        'htm': 'html',
        'xml': 'xml',
        'json': 'json',
        'csv': 'csv',
        'md': 'markdown'
      }

      const detectedType = typeMap[fileExtension] || fileExtension

      setNewDocument((prev) => ({
        ...prev,
        name: fileName.split('.')[0], // 默认使用不含扩展名的文件名。
        fileType: detectedType,
        fileSize: file.size
      }))
    }
  }

  const handleChooseFile = () => {
    const input = fileInputRef.current
    if (!input) return

    // 优先使用原生 showPicker；不支持时回退到 click。
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.click()
  }

  const handleSubmitDocument = async (e) => {
    e.preventDefault()

    // 基础文件校验。
    if (!selectedFile) {
      alert('请选择要上传的文件')
      return
    }

    if (selectedFile.size <= 0) {
      alert('文件大小必须大于 0')
      return
    }

    if (docUploadBusyRef.current) return
    const uploadFile = selectedFile
    docUploadBusyRef.current = true
    setDocUploadState({ phase: 'preparing' })
    setActiveUploadFile(uploadFile)
    closeAddDocModal()

    try {
      await createDocument(
        {
          file: uploadFile,
          kbId: String(id),
          title: uploadFile.name || newDocument.name,
          description: newDocument.description || undefined
        },
        {
          onProgress: (evt) => setDocUploadState(evt),
          onXhrReady: (xhr) => {
            documentUploadXhrRef.current = xhr
          }
        }
      )
      if (leftPanelModeRef.current === 'documents') {
        const searchResponse = await searchDocuments({
          kbId: id,
          keyword: searchTerm,
          page: 0,
          size: pageSizeRef.current
        })
        setDocuments(searchResponse.content || [])
        setCurrentPage(0)
        setHasMore(!searchResponse.last)
        setPagination({
          totalElements: searchResponse.totalElements,
          totalPages: searchResponse.totalPages,
          first: searchResponse.first,
          last: searchResponse.last
        })
      }
      documentUploadXhrRef.current = null
      setDocUploadState(null)
      setActiveUploadFile(null)
    } catch (error) {
      documentUploadXhrRef.current = null
      setDocUploadState(null)
      setActiveUploadFile(null)
      if (error.message !== '上传已取消') {
        alert('创建失败: ' + error.message)
      }
    } finally {
      docUploadBusyRef.current = false
    }
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < pagination.totalPages) {
      setCurrentPage(newPage)
    }
  }

  // 获取文件扩展名。
  const getFileExtension = (filename) => {
    if (!filename) return ''
    const parts = filename.split('.')
    return parts.length > 1 ? parts.pop().toLowerCase() : ''
  }

  const getFileTypeLabel = (filename) => {
    const ext = getFileExtension(filename)
    if (!ext) return 'FILE'
    if (ext.length <= 5) return ext.toUpperCase()
    return 'FILE'
  }

  // 按扩展名渲染文件图标。
  const getFileIconByExt = (filename) => {
    const ext = getFileExtension(filename)
    switch (ext) {
      case 'pdf':
        return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#f5222d', color: 'white', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>PDF</span>
      case 'doc':
      case 'docx':
        return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary)', color: 'white', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>DOC</span>
      case 'xls':
      case 'xlsx':
        return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary)', color: 'white', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>XLS</span>
      case 'ppt':
      case 'pptx':
        return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fa8c16', color: 'white', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>PPT</span>
      case 'txt':
        return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#8c8c8c', color: 'white', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>TXT</span>
      default:
        return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#d9d9d9', color: '#666', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>FILE</span>
    }
  }

  if (loading) {
    return (
      <div className="knowledge-detail-page">
        <div className="loading">加载中...</div>
      </div>
    )
  }

  return (
    <div className="knowledge-detail-page">
      <div className="page-header">
        <h1>{knowledgeBase?.name || '知识库详情'}</h1>
      </div>

      <div className="detail-content">
        {/* 左侧文档列表面板：仅在文档模式下显示。 */}
        {leftPanelMode === 'documents' && (
        <div className="document-list-panel">
          <div className="panel-header">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                placeholder="搜索文档..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleRefreshDocuments()
                  }
                }}
                className="doc-search-input"
              />
              <button
                className="refresh-doc-btn"
                onClick={handleRefreshDocuments}
                disabled={loadingDocs}
                aria-label="刷新文档列表"
                title="刷新文档列表"
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: loadingDocs ? '#d9d9d9' : '#f0f2f5',
                  color: loadingDocs ? '#999' : '#666',
                  cursor: loadingDocs ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  minWidth: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span aria-hidden="true">{loadingDocs ? '↻' : '⟳'}</span>
              </button>
              <button className="add-doc-btn" onClick={handleAddDocument} title="添加文档">+</button>
            </div>
          </div>

          {documentListRetryError && (
            <div className="document-list-retry-error" role="alert">
              {documentListRetryError}
            </div>
          )}

          <div
            className="document-grid"
            ref={documentListRef}
            onScroll={() => {
              if (!documentListRef.current || loadingDocs || !hasMore) return

              const { scrollTop, scrollHeight, clientHeight } = documentListRef.current

              // 距离底部小于 50px 时触发加载更多。
              if (scrollHeight - scrollTop - clientHeight < 50) {
                loadMoreDocuments()
              }
            }}
          >
            {(documents && documents.length > 0) || (docUploadState != null && activeUploadFile) ? (
              <>
                {docUploadState != null && activeUploadFile && (
                  <div
                    className="document-card document-card--upload-active document-card--status-progress"
                    aria-live="polite"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="document-card__row">
                      <div className="document-card__main">
                        <div className="doc-thumb" aria-hidden="true">
                          {getFileIconByExt(activeUploadFile.name)}
                        </div>
                        <div className="doc-info doc-info--list">
                          <h3
                            className="doc-title doc-title--list"
                            title={activeUploadFile.name}
                          >
                            {activeUploadFile.name}
                          </h3>
                          <p className="document-card__upload-caption">本地上传进度</p>
                        </div>
                      </div>
                      <div className="document-card__aside">
                        <span className="doc-status-line doc-status-line--progress">
                          <span className="doc-status-dot doc-status-dot--progress" aria-hidden="true" />
                          <span className="doc-status-line-text">处理中</span>
                        </span>
                      </div>
                    </div>
                    <div className="document-card__progress">
                      <div className="doc-upload-bar-track doc-card-progress-track">
                        <div
                          className="doc-upload-bar-fill"
                          style={{ width: `${getDocUploadBarPercent(docUploadState)}%` }}
                        />
                      </div>
                      <p className="doc-card-progress-hint">{getDocUploadProgressHint(docUploadState)}</p>
                    </div>
                  </div>
                )}
                {documents.map((doc) => {
                const statusMeta = getDocStatusMeta(getDocumentListStatusRaw(doc))
                const titleTip = statusMeta.rawForTitle
                  ? `服务端状态：${statusMeta.rawForTitle}`
                  : undefined
                const showDocRetry = isDocumentEmbeddingStatus(doc)
                const docRetrying = documentVectorRetryingId === doc.id
                const showPipelineProgress = statusMeta.variant === 'progress'
                const rawDocName = doc.title || doc.name || ''
                const displayDocName = getDisplayDocTitle(rawDocName)
                const fileTypeLabel = getFileTypeLabel(rawDocName)
                if (!showPipelineProgress && doc.id) {
                  delete docPipelineBarPeakRef.current[doc.id]
                }
                const pipelineHint = showPipelineProgress ? getDocumentPipelineStageHint(doc) : null
                return (
                <div
                  key={doc.id}
                  className={[
                    'document-card',
                    `document-card--status-${statusMeta.variant}`,
                    selectedDocument && selectedDocument.id === doc.id ? 'selected' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleDocumentSelect(doc)}
                >
                  <div className="document-card__row">
                    <div className="document-card__main">
                      <div className="doc-info doc-info--list">
                        <div className="doc-title-line">
                          <h3
                            className="doc-title doc-title--list"
                            title={rawDocName.trim() || undefined}
                          >
                            {displayDocName}
                          </h3>
                          <span className="doc-type-chip" title={`文件类型：${fileTypeLabel}`}>
                            {fileTypeLabel}
                          </span>
                          <span
                            className={`doc-status-chip doc-status-chip--${statusMeta.variant}`}
                            title={titleTip}
                          >
                            {statusMeta.label}
                          </span>
                          <button
                            className="delete-doc-btn delete-doc-btn--inline"
                            onClick={(e) => handleDeleteDocument(doc.id, e)}
                            title="删除文档"
                          >
                            ×
                          </button>
                        </div>
                        {(doc.createdTime || showDocRetry) && (
                          <div className="doc-meta-line">
                            {doc.createdTime && (
                              <time className="doc-date doc-date--list" dateTime={doc.createdTime}>
                                {formatDocumentListTime(doc.createdTime)}
                              </time>
                            )}
                            {showDocRetry && (
                              <button
                                type="button"
                                className="doc-retry-process-btn doc-retry-process-btn--inline"
                                disabled={docRetrying}
                                title="续跑当前文档处理"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDocumentVectorRetry(doc)
                                }}
                              >
                                {docRetrying ? '处理中' : '重新处理'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {showPipelineProgress && (
                    <div className="document-card__progress" onClick={(e) => e.stopPropagation()}>
                      <div className="doc-upload-bar-track doc-card-progress-track">
                        <div
                          className="doc-upload-bar-fill"
                          style={{ width: `${getDocumentPipelineBarPercentStable(doc)}%` }}
                        />
                      </div>
                      {pipelineHint && (
                        <p className="doc-card-progress-hint">当前步骤：{pipelineHint}</p>
                      )}
                    </div>
                  )}
                </div>
                )
              })}
              </>
            ) : (
              <div className="empty-docs">
                <p>暂无文档</p>
              </div>
            )}
          </div>

          {/* 列表分页加载中提示。 */}
          {loadingDocs && documents.length > 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              加载中...
            </div>
          )}

          {/* 无更多数据提示。 */}
          {!hasMore && documents.length > 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#ccc', fontSize: '12px' }}>
              没有更多数据            </div>
          )}
        </div>
        )}

        <div
          className={
            leftPanelMode === 'chunks'
              ? 'detail-preview-chunks-row'
              : 'detail-preview-chunks-row detail-preview-chunks-row--solo'
          }
        >
          <div
            className={[
              'preview-panel',
              leftPanelMode === 'chunks' ? 'preview-panel--half' : 'preview-panel--solo'
            ].join(' ')}
          >
          <div className="preview-header preview-header--with-actions">
            <h2>文档预览</h2>
            <div className="preview-header-right">
              {selectedDocument && leftPanelMode === 'documents' && (
                <button
                  type="button"
                  className="preview-view-chunks-btn"
                  onClick={() => setLeftPanelMode('chunks')}
                  title="查看当前文档切片"
                >
                  查看切片
                </button>
              )}
              {selectedDocument && (
                <span className="preview-doc-title">{selectedDocument.title}</span>
              )}
            </div>
          </div>

          {/* 按页图片预览区域。 */}
          {selectedDocument && (
            <>
            <div className="page-preview-toolbar" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 24px',
              borderBottom: '1px solid #eee',
              background: '#fafafa',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(1, previewPage - 1)
                  scrollContainerRef.current && (scrollContainerRef.current.scrollTop = (next - 1) * previewSlotHeight)
                }}
                disabled={previewPage <= 1}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  background: '#fff',
                  cursor: previewPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  color: previewPage <= 1 ? '#999' : '#333'
                }}
              >
                上一页              </button>
              <button
                type="button"
                onClick={() => {
                  const next = Math.min(totalPreviewPages || 1, previewPage + 1)
                  scrollContainerRef.current && (scrollContainerRef.current.scrollTop = (next - 1) * previewSlotHeight)
                }}
                disabled={previewPage >= (totalPreviewPages || 1)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  background: '#fff',
                  cursor: previewPage >= (totalPreviewPages || 1) ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  color: previewPage >= (totalPreviewPages || 1) ? '#999' : '#333'
                }}
              >
                下一页              </button>
              <span style={{ fontSize: '13px', color: '#666' }}>
                第<strong>{previewPage}</strong>页 / 共<strong>{totalPreviewPages || '-'}</strong>页              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  min={1}
                  max={totalPreviewPages || 1}
                  value={jumpPageInput}
                  onChange={(e) => setJumpPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const v = parseInt(String(jumpPageInput).trim(), 10)
                      if (!Number.isNaN(v) && scrollContainerRef.current) {
                        const page = Math.max(1, Math.min(totalPreviewPages || 1, v))
                        scrollContainerRef.current.scrollTop = (page - 1) * previewSlotHeight
                      }
                    }
                  }}
                  style={{
                    width: '56px',
                    padding: '6px 8px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    fontSize: '13px',
                    textAlign: 'center'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = parseInt(String(jumpPageInput).trim(), 10)
                    if (!Number.isNaN(v) && scrollContainerRef.current) {
                      const page = Math.max(1, Math.min(totalPreviewPages || 1, v))
                      scrollContainerRef.current.scrollTop = (page - 1) * previewSlotHeight
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  跳转
                </button>
              </div>
              <span
                aria-hidden="true"
                style={{ width: '1px', height: '20px', background: '#e8e8e8', margin: '0 4px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  title="缩小"
                  onClick={() => adjustPreviewZoomBy(-PREVIEW_ZOOM_STEP)}
                  disabled={previewZoom <= PREVIEW_ZOOM_MIN}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    background: '#fff',
                    cursor: previewZoom <= PREVIEW_ZOOM_MIN ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    lineHeight: 1,
                    color: previewZoom <= PREVIEW_ZOOM_MIN ? '#999' : '#333'
                  }}
                >
                  -                </button>
                <span style={{ fontSize: '13px', color: '#666', minWidth: '44px', textAlign: 'center' }}>
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  type="button"
                  title="放大"
                  onClick={() => adjustPreviewZoomBy(PREVIEW_ZOOM_STEP)}
                  disabled={previewZoom >= PREVIEW_ZOOM_MAX}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    background: '#fff',
                    cursor: previewZoom >= PREVIEW_ZOOM_MAX ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    lineHeight: 1,
                    color: previewZoom >= PREVIEW_ZOOM_MAX ? '#999' : '#333'
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div className="preview-split preview-split--full">
              <div className="preview-pages-wrap">
                <div
                  ref={scrollContainerRef}
                  className="page-preview-content page-preview-content--scroll"
                >
                  {totalPreviewPages < 1 ? (
                    <div style={{ padding: '40px', color: '#999', textAlign: 'center' }}>加载页数中...</div>
                  ) : (
                    <div style={{ minHeight: totalPreviewPages * previewSlotHeight, padding: '16px 24px' }}>
                      {Array.from({ length: totalPreviewPages }, (_, i) => i + 1).map((pageNum) => (
                        <div
                          key={pageNum}
                          data-page={pageNum}
                          style={{
                            minHeight: previewSlotHeight,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                            padding: '8px 0'
                          }}
                        >
                          {pageImages[pageNum] ? (
                            <img
                              src={pageImages[pageNum]}
                              alt={`第${pageNum}页`}
                              style={{
                                width: `${previewZoom * 100}%`,
                                maxWidth: previewZoom > 1 ? 'none' : '100%',
                                height: 'auto',
                                display: 'block',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
                              }}
                            />
                          ) : loadingPages[pageNum] ? (
                            <span style={{ color: '#999', fontSize: '14px' }}>加载中...</span>
                          ) : (
                            <span style={{ color: '#ddd', fontSize: '13px' }}>第{pageNum}页</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </>
          )}

          {!selectedDocument && (
            <div
              className="preview-content preview-empty"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 280px)', padding: '24px' }}
            >
              <p style={{ color: '#999', fontSize: '14px' }}>请选择一个文档查看</p>
            </div>
          )}
          </div>

          {leftPanelMode === 'chunks' && (
            <div className="chunks-panel">
              <div className="chunks-panel-header chunks-panel-header--minimal">
                <button
                  type="button"
                  className="chunks-panel-back"
                  onClick={() => setLeftPanelMode('documents')}
                  title="退出切片视图并展开文档列表"
                >
                  返回
                </button>
              </div>
              <div className="chunks-panel-body">
                {!selectedDocument && (
                    <p className="preview-chunk-empty">请先在文档列表中选择一篇文档</p>
                )}
                {selectedDocument && chunksFetchError && (
                  <div className="preview-chunk-error" role="alert">
                    {chunksFetchError}
                  </div>
                )}
                {selectedDocument && chunkActiveActionError && (
                  <div className="preview-chunk-error" role="alert">
                    {chunkActiveActionError}
                  </div>
                )}
                {selectedDocument && chunksLoading && (
                  <p className="preview-chunk-empty">加载第{previewPage}页分块中...</p>
                )}
                {selectedDocument &&
                  !chunksLoading &&
                  !chunksFetchError &&
                  documentChunks.length === 0 && (
                    <p className="preview-chunk-empty">当前预览页暂无分块</p>
                  )}
                <div className="chunks-panel-list">
                  {documentChunks.map((chunk) => {
                    const chunkId = chunk.id
                    const isActive = chunk.active !== false
                    const saving = chunkId && chunkActiveSavingId === chunkId
                    const idxRaw = chunk.chunkIndex ?? chunk.index
                    const chunkIndexLabel =
                      idxRaw != null && idxRaw !== '' && Number.isFinite(Number(idxRaw))
                        ? `#${Number(idxRaw)}`
                        : '无编号'
                    const contentTypeRaw = chunk.contentType ?? chunk.content_type ?? ''
                    const contentTypeLabel = getChunkContentTypeLabel(contentTypeRaw)
                    const refPathRaw = chunk.refPath ?? chunk.ref_path ?? ''
                    const refPathSegments = getChunkRefPathSegments(refPathRaw)
                    const refPathLabel = refPathSegments.join(' > ')
                    const intentTypeRaw = chunk.intentType ?? chunk.intent_type ?? ''
                    const intentTypeLabel = getChunkIntentTypeLabel(intentTypeRaw)
                    const byteLen = getChunkByteLength(chunk)
                    const byteLabel = formatUploadBytes(byteLen) || '0 B'
                    return (
                    <div
                      key={`${previewPage}-${chunkId ?? `idx-${chunk.chunkIndex}`}`}
                      className={[
                        'chunk-md-card',
                        isActive ? '' : 'chunk-md-card--inactive'
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="chunk-md-card__toolbar">
                        <div className="chunk-md-card__meta">
                          <span className="chunk-md-card__meta-item" title="分块编号（chunkIndex）">
                            分块 {chunkIndexLabel}
                          </span>
                          <span className="chunk-md-card__meta-sep" aria-hidden="true">
                            ·
                          </span>
                          <span className="chunk-md-card__meta-item" title="正文 UTF-8 字节">
                            {byteLabel}
                          </span>
                          {contentTypeLabel && (
                            <>
                              <span className="chunk-md-card__meta-sep" aria-hidden="true">
                                ·
                              </span>
                              <span
                                className="chunk-md-card__type-badge"
                                title={`类型：${contentTypeLabel} (${String(contentTypeRaw).trim()})`}
                              >
                                {contentTypeLabel}
                              </span>
                            </>
                          )}
                          {intentTypeLabel && (
                            <>
                              <span className="chunk-md-card__meta-sep" aria-hidden="true">
                                ·
                              </span>
                              <span
                                className="chunk-md-card__intent-badge"
                                title={`意图：${intentTypeLabel} (${String(intentTypeRaw).trim()})`}
                              >
                                {intentTypeLabel}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="chunk-md-card__actions">
                          {!chunkId ? (
                            <span className="chunk-active-hint">无分块ID</span>
                          ) : isActive ? (
                            <button
                              type="button"
                              className="chunk-active-btn chunk-active-btn--off"
                              disabled={saving}
                              onClick={() => handleChunkActiveToggle(chunk, false)}
                            >
                              {saving ? '处理中' : '停用'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="chunk-active-btn chunk-active-btn--on"
                              disabled={saving}
                              onClick={() => handleChunkActiveToggle(chunk, true)}
                            >
                              {saving ? '处理中' : '启用'}
                            </button>
                          )}
                          <span className="chunk-active-desc">
                            {isActive
                              ? '当前片段作为知识库片段'
                              : '当前片段不作为知识库片段'}
                          </span>
                        </div>
                      </div>
                      {refPathLabel && (
                        <div className="chunk-md-card__ref-row" title={`来源路径：${refPathLabel}`}>
                          <span className="chunk-md-card__ref-label">来源</span>
                          <span className="chunk-md-card__ref-breadcrumb">
                            {refPathSegments.map((segment, index) => (
                              <span key={`${segment}-${index}`} className="chunk-md-card__ref-part">
                                {index > 0 && (
                                  <span className="chunk-md-card__ref-sep" aria-hidden="true">
                                    /
                                  </span>
                                )}
                                <span className="chunk-md-card__ref-text">{segment}</span>
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                      <div
                        className="markdown-preview chunk-markdown"
                        style={{ '--chunk-img-zoom': previewZoom }}
                      >
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          urlTransform={markdownUrlTransformAllowData}
                          components={{
                            img: ({ src, alt, ...rest }) => {
                              const fixed = resolveMarkdownAssetUrl(src)
                              if (!fixed) return null
                              const { node: _mdNode, children: _mdCh, ...domProps } = rest
                              return <img {...domProps} src={fixed} alt={alt ?? ''} />
                            }
                          }}
                        >
                          {normalizeMarkdownDataImages(chunk.content ?? '')}
                        </Markdown>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 添加文档弹窗：先渲染轻量外壳，再延迟一帧渲染表单。 */}
      {showAddDocModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>添加文档</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            {!addDocModalContentReady ? (
              <div className="modal-form" style={{ padding: '24px', minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                加载中...              </div>
            ) : (
            <form onSubmit={handleSubmitDocument} className="modal-form">
              <div className="form-group">
                <label>选择文件 *</label>
                <div className="file-upload-wrapper">
                  <input
                    type="file"
                    id="file-upload"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    disabled={docUploadState != null}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.svg,.webp,.mp4,.avi,.mov,.wmv,.flv,.html,.xml,.json,.csv,.md,*/*"
                    className="file-input"
                  />
                  <button type="button" className="file-upload-btn" onClick={handleChooseFile} disabled={docUploadState != null}>
                    📁 选择文件
                  </button>
                  {selectedFile && (
                    <div className="file-info">
                      <span className="file-name">{selectedFile.name}</span>
                      <span className="file-size">({(selectedFile.size / 1024).toFixed(2)} KB)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>文档名称 *</label>
                <input
                  type="text"
                  value={newDocument.name}
                  onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                  placeholder="请输入文档名称（上传文件后自动填充）"
                  required
                  disabled={docUploadState != null}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>描述</label>
                <textarea
                  value={newDocument.description}
                  onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                  placeholder="请输入文档描述"
                  rows={3}
                  disabled={docUploadState != null}
                  className="form-textarea"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>文件类型</label>
                  <input
                    type="text"
                    value={newDocument.fileType}
                    onChange={(e) => setNewDocument({ ...newDocument, fileType: e.target.value })}
                    placeholder="上传文件后自动识别"
                    readOnly
                    disabled={docUploadState != null}
                    className="form-input read-only"
                  />
                </div>

                <div className="form-group">
                  <label>文件大小 (字节)</label>
                  <input
                    type="number"
                    value={newDocument.fileSize}
                    onChange={(e) => setNewDocument({ ...newDocument, fileSize: e.target.value })}
                      placeholder="上传文件后自动填写"
                    readOnly
                    disabled={docUploadState != null}
                    className="form-input read-only"
                  />
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newDocument.enabled}
                    onChange={(e) => setNewDocument({ ...newDocument, enabled: e.target.checked })}
                    disabled={docUploadState != null}
                  />
                  <span>启用该文档</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={handleCloseModal}>
                  {docUploadState != null ? '取消上传' : '取消'}
                </button>
                <button type="submit" className="submit-btn" disabled={docUploadState != null}>
                  {docUploadState != null ? '上传中' : '保存'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* 删除确认弹窗。 */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={deleteLoading ? undefined : cancelDelete}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-header">
              <h3>⚠️ 确认删除</h3>
            </div>
            <div className="confirm-body">
              <p>确定要删除这个文档吗？</p>
              <p className="confirm-tip">此操作不可恢复，请谨慎操作</p>
            </div>
            <div className="confirm-footer">
              <button className="cancel-btn" onClick={cancelDelete} disabled={deleteLoading}>
                取消
              </button>
              <button className="delete-confirm-btn" onClick={confirmDelete} disabled={deleteLoading}>
                {deleteLoading ? '删除中' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeDetail
