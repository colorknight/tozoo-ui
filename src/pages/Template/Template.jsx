import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchTemplates, createTemplate } from '../../api/templates'
import './Template.css'

const colors = ['#6366f1', '#4f46e5', '#818cf8', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']
const icons = ['📄', '📋', '📑', '✨', '🔤', '📝', '📃', '🗂️']

const PAGE_SIZE = 20

function Template() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [viewingId, setViewingId] = useState(null)
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [editingMeta, setEditingMeta] = useState({ id: null, field: null, value: '' })

  const fetchList = useCallback(async (keyword, pageNum = 0) => {
    setLoading(true)
    setError(null)
    try {
      const data = await searchTemplates({
        keyword: keyword || '',
        page: pageNum,
        size: PAGE_SIZE
      })
      setTemplates(Array.isArray(data) ? data : (data?.content ?? []))
    } catch (e) {
      setError(e?.message || '加载模板列表失败')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList(searchTerm, page)
  }, [searchTerm, page, fetchList])

  const filteredTemplates = templates

  const handleDelete = (id, name) => {
    if (!window.confirm(`确定要删除模板「${name || '未命名'}」吗？`)) return
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    if (viewingId === id) setViewingId(null)
  }

  const viewTemplate = (t) => setViewingId(viewingId === t.id ? null : t.id)
  const viewed = templates.find((t) => t.id === viewingId)

  const startEditMeta = (t, field) => {
    setEditingMeta({ id: t.id, field, value: field === 'name' ? (t.name || '') : (t.description || '') })
  }

  const saveEditMeta = () => {
    if (!editingMeta.id || !editingMeta.field) return
    const next = templates.map((t) =>
      t.id === editingMeta.id
        ? { ...t, [editingMeta.field]: editingMeta.value.trim() }
        : t
    )
    setTemplates(next)
    setEditingMeta({ id: null, field: null, value: '' })
  }

  const cancelEditMeta = () => setEditingMeta({ id: null, field: null, value: '' })

  const handleSearchChange = (value) => {
    setSearchTerm(value)
    setPage(0)
  }

  const handleConfirmNew = async () => {
    const name = (newName || '').trim()
    if (!name) {
      alert('请输入模板名称')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const payload = {
        name,
        description: (newDesc || '').trim(),
        format: 'MARKDOWN',
        content: '',
        variables: [],
        enabled: true
      }
      const created = await createTemplate(payload)
      setNewModalOpen(false)
      setNewName('')
      setNewDesc('')
      setTemplates((prev) => [created, ...prev])
      navigate(`/template/edit/${created.id}`, { state: { template: created } })
    } catch (e) {
      setCreateError(e?.message || '创建模板失败')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="template-page">
        <div className="template-header">
          <h1>模板管理</h1>
          <p>管理大模型输出格式模板，统一展示与解析</p>
        </div>
        <div className="template-loading">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="template-page">
        <div className="template-header">
          <h1>模板管理</h1>
          <p>管理大模型输出格式模板，统一展示与解析</p>
        </div>
        <div className="template-empty">{error}</div>
      </div>
    )
  }

  return (
    <div className="template-page">
      <div className="template-header">
        <h1>模板管理</h1>
        <p>管理大模型输出格式模板，统一展示与解析</p>
        <div className="template-header-actions">
          <input
            type="text"
            placeholder="搜索模板..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="template-search-input"
          />
          <button className="template-add-btn" onClick={() => setNewModalOpen(true)}>
            + 新建模板
          </button>
        </div>
      </div>

      {/* 新建模板弹窗：填名称、描述后确认跳转编辑页 */}
      {newModalOpen && (
        <div className="template-form-overlay" onClick={() => { setNewModalOpen(false); setCreateError(null) }}>
          <div className="template-new-modal" onClick={(e) => e.stopPropagation()}>
            <h3>新建模板</h3>
            <p className="template-new-modal-hint">填写名称与描述，确认后进入编辑页面编写模板内容与变量。</p>
            {createError && <p className="template-form-error">{createError}</p>}
            <div className="template-new-modal-field">
              <label>模板名称 *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="必填"
                autoFocus
                disabled={creating}
              />
            </div>
            <div className="template-new-modal-field">
              <label>描述</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="选填"
                disabled={creating}
              />
            </div>
            <div className="template-form-actions">
              <button type="button" className="template-btn secondary" onClick={() => setNewModalOpen(false)} disabled={creating}>
                取消
              </button>
              <button type="button" className="template-btn primary" onClick={handleConfirmNew} disabled={creating}>
                {creating ? '创建中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 查看详情浮层 */}
      {viewed && (
        <div className="template-form-overlay" onClick={() => setViewingId(null)}>
          <div className="template-view-card" onClick={(e) => e.stopPropagation()}>
            <h2>{viewed.name}</h2>
            {viewed.description && <p className="template-view-desc">{viewed.description}</p>}
            <div className="template-view-meta">
              {viewed.format && <span className="template-format-badge">{viewed.format === 'MARKDOWN' ? 'Markdown' : '文本'}</span>}
              {Array.isArray(viewed.variables) && viewed.variables.length > 0 && (
                <span className="template-var-count">变量：{viewed.variables.map((v) => v.variableKey).join(', ')}</span>
              )}
            </div>
            <div className="template-view-content">
              <pre>{viewed.content || '（无内容）'}</pre>
            </div>
            <div className="template-form-actions">
              <button className="template-btn secondary" onClick={() => setViewingId(null)}>
                关闭
              </button>
              <button className="template-btn primary" onClick={() => { setViewingId(null); navigate(`/template/edit/${viewed.id}`, { state: { template: viewed } }); }}>
                编辑
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredTemplates.length === 0 ? (
        <div className="template-empty">
          {searchTerm ? '没有找到匹配的模板' : '暂无模板，点击「新建模板」添加'}
        </div>
      ) : (
        <div className="template-grid">
          {filteredTemplates.map((t, index) => (
            <div key={t.id} className="template-card">
              <div className="template-card-header">
                <div
                  className="template-icon"
                  style={{ backgroundColor: `${colors[index % colors.length]}20`, color: colors[index % colors.length] }}
                >
                  {icons[index % icons.length]}
                </div>
                <div className="template-info">
                  {editingMeta.id === t.id && editingMeta.field === 'name' ? (
                    <input
                      className="template-card-inline-input template-card-inline-name"
                      value={editingMeta.value}
                      onChange={(e) => setEditingMeta((m) => ({ ...m, value: e.target.value }))}
                      onBlur={saveEditMeta}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditMeta(); if (e.key === 'Escape') cancelEditMeta() }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <h3 className="template-card-editable" onClick={(e) => { e.stopPropagation(); startEditMeta(t, 'name') }} title="点击修改名称">
                      {t.name || '未命名'}
                    </h3>
                  )}
                  {editingMeta.id === t.id && editingMeta.field === 'description' ? (
                    <input
                      className="template-card-inline-input template-card-inline-desc"
                      value={editingMeta.value}
                      onChange={(e) => setEditingMeta((m) => ({ ...m, value: e.target.value }))}
                      onBlur={saveEditMeta}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditMeta(); if (e.key === 'Escape') cancelEditMeta() }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <p className="template-card-editable template-card-desc" onClick={(e) => { e.stopPropagation(); startEditMeta(t, 'description') }} title="点击修改描述">
                      {t.description || '暂无描述'}
                    </p>
                  )}
                  <div className="template-card-meta-inline">
                    {t.format && <span className="template-format-badge">{t.format === 'MARKDOWN' ? 'Markdown' : '文本'}</span>}
                    {Array.isArray(t.variables) && t.variables.length > 0 && (
                      <span className="template-var-count">{t.variables.length} 个变量</span>
                    )}
                  </div>
                </div>
              </div>
              {t.content && (
                <div className="template-preview">
                  <pre>{t.content.slice(0, 120)}{t.content.length > 120 ? '...' : ''}</pre>
                </div>
              )}
              <div className="template-meta">
                {(t.createdTime || t.createdAt) && (
                  <span className="template-created">
                    创建于 {new Date(t.createdTime || t.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="template-card-footer">
                <button className="template-view-btn" onClick={() => viewTemplate(t)}>
                  查看输出
                </button>
                <div className="template-actions">
                  <button className="action-btn edit" onClick={() => navigate(`/template/edit/${t.id}`, { state: { template: t } })} title="编辑">
                    编辑
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(t.id, t.name)} title="删除">
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Template
