import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import SessionSidebar from './SessionSidebar'
import { getAgents, getAgentByQuestion } from '../../api/agents'
import { searchConversations, createConversation, getMessagesByConversationId, createMessage, deleteMessage, deleteConversation } from '../../api/conversations'
import { buildDataFromResponse, renderTemplateWithData } from '../Template/templateEditorUtils'
import { API_BASE } from '../../api/apiBase'
import { getDocumentIdByName, getImageByPageNumber } from '../../api/documents'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './Chat.css'

const knowledgeBases = [
  { id: 1, name: '通用知识', icon: '📚' },
  { id: 2, name: '技术文档', icon: '📖' },
  { id: 3, name: '企业知识', icon: '🏢' }
]

// 创建初始会话数据，首次渲染就用，避免空列表闪烁
const createInitialSessionState = () => {
  const newSession = {
    id: 'new_' + Date.now(),
    name: '新会话',
    createdTime: new Date().toISOString(),
    isNew: true
  }
  const welcomeMsg = {
    id: Date.now() + 1,
    role: 'assistant',
    content: '你好，我是合规智能助手，有什么可以帮你的吗',
    isWelcome: true
  }
  return { newSession, welcomeMsg }
}

function Chat() {
  const [initState] = useState(createInitialSessionState)
  const [sessions, setSessions] = useState(() => [initState.newSession])
  const [activeSession, setActiveSession] = useState(() => initState.newSession.id)
  const [messages, setMessages] = useState(() => [initState.welcomeMsg])
 const [inputValue, setInputValue] = useState('')
 const [selectedAgent, setSelectedAgent] = useState(null)
 const [selectedKB, setSelectedKB] = useState(null)
 const [isNewSession, setIsNewSession] = useState(false)
 const [agents, setAgents] = useState([])
 const [currentAgentConfig, setCurrentAgentConfig] = useState(null)
 const [messageStatus, setMessageStatus] = useState({})
 const messagesEndRef = useRef(null)
 const chatAreaRef = useRef(null)
 const messageRefs = useRef({})
 const messagesRef = useRef(messages)
 messagesRef.current = messages
 // 文档预览缓存：fileName -> documentId；key(documentId_pageNumber) -> { imageData, imageType }
 const documentIdCache = useRef({})
 const documentImageCache = useRef({})
 const [refreshSessionListTrigger, setRefreshSessionListTrigger] = useState(0)

 const toggleMessageStatus = (messageId) => {
   setMessageStatus(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }))
  }

 const getValidMessages = () => {
    return messages.filter(msg => messageStatus[msg.id] !== false && !msg.isWelcome)
  }

 const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

 const scrollToRound = (roundIndex) => {
   const doScroll = () => {
     const element = messageRefs.current[roundIndex] ?? document.getElementById(`round-${roundIndex}`)
     const scrollContainer = chatAreaRef.current
     if (element && scrollContainer) {
       const containerRect = scrollContainer.getBoundingClientRect()
       const elementRect = element.getBoundingClientRect()
       const scrollTop = scrollContainer.scrollTop + (elementRect.top - containerRect.top) - 20
       scrollContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
     } else if (element) {
       element.scrollIntoView({ behavior: 'smooth', block: 'start' })
     }
   }
   doScroll()
   requestAnimationFrame(() => doScroll())
  }

 const handleSourceClick = async (sourceInfo) => {
   try {
     const parsed = parsePreviewPayload(sourceInfo)
     if (!parsed) {
       throw new Error(`无法识别的预览链接格式: ${sourceInfo}`)
     }

     const fileName = parsed.fileName || `文档${parsed.documentId}`
     const pageNumber = parsed.pageNumber

     // 2. 获取 documentId：新格式直接使用，旧格式按文件名查找
     let documentId = null
     if (parsed.type === 'document-ref') {
       documentId = parsed.documentId
     } else {
       documentId = documentIdCache.current[fileName]
       if (documentId == null) {
         documentId = await getDocumentIdByName(fileName)
         documentIdCache.current[fileName] = documentId
       }
     }
     if (!documentId) {
       alert('未找到相关文档')
       return
     }
     
     // 3. 获取图片（先查缓存）并在新窗口展示
     const targetPage = Number(pageNumber)
     if (!Number.isFinite(targetPage) || targetPage < 1) {
       throw new Error(`无效页码: ${pageNumber}`)
     }
     const imageCacheKey = `${documentId}_${targetPage}`
     let imageData = documentImageCache.current[imageCacheKey]
     if (!imageData) {
       const imageList = await getImageByPageNumber(documentId, targetPage)
       const normalizedList = Array.isArray(imageList) ? imageList : (imageList ? [imageList] : [])
       normalizedList.forEach((item) => {
         const p = Number(item?.pageNumber)
         if (!Number.isFinite(p)) return
         documentImageCache.current[`${documentId}_${Math.trunc(p)}`] = item
       })
       imageData =
         normalizedList.find((item) => Number(item?.pageNumber) === targetPage) ||
         normalizedList[0]
       if (imageData) {
         const p = Number(imageData?.pageNumber)
         if (Number.isFinite(p)) {
           documentImageCache.current[`${documentId}_${Math.trunc(p)}`] = imageData
         }
       }
     }
     if (!imageData.imageData) {
       throw new Error('图片数据为空')
     }
     
     // 构建完整的 data URL
     const imageType = imageData.imageType || 'image/png'
     const base64Image = `data:${imageType};base64,${imageData.imageData}`
     // 打开新窗口并设置图片
     const newWindow = window.open('about:blank#' + encodeURIComponent(fileName), '_blank')
     if (newWindow) {
       newWindow.document.write(`
         <!DOCTYPE html>
         <html>
           <head>
             <title>${fileName} - 第${pageNumber}页</title>
             <style>
               body {
                 margin: 0;
                 padding: 20px;
                 background: #f5f5f5;
                 display: flex;
                 flex-direction: column;
                 align-items: center;
                 min-height: 100vh;
               }
               .controls {
                 position: fixed;
                 top: 20px;
                 right: 20px;
                 background: white;
                 padding: 15px 20px;
                 border-radius: 8px;
                 box-shadow: 0 2px 12px rgba(0,0,0,0.15);
                 z-index: 1000;
               }
               .page-info {
                 font-size: 14px;
                 color: #666;
                 margin-bottom: 10px;
               }
               button {
                 padding: 8px 16px;
                 margin: 0 5px;
                 background: #6366f1;
                 color: white;
                 border: none;
                 border-radius: 4px;
                 cursor: pointer;
                 font-size: 14px;
                 transition: background 0.2s;
               }
               button:hover {
                 background: #4f46e5;
               }
               button:disabled {
                 background: #d9d9d9;
                 cursor: not-allowed;
               }
               .image-container {
                 width: 100%;
                 max-width: 1200px;
                 margin-top: 60px;
                 display: flex;
                 justify-content: center;
               }
               img {
                 max-width: 100%;
                 height: auto;
                 box-shadow: 0 4px 12px rgba(0,0,0,0.15);
               }
               .loading {
                 text-align: center;
                 color: #666;
                 font-size: 16px;
               }
             </style>
           </head>
           <body>
             <div class="controls">
               <div class="page-info">当前第 <strong>${pageNumber}</strong> 页</div>
               <button onclick="prevPage()" id="prevBtn">上一页</button>
               <button onclick="nextPage()" id="nextBtn">下一页</button>
             </div>
             <div class="image-container">
               <div class="loading">加载中...</div>
               <img src="${base64Image}" alt="文档第${pageNumber}页" onload="this.style.display='block';this.previousElementSibling.style.display='none'" style="display:none" />
             </div>
             
             <script>
               var currentPage = ${targetPage};
               var documentId = '${documentId}';
               var apiBase = '${String(API_BASE || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}';
               
               function updatePage(pageNum) {
                 fetch((apiBase || '') + '/yansee/api/document-images/document/' + documentId + '/page/' + pageNum)
                   .then(response => response.json())
                   .then(data => {
                     var list = Array.isArray(data) ? data : (data ? [data] : []);
                     var target = list.find(function(item) { return Number(item && item.pageNumber) === Number(pageNum); }) || list[0];
                     if (target && target.imageData) {
                       var imageType = target.imageType || 'image/png';
                       var base64Image = 'data:' + imageType + ';base64,' + target.imageData;
                       var img = document.querySelector('img');
                       img.src = base64Image;
                       img.alt = '文档第' + pageNum + '页';
                       document.querySelector('.page-info').innerHTML = '当前第 <strong>' + pageNum + '</strong> 页';
                       currentPage = pageNum;
                       
                       // 更新按钮状态
                       document.getElementById('prevBtn').disabled = pageNum <= 1;
                     }
                   })
                   .catch(error => {
                     alert('加载失败：' + error.message);
                   });
               }
               
               function prevPage() {
                 if (currentPage > 1) {
                   updatePage(currentPage - 1);
                 }
               }
               
               function nextPage() {
                 updatePage(currentPage + 1);
               }
               
               // 键盘左右键控制
               document.addEventListener('keydown', function(e) {
                 if (e.key === 'ArrowLeft') {
                   prevPage();
                 } else if (e.key === 'ArrowRight') {
                   nextPage();
                 }
               });
               
               // 初始化按钮状态
               document.getElementById('prevBtn').disabled = currentPage <= 1;
             </script>
           </body>
         </html>
       `)
       newWindow.document.close()
     } else {
       alert('无法打开新窗口，请检查浏览器弹窗设置')
     }
     
   } catch (error) {
     console.error('处理来源定位失败:', error)
     alert('打开失败：' + error.message)
   }
 }

// 从 <tagName>...</tagName> 中取出内容，并去掉每行前导空格，保证 Markdown 正确解析
const extractFromTag = (str, tagName) => {
  if (typeof str !== 'string') return str
  if (!tagName) return str
  let content = str
  const tag = tagName.replace(/[^a-zA-Z0-9_-]/g, '')
  if (tag) {
    const re = new RegExp(`<\\s*${tag}[^>]*>([\\s\\S]*?)<\\s*\\/\\s*${tag}\\s*>`, 'i')
    const match = content.match(re)
    if (match) content = match[1].trim()
  }
  content = content.split('\n').map(line => line.replace(/^[ \t]{1,3}/, '')).join('\n')
  return content
}
const normalizeOutputMarkdown = (str) => extractFromTag(str, 'output')

// 支持两种来源链接载荷：
// 1) 旧格式：fileName/pageNumber
// 2) 新格式：documentId-refPath
const parsePreviewPayload = (raw) => {
  const text = String(raw || '').trim()
  if (!text) return null
  const inner = text.startsWith('<') && text.endsWith('>') ? text.slice(1, -1).trim() : text
  if (!inner) return null

  if (inner.includes('/')) {
    const lastSlash = inner.lastIndexOf('/')
    const left = inner.slice(0, lastSlash).trim()
    const right = inner.slice(lastSlash + 1).trim()
    const nums = right.match(/\d+/g)
    if (left && nums?.length) {
      const isLikelyDocumentId = /^[A-Za-z0-9_-]{8,}$/.test(left)
      if (isLikelyDocumentId) {
        return {
          type: 'document-ref',
          sourceInfo: inner,
          documentId: left,
          refPath: right,
          pageNumber: nums[0]
        }
      }

      return {
        type: 'legacy',
        sourceInfo: inner,
        fileName: left,
        pageNumber: nums[0]
      }
    }
  }

  const dashIndex = inner.indexOf('-')
  if (dashIndex > 0 && dashIndex < inner.length - 1) {
    const documentId = inner.slice(0, dashIndex).trim()
    const refPath = inner.slice(dashIndex + 1).trim()
    const nums = refPath.match(/\d+/g)
    const pageNumber = nums?.length ? nums[nums.length - 1] : '1'
    return {
      type: 'document-ref',
      sourceInfo: inner,
      documentId,
      refPath,
      pageNumber
    }
  }

  return null
}

// 按 path 段数组从 obj 取值，支持 [0]、field[0]、field 等
const getValueByPath = (obj, pathParts) => {
  let value = obj
  for (const part of pathParts) {
    if (value === undefined || value === null) return undefined
    const arrayMatch = part.match(/^\[(\d+)\]$/)
    const objectMatch = part.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      value = value[parseInt(arrayMatch[1])]
    } else if (objectMatch) {
      value = value[objectMatch[1]]?.[parseInt(objectMatch[2])]
    } else {
      value = value[part]
    }
  }
  return value
}

// 处理文本中的来源定位，将《文件名》.扩展名 - 页码 部分转换为可点击的链接
// 支持：1）裸文本 (preview:document:文件名/页数) 或 (preview:document:<文件名/页数>)；2）markdown 链接 [content](preview:document:...)
const processSourceText = (text) => {
  if (!text) return text

  const sourceLinkAttrs = (escaped, display) =>
    `class="source-link" data-source-info="${escaped}" title="点击查看" style="color: var(--color-primary); cursor: pointer; text-decoration: underline; font-weight: 700;"`

  const toSourceLink = (inner, display) => {
    const escaped = inner.replace(/"/g, '&quot;')
    return `<span ${sourceLinkAttrs(escaped, display || inner)}>${display || inner}</span>`
  }

  let result = text
  let replaceCount = 0

  // 1) **xxx**(preview:document:...)：对应模板里的主要写法，支持标题含空格
  const rawPreviewBoldPattern = /(\*\*[^*\n]+?\*\*)\s*\(preview:document:(<[^>]+>|[^)\n]+)\)/g
  result = result.replace(rawPreviewBoldPattern, (match, linkText, payload) => {
    const rest = (payload || '').trim()
    const inner = rest.startsWith('<') && rest.endsWith('>') ? rest.slice(1, -1).trim() : rest
    if (!parsePreviewPayload(inner)) return match
    const display = (linkText || '').replace(/^\*\*|\*\*$/g, '').trim()
    replaceCount++
    return toSourceLink(inner, display)
  })

  // 2) xxx(preview:document:...)：兼容旧的“无空格纯文本标题”写法
  const rawPreviewCompactPattern = /([^\s()]+)\(preview:document:(<[^>]+>|[^)\n]+)\)/g
  result = result.replace(rawPreviewCompactPattern, (match, linkText, payload) => {
    const rest = (payload || '').trim()
    const inner = rest.startsWith('<') && rest.endsWith('>') ? rest.slice(1, -1).trim() : rest
    if (!parsePreviewPayload(inner)) return match
    replaceCount++
    return toSourceLink(inner, linkText)
  })

  const sourcePattern = /\+ \*\*(.+?)\s*-\s*第(\d+)页\s*-\s*(.*)\*\*/g
  // 替换为 HTML 链接
  result = result.replace(sourcePattern, (match, docName, pageNumber, additionalInfo) => {
    // 完整的来源信息 (用于传递给点击处理函数)
    const fullSourceInfo = `${docName}-${pageNumber}-${additionalInfo}`
       
    // 构建蓝色可点击部分 (文档名 + 附加信息 + 页码)
    const clickablePart = `${docName}-第${pageNumber}页-${additionalInfo}`
    const linkHtml = `
        <span class="source-link"
          data-source-info="${fullSourceInfo}"
          title="点击查看${docName}-第${pageNumber}页${additionalInfo}"
          style="color: var(--color-primary); cursor: pointer; text-decoration: underline; font-weight: 700;"
        >
          ${clickablePart}
        </span>
    `.replace(/\s+/g, ' ').trim()
       
    // 保留来源定位前缀
    return "+ " + linkHtml
  })

  return result
}

// 创建一个处理过的文本组件
const ProcessedText = ({content}) => {
  return <>{processSourceText(content)}</>
}

useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 为来源定位链接添加点击事件监听
  useEffect(() => {
    const handleClick = (e) => {
      const sourceLink = e.target.closest('.source-link')
      if (sourceLink) {
        const sourceInfo = sourceLink.getAttribute('data-source-info')
        if (sourceInfo) {
          handleSourceClick(sourceInfo)
        }
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
   const fetchAgents = async () => {
      try {
       const data = await getAgents()
       setAgents(data)
      } catch (error) {
       console.error('Failed to fetch agents:', error)
      }
    }
    fetchAgents()
  }, [])

 const createNewSession = () => {
   // 创建一个新的临时会话
   const newSession = {
     id: 'new_' + Date.now(),
     name: '新会话',
     createdTime: new Date().toISOString(),
     isNew: true
   }
   
   // 添加到会话列表最上方
   setSessions(prev => [newSession, ...prev])
   
   // 设置为活动会话
   setActiveSession(newSession.id)
   
   // 设置欢迎消息
   setMessages([{ 
      id: Date.now() + 1, 
      role: 'assistant', 
     content: '你好，我是合规智能助手，有什么可以帮你的吗',
      isWelcome: true
    }])
   setSelectedAgent(null)
   setSelectedKB(null)
   setCurrentAgentConfig(null)
   setIsNewSession(false)
   setInputValue('')
   
   // 自动聚焦到输入框
   setTimeout(() => {
     const input = document.querySelector('.chat-input')
     if (input) {
       input.focus()
     }
   }, 100)
  }
  

 const handleLoadMoreSessions = (newSessions, reset = false) => {
    if (reset) {
      // API 返回空时保留当前初始会话，避免闪一下
      if (newSessions.length === 0 && sessions.length > 0) return
      setSessions(newSessions)
    } else {
      setSessions(prev => [...prev, ...newSessions])
    }
  }

 const handleStartChat = () => {
    if (selectedAgent) {
     const config = selectedAgent.requestConfig || {}
     setCurrentAgentConfig(config)
     setIsNewSession(false)
    }
  }

 const handleSend = async () => {
    if (!inputValue.trim()) return

   const userMsg = { id: Date.now(), role: 'user', content: inputValue }
   const newMessages = [...messages, userMsg]
   // 立即把用户消息写入 state 并同步渲染到 DOM，避免等接口返回才显示
   flushSync(() => {
     setMessages(newMessages)
     setInputValue('')
   })
   setTimeout(() => scrollToBottom(), 0)

    let conversationId = activeSession

    // 如果是新会话（临时会话），需要创建实际会话
    if (!activeSession || (activeSession && activeSession.toString().startsWith('new_'))) {
      try {
       const newConversation = await createConversation({
          name: inputValue,
         enabled: true
        })
       conversationId = newConversation.id
        
       // 更新会话列表中的临时会话为实际会话
       const sessionData = {
          id: newConversation.id,
          name: newConversation.name || newConversation.title || inputValue.substring(0, 30),
          createdTime: newConversation.createdTime || newConversation.created_time || new Date().toISOString()
        }
       
       // 替换临时会话
       setSessions(prev => prev.map(s => 
         s.id === activeSession ? sessionData : s
       ))
       setActiveSession(newConversation.id)
       setRefreshSessionListTrigger(t => t + 1)

        if (newConversation.agentId) {
         const agent = agents.find(a => a.id === newConversation.agentId)
          if (agent) {
           setSelectedAgent(agent)
           const config = agent.requestConfig || {}
           setCurrentAgentConfig(config)
           sendToAgent(newMessages, config, newConversation.id, agent.outputTemplate)
            return
          }
        }
      } catch(error) {
       console.error('Failed to create conversation:', error)
       const tempSessionId = Date.now()
       const tempSession = {
          id: tempSessionId,
          name: inputValue.substring(0, 20),
          createdTime: new Date().toISOString()
        }
       // 替换临时会话
       setSessions(prev => prev.map(s => 
         s.id === activeSession ? tempSession : s
       ))
       setActiveSession(tempSessionId)
      }
    }

    // 每次都调用 /yansee/api/chat/question 接口来确定使用哪个 agent
    try {
     const lastQuestion = inputValue
     const responseText = await getAgentByQuestion(lastQuestion)

      try {
       const agentData = JSON.parse(responseText)
        if (agentData.id && agentData.requestConfig) {
         const agent = agents.find(a => a.id === agentData.id)
          if (agent) {
           setSelectedAgent(agent)
          } else {
           setSelectedAgent(agentData)
          }
         setCurrentAgentConfig(agentData.requestConfig)
         sendToAgent(newMessages, agentData.requestConfig, conversationId, agentData.outputTemplate)
          return
        }
      } catch (e) {
       console.error('解析响应失败:', e)
      }

     const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: responseText || '暂无回复' }
     setMessages(prev => [...prev, assistantMsg])
     setTimeout(() => scrollToBottom(), 0)
    } catch(error) {
     console.error('请求失败:', error)
     const errorMsg = { id: Date.now() + 1, role: 'assistant', content: `请求失败：${error.message}` }
     setMessages(prev => [...prev, errorMsg])
     setTimeout(() => scrollToBottom(), 0)
    }
  }

 const handleSelectSession = (id) => {
   const session= sessions.find(s => s.id === id)
   setActiveSession(id)
   setIsNewSession(false)
   setSelectedAgent(null)
   setSelectedKB(null)
    if (session?.agentConfig) {
     setCurrentAgentConfig(session.agentConfig)
    } else {
     setCurrentAgentConfig(null)
    }
    loadSessionMessages(id)
  }

 const loadSessionMessages = async (conversationId) => {
    try {
     const messages = await getMessagesByConversationId(conversationId)

     const formattedMessages = messages.map(msg => ({
        id: msg.id || Date.now(),
        role: msg.role,
       content: msg.content,
        createdTime: msg.createdTime
      }))
     
     // 在会话消息开头添加欢迎语
     const welcomeMessage = {
       id: Date.now(),
       role: 'assistant',
       content: '你好，我是合规智能助手，有什么可以帮你的吗',
       isWelcome: true
     }
     setMessages([welcomeMessage, ...formattedMessages])
     setTimeout(() => scrollToBottom(), 0)
    } catch (error) {
     console.error('加载消息失败:', error)
     setMessages([])
    }
  }

  // 复制助手回复内容
  const handleCopyReply = async (content) => {
    try {
      await navigator.clipboard.writeText(content || '')
      // 可加 toast 提示
    } catch (e) {
      console.error('复制失败:', e)
    }
  }

  // 重新生成该轮：先删掉该轮的旧问题和旧回答，再重新插入问题并发送请求（用 ref 取最新消息，避免旧会话页闭包拿到过期 state）
  const handleRegenerateRound = async (roundIndex) => {
    const currentMessages = messagesRef.current
    const contentMessages = currentMessages.filter(m => !m.isWelcome)
    const rounds = []
    for (let i = 0; i < contentMessages.length; i++) {
      if (contentMessages[i].role === 'user' && contentMessages[i + 1]?.role === 'assistant') {
        rounds.push({ user: contentMessages[i], assistant: contentMessages[i + 1] })
        i++
      } else if (contentMessages[i].role === 'user') {
        // 与渲染层的 round 构造保持一致，避免 roundIndex 错位
        rounds.push({ user: contentMessages[i], assistant: null })
      }
    }
    const round = rounds[roundIndex]
    if (!round || !round.assistant) return
    const idsToRemove = [round.user.id, round.assistant.id]
    const idsToRemoveSet = new Set(idsToRemove.map(id => String(id)))
    // 按 id 删除更稳，避免对象引用变化导致删不掉
    const newMessages = currentMessages.filter(m => !idsToRemoveSet.has(String(m.id)))
    const userContent = round.user.content || ''
    // 新的一条用户消息，用于重新发送
    const newUserMsg = { id: Date.now(), role: 'user', content: userContent }
    setMessages([...newMessages, newUserMsg])
    setMessageStatus(prev => {
      const next = { ...prev }
      idsToRemove.forEach(id => {
        if (id != null) delete next[id]
        delete next[String(id)]
      })
      return next
    })
    const conversationId = activeSession && !activeSession.toString().startsWith('new_') ? activeSession : null
    // 已保存会话时从后端删掉该轮旧消息，再重新发
    if (conversationId) {
      try {
        await Promise.all(idsToRemove.map(id => deleteMessage(id)))
      } catch (e) {
        console.error('删除旧消息失败:', e)
      }
    }
    const messagesWithUser = [...newMessages, newUserMsg]
    try {
      const responseText = await getAgentByQuestion(userContent)
      try {
        const agentData = JSON.parse(responseText)
        if (agentData.id && agentData.requestConfig) {
          const config = agentData.requestConfig
          setSelectedAgent(agents.find(a => a.id === agentData.id) || agentData)
          setCurrentAgentConfig(config)
          sendToAgent(messagesWithUser, config, conversationId, agentData.outputTemplate)
          return
        }
      } catch (e) {
        console.error('解析响应失败:', e)
      }
      const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: responseText || '暂无回复' }
      setMessages([...messagesWithUser, assistantMsg])
      setTimeout(() => scrollToBottom(), 0)
    } catch (error) {
      console.error('请求失败:', error)
      const errorMsg = { id: Date.now() + 1, role: 'assistant', content: `请求失败：${error.message}` }
      setMessages([...messagesWithUser, errorMsg])
      setTimeout(() => scrollToBottom(), 0)
    }
  }

  // 删除一轮对话（用户问题 + 接口回复成对删除）
  const handleDeleteRound = async (roundIndex) => {
    const contentMessages = messages.filter(m => !m.isWelcome)
    const rounds = []
    for (let i = 0; i < contentMessages.length; i++) {
      if (contentMessages[i].role === 'user' && contentMessages[i + 1]?.role === 'assistant') {
        rounds.push({ user: contentMessages[i], assistant: contentMessages[i + 1] })
        i++
      }
    }
    const round = rounds[roundIndex]
    if (!round) return
    if (!confirm('确定删除这一轮对话吗？')) return

    const idsToRemove = [round.user.id, round.assistant.id]
    setMessages(prev => prev.filter(m => !idsToRemove.includes(m.id)))
    setMessageStatus(prev => {
      const next = { ...prev }
      idsToRemove.forEach(id => delete next[id])
      return next
    })

    // 若为已保存会话，调用后端删除
    if (activeSession && !activeSession.toString().startsWith('new_')) {
      try {
        await Promise.all(idsToRemove.map(id => deleteMessage(id)))
      } catch (e) {
        console.error('删除消息失败:', e)
      }
    }
  }

 const handleDeleteSession = async (sessionId) => {
    if (!confirm('确定要删除该会话吗？')) return
    try {
      await deleteConversation(sessionId)
     setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSession === sessionId) {
       createNewSession()
      }
    } catch (error) {
     console.error('删除会话失败:', error)
      alert('删除失败：' + error.message)
    }
  }

 const sendToAgent = async (messagesForApi, config, sessionId, outputTemplate) => {
    try {
     const msgField = config?.messageField || 'content'
     const baseMessages = (messagesForApi || messages)
     const validMessages = baseMessages.filter(m => messageStatus[m.id] !== false && !m.isWelcome)
     const historyForApi = validMessages
        .filter(m => m.role !== 'system')
        .slice(0, -1)
        .map(m => ({ role: m.role, [msgField]: m.content }))

     const localUserMsg = [...baseMessages].reverse().find(m => m.role === 'user' && !m.isWelcome)
     const localUserId = localUserMsg?.id
     const userMsgForApi = { role: 'user', [msgField]: baseMessages[baseMessages.length - 1]?.content || '' }
     const messagesToSend = [...historyForApi, userMsgForApi]

     const systemPrompt = config?.systemPrompt
     const systemMsg = systemPrompt ? { role: 'system', content: systemPrompt } : null
     const msgValueWithSystem = systemMsg
        ? JSON.stringify([systemMsg, ...messagesToSend])
        : JSON.stringify(messagesToSend)
     const histValueWithSystem = systemMsg
        ? JSON.stringify([systemMsg, ...historyForApi])
        : JSON.stringify(historyForApi)

      let bodyStr = (config?.requestBody || '{"messages": ${messages}}')
        .replace(/\$\{messages\}/g, msgValueWithSystem)
        .replace(/\$\{history\}/g, histValueWithSystem)
        .replace(/\$\{content\}/g, userMsgForApi.content)
        .replace(/\$\{message\}/g, JSON.stringify(userMsgForApi))
        .replace(/\$\{system\}/g, systemMsg ? JSON.stringify(systemMsg) : '')

     const url = config?.requestUrl || ''
     const method = config?.requestMethod || 'POST'

      let requestUrl = url
      if (config?.requestParams) {
        try {
         const parsed = JSON.parse(config.requestParams)
         const queryParams = new URLSearchParams()
          Object.entries(parsed).forEach(([key, value]) => {
            queryParams.append(key, value)
          })
          if (queryParams.toString()) {
            requestUrl += (url.includes('?') ? '&' : '?') + queryParams.toString()
          }
        } catch {}
      }

     const headers = {}
      if (config?.requestHeaders) {
        try {
         const parsed = JSON.parse(config.requestHeaders)
          Object.entries(parsed).forEach(([key, value]) => {
            headers[key] = value
          })
        } catch {}
      }

     const fetchOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }

      if (method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = bodyStr
      }

     const response = await fetch(requestUrl, fetchOptions)
     const responseText = await response.text()
      let displayContent = responseText
      let json = null
      try {
        json = JSON.parse(responseText)
        if (typeof json === 'string') json = JSON.parse(json)
      } catch (_) {}

      // 若配置了输出模板，用接口返回的 JSON 渲染模板（Mustache 变量用 dataObj 里的数据替换）
      const template = outputTemplate
      if (template && (template.content || '').trim()) {
        const variables = template.variables || []
        let dataObj = json != null ? json : { content: responseText }
        // 若有响应路径 targetPath，从 json 中取出该路径对应的子树作为 dataObj，这样模板里的 {{content}} 等才能对应到接口字段
        if (json != null && config?.targetPath?.trim()) {
          const pathParts = config.targetPath.trim().split('.')
          const extracted = getValueByPath(json, pathParts)
          console.log('[Agent 输出模板] targetPath 获取到的数据:', { targetPath: config.targetPath.trim(), pathParts, extracted })
          if (extracted !== undefined && extracted !== null) {
            if (typeof extracted === 'object' && !Array.isArray(extracted)) {
              dataObj = extracted
            } else if (typeof extracted === 'string' && extracted.trim()) {
              // 抽取到的可能是 JSON 字符串，解析后模板里的 {{overview}}、{{laws}} 等才能对上
              try {
                const parsed = JSON.parse(extracted)
                if (parsed !== null && typeof parsed === 'object') {
                  dataObj = parsed
                } else {
                  dataObj = { content: extracted }
                }
              } catch (_) {
                dataObj = { content: extracted }
              }
            } else {
              dataObj = { content: String(extracted) }
            }
          }
        }
        console.log('[Agent 输出模板] 接口原始数据:', { responseText, json })
        console.log('[Agent 输出模板] 模板内容:', template.content)
        console.log('[Agent 输出模板] 模板变量:', variables)
        console.log('[Agent 输出模板] 用于渲染的 dataObj:', dataObj)
        try {
          const { single, list } = buildDataFromResponse(dataObj, variables)
          console.log('[Agent 输出模板] 解析后的 single/list:', { single, list })
          displayContent = renderTemplateWithData(template.content, variables, { single, list })
          console.log('[Agent 输出模板] 渲染结果:', displayContent)
        } catch (err) {
          console.error('[Agent 输出模板] 模板渲染失败:', err)
        }
      } else {
        const targetPath = config?.targetPath?.trim()
        if (targetPath) {
          const pathParts = targetPath.split('.')
          if (json !== null) {
            // 先尝试整段当作 JSON 路径
            let value = getValueByPath(json, pathParts)
            if (value !== undefined) {
              displayContent = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
            } else if (pathParts.length >= 2) {
              // 再尝试：前 N-1 段为 JSON 路径，末段为 HTML 标签名
              value = getValueByPath(json, pathParts.slice(0, -1))
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
      }

      let persistedUserId = null
      let persistedAssistantId = null
      const assistantTempId = Date.now() + 1

      if (sessionId) {
        try {
         const userMsgData = {
            role: 'user',
           content: userMsgForApi[msgField] || '',
           conversation: { id: sessionId}
          }
          const savedUser = await createMessage(userMsgData)
          persistedUserId = savedUser?.id ?? savedUser?.data?.id ?? null
         const assistantMsgData = {
            role: 'assistant',
           content: displayContent,
           conversation: { id: sessionId}
          }
          const savedAssistant = await createMessage(assistantMsgData)
          persistedAssistantId = savedAssistant?.id ?? savedAssistant?.data?.id ?? null
        } catch (saveError) {
         console.error('保存消息失败:', saveError)
        }
      }

     const assistantMsg = { id: assistantTempId, role: 'assistant', content: displayContent }
     // 用请求时的消息列表做基准，避免 setState 未及时更新导致丢消息（例如重新生成时先删再发）
     setMessages(prev => {
       const base = (messagesForApi && messagesForApi.length) ? messagesForApi : prev
       let next = [...base, assistantMsg]
       if (persistedUserId || persistedAssistantId) {
         next = next.map((msg) => {
           if (persistedUserId != null && localUserId != null && String(msg.id) === String(localUserId)) {
             return { ...msg, id: persistedUserId }
           }
           if (persistedAssistantId != null && String(msg.id) === String(assistantTempId)) {
             return { ...msg, id: persistedAssistantId }
           }
           return msg
         })
       }
       return next
     })
     setTimeout(() => scrollToBottom(), 0)
    } catch (error) {
     const errorMsg = { id: Date.now() +1, role: 'assistant', content: `请求失败：${error.message}` }
     setMessages(prev => {
       const base = (messagesForApi && messagesForApi.length) ? messagesForApi : prev
       return [...base, errorMsg]
     })
     setTimeout(() => scrollToBottom(), 0)
    }
  }

 return (
    <div className="chat-layout">
      <SessionSidebar
       sessions={sessions}
        activeSession={activeSession}
        onSelectSession={handleSelectSession}
        onNewSession={createNewSession}
        onLoadMoreSessions={handleLoadMoreSessions}
        onDeleteSession={handleDeleteSession}
        refreshSessionListTrigger={refreshSessionListTrigger}
      />
      <main className="chat-main">
        {isNewSession ? (
          <div className="new-session-config">
            <div className="config-section">
              <h3>选择智能体</h3>
              <div className="config-options">
                {agents.map(agent => (
                  <div
                    key={agent.id}
                    className={`config-option ${selectedAgent?.id === agent.id ? 'active' : ''}`}
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <span className="option-icon">🤖</span>
                    <div>
                      <span className="option-name">{agent.name}</span>
                      {agent.description && <p className="option-desc">{agent.description}</p>}
                    </div>
                  </div>
                ))}
                {agents.length === 0 && (
                  <div className="empty-tip">暂无智能体，请先创建智能体</div>
                )}
              </div>
            </div>
            <div className="config-section">
              <h3>选择知识库</h3>
              <div className="config-options">
                {knowledgeBases.map(kb => (
                  <div
                    key={kb.id}
                    className={`config-option ${selectedKB?.id === kb.id ? 'active' : ''}`}
                    onClick={() => setSelectedKB(kb)}
                  >
                    <span className="option-icon">{kb.icon}</span>
                    <span className="option-name">{kb.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="start-chat-btn"
              onClick={handleStartChat}
              disabled={!selectedAgent}
            >
              开始对话
            </button>
          </div>
        ) : (
          <>
            <div className="chat-area" ref={chatAreaRef}>
              <div className="message-list">
                {(() => {
                  const contentMessages = messages.filter(m => !m.isWelcome)
                  const rounds = []
                  for (let i = 0; i < contentMessages.length; i++) {
                    if (contentMessages[i].role === 'user' && contentMessages[i + 1]?.role === 'assistant') {
                      rounds.push({ user: contentMessages[i], assistant: contentMessages[i + 1] })
                      i++
                    } else if (contentMessages[i].role === 'user') {
                      // 只有用户消息、助手尚未回复时也显示（请求已发出）
                      rounds.push({ user: contentMessages[i], assistant: null })
                    }
                  }

                  const result = []
                  const welcomeMsg = messages.find(m => m.isWelcome)
                  if (welcomeMsg) {
                    result.push(
                      <div key='welcome' className='message assistant' style={{
                        padding: '16px 20px',
                        marginBottom: '16px',
                        borderRadius: '12px',
                        fontSize: '14px',
                        lineHeight: 1.6,
                        width: '100%',
                        boxSizing: 'border-box',
                        wordWrap: 'break-word',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        background: 'var(--color-assistant-msg)',
                        color: 'var(--color-text)',
                        marginRight: 'auto',
                        maxWidth: '85%'
                      }}>
                        {welcomeMsg.content}
                      </div>
                    )
                  }

                  rounds.forEach((round, roundIndex) => {
                    const { user: userMsg, assistant: assistantMsg } = round
                    result.push(
                      <div
                        key={`round-${roundIndex}`}
                        ref={el => messageRefs.current[roundIndex] = el}
                        id={`round-${roundIndex}`}
                        className="message-round"
                        style={{ marginBottom: '24px', position: 'relative' }}
                      >
                        <div className={`message ${userMsg.role}`} style={{
                          padding: '16px 20px',
                          marginBottom: '16px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          lineHeight: 1.6,
                          width: '100%',
                          boxSizing: 'border-box',
                          wordWrap: 'break-word',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          background: 'var(--color-primary)',
                          color: '#fff',
                          marginLeft: 'auto',
                          maxWidth: '85%'
                        }}>
                          <div className="message-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <span
                              className="message-marker"
                              onClick={() => toggleMessageStatus(userMsg.id)}
                              style={{
                                display: 'inline-block',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: messageStatus[userMsg.id] === false ? '#ccc' : '#52c41a',
                                marginRight: '8px',
                                cursor: 'pointer',
                                border: '2px solid #fff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                            />
                          </div>
                          <Markdown remarkPlugins={[remarkGfm]}>{userMsg.content || ''}</Markdown>
                        </div>
                        {assistantMsg ? (
                        <div className={`message ${assistantMsg.role}`} style={{
                          padding: '16px 20px',
                          marginBottom: '16px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          lineHeight: 1.6,
                          width: '100%',
                          boxSizing: 'border-box',
                          wordWrap: 'break-word',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          background: 'var(--color-assistant-msg)',
                          color: 'var(--color-text)',
                          marginRight: 'auto',
                          maxWidth: '85%'
                        }}>
                          <div className="message-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <span
                              className="message-marker"
                              onClick={() => toggleMessageStatus(assistantMsg.id)}
                              style={{
                                display: 'inline-block',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: messageStatus[assistantMsg.id] === false ? '#ccc' : '#52c41a',
                                marginRight: '8px',
                                cursor: 'pointer',
                                border: '2px solid #fff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                            />
                          </div>
                          <Markdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              p: ({ children }) => <p>{children}</p>,
                              a: ({ href, children, ...props }) => {
                                const h = (href || '').trim()
                                // 1) [text](preview:document:<文件名/页数>) 或 [text](preview:document:文件名/页数)
                                if (h.startsWith('preview:document:')) {
                                  const rest = h.slice('preview:document:'.length).trim()
                                  const inner = rest.startsWith('<') && rest.endsWith('>') ? rest.slice(1, -1).trim() : rest
                                  if (parsePreviewPayload(inner)) {
                                    return (
                                      <a
                                        href="#"
                                        className="source-link"
                                        data-source-info={inner}
                                        onClick={(e) => e.preventDefault()}
                                        {...props}
                                      >
                                        {children}
                                      </a>
                                    )
                                  }
                                }

                                // 2) [text](《文件》/页) 这种内部链接：保持 a 标签形态，但点击走预览
                                if (!h.startsWith('http') && parsePreviewPayload(h)) {
                                  return (
                                    <a
                                      href="#"
                                      className="source-link"
                                      data-source-info={h}
                                      onClick={(e) => e.preventDefault()}
                                      {...props}
                                    >
                                      {children}
                                    </a>
                                  )
                                }

                                // 3) 其他链接保持默认行为
                                return (
                                  <a href={href} {...props}>
                                    {children}
                                  </a>
                                )
                              },
                              blockquote: ({ children }) => <blockquote>{children}</blockquote>
                            }}
                          >
                            {processSourceText(normalizeOutputMarkdown(assistantMsg.content || ''))}
                          </Markdown>
                          <div className="message-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="message-action-btn message-action-btn-icon"
                              onClick={() => handleCopyReply(assistantMsg.content)}
                              title="复制"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                            <button
                              type="button"
                              className="message-action-btn message-action-btn-icon"
                              onClick={() => handleRegenerateRound(roundIndex)}
                              title="重新生成"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                            </button>
                            <button
                              type="button"
                              className="message-action-btn message-action-btn-icon message-action-btn-danger"
                              onClick={() => handleDeleteRound(roundIndex)}
                              title="删除这一轮对话"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            </button>
                          </div>
                        </div>
                        ) : (
                          <div className="message assistant" style={{
                            padding: '16px 20px',
                            marginBottom: '16px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            lineHeight: 1.6,
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'var(--color-assistant-msg)',
                            marginRight: 'auto',
                            maxWidth: '85%',
                            minHeight: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--color-text-secondary, #888)'
                          }}>
                            正在思考...
                          </div>
                        )}
                      </div>
                    )
                  })
                  return result
                })()}
                  <div ref={messagesEndRef} style={{ height: '1px' }} />
                </div>
            </div>
            
            {messages.filter(m => !m.isWelcome && m.role === 'user').length > 0 && (
              <div className="right-sidebar">
                {(() => {
                  const userMessages = messages.filter(m => !m.isWelcome && m.role === 'user')
                  return userMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className="sidebar-dot"
                      onClick={() => scrollToRound(idx)}
                      title={`第 ${idx + 1} 轮：${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`}
                    />
                  ))
                })()}
              </div>
            )}

            <div className="input-area">
              <input
                type="text"
                placeholder="输入消息..."
                className="chat-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button className="send-btn" onClick={handleSend}>发送</button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default Chat
