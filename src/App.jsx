import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Chat from './pages/Chat'
import Agents from './pages/Agents'
import AgentForm from './pages/AgentForm'
import KnowledgeBase from './pages/KnowledgeBase'
import KnowledgeDetail from './pages/KnowledgeBase/Detail'
import KnowledgeForm from './pages/KnowledgeBase/KnowledgeForm'
import Template from './pages/Template'
import TemplateEditor from './pages/Template/TemplateEditor'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/agent" element={<Agents />} />
          <Route path="/agent/add" element={<AgentForm />} />
          <Route path="/agent/edit/:id" element={<AgentForm />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/knowledge/add" element={<KnowledgeForm />} />
          <Route path="/knowledge/edit/:id" element={<KnowledgeForm />} />
          <Route path="/knowledge/:id" element={<KnowledgeDetail />} />
          <Route path="/template" element={<Template />} />
          <Route path="/template/add" element={<Template />} />
          <Route path="/template/edit/:id" element={<TemplateEditor />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
