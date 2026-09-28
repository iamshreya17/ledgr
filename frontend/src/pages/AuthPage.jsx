import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api'
import { useAuth } from '../context/AuthContext'

export default function AuthPage({ mode }) {
  const { authenticated, login, register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (authenticated) return <Navigate to="/dashboard" replace />
  const isRegister = mode === 'register'
  const submit = async event => {
    event.preventDefault()
    setError('')
    if (!username.trim() || !password || (isRegister && !email.trim())) { setError('Complete all fields.'); return }
    setBusy(true)
    try {
      if (isRegister) await register(username.trim(), email.trim(), password)
      else await login(username.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <div className="auth-page"><div className="auth-side"><div className="auth-side-inner"><div className="brand light"><span className="brand-mark">L</span> ledgr<span className="brand-dot">.</span></div><h1>Keep track of your money in one place.</h1><p>Write down what you invested and see what it is worth today.</p></div></div><div className="auth-main"><div className="auth-card"><div className="eyebrow">Ledgr</div><h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2><p className="muted">{isRegister ? 'Start by adding one investment.' : 'Sign in to see your investments.'}</p><form onSubmit={submit} noValidate><label className="field"><span>Username</span><input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="Your username" /></label>{isRegister && <label className="field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>}<label className="field"><span>Password</span><input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" /></label>{error && <div className="alert error">{error}</div>}<button className="button primary-button full-width" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button></form><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Ledgr?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p></div></div></div>
}
