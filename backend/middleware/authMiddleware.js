import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { query } from '../database/postgres/connection.js';

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user info to req.user
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired' });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      return res.status(401).json({ error: 'Token verification failed' });
    }

    // Fetch user from database to ensure they still exist
    const result = await query(
      'SELECT id, email, name, club_name, role, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Attach user info to request object
    req.user = {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      clubName: user.club_name,
      role: user.role,
      createdAt: user.created_at.toISOString()
    };

    next();
  } catch (err) {
    console.error('Authentication middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional role-based authorization middleware
 * Use after authenticateToken to check if user has required role
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions. Required role: ' + allowedRoles.join(' or ') 
      });
    }

    next();
  };
};
