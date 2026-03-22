import React, { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

const client = generateClient<Schema>();

const getTransportationEmoji = (transportation: string) => {
  switch (transportation) {
    case "flight":
    case "FLIGHT":
      return "✈️";
    case "car":
    case "CAR":
      return "🚗";
    case "boat":
    case "BOAT":
      return "⛵";
    case "TRAIN":
      return "🚂";
    case "CRUISE":
      return "🚢";
    default:
      return "🚗";
  }
};

const getTripTypeLabel = (tripType: string | null | undefined) => {
  switch (tripType) {
    case "SINGLE_LOCATION":
      return "📍 Single Location";
    case "MULTI_LOCATION":
      return "🗺️ Multi-Location";
    case "CRUISE":
      return "🚢 Cruise";
    default:
      return "";
  }
};

const getExcursionStatusBadge = (status: string | null | undefined) => {
  switch (status) {
    case "PROPOSED":
      return "bg-yellow-100 text-yellow-800";
    case "UNDER_REVIEW":
      return "bg-blue-100 text-blue-800";
    case "SELECTED":
      return "bg-green-100 text-green-800";
    case "BOOKED":
      return "bg-purple-100 text-purple-800";
    case "REJECTED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

interface VacationsModuleProps {
  user: any;
}

type ActiveTab = "activities" | "itinerary" | "excursions" | "flights";

export default function VacationsModule({ user }: VacationsModuleProps) {
  const segmentIdCounter = React.useRef(0);
  const [vacations, setVacations] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [legs, setLegs] = useState<any[]>([]);
  const [transportSegments, setTransportSegments] = useState<any[]>([]);
  const [accommodationStays, setAccommodationStays] = useState<any[]>([]);
  const [cruisePortStops, setCruisePortStops] = useState<any[]>([]);
  const [excursionOptions, setExcursionOptions] = useState<any[]>([]);
  const [votesByExcursion, setVotesByExcursion] = useState<Record<string, any[]>>({});
  const [excursionComments, setExcursionComments] = useState<any[]>([]);
  const [feedbacksByTarget, setFeedbacksByTarget] = useState<Record<string, any[]>>({});
  const [selectedFeedbackTargetId, setSelectedFeedbackTargetId] = useState<string | null>(null);
  const [tripFeedbackForm, setTripFeedbackForm] = useState<{
    rating: number;
    comment: string;
    recommend: boolean | null;
  }>({ rating: 5, comment: '', recommend: null });

  const [showVacationForm, setShowVacationForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showLegForm, setShowLegForm] = useState(false);
  const [showTransportForm, setShowTransportForm] = useState(false);
  const [showAccommodationForm, setShowAccommodationForm] = useState(false);
  const [showPortStopForm, setShowPortStopForm] = useState(false);
  const [showExcursionForm, setShowExcursionForm] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);

  const [selectedVacation, setSelectedVacation] = useState<any>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [selectedLeg, setSelectedLeg] = useState<any>(null);
  const [selectedExcursion, setSelectedExcursion] = useState<any>(null);
  const [selectedPortStop, setSelectedPortStop] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("activities");

  const [flightSegments, setFlightSegments] = useState<any[]>([]);
  const [pendingFlightSegments, setPendingFlightSegments] = useState<Array<{
    localId: string;
    airline: string;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    departureDateTime: string;
    arrivalDateTime: string;
    confirmationNumber: string;
    notes: string;
  }>>([]);
  const [showFlightSegmentForm, setShowFlightSegmentForm] = useState(false);
  const [flightSegmentFormError, setFlightSegmentFormError] = useState("");

  const [vacationForm, setVacationForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    transportation: "flight" as "flight" | "car" | "boat",
    accommodations: "",
    tripType: "SINGLE_LOCATION" as "SINGLE_LOCATION" | "MULTI_LOCATION" | "CRUISE",
  });

  const [activityForm, setActivityForm] = useState({
    name: "",
    description: "",
    date: "",
    location: "",
  });

  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    comment: "",
  });

  const [legForm, setLegForm] = useState({
    sequence: 1,
    name: "",
    description: "",
    legType: "TRAVEL" as "TRAVEL" | "STAY" | "CRUISE_LEG",
    startDate: "",
    endDate: "",
  });

  const [transportForm, setTransportForm] = useState({
    type: "FLIGHT" as "FLIGHT" | "TRAIN" | "CAR" | "BOAT" | "CRUISE",
    carrier: "",
    flightNumber: "",
    departureLocation: "",
    arrivalLocation: "",
    departureTime: "",
    arrivalTime: "",
    confirmationCode: "",
    notes: "",
  });

  const [accommodationForm, setAccommodationForm] = useState({
    type: "HOTEL" as "HOTEL" | "RENTAL" | "CABIN" | "RESORT" | "CRUISE_SHIP" | "OTHER",
    name: "",
    address: "",
    checkInDate: "",
    checkOutDate: "",
    confirmationCode: "",
    notes: "",
  });

  const [portStopForm, setPortStopForm] = useState({
    portName: "",
    country: "",
    arrivalDate: "",
    departureDate: "",
    sequence: 1,
  });

  const [excursionForm, setExcursionForm] = useState({
    name: "",
    description: "",
    estimatedCost: "",
    duration: "",
    category: "",
    status: "PROPOSED" as "PROPOSED" | "UNDER_REVIEW" | "SELECTED" | "BOOKED" | "REJECTED",
  });

  const [flightSegmentForm, setFlightSegmentForm] = useState({
    airline: "",
    flightNumber: "",
    departureAirport: "",
    arrivalAirport: "",
    departureDateTime: "",
    arrivalDateTime: "",
    confirmationNumber: "",
    notes: "",
  });

  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    fetchVacations();
  }, []);

  const fetchVacations = async () => {
    try {
      const { data } = await client.models.Vacation.list();
      setVacations(data);
    } catch (error) {
      console.error("Error fetching vacations:", error);
    }
  };

  const fetchActivities = async (vacationId: string) => {
    try {
      const { data } = await client.models.Activity.list({
        filter: { vacationId: { eq: vacationId } },
      });
      setActivities(data);
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
  };

  const fetchFeedbacks = async (activityId: string) => {
    try {
      const { data } = await client.models.Feedback.list({
        filter: { activityId: { eq: activityId } },
      });
      setFeedbacks(data);
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
    }
  };

  const fetchLegs = async (vacationId: string) => {
    try {
      const { data } = await client.models.TripLeg.list({
        filter: { vacationId: { eq: vacationId } },
      });
      const sorted = [...data].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
      setLegs(sorted);
    } catch (error) {
      console.error("Error fetching trip legs:", error);
    }
  };

  const fetchTransportSegments = async (tripLegId: string) => {
    try {
      const { data } = await client.models.TransportSegment.list({
        filter: { tripLegId: { eq: tripLegId } },
      });
      setTransportSegments(data);
    } catch (error) {
      console.error("Error fetching transport segments:", error);
    }
  };

  const fetchAccommodationStays = async (tripLegId: string) => {
    try {
      const { data } = await client.models.AccommodationStay.list({
        filter: { tripLegId: { eq: tripLegId } },
      });
      setAccommodationStays(data);
    } catch (error) {
      console.error("Error fetching accommodation stays:", error);
    }
  };

  const fetchCruisePortStops = async (tripLegId: string) => {
    try {
      const { data } = await client.models.CruisePortStop.list({
        filter: { tripLegId: { eq: tripLegId } },
      });
      const sorted = [...data].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
      setCruisePortStops(sorted);
    } catch (error) {
      console.error("Error fetching cruise port stops:", error);
    }
  };

  const fetchExcursionOptions = async (tripLegId?: string, cruisePortStopId?: string) => {
    try {
      let data: any[] = [];
      if (cruisePortStopId) {
        const result = await client.models.ExcursionOption.list({
          filter: { cruisePortStopId: { eq: cruisePortStopId } },
        });
        data = result.data;
      } else if (tripLegId) {
        const result = await client.models.ExcursionOption.list({
          filter: { tripLegId: { eq: tripLegId } },
        });
        data = result.data;
      }
      setExcursionOptions(data);
      // Fetch votes for all excursion options at once for display
      if (data.length > 0) {
        const voteFetches = data.map((opt) =>
          client.models.ExcursionVote.list({ filter: { excursionOptionId: { eq: opt.id } } })
        );
        const results = await Promise.all(voteFetches);
        const votesMap: Record<string, any[]> = {};
        data.forEach((opt, i) => { votesMap[opt.id] = results[i].data; });
        setVotesByExcursion(votesMap);
      }
    } catch (error) {
      console.error("Error fetching excursion options:", error);
    }
  };

  const fetchExcursionVotes = async (excursionOptionId: string) => {
    try {
      const { data } = await client.models.ExcursionVote.list({
        filter: { excursionOptionId: { eq: excursionOptionId } },
      });
      setVotesByExcursion((prev) => ({ ...prev, [excursionOptionId]: data }));
    } catch (error) {
      console.error("Error fetching excursion votes:", error);
    }
  };

  const fetchExcursionComments = async (excursionOptionId: string) => {
    try {
      const { data } = await client.models.ExcursionComment.list({
        filter: { excursionOptionId: { eq: excursionOptionId } },
      });
      setExcursionComments(data);
    } catch (error) {
      console.error("Error fetching excursion comments:", error);
    }
  };

  const fetchFlightSegments = async (vacationId: string) => {
    try {
      const { data } = await client.models.FlightSegment.list({
        filter: { vacationId: { eq: vacationId } },
      });
      setFlightSegments(data ?? []);
    } catch (error) {
      console.error("Error fetching flight segments:", error);
    }
  };

  const fetchFeedbacksForTarget = async (targetId: string): Promise<any[]> => {
    try {
      const { data } = await client.models.TripFeedback.list({
        filter: { targetId: { eq: targetId } },
      });
      setFeedbacksByTarget((prev) => ({ ...prev, [targetId]: data }));
      return data;
    } catch (error) {
      console.error("Error fetching trip feedbacks:", error);
      return [];
    }
  };

  const handleSubmitTripFeedback = async (
    e: React.FormEvent,
    targetType: 'ACCOMMODATION' | 'EXCURSION',
    targetId: string,
    vacationId: string
  ) => {
    e.preventDefault();
    const clampedRating = Math.min(5, Math.max(1, tripFeedbackForm.rating));
    const userId = user?.signInDetails?.loginId || "unknown";
    const existing = (feedbacksByTarget[targetId] ?? []).find((f) => f.userId === userId);
    try {
      if (existing) {
        await client.models.TripFeedback.update({
          id: existing.id,
          rating: clampedRating,
          comment: tripFeedbackForm.comment || undefined,
          recommend: tripFeedbackForm.recommend ?? undefined,
        });
      } else {
        await client.models.TripFeedback.create({
          vacationId,
          targetType,
          targetId,
          userId,
          rating: clampedRating,
          comment: tripFeedbackForm.comment || undefined,
          recommend: tripFeedbackForm.recommend ?? undefined,
        });
      }
      setTripFeedbackForm({ rating: 5, comment: '', recommend: null });
      setSelectedFeedbackTargetId(null);
      fetchFeedbacksForTarget(targetId);
    } catch (error) {
      console.error("Error saving trip feedback:", error);
    }
  };

  const computeFeedbackAggregate = (feedbacks: any[]) => {
    if (!feedbacks || feedbacks.length === 0) return null;
    const valid = feedbacks.filter((f) => typeof f.rating === 'number' && f.rating >= 1);
    if (valid.length === 0) return null;
    const avg = valid.reduce((sum, f) => sum + f.rating, 0) / valid.length;
    const recommendCount = feedbacks.filter((f) => f.recommend === true).length;
    return { avg: Math.round(avg * 10) / 10, count: valid.length, recommendCount };
  };

  const handleCreateVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: newVacation } = await client.models.Vacation.create({
        ...vacationForm,
        createdBy: user?.signInDetails?.loginId || "unknown",
      });
      if (newVacation && pendingFlightSegments.length > 0) {
        await Promise.all(
          pendingFlightSegments.map((seg) =>
            client.models.FlightSegment.create({
              vacationId: newVacation.id,
              airline: seg.airline,
              flightNumber: seg.flightNumber,
              departureAirport: seg.departureAirport,
              arrivalAirport: seg.arrivalAirport,
              departureDateTime: new Date(seg.departureDateTime).toISOString(),
              arrivalDateTime: new Date(seg.arrivalDateTime).toISOString(),
              confirmationNumber: seg.confirmationNumber || undefined,
              notes: seg.notes || undefined,
            })
          )
        );
      }
      setVacationForm({ title: "", description: "", startDate: "", endDate: "", transportation: "flight", accommodations: "", tripType: "SINGLE_LOCATION" });
      setPendingFlightSegments([]);
      setFlightSegmentForm({ airline: "", flightNumber: "", departureAirport: "", arrivalAirport: "", departureDateTime: "", arrivalDateTime: "", confirmationNumber: "", notes: "" });
      setFlightSegmentFormError("");
      setShowVacationForm(false);
      fetchVacations();
    } catch (error) {
      console.error("Error creating vacation:", error);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVacation) return;
    try {
      await client.models.Activity.create({ ...activityForm, vacationId: selectedVacation.id });
      setActivityForm({ name: "", description: "", date: "", location: "" });
      setShowActivityForm(false);
      fetchActivities(selectedVacation.id);
    } catch (error) {
      console.error("Error creating activity:", error);
    }
  };

  const handleCreateFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    try {
      await client.models.Feedback.create({
        ...feedbackForm,
        activityId: selectedActivity.id,
        userId: user?.signInDetails?.loginId || "unknown",
        createdAt: new Date().toISOString(),
      });
      setFeedbackForm({ rating: 5, comment: "" });
      fetchFeedbacks(selectedActivity.id);
    } catch (error) {
      console.error("Error creating feedback:", error);
    }
  };

  const handleCreateLeg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.TripLeg.create({
        ...legForm,
        vacationId: selectedVacation.id,
        startDate: legForm.startDate || undefined,
        endDate: legForm.endDate || undefined,
      });
      setLegForm({ sequence: legs.length + 1, name: "", description: "", legType: "TRAVEL", startDate: "", endDate: "" });
      setShowLegForm(false);
      fetchLegs(selectedVacation.id);
    } catch (error) {
      console.error("Error creating trip leg:", error);
    }
  };

  const handleCreateTransportSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.TransportSegment.create({
        ...transportForm,
        tripLegId: selectedLeg.id,
        departureTime: transportForm.departureTime || undefined,
        arrivalTime: transportForm.arrivalTime || undefined,
      });
      setTransportForm({ type: "FLIGHT", carrier: "", flightNumber: "", departureLocation: "", arrivalLocation: "", departureTime: "", arrivalTime: "", confirmationCode: "", notes: "" });
      setShowTransportForm(false);
      fetchTransportSegments(selectedLeg.id);
    } catch (error) {
      console.error("Error creating transport segment:", error);
    }
  };

  const handleCreateAccommodationStay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.AccommodationStay.create({ ...accommodationForm, tripLegId: selectedLeg.id });
      setAccommodationForm({ type: "HOTEL", name: "", address: "", checkInDate: "", checkOutDate: "", confirmationCode: "", notes: "" });
      setShowAccommodationForm(false);
      fetchAccommodationStays(selectedLeg.id);
    } catch (error) {
      console.error("Error creating accommodation stay:", error);
    }
  };

  const handleCreatePortStop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.CruisePortStop.create({
        ...portStopForm,
        tripLegId: selectedLeg.id,
        arrivalDate: portStopForm.arrivalDate || undefined,
        departureDate: portStopForm.departureDate || undefined,
      });
      setPortStopForm({ portName: "", country: "", arrivalDate: "", departureDate: "", sequence: cruisePortStops.length + 1 });
      setShowPortStopForm(false);
      fetchCruisePortStops(selectedLeg.id);
    } catch (error) {
      console.error("Error creating port stop:", error);
    }
  };

  const handleCreateExcursion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.ExcursionOption.create({
        ...excursionForm,
        estimatedCost: excursionForm.estimatedCost ? parseFloat(excursionForm.estimatedCost) : undefined,
        proposedBy: user?.signInDetails?.loginId || "unknown",
        tripLegId: selectedPortStop ? undefined : selectedLeg?.id,
        cruisePortStopId: selectedPortStop?.id,
      });
      setExcursionForm({ name: "", description: "", estimatedCost: "", duration: "", category: "", status: "PROPOSED" });
      setShowExcursionForm(false);
      if (selectedPortStop) {
        fetchExcursionOptions(undefined, selectedPortStop.id);
      } else if (selectedLeg) {
        fetchExcursionOptions(selectedLeg.id);
      }
    } catch (error) {
      console.error("Error creating excursion option:", error);
    }
  };

  const handleVote = async (excursionOptionId: string, vote: "UP" | "DOWN") => {
    const uid = user?.signInDetails?.loginId || "unknown";
    const currentVotes = votesByExcursion[excursionOptionId] ?? [];
    const existing = currentVotes.find((v) => v.userId === uid);
    if (existing) {
      try {
        await client.models.ExcursionVote.update({ id: existing.id, vote });
        fetchExcursionVotes(excursionOptionId);
      } catch (error) {
        console.error("Error updating vote:", error);
      }
    } else {
      try {
        await client.models.ExcursionVote.create({ excursionOptionId, userId: uid, vote });
        fetchExcursionVotes(excursionOptionId);
      } catch (error) {
        console.error("Error creating vote:", error);
      }
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExcursion || !commentText.trim()) return;
    try {
      await client.models.ExcursionComment.create({
        excursionOptionId: selectedExcursion.id,
        userId: user?.signInDetails?.loginId || "unknown",
        comment: commentText.trim(),
        createdAt: new Date().toISOString(),
      });
      setCommentText("");
      setShowCommentForm(false);
      fetchExcursionComments(selectedExcursion.id);
    } catch (error) {
      console.error("Error creating comment:", error);
    }
  };

  const handleDeleteVacation = async (id: string) => {
    if (confirm("Are you sure you want to delete this vacation?")) {
      try {
        await client.models.Vacation.delete({ id });
        fetchVacations();
      } catch (error) {
        console.error("Error deleting vacation:", error);
      }
    }
  };

  const validateFlightSegmentForm = (form: typeof flightSegmentForm): string => {
    if (!form.airline.trim()) return "Airline is required.";
    if (!form.flightNumber.trim()) return "Flight number is required.";
    if (!form.departureAirport.trim()) return "Departure airport is required.";
    if (!form.arrivalAirport.trim()) return "Arrival airport is required.";
    if (!form.departureDateTime) return "Departure date/time is required.";
    if (!form.arrivalDateTime) return "Arrival date/time is required.";
    if (new Date(form.arrivalDateTime) <= new Date(form.departureDateTime)) {
      return "Arrival date/time must be after departure date/time.";
    }
    return "";
  };

  const handleAddPendingFlightSegment = () => {
    const error = validateFlightSegmentForm(flightSegmentForm);
    if (error) {
      setFlightSegmentFormError(error);
      return;
    }
    setPendingFlightSegments((prev) => [
      ...prev,
      { ...flightSegmentForm, localId: String(++segmentIdCounter.current) },
    ]);
    setFlightSegmentForm({ airline: "", flightNumber: "", departureAirport: "", arrivalAirport: "", departureDateTime: "", arrivalDateTime: "", confirmationNumber: "", notes: "" });
    setFlightSegmentFormError("");
  };

  const handleRemovePendingFlightSegment = (localId: string) => {
    setPendingFlightSegments((prev) => prev.filter((s) => s.localId !== localId));
  };

  const handleCreateFlightSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVacation) return;
    const error = validateFlightSegmentForm(flightSegmentForm);
    if (error) {
      setFlightSegmentFormError(error);
      return;
    }
    try {
      const { data: created, errors } = await client.models.FlightSegment.create({
        vacationId: selectedVacation.id,
        airline: flightSegmentForm.airline,
        flightNumber: flightSegmentForm.flightNumber,
        departureAirport: flightSegmentForm.departureAirport,
        arrivalAirport: flightSegmentForm.arrivalAirport,
        departureDateTime: new Date(flightSegmentForm.departureDateTime).toISOString(),
        arrivalDateTime: new Date(flightSegmentForm.arrivalDateTime).toISOString(),
        confirmationNumber: flightSegmentForm.confirmationNumber || undefined,
        notes: flightSegmentForm.notes || undefined,
      });
      if (errors || !created) {
        console.error("Error creating flight segment:", errors);
        setFlightSegmentFormError("Failed to save flight segment. Please try again.");
        return;
      }
      setFlightSegmentForm({ airline: "", flightNumber: "", departureAirport: "", arrivalAirport: "", departureDateTime: "", arrivalDateTime: "", confirmationNumber: "", notes: "" });
      setFlightSegmentFormError("");
      setShowFlightSegmentForm(false);
      fetchFlightSegments(selectedVacation.id);
    } catch (error) {
      console.error("Error creating flight segment:", error);
      setFlightSegmentFormError("An unexpected error occurred. Please try again.");
    }
  };

  const handleDeleteFlightSegment = async (id: string) => {
    if (!selectedVacation) return;
    try {
      await client.models.FlightSegment.delete({ id });
      fetchFlightSegments(selectedVacation.id);
    } catch (error) {
      console.error("Error deleting flight segment:", error);
    }
  };

  const openVacationDetail = (vacation: any, tab: ActiveTab = "activities") => {
    setSelectedVacation(vacation);
    setSelectedLeg(null);
    setSelectedActivity(null);
    setSelectedExcursion(null);
    setSelectedPortStop(null);
    setActiveTab(tab);
    if (tab === "activities") fetchActivities(vacation.id);
    if (tab === "itinerary") fetchLegs(vacation.id);
    if (tab === "excursions") fetchLegs(vacation.id);
    if (tab === "flights") fetchFlightSegments(vacation.id);
  };

  const uid = user?.signInDetails?.loginId || "unknown";

  const openFeedbackForm = (targetId: string, feedbacks: any[]) => {
    const existing = feedbacks.find((f) => f.userId === uid);
    if (existing) {
      setTripFeedbackForm({
        rating: existing.rating ?? 5,
        comment: existing.comment ?? '',
        recommend: existing.recommend ?? null,
      });
    } else {
      setTripFeedbackForm({ rating: 5, comment: '', recommend: null });
    }
    setSelectedFeedbackTargetId(targetId);
  };

  const renderStarSelector = () => (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-600 mr-1">Rating:</span>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setTripFeedbackForm((prev) => ({ ...prev, rating: star }))}
          className="text-xl focus:outline-none"
        >
          {star <= tripFeedbackForm.rating ? '⭐' : '☆'}
        </button>
      ))}
    </div>
  );

  const renderRecommendToggle = () => (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-600">Would you recommend?</span>
      <button
        type="button"
        onClick={() => setTripFeedbackForm((prev) => ({ ...prev, recommend: true }))}
        className={`px-2 py-1 rounded transition ${tripFeedbackForm.recommend === true ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
      >
        👍 Yes
      </button>
      <button
        type="button"
        onClick={() => setTripFeedbackForm((prev) => ({ ...prev, recommend: false }))}
        className={`px-2 py-1 rounded transition ${tripFeedbackForm.recommend === false ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
      >
        👎 No
      </button>
    </div>
  );

  const renderFeedbackComments = (targetFeedbacks: any[]) => {
    const withComments = targetFeedbacks.filter((f) => f.comment);
    if (withComments.length === 0) return null;
    return withComments.slice(-2).map((f) => (
      <div key={f.id} className="text-xs text-gray-500 italic">
        "{f.comment}" — {f.userId}
      </div>
    ));
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Trip Type</label>
                <select
                  value={vacationForm.tripType}
                  onChange={(e) => setVacationForm({ ...vacationForm, tripType: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                >
                  <option value="SINGLE_LOCATION">📍 Single Location</option>
                  <option value="MULTI_LOCATION">🗺️ Multi-Location</option>
                  <option value="CRUISE">🚢 Cruise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Transportation</label>
                <select
                  value={vacationForm.transportation}
                  onChange={(e) => setVacationForm({ ...vacationForm, transportation: e.target.value as any })}
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

              {/* Flight Itinerary Section — shown only when transportation is flight */}
              {vacationForm.transportation === "flight" && (
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">✈️ Flight Itinerary</h4>

                  {/* Pending flight segments list */}
                  {pendingFlightSegments.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {pendingFlightSegments.map((seg) => (
                        <div key={seg.localId} className="bg-white border border-blue-100 rounded p-3 text-sm flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-800">
                              ✈️ {seg.airline} {seg.flightNumber}
                            </div>
                            <div className="text-gray-600 mt-0.5">
                              {seg.departureAirport} → {seg.arrivalAirport}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {new Date(seg.departureDateTime).toLocaleString()} → {new Date(seg.arrivalDateTime).toLocaleString()}
                            </div>
                            {seg.confirmationNumber && (
                              <div className="text-xs text-gray-500">Conf: {seg.confirmationNumber}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePendingFlightSegment(seg.localId)}
                            className="text-red-500 hover:text-red-700 text-xs ml-2"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add flight segment inline form */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Airline *"
                        value={flightSegmentForm.airline}
                        onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, airline: e.target.value })}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Flight Number *"
                        value={flightSegmentForm.flightNumber}
                        onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, flightNumber: e.target.value })}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Departure Airport *"
                        value={flightSegmentForm.departureAirport}
                        onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, departureAirport: e.target.value })}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Arrival Airport *"
                        value={flightSegmentForm.arrivalAirport}
                        onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, arrivalAirport: e.target.value })}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Departure Date/Time *</label>
                        <input
                          type="datetime-local"
                          value={flightSegmentForm.departureDateTime}
                          onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, departureDateTime: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Arrival Date/Time *</label>
                        <input
                          type="datetime-local"
                          value={flightSegmentForm.arrivalDateTime}
                          onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, arrivalDateTime: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Confirmation Number"
                        value={flightSegmentForm.confirmationNumber}
                        onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, confirmationNumber: e.target.value })}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Notes"
                        value={flightSegmentForm.notes}
                        onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, notes: e.target.value })}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    {flightSegmentFormError && (
                      <p className="text-xs text-red-600">{flightSegmentFormError}</p>
                    )}
                    <button
                      type="button"
                      onClick={handleAddPendingFlightSegment}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm"
                    >
                      + Add Flight Segment
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition">
                  Create Vacation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowVacationForm(false);
                    setPendingFlightSegments([]);
                    setFlightSegmentForm({ airline: "", flightNumber: "", departureAirport: "", arrivalAirport: "", departureDateTime: "", arrivalDateTime: "", confirmationNumber: "", notes: "" });
                    setFlightSegmentFormError("");
                  }}
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
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                  <span>📅 {vacation.startDate} - {vacation.endDate}</span>
                  <span>{getTransportationEmoji(vacation.transportation || "")} {vacation.transportation}</span>
                  {vacation.accommodations && <span>🏨 {vacation.accommodations}</span>}
                  {vacation.tripType && (
                    <span className="text-royal-blue-700 font-medium">{getTripTypeLabel(vacation.tripType)}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={() => openVacationDetail(vacation, "activities")}
                  className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-4 py-2 rounded-lg transition text-sm"
                >
                  Activities
                </button>
                <button
                  onClick={() => openVacationDetail(vacation, "itinerary")}
                  className="bg-green-100 hover:bg-green-200 text-green-700 px-4 py-2 rounded-lg transition text-sm"
                >
                  Itinerary
                </button>
                {vacation.transportation === "flight" && (
                  <button
                    onClick={() => openVacationDetail(vacation, "flights")}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg transition text-sm"
                  >
                    ✈️ Flights
                  </button>
                )}
                <button
                  onClick={() => openVacationDetail(vacation, "excursions")}
                  className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-4 py-2 rounded-lg transition text-sm"
                >
                  Excursions
                </button>
                <button
                  onClick={() => handleDeleteVacation(vacation.id)}
                  className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition text-sm"
                >
                  Delete
                </button>
              </div>
            </div>

            {selectedVacation?.id === vacation.id && (
              <div className="mt-6 border-t pt-6">
                {/* Tab Bar */}
                <div className="flex gap-2 mb-4 border-b flex-wrap">
                  {(
                    [
                      "activities",
                      "itinerary",
                      ...(vacation.transportation === "flight" ? ["flights"] : []),
                      "excursions",
                    ] as ActiveTab[]
                  ).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === "activities") fetchActivities(vacation.id);
                        if (tab === "itinerary") fetchLegs(vacation.id);
                        if (tab === "excursions") fetchLegs(vacation.id);
                        if (tab === "flights") fetchFlightSegments(vacation.id);
                      }}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                        activeTab === tab
                          ? tab === "activities"
                            ? "border-royal-blue-600 text-royal-blue-700"
                            : tab === "itinerary"
                            ? "border-green-600 text-green-700"
                            : tab === "flights"
                            ? "border-blue-600 text-blue-700"
                            : "border-orange-600 text-orange-700"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab === "activities"
                        ? "✅ Activities"
                        : tab === "itinerary"
                        ? "🗺️ Itinerary"
                        : tab === "flights"
                        ? "✈️ Flights"
                        : "🎯 Excursions"}
                    </button>
                  ))}
                </div>

                {/* ACTIVITIES TAB */}
                {activeTab === "activities" && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold">Activities</h4>
                      <button
                        onClick={() => setShowActivityForm(true)}
                        className="bg-royal-blue-500 hover:bg-royal-blue-600 text-white px-4 py-2 rounded-lg transition text-sm"
                      >
                        Add Activity
                      </button>
                    </div>
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
                            <button type="submit" className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-4 py-2 rounded-lg transition text-sm">
                              Add
                            </button>
                            <button type="button" onClick={() => setShowActivityForm(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition text-sm">
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
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
                              onClick={() => { setSelectedActivity(activity); fetchFeedbacks(activity.id); }}
                              className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-3 py-1 rounded text-xs"
                            >
                              Feedback
                            </button>
                          </div>
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
                                      {star <= feedbackForm.rating ? "⭐" : "☆"}
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
                                <button type="submit" className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-4 py-1 rounded text-sm">
                                  Submit Feedback
                                </button>
                              </form>
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
                      {activities.length === 0 && (
                        <p className="text-center text-gray-500 py-6 text-sm">No activities yet. Add one to get started!</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ITINERARY TAB */}
                {activeTab === "itinerary" && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold">Trip Itinerary</h4>
                      <button
                        onClick={() => {
                          setLegForm({ sequence: legs.length + 1, name: "", description: "", legType: "TRAVEL", startDate: "", endDate: "" });
                          setShowLegForm(true);
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition text-sm"
                      >
                        + Add Leg
                      </button>
                    </div>
                    {showLegForm && (
                      <div className="mb-4 bg-green-50 p-4 rounded-lg">
                        <h5 className="font-medium mb-3 text-green-800">New Trip Leg</h5>
                        <form onSubmit={handleCreateLeg} className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="number"
                              placeholder="Sequence #"
                              value={legForm.sequence}
                              onChange={(e) => setLegForm({ ...legForm, sequence: parseInt(e.target.value) })}
                              className="px-4 py-2 border border-gray-300 rounded-lg"
                              required
                              min={1}
                            />
                            <select
                              value={legForm.legType}
                              onChange={(e) => setLegForm({ ...legForm, legType: e.target.value as any })}
                              className="px-4 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="TRAVEL">🚀 Travel</option>
                              <option value="STAY">🏨 Stay</option>
                              <option value="CRUISE_LEG">🚢 Cruise Leg</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            placeholder="Leg Name (e.g. Outbound Flight, Paris Stay)"
                            value={legForm.name}
                            onChange={(e) => setLegForm({ ...legForm, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            required
                          />
                          <textarea
                            placeholder="Description"
                            value={legForm.description}
                            onChange={(e) => setLegForm({ ...legForm, description: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            rows={2}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="date"
                              value={legForm.startDate}
                              onChange={(e) => setLegForm({ ...legForm, startDate: e.target.value })}
                              className="px-4 py-2 border border-gray-300 rounded-lg"
                            />
                            <input
                              type="date"
                              value={legForm.endDate}
                              onChange={(e) => setLegForm({ ...legForm, endDate: e.target.value })}
                              className="px-4 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
                              Add Leg
                            </button>
                            <button type="button" onClick={() => setShowLegForm(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg text-sm">
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                    <div className="space-y-4">
                      {legs.map((leg) => (
                        <div key={leg.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div
                            className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer"
                            onClick={() => {
                              if (selectedLeg?.id === leg.id) {
                                setSelectedLeg(null);
                              } else {
                                setSelectedLeg(leg);
                                fetchTransportSegments(leg.id);
                                fetchAccommodationStays(leg.id);
                                if (leg.legType === "CRUISE_LEG") fetchCruisePortStops(leg.id);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="bg-royal-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                                {leg.sequence}
                              </span>
                              <div>
                                <p className="font-semibold text-gray-800">{leg.name}</p>
                                {leg.description && <p className="text-sm text-gray-500">{leg.description}</p>}
                                <div className="flex gap-3 text-xs text-gray-400 mt-1">
                                  <span className="capitalize">{leg.legType?.toLowerCase().replace("_", " ")}</span>
                                  {leg.startDate && <span>📅 {leg.startDate}</span>}
                                  {leg.endDate && <span>→ {leg.endDate}</span>}
                                </div>
                              </div>
                            </div>
                            <span className="text-gray-400">{selectedLeg?.id === leg.id ? "▲" : "▼"}</span>
                          </div>
                          {selectedLeg?.id === leg.id && (
                            <div className="p-4 space-y-5">
                              {/* Transport Segments */}
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <h6 className="font-semibold text-sm text-gray-700">🚀 Transport Segments</h6>
                                  <button
                                    onClick={() => setShowTransportForm(true)}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
                                  >
                                    + Add
                                  </button>
                                </div>
                                {showTransportForm && (
                                  <div className="bg-blue-50 p-3 rounded-lg mb-3">
                                    <form onSubmit={handleCreateTransportSegment} className="space-y-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <select
                                          value={transportForm.type}
                                          onChange={(e) => setTransportForm({ ...transportForm, type: e.target.value as any })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                        >
                                          <option value="FLIGHT">✈️ Flight</option>
                                          <option value="TRAIN">🚂 Train</option>
                                          <option value="CAR">🚗 Car</option>
                                          <option value="BOAT">⛵ Boat</option>
                                          <option value="CRUISE">🚢 Cruise</option>
                                        </select>
                                        <input
                                          type="text"
                                          placeholder="Carrier (e.g. Delta, Amtrak)"
                                          value={transportForm.carrier}
                                          onChange={(e) => setTransportForm({ ...transportForm, carrier: e.target.value })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <input
                                          type="text"
                                          placeholder="Flight/Train #"
                                          value={transportForm.flightNumber}
                                          onChange={(e) => setTransportForm({ ...transportForm, flightNumber: e.target.value })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                        />
                                        <input
                                          type="text"
                                          placeholder="Confirmation Code"
                                          value={transportForm.confirmationCode}
                                          onChange={(e) => setTransportForm({ ...transportForm, confirmationCode: e.target.value })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <input
                                          type="text"
                                          placeholder="Departure Location *"
                                          value={transportForm.departureLocation}
                                          onChange={(e) => setTransportForm({ ...transportForm, departureLocation: e.target.value })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                          required
                                        />
                                        <input
                                          type="text"
                                          placeholder="Arrival Location *"
                                          value={transportForm.arrivalLocation}
                                          onChange={(e) => setTransportForm({ ...transportForm, arrivalLocation: e.target.value })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                          required
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <input
                                          type="datetime-local"
                                          value={transportForm.departureTime}
                                          onChange={(e) => setTransportForm({ ...transportForm, departureTime: e.target.value })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                        />
                                        <input
                                          type="datetime-local"
                                          value={transportForm.arrivalTime}
                                          onChange={(e) => setTransportForm({ ...transportForm, arrivalTime: e.target.value })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs">
                                          Add
                                        </button>
                                        <button type="button" onClick={() => setShowTransportForm(false)} className="bg-gray-300 text-gray-800 px-3 py-1.5 rounded text-xs">
                                          Cancel
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                )}
                                {transportSegments.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No transport segments yet.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {transportSegments.map((seg) => (
                                      <div key={seg.id} className="bg-blue-50 p-3 rounded text-sm">
                                        <div className="flex items-center gap-2 font-medium">
                                          {getTransportationEmoji(seg.type)} {seg.carrier} {seg.flightNumber}
                                        </div>
                                        <div className="text-gray-600 mt-1">
                                          {seg.departureLocation} → {seg.arrivalLocation}
                                        </div>
                                        {seg.departureTime && (
                                          <div className="text-xs text-gray-400 mt-1">
                                            Departs: {new Date(seg.departureTime).toLocaleString()}
                                            {seg.arrivalTime && ` · Arrives: ${new Date(seg.arrivalTime).toLocaleString()}`}
                                          </div>
                                        )}
                                        {seg.confirmationCode && (
                                          <div className="text-xs text-gray-500">Conf: {seg.confirmationCode}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Accommodation Stays */}
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <h6 className="font-semibold text-sm text-gray-700">🏨 Accommodation Stays</h6>
                                  <button
                                    onClick={() => setShowAccommodationForm(true)}
                                    className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs"
                                  >
                                    + Add
                                  </button>
                                </div>
                                {showAccommodationForm && (
                                  <div className="bg-purple-50 p-3 rounded-lg mb-3">
                                    <form onSubmit={handleCreateAccommodationStay} className="space-y-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <select
                                          value={accommodationForm.type}
                                          onChange={(e) => setAccommodationForm({ ...accommodationForm, type: e.target.value as any })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                        >
                                          <option value="HOTEL">🏨 Hotel</option>
                                          <option value="RENTAL">🏠 Rental</option>
                                          <option value="CABIN">🌲 Cabin</option>
                                          <option value="RESORT">🌴 Resort</option>
                                          <option value="CRUISE_SHIP">🚢 Cruise Ship</option>
                                          <option value="OTHER">Other</option>
                                        </select>
                                        <input
                                          type="text"
                                          placeholder="Name *"
                                          value={accommodationForm.name}
                                          onChange={(e) => setAccommodationForm({ ...accommodationForm, name: e.target.value })}
                                          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                          required
                                        />
                                      </div>
                                      <input
                                        type="text"
                                        placeholder="Address"
                                        value={accommodationForm.address}
                                        onChange={(e) => setAccommodationForm({ ...accommodationForm, address: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                                      />
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-xs text-gray-500">Check-in *</label>
                                          <input
                                            type="date"
                                            value={accommodationForm.checkInDate}
                                            onChange={(e) => setAccommodationForm({ ...accommodationForm, checkInDate: e.target.value })}
                                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                                            required
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-500">Check-out *</label>
                                          <input
                                            type="date"
                                            value={accommodationForm.checkOutDate}
                                            onChange={(e) => setAccommodationForm({ ...accommodationForm, checkOutDate: e.target.value })}
                                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                                            required
                                          />
                                        </div>
                                      </div>
                                      <input
                                        type="text"
                                        placeholder="Confirmation Code"
                                        value={accommodationForm.confirmationCode}
                                        onChange={(e) => setAccommodationForm({ ...accommodationForm, confirmationCode: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                                      />
                                      <div className="flex gap-2">
                                        <button type="submit" className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs">
                                          Add
                                        </button>
                                        <button type="button" onClick={() => setShowAccommodationForm(false)} className="bg-gray-300 text-gray-800 px-3 py-1.5 rounded text-xs">
                                          Cancel
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                )}
                                {accommodationStays.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No accommodation stays yet.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {accommodationStays.map((stay) => {
                                      const stayFeedbacks = feedbacksByTarget[stay.id] ?? [];
                                      const stayAggregate = computeFeedbackAggregate(stayFeedbacks);
                                      const myStayFeedback = stayFeedbacks.find((f) => f.userId === uid);
                                      return (
                                      <div key={stay.id} className="bg-purple-50 p-3 rounded text-sm">
                                        <div className="font-medium">{stay.name}</div>
                                        {stay.address && <div className="text-gray-500 text-xs">📍 {stay.address}</div>}
                                        <div className="text-gray-600 text-xs mt-1">
                                          Check-in: {stay.checkInDate} · Check-out: {stay.checkOutDate}
                                        </div>
                                        {stay.confirmationCode && (
                                          <div className="text-xs text-gray-500">Conf: {stay.confirmationCode}</div>
                                        )}
                                        {/* Feedback aggregate */}
                                        {stayAggregate && (
                                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                                            <span className="font-medium">⭐ {stayAggregate.avg}</span>
                                            <span className="text-gray-400">({stayAggregate.count} {stayAggregate.count === 1 ? 'rating' : 'ratings'})</span>
                                            {stayAggregate.recommendCount > 0 && (
                                              <span className="text-green-600">👍 {stayAggregate.recommendCount} recommend</span>
                                            )}
                                          </div>
                                        )}
                                        {/* Recent comments */}
                                        <div className="mt-1 space-y-0.5">
                                          {renderFeedbackComments(stayFeedbacks)}
                                        </div>
                                        {/* Feedback button */}
                                        <button
                                          onClick={() => {
                                            if (selectedFeedbackTargetId === stay.id) {
                                              setSelectedFeedbackTargetId(null);
                                            } else {
                                              fetchFeedbacksForTarget(stay.id).then((freshData) => {
                                                openFeedbackForm(stay.id, freshData);
                                              });
                                            }
                                          }}
                                          className="mt-2 text-xs text-purple-700 hover:text-purple-900 underline"
                                        >
                                          {myStayFeedback ? '✏️ Edit My Rating' : '⭐ Rate This Stay'}
                                        </button>
                                        {/* Inline feedback form */}
                                        {selectedFeedbackTargetId === stay.id && (
                                          <form
                                            onSubmit={(e) => handleSubmitTripFeedback(e, 'ACCOMMODATION', stay.id, selectedVacation.id)}
                                            className="mt-3 bg-white border border-purple-200 rounded p-3 space-y-2"
                                          >
                                            {renderStarSelector()}
                                            <textarea
                                              placeholder="Share your opinion (optional)…"
                                              value={tripFeedbackForm.comment}
                                              onChange={(e) => setTripFeedbackForm({ ...tripFeedbackForm, comment: e.target.value })}
                                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                              rows={2}
                                            />
                                            {renderRecommendToggle()}
                                            <div className="flex gap-2">
                                              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs">
                                                {myStayFeedback ? 'Update' : 'Submit'}
                                              </button>
                                              <button type="button" onClick={() => setSelectedFeedbackTargetId(null)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs">
                                                Cancel
                                              </button>
                                            </div>
                                          </form>
                                        )}
                                      </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Cruise Port Stops */}
                              {leg.legType === "CRUISE_LEG" && (
                                <div>
                                  <div className="flex justify-between items-center mb-2">
                                    <h6 className="font-semibold text-sm text-gray-700">⚓ Port Stops</h6>
                                    <button
                                      onClick={() => {
                                        setPortStopForm({ portName: "", country: "", arrivalDate: "", departureDate: "", sequence: cruisePortStops.length + 1 });
                                        setShowPortStopForm(true);
                                      }}
                                      className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-xs"
                                    >
                                      + Add Port Stop
                                    </button>
                                  </div>
                                  {showPortStopForm && (
                                    <div className="bg-teal-50 p-3 rounded-lg mb-3">
                                      <form onSubmit={handleCreatePortStop} className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          <input
                                            type="text"
                                            placeholder="Port Name *"
                                            value={portStopForm.portName}
                                            onChange={(e) => setPortStopForm({ ...portStopForm, portName: e.target.value })}
                                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                            required
                                          />
                                          <input
                                            type="text"
                                            placeholder="Country"
                                            value={portStopForm.country}
                                            onChange={(e) => setPortStopForm({ ...portStopForm, country: e.target.value })}
                                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                          />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                          <input
                                            type="number"
                                            placeholder="Sequence #"
                                            value={portStopForm.sequence}
                                            onChange={(e) => setPortStopForm({ ...portStopForm, sequence: parseInt(e.target.value) })}
                                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                            required
                                            min={1}
                                          />
                                          <input
                                            type="date"
                                            value={portStopForm.arrivalDate}
                                            onChange={(e) => setPortStopForm({ ...portStopForm, arrivalDate: e.target.value })}
                                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                          />
                                          <input
                                            type="date"
                                            value={portStopForm.departureDate}
                                            onChange={(e) => setPortStopForm({ ...portStopForm, departureDate: e.target.value })}
                                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <button type="submit" className="bg-teal-600 text-white px-3 py-1.5 rounded text-xs">
                                            Add
                                          </button>
                                          <button type="button" onClick={() => setShowPortStopForm(false)} className="bg-gray-300 text-gray-800 px-3 py-1.5 rounded text-xs">
                                            Cancel
                                          </button>
                                        </div>
                                      </form>
                                    </div>
                                  )}
                                  {cruisePortStops.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">No port stops yet.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {cruisePortStops.map((stop) => (
                                        <div key={stop.id} className="bg-teal-50 p-3 rounded text-sm flex justify-between items-start">
                                          <div>
                                            <div className="font-medium">
                                              ⚓ {stop.portName}{stop.country ? `, ${stop.country}` : ""}
                                            </div>
                                            {stop.arrivalDate && (
                                              <div className="text-xs text-gray-500 mt-1">
                                                Arrives: {stop.arrivalDate}{stop.departureDate ? ` · Departs: ${stop.departureDate}` : ""}
                                              </div>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => { setSelectedPortStop(stop); fetchExcursionOptions(undefined, stop.id); }}
                                            className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded text-xs"
                                          >
                                            Excursions
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {legs.length === 0 && (
                        <p className="text-center text-gray-500 py-6 text-sm">No trip legs yet. Add one to build your itinerary!</p>
                      )}
                    </div>
                  </div>
                )}

                {/* FLIGHTS TAB */}
                {activeTab === "flights" && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold">✈️ Flight Itinerary</h4>
                      <button
                        onClick={() => {
                          setFlightSegmentForm({ airline: "", flightNumber: "", departureAirport: "", arrivalAirport: "", departureDateTime: "", arrivalDateTime: "", confirmationNumber: "", notes: "" });
                          setFlightSegmentFormError("");
                          setShowFlightSegmentForm(true);
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition text-sm"
                      >
                        + Add Flight Segment
                      </button>
                    </div>

                    {showFlightSegmentForm && (
                      <div className="mb-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <h5 className="font-medium mb-3 text-blue-800">New Flight Segment</h5>
                        <form onSubmit={handleCreateFlightSegment} className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Airline *"
                              value={flightSegmentForm.airline}
                              onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, airline: e.target.value })}
                              className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Flight Number *"
                              value={flightSegmentForm.flightNumber}
                              onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, flightNumber: e.target.value })}
                              className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Departure Airport *"
                              value={flightSegmentForm.departureAirport}
                              onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, departureAirport: e.target.value })}
                              className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Arrival Airport *"
                              value={flightSegmentForm.arrivalAirport}
                              onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, arrivalAirport: e.target.value })}
                              className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500">Departure Date/Time *</label>
                              <input
                                type="datetime-local"
                                value={flightSegmentForm.departureDateTime}
                                onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, departureDateTime: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Arrival Date/Time *</label>
                              <input
                                type="datetime-local"
                                value={flightSegmentForm.arrivalDateTime}
                                onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, arrivalDateTime: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Confirmation Number"
                              value={flightSegmentForm.confirmationNumber}
                              onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, confirmationNumber: e.target.value })}
                              className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Notes"
                              value={flightSegmentForm.notes}
                              onChange={(e) => setFlightSegmentForm({ ...flightSegmentForm, notes: e.target.value })}
                              className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          {flightSegmentFormError && (
                            <p className="text-xs text-red-600">{flightSegmentFormError}</p>
                          )}
                          <div className="flex gap-2">
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm">
                              Save
                            </button>
                            <button type="button" onClick={() => { setShowFlightSegmentForm(false); setFlightSegmentFormError(""); }} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-1.5 rounded text-sm">
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {flightSegments.length === 0 ? (
                      <p className="text-center text-gray-500 py-6 text-sm">No flight segments yet. Add one to build your flight itinerary!</p>
                    ) : (
                      <div className="space-y-3">
                        {flightSegments.map((seg, idx) => (
                          <div key={seg.id} className="border border-blue-200 rounded-lg p-4 bg-white">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <span className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                                  {idx + 1}
                                </span>
                                <div>
                                  <div className="font-semibold text-gray-800">
                                    ✈️ {seg.airline} · {seg.flightNumber}
                                  </div>
                                  <div className="text-gray-600 text-sm mt-0.5">
                                    {seg.departureAirport} → {seg.arrivalAirport}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteFlightSegment(seg.id)}
                                className="text-red-400 hover:text-red-600 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                              <div>
                                <span className="text-xs text-gray-400 block">Departs</span>
                                {new Date(seg.departureDateTime).toLocaleString()}
                              </div>
                              <div>
                                <span className="text-xs text-gray-400 block">Arrives</span>
                                {new Date(seg.arrivalDateTime).toLocaleString()}
                              </div>
                            </div>
                            {(seg.confirmationNumber || seg.notes) && (
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                                {seg.confirmationNumber && <span>🔖 Conf: {seg.confirmationNumber}</span>}
                                {seg.notes && <span>📝 {seg.notes}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* EXCURSIONS TAB */}
                {activeTab === "excursions" && (
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Excursion Options</h4>
                    {legs.length === 0 ? (
                      <p className="text-center text-gray-500 py-6 text-sm">
                        Add trip legs in the Itinerary tab first to manage excursions.
                      </p>
                    ) : (
                      <div>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Select Trip Leg</label>
                          <div className="flex flex-wrap gap-2">
                            {legs.map((leg) => (
                              <button
                                key={leg.id}
                                onClick={() => {
                                  setSelectedLeg(leg);
                                  setSelectedPortStop(null);
                                  fetchExcursionOptions(leg.id);
                                  if (leg.legType === "CRUISE_LEG") fetchCruisePortStops(leg.id);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                                  selectedLeg?.id === leg.id
                                    ? "bg-orange-500 text-white border-orange-500"
                                    : "bg-white text-gray-700 border-gray-300 hover:border-orange-400"
                                }`}
                              >
                                {leg.sequence}. {leg.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        {selectedLeg && (
                          <>
                            {selectedLeg.legType === "CRUISE_LEG" && cruisePortStops.length > 0 && (
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Filter by Port Stop (optional)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => { setSelectedPortStop(null); fetchExcursionOptions(selectedLeg.id); }}
                                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                                      !selectedPortStop
                                        ? "bg-teal-500 text-white border-teal-500"
                                        : "bg-white text-gray-700 border-gray-300 hover:border-teal-400"
                                    }`}
                                  >
                                    All Ports
                                  </button>
                                  {cruisePortStops.map((stop) => (
                                    <button
                                      key={stop.id}
                                      onClick={() => { setSelectedPortStop(stop); fetchExcursionOptions(undefined, stop.id); }}
                                      className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                                        selectedPortStop?.id === stop.id
                                          ? "bg-teal-500 text-white border-teal-500"
                                          : "bg-white text-gray-700 border-gray-300 hover:border-teal-400"
                                      }`}
                                    >
                                      ⚓ {stop.portName}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex justify-between items-center mb-3">
                              <p className="text-sm text-gray-600">
                                Excursions for:{" "}
                                <span className="font-medium">
                                  {selectedPortStop ? `⚓ ${selectedPortStop.portName}` : selectedLeg.name}
                                </span>
                              </p>
                              <button
                                onClick={() => setShowExcursionForm(true)}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm"
                              >
                                + Propose Excursion
                              </button>
                            </div>
                            {showExcursionForm && (
                              <div className="bg-orange-50 p-4 rounded-lg mb-4">
                                <h5 className="font-medium mb-3 text-orange-800">Propose Excursion Option</h5>
                                <form onSubmit={handleCreateExcursion} className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Excursion Name *"
                                    value={excursionForm.name}
                                    onChange={(e) => setExcursionForm({ ...excursionForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    required
                                  />
                                  <textarea
                                    placeholder="Description"
                                    value={excursionForm.description}
                                    onChange={(e) => setExcursionForm({ ...excursionForm, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    rows={2}
                                  />
                                  <div className="grid grid-cols-3 gap-2">
                                    <input
                                      type="text"
                                      placeholder="Category (e.g. Adventure)"
                                      value={excursionForm.category}
                                      onChange={(e) => setExcursionForm({ ...excursionForm, category: e.target.value })}
                                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Duration (e.g. 3 hours)"
                                      value={excursionForm.duration}
                                      onChange={(e) => setExcursionForm({ ...excursionForm, duration: e.target.value })}
                                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                    <input
                                      type="number"
                                      placeholder="Est. Cost ($)"
                                      value={excursionForm.estimatedCost}
                                      onChange={(e) => setExcursionForm({ ...excursionForm, estimatedCost: e.target.value })}
                                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                                      min={0}
                                      step={0.01}
                                    />
                                  </div>
                                  <select
                                    value={excursionForm.status}
                                    onChange={(e) => setExcursionForm({ ...excursionForm, status: e.target.value as any })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="PROPOSED">Proposed</option>
                                    <option value="UNDER_REVIEW">Under Review</option>
                                    <option value="SELECTED">Selected</option>
                                    <option value="BOOKED">Booked</option>
                                    <option value="REJECTED">Rejected</option>
                                  </select>
                                  <div className="flex gap-2">
                                    <button type="submit" className="bg-orange-600 text-white px-4 py-1.5 rounded text-sm">
                                      Propose
                                    </button>
                                    <button type="button" onClick={() => setShowExcursionForm(false)} className="bg-gray-300 text-gray-800 px-4 py-1.5 rounded text-sm">
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}
                            {excursionOptions.length === 0 ? (
                              <p className="text-center text-gray-500 py-6 text-sm italic">
                                No excursion options yet. Be the first to propose one!
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {excursionOptions.map((excursion) => {
                                  const excVotes = votesByExcursion[excursion.id] ?? [];
                                  const excUpCount = excVotes.filter((v) => v.vote === "UP").length;
                                  const excDownCount = excVotes.filter((v) => v.vote === "DOWN").length;
                                  const excMyVote = excVotes.find((v) => v.userId === uid)?.vote;
                                  const excFeedbacks = feedbacksByTarget[excursion.id] ?? [];
                                  const excAggregate = computeFeedbackAggregate(excFeedbacks);
                                  const myExcFeedback = excFeedbacks.find((f) => f.userId === uid);
                                  return (
                                  <div key={excursion.id} className="border border-orange-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h5 className="font-semibold text-gray-800">{excursion.name}</h5>
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getExcursionStatusBadge(excursion.status)}`}>
                                        {excursion.status}
                                      </span>
                                    </div>
                                    {excursion.description && (
                                      <p className="text-sm text-gray-600 mb-2">{excursion.description}</p>
                                    )}
                                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                                      {excursion.category && <span>🏷️ {excursion.category}</span>}
                                      {excursion.duration && <span>⏱️ {excursion.duration}</span>}
                                      {excursion.estimatedCost != null && (
                                        <span>💰 ${excursion.estimatedCost.toFixed(2)}</span>
                                      )}
                                      {excursion.proposedBy && <span>👤 {excursion.proposedBy}</span>}
                                    </div>
                                    {/* Aggregate feedback summary */}
                                    {excAggregate && (
                                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                                        <span className="font-medium">⭐ {excAggregate.avg}</span>
                                        <span className="text-gray-400">({excAggregate.count} {excAggregate.count === 1 ? 'rating' : 'ratings'})</span>
                                        {excAggregate.recommendCount > 0 && (
                                          <span className="text-green-600">👍 {excAggregate.recommendCount} recommend</span>
                                        )}
                                      </div>
                                    )}
                                    {/* Recent feedback comments */}
                                    <div className="mb-1 space-y-0.5">
                                      {renderFeedbackComments(excFeedbacks)}
                                    </div>
                                    <div className="flex items-center gap-4 mt-2">
                                      <button
                                        onClick={() => {
                                          setSelectedExcursion(excursion);
                                          handleVote(excursion.id, "UP");
                                        }}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                                          excMyVote === "UP"
                                            ? "bg-green-500 text-white"
                                            : "bg-green-100 hover:bg-green-200 text-green-700"
                                        }`}
                                      >
                                        👍 {excUpCount}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedExcursion(excursion);
                                          handleVote(excursion.id, "DOWN");
                                        }}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                                          excMyVote === "DOWN"
                                            ? "bg-red-500 text-white"
                                            : "bg-red-100 hover:bg-red-200 text-red-700"
                                        }`}
                                      >
                                        👎 {excDownCount}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedExcursion(excursion);
                                          fetchExcursionComments(excursion.id);
                                          setShowCommentForm(true);
                                        }}
                                        className="text-sm text-royal-blue-600 hover:text-royal-blue-800 underline"
                                      >
                                        💬 Comments
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (selectedFeedbackTargetId === excursion.id) {
                                            setSelectedFeedbackTargetId(null);
                                          } else {
                                            fetchFeedbacksForTarget(excursion.id).then((freshData) => {
                                              openFeedbackForm(excursion.id, freshData);
                                            });
                                          }
                                        }}
                                        className="text-sm text-orange-600 hover:text-orange-800 underline"
                                      >
                                        {myExcFeedback ? '✏️ Edit Rating' : '⭐ Rate'}
                                      </button>
                                    </div>
                                    {/* Star-rating feedback form for excursion */}
                                    {selectedFeedbackTargetId === excursion.id && (
                                      <form
                                        onSubmit={(e) => handleSubmitTripFeedback(e, 'EXCURSION', excursion.id, selectedVacation.id)}
                                        className="mt-3 bg-orange-50 border border-orange-200 rounded p-3 space-y-2"
                                      >
                                        {renderStarSelector()}
                                        <textarea
                                          placeholder="Share your opinion (optional)…"
                                          value={tripFeedbackForm.comment}
                                          onChange={(e) => setTripFeedbackForm({ ...tripFeedbackForm, comment: e.target.value })}
                                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                          rows={2}
                                        />
                                        {renderRecommendToggle()}
                                        <div className="flex gap-2">
                                          <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs">
                                            {myExcFeedback ? 'Update' : 'Submit'}
                                          </button>
                                          <button type="button" onClick={() => setSelectedFeedbackTargetId(null)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs">
                                            Cancel
                                          </button>
                                        </div>
                                      </form>
                                    )}
                                    {selectedExcursion?.id === excursion.id && (
                                      <div className="mt-4 border-t pt-3">
                                        {showCommentForm && (
                                          <form onSubmit={handleCreateComment} className="flex gap-2 mb-3">
                                            <input
                                              type="text"
                                              placeholder="Add your opinion..."
                                              value={commentText}
                                              onChange={(e) => setCommentText(e.target.value)}
                                              className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                                              required
                                            />
                                            <button type="submit" className="bg-royal-blue-600 text-white px-3 py-1.5 rounded text-sm">
                                              Post
                                            </button>
                                            <button type="button" onClick={() => setShowCommentForm(false)} className="bg-gray-300 text-gray-800 px-3 py-1.5 rounded text-sm">
                                              ✕
                                            </button>
                                          </form>
                                        )}
                                        {excursionComments.length === 0 ? (
                                          <p className="text-xs text-gray-400 italic">No comments yet.</p>
                                        ) : (
                                          <div className="space-y-2">
                                            {excursionComments.map((c) => (
                                              <div key={c.id} className="bg-gray-50 p-2 rounded text-sm">
                                                <p className="text-gray-800">{c.comment}</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                  {c.userId}{c.createdAt ? ` · ${new Date(c.createdAt).toLocaleString()}` : ""}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {vacations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-xl mb-2">🏖️ No vacations planned yet</p>
            <p className="text-sm">Click "Add Vacation" to start planning your next trip!</p>
          </div>
        )}
      </div>
    </div>
  );
}
