import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, mockUsers, mockProfiles, saveDb } from '../config/supabase';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
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
      password, // In a real app we'd bcrypt hash this, but simple text matches the prompt's simplicity.
      role
    };

    // Determine campus printing quota limit
    // Students get 100 pages per semester, staff/faculty get 500 pages
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

  const profile = mockProfiles.find(p => p.id === user.id);
  const token = `Session-${user.id}`;

  res.json({
    token,
    user: { id: user.id, email: user.email },
    profile: profile || null
  });
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ message: 'Session expired or invalid' });
  }

  const profile = mockProfiles.find(p => p.id === data.user.id);
  res.json({
    user: { id: data.user.id, email: data.user.email },
    profile: profile || null
  });
});

export default router;
