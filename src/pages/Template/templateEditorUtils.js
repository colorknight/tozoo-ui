/** 与后端 OutputTemplateFormat 一致 */
export const OUTPUT_FORMAT = { MARKDOWN: 'MARKDOWN', TEXT: 'TEXT' }

/** 与后端 TemplateVariableType 一致 */
export const VARIABLE_TYPE = { SINGLE: 'SINGLE', LIST: 'LIST' }

export const STORAGE_KEY = 'agent-client-templates'
export const DEFAULT_LIST_ITEM_LABEL = 'item'

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 按路径取嵌套属性，如 getNested(obj, 'content.name') => obj.content?.name */
export function getNested(obj, path) {
  if (obj == null || !path || typeof path !== 'string') return undefined
  const parts = path.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

/** 按路径设置嵌套属性，如 setNested(obj, 'content.name', v) => obj.content = { name: v }；会创建中间对象 */
export function setNested(obj, path, value) {
  if (!obj || !path || typeof path !== 'string') return
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!(key in cur) || typeof cur[key] !== 'object' || cur[key] === null) {
      cur[key] = {}
    }
    cur = cur[key]
  }
  cur[parts[parts.length - 1]] = value
}

/** 按 XML 嵌套规则找到与 openIndex 处 {{#listKey}} 配对的 {{/listKey}} 的位置（内层先闭合，支持同 key 多层嵌套） */
function findMatchingCloseIndex(content, listKey, openIndex) {
  const openTag = `{{#${listKey}}}`
  const closeTag = `{{/${listKey}}}`
  let depth = 1
  let pos = openIndex + openTag.length
  while (depth > 0 && pos <= content.length) {
    const nextOpen = content.indexOf(openTag, pos)
    const nextClose = content.indexOf(closeTag, pos)
    if (nextClose === -1) return -1
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      pos = nextOpen + openTag.length
    } else {
      depth -= 1
      if (depth === 0) return nextClose
      pos = nextClose + closeTag.length
    }
  }
  return -1
}

/** Mustache 风格：从块内容中解析「当前项」的路径，只取顶层（跳过嵌套 {{#x}}...{{/x}}）；匹配 {{path}}，path 可为 content.name 等 */
function extractTopLevelPathsInBlock(blockStr) {
  if (!blockStr || typeof blockStr !== 'string') return []
  const paths = new Set()
  const tagRe = /\{\{([^}]+)\}\}/g
  let m
  while ((m = tagRe.exec(blockStr)) !== null) {
    const inner = m[1].trim()
    if (inner.startsWith('#')) {
      const key = inner.slice(1).trim().split(/\s/)[0]
      if (key) {
        const closeIdx = findMatchingCloseIndex(blockStr, key, m.index)
        if (closeIdx !== -1) {
          const closeTag = `{{/${key}}}`
          tagRe.lastIndex = closeIdx + closeTag.length
        }
      }
    } else if (!inner.startsWith('/') && /^[\w.]+$/.test(inner)) {
      paths.add(inner)
    }
  }
  return Array.from(paths)
}

/** 从列表块内容中解析「当前项」的访问路径（Mustache 风格：{{path}}，块内顶层）；listItemLabel 保留兼容不再参与解析 */
export function extractListItemPropertyPaths(content, listKey, listItemLabel) {
  if (!content || typeof content !== 'string' || !listKey) return []
  const openTag = `{{#${listKey}}}`
  const openIdx = content.indexOf(openTag)
  if (openIdx === -1) return []
  const closeIdx = findMatchingCloseIndex(content, listKey, openIdx)
  if (closeIdx === -1 || closeIdx <= openIdx) return []
  const block = content.slice(openIdx + openTag.length, closeIdx)
  return extractTopLevelPathsInBlock(block)
}

/** 兼容旧用法：仅返回顶层属性名（路径的第一段） */
export function extractListItemProperties(content, listKey, listItemLabel) {
  const paths = extractListItemPropertyPaths(content, listKey, listItemLabel)
  const topLevel = new Set()
  paths.forEach((p) => { topLevel.add(p.split('.')[0]) })
  return Array.from(topLevel)
}

/** 找出所有列表块及其匹配的闭合位置，再按包含关系建树；返回顶层块数组，每块含 children（key 支持 path 如 a.b） */
function getListBlockTree(content) {
  if (!content || typeof content !== 'string') return []
  const openRe = /\{\{#([\w.]+)\}\}/g
  const blocks = []
  let m
  while ((m = openRe.exec(content)) !== null) {
    const key = m[1]
    const openIdx = m.index
    const closeIdx = findMatchingCloseIndex(content, key, openIdx)
    if (closeIdx !== -1) blocks.push({ key, openIdx, closeIdx, span: closeIdx - openIdx })
  }
  blocks.sort((a, b) => a.openIdx - b.openIdx)
  for (const b of blocks) {
    b.children = blocks.filter(
      (c) => c !== b && c.openIdx > b.openIdx && c.closeIdx < b.closeIdx
        && !blocks.some((p) => p !== b && p !== c && p.openIdx > b.openIdx && p.closeIdx < b.closeIdx && p.openIdx < c.openIdx && c.closeIdx < p.closeIdx)
    )
  }
  const roots = blocks.filter(
    (b) => !blocks.some((p) => p !== b && p.openIdx < b.openIdx && b.closeIdx < p.closeIdx)
  )
  return roots
}

/** 取变量的列表项标签 */
function getItemLabel(variables, listKey) {
  const v = variables.find((x) => x.variableKey === listKey)
  return (v?.listItemLabel || DEFAULT_LIST_ITEM_LABEL).trim() || DEFAULT_LIST_ITEM_LABEL
}

/** 按模板嵌套为某一列表块生成示例项（含子列表块作为属性）；仅用于顶层块时写入 list[key] */
function buildListItemsForBlock(block, content, variables) {
  const label = getItemLabel(variables, block.key)
  const paths = extractListItemPropertyPaths(content, block.key, label)
  const base1 = buildNestedObjectFromPaths(paths, '')
  const base2 = buildNestedObjectFromPaths(paths, '-2')
  for (const child of block.children) {
    const childItems = buildListItemsForBlock(child, content, variables)
    base1[child.key] = childItems
    base2[child.key] = childItems
  }
  return [base1, base2]
}

/** 将模板中的列表块开/闭标签从 oldKey 同步为 newKey（{{#oldKey}}→{{#newKey}}，{{/oldKey}}→{{/newKey}}） */
export function syncListBlockTagsInContent(content, oldKey, newKey) {
  if (!content || typeof content !== 'string') return content
  const trimmedOld = (oldKey || '').trim()
  const trimmedNew = (newKey || '').trim()
  if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return content
  return content
    .split(`{{#${trimmedOld}}}`).join(`{{#${trimmedNew}}}`)
    .split(`{{/${trimmedOld}}}`).join(`{{/${trimmedNew}}}`)
}

/** 校验列表块开/闭标签是否成对一致（XML 嵌套：内层先闭合）；不一致时返回 mismatches 与可替换的 fixedContent；key 支持 path 如 a.b */
export function validateListBlockTags(content) {
  if (!content || typeof content !== 'string') return { valid: true, mismatches: [] }
  const openRe = /\{\{#([\w.]+)\}\}/g
  const closeRe = /\{\{\/([\w.]+)\}\}/g
  const tags = []
  let m
  while ((m = openRe.exec(content)) !== null) tags.push({ key: m[1], index: m.index, full: m[0], isOpen: true })
  while ((m = closeRe.exec(content)) !== null) tags.push({ key: m[1], index: m.index, full: m[0], isOpen: false })
  tags.sort((a, b) => a.index - b.index)
  const stack = []
  const mismatches = []
  for (const tag of tags) {
    if (tag.isOpen) {
      stack.push(tag)
    } else {
      if (stack.length === 0) {
        mismatches.push({ openKey: null, closeKey: tag.key, openIndex: null, closeIndex: tag.index, closeFull: tag.full })
      } else {
        const openTag = stack.pop()
        if (openTag.key !== tag.key) {
          mismatches.push({ openKey: openTag.key, closeKey: tag.key, openIndex: openTag.index, closeIndex: tag.index, closeFull: tag.full })
        }
      }
    }
  }
  while (stack.length > 0) {
    const openTag = stack.pop()
    mismatches.push({ openKey: openTag.key, closeKey: null, openIndex: openTag.index, closeIndex: null, closeFull: null })
  }
  const valid = mismatches.length === 0
  const toFix = mismatches.filter((mm) => mm.closeKey != null && mm.closeIndex != null && mm.closeFull != null)
  const sorted = [...toFix].sort((a, b) => (b.closeIndex || 0) - (a.closeIndex || 0))
  let fixedContent = content
  for (const mm of sorted) {
    const newClose = `{{/${mm.openKey}}}`
    fixedContent = fixedContent.slice(0, mm.closeIndex) + newClose + fixedContent.slice(mm.closeIndex + mm.closeFull.length)
  }
  return { valid, mismatches, fixedContent }
}

/** 收集所有列表块的「内部」区间 [start, end]（即 {{#key}} 与 {{/key}} 之间的内容），用于判断 {{x}} 是否在块内 */
function getListBlockInnerRanges(content) {
  const roots = getListBlockTree(content)
  const ranges = []
  function collect(blocks) {
    blocks.forEach((b) => {
      const openTag = `{{#${b.key}}}`
      const closeTag = `{{/${b.key}}}`
      ranges.push([b.openIdx + openTag.length, b.closeIdx])
      if (b.children && b.children.length) collect(b.children)
    })
  }
  collect(roots)
  return ranges
}

/** 判断 index 是否落在任意列表块内部 */
function isIndexInsideListBlock(content, index, ranges) {
  return ranges.some(([start, end]) => index >= start && index <= end)
}

/** 从模板内容中抽取变量：仅把出现在列表块外的 {{key}} 当作单一变量，列表 {{#key}}...{{/key}} 当作 list */
export function extractVariablesFromContent(content) {
  if (!content || typeof content !== 'string') return { single: [], list: [] }
  const listKeys = new Set()
  const listOpenRe = /\{\{#(\w+)\}\}/g
  let m
  while ((m = listOpenRe.exec(content)) !== null) listKeys.add(m[1])
  const innerRanges = getListBlockInnerRanges(content)
  const singleKeys = new Set()
  const singleRe = /\{\{(\w+)\}\}/g
  while ((m = singleRe.exec(content)) !== null) {
    const key = m[1]
    if (listKeys.has(key)) continue
    if (!isIndexInsideListBlock(content, m.index, innerRanges)) singleKeys.add(key)
  }
  return { single: Array.from(singleKeys), list: Array.from(listKeys) }
}

/** 将抽取结果与当前变量列表合并 */
export function mergeVariables(currentVars, extracted) {
  const byKey = new Map(currentVars.map((v) => [v.variableKey, v]))
  extracted.single.forEach((key) => {
    if (!byKey.has(key)) byKey.set(key, { variableKey: key, variableType: VARIABLE_TYPE.SINGLE, listItemLabel: DEFAULT_LIST_ITEM_LABEL, description: '', testValue: '' })
  })
  extracted.list.forEach((key) => {
    if (!byKey.has(key)) byKey.set(key, { variableKey: key, variableType: VARIABLE_TYPE.LIST, listItemLabel: DEFAULT_LIST_ITEM_LABEL, description: '', testValue: '' })
  })
  return Array.from(byKey.values())
}

/** 根据变量生成预览用占位数据（使用变量的 testValue 作为测试输入） */
export function buildSampleData(variables) {
  const single = {}
  const list = {}
  variables.forEach((v) => {
    if (!v.variableKey) return
    if (v.variableType === VARIABLE_TYPE.LIST) {
      const label = v.listItemLabel || DEFAULT_LIST_ITEM_LABEL
      if (v.testValue && typeof v.testValue === 'string' && v.testValue.trim()) {
        try {
          const parsed = JSON.parse(v.testValue.trim())
          if (Array.isArray(parsed)) list[v.variableKey] = parsed
          else list[v.variableKey] = [{ value: String(v.testValue) }]
        } catch (_) {
          list[v.variableKey] = [{}, {}]
        }
      } else {
        list[v.variableKey] = [{}, {}]
      }
    } else {
      single[v.variableKey] = (v.testValue != null && String(v.testValue).trim() !== '') ? String(v.testValue).trim() : `示例-${v.variableKey}`
    }
  })
  return { single, list }
}

/** 根据变量和（可选）模板内容生成预览用占位数据；有 content 时按列表块嵌套树只生成顶层 list，子列表作为项属性 */
export function buildSampleDataWithContent(variables, content) {
  const single = {}
  variables.forEach((v) => {
    if (!v.variableKey) return
    if (v.variableType !== VARIABLE_TYPE.LIST) {
      single[v.variableKey] = (v.testValue != null && String(v.testValue).trim() !== '') ? String(v.testValue).trim() : `示例-${v.variableKey}`
    }
  })
  const roots = content ? getListBlockTree(content) : []
  let list = {}
  if (content && roots.length > 0) {
    roots.forEach((root) => {
      const v = variables.find((x) => x.variableKey === root.key)
      if (v?.variableType === VARIABLE_TYPE.LIST && v.testValue && typeof v.testValue === 'string' && v.testValue.trim()) {
        try {
          const parsed = JSON.parse(v.testValue.trim())
          list[root.key] = Array.isArray(parsed) ? parsed : [{ value: String(v.testValue) }]
        } catch (_) {
          list[root.key] = buildListItemsForBlock(root, content, variables)
        }
      } else {
        list[root.key] = buildListItemsForBlock(root, content, variables)
      }
    })
  } else {
    variables.forEach((v) => {
      if (!v.variableKey || v.variableType !== VARIABLE_TYPE.LIST) return
      const label = v.listItemLabel || DEFAULT_LIST_ITEM_LABEL
      if (v.testValue && typeof v.testValue === 'string' && v.testValue.trim()) {
        try {
          const parsed = JSON.parse(v.testValue.trim())
          list[v.variableKey] = Array.isArray(parsed) ? parsed : [{ value: String(v.testValue) }]
        } catch (_) {
          list[v.variableKey] = [{}, {}]
        }
      } else {
        list[v.variableKey] = [{}, {}]
      }
    })
  }
  return { single, list }
}

/** 根据路径数组构建嵌套对象，只含模板里出现的路径，不凭空加 title/content */
function buildNestedObjectFromPaths(paths, suffix = '') {
  const obj = {}
  paths.forEach((path) => {
    const placeholder = `示例-${path.replace(/\./g, '-')}${suffix}`
    setNested(obj, path, placeholder)
  })
  return obj
}

/** 列表项为嵌套 JSON，与 Mustache 块内 {{path}} 一致（如 {{content.name}}、{{value}}） */
function buildDefaultListItems(label, content, listKey, listItemLabel) {
  const paths = content ? extractListItemPropertyPaths(content, listKey, listItemLabel) : []
  const shape1 = buildNestedObjectFromPaths(paths, '')
  const shape2 = buildNestedObjectFromPaths(paths, '-2')
  return [shape1, shape2]
}

/** 按变量格式组织成单一 JSON 对象（单一变量为 key-value，列表变量为 key: 数组），用于展示/复制；传入 content 时 LIST 默认项按模板中的对象属性生成 */
export function buildTestDataAsObject(variables, content) {
  const { single, list } = content
    ? buildSampleDataWithContent(variables || [], content)
    : buildSampleData(variables || [])
  return { ...single, ...list }
}

/** 生成列表变量测试数据的占位示例 JSON 字符串；列表项为嵌套对象，如 [{ name, content: { name } }, ...] */
export function getListTestValuePlaceholder(content, listKey, listItemLabel) {
  const label = listItemLabel || DEFAULT_LIST_ITEM_LABEL
  const paths = content ? extractListItemPropertyPaths(content, listKey, label) : []
  const item1 = buildNestedObjectFromPaths(paths, '')
  const item2 = buildNestedObjectFromPaths(paths, '-2')
  const arr = [item1, item2]
  return JSON.stringify(arr, null, 2)
}

/**
 * Mustache 风格块展开：当前 item 为上下文，支持任意层嵌套（数组的 element 里还有数组、再往里递归）。
 * 顺序：先递归展开所有 {{#key}}...{{/key}}（从当前 item 用 getNested(item, key) 取数组），再替换当前层 {{path}}，
 * 这样内层的 {{implementation_measures}} 等始终来自对应层级的 item，不会被外层错误替换。
 */
function expandBlock(blockStr, item, vars) {
  if (item == null) item = {}
  let s = blockStr
  // 支持 {{#key}} 与 {{#key.subkey}} 带点号路径，从当前 item 取嵌套数组
  const openRe = /\{\{#([\w.]+)\}\}/g
  let openMatch
  while ((openMatch = openRe.exec(s)) !== null) {
    const nestedKey = openMatch[1]
    const openTag = openMatch[0]
    const closeIdx = findMatchingCloseIndex(s, nestedKey, openMatch.index)
    if (closeIdx === -1) continue
    const closeTag = `{{/${nestedKey}}}`
    const innerBlock = s.slice(openMatch.index + openTag.length, closeIdx)
    const arr = getNested(item, nestedKey)
    if (Array.isArray(arr)) {
      const replacement = arr.map((subItem) => expandBlock(innerBlock, subItem, vars)).join('')
      s = s.slice(0, openMatch.index) + replacement + s.slice(closeIdx + closeTag.length)
      openRe.lastIndex = openMatch.index
    }
  }
  const pathRe = /\{\{(?![\#\/])([\w.]+)\}\}/g
  s = s.replace(pathRe, (_, path) => {
    const val = getNested(item, path)
    return val !== undefined && val !== null ? String(val) : ''
  })
  return s
}

/** 渲染模板：Mustache 风格，替换单一变量与列表块，嵌套列表从当前项属性展开 */
export function renderTemplateContent(content, variables) {
  if (!content || typeof content !== 'string') return ''
  const vars = variables || []
  const { single, list } = buildSampleDataWithContent(vars, content)
  return renderTemplateWithData(content, variables, { single, list })
}

/**
 * 从接口返回的 JSON 对象和模板变量定义，构建渲染所需的 { single, list }
 * @param {Object} dataObj - 接口返回的 JSON 对象（或任意嵌套对象）
 * @param {Array} variables - 模板变量列表，项含 variableKey、variableType
 */
export function buildDataFromResponse(dataObj, variables) {
  const single = {}
  const list = {}
  if (!dataObj || typeof dataObj !== 'object') return { single, list }
  const vars = variables || []
  vars.forEach((v) => {
    const key = (v.variableKey || '').trim()
    if (!key) return
    const val = getNested(dataObj, key)
    if (v.variableType === VARIABLE_TYPE.LIST) {
      list[key] = Array.isArray(val) ? val : (val != null ? [val] : [])
    } else {
      single[key] = val !== undefined && val !== null ? val : ''
    }
  })
  return { single, list }
}

/**
 * 使用给定数据渲染模板（用于将接口返回数据代入模板）
 * 只展开「模板顶层」的 list 块（如 {{#steps}}），嵌套块（如 {{#laws1}} 在 steps 内）在 expandBlock 里用当前 item 的 key 取数，避免用错顶层 list 导致内层 name/implementation_measures 为空。
 */
export function renderTemplateWithData(content, variables, data) {
  if (!content || typeof content !== 'string') return ''
  const { single = {}, list = {} } = data || {}
  const vars = variables || []
  let out = content
  const roots = getListBlockTree(content)
  const rootKeys = new Set(roots.map((r) => r.key))
  rootKeys.forEach((listKey) => {
    const listItems = list[listKey]
    if (!Array.isArray(listItems)) return
    const blockRe = new RegExp(`${escapeRe(`{{#${listKey}}}`)}([\\s\\S]*?)${escapeRe(`{{/${listKey}}}`)}`, 'g')
    out = out.replace(blockRe, (_, block) => {
      return listItems.map((item) => expandBlock(block, item, vars)).join('')
    })
  })
  Object.keys(single).forEach((key) => {
    out = out.replace(new RegExp(escapeRe(`{{${key}}}`), 'g'), String(single[key] ?? ''))
  })
  return out
}

export function loadStoredTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const list = JSON.parse(raw)
      return Array.isArray(list) ? list : []
    }
  } catch (_) {}
  return []
}

export function saveStoredTemplates(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (_) {}
}
