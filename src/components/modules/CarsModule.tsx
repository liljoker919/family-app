import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import ConfirmModal from '../ConfirmModal';
import Toast from '../Toast';

const client = generateClient<Schema>();

interface CarsModuleProps {
  user: any;
  familyId: string;
}

export default function CarsModule({ user, familyId }: CarsModuleProps) {
  const [cars, setCars] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [showCarForm, setShowCarForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [editingMileageCar, setEditingMileageCar] = useState<string | null>(null);
  const [mileageInput, setMileageInput] = useState('');
  const [carForm, setCarForm] = useState({
    make: '',
    model: '',
    year: '',
    vin: '',
    currentMileage: '',
    color: '',
    licensePlate: '',
    registrationExpiry: '',
  });
  const [serviceForm, setServiceForm] = useState({
    serviceType: '',
    description: '',
    mileageAtService: '',
    date: '',
    cost: '',
    provider: '',
  });
  const [pendingDelete, setPendingDelete] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchCars();
  }, []);

  const fetchCars = async () => {
    try {
      const { data } = await client.models.Car.list({
        filter: { familyId: { eq: familyId } },
      });
      setCars(data);
    } catch (error) {
      console.error('Error fetching cars:', error);
    }
  };

  const fetchServices = async (carId: string) => {
    try {
      const { data } = await client.models.CarService.list({
        filter: { carId: { eq: carId } },
      });
      // Sort chronologically descending (most recent first)
      const sorted = [...data].sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });
      setServices(sorted);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleCreateCar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.Car.create({
        ...carForm,
        familyId,
        year: parseInt(carForm.year),
        currentMileage: carForm.currentMileage ? parseInt(carForm.currentMileage) : undefined,
        registrationExpiry: carForm.registrationExpiry || undefined,
        licensePlate: carForm.licensePlate || undefined,
      });
      setCarForm({
        make: '',
        model: '',
        year: '',
        vin: '',
        currentMileage: '',
        color: '',
        licensePlate: '',
        registrationExpiry: '',
      });
      setShowCarForm(false);
      fetchCars();
    } catch (error) {
      console.error('Error creating car:', error);
    }
  };

  const handleUpdateMileage = async (carId: string) => {
    if (!mileageInput) return;
    try {
      await client.models.Car.update({
        id: carId,
        currentMileage: parseInt(mileageInput),
      });
      setEditingMileageCar(null);
      setMileageInput('');
      fetchCars();
    } catch (error) {
      console.error('Error updating mileage:', error);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar) return;
    try {
      await client.models.CarService.create({
        ...serviceForm,
        carId: selectedCar.id,
        familyId: selectedCar.familyId,
        mileageAtService: serviceForm.mileageAtService ? parseInt(serviceForm.mileageAtService) : undefined,
        cost: serviceForm.cost ? parseFloat(serviceForm.cost) : undefined,
      });
      setServiceForm({
        serviceType: '',
        description: '',
        mileageAtService: '',
        date: '',
        cost: '',
        provider: '',
      });
      setShowServiceForm(false);
      fetchServices(selectedCar.id);
    } catch (error) {
      console.error('Error creating service:', error);
    }
  };

  const handleDeleteCar = async (id: string) => {
    setPendingDelete({
      message: 'Are you sure you want to delete this car?',
      onConfirm: async () => {
        try {
          await client.models.Car.delete({ id });
          if (selectedCar?.id === id) setSelectedCar(null);
          fetchCars();
          setToast({ message: 'Car deleted successfully.', type: 'success' });
        } catch (error) {
          console.error('Error deleting car:', error);
          setToast({ message: 'Failed to delete car. Please try again.', type: 'error' });
        }
      },
    });
  };

  const handleCancelMileageEdit = () => {
    setEditingMileageCar(null);
    setMileageInput('');
  };

  const isRegistrationExpiringSoon = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return false;
    // Normalize to date-only comparison (midnight local time)
    const [year, month, day] = expiryDate.split('-').map(Number);
    const expiry = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30 && diffDays > 0;
  };

  const isRegistrationExpired = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return false;
    const [year, month, day] = expiryDate.split('-').map(Number);
    const expiry = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiry < today;
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
        <h2 className="text-3xl font-bold text-gray-800">Cars Management</h2>
        <button
          onClick={() => setShowCarForm(true)}
          className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
        >
          Add Car
        </button>
      </div>

      {/* Car Form Modal */}
      {showCarForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">Add New Car</h3>
            <form onSubmit={handleCreateCar} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                  <input
                    type="text"
                    value={carForm.make}
                    onChange={(e) => setCarForm({ ...carForm, make: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={carForm.model}
                    onChange={(e) => setCarForm({ ...carForm, model: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={carForm.year}
                    onChange={(e) => setCarForm({ ...carForm, year: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="text"
                    value={carForm.color}
                    onChange={(e) => setCarForm({ ...carForm, color: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VIN (Vehicle Identification Number)</label>
                <input
                  type="text"
                  value={carForm.vin}
                  onChange={(e) => setCarForm({ ...carForm, vin: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                  <input
                    type="text"
                    value={carForm.licensePlate}
                    onChange={(e) => setCarForm({ ...carForm, licensePlate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Expiry</label>
                  <input
                    type="date"
                    value={carForm.registrationExpiry}
                    onChange={(e) => setCarForm({ ...carForm, registrationExpiry: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Mileage</label>
                <input
                  type="number"
                  value={carForm.currentMileage}
                  onChange={(e) => setCarForm({ ...carForm, currentMileage: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
                >
                  Create Car
                </button>
                <button
                  type="button"
                  onClick={() => setShowCarForm(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cars List */}
      <div className="grid gap-6">
        {cars.map((car) => (
          <div key={car.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800">
                  {car.year} {car.make} {car.model}
                </h3>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">VIN:</span> {car.vin}
                  </p>
                  {car.color && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Color:</span> {car.color}
                    </p>
                  )}
                  {car.licensePlate && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">License Plate:</span> {car.licensePlate}
                    </p>
                  )}
                  {car.registrationExpiry && (
                    <p className="text-sm">
                      <span className="font-medium text-gray-600">Registration Expiry:</span>{' '}
                      <span
                        className={
                          isRegistrationExpired(car.registrationExpiry)
                            ? 'text-red-600 font-semibold'
                            : isRegistrationExpiringSoon(car.registrationExpiry)
                            ? 'text-yellow-600 font-semibold'
                            : 'text-gray-600'
                        }
                      >
                        {car.registrationExpiry}
                        {isRegistrationExpired(car.registrationExpiry) && ' ⚠️ Expired'}
                        {!isRegistrationExpired(car.registrationExpiry) &&
                          isRegistrationExpiringSoon(car.registrationExpiry) &&
                          ' ⚠️ Expiring Soon'}
                      </span>
                    </p>
                  )}
                </div>

                {/* Mileage display & inline update */}
                <div className="mt-3 flex items-center gap-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Current Mileage:</span>{' '}
                    {car.currentMileage != null ? `${car.currentMileage.toLocaleString()} miles` : 'Not set'}
                  </p>
                  {editingMileageCar === car.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={mileageInput}
                        onChange={(e) => setMileageInput(e.target.value)}
                        placeholder="New mileage"
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => handleUpdateMileage(car.id)}
                        className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-3 py-1 rounded text-sm transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelMileageEdit}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded text-sm transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingMileageCar(car.id);
                        setMileageInput(car.currentMileage?.toString() ?? '');
                      }}
                      className="text-royal-blue-600 hover:text-royal-blue-800 text-sm underline transition"
                    >
                      Update
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    setSelectedCar(car);
                    fetchServices(car.id);
                  }}
                  className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-4 py-2 rounded-lg transition text-sm"
                >
                  View Service History
                </button>
                <button
                  onClick={() => handleDeleteCar(car.id)}
                  className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition text-sm"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Service History Section */}
            {selectedCar?.id === car.id && (
              <div className="mt-6 border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold">Service History</h4>
                  <button
                    onClick={() => setShowServiceForm(true)}
                    className="bg-royal-blue-500 hover:bg-royal-blue-600 text-white px-4 py-2 rounded-lg transition text-sm"
                  >
                    Add Service Record
                  </button>
                </div>

                {/* Service Form */}
                {showServiceForm && (
                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <form onSubmit={handleCreateService} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                          <input
                            type="text"
                            placeholder="e.g., Oil Change, Tire Rotation"
                            value={serviceForm.serviceType}
                            onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                          <input
                            type="date"
                            value={serviceForm.date}
                            onChange={(e) => setServiceForm({ ...serviceForm, date: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={serviceForm.description}
                          onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Mileage at Service</label>
                          <input
                            type="number"
                            value={serviceForm.mileageAtService}
                            onChange={(e) => setServiceForm({ ...serviceForm, mileageAtService: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cost ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={serviceForm.cost}
                            onChange={(e) => setServiceForm({ ...serviceForm, cost: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Provider (Location)</label>
                          <input
                            type="text"
                            value={serviceForm.provider}
                            onChange={(e) => setServiceForm({ ...serviceForm, provider: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-4 py-2 rounded-lg transition text-sm"
                        >
                          Add Service
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowServiceForm(false)}
                          className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Services List */}
                <div className="space-y-3">
                  {services.map((service, index) => {
                    const nextService = services[index + 1];
                    const mileageGap =
                      service.mileageAtService != null && nextService?.mileageAtService != null
                        ? service.mileageAtService - nextService.mileageAtService
                        : null;
                    return (
                      <div key={service.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex flex-wrap gap-3 items-center">
                              <h5 className="font-semibold text-gray-800">{service.serviceType}</h5>
                              {service.cost != null && (
                                <span className="text-sm font-medium text-green-600">${service.cost.toFixed(2)}</span>
                              )}
                              {mileageGap != null && (
                                <span className="text-xs bg-royal-blue-100 text-royal-blue-700 px-2 py-0.5 rounded-full">
                                  +{mileageGap.toLocaleString()} mi since previous
                                </span>
                              )}
                            </div>
                            {service.description && (
                              <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                            )}
                            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                              <span>📅 {service.date}</span>
                              {service.mileageAtService != null && (
                                <span>📏 {service.mileageAtService.toLocaleString()} miles</span>
                              )}
                              {service.provider && <span>🔧 {service.provider}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {services.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No service records yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {cars.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No cars yet. Add your first car to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}

