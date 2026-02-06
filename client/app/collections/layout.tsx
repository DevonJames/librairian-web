'use client';

import React from 'react';
import { DocumentDock } from '@/components/ui/DocumentDock';

export default function CollectionsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className='flex flex-col h-full relative'>
			{/* Main content area with bottom padding for dock */}
			<div className='flex-1 overflow-auto pb-20'>
				{children}
			</div>

			{/* Fixed dock at the bottom */}
			<div className='fixed bottom-0 left-0 right-0 z-10 border-t bg-background md:ml-64'>
				<DocumentDock />
			</div>
		</div>
	);
}
