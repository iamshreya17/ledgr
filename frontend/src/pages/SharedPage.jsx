import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import { usePortfolio } from '../context/PortfolioContext'
import { dateLabel } from '../utils'

export default function SharedPage() {
  const { portfolios, selectedId } = usePortfolio()
  const [links, setLinks] = useState([])
  const [portfolio, setPortfolio] = useState(selectedId || '')
  const [expiresAt, setExpiresAt] = useState('')
  const [created, setCreated] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const load = async () => { setLoading(true); setError(''); try { setLinks((await api.get('shared-snapshots/')).data) } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const create = async event => {
    event.preventDefault(); setSaving(true); setError('')
    try { const { data } = await api.post('shared-snapshots/', { portfolio: portfolio || null, expires_at: expiresAt || null }); setCreated(data); await load() }
    catch (err) { setError(errorMessage(err)) }
    finally { setSaving(false) }
  }
  const revoke = async () => {
    setSaving(true); setError('')
    try { await api.delete(`shared-snapshots/${pendingDelete.id}/`); setPendingDelete(null); await load() }
    catch (err) { setError(errorMessage(err)) }
    finally { setSaving(false) }
  }
  const copy = async url => { try { await navigator.clipboard.writeText(url) } catch { setError('Copy failed. Select and copy the link manually.') } }
  return <><div className="page-heading"><div><div className="eyebrow">Read only sharing</div><h1>Shared links</h1><p>Share an aggregate view of your portfolio. Individual investments stay private.</p></div></div>{error && <div className="alert error">{error}</div>}<div className="goals-page-grid"><section className="goals-list">{loading ? <div className="loading">Loading shared links…</div> : links.length ? links.map(item => <article className="panel goal-card" key={item.id}><h2>{item.portfolio ? portfolios.find(p => p.id === item.portfolio)?.name || 'Portfolio' : 'All portfolios'}</h2><p>Created {dateLabel(item.created_at.slice(0, 10))}{item.expires_at ? ` · Expires ${dateLabel(item.expires_at)}` : ' · No expiry'}</p><div className="share-link-row"><input readOnly aria-label="Share URL" value={item.share_url} onFocus={e => e.target.select()} /><button className="button secondary-button" onClick={() => copy(item.share_url)}>Copy</button></div><button className="button secondary-button danger-button" onClick={() => setPendingDelete(item)}>Revoke</button></article>) : <div className="panel empty-goals">No active links yet.</div>}</section><section className="panel goal-form-panel"><h2>Create share link</h2><form onSubmit={create}><label className="field"><span>Portfolio</span><select value={portfolio} onChange={e => setPortfolio(e.target.value)}><option value="">All portfolios</option>{portfolios.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Expiry <em>optional</em></span><input type="date" min={new Date().toISOString().slice(0, 10)} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></label><button className="button primary-button" disabled={saving}>{saving ? 'Creating…' : 'Create link'}</button></form>{created && <div className="share-created"><strong>Link ready</strong><div className="share-link-row"><input readOnly value={created.share_url} onFocus={e => e.target.select()} /><button className="button secondary-button" onClick={() => copy(created.share_url)}>Copy</button></div></div>}</section></div><ConfirmDialog open={Boolean(pendingDelete)} title="Revoke shared link?" message="Anyone using this link will lose access immediately." busy={saving} onCancel={() => setPendingDelete(null)} onConfirm={revoke} /></>
}
