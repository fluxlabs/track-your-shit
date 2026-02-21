// Track Your Shit - Settings Page
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportDataDialog, ClearDataDialog, ThemeCustomization, SecretsManager } from "@/components/settings";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSettings, useUpdateSettings, useResetSettings, useImportSettings } from "@/lib/queries";
import { Settings } from "@/lib/tauri";
import { useTheme, Theme } from "@/hooks/use-theme";
import { Download, Trash2, Settings as SettingsIcon, RotateCcw, Upload, Bug, Terminal, Bell, Database, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LogsContent } from "./logs";

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const resetSettings = useResetSettings();
  const importSettingsMutation = useImportSettings();
  const { theme, setTheme } = useTheme();
  const [formData, setFormData] = useState<Settings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings && !formData) {
      setFormData(settings);
    }
  }, [settings, formData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!formData) return;
    if (key === "theme") {
      setTheme(value as Theme);
      setFormData({ ...formData, [key]: value });
      return;
    }
    setFormData({ ...formData, [key]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!formData) return;
    await updateSettings.mutateAsync(formData);
    setHasChanges(false);
  };

  if (isLoading || !formData) {
    return (
      <div className="p-8">
        <div className="text-center py-8 text-muted-foreground">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-8 max-w-3xl">
      {/* Header */}
      <PageHeader
        title="Settings"
        description="Configure Track Your Shit preferences"
        icon={<SettingsIcon className="h-6 w-6 text-muted-foreground" />}
        actions={
          hasChanges ? (
            <Button onClick={() => void handleSave()} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Saving..." : "Save Changes"}
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="general" className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="logs">
            <ScrollText className="h-3.5 w-3.5 mr-1.5" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* ── General ─────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                General
              </CardTitle>
              <CardDescription>Application behavior and startup preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="settings-theme" className="block text-sm font-medium mb-2">Theme</Label>
                <Select
                  value={theme}
                  onValueChange={(value) => handleChange("theme", value)}
                >
                  <SelectTrigger id="settings-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="settings-start-login" className="text-sm font-medium">Start on login</Label>
                  <p className="text-xs text-muted-foreground">
                    Launch Track Your Shit when you log in
                  </p>
                </div>
                <Switch
                  id="settings-start-login"
                  checked={formData.start_on_login}
                  onCheckedChange={(checked) => handleChange("start_on_login", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="settings-auto-open" className="text-sm font-medium">Auto-open last project</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically open the last viewed project on startup
                  </p>
                </div>
                <Switch
                  id="settings-auto-open"
                  checked={formData.auto_open_last_project}
                  onCheckedChange={(checked) => handleChange("auto_open_last_project", checked)}
                />
              </div>

              <div>
                <Label htmlFor="settings-window-state" className="block text-sm font-medium mb-2">Window state</Label>
                <Select
                  value={formData.window_state}
                  onValueChange={(value) => handleChange("window_state", value)}
                >
                  <SelectTrigger id="settings-window-state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="maximized">Maximized</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Terminal ───────────────────────── */}
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Terminal</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="settings-use-tmux" className="text-sm font-medium">Persistent terminals (tmux)</Label>
                    <p className="text-xs text-muted-foreground">
                      Use tmux for sessions that survive app restarts
                    </p>
                  </div>
                  <Switch
                    id="settings-use-tmux"
                    checked={formData.use_tmux}
                    onCheckedChange={(checked) => handleChange("use_tmux", checked)}
                  />
                </div>
              </div>

              {/* ── Secrets ───────────────────────── */}
              <div className="pt-2 border-t">
                <SecretsManager />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Appearance ──────────────────────────────────── */}
        <TabsContent value="appearance" className="space-y-6">
          <ThemeCustomization />
        </TabsContent>

        {/* ── Notifications ───────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configure when to receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="settings-notifications" className="text-sm font-medium">Enable notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Show system notifications for events
                  </p>
                </div>
                <Switch
                  id="settings-notifications"
                  checked={formData.notifications_enabled}
                  onCheckedChange={(checked) => handleChange("notifications_enabled", checked)}
                />
              </div>

              {formData.notifications_enabled && (
                <div className="space-y-3 pl-1 border-l-2 border-muted ml-2">
                  <div className="flex items-center justify-between pl-3">
                    <Label htmlFor="settings-notify-complete" className="text-sm font-medium">On completion</Label>
                    <Switch
                      id="settings-notify-complete"
                      checked={formData.notify_on_complete}
                      onCheckedChange={(checked) => handleChange("notify_on_complete", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between pl-3">
                    <Label htmlFor="settings-notify-error" className="text-sm font-medium">On error</Label>
                    <Switch
                      id="settings-notify-error"
                      checked={formData.notify_on_error}
                      onCheckedChange={(checked) => handleChange("notify_on_error", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between pl-3">
                    <Label htmlFor="settings-notify-phase" className="text-sm font-medium">On phase complete</Label>
                    <Switch
                      id="settings-notify-phase"
                      checked={formData.notify_on_phase_complete}
                      onCheckedChange={(checked) => handleChange("notify_on_phase_complete", checked)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Data Management ─────────────────────────────── */}
        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription>Export, import, and manage application data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Database: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">~/Library/Application Support/net.fluxlabs.track-your-shit/track-your-shit.db</code>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setShowExportDialog(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void importSettingsMutation.mutateAsync().then((imported) => {
                    setFormData(imported);
                    setHasChanges(false);
                  }).catch(() => { /* toast via onError */ })}
                  disabled={importSettingsMutation.isPending}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Settings
                </Button>
                <Button variant="destructive" onClick={() => setShowClearDialog(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Data
                </Button>
                {showResetConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-destructive font-medium">Reset all settings?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        void resetSettings.mutateAsync().then((defaults) => {
                          setFormData(defaults);
                          setHasChanges(false);
                          setShowResetConfirm(false);
                          localStorage.removeItem('track-your-shit-theme');
                          localStorage.removeItem('track-your-shit-accent');
                          localStorage.removeItem('track-your-shit-density');
                          localStorage.removeItem('track-your-shit-font-scale');
                          localStorage.removeItem('track-your-shit-font-family');
                        }).catch(() => { /* toast via onError */ });
                      }}
                      disabled={resetSettings.isPending}
                    >
                      Yes, Reset
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setShowResetConfirm(true)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Defaults
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Advanced ────────────────────────────────────── */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Advanced
              </CardTitle>
              <CardDescription>Debugging and troubleshooting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="settings-debug-logging" className="text-sm font-medium">Debug logging</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable verbose logging (restart required)
                  </p>
                </div>
                <Switch
                  id="settings-debug-logging"
                  checked={formData.debug_logging}
                  onCheckedChange={(checked) => handleChange("debug_logging", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs ────────────────────────────────────────── */}
        <TabsContent value="logs" className="space-y-6">
          <LogsContent />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ExportDataDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
      <ClearDataDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
      />
    </div>
  );
}
