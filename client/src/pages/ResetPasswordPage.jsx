import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/auth.api';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { validators } from '../utils/validators';
import '../styles/auth.css';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    const passwordError = validators.password(password);
    if (passwordError) {
      newErrors.password = passwordError;
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setApiError(null);

    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const error = err.response?.data?.error;
      setApiError({
        message: error?.message || 'Something went wrong. Please try again.',
        details: error?.details,
      });
    } finally {
      setLoading(false);
    }
  };

  let content;

  if (!token) {
    content = (
      <div className="auth-form">
        <h1>Link not valid</h1>
        <p className="auth-subtitle">This password reset link is incomplete.</p>
        <p className="auth-footer">
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </div>
    );
  } else if (done) {
    content = (
      <div className="auth-form">
        <h1>Password changed</h1>
        <p className="auth-subtitle">You can now sign in with your new password.</p>
        <p className="auth-footer">
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    );
  } else {
    content = (
      <form onSubmit={handleSubmit} className="auth-form">
        <h1>Choose a new password</h1>
        <p className="auth-subtitle">You will be signed out on all devices</p>

        {apiError && <ErrorMessage message={apiError.message} details={apiError.details} />}

        <Input
          label="New password"
          type="password"
          name="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors({});
          }}
          error={errors.password}
          placeholder="Enter a new password"
          required
          autoComplete="new-password"
        />

        <Input
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setErrors({});
          }}
          error={errors.confirmPassword}
          placeholder="Enter it again"
          required
          autoComplete="new-password"
        />

        <Button type="submit" fullWidth loading={loading} variant="primary">
          Change password
        </Button>

        <p className="auth-footer">
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </form>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <h1 className="brand-logo">ChatterBox</h1>
        </div>
        {content}
      </div>
    </div>
  );
}
