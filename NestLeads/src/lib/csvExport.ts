import {Share} from 'react-native';

// ponytail: shares raw CSV text via the OS share sheet instead of a real .csv
// file attachment (RN has no Blob/download-link like web) — upgrade to
// react-native-fs/expo-sharing if users need a true file attachment.
export async function shareCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  await Share.share({message: csv, title: filename});
}
