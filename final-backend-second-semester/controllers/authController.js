import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { query } from '../database/postgres/connection.js';

// Validate JWT secret is configured
if (!config.jwtSecret) {
  console.warn('WARNING: JWT_SECRET is not set in environment variables. Authentication will fail.');
}

/**
 * Register a new user
 */
export const register = async (req, res, next) => {
  try {
    // Check if JWT secret is configured
    if (!config.jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error: JWT secret not set' });
    }

    // Check if PostgreSQL is enabled
    if (!config.db.postgres.enabled) {
      return res.status(503).json({ error: 'Database not available. Please enable PostgreSQL.' });
    }
    const { email, password, name, clubName, role } = req.body;

    // Validate input
    if (!email || !password || !name || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, password, name, and role are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Validate role
    const validRoles = ['coach', 'referee', 'manager', 'academy_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user into database
    const result = await query(
      `INSERT INTO users (email, password_hash, name, club_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, email, name, club_name, role, created_at`,
      [email, passwordHash, name, clubName || null, role]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id.toString(), role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Return user data (without password) and token
    res.status(201).json({
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      clubName: user.club_name || undefined,
      role: user.role,
      createdAt: user.created_at.toISOString(),
      token
    });
  } catch (err) {
    // Handle database errors
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    console.error('Registration error:', err);
    next(err);
  }
};

/**
 * Login an existing user
 */
export const login = async (req, res, next) => {
  try {
    // Check if JWT secret is configured
    if (!config.jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error: JWT secret not set' });
    }

    // Check if PostgreSQL is enabled
    if (!config.db.postgres.enabled) {
      return res.status(503).json({ error: 'Database not available. Please enable PostgreSQL.' });
    }

    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user by email
    const result = await query(
      'SELECT id, email, password_hash, name, club_name, role, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id.toString(), role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Return user data (without password) and token
    res.json({
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      clubName: user.club_name || undefined,
      role: user.role,
      createdAt: user.created_at.toISOString(),
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    next(err);
  }
};

