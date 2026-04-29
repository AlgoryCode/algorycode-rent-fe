"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import type { ComponentProps, MouseEventHandler, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const addEntityClassName =
  "h-10 shrink-0 gap-1.5 rounded-md border-0 bg-foreground px-4 text-xs font-medium text-background shadow-none hover:bg-foreground/90";

export type AddEntityLinkProps = {
  href: string;
  label: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  icon?: LucideIcon | null;
  className?: string;
};

export function AddEntityLink({ href, label, onClick, icon: Icon = Plus, className }: AddEntityLinkProps) {
  return (
    <Button size="sm" className={cn(addEntityClassName, className)} asChild>
      <Link href={href} onClick={onClick}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {label}
      </Link>
    </Button>
  );
}

export type AddEntityButtonProps = Omit<ComponentProps<typeof Button>, "size" | "variant"> & {
  icon?: LucideIcon | null;
};

export function AddEntityButton({ children, icon: Icon = Plus, className, ...rest }: AddEntityButtonProps) {
  return (
    <Button type="button" size="sm" className={cn(addEntityClassName, className)} {...rest}>
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </Button>
  );
}
