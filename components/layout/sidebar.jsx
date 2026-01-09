"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Sidebar({ items, collapsed, onToggle, logo }) {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r bg-background transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              {logo || <Image src="/supercane-logo.png" alt="Supercane" width={160} height={44} className="h-11 w-auto" />}
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn(collapsed && "mx-auto")}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          {items.map((item) => (
            <SidebarItem
              key={item.href || item.title}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

function SidebarItem({ item, pathname, collapsed, depth = 0 }) {
  const [isOpen, setIsOpen] = React.useState(
    item.items?.some((sub) => pathname.startsWith(sub.href)) || false
  );
  const isActive = item.href === pathname;
  const hasChildren = item.items && item.items.length > 0;
  const Icon = item.icon;

  if (hasChildren) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-2",
              collapsed && "justify-center px-2"
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.title}</span>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </>
            )}
          </Button>
        </CollapsibleTrigger>
        {!collapsed && (
          <CollapsibleContent className="ml-4 space-y-1">
            {item.items.map((subItem) => (
              <SidebarItem
                key={subItem.href}
                item={subItem}
                pathname={pathname}
                collapsed={collapsed}
                depth={depth + 1}
              />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  }

  const linkContent = (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className={cn(
        "w-full justify-start gap-2",
        collapsed && "justify-center px-2",
        depth > 0 && "text-sm"
      )}
      asChild
    >
      <Link href={item.href}>
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        {!collapsed && <span>{item.title}</span>}
      </Link>
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

export function SidebarLayout({ children, sidebarItems, logo }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar
        items={sidebarItems}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        logo={logo}
      />
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        {children}
      </main>
    </div>
  );
}
