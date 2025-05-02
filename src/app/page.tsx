'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';

type LinkResult = {
  doi: string;
  url: string | null;
  publisher: string | null;
};

const maxDois = 10;

// Mapping from publisher prefix to URL pattern function and name
const publisherPatterns: { [key: string]: { generator: (doi: string) => string; name: string } } = {
    // Wiley/BPS specific patterns first
    '10.1111': { generator: (doi) => `https://bpspsychub.onlinelibrary.wiley.com/doi/pdfdirect/${doi}`, name: 'Wiley/BPS' },
    // General Wiley
    '10.1002': { generator: (doi) => `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`, name: 'Wiley' },
    // Springer
    '10.1007': { generator: (doi) => `https://link.springer.com/content/pdf/${doi}.pdf`, name: 'Springer' },
    // Emerald
    '10.1108': { generator: (doi) => `https://www.emerald.com/insight/content/doi/${doi}/full/pdf?download=true`, name: 'Emerald' },
    // Taylor & Francis
    '10.1080': { generator: (doi) => `https://www.tandfonline.com/doi/epdf/${doi}?needAccess=true`, name: 'Taylor & Francis' },
    // Sage
    '10.1177': { generator: (doi) => `https://journals.sagepub.com/doi/pdf/${doi}`, name: 'Sage' }
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

export default function HomePage() {
  const [doiInput, setDoiInput] = useState('');
  const [results, setResults] = useState<LinkResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleGenerateLinks = () => {
    // 1. Clean and filter DOIs
    const dois = doiInput
      .split(/[,;\n]/) // Split by comma, semicolon, or newline
      .map(doi => doi.trim().replace(/^https?:\/\/doi.org\//, '')) // Trim and remove prefix if present
      .filter(doi => doi.startsWith('10.') && doi.includes('/')); // Keep only valid-looking DOIs (start with 10. and contain /)

    // 2. Get unique DOIs
    const uniqueDois = [...new Set(dois)];

    // 3. Clear previous results and status
    setResults([]);
    setStatusMessage(null);

    // 4. Check DOI count
     if (uniqueDois.length === 0) {
        setStatusMessage({ type: 'error', message: "Please enter at least one valid DOI (starting with '10.')." });
        return;
    }

    if (uniqueDois.length > maxDois) {
        setStatusMessage({ type: 'error', message: `You entered ${uniqueDois.length} unique DOIs. The trial version allows a maximum of ${maxDois}. Please reduce the list.` });
        return;
    }

    // 5. Process DOIs and generate results
    const generatedResults = uniqueDois.map(doi => {
        const { url, publisher } = getDirectPdfInfo(doi);
        return { doi, url, publisher };
    });

    setResults(generatedResults);

    // 6. Set status message based on results
    const successfulLinks = generatedResults.filter(r => r.url).length;
    if (successfulLinks > 0) {
        setStatusMessage({ type: 'success', message: `Generated direct link patterns for ${successfulLinks} out of ${uniqueDois.length} DOIs. Links open in a new tab. Some links might require institutional access or be blocked by paywalls.` });
    } else if (uniqueDois.length > 0) {
        setStatusMessage({ type: 'error', message: `Could not find direct download patterns for any of the ${uniqueDois.length} provided DOIs based on known publisher formats.` });
    }
  };

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">LitArticle Scoop</CardTitle>
          <CardDescription className="text-center">
            Paste DOIs below to attempt generating direct PDF download links (Trial - Max {maxDois} DOIs).
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
            Generate Download Links
          </Button>

          {statusMessage && (
            <Alert variant={statusMessage.type === 'error' ? 'destructive' : 'default'} className={statusMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}>
              {statusMessage.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <AlertTitle>{statusMessage.type === 'error' ? 'Error' : 'Status'}</AlertTitle>
              <AlertDescription>
                {statusMessage.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        {results.length > 0 && (
          <CardFooter className="flex flex-col items-start space-y-4">
             <h3 className="text-lg font-semibold">Generated Links:</h3>
             <ul className="list-none p-0 w-full space-y-3">
                {results.map((result) => (
                  <li key={result.doi} className="border p-3 rounded-md bg-muted/50">
                    <p className="font-medium break-all">DOI: {result.doi}</p>
                    {result.url ? (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer" // Added rel for security
                        className="inline-flex items-center text-primary hover:underline break-all"
                      >
                        Attempt Direct PDF Download ({result.publisher || 'Known Publisher'})
                        <ExternalLink className="ml-1 h-4 w-4" />
                      </a>
                    ) : (
                      <p className="text-sm text-destructive">No direct download pattern found for this DOI.</p>
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
