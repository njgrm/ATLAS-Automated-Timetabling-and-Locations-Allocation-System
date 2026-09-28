import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Input } from '@/ui/input';

type BuildingPlacementFieldsProps = {
	x: number;
	y: number;
	width: number;
	height: number;
	onUpdate: (updates: { x?: number; y?: number; width?: number; height?: number; dirty?: boolean }) => void;
};

export function BuildingPlacementFields({ x, y, width, height, onUpdate }: BuildingPlacementFieldsProps) {
	return (
		<Accordion type="single" collapsible className="rounded-xl border border-slate-100 bg-slate-50 px-3">
			<AccordionItem value="placement" className="border-0">
				<AccordionTrigger className="text-[0.72rem] font-semibold text-muted-foreground hover:no-underline">
					Advanced placement
				</AccordionTrigger>
				<AccordionContent className="grid grid-cols-2 gap-2 pb-3">
					<div>
						<label className="text-[0.6875rem] font-semibold text-muted-foreground">X</label>
						<Input
							type="number"
							value={Math.round(x)}
							onChange={(e) => onUpdate({ x: Number(e.target.value), dirty: true })}
							className="mt-1"
						/>
					</div>
					<div>
						<label className="text-[0.6875rem] font-semibold text-muted-foreground">Y</label>
						<Input
							type="number"
							value={Math.round(y)}
							onChange={(e) => onUpdate({ y: Number(e.target.value), dirty: true })}
							className="mt-1"
						/>
					</div>
					<div>
						<label className="text-[0.6875rem] font-semibold text-muted-foreground">Width</label>
						<Input
							type="number"
							min={60}
							value={Math.round(width)}
							onChange={(e) => onUpdate({ width: Math.max(60, Number(e.target.value)), dirty: true })}
							className="mt-1"
						/>
					</div>
					<div>
						<label className="text-[0.6875rem] font-semibold text-muted-foreground">Height</label>
						<Input
							type="number"
							min={40}
							value={Math.round(height)}
							onChange={(e) => onUpdate({ height: Math.max(40, Number(e.target.value)), dirty: true })}
							className="mt-1"
						/>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
