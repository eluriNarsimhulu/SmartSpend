import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import PeriodSelector from './PeriodSelector';
import useCategories from '../hooks/useCategories';
import useDebounce from '../hooks/useDebounce';
import { PAYMENT_METHODS } from '../utils/categoryIcons';

export default function FilterBar({ filters, onChange, onReset, activeCount }) {
  const { categories } = useCategories();
  const [searchText, setSearchText] = useState(filters.search);
  const [panelOpen, setPanelOpen] = useState(false); // mobile only
  const debouncedSearch = useDebounce(searchText, 400);

  // typing -> (debounced) -> filters
  useEffect(() => {
    if (debouncedSearch !== filters.search) onChange({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // filters changed from outside (Reset button, top bar search) -> input text
  useEffect(() => {
    setSearchText(filters.search);
  }, [filters.search]);

  const categoryNames = useMemo(() => {
    const visible = filters.type ? categories.filter((c) => c.type === filters.type) : categories;
    return [...new Set(visible.map((c) => c.name))].sort();
  }, [categories, filters.type]);

  const handleType = (e) => {
    const type = e.target.value;
    const stillValid = !type || categories.some((c) => c.type === type && c.name === filters.category);
    onChange({ type, category: stillValid ? filters.category : '' });
  };

  return (
    <div className="filter-bar card">
      <div className="filter-top">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Search notes, categories…" aria-label="Search transactions" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <button className="btn btn-outline filter-toggle" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>
          <Icon name="filter" size={16} /> Filters{activeCount > 0 && <span className="badge-count">{activeCount}</span>}
        </button>
      </div>

      <div className={`filter-panel ${panelOpen ? 'open' : ''}`}>
        <select className="select" aria-label="Type" value={filters.type} onChange={handleType}>
          <option value="">All Types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <select className="select" aria-label="Category" value={filters.category} onChange={(e) => onChange({ category: e.target.value })}>
          <option value="">All Categories</option>
          {categoryNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="select" aria-label="Payment method" value={filters.paymentMethod} onChange={(e) => onChange({ paymentMethod: e.target.value })}>
          <option value="">All Payment Methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <PeriodSelector allowAll period={filters.period} onChange={(period) => onChange({ period })} />
        <button className="btn btn-ghost" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}
