import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Receipt, 
  CreditCard, 
  PlusCircle, 
  ArrowRight, 
  LogOut, 
  Wallet,
  ArrowLeft,
  Utensils,
  Bed,
  Plane,
  Fuel,
  Tag,
  Copy,
  Check,
  Trash2,
  Calendar,
  Sparkles,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2
} from 'lucide-react';
import { apiClient } from './api/client';

interface User {
  userId: string;
  fullName: string;
  email: string;
  token: string;
}

interface Group {
  id: string;
  name: string;
  currencyCode: string;
  inviteCode: string;
  createdBy: string;
  members: Member[];
}

interface Member {
  id: string;
  userId?: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  isVirtual: boolean;
}

type ExpenseCategory = 'FOOD' | 'STAY' | 'TRAVEL' | 'FUEL' | 'GENERAL';

interface Expense {
  id: string;
  title: string;
  totalAmount: number;
  paidByMemberId: string;
  splitType: string;
  category: ExpenseCategory;
  expenseDate: string;
  splits: { memberId: string; owedAmount: number }[];
}

interface SimplifiedTransfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

interface BalanceReport {
  groupId: string;
  netBalances: { memberId: string; netBalance: number }[];
  simplifiedDebts: SimplifiedTransfer[];
}

const CATEGORIES: { id: ExpenseCategory; label: string; icon: React.ElementType; color: string; bg: string; text: string }[] = [
  { id: 'FOOD', label: 'Food & Drinks', icon: Utensils, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  { id: 'STAY', label: 'Stay & Hotel', icon: Bed, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800' },
  { id: 'TRAVEL', label: 'Travel & Flights', icon: Plane, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200', text: 'text-sky-800' },
  { id: 'FUEL', label: 'Fuel & Cab', icon: Fuel, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800' },
  { id: 'GENERAL', label: 'General / Misc', icon: Tag, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', text: 'text-gray-800' },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('tallyup_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Navigation: null = Group List (Home), or active selected Group
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupTab, setGroupTab] = useState<'expenses' | 'balances' | 'members'>('expenses');

  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balanceReport, setBalanceReport] = useState<BalanceReport | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Copy invite token feedback state
  const [copiedCode, setCopiedCode] = useState(false);

  // Auth form states
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authError, setAuthError] = useState('');

  // New Group state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCurrency, setNewGroupCurrency] = useState('INR');

  // New Virtual Member state
  const [newMemberName, setNewMemberName] = useState('');

  // New Expense state
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory>('GENERAL');
  const [newExpenseDate, setNewExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Settle up modal
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlePayer, setSettlePayer] = useState('');
  const [settleReceiver, setSettleReceiver] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  useEffect(() => {
    if (currentUser) {
      loadUserGroups();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupExpenses(selectedGroup.id);
      loadGroupBalances(selectedGroup.id);
      if (selectedGroup.members.length > 0 && !newExpensePayer) {
        setNewExpensePayer(selectedGroup.members[0].id);
      }
    }
  }, [selectedGroup]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const endpoint = isLoginMode ? '/api/groups/auth/login' : '/api/groups/auth/register';
      const payload = isLoginMode 
        ? { email: authEmail, password: authPassword }
        : { email: authEmail, password: authPassword, fullName: authFullName };

      const res = await apiClient.post(endpoint, payload);
      const userData: User = {
        userId: res.data.userId,
        fullName: res.data.fullName,
        email: res.data.email,
        token: res.data.token,
      };

      localStorage.setItem('tallyup_token', res.data.token);
      localStorage.setItem('tallyup_user', JSON.stringify(userData));
      setCurrentUser(userData);
    } catch (err: any) {
      setAuthError(err.response?.data?.message || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tallyup_token');
    localStorage.removeItem('tallyup_user');
    setCurrentUser(null);
    setSelectedGroup(null);
  };

  const loadUserGroups = async () => {
    try {
      const res = await apiClient.get('/api/groups');
      setGroups(res.data);
      // If a group was active, refresh its details
      if (selectedGroup) {
        const refreshed = res.data.find((g: Group) => g.id === selectedGroup.id);
        if (refreshed) setSelectedGroup(refreshed);
      }
    } catch (err) {
      console.error('Failed to load groups', err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const res = await apiClient.post('/api/groups', { 
        name: newGroupName.trim(), 
        currencyCode: newGroupCurrency || 'INR' 
      });
      setGroups([res.data, ...groups]);
      setSelectedGroup(res.data);
      setGroupTab('expenses');
      setNewGroupName('');
      setShowCreateGroupModal(false);
    } catch (err) {
      console.error('Failed to create group', err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMemberName.trim()) return;
    try {
      const res = await apiClient.post(`/api/groups/${selectedGroup.id}/members`, { 
        displayName: newMemberName.trim() 
      });
      const updatedMembers = [...selectedGroup.members, res.data];
      const updatedGroup = { ...selectedGroup, members: updatedMembers };
      setSelectedGroup(updatedGroup);
      setGroups(groups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
      setNewMemberName('');
    } catch (err) {
      console.error('Failed to add member', err);
    }
  };

  const loadGroupExpenses = async (groupId: string) => {
    try {
      const res = await apiClient.get(`/api/expenses/group/${groupId}`);
      setExpenses(res.data);
    } catch (err) {
      console.error('Failed to load expenses', err);
    }
  };

  const loadGroupBalances = async (groupId: string) => {
    try {
      const res = await apiClient.get(`/api/settlements/group/${groupId}`);
      setBalanceReport(res.data);
    } catch (err) {
      console.error('Failed to load balances', err);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newExpensePayer || !newExpenseAmount || !newExpenseTitle) return;

    try {
      const total = parseFloat(newExpenseAmount);
      const splitPayload = selectedGroup.members.map(m => ({ memberId: m.id }));

      await apiClient.post('/api/expenses', {
        groupId: selectedGroup.id,
        paidByMemberId: newExpensePayer,
        title: newExpenseTitle.trim(),
        totalAmount: total,
        splitType: 'EQUAL',
        category: newExpenseCategory,
        expenseDate: newExpenseDate,
        splits: splitPayload,
      });

      setShowAddExpenseModal(false);
      setNewExpenseTitle('');
      setNewExpenseAmount('');
      setNewExpenseCategory('GENERAL');
      loadGroupExpenses(selectedGroup.id);
      loadGroupBalances(selectedGroup.id);
    } catch (err) {
      console.error('Failed to add expense', err);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!selectedGroup || !confirm('Are you sure you want to delete this expense?')) return;
    try {
      await apiClient.delete(`/api/expenses/${expenseId}`);
      loadGroupExpenses(selectedGroup.id);
      loadGroupBalances(selectedGroup.id);
    } catch (err) {
      console.error('Failed to delete expense', err);
    }
  };

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !settlePayer || !settleReceiver || !settleAmount) return;

    try {
      await apiClient.post('/api/settlements', {
        groupId: selectedGroup.id,
        payerMemberId: settlePayer,
        receiverMemberId: settleReceiver,
        amount: parseFloat(settleAmount),
        notes: 'Direct settlement'
      });

      setShowSettleModal(false);
      setSettleAmount('');
      loadGroupBalances(selectedGroup.id);
    } catch (err) {
      console.error('Failed to record settlement', err);
    }
  };

  const handleCopyInvite = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getMemberName = (memberId: string) => {
    const member = selectedGroup?.members.find(m => m.id === memberId);
    return member ? member.displayName : 'Unknown';
  };

  const getCategoryMeta = (cat: ExpenseCategory = 'GENERAL') => {
    return CATEGORIES.find(c => c.id === cat) || CATEGORIES[4];
  };

  const filteredExpenses = expenses.filter(exp => {
    if (selectedCategoryFilter === 'ALL') return true;
    return exp.category === selectedCategoryFilter;
  });

  const totalGroupSpend = expenses.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

  // Auth Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-100 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-200 mb-3">
              <Wallet className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">TallyUp</h1>
            <p className="text-gray-500 mt-1.5 text-sm">Lightweight, zero-paywall group expense splitting</p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setIsLoginMode(true); setAuthError(''); }}
              className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition ${
                isLoginMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLoginMode(false); setAuthError(''); }}
              className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition ${
                !isLoginMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginMode && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={authFullName}
                  onChange={(e) => setAuthFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                  placeholder="e.g. Saurabh Kumar"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Password</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-200 transition"
            >
              {isLoginMode ? 'Sign In' : 'Get Started'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/95">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedGroup(null)}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-200 group-hover:scale-105 transition">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-xl font-black bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
                TallyUp
              </span>
            </button>

            {/* Breadcrumb if inside a group */}
            {selectedGroup && (
              <div className="flex items-center gap-2 text-sm">
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-xs">
                  {selectedGroup.name}
                </span>
                <span className="hidden sm:inline-block bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                  {selectedGroup.currencyCode}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold border border-emerald-300">
                {currentUser.fullName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-slate-700">
                {currentUser.fullName}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 transition p-1.5 rounded-lg hover:bg-slate-100"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main App Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {/* ========================================================================= */}
        {/* VIEW 1: MY GROUPS DIRECTORY (When selectedGroup is null)                  */}
        {/* ========================================================================= */}
        {!selectedGroup ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-900/10">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Zero Paywall Splitter
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Your Expense Groups</h1>
                <p className="text-emerald-100 text-sm mt-1">Select a group to log bills, view net balances, and settle debts.</p>
              </div>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="bg-white hover:bg-emerald-50 text-emerald-800 font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600" /> Create Group
              </button>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group);
                    setGroupTab('expenses');
                  }}
                  className="group bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition">
                        {group.name}
                      </h3>
                      <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-slate-100 text-slate-600">
                        {group.currencyCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{group.members.length} member{group.members.length === 1 ? '' : 's'}</span>
                      <span>•</span>
                      <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        Code: {group.inviteCode}
                      </span>
                    </div>

                    {/* Member Avatars Stack */}
                    <div className="flex items-center -space-x-2 overflow-hidden py-1 mb-4">
                      {group.members.slice(0, 5).map((m, idx) => (
                        <div
                          key={m.id}
                          title={m.displayName}
                          className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-700 shadow-xs"
                          style={{ backgroundColor: ['#d1fae5', '#e0e7ff', '#fef3c7', '#fee2e2', '#f3e8ff'][idx % 5] }}
                        >
                          {m.displayName.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {group.members.length > 5 && (
                        <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                          +{group.members.length - 5}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:translate-x-0.5 transition">
                    <span>Enter Group</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ))}

              {/* Blank state if no groups */}
              {groups.length === 0 && (
                <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">No Groups Yet</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Create your first trip or flat group to start splitting bills and calculating balances.
                  </p>
                  <button
                    onClick={() => setShowCreateGroupModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
                  >
                    + Create Your First Group
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: INSIDE SELECTED GROUP                                             */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Group Header & Actions */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition"
                    title="Back to all groups"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight">{selectedGroup.name}</h1>
                      <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {selectedGroup.currencyCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span>{selectedGroup.members.length} Members</span>
                      <span>•</span>
                      <button
                        onClick={() => handleCopyInvite(selectedGroup.inviteCode)}
                        className="inline-flex items-center gap-1 font-mono text-emerald-700 hover:text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/70 px-2 py-0.5 rounded transition"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedCode ? 'Copied Link Code!' : `Code: ${selectedGroup.inviteCode}`}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => setShowAddExpenseModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-md shadow-emerald-200 flex items-center gap-2 transition cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" /> Add Expense
                  </button>
                  <button
                    onClick={() => setShowSettleModal(true)}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3.5 py-2.5 rounded-xl text-sm flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" /> Settle Up
                  </button>
                </div>
              </div>

              {/* Group Quick Stats */}
              <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100 text-center">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Total Spending</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">
                    {selectedGroup.currencyCode === 'INR' ? '₹' : selectedGroup.currencyCode} {totalGroupSpend.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Total Bills</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{expenses.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Active Debts</p>
                  <p className="text-lg font-bold text-emerald-600 mt-0.5">
                    {balanceReport?.simplifiedDebts.length || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* In-Group Tabs */}
            <div className="flex items-center gap-2 bg-slate-200/60 p-1 rounded-xl w-fit">
              <button
                onClick={() => setGroupTab('expenses')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  groupTab === 'expenses'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" /> Expenses ({expenses.length})
              </button>
              <button
                onClick={() => setGroupTab('balances')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  groupTab === 'balances'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Balances & Transfers
              </button>
              <button
                onClick={() => setGroupTab('members')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  groupTab === 'members'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Members ({selectedGroup.members.length})
              </button>
            </div>

            {/* TAB CONTENT 1: EXPENSES LEDGER */}
            {groupTab === 'expenses' && (
              <div className="space-y-4">
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    onClick={() => setSelectedCategoryFilter('ALL')}
                    className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap ${
                      selectedCategoryFilter === 'ALL'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    All Categories
                  </button>
                  {CATEGORIES.map(cat => {
                    const CatIcon = cat.icon;
                    const count = expenses.filter(e => e.category === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryFilter(cat.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition whitespace-nowrap ${
                          selectedCategoryFilter === cat.id
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <CatIcon className="w-3 h-3" />
                        <span>{cat.label}</span>
                        {count > 0 && <span className="text-[10px] opacity-80">({count})</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Expense List */}
                <div className="space-y-2.5">
                  {filteredExpenses.map((expense) => {
                    const catMeta = getCategoryMeta(expense.category);
                    const CatIcon = catMeta.icon;
                    return (
                      <div
                        key={expense.id}
                        className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${catMeta.bg}`}>
                            <CatIcon className={`w-5 h-5 ${catMeta.color}`} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 truncate text-sm sm:text-base">
                              {expense.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                              <span className="font-medium text-slate-700">
                                Paid by {getMemberName(expense.paidByMemberId)}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-slate-400">
                                <Calendar className="w-3 h-3" />
                                {expense.expenseDate}
                              </span>
                              <span>•</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                {catMeta.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-base sm:text-lg font-black text-slate-900">
                              ₹{expense.totalAmount.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase">
                              {expense.splits.length} split equal
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredExpenses.length === 0 && (
                    <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                      <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No expenses in this view</p>
                      <p className="text-xs text-slate-400 mt-1">Tap "+ Add Expense" to log a new bill.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: BALANCES & TRANSFERS */}
            {groupTab === 'balances' && (
              <div className="space-y-6">
                {/* Net Balances Overview */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Individual Balances</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {balanceReport?.netBalances.map((b) => {
                      const isCreditor = b.netBalance > 0.005;
                      const isDebtor = b.netBalance < -0.005;
                      return (
                        <div key={b.memberId} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                          <p className="text-xs font-semibold text-slate-500 truncate">{getMemberName(b.memberId)}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            {isCreditor && <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />}
                            {isDebtor && <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />}
                            {!isCreditor && !isDebtor && <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />}
                            <span className={`text-base font-extrabold ${
                              isCreditor ? 'text-emerald-700' : isDebtor ? 'text-rose-700' : 'text-slate-400'
                            }`}>
                              {!isCreditor && !isDebtor ? 'Settled' : `${isCreditor ? '+₹' : '-₹'}${Math.abs(b.netBalance).toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Min-Cash-Flow Debt Simplifier */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Minimum Settlement Transfers</h3>
                      <p className="text-xs text-slate-500">Greedy Min-Cash-Flow graph algorithm collapses cross-debts into at most N - 1 direct payments</p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {balanceReport?.simplifiedDebts.length || 0} transfer{balanceReport?.simplifiedDebts.length === 1 ? '' : 's'} needed
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {balanceReport?.simplifiedDebts.map((transfer, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 hover:bg-emerald-50/40 rounded-xl border border-slate-200/70 transition gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-rose-700">{getMemberName(transfer.fromMemberId)}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">owes</span>
                          <span className="font-bold text-emerald-700">{getMemberName(transfer.toMemberId)}</span>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <span className="text-base font-black text-slate-900">₹{transfer.amount.toFixed(2)}</span>
                          <button
                            onClick={() => {
                              setSettlePayer(transfer.fromMemberId);
                              setSettleReceiver(transfer.toMemberId);
                              setSettleAmount(transfer.amount.toString());
                              setShowSettleModal(true);
                            }}
                            className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition"
                          >
                            Settle This
                          </button>
                        </div>
                      </div>
                    ))}

                    {balanceReport?.simplifiedDebts.length === 0 && (
                      <div className="py-8 text-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-800">Everyone is fully settled up!</p>
                        <p className="text-xs text-slate-400 mt-0.5">No pending debts inside this group.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: MEMBERS & TRICOUNT INVITES */}
            {groupTab === 'members' && (
              <div className="space-y-6">
                {/* Shareable Invite Banner */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-emerald-950 text-base">Zero-Friction Guest Participation</h4>
                      <p className="text-xs text-emerald-800 mt-1 max-w-lg">
                        Friends can view balances immediately without downloading an app. When they register, they can claim their virtual slot.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold bg-white px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-900 shadow-xs">
                        {selectedGroup.inviteCode}
                      </span>
                      <button
                        onClick={() => handleCopyInvite(selectedGroup.inviteCode)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCode ? 'Copied' : 'Copy Code'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Add Member Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Add Member by Name (Tricount Style)</h3>
                  <p className="text-xs text-slate-500 mb-3">Add friends right now to include them in bills. They do not need an account.</p>
                  <form onSubmit={handleAddMember} className="flex gap-2 max-w-md">
                    <input
                      type="text"
                      required
                      placeholder="Display Name (e.g. Rahul, Pooja)"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
                    >
                      Add Member
                    </button>
                  </form>
                </div>

                {/* Members List */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Current Members ({selectedGroup.members.length})</h3>
                  <div className="divide-y divide-slate-100">
                    {selectedGroup.members.map((member) => (
                      <div key={member.id} className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200">
                            {member.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{member.displayName}</p>
                            <p className="text-xs text-slate-400">
                              {member.isVirtual ? 'Virtual Placeholder (Unclaimed)' : 'Registered User'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            member.role === 'ADMIN' 
                              ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {member.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: CREATE GROUP                                                      */}
      {/* ========================================================================= */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-black text-slate-900 mb-1">Create New Expense Group</h3>
            <p className="text-xs text-slate-500 mb-4">Set up a shared trip or apartment ledger in seconds.</p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chopta Roadtrip, Green Flat"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Currency</label>
                <select
                  value={newGroupCurrency}
                  onChange={(e) => setNewGroupCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-200 cursor-pointer"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD EXPENSE WITH CATEGORY SELECTOR                                 */}
      {/* ========================================================================= */}
      {showAddExpenseModal && selectedGroup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-900 mb-1">Add Group Bill</h3>
            <p className="text-xs text-slate-500 mb-4">Bills will be split equally with penny-exact remainder allocation.</p>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              {/* Category Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Category</label>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORIES.map(cat => {
                    const CatIcon = cat.icon;
                    const isSelected = newExpenseCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNewExpenseCategory(cat.id)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <CatIcon className={`w-5 h-5 mb-1 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`} />
                        <span className="text-[10px] truncate max-w-full">{cat.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zostel Stay, Dinner at Cafe, Fuel"
                  value={newExpenseTitle}
                  onChange={(e) => setNewExpenseTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="100.00"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newExpenseDate}
                    onChange={(e) => setNewExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Paid By</label>
                <select
                  required
                  value={newExpensePayer}
                  onChange={(e) => setNewExpensePayer(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none cursor-pointer"
                >
                  {selectedGroup.members.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                <span className="font-bold text-slate-800">Equal Split:</span> This amount will be divided equally across all {selectedGroup.members.length} members ({selectedGroup.members.map(m => m.displayName).join(', ')}).
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-200 cursor-pointer"
                >
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SETTLE UP PAYMENT                                                  */}
      {/* ========================================================================= */}
      {showSettleModal && selectedGroup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-black text-slate-900 mb-1">Record Direct Settlement</h3>
            <p className="text-xs text-slate-500 mb-4">Record a direct UPI or cash payment to reduce outstanding debts.</p>

            <form onSubmit={handleRecordSettlement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Payer (Who paid)</label>
                <select
                  required
                  value={settlePayer}
                  onChange={(e) => setSettlePayer(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer"
                >
                  <option value="">Select payer</option>
                  {selectedGroup.members.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Receiver (Who received)</label>
                <select
                  required
                  value={settleReceiver}
                  onChange={(e) => setSettleReceiver(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer"
                >
                  <option value="">Select receiver</option>
                  {selectedGroup.members.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-200 cursor-pointer"
                >
                  Record Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
