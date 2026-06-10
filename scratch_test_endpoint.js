async function test() {
  try {
    const response = await fetch('http://localhost:3003/api/chat/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hola, audita mi productividad.',
        sessionId: 'test-1'
      })
    })
    const data = await response.json()
    console.log('Response:', data)
  } catch (err) {
    console.error('Error in request:', err)
  }
}
test()
