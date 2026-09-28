import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage, getAllInvestments } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import InvestmentTable from '../components/InvestmentTable'
import { usePortfolio } from '../context/PortfolioContext'
import { usePreferences } from '../context/PreferencesContext'

export default function InvestmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const staleOnly = searchParams.get('stale') === '1'
  const { selectedId, refresh } = usePortfolio()
  const { viewMode } = usePreferences()
  const fileRef = useRef(null)
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try { setInvestments(await getAllInvestments(selectedId)) }
    catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [selectedId])

  const remove = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`investments/${pendingDelete.id}/`)
      setPendingDelete(null)
      await load()
    } catch (err) { setPendingDelete(null); setError(errorMessage(err)) }
    finally { setDeleting(false) }
  }

  const exportCsv = async () => {
    setExporting(true); setError('')
    try {
      const { data } = await api.get('investments/export/', { params: selectedId ? { portfolio: selectedId } : {}, responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'ledgr-investments.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) { setError(errorMessage(err)) }
    finally { setExporting(false) }
  }
  const importCsv = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setImporting(true); setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const { data } = await api.post('investments/import/', body, { params: selectedId ? { portfolio: selectedId } : {} })
      setImportResult(data)
      await Promise.all([load(), refresh({ showLoading: false })])
    } catch (err) { setError(errorMessage(err)) }
    finally { setImporting(false); event.target.value = '' }
  }
  const template = 'name,type,purchase_date,purchase_price,quantity,current_value,notes,portfolio_name\nExample Fund,MUTUAL_FUND,2026-01-01,10000.00,10,10500.00,Example,Personal\n'

  return <><div className="page-heading"><div><div className="eyebrow">Your investments</div><h1>Investments</h1><p>Search, sort and manage every asset in one place.</p></div><div className="heading-actions"><button className="button secondary-button" onClick={exportCsv} disabled={exporting}>{exporting ? 'Exporting…' : 'Export CSV'}</button><button className="button secondary-button" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Importing…' : 'Import CSV'}</button><Link className="button primary-button" to="/investments/new"><span className="plus">+</span> Add investment</Link></div></div>
    <input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={importCsv} aria-label="Choose CSV file to import" />
    <a className="template-link" href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download="ledgr-import-template.csv">Download template CSV</a>
    {error && <div className="alert error">{error} <button onClick={load}>Retry</button></div>}
    <label className="stale-toggle"><input type="checkbox" checked={staleOnly} onChange={e => setSearchParams(e.target.checked ? { stale: '1' } : {})} /> Show only investments stale for over 90 days</label>
    {loading ? <div className="loading">Loading investments…</div> : <section className="panel investments-panel investments-list-panel"><div className="panel-heading"><div><div className="eyebrow">Investments you have added</div><h2>Your investments <span className="count-badge">{investments.length}</span></h2></div></div><InvestmentTable investments={investments} onDelete={setPendingDelete} staleOnly={staleOnly} simple={viewMode === 'simple'} /></section>}
    <ConfirmDialog open={Boolean(pendingDelete)} title="Delete investment?" message="Are you sure you want to delete this investment? Its valuation history will also be removed." busy={deleting} onCancel={() => setPendingDelete(null)} onConfirm={remove} />
    {importResult && <div className="modal-backdrop"><div className="confirm-dialog import-results" role="dialog" aria-modal="true" aria-labelledby="import-results-title"><h2 id="import-results-title">Import complete</h2><p>{importResult.created} investments imported successfully. {importResult.errors.length} rows had errors.</p>{importResult.errors.length > 0 && <ul>{importResult.errors.map(item => <li key={item.row}><strong>Row {item.row}:</strong> {item.message}</li>)}</ul>}<div className="confirm-actions"><button className="button primary-button" onClick={() => setImportResult(null)}>Done</button></div></div></div>}
  </>
}
