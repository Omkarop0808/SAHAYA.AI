import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('createSpan')) {
    console.error('Intercepted global error:', e.error || e.message);
    e.preventDefault(); // Prevents the error from crashing the app overlay
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && e.reason.message.includes('createSpan')) {
    console.error('Intercepted unhandled promise rejection:', e.reason);
    e.preventDefault();
  }
});

class GlobalBoundary extends React.Component { 
  constructor(props){super(props);this.state={e:null};} 
  
  static getDerivedStateFromError(e){
    // If it's the known ZegoCloud telemetry error, ignore it by keeping state clean
    if (e && e.message && e.message.includes('createSpan')) {
      return null; // Do not enter error state
    }
    return{e};
  } 
  
  componentDidCatch(error, errorInfo) {
    if (error && error.message && error.message.includes('createSpan')) {
      console.warn("Ignored ZegoCloud createSpan error boundary catch:", error);
    } else {
      console.error("GlobalBoundary caught error:", error, errorInfo);
    }
  }
  
  render(){
    if(this.state.e){
      // For any other unexpected crash, we format it nicely or just log it instead of showing a scary red screen
      console.error("Uncaught app error:", this.state.e);
      // We return null so it doesn't display on screen as requested: "all the error should be in the console and solve this"
      // But we could also return something mild. Returning null makes it blank if it's a fatal rendering error.
      return null;
    }
    return this.props.children;
  } 
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalBoundary>
      <App />
    </GlobalBoundary>
  </React.StrictMode>,
)
