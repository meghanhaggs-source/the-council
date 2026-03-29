import { useState } from 'react';
import council from './advisors/council';
import AdvisorCard from './components/AdvisorCard';
import SessionPanel from './components/SessionPanel';
import { PasswordGate, isAuthenticated } from './components/PasswordGate';
import './styles/warroom.css';

const councilMembers = council.filter((a) => !a.staff);
const staffMembers = council.filter((a) => a.staff);

function App() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [activeAdvisor, setActiveAdvisor] = useState(null);

  if (!authed) {
    return <PasswordGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="warroom">
      <div className="grain" />

      <header className="warroom-header">
        <div className="header-line" />
        <h1 className="title">The Council</h1>
        <p className="subtitle">Seven voices. One direction.</p>
        <div className="header-line" />
      </header>

      <h2 className="section-heading">The Council</h2>

      <main className="council-arc">
        {councilMembers.map((advisor, i) => (
          <AdvisorCard
            key={advisor.name}
            index={i}
            {...advisor}
            onClick={() => setActiveAdvisor(advisor)}
          />
        ))}
      </main>

      <div className="staff-divider" />
      <h2 className="section-heading section-heading--staff">Support Staff</h2>

      <section className="staff-row">
        {staffMembers.map((advisor, i) => (
          <AdvisorCard
            key={advisor.name}
            index={i + councilMembers.length}
            {...advisor}
            onClick={() => setActiveAdvisor(advisor)}
          />
        ))}
      </section>

      {activeAdvisor && (
        <SessionPanel
          advisor={activeAdvisor}
          onClose={() => setActiveAdvisor(null)}
        />
      )}
    </div>
  );
}

export default App;
