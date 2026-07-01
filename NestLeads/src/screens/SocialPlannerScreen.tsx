import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, RefreshControl, Alert,
  Modal, ScrollView, Linking, Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {socialAPI} from '../services/api';
import {useAuth} from '../contexts/AuthContext';

const PRIMARY = '#024BAB';
const NB_SHADOW = {shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: {width: 4, height: 4}, elevation: 4};

const STATUS_CONFIG: Record<string, {bg: string; text: string; icon: string; label: string}> = {
  DRAFT:            {bg: '#e2e8f0', text: '#000', icon: 'create-outline',          label: 'Draft'},
  PENDING_APPROVAL: {bg: '#fed7aa', text: '#92400e', icon: 'time-outline',         label: 'Pending'},
  APPROVED:         {bg: '#dbeafe', text: '#1e40af', icon: 'checkmark-circle-outline', label: 'Approved'},
  REJECTED:         {bg: '#fee2e2', text: '#991b1b', icon: 'close-circle-outline', label: 'Rejected'},
  SCHEDULED:        {bg: '#ede9fe', text: '#5b21b6', icon: 'calendar-outline',     label: 'Scheduled'},
  POSTING:          {bg: '#dbeafe', text: '#1e40af', icon: 'sync-outline',         label: 'Posting…'},
  POSTED:           {bg: '#dcfce7', text: '#166534', icon: 'checkmark-done-outline', label: 'Posted'},
  PARTIALLY_POSTED: {bg: '#fef9c3', text: '#713f12', icon: 'alert-circle-outline', label: 'Partial'},
  FAILED:           {bg: '#fee2e2', text: '#991b1b', icon: 'alert-circle-outline', label: 'Failed'},
};

const FILTERS = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'POSTED', 'FAILED'];
const FILTER_LABELS: Record<string, string> = {
  ALL: 'All', DRAFT: 'Draft', PENDING_APPROVAL: 'Pending',
  SCHEDULED: 'Scheduled', POSTED: 'Posted', FAILED: 'Failed',
};

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}) +
    ', ' + d.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit', hour12: true});
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function PostDetailModal({
  post, visible, isAdmin, onClose, onApprove, onReject, onPublishNow,
}: {
  post: any; visible: boolean; isAdmin: boolean;
  onClose: () => void; onApprove: () => void;
  onReject: () => void; onPublishNow: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!post) return null;
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
      <View style={[styles.modalContainer, {paddingTop: insets.top}]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Icon name="arrow-back" size={18} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Post Details</Text>
        </View>
        <View style={styles.divider} />

        <ScrollView contentContainerStyle={[styles.modalBody, {paddingBottom: insets.bottom + 24}]}>
          {/* Media */}
          {post.imageUrl ? (
            <Image source={{uri: post.imageUrl}} style={styles.mediaImage} resizeMode="cover" />
          ) : post.videoUrl ? (
            <View style={styles.videoPlaceholder}>
              <Icon name="videocam-outline" size={40} color="#94a3b8" />
              <Text style={styles.videoPlaceholderText}>Video Post</Text>
            </View>
          ) : null}

          {/* Carousel thumbnails */}
          {post.mediaUrls?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carouselRow}>
              {post.mediaUrls.map((url: string, i: number) => (
                <Image key={i} source={{uri: url}} style={styles.carouselThumb} />
              ))}
            </ScrollView>
          )}

          {/* Status + platforms */}
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, {backgroundColor: sc.bg}]}>
              <Icon name={sc.icon} size={11} color={sc.text} />
              <Text style={[styles.statusText, {color: sc.text}]}>{sc.label.toUpperCase()}</Text>
            </View>
            {post.platforms?.includes('facebook') && (
              <View style={[styles.platformBadge, {backgroundColor: '#dbeafe'}]}>
                <Icon name="logo-facebook" size={11} color="#1d4ed8" />
                <Text style={[styles.platformText, {color: '#1d4ed8'}]}>Facebook</Text>
              </View>
            )}
            {post.platforms?.includes('instagram') && (
              <View style={[styles.platformBadge, {backgroundColor: '#ede9fe'}]}>
                <Icon name="logo-instagram" size={11} color="#7c3aed" />
                <Text style={[styles.platformText, {color: '#7c3aed'}]}>Instagram</Text>
              </View>
            )}
            {post.postType && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{post.postType.toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Caption */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CAPTION</Text>
            <Text style={styles.captionText}>{post.caption}</Text>
          </View>

          {/* Hashtags */}
          {post.hashtags?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>HASHTAGS</Text>
              <Text style={styles.hashtagText}>
                {post.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')}
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
            <View style={[styles.alertBox, {backgroundColor: '#dbeafe', borderColor: '#93c5fd'}]}>
              <Icon name="information-circle-outline" size={14} color="#1d4ed8" />
              <Text style={[styles.alertText, {color: '#1e40af'}]}>
                <Text style={{fontWeight: '800'}}>Note: </Text>{post.approvalNote}
              </Text>
            </View>
          ) : null}
          {post.rejectionReason ? (
            <View style={[styles.alertBox, {backgroundColor: '#fee2e2', borderColor: '#fca5a5'}]}>
              <Icon name="close-circle-outline" size={14} color="#dc2626" />
              <Text style={[styles.alertText, {color: '#991b1b'}]}>
                <Text style={{fontWeight: '800'}}>Rejected: </Text>{post.rejectionReason}
              </Text>
            </View>
          ) : null}
          {post.failureReason ? (
            <View style={[styles.alertBox, {backgroundColor: '#fee2e2', borderColor: '#fca5a5'}]}>
              <Icon name="alert-circle-outline" size={14} color="#dc2626" />
              <Text style={[styles.alertText, {color: '#991b1b'}]}>
                <Text style={{fontWeight: '800'}}>Failed: </Text>{post.failureReason}
              </Text>
            </View>
          ) : null}

          {/* Published links */}
          {(fbLink || igLink) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PUBLISHED LINKS</Text>
              {fbLink && (
                <TouchableOpacity
                  style={[styles.linkBtn, {backgroundColor: '#eff6ff', borderColor: '#93c5fd'}]}
                  onPress={() => Linking.openURL(fbLink)}>
                  <Icon name="logo-facebook" size={16} color="#1d4ed8" />
                  <Text style={[styles.linkBtnText, {color: '#1d4ed8'}]}>View on Facebook</Text>
                  <Icon name="open-outline" size={14} color="#1d4ed8" />
                </TouchableOpacity>
              )}
              {igLink && (
                <TouchableOpacity
                  style={[styles.linkBtn, {backgroundColor: '#faf5ff', borderColor: '#c4b5fd'}]}
                  onPress={() => Linking.openURL(igLink)}>
                  <Icon name="logo-instagram" size={16} color="#7c3aed" />
                  <Text style={[styles.linkBtnText, {color: '#7c3aed'}]}>View on Instagram</Text>
                  <Icon name="open-outline" size={14} color="#7c3aed" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.linkBtn, {backgroundColor: '#f8fafc', borderColor: '#cbd5e1'}]}
                onPress={() => Linking.openURL('https://business.facebook.com/latest/insights/posts/')}>
                <Icon name="bar-chart-outline" size={16} color="#64748b" />
                <Text style={[styles.linkBtnText, {color: '#64748b'}]}>Analytics in Meta Business Suite</Text>
                <Icon name="open-outline" size={14} color="#64748b" />
              </TouchableOpacity>
            </View>
          )}

          {/* Admin actions */}
          {isAdmin && post.status === 'PENDING_APPROVAL' && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#ef4444', borderColor: '#000', flex: 1}]} onPress={onReject}>
                <Icon name="thumbs-down-outline" size={14} color="#fff" />
                <Text style={[styles.actionBtnText, {color: '#fff'}]}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#22c55e', borderColor: '#000', flex: 1}]} onPress={onApprove}>
                <Icon name="thumbs-up-outline" size={14} color="#fff" />
                <Text style={[styles.actionBtnText, {color: '#fff'}]}>Approve</Text>
              </TouchableOpacity>
            </View>
          )}
          {isAdmin && ['SCHEDULED', 'FAILED', 'APPROVED', 'PARTIALLY_POSTED'].includes(post.status) && (
            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: PRIMARY, borderColor: '#000'}]} onPress={onPublishNow}>
              <Icon name="flash-outline" size={14} color="#fff" />
              <Text style={[styles.actionBtnText, {color: '#fff'}]}>Post Now</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SocialPlannerScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(false);
  const [viewingPost, setViewingPost] = useState<any>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const params = filter !== 'ALL' ? {status: filter} : {};
      const [postsRes, statsRes] = await Promise.all([
        socialAPI.getPosts(params),
        socialAPI.getStats(),
      ]);
      setPosts(postsRes.data || []);
      setStats(statsRes.data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {fetchData();}, [fetchData]);

  const handleApprove = (post: any) => {
    Alert.alert('Approve Post?', `Schedule for ${fmt(post.scheduledAt)}`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Approve', onPress: async () => {
          setActionLoading(true);
          try {
            await socialAPI.approvePost(post._id);
            setViewingPost(null);
            fetchData();
          } catch (e: any) {Alert.alert('Error', e.message);}
          finally {setActionLoading(false);}
        },
      },
    ]);
  };

  const handleReject = (post: any) => {
    Alert.prompt
      ? Alert.prompt('Reject Post', 'Reason for rejection:', async (reason) => {
          if (!reason?.trim()) return;
          setActionLoading(true);
          try {
            await socialAPI.rejectPost(post._id, reason.trim());
            setViewingPost(null);
            fetchData();
          } catch (e: any) {Alert.alert('Error', e.message);}
          finally {setActionLoading(false);}
        }, 'plain-text')
      : Alert.alert('Reject Post', 'This will reject the post. Proceed?', [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Reject', style: 'destructive', onPress: async () => {
              setActionLoading(true);
              try {
                await socialAPI.rejectPost(post._id, 'Rejected by admin');
                setViewingPost(null);
                fetchData();
              } catch (e: any) {Alert.alert('Error', e.message);}
              finally {setActionLoading(false);}
            },
          },
        ]);
  };

  const handlePublishNow = (post: any) => {
    Alert.alert('Post Now?', 'This will publish the post immediately.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Post Now', onPress: async () => {
          setActionLoading(true);
          try {
            await socialAPI.publishPost(post._id);
            Alert.alert('Publishing started!', 'Check back in a minute.');
            setViewingPost(null);
            setTimeout(() => fetchData(), 4000);
          } catch (e: any) {Alert.alert('Error', e.message);}
          finally {setActionLoading(false);}
        },
      },
    ]);
  };

  const renderPost = ({item: p}: {item: any}) => {
    const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
    return (
      <TouchableOpacity style={styles.card} onPress={() => setViewingPost(p)} activeOpacity={0.85}>
        <View style={styles.cardInner}>
          {/* Thumbnail */}
          {p.imageUrl ? (
            <Image source={{uri: p.imageUrl}} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Icon name={p.videoUrl ? 'videocam-outline' : 'image-outline'} size={20} color="#94a3b8" />
            </View>
          )}

          <View style={styles.cardBody}>
            {/* Status + platforms */}
            <View style={styles.badgeRow}>
              <View style={[styles.statusBadge, {backgroundColor: sc.bg}]}>
                <Icon name={sc.icon} size={10} color={sc.text} />
                <Text style={[styles.statusText, {color: sc.text}]}>{sc.label.toUpperCase()}</Text>
              </View>
              {p.platforms?.includes('facebook') && (
                <Icon name="logo-facebook" size={14} color="#1d4ed8" />
              )}
              {p.platforms?.includes('instagram') && (
                <Icon name="logo-instagram" size={14} color="#7c3aed" />
              )}
            </View>

            <Text style={styles.caption} numberOfLines={2}>{p.caption}</Text>

            {p.hashtags?.length > 0 && (
              <Text style={styles.hashtags} numberOfLines={1}>
                {p.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')}
              </Text>
            )}

            <View style={styles.cardMeta}>
              <Icon name="calendar-outline" size={11} color="#94a3b8" />
              <Text style={styles.metaText}>{fmt(p.scheduledAt)}</Text>
              {p.createdBy?.name && <>
                <Icon name="person-outline" size={11} color="#94a3b8" />
                <Text style={styles.metaText}>{p.createdBy.name}</Text>
              </>}
            </View>

            {p.status === 'REJECTED' && p.rejectionReason && (
              <Text style={styles.errorText} numberOfLines={1}>✕ {p.rejectionReason}</Text>
            )}
            {['FAILED', 'PARTIALLY_POSTED'].includes(p.status) && p.failureReason && (
              <Text style={styles.errorText} numberOfLines={1}>✕ {p.failureReason}</Text>
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
              style={[styles.quickBtn, {backgroundColor: '#fee2e2'}]}
              onPress={() => handleReject(p)}
              disabled={actionLoading}>
              <Icon name="thumbs-down-outline" size={13} color="#dc2626" />
              <Text style={[styles.quickBtnText, {color: '#dc2626'}]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, {backgroundColor: '#dcfce7'}]}
              onPress={() => handleApprove(p)}
              disabled={actionLoading}>
              <Icon name="thumbs-up-outline" size={13} color="#16a34a" />
              <Text style={[styles.quickBtnText, {color: '#16a34a'}]}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
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
          <Text style={styles.headerTitle}>Social Planner</Text>
          <Text style={styles.headerSub}>{posts.length} post{posts.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => fetchData(true)} style={styles.refreshBtn}>
            <Icon name="refresh-outline" size={20} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newPostBtn}
            onPress={() => navigation.navigate('CreatePost')}>
            <Icon name="add" size={18} color="#fff" />
            <Text style={styles.newPostBtnText}>NEW</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.divider} />

      {/* Stats strip */}
      {stats && (
        <View style={styles.statsStrip}>
          {[
            {label: 'TOTAL', value: stats.total, color: '#000'},
            {label: 'PENDING', value: stats.pending, color: '#d97706'},
            {label: 'SCHEDULED', value: stats.scheduled, color: PRIMARY},
            {label: 'POSTED', value: stats.posted, color: '#16a34a'},
          ].map(s => (
            <View key={s.label} style={styles.statCell}>
              <Text style={[styles.statValue, {color: s.color}]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.thinDivider} />

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}>
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {FILTER_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.thinDivider} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p._id}
          renderItem={renderPost}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 24}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={PRIMARY} />}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  backBtn: {width: 36, height: 36, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center'},
  headerActions: {marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8},
  refreshBtn: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center'},
  newPostBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PRIMARY, borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 6},
  newPostBtnText: {fontSize: 11, fontWeight: '900', color: '#fff'},
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#000'},
  headerSub: {fontSize: 11, color: '#64748b'},
  divider: {height: 2, backgroundColor: '#000'},
  thinDivider: {height: 1, backgroundColor: '#e2e8f0'},

  statsStrip: {flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10},
  statCell: {flex: 1, alignItems: 'center'},
  statValue: {fontSize: 20, fontWeight: '900'},
  statLabel: {fontSize: 8, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginTop: 1},

  filterScroll: {maxHeight: 44},
  filterRow: {paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexDirection: 'row'},
  filterChip: {paddingHorizontal: 12, paddingVertical: 5, borderWidth: 2, borderColor: '#e2e8f0'},
  filterChipActive: {borderColor: '#000', backgroundColor: PRIMARY},
  filterChipText: {fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase'},
  filterChipTextActive: {color: '#fff'},

  centerBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  list: {padding: 12, gap: 10},

  card: {backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', ...NB_SHADOW},
  cardInner: {flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 12},
  thumb: {width: 64, height: 64, borderWidth: 2, borderColor: '#000'},
  thumbPlaceholder: {backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center'},
  cardBody: {flex: 1, gap: 4},

  badgeRow: {flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'},
  statusBadge: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, gap: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)'},
  statusText: {fontSize: 8, fontWeight: '900', textTransform: 'uppercase'},
  platformBadge: {flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3},
  platformText: {fontSize: 9, fontWeight: '700'},
  typeBadge: {backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 3},
  typeBadgeText: {fontSize: 8, fontWeight: '700', color: '#64748b'},

  caption: {fontSize: 13, color: '#000', lineHeight: 18},
  hashtags: {fontSize: 11, color: '#7c3aed'},
  cardMeta: {flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2},
  metaText: {fontSize: 10, color: '#94a3b8'},
  errorText: {fontSize: 11, color: '#dc2626', marginTop: 2},
  postedRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2},
  postedText: {fontSize: 11, color: '#16a34a'},

  quickActions: {flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e2e8f0'},
  quickBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 5},
  quickBtnText: {fontSize: 12, fontWeight: '800'},

  emptyBox: {alignItems: 'center', paddingTop: 60, gap: 8},
  emptyTitle: {fontSize: 14, fontWeight: '700', color: '#94a3b8'},
  emptySub: {fontSize: 12, color: '#cbd5e1'},

  // Modal
  modalContainer: {flex: 1, backgroundColor: '#fff'},
  modalHeader: {height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12},
  modalTitle: {fontSize: 18, fontWeight: '900', color: '#000'},
  modalBody: {padding: 16, gap: 16},

  mediaImage: {width: '100%', height: 220, borderWidth: 2, borderColor: '#000'},
  videoPlaceholder: {width: '100%', height: 140, backgroundColor: '#f1f5f9', borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 8},
  videoPlaceholderText: {fontSize: 13, color: '#94a3b8', fontWeight: '600'},
  carouselRow: {marginBottom: 4},
  carouselThumb: {width: 72, height: 72, marginRight: 8, borderWidth: 2, borderColor: '#000'},

  section: {gap: 6},
  sectionLabel: {fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1},
  captionText: {fontSize: 14, color: '#000', lineHeight: 20},
  hashtagText: {fontSize: 12, color: '#7c3aed', lineHeight: 18},

  metaGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  metaCell: {minWidth: '45%', gap: 3},
  metaLabel: {fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8},
  metaValue: {fontSize: 13, fontWeight: '600', color: '#000'},

  alertBox: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderWidth: 1},
  alertText: {flex: 1, fontSize: 13, lineHeight: 18},

  linkBtn: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, marginBottom: 8},
  linkBtnText: {flex: 1, fontSize: 13, fontWeight: '700'},

  actionRow: {flexDirection: 'row', gap: 10},
  actionBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderWidth: 2},
  actionBtnText: {fontSize: 13, fontWeight: '900'},
});
