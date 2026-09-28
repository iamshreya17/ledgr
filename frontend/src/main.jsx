import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import InvestmentFormPage from './pages/InvestmentFormPage'
import InvestmentDetailPage from './pages/InvestmentDetailPage'
import InvestmentsPage from './pages/InvestmentsPage'
import PortfoliosPage from './pages/PortfoliosPage'
import GoalsPage from './pages/GoalsPage'
import RecurringPage from './pages/RecurringPage'
import SharedPage from './pages/SharedPage'
import SharedPublicPage from './pages/SharedPublicPage'
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext'
import { PreferencesProvider, usePreferences } from './context/PreferencesContext'
import './styles.css'

function ProtectedRoute() {
  const { authenticated } = useAuth()
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />
}

function Shell() {
  return <PortfolioProvider><PreferencesProvider><ShellContent /></PreferencesProvider></PortfolioProvider>
}

function ShellContent() {
  const { logout } = useAuth()
  const { portfolios, selectedId, setSelectedId, loading, error, refresh } = usePortfolio()
  const { viewMode, setViewMode, loading: preferencesLoading, saving: preferencesSaving, error: preferencesError, refresh: refreshPreferences } = usePreferences()
  const navigate = useNavigate()
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner"><div className="header-brand-group"><Link className="brand" to="/dashboard"><span className="brand-mark">L</span> ledgr<span className="brand-dot">.</span></Link><select className="portfolio-switcher" aria-label="Active portfolio" value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">All portfolios</option>{portfolios.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><nav className="header-nav"><NavLink to="/dashboard">Dashboard</NavLink><NavLink to="/investments" end>Investments</NavLink><NavLink to="/goals">Goals</NavLink><NavLink to="/recurring">Recurring</NavLink><NavLink to="/shares">Shared links</NavLink><NavLink to="/portfolios">Manage portfolios</NavLink><div className="view-mode-toggle" role="group" aria-label="Dashboard detail level"><button type="button" aria-pressed={viewMode === 'simple'} disabled={preferencesSaving} onClick={() => setViewMode('simple')}>Simple</button><button type="button" aria-pressed={viewMode === 'detailed'} disabled={preferencesSaving} onClick={() => setViewMode('detailed')}>Detailed</button></div><Link className="button primary-button nav-add" to="/investments/new"><span className="plus">+</span><span className="nav-add-label"> Add investment</span></Link><button className="text-button" onClick={() => { logout(); navigate('/login') }}>Sign out</button></nav></div></header>
    <main className="main-container">{loading || preferencesLoading ? <div className="loading">Loading your workspace…</div> : error ? <div className="alert error">{error} <button onClick={refresh}>Retry</button></div> : <>{preferencesError && <div className="alert error">{preferencesError} <button onClick={refreshPreferences}>Retry</button></div>}<Outlet /></>}</main>
  </div>
}

function App() {
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/shared/:token" element={<SharedPublicPage />} />
    <Route element={<ProtectedRoute />}><Route element={<Shell />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/investments" element={<InvestmentsPage />} />
      <Route path="/portfolios" element={<PortfoliosPage />} />
      <Route path="/goals" element={<GoalsPage />} />
      <Route path="/recurring" element={<RecurringPage />} />
      <Route path="/shares" element={<SharedPage />} />
      <Route path="/investments/new" element={<InvestmentFormPage />} />
      <Route path="/investments/:id/edit" element={<InvestmentFormPage />} />
      <Route path="/investments/:id" element={<InvestmentDetailPage />} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></BrowserRouter></AuthProvider>
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
