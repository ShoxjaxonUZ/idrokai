import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Nimadir noto'g'ri ketdi</h2>
          <p style={{ color: '#666', margin: '12px 0' }}>{this.state.error?.message}</p>
          <button onClick={() => { this.reset(); window.location.href = '/' }}>
            Bosh sahifaga qaytish
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
