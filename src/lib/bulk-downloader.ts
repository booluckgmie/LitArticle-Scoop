/**
 * Initiates downloads for multiple URLs with a delay between each.
 * @param files An array of objects, each containing a `url` and a `filename`.
 * @param delayMs The delay in milliseconds between initiating each download. Defaults to 500ms.
 */
export function downloadAllPdfs(files: { url: string; filename: string }[], delayMs = 500): void {
  files.forEach((file, index) => {
    setTimeout(() => {
      try {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log(`Initiated download for: ${file.filename}`);
      } catch (error) {
        console.error(`Failed to initiate download for ${file.filename}:`, error);
        // Optionally, notify the user about the specific failure
      }
    }, index * delayMs); // Apply delay based on index
  });
}
