import { useState } from 'react';
import axios from 'axios';

interface CreateListingProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateListing({ token, onSuccess, onCancel }: CreateListingProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await axios.post(
        'http://localhost:8080/api/listings',
        {
          ...formData,
          price: Number(formData.price) // Ensure price is a number
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      onSuccess(); // Tell App.tsx we are done
    } catch (err) {
      alert('Failed to create listing. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '20px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Sell a Product 🏷️</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Title</label>
          <input 
            type="text" 
            value={formData.title}
            onChange={e => setFormData({...formData, title: e.target.value})}
            required
            placeholder="e.g. Vintage Camera"
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description</label>
          <textarea 
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            required
            placeholder="Describe your item..."
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Price ($)</label>
          <input 
            type="number" 
            value={formData.price}
            onChange={e => setFormData({...formData, price: e.target.value})}
            required
            min="0"
            step="0.01"
            placeholder="0.00"
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            type="submit" 
            disabled={isSubmitting}
            style={{ flex: 1, padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isSubmitting ? 'Posting...' : 'List Item'}
          </button>
          
          <button 
            type="button" 
            onClick={onCancel}
            style={{ flex: 1, padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}