export default function DownloadPage() {
  return (
    <>
      <h1>Download App</h1>
      <p>
        Prometheon SI also runs as a desktop app for macOS, Windows, and
        Linux. The desktop app loads the same unified site and chat — same
        account, same conversations, same wallet — in a dedicated window.
      </p>
      <div className="grid">
        <div className="card">
          <h3>macOS</h3>
          <p>Desktop build for Mac (Apple silicon and Intel).</p>
        </div>
        <div className="card">
          <h3>Windows</h3>
          <p>Desktop build for Windows 10 and 11.</p>
        </div>
        <div className="card">
          <h3>Linux</h3>
          <p>Desktop build for current Linux distributions.</p>
        </div>
      </div>
      <p>
        Installers are published on the project&apos;s GitHub Releases page as
        each version is tagged:
      </p>
      <p>
        <a
          className="btn"
          href="https://github.com/American-Business-Capital-Group/prometheon-si/releases/latest"
          target="_blank"
          rel="noreferrer"
        >
          Get the latest release
        </a>
      </p>
      <p className="muted">
        Prefer not to install anything? The web app at prometheon.si is the
        full product — the desktop app is the same experience in its own
        window.
      </p>
    </>
  );
}
