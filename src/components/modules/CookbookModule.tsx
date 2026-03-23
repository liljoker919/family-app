import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

interface CookbookModuleProps {
  user: any;
}

const CATEGORIES = [
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'SNACK',
  'DESSERT',
  'APPETIZER',
  'SIDE_DISH',
  'BEVERAGE',
  'OTHER',
] as const;

type RecipeCategory = typeof CATEGORIES[number];

const CATEGORY_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
  DESSERT: 'Dessert',
  APPETIZER: 'Appetizer',
  SIDE_DISH: 'Side Dish',
  BEVERAGE: 'Beverage',
  OTHER: 'Other',
};

export default function CookbookModule({ user }: CookbookModuleProps) {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [ingredientInput, setIngredientInput] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    ingredients: [] as string[],
    instructions: '',
    prepTime: '',
    category: 'DINNER' as RecipeCategory,
    contributor: '',
    imageUrl: '',
  });

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      const { data } = await client.models.Recipe.list();
      setRecipes(data);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    }
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      ingredients: [],
      instructions: '',
      prepTime: '',
      category: 'DINNER' as RecipeCategory,
      contributor: '',
      imageUrl: '',
    });
    setIngredientInput('');
    setEditingRecipe(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (recipe: any) => {
    setForm({
      title: recipe.title || '',
      description: recipe.description || '',
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || '',
      prepTime: recipe.prepTime || '',
      category: recipe.category as RecipeCategory || 'DINNER',
      contributor: recipe.contributor || '',
      imageUrl: recipe.imageUrl || '',
    });
    setIngredientInput('');
    setEditingRecipe(recipe);
    setShowForm(true);
  };

  const handleAddIngredient = () => {
    const trimmed = ingredientInput.trim();
    if (trimmed && !form.ingredients.includes(trimmed)) {
      setForm({ ...form, ingredients: [...form.ingredients, trimmed] });
    }
    setIngredientInput('');
  };

  const handleRemoveIngredient = (index: number) => {
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== index) });
  };

  const handleIngredientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddIngredient();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        ingredients: form.ingredients.length > 0 ? form.ingredients : undefined,
        instructions: form.instructions || undefined,
        prepTime: form.prepTime || undefined,
        category: form.category,
        contributor: form.contributor || undefined,
        imageUrl: form.imageUrl || undefined,
      };

      if (editingRecipe) {
        await client.models.Recipe.update({ id: editingRecipe.id, ...payload });
        if (selectedRecipe?.id === editingRecipe.id) {
          setSelectedRecipe({ ...selectedRecipe, ...payload });
        }
      } else {
        await client.models.Recipe.create(payload);
      }
      setShowForm(false);
      resetForm();
      fetchRecipes();
    } catch (error) {
      console.error('Error saving recipe:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      try {
        await client.models.Recipe.delete({ id });
        if (selectedRecipe?.id === id) setSelectedRecipe(null);
        fetchRecipes();
      } catch (error) {
        console.error('Error deleting recipe:', error);
      }
    }
  };

  const filteredRecipes = filterCategory === 'ALL'
    ? recipes
    : recipes.filter((r) => r.category === filterCategory);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Family Cookbook</h2>
        <button
          onClick={openCreateForm}
          className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
        >
          Add Recipe
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilterCategory('ALL')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
            filterCategory === 'ALL'
              ? 'bg-royal-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filterCategory === cat
                ? 'bg-royal-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Recipe Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">
              {editingRecipe ? 'Edit Recipe' : 'Add New Recipe'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="e.g. Mom's Famous Chili"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as RecipeCategory })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time</label>
                  <input
                    type="text"
                    value={form.prepTime}
                    onChange={(e) => setForm({ ...form, prepTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    placeholder="e.g. 30 minutes"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contributor</label>
                <input
                  type="text"
                  value={form.contributor}
                  onChange={(e) => setForm({ ...form, contributor: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="e.g. Mom, Dad, Grandma"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="A brief description of the recipe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingredients
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={ingredientInput}
                    onChange={(e) => setIngredientInput(e.target.value)}
                    onKeyDown={handleIngredientKeyDown}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    placeholder="Type an ingredient and press Enter or Add"
                  />
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
                  >
                    Add
                  </button>
                </div>
                {form.ingredients.length > 0 && (
                  <ul className="space-y-1">
                    {form.ingredients.map((ing, idx) => (
                      <li key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-1 rounded">
                        <span className="text-sm text-gray-700">{ing}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="text-red-500 hover:text-red-700 text-xs ml-2"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  rows={6}
                  placeholder="Step-by-step cooking instructions..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="https://example.com/recipe-image.jpg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white py-2 rounded-lg transition"
                >
                  {editingRecipe ? 'Update Recipe' : 'Save Recipe'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            {selectedRecipe.imageUrl && (
              <img
                src={selectedRecipe.imageUrl}
                alt={selectedRecipe.title}
                className="w-full h-56 object-cover rounded-t-lg"
              />
            )}
            <div className="p-8">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedRecipe.title}</h3>
                  {selectedRecipe.contributor && (
                    <p className="text-sm text-royal-blue-600 mt-1">by {selectedRecipe.contributor}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                {selectedRecipe.category && (
                  <span className="bg-royal-blue-100 text-royal-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                    {CATEGORY_LABELS[selectedRecipe.category] || selectedRecipe.category}
                  </span>
                )}
                {selectedRecipe.prepTime && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                    ⏱ {selectedRecipe.prepTime}
                  </span>
                )}
              </div>

              {selectedRecipe.description && (
                <p className="text-gray-600 mb-4">{selectedRecipe.description}</p>
              )}

              {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Ingredients</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedRecipe.ingredients.map((ing: string, idx: number) => (
                      <li key={idx} className="text-gray-700 text-sm">{ing}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRecipe.instructions && (
                <div className="mb-4">
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">Instructions</h4>
                  <div className="text-gray-700 text-sm whitespace-pre-wrap">{selectedRecipe.instructions}</div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => { openEditForm(selectedRecipe); setSelectedRecipe(null); }}
                  className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-4 py-2 rounded-lg transition text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(selectedRecipe.id)}
                  className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition text-sm"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition text-sm ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-lg font-medium">No recipes yet</p>
          <p className="text-sm">Add your first family recipe!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => (
            <div
              key={recipe.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer overflow-hidden"
              onClick={() => setSelectedRecipe(recipe)}
            >
              {recipe.imageUrl ? (
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-800 leading-tight">{recipe.title}</h3>
                  {recipe.category && (
                    <span className="shrink-0 bg-royal-blue-100 text-royal-blue-700 text-xs px-2 py-0.5 rounded-full">
                      {CATEGORY_LABELS[recipe.category] || recipe.category}
                    </span>
                  )}
                </div>
                {recipe.contributor && (
                  <p className="text-xs text-royal-blue-500 mb-2">by {recipe.contributor}</p>
                )}
                {recipe.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{recipe.description}</p>
                )}
                {recipe.prepTime && (
                  <p className="text-xs text-gray-400 mt-2">⏱ {recipe.prepTime}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
