import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import atlasApi from '@/lib/api';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';

type ApprovalRequest = {
	id: number;
	runId: number;
	runVersion: number;
	requesterId: number;
	requestedAt: string;
	softViolationCount: number;
};

type PublicationApprovalInboxProps = {
	schoolId: number | null | undefined;
	schoolYearId: number | null | undefined;
	actorId: number | null | undefined;
	visible: boolean;
};

export function PublicationApprovalInbox({ schoolId, schoolYearId, actorId, visible }: PublicationApprovalInboxProps) {
	const [open, setOpen] = useState(false);
	const [requests, setRequests] = useState<ApprovalRequest[]>([]);
	const [acknowledged, setAcknowledged] = useState<Record<number, boolean>>({});
	const [loading, setLoading] = useState(false);
	const [workingId, setWorkingId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = async () => {
		if (!schoolId || !schoolYearId) return;
		setLoading(true);
		setError(null);
		try {
			const { data } = await atlasApi.get<{ requests: ApprovalRequest[] }>(`/publication-approvals/${schoolId}/${schoolYearId}/requests`);
			setRequests(data.requests);
		} catch (cause) {
			const message = (cause as { response?: { data?: { message?: string } } }).response?.data?.message;
			setError(message ?? 'Could not load pending publication requests.');
		} finally { setLoading(false); }
	};

	useEffect(() => { if (open) void load(); }, [open, schoolId, schoolYearId]);

	const approve = async (request: ApprovalRequest) => {
		if (!schoolId || !schoolYearId || !actorId || request.requesterId === actorId) return;
		setWorkingId(request.id);
		setError(null);
		try {
			await atlasApi.post(`/publication-approvals/${schoolId}/${schoolYearId}/runs/${request.runId}/requests/${request.id}/approve`, {
				acknowledgeSoftViolations: request.softViolationCount > 0 && acknowledged[request.id] === true,
			});
			setRequests((current) => current.filter((item) => item.id !== request.id));
		} catch (cause) {
			const message = (cause as { response?: { data?: { message?: string } } }).response?.data?.message;
			setError(message ?? 'Approval failed. The request may be stale; refresh and review again.');
		} finally { setWorkingId(null); }
	};

	if (!visible) return null;
	return <>
		<Button variant="outline" size="sm" onClick={() => setOpen(true)}>Review publication requests</Button>
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="max-h-[80svh] overflow-auto sm:max-w-lg">
				<DialogHeader><DialogTitle>Pending publication requests</DialogTitle><DialogDescription>Approval revalidates the exact run revision. Your approval publishes only if all current publication checks still pass.</DialogDescription></DialogHeader>
				<div className="space-y-2">
					{loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading requests…</div>}
					{error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</p>}
					{!loading && requests.length === 0 && <p className="rounded-md border p-3 text-sm text-muted-foreground">No pending requests for this school year.</p>}
					{requests.map((request) => {
						const selfRequest = request.requesterId === actorId;
						const needsAcknowledgment = request.softViolationCount > 0;
						return <section key={request.id} className="space-y-2 rounded-md border p-3">
							<div className="flex items-start justify-between gap-3 text-sm"><div><p className="font-medium">Run #{request.runId} · version {request.runVersion}</p><p className="text-xs text-muted-foreground">Requested by account #{request.requesterId}</p></div><p className="text-xs text-muted-foreground">{new Date(request.requestedAt).toLocaleString()}</p></div>
							{needsAcknowledgment && <label className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900"><Checkbox checked={acknowledged[request.id] === true} onCheckedChange={(value) => setAcknowledged((current) => ({ ...current, [request.id]: value === true }))} /><span>{request.softViolationCount} warning(s). I reviewed and acknowledge the warnings for publication.</span></label>}
							<div className="flex justify-end"><Button size="sm" disabled={workingId !== null || selfRequest || (needsAcknowledgment && acknowledged[request.id] !== true)} onClick={() => void approve(request)}>{workingId === request.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}{selfRequest ? 'You requested this' : 'Approve and publish'}</Button></div>
						</section>;
					})}
				</div>
				<DialogFooter><Button variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className="size-4" />Refresh</Button></DialogFooter>
			</DialogContent>
		</Dialog>
	</>;
}
