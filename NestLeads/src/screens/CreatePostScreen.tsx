import React, {useState, useEffect} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Alert, ActivityIndicator,
  Image, Platform, Modal, FlatList,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';
import Icon from '../components/Icon';
import {socialAPI, uploadFile} from '../services/api';

const PRIMARY = '#024BAB';
const ORANGE = '#FF751F';
const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 3, height: 3}, elevation: 3};

type PostType = 'image' | 'carousel' | 'reel';
type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Media', 'Caption', 'Accounts', 'Review'];

// ─── Date/Time Picker (simple inline) ────────────────────────────────────────
function DateTimePicker({value, onChange}: {value: Date; onChange: (d: Date) => void}) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState(value);

  const adjust = (field: string, delta: number) => {
    const d = new Date(draft);
    if (field === 'day')    d.setDate(d.getDate() + delta);
    if (field === 'month')  d.setMonth(d.getMonth() + delta);
    if (field === 'year')   d.setFullYear(d.getFullYear() + delta);
    if (field === 'hour')   d.setHours(d.getHours() + delta);
    if (field === 'minute') d.setMinutes(d.getMinutes() + delta);
    setDraft(d);
  };

  const label = value.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) + '  ' + value.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit', hour12: true});

  return (
    <>
      <TouchableOpacity style={styles.dtBtn} onPress={() => {setDraft(value); setShowModal(true);}}>
        <Icon name="calendar-outline" size={16} color={PRIMARY} />
        <Text style={styles.dtBtnText}>{label}</Text>
        <Icon name="chevron-down-outline" size={14} color="#64748b" />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.dtOverlay}>
          <View style={styles.dtModal}>
            <Text style={styles.dtTitle}>SELECT DATE & TIME</Text>

            {/* Date row */}
            <View style={styles.dtRow}>
              {(['day','month','year'] as const).map(field => (
                <View key={field} style={styles.dtCol}>
                  <TouchableOpacity onPress={() => adjust(field, 1)} style={styles.dtArrow}>
                    <Icon name="chevron-up" size={20} color="#000" />
                  </TouchableOpacity>
                  <Text style={styles.dtVal}>
                    {field === 'day'   ? pad(draft.getDate())
                    : field === 'month' ? pad(draft.getMonth() + 1)
                    :                    draft.getFullYear()}
                  </Text>
                  <TouchableOpacity onPress={() => adjust(field, -1)} style={styles.dtArrow}>
                    <Icon name="chevron-down" size={20} color="#000" />
                  </TouchableOpacity>
                  <Text style={styles.dtFieldLabel}>{field.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            <View style={styles.dtDivider} />

            {/* Time row */}
            <View style={styles.dtRow}>
              {(['hour','minute'] as const).map(field => (
                <View key={field} style={styles.dtCol}>
                  <TouchableOpacity onPress={() => adjust(field, 1)} style={styles.dtArrow}>
                    <Icon name="chevron-up" size={20} color="#000" />
                  </TouchableOpacity>
                  <Text style={styles.dtVal}>
                    {field === 'hour' ? pad(draft.getHours()) : pad(draft.getMinutes())}
                  </Text>
                  <TouchableOpacity onPress={() => adjust(field, -1)} style={styles.dtArrow}>
                    <Icon name="chevron-down" size={20} color="#000" />
                  </TouchableOpacity>
                  <Text style={styles.dtFieldLabel}>{field.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            <View style={styles.dtBtnRow}>
              <TouchableOpacity style={styles.dtCancel} onPress={() => setShowModal(false)}>
                <Text style={styles.dtCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dtConfirm} onPress={() => {onChange(draft); setShowModal(false);}}>
                <Text style={styles.dtConfirmText}>CONFIRM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreatePostScreen({navigation}: any) {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>(1);
  const [postType, setPostType] = useState<PostType>('image');

  // Media
  const [imageUri, setImageUri] = useState('');
  const [imageUrl, setImageUrl] = useState('');      // uploaded URL
  const [carouselUris, setCarouselUris] = useState<string[]>([]);
  const [carouselUrls, setCarouselUrls] = useState<string[]>([]);
  const [videoUri, setVideoUri] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [coverUri, setCoverUri] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Caption
  const [caption, setCaption] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);

  // Accounts
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Schedule
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });

  const [submitting, setSubmitting] = useState(false);

  // Load accounts when reaching step 3
  useEffect(() => {
    if (step === 3 && accounts.length === 0) {
      setLoadingAccounts(true);
      socialAPI.getAccounts()
        .then(res => setAccounts(res.data || []))
        .catch(e => Alert.alert('Error', e.message))
        .finally(() => setLoadingAccounts(false));
    }
  }, [step]);

  // ── Pickers ────────────────────────────────────────────────────────────────
  const pickMedia = (type: 'photo' | 'video', onDone: (uri: string, name: string, mime: string) => void) => {
    Alert.alert('Select Media', '', [
      {
        text: 'Camera', onPress: () => {
          launchCamera({mediaType: type, quality: 0.85, videoQuality: 'high'}, res => {
            if (res.assets?.[0]) {
              const a = res.assets[0];
              onDone(a.uri!, a.fileName || `media_${Date.now()}`, a.type || 'image/jpeg');
            }
          });
        },
      },
      {
        text: 'Gallery', onPress: () => {
          launchImageLibrary({mediaType: type, quality: 0.85, selectionLimit: type === 'photo' ? 1 : 1}, res => {
            if (res.assets?.[0]) {
              const a = res.assets[0];
              onDone(a.uri!, a.fileName || `media_${Date.now()}`, a.type || 'image/jpeg');
            }
          });
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const pickAndUpload = async (mediaType: 'photo' | 'video', slot: 'image' | 'video' | 'cover') => {
    pickMedia(mediaType, async (uri, name, mime) => {
      setUploading(true);
      try {
        const url = await uploadFile(uri, name, mime);
        if (slot === 'image')  {setImageUri(uri);  setImageUrl(url);}
        if (slot === 'video')  {setVideoUri(uri);  setVideoUrl(url);}
        if (slot === 'cover')  {setCoverUri(uri);  setCoverUrl(url);}
      } catch (e: any) {
        Alert.alert('Upload failed', e.message);
      } finally {
        setUploading(false);
      }
    });
  };

  const pickCarouselImage = async () => {
    if (carouselUris.length >= 10) {
      Alert.alert('Max 10 images in a carousel');
      return;
    }
    pickMedia('photo', async (uri, name, mime) => {
      setUploading(true);
      try {
        const url = await uploadFile(uri, name, mime);
        setCarouselUris(p => [...p, uri]);
        setCarouselUrls(p => [...p, url]);
      } catch (e: any) {
        Alert.alert('Upload failed', e.message);
      } finally {
        setUploading(false);
      }
    });
  };

  // ── Hashtag helpers ────────────────────────────────────────────────────────
  const addHashtag = () => {
    const raw = hashtagInput.trim().replace(/^#+/, '');
    if (!raw) return;
    const tag = `#${raw}`;
    if (!hashtags.includes(tag)) setHashtags(p => [...p, tag]);
    setHashtagInput('');
  };

  // ── Account selection ──────────────────────────────────────────────────────
  const toggleAccount = (acc: any) => {
    const id = acc._id;
    const platform = acc.platform;
    setSelectedAccountIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // Rebuild platforms list from selected accounts
      const selected = accounts.filter(a => next.includes(a._id));
      const plats = [...new Set(selected.map(a => a.platform))];
      setPlatforms(plats);
      return next;
    });
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const mediaValid = postType === 'image'
    ? !!imageUrl
    : postType === 'carousel'
    ? carouselUrls.length >= 2
    : !!videoUrl;

  const canNext = step === 1 ? mediaValid && !uploading
    : step === 2 ? caption.trim().length > 0
    : step === 3 ? selectedAccountIds.length > 0
    : true;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (asDraft = false) => {
    setSubmitting(true);
    try {
      const payload: any = {
        caption: caption.trim(),
        hashtags,
        platforms,
        accountIds: selectedAccountIds,
        postType,
        scheduledAt: scheduledAt.toISOString(),
        status: asDraft ? 'DRAFT' : 'PENDING_APPROVAL',
      };
      if (postType === 'image')    payload.imageUrl = imageUrl;
      if (postType === 'carousel') payload.mediaUrls = carouselUrls;
      if (postType === 'reel')     {payload.videoUrl = videoUrl; payload.coverImageUrl = coverUrl;}

      await socialAPI.createPost(payload);
      Alert.alert(
        asDraft ? 'Saved as Draft' : 'Submitted for Approval!',
        asDraft
          ? 'Post saved. You can edit and submit it later.'
          : 'Your post has been sent to the admin for approval.',
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step renderers ─────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.stepBody}>
      {/* Post type selector */}
      <Text style={styles.label}>POST TYPE</Text>
      <View style={styles.typeRow}>
        {(['image', 'carousel', 'reel'] as PostType[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, postType === t && styles.typeBtnActive]}
            onPress={() => setPostType(t)}>
            <Icon
              name={t === 'image' ? 'image-outline' : t === 'carousel' ? 'albums-outline' : 'videocam-outline'}
              size={18}
              color={postType === t ? '#fff' : '#64748b'}
            />
            <Text style={[styles.typeBtnText, postType === t && styles.typeBtnTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Image */}
      {postType === 'image' && (
        <View style={styles.mediaSection}>
          <Text style={styles.label}>IMAGE</Text>
          <TouchableOpacity style={styles.mediaBox} onPress={() => pickAndUpload('photo', 'image')} disabled={uploading}>
            {imageUri ? (
              <Image source={{uri: imageUri}} style={styles.mediaPreview} />
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Icon name="cloud-upload-outline" size={36} color="#94a3b8" />
                <Text style={styles.mediaPlaceholderText}>Tap to pick image</Text>
                <Text style={styles.mediaPlaceholderSub}>JPG, PNG, WEBP</Text>
              </View>
            )}
            {uploading && <View style={styles.uploadOverlay}><ActivityIndicator color="#fff" size="large" /></View>}
          </TouchableOpacity>
          {imageUrl ? (
            <View style={styles.uploadedRow}>
              <Icon name="checkmark-circle" size={14} color="#16a34a" />
              <Text style={styles.uploadedText}>Uploaded successfully</Text>
              <TouchableOpacity onPress={() => {setImageUri(''); setImageUrl('');}}>
                <Icon name="trash-outline" size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* Carousel */}
      {postType === 'carousel' && (
        <View style={styles.mediaSection}>
          <Text style={styles.label}>IMAGES (min 2, max 10)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carouselScroll}>
            {carouselUris.map((uri, i) => (
              <View key={i} style={styles.carouselSlot}>
                <Image source={{uri}} style={styles.carouselImg} />
                <TouchableOpacity
                  style={styles.carouselRemove}
                  onPress={() => {
                    setCarouselUris(p => p.filter((_, j) => j !== i));
                    setCarouselUrls(p => p.filter((_, j) => j !== i));
                  }}>
                  <Icon name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
            {carouselUris.length < 10 && (
              <TouchableOpacity style={styles.carouselAdd} onPress={pickCarouselImage} disabled={uploading}>
                {uploading
                  ? <ActivityIndicator color={PRIMARY} />
                  : <Icon name="add-circle-outline" size={32} color={PRIMARY} />}
                <Text style={styles.carouselAddText}>Add</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          <Text style={styles.hint}>{carouselUris.length} image(s) selected. Need at least 2.</Text>
        </View>
      )}

      {/* Reel */}
      {postType === 'reel' && (
        <View style={styles.mediaSection}>
          <Text style={styles.label}>VIDEO</Text>
          <TouchableOpacity style={styles.mediaBox} onPress={() => pickAndUpload('video', 'video')} disabled={uploading}>
            {videoUri ? (
              <View style={[styles.mediaPlaceholder, {backgroundColor: '#1e293b'}]}>
                <Icon name="videocam" size={40} color="#94a3b8" />
                <Text style={[styles.mediaPlaceholderText, {color: '#94a3b8'}]}>Video selected ✓</Text>
              </View>
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Icon name="cloud-upload-outline" size={36} color="#94a3b8" />
                <Text style={styles.mediaPlaceholderText}>Tap to pick video</Text>
                <Text style={styles.mediaPlaceholderSub}>MP4, MOV — max 50MB</Text>
              </View>
            )}
            {uploading && <View style={styles.uploadOverlay}><ActivityIndicator color="#fff" size="large" /></View>}
          </TouchableOpacity>

          <Text style={[styles.label, {marginTop: 16}]}>COVER IMAGE (optional)</Text>
          <TouchableOpacity style={[styles.mediaBox, {height: 100}]} onPress={() => pickAndUpload('photo', 'cover')} disabled={uploading}>
            {coverUri ? (
              <Image source={{uri: coverUri}} style={{width: '100%', height: '100%'}} resizeMode="cover" />
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Icon name="image-outline" size={24} color="#94a3b8" />
                <Text style={styles.mediaPlaceholderText}>Pick cover image</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepBody}>
      <Text style={styles.label}>CAPTION <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.captionInput}
        multiline
        numberOfLines={6}
        placeholder="Write your caption here..."
        placeholderTextColor="#94a3b8"
        value={caption}
        onChangeText={setCaption}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{caption.length} chars</Text>

      <Text style={[styles.label, {marginTop: 20}]}>HASHTAGS</Text>
      <View style={styles.hashRow}>
        <TextInput
          style={styles.hashInput}
          placeholder="#hashtag"
          placeholderTextColor="#94a3b8"
          value={hashtagInput}
          onChangeText={setHashtagInput}
          onSubmitEditing={addHashtag}
          returnKeyType="done"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.hashAddBtn} onPress={addHashtag}>
          <Icon name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {hashtags.length > 0 && (
        <View style={styles.tagWrap}>
          {hashtags.map(h => (
            <TouchableOpacity
              key={h}
              style={styles.tag}
              onPress={() => setHashtags(p => p.filter(x => x !== h))}>
              <Text style={styles.tagText}>{h}</Text>
              <Icon name="close" size={12} color="#7c3aed" />
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={styles.hint}>Tap a hashtag to remove it. Tap Add or press Enter to add.</Text>

      <Text style={[styles.label, {marginTop: 20}]}>SCHEDULE DATE & TIME</Text>
      <DateTimePicker value={scheduledAt} onChange={setScheduledAt} />
      <Text style={styles.hint}>Post will be published at this time after approval.</Text>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepBody}>
      <Text style={styles.label}>SELECT ACCOUNTS TO POST TO</Text>
      <Text style={styles.hint}>Tap accounts to select. You can pick multiple.</Text>

      {loadingAccounts ? (
        <View style={styles.centerBox}><ActivityIndicator color={PRIMARY} /></View>
      ) : accounts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Icon name="link-outline" size={40} color="#e2e8f0" />
          <Text style={styles.emptyTitle}>No accounts connected</Text>
          <Text style={styles.emptySub}>Connect Facebook/Instagram from Social Planner → Connected Accounts on the web app.</Text>
        </View>
      ) : (
        <View style={styles.accountList}>
          {accounts.map(acc => {
            const selected = selectedAccountIds.includes(acc._id);
            const isFb = acc.platform === 'facebook';
            return (
              <TouchableOpacity
                key={acc._id}
                style={[styles.accountCard, selected && styles.accountCardSelected]}
                onPress={() => toggleAccount(acc)}>
                <View style={[styles.accountIcon, {backgroundColor: isFb ? '#dbeafe' : '#faf5ff'}]}>
                  <Icon name={isFb ? 'logo-facebook' : 'logo-instagram'} size={20} color={isFb ? '#1d4ed8' : '#7c3aed'} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{acc.accountName}</Text>
                  <Text style={styles.accountPlatform}>{acc.platform === 'facebook' ? 'Facebook Page' : 'Instagram Business'}</Text>
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && <Icon name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderStep4 = () => {
    const selectedAccounts = accounts.filter(a => selectedAccountIds.includes(a._id));
    return (
      <View style={styles.stepBody}>
        <Text style={styles.label}>REVIEW YOUR POST</Text>

        {/* Media preview */}
        {postType === 'image' && imageUri ? (
          <Image source={{uri: imageUri}} style={styles.reviewImage} resizeMode="cover" />
        ) : postType === 'carousel' && carouselUris.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
            {carouselUris.map((u, i) => (
              <Image key={i} source={{uri: u}} style={styles.reviewCarouselImg} />
            ))}
          </ScrollView>
        ) : postType === 'reel' && videoUri ? (
          <View style={[styles.reviewImage, {backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center'}]}>
            <Icon name="videocam" size={48} color="#64748b" />
            <Text style={{color: '#64748b', marginTop: 8}}>Reel video ready</Text>
          </View>
        ) : null}

        <View style={styles.reviewCard}>
          <ReviewRow label="POST TYPE" value={postType.toUpperCase()} />
          <ReviewRow label="CAPTION" value={caption} />
          {hashtags.length > 0 && <ReviewRow label="HASHTAGS" value={hashtags.join(' ')} />}
          <ReviewRow
            label="SCHEDULED"
            value={scheduledAt.toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}) +
              ' at ' + scheduledAt.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit', hour12: true})}
          />
          <ReviewRow
            label="POSTING TO"
            value={selectedAccounts.map(a => a.accountName).join(', ')}
          />
        </View>

        <View style={styles.infoBox}>
          <Icon name="information-circle-outline" size={16} color={PRIMARY} />
          <Text style={styles.infoText}>
            Submitting will send this post for admin approval. It will be published at the scheduled time once approved.
            {'\n'}Or save as Draft to edit and submit later.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={18} color="#000" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>New Post</Text>
          <Text style={styles.headerSub}>Step {step} of 4 — {STEP_LABELS[step - 1]}</Text>
        </View>
      </View>
      <View style={styles.divider} />

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, {width: `${(step / 4) * 100}%`}]} />
      </View>

      {/* Step indicators */}
      <View style={styles.stepRow}>
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const active = n === step;
          return (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                {done
                  ? <Icon name="checkmark" size={12} color="#fff" />
                  : <Text style={[styles.stepNum, active && {color: '#fff'}]}>{n}</Text>}
              </View>
              <Text style={[styles.stepLabel, active && {color: PRIMARY, fontWeight: '800'}]}>{label}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.thinDivider} />

      {/* Step content */}
      <ScrollView style={styles.scroll} contentContainerStyle={{paddingBottom: insets.bottom + 120}} showsVerticalScrollIndicator={false}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>

      {/* Bottom navigation */}
      <View style={[styles.bottomBar, {paddingBottom: insets.bottom + 8}]}>
        {step > 1 ? (
          <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(s => (s - 1) as Step)}>
            <Icon name="arrow-back" size={16} color="#000" />
            <Text style={styles.prevBtnText}>BACK</Text>
          </TouchableOpacity>
        ) : <View style={{flex: 1}} />}

        {step < 4 ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canNext && styles.nextBtnDisabled]}
            onPress={() => canNext && setStep(s => (s + 1) as Step)}
            disabled={!canNext}>
            <Text style={styles.nextBtnText}>NEXT</Text>
            <Icon name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.submitBtns}>
            <TouchableOpacity
              style={styles.draftBtn}
              onPress={() => handleSubmit(true)}
              disabled={submitting}>
              <Icon name="save-outline" size={14} color="#000" />
              <Text style={styles.draftBtnText}>SAVE DRAFT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => handleSubmit(false)}
              disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Icon name="send-outline" size={14} color="#fff" />
                    <Text style={styles.submitBtnText}>SUBMIT</Text>
                  </>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function ReviewRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  divider: {height: 2, backgroundColor: '#000'},
  thinDivider: {height: 1, backgroundColor: '#e2e8f0'},

  progressTrack: {height: 3, backgroundColor: '#e2e8f0'},
  progressFill: {height: 3, backgroundColor: PRIMARY},

  stepRow: {flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'space-between'},
  stepItem: {alignItems: 'center', gap: 4},
  stepDot: {width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'},
  stepDotActive: {backgroundColor: PRIMARY, borderColor: PRIMARY},
  stepDotDone: {backgroundColor: '#22c55e', borderColor: '#22c55e'},
  stepNum: {fontSize: 11, fontWeight: '900', color: '#94a3b8'},
  stepLabel: {fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase'},

  scroll: {flex: 1},
  stepBody: {padding: 16, gap: 8},

  label: {fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4},
  required: {color: '#ef4444'},
  hint: {fontSize: 11, color: '#94a3b8', marginTop: 4},

  typeRow: {flexDirection: 'row', gap: 8, marginBottom: 20},
  typeBtn: {flex: 1, flexDirection: 'column', alignItems: 'center', paddingVertical: 12, gap: 4, borderWidth: 2, borderColor: '#e2e8f0'},
  typeBtnActive: {borderColor: '#000', backgroundColor: PRIMARY},
  typeBtnText: {fontSize: 10, fontWeight: '900', color: '#64748b'},
  typeBtnTextActive: {color: '#fff'},

  mediaSection: {gap: 8},
  mediaBox: {height: 180, borderWidth: 2, borderColor: '#000', borderStyle: 'dashed', overflow: 'hidden'},
  mediaPreview: {width: '100%', height: '100%'},
  mediaPlaceholder: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#f8fafc'},
  mediaPlaceholderText: {fontSize: 13, fontWeight: '700', color: '#94a3b8'},
  mediaPlaceholderSub: {fontSize: 11, color: '#cbd5e1'},
  uploadOverlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center'},
  uploadedRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  uploadedText: {flex: 1, fontSize: 12, color: '#16a34a'},

  carouselScroll: {marginVertical: 8},
  carouselSlot: {width: 80, height: 80, marginRight: 8, position: 'relative'},
  carouselImg: {width: 80, height: 80, borderWidth: 2, borderColor: '#000'},
  carouselRemove: {position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 10},
  carouselAdd: {width: 80, height: 80, borderWidth: 2, borderColor: PRIMARY, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4},
  carouselAddText: {fontSize: 10, fontWeight: '700', color: PRIMARY},

  captionInput: {borderWidth: 2, borderColor: '#000', padding: 12, fontSize: 14, color: '#000', minHeight: 120, backgroundColor: '#fafafa'},
  charCount: {fontSize: 10, color: '#94a3b8', textAlign: 'right'},
  hashRow: {flexDirection: 'row', gap: 8},
  hashInput: {flex: 1, borderWidth: 2, borderColor: '#000', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#000'},
  hashAddBtn: {width: 44, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000'},
  tagWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8},
  tag: {flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#faf5ff', borderWidth: 1, borderColor: '#c4b5fd', paddingHorizontal: 8, paddingVertical: 4},
  tagText: {fontSize: 12, color: '#7c3aed', fontWeight: '700'},

  dtBtn: {flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#000', padding: 12, backgroundColor: '#fff'},
  dtBtnText: {flex: 1, fontSize: 14, color: '#000', fontWeight: '700'},
  dtOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center'},
  dtModal: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', padding: 20, width: 300, ...NB_SHADOW},
  dtTitle: {fontSize: 12, fontWeight: '900', color: '#000', textAlign: 'center', marginBottom: 16, letterSpacing: 1},
  dtRow: {flexDirection: 'row', justifyContent: 'space-around', gap: 12},
  dtCol: {alignItems: 'center', gap: 4, flex: 1},
  dtArrow: {padding: 6},
  dtVal: {fontSize: 22, fontWeight: '900', color: '#000', minWidth: 50, textAlign: 'center'},
  dtFieldLabel: {fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1},
  dtDivider: {height: 1, backgroundColor: '#e2e8f0', marginVertical: 12},
  dtBtnRow: {flexDirection: 'row', gap: 10, marginTop: 16},
  dtCancel: {flex: 1, borderWidth: 2, borderColor: '#000', alignItems: 'center', paddingVertical: 10},
  dtCancelText: {fontSize: 12, fontWeight: '900', color: '#000'},
  dtConfirm: {flex: 1, backgroundColor: PRIMARY, borderWidth: 2, borderColor: '#000', alignItems: 'center', paddingVertical: 10},
  dtConfirmText: {fontSize: 12, fontWeight: '900', color: '#fff'},

  centerBox: {paddingTop: 40, alignItems: 'center'},
  emptyBox: {alignItems: 'center', paddingTop: 40, gap: 8, paddingHorizontal: 20},
  emptyTitle: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
  emptySub: {fontSize: 12, color: '#cbd5e1', textAlign: 'center', lineHeight: 18},
  accountList: {gap: 8, marginTop: 8},
  accountCard: {flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', padding: 12, gap: 12, backgroundColor: '#fff'},
  accountCardSelected: {borderColor: PRIMARY, backgroundColor: '#eff6ff'},
  accountIcon: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center'},
  accountInfo: {flex: 1},
  accountName: {fontSize: 14, fontWeight: '800', color: '#000'},
  accountPlatform: {fontSize: 11, color: '#64748b', marginTop: 1},
  checkbox: {width: 22, height: 22, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center'},
  checkboxSelected: {backgroundColor: PRIMARY, borderColor: PRIMARY},

  reviewImage: {width: '100%', height: 180, borderWidth: 2, borderColor: '#000', marginBottom: 12},
  reviewCarouselImg: {width: 80, height: 80, marginRight: 8, borderWidth: 2, borderColor: '#000'},
  reviewCard: {borderWidth: 2, borderColor: '#000', ...NB_SHADOW},
  reviewRow: {padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'},
  reviewLabel: {fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3},
  reviewValue: {fontSize: 13, color: '#000', lineHeight: 18},
  infoBox: {flexDirection: 'row', gap: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#93c5fd', padding: 12, marginTop: 12},
  infoText: {flex: 1, fontSize: 12, color: '#1e40af', lineHeight: 18},

  bottomBar: {borderTopWidth: 2, borderTopColor: '#000', paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 10, backgroundColor: '#fff'},
  prevBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: '#000', paddingVertical: 12},
  prevBtnText: {fontSize: 13, fontWeight: '900', color: '#000'},
  nextBtn: {flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: PRIMARY, borderWidth: 2, borderColor: '#000', paddingVertical: 12},
  nextBtnDisabled: {backgroundColor: '#94a3b8', borderColor: '#94a3b8'},
  nextBtnText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  submitBtns: {flex: 2, flexDirection: 'row', gap: 8},
  draftBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 2, borderColor: '#000', paddingVertical: 12},
  draftBtnText: {fontSize: 11, fontWeight: '900', color: '#000'},
  submitBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: ORANGE, borderWidth: 2, borderColor: '#000', paddingVertical: 12},
  submitBtnText: {fontSize: 11, fontWeight: '900', color: '#fff'},
});
