import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { AllocationChart, HistoryChart } from '../components/Charts'
import SummaryCards from '../components/SummaryCards'

export default function SharedPublicPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; setLoading(true); axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'}public/snapshot/${encodeURIComponent(token)}/`).then(response => { if (active) setData(response.data) }).catch(() => { if (active) setError('This share link is invalid, expired or revoked.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [token])
  return <div className="public-share"><header className="site-header"><div className="header-inner"><span className="brand"><span className="brand-mark">L</span> ledgr<span className="brand-dot">.</span></span><span>Shared portfolio snapshot · Read only</span></div></header><main className="main-container"><div className="page-heading"><div><div className="eyebrow">Shared view</div><h1>Portfolio snapshot</h1><p>Aggregate values only. Holdings and personal details are private.</p></div></div>{loading ? <div className="loading">Loading shared snapshot…</div> : error ? <div className="alert error">{error}</div> : data && <><SummaryCards summary={data.summary} /><div className="chart-grid"><section className="panel"><div className="panel-heading"><h2>Allocation</h2></div><AllocationChart breakdown={data.summary.breakdown_by_type} /></section><section className="panel"><div className="panel-heading"><h2>Value over time</h2></div><HistoryChart history={data.history} /></section></div></>}</main></div>
}
