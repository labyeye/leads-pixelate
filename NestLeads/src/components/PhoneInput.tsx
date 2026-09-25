import React, {useEffect, useRef, useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet} from 'react-native';
import Icon from './Icon';

const COUNTRIES = [
  {code: '91', flag: '🇮🇳', name: 'India'},
  {code: '1', flag: '🇺🇸', name: 'USA/Canada'},
  {code: '44', flag: '🇬🇧', name: 'UK'},
  {code: '971', flag: '🇦🇪', name: 'UAE'},
  {code: '61', flag: '🇦🇺', name: 'Australia'},
  {code: '65', flag: '🇸🇬', name: 'Singapore'},
  {code: '60', flag: '🇲🇾', name: 'Malaysia'},
  {code: '966', flag: '🇸🇦', name: 'Saudi Arabia'},
];

const DEFAULT_COUNTRY = '91';

function splitPhone(value: string) {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length <= 10) return {country: DEFAULT_COUNTRY, local: digits};
  const match = COUNTRIES.find(c => digits.startsWith(c.code));
  if (match) return {country: match.code, local: digits.slice(match.code.length)};
  return {country: DEFAULT_COUNTRY, local: digits};
}

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
}

// Same emit convention as web: bare 10-digit for India, "<dialcode><local>" otherwise.
export default function PhoneInput({
  label,
  value,
  onChange,
  placeholder = '10-digit number',
  readOnly = false,
  required = false,
}: PhoneInputProps) {
  const [country, setCountry] = useState(() => splitPhone(value).country);
  const [local, setLocal] = useState(() => splitPhone(value).local);
  const [pickerOpen, setPickerOpen] = useState(false);
  const syncedRef = useRef(!!value);

  useEffect(() => {
    if (!syncedRef.current && value) {
      const parsed = splitPhone(value);
      setCountry(parsed.country);
      setLocal(parsed.local);
      syncedRef.current = true;
    }
  }, [value]);

  const update = (nextCountry: string, nextLocalRaw: string) => {
    const maxLen = nextCountry === DEFAULT_COUNTRY ? 10 : 12;
    const nextLocal = nextLocalRaw.replace(/\D/g, '').slice(0, maxLen);
    setCountry(nextCountry);
    setLocal(nextLocal);
    onChange(nextCountry === DEFAULT_COUNTRY ? nextLocal : nextCountry + nextLocal);
  };

  const selected = COUNTRIES.find(c => c.code === country) || COUNTRIES[0];

  return (
    <View style={{gap: 6}}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={{color: '#ef4444'}}> *</Text> : null}
        </Text>
      ) : null}
      <View style={styles.row}>
        <TouchableOpacity
          disabled={readOnly}
          onPress={() => setPickerOpen(true)}
          style={styles.countryBtn}>
          <Text style={styles.countryText}>
            {selected.flag} +{selected.code}
          </Text>
          {!readOnly && <Icon name="chevron-down" size={12} color="#000" />}
        </TouchableOpacity>
        <TextInput
          value={local}
          editable={!readOnly}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          onChangeText={t => update(country, t)}
          style={styles.input}
        />
      </View>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Country</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={c => c.code}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => {
                    update(item.code, local);
                    setPickerOpen(false);
                  }}>
                  <Text style={styles.countryRowText}>
                    {item.flag} +{item.code} · {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {fontSize: 11, fontWeight: '600', color: '#000', textTransform: 'uppercase', letterSpacing: 0.5},
  row: {flexDirection: 'row', borderWidth: 2, borderColor: '#000'},
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRightWidth: 2,
    borderRightColor: '#000',
    backgroundColor: '#fff',
  },
  countryText: {fontSize: 13, fontWeight: '800', color: '#000'},
  input: {flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#000'},
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', maxHeight: '60%', padding: 16},
  sheetTitle: {fontSize: 14, fontWeight: '600', marginBottom: 10, color: '#000'},
  countryRow: {paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0'},
  countryRowText: {fontSize: 14, color: '#000', fontWeight: '600'},
});
