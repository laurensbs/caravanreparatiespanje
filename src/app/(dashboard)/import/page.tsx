"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

interface ImportStats {
  imported: number;
  skipped: number;
  errors: number;
  sheets: string[];
}

export default function ImportPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && /\.(xlsx|xls|csv)$/i.test(dropped.name)) {
      setFile(dropped);
      setResult(null);
      setError(null);
    } else {
      setError("Please upload an Excel (.xlsx, .xls) or CSV file.");
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        setFile(selected);
        setResult(null);
        setError(null);
      }
    },
    []
  );

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Spreadsheet Import
        </h1>
        <p className="text-muted-foreground">
          Import repair jobs from existing spreadsheets. Each sheet tab becomes a
          location. Status and flags are inferred from cell content.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Spreadsheet</CardTitle>
          <CardDescription>
            Supported formats: .xlsx, .xls, .csv — Column headers are
            auto-detected. Original text is always preserved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            }`}
          >
            {file ? (
              <>
                <FileSpreadsheet className="mb-2 h-10 w-10 text-green-600" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </>
            ) : (
              <>
                <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Drop a file here or click to browse</p>
                <p className="text-sm text-muted-foreground">
                  .xlsx, .xls, or .csv
                </p>
              </>
            )}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
              style={{ position: "absolute", inset: 0 }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleUpload} disabled={!file || isProcessing}>
              {isProcessing && <Spinner className="mr-2 h-4 w-4" />}
              {isProcessing ? "Importing…" : "Start Import"}
            </Button>
            {file && !isProcessing && (
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {result.imported}
                </p>
                <p className="text-sm text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {result.skipped}
                </p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {result.errors}
                </p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>

            {result.sheets.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Sheets processed:</p>
                <div className="flex flex-wrap gap-1">
                  {result.sheets.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button onClick={() => router.push("/repairs")}>
                View Repairs
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                Import Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-Detection</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Column headers are matched by keyword (customer, status, reg, etc.)</p>
            <p>• Status is inferred from cell content (e.g. &quot;waiting parts&quot; → Waiting for Parts)</p>
            <p>• Safety-related keywords auto-flag as urgent priority</p>
            <p>• Each sheet tab becomes a separate location</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What Gets Preserved</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Original raw text from all cells is stored verbatim</p>
            <p>• Source sheet name is recorded on every job</p>
            <p>• Normalization flags track what was detected</p>
            <p>• Every import is logged with full statistics</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
