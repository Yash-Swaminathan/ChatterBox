import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="not-found-page">
      <h1>404</h1>
      <p>Page not found</p>
      <Button onClick={() => navigate('/')}>Go Home</Button>
    </div>
  );
}
