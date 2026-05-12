import jwt from 'jsonwebtoken';
import axios from 'axios';

const SECRET = 'aa6c6957f6bc9857640e893be7581e7f046a700a0531c74fdeb652b4e4151aa2be879b7d91a4cc09d23c5cd88b6537546b4a99339090f3f2dfa92dacffe12284';
const ENROLLPRO_URL = 'http://100.120.169.123:5002/api';

async function test() {
  console.log('Generating bridge token...');
  const payload = {
    userId: 1, // Assume user 1 exists
    role: 'SYSTEM_ADMIN',
    authSource: 'local'
  };
  
  const token = jwt.sign(payload, SECRET, { expiresIn: '1h' });
  console.log('Token generated.');

  console.log('\nTesting /api/integration/v1/health...');
  try {
    const response = await axios.get(`${ENROLLPRO_URL}/integration/v1/health`);
    console.log('Success! Health:', response.data);
  } catch (e) {
    console.error('Failed:', e.response?.status, e.response?.data || e.message);
  }
}

test();
