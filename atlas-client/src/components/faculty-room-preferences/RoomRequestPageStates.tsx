import { AlertCircle } from 'lucide-react';

import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

export function RoomRequestLoadingState() {
	return (
		<div className='flex h-[calc(100svh-3.5rem)] flex-col px-4 py-4 sm:px-6 sm:py-6'>
			<div className='grid gap-3 md:grid-cols-[1.15fr_0.85fr]'>
				<Skeleton className='h-[72svh] rounded-2xl' />
				<Skeleton className='h-[72svh] rounded-2xl' />
			</div>
		</div>
	);
}

export function RoomRequestErrorState({
	error,
	onRetry,
}: {
	error: string;
	onRetry: () => void;
}) {
	return (
		<div className='p-4 sm:p-6'>
			<Card>
				<CardContent className='flex items-center gap-3 py-8'>
					<AlertCircle className='size-5 text-destructive shrink-0' />
					<div>
						<p className='font-medium text-destructive'>Cannot load room requests</p>
						<p className='text-sm text-muted-foreground mt-1'>{error}</p>
					</div>
					<Button variant='outline' size='sm' className='ml-auto' onClick={onRetry}>
						Retry
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
