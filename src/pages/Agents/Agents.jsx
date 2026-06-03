import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAgents, deleteAgent, copyAgent } from '../../api/agents'
import './Agents.css'

const colors = ['#6366f1', '#4f46e5', '#818cf8', '#6366f1', '#4f46e5', '#818cf8', '#6366f1', '#4338ca']
const icons = ['💻', '✍️', '📊', '🌍', '🎨', '📋', '💁', '📖']

function Agents() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      const data = await getAgents()
      const formatted = data.map((agent, index) => ({
        id: agent.id,
       name: agent.name || agent.alias || '未命名',
        alias: agent.alias,
        description: agent.description || agent.tags || '暂无描述',
        icon: icons[index % icons.length],
       color: colors[index % colors.length],
        enabled: agent.enabled,
        uri: agent.uri,
        tags: agent.tags
      }))
      setAgents(formatted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除该智能体吗？')) return
    try {
      await deleteAgent(id)
      setAgents(agents.filter(a => a.id !== id))
    } catch (error) {
      alert('删除失败: ' + error.message)
    }
  }

  const handleAdd = () => {
    navigate('/agent/add')
  }

  const handleEdit = (agent) => {
    navigate(`/agent/edit/${agent.id}`, { state: { agent } })
  }

  const handleCopy = async (agent) => {
    try {
      await copyAgent(agent.id)
      await fetchAgents()
    } catch (err) {
      alert('复制失败: ' + err.message)
    }
  }

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="agents-page">
        <div className="agents-header">
          <h1>智能体中心</h1>
          <p>选择合适的 AI 智能体开始对话</p>
        </div>
        <div className="agents-loading">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="agents-page">
        <div className="agents-error">加载失败: {error}</div>
      </div>
    )
  }

  return (
    <div className="agents-page">
      <div className="agents-header">
        <h1>智能体中心</h1>
        <p>选择合适的 AI 智能体开始对话</p>
        <div className="agents-header-actions">
          <input
            type="text"
            placeholder="搜索智能体..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="agents-search-input"
          />
          <button className="agents-add-btn" onClick={handleAdd}>+ 新增智能体</button>
        </div>
      </div>
      {filteredAgents.length === 0 ? (
        <div className="agents-empty">暂无智能体，或没有匹配的搜索结果</div>
      ) : (
        <div className="agents-grid">
          {filteredAgents.map(agent => (
            <div key={agent.id} className="agent-card">
              <div className="agent-card-header">
                <div className="agent-icon" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
                  {agent.icon}
                </div>
                <div className="agent-info">
                  <h3>{agent.name}</h3>
                  <p>{agent.description}</p>
                  {agent.enabled === false && <span className="agent-disabled">已禁用</span>}
                </div>
              </div>
              <div className="agent-card-footer">
                <button className="agent-btn" type="button">开始对话</button>
                <div className="agent-actions">
                  <button type="button" className="action-btn copy" onClick={() => handleCopy(agent)} title="复制">复制</button>
                  <button type="button" className="action-btn edit" onClick={() => handleEdit(agent)}>编辑</button>
                  <button type="button" className="action-btn delete" onClick={() => handleDelete(agent.id)}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Agents
