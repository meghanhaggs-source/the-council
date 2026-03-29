import './AdvisorCard.css';

export default function AdvisorCard({ name, role, color, avatar, index, staff, domain, onClick }) {
  return (
    <div
      className={`advisor-card${staff ? ' advisor-card--staff' : ''}`}
      style={{ '--accent': color, '--delay': `${index * 0.1}s` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className={`advisor-avatar-ring${staff ? ' advisor-avatar-ring--staff' : ''}`}>
        <div className="advisor-avatar-glow" />
        <img src={avatar} alt={name} className="advisor-avatar" />
      </div>
      {staff && <span className="advisor-staff-label">STAFF</span>}
      <h2 className="advisor-name">{name}</h2>
      <p className="advisor-role">{role}</p>
      {domain && <p className="advisor-domain">{domain}</p>}
      <div className="advisor-line" />
    </div>
  );
}
