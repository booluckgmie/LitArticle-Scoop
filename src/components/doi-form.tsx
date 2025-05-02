'use client';

import * as React from 'react';
import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Download, AlertCircle } from 'lucide-react';
import { DoiResult, processDois } from '@/lib/doi-processor';
import { DoiResultsTable } from './doi-results-table';
import { downloadAllPdfs } from '@/lib/bulk-downloader';

const MAX_DOIS = 10;

const FormSchema = z.object({
  dois: z.string().min(1, 'Please enter at least one DOI.').refine(
    (value) => {
        const dois = value
            .split(/[\n,;]+/)
            .map((doi) => doi.trim().replace(/^https?:\/\/doi.org\//, ''))
            .filter(Boolean);
        const uniqueDois = [...new Set(dois)];
        return uniqueDois.length <= MAX_DOIS;
    },
    {
        message: `You can process a maximum of ${MAX_DOIS} unique DOIs in the trial version.`,
    }
  ),
});

type FormData = z.infer<typeof FormSchema>;

export function DoiForm() {
  const [results, setResults] = useState<DoiResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      dois: '',
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    setResults([]); // Clear previous results

    const rawDois = data.dois
      .split(/[\n,;]+/)
      .map((doi) => doi.trim().replace(/^https?:\/\/doi.org\//, ''))
      .filter(Boolean);
    const uniqueDois = [...new Set(rawDois)];

    if (uniqueDois.length > MAX_DOIS) {
        setError(`You can process a maximum of ${MAX_DOIS} unique DOIs in the trial version.`);
        setIsLoading(false);
        return; // Stop processing if limit exceeded
    }


    try {
      const processedResults = await processDois(uniqueDois);
      setResults(processedResults);
    } catch (err) {
      console.error("Error processing DOIs:", err);
      setError('An unexpected error occurred while processing the DOIs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDownload = () => {
    const successfulLinks = results
      .filter(result => result.status === 'success' && result.url)
      .map(result => ({ url: result.url!, filename: `${result.doi}.pdf` }));

    if (successfulLinks.length > 0) {
      downloadAllPdfs(successfulLinks);
    }
  };

  const successfulDownloads = results.filter(result => result.status === 'success').length;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Paste your list of DOIs here. Separate them using commas, semicolons, or new lines.
        Prefixes like 'https://doi.org/' will be removed automatically. PDFs download directly to your browser.
      </p>
      <Alert variant="default" className="bg-secondary">
         <AlertCircle className="h-4 w-4" />
         <AlertTitle>Trial Version</AlertTitle>
         <AlertDescription>
           You can process a maximum of {MAX_DOIS} unique DOIs.
         </AlertDescription>
       </Alert>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="dois"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="dois-textarea">DOI List</FormLabel>
                <FormControl>
                  <Textarea
                    id="dois-textarea"
                    placeholder="e.g., 10.1111/joop.12403&#10;10.1007/s10551-024-05919-1, 10.1108/ijm-08-2021-0480"
                    rows={6}
                    {...field}
                    className="resize-y"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Download Links'
            )}
          </Button>
        </form>
      </Form>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
            <DoiResultsTable results={results} />
            {successfulDownloads > 0 && (
                 <Button onClick={handleBulkDownload} variant="outline">
                   <Download className="mr-2 h-4 w-4" />
                   Download All ({successfulDownloads})
                 </Button>
            )}
        </div>
      )}
    </div>
  );
}
