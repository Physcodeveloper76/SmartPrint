import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, mockUsers, mockProfiles, saveDb, ensureDefaultAccounts } from '../config/supabase';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  ensureDefaultAccounts();
  const { email, password, fullName, department, role = 'user' } = req.body;

  if (!email || !password || !fullName || !department) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Check if user exists
  const existingUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists with this email' });
  }

  try {
    const userId = uuidv4();
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      password,
      role
    };

    const isProfessor = email.toLowerCase().includes('prof') || email.toLowerCase().includes('faculty') || fullName.toLowerCase().includes('dr.');
    const quotaLimit = isProfessor ? 500 : 100;

    const newProfile = {
      id: userId,
      full_name: fullName,
      role,
      department,
      quota_limit: quotaLimit,
      quota_used: 0,
      created_at: new Date().toISOString()
    };

    mockUsers.push(newUser);
    mockProfiles.push(newProfile);
    saveDb();

    const token = `Session-${userId}`;
    res.status(201).json({
      token,
      user: { id: userId, email: newUser.email },
      profile: newProfile
    });
  } catch (error: any) {
    console.error('[Auth Register] Error:', error);
    res.status(500).json({ message: 'Internal server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  ensureDefaultAccounts();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = mockUsers.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  let profile = mockProfiles.find(p => p.id === user.id);
  if (!profile) {
    const isProfessor = user.email.toLowerCase().includes('prof');
    const isAdmin = user.email.toLowerCase().includes('admin') || user.role === 'admin';
    profile = {
      id: user.id,
      full_name: isAdmin ? 'Campus IT Admin' : isProfessor ? 'Dr. Sarah Connor (Professor)' : 'Student User',
      role: isAdmin ? 'admin' : 'user',
      department: isAdmin ? 'IT Services' : isProfessor ? 'Electrical Engineering' : 'Computer Science',
      quota_limit: isAdmin ? 9999 : isProfessor ? 500 : 100,
      quota_used: 0,
      created_at: new Date().toISOString()
    };
    mockProfiles.push(profile);
  }

  const token = `Session-${user.id}`;

  res.json({
    token,
    user: { id: user.id, email: user.email },
    profile
  });
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  ensureDefaultAccounts();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ message: 'Session expired or invalid' });
  }

  let profile = mockProfiles.find(p => p.id === data.user.id);
  if (!profile) {
    const isProfessor = data.user.email.toLowerCase().includes('prof');
    const isAdmin = data.user.email.toLowerCase().includes('admin') || data.user.role === 'admin';
    profile = {
      id: data.user.id,
      full_name: isAdmin ? 'Campus IT Admin' : isProfessor ? 'Dr. Sarah Connor (Professor)' : 'Student User',
      role: isAdmin ? 'admin' : 'user',
      department: isAdmin ? 'IT Services' : isProfessor ? 'Electrical Engineering' : 'Computer Science',
      quota_limit: isAdmin ? 9999 : isProfessor ? 500 : 100,
      quota_used: 0,
      created_at: new Date().toISOString()
    };
    mockProfiles.push(profile);
  }

  res.json({
    user: { id: data.user.id, email: data.user.email },
    profile
  });
});

export default router;
