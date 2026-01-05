import { useEffect, useState } from 'react';
import axios from 'axios';

interface Transaction {
    id: number;
    listingId: number;
    sellerId: number;
    buyerId: number;
    price: number;
    createdAt: string;
}

interface Props {
    userId: number;
    onBack: () => void;
}

export function MyTransactions({ userId, onBack }: Props) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        axios.get(`http://localhost:8080/api/transactions/user/${userId}`)
            .then(res => setTransactions(res.data))
            .catch(err => console.error(err));
    }, [userId]);

    return (
        <div style={{ padding: '20px' }}>
            <button onClick={onBack} style={{ marginBottom: '20px', padding: '5px 10px', cursor: 'pointer' }}>
                ← Back to Store
            </button>

            <h2>My Transaction History 📜</h2>

            {transactions.length === 0 ? (
                <p>No transactions found.</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f2f2f2', textAlign: 'left' }}>
                            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Date</th>
                            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Item ID</th>
                            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Role</th>
                            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(t => {
                            const isBuyer = t.buyerId === userId;
                            return (
                                <tr key={t.id}>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>#{t.listingId}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold', color: isBuyer ? 'blue' : 'green' }}>
                                        {isBuyer ? 'BOUGHT' : 'SOLD'}
                                    </td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>${t.price}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}