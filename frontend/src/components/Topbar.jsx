import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { initialsOf } from '../utils/format';

export default function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/transactions?search=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="topbar">
      <div className="topbar-brand"><Logo /></div>

      <form className="topbar-search" onSubmit={handleSearch} role="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Search transactions" aria-label="Search transactions" value={query} onChange={(e) => setQuery(e.target.value)} />
      </form>

      <div className="topbar-actions">
        <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>

        <div className="profile" ref={menuRef}>
          <button className="avatar" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Open profile menu">
            {initialsOf(user?.name)}
          </button>
          {menuOpen && (
            <div className="profile-menu" role="menu">
              <div className="profile-info">
                <strong className="truncate">{user?.name}</strong>
                <span className="muted small truncate">{user?.email}</span>
              </div>
              <button role="menuitem" onClick={() => { setMenuOpen(false); navigate('/settings'); }}><Icon name="settings" size={16} /> Settings</button>
              <button role="menuitem" onClick={logout}><Icon name="logout" size={16} /> Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
