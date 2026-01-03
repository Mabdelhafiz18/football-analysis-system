import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';

// Mock user management for now
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Mock user
    const user = {
      id: "1",
      email: email,
      name: email.split('@')[0],
      role: 'manager'
    };

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ ...user, token });
  } catch (err) {
    next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const { email, name, role } = req.body;
    
    const user = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name,
      role
    };

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({ ...user, token });
  } catch (err) {
    next(err);
  }
};

