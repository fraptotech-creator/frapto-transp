import { useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import { modoInicialAuth } from "@/lib/modoInicialAuth";
import {
  Destaques,
  Dores,
  FaixaFatos,
  Hero,
  Topo,
} from "@/components/landing/SecoesTopo";
import {
  ChamadaFinal,
  ComoFunciona,
  Duvidas,
  ParaQuem,
  Preco,
  Rodape,
  TodosRecursos,
} from "@/components/landing/SecoesFim";

type AuthMode = "login" | "signup";

// Página de vendas (visitante deslogado). Ordem baseada nas referências do
// setor (24/11/2026): resultado no topo → fatos verificáveis → dores em forma
// de pergunta → solução com tela → para quem → recursos → como começar →
// preço aberto → dúvidas/objeções → chamada final. Texto em landing/conteudo.ts.
export default function Landing() {
  const [auth, setAuth] = useState<AuthMode | null>(() =>
    modoInicialAuth(window.location.pathname, window.location.search)
  );

  if (auth) {
    return <AuthScreen initialMode={auth} onBack={() => setAuth(null)} />;
  }

  const acoes = {
    assinar: () => setAuth("signup"),
    entrar: () => setAuth("login"),
  };

  return (
    // overflow-x-CLIP (não hidden): hidden vira contêiner de rolagem e o topo
    // "sticky" rolava junto com a página em vez de ficar preso no alto.
    <div className="relative min-h-screen overflow-x-clip bg-slate-950 text-slate-100 [scroll-behavior:smooth]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-purple-600/20 blur-3xl" />
      </div>
      <div className="relative">
        <Topo {...acoes} />
        <Hero {...acoes} />
        <FaixaFatos />
        <Dores />
        <Destaques />
        <ParaQuem />
        <TodosRecursos />
        <ComoFunciona />
        <Preco {...acoes} />
        <Duvidas />
        <ChamadaFinal {...acoes} />
        <Rodape />
      </div>
    </div>
  );
}
