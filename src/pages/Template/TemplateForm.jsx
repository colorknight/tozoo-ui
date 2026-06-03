import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './TemplateForm.css'

/** 与后端 OutputTemplateFormat 一致 */
const OUTPUT_FORMAT = { MARKDOWN: 'MARKDOWN', TEXT: 'TEXT' }

/** 与后端 TemplateVariableType 一致 */
const VARIABLE_TYPE = { SINGLE: 'SINGLE', LIST: 'LIST' }

const STORAGE_KEY = 'agent-client-templates'
const DEFAULT_LIST_ITEM_LABEL = 'item'

/** 从模板内容中抽取变量：单一 {{key}}，列表 {{#key}}...{{/key}} */
function extractVariablesFromContent(content) {
  if (!content || typeof content !== 'string') return { single: [], list: [] }
  const listKeys = new Set()
  const singleKeys = new Set()
  // 列表：{{#key}} 与 {{/key}}
  const listOpenRe = /\{\{#(\w+)\}\}/g
  const listCloseRe = /\{\{\/(\w+)\}\}/g
  let m
  while ((m = listOpenRe.exec(content)) !== null) listKeys.add(m[1])
  while ((m = listCloseRe.exec(content)) !== null) listKeys.add(m[1])
  // 单一：仅 {{key}} 且 key 为纯字母数字下划线，且不是列表名
  const singleRe = /\{\{(\w+)\}\}/g
  while ((m = singleRe.exec(content)) !== null) {
    const key = m[1]
    if (!listKeys.has(key)) singleKeys.add(key)
  }
  return {
    single: Array.from(singleKeys),
    list: Array.from(listKeys)
  }
}

/** 将抽取结果与当前变量列表合并：已有 key 保留原配置，新增的追加 */
function mergeVariables(currentVars, extracted) {
  const byKey = new Map(currentVars.map((v) => [v.variableKey, v]))
  extracted.single.forEach((key) => {
    if (!byKey.has(key)) byKey.set(key, { variableKey: key, variableType: VARIABLE_TYPE.SINGLE, listItemLabel: DEFAULT_LIST_ITEM_LABEL })
  })
  extracted.list.forEach((key) => {
    if (!byKey.has(key)) byKey.set(key, { variableKey: key, variableType: VARIABLE_TYPE.LIST, listItemLabel: DEFAULT_LIST_ITEM_LABEL })
  })
  return Array.from(byKey.values())
}

/** 根据变量生成预览用占位数据（列表项为带 title/content 等示例对象，便于 {{item.xxx}} 替换） */
function buildSampleData(variables) {
  const single = {}
  const list = {}
  variables.forEach((v) => {
    if (!v.variableKey) return
    if (v.variableType === VARIABLE_TYPE.LIST) {
      const label = v.listItemLabel || DEFAULT_LIST_ITEM_LABEL
      list[v.variableKey] = [
        { [label]: { title: '示例标题 1', content: '示例内容 1' } },
        { [label]: { title: '示例标题 2', content: '示例内容 2' } }
      ]
    } else {
      single[v.variableKey] = `示例-${v.variableKey}`
    }
  })
  return { single, list }
}

/** 转义正则中的特殊字符 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 渲染模板：替换单一变量与列表块，返回字符串 */
function renderTemplateContent(content, variables) {
  if (!content || typeof content !== 'string') return ''
  const vars = variables || []
  const { single, list } = buildSampleData(vars)
  let out = content
  // 先处理列表块
  Object.keys(list).forEach((listKey) => {
    const listItems = list[listKey]
    if (!Array.isArray(listItems)) return
    const varDef = vars.find((v) => v.variableKey === listKey)
    const itemLabel = varDef?.listItemLabel || DEFAULT_LIST_ITEM_LABEL
    const openTag = `{{#${listKey}}}`
    const closeTag = `{{/${listKey}}}`
    const openRe = escapeRe(openTag)
    const closeRe = escapeRe(closeTag)
    const blockRe = new RegExp(`${openRe}([\\s\\S]*?)${closeRe}`, 'g')
    out = out.replace(blockRe, (_, block) => {
      return listItems.map((item) => {
        let s = block
        const itemObj = item[itemLabel]
        if (itemObj && typeof itemObj === 'object') {
          Object.keys(itemObj).forEach((sub) => {
            const re = new RegExp(escapeRe(`{{${itemLabel}.${sub}}}`), 'g')
            s = s.replace(re, String(itemObj[sub]))
          })
        }
        if (item[itemLabel] !== undefined && typeof item[itemLabel] !== 'object') {
          s = s.replace(new RegExp(escapeRe(`{{${itemLabel}}}`), 'g'), String(item[itemLabel]))
        }
        return s
      }).join('')
    })
  })
  // 再替换单一变量
  Object.keys(single).forEach((key) => {
    const val = single[key]
    out = out.replace(new RegExp(escapeRe(`{{${key}}}`), 'g'), String(val))
  })
  return out
}

function loadStoredTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const list = JSON.parse(raw)
      return Array.isArray(list) ? list : []
    }
  } catch (_) {}
  return []
}

function saveStoredTemplates(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (_) {}
}

function TemplateForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    format: OUTPUT_FORMAT.MARKDOWN,
    content: '',
    variables: []
  })
  const [contextMenu, setContextMenu] = useState(null)
  const contentTextareaRef = useRef(null)
  const cursorPosRef = useRef({ start: 0, end: 0 })
  const insertCursorRef = useRef(null)

  // 编辑时从列表加载数据
  useEffect(() => {
    if (isEdit && id) {
      const list = loadStoredTemplates()
      const t = list.find((x) => x.id === id)
      if (t) {
        setFormData({
          name: t.name || '',
          description: t.description || '',
          format: t.format || OUTPUT_FORMAT.MARKDOWN,
          content: t.content || '',
          variables: Array.isArray(t.variables) ? t.variables.map((v) => ({ ...v })) : []
        })
      }
    }
  }, [isEdit, id])

  const addVariable = () => {
    setFormData((prev) => ({
      ...prev,
      variables: [
        ...prev.variables,
        { variableKey: '', variableType: VARIABLE_TYPE.SINGLE, listItemLabel: DEFAULT_LIST_ITEM_LABEL }
      ]
    }))
  }

  const removeVariable = (index) => {
    setFormData((prev) => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }))
  }

  const updateVariable = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      variables: prev.variables.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      )
    }))
  }

  /** 模板内容输入框右键：弹出添加变量菜单 */
  const handleContentContextMenu = (e) => {
    e.preventDefault()
    cursorPosRef.current = {
      start: e.target.selectionStart,
      end: e.target.selectionEnd
    }
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  /** 在光标处插入片段，插入后光标/选区为片段内的相对偏移（cursorStart, cursorEnd） */
  const insertAtCursor = (snippet, cursorStart, cursorEnd = cursorStart) => {
    const { start, end } = cursorPosRef.current
    const text = formData.content || ''
    const newText = text.slice(0, start) + snippet + text.slice(end)
    setFormData((prev) => ({ ...prev, content: newText }))
    insertCursorRef.current = { start: start + cursorStart, end: start + cursorEnd }
    setContextMenu(null)
  }

  /** 插入单一变量 {{}}，光标在中间 */
  const insertSingleVariable = () => insertAtCursor('{{}}', 2, 2)

  /** 插入列表块 {{#key}}...{{/key}}，选中 key 便于改名 */
  const insertListBlock = () => insertAtCursor('{{#key}}\n\n{{/key}}', 4, 7)

  useEffect(() => {
    if (contentTextareaRef.current && insertCursorRef.current) {
      const { start, end } = insertCursorRef.current
      contentTextareaRef.current.focus()
      contentTextareaRef.current.setSelectionRange(start, end)
      insertCursorRef.current = null
    }
  }, [formData.content])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  /** 从模板内容中抽取变量并合并到当前列表（已有 key 保留原配置） */
  const applyExtractedVariables = () => {
    const extracted = extractVariablesFromContent(formData.content)
    const merged = mergeVariables(formData.variables, extracted)
    setFormData((prev) => ({ ...prev, variables: merged }))
  }

  /** 右侧实时预览的渲染结果 */
  const previewRendered = useMemo(
    () => renderTemplateContent(formData.content, formData.variables),
    [formData.content, formData.variables]
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    const name = (formData.name || '').trim()
    if (!name) {
      alert('请输入模板名称')
      return
    }

    const payload = {
      name,
      description: (formData.description || '').trim(),
      format: formData.format,
      content: (formData.content || '').trim(),
      variables: formData.variables
        .map((v) => ({
          variableKey: (v.variableKey || '').trim(),
          variableType: v.variableType || VARIABLE_TYPE.SINGLE,
          listItemLabel: v.variableType === VARIABLE_TYPE.LIST ? (v.listItemLabel || DEFAULT_LIST_ITEM_LABEL).trim() || DEFAULT_LIST_ITEM_LABEL : undefined
        }))
        .filter((v) => v.variableKey)
    }

    const list = loadStoredTemplates()
    if (isEdit && id) {
      const idx = list.findIndex((x) => x.id === id)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...payload, updatedTime: new Date().toISOString() }
        saveStoredTemplates(list)
        navigate('/template')
        return
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
  }

  return (
    <div className="template-form-page">
      <div className="template-form-title-row template-form-title-row-global">
        <h1>{isEdit ? '编辑模板' : '新增模板'}</h1>
        <button type="button" className="template-form-back" onClick={() => navigate('/template')}>
          返回列表
        </button>
      </div>

      <div className="template-form-two-col">
        <div className="template-form-left">
          <div className="template-form-container">
            <p className="template-form-hint">
              支持单一变量 <code>{'{{key}}'}</code> 与列表 <code>{'{{#listKey}}...{{item}}...{{/listKey}}'}</code>；可点击「从内容抽取变量」自动识别占位符，也可手动添加/编辑。
            </p>

            <form onSubmit={handleSubmit}>
              <div className="template-form-group">
                <label>模板名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：报告输出模板"
                  required
                  className="template-form-input"
                />
              </div>

              <div className="template-form-group">
                <label>描述</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="简短说明模板用途"
                  className="template-form-input"
                />
              </div>

              <div className="template-form-group">
                <label>输出格式</label>
                <select
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  className="template-form-select"
                >
                  <option value={OUTPUT_FORMAT.MARKDOWN}>Markdown</option>
                  <option value={OUTPUT_FORMAT.TEXT}>纯文本（TEXT）</option>
                </select>
              </div>

              <div className="template-form-group">
                <label>模板内容</label>
                <textarea
                  ref={contentTextareaRef}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  onContextMenu={handleContentContextMenu}
                  className="template-form-textarea template-form-textarea-large"
                />
              </div>
              {contextMenu && (
                <div
                  className="template-form-context-menu"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button type="button" className="template-form-context-item" onClick={insertSingleVariable}>
                    插入单一变量 {'{{key}}'}
                  </button>
                  <button type="button" className="template-form-context-item" onClick={insertListBlock}>
                    插入列表块 {'{{#key}}...{{/key}}'}
                  </button>
                </div>
              )}

              <div className="template-form-group">
                <div className="template-form-group-head">
                  <label>变量定义</label>
                  <div className="template-form-var-buttons">
                    <button type="button" className="template-form-extract-var" onClick={applyExtractedVariables}>
                      从内容抽取变量
                    </button>
                    <button type="button" className="template-form-add-var" onClick={addVariable}>
                      + 添加变量
                    </button>
                  </div>
                </div>
                {formData.variables.length === 0 ? (
                  <div className="template-form-empty-var">暂无变量。在模板中写 <code>{'{{key}}'}</code> / <code>{'{{#key}}...{{/key}}'}</code> 后点击「从内容抽取变量」，或手动添加。</div>
                ) : (
                  <div className="template-form-var-list">
                    {formData.variables.map((v, index) => (
                      <div key={index} className="template-form-var-row">
                        <input
                          type="text"
                          value={v.variableKey}
                          onChange={(e) => updateVariable(index, 'variableKey', e.target.value)}
                          placeholder="变量名"
                          className="template-form-var-key"
                        />
                        <select
                          value={v.variableType}
                          onChange={(e) => updateVariable(index, 'variableType', e.target.value)}
                          className="template-form-var-type"
                        >
                          <option value={VARIABLE_TYPE.SINGLE}>单一</option>
                          <option value={VARIABLE_TYPE.LIST}>列表</option>
                        </select>
                        {v.variableType === VARIABLE_TYPE.LIST && (
                          <input
                            type="text"
                            value={v.listItemLabel ?? DEFAULT_LIST_ITEM_LABEL}
                            onChange={(e) => updateVariable(index, 'listItemLabel', e.target.value)}
                            placeholder="项名"
                            className="template-form-var-item-label"
                            title="块内当前项占位符名"
                          />
                        )}
                        <button type="button" className="template-form-var-remove" onClick={() => removeVariable(index)} title="删除">
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="template-form-actions">
                <button type="button" className="template-form-cancel" onClick={() => navigate('/template')}>
                  取消
                </button>
                <button type="submit" className="template-form-submit">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="template-form-preview-wrap">
          <div className="template-form-preview-header">实时预览</div>
          <div className="template-form-preview-body">
            {formData.format === OUTPUT_FORMAT.MARKDOWN ? (
              <div className="template-form-preview-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewRendered || '(无内容)'}</ReactMarkdown>
              </div>
            ) : (
              <pre className="template-form-preview-text">{previewRendered || '(无内容)'}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateForm
