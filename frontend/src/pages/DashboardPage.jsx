import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage, getAllInvestments, getGoalsWithProgress } from '../api'
import { AllocationChart, HistoryChart } from '../components/Charts'
import ConfirmDialog from '../components/ConfirmDialog'
import InvestmentTable from '../components/InvestmentTable'
import SummaryCards from '../components/SummaryCards'
import PerformersWidget from '../components/PerformersWidget'
import GoalsWidget from '../components/GoalsWidget'
import { usePortfolio } from '../context/PortfolioContext'
import { usePreferences } from '../context/PreferencesContext'
import { formatCurrency } from '../utils'

export default function DashboardPage() {
  const { selectedId } = usePortfolio()
  const { viewMode } = usePreferences()
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [performers, setPerformers] = useState(null)
  const [goals, setGoals] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [tax, setTax] = useState(null)
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [staleDismissed, setStaleDismissed] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [sharing, setSharing] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = selectedId ? { portfolio: selectedId } : {}
      const [summaryResponse, historyResponse, performersResponse, items, goalItems, upcomingResponse, taxResponse] = await Promise.all([
        api.get('dashboard/summary/', { params }), api.get('dashboard/history/', { params }), api.get('dashboard/performers/', { params }), getAllInvestments(selectedId), getGoalsWithProgress(), api.get('recurring-investments/upcoming/', { params: { ...params, days: 30 } }), api.get('dashboard/tax-estimate/', { params }),
      ])
      setSummary(summaryResponse.data); setHistory(historyResponse.data); setPerformers(performersResponse.data); setInvestments(items); setGoals(goalItems); setUpcoming(upcomingResponse.data); setTax(taxResponse.data)
    } catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [selectedId])
  const remove = async () => {
    const item = pendingDelete
    if (!item) return
    setDeleting(item.id); setError('')
    try { await api.delete(`investments/${item.id}/`); setPendingDelete(null); await load() }
    catch (err) { setPendingDelete(null); setError(errorMessage(err)) }
    finally { setDeleting(null) }
  }
  const createShare = async () => {
    setSharing(true); setError('')
    try { const { data } = await api.post('shared-snapshots/', { portfolio: selectedId || null }); setShareLink(data.share_url) }
    catch (err) { setError(errorMessage(err)) }
    finally { setSharing(false) }
  }
  return <>
    {error && <div className="alert error">{error} <button onClick={load}>Retry</button></div>}
    {loading ? <div className="loading">Loading your portfolio…</div> : summary && <>
      <SummaryCards summary={summary} />
      {viewMode === 'detailed' && <>
      <div className="dashboard-actions"><Link className="button primary-button" to="/investments/new"><span className="plus">+</span> Add investment</Link><button className="button secondary-button" onClick={() => { setShareLink(''); setShareOpen(true) }}>Share snapshot</button></div>
      {summary.stale_investments_count > 0 && !staleDismissed && <div className="stale-banner"><Link to="/investments?stale=1">{summary.stale_investments_count} investments haven't been updated in over 90 days. Review them →</Link><button aria-label="Dismiss stale reminder" onClick={() => setStaleDismissed(true)}>×</button></div>}
      {tax && <section className="panel tax-panel"><div className="eyebrow">If sold today</div><h2>Total estimated tax liability</h2><strong>{formatCurrency(tax.estimated_tax)}</strong><p>{tax.skipped_count} investment{tax.skipped_count === 1 ? '' : 's'} omitted because a reliable rate needs more information. {tax.note}</p><p className="tax-disclaimer">This is a simplified estimate for informational purposes only and is not tax advice. Consult a tax professional for accurate filing.</p></section>}
      <PerformersWidget performers={performers} />
      <GoalsWidget goals={goals} />
      <Link className="panel sip-widget" to="/recurring"><span><span className="eyebrow">Upcoming installments</span><strong>{upcoming.length} installment{upcoming.length === 1 ? '' : 's'}</strong></span><strong>{formatCurrency(upcoming.reduce((total, item) => total + Number(item.amount), 0))} →</strong></Link>
      </>}
      <div className={`chart-grid ${viewMode === 'simple' ? 'simple-chart-grid' : ''}`}><section className="panel"><div className="panel-heading"><div><div className="eyebrow">Where your money is</div><h2>Investment types</h2></div></div><AllocationChart breakdown={summary.breakdown_by_type} /></section>{viewMode === 'detailed' && <section className="panel"><div className="panel-heading"><div><div className="eyebrow">Changes over time</div><h2>Value over time</h2></div></div><HistoryChart history={history} /></section>}</div>
      <section className="panel investments-panel"><div className="panel-heading"><div><div className="eyebrow">Your investments</div><h2>All investments <span className="count-badge">{investments.length}</span></h2></div></div><InvestmentTable investments={investments} onDelete={setPendingDelete} simple={viewMode === 'simple'} /></section>
      {deleting && <div className="status-note">Deleting investment…</div>}
    </>}
    <ConfirmDialog open={Boolean(pendingDelete)} title="Delete investment?" message="Are you sure you want to delete this investment? Its valuation history will also be removed." busy={Boolean(deleting)} onCancel={() => setPendingDelete(null)} onConfirm={remove} />
    {shareOpen && <div className="modal-backdrop"><div className="modal-card panel"><h2>Share portfolio snapshot</h2><p>This link shows aggregate values only. Individual investments remain private.</p>{shareLink ? <div className="share-link-row"><input readOnly value={shareLink} onFocus={e => e.target.select()} /><button className="button secondary-button" onClick={async () => { try { await navigator.clipboard.writeText(shareLink) } catch { setError('Copy failed. Select and copy the link manually.') } }}>Copy</button></div> : <button className="button primary-button" disabled={sharing} onClick={createShare}>{sharing ? 'Creating…' : 'Create link'}</button>}<div className="form-actions"><Link to="/shares" onClick={() => setShareOpen(false)}>Manage shared links</Link><button className="button secondary-button" onClick={() => setShareOpen(false)}>Close</button></div></div></div>}
  </>
}
