import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/transactions', label: 'Transactions', icon: 'transactions' },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' },
  { to: '/categories', label: 'Categories', icon: 'tag' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar() {
  const { logout } = useAuth();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Logo /></div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon name={item.icon} size={20} /> {item.label}
          </NavLink>
        ))}
      </nav>
      <button className="nav-link nav-logout" onClick={logout}>
        <Icon name="logout" size={20} /> Logout
      </button>
    </aside>
  );
}
