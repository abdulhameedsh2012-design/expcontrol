import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BarChart3, ClipboardList, FileSpreadsheet, LayoutDashboard, LogOut, PanelLeft, ReceiptText } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "لوحة المتابعة", path: "/?tab=dashboard" },
  { icon: FileSpreadsheet, label: "الموازنة والتقديرات", path: "/?tab=budgets" },
  { icon: ReceiptText, label: "المصروفات الفعلية", path: "/?tab=expenses" },
  { icon: ClipboardList, label: "سجل المتابعة", path: "/?tab=followups" },
];
const SIDEBAR_WIDTH_KEY = "sidebar-width";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => { const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY); return saved ? parseInt(saved, 10) : 280; });
  const { loading, user } = useAuth();
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()); }, [sidebarWidth]);
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="flex min-h-screen items-center justify-center"><div className="flex max-w-md flex-col items-center gap-8 p-8 text-center"><h1 className="text-2xl font-semibold">سجّل الدخول إلى مساحة الشركة</h1><p className="text-sm text-muted-foreground">يلزم تسجيل الدخول لحفظ الموازنات والمصروفات في قاعدة البيانات.</p><Button onClick={() => startLogin()} size="lg" className="w-full">تسجيل الدخول</Button></div></div>;
  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const active = menuItems.find(item => item.path === location) ?? menuItems[0];
  const isMobile = useIsMobile();
  useEffect(() => { if (isCollapsed) setIsResizing(false); }, [isCollapsed]);
  useEffect(() => { const move=(e:MouseEvent)=>{ if(!isResizing)return; const left=sidebarRef.current?.getBoundingClientRect().left??0; const width=e.clientX-left; if(width>=200&&width<=480)setSidebarWidth(width); }; const up=()=>setIsResizing(false); if(isResizing){document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);document.body.style.cursor='col-resize';document.body.style.userSelect='none';} return()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);document.body.style.cursor='';document.body.style.userSelect='';}; }, [isResizing,setSidebarWidth]);
  return <><div className="relative" ref={sidebarRef}><Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}><SidebarHeader className="h-16 justify-center"><div className="flex w-full items-center gap-3 px-2"><button onClick={toggleSidebar} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent" aria-label="Toggle navigation"><PanelLeft className="h-4 w-4 text-muted-foreground" /></button>{!isCollapsed&&<div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary"/><span className="font-semibold">Expense Control</span></div>}</div></SidebarHeader><SidebarContent className="gap-0"><SidebarMenu className="px-2 py-1">{menuItems.map(item=><SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location===item.path} onClick={()=>setLocation(item.path)} tooltip={item.label} className="h-11 font-normal"><item.icon className="h-4 w-4"/><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="p-3"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-accent/50"><Avatar className="h-9 w-9 border"><AvatarFallback className="text-xs font-medium">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium">{user?.name||"-"}</p><p className="mt-1.5 truncate text-xs text-muted-foreground">{user?.email||"-"}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive"><LogOut className="mr-2 h-4 w-4"/>تسجيل الخروج</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter></Sidebar><div className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 ${isCollapsed?'hidden':''}`} onMouseDown={()=>setIsResizing(true)} /></div><SidebarInset>{isMobile&&<div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur"><SidebarTrigger className="h-9 w-9"/><span>{active.label}</span></div>}<main className="flex-1 p-4 md:p-7">{children}</main></SidebarInset></>;
}
