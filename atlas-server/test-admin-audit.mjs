import axios from 'axios';

async function main() {
  let token;
  try {
    const response = await axios.post('http://localhost:5001/api/v1/auth/login', {
      email: 'admin@deped.edu.ph',
      password: 'AdminSY2026!'
    });
    token = response.data.token;
    console.log('✅ Admin Login successful!');
  } catch (err) {
    console.error('All logins failed', err.message);
    return;
  }

  const endpoints = [
    '/faculty-assignments/summary?schoolId=1&schoolYearId=1',
    '/subjects?schoolId=1',
    '/specialization-aliases?schoolId=1',
    '/preferences/1/1/audit',
    '/sections/summary/1?schoolId=1',
    '/class-templates?schoolId=1',
    '/map/buildings?schoolId=1'
  ];

  for (const ep of endpoints) {
    console.log(`\nFetching ${ep}...`);
    try {
      const res = await axios.get(`http://localhost:5001/api/v1${ep}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`✅ Status: ${res.status}`);
    } catch (e) {
      console.log(`❌ Fetch failed: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }
  }
}

main();
