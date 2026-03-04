import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

export interface ExportOptions {
  includeRatings: boolean;
  includePositions: boolean;
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (opts: ExportOptions) => void;
  showOptions?: boolean;
  title?: string;
}

export function ExportModal({ open, onClose, onConfirm, showOptions = true, title = "Export Image" }: ExportModalProps) {
  const [includeRatings, setIncludeRatings] = useState(true);
  const [includePositions, setIncludePositions] = useState(true);

  function handleConfirm() {
    onConfirm({ includeRatings, includePositions });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {showOptions && (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="export-ratings"
                checked={includeRatings}
                onCheckedChange={(v) => setIncludeRatings(Boolean(v))}
                data-testid="checkbox-export-ratings"
              />
              <Label htmlFor="export-ratings" className="text-sm cursor-pointer">Include ratings</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="export-positions"
                checked={includePositions}
                onCheckedChange={(v) => setIncludePositions(Boolean(v))}
                data-testid="checkbox-export-positions"
              />
              <Label htmlFor="export-positions" className="text-sm cursor-pointer">Include positions</Label>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} data-testid="button-export-cancel">
            Cancel
          </Button>
          <Button className="flex-1 gap-2" onClick={handleConfirm} data-testid="button-export-download">
            <Download className="h-4 w-4" />
            Save Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
