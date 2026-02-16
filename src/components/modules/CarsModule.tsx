import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

interface CarsModuleProps {
  user: any;
}

export default function CarsModule({ user }: CarsModuleProps) {
  const [cars, setCars] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [showCarForm, setShowCarForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [carForm, setCarForm] = useState({
    make: '',
    model: '',
    year: '',
    vin: '',
    currentMileage: '',
    color: '',
  });
  const [serviceForm, setServiceForm] = useState({
    serviceType: '',
    description: '',
    mileage: '',
    date: '',
    cost: '',
    serviceProvider: '',
  });

  useEffect(() => {
    fetchCars();
  }, []);

  const fetchCars = async () => {
    try {
      const { data } = await client.models.Car.list();
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
      setServices(data);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleCreateCar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.Car.create({
        ...carForm,
        year: parseInt(carForm.year),
        currentMileage: carForm.currentMileage ? parseInt(carForm.currentMileage) : undefined,
      });
      setCarForm({
        make: '',
        model: '',
        year: '',
        vin: '',
        currentMileage: '',
        color: '',
      });
      setShowCarForm(false);
      fetchCars();
    } catch (error) {
      console.error('Error creating car:', error);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar) return;
    try {
      await client.models.CarService.create({
        ...serviceForm,
        carId: selectedCar.id,
        mileage: serviceForm.mileage ? parseInt(serviceForm.mileage) : undefined,
        cost: serviceForm.cost ? parseFloat(serviceForm.cost) : undefined,
      });
      setServiceForm({
        serviceType: '',
        description: '',
        mileage: '',
        date: '',
        cost: '',
        serviceProvider: '',
      });
      setShowServiceForm(false);
      fetchServices(selectedCar.id);
    } catch (error) {
      console.error('Error creating service:', error);
    }
  };

  const handleDeleteCar = async (id: string) => {
    if (confirm('Are you sure you want to delete this car?')) {
      try {
        await client.models.Car.delete({ id });
        fetchCars();
      } catch (error) {
        console.error('Error deleting car:', error);
      }
    }
  };

  return (
    <div>
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
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
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
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {car.year} {car.make} {car.model}
                </h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">VIN:</span> {car.vin}
                  </p>
                  {car.color && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Color:</span> {car.color}
                    </p>
                  )}
                  {car.currentMileage && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Current Mileage:</span> {car.currentMileage.toLocaleString()} miles
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
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
                      <div className="grid grid-cols-2 gap-3">
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
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Mileage</label>
                          <input
                            type="number"
                            value={serviceForm.mileage}
                            onChange={(e) => setServiceForm({ ...serviceForm, mileage: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                          <input
                            type="number"
                            step="0.01"
                            value={serviceForm.cost}
                            onChange={(e) => setServiceForm({ ...serviceForm, cost: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Service Provider</label>
                          <input
                            type="text"
                            value={serviceForm.serviceProvider}
                            onChange={(e) => setServiceForm({ ...serviceForm, serviceProvider: e.target.value })}
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
                  {services.map((service) => (
                    <div key={service.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex gap-3 items-center">
                            <h5 className="font-semibold text-gray-800">{service.serviceType}</h5>
                            {service.cost && (
                              <span className="text-sm font-medium text-green-600">${service.cost.toFixed(2)}</span>
                            )}
                          </div>
                          {service.description && <p className="text-sm text-gray-600 mt-1">{service.description}</p>}
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>📅 {service.date}</span>
                            {service.mileage && <span>📏 {service.mileage.toLocaleString()} miles</span>}
                            {service.serviceProvider && <span>🔧 {service.serviceProvider}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
