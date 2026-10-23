import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import Icon from './Icon';

const PRIMARY = '#024BAB';
const pad = (n: number) => String(n).padStart(2, '0');

/** Tap-to-open stepper for picking a date (and optionally a time). */
export default function DateTimeField({
  value,
  onChange,
  withTime = true,
}: {
  value: Date;
  onChange: (d: Date) => void;
  withTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const adjust = (field: string, delta: number) => {
    const d = new Date(draft);
    if (field === 'day') d.setDate(d.getDate() + delta);
    if (field === 'month') d.setMonth(d.getMonth() + delta);
    if (field === 'year') d.setFullYear(d.getFullYear() + delta);
    if (field === 'hour') d.setHours(d.getHours() + delta);
    if (field === 'minute') d.setMinutes(d.getMinutes() + delta);
    setDraft(d);
  };

  const label =
    value.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) +
    (withTime
      ? '  ' +
        value.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : '');

  const Col = ({ field, text }: { field: string; text: string | number }) => (
    <View style={s.col}>
      <TouchableOpacity onPress={() => adjust(field, 1)} style={s.arrow}>
        <Icon name="chevron-up" size={20} color="#000" />
      </TouchableOpacity>
      <Text style={s.val}>{text}</Text>
      <TouchableOpacity onPress={() => adjust(field, -1)} style={s.arrow}>
        <Icon name="chevron-down" size={20} color="#000" />
      </TouchableOpacity>
      <Text style={s.fieldLabel}>{field.toUpperCase()}</Text>
    </View>
  );

  return (
    <>
      <TouchableOpacity
        style={s.btn}
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        <Icon name="calendar-outline" size={16} color={PRIMARY} />
        <Text style={s.btnText}>{label}</Text>
      </TouchableOpacity>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.title}>
              {withTime ? 'SELECT DATE & TIME' : 'SELECT DATE'}
            </Text>
            <View style={s.row}>
              <Col field="day" text={pad(draft.getDate())} />
              <Col field="month" text={pad(draft.getMonth() + 1)} />
              <Col field="year" text={draft.getFullYear()} />
            </View>
            {withTime && (
              <>
                <View style={s.divider} />
                <View style={s.row}>
                  <Col field="hour" text={pad(draft.getHours())} />
                  <Col field="minute" text={pad(draft.getMinutes())} />
                </View>
              </>
            )}
            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancel} onPress={() => setOpen(false)}>
                <Text style={s.cancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirm}
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                <Text style={s.confirmText}>CONFIRM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const box = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 5,
  borderBottomWidth: 5,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: '#000',
} as const;

const s = StyleSheet.create({
  btn: {
    ...box,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  btnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#000' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: { ...box, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 13, fontWeight: '800', color: '#000', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  col: { alignItems: 'center' },
  arrow: { padding: 6 },
  val: { fontSize: 24, fontWeight: '800', color: '#000', minWidth: 48, textAlign: 'center' },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', marginTop: 2 },
  divider: { height: 2, backgroundColor: '#000', marginVertical: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancel: { ...box, flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  cancelText: { fontWeight: '800', color: '#000', fontSize: 13 },
  confirm: { ...box, flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: PRIMARY },
  confirmText: { fontWeight: '800', color: '#fff', fontSize: 13 },
});
