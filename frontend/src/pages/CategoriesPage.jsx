import { useState } from 'react';
import Icon from '../components/Icon';
import CategoryBadge from '../components/CategoryBadge';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import { RowsSkeleton } from '../components/LoadingState';
import useCategories from '../hooks/useCategories';
import { categoryService } from '../services/categoryService';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { useToast } from '../context/ToastContext';

function CategoryList({ title, type, items, editingId, editName, setEditName, onStartEdit, onSaveEdit, onCancelEdit, onDelete, busy }) {
  return (
    <div className="card">
      <h2 className="card-title">{title}</h2>
      {items.length === 0 ? <p className="muted">No {type} categories yet.</p> : (
        <ul className="category-list">
          {items.map((c) => (
            <li key={c.id}>
              {editingId === c.id ? (
                <form className="category-edit" onSubmit={(e) => { e.preventDefault(); onSaveEdit(c); }}>
                  <input className="input" aria-label="Category name" maxLength={50} autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <button className="btn btn-primary btn-sm" disabled={busy || !editName.trim()}>Save</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelEdit}>Cancel</button>
                </form>
              ) : (
                <>
                  <CategoryBadge name={c.name} type={c.type} />
                  <span className="muted small">{c.transactionCount} transaction{c.transactionCount === 1 ? '' : 's'}</span>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => onStartEdit(c)} aria-label={`Rename ${c.name}`}><Icon name="edit" size={18} /></button>
                    <button className="icon-btn danger" onClick={() => onDelete(c)} aria-label={`Delete ${c.name}`}><Icon name="trash" size={18} /></button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const toast = useToast();
  const { categories, loading, error, reload } = useCategories();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('expense');
  const [nameError, setNameError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    setNameError('');
    if (!newName.trim()) {
      setNameError('Enter a category name.');
      return;
    }
    setBusy(true);
    try {
      await categoryService.create({ name: newName.trim(), type: newType });
      toast.success('Category created successfully.');
      setNewName('');
      reload();
    } catch (err) {
      setNameError(getFieldErrors(err).name || getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (category) => {
    setBusy(true);
    try {
      await categoryService.update(category.id, { name: editName.trim() });
      toast.success('Category updated successfully.');
      setEditingId(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await categoryService.remove(toDelete.id);
      toast.success('Category deleted successfully.');
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const shared = {
    editingId, editName, setEditName, busy,
    onStartEdit: (c) => { setEditingId(c.id); setEditName(c.name); },
    onSaveEdit: handleSaveEdit,
    onCancelEdit: () => setEditingId(null),
    onDelete: setToDelete,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Categories</h1>
          <p className="muted">Organise your income and expenses your way.</p>
        </div>
      </div>

      <form className="card category-form" onSubmit={handleCreate} noValidate>
        <div className="form-row grow">
          <label htmlFor="cat-name" className="form-label">New category</label>
          <input id="cat-name" className="input" maxLength={50} placeholder="e.g. Gym, Subscriptions" value={newName} onChange={(e) => setNewName(e.target.value)} aria-invalid={Boolean(nameError)} />
        </div>
        <div className="form-row">
          <label htmlFor="cat-type" className="form-label">Type</label>
          <select id="cat-type" className="select" value={newType} onChange={(e) => setNewType(e.target.value)}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <button className="btn btn-primary" disabled={busy}><Icon name="plus" size={18} /> Add category</button>
        {nameError && <p className="field-error category-form-error">{nameError}</p>}
      </form>

      {loading && <div className="section"><RowsSkeleton rows={5} /></div>}
      {error && !loading && <EmptyState tone="error" icon="alert" title="Couldn’t load categories" message="Please try again." actionLabel="Try again" onAction={reload} />}

      {!loading && !error && (
        <div className="grid grid-2 section">
          <CategoryList title="Expense categories" type="expense" items={categories.filter((c) => c.type === 'expense')} {...shared} />
          <CategoryList title="Income categories" type="income" items={categories.filter((c) => c.type === 'income')} {...shared} />
        </div>
      )}

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete category"
        message={toDelete ? `Delete the category “${toDelete.name}”? Categories that still have transactions can’t be deleted.` : ''}
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
