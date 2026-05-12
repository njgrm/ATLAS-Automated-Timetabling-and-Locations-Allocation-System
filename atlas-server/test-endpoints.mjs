import 'dotenv/config';

async function testEndpoints() {
  const baseUrl = 'http://localhost:5000/api/v1'; // Assuming default port
  const token = process.env.ENROLLPRO_SERVICE_TOKEN; // Get a token if needed, or we might get 401. Let's just see what error we get.
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const endpoints = [
    `/preferences/1/1/audit`,
    `/subjects?schoolId=1`,
    `/faculty?schoolId=1`,
    `/specialization-aliases?schoolId=1`,
    `/faculty/specializations?schoolId=1`
  ];

  for (const ep of endpoints) {
    console.log(`\nFetching ${ep}...`);
    try {
      const res = await fetch(`${baseUrl}${ep}`, { headers });
      console.log(`Status: ${res.status}`);
      if (!res.ok) {
        console.log(`Error: ${await res.text()}`);
      }
    } catch (e) {
      console.log(`Fetch failed: ${e.message}`);
    }
  }
}

testEndpoints();
