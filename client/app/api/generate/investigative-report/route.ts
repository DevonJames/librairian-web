/**
 * API Route: Generate Investigative Report
 * 
 * POST /api/generate/investigative-report
 * 
 * Generates an audio investigative report from documents using AI dialogue.
 * Uses Server-Sent Events (SSE) for progress updates.
 */

import { NextRequest } from 'next/server';
import { generateInvestigativeReport } from '@server/audio-generation';
import type { DocumentInput } from '@server/audio-generation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Set up SSE headers
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE events
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Keep-alive ping
      const keepAliveInterval = setInterval(() => {
        sendEvent('ping', { message: 'Connection alive' });
      }, 15000);

      try {
        // Parse request body
        const body = await request.json();
        const {
          documents,
          investigation = 'Document Investigation',
          selectedInvestigators = ['reporter', 'privateEye'],
          targetLengthSeconds = 300,
        } = body as {
          documents: DocumentInput[];
          investigation?: string;
          selectedInvestigators?: string[];
          targetLengthSeconds?: number;
        };

        // Validate input
        if (!documents || !Array.isArray(documents) || documents.length === 0) {
          sendEvent('error', { message: 'Documents are required' });
          clearInterval(keepAliveInterval);
          controller.close();
          return;
        }

        // Send initial status
        sendEvent('generatingReport', {
          message: 'Starting investigative report generation',
        });

        // Generate the report with progress callbacks
        const result = await generateInvestigativeReport(
          documents,
          investigation,
          selectedInvestigators,
          targetLengthSeconds,
          (progress) => {
            sendEvent('investigationUpdate', {
              status: progress.status,
              message: progress.message,
              currentStep: progress.currentStep,
              totalSteps: progress.totalSteps,
            });
          }
        );

        if (result.success) {
          sendEvent('reportComplete', {
            message: 'Investigative report generation complete!',
            reportFile: result.audioFile,
            audioUrl: result.audioUrl,
            title: result.title,
            tags: result.tags,
          });
        } else {
          sendEvent('error', {
            message: result.error || 'Failed to generate report',
          });
        }

      } catch (error) {
        console.error('Error in investigative report generation:', error);
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      } finally {
        clearInterval(keepAliveInterval);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
