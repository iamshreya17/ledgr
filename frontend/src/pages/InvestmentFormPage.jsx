import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import InvestmentForm from '../components/InvestmentForm'
import { usePortfolio } from '../context/PortfolioContext'

export default function InvestmentFormPage() {
  const { portfolios, selectedId, defaultPortfolio, loading: portfoliosLoading, error: portfolioError } = usePortfolio()
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const [initial, setInitial] = useState(null)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!editing) return
    let active = true
    api.get(`investments/${id}/`).then(({ data }) => { if (active) setInitial(data) }).catch(err => { if (active) setError(errorMessage(err)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, editing])
  const save = async form => {
    setSaving(true); setError('')
    try {
      const { data } = editing ? await api.put(`investments/${id}/`, form) : await api.post('investments/', form)
      navigate(`/investments/${data.id}`, { state: { justAdded: !editing } })
    } catch (err) { setError(errorMessage(err)); throw err }
    finally { setSaving(false) }
  }
  return <><div className="breadcrumb"><Link to="/dashboard">Dashboard</Link><span>/</span>{editing ? 'Edit investment' : 'New investment'}</div><div className="page-heading compact"><div><div className="eyebrow">Investment details</div><h1>{editing ? 'Edit investment' : 'Add an investment'}</h1><p>{editing ? 'Update this investment.' : 'Enter the amount you paid and what it is worth today.'}</p></div></div><section className="panel form-panel"><div className="form-intro"><div><strong>Amounts in rupees</strong><p>You can change the current value whenever you have a new one.</p></div></div>{loading || portfoliosLoading ? <div className="loading">Loading investment…</div> : portfolioError ? <div className="alert error">{portfolioError}</div> : editing && !initial ? <div className="alert error">{error || 'Investment not found.'}</div> : <><InvestmentForm initial={initial} portfolios={portfolios} defaultPortfolioId={selectedId || defaultPortfolio?.id || ''} onSubmit={save} submitting={saving} submitLabel={editing ? 'Save changes' : 'Add investment'} />{error && <p className="form-error">{error}</p>}</>}</section></>
}
