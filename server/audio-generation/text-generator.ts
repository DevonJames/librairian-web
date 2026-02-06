/**
 * Text generation using Grok (xAI)
 */

import { models } from './config';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GenerateTextOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Generate text using Grok API
 */
export async function generateText(
  userPrompt: string,
  options: GenerateTextOptions = {}
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY is not configured');
  }

  const messages: Message[] = [];
  
  if (options.systemPrompt) {
    messages.push({
      role: 'system',
      content: options.systemPrompt,
    });
  }
  
  messages.push({
    role: 'user',
    content: userPrompt,
  });

  const response = await fetch(models.grok.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: models.grok.name,
      messages,
      temperature: options.temperature ?? models.grok.temperature,
      max_tokens: options.maxTokens ?? models.grok.maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from Grok API');
  }

  return data.choices[0].message.content;
}

/**
 * Generate dialogue comment for investigative report
 */
export async function generateInvestigatorComment(params: {
  speakerName: string;
  speakerAlias: string;
  speakerTone: string;
  speakerHumorStyle: string;
  documentContent: string;
  previousComment?: string;
  dialogue: { speaker: string; text: string }[];
  investigation: string;
  isIntro?: boolean;
  isOutro?: boolean;
  openingLine?: string;
  closingLine?: string;
}): Promise<string> {
  const {
    speakerName,
    speakerAlias,
    speakerTone,
    speakerHumorStyle,
    documentContent,
    previousComment,
    dialogue,
    investigation,
    isIntro,
    isOutro,
    openingLine,
    closingLine,
  } = params;

  const dialogueContext = dialogue.length > 0 
    ? `Previous dialogue:\n${dialogue.map(d => `${d.speaker}: ${d.text}`).join('\n\n')}`
    : '';

  let systemPrompt = `You are ${speakerName}, also known as "${speakerAlias}". You are an investigator analyzing documents for "${investigation}".

Your tone is ${speakerTone} and your humor style is ${speakerHumorStyle}.

Guidelines:
- Be concise and impactful
- Never include stage directions or audio cues like [laughs] or [pauses]
- Reference specific details from the documents (names, dates, places, events)
- Do NOT mention document IDs or filenames - they are just alphanumeric codes (like "EFTA01249790") that sound awkward when spoken
- Build on the conversation naturally
- Keep responses to 2-4 sentences unless introducing complex information

Handling "False Redactions" / Hidden Text:
Documents may include data about "falseRedactions" with "hiddenWords" and "hiddenPhrases" - text that was hidden behind black redaction boxes but recovered by the analyzer.
- IMPORTANT: If these words/phrases are garbled, nonsensical, or not clearly readable (e.g., random characters, partial words, OCR artifacts), they are likely MISTAKES by the analyzer, NOT actual redacted text. IGNORE them completely.
- However, if you see CLEAR names, dates, locations, or coherent phrases in the hidden text, these MAY be genuinely significant - text that was intentionally redacted from the document. You can mention these as potentially interesting findings worth noting.
- Use your judgment: only highlight hidden text that appears meaningful and could be relevant to the investigation.`;

  if (isIntro && openingLine) {
    systemPrompt += `\n\nStart your response with a variation of: "${openingLine}"`;
  }
  
  if (isOutro && closingLine) {
    systemPrompt += `\n\nEnd your response with a variation of: "${closingLine}"`;
  }

  let userPrompt = '';
  
  if (isIntro) {
    userPrompt = `You're opening the investigation. Here's an overview of the documents:\n\n${documentContent}\n\n${dialogueContext}\n\nProvide an engaging introduction that sets the stage for the investigation.`;
  } else if (isOutro) {
    userPrompt = `The investigation is wrapping up. Here's what we've covered:\n\n${documentContent}\n\n${dialogueContext}\n\nProvide a compelling conclusion that summarizes key findings and leaves the audience wanting more.`;
  } else if (previousComment) {
    userPrompt = `Respond to your colleague's observation:\n\n"${previousComment}"\n\nRelevant document content:\n${documentContent}\n\n${dialogueContext}\n\nProvide your analysis or follow-up observation.`;
  } else {
    userPrompt = `Analyze this document content:\n\n${documentContent}\n\n${dialogueContext}\n\nProvide your observations and analysis.`;
  }

  const response = await generateText(userPrompt, {
    systemPrompt,
    temperature: 0.8,
    maxTokens: 500,
  });

  // Clean up the response - remove any accidental stage directions
  return response
    .replace(/\*[^*]+\*/g, '') // Remove *actions*
    .replace(/\[[^\]]+\]/g, '') // Remove [actions]
    .replace(/\([^)]+\)/g, '') // Remove (actions) but be careful with parenthetical phrases
    .trim();
}

/**
 * Generate podcast host comment
 */
export async function generateHostComment(params: {
  speakerName: string;
  speakerAlias: string;
  speakerTone: string;
  speakerHumorStyle: string;
  articleContent: string;
  previousComment?: string;
  dialogue: { speaker: string; text: string }[];
  isIntro?: boolean;
  isOutro?: boolean;
  openingLine?: string;
  closingLine?: string;
}): Promise<string> {
  const {
    speakerName,
    speakerAlias,
    speakerTone,
    speakerHumorStyle,
    articleContent,
    previousComment,
    dialogue,
    isIntro,
    isOutro,
    openingLine,
    closingLine,
  } = params;

  const dialogueContext = dialogue.length > 0 
    ? `Previous dialogue:\n${dialogue.map(d => `${d.speaker}: ${d.text}`).join('\n\n')}`
    : '';

  let systemPrompt = `You are ${speakerName}, also known as "${speakerAlias}". You are a podcast host discussing interesting content.

Your tone is ${speakerTone} and your humor style is ${speakerHumorStyle}.

Guidelines:
- Be engaging and conversational
- Never include stage directions or audio cues
- Reference specific details from the content
- Keep responses natural and flowing
- Aim for 2-4 sentences per turn`;

  if (isIntro && openingLine) {
    systemPrompt += `\n\nStart with a variation of: "${openingLine}"`;
  }
  
  if (isOutro && closingLine) {
    systemPrompt += `\n\nEnd with a variation of: "${closingLine}"`;
  }

  let userPrompt = '';
  
  if (isIntro) {
    userPrompt = `Open the podcast episode. Here's what we're discussing:\n\n${articleContent}\n\nProvide an engaging introduction.`;
  } else if (isOutro) {
    userPrompt = `Wrap up the episode:\n\n${dialogueContext}\n\nProvide a memorable conclusion.`;
  } else if (previousComment) {
    userPrompt = `Respond to: "${previousComment}"\n\nContent: ${articleContent}\n\n${dialogueContext}`;
  } else {
    userPrompt = `Discuss this content:\n\n${articleContent}\n\n${dialogueContext}`;
  }

  const response = await generateText(userPrompt, {
    systemPrompt,
    temperature: 0.8,
    maxTokens: 400,
  });

  return response
    .replace(/\*[^*]+\*/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();
}

/**
 * Generate a title for the content
 */
export async function generateTitle(
  dialogue: { speaker: string; text: string }[],
  hostNames: string[]
): Promise<string> {
  const dialogueText = dialogue.map(d => `${d.speaker}: ${d.text}`).join('\n');
  
  const systemPrompt = `You are creating a title for an audio episode. The hosts are ${hostNames.join(' and ')}.
Create a catchy, concise title that captures the essence of the discussion. Keep it under 10 words.
Return ONLY the title, nothing else.`;

  const response = await generateText(
    `Create a title for this discussion:\n\n${dialogueText.substring(0, 2000)}`,
    { systemPrompt, temperature: 0.9, maxTokens: 50 }
  );

  return response.replace(/["']/g, '').trim();
}

/**
 * Generate tags for the content
 */
export async function generateTags(
  dialogue: { speaker: string; text: string }[]
): Promise<string[]> {
  const dialogueText = dialogue.map(d => `${d.speaker}: ${d.text}`).join('\n');
  
  const systemPrompt = `Generate 5-8 relevant tags for this audio content.
Return ONLY a comma-separated list of tags, nothing else.`;

  const response = await generateText(
    `Generate tags for:\n\n${dialogueText.substring(0, 2000)}`,
    { systemPrompt, temperature: 0.7, maxTokens: 100 }
  );

  return response.split(',').map(tag => tag.trim()).filter(Boolean);
}
