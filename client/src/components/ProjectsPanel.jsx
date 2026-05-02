/**
 * Orbin AI — Save/Load Projects Panel
 * Saves generated designs and lists recent projects.
 */

import { useState, useEffect } from 'react'
import { Save, FolderOpen, Trash2, Check, AlertCircle } from 'lucide-react'
import { api } from '../api/client.js'
import { usePreferences } from '../context/PreferencesContext.jsx'

export default function ProjectsPanel({ modules, onLoadDesign }) {
  const { t } = usePreferences()
  const [projects, setProjects] = useState([])
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [label,    setLabel]    = useState('')
  const [error,    setError]    = useState(null)

  const loadList = async () => {
    try {
      const res = await api.listProjects()
      setProjects(res.projects || [])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { loadList() }, [])

  const save = async () => {
    if (!modules || modules.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const designLabel = label.trim() || `Proyecto Modular ${new Date().toLocaleDateString()}`
      // Send the entire modules array
      await api.saveProject({ modules }, designLabel)
      setSaved(true)
      setLabel('')
      setTimeout(() => setSaved(false), 2000)
      loadList()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const del = async (id) => {
    try {
      await api.deleteProject(id)
      setProjects(p => p.filter(x => x.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const load = async (id) => {
    try {
      const res = await api.getProject(id)
      if (res.design) onLoadDesign({ design: res.design })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold flex items-center gap-2 text-sm">
        <FolderOpen size={14} className="text-primary" /> {t('saved_projects')}
      </h3>

      {/* Save current */}
      {modules && modules.length > 0 && (
        <div className="flex gap-2">
          <input
            className="input-field text-sm py-2 flex-1"
            placeholder={t('project_name_placeholder')}
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary px-3 py-2 flex items-center gap-1.5 text-sm whitespace-nowrap"
          >
            {saved
              ? <><Check size={12} /> {t('project_saved')}</>
              : <><Save size={12} /> {saving ? t('saving') : t('save_project')}</>
            }
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          <AlertCircle size={11} /> {error}
        </div>
      )}

      {/* Project list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">{t('no_projects')}</p>
        ) : (
          projects.map(p => (
            <div key={p.id} className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-surface-3 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{p.label}</p>
                <p className="text-xs text-muted font-mono">{p.id}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => load(p.id)}
                  className="p-1.5 rounded hover:bg-primary/20 hover:text-primary transition-colors"
                  title={t('load')}
                >
                  <FolderOpen size={12} />
                </button>
                <button
                  onClick={() => del(p.id)}
                  className="p-1.5 rounded hover:bg-danger/20 hover:text-danger transition-colors"
                  title={t('delete')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
