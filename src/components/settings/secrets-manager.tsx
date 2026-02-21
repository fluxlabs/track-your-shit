// Track Your Shit - Secrets Manager Settings Component
// Provides UI for managing API keys stored in the OS keychain
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Shield,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  KEYCHAIN_SERVICE,
  setSecret,
  getSecret,
  deleteSecret,
  listSecretKeys,
} from "@/lib/tauri";

/** Predefined keys shown as quick-add presets */
const WELL_KNOWN_KEYS = [
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    description: "Used for Claude Code executions",
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    description: "Used for GPT-based operations",
  },
  {
    key: "GITHUB_TOKEN",
    label: "GitHub Token",
    description: "Used for repository operations",
  },
  {
    key: "OPENROUTER_API_KEY",
    label: "OpenRouter API Key",
    description: "Used for multi-model routing",
  },
  {
    key: "AWS_ACCESS_KEY_ID",
    label: "AWS Access Key ID",
    description: "AWS authentication",
  },
  {
    key: "AWS_SECRET_ACCESS_KEY",
    label: "AWS Secret Access Key",
    description: "AWS authentication",
  },
];

interface StoredSecret {
  key: string;
  exists: boolean;
}

export function SecretsManager() {
  const [storedKeys, setStoredKeys] = useState<StoredSecret[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadSecrets = useCallback(async () => {
    setIsLoading(true);
    try {
      const keys = await listSecretKeys(KEYCHAIN_SERVICE);
      setStoredKeys(keys.map((key) => ({ key, exists: true })));
    } catch (error) {
      console.error("Failed to load secrets:", error);
      toast.error("Failed to load secrets from keychain");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSecrets();
  }, [loadSecrets]);

  const handleAddSecret = async () => {
    const keyToAdd = selectedPreset || newKey.trim().toUpperCase();
    if (!keyToAdd) {
      toast.error("Please enter a key name");
      return;
    }
    if (!newValue.trim()) {
      toast.error("Please enter a value");
      return;
    }

    setIsAdding(true);
    try {
      await setSecret(KEYCHAIN_SERVICE, keyToAdd, newValue.trim());
      toast.success(`Stored "${keyToAdd}" in OS keychain`);
      setShowAddDialog(false);
      setNewKey("");
      setNewValue("");
      setSelectedPreset("");
      void loadSecrets();
    } catch (error) {
      toast.error(`Failed to store secret: ${String(error)}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSecret = async (key: string) => {
    setDeletingKey(key);
    try {
      await deleteSecret(KEYCHAIN_SERVICE, key);
      toast.success(`Deleted "${key}" from OS keychain`);
      // Clear revealed value if this was the one being shown
      if (revealedKey === key) {
        setRevealedKey(null);
        setRevealedValue(null);
      }
      void loadSecrets();
    } catch (error) {
      toast.error(`Failed to delete secret: ${String(error)}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleRevealSecret = async (key: string) => {
    // Toggle off if already revealed
    if (revealedKey === key) {
      setRevealedKey(null);
      setRevealedValue(null);
      return;
    }

    setIsRevealing(true);
    try {
      const value = await getSecret(KEYCHAIN_SERVICE, key);
      if (value) {
        setRevealedKey(key);
        setRevealedValue(value);
        // Auto-hide after 10 seconds
        setTimeout(() => {
          setRevealedKey(null);
          setRevealedValue(null);
        }, 10000);
      } else {
        toast.error("Secret not found in keychain");
      }
    } catch (error) {
      toast.error(`Failed to retrieve secret: ${String(error)}`);
    } finally {
      setIsRevealing(false);
    }
  };

  const handleCopySecret = async (key: string) => {
    try {
      const value = await getSecret(KEYCHAIN_SERVICE, key);
      if (value) {
        await navigator.clipboard.writeText(value);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
        toast.success("Copied to clipboard");
      } else {
        toast.error("Secret not found");
      }
    } catch (error) {
      toast.error(`Failed to copy secret: ${String(error)}`);
    }
  };

  const openAddWithPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    setNewKey("");
    setNewValue("");
    setShowAddDialog(true);
  };

  // Determine which well-known keys are not yet stored
  const missingPresets = WELL_KNOWN_KEYS.filter(
    (wk) => !storedKeys.some((sk) => sk.key === wk.key)
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Secrets Manager
          </CardTitle>
          <CardDescription>
            Store API keys securely in the OS keychain (macOS Keychain / Windows
            Credential Manager / Linux Secret Service). Secrets are never stored
            in plain text or config files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {storedKeys.length} secret{storedKeys.length !== 1 ? "s" : ""}{" "}
                stored
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadSecrets()}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedPreset("");
                  setNewKey("");
                  setNewValue("");
                  setShowAddDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Secret
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : storedKeys.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <Key className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">No secrets stored</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add API keys to securely store them in the OS keychain
                </p>
              </div>
              {missingPresets.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {missingPresets.slice(0, 3).map((preset) => (
                    <Button
                      key={preset.key}
                      variant="outline"
                      size="sm"
                      onClick={() => openAddWithPreset(preset.key)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {preset.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Secrets List */
            <div className="space-y-2">
              {storedKeys.map((secret) => {
                const wellKnown = WELL_KNOWN_KEYS.find(
                  (wk) => wk.key === secret.key
                );
                return (
                  <div
                    key={secret.key}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Key className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium truncate">
                            {secret.key}
                          </span>
                          {wellKnown && (
                            <Badge variant="secondary" className="text-xs">
                              {wellKnown.label}
                            </Badge>
                          )}
                        </div>
                        {revealedKey === secret.key && revealedValue ? (
                          <p className="font-mono text-xs text-muted-foreground mt-0.5 truncate">
                            {revealedValue}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {wellKnown?.description ?? "Custom secret"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />

                      {/* Reveal button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isRevealing}
                        onClick={() => void handleRevealSecret(secret.key)}
                        title={
                          revealedKey === secret.key
                            ? "Hide value"
                            : "Reveal value"
                        }
                      >
                        {revealedKey === secret.key ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Copy button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void handleCopySecret(secret.key)}
                        title="Copy to clipboard"
                      >
                        {copiedKey === secret.key ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={deletingKey === secret.key}
                        onClick={() => void handleDeleteSecret(secret.key)}
                        title="Delete from keychain"
                      >
                        {deletingKey === secret.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick-add presets for missing well-known keys */}
          {!isLoading && storedKeys.length > 0 && missingPresets.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Quick add commonly used keys:
              </p>
              <div className="flex flex-wrap gap-2">
                {missingPresets.map((preset) => (
                  <Button
                    key={preset.key}
                    variant="outline"
                    size="sm"
                    onClick={() => openAddWithPreset(preset.key)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Secret Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Secret to OS Keychain</DialogTitle>
            <DialogDescription>
              The value will be stored securely in your operating system's native
              credential store.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Preset selector or custom key */}
            <div className="space-y-2">
              <Label>Key Name</Label>
              {missingPresets.length > 0 && !selectedPreset ? (
                <div className="space-y-2">
                  <Select
                    value={selectedPreset}
                    onValueChange={(value) => {
                      setSelectedPreset(value);
                      setNewKey("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a preset or type custom..." />
                    </SelectTrigger>
                    <SelectContent>
                      {missingPresets.map((preset) => (
                        <SelectItem key={preset.key} value={preset.key}>
                          {preset.label} ({preset.key})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground text-center">
                    or
                  </div>
                  <Input
                    placeholder="CUSTOM_API_KEY"
                    value={newKey}
                    onChange={(e) => {
                      setNewKey(e.target.value.toUpperCase());
                      setSelectedPreset("");
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedPreset ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {selectedPreset}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPreset("")}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Change
                      </Button>
                    </div>
                  ) : (
                    <Input
                      placeholder="e.g., ANTHROPIC_API_KEY"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Value input */}
            <div className="space-y-2">
              <Label htmlFor="secret-value">Value</Label>
              <Input
                id="secret-value"
                type="password"
                placeholder="Enter secret value..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Value is encrypted and stored in the OS keychain, not in any
                config file.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleAddSecret()}
              disabled={
                isAdding ||
                (!selectedPreset && !newKey.trim()) ||
                !newValue.trim()
              }
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Storing...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Store in Keychain
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
