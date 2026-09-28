import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { dateLabel, money, percent, TYPE_LABELS } from '../utils'
import InvestmentTypeIcon from './InvestmentTypeIcon'

const detailedColumns = [
  ['name', 'Investment'], ['type', 'Type'], ['purchase_date', 'Purchase date'],
  ['purchase_price', 'Invested'], ['current_value', 'Current value'], ['gain_loss', 'Gain / loss'],
  ['last_valuation_date', 'Last updated'],
]
const simpleColumns = [
  ['name', 'Investment'], ['type', 'Type'], ['current_value', 'Current value'], ['gain_loss_pct', 'Gain %'],
]

export default function InvestmentTable({ investments, onDelete, staleOnly = false, simple = false }) {
  const [sort, setSort] = useState({ key: simple ? 'current_value' : 'purchase_date', direction: 'desc' })
  const [query, setQuery] = useState('')
  const [type, setType] = useState('ALL')
  const columns = simple ? simpleColumns : detailedColumns
  const sorted = useMemo(() => investments.filter(item => (!staleOnly || item.days_since_last_update > 90) && (type === 'ALL' || item.type === type) && item.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => {
    const numeric = ['purchase_price', 'current_value', 'gain_loss', 'gain_loss_pct'].includes(sort.key)
    const comparison = numeric ? Number(a[sort.key]) - Number(b[sort.key]) : String(a[sort.key]).localeCompare(String(b[sort.key]))
    return sort.direction === 'asc' ? comparison : -comparison
  }), [investments, sort, query, type, staleOnly])
  const changeSort = key => setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  return <><div className="table-tools"><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search investments" placeholder="Search investments" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filter by investment type" value={type} onChange={event => setType(event.target.value)}><option value="ALL">All types</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="table-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key}><button className="sort-button" onClick={() => changeSort(key)}>{label} <span>{sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>)}{!simple && <th>Actions</th>}</tr></thead><tbody>{sorted.map(item => <tr key={item.id}>
    <td><Link className="investment-link" to={`/investments/${item.id}`}>{item.name}</Link>{!simple && item.days_since_last_update > 90 && <span className="stale-badge" title={`${item.days_since_last_update} days since last update`}> ⚠</span>}</td>
    <td><span className="type-pill"><InvestmentTypeIcon type={item.type} />{TYPE_LABELS[item.type]}</span></td>
    {simple ? <><td className="strong">{money(item.current_value)}</td><td className={Number(item.gain_loss_pct) < 0 ? 'loss-text strong' : 'gain-text strong'} title={`${item.gain_loss_pct}%`}>{percent(item.gain_loss_pct)}</td></> : <>
      <td>{dateLabel(item.purchase_date)}</td><td>{money(item.purchase_price)}</td><td className="strong">{money(item.current_value)}</td>
      <td className={Number(item.gain_loss) < 0 ? 'loss-text strong' : 'gain-text strong'}><span className="gain-cell">{Number(item.gain_loss) >= 0 ? '+' : '−'}{money(Math.abs(Number(item.gain_loss)))} <small title={`${item.gain_loss_pct}%`}>{percent(item.gain_loss_pct)}</small></span></td>
      <td title={`${item.days_since_last_update} days ago`}>{item.days_since_last_update < 30 ? `${item.days_since_last_update} days ago` : `${Math.floor(item.days_since_last_update / 30)} months ago`}</td>
      <td><div className="row-actions"><Link to={`/investments/${item.id}/edit`}>Edit</Link><button onClick={() => onDelete(item)}>Delete</button></div></td>
    </>}
  </tr>)}</tbody></table>{!sorted.length && <div className="empty-table">{investments.length ? 'No investments match your search.' : <><p>You haven’t added anything yet.</p><Link className="button primary-button" to="/investments/new">Add investment</Link></>}</div>}</div></>
}
