// Track Your Shit - Clear Data Dialog
// Supports full clear and selective category-based clearing
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useClearAllData, useClearSelectedData } from '@/lib/queries';
import { AlertTriangle, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface ClearDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ClearState = 'confirm' | 'clearing' | 'success' | 'error';

const DATA_CATEGORIES = [
  { id: 'projects', label: 'Projects', description: 'All projects and their settings' },
  { id: 'activity', label: 'Activity', description: 'Activity logs' },
  { id: 'gsd', label: 'GSD Data', description: 'Todos, debug sessions, milestones' },
  { id: 'knowledge', label: 'Knowledge', description: 'Knowledge entries and bookmarks' },
];

export function ClearDataDialog({ open, onOpenChange }: ClearDataDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<ClearState>('confirm');
  const [error, setError] = useState<string>('');
  const [selectiveMode, setSelectiveMode] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const clearAllData = useClearAllData();
  const clearSelectedData = useClearSelectedData();

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleClear = async () => {
    setState('clearing');
    try {
      if (selectiveMode && selectedCategories.length > 0) {
        await clearSelectedData.mutateAsync(selectedCategories);
      } else {
        await clearAllData.mutateAsync();
      }
      setState('success');
    } catch (err) {
      setState('error');
      setError(String(err));
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setState('confirm');
      setConfirmed(false);
      setError('');
      setSelectiveMode(false);
      setSelectedCategories([]);
    }, 200);
  };

  const canClear = selectiveMode
    ? selectedCategories.length > 0 && confirmed
    : confirmed;

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Clear Data
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. Selected data will be permanently
            deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state === 'confirm' ? (
          <>
            <div className="py-4">
              {/* Mode toggle */}
              <div className="flex items-center gap-3 mb-4">
                <Button
                  variant={selectiveMode ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => setSelectiveMode(false)}
                >
                  Clear All
                </Button>
                <Button
                  variant={selectiveMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectiveMode(true)}
                >
                  Select Specific
                </Button>
              </div>

              {selectiveMode ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {DATA_CATEGORIES.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/30 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <div>
                        <span className="text-sm font-medium">{cat.label}</span>
                        <p className="text-xs text-muted-foreground">
                          {cat.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                  <p className="text-sm text-destructive font-medium mb-2">
                    The following data will be deleted:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>All projects and their settings</li>
                    <li>All activity logs</li>
                    <li>All GSD data</li>
                    <li>All knowledge entries</li>
                  </ul>
                </div>
              )}

              <div className="flex items-start gap-3 mt-4">
                <input
                  type="checkbox"
                  id="confirm-clear"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <Label
                  htmlFor="confirm-clear"
                  className="text-sm cursor-pointer"
                >
                  I understand that this action is irreversible and I want to
                  permanently delete{' '}
                  {selectiveMode ? 'the selected data' : 'all my data'}.
                </Label>
              </div>
            </div>

            <AlertDialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleClear()}
                disabled={!canClear}
              >
                {selectiveMode
                  ? `Delete ${selectedCategories.length} Categories`
                  : 'Delete All Data'}
              </Button>
            </AlertDialogFooter>
          </>
        ) : state === 'clearing' ? (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Clearing data...</p>
          </div>
        ) : state === 'success' ? (
          <>
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-status-success mb-4" />
              <h3 className="font-medium text-lg mb-2">Data Cleared</h3>
              <p className="text-sm text-muted-foreground">
                {selectiveMode
                  ? 'Selected data has been permanently deleted.'
                  : 'All data has been permanently deleted.'}
              </p>
            </div>
            <AlertDialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center py-8 text-center">
              <XCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-medium text-lg mb-2">Clear Failed</h3>
              <p className="text-sm text-muted-foreground">
                {error || 'An error occurred while clearing data'}
              </p>
            </div>
            <AlertDialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={() => setState('confirm')}>Try Again</Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
