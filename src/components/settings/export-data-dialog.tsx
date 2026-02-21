// Track Your Shit - Export Data Dialog
// Supports selective data category export
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useExportData } from '@/lib/queries';
import {
  FileJson,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'json' | 'csv';
type ExportState = 'idle' | 'exporting' | 'success' | 'error';

const EXPORT_CATEGORIES = [
  { id: 'include_projects', label: 'Projects' },
  { id: 'include_activity', label: 'Activity' },
];

export function ExportDataDialog({ open, onOpenChange }: ExportDataDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [state, setState] = useState<ExportState>('idle');
  const [result, setResult] = useState<string>('');
  const [categories, setCategories] = useState<Record<string, boolean>>({
    include_projects: true,
    include_activity: true,
  });
  const exportData = useExportData();

  const toggleCategory = (id: string) => {
    setCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExport = async () => {
    setState('exporting');
    try {
      const filePath = await exportData.mutateAsync({
        format,
        ...categories,
      });
      setState('success');
      setResult(filePath);
    } catch (error) {
      setState('error');
      setResult(String(error));
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setState('idle');
      setResult('');
    }, 200);
  };

  const anySelected = Object.values(categories).some(Boolean);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Export Track Your Shit data to a file for backup or migration.
          </DialogDescription>
        </DialogHeader>

        {state === 'idle' || state === 'exporting' ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Export Format</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setFormat('json')}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
                      format === 'json'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50',
                    )}
                  >
                    <FileJson className="h-8 w-8" />
                    <span className="font-medium">JSON</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Full data export with all details
                    </span>
                  </button>
                  <button
                    onClick={() => setFormat('csv')}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
                      format === 'csv'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50',
                    )}
                  >
                    <FileSpreadsheet className="h-8 w-8" />
                    <span className="font-medium">CSV</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Projects summary for spreadsheets
                    </span>
                  </button>
                </div>
              </div>

              {/* Data category selection */}
              <div className="space-y-2">
                <Label>Data to Export</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPORT_CATEGORIES.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/30 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={categories[cat.id]}
                        onChange={() => toggleCategory(cat.id)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleExport()}
                disabled={state === 'exporting' || !anySelected}
              >
                {state === 'exporting' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  'Export'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : state === 'success' ? (
          <>
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-status-success mb-4" />
              <h3 className="font-medium text-lg mb-2">Export Complete!</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Data exported successfully to:
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                {result}
              </code>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center py-8 text-center">
              <XCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-medium text-lg mb-2">Export Failed</h3>
              <p className="text-sm text-muted-foreground">
                {result || 'An error occurred during export'}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={() => setState('idle')}>Try Again</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
