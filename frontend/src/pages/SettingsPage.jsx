import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { initialsOf } from '../utils/format';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">Your profile and appearance.</p>
        </div>
      </div>

      <div className="settings-stack">
        <section className="card">
          <h2 className="card-title">Profile</h2>
          <div className="profile-row">
            <span className="avatar avatar-lg">{initialsOf(user?.name)}</span>
            <dl className="profile-fields">
              <div><dt>Name</dt><dd>{user?.name}</dd></div>
              <div><dt>Email</dt><dd>{user?.email}</dd></div>
            </dl>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Appearance</h2>
          <div className="theme-options" role="radiogroup" aria-label="Theme">
            {[{ value: 'light', label: 'Light', icon: 'sun' }, { value: 'dark', label: 'Dark', icon: 'moon' }].map((o) => (
              <button key={o.value} role="radio" aria-checked={theme === o.value} className={`theme-option ${theme === o.value ? 'active' : ''}`} onClick={() => setTheme(o.value)}>
                <Icon name={o.icon} size={20} /> {o.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Session</h2>
          <button className="btn btn-outline" onClick={logout}><Icon name="logout" size={18} /> Log out</button>
        </section>
      </div>
    </>
  );
}
