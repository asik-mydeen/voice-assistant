export const FUNCTIONS = [
  // === CALENDAR ===
  {
    type: 'function', name: 'cal_today',
    description: "Get today's calendar events for the family or a specific member",
    parameters: { type: 'object', properties: { member: { type: 'string', description: 'Family member: Asik, Nikkath, Aarish, Aaraa' } } }
  },
  {
    type: 'function', name: 'cal_upcoming',
    description: 'Get upcoming calendar events for the next N days',
    parameters: { type: 'object', properties: { days: { type: 'number', description: 'Days ahead (default 7)' }, member: { type: 'string' } } }
  },
  {
    type: 'function', name: 'cal_add',
    description: 'Add a new calendar event',
    parameters: { type: 'object', properties: { title: { type: 'string' }, start: { type: 'string', description: 'Start time ISO or natural' }, end: { type: 'string' }, member: { type: 'string' }, all_day: { type: 'boolean' } }, required: ['title', 'start'] }
  },
  {
    type: 'function', name: 'cal_search',
    description: 'Search calendar events by keyword',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  // === CHORES ===
  {
    type: 'function', name: 'chore_list',
    description: 'List chores/tasks, optionally by family member or completion status',
    parameters: { type: 'object', properties: { member: { type: 'string' }, completed: { type: 'boolean' }, category: { type: 'string' } } }
  },
  {
    type: 'function', name: 'chore_add',
    description: 'Add a new chore or task for a family member',
    parameters: { type: 'object', properties: { title: { type: 'string' }, member: { type: 'string' }, category: { type: 'string', enum: ['chore','homework','errand','cleaning','cooking','other'] }, due_date: { type: 'string' }, priority: { type: 'string', enum: ['low','medium','high'] }, points: { type: 'number' } }, required: ['title'] }
  },
  {
    type: 'function', name: 'chore_complete',
    description: 'Mark a chore as completed and award points',
    parameters: { type: 'object', properties: { id: { type: 'string' }, member: { type: 'string' } }, required: ['id'] }
  },
  // === FOOD & MEALS ===
  {
    type: 'function', name: 'food_log',
    description: 'Log a meal with automatic nutrition analysis',
    parameters: { type: 'object', properties: { description: { type: 'string', description: 'What was eaten' }, meal_type: { type: 'string', enum: ['breakfast','lunch','dinner','snack'] }, member: { type: 'string' } }, required: ['description', 'meal_type'] }
  },
  {
    type: 'function', name: 'food_today',
    description: "What's been eaten today",
    parameters: { type: 'object', properties: { member: { type: 'string' } } }
  },
  {
    type: 'function', name: 'food_analyze',
    description: 'Analyze nutrition of a food without logging it',
    parameters: { type: 'object', properties: { description: { type: 'string' } }, required: ['description'] }
  },
  {
    type: 'function', name: 'meal_today',
    description: "What's on the meal plan today",
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'meal_plan',
    description: 'Add a meal to the family meal plan',
    parameters: { type: 'object', properties: { title: { type: 'string' }, meal_type: { type: 'string', enum: ['breakfast','lunch','dinner','snack'] }, date: { type: 'string' }, notes: { type: 'string' } }, required: ['title', 'meal_type'] }
  },
  // === MEMORY & KNOWLEDGE ===
  {
    type: 'function', name: 'memory_save',
    description: 'Save something to memory — a fact, preference, decision, idea',
    parameters: { type: 'object', properties: { content: { type: 'string' }, title: { type: 'string' }, category: { type: 'string', enum: ['general','personal','work','tech','idea','decision','preference','project','people','health','finance'] }, tags: { type: 'array', items: { type: 'string' } } }, required: ['content'] }
  },
  {
    type: 'function', name: 'memory_search',
    description: 'Search saved memories by text',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    type: 'function', name: 'ask',
    description: 'Search across ALL personal data — memories, links, snippets, journal, people, expenses, calendar',
    parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] }
  },
  // === FINANCE ===
  {
    type: 'function', name: 'expense_add',
    description: 'Log an expense',
    parameters: { type: 'object', properties: { amount: { type: 'number' }, description: { type: 'string' }, category: { type: 'string', enum: ['food','transport','housing','utilities','entertainment','health','shopping','education','travel','subscriptions','other'] }, vendor: { type: 'string' } }, required: ['amount', 'description'] }
  },
  {
    type: 'function', name: 'expense_summary',
    description: 'Get spending summary for a time period',
    parameters: { type: 'object', properties: { period: { type: 'string', enum: ['today','week','month','year'] } } }
  },
  // === HEALTH ===
  {
    type: 'function', name: 'health_log',
    description: 'Log a health metric — weight, sleep, water, exercise, etc.',
    parameters: { type: 'object', properties: { metric: { type: 'string', description: 'weight, sleep, water, steps, exercise, medication, blood_pressure, mood, calories' }, value: { type: 'number' }, unit: { type: 'string' }, notes: { type: 'string' } }, required: ['metric'] }
  },
  {
    type: 'function', name: 'health_today',
    description: 'What health metrics have been logged today',
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'health_summary',
    description: 'Health metrics summary — averages, trends, streaks',
    parameters: { type: 'object', properties: { days: { type: 'number' } } }
  },
  // === SMART HOME ===
  {
    type: 'function', name: 'home_states',
    description: 'Get current state of Home Assistant entities — lights, switches, sensors, climate',
    parameters: { type: 'object', properties: { domain: { type: 'string', description: 'Filter: light, switch, sensor, climate, media_player' } } }
  },
  {
    type: 'function', name: 'home_call_service',
    description: 'Control smart home — turn on/off lights, set climate, play media',
    parameters: { type: 'object', properties: { domain: { type: 'string', description: 'light, switch, climate, media_player, automation, script' }, service: { type: 'string', description: 'turn_on, turn_off, toggle, set_temperature' }, entity_id: { type: 'string', description: 'e.g. light.living_room' }, data: { type: 'object', description: 'Additional data like brightness, color' } }, required: ['domain', 'service'] }
  },
  // === NOTIFICATIONS ===
  {
    type: 'function', name: 'notify_send',
    description: 'Send a push notification to phone immediately',
    parameters: { type: 'object', properties: { message: { type: 'string' }, title: { type: 'string' }, priority: { type: 'string', enum: ['min','low','default','high','urgent'] } }, required: ['message'] }
  },
  {
    type: 'function', name: 'notify_remind',
    description: 'Set a reminder — remind me in X to do Y',
    parameters: { type: 'object', properties: { what: { type: 'string' }, when: { type: 'string', description: 'in 30min, in 2h, tomorrow 9am' } }, required: ['what', 'when'] }
  },
  // === LISTS ===
  {
    type: 'function', name: 'list_all',
    description: 'List all lists (shopping, todo, packing, etc.)',
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'list_view',
    description: 'View items in a specific list',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    type: 'function', name: 'list_add_item',
    description: 'Add an item to a list',
    parameters: { type: 'object', properties: { list_name: { type: 'string' }, item: { type: 'string' }, category: { type: 'string' } }, required: ['list_name', 'item'] }
  },
  // === COUNTDOWNS ===
  {
    type: 'function', name: 'countdown_list',
    description: 'Show all active countdowns with days remaining',
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'countdown_add',
    description: 'Add a countdown to a special date',
    parameters: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['title', 'date'] }
  },
  // === CONTEXT & BRIEFINGS (life-mcp) ===
  {
    type: 'function', name: 'context_now',
    description: 'Get full current context — time, calendar, chores, mood, journal, memories',
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'digest_daily',
    description: 'Complete daily briefing — calendar, chores, meals, expenses, health, moods, countdowns',
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'digest_weekly',
    description: 'Weekly summary — events, expenses, health trends, chores completed, highlights',
    parameters: { type: 'object', properties: {} }
  },
  // === FAMILY (life-mcp) ===
  {
    type: 'function', name: 'family_my_chores',
    description: "Show a family member's chores",
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'Aarish, Aaraa, Nikkath, Asik' } }, required: ['name'] }
  },
  {
    type: 'function', name: 'family_done',
    description: 'Mark a chore as done and earn points',
    parameters: { type: 'object', properties: { name: { type: 'string' }, chore: { type: 'string', description: 'Chore title or part of it' } }, required: ['name', 'chore'] }
  },
  {
    type: 'function', name: 'family_my_points',
    description: 'Check points balance and available rewards',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    type: 'function', name: 'family_mood',
    description: 'Log a mood check-in for a family member',
    parameters: { type: 'object', properties: { name: { type: 'string' }, mood: { type: 'string', enum: ['amazing','happy','okay','sad','angry','anxious'] }, note: { type: 'string' } }, required: ['name', 'mood'] }
  },
  {
    type: 'function', name: 'family_whats_for_dinner',
    description: "What's on the meal plan today",
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'family_scoreboard',
    description: 'Family points leaderboard',
    parameters: { type: 'object', properties: {} }
  },
  // === SHORTCUTS (life-mcp) ===
  {
    type: 'function', name: 'shortcut_morning',
    description: "Morning routine — today's briefing, weather, pending chores",
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'shortcut_goodnight',
    description: 'Goodnight routine — journal check, tomorrow preview, summary notification',
    parameters: { type: 'object', properties: { journal_note: { type: 'string', description: 'Quick note about today' } } }
  },
  // === JOURNAL ===
  {
    type: 'function', name: 'journal_write',
    description: "Write or append to today's journal entry",
    parameters: { type: 'object', properties: { content: { type: 'string' }, mood: { type: 'string', enum: ['great','good','okay','low','bad'] }, energy: { type: 'number', description: '1-5' }, highlights: { type: 'array', items: { type: 'string' } } }, required: ['content'] }
  },
  {
    type: 'function', name: 'journal_read',
    description: 'Read journal entries',
    parameters: { type: 'object', properties: { date: { type: 'string' }, days: { type: 'number' } } }
  },
  // === MOOD ===
  {
    type: 'function', name: 'mood_checkin',
    description: 'Log a mood check-in',
    parameters: { type: 'object', properties: { member: { type: 'string' }, mood: { type: 'string', enum: ['amazing','happy','okay','sad','angry','anxious'] }, note: { type: 'string' } }, required: ['member', 'mood'] }
  },
]
