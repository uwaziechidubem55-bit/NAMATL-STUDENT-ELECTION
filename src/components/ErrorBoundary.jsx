import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ errorInfo: info });
    // Propagate to global handler so it catches anything React misses
    if (window._showFatalError) {
      window._showFatalError(error.message || 'React ErrorBoundary caught error', error);
    }
  }
  clearAndReload = () => {
    localStorage.clear();
    sessionStorage.clear();
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.hash = '#/';
    window.location.reload();
  };
  render() {
    if (this.state.hasError) {
      const stack = this.state.error?.stack || '';
      const safeMsg = (this.state.error?.message || 'An unexpected error occurred')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const safeStack = stack.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return (
        <div style={{
          minHeight: '100vh',
          background: '#003366',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
          padding: '20px',
          boxSizing: 'border-box',
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 999999
        }}>
          <div style={{
            background: '#8B0000',
            color: '#FFD700',
            padding: '8px 24px',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            ⚠️ REACT COMPONENT ERROR
          </div>
          <h1 style={{
            color: '#FFD700',
            margin: '0 0 12px 0',
            fontSize: '24px',
            textAlign: 'center'
          }}>
            A Component Crashed
          </h1>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid #FFD700',
            borderRadius: '8px',
            padding: '16px',
            maxWidth: '700px',
            width: '100%',
            marginBottom: '20px',
            textAlign: 'left',
            overflowWrap: 'break-word'
          }}>
            <p style={{ color: '#FF6B6B', fontWeight: 'bold', margin: '0 0 8px 0' }}>
              Error Message:
            </p>
            <pre style={{
              color: '#e0e0e0',
              margin: '0 0 12px 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '13px',
              background: 'rgba(0,0,0,0.3)',
              padding: '10px',
              borderRadius: '4px'
            }}>{safeMsg}</pre>
            {safeStack ? (
              <>
                <p style={{ color: '#FF6B6B', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                  Component Stack:
                </p>
                <pre style={{
                  color: '#b0b0b0',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '11px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '10px',
                  borderRadius: '4px'
                }}>{safeStack}</pre>
              </>
            ) : null}
          </div>
          <button onClick={this.clearAndReload} style={{
            padding: '14px 40px',
            background: '#FFD700',
            color: '#003366',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '16px',
            marginTop: '8px'
          }}>
            🧹 Clear Cache & Reload
          </button>
          <p style={{ color: '#888', fontSize: '12px', marginTop: '20px' }}>
            If this persists, contact the development team with the error message above.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}