fetch('http://127.0.0.1:5001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '1000001', password: 'AdminSY2026!' })
})
.then(res => res.text().then(t => console.log('HTTP', res.status, t)))
.catch(console.error);
