import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

export default function CalendarModule() {
  const handleDateClick = (arg: any) => {
    alert('Date clicked: ' + arg.dateStr);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Family Calendar</h2>
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4 p-4 bg-royal-blue-50 border border-royal-blue-200 rounded-lg">
          <p className="text-royal-blue-800">
            📅 <strong>Calendar Placeholder:</strong> This calendar will display family events, vacation dates, and important reminders.
          </p>
        </div>
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          weekends={true}
          dateClick={handleDateClick}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek',
          }}
          height="auto"
          events={[
            {
              title: 'Sample Event',
              start: new Date().toISOString().split('T')[0],
              color: '#0046a7',
            },
          ]}
        />
      </div>
    </div>
  );
}
