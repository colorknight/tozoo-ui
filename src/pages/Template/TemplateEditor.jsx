import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  OUTPUT_FORMAT,
  VARIABLE_TYPE,
  DEFAULT_LIST_ITEM_LABEL,
  extractVariablesFromContent,
  mergeVariables,
  syncListBlockTagsInContent,
  validateListBlockTags,
  buildTestDataAsObject,
  buildDataFromResponse,
  renderTemplateContent,
  renderTemplateWithData,
  loadStoredTemplates,
  saveStoredTemplates
} from './templateEditorUtils'
import { updateTemplateContent } from '../../api/templates'
import CodeMirror from '@uiw/react-codemirror'
import { mustacheHighlight } from './mustacheExtension'
import './TemplateEditor.css'

function TemplateEditor() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const isNew = !id || id === 'new'

  const [content, setContent] = useState('')
  const [variables, setVariables] = useState([])
  const [format, setFormat] = useState(OUTPUT_FORMAT.MARKDOWN)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [variablesPanelState, setVariablesPanelState] = useState('collapsed')
  const [selectedVarIndex, setSelectedVarIndex] = useState(null)
  const [colNameWidth, setColNameWidth] = useState(200)
  const [colTypeWidth, setColTypeWidth] = useState(110)
  const [resizingCol, setResizingCol] = useState(null)
  const [variablesPanelHeight, setVariablesPanelHeight] = useState(300)
  const [resizingPanel, setResizingPanel] = useState(false)
  const resizingPanelStartRef = useRef({ y: 0, h: 0 })
  const [editableTestDataJson, setEditableTestDataJson] = useState('')
  const [listTagMismatch, setListTagMismatch] = useState(null)
  const editorRef = useRef(null)
  const tableWrapRef = useRef(null)

  useEffect(() => {
    if (!isNew && id) {
      const fromState = location.state?.template?.id === id ? location.state.template : null
      const t = fromState || loadStoredTemplates().find((x) => x.id === id)
      if (t) {
        setContent(t.content || '')
        setVariables(Array.isArray(t.variables) ? t.variables.map((v) => ({ ...v })) : [])
        setFormat(t.format || OUTPUT_FORMAT.MARKDOWN)
        setName(t.name || '')
        setDescription(t.description || '')
      }
    }
  }, [isNew, id, location.state])

  useEffect(() => {
    if (variables.length === 0) setSelectedVarIndex(null)
    else setSelectedVarIndex((prev) => (prev != null && prev >= variables.length ? variables.length - 1 : prev))
  }, [variables.length])

  useEffect(() => {
    if (resizingCol == null) return
    const wrap = tableWrapRef.current
    const minName = 80
    const minType = 70
    const minDesc = 120
    const handleW = 6
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (e) => {
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const total = rect.width
      if (resizingCol === 1) {
        const w = e.clientX - rect.left
        setColNameWidth(Math.min(Math.max(minName, w), total - colTypeWidth - minDesc - handleW * 2))
      } else {
        const w = rect.right - e.clientX
        setColTypeWidth(Math.min(Math.max(minType, w), total - colNameWidth - minDesc - handleW * 2))
      }
    }
    const onUp = () => {
      setResizingCol(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingCol, colNameWidth, colTypeWidth])

  useEffect(() => {
    if (!resizingPanel) return
    const minH = 120
    const maxH = typeof window !== 'undefined' ? Math.min(600, window.innerHeight * 0.7) : 600
    const onMove = (e) => {
      const dy = resizingPanelStartRef.current.y - e.clientY
      const newH = Math.min(maxH, Math.max(minH, resizingPanelStartRef.current.h + dy))
      setVariablesPanelHeight(newH)
    }
    const onUp = () => {
      setResizingPanel(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingPanel])

  const cycleVariablesPanel = () => {
    if (variablesPanelState === 'collapsed') {
      setVariablesPanelState('expanded')
      if (variables.length > 0 && selectedVarIndex == null) setSelectedVarIndex(0)
    } else {
      setVariablesPanelState('collapsed')
    }
  }

  const removeVariable = (index) => {
    setVariables((prev) => prev.filter((_, i) => i !== index))
    setSelectedVarIndex((prev) => {
      if (prev == null) return null
      if (prev === index) return null
      return prev > index ? prev - 1 : prev
    })
  }

  const updateVariable = (index, field, value) => {
    setVariables((prev) => {
      const updated = prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
      if (field === 'variableKey' && prev[index].variableType === VARIABLE_TYPE.LIST) {
        const oldKey = (prev[index].variableKey || '').trim()
        const newKey = (value || '').trim()
        if (oldKey && newKey && oldKey !== newKey) {
          setContent((c) => syncListBlockTagsInContent(c, oldKey, newKey))
        }
      }
      return updated
    })
  }

  const applyExtractedVariables = () => {
    const extracted = extractVariablesFromContent(content)
    setVariables((prev) => mergeVariables(prev, extracted))
  }

  // 光标离开编辑区时从模板内容抽取变量，校验列表块开/闭标签，可修复则自动对齐
  const handleContentBlur = () => {
    const extracted = extractVariablesFromContent(content)
    setVariables((prev) => mergeVariables(prev, extracted))
    const { valid, mismatches, fixedContent } = validateListBlockTags(content)
    const toFix = mismatches.filter((m) => m.closeKey != null && m.closeIndex != null && m.closeFull != null)
    if (!valid && toFix.length > 0) {
      setContent(fixedContent)
      const recheck = validateListBlockTags(fixedContent)
      if (recheck.valid) setListTagMismatch(null)
      else setListTagMismatch({ mismatches: recheck.mismatches, fixedContent: recheck.fixedContent })
    } else if (valid) setListTagMismatch(null)
    else setListTagMismatch({ mismatches, fixedContent })
  }

  const handleContentChange = (val) => setContent(val)

  // 预览用测试数据（JSON）渲染；若测试数据无效则退回用变量默认/示例数据
  const previewRendered = useMemo(() => {
    const trimmed = (editableTestDataJson || '').trim()
    if (trimmed) {
      try {
        const testDataObj = JSON.parse(trimmed)
        if (testDataObj && typeof testDataObj === 'object') {
          const { single, list } = buildDataFromResponse(testDataObj, variables)
          return renderTemplateWithData(content, variables, { single, list })
        }
      } catch (_) {
        /* JSON 无效时用默认渲染 */
      }
    }
    return renderTemplateContent(content, variables)
  }, [content, variables, editableTestDataJson])

  /** 按变量格式组织成的测试数据 JSON 字符串；LIST 按 Mustache 风格 {{path}} 从模板解析 */
  const testDataJsonString = useMemo(() => {
    const obj = buildTestDataAsObject(variables, content)
    if (Object.keys(obj).length === 0) return ''
    return JSON.stringify(obj, null, 2)
  }, [variables, content])

  useEffect(() => {
    setEditableTestDataJson(testDataJsonString)
  }, [testDataJsonString])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const doSave = async (meta = {}) => {
    setSaveError(null)
    const finalName = ((meta.name ?? name) || '').trim()
    const finalDesc = meta.description !== undefined ? meta.description : description
    const finalFormat = meta.format || format
    if (!finalName) {
      setSaveError('请输入模板名称')
      return false
    }

    const normalizedVars = variables
      .map((v) => ({
        variableKey: (v.variableKey || '').trim(),
        variableType: v.variableType || VARIABLE_TYPE.SINGLE,
        listItemLabel: v.variableType === VARIABLE_TYPE.LIST ? (v.listItemLabel || DEFAULT_LIST_ITEM_LABEL).trim() || DEFAULT_LIST_ITEM_LABEL : undefined,
        description: (v.description || '').trim() || undefined,
        testValue: (v.testValue != null ? String(v.testValue) : '').trim() || undefined
      }))
      .filter((v) => v.variableKey)

    const payload = {
      name: finalName,
      description: (finalDesc || '').trim(),
      format: finalFormat,
      content: (content || '').trim(),
      variables: normalizedVars
    }

    const list = loadStoredTemplates()
    if (!isNew && id) {
      setSaveError(null)
      setSaving(true)
      try {
        const contentPayload = {
          content: payload.content,
          format: payload.format || OUTPUT_FORMAT.MARKDOWN,
          variables: variables
            .filter((v) => (v.variableKey || '').trim())
            .map((v) => ({
              ...(v.id ? { id: v.id } : {}),
              variableKey: (v.variableKey || '').trim(),
              variableType: v.variableType || VARIABLE_TYPE.SINGLE,
              listItemLabel: v.variableType === VARIABLE_TYPE.LIST ? (v.listItemLabel || DEFAULT_LIST_ITEM_LABEL) : undefined,
              description: (v.description || '').trim() || '',
              testData: (v.testValue != null ? String(v.testValue) : '').trim()
            }))
        }
        await updateTemplateContent(id, contentPayload)
        const idx = list.findIndex((x) => x.id === id)
        const updated = { ...(idx >= 0 ? list[idx] : {}), ...payload, updatedTime: new Date().toISOString() }
        if (idx >= 0) list[idx] = updated
        else list.unshift(updated)
        saveStoredTemplates(list)
        navigate('/template')
        return true
      } catch (e) {
        setSaveError(e?.message || '保存失败')
        return false
      } finally {
        setSaving(false)
      }
    }
    const newTemplate = {
      id: String(Date.now()),
      ...payload,
      createdTime: new Date().toISOString(),
      updatedTime: new Date().toISOString()
    }
    saveStoredTemplates([newTemplate, ...list])
    navigate('/template')
    return true
  }

  const handleSave = () => doSave()

  return (
    <div className="template-editor-page">
      <header className="template-editor-header">
        <div className="template-editor-header-main">
          <button type="button" className="template-editor-back" onClick={() => navigate('/template')} disabled={saving}>
            返回
          </button>
          <input
            type="text"
            className="template-editor-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="模板名称（必填）"
            disabled={saving}
          />
        </div>
        <div className="template-editor-header-actions">
          {saveError && <span className="template-editor-save-error">{saveError}</span>}
          <button type="button" className="template-editor-save" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </header>

      <div className="template-editor-main">
        <section className="template-editor-panel template-editor-template">
          <h2 className="template-editor-panel-title">模板</h2>
          <div className="template-editor-codemirror-wrap">
            <CodeMirror
              ref={editorRef}
              value={content}
              onChange={handleContentChange}
              onBlur={handleContentBlur}
              extensions={[mustacheHighlight]}
              basicSetup={{ lineNumbers: false, bracketMatching: true, closeBrackets: true }}
              spellCheck={false}
              height="100%"
              minHeight="120px"
            />
          </div>
          {listTagMismatch && listTagMismatch.mismatches.length > 0 && (
            <div className="template-editor-list-tag-warning">
              <span>
                列表块标签不一致：
                {listTagMismatch.mismatches.map((mm, i) => (
                  <span key={i}>
                    {i > 0 && '；'}
                    {'{{#' + mm.openKey + '}}'}
                    {mm.closeKey != null ? ` 与 {{/${mm.closeKey}}} 不匹配` : ' 缺少对应的结束标签'}
                  </span>
                ))}
              </span>
              <button type="button" className="template-editor-list-tag-fix-btn" onClick={() => { setContent(listTagMismatch.fixedContent); setListTagMismatch(null) }}>
                修复
              </button>
            </div>
          )}
        </section>

        <section className="template-editor-panel template-editor-preview">
          <div className="template-editor-preview-format">
            <span className="template-editor-panel-title">预览</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="template-editor-format-select"
              title="预览格式"
            >
              <option value={OUTPUT_FORMAT.MARKDOWN}>Markdown</option>
              <option value={OUTPUT_FORMAT.TEXT}>纯文本</option>
            </select>
          </div>
          <div className="template-editor-preview-body">
            {format === OUTPUT_FORMAT.MARKDOWN ? (
              <div className="template-editor-preview-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewRendered || '(无内容)'}</ReactMarkdown>
              </div>
            ) : (
              <pre className="template-editor-preview-text">{previewRendered || '(无内容)'}</pre>
            )}
          </div>
        </section>
      </div>

      <div className={`template-editor-console template-editor-console-${variablesPanelState}`}>
        <button
          type="button"
          className="template-editor-console-header"
          onClick={cycleVariablesPanel}
          aria-expanded={variablesPanelState !== 'collapsed'}
          title="点击切换：收起 / 展开"
        >
          <span className="template-editor-console-title">变量</span>
          <span className="template-editor-console-badge">{variables.length}</span>
          <span className="template-editor-console-chevron">
            {variablesPanelState === 'collapsed' ? '▶' : '▼'}
          </span>
        </button>
        {/* 展开：左侧三列（变量名、描述、变量类型），右侧大 textarea + JSON 格式化 */}
        {variablesPanelState === 'expanded' && (
          <>
            <div
              className="template-editor-console-resizer"
              title="上下拖动调整变量区高度"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                resizingPanelStartRef.current = { y: e.clientY, h: variablesPanelHeight }
                setResizingPanel(true)
              }}
            />
            <div
              className="template-editor-console-body"
              style={{ height: variablesPanelHeight }}
              onClick={(e) => e.stopPropagation()}
            >
            {variables.length === 0 ? (
              <p className="template-editor-var-empty">暂无变量</p>
            ) : (
              <div className="template-editor-console-two-col">
                <div className="template-editor-console-left">
                  <div ref={tableWrapRef} className="template-editor-var-table-wrap">
                    <table className="template-editor-var-table" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: colNameWidth }} />
                        <col />
                        <col style={{ width: colTypeWidth }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="template-editor-var-col-name">变量名</th>
                          <th className="template-editor-var-col-desc">描述</th>
                          <th className="template-editor-var-col-type">变量类型</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variables.map((v, index) => (
                          <tr
                            key={index}
                            className={selectedVarIndex === index ? 'is-selected' : ''}
                            onClick={() => setSelectedVarIndex(index)}
                          >
                            <td className="template-editor-var-col-name template-editor-var-col-readonly">
                              <span>{v.variableKey || '—'}</span>
                            </td>
                            <td className="template-editor-var-col-desc">
                              <input
                                type="text"
                                value={v.description ?? ''}
                                onChange={(e) => updateVariable(index, 'description', e.target.value)}
                                placeholder="描述"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="template-editor-var-col-type template-editor-var-col-readonly">
                              <span>{v.variableType === VARIABLE_TYPE.LIST ? '列表' : '单一'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <span
                      className="template-editor-var-resizer"
                      style={{ left: colNameWidth - 3 }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setResizingCol(1) }}
                      title="拖动调整列宽"
                    />
                    <span
                      className="template-editor-var-resizer"
                      style={{ left: `calc(100% - ${colTypeWidth}px - 3px)` }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setResizingCol(2) }}
                      title="拖动调整列宽"
                    />
                  </div>
                </div>
                <div className="template-editor-console-right">
                  <div className="template-editor-test-json-section">
                    <div className="template-editor-console-right-head">
                      <span className="template-editor-console-col-title">测试数据 (JSON)</span>
                      <button
                        type="button"
                        className="template-editor-copy-json-btn"
                        onClick={() => {
                          const text = (editableTestDataJson || '').trim()
                          if (text) navigator.clipboard.writeText(text).catch(() => {})
                        }}
                        title="复制 JSON"
                      >
                        复制
                      </button>
                    </div>
                    {variables.length === 0 ? (
                      <p className="template-editor-var-empty">暂无变量</p>
                    ) : (
                      <textarea
                        className="template-editor-test-json-textarea"
                        value={editableTestDataJson}
                        onChange={(e) => setEditableTestDataJson(e.target.value)}
                        placeholder="编辑 JSON"
                        spellCheck={false}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TemplateEditor
