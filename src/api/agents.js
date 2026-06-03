/**
 * 智能体相关 API
 */
import { API_BASE } from './apiBase'

export const getAgents = async () => {
  const response = await fetch(`${API_BASE}/yansee/api/agents`)
  if (!response.ok) {
    throw new Error('Failed to fetch agents')
  }
  return response.json()
}

export const getAgentById = async (id) => {
  const response = await fetch(`${API_BASE}/yansee/api/agents/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch agent')
  }
  return response.json()
}

export const createAgent = async (agentData) => {
  const response = await fetch(`${API_BASE}/yansee/api/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentData)
  })
  if (!response.ok) {
    throw new Error('Failed to create agent')
  }
  return response.json()
}

export const updateAgent = async (id, agentData) => {
  const response = await fetch(`${API_BASE}/yansee/api/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentData)
  })
  if (!response.ok) {
    throw new Error('Failed to update agent')
  }
  return response.json()
}

export const deleteAgent = async (id) => {
  const response = await fetch(`${API_BASE}/yansee/api/agents/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Failed to delete agent')
  }
}

// 复制智能体（含完整 RequestConfig，新建时间等）
export const copyAgent = async (id) => {
  const response = await fetch(`${API_BASE}/yansee/api/agents/${id}/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    throw new Error('Failed to copy agent')
  }
  return response.json()
}

// 根据问题获取匹配的智能体配置（用于对话路由）
export const getAgentByQuestion = async (question) => {
  const response = await fetch(`${API_BASE}/yansee/api/chat/question?question=${encodeURIComponent(question)}`, {
    method: 'POST'
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.text()
}
