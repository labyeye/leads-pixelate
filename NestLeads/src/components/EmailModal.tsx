import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  AppState,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { emailAPI } from '../services/api';

const BLUE = '#024BAB';

/** Email a lead from your connected Gmail and see the thread (same as web). */
export default function EmailModal({ lead, onClose }: { lead: any | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [account, setAccount] = useState('');
  const [thread, setThread] = useState<any[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [waitingOAuth, setWaitingOAuth] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const r = await emailAPI.getStatus();
      setConnected(!!r.data?.connected);
      setAccount(r.data?.emailAddress || '');
      return !!r.data?.connected;
    } catch {
      setConnected(false);
      return false;
    }
  }, []);

  const loadThread = useCallback(async () => {
    if (!lead?._id) return;
    try {
      const r = await emailAPI.getThread(lead._id);
      setThread(r.data || []);
    } catch {
      setThread([]);
    }
  }, [lead]);

  useEffect(() => {
    if (!lead) return;
    setConnected(null);
    setThread([]);
    setBody('');
    setSubject(`Re: ${lead.requirement || lead.company || 'your enquiry'}`);
    checkStatus().then(ok => { if (ok) loadThread(); });
  }, [lead, checkStatus, loadThread]);

  // Gmail consent happens in the browser; re-check when the user comes back to the app.
  useEffect(() => {
    if (!waitingOAuth) return;
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active')
        checkStatus().then(ok => {
          if (ok) {
            setWaitingOAuth(false);
            loadThread();
          }
        });
    });
    return () => sub.remove();
  }, [waitingOAuth, checkStatus, loadThread]);

  const connect = async () => {
    try {
      const r = await emailAPI.getAuthUrl();
      setWaitingOAuth(true);
      Linking.openURL(r.data.authUrl);
    } catch (e: any) {
      Alert.alert('Could not start Gmail connection', e.message);
    }
  };

  const disconnect = () =>
    Alert.alert('Disconnect Gmail?', account, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await emailAPI.disconnect();
            setConnected(false);
            setThread([]);
          } catch (e: any) {
            Alert.alert('Failed to disconnect', e.message);
          }
        },
      },
    ]);

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      Alert.alert('Subject and message are required');
      return;
    }
    try {
      setSending(true);
      const bodyHtml = body
        .split('\n')
        .map(l => `<p>${(l || '&nbsp;').replace(/</g, '&lt;')}</p>`)
        .join('');
      const r = await emailAPI.send(lead._id, { subject: subject.trim(), bodyHtml, bodyText: body.trim() });
      setThread(t => [...t, r.data]);
      setBody('');
    } catch (e: any) {
      Alert.alert('Failed to send email', e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!lead} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.container, { paddingTop: insets.top }]}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.iconBtn}>
              <Icon name="close" size={18} color="#000" />
            </TouchableOpacity>
            <Text style={s.title} numberOfLines={1}>
              Email · {lead?.name}
            </Text>
            <View style={{ width: 34 }} />
          </View>
          <View style={s.divider} />

          {connected === null ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={BLUE} />
          ) : !connected ? (
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={s.text}>Connect your Gmail to send emails to leads and keep the thread here.</Text>
              <TouchableOpacity style={s.primary} onPress={connect}>
                <Text style={s.primaryText}>Connect Gmail</Text>
              </TouchableOpacity>
              {waitingOAuth && (
                <TouchableOpacity onPress={() => checkStatus().then(ok => { if (ok) loadThread(); })}>
                  <Text style={[s.link, { textAlign: 'center' }]}>I've allowed access, check again</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <View style={s.account}>
                <Icon name="mail-outline" size={14} color="#16a34a" />
                <Text style={[s.muted, { flex: 1 }]} numberOfLines={1}>
                  Sending as {account}
                </Text>
                <TouchableOpacity onPress={disconnect}>
                  <Text style={[s.link, { color: '#dc2626' }]}>Disconnect</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 8 }}>
                {thread.length === 0 ? (
                  <Text style={s.muted}>No emails with this lead yet.</Text>
                ) : (
                  thread.map(e => (
                    <View key={e._id} style={[s.mail, e.direction === 'outbound' ? s.out : s.in]}>
                      <Text style={s.mailSubject}>{e.subject}</Text>
                      <Text style={s.text}>{e.bodyText || e.snippet}</Text>
                      <Text style={s.mailMeta}>
                        {e.direction === 'outbound' ? 'You' : e.from} · {new Date(e.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
              <View style={[s.compose, { paddingBottom: insets.bottom + 10 }]}>
                {!lead?.email ? (
                  <Text style={{ color: '#dc2626', fontSize: 12 }}>This lead has no email address. Add it with Edit Lead.</Text>
                ) : (
                  <>
                    <TextInput style={s.input} value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor="#94a3b8" />
                    <TextInput
                      style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]}
                      value={body}
                      onChangeText={setBody}
                      placeholder={`Write to ${lead.email}`}
                      placeholderTextColor="#94a3b8"
                      multiline
                    />
                    <TouchableOpacity style={[s.primary, (sending || !body.trim()) && { opacity: 0.5 }]} onPress={send} disabled={sending || !body.trim()}>
                      {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Send email</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  iconBtn: { width: 34, height: 34, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#000', textAlign: 'center' },
  divider: { height: 2, backgroundColor: '#000' },
  text: { fontSize: 13, color: '#000' },
  muted: { fontSize: 12, color: '#64748b' },
  link: { fontSize: 12, fontWeight: '600', color: BLUE },
  account: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  mail: { borderWidth: 2, borderColor: '#000', padding: 10 },
  out: { backgroundColor: '#eff6ff', marginLeft: 30 },
  in: { backgroundColor: '#fff', marginRight: 30 },
  mailSubject: { fontSize: 12, fontWeight: '700', color: '#000', marginBottom: 4 },
  mailMeta: { fontSize: 10, color: '#64748b', marginTop: 6 },
  compose: { borderTopWidth: 2, borderTopColor: '#000', padding: 12, gap: 8 },
  input: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#000' },
  primary: { backgroundColor: BLUE, borderWidth: 2, borderColor: '#000', paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' },
});
