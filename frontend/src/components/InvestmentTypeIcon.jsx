const paths = {
  STOCK: <><path d="M3 18h18M5 15l5-5 4 3 5-7" /><path d="M16 6h3v3" /></>,
  MUTUAL_FUND: <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /><path d="M2 19h20" /></>,
  CRYPTO: <><circle cx="12" cy="12" r="9" /><path d="M9 7h4a2 2 0 0 1 0 4H9m0 0h5a2 2 0 0 1 0 4H9m2-10v12m3-12v2m0 10v2" /></>,
  FD: <><path d="m3 9 9-5 9 5M4 20h16M6 10v8m4-8v8m4-8v8m4-8v8" /></>,
  REAL_ESTATE: <><path d="m3 11 9-7 9 7v9H3z" /><path d="M9 20v-7h6v7" /></>,
  GOLD: <><circle cx="12" cy="12" r="9" /><path d="M9 9h6m-3-2v10m-3-3h6" /></>,
  BOND: <><path d="M5 3h11l3 3v15H5z" /><path d="M16 3v4h3M8 11h8M8 15h6" /></>,
  OTHER: <><path d="M4 5h16v14H4zM8 9h8m-8 4h8" /></>,
}

export default function InvestmentTypeIcon({ type, className = '' }) {
  return <svg className={`investment-type-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type] || paths.OTHER}</svg>
}
