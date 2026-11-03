import { categoryIcon } from '../utils/categoryIcons';

export default function CategoryBadge({ name, type }) {
  return (
    <span className="category-badge">
      <span className={`category-dot dot-${type}`} aria-hidden="true">{categoryIcon(name)}</span>
      <span className="truncate">{name}</span>
    </span>
  );
}
