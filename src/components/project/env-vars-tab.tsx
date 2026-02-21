// Track Your Shit - Environment Variables Tab Component
// Manage and view environment variables for a project
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Key,
  Copy,
  Check,
  AlertTriangle,
  FileJson,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
  source: 'project' | 'system' | 'user';
}

interface EnvVarsTabProps {
  projectId: string;
  projectPath: string;
}

export function EnvVarsTab({ projectId, projectPath }: EnvVarsTabProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadEnvVars();
  }, [projectId]);

  const loadEnvVars = async () => {
    setIsLoading(true);
    try {
      const envFilePath = `${projectPath}/.env`;
      const vars: EnvVar[] = [];
      
      try {
        const response = await fetch(`file://${envFilePath}`);
        if (response.ok) {
          const content = await response.text();
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const match = trimmed.match(/^([^=]+)=(.*)$/);
              if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                  value = value.slice(1, -1);
                }
                vars.push({
                  key,
                  value,
                  isSecret: isLikelySecret(key),
                  source: 'project'
                });
              }
            }
          }
        }
      } catch {
        // .env file doesn't exist
      }
      
      setEnvVars(vars);
    } catch (error) {
      console.error('Failed to load env vars:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isLikelySecret = (key: string): boolean => {
    const secretPatterns = [
      'password', 'secret', 'token', 'api_key', 'apikey', 'private',
      'credential', 'auth', 'access_key', 'secret_key', 'session',
      'bearer', 'jwt', 'oauth', 'client_secret', 'encryption_key'
    ];
    const lower = key.toLowerCase();
    return secretPatterns.some(p => lower.includes(p));
  };

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const copyToClipboard = async (_key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(_key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('Copied to clipboard');
  };

  const handleAddEnvVar = async () => {
    if (!newKey.trim()) {
      toast.error('Key is required');
      return;
    }
    
    setEnvVars(prev => [...prev, {
      key: newKey,
      value: newValue,
      isSecret: newIsSecret || isLikelySecret(newKey),
      source: 'project'
    }]);
    
    setShowAddDialog(false);
    setNewKey('');
    setNewValue('');
    setNewIsSecret(false);
    toast.success(`Added ${newKey}`);
  };

  const handleDeleteEnvVar = (key: string) => {
    setEnvVars(prev => prev.filter(v => v.key !== key));
    toast.success(`Deleted ${key}`);
  };

  const projectVars = envVars.filter(v => v.source === 'project');
  const secretVars = projectVars.filter(v => v.isSecret);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Environment Variables</h2>
          <Badge variant="outline">{projectVars.length}</Badge>
          {secretVars.length > 0 && (
            <Badge variant="secondary">{secretVars.length} secrets</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSecrets(prev => {
              const next = new Set(prev);
              if (secretVars.length === next.size) {
                next.clear();
              } else {
                secretVars.forEach(v => next.add(v.key));
              }
              return next;
            })}
          >
            {secretVars.length > 0 && (showSecrets.size === secretVars.length ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />)}
            {showSecrets.size === secretVars.length ? 'Hide' : 'Show'} Secrets
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Variable
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      ) : projectVars.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 gap-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No environment variables found</p>
            <Button variant="outline" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first variable
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {projectVars.map((envVar) => (
              <div
                key={envVar.key}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-[200px]">
                    {envVar.isSecret && <Key className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    <span className="font-mono text-sm font-medium truncate">{envVar.key}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-mono text-sm text-muted-foreground truncate">
                      {envVar.isSecret && !showSecrets.has(envVar.key)
                        ? '••••••••••••'
                        : envVar.value}
                    </span>
                    {envVar.isSecret && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => toggleSecret(envVar.key)}
                      >
                        {showSecrets.has(envVar.key) ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge variant={envVar.isSecret ? "destructive" : "secondary"} className="mr-2">
                    {envVar.isSecret ? "Secret" : "Public"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(envVar.key, envVar.value)}
                  >
                    {copiedKey === envVar.key ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteEnvVar(envVar.key)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Environment Variable</DialogTitle>
            <DialogDescription>
              Add a new environment variable to your project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                placeholder="e.g., API_KEY"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                type={newIsSecret ? "password" : "text"}
                placeholder="Enter value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="secret"
                type="checkbox"
                checked={newIsSecret}
                onChange={(e) => setNewIsSecret(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="secret" className="text-sm font-normal">
                This is a secret value (will be masked by default)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEnvVar}>
              Add Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
