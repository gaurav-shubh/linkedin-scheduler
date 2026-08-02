import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Hand a generated file to the user.
 *
 * Native: write into the cache directory and open the share sheet.
 * Web: expo-sharing needs the Web Share API (HTTPS, patchy support), so fall back to
 * a plain anchor download, which works everywhere including the local dev server.
 */
export async function saveAndShare({ filename, contents, mimeType, dialogTitle }) {
  if (Platform.OS === 'web') {
    downloadInBrowser(filename, contents, mimeType);
    return { method: 'download' };
  }

  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle, UTI: utiFor(mimeType) });
    return { method: 'share', uri: file.uri };
  }
  // Sharing unavailable (rare) — the file is still on disk, so report where.
  return { method: 'file', uri: file.uri };
}

function utiFor(mimeType) {
  if (mimeType === 'application/json') return 'public.json';
  if (mimeType === 'text/csv') return 'public.comma-separated-values-text';
  return 'public.plain-text';
}

function downloadInBrowser(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
