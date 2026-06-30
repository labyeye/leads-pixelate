const asyncHandler = require("express-async-handler");
const SocialPost = require("../models/SocialPost");
const SocialAccount = require("../models/SocialAccount");
const Tenant = require("../models/Tenant");

function getSocialConfig() {
  return {
    fbAppId: process.env.FACEBOOK_APP_ID,
    fbAppSecret: process.env.FACEBOOK_APP_SECRET,
    callbackUrl:
      process.env.FACEBOOK_OAUTH_CALLBACK_URL ||
      "https://leads.pixelatenest.com/api/social/auth/facebook/callback",
    frontendUrl: process.env.CLIENT_URL || "http://localhost:3000",
  };
}

async function postToFacebook(pageId, accessToken, caption, imageUrl) {
  let url, body;

  if (imageUrl) {
    url = `https://graph.facebook.com/v18.0/${pageId}/photos`;
    body = { caption, url: imageUrl, access_token: accessToken };
  } else {
    url = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    body = { message: caption, access_token: accessToken };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || "Facebook post failed");
  }
  return data.id || data.post_id || "";
}

async function postToInstagram(igAccountId, accessToken, caption, imageUrl) {
  if (!imageUrl) {
    throw new Error("Instagram requires an image URL");
  }

  const createRes = await fetch(
    `https://graph.facebook.com/v18.0/${igAccountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    },
  );
  const createData = await createRes.json();
  if (!createRes.ok || createData.error) {
    throw new Error(
      createData?.error?.message || "Instagram media creation failed",
    );
  }

  const creationId = createData.id;

  const publishRes = await fetch(
    `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    },
  );
  const publishData = await publishRes.json();
  if (!publishRes.ok || publishData.error) {
    throw new Error(publishData?.error?.message || "Instagram publish failed");
  }

  return publishData.id || "";
}

async function executePublish(post) {
  post.status = "POSTING";
  await post.save();

  let fbPostId = "";
  let igPostId = "";
  const errors = [];

  const fullCaption =
    post.hashtags && post.hashtags.length
      ? `${post.caption}\n\n${post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
      : post.caption;

  if (post.platforms.includes("facebook")) {
    const fbAccount = await SocialAccount.findOne({
      platform: "facebook",
      isActive: true,
    });
    if (fbAccount) {
      try {
        fbPostId = await postToFacebook(
          fbAccount.accountId,
          fbAccount.accessToken,
          fullCaption,
          post.imageUrl,
        );
      } catch (err) {
        errors.push(`Facebook: ${err.message}`);
      }
    } else {
      errors.push("Facebook: No active account connected");
    }
  }

  if (post.platforms.includes("instagram")) {
    const igAccount = await SocialAccount.findOne({
      platform: "instagram",
      isActive: true,
    });
    if (igAccount) {
      try {
        igPostId = await postToInstagram(
          igAccount.accountId,
          igAccount.accessToken,
          fullCaption,
          post.imageUrl,
        );
      } catch (err) {
        errors.push(`Instagram: ${err.message}`);
      }
    } else {
      errors.push("Instagram: No active account connected");
    }
  }

  const successCount = (fbPostId ? 1 : 0) + (igPostId ? 1 : 0);
  const attemptCount = post.platforms.length;

  post.facebookPostId = fbPostId;
  post.instagramPostId = igPostId;
  post.postedAt = successCount > 0 ? new Date() : null;
  post.failureReason = errors.join("; ");
  post.status =
    successCount === 0
      ? "FAILED"
      : successCount < attemptCount
        ? "POSTED"
        : "POSTED";

  await post.save();
  return post;
}

exports.getPosts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.tenantId) filter.tenantId = req.user.tenantId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.platform) filter.platforms = req.query.platform;

  const posts = await SocialPost.find(filter)
    .sort({ scheduledAt: 1, createdAt: -1 })
    .populate("createdBy", "name")
    .populate("approvedBy", "name")
    .populate("rejectedBy", "name");

  res.json({ success: true, count: posts.length, data: posts });
});

exports.getPost = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const post = await SocialPost.findOne({ _id: req.params.id, ...tenantFilter })
    .populate("createdBy", "name")
    .populate("approvedBy", "name");

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }
  res.json({ success: true, data: post });
});

exports.createPost = asyncHandler(async (req, res) => {
  const { caption, imageUrl, hashtags, platforms, scheduledAt } = req.body;

  if (!caption || !platforms?.length || !scheduledAt) {
    res.status(400);
    throw new Error("caption, platforms, and scheduledAt are required");
  }

  const post = await SocialPost.create({
    caption,
    imageUrl: imageUrl || "",
    hashtags: hashtags || [],
    platforms,
    scheduledAt: new Date(scheduledAt),
    status: "DRAFT",
    createdBy: req.user._id,
    tenantId: req.user.tenantId || null,
  });

  await post.populate("createdBy", "name");
  res.status(201).json({ success: true, data: post });
});

exports.updatePost = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const post = await SocialPost.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (!["DRAFT", "REJECTED"].includes(post.status)) {
    res.status(400);
    throw new Error("Only DRAFT or REJECTED posts can be edited");
  }

  const allowed = [
    "caption",
    "imageUrl",
    "hashtags",
    "platforms",
    "scheduledAt",
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) post[key] = req.body[key];
  }

  if (post.status === "REJECTED") post.status = "DRAFT";

  await post.save();
  await post.populate("createdBy", "name");
  res.json({ success: true, data: post });
});

exports.deletePost = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const post = await SocialPost.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (["POSTING", "POSTED"].includes(post.status)) {
    res.status(400);
    throw new Error(
      "Cannot delete a post that is being published or already posted",
    );
  }

  await post.deleteOne();
  res.json({ success: true, message: "Post deleted" });
});

exports.submitPost = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const post = await SocialPost.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (!["DRAFT", "REJECTED"].includes(post.status)) {
    res.status(400);
    throw new Error(
      "Only DRAFT or REJECTED posts can be submitted for approval",
    );
  }

  post.status = "PENDING_APPROVAL";
  await post.save();
  await post.populate("createdBy", "name");
  res.json({ success: true, data: post });
});

exports.approvePost = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const post = await SocialPost.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (post.status !== "PENDING_APPROVAL") {
    res.status(400);
    throw new Error("Only posts pending approval can be approved");
  }

  post.status = "APPROVED";
  post.approvedBy = req.user._id;
  post.approvedAt = new Date();
  post.approvalNote = req.body.note || "";

  if (new Date(post.scheduledAt) > new Date()) {
    post.status = "SCHEDULED";
    await post.save();
    await post.populate("createdBy approvedBy", "name");
    return res.json({ success: true, data: post });
  }

  await post.save();

  executePublish(post).catch((err) =>
    console.error("[SocialPost Publish]", err.message),
  );

  res.json({ success: true, data: post });
});

exports.rejectPost = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const post = await SocialPost.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (post.status !== "PENDING_APPROVAL") {
    res.status(400);
    throw new Error("Only posts pending approval can be rejected");
  }

  post.status = "REJECTED";
  post.rejectedBy = req.user._id;
  post.rejectedAt = new Date();
  post.rejectionReason = req.body.reason || "No reason provided";
  await post.save();
  await post.populate("createdBy rejectedBy", "name");
  res.json({ success: true, data: post });
});

exports.publishPost = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const post = await SocialPost.findOne({
    _id: req.params.id,
    ...tenantFilter,
  });
  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (!["APPROVED", "SCHEDULED", "FAILED"].includes(post.status)) {
    res.status(400);
    throw new Error("Post must be APPROVED, SCHEDULED, or FAILED to publish");
  }

  res.json({ success: true, message: "Publishing started", data: post });
  await executePublish(post);
});

exports.runScheduledPosts = async () => {
  try {
    const now = new Date();
    const duePosts = await SocialPost.find({
      status: "SCHEDULED",
      scheduledAt: { $lte: now },
    });

    for (const post of duePosts) {
      await executePublish(post).catch((err) =>
        console.error(`[SocialCron] Post ${post._id}: ${err.message}`),
      );
    }

    if (duePosts.length) {
      console.log(`[SocialCron] Published ${duePosts.length} post(s)`);
    }
  } catch (err) {
    console.error("[SocialCron Error]", err.message);
  }
};

exports.getAccounts = asyncHandler(async (req, res) => {
  const accounts = await SocialAccount.find()
    .sort({ createdAt: -1 })
    .populate("connectedBy", "name")
    .select("-accessToken -userAccessToken");

  res.json({ success: true, count: accounts.length, data: accounts });
});

exports.connectAccount = asyncHandler(async (req, res) => {
  const {
    platform,
    accountId,
    accountName,
    accessToken,
    profilePicture,
    instagramBusinessAccountId,
  } = req.body;

  if (!platform || !accountId || !accountName || !accessToken) {
    res.status(400);
    throw new Error(
      "platform, accountId, accountName, and accessToken are required",
    );
  }

  const account = await SocialAccount.findOneAndUpdate(
    { platform, accountId },
    {
      accountName,
      accessToken,
      profilePicture: profilePicture || "",
      instagramBusinessAccountId: instagramBusinessAccountId || "",
      isActive: true,
      connectedBy: req.user._id,
    },
    { upsert: true, new: true, runValidators: true },
  );

  res.status(201).json({
    success: true,
    data: { ...account.toObject(), accessToken: undefined },
  });
});

exports.disconnectAccount = asyncHandler(async (req, res) => {
  const account = await SocialAccount.findById(req.params.id);
  if (!account) {
    res.status(404);
    throw new Error("Account not found");
  }

  await account.deleteOne();
  res.json({ success: true, message: "Account disconnected" });
});

exports.getFacebookAuthUrl = asyncHandler(async (req, res) => {
  const config = getSocialConfig();

  if (!config.fbAppId) {
    res.status(400);
    throw new Error("FACEBOOK_APP_ID is not configured");
  }

  const scopes = [
    "email",
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "pages_manage_metadata",
    "business_management",
    "instagram_basic",
    "instagram_content_publish",
  ].join(",");

  const authUrl =
    `https://www.facebook.com/v18.0/dialog/oauth` +
    `?client_id=${config.fbAppId}` +
    `&redirect_uri=${encodeURIComponent(config.callbackUrl)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code` +
    `&state=${req.user._id}`;

  res.json({ success: true, data: { authUrl } });
});

async function savePagesAsSocialAccounts(finalUserToken, userId) {
  const pagesRes = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${finalUserToken}&fields=id,name,picture,access_token`,
  );
  const pagesData = await pagesRes.json();
  if (pagesData.error) throw new Error(pagesData.error.message);
  const pages = pagesData.data || [];

  let savedCount = 0;
  for (const page of pages) {
    let igId = "";
    try {
      const igRes = await fetch(
        `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
      );
      const igData = await igRes.json();
      igId = igData?.instagram_business_account?.id || "";
    } catch (_) {}

    await SocialAccount.findOneAndUpdate(
      { platform: "facebook", accountId: page.id },
      {
        accountName: page.name,
        accessToken: page.access_token,
        profilePicture: page.picture?.data?.url || "",
        instagramBusinessAccountId: igId,
        userAccessToken: finalUserToken,
        isActive: true,
        connectedBy: userId,
      },
      { upsert: true, new: true },
    );
    savedCount++;

    if (igId) {
      let igName = page.name + " (Instagram)";
      let igPicture = "";
      try {
        const igInfoRes = await fetch(
          `https://graph.facebook.com/v18.0/${igId}?fields=name,username,profile_picture_url&access_token=${page.access_token}`,
        );
        const igInfo = await igInfoRes.json();
        igName = igInfo.username || igInfo.name || igName;
        igPicture = igInfo.profile_picture_url || "";
      } catch (_) {}

      await SocialAccount.findOneAndUpdate(
        { platform: "instagram", accountId: igId },
        {
          accountName: igName,
          accessToken: page.access_token,
          profilePicture: igPicture,
          isActive: true,
          connectedBy: userId,
        },
        { upsert: true, new: true },
      );
      savedCount++;
    }
  }

  return savedCount;
}

exports.facebookCallback = asyncHandler(async (req, res) => {
  const config = getSocialConfig();
  const { code, state: userId, error } = req.query;

  const frontendUrl = `${config.frontendUrl}/social-media-planner`;

  if (error) {
    return res.redirect(
      `${frontendUrl}?tab=accounts&error=${encodeURIComponent(error)}`,
    );
  }

  const tokenRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token` +
      `?client_id=${config.fbAppId}` +
      `&client_secret=${config.fbAppSecret}` +
      `&redirect_uri=${encodeURIComponent(config.callbackUrl)}` +
      `&code=${code}`,
  );
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || tokenData.error) {
    return res.redirect(
      `${frontendUrl}?tab=accounts&error=${encodeURIComponent(tokenData?.error?.message || "Token exchange failed")}`,
    );
  }

  const userAccessToken = tokenData.access_token;

  const longLivedRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${config.fbAppId}` +
      `&client_secret=${config.fbAppSecret}` +
      `&fb_exchange_token=${userAccessToken}`,
  );
  const longLivedData = await longLivedRes.json();
  const finalUserToken = longLivedData.access_token || userAccessToken;

  let savedCount = 0;
  try {
    savedCount = await savePagesAsSocialAccounts(finalUserToken, userId);
  } catch (err) {
    return res.redirect(
      `${frontendUrl}?tab=accounts&error=${encodeURIComponent(err.message)}`,
    );
  }

  res.redirect(`${frontendUrl}?tab=accounts&connected=${savedCount}`);
});

// Reuses the Facebook user token already captured by the Integrations →
// Facebook (leads) connection, so the user doesn't have to OAuth twice.
exports.importFromIntegration = asyncHandler(async (req, res) => {
  const query = req.user.tenantId
    ? { _id: req.user.tenantId }
    : { ownerUser: req.user._id };
  const tenant = await Tenant.findOne(query);
  const userToken = tenant?.integrations?.facebook?.userAccessToken;

  if (!userToken) {
    res.status(400);
    throw new Error(
      "No Facebook account connected yet. Connect Facebook from Integrations first.",
    );
  }

  let savedCount;
  try {
    savedCount = await savePagesAsSocialAccounts(userToken, req.user._id);
  } catch (err) {
    res.status(400);
    throw new Error(err.message || "Failed to import pages from Facebook");
  }

  res.json({ success: true, data: { connected: savedCount } });
});

exports.fetchFacebookPages = asyncHandler(async (req, res) => {
  const { userToken } = req.body;
  if (!userToken) {
    res.status(400);
    throw new Error("userToken is required");
  }

  const pagesRes = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${userToken}&fields=id,name,picture,access_token`,
  );
  const pagesData = await pagesRes.json();

  if (!pagesRes.ok || pagesData.error) {
    res.status(400);
    throw new Error(pagesData?.error?.message || "Failed to fetch pages");
  }

  const pages = (pagesData.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    picture: p.picture?.data?.url || "",
    accessToken: p.access_token,
  }));

  res.json({ success: true, data: pages });
});

exports.getStats = asyncHandler(async (req, res) => {
  const tenantFilter = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const [total, pending, scheduled, posted, failed, accounts] =
    await Promise.all([
      SocialPost.countDocuments(tenantFilter),
      SocialPost.countDocuments({
        ...tenantFilter,
        status: "PENDING_APPROVAL",
      }),
      SocialPost.countDocuments({ ...tenantFilter, status: "SCHEDULED" }),
      SocialPost.countDocuments({ ...tenantFilter, status: "POSTED" }),
      SocialPost.countDocuments({ ...tenantFilter, status: "FAILED" }),
      SocialAccount.countDocuments({ isActive: true }),
    ]);

  res.json({
    success: true,
    data: {
      total,
      pending,
      scheduled,
      posted,
      failed,
      connectedAccounts: accounts,
    },
  });
});
