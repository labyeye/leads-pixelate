import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from './Icon';
import WhatsAppLogo from './WhatsAppLogo';
import {whatsappAPI} from '../services/api';
import {useTheme} from '../contexts/ThemeContext';

interface Template {
  _id: string;
  name: string;
  displayName?: string;
  bodyText: string;
  headerType?: string;
  variableCount: number;
  status: string;
  notes?: string;
  language?: string;
  category?: string;
}

interface Mapping {
  position: number;
  fieldKey: string;
  customValue: string;
}

const FIELD_OPTIONS = [
  {key: 'name', label: 'Lead Name'},
  {key: 'company', label: 'Company'},
  {key: 'phone', label: 'Phone'},
  {key: 'location', label: 'Location'},
  {key: 'requirement', label: 'Requirement'},
  {key: 'budget', label: 'Budget'},
  {key: 'custom', label: 'Custom Value'},
];

const MAP_KEYS = ['name', 'company', 'phone', 'location', 'requirement', 'budget', 'custom'];

function parseMapping(notes: string | undefined, varCount: number): Mapping[] {
  const hint = /MAP:\s*([a-z,\s]+)/i.exec(notes || '')?.[1]
    ?.split(',')
    .map(s => s.trim().toLowerCase());
  const out: Mapping[] = [];
  for (let i = 1; i <= varCount; i++) {
    const fromHint = hint?.[i - 1];
    const fieldKey =
      fromHint && MAP_KEYS.includes(fromHint)
        ? fromHint
        : i === 1
        ? 'name'
        : i === 2
        ? 'company'
        : 'custom';
    out.push({position: i, fieldKey, customValue: ''});
  }
  return out;
}

interface SendWhatsAppModalProps {
  visible: boolean;
  onClose: () => void;
  lead: any;
  onSent?: () => void;
}

export default function SendWhatsAppModal({
  visible,
  onClose,
  lead,
  onSent,
}: SendWhatsAppModalProps) {
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  const phoneClean = useMemo(() => {
    return String(lead?.phone || '').replace(/\D/g, '');
  }, [lead?.phone]);

  useEffect(() => {
    if (!visible) return;

    setLoading(true);
    setSelectedTemplateId('');
    setMapping([]);

    Promise.allSettled([whatsappAPI.getTemplates(), whatsappAPI.getStatus()])
      .then(([tRes, sRes]) => {
        let tmpls: Template[] = [];
        if (tRes.status === 'fulfilled') {
          const list = tRes.value.data || [];
          // Prefer approved templates; fallback to all if none approved yet
          const approved = list.filter((t: Template) => t.status === 'APPROVED');
          tmpls = approved.length > 0 ? approved : list;
          setTemplates(tmpls);
          if (tmpls.length > 0) {
            handleSelectTemplate(tmpls[0], tmpls);
          }
        }

        if (sRes.status === 'fulfilled') {
          const sData = sRes.value.data;
          const nums = sData?.phoneNumbers || [];
          setPhoneNumbers(nums);
          setIsConnected(!!(sData?.connected ?? (nums.length > 0)));
          if (nums.length > 0) {
            setSelectedPhoneNumberId(nums[0].phoneNumberId);
          }
        }
      })
      .catch((err: any) => {
        Alert.alert('Notice', err.message || 'Failed to load WhatsApp configuration');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [visible]);

  const handleSelectTemplate = (tmpl: Template, list = templates) => {
    setSelectedTemplateId(tmpl._id);
    const varCount =
      tmpl.variableCount ||
      new Set((tmpl.bodyText?.match(/\{\{\d+\}\}/g) || []) as string[]).size;
    setMapping(parseMapping(tmpl.notes, varCount));
  };

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t._id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  // Compute live preview text
  const previewText = useMemo(() => {
    if (!selectedTemplate) return '';
    let text = selectedTemplate.bodyText || '';
    mapping.forEach(m => {
      let val = '';
      if (m.fieldKey === 'custom') {
        val = m.customValue || `[Custom ${m.position}]`;
      } else {
        val = String(lead?.[m.fieldKey] || `[${m.fieldKey}]`);
      }
      text = text.replace(new RegExp(`\\{\\{${m.position}\\}\\}`, 'g'), val);
    });
    return text;
  }, [selectedTemplate, mapping, lead]);

  const handleSend = async () => {
    if (!selectedTemplate) {
      Alert.alert('Validation', 'Please select a WhatsApp template to send.');
      return;
    }
    if (!phoneClean || phoneClean.length < 10) {
      Alert.alert('Invalid Phone', 'This lead does not have a valid 10-digit phone number.');
      return;
    }

    setSending(true);
    try {
      // 1. Try creating a campaign (same as web dashboard: records in logs & tracks delivery)
      try {
        await whatsappAPI.createCampaign({
          name: `${selectedTemplate.displayName || selectedTemplate.name} · ${new Date().toLocaleDateString('en-IN')}`,
          templateId: selectedTemplate._id,
          leadIds: [lead._id || lead.id],
          variableMapping: mapping,
          phoneNumberId: selectedPhoneNumberId || undefined,
        });
      } catch (campErr: any) {
        // Fallback to direct sendMessage API
        await whatsappAPI.sendMessage({
          leadId: lead._id || lead.id,
          templateId: selectedTemplate._id,
          variableMapping: mapping,
          phoneNumberId: selectedPhoneNumberId || undefined,
        });
      }

      Alert.alert(
        'WhatsApp Message Queued',
        `Template "${selectedTemplate.displayName || selectedTemplate.name}" sent to ${lead.name || 'lead'}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              onSent?.();
              onClose();
            },
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Send Failed', err.message || 'Could not send WhatsApp template. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleOpenWhatsAppDirect = () => {
    if (phoneClean) {
      const waNumber = phoneClean.length === 10 ? `91${phoneClean}` : phoneClean;
      Linking.openURL(`https://wa.me/${waNumber}`).catch(() => {
        Alert.alert('Error', 'Unable to open WhatsApp application.');
      });
    } else {
      Alert.alert('Error', 'Lead has no phone number.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, {maxHeight: '92%', paddingBottom: Math.max(insets.bottom, 16)}]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.logoBadge}>
                <WhatsAppLogo size={18} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Send WhatsApp Template</Text>
                <Text style={styles.modalSub} numberOfLines={1}>
                  To: <Text style={{fontWeight: '700'}}>{lead?.name || 'Lead'}</Text> ({lead?.phone || 'No phone'})
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Icon name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#25D366" />
              <Text style={styles.loadingText}>Loading WhatsApp templates...</Text>
            </View>
          ) : !isConnected && templates.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconBg, {backgroundColor: '#fee2e2'}]}>
                <Icon name="alert-circle-outline" size={32} color="#dc2626" />
              </View>
              <Text style={styles.emptyTitle}>WhatsApp Not Connected</Text>
              <Text style={styles.emptyDesc}>
                Connect your Meta WhatsApp Business API in the web dashboard (Settings → WhatsApp) to send official templates.
              </Text>
              <TouchableOpacity
                style={styles.directWhatsAppBtn}
                onPress={handleOpenWhatsAppDirect}>
                <WhatsAppLogo size={16} />
                <Text style={styles.directWhatsAppText}>Open WhatsApp App Directly</Text>
              </TouchableOpacity>
            </View>
          ) : templates.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconBg, {backgroundColor: '#fef3c7'}]}>
                <Icon name="document-text-outline" size={32} color="#d97706" />
              </View>
              <Text style={styles.emptyTitle}>No Templates Available</Text>
              <Text style={styles.emptyDesc}>
                No approved templates found. Create or sync templates in the web dashboard under WhatsApp → Templates.
              </Text>
              <TouchableOpacity
                style={styles.directWhatsAppBtn}
                onPress={handleOpenWhatsAppDirect}>
                <WhatsAppLogo size={16} />
                <Text style={styles.directWhatsAppText}>Open WhatsApp App Directly</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={{paddingBottom: 16}}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {/* Select Template Label */}
              <Text style={styles.sectionLabel}>CHOOSE TEMPLATE ({templates.length})</Text>

              {/* Template Picker Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templateScroll}>
                {templates.map(tmpl => {
                  const isSelected = tmpl._id === selectedTemplateId;
                  return (
                    <TouchableOpacity
                      key={tmpl._id}
                      style={[
                        styles.templateChip,
                        isSelected && styles.templateChipSelected,
                      ]}
                      onPress={() => handleSelectTemplate(tmpl)}>
                      <Text
                        style={[
                          styles.templateChipText,
                          isSelected && styles.templateChipTextSelected,
                        ]}>
                        {tmpl.displayName || tmpl.name}
                      </Text>
                      {tmpl.status === 'APPROVED' && (
                        <View style={styles.approvedDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Message Live Preview Card */}
              {selectedTemplate && (
                <View style={styles.previewContainer}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewLabel}>LIVE PREVIEW</Text>
                    <Text style={styles.previewTmplName}>
                      {selectedTemplate.displayName || selectedTemplate.name}
                    </Text>
                  </View>
                  <View style={styles.whatsappBubble}>
                    <Text style={styles.whatsappBubbleText}>{previewText}</Text>
                    <View style={styles.bubbleFooter}>
                      <Text style={styles.bubbleTime}>Just now</Text>
                      <Icon name="checkmark-done" size={14} color="#53bdeb" style={{marginLeft: 4}} />
                    </View>
                  </View>
                </View>
              )}

              {/* Variable Mapping Customization */}
              {mapping.length > 0 && (
                <View style={styles.mappingSection}>
                  <Text style={styles.sectionLabel}>TEMPLATE VARIABLES</Text>
                  <Text style={styles.subHint}>
                    Variables automatically populated from lead info:
                  </Text>
                  {mapping.map(m => (
                    <View key={m.position} style={styles.variableRow}>
                      <View style={styles.varBadge}>
                        <Text style={styles.varBadgeText}>{`{{${m.position}}}`}</Text>
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={styles.varFieldLabel}>
                          Field: {FIELD_OPTIONS.find(f => f.key === m.fieldKey)?.label || m.fieldKey}
                        </Text>
                        <TextInput
                          style={styles.varInput}
                          placeholder={`Value for {{${m.position}}}`}
                          placeholderTextColor="#94a3b8"
                          value={
                            m.fieldKey === 'custom'
                              ? m.customValue
                              : String(lead?.[m.fieldKey] || '')
                          }
                          onChangeText={text => {
                            setMapping(prev =>
                              prev.map(item =>
                                item.position === m.position
                                  ? {...item, fieldKey: 'custom', customValue: text}
                                  : item,
                              ),
                            );
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Sender Phone Number (if multiple) */}
              {phoneNumbers.length > 1 && (
                <View style={styles.senderSection}>
                  <Text style={styles.sectionLabel}>SEND FROM NUMBER</Text>
                  <View style={styles.senderRow}>
                    {phoneNumbers.map(p => {
                      const isSel = p.phoneNumberId === selectedPhoneNumberId;
                      return (
                        <TouchableOpacity
                          key={p.phoneNumberId}
                          style={[styles.senderChip, isSel && styles.senderChipSelected]}
                          onPress={() => setSelectedPhoneNumberId(p.phoneNumberId)}>
                          <Text style={[styles.senderChipText, isSel && styles.senderChipTextSelected]}>
                            {p.label || p.businessName || p.phoneNumber}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={sending}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!selectedTemplate || sending) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!selectedTemplate || sending}>
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <WhatsAppLogo size={16} />
                  <Text style={styles.sendBtnText}>Send Template</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Subtle direct WhatsApp link as fallback */}
          <TouchableOpacity
            style={styles.directLinkRow}
            onPress={handleOpenWhatsAppDirect}>
            <Text style={styles.directLinkText}>
              Need to chat directly? <Text style={{fontWeight: '700', textDecorationLine: 'underline'}}>Open WhatsApp App</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: '#000',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#22c55e',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 28,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  directWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  directWhatsAppText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollArea: {
    maxHeight: 420,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  templateScroll: {
    paddingBottom: 10,
    gap: 8,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  templateChipSelected: {
    borderColor: '#000',
    backgroundColor: '#dcfce7',
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  templateChipTextSelected: {
    color: '#15803d',
    fontWeight: '800',
  },
  approvedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  previewContainer: {
    backgroundColor: '#e7f5ed',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.5,
  },
  previewTmplName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  whatsappBubble: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: {width: 0, height: 1},
    elevation: 1,
  },
  whatsappBubbleText: {
    fontSize: 13,
    color: '#1e293b',
    lineHeight: 19,
  },
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  bubbleTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  mappingSection: {
    marginTop: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subHint: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
  },
  variableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  varBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  varBadgeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#334155',
  },
  varFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  varInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    color: '#0f172a',
  },
  senderSection: {
    marginTop: 12,
  },
  senderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  senderChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  senderChipSelected: {
    borderColor: '#000',
    backgroundColor: '#e2e8f0',
  },
  senderChipText: {
    fontSize: 11,
    color: '#475569',
  },
  senderChipTextSelected: {
    fontWeight: '700',
    color: '#0f172a',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  sendBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#25D366',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  directLinkRow: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 4,
  },
  directLinkText: {
    fontSize: 11,
    color: '#64748b',
  },
});
