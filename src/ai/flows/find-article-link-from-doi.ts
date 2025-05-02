'use server';

/**
 * @fileOverview An AI agent that attempts to find a downloadable link for an article given its DOI.
 *
 * - findArticleLinkFromDoi - A function that handles the process of finding the article link.
 * - FindArticleLinkFromDoiInput - The input type for the findArticleLinkFromDoi function.
 * - FindArticleLinkFromDoiOutput - The return type for the findArticleLinkFromDoi function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const FindArticleLinkFromDoiInputSchema = z.string().describe('The DOI of the article.');
export type FindArticleLinkFromDoiInput = z.infer<typeof FindArticleLinkFromDoiInputSchema>;

const FindArticleLinkFromDoiOutputSchema = z.union([
  z.object({
    found: z.literal(true),
    url: z.string().describe('The URL where the article can be downloaded.'),
  }),
  z.object({
    found: z.literal(false),
    reason: z.string().describe('The reason why the article link could not be found.'),
  }),
]);
export type FindArticleLinkFromDoiOutput = z.infer<typeof FindArticleLinkFromDoiOutputSchema>;

export async function findArticleLinkFromDoi(
  input: FindArticleLinkFromDoiInput
): Promise<FindArticleLinkFromDoiOutput> {
  return findArticleLinkFromDoiFlow(input);
}

// Define the tool: configuration object first, then the implementation function
const searchArticleLink = ai.defineTool(
  {
    name: 'searchArticleLink',
    description: 'Searches for a downloadable article link given its DOI, prioritizing ResearchGate and arXiv.',
    inputSchema: z.object({
      doi: z.string().describe('The DOI of the article to search for.'),
    }),
    outputSchema: z.union([
      z.object({
        found: z.literal(true),
        url: z.string().describe('The URL where the article can be downloaded.'),
      }),
      z.object({
        found: z.literal(false),
        reason: z.string().describe('The reason why the article link could not be found.'),
      }),
    ]),
  },
  // Implementation function passed as the second argument
  async (input) => {
    // TODO: Implement the search for the article link using a search engine and scraping.
    // Prioritize ResearchGate and arXiv.
    // For now, return a canned response.
    if (input.doi === '10.1000/xyz123') {
      return {
        found: true,
        url: 'https://example.com/article.pdf',
      };
    } else {
      return {
        found: false,
        reason: 'Article not found on ResearchGate or arXiv.',
      };
    }
  }
);

const findArticleLinkFromDoiPrompt = ai.definePrompt({
  name: 'findArticleLinkFromDoiPrompt',
  tools: [searchArticleLink],
  prompt: `Given the DOI "{{doi}}", use the searchArticleLink tool to find a downloadable link for the article.`,
  input: z.object({
    doi: z.string().describe('The DOI of the article.'),
  }),
  output: z.union([
    z.object({
      found: z.literal(true),
      url: z.string().describe('The URL where the article can be downloaded.'),
    }),
    z.object({
      found: z.literal(false),
      reason: z.string().describe('The reason why the article link could not be found.'),
    }),
  ]),
});

const findArticleLinkFromDoiFlow = ai.defineFlow<
  typeof FindArticleLinkFromDoiInputSchema,
  typeof FindArticleLinkFromDoiOutputSchema
>({
  name: 'findArticleLinkFromDoiFlow',
  inputSchema: FindArticleLinkFromDoiInputSchema,
  outputSchema: FindArticleLinkFromDoiOutputSchema,
},
async input => {
  const result = await findArticleLinkFromDoiPrompt({doi: input});
  // Use the tool's output directly if available
  const toolResponse = result.toolRequests[0]?.output?.[0]?.result;
  if (toolResponse) {
     return toolResponse as FindArticleLinkFromDoiOutput;
  }
  // Fallback or handle cases where the tool wasn't called as expected
  return result.output ?? { found: false, reason: 'AI did not provide a conclusive answer or use the tool.' };
});
