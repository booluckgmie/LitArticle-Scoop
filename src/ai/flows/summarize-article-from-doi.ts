'use server';

/**
 * @fileOverview Summarizes the key findings of a research paper given its DOI.
 *
 * - summarizeArticle - A function that handles the article summarization process.
 * - SummarizeArticleInput - The input type for the summarizeArticle function.
 * - SummarizeArticleOutput - The return type for the summarizeArticle function.
 */

import {ai} from '@/ai/ai-instance';
// Note: downloadArticle service is currently not used as link finding is separate.
// import {downloadArticle} from '@/services/article-downloader';
import {z} from 'genkit';

const SummarizeArticleInputSchema = z.object({
  doi: z.string().describe('The DOI of the article to summarize.'),
  // We might need the URL if we were to fetch content, but currently passing placeholder content.
  // articleUrl: z.string().url().describe('The URL of the article PDF.'),
});
export type SummarizeArticleInput = z.infer<typeof SummarizeArticleInputSchema>;

const SummarizeArticleOutputSchema = z.object({
  summary: z.string().describe('A summary of the key findings of the research paper.'),
});
export type SummarizeArticleOutput = z.infer<typeof SummarizeArticleOutputSchema>;

export async function summarizeArticle(input: SummarizeArticleInput): Promise<SummarizeArticleOutput> {
  return summarizeArticleFlow(input);
}

const summarizeArticlePrompt = ai.definePrompt({
  name: 'summarizeArticlePrompt',
  input: {
    schema: z.object({
      doi: z.string().describe('The DOI of the article to summarize.'),
      articleContent: z.string().describe('The extracted text content of the article to summarize.'),
    }),
  },
  output: {
    schema: z.object({
      summary: z.string().describe('A concise summary of the key findings of the research paper based *only* on the provided content.'),
    }),
  },
  prompt: `You are an expert research paper summarizer. Based *only* on the provided article content below, provide a concise summary of the key findings. Do not use external knowledge.\n\nArticle DOI: {{{doi}}}\n\nArticle Content:\n{{{articleContent}}}`,
});

const summarizeArticleFlow = ai.defineFlow<
  typeof SummarizeArticleInputSchema,
  typeof SummarizeArticleOutputSchema
>(
  {
    name: 'summarizeArticleFlow',
    inputSchema: SummarizeArticleInputSchema,
    outputSchema: SummarizeArticleOutputSchema,
  },
  async input => {
    // TODO: Implement robust fetching and parsing of PDF content from a URL.
    // This requires a separate service or library capable of handling PDF text extraction.
    // The URL would likely come from the 'findArticleLinkFromDoi' flow's output.
    // For now, we pass placeholder text.
    const articleContent = `Placeholder content for article with DOI ${input.doi}. In a real implementation, this would be the extracted text from the downloaded PDF. The paper discusses various important findings related to its subject matter, presenting data and analysis to support its conclusions. Key results indicate significant trends and correlations, contributing valuable insights to the field.`;

    if (!articleContent) {
        throw new Error(`Could not retrieve or parse content for article with DOI ${input.doi}.`);
    }

    const {output} = await summarizeArticlePrompt({
      doi: input.doi,
      articleContent: articleContent,
    });

    if (!output) {
        throw new Error(`AI failed to generate a summary for DOI ${input.doi}.`);
    }

    return output;
  }
);
