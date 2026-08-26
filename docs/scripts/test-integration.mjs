import axios from 'axios';

const ENROLLPRO_URL = 'http://100.120.169.123:5002/api';

async function test() {
  try {
    console.log('Attempting to login to EnrollPro...');
    const loginResponse = await axios.post(`${ENROLLPRO_URL}/auth/login`, {
      accountName: '1000003',
      password: 'DepEd@2026'
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful! Token:', token.substring(0, 20) + '...');

    console.log('\nTesting /api/integration/v1/health...');
    try {
      const health = await axios.get(`${ENROLLPRO_URL}/integration/v1/health`);
      console.log('Health:', health.data);
    } catch (e) {
      console.log('Health failed:', e.response?.status, e.response?.data);
    }

    console.log('\nTesting /api/integration/v1/sections...');
    try {
      const sections = await axios.get(`${ENROLLPRO_URL}/integration/v1/sections`);
      console.log('Sections count:', sections.data.data?.length);
    } catch (e) {
      console.log('Sections failed:', e.response?.status, e.response?.data);
    }
    
    console.log('\nTesting /api/sections (authenticated)...');
    try {
      const sectionsAuth = await axios.get(`${ENROLLPRO_URL}/sections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Auth Sections count:', sectionsAuth.data.data?.length);
    } catch (e) {
      console.log('Auth Sections failed:', e.response?.status, e.response?.data);
    }

  } catch (e) {
    console.error('Login failed:', e.response?.status, e.response?.data || e.message);
  }
}

test();
