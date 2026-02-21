// Track Your Shit - Project Wizard Entry Dialog
// Thin wrapper — immediately opens the import dialog
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { ImportProjectDialog } from "./import-project-dialog";
import { useNavigate } from "react-router-dom";

interface ProjectWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectWizardDialog({ open, onOpenChange }: ProjectWizardDialogProps) {
  const navigate = useNavigate();

  return (
    <ImportProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={(projectId) => {
        onOpenChange(false);
        navigate(`/projects/${projectId}`);
      }}
    />
  );
}
