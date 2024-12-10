import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import HomePage from './HomePage';
import Login from './Login';
import CreateAccount from './CreateAccount';
import ForgotPassword from './ForgotPassword';
import Indexx from './Indexx'; // Indexx now includes Profile functionality
import './App.css';

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(!!sessionStorage.getItem('token'));

    const handleLogin = () => {
        setIsLoggedIn(true);
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        sessionStorage.removeItem('token');
    };

    return (
        <div className="App">
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={isLoggedIn ? <Navigate to="/indexx" replace /> : <Login onLogin={handleLogin} />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/create-account" element={<CreateAccount />} />
                {/* Protect Indexx route */}
                <Route 
                    path="/indexx" 
                    element={isLoggedIn ? <Indexx onLogout={handleLogout} /> : <Navigate to="/login" />} 
                />
                {/* 404 Route */}
                <Route path="*" element={<div>404: Page Not Found</div>} />
            </Routes>
        </div>
    );
}

export default App;
