import axios from 'axios';
import { getPreferredAccessToken } from './auth';

const atlasApi = axios.create({
	baseURL: import.meta.env.VITE_ATLAS_API ?? '/api/v1',
});

// Inject bridge token on every request
atlasApi.interceptors.request.use((config) => {
	const token = getPreferredAccessToken();
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

export default atlasApi;
