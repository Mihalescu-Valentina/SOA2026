import { useEffect, useState } from 'react';

import axios from 'axios';

import { Login } from './Login';

import { Register } from './Register';

import { CreateListing } from './CreateListing';

import { MyTransactions } from './MyTransactions';
import { io } from 'socket.io-client';
import { ProductDetails } from './ProductDetails';



interface Listing {

  id: number;

  title: string;

  price: number;

  isSold: boolean;

}



// NEW: Add 'sell' to the view states

type ViewState = 'home' | 'login' | 'register' | 'sell' | 'transactions' | 'details';



function App() {

  const [listings, setListings] = useState<Listing[]>([]);

  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  const [message, setMessage] = useState('');

  const [view, setView] = useState<ViewState>('home');

  const [currentUserId, setCurrentUserId] = useState<number | null>(

    localStorage.getItem('userId') ? Number(localStorage.getItem('userId')) : null

  );

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Helper to switch view
  const openDetails = (id: number) => {
    setSelectedItemId(id);
    setView('details');
  };



  const fetchListings = () => {

    axios.get('http://localhost:8080/api/listings')

      .then(res => setListings(res.data))

      .catch(err => console.error(err));

  };



  useEffect(() => {

    if (message) {

      const timer = setTimeout(() => setMessage(''), 3000);

      return () => clearTimeout(timer);

    }

  }, [message]);



  useEffect(() => {

    fetchListings();
    // const socket = io('http://localhost:3001');
    const socket = io('http://localhost:3001', {
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect_error', (err) => {
      console.error("Socket Connection Error:", err);
    });

    // 2. Listen for "Item Sold"
    socket.on('item_sold', (data) => {
      console.log("Socket Event Received: item_sold", data);
      setListings(prevListings =>
        prevListings.map(item =>
          item.id === data.listingId ? { ...item, isSold: true } : item
        )
      );
    });

    // 3. Listen for "New Item"
    socket.on('new_item', (newItem) => {
      console.log("Socket Event Received: new_item", newItem);
      setMessage(`🔔 New item added: ${newItem.title}`);
      setListings(prev => [...prev, newItem]);
    });

    // Cleanup when leaving page
    return () => {
      socket.disconnect();
    }

  }, []);



  const handleBuy = async (id: number) => {

    if (!token) {

      setView('login');

      setMessage('⚠️ Please login to buy items');

      return;

    }

    try {

      await axios.post(

        `http://localhost:8080/api/listings/${id}/buy`,

        {},

        { headers: { Authorization: `Bearer ${token}` } }

      );

      setMessage(`✅ Item #${id} bought successfully!`);

      fetchListings();

    } catch (err: any) {

      alert(err.response?.data?.message || 'Purchase failed');

    }

  };



  const logout = () => {

    localStorage.removeItem('token');

    localStorage.removeItem('userId'); // Clear it

    setToken(null);

    setCurrentUserId(null); // Clear it

    setView('home');

    setMessage('Logged out successfully');

  };



  const onLoginSuccess = (newToken: string, newUserId: number) => { // Accept userId

    setToken(newToken);

    setCurrentUserId(newUserId); // Set it

    setView('home');

    setMessage('👋 Login successful!');

  };



  const onRegisterSuccess = () => {

    setView('login');

    setMessage('✅ Account created! Please login.');

  };



  // NEW: Handle successful listing creation

  const onListingCreated = () => {

    setView('home');

    setMessage('🎉 New item listed for sale!');

    fetchListings(); // Refresh the list so we see the new item immediately

  };



  return (

    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>



      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>

        <h1 style={{ margin: 0, cursor: 'pointer' }} onClick={() => setView('home')}>🛒 MicroStore</h1>



        <div style={{ display: 'flex', gap: '10px' }}>

          {token ? (

            <>

              {/* NEW: Sell Button */}

              {view !== 'sell' && (

                <button

                  onClick={() => setView('sell')}

                  style={{ ...btnStyle, backgroundColor: '#28a745' }} // Green button

                >

                  Sell Item

                </button>

              )}

              {view !== 'transactions' && (

                <button

                  onClick={() => setView('transactions')}

                  style={{ ...btnStyle, backgroundColor: '#17a2b8' }} // Info color

                >

                  📜 My Transactions

                </button>

              )}

              <button onClick={logout} style={{ ...btnStyle, backgroundColor: '#dc3545' }}>Logout</button>

            </>

          ) : (

            <>

              {view !== 'login' && <button onClick={() => setView('login')} style={btnStyle}>Login</button>}

              {view !== 'register' && <button onClick={() => setView('register')} style={btnStyle}>Register</button>}

            </>

          )}



          {/* Cancel/Home Button (shows if we are not on home) */}

          {view !== 'home' && (

            <button onClick={() => setView('home')} style={{ ...btnStyle, backgroundColor: '#6c757d' }}>Home</button>

          )}

        </div>

      </header>



      {message && (

        <div style={{

          marginBottom: '20px',

          padding: '10px',

          backgroundColor: message.includes('⚠️') ? '#fff3cd' : '#d4edda',

          color: message.includes('⚠️') ? '#856404' : '#155724',

          borderRadius: '4px',

          textAlign: 'center'

        }}>

          {message}

        </div>

      )}



      {/* --- VIEW SWITCHER --- */}



      {view === 'login' && <Login onLoginSuccess={onLoginSuccess} />}



      {view === 'register' && <Register onRegisterSuccess={onRegisterSuccess} />}



      {/* NEW: Render Sell Form */}

      {view === 'sell' && token && (

        <CreateListing

          token={token}

          onSuccess={onListingCreated}

          onCancel={() => setView('home')}

        />

      )}



      {view === 'transactions' && currentUserId && (

        <MyTransactions userId={currentUserId} onBack={() => setView('home')} />

      )}

      {view === 'details' && selectedItemId && (
        <ProductDetails
          listingId={selectedItemId}
          currentUserId={currentUserId}
          token={token}
          onBack={() => setView('home')}
          onBuy={(id) => { handleBuy(id); setView('home'); }}
          // Refresh list and go home when update/delete happens
          onUpdateSuccess={() => {
            fetchListings();
            setView('home');
          }}
        />
      )}

      {view === 'home' && (

        <>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>

            {listings.map(item => (

              <div key={item.id} style={{

                border: '1px solid #ddd',

                padding: '15px',

                borderRadius: '8px',

                backgroundColor: item.isSold ? '#f8f9fa' : 'white',

                opacity: item.isSold ? 0.7 : 1,

                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'

              }}>

                <h3
                  style={{ margin: '0 0 10px 0', cursor: 'pointer', color: '#007bff', textDecoration: 'underline' }}
                  onClick={() => openDetails(item.id)}
                >
                  {item.title}
                </h3>

                <p style={{ fontSize: '1.4em', fontWeight: 'bold', margin: '0 0 15px 0', color: '#333' }}>${item.price}</p>



                {item.isSold ? (

                  <button disabled style={{ ...actionBtnStyle, backgroundColor: '#adb5bd', cursor: 'default' }}>

                    ❌ SOLD

                  </button>

                ) : (

                  <button

                    onClick={() => handleBuy(item.id)}

                    style={{

                      ...actionBtnStyle,

                      backgroundColor: token ? '#007bff' : '#28a745' // Blue if logged in, Green if guest (prompt to login)

                    }}

                  >

                    {token ? 'Buy Now 💸' : 'Login to Buy'}

                  </button>

                )}

              </div>

            ))}

          </div>

        </>

      )}

    </div>

  );

}



const btnStyle = {

  padding: '8px 16px',

  cursor: 'pointer',

  backgroundColor: '#007bff',

  color: 'white',

  border: 'none',

  borderRadius: '4px',

  fontSize: '14px'

};



const actionBtnStyle = {

  width: '100%',

  padding: '10px',

  color: 'white',

  border: 'none',

  borderRadius: '4px',

  cursor: 'pointer',

  fontWeight: 'bold' as 'bold'

};



export default App;
