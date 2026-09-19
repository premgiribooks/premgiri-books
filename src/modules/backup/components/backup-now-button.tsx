"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DatabaseBackup } from "lucide-react";

import { Button } from "@/components/ui/button";
import { runBackupNowAction } from "@/modules/backup/actions/backup-actions";

interface BackupNowButtonProps {
  disabled?: boolean;
}

export function BackupNowButton({ disabled = false }: BackupNowButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  async function handleClick() {
    setIsPending(true);
    const result = await runBackupNowAction();
    setIsPending(false);

    if (!result.success || !result.data) {
      toast.error(result.error ?? "Failed to start backup.");
      return;
    }

    if (result.data.status === "SUCCEEDED") {
      toast.success("Backup completed successfully.");
    } else {
      toast.error(result.data.errorMessage ?? "Backup failed.");
    }
    router.refresh();
  }

  return (
    <Button onClick={handleClick} disabled={disabled || isPending}>
      <DatabaseBackup size={16} data-icon="inline-start" />
      {isPending ? "Backing up…" : "Backup Now"}
    </Button>
  );
}
