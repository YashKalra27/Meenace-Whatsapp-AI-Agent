import { calendarEngine } from '../src/calendar/engine.js';
import { windowManager } from '../src/whatsapp/windowManager.js';
import { escalationManager } from '../src/escalation/manager.js';
import { handleFlowDataExchange } from '../src/flows/bookingFlow.js';
import { processWithClaude } from '../src/agent/claude.js';
import { reminderScheduler } from '../src/calendar/scheduler.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, extra = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${extra}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING CLAUDE WHATSAPP AGENT TEST SUITE');
  console.log('======================================================\n');

  const testPhone = '+14155559999';
  const testCustomer = 'Testing User';
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // -------------------------------------------------------------------------
  // Test 1: 24-Hour Customer Care Window Manager
  // -------------------------------------------------------------------------
  console.log('📋 Suite 1: 24-Hour Meta Service Window Policy');
  windowManager.recordCustomerInbound(testPhone);
  const winStatus = windowManager.getWindowStatus(testPhone);
  assert(winStatus.isOpen === true, 'Inbound message successfully opens 24h window');
  assert(winStatus.remainingMinutes > 1400, 'Remaining window is ~24 hours (1440 mins)');
  assert(windowManager.isFreeformAllowed(testPhone) === true, 'Freeform WhatsApp messaging is allowed inside 24h window');

  // -------------------------------------------------------------------------
  // Test 2: Calendar Engine & Booking Conflict Prevention
  // -------------------------------------------------------------------------
  console.log('\n📋 Suite 2: Calendar Engine & Conflict Prevention');
  const slots = calendarEngine.getAvailableSlots(tomorrow);
  assert(slots.slots.length > 0, `Available slots found for tomorrow (${tomorrow}): ${slots.slots.length} slots`);

  const chosenSlot = slots.slots[0];
  const booking = calendarEngine.bookAppointment({
    customerName: testCustomer,
    customerPhone: testPhone,
    serviceId: 'srv-strategy',
    date: tomorrow,
    timeSlot: chosenSlot,
    notes: 'Unit test automated booking'
  });

  assert(booking.success === true && Boolean(booking.appointment), `Booked appointment successfully: ${booking.appointment?.id}`);
  assert(booking.appointment?.status === 'confirmed', 'Appointment status is confirmed');

  // Attempt to book same slot (Conflict Prevention)
  const doubleBooking = calendarEngine.bookAppointment({
    customerName: 'Duplicate Customer',
    customerPhone: '+14155558888',
    serviceId: 'srv-strategy',
    date: tomorrow,
    timeSlot: chosenSlot
  });
  assert(doubleBooking.success === false, 'Conflict prevention blocked double booking on same slot');

  // Reschedule
  const anotherSlot = slots.slots[1];
  if (anotherSlot && booking.appointment) {
    const rescheduled = calendarEngine.rescheduleAppointment(booking.appointment.id, tomorrow, anotherSlot);
    assert(rescheduled.success === true, `Rescheduled appointment to ${anotherSlot}`);
    assert(rescheduled.appointment?.status === 'rescheduled', 'Status updated to rescheduled');
  }

  // Cancel
  if (booking.appointment) {
    const cancelled = calendarEngine.cancelAppointment(booking.appointment.id, 'Test cancellation');
    assert(cancelled.success === true, `Cancelled appointment ${booking.appointment.id}`);
    assert(cancelled.appointment?.status === 'cancelled', 'Status updated to cancelled');
  }

  // -------------------------------------------------------------------------
  // Test 3: WhatsApp Flows Data Exchange
  // -------------------------------------------------------------------------
  console.log('\n📋 Suite 3: WhatsApp Flows In-Chat Form Protocol');
  const pingRes = handleFlowDataExchange({ version: '3.1', action: 'ping' }, testPhone);
  assert(pingRes.data?.status === 'active', 'Flow ping returns active status');

  const initRes = handleFlowDataExchange({ version: '3.1', action: 'INIT' }, testPhone);
  assert(initRes.screen === 'SERVICE_SELECTION', 'Flow INIT returns SERVICE_SELECTION screen');
  assert(initRes.data?.services?.length > 0, 'Flow INIT provides services catalog options');

  const exchangeRes = handleFlowDataExchange({
    version: '3.1',
    action: 'data_exchange',
    screen: 'SERVICE_SELECTION',
    data: { selected_date: tomorrow }
  }, testPhone);
  assert(exchangeRes.screen === 'DATE_TIME', 'Flow data_exchange navigates to DATE_TIME screen');
  assert(exchangeRes.data?.available_slots?.length > 0, 'Flow dynamic slots populated from calendar engine');

  // -------------------------------------------------------------------------
  // Test 4: Human Escalation & Takeover State Machine
  // -------------------------------------------------------------------------
  console.log('\n📋 Suite 4: Human Escalation & Takeover State Machine');
  const ticket = escalationManager.escalate({
    customerPhone: testPhone,
    customerName: testCustomer,
    reason: 'Customer requested human supervisor in test',
    urgency: 'high',
    summary: 'Testing human handover'
  });
  assert(ticket.status === 'open', `Created escalation ticket ${ticket.id}`);
  assert(escalationManager.isHumanMode(testPhone) === true, 'Conversation switched to human_takeover mode');

  const thread = escalationManager.getThread(testPhone);
  assert(thread?.escalated === true, 'Thread is marked escalated');

  // Resume Bot
  const resumed = escalationManager.resumeBot(testPhone);
  assert(resumed === true, 'Resumed bot automation');
  assert(escalationManager.isHumanMode(testPhone) === false, 'Bot active mode restored');

  // -------------------------------------------------------------------------
  // Test 5: Claude Agent Reasoning Loop & Tool Invocation
  // -------------------------------------------------------------------------
  console.log('\n📋 Suite 5: Claude Agent Reasoning & Tool Execution');

  // Identity transparency
  const identityRes = await processWithClaude({
    incomingText: 'Are you an AI or a real human?',
    customerPhone: testPhone,
    customerName: testCustomer
  });
  assert(identityRes.reply.toLowerCase().includes('claude') || identityRes.reply.toLowerCase().includes('ai assistant'), 'Agent truthfully acknowledges it is an AI assistant');

  // Services Catalog
  const servicesRes = await processWithClaude({
    incomingText: 'What services do you offer and what is your pricing?',
    customerPhone: testPhone,
    customerName: testCustomer
  });
  assert(servicesRes.toolsUsed.includes('get_services_catalog'), 'Claude invokes get_services_catalog tool');
  assert(servicesRes.reply.includes('Strategy') || servicesRes.reply.includes('$'), 'Claude reply contains pricing information');

  // Escalation request
  const escalateMsgRes = await processWithClaude({
    incomingText: 'I demand to speak with a human manager right away!',
    customerPhone: testPhone,
    customerName: testCustomer
  });
  assert(escalateMsgRes.toolsUsed.includes('escalate_to_human'), 'Claude invokes escalate_to_human tool when user requests human');
  assert(escalateMsgRes.reply.toLowerCase().includes('escalat'), 'Reply confirms escalation to human');

  // -------------------------------------------------------------------------
  // Test 6: Morning Reminder Scheduler
  // -------------------------------------------------------------------------
  console.log('\n📋 Suite 6: Morning-Of Reminder Scheduler');
  // Create an appointment for today
  const today = new Date().toISOString().split('T')[0];
  const aptToday = calendarEngine.bookAppointment({
    customerName: 'Reminder Test User',
    customerPhone: testPhone,
    serviceId: 'srv-strategy',
    date: today,
    timeSlot: '03:00 PM',
    notes: 'Testing morning reminder cron'
  });

  if (aptToday.appointment) {
    const dueBefore = calendarEngine.getDueMorningReminders();
    assert(dueBefore.some(a => a.id === aptToday.appointment?.id), 'Scheduler detects appointment scheduled for today');

    const reminderRun = await reminderScheduler.checkAndSendReminders();
    assert(reminderRun.sentCount > 0, `Dispatched morning reminder template: ${reminderRun.sentCount} sent`);

    const dueAfter = calendarEngine.getDueMorningReminders();
    assert(!dueAfter.some(a => a.id === aptToday.appointment?.id), 'Appointment marked reminderSent and removed from due queue');
  }

  // -------------------------------------------------------------------------
  // Final Results
  // -------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
