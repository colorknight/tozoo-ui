import { useState, useEffect, useRef } from 'react'
import { searchConversations } from '../../api/conversations'
import './SessionSidebar.css'

function SessionSidebar({ sessions, activeSession, onSelectSession, onNewSession, onLoadMoreSessions, onDeleteSession, refreshSessionListTrigger }) {
  const [searchKeyword, setSearchKeyword] = useState('') // 回车后真正用于请求的关键词
  const searchInputRef = useRef(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sessionListRef = useRef(null)
  const pageRef = useRef(0)
  const size = 20

  // 加载对话列表（使用 searchKeyword 请求）
  const loadSessions = async (reset = false) => {
  if (isLoading) return
   
    setIsLoading(true)
   try {
   const currentPage = reset ? 0 : pageRef.current
   const res = await searchConversations(searchKeyword, currentPage, size)
   const data = Array.isArray(res) ? res : (res?.content || [])
     
   if (reset) {
       onLoadMoreSessions(data, true)
       pageRef.current = 1
     } else {
       onLoadMoreSessions(data, false)
       pageRef.current += 1
     }
     
     // 判断是否还有更多数据
     setHasMore(data.length === size)
   } catch (error) {
   console.error('Failed to load conversations:', error)
   } finally {
     setIsLoading(false)
   }
  }

  // 仅在 searchKeyword 变化时重新加载（回车提交搜索）
  useEffect(() => {
   pageRef.current = 0
   loadSessions(true)
  }, [searchKeyword])

  // 创建会话后由父组件触发刷新列表（与接口保持一致）
  useEffect(() => {
   if (refreshSessionListTrigger === 0) return
   pageRef.current = 0
   loadSessions(true)
  }, [refreshSessionListTrigger])

  // 监听滚动加载
  useEffect(() => {
  const sessionList = sessionListRef.current
  if (!sessionList) return

  const handleScroll = () => {
   const { scrollTop, scrollHeight, clientHeight } = sessionList
     // 当滚动到距离底部 50px 时，加载更多
   if (scrollHeight - scrollTop - clientHeight < 50 && !isLoading && hasMore) {
       loadSessions()
     }
   }

   sessionList.addEventListener('scroll', handleScroll)
 return () => sessionList.removeEventListener('scroll', handleScroll)
  }, [isLoading, hasMore, searchKeyword])

 return (
    <aside className="session-sidebar">
      <button className="new-chat-btn" onClick={onNewSession}>
        <span>+</span> 新建会话
      </button>
      
      {/* 搜索框：点击整块区域即可聚焦输入 */}
      <div
        className="search-box-wrap"
        role="search"
        onClick={() => searchInputRef.current?.focus()}
        onKeyDown={(e) => e.key === 'Enter' && searchInputRef.current?.focus()}
      >
        <input
          ref={searchInputRef}
          type="text"
          placeholder="搜索会话..."
          defaultValue=""
          aria-label="搜索会话"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const value = (searchInputRef.current?.value ?? '').trim()
              setSearchKeyword(value)
            }
          }}
        />
      </div>
      
      <div className="session-list" ref={sessionListRef}>
        {sessions.map(session => (
          <div
            key={session.id}
            className={`session-item ${activeSession === session.id ? 'active' : ''}`}
            onClick={() => onSelectSession(session.id)}
          >
            <div className="session-title">{session.name || session.title}</div>
            <div className="session-time">
              {new Date(session.createdTime || session.created_time || 0).toLocaleString('zh-CN')}
            </div>
            <button
              className="delete-session-btn"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSession(session.id)
              }}
              title="删除会话"
            >
              🗑️
            </button>
          </div>
        ))}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
            加载中...
          </div>
        )}
        {!isLoading && !hasMore && sessions.length > 0 && (
          <div style={{ textAlign: 'center', padding: '12px', color: 'rgba(255, 255, 255, 0.3)', fontSize: '12px' }}>
            没有更多了
          </div>
        )}
      </div>
    </aside>
  )
}

export default SessionSidebar
