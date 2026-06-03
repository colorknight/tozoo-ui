import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createAgent, getAgentById, updateAgent } from '../../api/agents'
import { searchTemplates } from '../../api/templates'
import { buildDataFromResponse, renderTemplateWithData } from '../Template/templateEditorUtils'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './AgentForm.css'

function AgentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: '',
    welcomeMessage: '',
    enabled: true,
    showHttpConfig: false,
    httpConfig: {
      url: '',
      method: 'POST',
      headers: [{ key: '', value: '', type: 'string' }],
      params: [{ key: '', value: '', type: 'string' }],
      bodyType: 'json',
      bodyTemplate: '{"messages": ${messages}}',
      systemPrompt: '',
      targetPath: '',
      resultSample: '',
      messageField: 'content'
    }
  })

  const loadAgent = async (agentId) => {
    try {
      const data = await getAgentById(agentId)
      const config = data.requestConfig || {}
      
      let headers = [{ key: '', value: '', type: 'string' }]
      let params = [{ key: '', value: '', type: 'string' }]
      
      if (config.requestHeaders) {
        try {
          const parsed = JSON.parse(config.requestHeaders)
          headers = Object.entries(parsed).map(([key, value]) => ({ key, value, type: 'string' }))
          if (headers.length === 0) headers = [{ key: '', value: '', type: 'string' }]
        } catch {}
      }
      
      if (config.requestParams) {
        try {
          const parsed = JSON.parse(config.requestParams)
          params = Object.entries(parsed).map(([key, value]) => ({ key, value, type: 'string' }))
          if (params.length === 0) params = [{ key: '', value: '', type: 'string' }]
        } catch {}
      }

      setFormData({
        name: data.name || '',
        description: data.description || '',
        tags: data.tags || '',
        welcomeMessage: data.welcomeMessage || '',
        enabled: data.enabled ?? true,
        showHttpConfig: true,
        httpConfig: {
          url: config.requestUrl || '',
          method: config.requestMethod || 'POST',
          headers,
          params,
          bodyType: 'json',
          bodyTemplate: config.requestBody || '{"messages": ${messages}}',
          systemPrompt: data.systemPrompt || '',
          targetPath: config.targetPath || '',
          resultSample: config.resultSample || '',
          messageField: config.messageField || 'content'
        }
      })
      if (data.outputTemplate && data.outputTemplate.id) {
        setSelectedOutputTemplate(data.outputTemplate)
      } else {
        setSelectedOutputTemplate(null)
      }
    } catch (error) {
      alert('加载失败: ' + error.message)
    }
  }

  useEffect(() => {
    if (id) {
      loadAgent(id)
    }
  }, [id])

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await searchTemplates({ keyword: '', page: 0, size: 200 })
        const list = Array.isArray(data) ? data : (data?.content ?? [])
        setTemplateList(list)
      } catch {
        setTemplateList([])
      }
    }
    fetchTemplates()
  }, [])

  const [templateList, setTemplateList] = useState([])
  const [selectedOutputTemplate, setSelectedOutputTemplate] = useState(null)
  const [testMessages, setTestMessages] = useState([])
  const [testInput, setTestInput] = useState('')
  const [lastRequest, setLastRequest] = useState(null)
  const [testFullscreen, setTestFullscreen] = useState(false)
  const [formFullscreen, setFormFullscreen] = useState(false)
  const [activeField, setActiveField] = useState('bodyTemplate')
  const [activeParamIdx, setActiveParamIdx] = useState(null)
  const [varSectionFixed, setVarSectionFixed] = useState(false)
  const [fixedStyle, setFixedStyle] = useState({})
  const [bodyFormatted, setBodyFormatted] = useState(false)
  const varSectionRef = useRef(null)
  const bodyTextareaRef = useRef(null)

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking && varSectionRef.current) {
        ticking = true
        requestAnimationFrame(() => {
          const container = document.getElementById('http-config-section')
          if (container) {
            const containerRect = container.getBoundingClientRect()
            const varRect = varSectionRef.current.getBoundingClientRect()
            const shouldFixed = varRect.bottom <= 60
            setVarSectionFixed(shouldFixed)
            if (shouldFixed) {
              setFixedStyle({
                left: varRect.left,
                width: varRect.width
              })
            }
          }
          ticking = false
        })
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  const valueTypes = [
    { label: '字符串', value: 'string' },
    { label: '数字', value: 'number' },
    { label: '布尔', value: 'boolean' },
    { label: '对象', value: 'object' }
  ]

  const getBodyPreview = () => {
    const template = formData.httpConfig.bodyTemplate || ''
    const bodyType = formData.httpConfig.bodyType
    const msgField = formData.httpConfig.messageField || 'content'
    const sampleInput = '最新输入内容'
    const sampleHistory = [
      { role: 'user', [msgField]: '之前消息A' },
      { role: 'assistant', [msgField]: '之前回复B' }
    ]
    const sampleCurrentMessage = { role: 'user', [msgField]: '当前输入内容' }

    const hasMessages = template.includes('${messages}')
    const hasHistory = template.includes('${history}')
    const hasContent = template.includes('${content}')
    const hasMessage = template.includes('${message}')
    const hasSystem = template.includes('${system}')
    const hasAppend = template.includes('${append}')

    const sampleSystem = formData.httpConfig.systemPrompt 
      ? { role: 'system', [msgField]: formData.httpConfig.systemPrompt }
      : null
    const systemValue = sampleSystem ? JSON.stringify(sampleSystem) : ''
    const appendValue = JSON.stringify(sampleHistory.concat(sampleCurrentMessage))
    const msgValueWithSystem = sampleSystem 
      ? JSON.stringify([sampleSystem].concat(sampleHistory.concat(sampleCurrentMessage)))
      : JSON.stringify(sampleHistory.concat(sampleCurrentMessage))
    const histValueWithSystem = sampleSystem 
      ? JSON.stringify([sampleSystem].concat(sampleHistory))
      : JSON.stringify(sampleHistory)
    const msgValue = JSON.stringify(sampleHistory.concat(sampleCurrentMessage))
    const histValue = JSON.stringify(sampleHistory)
    const msgObjValue = JSON.stringify(sampleCurrentMessage)

    let result = template
    result = result.replace(/\$\{messages\}/g, msgValueWithSystem)
    result = result.replace(/\$\{history\}/g, histValueWithSystem)
    result = result.replace(/\$\{content\}/g, sampleCurrentMessage[msgField])
    result = result.replace(/\$\{message\}/g, msgObjValue)
    result = result.replace(/\$\{system\}/g, systemValue)
    result = result.replace(/\$\{append\}/g, appendValue)

    let colored = template
      .replace(/\$\{messages\}/g, '[[MESSAGES]]')
      .replace(/\$\{history\}/g, '[[HISTORY]]')
      .replace(/\$\{content\}/g, '[[CONTENT]]')
      .replace(/\$\{message\}/g, '[[MESSAGE]]')
      .replace(/\$\{system\}/g, '[[SYSTEM]]')
      .replace(/\$\{append\}/g, '[[APPEND]]')

    if (bodyFormatted) {
      try {
        result = JSON.stringify(JSON.parse(result), null, 2)
        colored = colored
          .replace('[[MESSAGES]]', msgValueWithSystem)
          .replace('[[HISTORY]]', histValueWithSystem)
          .replace('[[CONTENT]]', sampleCurrentMessage[msgField])
          .replace('[[MESSAGE]]', msgObjValue)
          .replace('[[SYSTEM]]', systemValue)
          .replace('[[APPEND]]', appendValue)
        colored = JSON.stringify(JSON.parse(colored), null, 2)
        const fmtMsg = JSON.stringify(JSON.parse(msgValueWithSystem), null, 2)
        const fmtHist = JSON.stringify(JSON.parse(histValueWithSystem), null, 2)
        const fmtMsgObj = JSON.stringify(JSON.parse(msgObjValue), null, 2)
        const fmtSystem = systemValue ? JSON.stringify(JSON.parse(systemValue), null, 2) : ''
        const fmtAppend = JSON.stringify(JSON.parse(appendValue), null, 2)
        colored = colored.replace(fmtMsg, `<mark style="color:#e74c3c;background:#fde">${fmtMsg}</mark>`)
        colored = colored.replace(fmtHist, `<mark style="color:#3498db;background:#def">${fmtHist}</mark>`)
        colored = colored.replace(`"${sampleCurrentMessage[msgField]}"`, `<mark style="color:#27ae60;background:#efe">"${sampleCurrentMessage[msgField]}"</mark>`)
        colored = colored.replace(fmtMsgObj, `<mark style="color:#9b59b6;background:#eef">${fmtMsgObj}</mark>`)
        if (fmtSystem) {
          colored = colored.replace(fmtSystem, `<mark style="color:#f39c12;background:#fde8">${fmtSystem}</mark>`)
        }
        colored = colored.replace(fmtAppend, `<mark style="color:#e67e22;background:#fde8">${fmtAppend}</mark>`)
      } catch {}
    } else {
      colored = colored
        .replace('[[MESSAGES]]', `<mark style="color:#e74c3c;background:#fde">${msgValue}</mark>`)
        .replace('[[HISTORY]]', `<mark style="color:#3498db;background:#def">${histValue}</mark>`)
        .replace('[[CONTENT]]', `<mark style="color:#27ae60;background:#efe">${sampleCurrentMessage[msgField]}</mark>`)
        .replace('[[MESSAGE]]', `<mark style="color:#9b59b6;background:#eef">${msgObjValue}</mark>`)
        .replace('[[SYSTEM]]', systemValue ? `<mark style="color:#f39c12;background:#fde8">${systemValue}</mark>` : '')
        .replace('[[APPEND]]', `<mark style="color:#e67e22;background:#fde8">${appendValue}</mark>`)
        .replace('[[SYSTEM]]', systemValue ? `<mark style="color:#f39c12;background:#fde8">${systemValue}</mark>` : '')
    }

    return { plain: result, colored }
  }

  const requestMethods = [
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' },
    { label: 'PUT', value: 'PUT' },
    { label: 'DELETE', value: 'DELETE' }
  ]

  const variables = [
    { label: 'System提示词', variable: '${system}', color: '#f39c12', sample: `{"role":"system","${formData.httpConfig.messageField || 'content'}":"你是一个专业的助手"}`, desc: 'System消息对象，非必填' },
    { label: '追加消息', variable: '${append}', color: '#e67e22', sample: `[{"role":"user","${formData.httpConfig.messageField || 'content'}":"你好"}]`, desc: '追加到数组的消息' },
    { label: '消息历史(含当前)', variable: '${messages}', color: '#e74c3c', sample: `[{"role":"user","${formData.httpConfig.messageField || 'content'}":"你好"},{"role":"assistant","${formData.httpConfig.messageField || 'content'}":"你好"}]`, desc: 'JSON数组，含role和content' },
    { label: '仅历史消息', variable: '${history}', color: '#3498db', sample: `[{"role":"user","${formData.httpConfig.messageField || 'content'}":"你好"}]`, desc: 'JSON数组，不含当前消息' },
    { label: '当前消息内容', variable: '${content}', color: '#27ae60', sample: '今天天气真好', desc: '当前用户输入的纯文本' },
    { label: '当前消息(完整)', variable: '${message}', color: '#9b59b6', sample: `{"role":"user","${formData.httpConfig.messageField || 'content'}":"你好"}`, desc: '当前消息的JSON对象' }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    const headersObj = {}
    formData.httpConfig.headers.filter(h => h.key).forEach(h => {
      headersObj[h.key] = h.value
    })

    const paramsObj = {}
    formData.httpConfig.params.filter(p => p.key).forEach(p => {
      paramsObj[p.key] = p.value
    })

    const payload = {
      name: formData.name,
      description: formData.description,
      tags: formData.tags,
      welcomeMessage: formData.welcomeMessage,
      enabled: formData.enabled,
      systemPrompt: formData.httpConfig.systemPrompt || '',
      requestConfig: {
        requestUrl: formData.httpConfig.url || '',
        requestMethod: formData.httpConfig.method || 'POST',
        requestHeaders: JSON.stringify(headersObj),
        requestParams: JSON.stringify(paramsObj),
        requestBody: formData.httpConfig.bodyTemplate || '',
        targetPath: formData.httpConfig.targetPath || '',
        resultSample: formData.httpConfig.resultSample || '',
        messageField: formData.httpConfig.messageField || 'content'
      }
    }
    if (selectedOutputTemplate && selectedOutputTemplate.id) {
      payload.outputTemplate = selectedOutputTemplate
    }

    try {
      if (isEdit) {
        await updateAgent(id, payload)
      } else {
        await createAgent(payload)
      }
      navigate('/agent')
    } catch (error) {
      alert(isEdit ? '更新失败: ' : '创建失败: ' + error.message)
    }
  }

  const insertVariable = (variable) => {
    let insertVal = variable
    if (formData.httpConfig.bodyType === 'json' && (variable === '${content}' || variable === '${message}')) {
      insertVal = `"${variable}"`
    }
    
    if (activeField === 'params' && activeParamIdx !== null) {
      const params = [...formData.httpConfig.params]
      params[activeParamIdx] = { ...params[activeParamIdx], value: (params[activeParamIdx].value || '') + insertVal }
      setFormData({
        ...formData,
        httpConfig: { ...formData.httpConfig, params }
      })
    } else if (activeField === 'bodyTemplate' && bodyTextareaRef.current) {
      const textarea = bodyTextareaRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const template = formData.httpConfig.bodyTemplate || ''
      const newValue = template.slice(0, start) + insertVal + template.slice(end)
      setFormData({
        ...formData,
        httpConfig: {
          ...formData.httpConfig,
          bodyTemplate: newValue
        }
      })
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + insertVal.length, start + insertVal.length)
      }, 0)
    } else {
      const template = formData.httpConfig.bodyTemplate || ''
      setFormData({
        ...formData,
        httpConfig: {
          ...formData.httpConfig,
          bodyTemplate: template + variable
        }
      })
    }
  }

  const extractParamsFromUrl = () => {
    try {
      const url = formData.httpConfig.url
      if (!url) return
      
      const params = []
      
      // 用正则直接从原始URL中提取 path 和 query 中的变量
      // 提取 path 中的 ${xxx}
      const pathMatch = url.match(/https?:\/\/[^/]+(\/[^?]*)/)
      const path = pathMatch ? pathMatch[1] : ''
      const pathVars = (path.match(/\$\{(\w+)\}/g) || []).map(v => v.replace(/\$\{|\}/g, ''))
      
      pathVars.forEach(varName => {
        params.push({ key: varName, value: '', type: 'string' })
      })
      
      // 提取 query 中的参数（包括普通参数和变量形式）
      const queryMatch = url.match(/\?(.+)$/)
      if (queryMatch) {
        const queryStr = queryMatch[1]
        queryStr.split('&').forEach(item => {
          const [rawKey, value = ''] = item.split('=')
          if (rawKey) {
            // 检查 key 是否是 ${xxx} 形式
            const keyVarMatch = rawKey.match(/^\$\{(\w+)\}$/)
            if (keyVarMatch) {
              params.push({ key: keyVarMatch[1], value: '', type: 'string' })
            } else {
              // 检查 value 是否是 ${xxx} 形式
              const valueVarMatch = value.match(/^\$\{(\w+)\}$/)
              if (valueVarMatch) {
                params.push({ key: valueVarMatch[1], value: '', type: 'string' })
              } else {
                params.push({ key: rawKey, value, type: 'string' })
              }
            }
          }
        })
      }
      
      // 合并到现有参数（保留已有的值）
      const existingParams = formData.httpConfig.params
      const mergedParams = params.map(p => {
        const existing = existingParams.find(e => e.key === p.key)
        return existing ? { ...p, value: existing.value } : p
      })
      
      setFormData({
        ...formData,
        httpConfig: {
          ...formData.httpConfig,
          params: mergedParams
        }
      })
    } catch {
      alert('无效的URL格式')
    }
  }

  const formatBodyTemplate = () => {
    const template = formData.httpConfig.bodyTemplate || ''
    const bodyType = formData.httpConfig.bodyType
    
    if (bodyType === 'json') {
      try {
        const formatted = JSON.stringify(JSON.parse(template), null, 2)
        setFormData({
          ...formData,
          httpConfig: {
            ...formData.httpConfig,
            bodyTemplate: formatted
          }
        })
      } catch {
        alert('无效的JSON格式')
      }
    } else if (bodyType === 'xml') {
      try {
        const formatted = template
          .replace(/>\s*</g, '>\n<')
          .split('\n')
          .map(line => '  ' + line)
          .join('\n')
        setFormData({
          ...formData,
          httpConfig: {
            ...formData.httpConfig,
            bodyTemplate: formatted
          }
        })
      } catch {
        alert('格式化失败')
      }
    } else {
      alert('Text 格式无需格式化')
    }
  }

  // 从 <tagName>...</tagName> 中取出内容（与 Chat 页一致），targetPath 末段为任意标签名时使用
  const extractFromTag = (str, tagName) => {
    if (typeof str !== 'string') return str
    if (!tagName) return str
    let content = str
    const tag = String(tagName).replace(/[^a-zA-Z0-9_-]/g, '')
    if (tag) {
      const re = new RegExp(`<\\s*${tag}[^>]*>([\\s\\S]*?)<\\s*\\/\\s*${tag}\\s*>`, 'i')
      const match = content.match(re)
      if (match) content = match[1].trim()
    }
    content = content.split('\n').map(line => line.replace(/^[ \t]{1,3}/, '')).join('\n')
    return content
  }

  const getByPath = (obj, path) => {
    const keys = path.split('.').map(k => {
      const arrayMatch = k.match(/^(\w+)\[(-?\d+)\]$/)
      if (arrayMatch) {
        return { key: arrayMatch[1], index: parseInt(arrayMatch[2]) }
      }
      const arrayOnlyMatch = k.match(/^\[(-?\d+)\]$/)
      if (arrayOnlyMatch) {
        return { index: parseInt(arrayOnlyMatch[1]) }
      }
      return k
    })
    let result = obj
    for (const k of keys) {
      if (result === undefined || result === null) return undefined
      if (typeof k === 'object') {
        if ('key' in k && 'index' in k) {
          const arr = result[k.key]
          const idx = k.index === -1 ? arr.length - 1 : k.index
          result = arr?.[idx]
        } else if ('index' in k) {
          const idx = k.index === -1 ? result.length - 1 : k.index
          result = result[idx]
        }
      } else {
        result = result[k]
      }
    }
    return result
  }

  const handleTest = () => {
    if (!testInput.trim()) return
    
    const template = formData.httpConfig.bodyTemplate || ''
    const hasVariables = template.includes('${messages}') || template.includes('${history}') || template.includes('${content}') || template.includes('${message}') || template.includes('${append}')
    const hasSystem = template.includes('${system}')
    
    const msgField = formData.httpConfig.messageField || 'content'
    const systemMsg = formData.httpConfig.systemPrompt 
      ? { role: 'system', [msgField]: formData.httpConfig.systemPrompt }
      : null
    const systemValue = systemMsg ? JSON.stringify(systemMsg) : ''
    
    let messagesForApi
    if (hasVariables) {
      const userMsg = { role: 'user', [msgField]: testInput }
      const newMessages = [...testMessages, userMsg]
      messagesForApi = newMessages
    } else {
      messagesForApi = [{ role: 'user', [msgField]: testInput }]
    }
    const appendValue = JSON.stringify(messagesForApi)
    const msgValueWithSystem = systemMsg 
      ? JSON.stringify([systemMsg].concat(messagesForApi))
      : JSON.stringify(messagesForApi)
    
    const historyForApi = testMessages.map(msg => ({
      role: msg.role,
      [msgField]: msg[msgField] || msg.content || msg.message
    }))
    const histValueWithSystem = systemMsg 
      ? JSON.stringify([systemMsg].concat(historyForApi))
      : JSON.stringify(historyForApi)
    
    const userMsg = { role: 'user', [msgField]: testInput, id: Date.now() }
    const newTestMessages = [...testMessages, userMsg]
    setTestMessages(newTestMessages)
    setTestInput('')

    let bodyStr = template
      .replace(/\$\{messages\}/g, msgValueWithSystem)
      .replace(/\$\{history\}/g, histValueWithSystem)
      .replace(/\$\{content\}/g, testInput)
      .replace(/\$\{message\}/g, JSON.stringify({ role: 'user', [msgField]: testInput }))
      .replace(/\$\{system\}/g, systemValue)
      .replace(/\$\{append\}/g, appendValue)

    if (!hasVariables) {
      try {
        const parsed = JSON.parse(template)
        parsed.messages = messagesForApi
        bodyStr = JSON.stringify(parsed, null, 2)
      } catch {
        bodyStr = JSON.stringify({ messages: messagesForApi }, null, 2)
      }
    }

    const paramsWithVars = formData.httpConfig.params.filter(p => p.key)
    const params = paramsWithVars.map(p => ({
      ...p,
      value: p.value
        .replace(/\$\{messages\}/g, JSON.stringify(messagesForApi))
        .replace(/\$\{history\}/g, JSON.stringify(historyForApi))
        .replace(/\$\{content\}/g, testInput)
        .replace(/\$\{message\}/g, JSON.stringify({ role: 'user', [msgField]: testInput }))
    }))

    const requestInfo = {
      url: formData.httpConfig.url,
      method: formData.httpConfig.method,
      headers: formData.httpConfig.headers.filter(h => h.key),
      params: params,
      body: bodyStr
    }
    setLastRequest(requestInfo)
    
    const sendRequest = async () => {
      try {
        let url = formData.httpConfig.url
        const queryParams = new URLSearchParams()
        params.forEach(p => {
          if (p.key) queryParams.append(p.key, p.value)
        })
        if (queryParams.toString()) {
          url += (url.includes('?') ? '&' : '?') + queryParams.toString()
        }

        const headers = {}
        formData.httpConfig.headers.filter(h => h.key).forEach(h => {
          headers[h.key] = h.value
        })

        const fetchOptions = {
          method: formData.httpConfig.method,
          headers
        }

        if (formData.httpConfig.method !== 'GET' && formData.httpConfig.method !== 'HEAD') {
          fetchOptions.body = bodyStr
          if (!headers['Content-Type']) {
            headers['Content-Type'] = formData.httpConfig.bodyType === 'json' ? 'application/json' : 'text/plain'
          }
          fetchOptions.headers = headers
        }

        const response = await fetch(url, fetchOptions)
        const responseText = await response.text()
        
        let displayContent = responseText
        const targetPath = formData.httpConfig.targetPath?.trim()
        if (targetPath) {
          const pathParts = targetPath.split('.')
          let json = null
          try {
            json = JSON.parse(responseText)
            if (typeof json === 'string') json = JSON.parse(json)
          } catch {}
          if (json !== null) {
            let value = getByPath(json, targetPath)
            if (value !== undefined) {
              displayContent = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
            } else if (pathParts.length >= 2) {
              value = getByPath(json, pathParts.slice(0, -1).join('.'))
              if (value !== undefined) {
                displayContent = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
                if (typeof displayContent === 'string') displayContent = extractFromTag(displayContent, pathParts[pathParts.length - 1])
              } else {
                displayContent = extractFromTag(responseText, pathParts[pathParts.length - 1])
              }
            } else {
              displayContent = extractFromTag(responseText, pathParts[0])
            }
          } else {
            displayContent = extractFromTag(responseText, pathParts[pathParts.length - 1])
          }
        }
        const msgField = formData.httpConfig.messageField || 'content'
        let finalContent = displayContent
        let messageFormat
        const template = selectedOutputTemplate
        if (template && (template.content || '').trim()) {
          let dataObj
          let json = null
          try {
            json = JSON.parse(responseText)
            if (typeof json === 'string') json = JSON.parse(json)
          } catch {
            // ignore parse failure, fallback below
          }

          if (json !== null) {
            dataObj = json
            const targetPath = formData.httpConfig.targetPath?.trim()
            if (targetPath) {
              const extracted = getByPath(json, targetPath)
              if (extracted !== undefined && extracted !== null) {
                if (typeof extracted === 'object' && !Array.isArray(extracted)) {
                  dataObj = extracted
                } else if (typeof extracted === 'string' && extracted.trim()) {
                  try {
                    const parsed = JSON.parse(extracted)
                    if (parsed !== null && typeof parsed === 'object') {
                      dataObj = parsed
                    } else {
                      dataObj = { content: extracted }
                    }
                  } catch {
                    dataObj = { content: extracted }
                  }
                } else {
                  dataObj = { content: String(extracted) }
                }
              }
            }
          } else {
            dataObj = { content: displayContent }
          }
          const variables = template.variables || []
          const { single, list } = buildDataFromResponse(dataObj, variables)
          finalContent = renderTemplateWithData(template.content, variables, { single, list })
          messageFormat = (template.format === 'TEXT' || template.format === 'text') ? 'TEXT' : 'MARKDOWN'
        }
        setTestMessages(prev => [...prev, {
          role: 'assistant',
          [msgField]: finalContent,
          id: Date.now() + 1,
          ...(messageFormat && { format: messageFormat })
        }])
      } catch (error) {
        setTestMessages(prev => [...prev, {
          role: 'assistant',
          [msgField]: `请求失败: ${error.message}`,
          id: Date.now() + 1
        }])
      }
    }

    sendRequest()
  }

  const addHeader = () => {
    setFormData({
      ...formData,
      httpConfig: {
        ...formData.httpConfig,
        headers: [...formData.httpConfig.headers, { key: '', value: '', type: 'string' }]
      }
    })
  }

  const updateHeader = (index, field, value) => {
    const headers = [...formData.httpConfig.headers]
    headers[index] = { ...headers[index], [field]: value }
    setFormData({ ...formData, httpConfig: { ...formData.httpConfig, headers } })
  }

  const removeHeader = (index) => {
    const headers = formData.httpConfig.headers.filter((_, i) => i !== index)
    setFormData({ ...formData, httpConfig: { ...formData.httpConfig, headers } })
  }

  const addParam = () => {
    setFormData({
      ...formData,
      httpConfig: {
        ...formData.httpConfig,
        params: [...formData.httpConfig.params, { key: '', value: '', type: 'string' }]
      }
    })
  }

  const updateParam = (index, field, value) => {
    const params = [...formData.httpConfig.params]
    params[index] = { ...params[index], [field]: value }
    setFormData({ ...formData, httpConfig: { ...formData.httpConfig, params } })
  }

  const removeParam = (index) => {
    const params = formData.httpConfig.params.filter((_, i) => i !== index)
    setFormData({ ...formData, httpConfig: { ...formData.httpConfig, params } })
  }

  return (
    <div className="agent-form-page">
      <div className="form-layout" style={{ position: 'relative' }}>
        <div className={`form-container ${formFullscreen ? 'fullscreen' : ''} ${testFullscreen ? 'hidden' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h1 style={{ margin: 0 }}>{isEdit ? '编辑智能体' : '新增智能体'}</h1>
            {formFullscreen && (
              <button 
                type="button"
                className="params-toggle"
                onClick={() => setFormFullscreen(false)}
              >
                ◀ 返回
              </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="form-actions sticky-top">
              <button type="button" className="cancel-btn" onClick={() => navigate('/agent')}>
                取消
              </button>
              <button type="submit" className="submit-btn">
                保存
              </button>
            </div>

            <div className="form-group">
              <label>名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入智能体名称"
                required
              />
            </div>

            <div className="form-group">
              <label>描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="请输入智能体描述"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>欢迎词</label>
              <input
                type="text"
                value={formData.welcomeMessage}
                onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                placeholder="请输入欢迎词，将在对话开始时显示"
              />
            </div>

            <div className="form-group">
              <label>输出模板</label>
              <select
                value={selectedOutputTemplate?.id ?? ''}
                onChange={(e) => {
                  const templateId = e.target.value
                  if (!templateId) {
                    setSelectedOutputTemplate(null)
                    return
                  }
                  const template = templateList.find((t) => t.id === templateId)
                  setSelectedOutputTemplate(template || null)
                }}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
              >
                <option value="">不选择模板</option>
                {templateList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.alias || '未命名模板'}
                  </option>
                ))}
              </select>
              <span className="form-hint">可选，用于格式化智能体回复的展示</span>
            </div>

            <div 
              className="http-config-toggle"
              onClick={() => setFormData({ ...formData, showHttpConfig: !formData.showHttpConfig })}
            >
              <span>Agent请求配置</span>
              <span className={`toggle-icon ${formData.showHttpConfig ? 'open' : ''}`}>▼</span>
            </div>

            {formData.showHttpConfig && (
              <div className="http-config-section" id="http-config-section">
                <div className="form-row">
                  <div className="form-group" style={{ width: '100px' }}>
                    <label>请求方法</label>
                    <select
                      value={formData.httpConfig.method}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        httpConfig: { ...formData.httpConfig, method: e.target.value }
                      })}
                    >
                      {requestMethods.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label>URL *</label>
                      <input
                        type="url"
                        value={formData.httpConfig.url}
                        onChange={(e) => {
                          const newUrl = e.target.value
                          // 自动提取参数
                          const params = []
                          const pathMatch = newUrl.match(/https?:\/\/[^/]+(\/[^?]*)/)
                          const path = pathMatch ? pathMatch[1] : ''
                          const pathVars = (path.match(/\{\{(\w+)\}\}/g) || []).map(v => v.replace(/\{\{|\}\}/g, ''))
                          
                          pathVars.forEach(varName => {
                            params.push({ key: varName, value: '', type: 'string' })
                          })
                          
                          const queryMatch = newUrl.match(/\?(.+)$/)
                          if (queryMatch) {
                            const queryStr = queryMatch[1]
                            queryStr.split('&').forEach(item => {
                              const [rawKey, value = ''] = item.split('=')
                              if (rawKey) {
                                const keyVarMatch = rawKey.match(/^\{\{(\w+)\}\}$/)
                                if (keyVarMatch) {
                                  params.push({ key: keyVarMatch[1], value: '', type: 'string' })
                                } else {
                                  const valueVarMatch = value.match(/^\{\{(\w+)\}\}$/)
                                  if (valueVarMatch) {
                                    params.push({ key: valueVarMatch[1], value: '', type: 'string' })
                                  } else if (value) {
                                    params.push({ key: rawKey, value, type: 'string' })
                                  }
                                }
                              }
                            })
                          }
                          
                          const existingParams = formData.httpConfig.params
                          const mergedParams = params.map(p => {
                            const existing = existingParams.find(e => e.key === p.key)
                            return existing ? { ...p, value: existing.value } : p
                          })
                          
                          setFormData({ 
                            ...formData, 
                            httpConfig: { 
                              ...formData.httpConfig, 
                              url: newUrl,
                              params: mergedParams
                            }
                          })
                        }}
                        placeholder="https://api.example.com/chat"
                      />
                    </div>
                  </div>
                  </div>

                <div className="config-block">
                  <div className="config-header">
                    <span>System 提示词</span>
                  </div>
                  <input
                    type="text"
                    placeholder="可选，填写后可在模板中使用 ${system} 变量"
                    value={formData.httpConfig.systemPrompt || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      httpConfig: { ...formData.httpConfig, systemPrompt: e.target.value }
                    })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                  />
                </div>

                <div className="config-block">
                  <div className="config-header">
                    <span>响应路径</span>
                  </div>
                  <input
                    type="text"
                    placeholder="如: choices.0.message.content"
                    value={formData.httpConfig.targetPath || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      httpConfig: { ...formData.httpConfig, targetPath: e.target.value }
                    })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                  />
                </div>

                <div className="config-block">
                  <div className="config-header">
                    <span>结果示例</span>
                  </div>
                  <textarea
                    placeholder="粘贴API返回的JSON示例，用于预览响应路径提取结果"
                    value={formData.httpConfig.resultSample || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      httpConfig: { ...formData.httpConfig, resultSample: e.target.value }
                    })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d9d9d9', fontFamily: 'monospace', fontSize: '12px', minHeight: '80px' }}
                  />
                </div>

                <div 
                  ref={varSectionRef}
                  className="config-block var-section"
                  id="var-section-original"
                >
                  <div style={{ marginBottom: '8px', fontSize: '13px', color: '#333', fontWeight: 500 }}>
                    可用变量 <span style={{ fontWeight: 'normal', color: '#999', fontSize: '12px' }}>(点击插入模板)</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {variables.map(v => (
                      <button 
                        key={v.variable} 
                        type="button"
                        className="var-btn"
                        onClick={() => insertVariable(v.variable)}
                        title={v.desc}
                        style={{ borderColor: v.color, color: v.color }}
                      >
                        {v.variable}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {variables.map(v => (
                      <div key={v.variable} style={{ fontSize: '11px', color: '#999' }}>
                        <code style={{ color: v.color, marginRight: '8px' }}>{v.variable}</code>
                        <span>{v.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {varSectionFixed && (
                  <div 
                    id="var-section-fixed"
                    style={{ 
                      position: 'fixed', 
                      top: '60px',
                      left: fixedStyle.left,
                      width: fixedStyle.width,
                      zIndex: 1000, 
                      background: '#fff', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      padding: '12px',
                      borderRadius: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {variables.map(v => (
                        <button 
                          key={v.variable} 
                          type="button"
                          className="var-btn"
                          onClick={() => insertVariable(v.variable)}
                          title={v.desc}
                          style={{ borderColor: v.color, color: v.color }}
                        >
                          {v.variable}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="config-block">
                  <div className="config-header">
                    <span>Headers</span>
                    <button type="button" className="add-param-btn" onClick={addHeader}>+ 添加</button>
                  </div>
                  {formData.httpConfig.headers.map((header, idx) => (
                    <div key={idx} className="config-row params-row">
                      <input
                        type="text"
                        placeholder="Key"
                        value={header.key}
                        onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={header.value}
                        onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                      />
                      <button type="button" className="delete-btn" onClick={() => removeHeader(idx)}>×</button>
                    </div>
                  ))}
                </div>

                <div className="config-block">
                  <div className="config-header">
                    <span>Query Params</span>
                  </div>
                  {formData.httpConfig.params.map((param, idx) => (
                    <div key={idx} className="config-row params-row">
                      <input
                        type="text"
                        placeholder="Key"
                        value={param.key}
                        onChange={(e) => updateParam(idx, 'key', e.target.value)}
                        onFocus={() => setActiveField('params')}
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={param.value}
                        onChange={(e) => updateParam(idx, 'value', e.target.value)}
                        onFocus={() => {
                          setActiveField('params')
                          setActiveParamIdx(idx)
                        }}
                      />
                      <button type="button" className="delete-btn" onClick={() => removeParam(idx)}>×</button>
                    </div>
                  ))}
                </div>

                <div className="config-block">
                  <div className="config-header">
                    <span>请求体 (Body)</span>
                    <select
                      value={formData.httpConfig.bodyType}
                      onChange={(e) => setFormData({
                        ...formData,
                        httpConfig: { ...formData.httpConfig, bodyType: e.target.value }
                      })}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                    >
                      <option value="none">None</option>
                      <option value="text">Text</option>
                      <option value="json">JSON</option>
                      <option value="xml">XML</option>
                    </select>
                    <select
                      value={formData.httpConfig.messageField || 'content'}
                      onChange={(e) => setFormData({
                        ...formData,
                        httpConfig: { ...formData.httpConfig, messageField: e.target.value }
                      })}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d9d9d9', marginLeft: '8px' }}
                      title="消息内容字段名，部分API使用message而非content"
                    >
                      <option value="content">content</option>
                      <option value="message">message</option>
                    </select>
                    <input
                      type="text"
                      placeholder="消息字段名"
                      value={formData.httpConfig.messageField || 'content'}
                      onChange={(e) => setFormData({
                        ...formData,
                        httpConfig: { ...formData.httpConfig, messageField: e.target.value }
                      })}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d9d9d9', marginLeft: '8px', width: '80px' }}
                      title="自定义消息内容字段名"
                    />
                  </div>
                  {formData.httpConfig.bodyType !== 'none' && (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '6px', fontSize: '12px', color: '#666', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>模板编辑 <span style={{ fontWeight: 'normal', color: '#999', fontSize: '11px' }}>(预览区查看变量效果)</span></span>
                        </div>
                        <textarea
                          ref={bodyTextareaRef}
                          className="body-template"
                          value={formData.httpConfig.bodyTemplate}
                          onChange={(e) => setFormData({
                            ...formData,
                            httpConfig: { ...formData.httpConfig, bodyTemplate: e.target.value }
                          })}
                          onFocus={() => setActiveField('bodyTemplate')}
                          placeholder={formData.httpConfig.bodyType === 'json' ? '{"messages": ${messages}}' : ''}
                          style={{ 
                            flex: 1,
                            minHeight: '140px',
                            width: '100%', 
                            fontFamily: 'monospace', 
                            fontSize: '13px',
                            background: '#fff',
                            color: '#333',
                            border: '1px solid #d9d9d9',
                            resize: 'none',
                            padding: '8px'
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '6px', fontSize: '12px', color: '#666', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>预览</span>
                          <button type="button" onClick={() => setBodyFormatted(!bodyFormatted)} style={{ padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>{bodyFormatted ? '取消格式化' : '格式化'}</button>
                        </div>
                        <pre 
                          style={{ 
                            flex: 1,
                            margin: 0, 
                            padding: '8px', 
                            background: '#fff', 
                            borderRadius: '4px',
                            overflow: 'auto',
                            fontSize: '12px',
                            color: '#333',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            minHeight: '140px',
                            border: '1px solid #d9d9d9'
                          }}
                          dangerouslySetInnerHTML={{ __html: getBodyPreview().colored }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                启用该智能体
              </label>
            </div>

          </form>
        </div>

        <div className={`test-panel ${testFullscreen ? 'fullscreen' : ''} ${formFullscreen ? 'hidden' : ''}`}>
          <div className="test-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {testFullscreen && (
                <button 
                  className="params-toggle"
                  onClick={() => setTestFullscreen(false)}
                  style={{ padding: '4px 8px' }}
                >
                  ▶
                </button>
              )}
              <span className="test-title">测试对话</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {testMessages.length > 0 && (
                <button 
                  className="params-toggle"
                  onClick={() => {
                    setTestMessages([])
                    setLastRequest(null)
                  }}
                >
                  清除会话
                </button>
              )}
              {lastRequest && (
                <button 
                  className="params-toggle"
                  onClick={() => setLastRequest(null)}
                >
                  清空
                </button>
              )}
            </div>

          </div>
          {lastRequest && (
            <div className="test-params">
              <div className="params-item">
                <span className="params-label">URL:</span>
                <span className="params-value">{lastRequest.url}</span>
              </div>
              <div className="params-item">
                <span className="params-label">Method:</span>
                <span className="params-value">{lastRequest.method}</span>
              </div>
              {lastRequest.headers.length > 0 && (
                <div className="params-item">
                  <span className="params-label">Headers:</span>
                  <pre className="params-value">{JSON.stringify(lastRequest.headers, null, 2)}</pre>
                </div>
              )}
              {lastRequest.params.length > 0 && (
                <div className="params-item">
                  <span className="params-label">Params:</span>
                  <pre className="params-value">{JSON.stringify(lastRequest.params, null, 2)}</pre>
                </div>
              )}
              <div className="params-item">
                <span className="params-label">Body:</span>
                <pre className="params-value">{(function() { try { return JSON.stringify(JSON.parse(lastRequest.body), null, 2) } catch { return lastRequest.body } })()}</pre>
              </div>
            </div>
          )}

          <div className="test-messages">
            {testMessages.length === 0 ? (
              <div className="test-empty">请在左侧配置Agent后开始测试</div>
            ) : (
              testMessages.map((msg) => {
                const text = msg.content || msg.message || ''
                const isTextFormat = msg.format === 'TEXT'
                return (
                  <div key={msg.id} className={`test-msg-row ${msg.role}`}>
                    <div className="test-avatar">
                      {msg.role === 'user' ? '我' : 'AI'}
                    </div>
                    <div className="test-msg-content">
                      <div className="test-bubble">
                        {isTextFormat ? (
                          <pre className="test-bubble-text">{text}</pre>
                        ) : (
                          <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="test-input-area">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="输入消息..."
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <button onClick={handleTest}>发送</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentForm
