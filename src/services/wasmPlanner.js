let modulePromise;

class PlannerUnavailableError extends Error {
  constructor(cause) {
    super('Temporary fallback active: scheduling is unavailable until the C WebAssembly module is built. Follow wasm/README.md to build it.');
    this.name = 'PlannerUnavailableError';
    this.cause = cause;
  }
}

async function getModule() {
  if (!modulePromise) {
    const moduleUrl = new URL(
      `${import.meta.env.BASE_URL}wasm/study_planner.js`,
      window.location.href,
    ).href;
    modulePromise = fetch(moduleUrl, { method: 'HEAD' })
      .then((response) => {
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !/javascript/i.test(contentType)) {
          throw new Error(`The generated module was not found at ${moduleUrl}.`);
        }
        return import(/* @vite-ignore */ moduleUrl);
      })
      .then(({ default: createPlannerModule }) => createPlannerModule())
      .catch((error) => {
        modulePromise = undefined;
        throw new PlannerUnavailableError(error);
      });
  }
  return modulePromise;
}

export async function checkPlannerAvailability() {
  try {
    await getModule();
    return true;
  } catch (error) {
    if (error instanceof PlannerUnavailableError) return false;
    throw error;
  }
}

export function isPlannerUnavailable(error) {
  return error instanceof PlannerUnavailableError;
}

export async function runPlanner(sessions, strategy) {
  validateSessions(sessions);
  if (strategy !== 'greedy' && strategy !== 'weighted') {
    throw new Error(`Unknown planner strategy: ${strategy}.`);
  }
  const module = await getModule();
  module._planner_reset();
  const cIds = addSessions(module, sessions);
  return readPlan(module, cIds, strategy);
}

export async function runBothPlanners(sessions) {
  validateSessions(sessions);
  const module = await getModule();
  module._planner_reset();
  const cIds = addSessions(module, sessions);
  return {
    greedy: readPlan(module, cIds, 'greedy'),
    weighted: readPlan(module, cIds, 'weighted'),
  };
}

function validateSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length > 10) {
    throw new Error('The planner supports up to 10 input study sessions.');
  }
  sessions.forEach((session) => {
    const importance = Number(session.importance);
    if (!Number.isInteger(importance) || importance < 1 || importance > 10) {
      throw new Error(`Importance for “${session.subject}” must be between 1 and 10.`);
    }
    if (!session.subject?.trim() || !validTime(session.start) || !validTime(session.end) ||
        toMinutes(session.end) <= toMinutes(session.start)) {
      throw new Error(`The planner received invalid session details for “${session.subject || 'Unnamed session'}”.`);
    }
  });
}

function addSessions(module, sessions) {
  const cIds = new Map();
  sessions.forEach((session) => {
    const id = module.ccall(
      'planner_add_session',
      'number',
      ['string', 'number', 'number', 'number'],
      [session.subject, toMinutes(session.start), toMinutes(session.end), Number(session.importance)],
    );
    if (!id) throw new Error(`The C planner rejected “${session.subject}”.`);
    cIds.set(id, session);
  });
  return cIds;
}

function readPlan(module, cIds, strategy) {
  const weighted = strategy === 'weighted';
  const count = module[weighted ? '_planner_weighted_compute' : '_planner_greedy_compute']();
  const idAt = module[weighted ? '_planner_weighted_id_at' : '_planner_greedy_id_at'];
  const importance = module[weighted ? '_planner_weighted_importance' : '_planner_greedy_importance']();
  const selected = Array.from({ length: count }, (_, index) => cIds.get(idAt(index))).filter(Boolean);
  return { selected, count, importance, engine: 'C / WebAssembly' };
}

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}