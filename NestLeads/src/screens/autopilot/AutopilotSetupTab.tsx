import React, {useEffect, useState} from 'react';
import {
  View, Text, ScrollView, RefreshControl, Switch, TextInput, TouchableOpacity, Image,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {
  autopilotAPI, saveAutopilotIntro, uploadAutopilotLogo, uploadAutopilotReference,
} from '../../services/api';
import {
  CONTENT_TYPES, MAX_REFERENCES, TIME_SLOTS_MAX, WEEKDAYS, accountTakenBy, campaignPill,
  competitorPayload, planPayload, scanStepIndex, scanSteps,
} from '../../lib/autopilot';
import {Card, Chip, Pill, PrimaryButton, SectionTitle} from '../../components/autopilot/ui';

const POSITIONS = [
  {id: 'top-left', label: 'Top left'},
  {id: 'top-right', label: 'Top right'},
  {id: 'bottom-left', label: 'Bottom left'},
  {id: 'bottom-right', label: 'Bottom right'},
];
const LANGUAGES = ['English', 'Hindi', 'Hinglish'];
const MAX_LOGOS = 5;

// Setup of ONE campaign, in the order the web wizard asks: settings and accounts, brand intro,
// references and competitors, scan, logos, then when and what to post.
export default function AutopilotSetupTab({
  overview,
  status,
  reloadStatus,
  reloadOverview,
  onDeleted,
}: {
  overview: any;
  status: any;
  reloadStatus: () => Promise<any>;
  reloadOverview: () => Promise<any>;
  onDeleted: () => void;
}) {
  const campaignId: string = status.campaign.id;
  const api = autopilotAPI.campaign(campaignId);
  const st = status.settings;
  const maxDays: number = status.limits?.daysPerWeek ?? 7;
  const accounts: any[] = status.accounts || [];
  const kit = status.brandKit;
  const profile = status.brandProfile || {};
  const refs: any[] = status.references || [];
  const rivals: any[] = status.competitors || [];
  const scanState: string = status.analysis?.status || 'idle';
  const hasIntro = !!(status.intro?.text?.trim() || status.intro?.pdfName);

  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState<string>(status.campaign.name);
  const [intro, setIntro] = useState<string>(status.intro?.text ?? '');
  const [savingIntro, setSavingIntro] = useState(false);
  const [selected, setSelected] = useState<string[]>(st.accountIds || []);
  const [savingAccounts, setSavingAccounts] = useState(false);
  const [scanStarting, setScanStarting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [rivalUser, setRivalUser] = useState('');
  const [rivalNotes, setRivalNotes] = useState('');
  const [addingRival, setAddingRival] = useState(false);
  const [plan, setPlan] = useState({
    days: st.schedule?.days?.length ? st.schedule.days.slice(0, maxDays) : WEEKDAYS.slice(0, maxDays).map(x => x.d),
    times: st.schedule?.times?.length ? [...st.schedule.times] : ['10:00'],
    contentTypes: st.contentTypes?.length ? st.contentTypes : Object.keys(CONTENT_TYPES),
    language: st.language || 'English',
    tone: st.tone || profile.tone || '',
    notes: st.notes || '',
    reviewFirst: !!st.reviewFirst,
  });

  // Follow a running scan.
  useEffect(() => {
    if (scanState !== 'running') return;
    const t = setInterval(reloadStatus, 1500);
    return () => clearInterval(t);
  }, [scanState, reloadStatus]);

  const fail = (e: any) => Alert.alert('Something went wrong', e?.message || 'Please try again');
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const refreshAll = () => Promise.all([reloadStatus(), reloadOverview()]);

  const saveName = async () => {
    try {
      await api.update({name: name.trim()});
      await refreshAll();
    } catch (e) {
      fail(e);
    }
  };

  const saveAccounts = async () => {
    setSavingAccounts(true);
    try {
      await api.update({accountIds: selected});
      await refreshAll();
    } catch (e) {
      fail(e);
    } finally {
      setSavingAccounts(false);
    }
  };

  const setEnabled = async (on: boolean) => {
    setEnabling(true);
    try {
      await api.update({enabled: on});
      await refreshAll();
      if (on) Alert.alert('Campaign is on', 'Your first post appears in the Dashboard queue for approval in a minute or two.');
    } catch (e) {
      fail(e);
    } finally {
      setEnabling(false);
    }
  };

  const deleteCampaign = () =>
    Alert.alert('Delete this campaign?', `${status.campaign.name}: its queued posts go back to drafts. Published posts stay.`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.remove();
            await reloadOverview();
            onDeleted();
          } catch (e) {
            fail(e);
          }
        },
      },
    ]);

  const saveIntro = async () => {
    setSavingIntro(true);
    try {
      await saveAutopilotIntro(campaignId, intro);
      await reloadStatus();
      Alert.alert('Saved', 'Autopilot will read this on the next scan.');
    } catch (e) {
      fail(e);
    } finally {
      setSavingIntro(false);
    }
  };

  const pickImage = (kind: 'logo' | 'reference') => {
    launchImageLibrary({mediaType: 'photo', quality: 0.9, selectionLimit: 1}, async res => {
      const a = res.assets?.[0];
      if (!a?.uri) return;
      setUploading(kind);
      try {
        const file = [a.uri, a.fileName || `${kind}_${Date.now()}.png`, a.type || 'image/png'] as const;
        if (kind === 'logo') await uploadAutopilotLogo(campaignId, ...file);
        else await uploadAutopilotReference(campaignId, ...file);
        await reloadStatus();
      } catch (e) {
        fail(e);
      } finally {
        setUploading(null);
      }
    });
  };

  const removeReference = (id: string) =>
    Alert.alert('Remove this reference image?', undefined, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteReference(id);
            await reloadStatus();
          } catch (e) {
            fail(e);
          }
        },
      },
    ]);

  const addRival = async () => {
    const out = competitorPayload(rivalUser, rivalNotes, rivals);
    if ('error' in out) {
      Alert.alert('Check the competitor', out.error);
      return;
    }
    setAddingRival(true);
    try {
      await api.addCompetitor(out.body);
      setRivalUser('');
      setRivalNotes('');
      await reloadStatus();
    } catch (e) {
      fail(e);
    } finally {
      setAddingRival(false);
    }
  };

  const removeRival = async (id: string) => {
    try {
      await api.deleteCompetitor(id);
      await reloadStatus();
    } catch (e) {
      fail(e);
    }
  };

  const scan = async () => {
    const chosen = accounts.filter(a => selected.includes(a._id));
    const account = chosen.find(a => a.platform === 'instagram') || chosen.find(a => a.platform === 'facebook');
    setScanStarting(true);
    try {
      // Save what was typed first so the scan reads it.
      if (intro.trim() !== (status.intro?.text ?? '').trim()) await saveAutopilotIntro(campaignId, intro);
      if ([...selected].sort().join() !== [...(st.accountIds || [])].sort().join()) await api.update({accountIds: selected});
      try {
        await api.analyze(account?._id);
      } catch (e: any) {
        if (e.status !== 429) throw e; // scanned a moment ago: just show that result
      }
      await refreshAll();
    } catch (e) {
      fail(e);
    } finally {
      setScanStarting(false);
    }
  };

  const brand = async (patch: Record<string, unknown>) => {
    try {
      await api.saveBrand(patch);
      await reloadStatus();
    } catch (e) {
      fail(e);
    }
  };

  const removeLogo = (l: any) =>
    Alert.alert('Delete logo?', l.name, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteLogo(l.id);
            await reloadStatus();
          } catch (e) {
            fail(e);
          }
        },
      },
    ]);

  const savePlan = async () => {
    const out = planPayload({...plan, accountIds: selected}, maxDays);
    if ('error' in out) {
      Alert.alert('Check your plan', out.error);
      return;
    }
    setSavingPlan(true);
    try {
      await api.update(out.body);
      await refreshAll();
      Alert.alert('Saved', 'Your posting plan is updated.');
    } catch (e) {
      fail(e);
    } finally {
      setSavingPlan(false);
    }
  };

  const pill = campaignPill(st.enabled, status.entitlement);
  const scanOpts = {intro: hasIntro, references: refs.length > 0, competitors: rivals.length > 0};
  const stepIdx = scanStepIndex(scanState, status.analysis?.stage || '', scanOpts);
  const steps = scanSteps(scanOpts);
  const accountsChanged = [...selected].sort().join() !== [...(st.accountIds || [])].sort().join();

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{padding: 16, paddingBottom: 60}}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refreshAll();
            setRefreshing(false);
          }}
          tintColor="#024BAB"
        />
      }>
      {/* campaign basics */}
      <Card>
        <View style={s.rowBetween}>
          <Pill text={pill.text} bg={pill.bg} fg={pill.fg} />
          <View style={s.row}>
            <Text style={s.label}>{st.enabled ? 'On' : 'Off'}</Text>
            <Switch
              accessibilityLabel="Autopilot on or off"
              value={st.enabled}
              disabled={enabling || (status.entitlement.state === 'expired' && !st.enabled) || (!st.enabled && !(st.accountIds || []).length)}
              onValueChange={setEnabled}
            />
          </View>
        </View>
        <Text style={s.muted}>
          {status.entitlement.state === 'trial'
            ? 'During your free trial every post waits for your approval. After it, Autopilot is included in your NestLeads plan.'
            : status.entitlement.state === 'paid'
              ? 'Autopilot is included in your NestLeads plan.'
              : 'Choose a NestLeads plan in Billing to use Autopilot.'}
        </Text>

        <Text style={[s.label, {marginTop: 12}]}>Campaign name</Text>
        <View style={s.row}>
          <TextInput style={[s.input, {flex: 1}]} value={name} maxLength={60} onChangeText={setName} accessibilityLabel="Campaign name" />
          <TouchableOpacity onPress={saveName} disabled={!name.trim() || name.trim() === status.campaign.name} style={{marginLeft: 8, opacity: !name.trim() || name.trim() === status.campaign.name ? 0.4 : 1}}>
            <Text style={s.link}>Rename</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.label, {marginTop: 12}]}>Posts to</Text>
        <Text style={s.muted}>An account can belong to one campaign only.</Text>
        {accounts.length === 0 ? (
          <Text style={[s.muted, {color: '#b45309'}]}>Connect a Facebook, Instagram or LinkedIn account first (Social Planner → Accounts).</Text>
        ) : (
          <View style={s.chips}>
            {accounts.map(a => {
              const taken = accountTakenBy(a, campaignId);
              return (
                <Chip
                  key={a._id}
                  label={taken ? `${a.platform} · ${a.accountName} (used by ${taken})` : `${a.platform} · ${a.accountName}`}
                  active={selected.includes(a._id)}
                  disabled={!!taken}
                  onPress={() => setSelected(toggle(selected, a._id))}
                />
              );
            })}
          </View>
        )}
        {accountsChanged ? (
          <View style={{marginTop: 4}}>
            <PrimaryButton label={savingAccounts ? 'Saving…' : 'Save accounts'} outline onPress={saveAccounts} disabled={savingAccounts} />
          </View>
        ) : null}

        <TouchableOpacity onPress={deleteCampaign} style={{marginTop: 14}}>
          <Text style={s.delete}>Delete this campaign</Text>
        </TouchableOpacity>
      </Card>

      {/* 1. intro */}
      <Card>
        <SectionTitle title="1. Tell us about your brand" sub="What you do, who your customers are, how you like to sound." />
        <TextInput
          style={[s.input, {minHeight: 110}]}
          multiline
          maxLength={4000}
          value={intro}
          onChangeText={setIntro}
          placeholder="e.g. We are a family-run bakery in Ahmedabad making slow-fermented sourdough..."
          placeholderTextColor="#94a3b8"
          accessibilityLabel="Tell us about your brand"
        />
        <Text style={s.count}>{intro.length}/4000</Text>
        {status.intro?.pdfName ? <Text style={s.muted}>Document on file: {status.intro.pdfName}</Text> : null}
        <Text style={s.muted}>To import a PDF (brand book, company profile), use the web app.</Text>
        <View style={{marginTop: 10}}>
          <PrimaryButton label={savingIntro ? 'Saving…' : 'Save intro'} outline onPress={saveIntro} disabled={savingIntro} />
        </View>
      </Card>

      {/* 2. references and competitors */}
      <Card>
        <SectionTitle title="2. References and competitors" sub="Show Autopilot the look you like and who you compete with. Both are read by the next scan." />
        <Text style={s.label}>Reference images ({refs.length}/{MAX_REFERENCES})</Text>
        <View style={s.chips}>
          {refs.map(r => (
            <TouchableOpacity key={r.id} onLongPress={() => removeReference(r.id)} onPress={() => removeReference(r.id)} accessibilityLabel="Remove reference image">
              <Image source={{uri: r.url}} style={s.refThumb} />
            </TouchableOpacity>
          ))}
        </View>
        {refs.length ? <Text style={s.muted}>Tap an image to remove it.</Text> : null}
        {refs.length < MAX_REFERENCES ? (
          <View style={{marginTop: 6}}>
            <PrimaryButton label={uploading === 'reference' ? 'Uploading…' : 'Add a reference image'} outline onPress={() => pickImage('reference')} disabled={uploading === 'reference'} />
          </View>
        ) : null}

        <Text style={[s.label, {marginTop: 14}]}>Competitors ({rivals.length}/5)</Text>
        <Text style={s.muted}>
          With an Instagram username Autopilot reads their public posts (public Business or Creator accounts only). Notes are your own words.
        </Text>
        {rivals.map(c => (
          <View key={c.id} style={s.rival}>
            <View style={s.rowBetween}>
              <Text style={s.logoName}>{c.username ? `@${c.username}` : 'Notes only'}{c.followers != null ? ` · ${Number(c.followers).toLocaleString('en-IN')} followers` : ''}</Text>
              <TouchableOpacity onPress={() => removeRival(c.id)} accessibilityLabel={`Remove ${c.username || 'competitor'}`}>
                <Text style={s.delete}>Remove</Text>
              </TouchableOpacity>
            </View>
            {c.notes ? <Text style={s.muted}>{c.notes}</Text> : null}
            {c.error ? <Text style={[s.muted, {color: '#b45309'}]}>{c.error}</Text> : null}
          </View>
        ))}
        {rivals.length < 5 ? (
          <View style={{marginTop: 8}}>
            <TextInput style={s.input} value={rivalUser} maxLength={31} autoCapitalize="none" onChangeText={setRivalUser} placeholder="@instagram_username" placeholderTextColor="#94a3b8" accessibilityLabel="Competitor Instagram username" />
            <TextInput style={[s.input, {marginTop: 8}]} value={rivalNotes} maxLength={500} onChangeText={setRivalNotes} placeholder="What they do, what you like or dislike (optional)" placeholderTextColor="#94a3b8" accessibilityLabel="Notes about the competitor" />
            <View style={{marginTop: 8}}>
              <PrimaryButton label={addingRival ? 'Adding…' : 'Add competitor'} outline onPress={addRival} disabled={addingRival || (!rivalUser.trim() && !rivalNotes.trim())} />
            </View>
          </View>
        ) : null}
      </Card>

      {/* 3. scan */}
      <Card>
        <SectionTitle title="3. Scan your profile" sub="Autopilot studies your Instagram or Facebook, your references and your competitors, then writes the brand profile." />
        {scanState === 'running' ? (
          <View style={{marginTop: 4}}>
            {steps.map((step, i) => (
              <View key={step.key} style={s.row}>
                {i < stepIdx ? (
                  <Text style={s.tick}>✓</Text>
                ) : i === stepIdx ? (
                  <ActivityIndicator size="small" color="#024BAB" style={{marginRight: 8}} />
                ) : (
                  <Text style={[s.tick, {color: '#cbd5e1'}]}>○</Text>
                )}
                <Text style={[s.stepText, i > stepIdx && {color: '#94a3b8'}]}>{step.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <PrimaryButton
            label={scanStarting ? 'Starting…' : scanState === 'done' ? 'Scan again' : 'Scan my profile'}
            onPress={scan}
            disabled={scanStarting || !status.configured || !selected.length}
          />
        )}
        {!selected.length ? <Text style={s.muted}>Choose this campaign's account(s) above first.</Text> : null}
        {scanState === 'failed' ? <Text style={s.error}>The scan failed: {status.analysis.error}</Text> : null}
        {status.analysis?.note ? <Text style={[s.muted, {color: '#b45309'}]}>{status.analysis.note}</Text> : null}
        {!status.configured ? <Text style={s.muted}>Autopilot isn't switched on for this server yet.</Text> : null}

        {profile.summary ? (
          <View style={s.profile}>
            <Text style={s.profileTitle}>What we understood</Text>
            <Text style={s.profileText}>{profile.summary}</Text>
            {profile.tone ? <Text style={s.profileText}>Tone: {profile.tone}</Text> : null}
            {profile.audience ? <Text style={s.profileText}>Audience: {profile.audience}</Text> : null}
            {profile.contentPillars?.length ? <Text style={s.profileText}>Themes: {profile.contentPillars.join(', ')}</Text> : null}
            {profile.competitive?.positioning ? <Text style={s.profileText}>Standing apart: {profile.competitive.positioning}</Text> : null}
            {profile.competitive?.gapsToExploit?.length ? <Text style={s.profileText}>Gaps to use: {profile.competitive.gapsToExploit.join(', ')}</Text> : null}
            {profile.palette?.length ? (
              <View style={[s.row, {marginTop: 6}]}>
                {profile.palette.map((c: string) => (
                  <View key={c} style={[s.swatch, {backgroundColor: c}]} />
                ))}
              </View>
            ) : null}
            <Text style={s.muted}>Edit these details in the web app.</Text>
          </View>
        ) : null}
      </Card>

      {/* 4. logos */}
      <Card>
        <SectionTitle title="4. Your logos" sub="Add every logo you use (for example a dark and a light one). Autopilot stamps one on each image." />
        {kit.logos.map((l: any) => (
          <View key={l.id} style={s.logoRow}>
            <Image source={{uri: l.url}} style={s.logo} resizeMode="contain" />
            <View style={{flex: 1, marginLeft: 10}}>
              <Text style={s.logoName} numberOfLines={1}>{l.name}</Text>
              {kit.logoId === l.id ? <Text style={s.muted}>Used on posts</Text> : (
                <TouchableOpacity onPress={() => brand({logoId: l.id})}>
                  <Text style={s.link}>Use this logo</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => removeLogo(l)} accessibilityLabel={`Delete ${l.name}`}>
              <Text style={s.delete}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}
        {kit.logos.length < MAX_LOGOS ? (
          <PrimaryButton label={uploading === 'logo' ? 'Uploading…' : 'Add a logo'} outline onPress={() => pickImage('logo')} disabled={uploading === 'logo'} />
        ) : null}
        {kit.logos.length ? (
          <>
            <View style={[s.rowBetween, {marginTop: 12}]}>
              <Text style={s.label}>Put my logo on every image</Text>
              <Switch value={kit.logoEnabled} onValueChange={v => brand({logoEnabled: v})} />
            </View>
            {kit.logos.length > 1 ? (
              <View style={s.rowBetween}>
                <Text style={[s.label, {flex: 1, paddingRight: 8}]}>Pick the best logo for each image</Text>
                <Switch value={kit.logoMode === 'auto'} disabled={!kit.logoEnabled} onValueChange={v => brand({logoMode: v ? 'auto' : 'fixed'})} />
              </View>
            ) : null}
            <Text style={[s.label, {marginTop: 8}]}>Position</Text>
            <View style={s.chips}>
              {POSITIONS.map(p => (
                <Chip key={p.id} label={p.label} active={kit.logoPosition === p.id} disabled={!kit.logoEnabled} onPress={() => brand({logoPosition: p.id})} />
              ))}
            </View>
          </>
        ) : null}
      </Card>

      {/* 5. plan */}
      <Card>
        <SectionTitle title="5. When and what to post" sub={`Your plan allows up to ${maxDays} posting day${maxDays === 1 ? '' : 's'} a week per campaign. Times are India time.`} />
        <Text style={s.label}>Days</Text>
        <View style={s.chips}>
          {WEEKDAYS.map(({d, label}) => (
            <Chip
              key={d}
              label={label}
              active={plan.days.includes(d)}
              disabled={!plan.days.includes(d) && plan.days.length >= maxDays}
              onPress={() => setPlan({...plan, days: toggle(plan.days, d)})}
            />
          ))}
        </View>
        <Text style={s.label}>Times (24-hour, like 10:00)</Text>
        <View style={s.chips}>
          {plan.times.map((tm: string, i: number) => (
            <View key={i} style={s.row}>
              <TextInput
                style={[s.input, s.timeInput]}
                value={tm}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel={`Post time ${i + 1}`}
                onChangeText={v => setPlan({...plan, times: plan.times.map((x: string, j: number) => (j === i ? v : x))})}
              />
              {plan.times.length > 1 ? (
                <TouchableOpacity onPress={() => setPlan({...plan, times: plan.times.filter((_: string, j: number) => j !== i)})}>
                  <Text style={s.delete}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {plan.times.length < TIME_SLOTS_MAX ? (
            <Chip label="+ Add a time" active={false} onPress={() => setPlan({...plan, times: [...plan.times, '18:00']})} />
          ) : null}
        </View>
        <Text style={s.label}>What to post</Text>
        <View style={s.chips}>
          {Object.entries(CONTENT_TYPES).map(([k, label]) => (
            <Chip key={k} label={label} active={plan.contentTypes.includes(k)} onPress={() => setPlan({...plan, contentTypes: toggle(plan.contentTypes, k)})} />
          ))}
        </View>
        <Text style={s.label}>Language</Text>
        <View style={s.chips}>
          {LANGUAGES.map(l => (
            <Chip key={l} label={l} active={plan.language === l} onPress={() => setPlan({...plan, language: l})} />
          ))}
        </View>
        <Text style={s.label}>Brand tone (optional)</Text>
        <TextInput style={s.input} value={plan.tone} maxLength={200} onChangeText={v => setPlan({...plan, tone: v})} placeholder="e.g. friendly, professional" placeholderTextColor="#94a3b8" />
        <Text style={[s.label, {marginTop: 10}]}>Topics to focus on or avoid (optional)</Text>
        <TextInput style={[s.input, {minHeight: 70}]} multiline value={plan.notes} maxLength={500} onChangeText={v => setPlan({...plan, notes: v})} placeholderTextColor="#94a3b8" />
        <View style={[s.rowBetween, {marginVertical: 10}]}>
          <View style={{flex: 1, paddingRight: 8}}>
            <Text style={s.label}>Always ask me before posting</Text>
            <Text style={s.muted}>
              {status.entitlement.state === 'paid'
                ? 'Off = posts go out on their own.'
                : 'During the free trial every post waits for your approval anyway.'}
            </Text>
          </View>
          <Switch value={plan.reviewFirst} onValueChange={v => setPlan({...plan, reviewFirst: v})} />
        </View>
        <PrimaryButton label={savingPlan ? 'Saving…' : 'Save posting plan'} onPress={savePlan} disabled={savingPlan} />
      </Card>

      {/* launch */}
      {!st.enabled ? (
        <Card>
          <SectionTitle title="6. Turn on this campaign" sub="We create your first post right away. You approve it (and can ask for changes) before anything goes live." />
          <PrimaryButton label={enabling ? 'Turning on…' : 'Turn on'} onPress={() => setEnabled(true)} disabled={enabling || !(st.accountIds || []).length} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center'},
  rowBetween: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  label: {fontSize: 13, fontWeight: '800', color: '#000', marginTop: 4, marginBottom: 6},
  muted: {fontSize: 12, color: '#64748b', marginTop: 6},
  error: {fontSize: 12, color: '#b91c1c', marginTop: 8},
  count: {fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 2},
  input: {borderWidth: 2, borderColor: '#000', padding: 10, fontSize: 14, color: '#000', textAlignVertical: 'top', backgroundColor: '#fff'},
  timeInput: {width: 90, marginRight: 6, marginBottom: 8, textAlign: 'center', textAlignVertical: 'center'},
  chips: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center'},
  tick: {width: 24, fontSize: 15, color: '#16a34a', fontWeight: '600'},
  stepText: {fontSize: 13, color: '#000', paddingVertical: 4},
  profile: {marginTop: 14, borderTopWidth: 2, borderTopColor: '#e2e8f0', paddingTop: 10},
  profileTitle: {fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 4},
  profileText: {fontSize: 12, color: '#334155', marginBottom: 3},
  swatch: {width: 22, height: 22, borderWidth: 2, borderColor: '#000', marginRight: 6},
  logoRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  logo: {width: 54, height: 54, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f1f5f9'},
  logoName: {fontSize: 13, fontWeight: '700', color: '#000'},
  link: {fontSize: 12, color: '#024BAB', fontWeight: '800', marginTop: 4},
  delete: {fontSize: 12, color: '#b91c1c', fontWeight: '800', paddingHorizontal: 6},
  refThumb: {width: 64, height: 64, borderWidth: 2, borderColor: '#000', marginRight: 8, marginBottom: 8, backgroundColor: '#e2e8f0'},
  rival: {borderWidth: 1, borderColor: '#e2e8f0', padding: 8, marginTop: 8},
});
