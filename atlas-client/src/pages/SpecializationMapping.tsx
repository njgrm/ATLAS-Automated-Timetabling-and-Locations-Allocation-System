import { useState, useEffect, useMemo } from 'react';
import { Shield, Plus, Trash2, Loader2, Info, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Badge } from '@/ui/badge';
import { ScrollArea } from '@/ui/scroll-area';

const DEFAULT_SCHOOL_ID = 1;

export default function SpecializationMapping() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [aliases, setAliases] = useState<any[]>([]);
	const [allTerms, setAllTerms] = useState<string[]>([]);
	const [subjects, setSubjects] = useState<any[]>([]);
	const [pendingAdds, setPendingAdds] = useState<Array<{ alias: string; canonical: string }>>([]);
	const [pendingDeletes, setPendingDeletes] = useState<number[]>([]);
	
	const [newCanonical, setNewCanonical] = useState('');
	const [newAlias, setNewAlias] = useState('');

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		setLoading(true);
		try {
			const [aliasRes, specRes, subRes] = await Promise.all([
				atlasApi.get(`/specialization-aliases?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/faculty/specializations?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`)
			]);
			setAliases(aliasRes.data.aliases);
			setAllTerms(specRes.data.specializations);
			setSubjects(subRes.data.subjects);
		} catch {
			toast.error('Failed to load specialization mapping data');
		} finally {
			setLoading(false);
		}
	};

	// Orphaned terms: specializations found in faculty data but not in aliases and not themselves canonical subjects
	const orphanedTerms = useMemo(() => {
		const mappedAliases = new Set([
			...aliases.filter((a) => !pendingDeletes.includes(a.id)).map((a) => a.alias),
			...pendingAdds.map((a) => a.alias),
		]);
		const canonicalSubjectCodes = new Set(subjects.map(s => s.code));
		return allTerms.filter(t => !mappedAliases.has(t) && !canonicalSubjectCodes.has(t));
	}, [allTerms, aliases, pendingAdds, pendingDeletes, subjects]);

	const visibleAliases = useMemo(() => {
		const activeServerAliases = aliases.filter((a) => !pendingDeletes.includes(a.id));
		return [...activeServerAliases, ...pendingAdds.map((entry, index) => ({ id: `pending-${index}`, alias: entry.alias, canonical: entry.canonical, isPending: true }))];
	}, [aliases, pendingAdds, pendingDeletes]);

	const hasPendingChanges = pendingAdds.length > 0 || pendingDeletes.length > 0;

	const stageAdd = (alias: string, canonical: string) => {
		if (!alias || !canonical) return;
		const normalizedAlias = alias.trim();
		const normalizedCanonical = canonical.trim();
		if (!normalizedAlias || !normalizedCanonical) return;
		if (aliases.some((item) => item.alias === normalizedAlias && item.canonical === normalizedCanonical && !pendingDeletes.includes(item.id))) return;
		if (pendingAdds.some((item) => item.alias === normalizedAlias && item.canonical === normalizedCanonical)) return;
		setPendingDeletes((current) => current.filter((id) => !aliases.some((item) => item.id === id && item.alias === normalizedAlias)));
		setPendingAdds((current) => [...current, { alias: normalizedAlias, canonical: normalizedCanonical }]);
		toast.success('Mapping staged');
	};

	const stageDelete = (id: number) => {
		setPendingAdds((current) => current.filter((item) => !(aliases.some((alias) => alias.id === id && alias.alias === item.alias && alias.canonical === item.canonical))));
		setPendingDeletes((current) => (current.includes(id) ? current : [...current, id]));
		toast.success('Removal staged');
	};

	const removePendingAdd = (alias: string, canonical: string) => {
		setPendingAdds((current) => current.filter((item) => !(item.alias === alias && item.canonical === canonical)));
		toast.info('Pending mapping removed');
	};

	const undoPending = () => {
		setPendingAdds([]);
		setPendingDeletes([]);
		toast.info('Staged changes cleared');
	};

	const savePending = async () => {
		if (!hasPendingChanges) return;
		setSaving(true);
		try {
			for (const id of pendingDeletes) {
				await atlasApi.delete(`/specialization-aliases/${id}`);
			}
			for (const entry of pendingAdds) {
				await atlasApi.post('/specialization-aliases', {
					schoolId: DEFAULT_SCHOOL_ID,
					canonical: entry.canonical,
					alias: entry.alias,
				});
			}
			toast.success('Mappings saved');
			setPendingAdds([]);
			setPendingDeletes([]);
			setNewAlias('');
			setNewCanonical('');
			await loadData();
		} catch (err: any) {
			toast.error(err.response?.data?.message || 'Failed to save staged mappings');
		} finally {
			setSaving(false);
		}
	};

	const handleAdd = async (aliasOverride?: string, canonicalOverride?: string) => {
		const aliasToUse = aliasOverride || newAlias;
		const canonicalToUse = canonicalOverride || newCanonical;
		
		if (!canonicalToUse || !aliasToUse) return;
		stageAdd(aliasToUse, canonicalToUse);
		if (!aliasOverride) {
			setNewAlias('');
			setNewCanonical('');
		}
	};

	const handleDelete = async (id: number) => {
		const alias = aliases.find((item) => item.id === id);
		if (!alias) return;
		stageDelete(id);
	};

	if (loading) {
		return <div className="p-6 flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" /></div>;
	}

	return (
		<div className="h-[calc(100svh-3.5rem)] flex flex-col overflow-hidden bg-background">
			{/* Page Header */}
			<header className="shrink-0 border-b bg-muted/30 px-6 py-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
							<Shield className="size-5 text-primary" />
						</div>
						<div>
							<h1 className="text-lg font-bold tracking-tight">Specialization Mapping</h1>
							<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Learning Area Canonicalization</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<Button variant="outline" size="sm" className="h-8 gap-2" onClick={loadData}>
							<RefreshCw className="size-3.5" />
							Refresh
						</Button>
						<Button variant="outline" size="sm" className="h-8 gap-2" onClick={undoPending} disabled={!hasPendingChanges || saving}>
							Undo
						</Button>
						<Button size="sm" className="h-8 gap-2" onClick={savePending} disabled={!hasPendingChanges || saving}>
							{saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
							Save Changes
						</Button>
					</div>
				</div>
			</header>

			<div className="flex-1 flex overflow-hidden">
				{/* Left Rail - Forms & Orphans */}
				<aside className="w-96 shrink-0 border-r bg-muted/10 flex flex-col overflow-hidden">
					<ScrollArea className="flex-1">
						<div className="p-6 space-y-6">
							{orphanedTerms.length > 0 && (
								<Card className="border-amber-200 bg-amber-50/50 shadow-none">
									<CardContent className="p-4">
										<div className="flex items-start gap-3">
											<div className="size-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
												<Info className="size-4 text-amber-600" />
											</div>
											<div className="space-y-1">
												<h3 className="font-bold text-amber-900 text-xs">Unmapped Terms</h3>
												<p className="text-[10px] text-amber-800/80 leading-relaxed">
													Found {orphanedTerms.length} terms in faculty data not recognized by ATLAS.
												</p>
											</div>
										</div>
										<div className="flex flex-wrap gap-1.5 mt-3">
											{orphanedTerms.map(term => (
												<Badge key={term} variant="outline" className="bg-white/80 border-amber-200 text-amber-800 text-[9px] py-0 h-4">
													{term}
												</Badge>
											))}
										</div>
									</CardContent>
								</Card>
							)}

							<div className="space-y-4">
								<div className="space-y-1 px-1">
									<h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Add New Mapping</h2>
									<p className="text-[10px] text-muted-foreground italic">Link EnrollPro terms to ATLAS areas</p>
								</div>
								
								<Card className="shadow-sm">
									<CardContent className="p-4 space-y-4">
										<div className="space-y-2">
											<label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">EnrollPro Term</label>
											<Select value={newAlias} onValueChange={setNewAlias}>
												<SelectTrigger className="h-8 text-xs">
													<SelectValue placeholder="Select term..." />
												</SelectTrigger>
												<SelectContent>
													{allTerms.map(opt => (
														<SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ATLAS Learning Area</label>
											<Select value={newCanonical} onValueChange={setNewCanonical}>
												<SelectTrigger className="h-8 text-xs">
													<SelectValue placeholder="Select subject..." />
												</SelectTrigger>
												<SelectContent>
													{subjects.map(sub => (
														<SelectItem key={sub.code} value={sub.code} className="text-xs">{sub.name} ({sub.code})</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<Button 
											onClick={() => handleAdd()} 
											disabled={saving || !newAlias || !newCanonical} 
											className="w-full h-8 text-xs shadow-sm"
										>
											{saving ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Plus className="size-3.5 mr-2" />}
											Add Mapping
										</Button>
									</CardContent>
								</Card>
							</div>

							<div className="space-y-4 pt-2">
								<div className="space-y-1 px-1">
									<h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick Resolve</h2>
									<p className="text-[10px] text-muted-foreground italic">Map orphans directly</p>
								</div>
								
								{orphanedTerms.length === 0 ? (
									<div className="py-8 text-center border-2 border-dashed rounded-lg bg-emerald-50/20 border-emerald-100">
										<CheckCircle2 className="size-6 text-emerald-500/30 mx-auto mb-2" />
										<p className="text-[10px] text-emerald-700/60 font-medium">All terms are mapped!</p>
									</div>
								) : (
									<div className="space-y-2">
										{orphanedTerms.slice(0, 5).map(term => (
											<Card key={term} className="shadow-none border bg-background/50">
												<CardContent className="p-3 space-y-2">
													<div className="text-[11px] font-bold truncate">{term}</div>
													<Select onValueChange={(val) => handleAdd(term, val)}>
														<SelectTrigger className="h-7 text-[10px] bg-background">
															<SelectValue placeholder="Map to..." />
														</SelectTrigger>
														<SelectContent>
															{subjects.map(sub => (
																<SelectItem key={sub.code} value={sub.code} className="text-xs">{sub.name} ({sub.code})</SelectItem>
															))}
														</SelectContent>
													</Select>
												</CardContent>
											</Card>
										))}
										{orphanedTerms.length > 5 && (
											<p className="text-[10px] text-center text-muted-foreground italic pt-2">
												+ {orphanedTerms.length - 5} more orphans...
											</p>
										)}
									</div>
								)}
							</div>
						</div>
					</ScrollArea>
				</aside>

				{/* Main Workspace - Active Mappings */}
				<main className="flex-1 flex flex-col overflow-hidden">
					<div className="px-6 py-4 border-b bg-muted/20 flex items-center justify-between">
						<div>
							<h2 className="text-sm font-bold">Active Mappings</h2>
							<p className="text-[11px] text-muted-foreground italic">Rules used to determine teacher eligibility</p>
						</div>
						<Badge variant="secondary" className="font-bold">{visibleAliases.length} Rules</Badge>
					</div>
					
					<ScrollArea className="flex-1">
						<div className="p-6">
							{aliases.length === 0 ? (
								<div className="py-24 text-center border-2 border-dashed rounded-xl">
									<Shield className="size-12 text-muted-foreground/20 mx-auto mb-4" />
									<h3 className="text-sm font-medium text-muted-foreground">No custom mappings defined yet</h3>
									<p className="text-[11px] text-muted-foreground/60 mt-1 max-w-50 mx-auto">
										Add a mapping in the left panel to start defining teacher eligibility.
									</p>
								</div>
							) : (
								<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
									{visibleAliases.map((a) => (
										<Card key={a.id} className="group hover:border-primary/50 transition-all hover:shadow-md">
											<CardContent className="p-4">
												<div className="flex items-center justify-between gap-4">
													<div className="flex flex-col gap-2 min-w-0">
														<div className="space-y-1">
															<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">EnrollPro Term</span>
															<div className="truncate font-mono text-xs bg-muted/50 px-2 py-1 rounded border border-muted-foreground/10">{a.alias}</div>
															{a.isPending && <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase tracking-wider">Pending</Badge>}
														</div>
														<div className="flex items-center justify-center py-0.5">
															<ArrowRight className="size-3 text-muted-foreground/30" />
														</div>
														<div className="space-y-1">
															<span className="text-[9px] font-bold uppercase tracking-widest text-primary/70">ATLAS Area</span>
															<div className="truncate font-bold text-xs bg-primary/5 text-primary px-2 py-1 rounded border border-primary/10">{a.canonical}</div>
														</div>
													</div>
													<Button 
														variant="ghost" 
														size="sm" 
														onClick={() => (a.isPending ? removePendingAdd(a.alias, a.canonical) : handleDelete(a.id))} 
														className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
													>
														<Trash2 className="size-4" />
													</Button>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							)}
						</div>
					</ScrollArea>
				</main>
			</div>
		</div>
	);
}
