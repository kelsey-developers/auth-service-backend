const pool = require('../config/db');

/**
 * GET /api/agents/me/balance
 * Returns current commission balance for the authenticated agent.
 * Creates a balance row with 0 if one does not exist.
 */
async function getBalance(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let [rows] = await pool.query(
      `SELECT current_amount, updated_at FROM balance WHERE agent_user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO balance (agent_user_id, current_amount) VALUES (?, 0)`,
        [userId]
      );
      [rows] = await pool.query(
        `SELECT current_amount, updated_at FROM balance WHERE agent_user_id = ?`,
        [userId]
      );
    }

    const row = rows[0];
    const currentAmount = row ? Number(row.current_amount) : 0;

    res.json({
      current_amount: currentAmount,
      updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/agents/me/balance-history
 * Returns balance history (add/remove) for the authenticated agent.
 */
async function getBalanceHistory(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await pool.query(
      `SELECT balance_history_id, type, amount, reference_type, reference_id, created_at
       FROM balance_history
       WHERE agent_user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    const history = rows.map((r) => ({
      id: String(r.balance_history_id),
      type: r.type,
      amount: Number(r.amount),
      referenceType: r.reference_type,
      referenceId: r.reference_id,
      createdAt: new Date(r.created_at).toISOString(),
    }));

    res.json(history);
  } catch (error) {
    console.error('Get balance history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Recursively build referral tree from agent_relationship.
 * Uses ar.level from DB for L1, L2, L3. Commission set to 0 for now.
 */
async function buildReferralTree(pool, parentUserId, userMap, bookingCountMap) {
  const [rows] = await pool.query(
    `SELECT ar.child_agent_user_id, ar.level
     FROM agent_relationship ar
     WHERE ar.parent_agent_user_id = ?
     ORDER BY ar.child_agent_user_id`,
    [parentUserId]
  );

  const children = [];
  for (const r of rows) {
    const childId = r.child_agent_user_id;
    const u = userMap.get(childId);
    const bookings = bookingCountMap.get(childId) || 0;
    const dbLevel = Math.min(Math.max(1, Number(r.level) || 1), 3);
    const childNode = {
      agentId: String(childId),
      agentName: u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : `Agent ${childId}`,
      email: u?.email || '',
      referralCode: `AGENT-${childId}`,
      level: dbLevel,
      status: (u?.status === 'active' ? 'active' : 'inactive'),
      joinedAt: u?.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
      totalCommissionsEarned: 0,
      totalBookings: bookings,
      children: await buildReferralTree(pool, childId, userMap, bookingCountMap),
    };
    children.push(childNode);
  }
  return children;
}

/**
 * Get all descendant user IDs for a given parent (recursive).
 */
async function getDescendantIds(pool, parentUserId) {
  const [rows] = await pool.query(
    `SELECT child_agent_user_id FROM agent_relationship WHERE parent_agent_user_id = ?`,
    [parentUserId]
  );
  const ids = [parentUserId];
  for (const r of rows) {
    const childIds = await getDescendantIds(pool, r.child_agent_user_id);
    ids.push(...childIds);
  }
  return ids;
}

/**
 * GET /api/agents/me/network
 * Returns referral tree and stats for the authenticated agent.
 * Uses agent_relationship. Commission = 0 for now.
 */
async function getNetwork(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const networkIds = await getDescendantIds(pool, userId);
    const uniqueIds = [...new Set(networkIds)];

    if (uniqueIds.length === 0) {
      uniqueIds.push(userId);
    }

    const placeholders = uniqueIds.map(() => '?').join(',');
    const [userRows] = await pool.query(
      `SELECT user_id, first_name, last_name, email, status, created_at
       FROM \`user\` WHERE user_id IN (${placeholders})`,
      uniqueIds
    );
    const userMap = new Map(userRows.map((u) => [u.user_id, u]));

    const [bookingRows] = await pool.query(
      `SELECT agent_user_id, COUNT(*) AS cnt
       FROM booking
       WHERE agent_user_id IN (${placeholders})
       GROUP BY agent_user_id`,
      uniqueIds
    );
    const bookingCountMap = new Map(bookingRows.map((b) => [b.agent_user_id, b.cnt]));

    const rootUser = userMap.get(userId);
    const rootBookings = bookingCountMap.get(userId) || 0;
    const rootNode = {
      agentId: String(userId),
      agentName: rootUser ? `${rootUser.first_name || ''} ${rootUser.last_name || ''}`.trim() || rootUser.email : 'You',
      email: rootUser?.email || '',
      referralCode: `AGENT-${userId}`,
      level: 0,
      status: rootUser?.status === 'active' ? 'active' : 'inactive',
      joinedAt: rootUser?.created_at ? new Date(rootUser.created_at).toISOString() : new Date().toISOString(),
      totalCommissionsEarned: 0,
      totalBookings: rootBookings,
      children: await buildReferralTree(pool, userId, userMap, bookingCountMap),
    };

    const flatten = (node) => {
      const arr = node.children ? [node, ...node.children.flatMap(flatten)] : [node];
      return arr.filter((n) => n.agentId !== String(userId));
    };
    const allDescendants = flatten(rootNode);
    const activeCount = allDescendants.filter((n) => n.status === 'active').length;
    const networkBookings = uniqueIds.reduce((s, id) => s + (bookingCountMap.get(id) || 0), 0);

    res.json({
      tree: rootNode,
      stats: {
        totalSubAgents: allDescendants.length,
        activeSubAgents: activeCount,
        networkBookings,
        totalNetworkCommissions: 0,
      },
    });
  } catch (error) {
    console.error('Get network error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/agents/list
 * List agents (users with role=Agent who have a profile). For manage-units dropdown.
 * Requires auth (Admin or Agent).
 */
async function listAgents(req, res) {
  try {
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const isAdmin = roles.includes('Admin');
    const isAgent = roles.includes('Agent');
    if (!isAdmin && !isAgent) return res.status(403).json({ error: 'Admin or Agent required' });

    const search = (req.query.search || '').trim().toLowerCase();
    let sql = `SELECT u.user_id, u.first_name, u.last_name, u.email, up.username
       FROM \`user\` u
       INNER JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
       INNER JOIN role r ON r.role_id = ur.role_id AND r.role_name = 'Agent'
       INNER JOIN user_profile up ON up.user_id = u.user_id
       WHERE u.status = 'active'`;
    const params = [];
    if (search) {
      sql += ' AND (up.username LIKE ? OR u.email LIKE ? OR CONCAT(u.first_name, \' \', u.last_name) LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY up.username ASC LIMIT 50';
    const [rows] = await pool.query(sql, params);

    const agents = rows.map((r) => ({
      id: String(r.user_id),
      fullname: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email,
      email: r.email,
      username: r.username,
    }));

    res.json(agents);
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapUnitToResponse(r) {
  return {
    id: String(r.unit_id),
    title: r.unit_name,
    description: r.description,
    price: Number(r.base_price),
    price_unit: 'night',
    currency: '₱',
    location: r.location || '',
    city: r.city,
    country: r.country,
    bedrooms: r.bedroom_count,
    bathrooms: r.bathroom_count,
    square_feet: r.area_sqm ? Math.round(r.area_sqm * 10.764) : null,
    property_type: r.unit_type,
    main_image_url: r.main_image_url || null,
    amenities: parseJsonArray(r.amenities) || [],
    is_available: r.status === 'available',
    is_featured: Boolean(r.is_featured),
    min_pax: r.min_pax ? Number(r.min_pax) : null,
    max_capacity: r.max_capacity != null ? Number(r.max_capacity) : null,
    excess_pax_fee: r.excess_pax_fee != null ? Number(r.excess_pax_fee) : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

const unitsSql = `
  SELECT u.unit_id, u.unit_name, u.location, u.city, u.country,
         u.bedroom_count, u.bathroom_count, u.area_sqm, u.unit_type,
         u.description, u.amenities, u.min_pax, u.max_capacity,
         u.base_price, u.excess_pax_fee, u.status, u.is_featured,
         u.check_in_time, u.check_out_time, u.latitude, u.longitude,
         u.created_at, u.updated_at,
         (SELECT image_url FROM unit_image WHERE unit_id = u.unit_id ORDER BY is_main DESC, sort_order ASC LIMIT 1) AS main_image_url
  FROM unit u
  INNER JOIN unit_agent ua ON ua.unit_id = u.unit_id
  WHERE u.status = 'available'
`;

/**
 * GET /api/agents/me/properties
 * List units assigned to the current agent. Requires auth.
 */
async function getMyProperties(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [rows] = await pool.query(
      `${unitsSql} AND ua.agent_user_id = ? ORDER BY u.is_featured DESC, u.updated_at DESC`,
      [userId]
    );
    res.json(rows.map(mapUnitToResponse));
  } catch (error) {
    console.error('Get my properties error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/agents/:username/properties
 * List units assigned to an agent by username. Public endpoint for agent profile page.
 */
async function getPropertiesByUsername(req, res) {
  try {
    const { username } = req.params;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username required' });
    }
    const usernameClean = username.trim().toLowerCase();

    const [rows] = await pool.query(
      `${unitsSql} AND ua.agent_user_id IN (SELECT user_id FROM user_profile WHERE username = ?)
       ORDER BY u.is_featured DESC, u.updated_at DESC`,
      [usernameClean]
    );
    res.json(rows.map(mapUnitToResponse));
  } catch (error) {
    console.error('Get properties by username error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getBalance, getBalanceHistory, getNetwork, listAgents, getMyProperties, getPropertiesByUsername };
