import { findArticleLinkFromDoi } from '@/ai/flows/find-article-link-from-doi';

export interface DoiResult {
  doi: string;
  status: 'pending' | 'success' | 'not_found' | 'error';
  url?: string;
  message?: string;
}

// Known direct PDF link patterns (prioritize these)
const urlPatterns: { [key: string]: (doi: string) => string } = {
  'wiley': (doi) => `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`, // Covers BPS Psychub as well
  'springer': (doi) => `https://link.springer.com/content/pdf/${doi}.pdf`,
  'emerald': (doi) => `https://www.emerald.com/insight/content/doi/${doi}/full/pdf?download=true`,
  'tandfonline': (doi) => `https://www.tandfonline.com/doi/epdf/${doi}?needAccess=true`, // Use /epdf/ as per example
  'sage': (doi) => `https://journals.sagepub.com/doi/pdf/${doi}`,
  // Add more known direct PDF patterns here for other publishers like Elsevier, IEEE etc. if identified
};

// Function to map DOI prefix to publisher key used in urlPatterns
function getPublisherKey(doi: string): string | null {
    if (!doi.startsWith('10.')) {
        return null;
    }
    const prefix = doi.substring(0, doi.indexOf('/')); // Get the part before the first '/'

    if (prefix === '10.1111') return 'wiley'; // Covers Wiley general and BPS
    if (prefix === '10.1007') return 'springer';
    if (prefix === '10.1108') return 'emerald';
    if (prefix === '10.1080') return 'tandfonline'; // Taylor & Francis
    if (prefix === '10.1177') return 'sage';
    // Add more specific prefixes if known (e.g., 10.1016 for Elsevier/ScienceDirect - often requires PII lookup or different structure)
    // Add other publisher prefixes like IEEE (10.1109), etc.

    // Fallback for other potential Wiley prefixes if needed, though 10.1111 is common
    // if (prefix.startsWith('10.1002')) return 'wiley';

    return null; // Return null if no specific pattern matches the prefix
}


export async function processDois(dois: string[]): Promise<DoiResult[]> {
  const results: DoiResult[] = dois.map(doi => ({ doi, status: 'pending' }));

  const processSingleDoi = async (doi: string): Promise<DoiResult> => {
    if (!doi || !doi.startsWith('10.')) {
        return { doi, status: 'error', message: 'Invalid DOI format. Must start with "10.".' };
    }

    try {
        // 1. Try known patterns based on DOI prefix
        const publisherKey = getPublisherKey(doi);
        if (publisherKey && urlPatterns[publisherKey]) {
            const potentialUrl = urlPatterns[publisherKey](doi);
            console.log(`Trying known pattern for ${doi} (${publisherKey}): ${potentialUrl}`);
            // Check if pattern URL is HTTPS (should be, but good practice)
            if (!potentialUrl.startsWith('https://')) {
                 console.warn(`Pattern generated non-HTTPS URL for ${doi}: ${potentialUrl}`);
                 // Decide how to handle: error, skip, or try AI? For now, let's try AI as a fallback.
            } else {
                 // Assume pattern yields a direct PDF link. Browser security may still block, but this is the best guess.
                 return { doi, status: 'success', url: potentialUrl };
            }
        }

        // 2. If no specific pattern matches or pattern failed HTTPS check, fall back to AI search
        console.log(`Known pattern not found or not applicable/secure for DOI ${doi}. Trying AI search...`);
        const aiResult = await findArticleLinkFromDoi(doi);

        if (aiResult.found) {
            // Ensure AI result is HTTPS
             if (!aiResult.url.startsWith('https://')) {
                 console.warn(`AI found a non-HTTPS URL for ${doi}: ${aiResult.url}`);
                 return { doi, status: 'error', message: 'AI found an insecure (non-HTTPS) link.' };
             }

            // More robust check: Does the AI-found URL look like a PDF link?
            const urlLower = aiResult.url.toLowerCase();
            const looksLikePdf = urlLower.endsWith('.pdf') || // Ends with .pdf
                                 urlLower.includes('/pdf') || // Contains /pdf/ or /pdf
                                 urlLower.includes('/content/pdf') || // Contains /content/pdf
                                 urlLower.includes('download=true') || // Contains download parameter
                                 urlLower.includes('format=pdf'); // Contains format parameter

            if (looksLikePdf) {
                 console.log(`AI found potential PDF link for ${doi}: ${aiResult.url}`);
                 return { doi, status: 'success', url: aiResult.url };
            } else {
                 console.log(`AI found a link for ${doi}, but it might not be a direct PDF: ${aiResult.url}. Marking as not found.`);
                 // Provide the found link in the message for user context
                 return { doi, status: 'not_found', message: `AI found a link, but it may not be a direct PDF: ${aiResult.url}` };
            }
        } else {
            console.log(`AI could not find PDF link for ${doi}: ${aiResult.reason}`);
            return { doi, status: 'not_found', message: `AI: ${aiResult.reason}` };
        }
    } catch (error) {
        console.error(`Error processing DOI ${doi}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
        // Check for specific Genkit/AI related errors if possible
        if (errorMessage.includes('quota')) {
             return { doi, status: 'error', message: 'AI processing quota exceeded. Please try again later.' };
        }
        // Check for network or fetch related errors (though direct fetch is not used here)
        if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
             return { doi, status: 'error', message: 'Network error during AI processing. Check connection.' };
        }
        return { doi, status: 'error', message: errorMessage };
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
