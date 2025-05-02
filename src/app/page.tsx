
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, AlertCircle, CheckCircle, Copy, ClipboardCheck, Download, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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

    return { url: null, publisher: null }; // Indicate no pattern found
}

// Helper to sanitize DOI for use as a filename
function sanitizeDoiForFilename(doi: string): string {
    return doi.replace(/[^a-zA-Z0-9._-]/g, '_');
}


export default function HomePage() {
  const [doiInput, setDoiInput] = useState('');
  const [results, setResults] = useState<LinkResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Reset copied status when results change
  useEffect(() => {
    setCopied(false);
  }, [results]);

  const handleGenerateLinks = () => {
    setCopied(false); // Reset copy status on new generation
    setIsZipping(false); // Reset zipping status
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
        message += `Links open in a new tab. Access may require institutional login or be subject to paywalls. Use 'Copy All Valid Links' for download managers or 'Download ZIP' (experimental, may fail due to browser security/CORS).`;
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
      setStatusMessage({ type: 'success', message: "Valid links copied to clipboard. Paste into a download manager." });
      // Optional: Reset copied status after a delay
       setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy links: ', err);
      setStatusMessage({ type: 'error', message: "Failed to copy links to clipboard. Your browser might not support this feature or requires permission." });
    }
  };

  const handleDownloadZip = async () => {
    const validResultsToZip = results.filter(r => r.url);

    if (validResultsToZip.length === 0) {
      setStatusMessage({ type: 'info', message: "No valid links available to download." });
      return;
    }

    setIsZipping(true);
    setStatusMessage({ type: 'info', message: `Attempting to download ${validResultsToZip.length} PDF(s) into a ZIP file. This may take a while and might be blocked by browser security (CORS)...` });

    const zip = new JSZip();
    let successfulDownloads = 0;
    let failedDownloads = 0;

    // Use Promise.allSettled to attempt all downloads, even if some fail
    const downloadPromises = validResultsToZip.map(result =>
      fetch(result.url!, { mode: 'cors' }) // Explicitly set CORS mode if needed, though 'no-cors' might hide errors but allow opaque responses
        .then(response => {
          if (!response.ok) {
            // Check if response status indicates an error (e.g., 404, 403, 500)
             // Log specific error, potentially CORS-related
             if (response.type === 'opaque') {
                 console.warn(`Received opaque response for ${result.doi}. Cannot verify content. Likely CORS issue.`);
                 // Treat opaque as failure for zipping, as content is inaccessible
                 throw new Error(`Opaque response (likely CORS) for ${result.doi}`);
             } else {
                 throw new Error(`HTTP error! status: ${response.status} for ${result.doi}`);
             }
          }
           // Try to get the blob only if response is ok and not opaque
          return response.blob();
        })
        .then(blob => {
          // Check if the blob type suggests it's a PDF, otherwise might be an HTML error page
          // This check might be less reliable with CORS issues.
          if (blob.type !== 'application/pdf' && !blob.type.startsWith('application/octet-stream')) { // Allow octet-stream as some servers send PDF this way
             console.warn(`Downloaded content for ${result.doi} might not be a PDF (type: ${blob.type}). It could be an error page or require login. Adding to ZIP anyway.`);
             // Decide whether to throw an error or proceed cautiously
             // throw new Error(`Content for ${result.doi} is not a PDF (type: ${blob.type})`);
          }
           // Add the blob to the zip file
          const filename = `${sanitizeDoiForFilename(result.doi)}.pdf`;
          zip.file(filename, blob);
          return { status: 'fulfilled', doi: result.doi } as const; // Mark as success
        })
        .catch(error => {
           // Log the error and mark as failed
          console.error(`Failed to download or process ${result.doi}:`, error);
          return { status: 'rejected', doi: result.doi, reason: error } as const;
        })
    );

    const resultsSettled = await Promise.allSettled(downloadPromises);

     // Process results after all attempts are finished
    resultsSettled.forEach(outcome => {
      if (outcome.status === 'fulfilled' && outcome.value?.status === 'fulfilled') {
        successfulDownloads++;
      } else {
        failedDownloads++;
         // Log failure reason if available from the inner promise structure
        if (outcome.status === 'fulfilled' && outcome.value?.status === 'rejected') {
          console.error(`Download failed for DOI ${outcome.value.doi}: ${outcome.value.reason}`);
        } else if (outcome.status === 'rejected') {
           // If the outer promise rejected, it might be a network error before fetch even started
           console.error(`Download promise rejected: ${outcome.reason}`); // May need more context to link to DOI if fetch failed early
        }
      }
    });


    setIsZipping(false);

    if (successfulDownloads > 0) {
      try {
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'LitArticle_Scoop_Downloads.zip');
         setStatusMessage({
          type: 'success',
          message: `Successfully added ${successfulDownloads} file(s) to the ZIP. ${failedDownloads > 0 ? `${failedDownloads} download(s) failed (check console for details - likely due to CORS or login requirements).` : ''} ZIP file generated.`
        });
      } catch (zipError) {
         console.error('Failed to generate ZIP file:', zipError);
        setStatusMessage({ type: 'error', message: 'Failed to create the ZIP file after attempting downloads.' });
      }
    } else {
       setStatusMessage({
        type: 'error',
        message: `Could not download any PDFs (${failedDownloads} failed). This is often due to browser security restrictions (CORS), paywalls, or invalid links. Check the browser console (F12) for specific errors. Try opening links individually or using the 'Copy Links' button with a download manager.`
      });
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
            disabled={isZipping}
          />
          <Button onClick={handleGenerateLinks} className="w-full" disabled={isZipping}>
            Generate Download Links (Trial)
          </Button>

          {statusMessage && (
             <Alert variant={statusMessage.type === 'error' ? 'destructive' : statusMessage.type === 'info' ? 'default': 'default'} className={`${statusMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300' : ''} ${statusMessage.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300' : ''}`}>
              {statusMessage.type === 'error' ? <AlertCircle className="h-4 w-4" /> : statusMessage.type === 'info' ? <AlertCircle className="h-4 w-4"/> : <CheckCircle className="h-4 w-4" />}
              <AlertTitle>{statusMessage.type === 'error' ? 'Error' : statusMessage.type === 'info' ? 'Info' : 'Status'}</AlertTitle>
              <AlertDescription>
                {statusMessage.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        {results.length > 0 && (
          <CardFooter className="flex flex-col items-start space-y-4">
             <div className="w-full flex flex-wrap justify-between items-center gap-2">
                <h3 className="text-lg font-semibold">Generated Links:</h3>
                <div className="flex gap-2 flex-wrap">
                 {validResults.length > 0 && (
                     <>
                        <Button onClick={handleCopyLinks} variant="outline" size="sm" disabled={copied || isZipping}>
                            {copied ? <ClipboardCheck className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            {copied ? 'Copied!' : 'Copy Valid Links'}
                        </Button>
                        <Button onClick={handleDownloadZip} variant="outline" size="sm" disabled={isZipping}>
                            {isZipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            {isZipping ? 'Downloading...' : 'Download ZIP'}
                        </Button>
                    </>
                 )}
                </div>
             </div>
             {copied && <p className="text-sm text-muted-foreground w-full">Links copied. Paste into a download manager.</p>}
             {isZipping && <p className="text-sm text-muted-foreground w-full">Attempting to fetch and zip PDFs. This might take a moment...</p>}
             <ul className="list-none p-0 w-full space-y-3">
                {results.map((result) => (
                  <li key={result.doi} className="border p-3 rounded-md bg-secondary/50 dark:bg-secondary/30">
                    <p className="font-medium break-all text-sm text-muted-foreground">DOI: {result.doi}</p>
                    {result.url ? (
                      <div className="flex justify-between items-center">
                         <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer" // Added rel for security
                          className="inline-flex items-center text-primary hover:underline break-all text-sm"
                          // Added title for clarity, especially for long URLs
                          title={`Attempt download for ${result.doi} from ${result.publisher || 'Publisher'}`}
                        >
                          Attempt Direct PDF Link ({result.publisher || 'Known Pattern'})
                          <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                        </a>
                        {/* Optional: Add individual download button if needed later */}
                       {/* <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Download this PDF (experimental)"
                            onClick={() => handleDownloadSingle(result.url!, result.doi)}
                            disabled={isZipping}
                         >
                            <Download className="h-4 w-4" />
                         </Button> */}
                      </div>
                    ) : (
                      <p className="text-sm text-destructive">No direct PDF link pattern found.</p>
                    )}
                  </li>
                ))}
              </ul>
          </CardFooter>
        )}
      </Card>
      <footer className="text-center mt-8 text-muted-foreground text-xs">
          Disclaimer: This tool attempts to find direct PDF links based on common publisher URL patterns.
          Access to articles depends on publisher policies, institutional subscriptions, or open access status.
          Downloads may fail due to paywalls, login requirements, or browser security restrictions (CORS).
          Use responsibly and respect copyright.
       </footer>
    </main>
  );
}

