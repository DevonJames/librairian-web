/**
 * API Route: Generate Podcast
 * 
 * POST /api/generate/podcast
 * 
 * Generates an audio podcast from articles/content using AI dialogue.
 * Uses Server-Sent Events (SSE) for progress updates.
 */

import { NextRequest } from 'next/server';
import { generatePodcast } from '@server/audio-generation';
import type { PodcastRequest } from '@server/audio-generation';

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
          articles,
          selectedHosts = ['host1', 'host2'],
          targetLengthSeconds = 300,
        } = body as PodcastRequest;

        // Validate input
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
          sendEvent('error', { message: 'Articles are required' });
          clearInterval(keepAliveInterval);
          controller.close();
          return;
        }

        // Send initial status
        sendEvent('generatingPodcast', {
          message: 'Starting podcast generation',
        });

        // Generate the podcast with progress callbacks
        const result = await generatePodcast(
          { articles, selectedHosts, targetLengthSeconds },
          (progress) => {
            sendEvent('progress', {
              status: progress.status,
              message: progress.message,
              currentStep: progress.currentStep,
              totalSteps: progress.totalSteps,
            });
          }
        );

        if (result.success) {
          sendEvent('podcastComplete', {
            message: 'Podcast generation complete!',
            podcastFile: result.audioFile,
            audioUrl: result.audioUrl,
            title: result.title,
            tags: result.tags,
          });
        } else {
          sendEvent('error', {
            message: result.error || 'Failed to generate podcast',
          });
        }

      } catch (error) {
        console.error('Error in podcast generation:', error);
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
