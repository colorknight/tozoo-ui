import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createKnowledgeBase, getKnowledgeBaseById, updateKnowledgeBase } from '../../api/knowledge'
import './KnowledgeForm.css'

function KnowledgeForm() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEdit = Boolean(editId)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true
  })
  const [initialKb, setInitialKb] = useState(null)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!editId) {
      setInitialKb(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getKnowledgeBaseById(editId)
      .then((data) => {
        if (cancelled) return
        setInitialKb(data)
        setFormData({
          name: data?.name ?? '',
          description: data?.description ?? '',
          enabled: data?.enabled !== false
        })
      })
      .catch((e) => {
        if (!cancelled) {
          alert('加载知识库失败：' + (e?.message || '未知错误'))
          navigate('/knowledge')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      if (isEdit) {
        const payload = {
          ...initialKb,
          id: initialKb?.id ?? editId,
          name: formData.name,
          description: formData.description,
          enabled: formData.enabled
        }
        await updateKnowledgeBase(editId, payload)
      } else {
        const payload = {
          name: formData.name,
          description: formData.description,
          alias: null,
          enabled: formData.enabled,
          tags: null,
          uri: null,
          jsonProperties: null,
          ordinal: 0,
          resourceSpace: null
        }
        await createKnowledgeBase(payload)
      }
      navigate('/knowledge')
    } catch (error) {
      alert((isEdit ? '保存失败：' : '创建失败：') + error.message)
    }
  }

  if (loading) {
    return (
      <div className="knowledge-form-page">
        <div className="knowledge-form-layout">
          <div className="knowledge-form-container">
            <div className="knowledge-form-loading">加载中…</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="knowledge-form-page">
      <div className="knowledge-form-layout">
        <div className="knowledge-form-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#333' }}>{isEdit ? '编辑知识库' : '新增知识库'}</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="knowledge-form-group">
              <label>名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入知识库名称"
                required
                className="form-input"
              />
            </div>

            <div className="knowledge-form-group">
              <label>描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="请输入知识库描述"
                rows={4}
                className="form-textarea"
              />
            </div>

            <div className="knowledge-form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                <span>启用该知识库</span>
              </label>
            </div>

            <div className="knowledge-form-actions">
              <button type="button" className="cancel-btn" onClick={() => navigate('/knowledge')}>
                取消
              </button>
              <button type="submit" className="submit-btn">
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeForm
