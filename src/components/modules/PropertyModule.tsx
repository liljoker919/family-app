import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import ConfirmModal from '../ConfirmModal';
import Toast from '../Toast';

const client = generateClient<Schema>();

interface PropertyModuleProps {
  user: any;
  familyId: string;
}

type CategoryKey = 'RENT_INCOME' | 'MORTGAGE' | 'TAXES' | 'MAINTENANCE' | 'INSURANCE';

const CATEGORIES: Record<CategoryKey, { label: string; type: 'income' | 'expense'; icon: string; colorClass: string }> = {
  RENT_INCOME: { label: 'Rent Income', type: 'income', icon: '💰', colorClass: 'bg-green-100 text-green-700' },
  MORTGAGE: { label: 'Mortgage', type: 'expense', icon: '🏦', colorClass: 'bg-red-100 text-red-700' },
  TAXES: { label: 'Taxes', type: 'expense', icon: '📋', colorClass: 'bg-orange-100 text-orange-700' },
  MAINTENANCE: { label: 'Maintenance', type: 'expense', icon: '🔧', colorClass: 'bg-yellow-100 text-yellow-700' },
  INSURANCE: { label: 'Insurance', type: 'expense', icon: '🛡️', colorClass: 'bg-purple-100 text-purple-700' },
};

export default function PropertyModule({ user, familyId }: PropertyModuleProps) {
  const [properties, setProperties] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [propertyForm, setPropertyForm] = useState({ name: '', address: '' });
  const [transactionForm, setTransactionForm] = useState({
    category: 'RENT_INCOME' as CategoryKey,
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [pendingDelete, setPendingDelete] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const { data: props } = await client.models.Property.list({
        filter: { familyId: { eq: familyId } },
      });
      setProperties(props);

      // Fetch only transactions for this family's properties
      if (props.length > 0) {
        const propertyIds = props.map((p: any) => p.id);
        const txnFetches = propertyIds.map((id: string) =>
          client.models.PropertyTransaction.list({ filter: { propertyId: { eq: id } } })
        );
        const results = await Promise.all(txnFetches);
        const allTxns = results.flatMap((r) => r.data);
        setAllTransactions(allTxns);
      } else {
        setAllTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getPropertyTransactions = (propertyId: string) =>
    allTransactions.filter((t) => t.propertyId === propertyId);

  const calculateTotals = (transactions: any[]) => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return { income, expenses, net: income - expenses };
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.Property.create({ ...propertyForm, familyId });
      setPropertyForm({ name: '', address: '' });
      setShowPropertyForm(false);
      fetchAllData();
    } catch (error) {
      console.error('Error creating property:', error);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;
    const categoryInfo = CATEGORIES[transactionForm.category];
    try {
      await client.models.PropertyTransaction.create({
        propertyId: selectedProperty.id,
        type: categoryInfo.type,
        amount: parseFloat(transactionForm.amount),
        description: transactionForm.description,
        date: transactionForm.date,
        category: transactionForm.category,
      });
      setTransactionForm({
        category: 'RENT_INCOME',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowTransactionForm(false);
      fetchAllData();
    } catch (error) {
      console.error('Error creating transaction:', error);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    setPendingDelete({
      message: 'Are you sure you want to delete this property?',
      onConfirm: async () => {
        try {
          await client.models.Property.delete({ id });
          if (selectedProperty?.id === id) setSelectedProperty(null);
          fetchAllData();
          setToast({ message: 'Property deleted successfully.', type: 'success' });
        } catch (error) {
          console.error('Error deleting property:', error);
          setToast({ message: 'Failed to delete property. Please try again.', type: 'error' });
        }
      },
    });
  };

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <ConfirmModal
        isOpen={pendingDelete !== null}
        title="Confirm Delete"
        message={pendingDelete?.message ?? ''}
        onConfirm={async () => {
          const action = pendingDelete;
          setPendingDelete(null);
          await action?.onConfirm();
        }}
        onCancel={() => setPendingDelete(null)}
      />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Property P&amp;L Tracker</h2>
          <p className="text-gray-500 mt-1">Track rental income and expenses for each property</p>
        </div>
        <button
          onClick={() => setShowPropertyForm(true)}
          className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-5 py-2 rounded-lg transition flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> Add Property
        </button>
      </div>

      {showPropertyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">Add New Property</h3>
            <form onSubmit={handleCreateProperty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder='e.g., "Steps to the Sea"'
                  value={propertyForm.name}
                  onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="123 Ocean Drive, Miami, FL"
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition font-medium"
                >
                  Create Property
                </button>
                <button
                  type="button"
                  onClick={() => setShowPropertyForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransactionForm && selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg">
            <h3 className="text-2xl font-bold mb-1 text-gray-800">Log Transaction</h3>
            <p className="text-gray-500 mb-6 text-sm">{selectedProperty.name}</p>
            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={transactionForm.category}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, category: e.target.value as CategoryKey })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                >
                  {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => (
                    <option key={key} value={key}>
                      {CATEGORIES[key].icon} {CATEGORIES[key].label} ({CATEGORIES[key].type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={transactionForm.date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional notes"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">This will be recorded as:</span>
                <span
                  className={`px-3 py-1 rounded-full font-medium ${
                    CATEGORIES[transactionForm.category].type === 'income'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {CATEGORIES[transactionForm.category].type === 'income' ? '▲ Income' : '▼ Expense'}
                </span>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition font-medium"
                >
                  Save Transaction
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransactionForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {properties.map((property) => {
          const txns = getPropertyTransactions(property.id);
          const totals = calculateTotals(txns);
          const isSelected = selectedProperty?.id === property.id;

          return (
            <div key={property.id} className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-royal-blue-700 px-6 py-4 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">{property.name}</h3>
                    {property.address && (
                      <p className="text-royal-blue-200 text-sm mt-1">📍 {property.address}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteProperty(property.id)}
                    className="text-royal-blue-300 hover:text-white transition text-sm"
                    title="Delete property"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-gray-200">
                <div className="bg-white px-4 py-4 text-center">
                  <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Total Income</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">${totals.income.toFixed(2)}</p>
                </div>
                <div className="bg-white px-4 py-4 text-center">
                  <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">${totals.expenses.toFixed(2)}</p>
                </div>
                <div className={`px-4 py-4 text-center ${totals.net >= 0 ? 'bg-royal-blue-50' : 'bg-orange-50'}`}>
                  <p className={`text-xs font-medium uppercase tracking-wide ${totals.net >= 0 ? 'text-royal-blue-600' : 'text-orange-600'}`}>
                    Net Income
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${totals.net >= 0 ? 'text-royal-blue-700' : 'text-orange-700'}`}>
                    {totals.net >= 0 ? '+' : ''}${totals.net.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <button
                  onClick={() => setSelectedProperty(isSelected ? null : property)}
                  className="text-sm text-royal-blue-600 hover:text-royal-blue-800 font-medium flex items-center gap-1 transition"
                >
                  {isSelected ? '▲ Hide Ledger' : '▼ View Ledger'} ({txns.length} transaction{txns.length !== 1 ? 's' : ''})
                </button>
                {isSelected && (
                  <button
                    onClick={() => {
                      setSelectedProperty(property);
                      setShowTransactionForm(true);
                    }}
                    className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-4 py-1.5 rounded-lg transition text-sm font-medium"
                  >
                    + Log Transaction
                  </button>
                )}
              </div>

              {isSelected && (
                <div className="px-6 pb-6">
                  {txns.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-3xl mb-2">📊</p>
                      <p>No transactions yet. Log your first transaction to start tracking P&amp;L.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto rounded-lg border border-gray-100 mt-2">
                      {[...txns]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((txn) => {
                          const catKey = txn.category as CategoryKey;
                          const cat = CATEGORIES[catKey] || {
                            label: txn.category || txn.type,
                            icon: txn.type === 'income' ? '💰' : '💸',
                            colorClass: txn.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                          };
                          return (
                            <div key={txn.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition">
                              <span className="text-2xl">{cat.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.colorClass}`}>
                                    {cat.label}
                                  </span>
                                  {txn.description && (
                                    <span className="text-sm text-gray-600 truncate">{txn.description}</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">📅 {txn.date}</p>
                              </div>
                              <span
                                className={`text-base font-bold whitespace-nowrap ${
                                  txn.type === 'income' ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {txn.type === 'income' ? '+' : '-'}${txn.amount?.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {properties.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-4">🏠</p>
            <p className="text-lg font-medium text-gray-500">No properties yet</p>
            <p className="mt-1">Add your first property to start tracking P&amp;L.</p>
          </div>
        )}
      </div>
    </div>
  );
}
