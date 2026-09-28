import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'
export const api = axios.create({ baseURL: API_URL })
const refreshClient = axios.create({ baseURL: API_URL })

export const getAccessToken = () => localStorage.getItem('ledgr_access')
export const setTokens = ({ access, refresh }) => {
  localStorage.setItem('ledgr_access', access)
  if (refresh) localStorage.setItem('ledgr_refresh', refresh)
}
export const clearTokens = () => {
  localStorage.removeItem('ledgr_access')
  localStorage.removeItem('ledgr_refresh')
}

api.interceptors.request.use(config => {
  const token = getAccessToken()
  if (token && !config.url?.startsWith('auth/')) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = null
api.interceptors.response.use(response => response, async error => {
  const original = error.config
  if (error.response?.status !== 401 || !original || original._retry || original.url?.startsWith('auth/')) {
    return Promise.reject(error)
  }
  const refresh = localStorage.getItem('ledgr_refresh')
  if (!refresh) {
    clearTokens()
    window.dispatchEvent(new Event('ledgr:logout'))
    return Promise.reject(error)
  }
  original._retry = true
  try {
    if (!refreshing) refreshing = refreshClient.post('auth/refresh/', { refresh }).then(({ data }) => data.access).finally(() => { refreshing = null })
    const access = await refreshing
    setTokens({ access })
    original.headers.Authorization = `Bearer ${access}`
    return api(original)
  } catch (refreshError) {
    clearTokens()
    window.dispatchEvent(new Event('ledgr:logout'))
    return Promise.reject(refreshError)
  }
})

export function errorMessage(error) {
  const data = error.response?.data
  if (!data) return 'Could not connect to the server. Please try again.'
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  return Object.entries(data).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' • ')
}

export async function getAllInvestments(portfolioId = '') {
  const investments = []
  let next = portfolioId ? `investments/?portfolio=${encodeURIComponent(portfolioId)}` : 'investments/'
  while (next) {
    const { data } = await api.get(next)
    investments.push(...data.results)
    next = data.next
  }
  return investments
}

export async function getGoalsWithProgress() {
  const { data: goals } = await api.get('goals/')
  return Promise.all(goals.map(async goal => {
    const { data: progress } = await api.get(`goals/${goal.id}/progress/`)
    return { ...goal, progress }
  }))
}
