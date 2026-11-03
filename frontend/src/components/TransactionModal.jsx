import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import CategoryBadge from './CategoryBadge';
import { categoryService } from '../services/categoryService';
import { transactionService } from '../services/transactionService';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { useToast } from '../context/ToastContext';
import { PAYMENT_METHODS } from '../utils/categoryIcons';
import { todayISO } from '../utils/dates';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

// Used for both "Add" and "Edit": pass `transaction` to edit an existing one.
export default function TransactionModal({ open, transaction, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(transaction);

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());

  const [categories, setCategories] = useState([]);
  const [categoriesState, setCategoriesState] = useState('idle'); // idle | loading | error
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const loadCategories = () => {
    setCategoriesState('loading');
    categoryService
      .list()
      .then((list) => {
        setCategories(list);
        setCategoriesState('idle');
      })
      .catch(() => setCategoriesState('error'));
  };

  // Every time the modal opens: fill the form (edit) or reset it (add), and fetch fresh categories.
  useEffect(() => {
    if (!open) return;
    setFormError('');
    setFieldErrors({});
    setSubmitting(false);
    if (transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setCategoryId(String(transaction.categoryId));
      setPaymentMethod(transaction.paymentMethod);
      setNote(transaction.note || '');
      setDate(transaction.date);
    } else {
      setType('expense');
      setAmount('');
      setCategoryId('');
      setPaymentMethod('UPI');
      setNote('');
      setDate(todayISO());
    }
    loadCategories();
  }, [open, transaction]);

  const typeCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const selectedCategory = typeCategories.find((c) => String(c.id) === String(categoryId));

  const changeType = (nextType) => {
    if (nextType === type) return;
    setType(nextType);
    setCategoryId(''); // categories are different for expense and income
  };

  const handleAmountChange = (e) => {
    const cleaned = e.target.value.replace(/[^\d.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    setAmount(rest.length ? `${whole.slice(0, 10)}.${rest.join('').slice(0, 2)}` : whole.slice(0, 10));
  };

  const isValid = AMOUNT_PATTERN.test(amount) && Number(amount) > 0 && Boolean(selectedCategory) && Boolean(date) && Boolean(paymentMethod);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setFormError('');
    setFieldErrors({});

    const payload = { type, amount, categoryId: Number(categoryId), paymentMethod, note: note.trim(), date };
    try {
      if (isEdit) {
        await transactionService.update(transaction.id, payload);
        toast.success('Transaction updated successfully.');
      } else {
        await transactionService.create(payload);
        toast.success('Transaction added successfully.');
      }
      onSaved();
      onClose();
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  const label = type === 'expense' ? 'Expense' : 'Income';
  const submitText = submitting ? 'Saving…' : `${isEdit ? 'Update' : 'Add'} ${label}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Transaction' : 'Add Transaction'}
      dismissible={!submitting}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {isEdit ? 'Cancel' : 'Discard'}
          </button>
          <button type="submit" form="transaction-form" className={`btn btn-submit btn-${type}`} disabled={!isValid || submitting}>
            {submitText}
          </button>
        </>
      }
    >
      <form id="transaction-form" className="tx-form" onSubmit={handleSubmit} noValidate>
        <div className="type-tabs" role="tablist" aria-label="Transaction type">
          {['expense', 'income'].map((t) => (
            <button key={t} type="button" role="tab" aria-selected={type === t} className={`type-tab tab-${t} ${type === t ? 'active' : ''}`} onClick={() => changeType(t)}>
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        <div className="amount-panel">
          <label htmlFor="tx-amount" className="amount-label">Amount</label>
          <div className="amount-input-wrap">
            <span className="amount-symbol" aria-hidden="true">₹</span>
            <input
              id="tx-amount"
              className="amount-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={handleAmountChange}
              aria-invalid={Boolean(fieldErrors.amount)}
              style={{ width: `${Math.max(amount.length, 1) + 0.5}ch` }}
            />
          </div>
          {fieldErrors.amount && <p className="field-error center">{fieldErrors.amount}</p>}
        </div>

        <div className="form-panel">
          <div className="form-row">
            <label htmlFor="tx-category" className="form-label">Category</label>
            {selectedCategory && <CategoryBadge name={selectedCategory.name} type={type} />}
            {categoriesState === 'error' ? (
              <p className="field-error">
                Could not load categories. <button type="button" className="link-btn" onClick={loadCategories}>Try again</button>
              </p>
            ) : (
              <select id="tx-category" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={categoriesState === 'loading'} aria-invalid={Boolean(fieldErrors.categoryId)}>
                <option value="">{categoriesState === 'loading' ? 'Loading categories…' : 'Category…'}</option>
                {typeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {fieldErrors.categoryId && <p className="field-error">{fieldErrors.categoryId}</p>}
          </div>

          <div className="form-row">
            <label htmlFor="tx-method" className="form-label">Payment method</label>
            <select id="tx-method" className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="form-panel">
          <div className="form-row">
            <label htmlFor="tx-note" className="form-label">Note</label>
            <input id="tx-note" className="input" maxLength={255} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
            {fieldErrors.note && <p className="field-error">{fieldErrors.note}</p>}
          </div>

          <div className="form-row">
            <label htmlFor="tx-date" className="form-label">Date</label>
            <input id="tx-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
            {fieldErrors.date && <p className="field-error">{fieldErrors.date}</p>}
          </div>
        </div>

        {formError && <p className="form-alert" role="alert">{formError}</p>}
      </form>
    </Modal>
  );
}
