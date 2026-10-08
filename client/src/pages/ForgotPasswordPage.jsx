import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../api/auth.api';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { validators } from '../utils/validators';
import '../styles/auth.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validators.email(email.trim());
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setLoading(true);
    setApiError(null);

    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setApiError(err.response?.data?.error?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <h1 className="brand-logo">ChatterBox</h1>
        </div>

        {sent ? (
          <div className="auth-form">
            <h1>Check your email</h1>
            <p className="auth-subtitle">
              If an account exists for {email.trim()}, we sent a link to reset your password. It
              expires in 30 minutes.
            </p>
            <p className="auth-footer">
              <Link to="/login">Back to sign in</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <h1>Forgot password</h1>
            <p className="auth-subtitle">Enter your email and we will send you a reset link</p>

            {apiError && <ErrorMessage message={apiError} />}

            <Input
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldError(null);
              }}
              error={fieldError}
              placeholder="Enter your email"
              required
              autoComplete="email"
            />

            <Button type="submit" fullWidth loading={loading} variant="primary">
              Send reset link
            </Button>

            <p className="auth-footer">
              <Link to="/login">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
