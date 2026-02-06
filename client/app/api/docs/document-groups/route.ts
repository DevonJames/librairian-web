/**
 * Document Groups API Route
 * 
 * Returns all unique document groups/collections found in the database.
 * This allows the UI to dynamically discover available collections.
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

try {
  prisma = new PrismaClient();
} catch (e) {
  console.error('[DOCUMENT GROUPS API] Error initializing Prisma client:', e);
  prisma = {} as PrismaClient;
}

export async function GET() {
  try {
    if (!prisma.document) {
      return NextResponse.json(
        { error: 'Database client initialization failed' },
        { status: 500 }
      );
    }

    // Get all unique document groups from the database
    // Now stored in lowercase for consistent filtering
    const groupResults = await prisma.document.findMany({
      where: {
        documentGroup: {
          not: null,
        },
      },
      select: {
        documentGroup: true,
      },
      distinct: ['documentGroup'],
    });

    // Also check documentType for backward compatibility
    const typeResults = await prisma.document.findMany({
      where: {
        documentType: {
          not: null,
        },
        documentGroup: null, // Only get types where group is not set
      },
      select: {
        documentType: true,
      },
      distinct: ['documentType'],
    });

    // Collect unique groups (should already be lowercase now)
    const groups = new Set<string>();
    
    groupResults.forEach((r) => {
      if (r.documentGroup) {
        groups.add(r.documentGroup.toLowerCase());
      }
    });
    
    typeResults.forEach((r) => {
      if (r.documentType) {
        groups.add(r.documentType.toLowerCase());
      }
    });

    // Get counts for each group
    const documentGroups: Array<{ id: string; name: string; count: number }> = [];
    
    for (const group of groups) {
      const count = await prisma.document.count({
        where: {
          OR: [
            { documentGroup: group },
            { documentType: group, documentGroup: null },
          ],
        },
      });
      
      // Convert to title case for display (capitalize first letter of each word)
      const displayName = group
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      documentGroups.push({
        id: group, // Lowercase ID for consistent filtering
        name: displayName, // Title case for display
        count,
      });
    }

    // Sort by count (highest first)
    documentGroups.sort((a, b) => b.count - a.count);

    console.log('[DOCUMENT GROUPS API] Returning groups:', documentGroups);

    return NextResponse.json({
      groups: documentGroups,
      totalGroups: documentGroups.length,
      status: 'success',
    });
  } catch (error) {
    console.error('[DOCUMENT GROUPS API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch document groups',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
