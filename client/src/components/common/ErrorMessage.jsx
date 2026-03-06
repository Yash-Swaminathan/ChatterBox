export function ErrorMessage({ message, details }) {
  if (!message) return null;

  return (
    <div className="error-message">
      <p>{message}</p>
      {details && details.length > 0 && (
        <ul className="error-details">
          {details.map((detail, index) => (
            <li key={index}>{detail.message || detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
