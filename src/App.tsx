import './App.css'

/**
 * Clipper / demo landing — später: Scan-Flow + Stats wie in der App.
 */
export default function App() {
  return (
    <div className="page">
      <header className="header">
        <span className="logo">Limitless</span>
        <span className="badge">Clipper demo</span>
      </header>

      <main className="main">
        <h1 className="title">Face scan demo</h1>
        <p className="lead">
          This site is wired for <strong>Vercel</strong> + <strong>GitHub</strong>. Next step: add the same
          scan animation and score cards (Jawline, etc.) as in the iOS app.
        </p>

        <section className="cards">
          <div className="card">
            <span className="card-label">Jawline</span>
            <span className="card-value">—</span>
          </div>
          <div className="card">
            <span className="card-label">Definition</span>
            <span className="card-value">—</span>
          </div>
          <div className="card">
            <span className="card-label">Water</span>
            <span className="card-value">—</span>
          </div>
        </section>
      </main>
    </div>
  )
}
