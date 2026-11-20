import React, { useEffect, useState } from 'react';
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
  Linking,
  AppState,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';

import { Check, CheckCheck, ClockPlus } from 'lucide-react-native';
import {
  linkedinAdsAPI,
  googleAdsAPI,
  indiamartAPI,
  tradeindiaSyncAPI,
  justdialSyncAPI,
  facebookAPI,
  whatsappAPI,
  emailAPI,
  usersAPI,
} from '../services/api';
import { CountText } from '../components/motion';

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
  optional?: boolean;
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
    key: 'googleAds',
    label: 'Google Ads Lead Forms',
    desc: 'Capture leads from Google Ads Lead Form Extensions',
    fallbackIcon: 'logo-google',
    color: '#4285F4',
    bgColor: '#fff',
    steps: [], // handled by GoogleAdsSetupScreen (real OAuth), not the generic wizard
  },
  {
    key: 'linkedin',
    label: 'LinkedIn Lead Gen',
    desc: 'Capture leads from LinkedIn Lead Gen Forms',
    fallbackIcon: 'link-outline',
    color: '#0A66C2',
    bgColor: '#fff',
    steps: [], // handled by LinkedInSetupScreen (real OAuth), not the generic wizard
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
            key: 'profile_id',
            label: 'TradeIndia Profile ID (optional)',
            type: 'text',
            placeholder: 'Your TradeIndia Profile ID',
            optional: true,
          },
          {
            key: 'api_key',
            label: 'TradeIndia API Key',
            type: 'password',
            placeholder: 'Your TradeIndia API Key',
            help: 'Found alongside your User ID in API Settings',
          },
          {
            key: 'api_url',
            label: 'TradeIndia API Link',
            type: 'text',
            placeholder: 'https://...',
            help: 'The full API link shown on the same page',
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
            label: 'Justdial API Key (optional)',
            type: 'password',
            optional: true,
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
    label: 'Gmail',
    desc: 'Email leads from your Gmail and keep the thread in the CRM',
    logoKey: 'mail',
    fallbackIcon: 'mail-outline',
    color: '#64748b',
    bgColor: '#fff',
    steps: [
      {
        title: 'Configure SMTP Settings',
        subtitle: 'Step 1 of 2 — Enter Email address credentials',
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
  onSave,
}: {
  integration: Integration;
  onClose: () => void;
  onConnected: () => void;
  /** Saves the keys entered on a step to the server; throws on failure. */
  onSave?: (fields: Record<string, string>) => Promise<void>;
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
        f => f.type !== 'readonly' && !f.optional && !fields[f.key]?.trim(),
      );
      if (missing?.length) {
        Alert.alert('Required', `Please fill in: ${missing[0].label}`);
        return;
      }
      setSaving(true);
      try {
        if (onSave) await onSave(fields);
      } catch (e: any) {
        setSaving(false);
        Alert.alert('Could not connect', e?.message || 'Check the details and try again.');
        return;
      }
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
                    ? (field.value ?? '')
                    : (fields[field.key] ?? '');
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

// ─── Manage a connected source: lead assignment, new key, disconnect ─────────
const ASSIGN_API: Record<string, any> = {
  indiamart: indiamartAPI,
  tradeindia: tradeindiaSyncAPI,
  justdial: justdialSyncAPI,
  facebook: facebookAPI,
};
function ManageSheet({
  integration,
  onClose,
  onDisconnect,
  onUpdateKey,
}: {
  integration: Integration;
  onClose: () => void;
  onDisconnect: () => void;
  onUpdateKey: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [people, setPeople] = useState<any[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [batch, setBatch] = useState('1');
  const [saving, setSaving] = useState(false);
  const canAssign = !!ASSIGN_API[integration.key];
  const keyBased = ['indiamart', 'tradeindia', 'justdial'].includes(integration.key);

  useEffect(() => {
    if (!canAssign) return;
    usersAPI
      .getAll({ status: 'active' })
      .then(r => setPeople(r.data || []))
      .catch(() => {});
    const api = ASSIGN_API[integration.key];
    if (api.getStatus)
      api
        .getStatus()
        .then((r: any) => {
          const d = r.data || {};
          setIds((d.assigneeIds || []).map(String));
          if (d.assignBatchSize || d.batchSize) setBatch(String(d.assignBatchSize || d.batchSize));
        })
        .catch(() => {});
  }, [integration.key, canAssign]);

  const save = async () => {
    try {
      setSaving(true);
      await ASSIGN_API[integration.key].updateSettings(ids, Math.max(1, Number(batch) || 1));
      Alert.alert('Saved', `${integration.label} lead assignment updated.`);
      onClose();
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>{integration.label}</Text>
          <Text style={[styles.sheetSub, { color: '#16a34a' }]}>Connected</Text>
          {canAssign && (
            <>
              <Text style={[styles.sheetSub, { marginTop: 12, fontWeight: '600', color: '#000' }]}>
                Who gets these leads ({ids.length || 'everyone'})
              </Text>
              <ScrollView style={{ maxHeight: 220 }}>
                {people.map(u => {
                  const on = ids.includes(String(u._id));
                  return (
                    <TouchableOpacity
                      key={u._id}
                      style={[styles.sheetRow, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                      onPress={() => setIds(p => (on ? p.filter(x => x !== String(u._id)) : [...p, String(u._id)]))}
                    >
                      <Icon name={on ? 'checkmark-circle' : 'stop'} size={18} color={on ? '#024BAB' : '#94a3b8'} />
                      <Text style={styles.sheetRowText}>{u.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <Text style={[styles.sheetSub, { flex: 1 }]}>Leads in a row to each person</Text>
                <TextInput
                  style={{ borderWidth: 2, borderColor: '#000', width: 60, paddingVertical: 6, textAlign: 'center', color: '#000' }}
                  keyboardType="number-pad"
                  value={batch}
                  onChangeText={setBatch}
                />
              </View>
              <TouchableOpacity style={[styles.sheetPrimary, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Save assignment</Text>}
              </TouchableOpacity>
            </>
          )}
          {keyBased && (
            <TouchableOpacity style={styles.sheetCancel} onPress={onUpdateKey}>
              <Text style={{ fontWeight: '600', color: '#024BAB' }}>Update key</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.sheetCancel} onPress={onDisconnect}>
            <Text style={{ fontWeight: '600', color: '#dc2626' }}>Disconnect</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetCancel} onPress={onClose}>
            <Text style={{ fontWeight: '600', color: '#000' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function IntegrationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  // Real connection state from the server (was a hard-coded mock before).
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [wizard, setWizard] = useState<Integration | null>(null);
  const [manage, setManage] = useState<Integration | null>(null);
  const [waitingOAuth, setWaitingOAuth] = useState<'facebook' | 'email' | null>(null);
  const [fbPages, setFbPages] = useState<any[] | null>(null);

  const refreshStatus = async () => {
    const checks: [string, () => Promise<boolean>][] = [
      ['indiamart', async () => !!(await indiamartAPI.getStatus()).data?.connected],
      ['tradeindia', async () => !!(await tradeindiaSyncAPI.getStatus()).data?.connected],
      ['justdial', async () => !!(await justdialSyncAPI.getStatus()).data?.connected],
      ['facebook', async () => ((await facebookAPI.getConnectedPages()).data || []).length > 0],
      [
        'whatsapp',
        async () => {
          const d = (await whatsappAPI.getStatus()).data;
          return !!(d?.connected || d?.phoneNumbers?.length);
        },
      ],
      ['email', async () => !!(await emailAPI.getStatus()).data?.connected],
    ];
    const results = await Promise.all(checks.map(([k, f]) => f().then(v => [k, v] as const).catch(() => [k, false] as const)));
    setConnected(prev => {
      const n = new Set(prev);
      results.forEach(([k, v]) => (v ? n.add(k) : n.delete(k)));
      return n;
    });
  };

  useEffect(() => {
    refreshStatus();
    const unsub = navigation.addListener?.('focus', refreshStatus);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  // Facebook and Gmail consent happens in the browser; continue when the user comes back.
  useEffect(() => {
    if (!waitingOAuth) return;
    const sub = AppState.addEventListener('change', async st => {
      if (st !== 'active') return;
      if (waitingOAuth === 'facebook') {
        try {
          const r = await facebookAPI.getPages();
          if (r.data?.length) {
            setFbPages(r.data);
            setWaitingOAuth(null);
          }
        } catch {
          /* not authorised yet */
        }
      } else {
        await refreshStatus();
        setWaitingOAuth(null);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingOAuth]);

  const saveKeys = async (key: string, f: Record<string, string>) => {
    if (key === 'indiamart') await indiamartAPI.connect(f.api_key.trim());
    else if (key === 'tradeindia')
      await tradeindiaSyncAPI.connect(f.user_id.trim(), (f.profile_id || '').trim(), f.api_key.trim(), f.api_url.trim());
    else if (key === 'justdial') {
      const r = await justdialSyncAPI.connect((f.api_key || '').trim());
      if (r.data?.webhookUrl)
        Alert.alert('Give this link to Justdial', r.data.webhookUrl, [
          { text: 'Copy-friendly view', onPress: () => Alert.alert('Webhook URL', r.data.webhookUrl) },
          { text: 'OK' },
        ]);
    }
    await refreshStatus();
  };

  const startOAuth = async (which: 'facebook' | 'email') => {
    try {
      const r = which === 'facebook' ? await facebookAPI.getAuthUrl() : await emailAPI.getAuthUrl();
      const url = (r as any).data?.authUrl || (r as any).authUrl;
      if (!url) throw new Error('No sign-in link returned');
      setWaitingOAuth(which);
      Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Could not start sign-in', e.message);
    }
  };

  const connectFbPage = async (page: any) => {
    try {
      await facebookAPI.connectPage(page.id, []);
      setFbPages(null);
      await refreshStatus();
      Alert.alert('Facebook connected', `${page.name} is now syncing leads (all forms).`);
    } catch (e: any) {
      Alert.alert('Connection failed', e.message);
    }
  };

  const disconnect = async (key: string) => {
    try {
      if (key === 'indiamart') await indiamartAPI.disconnect();
      else if (key === 'tradeindia') await tradeindiaSyncAPI.disconnect();
      else if (key === 'justdial') await justdialSyncAPI.disconnect();
      else if (key === 'facebook') await facebookAPI.disconnect();
      else if (key === 'email') await emailAPI.disconnect();
      await refreshStatus();
    } catch (e: any) {
      Alert.alert("Couldn't disconnect", e.message);
    }
  };

  // LinkedIn/Google Ads connect real backend state (unlike the other cards'
  // local-only mock state) — refresh whenever the screen regains focus, e.g.
  // after returning from LinkedInSetup/GoogleAdsSetup.
  useEffect(() => {
    const checkReal = async () => {
      try {
        const li = await linkedinAdsAPI.getConnectedAccounts();
        setConnected(s => {
          const n = new Set(s);
          if (li.hasToken && li.data?.length) n.add('linkedin');
          else n.delete('linkedin');
          return n;
        });
      } catch {}
      try {
        const ga = await googleAdsAPI.getConnectedAccounts();
        setConnected(s => {
          const n = new Set(s);
          if (ga.hasToken && ga.data?.length) n.add('googleAds');
          else n.delete('googleAds');
          return n;
        });
      } catch {}
    };
    checkReal();
    const unsub = navigation.addListener?.('focus', checkReal);
    return unsub;
  }, [navigation]);

  const connectedCount = connected.size;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScreenHeader icon="link-outline" title="Integrations" onBack={() => navigation.goBack()} right={
          <>
        <View style={{ flex: 1 }}>
        </View>
          </>
        } />

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
                borderRadius: 8,
                borderColor: '#000',
              }}
            >
              <Check size={25} color="#22c55e" />
            </View>
            <View>
              <CountText style={styles.summaryNum}>{connectedCount}</CountText>
              <Text style={styles.summaryLabel}>Connected</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <View
              style={{
                backgroundColor: '#eff6ff',
                padding: 2,
                borderWidth: 2,
                borderRadius: 8,
                borderColor: '#000',
              }}
            >
              <ClockPlus size={25} color="#044bab" />
            </View>
            <View>
              <CountText style={styles.summaryNum}>
                {INTEGRATIONS.length - 1 - connectedCount}
              </CountText>
              <Text style={styles.summaryLabel}>Available</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <View
              style={{
                backgroundColor: '#fff7ed',
                padding: 2,
                borderWidth: 2,
                borderRadius: 8,
                borderColor: '#000',
              }}
            >
              <CheckCheck size={25} color="#e77b00" />
            </View>
            <View>
              <CountText style={styles.summaryNum}>{INTEGRATIONS.length - 1}</CountText>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ALL INTEGRATIONS</Text>

        {INTEGRATIONS.filter(i => i.key !== 'sms').map(intg => {
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
                  if (intg.key === 'linkedin') {
                    navigation.navigate('LinkedInSetup');
                    return;
                  }
                  if (intg.key === 'googleAds') {
                    navigation.navigate('GoogleAdsSetup');
                    return;
                  }
                  if (intg.key === 'whatsapp') {
                    navigation.navigate('WhatsAppSetup');
                    return;
                  }
                  if (isOn) {
                    setManage(intg);
                    return;
                  }
                  if (intg.key === 'facebook') startOAuth('facebook');
                  else if (intg.key === 'email') startOAuth('email');
                  else setWizard(intg);
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
          {['SMS', 'Sulekha', '99acres', 'MagicBricks'].map(name => (
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
          onConnected={refreshStatus}
          onSave={f => saveKeys(wizard.key, f)}
        />
      )}

      {/* Facebook: pick the page after signing in */}
      <Modal visible={!!fbPages} transparent animationType="slide" onRequestClose={() => setFbPages(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>Pick a Facebook page</Text>
            <Text style={styles.sheetSub}>Leads from all its forms will come in. Fine-tune forms and filters on the web.</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {(fbPages || []).map(p => (
                <TouchableOpacity key={p.id} style={styles.sheetRow} onPress={() => connectFbPage(p)}>
                  <Text style={styles.sheetRowText}>{p.name}</Text>
                  <Text style={styles.sheetSub}>{p.category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setFbPages(null)}>
              <Text style={{ fontWeight: '600', color: '#000' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {manage && (
        <ManageSheet
          integration={manage}
          onClose={() => setManage(null)}
          onDisconnect={() => {
            const k = manage.key;
            setManage(null);
            Alert.alert(`Disconnect ${manage.label}?`, 'Leads will stop coming in until you reconnect.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Disconnect', style: 'destructive', onPress: () => disconnect(k) },
            ]);
          }}
          onUpdateKey={() => {
            const intg = manage;
            setManage(null);
            if (['indiamart', 'tradeindia', 'justdial'].includes(intg.key)) setWizard(intg);
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopWidth: 2, borderColor: '#000', padding: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: '#000' },
  sheetSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  sheetRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sheetRowText: { fontSize: 14, color: '#000', fontWeight: '500' },
  sheetPrimary: { backgroundColor: '#024BAB', borderWidth: 2, borderColor: '#000', paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  sheetCancel: { borderWidth: 2, borderColor: '#000', paddingVertical: 11, alignItems: 'center', marginTop: 8 },
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
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '500', color: '#000' },
  headerSub: { fontSize: 11, color: '#64748b' },
  divider: { height: 2, backgroundColor: '#000' },
  body: { padding: 12, gap: 10 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    height: 72,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  summaryNum: {
    fontSize: 22,
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '500',
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
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
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
    borderRadius: 8,
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
  cardTitle: { fontSize: 14, fontWeight: '500', color: '#000' },
  activeBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  activeBadgeText: { fontSize: 8, fontWeight: '500', color: '#fff' },
  cardDesc: { fontSize: 11, color: '#64748b', lineHeight: 15 },
  connectBtn: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  connectBtnActive: { backgroundColor: '#f0fdf4' },
  connectBtnText: { fontSize: 11, fontWeight: '500' },
  comingSoonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  comingSoonTag: {
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  comingSoonText: { fontSize: 11, fontWeight: '500', color: '#94a3b8' },
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  logoImg: { width: 30, height: 30 },
  headerTitle: { fontSize: 16, fontWeight: '500', color: '#000' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderRadius: 8,
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
  stepNum: { fontSize: 11, fontWeight: '500', color: '#64748b' },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  body: { padding: 16, gap: 14 },
  stepTitle: {
    fontSize: 18,
    fontWeight: '500',
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
  instrNumText: { fontSize: 10, fontWeight: '500', color: '#fff' },
  instrText: { flex: 1, fontSize: 13, color: '#000', lineHeight: 19 },
  fieldsSection: {
    borderTopWidth: 2,
    borderTopColor: '#000',
    paddingTop: 14,
    gap: 14,
  },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: '#000' },
  fieldHelp: { fontSize: 10, color: '#64748b', lineHeight: 14 },
  fieldRow: {
    flexDirection: 'row',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
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
  copyBtnText: { fontSize: 11, fontWeight: '500', color: '#000' },
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
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtnText: { fontSize: 13, fontWeight: '500', color: '#000' },
  stepCount: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 100,
    justifyContent: 'center',
  },
  nextBtnText: { fontSize: 13, fontWeight: '500', color: '#fff' },
});
