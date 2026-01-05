import { useState } from 'react';
import axios from 'axios';

interface RegisterProps {
  onRegisterSuccess: () => void;
}

export function Register({ onRegisterSuccess }: RegisterProps) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    passwordConfirmation: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.passwordConfirmation) {
      setError("Passwords do not match!");
      return;
    }

    try {
      await axios.post('http://localhost:8080/api/auth/register', formData);
      onRegisterSuccess(); // Tell App.tsx we are done
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: '20px', maxWidth: '300px', margin: 'auto' }}>
      <h3>Create Account</h3>
      {error && <p style={{ color: 'red', fontSize: '0.9em' }}>{error}</p>}
      
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input name="firstName" placeholder="First Name" onChange={handleChange} required style={{ padding: '5px' }} />
        <input name="lastName" placeholder="Last Name" onChange={handleChange} required style={{ padding: '5px' }} />
        <input name="email" type="email" placeholder="Email" onChange={handleChange} required style={{ padding: '5px' }} />
        <input name="password" type="password" placeholder="Password" onChange={handleChange} required style={{ padding: '5px' }} />
        <input name="passwordConfirmation" type="password" placeholder="Confirm Password" onChange={handleChange} required style={{ padding: '5px' }} />
        
        <button type="submit" style={{ padding: '8px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none' }}>
          Register
        </button>
      </form>
    </div>
  );
}