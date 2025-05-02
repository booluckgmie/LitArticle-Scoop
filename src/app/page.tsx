import { DoiForm } from '@/components/doi-form';
import { Header } from '@/components/header';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <DoiForm />
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} LitArticle Scoop. All rights reserved.
      </footer>
    </div>
  );
}
