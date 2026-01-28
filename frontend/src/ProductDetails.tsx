import { useEffect, useState } from 'react';
import axios from 'axios';

interface Props {
    listingId: number;
    currentUserId: number | null;
    token: string | null;
    onBack: () => void;
    onBuy: (id: number) => void;
    onUpdateSuccess: () => void; // To refresh the list after changes
}

export function ProductDetails({ listingId, currentUserId, token, onBack, onBuy, onUpdateSuccess }: Props) {
    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editPrice, setEditPrice] = useState(0);

    // 1. Fetch the Item Details
    useEffect(() => {
        setLoading(true);
        axios.get(`http://localhost:8080/api/listings/${listingId}`)
            .then(res => {
                setItem(res.data);
                // Pre-fill the edit form
                setEditTitle(res.data.title);
                setEditPrice(res.data.price);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [listingId]);

    // 2. Handle Update (PATCH)
    const handleUpdate = async () => {
        try {
            await axios.patch(
                `http://localhost:8080/api/listings/${listingId}`,
                { title: editTitle, price: Number(editPrice) },
                { headers: { Authorization: `Bearer ${token}` } } // Must send Token
            );

            alert('✅ Item updated successfully!');
            onUpdateSuccess(); // Tell App.tsx to refresh the main list
            onBack();          // Go back to home
        } catch (err) {
            alert('❌ Failed to update. Are you sure you are the owner?');
        }
    };

    // 3. Handle Delete (DELETE)
    const handleDelete = async () => {
        if (!confirm('⚠️ Are you sure you want to delete this listing?')) return;

        try {
            await axios.delete(
                `http://localhost:8080/api/listings/${listingId}`,
                { headers: { Authorization: `Bearer ${token}` } } // Must send Token
            );

            alert('🗑️ Item deleted successfully!');
            onUpdateSuccess(); // Tell App.tsx to refresh the main list
            onBack();          // Go back to home
        } catch (err) {
            alert('❌ Failed to delete. Are you sure you are the owner?');
        }
    };

    if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
    if (!item) return <div style={{ padding: 20 }}>Item not found.</div>;

    // 4. THE OWNERSHIP CHECK 🔐
    // Check if the logged-in user is the one who sold this item
    const isOwner = currentUserId === item.sellerId;

    return (
        <div style={containerStyle}>
            <button onClick={onBack} style={backBtnStyle}>← Back to Store</button>

            {/* --- EDIT MODE --- */}
            {isEditing ? (
                <div style={cardStyle}>
                    <h2>✏️ Edit Listing</h2>

                    <label style={labelStyle}>Title</label>
                    <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        style={inputStyle}
                    />

                    <label style={labelStyle}>Price ($)</label>
                    <input
                        type="number"
                        value={editPrice}
                        onChange={e => setEditPrice(Number(e.target.value))}
                        style={inputStyle}
                    />

                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                        <button onClick={handleUpdate} style={saveBtnStyle}>💾 Save Changes</button>
                        <button onClick={() => setIsEditing(false)} style={cancelBtnStyle}>Cancel</button>
                    </div>
                </div>
            ) : (
                /* --- VIEW MODE --- */
                <div style={cardStyle}>
                    <h1 style={{ margin: '0 0 10px 0' }}>{item.title}</h1>
                    <h2 style={{ color: '#007bff', margin: '0 0 20px 0' }}>${item.price}</h2>

                    <div style={infoBoxStyle}>
                        <p><strong>Item ID:</strong> #{item.id}</p>
                        <p><strong>Seller ID:</strong> {item.sellerId}</p>
                        <p><strong>Status:</strong> {item.isSold ? '❌ SOLD' : '✅ Available'}</p>
                    </div>

                    <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>

                        {/* Case A: You are the Owner */}
                        {isOwner && !item.isSold && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setIsEditing(true)} style={editBtnStyle}>
                                    ✏️ Edit
                                </button>
                                <button onClick={handleDelete} style={deleteBtnStyle}>
                                    🗑️ Delete
                                </button>
                            </div>
                        )}

                        {/* Case B: You are a Buyer */}
                        {!isOwner && !item.isSold && (
                            <button onClick={() => onBuy(item.id)} style={buyBtnStyle}>
                                Buy Now 💸
                            </button>
                        )}

                        {/* Case C: Sold */}
                        {item.isSold && (
                            <div style={{ padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '5px', textAlign: 'center' }}>
                                This item has been sold.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Styles for a clean look ---
const containerStyle = { maxWidth: '600px', margin: '20px auto', fontFamily: 'sans-serif' };
const cardStyle = { border: '1px solid #ddd', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const backBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#666', marginBottom: '15px' };
const labelStyle = { display: 'block', fontWeight: 'bold', marginTop: '15px', marginBottom: '5px' };
const inputStyle = { width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' as 'border-box' };
const infoBoxStyle = { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px', fontSize: '14px', color: '#555' };

const saveBtnStyle = { padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' };
const cancelBtnStyle = { padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' };

const editBtnStyle = { flex: 1, padding: '12px', backgroundColor: '#ffc107', color: '#212529', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' as 'bold' };
const deleteBtnStyle = { flex: 1, padding: '12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' as 'bold' };
const buyBtnStyle = { width: '100%', padding: '15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' as 'bold' };