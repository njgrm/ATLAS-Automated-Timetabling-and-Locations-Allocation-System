import axios from 'axios';

const response = await axios.post('http://localhost:5001/api/v1/auth/login', {
  email: 'maria.santos@deped.edu.ph',
  password: 'DepEd2026!'
});

console.log('✅ Login successful!');
console.log('Token (first 50 chars):', response.data.token.substring(0, 50) + '...');
console.log('User:', JSON.stringify(response.data.user, null, 2));

// Now test /faculty/me with this token
const meResponse = await axios.get('http://localhost:5001/api/v1/faculty/me', {
  headers: { Authorization: `Bearer ${response.data.token}` },
  params: { schoolId: 1 }
});

console.log('\n✅ /faculty/me successful!');
console.log('Faculty:', JSON.stringify(meResponse.data.faculty, null, 2));
