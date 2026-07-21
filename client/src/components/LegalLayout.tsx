import { Truck } from "lucide-react";
import { Link } from "wouter";

// Casca das páginas legais (/termos e /privacidade). São PÚBLICAS: ficam fora
// do DashboardLayout, sem exigir login — a Stripe e os visitantes precisam
// alcançá-las direto.
export default function LegalLayout({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-primary to-purple-600 p-2 shadow-lg">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-xl font-bold tracking-tight text-transparent">
              Frapto Transp
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {atualizadoEm}
        </p>

        <div
          className="mt-8 space-y-4 leading-relaxed
            [&_a]:text-primary [&_a]:underline
            [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight
            [&_h3]:mt-6 [&_h3]:font-semibold
            [&_li]:leading-relaxed
            [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6"
        >
          {children}
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-6 py-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Início
          </Link>
          <Link href="/termos" className="hover:text-foreground">
            Termos de Serviço
          </Link>
          <Link href="/privacidade" className="hover:text-foreground">
            Política de Privacidade
          </Link>
          <span className="ml-auto">Frapto Tech</span>
        </div>
      </footer>
    </div>
  );
}
