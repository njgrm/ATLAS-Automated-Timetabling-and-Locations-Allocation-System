import { SortableColumnHeader } from '@/components/table/SortableColumnHeader';

// SCA-01.2: 'isSeedable' is not a sort field. Bootstrap seed state must not
// rank the catalog — Teacher coverage is a plain display column.
export type SortField = 'code' | 'name' | 'minMinutesPerWeek' | 'preferredRoomType' | 'gradeLevels';
export type SortDir = 'asc' | 'desc';

type SortableHeaderProps = {
	field: SortField;
	label: string;
	sortField: SortField;
	sortDir: SortDir;
	onToggleSort: (field: SortField) => void;
	align?: 'left' | 'right';
};

/**
 * A5 (items 34 + 35): the Subjects header is now a thin binding over the ONE
 * shared `SortableColumnHeader`. The Subjects-specific sort keys stay declared
 * here (other modules import these types), but the markup, the `aria-sort`
 * value, the button and the portalled dark tooltip are owned by the shared
 * primitive — so the clipping fix reaches this table without a second copy of
 * the header, and no future table can reintroduce the bug.
 */
export function SortableHeader({
	field,
	label,
	sortField,
	sortDir,
	onToggleSort,
	align = 'left',
}: SortableHeaderProps) {
	return (
		<SortableColumnHeader
			field={field}
			label={label}
			sortField={sortField}
			sortDir={sortDir}
			onToggleSort={onToggleSort}
			align={align}
		/>
	);
}
