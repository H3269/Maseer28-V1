import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/original-v72.css';

// Apply layout compatibility rules only inside Bale's Android WebView.
// Telegram and ordinary browsers keep their existing DOM classes and styles.
if (typeof navigator !== 'undefined' && /bale/i.test(navigator.userAgent || '')) {
  document.documentElement.classList.add('bale-webview');
  document.body.classList.add('bale-webview');
}

createRoot(document.getElementById('root')).render(<App />);
