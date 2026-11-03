import Icon from './Icon';

export default function SummaryCard({ label, value, icon, tone = 'neutral', hint }) {
  return (
    <div className="card summary-card">
      <div className="summary-head">
        <span className="summary-label">{label}</span>
        <span className={`summary-icon tone-${tone}`}><Icon name={icon} size={18} /></span>
      </div>
      <div className={`summary-value ${tone === 'negative' ? 'text-expense' : ''}`}>{value}</div>
      {hint && <div className="summary-hint">{hint}</div>}
    </div>
  );
}
