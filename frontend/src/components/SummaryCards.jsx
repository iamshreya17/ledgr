import { formatCurrency, money, percent } from '../utils'

export default function SummaryCards({ summary }) {
  const gain = Number(summary.total_gain_loss)
  return <div className="summary-grid">
    <section className="summary-card primary"><h1 className="summary-label">Your total money</h1><div className="hero-value" title={money(summary.total_net_worth)}>{formatCurrency(summary.total_net_worth)}</div><div className={`gain-badge ${gain < 0 ? 'negative' : 'positive'}`}>{gain >= 0 ? '↗' : '↘'} {money(Math.abs(gain))} ({percent(summary.total_gain_loss_pct)})</div><p className="summary-subtle">The current value of your recorded investments</p></section>
    <section className="summary-card invested"><h2 className="summary-label">Money put in</h2><div className="card-value">{money(summary.total_invested)}</div><p>The amount you entered as invested</p></section>
    <section className="summary-card return"><h2 className="summary-label">Change in value</h2><div className={`card-value ${gain < 0 ? 'loss-text' : 'gain-text'}`}>{gain >= 0 ? '+' : '−'}{money(Math.abs(gain))}</div><p>{percent(summary.total_gain_loss_pct)} since purchase</p></section>
  </div>
}
