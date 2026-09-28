import { useState } from 'react'
import { api, errorMessage } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import { usePortfolio } from '../context/PortfolioContext'

export default function PortfoliosPage() {
  const { portfolios, loading, error: loadError, refresh, selectedId, setSelectedId } = usePortfolio()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  const create = async event => {
    event.preventDefault()
    if (!newName.trim()) { setError('Enter a portfolio name.'); return }
    setBusy(true); setError('')
    try { await api.post('portfolios/', { name: newName.trim() }); setNewName(''); await refresh() }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  const rename = async id => {
    if (!editName.trim()) { setError('Enter a portfolio name.'); return }
    setBusy(true); setError('')
    try { await api.patch(`portfolios/${id}/`, { name: editName.trim() }); setEditingId(null); await refresh() }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  const makeDefault = async id => {
    setBusy(true); setError('')
    try { await api.patch(`portfolios/${id}/`, { is_default: true }); await refresh() }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!pendingDelete) return
    setBusy(true); setError('')
    try {
      await api.delete(`portfolios/${pendingDelete.id}/`)
      if (String(selectedId) === String(pendingDelete.id)) setSelectedId('')
      setPendingDelete(null)
      await refresh()
    } catch (err) { setPendingDelete(null); setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <><div className="page-heading"><div><div className="eyebrow">Your groups</div><h1>Manage portfolios</h1><p>Keep personal, family, and long term investments in their own groups.</p></div></div>
    {(error || loadError) && <div className="alert error">{error || loadError}</div>}
    <div className="portfolio-page-grid"><section className="panel"><div className="panel-heading"><div><div className="eyebrow">Your groups</div><h2>Portfolios</h2></div></div>
      {loading ? <div className="loading">Loading portfolios…</div> : portfolios.map(item => <div className="portfolio-row" key={item.id}>
        <div className="portfolio-name">{editingId === item.id ? <input value={editName} onChange={event => setEditName(event.target.value)} maxLength={100} aria-label="Portfolio name" /> : <><strong>{item.name}</strong>{item.is_default && <span className="type-pill">Default</span>}</>}</div>
        <div className="portfolio-actions">{editingId === item.id ? <><button onClick={() => rename(item.id)} disabled={busy}>Save</button><button onClick={() => setEditingId(null)}>Cancel</button></> : <><button onClick={() => { setEditingId(item.id); setEditName(item.name) }}>Rename</button>{!item.is_default && <button onClick={() => makeDefault(item.id)} disabled={busy}>Set default</button>}<button className="delete-link" onClick={() => setPendingDelete(item)} disabled={busy}>Delete</button></>}</div>
      </div>)}
    </section><section className="panel"><div className="panel-heading"><div><div className="eyebrow">New group</div><h2>Create a portfolio</h2></div></div><form onSubmit={create}><label className="field"><span>Portfolio name</span><input value={newName} onChange={event => setNewName(event.target.value)} maxLength={100} placeholder="e.g. Retirement" /></label><button className="button primary-button" disabled={busy}>{busy ? 'Saving…' : 'Create portfolio'}</button></form></section></div>
    <ConfirmDialog open={Boolean(pendingDelete)} title="Delete portfolio?" message="Delete this portfolio? Move or delete its investments first; a portfolio containing investments cannot be deleted." busy={busy} onCancel={() => setPendingDelete(null)} onConfirm={remove} />
  </>
}
