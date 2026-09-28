import { createContext, useContext, useEffect, useState } from 'react'
import { api, errorMessage } from '../api'

const PortfolioContext = createContext(null)
const STORAGE_KEY = 'ledgr_selected_portfolio'

export function PortfolioProvider({ children }) {
  const [portfolios, setPortfolios] = useState([])
  const [selectedId, setSelectedId] = useState(localStorage.getItem(STORAGE_KEY) || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const { data } = await api.get('portfolios/')
      setPortfolios(data)
      setSelectedId(current => current && !data.some(item => String(item.id) === String(current)) ? '' : current)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      if (showLoading) setLoading(false)
    }
  }
  useEffect(() => { refresh() }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, selectedId) }, [selectedId])

  const defaultPortfolio = portfolios.find(item => item.is_default)
  return <PortfolioContext.Provider value={{ portfolios, selectedId, setSelectedId, defaultPortfolio, loading, error, refresh }}>{children}</PortfolioContext.Provider>
}

export const usePortfolio = () => useContext(PortfolioContext)
