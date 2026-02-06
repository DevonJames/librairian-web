'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Typography from '@mui/material/Typography';
import { AddToDocumentDock } from '../../components/ui/AddToDocumentDock';

// Import our custom hooks
import { useJfkDocuments } from '../../hooks/jfk/useJfkDocuments';

// Import our utility functions
import {
	getDocumentAppUrl,
	formatDate,
} from '../../utils/jfk/docUtils';
import { getLatestStage } from '../../utils/jfk/statusUtils';
import { JFKDocument } from '../../utils/jfk/types';

// Import the document group context
import { useDocumentGroups } from '../../lib/context/DocumentGroupContext';

export default function DocumentsPage() {
	// Use our custom hooks
	const {
		documents,
		isLoading,
		totalDocuments,
		currentPage,
		totalPages,
		setCurrentPage,
		goToNextPage,
		goToPrevPage,
		refreshDocuments,
	} = useJfkDocuments();

	// Use document groups context to filter documents
	const { enabledGroups, refreshGroups } = useDocumentGroups();

	// State for syncing all documents
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncStatus, setSyncStatus] = useState<string | null>(null);

	// Function to sync all documents from analyzer
	const syncAllDocuments = async () => {
		if (isSyncing) return;
		
		setIsSyncing(true);
		setSyncStatus('Syncing documents...');
		
		try {
			const response = await fetch('/api/docs/sync-all', {
				method: 'POST',
			});
			
			const result = await response.json();
			
			if (response.ok) {
				const syncedCount = result.created + result.updated;
				setSyncStatus(`Synced ${syncedCount} of ${result.total} documents (${result.created} new, ${result.updated} updated)`);
				// Refresh the document groups to pick up new collections
				await refreshGroups();
				// Refresh the document list after sync
				await refreshDocuments();
			} else {
				setSyncStatus(`Sync failed: ${result.error}`);
			}
		} catch (err) {
			setSyncStatus(`Sync error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			setIsSyncing(false);
			// Clear status after 5 seconds
			setTimeout(() => setSyncStatus(null), 5000);
		}
	};

	// Apply document group filtering with better group/type mapping
	const filteredDocuments = documents.filter((doc) => {
		// Check for documentGroup property (in the database) first
		const docWithType = doc as JFKDocument & {
			documentType?: string;
			documentGroup?: string;
		};

		// Default document group logic:
		// 1. Use explicit documentGroup if set
		// 2. Use documentType as fallback (for backward compatibility)
		// 3. Infer from document ID if possible (RFK documents often have 'RFK' in their ID)
		// 4. Default to 'jfk' as final fallback
		let docGroup = 'jfk';

		if (docWithType.documentGroup) {
			// Use the explicitly set document group
			docGroup = docWithType.documentGroup.toLowerCase();
		} else if (docWithType.documentType) {
			// Use documentType as fallback (for backward compatibility)
			docGroup = docWithType.documentType.toLowerCase();
		} else if (
			doc.id &&
			typeof doc.id === 'string' &&
			doc.id.toUpperCase().includes('RFK')
		) {
			// Infer RFK from document ID if it contains 'RFK'
			docGroup = 'rfk';
		}

		// Log documents for debugging
		if (docGroup === 'rfk') {
			console.log('Found RFK document:', doc.id, docGroup);
		}

		return enabledGroups.includes(docGroup);
	});


	// Calculate pagination values for filtered documents
	const itemsPerPage = 10;
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = Math.min(
		startIndex + itemsPerPage,
		filteredDocuments.length
	);
	const filteredTotalPages = Math.max(
		1,
		Math.ceil(filteredDocuments.length / itemsPerPage)
	);

	// When showing filtered results, adjust pagination text/controls
	const showFilteredPagination =
		filteredDocuments.length !== documents.length;
	const effectiveTotalPages = showFilteredPagination
		? filteredTotalPages
		: totalPages;

	// Reset to page 1 when filters change
	useEffect(() => {
		setCurrentPage(1);
	}, [enabledGroups, setCurrentPage]);

	// Make sure currentPage is valid for filtered documents
	useEffect(() => {
		if (
			currentPage > effectiveTotalPages &&
			effectiveTotalPages > 0 &&
			filteredDocuments.length > 0
		) {
			setCurrentPage(effectiveTotalPages);
		}
	}, [
		totalPages,
		effectiveTotalPages,
		currentPage,
		setCurrentPage,
		filteredDocuments.length,
	]);


	if (isLoading) {
		return (
			<div
				style={{
					maxWidth: '1200px',
					margin: '0 auto',
					padding: '1.5rem 1rem',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					minHeight: '50vh',
				}}
			>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
					}}
				>
					<div
						style={{
							width: '2.5rem',
							height: '2.5rem',
							borderRadius: '50%',
							border: '2px solid rgba(59, 130, 246, 0.2)',
							borderTopColor: '#3b82f6',
							animation: 'spin 1s linear infinite',
							marginBottom: '1rem',
						}}
					></div>
					<h2
						style={{
							fontSize: '1.125rem',
							fontWeight: 600,
							color: '#4b5563',
						}}
					>
						Loading documents...
					</h2>
				</div>
			</div>
		);
	}

	return (
		<div
			className='container mx-auto px-4 py-8'
			style={{ paddingBottom: '80px' }}
		>
			<h1
				style={{
					fontFamily: 'Arial, sans-serif',
					fontWeight: 500,
					fontSize: '1.875rem',
					marginBottom: '1.5rem',
					color: '#1e3a8a',
				}}
			>
				Document Library
			</h1>

			<div
				style={{
					marginBottom: '1rem',
					display: 'flex',
					alignItems: 'center',
					flexWrap: 'wrap',
					gap: '1rem',
				}}
			>
				<Button
					variant='outlined'
					onClick={() => refreshDocuments()}
					style={{
						borderColor: '#6b7280',
						color: '#6b7280',
					}}
				>
					Refresh List
				</Button>

				<Button
					variant='contained'
					onClick={syncAllDocuments}
					disabled={isSyncing}
					style={{
						background: isSyncing ? '#9ca3af' : '#10b981',
						color: 'white',
					}}
				>
					{isSyncing ? 'Syncing...' : 'Sync All from Analyzer'}
				</Button>

				{syncStatus && (
					<Typography
						variant='body2'
						style={{
							color: syncStatus.includes('error') || syncStatus.includes('failed') ? '#dc2626' : '#059669',
							fontWeight: 500,
						}}
					>
						{syncStatus}
					</Typography>
				)}

				<Button
					variant='contained'
					color='primary'
					component={Link}
					href='/documents/visualizations'
					style={{ background: '#3b82f6' }}
					startIcon={<VisibilityIcon />}
				>
					Visualize
				</Button>

			</div>


			<TableContainer
				component={Paper}
				style={{
					marginBottom: '1.5rem',
					boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
				}}
			>
				<Table aria-label='JFK Files table'>
					<TableHead style={{ background: '#f3f4f6' }}>
						<TableRow>
							<TableCell style={{ fontWeight: 600 }}>
								Document
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								Type
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								Status
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								Page Count
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								People
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								Places
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								Dates
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								Objects
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								Last Updated
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								View
							</TableCell>
							<TableCell style={{ fontWeight: 600 }}>
								Actions
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{filteredDocuments.map((doc) => {
							// Extract or create empty analytics object if it doesn't exist
							const docWithAnalytics = doc as JFKDocument & {
								analytics?: {
									peopleCount: number;
									placesCount: number;
									datesCount: number;
									objectsCount: number;
									inQueue: boolean;
								};
								documentType?: string;
								documentGroup?: string;
							};

							// Use direct document arrays instead of analytics object
							const peopleCount = Array.isArray(doc.allNames)
								? doc.allNames.length
								: 0;
							const placesCount = Array.isArray(doc.allPlaces)
								? doc.allPlaces.length
								: 0;
							const datesCount = Array.isArray(doc.allDates)
								? doc.allDates.length
								: 0;
							const objectsCount = Array.isArray(doc.allObjects)
								? doc.allObjects.length
								: 0;

							// Keep the analytics object for backward compatibility with inQueue
							const analytics = docWithAnalytics.analytics || {
								peopleCount: 0,
								placesCount: 0,
								datesCount: 0,
								objectsCount: 0,
								inQueue: false,
							};

							// Determine if it's a JFK or RFK document with better fallback
							let documentGroup = 'JFK';
							if (docWithAnalytics.documentGroup) {
								documentGroup =
									docWithAnalytics.documentGroup.toUpperCase();
							} else if (docWithAnalytics.documentType) {
								documentGroup =
									docWithAnalytics.documentType.toUpperCase();
							} else if (
								doc.id &&
								typeof doc.id === 'string' &&
								doc.id.toUpperCase().includes('RFK')
							) {
								documentGroup = 'RFK';
							}

							// Generate appropriate document title based on collection
							const documentTitle = doc.title || `Document ${doc.id}`;

							return (
								<TableRow key={doc.id}>
									<TableCell>
										<div
											style={{
												display: 'flex',
												flexDirection: 'column',
												gap: '2px',
											}}
										>
											<span style={{ fontWeight: 500, color: '#1e3a8a' }}>
												{doc.title || 'Untitled Document'}
											</span>
											<span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
												({doc.id})
												{doc.dbId && (
													<Tooltip title='Document has been processed and is in database'>
														<Chip
															label='DB'
															size='small'
															color='success'
															style={{
																marginLeft: '0.5rem',
																height: '16px',
																fontSize: '0.6rem',
															}}
														/>
													</Tooltip>
												)}
											</span>
										</div>
									</TableCell>
									<TableCell>
										<Chip
											label={documentGroup}
											size='small'
											color='default'
											style={{
												fontWeight: 500,
												backgroundColor: '#6366f1',
												color: 'white',
											}}
										/>
									</TableCell>
									<TableCell>
										<Chip
											label={doc.processingStage || getLatestStage(doc.stages, doc) || 'Ready'}
											size='small'
											color={doc.hasFullText ? 'success' : 'default'}
										/>
									</TableCell>
									<TableCell>{doc.pageCount}</TableCell>
									<TableCell>
										{doc.allNames &&
										doc.allNames.length > 0 ? (
											<div
												style={{
													maxHeight: '150px',
													overflowY: 'auto',
													maxWidth: '300px',
													overflowX: 'hidden',
													textOverflow: 'ellipsis',
												}}
											>
												{doc.allNames.join(', ')}
											</div>
										) : (
											'None'
										)}
									</TableCell>
									<TableCell>
										{doc.allPlaces &&
										doc.allPlaces.length > 0 ? (
											<div
												style={{
													maxHeight: '150px',
													overflowY: 'auto',
													maxWidth: '300px',
													overflowX: 'hidden',
													textOverflow: 'ellipsis',
												}}
											>
												{doc.allPlaces.join(', ')}
											</div>
										) : (
											'None'
										)}
									</TableCell>
									<TableCell>
										{doc.allDates &&
										doc.allDates.length > 0 ? (
											<div
												style={{
													maxHeight: '150px',
													overflowY: 'auto',
													maxWidth: '300px',
													overflowX: 'hidden',
													textOverflow: 'ellipsis',
												}}
											>
												{doc.allDates.join(', ')}
											</div>
										) : (
											'None'
										)}
									</TableCell>
									<TableCell>
										{doc.allObjects &&
										doc.allObjects.length > 0 ? (
											<div
												style={{
													maxHeight: '150px',
													overflowY: 'auto',
													maxWidth: '300px',
													overflowX: 'hidden',
													textOverflow: 'ellipsis',
												}}
											>
												{doc.allObjects.join(', ')}
											</div>
										) : (
											'None'
										)}
									</TableCell>
									<TableCell>
										{formatDate(doc.lastUpdated)}
									</TableCell>
									<TableCell>
										<Link
											href={`/documents/${doc.id}`}
											style={{
												color: '#1e3a8a',
												textDecoration: 'underline',
												fontWeight: 500,
												display: 'flex',
												alignItems: 'center',
												gap: '4px',
											}}
										>
											<VisibilityIcon fontSize='small' />
											View Document
										</Link>
									</TableCell>
									<TableCell>
										<div
											style={{
												display: 'flex',
												gap: '0.5rem',
											}}
										>
											<Tooltip title='View document'>
												<IconButton
													size='small'
													component={Link}
													href={getDocumentAppUrl(doc.id)}
													style={{
														color: '#1e3a8a',
													}}
												>
													<VisibilityIcon fontSize='small' />
												</IconButton>
											</Tooltip>
											<AddToDocumentDock
												item={{
													id: doc.dbId || doc.id,
													title: doc.title || `Document ${doc.id}`,
													url: getDocumentAppUrl(doc.id) || '',
													type: 'document',
												}}
											/>
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</TableContainer>

			{/* Add document count information right before pagination */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'center',
					marginBottom: '0.5rem',
				}}
			>
				<Typography variant='body2' color='textSecondary'>
					{totalDocuments === 0
						? `No documents found`
						: (() => {
								const start =
									(currentPage - 1) * itemsPerPage + 1;
								const end = Math.min(
									currentPage * itemsPerPage,
									totalDocuments
								);
								return `Showing ${start}-${end} of ${totalDocuments} documents`;
						  })()}
				</Typography>
			</div>

			{/* Collection filter info */}
			<div
				style={{
					padding: '10px',
					marginBottom: '1rem',
					backgroundColor: '#f9fafb',
					border: '1px solid #e5e7eb',
					borderRadius: '0.375rem',
				}}
			>
				<Typography variant='body2'>
					Active Collections: <code>{JSON.stringify(enabledGroups)}</code>
					{' | '}
					Total Documents: <code>{totalDocuments}</code>
					{' | '}
					Showing: <code>{filteredDocuments.length}</code>
				</Typography>
			</div>

			{/* Use pagination controls that respect filtered documents */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'center',
					marginBottom: '1.5rem',
				}}
			>
				<div
					style={{
						display: 'flex',
						gap: '0.5rem',
						alignItems: 'center',
					}}
				>
					<Button
						onClick={() => setCurrentPage(1)}
						disabled={
							currentPage === 1 || filteredDocuments.length === 0
						}
						variant='outlined'
						size='small'
						style={{ minWidth: '60px' }}
					>
						START
					</Button>
					<Button
						onClick={goToPrevPage}
						disabled={
							currentPage === 1 || filteredDocuments.length === 0
						}
						variant='outlined'
						size='small'
						style={{ minWidth: '80px' }}
					>
						PREVIOUS
					</Button>

					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							margin: '0 0.5rem',
						}}
					>
						<Box
							component='span'
							sx={{
								px: 2,
								py: 1,
								border: '1px solid #e2e8f0',
								borderRadius: '0.25rem',
								bgcolor: '#f8fafc',
								fontWeight: 'medium',
								fontSize: '0.875rem',
								display: 'flex',
								alignItems: 'center',
							}}
						>
							Page
							<TextField
								size='small'
								value={currentPage}
								onChange={(e) => {
									const pageNum = parseInt(e.target.value);
									if (
										!isNaN(pageNum) &&
										pageNum > 0 &&
										pageNum <= effectiveTotalPages &&
										filteredDocuments.length > 0
									) {
										setCurrentPage(pageNum);
									}
								}}
								inputProps={{
									min: 1,
									max: effectiveTotalPages,
									style: {
										width: '40px',
										padding: '4px 8px',
										margin: '0 8px',
										textAlign: 'center',
									},
								}}
								disabled={filteredDocuments.length === 0}
							/>
							of{' '}
							{filteredDocuments.length === 0
								? 0
								: effectiveTotalPages}
						</Box>
					</div>

					<Button
						onClick={goToNextPage}
						disabled={
							currentPage === effectiveTotalPages ||
							filteredDocuments.length === 0
						}
						variant='outlined'
						size='small'
						style={{ minWidth: '80px' }}
					>
						NEXT
					</Button>
					<Button
						onClick={() => setCurrentPage(effectiveTotalPages)}
						disabled={
							currentPage === effectiveTotalPages ||
							filteredDocuments.length === 0
						}
						variant='outlined'
						size='small'
						style={{ minWidth: '60px' }}
					>
						END
					</Button>
				</div>
			</div>

			{/* Add pagination summary */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'center',
					marginBottom: '1.5rem',
				}}
			>
				<Typography variant='body2' color='textSecondary'>
					{(() => {
						const start = (currentPage - 1) * itemsPerPage + 1;
						const end = Math.min(
							currentPage * itemsPerPage,
							totalDocuments
						);
						return `Showing page ${currentPage} of ${totalPages} (${start}-${end} of ${totalDocuments} total documents)`;
					})()}
				</Typography>
			</div>

		</div>
	);
}
