import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import Landing from "@/components/Landing";
import Paywall from "@/components/Paywall";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
import { podeVerItem } from "@/lib/menuAccess";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Truck,
  MapPin,
  Bell,
  Users,
  Wrench,
  FileText,
  BarChart3,
  DollarSign,
  Sparkles,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  adminOnly?: boolean;
  // Só o DONO da plataforma (super-admin) vê. Gate real é no servidor.
  superAdminOnly?: boolean;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Painel", path: "/" },
  { icon: Truck, label: "Veículos", path: "/vehicles" },
  { icon: Users, label: "Motoristas", path: "/drivers" },
  { icon: MapPin, label: "Viagens", path: "/trips" },
  { icon: Wrench, label: "Manutenção", path: "/maintenance" },
  { icon: DollarSign, label: "Financeiro", path: "/financial" },
  { icon: BarChart3, label: "Relatórios", path: "/reports" },
  { icon: FileText, label: "Documentos", path: "/documents" },
  { icon: Bell, label: "Notificações", path: "/notifications" },
  { icon: Sparkles, label: "Assistente IA", path: "/assistant" },
  {
    icon: Settings,
    label: "Configurações",
    path: "/settings",
    adminOnly: true,
  },
  {
    icon: ShieldCheck,
    label: "Plataforma",
    path: "/plataforma",
    superAdminOnly: true,
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  // Deslogado: landing page (marketing + cadastro/login).
  if (!user) {
    return <Landing />;
  }

  // Motorista não usa o painel de gestão — vai para a área própria.
  if (user.orgRole === "driver") {
    if (typeof window !== "undefined") window.location.href = "/motorista";
    return <DashboardLayoutSkeleton />;
  }

  // Logado: verifica a assinatura antes de liberar o sistema.
  return <GatedApp>{children}</GatedApp>;
}

// Gate de PAGAMENTO no cliente: sem assinatura ativa, mostra o paywall.
function GatedApp({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  const { data: billing, isLoading } = trpc.billing.getStatus.useQuery();
  const { user } = useAuth();

  if (isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  // O DONO DA PLATAFORMA não é cliente: passa pelo paywall, mas só enxerga a
  // área da plataforma (o resto do sistema exige assinatura no servidor).
  const somentePlataforma = !billing?.active && user?.isSuperAdmin === true;

  if (!billing?.active && !somentePlataforma) {
    return <Paywall />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent
        setSidebarWidth={setSidebarWidth}
        somentePlataforma={somentePlataforma}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  somentePlataforma?: boolean;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  somentePlataforma,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  // Regra pura e testada em menuAccess.ts — espelha o gate do backend.
  const visibleMenuItems = menuItems.filter(item =>
    podeVerItem(item, {
      isSuperAdmin: user?.isSuperAdmin,
      orgRole: user?.orgRole,
      role: user?.role,
      somentePlataforma,
    })
  );
  const activeMenuItem = visibleMenuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  // Dono da plataforma sem assinatura: qualquer outra rota exigiria assinatura
  // no servidor, então manda direto pro painel da plataforma.
  useEffect(() => {
    if (somentePlataforma && location !== "/plataforma") {
      setLocation("/plataforma");
    }
  }, [somentePlataforma, location, setLocation]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b bg-gradient-to-r from-background to-background/80">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-lg">
                    <Truck className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-bold tracking-tight truncate text-xl bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    Frapto Transp
                  </span>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-lg mx-auto">
                  <Truck className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 transition-all font-medium rounded-xl ${isActive ? "shadow-lg" : ""}`}
                    >
                      <item.icon
                        className={`h-5 w-5 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 md:p-8 bg-background/30 backdrop-blur-sm overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
