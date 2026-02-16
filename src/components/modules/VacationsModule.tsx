import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

const getTransportationEmoji = (transportation: string) => {
  switch (transportation) {
    case 'flight':
      return '✈️';
    case 'car':
      return '🚗';
    case 'boat':
      return '⛵';
    default:
      return '🚗';
  }
};

interface VacationsModuleProps {
  user: any;
}

export default function VacationsModule({ user }: VacationsModuleProps) {
  const [vacations, setVacations] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [showVacationForm, setShowVacationForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [selectedVacation, setSelectedVacation] = useState<any>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [vacationForm, setVacationForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    transportation: 'flight' as 'flight' | 'car' | 'boat',
    accommodations: '',
  });
  const [activityForm, setActivityForm] = useState({
    name: '',
    description: '',
    date: '',
    location: '',
  });
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    comment: '',
  });

  useEffect(() => {
    fetchVacations();
  }, []);

  const fetchVacations = async () => {
    try {
      const { data } = await client.models.Vacation.list();
      setVacations(data);
    } catch (error) {
      console.error('Error fetching vacations:', error);
    }
  };

  const fetchActivities = async (vacationId: string) => {
    try {
      const { data } = await client.models.Activity.list({
        filter: { vacationId: { eq: vacationId } },
      });
      setActivities(data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchFeedbacks = async (activityId: string) => {
    try {
      const { data } = await client.models.Feedback.list({
        filter: { activityId: { eq: activityId } },
      });
      setFeedbacks(data);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    }
  };

  const handleCreateVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.Vacation.create({
        ...vacationForm,
        createdBy: user?.signInDetails?.loginId || 'unknown',
      });
      setVacationForm({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        transportation: 'flight',
        accommodations: '',
      });
      setShowVacationForm(false);
      fetchVacations();
    } catch (error) {
      console.error('Error creating vacation:', error);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVacation) return;
    try {
      await client.models.Activity.create({
        ...activityForm,
        vacationId: selectedVacation.id,
      });
      setActivityForm({
        name: '',
        description: '',
        date: '',
        location: '',
      });
      setShowActivityForm(false);
      fetchActivities(selectedVacation.id);
    } catch (error) {
      console.error('Error creating activity:', error);
    }
  };

  const handleCreateFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    try {
      await client.models.Feedback.create({
        ...feedbackForm,
        activityId: selectedActivity.id,
        userId: user?.signInDetails?.loginId || 'unknown',
        createdAt: new Date().toISOString(),
      });
      setFeedbackForm({
        rating: 5,
        comment: '',
      });
      fetchFeedbacks(selectedActivity.id);
    } catch (error) {
      console.error('Error creating feedback:', error);
    }
  };

  const handleDeleteVacation = async (id: string) => {
    if (confirm('Are you sure you want to delete this vacation?')) {
      try {
        await client.models.Vacation.delete({ id });
        fetchVacations();
      } catch (error) {
        console.error('Error deleting vacation:', error);
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Vacations</h2>
        <button
          onClick={() => setShowVacationForm(true)}
          className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
        >
          Add Vacation
        </button>
      </div>

      {/* Vacation Form Modal */}
      {showVacationForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">Add New Vacation</h3>
            <form onSubmit={handleCreateVacation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={vacationForm.title}
                  onChange={(e) => setVacationForm({ ...vacationForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={vacationForm.description}
                  onChange={(e) => setVacationForm({ ...vacationForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={vacationForm.startDate}
                    onChange={(e) => setVacationForm({ ...vacationForm, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={vacationForm.endDate}
                    onChange={(e) => setVacationForm({ ...vacationForm, endDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transportation</label>
                <select
                  value={vacationForm.transportation}
                  onChange={(e) =>
                    setVacationForm({
                      ...vacationForm,
                      transportation: e.target.value as 'flight' | 'car' | 'boat',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                >
                  <option value="flight">Flight</option>
                  <option value="car">Car</option>
                  <option value="boat">Boat</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accommodations</label>
                <input
                  type="text"
                  value={vacationForm.accommodations}
                  onChange={(e) => setVacationForm({ ...vacationForm, accommodations: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
                >
                  Create Vacation
                </button>
                <button
                  type="button"
                  onClick={() => setShowVacationForm(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vacations List */}
      <div className="grid gap-6">
        {vacations.map((vacation) => (
          <div key={vacation.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{vacation.title}</h3>
                <p className="text-gray-600 mt-1">{vacation.description}</p>
                <div className="flex gap-4 mt-2 text-sm text-gray-500">
                  <span>📅 {vacation.startDate} - {vacation.endDate}</span>
                  <span>{getTransportationEmoji(vacation.transportation || '')} {vacation.transportation}</span>
                  {vacation.accommodations && <span>🏨 {vacation.accommodations}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedVacation(vacation);
                    fetchActivities(vacation.id);
                  }}
                  className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-4 py-2 rounded-lg transition text-sm"
                >
                  View Activities
                </button>
                <button
                  onClick={() => handleDeleteVacation(vacation.id)}
                  className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition text-sm"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Activities Section */}
            {selectedVacation?.id === vacation.id && (
              <div className="mt-6 border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold">Activities</h4>
                  <button
                    onClick={() => setShowActivityForm(true)}
                    className="bg-royal-blue-500 hover:bg-royal-blue-600 text-white px-4 py-2 rounded-lg transition text-sm"
                  >
                    Add Activity
                  </button>
                </div>

                {/* Activity Form */}
                {showActivityForm && (
                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <form onSubmit={handleCreateActivity} className="space-y-3">
                      <input
                        type="text"
                        placeholder="Activity Name"
                        value={activityForm.name}
                        onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                      <textarea
                        placeholder="Description"
                        value={activityForm.description}
                        onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        rows={2}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={activityForm.date}
                          onChange={(e) => setActivityForm({ ...activityForm, date: e.target.value })}
                          className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Location"
                          value={activityForm.location}
                          onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })}
                          className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
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
                          onClick={() => setShowActivityForm(false)}
                          className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Activities List */}
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-semibold text-gray-800">{activity.name}</h5>
                          <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                          <div className="flex gap-3 mt-2 text-xs text-gray-500">
                            {activity.date && <span>📅 {activity.date}</span>}
                            {activity.location && <span>📍 {activity.location}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedActivity(activity);
                            fetchFeedbacks(activity.id);
                          }}
                          className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-3 py-1 rounded text-xs"
                        >
                          Feedback
                        </button>
                      </div>

                      {/* Feedback Section */}
                      {selectedActivity?.id === activity.id && (
                        <div className="mt-4 border-t pt-4">
                          <h6 className="font-medium text-sm mb-3">Rate this Activity</h6>
                          <form onSubmit={handleCreateFeedback} className="space-y-2">
                            <div className="flex gap-2 items-center">
                              <label className="text-sm">Rating:</label>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                                  className="text-2xl focus:outline-none"
                                >
                                  {star <= feedbackForm.rating ? '⭐' : '☆'}
                                </button>
                              ))}
                            </div>
                            <textarea
                              placeholder="Leave a comment..."
                              value={feedbackForm.comment}
                              onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                              rows={2}
                            />
                            <button
                              type="submit"
                              className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-4 py-1 rounded text-sm"
                            >
                              Submit Feedback
                            </button>
                          </form>

                          {/* Existing Feedbacks */}
                          <div className="mt-4 space-y-2">
                            {feedbacks.map((feedback) => (
                              <div key={feedback.id} className="bg-white p-3 rounded border border-gray-200">
                                <div className="flex gap-1 mb-1">
                                  {Array.from({ length: feedback.rating }).map((_, i) => (
                                    <span key={i} className="text-yellow-500">⭐</span>
                                  ))}
                                </div>
                                <p className="text-sm text-gray-700">{feedback.comment}</p>
                                <p className="text-xs text-gray-500 mt-1">By {feedback.userId}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {vacations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No vacations yet. Add your first vacation to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
