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

module.exports = { getBalance, getBalanceHistory, getNetwork };
