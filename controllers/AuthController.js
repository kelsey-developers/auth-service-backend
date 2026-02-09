const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class AuthController {
  constructor(pool, jwtSecret) {
    this.pool = pool;
    this.jwtSecret = jwtSecret;
  }

  async login(req, res) {
    try {
      const { email, password } = req.query;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const [rows] = await this.pool.query(
        'SELECT id, email, password FROM users WHERE email = ?',
        [email]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = rows[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      res.json({
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 86400,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async userinfo(req, res) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' });
      }

      const token = authHeader.substring(7);
      let decoded;
      try {
        decoded = jwt.verify(token, this.jwtSecret);
      } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const [rows] = await this.pool.query(
        'SELECT id, email, created_at, updated_at FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = rows[0];
      res.json({
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      });
    } catch (error) {
      console.error('UserInfo error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = AuthController;
