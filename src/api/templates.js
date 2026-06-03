/**
 * 输出模板相关 API
 */
import { API_BASE } from './apiBase'

/**
 * 搜索模板（按名称或描述关键词，支持分页）
 * @param {Object} params
 * @param {string} params.keyword - 关键词（必填）
 * @param {number} [params.page] - 页码
 * @param {number} [params.size] - 每页条数
 * @returns {Promise<Array>} 模板列表
 */
export const searchTemplates = async (params) => {
  const queryParams = new URLSearchParams()
  queryParams.append('keyword', params.keyword ?? '')
  if (params.page !== undefined && params.page !== null) {
    queryParams.append('page', params.page)
  }
  if (params.size !== undefined && params.size !== null) {
    queryParams.append('size', params.size)
  }
  const url = `${API_BASE}/yansee/api/output-templates/search?${queryParams.toString()}`
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

/**
 * 创建输出模板（variables 可级联）
 * @param {Object} template - 模板对象，参见 SeeOutputTemplate
 * @returns {Promise<Object>} 创建后的模板
 */
export const createTemplate = async (template) => {
  const response = await fetch(`${API_BASE}/yansee/api/output-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template)
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

/**
 * 仅更新模板的 content 与 variables（保存后调用）
 * @param {string} id - 模板 ID
 * @param {Object} body
 * @param {string} [body.content] - 模板内容
 * @param {string} [body.format] - MARKDOWN | TEXT，不传时默认 MARKDOWN
 * @param {Array} [body.variables] - 变量列表，项含 variableKey, variableType, listItemLabel, description, testData 等
 * @returns {Promise<Object>} 更新后的模板
 */
export const updateTemplateContent = async (id, body) => {
  const response = await fetch(`${API_BASE}/yansee/api/output-templates/${id}/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}
