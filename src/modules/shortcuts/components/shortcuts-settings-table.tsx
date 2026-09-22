"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { comboFromKeyboardEvent, formatShortcutCombo } from "@/lib/shortcut-keys";
import { SHORTCUT_CATEGORY_LABELS, SHORTCUT_DEFINITIONS } from "@/config/shortcuts";
import {
  resetAllShortcutBindings,
  resetShortcutBinding,
  setShortcutBinding,
  useShortcutOverrides,
} from "@/hooks/use-shortcuts";

/** Personal, browser-local keybinding customization (per-device localStorage
 * — see use-shortcuts.ts — never company data, so this has no server action
 * and no permission gate; every authenticated user customizes their own). */
export function ShortcutsSettingsTable() {
  const overrides = useShortcutOverrides();
  const [recordingId, setRecordingId] = React.useState<string | null>(null);
  const [conflictLabel, setConflictLabel] = React.useState<string | null>(null);

  const resolved = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const definition of SHORTCUT_DEFINITIONS) {
      map.set(definition.id, overrides[definition.id] ?? definition.defaultKeys);
    }
    return map;
  }, [overrides]);

  function startRecording(id: string) {
    setConflictLabel(null);
    setRecordingId(id);
  }

  function stopRecording() {
    setRecordingId(null);
    setConflictLabel(null);
  }

  function handleRecorderKeyDown(id: string, event: React.KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      stopRecording();
      return;
    }

    const combo = comboFromKeyboardEvent(event.nativeEvent);
    if (!combo) {
      // A bare modifier press — keep waiting for the real key.
      return;
    }

    const conflicting = SHORTCUT_DEFINITIONS.find(
      (definition) => definition.id !== id && resolved.get(definition.id) === combo
    );
    if (conflicting) {
      setConflictLabel(`Already used by "${conflicting.label}" — press a different combo, or Esc to cancel.`);
      return;
    }

    setShortcutBinding(id, combo);
    stopRecording();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            resetAllShortcutBindings();
            stopRecording();
          }}
        >
          <RotateCcw size={14} />
          Reset All to Defaults
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shortcut</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Keys</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SHORTCUT_DEFINITIONS.map((definition) => {
              const isCustomized = definition.id in overrides;
              const isRecording = recordingId === definition.id;
              return (
                <TableRow key={definition.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{definition.label}</div>
                    <div className="text-xs text-muted-foreground">{definition.description}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{SHORTCUT_CATEGORY_LABELS[definition.category]}</Badge>
                  </TableCell>
                  <TableCell>
                    {definition.isReserved ? (
                      <kbd className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs">
                        {formatShortcutCombo(definition.defaultKeys)}
                      </kbd>
                    ) : isRecording ? (
                      <div className="flex flex-col gap-1">
                        <input
                          autoFocus
                          readOnly
                          value="Press keys…"
                          onKeyDown={(event) => handleRecorderKeyDown(definition.id, event)}
                          onBlur={stopRecording}
                          className="w-40 rounded-md border border-ring bg-transparent px-2 py-1 text-sm text-muted-foreground outline-none"
                        />
                        {conflictLabel && <p className="text-xs text-destructive">{conflictLabel}</p>}
                      </div>
                    ) : (
                      <kbd className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs">
                        {formatShortcutCombo(resolved.get(definition.id) ?? definition.defaultKeys)}
                      </kbd>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {definition.isReserved ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Reserved
                      </Badge>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => (isRecording ? stopRecording() : startRecording(definition.id))}
                        >
                          {isRecording ? "Cancel" : "Change"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Reset ${definition.label} to default`}
                          disabled={!isCustomized}
                          onClick={() => resetShortcutBinding(definition.id)}
                        >
                          <RotateCcw size={14} />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
