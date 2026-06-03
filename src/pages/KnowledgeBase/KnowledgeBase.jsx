import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchKnowledgeBases, deleteKnowledgeBase } from '../../api/knowledge'
import './KnowledgeBase.css'

function IconKb() {
  return (
    <svg className="kb-card-icon-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 7h8M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function IconDetail() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function KnowledgeBase() {
  const navigate = useNavigate()
  const [knowledgeBases, setKnowledgeBases] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const knowledgeListRef = useRef(null)

  const pageSizeRef = useRef(10)

  const loadKnowledgeBases = async (page, keyword) => {
    if (loadingMore || (!hasMore && page > 0)) return

    setLoadingMore(true)
    try {
      const response = await searchKnowledgeBases({
        description: keyword,
        page: page,
        size: pageSizeRef.current
      })

      const content = response.content || []

      const formatted = content.map((kb) => ({
        id: kb.id,
        name: kb.name || '未命名知识库',
        description: kb.description || '暂无描述',
        itemCount: 0,
        createdAt: kb.createdTime ? new Date(kb.createdTime).toLocaleDateString() : '',
        enabled: kb.enabled,
        uri: kb.uri
      }))

      setKnowledgeBases((prev) => (page === 0 ? formatted : [...prev, ...formatted]))
      setCurrentPage(page)
      setHasMore(!response.last)
    } catch (error) {
      console.error('获取知识库数据失败:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setKnowledgeBases([])
    setCurrentPage(0)
    setHasMore(true)
    setLoading(true)
    loadKnowledgeBases(0, searchTerm).finally(() => {
      setLoading(false)
    })
  }, [searchTerm])

  const handleScroll = () => {
    if (!knowledgeListRef.current || loadingMore || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = knowledgeListRef.current

    if (scrollHeight - scrollTop - clientHeight < 50) {
      loadKnowledgeBases(currentPage + 1)
    }
  }

  const handleDelete = async (id, name) => {
    if (window.confirm(`确定要删除知识库 "${name}" 吗？`)) {
      try {
        await deleteKnowledgeBase(id)
        setKnowledgeBases([])
        setCurrentPage(0)
        setHasMore(true)
        await loadKnowledgeBases(0, searchTerm)
      } catch (error) {
        console.error('删除知识库失败:', error)
        alert('删除失败')
      }
    }
  }

  const handleViewDetails = (id) => {
    navigate(`/knowledge/${id}`)
  }

  const handleEdit = (id) => {
    navigate(`/knowledge/edit/${id}`)
  }

  const handleCreate = () => {
    navigate('/knowledge/add')
  }

  if (loading) {
    return (
      <div className="knowledge-base-page">
        <div className="knowledge-base-header">
          <h1>知识库中心</h1>
          <p>管理和查看您的知识库资源</p>
        </div>
        <div className="loading">加载中...</div>
      </div>
    )
  }

  return (
    <div className="knowledge-base-page">
      <div className="knowledge-base-header">
        <h1>知识库中心</h1>
        <p>管理和查看您的知识库资源</p>
        <div className="header-actions">
          <input
            type="search"
            placeholder="搜索…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            aria-label="搜索知识库"
          />
          <button type="button" className="create-btn-icon" onClick={handleCreate} title="新建知识库" aria-label="新建知识库">
            <IconPlus />
          </button>
        </div>
      </div>

      {knowledgeBases.length === 0 && !loading ? (
        <div className="empty-state">{searchTerm ? '没有找到匹配的知识库' : '暂无知识库'}</div>
      ) : (
        <>
          <div
            className="knowledge-grid"
            ref={knowledgeListRef}
            onScroll={handleScroll}
            style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}
          >
            {knowledgeBases.map((kb) => (
              <div key={kb.id} className="knowledge-card">
                <div className="knowledge-card-header">
                  <div className="knowledge-icon" aria-hidden>
                    <IconKb />
                  </div>
                  <div className="knowledge-info">
                    <h3>{kb.name}</h3>
                    <p>{kb.description}</p>
                  </div>
                </div>
                {kb.createdAt && (
                  <div className="knowledge-meta">
                    <span className="created-at">创建于 {kb.createdAt}</span>
                  </div>
                )}
                <div className="knowledge-card-footer">
                  <button
                    type="button"
                    className="kb-card-action kb-card-action--primary"
                    onClick={() => handleViewDetails(kb.id)}
                    title="查看详情"
                    aria-label="查看详情"
                  >
                    <IconDetail />
                  </button>
                  <button
                    type="button"
                    className="kb-card-action kb-card-action--outline"
                    onClick={() => handleEdit(kb.id)}
                    title="编辑"
                    aria-label="编辑"
                  >
                    <IconPencil />
                  </button>
                  <button
                    type="button"
                    className="kb-card-action kb-card-action--danger"
                    onClick={() => handleDelete(kb.id, kb.name)}
                    title="删除"
                    aria-label="删除"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {loadingMore && (
            <div className="knowledge-list-hint knowledge-list-hint--loading">加载中…</div>
          )}

          {!hasMore && knowledgeBases.length > 0 && (
            <div className="knowledge-list-hint">没有更多了</div>
          )}
        </>
      )}
    </div>
  )
}

export default KnowledgeBase
