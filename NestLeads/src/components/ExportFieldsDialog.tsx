import React, {useState} from 'react';
import {View, Text, TouchableOpacity, Modal, FlatList, StyleSheet} from 'react-native';
import Icon from './Icon';
import {shareCSV} from '../lib/csvExport';

export interface ExportField {
  key: string;
  label: string;
  default?: boolean;
  get: (item: any) => string | number;
}

interface ExportFieldsDialogProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  fields: ExportField[];
  data: any[];
  filenamePrefix: string;
}

export default function ExportFieldsDialog({
  visible,
  onClose,
  title = 'Export CSV',
  fields,
  data,
  filenamePrefix,
}: ExportFieldsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(fields.filter(f => f.default !== false).map(f => f.key)),
  );

  const toggle = (key: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const allSelected = selected.size === fields.length;

  const handleExport = async () => {
    const chosen = fields.filter(f => selected.has(f.key));
    if (chosen.length === 0 || data.length === 0) return;
    await shareCSV(
      `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`,
      chosen.map(f => f.label),
      data.map(item => chosen.map(f => f.get(item))),
    );
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {data.length} row{data.length !== 1 ? 's' : ''} will be exported
            </Text>
            <TouchableOpacity
              onPress={() => setSelected(allSelected ? new Set() : new Set(fields.map(f => f.key)))}>
              <Text style={styles.linkText}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={fields}
            keyExtractor={f => f.key}
            style={{maxHeight: 320}}
            renderItem={({item}) => (
              <TouchableOpacity style={styles.fieldRow} onPress={() => toggle(item.key)}>
                <View style={[styles.checkbox, selected.has(item.key) && styles.checkboxChecked]}>
                  {selected.has(item.key) && <Icon name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={styles.fieldLabel}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, (selected.size === 0 || data.length === 0) && {opacity: 0.4}]}
              disabled={selected.size === 0 || data.length === 0}
              onPress={handleExport}>
              <Icon name="download-outline" size={14} color="#fff" />
              <Text style={styles.exportBtnText}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', padding: 18, gap: 12},
  title: {fontSize: 16, fontWeight: '900', color: '#000'},
  metaRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 10},
  metaText: {fontSize: 11, color: '#64748b'},
  linkText: {fontSize: 11, fontWeight: '800', color: '#024BAB'},
  fieldRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8},
  checkbox: {width: 20, height: 20, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  checkboxChecked: {backgroundColor: '#024BAB'},
  fieldLabel: {fontSize: 13, color: '#000', fontWeight: '600'},
  footer: {flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12},
  cancelBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', paddingVertical: 12},
  cancelBtnText: {fontSize: 12, fontWeight: '900', color: '#000'},
  exportBtn: {flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000', backgroundColor: '#024BAB', paddingVertical: 12},
  exportBtnText: {fontSize: 12, fontWeight: '900', color: '#fff'},
});
