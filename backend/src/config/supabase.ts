import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// ============================================================
// File-Based Persistent JSON Database (Supabase Mock Replacement)
// ============================================================

import os from 'os';

const isVercel = Boolean(process.env.VERCEL);
const PRIMARY_DATA_DIR = path.resolve(__dirname, '../../../data');
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'data') : PRIMARY_DATA_DIR;
const DB_FILE = path.join(DATA_DIR, 'db.json');

// In-memory tables
export const mockOrders: any[] = [];
export const mockNotifications: any[] = [];
export const mockProfiles: any[] = [];
export const mockUsers: any[] = [];

// Helper to save data to db.json
export function saveDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = {
      users: mockUsers,
      profiles: mockProfiles,
      orders: mockOrders,
      notifications: mockNotifications,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (error) {
    // Silent catch on read-only environments
  }
}

export function ensureDefaultAccounts() {
  const adminId = 'admin-uuid-1111-1111-111111111111';
  const studentId = 'student-uuid-2222-2222-222222222222';
  const profId = 'prof-uuid-3333-3333-333333333333';

  const defaultUsers = [
    { id: adminId, email: 'admin@college.edu', password: 'admin123', role: 'admin' },
    { id: studentId, email: 'student@college.edu', password: 'student123', role: 'user' },
    { id: profId, email: 'professor@college.edu', password: 'professor123', role: 'user' }
  ];

  for (const du of defaultUsers) {
    if (!mockUsers.some(u => u.email.toLowerCase() === du.email.toLowerCase())) {
      mockUsers.push(du);
    }
  }

  const defaultProfiles = [
    {
      id: adminId,
      full_name: 'Campus IT Admin',
      role: 'admin',
      department: 'IT Services',
      quota_limit: 9999,
      quota_used: 0,
      created_at: new Date().toISOString()
    },
    {
      id: studentId,
      full_name: 'Alex Mercer (Student)',
      role: 'user',
      department: 'Computer Science',
      quota_limit: 100,
      quota_used: 12,
      created_at: new Date().toISOString()
    },
    {
      id: profId,
      full_name: 'Dr. Sarah Connor (Professor)',
      role: 'user',
      department: 'Electrical Engineering',
      quota_limit: 500,
      quota_used: 145,
      created_at: new Date().toISOString()
    }
  ];

  for (const dp of defaultProfiles) {
    if (!mockProfiles.some(p => p.id === dp.id)) {
      mockProfiles.push(dp);
    }
  }
}

// Helper to load data from db.json
export function loadDb() {
  try {
    const fileToLoad = fs.existsSync(DB_FILE) 
      ? DB_FILE 
      : path.join(PRIMARY_DATA_DIR, 'db.json');

    if (fs.existsSync(fileToLoad)) {
      const content = fs.readFileSync(fileToLoad, 'utf-8');
      const data = JSON.parse(content);
      
      mockUsers.length = 0;
      mockUsers.push(...(data.users || []));
      
      mockProfiles.length = 0;
      mockProfiles.push(...(data.profiles || []));
      
      mockOrders.length = 0;
      mockOrders.push(...(data.orders || []));
      
      mockNotifications.length = 0;
      mockNotifications.push(...(data.notifications || []));
      
      ensureDefaultAccounts();
      console.log('[DB] Loaded from file successfully.');
      return;
    }
  } catch (error) {
    console.error('[DB] Load error, using in-memory defaults:', error);
  }

  // Prepopulate default accounts if no DB file exists
  console.log('[DB] DB file not found. Prepopulating default college accounts...');
  ensureDefaultAccounts();
  saveDb();
}

// Initial load on start
loadDb();

class QueryBuilder {
  private tableName: string;
  private filters: { field: string; val: any; operator: string }[] = [];
  private orderField: string = '';
  private orderAsc: boolean = true;
  private limitCount: number = 50;
  private isSingle: boolean = false;
  private isCount: boolean = false;
  private updateData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields: string = '*', options?: { count?: string; head?: boolean }) {
    if (options?.count) {
      this.isCount = true;
    }
    return this;
  }

  insert(data: any) {
    const list = this.getTable();
    const rows = Array.isArray(data) ? data : [data];
    const inserted: any[] = [];
    for (const r of rows) {
      const row = {
        id: r.id || uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...r
      };
      list.push(row);
      inserted.push(row);
    }
    
    saveDb();
    const result = Array.isArray(data) ? inserted : inserted[0];
    
    // Create a chain builder for inserts (select().single())
    const chainBuilder: any = {
      then: (resolve: any) => resolve({ data: result, error: null }),
      select: () => ({
        single: () => ({
          then: (resolve: any) => resolve({ data: result, error: null })
        })
      })
    };
    return chainBuilder;
  }

  update(data: any) {
    this.updateData = data;
    return this;
  }

  eq(field: string, val: any) {
    this.filters.push({ field, val, operator: 'eq' });
    return this;
  }

  gte(field: string, val: any) {
    this.filters.push({ field, val, operator: 'gte' });
    return this;
  }

  in(field: string, val: any[]) {
    this.filters.push({ field, val, operator: 'in' });
    return this;
  }

  or(filterStr: string) {
    this.filters.push({ field: 'or', val: filterStr, operator: 'or' });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    const promise = new Promise<any>((resolve) => {
      try {
        const list = this.getTable();
        let filtered = [...list];

        // Apply filters
        for (const filter of this.filters) {
          if (filter.operator === 'eq') {
            filtered = filtered.filter(item => String(item[filter.field]) === String(filter.val));
          } else if (filter.operator === 'gte') {
            filtered = filtered.filter(item => new Date(item[filter.field]) >= new Date(filter.val));
          } else if (filter.operator === 'in') {
            filtered = filtered.filter(item => filter.val.includes(item[filter.field]));
          } else if (filter.operator === 'or') {
            const searchMatch = filter.val.match(/ilike\.(.*?)(?:,|$)/);
            const searchVal = searchMatch ? searchMatch[1].replace(/%/g, '').toLowerCase() : '';
            if (searchVal) {
              filtered = filtered.filter(item => 
                (item.order_number && item.order_number.toLowerCase().includes(searchVal)) ||
                (item.file_name && item.file_name.toLowerCase().includes(searchVal))
              );
            }
          }
        }

        // If it is an update operation
        if (this.updateData) {
          filtered.forEach(item => {
            Object.assign(item, this.updateData, { updated_at: new Date().toISOString() });
          });
          saveDb();
          resolve({ data: this.isSingle ? filtered[0] : filtered, error: null });
          return;
        }

        // Sorting
        if (this.orderField) {
          filtered.sort((a, b) => {
            const valA = a[this.orderField];
            const valB = b[this.orderField];
            if (valA < valB) return this.orderAsc ? -1 : 1;
            if (valA > valB) return this.orderAsc ? 1 : -1;
            return 0;
          });
        }

        // Limit
        filtered = filtered.slice(0, this.limitCount);

        if (this.isCount) {
          resolve({ count: filtered.length, data: null, error: null });
        } else if (this.isSingle) {
          resolve({ data: filtered[0] || null, error: filtered[0] ? null : new Error('Not found') });
        } else {
          resolve({ data: filtered, error: null });
        }
      } catch (err: any) {
        resolve({ data: null, error: err });
      }
    });

    return promise.then(onfulfilled, onrejected);
  }

  private getTable() {
    if (this.tableName === 'orders') return mockOrders;
    if (this.tableName === 'notifications') return mockNotifications;
    if (this.tableName === 'profiles') return mockProfiles;
    if (this.tableName === 'users') return mockUsers;
    return [];
  }
}

export const supabaseAdmin = {
  from: (tableName: string) => new QueryBuilder(tableName),
  auth: {
    getUser: async (token: string) => {
      ensureDefaultAccounts();
      // Decode simulated token "Session-{userId}"
      if (token && token.startsWith('Session-')) {
        const userId = token.replace('Session-', '');
        let user = mockUsers.find(u => u.id === userId);
        if (!user) {
          const profile = mockProfiles.find(p => p.id === userId);
          user = {
            id: userId,
            email: profile ? (profile.role === 'admin' ? 'admin@college.edu' : 'student@college.edu') : 'user@college.edu',
            role: profile ? profile.role : (userId.includes('admin') ? 'admin' : 'user')
          };
          mockUsers.push(user);
        }
        return { data: { user }, error: null };
      }
      return { data: { user: null }, error: new Error('User not found') };
    }
  }
};

export const supabaseAnon = supabaseAdmin;
