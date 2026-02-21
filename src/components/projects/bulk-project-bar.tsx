// Track Your Shit - Bulk Project Bar (BP-01)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import { Archive, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BulkProjectBarProps {
  selectedCount: number;
  onArchive: () => void;
  onDelete: () => void;
  onDeselectAll: () => void;
  isArchiving?: boolean;
  isDeleting?: boolean;
}

export function BulkProjectBar({
  selectedCount,
  onArchive,
  onDelete,
  onDeselectAll,
  isArchiving = false,
  isDeleting = false,
}: BulkProjectBarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    onDelete();
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-4 rounded-lg border bg-gradient-to-r from-brand-blue/10 to-brand-purple/10 backdrop-blur-sm p-4 shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {selectedCount} project{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onArchive}
            disabled={isArchiving || isDeleting}
          >
            <Archive className="h-4 w-4" />
            {isArchiving ? 'Archiving...' : 'Archive Selected'}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isArchiving || isDeleting}
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete Selected'}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDeselectAll}
            disabled={isArchiving || isDeleting}
            aria-label="Deselect all"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} project{selectedCount !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected
              project{selectedCount !== 1 ? 's' : ''} from the database. Project files on disk will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
