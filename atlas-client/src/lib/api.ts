import axios from 'axios';
import { getPreferredAccessToken } from './auth';

const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const apiBaseUrl = runtimeEnv?.VITE_ATLAS_API ?? '/api/v1';

const atlasApi = axios.create({
	baseURL: apiBaseUrl,
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
