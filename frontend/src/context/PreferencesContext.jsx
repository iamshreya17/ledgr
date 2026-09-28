import { createContext, useContext, useEffect, useState } from 'react'
import { api, errorMessage } from '../api'

const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const [viewMode, setViewModeState] = useState('simple')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('preferences/')
      setViewModeState(data.view_mode)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setViewMode = async nextMode => {
    if (nextMode === viewMode || saving) return
    const previousMode = viewMode
    setViewModeState(nextMode)
    setSaving(true)
    setError('')
    try {
      const { data } = await api.patch('preferences/', { view_mode: nextMode })
      setViewModeState(data.view_mode)
    } catch (err) {
      setViewModeState(previousMode)
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return <PreferencesContext.Provider value={{ viewMode, setViewMode, loading, saving, error, refresh: load }}>{children}</PreferencesContext.Provider>
}

export const usePreferences = () => useContext(PreferencesContext)
