import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import { usePortfolio } from '../context/PortfolioContext'
import { dateLabel, formatCurrency } from '../utils'

const empty = { name: '', type: 'MUTUAL_FUND', amount_per_installment: '', frequency: 'MONTHLY', start_date: '', end_date: '', portfolio: '', is_active: true }
const types = ['STOCK', 'MUTUAL_FUND', 'CRYPTO', 'FD', 'REAL_ESTATE', 'GOLD', 'BOND', 'PPF', 'EPF', 'NPS', 'RD', 'SGB', 'OTHER']

export default function RecurringPage() {
  const { portfolios, selectedId } = usePortfolio()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [logItem, setLogItem] = useState(null)
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: '' })
  const [pendingDelete, setPendingDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try { setItems((await api.get('recurring-investments/', { params: selectedId ? { portfolio: selectedId } : {} })).data) }
    catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [selectedId])
  const save = async event => {
    event.preventDefault()
    if (!form.name.trim() || !form.start_date || !/^\d+(?:\.\d{1,2})?$/.test(form.amount_per_installment) || Number(form.amount_per_installment) <= 0 || (form.end_date && form.end_date < form.start_date)) {
      setError('Enter a name, positive amount, valid start date and an end date after the start date.')
      return
    }
    setSaving(true); setError('')
    try {
      const payload = { ...form, portfolio: form.portfolio || null, end_date: form.end_date || null }
      if (editing) await api.put(`recurring-investments/${editing}/`, payload)
      else await api.post('recurring-investments/', payload)
      setEditing(null); setForm(empty); await load()
    } catch (err) { setError(errorMessage(err)) }
    finally { setSaving(false) }
  }
  const log = async event => {
    event.preventDefault()
    if (!logForm.date || !/^\d+(?:\.\d{1,2})?$/.test(logForm.amount) || Number(logForm.amount) <= 0) { setError('Enter a date and positive installment amount.'); return }
    setSaving(true); setError('')
    try { await api.post(`recurring-investments/${logItem.id}/log-installment/`, logForm); setLogItem(null); await load() }
    catch (err) { setError(errorMessage(err)) }
    finally { setSaving(false) }
  }
  const remove = async () => {
    setSaving(true); setError('')
    try { await api.delete(`recurring-investments/${pendingDelete.id}/`); setPendingDelete(null); await load() }
    catch (err) { setError(errorMessage(err)) }
    finally { setSaving(false) }
  }
  return <><div className="page-heading"><div><div className="eyebrow">Regular investing</div><h1>Recurring investments</h1><p>Set a regular amount and record each payment.</p></div></div>
    {error && <div className="alert error">{error} <button onClick={load}>Retry</button></div>}
    <div className="goals-page-grid"><section className="goals-list">{loading ? <div className="loading">Loading recurring investments…</div> : items.length ? items.map(item => <article className="panel goal-card" key={item.id}><div className="goal-card-top"><div><div className="eyebrow">{item.type.replaceAll('_', ' ')} · {item.frequency.toLowerCase()}</div><h2>{item.name}</h2></div><button className="icon-button delete-icon" aria-label={`Delete ${item.name}`} onClick={() => setPendingDelete(item)}>×</button></div><div className="goal-amounts"><strong>{formatCurrency(item.amount_per_installment)}</strong><span>per installment</span></div><p>Next due: {item.next_due_date ? dateLabel(item.next_due_date) : 'None scheduled'}</p><p>You've invested {formatCurrency(item.total_invested || 0)} across {item.installments_count} installments.</p><div className="form-actions"><button className="button primary-button" onClick={() => { setLogItem(item); setLogForm({ date: item.next_due_date || new Date().toISOString().slice(0, 10), amount: item.amount_per_installment }) }}>Log this installment</button><button className="button secondary-button" onClick={() => { setEditing(item.id); setForm({ name: item.name, type: item.type, amount_per_installment: item.amount_per_installment, frequency: item.frequency, start_date: item.start_date, end_date: item.end_date || '', portfolio: item.portfolio || '', is_active: item.is_active }) }}>Edit</button></div></article>) : <div className="panel empty-goals">No recurring investments yet.</div>}</section>
    <section className="panel goal-form-panel"><div className="panel-heading"><div><div className="eyebrow">Add a plan</div><h2>{editing ? 'Edit recurring investment' : 'New recurring investment'}</h2></div></div><form onSubmit={save} noValidate><label className="field"><span>Name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={200} /></label><label className="field"><span>Type</span><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{types.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label><label className="field"><span>Amount per installment (₹)</span><input type="number" min="0.01" step="0.01" value={form.amount_per_installment} onChange={e => setForm({ ...form, amount_per_installment: e.target.value })} /></label><label className="field"><span>Frequency</span><select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option></select></label><label className="field"><span>Start date</span><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></label><label className="field"><span>End date <em>optional</em></span><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></label><label className="field"><span>Portfolio <em>optional</em></span><select value={form.portfolio} onChange={e => setForm({ ...form, portfolio: e.target.value })}><option value="">Default portfolio</option>{portfolios.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</span></label><button className="button primary-button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create recurring investment'}</button>{editing && <button type="button" className="button secondary-button" onClick={() => { setEditing(null); setForm(empty) }}>Cancel edit</button>}</form></section></div>
    {logItem && <div className="modal-backdrop"><div className="modal-card panel"><h2>Log installment</h2><p>{logItem.name}</p><form onSubmit={log}><label className="field"><span>Date</span><input type="date" value={logForm.date} onChange={e => setLogForm({ ...logForm, date: e.target.value })} /></label><label className="field"><span>Amount (₹)</span><input type="number" min="0.01" step="0.01" value={logForm.amount} onChange={e => setLogForm({ ...logForm, amount: e.target.value })} /></label><div className="form-actions"><button type="button" className="button secondary-button" onClick={() => setLogItem(null)}>Cancel</button><button className="button primary-button" disabled={saving}>Log installment</button></div></form></div></div>}
    <ConfirmDialog open={Boolean(pendingDelete)} title="Delete recurring investment?" message="Logged investments will remain in your portfolio." busy={saving} onCancel={() => setPendingDelete(null)} onConfirm={remove} />
  </>
}
