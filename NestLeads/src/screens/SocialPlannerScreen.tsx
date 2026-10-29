import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  Linking,
  Image,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { socialAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { SourceLogo } from '../components/SourceBadge';
import { CountText } from '../components/motion';
import LeadsBarChart from '../components/LeadsBarChart';
import DateTimeField from '../components/DateTimeField';
import MediaUploadField from '../components/MediaUploadField';
import FollowersChart from '../components/FollowersChart';

const SCREEN_WIDTH = Dimensions.get('window').width;

const PRIMARY = '#024BAB';
const NB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 4, height: 4 },
  elevation: 4,
};

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; icon: string; label: string }
> = {
  DRAFT: {
    bg: '#e2e8f0',
    text: '#000',
    icon: 'create-outline',
    label: 'Draft',
  },
  PENDING_APPROVAL: {
    bg: '#fed7aa',
    text: '#92400e',
    icon: 'time-outline',
    label: 'Pending',
  },
  APPROVED: {
    bg: '#dbeafe',
    text: '#1e40af',
    icon: 'checkmark-circle-outline',
    label: 'Approved',
  },
  REJECTED: {
    bg: '#fee2e2',
    text: '#991b1b',
    icon: 'close-circle-outline',
    label: 'Rejected',
  },
  SCHEDULED: {
    bg: '#ede9fe',
    text: '#5b21b6',
    icon: 'calendar-outline',
    label: 'Scheduled',
  },
  POSTING: {
    bg: '#dbeafe',
    text: '#1e40af',
    icon: 'sync-outline',
    label: 'Posting…',
  },
  POSTED: {
    bg: '#dcfce7',
    text: '#166534',
    icon: 'checkmark-done-outline',
    label: 'Posted',
  },
  PARTIALLY_POSTED: {
    bg: '#fef9c3',
    text: '#713f12',
    icon: 'alert-circle-outline',
    label: 'Partial',
  },
  FAILED: {
    bg: '#fee2e2',
    text: '#991b1b',
    icon: 'alert-circle-outline',
    label: 'Failed',
  },
};

const EDITABLE = ['DRAFT', 'REJECTED', 'FAILED', 'PARTIALLY_POSTED'];

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) +
    ', ' +
    d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
const CAPTION_MAX = 2200;
const HASHTAG_MAX = 300;

function EditPostModal({
  post,
  visible,
  onClose,
  onSaved,
}: {
  post: any;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible && post) {
      setCaption(post.caption || '');
      setHashtags((post.hashtags || []).join(' '));
      setScheduledAt(
        post.scheduledAt ? new Date(post.scheduledAt) : new Date(),
      );
      setImageUrl(post.imageUrl || '');
      setVideoUrl(post.videoUrl || '');
      setCoverUrl(post.coverImageUrl || '');
      setMediaUrls(post.mediaUrls || []);
    }
  }, [visible, post]);

  if (!post) return null;
  const type = post.postType || 'image';
  const sc = STATUS_CONFIG[post.status] || STATUS_CONFIG.DRAFT;
  const busy = saving || deleting;
  const igPost = !!post.platforms?.includes('instagram');

  const save = async () => {
    if (!caption.trim()) {
      Alert.alert('Caption required');
      return;
    }
    const tags = hashtags
      .split(/[\s,]+/)
      .map(h => h.trim())
      .filter(Boolean)
      .map(h => (h.startsWith('#') ? h : `#${h}`));
    const payload: any = {
      caption: caption.trim(),
      hashtags: tags,
      scheduledAt: scheduledAt.toISOString(),
    };
    if (type === 'image') {
      if (!imageUrl) {
        Alert.alert('Image required', 'Upload an image for this post');
        return;
      }
      payload.imageUrl = imageUrl;
    }
    if (type === 'carousel') {
      if (mediaUrls.length < 2) {
        Alert.alert('At least 2 images', 'A carousel needs 2 or more images');
        return;
      }
      payload.mediaUrls = mediaUrls;
    }
    if (type === 'reel') {
      if (!videoUrl) {
        Alert.alert('Video required', 'Upload a video for this reel');
        return;
      }
      payload.videoUrl = videoUrl;
      payload.coverImageUrl = coverUrl;
    }
    try {
      setSaving(true);
      await socialAPI.updatePost(post._id, payload);
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Failed to save post', e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete post?', 'This permanently deletes the post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            await socialAPI.deletePost(post._id);
            onSaved();
            onClose();
          } catch (e: any) {
            Alert.alert('Failed to delete post', e.message);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  const Counter = ({ n, max }: { n: number; max: number }) => (
    <Text style={[styles.counter, n >= max && { color: '#dc2626' }]}>
      {n}/{max}
    </Text>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalContainer, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Icon name="close" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Post</Text>
          <View style={[styles.editStatus, { backgroundColor: sc.bg }]}>
            <Text style={[styles.editStatusText, { color: sc.text }]}>
              {sc.label.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.editBody}
        >
          {/* Media first */}
          <View style={styles.editCard}>
            <View style={styles.editCardHead}>
              <Icon
                name={type === 'reel' ? 'videocam-outline' : 'image-outline'}
                size={15}
                color="#000"
              />
              <Text style={styles.editCardTitle}>
                {type === 'carousel'
                  ? 'IMAGES (AT LEAST 2)'
                  : type === 'reel'
                  ? 'VIDEO & COVER'
                  : 'IMAGE'}
              </Text>
            </View>
            {type === 'image' && (
              <MediaUploadField
                kind="image"
                rule="feed"
                strict={igPost}
                value={imageUrl ? [imageUrl] : []}
                onChange={u => setImageUrl(u[0] || '')}
              />
            )}
            {type === 'carousel' && (
              <MediaUploadField
                kind="image"
                rule="feed"
                strict={igPost}
                multiple
                value={mediaUrls}
                onChange={setMediaUrls}
                label="Add image"
              />
            )}
            {type === 'reel' && (
              <View style={{ gap: 10 }}>
                <MediaUploadField
                  kind="video"
                  rule="reel"
                  value={videoUrl ? [videoUrl] : []}
                  onChange={u => setVideoUrl(u[0] || '')}
                />
                <MediaUploadField
                  kind="image"
                  value={coverUrl ? [coverUrl] : []}
                  onChange={u => setCoverUrl(u[0] || '')}
                  label="Upload cover (optional)"
                />
              </View>
            )}
          </View>

          {/* Caption */}
          <View style={styles.editCard}>
            <View style={styles.editCardHead}>
              <Icon name="document-text-outline" size={15} color="#000" />
              <Text style={styles.editCardTitle}>CAPTION *</Text>
            </View>
            <TextInput
              style={[
                styles.editInput,
                { height: 150, textAlignVertical: 'top' },
              ]}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={CAPTION_MAX}
              placeholder="Write a caption..."
              placeholderTextColor="#94a3b8"
            />
            <Counter n={caption.length} max={CAPTION_MAX} />
          </View>

          {/* Hashtags */}
          <View style={styles.editCard}>
            <View style={styles.editCardHead}>
              <Icon name="pricetag-outline" size={15} color="#000" />
              <Text style={styles.editCardTitle}>HASHTAGS</Text>
            </View>
            <TextInput
              style={[
                styles.editInput,
                { minHeight: 70, textAlignVertical: 'top' },
              ]}
              value={hashtags}
              onChangeText={setHashtags}
              multiline
              autoCapitalize="none"
              maxLength={HASHTAG_MAX}
              placeholder="#sale #newlaunch"
              placeholderTextColor="#94a3b8"
            />
            <Counter n={hashtags.length} max={HASHTAG_MAX} />
          </View>

          {/* Schedule */}
          <View style={styles.editCard}>
            <View style={styles.editCardHead}>
              <Icon name="calendar-outline" size={15} color="#000" />
              <Text style={styles.editCardTitle}>SCHEDULE *</Text>
            </View>
            <DateTimeField value={scheduledAt} onChange={setScheduledAt} />
          </View>

          {post.status !== 'DRAFT' && (
            <View style={styles.editNote}>
              <Icon
                name="information-circle-outline"
                size={15}
                color="#1e40af"
              />
              <Text style={styles.editNoteText}>
                Saving moves this post back to Draft so it can be submitted
                again.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.editBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.deleteBtn, busy && { opacity: 0.5 }]}
            onPress={remove}
            disabled={busy}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Icon name="trash-outline" size={18} color="#dc2626" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveBtn2,
              (busy || !caption.trim()) && { opacity: 0.5 },
            ]}
            onPress={save}
            disabled={busy || !caption.trim()}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>UPDATE POST</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function PostDetailModal({
  post,
  visible,
  isAdmin,
  onClose,
  onApprove,
  onReject,
  onPublishNow,
  onEdit,
}: {
  post: any;
  visible: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onPublishNow: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [captionOpen, setCaptionOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  useEffect(() => {
    setCaptionOpen(false);
    setFailOpen(false);
  }, [post?._id]);
  if (!post) return null;
  const canEdit = EDITABLE.includes(post.status);
  const longCaption =
    (post.caption || '').length > 140 ||
    (post.caption || '').split('\n').length > 3;
  const sc = STATUS_CONFIG[post.status] || STATUS_CONFIG.DRAFT;

  const fbLink = post.facebookPostId
    ? (() => {
        const parts = post.facebookPostId.split('_');
        return parts.length === 2
          ? `https://www.facebook.com/permalink.php?story_fbid=${parts[1]}&id=${parts[0]}`
          : `https://www.facebook.com/${post.facebookPostId}`;
      })()
    : null;
  const igLink = post.instagramPostId
    ? `https://www.instagram.com/p/${post.instagramPostId}/`
    : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Icon name="arrow-back" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Post Details</Text>
          {canEdit && (
            <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
              <Icon name="pencil-outline" size={14} color="#fff" />
              <Text style={styles.editBtnText}>EDIT</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.divider} />

        <ScrollView
          contentContainerStyle={[
            styles.modalBody,
            { paddingBottom: insets.bottom + 24 },
          ]}
        >
          {/* Media */}
          {post.imageUrl ? (
            <Image
              source={{ uri: post.imageUrl }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          ) : post.videoUrl ? (
            <View style={styles.videoPlaceholder}>
              <Icon name="videocam-outline" size={40} color="#94a3b8" />
              <Text style={styles.videoPlaceholderText}>Video Post</Text>
            </View>
          ) : null}

          {/* Carousel thumbnails */}
          {post.mediaUrls?.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.carouselRow}
            >
              {post.mediaUrls.map((url: string, i: number) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={styles.carouselThumb}
                />
              ))}
            </ScrollView>
          )}

          {/* Status + platforms + type — full-width badges */}
          <View style={styles.badgesFull}>
            <TouchableOpacity
              activeOpacity={post.failureReason ? 0.8 : 1}
              disabled={!post.failureReason}
              onPress={() => setFailOpen(true)}
              style={[styles.fullBadge, { backgroundColor: sc.bg }]}
            >
              <Icon name={sc.icon} size={14} color={sc.text} />
              <Text
                style={[styles.fullBadgeText, { color: sc.text }]}
                numberOfLines={1}
              >
                {sc.label}
              </Text>
              {!!post.failureReason && (
                <Icon
                  name="information-circle-outline"
                  size={13}
                  color={sc.text}
                />
              )}
            </TouchableOpacity>
            {post.platforms?.includes('facebook') && (
              <View style={[styles.fullBadge, { backgroundColor: '#dbeafe' }]}>
                <SourceLogo source="Facebook" size={20} />
                <Text
                  style={[styles.fullBadgeText, { color: '#1d4ed8' }]}
                  numberOfLines={1}
                >
                  Facebook
                </Text>
              </View>
            )}
            {post.platforms?.includes('instagram') && (
              <View style={[styles.fullBadge, { backgroundColor: '#ede9fe' }]}>
                <SourceLogo source="Instagram" size={20} />
                <Text
                  style={[styles.fullBadgeText, { color: '#7c3aed' }]}
                  numberOfLines={1}
                >
                  Instagram
                </Text>
              </View>
            )}
            {post.postType && (
              <View style={[styles.fullBadge, { backgroundColor: '#f1f5f9' }]}>
                <Icon
                  name={
                    post.postType === 'image'
                      ? 'image-outline'
                      : 'videocam-outline'
                  }
                  size={14}
                  color="#475569"
                />
                <Text
                  style={[styles.fullBadgeText, { color: '#475569' }]}
                  numberOfLines={1}
                >
                  {post.postType.charAt(0).toUpperCase() +
                    post.postType.slice(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Caption */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CAPTION</Text>
            <Text
              style={styles.captionText}
              numberOfLines={captionOpen || !longCaption ? undefined : 4}
            >
              {post.caption}
            </Text>
            {longCaption && (
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => setCaptionOpen(v => !v)}
              >
                <Text style={styles.moreBtnText}>
                  {captionOpen ? 'View less' : 'View more'}
                </Text>
                <Icon
                  name={captionOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={PRIMARY}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Hashtags */}
          {post.hashtags?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>HASHTAGS</Text>
              <Text style={styles.hashtagText}>
                {post.hashtags
                  .map((h: string) => (h.startsWith('#') ? h : `#${h}`))
                  .join(' ')}
              </Text>
            </View>
          )}

          {/* Meta grid */}
          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>SCHEDULED</Text>
              <Text style={styles.metaValue}>{fmt(post.scheduledAt)}</Text>
            </View>
            {post.createdBy?.name && (
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>CREATED BY</Text>
                <Text style={styles.metaValue}>{post.createdBy.name}</Text>
              </View>
            )}
            {post.approvedBy?.name && (
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>APPROVED BY</Text>
                <Text style={styles.metaValue}>{post.approvedBy.name}</Text>
              </View>
            )}
            {post.postedAt && (
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>POSTED AT</Text>
                <Text style={styles.metaValue}>{fmt(post.postedAt)}</Text>
              </View>
            )}
          </View>

          {/* Notes / reasons */}
          {post.approvalNote ? (
            <View
              style={[
                styles.alertBox,
                { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
              ]}
            >
              <Icon
                name="information-circle-outline"
                size={14}
                color="#1d4ed8"
              />
              <Text style={[styles.alertText, { color: '#1e40af' }]}>
                <Text style={{ fontWeight: '500' }}>Note: </Text>
                {post.approvalNote}
              </Text>
            </View>
          ) : null}
          {post.rejectionReason ? (
            <View
              style={[
                styles.alertBox,
                { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
              ]}
            >
              <Icon name="close-circle-outline" size={14} color="#dc2626" />
              <Text style={[styles.alertText, { color: '#991b1b' }]}>
                <Text style={{ fontWeight: '500' }}>Rejected: </Text>
                {post.rejectionReason}
              </Text>
            </View>
          ) : null}

          {/* Published links */}
          {(fbLink || igLink) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PUBLISHED LINKS</Text>
              {fbLink && (
                <TouchableOpacity
                  style={[
                    styles.linkBtn,
                    { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
                  ]}
                  onPress={() => Linking.openURL(fbLink)}
                >
                  <SourceLogo source="Facebook" size={16 + 6} />
                  <Text style={[styles.linkBtnText, { color: '#1d4ed8' }]}>
                    View on Facebook
                  </Text>
                  <Icon name="open-outline" size={14} color="#1d4ed8" />
                </TouchableOpacity>
              )}
              {igLink && (
                <TouchableOpacity
                  style={[
                    styles.linkBtn,
                    { backgroundColor: '#faf5ff', borderColor: '#c4b5fd' },
                  ]}
                  onPress={() => Linking.openURL(igLink)}
                >
                  <SourceLogo source="Instagram" size={16 + 6} />
                  <Text style={[styles.linkBtnText, { color: '#7c3aed' }]}>
                    View on Instagram
                  </Text>
                  <Icon name="open-outline" size={14} color="#7c3aed" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.linkBtn,
                  { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
                ]}
                onPress={() =>
                  Linking.openURL(
                    'https://business.facebook.com/latest/insights/posts/',
                  )
                }
              >
                <Icon name="bar-chart-outline" size={16} color="#64748b" />
                <Text style={[styles.linkBtnText, { color: '#64748b' }]}>
                  Analytics in Meta Business Suite
                </Text>
                <Icon name="open-outline" size={14} color="#64748b" />
              </TouchableOpacity>
            </View>
          )}

          {/* Admin actions */}
          {isAdmin && post.status === 'PENDING_APPROVAL' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: '#ef4444', borderColor: '#000', flex: 1 },
                ]}
                onPress={onReject}
              >
                <Icon name="thumbs-down-outline" size={14} color="#fff" />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                  Reject
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: '#22c55e', borderColor: '#000', flex: 1 },
                ]}
                onPress={onApprove}
              >
                <Icon name="thumbs-up-outline" size={14} color="#fff" />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                  Approve
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {isAdmin &&
            ['SCHEDULED', 'FAILED', 'APPROVED', 'PARTIALLY_POSTED'].includes(
              post.status,
            ) && (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: PRIMARY, borderColor: '#000' },
                ]}
                onPress={onPublishNow}
              >
                <Icon name="flash-outline" size={14} color="#fff" />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                  Post Now
                </Text>
              </TouchableOpacity>
            )}
        </ScrollView>

        <Modal
          visible={failOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setFailOpen(false)}
        >
          <View style={styles.failOverlay}>
            <View style={styles.failBox}>
              <View style={styles.failHead}>
                <Icon name="alert-circle-outline" size={20} color="#dc2626" />
                <Text style={styles.failTitle}>Post {sc.label}</Text>
                <TouchableOpacity
                  onPress={() => setFailOpen(false)}
                  hitSlop={10}
                >
                  <Icon name="close" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              <Text style={styles.failMsg} selectable>
                {post.failureReason}
              </Text>
              <TouchableOpacity
                style={styles.failBtn}
                onPress={() => setFailOpen(false)}
              >
                <Text style={styles.failBtnText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SocialPlannerScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [engagement, setEngagement] = useState<any>(null);
  const [followerDays, setFollowerDays] = useState<30 | 90 | 180>(30);
  const [followers, setFollowers] = useState<any>(null);
  const [followersLoading, setFollowersLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewingPost, setViewingPost] = useState<any>(null);
  const [editingPost, setEditingPost] = useState<any>(null);
  const justSaved = React.useRef(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const [postsRes, statsRes] = await Promise.all([
        socialAPI.getPosts(),
        socialAPI.getStats(),
      ]);
      setPosts(postsRes.data || []);
      setStats(statsRes.data);
      // Live from Meta — don't block the screen on it.
      socialAPI
        .getEngagement()
        .then(r => setEngagement(r.data))
        .catch(() => {});
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let live = true;
    setFollowersLoading(true);
    socialAPI
      .getFollowers(followerDays)
      .then(r => live && setFollowers(r.data))
      .catch(() => live && setFollowers(null))
      .finally(() => live && setFollowersLoading(false));
    return () => {
      live = false;
    };
  }, [followerDays]);

  const count = (st: string) => posts.filter(p => p.status === st).length;
  const summary = [
    {
      key: 'POSTED',
      label: 'POSTED',
      icon: 'checkmark-done-outline',
      color: '#16a34a',
      value: count('POSTED'),
    },
    {
      key: 'PENDING_APPROVAL',
      label: 'PENDING',
      icon: 'time-outline',
      color: '#f59e0b',
      value: count('PENDING_APPROVAL'),
    },
    {
      key: 'DRAFT',
      label: 'DRAFT',
      icon: 'create-outline',
      color: '#64748b',
      value: count('DRAFT'),
    },
    {
      key: 'REJECTED',
      label: 'REJECTED',
      icon: 'close-circle-outline',
      color: '#dc2626',
      value: count('REJECTED'),
    },
  ];

  const statusBreakdown = Object.keys(STATUS_CONFIG)
    .map(k => ({
      key: k,
      value: count(k),
      color: STATUS_CONFIG[k].text,
      label: STATUS_CONFIG[k].label,
    }))
    .filter(x => x.value > 0);
  const fbCount = posts.filter(p => p.platforms?.includes('facebook')).length;
  const igCount = posts.filter(p => p.platforms?.includes('instagram')).length;
  const typeCounts = ['image', 'carousel', 'reel'].map(t => ({
    label: t.toUpperCase(),
    value: posts.filter(p => (p.postType || 'image') === t).length,
  }));
  const publishedRate = posts.length
    ? Math.round((count('POSTED') / posts.length) * 100)
    : 0;
  const perDay = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - k));
    const next = d.getTime() + 86400000;
    return {
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      value: posts.filter(p => {
        const t = new Date(p.createdAt || p.scheduledAt || 0).getTime();
        return t >= d.getTime() && t < next;
      }).length,
    };
  });
  const upcoming = posts
    .filter(
      p =>
        ['SCHEDULED', 'APPROVED'].includes(p.status) &&
        new Date(p.scheduledAt).getTime() >= Date.now(),
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, 6);

  const handleApprove = (post: any) => {
    Alert.alert('Approve Post?', `Schedule for ${fmt(post.scheduledAt)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setActionLoading(true);
          try {
            await socialAPI.approvePost(post._id);
            setViewingPost(null);
            fetchData();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleReject = (post: any) => {
    Alert.prompt
      ? Alert.prompt(
          'Reject Post',
          'Reason for rejection:',
          async reason => {
            if (!reason?.trim()) return;
            setActionLoading(true);
            try {
              await socialAPI.rejectPost(post._id, reason.trim());
              setViewingPost(null);
              fetchData();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setActionLoading(false);
            }
          },
          'plain-text',
        )
      : Alert.alert('Reject Post', 'This will reject the post. Proceed?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              setActionLoading(true);
              try {
                await socialAPI.rejectPost(post._id, 'Rejected by admin');
                setViewingPost(null);
                fetchData();
              } catch (e: any) {
                Alert.alert('Error', e.message);
              } finally {
                setActionLoading(false);
              }
            },
          },
        ]);
  };

  const handlePublishNow = (post: any) => {
    Alert.alert('Post Now?', 'This will publish the post immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Post Now',
        onPress: async () => {
          setActionLoading(true);
          try {
            await socialAPI.publishPost(post._id);
            Alert.alert('Publishing started!', 'Check back in a minute.');
            setViewingPost(null);
            setTimeout(() => fetchData(), 4000);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const renderPost = ({ item: p }: { item: any }) => {
    const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setViewingPost(p)}
        activeOpacity={0.85}
      >
        <View style={styles.cardInner}>
          {/* Thumbnail */}
          {p.imageUrl ? (
            <Image source={{ uri: p.imageUrl }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Icon
                name={p.videoUrl ? 'videocam-outline' : 'image-outline'}
                size={20}
                color="#94a3b8"
              />
            </View>
          )}

          <View style={styles.cardBody}>
            {/* Status + platforms */}
            <View style={styles.badgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Icon name={sc.icon} size={10} color={sc.text} />
                <Text style={[styles.statusText, { color: sc.text }]}>
                  {sc.label.toUpperCase()}
                </Text>
              </View>
              {p.platforms?.includes('facebook') && (
                <SourceLogo source="Facebook" size={14 + 6} />
              )}
              {p.platforms?.includes('instagram') && (
                <SourceLogo source="Instagram" size={14 + 6} />
              )}
            </View>

            <Text style={styles.caption} numberOfLines={2}>
              {p.caption}
            </Text>

            {p.hashtags?.length > 0 && (
              <Text style={styles.hashtags} numberOfLines={1}>
                {p.hashtags
                  .map((h: string) => (h.startsWith('#') ? h : `#${h}`))
                  .join(' ')}
              </Text>
            )}

            <View style={styles.cardMeta}>
              <Icon name="calendar-outline" size={11} color="#94a3b8" />
              <Text style={styles.metaText}>{fmt(p.scheduledAt)}</Text>
              {p.createdBy?.name && (
                <>
                  <Icon name="person-outline" size={11} color="#94a3b8" />
                  <Text style={styles.metaText}>{p.createdBy.name}</Text>
                </>
              )}
            </View>

            {p.status === 'REJECTED' && p.rejectionReason && (
              <Text style={styles.errorText} numberOfLines={1}>
                ✕ {p.rejectionReason}
              </Text>
            )}
            {['FAILED', 'PARTIALLY_POSTED'].includes(p.status) &&
              p.failureReason && (
                <Text style={styles.errorText} numberOfLines={1}>
                  ✕ {p.failureReason}
                </Text>
              )}
            {['POSTED', 'PARTIALLY_POSTED'].includes(p.status) && (
              <View style={styles.postedRow}>
                <Icon name="checkmark-done-outline" size={12} color="#16a34a" />
                <Text style={styles.postedText}>
                  Posted {p.postedAt ? timeAgo(p.postedAt) : ''}
                  {p.facebookPostId ? '  FB ✓' : ''}
                  {p.instagramPostId ? '  IG ✓' : ''}
                </Text>
              </View>
            )}
          </View>

          <Icon name="chevron-forward" size={16} color="#cbd5e1" />
        </View>

        {/* Quick approve/reject bar for pending */}
        {isAdmin && p.status === 'PENDING_APPROVAL' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: '#fee2e2' }]}
              onPress={() => handleReject(p)}
              disabled={actionLoading}
            >
              <Icon name="thumbs-down-outline" size={13} color="#dc2626" />
              <Text style={[styles.quickBtnText, { color: '#dc2626' }]}>
                Reject
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: '#dcfce7' }]}
              onPress={() => handleApprove(p)}
              disabled={actionLoading}
            >
              <Icon name="thumbs-up-outline" size={13} color="#16a34a" />
              <Text style={[styles.quickBtnText, { color: '#16a34a' }]}>
                Approve
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={{ gap: 12 }}>
      {/* Followers graph */}
      <View style={styles.sumRow}>
        {summary.map(c => (
          <View key={c.key} style={styles.sumCard}>
            <View
              style={[
                styles.sumIcon,
                { backgroundColor: c.color + '1A', borderColor: c.color },
              ]}
            >
              <Icon name={c.icon} size={16} color={c.color} />
            </View>
            <CountText style={styles.sumValue}>{c.value}</CountText>
            <Text style={styles.sumLabel} numberOfLines={1}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>
      
      {/* Engagement cards */}
      <View style={styles.sumRow}>
        {[
          {
            key: 'pub',
            label: 'PUBLISHED',
            icon: 'checkmark-done-outline',
            color: '#16a34a',
            v: engagement?.totals?.published ?? count('POSTED'),
          },
          {
            key: 'views',
            label: 'VIEWS',
            icon: 'eye-outline',
            color: PRIMARY,
            v: engagement?.totals?.views,
          },
          {
            key: 'likes',
            label: 'LIKES',
            icon: 'heart-outline',
            color: '#e11d48',
            v: engagement?.totals?.likes,
          },
          {
            key: 'comments',
            label: 'COMMENTS',
            icon: 'chatbubble-outline',
            color: '#7c3aed',
            v: engagement?.totals?.comments,
          },
        ].map(c => (
          <View key={c.key} style={styles.sumCard}>
            <View
              style={[
                styles.sumIcon,
                { backgroundColor: c.color + '1A', borderColor: c.color },
              ]}
            >
              <Icon name={c.icon} size={16} color={c.color} />
            </View>
            {c.v === undefined ? (
              <Text style={styles.sumValue}>—</Text>
            ) : (
              <CountText style={styles.sumValue}>
                {c.v.toLocaleString('en-IN')}
              </CountText>
            )}
            <Text style={styles.sumLabel} numberOfLines={1}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.panel}>
        <View style={styles.folHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelLabel}>FOLLOWERS GAINED PER DAY</Text>
            <View style={styles.folTotals}>
              <CountText style={styles.folBig}>
                {(followers?.current ?? 0).toLocaleString('en-IN')}
              </CountText>
              <Text
                style={[
                  styles.folDelta,
                  {
                    color:
                      (followers?.gainedInRange ?? 0) < 0
                        ? '#dc2626'
                        : '#16a34a',
                  },
                ]}
              >
                {(followers?.gainedInRange ?? 0) >= 0 ? '+' : ''}
                {followers?.gainedInRange ?? 0} in range
              </Text>
            </View>
          </View>
          <View style={styles.rangeRow}>
            {(
              [
                [30, '1M'],
                [90, '3M'],
                [180, '6M'],
              ] as const
            ).map(([d, l]) => (
              <TouchableOpacity
                key={l}
                style={[
                  styles.rangeBtn,
                  followerDays === d && styles.rangeBtnOn,
                ]}
                onPress={() => setFollowerDays(d)}
              >
                <Text
                  style={[
                    styles.rangeText,
                    followerDays === d && { color: '#fff' },
                  ]}
                >
                  {l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {followersLoading ? (
          <ActivityIndicator style={{ marginVertical: 40 }} color={PRIMARY} />
        ) : followers?.points?.length ? (
          <FollowersChart
            data={followers.points}
            width={SCREEN_WIDTH - 24 - 28 - 4}
          />
        ) : (
          <Text style={[styles.muted, { paddingVertical: 24 }]}>
            Connect a Facebook or Instagram account to track followers.
          </Text>
        )}
      </View>
      <View style={styles.panel}>
        <Text style={styles.subLabel}>POSTS CREATED · LAST 7 DAYS</Text>
        <LeadsBarChart data={perDay} width={SCREEN_WIDTH - 24 - 28 - 4} />
      </View>

      {/* Upcoming scheduled posts */}
      <View style={styles.panel}>
        <Text style={styles.panelLabel}>UPCOMING SCHEDULED POSTS</Text>
        <View style={styles.tHead}>
          <Text style={[styles.tHeadText, { flex: 2.2 }]}>POST</Text>
          <Text style={[styles.tHeadText, { flex: 0.9 }]}>ON</Text>
          <Text style={[styles.tHeadText, { flex: 1.5, textAlign: 'right' }]}>
            WHEN
          </Text>
        </View>
        {upcoming.length === 0 ? (
          <Text style={[styles.muted, { paddingVertical: 12 }]}>
            No upcoming scheduled posts
          </Text>
        ) : (
          upcoming.map(p => (
            <TouchableOpacity
              key={p._id}
              style={styles.tRow}
              onPress={() => setViewingPost(p)}
            >
              <Text style={[styles.tCaption, { flex: 2.2 }]} numberOfLines={1}>
                {p.caption || '—'}
              </Text>
              <View style={[styles.tPlat, { flex: 0.9 }]}>
                {p.platforms?.includes('facebook') && (
                  <SourceLogo source="Facebook" size={14 + 6} />
                )}
                {p.platforms?.includes('instagram') && (
                  <SourceLogo source="Instagram" size={14 + 6} />
                )}
              </View>
              <Text
                style={[styles.tCell, { flex: 1.5, textAlign: 'right' }]}
                numberOfLines={2}
              >
                {fmt(p.scheduledAt)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Text style={styles.panelLabelPlain}>ALL POSTS</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('More')}
          hitSlop={10}
        >
          <Icon name="menu" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitleCenter}>Social Planner</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => fetchData(true)} hitSlop={10}>
            <Icon name="refresh-outline" size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.plusBtn}
            onPress={() => navigation.navigate('CreatePost')}
            accessibilityLabel="New post"
            activeOpacity={0.85}
          >
            <Icon name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p._id}
          renderItem={renderPost}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={PRIMARY}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Icon name="image-outline" size={44} color="#e2e8f0" />
              <Text style={styles.emptyTitle}>No posts</Text>
              <Text style={styles.emptySub}>Create posts from the web app</Text>
            </View>
          }
        />
      )}

      {/* Detail modal */}
      <PostDetailModal
        post={viewingPost}
        visible={!!viewingPost}
        isAdmin={isAdmin}
        onClose={() => setViewingPost(null)}
        onApprove={() => viewingPost && handleApprove(viewingPost)}
        onReject={() => viewingPost && handleReject(viewingPost)}
        onPublishNow={() => viewingPost && handlePublishNow(viewingPost)}
        onEdit={() => {
          setEditingPost(viewingPost);
          setViewingPost(null);
        }}
      />
      <EditPostModal
        post={editingPost}
        visible={!!editingPost}
        onClose={() => {
          // cancel returns to the post details
          if (!justSaved.current) setViewingPost(editingPost);
          justSaved.current = false;
          setEditingPost(null);
        }}
        onSaved={() => {
          justSaved.current = true;
          fetchData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  folHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  folTotals: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  folBig: { fontSize: 24, fontWeight: '500', color: '#000' },
  folDelta: { fontSize: 11, fontWeight: '500' },
  rangeRow: { flexDirection: 'row', gap: 6 },
  rangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderRadius: 6,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  rangeBtnOn: { backgroundColor: PRIMARY },
  rangeText: { fontSize: 11, fontWeight: '500', color: '#000' },
  engCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  typeRow: {
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  typeHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  typeName: { fontSize: 12, fontWeight: '500', color: '#000' },
  typeCount: { fontSize: 11, fontWeight: '500', color: '#64748b' },
  typeStats: { flexDirection: 'row', justifyContent: 'space-between' },
  typeStat: { fontSize: 13, fontWeight: '500', color: '#000' },
  editStatus: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 6,
  },
  editStatusText: { fontSize: 10, fontWeight: '500' },
  editBody: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
    backgroundColor: '#f8fafc',
  },
  editCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
  },
  editCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  editCardTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#000',
    letterSpacing: 1,
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  editNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#93c5fd',
    borderRadius: 8,
  },
  editNoteText: { flex: 1, fontSize: 12, fontWeight: '500', color: '#1e40af' },
  editBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 2,
    borderTopColor: '#000',
  },
  deleteBtn: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  saveBtn2: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FF751F',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  failOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  failBox: {
    backgroundColor: '#fff',
    padding: 18,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: '#000',
  },
  failHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  failTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#991b1b' },
  failMsg: {
    fontSize: 14,
    lineHeight: 20,
    color: '#991b1b',
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
  },
  failBtn: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  failBtnText: { fontSize: 13, fontWeight: '500', color: '#000' },
  badgesFull: { flexDirection: 'row', gap: 8 },
  fullBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  fullBadgeText: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  moreBtnText: { fontSize: 13, fontWeight: '500', color: PRIMARY },
  editBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
  },
  editBtnText: { fontSize: 11, fontWeight: '500', color: '#fff' },
  editLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    padding: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
  },
  editHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    fontWeight: '500',
  },
  saveBtn: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FF751F',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: '#000',
  },
  saveBtnText: { fontSize: 14, fontWeight: '500', color: '#fff' },
  headerTitleCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '500',
    color: '#000',
  },
  plusBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sumRow: { flexDirection: 'row', gap: 8 },
  sumCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
  },
  sumIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sumValue: { fontSize: 19, fontWeight: '500', color: '#000' },
  sumLabel: {
    fontSize: 8,
    fontWeight: '500',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  panel: {
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
  panelLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#000',
    letterSpacing: 1,
    marginBottom: 12,
  },
  panelLabelPlain: {
    fontSize: 11,
    fontWeight: '500',
    color: '#000',
    letterSpacing: 1,
    marginTop: 4,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  anRow: { flexDirection: 'row', gap: 8 },
  anBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  anBig: { fontSize: 22, fontWeight: '500', color: PRIMARY },
  anMid: { fontSize: 18, fontWeight: '500', color: '#000' },
  anSmall: {
    fontSize: 8,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  stack: {
    flexDirection: 'row',
    height: 14,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 4,
    overflow: 'hidden',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderWidth: 1.5, borderColor: '#000' },
  legendText: { fontSize: 11, fontWeight: '500', color: '#000' },
  platBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 6,
  },
  platText: { flex: 1, fontSize: 12, fontWeight: '500', color: '#000' },
  platCount: { fontSize: 16, fontWeight: '500', color: '#000' },
  muted: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  tHead: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  tHeadText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 4,
  },
  tCaption: { fontSize: 12, fontWeight: '500', color: '#000' },
  tPlat: { flexDirection: 'row', gap: 6 },
  tCell: { fontSize: 11, fontWeight: '500', color: '#334155' },
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
  headerActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  newPostBtnText: { fontSize: 11, fontWeight: '500', color: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '500', color: '#000' },
  headerSub: { fontSize: 11, color: '#64748b' },
  divider: { height: 2, backgroundColor: '#000' },
  thinDivider: { height: 1, backgroundColor: '#e2e8f0' },

  statsStrip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '500' },
  statLabel: {
    fontSize: 8,
    fontWeight: '500',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginTop: 1,
  },

  filterScroll: { flexGrow: 0, flexShrink: 0, height: 54 },
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterChip: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#e2e8f0',
  },
  filterChipActive: { borderColor: '#000', backgroundColor: PRIMARY },
  filterChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  filterChipTextActive: { color: '#fff' },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 10 },

  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
  },
  thumbPlaceholder: {
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 4 },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  statusText: { fontSize: 8, fontWeight: '500', textTransform: 'uppercase' },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  platformText: { fontSize: 9, fontWeight: '500' },
  typeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 8, fontWeight: '500', color: '#64748b' },

  caption: { fontSize: 13, color: '#000', lineHeight: 18 },
  hashtags: { fontSize: 11, color: '#7c3aed' },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  metaText: { fontSize: 10, color: '#94a3b8' },
  errorText: { fontSize: 11, color: '#dc2626', marginTop: 2 },
  postedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  postedText: { fontSize: 11, color: '#16a34a' },

  quickActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    gap: 5,
  },
  quickBtnText: { fontSize: 12, fontWeight: '500' },

  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '500', color: '#94a3b8' },
  emptySub: { fontSize: 12, color: '#cbd5e1' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '500', color: '#000' },
  modalBody: { padding: 16, gap: 16 },

  mediaImage: {
    width: '100%',
    height: 220,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
  },
  videoPlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPlaceholderText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  carouselRow: { marginBottom: 4 },
  carouselThumb: {
    width: 72,
    height: 72,
    marginRight: 8,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
  },

  section: { gap: 6 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  captionText: { fontSize: 14, color: '#000', lineHeight: 20 },
  hashtagText: { fontSize: 12, color: '#7c3aed', lineHeight: 18 },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaCell: { minWidth: '45%', gap: 3 },
  metaLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metaValue: { fontSize: 13, fontWeight: '500', color: '#000' },

  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderWidth: 1,
  },
  alertText: { flex: 1, fontSize: 13, lineHeight: 18 },

  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  linkBtnText: { flex: 1, fontSize: 13, fontWeight: '500' },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
  },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
});
