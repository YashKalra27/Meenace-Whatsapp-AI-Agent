import { servicesCatalog } from '../config/businessData.js';
import { calendarEngine } from '../calendar/engine.js';

export const BOOKING_FLOW_ID = 'flow_appointment_booking_v1';

export const bookingFlowJSON = {
  version: '3.1',
  screens: [
    {
      id: 'SERVICE_SELECTION',
      title: 'Select a Service',
      terminal: false,
      data: {
        services: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' }
            }
          },
          __example__: servicesCatalog.map(s => ({
            id: s.id,
            title: `${s.name} ($${s.priceUSD})`,
            description: `${s.durationMinutes} mins · ${s.category}`
          }))
        }
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: 'Schedule an Appointment'
          },
          {
            type: 'TextSubheading',
            text: 'Choose an AI consulting or deployment service:'
          },
          {
            type: 'RadioButtonsGroup',
            name: 'selected_service',
            label: 'Service Option',
            required: true,
            'data-source': '${data.services}'
          },
          {
            type: 'Footer',
            label: 'Next: Choose Date & Time',
            'on-click-action': {
              name: 'navigate',
              next: {
                name: 'DATE_TIME',
                type: 'screen'
              },
              payload: {
                service_id: '${form.selected_service}'
              }
            }
          }
        ]
      }
    },
    {
      id: 'DATE_TIME',
      title: 'Pick Date & Time',
      terminal: false,
      data: {
        available_slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' }
            }
          },
          __example__: [
            { id: '10:00 AM', title: '10:00 AM' },
            { id: '11:00 AM', title: '11:00 AM' },
            { id: '02:00 PM', title: '02:00 PM' },
            { id: '03:00 PM', title: '03:00 PM' }
          ]
        }
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'DatePicker',
            name: 'selected_date',
            label: 'Appointment Date',
            required: true
          },
          {
            type: 'Dropdown',
            name: 'selected_slot',
            label: 'Available Time Slot',
            required: true,
            'data-source': '${data.available_slots}'
          },
          {
            type: 'TextInput',
            name: 'customer_name',
            label: 'Your Full Name',
            required: true
          },
          {
            type: 'TextInput',
            name: 'notes',
            label: 'Project Goals or Requirements',
            required: false,
            'input-type': 'text'
          },
          {
            type: 'Footer',
            label: 'Confirm Booking',
            'on-click-action': {
              name: 'complete',
              payload: {
                service_id: '${screen.payload.service_id}',
                date: '${form.selected_date}',
                time_slot: '${form.selected_slot}',
                name: '${form.customer_name}',
                notes: '${form.notes}'
              }
            }
          }
        ]
      }
    }
  ]
};

export interface FlowEndpointRequest {
  version: string;
  action: 'ping' | 'INIT' | 'data_exchange';
  screen?: string;
  data?: Record<string, any>;
  flow_token?: string;
}

export function handleFlowDataExchange(reqBody: FlowEndpointRequest, customerPhone: string): Record<string, any> {
  const { action, screen, data } = reqBody;

  if (action === 'ping') {
    return {
      version: '3.1',
      data: { status: 'active' }
    };
  }

  if (action === 'INIT') {
    return {
      version: '3.1',
      screen: 'SERVICE_SELECTION',
      data: {
        services: servicesCatalog.map(s => ({
          id: s.id,
          title: `${s.name} ($${s.priceUSD})`,
          description: `${s.durationMinutes} mins · ${s.category}`
        }))
      }
    };
  }

  if (action === 'data_exchange') {
    if (screen === 'SERVICE_SELECTION' || screen === 'DATE_TIME') {
      const targetDate = data?.selected_date || new Date().toISOString().split('T')[0];
      const availability = calendarEngine.getAvailableSlots(targetDate);
      return {
        version: '3.1',
        screen: 'DATE_TIME',
        data: {
          available_slots: availability.slots.map(s => ({ id: s, title: s }))
        }
      };
    }
  }

  // Fallback
  return {
    version: '3.1',
    data: { error: 'Unknown flow action' }
  };
}
