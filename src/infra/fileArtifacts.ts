import type { AppNotice } from '@/domain/types'

function cannotReadFileNotice(message: string): { ok: false; notice: AppNotice } {
  return {
    ok: false,
    notice: {
      level: 'warning',
      message,
    },
  }
}

export async function readArtifactFile(file: File, maxBytes: number): Promise<
  | {
      ok: true
      text: string
    }
  | {
      ok: false
      notice: AppNotice
    }
> {
  if (!file) {
    return cannotReadFileNotice('No file was selected.')
  }

  if (file.size > maxBytes) {
    return cannotReadFileNotice('The selected file is too large for this app to import safely.')
  }

  try {
    return {
      ok: true,
      text: await file.text(),
    }
  } catch {
    return cannotReadFileNotice('The selected file could not be read in this browser.')
  }
}

export function downloadJsonFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()

  globalThis.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
