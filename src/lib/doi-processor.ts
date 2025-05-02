import { findArticleLinkFromDoi } from '@/ai/flows/find-article-link-from-doi';

export interface DoiResult {
  doi: string;
  status: 'pending' | 'success' | 'not_found' | 'error';
  url?: string;
  message?: string;
}

// Known direct PDF link patterns (prioritize these)
// Based on user-provided examples and common structures
const urlPatterns: { [key: string]: (doi: string) => string } = {
  'wiley': (doi) => {
    // Covers both bpspsychub.onlinelibrary.wiley.com and onlinelibrary.wiley.com
    // Determine the base URL dynamically if needed, or use a generic one if consistent
    // For now, assuming onlinelibrary.wiley.com works broadly for 10.1111
    return `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`;
  },
  'springer': (doi) => `https://link.springer.com/content/pdf/${doi}.pdf`,
  'emerald': (doi) => `https://www.emerald.com/insight/content/doi/${doi}/full/pdf?download=true`, // Kept download=true for robustness
  'tandfonline': (doi) => `https://www.tandfonline.com/doi/pdf/${doi}?needAccess=true`, // Using /pdf/ based on previous findings, kept needAccess=true
  'sage': (doi) => `https://journals.sagepub.com/doi/pdf/${doi}`,
  // Add more known direct PDF patterns here for other publishers like Elsevier, IEEE etc. if identified
  // 'sciencedirect': (doi) => `https://api.elsevier.com/content/article/pii/<PII_NEEDS_LOOKUP>?httpAccept=application/pdf` - Requires PII lookup, harder to generalize
};

// Function to map DOI prefix to publisher key used in urlPatterns
function getPublisherKey(doi: string): string | null {
    // Ensure DOI starts with '10.' as per user note
    if (!doi.startsWith('10.')) {
        return null;
    }

    const prefix = doi.substring(0, doi.indexOf('/')); // Get the part before the first '/'

    // Map known prefixes to keys in urlPatterns
    if (prefix === '10.1111') return 'wiley'; // Covers Wiley general and BPS
    if (prefix === '10.1007') return 'springer';
    if (prefix === '10.1108') return 'emerald';
    if (prefix === '10.1080') return 'tandfonline'; // Taylor & Francis
    if (prefix === '10.1177') return 'sage';
    // Add more specific prefixes if known (e.g., 10.1016 for Elsevier/ScienceDirect - requires different handling)
    // Add other publisher prefixes like IEEE (10.1109), etc.

    // Fallback for other Wiley sub-prefixes if needed, though 10.1111 is common
    // if (prefix.startsWith('10.1002') || prefix.startsWith('10.1111')) return 'wiley';

    return null; // Return null if no specific pattern matches the prefix
}


export async function processDois(dois: string[]): Promise<DoiResult[]> {
  const results: DoiResult[] = dois.map(doi => ({ doi, status: 'pending' }));

  const processSingleDoi = async (doi: string): Promise<DoiResult> => {
    // Validate DOI format slightly (starts with 10.)
     if (!doi || !doi.startsWith('10.')) {
        return { doi, status: 'error', message: 'Invalid DOI format. Must start with "10.".' };
     }

    try {
        // 1. Try known patterns based on DOI prefix
        const publisherKey = getPublisherKey(doi);
        if (publisherKey && urlPatterns[publisherKey]) {
            const potentialUrl = urlPatterns[publisherKey](doi);
            console.log(`Trying known pattern for ${doi} (${publisherKey}): ${potentialUrl}`);
            // Assume pattern yields a direct PDF link. No fetch check needed as it's often blocked by CORS.
            // The goal is to provide the *most likely* direct link based on the pattern.
            return { doi, status: 'success', url: potentialUrl };
        }

        // 2. If no specific pattern matches, fall back to AI search
        console.log(`Known pattern not found or not applicable for DOI ${doi}. Trying AI search...`);
        const aiResult = await findArticleLinkFromDoi(doi);

        if (aiResult.found) {
            // Basic check: Does the AI-found URL look like a PDF link?
            // This helps filter out landing pages found by the AI.
            const looksLikePdf = aiResult.url.toLowerCase().includes('.pdf') ||
                                 aiResult.url.toLowerCase().includes('/pdf') ||
                                 aiResult.url.toLowerCase().includes('/content/pdf'); // Added another common pattern

            if (looksLikePdf) {
                 console.log(`AI found potential PDF link for ${doi}: ${aiResult.url}`);
                 return { doi, status: 'success', url: aiResult.url };
            } else {
                 console.log(`AI found a link for ${doi}, but it might not be a direct PDF: ${aiResult.url}. Marking as not found.`);
                 // Provide the found link in the message for user context
                 return { doi, status: 'not_found', message: `AI found a non-PDF link: ${aiResult.url}` };
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
