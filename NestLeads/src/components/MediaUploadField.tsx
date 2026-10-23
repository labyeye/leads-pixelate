import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Icon from './Icon';
import { uploadFile } from '../services/api';
import { checkMedia, MediaCheck, MediaRule } from '../utils/mediaCheck';

const PRIMARY = '#024BAB';

/** Picks media from camera/library, uploads it, and returns the stored URL(s). */
export default function MediaUploadField({
  value,
  onChange,
  kind,
  multiple,
  label,
  max = 10,
  rule,
  strict,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  kind: 'image' | 'video';
  multiple?: boolean;
  label?: string;
  max?: number;
  /** Instagram size rule to check the picked file against. */
  rule?: MediaRule;
  /** Reject files that break the rule (e.g. when posting to Instagram). */
  strict?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [checks, setChecks] = useState<Record<string, MediaCheck>>({});
  const urls = value.filter(Boolean);

  // Measure already-uploaded images so existing media shows its resolution too.
  useEffect(() => {
    if (!rule || kind !== 'image') return;
    urls.forEach(u => {
      if (checks[u]) return;
      Image.getSize(
        u,
        (w, h) => setChecks(c => ({ ...c, [u]: checkMedia(w, h, rule) })),
        () => {},
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.join('|'), rule]);
  const mediaType = kind === 'video' ? 'video' : 'photo';

  const handle = (res: any) => {
    const a = res.assets?.[0];
    if (!a?.uri) return;
    const check =
      rule && a.width && a.height ? checkMedia(a.width, a.height, rule) : null;
    const go = () =>
    (async () => {
      setUploading(true);
      try {
        const url = await uploadFile(
          a.uri,
          a.fileName || `media_${Date.now()}`,
          a.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        );
        if (check) setChecks(c => ({ ...c, [url]: check }));
        onChange(multiple ? [...urls, url] : [url]);
      } catch (e: any) {
        Alert.alert('Upload failed', e.message);
      } finally {
        setUploading(false);
      }
    })();
    if (check && check.status === 'error') {
      const head = `${check.width}×${check.height} (${check.ratio})`;
      if (strict) {
        Alert.alert('Image not allowed', `${head}\n${check.message}`);
        return;
      }
      Alert.alert('Check image size', `${head}\n${check.message}`, [
        { text: 'Choose another', style: 'cancel' },
        { text: 'Upload anyway', onPress: go },
      ]);
      return;
    }
    go();
  };

  const pick = () => {
    if (multiple && urls.length >= max) {
      Alert.alert(`Max ${max} items`);
      return;
    }
    Alert.alert(kind === 'video' ? 'Add video' : 'Add image', undefined, [
      {
        text: 'Camera',
        onPress: () => launchCamera({ mediaType, quality: 0.8 }, handle),
      },
      {
        text: 'Library',
        onPress: () =>
          launchImageLibrary({ mediaType, quality: 0.8, selectionLimit: 1 }, handle),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View>
      {urls.length > 0 && (
        <View style={s.grid}>
          {urls.map((u, i) => (
            <View key={u + i} style={multiple ? s.thumbWrap : s.fullWrap}>
              {kind === 'video' ? (
                <View style={[s.videoBox, !multiple && { height: 120 }]}>
                  <Icon name="videocam-outline" size={28} color="#64748b" />
                  <Text style={s.videoText} numberOfLines={1}>
                    Video uploaded
                  </Text>
                </View>
              ) : (
                broken[u] ? (
                  <View style={[multiple ? s.thumb : s.full, s.broken]}>
                    <Icon name="image-outline" size={26} color="#94a3b8" />
                    <Text style={s.brokenText}>Preview unavailable</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: u }}
                    style={multiple ? s.thumb : s.full}
                    resizeMode="cover"
                    onError={() => setBroken(b => ({ ...b, [u]: true }))}
                  />
                )
              )}
              <TouchableOpacity
                style={s.remove}
                onPress={() => onChange(urls.filter((_, idx) => idx !== i))}
                hitSlop={8}
              >
                <Icon name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      {urls.map(u =>
        checks[u] ? (
          <View
            key={'c' + u}
            style={[
              s.chip,
              checks[u].status === 'ok' && s.chipOk,
              checks[u].status === 'warn' && s.chipWarn,
              checks[u].status === 'error' && s.chipErr,
            ]}
          >
            <Text style={s.chipText}>
              {checks[u].width}×{checks[u].height} · {checks[u].ratio}
              {checks[u].message ? ` — ${checks[u].message}` : ''}
            </Text>
          </View>
        ) : null,
      )}
      {(multiple || urls.length === 0) && (
        <TouchableOpacity style={s.btn} onPress={pick} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Icon name="cloud-upload-outline" size={18} color={PRIMARY} />
          )}
          <Text style={s.btnText}>
            {uploading
              ? 'Uploading...'
              : label ||
                (kind === 'video'
                  ? 'Upload video'
                  : multiple
                    ? 'Upload image'
                    : 'Upload image')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  thumbWrap: { width: 90, height: 90 },
  fullWrap: { width: '100%' },
  thumb: { width: 90, height: 90, borderWidth: 2, borderColor: '#000', borderRadius: 6 },
  full: { width: '100%', height: 180, borderWidth: 2, borderColor: '#000', borderRadius: 8 },
  videoBox: {
    width: 90,
    height: 90,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  videoText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  chip: { borderWidth: 2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6, backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  chipOk: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  chipWarn: { backgroundColor: '#fef9c3', borderColor: '#fde047' },
  chipErr: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#000' },
  broken: { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', gap: 4 },
  brokenText: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textAlign: 'center' },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PRIMARY,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  btnText: { fontSize: 13, fontWeight: '800', color: PRIMARY },
});
