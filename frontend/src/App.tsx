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
import { GoogleLogin } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';

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

export type ExpenseCategory = 
  | 'ACCOMMODATION'
  | 'ENTERTAINMENT'
  | 'GROCERIES'
  | 'HEALTHCARE'
  | 'INSURANCE'
  | 'RENT'
  | 'RESTAURANTS_BARS'
  | 'SHOPPING'
  | 'TRANSPORT'
  | 'OTHER'
  | 'FOOD'
  | 'STAY'
  | 'TRAVEL'
  | 'FUEL'
  | 'GENERAL'
  | string;

interface CategoryItem {
  id: string;
  label: string;
  emoji: string;
  bg: string;
  border: string;
  text: string;
}

export const CATEGORIES: CategoryItem[] = [
  { id: 'RESTAURANTS_BARS', label: 'Restaurants & Bars', emoji: '🍔', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
  { id: 'GROCERIES', label: 'Groceries', emoji: '🛒', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  { id: 'TRANSPORT', label: 'Transport', emoji: '🚕', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' },
  { id: 'ACCOMMODATION', label: 'Accommodation', emoji: '🛌', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' },
  { id: 'ENTERTAINMENT', label: 'Entertainment', emoji: '🎤', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  { id: 'RENT', label: 'Rent & charges', emoji: '🏠', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  { id: 'SHOPPING', label: 'Shopping', emoji: '🛍️', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800' },
  { id: 'HEALTHCARE', label: 'Healthcare', emoji: '🦷', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800' },
  { id: 'INSURANCE', label: 'Insurance', emoji: '🧯', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800' },
  { id: 'OTHER', label: 'Other', emoji: '✋', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800' },
];

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
  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joinGroupError, setJoinGroupError] = useState<string | null>(null);
  const [invitePreview, setInvitePreview] = useState<{
    groupId: string;
    groupName: string;
    currencyCode: string;
    unclaimedMembers: { id: string; displayName: string }[];
  } | null>(null);
  const [selectedClaimMemberId, setSelectedClaimMemberId] = useState<string>('NEW');

  // New Virtual Member state
  const [newMemberName, setNewMemberName] = useState('');

  // New Expense state
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<string>('RESTAURANTS_BARS');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [newExpenseDate, setNewExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = useState<'EQUAL' | 'EXACT' | 'PERCENTAGE'>('EQUAL');
  const [memberSplitValues, setMemberSplitValues] = useState<Record<string, string>>({});
  const [splitError, setSplitError] = useState<string | null>(null);

  // Helper: Default EXACT split values matching total exactly
  const getDefaultExactSplits = (total: number, memberIds: string[]): Record<string, string> => {
    if (!memberIds.length || total <= 0) return {};
    const count = memberIds.length;
    const baseAmount = Math.floor((total / count) * 100) / 100;
    const res: Record<string, string> = {};
    let allocated = 0;
    memberIds.forEach((id, idx) => {
      if (idx === count - 1) {
        const lastVal = Math.max(0, +(total - allocated).toFixed(2));
        res[id] = lastVal.toFixed(2);
      } else {
        res[id] = baseAmount.toFixed(2);
        allocated += baseAmount;
      }
    });
    return res;
  };

  // Helper: Rebalance EXACT split when one member amount changes
  const handleExactAmountChange = (changedId: string, valStr: string, total: number, memberIds: string[]) => {
    if (total <= 0) {
      setMemberSplitValues(prev => ({ ...prev, [changedId]: valStr }));
      return;
    }
    const rawVal = parseFloat(valStr);
    const newVal = isNaN(rawVal) ? 0 : Math.max(0, Math.min(total, rawVal));
    const otherIds = memberIds.filter(id => id !== changedId);

    if (otherIds.length === 0) {
      setMemberSplitValues({ [changedId]: total.toFixed(2) });
      return;
    }

    const remaining = Math.max(0, +(total - newVal).toFixed(2));
    const nextValues: Record<string, string> = {
      [changedId]: valStr === "" ? "" : newVal.toString()
    };

    if (otherIds.length === 1) {
      nextValues[otherIds[0]] = remaining.toFixed(2);
      setMemberSplitValues(nextValues);
      setSplitError(null);
      return;
    }

    // Proportional redistribution among other members
    const otherCurrent = otherIds.map(id => parseFloat(memberSplitValues[id] || "0") || 0);
    const otherSum = otherCurrent.reduce((a, b) => a + b, 0);

    let allocated = 0;
    otherIds.forEach((id, idx) => {
      if (idx === otherIds.length - 1) {
        const lastVal = Math.max(0, +(remaining - allocated).toFixed(2));
        nextValues[id] = lastVal.toFixed(2);
      } else {
        const ratio = otherSum > 0 ? otherCurrent[idx] / otherSum : 1 / otherIds.length;
        const share = Math.max(0, +(remaining * ratio).toFixed(2));
        nextValues[id] = share.toFixed(2);
        allocated += share;
      }
    });

    setMemberSplitValues(nextValues);
    setSplitError(null);
  };

  // Helper: Default PERCENTAGE split values summing to 100%
  const getDefaultPercentageSplits = (memberIds: string[]): Record<string, string> => {
    if (!memberIds.length) return {};
    const count = memberIds.length;
    const basePct = Math.floor((100 / count) * 10) / 10;
    const res: Record<string, string> = {};
    let allocated = 0;
    memberIds.forEach((id, idx) => {
      if (idx === count - 1) {
        const lastPct = Math.max(0, +(100 - allocated).toFixed(1));
        res[id] = lastPct.toFixed(1);
      } else {
        res[id] = basePct.toFixed(1);
        allocated += basePct;
      }
    });
    return res;
  };

  // Helper: Rebalance PERCENTAGE split when one member percentage changes
  const handlePercentageChange = (changedId: string, valStr: string, memberIds: string[]) => {
    const rawPct = parseFloat(valStr);
    const newPct = isNaN(rawPct) ? 0 : Math.max(0, Math.min(100, rawPct));
    const otherIds = memberIds.filter(id => id !== changedId);

    if (otherIds.length === 0) {
      setMemberSplitValues({ [changedId]: "100.0" });
      return;
    }

    const remainingPct = Math.max(0, +(100 - newPct).toFixed(1));
    const nextValues: Record<string, string> = {
      [changedId]: valStr === "" ? "" : newPct.toString()
    };

    if (otherIds.length === 1) {
      nextValues[otherIds[0]] = remainingPct.toFixed(1);
      setMemberSplitValues(nextValues);
      setSplitError(null);
      return;
    }

    const otherCurrent = otherIds.map(id => parseFloat(memberSplitValues[id] || "0") || 0);
    const otherSum = otherCurrent.reduce((a, b) => a + b, 0);

    let allocated = 0;
    otherIds.forEach((id, idx) => {
      if (idx === otherIds.length - 1) {
        const lastVal = Math.max(0, +(remainingPct - allocated).toFixed(1));
        nextValues[id] = lastVal.toFixed(1);
      } else {
        const ratio = otherSum > 0 ? otherCurrent[idx] / otherSum : 1 / otherIds.length;
        const share = Math.max(0, +(remainingPct * ratio).toFixed(1));
        nextValues[id] = share.toFixed(1);
        allocated += share;
      }
    });

    setMemberSplitValues(nextValues);
    setSplitError(null);
  };

  // Settle up modal
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlePayer, setSettlePayer] = useState('');
  const [settleReceiver, setSettleReceiver] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  // Cloud Server Pre-Warm & Health Monitoring
  const [serverWarmupState, setServerWarmupState] = useState<'checking' | 'waking' | 'ready'>('checking');

  useEffect(() => {
    // 1. Fire silent background requests to all 4 microservices on initial load
    const RENDER_SERVICES = [
      'https://tallyup-api-gateway.onrender.com/actuator/health',
      'https://tallyup-group-service.onrender.com/actuator/health',
      'https://tallyup-expense-service.onrender.com/actuator/health',
      'https://tallyup-settlement-service.onrender.com/actuator/health',
    ];

    RENDER_SERVICES.forEach((url) => {
      fetch(url, { mode: 'no-cors' }).catch(() => {});
    });

    // 2. Poll via CORS-enabled public endpoint to accurately detect when services are awake
    let isMounted = true;
    const checkServerHealth = async () => {
      try {
        await apiClient.get('/api/groups/invite/ping');
        if (isMounted) setServerWarmupState('ready');
      } catch (err: any) {
        // Any response from backend (even 400 Bad Request) confirms the gateway & service are awake!
        const status = err.response?.status;
        if (status && status !== 502 && status !== 503 && status !== 504) {
          if (isMounted) setServerWarmupState('ready');
        } else {
          if (isMounted) {
            setServerWarmupState('waking');
            setTimeout(checkServerHealth, 3000);
          }
        }
      }
    };

    checkServerHealth();
    return () => { isMounted = false; };
  }, []);

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

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setAuthError('');
    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }
      const res = await apiClient.post('/api/groups/auth/google', {
        idToken: credentialResponse.credential,
      });
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
      console.error('Google login failed', err);
      setAuthError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    }
  };

  const handleRemoveMember = async (member: Member) => {
    if (!selectedGroup) return;
    if (selectedGroup.createdBy === member.userId) {
      alert("The group creator cannot be removed from the group.");
      return;
    }
    const isSelf = member.userId === currentUser?.userId;
    const confirmMessage = isSelf
      ? `Are you sure you want to leave "${selectedGroup.name}"?`
      : `Are you sure you want to remove "${member.displayName}" from this group?`;

    if (!confirm(confirmMessage)) return;

    try {
      await apiClient.delete(`/api/groups/${selectedGroup.id}/members/${member.id}`);
      if (isSelf) {
        setSelectedGroup(null);
        loadUserGroups();
        return;
      }
      const updatedMembers = selectedGroup.members.filter(m => m.id !== member.id);
      const updatedGroup = { ...selectedGroup, members: updatedMembers };
      setSelectedGroup(updatedGroup);
      setGroups(groups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
      loadGroupBalances(selectedGroup.id);
      loadGroupExpenses(selectedGroup.id);
    } catch (err: any) {
      console.error("Failed to remove member", err);
      const msg = err?.response?.data?.message || err?.message || "Failed to remove member";
      alert(msg);
    }
  };

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
      if (selectedGroup) {
        const refreshed = res.data.find((g: Group) => g.id === selectedGroup.id);
        if (refreshed) setSelectedGroup(refreshed);
      }
    } catch (err) {
      console.error('Failed to load groups', err);
    }
  };

  const fetchInvitePreview = async (code: string) => {
    const clean = code.trim();
    if (clean.length < 5) {
      setInvitePreview(null);
      return;
    }
    try {
      setJoinGroupError(null);
      const res = await apiClient.get('/api/groups/invite/' + clean);
      setInvitePreview(res.data);
      // Auto-select if matching name exists
      const match = res.data.unclaimedMembers?.find(
        (m: any) => m.displayName.trim().toLowerCase() === currentUser?.fullName.trim().toLowerCase()
      );
      setSelectedClaimMemberId(match ? match.id : 'NEW');
    } catch (err: any) {
      setInvitePreview(null);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInviteCode.trim()) return;
    try {
      setJoinGroupError(null);
      const res = await apiClient.post('/api/groups/join', {
        inviteCode: joinInviteCode.trim(),
        claimMemberId: selectedClaimMemberId === 'NEW' ? null : selectedClaimMemberId
      });
      // Refresh user's groups
      await loadUserGroups();
      setSelectedGroup(res.data);
      setGroupTab('expenses');
      setJoinInviteCode('');
      setInvitePreview(null);
      setSelectedClaimMemberId('NEW');
      setShowJoinGroupModal(false);
    } catch (err: any) {
      console.error('Failed to join group', err);
      const msg = err?.response?.data?.message || 'Invalid invite code or group not found';
      setJoinGroupError(msg);
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
      setSplitError(null);
      const total = parseFloat(newExpenseAmount);
      if (isNaN(total) || total <= 0) {
        setSplitError('Please enter a valid expense amount');
        return;
      }

      let splitPayload: any[] = [];
      if (splitType === 'EQUAL') {
        splitPayload = selectedGroup.members.map(m => ({ memberId: m.id }));
      } else if (splitType === 'EXACT') {
        const sum = selectedGroup.members.reduce(
          (acc, m) => acc + (parseFloat(memberSplitValues[m.id] || '0') || 0),
          0
        );
        if (Math.abs(sum - total) > 0.01) {
          setSplitError('Sum of member amounts (₹' + sum.toFixed(2) + ') must equal total bill (₹' + total.toFixed(2) + ')');
          return;
        }
        splitPayload = selectedGroup.members.map(m => ({
          memberId: m.id,
          owedAmount: parseFloat(memberSplitValues[m.id] || '0') || 0
        }));
      } else if (splitType === 'PERCENTAGE') {
        const sumPct = selectedGroup.members.reduce(
          (acc, m) => acc + (parseFloat(memberSplitValues[m.id] || '0') || 0),
          0
        );
        if (Math.abs(sumPct - 100) > 0.01) {
          setSplitError('Sum of percentages (' + sumPct.toFixed(1) + '%) must equal 100%');
          return;
        }
        splitPayload = selectedGroup.members.map(m => ({
          memberId: m.id,
          shareValue: parseFloat(memberSplitValues[m.id] || '0') || 0
        }));
      }

      const finalCategory = isCustomCategoryMode && customCategoryInput.trim() 
        ? customCategoryInput.trim().toUpperCase().replace(/\s+/g, '_')
        : newExpenseCategory;

      await apiClient.post('/api/expenses', {
        groupId: selectedGroup.id,
        paidByMemberId: newExpensePayer,
        title: newExpenseTitle.trim(),
        totalAmount: total,
        splitType: splitType,
        category: finalCategory,
        expenseDate: newExpenseDate,
        splits: splitPayload,
      });

      setShowAddExpenseModal(false);
      setNewExpenseTitle('');
      setNewExpenseAmount('');
      setCustomCategoryInput('');
      setIsCustomCategoryMode(false);
      setNewExpenseCategory('RESTAURANTS_BARS');
      setSplitType('EQUAL');
      setMemberSplitValues({});
      setSplitError(null);
      loadGroupExpenses(selectedGroup.id);
      loadGroupBalances(selectedGroup.id);
    } catch (err: any) {
      console.error('Failed to add expense', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to add expense';
      setSplitError(msg);
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

  const getCategoryMeta = (cat: string = 'OTHER'): CategoryItem => {
    if (cat === 'FOOD') return CATEGORIES.find(c => c.id === 'RESTAURANTS_BARS')!;
    if (cat === 'STAY') return CATEGORIES.find(c => c.id === 'ACCOMMODATION')!;
    if (cat === 'TRAVEL' || cat === 'FUEL') return CATEGORIES.find(c => c.id === 'TRANSPORT')!;
    if (cat === 'GENERAL') return CATEGORIES.find(c => c.id === 'OTHER')!;
    
    const found = CATEGORIES.find(c => c.id === cat);
    if (found) return found;

    // Handle custom categories dynamically
    const cleanLabel = cat.replace(/_/g, ' ').toLowerCase();
    const formatted = cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1);
    return {
      id: cat,
      label: formatted,
      emoji: '🏷️',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800'
    };
  };

  const filteredExpenses = expenses.filter(exp => {
    if (selectedCategoryFilter === 'ALL') return true;
    const meta = getCategoryMeta(exp.category);
    return meta.id === selectedCategoryFilter;
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

            {/* Cloud Server Warm-up Status Badge */}
            <div className="mt-3 flex justify-center">
              {serverWarmupState === 'waking' ? (
                <div className="inline-flex items-center gap-2 py-1 px-3 bg-amber-50 text-amber-800 text-xs font-semibold rounded-full border border-amber-200 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Waking up cloud servers (takes ~20s)...</span>
                </div>
              ) : serverWarmupState === 'ready' ? (
                <div className="inline-flex items-center gap-1.5 py-1 px-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Servers Ready</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 py-1 px-3 bg-slate-50 text-slate-600 text-xs font-medium rounded-full border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>Connecting to servers...</span>
                </div>
              )}
            </div>
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

          {/* Google Sign-In on Web / Mobile App Notice */}
          {!Capacitor.isNativePlatform() ? (
            <>
              <div className="flex justify-center mb-4">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setAuthError('Google sign-in was canceled or failed.')}
                  theme="outline"
                  size="large"
                  shape="pill"
                  text={isLoginMode ? "signin_with" : "signup_with"}
                  width="320"
                />
              </div>

              <div className="relative flex py-1 items-center mb-4">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-semibold uppercase">Or with email</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>
            </>
          ) : (
            <div className="mb-4 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-center">
              <p className="text-xs font-semibold text-emerald-900">
                📲 Mobile App Sign In
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Sign in with your registered account email & password below.
              </p>
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
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-200 transition cursor-pointer"
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
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button 
              onClick={() => setSelectedGroup(null)}
              className="flex items-center gap-2 group cursor-pointer shrink-0"
              title="Home"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-200 group-hover:scale-105 transition">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className={`${selectedGroup ? "hidden md:inline" : "inline"} text-lg sm:text-xl font-black bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent`}>
                TallyUp
              </span>
            </button>

            {/* Breadcrumb if inside a group */}
            {selectedGroup && (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-bold text-slate-800 truncate max-w-[130px] sm:max-w-xs">
                  {selectedGroup.name}
                </span>
                <span className="hidden sm:inline-block bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold border border-emerald-200 shrink-0">
                  {selectedGroup.currencyCode}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Cloud Server Status Badge in Navbar */}
            {serverWarmupState === 'waking' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold border bg-amber-50 text-amber-800 border-amber-200 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="hidden sm:inline">Waking servers (~20s)...</span>
                <span className="sm:hidden">Waking...</span>
              </div>
            ) : serverWarmupState === 'ready' ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Servers Ready</span>
              </div>
            ) : null}

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
              className="text-slate-400 hover:text-rose-600 transition p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
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
              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                <button
                  onClick={() => {
                    setShowJoinGroupModal(true);
                    setJoinGroupError(null);
                  }}
                  className="bg-emerald-700/80 hover:bg-emerald-700 border border-emerald-400/40 text-white font-bold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <Users className="w-4 h-4 text-emerald-200" /> Join Group
                </button>
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="bg-white hover:bg-emerald-50 text-emerald-800 font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-600" /> Create Group
                </button>
              </div>
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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition cursor-pointer"
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
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer"
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
                        className="inline-flex items-center gap-1 font-mono text-emerald-700 hover:text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/70 px-2 py-0.5 rounded transition cursor-pointer"
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
                  <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase truncate">Spending</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">
                    {selectedGroup.currencyCode === 'INR' ? '₹' : selectedGroup.currencyCode} {totalGroupSpend.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase truncate">Bills</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{expenses.length}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase truncate">Debts</p>
                  <p className="text-lg font-bold text-emerald-600 mt-0.5">
                    {balanceReport?.simplifiedDebts.length || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* In-Group Tabs */}
            <div className="flex items-center gap-1 sm:gap-2 bg-slate-200/60 p-1 rounded-xl w-full sm:w-fit overflow-x-auto no-scrollbar">
              <button
                onClick={() => setGroupTab('expenses')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  groupTab === 'expenses'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" /> Expenses ({expenses.length})
              </button>
              <button
                onClick={() => setGroupTab('balances')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  groupTab === 'balances'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Balances & Transfers
              </button>
              <button
                onClick={() => setGroupTab('members')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
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
                    className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer ${
                      selectedCategoryFilter === 'ALL'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    All Categories
                  </button>
                  {CATEGORIES.map(cat => {
                    const count = expenses.filter(e => getCategoryMeta(e.category).id === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryFilter(cat.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition whitespace-nowrap cursor-pointer ${
                          selectedCategoryFilter === cat.id
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <span>{cat.emoji}</span>
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
                    return (
                      <div
                        key={expense.id}
                        className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Left: Category Icon + Title + Meta */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border text-lg sm:text-xl mt-0.5 ${catMeta.bg} ${catMeta.border}`}>
                              <span>{catMeta.emoji}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-slate-900 truncate text-sm sm:text-base">
                                {expense.title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                Paid by <span className="font-semibold text-slate-700">{getMemberName(expense.paidByMemberId)}</span>
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold border ${catMeta.bg} ${catMeta.border} ${catMeta.text}`}>
                                  <span>{catMeta.emoji}</span>
                                  <span>{catMeta.label}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
                                  <Calendar className="w-3 h-3" />
                                  {expense.expenseDate}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Amount + Split info + Delete Button */}
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-base sm:text-lg font-black text-slate-900">
                                ₹{expense.totalAmount.toFixed(2)}
                              </p>
                              <p className="text-[10px] text-slate-400 font-semibold uppercase">
                                {expense.splits.length} split • {expense.splitType ? expense.splitType.toLowerCase() : 'equal'}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                            className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition cursor-pointer"
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
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
                      className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-sm transition cursor-pointer"
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

                          {/* Delete Member action */}
                          {selectedGroup.createdBy !== member.userId && (
                            <button
                              onClick={() => handleRemoveMember(member)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title={member.userId === currentUser?.userId ? "Leave group" : "Remove member"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Floating Action Button for Mobile */}
        {selectedGroup && (
          <button
            onClick={() => setShowAddExpenseModal(true)}
            className="sm:hidden fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-4 py-3.5 rounded-full shadow-xl shadow-emerald-700/30 flex items-center gap-2 transition cursor-pointer"
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-sm">Add Bill</span>
          </button>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: JOIN GROUP VIA INVITE CODE                                        */}
      {/* ========================================================================= */}
      {showJoinGroupModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Join an Existing Group</h3>
                <p className="text-xs text-slate-500">Enter the 6-letter invite code shared by your friend.</p>
              </div>
            </div>

            <form onSubmit={handleJoinGroup} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Invite Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={12}
                  autoFocus
                  placeholder="e.g. RSsQuQ0eeI"
                  value={joinInviteCode}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setJoinInviteCode(val);
                    fetchInvitePreview(val);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center text-lg tracking-widest font-black text-emerald-900 focus:bg-white focus:outline-emerald-500"
                />
              </div>

              {/* Live Preview & Claim Slot Selection */}
              {invitePreview && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900">Group: {invitePreview.groupName}</span>
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                      {invitePreview.currencyCode}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Who are you in this group?
                    </label>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
                      {invitePreview.unclaimedMembers && invitePreview.unclaimedMembers.length > 0 && (
                        invitePreview.unclaimedMembers.map(m => (
                          <label
                            key={m.id}
                            className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                              selectedClaimMemberId === m.id
                                ? 'bg-white border-emerald-500 text-emerald-900 font-bold shadow-xs'
                                : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="claimMember"
                              value={m.id}
                              checked={selectedClaimMemberId === m.id}
                              onChange={() => setSelectedClaimMemberId(m.id)}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="truncate">Claim slot: <strong>{m.displayName}</strong></span>
                          </label>
                        ))
                      )}

                      <label
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                          selectedClaimMemberId === 'NEW'
                            ? 'bg-white border-emerald-500 text-emerald-900 font-bold shadow-xs'
                            : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="claimMember"
                          value="NEW"
                          checked={selectedClaimMemberId === 'NEW'}
                          onChange={() => setSelectedClaimMemberId('NEW')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Join as new member (<strong>{currentUser.fullName}</strong>)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {joinGroupError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {joinGroupError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinGroupModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-200 cursor-pointer"
                >
                  Join Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
      {/* MODAL: ADD EXPENSE WITH ELEGANT VISUAL CATEGORY SELECTOR                   */}
      {/* ========================================================================= */}
      {showAddExpenseModal && selectedGroup && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xl font-black text-slate-900">Add Group Expense</h3>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {selectedGroup.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-5">Select a category and log who paid. The bill will be split equally.</p>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              {/* Category Visual Grid Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Category
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategoryMode(!isCustomCategoryMode);
                      if (!isCustomCategoryMode) {
                        setNewExpenseCategory('OTHER');
                      }
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition cursor-pointer"
                  >
                    {isCustomCategoryMode ? '← Pick standard' : '+ Custom tag'}
                  </button>
                </div>

                {isCustomCategoryMode ? (
                  <div className="flex items-center gap-2 p-1 bg-slate-50 border border-emerald-300 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500 transition">
                    <span className="pl-3 text-lg">🏷️</span>
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="e.g. WiFi Bill, Electricity, Gifts"
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      className="flex-1 py-2 px-2 text-sm bg-transparent focus:outline-none font-medium"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => {
                      const isSelected = newExpenseCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewExpenseCategory(cat.id)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer text-left ${
                            isSelected 
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs' 
                              : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-xl shrink-0">{cat.emoji}</span>
                          <span className="truncate flex-1">{cat.label}</span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewExpenseAmount(val);
                      const totalNum = parseFloat(val) || 0;
                      if (splitType === 'EXACT' && selectedGroup && totalNum > 0) {
                        setMemberSplitValues(getDefaultExactSplits(totalNum, selectedGroup.members.map(m => m.id)));
                      }
                    }}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

              {/* Split Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Split Method
                </label>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setSplitType('EQUAL');
                      setSplitError(null);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
                      splitType === 'EQUAL'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    = Equal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitType('EXACT');
                      setSplitError(null);
                      const totalNum = parseFloat(newExpenseAmount) || 0;
                      if (selectedGroup && totalNum > 0) {
                        setMemberSplitValues(getDefaultExactSplits(totalNum, selectedGroup.members.map(m => m.id)));
                      }
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
                      splitType === 'EXACT'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ₹ Exact Amounts
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitType('PERCENTAGE');
                      setSplitError(null);
                      if (selectedGroup) {
                        setMemberSplitValues(getDefaultPercentageSplits(selectedGroup.members.map(m => m.id)));
                      }
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
                      splitType === 'PERCENTAGE'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    % Percentage
                  </button>
                </div>
              </div>

              {/* Split Breakdown */}
              {splitType === 'EQUAL' && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-slate-800">Equal Split:</span> This bill is split equally across all {selectedGroup.members.length} members ({selectedGroup.members.map(m => m.displayName).join(', ')}).
                  {newExpenseAmount && !isNaN(parseFloat(newExpenseAmount)) && (
                    <span className="block mt-1 font-semibold text-emerald-700">
                      ₹{(parseFloat(newExpenseAmount) / selectedGroup.members.length).toFixed(2)} per person
                    </span>
                  )}
                </div>
              )}

              {splitType === 'EXACT' && (
                <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700">Custom Member Amounts (₹)</span>
                    {(() => {
                      const totalNum = parseFloat(newExpenseAmount) || 0;
                      const sum = selectedGroup.members.reduce((acc, m) => acc + (parseFloat(memberSplitValues[m.id] || '0') || 0), 0);
                      const diff = totalNum - sum;
                      return (
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          Math.abs(diff) < 0.01 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {Math.abs(diff) < 0.01 ? ('✓ Balanced (₹' + sum.toFixed(2) + ')') : ('Left: ₹' + diff.toFixed(2))}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {selectedGroup.members.map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-3 bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <span className="text-xs font-semibold text-slate-800 truncate">{m.displayName}</span>
                        <div className="flex items-center gap-1.5 w-28 shrink-0">
                          <span className="text-xs text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={memberSplitValues[m.id] ?? ''}
                            onChange={(e) => {
                              handleExactAmountChange(
                                m.id,
                                e.target.value,
                                parseFloat(newExpenseAmount) || 0,
                                selectedGroup.members.map(mem => mem.id)
                              );
                            }}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            className="w-full text-right text-xs font-semibold px-2 py-1 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {splitType === 'PERCENTAGE' && (
                <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700">Member Percentages (%)</span>
                    {(() => {
                      const sumPct = selectedGroup.members.reduce((acc, m) => acc + (parseFloat(memberSplitValues[m.id] || '0') || 0), 0);
                      const diffPct = 100 - sumPct;
                      return (
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          Math.abs(diffPct) < 0.01 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {Math.abs(diffPct) < 0.01 ? '✓ Balanced (100%)' : ('Remaining: ' + diffPct.toFixed(1) + '%')}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {selectedGroup.members.map(m => {
                      const totalNum = parseFloat(newExpenseAmount) || 0;
                      const pct = parseFloat(memberSplitValues[m.id] || '0') || 0;
                      const calculatedOwed = (totalNum * pct) / 100;
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-3 bg-white px-3 py-2 rounded-lg border border-slate-200">
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-800 block truncate">{m.displayName}</span>
                            {totalNum > 0 && (
                              <span className="text-[10px] text-slate-400">≈ ₹{calculatedOwed.toFixed(2)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 w-24 shrink-0">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={memberSplitValues[m.id] ?? ''}
                              onChange={(e) => {
                                handlePercentageChange(
                                  m.id,
                                  e.target.value,
                                  selectedGroup.members.map(mem => mem.id)
                                );
                              }}
                              onWheel={(e) => (e.target as HTMLElement).blur()}
                              className="w-full text-right text-xs font-semibold px-2 py-1 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-xs text-slate-400 font-bold">%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {splitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {splitError}
                </div>
              )}

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
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
