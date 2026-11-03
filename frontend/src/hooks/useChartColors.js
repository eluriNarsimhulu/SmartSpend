import { useTheme } from '../context/ThemeContext';

// Recharts draws SVG, so theme colours are passed as plain values.
const LIGHT = { grid: '#e7e2db', axis: '#7a746b', text: '#1f1d1a', surface: '#ffffff', income: '#16a34a', expense: '#dc4a4a', balance: '#0f766e' };
const DARK = { grid: '#34302b', axis: '#a39c91', text: '#f2efe9', surface: '#1e1c1a', income: '#4ade80', expense: '#f87171', balance: '#2dd4bf' };

export default function useChartColors() {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK : LIGHT;
}

export const CATEGORY_PALETTE = ['#0f766e', '#d97706', '#6366f1', '#db2777', '#0284c7', '#65a30d', '#9333ea', '#78716c'];
