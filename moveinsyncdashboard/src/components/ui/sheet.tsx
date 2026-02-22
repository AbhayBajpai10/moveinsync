"use client";
import React from "react";

/**
 * Minimal Sheet mock that accepts all props
 * to satisfy existing usage without changing behavior.
 */

type SheetProps = {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  asChild?: boolean;
  [key: string]: any; // 👈 allow extra props safely
};

export const Sheet = ({ children }: SheetProps) => <>{children}</>;

export const SheetTrigger = ({ children }: SheetProps) => <>{children}</>;

export const SheetContent = ({ children }: SheetProps) => <>{children}</>;

export const SheetHeader = ({ children }: SheetProps) => <>{children}</>;

export const SheetTitle = ({ children }: SheetProps) => <>{children}</>;