// Client-side validation matching backend rules

export const validators = {
  username(value) {
    if (!value || value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 50) {
      return 'Username must be less than 50 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
  },

  email(value) {
    if (!value) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Invalid email format';
    }
    return null;
  },

  password(value) {
    if (!value || value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (value.length > 100) {
      return 'Password must be less than 100 characters';
    }
    if (!/[A-Z]/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(value)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(value)) {
      return 'Password must contain at least one number';
    }
    return null;
  },

  displayName(value) {
    if (!value) return null; // Optional field
    if (value.length > 100) {
      return 'Display name must be less than 100 characters';
    }
    return null;
  },
};
