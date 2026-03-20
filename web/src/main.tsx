import React from 'react'
import ReactDOM from 'react-dom/client'
import rollbar from './rollbar'
import { setErrorLogger } from './logger'
import App from './App'

setErrorLogger((msg, ctx) => rollbar.error(msg, ctx as object))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
