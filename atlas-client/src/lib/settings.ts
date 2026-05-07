import axios from 'axios';
import atlasApi from './api';
import { ATLAS_BRIDGE_TOKEN_KEY, getPreferredAccessToken } from './auth';
import type { BridgeUser } from '@/types';

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
	status?: string;
	isActive: boolean;
}

const enrollProApiBase = '/enrollpro-api';

export async function fetchPublicSettings(): Promise<EnrollProSettings> {
	const { data } = await axios.get<EnrollProSettings>(`${enrollProApiBase}/settings/public`);
	return data;
}

export async function fetchSchoolYears(): Promise<SchoolYear[]> {
	try {
		const token = sessionStorage.getItem(ATLAS_BRIDGE_TOKEN_KEY);
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		const { data } = await axios.get<{ years?: SchoolYear[]; schoolYears?: SchoolYear[] }>(`${enrollProApiBase}/school-years`, { headers });
		// EnrollPro returns { years: [...] }; handle both shapes for safety
		const list = data.years ?? data.schoolYears ?? [];
		return list;
	} catch {
		return [];
	}
}

export async function fetchActiveSchoolYear(activeId: number | null): Promise<string | null> {
	if (!activeId) return null;
	try {
		const token = sessionStorage.getItem(ATLAS_BRIDGE_TOKEN_KEY);
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		const { data } = await axios.get<{ years?: SchoolYear[]; schoolYears?: SchoolYear[] }>(`${enrollProApiBase}/school-years`, { headers });
		const list = data.years ?? data.schoolYears ?? [];
		const active = list.find((sy) => sy.id === activeId);
		return active?.yearLabel ?? null;
	} catch {
		return null;
	}
}

export async function verifySessionToken(): Promise<BridgeUser | null> {
	if (!getPreferredAccessToken()) return null;
	try {
		const { data } = await atlasApi.get<{ user: BridgeUser }>('/auth/me');
		return data.user;
	} catch {
		return null;
	}
}

export const verifyBridgeToken = verifySessionToken;
