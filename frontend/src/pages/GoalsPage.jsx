import { useEffect, useState } from 'react'
import { api, errorMessage, getGoalsWithProgress } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import { usePortfolio } from '../context/PortfolioContext'
import { dateLabel, formatCurrency, percent } from '../utils'

const emptyGoal = { name: '', target_amount: '', target_date: '', portfolio: '' }

export default function GoalsPage() {
  const { portfolios } = usePortfolio()
  const [goals, setGoals] = useState([])
  const [form, setForm] = useState(emptyGoal)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try { setGoals(await getGoalsWithProgress()) }
    catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const create = async event => {
    event.preventDefault()
    if (!form.name.trim() || !form.target_date || !/^\d+(?:\.\d{1,2})?$/.test(form.target_amount) || Number(form.target_amount) <= 0) {
      setError('Enter a name, a positive target amount with at most 2 decimal places, and a target date.')
      return
    }
    setSaving(true); setError('')
    try {
      await api.post('goals/', { ...form, name: form.name.trim(), portfolio: form.portfolio || null })
      setForm(emptyGoal)
      await load()
    } catch (err) { setError(errorMessage(err)) }
    finally { setSaving(false) }
  }
  const remove = async () => {
    if (!pendingDelete) return
    setSaving(true); setError('')
    try { await api.delete(`goals/${pendingDelete.id}/`); setPendingDelete(null); await load() }
    catch (err) { setPendingDelete(null); setError(errorMessage(err)) }
    finally { setSaving(false) }
  }

  return <><div className="page-heading"><div><div className="eyebrow">Your plans</div><h1>Financial goals</h1><p>Set a target and see how much you have saved toward it.</p></div></div>
    {error && <div className="alert error">{error} <button onClick={load}>Retry</button></div>}
    <div className="goals-page-grid"><section className="goals-list">{loading ? <div className="loading">Loading goals…</div> : goals.length ? goals.map(goal => {
      const progress = goal.progress
      const state = progress.on_track === true ? 'on-track' : progress.on_track === false ? 'behind' : 'unknown'
      return <article className="panel goal-card" key={goal.id}><div className="goal-card-top"><div><div className="eyebrow">{goal.portfolio ? portfolios.find(item => item.id === goal.portfolio)?.name || 'Portfolio goal' : 'All portfolios'}</div><h2>{goal.name}</h2></div><button className="icon-button delete-icon" aria-label={`Delete ${goal.name}`} title="Delete goal" onClick={() => setPendingDelete(goal)}>×</button></div><div className="goal-amounts"><strong>{formatCurrency(progress.current_amount)}</strong><span>of {formatCurrency(goal.target_amount)}</span></div><div className={`goal-track ${state}`}><i style={{ width: `${Math.min(100, Math.max(0, Number(progress.progress_pct)))}%` }} /></div><div className="goal-meta"><span>{percent(progress.progress_pct)} complete</span><span>{formatCurrency(progress.remaining_amount)} remaining</span></div><div className="goal-dates"><span>Target: {dateLabel(goal.target_date)}</span><span>Projected: {progress.projected_completion_date ? dateLabel(progress.projected_completion_date) : 'Not enough history'}</span></div><span className={`goal-status ${state}`}>{progress.on_track === true ? 'On track' : progress.on_track === false ? 'Behind schedule' : 'Projection unavailable'}</span></article>
    }) : <div className="panel empty-goals">No goals yet. Add one to start tracking your progress.</div>}</section>
    <section className="panel goal-form-panel"><div className="panel-heading"><div><div className="eyebrow">Plan ahead</div><h2>New goal</h2></div></div><form onSubmit={create} noValidate><label className="field"><span>Goal name</span><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength={200} placeholder="e.g. House down payment" /></label><label className="field"><span>Target amount (₹)</span><input type="number" min="0.01" step="0.01" value={form.target_amount} onChange={event => setForm({ ...form, target_amount: event.target.value })} placeholder="0.00" /></label><label className="field"><span>Target date</span><input type="date" value={form.target_date} onChange={event => setForm({ ...form, target_date: event.target.value })} /></label><label className="field"><span>Portfolio <em>optional</em></span><select value={form.portfolio} onChange={event => setForm({ ...form, portfolio: event.target.value })}><option value="">All portfolios</option>{portfolios.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="button primary-button" disabled={saving}>{saving ? 'Saving…' : 'Create goal'}</button></form></section></div>
    <ConfirmDialog open={Boolean(pendingDelete)} title="Delete goal?" message="Are you sure you want to delete this goal?" busy={saving} onCancel={() => setPendingDelete(null)} onConfirm={remove} />
  </>
}
