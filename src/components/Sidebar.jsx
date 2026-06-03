import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const menuItems = [
  { name: '对话', icon: '💬', path: '/chat' },
  { name: '漫游', icon: '🌐', path: '/explore' },
  { name: '智能体', icon: '🤖', path: '/agent' },
  { name: '知识库', icon: '📚', path: '/knowledge' },
  { name: '模板管理', icon: '📄', path: '/template' },
  { name: '笔记', icon: '📝', path: '/notes' },
  { name: '导图', icon: '🗺️', path: '/mindmap' },
  { name: '报告', icon: '📊', path: '/report' }
]

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-text">AI Agent</span>
      </div>
      <nav className="menu">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
          >
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-text">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
