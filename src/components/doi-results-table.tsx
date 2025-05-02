'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, XCircle, AlertTriangle, Clock } from 'lucide-react';
import type { DoiResult } from '@/lib/doi-processor';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DoiResultsTableProps {
  results: DoiResult[];
}

export function DoiResultsTable({ results }: DoiResultsTableProps) {

  const getStatusBadge = (status: DoiResult['status'], message?: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Success</Badge>;
      case 'not_found':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                 <Badge variant="secondary">Not Found</Badge>
              </TooltipTrigger>
              {message && <TooltipContent><p>{message}</p></TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        );
      case 'error':
         return (
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <Badge variant="destructive">Error</Badge>
               </TooltipTrigger>
               {message && <TooltipContent><p>{message}</p></TooltipContent>}
             </Tooltip>
           </TooltipProvider>
         );
      case 'pending':
         return <Badge variant="outline">Pending</Badge>;
      default:
        return null;
    }
  };

   const getStatusIcon = (status: DoiResult['status']) => {
    switch (status) {
      case 'success':
        return <Download className="h-4 w-4 text-green-600" />;
      case 'not_found':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'pending':
         return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  // Function to handle direct download
  const handleDownload = (url: string, doi: string) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      // Suggest a filename based on the DOI
      link.download = `${doi}.pdf`;
      // Add rel attribute for security best practice
      link.rel = 'noopener noreferrer';
      // Append to body to ensure click works in all browsers
      document.body.appendChild(link);
      link.click();
      // Clean up by removing the link
      document.body.removeChild(link);
    } catch (error) {
        console.error(`Failed to initiate download for ${doi}:`, error);
        // Optionally notify user about the failure (e.g., using a toast)
        // e.g., toast({ title: "Download Error", description: `Could not start download for ${doi}.` variant: "destructive" });
    }
  };


  return (
    <div className="rounded-md border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px] hidden sm:table-cell">Status</TableHead>
            <TableHead>DOI</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result) => (
            <TableRow key={result.doi}>
               <TableCell className="hidden sm:table-cell">
                 {getStatusBadge(result.status, result.message)}
              </TableCell>
              <TableCell className="font-medium break-all">{result.doi}</TableCell>
              <TableCell className="text-right">
                {result.status === 'success' && result.url ? (
                   <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                           <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(result.url!, result.doi)}
                              aria-label={`Download PDF for DOI ${result.doi}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                      </TooltipTrigger>
                       <TooltipContent>
                           <p>Download PDF</p>
                       </TooltipContent>
                     </Tooltip>
                   </TooltipProvider>

                ) : (
                   <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" disabled className="cursor-not-allowed">
                             {getStatusIcon(result.status)}
                           </Button>
                      </TooltipTrigger>
                       <TooltipContent>
                           <p>{result.message || result.status.charAt(0).toUpperCase() + result.status.slice(1)}</p>
                       </TooltipContent>
                     </Tooltip>
                   </TooltipProvider>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
