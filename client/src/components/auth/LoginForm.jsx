import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';

export function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    setApiError(null);
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.identifier.trim()) {
      newErrors.identifier = 'Username or email is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    // Backend accepts email field for both username and email
    const result = await login({
      email: formData.identifier.trim(),
      password: formData.password
    });
    setLoading(false);

    if (result.success) {
      navigate('/chat');
    } else {
      setApiError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1>Welcome Back</h1>
      <p className="auth-subtitle">Sign in to continue to ChatterBox</p>

      {apiError && <ErrorMessage message={apiError.message} />}

      <Input
        label="Username or Email"
        type="text"
        name="identifier"
        value={formData.identifier}
        onChange={handleChange}
        error={errors.identifier}
        placeholder="Enter your username or email"
        required
        autoComplete="username"
      />

      <Input
        label="Password"
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        error={errors.password}
        placeholder="Enter your password"
        required
        autoComplete="current-password"
      />

      <Button type="submit" fullWidth loading={loading} variant="primary">
        Sign In
      </Button>

      <p className="auth-footer">
        Don't have an account?{' '}
        <a href="/register" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>
          Create one
        </a>
      </p>
    </form>
  );
}
