"""Type-driven field configuration for reservations.

Every reservation stores its times in ``departure_time`` / ``arrival_time``
regardless of type; only the labels users see change. The Add/Edit form, the
form's JavaScript (via ``json_script``) and the trip page all read from
``RESERVATION_TYPE_FIELDS``, so supporting a new type means adding one entry
here (plus a choice on ``Reservation.TYPE_CHOICES``).

Per-type keys:
    labels        field name -> label (merged over GENERIC_CONFIG's labels)
    placeholders  field name -> placeholder (merged over GENERIC_CONFIG's)
    required      field names that must be filled in
    extra_fields  optional type-specific fields shown only for this type
    default_times optional {"departure_time": "HH:MM", "arrival_time": "HH:MM"}
                  used to prefill an empty date/time input (form JS only)
"""

from copy import deepcopy

BASE_FIELDS = ["type", "provider", "confirmation_number", "departure_time", "arrival_time", "notes"]
BASE_REQUIRED = ["type", "provider", "confirmation_number", "departure_time", "arrival_time"]

EXTRA_FIELD_LABELS = {
    "flight_number": "Flight number",
    "departure_airport": "Departure airport",
    "arrival_airport": "Arrival airport",
    "property_name": "Property name",
    "address": "Address",
    "room_type": "Room / unit type",
    "host_name": "Host name",
    "host_phone": "Host phone",
    "listing_url": "Listing URL",
    "pickup_location": "Pick-up location",
    "dropoff_location": "Drop-off location",
    "vehicle_class": "Vehicle class",
}

GENERIC_CONFIG = {
    "labels": {
        "type": "Type",
        "provider": "Provider",
        "confirmation_number": "Confirmation number",
        "departure_time": "Start time",
        "arrival_time": "End time",
        "notes": "Notes",
    },
    "placeholders": {
        "provider": "e.g. Universal Studios",
        "confirmation_number": "e.g. ABC123",
        "notes": "Anything worth remembering…",
    },
    "required": BASE_REQUIRED,
    "extra_fields": [],
    "default_times": {},
}

RESERVATION_TYPE_FIELDS = {
    "FLIGHT": {
        "labels": {
            "provider": "Airline",
            "departure_time": "Departure time",
            "arrival_time": "Arrival time",
        },
        "placeholders": {
            "provider": "e.g. Delta",
            "notes": "Seat numbers, meal preferences…",
            "flight_number": "e.g. DL 1234",
            "departure_airport": "e.g. RDU",
            "arrival_airport": "e.g. MCO",
        },
        "extra_fields": ["flight_number", "departure_airport", "arrival_airport"],
    },
    "HOTEL": {
        "labels": {
            "provider": "Hotel or platform",
            "confirmation_number": "Confirmation / reservation code",
            "departure_time": "Check-in",
            "arrival_time": "Check-out",
        },
        "placeholders": {
            "provider": "e.g. Hilton, Airbnb, VRBO",
            "notes": "Check-in instructions, Wi-Fi, parking…",
            "property_name": "e.g. Lakeside 3BR near Disney",
            "address": "e.g. 123 Lakeshore Dr, Kissimmee, FL",
            "room_type": "e.g. King suite, 3BR condo",
            "host_name": "e.g. Maria",
            "host_phone": "e.g. (407) 555-0123",
            "listing_url": "https://…",
        },
        "extra_fields": ["property_name", "address", "room_type", "host_name", "host_phone", "listing_url"],
        "default_times": {"departure_time": "15:00", "arrival_time": "11:00"},
    },
    "CAR": {
        "labels": {
            "provider": "Rental company",
            "departure_time": "Pick-up time",
            "arrival_time": "Drop-off time",
        },
        "placeholders": {
            "provider": "e.g. Enterprise",
            "notes": "Insurance, add-ons, fuel policy…",
            "pickup_location": "e.g. MCO Terminal B",
            "dropoff_location": "Leave blank if same as pick-up",
            "vehicle_class": "e.g. Midsize SUV",
        },
        "extra_fields": ["pickup_location", "dropoff_location", "vehicle_class"],
    },
}

ALL_EXTRA_FIELDS = list(EXTRA_FIELD_LABELS)


def get_type_config(type_value):
    """Return the fully merged config for a type, falling back to the
    generic config for unmapped types (including "OTHER" and blank)."""
    override = RESERVATION_TYPE_FIELDS.get(type_value or "", {})
    config = deepcopy(GENERIC_CONFIG)
    config["labels"].update({f: EXTRA_FIELD_LABELS[f] for f in override.get("extra_fields", [])})
    config["labels"].update(override.get("labels", {}))
    config["placeholders"].update(override.get("placeholders", {}))
    for key in ("required", "extra_fields", "default_times"):
        if key in override:
            config[key] = list(override[key]) if isinstance(override[key], list) else dict(override[key])
    return config


def all_type_configs():
    """Merged config for every mapped type plus the generic fallback (keyed
    ""), for handing to the form's JavaScript."""
    configs = {key: get_type_config(key) for key in RESERVATION_TYPE_FIELDS}
    configs[""] = get_type_config("")
    return configs
