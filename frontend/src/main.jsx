import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class GlobalBoundary extends React.Component { constructor(props){super(props);this.state={e:null};} static getDerivedStateFromError(e){return{e};} render(){if(this.state.e){return <div style={{padding:20,background:"#fee",color:"#c00"}}>{this.state.e.toString()}<br/>{this.state.e.stack}</div>;}return this.props.children;} }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalBoundary>
      <App />
    </GlobalBoundary>
  </React.StrictMode>,
)
