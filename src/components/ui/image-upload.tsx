"use client"

import { useRef, useState } from "react"
import { Loader2, Trash2, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  bucket: string
  path: string          // e.g. "clubs/abc123/logo"
  shape?: "square" | "wide"
  label?: string
  hint?: string
  maxSizeMB?: number
}

export function ImageUpload({
  value,
  onChange,
  bucket,
  path,
  shape = "square",
  label = "Зураг оруулах",
  hint,
  maxSizeMB = 5,
}: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function upload(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Зургийн хэмжээ ${maxSizeMB}MB-аас бага байх ёстой`)
      return
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Зөвхөн зураг файл оруулна уу")
      return
    }

    setUploading(true)
    const supabase = createClient()

    const ext = file.name.split(".").pop() ?? "jpg"
    const filePath = `${path}.${ext}?t=${Date.now()}`

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true, contentType: file.type })

    if (error) {
      toast.error("Зураг байршуулахад алдаа гарлаа")
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath)
    onChange(publicUrl)
    toast.success("Зураг амжилттай байршлаа")
    setUploading(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await upload(file)
    e.target.value = ""
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await upload(file)
  }

  async function handleRemove() {
    onChange(null)
  }

  const isWide = shape === "wide"

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <div
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl overflow-hidden transition-all cursor-pointer",
          isWide ? "h-32 w-full" : "h-28 w-28",
          dragOver ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/50 hover:bg-secondary/30",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {/* Preview */}
        {value && (
          <img
            src={value}
            alt="preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Overlay */}
        <div className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-1.5 transition-opacity",
          value ? "opacity-0 hover:opacity-100 bg-black/50" : "opacity-100"
        )}>
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : (
            <>
              <Upload className={cn("h-6 w-6", value ? "text-white" : "text-muted-foreground")} />
              <p className={cn("text-xs font-medium text-center px-2", value ? "text-white" : "text-muted-foreground")}>
                {value ? "Солих" : "Зураг оруулах"}
              </p>
              {!value && (
                <p className="text-[10px] text-muted-foreground/70">PNG, JPG, WebP · {maxSizeMB}MB</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Remove button */}
      {value && !uploading && (
        <button
          type="button"
          onClick={handleRemove}
          className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Зураг устгах
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
