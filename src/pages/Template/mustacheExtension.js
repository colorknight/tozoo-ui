import { ViewPlugin, Decoration } from '@codemirror/view'

const OPEN_RE = /\{\{#(\w+)\}\}/g
const CLOSE_RE = /\{\{\/(\w+)\}\}/g
const VAR_RE = /\{\{([^#/][^}]*)\}\}/g

function findAllTags(doc) {
  const text = doc.toString()
  const tags = []
  let m
  OPEN_RE.lastIndex = 0
  while ((m = OPEN_RE.exec(text)) !== null) {
    tags.push({ from: m.index, to: m.index + m[0].length, key: m[1], type: 'open' })
  }
  CLOSE_RE.lastIndex = 0
  while ((m = CLOSE_RE.exec(text)) !== null) {
    tags.push({ from: m.index, to: m.index + m[0].length, key: m[1], type: 'close' })
  }
  VAR_RE.lastIndex = 0
  while ((m = VAR_RE.exec(text)) !== null) {
    tags.push({ from: m.index, to: m.index + m[0].length, type: 'var', path: m[1] })
  }
  tags.sort((a, b) => a.from - b.from)
  return tags
}

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

function buildPairs(text) {
  const opens = []
  const pairs = []
  let m
  OPEN_RE.lastIndex = 0
  while ((m = OPEN_RE.exec(text)) !== null) {
    opens.push({ key: m[1], from: m.index, to: m.index + m[0].length })
  }
  for (const op of opens) {
    const closeIdx = findMatchingCloseIndex(text, op.key, op.from)
    if (closeIdx !== -1) {
      const closeTag = `{{/${op.key}}}`
      pairs.push({
        key: op.key,
        openFrom: op.from,
        openTo: op.to,
        closeFrom: closeIdx,
        closeTo: closeIdx + closeTag.length
      })
    }
  }
  return pairs
}

function getTagAtPos(tags, pos) {
  for (const t of tags) {
    if (pos >= t.from && pos <= t.to) return t
  }
  return null
}

function findMatchingRange(pairs, pos) {
  for (const p of pairs) {
    if (pos >= p.openFrom && pos <= p.openTo) return { from: p.closeFrom, to: p.closeTo }
    if (pos >= p.closeFrom && pos <= p.closeTo) return { from: p.openFrom, to: p.openTo }
  }
  return null
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/* 统一饱和度与明度，色相均匀分布，柔和好认 */
const VIVID_PALETTE = [
  '#1971c2', '#2f9e44', '#b4942e', '#e8590c', '#c92a2a', '#9c36b5',
  '#5c7cfa', '#0ca678', '#e67700', '#d6336c', '#5f3dc4', '#087f5b'
]

function colorForKey(key) {
  return VIVID_PALETTE[hashStr(String(key)) % VIVID_PALETTE.length]
}

export const mustacheHighlight = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view
      this.decorations = this.buildDecos(view)
    }

    buildDecos(view) {
      const doc = view.state.doc
      const text = doc.toString()
      const decos = []
      const tags = findAllTags(doc)
      const pairs = buildPairs(text)
      const main = view.state.selection.main
      const pos = main.head
      const currentTag = getTagAtPos(tags, pos)
      const matchRange = findMatchingRange(pairs, pos)
      const pairKeyByOpen = new Map()
      const pairKeyByClose = new Map()
      pairs.forEach((p) => {
        pairKeyByOpen.set(`${p.openFrom}-${p.openTo}`, p.key)
        pairKeyByClose.set(`${p.closeFrom}-${p.closeTo}`, p.key)
      })

      for (const t of tags) {
        const isMatch =
          (currentTag && t.from === currentTag.from && t.to === currentTag.to) ||
          (matchRange && t.from === matchRange.from && t.to === matchRange.to)
        if (t.type === 'open') {
          const key = pairKeyByOpen.get(`${t.from}-${t.to}`)
          const color = key != null ? colorForKey(key) : '#64748b'
          const cls = isMatch ? 'cm-mustache-block cm-mustache-bracket-match' : 'cm-mustache-block'
          decos.push(Decoration.mark({ class: cls, attributes: { style: `color: ${color}` } }).range(t.from, t.to))
        } else if (t.type === 'close') {
          const key = pairKeyByClose.get(`${t.from}-${t.to}`)
          const color = key != null ? colorForKey(key) : '#64748b'
          const cls = isMatch ? 'cm-mustache-block cm-mustache-bracket-match' : 'cm-mustache-block'
          decos.push(Decoration.mark({ class: cls, attributes: { style: `color: ${color}` } }).range(t.from, t.to))
        } else {
          const path = t.path != null ? t.path : ''
          const color = colorForKey(path || 'var')
          decos.push(Decoration.mark({ class: 'cm-mustache-var', attributes: { style: `color: ${color}` } }).range(t.from, t.to))
        }
      }
      return Decoration.set(decos, true)
    }

    update(update) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = this.buildDecos(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
)
