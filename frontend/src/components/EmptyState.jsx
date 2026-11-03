import Icon from './Icon';

export default function EmptyState({ icon = 'inbox', title, message, actionLabel, onAction, tone }) {
  return (
    <div className={`empty-state ${tone === 'error' ? 'is-error' : ''}`}>
      <div className="empty-icon"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {actionLabel && (
        <button className="btn btn-primary" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
