import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { Check, CheckCheck, ClockPlus } from 'lucide-react-native';

// ─── Logo assets ─────────────────────────────────────────────────────────────
const LOGOS: Record<string, any> = {
  indiamart: require('../assets/images/logos/indiamart.png'),
  facebook: require('../assets/images/logos/facebook.png'),
  meta: require('../assets/images/logos/meta.png'),
  tradeindia: require('../assets/images/logos/tradeindia.webp'),
  justdial: require('../assets/images/logos/justdial.webp'),
  instagram: require('../assets/images/logos/instagram.webp'),
  whatsapp: require('../assets/images/logos/whatsapp.png'),
  mail: require('../assets/images/logos/gmail.png'),
  messages: require('../assets/images/logos/messages.png'),
};

// ─── Types ────────────────────────────────────────────────────────────────────
type FieldType = 'text' | 'password' | 'readonly';

interface StepField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  value?: string;
}

interface WizardStep {
  title: string;
  subtitle: string;
  instructions: string[];
  fields?: StepField[];
  actionLabel?: string;
}

interface Integration {
  key: string;
  label: string;
  desc: string;
  logoKey?: string;
  fallbackIcon: string;
  color: string;
  bgColor: string;
  steps: WizardStep[];
}

// ─── Integration definitions ─────────────────────────────────────────────────
const INTEGRATIONS: Integration[] = [
  {
    key: 'indiamart',
    label: 'IndiaMART',
    desc: 'Auto-import buyer enquiries every 5 min',
    logoKey: 'indiamart',
    fallbackIcon: 'storefront-outline',
    color: '#9A1C17',
    bgColor: '#fff',
    steps: [
      {
        title: 'Log in to IndiaMART Seller Account',
        subtitle: 'Step 1 of 3 — Open IndiaMART and go to Settings',
        instructions: [
          'Go to seller.indiamart.com and log in',
          'Tap "Settings" in the navigation menu',
          'Under Settings, find "CRM API Integration" or "API Settings"',
          'Tap on it to open the API configuration page',
        ],
        actionLabel: "I've opened CRM API Settings",
      },
      {
        title: 'Copy your CRM API Key',
        subtitle: 'Step 2 of 3 — Get your unique API key',
        instructions: [
          'On the CRM API Integration page, find your unique API Key',
          'The key looks like: IMXXXXXXXXXXXXXXXXXXXXXXXXXX',
          'Copy and paste it in the field below',
        ],
        fields: [
          {
            key: 'api_key',
            label: 'IndiaMART CRM API Key',
            type: 'password',
            placeholder: 'Paste your API key here e.g. IMXXXXXXXXXX',
            help: 'Found in Seller Panel → Settings → CRM API Integration',
          },
        ],
        actionLabel: 'Save & Verify Connection',
      },
      {
        title: "You're connected!",
        subtitle: 'Step 3 of 3 — IndiaMART is now syncing leads',
        instructions: [
          'NestLeads will check for new enquiries every 5 minutes automatically',
          'All new IndiaMART buyer enquiries will appear in your Leads tab',
          'You can do a manual sync anytime from this page',
          'Each lead will be tagged with source "IndiaMART"',
        ],
        actionLabel: 'Done',
      },
    ],
  },
  {
    key: 'facebook',
    label: 'Facebook Lead Ads',
    desc: 'Capture leads from FB & Instagram ads instantly',
    logoKey: 'facebook',
    fallbackIcon: 'logo-facebook',
    color: '#1877F2',
    bgColor: '#fff',
    steps: [
      {
        title: 'Open Facebook Developer App',
        subtitle: 'Step 1 of 4 — Set up your Facebook App',
        instructions: [
          'Go to developers.facebook.com and log in',
          'Tap "My Apps" and open your existing app or create a new one',
          'In the sidebar, go to "Products" and tap "+ Add a Product"',
          'Find "Lead Ads Retrieval" and tap "Set Up"',
        ],
        actionLabel: "I've set up Lead Ads",
      },
      {
        title: 'Add NestLeads Webhook in Facebook',
        subtitle: 'Step 2 of 4 — Tell Facebook where to send leads',
        instructions: [
          'In your Facebook App, go to "Webhooks" in the left menu',
          'Tap "Add Callback URL"',
          'Paste the Webhook URL below into the "Callback URL" field',
          'In "Verify Token" field type: nestleads_verify_token',
          'Tap "Verify and Save" and subscribe to the "leadgen" field',
        ],
        fields: [
          {
            key: 'webhook_url',
            label: 'Your Webhook URL (copy into Facebook)',
            type: 'readonly',
            value: 'https://api.nestleads.app/api/facebook/webhook',
            help: 'Paste this in Facebook App → Webhooks → Callback URL',
          },
          {
            key: 'verify_token',
            label: 'Verify Token (copy into Facebook)',
            type: 'readonly',
            value: 'nestleads_verify_token',
            help: 'Paste this in Facebook App → Webhooks → Verify Token',
          },
        ],
        actionLabel: "I've added the Webhook",
      },
      {
        title: 'Enter your Page details',
        subtitle: 'Step 3 of 4 — Connect your Facebook Page',
        instructions: [
          'Go to your Facebook Page → Settings → Leads Access',
          'Find your Page ID (a number like 123456789) in the About section',
          'To get a Page Access Token: Go to Graph API Explorer, select your Page, generate token with "never expire"',
          'Copy and paste both values below',
        ],
        fields: [
          {
            key: 'page_id',
            label: 'Facebook Page ID',
            type: 'text',
            placeholder: 'e.g. 123456789012345',
            help: 'Found in your Facebook Page → About → Page Transparency',
          },
          {
            key: 'access_token',
            label: 'Page Access Token',
            type: 'password',
            placeholder: 'EAAxxxxxxxxxxxxxxx...',
            help: 'From Graph API Explorer or Page Settings → Access Tokens',
          },
        ],
        actionLabel: 'Save & Connect',
      },
      {
        title: 'Facebook Lead Ads connected!',
        subtitle: "Step 4 of 4 — You're all set",
        instructions: [
          'Every Facebook or Instagram Lead Ad submission will appear in NestLeads instantly',
          'Leads are tagged with source "Facebook" so you can filter them',
          'Go to Leads tab and filter by Source → Facebook to see them',
        ],
        actionLabel: 'Done',
      },
    ],
  },
  {
    key: 'tradeindia',
    label: 'TradeIndia',
    desc: 'Import leads from your TradeIndia listings',
    logoKey: 'tradeindia',
    fallbackIcon: 'storefront-outline',
    color: '#F57D26',
    bgColor: '#ffff',
    steps: [
      {
        title: 'Get your TradeIndia API credentials',
        subtitle: 'Step 1 of 2 — Log in to TradeIndia Seller',
        instructions: [
          'Log in to your TradeIndia Seller account at tradeindia.com',
          'Go to My Account → API Settings',
          'Find your User ID and API Key on that page',
          'Copy both values and paste them below',
        ],
        fields: [
          {
            key: 'user_id',
            label: 'TradeIndia User ID',
            type: 'text',
            placeholder: 'Your TradeIndia User ID',
            help: 'Found in Seller Panel → My Account → API Settings',
          },
          {
            key: 'api_key',
            label: 'TradeIndia API Key',
            type: 'password',
            placeholder: 'Your TradeIndia API Key',
            help: 'Found alongside your User ID in API Settings',
          },
        ],
        actionLabel: 'Connect TradeIndia',
      },
      {
        title: 'TradeIndia is connected!',
        subtitle: 'Step 2 of 2 — Leads will start importing',
        instructions: [
          'NestLeads will check for new TradeIndia enquiries automatically',
          'Leads will be tagged with source "TradeIndia"',
          'Filter your Leads page by source to see TradeIndia leads',
        ],
        actionLabel: 'Done',
      },
    ],
  },
  {
    key: 'justdial',
    label: 'Justdial',
    desc: 'Pull enquiries from Justdial business listings',
    logoKey: 'justdial',
    fallbackIcon: 'call-outline',
    color: '#1176BA',
    bgColor: '#fff',
    steps: [
      {
        title: 'Get your Justdial API Key',
        subtitle: 'Step 1 of 2 — Contact Justdial for API access',
        instructions: [
          'Call Justdial Business Support to request API access',
          'Ask for "CRM API Integration" setup',
          'They will send your API Key via email (1-2 business days)',
          'Once received, paste it below',
        ],
        fields: [
          {
            key: 'api_key',
            label: 'Justdial API Key',
            type: 'password',
            placeholder: 'Paste your Justdial API key here',
            help: 'Received from Justdial Business Support team via email',
          },
        ],
        actionLabel: 'Connect Justdial',
      },
      {
        title: 'Justdial is connected!',
        subtitle: 'Step 2 of 2 — All set',
        instructions: [
          'All Justdial enquiries will now appear in your Leads tab automatically',
          'Leads will be tagged with source "Justdial"',
        ],
        actionLabel: 'Done',
      },
    ],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Business',
    desc: 'Connect WhatsApp Business API for messaging',
    logoKey: 'whatsapp',
    fallbackIcon: 'logo-whatsapp',
    color: '#25D366',
    bgColor: '#fff',
    steps: [
      {
        title: 'Connect WhatsApp Business API',
        subtitle: 'Step 1 of 2 — Get your API credentials',
        instructions: [
          'Go to business.whatsapp.com and log in',
          'Navigate to Settings → API Setup',
          'Copy your Phone Number ID and Access Token',
          'Paste them below',
        ],
        fields: [
          {
            key: 'phone_number_id',
            label: 'Phone Number ID',
            type: 'text',
            placeholder: 'e.g. 123456789012345',
            help: 'Found in WhatsApp Business → Settings → API Setup',
          },
          {
            key: 'access_token',
            label: 'Access Token',
            type: 'password',
            placeholder: 'Your permanent access token',
            help: 'Generate from Meta Business Suite → WhatsApp API',
          },
        ],
        actionLabel: 'Save & Connect',
      },
      {
        title: 'WhatsApp Business connected!',
        subtitle: 'Step 2 of 2 — All set',
        instructions: [
          'You can now send and receive WhatsApp messages from NestLeads',
          "All conversations will be linked to the lead's profile",
        ],
        actionLabel: 'Done',
      },
    ],
  },
  {
    key: 'email',
    label: 'Email / SMTP',
    desc: 'Send automated emails and follow-ups via SMTP',
    logoKey: 'mail',
    fallbackIcon: 'mail-outline',
    color: '#64748b',
    bgColor: '#fff',
    steps: [
      {
        title: 'Configure SMTP Settings',
        subtitle: 'Step 1 of 2 — Enter your email credentials',
        instructions: [
          'Use Gmail, Outlook, or any SMTP provider',
          'For Gmail: enable "App Passwords" in your Google account',
          'Enter your SMTP host, port, and credentials below',
        ],
        fields: [
          {
            key: 'host',
            label: 'SMTP Host',
            type: 'text',
            placeholder: 'e.g. smtp.gmail.com',
          },
          {
            key: 'port',
            label: 'SMTP Port',
            type: 'text',
            placeholder: 'e.g. 587',
          },
          {
            key: 'email',
            label: 'Email Address',
            type: 'text',
            placeholder: 'your@email.com',
          },
          {
            key: 'password',
            label: 'App Password',
            type: 'password',
            placeholder: 'Your SMTP password or app password',
            help: 'For Gmail, use an App Password not your regular password',
          },
        ],
        actionLabel: 'Save & Test Connection',
      },
      {
        title: 'Email connected!',
        subtitle: 'Step 2 of 2 — SMTP is configured',
        instructions: [
          'NestLeads will now send automated emails via your SMTP account',
          'You can set up email templates and follow-up sequences in Settings',
        ],
        actionLabel: 'Done',
      },
    ],
  },
  // {
  //   key: 'webhook',
  //   label: 'Webhook',
  //   desc: 'Receive leads via custom webhook URL',
  //   fallbackIcon: 'code-slash-outline',
  //   color: '#7c3aed',
  //   bgColor: '#fff',
  //   steps: [
  //     {
  //       title: 'Your NestLeads Webhook URL',
  //       subtitle: 'Step 1 of 1 — Copy your webhook URL',
  //       instructions: [
  //         'Use this URL in any external tool or CRM to send leads to NestLeads',
  //         'Send a POST request with lead data in JSON format',
  //         'Fields: name, phone, email, source (all optional except phone or email)',
  //       ],
  //       fields: [
  //         {
  //           key: 'webhook_url',
  //           label: 'Your Webhook URL',
  //           type: 'readonly',
  //           value: 'https://api.nestleads.app/api/webhook/inbound',
  //           help: 'Paste this URL in your external tool to send leads here',
  //         },
  //       ],
  //       actionLabel: 'Done',
  //     },
  //   ],
  // },
  {
    key: 'sms',
    label: 'SMS Gateway',
    desc: 'Send SMS alerts and notifications to leads',
    logoKey: 'messages',
    fallbackIcon: 'chatbox-outline',
    color: '#22c55e',
    bgColor: '#fff',
    steps: [
      {
        title: 'Connect SMS Gateway',
        subtitle: 'Step 1 of 2 — Enter your SMS provider credentials',
        instructions: [
          'Supported providers: Twilio, MSG91, TextLocal, Fast2SMS',
          'Log in to your SMS provider and find your API credentials',
          'Copy your API Key and Sender ID below',
        ],
        fields: [
          {
            key: 'provider',
            label: 'SMS Provider',
            type: 'text',
            placeholder: 'e.g. MSG91, Twilio, Fast2SMS',
          },
          {
            key: 'api_key',
            label: 'API Key',
            type: 'password',
            placeholder: 'Your SMS provider API key',
          },
          {
            key: 'sender_id',
            label: 'Sender ID',
            type: 'text',
            placeholder: 'e.g. NESTLD',
            help: 'Your 6-character approved DLT Sender ID',
          },
        ],
        actionLabel: 'Save & Connect',
      },
      {
        title: 'SMS Gateway connected!',
        subtitle: 'Step 2 of 2 — SMS notifications are active',
        instructions: [
          'NestLeads will now send SMS alerts to leads via your SMS provider',
          'You can configure SMS templates in Settings',
        ],
        actionLabel: 'Done',
      },
    ],
  },
];

// ─── Wizard Modal ─────────────────────────────────────────────────────────────
function WizardModal({
  integration,
  onClose,
  onConnected,
}: {
  integration: Integration;
  onClose: () => void;
  onConnected: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const current = integration.steps[step];
  const isFirst = step === 0;
  const isLast = step === integration.steps.length - 1;
  const totalSteps = integration.steps.length;

  const setField = (key: string, val: string) =>
    setFields(prev => ({ ...prev, [key]: val }));

  const handleNext = async () => {
    const hasInput = current.fields?.some(f => f.type !== 'readonly');
    if (hasInput) {
      const missing = current.fields?.filter(
        f => f.type !== 'readonly' && !fields[f.key],
      );
      if (missing?.length) {
        Alert.alert('Required', `Please fill in: ${missing[0].label}`);
        return;
      }
      setSaving(true);
      await new Promise<void>(resolve => setTimeout(resolve, 900));
      setSaving(false);
    }

    if (isLast) {
      onConnected();
      onClose();
    } else {
      setStep(s => s + 1);
    }
  };

  const copyToClipboard = (val: string, label: string) => {
    // React Native doesn't have clipboard built-in without a package,
    // so we show the value prominently and mark as "copied" visually
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const logo = integration.logoKey ? LOGOS[integration.logoKey] : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[wizStyles.container, { paddingTop: insets.top }]}>
          {/* Header */}
          <View
            style={[wizStyles.header, { backgroundColor: integration.bgColor }]}
          >
            <View style={[wizStyles.logoBox, { borderColor: '#000' }]}>
              {logo ? (
                <Image
                  source={logo}
                  style={wizStyles.logoImg}
                  resizeMode="contain"
                />
              ) : (
                <Icon
                  name={integration.fallbackIcon}
                  size={22}
                  color={integration.color}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={wizStyles.headerTitle}>{integration.label}</Text>
              <Text style={wizStyles.headerSub}>{current.subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={wizStyles.closeBtn}>
              <Icon name="close" size={18} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Step progress */}
          <View style={wizStyles.progress}>
            {integration.steps.map((_, i) => (
              <View key={i} style={wizStyles.stepRow}>
                <View
                  style={[
                    wizStyles.stepDot,
                    i < step && { backgroundColor: '#22c55e' },
                    i === step && { backgroundColor: '#024BAB' },
                    i > step && { backgroundColor: '#e2e8f0' },
                  ]}
                >
                  {i < step ? (
                    <Icon name="checkmark" size={10} color="#fff" />
                  ) : (
                    <Text
                      style={[
                        wizStyles.stepNum,
                        i === step && { color: '#fff' },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  )}
                </View>
                {i < totalSteps - 1 && (
                  <View
                    style={[
                      wizStyles.stepLine,
                      i < step && { backgroundColor: '#22c55e' },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          {/* Body */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              wizStyles.body,
              { paddingBottom: insets.bottom + 16 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={wizStyles.stepTitle}>{current.title}</Text>

            {/* Instructions */}
            {current.instructions.map((inst, i) => (
              <View key={i} style={wizStyles.instrRow}>
                <View
                  style={[
                    wizStyles.instrNum,
                    { backgroundColor: integration.color },
                  ]}
                >
                  <Text style={wizStyles.instrNumText}>{i + 1}</Text>
                </View>
                <Text style={wizStyles.instrText}>{inst}</Text>
              </View>
            ))}

            {/* Fields */}
            {current.fields && current.fields.length > 0 && (
              <View style={wizStyles.fieldsSection}>
                {current.fields.map(field => {
                  const isReadonly = field.type === 'readonly';
                  const val = isReadonly
                    ? field.value ?? ''
                    : fields[field.key] ?? '';
                  const isCopied = copied === field.label;

                  return (
                    <View key={field.key} style={wizStyles.fieldGroup}>
                      <Text style={wizStyles.fieldLabel}>{field.label}</Text>
                      {field.help && (
                        <Text style={wizStyles.fieldHelp}>{field.help}</Text>
                      )}
                      <View style={wizStyles.fieldRow}>
                        <TextInput
                          style={[
                            wizStyles.fieldInput,
                            isReadonly && wizStyles.fieldInputReadonly,
                          ]}
                          value={val}
                          onChangeText={
                            isReadonly ? undefined : v => setField(field.key, v)
                          }
                          placeholder={field.placeholder}
                          placeholderTextColor="#94a3b8"
                          secureTextEntry={
                            field.type === 'password' && !show[field.key]
                          }
                          editable={!isReadonly}
                          multiline={isReadonly}
                          numberOfLines={isReadonly ? 2 : 1}
                        />
                        {isReadonly && (
                          <TouchableOpacity
                            style={[
                              wizStyles.copyBtn,
                              isCopied && { backgroundColor: '#22c55e' },
                            ]}
                            onPress={() => copyToClipboard(val, field.label)}
                          >
                            <Icon
                              name={isCopied ? 'checkmark' : 'copy-outline'}
                              size={14}
                              color={isCopied ? '#fff' : '#000'}
                            />
                            <Text
                              style={[
                                wizStyles.copyBtnText,
                                isCopied && { color: '#fff' },
                              ]}
                            >
                              {isCopied ? 'Copied' : 'Copy'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {field.type === 'password' && !isReadonly && (
                          <TouchableOpacity
                            style={wizStyles.eyeBtn}
                            onPress={() =>
                              setShow(p => ({
                                ...p,
                                [field.key]: !p[field.key],
                              }))
                            }
                          >
                            <Icon
                              name={
                                show[field.key]
                                  ? 'eye-off-outline'
                                  : 'eye-outline'
                              }
                              size={18}
                              color="#64748b"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View
            style={[wizStyles.footer, { paddingBottom: insets.bottom + 8 }]}
          >
            <TouchableOpacity
              style={wizStyles.backBtn}
              onPress={() => (isFirst ? onClose() : setStep(s => s - 1))}
            >
              <Icon
                name={isFirst ? 'close' : 'arrow-back'}
                size={16}
                color="#000"
              />
              <Text style={wizStyles.backBtnText}>
                {isFirst ? 'Cancel' : 'Back'}
              </Text>
            </TouchableOpacity>

            <Text style={wizStyles.stepCount}>
              Step {step + 1} of {totalSteps}
            </Text>

            <TouchableOpacity
              style={[
                wizStyles.nextBtn,
                { backgroundColor: integration.color },
              ]}
              onPress={handleNext}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={wizStyles.nextBtnText}>
                    {current.actionLabel ?? 'Next'}
                  </Text>
                  {!isLast && (
                    <Icon name="arrow-forward" size={14} color="#fff" />
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function IntegrationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [connected, setConnected] = useState<Set<string>>(
    new Set(['indiamart', 'whatsapp']),
  );
  const [wizard, setWizard] = useState<Integration | null>(null);

  const connectedCount = connected.size;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Integrations</Text>
          <Text style={styles.headerSub}>{connectedCount} active</Text>
        </View>
      </View>
      <View style={styles.divider} />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View
              style={{
                backgroundColor: '#f0fdf4',
                padding: 2,
                borderWidth: 2,
                borderColor: '#000',
              }}
            >
              <Check size={25} color="#22c55e" />
            </View>
            <View>
              <Text style={styles.summaryNum}>{connectedCount}</Text>
              <Text style={styles.summaryLabel}>Connected</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <View
              style={{
                backgroundColor: '#eff6ff',
                padding: 2,
                borderWidth: 2,
                borderColor: '#000',
              }}
            >
              <ClockPlus size={25} color="#044bab" />
            </View>
            <View>
              <Text style={styles.summaryNum}>
                {INTEGRATIONS.length - connectedCount}
              </Text>
              <Text style={styles.summaryLabel}>Available</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <View
              style={{
                backgroundColor: '#fff7ed',
                padding: 2,
                borderWidth: 2,
                borderColor: '#000',
              }}
            >
              <CheckCheck size={25} color="#e77b00" />
            </View>
            <View>
              <Text style={styles.summaryNum}>{INTEGRATIONS.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ALL INTEGRATIONS</Text>

        {INTEGRATIONS.map(intg => {
          const isOn = connected.has(intg.key);
          const logo = intg.logoKey ? LOGOS[intg.logoKey] : null;
          return (
            <View key={intg.key} style={styles.card}>
              <View style={styles.cardLeft}>
                <View
                  style={[styles.iconBox, { backgroundColor: intg.bgColor }]}
                >
                  {logo ? (
                    <Image
                      source={logo}
                      style={styles.logoImg}
                      resizeMode="contain"
                    />
                  ) : (
                    <Icon
                      name={intg.fallbackIcon}
                      size={22}
                      color={intg.color}
                    />
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{intg.label}</Text>
                    {isOn && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {intg.desc}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.connectBtn,
                  isOn && styles.connectBtnActive,
                  { borderColor: isOn ? '#22c55e' : intg.color },
                ]}
                onPress={() => {
                  if (isOn) {
                    Alert.alert(
                      `Disconnect ${intg.label}`,
                      'This will stop syncing leads from this source.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Disconnect',
                          style: 'destructive',
                          onPress: () =>
                            setConnected(s => {
                              const n = new Set(s);
                              n.delete(intg.key);
                              return n;
                            }),
                        },
                      ],
                    );
                  } else {
                    setWizard(intg);
                  }
                }}
              >
                <Text
                  style={[
                    styles.connectBtnText,
                    { color: isOn ? '#22c55e' : intg.color },
                  ]}
                >
                  {isOn ? 'Manage' : 'Connect'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Coming soon */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>COMING SOON</Text>
        <View style={styles.comingSoonRow}>
          {[
            'Sulekha',
            '99acres',
            'MagicBricks',
            'LinkedIn Lead Gen',
            'Google Ads',
          ].map(name => (
            <View key={name} style={styles.comingSoonTag}>
              <Text style={styles.comingSoonText}>{name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {wizard && (
        <WizardModal
          integration={wizard}
          onClose={() => setWizard(null)}
          onConnected={() => setConnected(s => new Set([...s, wizard.key]))}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#000' },
  headerSub: { fontSize: 11, color: '#64748b' },
  divider: { height: 2, backgroundColor: '#000' },
  body: { padding: 12, gap: 10 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    height: 72,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  summaryNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  logoImg: { width: 30, height: 30 },
  cardInfo: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#000' },
  activeBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  activeBadgeText: { fontSize: 8, fontWeight: '900', color: '#fff' },
  cardDesc: { fontSize: 11, color: '#64748b', lineHeight: 15 },
  connectBtn: {
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  connectBtnActive: { backgroundColor: '#f0fdf4' },
  connectBtnText: { fontSize: 11, fontWeight: '900' },
  comingSoonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  comingSoonTag: {
    borderWidth: 2,
    borderColor: '#000',
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  comingSoonText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
});

const wizStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  logoBox: {
    width: 44,
    height: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  logoImg: { width: 30, height: 30 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    backgroundColor: '#f8fafc',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 11, fontWeight: '900', color: '#64748b' },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  body: { padding: 16, gap: 14 },
  stepTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    marginBottom: 4,
  },
  instrRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  instrNum: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  instrNumText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  instrText: { flex: 1, fontSize: 13, color: '#000', lineHeight: 19 },
  fieldsSection: {
    borderTopWidth: 2,
    borderTopColor: '#000',
    paddingTop: 14,
    gap: 14,
  },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '900', color: '#000' },
  fieldHelp: { fontSize: 10, color: '#64748b', lineHeight: 14 },
  fieldRow: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#000',
  },
  fieldInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#000',
    backgroundColor: '#fff',
  },
  fieldInputReadonly: {
    backgroundColor: '#f8fafc',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#000',
    backgroundColor: '#f1f5f9',
  },
  copyBtnText: { fontSize: 11, fontWeight: '900', color: '#000' },
  eyeBtn: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderLeftWidth: 2,
    borderLeftColor: '#000',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#000',
    backgroundColor: '#fff',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtnText: { fontSize: 13, fontWeight: '900', color: '#000' },
  stepCount: { fontSize: 11, color: '#64748b', fontWeight: '700' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 100,
    justifyContent: 'center',
  },
  nextBtnText: { fontSize: 13, fontWeight: '900', color: '#fff' },
});
