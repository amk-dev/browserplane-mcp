import { authClient } from '@/lib/auth-client'
import './App.css'

export default function App() {
  const { data: session, isPending } = authClient.useSession()

  const handleGoogleLogin = async () => {
    const callbackURL = chrome.runtime.getURL('src/popup/index.html')
    await authClient.signIn.social({
      provider: 'google',
      callbackURL,
    })
  }

  if (isPending) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (session) {
    return (
      <div style={{ padding: '20px', minWidth: '300px' }}>
        <h2>Welcome!</h2>
        <p>Email: {session.user.email}</p>
        <p>Name: {session.user.name}</p>
        <button
          onClick={() => authClient.signOut()}
          style={{
            marginTop: '10px',
            padding: '10px 20px',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', minWidth: '300px', textAlign: 'center' }}>
      <h2>BrowserPlane</h2>
      <button
        onClick={handleGoogleLogin}
        style={{
          padding: '10px 20px',
          cursor: 'pointer',
          backgroundColor: '#4285f4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
        }}
      >
        Login With Google
      </button>
    </div>
  )
}
