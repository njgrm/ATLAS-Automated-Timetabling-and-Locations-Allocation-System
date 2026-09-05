import { BookOpen } from 'lucide-react';
import { Skeleton } from '@/ui/skeleton';
import { AdminStatePanel } from '@/components/admin-workspace/AdminWorkspace';
import { SubjectMobileCard } from '@/components/subjects/SubjectMobileCard';
import type { Subject, SubjectCoverageRow } from '@/types';

type Props = {
	loading: boolean;
	paged: Subject[];
	subjects: Subject[];
	coverageBySubjectId: Map<number, SubjectCoverageRow> | null;
	onReviewCoverage: (subject: Subject) => void;
	onEdit: (subject: Subject) => void;
	onArchive: (subject: Subject) => void;
	onReactivate: (subject: Subject) => void;
	onDelete: (subject: Subject) => void;
};

export function SubjectMobileList({
	loading,
	paged,
	subjects,
	coverageBySubjectId,
	onReviewCoverage,
	onEdit,
	onArchive,
	onReactivate,
	onDelete,
}: Props) {
	return (
		<div className="space-y-3 p-3 md:hidden">
			{loading ? (
				Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)
			) : paged.length === 0 ? (
				<div className="flex min-h-80 items-center justify-center px-4 py-12 text-center">
					<AdminStatePanel
						icon={<BookOpen className="size-8" />}
						title={subjects.length === 0 ? 'No subjects found.' : 'No matches found.'}
						description={subjects.length === 0 ? 'Refresh offerings to load curriculum subjects for this school year.' : 'Clear a filter or search another subject name or code.'}
					/>
				</div>
			) : (
				paged.map((subject) => (
					<SubjectMobileCard
						key={subject.id}
						subject={subject}
						coverageRow={coverageBySubjectId?.get(subject.id) ?? null}
						onReviewCoverage={onReviewCoverage}
						onEdit={onEdit}
						onArchive={onArchive}
						onReactivate={onReactivate}
						onDelete={onDelete}
					/>
				))
			)}
		</div>
	);
}
