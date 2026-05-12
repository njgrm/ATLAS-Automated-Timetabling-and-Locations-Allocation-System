import { useState, useEffect, useMemo } from 'react';
import { Shield, Plus, Trash2, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Badge } from '@/ui/badge';

const DEFAULT_SCHOOL_ID = 1;

export default function SpecializationMapping() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [aliases, setAliases] = useState<any[]>([]);
	const [allTerms, setAllTerms] = useState<string[]>([]);
	
	const [newCanonical, setNewCanonical] = useState('');
	const [newAlias, setNewAlias] = useState('');

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		setLoading(true);
		try {
			const [aliasRes, specRes] = await Promise.all([
				atlasApi.get(`/specialization-aliases?schoolId=${DEFAULT_SCHOOL_ID}`),
				atlasApi.get(`/faculty/specializations?schoolId=${DEFAULT_SCHOOL_ID}`)
			]);
			setAliases(aliasRes.data.aliases);
			setAllTerms(specRes.data.specializations);
		} catch {
			toast.error('Failed to load specialization mapping data');
		} finally {
			setLoading(false);
		}
	};

	// Orphaned terms: specializations found in faculty data but not in aliases and not themselves canonical subjects
	const orphanedTerms = useMemo(() => {
		const mappedAliases = new Set(aliases.map(a => a.alias));
		return allTerms.filter(t => !mappedAliases.has(t));
	}, [allTerms, aliases]);

	const handleAdd = async (aliasOverride?: string) => {
		const aliasToUse = aliasOverride || newAlias;
		if (!newCanonical || !aliasToUse) return;
		setSaving(true);
		try {
			await atlasApi.post('/specialization-aliases', {
				schoolId: DEFAULT_SCHOOL_ID,
				canonical: newCanonical,
				alias: aliasToUse
			});
			toast.success('Alias mapping added');
			if (!aliasOverride) setNewAlias('');
			loadData();
		} catch (err: any) {
			toast.error(err.response?.data?.message || 'Failed to add mapping');
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: number) => {
		try {
			await atlasApi.delete(`/specialization-aliases/${id}`);
			toast.success('Mapping removed');
			loadData();
		} catch {
			toast.error('Failed to remove mapping');
		}
	};

	if (loading) {
		return <div className="p-6 flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" /></div>;
	}

	return (
		<div className="p-6 max-w-5xl mx-auto space-y-6 h-full flex flex-col overflow-hidden">
			<div className="flex items-center gap-3 shrink-0">
				<Shield className="size-6 text-primary" />
				<h1 className="text-2xl font-bold tracking-tight">Specialization Mapping</h1>
			</div>

			{orphanedTerms.length > 0 && (
				<Card className="border-amber-200 bg-amber-50/30 shrink-0">
					<CardContent className="pt-6">
						<div className="flex items-start gap-4">
							<div className="size-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
								<Info className="size-5 text-amber-600" />
							</div>
							<div className="space-y-1 flex-1 min-w-0">
								<h3 className="font-semibold text-amber-900">Unmapped Terms Detected</h3>
								<p className="text-sm text-amber-800/80">
									We found specializations imported from EnrollPro that haven't been mapped to ATLAS learning areas. 
									The scheduler will ignore these until you define a mapping.
								</p>
								<div className="flex flex-wrap gap-2 mt-3">
									{orphanedTerms.map(term => (
										<Badge key={term} variant="outline" className="bg-white/80 border-amber-200 text-amber-800">
											{term}
										</Badge>
									))}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
				<div className="md:col-span-2 flex flex-col min-h-0 gap-6">
					<Card className="shrink-0">
						<CardHeader>
							<CardTitle>Add New Mapping</CardTitle>
							<CardDescription>
								Link an EnrollPro specialization term (Alias) to a standard ATLAS learning area (Canonical).
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex flex-wrap items-end gap-4">
								<div className="flex-1 min-w-[200px] space-y-2">
									<label className="text-xs font-medium text-muted-foreground uppercase">EnrollPro Term (Alias)</label>
									<Input 
										placeholder="e.g. STEM, Algebra, ICT-CSS" 
										value={newAlias}
										onChange={(e) => setNewAlias(e.target.value)}
									/>
								</div>
								<div className="size-8 flex items-center justify-center text-muted-foreground pb-2">→</div>
								<div className="flex-1 min-w-[200px] space-y-2">
									<label className="text-xs font-medium text-muted-foreground uppercase">ATLAS Requirement (Canonical)</label>
									<Select value={newCanonical} onValueChange={setNewCanonical}>
										<SelectTrigger>
											<SelectValue placeholder="Select learning area..." />
										</SelectTrigger>
										<SelectContent>
											{allTerms.map(opt => (
												<SelectItem key={opt} value={opt}>{opt}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<Button onClick={() => handleAdd()} disabled={saving || !newAlias || !newCanonical}>
									{saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
									Add Mapping
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
						<CardHeader className="shrink-0">
							<CardTitle>Active Mappings</CardTitle>
							<CardDescription>
								These mappings are used by the scheduler to determine teacher eligibility.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 overflow-auto">
							{aliases.length === 0 ? (
								<div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
									<Info className="size-8 mx-auto mb-2 opacity-20" />
									<p>No custom mappings defined yet.</p>
								</div>
							) : (
								<div className="divide-y">
									{aliases.map((a) => (
										<div key={a.id} className="flex items-center justify-between py-3">
											<div className="flex items-center gap-3">
												<Badge variant="outline" className="bg-muted/50 font-mono text-[0.7rem]">{a.alias}</Badge>
												<span className="text-muted-foreground text-xs italic">maps to</span>
												<Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
													{a.canonical}
												</Badge>
											</div>
											<Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
												<Trash2 className="size-4" />
											</Button>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6 flex flex-col min-h-0">
					<Card className="flex-1 flex flex-col overflow-hidden">
						<CardHeader className="bg-muted/30 pb-4 shrink-0">
							<CardTitle className="text-sm">Quick Resolve Orphaned</CardTitle>
							<CardDescription className="text-[0.7rem]">
								Map unassigned specializations directly.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 overflow-auto p-4 pt-0">
							{orphanedTerms.length === 0 ? (
								<div className="py-8 text-center text-xs text-muted-foreground italic">
									All imported terms are mapped!
								</div>
							) : (
								<div className="space-y-3 pt-4">
									{orphanedTerms.map(term => (
										<div key={term} className="p-3 border rounded-lg bg-background space-y-2">
											<div className="text-xs font-bold truncate">{term}</div>
											<div className="flex gap-2">
												<Select onValueChange={(val) => { setNewCanonical(val); handleAdd(term); }}>
													<SelectTrigger className="h-7 text-[0.65rem] flex-1">
														<SelectValue placeholder="Map to..." />
													</SelectTrigger>
													<SelectContent>
														{allTerms.filter(t => t !== term).map(opt => (
															<SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
