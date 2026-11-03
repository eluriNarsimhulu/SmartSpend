import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../services/api';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = getErrorMessage(err, 'Something went wrong.');
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to see where your money goes." footer={<>New to SmartSpend? <Link to="/register">Create an account</Link></>}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label htmlFor="email" className="form-label">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={update('email')} />
        </div>
        <div className="form-row">
          <label htmlFor="password" className="form-label">Password</label>
          <input id="password" type="password" className="input" autoComplete="current-password" value={form.password} onChange={update('password')} />
        </div>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={submitting}>{submitting ? 'Logging in…' : 'Log in'}</button>
      </form>
    </AuthLayout>
  );
}
