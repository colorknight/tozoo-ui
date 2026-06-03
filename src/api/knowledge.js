/**
 * 知识库相关 API
 */
import { API_BASE } from './apiBase'

// 搜索知识库（分页）
export const searchKnowledgeBases = async (params) => {
  const queryParams = new URLSearchParams()
  if (params.description !== undefined && params.description !== null) {
    queryParams.append('description', params.description)
  }
  if (params.page !== undefined && params.page !== null) {
    queryParams.append('page', params.page)
  }
  if (params.size !== undefined && params.size !== null) {
    queryParams.append('size', params.size)
  }
  const url = `${API_BASE}/yansee/api/knowledge-bases/search?${queryParams.toString()}`
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// 获取知识库详情
export const getKnowledgeBaseById = async (id) => {
  const response = await fetch(`${API_BASE}/yansee/api/knowledge-bases/${id}`)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// 创建知识库
export const createKnowledgeBase = async (knowledgeBaseData) => {
  const response = await fetch(`${API_BASE}/yansee/api/knowledge-bases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(knowledgeBaseData)
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// 更新知识库
export const updateKnowledgeBase = async (id, knowledgeBaseData) => {
  const response = await fetch(`${API_BASE}/yansee/api/knowledge-bases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(knowledgeBaseData)
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// 删除知识库
export const deleteKnowledgeBase = async (id) => {
  const response = await fetch(`${API_BASE}/yansee/api/knowledge-bases/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return { success: true }
}
