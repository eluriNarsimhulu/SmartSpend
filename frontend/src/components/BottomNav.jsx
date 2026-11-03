import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import { NAV_ITEMS } from './Sidebar';

// Mobile / small tablet navigation (shown instead of the sidebar below 900px).
export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-link ${isActive ? 'active' : ''}`}>
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
