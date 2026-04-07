export const FUNCTIONS = [
  // === CALENDAR ===
  { type: 'function', name: 'cal_today', description: "Get today's calendar events", parameters: { type: 'object', properties: { member: { type: 'string', description: 'Family member: Asik, Nikkath, Aarish, Aaraa' } } } },
  { type: 'function', name: 'cal_upcoming', description: 'Get upcoming events for next N days', parameters: { type: 'object', properties: { days: { type: 'number' }, member: { type: 'string' } } } },
  { type: 'function', name: 'cal_add', description: 'Add a calendar event', parameters: { type: 'object', properties: { title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, member: { type: 'string' }, all_day: { type: 'boolean' } }, required: ['title', 'start'] } },
  { type: 'function', name: 'cal_search', description: 'Search calendar events', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  // === CHORES ===
  { type: 'function', name: 'chore_list', description: 'List chores/tasks', parameters: { type: 'object', properties: { member: { type: 'string' }, completed: { type: 'boolean' }, category: { type: 'string' } } } },
  { type: 'function', name: 'chore_add', description: 'Add a chore', parameters: { type: 'object', properties: { title: { type: 'string' }, member: { type: 'string' }, category: { type: 'string', enum: ['chore','homework','errand','cleaning','cooking','other'] }, due_date: { type: 'string' }, priority: { type: 'string', enum: ['low','medium','high'] }, points: { type: 'number' } }, required: ['title'] } },
  { type: 'function', name: 'chore_complete', description: 'Mark chore done, award points', parameters: { type: 'object', properties: { id: { type: 'string' }, member: { type: 'string' } }, required: ['id'] } },
  // === FOOD ===
  { type: 'function', name: 'food_log', description: 'Log a meal with nutrition analysis', parameters: { type: 'object', properties: { description: { type: 'string' }, meal_type: { type: 'string', enum: ['breakfast','lunch','dinner','snack'] }, member: { type: 'string' } }, required: ['description', 'meal_type'] } },
  { type: 'function', name: 'food_today', description: "What's been eaten today", parameters: { type: 'object', properties: { member: { type: 'string' } } } },
  { type: 'function', name: 'food_analyze', description: 'Analyze nutrition without logging', parameters: { type: 'object', properties: { description: { type: 'string' } }, required: ['description'] } },
  { type: 'function', name: 'meal_today', description: "Today's meal plan", parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'meal_plan', description: 'Add to meal plan', parameters: { type: 'object', properties: { title: { type: 'string' }, meal_type: { type: 'string', enum: ['breakfast','lunch','dinner','snack'] }, date: { type: 'string' }, notes: { type: 'string' } }, required: ['title', 'meal_type'] } },
  // === MEMORY ===
  { type: 'function', name: 'memory_save', description: 'Remember something', parameters: { type: 'object', properties: { content: { type: 'string' }, title: { type: 'string' }, category: { type: 'string', enum: ['general','personal','work','tech','idea','decision','preference','project','people','health','finance'] }, tags: { type: 'array', items: { type: 'string' } } }, required: ['content'] } },
  { type: 'function', name: 'memory_search', description: 'Search memories', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { type: 'function', name: 'ask', description: 'Search ALL personal data', parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } },
  // === FINANCE ===
  { type: 'function', name: 'expense_add', description: 'Log expense', parameters: { type: 'object', properties: { amount: { type: 'number' }, description: { type: 'string' }, category: { type: 'string', enum: ['food','transport','housing','utilities','entertainment','health','shopping','education','travel','subscriptions','other'] }, vendor: { type: 'string' } }, required: ['amount', 'description'] } },
  { type: 'function', name: 'expense_summary', description: 'Spending summary', parameters: { type: 'object', properties: { period: { type: 'string', enum: ['today','week','month','year'] } } } },
  // === HEALTH ===
  { type: 'function', name: 'health_log', description: 'Log health metric', parameters: { type: 'object', properties: { metric: { type: 'string' }, value: { type: 'number' }, unit: { type: 'string' }, notes: { type: 'string' } }, required: ['metric'] } },
  { type: 'function', name: 'health_today', description: 'Today\'s health metrics', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'health_summary', description: 'Health summary with trends', parameters: { type: 'object', properties: { days: { type: 'number' } } } },
  // === SMART HOME ===
  { type: 'function', name: 'home_states', description: 'Home Assistant entity states', parameters: { type: 'object', properties: { domain: { type: 'string' } } } },
  { type: 'function', name: 'home_call_service', description: 'Control smart home', parameters: { type: 'object', properties: { domain: { type: 'string' }, service: { type: 'string' }, entity_id: { type: 'string' }, data: { type: 'object' } }, required: ['domain', 'service'] } },
  // === NOTIFICATIONS ===
  { type: 'function', name: 'notify_send', description: 'Send push notification', parameters: { type: 'object', properties: { message: { type: 'string' }, title: { type: 'string' }, priority: { type: 'string', enum: ['min','low','default','high','urgent'] } }, required: ['message'] } },
  { type: 'function', name: 'notify_remind', description: 'Set a reminder', parameters: { type: 'object', properties: { what: { type: 'string' }, when: { type: 'string' } }, required: ['what', 'when'] } },
  // === LISTS ===
  { type: 'function', name: 'list_all', description: 'List all lists', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'list_view', description: 'View list items', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { type: 'function', name: 'list_add_item', description: 'Add item to list', parameters: { type: 'object', properties: { list_name: { type: 'string' }, item: { type: 'string' }, category: { type: 'string' } }, required: ['list_name', 'item'] } },
  // === COUNTDOWNS ===
  { type: 'function', name: 'countdown_list', description: 'Active countdowns', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'countdown_add', description: 'Add countdown', parameters: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string' } }, required: ['title', 'date'] } },
  // === CONTEXT (life-mcp) ===
  { type: 'function', name: 'context_now', description: 'Full current context', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'digest_daily', description: 'Daily briefing', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'digest_weekly', description: 'Weekly summary', parameters: { type: 'object', properties: {} } },
  // === FAMILY (life-mcp) ===
  { type: 'function', name: 'family_my_chores', description: "Member's chores", parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { type: 'function', name: 'family_done', description: 'Complete chore, earn points', parameters: { type: 'object', properties: { name: { type: 'string' }, chore: { type: 'string' } }, required: ['name', 'chore'] } },
  { type: 'function', name: 'family_my_points', description: 'Check points', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { type: 'function', name: 'family_mood', description: 'Log mood', parameters: { type: 'object', properties: { name: { type: 'string' }, mood: { type: 'string', enum: ['amazing','happy','okay','sad','angry','anxious'] }, note: { type: 'string' } }, required: ['name', 'mood'] } },
  { type: 'function', name: 'family_whats_for_dinner', description: "Today's dinner", parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'family_scoreboard', description: 'Points leaderboard', parameters: { type: 'object', properties: {} } },
  // === SHORTCUTS (life-mcp) ===
  { type: 'function', name: 'shortcut_morning', description: 'Morning routine briefing', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'shortcut_goodnight', description: 'Goodnight routine', parameters: { type: 'object', properties: { journal_note: { type: 'string' } } } },
  // === JOURNAL ===
  { type: 'function', name: 'journal_write', description: 'Write journal entry', parameters: { type: 'object', properties: { content: { type: 'string' }, mood: { type: 'string', enum: ['great','good','okay','low','bad'] }, energy: { type: 'number' }, highlights: { type: 'array', items: { type: 'string' } } }, required: ['content'] } },
  { type: 'function', name: 'journal_read', description: 'Read journal entries', parameters: { type: 'object', properties: { date: { type: 'string' }, days: { type: 'number' } } } },
  // === MOOD ===
  { type: 'function', name: 'mood_checkin', description: 'Mood check-in', parameters: { type: 'object', properties: { member: { type: 'string' }, mood: { type: 'string', enum: ['amazing','happy','okay','sad','angry','anxious'] }, note: { type: 'string' } }, required: ['member', 'mood'] } },
  // === TEXT INPUT (frontend-only) ===
  { type: 'function', name: 'request_text_input', description: 'Ask the user to type something (password, URL, code, etc.) — shows a text input field on screen. Use when voice input is not suitable.', parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'What to ask the user to type' }, type: { type: 'string', description: 'Input type: text, password, email, url', enum: ['text', 'password', 'email', 'url'] } }, required: ['prompt'] } },
]
