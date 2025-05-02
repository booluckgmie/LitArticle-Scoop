import { findArticleLinkFromDoi } from '@/ai/flows/find-article-link-from-doi';

export interface DoiResult {
  doi: string;
  status: 'pending' | 'success' | 'not_found' | 'error';
  url?: string;
  message?: string;
}

// Known direct link patterns
const urlPatterns: { [key: string]: (doi: string) => string } = {
  'bpspsychub.onlinelibrary.wiley.com': (doi) => `https://bpspsychub.onlinelibrary.wiley.com/doi/pdfdirect/${doi}`,
  'onlinelibrary.wiley.com': (doi) => `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`,
  'link.springer.com': (doi) => `https://link.springer.com/content/pdf/${doi}.pdf`,
  'www.emerald.com': (doi) => `https://www.emerald.com/insight/content/doi/${doi}/full/pdf`,
  'www.tandfonline.com': (doi) => `https://www.tandfonline.com/doi/epdf/${doi}?needAccess=true`,
  'journals.sagepub.com': (doi) => `https://journals.sagepub.com/doi/pdf/${doi}`,
};

// Function to extract domain for matching patterns (simple version)
function getDomain(doi: string): string | null {
    // This is a very simplified way to guess the publisher based on DOI prefix.
    // A more robust solution would involve querying CrossRef API or similar.
    if (doi.startsWith('10.1111')) return 'onlinelibrary.wiley.com'; // Wiley
    if (doi.startsWith('10.1007')) return 'link.springer.com'; // Springer
    if (doi.startsWith('10.1108')) return 'www.emerald.com'; // Emerald
    if (doi.startsWith('10.1080')) return 'www.tandfonline.com'; // Taylor & Francis
    if (doi.startsWith('10.1177')) return 'journals.sagepub.com'; // SAGE
    // Add more specific prefixes if known
    return null;
}

// Check if a URL likely points to a downloadable PDF
async function checkUrlValidity(url: string): Promise<boolean> {
  try {
    // Use HEAD request to check content type without downloading the whole file
    const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' }); // Use no-cors as direct HEAD requests might be blocked

    // Due to 'no-cors', we can't directly inspect headers like Content-Type.
    // We'll rely on the fact that if the request doesn't immediately fail (e.g., network error, immediate 404),
    // it's *potentially* valid. This is a limitation.
    // A more reliable check would require a backend proxy to bypass CORS.
    // For now, we'll assume success if the fetch doesn't throw.
    // We also check common PDF extensions or indicators in the URL path.
    const path = new URL(url).pathname.toLowerCase();
     return path.endsWith('.pdf') || path.includes('/pdf') || path.includes('pdfdirect');

  } catch (error) {
    // Network error or invalid URL structure
    console.warn(`HEAD request failed for ${url}:`, error);
    return false;
  }
}


export async function processDois(dois: string[]): Promise<DoiResult[]> {
  const results: DoiResult[] = dois.map(doi => ({ doi, status: 'pending' }));

  const processSingleDoi = async (doi: string): Promise<DoiResult> => {
    try {
        // 1. Try known patterns based on DOI prefix guess
        const guessedDomain = getDomain(doi);
        if (guessedDomain && urlPatterns[guessedDomain]) {
            const potentialUrl = urlPatterns[guessedDomain](doi);
            console.log(`Trying known pattern for ${doi}: ${potentialUrl}`);
             // Basic check: Does it look like a PDF URL?
             const looksLikePdf = potentialUrl.toLowerCase().includes('pdf');
             if (looksLikePdf) {
                 return { doi, status: 'success', url: potentialUrl };
             }
            // if (await checkUrlValidity(potentialUrl)) {
            //     return { doi, status: 'success', url: potentialUrl };
            // }
        }

        // 2. If pattern fails or no pattern matches, try AI
        console.log(`Known pattern failed or missing for ${doi}. Trying AI search...`);
        const aiResult = await findArticleLinkFromDoi(doi);

        if (aiResult.found) {
            console.log(`AI found link for ${doi}: ${aiResult.url}`);
            // Optional: Add validity check for AI result if needed
            return { doi, status: 'success', url: aiResult.url };
        } else {
            console.log(`AI could not find link for ${doi}: ${aiResult.reason}`);
            return { doi, status: 'not_found', message: `AI: ${aiResult.reason}` };
        }
    } catch (error) {
        console.error(`Error processing DOI ${doi}:`, error);
        return { doi, status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
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
      console.error(`Unexpected error for DOI ${dois[index]}:`, result.reason);
      return {
        doi: dois[index],
        status: 'error',
        message: 'Processing failed unexpectedly.',
      };
    }
  });
}
