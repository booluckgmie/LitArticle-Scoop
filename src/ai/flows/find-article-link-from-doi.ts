'use server';

/**
 * @fileOverview An AI agent that attempts to find a downloadable PDF link for an article given its DOI.
 *
 * - findArticleLinkFromDoi - A function that handles the process of finding the article PDF link.
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
    url: z.string().url().describe('The direct URL where the article PDF can be downloaded.'),
  }),
  z.object({
    found: z.literal(false),
    reason: z.string().describe('The reason why the article PDF link could not be found.'),
  }),
]);
export type FindArticleLinkFromDoiOutput = z.infer<typeof FindArticleLinkFromDoiOutputSchema>;

export async function findArticleLinkFromDoi(
  input: FindArticleLinkFromDoiInput
): Promise<FindArticleLinkFromDoiOutput> {
  return findArticleLinkFromDoiFlow(input);
}

// Define the tool: configuration object first, then the implementation function
const searchArticlePdfLink = ai.defineTool(
  {
    name: 'searchArticlePdfLink',
    description: 'Searches for a direct downloadable PDF link for an article given its DOI, prioritizing official publisher sites, ResearchGate, and arXiv.',
    inputSchema: z.object({
      doi: z.string().describe('The DOI of the article to search for.'),
    }),
    outputSchema: z.union([
      z.object({
        found: z.literal(true),
        url: z.string().url().describe('The direct URL where the article PDF can be downloaded.'),
      }),
      z.object({
        found: z.literal(false),
        reason: z.string().describe('The reason why the article PDF link could not be found.'),
      }),
    ]),
  },
  // Implementation function passed as the second argument
  async (input) => {
    // TODO: Implement the search for the article PDF link using a search engine and potentially scraping.
    // Prioritize official publisher sites, ResearchGate, and arXiv.
    // Ensure the returned URL points directly to a PDF file.
    // For now, return a canned response.
    if (input.doi === '10.1000/xyz123') {
      return {
        found: true,
        url: 'https://example.com/article.pdf',
      };
    } else {
      return {
        found: false,
        reason: 'Article PDF not found on common repositories.',
      };
    }
  }
);

const findArticleLinkFromDoiPrompt = ai.definePrompt({
  name: 'findArticlePdfLinkFromDoiPrompt', // Renamed for clarity
  tools: [searchArticlePdfLink], // Use the updated tool
  prompt: `Given the DOI "{{doi}}", use the searchArticlePdfLink tool to find a direct downloadable PDF link for the article. Prioritize official sources, ResearchGate, and arXiv.`,
  input: z.object({
    doi: z.string().describe('The DOI of the article.'),
  }),
  output: z.union([
    z.object({
      found: z.literal(true),
      url: z.string().url().describe('The direct URL where the article PDF can be downloaded.'),
    }),
    z.object({
      found: z.literal(false),
      reason: z.string().describe('The reason why the article PDF link could not be found.'),
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
async (input) => { // Corrected syntax: added parentheses around the parameter
  const result = await findArticleLinkFromDoiPrompt({doi: input});

  // Check if the tool was called and returned a result
  const toolResponse = result.toolRequests?.[0]?.output?.[0]?.result;

  if (toolResponse) {
     // Ensure the tool response conforms to the expected output schema
     const validatedOutput = FindArticleLinkFromDoiOutputSchema.safeParse(toolResponse);
     if (validatedOutput.success) {
        return validatedOutput.data;
     } else {
        console.error("Tool response validation failed:", validatedOutput.error);
        return { found: false, reason: 'AI tool provided an invalid response format.' };
     }
  }

  // Fallback: If the tool wasn't called, check if the LLM provided a direct output matching the schema
  const directOutput = result.output;
  if (directOutput) {
     const validatedOutput = FindArticleLinkFromDoiOutputSchema.safeParse(directOutput);
      if (validatedOutput.success) {
          return validatedOutput.data;
      } else {
           console.warn("Direct LLM output validation failed:", validatedOutput.error);
           // Proceed with a default "not found" if direct output is invalid
      }
  }

  // Final fallback if neither tool nor direct output yielded a valid result
  return { found: false, reason: 'AI could not determine a valid PDF link or did not use the tool as expected.' };
});
