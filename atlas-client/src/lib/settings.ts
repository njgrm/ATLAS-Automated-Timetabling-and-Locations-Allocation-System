import axios from 'axios';
import atlasApi from './api';

export interface EnrollProSettings {
	schoolName: string;
	logoUrl: string | null;
	colorScheme: Record<string, unknown> | null;
	selectedAccentHsl: string | null;
	activeSchoolYearId: number | null;
}

const enrollProApiBase = import.meta.env.VITE_ENROLLPRO_API ?? 'http://localhost:5000/api';

export async function fetchPublicSettings(): Promise<EnrollProSettings> {
	const { data } = await axios.get<EnrollProSettings>(`${enrollProApiBase}/settings/public`);
	return data;
}

export interface BridgeUser {
	userId: number;
	role: string;
}

export async function verifyBridgeToken(): Promise<BridgeUser | null> {
	try {
		const { data } = await atlasApi.get<{ user: BridgeUser }>('/auth/me');
		return data.user;
	} catch {
		return null;
	}
}
