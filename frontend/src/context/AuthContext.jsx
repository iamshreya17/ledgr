import { createContext, useContext, useEffect, useState } from 'react'
import { api, clearTokens, getAccessToken, setTokens } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(Boolean(getAccessToken() || localStorage.getItem('ledgr_refresh')))
  useEffect(() => {
    const handleLogout = () => setAuthenticated(false)
    window.addEventListener('ledgr:logout', handleLogout)
    return () => window.removeEventListener('ledgr:logout', handleLogout)
  }, [])
  const login = async (username, password) => {
    const { data } = await api.post('auth/login/', { username, password })
    setTokens(data)
    setAuthenticated(true)
  }
  const register = async (username, email, password) => {
    await api.post('auth/register/', { username, email, password })
    await login(username, password)
  }
  const logout = () => { clearTokens(); setAuthenticated(false) }
  return <AuthContext.Provider value={{ authenticated, login, register, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
