import { findArticleLinkFromDoi } from '@/ai/flows/find-article-link-from-doi';

export interface DoiResult {
  doi: string;
  status: 'pending' | 'success' | 'not_found' | 'error';
  url?: string;
  message?: string;
}

// Known direct PDF link patterns (prioritize these)
const urlPatterns: { [key: string]: (doi: string) => string } = {
  'bpspsychub.onlinelibrary.wiley.com': (doi) => `https://bpspsychub.onlinelibrary.wiley.com/doi/pdfdirect/${doi}`,
  'onlinelibrary.wiley.com': (doi) => `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`,
  'link.springer.com': (doi) => `https://link.springer.com/content/pdf/${doi}.pdf`,
  'www.emerald.com': (doi) => `https://www.emerald.com/insight/content/doi/${doi}/full/pdf?download=true`, // Added download param
  'www.tandfonline.com': (doi) => `https://www.tandfonline.com/doi/pdf/${doi}?needAccess=true`, // Changed to /pdf from /epdf
  'journals.sagepub.com': (doi) => `https://journals.sagepub.com/doi/pdf/${doi}`,
  // Add more known direct PDF patterns here
};

// Function to extract domain for matching patterns (simple version based on common prefixes)
function getDomain(doi: string): string | null {
    // This is a simplified way to guess the publisher based on DOI prefix.
    // A more robust solution might involve querying CrossRef API.
    if (doi.startsWith('10.1111')) return 'onlinelibrary.wiley.com'; // Wiley
    if (doi.startsWith('10.1007')) return 'link.springer.com'; // Springer
    if (doi.startsWith('10.1108')) return 'www.emerald.com'; // Emerald
    if (doi.startsWith('10.1080')) return 'www.tandfonline.com'; // Taylor & Francis
    if (doi.startsWith('10.1177')) return 'journals.sagepub.com'; // SAGE
    // Add more specific prefixes if known (e.g., 10.1016 for Elsevier - needs Sciencedirect logic)
    return null;
}

// Removed checkUrlValidity as it was unreliable due to CORS.
// We rely on the patterns being correct and the AI's ability to find PDF links.


export async function processDois(dois: string[]): Promise<DoiResult[]> {
  const results: DoiResult[] = dois.map(doi => ({ doi, status: 'pending' }));

  const processSingleDoi = async (doi: string): Promise<DoiResult> => {
    try {
        // 1. Try known patterns based on DOI prefix guess
        const guessedDomain = getDomain(doi);
        if (guessedDomain && urlPatterns[guessedDomain]) {
            const potentialUrl = urlPatterns[guessedDomain](doi);
            console.log(`Trying known pattern for ${doi}: ${potentialUrl}`);
            // Assume pattern is valid if it exists - these are curated direct PDF links.
            // No need for fetch check here as it's unreliable and patterns are specific.
            return { doi, status: 'success', url: potentialUrl };
        }

        // 2. If pattern fails or no pattern matches, try AI
        console.log(`Known pattern not found or applicable for ${doi}. Trying AI search...`);
        const aiResult = await findArticleLinkFromDoi(doi);

        if (aiResult.found) {
            // Basic check: Does the AI-found URL look like a PDF link?
            const looksLikePdf = aiResult.url.toLowerCase().includes('.pdf') || aiResult.url.toLowerCase().includes('/pdf');
            if (looksLikePdf) {
                 console.log(`AI found potential PDF link for ${doi}: ${aiResult.url}`);
                 return { doi, status: 'success', url: aiResult.url };
            } else {
                 console.log(`AI found a link for ${doi}, but it might not be a direct PDF: ${aiResult.url}. Marking as not found.`);
                 return { doi, status: 'not_found', message: `AI found a non-PDF link: ${aiResult.url}` };
            }
        } else {
            console.log(`AI could not find PDF link for ${doi}: ${aiResult.reason}`);
            return { doi, status: 'not_found', message: `AI: ${aiResult.reason}` };
        }
    } catch (error) {
        console.error(`Error processing DOI ${doi}:`, error);
        return { doi, status: 'error', message: error instanceof Error ? error.message : 'Unknown processing error' };
    }
  };

  // Process DOIs concurrently
  const settledResults = await Promise.allSettled(dois.map(processSingleDoi));

  // Map settled results back to the original order
  return settledResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Handle unexpected errors during individual processing
      console.error(`Unexpected failure processing DOI ${dois[index]}:`, result.reason);
      return {
        doi: dois[index],
        status: 'error',
        message: 'Processing failed unexpectedly.',
      };
    }
  });
}
