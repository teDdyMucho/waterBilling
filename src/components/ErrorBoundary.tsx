import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

/**
 * Sinasalo ang mga render error para hindi mag-blank ang buong app.
 * (Class component — kailangan ng React para sa error boundary.)
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-dvh place-items-center bg-slate-50 px-4 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-100">
              <svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-900">May nangyaring mali</h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Pasensya na — may hindi inaasahang error. Subukang i-reload ang page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-5 font-semibold text-white transition-colors hover:bg-brand-800"
            >
              I-reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
