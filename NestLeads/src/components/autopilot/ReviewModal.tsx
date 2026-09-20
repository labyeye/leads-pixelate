import React, {useState} from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import {autopilotAPI} from '../../services/api';
import {NB_SHADOW, PRIMARY} from './ui';

const MAX_REVISIONS = 3;

// "Request changes": the owner says what is wrong ("image too dark", "never mention offers");
// Autopilot fixes the caption, regenerates the image if needed and asks again.
export default function ReviewModal({
  post,
  onClose,
  onSent,
}: {
  post: any | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const used = post?.autopilotMeta?.revisions ?? 0;

  const send = async () => {
    if (!post || !text.trim()) return;
    setSending(true);
    setError('');
    try {
      await autopilotAPI.revisePost(post._id, text.trim());
      setText('');
      onSent();
    } catch (e: any) {
      setError(e.message || 'Could not send your change request');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!post} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>What should change?</Text>
          <Text style={s.sub}>
            Autopilot fixes the post and regenerates it. Rules like “never…” are remembered for every later post.
          </Text>
          <TextInput
            style={s.input}
            multiline
            maxLength={500}
            value={text}
            onChangeText={setText}
            placeholder="e.g. the image looks too dark, caption is too long"
            placeholderTextColor="#94a3b8"
            accessibilityLabel="What should change?"
            autoFocus
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Text style={s.hint}>
            {MAX_REVISIONS - used} change{MAX_REVISIONS - used === 1 ? '' : 's'} left for this post
          </Text>
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.cancel]} onPress={onClose} disabled={sending}>
              <Text style={[s.btnText, {color: '#000'}]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.send, (!text.trim() || sending || used >= MAX_REVISIONS) && {opacity: 0.5}]}
              onPress={send}
              disabled={!text.trim() || sending || used >= MAX_REVISIONS}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Fix &amp; regenerate</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)'},
  sheet: {backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', padding: 16, ...NB_SHADOW},
  title: {fontSize: 17, fontWeight: '800', color: '#000'},
  sub: {fontSize: 12, color: '#475569', marginTop: 4, marginBottom: 10},
  input: {
    borderWidth: 2, borderColor: '#000', minHeight: 90, padding: 10,
    textAlignVertical: 'top', fontSize: 14, color: '#000',
  },
  error: {color: '#b91c1c', fontSize: 12, marginTop: 6},
  hint: {fontSize: 11, color: '#64748b', marginTop: 6},
  row: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12},
  btn: {paddingVertical: 11, paddingHorizontal: 16, borderWidth: 2, borderColor: '#000', marginLeft: 8, minWidth: 96, alignItems: 'center'},
  cancel: {backgroundColor: '#fff'},
  send: {backgroundColor: PRIMARY},
  btnText: {fontSize: 13, fontWeight: '800', color: '#fff'},
});
