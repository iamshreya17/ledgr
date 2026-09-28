import { Link } from 'react-router-dom'
import { formatCurrency, percent } from '../utils'

export default function GoalsWidget({ goals }) {
  if (!goals.length) return null
  return <section className="panel goals-widget"><div className="panel-heading"><div><div className="eyebrow">Plans for your money</div><h2>Goals</h2></div><Link to="/goals">View all goals →</Link></div><div className="goals-widget-grid">{goals.slice(0, 2).map(goal => <Link to="/goals" key={goal.id} className="goal-mini"><strong>{goal.name}</strong><span>{formatCurrency(goal.progress.current_amount)} of {formatCurrency(goal.target_amount)}</span><div className="goal-track"><i style={{ width: `${Math.min(100, Math.max(0, Number(goal.progress.progress_pct)))}%` }} /></div><small>{percent(goal.progress.progress_pct)} complete</small></Link>)}</div></section>
}
