'use server';

/**
 * @fileOverview Summarizes the key findings of a research paper given its DOI.
 *
 * - summarizeArticle - A function that handles the article summarization process.
 * - SummarizeArticleInput - The input type for the summarizeArticle function.
 * - SummarizeArticleOutput - The return type for the summarizeArticle function.
 */

import {ai} from '@/ai/ai-instance';
import {downloadArticle} from '@/services/article-downloader';
import {z} from 'genkit';

const SummarizeArticleInputSchema = z.object({
  doi: z.string().describe('The DOI of the article to summarize.'),
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
      articleContent: z.string().describe('The content of the article to summarize.'),
    }),
  },
  output: {
    schema: z.object({
      summary: z.string().describe('A summary of the key findings of the research paper.'),
    }),
  },
  prompt: `You are an expert research paper summarizer. Please provide a concise summary of the key findings of the following research paper.\n\nArticle DOI: {{{doi}}}\nArticle Content: {{{articleContent}}}`,
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
    const downloadResult = await downloadArticle(input.doi);

    if (!downloadResult.success || !downloadResult.downloadUrl) {
      throw new Error(`Failed to download article with DOI ${input.doi}: ${downloadResult.error}`);
    }

    // TODO: Instead of downloading, read the article content from the URL.
    // For now, we pass a placeholder since downloading the content is out of scope.
    const articleContent = `Article content for DOI ${input.doi} goes here. Pretend it's very long.`;

    const {output} = await summarizeArticlePrompt({
      doi: input.doi, 
      articleContent: articleContent,
    });
    
    return output!;
  }
);
