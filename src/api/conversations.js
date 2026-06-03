import { API_BASE } from './apiBase'

// 查询对话列表
export const searchConversations = async (keyword, page = 0, size = 20) => {
 const params = new URLSearchParams({
    keyword,
    page: page.toString(),
    size: size.toString()
  })
 const response = await fetch(`${API_BASE}/yansee/api/conversations/search?${params}`)
  if (!response.ok) {
  throw new Error('Failed to search conversations')
  }
 return response.json()
}

// 创建新会话
export const createConversation = async (conversationData, messages) => {
  // 如果有 messages，添加到 conversationData 中
 const requestData = { ...conversationData }
  
  if (messages && messages.length > 0) {
 requestData.messages = messages
  }
  
 const response = await fetch(`${API_BASE}/yansee/api/conversations`, {
  method: 'POST',
  headers: {
   'Content-Type': 'application/json'
  },
  body: JSON.stringify(requestData)
  })
  if (!response.ok) {
 throw new Error('Failed to create conversation')
  }
 return response.json()
}

// 根据会话 ID 获取消息列表
export const getMessagesByConversationId = async (conversationId) => {
 const response = await fetch(`${API_BASE}/yansee/api/messages/conversation/${conversationId}`)
  if (!response.ok) {
 throw new Error('Failed to get messages by conversation ID')
  }
 return response.json()
}

// 创建新消息
export const createMessage = async (messageData) => {
 const response = await fetch(`${API_BASE}/yansee/api/messages`, {
  method: 'POST',
  headers: {
   'Content-Type': 'application/json'
  },
  body: JSON.stringify(messageData)
  })
  if (!response.ok) {
 throw new Error('Failed to create message')
  }
 return response.json()
}

// 删除单条消息
export const deleteMessage = async (id) => {
  const response = await fetch(`${API_BASE}/yansee/api/messages/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Failed to delete message')
  }
  return response
}

// 删除会话
export const deleteConversation= async (id) => {
 const response = await fetch(`${API_BASE}/yansee/api/conversations/${id}`, {
  method: 'DELETE'
  })
  if (!response.ok) {
 throw new Error('Failed to delete conversation')
  }
 return response
}
