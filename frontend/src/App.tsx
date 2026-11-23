import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Receipt, 
  CreditCard, 
  PlusCircle, 
  ArrowRight, 
  LogOut, 
  Wallet
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
  members: Member[];
}

interface Member {
  id: string;
  userId?: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  isVirtual: boolean;
}

interface Expense {
  id: string;
  title: string;
  totalAmount: number;
  paidByMemberId: string;
  splitType: string;
  category: string;
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

  const [activeTab, setActiveTab] = useState<'groups' | 'expenses' | 'balances'>('groups');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balanceReport, setBalanceReport] = useState<BalanceReport | null>(null);

  // Auth form states
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authError, setAuthError] = useState('');

  // New Group state
  const [newGroupName, setNewGroupName] = useState('');

  // New Virtual Member state
  const [newMemberName, setNewMemberName] = useState('');

  // New Expense state
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState('');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

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
      if (res.data.length > 0 && !selectedGroup) {
        setSelectedGroup(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load groups', err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const res = await apiClient.post('/api/groups', { name: newGroupName.trim(), currencyCode: 'INR' });
      setGroups([res.data, ...groups]);
      setSelectedGroup(res.data);
      setNewGroupName('');
    } catch (err) {
      console.error('Failed to create group', err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMemberName.trim()) return;
    try {
      const res = await apiClient.post(`/api/groups/${selectedGroup.id}/members`, { displayName: newMemberName.trim() });
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
      // Equal split across all group members
      const splitPayload = selectedGroup.members.map(m => ({ memberId: m.id }));

      await apiClient.post('/api/expenses', {
        groupId: selectedGroup.id,
        paidByMemberId: newExpensePayer,
        title: newExpenseTitle,
        totalAmount: total,
        splitType: 'EQUAL',
        category: 'GENERAL',
        splits: splitPayload,
      });

      setShowAddExpenseModal(false);
      setNewExpenseTitle('');
      setNewExpenseAmount('');
      loadGroupExpenses(selectedGroup.id);
      loadGroupBalances(selectedGroup.id);
    } catch (err) {
      console.error('Failed to add expense', err);
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

  const getMemberName = (memberId: string) => {
    const member = selectedGroup?.members.find(m => m.id === memberId);
    return member ? member.displayName : 'Unknown';
  };

  // Auth Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-md border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-emerald-600 flex items-center justify-center gap-2">
              <Wallet className="w-8 h-8" /> TallyUp
            </h1>
            <p className="text-gray-500 mt-2 text-sm">Lightweight, zero-paywall group expense splitting</p>
          </div>

          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => { setIsLoginMode(true); setAuthError(''); }}
              className={`flex-1 py-2 text-center text-sm font-semibold border-b-2 transition ${
                isLoginMode ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLoginMode(false); setAuthError(''); }}
              className={`flex-1 py-2 text-center text-sm font-semibold border-b-2 transition ${
                !isLoginMode ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500'
              }`}
            >
              Register
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition"
            >
              {isLoginMode ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-2xl font-black text-emerald-600 flex items-center gap-2">
              <Wallet className="w-7 h-7" /> TallyUp
            </span>
            {selectedGroup && (
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                {selectedGroup.name} ({selectedGroup.currencyCode})
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">Hello, {currentUser.fullName}</span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-600 transition p-1"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-8">
          <button
            onClick={() => setActiveTab('groups')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'groups' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500'
            }`}
          >
            <Users className="w-4 h-4" /> My Groups
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            disabled={!selectedGroup}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'expenses' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500'
            } ${!selectedGroup ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Receipt className="w-4 h-4" /> Expense Ledger
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            disabled={!selectedGroup}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'balances' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500'
            } ${!selectedGroup ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <CreditCard className="w-4 h-4" /> Balances & Settle Up
          </button>
        </div>

        {/* Tab 1: Groups Dashboard */}
        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <h2 className="text-lg font-bold text-gray-800">Your Trip & Flat Groups</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {groups.map(group => (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      selectedGroup?.id === group.id
                        ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-bold text-gray-900">{group.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Currency: {group.currencyCode}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-600">
                        {group.members.length} Members
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                        Code: {group.inviteCode}
                      </span>
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="text-sm text-gray-500 col-span-2">No groups yet. Create your first group!</p>
                )}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 h-fit space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3">Create New Group</h3>
                <form onSubmit={handleCreateGroup} className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Group name (e.g. Rishikesh Trip)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-sm transition"
                  >
                    Create Group
                  </button>
                </form>
              </div>

              {selectedGroup && (
                <div className="border-t border-gray-100 pt-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-2">Add Virtual Member (Tricount Style)</h3>
                  <p className="text-xs text-gray-500 mb-3">Add friends by name alone. They can claim it later.</p>
                  <form onSubmit={handleAddMember} className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Display Name"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm"
                    >
                      Add
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Expense Ledger */}
        {activeTab === 'expenses' && selectedGroup && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                Expenses for {selectedGroup.name}
              </h2>
              <button
                onClick={() => setShowAddExpenseModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition"
              >
                <PlusCircle className="w-4 h-4" /> Add Bill
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Paid By</th>
                    <th className="py-3 px-4">Split Type</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50/50">
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{expense.title}</td>
                      <td className="py-3.5 px-4 text-gray-500">{expense.expenseDate}</td>
                      <td className="py-3.5 px-4 text-gray-700">{getMemberName(expense.paidByMemberId)}</td>
                      <td className="py-3.5 px-4">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                          {expense.splitType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                        ₹{expense.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No expenses logged yet. Tap "Add Bill" to create your first split!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Balances & Simplified Settle Up */}
        {activeTab === 'balances' && selectedGroup && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Net Balances & Min-Cash-Flow Transfers</h2>
                <p className="text-xs text-gray-500 mt-0.5">Collapsed tangled debts into at most N - 1 direct transfers</p>
              </div>
              <button
                onClick={() => setShowSettleModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" /> Settle Up
              </button>
            </div>

            {/* Individual Net Balances */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {balanceReport?.netBalances.map((b) => {
                const isCreditor = b.netBalance > 0;
                const isSettled = Math.abs(b.netBalance) < 0.01;
                return (
                  <div key={b.memberId} className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 truncate">{getMemberName(b.memberId)}</p>
                    <p className={`text-lg font-bold mt-1 ${
                      isSettled ? 'text-gray-400' : isCreditor ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {isSettled ? 'Settled' : `${isCreditor ? '+₹' : '-₹'}${Math.abs(b.netBalance).toFixed(2)}`}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Simplified Payment Graph Transfers */}
            <div className="bg-white p-5 rounded-xl border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">Suggested Minimum Transactions</h3>
              <div className="space-y-3">
                {balanceReport?.simplifiedDebts.map((transfer, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-rose-700">{getMemberName(transfer.fromMemberId)}</span>
                      <span className="text-xs text-gray-400">owes</span>
                      <span className="font-semibold text-emerald-700">{getMemberName(transfer.toMemberId)}</span>
                    </div>
                    <span className="font-bold text-gray-900">₹{transfer.amount.toFixed(2)}</span>
                  </div>
                ))}
                {balanceReport?.simplifiedDebts.length === 0 && (
                  <p className="text-sm text-gray-400 py-3 text-center">All group debts are completely settled up! 🎉</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Group Expense</h3>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zostel Stay"
                  value={newExpenseTitle}
                  onChange={(e) => setNewExpenseTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Total Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="100.00"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Paid By</label>
                <select
                  required
                  value={newExpensePayer}
                  onChange={(e) => setNewExpensePayer(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="">Select payer</option>
                  {selectedGroup?.members.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
                >
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Record Direct Settlement</h3>
            <form onSubmit={handleRecordSettlement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Payer (Who paid)</label>
                <select
                  required
                  value={settlePayer}
                  onChange={(e) => setSettlePayer(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="">Select payer</option>
                  {selectedGroup?.members.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Receiver (Who received)</label>
                <select
                  required
                  value={settleReceiver}
                  onChange={(e) => setSettleReceiver(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="">Select receiver</option>
                  {selectedGroup?.members.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
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
