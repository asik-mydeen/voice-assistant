export const FUNCTIONS = [
  // Calendar
  { type: 'function', name: 'cal_today', description: "Get today's calendar events", parameters: { type: 'object', properties: { member: { type: 'string', description: 'Family member: Asik, Nikkath, Aarish, Aaraa' } } } },
  { type: 'function', name: 'cal_upcoming', description: 'Upcoming events for the next N days', parameters: { type: 'object', properties: { days: { type: 'number', description: 'Days ahead (default 7)' }, member: { type: 'string' } } } },
  { type: 'function', name: 'cal_add', description: 'Add a calendar event', parameters: { type: 'object', properties: { title: { type: 'string' }, start: { type: 'string', description: 'ISO datetime or natural language' }, end: { type: 'string' }, member: { type: 'string' }, all_day: { type: 'boolean' } }, required: ['title', 'start'] } },
  { type: 'function', name: 'cal_search', description: 'Search calendar events', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },

  // Chores
  { type: 'function', name: 'chore_list', description: 'List chores/tasks', parameters: { type: 'object', properties: { member: { type: 'string' }, completed: { type: 'boolean' }, category: { type: 'string' } } } },
  { type: 'function', name: 'chore_add', description: 'Add a chore for a family member', parameters: { type: 'object', properties: { title: { type: 'string' }, member: { type: 'string' }, category: { type: 'string', enum: ['chore', 'homework', 'errand', 'cleaning', 'cooking', 'other'] }, due_date: { type: 'string' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, points: { type: 'number' } }, required: ['title'] } },
  { type: 'function', name: 'chore_complete', description: 'Mark a chore as done. Awards points.', parameters: { type: 'object', properties: { id: { type: 'string' }, member: { type: 'string' } }, required: ['id'] } },

  // Food
  { type: 'function', name: 'food_log', description: 'Log a meal with nutrition analysis', parameters: { type: 'object', properties: { description: { type: 'string', description: 'What was eaten' }, meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] }, member: { type: 'string' } }, required: ['description', 'meal_type'] } },
  { type: 'function', name: 'food_today', description: "What's been eaten today", parameters: { type: 'object', properties: { member: { type: 'string' } } } },
  { type: 'function', name: 'food_analyze', description: 'Analyze nutrition without logging', parameters: { type: 'object', properties: { description: { type: 'string' } }, required: ['description'] } },
  { type: 'function', name: 'meal_today', description: "Today's meal plan", parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'meal_plan', description: 'Add a meal to the plan', parameters: { type: 'object', properties: { title: { type: 'string' }, meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] }, date: { type: 'string' }, notes: { type: 'string' } }, required: ['title', 'meal_type'] } },

  // Memory
  { type: 'function', name: 'memory_save', description: 'Remember something — a fact, preference, decision, idea', parameters: { type: 'object', properties: { content: { type: 'string' }, title: { type: 'string' }, category: { type: 'string', enum: ['general', 'personal', 'work', 'tech', 'idea', 'decision', 'preference', 'project', 'people', 'health', 'finance'] }, tags: { type: 'array', items: { type: 'string' } } }, required: ['content'] } },
  { type: 'function', name: 'memory_search', description: 'Search saved memories', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { type: 'function', name: 'ask', description: 'Search across ALL personal data — memories, links, snippets, journal, people, expenses, calendar', parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } },

  // Finance
  { type: 'function', name: 'expense_add', description: 'Log an expense', parameters: { type: 'object', properties: { amount: { type: 'number' }, description: { type: 'string' }, category: { type: 'string', enum: ['food', 'transport', 'housing', 'utilities', 'entertainment', 'health', 'shopping', 'education', 'travel', 'subscriptions', 'other'] }, vendor: { type: 'string' } }, required: ['amount', 'description'] } },
  { type: 'function', name: 'expense_summary', description: 'Spending summary for a period', parameters: { type: 'object', properties: { period: { type: 'string', enum: ['today', 'week', 'month', 'year'] } } } },

  // Health
  { type: 'function', name: 'health_log', description: 'Log a health metric', parameters: { type: 'object', properties: { metric: { type: 'string', description: 'weight, sleep, water, steps, exercise, medication, blood_pressure' }, value: { type: 'number' }, unit: { type: 'string' }, notes: { type: 'string' } }, required: ['metric'] } },
  { type: 'function', name: 'health_today', description: 'Health metrics logged today', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'health_summary', description: 'Health summary with trends', parameters: { type: 'object', properties: { days: { type: 'number' } } } },

  // Smart Home
  { type: 'function', name: 'home_states', description: 'Get smart home entity states', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'light, switch, sensor, climate, media_player' } } } },
  { type: 'function', name: 'home_call_service', description: 'Control smart home — lights, climate, media', parameters: { type: 'object', properties: { domain: { type: 'string', description: 'light, switch, climate, media_player, automation, script' }, service: { type: 'string', description: 'turn_on, turn_off, toggle, set_temperature' }, entity_id: { type: 'string' }, data: { type: 'object' } }, required: ['domain', 'service'] } },

  // Notifications
  { type: 'function', name: 'notify_send', description: 'Send a push notification to phone', parameters: { type: 'object', properties: { message: { type: 'string' }, title: { type: 'string' }, priority: { type: 'string', enum: ['min', 'low', 'default', 'high', 'urgent'] } }, required: ['message'] } },
  { type: 'function', name: 'notify_remind', description: 'Set a reminder', parameters: { type: 'object', properties: { what: { type: 'string' }, when: { type: 'string', description: 'in 30min, in 2h, tomorrow 9am' } }, required: ['what', 'when'] } },

  // Lists
  { type: 'function', name: 'list_all', description: 'Show all lists', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'list_view', description: 'View items in a list', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { type: 'function', name: 'list_add_item', description: 'Add item to a list', parameters: { type: 'object', properties: { list_name: { type: 'string' }, item: { type: 'string' }, category: { type: 'string' } }, required: ['list_name', 'item'] } },

  // Countdowns
  { type: 'function', name: 'countdown_list', description: 'Active countdowns with days remaining', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'countdown_add', description: 'Add a countdown to a date', parameters: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['title', 'date'] } },

  // Journal
  { type: 'function', name: 'journal_write', description: 'Write or append to today\'s journal', parameters: { type: 'object', properties: { content: { type: 'string' }, mood: { type: 'string', enum: ['great', 'good', 'okay', 'low', 'bad'] }, energy: { type: 'number', description: '1-5' }, highlights: { type: 'array', items: { type: 'string' } } }, required: ['content'] } },
  { type: 'function', name: 'journal_read', description: 'Read journal entries', parameters: { type: 'object', properties: { date: { type: 'string' }, days: { type: 'number' } } } },

  // Mood
  { type: 'function', name: 'mood_checkin', description: 'Log a mood check-in', parameters: { type: 'object', properties: { member: { type: 'string' }, mood: { type: 'string', enum: ['amazing', 'happy', 'okay', 'sad', 'angry', 'anxious'] }, note: { type: 'string' } }, required: ['member', 'mood'] } },

  // Context & Briefings (life-mcp)
  { type: 'function', name: 'context_now', description: 'Full current context — time, calendar, chores, mood, recent memories', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'digest_daily', description: 'Complete daily briefing — everything happening today', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'digest_weekly', description: 'Weekly summary', parameters: { type: 'object', properties: {} } },

  // Family (life-mcp)
  { type: 'function', name: 'family_my_chores', description: "Show a family member's chores", parameters: { type: 'object', properties: { name: { type: 'string', description: 'Aarish, Aaraa, Nikkath, Asik' } }, required: ['name'] } },
  { type: 'function', name: 'family_done', description: 'Mark a chore done and earn points', parameters: { type: 'object', properties: { name: { type: 'string' }, chore: { type: 'string' } }, required: ['name', 'chore'] } },
  { type: 'function', name: 'family_my_points', description: 'Check points and available rewards', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { type: 'function', name: 'family_mood', description: 'Mood check-in for a family member', parameters: { type: 'object', properties: { name: { type: 'string' }, mood: { type: 'string', enum: ['amazing', 'happy', 'okay', 'sad', 'angry', 'anxious'] }, note: { type: 'string' } }, required: ['name', 'mood'] } },
  { type: 'function', name: 'family_whats_for_dinner', description: "What's for dinner today", parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'family_scoreboard', description: 'Family points leaderboard', parameters: { type: 'object', properties: {} } },

  // Shortcuts (life-mcp)
  { type: 'function', name: 'shortcut_morning', description: 'Morning routine briefing', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'shortcut_goodnight', description: 'Goodnight routine', parameters: { type: 'object', properties: { journal_note: { type: 'string' } } } },
]
