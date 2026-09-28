import { Link } from 'react-router-dom'
import { percent, TYPE_LABELS } from '../utils'

export default function PerformersWidget({ performers }) {
  if (!performers || (!performers.best.length && !performers.worst.length)) return null
  return <section className="panel performers-panel"><div className="panel-heading"><div><div className="eyebrow">Changes in value</div><h2>Biggest changes</h2></div></div><div className="performers-grid">
    <div><h3 className="gain-text">↗ Top performers</h3>{performers.best.map(item => <Link to={`/investments/${item.id}`} className="performer-row" key={item.id}><span><strong>{item.name}</strong><small>{TYPE_LABELS[item.type]}</small></span><b className={Number(item.gain_loss_pct) < 0 ? 'loss-text' : 'gain-text'}>{percent(item.gain_loss_pct)}</b></Link>)}</div>
    <div><h3 className="loss-text">↘ Underperformers</h3>{performers.worst.map(item => <Link to={`/investments/${item.id}`} className="performer-row" key={item.id}><span><strong>{item.name}</strong><small>{TYPE_LABELS[item.type]}</small></span><b className={Number(item.gain_loss_pct) < 0 ? 'loss-text' : 'gain-text'}>{percent(item.gain_loss_pct)}</b></Link>)}</div>
  </div></section>
}
