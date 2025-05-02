import { BookOpenText } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-secondary shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center gap-2 md:px-6 lg:px-8">
        <BookOpenText className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">LitArticle Scoop</h1>
      </div>
    </header>
  );
}
