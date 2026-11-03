import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage, getFieldErrors } from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  if (!EMAIL_REGEX.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, confirmPassword: form.confirmPassword });
      toast.success('Account created. Welcome to SmartSpend!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  const field = (id, label, type, autoComplete) => (
    <div className="form-row">
      <label htmlFor={id} className="form-label">{label}</label>
      <input id={id} type={type} className="input" autoComplete={autoComplete} value={form[id]} onChange={update(id)} aria-invalid={Boolean(errors[id])} />
      {errors[id] && <p className="field-error">{errors[id]}</p>}
    </div>
  );

  return (
    <AuthLayout title="Create your account" subtitle="Start tracking income and expenses in minutes." footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {field('name', 'Name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', 'new-password')}
        {field('confirmPassword', 'Confirm password', 'password', 'new-password')}
        {formError && <p className="form-alert" role="alert">{formError}</p>}
        <button className="btn btn-primary btn-block" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthLayout>
  );
}
