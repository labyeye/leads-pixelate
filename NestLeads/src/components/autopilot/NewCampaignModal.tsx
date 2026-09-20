import React, {useState} from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import {autopilotAPI} from '../../services/api';
import {NB_SHADOW, PRIMARY} from './ui';

// Asks for a campaign name and creates it. The server refuses past the plan's campaign limit and
// says so in the error, which is shown here.
export default function NewCampaignModal({
  visible,
  limit,
  onClose,
  onCreated,
}: {
  visible: boolean;
  limit?: number;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await autopilotAPI.createCampaign(name.trim());
      setName('');
      onCreated(res.data.id);
    } catch (e: any) {
      setError(e.message || 'Could not create the campaign');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>New campaign</Text>
          <Text style={s.sub}>
            Each campaign has its own accounts, brand, logos, schedule, references and competitors.
            {limit ? ` Your plan allows ${limit} campaign${limit === 1 ? '' : 's'}.` : ''}
          </Text>
          <TextInput
            style={s.input}
            value={name}
            maxLength={60}
            onChangeText={setName}
            placeholder="e.g. Bakery Instagram, Winter sale"
            placeholderTextColor="#94a3b8"
            accessibilityLabel="Campaign name"
            autoFocus
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, {backgroundColor: '#fff'}]} onPress={onClose} disabled={busy}>
              <Text style={[s.btnText, {color: '#000'}]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, {backgroundColor: PRIMARY}, (!name.trim() || busy) && {opacity: 0.5}]} onPress={create} disabled={!name.trim() || busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create campaign</Text>}
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
  input: {borderWidth: 2, borderColor: '#000', padding: 10, fontSize: 14, color: '#000'},
  error: {color: '#b91c1c', fontSize: 12, marginTop: 6},
  row: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12},
  btn: {paddingVertical: 11, paddingHorizontal: 16, borderWidth: 2, borderColor: '#000', marginLeft: 8, minWidth: 96, alignItems: 'center'},
  btnText: {fontSize: 13, fontWeight: '800', color: '#fff'},
});
