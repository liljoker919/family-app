import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

interface PropertyModuleProps {
  user: any;
}

const TRANSACTION_CATEGORIES = [
  'RENT_INCOME',
  'MORTGAGE',
  'TAXES',
  'MAINTENANCE',
  'INSURANCE',
] as const;

export default function PropertyModule({ user }: PropertyModuleProps) {
  const [properties, setProperties] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    address: '',
    type: '',
  });
  const [transactionForm, setTransactionForm] = useState({
    type: 'income' as 'income' | 'expense',
    amount: '',
    description: '',
    date: '',
    category: 'RENT_INCOME' as (typeof TRANSACTION_CATEGORIES)[number],
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data } = await client.models.Property.list();
      setProperties(data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchTransactions = async (propertyId: string) => {
    try {
      const { data } = await client.models.PropertyTransaction.list({
        filter: { propertyId: { eq: propertyId } },
      });
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.Property.create(propertyForm);
      setPropertyForm({
        name: '',
        address: '',
        type: '',
      });
      setShowPropertyForm(false);
      fetchProperties();
    } catch (error) {
      console.error('Error creating property:', error);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;
    try {
      await client.models.PropertyTransaction.create({
        ...transactionForm,
        propertyId: selectedProperty.id,
        amount: parseFloat(transactionForm.amount),
      });
      setTransactionForm({
        type: 'income',
        amount: '',
        description: '',
        date: '',
        category: 'RENT_INCOME',
      });
      setShowTransactionForm(false);
      fetchTransactions(selectedProperty.id);
    } catch (error) {
      console.error('Error creating transaction:', error);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (confirm('Are you sure you want to delete this property?')) {
      try {
        await client.models.Property.delete({ id });
        fetchProperties();
      } catch (error) {
        console.error('Error deleting property:', error);
      }
    }
  };

  const calculateTotals = (transactions: any[]) => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return { income, expenses, net: income - expenses };
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Property Management</h2>
        <button
          onClick={() => setShowPropertyForm(true)}
          className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
        >
          Add Property
        </button>
      </div>

      {/* Property Form Modal */}
      {showPropertyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
            <h3 className="text-2xl font-bold mb-4">Add New Property</h3>
            <form onSubmit={handleCreateProperty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
                <input
                  type="text"
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
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <input
                  type="text"
                  placeholder="e.g., Residential, Commercial, Rental"
                  value={propertyForm.type}
                  onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
                >
                  Create Property
                </button>
                <button
                  type="button"
                  onClick={() => setShowPropertyForm(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Properties List */}
      <div className="grid gap-6">
        {properties.map((property) => {
          const totals = selectedProperty?.id === property.id ? calculateTotals(transactions) : null;

          return (
            <div key={property.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{property.name}</h3>
                  {property.address && <p className="text-gray-600 mt-1">📍 {property.address}</p>}
                  {property.type && <p className="text-sm text-gray-500 mt-1">Type: {property.type}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedProperty(property);
                      fetchTransactions(property.id);
                    }}
                    className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-4 py-2 rounded-lg transition text-sm"
                  >
                    View Transactions
                  </button>
                  <button
                    onClick={() => handleDeleteProperty(property.id)}
                    className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Transactions Section */}
              {selectedProperty?.id === property.id && (
                <div className="mt-6 border-t pt-6">
                  {totals && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">Total Income</p>
                        <p className="text-2xl font-bold text-green-700">${totals.income.toFixed(2)}</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                        <p className="text-2xl font-bold text-red-700">${totals.expenses.toFixed(2)}</p>
                      </div>
                      <div className={`p-4 rounded-lg ${totals.net >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                        <p className={`text-sm font-medium ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          Net Income
                        </p>
                        <p className={`text-2xl font-bold ${totals.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                          ${totals.net.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold">Transactions</h4>
                    <button
                      onClick={() => setShowTransactionForm(true)}
                      className="bg-royal-blue-500 hover:bg-royal-blue-600 text-white px-4 py-2 rounded-lg transition text-sm"
                    >
                      Add Transaction
                    </button>
                  </div>

                  {/* Transaction Form */}
                  {showTransactionForm && (
                    <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                      <form onSubmit={handleCreateTransaction} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                              value={transactionForm.type}
                              onChange={(e) =>
                                setTransactionForm({
                                  ...transactionForm,
                                  type: e.target.value as 'income' | 'expense',
                                })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="income">Income</option>
                              <option value="expense">Expense</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              value={transactionForm.amount}
                              onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <input
                            type="text"
                            value={transactionForm.description}
                            onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input
                              type="date"
                              value={transactionForm.date}
                              onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select
                              value={transactionForm.category}
                              onChange={(e) =>
                                setTransactionForm({
                                  ...transactionForm,
                                  category: e.target.value as (typeof TRANSACTION_CATEGORIES)[number],
                                })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                              required
                            >
                              {TRANSACTION_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-4 py-2 rounded-lg transition text-sm"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowTransactionForm(false)}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Transactions List */}
                  <div className="space-y-2">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className={`p-4 rounded-lg border ${
                          transaction.type === 'income'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex gap-3 items-center">
                              <span
                                className={`font-semibold ${
                                  transaction.type === 'income' ? 'text-green-700' : 'text-red-700'
                                }`}
                              >
                                ${transaction.amount?.toFixed(2)}
                              </span>
                              <span className="text-sm text-gray-600">{transaction.description}</span>
                            </div>
                            <div className="flex gap-3 mt-1 text-xs text-gray-500">
                              <span>📅 {transaction.date}</span>
                              {transaction.category && <span>🏷️ {transaction.category}</span>}
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              transaction.type === 'income'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {transaction.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {properties.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No properties yet. Add your first property to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
