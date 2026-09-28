import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { HistoryChart } from '../components/Charts'
import ConfirmDialog from '../components/ConfirmDialog'
import { dateLabel, formatCurrency, money, percent, TYPE_LABELS } from '../utils'
import InvestmentTypeIcon from '../components/InvestmentTypeIcon'

const today = () => new Date().toISOString().slice(0, 10)
const emptySnapshot = () => ({ date: today(), value: '' })
const validSnapshotValue = value => /^\d+(?:\.\d{1,2})?$/.test(String(value)) && Number(value) >= 0

export default function InvestmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [showAdded, setShowAdded] = useState(Boolean(location.state?.justAdded))
  const [investment, setInvestment] = useState(null)
  const [tax, setTax] = useState(null)
  const [taxError, setTaxError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSnapshot, setShowSnapshot] = useState(false)
  const [editingSnapshotId, setEditingSnapshotId] = useState(null)
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const [snapshotError, setSnapshotError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [{ data }, taxResult] = await Promise.all([api.get(`investments/${id}/`), api.get(`investments/${id}/tax-estimate/`).then(response => response.data).catch(err => { setTaxError(errorMessage(err)); return null })])
      setInvestment(data); setTax(taxResult)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (!showAdded) return
    const timer = window.setTimeout(() => setShowAdded(false), 2400)
    return () => window.clearTimeout(timer)
  }, [showAdded])

  const startNewSnapshot = () => {
    setEditingSnapshotId(null)
    setSnapshot(emptySnapshot())
    setSnapshotError('')
    setShowSnapshot(true)
  }
  const startEditSnapshot = item => {
    setEditingSnapshotId(item.id)
    setSnapshot({ date: item.date, value: item.value })
    setSnapshotError('')
    setShowSnapshot(true)
  }
  const cancelSnapshot = () => {
    setShowSnapshot(false)
    setEditingSnapshotId(null)
    setSnapshotError('')
  }
  const saveSnapshot = async event => {
    event.preventDefault()
    setSnapshotError('')
    if (!snapshot.date || !validSnapshotValue(snapshot.value)) {
      setSnapshotError('Enter a date and a value of zero or greater, with no more than 2 decimal places.')
      return
    }
    setSaving(true)
    try {
      if (editingSnapshotId) {
        await api.put(`investments/${id}/snapshots/${editingSnapshotId}/`, snapshot)
      } else {
        await api.post(`investments/${id}/snapshot/`, snapshot)
      }
      await load()
      cancelSnapshot()
    } catch (err) {
      setSnapshotError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      if (deleteTarget.type === 'investment') {
        await api.delete(`investments/${id}/`)
        navigate('/investments')
      } else {
        await api.delete(`investments/${id}/snapshots/${deleteTarget.id}/`)
        await load()
      }
      setDeleteTarget(null)
    } catch (err) {
      setDeleteTarget(null)
      setError(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return <>
    {showAdded && <div className="save-confirmation" role="status">✓ Investment added</div>}
    <div className="breadcrumb"><Link to="/investments">Investments</Link><span>/</span>Investment details</div>
    {loading ? <div className="loading">Loading investment…</div> : error && !investment ? <div className="alert error">{error}</div> : investment && <>
      <div className="page-heading detail-heading">
        <div><div className="eyebrow detail-type"><InvestmentTypeIcon type={investment.type} />{TYPE_LABELS[investment.type]}</div><h1>{investment.name}</h1><p>Purchased {dateLabel(investment.purchase_date)}</p></div>
        <div className="heading-actions"><Link className="button secondary-button" to={`/investments/${id}/edit`}>Edit</Link><button className="button secondary-button danger-button" onClick={() => setDeleteTarget({ type: 'investment' })}>Delete</button></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="detail-grid">
        <section className="panel detail-main">
          <div className="eyebrow">Current value</div>
          <div className="detail-value" title={money(investment.current_value)}>{formatCurrency(investment.current_value)}</div>
          <div className={`detail-gain ${Number(investment.gain_loss) < 0 ? 'loss-text' : 'gain-text'}`}>
            {Number(investment.gain_loss) >= 0 ? '+' : '−'}{money(Math.abs(Number(investment.gain_loss)))} (<span title={`${investment.gain_loss_pct}%`}>{percent(investment.gain_loss_pct)}</span>) since purchase
          </div>
          <div className="detail-facts">
            <div><span>Invested</span><strong title={money(investment.purchase_price)}>{formatCurrency(investment.purchase_price)}</strong></div>
            <div><span>Quantity</span><strong>{Number(investment.quantity).toLocaleString('en-IN')}</strong></div>
            <div><span>Purchase date</span><strong>{dateLabel(investment.purchase_date)}</strong></div>
            <div><span>Type</span><strong>{TYPE_LABELS[investment.type]}</strong></div>
          </div>
          {investment.notes && <div className="notes"><div className="eyebrow">Notes</div><p>{investment.notes}</p></div>}
        </section>
        <section className="panel history-panel">
          <div className="panel-heading"><div><div className="eyebrow">Value history</div><h2>Value over time</h2></div></div>
          <HistoryChart history={investment.snapshots} small />
          <button className="button secondary-button full-width" onClick={showSnapshot ? cancelSnapshot : startNewSnapshot}>{showSnapshot ? 'Cancel' : '+ Log new valuation'}</button>
          {showSnapshot && <form className="snapshot-form" onSubmit={saveSnapshot} noValidate>
            <div className="eyebrow">{editingSnapshotId ? 'EDIT VALUATION' : 'NEW VALUATION'}</div>
            <label className="field"><span>Date</span><input type="date" value={snapshot.date} onChange={event => setSnapshot({ ...snapshot, date: event.target.value })} /></label>
            <label className="field"><span>Value (₹)</span><input type="number" min="0" step="0.01" value={snapshot.value} onChange={event => setSnapshot({ ...snapshot, value: event.target.value })} placeholder="0.00" /></label>
            {snapshotError && <div className="alert error">{snapshotError}</div>}
            <button className="button primary-button full-width" disabled={saving}>{saving ? 'Saving…' : editingSnapshotId ? 'Save changes' : 'Save valuation'}</button>
          </form>}
        </section>
      </div>
      <section className="panel tax-panel"><div className="panel-heading"><div><div className="eyebrow">If sold today</div><h2>Tax estimate</h2></div></div>{taxError && <div className="alert error">{taxError}</div>}{tax && <><p>Held for {tax.holding_period_days} days · {tax.classification.replaceAll('_', ' ').toLowerCase()}</p><strong>{tax.estimated_tax === null ? 'Tax amount unavailable' : formatCurrency(tax.estimated_tax)}</strong><p>{tax.note}</p></>}<p className="tax-disclaimer">This is a simplified estimate for informational purposes only and is not tax advice. Consult a tax professional for accurate filing.</p></section>
      {investment.snapshots.length > 0 && <section className="panel snapshots-panel">
        <div className="panel-heading"><div><div className="eyebrow">Past entries</div><h2>Valuation history</h2></div></div>
        <div className="snapshot-list">{[...investment.snapshots].reverse().map(item => <div className="snapshot-row" key={item.id}>
          <span>{dateLabel(item.date)}</span><strong>{money(item.value)}</strong>
          <div className="snapshot-actions"><button className="icon-button" aria-label={`Edit valuation from ${dateLabel(item.date)}`} title="Edit valuation" onClick={() => startEditSnapshot(item)}>✎</button><button className="icon-button delete-icon" aria-label={`Delete valuation from ${dateLabel(item.date)}`} title="Delete valuation" onClick={() => setDeleteTarget({ type: 'snapshot', id: item.id })}>×</button></div>
        </div>)}</div>
      </section>}
    </>}
    <ConfirmDialog open={Boolean(deleteTarget)} title={deleteTarget?.type === 'snapshot' ? 'Delete valuation?' : 'Delete investment?'} message={deleteTarget?.type === 'snapshot' ? 'Are you sure you want to delete this entry?' : 'Are you sure you want to delete this investment? Its valuation history will also be removed.'} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
  </>
}
