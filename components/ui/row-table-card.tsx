"use client";

import type { ReactNode } from "react";
import { TableCard } from "@/components/ui/table-card";

interface RowTableCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function RowTableCard({
  title,
  subtitle,
  headerRight,
  className,
  bodyClassName,
  footer,
  children,
}: RowTableCardProps) {
  return (
    <TableCard title={title} subtitle={subtitle} action={headerRight} footer={footer} className={className}>
      <div className={bodyClassName}>{children}</div>
    </TableCard>
  );
}
