import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type VirtualizedRailListProps<T> = {
	items: T[];
	getKey: (item: T, index: number) => string;
	estimateRowHeight: (item: T, index: number) => number;
	renderItem: (item: T, index: number) => ReactNode;
	className?: string;
	ariaLabel: string;
	overscan?: number;
};

export function VirtualizedRailList<T>({
	items,
	getKey,
	estimateRowHeight,
	renderItem,
	className,
	ariaLabel,
	overscan = 4,
}: VirtualizedRailListProps<T>) {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);

	const measurements = useMemo(() => {
		let offset = 0;
		return items.map((item, index) => {
			const height = estimateRowHeight(item, index);
			const measurement = { offset, height };
			offset += height;
			return measurement;
		});
	}, [estimateRowHeight, items]);

	const totalHeight = measurements.length > 0
		? measurements[measurements.length - 1].offset + measurements[measurements.length - 1].height
		: 0;

	useLayoutEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return undefined;

		const syncViewport = () => {
			setScrollTop(viewport.scrollTop);
			setViewportHeight(viewport.clientHeight);
		};

		syncViewport();
		const observer = new ResizeObserver(syncViewport);
		observer.observe(viewport);
		return () => observer.disconnect();
	}, []);

	const range = useMemo(() => {
		const viewportBottom = scrollTop + viewportHeight;
		let start = 0;
		let end = measurements.length - 1;

		for (let index = 0; index < measurements.length; index += 1) {
			const rowBottom = measurements[index].offset + measurements[index].height;
			if (rowBottom >= scrollTop) {
				start = Math.max(0, index - overscan);
				break;
			}
		}

		for (let index = start; index < measurements.length; index += 1) {
			if (measurements[index].offset > viewportBottom) {
				end = Math.min(measurements.length - 1, index + overscan);
				break;
			}
		}

		return { start, end };
	}, [measurements, overscan, scrollTop, viewportHeight]);

	const visibleItems = items.slice(range.start, range.end + 1);

	return (
		<div
			ref={viewportRef}
			className={className}
			role="list"
			aria-label={ariaLabel}
			data-virtualized-rail={ariaLabel}
			onScroll={(event) => {
				setScrollTop(event.currentTarget.scrollTop);
				setViewportHeight(event.currentTarget.clientHeight);
			}}
		>
			<div className="relative" style={{ height: totalHeight }}>
				{visibleItems.map((item, visibleIndex) => {
					const index = range.start + visibleIndex;
					const measurement = measurements[index];
					return (
						<div
							key={getKey(item, index)}
							role="listitem"
							className="absolute inset-x-0"
							style={{
								height: measurement.height,
								transform: `translateY(${measurement.offset}px)`,
							}}
						>
							{renderItem(item, index)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
