
async function login() {
  try {
    const res = await fetch('http://localhost:5005/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    const data = await res.json();
    if (data.success && data.data?.access_token) {
      console.log('Token:', data.data.access_token);
    } else {
      console.log('Login response:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Login failed:', err.message);
  }
}

login();
