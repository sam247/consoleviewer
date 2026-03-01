"use client";

import { ShareModalContent } from "./share-modal-content";

type ShareScope = "dashboard" | "project";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  scope: ShareScope;
  scopeId?: string;
  params?: { [key: string]: unknown };
}

export function ShareModal({
  open,
  onClose,
  scope,
  scopeId,
  params,
}: ShareModalProps) {
  if (!open) return null;
  return (
    <ShareModalContent
      onClose={onClose}
      scope={scope}
      scopeId={scopeId}
      params={params}
    />
  );
}
