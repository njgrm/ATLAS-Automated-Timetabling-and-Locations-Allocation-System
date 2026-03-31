import axios from 'axios';
import atlasApi from './api';

export interface EnrollProSettings {
	schoolName: string;
	logoUrl: string | null;
	colorScheme: Record<string, unknown> | null;
	selectedAccentHsl: string | null;
	activeSchoolYearId: number | null;
}

export interface SchoolYear {
	id: number;
	yearLabel: string;
	isActive: boolean;
}

const enrollProApiBase = import.meta.env.VITE_ENROLLPRO_API ?? 'http://localhost:5000/api';

export async function fetchPublicSettings(): Promise<EnrollProSettings> {
	const { data } = await axios.get<EnrollProSettings>(`${enrollProApiBase}/settings/public`);
	return data;
}

export async function fetchActiveSchoolYear(activeId: number | null): Promise<string | null> {
	if (!activeId) return null;
	try {
		const token = sessionStorage.getItem('atlas_bridge_token');
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		const { data } = await axios.get<{ schoolYears: SchoolYear[] }>(`${enrollProApiBase}/school-years`, { headers });
		const active = data.schoolYears?.find((sy) => sy.id === activeId);
		return active?.yearLabel ?? null;
	} catch {
		return null;
	}
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
