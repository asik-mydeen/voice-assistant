const f = (name: string, desc: string, params: any = {}) =>
  ({ type: 'function', name, description: desc, parameters: { type: 'object', ...params } })

const s = (d?: string) => ({ type: 'string' as const, ...(d ? { description: d } : {}) })
const n = (d?: string) => ({ type: 'number' as const, ...(d ? { description: d } : {}) })
const b = () => ({ type: 'boolean' as const })
const a = (t = 'string') => ({ type: 'array' as const, items: { type: t } })
const e = (vals: string[]) => ({ type: 'string' as const, enum: vals })

export const FUNCTIONS = [
  f('cal_today', "Today's calendar events", { properties: { member: s() } }),
  f('cal_upcoming', 'Upcoming events', { properties: { days: n(), member: s() } }),
  f('cal_add', 'Add calendar event', { properties: { title: s(), start: s('ISO datetime'), end: s(), member: s(), all_day: b() }, required: ['title','start'] }),
  f('cal_search', 'Search calendar', { properties: { query: s() }, required: ['query'] }),
  f('chore_list', 'List chores', { properties: { member: s(), completed: b(), category: s() } }),
  f('chore_add', 'Add chore', { properties: { title: s(), member: s(), category: e(['chore','homework','errand','cleaning','cooking','other']), due_date: s(), priority: e(['low','medium','high']), points: n() }, required: ['title'] }),
  f('chore_complete', 'Complete chore, earn points', { properties: { id: s(), member: s() }, required: ['id'] }),
  f('food_log', 'Log meal with nutrition', { properties: { description: s('What was eaten'), meal_type: e(['breakfast','lunch','dinner','snack']), member: s() }, required: ['description','meal_type'] }),
  f('food_today', 'Food eaten today', { properties: { member: s() } }),
  f('food_analyze', 'Analyze nutrition', { properties: { description: s() }, required: ['description'] }),
  f('meal_today', 'Meal plan today', { properties: {} }),
  f('meal_plan', 'Add to meal plan', { properties: { title: s(), meal_type: e(['breakfast','lunch','dinner','snack']), date: s(), notes: s() }, required: ['title','meal_type'] }),
  f('memory_save', 'Remember something', { properties: { content: s(), title: s(), category: e(['general','personal','work','tech','idea','decision','preference','project','people','health','finance']), tags: a() }, required: ['content'] }),
  f('memory_search', 'Search memories', { properties: { query: s() }, required: ['query'] }),
  f('ask', 'Search ALL personal data', { properties: { question: s() }, required: ['question'] }),
  f('expense_add', 'Log expense', { properties: { amount: n(), description: s(), category: e(['food','transport','housing','utilities','entertainment','health','shopping','education','travel','subscriptions','other']), vendor: s() }, required: ['amount','description'] }),
  f('expense_summary', 'Spending summary', { properties: { period: e(['today','week','month','year']) } }),
  f('health_log', 'Log health metric', { properties: { metric: s('weight,sleep,water,steps,exercise'), value: n(), unit: s(), notes: s() }, required: ['metric'] }),
  f('health_today', 'Health logged today', { properties: {} }),
  f('health_summary', 'Health trends', { properties: { days: n() } }),
  f('home_states', 'Smart home states', { properties: { domain: s('light,switch,sensor,climate,media_player') } }),
  f('home_call_service', 'Control smart home', { properties: { domain: s(), service: s('turn_on,turn_off,toggle'), entity_id: s(), data: { type: 'object' } }, required: ['domain','service'] }),
  f('notify_send', 'Push notification', { properties: { message: s(), title: s(), priority: e(['min','low','default','high','urgent']) }, required: ['message'] }),
  f('notify_remind', 'Set reminder', { properties: { what: s(), when: s('in 30min, tomorrow 9am') }, required: ['what','when'] }),
  f('list_all', 'All lists', { properties: {} }),
  f('list_view', 'View list', { properties: { name: s() }, required: ['name'] }),
  f('list_add_item', 'Add to list', { properties: { list_name: s(), item: s() }, required: ['list_name','item'] }),
  f('countdown_list', 'Active countdowns', { properties: {} }),
  f('countdown_add', 'Add countdown', { properties: { title: s(), date: s('YYYY-MM-DD') }, required: ['title','date'] }),
  f('journal_write', 'Write journal', { properties: { content: s(), mood: e(['great','good','okay','low','bad']), energy: n('1-5'), highlights: a() }, required: ['content'] }),
  f('journal_read', 'Read journal', { properties: { date: s(), days: n() } }),
  f('mood_checkin', 'Mood check-in', { properties: { member: s(), mood: e(['amazing','happy','okay','sad','angry','anxious']), note: s() }, required: ['member','mood'] }),
  f('context_now', 'Full current context', { properties: {} }),
  f('digest_daily', 'Daily briefing', { properties: {} }),
  f('digest_weekly', 'Weekly summary', { properties: {} }),
  f('family_my_chores', "Member's chores", { properties: { name: s() }, required: ['name'] }),
  f('family_done', 'Complete chore', { properties: { name: s(), chore: s() }, required: ['name','chore'] }),
  f('family_my_points', 'Check points', { properties: { name: s() }, required: ['name'] }),
  f('family_mood', 'Family mood', { properties: { name: s(), mood: e(['amazing','happy','okay','sad','angry','anxious']), note: s() }, required: ['name','mood'] }),
  f('family_whats_for_dinner', "What's for dinner", { properties: {} }),
  f('family_scoreboard', 'Points leaderboard', { properties: {} }),
  f('shortcut_morning', 'Morning routine', { properties: {} }),
  f('shortcut_goodnight', 'Goodnight routine', { properties: { journal_note: s() } }),
  // Ship MCP - Infrastructure
  f('ship_list_projects', 'List all deployed projects and their status', { properties: {} }),
  f('ship_status', 'Check if a deployed app is live', { properties: { name: s('Project name') }, required: ['name'] }),
  f('ship_deploy', 'Redeploy a project', { properties: { name: s('Project name') }, required: ['name'] }),
  f('ship_app_health', 'Deep health check for a deployed app', { properties: { name: s('Project name') }, required: ['name'] }),
  f('ship_logs', 'Get deployment history', { properties: { name: s('Project name') }, required: ['name'] }),
  f('ship_env_set', 'Update environment variables', { properties: { name: s('Project name'), env_vars: { type: 'object', additionalProperties: { type: 'string' } } }, required: ['name', 'env_vars'] }),
  f('ship_compose_status', 'Get compose project status', { properties: { name: s('Project name') }, required: ['name'] }),
  f('ship_tunnel_set', 'Set Cloudflare tunnel routing for a subdomain', { properties: { subdomain: s('Subdomain'), port: n('Port number') }, required: ['subdomain', 'port'] }),
]
