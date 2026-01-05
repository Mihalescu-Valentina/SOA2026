import { useState } from 'react';
import axios from 'axios';

interface LoginProps {
  onLoginSuccess: (token: string, userId: number) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    const response = await axios.post('http://localhost:8080/api/auth/login', {
      email,
      password
    });
    
    // CORRECTION HERE: 
    // 1. Token is named 'accessToken' (camelCase)
    const token = response.data.accessToken; 
    
    // 2. User ID is nested inside the 'user' object
    const userId = response.data.user.id; 
    
    localStorage.setItem('token', token);
    localStorage.setItem('userId', String(userId));
    
    onLoginSuccess(token, userId);
  } catch (err) {
    setError('Invalid credentials');
  }
};

  return (
    <div style={{ border: '1px solid #ccc', padding: '20px', maxWidth: '300px' }}>
      <h3>Login</h3>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '10px' }}>
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '8px', cursor: 'pointer' }}>
          Sign In
        </button>
      </form>
    </div>
  );
}