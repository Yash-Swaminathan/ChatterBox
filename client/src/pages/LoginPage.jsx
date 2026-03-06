import { LoginForm } from '../components/auth/LoginForm';
import '../styles/auth.css';

export function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <h1 className="brand-logo">ChatterBox</h1>
          <p className="brand-tagline">Connect with me! or your friends</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
