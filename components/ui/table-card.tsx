"use client";

import type { ReactNode } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";

export interface TableCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function TableCard({
  title,
  subtitle,
  action,
  footer,
  children,
  className,
}: TableCardProps) {
  return (
    <DashboardCard
      title={title}
      subtitle={subtitle}
      action={action}
      footer={footer}
      className={className}
      headerClassName="px-5 py-4"
    >
      {children}
    </DashboardCard>
  );
}

