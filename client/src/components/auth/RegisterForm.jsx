import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validators } from '../../utils/validators';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';

export function RegisterForm() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
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

    const usernameError = validators.username(formData.username);
    if (usernameError) newErrors.username = usernameError;

    const emailError = validators.email(formData.email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validators.password(formData.password);
    if (passwordError) newErrors.password = passwordError;

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    const displayNameError = validators.displayName(formData.displayName);
    if (displayNameError) newErrors.displayName = displayNameError;

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
    const { confirmPassword, ...registerData } = formData;
    const result = await register(registerData);
    setLoading(false);

    if (result.success) {
      navigate('/chat');
    } else {
      setApiError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1>Create Account</h1>

      {apiError && <ErrorMessage message={apiError.message} details={apiError.details} />}

      <Input
        label="Username"
        type="text"
        name="username"
        value={formData.username}
        onChange={handleChange}
        error={errors.username}
        placeholder="johndoe"
        required
        autoComplete="username"
      />

      <Input
        label="Email"
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
        placeholder="you@example.com"
        required
        autoComplete="email"
      />

      <Input
        label="Display Name"
        type="text"
        name="displayName"
        value={formData.displayName}
        onChange={handleChange}
        error={errors.displayName}
        placeholder="John Doe (optional)"
        autoComplete="name"
      />

      <Input
        label="Password"
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        error={errors.password}
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />

      <Input
        label="Confirm Password"
        type="password"
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={handleChange}
        error={errors.confirmPassword}
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />

      <Button type="submit" fullWidth loading={loading}>
        Create Account
      </Button>

      <p className="auth-footer">
        Already have an account?{' '}
        <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
          Sign in
        </a>
      </p>
    </form>
  );
}
