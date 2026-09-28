import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import { formatCurrency, money, TYPE_COLORS, TYPE_LABELS, dateLabel } from '../utils'
import InvestmentTypeIcon from './InvestmentTypeIcon'

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const chartAnimation = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ? false
  : { duration: 500, easing: 'easeOutCubic' }

export function AllocationChart({ breakdown }) {
  const total = breakdown.reduce((sum, item) => sum + Number(item.total_value), 0)
  if (!total) return <div className="empty-chart">Add investments to see your allocation.</div>
  const data = {
    labels: breakdown.map(item => TYPE_LABELS[item.type]),
    datasets: [{ data: breakdown.map(item => Number(item.total_value)), backgroundColor: breakdown.map(item => TYPE_COLORS[item.type]), borderWidth: 0, hoverOffset: 6 }],
  }
  return <div className="allocation-layout"><div className="donut-wrap"><Doughnut data={data} options={{ cutout: '74%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.label}: ${money(context.raw)}` } } }, maintainAspectRatio: false, animation: chartAnimation() }} /></div><div className="legend-list">{breakdown.map(item => <div className="legend-row" key={item.type}><span className="legend-name"><i style={{ background: TYPE_COLORS[item.type] }} /><InvestmentTypeIcon type={item.type} />{TYPE_LABELS[item.type]}</span><strong>{item.pct_of_portfolio}%</strong></div>)}</div></div>
}

export function HistoryChart({ history, small = false }) {
  if (!history.length) return <div className="empty-chart">Log a valuation to start your history chart.</div>
  const data = {
    labels: history.map(item => dateLabel(item.date)),
    datasets: [{ label: 'Portfolio value', data: history.map(item => Number(item.total_value ?? item.value)), borderColor: '#6251B2', backgroundColor: 'rgba(149, 123, 216, 0.13)', fill: true, tension: 0.3, pointRadius: history.length > 20 ? 0 : 3, pointHoverRadius: 5, borderWidth: 2 }],
  }
  return <div className={small ? 'history-chart small' : 'history-chart'}><Line data={data} options={{ maintainAspectRatio: false, animation: chartAnimation(), plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => money(context.raw) } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#5C5870' } }, y: { grid: { color: '#E8E0D0' }, ticks: { color: '#5C5870', callback: value => formatCurrency(value) } } } }} /></div>
}
