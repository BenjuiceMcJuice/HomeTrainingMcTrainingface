/**
 * BetaLog — JSDoc type definitions
 * Derived from betalog_data_model.md — keep in sync with that document.
 */

/**
 * @typedef {"gym" | "climb" | "hangboard" | "cardio"} SessionType
 */

/**
 * @typedef {"boulder" | "lead" | "toprope"} Discipline
 */

/**
 * @typedef {"flashed" | "sent" | "attempt" | "project"} ClimbOutcome
 */

/**
 * @typedef {"v" | "french" | "yds" | "uk_trad"} GradeSystem
 */

/**
 * @typedef {"half-crimp" | "open-hand" | "full-crimp" | "two-finger-23" | "two-finger-34" | "mono" | "sloper" | "pinch" | "jug"} GripType
 */

/**
 * @typedef {"bodyweight" | "added" | "assisted"} WeightMode
 */

/**
 * Muscle group the exercise primarily trains — drives filter chips in the UI.
 * @typedef {"chest" | "back" | "shoulders" | "arms" | "legs" | "core" | "mobility" | "cardio" | "other"} ExerciseCategory
 */

/**
 * @typedef {"push" | "pull" | "hinge" | "squat" | "carry" | "rotation" | "isometric" | null} MovementPattern
 */

/**
 * @typedef {"bw" | "db" | "bb" | "kb" | "band" | "cable" | "machine" | "other" | null} Equipment
 */

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ExerciseSet
 * @property {number} reps
 * @property {number} weight       - kg; 0 for bodyweight
 * @property {number | null} rir   - Reps in Reserve; null if not tracked
 * @property {boolean} done        - ticked off during the session
 */

/**
 * @typedef {Object} SessionExercise
 * @property {string} exerciseId   - reference to Exercise.id
 * @property {string} name         - denormalised for display
 * @property {"reps" | "time"} trackingType
 * @property {ExerciseSet[]} sets
 * @property {boolean} [done]      - routine completion flag; absent on pre-2026-04-15 sessions (treat as done)
 */

/**
 * @typedef {Object} Climb
 * @property {string} id
 * @property {string} grade        - raw string as entered, e.g. "V4", "6b+"
 * @property {GradeSystem} gradeSystem
 * @property {Discipline} discipline
 * @property {ClimbOutcome} outcome
 * @property {number} attempts     - minimum 1; a flash is always attempts: 1
 * @property {string | null} location   - free text, denormalised from session
 * @property {string | null} routeId
 * @property {string | null} gymId
 * @property {string | null} centreId
 */

/**
 * @typedef {Object} HangGrip
 * @property {string} id
 * @property {string} fingers      - e.g. "4 Finger", "Front 2", "Mono Index"
 * @property {GripType} gripType   - canonical grip type, e.g. "half-crimp"
 * @property {GripType} grip       - legacy alias of gripType — kept for storage compat
 * @property {string} edgeSize     - e.g. "20mm", "Sloper", "Jug", or "" for unspecified
 * @property {string} gripName     - human-readable label, e.g. "4 Finger · Half Crimp · 20mm"
 * @property {number} activeSecs   - hang duration per rep
 * @property {number} restSecs     - rest between reps
 * @property {number} setRest      - rest between sets
 * @property {number} reps
 * @property {number} sets
 * @property {WeightMode} weightMode
 * @property {number} weightKg     - kg added or assisted; 0 if bodyweight
 */

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} date                  - ISO date "YYYY-MM-DD"
 * @property {SessionType} type
 * @property {Discipline | null} discipline  - set when type === "climb", else null
 * @property {string | null} routineId      - id of the Routine used; null for ad-hoc sessions
 * @property {string | null} routineName    - denormalised routine name for display after deletion/rename
 * @property {1|2|3|4|5} difficulty         - perceived effort
 * @property {string} notes
 * @property {string | null} location      - free text, where the session happened (climb sessions)
 * @property {SessionExercise[]} exercises  - populated when type === "gym", else []
 * @property {Climb[]} climbs               - populated when type === "climb", else []
 * @property {HangGrip[]} hangGrips         - populated when type === "hangboard", else []
 * @property {string} createdAt             - ISO datetime
 * @property {string} updatedAt             - ISO datetime
 * --- Cardio fields (type === "cardio" only) ---
 * @property {"swim"|"run"|"cycle"|"row"|"walk"|"yoga"|"other"|null} cardioActivity
 * @property {string | null} cardioLabel    - custom name when cardioActivity === "other"
 * @property {number | null} cardioDurationMins
 * @property {number | null} cardioQuantity - e.g. lengths, km, miles
 * @property {string | null} cardioUnit     - e.g. "lengths", "km", "miles", "laps"
 * @property {number | null} cardioPoolLength - metres; only used when cardioActivity === "swim"
 * @property {"breaststroke"|"front_crawl"|"backstroke"|"butterfly"|"general"|null} cardioStrokeType - swim only
 * @property {number | null} cardioKcalLow  - estimated kcal burn lower bound; null if no weight logged at save time
 * @property {number | null} cardioKcalHigh - estimated kcal burn upper bound
 */

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Exercise
 * @property {string} id
 * @property {string} name
 * @property {ExerciseCategory} category
 * @property {MovementPattern} movementPattern
 * @property {Equipment} equipment
 * @property {string} muscles       - free text, e.g. "Lats, biceps"
 * @property {string} notes
 * @property {"reps" | "time"} trackingType  - "reps" = rep counter; "time" = countdown timer
 * @property {number} defaultSets
 * @property {number} defaultReps      - used when trackingType === "reps"
 * @property {number} defaultDuration  - seconds per set, used when trackingType === "time"
 * @property {number} defaultRest      - seconds between sets
 * @property {number} defaultWeight    - kg offset; 0 = bodyweight, positive = added, negative = assisted
 * @property {string} ytSearch      - custom YouTube search query; if blank, "how to {name} form tutorial" is used
 * @property {boolean} isFavourite  - pinned to top of list
 * @property {string} createdAt
 * @property {string} updatedAt
 */

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RoutineExercise
 * @property {string} exerciseId
 * @property {string} name             - denormalised
 * @property {"reps" | "time"} trackingType
 * @property {number} targetSets
 * @property {number} targetReps       - used when trackingType === "reps"
 * @property {number} targetDuration   - seconds per set; used when trackingType === "time"
 * @property {number} targetRest       - seconds between sets
 * @property {number} targetWeight     - kg offset; 0 = bodyweight, positive = added, negative = assisted
 * @property {number} order            - 0-indexed display order
 */

/**
 * @typedef {Object} Routine
 * @property {string} id
 * @property {string} name
 * @property {"gym" | "hangboard"} type
 * @property {RoutineExercise[]} exercises  - populated when type === "gym", else []
 * @property {HangGrip[]} grips            - populated when type === "hangboard", else []
 * @property {string} createdAt
 * @property {string} updatedAt
 */

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ScheduleEntry
 * @property {string} id
 * @property {string} routineId    - reference to Routine.id
 * @property {string} routineName  - denormalised for display
 * @property {number[]} days       - 1=Monday … 7=Sunday
 * @property {string[]} [remindTimes] - "HH:MM" local, 24h, earliest first. Absent = no
 *                                 reminder. A routine wanting a morning and an evening
 *                                 nudge carries two times here rather than occupying two
 *                                 of the three schedule slots.
 * @property {string} [remindAt]   - LEGACY single time, written before `remindTimes`.
 *                                 Never written any more; `entryTimes()` still reads it so
 *                                 old localStorage and old KV mirrors keep working.
 * @property {string} [tz]         - IANA zone, e.g. "Europe/London". Captured with remindAt.
 * @property {string} [remindFrom] - "YYYY-MM-DD". Anchors the calendar feed's DTSTART, set once.
 */

/**
 * Calendar feed record — the private .ics subscription. Absent until the user
 * enables it, which is what makes reminders off by default.
 * @typedef {Object} CalendarFeed
 * @property {string} token        - 32 hex chars. Bearer secret: the URL is the credential.
 * @property {boolean} enabled
 * @property {string} createdAt    - ISO instant. Stable anchor for entries with no remindFrom.
 * @property {string} [pushedAt]   - ISO instant of the last successful upload
 * @property {string} [pushedHash] - fingerprint of the last uploaded feed, to skip no-op uploads
 */

/**
 * Schedule is an array of up to 3 ScheduleEntry objects stored under il_schedule.
 * @typedef {ScheduleEntry[]} Schedule
 */

// ---------------------------------------------------------------------------
// Weight log
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} WeightEntry
 * @property {string} id
 * @property {string} date          - ISO date "YYYY-MM-DD"
 * @property {number} weight        - kg
 * @property {string | null} note
 */

// ---------------------------------------------------------------------------
// Drink log
// ---------------------------------------------------------------------------

/**
 * @typedef {"beer_cider" | "wine" | "spirit" | "other"} DrinkType
 */

/**
 * @typedef {Object} DrinkEntry
 * @property {string} id
 * @property {string} date          - ISO date "YYYY-MM-DD"
 * @property {DrinkType} type
 * @property {string | null} label  - optional descriptor e.g. "Guinness", "Prosecco"
 * @property {number} volumeMl      - volume per serving in ml
 * @property {number} abv           - ABV as a percentage e.g. 4.5 (not 0.045)
 * @property {number} quantity      - number of servings
 * @property {number} units         - derived: (volumeMl × abv × quantity) / 1000 — stored not re-derived
 * @property {number} kcal          - derived: alcohol + carb calories — stored not re-derived
 * @property {string | null} note
 * @property {string} createdAt     - ISO datetime
 */

// ---------------------------------------------------------------------------
// Athlete profile
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AthleteProfile
 * @property {string} name
 * @property {number | null} heightCm
 * @property {number | null} weightKg
 * @property {number | null} apeIndex   - arm span minus height in cm
 * @property {string | null} climbingSince  - ISO date
 * @property {string | null} homeGym
 * @property {string} goals
 * @property {string[]} [dashWidgets]        - which dashboard widgets are shown
 * @property {string[]} [widgetOrder]        - dashboard widget order
 * @property {Object<string, boolean>} [widgetCollapsed] - per-widget collapse state
 * @property {Object<string, string>} [widgetWindow]     - per-widget timeframe, e.g. {cardioStats: '90d'}
 * @property {string} updatedAt
 */

// ---------------------------------------------------------------------------
// Gym / Centre / Route (Phase 2 — gym integration)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Gym
 * @property {string} id
 * @property {string} name            - e.g. "Redpoint"
 * @property {string | null} logo     - URL to logo image (future)
 * @property {string | null} website
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Centre
 * @property {string} id
 * @property {string} name            - e.g. "Redpoint Bristol"
 * @property {string | null} address
 * @property {string} createdAt
 */

/**
 * @typedef {"admin" | "setter"} StaffRole
 */

/**
 * @typedef {Object} CentreStaff
 * @property {string} userId          - Firebase Auth UID
 * @property {StaffRole} role
 * @property {string} name            - display name
 * @property {string} addedAt         - ISO datetime
 * @property {string} addedBy         - UID of admin who granted access
 */

/**
 * @typedef {"active" | "retired"} RouteStatus
 */

/**
 * @typedef {Object} Route
 * @property {string} id
 * @property {Discipline} discipline
 * @property {string} grade           - e.g. "V5", "6b+"
 * @property {GradeSystem} gradeSystem
 * @property {string} colour          - hold colour, e.g. "orange", "#FF6B35"
 * @property {string | null} section  - wall section name (free text for MVP)
 * @property {string} description     - optional beta or notes
 * @property {string} setterName      - denormalised display name
 * @property {string} setterId        - Firebase UID
 * @property {string} setDate         - ISO date "YYYY-MM-DD"
 * @property {string | null} retiredDate - ISO date when retired, null while active
 * @property {RouteStatus} status
 * @property {string | null} photoUrl - optional photo (future)
 * @property {string} createdAt
 * @property {string} updatedAt
 */

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

/**
 * @typedef {"boulder_grade" | "rope_grade" | "weight" | "run" | "swim" | "cycle"} GoalType
 */

/**
 * @typedef {Object} Goal
 * @property {string} id
 * @property {GoalType} type
 * @property {string | number} target   - grade string (climbing) or numeric value
 * @property {string | null} unit       - 'kg', 'km' — null for grades
 * @property {string} targetDate        - ISO date YYYY-MM-DD
 * @property {string | number} startValue - value at goal creation (progress bar baseline)
 * @property {string} createdAt         - ISO timestamp
 * @property {boolean} achieved
 * @property {string | null} achievedDate - ISO date when auto-detected as hit
 */

// ---------------------------------------------------------------------------
// Root data object (what storage returns)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} BetaLogData
 * @property {Session[]} sessions
 * @property {Exercise[]} exercises
 * @property {Routine[]} routines
 * @property {Schedule | null} schedule
 * @property {WeightEntry[]} weightLog
 * @property {AthleteProfile | null} athleteProfile
 * @property {string[]} badges
 * @property {string} groqKey
 * @property {Goal[]} goals
 * @property {DrinkEntry[]} drinkLog
 */
