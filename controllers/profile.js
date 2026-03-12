const pool = require('../config/db');

/**
 * GET /api/profile/me - Get current user's profile (requires auth)
 */
async function getMyProfile(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await pool.query(
      `SELECT up.user_profile_id, up.user_id, up.username, up.about_me, up.contact_info,
              up.facebook_url, up.instagram_url, up.twitter_url, up.linkedin_url, up.whatsapp_url,
              up.profile_photo_url, up.created_at, up.updated_at,
              u.first_name, u.last_name, u.email, u.phone
       FROM user_profile up
       JOIN \`user\` u ON u.user_id = up.user_id
       WHERE up.user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({ profile: null });
    }

    const r = rows[0];
    res.json({
      profile: {
        id: r.user_profile_id,
        userId: r.user_id,
        username: r.username,
        aboutMe: r.about_me || '',
        contactInfo: r.contact_info || '',
        socialLinks: {
          facebook: r.facebook_url || null,
          instagram: r.instagram_url || null,
          twitter: r.twitter_url || null,
          linkedin: r.linkedin_url || null,
          whatsapp: r.whatsapp_url || null,
        },
        profilePhotoUrl: r.profile_photo_url || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        phone: r.phone,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/profile/by-username/:username - Get profile by username (public)
 */
async function getProfileByUsername(req, res) {
  try {
    const { username } = req.params;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username required' });
    }

    const [rows] = await pool.query(
      `SELECT up.user_profile_id, up.user_id, up.username, up.about_me, up.contact_info,
              up.facebook_url, up.instagram_url, up.twitter_url, up.linkedin_url, up.whatsapp_url,
              up.profile_photo_url,
              u.first_name, u.last_name, u.email, u.phone, u.city
       FROM user_profile up
       JOIN \`user\` u ON u.user_id = up.user_id
       WHERE up.username = ? AND u.status = 'active'`,
      [username.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const r = rows[0];
    res.json({
      id: r.user_profile_id,
      userId: r.user_id,
      username: r.username,
      aboutMe: r.about_me || '',
      contactInfo: r.contact_info || '',
      socialLinks: {
        facebook: r.facebook_url || null,
        instagram: r.instagram_url || null,
        twitter: r.twitter_url || null,
        linkedin: r.linkedin_url || null,
        whatsapp: r.whatsapp_url || null,
      },
      profilePhotoUrl: r.profile_photo_url || null,
      firstName: r.first_name,
      lastName: r.last_name,
      fullName: [r.first_name, r.last_name].filter(Boolean).join(' '),
      email: r.email,
      phone: r.phone,
      location: r.city || '',
    });
  } catch (error) {
    console.error('Get profile by username error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/profile/setup - Create profile (username required, about_me/contact_info optional)
 */
async function setupProfile(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { username, aboutMe, socialLinks } = req.body || {};

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const usernameClean = username.trim().toLowerCase().replace(/\s+/g, '');
    if (usernameClean.length < 2 || usernameClean.length > 50) {
      return res.status(400).json({ error: 'Username must be 2-50 characters' });
    }
    if (!/^[a-z0-9_-]+$/.test(usernameClean)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
    }

    const [existing] = await pool.query(
      'SELECT user_profile_id FROM user_profile WHERE user_id = ?',
      [userId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Profile already exists. Use PATCH to update.' });
    }

    const [usernameTaken] = await pool.query(
      'SELECT 1 FROM user_profile WHERE username = ?',
      [usernameClean]
    );
    if (usernameTaken.length > 0) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const sl = socialLinks && typeof socialLinks === 'object' ? socialLinks : {};
    const trimUrl = (v) => (v && typeof v === 'string' ? v.trim().slice(0, 500) : null);

    await pool.query(
      `INSERT INTO user_profile (user_id, username, about_me, facebook_url, instagram_url, twitter_url, linkedin_url, whatsapp_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        usernameClean,
        aboutMe && typeof aboutMe === 'string' ? aboutMe.trim().slice(0, 2000) : null,
        trimUrl(sl.facebook),
        trimUrl(sl.instagram),
        trimUrl(sl.twitter),
        trimUrl(sl.linkedin),
        trimUrl(sl.whatsapp),
      ]
    );

    res.status(201).json({
      message: 'Profile created',
      username: usernameClean,
    });
  } catch (error) {
    console.error('Setup profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/profile/me - Update profile (about_me, contact_info)
 */
async function updateProfile(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { aboutMe, socialLinks } = req.body || {};

    const updates = [];
    const params = [];

    if (aboutMe !== undefined) {
      updates.push('about_me = ?');
      params.push(typeof aboutMe === 'string' ? aboutMe.trim().slice(0, 2000) : null);
    }
    if (socialLinks !== undefined && socialLinks && typeof socialLinks === 'object') {
      const trimUrl = (v) => (v && typeof v === 'string' ? v.trim().slice(0, 500) : null);
      updates.push('facebook_url = ?, instagram_url = ?, twitter_url = ?, linkedin_url = ?, whatsapp_url = ?');
      params.push(
        trimUrl(socialLinks.facebook),
        trimUrl(socialLinks.instagram),
        trimUrl(socialLinks.twitter),
        trimUrl(socialLinks.linkedin),
        trimUrl(socialLinks.whatsapp)
      );
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(userId);
    const [result] = await pool.query(
      `UPDATE user_profile SET ${updates.join(', ')} WHERE user_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile updated' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getMyProfile,
  getProfileByUsername,
  setupProfile,
  updateProfile,
};
