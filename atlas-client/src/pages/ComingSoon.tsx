import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function ComingSoon() {
	const { pathname } = useLocation();
	const pageName = pathname.split('/').filter(Boolean).pop() ?? 'Page';
	const label = pageName.charAt(0).toUpperCase() + pageName.slice(1);

	return (
		<div className="flex h-full items-center justify-center px-6 py-4">
			<div className="text-center">
				<Construction className="mx-auto size-12 text-muted-foreground/30" />
				<h1 className="mt-4 text-lg font-bold text-foreground">{label}</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					This feature is coming soon.
				</p>
			</div>
		</div>
	);
}
