
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, AlertCircle, CheckCircle, Copy, ClipboardCheck } from 'lucide-react';

type LinkResult = {
  doi: string;
  url: string | null;
  publisher: string | null;
};

const maxDois = 10;

// Mapping from publisher prefix to URL pattern function and name
// Order matters: more specific prefixes should come first.
const publisherPatterns: { [key: string]: { generator: (doi: string) => string; name: string } } = {
    // Wiley/BPS specific pattern (most specific for 10.1111)
    '10.1111/bps': { generator: (doi) => `https://bpspsychub.onlinelibrary.wiley.com/doi/pdfdirect/${doi}`, name: 'Wiley/BPS' },
    // General Wiley (including other 10.1111 not matched above)
    '10.1111': { generator: (doi) => `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`, name: 'Wiley' },
    '10.1002': { generator: (doi) => `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`, name: 'Wiley' },
    // Springer
    '10.1007': { generator: (doi) => `https://link.springer.com/content/pdf/${doi}.pdf`, name: 'Springer' },
    // Emerald
    '10.1108': { generator: (doi) => `https://www.emerald.com/insight/content/doi/${doi}/full/pdf?download=true`, name: 'Emerald' },
    // Taylor & Francis
    '10.1080': { generator: (doi) => `https://www.tandfonline.com/doi/epdf/${doi}?needAccess=true`, name: 'Taylor & Francis' },
    // Sage
    '10.1177': { generator: (doi) => `https://journals.sagepub.com/doi/pdf/${doi}`, name: 'Sage' },
    // Add more publisher patterns here if needed
};

// Function to determine the correct URL based on DOI prefix
function getDirectPdfInfo(doi: string): { url: string | null; publisher: string | null } {
    // Find the most specific matching prefix (longest match)
    const matchingPrefix = Object.keys(publisherPatterns)
        .filter(p => doi.startsWith(p))
        .sort((a, b) => b.length - a.length)[0]; // Sort by length descending, take the first

    if (matchingPrefix && publisherPatterns[matchingPrefix]) {
        const pattern = publisherPatterns[matchingPrefix];
        return { url: pattern.generator(doi), publisher: pattern.name };
    }
    // Fallback if no prefix matches exactly
    // Check common top-level prefixes if no specific match found
    if (doi.startsWith('10.1111')) { // Catch-all for Wiley 10.1111 not matched by more specific patterns
         return { url: publisherPatterns['10.1111'].generator(doi), publisher: publisherPatterns['10.1111'].name };
    }


    return { url: null, publisher: null }; // Indicate no pattern found
}

export default function HomePage() {
  const [doiInput, setDoiInput] = useState('');
  const [results, setResults] = useState<LinkResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset copied status when results change
  useEffect(() => {
    setCopied(false);
  }, [results]);

  const handleGenerateLinks = () => {
    setCopied(false); // Reset copy status on new generation
    // 1. Clean and filter DOIs
    const dois = doiInput
      .split(/[,;\n]/) // Split by comma, semicolon, or newline
      .map(doi => doi.trim().replace(/^https?:\/\/doi.org\//, '')) // Trim and remove prefix if present
      .filter(doi => doi.startsWith('10.') && doi.includes('/')); // Keep only valid-looking DOIs

    // 2. Get unique DOIs
    const uniqueDois = [...new Set(dois)];

    // 3. Clear previous results and status
    setResults([]);
    setStatusMessage(null);

    // 4. Check DOI count
     if (uniqueDois.length === 0) {
        setStatusMessage({ type: 'error', message: "Please enter at least one valid DOI (starting with '10.' and containing '/')." });
        return;
    }

    if (uniqueDois.length > maxDois) {
        setStatusMessage({ type: 'error', message: `You entered ${uniqueDois.length} unique DOIs. The trial version allows a maximum of ${maxDois}. Please reduce the list.` });
        return;
    }

    // 5. Process DOIs and generate results
    const generatedResults = uniqueDois.map(doi => {
        const { url, publisher } = getDirectPdfInfo(doi);
        // Ensure the generated URL aims for a PDF format where possible based on patterns
        return { doi, url, publisher };
    });

    setResults(generatedResults);

    // 6. Set status message based on results
    const successfulLinks = generatedResults.filter(r => r.url).length;
    const failedLinks = uniqueDois.length - successfulLinks;

    let message = '';
    if (successfulLinks > 0) {
        message += `Generated potential direct PDF links for ${successfulLinks} DOI(s). `;
    }
    if (failedLinks > 0) {
        message += `Could not find known patterns for ${failedLinks} DOI(s). `;
    }
     if (successfulLinks > 0) {
        message += `Links open in a new tab. Access may require institutional login or be subject to paywalls. Use the 'Copy All Valid Links' button for bulk downloading with a download manager.`;
        setStatusMessage({ type: 'success', message });
    } else if (uniqueDois.length > 0) {
         setStatusMessage({ type: 'error', message: `Could not find direct download patterns for any of the ${uniqueDois.length} provided DOIs based on known publisher formats.` });
    }
  };

  const handleCopyLinks = async () => {
    const validLinks = results
      .map(result => result.url)
      .filter((url): url is string => url !== null); // Type guard to filter out nulls

    if (validLinks.length === 0) {
      // Optionally show a message if there are no links to copy
       setStatusMessage({ type: 'info', message: "No valid links available to copy." });
      return;
    }

    const linksText = validLinks.join('\n');

    try {
      await navigator.clipboard.writeText(linksText);
      setCopied(true);
      // Optional: Reset copied status after a delay
      // setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy links: ', err);
      setStatusMessage({ type: 'error', message: "Failed to copy links to clipboard. Your browser might not support this feature or requires permission." });
    }
  };

  const validResults = results.filter(r => r.url);

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">LitArticle Scoop</CardTitle>
          <CardDescription className="text-center">
            Paste DOIs below (up to {maxDois}) to generate potential direct PDF download links based on common publisher patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            id="doiInput"
            placeholder="Paste your list of DOIs here (comma, semicolon, or newline separated). E.g., 10.1111/joop.12403; 10.1007/s10551-024-05919-1"
            value={doiInput}
            onChange={(e) => setDoiInput(e.target.value)}
            rows={5}
            className="resize-y"
          />
          <Button onClick={handleGenerateLinks} className="w-full">
            Generate Download Links (Trial)
          </Button>

          {statusMessage && (
            <Alert variant={statusMessage.type === 'error' ? 'destructive' : statusMessage.type === 'info' ? 'default': 'default'} className={statusMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300' : ''}>
              {statusMessage.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <AlertTitle>{statusMessage.type === 'error' ? 'Error' : statusMessage.type === 'info' ? 'Info' : 'Status'}</AlertTitle>
              <AlertDescription>
                {statusMessage.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        {results.length > 0 && (
          <CardFooter className="flex flex-col items-start space-y-4">
             <div className="w-full flex justify-between items-center">
                <h3 className="text-lg font-semibold">Generated Links:</h3>
                {validResults.length > 0 && (
                    <Button onClick={handleCopyLinks} variant="outline" size="sm" disabled={copied}>
                        {copied ? <ClipboardCheck className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy All Valid Links'}
                    </Button>
                )}
             </div>
             {copied && <p className="text-sm text-muted-foreground">Paste the copied links into a download manager to download in bulk.</p>}
             <ul className="list-none p-0 w-full space-y-3">
                {results.map((result) => (
                  <li key={result.doi} className="border p-3 rounded-md bg-secondary/50 dark:bg-secondary/30">
                    <p className="font-medium break-all text-sm text-muted-foreground">DOI: {result.doi}</p>
                    {result.url ? (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer" // Added rel for security
                        className="inline-flex items-center text-primary hover:underline break-all"
                        // Added title for clarity, especially for long URLs
                        title={`Attempt download for ${result.doi} from ${result.publisher || 'Publisher'}`}
                      >
                        Attempt Direct PDF Link ({result.publisher || 'Known Pattern'})
                        <ExternalLink className="ml-1 h-4 w-4 flex-shrink-0" />
                      </a>
                    ) : (
                      <p className="text-sm text-destructive">No direct PDF link pattern found.</p>
                    )}
                  </li>
                ))}
              </ul>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
