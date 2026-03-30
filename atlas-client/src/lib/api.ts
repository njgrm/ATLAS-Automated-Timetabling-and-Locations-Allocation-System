import axios from 'axios';

const atlasApi = axios.create({
	baseURL: import.meta.env.VITE_ATLAS_API ?? '/api/v1',
});

// Inject bridge token on every request
atlasApi.interceptors.request.use((config) => {
	const token = sessionStorage.getItem('atlas_bridge_token');
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

export default atlasApi;
